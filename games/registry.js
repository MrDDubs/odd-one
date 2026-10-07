// games/registry.js (ESM)
import { OddOneOutEngine } from "./odd-one-out/engine.js";
import { ThinkLikeAllyEngine } from "./think-like-ally/engine.js";
import { ThinkAndLinkEngine } from "./think-and-link/engine.js";
import { WordFinderEngine } from "./word-finder/engine.js";
import { CrowdSaysEngine } from "./crowd-says/engine.js";
import { UnscrambleEngine } from "./unscramble/engine.js";
import { RebusEngine } from "./rebus/engine.js";
import { RiddleEngine } from "./riddle/engine.js";

class GameRegistry {
  constructor() {
    this.games = new Map();
    this.activeGameId = "odd-one-out";

    // Register built-in games
    this.registerGame({
      id: "odd-one-out",
      name: "Ally's Odd One Out",
      icon: "🧩",
      description: "Visual spot-the-difference game on a 6x4 grid with difficulty levels, streaks, and timer.",
      category: "Visual / Pattern",
      overlayPath: "/games/odd-one-out/overlay.html",
      controlsPath: "/games/odd-one-out/controls.html",
      controlsModule: "/games/odd-one-out/controls.js",
      engine: new OddOneOutEngine()
    });

    this.registerGame({
      id: "think-like-ally",
      name: "Think Like Ally",
      icon: "💡",
      description: "Interactive Live Trivia & Guessing Game Show. Viewers guess the secret answer in chat!",
      category: "Trivia / Guessing",
      overlayPath: "/games/think-like-ally/overlay.html",
      controlsPath: "/games/think-like-ally/controls.html",
      controlsModule: "/games/think-like-ally/controls.js",
      engine: new ThinkLikeAllyEngine()
    });

    this.registerGame({
      id: "think-and-link",
      name: "Think & Link",
      icon: "💜",
      description: "Word Association Live Game. Viewers guess 6 related words from starting letter hints!",
      category: "Word / Association",
      overlayPath: "/games/think-and-link/overlay.html",
      controlsPath: "/games/think-and-link/controls.html",
      controlsModule: "/games/think-and-link/controls.js",
      engine: new ThinkAndLinkEngine()
    });

    this.registerGame({
      id: "word-finder",
      name: "Ally's Word Finder",
      icon: "🔍",
      description: "6x6 Word Search Live Game! Chat finds up to 8 hidden words on a 6x6 grid with A-F rows & 1-6 columns.",
      category: "Word / Puzzle",
      overlayPath: "/games/word-finder/overlay.html",
      controlsPath: "/games/word-finder/controls.html",
      controlsModule: "/games/word-finder/controls.js",
      engine: new WordFinderEngine()
    });

    this.registerGame({
      id: "crowd-says",
      name: "Ally's Chat Feud",
      icon: "⚔️",
      description: "Chat Feud Live Survey Game! Viewers in chat guess the top survey answers on the board.",
      category: "Trivia / Survey",
      overlayPath: "/games/crowd-says/overlay.html",
      controlsPath: "/games/crowd-says/controls.html",
      controlsModule: "/games/crowd-says/controls.js",
      engine: new CrowdSaysEngine()
    });

    this.registerGame({
      id: "unscramble",
      name: "Ally's Unscramble",
      icon: "🔤",
      description: "Word Unscramble Live Game! Viewers in chat unscramble 4–9 letter words.",
      category: "Word / Puzzle",
      overlayPath: "/games/unscramble/overlay.html",
      controlsPath: "/games/unscramble/controls.html",
      controlsModule: "/games/unscramble/controls.js",
      engine: new UnscrambleEngine()
    });

    this.registerGame({
      id: "rebus",
      name: "Ally's Rebus",
      icon: "🎭",
      description: "Visual Wordplay Live Game! Viewers in chat guess 500+ Dingbats & Rebus puzzles.",
      category: "Word / Visual",
      overlayPath: "/games/rebus/overlay.html",
      controlsPath: "/games/rebus/controls.html",
      controlsModule: "/games/rebus/controls.js",
      engine: new RebusEngine()
    });

    this.registerGame({
      id: "riddle",
      name: "Ally's Riddles",
      icon: "🧙‍♂️",
      description: "Live Riddle Brain Teasers! Viewers in chat solve 600+ tricky riddles with 5-second speed grace for bonus winners.",
      category: "Word / Trivia",
      overlayPath: "/games/riddle/overlay.html",
      controlsPath: "/games/riddle/controls.html",
      controlsModule: "/games/riddle/controls.js",
      engine: new RiddleEngine()
    });
  }

  registerGame(gameDefinition) {
    if (!gameDefinition || !gameDefinition.id) return;
    this.games.set(gameDefinition.id, gameDefinition);
  }

  getAvailableGames() {
    return Array.from(this.games.values()).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      description: g.description,
      category: g.category,
      overlayPath: g.overlayPath,
      controlsPath: g.controlsPath,
      controlsModule: g.controlsModule,
      isActive: g.id === this.activeGameId
    }));
  }

  getActiveGame() {
    const game = this.games.get(this.activeGameId);
    return game ? game.engine : null;
  }

  getActiveGameDefinition() {
    return this.games.get(this.activeGameId) || null;
  }

  getActiveGameId() {
    return this.activeGameId;
  }

  setActiveGame(gameId) {
    const resolvedId = gameId === "chat-feud" ? "crowd-says" : gameId;
    if (this.games.has(resolvedId)) {
      this.activeGameId = resolvedId;
      console.log(`[GameRegistry] Switched active game to: ${resolvedId}`);
      return true;
    }
    return false;
  }

  tickActiveGame() {
    const active = this.getActiveGame();
    if (active && typeof active.tick === "function") {
      return active.tick();
    }
    return { changed: false, timeExpired: false };
  }

  processGuess(username, nickname, text, avatar = null) {
    const active = this.getActiveGame();
    if (active && typeof active.processGuess === "function") {
      return active.processGuess(username, nickname, text, avatar);
    }
    return { valid: false };
  }

  handleGameAction(gameId, action, options) {
    const rawId = gameId === "chat-feud" ? "crowd-says" : gameId;
    const targetGameId = rawId || this.activeGameId;
    const gameObj = this.games.get(targetGameId);
    if (!gameObj || !gameObj.engine) return null;

    const engine = gameObj.engine;

    switch (action) {
      case "startRound":
        if (typeof engine.startRound === "function") return engine.startRound(options);
        return engine.newRound(options);
      case "newRound":
      case "nextRound":
        return engine.newRound(options);
      case "prevRound":
      case "previousRound":
        if (typeof engine.prevRound === "function") return engine.prevRound(options);
        break;
      case "adjustTime":
        if (typeof engine.adjustTime === "function") {
          const d = (options && typeof options === "object") ? (options.delta ?? options.deltaSec ?? options.d ?? options.sec) : options;
          return engine.adjustTime(d);
        }
        break;
      case "setTime":
        if (typeof engine.setTime === "function") {
          const s = (options && typeof options === "object") ? (options.sec ?? options.seconds ?? options.duration ?? options.time) : options;
          return engine.setTime(s);
        }
        break;
      case "hint":
        if (typeof engine.hint === "function") return engine.hint(options);
        break;
      case "reveal":
        return engine.reveal();
      case "hideAnswer":
        if (typeof engine.hideAnswer === "function") return engine.hideAnswer();
        break;
      case "togglePause":
        return engine.setPaused(!engine.paused);
      case "pause":
        return engine.setPaused(true);
      case "resume":
        return engine.setPaused(false);
      case "resetGame":
        return engine.resetGame();
      case "resetLeaderboard":
        if (typeof engine.resetLeaderboard === "function") return engine.resetLeaderboard();
        break;
      case "setOptions":
        if (typeof engine.setOptions === "function") return engine.setOptions(options);
        break;
      case "startTimer":
        if (typeof engine.startTimer === "function") {
          const s = (options && typeof options === "object") ? (options.sec ?? options.seconds ?? options.duration ?? options.time) : options;
          return engine.startTimer(s);
        }
        break;
      case "stopTimer":
        if (typeof engine.stopTimer === "function") return engine.stopTimer();
        break;
      case "setQuestion":
        if (typeof engine.setQuestion === "function") return engine.setQuestion(options);
        break;
      case "loadQuestionSet":
        if (typeof engine.loadQuestionSet === "function") return engine.loadQuestionSet(options);
        break;
      case "importQuestionSet":
        if (typeof engine.importQuestionSet === "function") return engine.importQuestionSet(options);
        break;
      case "deleteQuestionSet":
        if (typeof engine.deleteQuestionSet === "function") return engine.deleteQuestionSet(options);
        break;
      case "revealSlot":
        if (typeof engine.revealSlot === "function") return engine.revealSlot(options);
        break;
      case "revealWord":
        if (typeof engine.revealWord === "function") return engine.revealWord(options);
        break;
      case "setCategoryFilter":
        if (typeof engine.setCategoryFilter === "function") return engine.setCategoryFilter(options);
        break;
      case "setDifficultyFilter":
        if (typeof engine.setDifficultyFilter === "function") return engine.setDifficultyFilter(options);
        break;
      case "setLengthFilter":
        if (typeof engine.setLengthFilter === "function") return engine.setLengthFilter(options);
        break;
      case "loadPuzzleById":
        if (typeof engine.loadPuzzleById === "function") return engine.loadPuzzleById(options);
        break;
      case "loadQuestionById":
        if (typeof engine.loadQuestionById === "function") return engine.loadQuestionById(options);
        break;
      case "loadWordById":
        if (typeof engine.loadWordById === "function") return engine.loadWordById(options);
        break;
      case "revealAll":
        if (typeof engine.revealAll === "function") return engine.revealAll(options);
        break;
      case "hideAll":
        if (typeof engine.hideAll === "function") return engine.hideAll(options);
        break;
      case "setGridSize":
        if (typeof engine.setGridSize === "function") {
          const s = (options && typeof options === "object") ? (options.size ?? options.gridSize) : options;
          return engine.setGridSize(s);
        }
        break;
      case "setCustomPuzzle":
        if (typeof engine.setCustomPuzzle === "function") return engine.setCustomPuzzle(options);
        break;
      default:
        if (typeof engine[action] === "function") {
          return engine[action](options);
        }
    }

    return engine.getPublicPayload?.() || null;
  }

  getPublicPayload() {
    const active = this.getActiveGame();
    return {
      activeGameId: this.activeGameId,
      availableGames: this.getAvailableGames(),
      ...(active ? active.getPublicPayload() : {})
    };
  }

  getAdminPayload() {
    const active = this.getActiveGame();
    let activePayload = {};
    if (active) {
      if (typeof active.getAdminPayload === "function") {
        activePayload = active.getAdminPayload();
      } else if (typeof active.getPublicPayload === "function") {
        activePayload = active.getPublicPayload();
      }
    }
    return {
      activeGameId: this.activeGameId,
      availableGames: this.getAvailableGames(),
      ...activePayload
    };
  }
}

export const gameRegistry = new GameRegistry();
