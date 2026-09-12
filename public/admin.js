// public/admin.js
const socket = io("/admin");

// DOM elements - Badges
const badgeTikTok = document.getElementById("badgeTikTok");
const textTikTok = document.getElementById("textTikTok");
const avatarTikTokMini = document.getElementById("avatarTikTokMini");

const badgeTikfinity = document.getElementById("badgeTikfinity");
const textTikfinity = document.getElementById("textTikfinity");
const badgeRound = document.getElementById("badgeRound");
const badgeStreak = document.getElementById("badgeStreak");

// Secret Display
const secretTarget = document.getElementById("secretTarget");
const secretCategory = document.getElementById("secretCategory");
const secretLevel = document.getElementById("secretLevel");
const secretTimer = document.getElementById("secretTimer");

// Action Buttons
const btnStartRound = document.getElementById("btnStartRound");
const btnNextRound = document.getElementById("btnNextRound");
const btnReveal = document.getElementById("btnReveal");
const btnTogglePause = document.getElementById("btnTogglePause");
const btnResetGame = document.getElementById("btnResetGame");

// TikTok Connection Controls
const inputTikTokUser = document.getElementById("inputTikTokUser");
const btnConnectTikTok = document.getElementById("btnConnectTikTok");
const btnDisconnectTikTok = document.getElementById("btnDisconnectTikTok");
const tiktokInfoBox = document.getElementById("tiktokInfoBox");
const tiktokAvatarWrap = document.getElementById("tiktokAvatarWrap");
const tiktokStreamerName = document.getElementById("tiktokStreamerName");
const tiktokStreamerStatus = document.getElementById("tiktokStreamerStatus");

// Configuration Controls
const selectLevel = document.getElementById("selectLevel");
const selectCategory = document.getElementById("selectCategory");
const btnApplySettings = document.getElementById("btnApplySettings");

const inputTikfinityUrl = document.getElementById("inputTikfinityUrl");
const btnConnectTikfinity = document.getElementById("btnConnectTikfinity");
const btnDisconnectTikfinity = document.getElementById("btnDisconnectTikfinity");
const badgeTikfinityCard = document.getElementById("badgeTikfinityCard");

// Simulator Controls
const simUser = document.getElementById("simUser");
const simGuess = document.getElementById("simGuess");
const btnSimulateGuess = document.getElementById("btnSimulateGuess");
const btnSimulateWin = document.getElementById("btnSimulateWin");
const btnSimulateRandom = document.getElementById("btnSimulateRandom");

// Live Feeds
const guessFeed = document.getElementById("guessFeed");
const btnClearFeed = document.getElementById("btnClearFeed");
const leaderboardList = document.getElementById("leaderboardList");
const btnResetLeaderboard = document.getElementById("btnResetLeaderboard");

const toast = document.getElementById("toast");

let currentState = null;
let lastTikTokStatus = { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function updateTikStatus(connected) {
  if (connected) {
    badgeTikfinity.className = "badge badge-green";
    textTikfinity.textContent = "TikFinity Connected";
    if (badgeTikfinityCard) {
      badgeTikfinityCard.className = "badge badge-green";
      badgeTikfinityCard.textContent = "Connected";
    }
  } else {
    badgeTikfinity.className = "badge badge-red";
    textTikfinity.textContent = "TikFinity Disconnected";
    if (badgeTikfinityCard) {
      badgeTikfinityCard.className = "badge badge-red";
      badgeTikfinityCard.textContent = "Disconnected";
    }
  }
}

function updateTikTokStatus(status) {
  lastTikTokStatus = status || { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

  if (lastTikTokStatus.connected) {
    badgeTikTok.className = "badge badge-green";
    const displayName = lastTikTokStatus.nickname || `@${lastTikTokStatus.username}` || "Live Stream";
    textTikTok.textContent = `TikTok: ${displayName}`;

    if (lastTikTokStatus.avatar) {
      avatarTikTokMini.style.display = "inline-flex";
      avatarTikTokMini.innerHTML = `<img src="${esc(lastTikTokStatus.avatar)}" class="avatar-mini" alt="${esc(displayName)}">`;
    } else {
      avatarTikTokMini.style.display = "none";
      avatarTikTokMini.innerHTML = "";
    }

    if (tiktokInfoBox) {
      tiktokInfoBox.style.display = "flex";
      tiktokStreamerName.textContent = displayName;
      tiktokStreamerStatus.textContent = "Connected & Listening for Guesses";
      tiktokStreamerStatus.style.color = "#48df83";

      if (lastTikTokStatus.avatar) {
        tiktokAvatarWrap.innerHTML = `<img src="${esc(lastTikTokStatus.avatar)}" alt="${esc(displayName)}">`;
      } else {
        const initial = (lastTikTokStatus.username || "T")[0].toUpperCase();
        tiktokAvatarWrap.innerHTML = `<span style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#8e54e9;color:#fff;text-align:center;line-height:36px;font-weight:bold;font-size:16px">${initial}</span>`;
      }
    }
  } else if (lastTikTokStatus.connecting) {
    badgeTikTok.className = "badge badge-yellow";
    textTikTok.textContent = `Connecting @${lastTikTokStatus.username || ""}...`;
    avatarTikTokMini.style.display = "none";

    if (tiktokInfoBox) {
      tiktokInfoBox.style.display = "flex";
      tiktokStreamerName.textContent = `@${lastTikTokStatus.username || "TikTok User"}`;
      tiktokStreamerStatus.textContent = "Connecting to TikTok live...";
      tiktokStreamerStatus.style.color = "#f59e0b";
      tiktokAvatarWrap.innerHTML = `<span style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#78350f;color:#fef08a;text-align:center;line-height:36px;font-weight:bold">⏳</span>`;
    }
  } else {
    badgeTikTok.className = "badge badge-red";
    textTikTok.textContent = "TikTok Disconnected";
    avatarTikTokMini.style.display = "none";

    if (tiktokInfoBox) {
      tiktokInfoBox.style.display = "none";
    }
  }
}

function renderAvatarHTML(avatarUrl, nickname) {
  const initial = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return `<img src="${esc(avatarUrl)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid #7456b6" alt="${esc(nickname)}" onerror="this.outerHTML='<span style=\\'display:inline-block;width:24px;height:24px;border-radius:50%;background:#8e54e9;color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:bold\\'>${initial}</span>'">`;
  }
  return `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#8e54e9;color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:bold">${initial}</span>`;
}

function renderState(state) {
  currentState = state;

  badgeRound.textContent = `Round ${state.round || 1}`;
  badgeStreak.textContent = `🔥 Streak ${state.streak || 0}`;
  updateTikStatus(state.tikfinityConnected);

  // TikTok connection status
  updateTikTokStatus({
    connected: !!state.tiktokConnected,
    connecting: !!state.tiktokConnecting,
    nickname: state.tiktokLiveStreamerName || "",
    avatar: state.tiktokLiveStreamerAvatar || "",
    username: state.tiktokLiveUsername || ""
  });

  if (inputTikTokUser && state.tiktokLiveUsername && document.activeElement !== inputTikTokUser) {
    inputTikTokUser.value = state.tiktokLiveUsername;
  }

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

  document.querySelectorAll("[data-sec]").forEach((btn) => {
    const sec = parseInt(btn.getAttribute("data-sec"), 10);
    btn.classList.toggle("active", sec === state.roundDurationSec);
  });

  const customSecInput = document.getElementById("customSecInput");
  if (customSecInput && document.activeElement !== customSecInput) {
    customSecInput.value = state.roundDurationSec || 20;
  }

  if (selectCategory && document.activeElement !== selectCategory) {
    selectCategory.value = state.categoryOverride || "random";
  }

  if (selectLevel && document.activeElement !== selectLevel) {
    selectLevel.value = state.autoLevel ? "auto" : String(state.manualLevel || state.level);
  }

  renderLeaderboard(state.leaderboard || []);
}

function addGuessToFeed(guessItem) {
  if (guessFeed.children.length === 1 && guessFeed.children[0].textContent.includes("Waiting")) {
    guessFeed.innerHTML = "";
  }

  const div = document.createElement("div");
  div.className = `guess-item ${guessItem.isCorrect ? "winner" : ""}`;
  
  const timeStr = new Date(guessItem.timestamp || Date.now()).toLocaleTimeString();
  const mark = guessItem.isCorrect ? "✓ WINNER!" : "• Incorrect";
  const avatar = renderAvatarHTML(guessItem.avatar, guessItem.nickname);

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      ${avatar}
      <div>
        <strong>@${esc(guessItem.nickname || guessItem.user)}</strong>: 
        <span style="font-weight:bold;letter-spacing:1px">${esc(guessItem.code)}</span>
        <span style="font-size:11px;opacity:0.85;margin-left:4px">${mark}</span>
      </div>
    </div>
    <div class="guess-meta">${timeStr}</div>
  `;

  guessFeed.insertBefore(div, guessFeed.firstChild);

  if (guessFeed.children.length > 50) {
    guessFeed.removeChild(guessFeed.lastChild);
  }
}

function renderLeaderboard(list) {
  if (!list || list.length === 0) {
    leaderboardList.innerHTML = `<li style="color:var(--muted);font-size:12px">No winners yet.</li>`;
    return;
  }

  leaderboardList.innerHTML = list.map((item, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
    const avatar = renderAvatarHTML(item.avatar, item.nickname);
    return `
      <li class="leaderboard-item">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:bold;width:24px">${medal}</span>
          ${avatar}
          <span><strong>@${esc(item.nickname || item.user)}</strong></span>
        </div>
        <div style="font-weight:bold;color:#ffd700">${item.score} pts</div>
      </li>
    `;
  }).join("");
}

// Socket events
socket.on("connect", () => {
  console.log("[Admin] Connected to server");
});

socket.on("gameState", (data) => {
  renderState(data);
});

socket.on("tiktokConnectionStatus", (status) => {
  updateTikTokStatus(status);
});

socket.on("tikfinityConnectionStatus", (connected) => {
  updateTikStatus(connected);
});

socket.on("chatGuess", (guessItem) => {
  addGuessToFeed(guessItem);
});

socket.on("winnerFound", (payload) => {
  const medal = payload.place === 1 ? "🥇 1st" : "🥈 2nd";
  showToast(`${medal} Winner: @${payload.winner?.nickname || payload.winner?.user} (+${payload.points} pts)!`);
});

socket.on("timeExpired", (payload) => {
  showToast(`⏰ Time's up! Answer was ${payload.target}`);
});

socket.on("tikfinityLog", (msg) => {
  console.log(`[TikFinity Log] ${msg}`);
});

socket.on("tiktokLog", (msg) => {
  console.log(`[TikTok Log] ${msg}`);
});

// Admin Controls - Direct TikTok Connection
if (btnConnectTikTok) {
  btnConnectTikTok.addEventListener("click", async () => {
    const username = (inputTikTokUser?.value || "").trim().replace(/^@/, "");
    if (!username) {
      alert("Please enter your TikTok username (e.g. allystreamer)");
      return;
    }
    showToast(`Connecting to TikTok @${username}...`);
    try {
      await fetch("/admin/connect-tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
    } catch {
      socket.emit("connectTikTok", { username });
    }
  });
}

if (btnDisconnectTikTok) {
  btnDisconnectTikTok.addEventListener("click", async () => {
    showToast("Disconnecting TikTok...");
    try {
      await fetch("/admin/disconnect-tiktok", { method: "POST" });
    } catch {
      socket.emit("disconnectTikTok");
    }
  });
}

// Round Management Controls
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

// Timer Presets & Custom Duration
const customSecInputEl = document.getElementById("customSecInput");
const btnSaveCustomSecEl = document.getElementById("btnSaveCustomSec");

if (btnSaveCustomSecEl && customSecInputEl) {
  btnSaveCustomSecEl.addEventListener("click", () => {
    const val = parseInt(customSecInputEl.value, 10);
    if (val && val >= 5) {
      socket.emit("setOptions", { duration: val });
      showToast(`Timer set to ${val}s`);
    } else {
      alert("Please enter a valid time (at least 5 seconds)");
    }
  });
}

document.querySelectorAll("[data-sec]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const duration = parseInt(btn.getAttribute("data-sec"), 10);
    if (customSecInputEl) customSecInputEl.value = duration;
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

// TikFinity Connection Controls
if (btnConnectTikfinity) {
  btnConnectTikfinity.addEventListener("click", async () => {
    const url = (inputTikfinityUrl?.value || "").trim() || "ws://localhost:21213/";
    showToast(`Connecting to TikFinity at ${url}...`);
    try {
      await fetch("/admin/connect-tikfinity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
    } catch {
      socket.emit("connectTikfinity", { url });
    }
  });
}

if (btnDisconnectTikfinity) {
  btnDisconnectTikfinity.addEventListener("click", async () => {
    showToast("Disconnecting TikFinity...");
    try {
      await fetch("/admin/disconnect-tikfinity", { method: "POST" });
    } catch {
      socket.emit("disconnectTikfinity");
    }
  });
}

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
  socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
  simGuess.value = "";
  showToast(`Simulated guess: ${guess} by @${user}`);
});

btnSimulateWin.addEventListener("click", () => {
  if (!currentState?.secretTarget) return;
  const isFirst = !currentState.roundWinners || currentState.roundWinners.length === 0;
  const defaultUser = isFirst ? "SpeedyWinner" : "SecondWinner";
  const user = simUser.value.trim() || defaultUser;
  
  socket.emit("simulateGuess", {
    username: user,
    nickname: user,
    message: currentState.secretTarget
  });
  showToast(`Simulated WIN (${isFirst ? '🥇 1st' : '🥈 2nd'}): ${currentState.secretTarget} by @${user}`);
});

btnSimulateRandom.addEventListener("click", () => {
  const COLS = ["A", "B", "C", "D", "E", "F"];
  const ROWS = [1, 2, 3, 4];
  const rand = COLS[Math.floor(Math.random() * COLS.length)] + ROWS[Math.floor(Math.random() * ROWS.length)];
  const user = simUser.value.trim() || "Viewer" + Math.floor(Math.random() * 100);
  socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
  showToast(`Simulated guess: ${rand} by @${user}`);
});
