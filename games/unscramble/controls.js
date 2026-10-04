// games/unscramble/controls.js (ESM)

export function parseWordsInput(rawText) {
  if (!rawText) return [];
  const text = String(rawText).trim();
  let parsed = [];

  // Try JSON
  try {
    if (text.startsWith("[") || text.startsWith("{")) {
      const obj = JSON.parse(text);
      const arr = Array.isArray(obj) ? obj : (Array.isArray(obj.words) ? obj.words : []);
      for (const item of arr) {
        let w = typeof item === "string" ? item : (item.word || "");
        w = String(w).trim().toUpperCase();
        if (w.length >= 4 && w.length <= 9 && /^[A-Z]+$/.test(w)) {
          parsed.push({
            word: w,
            category: typeof item === "object" ? (item.category || "Custom") : "Custom",
            hint: typeof item === "object" ? (item.hint || `Length: ${w.length} letters`) : `Length: ${w.length} letters`
          });
        }
      }
      if (parsed.length > 0) return parsed;
    }
  } catch (e) {
    // Continue to line parsing
  }

  // Parse lines: WORD or WORD, Category, Hint
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/[,\t|]/).map(p => p.trim());
    const w = (parts[0] || "").toUpperCase();
    if (w.length >= 4 && w.length <= 9 && /^[A-Z]+$/.test(w)) {
      parsed.push({
        word: w,
        category: parts[1] || "Custom",
        hint: parts[2] || `Length: ${w.length} letters`
      });
    }
  }

  return parsed;
}

export function initUnscrambleControls({ socket, showToast }) {
  // Cheat Sheet Elements
  const uHostWord = document.getElementById("uHostWord");
  const uHostCategory = document.getElementById("uHostCategory");
  const uHostLength = document.getElementById("uHostLength");
  const uHostTimerText = document.getElementById("uHostTimerText");
  const uHostScrambled = document.getElementById("uHostScrambled");
  const uHostHint = document.getElementById("uHostHint");
  const uBtnHostHint = document.getElementById("uBtnHostHint");
  const uBtnHostReveal = document.getElementById("uBtnHostReveal");

  // Flow Controls
  const uBtnStartTimer = document.getElementById("uBtnStartTimer");
  const uBtnPauseTimer = document.getElementById("uBtnPauseTimer");
  const uBtnNextRound = document.getElementById("uBtnNextRound");
  const uBtnPrevRound = document.getElementById("uBtnPrevRound");
  const uBtnRandomRound = document.getElementById("uBtnRandomRound");
  const uBtnHint = document.getElementById("uBtnHint");
  const uBtnReveal = document.getElementById("uBtnReveal");
  const uBtnResetGame = document.getElementById("uBtnResetGame");

  // Timer Configuration
  const uPresetRow = document.getElementById("uPresetRow");
  const uCustomSecInput = document.getElementById("uCustomSecInput");
  const uBtnSetCustomSec = document.getElementById("uBtnSetCustomSec");

  // Catalog & Length Filter
  const uWordsCountBadge = document.getElementById("uWordsCountBadge");
  const uLengthFilterRow = document.getElementById("uLengthFilterRow");
  const uWordSelect = document.getElementById("uWordSelect");
  const uBtnLoadSelected = document.getElementById("uBtnLoadSelected");
  const uBtnOpenImportModal = document.getElementById("uBtnOpenImportModal");

  // Import Modal Elements
  const uImportModal = document.getElementById("uImportModal");
  const uBtnCloseImportModal = document.getElementById("uBtnCloseImportModal");
  const uBtnCancelImport = document.getElementById("uBtnCancelImport");
  const uBtnSubmitImport = document.getElementById("uBtnSubmitImport");
  const uDropZone = document.getElementById("uDropZone");
  const uModalFileInput = document.getElementById("uModalFileInput");
  const uSelectedFileName = document.getElementById("uSelectedFileName");
  const uImportPasteArea = document.getElementById("uImportPasteArea");
  const uBtnPasteSample = document.getElementById("uBtnPasteSample");
  const uPreviewCountBadge = document.getElementById("uPreviewCountBadge");
  const uPreviewList = document.getElementById("uPreviewList");

  // Simulator
  const uSimUser = document.getElementById("uSimUser");
  const uSimGuess = document.getElementById("uSimGuess");
  const uBtnSimGuess = document.getElementById("uBtnSimGuess");
  const uBtnSimCorrect = document.getElementById("uBtnSimCorrect");
  const uBtnSimRandom = document.getElementById("uBtnSimRandom");

  let currentWordsCatalog = [];
  let currentActiveWord = null;

  // 1. Sync State Handler
  function handleState(state) {
    if (!state || state.gameId !== "unscramble") return;

    // Cheat Sheet
    if (uHostWord) {
      uHostWord.textContent = state.secretWord || state.word || "--";
    }
    if (uHostCategory) {
      uHostCategory.textContent = `${state.category || "General"} ${state.emoji || ""}`;
    }
    if (uHostLength) {
      uHostLength.textContent = `${state.length || (state.word?.length) || "--"} Letters`;
    }
    if (uHostTimerText) {
      uHostTimerText.textContent = `${state.time || 0}s ${state.paused ? "(Paused)" : (state.isTimerActive ? "(Active)" : "(Stopped)")}`;
    }
    if (uHostScrambled) {
      const letters = Array.isArray(state.scrambled) ? state.scrambled.join(" ") : (state.scrambledString || "--");
      uHostScrambled.textContent = letters;
    }
    if (uHostHint) {
      uHostHint.textContent = state.secretHint || state.hint || "None";
    }

    currentActiveWord = state.secretWord || state.word;

    // Word Count Badge
    if (uWordsCountBadge && state.totalWordsCount) {
      uWordsCountBadge.textContent = `${state.totalWordsCount.toLocaleString()} Words`;
    }

    // Length Filter Active Chip Sync
    if (uLengthFilterRow && state.lengthFilter) {
      const targetVal = String(state.lengthFilter);
      Array.from(uLengthFilterRow.querySelectorAll(".chip")).forEach(chip => {
        if (chip.getAttribute("data-len") === targetVal) {
          chip.classList.add("active");
        } else {
          chip.classList.remove("active");
        }
      });
    }

    // Word Catalog Dropdown Preview (load words list if available)
    if (uWordSelect && Array.isArray(state.wordsListPreview) && currentWordsCatalog.length === 0) {
      currentWordsCatalog = state.wordsListPreview;
      populateWordSelect(currentWordsCatalog, state.wordId);
    }
  }

  function populateWordSelect(words, activeId = null) {
    if (!uWordSelect) return;
    uWordSelect.innerHTML = words.map(w => `
      <option value="${w.id}" ${w.id === activeId ? "selected" : ""}>
        ${w.emoji || "🔤"} ${w.word} (${w.length}L • ${w.category || "General"})
      </option>
    `).join("");
  }

  // Load complete 1,000 words catalog directly from words.json if needed
  fetch("/games/unscramble/words.json")
    .then(res => res.json())
    .then(list => {
      if (Array.isArray(list)) {
        currentWordsCatalog = list;
        populateWordSelect(currentWordsCatalog);
        if (uWordsCountBadge) {
          uWordsCountBadge.textContent = `${list.length.toLocaleString()} Words`;
        }
      }
    })
    .catch(() => {});

  // 2. Wire Cheat Sheet Quick Actions
  if (uBtnHostHint) {
    uBtnHostHint.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "hint" });
      showToast("💡 Revealed Hint to Chat");
    };
  }

  if (uBtnHostReveal) {
    uBtnHostReveal.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "reveal" });
      showToast("👁️ Revealed Secret Word");
    };
  }

  // 3. Wire Flow Controls
  if (uBtnStartTimer) {
    uBtnStartTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "startTimer" });
      showToast("▶ Timer Started");
    };
  }

  if (uBtnPauseTimer) {
    uBtnPauseTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "togglePause" });
      showToast("⏸ Timer Toggled");
    };
  }

  if (uBtnNextRound) {
    uBtnNextRound.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "newRound" });
      showToast("⏭ Next Word Loaded");
    };
  }

  if (uBtnPrevRound) {
    uBtnPrevRound.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "prevRound" });
      showToast("⏮ Previous Word Loaded");
    };
  }

  if (uBtnRandomRound) {
    uBtnRandomRound.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "newRound" });
      showToast("🎲 Random Word Loaded");
    };
  }

  if (uBtnHint) {
    uBtnHint.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "hint" });
      showToast("💡 Gave Hint");
    };
  }

  if (uBtnReveal) {
    uBtnReveal.onclick = () => {
      socket.emit("gameAction", { gameId: "unscramble", action: "reveal" });
      showToast("👁️ Revealed Word");
    };
  }

  if (uBtnResetGame) {
    uBtnResetGame.onclick = () => {
      if (confirm("Reset Unscramble round, streak, and scores?")) {
        socket.emit("gameAction", { gameId: "unscramble", action: "resetGame" });
        showToast("🔄 Game Reset");
      }
    };
  }

  // 4. Wire Timer Configuration
  if (uPresetRow) {
    uPresetRow.querySelectorAll(".chip").forEach(chip => {
      chip.onclick = () => {
        const sec = parseInt(chip.getAttribute("data-sec"), 10);
        socket.emit("gameAction", { gameId: "unscramble", action: "setTime", options: { sec } });
        showToast(`⏱ Set Round Time to ${sec}s`);
      };
    });
  }

  if (uBtnSetCustomSec && uCustomSecInput) {
    uBtnSetCustomSec.onclick = () => {
      const sec = parseInt(uCustomSecInput.value, 10);
      if (sec >= 10 && sec <= 300) {
        socket.emit("gameAction", { gameId: "unscramble", action: "setTime", options: { sec } });
        showToast(`⏱ Set Custom Time to ${sec}s`);
      } else {
        alert("Please enter a duration between 10 and 300 seconds.");
      }
    };
  }

  // 5. Wire Length Filter Chips
  if (uLengthFilterRow) {
    uLengthFilterRow.querySelectorAll(".chip").forEach(chip => {
      chip.onclick = () => {
        const lenVal = chip.getAttribute("data-len");
        socket.emit("gameAction", { gameId: "unscramble", action: "setLengthFilter", options: lenVal });
        Array.from(uLengthFilterRow.querySelectorAll(".chip")).forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        showToast(`🔤 Filter set to ${lenVal === "all" ? "All Lengths (4-9)" : `${lenVal} Letters`}`);
      };
    });
  }

  // 6. Wire Load Word by Select
  if (uBtnLoadSelected && uWordSelect) {
    uBtnLoadSelected.onclick = () => {
      const selectedId = uWordSelect.value;
      if (selectedId) {
        socket.emit("gameAction", { gameId: "unscramble", action: "loadWordById", options: selectedId });
        showToast("Loaded Selected Word");
      }
    };
  }

  // 7. Word Pack Importer Modal
  let parsedImportWords = [];

  function updateImportPreview() {
    if (!uPreviewCountBadge || !uPreviewList || !uBtnSubmitImport) return;
    uPreviewCountBadge.textContent = `${parsedImportWords.length} Words`;
    uBtnSubmitImport.disabled = parsedImportWords.length === 0;

    if (parsedImportWords.length === 0) {
      uPreviewList.innerHTML = `<div style="color:var(--muted);font-style:italic">Upload a file or paste words above to see preview.</div>`;
      return;
    }

    uPreviewList.innerHTML = parsedImportWords.slice(0, 30).map((item, idx) => `
      <div>#${idx + 1} <strong>${item.word}</strong> (${item.word.length} letters • ${item.category})</div>
    `).join("") + (parsedImportWords.length > 30 ? `<div style="color:#c084fc;font-weight:bold;margin-top:4px">... and ${parsedImportWords.length - 30} more words</div>` : "");
  }

  if (uBtnOpenImportModal && uImportModal) {
    uBtnOpenImportModal.onclick = () => {
      uImportModal.style.display = "flex";
      parsedImportWords = [];
      if (uImportPasteArea) uImportPasteArea.value = "";
      if (uSelectedFileName) uSelectedFileName.style.display = "none";
      updateImportPreview();
    };
  }

  if (uBtnCloseImportModal && uImportModal) {
    uBtnCloseImportModal.onclick = () => { uImportModal.style.display = "none"; };
  }
  if (uBtnCancelImport && uImportModal) {
    uBtnCancelImport.onclick = () => { uImportModal.style.display = "none"; };
  }

  // File Upload
  if (uDropZone && uModalFileInput) {
    uDropZone.onclick = () => { uModalFileInput.click(); };

    uModalFileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (uSelectedFileName) {
        uSelectedFileName.textContent = `Selected: ${file.name}`;
        uSelectedFileName.style.display = "block";
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        parsedImportWords = parseWordsInput(evt.target.result);
        updateImportPreview();
      };
      reader.readAsText(file);
    };
  }

  // Paste Text
  if (uImportPasteArea) {
    uImportPasteArea.oninput = () => {
      parsedImportWords = parseWordsInput(uImportPasteArea.value);
      updateImportPreview();
    };
  }

  if (uBtnPasteSample && uImportPasteArea) {
    uBtnPasteSample.onclick = () => {
      uImportPasteArea.value = [
        "PIZZA, Food, Italian cheese dish",
        "DOLPHIN, Animals, Ocean mammal",
        "GALAXY, Science, Stars system",
        "RAINBOW, Nature, Colorful sky arch",
        "CHOCOLATE, Sweets, Cocoa treat",
        "ASTRONAUT, Space, Rocket traveler",
        "FIREWORKS, Celebration, Night sky sparks",
        "BUTTERFLY, Insects, Winged creature"
      ].join("\n");
      parsedImportWords = parseWordsInput(uImportPasteArea.value);
      updateImportPreview();
    };
  }

  if (uBtnSubmitImport && uImportModal) {
    uBtnSubmitImport.onclick = () => {
      if (parsedImportWords.length === 0) return;
      socket.emit("gameAction", {
        gameId: "unscramble",
        action: "importWordSet",
        options: parsedImportWords
      });
      showToast(`📥 Imported ${parsedImportWords.length} custom words!`);
      uImportModal.style.display = "none";
    };
  }

  // 8. Live Simulator
  if (uBtnSimGuess) {
    uBtnSimGuess.onclick = () => {
      const user = uSimUser?.value || "SimUser";
      const guess = uSimGuess?.value?.trim();
      if (!guess) return;
      socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
      showToast(`Simulated guess: "${guess}"`);
      if (uSimGuess) uSimGuess.value = "";
    };
  }

  if (uBtnSimCorrect) {
    uBtnSimCorrect.onclick = () => {
      const user = uSimUser?.value || "SimWinner";
      const correctWord = currentActiveWord || "DOLPHIN";
      socket.emit("simulateGuess", { username: user, nickname: user, message: correctWord });
      showToast(`🎯 Simulated WINNER with "${correctWord}"!`);
    };
  }

  if (uBtnSimRandom) {
    uBtnSimRandom.onclick = () => {
      const user = uSimUser?.value || "SimViewer";
      const randomWords = ["BANANA", "LAPTOP", "GUITAR", "PENGUIN", "SUNSET", "COOKIE"];
      const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
      socket.emit("simulateGuess", { username: user, nickname: user, message: randomWord });
      showToast(`Simulated guess: "${randomWord}"`);
    };
  }

  // Register state listener
  socket.on("gameState", (data) => {
    handleState(data);
  });
}
