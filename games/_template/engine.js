// games/_template/engine.js (ESM)
// Standard Game Engine Template conforming to GameRegistry contracts

export class TemplateGameEngine {
  constructor() {
    this.id = "template";
    this.name = "Template Game";
    this.currentRound = 1;
    this.timer = 45;
    this.maxTimer = 45;
    this.timerRunning = false;
    this.currentQuestion = null;
    this.streak = 0;
  }

  startRound() {
    this.currentRound++;
    this.timer = this.maxTimer;
    this.timerRunning = true;
    return this.getPublicPayload();
  }

  tick() {
    if (!this.timerRunning) return { changed: false };
    if (this.timer > 0) {
      this.timer--;
      const timeExpired = this.timer <= 0;
      if (timeExpired) {
        this.timerRunning = false;
      }
      return { changed: true, timeExpired };
    }
    return { changed: false };
  }

  handleChat(user, comment) {
    // Process chat guess logic
    return { isCorrect: false };
  }

  getPublicPayload() {
    return {
      gameId: this.id,
      round: this.currentRound,
      timer: this.timer,
      timerRunning: this.timerRunning,
      streak: this.streak
    };
  }

  getAdminPayload() {
    return {
      ...this.getPublicPayload(),
      // Add secret cheat answers here for the host
    };
  }
}
