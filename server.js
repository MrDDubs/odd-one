// server.js (ESM)
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { GameState, LEVELS, CATEGORIES } from "./state.js";
import { connectTikFinity } from "./providers/tikfinity.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const state = new GameState();
let tikfinityConnected = false;
let tikfinityClient = null;
let currentWsUrl = process.env.TIKFINITY_WS_URL || "ws://localhost:21213/";
let timerInterval = null;
let autoNextTimer = null;
let autoNextDelayMs = 4000;

// Broadcast state to all connected game screens and admin panels
function broadcastState() {
  const publicData = {
    ...state.getPublicPayload(),
    tikfinityConnected
  };
  const adminData = {
    ...state.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl
  };

  io.emit("gameState", publicData);
  io.of("/admin").emit("gameState", adminData);
}

// Timer tick loop
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const result = state.tick();
    if (result.changed) {
      if (result.timeExpired) {
        io.emit("timeExpired", { target: state.target });
        io.of("/admin").emit("timeExpired", { target: state.target });
        // After time expires, wait 4 seconds and auto-start next round if enabled
        scheduleAutoNext(4000);
      }
      broadcastState();
    }
  }, 1000);
}

function scheduleAutoNext(delay = 4000) {
  if (autoNextTimer) clearTimeout(autoNextTimer);
  autoNextTimer = setTimeout(() => {
    state.newRound();
    broadcastState();
    io.emit("roundStarted", state.getPublicPayload());
  }, delay);
}

// Handle an incoming guess
function handleIncomingGuess(username, nickname, text) {
  const result = state.processGuess(username, nickname, text);
  if (!result.valid) return;

  // Broadcast guess to admin feed
  io.of("/admin").emit("chatGuess", result.guessItem);

  if (result.isCorrect) {
    console.log(`[Game] Correct guess by @${result.winner.nickname}: ${result.winner.code}! Target was ${state.target}`);
    
    // Broadcast win event
    io.emit("correctGuess", {
      winner: result.winner,
      target: state.target,
      streak: result.newStreak,
      levelUp: result.levelUp,
      statusMessage: state.statusMessage
    });
    io.of("/admin").emit("correctGuess", {
      winner: result.winner,
      target: state.target,
      streak: result.newStreak,
      levelUp: result.levelUp
    });

    broadcastState();
    // Schedule next round
    scheduleAutoNext(autoNextDelayMs);
  } else {
    // Notify overlay of a guess attempt (optional subtle UI flash or count)
    io.emit("guessAttempt", {
      code: result.guessItem.code,
      user: result.guessItem.nickname
    });
  }
}

// Bootstrap TikFinity connection
function initTikFinity(url) {
  if (tikfinityClient) {
    tikfinityClient.close();
  }
  currentWsUrl = url || currentWsUrl;
  console.log(`[TikFinity] Initializing connection to ${currentWsUrl}...`);

  tikfinityClient = connectTikFinity({
    wsUrl: currentWsUrl,
    token: process.env.TIKFINITY_TOKEN,
    onChat: ({ username, nickname, text }) => {
      handleIncomingGuess(username, nickname, text);
    },
    onLog: (msg) => {
      console.log(`[TikFinity] ${msg}`);
      io.of("/admin").emit("tikfinityLog", msg);
    },
    onStatusChange: (connected) => {
      tikfinityConnected = connected;
      broadcastState();
    }
  });
}

// REST API for external triggers or quick testing
app.get("/api/state", (_req, res) => {
  res.json(state.getAdminPayload());
});

app.post("/api/simulate", (req, res) => {
  const { user = "Viewer", nickname, guess } = req.body || {};
  if (!guess) return res.status(400).json({ error: "Missing guess coordinate (e.g. A4)" });
  handleIncomingGuess(user, nickname || user, guess);
  res.json({ ok: true, state: state.getPublicPayload() });
});

// Socket.IO: Game Overlay Namespace
io.on("connection", (socket) => {
  // Send immediate state on connect
  socket.emit("gameState", {
    ...state.getPublicPayload(),
    tikfinityConnected
  });

  socket.on("manualGuess", (code) => {
    handleIncomingGuess("Host", "Host", code);
  });
});

// Socket.IO: Admin Namespace
const adminNSP = io.of("/admin");
adminNSP.on("connection", (socket) => {
  console.log("[Admin] Host connected to admin panel");
  socket.emit("gameState", {
    ...state.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl
  });

  socket.on("startRound", (options) => {
    if (autoNextTimer) clearTimeout(autoNextTimer);
    state.newRound(options || {});
    broadcastState();
    io.emit("roundStarted", state.getPublicPayload());
  });

  socket.on("nextRound", (options) => {
    if (autoNextTimer) clearTimeout(autoNextTimer);
    state.newRound(options || {});
    broadcastState();
    io.emit("roundStarted", state.getPublicPayload());
  });

  socket.on("reveal", () => {
    if (autoNextTimer) clearTimeout(autoNextTimer);
    state.reveal();
    broadcastState();
    io.emit("answerRevealed", { target: state.target });
  });

  socket.on("togglePause", () => {
    state.setPaused(!state.paused);
    broadcastState();
  });

  socket.on("resetGame", () => {
    if (autoNextTimer) clearTimeout(autoNextTimer);
    state.resetGame();
    broadcastState();
    io.emit("roundStarted", state.getPublicPayload());
  });

  socket.on("setOptions", (opts) => {
    if (opts.category && CATEGORIES.includes(opts.category)) {
      state.category = opts.category;
    }
    if (opts.level) {
      state.level = Math.max(1, Math.min(5, parseInt(opts.level, 10)));
    }
    if (opts.autoLevel !== undefined) {
      state.autoLevel = !!opts.autoLevel;
    }
    if (opts.duration) {
      state.roundDurationSec = parseInt(opts.duration, 10);
      if (!state.active) state.time = state.roundDurationSec;
    }
    broadcastState();
  });

  socket.on("simulateGuess", ({ username, message }) => {
    handleIncomingGuess(username || "TestViewer", username || "TestViewer", message);
  });

  socket.on("reconnectTikfinity", (customUrl) => {
    if (customUrl) currentWsUrl = customUrl;
    initTikFinity(currentWsUrl);
  });

  socket.on("resetLeaderboard", () => {
    state.resetLeaderboard();
    broadcastState();
  });
});

// Start game and TikFinity
state.newRound();
startTimerLoop();
initTikFinity(currentWsUrl);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 Ally's Odd One Out Game is running!`);
  console.log(`📺 Game Overlay : http://localhost:${PORT}/`);
  console.log(`⚙️  Admin Panel  : http://localhost:${PORT}/admin.html`);
  console.log(`🔗 TikFinity WS : ${currentWsUrl}\n`);
});
