// games/rebus/overlay.js — Live Stream Rebus Overlay Client
(function () {
  const socket = typeof io !== "undefined" ? io() : null;

  // DOM Elements
  const roundPill = document.getElementById("roundPill");
  const categoryPill = document.getElementById("categoryPill");
  const difficultyPill = document.getElementById("difficultyPill");
  const timerBox = document.getElementById("timerBox");
  const timerNum = document.getElementById("timerNum");

  const rebusCanvas = document.getElementById("rebusCanvas");
  const clueCard = document.getElementById("clueCard");
  const clueText = document.getElementById("clueText");
  const slotsContainer = document.getElementById("slotsContainer");

  const streakBadgeWrap = document.getElementById("streakBadgeWrap");
  const streakCount = document.getElementById("streakCount");

  const celebrationBanner = document.getElementById("celebrationBanner");
  const celebrationAvatar = document.getElementById("celebrationAvatar");
  const celebrationWinner = document.getElementById("celebrationWinner");
  const celebrationAnswer = document.getElementById("celebrationAnswer");
  const celebrationPoints = document.getElementById("celebrationPoints");

  const podiumModal = document.getElementById("podiumModal");
  const podiumAnswer = document.getElementById("podiumAnswer");
  const podiumList = document.getElementById("podiumList");
  const podiumCountdown = document.getElementById("podiumCountdown");

  const speechBubble = document.getElementById("speechBubbleText");

  // State Caches (To avoid flashing on timer ticks!)
  let lastPuzzleId = null;
  let lastHintLevel = null;
  let lastRevealedState = null;
  let celebrationTimeout = null;
  let countdownTimer = null;

  // Web Audio Synthesizer for SFX
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && AudioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = "sine", gainLevel = 0.15) {
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function playSuccessJingle() {
    playTone(523.25, 0.15, "triangle", 0.2); // C5
    setTimeout(() => playTone(659.25, 0.15, "triangle", 0.2), 100); // E5
    setTimeout(() => playTone(783.99, 0.18, "triangle", 0.2), 200); // G5
    setTimeout(() => playTone(1046.5, 0.35, "triangle", 0.25), 320); // C6
  }

  function playTimeExpiredSound() {
    playTone(220, 0.25, "sawtooth", 0.2);
    setTimeout(() => playTone(180, 0.35, "sawtooth", 0.22), 200);
  }

  // ==========================================
  // Layout Canvas Renderers
  // ==========================================
  function renderLayout(layout, visual) {
    if (!visual) return `<div class="rebus-word">?</div>`;

    switch (layout) {
      case "stacked": {
        const top = visual.top || visual.text || "";
        const bottom = visual.bottom || "";
        const divider = visual.divider !== false ? `<div class="stacked-divider"></div>` : "";
        return `
          <div class="layout-stacked">
            <div class="rebus-word stacked-top">${escapeHtml(top)}</div>
            ${divider}
            <div class="rebus-word stacked-bottom">${escapeHtml(bottom)}</div>
          </div>
        `;
      }

      case "fraction": {
        const num = visual.numerator || visual.num || visual.top || "";
        const den = visual.denominator || visual.den || visual.bottom || "";
        return `
          <div class="layout-fraction">
            <div class="rebus-word fraction-num">${escapeHtml(num)}</div>
            <div class="fraction-bar"></div>
            <div class="rebus-word fraction-den">${escapeHtml(den)}</div>
          </div>
        `;
      }

      case "inside": {
        const outer = visual.outer || "";
        const inner = visual.inner || visual.text || "";
        return `
          <div class="layout-inside">
            <div class="inside-outer">${escapeHtml(outer)}</div>
            <div class="inside-inner">${escapeHtml(inner)}</div>
          </div>
        `;
      }

      case "repeat": {
        const items = Array.isArray(visual.items)
          ? visual.items
          : (visual.word ? Array(visual.count || 3).fill(visual.word) : [visual.text || ""]);
        const html = items.map((it) => `<div class="rebus-word repeat-item">${escapeHtml(it)}</div>`).join("");
        return `<div class="layout-repeat">${html}</div>`;
      }

      case "styled_color": {
        const text = visual.text || visual.word || "";
        const color = visual.color || visual.hex || "#22c55e";
        return `
          <div class="layout-styled_color">
            <div class="rebus-word styled-word" style="color: ${escapeHtml(color)}">${escapeHtml(text)}</div>
          </div>
        `;
      }

      case "styled_scale": {
        const text = visual.text || visual.word || "";
        const scale = visual.scale || "giant";
        return `
          <div class="layout-styled_scale scale-${escapeHtml(scale)}">
            <div class="rebus-word scale-word scale-${escapeHtml(scale)}">${escapeHtml(text)}</div>
          </div>
        `;
      }

      case "reversed": {
        const text = visual.display || visual.text || visual.word || "";
        return `
          <div class="layout-reversed">
            <div class="rebus-word reversed-text">${escapeHtml(text)}</div>
            <div class="arrow-indicator">◀</div>
          </div>
        `;
      }

      case "spacing": {
        const text = visual.text || visual.word || "";
        const spacing = visual.spacing === "wide" ? "20px" : (visual.letterSpacing || "20px");
        return `
          <div class="layout-spacing">
            <div class="rebus-word spacing-text" style="letter-spacing: ${escapeHtml(spacing)}">${escapeHtml(text)}</div>
          </div>
        `;
      }

      case "missing_letter": {
        const full = visual.text || visual.display || visual.word || "";
        const chars = full.split("").map((c) => {
          if (c === "_" || c === " ") {
            return `<span class="missing-slot">_</span>`;
          }
          return `<span class="normal-letter">${escapeHtml(c)}</span>`;
        }).join("");
        return `<div class="layout-missing_letter">${chars}</div>`;
      }

      case "strikethrough": {
        const text = visual.text || visual.word || "";
        return `
          <div class="layout-strikethrough">
            <div class="rebus-word strike-text">${escapeHtml(text)}</div>
          </div>
        `;
      }

      case "positional": {
        const text = visual.text || visual.word || "";
        const pos = visual.pos || "top";
        return `
          <div class="layout-positional pos-${escapeHtml(pos)}">
            <div class="rebus-word pos-word pos-${escapeHtml(pos)}">${escapeHtml(text)}</div>
          </div>
        `;
      }

      case "boxed": {
        const text = visual.text || visual.word || "";
        if (visual.outside) {
          return `
            <div class="layout-boxed-outside">
              <div class="rebus-word outside-text">${escapeHtml(text)}</div>
              <div class="empty-box">BOX</div>
            </div>
          `;
        }
        return `
          <div class="layout-boxed">
            <div class="rebus-word boxed-wrap">${escapeHtml(text)}</div>
          </div>
        `;
      }

      default: {
        const fallback = visual.text || visual.word || visual.display || visual.top || "REBUS";
        return `<div class="rebus-word fallback-word">${escapeHtml(fallback)}</div>`;
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ==========================================
  // Render Slots (Word blocks & Blank pills)
  // ==========================================
  function renderSlots(slots) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      slotsContainer.innerHTML = "";
      return;
    }

    const html = slots.map((word) => {
      const charsHtml = word.map((char) => {
        if (!char) {
          return `<div class="char-slot blank"></div>`;
        }
        if (char === "_") {
          return `<div class="char-slot blank">_</div>`;
        }
        if (/[A-Z0-9]/i.test(char)) {
          return `<div class="char-slot revealed">${escapeHtml(char)}</div>`;
        }
        return `<div class="char-slot punctuation">${escapeHtml(char)}</div>`;
      }).join("");

      return `<div class="word-block">${charsHtml}</div>`;
    }).join("");

    slotsContainer.innerHTML = html;
  }

  // ==========================================
  // State Sync Handler
  // ==========================================
  function updateGameState(data) {
    if (!data) return;

    // 1. Always update Timer (No card re-render so it never flashes!)
    const timeLeft = typeof data.time === "number" ? data.time : (data.timerRemaining ?? 45);
    timerNum.textContent = Math.max(0, timeLeft);

    if (timeLeft <= 10 && data.isTimerActive) {
      timerBox.classList.add("danger");
    } else {
      timerBox.classList.remove("danger");
    }

    // 2. Round & Meta Pills
    if (roundPill && data.round) {
      roundPill.textContent = `ROUND ${data.round}`;
    }
    if (categoryPill && data.category) {
      categoryPill.textContent = String(data.category).toUpperCase();
    }
    if (difficultyPill && data.difficulty) {
      difficultyPill.textContent = String(data.difficulty).toUpperCase();
      if (String(data.difficulty).toLowerCase() === "hard") {
        difficultyPill.classList.add("hard");
      } else {
        difficultyPill.classList.remove("hard");
      }
    }

    // 3. Streak Pill
    if (streakBadgeWrap && streakCount) {
      if (data.streak && data.streak > 1) {
        streakBadgeWrap.style.display = "block";
        streakCount.textContent = data.streak;
      } else {
        streakBadgeWrap.style.display = "none";
      }
    }

    // 4. Clue Banner
    if (clueCard && clueText) {
      if (data.hintClue && data.hintLevel >= 1) {
        clueText.textContent = data.hintClue;
        clueCard.style.display = "flex";
      } else {
        clueCard.style.display = "none";
      }
    }

    // 5. Speech Bubble message if provided
    if (speechBubble && data.statusMessage) {
      speechBubble.textContent = data.statusMessage;
    }

    // 6. Check if Puzzle changed or Reveal state changed
    const puzzleKey = `${data.puzzleId || ""}`;
    const needsFullCanvasRender = (puzzleKey !== lastPuzzleId);
    const needsSlotRender = needsFullCanvasRender || (data.hintLevel !== lastHintLevel) || (data.isRevealed !== lastRevealedState);

    if (needsFullCanvasRender) {
      lastPuzzleId = puzzleKey;
      rebusCanvas.innerHTML = renderLayout(data.layout, data.visual);
    }

    if (needsSlotRender) {
      lastHintLevel = data.hintLevel;
      lastRevealedState = data.isRevealed;
      renderSlots(data.maskedSlots);
    }
  }

  // ==========================================
  // Celebration Banner Display
  // ==========================================
  function showCelebration(winner, answer, points) {
    if (!celebrationBanner) return;

    celebrationWinner.textContent = `@${winner.nickname || winner.user || "Viewer"}`;
    celebrationAnswer.textContent = answer || "";
    celebrationPoints.textContent = `+${points || 30} PTS`;

    if (winner.avatar && celebrationAvatar) {
      celebrationAvatar.src = winner.avatar;
      celebrationAvatar.style.display = "block";
    } else if (celebrationAvatar) {
      celebrationAvatar.src = "/ally-avatar.png";
    }

    celebrationBanner.classList.add("show");
    playSuccessJingle();

    clearTimeout(celebrationTimeout);
    celebrationTimeout = setTimeout(() => {
      celebrationBanner.classList.remove("show");
    }, 4500);
  }

  // ==========================================
  // Leaderboard Podium Modal
  // ==========================================
  function showPodium(data) {
    if (!podiumModal) return;

    podiumAnswer.textContent = data.target || "REBUS PUZZLE";

    // Build Podium list
    if (podiumList) {
      const topUsers = data.leaderboard || [];
      if (topUsers.length === 0) {
        podiumList.innerHTML = `<div style="color:#94a3b8;padding:8px;font-size:13px;">No scores yet — be the first to guess!</div>`;
      } else {
        podiumList.innerHTML = topUsers.slice(0, 5).map((u, i) => `
          <div class="podium-row">
            <span class="podium-rank">#${i + 1}</span>
            <span class="podium-user">@${escapeHtml(u.nickname || u.username)}</span>
            <span class="podium-pts">${u.score} pts</span>
          </div>
        `).join("");
      }
    }

    podiumModal.classList.add("show");

    // Countdown
    let secondsLeft = Math.ceil((data.durationMs || 5000) / 1000);
    podiumCountdown.textContent = secondsLeft;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft >= 0) {
        podiumCountdown.textContent = secondsLeft;
      }
      if (secondsLeft <= 0) {
        clearInterval(countdownTimer);
      }
    }, 1000);
  }

  function hidePodium() {
    if (!podiumModal) return;
    podiumModal.classList.remove("show");
    clearInterval(countdownTimer);
  }

  // ==========================================
  // Socket Events
  // ==========================================
  if (socket) {
    socket.on("gameState", (data) => {
      if (data && (data.gameId === "rebus" || data.activeGameId === "rebus" || !data.gameId)) {
        updateGameState(data);
      }
    });

    socket.on("winnerFound", (data) => {
      if (data && (data.gameId === "rebus" || !data.gameId)) {
        showCelebration(data.winner || {}, data.target || data.word, data.points);
      }
    });

    socket.on("timeExpired", (data) => {
      playTimeExpiredSound();
    });

    socket.on("showLeaderboardPopup", (data) => {
      if (typeof window.showRoundPointsModal === "function") {
        window.showRoundPointsModal(data);
      }
    });

    socket.on("roundStarted", (data) => {
      const elModal = document.getElementById("leaderboardModal");
      if (elModal) elModal.classList.remove("active");
      if (data && (data.gameId === "rebus" || data.activeGameId === "rebus" || !data.gameId)) {
        updateGameState(data);
      }
    });
  }

  // Enable audio context on any user click
  document.addEventListener("click", () => initAudio(), { once: true });
})();
