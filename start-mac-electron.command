#!/usr/bin/env bash
# Ally's Odd One Out - macOS Electron App Launcher
cd "$(dirname "$0")"

echo "=========================================="
echo "  🌸 Ally's Odd One Out - Electron App 🌸"
echo "=========================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not found on your Mac!"
  echo "👉 Please install Node.js from: https://nodejs.org/"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🚀 Launching Ally's Odd One Out Desktop App..."
npx electron .
