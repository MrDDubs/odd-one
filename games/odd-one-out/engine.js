export const COLS = ["A", "B", "C", "D", "E", "F"];
export const ROWS = [1, 2, 3, 4];
export const CATEGORIES = [
  "fruit", "bear", "cloud", "flower", "boba", "cupcake", "controller", "star",
  "pizza", "donut", "cat", "diamond", "coffee", "icecream", "avocado", "cookie",
  "ghost", "crown", "planet", "balloon", "butterfly", "mushroom", "camera", "heart"
];

export const LEVELS = [
  { level: 1, name: "EASY", sec: 20 },
  { level: 2, name: "MEDIUM", sec: 18 },
  { level: 3, name: "HARD", sec: 16 },
  { level: 4, name: "EXPERT", sec: 14 },
  { level: 5, name: "CHAOS", sec: 12 }
];

export class OddOneOutEngine {
  constructor() {
    this.round = 0;
    this.level = 1;
    this.autoLevel = true;
    this.manualLevel = null;
    this.streak = 0;
    this.category = "fruit";
    this.categoryOverride = null;
    this.target = "A1";
    this.active = false;
    this.revealed = false;
    this.paused = false;
    this.time = 20;
    this.customDurationSec = null;
    this.roundDurationSec = 20;
    this.statusMessage = "Press START to begin!";
    this.mockMode = false;
    
    this.roundWinners = [];
    this.guesses = [];
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
    const lvlConfig = LEVELS.find((l) => l.level === this.level) || LEVELS[0];
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

    const lvlObj = LEVELS.find((l) => l.level === this.level) || LEVELS[0];
    this.statusMessage = `${lvlObj.name}: First 2 to find the odd ${this.category} get points! 👀`;

    return this.getPublicPayload();
  }

  setOptions(opts = {}) {
    if (opts.duration !== undefined) {
      const dur = parseInt(opts.duration, 10);
      if (dur > 0) {
        this.customDurationSec = dur;
        this.roundDurationSec = dur;
        this.time = dur;
      }
    }

    if (opts.category !== undefined) {
      if (opts.category === "random" || !opts.category) {
        this.categoryOverride = null;
      } else if (CATEGORIES.includes(opts.category.toLowerCase())) {
        this.categoryOverride = opts.category.toLowerCase();
        this.category = this.categoryOverride;
      }
    }

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
        this.calculateLevel();
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

  prevRound(options = {}) {
    this.round = Math.max(0, this.round - 2);
    return this.newRound(options);
  }

  adjustTime(delta) {
    const d = typeof delta === "object" ? delta.delta : delta;
    const num = parseInt(d, 10) || 0;
    this.time = Math.max(1, this.time + num);
    return this.getPublicPayload();
  }

  setTime(sec) {
    const s = typeof sec === "object" ? sec.sec : sec;
    const num = parseInt(s, 10);
    if (num > 0) {
      this.time = num;
      this.customDurationSec = num;
      this.roundDurationSec = num;
    }
    return this.getPublicPayload();
  }

  hint() {
    if (!this.target) return this.getPublicPayload();
    const col = this.target[0];
    const row = this.target[1];
    const colIdx = COLS.indexOf(col);
    const rowIdx = ROWS.indexOf(parseInt(row, 10));
    const horiz = colIdx < 3 ? "Left side (Cols A-C)" : "Right side (Cols D-F)";
    const vert = rowIdx < 2 ? "Top half (Rows 1-2)" : "Bottom half (Rows 3-4)";
    this.statusMessage = `💡 HINT: Odd item is in the ${vert}, ${horiz} (Row ${row})!`;
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
    return this.getPublicPayload();
  }

  extractGuessCode(msg) {
    if (!msg) return null;
    const str = String(msg).toUpperCase().trim();
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

    const alreadyWon = this.roundWinners.some((w) => w.user.toLowerCase() === cleanUser.toLowerCase());

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

    this.guesses.unshift(guessItem);
    if (this.guesses.length > 100) this.guesses.pop();

    if (this.active && isTarget && !alreadyWon) {
      const place = this.roundWinners.length + 1;
      const points = place === 1 ? 2 : 1;

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

      let levelUp = false;
      if (place === 1) {
        this.streak++;
        const prevLevel = this.level;
        const newLevel = this.calculateLevel();
        levelUp = newLevel > prevLevel;
      }

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
    const lvlObj = LEVELS.find((l) => l.level === this.level) || LEVELS[0];
    return {
      gameId: "odd-one-out",
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
