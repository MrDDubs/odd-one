const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get("admin") === "true";
const socket = isAdmin ? io("/admin") : io();

// DOM References
const elRoundPill = document.getElementById("roundPill");
const elTimerNum = document.getElementById("timerNum");
const elTimerBox = document.getElementById("timerBox");
const elTopicName = document.getElementById("topicName");
const elTopicEmoji = document.getElementById("topicEmoji");
const elSlotsGrid = document.getElementById("slotsGrid");
const elFoundValue = document.getElementById("foundValue");
const elStreakValue = document.getElementById("streakValue");
const elStreakCard = document.getElementById("streakCard");
const elConfettiContainer = document.getElementById("confettiContainer");
const elLeaderboardPodium = document.getElementById("leaderboardPodium");

const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalTopList = document.getElementById("modalTopList");
const elModalProgressBar = document.getElementById("modalProgressBar");

let modalTimer = null;
let lastRenderedRound = -1;

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

// Spawn cute floating sparkles when a word card is solved
function spawnCardSparkles(cardEl) {
  if (!cardEl) return;
  const sparkles = ["✨", "💜", "⭐", "🌸"];
  for (let i = 0; i < 4; i++) {
    const sp = document.createElement("span");
    sp.className = "card-sparkle-item";
    sp.textContent = sparkles[i % sparkles.length];
    sp.style.left = `${15 + Math.random() * 70}%`;
    sp.style.top = `${20 + Math.random() * 55}%`;
    sp.style.animationDelay = `${i * 0.08}s`;
    cardEl.appendChild(sp);
    setTimeout(() => sp.remove(), 1100);
  }
}

// Full-screen cute falling confetti & heart shower on ALL 6 FOUND
function launchCuteConfetti() {
  const container = elConfettiContainer || document.getElementById("confettiContainer");
  if (!container) return;
  container.innerHTML = "";
  const items = ["💜", "✨", "⭐", "💖", "🌸", "🎉", "💛", "🎈"];
  const count = 38;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "cute-confetti-piece";
    p.textContent = items[Math.floor(Math.random() * items.length)];
    p.style.left = `${Math.random() * 95}%`;
    p.style.top = `${-10 - Math.random() * 20}%`;
    p.style.fontSize = `${14 + Math.random() * 16}px`;
    p.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    container.appendChild(p);
  }
  setTimeout(() => {
    container.innerHTML = "";
  }, 2600);
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
      const wasRevealed = card.classList.contains("revealed");
      if (!wasRevealed) {
        card.classList.add("revealed");
        spawnCardSparkles(card);
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
      } else {
        winnerHtml = `
          <div class="winner-sub-badge" style="background:rgba(239,68,68,0.2);border-color:rgba(248,113,113,0.35)">
            <span class="winner-sub-pts" style="color:#fca5a5;font-weight:700">⏰ Missed</span>
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
      const prevHint = card.dataset.lastHint || "";
      
      let extraAdminHtml = "";
      if (typeof isAdmin !== "undefined" && isAdmin && s.word) {
        extraAdminHtml = `<div style="position: absolute; bottom: 8px; right: 12px; font-size: 16px; color: rgba(124, 58, 237, 0.6); font-weight: bold; z-index: 10;">${s.word}</div>`;
      }
      
      if (card.dataset.lastHint !== currentHint || !card.querySelector(".slot-hint") || extraAdminHtml) {
        card.dataset.lastHint = currentHint;
        card.innerHTML = `
          <div class="slot-inner">
            ${formatHintHtml(currentHint, prevHint)}
            ${extraAdminHtml}
          </div>
        `;
      }
    }
  });
}

// Render Top 5 Leaderboard Podium (🥇 🥈 🥉 4️⃣ 5️⃣)
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
      const username = p.nickname || p.user || "viewer";
      const initial = (username.replace(/^@/, "").charAt(0) || "?").toUpperCase();
      const score = p.score || 0;

      const avatarHtml = p.avatar
        ? `<div class="podium-avatar-wrap">
            <img src="${p.avatar}" class="podium-avatar-img" alt="${username}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
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
  const activeSlots = (isAdmin && state.secretSlots) ? state.secretSlots : state.slots;
  if (activeSlots) {
    renderSlots(activeSlots);
  }

  // Counters
  const found = state.foundCount ?? 0;
  const total = state.totalWords ?? 6;
  if (elFoundValue) elFoundValue.textContent = `${found} / ${total}`;

  const oldStreak = lastKnownState?.streak ?? 0;
  const newStreak = state.streak ?? 0;
  if (elStreakValue) elStreakValue.textContent = newStreak;
  if (newStreak > oldStreak && elStreakCard) {
    elStreakCard.classList.remove("celebrate");
    void elStreakCard.offsetWidth;
    elStreakCard.classList.add("celebrate");
    setTimeout(() => elStreakCard?.classList.remove("celebrate"), 750);
  }

  // All 6 Words Solved celebration
  if (state.allFound && !lastKnownState?.allFound) {
    launchCuteConfetti();
  }

  // Leaderboard
  if (state.leaderboard) {
    renderLeaderboard(state.leaderboard);
  }

  if (state.round && state.round !== lastRenderedRound) {
    lastRenderedRound = state.round;
    if (elModal) elModal.classList.remove("active");
  }
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

function renderAvatarHTML(url, name) {
  const cleanName = esc(name || "V");
  const firstLetter = cleanName.charAt(0).toUpperCase() || "V";
  if (url) {
    return `<img src="${esc(url)}" class="avatar-img" alt="${cleanName}" onerror="this.outerHTML='<div class=\\'avatar-letter\\'>${firstLetter}</div>'">`;
  }
  return `<div class="avatar-letter">${firstLetter}</div>`;
}

function showLeaderboardPopup(data) {
  if (!elModal || !elModalPodium || !elModalTopList) return;

  const rawWinners = data.roundWinners || [];
  const topList = data.leaderboard || [];
  const targetTopic = data.target || "";

  // Deduplicate and aggregate round points/words per unique player
  const playerMap = new Map();
  rawWinners.forEach((w) => {
    if (!w || !w.user) return;
    const key = String(w.user).toLowerCase();
    const pts = Number(w.points) || 0;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        user: w.user,
        nickname: w.nickname || w.user,
        avatar: w.avatar || null,
        points: pts,
        wordsCount: 1,
        firstWonAt: w.timestamp || Date.now()
      });
    } else {
      const p = playerMap.get(key);
      p.points += pts;
      p.wordsCount += 1;
      if (w.avatar && !p.avatar) p.avatar = w.avatar;
    }
  });

  // Sort unique players by total points earned this round, tie-breaker is first correct guess
  const winners = Array.from(playerMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.firstWonAt - b.firstWonAt;
  });

  let podiumHTML = "";
  if (winners.length > 0) {
    const first = winners[0];
    const firstWords = first.wordsCount > 1 ? ` (${first.wordsCount} words)` : "";
    podiumHTML += `
      <div class="podium-card first">
        <div class="podium-rank">🥇 1st Place</div>
        <div class="avatar-wrap">${renderAvatarHTML(first.avatar, first.nickname || first.user)}</div>
        <div class="podium-name">@${esc(first.nickname || first.user)}</div>
        <div class="podium-pts">+${first.points} pts${firstWords}</div>
      </div>
    `;

    if (winners.length > 1) {
      const second = winners[1];
      const secondWords = second.wordsCount > 1 ? ` (${second.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card second">
          <div class="podium-rank">🥈 2nd Place</div>
          <div class="avatar-wrap">${renderAvatarHTML(second.avatar, second.nickname || second.user)}</div>
          <div class="podium-name">@${esc(second.nickname || second.user)}</div>
          <div class="podium-pts">+${second.points} pts${secondWords}</div>
        </div>
      `;
    }

    if (winners.length > 2) {
      const third = winners[2];
      const thirdWords = third.wordsCount > 1 ? ` (${third.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card third">
          <div class="podium-rank">🥉 3rd Place</div>
          <div class="avatar-wrap">${renderAvatarHTML(third.avatar, third.nickname || third.user)}</div>
          <div class="podium-name">@${esc(third.nickname || third.user)}</div>
          <div class="podium-pts">+${third.points} pts${thirdWords}</div>
        </div>
      `;
    }
  } else {
    podiumHTML += `
      <div class="podium-card" style="border-color:#a855f7">
        <div class="podium-rank">⏰ No Winners</div>
        <div style="font-size:1.1vh;color:#c8b9ff;margin:8px 0">${targetTopic ? `Topic: <strong>${esc(targetTopic)}</strong>` : "Time expired!"}</div>
      </div>
    `;
  }

  elModalPodium.innerHTML = podiumHTML;

  if (topList.length === 0) {
    elModalTopList.innerHTML = `<div style="text-align:center;font-size:1.1vh;color:#bda8ef">No scores yet. Be the first to win!</div>`;
  } else {
    elModalTopList.innerHTML = topList.slice(0, 4).map((p, idx) => `
      <div class="top-row">
        <div class="top-user-wrap">
          <span>#${idx + 1}</span>
          ${renderAvatarHTML(p.avatar, p.nickname || p.user)}
          <span>@${esc(p.nickname || p.user)}</span>
        </div>
        <div class="top-score">${p.score || 0} pts 🏆</div>
      </div>
    `).join("");
  }

  if (elModalProgressBar) {
    elModalProgressBar.style.transition = "none";
    elModalProgressBar.style.width = "100%";
    void elModalProgressBar.offsetWidth;
    elModalProgressBar.style.transition = "width 4s linear";
    elModalProgressBar.style.width = "0%";
  }

  elModal.classList.add("active");

  if (modalTimer) clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    elModal.classList.remove("active");
  }, 4000);
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

socket.on("roundStarted", (state) => {
  if (elModal) elModal.classList.remove("active");
  if (state) handleState(state);
});

socket.on("winnerFound", (data) => {
  if (data && data.gameId === "think-and-link") {
    playSound("correct");
    showGuessToast(data.winner?.nickname || data.winner?.user || "Player", data.winner?.word || data.target || "Word", true);
    if (data.allFound || data.roundComplete) {
      setTimeout(() => playSound("all_found"), 400);
      launchCuteConfetti();
    }
  }
});

socket.on("guessResult", (data) => {
  if (data && data.isCorrect) {
    playSound("correct");
    showGuessToast(data.winner?.nickname || data.winner?.user || "Player", data.word || "Word", true);
    if (data.allFound || data.roundComplete) {
      setTimeout(() => playSound("all_found"), 400);
      launchCuteConfetti();
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

socket.on("showLeaderboardPopup", (payload) => {
  showLeaderboardPopup(payload);
});

// Request initial state on load
socket.emit("getPublicState");
