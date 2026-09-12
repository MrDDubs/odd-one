// games/think-and-link/overlay.js
const socket = io();

// DOM References
const elRoundPill = document.getElementById("roundPill");
const elTimerNum = document.getElementById("timerNum");
const elTimerBox = document.getElementById("timerBox");
const elTopicName = document.getElementById("topicName");
const elTopicEmoji = document.getElementById("topicEmoji");
const elSlotsGrid = document.getElementById("slotsGrid");
const elFoundValue = document.getElementById("foundValue");
const elStreakValue = document.getElementById("streakValue");
const elLeaderboardPodium = document.getElementById("leaderboardPodium");

const elGuessToast = document.getElementById("guessToast");
const elToastIcon = document.getElementById("toastIcon");
const elToastUser = document.getElementById("toastUser");
const elToastWord = document.getElementById("toastWord");

let toastTimeout = null;
let lastKnownState = null;

// Web Audio Synthesizer
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "correct") {
      // Pleasant chime chord
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
    } else if (type === "all_found" || type === "win") {
      // Victory Fanfare
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.25, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.6);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.6);
      });
    } else if (type === "tick") {
      // Danger tick
      osc.type = "sine";
      osc.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "buzzer") {
      // Time-up buzzer
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(130, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (e) {
    // Audio contexts may be blocked by browser policies until interaction
  }
}

// Format seconds into MM:SS
function formatTime(seconds) {
  const s = Math.max(0, parseInt(seconds || 0, 10));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Show live guess toast
function showGuessToast(user, word, isCorrect = false) {
  if (!elGuessToast) return;
  if (elToastUser) elToastUser.textContent = user.startsWith("@") ? user : `@${user}`;
  if (elToastWord) {
    elToastWord.textContent = word;
    elToastWord.style.color = isCorrect ? "#34d399" : "#38bdf8";
  }
  if (elToastIcon) {
    elToastIcon.textContent = isCorrect ? "🎯" : "💬";
  }

  elGuessToast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elGuessToast.classList.remove("show");
  }, 2200);
}

// Format Hint Letters with tight letter-by-letter markup
function formatHintHtml(hintStr, prevHintStr = "") {
  if (!hintStr) return '<div class="slot-hint"><span class="hint-char hint-blank">_</span></div>';

  const tokens = hintStr.includes(" ") ? hintStr.split(" ") : hintStr.split("");
  const prevTokens = prevHintStr ? (prevHintStr.includes(" ") ? prevHintStr.split(" ") : prevHintStr.split("")) : [];

  const len = tokens.length;
  const sizeClass = len >= 11 ? "hint-very-long" : (len >= 9 ? "hint-long" : "");

  const charsHtml = tokens.map((ch, idx) => {
    if (ch === "_" || ch === " ") {
      return `<span class="hint-char hint-blank">_</span>`;
    }
    const isNew = prevTokens[idx] === "_";
    const popClass = isNew ? " hint-pop" : "";
    return `<span class="hint-char hint-letter${popClass}">${ch}</span>`;
  }).join("");

  return `<div class="slot-hint ${sizeClass}">${charsHtml}</div>`;
}

// Format Revealed Solved Word
function formatWordHtml(wordStr) {
  if (!wordStr) return "";
  const len = wordStr.length;
  const sizeClass = len >= 11 ? "word-very-long" : (len >= 9 ? "word-long" : "");
  return `<span class="word-revealed-text ${sizeClass}">${wordStr}</span>`;
}

// Render 6 Slots Grid
function renderSlots(slots) {
  if (!elSlotsGrid) return;
  if (!Array.isArray(slots) || slots.length === 0) return;

  const currentCount = elSlotsGrid.children.length;
  if (currentCount !== slots.length) {
    elSlotsGrid.innerHTML = "";
    slots.forEach((s, idx) => {
      const card = document.createElement("div");
      card.className = "slot-card";
      card.id = `slot-${idx}`;
      card.dataset.lastHint = s.hint || "";
      card.innerHTML = `<div class="slot-inner">${formatHintHtml(s.hint || "_")}</div>`;
      elSlotsGrid.appendChild(card);
    });
  }

  slots.forEach((s, idx) => {
    const card = document.getElementById(`slot-${idx}`);
    if (!card) return;

    if (s.revealed) {
      if (!card.classList.contains("revealed")) {
        card.classList.add("revealed");
      }

      const winner = s.foundBy;
      let winnerHtml = "";
      if (winner) {
        const avatarHtml = winner.avatar
          ? `<img class="winner-avatar-mini" src="${winner.avatar}" alt="${winner.nickname}" onerror="this.outerHTML='<span class=\\'winner-avatar-initial\\'>${(winner.nickname || 'U')[0].toUpperCase()}</span>'" />`
          : `<span class="winner-avatar-initial">${(winner.nickname || 'U')[0].toUpperCase()}</span>`;

        winnerHtml = `
          <div class="winner-sub-badge">
            ${avatarHtml}
            <span class="winner-sub-name">@${winner.nickname || winner.user}</span>
            <span class="winner-sub-pts">+${winner.points || 4}💜</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="slot-inner">
          ${formatWordHtml(s.word || s.hint)}
          ${winnerHtml}
        </div>
      `;
    } else {
      card.classList.remove("revealed");
      const currentHint = s.hint || "_";
      if (card.dataset.lastHint !== currentHint || !card.querySelector(".slot-hint")) {
        const prevHint = card.dataset.lastHint || "";
        card.dataset.lastHint = currentHint;
        card.innerHTML = `
          <div class="slot-inner">
            ${formatHintHtml(currentHint, prevHint)}
          </div>
        `;
      }
    }
  });
}

// Render Top 5 Leaderboard Podium (🥇 🥈 🥉 👑 👑)
function renderLeaderboard(leaderboard) {
  if (!elLeaderboardPodium) return;

  const list = Array.isArray(leaderboard) ? leaderboard.slice(0, 5) : [];
  const rankIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"];

  let html = "";
  for (let i = 0; i < 5; i++) {
    const p = list[i];
    const rankClass = rankClasses[i] || "";
    if (p) {
      const avatarHtml = p.avatar
        ? `<div style="position:relative;width:22px;height:22px;margin:0 auto 2px">
            <img src="${p.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:1.5px solid #c4b5fd" onerror="this.outerHTML='<span class=\\'podium-rank-icon\\'>${rankIcons[i]}</span>'">
            <span style="position:absolute;bottom:-4px;right:-4px;font-size:10px;line-height:1">${rankIcons[i]}</span>
          </div>`
        : `<div class="podium-rank-icon">${rankIcons[i]}</div>`;

      html += `
        <div class="podium-card ${rankClass}">
          ${avatarHtml}
          <div class="podium-user" title="@${p.nickname || p.user}">@${p.nickname || p.user}</div>
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

  elLeaderboardPodium.innerHTML = html;
}

// Main State Handler
function handleState(state) {
  if (!state) return;
  const gameId = state.gameId || state.activeGameId;
  if (gameId && gameId !== "think-and-link") return;

  lastKnownState = state;

  // Header Round & Timer
  if (elRoundPill) elRoundPill.textContent = `ROUND ${state.round || 1}`;

  const time = state.time ?? state.timerRemaining ?? 24;
  if (elTimerNum) elTimerNum.textContent = time;

  if (elTimerBox) {
    if (state.isTimerActive && time <= 8 && time > 0) {
      elTimerBox.classList.add("danger");
      if (time <= 5) playSound("tick");
    } else {
      elTimerBox.classList.remove("danger");
    }
  }

  // Header Topic & Emoji
  if (elTopicName) elTopicName.textContent = state.topic || "PIZZA";
  if (elTopicEmoji) elTopicEmoji.textContent = state.emoji || "🍕";

  // Slots Grid
  if (state.slots) {
    renderSlots(state.slots);
  }

  // Counters
  const found = state.foundCount ?? 0;
  const total = state.totalWords ?? 6;
  if (elFoundValue) elFoundValue.textContent = `${found} / ${total}`;
  if (elStreakValue) elStreakValue.textContent = state.streak ?? 0;

  // Leaderboard
  if (state.leaderboard) {
    renderLeaderboard(state.leaderboard);
  }
}

// Socket Listeners
socket.on("gameState", (state) => {
  handleState(state);
});

socket.on("state", (state) => {
  handleState(state);
});

socket.on("syncState", (state) => {
  handleState(state);
});

socket.on("winnerFound", (data) => {
  if (data && data.gameId === "think-and-link") {
    playSound("correct");
    showGuessToast(data.winner?.nickname || data.winner?.user || "Player", data.winner?.word || data.target || "Word", true);
    if (data.allFound || data.roundComplete) {
      setTimeout(() => playSound("all_found"), 400);
    }
  }
});

socket.on("guessResult", (data) => {
  if (data && data.isCorrect) {
    playSound("correct");
    showGuessToast(data.winner?.nickname || data.winner?.user || "Player", data.word || "Word", true);
    if (data.allFound || data.roundComplete) {
      setTimeout(() => playSound("all_found"), 400);
    }
  }
});

socket.on("guessAttempt", (data) => {
  if (data) {
    showGuessToast(data.user || "Viewer", data.code || "", false);
  }
});

socket.on("timeExpired", () => {
  playSound("buzzer");
});

socket.on("newGuess", (data) => {
  if (data) {
    showGuessToast(data.nickname || data.user || "Viewer", data.message || data.code || "", !!data.isCorrect);
  }
});

// Request initial state on load
socket.emit("getPublicState");
