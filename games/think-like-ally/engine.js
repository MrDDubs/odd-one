// games/think-like-ally/engine.js (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.join(__dirname, "questions.json");

let questionSets = [];
try {
  if (fs.existsSync(questionsPath)) {
    const raw = fs.readFileSync(questionsPath, "utf8");
    questionSets = JSON.parse(raw);
  }
} catch (err) {
  console.warn("[ThinkLikeAlly] Could not load questions.json:", err.message);
}

// Fallback questions if questions.json is empty
const defaultQuestions = [
  { question: "Name a pizza topping", answer: "pineapple", icon: "🍕", type: "open" },
  { question: "Name a fast-food restaurant", answer: "kfc", icon: "🍔", type: "open" },
  { question: "Name a chocolate bar", answer: "kitkat", icon: "🍫", type: "open" },
  { question: "Name an ice-cream flavour", answer: "choc mint", icon: "🍦", type: "open" },
  { question: "Name a fruit", answer: "lychee", icon: "🍓", type: "open" }
];

export class ThinkLikeAllyEngine {
  constructor() {
    this.round = 1;
    this.maxRounds = 5;
    this.currentSetIndex = 0;
    this.currentQuestionIndex = 0;

    this.question = "Name a pizza topping";
    this.allyAnswer = "pineapple";
    this.questionIcon = "🍕";
    this.questionType = "open";
    this.options = [];

    this.timerRemaining = 15;
    this.roundDurationSec = 15;
    this.isTimerActive = false;
    this.isAnswerRevealed = false;
    this.paused = false;

    this.statusMessage = "Press START to start the timer!";
    this.streak = 0;
    this.guessedThisRound = new Set();
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();

    this.initFirstQuestion();
  }

  initFirstQuestion() {
    if (questionSets.length > 0 && questionSets[0].questions?.length > 0) {
      const q = questionSets[0].questions[0];
      this.question = q.question;
      this.allyAnswer = q.answer;
      this.questionIcon = q.icon || "💡";
      this.questionType = q.type || "open";
      this.options = q.options || [];
    }
  }

  getQuestionSets() {
    return questionSets.map((s) => ({
      id: s.id,
      name: s.name,
      count: s.questions?.length || 0
    }));
  }

  newRound(options = {}) {
    this.round++;
    this.isAnswerRevealed = false;
    this.roundWinners = [];
    this.guessedThisRound.clear();
    this.paused = false;

    // Load custom question or advance pack
    if (options.question && options.answer) {
      this.question = options.question;
      this.allyAnswer = options.answer;
      this.questionIcon = options.icon || "💡";
      this.questionType = options.type || "open";
      this.options = options.options || [];
    } else {
      this.advanceQuestion();
    }

    this.roundDurationSec = options.duration ? parseInt(options.duration, 10) : 15;
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.statusMessage = `Round ${this.round}: Guess what Ally is thinking! 💬`;

    return this.getPublicPayload();
  }

  advanceQuestion() {
    if (questionSets.length === 0) {
      const rand = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)];
      this.question = rand.question;
      this.allyAnswer = rand.answer;
      this.questionIcon = rand.icon || "💡";
      this.questionType = rand.type || "open";
      this.options = rand.options || [];
      return;
    }

    const currentSet = questionSets[this.currentSetIndex] || questionSets[0];
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= (currentSet.questions?.length || 0)) {
      this.currentQuestionIndex = 0;
      this.currentSetIndex = (this.currentSetIndex + 1) % questionSets.length;
    }

    const nextSet = questionSets[this.currentSetIndex] || questionSets[0];
    const q = nextSet.questions?.[this.currentQuestionIndex] || defaultQuestions[0];
    this.question = q.question;
    this.allyAnswer = q.answer;
    this.questionIcon = q.icon || "💡";
    this.questionType = q.type || "open";
    this.options = q.options || [];
  }

  setQuestion(qData) {
    if (!qData) return this.getPublicPayload();
    if (qData.question) this.question = qData.question;
    if (qData.answer) this.allyAnswer = qData.answer;
    if (qData.icon) this.questionIcon = qData.icon;
    if (qData.type) this.questionType = qData.type;
    if (qData.options) this.options = qData.options;
    this.isAnswerRevealed = false;
    this.roundWinners = [];
    this.guessedThisRound.clear();
    this.statusMessage = `New Question Loaded: "${this.question}"`;
    return this.getPublicPayload();
  }

  loadQuestionSet(setId) {
    const idx = questionSets.findIndex((s) => s.id === setId);
    if (idx !== -1) {
      this.currentSetIndex = idx;
      this.currentQuestionIndex = 0;
      const q = questionSets[idx].questions?.[0];
      if (q) {
        this.question = q.question;
        this.allyAnswer = q.answer;
        this.questionIcon = q.icon || "💡";
        this.questionType = q.type || "open";
        this.options = q.options || [];
      }
      this.isAnswerRevealed = false;
      this.roundWinners = [];
      this.guessedThisRound.clear();
      this.statusMessage = `Loaded Pack: ${questionSets[idx].name}`;
    }
    return this.getPublicPayload();
  }

  prevRound(options = {}) {
    this.round = Math.max(1, this.round - 1);
    const currentSet = questionSets[this.currentSetIndex] || questionSets[0];
    const totalQ = currentSet?.questions?.length || 1;
    // Step back 2 because advanceQuestion advances by 1
    this.currentQuestionIndex = (this.currentQuestionIndex - 2 + totalQ) % totalQ;
    this.advanceQuestion();

    if (options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.isAnswerRevealed = false;
    this.roundWinners = [];
    this.guessedThisRound.clear();
    this.paused = false;
    this.statusMessage = `Round ${this.round}: Guess what Ally is thinking! 💬`;
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
    if (!this.allyAnswer) return this.getPublicPayload();
    const primary = String(this.allyAnswer).split(/[/,|]/)[0].trim();
    if (primary.length <= 1) {
      this.statusMessage = `💡 HINT: Short word (${primary.length} letter)!`;
    } else {
      const firstChar = primary[0].toUpperCase();
      this.statusMessage = `💡 HINT: Starts with "${firstChar}" (${primary.length} letters)`;
    }
    return this.getPublicPayload();
  }

  startTimer(seconds = null) {
    if (seconds && Number(seconds) > 0) {
      this.roundDurationSec = Number(seconds);
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = true;
    this.paused = false;
    this.isAnswerRevealed = false;
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Guess in chat!`;
    return this.getPublicPayload();
  }

  stopTimer() {
    this.isTimerActive = false;
    this.paused = true;
    this.statusMessage = "Timer paused";
    return this.getPublicPayload();
  }

  reveal() {
    this.isTimerActive = false;
    this.isAnswerRevealed = true;
    this.statusMessage = `Answer revealed: ${this.allyAnswer}`;
    return this.getPublicPayload();
  }

  hideAnswer() {
    this.isAnswerRevealed = false;
    return this.getPublicPayload();
  }

  setPaused(pause) {
    this.paused = !!pause;
    return this.getPublicPayload();
  }

  tick() {
    if (!this.isTimerActive || this.paused) return { changed: false, timeExpired: false };
    this.timerRemaining--;

    if (this.timerRemaining <= 0) {
      this.timerRemaining = 0;
      this.isTimerActive = false;
      this.isAnswerRevealed = true;

      const hadWinners = this.roundWinners.length > 0;
      if (!hadWinners) {
        this.streak = 0;
      }
      this.statusMessage = `⏰ Time's up! Answer: ${this.allyAnswer}`;

      return {
        changed: true,
        timeExpired: true,
        hadWinners,
        roundWinners: this.roundWinners,
        target: this.allyAnswer
      };
    }

    return { changed: true, timeExpired: false };
  }

  normalizeString(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  checkAnswerMatch(commentText) {
    if (!commentText || !this.allyAnswer) return false;

    const normComment = this.normalizeString(commentText);
    if (!normComment) return false;

    // Check multiple answers separated by / or , or |
    const possibleAnswers = String(this.allyAnswer)
      .split(/[/,|]/)
      .map((a) => this.normalizeString(a))
      .filter(Boolean);

    for (const ans of possibleAnswers) {
      if (normComment === ans || normComment.includes(ans)) {
        return true;
      }
    }

    // If MCQ, check option letters (A, B, C, D)
    if (this.questionType === "mcq" && this.options?.length > 0) {
      const correctIdx = this.options.findIndex((opt) => this.normalizeString(opt) === this.normalizeString(this.allyAnswer));
      if (correctIdx !== -1) {
        const optionLetter = String.fromCharCode(65 + correctIdx).toLowerCase(); // 'a', 'b', 'c', 'd'
        if (normComment === optionLetter || normComment === `option ${optionLetter}` || normComment === `(${optionLetter})`) {
          return true;
        }
      }
    }

    return false;
  }

  processGuess(user, nickname, message, avatar = null) {
    const cleanUser = user || "viewer";
    const cleanNick = nickname || cleanUser;
    const cleanMsg = String(message || "").trim();
    if (!cleanMsg) return { valid: false };

    const isMatch = this.checkAnswerMatch(cleanMsg);
    const alreadyWon = this.guessedThisRound.has(cleanUser.toLowerCase());

    const isCorrect = this.isTimerActive && isMatch && !alreadyWon;

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
      this.guessedThisRound.add(cleanUser.toLowerCase());

      const place = this.roundWinners.length + 1;
      const points = place === 1 ? 3 : place === 2 ? 2 : 1;

      const winnerData = {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        code: cleanMsg,
        place,
        points,
        timestamp: Date.now()
      };

      this.roundWinners.push(winnerData);
      if (this.roundWinners.length === 1) {
        this.streak = (this.streak || 0) + 1;
      }

      // Update leaderboard
      const existing = this.leaderboard.get(cleanUser) || {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        score: 0,
        wins: 0
      };
      existing.nickname = cleanNick;
      if (avatar) existing.avatar = avatar;
      existing.score += points;
      existing.wins += 1;
      existing.lastWonAt = Date.now();
      this.leaderboard.set(cleanUser, existing);

      this.statusMessage = `🎯 Correct guess #${place} by @${cleanNick}! (+${points} pts)`;

      return {
        valid: true,
        isCorrect: true,
        winner: winnerData,
        place,
        points,
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
      .sort((a, b) => b.score - a.score || b.wins - a.wins || a.lastWonAt - b.lastWonAt)
      .slice(0, limit);
  }

  resetLeaderboard() {
    this.leaderboard.clear();
  }

  resetGame() {
    this.round = 1;
    this.streak = 0;
    this.currentQuestionIndex = 0;
    this.roundWinners = [];
    this.guessedThisRound.clear();
    this.guesses = [];
    this.initFirstQuestion();
    return this.getPublicPayload();
  }

  getPublicPayload() {
    return {
      gameId: "think-like-ally",
      round: this.round,
      maxRounds: this.maxRounds,
      streak: this.streak || 0,
      question: this.question,
      questionIcon: this.questionIcon,
      questionType: this.questionType,
      options: this.options,
      time: this.timerRemaining,
      timerRemaining: this.timerRemaining,
      roundDurationSec: this.roundDurationSec,
      isTimerActive: this.isTimerActive,
      isAnswerRevealed: this.isAnswerRevealed,
      paused: this.paused,
      roundWinners: this.roundWinners,
      statusMessage: this.statusMessage,
      target: this.isAnswerRevealed ? this.allyAnswer : "???",
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretTarget: this.allyAnswer,
      allyAnswer: this.allyAnswer,
      questionSets: this.getQuestionSets(),
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
