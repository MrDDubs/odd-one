const socket = io();

if (window.initSpeechBubble) {
  window.initSpeechBubble({ socket });
}

// DOM Elements
const roundPill = document.getElementById("roundPill");
const categoryPill = document.getElementById("categoryPill");
const timerBox = document.getElementById("timerBox");
const timerNum = document.getElementById("timerNum");
const categoryBadge = document.getElementById("categoryBadge");
const categoryIcon = document.getElementById("categoryIcon");
const lengthPill = document.getElementById("lengthPill");
const hintBanner = document.getElementById("hintBanner");
const hintText = document.getElementById("hintText");
const scrambleTiles = document.getElementById("scrambleTiles");
const elSolversStage = document.getElementById("solversStage");
const elSolversList = document.getElementById("solversList");
const elSolversCountdown = document.getElementById("solversCountdown");
const streakValue = document.getElementById("streakValue");

// Modal Elements
const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalAlsoScored = document.getElementById("modalAlsoScored");
const elModalAlsoScoredList = document.getElementById("modalAlsoScoredList");
const elModalProgressBar = document.getElementById("modalProgressBar");
const elConfettiContainer = document.getElementById("confettiContainer");

let currentState = null;
let currentRound = 0;
let modalTimer = null;
let modalProgressInterval = null;

// Web Audio API Synthesizer
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "correct") {
      // Sparkling victory chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.3, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.36);
      });
    } else if (type === "fanfare") {
      // All letters solved triumph
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.35, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.51);
      });
    } else if (type === "tick") {
      // Low subtle clock tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === "timeout") {
      // Friendly round timeout buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } else if (type === "hint") {
      // Gentle sparkle hint
      [440, 554.37, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.2, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.26);
      });
    }
  } catch (err) {
    // Audio context may require user interaction
  }
}

// Confetti Particle Explosion
function launchCuteConfetti() {
  if (!elConfettiContainer) return;
  elConfettiContainer.innerHTML = "";
  const count = 48;
  const colors = ["#a855f7", "#06b6d4", "#facc15", "#10b981", "#f43f5e", "#ffffff"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    elConfettiContainer.appendChild(piece);
  }

  setTimeout(() => {
    if (elConfettiContainer) elConfettiContainer.innerHTML = "";
  }, 3200);
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Authentic Scrabble Letter Point Values
const SCRABBLE_POINTS = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

let lastScrambledLettersKey = "";
let lastRenderedWordId = null;

// Render Scrambled Wooden Tiles (Only updates DOM if letters or reveal change)
function renderScrambleTiles(letters = [], isRevealed = false, hasWinner = false, solvedWord = null) {
  if (!scrambleTiles) return;

  const displayLetters = (isRevealed && solvedWord)
    ? solvedWord.toUpperCase().split("")
    : (Array.isArray(letters) ? letters : String(letters || "").split(""));

  const isSolved = isRevealed && hasWinner;
  const isMissed = isRevealed && !hasWinner;
  const lettersKey = `${displayLetters.join("")}_${isRevealed ? 1 : 0}_${isSolved ? 1 : 0}`;
  if (lettersKey && lettersKey === lastScrambledLettersKey) {
    return; // Don't wipe DOM if letters are unchanged!
  }
  lastScrambledLettersKey = lettersKey;

  scrambleTiles.innerHTML = displayLetters
    .map((char) => {
      const upper = (char || "").toUpperCase();
      const pts = SCRABBLE_POINTS[upper] !== undefined ? SCRABBLE_POINTS[upper] : "";
      const stateClass = isSolved ? "solved" : isMissed ? "missed" : "";
      return `
        <div class="scramble-tile ${stateClass}">
          <span class="tile-letter">${esc(upper)}</span>
          ${pts !== "" ? `<span class="tile-pts">${pts}</span>` : ""}
        </div>
      `;
    })
    .join("");
}

// Fallback no-op for solution slots (stage removed)
function renderSolutionSlots() {}

// State Handler
function handleState(state) {
  if (!state) return;
  if (state.gameId && state.gameId !== "unscramble") return;
  currentState = state;

  // Round change detection
  if (state.round && state.round !== currentRound) {
    currentRound = state.round;
    if (elModal) elModal.classList.remove("active");
  }

let lastRenderedSolversKey = "";

function renderSolversList(winners = []) {
  if (!elSolversList) return;
  const key = winners.map((w) => `${w.user || w.username}_${w.points || 0}`).join(",");
  if (key === lastRenderedSolversKey) return;
  lastRenderedSolversKey = key;

  elSolversList.innerHTML = winners
    .map((w, idx) => {
      const place = w.place || (idx + 1);
      const placeClass = place === 1 ? "place-1" : "";
      const placeText = place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`;
      const pts = w.points || 25;
      const initial = (w.nickname || w.user || "?")[0].toUpperCase();

      const avatarHtml = w.avatar
        ? `<img src="${esc(w.avatar)}" class="solver-avatar-img" alt="${esc(w.nickname || w.user)}">`
        : `<div class="solver-avatar-fallback">${esc(initial)}</div>`;

      return `
        <div class="solver-card ${placeClass}">
          <div class="solver-avatar-wrap">
            ${avatarHtml}
            <span class="solver-place-pill">${placeText}</span>
          </div>
          <span class="solver-name">@${esc(w.nickname || w.user)}</span>
          <span class="solver-pts">+${pts} pts</span>
        </div>
      `;
    })
    .join("");
}

  // Word change detection: resets keys so the new word's tiles mount smoothly
  if (state.wordId && state.wordId !== lastRenderedWordId) {
    lastRenderedWordId = state.wordId;
    lastScrambledLettersKey = "";
    lastRenderedSolversKey = "";
    if (elSolversStage) elSolversStage.style.display = "none";
  }

  // Round & Timer
  if (roundPill) roundPill.textContent = `ROUND ${state.round || 1}`;

  const seconds = typeof state.time === "number" ? Math.max(0, state.time) : 45;
  if (timerNum) timerNum.textContent = seconds;

  if (timerBox) {
    if (seconds <= 5 && state.isTimerActive && seconds > 0) {
      timerBox.classList.add("danger");
      playSound("tick");
    } else {
      timerBox.classList.remove("danger");
    }
  }

  // Meta Row & Header Topic
  if (categoryBadge) categoryBadge.textContent = state.category || "GENERAL";
  if (categoryPill) categoryPill.textContent = (state.category || "GENERAL").toUpperCase();
  if (categoryIcon) categoryIcon.textContent = state.emoji || "🔤";
  if (lengthPill) lengthPill.textContent = `${state.length || 5} LETTERS`;

  // Hint Banner
  if (hintBanner) {
    if (state.hint && state.hintRevealed) {
      hintBanner.style.display = "flex";
      if (hintText) hintText.textContent = state.hint;
    } else {
      hintBanner.style.display = "none";
    }
  }

  // Scrambled Wooden Tiles
  const hasWinner = Array.isArray(state.roundWinners) && state.roundWinners.length > 0;
  if (Array.isArray(state.scrambled) || state.isRevealed) {
    renderScrambleTiles(state.scrambled || [], !!state.isRevealed, hasWinner, state.word);
  }

  // Solvers List / Profile Pictures Below Board
  if (elSolversStage && elSolversList) {
    const winners = Array.isArray(state.roundWinners) ? state.roundWinners : [];
    if (winners.length > 0) {
      elSolversStage.style.display = "flex";

      if (elSolversCountdown) {
        if (!state.isRevealed && state.time > 0) {
          elSolversCountdown.style.display = "inline-block";
          elSolversCountdown.textContent = `⏱️ ${state.time}s remaining!`;
        } else {
          elSolversCountdown.style.display = "none";
        }
      }

      renderSolversList(winners);
    } else {
      elSolversStage.style.display = "none";
    }
  }

  // Streak
  if (streakValue) streakValue.textContent = state.streak || 0;
}

// 4-Second Round Results Modal (Top 3 Podium + Also Scored)
function showLeaderboardPopup(payload) {
  if (typeof window.showRoundPointsModal === "function") {
    window.showRoundPointsModal(payload);
    return;
  }
}

// Socket Events
socket.on("connect", () => {
  console.log("[Unscramble] Connected to stream hub server");
});

socket.on("gameState", (data) => {
  handleState(data);
});

socket.on("roundStarted", (data) => {
  if (elModal) elModal.classList.remove("active");
  handleState(data);
});

socket.on("winnerFound", (data) => {
  if (data && (data.gameId === "unscramble" || !data.gameId)) {
    playSound("correct");
    setTimeout(() => playSound("fanfare"), 300);
    launchCuteConfetti();
  }
});

socket.on("timeExpired", (data) => {
  if (data && (data.target === "unscramble" || !data.target)) {
    playSound("timeout");
  }
});

socket.on("showLeaderboardPopup", (payload) => {
  showLeaderboardPopup(payload);
});
