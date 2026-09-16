#!/usr/bin/env bash
# ==============================================================================
# Ally's Stream Hub - macOS Desktop App (Electron) Launcher
# ==============================================================================
cd "$(dirname "$0")"

# Ensure common macOS paths (Homebrew Apple Silicon, Homebrew Intel, NVM, MacPorts) are available
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh" 2>/dev/null
fi

echo "======================================================"
echo "  🌸 Ally's Stream Hub - Desktop App (Electron) 🌸"
echo "======================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js was not found on your Mac!"
  echo "👉 Please install Node.js (v18 or higher) from: https://nodejs.org/"
  echo "   or run: brew install node"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm install
fi

echo "🚀 Launching Ally's Stream Hub Desktop App..."
npm run electron
