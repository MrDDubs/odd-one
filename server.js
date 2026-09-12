// server.js (ESM) - Ally's Stream Hub
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { gameRegistry } from "./games/registry.js";
import { connectTikFinity } from "./providers/tikfinity.js";
import { connectTikTokLive, fetchTikTokAvatar } from "./providers/tiktok.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env");
const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Serve static assets from public and games directories
app.use(express.static(path.join(__dirname, "public")));
app.use("/games", express.static(path.join(__dirname, "games")));

// Provider Connection States
let tikfinityConnected = false;
let tikfinityClient = null;
let currentWsUrl = process.env.TIKFINITY_WS_URL || "ws://localhost:21213/";

let tiktokLiveClient = null;
let tiktokLiveUsername = process.env.TIKTOK_USERNAME || "";
let tiktokLiveStatus = {
  connected: false,
  connecting: false,
  nickname: "",
  avatar: "",
  username: tiktokLiveUsername
};

let timerInterval = null;
let autoNextTimer = null;
const LEADERBOARD_POPUP_MS = 4000;

// Helper to persist environment variables
function updateEnvFile(key, value) {
  try {
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf8");
    }
    const lines = content.split(/\r?\n/);
    let found = false;
    const newLines = lines.map((line) => {
      if (line.trim().startsWith(`${key}=`)) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });
    if (!found) {
      newLines.push(`${key}=${value}`);
    }
    fs.writeFileSync(envPath, newLines.join("\n"), "utf8");
    process.env[key] = value;
  } catch (err) {
    console.error(`[Env] Failed to update ${key} in .env:`, err.message);
  }
}

// Broadcast Hub state to overlays and dashboard
function broadcastState() {
  const publicData = {
    ...gameRegistry.getPublicPayload(),
    tikfinityConnected,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar
  };

  const adminData = {
    ...gameRegistry.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar
  };

  io.emit("gameState", publicData);
  io.of("/admin").emit("gameState", adminData);
}

// Auto-advance round with leaderboard popup
function triggerLeaderboardAndNextRound(targetWinnerInfo = null) {
  if (autoNextTimer) clearTimeout(autoNextTimer);

  const active = gameRegistry.getActiveGame();
  const payload = {
    roundWinners: active?.roundWinners || [],
    leaderboard: active?.getLeaderboard ? active.getLeaderboard(5) : [],
    durationMs: LEADERBOARD_POPUP_MS,
    target: targetWinnerInfo?.target || active?.target || active?.allyAnswer || ""
  };

  io.emit("showLeaderboardPopup", payload);
  io.of("/admin").emit("showLeaderboardPopup", payload);

  autoNextTimer = setTimeout(() => {
    gameRegistry.handleGameAction(null, "newRound");
    broadcastState();
    io.emit("roundStarted", gameRegistry.getPublicPayload());
    io.of("/admin").emit("roundStarted", gameRegistry.getAdminPayload());
  }, LEADERBOARD_POPUP_MS);
}

// Timer tick loop
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const result = gameRegistry.tickActiveGame();
    if (result.changed) {
      if (result.timeExpired) {
        const active = gameRegistry.getActiveGame();
        const target = result.target || active?.target || active?.allyAnswer || "";

        io.emit("timeExpired", {
          target,
          hadWinners: result.hadWinners,
          roundWinners: result.roundWinners
        });
        io.of("/admin").emit("timeExpired", {
          target,
          hadWinners: result.hadWinners,
          roundWinners: result.roundWinners
        });

        if (result.hadWinners) {
          triggerLeaderboardAndNextRound({ target });
        } else {
          if (autoNextTimer) clearTimeout(autoNextTimer);
          autoNextTimer = setTimeout(() => {
            gameRegistry.handleGameAction(null, "newRound");
            broadcastState();
            io.emit("roundStarted", gameRegistry.getPublicPayload());
            io.of("/admin").emit("roundStarted", gameRegistry.getAdminPayload());
          }, 4000);
        }
      }
      broadcastState();
    }
  }, 1000);
}

// Handle an incoming viewer guess
function handleIncomingGuess(username, nickname, text, avatar = null) {
  const result = gameRegistry.processGuess(username, nickname, text, avatar);
  if (!result.valid) return;

  // Broadcast guess to admin feed
  io.of("/admin").emit("chatGuess", result.guessItem);

  if (result.isCorrect) {
    console.log(`[Game: ${gameRegistry.getActiveGameId()}] Winner #${result.place} found it: @${result.winner.nickname} (${result.winner.code})!`);

    const winPayload = {
      gameId: gameRegistry.getActiveGameId(),
      winner: result.winner,
      place: result.place,
      points: result.points,
      target: result.winner.code,
      streak: result.newStreak,
      levelUp: result.levelUp,
      statusMessage: gameRegistry.getActiveGame()?.statusMessage || "",
      roundWinners: result.roundWinners
    };

    io.emit("winnerFound", winPayload);
    io.of("/admin").emit("winnerFound", winPayload);

    broadcastState();

    if (result.roundComplete) {
      triggerLeaderboardAndNextRound({ target: result.winner.code });
    }
  } else {
    io.emit("guessAttempt", {
      code: result.guessItem?.code || text,
      user: result.guessItem?.nickname || nickname || username
    });
  }
}

// Bootstrap TikFinity connection
function initTikFinity(url) {
  if (tikfinityClient) {
    tikfinityClient.close();
    tikfinityClient = null;
  }
  const targetUrl = url || currentWsUrl;
  if (!targetUrl) return;

  currentWsUrl = targetUrl;
  updateEnvFile("TIKFINITY_WS_URL", targetUrl);
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
      io.emit("tikfinityConnectionStatus", connected);
      io.of("/admin").emit("tikfinityConnectionStatus", connected);
    }
  });
}

function disconnectTikFinity() {
  updateEnvFile("TIKFINITY_WS_URL", "");
  currentWsUrl = "";

  if (tikfinityClient) {
    tikfinityClient.close();
    tikfinityClient = null;
  }

  tikfinityConnected = false;
  io.emit("tikfinityConnectionStatus", false);
  io.of("/admin").emit("tikfinityConnectionStatus", false);
  broadcastState();
  console.log("[TikFinity] Disconnected by user.");
}

// Bootstrap Direct TikTok Live connection
function startTikTokConnection(username) {
  const targetUsername = String(username || tiktokLiveUsername || "").replace(/^@/, "").trim();
  if (!targetUsername) return;

  if (tiktokLiveClient) {
    tiktokLiveClient.disconnect();
    tiktokLiveClient = null;
  }

  tiktokLiveUsername = targetUsername;
  tiktokLiveStatus = {
    connected: false,
    connecting: true,
    nickname: "",
    avatar: "",
    username: targetUsername
  };

  io.emit("tiktokConnectionStatus", tiktokLiveStatus);
  io.of("/admin").emit("tiktokConnectionStatus", tiktokLiveStatus);
  broadcastState();

  console.log(`[TikTok] Connecting directly to @${targetUsername}...`);

  tiktokLiveClient = connectTikTokLive({
    username: targetUsername,
    onChat: ({ username, nickname, text, avatar }) => {
      handleIncomingGuess(username, nickname, text, avatar);
    },
    onLog: (msg) => {
      console.log(`[TikTok] ${msg}`);
      io.of("/admin").emit("tiktokLog", msg);
    },
    onStatusChange: (status) => {
      tiktokLiveStatus = {
        connected: !!status.connected,
        connecting: !!status.connecting,
        nickname: status.nickname || "",
        avatar: status.avatar || "",
        username: status.username || targetUsername
      };
      io.emit("tiktokConnectionStatus", tiktokLiveStatus);
      io.of("/admin").emit("tiktokConnectionStatus", tiktokLiveStatus);
      broadcastState();
    }
  });
}

function disconnectTikTok() {
  updateEnvFile("TIKTOK_USERNAME", "");
  tiktokLiveUsername = "";

  if (tiktokLiveClient) {
    tiktokLiveClient.disconnect();
    tiktokLiveClient = null;
  }

  tiktokLiveStatus = {
    connected: false,
    connecting: false,
    nickname: "",
    avatar: "",
    username: ""
  };

  io.emit("tiktokConnectionStatus", tiktokLiveStatus);
  io.of("/admin").emit("tiktokConnectionStatus", tiktokLiveStatus);
  broadcastState();
}

// REST Endpoints
app.get("/api/state", (_req, res) => {
  res.json({
    ...gameRegistry.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar
  });
});

app.post("/api/switch-game", (req, res) => {
  const { gameId } = req.body || {};
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  const switched = gameRegistry.setActiveGame(gameId);
  if (switched) {
    broadcastState();
    io.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    io.of("/admin").emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    return res.json({ ok: true, activeGameId: gameId });
  }
  return res.status(404).json({ error: "Game not found" });
});

app.post("/api/game-action", (req, res) => {
  const { gameId, action, options } = req.body || {};
  const updated = gameRegistry.handleGameAction(gameId, action, options);
  broadcastState();
  res.json({ ok: true, state: updated });
});

app.post("/api/simulate", (req, res) => {
  const { user = "Viewer", nickname, guess, avatar } = req.body || {};
  if (!guess) return res.status(400).json({ error: "Missing guess comment" });
  handleIncomingGuess(user, nickname || user, guess, avatar || null);
  res.json({ ok: true, state: gameRegistry.getPublicPayload() });
});

// Admin REST endpoints for TikTok & TikFinity
app.post("/admin/connect-tiktok", (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: "Missing username" });

  const cleanUser = String(username).replace(/^@/, "").trim();
  updateEnvFile("TIKTOK_USERNAME", cleanUser);
  startTikTokConnection(cleanUser);
  res.json({ ok: true, username: cleanUser });
});

app.post("/admin/disconnect-tiktok", (_req, res) => {
  disconnectTikTok();
  res.json({ ok: true });
});

app.get("/admin/get-tiktok-avatar", async (req, res) => {
  const username = req.query.username;
  if (!username) return res.json({ avatar: "" });
  const avatar = await fetchTikTokAvatar(username);
  res.json({ avatar });
});

app.post("/admin/connect-tikfinity", (req, res) => {
  const { url, port } = req.body || {};
  let targetUrl = url;
  if (port) targetUrl = `ws://localhost:${port}/`;
  if (!targetUrl) targetUrl = "ws://localhost:21213/";
  initTikFinity(targetUrl);
  res.json({ ok: true, url: targetUrl });
});

app.post("/admin/disconnect-tikfinity", (_req, res) => {
  disconnectTikFinity();
  res.json({ ok: true });
});

// Universal Overlay Route (dynamic game loading)
app.get("/overlay", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay.html"));
});

// Admin Overlay Route (Live Overlay Viewport + Control Side Panel)
app.get(["/admin-overlay", "/admin-overlay.html", "/host-overlay"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-overlay.html"));
});

// Admin / Dashboard alias
app.get(["/admin", "/admin.html"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Socket.IO: Public / Overlay Namespace
io.on("connection", (socket) => {
  socket.emit("gameState", {
    ...gameRegistry.getPublicPayload(),
    tikfinityConnected,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar
  });

  socket.on("manualGuess", (code) => {
    if (code) handleIncomingGuess("Host", "Host", code);
  });

  socket.on("gameAction", ({ gameId, action, options }) => {
    gameRegistry.handleGameAction(gameId, action, options);
    broadcastState();
  });
});

// Socket.IO: Admin Namespace
const adminNSP = io.of("/admin");
adminNSP.on("connection", (socket) => {
  console.log("[Admin] Host connected to Stream Hub");
  socket.emit("gameState", {
    ...gameRegistry.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar
  });

  socket.on("switchGame", ({ gameId }) => {
    if (gameRegistry.setActiveGame(gameId)) {
      broadcastState();
      io.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
      adminNSP.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    }
  });

  socket.on("gameAction", ({ gameId, action, options }) => {
    gameRegistry.handleGameAction(gameId, action, options);
    broadcastState();
  });

  socket.on("simulateGuess", ({ username, nickname, message, avatar }) => {
    handleIncomingGuess(username || "TestViewer", nickname || username || "TestViewer", message, avatar || null);
  });

  socket.on("connectTikTok", ({ username }) => {
    if (username) {
      const cleanUser = String(username).replace(/^@/, "").trim();
      updateEnvFile("TIKTOK_USERNAME", cleanUser);
      startTikTokConnection(cleanUser);
    }
  });

  socket.on("disconnectTikTok", () => {
    disconnectTikTok();
  });

  socket.on("connectTikfinity", ({ url, port }) => {
    let targetUrl = url;
    if (port) targetUrl = `ws://localhost:${port}/`;
    if (!targetUrl) targetUrl = "ws://localhost:21213/";
    initTikFinity(targetUrl);
  });

  socket.on("disconnectTikfinity", () => {
    disconnectTikFinity();
  });
});

// Start timer loop and initial connections
startTimerLoop();

// Note: TikFinity does NOT auto-connect on boot. Connect via the Dashboard button when needed.

if (tiktokLiveUsername) {
  startTikTokConnection(tiktokLiveUsername);
}

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`  🌟 ALLY'S STREAM HUB IS RUNNING (Port ${PORT})`);
  console.log(`=============================================================`);
  console.log(`  🎮 Hub Dashboard   : http://localhost:${PORT}/`);
  console.log(`  📺 Universal Overlay: http://localhost:${PORT}/overlay`);
  console.log(`  🧩 Odd One Out     : http://localhost:${PORT}/games/odd-one-out/overlay.html`);
  console.log(`  💡 Think Like Ally : http://localhost:${PORT}/games/think-like-ally/overlay.html`);
  console.log(`  💜 Think & Link    : http://localhost:${PORT}/games/think-and-link/overlay.html`);
  if (tiktokLiveUsername) {
    console.log(`  🎯 TikTok Live     : @${tiktokLiveUsername}`);
  }
  console.log(`=============================================================\n`);
});
