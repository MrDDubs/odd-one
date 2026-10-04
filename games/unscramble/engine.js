// games/unscramble/engine.js (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wordsPath = path.join(__dirname, "words.json");

let wordList = [];
try {
  if (fs.existsSync(wordsPath)) {
    const raw = fs.readFileSync(wordsPath, "utf8");
    wordList = JSON.parse(raw);
  }
} catch (err) {
  console.warn("[Unscramble] Could not load words.json:", err.message);
}

// Fallback if words.json is empty
const defaultWords = [
  { id: "u-0001", word: "PIZZA", scrambled: "ZAPZI", length: 5, category: "Food & Drink", topic: "ITALIAN FOOD", emoji: "🍕", hint: "Popular Italian food" },
  { id: "u-0002", word: "DOLPHIN", scrambled: "PLNDOHI", length: 7, category: "Animals", topic: "OCEAN LIFE", emoji: "🐬", hint: "Smart marine animal" },
  { id: "u-0003", word: "GALAXY", scrambled: "XYAALG", length: 6, category: "Science", topic: "ASTRONOMY", emoji: "🌌", hint: "System of millions of stars" }
];

export class UnscrambleEngine {
  constructor() {
    this.words = wordList.length > 0 ? wordList : defaultWords;
    this.currentWordIndex = 0;
    this.round = 1;
    this.roundDurationSec = 45;
    this.customDurationSec = null;
    this.timerRemaining = 45;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    this.word = "DOLPHIN";
    this.scrambled = ["P", "L", "N", "D", "O", "H", "I"];
    this.scrambledString = "PLNDOHI";
    this.length = 7;
    this.category = "Animals";
    this.topic = "OCEAN LIFE";
    this.emoji = "🐬";
    this.hint = "Smart marine animal";
    this.hintRevealed = false;
    this.revealedLetters = []; // indices of revealed letters for hints

    this.isRevealed = false;
    this.statusMessage = "Press START to begin Unscramble! 🔤";
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();
    this.playedWordIndices = [];
    this.lengthFilter = "all"; // 'all' or 4, 5, 6, 7, 8, 9

    const startIdx = this.getRandomWordIndex();
    this.loadWordByIndex(startIdx, false);
  }

  normalizeString(str) {
    if (!str) return "";
    return String(str)
      .toUpperCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z]/g, "");
  }

  scrambleWord(word) {
    const letters = word.split("");
    let attempts = 0;
    let scrambled = word;
    while (scrambled === word && attempts < 30) {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      scrambled = letters.join("");
      attempts++;
    }
    return letters;
  }

  getRandomWordIndex() {
    if (!this.words || this.words.length === 0) return 0;

    let pool = [];
    for (let i = 0; i < this.words.length; i++) {
      const item = this.words[i];
      if (this.lengthFilter !== "all" && parseInt(this.lengthFilter, 10)) {
        if (item.length !== parseInt(this.lengthFilter, 10)) continue;
      }
      pool.push(i);
    }

    if (pool.length === 0) {
      pool = this.words.map((_, i) => i);
    }

    const playedSet = new Set(this.playedWordIndices);
    const unplayed = pool.filter(i => !playedSet.has(i));

    if (unplayed.length === 0) {
      this.playedWordIndices = [];
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      this.playedWordIndices.push(chosen);
      return chosen;
    }

    const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
    this.playedWordIndices.push(chosen);
    return chosen;
  }

  loadWordByIndex(index, startTimerNow = false) {
    if (this.words.length === 0) return;
    this.currentWordIndex = ((index % this.words.length) + this.words.length) % this.words.length;
    const w = this.words[this.currentWordIndex];

    this.word = String(w.word || "").toUpperCase();
    this.length = this.word.length;
    this.category = w.category || "General";
    this.topic = w.topic || "Puzzle";
    this.emoji = w.emoji || "🔤";
    this.hint = w.hint || `Topic: ${this.topic}`;
    this.wordId = w.id || `u-${this.currentWordIndex}`;

    // Generate scrambled letters
    this.scrambled = this.scrambleWord(this.word);
    this.scrambledString = this.scrambled.join("");

    this.hintRevealed = false;
    this.revealedLetters = [];
    this.isRevealed = false;
    this.roundWinners = [];

    if (this.customDurationSec && this.customDurationSec > 0) {
      this.roundDurationSec = this.customDurationSec;
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = startTimerNow;
    this.paused = false;

    this.statusMessage = `Round ${this.round}: Unscramble the ${this.length}-letter word in chat! 🔤`;
  }

  loadWordById(id) {
    const idx = this.words.findIndex((w) => w.id === id);
    if (idx !== -1) {
      this.loadWordByIndex(idx, true);
    }
    return this.getPublicPayload();
  }

  setLengthFilter(filter) {
    if (filter === "all" || [4, 5, 6, 7, 8, 9].includes(Number(filter))) {
      this.lengthFilter = filter === "all" ? "all" : Number(filter);
    }
    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    let nextIdx = this.getRandomWordIndex();
    if (options && options.id) {
      const foundIdx = this.words.findIndex((w) => w.id === options.id);
      if (foundIdx !== -1) nextIdx = foundIdx;
    }

    if (options && options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
      this.customDurationSec = Number(options.duration);
    }

    if (options && options.lengthFilter) {
      this.setLengthFilter(options.lengthFilter);
    }

    this.loadWordByIndex(nextIdx, true);
    return this.getPublicPayload();
  }

  prevRound() {
    this.round = Math.max(1, this.round - 1);
    const prevIdx = (this.currentWordIndex - 1 + this.words.length) % this.words.length;
    this.loadWordByIndex(prevIdx, false);
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
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Type the unscrambled word in chat!`;
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
    // If topic hint is not revealed, reveal topic hint
    // If topic hint is already revealed, reveal first letter of word
    if (!this.hintRevealed) {
      this.hintRevealed = true;
      this.statusMessage = `💡 Hint revealed: ${this.hint}`;
    } else if (this.revealedLetters.length === 0 && this.word.length > 0) {
      this.revealedLetters.push(0); // reveal first letter
      this.statusMessage = `💡 First letter revealed: "${this.word[0]}"`;
    } else if (this.revealedLetters.length === 1 && this.word.length > 4) {
      this.revealedLetters.push(this.word.length - 1); // reveal last letter
      this.statusMessage = `💡 Last letter revealed: "${this.word[this.word.length - 1]}"`;
    }
    return this.getPublicPayload();
  }

  reveal() {
    this.isRevealed = true;
    this.isTimerActive = false;
    this.statusMessage = `Word revealed: ${this.word}!`;
    return this.getPublicPayload();
  }

  processGuess(username, nickname, text, avatar = null) {
    if (!text || !this.isTimerActive || this.paused || this.isRevealed) {
      return { valid: false };
    }

    const cleanInput = String(text).trim();
    const normalizedInput = this.normalizeString(cleanInput);

    if (normalizedInput.length < 3) {
      return { valid: false };
    }

    // Check recent history
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

    // Check if chatter guessed the exact word or if the word is contained inside their sentence
    const isExactMatch = normalizedInput === this.word;
    const isWordIncluded = normalizedInput.length >= this.word.length && normalizedInput.includes(this.word);

    if (isExactMatch || isWordIncluded) {
      guessEntry.isCorrect = true;
      this.isRevealed = true;
      this.isTimerActive = false;
      this.streak++;

      // Points: base points based on length (4 = 15pts, 5 = 20pts, 6 = 25pts, 7 = 30pts, 8 = 35pts, 9 = 40pts) + speed bonus
      const basePoints = Math.max(10, this.length * 5);
      const speedBonus = Math.floor((this.timerRemaining / Math.max(1, this.roundDurationSec)) * 10);
      const totalPoints = basePoints + speedBonus;

      // Update leaderboard
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
        word: this.word,
        points: totalPoints,
        speedBonus
      };
      this.roundWinners = [winnerObj];

      this.statusMessage = `🎉 @${nickname || key} UNSCRAMBLED THE WORD: "${this.word}" (+${totalPoints} pts)!`;

      return {
        valid: true,
        isCorrect: true,
        word: this.word,
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

      // Automatic subtle hint when 15 seconds remain: reveal topic hint if still hidden
      if (this.timerRemaining === 15 && !this.hintRevealed) {
        this.hintRevealed = true;
      }

      if (this.timerRemaining <= 0) {
        this.isTimerActive = false;
        this.isRevealed = true;
        this.streak = 0;
        this.statusMessage = `⏰ Time expired! The word was "${this.word}".`;
        return {
          changed: true,
          timeExpired: true,
          word: this.word,
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
    this.playedWordIndices = [];
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard.clear();
    this.loadWordByIndex(this.getRandomWordIndex(), false);
    return this.getPublicPayload();
  }

  resetLeaderboard() {
    this.leaderboard.clear();
    return this.getPublicPayload();
  }

  importWordSet(payload) {
    if (!payload) return false;
    let list = [];
    if (Array.isArray(payload)) {
      list = payload;
    } else if (Array.isArray(payload.words)) {
      list = payload.words;
    }

    const clean = [];
    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      let w = "";
      let cat = "Custom";
      let hint = "";
      let emoji = "🔤";

      if (typeof item === "string") {
        w = item.trim().toUpperCase();
      } else if (typeof item === "object" && item.word) {
        w = String(item.word).trim().toUpperCase();
        cat = item.category || cat;
        hint = item.hint || hint;
        emoji = item.emoji || emoji;
      }

      if (w.length >= 4 && w.length <= 9 && /^[A-Z]+$/.test(w)) {
        clean.push({
          id: `u-custom-${Date.now()}-${idx}`,
          word: w,
          length: w.length,
          category: cat,
          topic: w,
          emoji,
          hint: hint || `Length: ${w.length} letters`
        });
      }
    }

    if (clean.length > 0) {
      this.words = clean;
      this.playedWordIndices = [];
      this.loadWordByIndex(0, false);
      return { ok: true, count: clean.length };
    }
    return { ok: false, error: "No valid 4-9 letter words found" };
  }

  getPublicPayload() {
    // Construct masked slots for viewers:
    // If not revealed: array of null or revealed letter characters for hints
    const slots = [];
    for (let i = 0; i < this.word.length; i++) {
      if (this.isRevealed) {
        slots.push(this.word[i]);
      } else if (this.revealedLetters.includes(i)) {
        slots.push(this.word[i]);
      } else {
        slots.push("");
      }
    }

    return {
      gameId: "unscramble",
      round: this.round,
      time: this.timerRemaining,
      roundDurationSec: this.roundDurationSec,
      active: this.isTimerActive,
      isTimerActive: this.isTimerActive,
      paused: this.paused,
      streak: this.streak,
      length: this.length,
      category: this.category,
      topic: this.topic,
      emoji: this.emoji,
      hint: this.hintRevealed ? this.hint : null,
      hintRevealed: this.hintRevealed,
      scrambled: this.scrambled, // array of letters e.g. ["P", "L", "N", "D", "O", "H", "I"]
      scrambledString: this.scrambledString,
      slots, // e.g. ["", "", "", ""] or ["D", "", "", ""] or revealed
      wordId: this.wordId,
      word: this.isRevealed ? this.word : null, // keep secret until revealed!
      isRevealed: this.isRevealed,
      statusMessage: this.statusMessage,
      roundWinners: this.roundWinners,
      guesses: this.guesses.slice(0, 10),
      totalWordsCount: this.words.length,
      lengthFilter: this.lengthFilter
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretWord: this.word, // Host always sees secret word!
      secretScrambled: this.scrambledString,
      secretHint: this.hint,
      wordsListPreview: this.words.slice(0, 100).map(w => ({ id: w.id, word: w.word, length: w.length, emoji: w.emoji, category: w.category })),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
