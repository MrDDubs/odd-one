// public/leaderboard.js - Standalone Live Stream Leaderboard Controller
const socket = io();

// Query Parameters
const urlParams = new URLSearchParams(window.location.search);
const layoutParam = (urlParams.get("layout") || "vertical").toLowerCase();
const themeParam = (urlParams.get("theme") || "purple").toLowerCase();
const countParam = Math.max(1, Math.min(10, parseInt(urlParams.get("count"), 10) || 5));
const titleParam = urlParams.get("title");
const noTitleParam = urlParams.get("noTitle") === "true";
const showNamesParam = urlParams.get("showNames") !== "false";

// DOM Elements
const elApp = document.getElementById("leaderboardApp");
const elCard = document.getElementById("leaderboardCard");
const elHeader = document.getElementById("leaderboardHeader");
const elTitle = document.getElementById("leaderboardTitle");
const elPodium = document.getElementById("leaderboardPodium");

// Apply Layout & Theme Classes
if (elApp) {
  elApp.classList.add(layoutParam === "horizontal" ? "layout-horizontal" : "layout-vertical");
  if (themeParam === "gold") elApp.classList.add("theme-gold");
  else if (themeParam === "dark") elApp.classList.add("theme-dark");
  else elApp.classList.add("theme-purple");

  if (noTitleParam) {
    elApp.classList.add("no-title");
  }
}

if (elTitle) {
  if (titleParam) {
    elTitle.textContent = titleParam;
  } else {
    elTitle.textContent = `TOP ${countParam}`;
  }
}

// State tracking for animations
const prevScores = new Map();
const rankIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5", "rank-6", "rank-7", "rank-8", "rank-9", "rank-10"];

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLeaderboard(leaderboard) {
  if (!elPodium) return;

  const list = Array.isArray(leaderboard) ? leaderboard.slice(0, countParam) : [];
  let html = "";

  for (let i = 0; i < countParam; i++) {
    const p = list[i];
    const rankClass = rankClasses[i] || "";
    const rankIcon = rankIcons[i] || `${i + 1}️⃣`;

    if (p) {
      const username = p.nickname || p.user || "viewer";
      const userKey = String(p.user || username).toLowerCase();
      const initial = (username.replace(/^@/, "").charAt(0) || "?").toUpperCase();
      const score = Number(p.score) || 0;

      // Check if score changed to trigger pop animation
      const prevScore = prevScores.get(userKey);
      const isUpdated = prevScore !== undefined && prevScore !== score;
      prevScores.set(userKey, score);

      const avatarHtml = p.avatar
        ? `<div class="podium-avatar-wrap">
            <img src="${esc(p.avatar)}" class="podium-avatar-img" alt="${esc(username)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="podium-avatar-initial" style="display:none">${initial}</div>
            <span class="podium-rank-badge">${rankIcon}</span>
          </div>`
        : `<div class="podium-avatar-wrap">
            <div class="podium-avatar-initial">${initial}</div>
            <span class="podium-rank-badge">${rankIcon}</span>
          </div>`;

      const nameHtml = showNamesParam
        ? `<div class="podium-name" title="@${esc(username)}">@${esc(username)}</div>`
        : "";

      html += `
        <div class="podium-card ${rankClass} ${isUpdated ? "score-pop" : ""}" title="@${esc(username)} (${score} pts)">
          ${avatarHtml}
          ${nameHtml}
          <div class="podium-points">${score}<span class="podium-pts-suffix">pts</span></div>
        </div>
      `;
    } else {
      html += `
        <div class="podium-card ${rankClass} podium-empty" title="Empty Slot">
          <div class="podium-avatar-wrap">
            <div class="podium-avatar-initial empty">${rankIcon}</div>
          </div>
          ${showNamesParam ? '<div class="podium-name" style="opacity:0.4;">---</div>' : ""}
          <div class="podium-points">0<span class="podium-pts-suffix">pts</span></div>
        </div>
      `;
    }
  }

  elPodium.innerHTML = html;
}

// Live Socket Listeners
socket.on("connect", () => {
  console.log("🏆 Connected to live leaderboard stream");
});

socket.on("gameState", (data) => {
  if (data && data.leaderboard) {
    renderLeaderboard(data.leaderboard);
  }
});

socket.on("leaderboardUpdated", (leaderboard) => {
  if (Array.isArray(leaderboard)) {
    renderLeaderboard(leaderboard);
  }
});

socket.on("gameSwitched", () => {
  prevScores.clear();
});

// Initial Render with Empty Slots while awaiting first state
renderLeaderboard([]);
