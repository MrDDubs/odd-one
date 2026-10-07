// games/rebus/engine.js (ESM)
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
  console.warn("[Rebus] Could not load puzzles.json:", err.message);
}

// Fallback in case puzzles.json is missing or corrupt
const defaultPuzzles = [
  {
    id: "reb-0001",
    answer: "HEAD OVER HEELS",
    acceptableAnswers: ["head over heels", "headoverheels", "head heels"],
    category: "Idioms",
    difficulty: "Easy",
    hint: "Falling deeply in love",
    layout: "stacked",
    visual: { top: "HEAD", bottom: "HEELS", divider: true },
    emoji: "❤️"
  },
  {
    id: "reb-0002",
    answer: "MIND OVER MATTER",
    acceptableAnswers: ["mind over matter", "mindovermatter"],
    category: "Sayings",
    difficulty: "Easy",
    hint: "Willpower conquering physical obstacles",
    layout: "stacked",
    visual: { top: "MIND", bottom: "MATTER", divider: true },
    emoji: "🧠"
  },
  {
    id: "reb-0004",
    answer: "I UNDERSTAND",
    acceptableAnswers: ["i understand", "iunderstand", "understand"],
    category: "Phrases",
    difficulty: "Easy",
    hint: "Comprehension or agreement",
    layout: "stacked",
    visual: { top: "STAND", bottom: "I", divider: true },
    emoji: "💡"
  }
];

export class RebusEngine {
  constructor() {
    this.puzzles = puzzleList.length > 0 ? puzzleList : defaultPuzzles;
    this.currentPuzzleIndex = 0;
    this.round = 1;
    this.roundDurationSec = 45;
    this.customDurationSec = null;
    this.timerRemaining = 45;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    this.currentPuzzle = this.puzzles[0];
    this.category = "Idioms";
    this.difficulty = "Easy";
    this.emoji = "❤️";
    this.hintClue = "Falling deeply in love";
    this.puzzleId = "reb-0001";
    this.layout = "stacked";
    this.visual = { top: "HEAD", bottom: "HEELS", divider: true };

    // Progressive Hint Levels:
    // 0 = none revealed
    // 1 = clue revealed
    // 2 = letter slot counts revealed
    // 3 = first letter of each word revealed
    this.hintLevel = 0;
    this.isRevealed = false;
    this.statusMessage = "Press START to begin Ally's Rebus! 🎭";
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();
    this.playedPuzzleIndices = [];

    this.categoryFilter = "all";
    this.difficultyFilter = "all";

    const startIdx = this.getRandomPuzzleIndex();
    this.loadPuzzleByIndex(startIdx, false);
  }

  normalizeString(str) {
    if (!str) return "";
    return String(str)
      .toUpperCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  getRandomPuzzleIndex() {
    if (!this.puzzles || this.puzzles.length === 0) return 0;

    let pool = [];
    for (let i = 0; i < this.puzzles.length; i++) {
      const p = this.puzzles[i];
      if (this.categoryFilter !== "all" && p.category !== this.categoryFilter) continue;
      if (this.difficultyFilter !== "all" && p.difficulty !== this.difficultyFilter) continue;
      pool.push(i);
    }

    if (pool.length === 0) {
      pool = this.puzzles.map((_, i) => i);
    }

    const playedSet = new Set(this.playedPuzzleIndices);
    const unplayed = pool.filter((i) => !playedSet.has(i));

    if (unplayed.length === 0) {
      this.playedPuzzleIndices = [];
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      this.playedPuzzleIndices.push(chosen);
      return chosen;
    }

    const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
    this.playedPuzzleIndices.push(chosen);
    return chosen;
  }

  loadPuzzleByIndex(index, startTimerNow = false) {
    if (!this.puzzles || this.puzzles.length === 0) return;
    this.currentPuzzleIndex = ((index % this.puzzles.length) + this.puzzles.length) % this.puzzles.length;
    const p = this.puzzles[this.currentPuzzleIndex];

    this.currentPuzzle = p;
    this.puzzleId = p.id || `reb-${this.currentPuzzleIndex + 1}`;
    this.category = p.category || "General";
    this.difficulty = p.difficulty || "Medium";
    this.emoji = p.emoji || "🎭";
    this.hintClue = p.hint || "Visual wordplay";
    this.layout = p.layout || "stacked";
    this.visual = p.visual || {};

    this.hintLevel = 0;
    this.isRevealed = false;
    this.roundWinners = [];

    if (this.customDurationSec && this.customDurationSec > 0) {
      this.roundDurationSec = this.customDurationSec;
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = startTimerNow;
    this.paused = false;

    this.statusMessage = `Round ${this.round}: Guess the Rebus puzzle in chat! 🎭`;
  }

  loadPuzzleById(id) {
    const targetId = typeof id === "object" && id ? (id.id || id.puzzleId) : id;
    const idx = this.puzzles.findIndex((p) => p.id === targetId);
    if (idx !== -1) {
      this.loadPuzzleByIndex(idx, true);
    }
    return this.getPublicPayload();
  }

  setCategoryFilter(filter) {
    const f = typeof filter === "object" && filter ? (filter.category || filter.filter) : filter;
    this.categoryFilter = f || "all";
    return this.getPublicPayload();
  }

  setDifficultyFilter(filter) {
    const f = typeof filter === "object" && filter ? (filter.difficulty || filter.filter) : filter;
    this.difficultyFilter = f || "all";
    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    let nextIdx = this.getRandomPuzzleIndex();
    if (options && (options.id || options.puzzleId)) {
      const targetId = options.id || options.puzzleId;
      const foundIdx = this.puzzles.findIndex((p) => p.id === targetId);
      if (foundIdx !== -1) nextIdx = foundIdx;
    }

    if (options && options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
      this.customDurationSec = Number(options.duration);
    }

    if (options && options.category) {
      this.categoryFilter = options.category;
    }
    if (options && options.difficulty) {
      this.difficultyFilter = options.difficulty;
    }

    this.loadPuzzleByIndex(nextIdx, true);
    return this.getPublicPayload();
  }

  prevRound() {
    this.round = Math.max(1, this.round - 1);
    const prevIdx = (this.currentPuzzleIndex - 1 + this.puzzles.length) % this.puzzles.length;
    this.loadPuzzleByIndex(prevIdx, false);
    return this.getPublicPayload();
  }

  startTimer(seconds = null) {
    const raw = (seconds && typeof seconds === "object") ? (seconds.sec ?? seconds.seconds ?? seconds.duration) : seconds;
    const s = parseInt(raw, 10);
    if (!isNaN(s) && s > 0) {
      this.customDurationSec = s;
      this.roundDurationSec = s;
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.paused = false;
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Guess the Rebus puzzle in chat!`;
    return this.getPublicPayload();
  }

  stopTimer() {
    this.isTimerActive = false;
    this.paused = true;
    this.statusMessage = "Timer paused ⏸";
    return this.getPublicPayload();
  }

  setTime(sec) {
    const raw = (sec && typeof sec === "object") ? (sec.sec ?? sec.seconds ?? sec.duration ?? sec.time) : sec;
    const s = parseInt(raw, 10);
    if (!isNaN(s) && s > 0) {
      this.customDurationSec = s;
      this.roundDurationSec = s;
      this.timerRemaining = s;
    }
    return this.getPublicPayload();
  }

  adjustTime(delta) {
    const raw = (delta && typeof delta === "object") ? (delta.delta ?? delta.deltaSec ?? delta.d ?? delta.sec) : delta;
    const num = parseInt(raw, 10) || 0;
    this.timerRemaining = Math.max(0, this.timerRemaining + num);
    return this.getPublicPayload();
  }

  setPaused(isPaused) {
    this.paused = !!isPaused;
    if (this.paused) {
      this.isTimerActive = false;
      this.statusMessage = "Game paused ⏸";
    } else {
      this.isTimerActive = true;
      this.statusMessage = "Game resumed ▶";
    }
    return this.getPublicPayload();
  }

  hint() {
    if (this.hintLevel < 3) {
      this.hintLevel++;
    }
    if (this.hintLevel === 1) {
      this.statusMessage = `💡 Clue revealed: "${this.hintClue}"`;
    } else if (this.hintLevel === 2) {
      this.statusMessage = `💡 Word blanks revealed!`;
    } else if (this.hintLevel === 3) {
      this.statusMessage = `💡 First letters revealed!`;
    }
    return this.getPublicPayload();
  }

  reveal() {
    this.isRevealed = true;
    this.isTimerActive = false;
    this.statusMessage = `Answer revealed: ${this.currentPuzzle.answer}! 🎭`;
    return this.getPublicPayload();
  }

  // Generates masked letter representation for viewers
  getMaskedSlots() {
    const ans = this.currentPuzzle.answer || "";
    const words = ans.split(" ");

    return words.map((word) => {
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (/[A-Z0-9]/i.test(char)) {
          if (this.isRevealed) {
            letters.push(char);
          } else if (this.hintLevel >= 3 && i === 0) {
            letters.push(char); // first letter revealed
          } else if (this.hintLevel >= 2) {
            letters.push("_"); // blank slot
          } else {
            letters.push(""); // hidden completely
          }
        } else {
          letters.push(char); // punctuation like & or -
        }
      }
      return letters;
    });
  }

  processGuess(username, nickname, text, avatar = null) {
    if (!text || !this.isTimerActive || this.paused || this.isRevealed) {
      return { valid: false };
    }

    const cleanInput = String(text).trim();
    const normalizedInput = this.normalizeString(cleanInput);

    if (normalizedInput.length < 2) {
      return { valid: false };
    }

    const guessEntry = {
      username: username || "Viewer",
      nickname: nickname || username || "Viewer",
      text: cleanInput,
      timestamp: Date.now(),
      isCorrect: false,
      avatar: avatar || null
    };
    this.guesses.unshift(guessEntry);
    if (this.guesses.length > 50) this.guesses.pop();

    const normalizedAnswer = this.normalizeString(this.currentPuzzle.answer);
    const normalizedAcceptables = (this.currentPuzzle.acceptableAnswers || []).map((a) => this.normalizeString(a));

    // Check exact match or acceptable variants
    const isExactMatch =
      normalizedInput === normalizedAnswer ||
      normalizedAcceptables.includes(normalizedInput);

    // Or chatter types longer message including the answer (e.g., "is it head over heels")
    let isContainedMatch = false;
    if (!isExactMatch && normalizedAnswer.length >= 4 && normalizedInput.length > normalizedAnswer.length) {
      if (normalizedInput.includes(normalizedAnswer)) {
        isContainedMatch = true;
      } else {
        for (const alias of normalizedAcceptables) {
          if (alias.length >= 4 && normalizedInput.includes(alias)) {
            isContainedMatch = true;
            break;
          }
        }
      }
    }

    if (isExactMatch || isContainedMatch) {
      guessEntry.isCorrect = true;
      this.isRevealed = true;
      this.isTimerActive = false;
      this.streak++;

      // Points: base points based on difficulty (Easy: 20, Medium: 30, Hard: 40) + speed bonus
      let basePoints = 30;
      if (this.difficulty === "Easy") basePoints = 20;
      if (this.difficulty === "Hard") basePoints = 40;

      const speedBonus = Math.floor((this.timerRemaining / Math.max(1, this.roundDurationSec)) * 10);
      const totalPoints = basePoints + speedBonus;

      const key = username || "anonymous";
      const current = this.leaderboard.get(key) || {
        username: key,
        nickname: nickname || key,
        score: 0,
        wins: 0,
        avatar: avatar || null
      };
      current.score += totalPoints;
      current.wins += 1;
      if (avatar) current.avatar = avatar;
      this.leaderboard.set(key, current);

      const winnerObj = {
        place: 1,
        user: key,
        nickname: nickname || key,
        avatar: avatar || null,
        word: this.currentPuzzle.answer,
        code: this.currentPuzzle.answer,
        points: totalPoints,
        speedBonus
      };
      this.roundWinners = [winnerObj];

      this.statusMessage = `🎉 @${nickname || key} CRACKED THE REBUS: "${this.currentPuzzle.answer}" (+${totalPoints} pts)!`;

      return {
        valid: true,
        isCorrect: true,
        word: this.currentPuzzle.answer,
        answer: this.currentPuzzle.answer,
        points: totalPoints,
        winner: winnerObj,
        newStreak: this.streak,
        roundComplete: true,
        roundWinners: this.roundWinners,
        guessItem: guessEntry
      };
    }

    return {
      valid: true,
      isCorrect: false,
      guessItem: guessEntry
    };
  }

  tick() {
    if (!this.isTimerActive || this.paused) {
      return { changed: false, timeExpired: false };
    }

    if (this.timerRemaining > 0) {
      this.timerRemaining--;

      // Progressive hints at specific timer thresholds
      // 25s remaining: reveal clue if level 0
      if (this.timerRemaining === 25 && this.hintLevel === 0) {
        this.hintLevel = 1;
      }
      // 12s remaining: reveal blanks if level 1
      if (this.timerRemaining === 12 && this.hintLevel === 1) {
        this.hintLevel = 2;
      }

      if (this.timerRemaining <= 0) {
        this.isTimerActive = false;
        this.isRevealed = true;
        this.streak = 0;
        this.statusMessage = `⏰ Time's up! The answer was "${this.currentPuzzle.answer}".`;
        return {
          changed: true,
          timeExpired: true,
          target: this.currentPuzzle.answer,
          word: this.currentPuzzle.answer,
          hadWinners: this.roundWinners.length > 0,
          roundWinners: this.roundWinners
        };
      }
      return { changed: true, timeExpired: false };
    }

    return { changed: false, timeExpired: false };
  }

  getLeaderboard(limit = 10) {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.score - a.score || b.wins - a.wins)
      .slice(0, limit);
  }

  resetGame() {
    this.round = 1;
    this.streak = 0;
    this.playedPuzzleIndices = [];
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard.clear();
    this.loadPuzzleByIndex(this.getRandomPuzzleIndex(), false);
    return this.getPublicPayload();
  }

  resetLeaderboard() {
    this.leaderboard.clear();
    return this.getPublicPayload();
  }

  getPublicPayload() {
    return {
      gameId: "rebus",
      round: this.round,
      time: this.timerRemaining,
      roundDurationSec: this.roundDurationSec,
      active: this.isTimerActive,
      isTimerActive: this.isTimerActive,
      paused: this.paused,
      streak: this.streak,
      category: this.category,
      difficulty: this.difficulty,
      emoji: this.emoji,
      hintLevel: this.hintLevel,
      hintClue: this.hintLevel >= 1 ? this.hintClue : null,
      maskedSlots: this.getMaskedSlots(),
      puzzleId: this.puzzleId,
      layout: this.layout,
      visual: this.visual,
      answer: this.isRevealed ? this.currentPuzzle.answer : null,
      isRevealed: this.isRevealed,
      statusMessage: this.statusMessage,
      roundWinners: this.roundWinners,
      guesses: this.guesses.slice(0, 10),
      totalPuzzlesCount: this.puzzles.length,
      categoryFilter: this.categoryFilter,
      difficultyFilter: this.difficultyFilter
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretAnswer: this.currentPuzzle.answer,
      secretHint: this.hintClue,
      acceptableAnswers: this.currentPuzzle.acceptableAnswers || [],
      puzzlesListPreview: this.puzzles.slice(0, 120).map((p) => ({
        id: p.id,
        answer: p.answer,
        category: p.category,
        difficulty: p.difficulty,
        layout: p.layout,
        emoji: p.emoji
      })),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
