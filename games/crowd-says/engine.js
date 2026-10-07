// games/crowd-says/engine.js (ESM)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.join(__dirname, "questions.json");

let questionList = [];
try {
  if (fs.existsSync(questionsPath)) {
    const raw = fs.readFileSync(questionsPath, "utf8");
    questionList = JSON.parse(raw);
  }
} catch (err) {
  console.warn("[CrowdSays] Could not load questions.json:", err.message);
}

function saveQuestionsToFile() {
  try {
    fs.writeFileSync(questionsPath, JSON.stringify(questionList, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[CrowdSays] Failed to save questions.json:", err);
    return false;
  }
}

// Fallback questions if questions.json is missing
const fallbackQuestions = [
  {
    id: "cs-soup",
    question: "Name a popular type of soup",
    icon: "🥣",
    category: "Food & Drink",
    answers: [
      { text: "Chicken Noodle", synonyms: ["chicken noodle", "chicken", "chicken soup"], points: 35 },
      { text: "Tomato", synonyms: ["tomato", "tomato soup"], points: 25 },
      { text: "Mushroom", synonyms: ["mushroom", "cream of mushroom"], points: 18 },
      { text: "Minestrone", synonyms: ["minestrone"], points: 12 },
      { text: "French Onion", synonyms: ["french onion", "onion soup"], points: 10 }
    ]
  },
  {
    id: "cs-hot-drink",
    question: "Name a type of hot drink",
    icon: "☕",
    category: "Food & Drink",
    answers: [
      { text: "Coffee", synonyms: ["coffee", "latte", "cappuccino", "espresso"], points: 38 },
      { text: "Tea", synonyms: ["tea", "green tea", "chai"], points: 28 },
      { text: "Hot Chocolate", synonyms: ["hot chocolate", "cocoa"], points: 18 },
      { text: "Apple Cider", synonyms: ["cider", "apple cider"], points: 9 },
      { text: "Matcha Latte", synonyms: ["matcha", "matcha latte"], points: 7 }
    ]
  }
];

export class CrowdSaysEngine {
  constructor() {
    this.questions = questionList.length > 0 ? questionList : fallbackQuestions;
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.roundDurationSec = 45;
    this.customDurationSec = null;
    this.timerRemaining = 45;
    this.isTimerActive = false;
    this.paused = false;
    this.streak = 0;

    this.question = "Name a popular type of soup";
    this.icon = "🥣";
    this.category = "Food & Drink";
    this.questionId = "cs-soup";

    this.slots = [];
    this.foundCount = 0;
    this.totalSlots = 5;
    this.allFound = false;

    this.statusMessage = "Press START to begin Chat Feud! ⚔️";
    this.roundWinners = [];
    this.guesses = [];
    this.leaderboard = new Map();
    this.playedQuestionIndices = [];

    const startIdx = this.getRandomQuestionIndex();
    this.loadQuestionByIndex(startIdx, false);
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

  getRandomQuestionIndex() {
    if (!this.questions || this.questions.length <= 1) return 0;
    if (this.playedQuestionIndices.length >= this.questions.length) {
      this.playedQuestionIndices = [];
    }
    const playedSet = new Set(this.playedQuestionIndices);
    const available = [];
    for (let i = 0; i < this.questions.length; i++) {
      if (!playedSet.has(i) && i !== this.currentQuestionIndex) {
        available.push(i);
      }
    }
    const pool = available.length > 0 ? available : this.questions.map((_, i) => i);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.playedQuestionIndices.push(chosen);
    return chosen;
  }

  loadQuestionByIndex(index, startTimerNow = false) {
    if (this.questions.length === 0) return;
    this.currentQuestionIndex = ((index % this.questions.length) + this.questions.length) % this.questions.length;
    const q = this.questions[this.currentQuestionIndex];

    this.question = q.question;
    this.icon = q.icon || "📣";
    this.category = q.category || "General";
    this.questionId = q.id || `q-${this.currentQuestionIndex}`;

    const rawAnswers = Array.isArray(q.answers) ? q.answers : [];
    this.totalSlots = rawAnswers.length;
    this.foundCount = 0;
    this.allFound = false;
    this.roundWinners = [];

    this.slots = rawAnswers.map((ans, idx) => {
      const text = typeof ans === "object" ? ans.text : String(ans);
      const points = (typeof ans === "object" && ans.points) ? Number(ans.points) : Math.max(5, (rawAnswers.length - idx) * 8);
      const synonyms = (typeof ans === "object" && Array.isArray(ans.synonyms))
        ? ans.synonyms
        : [text];

      const slotObj = {
        rank: idx + 1,
        text,
        synonyms: Array.from(new Set([text, ...synonyms])),
        points,
        revealed: false,
        isMissed: false,
        revealedLetterIndices: [],
        winner: null
      };

      this.initSlotLetterIndices(slotObj);
      return slotObj;
    });

    if (this.customDurationSec && this.customDurationSec > 0) {
      this.roundDurationSec = this.customDurationSec;
    }
    this.timerRemaining = this.roundDurationSec;
    this.isTimerActive = startTimerNow;
    this.paused = false;

    this.statusMessage = `Round ${this.round}: "${this.question}" — Type answers in chat!`;
  }

  loadQuestionById(id) {
    const idx = this.questions.findIndex((q) => q.id === id);
    if (idx !== -1) {
      this.loadQuestionByIndex(idx, false);
    }
    return this.getPublicPayload();
  }

  newRound(options = {}) {
    this.round++;
    let nextIdx = this.getRandomQuestionIndex();
    if (options && options.id) {
      const foundIdx = this.questions.findIndex((q) => q.id === options.id);
      if (foundIdx !== -1) nextIdx = foundIdx;
    }

    if (options && options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
      this.customDurationSec = Number(options.duration);
    }

    this.loadQuestionByIndex(nextIdx, true);
    return this.getPublicPayload();
  }

  prevRound() {
    this.round = Math.max(1, this.round - 1);
    const prevIdx = (this.currentQuestionIndex - 1 + this.questions.length) % this.questions.length;
    this.loadQuestionByIndex(prevIdx, false);
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
    this.statusMessage = `Timer Started (${this.timerRemaining}s)! Guess top answers in chat!`;
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

  revealSlot(slotIndex) {
    const idx = parseInt(slotIndex, 10);
    if (idx >= 0 && idx < this.slots.length) {
      const slot = this.slots[idx];
      if (!slot.revealed) {
        slot.revealed = true;
        slot.isMissed = true;
        this.foundCount++;
        if (this.foundCount >= this.slots.length) {
          this.allFound = true;
          this.isTimerActive = false;
        }
      }
    }
    return this.getPublicPayload();
  }

  revealAll() {
    this.slots.forEach((s) => {
      if (!s.revealed) {
        s.revealed = true;
        s.isMissed = true;
      }
    });
    this.foundCount = this.slots.length;
    this.allFound = true;
    this.isTimerActive = false;
    this.statusMessage = "All answers revealed!";
    return this.getPublicPayload();
  }

  initSlotLetterIndices(slot) {
    if (!slot || !slot.text) return;
    slot.revealedLetterIndices = [];
    const words = slot.text.split(" ");
    let currIdx = 0;
    words.forEach((w) => {
      if (w.length > 0) {
        for (let j = 0; j < w.length; j++) {
          if (/[a-zA-Z0-9]/.test(w[j])) {
            slot.revealedLetterIndices.push(currIdx + j);
            break;
          }
        }
      }
      currIdx += w.length + 1;
    });
  }

  getSlotMaskedText(slot) {
    if (!slot) return "";
    if (slot.revealed) return slot.text;
    const chars = slot.text.split("");
    return chars
      .map((ch, i) => {
        if (!/[a-zA-Z0-9]/.test(ch)) return ch;
        if (slot.revealedLetterIndices && slot.revealedLetterIndices.includes(i)) {
          return ch;
        }
        return "_";
      })
      .join("");
  }

  revealRandomLetter(slot) {
    if (!slot || slot.revealed) return false;
    if (!Array.isArray(slot.revealedLetterIndices)) {
      slot.revealedLetterIndices = [];
    }
    const unrevealed = [];
    for (let i = 0; i < slot.text.length; i++) {
      if (/[a-zA-Z0-9]/.test(slot.text[i]) && !slot.revealedLetterIndices.includes(i)) {
        unrevealed.push(i);
      }
    }
    // Keep at least 1 letter hidden so chat still has to solve it
    if (unrevealed.length > 1) {
      const chosen = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      slot.revealedLetterIndices.push(chosen);
      return true;
    }
    return false;
  }

  hint() {
    let changed = false;
    this.slots.forEach((s) => {
      if (!s.revealed) {
        if (this.revealRandomLetter(s)) changed = true;
      }
    });
    if (changed) {
      this.statusMessage = "💡 Hint: More letters revealed on the board!";
    }
    return this.getPublicPayload();
  }

  hideAll() {
    this.slots.forEach((s) => {
      s.revealed = false;
      s.isMissed = false;
      s.winner = null;
      this.initSlotLetterIndices(s);
    });
    this.foundCount = 0;
    this.allFound = false;
    this.roundWinners = [];
    return this.getPublicPayload();
  }

  processGuess(username, nickname, text, avatar = null) {
    if (!text || !this.isTimerActive || this.paused || this.allFound) {
      return { valid: false };
    }

    const cleanInput = String(text).trim();
    const normalizedInput = this.normalizeString(cleanInput);
    if (normalizedInput.length < 2) {
      return { valid: false };
    }

    // Record guess in recent history
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

    // Check each unrevealed slot
    let matchedSlot = null;
    for (const slot of this.slots) {
      if (slot.revealed) continue;

      for (const synonym of slot.synonyms) {
        const normSynonym = this.normalizeString(synonym);
        if (!normSynonym) continue;

        // Exact match
        if (normalizedInput === normSynonym) {
          matchedSlot = slot;
          break;
        }

        // Substring match for longer phrases (e.g. "i think chicken noodle" or "tomato soup")
        if (normSynonym.length >= 4 && normalizedInput.includes(normSynonym)) {
          matchedSlot = slot;
          break;
        }

        // Reverse match (if chatter typed a shorter keyword like "chicken" and synonym is "chicken")
        if (normalizedInput.length >= 4 && normSynonym.includes(normalizedInput)) {
          matchedSlot = slot;
          break;
        }
      }

      if (matchedSlot) break;
    }

    if (!matchedSlot) {
      return {
        valid: true,
        isCorrect: false,
        guessItem: guessEntry
      };
    }

    // Correct Guess!
    guessEntry.isCorrect = true;
    matchedSlot.revealed = true;
    matchedSlot.isMissed = false;
    matchedSlot.winner = {
      user: username || "Viewer",
      nickname: nickname || username || "Viewer",
      avatar: avatar || null
    };

    this.foundCount++;
    this.streak++;

    // Award Points
    const pts = matchedSlot.points;
    const winnerKey = username || nickname || "Viewer";
    const currentScore = this.leaderboard.get(winnerKey) || {
      user: winnerKey,
      nickname: nickname || username || "Viewer",
      score: 0,
      wins: 0,
      avatar: avatar || null,
      lastWonAt: Date.now()
    };
    currentScore.score += pts;
    currentScore.wins += 1;
    currentScore.lastWonAt = Date.now();
    if (avatar) currentScore.avatar = avatar;
    this.leaderboard.set(winnerKey, currentScore);

    const winItem = {
      place: this.foundCount,
      user: winnerKey,
      nickname: nickname || username || "Viewer",
      avatar: avatar || null,
      code: matchedSlot.text,
      points: pts
    };
    this.roundWinners.push(winItem);

    const roundComplete = this.foundCount >= this.slots.length;
    if (roundComplete) {
      this.allFound = true;
      this.isTimerActive = false;
      this.statusMessage = `🎉 All ${this.slots.length} top answers found! Great job chat!`;
    } else {
      this.statusMessage = `@${nickname || username} found #${matchedSlot.rank} "${matchedSlot.text}" (+${pts} pts)!`;
    }

    return {
      valid: true,
      isCorrect: true,
      place: matchedSlot.rank,
      points: pts,
      winner: {
        ...matchedSlot.winner,
        code: matchedSlot.text
      },
      newStreak: this.streak,
      roundComplete,
      roundWinners: this.roundWinners,
      guessItem: guessEntry
    };
  }

  tick() {
    if (!this.isTimerActive || this.paused) {
      return { changed: false, timeExpired: false };
    }

    this.timerRemaining--;

    // Progressive automatic letter reveal every 7 seconds
    const timeElapsed = this.roundDurationSec - this.timerRemaining;
    if (timeElapsed > 0 && timeElapsed % 7 === 0 && this.timerRemaining > 2 && !this.allFound) {
      this.hint();
    }

    if (this.timerRemaining <= 0) {
      this.timerRemaining = 0;
      this.isTimerActive = false;
      this.allFound = true;

      // Reveal all missed answers
      this.slots.forEach((s) => {
        if (!s.revealed) {
          s.revealed = true;
          s.isMissed = true;
        }
      });

      this.statusMessage = `⏰ Time's up! Showing remaining answers!`;
      return {
        changed: true,
        timeExpired: true,
        roundComplete: true,
        target: this.question
      };
    }

    return { changed: true, timeExpired: false };
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
    this.playedQuestionIndices = [];
    this.roundWinners = [];
    this.guesses = [];
    this.loadQuestionByIndex(0, false);
    return this.getPublicPayload();
  }

  importQuestionSet(payload) {
    if (!payload) return this.getPublicPayload();

    let rawQuestions = Array.isArray(payload) ? payload : (payload.questions || []);
    const validQuestions = [];

    rawQuestions.forEach((q, idx) => {
      if (!q) return;
      let questionPrompt = "";
      let icon = "📣";
      let category = "Custom";
      let answers = [];

      if (typeof q === "object") {
        questionPrompt = String(q.question || q.prompt || "").trim();
        icon = q.icon || "📣";
        category = q.category || "Custom";

        if (Array.isArray(q.answers)) {
          answers = q.answers.map((ans, aIdx) => {
            if (typeof ans === "object") {
              return {
                text: String(ans.text || ans.answer || "").trim(),
                synonyms: Array.isArray(ans.synonyms) ? ans.synonyms : [String(ans.text || ans.answer || "")],
                points: Number(ans.points) || Math.max(5, (5 - aIdx) * 8)
              };
            }
            return {
              text: String(ans).trim(),
              synonyms: [String(ans).trim()],
              points: Math.max(5, (5 - aIdx) * 8)
            };
          }).filter((a) => a.text.length > 0);
        } else if (typeof q.answer === "string") {
          // If comma or slash separated
          const parts = q.answer.split(/[/,|]/).map((s) => s.trim()).filter(Boolean);
          answers = parts.map((text, aIdx) => ({
            text,
            synonyms: [text],
            points: Math.max(5, (parts.length - aIdx) * 8)
          }));
        }
      }

      if (questionPrompt && answers.length > 0) {
        validQuestions.push({
          id: `custom-cs-${Date.now()}-${idx}`,
          question: questionPrompt,
          icon,
          category,
          answers
        });
      }
    });

    if (validQuestions.length === 0) {
      this.statusMessage = "❌ Import failed: No valid survey questions found.";
      return this.getPublicPayload();
    }

    // Append to questions list
    this.questions.push(...validQuestions);
    questionList = this.questions;
    saveQuestionsToFile();

    // Immediately load first imported question
    const newIdx = this.questions.length - validQuestions.length;
    this.loadQuestionByIndex(newIdx, false);
    this.statusMessage = `✅ Imported ${validQuestions.length} survey questions!`;
    return this.getPublicPayload();
  }

  getPublicPayload() {
    return {
      gameId: "crowd-says",
      round: this.round,
      question: this.question,
      icon: this.icon,
      category: this.category,
      questionId: this.questionId,
      time: this.timerRemaining,
      timerRemaining: this.timerRemaining,
      roundDurationSec: this.roundDurationSec,
      customDurationSec: this.customDurationSec,
      isTimerActive: this.isTimerActive,
      paused: this.paused,
      streak: this.streak,
      foundCount: this.foundCount,
      totalSlots: this.totalSlots,
      allFound: this.allFound,
      statusMessage: this.statusMessage,
      target: this.question,
      slots: this.slots.map((s) => ({
        rank: s.rank,
        points: s.points,
        revealed: s.revealed,
        isMissed: s.isMissed,
        text: s.revealed ? s.text : this.getSlotMaskedText(s),
        maskedText: this.getSlotMaskedText(s),
        winner: s.winner
      })),
      roundWinners: this.roundWinners,
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretSlots: this.slots,
      questionsCount: this.questions.length,
      questions: this.questions.map((q) => ({
        id: q.id,
        question: q.question,
        category: q.category,
        icon: q.icon,
        answerCount: q.answers?.length || 0
      })),
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
