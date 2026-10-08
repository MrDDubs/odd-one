# Game Template & Design System Guidelines

Use this folder as the starter boilerplate for any new game in **Ally's Stream Hub**.

---

## 🎨 Design System Rules (DO NOT BREAK)

1. **Always Link `/theme.css` First**:
   All global fonts (`Fredoka`, `Outfit`, `Plus Jakarta Sans`), colors, timer components, and aspect ratio variables are governed by `/theme.css`.
   ```html
   <link rel="stylesheet" href="/theme.css">
   <link rel="stylesheet" href="/speech-bubble.css">
   <link rel="stylesheet" href="./overlay.css">
   ```

2. **Never Hardcode Hex Colors in Game CSS**:
   Use CSS variables:
   - `var(--brand-purple)` instead of `#a855f7`
   - `var(--brand-pink)` instead of `#ec4899`
   - `var(--brand-gold)` instead of `#f59e0b`
   - `var(--glass-bg)` instead of hardcoded RGBA gradients
   - `var(--glass-border)` and `var(--glass-shadow)`

3. **Standard Component Markup**:
   - Mascot Card: `<header class="glass brand-card">` with `.brand-avatar-wrap` and `.avatar-speech-bubble`.
   - Sub-Header Row: `<div class="sub-header-row">` with `.game-info-pill` and `.timer-pill`.
   - Rule Banner: `<div class="rule-banner">`.
   - Streak Pill: `<div class="streak-pill">`.

4. **Aspect Ratio**:
   All games render inside `.overlay-app` (10:16 aspect ratio). Do not override width/height unless creating an intentional full-canvas graphic.

---

## 🚀 How to Create a New Game

1. Copy this `games/_template/` folder and rename it (e.g., `games/my-new-game/`).
2. Implement your game question/card UI inside `<main class="main-content">`.
3. In `engine.js`, implement `handleChat(user, comment)` and `startRound()`.
4. Register the new game in `games/registry.js`.
5. Add a button in `public/admin-overlay.html` and route in `public/overlay.js`.
