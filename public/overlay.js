// public/overlay.js - Universal Stream Overlay Manager
const socket = io();

const gameFrame = document.getElementById("gameFrame");
const switchBanner = document.getElementById("switchBanner");
const bannerIcon = document.getElementById("bannerIcon");
const bannerGameTitle = document.getElementById("bannerGameTitle");

let currentActiveGameId = "";
let bannerTimer = null;

const GAME_OVERLAYS = {
  "odd-one-out": {
    path: "/games/odd-one-out/overlay.html",
    name: "Ally's Odd One Out",
    icon: "🧩"
  },
  "think-like-ally": {
    path: "/games/think-like-ally/overlay.html",
    name: "Think Like Ally",
    icon: "💡"
  },
  "think-and-link": {
    path: "/games/think-and-link/overlay.html",
    name: "Think & Link",
    icon: "💜"
  }
};

function showSwitchBanner(name, icon) {
  if (!switchBanner) return;
  bannerGameTitle.textContent = name;
  bannerIcon.textContent = icon || "🎮";
  switchBanner.classList.add("show");

  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    switchBanner.classList.remove("show");
  }, 3500);
}

function loadGame(gameId, gameDef = null) {
  if (!gameId || gameId === currentActiveGameId) return;
  currentActiveGameId = gameId;

  const config = GAME_OVERLAYS[gameId] || {
    path: gameDef?.overlayPath || `/games/${gameId}/overlay.html`,
    name: gameDef?.name || gameId,
    icon: gameDef?.icon || "🎮"
  };

  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.get("admin") === "true";
  let targetPath = config.path;
  if (isAdmin) {
    targetPath += "?admin=true";
  }

  gameFrame.classList.add("fading");

  setTimeout(() => {
    gameFrame.src = targetPath;
    gameFrame.onload = () => {
      gameFrame.classList.remove("fading");
    };
    showSwitchBanner(config.name, config.icon);
  }, 250);
}

socket.on("connect", () => {
  console.log("[Universal Overlay] Connected to Hub");
});

socket.on("gameState", (data) => {
  if (data?.activeGameId && data.activeGameId !== currentActiveGameId) {
    loadGame(data.activeGameId);
  }
});

socket.on("gameSwitched", ({ gameId, def }) => {
  loadGame(gameId, def);
});
