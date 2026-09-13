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
    this.manualLevel = null;
    this.streak = 0;
    this.category = "fruit";
    this.categoryOverride = null; // null = random auto, or "fruit", "bear", etc.
    this.target = "A1";
    this.active = false;
    this.revealed = false;
    this.paused = false;
    this.time = 20;
    this.customDurationSec = null; // null = level preset, or manual number e.g. 30
    this.roundDurationSec = 20;
    this.statusMessage = "Press START to begin!";
    this.mockMode = false;
    
    // Top 2 winners for the current round
    this.roundWinners = [];
    
    // Guesses feed (recent 100)
    this.guesses = [];
    
    // Leaderboard: username -> { user, nickname, avatar, score, wins, lastWonAt }
    this.leaderboard = new Map();
  }

  calculateLevel() {
    if (!this.autoLevel && this.manualLevel !== null) return this.manualLevel;
    const computed = Math.min(5, 1 + Math.floor(this.streak / 3));
    this.level = computed;
    return computed;
  }

  getPresetTime() {
    if (this.customDurationSec && this.customDurationSec > 0) {
      return this.customDurationSec;
    }
    const lvlConfig = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    return lvlConfig.sec;
  }

  newRound(options = {}) {
    this.round++;
    this.revealed = false;
    this.roundWinners = [];
    this.paused = false;

    // 1. Determine Level
    if (options.level) {
      this.level = Math.max(1, Math.min(5, options.level));
    } else if (this.manualLevel !== null) {
      this.level = this.manualLevel;
    } else {
      this.calculateLevel();
    }

    // 2. Determine Category
    if (options.category && CATEGORIES.includes(options.category.toLowerCase())) {
      this.category = options.category.toLowerCase();
    } else if (this.categoryOverride && CATEGORIES.includes(this.categoryOverride.toLowerCase())) {
      this.category = this.categoryOverride.toLowerCase();
    } else {
      this.category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    }

    // 3. Pick random target from A1 to F4
    const randCol = COLS[Math.floor(Math.random() * COLS.length)];
    const randRow = ROWS[Math.floor(Math.random() * ROWS.length)];
    this.target = randCol + randRow;

    // 4. Determine Round Duration
    if (options.duration && Number(options.duration) > 0) {
      this.customDurationSec = Number(options.duration);
      this.roundDurationSec = this.customDurationSec;
    } else if (this.customDurationSec && this.customDurationSec > 0) {
      this.roundDurationSec = this.customDurationSec;
    } else {
      this.roundDurationSec = this.getPresetTime();
    }

    this.time = this.roundDurationSec;
    this.active = true;

    const lvlObj = LEVELS.find(l => l.level === this.level) || LEVELS[0];
    this.statusMessage = `${lvlObj.name}: First 2 to find the odd ${this.category} get points! 👀`;

    return this.getPublicPayload();
  }

  setOptions(opts = {}) {
    // Duration
    if (opts.duration !== undefined) {
      const dur = parseInt(opts.duration, 10);
      if (dur > 0) {
        this.customDurationSec = dur;
        this.roundDurationSec = dur;
        this.time = dur; // Immediately set active timer!
      }
    }

    // Category
    if (opts.category !== undefined) {
      if (opts.category === "random" || !opts.category) {
        this.categoryOverride = null;
      } else if (CATEGORIES.includes(opts.category.toLowerCase())) {
        this.categoryOverride = opts.category.toLowerCase();
        this.category = this.categoryOverride;
      }
    }

    // Level
    if (opts.autoLevel !== undefined) {
      this.autoLevel = !!opts.autoLevel;
      if (this.autoLevel) {
        this.manualLevel = null;
        this.calculateLevel();
      }
    }
    if (opts.level !== undefined) {
      const lvl = parseInt(opts.level, 10);
      if (lvl >= 1 && lvl <= 5) {
        this.manualLevel = lvl;
        this.autoLevel = false;
        this.level = lvl;
      }
    }

    return this.getPublicPayload();
  }

  tick() {
    if (!this.active || this.paused) return { changed: false, timeExpired: false };
    this.time--;

    if (this.time <= 0) {
      this.time = 0;
      this.active = false;
      this.revealed = true;
      
      const hadWinners = this.roundWinners.length > 0;
      if (!hadWinners) {
        this.streak = 0;
        this.statusMessage = `⏰ Time's up! The answer was ${this.target} (Streak reset)`;
      } else {
        this.statusMessage = `⏰ Time's up! The answer was ${this.target}`;
      }

      return { changed: true, timeExpired: true, hadWinners, roundWinners: this.roundWinners };
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
    this.roundWinners = [];
    this.guesses = [];
    return this.newRound();
  }

  resetLeaderboard() {
    this.leaderboard.clear();
  }

  extractGuessCode(msg) {
    if (!msg) return null;
    const str = String(msg).toUpperCase().trim();
    // Matches A1 to F4 anywhere, with optional spaces/dashes, even next to emojis or punctuation:
    const match = str.match(/(?:^|[^A-Z0-9])([A-F])[\s\-_]?([1-4])(?![0-9])/i);
    if (match) {
      return match[1].toUpperCase() + match[2];
    }
    return null;
  }

  processGuess(user, nickname, message, avatar = null) {
    const code = this.extractGuessCode(message);
    if (!code) return { valid: false };

    const cleanUser = user || "viewer";
    const cleanNick = nickname || cleanUser;
    const isTarget = code === this.target;

    // Check if user already won in this round
    const alreadyWon = this.roundWinners.some(w => w.user.toLowerCase() === cleanUser.toLowerCase());

    const guessItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: cleanUser,
      nickname: cleanNick,
      avatar: avatar || null,
      code,
      message,
      isCorrect: this.active && isTarget && !alreadyWon,
      timestamp: Date.now()
    };

    // Add to guesses ring buffer
    this.guesses.unshift(guessItem);
    if (this.guesses.length > 100) this.guesses.pop();

    if (this.active && isTarget && !alreadyWon) {
      const place = this.roundWinners.length + 1; // 1 or 2
      const points = place === 1 ? 2 : 1; // 1st gets 2 pts, 2nd gets 1 pt

      const winnerData = {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        code,
        place,
        points,
        timestamp: Date.now()
      };

      this.roundWinners.push(winnerData);

      // Update leaderboard
      const userKey = cleanUser.toLowerCase();
      const existing = this.leaderboard.get(userKey) || {
        user: cleanUser,
        nickname: cleanNick,
        avatar: avatar || null,
        score: 0,
        wins: 0
      };
      existing.user = cleanUser;
      existing.nickname = cleanNick;
      if (avatar) existing.avatar = avatar;
      existing.score += points;
      existing.wins += 1;
      existing.lastWonAt = Date.now();
      this.leaderboard.set(userKey, existing);

      // If 1st winner, increment streak & update level
      let levelUp = false;
      if (place === 1) {
        this.streak++;
        const prevLevel = this.level;
        const nextComputedLevel = !this.autoLevel && this.manualLevel !== null ? this.manualLevel : Math.min(5, 1 + Math.floor(this.streak / 3));
        levelUp = nextComputedLevel > prevLevel;
      }

      // Check if round should complete (when 2 winners reached)
      const roundComplete = this.roundWinners.length >= 2;
      if (roundComplete) {
        this.active = false;
        this.revealed = true;
        this.statusMessage = `🎉 Top 2 found it! 🥇 @${this.roundWinners[0].nickname} & 🥈 @${cleanNick}`;
      } else {
        this.statusMessage = `🥇 1st place @${cleanNick} found ${code}! Looking for 2nd place...`;
      }

      return {
        valid: true,
        isCorrect: true,
        winner: winnerData,
        place,
        points,
        roundComplete,
        roundWinners: this.roundWinners,
        guessItem,
        newStreak: this.streak,
        levelUp
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
      roundWinners: this.roundWinners,
      statusMessage: this.statusMessage,
      target: this.target,
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretTarget: this.target,
      autoLevel: this.autoLevel,
      manualLevel: this.manualLevel,
      categoryOverride: this.categoryOverride,
      customDurationSec: this.customDurationSec,
      mockMode: this.mockMode,
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
