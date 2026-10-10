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
function getGameFrameClass(gameId) {
  if (gameId === "think-and-link") return " game-think-and-link";
  if (gameId === "crowd-says" || gameId === "chat-feud") return " game-crowd-says";
  if (gameId === "riddle") return " game-riddle";
  return "";
}

btnScaleFit?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame mode-fit" + getGameFrameClass(currentActiveGameId);
  setActiveScaleBtn(btnScaleFit);
});

btnScale916?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame" + getGameFrameClass(currentActiveGameId);
  setActiveScaleBtn(btnScale916);
});

btnScaleFull?.addEventListener("click", () => {
  phoneFrame.className = "phone-frame mode-wide" + getGameFrameClass(currentActiveGameId);
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
const obsMobileDisplay = document.getElementById("obsMobileDisplay");
if (obsMobileDisplay) obsMobileDisplay.textContent = `${window.location.origin}/mobile`;

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

  const wordFinderSettingsCard = document.getElementById("wordFinderSettingsCard");
  if (wordFinderSettingsCard) {
    wordFinderSettingsCard.style.display = (gameId === "word-finder") ? "block" : "none";
  }

  const thinkLikeAllySettingsCard = document.getElementById("thinkLikeAllySettingsCard");
  if (thinkLikeAllySettingsCard) {
    thinkLikeAllySettingsCard.style.display = (gameId === "think-like-ally") ? "block" : "none";
  }

  const crowdSaysSettingsCard = document.getElementById("crowdSaysSettingsCard");
  if (crowdSaysSettingsCard) {
    crowdSaysSettingsCard.style.display = (gameId === "crowd-says") ? "block" : "none";
  }

  const unscrambleSettingsCard = document.getElementById("unscrambleSettingsCard");
  if (unscrambleSettingsCard) {
    unscrambleSettingsCard.style.display = (gameId === "unscramble") ? "block" : "none";
  }

  const rebusSettingsCard = document.getElementById("rebusSettingsCard");
  if (rebusSettingsCard) {
    rebusSettingsCard.style.display = (gameId === "rebus") ? "block" : "none";
  }

  const riddleSettingsCard = document.getElementById("riddleSettingsCard");
  if (riddleSettingsCard) {
    riddleSettingsCard.style.display = (gameId === "riddle") ? "block" : "none";
  }

  const gameNames = {
    "odd-one-out": { name: "Ally's Odd One Out", icon: "🧩" },
    "think-like-ally": { name: "Think Like Ally", icon: "💡" },
    "think-and-link": { name: "Think & Link", icon: "💜" },
    "word-finder": { name: "Ally's Word Finder", icon: "🔍" },
    "crowd-says": { name: "Ally's Chat Feud", icon: "⚔️" },
    "chat-feud": { name: "Ally's Chat Feud", icon: "⚔️" },
    "unscramble": { name: "Ally's Unscramble", icon: "🔤" },
    "rebus": { name: "Ally's Rebus", icon: "🎭" },
    "riddle": { name: "Ally's Riddles", icon: "🧙‍♂️" }
  };

  if (phoneFrame) {
    if (gameId === "think-and-link") {
      phoneFrame.classList.add("game-think-and-link");
      phoneFrame.classList.remove("game-crowd-says", "game-riddle");
    } else if (gameId === "crowd-says" || gameId === "chat-feud") {
      phoneFrame.classList.add("game-crowd-says");
      phoneFrame.classList.remove("game-think-and-link", "game-riddle");
    } else if (gameId === "riddle") {
      phoneFrame.classList.add("game-riddle");
      phoneFrame.classList.remove("game-think-and-link", "game-crowd-says");
    } else {
      phoneFrame.classList.remove("game-think-and-link", "game-crowd-says", "game-riddle");
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
// Word Finder Settings (Host Studio)
// --------------------------------------------------------------------------
const wfOverlayCategoryFilter = document.getElementById("wfOverlayCategoryFilter");
const wfOverlaySearchInput = document.getElementById("wfOverlaySearchInput");
const wfOverlayBtnClearSearch = document.getElementById("wfOverlayBtnClearSearch");
const wfOverlayPuzzleSelect = document.getElementById("wfOverlayPuzzleSelect");
const wfOverlayFilteredCountText = document.getElementById("wfOverlayFilteredCountText");
const wfOverlayPuzzleCountBadge = document.getElementById("wfOverlayPuzzleCountBadge");
const wfOverlayBtnLoadPuzzle = document.getElementById("wfOverlayBtnLoadPuzzle");
const wfOverlayBtnRandomPuzzle = document.getElementById("wfOverlayBtnRandomPuzzle");

let wfPuzzles = [];
let wfCategoriesInitialized = false;
let wfCurrentFilteredPuzzles = [];

function initWfPuzzles(puzzles) {
  if (!Array.isArray(puzzles) || puzzles.length === 0) return;
  wfPuzzles = puzzles;

  if (!wfCategoriesInitialized && wfOverlayCategoryFilter) {
    const counts = new Map();
    wfPuzzles.forEach((p) => {
      const cat = p.category || "General";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const sortedCats = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    let opts = `<option value="ALL">🌟 All Categories (${wfPuzzles.length})</option>`;
    sortedCats.forEach(([cat, count]) => {
      opts += `<option value="${cat}">📁 ${cat} (${count})</option>`;
    });

    wfOverlayCategoryFilter.innerHTML = opts;
    wfCategoriesInitialized = true;
  }

  renderWfOverlayFilteredPuzzles();
}

function renderWfOverlayFilteredPuzzles() {
  if (!wfPuzzles.length || !wfOverlayPuzzleSelect) return;

  const selectedCat = wfOverlayCategoryFilter ? wfOverlayCategoryFilter.value : "ALL";
  const q = (wfOverlaySearchInput?.value || "").trim().toLowerCase();

  wfCurrentFilteredPuzzles = wfPuzzles.filter((p) => {
    if (selectedCat !== "ALL" && p.category !== selectedCat) return false;
    if (!q) return true;
    const topicMatch = (p.topic || "").toLowerCase().includes(q);
    const catMatch = (p.category || "").toLowerCase().includes(q);
    const wordsMatch = Array.isArray(p.words) && p.words.some((w) => String(w.word || w).toLowerCase().includes(q));
    return topicMatch || catMatch || wordsMatch;
  });

  if (wfOverlayFilteredCountText) {
    wfOverlayFilteredCountText.textContent = `${wfCurrentFilteredPuzzles.length} available`;
  }

  if (wfOverlayPuzzleCountBadge) {
    wfOverlayPuzzleCountBadge.textContent = selectedCat === "ALL" && !q
      ? `${wfPuzzles.length} Puzzles`
      : `${wfCurrentFilteredPuzzles.length} Match${wfCurrentFilteredPuzzles.length === 1 ? '' : 'es'}`;
  }

  if (wfCurrentFilteredPuzzles.length === 0) {
    wfOverlayPuzzleSelect.innerHTML = `<option value="">No matching puzzles found</option>`;
  } else {
    wfOverlayPuzzleSelect.innerHTML = wfCurrentFilteredPuzzles
      .map((p) => `<option value="${p.id}">${p.emoji || "🔍"} ${p.topic} — [${p.category}] (${(p.words || []).length || 6} words)</option>`)
      .join("");

    if (currentGameState?.puzzleId && wfCurrentFilteredPuzzles.some((p) => p.id === currentGameState.puzzleId)) {
      wfOverlayPuzzleSelect.value = currentGameState.puzzleId;
    }
  }

  if (wfOverlayBtnClearSearch) {
    wfOverlayBtnClearSearch.style.display = q ? "flex" : "none";
  }
}

const wfOverlayGridSize = document.getElementById("wfOverlayGridSize");
if (wfOverlayGridSize) {
  wfOverlayGridSize.addEventListener("change", () => {
    const size = parseInt(wfOverlayGridSize.value, 10);
    sendGameAction("setGridSize", { size });
    showToast(`📐 Word Finder grid size set to ${size}x${size}!`);
  });
}

if (wfOverlayCategoryFilter) {
  wfOverlayCategoryFilter.addEventListener("change", () => {
    renderWfOverlayFilteredPuzzles();
    sendGameAction("setCategoryFilter", wfOverlayCategoryFilter.value);
    showToast(wfOverlayCategoryFilter.value === "ALL" ? "All Categories Shown" : `Category: ${wfOverlayCategoryFilter.value}`);
  });
}

if (wfOverlaySearchInput) {
  wfOverlaySearchInput.addEventListener("input", () => {
    renderWfOverlayFilteredPuzzles();
  });
}

if (wfOverlayBtnClearSearch) {
  wfOverlayBtnClearSearch.addEventListener("click", () => {
    if (wfOverlaySearchInput) wfOverlaySearchInput.value = "";
    renderWfOverlayFilteredPuzzles();
  });
}

if (wfOverlayBtnLoadPuzzle) {
  wfOverlayBtnLoadPuzzle.addEventListener("click", () => {
    const selectedId = wfOverlayPuzzleSelect?.value;
    if (selectedId) {
      sendGameAction("loadPuzzleById", { id: selectedId });
      showToast(`📚 Loading topic ${selectedId}...`);
    }
  });
}

if (wfOverlayBtnRandomPuzzle) {
  wfOverlayBtnRandomPuzzle.addEventListener("click", () => {
    const selectedCat = wfOverlayCategoryFilter?.value || "ALL";
    sendGameAction("newRound", { category: selectedCat });
    showToast(`🎲 Random puzzle from ${selectedCat}`);
  });
}

// Pre-load Word Finder puzzles
fetch("/games/word-finder/puzzles.json")
  .then((res) => res.json())
  .then((puzzles) => {
    if (Array.isArray(puzzles)) {
      initWfPuzzles(puzzles);
    }
  })
  .catch((err) => console.log("Note: Could not preload word finder puzzles:", err.message));

// --------------------------------------------------------------------------
// Think Like Ally Pack Controls & Importer
// --------------------------------------------------------------------------
const tlaOverlayBtnLoadPack = document.getElementById("tlaOverlayBtnLoadPack");
const tlaOverlayBtnImportPack = document.getElementById("tlaOverlayBtnImportPack");
const tlaOverlayFileInput = document.getElementById("tlaOverlayFileInput");
const tlaOverlayPackSelect = document.getElementById("tlaOverlayPackSelect");

if (tlaOverlayBtnLoadPack && tlaOverlayPackSelect) {
  tlaOverlayBtnLoadPack.addEventListener("click", () => {
    const setId = tlaOverlayPackSelect.value;
    if (!setId) return;
    sendGameAction("loadQuestionSet", setId);
    showToast("📚 Loaded question pack!");
  });
}

if (tlaOverlayBtnImportPack && tlaOverlayFileInput) {
  tlaOverlayBtnImportPack.addEventListener("click", () => {
    tlaOverlayFileInput.click();
  });

  tlaOverlayFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let parsed = [];
      try {
        if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) parsed = json;
          else if (json && json.questions) parsed = json.questions;
        }
      } catch (err) {}

      if (parsed.length === 0) {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (let line of lines) {
          line = line.replace(/^\s*(?:\[\d+\]|\d+[\.\)\-:]\s*)/, "").trim();
          const delim = line.includes("\t") ? "\t" : (line.includes("|") ? "|" : (line.includes(" - ") ? " - " : (line.includes(",") ? "," : null)));
          if (delim) {
            const parts = line.split(delim).map((p) => p.trim());
            if (parts.length >= 2 && parts[0].toLowerCase() !== "question") {
              parsed.push({ question: parts[0], answer: parts[1] });
            }
          }
        }
      }

      if (parsed.length === 0) {
        alert("Could not detect questions in file. Format should be: Question, Answer (or JSON array).");
        return;
      }

      const defaultName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const packName = prompt("Enter pack name for imported questions:", defaultName) || defaultName;

      socket.emit("gameAction", {
        gameId: "think-like-ally",
        action: "importQuestionSet",
        options: { name: packName, questions: parsed }
      });
      showToast(`Imported ${parsed.length} questions from ${file.name}!`);
      tlaOverlayFileInput.value = "";
    };
    reader.readAsText(file);
  });
}

// --------------------------------------------------------------------------
// Chat Feud Controls
// --------------------------------------------------------------------------
const csOverlayBtnLoadQuestion = document.getElementById("csOverlayBtnLoadQuestion");
const csOverlayBtnRandomQuestion = document.getElementById("csOverlayBtnRandomQuestion");
const csOverlayQuestionSelect = document.getElementById("csOverlayQuestionSelect");

if (csOverlayBtnLoadQuestion && csOverlayQuestionSelect) {
  csOverlayBtnLoadQuestion.addEventListener("click", () => {
    const qId = csOverlayQuestionSelect.value;
    if (!qId) return;
    sendGameAction("loadQuestionById", qId);
    showToast("📚 Loaded survey question!");
  });
}

if (csOverlayBtnRandomQuestion) {
  csOverlayBtnRandomQuestion.addEventListener("click", () => {
    sendGameAction("newRound");
    showToast("🎲 Random survey question loaded!");
  });
}

// --------------------------------------------------------------------------
// Ally's Unscramble Controls & Word Selector
// --------------------------------------------------------------------------
let uWords = [];
let uCurrentFilteredWords = [];
const uOverlayLengthFilter = document.getElementById("uOverlayLengthFilter");
const uOverlaySearchInput = document.getElementById("uOverlaySearchInput");
const uOverlayBtnClearSearch = document.getElementById("uOverlayBtnClearSearch");
const uOverlayWordSelect = document.getElementById("uOverlayWordSelect");
const uOverlayFilteredCountText = document.getElementById("uOverlayFilteredCountText");
const uOverlayWordsCountBadge = document.getElementById("uOverlayWordsCountBadge");
const uOverlayBtnLoadWord = document.getElementById("uOverlayBtnLoadWord");
const uOverlayBtnRandomWord = document.getElementById("uOverlayBtnRandomWord");

function initUWords(words) {
  uWords = Array.isArray(words) ? words : [];
  renderUOverlayFilteredWords();
}

function renderUOverlayFilteredWords() {
  if (!uWords.length || !uOverlayWordSelect) return;
  const selectedLen = uOverlayLengthFilter ? uOverlayLengthFilter.value : "ALL";
  const q = (uOverlaySearchInput?.value || "").trim().toLowerCase();

  uCurrentFilteredWords = uWords.filter((w) => {
    if (selectedLen !== "ALL" && String(w.length || (w.word ? w.word.length : 0)) !== String(selectedLen)) {
      return false;
    }
    if (!q) return true;
    const wordMatch = (w.word || "").toLowerCase().includes(q);
    const topicMatch = (w.topic || "").toLowerCase().includes(q);
    const catMatch = (w.category || "").toLowerCase().includes(q);
    return wordMatch || topicMatch || catMatch;
  });

  if (uOverlayFilteredCountText) {
    uOverlayFilteredCountText.textContent = `${uCurrentFilteredWords.length} available`;
  }
  if (uOverlayWordsCountBadge) {
    uOverlayWordsCountBadge.textContent = selectedLen === "ALL" && !q
      ? `${uWords.length} Words`
      : `${uCurrentFilteredWords.length} Match${uCurrentFilteredWords.length === 1 ? '' : 'es'}`;
  }

  if (uCurrentFilteredWords.length === 0) {
    uOverlayWordSelect.innerHTML = `<option value="">No matching words found</option>`;
  } else {
    uOverlayWordSelect.innerHTML = uCurrentFilteredWords
      .map((w) => `<option value="${w.id}">${w.emoji || "🔤"} ${w.word.toUpperCase()} [${w.length}L] — ${w.topic} (${w.scrambled})</option>`)
      .join("");
    if (currentGameState?.wordId && uCurrentFilteredWords.some((w) => w.id === currentGameState.wordId)) {
      uOverlayWordSelect.value = currentGameState.wordId;
    }
  }

  if (uOverlayBtnClearSearch) {
    uOverlayBtnClearSearch.style.display = q ? "flex" : "none";
  }
}

if (uOverlayLengthFilter) {
  uOverlayLengthFilter.addEventListener("change", () => {
    renderUOverlayFilteredWords();
    sendGameAction("setLengthFilter", uOverlayLengthFilter.value);
    showToast(uOverlayLengthFilter.value === "ALL" ? "All Lengths Shown (4-9 Letters)" : `${uOverlayLengthFilter.value}-Letter Words Selected`);
  });
}

if (uOverlaySearchInput) {
  uOverlaySearchInput.addEventListener("input", () => {
    renderUOverlayFilteredWords();
  });
}

if (uOverlayBtnClearSearch) {
  uOverlayBtnClearSearch.addEventListener("click", () => {
    if (uOverlaySearchInput) uOverlaySearchInput.value = "";
    renderUOverlayFilteredWords();
  });
}

if (uOverlayBtnLoadWord && uOverlayWordSelect) {
  uOverlayBtnLoadWord.addEventListener("click", () => {
    const selectedId = uOverlayWordSelect.value;
    if (selectedId) {
      sendGameAction("loadWordById", { id: selectedId });
      showToast(`🔤 Loading word #${selectedId}...`);
    }
  });
}

if (uOverlayBtnRandomWord) {
  uOverlayBtnRandomWord.addEventListener("click", () => {
    const selectedLen = uOverlayLengthFilter ? uOverlayLengthFilter.value : "ALL";
    sendGameAction("newRound", { length: selectedLen });
    showToast(`🎲 Random word loaded (${selectedLen === "ALL" ? "4-9 letters" : selectedLen + " letters"})`);
  });
}

// Pre-load Unscramble words
fetch("/games/unscramble/words.json")
  .then((res) => res.json())
  .then((words) => {
    if (Array.isArray(words)) {
      initUWords(words);
    }
  })
  .catch((err) => console.log("Note: Could not preload unscramble words:", err.message));

// --------------------------------------------------------------------------
// Ally's Rebus Controls & Puzzle Selector
// --------------------------------------------------------------------------
let rebPuzzles = [];
let rebCurrentFilteredPuzzles = [];
const rebOverlayCategoryFilter = document.getElementById("rebOverlayCategoryFilter");
const rebOverlayDifficultyFilter = document.getElementById("rebOverlayDifficultyFilter");
const rebOverlaySearchInput = document.getElementById("rebOverlaySearchInput");
const rebOverlayBtnClearSearch = document.getElementById("rebOverlayBtnClearSearch");
const rebOverlayPuzzleSelect = document.getElementById("rebOverlayPuzzleSelect");
const rebOverlayFilteredCountText = document.getElementById("rebOverlayFilteredCountText");
const rebOverlayCountBadge = document.getElementById("rebOverlayCountBadge");
const rebOverlayBtnLoadPuzzle = document.getElementById("rebOverlayBtnLoadPuzzle");
const rebOverlayBtnRandomPuzzle = document.getElementById("rebOverlayBtnRandomPuzzle");

function initRebPuzzles(puzzles) {
  rebPuzzles = Array.isArray(puzzles) ? puzzles : [];
  renderRebOverlayFilteredPuzzles();
}

function renderRebOverlayFilteredPuzzles() {
  if (!rebPuzzles.length || !rebOverlayPuzzleSelect) return;
  const selectedCat = rebOverlayCategoryFilter ? rebOverlayCategoryFilter.value : "ALL";
  const selectedDiff = rebOverlayDifficultyFilter ? rebOverlayDifficultyFilter.value : "ALL";
  const q = (rebOverlaySearchInput?.value || "").trim().toLowerCase();

  rebCurrentFilteredPuzzles = rebPuzzles.filter((p) => {
    if (selectedCat !== "ALL" && p.category !== selectedCat) return false;
    if (selectedDiff !== "ALL" && p.difficulty !== selectedDiff) return false;
    if (!q) return true;
    const a = (p.answer || "").toLowerCase();
    const h = (p.hint || "").toLowerCase();
    const l = (p.layout || "").toLowerCase();
    return a.includes(q) || h.includes(q) || l.includes(q);
  });

  if (rebOverlayFilteredCountText) {
    rebOverlayFilteredCountText.textContent = `${rebCurrentFilteredPuzzles.length} available`;
  }
  if (rebOverlayCountBadge) {
    rebOverlayCountBadge.textContent = selectedCat === "ALL" && selectedDiff === "ALL" && !q
      ? `${rebPuzzles.length} Puzzles`
      : `${rebCurrentFilteredPuzzles.length} Match${rebCurrentFilteredPuzzles.length === 1 ? '' : 'es'}`;
  }

  if (rebCurrentFilteredPuzzles.length === 0) {
    rebOverlayPuzzleSelect.innerHTML = `<option value="">No matching puzzles found</option>`;
  } else {
    rebOverlayPuzzleSelect.innerHTML = rebCurrentFilteredPuzzles
      .slice(0, 300)
      .map((p) => `<option value="${p.id}">${p.emoji || "🎭"} [${p.difficulty}] ${p.answer} (${p.category} • ${p.layout})</option>`)
      .join("");
    if (currentGameState?.puzzleId && rebCurrentFilteredPuzzles.some((p) => p.id === currentGameState.puzzleId)) {
      rebOverlayPuzzleSelect.value = currentGameState.puzzleId;
    }
  }

  if (rebOverlayBtnClearSearch) {
    rebOverlayBtnClearSearch.style.display = q ? "flex" : "none";
  }
}

if (rebOverlayCategoryFilter) {
  rebOverlayCategoryFilter.addEventListener("change", () => {
    renderRebOverlayFilteredPuzzles();
    sendGameAction("setCategoryFilter", rebOverlayCategoryFilter.value === "ALL" ? "all" : rebOverlayCategoryFilter.value);
    showToast(`Category: ${rebOverlayCategoryFilter.value}`);
  });
}

if (rebOverlayDifficultyFilter) {
  rebOverlayDifficultyFilter.addEventListener("change", () => {
    renderRebOverlayFilteredPuzzles();
    sendGameAction("setDifficultyFilter", rebOverlayDifficultyFilter.value === "ALL" ? "all" : rebOverlayDifficultyFilter.value);
    showToast(`Difficulty: ${rebOverlayDifficultyFilter.value}`);
  });
}

if (rebOverlaySearchInput) {
  rebOverlaySearchInput.addEventListener("input", () => {
    renderRebOverlayFilteredPuzzles();
  });
}

if (rebOverlayBtnClearSearch) {
  rebOverlayBtnClearSearch.addEventListener("click", () => {
    if (rebOverlaySearchInput) rebOverlaySearchInput.value = "";
    renderRebOverlayFilteredPuzzles();
  });
}

if (rebOverlayBtnLoadPuzzle && rebOverlayPuzzleSelect) {
  rebOverlayBtnLoadPuzzle.addEventListener("click", () => {
    const selectedId = rebOverlayPuzzleSelect.value;
    if (selectedId) {
      sendGameAction("loadPuzzleById", { id: selectedId });
      showToast(`🎭 Loading Rebus #${selectedId}...`);
    }
  });
}

if (rebOverlayBtnRandomPuzzle) {
  rebOverlayBtnRandomPuzzle.addEventListener("click", () => {
    if (rebCurrentFilteredPuzzles.length === 0) return;
    const chosen = rebCurrentFilteredPuzzles[Math.floor(Math.random() * rebCurrentFilteredPuzzles.length)];
    sendGameAction("loadPuzzleById", { id: chosen.id });
    showToast(`🎲 Random Rebus: ${chosen.answer}`);
  });
}

// Pre-load Rebus puzzles
fetch("/games/rebus/puzzles.json")
  .then((res) => res.json())
  .then((puzzles) => {
    if (Array.isArray(puzzles)) {
      initRebPuzzles(puzzles);
    }
  })
  .catch((err) => console.log("Note: Could not preload rebus puzzles:", err.message));

// --------------------------------------------------------------------------
// Riddle Controls (Host Studio)
// --------------------------------------------------------------------------
const ridOverlayCategoryFilter = document.getElementById("ridOverlayCategoryFilter");
const ridOverlayDifficultyFilter = document.getElementById("ridOverlayDifficultyFilter");
const ridOverlaySearchInput = document.getElementById("ridOverlaySearchInput");
const ridOverlayBtnClearSearch = document.getElementById("ridOverlayBtnClearSearch");
const ridOverlayRiddleSelect = document.getElementById("ridOverlayRiddleSelect");
const ridOverlayFilteredCountText = document.getElementById("ridOverlayFilteredCountText");
const ridOverlayCountBadge = document.getElementById("ridOverlayCountBadge");
const ridOverlayBtnLoadRiddle = document.getElementById("ridOverlayBtnLoadRiddle");
const ridOverlayBtnRandomRiddle = document.getElementById("ridOverlayBtnRandomRiddle");
const ridOverlayBtnHint = document.getElementById("ridOverlayBtnHint");
const ridOverlayBtnToggleClue = document.getElementById("ridOverlayBtnToggleClue");
const ridOverlayGraceStatusBadge = document.getElementById("ridOverlayGraceStatusBadge");
const ridOverlayGraceTimeText = document.getElementById("ridOverlayGraceTimeText");

let ridRiddles = [];
let ridCurrentFilteredRiddles = [];

function initRidRiddles(riddles) {
  if (!Array.isArray(riddles) || riddles.length === 0) return;
  ridRiddles = riddles;
  renderRidOverlayFilteredRiddles();
}

function renderRidOverlayFilteredRiddles() {
  if (!ridRiddles.length || !ridOverlayRiddleSelect) return;
  const selectedCat = ridOverlayCategoryFilter ? ridOverlayCategoryFilter.value : "ALL";
  const selectedDiff = ridOverlayDifficultyFilter ? ridOverlayDifficultyFilter.value : "ALL";
  const q = (ridOverlaySearchInput?.value || "").trim().toLowerCase();

  ridCurrentFilteredRiddles = ridRiddles.filter((r) => {
    if (selectedCat !== "ALL" && r.category !== selectedCat) return false;
    if (selectedDiff !== "ALL" && r.difficulty !== selectedDiff) return false;
    if (!q) return true;
    const a = (r.answer || "").toLowerCase();
    const rd = (r.riddle || "").toLowerCase();
    const c = (r.clue || "").toLowerCase();
    return a.includes(q) || rd.includes(q) || c.includes(q);
  });

  if (ridOverlayFilteredCountText) {
    ridOverlayFilteredCountText.textContent = `${ridCurrentFilteredRiddles.length} available`;
  }
  if (ridOverlayCountBadge) {
    ridOverlayCountBadge.textContent = selectedCat === "ALL" && selectedDiff === "ALL" && !q
      ? `${ridRiddles.length} Riddles`
      : `${ridCurrentFilteredRiddles.length} Match${ridCurrentFilteredRiddles.length === 1 ? '' : 'es'}`;
  }

  if (ridCurrentFilteredRiddles.length === 0) {
    ridOverlayRiddleSelect.innerHTML = `<option value="">No matching riddles found</option>`;
  } else {
    ridOverlayRiddleSelect.innerHTML = ridCurrentFilteredRiddles
      .slice(0, 300)
      .map((r) => `<option value="${r.id}">${r.emoji || "🧙‍♂️"} [${r.difficulty}] ${r.answer} — "${(r.riddle || '').slice(0, 40)}..."</option>`)
      .join("");
    if (currentGameState?.riddleId && ridCurrentFilteredRiddles.some((r) => r.id === currentGameState.riddleId)) {
      ridOverlayRiddleSelect.value = currentGameState.riddleId;
    }
  }

  if (ridOverlayBtnClearSearch) {
    ridOverlayBtnClearSearch.style.display = q ? "flex" : "none";
  }
}

if (ridOverlayCategoryFilter) {
  ridOverlayCategoryFilter.addEventListener("change", () => {
    renderRidOverlayFilteredRiddles();
    sendGameAction("setCategoryFilter", ridOverlayCategoryFilter.value === "ALL" ? "all" : ridOverlayCategoryFilter.value);
    showToast(`Riddle Category: ${ridOverlayCategoryFilter.value}`);
  });
}

if (ridOverlayDifficultyFilter) {
  ridOverlayDifficultyFilter.addEventListener("change", () => {
    renderRidOverlayFilteredRiddles();
    sendGameAction("setDifficultyFilter", ridOverlayDifficultyFilter.value === "ALL" ? "all" : ridOverlayDifficultyFilter.value);
    showToast(`Riddle Difficulty: ${ridOverlayDifficultyFilter.value}`);
  });
}

if (ridOverlaySearchInput) {
  ridOverlaySearchInput.addEventListener("input", () => {
    renderRidOverlayFilteredRiddles();
  });
}

if (ridOverlayBtnClearSearch) {
  ridOverlayBtnClearSearch.addEventListener("click", () => {
    if (ridOverlaySearchInput) ridOverlaySearchInput.value = "";
    renderRidOverlayFilteredRiddles();
  });
}

if (ridOverlayBtnLoadRiddle && ridOverlayRiddleSelect) {
  ridOverlayBtnLoadRiddle.addEventListener("click", () => {
    const selectedId = ridOverlayRiddleSelect.value;
    if (selectedId) {
      sendGameAction("loadRiddleById", { id: selectedId });
      showToast(`🧙‍♂️ Loading Riddle #${selectedId}...`);
    }
  });
}

if (ridOverlayBtnRandomRiddle) {
  ridOverlayBtnRandomRiddle.addEventListener("click", () => {
    if (ridCurrentFilteredRiddles.length === 0) return;
    const chosen = ridCurrentFilteredRiddles[Math.floor(Math.random() * ridCurrentFilteredRiddles.length)];
    sendGameAction("loadRiddleById", { id: chosen.id });
    showToast(`🎲 Random Riddle: ${chosen.answer}`);
  });
}

if (ridOverlayBtnHint) {
  ridOverlayBtnHint.addEventListener("click", () => {
    sendGameAction("hint");
    showToast("💡 Revealed next letter in answer!");
  });
}

if (ridOverlayBtnToggleClue) {
  ridOverlayBtnToggleClue.addEventListener("click", () => {
    sendGameAction("toggleClue");
    showToast("🔎 Toggled riddle clue visibility");
  });
}

// Pre-load Riddle puzzles
fetch("/games/riddle/riddles.json")
  .then((res) => res.json())
  .then((riddles) => {
    if (Array.isArray(riddles)) {
      initRidRiddles(riddles);
    }
  })
  .catch((err) => console.log("Note: Could not preload riddles:", err.message));


// --------------------------------------------------------------------------
// Round Flow & Game Actions
// --------------------------------------------------------------------------
btnStartRound?.addEventListener("click", () => {
  sendGameAction("startRound");
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

inputCustomTime?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnSetCustomTime?.click();
  }
});

// --------------------------------------------------------------------------
// Master Audio & Volume Controls
// --------------------------------------------------------------------------
const btnMuteAudio = document.getElementById("btnMuteAudio");
const muteBtnIcon = document.getElementById("muteBtnIcon");
const muteBtnText = document.getElementById("muteBtnText");
const sliderVolume = document.getElementById("sliderVolume");
const volumePercentText = document.getElementById("volumePercentText");
const volChips = document.querySelectorAll(".vol-chip");

let currentVolume = 100;
let currentMuted = false;

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
    if (muted) {
      volumePercentText.style.color = "#f87171";
      volumePercentText.style.borderColor = "rgba(239, 68, 68, 0.4)";
      volumePercentText.style.background = "rgba(239, 68, 68, 0.15)";
    } else {
      volumePercentText.style.color = "#d8b4fe";
      volumePercentText.style.borderColor = "rgba(168, 85, 247, 0.4)";
      volumePercentText.style.background = "rgba(168, 85, 247, 0.2)";
    }
  }

  if (btnMuteAudio) {
    btnMuteAudio.classList.toggle("is-muted", muted);
    if (muteBtnIcon) muteBtnIcon.textContent = muted ? "🔇" : "🔊";
    if (muteBtnText) muteBtnText.textContent = muted ? "MUTED" : "Sound ON";
  }

  volChips.forEach((chip) => {
    const chipVol = parseInt(chip.getAttribute("data-vol"), 10);
    const isActive = muted ? chipVol === 0 : (!muted && chipVol === vol && chipVol !== 0);
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

// Initial render from local cache
renderAudioUI(currentVolume, currentMuted);

if (sliderVolume) {
  sliderVolume.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    const shouldUnmute = currentMuted && val > 0 ? false : currentMuted;
    sendAudioUpdate(val, shouldUnmute);
  });
}

if (btnMuteAudio) {
  btnMuteAudio.addEventListener("click", () => {
    const nextMuted = !currentMuted;
    sendAudioUpdate(currentVolume, nextMuted);
    showToast(nextMuted ? "🔇 Overlay Audio Muted" : "🔊 Overlay Audio Unmuted");
  });
}

volChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const val = parseInt(chip.getAttribute("data-vol"), 10);
    if (val === 0) {
      sendAudioUpdate(currentVolume, true);
      showToast("🔇 Audio Muted");
    } else {
      sendAudioUpdate(val, false);
      showToast(`🔊 Volume set to ${val}%`);
    }
  });
});

socket.on("audioSettings", (data) => {
  if (!data) return;
  if (typeof data.volume === "number") currentVolume = data.volume;
  if (typeof data.muted === "boolean") currentMuted = !!data.muted;
  try {
    localStorage.setItem("ally_stream_volume", currentVolume);
    localStorage.setItem("ally_stream_muted", currentMuted ? "true" : "false");
  } catch (e) {}
  renderAudioUI(currentVolume, currentMuted);
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
  } else if (data.gameId === "word-finder") {
    const words = data.secretWords || data.words || [];
    const solvedCount = words.filter((w) => w.revealed).length;
    const wordsPreview = words.map((w) => `${w.word} (${w.start}→${w.end})`).join(", ");
    cheatSecretAnswer.textContent = wordsPreview || "--";
    cheatSecretAnswer.style.fontSize = "11.5px";
    cheatCategory.textContent = `${data.topic || "Word Finder"} ${data.emoji || "🔍"} (${data.category || "Puzzle"})`;
    cheatStatus.textContent = `Found ${solvedCount}/${words.length || 0} words • ${data.paused ? "Paused ⏸" : (data.isTimerActive ? "Active ▶" : "Ended 🏁")}`;
  } else if (data.gameId === "crowd-says") {
    const slots = data.secretSlots || data.slots || [];
    const solvedCount = slots.filter((s) => s.revealed).length;
    const answersPreview = slots.map((s) => `#${s.rank} ${s.text} (${s.points}p)`).join(", ");
    cheatSecretAnswer.textContent = answersPreview || "--";
    cheatSecretAnswer.style.fontSize = "11.5px";
    cheatCategory.textContent = `${data.icon || "📣"} "${data.question || "Survey"}" (${data.category || "General"})`;
    cheatStatus.textContent = `Found ${solvedCount}/${slots.length || 5} • ${data.paused ? "Paused ⏸" : (data.isTimerActive ? "Guessing Active ▶" : "Ended 🏁")}`;
  } else if (data.gameId === "unscramble") {
    const word = data.secretWord || data.word || "--";
    const scrambled = Array.isArray(data.scrambled) ? data.scrambled.join(" ") : (data.scrambled || "--");
    const isSolved = !!data.solved;
    cheatSecretAnswer.textContent = `${word.toUpperCase()} (Scrambled: ${scrambled})`;
    cheatSecretAnswer.style.fontSize = "13px";
    cheatCategory.textContent = `${data.emoji || "🔤"} ${data.topic || "Word"} (${data.category || "General"} • ${data.length || word.length} Letters)`;
    cheatStatus.textContent = isSolved
      ? `Solved by @${data.lastWinner?.name || data.lastWinner?.username || "Player"}! 🎉`
      : (data.paused ? "Paused ⏸" : (data.isTimerActive ? "Guessing Active ▶" : "Ended 🏁"));
  } else if (data.gameId === "rebus") {
    const ans = data.secretAnswer || data.answer || "--";
    cheatSecretAnswer.textContent = ans;
    cheatSecretAnswer.style.fontSize = "14px";
    cheatCategory.textContent = `${data.emoji || "🎭"} ${data.category || "General"} [${data.difficulty || "Medium"} • ${data.layout || "Layout"}] — Clue: "${data.secretHint || data.hintClue || "Visual wordplay"}"`;
    cheatStatus.textContent = data.isRevealed
      ? `Answer Revealed 👁️`
      : (data.paused ? "Paused ⏸" : (data.isTimerActive ? "Guessing Active ▶" : "Ended 🏁"));
  } else if (data.gameId === "riddle") {
    const ans = data.secretAnswer || data.answer || "--";
    cheatSecretAnswer.textContent = ans;
    cheatSecretAnswer.style.fontSize = "14px";
    const clueText = data.secretClue || data.clue || "No clue";
    cheatCategory.textContent = `${data.emoji || "🧙‍♂️"} [${data.difficulty || "Medium"}] ${data.category || "Classic"} — Clue: "${clueText}"`;
    if (data.gracePeriodActive) {
      cheatStatus.textContent = `⚡ SPEED RUN ACTIVE (${data.graceRemainingSec || 0}s left for +50pts bonus!)`;
    } else if (data.isRevealed) {
      const winCount = Array.isArray(data.winners) ? data.winners.length : 0;
      cheatStatus.textContent = `Solved by ${winCount} player${winCount === 1 ? '' : 's'} 🏆`;
    } else {
      cheatStatus.textContent = data.paused ? "Paused ⏸" : (data.isTimerActive ? "Guessing Active ▶" : "Ended 🏁");
    }
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

  if (data.audioSettings) {
    if (typeof data.audioSettings.volume === "number") currentVolume = data.audioSettings.volume;
    if (typeof data.audioSettings.muted === "boolean") currentMuted = !!data.audioSettings.muted;
    try {
      localStorage.setItem("ally_stream_volume", currentVolume);
      localStorage.setItem("ally_stream_muted", currentMuted ? "true" : "false");
    } catch (e) {}
    renderAudioUI(currentVolume, currentMuted);
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

  // Sync Controls for Word Finder
  if (data.gameId === "word-finder") {
    if (Array.isArray(data.puzzles) && data.puzzles.length > 0 && wfPuzzles.length === 0) {
      initWfPuzzles(data.puzzles);
    }
    if (data.activeCategoryFilter && wfOverlayCategoryFilter && document.activeElement !== wfOverlayCategoryFilter) {
      if (wfOverlayCategoryFilter.value !== data.activeCategoryFilter) {
        wfOverlayCategoryFilter.value = data.activeCategoryFilter;
        renderWfOverlayFilteredPuzzles();
      }
    }
    if (data.puzzleId && wfOverlayPuzzleSelect && document.activeElement !== wfOverlayPuzzleSelect) {
      if (wfOverlayPuzzleSelect.value !== data.puzzleId) {
        wfOverlayPuzzleSelect.value = data.puzzleId;
      }
    }
    if (data.gridSize && wfOverlayGridSize && document.activeElement !== wfOverlayGridSize) {
      if (String(wfOverlayGridSize.value) !== String(data.gridSize)) {
        wfOverlayGridSize.value = String(data.gridSize);
      }
    }
  }

  // Sync Controls for Think Like Ally
  if (data.gameId === "think-like-ally" || data.activeGameId === "think-like-ally") {
    const tlaOverlayPackSelect = document.getElementById("tlaOverlayPackSelect");
    const tlaOverlayActivePackText = document.getElementById("tlaOverlayActivePackText");
    const tlaOverlayPackCountBadge = document.getElementById("tlaOverlayPackCountBadge");

    if (tlaOverlayActivePackText && data.currentSetName) {
      tlaOverlayActivePackText.textContent = data.currentSetName;
    }

    if (tlaOverlayPackSelect && Array.isArray(data.questionSets)) {
      const activeId = data.currentSetId || (data.questionSets[0]?.id || "");
      if (tlaOverlayPackCountBadge) {
        const currentSet = data.questionSets.find((s) => s.id === activeId);
        tlaOverlayPackCountBadge.textContent = `${currentSet ? currentSet.count : 0} Questions`;
      }

      tlaOverlayPackSelect.innerHTML = data.questionSets
        .map((s) => `<option value="${s.id}">${s.isCustom ? "⭐ " : "📖 "}${s.name} (${s.count} questions)</option>`)
        .join("");
      tlaOverlayPackSelect.value = activeId;
    }
  }

  // Sync Controls for Chat Feud
  if (data.gameId === "crowd-says" || data.activeGameId === "crowd-says") {
    const csOverlayQuestionSelect = document.getElementById("csOverlayQuestionSelect");
    const csOverlayFoundProgressText = document.getElementById("csOverlayFoundProgressText");
    const csOverlayQuestionsCountBadge = document.getElementById("csOverlayQuestionsCountBadge");

    if (csOverlayFoundProgressText) {
      csOverlayFoundProgressText.textContent = `${data.foundCount || 0}/${data.totalSlots || 5} Found`;
    }

    if (csOverlayQuestionSelect && Array.isArray(data.questions)) {
      if (csOverlayQuestionsCountBadge) {
        csOverlayQuestionsCountBadge.textContent = `${data.questions.length} Surveys`;
      }
      csOverlayQuestionSelect.innerHTML = data.questions
        .map((q) => `<option value="${q.id}">${q.icon || "📣"} ${q.question} (${q.answerCount || 5} answers)</option>`)
        .join("");
      if (data.questionId) {
        csOverlayQuestionSelect.value = data.questionId;
      }
    }
  }

  // Sync Controls for Unscramble
  if (data.gameId === "unscramble" || data.activeGameId === "unscramble") {
    const uOverlayLengthFilter = document.getElementById("uOverlayLengthFilter");
    const uOverlayWordSelect = document.getElementById("uOverlayWordSelect");

    if (Array.isArray(data.words) && data.words.length > 0 && uWords.length === 0) {
      initUWords(data.words);
    }
    if (data.lengthFilter && uOverlayLengthFilter && document.activeElement !== uOverlayLengthFilter) {
      if (String(uOverlayLengthFilter.value) !== String(data.lengthFilter)) {
        uOverlayLengthFilter.value = String(data.lengthFilter);
        renderUOverlayFilteredWords();
      }
    }
    if (data.wordId && uOverlayWordSelect && document.activeElement !== uOverlayWordSelect) {
      if (uOverlayWordSelect.value !== data.wordId) {
        uOverlayWordSelect.value = data.wordId;
      }
    }
  }

  // Sync Controls for Rebus
  if (data.gameId === "rebus" || data.activeGameId === "rebus") {
    const rebOverlayCategoryFilter = document.getElementById("rebOverlayCategoryFilter");
    const rebOverlayDifficultyFilter = document.getElementById("rebOverlayDifficultyFilter");
    const rebOverlayPuzzleSelect = document.getElementById("rebOverlayPuzzleSelect");

    if (Array.isArray(data.puzzlesListPreview) && rebPuzzles.length === 0) {
      initRebPuzzles(data.puzzlesListPreview);
    }
    if (data.categoryFilter && rebOverlayCategoryFilter && document.activeElement !== rebOverlayCategoryFilter) {
      const val = data.categoryFilter === "all" ? "ALL" : data.categoryFilter;
      if (rebOverlayCategoryFilter.value !== val) {
        rebOverlayCategoryFilter.value = val;
        renderRebOverlayFilteredPuzzles();
      }
    }
    if (data.difficultyFilter && rebOverlayDifficultyFilter && document.activeElement !== rebOverlayDifficultyFilter) {
      const val = data.difficultyFilter === "all" ? "ALL" : data.difficultyFilter;
      if (rebOverlayDifficultyFilter.value !== val) {
        rebOverlayDifficultyFilter.value = val;
        renderRebOverlayFilteredPuzzles();
      }
    }
    if (data.puzzleId && rebOverlayPuzzleSelect && document.activeElement !== rebOverlayPuzzleSelect) {
      if (rebOverlayPuzzleSelect.value !== data.puzzleId) {
        rebOverlayPuzzleSelect.value = data.puzzleId;
      }
    }
  }

  // Sync Controls for Riddle
  if (data.gameId === "riddle" || data.activeGameId === "riddle") {
    const ridOverlayCategoryFilter = document.getElementById("ridOverlayCategoryFilter");
    const ridOverlayDifficultyFilter = document.getElementById("ridOverlayDifficultyFilter");
    const ridOverlayRiddleSelect = document.getElementById("ridOverlayRiddleSelect");
    const ridOverlayGraceStatusBadge = document.getElementById("ridOverlayGraceStatusBadge");
    const ridOverlayGraceTimeText = document.getElementById("ridOverlayGraceTimeText");

    if (Array.isArray(data.riddlesListPreview) && ridRiddles.length === 0) {
      initRidRiddles(data.riddlesListPreview);
    }
    if (data.categoryFilter && ridOverlayCategoryFilter && document.activeElement !== ridOverlayCategoryFilter) {
      const val = data.categoryFilter === "all" ? "ALL" : data.categoryFilter;
      if (ridOverlayCategoryFilter.value !== val) {
        ridOverlayCategoryFilter.value = val;
        renderRidOverlayFilteredRiddles();
      }
    }
    if (data.difficultyFilter && ridOverlayDifficultyFilter && document.activeElement !== ridOverlayDifficultyFilter) {
      const val = data.difficultyFilter === "all" ? "ALL" : data.difficultyFilter;
      if (ridOverlayDifficultyFilter.value !== val) {
        ridOverlayDifficultyFilter.value = val;
        renderRidOverlayFilteredRiddles();
      }
    }
    if (data.riddleId && ridOverlayRiddleSelect && document.activeElement !== ridOverlayRiddleSelect) {
      if (ridOverlayRiddleSelect.value !== data.riddleId) {
        ridOverlayRiddleSelect.value = data.riddleId;
      }
    }
    if (ridOverlayGraceStatusBadge && ridOverlayGraceTimeText) {
      if (data.gracePeriodActive) {
        ridOverlayGraceStatusBadge.style.display = "flex";
        ridOverlayGraceTimeText.textContent = `${data.graceRemainingSec || 0}s (50 PTS Bonus)`;
      } else {
        ridOverlayGraceStatusBadge.style.display = "none";
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

// Register Service Worker for PWA Standalone Mode
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW registration error:", err));
  });
}

