// public/auth-guard.js - Ally's Stream Hub Password Authentication Guard
(function () {
  const STORAGE_KEY = "ally_auth_token";

  // 1. NEVER prompt or show login modals inside any iframe (nested previews / mini-games)
  if (window.self !== window.top) {
    return;
  }

  // 2. Pure OBS livestream overlays NEVER prompt for a password
  const path = window.location.pathname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const isOverlay =
    path === "/overlay" || path === "/overlay.html" ||
    path === "/leaderboard" || path === "/leaderboard.html" ||
    path === "/mobile" || path === "/mobile.html" ||
    path.startsWith("/games/") ||
    urlParams.has("obs") || urlParams.has("overlay");

  if (isOverlay) {
    return;
  }

  function getCookie(name) {
    try {
      const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[2]) : null;
    } catch (e) {
      return null;
    }
  }

  function setCookie(name, val, days = 30) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      const isHttps = window.location.protocol === "https:";
      const secure = isHttps ? "; Secure" : "";
      document.cookie = `${name}=${encodeURIComponent(val)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
    } catch (e) {}
  }

  function clearAuth() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { document.cookie = "ally_auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;"; } catch (e) {}
    window.__ally_authenticated = false;
  }

  function saveAuth(token) {
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_KEY, token); } catch (e) {}
    setCookie("ally_auth", token, 30);
    window.__ally_authenticated = true;
  }

  function getSavedToken() {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local && local.trim().length >= 16) return local.trim();
    } catch (e) {}
    try {
      const session = sessionStorage.getItem(STORAGE_KEY);
      if (session && session.trim().length >= 16) return session.trim();
    } catch (e) {}
    try {
      const cookie = getCookie("ally_auth");
      if (cookie && cookie.trim().length >= 16) return cookie.trim();
    } catch (e) {}
    return null;
  }

  async function submitPassword(password) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: String(password).trim() })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        saveAuth(data.token);
        return { success: true };
      }
      return { success: false, error: data.error || "Incorrect password" };
    } catch (e) {
      return { success: false, error: "Connection error. Please try again." };
    }
  }

  async function verifyTokenSilently(token) {
    if (!token) return;
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (res.status === 401) {
        clearAuth();
        showLoginModal();
        return;
      }
      const data = await res.json();
      if (data && data.ok === false) {
        clearAuth();
        showLoginModal();
      }
    } catch (e) {
      // Network hiccup or temporary offline - KEEP existing session, DO NOT wipe storage!
    }
  }

  function showLoginModal() {
    // If already marked as authenticated, do not show
    if (window.__ally_authenticated) return;

    // Ensure auth CSS is loaded
    if (!document.getElementById("allyAuthCss")) {
      const link = document.createElement("link");
      link.id = "allyAuthCss";
      link.rel = "stylesheet";
      link.href = "/auth-guard.css?v=5";
      document.head.appendChild(link);
    }

    // Check if overlay already exists
    let overlay = document.getElementById("allyAuthOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "allyAuthOverlay";
      overlay.innerHTML = `
        <div class="ally-auth-card">
          <div class="ally-auth-avatar-wrap">
            <img src="/ally-avatar.png" alt="Ally" class="ally-auth-avatar" onerror="this.outerHTML='<span class=\\'ally-auth-fallback-icon\\'>🔒</span>'" />
          </div>
          <h2 class="ally-auth-title">Ally's Stream Hub</h2>
          <p class="ally-auth-subtitle">Enter password to unlock stream access</p>
          <form class="ally-auth-form" id="allyAuthForm" autocomplete="off" onsubmit="return false;">
            <div class="ally-auth-input-wrap">
              <span class="ally-auth-input-icon">🔑</span>
              <input type="password" class="ally-auth-input" id="allyAuthInput" placeholder="Enter password..." autocomplete="current-password" autofocus />
              <button type="button" class="ally-auth-toggle-vis" id="allyAuthToggleVis" title="Show / Hide Password">👁️</button>
            </div>
            <div class="ally-auth-error" id="allyAuthError"></div>
            <button type="submit" class="ally-auth-submit" id="allyAuthSubmit">
              <span>Unlock Hub 🚀</span>
            </button>
          </form>
        </div>
      `;

      if (document.body) {
        document.body.appendChild(overlay);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (!window.__ally_authenticated && document.body) {
            document.body.appendChild(overlay);
          }
        });
      }
    } else {
      overlay.classList.remove("ally-auth-hidden");
    }

    // Wire up interaction
    const input = document.getElementById("allyAuthInput");
    const toggleBtn = document.getElementById("allyAuthToggleVis");
    const submitBtn = document.getElementById("allyAuthSubmit");
    const errorEl = document.getElementById("allyAuthError");
    const cardEl = overlay.querySelector(".ally-auth-card");
    const form = document.getElementById("allyAuthForm");

    if (input) {
      setTimeout(() => input.focus(), 100);
    }

    if (toggleBtn && input) {
      toggleBtn.onclick = () => {
        if (input.type === "password") {
          input.type = "text";
          toggleBtn.textContent = "🙈";
        } else {
          input.type = "password";
          toggleBtn.textContent = "👁️";
        }
      };
    }

    async function handleUnlock() {
      const val = input ? input.value.trim() : "";
      if (!val) {
        if (errorEl) {
          errorEl.textContent = "⚠️ Please enter the password";
          errorEl.classList.add("visible");
        }
        if (cardEl) {
          cardEl.classList.remove("ally-auth-shake");
          void cardEl.offsetWidth;
          cardEl.classList.add("ally-auth-shake");
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Verifying... ⏳</span>`;
      }
      if (errorEl) errorEl.classList.remove("visible");

      const res = await submitPassword(val);

      if (res.success) {
        if (submitBtn) {
          submitBtn.innerHTML = `<span>Unlocked! ✅</span>`;
          submitBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
          submitBtn.style.color = "#ffffff";
        }

        setTimeout(() => {
          overlay.classList.add("ally-auth-hidden");
          setTimeout(() => overlay.remove(), 400);
          window.dispatchEvent(new CustomEvent("ally_authenticated"));
        }, 300);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Unlock Hub 🚀</span>`;
        }
        if (errorEl) {
          errorEl.textContent = `❌ ${res.error || "Incorrect password"}`;
          errorEl.classList.add("visible");
        }
        if (cardEl) {
          cardEl.classList.remove("ally-auth-shake");
          void cardEl.offsetWidth;
          cardEl.classList.add("ally-auth-shake");
        }
        if (input) {
          input.value = "";
          input.focus();
        }
      }
    }

    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        handleUnlock();
      };
    }
  }

  // --- INITIALIZATION ---
  const quickKey = urlParams.get("key") || urlParams.get("auth") || urlParams.get("password");
  const existingToken = getSavedToken();

  if (existingToken) {
    // Optimistic authentication: set authenticated immediately, never prompt on refresh!
    window.__ally_authenticated = true;
    verifyTokenSilently(existingToken);
  } else if (quickKey) {
    submitPassword(quickKey).then((res) => {
      if (!res.success) {
        showLoginModal();
      }
    });
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showLoginModal);
    } else {
      showLoginModal();
    }
  }

  window.showAllyLoginPopup = showLoginModal;
  window.isAllyAuthenticated = () => !!window.__ally_authenticated;
})();
