// games/unscramble/overlay.js (ESM)
const socket = io();

// DOM Elements
const roundPill = document.getElementById("roundPill");
const timerBox = document.getElementById("timerBox");
const timerNum = document.getElementById("timerNum");
const categoryBadge = document.getElementById("categoryBadge");
const categoryIcon = document.getElementById("categoryIcon");
const lengthPill = document.getElementById("lengthPill");
const hintBanner = document.getElementById("hintBanner");
const hintText = document.getElementById("hintText");
const scrambleTiles = document.getElementById("scrambleTiles");
const solutionSlots = document.getElementById("solutionSlots");
const winnerBanner = document.getElementById("winnerBanner");
const winnerAvatarWrap = document.getElementById("winnerAvatarWrap");
const winnerAvatarFallback = document.getElementById("winnerAvatarFallback");
const winnerAvatarImg = document.getElementById("winnerAvatarImg");
const winnerName = document.getElementById("winnerName");
const winnerPts = document.getElementById("winnerPts");
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

// Render Scrambled Tiles
function renderScrambleTiles(letters = []) {
  if (!scrambleTiles) return;
  scrambleTiles.innerHTML = letters
    .map((char, idx) => `
      <div class="scramble-tile" style="animation-delay: ${idx * 0.05}s">
        ${esc(char)}
      </div>
    `)
    .join("");
}

// Render Solution Slots
function renderSolutionSlots(slots = [], isRevealed = false, hasWinner = false) {
  if (!solutionSlots) return;
  solutionSlots.innerHTML = slots
    .map((char) => {
      let stateClass = "";
      if (char) {
        if (isRevealed) {
          stateClass = hasWinner ? "solved" : "missed";
        } else {
          stateClass = "revealed-hint";
        }
      }
      return `
        <div class="slot-box ${stateClass}">
          ${char ? esc(char) : "&nbsp;"}
        </div>
      `;
    })
    .join("");
}

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

  // Meta Row
  if (categoryBadge) categoryBadge.textContent = state.category || "GENERAL";
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

  // Scrambled Tiles
  if (Array.isArray(state.scrambled)) {
    renderScrambleTiles(state.scrambled);
  }

  // Solution Slots
  const hasWinner = Array.isArray(state.roundWinners) && state.roundWinners.length > 0;
  if (Array.isArray(state.slots)) {
    renderSolutionSlots(state.slots, !!state.isRevealed, hasWinner);
  }

  // Winner Banner
  if (winnerBanner) {
    if (state.isRevealed && hasWinner) {
      const winner = state.roundWinners[0];
      winnerBanner.style.display = "flex";
      if (winnerName) winnerName.textContent = `@${winner.nickname || winner.user}`;
      if (winnerPts) winnerPts.textContent = `+${winner.points || 25} pts`;

      if (winner.avatar && winnerAvatarImg) {
        winnerAvatarImg.src = winner.avatar;
        winnerAvatarImg.style.display = "block";
        if (winnerAvatarFallback) winnerAvatarFallback.style.display = "none";
      } else {
        if (winnerAvatarImg) winnerAvatarImg.style.display = "none";
        if (winnerAvatarFallback) winnerAvatarFallback.style.display = "block";
      }
    } else {
      winnerBanner.style.display = "none";
    }
  }

  // Streak
  if (streakValue) streakValue.textContent = state.streak || 0;
}

// 4-Second Round Results Modal (Top 3 Podium + Also Scored)
function showLeaderboardPopup(payload) {
  if (!elModal || !elModalPodium) return;

  const winners = (payload?.roundWinners && Array.isArray(payload.roundWinners)) ? payload.roundWinners : [];
  const durationMs = payload?.durationMs || 4000;

  // Render Top 3 Podium
  if (winners.length === 0) {
    elModalPodium.innerHTML = `
      <div style="font-size:13px;color:#cbd5e1;padding:12px;font-style:italic">
        Word missed this round! Next scrambled word coming up...
      </div>
    `;
    if (elModalAlsoScored) elModalAlsoScored.style.display = "none";
  } else {
    const top3 = winners.slice(0, 3);
    elModalPodium.innerHTML = top3.map((w, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? "first" : rank === 2 ? "second" : "third";
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
      const pts = w.points || 25;
      const avatarImg = w.avatar
        ? `<img src="${esc(w.avatar)}" class="podium-avatar" alt="${esc(w.nickname)}">`
        : `<div class="podium-avatar" style="background:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff">${(w.nickname || "?")[0].toUpperCase()}</div>`;

      return `
        <div class="podium-card ${rankClass}">
          <div class="podium-medal">${medal}</div>
          ${avatarImg}
          <div class="podium-name">@${esc(w.nickname || w.user)}</div>
          <div class="podium-pts">+${pts} pts</div>
        </div>
      `;
    }).join("");

    // Render Also Scored (4th Place and below)
    const alsoScored = winners.slice(3);
    if (alsoScored.length > 0 && elModalAlsoScored && elModalAlsoScoredList) {
      elModalAlsoScored.style.display = "block";
      elModalAlsoScoredList.innerHTML = alsoScored.map((w, idx) => `
        <span style="font-size:11px;background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:6px;color:#e2e8f0">
          #${idx + 4} @${esc(w.nickname || w.user)} (+${w.points || 10})
        </span>
      `).join("");
    } else if (elModalAlsoScored) {
      elModalAlsoScored.style.display = "none";
    }
  }

  // Countdown Progress Bar
  if (elModalProgressBar) {
    elModalProgressBar.style.width = "100%";
    const startTime = Date.now();
    clearInterval(modalProgressInterval);
    modalProgressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      elModalProgressBar.style.width = `${remainingPct}%`;
      if (elapsed >= durationMs) {
        clearInterval(modalProgressInterval);
      }
    }, 50);
  }

  // Show modal
  elModal.classList.add("active");

  clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    if (elModal) elModal.classList.remove("active");
  }, durationMs);
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
