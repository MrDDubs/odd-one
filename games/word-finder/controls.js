// games/word-finder/controls.js
export function initWordFinderControls({ socket, showToast }) {
  const wfTopicDisplay = document.getElementById("wfTopicDisplay");
  const wfCategoryDisplay = document.getElementById("wfCategoryDisplay");
  const wfTimerText = document.getElementById("wfTimerText");
  const wfStreakText = document.getElementById("wfStreakText");
  const wfFoundCountText = document.getElementById("wfFoundCountText");
  const wfSecretWordsGrid = document.getElementById("wfSecretWordsGrid");

  const wfBtnStartTimer = document.getElementById("wfBtnStartTimer");
  const wfBtnPauseTimer = document.getElementById("wfBtnPauseTimer");
  const wfBtnHint = document.getElementById("wfBtnHint");
  const wfBtnRevealAll = document.getElementById("wfBtnRevealAll");
  const wfBtnHideUnsolved = document.getElementById("wfBtnHideUnsolved");
  const wfBtnNextPuzzle = document.getElementById("wfBtnNextPuzzle");
  const wfBtnResetGame = document.getElementById("wfBtnResetGame");

  const wfPuzzleSelect = document.getElementById("wfPuzzleSelect");
  const wfCategoryFilter = document.getElementById("wfCategoryFilter");
  const wfSearchInput = document.getElementById("wfSearchInput");
  const wfBtnClearSearch = document.getElementById("wfBtnClearSearch");
  const wfPuzzleCountBadge = document.getElementById("wfPuzzleCountBadge");
  const wfFilteredCountText = document.getElementById("wfFilteredCountText");
  const wfBtnLoadPuzzle = document.getElementById("wfBtnLoadPuzzle");
  const wfBtnRandomPuzzle = document.getElementById("wfBtnRandomPuzzle");

  let localState = null;
  let categoriesInitialized = false;
  let currentFilteredPuzzles = [];

  function emitAction(action, options = {}) {
    socket.emit("gameAction", {
      gameId: "word-finder",
      action,
      options
    });
  }

  // Bind Buttons
  wfBtnStartTimer?.addEventListener("click", () => {
    emitAction("startTimer");
    showToast?.("▶ Word Finder Timer started");
  });

  wfBtnPauseTimer?.addEventListener("click", () => {
    emitAction("stopTimer");
    showToast?.("⏸ Timer paused");
  });

  wfBtnHint?.addEventListener("click", () => {
    emitAction("hint");
    showToast?.("💡 Hint given to chat");
  });

  wfBtnRevealAll?.addEventListener("click", () => {
    emitAction("reveal");
    showToast?.("👁 All words revealed");
  });

  wfBtnHideUnsolved?.addEventListener("click", () => {
    emitAction("hideAnswer");
    showToast?.("🙈 Unsolved words hidden");
  });

  wfBtnNextPuzzle?.addEventListener("click", () => {
    emitAction("nextRound");
    showToast?.("⏭ Loading next puzzle");
  });

  wfBtnResetGame?.addEventListener("click", () => {
    if (confirm("Reset Word Finder game?")) {
      emitAction("resetGame");
      showToast?.("🔄 Word Finder reset");
    }
  });

  // Category Filtering & Search
  function renderFilteredPuzzles() {
    if (!localState || !Array.isArray(localState.puzzles) || !wfPuzzleSelect) return;

    const selectedCat = wfCategoryFilter ? wfCategoryFilter.value : "ALL";
    const q = (wfSearchInput?.value || "").trim().toLowerCase();

    currentFilteredPuzzles = localState.puzzles.filter((p) => {
      if (selectedCat !== "ALL" && p.category !== selectedCat) return false;
      if (!q) return true;
      const topicMatch = (p.topic || "").toLowerCase().includes(q);
      const catMatch = (p.category || "").toLowerCase().includes(q);
      return topicMatch || catMatch;
    });

    if (wfFilteredCountText) {
      wfFilteredCountText.textContent = `${currentFilteredPuzzles.length} available`;
    }

    if (wfPuzzleCountBadge) {
      wfPuzzleCountBadge.textContent = selectedCat === "ALL" && !q
        ? `${localState.puzzles.length} Puzzles`
        : `${currentFilteredPuzzles.length} Match${currentFilteredPuzzles.length === 1 ? '' : 'es'}`;
    }

    if (currentFilteredPuzzles.length === 0) {
      wfPuzzleSelect.innerHTML = `<option value="">No matching puzzles</option>`;
    } else {
      wfPuzzleSelect.innerHTML = currentFilteredPuzzles
        .map((p) => `<option value="${p.id}" ${p.id === localState.puzzleId ? "selected" : ""}>${p.emoji || "🔍"} ${p.topic} — [${p.category}] (${p.wordCount || 6} words)</option>`)
        .join("");
    }
  }

  function initCategories(puzzles) {
    if (!Array.isArray(puzzles) || puzzles.length === 0 || !wfCategoryFilter) return;
    const counts = new Map();
    puzzles.forEach((p) => {
      const cat = p.category || "General";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const sortedCats = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    let opts = `<option value="ALL">🌟 All Categories (${puzzles.length})</option>`;
    sortedCats.forEach(([cat, count]) => {
      opts += `<option value="${cat}">📁 ${cat} (${count})</option>`;
    });

    wfCategoryFilter.innerHTML = opts;
    categoriesInitialized = true;
  }

  wfCategoryFilter?.addEventListener("change", () => {
    renderFilteredPuzzles();
  });

  wfSearchInput?.addEventListener("input", () => {
    if (wfBtnClearSearch) {
      wfBtnClearSearch.style.display = wfSearchInput.value ? "flex" : "none";
    }
    renderFilteredPuzzles();
  });

  wfBtnClearSearch?.addEventListener("click", () => {
    if (wfSearchInput) {
      wfSearchInput.value = "";
      wfBtnClearSearch.style.display = "none";
      renderFilteredPuzzles();
    }
  });

  wfBtnLoadPuzzle?.addEventListener("click", () => {
    const selectedId = wfPuzzleSelect?.value;
    if (selectedId) {
      emitAction("loadPuzzleById", { id: selectedId });
      showToast?.(`📚 Loading puzzle: ${selectedId}`);
    }
  });

  wfBtnRandomPuzzle?.addEventListener("click", () => {
    const selectedCat = wfCategoryFilter?.value || "ALL";
    emitAction("newRound", { category: selectedCat });
    showToast?.(`🎲 Random topic from ${selectedCat}`);
  });

  // Render Host Secret Cheat Sheet Words
  function renderSecretWords(words) {
    if (!wfSecretWordsGrid || !Array.isArray(words)) return;

    wfSecretWordsGrid.innerHTML = words.map((w, idx) => {
      const isFound = !!w.revealed;
      const solver = isFound
        ? `<div style="font-size:10px;color:#10b981;font-weight:800;margin-top:2px">✓ ${w.foundBy?.nickname ? `@${w.foundBy.nickname}` : "FOUND"}</div>`
        : `<div style="font-size:10px;color:#cbd5e1;margin-top:2px">${w.start} → ${w.end} (${w.direction})</div>`;

      return `
        <div style="background:${isFound ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.06)"}; border:1.5px solid ${isFound ? "#10b981" : (w.color || "#a855f7")}; border-radius:8px; padding:6px 8px; cursor:pointer;" title="Click to manually reveal/hide" data-idx="${idx}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12px;color:${isFound ? "#10b981" : "#fff"}">${w.word}</strong>
            <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:${isFound ? "#10b981" : "#6366f1"};color:#fff;font-weight:800">${isFound ? "SOLVED" : "SECRET"}</span>
          </div>
          ${solver}
        </div>
      `;
    }).join("");

    wfSecretWordsGrid.querySelectorAll("[data-idx]").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = card.getAttribute("data-idx");
        emitAction("revealWord", idx);
        showToast?.(`Toggled word #${idx}`);
      });
    });
  }

  // Update State Handler
  function updateUI(state) {
    if (!state || state.gameId !== "word-finder") return;
    localState = state;

    if (wfTopicDisplay) wfTopicDisplay.textContent = `${state.topic || "PETS"} ${state.emoji || "🐶"}`;
    if (wfCategoryDisplay) wfCategoryDisplay.textContent = `Category: ${state.category || "General"}`;
    if (wfTimerText) wfTimerText.textContent = `${state.timerRemaining !== undefined ? state.timerRemaining : 60}s`;
    if (wfStreakText) wfStreakText.textContent = `🔥 ${state.streak || 0}`;
    if (wfFoundCountText) wfFoundCountText.textContent = `${state.foundCount || 0}/${state.totalWords || 0}`;

    const words = state.secretWords || state.words;
    if (Array.isArray(words)) {
      renderSecretWords(words);
    }

    if (Array.isArray(state.puzzles) && !categoriesInitialized) {
      initCategories(state.puzzles);
      renderFilteredPuzzles();
    }
  }

  socket.on("gameState", updateUI);
  socket.on("state", updateUI);
  socket.on("syncState", updateUI);

  return { updateUI };
}

export const initControls = initWordFinderControls;
