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
const LEADERBOARD_POPUP_MS = 4000;

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

// Trigger showing the 4-second leaderboard popup and auto-advance
function triggerLeaderboardAndNextRound() {
  if (autoNextTimer) clearTimeout(autoNextTimer);

  const payload = {
    roundWinners: state.roundWinners,
    leaderboard: state.getLeaderboard(5),
    durationMs: LEADERBOARD_POPUP_MS,
    target: state.target
  };

  io.emit("showLeaderboardPopup", payload);
  io.of("/admin").emit("showLeaderboardPopup", payload);

  autoNextTimer = setTimeout(() => {
    state.newRound();
    broadcastState();
    io.emit("roundStarted", state.getPublicPayload());
    io.of("/admin").emit("roundStarted", state.getAdminPayload());
  }, LEADERBOARD_POPUP_MS);
}

// Timer tick loop
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const result = state.tick();
    if (result.changed) {
      if (result.timeExpired) {
        io.emit("timeExpired", {
          target: state.target,
          hadWinners: result.hadWinners,
          roundWinners: result.roundWinners
        });
        io.of("/admin").emit("timeExpired", {
          target: state.target,
          hadWinners: result.hadWinners,
          roundWinners: result.roundWinners
        });

        if (result.hadWinners) {
          triggerLeaderboardAndNextRound();
        } else {
          // If no winners, show answer for 4s then next round
          if (autoNextTimer) clearTimeout(autoNextTimer);
          autoNextTimer = setTimeout(() => {
            state.newRound();
            broadcastState();
            io.emit("roundStarted", state.getPublicPayload());
            io.of("/admin").emit("roundStarted", state.getAdminPayload());
          }, 4000);
        }
      }
      broadcastState();
    }
  }, 1000);
}

// Handle an incoming guess
function handleIncomingGuess(username, nickname, text, avatar = null) {
  const result = state.processGuess(username, nickname, text, avatar);
  if (!result.valid) return;

  // Broadcast guess to admin feed
  io.of("/admin").emit("chatGuess", result.guessItem);

  if (result.isCorrect) {
    console.log(`[Game] Winner #${result.place} found it: @${result.winner.nickname} (${result.winner.code})!`);
    
    // Broadcast win event
    const winPayload = {
      winner: result.winner,
      place: result.place,
      points: result.points,
      target: state.target,
      streak: result.newStreak,
      levelUp: result.levelUp,
      statusMessage: state.statusMessage,
      roundWinners: result.roundWinners
    };

    io.emit("winnerFound", winPayload);
    io.of("/admin").emit("winnerFound", winPayload);

    broadcastState();

    if (result.roundComplete) {
      // 2 winners found! Show leaderboard for 4s, then next round!
      triggerLeaderboardAndNextRound();
    }
  } else {
    // Notify overlay of a guess attempt
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
    onChat: ({ username, nickname, text, avatar }) => {
      handleIncomingGuess(username, nickname, text, avatar);
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

// REST API for external triggers or testing
app.get("/api/state", (_req, res) => {
  res.json(state.getAdminPayload());
});

app.post("/api/simulate", (req, res) => {
  const { user = "Viewer", nickname, guess, avatar } = req.body || {};
  if (!guess) return res.status(400).json({ error: "Missing guess coordinate (e.g. A4)" });
  handleIncomingGuess(user, nickname || user, guess, avatar || null);
  res.json({ ok: true, state: state.getPublicPayload() });
});

// Helper for shared game actions (callable by Game Screen or Admin)
function actionStartRound(options = {}) {
  if (autoNextTimer) clearTimeout(autoNextTimer);
  state.newRound(options);
  broadcastState();
  io.emit("roundStarted", state.getPublicPayload());
  io.of("/admin").emit("roundStarted", state.getAdminPayload());
}

function actionNextRound(options = {}) {
  if (autoNextTimer) clearTimeout(autoNextTimer);
  state.newRound(options);
  broadcastState();
  io.emit("roundStarted", state.getPublicPayload());
  io.of("/admin").emit("roundStarted", state.getAdminPayload());
}

function actionReveal() {
  if (autoNextTimer) clearTimeout(autoNextTimer);
  state.reveal();
  broadcastState();
  io.emit("answerRevealed", { target: state.target });
  io.of("/admin").emit("answerRevealed", { target: state.target });
}

function actionTogglePause() {
  state.setPaused(!state.paused);
  broadcastState();
}

function actionResetGame() {
  if (autoNextTimer) clearTimeout(autoNextTimer);
  state.resetGame();
  broadcastState();
  io.emit("roundStarted", state.getPublicPayload());
  io.of("/admin").emit("roundStarted", state.getAdminPayload());
}

// Socket.IO: Game Overlay Namespace
io.on("connection", (socket) => {
  // Send immediate state on connect
  socket.emit("gameState", {
    ...state.getPublicPayload(),
    tikfinityConnected
  });

  socket.on("manualGuess", (code) => {
    if (code) handleIncomingGuess("Host", "Host", code);
  });

  // Wire up game screen buttons so START, REVEAL, and NEXT work directly from the overlay!
  socket.on("startRound", () => actionStartRound());
  socket.on("nextRound", () => actionNextRound());
  socket.on("reveal", () => actionReveal());
  socket.on("togglePause", () => actionTogglePause());
  socket.on("resetGame", () => actionResetGame());
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

  socket.on("startRound", (options) => actionStartRound(options));
  socket.on("nextRound", (options) => actionNextRound(options));
  socket.on("reveal", () => actionReveal());
  socket.on("togglePause", () => actionTogglePause());
  socket.on("resetGame", () => actionResetGame());

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

  socket.on("simulateGuess", ({ username, nickname, message, avatar }) => {
    handleIncomingGuess(username || "TestViewer", nickname || username || "TestViewer", message, avatar || null);
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
