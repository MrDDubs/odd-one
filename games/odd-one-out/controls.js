// games/odd-one-out/controls.js
export function initOddOneOutControls({ socket, showToast }) {
  const secretTarget = document.getElementById("secretTarget");
  const secretCategory = document.getElementById("secretCategory");
  const secretLevel = document.getElementById("secretLevel");
  const secretTimer = document.getElementById("secretTimer");

  const btnStartRound = document.getElementById("btnStartRound");
  const btnNextRound = document.getElementById("btnNextRound");
  const btnReveal = document.getElementById("btnReveal");
  const btnTogglePause = document.getElementById("btnTogglePause");
  const btnResetGame = document.getElementById("btnResetGame");

  const selectLevel = document.getElementById("selectLevel");
  const selectCategory = document.getElementById("selectCategory");
  const btnApplySettings = document.getElementById("btnApplySettings");

  const customSecInput = document.getElementById("customSecInput");
  const btnSaveCustomSec = document.getElementById("btnSaveCustomSec");

  const simUser = document.getElementById("simUser");
  const simGuess = document.getElementById("simGuess");
  const btnSimulateGuess = document.getElementById("btnSimulateGuess");
  const btnSimulateWin = document.getElementById("btnSimulateWin");
  const btnSimulateRandom = document.getElementById("btnSimulateRandom");

  let localState = null;

  function onStateUpdate(state) {
    if (!state || state.gameId !== "odd-one-out") return;
    localState = state;

    if (secretTarget) secretTarget.textContent = state.secretTarget || state.target || "--";
    if (secretCategory) secretCategory.textContent = (state.category || "FRUIT").toUpperCase();
    if (secretLevel) secretLevel.textContent = `LEVEL ${state.level || 1} (${state.levelName || "EASY"})`;
    if (secretTimer) secretTimer.textContent = `${state.time || 0}s`;

    if (btnTogglePause) {
      if (state.paused) {
        btnTogglePause.textContent = "▶ Resume Timer";
        btnTogglePause.className = "primary";
      } else {
        btnTogglePause.textContent = "⏸ Pause Timer";
        btnTogglePause.className = "secondary";
      }
    }

    document.querySelectorAll("[data-sec]").forEach((btn) => {
      const sec = parseInt(btn.getAttribute("data-sec"), 10);
      btn.classList.toggle("active", sec === state.roundDurationSec);
    });

    if (customSecInput && document.activeElement !== customSecInput) {
      customSecInput.value = state.roundDurationSec || 20;
    }

    if (selectCategory && document.activeElement !== selectCategory) {
      selectCategory.value = state.categoryOverride || "random";
    }

    if (selectLevel && document.activeElement !== selectLevel) {
      selectLevel.value = state.autoLevel ? "auto" : String(state.manualLevel || state.level);
    }
  }

  // Buttons
  if (btnStartRound) {
    btnStartRound.onclick = () => {
      socket.emit("gameAction", { gameId: "odd-one-out", action: "startRound" });
      showToast("Round Started");
    };
  }

  if (btnNextRound) {
    btnNextRound.onclick = () => {
      socket.emit("gameAction", { gameId: "odd-one-out", action: "nextRound" });
      showToast("Generated Next Round");
    };
  }

  if (btnReveal) {
    btnReveal.onclick = () => {
      socket.emit("gameAction", { gameId: "odd-one-out", action: "reveal" });
      showToast("Answer Revealed");
    };
  }

  if (btnTogglePause) {
    btnTogglePause.onclick = () => {
      socket.emit("gameAction", { gameId: "odd-one-out", action: "togglePause" });
    };
  }

  if (btnResetGame) {
    btnResetGame.onclick = () => {
      if (confirm("Reset game back to Round 1 and reset community streak?")) {
        socket.emit("gameAction", { gameId: "odd-one-out", action: "resetGame" });
        showToast("Game Reset");
      }
    };
  }

  if (btnSaveCustomSec && customSecInput) {
    btnSaveCustomSec.onclick = () => {
      const val = parseInt(customSecInput.value, 10);
      if (val && val >= 5) {
        socket.emit("gameAction", { gameId: "odd-one-out", action: "setOptions", options: { duration: val } });
        showToast(`Timer set to ${val}s`);
      } else {
        alert("Please enter a valid time (at least 5 seconds)");
      }
    };
  }

  document.querySelectorAll("[data-sec]").forEach((btn) => {
    btn.onclick = () => {
      const duration = parseInt(btn.getAttribute("data-sec"), 10);
      if (customSecInput) customSecInput.value = duration;
      socket.emit("gameAction", { gameId: "odd-one-out", action: "setOptions", options: { duration } });
      showToast(`Timer set to ${duration}s`);
    };
  });

  if (btnApplySettings) {
    btnApplySettings.onclick = () => {
      const cat = selectCategory.value;
      const lvlVal = selectLevel.value;
      const opts = {};

      if (cat !== "random") opts.category = cat;
      if (lvlVal === "auto") {
        opts.autoLevel = true;
      } else {
        opts.autoLevel = false;
        opts.level = parseInt(lvlVal, 10);
      }

      socket.emit("gameAction", { gameId: "odd-one-out", action: "setOptions", options: opts });
      showToast("Settings Applied");
    };
  }

  if (btnSimulateGuess) {
    btnSimulateGuess.onclick = () => {
      const user = (simUser?.value || "TestUser").trim();
      const guess = (simGuess?.value || "").trim().toUpperCase();
      if (!guess) {
        alert("Please enter a coordinate (e.g. A4)");
        return;
      }
      socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
      if (simGuess) simGuess.value = "";
      showToast(`Simulated guess: ${guess} by @${user}`);
    };
  }

  if (btnSimulateWin) {
    btnSimulateWin.onclick = () => {
      if (!localState?.secretTarget) return;
      const isFirst = !localState.roundWinners || localState.roundWinners.length === 0;
      const defaultUser = isFirst ? "SpeedyWinner" : "SecondWinner";
      const user = (simUser?.value || defaultUser).trim();

      socket.emit("simulateGuess", {
        username: user,
        nickname: user,
        message: localState.secretTarget
      });
      showToast(`Simulated WIN: ${localState.secretTarget} by @${user}`);
    };
  }

  if (btnSimulateRandom) {
    btnSimulateRandom.onclick = () => {
      const COLS = ["A", "B", "C", "D", "E", "F"];
      const ROWS = [1, 2, 3, 4];
      const rand = COLS[Math.floor(Math.random() * COLS.length)] + ROWS[Math.floor(Math.random() * ROWS.length)];
      const user = (simUser?.value || "Viewer" + Math.floor(Math.random() * 100)).trim();
      socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
      showToast(`Simulated guess: ${rand} by @${user}`);
    };
  }

  return { onStateUpdate };
}
