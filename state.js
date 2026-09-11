// state.js
export const COLS = ["A", "B", "C", "D", "E", "F"];
export const ROWS = [1, 2, 3, 4];
export const CATEGORIES = ["fruit", "bear", "cloud", "flower", "boba", "cupcake", "controller", "star"];

export const LEVELS = [
  { level: 1, name: "EASY", sec: 20 },
  { level: 2, name: "MEDIUM", sec: 18 },
  { level: 3, name: "HARD", sec: 16 },
  { level: 4, name: "EXPERT", sec: 14 },
  { level: 5, name: "CHAOS", sec: 12 }
];

export class GameState {
  constructor() {
    this.round = 0;
    this.level = 1;
    this.autoLevel = true;
    this.streak = 0;
    this.category = "fruit";
    this.target = "A1";
    this.active = false;
    this.revealed = false;
    this.paused = false;
    this.time = 20;
    this.roundDurationSec = 20;
    this.winner = null;
    this.statusMessage = "Press START to begin!";
    this.mockMode = false;
    
    // Guesses feed (recent 100)
    this.guesses = [];
    
    // Leaderboard: username -> { username, nickname, score, lastWonAt }
    this.leaderboard = new Map();
  }

  calculateLevel() {
    if (!this.autoLevel) return this.level;
    const computed = Math.min(5, 1 + Math.floor(this.streak / 3));
    this.level = computed;
    return computed;
  }

  getPresetTime() {
    const lvlConfig = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    return lvlConfig.sec;
  }

  newRound(options = {}) {
    this.round++;
    this.revealed = false;
    this.winner = null;
    this.paused = false;

    if (options.level) {
      this.level = Math.max(1, Math.min(5, options.level));
    } else {
      this.calculateLevel();
    }

    if (options.category && CATEGORIES.includes(options.category.toLowerCase())) {
      this.category = options.category.toLowerCase();
    } else {
      this.category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    }

    // Pick random target from A1 to F4
    const randCol = COLS[Math.floor(Math.random() * COLS.length)];
    const randRow = ROWS[Math.floor(Math.random() * ROWS.length)];
    this.target = randCol + randRow;

    // Determine round duration
    if (options.duration && Number(options.duration) > 0) {
      this.roundDurationSec = Number(options.duration);
    } else {
      this.roundDurationSec = this.getPresetTime();
    }
    this.time = this.roundDurationSec;
    this.active = true;

    const lvlObj = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    this.statusMessage = `${lvlObj.name}: find the ONE odd ${this.category} 👀`;

    return this.getPublicPayload();
  }

  tick() {
    if (!this.active || this.paused) return { changed: false, timeExpired: false };
    this.time--;

    if (this.time <= 0) {
      this.time = 0;
      this.active = false;
      this.revealed = true;
      const priorStreak = this.streak;
      this.streak = 0;
      this.calculateLevel();
      this.statusMessage = `⏰ Time's up! The answer was ${this.target} (Streak reset)`;
      return { changed: true, timeExpired: true, priorStreak };
    }

    return { changed: true, timeExpired: false };
  }

  reveal() {
    this.active = false;
    this.revealed = true;
    this.statusMessage = `Answer revealed: ${this.target}`;
    return this.getPublicPayload();
  }

  setPaused(pause) {
    this.paused = !!pause;
    return this.getPublicPayload();
  }

  resetGame() {
    this.round = 0;
    this.streak = 0;
    this.level = 1;
    this.winner = null;
    this.guesses = [];
    return this.newRound();
  }

  resetLeaderboard() {
    this.leaderboard.clear();
  }

  extractGuessCode(msg) {
    if (!msg) return null;
    const str = String(msg).toUpperCase();
    // Matches patterns like "A4", "A 4", "a-4", "[A4]"
    const match = str.match(/\b([A-F])[\s\-_]?([1-4])\b/);
    if (match) {
      return match[1] + match[2];
    }
    return null;
  }

  processGuess(user, nickname, message) {
    const code = this.extractGuessCode(message);
    if (!code) return { valid: false };

    const cleanUser = user || "viewer";
    const cleanNick = nickname || cleanUser;
    const isCorrect = this.active && code === this.target;

    const guessItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: cleanUser,
      nickname: cleanNick,
      code,
      message,
      isCorrect,
      timestamp: Date.now()
    };

    // Add to guesses ring buffer
    this.guesses.unshift(guessItem);
    if (this.guesses.length > 100) this.guesses.pop();

    if (isCorrect) {
      this.active = false;
      this.revealed = true;
      this.streak++;
      const prevLevel = this.level;
      const newLevel = this.calculateLevel();

      this.winner = {
        user: cleanUser,
        nickname: cleanNick,
        code,
        timestamp: Date.now()
      };

      // Update leaderboard
      const currentScore = this.leaderboard.get(cleanUser)?.score || 0;
      this.leaderboard.set(cleanUser, {
        user: cleanUser,
        nickname: cleanNick,
        score: currentScore + 1,
        lastWonAt: Date.now()
      });

      const nextLvlObj = LEVELS.find(l => l.level === newLevel) || LEVELS[0];
      this.statusMessage =
        newLevel > prevLevel
          ? `🎉 @${cleanNick} found it! LEVEL UP → ${nextLvlObj.name} 🔥`
          : `🎉 @${cleanNick} found it! (${code}) ✓`;

      return {
        valid: true,
        isCorrect: true,
        guessItem,
        winner: this.winner,
        newStreak: this.streak,
        levelUp: newLevel > prevLevel
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
      .sort((a, b) => b.score - a.score || a.lastWonAt - b.lastWonAt)
      .slice(0, limit);
  }

  getPublicPayload() {
    const lvlObj = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    return {
      round: this.round,
      level: this.level,
      levelName: lvlObj.name,
      streak: this.streak,
      category: this.category,
      time: this.time,
      roundDurationSec: this.roundDurationSec,
      active: this.active,
      revealed: this.revealed,
      paused: this.paused,
      winner: this.winner,
      statusMessage: this.statusMessage,
      // The public overlay only gets target when revealed
      target: this.revealed ? this.target : null,
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretTarget: this.target, // Host always sees secret target!
      autoLevel: this.autoLevel,
      mockMode: this.mockMode,
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
