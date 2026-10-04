// games/crowd-says/controls.js (ESM)

export function parseCrowdQuestionsInput(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. JSON Parsing
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      let list = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      const questions = [];

      for (const item of list) {
        if (!item) continue;
        const q = String(item.question || item.prompt || "").trim();
        let answers = [];

        if (Array.isArray(item.answers)) {
          answers = item.answers.map((a, idx) => {
            if (typeof a === "object") {
              return {
                text: String(a.text || a.answer || "").trim(),
                synonyms: Array.isArray(a.synonyms) ? a.synonyms : [String(a.text || a.answer || "")],
                points: Number(a.points) || Math.max(5, (5 - idx) * 8)
              };
            }
            return {
              text: String(a).trim(),
              synonyms: [String(a).trim()],
              points: Math.max(5, (5 - idx) * 8)
            };
          }).filter((a) => a.text.length > 0);
        } else if (typeof item.answer === "string") {
          const parts = item.answer.split(/[/,|]/).map((s) => s.trim()).filter(Boolean);
          answers = parts.map((text, idx) => ({
            text,
            synonyms: [text],
            points: Math.max(5, (parts.length - idx) * 8)
          }));
        }

        if (q && answers.length > 0) {
          questions.push({
            question: q,
            icon: item.icon || "📣",
            category: item.category || "General",
            answers
          });
        }
      }
      if (questions.length > 0) return questions;
    } catch (e) {}
  }

  // 2. Line by line parsing
  // Expected format: Question, Answer 1 / Answer 2 / Answer 3
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];

  for (let line of lines) {
    line = line.replace(/^\s*(?:\[\d+\]|\d+[\.\)\-:]\s*)/, "").trim();

    let parts = [];
    if (line.includes("\t")) parts = line.split("\t");
    else if (line.includes(" - ")) parts = line.split(" - ");
    else if (line.includes(": ")) parts = line.split(": ");
    else if (line.includes(",")) {
      const idx = line.indexOf(",");
      parts = [line.slice(0, idx), line.slice(idx + 1)];
    }

    if (parts.length >= 2) {
      const q = parts[0].trim();
      const ansRaw = parts.slice(1).join(",").trim();
      const answerList = ansRaw.split(/[/,|]/).map((s) => s.trim()).filter(Boolean);

      if (q && answerList.length > 0) {
        questions.push({
          question: q,
          icon: "📣",
          category: "Custom",
          answers: answerList.map((text, idx) => ({
            text,
            synonyms: [text],
            points: Math.max(5, (answerList.length - idx) * 8)
          }))
        });
      }
    }
  }

  return questions;
}

export function initCrowdSaysControls({ socket, showToast }) {
  const csHostQuestion = document.getElementById("csHostQuestion");
  const csHostCategory = document.getElementById("csHostCategory");
  const csHostFoundCount = document.getElementById("csHostFoundCount");
  const csHostTimerText = document.getElementById("csHostTimerText");
  const csHostSlotsList = document.getElementById("csHostSlotsList");

  const csBtnStartTimer = document.getElementById("csBtnStartTimer");
  const csBtnPauseTimer = document.getElementById("csBtnPauseTimer");
  const csBtnNextRound = document.getElementById("csBtnNextRound");
  const csBtnPrevRound = document.getElementById("csBtnPrevRound");
  const csBtnRandomRound = document.getElementById("csBtnRandomRound");
  const csBtnRevealAll = document.getElementById("csBtnRevealAll");
  const csBtnHideAll = document.getElementById("csBtnHideAll");
  const csBtnResetGame = document.getElementById("csBtnResetGame");

  const csPresetButtons = document.querySelectorAll("#csPresetRow .chip");
  const csCustomSecInput = document.getElementById("csCustomSecInput");
  const csBtnSaveCustomSec = document.getElementById("csBtnSaveCustomSec");

  const csQuestionsCountBadge = document.getElementById("csQuestionsCountBadge");
  const csQuestionSelect = document.getElementById("csQuestionSelect");
  const csBtnLoadQuestion = document.getElementById("csBtnLoadQuestion");
  const csBtnOpenImportModal = document.getElementById("csBtnOpenImportModal");

  // Import Modal Elements
  const csImportModal = document.getElementById("csImportModal");
  const csBtnCloseImportModal = document.getElementById("csBtnCloseImportModal");
  const csBtnCancelImport = document.getElementById("csBtnCancelImport");
  const csBtnSubmitImport = document.getElementById("csBtnSubmitImport");
  const csDropZone = document.getElementById("csDropZone");
  const csModalFileInput = document.getElementById("csModalFileInput");
  const csSelectedFileName = document.getElementById("csSelectedFileName");
  const csImportPasteArea = document.getElementById("csImportPasteArea");
  const csBtnPasteSample = document.getElementById("csBtnPasteSample");
  const csPreviewCountBadge = document.getElementById("csPreviewCountBadge");
  const csPreviewList = document.getElementById("csPreviewList");

  // Simulators
  const csSimUser = document.getElementById("csSimUser");
  const csSimGuess = document.getElementById("csSimGuess");
  const csBtnSimGuess = document.getElementById("csBtnSimGuess");
  const csBtnSimCorrect = document.getElementById("csBtnSimCorrect");
  const csBtnSimRandom = document.getElementById("csBtnSimRandom");

  let localState = null;
  let parsedQuestions = [];

  function onStateUpdate(state) {
    if (!state || state.gameId !== "crowd-says") return;
    localState = state;

    if (csHostQuestion) csHostQuestion.textContent = `${state.icon || "📣"} ${state.question || "--"}`;
    if (csHostCategory) csHostCategory.textContent = state.category || "General";
    if (csHostFoundCount) csHostFoundCount.textContent = `${state.foundCount || 0}/${state.totalSlots || 5} Found`;
    if (csHostTimerText) csHostTimerText.textContent = `${state.time || state.timerRemaining || 0}s`;

    // Render Secret Slots Cheat Sheet List
    if (csHostSlotsList && Array.isArray(state.secretSlots || state.slots)) {
      const slots = state.secretSlots || state.slots;
      csHostSlotsList.innerHTML = slots.map((s, idx) => {
        const isRevealed = s.revealed;
        const winner = s.winner;
        const statusHtml = isRevealed
          ? (winner
              ? `<span style="color:#4ade80;font-weight:700">✓ Found by @${winner.nickname || winner.user} (+${s.points}pts)</span>`
              : `<span style="color:#94a3b8;font-style:italic">Revealed (Missed)</span>`)
          : `<button type="button" class="chip btn-reveal-slot" data-slot="${idx}" style="font-size:11px;padding:2px 10px;background:#7c3aed;color:#fff;border:none">Reveal #${idx + 1}</button>`;

        const synPreview = (Array.isArray(s.synonyms) && s.synonyms.length > 1)
          ? `<span style="font-size:10px;color:var(--muted)">[Synonyms: ${s.synonyms.slice(0, 3).join(", ")}]</span>`
          : "";

        return `
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:6px 10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:900;color:#facc15;font-size:13px">#${s.rank}</span>
              <strong style="color:#fff;font-size:13px">${s.text}</strong>
              <span style="font-size:11px;color:#c084fc;font-weight:700">(${s.points} pts)</span>
              ${synPreview}
            </div>
            <div>${statusHtml}</div>
          </div>
        `;
      }).join("");

      // Wire reveal buttons
      csHostSlotsList.querySelectorAll(".btn-reveal-slot").forEach((btn) => {
        btn.onclick = () => {
          const slotIdx = btn.getAttribute("data-slot");
          socket.emit("gameAction", { gameId: "crowd-says", action: "revealSlot", options: slotIdx });
          showToast(`Revealed Slot #${parseInt(slotIdx, 10) + 1}`);
        };
      });
    }

    // Timer presets active state
    const activeSec = state.roundDurationSec || state.customDurationSec || state.time || 45;
    csPresetButtons.forEach((btn) => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      btn.classList.toggle("active", sec === activeSec);
    });
    if (csCustomSecInput && document.activeElement !== csCustomSecInput) {
      csCustomSecInput.value = state.customDurationSec || state.roundDurationSec || 45;
    }

    if (csBtnStartTimer) {
      csBtnStartTimer.textContent = state.isTimerActive ? "🔄 Restart Timer" : "▶ Start Timer";
    }

    // Populate Question Catalog Dropdown
    if (csQuestionSelect && Array.isArray(state.questions)) {
      if (csQuestionsCountBadge) {
        csQuestionsCountBadge.textContent = `${state.questions.length} Questions`;
      }
      const currentSelected = csQuestionSelect.value;
      csQuestionSelect.innerHTML = state.questions
        .map((q) => `<option value="${q.id}">${q.icon || "📣"} ${q.question} (${q.answerCount || 5} answers)</option>`)
        .join("");

      if (state.questionId) {
        csQuestionSelect.value = state.questionId;
      } else if (currentSelected) {
        csQuestionSelect.value = currentSelected;
      }
    }
  }

  // Timer Preset & Custom Buttons
  csPresetButtons.forEach((btn) => {
    btn.onclick = () => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      if (sec && sec > 0) {
        socket.emit("gameAction", { gameId: "crowd-says", action: "setTime", options: { sec } });
        showToast(`Timer set to ${sec}s`);
      }
    };
  });

  if (csBtnSaveCustomSec && csCustomSecInput) {
    csBtnSaveCustomSec.onclick = () => {
      const sec = parseInt(csCustomSecInput.value, 10);
      if (sec && sec > 0) {
        socket.emit("gameAction", { gameId: "crowd-says", action: "setTime", options: { sec } });
        showToast(`Timer set to ${sec}s`);
      }
    };
  }

  // Flow Action Buttons
  if (csBtnStartTimer) {
    csBtnStartTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "startTimer" });
      showToast("Timer Started");
    };
  }

  if (csBtnPauseTimer) {
    csBtnPauseTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "stopTimer" });
      showToast("Timer Paused");
    };
  }

  if (csBtnNextRound) {
    csBtnNextRound.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "nextRound" });
      showToast("Advanced to Next Survey");
    };
  }

  if (csBtnPrevRound) {
    csBtnPrevRound.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "prevRound" });
      showToast("Returned to Previous Survey");
    };
  }

  if (csBtnRandomRound) {
    csBtnRandomRound.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "newRound" });
      showToast("🎲 Random Survey Loaded");
    };
  }

  if (csBtnRevealAll) {
    csBtnRevealAll.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "revealAll" });
      showToast("Revealed All Answers");
    };
  }

  if (csBtnHideAll) {
    csBtnHideAll.onclick = () => {
      socket.emit("gameAction", { gameId: "crowd-says", action: "hideAll" });
      showToast("Hid All Answers");
    };
  }

  if (csBtnResetGame) {
    csBtnResetGame.onclick = () => {
      if (confirm("Reset Chat Feud game and scores?")) {
        socket.emit("gameAction", { gameId: "crowd-says", action: "resetGame" });
        showToast("Game Reset");
      }
    };
  }

  // Load question by select
  if (csBtnLoadQuestion && csQuestionSelect) {
    csBtnLoadQuestion.onclick = () => {
      const qId = csQuestionSelect.value;
      if (!qId) return;
      socket.emit("gameAction", { gameId: "crowd-says", action: "loadQuestionById", options: qId });
      showToast("Loaded Survey Question!");
    };
  }

  // --------------------------------------------------------------------------
  // Import Modal & Parser
  // --------------------------------------------------------------------------
  function openImportModal() {
    if (!csImportModal) return;
    csImportModal.style.display = "flex";
  }

  function closeImportModal() {
    if (!csImportModal) return;
    csImportModal.style.display = "none";
  }

  function updateImportPreview(textSource) {
    const text = typeof textSource === "string" ? textSource : (csImportPasteArea?.value || "");
    parsedQuestions = parseCrowdQuestionsInput(text);

    if (csPreviewCountBadge) {
      csPreviewCountBadge.textContent = `${parsedQuestions.length} Questions`;
      csPreviewCountBadge.className = parsedQuestions.length > 0 ? "badge badge-purple" : "badge";
    }

    if (csBtnSubmitImport) {
      csBtnSubmitImport.disabled = parsedQuestions.length === 0;
    }

    if (csPreviewList) {
      if (parsedQuestions.length === 0) {
        csPreviewList.innerHTML = `<div style="color:var(--muted);font-style:italic">Choose a file or paste questions above to see preview.</div>`;
      } else {
        const previewRows = parsedQuestions.slice(0, 4).map((q, idx) => {
          const ansText = q.answers.map((a) => a.text).join(", ");
          return `<div style="padding:2px 0"><strong>#${idx + 1}:</strong> "${q.question}" → <span style="color:#a78bfa">${ansText}</span></div>`;
        });
        if (parsedQuestions.length > 4) {
          previewRows.push(`<div style="color:var(--muted);font-style:italic;margin-top:2px">...and ${parsedQuestions.length - 4} more questions.</div>`);
        }
        csPreviewList.innerHTML = previewRows.join("");
      }
    }
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (csSelectedFileName) {
      csSelectedFileName.textContent = `📄 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      csSelectedFileName.style.display = "block";
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (csImportPasteArea) csImportPasteArea.value = content;
      updateImportPreview(content);
    };
    reader.readAsText(file);
  }

  if (csBtnOpenImportModal) csBtnOpenImportModal.onclick = () => openImportModal();
  if (csBtnCloseImportModal) csBtnCloseImportModal.onclick = () => closeImportModal();
  if (csBtnCancelImport) csBtnCancelImport.onclick = () => closeImportModal();

  if (csImportModal) {
    csImportModal.onclick = (e) => {
      if (e.target === csImportModal) closeImportModal();
    };
  }

  if (csDropZone && csModalFileInput) {
    csDropZone.onclick = () => csModalFileInput.click();
    csDropZone.ondragover = (e) => e.preventDefault();
    csDropZone.ondrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    };
    csModalFileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    };
  }

  if (csImportPasteArea) {
    csImportPasteArea.oninput = () => updateImportPreview(csImportPasteArea.value);
  }

  if (csBtnPasteSample && csImportPasteArea) {
    csBtnPasteSample.onclick = () => {
      const sample = `Name a popular morning beverage, Coffee / Tea / Orange Juice / Hot Chocolate / Milk
Name something you take to the beach, Towel / Sunscreen / Umbrella / Sunglasses / Swimsuit
Name an outdoor sport, Football / Tennis / Basketball / Baseball / Golf
Name something you find in a school backpack, Books / Pencil / Notebook / Lunchbox / Calculator`;
      csImportPasteArea.value = sample;
      updateImportPreview(sample);
      showToast("Loaded sample questions!");
    };
  }

  if (csBtnSubmitImport) {
    csBtnSubmitImport.onclick = () => {
      if (parsedQuestions.length === 0) {
        alert("Please provide at least one valid survey question.");
        return;
      }
      socket.emit("gameAction", {
        gameId: "crowd-says",
        action: "importQuestionSet",
        options: { questions: parsedQuestions }
      });
      showToast(`Imported ${parsedQuestions.length} survey questions!`);
      closeImportModal();
    };
  }

  // Simulators
  if (csBtnSimGuess) {
    csBtnSimGuess.onclick = () => {
      const user = (csSimUser?.value || "TestUser").trim();
      const guess = (csSimGuess?.value || "").trim();
      if (!guess) {
        alert("Please enter a guess to simulate.");
        return;
      }
      socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
      if (csSimGuess) csSimGuess.value = "";
      showToast(`Simulated guess: "${guess}" by @${user}`);
    };
  }

  if (csBtnSimCorrect) {
    csBtnSimCorrect.onclick = () => {
      const unrevealed = (localState?.secretSlots || localState?.slots || []).find((s) => !s.revealed);
      if (!unrevealed) {
        showToast("All slots already revealed!");
        return;
      }
      const user = (csSimUser?.value || "SmartGuesser").trim();
      socket.emit("simulateGuess", {
        username: user,
        nickname: user,
        message: unrevealed.text
      });
      showToast(`Simulated CORRECT GUESS: "${unrevealed.text}" by @${user}`);
    };
  }

  if (csBtnSimRandom) {
    csBtnSimRandom.onclick = () => {
      const randomWords = ["Taco", "Sushi", "Bicycle", "Dragon", "Kangaroo", "Pyramid", "Skateboard"];
      const rand = randomWords[Math.floor(Math.random() * randomWords.length)];
      const user = (csSimUser?.value || "Viewer" + Math.floor(Math.random() * 100)).trim();
      socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
      showToast(`Simulated incorrect guess: "${rand}" by @${user}`);
    };
  }

  return { onStateUpdate };
}
