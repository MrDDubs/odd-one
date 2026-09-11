# Ally's Odd One Out — TikTok Live Game

Interactive TikTok Live odd-one-out guessing game with real-time **TikFinity** integration and a full-featured **Admin Control Panel**.

---

## 🎮 Features
- **Faithful 9:16 Vertical Design**: Tailored for TikTok Live & OBS overlays with high-resolution SVG artwork.
- **6×4 Grid (24 Cells)**: Columns A–F and Rows 1–4 (e.g., A1 to F4).
- **8 Dynamic Categories**: Fruit, Bear, Cloud, Flower, Boba, Cupcake, Controller, and Star.
- **5 Progressive Difficulty Levels**:
  - Level 1: EASY (20s)
  - Level 2: MEDIUM (18s)
  - Level 3: HARD (16s)
  - Level 4: EXPERT (14s)
  - Level 5: CHAOS (12s)
- **TikFinity Integration**: Automatically extracts coordinates (`A1` to `F4`) from live stream chat comments.
- **Host Admin Panel**:
  - **Secret Answer Cheat Sheet**: Host sees the secret target coordinate and category in advance.
  - **Round Controls**: Start, Next, Reveal, Pause/Resume, and Reset Game.
  - **Difficulty & Presets**: 12s, 14s, 16s, 18s, 20s, 30s timers + manual category/level overrides.
  - **Test Simulator**: Test guesses and winning triggers without going live on TikTok.
  - **Live Chat Guesses Feed**: View real-time parsed viewer answers with correct/wrong indicators.
  - **Leaderboard**: Displays community winners and top streaks.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Game Server
```bash
npm start
```
By default, the server runs on port `3000`.

- **Game Overlay Screen**: [http://localhost:3000/](http://localhost:3000/)
- **Host Admin Panel**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🔗 Connecting TikFinity

1. Open the **TikFinity Desktop Application**.
2. Connect your TikTok account live stream in TikFinity.
3. In TikFinity, navigate to **Event API / Actions** or **WebSocket Server**.
4. Ensure the WebSocket server is running on `ws://localhost:21213/` (the default port).
5. The game server will automatically connect to TikFinity.
6. The status pill on both the Game and Admin panel will turn green:
   `🟢 TikFinity Connected • LIVE chat ready`

---

## 🎥 OBS Studio Setup

1. In OBS Studio, add a new **Browser Source**.
2. Set the **URL** to:
   ```
   http://localhost:3000/
   ```
3. Set the dimensions:
   - **Width**: `1080`
   - **Height**: `1920` (or `720 x 1280` depending on your canvas)
4. Check **"Shutdown source when not visible"** (optional) and **"Refresh browser when scene becomes active"**.
5. Keep `http://localhost:3000/admin.html` open on your secondary screen or phone to control the game while streaming!

---

## 🧪 Testing Offline (Admin Simulator)

You don't need to be live on TikTok to test the game:
1. Open `http://localhost:3000/admin.html` in your browser.
2. In the **Live Test Simulator** card:
   - Click **"🎯 Simulate Correct Guess"** to test a winning viewer trigger.
   - Click **"🎲 Random Guess"** or type a custom coordinate like `A4` and click **"Submit Guess"**.
3. Watch the game screen update with sounds, box highlights, streak updates, and next round transitions!

---

## 🍏 Running on macOS

### Option 1: 1-Click Desktop App (Electron)
```bash
npm run electron
```
Or simply double-click `start-mac-electron.command` in macOS Finder!

### Option 2: 1-Click Web & Server Launcher
Double-click `start-mac.command` in macOS Finder:
- Automatically checks Node.js & dependencies
- Starts the server on port `3000`
- Automatically opens both the Game Overlay and Host Admin Panel in Safari or Chrome

### Option 3: Terminal
```bash
cd path/to/odd-one
npm install
npm start
```
To stop the server at any time on Mac, press `Ctrl + C` in the Terminal window.

---

## 📦 Automated Mac Electron Build (.dmg & .zip)

This repository includes a GitHub Actions workflow (`.github/workflows/build-mac.yml`):
1. Go to the **Actions** tab in the GitHub repo: [https://github.com/MrDDubs/odd-one/actions](https://github.com/MrDDubs/odd-one/actions).
2. Every push automatically builds native macOS `.dmg` and `.zip` packages on Apple Silicon and Intel.
3. Download the artifact `Allys-Odd-One-Out-macOS` with one click!
