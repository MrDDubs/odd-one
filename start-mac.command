#!/usr/bin/env bash
# ==============================================================================
# Ally's Stream Hub - macOS One-Click Quick Launcher
# ==============================================================================
cd "$(dirname "$0")"

# Ensure common macOS paths (Homebrew Apple Silicon, Homebrew Intel, NVM, MacPorts) are available
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh" 2>/dev/null
fi

echo "======================================================"
echo "  🌸 Ally's Stream Hub - Unified TikTok Live Games 🌸"
echo "======================================================"
echo ""

# Check if node is installed
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js was not found on your Mac!"
  echo "👉 Please install Node.js (v18 or higher) from: https://nodejs.org/"
  echo "   or run: brew install node"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm install
fi

PORT="${PORT:-4000}"

echo "🚀 Starting Ally's Stream Hub Server on port ${PORT}..."
echo "🕹️  Admin Overlay: http://localhost:${PORT}/admin-overlay"
echo "📺 Stream Overlay: http://localhost:${PORT}/overlay"
echo ""
echo "💡 TIP: To stop the server at any time, press Ctrl + C or close this window."
echo ""

# Automatically open Admin Overlay and Stream Overlay in default browser
(sleep 2 && open "http://localhost:${PORT}/admin-overlay" && open "http://localhost:${PORT}/overlay") &

# Start server
node server.js
