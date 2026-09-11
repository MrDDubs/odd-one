#!/usr/bin/env bash
# Ally's Odd One Out - macOS One-Click Launcher
cd "$(dirname "$0")"

echo "=========================================="
echo "  🌸 Ally's Odd One Out - TikTok Live 🌸"
echo "=========================================="
echo ""

# Check if node is installed
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not found on your Mac!"
  echo "👉 Please install Node.js (LTS version) from: https://nodejs.org/"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm install
fi

echo "🚀 Starting Game Server on port 3000..."
echo "📺 Game Overlay:  http://localhost:3000/"
echo "⚙️  Admin Panel:   http://localhost:3000/admin.html"
echo ""
echo "💡 TIP: To stop the server at any time, press Ctrl + C or close this window."
echo ""

# Open Admin Panel and Game Overlay in Safari/Chrome automatically
sleep 1.5 && open "http://localhost:3000/admin.html" && open "http://localhost:3000/" &

# Start server
node server.js
