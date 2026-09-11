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
    this.roundWinners = [];
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
    this.statusMessage = `${lvlObj.name}: First 2 to find the odd ${this.category} get points! 👀`;

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
    const str = String(msg).toUpperCase();
    const match = str.match(/\b([A-F])[\s\-_]?([1-4])\b/);
    if (match) {
      return match[1] + match[2];
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

      // If 1st winner, increment streak & update level
      let levelUp = false;
      if (place === 1) {
        this.streak++;
        const prevLevel = this.level;
        const newLevel = this.calculateLevel();
        levelUp = newLevel > prevLevel;
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
      target: this.revealed ? this.target : null,
      leaderboard: this.getLeaderboard(5)
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      secretTarget: this.target,
      autoLevel: this.autoLevel,
      mockMode: this.mockMode,
      guesses: this.guesses.slice(0, 30),
      leaderboard: this.getLeaderboard(15)
    };
  }
}
