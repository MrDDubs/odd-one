// games/think-and-link/controls.js
export function initThinkAndLinkControls({ socket, showToast }) {
  const talTopicDisplay = document.getElementById("talTopicDisplay");
  const talCategoryDisplay = document.getElementById("talCategoryDisplay");
  const talTimerText = document.getElementById("talTimerText");
  const talStreakText = document.getElementById("talStreakText");
  const talFoundCountText = document.getElementById("talFoundCountText");
  const talSecretSlotsGrid = document.getElementById("talSecretSlotsGrid");

  const talBtnStartTimer = document.getElementById("talBtnStartTimer");
  const talBtnPauseTimer = document.getElementById("talBtnPauseTimer");
  const talBtnRevealAll = document.getElementById("talBtnRevealAll");
  const talBtnHideUnsolved = document.getElementById("talBtnHideUnsolved");
  const talBtnNextPuzzle = document.getElementById("talBtnNextPuzzle");
  const talBtnResetGame = document.getElementById("talBtnResetGame");

  const talPuzzleSelect = document.getElementById("talPuzzleSelect");
  const talBtnLoadPuzzle = document.getElementById("talBtnLoadPuzzle");
  const talBtnRandomPuzzle = document.getElementById("talBtnRandomPuzzle");

  const talCustomTopic = document.getElementById("talCustomTopic");
  const talCustomEmoji = document.getElementById("talCustomEmoji");
  const talCustomCategory = document.getElementById("talCustomCategory");
  const talBtnSetCustom = document.getElementById("talBtnSetCustom");

  const talSimUser = document.getElementById("talSimUser");
  const talSimGuess = document.getElementById("talSimGuess");
  const talBtnSimGuess = document.getElementById("talBtnSimGuess");
  const talBtnSimNextWin = document.getElementById("talBtnSimNextWin");
  const talBtnSimSolveAll = document.getElementById("talBtnSimSolveAll");
  const talBtnSimRandom = document.getElementById("talBtnSimRandom");

  let localState = null;
  let puzzlesListLoaded = false;

  function renderSecretSlots(slots) {
    if (!talSecretSlotsGrid) return;
    if (!Array.isArray(slots)) return;

    let html = "";
    slots.forEach((s, idx) => {
      const isRevealed = !!s.revealed;
      const foundBy = s.foundBy;
      let statusBadge = "";
      if (foundBy) {
        statusBadge = `<span class="badge badge-green" style="font-size:10px">Solved @${foundBy.nickname || foundBy.user}</span>`;
      } else if (isRevealed) {
        statusBadge = `<span class="badge badge-purple" style="font-size:10px">Revealed</span>`;
      } else {
        statusBadge = `<span class="badge badge-red" style="font-size:10px">Hidden</span>`;
      }

      html += `
        <div class="tal-secret-slot-card ${isRevealed ? 'revealed' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <strong style="font-size:13px;color:#f1f5f9">#${idx + 1} ${s.word}</strong>
            ${statusBadge}
          </div>
          <div style="font-family:monospace;font-size:12px;color:var(--muted);margin-bottom:6px">
            Hint: <span style="color:#e2e8f0;letter-spacing:1px">${s.hint || "_"}</span>
          </div>
          <div style="display:flex;justify-content:flex-end">
            ${
              !isRevealed
                ? `<button class="chip btn-reveal-slot" data-slot="${idx}" style="font-size:10px;padding:3px 8px">👁 Reveal</button>`
                : `<span style="font-size:10px;color:#10b981">✓ Visible</span>`
            }
          </div>
        </div>
      `;
    });

    talSecretSlotsGrid.innerHTML = html;

    // Attach individual reveal button listeners
    talSecretSlotsGrid.querySelectorAll(".btn-reveal-slot").forEach((btn) => {
      btn.onclick = () => {
        const slotIdx = btn.getAttribute("data-slot");
        socket.emit("gameAction", {
          gameId: "think-and-link",
          action: "revealSlot",
          options: slotIdx
        });
        showToast(`Revealed Word #${parseInt(slotIdx, 10) + 1}`);
      };
    });
  }

  function onStateUpdate(state) {
    if (!state || state.gameId !== "think-and-link") return;
    localState = state;

    if (talTopicDisplay) {
      talTopicDisplay.textContent = `${state.topic || "PIZZA"} ${state.emoji || "🍕"}`;
    }
    if (talCategoryDisplay) {
      talCategoryDisplay.textContent = `Category: ${state.category || "General"}`;
    }
    if (talTimerText) {
      talTimerText.textContent = `${state.time ?? state.timerRemaining ?? 0}s`;
    }
    if (talStreakText) {
      talStreakText.textContent = `🔥 ${state.streak ?? 0}`;
    }
    if (talFoundCountText) {
      talFoundCountText.textContent = `${state.foundCount ?? 0}/${state.totalWords ?? 6}`;
    }

    if (talBtnStartTimer) {
      talBtnStartTimer.textContent = state.isTimerActive ? "🔄 Restart Timer" : "▶ Start Timer";
    }

    // Render 6 Secret Slots Grid
    const secretSlots = state.secretSlots || state.slots;
    if (secretSlots) {
      renderSecretSlots(secretSlots);
    }

    // Populate Curated Puzzles Dropdown
    if (talPuzzleSelect && state.puzzles && (!puzzlesListLoaded || talPuzzleSelect.children.length <= 1)) {
      talPuzzleSelect.innerHTML = state.puzzles
        .map((p) => `<option value="${p.id}">${p.emoji} ${p.topic} — [${p.category}] (${(p.words || []).join(", ")})</option>`)
        .join("");
      puzzlesListLoaded = true;
      if (state.puzzleId) {
        talPuzzleSelect.value = state.puzzleId;
      }
    }
  }

  // Button Action Handlers
  if (talBtnStartTimer) {
    talBtnStartTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "think-and-link", action: "startTimer" });
      showToast("Think & Link Timer Started!");
    };
  }

  if (talBtnPauseTimer) {
    talBtnPauseTimer.onclick = () => {
      socket.emit("gameAction", { gameId: "think-and-link", action: "stopTimer" });
      showToast("Timer Paused");
    };
  }

  if (talBtnRevealAll) {
    talBtnRevealAll.onclick = () => {
      socket.emit("gameAction", { gameId: "think-and-link", action: "reveal" });
      showToast("All Words Revealed");
    };
  }

  if (talBtnHideUnsolved) {
    talBtnHideUnsolved.onclick = () => {
      socket.emit("gameAction", { gameId: "think-and-link", action: "hideAnswer" });
      showToast("Unsolved Words Hidden");
    };
  }

  if (talBtnNextPuzzle) {
    talBtnNextPuzzle.onclick = () => {
      socket.emit("gameAction", { gameId: "think-and-link", action: "nextRound" });
      showToast("Loaded Next Puzzle!");
    };
  }

  if (talBtnResetGame) {
    talBtnResetGame.onclick = () => {
      if (confirm("Reset Think & Link game and streak?")) {
        socket.emit("gameAction", { gameId: "think-and-link", action: "resetGame" });
        showToast("Game Reset");
      }
    };
  }

  if (talBtnLoadPuzzle && talPuzzleSelect) {
    talBtnLoadPuzzle.onclick = () => {
      const pId = talPuzzleSelect.value;
      if (!pId) return;
      socket.emit("gameAction", { gameId: "think-and-link", action: "loadPuzzleById", options: pId });
      showToast(`Loaded puzzle ${pId}`);
    };
  }

  if (talBtnRandomPuzzle && talPuzzleSelect) {
    talBtnRandomPuzzle.onclick = () => {
      if (!localState?.puzzles?.length) return;
      const rand = localState.puzzles[Math.floor(Math.random() * localState.puzzles.length)];
      if (rand && rand.id) {
        talPuzzleSelect.value = rand.id;
        socket.emit("gameAction", { gameId: "think-and-link", action: "loadPuzzleById", options: rand.id });
        showToast(`Loaded Random: ${rand.emoji} ${rand.topic}`);
      }
    };
  }

  if (talBtnSetCustom) {
    talBtnSetCustom.onclick = () => {
      const topic = (talCustomTopic?.value || "").trim();
      const emoji = (talCustomEmoji?.value || "💜").trim();
      const category = (talCustomCategory?.value || "Custom").trim();

      const words = [
        (document.getElementById("talWord0")?.value || "").trim(),
        (document.getElementById("talWord1")?.value || "").trim(),
        (document.getElementById("talWord2")?.value || "").trim(),
        (document.getElementById("talWord3")?.value || "").trim(),
        (document.getElementById("talWord4")?.value || "").trim(),
        (document.getElementById("talWord5")?.value || "").trim()
      ].filter(Boolean);

      if (!topic || words.length < 6) {
        alert("Please enter a Topic name and all 6 associated words!");
        return;
      }

      socket.emit("gameAction", {
        gameId: "think-and-link",
        action: "setCustomPuzzle",
        options: { topic, emoji, category, words }
      });
      showToast(`Custom Puzzle Launched: ${topic} ${emoji}`);
    };
  }

  // Live Test Simulators
  if (talBtnSimGuess) {
    talBtnSimGuess.onclick = () => {
      const user = (talSimUser?.value || "Viewer").trim();
      const guess = (talSimGuess?.value || "").trim();
      if (!guess) {
        alert("Please enter a word guess to simulate.");
        return;
      }
      socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
      if (talSimGuess) talSimGuess.value = "";
      showToast(`Simulated guess: "${guess}" by @${user}`);
    };
  }

  if (talBtnSimNextWin) {
    talBtnSimNextWin.onclick = () => {
      const secretSlots = localState?.secretSlots || localState?.slots || [];
      const unrevealed = secretSlots.find((s) => !s.revealed);
      if (!unrevealed) {
        showToast("All words in current puzzle are already solved!");
        return;
      }
      const user = (talSimUser?.value || "SuperGuesser").trim();
      socket.emit("simulateGuess", {
        username: user,
        nickname: user,
        message: unrevealed.word
      });
      showToast(`Simulated SOLVE: "${unrevealed.word}" by @${user}`);
    };
  }

  if (talBtnSimSolveAll) {
    talBtnSimSolveAll.onclick = () => {
      const secretSlots = localState?.secretSlots || localState?.slots || [];
      const unrevealed = secretSlots.filter((s) => !s.revealed);
      if (unrevealed.length === 0) {
        showToast("All words already solved!");
        return;
      }
      unrevealed.forEach((s, i) => {
        setTimeout(() => {
          const user = `ProGuesser${i + 1}`;
          socket.emit("simulateGuess", {
            username: user,
            nickname: user,
            message: s.word
          });
        }, i * 350);
      });
      showToast(`Simulating full puzzle clear! (${unrevealed.length} words)`);
    };
  }

  if (talBtnSimRandom) {
    talBtnSimRandom.onclick = () => {
      const randomWords = ["Spaghetti", "Bicycle", "Dragon", "Kangaroo", "Rainbow", "Spaceship", "Guitar", "Notebook"];
      const rand = randomWords[Math.floor(Math.random() * randomWords.length)];
      const user = (talSimUser?.value || "Viewer" + Math.floor(Math.random() * 100)).trim();
      socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
      showToast(`Simulated guess: "${rand}" by @${user}`);
    };
  }

  return { onStateUpdate };
}
