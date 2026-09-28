// games/word-finder/engine.js (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const puzzlesPath = path.join(__dirname, "puzzles.json");

let puzzleList = [];
try {
  if (fs.existsSync(puzzlesPath)) {
    const raw = fs.readFileSync(puzzlesPath, "utf8");
    puzzleList = JSON.parse(raw);
  }
} catch (err) {
  console.warn("[WordFinder] Could not load puzzles.json:", err.message);
}

// Fallback puzzle if puzzles.json is empty
const defaultPuzzles = [
  {
    id: "wf-pets",
    topic: "PETS",
    emoji: "🐶",
    category: "Cute Animals",
    grid: [
      "FPDCKM",
      "IUDBIO",
      "SPOITU",
      "HPGRTS",
      "YYNDEE",
      "FROGNO"
    ],
    words: [
      { word: "KITTEN", coords: ["A5", "B5", "C5", "D5", "E5", "F5"], start: "A5", end: "F5", direction: "V" },
      { word: "PUPPY", coords: ["A2", "B2", "C2", "D2", "E2"], start: "A2", end: "E2", direction: "V" },
      { word: "DOG", coords: ["B3", "C3", "D3"], start: "B3", end: "D3", direction: "V" },
      { word: "MOUSE", coords: ["A6", "B6", "C6", "D6", "E6"], start: "A6", end: "E6", direction: "V" },
      { word: "FROG", coords: ["F1", "F2", "F3", "F4"], start: "F1", end: "F4", direction: "H" },
      { word: "FISH", coords: ["A1", "B1", "C1", "D1"], start: "A1", end: "D1", direction: "V" },
      { word: "BIRD", coords: ["B4", "C4", "D4", "E4"], start: "B4", end: "E4", direction: "V" }
    ]
  }
];

const WORD_PALETTE = [
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#a855f7", // Violet
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#e11d48"  // Rose
];

const ALL_ROW_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALL_COL_NAMES = Array.from({ length: 26 }, (_, i) => String(i + 1));

export class WordFinderEngine {
  constructor() {
    this.puzzles = puzzleList.length > 0 ? puzzleList : defaultPuzzles;
    this.currentPuzzleIndex = 0;
    this.round = 1;
    this.pointsPerWord = 5;
    this.roundDurationSec = 60;
    this.timerRemaining = 60;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    // Grid size: 6 (6x6), 8 (8x8), or 10 (10x10)
    this.gridSize = 6;
    this.gridCache = new Map();

    this.topic = "PETS";
    this.emoji = "🐶";
    this.category = "Cute Animals";
    this.puzzleId = "wf-pets";

    this.grid = [];
    this.words = [];
    this.foundCount = 0;
    this.totalWords = 0;
    this.allFound = false;

    this.statusMessage = "Press START to begin Word Finder!";
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();
    this.playedPuzzleIndices = [];
    this.activeCategoryFilter = "ALL";
    this.lastHintCoord = null;
    this.elapsedSeconds = 0;

    const startIdx = this.getRandomPuzzleIndex();
    this.loadPuzzleByIndex(startIdx, false);
  }

  setGridSize(size) {
    const s = parseInt(size, 10);
    if ([6, 8, 10].includes(s)) {
      this.gridSize = s;
      this.loadPuzzleByIndex(this.currentPuzzleIndex, this.isTimerActive);
      this.statusMessage = `Grid size set to ${this.gridSize}x${this.gridSize}!`;
    }
    return this.getPublicPayload();
  }

  selectBalancedWords(pool, size, targetCount) {
    const valid = pool.filter(w => w.length >= 3 && w.length <= size);
    if (valid.length <= targetCount) return valid;

    // Categorize words by relative length
    const longWords = valid.filter(w => size >= 8 ? (w.length >= size - 2 && w.length <= size) : w.length >= 5);
    const midWords = valid.filter(w => size >= 8 ? (w.length >= 5 && w.length <= size - 3) : (w.length === 4 || w.length === 5));
    const shortWords = valid.filter(w => w.length >= 3 && w.length <= 4);

    const selected = new Set();
    // Prioritize 2-3 longer words that fit the grid
    [...longWords].sort(() => Math.random() - 0.5).slice(0, size >= 10 ? 3 : 2).forEach(w => selected.add(w));
    // Prioritize 2-3 mid-length words
    [...midWords].sort(() => Math.random() - 0.5).slice(0, 3).forEach(w => selected.add(w));
    // Prioritize 2 shorter words
    [...shortWords].sort(() => Math.random() - 0.5).slice(0, 2).forEach(w => selected.add(w));

    // Fill up to targetCount from remaining valid words
    const remaining = [...valid].sort(() => Math.random() - 0.5);
    for (const w of remaining) {
      if (selected.size >= targetCount) break;
      selected.add(w);
    }
    return Array.from(selected);
  }

  buildGridMatrix(words, size) {
    const grid = Array.from({ length: size }, () => Array(size).fill(""));
    const dirs = [
      { name: "H", dr: 0, dc: 1 },
      { name: "V", dr: 1, dc: 0 },
      { name: "D", dr: 1, dc: 1 },
      { name: "U", dr: -1, dc: 1 }
    ];
    const placedWords = [];

    // Longest words first
    const sorted = [...words].filter(w => w.length >= 3 && w.length <= size)
                            .sort((a, b) => b.length - a.length);

    for (const word of sorted) {
      const wLen = word.length;
      let placed = false;
      const attempts = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          for (const dir of dirs) {
            attempts.push({ r, c, dir });
          }
        }
      }
      // Shuffle placement attempts
      for (let i = attempts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [attempts[i], attempts[j]] = [attempts[j], attempts[i]];
      }

      for (const { r, c, dir } of attempts) {
        const endR = r + dir.dr * (wLen - 1);
        const endC = c + dir.dc * (wLen - 1);
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

        let canPlace = true;
        for (let i = 0; i < wLen; i++) {
          const curR = r + dir.dr * i;
          const curC = c + dir.dc * i;
          const existing = grid[curR][curC];
          if (existing !== "" && existing !== word[i]) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          const coords = [];
          for (let i = 0; i < wLen; i++) {
            const curR = r + dir.dr * i;
            const curC = c + dir.dc * i;
            grid[curR][curC] = word[i];
            coords.push(ALL_ROW_NAMES[curR] + (curC + 1));
          }
          placedWords.push({
            word,
            coords,
            start: coords[0],
            end: coords[coords.length - 1],
            direction: dir.name
          });
          placed = true;
          break;
        }
      }
    }

    // Fill remaining cells with random letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) {
          grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
        }
      }
    }

    return {
      grid: grid.map(row => row.join("")),
      words: placedWords
    };
  }

  generatePuzzleLayout(p, size = 6) {
    const s = parseInt(size, 10) || 6;
    const cacheKey = `${p.id || p.topic}_${s}`;
    if (this.gridCache && this.gridCache.has(cacheKey)) {
      return this.gridCache.get(cacheKey);
    }

    // If 6x6 and p.grid is already a valid 6x6 grid with words, use it
    if (s === 6 && Array.isArray(p.grid) && p.grid.length === 6 && p.grid[0].length === 6 && Array.isArray(p.words) && p.words.length > 0) {
      const layout = {
        grid: p.grid.map(row => String(row).toUpperCase().slice(0, 6)),
        words: p.words.map(w => ({
          word: String(w.word || "").toUpperCase().trim(),
          coords: Array.isArray(w.coords) ? w.coords : [],
          start: w.start || (w.coords ? w.coords[0] : ""),
          end: w.end || (w.coords ? w.coords[w.coords.length - 1] : ""),
          direction: w.direction || "H"
        }))
      };
      if (!this.gridCache) this.gridCache = new Map();
      this.gridCache.set(cacheKey, layout);
      return layout;
    }

    // Gather candidate words from wordPool or p.words
    let pool = [];
    if (Array.isArray(p.wordPool) && p.wordPool.length > 0) {
      pool = p.wordPool.map(w => String(w).toUpperCase().replace(/[^A-Z]/g, ""));
    } else if (Array.isArray(p.words) && p.words.length > 0) {
      pool = p.words.map(w => String(w.word || w).toUpperCase().replace(/[^A-Z]/g, ""));
    }
    pool = Array.from(new Set(pool)).filter(w => w.length >= 3 && w.length <= s);

    // Target count based on grid size
    const targetCount = s === 10 ? 8 : (s === 8 ? 7 : 6);
    const selectedWords = this.selectBalancedWords(pool, s, targetCount);

    const layout = this.buildGridMatrix(selectedWords, s);
    if (!this.gridCache) this.gridCache = new Map();
    this.gridCache.set(cacheKey, layout);
    return layout;
  }

  getRandomPuzzleIndex(categoryFilter = null) {
    if (!this.puzzles || this.puzzles.length <= 1) return 0;
    const cat = (categoryFilter && categoryFilter !== "ALL")
      ? categoryFilter
      : (this.activeCategoryFilter !== "ALL" ? this.activeCategoryFilter : null);

    if (this.playedPuzzleIndices.length >= this.puzzles.length) {
      this.playedPuzzleIndices = [];
    }
    const playedSet = new Set(this.playedPuzzleIndices);
    const available = [];
    for (let i = 0; i < this.puzzles.length; i++) {
      if (cat && this.puzzles[i].category !== cat) {
        continue;
      }
      if (!playedSet.has(i) && i !== this.currentPuzzleIndex) {
        available.push(i);
      }
    }
    const pool = available.length > 0
      ? available
      : this.puzzles
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => (!cat || p.category === cat) && i !== this.currentPuzzleIndex)
          .map(({ i }) => i);

    if (pool.length === 0) return this.currentPuzzleIndex;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.playedPuzzleIndices.push(chosen);
    return chosen;
  }

  loadPuzzleByIndex(index, startTimerNow = false) {
    if (this.puzzles.length === 0) return;
    this.currentPuzzleIndex = ((index % this.puzzles.length) + this.puzzles.length) % this.puzzles.length;
    const p = this.puzzles[this.currentPuzzleIndex];

    this.topic = p.topic || "WORDS";
    this.emoji = p.emoji || "🔍";
    this.category = p.category || "General";
    this.puzzleId = p.id || `wf-${this.currentPuzzleIndex}`;

    // Generate or fetch layout for current grid size (6x6, 8x8, or 10x10)
    const layout = this.generatePuzzleLayout(p, this.gridSize);
    this.grid = layout.grid;

    // Setup words with palette colors
    this.words = (layout.words || []).map((w, idx) => ({
      index: idx,
      word: String(w.word || "").toUpperCase().trim(),
      coords: Array.isArray(w.coords) ? w.coords : [],
      start: w.start || (w.coords ? w.coords[0] : ""),
      end: w.end || (w.coords ? w.coords[w.coords.length - 1] : ""),
      direction: w.direction || "H",
      color: WORD_PALETTE[idx % WORD_PALETTE.length],
      revealed: false,
      foundBy: null,
      points: this.pointsPerWord
    }));

    this.foundCount = 0;
    this.totalWords = this.words.length;
    this.allFound = false;
    this.roundWinners = [];
    this.lastHintCoord = null;
    this.elapsedSeconds = 0;

    if (startTimerNow) {
      this.timerRemaining = this.roundDurationSec;
      this.isTimerActive = true;
      this.paused = false;
      this.statusMessage = `Round ${this.round} (${this.gridSize}x${this.gridSize}): Find ${this.totalWords} words for "${this.topic}" ${this.emoji}!`;
    } else {
      this.timerRemaining = this.roundDurationSec;
      this.isTimerActive = false;
      this.paused = false;
      this.statusMessage = `Topic: ${this.topic} ${this.emoji} (${this.gridSize}x${this.gridSize} • ${this.totalWords} words). Press START!`;
    }

    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    let nextIdx;
    if (options && options.category) {
      this.activeCategoryFilter = options.category;
      nextIdx = this.getRandomPuzzleIndex(options.category);
    } else {
      nextIdx = this.getRandomPuzzleIndex();
    }
    return this.loadPuzzleByIndex(nextIdx, true);
  }

  nextRound(options = {}) {
    return this.newRound(options);
  }

  prevRound() {
    this.round = Math.max(1, this.round - 1);
    const prevIdx = (this.currentPuzzleIndex - 1 + this.puzzles.length) % this.puzzles.length;
    return this.loadPuzzleByIndex(prevIdx, this.isTimerActive);
  }

  setTime(seconds) {
    const s = parseInt(seconds, 10);
    if (!isNaN(s) && s > 0) {
      this.roundDurationSec = s;
      this.timerRemaining = s;
    }
    return this.getPublicPayload();
  }

  adjustTime(deltaSec) {
    const d = parseInt(deltaSec, 10) || 0;
    this.timerRemaining = Math.max(0, this.timerRemaining + d);
    return this.getPublicPayload();
  }

  startTimer(seconds = null) {
    if (seconds && Number(seconds) > 0) {
      this.roundDurationSec = Number(seconds);
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.paused = false;
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Find ${this.totalWords} words!`;
    return this.getPublicPayload();
  }

  stopTimer() {
    this.isTimerActive = false;
    this.paused = true;
    this.statusMessage = "Timer paused";
    return this.getPublicPayload();
  }

  setPaused(pause) {
    this.paused = !!pause;
    return this.getPublicPayload();
  }

  revealWord(wordOrIndex) {
    let target = null;
    if (typeof wordOrIndex === "number" || (!isNaN(parseInt(wordOrIndex, 10)) && typeof wordOrIndex === "string")) {
      const idx = parseInt(wordOrIndex, 10);
      target = this.words[idx];
    } else {
      const clean = String(wordOrIndex || "").toUpperCase().trim();
      target = this.words.find(w => w.word === clean);
    }

    if (target && !target.revealed) {
      target.revealed = true;
      this.foundCount++;
      if (this.foundCount >= this.totalWords) {
        this.allFound = true;
        this.isTimerActive = false;
        this.streak++;
        this.statusMessage = `🎉 All ${this.totalWords} words found! Community streak: 🔥 ${this.streak}`;
      } else {
        this.statusMessage = `Host revealed "${target.word}" (${this.foundCount}/${this.totalWords})`;
      }
    }
    return this.getPublicPayload();
  }

  reveal() {
    // Reveal all remaining unrevealed words
    this.words.forEach(w => {
      w.revealed = true;
    });
    this.foundCount = this.totalWords;
    this.allFound = true;
    this.isTimerActive = false;
    this.statusMessage = `All words revealed for "${this.topic}"`;
    return this.getPublicPayload();
  }

  hideAnswer() {
    // Re-hide all words that weren't found by viewers
    this.words.forEach(w => {
      if (!w.foundBy) {
        w.revealed = false;
      }
    });
    this.foundCount = this.words.filter(w => w.revealed).length;
    this.allFound = this.foundCount >= this.totalWords;
    this.statusMessage = "Unsolved words re-hidden";
    return this.getPublicPayload();
  }

  hint() {
    // Find the first unrevealed word and give its starting coordinate
    const unfound = this.words.find(w => !w.revealed);
    if (!unfound) {
      this.statusMessage = "All words are already found!";
      return this.getPublicPayload();
    }
    this.lastHintCoord = unfound.start;
    this.statusMessage = `💡 HINT: There's a word starting at cell ${unfound.start} (${unfound.word.length} letters)!`;
    return this.getPublicPayload();
  }

  tick() {
    if (!this.isTimerActive || this.paused) return { changed: false, timeExpired: false };
    this.elapsedSeconds++;
    this.timerRemaining--;

    if (this.timerRemaining <= 0) {
      this.timerRemaining = 0;
      this.isTimerActive = false;

      // Reveal all words on expiration
      this.words.forEach(w => {
        w.revealed = true;
      });

      const wasPerfect = this.foundCount === this.totalWords;
      if (!wasPerfect) {
        this.streak = 0;
        this.statusMessage = `⏰ Time's up! Found ${this.foundCount}/${this.totalWords} words.`;
      } else {
        this.statusMessage = `⏰ Time's up! Perfect round! Streak: 🔥 ${this.streak}`;
      }

      return {
        changed: true,
        timeExpired: true,
        hadWinners: this.roundWinners.length > 0,
        allFound: this.allFound,
        foundCount: this.foundCount,
        totalWords: this.totalWords,
        streak: this.streak,
        roundWinners: this.roundWinners,
        target: this.topic
      };
    }

    return { changed: true, timeExpired: false };
  }

  normalizeString(str) {
    return String(str || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
  }

  processGuess(user, nickname, message, avatar = null) {
    const cleanUser = user || "viewer";
    const cleanNick = nickname || cleanUser;
    const cleanMsg = String(message || "").trim();
    if (!cleanMsg) return { valid: false };

    const upperMsg = cleanMsg.toUpperCase().trim();
    const normGuess = this.normalizeString(cleanMsg);
    if (!normGuess) return { valid: false };

    // Check if the guess matches any unrevealed word
    let matchedWordIndex = -1;

    // 1. Single coordinate matching (e.g. "A1", "a1", "!A1", "A 1", "j10")
    const maxRowChar = String.fromCharCode(65 + this.gridSize - 1);
    const rowClass = `[A-${maxRowChar}]`;
    const colClass = this.gridSize === 10 ? "(?:10|[1-9])" : `[1-${this.gridSize}]`;

    let singleCoord = null;
    const singleRegex = new RegExp(`^!?(${rowClass})\\s*(${colClass})$`);
    const singleMatch = upperMsg.match(singleRegex);
    if (singleMatch) {
      singleCoord = `${singleMatch[1]}${singleMatch[2]}`;
    } else {
      const normSingleRegex = new RegExp(`^(${rowClass})(${colClass})$`);
      const normSingleMatch = normGuess.match(normSingleRegex);
      if (normSingleMatch) {
        singleCoord = `${normSingleMatch[1]}${normSingleMatch[2]}`;
      }
    }

    if (singleCoord) {
      // Priority 1: Match any unrevealed word that STARTS at this coordinate
      for (let i = 0; i < this.words.length; i++) {
        const w = this.words[i];
        if (!w.revealed && w.start === singleCoord) {
          matchedWordIndex = i;
          break;
        }
      }
      // Priority 2: If none starts at this coordinate, check if any unrevealed word ENDS at this coordinate
      if (matchedWordIndex === -1) {
        for (let i = 0; i < this.words.length; i++) {
          const w = this.words[i];
          if (!w.revealed && w.end === singleCoord) {
            matchedWordIndex = i;
            break;
          }
        }
      }
    }

    // 2. Coordinate range matching (e.g. "A1-D1", "A1 TO D1", "A1 D1", "A1:D1", "A1D1", "A1-J10")
    if (matchedWordIndex === -1) {
      const sep = `(?:\\s*(?:TO|[-:,>])\\s*|\\s+)`;
      const rangeRegex = new RegExp(`^!?(${rowClass})\\s*(${colClass})${sep}(${rowClass})\\s*(${colClass})$`);
      let rangeMatch = upperMsg.match(rangeRegex);
      let c1 = null;
      let c2 = null;
      if (rangeMatch) {
        c1 = `${rangeMatch[1]}${rangeMatch[2]}`;
        c2 = `${rangeMatch[3]}${rangeMatch[4]}`;
      } else {
        const normRangeRegex = new RegExp(`^(${rowClass})(${colClass})(${rowClass})(${colClass})$`);
        const normRangeMatch = normGuess.match(normRangeRegex);
        if (normRangeMatch) {
          c1 = `${normRangeMatch[1]}${normRangeMatch[2]}`;
          c2 = `${normRangeMatch[3]}${normRangeMatch[4]}`;
        }
      }

      if (c1 && c2) {
        for (let i = 0; i < this.words.length; i++) {
          const w = this.words[i];
          if (!w.revealed) {
            if (
              (w.start === c1 && w.end === c2) ||
              (w.start === c2 && w.end === c1)
            ) {
              matchedWordIndex = i;
              break;
            }
          }
        }
      }
    }

    // 3. Word string or word token match (e.g. "FISH", "fish", "the word is fish")
    if (matchedWordIndex === -1) {
      const tokens = upperMsg.split(/[^A-Z0-9]+/).filter(Boolean);

      for (let i = 0; i < this.words.length; i++) {
        const w = this.words[i];
        if (!w.revealed) {
          const normTarget = this.normalizeString(w.word);
          // Exact guess match
          if (normGuess === normTarget) {
            matchedWordIndex = i;
            break;
          }
          // Exact word token match
          if (tokens.includes(normTarget)) {
            matchedWordIndex = i;
            break;
          }
          // Substring match for longer words (length >= 4)
          if (normTarget.length >= 4 && normGuess.includes(normTarget)) {
            matchedWordIndex = i;
            break;
          }
        }
      }
    }

    const isCorrect = this.isTimerActive && matchedWordIndex !== -1;

    const guessItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: cleanUser,
      nickname: cleanNick,
      avatar: avatar || null,
      code: cleanMsg,
      message: cleanMsg,
      isCorrect,
      timestamp: Date.now()
    };

    this.guesses.unshift(guessItem);
    if (this.guesses.length > 100) this.guesses.pop();

    if (isCorrect) {
      const targetWord = this.words[matchedWordIndex];
      targetWord.revealed = true;
      this.foundCount++;
      const pointsAwarded = this.pointsPerWord;

      const winnerData = {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        code: targetWord.word,
        word: targetWord.word,
        coords: targetWord.coords,
        color: targetWord.color,
        wordIndex: matchedWordIndex,
        place: this.foundCount,
        points: pointsAwarded,
        timestamp: Date.now()
      };

      targetWord.foundBy = winnerData;
      this.roundWinners.push(winnerData);

      // Update community leaderboard
      const userKey = cleanUser.toLowerCase();
      const existing = this.leaderboard.get(userKey) || {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        score: 0,
        wordsFound: 0,
        puzzlesCleared: 0
      };
      existing.user = cleanUser;
      existing.nickname = cleanNick;
      if (avatar) existing.avatar = avatar;
      existing.score += pointsAwarded;
      existing.wordsFound += 1;
      existing.lastWonAt = Date.now();

      if (this.foundCount >= this.totalWords) {
        this.allFound = true;
        this.isTimerActive = false;
        this.streak++;
        existing.puzzlesCleared += 1;
        this.statusMessage = `🎉 All ${this.totalWords} words found! Last word "${targetWord.word}" by @${cleanNick}! Streak: 🔥 ${this.streak}`;
      } else {
        this.statusMessage = `🎯 @${cleanNick} found "${targetWord.word}"! (+${pointsAwarded} pts) [${this.foundCount}/${this.totalWords}]`;
      }

      this.leaderboard.set(userKey, existing);

      return {
        valid: true,
        isCorrect: true,
        guessItem,
        wordIndex: matchedWordIndex,
        word: targetWord.word,
        coords: targetWord.coords,
        color: targetWord.color,
        winner: winnerData,
        place: this.foundCount,
        foundCount: this.foundCount,
        totalWords: this.totalWords,
        allFound: this.allFound,
        roundComplete: this.allFound,
        streak: this.streak,
        points: pointsAwarded
      };
    }

    return {
      valid: true,
      isCorrect: false,
      guessItem,
      user: cleanUser,
      nickname: cleanNick,
      guess: cleanMsg
    };
  }

  loadPuzzleById(id) {
    const targetId = typeof id === "object" && id !== null ? (id.id || id.puzzleId) : id;
    const idx = this.puzzles.findIndex(p => p.id === targetId);
    if (idx !== -1) {
      return this.loadPuzzleByIndex(idx, this.isTimerActive);
    }
    return this.getPublicPayload();
  }

  setCategoryFilter(category) {
    this.activeCategoryFilter = category || "ALL";
    const nextIdx = this.getRandomPuzzleIndex(this.activeCategoryFilter);
    return this.loadPuzzleByIndex(nextIdx, this.isTimerActive);
  }

  resetGame() {
    this.round = 1;
    this.streak = 0;
    this.playedPuzzleIndices = [];
    const idx = this.getRandomPuzzleIndex();
    this.loadPuzzleByIndex(idx, false);
    this.statusMessage = "Word Finder game reset!";
    return this.getPublicPayload();
  }

  resetLeaderboard() {
    this.leaderboard.clear();
    this.statusMessage = "Leaderboard reset!";
    return this.getPublicPayload();
  }

  getLeaderboardArray(limit = 10) {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.score - a.score || b.wordsFound - a.wordsFound || a.lastWonAt - b.lastWonAt)
      .slice(0, limit);
  }

  getLeaderboard(limit = 10) {
    return this.getLeaderboardArray(limit);
  }

  getCategories() {
    const set = new Set();
    this.puzzles.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }

  getPuzzlesSummary() {
    return this.puzzles.map(p => ({
      id: p.id,
      topic: p.topic,
      emoji: p.emoji,
      category: p.category,
      wordCount: Array.isArray(p.words) ? p.words.length : 0
    }));
  }

  getPublicPayload() {
    return {
      gameId: "word-finder",
      round: this.round,
      streak: this.streak,
      topic: this.topic,
      emoji: this.emoji,
      category: this.category,
      puzzleId: this.puzzleId,
      gridSize: this.gridSize,
      grid: this.grid,
      words: this.words.map(w => ({
        index: w.index,
        word: w.revealed ? w.word : "",
        length: w.word.length,
        revealed: w.revealed,
        foundBy: w.foundBy,
        color: w.color,
        coords: w.revealed ? w.coords : [],
        start: w.revealed ? w.start : "",
        end: w.revealed ? w.end : "",
        direction: w.revealed ? w.direction : ""
      })),
      foundCount: this.foundCount,
      totalWords: this.totalWords,
      allFound: this.allFound,
      isTimerActive: this.isTimerActive,
      time: this.timerRemaining,
      timerRemaining: this.timerRemaining,
      paused: this.paused,
      statusMessage: this.statusMessage,
      roundWinners: this.roundWinners,
      lastHintCoord: this.lastHintCoord,
      leaderboard: this.getLeaderboardArray(10),
      categories: this.getCategories(),
      activeCategoryFilter: this.activeCategoryFilter,
      puzzles: this.getPuzzlesSummary()
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      // Host cheat sheet: includes all words with all secret coords
      secretWords: this.words.map(w => ({
        index: w.index,
        word: w.word,
        length: w.word.length,
        coords: w.coords,
        start: w.start,
        end: w.end,
        direction: w.direction,
        color: w.color,
        revealed: w.revealed,
        foundBy: w.foundBy
      })),
      allPuzzles: this.puzzles
    };
  }
}
