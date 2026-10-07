// games/riddle/controls.js (ESM)
export function initRiddleControls({ socket, showToast }) {
  let allRiddles = [];
  let filteredRiddles = [];
  let selectedCategory = "all";
  let selectedDifficulty = "all";
  let searchQuery = "";

  // Cheat Sheet Elements
  const hostAnswer = document.getElementById("ridHostAnswer");
  const hostCategory = document.getElementById("ridHostCategory");
  const hostDifficulty = document.getElementById("ridHostDifficulty");
  const hostQuestion = document.getElementById("ridHostQuestion");
  const hostHint = document.getElementById("ridHostHint");
  const hostGraceStatus = document.getElementById("ridHostGraceStatus");
  const hostGraceDetails = document.getElementById("ridHostGraceDetails");

  // Buttons
  const btnStartTimer = document.getElementById("ridBtnStartTimer");
  const btnPauseTimer = document.getElementById("ridBtnPauseTimer");
  const btnNextRound = document.getElementById("ridBtnNextRound");
  const btnPrevRound = document.getElementById("ridBtnPrevRound");
  const btnRandomRound = document.getElementById("ridBtnRandomRound");
  const btnHint = document.getElementById("ridBtnHint");
  const btnToggleClue = document.getElementById("ridBtnToggleClue");
  const btnReveal = document.getElementById("ridBtnReveal");
  const btnHostHint = document.getElementById("ridBtnHostHint");
  const btnHostReveal = document.getElementById("ridBtnHostReveal");
  const btnResetGame = document.getElementById("ridBtnResetGame");

  // Presets
  const btnTime30 = document.getElementById("ridBtnTime30");
  const btnTime45 = document.getElementById("ridBtnTime45");
  const btnTime60 = document.getElementById("ridBtnTime60");
  const btnTimePlus10 = document.getElementById("ridBtnTimePlus10");
  const btnTimeMinus10 = document.getElementById("ridBtnTimeMinus10");

  // Filters & Selector
  const categoryFilter = document.getElementById("ridCategoryFilter");
  const difficultyFilter = document.getElementById("ridDifficultyFilter");
  const searchInput = document.getElementById("ridSearchInput");
  const btnClearSearch = document.getElementById("ridBtnClearSearch");
  const riddleSelect = document.getElementById("ridSelect");
  const btnLoadRiddle = document.getElementById("ridBtnLoadRiddle");
  const countBadge = document.getElementById("ridCountBadge");

  function sendAction(action, options = {}) {
    if (!socket) return;
    socket.emit("gameAction", {
      gameId: "riddle",
      action,
      options
    });
  }

  // Pre-load riddles
  fetch("/games/riddle/riddles.json")
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data)) {
        allRiddles = data;
        renderFilteredRiddles();
      }
    })
    .catch((err) => console.log("[RiddleControls] Note: Could not preload riddles.json:", err.message));

  function renderFilteredRiddles() {
    if (!allRiddles.length || !riddleSelect) return;
    const cat = categoryFilter ? categoryFilter.value : "all";
    const diff = difficultyFilter ? difficultyFilter.value : "all";
    const q = (searchInput?.value || "").trim().toLowerCase();

    filteredRiddles = allRiddles.filter((rd) => {
      if (cat !== "all" && rd.category !== cat) return false;
      if (diff !== "all" && rd.difficulty !== diff) return false;
      if (!q) return true;
      const ans = (rd.answer || "").toLowerCase();
      const txt = (rd.riddle || "").toLowerCase();
      const hnt = (rd.hint || "").toLowerCase();
      return ans.includes(q) || txt.includes(q) || hnt.includes(q);
    });

    if (countBadge) {
      countBadge.textContent = cat === "all" && diff === "all" && !q
        ? `${allRiddles.length} Riddles`
        : `${filteredRiddles.length} Match${filteredRiddles.length === 1 ? '' : 'es'}`;
    }

    if (filteredRiddles.length === 0) {
      riddleSelect.innerHTML = `<option value="">No matching riddles found</option>`;
    } else {
      riddleSelect.innerHTML = filteredRiddles
        .slice(0, 300)
        .map((rd) => `<option value="${rd.id}">${rd.emoji || "🧙‍♂️"} [${rd.difficulty}] ${rd.answer} — "${rd.riddle.slice(0, 45)}..."</option>`)
        .join("");
    }

    if (btnClearSearch) {
      btnClearSearch.style.display = q ? "block" : "none";
    }
  }

  // Filter Listeners
  categoryFilter?.addEventListener("change", () => {
    selectedCategory = categoryFilter.value;
    renderFilteredRiddles();
    sendAction("setCategoryFilter", selectedCategory);
    if (showToast) showToast(`Category: ${selectedCategory}`);
  });

  difficultyFilter?.addEventListener("change", () => {
    selectedDifficulty = difficultyFilter.value;
    renderFilteredRiddles();
    sendAction("setDifficultyFilter", selectedDifficulty);
    if (showToast) showToast(`Difficulty: ${selectedDifficulty}`);
  });

  searchInput?.addEventListener("input", () => {
    renderFilteredRiddles();
  });

  btnClearSearch?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    renderFilteredRiddles();
  });

  btnLoadRiddle?.addEventListener("click", () => {
    const id = riddleSelect?.value;
    if (id) {
      sendAction("loadRiddleById", { id });
      if (showToast) showToast(`🧙‍♂️ Loading Riddle #${id}...`);
    }
  });

  // Action Buttons
  btnStartTimer?.addEventListener("click", () => {
    sendAction("startTimer");
    if (showToast) showToast("▶ Timer Started!");
  });

  btnPauseTimer?.addEventListener("click", () => {
    sendAction("stopTimer");
    if (showToast) showToast("⏸ Timer Paused");
  });

  btnNextRound?.addEventListener("click", () => {
    sendAction("nextRound");
    if (showToast) showToast("⏭ Next Riddle");
  });

  btnPrevRound?.addEventListener("click", () => {
    sendAction("prevRound");
    if (showToast) showToast("⏮ Prev Riddle");
  });

  btnRandomRound?.addEventListener("click", () => {
    sendAction("newRound");
    if (showToast) showToast("🎲 Random Riddle");
  });

  btnHint?.addEventListener("click", () => {
    sendAction("hint");
    if (showToast) showToast("💡 Letter / Clue Hint Triggered");
  });

  btnHostHint?.addEventListener("click", () => {
    sendAction("hint");
    if (showToast) showToast("💡 Letter / Clue Hint Triggered");
  });

  btnToggleClue?.addEventListener("click", () => {
    sendAction("toggleClue");
    if (showToast) showToast("🧩 Toggled Clue Banner");
  });

  btnReveal?.addEventListener("click", () => {
    if (confirm("Are you sure you want to reveal the answer to chat?")) {
      sendAction("revealAnswer");
      if (showToast) showToast("👁 Answer Revealed!");
    }
  });

  btnHostReveal?.addEventListener("click", () => {
    if (confirm("Are you sure you want to reveal the answer to chat?")) {
      sendAction("revealAnswer");
      if (showToast) showToast("👁 Answer Revealed!");
    }
  });

  btnResetGame?.addEventListener("click", () => {
    if (confirm("Reset game score, streaks, and return to Round 1?")) {
      sendAction("resetGame");
      if (showToast) showToast("🔄 Game Reset");
    }
  });

  // Presets
  btnTime30?.addEventListener("click", () => {
    sendAction("setTime", { sec: 30 });
    if (showToast) showToast("⏱ Timer: 30s");
  });

  btnTime45?.addEventListener("click", () => {
    sendAction("setTime", { sec: 45 });
    if (showToast) showToast("⏱ Timer: 45s");
  });

  btnTime60?.addEventListener("click", () => {
    sendAction("setTime", { sec: 60 });
    if (showToast) showToast("⏱ Timer: 60s");
  });

  btnTimePlus10?.addEventListener("click", () => {
    sendAction("adjustTime", { delta: 10 });
    if (showToast) showToast("➕ +10 seconds added");
  });

  btnTimeMinus10?.addEventListener("click", () => {
    sendAction("adjustTime", { delta: -10 });
    if (showToast) showToast("➖ -10 seconds subtracted");
  });

  // State Listener (Updates Cheat Sheet)
  function updateCheatSheet(state) {
    if (!state || (state.gameId && state.gameId !== "riddle")) return;

    if (hostAnswer) hostAnswer.textContent = (state.secretAnswer || "--").toUpperCase();
    if (hostCategory) hostCategory.textContent = state.category || "Classic Riddles";
    if (hostDifficulty) hostDifficulty.textContent = state.difficulty || "Easy";
    if (hostQuestion) hostQuestion.textContent = state.riddle || "--";
    if (hostHint) hostHint.textContent = state.secretHint || "No clue available";

    if (hostGraceStatus && hostGraceDetails) {
      if (state.gracePeriodActive && state.graceRemainingSec > 0) {
        hostGraceStatus.style.display = "block";
        const winnerList = (state.winners || []).map((w) => `@${w.nickname || w.user}`).join(", ");
        hostGraceDetails.textContent = `${state.graceRemainingSec}s left! Current winners: ${winnerList || 'None yet'}`;
      } else {
        hostGraceStatus.style.display = "none";
      }
    }

    if (riddleSelect && state.riddleId && document.activeElement !== riddleSelect) {
      if (riddleSelect.value !== state.riddleId) {
        riddleSelect.value = state.riddleId;
      }
    }
  }

  socket.on("gameState", (state) => {
    updateCheatSheet(state);
  });

  socket.on("gameAction", (data) => {
    if (data && (data.gameId === "riddle" || !data.gameId)) {
      updateCheatSheet(data.state || data);
    }
  });

  return {
    onStateUpdate: updateCheatSheet,
    updateCheatSheet
  };
}

export const initControls = initRiddleControls;
export default initRiddleControls;
