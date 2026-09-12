// public/game.js
const C = ["A", "B", "C", "D", "E", "F"];
const R = [1, 2, 3, 4];
const LEVELS = [
  { name: "EASY", sec: 20 },
  { name: "MEDIUM", sec: 18 },
  { name: "HARD", sec: 16 },
  { name: "EXPERT", sec: 14 },
  { name: "CHAOS", sec: 12 }
];

let target = "A1";
let round = 1;
let level = 1;
let category = "fruit";
let streak = 0;
let time = 20;
let active = true;
let revealed = false;
let roundWinners = [];
let isServerConnected = false;

let modalTimer = null;
let localTimerInterval = null;
let lastRenderedRound = -1;
let lastRenderedTarget = "";
let lastRenderedCategory = "";
let lastRenderedLevel = -1;
let pillHideTimeout = null;

// DOM Elements
const elRound = document.getElementById("round");
const elTimer = document.getElementById("timer");
const elLevel = document.getElementById("level");
const elCategory = document.getElementById("category");
const elStreak = document.getElementById("streak");
const elStreakValue = document.getElementById("streakValue");
const elWinnerBox = document.getElementById("winnerBox");
const elStatus = document.getElementById("status");
const elLiveGuessPill = document.getElementById("liveGuessPill");
const elLeaderboardPodium = document.getElementById("leaderboardPodium");

const elModal = document.getElementById("leaderboardModal");
const elModalPodium = document.getElementById("modalPodium");
const elModalTopList = document.getElementById("modalTopList");
const elModalProgressBar = document.getElementById("modalProgressBar");

const btnStart = document.getElementById("btnStart");
const btnReveal = document.getElementById("btnReveal");
const btnNext = document.getElementById("btnNext");

// Web Audio API Sound Synthesizer
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (type === "timeout") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.4);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "tick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {}
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function svgWrap(content) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function iconSVG(t, odd, lvl) {
  const subtle = lvl >= 4;

  // 1. Fruit (Strawberry)
  if (t === "fruit") {
    const fill = odd ? (lvl === 1 ? "#8ed36f" : "#ff7d8b") : "#ff7d8b";
    const leaf = odd && lvl >= 2 ? "#b685d9" : "#72b95e";
    const dot = odd && lvl >= 3 ? `<circle cx="63" cy="48" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
    return svgWrap(`<path d="M50 24 C70 18 83 34 80 56 C77 78 63 88 50 88 C37 88 23 78 20 56 C17 34 30 18 50 24Z" fill="${fill}" stroke="#583d6f" stroke-width="4"/><path d="M49 26 C50 14 61 11 70 16 C62 18 56 22 51 30Z" fill="${leaf}" stroke="#583d6f" stroke-width="3"/>${dot}`);
  }

  // 2. Bear
  if (t === "bear") {
    const ear = odd && lvl === 1 ? "#e49ac3" : "#c99b74";
    const eye = odd && lvl >= 2 ? 1 : 2;
    const mark = odd && lvl >= 3 ? `<circle cx="67" cy="58" r="${subtle ? 2 : 4}" fill="#f6b7c8"/>` : "";
    return svgWrap(`<circle cx="30" cy="28" r="13" fill="${ear}" stroke="#5b416b" stroke-width="4"/><circle cx="70" cy="28" r="13" fill="${ear}" stroke="#5b416b" stroke-width="4"/><circle cx="50" cy="55" r="31" fill="#c99b74" stroke="#5b416b" stroke-width="4"/><circle cx="39" cy="52" r="${eye}" fill="#35243f"/><circle cx="61" cy="52" r="2" fill="#35243f"/><ellipse cx="50" cy="65" rx="11" ry="8" fill="#f2d7c4"/><circle cx="50" cy="62" r="3.5" fill="#35243f"/>${mark}`);
  }

  // 3. Cloud
  if (t === "cloud") {
    const fill = odd && lvl === 1 ? "#caa9ff" : "#ffffff";
    const drop = odd && lvl >= 2 ? `<circle cx="${subtle ? 70 : 74}" cy="78" r="${subtle ? 2.5 : 5}" fill="#7bc6ff"/>` : "";
    const eye2 = odd && lvl >= 3 ? 0 : 3;
    return svgWrap(`<path d="M24 68 C10 68 10 47 25 45 C26 28 47 22 57 35 C70 27 86 39 82 53 C94 57 89 69 78 69Z" fill="${fill}" stroke="#66538c" stroke-width="4"/><circle cx="42" cy="55" r="3" fill="#4e3d66"/><circle cx="60" cy="55" r="${eye2}" fill="#4e3d66"/>${drop}`);
  }

  // 4. Flower
  if (t === "flower") {
    const petal = odd && lvl === 1 ? "#ffce6e" : "#f1a6d8";
    const center = odd && lvl >= 2 ? "#95d36e" : "#ffd56a";
    const missing = odd && lvl >= 3;
    let petals = "";
    [[50, 20], [72, 32], [78, 56], [61, 75], [36, 75], [22, 56], [28, 32]].forEach((p, i) => {
      if (!(missing && i === 0)) petals += `<circle cx="${p[0]}" cy="${p[1]}" r="${subtle ? 13 : 14}" fill="${petal}" stroke="#6b4d7c" stroke-width="3"/>`;
    });
    return svgWrap(`${petals}<circle cx="50" cy="50" r="17" fill="${center}" stroke="#6b4d7c" stroke-width="3"/>`);
  }

  // 5. Boba
  if (t === "boba") {
    const drink = odd && lvl === 1 ? "#f5a1ba" : "#e9ad5e";
    const straw = odd && lvl >= 2 ? "#ff7697" : "#7657d1";
    const pearls = odd && lvl >= 3 ? 7 : 8;
    let ps = "";
    for (let i = 0; i < pearls; i++) {
      let x = 30 + (i % 4) * 13, y = 69 + Math.floor(i / 4) * 10;
      ps += `<circle cx="${x}" cy="${y}" r="${subtle ? 3.2 : 4}" fill="#4d2d22"/>`;
    }
    return svgWrap(`<path d="M28 30 H72 L68 88 H32Z" fill="${drink}" stroke="#583d6f" stroke-width="4"/><rect x="51" y="9" width="9" height="30" rx="3" fill="${straw}" stroke="#583d6f" stroke-width="3" transform="rotate(7 55 24)"/><ellipse cx="50" cy="30" rx="24" ry="7" fill="#f8ead7" stroke="#583d6f" stroke-width="4"/>${ps}`);
  }

  // 6. Cupcake
  if (t === "cupcake") {
    const frosting = odd && lvl === 1 ? "#b9a3ff" : "#f6a6ce";
    const cherry = odd && lvl >= 2 ? "#7acb75" : "#ff667a";
    const sprinkle = odd && lvl >= 3 ? `<rect x="${subtle ? 63 : 68}" y="38" width="3" height="8" rx="1" fill="#fff"/>` : "";
    return svgWrap(`<path d="M29 52 H71 L65 87 H35Z" fill="#d69d63" stroke="#604468" stroke-width="4"/><path d="M30 55 C22 47 27 36 38 36 C38 24 52 19 59 29 C70 25 79 35 75 46 C84 50 78 59 68 57Z" fill="${frosting}" stroke="#604468" stroke-width="4"/><circle cx="55" cy="23" r="7" fill="${cherry}" stroke="#604468" stroke-width="3"/>${sprinkle}`);
  }

  // 7. Controller
  if (t === "controller") {
    const body = odd && lvl === 1 ? "#9dd7ff" : "#b9a4ff";
    const btn = odd && lvl >= 2 ? "#ff9cb7" : "#6650a6";
    const tiny = odd && lvl >= 3 ? `<circle cx="${subtle ? 75 : 78}" cy="58" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
    return svgWrap(`<path d="M26 38 C18 42 17 66 25 73 C32 80 39 69 44 64 H56 C61 69 68 80 75 73 C83 66 82 42 74 38 C66 34 58 38 54 42 H46 C42 38 34 34 26 38Z" fill="${body}" stroke="#55406f" stroke-width="4"/><rect x="31" y="49" width="17" height="5" rx="2" fill="#55406f"/><rect x="37" y="43" width="5" height="17" rx="2" fill="#55406f"/><circle cx="65" cy="49" r="4" fill="${btn}"/><circle cx="72" cy="57" r="4" fill="${btn}"/>${tiny}`);
  }

  // 8. Star
  if (t === "star") {
    const fill = odd && lvl === 1 ? "#9cd8ff" : "#ffd96e";
    const point = odd && lvl >= 2
      ? "50,13 60,40 89,40 66,57 75,85 50,68 25,85 34,57 11,40 40,40"
      : "50,10 61,38 91,38 67,56 76,87 50,69 24,87 33,56 9,38 39,38";
    const mark = odd && lvl >= 3 ? `<circle cx="${subtle ? 66 : 71}" cy="54" r="${subtle ? 2 : 4}" fill="#fff"/>` : "";
    return svgWrap(`<polygon points="${point}" fill="${fill}" stroke="#634c7a" stroke-width="4" stroke-linejoin="round"/>${mark}`);
  }

  // 9. Pizza
  if (t === "pizza") {
    const cheese = odd && lvl === 1 ? "#fed7aa" : "#fef08a";
    const pepColor = odd && lvl >= 2 ? "#22c55e" : "#ef4444";
    const count = odd && lvl >= 3 ? 2 : 3;
    let peps = `<circle cx="48" cy="46" r="6" fill="${pepColor}" stroke="#583d6f" stroke-width="2"/>`;
    if (count >= 2) peps += `<circle cx="38" cy="62" r="5.5" fill="${pepColor}" stroke="#583d6f" stroke-width="2"/>`;
    if (count >= 3) peps += `<circle cx="60" cy="58" r="${subtle ? 4 : 5.5}" fill="${pepColor}" stroke="#583d6f" stroke-width="2"/>`;
    return svgWrap(`<path d="M50 14 L84 76 C74 84 26 84 16 76 Z" fill="${cheese}" stroke="#583d6f" stroke-width="4"/><path d="M16 76 C26 84 74 84 84 76" fill="none" stroke="#d97706" stroke-width="8" stroke-linecap="round"/>${peps}`);
  }

  // 10. Donut
  if (t === "donut") {
    const icing = odd && lvl === 1 ? "#78350f" : "#f472b6";
    const spr1 = odd && lvl >= 2 ? "#22c55e" : "#38bdf8";
    const extraSpr = odd && lvl >= 3 ? "" : `<rect x="${subtle ? 62 : 64}" y="36" width="3" height="7" rx="1.5" fill="#facc15" transform="rotate(35 64 39)"/>`;
    return svgWrap(`<circle cx="50" cy="50" r="34" fill="#fcd34d" stroke="#583d6f" stroke-width="4"/><circle cx="50" cy="50" r="30" fill="${icing}" stroke="#583d6f" stroke-width="3"/><circle cx="50" cy="50" r="13" fill="#f4eeff" stroke="#583d6f" stroke-width="3.5"/><rect x="34" y="30" width="3" height="7" rx="1.5" fill="${spr1}" transform="rotate(-25 35 33)"/><rect x="36" y="60" width="3" height="7" rx="1.5" fill="#a855f7" transform="rotate(40 37 63)"/><rect x="58" y="62" width="3" height="7" rx="1.5" fill="#ef4444" transform="rotate(-30 59 65)"/>${extraSpr}`);
  }

  // 11. Cat
  if (t === "cat") {
    const faceColor = odd && lvl === 1 ? "#d8b4fe" : "#fed7aa";
    const eyeR = odd && lvl >= 2 ? `<path d="M60 52 Q64 47 68 52" stroke="#352044" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<circle cx="64" cy="52" r="3" fill="#352044"/>`;
    const whiskerCount = odd && lvl >= 3 ? 2 : 3;
    let wh = `<line x1="20" y1="52" x2="35" y2="54" stroke="#583d6f" stroke-width="2.5"/><line x1="20" y1="59" x2="35" y2="58" stroke="#583d6f" stroke-width="2.5"/>`;
    if (whiskerCount === 3) wh += `<line x1="22" y1="46" x2="35" y2="50" stroke="#583d6f" stroke-width="${subtle ? 1.5 : 2.5}"/>`;
    return svgWrap(`<polygon points="26,42 20,20 42,28" fill="#f472b6" stroke="#583d6f" stroke-width="3.5"/><polygon points="74,42 80,20 58,28" fill="#f472b6" stroke="#583d6f" stroke-width="3.5"/><circle cx="50" cy="54" r="28" fill="${faceColor}" stroke="#583d6f" stroke-width="4"/><circle cx="36" cy="52" r="3" fill="#352044"/>${eyeR}<polygon points="50,57 46,61 54,61" fill="#f43f5e"/><line x1="80" y1="52" x2="65" y2="54" stroke="#583d6f" stroke-width="2.5"/><line x1="80" y1="59" x2="65" y2="58" stroke="#583d6f" stroke-width="2.5"/>${wh}`);
  }

  // 12. Diamond
  if (t === "diamond") {
    const gem = odd && lvl === 1 ? "#f43f5e" : "#38bdf8";
    const facet = odd && lvl >= 2 ? "#a855f7" : "#bae6fd";
    const sparkle = odd && lvl >= 3 ? "" : `<polygon points="78,16 80,22 86,24 80,26 78,32 76,26 70,24 76,22" fill="#fef08a"/>`;
    return svgWrap(`<polygon points="50,86 16,38 30,18 70,18 84,38" fill="${gem}" stroke="#4c1d95" stroke-width="4" stroke-linejoin="round"/><polygon points="50,86 36,38 30,18 50,38 70,18 64,38" fill="${facet}" opacity="0.6" stroke="#4c1d95" stroke-width="2"/><line x1="16" y1="38" x2="84" y2="38" stroke="#4c1d95" stroke-width="3"/>${sparkle}`);
  }

  // 13. Coffee
  if (t === "coffee") {
    const mug = odd && lvl === 1 ? "#4ade80" : "#a78bfa";
    const art = odd && lvl >= 2 ? `<polygon points="50,44 52,48 57,48 53,51 55,55 50,52 45,55 47,51 43,48 48,48" fill="#fff"/>` : `<path d="M50 46 C47 43 43 45 45 49 L50 53 L55 49 C57 45 53 43 50 46Z" fill="#fff"/>`;
    const steam3 = odd && lvl >= 3 ? "" : `<path d="M60 26 Q63 20 60 14" stroke="#c4b5fd" stroke-width="${subtle ? 2 : 3}" fill="none" stroke-linecap="round"/>`;
    return svgWrap(`<path d="M65 44 H76 C81 44 81 60 76 60 H63" fill="none" stroke="#583d6f" stroke-width="4.5"/><rect x="24" y="34" width="44" height="42" rx="10" fill="${mug}" stroke="#583d6f" stroke-width="4"/><ellipse cx="46" cy="36" rx="20" ry="6" fill="#78350f" stroke="#583d6f" stroke-width="2.5"/><path d="M38 26 Q41 20 38 14" stroke="#c4b5fd" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M49 24 Q52 18 49 12" stroke="#c4b5fd" stroke-width="3" fill="none" stroke-linecap="round"/>${steam3}${art}`);
  }

  // 14. Ice Cream
  if (t === "icecream") {
    const topScoop = odd && lvl === 1 ? "#60a5fa" : "#f472b6";
    const cherry = odd && lvl >= 2 ? `<circle cx="50" cy="18" r="5" fill="#facc15" stroke="#583d6f" stroke-width="2"/>` : `<circle cx="50" cy="18" r="6" fill="#ef4444" stroke="#583d6f" stroke-width="2"/><path d="M52 14 Q58 8 62 10" stroke="#583d6f" stroke-width="2.5" fill="none"/>`;
    const drip = odd && lvl >= 3 ? `<path d="M36 48 Q37 57 40 56 Q42 48 42 48" fill="#a7f3d0"/>` : "";
    return svgWrap(`<polygon points="30,52 70,52 50,88" fill="#fcd34d" stroke="#583d6f" stroke-width="4"/><path d="M30 52 H70" stroke="#b45309" stroke-width="3"/><circle cx="50" cy="46" r="18" fill="#a7f3d0" stroke="#583d6f" stroke-width="3"/><circle cx="50" cy="30" r="15" fill="${topScoop}" stroke="#583d6f" stroke-width="3"/>${drip}${cherry}`);
  }

  // 15. Avocado
  if (t === "avocado") {
    const flesh = odd && lvl === 1 ? "#fef08a" : "#bbf7d0";
    const pitSize = odd && lvl >= 2 ? (subtle ? 11 : 9) : 13;
    const sprout = odd && lvl >= 3 ? `<path d="M50 18 Q54 12 60 14" stroke="#15803d" stroke-width="3" fill="none" stroke-linecap="round"/>` : "";
    return svgWrap(`<path d="M50 18 C36 18 26 30 26 48 C26 68 36 82 50 82 C64 82 74 68 74 48 C74 30 64 18 50 18Z" fill="${flesh}" stroke="#14532d" stroke-width="6"/>${sprout}<circle cx="50" cy="56" r="${pitSize}" fill="#78350f" stroke="#451a03" stroke-width="3"/><circle cx="46" cy="52" r="3" fill="#fed7aa" opacity="0.8"/>`);
  }

  // 16. Cookie
  if (t === "cookie") {
    const dough = odd && lvl === 1 ? "#fca5a5" : "#fcd34d";
    const chipCount = odd && lvl >= 2 ? 4 : 5;
    const bite = odd && lvl >= 3 ? `<path d="M68 24 Q60 30 68 38 Q78 30 68 24Z" fill="#f4eeff"/>` : "";
    let chips = `<circle cx="40" cy="38" r="4" fill="#451a03"/><circle cx="58" cy="40" r="4" fill="#451a03"/><circle cx="36" cy="58" r="3.5" fill="#451a03"/><circle cx="54" cy="62" r="4" fill="#451a03"/>`;
    if (chipCount === 5) chips += `<circle cx="48" cy="50" r="${subtle ? 3 : 4.5}" fill="#451a03"/>`;
    return svgWrap(`<circle cx="50" cy="50" r="32" fill="${dough}" stroke="#78350f" stroke-width="4"/>${chips}${bite}`);
  }

  // 17. Ghost
  if (t === "ghost") {
    const ghostColor = odd && lvl === 1 ? "#c4b5fd" : "#ffffff";
    const eyeRight = odd && lvl >= 2 ? `<path d="M56 42 Q60 38 64 42" stroke="#352044" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<circle cx="60" cy="42" r="3.5" fill="#352044"/>`;
    const arm = odd && lvl >= 3 ? `<path d="M72 52 Q82 46 80 40" stroke="#583d6f" stroke-width="3.5" fill="none" stroke-linecap="round"/>` : "";
    return svgWrap(`<path d="M50 18 C32 18 26 32 26 50 C26 72 26 78 32 78 C38 78 40 72 44 72 C48 72 50 78 56 78 C62 78 64 72 68 72 C72 72 74 78 80 78 C80 50 74 18 50 18Z" fill="${ghostColor}" stroke="#583d6f" stroke-width="4"/><circle cx="40" cy="42" r="3.5" fill="#352044"/>${eyeRight}<ellipse cx="50" cy="50" rx="3.5" ry="5" fill="#352044"/><circle cx="34" cy="48" r="3" fill="#f472b6" opacity="0.6"/><circle cx="66" cy="48" r="3" fill="#f472b6" opacity="0.6"/>${arm}`);
  }

  // 18. Crown
  if (t === "crown") {
    const crownColor = odd && lvl === 1 ? "#cbd5e1" : "#facc15";
    const jewelColor = odd && lvl >= 2 ? "#3b82f6" : "#ef4444";
    const centerPeak = odd && lvl >= 3 ? "50,18" : "50,24";
    return svgWrap(`<polygon points="20,68 80,68 82,34 66,48 ${centerPeak} 34,48 18,34" fill="${crownColor}" stroke="#583d6f" stroke-width="4" stroke-linejoin="round"/><rect x="20" y="68" width="60" height="8" rx="2" fill="#ca8a04" stroke="#583d6f" stroke-width="3"/><circle cx="50" cy="54" r="${subtle ? 4 : 5.5}" fill="${jewelColor}" stroke="#583d6f" stroke-width="2"/><circle cx="32" cy="56" r="3.5" fill="#10b981"/><circle cx="68" cy="56" r="3.5" fill="#10b981"/>`);
  }

  // 19. Planet
  if (t === "planet") {
    const pColor = odd && lvl === 1 ? "#fb923c" : "#818cf8";
    const moon = odd && lvl >= 2 ? `<circle cx="${subtle ? 78 : 82}" cy="22" r="5" fill="#fef08a" stroke="#583d6f" stroke-width="2"/>` : "";
    const craters = odd && lvl >= 3 ? `<circle cx="42" cy="42" r="4" fill="#6366f1" opacity="0.6"/><circle cx="56" cy="56" r="5" fill="#6366f1" opacity="0.6"/>` : "";
    return svgWrap(`<ellipse cx="50" cy="52" rx="42" ry="12" fill="none" stroke="#f472b6" stroke-width="5" transform="rotate(-20 50 52)"/><circle cx="50" cy="50" r="26" fill="${pColor}" stroke="#583d6f" stroke-width="4"/>${craters}<path d="M12 42 C18 36 34 38 46 44" fill="none" stroke="#f472b6" stroke-width="5" stroke-linecap="round" transform="rotate(-20 50 52)"/>${moon}`);
  }

  // 20. Balloon
  if (t === "balloon") {
    const bColor = odd && lvl === 1 ? "#38bdf8" : "#f43f5e";
    const stringCurl = odd && lvl >= 2 ? "M50 72 Q42 78 54 84 Q44 90 50 94" : "M50 72 Q44 80 52 88";
    const shineSize = odd && lvl >= 3 ? (subtle ? 2 : 1) : 4;
    return svgWrap(`<path d="M50 72 L47 76 H53 Z" fill="${bColor}" stroke="#583d6f" stroke-width="3"/><path d="${stringCurl}" stroke="#64748b" stroke-width="2.5" fill="none"/><ellipse cx="50" cy="44" rx="26" ry="30" fill="${bColor}" stroke="#583d6f" stroke-width="4"/><ellipse cx="40" cy="32" rx="${shineSize * 1.5}" ry="${shineSize * 2.5}" fill="#ffffff" opacity="0.65" transform="rotate(-25 40 32)"/>`);
  }

  // 21. Butterfly
  if (t === "butterfly") {
    const wingColor = odd && lvl === 1 ? "#f59e0b" : "#c084fc";
    const spotRight = odd && lvl >= 2 ? (subtle ? `<circle cx="68" cy="38" r="3" fill="#fef08a"/>` : "") : `<circle cx="68" cy="38" r="5" fill="#fef08a" stroke="#583d6f" stroke-width="1.5"/>`;
    const antenna = odd && lvl >= 3 ? `<path d="M48 28 Q42 16 38 18" stroke="#583d6f" stroke-width="2.5" fill="none"/><path d="M52 28 Q58 16 62 18" stroke="#583d6f" stroke-width="2.5" fill="none"/>` : `<line x1="48" y1="28" x2="42" y2="18" stroke="#583d6f" stroke-width="2.5"/><line x1="52" y1="28" x2="58" y2="18" stroke="#583d6f" stroke-width="2.5"/>`;
    return svgWrap(`<ellipse cx="32" cy="40" rx="18" ry="16" fill="${wingColor}" stroke="#583d6f" stroke-width="3.5"/><ellipse cx="68" cy="40" rx="18" ry="16" fill="${wingColor}" stroke="#583d6f" stroke-width="3.5"/><ellipse cx="36" cy="62" rx="12" ry="12" fill="${wingColor}" stroke="#583d6f" stroke-width="3"/><ellipse cx="64" cy="62" rx="12" ry="12" fill="${wingColor}" stroke="#583d6f" stroke-width="3"/><circle cx="32" cy="38" r="5" fill="#fef08a" stroke="#583d6f" stroke-width="1.5"/>${spotRight}<ellipse cx="50" cy="50" rx="5" ry="24" fill="#352044"/>${antenna}`);
  }

  // 22. Mushroom
  if (t === "mushroom") {
    const capColor = odd && lvl === 1 ? "#818cf8" : "#ef4444";
    const dotCount = odd && lvl >= 2 ? 3 : 4;
    const tilt = odd && lvl >= 3 ? "rotate(8 50 50)" : "";
    let dots = `<circle cx="36" cy="38" r="5" fill="#fff"/><circle cx="64" cy="38" r="5" fill="#fff"/><circle cx="50" cy="26" r="6" fill="#fff"/>`;
    if (dotCount === 4) dots += `<circle cx="50" cy="44" r="${subtle ? 3 : 4.5}" fill="#fff"/>`;
    return svgWrap(`<g transform="${tilt}"><path d="M38 48 C38 48 36 78 40 82 C44 86 56 86 60 82 C64 78 62 48 62 48Z" fill="#fef3c7" stroke="#583d6f" stroke-width="4"/><path d="M16 48 C16 24 30 14 50 14 C70 14 84 24 84 48 Z" fill="${capColor}" stroke="#583d6f" stroke-width="4"/>${dots}</g>`);
  }

  // 23. Camera
  if (t === "camera") {
    const bodyColor = odd && lvl === 1 ? "#2dd4bf" : "#f472b6";
    const flashLines = odd && lvl >= 2 ? `<line x1="72" y1="20" x2="76" y2="14" stroke="#facc15" stroke-width="2.5"/><line x1="66" y1="18" x2="66" y2="12" stroke="#facc15" stroke-width="2.5"/>` : "";
    const lensDot = odd && lvl >= 3 ? "" : `<circle cx="44" cy="50" r="${subtle ? 2 : 4}" fill="#ffffff" opacity="0.8"/>`;
    return svgWrap(`<rect x="18" y="32" width="64" height="46" rx="10" fill="${bodyColor}" stroke="#583d6f" stroke-width="4"/><rect x="28" y="22" width="18" height="10" rx="3" fill="#cbd5e1" stroke="#583d6f" stroke-width="3"/><circle cx="50" cy="55" r="17" fill="#334155" stroke="#583d6f" stroke-width="3.5"/><circle cx="50" cy="55" r="12" fill="#1e293b"/>${lensDot}<circle cx="68" cy="40" r="4" fill="#fef08a" stroke="#583d6f" stroke-width="2"/>${flashLines}`);
  }

  // 24. Heart
  if (t === "heart") {
    const hColor = odd && lvl === 1 ? "#a855f7" : "#ef4444";
    const arrow = odd && lvl >= 2 ? `<line x1="16" y1="74" x2="84" y2="26" stroke="#facc15" stroke-width="3.5" stroke-linecap="round"/><polygon points="84,26 74,28 80,34" fill="#facc15"/>` : "";
    const shine = odd && lvl >= 3 ? "" : `<ellipse cx="36" cy="36" rx="${subtle ? 2 : 4}" ry="${subtle ? 4 : 7}" fill="#fff" opacity="0.65" transform="rotate(-30 36 36)"/>`;
    return svgWrap(`<path d="M50 78 C30 62 18 48 18 34 C18 22 28 16 38 18 C44 20 48 24 50 28 C52 24 56 20 62 18 C72 16 82 22 82 34 C82 48 70 62 50 78Z" fill="${hColor}" stroke="#583d6f" stroke-width="4"/>${shine}${arrow}`);
  }

  // Fallback (Star)
  return svgWrap(`<polygon points="50,10 61,38 91,38 67,56 76,87 50,69 24,87 33,56 9,38 39,38" fill="#ffd96e" stroke="#634c7a" stroke-width="4" stroke-linejoin="round"/>`);
}

function drawGrid(activeTarget, curCategory, curLevel) {
  const g = document.getElementById("grid");
  if (!g) return;
  g.innerHTML = "";
  R.forEach(r => {
    C.forEach(c => {
      const code = c + r;
      const b = document.createElement("button");
      b.className = "cell";
      b.dataset.code = code;
      const isOdd = code === activeTarget;
      b.innerHTML = iconSVG(curCategory, isOdd, curLevel);
      b.onclick = () => onCellClick(code);
      g.appendChild(b);
    });
  });
}

function highlightTarget(code) {
  document.querySelectorAll(".cell").forEach(cell => {
    if (cell.dataset.code === code) {
      cell.classList.add("correct");
    }
  });
}

function clearAllHighlights() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("correct");
  });
}

function flashCellGuess(code) {
  const cell = document.querySelector(`.cell[data-code="${code}"]`);
  if (cell) {
    cell.classList.remove("flash-guess");
    void cell.offsetWidth;
    cell.classList.add("flash-guess");
  }
}

function showLiveGuessPill(username, code, isCorrect) {
  if (!elLiveGuessPill) return;
  clearTimeout(pillHideTimeout);

  if (isCorrect) {
    elLiveGuessPill.className = "guess-pill correct";
    elLiveGuessPill.innerHTML = `🎉 <strong>@${esc(username)}</strong> guessed <strong>${code}</strong> ✓ Correct!`;
  } else {
    elLiveGuessPill.className = "guess-pill";
    elLiveGuessPill.innerHTML = `💬 <strong>@${esc(username)}</strong> guessed <span style="color:#e64980">${code}</span>`;
  }

  elLiveGuessPill.style.display = "inline-flex";
  pillHideTimeout = setTimeout(() => {
    elLiveGuessPill.style.display = "none";
  }, 3500);
}

function onCellClick(code) {
  if (socket && socket.connected) {
    socket.emit("manualGuess", code);
  } else {
    handleLocalGuess("Host", code);
  }
}

function renderAvatarHTML(avatarUrl, nickname) {
  const initial = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return `<img src="${esc(avatarUrl)}" class="avatar-img" alt="${esc(nickname)}" onerror="this.outerHTML='<div class=\\'avatar-letter\\'>${initial}</div>'">`;
  }
  return `<div class="avatar-letter">${initial}</div>`;
}

function renderWinnersBox(winners) {
  if (!elWinnerBox) return;
  if (!winners || winners.length === 0) {
    elWinnerBox.innerHTML = `<span style="font-size:1.05vh;color:#6c4ca6">First 2 to comment the odd box win points!</span>`;
    return;
  }

  elWinnerBox.innerHTML = winners.map(w => {
    const medal = w.place === 1 ? "🥇" : "🥈";
    const pts = w.points === 1 ? "+1pt" : `+${w.points}pts`;
    const avatar = w.avatar
      ? `<img src="${esc(w.avatar)}" class="avatar-mini" onerror="this.style.display='none'">`
      : "";
    return `
      <div class="winner-pill">
        ${medal} ${avatar} <span>@${esc(w.nickname)} (${w.code})</span> <strong style="color:#723eb5">${pts}</strong>
      </div>
    `;
  }).join("");
}

function showLeaderboardPopup(data) {
  const winners = data.roundWinners || [];
  const topList = data.leaderboard || [];

  let podiumHTML = "";
  if (winners.length > 0) {
    const first = winners[0];
    podiumHTML += `
      <div class="podium-card first">
        <div class="podium-rank">🥇 1st Place</div>
        <div class="avatar-wrap">${renderAvatarHTML(first.avatar, first.nickname)}</div>
        <div class="podium-name">@${esc(first.nickname)}</div>
        <div class="podium-pts">+${first.points} Points</div>
      </div>
    `;
  } else {
    podiumHTML += `
      <div class="podium-card">
        <div class="podium-rank">⏰ No Winners</div>
        <div style="font-size:1.1vh;color:#c8b9ff;margin:8px 0">Time expired!</div>
      </div>
    `;
  }

  if (winners.length > 1) {
    const second = winners[1];
    podiumHTML += `
      <div class="podium-card second">
        <div class="podium-rank">🥈 2nd Place</div>
        <div class="avatar-wrap">${renderAvatarHTML(second.avatar, second.nickname)}</div>
        <div class="podium-name">@${esc(second.nickname)}</div>
        <div class="podium-pts">+${second.points} Point</div>
      </div>
    `;
  }

  elModalPodium.innerHTML = podiumHTML;

  if (topList.length === 0) {
    elModalTopList.innerHTML = `<div style="text-align:center;font-size:1.1vh;color:#bda8ef">No scores yet. Be the first to win!</div>`;
  } else {
    elModalTopList.innerHTML = topList.slice(0, 4).map((p, idx) => `
      <div class="top-row">
        <div class="top-user-wrap">
          <span>#${idx + 1}</span>
          ${renderAvatarHTML(p.avatar, p.nickname)}
          <span>@${esc(p.nickname || p.user)}</span>
        </div>
        <div class="top-score">${p.score} pts 🏆</div>
      </div>
    `).join("");
  }

  elModalProgressBar.style.transition = "none";
  elModalProgressBar.style.width = "100%";
  void elModalProgressBar.offsetWidth;
  elModalProgressBar.style.transition = "width 4s linear";
  elModalProgressBar.style.width = "0%";

  elModal.classList.add("active");

  if (modalTimer) clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    elModal.classList.remove("active");
  }, 4000);
}

function renderLeaderboard(leaderboard) {
  if (!elLeaderboardPodium) return;

  const list = Array.isArray(leaderboard) ? leaderboard.slice(0, 5) : [];
  const rankIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"];

  let html = "";
  for (let i = 0; i < 5; i++) {
    const p = list[i];
    const rankClass = rankClasses[i] || "";
    if (p) {
      const avatarHtml = p.avatar
        ? `<div style="position:relative;width:20px;height:20px;margin:0 auto 1px">
            <img src="${esc(p.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:1.5px solid #c4b5fd" onerror="this.outerHTML='<span class=\\'podium-rank-icon\\'>${rankIcons[i]}</span>'">
            <span style="position:absolute;bottom:-4px;right:-4px;font-size:9px;line-height:1">${rankIcons[i]}</span>
          </div>`
        : `<div class="podium-rank-icon">${rankIcons[i]}</div>`;

      html += `
        <div class="podium-card ${rankClass}">
          ${avatarHtml}
          <div class="podium-user" title="@${esc(p.nickname || p.user)}">@${esc(p.nickname || p.user)}</div>
          <div class="podium-points">${p.score || 0}</div>
        </div>
      `;
    } else {
      html += `
        <div class="podium-card ${rankClass}" style="opacity:0.65">
          <div class="podium-rank-icon">${rankIcons[i]}</div>
          <div class="podium-user">—</div>
          <div class="podium-points">0</div>
        </div>
      `;
    }
  }

  elLeaderboardPodium.innerHTML = html;
}

function applyGameState(data) {
  const roundChanged = data.round !== lastRenderedRound;
  round = data.round || 1;
  level = data.level || 1;
  category = data.category || "fruit";
  streak = data.streak || 0;
  time = data.time !== undefined ? data.time : 20;
  active = !!data.active;
  revealed = !!data.revealed;
  elRound.textContent = `ROUND ${round}`;
  const lvlName = LEVELS[level - 1]?.name || "EASY";
  elLevel.textContent = `LVL ${level}`;
  elCategory.textContent = category.toUpperCase();
  if (elStreakValue) elStreakValue.textContent = streak;
  if (elStreak) elStreak.textContent = `🔥 ${streak}`;
  elTimer.textContent = Math.max(time, 0);

  const elTimerBox = document.getElementById("timerBox");
  if (time <= 5 && active) {
    if (elTimerBox) elTimerBox.classList.add("danger");
    playSound("tick");
  } else {
    if (elTimerBox) elTimerBox.classList.remove("danger");
  }

  renderWinnersBox(roundWinners);
  renderLeaderboard(data.leaderboard || []);

  if (data.statusMessage) {
    elStatus.textContent = data.statusMessage;
  }

  if (roundChanged) {
    elModal.classList.remove("active");
    clearAllHighlights();
  }

  const curTarget = data.target || target;
  if (
    roundChanged ||
    curTarget !== lastRenderedTarget ||
    category !== lastRenderedCategory ||
    level !== lastRenderedLevel ||
    !document.querySelector(".cell")
  ) {
    lastRenderedRound = round;
    lastRenderedTarget = curTarget;
    lastRenderedCategory = category;
    lastRenderedLevel = level;
    drawGrid(curTarget, category, level);
  }

  if (revealed) {
    highlightTarget(curTarget);
  } else {
    clearAllHighlights();
  }
}

// Button actions
btnStart.onclick = () => {
  if (socket && isServerConnected) socket.emit("startRound");
  else resetLocalGame();
};

btnReveal.onclick = () => {
  if (socket && isServerConnected) socket.emit("reveal");
  else {
    revealed = true;
    highlightTarget(target);
  }
};

btnNext.onclick = () => {
  if (socket && isServerConnected) socket.emit("nextRound");
  else newLocalRound();
};

// Standalone Local Logic (Fallback when no server is running)
let localWinners = [];
function startLocalGame() {
  newLocalRound();
  if (localTimerInterval) clearInterval(localTimerInterval);
  localTimerInterval = setInterval(() => {
    if (!isServerConnected) {
      if (active && time > 0) {
        time--;
        elTimer.textContent = `00:${String(Math.max(time, 0)).padStart(2, "0")}`;
        if (time <= 5) {
          elTimer.classList.add("danger");
          playSound("tick");
        } else {
          elTimer.classList.remove("danger");
        }
        if (time <= 0) {
          active = false;
          revealed = true;
          highlightTarget(target);
          playSound("timeout");
          if (localWinners.length === 0) streak = 0;
          elStatus.textContent = `⏰ Time's up! The answer was ${target}`;
          showLeaderboardPopup({ roundWinners: localWinners, leaderboard: [] });
          setTimeout(newLocalRound, 4000);
        }
      }
    }
  }, 1000);
}

function newLocalRound() {
  elModal.classList.remove("active");
  clearAllHighlights();
  round++;
  active = true;
  revealed = false;
  localWinners = [];
  level = Math.min(5, 1 + Math.floor(streak / 3));
  time = LEVELS[level - 1].sec;
  const TYPES = ["fruit", "bear", "cloud", "flower", "boba", "cupcake", "controller", "star"];
  category = TYPES[Math.floor(Math.random() * TYPES.length)];
  target = C[Math.floor(Math.random() * 6)] + R[Math.floor(Math.random() * 4)];

  applyGameState({
    round,
    level,
    category,
    streak,
    time,
    active: true,
    revealed: false,
    target,
    roundWinners: [],
    statusMessage: `${LEVELS[level - 1].name}: find the ONE odd ${category} 👀`
  });
}

function resetLocalGame() {
  round = 0;
  streak = 0;
  newLocalRound();
}

function handleLocalGuess(user, msg, avatar = null) {
  if (!active) return;
  const m = String(msg).toUpperCase().match(/(?:^|[^A-Z0-9])([A-F])[\s\-_]?([1-4])(?![0-9])/i);
  if (!m) return;
  const code = m[1].toUpperCase() + m[2];

  flashCellGuess(code);

  if (code === target) {
    if (localWinners.some(w => w.user.toLowerCase() === user.toLowerCase())) return;
    const place = localWinners.length + 1;
    const points = place === 1 ? 2 : 1;
    const winItem = { user, nickname: user, avatar, code, place, points };
    localWinners.push(winItem);

    playSound("win");
    highlightTarget(target);
    showLiveGuessPill(user, code, true);

    if (place === 1) streak++;

    if (localWinners.length >= 2) {
      active = false;
      revealed = true;
      showLeaderboardPopup({ roundWinners: localWinners, leaderboard: [] });
      setTimeout(newLocalRound, 4000);
    }
    renderWinnersBox(localWinners);
  } else {
    showLiveGuessPill(user, code, false);
  }
}

// In-Browser Direct TikFinity WebSocket Client (always active as robust fallback)
let directTikSocket = null;
let directRetry = null;

function connectDirectTikFinity() {
  clearTimeout(directRetry);
  try {
    directTikSocket = new WebSocket("ws://localhost:21213/");
    directTikSocket.onopen = () => {
      console.log("[Direct TikFinity] Connected in browser!");
    };
    directTikSocket.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const events = Array.isArray(raw) ? raw : [raw];
        for (const evt of events) {
          const d = evt.data || evt.payload || evt.Payload || evt;
          const text = String(d.comment || d.message || d.text || evt.comment || evt.message || d.Message || "").trim();
          const user = String(d.uniqueId || d.username || d.user?.uniqueId || evt.uniqueId || "viewer").trim();
          const nick = String(d.nickname || d.user?.nickname || evt.nickname || user).trim();
          const avatar = d.profilePictureUrl || d.avatarUrl || d.profileImageUrl || null;

          if (text) {
            console.log(`[Direct TikFinity Chat] @${nick}: ${text}`);
            if (!isServerConnected) {
              handleLocalGuess(nick, text, avatar);
            }
          }
        }
      } catch (err) {}
    };
    directTikSocket.onclose = () => {
      directRetry = setTimeout(connectDirectTikFinity, 4000);
    };
    directTikSocket.onerror = () => {
      directRetry = setTimeout(connectDirectTikFinity, 4000);
    };
  } catch (err) {
    directRetry = setTimeout(connectDirectTikFinity, 4000);
  }
}

// Initialize Socket.IO with automatic server / standalone detection
let socket = null;
function initSocket() {
  // Determine server host
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  const serverUrl = isHttp ? window.location.origin : "http://localhost:3000";

  if (typeof io !== "undefined") {
    try {
      socket = io(serverUrl, { timeout: 3000, reconnectionAttempts: 10 });

      socket.on("connect", () => {
        console.log("[Game] Connected to server at " + serverUrl);
        isServerConnected = true;
      });

      socket.on("gameState", (data) => {
        isServerConnected = true;
        applyGameState(data);
      });

      socket.on("roundStarted", (data) => {
        elModal.classList.remove("active");
        applyGameState(data);
      });

      socket.on("winnerFound", (payload) => {
        playSound("win");
        highlightTarget(payload.target);
        renderWinnersBox(payload.roundWinners || []);
        showLiveGuessPill(payload.winner.nickname, payload.winner.code, true);
      });

      socket.on("guessAttempt", (payload) => {
        flashCellGuess(payload.code);
        showLiveGuessPill(payload.user, payload.code, false);
      });

      socket.on("timeExpired", (payload) => {
        playSound("timeout");
        highlightTarget(payload.target);
      });

      socket.on("answerRevealed", (payload) => {
        highlightTarget(payload.target);
      });

      socket.on("showLeaderboardPopup", (payload) => {
        showLeaderboardPopup(payload);
      });

      socket.on("connect_error", () => {
        isServerConnected = false;
      });
    } catch (e) {
      console.warn("Socket init error, running locally", e);
    }
  }
}

// Start everything immediately on load
drawGrid(target, category, level);
startLocalGame();
initSocket();
connectDirectTikFinity();
