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
  phoneFrame.className = "phone-frame mode-fit" + (currentActiveGameId === "think-and-link" ? " game-think-and-link" : "");
  setActiveScaleBtn(btnScaleFit);
});

btnScale916?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame" + (currentActiveGameId === "think-and-link" ? " game-think-and-link" : "");
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

const obsLeaderboardDisplay = document.getElementById("obsLeaderboardDisplay");
const btnCopyGameOverlay = document.getElementById("btnCopyGameOverlay");
const btnCopyLeaderboardOverlay = document.getElementById("btnCopyLeaderboardOverlay");
const chkHideInGameLeaderboard = document.getElementById("chkHideInGameLeaderboard");

if (obsUrlDisplay) obsUrlDisplay.textContent = `${window.location.origin}/overlay`;
if (obsLeaderboardDisplay) obsLeaderboardDisplay.textContent = `${window.location.origin}/leaderboard`;

function copyToClipboard(url, label) {
  navigator.clipboard.writeText(url).then(() => {
    showToast(`✅ ${label} copied to clipboard!`);
  }).catch(() => {
    prompt(`Copy this URL for ${label}:`, url);
  });
}

btnCopyOverlayUrl?.addEventListener("click", () => {
  copyToClipboard(`${window.location.origin}/overlay`, "Live Game Overlay URL");
});

btnCopyGameOverlay?.addEventListener("click", () => {
  copyToClipboard(`${window.location.origin}/overlay`, "Live Game Overlay URL");
});

btnCopyLeaderboardOverlay?.addEventListener("click", () => {
  copyToClipboard(`${window.location.origin}/leaderboard`, "Standalone Leaderboard URL");
});

chkHideInGameLeaderboard?.addEventListener("change", (e) => {
  const hide = e.target.checked;
  socket.emit("toggleInGameLeaderboard", { hide });
  showToast(hide ? "👁️ In-game leaderboard hidden (using standalone source)" : "🏆 In-game leaderboard shown");
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

  const oddSettingsCard = document.getElementById("oddOneOutSettingsCard");
  if (oddSettingsCard) {
    oddSettingsCard.style.display = (gameId === "odd-one-out") ? "block" : "none";
  }

  const thinkAndLinkSettingsCard = document.getElementById("thinkAndLinkSettingsCard");
  if (thinkAndLinkSettingsCard) {
    thinkAndLinkSettingsCard.style.display = (gameId === "think-and-link") ? "block" : "none";
  }

  const gameNames = {
    "odd-one-out": { name: "Ally's Odd One Out", icon: "🧩" },
    "think-like-ally": { name: "Think Like Ally", icon: "💡" },
    "think-and-link": { name: "Think & Link", icon: "💜" }
  };

  if (phoneFrame) {
    if (gameId === "think-and-link") {
      phoneFrame.classList.add("game-think-and-link");
    } else {
      phoneFrame.classList.remove("game-think-and-link");
    }
  }

  const current = gameNames[gameId] || { name: gameId, icon: "🎮" };
  if (activeGameText) activeGameText.textContent = current.name;
  if (activeGameIcon) activeGameIcon.textContent = current.icon;
}

// --------------------------------------------------------------------------
// Odd One Out Settings
// --------------------------------------------------------------------------
const btnApplySettings = document.getElementById("btnApplySettings");
if (btnApplySettings) {
  btnApplySettings.addEventListener("click", () => {
    const selectCategory = document.getElementById("selectCategory");
    const selectLevel = document.getElementById("selectLevel");
    
    const cat = selectCategory ? selectCategory.value : "random";
    const lvlVal = selectLevel ? selectLevel.value : "auto";
    const opts = {};

    if (cat !== "random") opts.category = cat;
    if (lvlVal === "auto") {
      opts.autoLevel = true;
    } else {
      opts.autoLevel = false;
      opts.level = parseInt(lvlVal, 10);
    }

    sendGameAction("setOptions", opts);
    showToast("✅ Settings Applied!");
  });
}

// --------------------------------------------------------------------------
// Think & Link Category Filter & Puzzle Selector
// --------------------------------------------------------------------------
const talOverlayCategoryFilter = document.getElementById("talOverlayCategoryFilter");
const talOverlaySearchInput = document.getElementById("talOverlaySearchInput");
const talOverlayBtnClearSearch = document.getElementById("talOverlayBtnClearSearch");
const talOverlayPuzzleSelect = document.getElementById("talOverlayPuzzleSelect");
const talOverlayFilteredCountText = document.getElementById("talOverlayFilteredCountText");
const talOverlayPuzzleCountBadge = document.getElementById("talOverlayPuzzleCountBadge");
const talOverlayBtnLoadPuzzle = document.getElementById("talOverlayBtnLoadPuzzle");
const talOverlayBtnRandomPuzzle = document.getElementById("talOverlayBtnRandomPuzzle");

let talPuzzles = [];
let talCategoriesInitialized = false;
let talCurrentFilteredPuzzles = [];

const talCategoryIcons = {
  "Gaming": "🎮",
  "Pop Culture": "🎬",
  "Food & Drink": "🍕",
  "Sports": "🏆",
  "Travel": "✈️",
  "Nature": "🌿",
  "Science": "🔬",
  "Everyday": "🏠",
  "Music": "🎵",
  "Entertainment": "🍿",
  "Hobbies": "🎨",
  "Professions": "💼",
  "Technology": "💻",
  "Celebration": "🎉",
  "History": "🏛️",
  "Outdoors": "🏕️",
  "Home": "🛋️",
  "Shopping": "🛍️",
  "Animation": "📺",
  "Lifestyle": "✨",
  "Pets": "🐾",
  "Social Media": "📱",
  "Anime": "🎌",
  "Mystery": "🔍",
  "Adventure": "🗺️",
  "Education": "📚",
  "Seasons": "🍂",
  "Fantasy": "🧙"
};

function initTalPuzzles(puzzles) {
  if (!Array.isArray(puzzles) || puzzles.length === 0) return;
  talPuzzles = puzzles;

  if (!talCategoriesInitialized && talOverlayCategoryFilter) {
    const counts = new Map();
    talPuzzles.forEach((p) => {
      const cat = p.category || "General";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const sortedCats = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    let opts = `<option value="ALL">🌟 All Categories (${talPuzzles.length})</option>`;
    sortedCats.forEach(([cat, count]) => {
      const icon = talCategoryIcons[cat] || "📁";
      opts += `<option value="${cat}">${icon} ${cat} (${count})</option>`;
    });

    talOverlayCategoryFilter.innerHTML = opts;
    talCategoriesInitialized = true;
  }

  renderTalOverlayFilteredPuzzles();
}

function renderTalOverlayFilteredPuzzles() {
  if (!talPuzzles.length || !talOverlayPuzzleSelect) return;

  const selectedCat = talOverlayCategoryFilter ? talOverlayCategoryFilter.value : "ALL";
  const q = (talOverlaySearchInput?.value || "").trim().toLowerCase();

  talCurrentFilteredPuzzles = talPuzzles.filter((p) => {
    if (selectedCat !== "ALL" && p.category !== selectedCat) return false;
    if (!q) return true;
    const topicMatch = (p.topic || "").toLowerCase().includes(q);
    const catMatch = (p.category || "").toLowerCase().includes(q);
    const wordsMatch = Array.isArray(p.words) && p.words.some((w) => String(w).toLowerCase().includes(q));
    return topicMatch || catMatch || wordsMatch;
  });

  if (talOverlayFilteredCountText) {
    talOverlayFilteredCountText.textContent = `${talCurrentFilteredPuzzles.length} available`;
  }

  if (talOverlayPuzzleCountBadge) {
    talOverlayPuzzleCountBadge.textContent = selectedCat === "ALL" && !q
      ? `${talPuzzles.length} Topics`
      : `${talCurrentFilteredPuzzles.length} Match${talCurrentFilteredPuzzles.length === 1 ? '' : 'es'}`;
  }

  if (talCurrentFilteredPuzzles.length === 0) {
    talOverlayPuzzleSelect.innerHTML = `<option value="">No matching topics found</option>`;
  } else {
    talOverlayPuzzleSelect.innerHTML = talCurrentFilteredPuzzles
      .map((p) => `<option value="${p.id}">${p.emoji || "💜"} ${p.topic} — [${p.category}] (${(p.words || []).join(", ")})</option>`)
      .join("");

    if (currentGameState?.puzzleId && talCurrentFilteredPuzzles.some((p) => p.id === currentGameState.puzzleId)) {
      talOverlayPuzzleSelect.value = currentGameState.puzzleId;
    }
  }

  if (talOverlayBtnClearSearch) {
    talOverlayBtnClearSearch.style.display = q ? "flex" : "none";
  }
}

if (talOverlayCategoryFilter) {
  talOverlayCategoryFilter.addEventListener("change", () => {
    renderTalOverlayFilteredPuzzles();
    sendGameAction("setCategoryFilter", talOverlayCategoryFilter.value);
    showToast(talOverlayCategoryFilter.value === "ALL" ? "All Categories Shown" : `Category: ${talOverlayCategoryFilter.value}`);
  });
}

if (talOverlaySearchInput) {
  talOverlaySearchInput.addEventListener("input", () => {
    renderTalOverlayFilteredPuzzles();
  });
}

if (talOverlayBtnClearSearch) {
  talOverlayBtnClearSearch.addEventListener("click", () => {
    if (talOverlaySearchInput) talOverlaySearchInput.value = "";
    renderTalOverlayFilteredPuzzles();
    talOverlaySearchInput?.focus();
  });
}

if (talOverlayBtnLoadPuzzle) {
  talOverlayBtnLoadPuzzle.addEventListener("click", () => {
    const pId = talOverlayPuzzleSelect?.value;
    if (!pId) return;
    sendGameAction("loadPuzzleById", pId);
    showToast(`Loaded topic ${pId}`);
  });
}

if (talOverlayBtnRandomPuzzle) {
  talOverlayBtnRandomPuzzle.addEventListener("click", () => {
    const pool = talCurrentFilteredPuzzles.length > 0 ? talCurrentFilteredPuzzles : talPuzzles;
    if (!pool?.length) return;
    const rand = pool[Math.floor(Math.random() * pool.length)];
    if (rand && rand.id) {
      if (talOverlayPuzzleSelect) talOverlayPuzzleSelect.value = rand.id;
      sendGameAction("loadPuzzleById", rand.id);
      showToast(`Loaded Random: ${rand.emoji || "💜"} ${rand.topic}`);
    }
  });
}

// Pre-load Think & Link puzzles so the dropdown is ready instantly
fetch("/games/think-and-link/puzzles.json")
  .then((res) => res.json())
  .then((puzzles) => {
    if (Array.isArray(puzzles)) {
      initTalPuzzles(puzzles);
    }
  })
  .catch((err) => console.log("Note: Could not preload puzzles:", err.message));

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
let simUserCounter = 1;
btnSimulateGuess?.addEventListener("click", () => {
  const raw = inputSimulateGuess?.value?.trim();
  if (!raw) return;

  let user = `Viewer${simUserCounter++}`;
  let guess = raw;

  // Support syntax like "@Alice: B2" or "Alice: B2"
  if (raw.includes(":")) {
    const parts = raw.split(":");
    user = parts[0].replace(/^@/, "").trim() || user;
    guess = parts.slice(1).join(":").trim();
  }

  socket.emit("simulateGuess", {
    username: user,
    nickname: user,
    message: guess
  });
  if (inputSimulateGuess) inputSimulateGuess.value = "";
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
    const slots = data.secretSlots || data.slots;
    const wordsPreview = Array.isArray(slots) ? slots.map((s) => s.word).filter(Boolean).join(", ") : "--";
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

  if (data.speechMessages) {
    applySpeechData(data.speechMessages);
  }

  if (data.activeGameId) {
    updateActiveGameUI(data.activeGameId);
  }

  // Sync Selects for Odd One Out
  const selectCategory = document.getElementById("selectCategory");
  const selectLevel = document.getElementById("selectLevel");
  if (data.gameId === "odd-one-out") {
    if (selectCategory && document.activeElement !== selectCategory) {
      selectCategory.value = data.categoryOverride || "random";
    }
    if (selectLevel && document.activeElement !== selectLevel) {
      selectLevel.value = data.autoLevel ? "auto" : String(data.manualLevel || data.level || "auto");
    }
  }

  // Sync Controls for Think & Link
  if (data.gameId === "think-and-link") {
    if (Array.isArray(data.puzzles) && data.puzzles.length > 0 && talPuzzles.length === 0) {
      initTalPuzzles(data.puzzles);
    }
    if (data.activeCategoryFilter && talOverlayCategoryFilter && document.activeElement !== talOverlayCategoryFilter) {
      if (talOverlayCategoryFilter.value !== data.activeCategoryFilter) {
        talOverlayCategoryFilter.value = data.activeCategoryFilter;
        renderTalOverlayFilteredPuzzles();
      }
    }
    if (data.puzzleId && talOverlayPuzzleSelect && document.activeElement !== talOverlayPuzzleSelect) {
      if (talOverlayPuzzleSelect.value !== data.puzzleId) {
        talOverlayPuzzleSelect.value = data.puzzleId;
      }
    }
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

  // Active Preset Button Highlight
  const activeDuration = data.roundDurationSec || data.customDurationSec || data.time;
  if (activeDuration) {
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      btn.classList.toggle("active", sec === activeDuration);
    });
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

// ==========================================================================
// Speech Bubble Messages Manager (Live Studio)
// ==========================================================================
const inputNewSpeechMsg = document.getElementById("inputNewSpeechMsg");
const btnAddSpeechMsg = document.getElementById("btnAddSpeechMsg");
const inputSpeechCycleSeconds = document.getElementById("inputSpeechCycleSeconds");
const btnSaveCycleSeconds = document.getElementById("btnSaveCycleSeconds");
const speechMessagesList = document.getElementById("speechMessagesList");

let speechData = {
  cycleSeconds: 8,
  messages: []
};

function renderSpeechMessagesList() {
  if (!speechMessagesList) return;
  if (!speechData.messages || speechData.messages.length === 0) {
    speechMessagesList.innerHTML = `<div style="color:#94a3b8;font-size:11px;text-align:center;padding:8px">No custom speech messages.</div>`;
    return;
  }

  speechMessagesList.innerHTML = speechData.messages
    .map((msg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === speechData.messages.length - 1;
      const safeText = String(msg.text || "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[m]));

      return `
        <div class="speech-msg-row" data-index="${idx}">
          <span style="font-size:10px;font-weight:800;color:#94a3b8;width:16px;text-align:center;">#${idx + 1}</span>
          <span class="speech-msg-text">${safeText}</span>
          <div class="speech-msg-actions">
            <button class="speech-btn-mini btn-move-up" data-index="${idx}" ${isFirst ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Up">⬆️</button>
            <button class="speech-btn-mini btn-move-down" data-index="${idx}" ${isLast ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Down">⬇️</button>
            <button class="speech-btn-mini btn-edit-msg" data-index="${idx}" title="Edit">✏️</button>
            <button class="speech-btn-mini delete btn-delete-msg" data-index="${idx}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach handlers
  speechMessagesList.querySelectorAll(".btn-move-up").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (idx > 0) {
        const temp = speechData.messages[idx];
        speechData.messages[idx] = speechData.messages[idx - 1];
        speechData.messages[idx - 1] = temp;
        saveAndBroadcastSpeech();
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-move-down").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (idx < speechData.messages.length - 1) {
        const temp = speechData.messages[idx];
        speechData.messages[idx] = speechData.messages[idx + 1];
        speechData.messages[idx + 1] = temp;
        saveAndBroadcastSpeech();
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-edit-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const current = speechData.messages[idx]?.text || "";
      const updated = prompt("Edit speech message:", current);
      if (updated !== null) {
        const trimmed = updated.trim();
        if (trimmed) {
          speechData.messages[idx].text = trimmed;
          saveAndBroadcastSpeech();
        }
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-delete-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const toDelete = speechData.messages[idx];
      if (confirm(`Delete message: "${toDelete?.text}"?`)) {
        speechData.messages.splice(idx, 1);
        saveAndBroadcastSpeech();
      }
    });
  });
}

function saveAndBroadcastSpeech() {
  renderSpeechMessagesList();

  socket.emit("updateSpeechMessages", speechData);

  fetch("/api/speech-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(speechData)
  }).catch((err) => console.warn("[Admin Studio] Failed REST speech save:", err));

  showToast("💬 Speech messages saved & updated!");
}

function applySpeechData(data) {
  if (!data) return;
  if (Array.isArray(data.messages)) {
    speechData.messages = data.messages;
  }
  if (typeof data.cycleSeconds === "number" && data.cycleSeconds > 0) {
    speechData.cycleSeconds = data.cycleSeconds;
    if (inputSpeechCycleSeconds) {
      inputSpeechCycleSeconds.value = data.cycleSeconds;
    }
  }
  renderSpeechMessagesList();
}

if (btnAddSpeechMsg && inputNewSpeechMsg) {
  const handleAdd = () => {
    const text = inputNewSpeechMsg.value.trim();
    if (!text) return;
    if (!speechData.messages) speechData.messages = [];
    speechData.messages.push({
      id: `msg-${Date.now()}`,
      text
    });
    inputNewSpeechMsg.value = "";
    saveAndBroadcastSpeech();
  };

  btnAddSpeechMsg.addEventListener("click", handleAdd);
  inputNewSpeechMsg.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd();
  });
}

if (btnSaveCycleSeconds && inputSpeechCycleSeconds) {
  btnSaveCycleSeconds.addEventListener("click", () => {
    const sec = parseInt(inputSpeechCycleSeconds.value, 10);
    if (!isNaN(sec) && sec >= 3 && sec <= 120) {
      speechData.cycleSeconds = sec;
      saveAndBroadcastSpeech();
    } else {
      alert("Please enter a cycle interval between 3 and 120 seconds.");
    }
  });
}

socket.on("speechMessagesUpdated", (data) => {
  applySpeechData(data);
});

// Fetch initial messages
fetch("/api/speech-messages")
  .then((res) => res.json())
  .then((data) => {
    if (data && data.messages) applySpeechData(data);
  })
  .catch((e) => console.warn("[Admin Studio] Error fetching speech messages:", e));

