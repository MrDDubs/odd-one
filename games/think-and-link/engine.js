// games/think-and-link/engine.js (ESM)
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
  console.warn("[ThinkAndLink] Could not load puzzles.json:", err.message);
}

// Fallback puzzle if puzzles.json is empty
const defaultPuzzles = [
  { id: "p-1", topic: "PIZZA", emoji: "🍕", category: "Food & Drink", words: ["CHEESE", "PEPPERONI", "CRUST", "TOPPING", "OVEN", "SLICE"] },
  { id: "p-2", topic: "BEACH", emoji: "🏖️", category: "Places & Travel", words: ["SAND", "SUNSHINE", "OCEAN", "TOWEL", "SEASHELL", "WAVES"] },
  { id: "p-3", topic: "CINEMA", emoji: "🍿", category: "Entertainment", words: ["POPCORN", "MOVIE", "SCREEN", "TICKET", "ACTOR", "TRAILER"] }
];

export class ThinkAndLinkEngine {
  constructor() {
    this.puzzles = puzzleList.length > 0 ? puzzleList : defaultPuzzles;
    this.currentPuzzleIndex = 0;
    this.round = 1;
    this.pointsPerWord = 4;
    this.roundDurationSec = 30;
    this.timerRemaining = 30;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    this.topic = "PIZZA";
    this.emoji = "🍕";
    this.category = "Food & Drink";
    this.puzzleId = "p-1";

    this.slots = [];
    this.foundCount = 0;
    this.totalWords = 6;
    this.allFound = false;

    this.statusMessage = "Press START to begin Think & Link!";
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();

    this.loadPuzzleByIndex(0, false);
  }

  generateHint(word, revealedLettersCount = 1) {
    const clean = String(word || "").trim().toUpperCase();
    if (!clean) return "_";

    const chars = clean.split("");
    const letterIndices = [];
    chars.forEach((ch, idx) => {
      if (/[A-Z0-9]/.test(ch)) {
        letterIndices.push(idx);
      }
    });

    // Leave at least the last letter hidden for viewers to guess
    const maxReveal = Math.max(1, letterIndices.length - 1);
    const countToReveal = Math.min(Math.max(1, revealedLettersCount), maxReveal);

    const revealedSet = new Set(letterIndices.slice(0, countToReveal));

    return chars
      .map((ch, idx) => {
        if (!/[A-Z0-9]/.test(ch)) return ch;
        return revealedSet.has(idx) ? ch : "_";
      })
      .join(" ");
  }

  loadPuzzleByIndex(index, startTimerNow = false) {
    if (this.puzzles.length === 0) return;
    this.currentPuzzleIndex = ((index % this.puzzles.length) + this.puzzles.length) % this.puzzles.length;
    const p = this.puzzles[this.currentPuzzleIndex];

    this.puzzleId = p.id || `p-${this.currentPuzzleIndex + 1}`;
    this.topic = p.topic || "TOPIC";
    this.emoji = p.emoji || "💜";
    this.category = p.category || "General";
    this.elapsedSeconds = 0;

    const wordList = Array.isArray(p.words) ? p.words.slice(0, 6) : [];
    while (wordList.length < 6) {
      wordList.push(`WORD${wordList.length + 1}`);
    }

    this.slots = wordList.map((w, idx) => {
      const cleanW = String(w).trim().toUpperCase();
      return {
        index: idx,
        word: cleanW,
        revealedLetters: 1,
        hint: this.generateHint(cleanW, 1),
        revealed: false,
        foundBy: null,
        points: this.pointsPerWord
      };
    });

    this.foundCount = 0;
    this.totalWords = 6;
    this.allFound = false;
    this.roundWinners = [];
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = startTimerNow;
    this.paused = false;
    this.statusMessage = `Topic: ${this.topic} ${this.emoji} — Guess the 6 words in chat!`;

    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    this.paused = false;

    if (options.topic && Array.isArray(options.words) && options.words.length >= 6) {
      this.setCustomPuzzle(options);
    } else {
      this.advancePuzzle();
    }

    if (options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
    }

    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.statusMessage = `Round ${this.round}: ${this.topic} ${this.emoji} — Type your guesses! 💜`;

    return this.getPublicPayload();
  }

  prevRound(options = {}) {
    this.round = Math.max(1, this.round - 1);
    this.loadPuzzleByIndex(this.currentPuzzleIndex - 1, true);
    if (options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
      this.timerRemaining = this.roundDurationSec;
    }
    this.statusMessage = `Round ${this.round}: ${this.topic} ${this.emoji} — Type your guesses! 💜`;
    return this.getPublicPayload();
  }

  adjustTime(delta) {
    const d = typeof delta === "object" ? delta.delta : delta;
    const num = parseInt(d, 10) || 0;
    this.timerRemaining = Math.max(1, this.timerRemaining + num);
    return this.getPublicPayload();
  }

  setTime(sec) {
    const s = typeof sec === "object" ? sec.sec : sec;
    const num = parseInt(s, 10);
    if (num > 0) {
      this.timerRemaining = num;
      this.roundDurationSec = num;
    }
    return this.getPublicPayload();
  }

  hint() {
    let revealedExtra = false;
    this.slots.forEach((s) => {
      if (!s.revealed) {
        const nextCount = (s.revealedLetters || 1) + 1;
        const newHint = this.generateHint(s.word, nextCount);
        if (newHint !== s.hint) {
          s.revealedLetters = nextCount;
          s.hint = newHint;
          revealedExtra = true;
        }
      }
    });

    if (revealedExtra) {
      this.statusMessage = "💡 Extra letter hint revealed!";
    } else {
      // If letters are already maximally revealed, reveal the first unsolved slot completely
      const unsolved = this.slots.find((s) => !s.revealed);
      if (unsolved) {
        this.revealSlot(unsolved.index);
      } else {
        this.statusMessage = "💡 All words already revealed!";
      }
    }
    return this.getPublicPayload();
  }

  advancePuzzle() {
    return this.loadPuzzleByIndex(this.currentPuzzleIndex + 1, true);
  }

  loadPuzzleById(id) {
    const idx = this.puzzles.findIndex((p) => p.id === id);
    if (idx !== -1) {
      return this.loadPuzzleByIndex(idx, this.isTimerActive);
    }
    return this.getPublicPayload();
  }

  setCustomPuzzle({ topic, emoji, category, words, duration }) {
    if (!topic || !words || !Array.isArray(words)) return this.getPublicPayload();

    this.topic = String(topic).trim().toUpperCase();
    this.emoji = emoji ? String(emoji).trim() : "💜";
    this.category = category ? String(category).trim() : "Custom";
    this.puzzleId = `custom-${Date.now()}`;
    this.elapsedSeconds = 0;

    const wordList = words.slice(0, 6);
    while (wordList.length < 6) {
      wordList.push(`WORD${wordList.length + 1}`);
    }

    this.slots = wordList.map((w, idx) => {
      const cleanW = String(w).trim().toUpperCase();
      return {
        index: idx,
        word: cleanW,
        revealedLetters: 1,
        hint: this.generateHint(cleanW, 1),
        revealed: false,
        foundBy: null,
        points: this.pointsPerWord
      };
    });

    this.foundCount = 0;
    this.totalWords = 6;
    this.allFound = false;
    this.roundWinners = [];
    if (duration && Number(duration) > 0) {
      this.roundDurationSec = Number(duration);
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.statusMessage = `Custom Topic: ${this.topic} ${this.emoji}`;

    return this.getPublicPayload();
  }

  startTimer(seconds = null) {
    if (seconds && Number(seconds) > 0) {
      this.roundDurationSec = Number(seconds);
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.paused = false;
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Guess 6 associated words!`;
    return this.getPublicPayload();
  }

  stopTimer() {
    this.isTimerActive = false;
    this.paused = true;
    this.statusMessage = "Timer paused";
    return this.getPublicPayload();
  }

  revealSlot(slotIndex) {
    const idx = parseInt(slotIndex, 10);
    if (idx >= 0 && idx < this.slots.length) {
      const slot = this.slots[idx];
      if (!slot.revealed) {
        slot.revealed = true;
        this.foundCount++;
        if (this.foundCount >= this.totalWords) {
          this.allFound = true;
          this.isTimerActive = false;
          this.streak++;
          this.statusMessage = `🎉 All 6 words found! Community streak: 🔥 ${this.streak}`;
        } else {
          this.statusMessage = `Revealed: "${slot.word}" (${this.foundCount}/${this.totalWords})`;
        }
      }
    }
    return this.getPublicPayload();
  }

  reveal() {
    // Reveal all remaining unrevealed slots
    this.slots.forEach((s) => {
      s.revealed = true;
    });
    this.isTimerActive = false;
    this.statusMessage = `All words revealed for "${this.topic}"`;
    return this.getPublicPayload();
  }

  hideAnswer() {
    // Re-hide all slots that weren't found by viewers
    this.slots.forEach((s) => {
      if (!s.foundBy) {
        s.revealed = false;
      }
    });
    this.statusMessage = "Unsolved words hidden";
    return this.getPublicPayload();
  }

  setPaused(pause) {
    this.paused = !!pause;
    return this.getPublicPayload();
  }

  tick() {
    if (!this.isTimerActive || this.paused) return { changed: false, timeExpired: false };
    this.elapsedSeconds = (this.elapsedSeconds || 0) + 1;
    this.timerRemaining--;

    // Start revealing letters of unsolved words after 5 seconds:
    // At elapsedSeconds = 5, reveal 2nd letter.
    // Every 4 seconds afterwards (9s, 13s, 17s, 21s, etc.), reveal an additional letter!
    if (this.elapsedSeconds >= 5 && (this.elapsedSeconds - 5) % 4 === 0) {
      this.slots.forEach((s) => {
        if (!s.revealed) {
          s.revealedLetters = (s.revealedLetters || 1) + 1;
          s.hint = this.generateHint(s.word, s.revealedLetters);
        }
      });
    }

    if (this.timerRemaining <= 0) {
      this.timerRemaining = 0;
      this.isTimerActive = false;

      // Reveal all remaining words on time expiration
      this.slots.forEach((s) => {
        s.revealed = true;
      });

      const wasPerfect = this.foundCount === this.totalWords;
      if (!wasPerfect) {
        this.streak = 0; // reset streak if puzzle not completed
        this.statusMessage = `⏰ Time's up! Found ${this.foundCount}/6 words.`;
      } else {
        this.statusMessage = `⏰ Time's up! Perfect round! Streak: 🔥 ${this.streak}`;
      }

      return {
        changed: true,
        timeExpired: true,
        allFound: this.allFound,
        foundCount: this.foundCount,
        streak: this.streak,
        roundWinners: this.roundWinners
      };
    }

    return { changed: true, timeExpired: false };
  }

  normalizeString(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  processGuess(user, nickname, message, avatar = null) {
    const cleanUser = user || "viewer";
    const cleanNick = nickname || cleanUser;
    const cleanMsg = String(message || "").trim();
    if (!cleanMsg) return { valid: false };

    const normGuess = this.normalizeString(cleanMsg);
    if (!normGuess) return { valid: false };

    // Find any unrevealed slot that matches the normalized guess
    let matchedSlotIndex = -1;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.revealed) {
        const normWord = this.normalizeString(slot.word);
        if (normGuess === normWord || normGuess.includes(normWord)) {
          matchedSlotIndex = i;
          break;
        }
      }
    }

    const isCorrect = this.isTimerActive && matchedSlotIndex !== -1;

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
      const slot = this.slots[matchedSlotIndex];
      slot.revealed = true;
      const pointsAwarded = this.pointsPerWord;
      this.foundCount++;

      const winnerData = {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        code: slot.word,
        word: slot.word,
        slotIndex: matchedSlotIndex,
        place: this.foundCount,
        points: pointsAwarded,
        timestamp: Date.now()
      };

      slot.foundBy = winnerData;
      this.roundWinners.push(winnerData);

      // Update community leaderboard
      const existing = this.leaderboard.get(cleanUser) || {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        score: 0,
        wordsFound: 0,
        puzzlesCleared: 0
      };
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
        this.statusMessage = `🎉 All 6 words found! Last word "${slot.word}" by @${cleanNick}! Streak: 🔥 ${this.streak}`;
      } else {
        this.statusMessage = `🎯 @${cleanNick} found "${slot.word}"! (+${pointsAwarded}💜) [${this.foundCount}/${this.totalWords}]`;
      }

      this.leaderboard.set(cleanUser, existing);

      return {
        valid: true,
        isCorrect: true,
        slotIndex: matchedSlotIndex,
        word: slot.word,
        winner: winnerData,
        place: this.foundCount,
        foundCount: this.foundCount,
        totalWords: this.totalWords,
        allFound: this.allFound,
        roundComplete: this.allFound,
        streak: this.streak,
        newStreak: this.streak,
        points: pointsAwarded,
        roundWinners: this.roundWinners,
        guessItem
      };
    }

    return {
      valid: true,
      isCorrect: false,
      guessItem
    };
  }

  getLeaderboard(limit = 10) {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.score - a.score || b.wordsFound - a.wordsFound || a.lastWonAt - b.lastWonAt)
      .slice(0, limit);
  }

  resetLeaderboard() {
    this.leaderboard.clear();
  }

  resetGame() {
    this.round = 1;
    this.streak = 0;
    this.currentPuzzleIndex = 0;
    this.roundWinners = [];
    this.guesses = [];
    this.loadPuzzleByIndex(0, false);
    return this.getPublicPayload();
  }

  getPuzzlesList() {
    return this.puzzles.map((p, idx) => ({
      index: idx,
      id: p.id,
      topic: p.topic,
      emoji: p.emoji,
      category: p.category,
      words: p.words
    }));
  }

  getPublicPayload() {
    return {
      gameId: "think-and-link",
      round: this.round,
      topic: this.topic,
      emoji: this.emoji,
      category: this.category,
      puzzleId: this.puzzleId,
      slots: this.slots.map((s) => ({
        index: s.index,
        hint: s.hint,
        revealed: s.revealed,
        word: s.revealed ? s.word : null,
        foundBy: s.foundBy,
        points: s.points
      })),
      foundCount: this.foundCount,
      totalWords: this.totalWords,
      allFound: this.allFound,
      streak: this.streak,
      time: this.timerRemaining,
      timerRemaining: this.timerRemaining,
      roundDurationSec: this.roundDurationSec,
      isTimerActive: this.isTimerActive,
      paused: this.paused,
      pointsPerWord: this.pointsPerWord,
      roundWinners: this.roundWinners,
      statusMessage: this.statusMessage,
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretSlots: this.slots,
      puzzles: this.getPuzzlesList(),
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
