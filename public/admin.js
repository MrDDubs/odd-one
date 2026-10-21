// public/admin.js - Ally's Stream Hub — Settings & Studio Tools (ESM)
const socket = io("/admin");

// --------------------------------------------------------------------------
// DOM Elements
// --------------------------------------------------------------------------
const badgeTikTok = document.getElementById("badgeTikTok");
const textTikTok = document.getElementById("textTikTok");
const avatarTikTokMini = document.getElementById("avatarTikTokMini");
const dotTikTok = document.getElementById("dotTikTok");

const badgeTikfinity = document.getElementById("badgeTikfinity");
const textTikfinity = document.getElementById("textTikfinity");
const dotTikfinity = document.getElementById("dotTikfinity");
const badgeTikfinityCard = document.getElementById("badgeTikfinityCard");

const inputTikfinityUrl = document.getElementById("inputTikfinityUrl");
const btnConnectTikfinity = document.getElementById("btnConnectTikfinity");
const btnDisconnectTikfinity = document.getElementById("btnDisconnectTikfinity");

// Simulator
const simUser = document.getElementById("simUser");
const simGuess = document.getElementById("simGuess");
const btnSimulateGuess = document.getElementById("btnSimulateGuess");
const btnSimulateWin = document.getElementById("btnSimulateWin");
const btnSimulateRandom = document.getElementById("btnSimulateRandom");

// Deep Game Configuration
const selectLevel = document.getElementById("selectLevel");
const selectCategory = document.getElementById("selectCategory");
const btnApplySettings = document.getElementById("btnApplySettings");

// Toast
const toast = document.getElementById("toast");

let currentState = null;
let lastTikTokStatus = { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

let toastTimer = null;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// --------------------------------------------------------------------------
// TikFinity Status
// --------------------------------------------------------------------------
function updateTikStatus(connected) {
  if (connected) {
    if (dotTikfinity) dotTikfinity.style.background = "#10b981";
    if (textTikfinity) textTikfinity.textContent = "TikFinity Connected";
    if (badgeTikfinityCard) {
      badgeTikfinityCard.className = "tag tag-yellow";
      badgeTikfinityCard.textContent = "Connected";
    }
  } else {
    if (dotTikfinity) dotTikfinity.style.background = "#ef4444";
    if (textTikfinity) textTikfinity.textContent = "TikFinity Disconnected";
    if (badgeTikfinityCard) {
      badgeTikfinityCard.className = "tag tag-sky";
      badgeTikfinityCard.textContent = "Disconnected";
    }
  }
}

// --------------------------------------------------------------------------
// TikTok Status
// --------------------------------------------------------------------------
function updateTikTokStatus(status) {
  lastTikTokStatus = status || { connected: false, connecting: false, nickname: "", avatar: "", username: "" };

  if (lastTikTokStatus.connected) {
    if (dotTikTok) dotTikTok.style.background = "#10b981";
    const displayName = lastTikTokStatus.nickname || `@${lastTikTokStatus.username}` || "TikTok Live";
    if (textTikTok) textTikTok.textContent = `TikTok: ${displayName}`;

    if (avatarTikTokMini) {
      if (lastTikTokStatus.avatar) {
        avatarTikTokMini.style.display = "inline-flex";
        avatarTikTokMini.innerHTML = `<img src="${esc(lastTikTokStatus.avatar)}" style="width:16px;height:16px;border-radius:50%;margin-right:4px;vertical-align:middle" alt="${esc(displayName)}">`;
      } else {
        avatarTikTokMini.style.display = "none";
      }
    }
  } else if (lastTikTokStatus.connecting) {
    if (dotTikTok) dotTikTok.style.background = "#f59e0b";
    if (textTikTok) textTikTok.textContent = `Connecting @${lastTikTokStatus.username || ""}...`;
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";
  } else {
    if (dotTikTok) dotTikTok.style.background = "#ef4444";
    if (textTikTok) textTikTok.textContent = "TikTok Disconnected";
    if (avatarTikTokMini) avatarTikTokMini.style.display = "none";
  }
}

// --------------------------------------------------------------------------
// State Rendering
// --------------------------------------------------------------------------
function renderState(state) {
  if (!state) return;
  currentState = state;

  updateTikStatus(state.tikfinityConnected);

  updateTikTokStatus({
    connected: !!state.tiktokConnected,
    connecting: !!state.tiktokConnecting,
    nickname: state.tiktokLiveStreamerName || "",
    avatar: state.tiktokLiveStreamerAvatar || "",
    username: state.tiktokLiveUsername || ""
  });

  if (selectCategory && state.categoryOverride && document.activeElement !== selectCategory) {
    selectCategory.value = state.categoryOverride;
  }
  if (selectLevel && document.activeElement !== selectLevel) {
    selectLevel.value = state.autoLevel ? "auto" : String(state.manualLevel || state.level || "auto");
  }

  if (state.speechMessages) {
    applySpeechData(state.speechMessages);
  }
}

// --------------------------------------------------------------------------
// Socket Listeners
// --------------------------------------------------------------------------
socket.on("connect", () => {
  console.log("[Settings & Tools] Connected to server");
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

socket.on("winnerFound", (payload) => {
  const medal = payload.place === 1 ? "🥇 1st" : "🥈 2nd";
  showToast(`${medal} Winner: @${payload.winner?.nickname || payload.winner?.user} (+${payload.points} pts)!`);
});

socket.on("timeExpired", (payload) => {
  showToast(`⏰ Time's up! Target was: ${payload.target || ""}`);
});

// --------------------------------------------------------------------------
// Test Simulator Controls
// --------------------------------------------------------------------------
btnSimulateGuess?.addEventListener("click", () => {
  const user = simUser?.value?.trim() || "TestUser";
  const guess = (simGuess?.value || "").trim().toUpperCase();
  if (!guess) {
    alert("Please enter a coordinate or word to guess, e.g. B3");
    return;
  }
  socket.emit("simulateGuess", { username: user, nickname: user, message: guess });
  if (simGuess) simGuess.value = "";
  showToast(`Simulated guess: ${guess} by @${user}`);
});

btnSimulateWin?.addEventListener("click", () => {
  const secret = currentState?.secretTarget || currentState?.target || currentState?.secretAnswer || "B3";
  const user = simUser?.value?.trim() || "SpeedyWinner";
  socket.emit("simulateGuess", {
    username: user,
    nickname: user,
    message: secret
  });
  showToast(`🎯 Simulated Correct Win: ${secret} by @${user}`);
});

btnSimulateRandom?.addEventListener("click", () => {
  const COLS = ["A", "B", "C", "D", "E", "F"];
  const ROWS = [1, 2, 3, 4];
  const rand = COLS[Math.floor(Math.random() * COLS.length)] + ROWS[Math.floor(Math.random() * ROWS.length)];
  const user = simUser?.value?.trim() || "Viewer" + Math.floor(Math.random() * 100);
  socket.emit("simulateGuess", { username: user, nickname: user, message: rand });
  showToast(`🎲 Simulated random guess: ${rand} by @${user}`);
});

// --------------------------------------------------------------------------
// Odd One Out Category & Level Settings
// --------------------------------------------------------------------------
btnApplySettings?.addEventListener("click", () => {
  const cat = selectCategory?.value || "random";
  const lvlVal = selectLevel?.value || "auto";
  const opts = {};

  if (cat !== "random") opts.category = cat;
  if (lvlVal === "auto") {
    opts.autoLevel = true;
  } else {
    opts.autoLevel = false;
    opts.level = parseInt(lvlVal, 10);
  }

  socket.emit("setOptions", opts);
  showToast("⚙️ Game Settings Applied Successfully!");
});

// --------------------------------------------------------------------------
// TikFinity Connection Controls
// --------------------------------------------------------------------------
btnConnectTikfinity?.addEventListener("click", async () => {
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

btnDisconnectTikfinity?.addEventListener("click", async () => {
  showToast("Disconnecting TikFinity...");
  try {
    await fetch("/admin/disconnect-tikfinity", { method: "POST" });
  } catch {
    socket.emit("disconnectTikfinity");
  }
});

// --------------------------------------------------------------------------
// Avatar Speech Bubble Messages Manager
// --------------------------------------------------------------------------
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

function renderSpeechMessagesList() {
  if (!speechMessagesList) return;
  if (!speechData.messages || speechData.messages.length === 0) {
    speechMessagesList.innerHTML = `<div style="color:var(--fg-muted);font-size:11px;text-align:center;padding:12px">No custom speech messages yet.</div>`;
    return;
  }

  speechMessagesList.innerHTML = speechData.messages
    .map((msg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === speechData.messages.length - 1;
      const safeText = esc(msg.text || "");

      return `
        <div class="speech-msg-row" data-index="${idx}">
          <span style="font-size:10px;font-weight:800;color:var(--sunflower-yellow);width:18px;text-align:center;">#${idx + 1}</span>
          <span class="speech-msg-text">${safeText}</span>
          <div class="speech-msg-actions">
            <button class="speech-btn-mini btn-move-up" data-index="${idx}" ${isFirst ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Up">⬆️</button>
            <button class="speech-btn-mini btn-move-down" data-index="${idx}" ${isLast ? "disabled style='opacity:0.3;cursor:not-allowed'" : ""} title="Move Down">⬇️</button>
            <button class="speech-btn-mini btn-edit-msg" data-index="${idx}" title="Edit">✏️</button>
            <button class="speech-btn-mini delete btn-delete-msg" data-index="${idx}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach handlers
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
      if (confirm(`Delete message #${idx + 1}?`)) {
        speechData.messages.splice(idx, 1);
        saveAndBroadcastSpeech();
      }
    });
  });
}

function saveAndBroadcastSpeech() {
  renderSpeechMessagesList();
  fetch("/api/speech-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(speechData)
  })
    .then((res) => res.json())
    .then((resData) => {
      if (resData && resData.ok) {
        showToast("💬 Speech messages saved & synced!");
      }
    })
    .catch((e) => console.error("[Admin] Error saving speech messages:", e));
}

function applySpeechData(data) {
  if (!data) return;
  if (Array.isArray(data.messages)) {
    speechData.messages = data.messages;
    if (speechPreviewText && data.messages.length > 0) {
      speechPreviewText.textContent = data.messages[0].text;
    }
  }
  if (data.cycleSeconds) {
    speechData.cycleSeconds = data.cycleSeconds;
    if (inputSpeechCycleSeconds) {
      inputSpeechCycleSeconds.value = data.cycleSeconds;
    }
  }
  renderSpeechMessagesList();
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

fetch("/api/speech-messages")
  .then((res) => res.json())
  .then((data) => {
    if (data && data.messages) applySpeechData(data);
  })
  .catch((e) => console.warn("[Admin] Error fetching speech messages:", e));

// --------------------------------------------------------------------------
// Live Stream Banner & Slideshow Builder + TTS
// --------------------------------------------------------------------------
const slideshowBuilderList = document.getElementById("slideshowBuilderList");
const btnAddSlide = document.getElementById("btnAddSlide");
const btnSaveSlideshow = document.getElementById("btnSaveSlideshow");

let activeSlideshowData = {
  activeId: "default-banner",
  slideshows: [
    {
      id: "default-banner",
      name: "Live Stream Banner",
      width: 1080,
      height: 220,
      slides: []
    }
  ]
};

const TIKTOK_VOICES_OPTIONS = [
  { id: "en_us_001", name: "English US (Female 1)" },
  { id: "en_us_002", name: "English US (Female 2)" },
  { id: "en_us_006", name: "English US (Male 1)" },
  { id: "en_us_007", name: "English US (Male 2)" },
  { id: "en_us_009", name: "English US (Male 3)" },
  { id: "en_uk_001", name: "English UK (Male)" },
  { id: "en_au_001", name: "English AU (Female)" },
  { id: "en_male_narration", name: "Story Narrator" },
  { id: "en_male_funny", name: "Wacky / Funny" },
  { id: "en_female_emotional", name: "Peaceful / Warm" }
];

function getActiveSlideshow() {
  if (!activeSlideshowData.slideshows || activeSlideshowData.slideshows.length === 0) {
    activeSlideshowData.slideshows = [{ id: "default-banner", name: "Live Stream Banner", width: 1080, height: 220, slides: [] }];
  }
  let ss = activeSlideshowData.slideshows.find((s) => s.id === activeSlideshowData.activeId);
  if (!ss) ss = activeSlideshowData.slideshows[0];
  return ss;
}

function renderSlideshowBuilder() {
  if (!slideshowBuilderList) return;
  const ss = getActiveSlideshow();
  const slides = ss.slides || [];

  if (slides.length === 0) {
    slideshowBuilderList.innerHTML = `
      <div style="color:var(--fg-muted);text-align:center;padding:20px;background:var(--card-inner);border-radius:10px;border:1px dashed var(--border-card);">
        No banner slides yet. Click "Add New Slide" below to get started!
      </div>
    `;
    return;
  }

  slideshowBuilderList.innerHTML = slides.map((slide, idx) => {
    const isTtsEnabled = slide.ttsEnabled !== false;
    return `
      <div class="slide-builder-card" data-index="${idx}">
        <div class="slide-builder-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="slide-badge-num">Slide #${idx + 1}</span>
            <input type="text" class="slide-input-title" value="${esc(slide.title || `Slide ${idx + 1}`)}" placeholder="Slide Title" style="background:transparent;border:none;color:#fff;font-size:12px;font-weight:700;outline:none;" />
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn-test-tts btn-secondary" data-index="${idx}" style="font-size:10px;padding:3px 8px;" title="Test TTS Voice">
              🔊 Test TTS
            </button>
            <button type="button" class="btn-delete-slide btn-danger" data-index="${idx}" style="font-size:10px;padding:3px 8px;">
              🗑️
            </button>
          </div>
        </div>

        <div>
          <label style="font-size:10px;font-weight:700;color:var(--fg-muted);display:block;margin-bottom:3px;">BANNER TEXT (ON SCREEN)</label>
          <input type="text" class="slide-input-text input-field" value="${esc(slide.text || "")}" placeholder="e.g. Welcome to the show! Tap the screen & share! 💜" />
        </div>

        <div style="background:rgba(97, 136, 185, 0.08);border:1px solid var(--sky-blue-border);border-radius:8px;padding:8px 10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <label style="font-size:10px;font-weight:800;color:var(--sky-blue);">TIKTOK TTS VOICE SPEECH</label>
            <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;color:#cbd5e1;">
              <input type="checkbox" class="slide-check-tts" ${isTtsEnabled ? "checked" : ""} />
              <span>Speak Aloud</span>
            </label>
          </div>
          <input type="text" class="slide-input-tts-text input-field" value="${esc(slide.ttsText || slide.text || "")}" placeholder="What TikTok voice should say aloud when this slide shows..." style="margin-bottom:6px" />
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:10px;color:var(--fg-muted)">Voice:</span>
            <select class="slide-select-tts-voice select-field" style="padding:4px 8px;font-size:11px;">
              ${TIKTOK_VOICES_OPTIONS.map((v) => `<option value="${v.id}" ${slide.ttsVoice === v.id ? "selected" : ""}>${v.name}</option>`).join("")}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--fg-muted);display:block;margin-bottom:2px;">DURATION (SEC)</label>
            <input type="number" class="slide-input-duration input-field" min="3" max="180" value="${slide.duration || 10}" />
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--fg-muted);display:block;margin-bottom:2px;">BACKGROUND COLOR / CSS</label>
            <input type="text" class="slide-input-bg input-field" value="${esc(slide.bgValue || 'linear-gradient(135deg, #1e1548, #2e1065)')}" />
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Attach handlers
  slideshowBuilderList.querySelectorAll(".btn-delete-slide").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      pullCurrentFormInputs();
      ss.slides.splice(idx, 1);
      renderSlideshowBuilder();
    });
  });

  slideshowBuilderList.querySelectorAll(".btn-test-tts").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      pullCurrentFormInputs();
      const slide = ss.slides[idx];
      if (!slide) return;
      const text = (slide.ttsText || slide.text || "").trim();
      if (!text) {
        showToast("No TTS text entered to speak.");
        return;
      }
      showToast(`🔊 Generating speech for Slide #${idx + 1}...`);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: slide.ttsVoice || "en_us_001" })
        });
        const data = await res.json();
        if (data && data.ok && data.audio) {
          const snd = new Audio(`data:audio/mp3;base64,${data.audio}`);
          snd.play();
          showToast("🔊 Playing TikTok Voice!");
        } else {
          window.speechSynthesis?.cancel();
          window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
          showToast("🔊 Playing fallback browser speech.");
        }
      } catch (e) {
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
        showToast("🔊 Playing fallback browser speech.");
      }
    });
  });
}

function pullCurrentFormInputs() {
  const ss = getActiveSlideshow();
  const items = slideshowBuilderList.querySelectorAll(".slide-builder-card");
  items.forEach((item, idx) => {
    if (!ss.slides[idx]) return;
    const title = item.querySelector(".slide-input-title")?.value || `Slide ${idx + 1}`;
    const text = item.querySelector(".slide-input-text")?.value || "";
    const ttsText = item.querySelector(".slide-input-tts-text")?.value || "";
    const ttsVoice = item.querySelector(".slide-select-tts-voice")?.value || "en_us_001";
    const ttsEnabled = !!item.querySelector(".slide-check-tts")?.checked;
    const duration = parseInt(item.querySelector(".slide-input-duration")?.value, 10) || 10;
    const bgValue = item.querySelector(".slide-input-bg")?.value || "linear-gradient(135deg, #1e1548, #2e1065)";

    ss.slides[idx] = {
      ...ss.slides[idx],
      title,
      text,
      ttsText,
      ttsVoice,
      ttsEnabled,
      duration,
      bgValue
    };
  });
}

btnAddSlide?.addEventListener("click", () => {
  pullCurrentFormInputs();
  const ss = getActiveSlideshow();
  ss.slides.push({
    id: `slide-${Date.now()}`,
    title: `Slide ${ss.slides.length + 1}`,
    text: "Type your stream announcement or reward banner here! ✨",
    ttsText: "Welcome to Ally's stream! Type your guesses in chat!",
    ttsVoice: "en_us_001",
    ttsEnabled: true,
    duration: 10,
    bgValue: "linear-gradient(135deg, #151c28, #1e2838)"
  });
  renderSlideshowBuilder();
});

btnSaveSlideshow?.addEventListener("click", async () => {
  pullCurrentFormInputs();
  showToast("Saving and broadcasting banner...");
  try {
    const res = await fetch("/api/slideshows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeSlideshowData)
    });
    const data = await res.json();
    if (data && data.ok) {
      showToast("📺 Banner Saved & Broadcasted Live!");
    } else {
      alert("Failed to save slideshow: " + (data?.error || "Unknown error"));
    }
  } catch (err) {
    console.error("[Admin] Save slideshow error:", err);
    alert("Error saving slideshow.");
  }
});

fetch("/api/slideshows")
  .then((r) => r.json())
  .then((data) => {
    if (data && data.slideshows) {
      activeSlideshowData = data;
      renderSlideshowBuilder();
    }
  })
  .catch((err) => console.warn("[Admin] Error fetching slideshows:", err));

socket.on("slideshowUpdated", (data) => {
  if (data && data.slideshows) {
    activeSlideshowData = data;
    renderSlideshowBuilder();
  }
});

// --------------------------------------------------------------------------
// Copy Links Directory Handlers
// --------------------------------------------------------------------------
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-copy");
    const codeEl = document.getElementById(targetId);
    if (codeEl) {
      const url = codeEl.textContent.trim();
      navigator.clipboard.writeText(url).then(() => {
        showToast("📋 Copied URL to clipboard!");
      }).catch(() => {
        showToast(`URL: ${url}`);
      });
    }
  });
});
