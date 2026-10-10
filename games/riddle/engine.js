// games/riddle/engine.js (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const riddlesPath = path.join(__dirname, "riddles.json");

let riddlesList = [];
try {
  if (fs.existsSync(riddlesPath)) {
    const raw = fs.readFileSync(riddlesPath, "utf8");
    riddlesList = JSON.parse(raw);
  }
} catch (err) {
  console.warn("[RiddleEngine] Could not load riddles.json:", err.message);
}

// Fallback if riddles.json is missing or empty
const defaultRiddles = [
  {
    id: "rid-0001",
    riddle: "What has to be broken before you can use it?",
    answer: "Egg",
    synonyms: ["egg", "eggs", "an egg"],
    category: "Classic Riddles",
    difficulty: "Easy",
    hint: "You find it in the refrigerator or breakfast menu",
    emoji: "🥚"
  }
];

export class RiddleEngine {
  constructor() {
    this.riddles = riddlesList.length > 0 ? riddlesList : defaultRiddles;
    this.currentRiddleIndex = 0;
    this.round = 1;
    this.roundDurationSec = 45;
    this.customDurationSec = null;
    this.timerRemaining = 45;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    // Filters
    this.categoryFilter = "all";
    this.difficultyFilter = "all";

    // Round State
    this.currentRiddle = this.riddles[0];
    this.isRevealed = false;
    this.clueRevealed = false;
    this.revealedLetterIndices = [];

    // Multi-Winner 5-Second Grace Window
    this.winners = []; // [{ place: 1, user, nickname, avatar, points: 100, timestamp }]
    this.roundWinners = this.winners;
    this.gracePeriodActive = false;
    this.graceRemainingSec = 0;
    this.firstSolvedTimestamp = null;

    // Guess history & Leaderboard
    this.guesses = [];
    this.leaderboard = new Map();
    this.playedIndices = [];

    // Progressive Hint Auto Trigger tracking
    this.lastProgressiveHintSec = null;

    // Load initial riddle
    const startIdx = this.getRandomRiddleIndex();
    this.loadRiddleByIndex(startIdx, false);
  }

  normalizeString(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  initLetterIndices(answerText) {
    this.revealedLetterIndices = [];
    if (!answerText) return;

    // Reveal the first alphanumeric letter of each word
    const words = answerText.split(" ");
    let currIdx = 0;
    words.forEach((w) => {
      if (w.length > 0) {
        for (let j = 0; j < w.length; j++) {
          if (/[a-zA-Z0-9]/.test(w[j])) {
            this.revealedLetterIndices.push(currIdx + j);
            break;
          }
        }
      }
      currIdx += w.length + 1;
    });
  }

  getMaskedAnswer() {
    if (!this.currentRiddle || !this.currentRiddle.answer) return "";
    if (this.isRevealed) return this.currentRiddle.answer;

    const chars = this.currentRiddle.answer.split("");
    return chars
      .map((ch, i) => {
        if (!/[a-zA-Z0-9]/.test(ch)) return ch;
        if (this.revealedLetterIndices.includes(i)) return ch;
        return "_";
      })
      .join("");
  }

  revealRandomLetter() {
    if (!this.currentRiddle || this.isRevealed) return false;
    const answer = this.currentRiddle.answer;
    const unrevealed = [];

    for (let i = 0; i < answer.length; i++) {
      if (/[a-zA-Z0-9]/.test(answer[i]) && !this.revealedLetterIndices.includes(i)) {
        unrevealed.push(i);
      }
    }

    // Keep at least 1 letter hidden so chat must still guess it
    if (unrevealed.length > 1) {
      const chosen = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      this.revealedLetterIndices.push(chosen);
      return true;
    }
    return false;
  }

  getFilteredPool() {
    return this.riddles.filter((r) => {
      if (this.categoryFilter !== "all" && r.category !== this.categoryFilter) return false;
      if (this.difficultyFilter !== "all" && r.difficulty !== this.difficultyFilter) return false;
      return true;
    });
  }

  getRandomRiddleIndex() {
    const pool = this.getFilteredPool();
    if (pool.length === 0) return 0;

    const playedSet = new Set(this.playedIndices);
    const unplayed = pool.filter((r) => !playedSet.has(r.id));
    const targetPool = unplayed.length > 0 ? unplayed : pool;

    if (unplayed.length === 0) {
      this.playedIndices = [];
    }

    const chosen = targetPool[Math.floor(Math.random() * targetPool.length)];
    const fullIdx = this.riddles.findIndex((r) => r.id === chosen.id);
    return fullIdx !== -1 ? fullIdx : 0;
  }

  loadRiddleByIndex(index, startTimerNow = false) {
    if (!this.riddles || this.riddles.length === 0) return;
    this.currentRiddleIndex = ((index % this.riddles.length) + this.riddles.length) % this.riddles.length;
    this.currentRiddle = this.riddles[this.currentRiddleIndex];

    if (!this.playedIndices.includes(this.currentRiddle.id)) {
      this.playedIndices.push(this.currentRiddle.id);
    }

    this.isRevealed = false;
    this.clueRevealed = false;
    this.winners = [];
    this.roundWinners = this.winners;
    this.gracePeriodActive = false;
    this.graceRemainingSec = 0;
    this.firstSolvedTimestamp = null;
    this.lastProgressiveHintSec = null;

    this.initLetterIndices(this.currentRiddle.answer);

    const dur = this.customDurationSec || 45;
    this.roundDurationSec = dur;
    this.timerRemaining = dur;
    this.isTimerActive = !!startTimerNow;
    this.paused = !startTimerNow;

    this.statusMessage = startTimerNow
      ? `🧙‍♂️ Riddle #${this.currentRiddle.id} started! Solve in chat!`
      : `Ready: Round ${this.round}`;
  }

  loadRiddleById(id, startTimerNow = false) {
    const foundIdx = this.riddles.findIndex((r) => r.id === id);
    if (foundIdx !== -1) {
      this.loadRiddleByIndex(foundIdx, startTimerNow);
    }
    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    let nextIdx = this.getRandomRiddleIndex();
    if (options && options.id) {
      const foundIdx = this.riddles.findIndex((r) => r.id === options.id);
      if (foundIdx !== -1) nextIdx = foundIdx;
    }
    if (options && options.duration && Number(options.duration) > 0) {
      this.customDurationSec = Number(options.duration);
    }
    this.loadRiddleByIndex(nextIdx, true);
    return this.getPublicPayload();
  }

  nextRound() {
    return this.newRound();
  }

  prevRound() {
    this.round = Math.max(1, this.round - 1);
    const prevIdx = (this.currentRiddleIndex - 1 + this.riddles.length) % this.riddles.length;
    this.loadRiddleByIndex(prevIdx, false);
    return this.getPublicPayload();
  }

  startRound(options = {}) {
    if (!this.isTimerActive && !this.isRevealed) {
      return this.startTimer(options);
    }
    return this.newRound(options);
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
    this.isRevealed = false;
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Solve the riddle in chat!`;
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
    let changed = false;
    // Reveal a letter
    if (this.revealRandomLetter()) {
      changed = true;
      this.statusMessage = "💡 Hint: Another letter revealed!";
    } else if (!this.clueRevealed) {
      this.clueRevealed = true;
      changed = true;
      this.statusMessage = `💡 Clue revealed: "${this.currentRiddle.hint}"`;
    }
    return this.getPublicPayload();
  }

  toggleClue() {
    this.clueRevealed = !this.clueRevealed;
    this.statusMessage = this.clueRevealed
      ? `💡 Clue: "${this.currentRiddle.hint}"`
      : "Clue hidden";
    return this.getPublicPayload();
  }

  revealAnswer() {
    this.isRevealed = true;
    this.clueRevealed = true;
    this.isTimerActive = false;
    this.gracePeriodActive = false;
    this.graceRemainingSec = 0;
    this.streak = 0; // Reset streak if host had to reveal without winners
    this.statusMessage = `Answer Revealed: "${this.currentRiddle.answer}"!`;
    return this.getPublicPayload();
  }

  reveal() {
    return this.revealAnswer();
  }

  resetGame() {
    this.round = 1;
    this.streak = 0;
    this.leaderboard.clear();
    this.playedIndices = [];
    this.loadRiddleByIndex(this.getRandomRiddleIndex(), false);
    this.statusMessage = "Game reset to Round 1";
    return this.getPublicPayload();
  }

  setCategoryFilter(cat) {
    this.categoryFilter = cat || "all";
    return this.getPublicPayload();
  }

  setDifficultyFilter(diff) {
    this.difficultyFilter = diff || "all";
    return this.getPublicPayload();
  }

  tick() {
    // 1. Multi-Winner Grace Window Countdown
    if (this.gracePeriodActive) {
      this.graceRemainingSec--;

      if (this.graceRemainingSec <= 0) {
        // Grace period expired! Finish the round and crown winners
        this.gracePeriodActive = false;
        this.isRevealed = true;
        this.isTimerActive = false;

        const count = this.winners.length;
        const topUser = this.winners[0]?.nickname || "Chat";
        this.statusMessage = count === 1
          ? `🏆 @${topUser} won Round ${this.round}! (+100 pts)`
          : `🏆 @${topUser} won 1st (+100 pts) and ${count - 1} bonus solver${count > 2 ? 's' : ''} (+50 pts)!`;

        return {
          changed: true,
          timeExpired: true,
          target: this.currentRiddle.answer,
          hadWinners: this.winners.length > 0,
          roundWinners: this.winners
        };
      }
      return { changed: true, timeExpired: false };
    }

    // 2. Normal Round Timer Countdown
    if (this.isTimerActive && !this.paused && this.timerRemaining > 0) {
      this.timerRemaining--;

      // Progressive letter reveals:
      // When 20s remaining, reveal a letter
      if (this.timerRemaining === 20 && this.lastProgressiveHintSec !== 20) {
        this.lastProgressiveHintSec = 20;
        this.revealRandomLetter();
      }
      // When 10s remaining, reveal clue and another letter
      if (this.timerRemaining === 10 && this.lastProgressiveHintSec !== 10) {
        this.lastProgressiveHintSec = 10;
        this.clueRevealed = true;
        this.revealRandomLetter();
      }

      if (this.timerRemaining <= 0) {
        this.isTimerActive = false;
        this.isRevealed = true;
        this.streak = 0;
        this.statusMessage = `⏰ Time's Up! The answer was "${this.currentRiddle.answer}".`;
        return {
          changed: true,
          timeExpired: true,
          target: this.currentRiddle.answer,
          hadWinners: this.winners.length > 0,
          roundWinners: this.winners
        };
      }
      return { changed: true, timeExpired: false };
    }

    return { changed: false, timeExpired: false };
  }

  processGuess(username, nickname, text, avatar = null) {
    if (!text || (!this.isTimerActive && !this.gracePeriodActive) || this.paused || this.isRevealed) {
      return { valid: false };
    }

    const cleanInput = String(text).trim();
    const normalizedInput = this.normalizeString(cleanInput);
    if (normalizedInput.length < 2) {
      return { valid: false };
    }

    // Check if user already won this round
    const userKey = username || "Viewer";
    const alreadyWon = this.winners.some((w) => w.user.toLowerCase() === userKey.toLowerCase());

    const guessEntry = {
      username: userKey,
      nickname: nickname || userKey,
      text: cleanInput,
      timestamp: Date.now(),
      isCorrect: false,
      avatar: avatar || null
    };
    this.guesses.unshift(guessEntry);
    if (this.guesses.length > 50) this.guesses.pop();

    if (alreadyWon) {
      return { valid: true, isCorrect: false, alreadyWon: true, guessItem: guessEntry };
    }

    // Compare with current riddle answer and synonyms
    const r = this.currentRiddle;
    let isMatch = false;

    // Check exact & synonym match
    const normAnswer = this.normalizeString(r.answer);
    if (normalizedInput === normAnswer) {
      isMatch = true;
    } else {
      for (const syn of r.synonyms) {
        const normSyn = this.normalizeString(syn);
        if (normalizedInput === normSyn) {
          isMatch = true;
          break;
        }
        // Substring / keyword match for multi-word answers
        if (normSyn.length >= 4 && (normalizedInput.includes(normSyn) || normSyn.includes(normalizedInput))) {
          isMatch = true;
          break;
        }
      }
    }

    if (!isMatch) {
      return { valid: true, isCorrect: false, guessItem: guessEntry };
    }

    // Correct Guess!
    guessEntry.isCorrect = true;
    const now = Date.now();

    let place = 1;
    let pts = 100; // 1st Place gets 100 PTS

    if (!this.gracePeriodActive && this.winners.length === 0) {
      // 🥇 1ST PLACE WINNER!
      place = 1;
      pts = 100;
      this.streak++;
      this.firstSolvedTimestamp = now;

      // Start 5-Second Speed Grace Window for bonus solvers!
      this.gracePeriodActive = true;
      this.graceRemainingSec = 5;

      this.statusMessage = `🎉 @${nickname || userKey} solved it 1st (+100 pts)! 5s SPEED WINDOW OPEN FOR BONUS WINNERS!`;
    } else if (this.gracePeriodActive) {
      // 🥈 BONUS SOLVER (within 5 seconds from 1st answer)
      place = this.winners.length + 1;
      pts = 50; // Subsequent solvers get 50 PTS
      this.statusMessage = `⚡ @${nickname || userKey} also solved it (+50 pts)!`;
    }

    const winnerItem = {
      place,
      user: userKey,
      nickname: nickname || userKey,
      avatar: avatar || null,
      points: pts,
      timestamp: now,
      timeFromFirstMs: this.firstSolvedTimestamp ? now - this.firstSolvedTimestamp : 0
    };
    this.winners.push(winnerItem);

    // Update Player Leaderboard
    const currentScore = this.leaderboard.get(userKey) || {
      username: userKey,
      nickname: nickname || userKey,
      score: 0,
      avatar: avatar || null,
      wins: 0
    };
    currentScore.score += pts;
    currentScore.wins += 1;
    if (avatar) currentScore.avatar = avatar;
    this.leaderboard.set(userKey, currentScore);

    return {
      valid: true,
      isCorrect: true,
      place,
      points: pts,
      graceActive: this.gracePeriodActive,
      graceRemainingSec: this.graceRemainingSec,
      winner: winnerItem,
      guessItem: guessEntry
    };
  }

  getPublicPayload() {
    const sortedLeaderboard = Array.from(this.leaderboard.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      gameId: "riddle",
      round: this.round,
      riddleId: this.currentRiddle ? this.currentRiddle.id : "",
      riddle: this.currentRiddle ? this.currentRiddle.riddle : "",
      category: this.currentRiddle ? this.currentRiddle.category : "Classic Riddles",
      difficulty: this.currentRiddle ? this.currentRiddle.difficulty : "Easy",
      emoji: this.currentRiddle ? this.currentRiddle.emoji : "🧙‍♂️",
      maskedAnswer: this.getMaskedAnswer(),
      answerLength: this.currentRiddle ? this.currentRiddle.answer.length : 0,

      // Host / Solved State
      isRevealed: this.isRevealed,
      secretAnswer: this.currentRiddle ? this.currentRiddle.answer : "",
      answer: this.isRevealed ? (this.currentRiddle ? this.currentRiddle.answer : "") : "",
      clueRevealed: this.clueRevealed,
      secretHint: this.currentRiddle ? this.currentRiddle.hint : "",
      clue: this.clueRevealed ? (this.currentRiddle ? this.currentRiddle.hint : "") : "",

      // Timer & 5-Second Grace Period
      timerRemaining: this.timerRemaining,
      time: this.timerRemaining,
      roundDuration: this.roundDurationSec,
      roundDurationSec: this.roundDurationSec,
      isTimerActive: this.isTimerActive,
      active: this.isTimerActive,
      paused: this.paused,
      gracePeriodActive: this.gracePeriodActive,
      graceRemainingSec: this.graceRemainingSec,

      // Multi-Winners
      winners: this.winners,
      roundWinners: this.winners,
      winnerCount: this.winners.length,
      lastWinner: this.winners.length > 0 ? this.winners[0] : null,

      // Metadata
      streak: this.streak,
      statusMessage: this.statusMessage || "",
      leaderboard: sortedLeaderboard,
      recentGuesses: this.guesses.slice(0, 8),

      // Filters
      categoryFilter: this.categoryFilter,
      difficultyFilter: this.difficultyFilter,
      riddlesListPreview: this.riddles.map((rd) => ({
        id: rd.id,
        answer: rd.answer,
        category: rd.category,
        difficulty: rd.difficulty,
        emoji: rd.emoji,
        riddle: rd.riddle
      }))
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretAnswer: this.currentRiddle ? this.currentRiddle.answer : "",
      secretHint: this.currentRiddle ? this.currentRiddle.hint : "",
      secretClue: this.currentRiddle ? this.currentRiddle.hint : "",
      clue: this.currentRiddle ? this.currentRiddle.hint : "",
      answer: this.currentRiddle ? this.currentRiddle.answer : ""
    };
  }

  handleAction(action, options = {}) {
    switch (action) {
      case "startTimer":
        return this.startTimer(options);
      case "stopTimer":
        return this.stopTimer();
      case "setTime":
        return this.setTime(options);
      case "adjustTime":
        return this.adjustTime(options);
      case "setPaused":
        return this.setPaused(options);
      case "nextRound":
      case "newRound":
        return this.newRound(options);
      case "prevRound":
        return this.prevRound();
      case "revealAnswer":
        return this.revealAnswer();
      case "hint":
        return this.hint();
      case "toggleClue":
        return this.toggleClue();
      case "resetGame":
        return this.resetGame();
      case "setCategoryFilter":
        return this.setCategoryFilter(options);
      case "setDifficultyFilter":
        return this.setDifficultyFilter(options);
      case "loadRiddleById":
        return this.loadRiddleById(options.id || options, true);
      default:
        console.warn(`[RiddleEngine] Unknown action: ${action}`);
        return this.getPublicPayload();
    }
  }
}
