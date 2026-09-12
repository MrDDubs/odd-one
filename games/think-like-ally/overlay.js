// games/think-like-ally/overlay.js
const socket = io();

// DOM elements
const roundPill = document.getElementById("roundPill");
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

let toastTimer = null;

function normStr(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Sound effects synthesizer
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

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
  if (!guessToast) return;
  toastUser.textContent = `@${winner.nickname || winner.user}`;
  toastText.textContent = winner.code || "Correct!";
  guessToast.classList.add("show");
  playSound("win");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    guessToast.classList.remove("show");
  }, 3000);
}

function renderState(state) {
  if (!state) return;
  if (state.gameId && state.gameId !== "think-like-ally") return;

  // Round & Timer
  if (roundPill) roundPill.textContent = `ROUND ${state.round || 1}`;
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

      mcqGrid.innerHTML = state.options
        .map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isCorrect = isRevealed && (
            normStr(opt) === normTarget ||
            normStr(letter) === normTarget ||
            (normTarget && normTarget.includes(normStr(opt)))
          );
          const isDimmed = isRevealed && !isCorrect;

          let optionClasses = "mcq-option";
          if (isCorrect) optionClasses += " correct";
          else if (isDimmed) optionClasses += " dimmed";

          const badgeContent = isCorrect ? "✓" : letter;

          return `
            <div class="${optionClasses}">
              <span class="mcq-badge">${badgeContent}</span>
              <span>${esc(opt)}</span>
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
        const avatarHtml = p.avatar
          ? `<div style="position:relative;width:22px;height:22px;margin:0 auto 2px">
              <img src="${esc(p.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:1.5px solid #c4b5fd" onerror="this.outerHTML='<span class=\\'podium-rank-icon\\'>${rankIcons[i]}</span>'">
              <span style="position:absolute;bottom:-4px;right:-4px;font-size:10px;line-height:1">${rankIcons[i]}</span>
            </div>`
          : `<div class="podium-rank-icon">${rankIcons[i]}</div>`;

        html += `
          <div class="podium-card ${rankClass}">
            ${avatarHtml}
            <div class="podium-user" title="@${esc(p.nickname || p.user)}">@${esc(p.nickname || p.user)}</div>
            <div class="podium-points">${p.score || 0}</div>
          </div>
        `;
      } else {
        html += `
          <div class="podium-card ${rankClass}" style="opacity:0.65">
            <div class="podium-rank-icon">${rankIcons[i]}</div>
            <div class="podium-user">—</div>
            <div class="podium-points">0</div>
          </div>
        `;
      }
    }

    leaderboardPodium.innerHTML = html;
  }
}

// Socket Listeners
socket.on("connect", () => {
  console.log("[ThinkLikeAlly Overlay] Connected to Hub server");
});

socket.on("gameState", (data) => {
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
