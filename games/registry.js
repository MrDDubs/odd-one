// games/registry.js (ESM)
import { OddOneOutEngine } from "./odd-one-out/engine.js";
import { ThinkLikeAllyEngine } from "./think-like-ally/engine.js";
import { ThinkAndLinkEngine } from "./think-and-link/engine.js";

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
    if (this.games.has(gameId)) {
      this.activeGameId = gameId;
      console.log(`[GameRegistry] Switched active game to: ${gameId}`);
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
    const targetGameId = gameId || this.activeGameId;
    const gameObj = this.games.get(targetGameId);
    if (!gameObj || !gameObj.engine) return null;

    const engine = gameObj.engine;

    switch (action) {
      case "startRound":
      case "newRound":
      case "nextRound":
        return engine.newRound(options);
      case "prevRound":
      case "previousRound":
        if (typeof engine.prevRound === "function") return engine.prevRound(options);
        break;
      case "adjustTime":
        if (typeof engine.adjustTime === "function") return engine.adjustTime(options);
        break;
      case "setTime":
        if (typeof engine.setTime === "function") return engine.setTime(options);
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
        if (typeof engine.startTimer === "function") return engine.startTimer(options);
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
      case "revealSlot":
        if (typeof engine.revealSlot === "function") return engine.revealSlot(options);
        break;
      case "loadPuzzleById":
        if (typeof engine.loadPuzzleById === "function") return engine.loadPuzzleById(options);
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
    return {
      activeGameId: this.activeGameId,
      availableGames: this.getAvailableGames(),
      ...(active ? active.getAdminPayload() : {})
    };
  }
}

export const gameRegistry = new GameRegistry();
