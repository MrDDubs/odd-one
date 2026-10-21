// public/hub.js - Ally's Stream Hub — Sunflower Studio Cockpit (ESM)
const socket = io("/admin");

// --------------------------------------------------------------------------
// DOM Elements
// --------------------------------------------------------------------------
// Header & Badges
const badgeTikTok = document.getElementById("badgeTikTok");
const dotTikTok = document.getElementById("dotTikTok");
const textTikTok = document.getElementById("textTikTok");
const avatarTikTokMini = document.getElementById("avatarTikTokMini");
const badgeActiveGame = document.getElementById("badgeActiveGame");
const badgeActiveGameIcon = document.getElementById("badgeActiveGameIcon");
const badgeActiveGameText = document.getElementById("badgeActiveGameText");

// TikTok Connection Toolbar
const inputTikTokUser = document.getElementById("inputTikTokUser");
const btnConnectTikTok = document.getElementById("btnConnectTikTok");
const btnDisconnectTikTok = document.getElementById("btnDisconnectTikTok");

// Header Quick Actions
const btnCopyUniversalUrl = document.getElementById("btnCopyUniversalUrl");
const btnInstallPwa = document.getElementById("btnInstallPwa");

// Viewport & Phone Mockup
const btnVpPhone = document.getElementById("btnVpPhone");
const btnVpFit = document.getElementById("btnVpFit");
const btnReloadFrame = document.getElementById("btnReloadFrame");
const phoneMockup = document.getElementById("phoneMockup");
const liveOverlayIframe = document.getElementById("liveOverlayIframe");
const obsUrlCode = document.getElementById("obsUrlCode");
const btnCopyObsCode = document.getElementById("btnCopyObsCode");

// 1-Click Game Switcher
const gameButtonsGrid = document.getElementById("gameButtonsGrid");
const gameCuteButtons = document.querySelectorAll(".game-cute-btn");

// Cheat Sheet
const cheatSecretAnswer = document.getElementById("cheatSecretAnswer");
const cheatCategory = document.getElementById("cheatCategory");
const cheatLevel = document.getElementById("cheatLevel");
const cheatTimer = document.getElementById("cheatTimer");

// Round Action Buttons
const btnStartRound = document.getElementById("btnStartRound");
const btnNextRound = document.getElementById("btnNextRound");
const btnReveal = document.getElementById("btnReveal");
const btnTogglePause = document.getElementById("btnTogglePause");
const btnResetRound = document.getElementById("btnResetRound");

// Comprehensive Time Controls
const tagLiveDuration = document.getElementById("tagLiveDuration");
const timeDeltaButtons = document.querySelectorAll(".btn-time-delta");
const timePresetButtons = document.querySelectorAll(".btn-time-preset");
const inputCustomDuration = document.getElementById("inputCustomDuration");
const btnApplyCustomTime = document.getElementById("btnApplyCustomTime");

// Master Audio & Volume Controls
const btnMuteAudio = document.getElementById("btnMuteAudio");
const muteBtnIcon = document.getElementById("muteBtnIcon");
const muteBtnText = document.getElementById("muteBtnText");
const sliderVolume = document.getElementById("sliderVolume");
const volumePercentText = document.getElementById("volumePercentText");
const volChips = document.querySelectorAll(".vol-chip");

// Live Feed & Leaderboard Reset
const guessFeed = document.getElementById("guessFeed");
const btnClearFeed = document.getElementById("btnClearFeed");
const btnResetLeaderboard = document.getElementById("btnResetLeaderboard");
const toast = document.getElementById("toast");

// --------------------------------------------------------------------------
// Application State
// --------------------------------------------------------------------------
let currentActiveGameId = "odd-one-out";
let currentGameState = null;
let currentVolume = 100;
let currentMuted = false;
let isPaused = false;
let lastTikTokStatus = { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

// Game Meta Display Map
const GAME_META = {
  "odd-one-out": { name: "Odd One Out", icon: "🧩" },
  "think-like-ally": { name: "Think Like Ally", icon: "💡" },
  "think-and-link": { name: "Think & Link", icon: "💜" },
  "word-finder": { name: "Word Finder", icon: "🔍" },
  "crowd-says": { name: "Chat Feud", icon: "⚔️" },
  "unscramble": { name: "Unscramble", icon: "🔤" },
  "rebus": { name: "Ally's Rebus", icon: "🎭" },
  "riddle": { name: "Ally's Riddles", icon: "🧙‍♂️" }
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

let toastTimer = null;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function sendGameAction(action, options = {}) {
  socket.emit("gameAction", {
    gameId: currentActiveGameId,
    action,
    options
  });
}

// --------------------------------------------------------------------------
// Viewport & Scale Controls
// --------------------------------------------------------------------------
btnVpPhone?.addEventListener("click", () => {
  btnVpPhone.classList.add("active");
  btnVpFit?.classList.remove("active");
  phoneMockup?.classList.remove("mode-fit");
});

btnVpFit?.addEventListener("click", () => {
  btnVpFit.classList.add("active");
  btnVpPhone?.classList.remove("active");
  phoneMockup?.classList.add("mode-fit");
});

btnReloadFrame?.addEventListener("click", () => {
  if (liveOverlayIframe) {
    const currentSrc = liveOverlayIframe.src;
    liveOverlayIframe.src = "about:blank";
    setTimeout(() => { liveOverlayIframe.src = currentSrc; }, 80);
    showToast("🔄 Reloaded Stream Viewport");
  }
});

function copyToClipboard(text, successMsg = "📋 Copied URL to clipboard!") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg);
  }).catch(() => {
    showToast(`URL: ${text}`);
  });
}

btnCopyUniversalUrl?.addEventListener("click", () => {
  const url = `${window.location.origin}/overlay`;
  copyToClipboard(url, "📺 Universal Overlay URL Copied!");
});

btnCopyObsCode?.addEventListener("click", () => {
  const url = obsUrlCode?.textContent || `${window.location.origin}/overlay`;
  copyToClipboard(url, "📺 Universal Overlay URL Copied!");
});

// Update displayed OBS code with origin
if (obsUrlCode) {
  obsUrlCode.textContent = `${window.location.origin}/overlay`;
}

// --------------------------------------------------------------------------
// 1-Click Game Switcher
// --------------------------------------------------------------------------
gameCuteButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const gameId = btn.getAttribute("data-game");
    if (!gameId) return;

    gameCuteButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentActiveGameId = gameId;
    updateActiveGameBadge(gameId);

    socket.emit("switchGame", { gameId });
    showToast(`🕹️ Switched Game: ${GAME_META[gameId]?.name || gameId}`);
  });
});

function updateActiveGameBadge(gameId) {
  const meta = GAME_META[gameId] || { name: gameId, icon: "🎮" };
  if (badgeActiveGameIcon) badgeActiveGameIcon.textContent = meta.icon;
  if (badgeActiveGameText) badgeActiveGameText.textContent = meta.name;

  gameCuteButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-game") === gameId);
  });
}

// --------------------------------------------------------------------------
// Host Cheat Sheet & State Render
// --------------------------------------------------------------------------
function updateHostCheatSheet(data) {
  if (!data) return;

  const gameId = data.gameId || currentActiveGameId;

  if (gameId === "odd-one-out") {
    cheatSecretAnswer.textContent = data.target || data.secretTarget || "--";
    cheatCategory.textContent = (data.category || "FRUIT").toUpperCase();
    cheatLevel.textContent = `LVL ${data.level || 1} (${data.levelName || "MED"})`;
  } else if (gameId === "think-like-ally") {
    cheatSecretAnswer.textContent = data.allyAnswer || data.answer || "--";
    cheatCategory.textContent = `"${data.question || "Trivia"}"`;
    cheatLevel.textContent = data.category || "General";
  } else if (gameId === "think-and-link") {
    const slots = data.secretSlots || data.slots;
    const wordsPreview = Array.isArray(slots) ? slots.map((s) => s.word).filter(Boolean).join(", ") : "--";
    cheatSecretAnswer.textContent = wordsPreview;
    cheatCategory.textContent = `${data.topic || "Topic"} ${data.emoji || "💜"}`;
    cheatLevel.textContent = data.category || "Word Link";
  } else if (gameId === "word-finder") {
    const words = data.secretWords || data.words || [];
    const wordsPreview = words.map((w) => `${w.word} (${w.start} ${w.end})`).join(", ");
    cheatSecretAnswer.textContent = wordsPreview || "--";
    cheatCategory.textContent = `${data.topic || "Word Finder"} ${data.emoji || "🔍"}`;
    cheatLevel.textContent = data.category || "6x6 Grid";
  } else if (gameId === "crowd-says") {
    const slots = data.secretSlots || data.slots || [];
    const answersPreview = slots.map((s) => `#${s.rank} ${s.text} (${s.points}p)`).join(", ");
    cheatSecretAnswer.textContent = answersPreview || "--";
    cheatCategory.textContent = `"${data.question || "Survey"}"`;
    cheatLevel.textContent = data.category || "Chat Feud";
  } else if (gameId === "unscramble") {
    const word = data.secretWord || data.word || "--";
    cheatSecretAnswer.textContent = word.toUpperCase();
    cheatCategory.textContent = `${data.emoji || "🔤"} ${data.topic || "Word"}`;
    cheatLevel.textContent = `${data.length || word.length} Letters`;
  } else if (gameId === "rebus") {
    cheatSecretAnswer.textContent = data.secretAnswer || data.answer || "--";
    cheatCategory.textContent = `${data.emoji || "🎭"} ${data.category || "General"}`;
    cheatLevel.textContent = data.difficulty || "Medium";
  } else if (gameId === "riddle") {
    cheatSecretAnswer.textContent = data.secretAnswer || data.answer || "--";
    cheatCategory.textContent = `${data.emoji || "🧙‍♂️"} ${data.category || "Classic"}`;
    cheatLevel.textContent = data.difficulty || "Medium";
  }

  // Timer Text
  const secondsLeft = data.time !== undefined ? data.time : (data.timerRemaining !== undefined ? data.timerRemaining : 0);
  cheatTimer.textContent = `${secondsLeft}s`;
}

function renderState(data) {
  if (!data) return;
  currentGameState = data;

  if (data.activeGameId && data.activeGameId !== currentActiveGameId) {
    currentActiveGameId = data.activeGameId;
    updateActiveGameBadge(currentActiveGameId);
  }

  // Timer tag & preset active
  const durationSec = data.roundDurationSec || data.customDurationSec || 20;
  if (tagLiveDuration) tagLiveDuration.textContent = `Live: ${data.time !== undefined ? data.time : durationSec}s`;

  timePresetButtons.forEach((btn) => {
    const sec = parseInt(btn.getAttribute("data-sec"), 10);
    btn.classList.toggle("active", sec === durationSec);
  });

  // Pause button state
  isPaused = !!data.paused;
  if (btnTogglePause) {
    if (isPaused) {
      btnTogglePause.textContent = "▶ Resume Timer";
      btnTogglePause.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnTogglePause.style.color = "#fff";
    } else {
      btnTogglePause.textContent = "⏸ Pause Timer";
      btnTogglePause.style.background = "";
      btnTogglePause.style.color = "";
    }
  }

  // Update Cheat Sheet
  updateHostCheatSheet(data);

  // TikTok connection status
  updateTikTokUI({
    connected: !!data.tiktokConnected,
    connecting: !!data.tiktokConnecting,
    username: data.tiktokLiveUsername,
    nickname: data.tiktokLiveStreamerName,
    avatar: data.tiktokLiveStreamerAvatar
  });

  // Audio settings from server
  if (data.audioSettings) {
    if (typeof data.audioSettings.volume === "number") currentVolume = data.audioSettings.volume;
    if (typeof data.audioSettings.muted === "boolean") currentMuted = !!data.audioSettings.muted;
    renderAudioUI(currentVolume, currentMuted);
  }
}

// --------------------------------------------------------------------------
// Round Action Buttons
// --------------------------------------------------------------------------
btnStartRound?.addEventListener("click", () => {
  socket.emit("startRound");
  showToast("▶ Round Started");
});

btnNextRound?.addEventListener("click", () => {
  socket.emit("nextRound");
  showToast("⏭ Generated Next Round");
});

btnReveal?.addEventListener("click", () => {
  socket.emit("reveal");
  showToast("👁 Answer Revealed");
});

btnTogglePause?.addEventListener("click", () => {
  socket.emit("togglePause");
});

btnResetRound?.addEventListener("click", () => {
  if (confirm("Reset current round and timer?")) {
    socket.emit("startRound");
    showToast("🔄 Round Reset");
  }
});

// --------------------------------------------------------------------------
// Comprehensive Time Controls
// --------------------------------------------------------------------------
timeDeltaButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const delta = parseInt(btn.getAttribute("data-delta"), 10);
    if (!isNaN(delta)) {
      socket.emit("adjustTime", { delta });
      showToast(`⏱ Adjusted time: ${delta > 0 ? "+" : ""}${delta}s`);
    }
  });
});

timePresetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const duration = parseInt(btn.getAttribute("data-sec"), 10);
    if (!isNaN(duration)) {
      timePresetButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      socket.emit("setOptions", { duration });
      showToast(`⏱ Duration set to ${duration}s`);
    }
  });
});

btnApplyCustomTime?.addEventListener("click", () => {
  const val = parseInt(inputCustomDuration?.value, 10);
  if (val && val >= 5) {
    socket.emit("setOptions", { duration: val });
    showToast(`⏱ Duration set to ${val}s`);
  } else {
    alert("Please enter a valid time of at least 5 seconds.");
  }
});

// --------------------------------------------------------------------------
// Master Audio & Volume Controls
// --------------------------------------------------------------------------
try {
  const savedVol = localStorage.getItem("ally_stream_volume");
  const savedMuted = localStorage.getItem("ally_stream_muted");
  if (savedVol !== null) currentVolume = parseInt(savedVol, 10);
  if (savedMuted !== null) currentMuted = savedMuted === "true";
} catch (e) {}

function renderAudioUI(vol, muted) {
  if (sliderVolume && document.activeElement !== sliderVolume) {
    sliderVolume.value = vol;
  }

  if (volumePercentText) {
    volumePercentText.textContent = muted ? "MUTED" : `${vol}%`;
    volumePercentText.style.color = muted ? "#f87171" : "var(--sunflower-yellow)";
  }

  if (btnMuteAudio) {
    btnMuteAudio.classList.toggle("is-muted", muted);
    if (muteBtnIcon) muteBtnIcon.textContent = muted ? "🔇" : "🔊";
    if (muteBtnText) muteBtnText.textContent = muted ? "MUTED" : "Sound ON";
  }

  volChips.forEach((chip) => {
    const chipVol = parseInt(chip.getAttribute("data-vol"), 10);
    const isActive = muted ? chipVol === 0 : (!muted && chipVol === vol);
    chip.classList.toggle("active", isActive);
  });
}

function sendAudioUpdate(vol, muted) {
  currentVolume = typeof vol === "number" ? Math.max(0, Math.min(100, Math.round(vol))) : currentVolume;
  currentMuted = typeof muted === "boolean" ? muted : currentMuted;

  try {
    localStorage.setItem("ally_stream_volume", currentVolume);
    localStorage.setItem("ally_stream_muted", currentMuted ? "true" : "false");
  } catch (e) {}

  renderAudioUI(currentVolume, currentMuted);

  socket.emit("setAudioSettings", {
    volume: currentVolume,
    muted: currentMuted
  });
}

renderAudioUI(currentVolume, currentMuted);

sliderVolume?.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  const shouldUnmute = currentMuted && val > 0 ? false : currentMuted;
  sendAudioUpdate(val, shouldUnmute);
});

btnMuteAudio?.addEventListener("click", () => {
  const nextMuted = !currentMuted;
  sendAudioUpdate(currentVolume, nextMuted);
  showToast(nextMuted ? "🔇 Overlay Audio Muted" : "🔊 Overlay Audio Unmuted");
});

volChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const vol = parseInt(chip.getAttribute("data-vol"), 10);
    if (vol === 0) {
      sendAudioUpdate(currentVolume, true);
      showToast("🔇 Audio Muted");
    } else {
      sendAudioUpdate(vol, false);
      showToast(`🔊 Volume set to ${vol}%`);
    }
  });
});

// --------------------------------------------------------------------------
// Live Incoming Chat Guesses Feed
// --------------------------------------------------------------------------
function addGuessToFeed(guessItem) {
  if (!guessFeed) return;

  if (guessFeed.children.length === 1 && guessFeed.children[0].textContent.includes("Waiting")) {
    guessFeed.innerHTML = "";
  }

  const div = document.createElement("div");
  div.className = `feed-row ${guessItem.isCorrect ? "winner" : ""}`;

  const timeStr = new Date(guessItem.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const mark = guessItem.isCorrect ? "✓ WINNER! 🌻" : "• Incorrect";
  const user = esc(guessItem.nickname || guessItem.user || "Viewer");
  const code = esc(guessItem.code || guessItem.message || "");

  div.innerHTML = `
    <div>
      <strong>@${user}</strong>: <span style="font-weight:bold;letter-spacing:0.5px">${code}</span>
      <span style="font-size:10px;opacity:0.85;margin-left:4px">${mark}</span>
    </div>
    <span style="opacity:0.6;font-size:10px">${timeStr}</span>
  `;

  guessFeed.insertBefore(div, guessFeed.firstChild);

  if (guessFeed.children.length > 50) {
    guessFeed.removeChild(guessFeed.lastChild);
  }
}

btnClearFeed?.addEventListener("click", () => {
  if (guessFeed) {
    guessFeed.innerHTML = `<div style="color:var(--fg-muted);text-align:center;padding:20px;font-family:sans-serif">Feed cleared. Waiting for guesses...</div>`;
  }
});

// --------------------------------------------------------------------------
// Reset Leaderboard & Community Streak
// --------------------------------------------------------------------------
btnResetLeaderboard?.addEventListener("click", () => {
  if (confirm("Reset all community leaderboard scores and current win streak to 0?")) {
    socket.emit("resetLeaderboard");
    socket.emit("resetGame");
    showToast("🔄 Leaderboard & Streak Reset Successfully");
  }
});

// --------------------------------------------------------------------------
// TikTok Connection UI & Handlers
// --------------------------------------------------------------------------
function updateTikTokUI(status) {
  lastTikTokStatus = status || { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

  if (lastTikTokStatus.connected) {
    if (badgeTikTok) badgeTikTok.className = "badge-yellow";
    if (dotTikTok) dotTikTok.style.background = "#10b981";
    const displayName = lastTikTokStatus.nickname || `@${lastTikTokStatus.username}` || "Live";
    if (textTikTok) textTikTok.textContent = displayName;

    if (avatarTikTokMini) {
      if (lastTikTokStatus.avatar) {
        avatarTikTokMini.style.display = "inline-flex";
        avatarTikTokMini.innerHTML = `<img src="${esc(lastTikTokStatus.avatar)}" style="width:16px;height:16px;border-radius:50%;margin-right:4px;vertical-align:middle" alt="${esc(displayName)}">`;
      } else {
        avatarTikTokMini.style.display = "none";
      }
    }

    if (btnConnectTikTok) btnConnectTikTok.style.display = "none";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "inline-block";
    if (inputTikTokUser && lastTikTokStatus.username) {
      inputTikTokUser.value = lastTikTokStatus.username;
    }
  } else if (lastTikTokStatus.connecting) {
    if (badgeTikTok) badgeTikTok.className = "badge-sky";
    if (dotTikTok) dotTikTok.style.background = "#f59e0b";
    if (textTikTok) textTikTok.textContent = `Connecting...`;
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";

    if (btnConnectTikTok) btnConnectTikTok.style.display = "none";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "inline-block";
  } else {
    if (badgeTikTok) badgeTikTok.className = "badge-sky";
    if (dotTikTok) dotTikTok.style.background = "#ef4444";
    if (textTikTok) textTikTok.textContent = "Disconnected";
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";

    if (btnConnectTikTok) btnConnectTikTok.style.display = "inline-block";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "none";
  }
}

btnConnectTikTok?.addEventListener("click", async () => {
  const username = (inputTikTokUser?.value || "").trim().replace(/^@/, "");
  if (!username) {
    alert("Please enter your TikTok username (e.g. allystreamer)");
    return;
  }
  showToast(`🔴 Connecting to TikTok @${username}...`);
  try {
    await fetch("/admin/connect-tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
  } catch {
    socket.emit("connectTikTok", { username });
  }
});

btnDisconnectTikTok?.addEventListener("click", async () => {
  showToast("Disconnecting TikTok...");
  try {
    await fetch("/admin/disconnect-tiktok", { method: "POST" });
  } catch {
    socket.emit("disconnectTikTok");
  }
});

// --------------------------------------------------------------------------
// Socket Events
// --------------------------------------------------------------------------
socket.on("connect", () => {
  console.log("[Hub Cockpit] Connected to server");
});

socket.on("gameState", (data) => {
  renderState(data);
});

socket.on("gameSwitched", ({ gameId }) => {
  currentActiveGameId = gameId;
  updateActiveGameBadge(gameId);
  showToast(`Switched active game to: ${GAME_META[gameId]?.name || gameId}`);
});

socket.on("chatGuess", (guessItem) => {
  addGuessToFeed(guessItem);
});

socket.on("winnerFound", (payload) => {
  const medal = payload.place === 1 ? "🥇 1st" : "🥈 2nd";
  showToast(`${medal} Winner: @${payload.winner?.nickname || payload.winner?.user} (+${payload.points} pts)!`);
});

socket.on("timeExpired", (payload) => {
  showToast(`⏰ Time's up! Target was: ${payload.target || ""}`);
});

socket.on("tiktokConnectionStatus", (status) => {
  updateTikTokUI(status);
});

socket.on("audioSettings", (settings) => {
  if (settings) {
    if (typeof settings.volume === "number") currentVolume = settings.volume;
    if (typeof settings.muted === "boolean") currentMuted = !!settings.muted;
    renderAudioUI(currentVolume, currentMuted);
  }
});

// --------------------------------------------------------------------------
// PWA Install Prompt Support
// --------------------------------------------------------------------------
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstallPwa) {
    btnInstallPwa.style.display = "inline-flex";
  }
});

btnInstallPwa?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    btnInstallPwa.style.display = "none";
  }
  deferredPrompt = null;
});
