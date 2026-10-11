// server.js (ESM) - Ally's Stream Hub
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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

// Stream Hub Authentication Helpers
function getExpectedPassword() {
  return process.env.SITE_PASSWORD || process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || "admin123";
}

function generateAuthToken(password) {
  return crypto.createHash("sha256").update(String(password).trim() + "_ally_salt_2026").digest("hex");
}

function isValidAuthToken(token) {
  if (!token) return false;
  const expected = generateAuthToken(getExpectedPassword());
  return String(token).trim() === expected;
}

function getRequestAuthToken(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(^|;\s*)ally_auth=([^;]*)/);
  const cookieToken = match ? decodeURIComponent(match[2]) : null;
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const queryKey = req.query.key || req.query.auth || req.query.password;
  const queryToken = queryKey ? generateAuthToken(queryKey) : null;
  return req.body?.token || cookieToken || bearerToken || queryToken;
}

// Auto-inject Auth Guard scripts and styles into all HTML page responses
const originalSendFile = express.response.sendFile;
express.response.sendFile = function (filePath, ...args) {
  if (typeof filePath === "string" && filePath.endsWith(".html")) {
    try {
      let html = fs.readFileSync(filePath, "utf8");
      if (!html.includes("auth-guard.js")) {
        const injection = `\n<link rel="stylesheet" href="/auth-guard.css?v=7">\n<script src="/auth-guard.js?v=7"></script>\n`;
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${injection}</head>`);
        } else if (html.includes("</body>")) {
          html = html.replace("</body>", `${injection}</body>`);
        } else {
          html = injection + html;
        }
      }
      return this.type("html").send(html);
    } catch (e) {}
  }
  return originalSendFile.call(this, filePath, ...args);
};

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Never cache auth-guard assets to guarantee clients receive latest authentication logic
app.get(["/auth-guard.js", "/auth-guard.css"], (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  next();
});

// Explicit route for root index to ensure sendFile injection runs
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Intercept direct .html static files to ensure auth injection applies to minigame overlays
app.get(/\.html$/, (req, res, next) => {
  let targetPath = path.join(__dirname, "public", req.path);
  if (req.path.startsWith("/games/")) {
    targetPath = path.join(__dirname, req.path);
  }
  if (fs.existsSync(targetPath)) {
    return res.sendFile(targetPath);
  }
  next();
});

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

// Audio Settings persistence
const audioSettingsPath = path.join(__dirname, "data", "audio-settings.json");

function getAudioSettings() {
  try {
    if (fs.existsSync(audioSettingsPath)) {
      const data = fs.readFileSync(audioSettingsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[AudioSettings] Error reading audio settings:", err);
  }
  return { volume: 100, muted: false };
}

function saveAudioSettings(settings) {
  try {
    const dataDir = path.dirname(audioSettingsPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(audioSettingsPath, JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[AudioSettings] Error saving audio settings:", err);
    return false;
  }
}

let currentAudioSettings = getAudioSettings();

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
    speechMessages,
    audioSettings: currentAudioSettings
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
    speechMessages,
    audioSettings: currentAudioSettings
  };

  io.emit("gameState", publicData);
  io.of("/admin").emit("gameState", adminData);
}

// Auto-advance round with leaderboard popup
function triggerLeaderboardAndNextRound(targetWinnerInfo = null, delayBeforePopupMs = 0) {
  if (autoNextTimer) clearTimeout(autoNextTimer);

  const active = gameRegistry.getActiveGame();
  const activeId = gameRegistry.getActiveGameId();
  // Standard reveal delay: 2.2 seconds across all games before the popup covers the board
  // This ensures the game board itself displays the revealed answer on screen before "This Round's Points" pops up!
  const delayMs = delayBeforePopupMs || 2200;

  const showPopup = () => {
    const payload = {
      roundWinners: active?.roundWinners || active?.winners || [],
      leaderboard: active?.getLeaderboard ? active.getLeaderboard(10) : [],
      durationMs: LEADERBOARD_POPUP_MS
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
        const target = result.target || active?.target || active?.allyAnswer || active?.topic || active?.answer || active?.word || "";

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
    const oldClient = tiktokLiveClient;
    tiktokLiveClient = null;
    try {
      oldClient.disconnect();
    } catch {}
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

  const currentClient = connectTikTokLive({
    username: targetUsername,
    onChat: ({ username, nickname, text, avatar }) => {
      if (tiktokLiveClient !== currentClient) return;
      handleIncomingGuess(username, nickname, text, avatar);
    },
    onLog: (msg) => {
      console.log(`[TikTok] ${msg}`);
      io.of("/admin").emit("tiktokLog", msg);
    },
    onStatusChange: (status) => {
      if (tiktokLiveClient !== currentClient) return;
      tiktokLiveStatus = {
        connected: !!status.connected,
        connecting: !!status.connecting,
        nickname: status.nickname || "",
        avatar: status.avatar || "",
        username: status.connected ? (status.username || targetUsername) : (tiktokLiveUsername || targetUsername)
      };
      io.emit("tiktokConnectionStatus", tiktokLiveStatus);
      io.of("/admin").emit("tiktokConnectionStatus", tiktokLiveStatus);
      broadcastState();
    }
  });

  tiktokLiveClient = currentClient;
}

function disconnectTikTok() {
  updateEnvFile("TIKTOK_USERNAME", "");
  tiktokLiveUsername = "";

  if (tiktokLiveClient) {
    const oldClient = tiktokLiveClient;
    tiktokLiveClient = null;
    try {
      oldClient.disconnect();
    } catch {}
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
  console.log("[TikTok] Disconnected by user.");
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

// Authentication API Routes
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  const expected = getExpectedPassword();
  if (password && String(password).trim() === String(expected).trim()) {
    const token = generateAuthToken(expected);
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    const secureFlag = isHttps ? "; Secure" : "";
    res.setHeader("Set-Cookie", `ally_auth=${encodeURIComponent(token)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${secureFlag}`);
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ ok: false, error: "Incorrect password" });
});

app.all("/api/auth/verify", (req, res) => {
  const token = getRequestAuthToken(req);
  if (isValidAuthToken(token)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "ally_auth=; Path=/; Max-Age=0; SameSite=Lax");
  res.json({ ok: true });
});

app.post("/api/switch-game", (req, res) => {
  const { gameId } = req.body || {};
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  const switched = gameRegistry.setActiveGame(gameId);
  if (switched) {
    // Automatically start a fresh round on switch
    gameRegistry.handleGameAction(gameId, "startRound");
    broadcastState();
    io.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    io.of("/admin").emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    return res.json({ ok: true, activeGameId: gameId });
  }
  return res.status(404).json({ error: "Game not found" });
});

app.post("/api/game-action", (req, res) => {
  const { gameId, action, options } = req.body || {};
  const updated = executeGameAction(gameId, action, options);
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

// Mobile Stream Layout Route
app.get(["/mobile", "/mobile.html"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "mobile.html"));
});

// Admin Overlay Route (Live Overlay Viewport + Control Side Panel)
app.get(["/admin-overlay", "/admin-overlay.html", "/host-overlay"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-overlay.html"));
});

// Admin / Dashboard alias
app.get(["/admin", "/admin/", "/admin.html"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Socket.IO Namespaces
const adminNSP = io.of("/admin");

function executeGameAction(gameId, action, options) {
  const result = gameRegistry.handleGameAction(gameId, action, options);
  broadcastState();

  if (action === "startRound" || action === "newRound" || action === "nextRound" || action === "prevRound" || action === "previousRound") {
    io.emit("roundStarted", gameRegistry.getPublicPayload());
    adminNSP.emit("roundStarted", gameRegistry.getAdminPayload());
  }
  return result;
}

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
    speechMessages: getSpeechMessages(),
    audioSettings: currentAudioSettings
  });
  socket.emit("audioSettings", currentAudioSettings);

  socket.on("manualGuess", (code) => {
    if (code) handleIncomingGuess("Host", "Host", code);
  });

  socket.on("gameAction", ({ gameId, action, options }) => {
    executeGameAction(gameId, action, options);
  });

  // Direct socket event listeners for maximum resilience
  socket.on("startRound", (options) => executeGameAction(null, "startRound", options));
  socket.on("newRound", (options) => executeGameAction(null, "newRound", options));
  socket.on("nextRound", (options) => executeGameAction(null, "nextRound", options));
  socket.on("prevRound", (options) => executeGameAction(null, "prevRound", options));
  socket.on("reveal", () => executeGameAction(null, "reveal"));
  socket.on("togglePause", () => executeGameAction(null, "togglePause"));
  socket.on("setTime", (options) => executeGameAction(null, "setTime", options));
  socket.on("adjustTime", (options) => executeGameAction(null, "adjustTime", options));

  socket.on("setAudioSettings", ({ volume, muted }) => {
    if (typeof volume === "number") currentAudioSettings.volume = Math.max(0, Math.min(100, Math.round(volume)));
    if (typeof muted === "boolean") currentAudioSettings.muted = !!muted;
    saveAudioSettings(currentAudioSettings);
    io.emit("audioSettings", currentAudioSettings);
    adminNSP.emit("audioSettings", currentAudioSettings);
  });
});

// Socket.IO: Admin Namespace
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
    speechMessages: getSpeechMessages(),
    audioSettings: currentAudioSettings
  });
  socket.emit("audioSettings", currentAudioSettings);

  socket.on("setAudioSettings", ({ volume, muted }) => {
    if (typeof volume === "number") currentAudioSettings.volume = Math.max(0, Math.min(100, Math.round(volume)));
    if (typeof muted === "boolean") currentAudioSettings.muted = !!muted;
    saveAudioSettings(currentAudioSettings);
    io.emit("audioSettings", currentAudioSettings);
    adminNSP.emit("audioSettings", currentAudioSettings);
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
      executeGameAction(gameId, "startRound");
      io.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
      adminNSP.emit("gameSwitched", { gameId, def: gameRegistry.getActiveGameDefinition() });
    }
  });

  socket.on("gameAction", ({ gameId, action, options }) => {
    executeGameAction(gameId, action, options);
  });

  socket.on("startRound", (options) => executeGameAction(null, "startRound", options));
  socket.on("newRound", (options) => executeGameAction(null, "newRound", options));
  socket.on("nextRound", (options) => executeGameAction(null, "nextRound", options));
  socket.on("prevRound", (options) => executeGameAction(null, "prevRound", options));
  socket.on("reveal", () => executeGameAction(null, "reveal"));
  socket.on("togglePause", () => executeGameAction(null, "togglePause"));
  socket.on("setTime", (options) => executeGameAction(null, "setTime", options));
  socket.on("adjustTime", (options) => executeGameAction(null, "adjustTime", options));

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
  console.log(`  🔍 Word Finder     : http://localhost:${PORT}/games/word-finder/overlay.html`);
  console.log(`  ⚔️ Ally's Chat Feud : http://localhost:${PORT}/games/crowd-says/overlay.html`);
  console.log(`  🔤 Ally's Unscramble: http://localhost:${PORT}/games/unscramble/overlay.html`);
  console.log(`  🎭 Ally's Rebus     : http://localhost:${PORT}/games/rebus/overlay.html`);
  console.log(`  🧙‍♂️ Ally's Riddles   : http://localhost:${PORT}/games/riddle/overlay.html`);
  if (tiktokLiveUsername) {
    console.log(`  🎯 TikTok Live     : @${tiktokLiveUsername}`);
  }
  console.log(`=============================================================\n`);
});
