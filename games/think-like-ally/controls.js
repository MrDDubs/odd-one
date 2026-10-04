// games/think-like-ally/controls.js (ESM)

export function parseQuestionsInput(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. JSON Parsing
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      let list = [];
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].questions) {
          list = parsed[0].questions;
        } else {
          list = parsed;
        }
      } else if (parsed && Array.isArray(parsed.questions)) {
        list = parsed.questions;
      }

      const questions = [];
      for (const item of list) {
        if (!item) continue;
        const q = String(item.question || item.prompt || item.q || "").trim();
        const a = String(item.answer || item.target || item.a || "").trim();
        if (q && a) {
          questions.push({
            question: q,
            answer: a,
            icon: item.icon || "💡",
            type: item.type || "open",
            options: Array.isArray(item.options) ? item.options : []
          });
        }
      }
      if (questions.length > 0) return questions;
    } catch (e) {
      // Fall through to line-by-line parsing
    }
  }

  // 2. Line by line parsing (CSV, TSV, dash, colon, Q/A)
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];

  for (let line of lines) {
    line = line.replace(/^\s*(?:\[\d+\]|\d+[\.\)\-:]\s*)/, "").trim();

    // Check for "Q: ... A: ..."
    const qaMatch = line.match(/^(?:q(?:uestion)?\s*[:\-]\s*)?(.*?)\s+(?:a(?:nswer)?\s*[:\-]\s*)(.*)$/i);
    if (qaMatch && qaMatch[1].trim() && qaMatch[2].trim()) {
      questions.push({
        question: qaMatch[1].trim(),
        answer: qaMatch[2].trim(),
        icon: "💡",
        type: "open",
        options: []
      });
      continue;
    }

    let delimiter = null;
    if (line.includes("\t")) delimiter = "\t";
    else if (line.includes("|")) delimiter = "|";
    else if (line.includes(";")) delimiter = ";";
    else if (line.includes(",")) delimiter = ",";
    else if (line.includes(" - ")) delimiter = " - ";
    else if (line.includes(": ")) delimiter = ": ";

    if (delimiter) {
      let parts = [];
      if (delimiter === ",") {
        const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
          parts.push(val.trim());
          if (regex.lastIndex === line.length) break;
        }
      } else {
        parts = line.split(delimiter).map((p) => p.trim());
      }

      if (parts.length >= 2) {
        const q = parts[0].trim();
        const a = parts[1].trim();
        const icon = parts[2] && parts[2].length <= 4 ? parts[2].trim() : "💡";
        if (q && a && q.toLowerCase() !== "question" && a.toLowerCase() !== "answer") {
          questions.push({
            question: q,
            answer: a,
            icon,
            type: "open",
            options: []
          });
        }
      }
    }
  }

  return questions;
}

export function initThinkLikeAllyControls({ socket, showToast }) {
  const tlaSecretAnswer = document.getElementById("tlaSecretAnswer");
  const tlaQuestionPeek = document.getElementById("tlaQuestionPeek");
  const tlaTimerText = document.getElementById("tlaTimerText");
  const tlaTypePeek = document.getElementById("tlaTypePeek");
  const tlaWinnersCount = document.getElementById("tlaWinnersCount");

  const tlaBtnStartTimer = document.getElementById("tlaBtnStartTimer");
  const tlaBtnPauseTimer = document.getElementById("tlaBtnPauseTimer");
  const tlaBtnReveal = document.getElementById("tlaBtnReveal");
  const tlaBtnHide = document.getElementById("tlaBtnHide");
  const tlaBtnNextQuestion = document.getElementById("tlaBtnNextQuestion");
  const tlaBtnResetGame = document.getElementById("tlaBtnResetGame");

  const tlaActivePackBadge = document.getElementById("tlaActivePackBadge");
  const tlaPackStatusInfo = document.getElementById("tlaPackStatusInfo");
  const tlaPackSelect = document.getElementById("tlaPackSelect");
  const tlaBtnLoadPack = document.getElementById("tlaBtnLoadPack");
  const tlaBtnOpenImportModal = document.getElementById("tlaBtnOpenImportModal");
  const tlaBtnDeletePack = document.getElementById("tlaBtnDeletePack");

  // Import Modal Elements
  const tlaImportModal = document.getElementById("tlaImportModal");
  const tlaBtnCloseImportModal = document.getElementById("tlaBtnCloseImportModal");
  const tlaBtnCancelImport = document.getElementById("tlaBtnCancelImport");
  const tlaBtnSubmitImport = document.getElementById("tlaBtnSubmitImport");
  const tlaImportPackName = document.getElementById("tlaImportPackName");
  const tlaDropZone = document.getElementById("tlaDropZone");
  const tlaModalFileInput = document.getElementById("tlaModalFileInput");
  const tlaSelectedFileName = document.getElementById("tlaSelectedFileName");
  const tlaImportPasteArea = document.getElementById("tlaImportPasteArea");
  const tlaBtnPasteSample = document.getElementById("tlaBtnPasteSample");
  const tlaPreviewCountBadge = document.getElementById("tlaPreviewCountBadge");
  const tlaPreviewList = document.getElementById("tlaPreviewList");

  const tlaCustomQuestion = document.getElementById("tlaCustomQuestion");
  const tlaCustomAnswer = document.getElementById("tlaCustomAnswer");
  const tlaCustomIcon = document.getElementById("tlaCustomIcon");
  const tlaBtnSetCustom = document.getElementById("tlaBtnSetCustom");

  const tlaSimUser = document.getElementById("tlaSimUser");
  const tlaSimGuess = document.getElementById("tlaSimGuess");
  const tlaBtnSimGuess = document.getElementById("tlaBtnSimGuess");
  const tlaBtnSimWin = document.getElementById("tlaBtnSimWin");
  const tlaBtnSimRandom = document.getElementById("tlaBtnSimRandom");

  const tlaPresetButtons = document.querySelectorAll("#tlaPresetRow .chip");
  const tlaCustomSecInput = document.getElementById("tlaCustomSecInput");
  const tlaBtnSaveCustomSec = document.getElementById("tlaBtnSaveCustomSec");

  let localState = null;
  let parsedQuestions = [];

  function updatePackDeleteVisibility() {
    if (!tlaBtnDeletePack || !tlaPackSelect || !localState?.questionSets) return;
    const selectedId = tlaPackSelect.value;
    const foundSet = localState.questionSets.find((s) => s.id === selectedId);
    if (foundSet && foundSet.isCustom) {
      tlaBtnDeletePack.style.display = "inline-block";
    } else {
      tlaBtnDeletePack.style.display = "none";
    }
  }

  function onStateUpdate(state) {
    if (!state || state.gameId !== "think-like-ally") return;
    localState = state;

    if (tlaSecretAnswer) tlaSecretAnswer.textContent = state.allyAnswer || state.secretTarget || "--";
    if (tlaQuestionPeek) tlaQuestionPeek.textContent = `Question: "${state.question || "--"}"`;
    if (tlaTimerText) tlaTimerText.textContent = `${state.time || state.timerRemaining || 0}s`;
    if (tlaTypePeek) tlaTypePeek.textContent = (state.questionType || "OPEN").toUpperCase();
    if (tlaWinnersCount) tlaWinnersCount.textContent = (state.roundWinners || []).length;

    const activeSec = state.roundDurationSec || state.customDurationSec || state.time || 15;
    tlaPresetButtons.forEach((btn) => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      btn.classList.toggle("active", sec === activeSec);
    });
    if (tlaCustomSecInput && document.activeElement !== tlaCustomSecInput) {
      tlaCustomSecInput.value = state.customDurationSec || state.roundDurationSec || 15;
    }

    if (tlaBtnStartTimer) {
      if (state.isTimerActive) {
        tlaBtnStartTimer.textContent = "🔄 Restart Timer";
      } else {
        tlaBtnStartTimer.textContent = "▶ Start Timer";
      }
    }

    // Active Pack Badge & Status
    if (tlaActivePackBadge) {
      tlaActivePackBadge.textContent = state.currentSetName || "Official Pack";
    }
    if (tlaPackStatusInfo && state.currentSetName) {
      tlaPackStatusInfo.textContent = `Active Pack: "${state.currentSetName}" • Question ${state.round || 1}`;
    }

    // Populate question packs dropdown
    if (tlaPackSelect && state.questionSets) {
      const currentSelected = tlaPackSelect.value;
      const optionsHtml = state.questionSets
        .map((s) => `<option value="${s.id}">${s.isCustom ? "⭐ " : "📖 "}${s.name} (${s.count} questions)</option>`)
        .join("");
      
      const importOptionHtml = `<option value="__import__">➕ Import new questions from file / paste...</option>`;
      tlaPackSelect.innerHTML = optionsHtml + importOptionHtml;

      if (state.currentSetId) {
        tlaPackSelect.value = state.currentSetId;
      } else if (currentSelected && state.questionSets.some((s) => s.id === currentSelected)) {
        tlaPackSelect.value = currentSelected;
      }

      updatePackDeleteVisibility();
    }
  }

  // Timer preset and custom duration buttons
  tlaPresetButtons.forEach((btn) => {
    btn.onclick = () => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      if (sec && sec > 0) {
        socket.emit("gameAction", { gameId: "think-like-ally", action: "setTime", options: { sec } });
        showToast(`Timer duration set to ${sec}s`);
      }
    };
  });

  if (tlaBtnSaveCustomSec && tlaCustomSecInput) {
    tlaBtnSaveCustomSec.onclick = () => {
      const sec = parseInt(tlaCustomSecInput.value, 10);
      if (sec && sec > 0) {
        socket.emit("gameAction", { gameId: "think-like-ally", action: "setTime", options: { sec } });
        showToast(`Timer duration set to ${sec}s`);
      }
    };
  }

  // Button actions
  if (tlaBtnStartTimer) {
    tlaBtnStartTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "think-like-ally", action: "startTimer" });
      showToast("Timer Started");
    };
  }

  if (tlaBtnPauseTimer) {
    tlaBtnPauseTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "think-like-ally", action: "stopTimer" });
      showToast("Timer Paused");
    };
  }

  if (tlaBtnReveal) {
    tlaBtnReveal.onclick = () => {
      socket.emit("gameAction", { gameId: "think-like-ally", action: "reveal" });
      showToast("Answer Revealed");
    };
  }

  if (tlaBtnHide) {
    tlaBtnHide.onclick = () => {
      socket.emit("gameAction", { gameId: "think-like-ally", action: "hideAnswer" });
      showToast("Answer Hidden");
    };
  }

  if (tlaBtnNextQuestion) {
    tlaBtnNextQuestion.onclick = () => {
      socket.emit("gameAction", { gameId: "think-like-ally", action: "nextRound" });
      showToast("Advanced to Next Question");
    };
  }

  if (tlaBtnResetGame) {
    tlaBtnResetGame.onclick = () => {
      if (confirm("Reset Think Like Ally game and questions?")) {
        socket.emit("gameAction", { gameId: "think-like-ally", action: "resetGame" });
        showToast("Game Reset");
      }
    };
  }

  // Pack selector change handler
  if (tlaPackSelect) {
    tlaPackSelect.onchange = () => {
      if (tlaPackSelect.value === "__import__") {
        openImportModal();
      } else {
        updatePackDeleteVisibility();
      }
    };
  }

  // Load Pack button
  if (tlaBtnLoadPack && tlaPackSelect) {
    tlaBtnLoadPack.onclick = () => {
      const setId = tlaPackSelect.value;
      if (!setId) return;
      if (setId === "__import__") {
        openImportModal();
        return;
      }
      socket.emit("gameAction", { gameId: "think-like-ally", action: "loadQuestionSet", options: setId });
      showToast(`Loaded question pack!`);
    };
  }

  // Delete Pack button
  if (tlaBtnDeletePack && tlaPackSelect) {
    tlaBtnDeletePack.onclick = () => {
      const setId = tlaPackSelect.value;
      if (!setId || setId === "tla-official-full" || setId === "__import__") return;
      const foundSet = localState?.questionSets?.find((s) => s.id === setId);
      const name = foundSet ? foundSet.name : "this pack";
      if (confirm(`Are you sure you want to delete question pack "${name}"?`)) {
        socket.emit("gameAction", { gameId: "think-like-ally", action: "deleteQuestionSet", options: setId });
        showToast(`Pack "${name}" deleted.`);
      }
    };
  }

  // --------------------------------------------------------------------------
  // Import Modal & Parser Logic
  // --------------------------------------------------------------------------
  function openImportModal() {
    if (!tlaImportModal) return;
    tlaImportModal.style.display = "flex";
    if (tlaImportPackName) {
      if (!tlaImportPackName.value) {
        tlaImportPackName.value = `Custom Pack ${((localState?.questionSets?.length || 1) + 1)}`;
      }
      tlaImportPackName.focus();
    }
  }

  function closeImportModal() {
    if (!tlaImportModal) return;
    tlaImportModal.style.display = "none";
    if (tlaPackSelect && tlaPackSelect.value === "__import__") {
      tlaPackSelect.value = localState?.currentSetId || (localState?.questionSets?.[0]?.id || "");
      updatePackDeleteVisibility();
    }
  }

  function updateImportPreview(textSource) {
    const text = typeof textSource === "string" ? textSource : (tlaImportPasteArea?.value || "");
    parsedQuestions = parseQuestionsInput(text);

    if (tlaPreviewCountBadge) {
      tlaPreviewCountBadge.textContent = `${parsedQuestions.length} Questions`;
      tlaPreviewCountBadge.className = parsedQuestions.length > 0 ? "badge badge-purple" : "badge";
    }

    if (tlaBtnSubmitImport) {
      tlaBtnSubmitImport.disabled = parsedQuestions.length === 0;
    }

    if (tlaPreviewList) {
      if (parsedQuestions.length === 0) {
        tlaPreviewList.innerHTML = `<div style="color:var(--muted);font-style:italic">Choose a file or paste questions above to see preview.</div>`;
      } else {
        const previewRows = parsedQuestions.slice(0, 5).map((q, idx) => {
          return `<div style="padding:2px 0"><strong>#${idx + 1}:</strong> "${q.question}" → <span style="color:#a78bfa;font-weight:600">${q.answer}</span></div>`;
        });
        if (parsedQuestions.length > 5) {
          previewRows.push(`<div style="color:var(--muted);font-style:italic;margin-top:2px">...and ${parsedQuestions.length - 5} more questions.</div>`);
        }
        tlaPreviewList.innerHTML = previewRows.join("");
      }
    }
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (tlaSelectedFileName) {
      tlaSelectedFileName.textContent = `📄 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      tlaSelectedFileName.style.display = "block";
    }
    if (tlaImportPackName && (!tlaImportPackName.value || tlaImportPackName.value.startsWith("Custom Pack"))) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      tlaImportPackName.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (tlaImportPasteArea) {
        tlaImportPasteArea.value = content;
      }
      updateImportPreview(content);
    };
    reader.readAsText(file);
  }

  if (tlaBtnOpenImportModal) {
    tlaBtnOpenImportModal.onclick = () => openImportModal();
  }

  if (tlaBtnCloseImportModal) {
    tlaBtnCloseImportModal.onclick = () => closeImportModal();
  }

  if (tlaBtnCancelImport) {
    tlaBtnCancelImport.onclick = () => closeImportModal();
  }

  // Close modal when clicking on backdrop
  if (tlaImportModal) {
    tlaImportModal.onclick = (e) => {
      if (e.target === tlaImportModal) closeImportModal();
    };
  }

  // File Dropzone & Click
  if (tlaDropZone && tlaModalFileInput) {
    tlaDropZone.onclick = () => tlaModalFileInput.click();

    tlaDropZone.ondragover = (e) => {
      e.preventDefault();
      tlaDropZone.style.borderColor = "#c084fc";
      tlaDropZone.style.background = "rgba(192,132,252,0.15)";
    };

    tlaDropZone.ondragleave = () => {
      tlaDropZone.style.borderColor = "#8b5cf6";
      tlaDropZone.style.background = "rgba(139,92,246,0.08)";
    };

    tlaDropZone.ondrop = (e) => {
      e.preventDefault();
      tlaDropZone.style.borderColor = "#8b5cf6";
      tlaDropZone.style.background = "rgba(139,92,246,0.08)";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    };

    tlaModalFileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    };
  }

  // Paste Text Area listener
  if (tlaImportPasteArea) {
    tlaImportPasteArea.oninput = () => {
      updateImportPreview(tlaImportPasteArea.value);
    };
  }

  // Paste Sample Questions
  if (tlaBtnPasteSample && tlaImportPasteArea) {
    tlaBtnPasteSample.onclick = () => {
      const sample = `Name a summer fruit, Watermelon
Name a fast food chain, KFC / McDonald's
Name a superhero, Batman / Superman / Spider-Man
Name a board game, Monopoly / Scrabble
Name a pizza topping, Pepperoni / Mushrooms / Pineapple
Name a musical instrument, Guitar / Piano / Drums
Name a hot drink, Coffee / Tea / Hot Chocolate
Name an animal in the ocean, Dolphin / Shark / Whale`;
      tlaImportPasteArea.value = sample;
      if (tlaImportPackName) {
        tlaImportPackName.value = "Party Trivia Sample";
      }
      updateImportPreview(sample);
      showToast("Loaded sample questions!");
    };
  }

  // Submit Import
  if (tlaBtnSubmitImport) {
    tlaBtnSubmitImport.onclick = () => {
      if (parsedQuestions.length === 0) {
        alert("Please provide at least one valid question and answer.");
        return;
      }
      const packName = (tlaImportPackName?.value || "").trim() || `Custom Pack ${((localState?.questionSets?.length || 1) + 1)}`;
      
      socket.emit("gameAction", {
        gameId: "think-like-ally",
        action: "importQuestionSet",
        options: {
          name: packName,
          questions: parsedQuestions
        }
      });

      showToast(`Importing "${packName}" (${parsedQuestions.length} questions)...`);
      closeImportModal();
    };
  }

  // Custom Question Builder
  if (tlaBtnSetCustom) {
    tlaBtnSetCustom.onclick = () => {
      const q = (tlaCustomQuestion?.value || "").trim();
      const a = (tlaCustomAnswer?.value || "").trim();
      const icon = (tlaCustomIcon?.value || "💡").trim();

      if (!q || !a) {
        alert("Please enter both a Question Prompt and a Secret Answer.");
        return;
      }

      socket.emit("gameAction", {
        gameId: "think-like-ally",
        action: "setQuestion",
        options: { question: q, answer: a, icon, type: "open" }
      });
      showToast(`Custom Question Set: "${q}"`);
    };
  }

  // Simulators
  if (tlaBtnSimGuess) {
    tlaBtnSimGuess.onclick = () => {
      const user = (tlaSimUser?.value || "TestUser").trim();
      const guess = (tlaSimGuess?.value || "").trim();
      if (!guess) {
        alert("Please enter a guess to simulate.");
        return;
      }
      socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
      if (tlaSimGuess) tlaSimGuess.value = "";
      showToast(`Simulated guess: "${guess}" by @${user}`);
    };
  }

  if (tlaBtnSimWin) {
    tlaBtnSimWin.onclick = () => {
      if (!localState?.allyAnswer) return;
      const user = (tlaSimUser?.value || "SmartGuesser").trim();
      socket.emit("simulateGuess", {
        username: user,
        nickname: user,
        message: localState.allyAnswer
      });
      showToast(`Simulated CORRECT GUESS: "${localState.allyAnswer}" by @${user}`);
    };
  }

  if (tlaBtnSimRandom) {
    tlaBtnSimRandom.onclick = () => {
      const randomWords = ["Chocolate", "Pineapple", "Banana", "Hawaii", "Superman", "Paris", "Coffee", "Guitar"];
      const rand = randomWords[Math.floor(Math.random() * randomWords.length)];
      const user = (tlaSimUser?.value || "Viewer" + Math.floor(Math.random() * 100)).trim();
      socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
      showToast(`Simulated guess: "${rand}" by @${user}`);
    };
  }

  return { onStateUpdate };
}
