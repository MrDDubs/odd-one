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

// Speech Messages persistence
const speechMessagesPath = path.join(__dirname, "data", "speech-messages.json");

function getSpeechMessages() {
  try {
    if (fs.existsSync(speechMessagesPath)) {
      const data = fs.readFileSync(speechMessagesPath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[SpeechMessages] Error reading speech messages:", err);
  }
  return {
    cycleSeconds: 8,
    messages: [
      { id: "msg-1", text: "Welcome to the show! 💜" },
      { id: "msg-2", text: "Type your answer in the chat to win!" },
      { id: "msg-3", text: "Tap the screen & share the LIVE! ✨" },
      { id: "msg-4", text: "Can you take the #1 spot on the leaderboard? 👑" }
    ]
  };
}

function saveSpeechMessages(payload) {
  try {
    const dataDir = path.dirname(speechMessagesPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(speechMessagesPath, JSON.stringify(payload, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[SpeechMessages] Error saving speech messages:", err);
    return false;
  }
}

function broadcastSpeechMessages(payload) {
  io.emit("speechMessagesUpdated", payload);
  io.of("/admin").emit("speechMessagesUpdated", payload);
}

// Broadcast Hub state to overlays and dashboard
function broadcastState() {
  const speechMessages = getSpeechMessages();
  const publicData = {
    ...gameRegistry.getPublicPayload(),
    tikfinityConnected,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar,
    speechMessages
  };

  const adminData = {
    ...gameRegistry.getAdminPayload(),
    tikfinityConnected,
    tikfinityWsUrl: currentWsUrl,
    tiktokConnected: tiktokLiveStatus.connected,
    tiktokConnecting: tiktokLiveStatus.connecting,
    tiktokLiveUsername: tiktokLiveStatus.username || tiktokLiveUsername,
    tiktokLiveStreamerName: tiktokLiveStatus.nickname,
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar,
    speechMessages
  };

  io.emit("gameState", publicData);
  io.of("/admin").emit("gameState", adminData);
}

// Auto-advance round with leaderboard popup
function triggerLeaderboardAndNextRound(targetWinnerInfo = null, delayBeforePopupMs = 0) {
  if (autoNextTimer) clearTimeout(autoNextTimer);

  const active = gameRegistry.getActiveGame();
  const activeId = gameRegistry.getActiveGameId();
  // In Think & Link, give viewers and host 2 seconds to inspect all 6 words before the popup covers the board
  const delayMs = delayBeforePopupMs || (activeId === "think-and-link" ? 2000 : 0);

  const showPopup = () => {
    const payload = {
      roundWinners: active?.roundWinners || [],
      leaderboard: active?.getLeaderboard ? active.getLeaderboard(5) : [],
      durationMs: LEADERBOARD_POPUP_MS,
      target: targetWinnerInfo?.target || active?.target || active?.allyAnswer || active?.topic || ""
    };

    io.emit("showLeaderboardPopup", payload);
    io.of("/admin").emit("showLeaderboardPopup", payload);

    autoNextTimer = setTimeout(() => {
      gameRegistry.handleGameAction(null, "newRound");
      broadcastState();
      io.emit("roundStarted", gameRegistry.getPublicPayload());
      io.of("/admin").emit("roundStarted", gameRegistry.getAdminPayload());
    }, LEADERBOARD_POPUP_MS);
  };

  if (delayMs > 0) {
    autoNextTimer = setTimeout(showPopup, delayMs);
  } else {
    showPopup();
  }
}

// Timer tick loop
function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const result = gameRegistry.tickActiveGame();
    if (result.changed) {
      if (result.timeExpired) {
        const active = gameRegistry.getActiveGame();
        const target = result.target || active?.target || active?.allyAnswer || active?.topic || "";

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

        // Broadcast final state with revealed words first
        broadcastState();

        triggerLeaderboardAndNextRound({ target });
        return;
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

// Speech messages REST endpoints
app.get("/api/speech-messages", (_req, res) => {
  res.json({ ok: true, ...getSpeechMessages() });
});

app.post("/api/speech-messages", (req, res) => {
  const { messages, cycleSeconds } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ ok: false, error: "messages must be an array" });
  }
  const payload = {
    cycleSeconds: typeof cycleSeconds === "number" && cycleSeconds > 0 ? cycleSeconds : 8,
    messages: messages.map((m, idx) => ({
      id: m.id || `msg-${Date.now()}-${idx}`,
      text: String(m.text || "").trim()
    })).filter(m => m.text.length > 0)
  };
  saveSpeechMessages(payload);
  broadcastSpeechMessages(payload);
  res.json({ ok: true, ...payload });
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

// Standalone Leaderboard Overlay Route (Dedicated OBS Browser Source)
app.get(["/leaderboard", "/leaderboard.html"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "leaderboard.html"));
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
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar,
    speechMessages: getSpeechMessages()
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
    tiktokLiveStreamerAvatar: tiktokLiveStatus.avatar,
    speechMessages: getSpeechMessages()
  });

  socket.on("updateSpeechMessages", (payload) => {
    if (payload && Array.isArray(payload.messages)) {
      const cleanPayload = {
        cycleSeconds: typeof payload.cycleSeconds === "number" && payload.cycleSeconds > 0 ? payload.cycleSeconds : 8,
        messages: payload.messages.map((m, idx) => ({
          id: m.id || `msg-${Date.now()}-${idx}`,
          text: String(m.text || "").trim()
        })).filter((m) => m.text.length > 0)
      };
      saveSpeechMessages(cleanPayload);
      broadcastSpeechMessages(cleanPayload);
    }
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

  socket.on("toggleInGameLeaderboard", ({ hide }) => {
    io.emit("toggleInGameLeaderboard", { hide: !!hide });
    adminNSP.emit("toggleInGameLeaderboard", { hide: !!hide });
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
  console.log(`  🏆 Leaderboard Overlay: http://localhost:${PORT}/leaderboard`);
  console.log(`  🧩 Odd One Out     : http://localhost:${PORT}/games/odd-one-out/overlay.html`);
  console.log(`  💡 Think Like Ally : http://localhost:${PORT}/games/think-like-ally/overlay.html`);
  console.log(`  💜 Think & Link    : http://localhost:${PORT}/games/think-and-link/overlay.html`);
  if (tiktokLiveUsername) {
    console.log(`  🎯 TikTok Live     : @${tiktokLiveUsername}`);
  }
  console.log(`=============================================================\n`);
});
