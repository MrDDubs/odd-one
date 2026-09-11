// public/admin.js
const socket = io("/admin");

// DOM elements
const badgeTikfinity = document.getElementById("badgeTikfinity");
const textTikfinity = document.getElementById("textTikfinity");
const badgeRound = document.getElementById("badgeRound");
const badgeStreak = document.getElementById("badgeStreak");

const secretTarget = document.getElementById("secretTarget");
const secretCategory = document.getElementById("secretCategory");
const secretLevel = document.getElementById("secretLevel");
const secretTimer = document.getElementById("secretTimer");

const btnStartRound = document.getElementById("btnStartRound");
const btnNextRound = document.getElementById("btnNextRound");
const btnReveal = document.getElementById("btnReveal");
const btnTogglePause = document.getElementById("btnTogglePause");
const btnResetGame = document.getElementById("btnResetGame");

const selectLevel = document.getElementById("selectLevel");
const selectCategory = document.getElementById("selectCategory");
const btnApplySettings = document.getElementById("btnApplySettings");

const inputTikfinityUrl = document.getElementById("inputTikfinityUrl");
const btnReconnectTikfinity = document.getElementById("btnReconnectTikfinity");

const simUser = document.getElementById("simUser");
const simGuess = document.getElementById("simGuess");
const btnSimulateGuess = document.getElementById("btnSimulateGuess");
const btnSimulateWin = document.getElementById("btnSimulateWin");
const btnSimulateRandom = document.getElementById("btnSimulateRandom");

const guessFeed = document.getElementById("guessFeed");
const btnClearFeed = document.getElementById("btnClearFeed");
const leaderboardList = document.getElementById("leaderboardList");
const btnResetLeaderboard = document.getElementById("btnResetLeaderboard");

const toast = document.getElementById("toast");

let currentState = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function updateTikStatus(connected) {
  if (connected) {
    badgeTikfinity.className = "badge badge-green";
    textTikfinity.textContent = "TikFinity Connected";
  } else {
    badgeTikfinity.className = "badge badge-red";
    textTikfinity.textContent = "TikFinity Disconnected";
  }
}

function renderState(state) {
  currentState = state;

  // Badges
  badgeRound.textContent = `Round ${state.round || 1}`;
  badgeStreak.textContent = `🔥 Streak ${state.streak || 0}`;
  updateTikStatus(state.tikfinityConnected);

  // Cheat Sheet
  secretTarget.textContent = state.secretTarget || state.target || "--";
  secretCategory.textContent = (state.category || "FRUIT").toUpperCase();
  secretLevel.textContent = `LEVEL ${state.level || 1} (${state.levelName || "EASY"})`;
  secretTimer.textContent = `${state.time || 0}s`;

  if (state.paused) {
    btnTogglePause.textContent = "▶ Resume Timer";
    btnTogglePause.classList.add("primary");
    btnTogglePause.classList.remove("secondary");
  } else {
    btnTogglePause.textContent = "⏸ Pause Timer";
    btnTogglePause.classList.add("secondary");
    btnTogglePause.classList.remove("primary");
  }

  // Active preset chip
  document.querySelectorAll("[data-sec]").forEach(btn => {
    const sec = parseInt(btn.getAttribute("data-sec"), 10);
    btn.classList.toggle("active", sec === state.roundDurationSec);
  });

  // Leaderboard
  renderLeaderboard(state.leaderboard || []);
}

function addGuessToFeed(guessItem) {
  // If first item is placeholder, clear it
  if (guessFeed.children.length === 1 && guessFeed.children[0].textContent.includes("Waiting")) {
    guessFeed.innerHTML = "";
  }

  const div = document.createElement("div");
  div.className = `guess-item ${guessItem.isCorrect ? "winner" : ""}`;
  
  const timeStr = new Date(guessItem.timestamp || Date.now()).toLocaleTimeString();
  const mark = guessItem.isCorrect ? "✓ WINNER!" : "• Incorrect";
  
  div.innerHTML = `
    <div>
      <strong>@${guessItem.nickname || guessItem.user}</strong>: 
      <span style="font-weight:bold;letter-spacing:1px">${guessItem.code}</span>
      <span style="font-size:11px;opacity:0.85;margin-left:4px">${mark}</span>
    </div>
    <div class="guess-meta">${timeStr}</div>
  `;

  guessFeed.insertBefore(div, guessFeed.firstChild);

  // Limit feed items to 50
  if (guessFeed.children.length > 50) {
    guessFeed.removeChild(guessFeed.lastChild);
  }
}

function renderLeaderboard(list) {
  if (!list || list.length === 0) {
    leaderboardList.innerHTML = `<li style="color:var(--muted);font-size:12px">No winners yet.</li>`;
    return;
  }

  leaderboardList.innerHTML = list.map((item, index) => `
    <li class="leaderboard-item">
      <span>#${index + 1} <strong>@${item.nickname || item.user}</strong></span>
      <span>${item.score} wins 🏆</span>
    </li>
  `).join("");
}

// Socket events
socket.on("connect", () => {
  console.log("[Admin] Connected to server");
});

socket.on("gameState", (data) => {
  renderState(data);
});

socket.on("chatGuess", (guessItem) => {
  addGuessToFeed(guessItem);
});

socket.on("correctGuess", (payload) => {
  showToast(`🎉 @${payload.winner?.nickname || payload.winner?.user} won Round with ${payload.target}!`);
});

socket.on("timeExpired", (payload) => {
  showToast(`⏰ Time's up! Answer was ${payload.target}`);
});

socket.on("tikfinityLog", (msg) => {
  console.log(`[TikFinity Log] ${msg}`);
});

// Admin Controls
btnStartRound.addEventListener("click", () => {
  socket.emit("startRound");
  showToast("Round Started");
});

btnNextRound.addEventListener("click", () => {
  socket.emit("nextRound");
  showToast("Generated Next Round");
});

btnReveal.addEventListener("click", () => {
  socket.emit("reveal");
  showToast("Answer Revealed");
});

btnTogglePause.addEventListener("click", () => {
  socket.emit("togglePause");
});

btnResetGame.addEventListener("click", () => {
  if (confirm("Reset game back to Round 1 and reset community streak?")) {
    socket.emit("resetGame");
    showToast("Game Reset");
  }
});

// Timer Presets
document.querySelectorAll("[data-sec]").forEach(btn => {
  btn.addEventListener("click", () => {
    const duration = parseInt(btn.getAttribute("data-sec"), 10);
    socket.emit("setOptions", { duration });
    showToast(`Timer set to ${duration}s`);
  });
});

// Category & Level
btnApplySettings.addEventListener("click", () => {
  const cat = selectCategory.value;
  const lvlVal = selectLevel.value;
  const opts = {};

  if (cat !== "random") opts.category = cat;
  if (lvlVal === "auto") {
    opts.autoLevel = true;
  } else {
    opts.autoLevel = false;
    opts.level = parseInt(lvlVal, 10);
  }

  socket.emit("setOptions", opts);
  showToast("Settings Applied");
});

// Reconnect TikFinity
btnReconnectTikfinity.addEventListener("click", () => {
  const url = inputTikfinityUrl.value.trim();
  socket.emit("reconnectTikfinity", url);
  showToast("Reconnecting TikFinity...");
});

// Clear Feed
btnClearFeed.addEventListener("click", () => {
  guessFeed.innerHTML = `<div style="color:var(--muted);text-align:center;padding:12px">Feed cleared. Waiting for guesses...</div>`;
});

// Reset Leaderboard
btnResetLeaderboard.addEventListener("click", () => {
  if (confirm("Reset the leaderboard points?")) {
    socket.emit("resetLeaderboard");
    showToast("Leaderboard Reset");
  }
});

// Test Simulator
btnSimulateGuess.addEventListener("click", () => {
  const user = simUser.value.trim() || "TestUser";
  const guess = simGuess.value.trim().toUpperCase();
  if (!guess) {
    alert("Please enter a coordinate to guess, e.g. A4");
    return;
  }
  socket.emit("simulateGuess", { username: user, message: guess });
  simGuess.value = "";
  showToast(`Simulated guess: ${guess} by @${user}`);
});

btnSimulateWin.addEventListener("click", () => {
  if (!currentState?.secretTarget) return;
  const user = simUser.value.trim() || "LuckyViewer";
  socket.emit("simulateGuess", { username: user, message: currentState.secretTarget });
  showToast(`Simulated WINNING guess: ${currentState.secretTarget} by @${user}`);
});

btnSimulateRandom.addEventListener("click", () => {
  const COLS = ["A", "B", "C", "D", "E", "F"];
  const ROWS = [1, 2, 3, 4];
  const rand = COLS[Math.floor(Math.random() * COLS.length)] + ROWS[Math.floor(Math.random() * ROWS.length)];
  const user = simUser.value.trim() || "Viewer" + Math.floor(Math.random() * 100);
  socket.emit("simulateGuess", { username: user, message: rand });
  showToast(`Simulated guess: ${rand} by @${user}`);
});
