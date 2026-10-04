// games/crowd-says/overlay.js (ESM)
const socket = io();

// DOM Elements
const roundPill = document.getElementById("roundPill");
const timerBox = document.getElementById("timerBox");
const timerNum = document.getElementById("timerNum");

const categoryBadge = document.getElementById("categoryBadge");
const questionIcon = document.getElementById("questionIcon");
const questionText = document.getElementById("questionText");
const answersBoard = document.getElementById("answersBoard");
const streakValue = document.getElementById("streakValue");

// Modal Elements
const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalAlsoScored = document.getElementById("modalAlsoScored");
const elModalAlsoScoredList = document.getElementById("modalAlsoScoredList");
const elModalProgressBar = document.getElementById("modalProgressBar");
const elConfettiContainer = document.getElementById("confettiContainer");

let currentAudioSettings = { volume: 75, muted: false };
let localSlotsState = [];
let modalTimer = null;
let modalProgressInterval = null;

// ================= Web Audio API Synthesizer =================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (currentAudioSettings.muted || currentAudioSettings.volume <= 0) return;
  const masterVol = (currentAudioSettings.volume / 100) * 0.35;

  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "correct" || type === "win") {
      // Cheerful double chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(masterVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "all_found") {
      // Big triumphant fanfare chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(masterVol * 0.7, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + 1.2);
      });
    } else if (type === "timeout") {
      // Friendly game show timeout buzzer
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.6);
      gain.gain.setValueAtTime(masterVol * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === "tick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(masterVol * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (err) {
    console.warn("Audio playback issue:", err);
  }
}

function updateAudioSettings(settings) {
  if (!settings) return;
  if (typeof settings.volume === "number") currentAudioSettings.volume = settings.volume;
  if (typeof settings.muted === "boolean") currentAudioSettings.muted = settings.muted;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAvatarHTML(avatarUrl, nickname) {
  const initial = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return `<img src="${esc(avatarUrl)}" class="cs-winner-avatar" alt="${esc(nickname)}" onerror="this.outerHTML='<span class=\\'avatar-letter-circle\\'>${initial}</span>'">`;
  }
  return `<span class="avatar-letter-circle">${initial}</span>`;
}

// Render the 3D flipping survey cards board
function renderBoard(slots = []) {
  if (!answersBoard) return;

  // Build card elements if counts changed or empty
  if (answersBoard.children.length !== slots.length) {
    answersBoard.innerHTML = slots.map((s, idx) => `
      <div class="cs-card" id="csCard-${idx}">
        <div class="cs-card-inner">
          <!-- Front Face: Mystery Hidden Card -->
          <div class="cs-card-face cs-card-front">
            <div class="cs-rank-pill">#${s.rank}</div>
            <div class="cs-front-mystery">? ? ?</div>
            <div class="cs-front-pts">${s.points} PTS</div>
          </div>
          <!-- Back Face: Revealed Answer -->
          <div class="cs-card-face cs-card-back">
            <div class="cs-card-back-left">
              <div class="cs-rank-pill" style="background:#fff;color:#047857">#${s.rank}</div>
              <div class="cs-answer-text" id="csAnswer-${idx}">${esc(s.text)}</div>
            </div>
            <div class="cs-card-back-right">
              <div id="csWinner-${idx}"></div>
              <div class="cs-points-pill">+${s.points} PTS</div>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  // Update revealed state and winner chips
  slots.forEach((s, idx) => {
    const cardEl = document.getElementById(`csCard-${idx}`);
    if (!cardEl) return;

    const answerEl = document.getElementById(`csAnswer-${idx}`);
    const winnerEl = document.getElementById(`csWinner-${idx}`);

    if (answerEl) {
      answerEl.textContent = s.text;
    }

    if (s.revealed) {
      cardEl.classList.add("revealed");
      if (s.isMissed) {
        cardEl.classList.add("missed");
        if (winnerEl) {
          winnerEl.innerHTML = `<span class="cs-winner-chip" style="background:#475569;border-color:#64748b">MISSED</span>`;
        }
      } else if (s.winner) {
        cardEl.classList.remove("missed");
        if (winnerEl) {
          const avatar = renderAvatarHTML(s.winner.avatar, s.winner.nickname);
          winnerEl.innerHTML = `
            <div class="cs-winner-chip">
              ${avatar}
              <span class="cs-winner-name">@${esc(s.winner.nickname || s.winner.user)}</span>
            </div>
          `;
        }
      }
    } else {
      cardEl.classList.remove("revealed");
      cardEl.classList.remove("missed");
      if (winnerEl) winnerEl.innerHTML = "";
    }
  });

  localSlotsState = slots;
}

// Master state handler
function handleState(state) {
  if (!state) return;
  if (state.audioSettings) updateAudioSettings(state.audioSettings);
  if (state.gameId && state.gameId !== "crowd-says") return;

  // Header Round & Timer
  if (roundPill) roundPill.textContent = `ROUND ${state.round || 1}`;
  if (streakValue) streakValue.textContent = state.streak !== undefined ? state.streak : 0;

  const seconds = state.time !== undefined ? state.time : (state.timerRemaining !== undefined ? state.timerRemaining : 45);
  if (timerNum) timerNum.textContent = seconds;

  if (timerBox) {
    if (seconds <= 5 && state.isTimerActive && seconds > 0) {
      timerBox.classList.add("danger");
      playSound("tick");
    } else {
      timerBox.classList.remove("danger");
    }
  }

  // Question Card
  if (categoryBadge) categoryBadge.textContent = state.category || "GENERAL";
  if (questionIcon) questionIcon.textContent = state.icon || "📣";
  if (questionText) questionText.textContent = state.question || "NAME A SURVEY ITEM";

  // Survey Board Slots
  if (Array.isArray(state.slots)) {
    renderBoard(state.slots);
  }
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
        No answers found this round! Next survey coming up...
      </div>
    `;
  } else {
    const top3 = winners.slice(0, 3);
    elModalPodium.innerHTML = top3.map((w, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? "first" : rank === 2 ? "second" : "third";
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
      const pts = w.points || (rank === 1 ? 30 : rank === 2 ? 20 : 10);
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
  }

  // Also Scored List (4th place and below)
  if (elModalAlsoScored && elModalAlsoScoredList) {
    const alsoScored = winners.slice(3);
    if (alsoScored.length > 0) {
      elModalAlsoScored.style.display = "block";
      elModalAlsoScoredList.innerHTML = alsoScored.map((w, idx) => {
        const rank = idx + 4;
        const pts = w.points || 10;
        const avatarImg = w.avatar
          ? `<img src="${esc(w.avatar)}" class="also-scored-avatar" alt="${esc(w.nickname)}">`
          : `<div class="also-scored-avatar" style="background:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:10px">${(w.nickname || "?")[0].toUpperCase()}</div>`;

        return `
          <div class="also-scored-row">
            <div class="also-scored-left">
              <span class="also-scored-rank">#${rank}</span>
              ${avatarImg}
              <span class="also-scored-name">@${esc(w.nickname || w.user)}</span>
            </div>
            <div class="also-scored-pts">+${pts} pts</div>
          </div>
        `;
      }).join("");
    } else {
      elModalAlsoScored.style.display = "none";
      elModalAlsoScoredList.innerHTML = "";
    }
  }

  // Activate Modal
  elModal.classList.add("active");

  // Animate Countdown Progress Bar
  if (elModalProgressBar) {
    elModalProgressBar.style.width = "100%";
    const startTime = Date.now();
    clearInterval(modalProgressInterval);
    modalProgressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      elModalProgressBar.style.width = `${pct}%`;
      if (elapsed >= durationMs) {
        clearInterval(modalProgressInterval);
      }
    }, 50);
  }

  clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    elModal.classList.remove("active");
  }, durationMs);
}

// Full-screen Falling Confetti Animation
function launchCuteConfetti() {
  if (!elConfettiContainer) return;
  elConfettiContainer.innerHTML = "";
  const colors = ["#facc15", "#38bdf8", "#ec4899", "#a855f7", "#34d399", "#fb923c"];

  for (let i = 0; i < 45; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    elConfettiContainer.appendChild(piece);
  }

  setTimeout(() => {
    if (elConfettiContainer) elConfettiContainer.innerHTML = "";
  }, 3500);
}

// Socket Events
socket.on("connect", () => {
  console.log("[Chat Feud] Connected to stream hub server");
});

socket.on("gameState", (data) => {
  handleState(data);
});

socket.on("roundStarted", (data) => {
  if (elModal) elModal.classList.remove("active");
  handleState(data);
});

socket.on("winnerFound", (data) => {
  if (data && (data.gameId === "crowd-says" || data.gameId === "chat-feud" || !data.gameId)) {
    playSound("correct");
    if (data.allFound || data.roundComplete) {
      setTimeout(() => playSound("all_found"), 350);
      launchCuteConfetti();
    }
  }
});

socket.on("timeExpired", () => {
  playSound("timeout");
});

socket.on("showLeaderboardPopup", (payload) => {
  showLeaderboardPopup(payload);
});
