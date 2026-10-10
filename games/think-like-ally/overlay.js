// games/think-like-ally/overlay.js
const socket = io();

const roundPill = document.getElementById("roundPill");
const categoryPill = document.getElementById("categoryPill");
const timerBox = document.getElementById("timerBox");
const timerNum = document.getElementById("timerNum");
const questionCard = document.getElementById("questionCard");
const questionIcon = document.getElementById("questionIcon");
const questionLabel = document.getElementById("questionLabel");
const questionText = document.getElementById("questionText");
const mcqGrid = document.getElementById("mcqGrid");
const guessToast = document.getElementById("guessToast");
const toastUser = document.getElementById("toastUser");
const toastText = document.getElementById("toastText");
const statusMsg = document.getElementById("statusMsg");
const streakValue = document.getElementById("streakValue");
const leaderboardPodium = document.getElementById("leaderboardPodium");

const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalTopList = document.getElementById("modalTopList");
const elModalAlsoScored = document.getElementById("modalAlsoScored");
const elModalAlsoScoredList = document.getElementById("modalAlsoScoredList");
const elModalProgressBar = document.getElementById("modalProgressBar");

let toastTimer = null;
let modalTimer = null;
let lastRenderedRound = -1;

function normStr(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Sound effects synthesizer & Master Volume
let audioCtx = null;
let masterGain = null;
let soundVolume = 1.0;
let isMuted = false;

try {
  const savedVol = localStorage.getItem("ally_stream_volume");
  const savedMuted = localStorage.getItem("ally_stream_muted");
  if (savedVol !== null) soundVolume = Math.max(0, Math.min(100, parseFloat(savedVol))) / 100;
  if (savedMuted !== null) isMuted = savedMuted === "true";
} catch (e) {}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : soundVolume, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function updateAudioSettings(settings) {
  if (!settings) return;
  if (typeof settings.volume === "number") {
    soundVolume = Math.max(0, Math.min(100, settings.volume)) / 100;
    try { localStorage.setItem("ally_stream_volume", String(settings.volume)); } catch (e) {}
  }
  if (typeof settings.muted === "boolean") {
    isMuted = !!settings.muted;
    try { localStorage.setItem("ally_stream_muted", String(isMuted)); } catch (e) {}
  }
  if (masterGain && audioCtx) {
    try {
      masterGain.gain.setValueAtTime(isMuted ? 0 : soundVolume, audioCtx.currentTime);
    } catch (e) {}
  }
}

function playSound(type) {
  if (isMuted || soundVolume <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain || ctx.destination);

    if (type === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (type === "timeout") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.4);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "tick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {}
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function showWinnerToast(winner) {
  // Pop up on accepted guess removed as requested; keep win sound
  playSound("win");
}

function renderState(state) {
  if (!state) return;
  if (state.audioSettings) {
    updateAudioSettings(state.audioSettings);
  }
  if (state.gameId && state.gameId !== "think-like-ally") return;

  // Round, Topic & Timer
  if (roundPill) roundPill.textContent = `ROUND ${state.round || 1}`;
  if (categoryPill) categoryPill.textContent = (state.category || "POPULAR OPINION").toUpperCase();
  if (streakValue) streakValue.textContent = state.streak !== undefined ? state.streak : 0;
  const t = state.timerRemaining !== undefined ? state.timerRemaining : (state.time || 0);
  if (timerNum) timerNum.textContent = t;

  if (timerBox) {
    if (t <= 5 && state.isTimerActive) {
      timerBox.classList.add("danger");
      playSound("tick");
    } else {
      timerBox.classList.remove("danger");
    }
  }

  const isMCQ = state.questionType === "mcq" && Array.isArray(state.options) && state.options.length > 0;
  const isRevealed = !!state.isAnswerRevealed;
  const rawAnswer = state.allyAnswer || state.target || "";
  const revealedAnswer = rawAnswer !== "???" ? rawAnswer : "";

  if (isMCQ) {
    // 1. MCQ Mode
    if (questionCard) questionCard.classList.remove("revealed");
    if (questionIcon) questionIcon.textContent = state.questionIcon || "💡";
    if (questionLabel) {
      questionLabel.textContent = isRevealed ? "QUESTION & REVEALED ANSWER" : "QUESTION";
      questionLabel.classList.toggle("revealed-label", isRevealed);
    }
    if (questionText) {
      questionText.textContent = (state.question || "CHOOSE THE CORRECT OPTION").toUpperCase();
      questionText.classList.remove("answer-revealed-text");
    }

    if (mcqGrid) {
      mcqGrid.style.display = "grid";
      const normTarget = normStr(revealedAnswer);
      const percentages = state.percentages || [0, 0, 0, 0];
      const votes = state.optionVotes || [0, 0, 0, 0];

      mcqGrid.innerHTML = state.options
        .map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isCorrect = isRevealed && (
            normStr(opt) === normTarget ||
            normStr(letter) === normTarget ||
            (normTarget && normTarget.includes(normStr(opt))) ||
            (normStr(opt) && normTarget.includes(normStr(opt)))
          );
          const isDimmed = isRevealed && !isCorrect;
          const pct = percentages[idx] || 0;
          const voteCount = votes[idx] || 0;

          let optionClasses = "mcq-option";
          if (isCorrect) optionClasses += " correct";
          else if (isDimmed) optionClasses += " dimmed";

          const badgeContent = isCorrect ? "✓" : letter;

          return `
            <div class="${optionClasses}" id="mcq-opt-${idx}">
              <div class="mcq-fill-bar" style="width: ${pct}%"></div>
              <div class="mcq-content-left">
                <span class="mcq-badge">${badgeContent}</span>
                <span class="mcq-text">${esc(opt).toUpperCase()}</span>
              </div>
              <span class="mcq-vote-pill">${pct}%</span>
            </div>
          `;
        })
        .join("");
    }
  } else {
    // 2. Open Text Mode
    if (mcqGrid) {
      mcqGrid.style.display = "none";
      mcqGrid.innerHTML = "";
    }

    if (isRevealed && revealedAnswer) {
      const primaryDisplayAnswer = String(revealedAnswer).split(/[/,|]/)[0].trim();
      if (questionCard) questionCard.classList.add("revealed");
      if (questionIcon) questionIcon.textContent = "✨";
      if (questionLabel) {
        questionLabel.textContent = "ALLY'S SECRET ANSWER";
        questionLabel.classList.add("revealed-label");
      }
      if (questionText) {
        questionText.innerHTML = `<span class="answer-sparkle">✨</span> <span class="revealed-word">${esc(primaryDisplayAnswer).toUpperCase()}</span> <span class="answer-sparkle">✨</span>`;
        questionText.classList.add("answer-revealed-text");
      }
    } else {
      if (questionCard) questionCard.classList.remove("revealed");
      if (questionIcon) questionIcon.textContent = state.questionIcon || "💡";
      if (questionLabel) {
        questionLabel.textContent = "QUESTION";
        questionLabel.classList.remove("revealed-label");
      }
      if (questionText) {
        questionText.textContent = (state.question || "NAME A PIZZA TOPPING").toUpperCase();
        questionText.classList.remove("answer-revealed-text");
      }
    }
  }

  // Status message
  if (statusMsg && state.statusMessage) {
    statusMsg.textContent = state.statusMessage;
  }

  // Leaderboard Podium (Top 5)
  const lb = state.leaderboard || [];
  if (leaderboardPodium) {
    const list = Array.isArray(lb) ? lb.slice(0, 5) : [];
    const rankIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"];

    let html = "";
    for (let i = 0; i < 5; i++) {
      const p = list[i];
      const rankClass = rankClasses[i] || "";
      if (p) {
        const username = esc(p.nickname || p.user || "viewer");
        const initial = (username.replace(/^@/, "").charAt(0) || "?").toUpperCase();
        const score = p.score || 0;

        const avatarHtml = p.avatar
          ? `<div class="podium-avatar-wrap">
              <img src="${esc(p.avatar)}" class="podium-avatar-img" alt="${username}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="podium-avatar-initial" style="display:none">${initial}</div>
              <span class="podium-rank-badge">${rankIcons[i]}</span>
            </div>`
          : `<div class="podium-avatar-wrap">
              <div class="podium-avatar-initial">${initial}</div>
              <span class="podium-rank-badge">${rankIcons[i]}</span>
            </div>`;

        html += `
          <div class="podium-card ${rankClass}" title="@${username} (${score} pts)">
            ${avatarHtml}
            <div class="podium-points">${score}<span class="podium-pts-suffix">pts</span></div>
          </div>
        `;
      } else {
        html += `
          <div class="podium-card ${rankClass} podium-empty" title="Empty Slot">
            <div class="podium-avatar-wrap">
              <div class="podium-avatar-initial empty">${rankIcons[i]}</div>
            </div>
            <div class="podium-points">0<span class="podium-pts-suffix">pts</span></div>
          </div>
        `;
      }
    }

    leaderboardPodium.innerHTML = html;
  }

  if (state.round && state.round !== lastRenderedRound) {
    lastRenderedRound = state.round;
    if (elModal) elModal.classList.remove("active");
  }
}

function renderAvatarHTML(url, name) {
  const cleanName = esc(name || "V");
  const firstLetter = cleanName.charAt(0).toUpperCase() || "V";
  if (url) {
    return `<img src="${esc(url)}" class="avatar-img" alt="${cleanName}" onerror="this.outerHTML='<div class=\\'avatar-letter\\'>${firstLetter}</div>'">`;
  }
  return `<div class="avatar-letter">${firstLetter}</div>`;
}

function showLeaderboardPopup(data) {
  if (typeof window.showRoundPointsModal === "function") {
    window.showRoundPointsModal(data);
    return;
  }
}

// Socket Listeners
socket.on("connect", () => {
  console.log("[ThinkLikeAlly Overlay] Connected to Hub server");
  if (window.initSpeechBubble) window.initSpeechBubble({ socket });
});

socket.on("gameState", (data) => {
  renderState(data);
});

socket.on("audioSettings", (settings) => {
  updateAudioSettings(settings);
});

socket.on("roundStarted", (data) => {
  if (elModal) elModal.classList.remove("active");
  renderState(data);
});

socket.on("winnerFound", (payload) => {
  if (payload?.winner) {
    showWinnerToast(payload.winner);
  }
});

socket.on("timeExpired", () => {
  playSound("timeout");
});

socket.on("showLeaderboardPopup", (payload) => {
  showLeaderboardPopup(payload);
});
