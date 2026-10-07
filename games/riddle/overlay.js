// games/riddle/overlay.js (ESM)
const socket = io();

// DOM Elements
const roundPill = document.getElementById("roundPill");
const categoryPill = document.getElementById("categoryPill");
const difficultyPill = document.getElementById("difficultyPill");
const timerBox = document.getElementById("timerBox");
const timerNum = document.getElementById("timerNum");

const graceAlertBanner = document.getElementById("graceAlertBanner");
const graceCountdownNum = document.getElementById("graceCountdownNum");

const riddleEmoji = document.getElementById("riddleEmoji");
const riddleText = document.getElementById("riddleText");

const answerLengthLabel = document.getElementById("answerLengthLabel");
const hintTilesWrap = document.getElementById("hintTilesWrap");

const clueCard = document.getElementById("clueCard");
const clueText = document.getElementById("clueText");

const celebrationCard = document.getElementById("celebrationCard");
const celebrationTitle = document.getElementById("celebrationTitle");
const revealedAnswerText = document.getElementById("revealedAnswerText");
const podiumWinnersList = document.getElementById("podiumWinnersList");

const streakPill = document.getElementById("streakPill");
const statusMessage = document.getElementById("statusMessage");

let lastRound = null;
let lastRiddleId = null;
let confettiTriggered = false;

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMaskedLettersHTML(masked) {
  if (!masked) return "";
  const words = masked.split(" ");
  return words.map((w) => {
    const chars = w.split("").map((ch) => {
      if (ch === "_") {
        return `<span class="hint-tile blank">_</span>`;
      } else if (/[a-zA-Z0-9]/.test(ch)) {
        return `<span class="hint-tile revealed">${esc(ch)}</span>`;
      } else {
        return `<span class="hint-tile punct">${esc(ch)}</span>`;
      }
    }).join("");
    return `<span class="hint-word">${chars}</span>`;
  }).join(`<span class="hint-spacer"></span>`);
}

function renderPodium(winners = [], isRevealed = false) {
  if (!podiumWinnersList) return;

  if (winners.length === 0) {
    podiumWinnersList.innerHTML = `
      <div class="winner-row">
        <span class="winner-name" style="color:#cbd5e1">No one solved this riddle before time expired!</span>
      </div>
    `;
    return;
  }

  podiumWinnersList.innerHTML = winners.map((w) => {
    const isFirst = w.place === 1;
    const rankIcon = isFirst ? "🥇" : (w.place === 2 ? "🥈" : (w.place === 3 ? "🥉" : "🎖️"));
    const rowClass = isFirst ? "winner-first" : "winner-bonus";
    return `
      <div class="winner-row ${rowClass}">
        <div class="winner-left">
          <span class="winner-rank">${rankIcon}</span>
          <span class="winner-name">@${esc(w.nickname || w.user)}</span>
        </div>
        <div class="winner-points-badge">+${w.points} PTS</div>
      </div>
    `;
  }).join("");
}

function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function updateUI(state) {
  if (!state || (state.gameId && state.gameId !== "riddle")) return;

  // Detect new round/riddle reset
  if (state.riddleId !== lastRiddleId || state.round !== lastRound) {
    lastRiddleId = state.riddleId;
    lastRound = state.round;
    confettiTriggered = false;
  }

  // Header & Meta Pills
  if (roundPill) roundPill.textContent = `ROUND ${state.round || 1}`;
  if (categoryPill) categoryPill.textContent = (state.category || "CLASSIC").toUpperCase();
  if (difficultyPill) {
    const diff = state.difficulty || "Easy";
    difficultyPill.textContent = diff.toUpperCase();
    if (diff.toLowerCase() === "hard") {
      difficultyPill.style.background = "rgba(239, 68, 68, 0.15)";
      difficultyPill.style.borderColor = "rgba(239, 68, 68, 0.45)";
      difficultyPill.style.color = "#991b1b";
    } else if (diff.toLowerCase() === "medium") {
      difficultyPill.style.background = "rgba(234, 179, 8, 0.15)";
      difficultyPill.style.borderColor = "rgba(234, 179, 8, 0.45)";
      difficultyPill.style.color = "#854d0e";
    } else {
      difficultyPill.style.background = "rgba(16, 185, 129, 0.12)";
      difficultyPill.style.borderColor = "rgba(16, 185, 129, 0.45)";
      difficultyPill.style.color = "#065f46";
    }
  }

  // Timer
  const time = state.timerRemaining ?? 0;
  if (timerNum) timerNum.textContent = time;
  if (timerBox) {
    if (time <= 10 && state.isTimerActive && !state.isRevealed) {
      timerBox.classList.add("danger");
    } else {
      timerBox.classList.remove("danger");
    }
  }

  // 5-Second Speed Grace Window Alert Banner
  if (graceAlertBanner && graceCountdownNum) {
    if (state.gracePeriodActive && state.graceRemainingSec > 0) {
      graceAlertBanner.style.display = "flex";
      graceCountdownNum.textContent = state.graceRemainingSec;
    } else {
      graceAlertBanner.style.display = "none";
    }
  }

  // Riddle Card
  if (riddleEmoji) riddleEmoji.textContent = state.emoji || "🧙‍♂️";
  if (riddleText) riddleText.textContent = state.riddle || "Loading riddle...";

  // Letter Hints
  if (answerLengthLabel) {
    const len = state.answerLength || 0;
    answerLengthLabel.textContent = `${len} LETTER${len === 1 ? '' : 'S'}`;
  }
  if (hintTilesWrap) {
    hintTilesWrap.innerHTML = renderMaskedLettersHTML(state.maskedAnswer || "");
  }

  // Clue Card
  if (clueCard && clueText) {
    if (state.clueRevealed && state.secretHint) {
      clueCard.style.display = "flex";
      clueText.textContent = state.secretHint;
    } else {
      clueCard.style.display = "none";
    }
  }

  // Solved Celebration Podium Card
  if (celebrationCard && revealedAnswerText) {
    if (state.isRevealed) {
      celebrationCard.style.display = "flex";
      revealedAnswerText.textContent = (state.secretAnswer || "").toUpperCase();

      if (celebrationTitle) {
        celebrationTitle.textContent = (state.winners && state.winners.length > 0)
          ? "RIDDLE SOLVED!"
          : "TIME'S UP!";
      }

      renderPodium(state.winners || [], state.isRevealed);

      if (!confettiTriggered && state.winners && state.winners.length > 0) {
        confettiTriggered = true;
        triggerConfetti();
      }
    } else {
      celebrationCard.style.display = "none";
    }
  }

  // Footer & Streak
  if (streakPill) streakPill.textContent = `🔥 STREAK ${state.streak || 0}`;
  if (statusMessage) statusMessage.textContent = state.statusMessage || "Solve the riddle in chat!";
}

// Socket Listeners
socket.on("connect", () => {
  socket.emit("getGameState");
});

socket.on("gameState", (state) => {
  updateUI(state);
});

socket.on("gameAction", (data) => {
  if (data && (data.gameId === "riddle" || !data.gameId)) {
    updateUI(data.state || data);
  }
});

socket.on("chatGuess", (data) => {
  if (data && data.isCorrect) {
    triggerConfetti();
  }
});
