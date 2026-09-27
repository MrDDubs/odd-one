// games/word-finder/overlay.js
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get("admin") === "true";
const noLeaderboard = urlParams.get("noLeaderboard") === "true" || urlParams.get("hideLeaderboard") === "true";
const socket = isAdmin ? io("/admin") : io();

if (noLeaderboard) {
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".overlay-app")?.classList.add("no-leaderboard");
  });
}

socket.on("toggleInGameLeaderboard", ({ hide }) => {
  const app = document.querySelector(".overlay-app");
  if (hide) {
    app?.classList.add("no-leaderboard");
  } else {
    app?.classList.remove("no-leaderboard");
  }
});

if (window.initSpeechBubble) {
  window.initSpeechBubble({ socket });
}

// DOM References
const elRoundPill = document.getElementById("roundPill");
const elCategoryPill = document.getElementById("categoryPill");
const elTimerNum = document.getElementById("timerNum");
const elTimerBox = document.getElementById("timerBox");
const elGrid6x6 = document.getElementById("grid6x6");
const elWordBankGrid = document.getElementById("wordBankGrid");
const elBankProgress = document.getElementById("bankProgress");
const elStreakValue = document.getElementById("streakValue");
const elStreakCard = document.getElementById("streakCard");
const elConfettiContainer = document.getElementById("confettiContainer");

const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalTopList = document.getElementById("modalTopList");
const elModalProgressBar = document.getElementById("modalProgressBar");

let modalTimer = null;
let lastRenderedRound = -1;
let currentGridState = null;

const elGuessToast = document.getElementById("guessToast");
const elToastIcon = document.getElementById("toastIcon");
const elToastUser = document.getElementById("toastUser");
const elToastWord = document.getElementById("toastWord");
let toastTimeout = null;

// ============================================================================
// Web Audio Synthesizer & Master Volume
// ============================================================================
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

    if (type === "correct") {
      // Pleasant multi-note chime chord
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
        g.connect(masterGain || ctx.destination);
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
  }, 3000);
}

// Full-screen cute falling confetti
function launchCuteConfetti() {
  const container = elConfettiContainer || document.getElementById("confettiContainer");
  if (!container) return;
  container.innerHTML = "";
  const items = ["🔍", "✨", "⭐", "💖", "🌸", "🎉", "💛", "💜", "🎯"];
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

// ============================================================================
// 6x6 Grid & Word Bank Rendering
// ============================================================================
const ROW_NAMES = ["A", "B", "C", "D", "E", "F"];
const COL_NAMES = ["1", "2", "3", "4", "5", "6"];

function renderGrid(gridRows) {
  if (!elGrid6x6 || !Array.isArray(gridRows) || gridRows.length !== 6) return;

  // Rebuild grid elements if empty or changed
  const gridKey = gridRows.join("");
  if (currentGridState !== gridKey) {
    currentGridState = gridKey;
    elGrid6x6.innerHTML = "";

    for (let r = 0; r < 6; r++) {
      const rowStr = String(gridRows[r] || "      ").toUpperCase();
      for (let c = 0; c < 6; c++) {
        const letter = rowStr[c] || " ";
        const coord = `${ROW_NAMES[r]}${COL_NAMES[c]}`;
        const cell = document.createElement("div");
        cell.className = "cell-6x6";
        cell.id = `cell-${coord}`;
        cell.dataset.coord = coord;
        cell.dataset.letter = letter;
        cell.innerHTML = `
          <span class="cell-letter">${letter}</span>
          <span class="cell-coord">${coord}</span>
        `;
        elGrid6x6.appendChild(cell);
      }
    }
  }
}

function updateGridHighlights(words, hintCoord = null) {
  // Clear existing highlights
  document.querySelectorAll(".cell-6x6").forEach((cell) => {
    cell.classList.remove("cell-found", "cell-hint");
    cell.style.background = "";
    cell.style.borderColor = "";
    cell.style.boxShadow = "";
  });

  // Highlight cells for all revealed words
  if (Array.isArray(words)) {
    words.forEach((w) => {
      if (w.revealed && Array.isArray(w.coords)) {
        const color = w.color || "#10b981";
        w.coords.forEach((coord) => {
          const cell = document.getElementById(`cell-${coord}`);
          if (cell) {
            cell.classList.add("cell-found");
            cell.style.background = `linear-gradient(135deg, ${color}, ${color}cc)`;
            cell.style.borderColor = "#ffffff";
            cell.style.boxShadow = `0 0 12px ${color}`;
          }
        });
      }
    });
  }

  // Highlight hint cell if any
  if (hintCoord) {
    const hintCell = document.getElementById(`cell-${hintCoord}`);
    if (hintCell && !hintCell.classList.contains("cell-found")) {
      hintCell.classList.add("cell-hint");
    }
  }
}

function renderWordBank(words) {
  if (!elWordBankGrid || !Array.isArray(words)) return;

  let foundCount = 0;
  elWordBankGrid.innerHTML = words.map((w, idx) => {
    const isSolved = !!w.revealed;
    if (isSolved) foundCount++;

    const color = w.color || "#a855f7";
    const letterCount = w.length || (w.word ? w.word.length : 4);

    if (isSolved) {
      const solverText = w.foundBy?.nickname
        ? `✓ @${esc(w.foundBy.nickname)}`
        : "✓ Revealed";

      return `
        <div class="word-chip solved" id="word-chip-${idx}">
          <div class="word-chip-left">
            <span class="word-chip-dot" style="background:${color}; box-shadow: 0 0 6px ${color}"></span>
            <span class="word-chip-text">${esc(w.word)}</span>
          </div>
          <span class="word-chip-solver" title="${esc(solverText)}">${solverText}</span>
        </div>
      `;
    } else {
      const dots = Array(letterCount).fill("•").join(" ");
      return `
        <div class="word-chip hidden-word" id="word-chip-${idx}">
          <div class="word-chip-left">
            <span class="word-chip-lock">🔒</span>
            <span class="word-chip-blanks" aria-label="${letterCount} letters">${dots}</span>
          </div>
          <span class="word-chip-meta">${letterCount} letters</span>
        </div>
      `;
    }
  }).join("");

  if (elBankProgress) {
    elBankProgress.textContent = `${foundCount} / ${words.length}`;
  }
}

// ============================================================================
// Podium & Community Leaderboard Modal
// ============================================================================
function renderAvatarHTML(avatar, user) {
  if (avatar) {
    return `<img src="${esc(avatar)}" class="podium-avatar-img" alt="${esc(user)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="podium-avatar-initial" style="display:none">${esc(user.charAt(0).toUpperCase())}</div>`;
  }
  return `<div class="podium-avatar-initial">${esc((user || "?").charAt(0).toUpperCase())}</div>`;
}

function showLeaderboardPopup(payload) {
  if (!elModal || !elModalPodium || !elModalTopList) return;

  const rawWinners = payload.roundWinners || [];
  const topList = payload.leaderboard || [];
  const targetTopic = payload.target || "";

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
        words: [w.word].filter(Boolean),
        firstWonAt: w.timestamp || Date.now()
      });
    } else {
      const p = playerMap.get(key);
      p.points += pts;
      p.wordsCount += 1;
      if (w.word && !p.words.includes(w.word)) p.words.push(w.word);
      if (w.avatar && !p.avatar) p.avatar = w.avatar;
    }
  });

  const winners = Array.from(playerMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.firstWonAt - b.firstWonAt;
  });

  let podiumHTML = "";
  if (winners.length > 0) {
    const first = winners[0];
    const second = winners[1];
    const third = winners[2];

    if (second) {
      const secondWords = second.wordsCount > 1 ? ` (${second.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card">
          <div class="podium-rank" style="color:#94a3b8">🥈 2nd</div>
          <div class="podium-avatar-wrap">${renderAvatarHTML(second.avatar, second.nickname || second.user)}</div>
          <div class="podium-name">@${esc(second.nickname || second.user)}</div>
          <div class="podium-pts">+${second.points} pts${secondWords}</div>
        </div>
      `;
    }

    if (first) {
      const firstWords = first.wordsCount > 1 ? ` (${first.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card first">
          <div class="podium-rank" style="color:#facc15">👑 1st</div>
          <div class="podium-avatar-wrap" style="width:40px;height:40px;border-color:#facc15">${renderAvatarHTML(first.avatar, first.nickname || first.user)}</div>
          <div class="podium-name" style="font-weight:900;color:#facc15">@${esc(first.nickname || first.user)}</div>
          <div class="podium-pts">+${first.points} pts${firstWords}</div>
        </div>
      `;
    }

    if (third) {
      const thirdWords = third.wordsCount > 1 ? ` (${third.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card">
          <div class="podium-rank" style="color:#d97706">🥉 3rd</div>
          <div class="podium-avatar-wrap">${renderAvatarHTML(third.avatar, third.nickname || third.user)}</div>
          <div class="podium-name">@${esc(third.nickname || third.user)}</div>
          <div class="podium-pts">+${third.points} pts${thirdWords}</div>
        </div>
      `;
    }

    if (winners.length > 3) {
      const others = winners.slice(3);
      const othersStr = others.map(o => `@${esc(o.nickname || o.user)} (+${o.points} pts)`).join(", ");
      podiumHTML += `
        <div class="podium-runners-up-row" style="width:100%;font-size:1.05vh;color:#d8b4fe;background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:8px;margin-top:4px;">
          Also scored: ${othersStr}
        </div>
      `;
    }
  } else {
    podiumHTML += `
      <div class="podium-card empty-winners">
        <div class="podium-rank" style="color:#6b21a8; font-size:1.35vh;">⏰ No Winners This Round</div>
        <div style="font-size:1.2vh; color:#4c1d95; font-weight:700; margin-top:4px;">${targetTopic ? `Topic was: <strong>${esc(targetTopic)}</strong>` : "Time expired!"}</div>
      </div>
    `;
  }

  elModalPodium.innerHTML = podiumHTML;

  if (topList.length === 0) {
    elModalTopList.innerHTML = `<div style="text-align:center;font-size:1.2vh;color:#f3e8ff;font-weight:700;padding:6px 0;">No scores yet. Be the first to win!</div>`;
  } else {
    elModalTopList.innerHTML = topList.slice(0, 4).map((p, idx) => `
      <div class="top-row">
        <div class="top-user-wrap">
          <span class="top-user-rank">#${idx + 1}</span>
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

// ============================================================================
// State Handler
// ============================================================================
function handleState(state) {
  if (!state) return;
  if (state.audioSettings) {
    updateAudioSettings(state.audioSettings);
  }

  const gameId = state.gameId || state.activeGameId;
  if (gameId && gameId !== "word-finder") return;

  // Header Round & Category
  if (elRoundPill) elRoundPill.textContent = `ROUND ${state.round || 1}`;
  if (elCategoryPill) elCategoryPill.textContent = `${state.emoji || "🔍"} ${state.category ? state.category.toUpperCase() : "PUZZLE"}`;

  // Timer
  const time = state.time ?? state.timerRemaining ?? 60;
  if (elTimerNum) elTimerNum.textContent = time;

  if (elTimerBox) {
    if (state.isTimerActive && time <= 8 && time > 0) {
      elTimerBox.classList.add("danger");
      if (time <= 5) playSound("tick");
    } else {
      elTimerBox.classList.remove("danger");
    }
  }

  // 6x6 Grid
  if (Array.isArray(state.grid)) {
    renderGrid(state.grid);
  }

  // Words & Bank: Always display words from state.words (hidden until solved)
  const wordsToDisplay = state.words || [];
  if (Array.isArray(wordsToDisplay)) {
    renderWordBank(wordsToDisplay);
    updateGridHighlights(wordsToDisplay, state.lastHintCoord);
  }

  // Community Streak
  if (elStreakValue) elStreakValue.textContent = state.streak !== undefined ? state.streak : 0;
}

// ============================================================================
// Socket Listeners
// ============================================================================
socket.on("connect", () => {
  console.log("[WordFinder Overlay] Connected to server");
});

socket.on("gameState", (state) => {
  handleState(state);
});

socket.on("audioSettings", (settings) => {
  updateAudioSettings(settings);
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
  if (data && (data.gameId === "word-finder" || !data.gameId)) {
    playSound("correct");
    showGuessToast(data.winner?.nickname || data.winner?.user || "Player", data.winner?.word || data.word || "Word", true);
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

socket.on("showLeaderboardPopup", (payload) => {
  showLeaderboardPopup(payload);
});

// Request initial state on load
socket.emit("getPublicState");
