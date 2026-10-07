// games/rebus/controls.js (ESM)
export function initRebusControls({ socket, showToast }) {
  let allPuzzles = [];
  let filteredPuzzles = [];
  let selectedCategory = "all";
  let selectedDifficulty = "all";
  let searchQuery = "";

  // Cheat Sheet Elements
  const hostAnswer = document.getElementById("rebHostAnswer");
  const hostCategory = document.getElementById("rebHostCategory");
  const hostDifficulty = document.getElementById("rebHostDifficulty");
  const hostLayout = document.getElementById("rebHostLayout");
  const hostHint = document.getElementById("rebHostHint");
  const hostAcceptable = document.getElementById("rebHostAcceptable");

  // Flow Buttons
  const btnStartTimer = document.getElementById("rebBtnStartTimer");
  const btnPauseTimer = document.getElementById("rebBtnPauseTimer");
  const btnNextRound = document.getElementById("rebBtnNextRound");
  const btnPrevRound = document.getElementById("rebBtnPrevRound");
  const btnRandomRound = document.getElementById("rebBtnRandomRound");
  const btnHint = document.getElementById("rebBtnHint");
  const btnReveal = document.getElementById("rebBtnReveal");
  const btnHostHint = document.getElementById("rebBtnHostHint");
  const btnHostReveal = document.getElementById("rebBtnHostReveal");
  const btnResetGame = document.getElementById("rebBtnResetGame");

  // Timer Presets
  const presetRow = document.getElementById("rebPresetRow");
  const customSecInput = document.getElementById("rebCustomSecInput");
  const btnSetCustomSec = document.getElementById("rebBtnSetCustomSec");

  // Catalog Elements
  const puzzlesCountBadge = document.getElementById("rebPuzzlesCountBadge");
  const categoryFilterRow = document.getElementById("rebCategoryFilterRow");
  const difficultyFilterRow = document.getElementById("rebDifficultyFilterRow");
  const searchInput = document.getElementById("rebSearchInput");
  const btnClearSearch = document.getElementById("rebBtnClearSearch");
  const filteredCountText = document.getElementById("rebFilteredCountText");
  const puzzleSelect = document.getElementById("rebPuzzleSelect");
  const btnLoadPuzzle = document.getElementById("rebBtnLoadPuzzle");
  const btnRandomFromFilter = document.getElementById("rebBtnRandomFromFilter");

  // Sim Elements
  const simInput = document.getElementById("rebSimInput");
  const btnSimGuess = document.getElementById("rebBtnSimGuess");
  const simResult = document.getElementById("rebSimResult");

  function sendAction(action, options = {}) {
    if (!socket) return;
    socket.emit("gameAction", {
      gameId: "rebus",
      action,
      options
    });
  }

  // Pre-load puzzles.json
  fetch("/games/rebus/puzzles.json")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) {
        allPuzzles = data;
        if (puzzlesCountBadge) {
          puzzlesCountBadge.textContent = `${allPuzzles.length.toLocaleString()} Puzzles`;
        }
        applyFilters();
      }
    })
    .catch((err) => {
      console.warn("[Rebus Controls] Could not load puzzles.json:", err.message);
    });

  function applyFilters() {
    filteredPuzzles = allPuzzles.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
      if (selectedDifficulty !== "all" && p.difficulty !== selectedDifficulty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const a = (p.answer || "").toLowerCase();
        const h = (p.hint || "").toLowerCase();
        const l = (p.layout || "").toLowerCase();
        if (!a.includes(q) && !h.includes(q) && !l.includes(q)) return false;
      }
      return true;
    });

    if (filteredCountText) {
      filteredCountText.textContent = `${filteredPuzzles.length.toLocaleString()} available`;
    }

    if (puzzleSelect) {
      if (filteredPuzzles.length === 0) {
        puzzleSelect.innerHTML = `<option value="">No matching puzzles found</option>`;
      } else {
        puzzleSelect.innerHTML = filteredPuzzles.slice(0, 300).map((p) => `
          <option value="${p.id}">
            ${p.emoji || "🎭"} [${p.difficulty}] ${p.answer} (${p.category} • ${p.layout})
          </option>
        `).join("");
      }
    }
  }

  // Category filter chips
  if (categoryFilterRow) {
    categoryFilterRow.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        categoryFilterRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        selectedCategory = chip.dataset.cat || "all";
        applyFilters();
        sendAction("setCategoryFilter", { category: selectedCategory });
      });
    });
  }

  // Difficulty filter chips
  if (difficultyFilterRow) {
    difficultyFilterRow.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        difficultyFilterRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        selectedDifficulty = chip.dataset.diff || "all";
        applyFilters();
        sendAction("setDifficultyFilter", { difficulty: selectedDifficulty });
      });
    });
  }

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim();
      if (btnClearSearch) {
        btnClearSearch.style.display = searchQuery ? "inline-flex" : "none";
      }
      applyFilters();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      searchQuery = "";
      btnClearSearch.style.display = "none";
      applyFilters();
    });
  }

  // Load selected puzzle
  if (btnLoadPuzzle) {
    btnLoadPuzzle.addEventListener("click", () => {
      const id = puzzleSelect?.value;
      if (!id) return;
      sendAction("loadPuzzleById", { id });
      showToast?.(`Loaded puzzle: ${id}`);
    });
  }

  // Pick random puzzle from filter
  if (btnRandomFromFilter) {
    btnRandomFromFilter.addEventListener("click", () => {
      if (filteredPuzzles.length === 0) return;
      const chosen = filteredPuzzles[Math.floor(Math.random() * filteredPuzzles.length)];
      sendAction("loadPuzzleById", { id: chosen.id });
      showToast?.(`Loaded random: ${chosen.answer}`);
    });
  }

  // Flow button event handlers
  if (btnStartTimer) btnStartTimer.addEventListener("click", () => sendAction("startTimer"));
  if (btnPauseTimer) btnPauseTimer.addEventListener("click", () => sendAction("togglePause"));
  if (btnNextRound) btnNextRound.addEventListener("click", () => sendAction("newRound"));
  if (btnPrevRound) btnPrevRound.addEventListener("click", () => sendAction("prevRound"));
  if (btnRandomRound) btnRandomRound.addEventListener("click", () => sendAction("newRound"));
  if (btnHint) btnHint.addEventListener("click", () => sendAction("hint"));
  if (btnReveal) btnReveal.addEventListener("click", () => sendAction("reveal"));
  if (btnHostHint) btnHostHint.addEventListener("click", () => sendAction("hint"));
  if (btnHostReveal) btnHostReveal.addEventListener("click", () => sendAction("reveal"));
  if (btnResetGame) {
    btnResetGame.addEventListener("click", () => {
      if (confirm("Reset current game session and scores?")) {
        sendAction("resetGame");
        showToast?.("Game session reset");
      }
    });
  }

  // Timer Presets
  if (presetRow) {
    presetRow.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        presetRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const sec = parseInt(chip.dataset.sec, 10);
        if (sec) {
          sendAction("setTime", { sec });
          showToast?.(`Timer set to ${sec}s`);
        }
      });
    });
  }

  if (btnSetCustomSec && customSecInput) {
    btnSetCustomSec.addEventListener("click", () => {
      const val = parseInt(customSecInput.value, 10);
      if (val && val >= 10 && val <= 300) {
        sendAction("setTime", { sec: val });
        showToast?.(`Custom timer set to ${val}s`);
      }
    });
  }

  // Chat Guess Simulator
  if (btnSimGuess && simInput) {
    btnSimGuess.addEventListener("click", () => {
      const text = simInput.value.trim();
      if (!text) return;
      socket?.emit("chatMessage", {
        username: "host_tester",
        nickname: "HostTester",
        text,
        avatar: "/ally-avatar.png"
      });
      if (simResult) {
        simResult.textContent = `Sent guess: "${text}"`;
        simResult.style.color = "#c084fc";
      }
      simInput.value = "";
    });
  }

  // Live state updates for cheat sheet
  function onStateUpdate(state) {
    if (!state) return;

    if (hostAnswer) {
      hostAnswer.textContent = state.secretAnswer || state.answer || "--";
    }
    if (hostCategory) {
      hostCategory.textContent = state.category || "--";
    }
    if (hostDifficulty) {
      hostDifficulty.textContent = state.difficulty || "--";
    }
    if (hostLayout) {
      hostLayout.textContent = state.layout || "--";
    }
    if (hostHint) {
      hostHint.textContent = state.secretHint || state.hintClue || "--";
    }
    if (hostAcceptable) {
      const acc = state.acceptableAnswers || [];
      hostAcceptable.textContent = acc.length > 0 ? acc.join(", ") : "None";
    }

    if (state.puzzleId && puzzleSelect && !searchQuery) {
      // Sync dropdown value if not currently filtering
      if (puzzleSelect.value !== state.puzzleId) {
        puzzleSelect.value = state.puzzleId;
      }
    }
  }

  return {
    onStateUpdate
  };
}
