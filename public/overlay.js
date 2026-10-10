// public/overlay.js - Universal Stream Overlay Manager
const socket = io();

const gameFrame = document.getElementById("gameFrame");
const switchBanner = document.getElementById("switchBanner");
const bannerIcon = document.getElementById("bannerIcon");
const bannerGameTitle = document.getElementById("bannerGameTitle");

let currentActiveGameId = "";
let bannerTimer = null;

// Mobile layout (/mobile) loads /overlay?mobile=1 -> enlarge template elements
const IS_MOBILE_EMBED = new URLSearchParams(window.location.search).get("mobile") === "1";

function injectMobileStyles() {
  if (!IS_MOBILE_EMBED) return;
  try {
    const doc = gameFrame.contentDocument;
    if (!doc || !doc.head) return;
    if (doc.getElementById("mobileEmbedCss")) {
      gameFrame.classList.remove("fading");
      return;
    }
    const link = doc.createElement("link");
    link.id = "mobileEmbedCss";
    link.rel = "stylesheet";
    link.href = "/mobile-embed.css";
    // Only reveal the game once the bigger styles are applied (no small->big snap)
    const reveal = () => requestAnimationFrame(() => gameFrame.classList.remove("fading"));
    link.onload = reveal;
    link.onerror = reveal;
    doc.head.appendChild(link);
  } catch (e) {
    console.warn("[Universal Overlay] Could not inject mobile styles", e);
    gameFrame.classList.remove("fading");
  }
}

if (IS_MOBILE_EMBED) gameFrame.classList.add("fading");
gameFrame.addEventListener("load", injectMobileStyles);
if (gameFrame.contentDocument?.readyState === "complete" && gameFrame.contentDocument.head?.childElementCount) {
  injectMobileStyles();
}

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
  },
  "word-finder": {
    path: "/games/word-finder/overlay.html",
    name: "Ally's Word Finder",
    icon: "🔍"
  },
  "crowd-says": {
    path: "/games/crowd-says/overlay.html",
    name: "Ally's Chat Feud",
    icon: "⚔️"
  },
  "chat-feud": {
    path: "/games/crowd-says/overlay.html",
    name: "Ally's Chat Feud",
    icon: "⚔️"
  },
  "unscramble": {
    path: "/games/unscramble/overlay.html",
    name: "Ally's Unscramble",
    icon: "🔤"
  },
  "rebus": {
    path: "/games/rebus/overlay.html",
    name: "Ally's Rebus",
    icon: "🎭"
  },
  "riddle": {
    path: "/games/riddle/overlay.html",
    name: "Ally's Riddles",
    icon: "🧙‍♂️"
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
      // In mobile mode injectMobileStyles() reveals the frame after its CSS loads
      if (!IS_MOBILE_EMBED) gameFrame.classList.remove("fading");
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

// Register Service Worker for PWA Standalone Mode
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW registration error:", err));
  });
}

