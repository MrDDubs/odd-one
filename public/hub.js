// public/hub.js - Ally's Stream Hub Manager (ESM)
const socket = io("/admin");

// Header Badges
const badgeTikTok = document.getElementById("badgeTikTok");
const textTikTok = document.getElementById("textTikTok");
const avatarTikTokMini = document.getElementById("avatarTikTokMini");
const badgeTikfinity = document.getElementById("badgeTikfinity");
const textTikfinity = document.getElementById("textTikfinity");
const badgeTikfinityCard = document.getElementById("badgeTikfinityCard");
const badgeActiveGame = document.getElementById("badgeActiveGame");

// TikTok Connection Elements
const inputTikTokUser = document.getElementById("inputTikTokUser");
const btnConnectTikTok = document.getElementById("btnConnectTikTok");
const btnDisconnectTikTok = document.getElementById("btnDisconnectTikTok");
const tiktokInfoBox = document.getElementById("tiktokInfoBox");
const tiktokAvatarWrap = document.getElementById("tiktokAvatarWrap");
const tiktokStreamerName = document.getElementById("tiktokStreamerName");
const tiktokStreamerStatus = document.getElementById("tiktokStreamerStatus");

// TikFinity Connection Elements
const inputTikfinityUrl = document.getElementById("inputTikfinityUrl");
const btnConnectTikfinity = document.getElementById("btnConnectTikfinity");
const btnDisconnectTikfinity = document.getElementById("btnDisconnectTikfinity");

// Game Launcher & Workspace
const gameCardsGrid = document.getElementById("gameCardsGrid");
const activeGameWorkspace = document.getElementById("activeGameWorkspace");

// Feeds & Leaderboard
const guessFeed = document.getElementById("guessFeed");
const btnClearFeed = document.getElementById("btnClearFeed");
const leaderboardList = document.getElementById("leaderboardList");
const btnResetLeaderboard = document.getElementById("btnResetLeaderboard");

// Modal & Toast
const overlayModal = document.getElementById("overlayModal");
const btnOpenOverlayLinks = document.getElementById("btnOpenOverlayLinks");
const btnCloseModal = document.getElementById("btnCloseModal");
const toast = document.getElementById("toast");

let currentState = null;
let currentActiveGameId = "";
let activeGameController = null;
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

// Update TikTok connection status
function updateTikTokStatus(status) {
  lastTikTokStatus = status || { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

  if (lastTikTokStatus.connected) {
    if (badgeTikTok) badgeTikTok.className = "badge badge-green";
    const displayName = lastTikTokStatus.nickname || `@${lastTikTokStatus.username}` || "Live";
    if (textTikTok) textTikTok.textContent = displayName;

    if (avatarTikTokMini) {
      if (lastTikTokStatus.avatar) {
        avatarTikTokMini.style.display = "inline-flex";
        avatarTikTokMini.innerHTML = `<img src="${esc(lastTikTokStatus.avatar)}" class="avatar-mini" alt="${esc(displayName)}">`;
      } else {
        avatarTikTokMini.style.display = "none";
        avatarTikTokMini.innerHTML = "";
      }
    }

    if (btnConnectTikTok) btnConnectTikTok.style.display = "none";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "inline-flex";
    if (inputTikTokUser && lastTikTokStatus.username) {
      inputTikTokUser.value = lastTikTokStatus.username;
    }
  } else if (lastTikTokStatus.connecting) {
    if (badgeTikTok) badgeTikTok.className = "badge badge-yellow";
    if (textTikTok) textTikTok.textContent = `Connecting...`;
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";

    if (btnConnectTikTok) btnConnectTikTok.style.display = "none";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "inline-flex";
  } else {
    if (badgeTikTok) badgeTikTok.className = "badge badge-red";
    if (textTikTok) textTikTok.textContent = "Disconnected";
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";

    if (btnConnectTikTok) btnConnectTikTok.style.display = "inline-flex";
    if (btnDisconnectTikTok) btnDisconnectTikTok.style.display = "none";
  }
}

// Update TikFinity connection status
function updateTikStatus(connected) {
  if (badgeTikfinity && textTikfinity) {
    if (connected) {
      badgeTikfinity.className = "badge badge-green";
      textTikfinity.textContent = "TikFinity Connected";
    } else {
      badgeTikfinity.className = "badge badge-red";
      textTikfinity.textContent = "TikFinity Disconnected";
    }
  }
  if (badgeTikfinityCard) {
    if (connected) {
      badgeTikfinityCard.className = "badge badge-green";
      badgeTikfinityCard.textContent = "Connected";
    } else {
      badgeTikfinityCard.className = "badge badge-red";
      badgeTikfinityCard.textContent = "Disconnected";
    }
  }
}

// Render Game Launcher Cards
function renderGameCatalog(games, activeId) {
  if (!gameCardsGrid || !games) return;

  gameCardsGrid.innerHTML = games
    .map((game) => {
      const isActive = game.id === activeId;
      return `
        <div class="game-card ${isActive ? "active" : ""}" data-game-id="${game.id}">
          <div class="game-card-header">
            <span class="game-icon">${game.icon || "🎮"}</span>
            ${isActive ? `<span class="game-badge-active">ACTIVE NOW</span>` : `<span class="badge badge-purple" style="font-size:10px">${esc(game.category || "Game")}</span>`}
          </div>
          <div class="game-title">${esc(game.name)}</div>
          <div class="game-desc">${esc(game.description)}</div>
          <button class="btn-activate ${isActive ? "secondary" : "primary"}" data-switch="${game.id}">
            ${isActive ? "✓ Currently Active" : "🚀 Launch & Activate"}
          </button>
        </div>
      `;
    })
    .join("");

  // Attach switch click handlers
  gameCardsGrid.querySelectorAll("[data-switch]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetGameId = btn.getAttribute("data-switch");
      switchGame(targetGameId);
    });
  });

  gameCardsGrid.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("click", () => {
      const targetGameId = card.getAttribute("data-game-id");
      switchGame(targetGameId);
    });
  });
}

// Switch active game
function switchGame(gameId) {
  if (!gameId || gameId === currentActiveGameId) return;
  showToast(`Switching to ${gameId}...`);
  socket.emit("switchGame", { gameId });
}

// Dynamically load active game workspace & controller
async function loadActiveGameWorkspace(gameId, state) {
  if (!gameId || gameId === currentActiveGameId) {
    if (activeGameController?.onStateUpdate) {
      activeGameController.onStateUpdate(state);
    }
    return;
  }

  currentActiveGameId = gameId;

  const foundGame = currentState?.availableGames?.find((g) => g.id === gameId);
  const gameName = foundGame?.name || (gameId === "think-and-link" ? "Think & Link" : gameId === "think-like-ally" ? "Think Like Ally" : "Ally's Odd One Out");
  if (badgeActiveGame) {
    badgeActiveGame.innerHTML = `<span>Active: ${gameName}</span>`;
  }

  const controlsHtmlPath = `/games/${gameId}/controls.html`;
  const controlsJsPath = `/games/${gameId}/controls.js`;

  try {
    const res = await fetch(controlsHtmlPath);
    if (!res.ok) throw new Error("Failed to fetch game controls template");
    const html = await res.text();
    activeGameWorkspace.innerHTML = html;

    // Dynamically import game control initializer
    const module = await import(controlsJsPath);
    const initFn =
      module.initThinkAndLinkControls ||
      module.initOddOneOutControls ||
      module.initThinkLikeAllyControls ||
      module.initControls;

    if (typeof initFn === "function") {
      activeGameController = initFn({ socket, showToast });
      if (activeGameController?.onStateUpdate) {
        activeGameController.onStateUpdate(state);
      }
    }
  } catch (err) {
    console.error(`[Hub] Failed to load workspace for ${gameId}:`, err);
    activeGameWorkspace.innerHTML = `<div style="color:var(--danger);padding:16px">Failed to load controls for ${gameId}</div>`;
  }
}

function renderAvatarHTML(avatarUrl, nickname) {
  const initial = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return `<img src="${esc(avatarUrl)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid #7456b6" alt="${esc(nickname)}" onerror="this.outerHTML='<span style=\\'display:inline-block;width:24px;height:24px;border-radius:50%;background:#8e54e9;color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:bold\\'>${initial}</span>'">`;
  }
  return `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#8e54e9;color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:bold">${initial}</span>`;
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
        <span style="font-weight:bold;letter-spacing:0.5px">${esc(guessItem.code || guessItem.message)}</span>
        <span style="font-size:11px;opacity:0.85;margin-left:4px">${mark}</span>
      </div>
    </div>
    <div class="guess-meta">${timeStr}</div>
  `;

  guessFeed.insertBefore(div, guessFeed.firstChild);

  if (guessFeed.children.length > 60) {
    guessFeed.removeChild(guessFeed.lastChild);
  }
}

function renderLeaderboard(list) {
  if (!list || list.length === 0) {
    leaderboardList.innerHTML = `<li style="color:var(--muted);font-size:12px">No winners yet.</li>`;
    return;
  }

  leaderboardList.innerHTML = list
    .map((item, index) => {
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
    })
    .join("");
}

// Master state handler
function renderState(state) {
  currentState = state;

  updateTikStatus(state.tikfinityConnected);
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

  // Render Game Catalog
  if (state.availableGames) {
    renderGameCatalog(state.availableGames, state.activeGameId);
  }

  // Load Active Game Workspace
  loadActiveGameWorkspace(state.activeGameId, state);

  // Render Leaderboard
  renderLeaderboard(state.leaderboard || []);

  // Sync Speech Messages if provided
  if (state.speechMessages) {
    applySpeechData(state.speechMessages);
  }
}

// Socket events
socket.on("connect", () => {
  console.log("[Hub Dashboard] Connected to server");
});

socket.on("gameState", (data) => {
  renderState(data);
});

socket.on("gameSwitched", ({ gameId }) => {
  showToast(`Switched active game to: ${gameId}`);
});

socket.on("chatGuess", (guessItem) => {
  addGuessToFeed(guessItem);
});

socket.on("winnerFound", (payload) => {
  const medal = payload.place === 1 ? "🥇 1st" : "🥈 2nd";
  showToast(`${medal} Winner: @${payload.winner?.nickname || payload.winner?.user} (+${payload.points} pts)!`);
});

socket.on("timeExpired", (payload) => {
  showToast(`⏰ Time's up! Target was: ${payload.target || ""}`);
});

socket.on("tiktokConnectionStatus", (status) => {
  updateTikTokStatus(status);
});

socket.on("tikfinityConnectionStatus", (connected) => {
  updateTikStatus(connected);
});

// TikTok Connect / Disconnect Buttons
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

// TikFinity Connect / Disconnect Buttons
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

// Clear Feed & Reset Leaderboard
btnClearFeed.addEventListener("click", () => {
  guessFeed.innerHTML = `<div style="color:var(--muted);text-align:center;padding:16px">Feed cleared. Waiting for guesses...</div>`;
});

btnResetLeaderboard.addEventListener("click", () => {
  if (confirm("Reset current game leaderboard points?")) {
    socket.emit("gameAction", { gameId: currentActiveGameId, action: "resetLeaderboard" });
    showToast("Leaderboard Reset");
  }
});

// Overlay Links Modal
if (btnOpenOverlayLinks && overlayModal) {
  btnOpenOverlayLinks.addEventListener("click", () => {
    overlayModal.style.display = "grid";
  });
}

if (btnCloseModal && overlayModal) {
  btnCloseModal.addEventListener("click", () => {
    overlayModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === overlayModal) {
    overlayModal.style.display = "none";
  }
});

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-copy");
    const codeEl = document.getElementById(targetId);
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.textContent.trim());
      showToast("Link Copied to Clipboard! 📋");
    }
  });
});

// ==========================================
// Avatar Speech Bubble Messages Manager
// ==========================================
const inputNewSpeechMsg = document.getElementById("inputNewSpeechMsg");
const btnAddSpeechMsg = document.getElementById("btnAddSpeechMsg");
const inputSpeechCycleSeconds = document.getElementById("inputSpeechCycleSeconds");
const btnSaveCycleSeconds = document.getElementById("btnSaveCycleSeconds");
const speechMessagesList = document.getElementById("speechMessagesList");
const speechPreviewText = document.getElementById("speechPreviewText");

let speechData = {
  cycleSeconds: 8,
  messages: []
};
let speechPreviewTimer = null;
let speechPreviewIndex = 0;

function updateSpeechPreview() {
  if (!speechPreviewText) return;
  if (!speechData.messages || speechData.messages.length === 0) {
    speechPreviewText.textContent = "Welcome to the show! 💜";
    return;
  }
  const msg = speechData.messages[speechPreviewIndex % speechData.messages.length];
  speechPreviewText.textContent = msg ? msg.text : "Welcome to the show! 💜";
}

function startSpeechPreviewRotation() {
  if (speechPreviewTimer) clearInterval(speechPreviewTimer);
  updateSpeechPreview();
  if (speechData.messages && speechData.messages.length > 1) {
    const intervalMs = Math.max(3000, (speechData.cycleSeconds || 8) * 1000);
    speechPreviewTimer = setInterval(() => {
      speechPreviewIndex = (speechPreviewIndex + 1) % speechData.messages.length;
      updateSpeechPreview();
    }, intervalMs);
  }
}

function renderSpeechMessagesList() {
  if (!speechMessagesList) return;
  if (!speechData.messages || speechData.messages.length === 0) {
    speechMessagesList.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">No speech messages configured. Default greeting will be used.</div>`;
    return;
  }

  speechMessagesList.innerHTML = speechData.messages
    .map((msg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === speechData.messages.length - 1;
      return `
        <div class="speech-message-item" data-index="${idx}">
          <div class="speech-item-left">
            <span class="speech-item-index">#${idx + 1}</span>
            <span class="speech-item-text">${esc(msg.text)}</span>
          </div>
          <div class="speech-item-actions">
            <button class="speech-btn-icon btn-move-up" data-index="${idx}" ${isFirst ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Up">⬆️</button>
            <button class="speech-btn-icon btn-move-down" data-index="${idx}" ${isLast ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Down">⬇️</button>
            <button class="speech-btn-icon btn-edit-msg" data-index="${idx}" title="Edit Message">✏️</button>
            <button class="speech-btn-icon speech-btn-delete btn-delete-msg" data-index="${idx}" title="Delete Message">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach actions
  speechMessagesList.querySelectorAll(".btn-move-up").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (idx > 0) {
        const temp = speechData.messages[idx];
        speechData.messages[idx] = speechData.messages[idx - 1];
        speechData.messages[idx - 1] = temp;
        saveAndBroadcastSpeech();
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-move-down").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (idx < speechData.messages.length - 1) {
        const temp = speechData.messages[idx];
        speechData.messages[idx] = speechData.messages[idx + 1];
        speechData.messages[idx + 1] = temp;
        saveAndBroadcastSpeech();
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-edit-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const current = speechData.messages[idx]?.text || "";
      const updated = prompt("Edit speech message:", current);
      if (updated !== null) {
        const trimmed = updated.trim();
        if (trimmed) {
          speechData.messages[idx].text = trimmed;
          saveAndBroadcastSpeech();
        }
      }
    });
  });

  speechMessagesList.querySelectorAll(".btn-delete-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      const toDelete = speechData.messages[idx];
      if (confirm(`Delete message: "${toDelete?.text}"?`)) {
        speechData.messages.splice(idx, 1);
        saveAndBroadcastSpeech();
      }
    });
  });
}

function saveAndBroadcastSpeech() {
  renderSpeechMessagesList();
  startSpeechPreviewRotation();

  // Broadcast via Socket
  socket.emit("updateSpeechMessages", speechData);

  // Fallback REST call
  fetch("/api/speech-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(speechData)
  }).catch((err) => console.warn("[Hub] Failed REST speech save:", err));

  showToast("Speech Messages Saved & Updated! 💬");
}

function applySpeechData(data) {
  if (!data) return;
  if (Array.isArray(data.messages)) {
    speechData.messages = data.messages;
  }
  if (typeof data.cycleSeconds === "number" && data.cycleSeconds > 0) {
    speechData.cycleSeconds = data.cycleSeconds;
    if (inputSpeechCycleSeconds) {
      inputSpeechCycleSeconds.value = data.cycleSeconds;
    }
  }
  renderSpeechMessagesList();
  startSpeechPreviewRotation();
}

if (btnAddSpeechMsg && inputNewSpeechMsg) {
  const handleAdd = () => {
    const text = inputNewSpeechMsg.value.trim();
    if (!text) return;
    if (!speechData.messages) speechData.messages = [];
    speechData.messages.push({
      id: `msg-${Date.now()}`,
      text
    });
    inputNewSpeechMsg.value = "";
    saveAndBroadcastSpeech();
  };

  btnAddSpeechMsg.addEventListener("click", handleAdd);
  inputNewSpeechMsg.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd();
  });
}

if (btnSaveCycleSeconds && inputSpeechCycleSeconds) {
  btnSaveCycleSeconds.addEventListener("click", () => {
    const sec = parseInt(inputSpeechCycleSeconds.value, 10);
    if (!isNaN(sec) && sec >= 3 && sec <= 120) {
      speechData.cycleSeconds = sec;
      saveAndBroadcastSpeech();
    } else {
      alert("Please enter a cycle interval between 3 and 120 seconds.");
    }
  });
}

socket.on("speechMessagesUpdated", (data) => {
  applySpeechData(data);
});

// Fetch initial speech messages
fetch("/api/speech-messages")
  .then((res) => res.json())
  .then((data) => {
    if (data && data.messages) applySpeechData(data);
  })
  .catch((e) => console.warn("[Hub] Error fetching speech messages:", e));

