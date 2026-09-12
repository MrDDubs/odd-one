// public/admin-overlay.js - Live Overlay Viewport & Host Studio Controller
const socket = io("/admin");

// State
let currentGameState = null;
let currentActiveGameId = "odd-one-out";
let isPaused = false;
let toastTimer = null;

// DOM Elements: Header
const badgeTikTok = document.getElementById("badgeTikTok");
const textTikTok = document.getElementById("textTikTok");
const avatarTikTokMini = document.getElementById("avatarTikTokMini");
const inputTikTokUser = document.getElementById("inputTikTokUser");
const btnConnectTikTok = document.getElementById("btnConnectTikTok");
const btnDisconnectTikTok = document.getElementById("btnDisconnectTikTok");

const badgeActiveGame = document.getElementById("badgeActiveGame");
const activeGameIcon = document.getElementById("activeGameIcon");
const activeGameText = document.getElementById("activeGameText");
const badgeRound = document.getElementById("badgeRound");
const badgeStreak = document.getElementById("badgeStreak");
const btnCopyOverlayUrl = document.getElementById("btnCopyOverlayUrl");
const obsUrlDisplay = document.getElementById("obsUrlDisplay");

// DOM Elements: Viewport
const liveOverlayIframe = document.getElementById("liveOverlayIframe");
const phoneFrame = document.getElementById("phoneFrame");
const btnScaleFit = document.getElementById("btnScaleFit");
const btnScale916 = document.getElementById("btnScale916");
const btnScaleFull = document.getElementById("btnScaleFull");
const btnReloadFrame = document.getElementById("btnReloadFrame");

// DOM Elements: Game Switcher
const gameSwitchBtns = document.querySelectorAll(".game-switch-btn");

// DOM Elements: Host Cheat Sheet
const cheatSecretAnswer = document.getElementById("cheatSecretAnswer");
const cheatCategory = document.getElementById("cheatCategory");
const cheatStatus = document.getElementById("cheatStatus");

// DOM Elements: Action Controls
const btnStartRound = document.getElementById("btnStartRound");
const btnNextRound = document.getElementById("btnNextRound");
const btnPrevRound = document.getElementById("btnPrevRound");
const btnTogglePause = document.getElementById("btnTogglePause");
const pauseBtnIcon = document.getElementById("pauseBtnIcon");
const pauseBtnText = document.getElementById("pauseBtnText");
const btnHint = document.getElementById("btnHint");
const btnReveal = document.getElementById("btnReveal");

// DOM Elements: Timer Controls
const liveTimerBadge = document.getElementById("liveTimerBadge");
const inputCustomTime = document.getElementById("inputCustomTime");
const btnSetCustomTime = document.getElementById("btnSetCustomTime");

// DOM Elements: Resets & Simulator
const btnResetLeaderboard = document.getElementById("btnResetLeaderboard");
const btnResetGame = document.getElementById("btnResetGame");
const inputSimulateGuess = document.getElementById("inputSimulateGuess");
const btnSimulateGuess = document.getElementById("btnSimulateGuess");

// DOM Elements: Feed & Toast
const feedList = document.getElementById("feedList");
const btnClearFeed = document.getElementById("btnClearFeed");
const toastNotification = document.getElementById("toastNotification");

// Setup Live Studio URL display
if (obsUrlDisplay) {
  obsUrlDisplay.textContent = `${window.location.origin}/overlay`;
}

// --------------------------------------------------------------------------
// Toast Notifications
// --------------------------------------------------------------------------
function showToast(message, duration = 3000) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastNotification.classList.remove("show");
  }, duration);
}

// --------------------------------------------------------------------------
// Viewport Scaling Modes
// --------------------------------------------------------------------------
btnScaleFit?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame mode-fit";
  setActiveScaleBtn(btnScaleFit);
});

btnScale916?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame";
  setActiveScaleBtn(btnScale916);
});

btnScaleFull?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame mode-wide";
  setActiveScaleBtn(btnScaleFull);
});

function setActiveScaleBtn(activeBtn) {
  [btnScaleFit, btnScale916, btnScaleFull].forEach((b) => b?.classList.remove("active"));
  activeBtn?.classList.add("active");
}

btnReloadFrame?.addEventListener("click", () => {
  if (liveOverlayIframe) {
    liveOverlayIframe.src = liveOverlayIframe.src;
    showToast("🔄 Overlay preview refreshed");
  }
});

btnCopyOverlayUrl?.addEventListener("click", () => {
  const url = `${window.location.origin}/overlay`;
  navigator.clipboard.writeText(url).then(() => {
    showToast("✅ Live Studio Overlay URL copied to clipboard!");
  }).catch(() => {
    prompt("Copy this URL for Live Studio Browser Source:", url);
  });
});

// --------------------------------------------------------------------------
// Game Switcher
// --------------------------------------------------------------------------
gameSwitchBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const gameId = btn.getAttribute("data-game");
    if (!gameId || gameId === currentActiveGameId) return;

    socket.emit("switchGame", { gameId });
    showToast(`🕹️ Switching game to ${btn.querySelector(".game-name")?.textContent || gameId}...`);
  });
});

function updateActiveGameUI(gameId) {
  currentActiveGameId = gameId;

  gameSwitchBtns.forEach((btn) => {
    if (btn.getAttribute("data-game") === gameId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const gameNames = {
    "odd-one-out": { name: "Ally's Odd One Out", icon: "🧩" },
    "think-like-ally": { name: "Think Like Ally", icon: "💡" },
    "think-and-link": { name: "Think & Link", icon: "💜" }
  };

  const current = gameNames[gameId] || { name: gameId, icon: "🎮" };
  if (activeGameText) activeGameText.textContent = current.name;
  if (activeGameIcon) activeGameIcon.textContent = current.icon;
}

// --------------------------------------------------------------------------
// Round Flow & Game Actions
// --------------------------------------------------------------------------
btnStartRound?.addEventListener("click", () => {
  sendGameAction("newRound");
  showToast("▶ Round started / restarted!");
});

btnNextRound?.addEventListener("click", () => {
  sendGameAction("newRound");
  showToast("⏭ Advanced to Next Round!");
});

btnPrevRound?.addEventListener("click", () => {
  sendGameAction("prevRound");
  showToast("⏮ Returned to Previous Round!");
});

btnTogglePause?.addEventListener("click", () => {
  sendGameAction("togglePause");
});

btnHint?.addEventListener("click", () => {
  sendGameAction("hint");
  showToast("💡 Hint broadcasted to chat & overlay!");
});

btnReveal?.addEventListener("click", () => {
  sendGameAction("reveal");
  showToast("👁 Secret answer revealed on screen!");
});

// Time Adjusters (+5s, -5s, presets)
document.querySelectorAll(".time-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const delta = parseInt(chip.getAttribute("data-delta"), 10);
    if (!isNaN(delta)) {
      sendGameAction("adjustTime", { delta });
      showToast(`⏳ Adjusted time by ${delta > 0 ? "+" + delta : delta}s`);
    }
  });
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sec = parseInt(btn.getAttribute("data-sec"), 10);
    if (!isNaN(sec)) {
      sendGameAction("setTime", { sec });
      showToast(`⏳ Duration set to ${sec} seconds`);
    }
  });
});

btnSetCustomTime?.addEventListener("click", () => {
  const sec = parseInt(inputCustomTime?.value, 10);
  if (sec && sec > 0) {
    sendGameAction("setTime", { sec });
    showToast(`⏳ Set custom time: ${sec}s`);
    if (inputCustomTime) inputCustomTime.value = "";
  }
});

// Reset Leaderboard & Game
btnResetLeaderboard?.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all leaderboard scores to zero?")) {
    sendGameAction("resetLeaderboard");
    showToast("🏆 Leaderboard reset successfully!");
  }
});

btnResetGame?.addEventListener("click", () => {
  if (confirm("Reset current game and community streak back to 0?")) {
    sendGameAction("resetGame");
    showToast("🔄 Game & Streak reset to Round 1!");
  }
});

// Simulate Guess
btnSimulateGuess?.addEventListener("click", () => {
  const guess = inputSimulateGuess?.value?.trim();
  if (guess) {
    socket.emit("simulateGuess", {
      username: "TestViewer",
      nickname: "TestViewer",
      message: guess
    });
    if (inputSimulateGuess) inputSimulateGuess.value = "";
  }
});

inputSimulateGuess?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    btnSimulateGuess?.click();
  }
});

// Clear Feed
btnClearFeed?.addEventListener("click", () => {
  if (feedList) feedList.innerHTML = '<div class="feed-empty">Feed cleared.</div>';
});

// Helper: Send Game Action
function sendGameAction(action, options = {}) {
  socket.emit("gameAction", {
    gameId: currentActiveGameId,
    action,
    options
  });
}

// --------------------------------------------------------------------------
// Direct TikTok Live Connection
// --------------------------------------------------------------------------
btnConnectTikTok?.addEventListener("click", () => {
  const username = inputTikTokUser?.value?.trim();
  if (!username) {
    showToast("⚠️ Please enter a TikTok streamer username");
    return;
  }
  socket.emit("connectTikTok", { username });
  showToast(`🔴 Connecting directly to TikTok @${username}...`);
});

btnDisconnectTikTok?.addEventListener("click", () => {
  socket.emit("disconnectTikTok");
  showToast("Disconnected from TikTok Live");
});

function updateTikTokUI(status) {
  if (!status) return;

  if (status.connected) {
    badgeTikTok.className = "badge badge-green";
    textTikTok.textContent = `@${status.username || "TikTok Live"}`;
    if (status.avatar) {
      avatarTikTokMini.style.display = "inline-block";
      avatarTikTokMini.innerHTML = `<img src="${status.avatar}" style="width:14px;height:14px;border-radius:50%;vertical-align:middle" />`;
    }
    btnConnectTikTok.style.display = "none";
    btnDisconnectTikTok.style.display = "inline-block";
  } else if (status.connecting) {
    badgeTikTok.className = "badge badge-purple";
    textTikTok.textContent = "Connecting...";
    avatarTikTokMini.style.display = "none";
    btnConnectTikTok.style.display = "none";
    btnDisconnectTikTok.style.display = "inline-block";
  } else {
    badgeTikTok.className = "badge badge-red";
    textTikTok.textContent = "TikTok Disconnected";
    avatarTikTokMini.style.display = "none";
    btnConnectTikTok.style.display = "inline-block";
    btnDisconnectTikTok.style.display = "none";
  }
}

// --------------------------------------------------------------------------
// Update Cheat Sheet Peek
// --------------------------------------------------------------------------
function updateHostCheatSheet(data) {
  if (!data) return;

  if (data.gameId === "odd-one-out") {
    cheatSecretAnswer.textContent = data.target || "--";
    cheatCategory.textContent = `${(data.category || "Fruit").toUpperCase()} (Lvl ${data.level || 1})`;
    cheatStatus.textContent = data.paused ? "Paused ⏸" : (data.active ? "Active Playing ▶" : "Round Ended 🏁");
  } else if (data.gameId === "think-like-ally") {
    cheatSecretAnswer.textContent = data.allyAnswer || data.answer || "--";
    cheatCategory.textContent = `"${data.question || "Trivia"}" ${data.questionIcon || "💡"}`;
    cheatStatus.textContent = data.paused ? "Paused ⏸" : (data.isTimerActive ? "Guessing Active ▶" : (data.isAnswerRevealed ? "Revealed 👁" : "Ready"));
  } else if (data.gameId === "think-and-link") {
    const solvedCount = Array.isArray(data.slots) ? data.slots.filter((s) => s.revealed).length : 0;
    const wordsPreview = Array.isArray(data.slots) ? data.slots.map((s) => s.word).join(", ") : "--";
    cheatSecretAnswer.textContent = wordsPreview;
    cheatSecretAnswer.style.fontSize = "12px";
    cheatCategory.textContent = `${data.topic || "Topic"} ${data.emoji || "💜"} (${data.category || "Word"})`;
    cheatStatus.textContent = `Solved ${solvedCount}/6 words • ${data.paused ? "Paused ⏸" : (data.isTimerActive ? "Active ▶" : "Ended 🏁")}`;
  }
}

// --------------------------------------------------------------------------
// Update General Game State UI
// --------------------------------------------------------------------------
function updateGameStateUI(data) {
  if (!data) return;
  currentGameState = data;

  if (data.activeGameId) {
    updateActiveGameUI(data.activeGameId);
  }

  // Header Round & Streak
  if (badgeRound) badgeRound.textContent = `Round ${data.round || 1}`;
  if (badgeStreak) badgeStreak.textContent = `🔥 Streak ${data.streak || 0}`;

  // Timer Badge
  const secondsLeft = data.time !== undefined ? data.time : (data.timerRemaining !== undefined ? data.timerRemaining : 0);
  if (liveTimerBadge) {
    liveTimerBadge.textContent = `${secondsLeft}s`;
    if (secondsLeft <= 5 && secondsLeft > 0) {
      liveTimerBadge.style.color = "#ef4444";
      liveTimerBadge.style.borderColor = "rgba(239, 68, 68, 0.5)";
    } else {
      liveTimerBadge.style.color = "#fbbf24";
      liveTimerBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
    }
  }

  // Pause State
  isPaused = !!data.paused;
  if (pauseBtnText && pauseBtnIcon) {
    if (isPaused) {
      pauseBtnText.textContent = "Resume";
      pauseBtnIcon.textContent = "▶";
      btnTogglePause.style.background = "linear-gradient(135deg, #10b981, #059669)";
    } else {
      pauseBtnText.textContent = "Pause";
      pauseBtnIcon.textContent = "⏸";
      btnTogglePause.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    }
  }

  // Cheat Sheet
  updateHostCheatSheet(data);

  // TikTok status
  updateTikTokUI({
    connected: data.tiktokConnected,
    connecting: data.tiktokConnecting,
    username: data.tiktokLiveUsername,
    avatar: data.tiktokLiveStreamerAvatar
  });
}

// --------------------------------------------------------------------------
// Append Chat Guess to Feed
// --------------------------------------------------------------------------
function appendToFeed(item) {
  if (!feedList) return;

  const empty = feedList.querySelector(".feed-empty");
  if (empty) empty.remove();

  const el = document.createElement("div");
  el.className = `feed-item ${item.isWinner ? "winner" : ""}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;color:var(--muted)">${timeStr}</span>
      <span class="feed-user">@${item.user || "Viewer"}:</span>
      <span class="feed-guess">${item.code || item.message || ""}</span>
    </div>
    ${item.isWinner ? `<span class="feed-win-badge">#${item.place || 1} WINNER +${item.points || 1}</span>` : ""}
  `;

  feedList.insertBefore(el, feedList.firstChild);

  // Limit feed items
  while (feedList.children.length > 50) {
    feedList.removeChild(feedList.lastChild);
  }
}

// --------------------------------------------------------------------------
// Socket Event Listeners
// --------------------------------------------------------------------------
socket.on("connect", () => {
  console.log("[Admin Studio] Connected to server");
});

socket.on("gameState", (data) => {
  updateGameStateUI(data);
});

socket.on("gameSwitched", ({ gameId }) => {
  updateActiveGameUI(gameId);
  showToast(`Switched active game to ${gameId}`);
});

socket.on("chatGuess", (guessItem) => {
  if (guessItem) {
    appendToFeed({
      user: guessItem.nickname || guessItem.user,
      code: guessItem.code || guessItem.message,
      isWinner: guessItem.isCorrect,
      place: 1
    });
  }
});

socket.on("winnerFound", (winData) => {
  if (winData?.winner) {
    appendToFeed({
      user: winData.winner.nickname || winData.winner.user,
      code: winData.winner.code,
      isWinner: true,
      place: winData.place,
      points: winData.points
    });
    showToast(`🎉 Winner #${winData.place}: @${winData.winner.nickname} (+${winData.points} pts)!`);
  }
});

socket.on("timeExpired", ({ target, hadWinners }) => {
  showToast(`⏰ Time expired! Answer was: ${target || ""}`);
});

socket.on("tiktokConnectionStatus", (status) => {
  updateTikTokUI(status);
});
