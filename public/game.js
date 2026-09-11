// public/game.js
const C = ["A", "B", "C", "D", "E", "F"];
const R = [1, 2, 3, 4];
const LEVELS = [
  { name: "EASY", sec: 20 },
  { name: "MEDIUM", sec: 18 },
  { name: "HARD", sec: 16 },
  { name: "EXPERT", sec: 14 },
  { name: "CHAOS", sec: 12 }
];

let target = "A1";
let round = 1;
let level = 1;
let category = "fruit";
let streak = 0;
let time = 20;
let active = true;
let revealed = false;
let roundWinners = [];
let isServerConnected = false;

let modalTimer = null;
let localTimerInterval = null;
let lastRenderedRound = -1;
let lastRenderedTarget = "";
let lastRenderedCategory = "";
let lastRenderedLevel = -1;
let pillHideTimeout = null;

// DOM Elements
const elRound = document.getElementById("round");
const elTimer = document.getElementById("timer");
const elLevel = document.getElementById("level");
const elCategory = document.getElementById("category");
const elStreak = document.getElementById("streak");
const elWinnerBox = document.getElementById("winnerBox");
const elStatus = document.getElementById("status");
const elLiveGuessPill = document.getElementById("liveGuessPill");

const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalTopList = document.getElementById("modalTopList");
const elModalProgressBar = document.getElementById("modalProgressBar");

const btnStart = document.getElementById("btnStart");
const btnReveal = document.getElementById("btnReveal");
const btnNext = document.getElementById("btnNext");

// Web Audio API Sound Synthesizer
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
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {}
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function svgWrap(content) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function iconSVG(t, odd, lvl) {
  const subtle = lvl >= 4;
  if (t === "fruit") {
    const fill = odd ? (lvl === 1 ? "#8ed36f" : "#ff7d8b") : "#ff7d8b";
    const leaf = odd && lvl >= 2 ? "#b685d9" : "#72b95e";
    const dot = odd && lvl >= 3 ? `<circle cx="63" cy="48" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
    return svgWrap(`<path d="M50 24 C70 18 83 34 80 56 C77 78 63 88 50 88 C37 88 23 78 20 56 C17 34 30 18 50 24Z" fill="${fill}" stroke="#583d6f" stroke-width="4"/><path d="M49 26 C50 14 61 11 70 16 C62 18 56 22 51 30Z" fill="${leaf}" stroke="#583d6f" stroke-width="3"/>${dot}`);
  }
  if (t === "bear") {
    const ear = odd && lvl === 1 ? "#e49ac3" : "#c99b74";
    const eye = odd && lvl >= 2 ? 1 : 2;
    const mark = odd && lvl >= 3 ? `<circle cx="67" cy="58" r="${subtle ? 2 : 4}" fill="#f6b7c8"/>` : "";
    return svgWrap(`<circle cx="30" cy="28" r="13" fill="${ear}" stroke="#5b416b" stroke-width="4"/><circle cx="70" cy="28" r="13" fill="${ear}" stroke="#5b416b" stroke-width="4"/><circle cx="50" cy="55" r="31" fill="#c99b74" stroke="#5b416b" stroke-width="4"/><circle cx="39" cy="52" r="${eye}" fill="#35243f"/><circle cx="61" cy="52" r="2" fill="#35243f"/><ellipse cx="50" cy="65" rx="11" ry="8" fill="#f2d7c4"/><circle cx="50" cy="62" r="3.5" fill="#35243f"/>${mark}`);
  }
  if (t === "cloud") {
    const fill = odd && lvl === 1 ? "#caa9ff" : "#ffffff";
    const drop = odd && lvl >= 2 ? `<circle cx="${subtle ? 70 : 74}" cy="78" r="${subtle ? 2.5 : 5}" fill="#7bc6ff"/>` : "";
    const eye2 = odd && lvl >= 3 ? 0 : 3;
    return svgWrap(`<path d="M24 68 C10 68 10 47 25 45 C26 28 47 22 57 35 C70 27 86 39 82 53 C94 57 89 69 78 69Z" fill="${fill}" stroke="#66538c" stroke-width="4"/><circle cx="42" cy="55" r="3" fill="#4e3d66"/><circle cx="60" cy="55" r="${eye2}" fill="#4e3d66"/>${drop}`);
  }
  if (t === "flower") {
    const petal = odd && lvl === 1 ? "#ffce6e" : "#f1a6d8";
    const center = odd && lvl >= 2 ? "#95d36e" : "#ffd56a";
    const missing = odd && lvl >= 3;
    let petals = "";
    [[50, 20], [72, 32], [78, 56], [61, 75], [36, 75], [22, 56], [28, 32]].forEach((p, i) => {
      if (!(missing && i === 0)) petals += `<circle cx="${p[0]}" cy="${p[1]}" r="${subtle ? 13 : 14}" fill="${petal}" stroke="#6b4d7c" stroke-width="3"/>`;
    });
    return svgWrap(`${petals}<circle cx="50" cy="50" r="17" fill="${center}" stroke="#6b4d7c" stroke-width="3"/>`);
  }
  if (t === "boba") {
    const drink = odd && lvl === 1 ? "#f5a1ba" : "#e9ad5e";
    const straw = odd && lvl >= 2 ? "#ff7697" : "#7657d1";
    const pearls = odd && lvl >= 3 ? 7 : 8;
    let ps = "";
    for (let i = 0; i < pearls; i++) {
      let x = 30 + (i % 4) * 13, y = 69 + Math.floor(i / 4) * 10;
      ps += `<circle cx="${x}" cy="${y}" r="${subtle ? 3.2 : 4}" fill="#4d2d22"/>`;
    }
    return svgWrap(`<path d="M28 30 H72 L68 88 H32Z" fill="${drink}" stroke="#583d6f" stroke-width="4"/><rect x="51" y="9" width="9" height="30" rx="3" fill="${straw}" stroke="#583d6f" stroke-width="3" transform="rotate(7 55 24)"/><ellipse cx="50" cy="30" rx="24" ry="7" fill="#f8ead7" stroke="#583d6f" stroke-width="4"/>${ps}`);
  }
  if (t === "cupcake") {
    const frosting = odd && lvl === 1 ? "#b9a3ff" : "#f6a6ce";
    const cherry = odd && lvl >= 2 ? "#7acb75" : "#ff667a";
    const sprinkle = odd && lvl >= 3 ? `<rect x="${subtle ? 63 : 68}" y="38" width="3" height="8" rx="1" fill="#fff"/>` : "";
    return svgWrap(`<path d="M29 52 H71 L65 87 H35Z" fill="#d69d63" stroke="#604468" stroke-width="4"/><path d="M30 55 C22 47 27 36 38 36 C38 24 52 19 59 29 C70 25 79 35 75 46 C84 50 78 59 68 57Z" fill="${frosting}" stroke="#604468" stroke-width="4"/><circle cx="55" cy="23" r="7" fill="${cherry}" stroke="#604468" stroke-width="3"/>${sprinkle}`);
  }
  if (t === "controller") {
    const body = odd && lvl === 1 ? "#9dd7ff" : "#b9a4ff";
    const btn = odd && lvl >= 2 ? "#ff9cb7" : "#6650a6";
    const tiny = odd && lvl >= 3 ? `<circle cx="${subtle ? 75 : 78}" cy="58" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
    return svgWrap(`<path d="M26 38 C18 42 17 66 25 73 C32 80 39 69 44 64 H56 C61 69 68 80 75 73 C83 66 82 42 74 38 C66 34 58 38 54 42 H46 C42 38 34 34 26 38Z" fill="${body}" stroke="#55406f" stroke-width="4"/><rect x="31" y="49" width="17" height="5" rx="2" fill="#55406f"/><rect x="37" y="43" width="5" height="17" rx="2" fill="#55406f"/><circle cx="65" cy="49" r="4" fill="${btn}"/><circle cx="72" cy="57" r="4" fill="${btn}"/>${tiny}`);
  }
  // Star
  const fill = odd && lvl === 1 ? "#9cd8ff" : "#ffd96e";
  const point = odd && lvl >= 2
    ? "50,13 60,40 89,40 66,57 75,85 50,68 25,85 34,57 11,40 40,40"
    : "50,10 61,38 91,38 67,56 76,87 50,69 24,87 33,56 9,38 39,38";
  const mark = odd && lvl >= 3 ? `<circle cx="${subtle ? 66 : 71}" cy="54" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
  return svgWrap(`<polygon points="${point}" fill="${fill}" stroke="#634c7a" stroke-width="4" stroke-linejoin="round"/>${mark}`);
}

function drawGrid(activeTarget, curCategory, curLevel) {
  const g = document.getElementById("grid");
  if (!g) return;
  g.innerHTML = "";
  R.forEach(r => {
    C.forEach(c => {
      const code = c + r;
      const b = document.createElement("button");
      b.className = "cell";
      b.dataset.code = code;
      const isOdd = code === activeTarget;
      b.innerHTML = iconSVG(curCategory, isOdd, curLevel);
      b.onclick = () => onCellClick(code);
      g.appendChild(b);
    });
  });
}

function highlightTarget(code) {
  document.querySelectorAll(".cell").forEach(cell => {
    if (cell.dataset.code === code) {
      cell.classList.add("correct");
    }
  });
}

function clearAllHighlights() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("correct");
  });
}

function flashCellGuess(code) {
  const cell = document.querySelector(`.cell[data-code="${code}"]`);
  if (cell) {
    cell.classList.remove("flash-guess");
    void cell.offsetWidth;
    cell.classList.add("flash-guess");
  }
}

function showLiveGuessPill(username, code, isCorrect) {
  if (!elLiveGuessPill) return;
  clearTimeout(pillHideTimeout);

  if (isCorrect) {
    elLiveGuessPill.className = "guess-pill correct";
    elLiveGuessPill.innerHTML = `🎉 <strong>@${esc(username)}</strong> guessed <strong>${code}</strong> ✓ Correct!`;
  } else {
    elLiveGuessPill.className = "guess-pill";
    elLiveGuessPill.innerHTML = `💬 <strong>@${esc(username)}</strong> guessed <span style="color:#e64980">${code}</span>`;
  }

  elLiveGuessPill.style.display = "inline-flex";
  pillHideTimeout = setTimeout(() => {
    elLiveGuessPill.style.display = "none";
  }, 3500);
}

function onCellClick(code) {
  if (socket && socket.connected) {
    socket.emit("manualGuess", code);
  } else {
    handleLocalGuess("Host", code);
  }
}

function renderAvatarHTML(avatarUrl, nickname) {
  const initial = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return `<img src="${esc(avatarUrl)}" class="avatar-img" alt="${esc(nickname)}" onerror="this.outerHTML='<div class=\\'avatar-letter\\'>${initial}</div>'">`;
  }
  return `<div class="avatar-letter">${initial}</div>`;
}

function renderWinnersBox(winners) {
  if (!winners || winners.length === 0) {
    elWinnerBox.innerHTML = `<span style="font-size:1.05vh;color:#6c4ca6">First 2 to comment the odd box win points!</span>`;
    return;
  }

  elWinnerBox.innerHTML = winners.map(w => {
    const medal = w.place === 1 ? "🥇" : "🥈";
    const pts = w.points === 1 ? "+1pt" : `+${w.points}pts`;
    const avatar = w.avatar
      ? `<img src="${esc(w.avatar)}" class="avatar-mini" onerror="this.style.display='none'">`
      : "";
    return `
      <div class="winner-pill">
        ${medal} ${avatar} <span>@${esc(w.nickname)} (${w.code})</span> <strong style="color:#723eb5">${pts}</strong>
      </div>
    `;
  }).join("");
}

function showLeaderboardPopup(data) {
  const winners = data.roundWinners || [];
  const topList = data.leaderboard || [];

  let podiumHTML = "";
  if (winners.length > 0) {
    const first = winners[0];
    podiumHTML += `
      <div class="podium-card first">
        <div class="podium-rank">🥇 1st Place</div>
        <div class="avatar-wrap">${renderAvatarHTML(first.avatar, first.nickname)}</div>
        <div class="podium-name">@${esc(first.nickname)}</div>
        <div class="podium-pts">+${first.points} Points</div>
      </div>
    `;
  } else {
    podiumHTML += `
      <div class="podium-card">
        <div class="podium-rank">⏰ No Winners</div>
        <div style="font-size:1.1vh;color:#c8b9ff;margin:8px 0">Time expired!</div>
      </div>
    `;
  }

  if (winners.length > 1) {
    const second = winners[1];
    podiumHTML += `
      <div class="podium-card second">
        <div class="podium-rank">🥈 2nd Place</div>
        <div class="avatar-wrap">${renderAvatarHTML(second.avatar, second.nickname)}</div>
        <div class="podium-name">@${esc(second.nickname)}</div>
        <div class="podium-pts">+${second.points} Point</div>
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
          ${renderAvatarHTML(p.avatar, p.nickname)}
          <span>@${esc(p.nickname || p.user)}</span>
        </div>
        <div class="top-score">${p.score} pts 🏆</div>
      </div>
    `).join("");
  }

  elModalProgressBar.style.transition = "none";
  elModalProgressBar.style.width = "100%";
  void elModalProgressBar.offsetWidth;
  elModalProgressBar.style.transition = "width 4s linear";
  elModalProgressBar.style.width = "0%";

  elModal.classList.add("active");

  if (modalTimer) clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    elModal.classList.remove("active");
  }, 4000);
}

function applyGameState(data) {
  const roundChanged = data.round !== lastRenderedRound;
  round = data.round || 1;
  level = data.level || 1;
  category = data.category || "fruit";
  streak = data.streak || 0;
  time = data.time !== undefined ? data.time : 20;
  active = !!data.active;
  revealed = !!data.revealed;
  target = data.target || target;
  roundWinners = data.roundWinners || [];

  elRound.textContent = `ROUND ${round}`;
  const lvlName = LEVELS[level - 1]?.name || "EASY";
  elLevel.textContent = `LEVEL ${level} • ${lvlName}`;
  elCategory.textContent = category.toUpperCase();
  elStreak.textContent = `🔥 ${streak}`;
  elTimer.textContent = `00:${String(Math.max(time, 0)).padStart(2, "0")}`;

  if (time <= 5 && active) {
    elTimer.classList.add("danger");
    playSound("tick");
  } else {
    elTimer.classList.remove("danger");
  }

  renderWinnersBox(roundWinners);

  if (data.statusMessage) {
    elStatus.textContent = data.statusMessage;
  }

  if (roundChanged) {
    elModal.classList.remove("active");
    clearAllHighlights();
  }

  const curTarget = data.target || target;
  if (
    roundChanged ||
    curTarget !== lastRenderedTarget ||
    category !== lastRenderedCategory ||
    level !== lastRenderedLevel ||
    !document.querySelector(".cell")
  ) {
    lastRenderedRound = round;
    lastRenderedTarget = curTarget;
    lastRenderedCategory = category;
    lastRenderedLevel = level;
    drawGrid(curTarget, category, level);
  }

  if (revealed) {
    highlightTarget(curTarget);
  } else {
    clearAllHighlights();
  }
}

// Button actions
btnStart.onclick = () => {
  if (socket && isServerConnected) socket.emit("startRound");
  else resetLocalGame();
};

btnReveal.onclick = () => {
  if (socket && isServerConnected) socket.emit("reveal");
  else {
    revealed = true;
    highlightTarget(target);
  }
};

btnNext.onclick = () => {
  if (socket && isServerConnected) socket.emit("nextRound");
  else newLocalRound();
};

// Standalone Local Logic (Fallback when no server is running)
let localWinners = [];
function startLocalGame() {
  newLocalRound();
  if (localTimerInterval) clearInterval(localTimerInterval);
  localTimerInterval = setInterval(() => {
    if (!isServerConnected) {
      if (active && time > 0) {
        time--;
        elTimer.textContent = `00:${String(Math.max(time, 0)).padStart(2, "0")}`;
        if (time <= 5) {
          elTimer.classList.add("danger");
          playSound("tick");
        } else {
          elTimer.classList.remove("danger");
        }
        if (time <= 0) {
          active = false;
          revealed = true;
          highlightTarget(target);
          playSound("timeout");
          if (localWinners.length === 0) streak = 0;
          elStatus.textContent = `⏰ Time's up! The answer was ${target}`;
          showLeaderboardPopup({ roundWinners: localWinners, leaderboard: [] });
          setTimeout(newLocalRound, 4000);
        }
      }
    }
  }, 1000);
}

function newLocalRound() {
  elModal.classList.remove("active");
  clearAllHighlights();
  round++;
  active = true;
  revealed = false;
  localWinners = [];
  level = Math.min(5, 1 + Math.floor(streak / 3));
  time = LEVELS[level - 1].sec;
  const TYPES = ["fruit", "bear", "cloud", "flower", "boba", "cupcake", "controller", "star"];
  category = TYPES[Math.floor(Math.random() * TYPES.length)];
  target = C[Math.floor(Math.random() * 6)] + R[Math.floor(Math.random() * 4)];

  applyGameState({
    round,
    level,
    category,
    streak,
    time,
    active: true,
    revealed: false,
    target,
    roundWinners: [],
    statusMessage: `${LEVELS[level - 1].name}: find the ONE odd ${category} 👀`
  });
}

function resetLocalGame() {
  round = 0;
  streak = 0;
  newLocalRound();
}

function handleLocalGuess(user, msg, avatar = null) {
  if (!active) return;
  const m = String(msg).toUpperCase().match(/(?:^|[^A-Z0-9])([A-F])[\s\-_]?([1-4])(?![0-9])/i);
  if (!m) return;
  const code = m[1].toUpperCase() + m[2];

  flashCellGuess(code);

  if (code === target) {
    if (localWinners.some(w => w.user.toLowerCase() === user.toLowerCase())) return;
    const place = localWinners.length + 1;
    const points = place === 1 ? 2 : 1;
    const winItem = { user, nickname: user, avatar, code, place, points };
    localWinners.push(winItem);

    playSound("win");
    highlightTarget(target);
    showLiveGuessPill(user, code, true);

    if (place === 1) streak++;

    if (localWinners.length >= 2) {
      active = false;
      revealed = true;
      showLeaderboardPopup({ roundWinners: localWinners, leaderboard: [] });
      setTimeout(newLocalRound, 4000);
    }
    renderWinnersBox(localWinners);
  } else {
    showLiveGuessPill(user, code, false);
  }
}

// In-Browser Direct TikFinity WebSocket Client (always active as robust fallback)
let directTikSocket = null;
let directRetry = null;

function connectDirectTikFinity() {
  clearTimeout(directRetry);
  try {
    directTikSocket = new WebSocket("ws://localhost:21213/");
    directTikSocket.onopen = () => {
      console.log("[Direct TikFinity] Connected in browser!");
    };
    directTikSocket.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const events = Array.isArray(raw) ? raw : [raw];
        for (const evt of events) {
          const d = evt.data || evt.payload || evt.Payload || evt;
          const text = String(d.comment || d.message || d.text || evt.comment || evt.message || d.Message || "").trim();
          const user = String(d.uniqueId || d.username || d.user?.uniqueId || evt.uniqueId || "viewer").trim();
          const nick = String(d.nickname || d.user?.nickname || evt.nickname || user).trim();
          const avatar = d.profilePictureUrl || d.avatarUrl || d.profileImageUrl || null;

          if (text) {
            console.log(`[Direct TikFinity Chat] @${nick}: ${text}`);
            if (!isServerConnected) {
              handleLocalGuess(nick, text, avatar);
            }
          }
        }
      } catch (err) {}
    };
    directTikSocket.onclose = () => {
      directRetry = setTimeout(connectDirectTikFinity, 4000);
    };
    directTikSocket.onerror = () => {
      directRetry = setTimeout(connectDirectTikFinity, 4000);
    };
  } catch (err) {
    directRetry = setTimeout(connectDirectTikFinity, 4000);
  }
}

// Initialize Socket.IO with automatic server / standalone detection
let socket = null;
function initSocket() {
  // Determine server host
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  const serverUrl = isHttp ? window.location.origin : "http://localhost:3000";

  if (typeof io !== "undefined") {
    try {
      socket = io(serverUrl, { timeout: 3000, reconnectionAttempts: 10 });

      socket.on("connect", () => {
        console.log("[Game] Connected to server at " + serverUrl);
        isServerConnected = true;
      });

      socket.on("gameState", (data) => {
        isServerConnected = true;
        applyGameState(data);
      });

      socket.on("roundStarted", (data) => {
        elModal.classList.remove("active");
        applyGameState(data);
      });

      socket.on("winnerFound", (payload) => {
        playSound("win");
        highlightTarget(payload.target);
        renderWinnersBox(payload.roundWinners || []);
        showLiveGuessPill(payload.winner.nickname, payload.winner.code, true);
      });

      socket.on("guessAttempt", (payload) => {
        flashCellGuess(payload.code);
        showLiveGuessPill(payload.user, payload.code, false);
      });

      socket.on("timeExpired", (payload) => {
        playSound("timeout");
        highlightTarget(payload.target);
      });

      socket.on("answerRevealed", (payload) => {
        highlightTarget(payload.target);
      });

      socket.on("showLeaderboardPopup", (payload) => {
        showLeaderboardPopup(payload);
      });

      socket.on("connect_error", () => {
        isServerConnected = false;
      });
    } catch (e) {
      console.warn("Socket init error, running locally", e);
    }
  }
}

// Start everything immediately on load
drawGrid(target, category, level);
startLocalGame();
initSocket();
connectDirectTikFinity();
