// public/auth-guard.js - Ally's Stream Hub Password Popup Authentication Guard
(function () {
  const STORAGE_KEY = "ally_auth_token";

  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, val, days = 30) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(val)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  // Check URL parameters for OBS / direct link quick-pass (e.g. ?key=admin123 or ?auth=admin123)
  const urlParams = new URLSearchParams(window.location.search);
  const quickKey = urlParams.get("key") || urlParams.get("auth") || urlParams.get("password");

  // Check if iframe parent is already unlocked
  function isParentUnlocked() {
    try {
      if (window.parent && window.parent !== window) {
        return !!window.parent.__ally_authenticated;
      }
    } catch (e) {}
    return false;
  }

  // Check if locally marked as authenticated
  const existingToken = localStorage.getItem(STORAGE_KEY) || getCookie("ally_auth");

  async function verifyToken(token) {
    if (!token) return false;
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      return !!data.ok;
    } catch (e) {
      return false;
    }
  }

  async function submitPassword(password) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem(STORAGE_KEY, data.token);
        setCookie("ally_auth", data.token, 30);
        window.__ally_authenticated = true;
        return { success: true };
      }
      return { success: false, error: data.error || "Incorrect password" };
    } catch (e) {
      return { success: false, error: "Connection error. Please try again." };
    }
  }

  // Initialize
  async function initAuthGuard() {
    // 1. If quickKey is provided in URL, automatically attempt login
    if (quickKey) {
      const res = await submitPassword(quickKey);
      if (res.success) {
        window.__ally_authenticated = true;
        return; // Successfully unlocked via URL key
      }
    }

    // 2. If parent window is unlocked, bypass
    if (isParentUnlocked()) {
      window.__ally_authenticated = true;
      return;
    }

    // 3. If stored token exists, verify with server
    if (existingToken) {
      const valid = await verifyToken(existingToken);
      if (valid) {
        window.__ally_authenticated = true;
        return; // Valid session
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // 4. Show Login Popup Modal
    showLoginModal();
  }

  function showLoginModal() {
    // Ensure auth CSS is loaded
    if (!document.getElementById("allyAuthCss")) {
      const link = document.createElement("link");
      link.id = "allyAuthCss";
      link.rel = "stylesheet";
      link.href = "/auth-guard.css";
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

      // Append as soon as DOM is ready
      if (document.body) {
        document.body.appendChild(overlay);
      } else {
        document.addEventListener("DOMContentLoaded", () => document.body.appendChild(overlay));
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

  // Start authentication check
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthGuard);
  } else {
    initAuthGuard();
  }

  window.showAllyLoginPopup = showLoginModal;
  window.isAllyAuthenticated = () => !!window.__ally_authenticated;
})();
