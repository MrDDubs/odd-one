// games/think-like-ally/controls.js
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

  const tlaPackSelect = document.getElementById("tlaPackSelect");
  const tlaBtnLoadPack = document.getElementById("tlaBtnLoadPack");

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
  let packsLoaded = false;

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

    // Populate question packs dropdown
    if (tlaPackSelect && state.questionSets && (!packsLoaded || tlaPackSelect.children.length <= 1)) {
      tlaPackSelect.innerHTML = state.questionSets
        .map((s) => `<option value="${s.id}">${s.name} (${s.count} questions)</option>`)
        .join("");
      packsLoaded = true;
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

  if (tlaBtnLoadPack && tlaPackSelect) {
    tlaBtnLoadPack.onclick = () => {
      const setId = tlaPackSelect.value;
      if (!setId) return;
      socket.emit("gameAction", { gameId: "think-like-ally", action: "loadQuestionSet", options: setId });
      showToast(`Loaded question pack!`);
    };
  }

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
