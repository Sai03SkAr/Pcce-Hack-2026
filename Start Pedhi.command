#!/bin/bash
# Double-click to run Pedhi on this Mac: installs on first run, starts on port 3100, opens the browser.
cd "$(dirname "$0")/pedhi" || exit 1
command -v node >/dev/null || { echo "Install Node.js 20+ from https://nodejs.org first."; read -r; exit 1; }
[ -d node_modules ] || npm install || { echo "npm install failed. Check the internet connection."; read -r; exit 1; }
[ -f .env.local ] || cp .env.example .env.local
(sleep 6 && open "http://localhost:3100") &
# For phones: run `npx cloudflared tunnel --url http://localhost:3100` in another terminal (see PEDHI_GUIDE.md step 3).
npm run dev -- -p 3100
