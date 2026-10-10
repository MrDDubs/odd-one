/**
 * public/round-modal.js
 * Unified "This Round's Points" Modal Component for all Ally Stream Hub Minigames.
 * 
 * Rules:
 * 1. Shows top 3 podium (1st, 2nd, 3rd) and an "Also Scored" list below for 4th+.
 * 2. Does NOT show what the answer was (the game board reveals the answer before this popup).
 * 3. 4-second animated progress bar that smoothly counts down to next round.
 */

(function () {
  let modalTimer = null;

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderAvatar(avatarUrl, name) {
    const cleanName = esc(name || "Viewer");
    const firstLetter = (cleanName.charAt(0) || "?").toUpperCase();
    if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.trim()) {
      return `<img src="${esc(avatarUrl)}" class="avatar-img" alt="${cleanName}" onerror="this.outerHTML='<div class=\\'avatar-letter\\'>${firstLetter}</div>'">`;
    }
    return `<div class="avatar-letter">${firstLetter}</div>`;
  }

  function showRoundPointsModal(payload, options = {}) {
    const elModal = document.getElementById("leaderboardModal");
    const elModalPodium = document.getElementById("modalPodium");
    const elModalAlsoScored = document.getElementById("modalAlsoScored");
    const elModalAlsoScoredList = document.getElementById("modalAlsoScoredList");
    const elModalProgressBar = document.getElementById("modalProgressBar");

    if (!elModal || !elModalPodium) return;

    const rawWinners = payload?.roundWinners || payload?.winners || [];
    const durationMs = payload?.durationMs || 4000;

    // Deduplicate and aggregate round points per unique player
    const playerMap = new Map();
    rawWinners.forEach((w) => {
      if (!w) return;
      const user = w.user || w.username || w.nickname || "Viewer";
      const key = String(user).toLowerCase();
      const pts = Number(w.points) || 0;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          user,
          nickname: w.nickname || user,
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

    // Sort unique players by points earned this round, tie-breaker is first correct guess
    const winners = Array.from(playerMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.firstWonAt - b.firstWonAt;
    });

    let podiumHTML = "";
    if (winners.length > 0) {
      const first = winners[0];
      const firstBonus = first.wordsCount > 1 ? ` (${first.wordsCount} words)` : "";
      podiumHTML += `
        <div class="podium-card first">
          <div class="podium-rank">🥇 1st Place</div>
          <div class="avatar-wrap">${renderAvatar(first.avatar, first.nickname || first.user)}</div>
          <div class="podium-name">@${esc(first.nickname || first.user)}</div>
          <div class="podium-pts">+${first.points} pts${firstBonus}</div>
        </div>
      `;

      if (winners.length > 1) {
        const second = winners[1];
        const secondBonus = second.wordsCount > 1 ? ` (${second.wordsCount} words)` : "";
        podiumHTML += `
          <div class="podium-card second">
            <div class="podium-rank">🥈 2nd Place</div>
            <div class="avatar-wrap">${renderAvatar(second.avatar, second.nickname || second.user)}</div>
            <div class="podium-name">@${esc(second.nickname || second.user)}</div>
            <div class="podium-pts">+${second.points} pts${secondBonus}</div>
          </div>
        `;
      }

      if (winners.length > 2) {
        const third = winners[2];
        const thirdBonus = third.wordsCount > 1 ? ` (${third.wordsCount} words)` : "";
        podiumHTML += `
          <div class="podium-card third">
            <div class="podium-rank">🥉 3rd Place</div>
            <div class="avatar-wrap">${renderAvatar(third.avatar, third.nickname || third.user)}</div>
            <div class="podium-name">@${esc(third.nickname || third.user)}</div>
            <div class="podium-pts">+${third.points} pts${thirdBonus}</div>
          </div>
        `;
      }
    } else {
      // NOTE: Per requirement, the modal NEVER reveals the answer!
      // The game board already reveals the answer before this popup.
      podiumHTML = `
        <div class="podium-card empty-winners">
          <div class="podium-rank" style="color:#6b21a8; font-size:1.35vh;">⏰ No Winners This Round</div>
          <div style="font-size:1.2vh; color:#4c1d95; font-weight:700; margin-top:4px;">Next round starting soon...</div>
        </div>
      `;
    }

    elModalPodium.innerHTML = podiumHTML;

    // Render Also Scored list below Top 3 scorers (Up to Top 10 total: 3 on podium + ranks 4-10)
    const alsoScored = winners.slice(3, 10);
    const extraCount = winners.length > 10 ? winners.length - 10 : 0;
    if (elModalAlsoScored && elModalAlsoScoredList) {
      if (alsoScored.length > 0) {
        elModalAlsoScored.style.display = "flex";

        const elTitle = elModalAlsoScored.querySelector(".also-scored-title");
        if (elTitle) {
          elTitle.textContent = `⚡ TOP 10 SCORERS (4TH - ${Math.min(10, winners.length)}TH)`;
        }

        let rowsHtml = alsoScored.map((p, idx) => `
          <div class="also-scored-row">
            <div class="also-scored-left">
              <span class="also-scored-rank">#${idx + 4}</span>
              <div class="top-avatar-wrap">${renderAvatar(p.avatar, p.nickname || p.user)}</div>
              <span class="also-scored-name">@${esc(p.nickname || p.user)}</span>
            </div>
            <span class="also-scored-pts">+${p.points} pts${p.wordsCount > 1 ? ` (${p.wordsCount} words)` : ""}</span>
          </div>
        `).join("");

        if (extraCount > 0) {
          rowsHtml += `
            <div class="also-scored-footer">
              +${extraCount} more player${extraCount === 1 ? "" : "s"} scored this round
            </div>
          `;
        }

        elModalAlsoScoredList.innerHTML = rowsHtml;
      } else {
        elModalAlsoScored.style.display = "none";
        elModalAlsoScoredList.innerHTML = "";
      }
    }

    // 4-Second Countdown bar
    if (elModalProgressBar) {
      elModalProgressBar.style.transition = "none";
      elModalProgressBar.style.width = "100%";
      void elModalProgressBar.offsetWidth;
      elModalProgressBar.style.transition = `width ${durationMs}ms linear`;
      elModalProgressBar.style.width = "0%";
    }

    elModal.classList.add("active");

    if (modalTimer) clearTimeout(modalTimer);
    modalTimer = setTimeout(() => {
      elModal.classList.remove("active");
    }, durationMs);
  }

  window.showRoundPointsModal = showRoundPointsModal;
})();
