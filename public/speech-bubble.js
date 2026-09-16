// public/speech-bubble.js - Animated Speech Bubble Controller
(function () {
  let messages = [
    { id: "msg-1", text: "Welcome to the show! 💜" },
    { id: "msg-2", text: "Type your answer in the chat to win!" },
    { id: "msg-3", text: "Tap the screen & share the LIVE! ✨" },
    { id: "msg-4", text: "Can you take the #1 spot on the leaderboard? 👑" }
  ];
  let cycleSeconds = 8;
  let currentIndex = 0;
  let cycleTimer = null;
  let bubbleEl = null;
  let textEl = null;
  let boundSocket = null;

  function renderCurrentMessage(animate = true) {
    if (!textEl) return;
    const currentMsg = messages.length > 0 ? messages[currentIndex % messages.length].text : "Welcome to the show! 💜";

    if (!animate) {
      textEl.textContent = currentMsg;
      textEl.classList.remove("fade-out", "fade-in");
      return;
    }

    textEl.classList.remove("fade-in");
    textEl.classList.add("fade-out");

    setTimeout(() => {
      if (!textEl) return;
      textEl.textContent = currentMsg;
      textEl.classList.remove("fade-out");
      textEl.classList.add("fade-in");
      setTimeout(() => {
        if (textEl) textEl.classList.remove("fade-in");
      }, 400);
    }, 200);
  }

  function advanceMessage() {
    if (messages.length <= 1) return;
    currentIndex = (currentIndex + 1) % messages.length;
    renderCurrentMessage(true);
  }

  function startCycleTimer() {
    if (cycleTimer) clearInterval(cycleTimer);
    if (messages.length > 1) {
      const intervalMs = Math.max(3000, (cycleSeconds || 8) * 1000);
      cycleTimer = setInterval(advanceMessage, intervalMs);
    }
  }

  function updateData(data) {
    if (!data) return;
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      messages = data.messages;
    }
    if (typeof data.cycleSeconds === "number" && data.cycleSeconds > 0) {
      cycleSeconds = data.cycleSeconds;
    }
    if (currentIndex >= messages.length) {
      currentIndex = 0;
    }
    renderCurrentMessage(false);
    startCycleTimer();
  }

  function attachSocket(s) {
    if (!s || s === boundSocket) return;
    boundSocket = s;

    boundSocket.on("speechMessagesUpdated", (data) => {
      updateData(data);
    });

    boundSocket.on("gameState", (data) => {
      if (data && data.speechMessages) {
        updateData(data.speechMessages);
      }
    });
  }

  async function fetchInitialMessages() {
    try {
      const res = await fetch("/api/speech-messages");
      if (res.ok) {
        const data = await res.json();
        if (data && data.messages) {
          updateData(data);
        }
      }
    } catch (e) {
      // Offline / fallback to initial defaults
    }
  }

  function init(options = {}) {
    bubbleEl = options.bubbleEl || document.getElementById("avatarSpeechBubble");
    textEl = options.textEl || document.getElementById("speechBubbleText");

    if (options.socket) {
      attachSocket(options.socket);
    } else if (typeof socket !== "undefined") {
      attachSocket(socket);
    } else if (window.socket) {
      attachSocket(window.socket);
    }

    fetchInitialMessages();
    renderCurrentMessage(false);
    startCycleTimer();

    return {
      updateData,
      attachSocket,
      next: advanceMessage
    };
  }

  window.initSpeechBubble = init;

  // Auto-init on page load if elements are present
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const b = document.getElementById("avatarSpeechBubble");
      if (b && !bubbleEl) {
        init();
      }
    });
  } else {
    const b = document.getElementById("avatarSpeechBubble");
    if (b && !bubbleEl) {
      init();
    }
  }
})();
