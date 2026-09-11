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

let target = "";
let round = 1;
let level = 1;
let category = "fruit";
let streak = 0;
let time = 20;
let active = false;

// Audio context for sound effects
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'win') {
      // Happy major chord fanfare
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (type === 'timeout') {
      // Descending buzzer tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.4);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'tick') {
      // Subtle clock click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    // Audio context may be blocked before user interaction
  }
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

function onCellClick(code) {
  if (socket && socket.connected) {
    socket.emit("manualGuess", code);
  } else {
    // Local fallback
    localGuess("Host", code);
  }
}

// Socket.IO Integration
let socket = null;
try {
  if (typeof io !== "undefined") {
    socket = io();
  }
} catch (e) {
  console.warn("Socket.IO client not found, operating in standalone fallback mode.");
}

const elRound = document.getElementById("round");
const elTimer = document.getElementById("timer");
const elLevel = document.getElementById("level");
const elCategory = document.getElementById("category");
const elStreak = document.getElementById("streak");
const elWinner = document.getElementById("winner");
const elStatus = document.getElementById("status");
const elTikStatus = document.getElementById("tikStatus");

function updateTikStatus(connected) {
  if (connected) {
    elTikStatus.textContent = "🟢 TikFinity Connected • LIVE chat ready";
    elTikStatus.style.color = "#48df83";
  } else {
    elTikStatus.textContent = "🟡 TikFinity Disconnected • Check app";
    elTikStatus.style.color = "#ffb052";
  }
}

let lastRenderedTarget = "";
let lastRenderedCategory = "";
let lastRenderedLevel = 0;

function applyGameState(data) {
  round = data.round || 1;
  level = data.level || 1;
  category = data.category || "fruit";
  streak = data.streak || 0;
  time = data.time !== undefined ? data.time : 20;
  active = !!data.active;

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

  if (data.winner) {
    elWinner.innerHTML = `@${esc(data.winner.nickname || data.winner.user)} • ${data.winner.code} ✓`;
  } else {
    elWinner.textContent = "No winner yet";
  }

  if (data.statusMessage) {
    elStatus.textContent = data.statusMessage;
  }

  if (data.tikfinityConnected !== undefined) {
    updateTikStatus(data.tikfinityConnected);
  }

  // Redraw grid if category or round changed
  const serverTarget = data.target || data.secretTarget || "";
  if (serverTarget && (serverTarget !== lastRenderedTarget || category !== lastRenderedCategory || level !== lastRenderedLevel)) {
    lastRenderedTarget = serverTarget;
    lastRenderedCategory = category;
    lastRenderedLevel = level;
    drawGrid(serverTarget, category, level);
  }

  if (data.revealed && serverTarget) {
    highlightTarget(serverTarget);
  }
}

if (socket) {
  socket.on("connect", () => {
    console.log("[Game] Connected to server Socket.IO");
  });

  socket.on("gameState", (data) => {
    applyGameState(data);
  });

  socket.on("correctGuess", (payload) => {
    playSound("win");
    highlightTarget(payload.target);
    if (payload.winner) {
      elWinner.innerHTML = `@${esc(payload.winner.nickname || payload.winner.user)} • ${payload.winner.code} ✓`;
    }
  });

  socket.on("timeExpired", (payload) => {
    playSound("timeout");
    highlightTarget(payload.target);
  });

  socket.on("guessAttempt", (payload) => {
    const cell = document.querySelector(`.cell[data-code="${payload.code}"]`);
    if (cell) {
      cell.classList.remove("flash-guess");
      void cell.offsetWidth; // retrigger animation
      cell.classList.add("flash-guess");
    }
  });

  document.getElementById("btnStart").onclick = () => socket.emit("manualGuess", "");
  document.getElementById("btnReveal").onclick = () => socket.emit("manualGuess", "");
  document.getElementById("btnNext").onclick = () => socket.emit("manualGuess", "");
} else {
  // Local fallback mode
  startLocalGame();
}

// Local standalone fallback logic
let localTimer = null;
function startLocalGame() {
  updateTikStatus(false);
  newLocalRound();

  document.getElementById("btnStart").onclick = resetLocalGame;
  document.getElementById("btnReveal").onclick = () => highlightTarget(target);
  document.getElementById("btnNext").onclick = newLocalRound;
  initDirectTikFinityFallback();
}

function newLocalRound() {
  clearInterval(localTimer);
  round++;
  active = true;
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
    statusMessage: `${LEVELS[level - 1].name}: find the ONE odd ${category} 👀`
  });

  localTimer = setInterval(() => {
    time--;
    applyGameState({ round, level, category, streak, time, active, target });
    if (time <= 0) {
      clearInterval(localTimer);
      active = false;
      streak = 0;
      playSound("timeout");
      highlightTarget(target);
      applyGameState({
        round,
        level,
        category,
        streak: 0,
        time: 0,
        active: false,
        revealed: true,
        target,
        statusMessage: `Time! The answer was ${target} • streak reset`
      });
    }
  }, 1000);
}

function resetLocalGame() {
  round = 0;
  streak = 0;
  newLocalRound();
}

function localGuess(user, msg) {
  if (!active) return;
  const m = String(msg).toUpperCase().match(/\b[A-F][1-4]\b/);
  if (!m) return;
  const code = m[0];
  if (code === target) {
    active = false;
    clearInterval(localTimer);
    streak++;
    playSound("win");
    highlightTarget(target);
    applyGameState({
      round,
      level,
      category,
      streak,
      time,
      active: false,
      revealed: true,
      target,
      winner: { user, nickname: user, code },
      statusMessage: `🎉 @${esc(user)} found it! ${code}`
    });
    setTimeout(newLocalRound, 4000);
  }
}

function initDirectTikFinityFallback() {
  try {
    const ws = new WebSocket("ws://localhost:21213/");
    ws.onopen = () => updateTikStatus(true);
    ws.onmessage = (e) => {
      try {
        const p = JSON.parse(e.data);
        if (p?.event === "chat" || p?.type === "chat") {
          const d = p.data || p;
          const comment = d.comment || d.message || d.text || "";
          const user = d.uniqueId || d.nickname || "viewer";
          if (comment) localGuess(user, comment);
        }
      } catch {}
    };
    ws.onclose = () => {
      updateTikStatus(false);
      setTimeout(initDirectTikFinityFallback, 4000);
    };
  } catch (err) {
    updateTikStatus(false);
  }
}
