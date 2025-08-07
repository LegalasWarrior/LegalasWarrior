# MMO-RPG (Browser + WebSocket)

A tiny MMO-RPG demo with combat, gathering, skills, inventory, and upgrades.

## Run with ZERO local setup (recommended)

### Option A: Docker (only Docker required)
1. Install Docker Desktop: https://www.docker.com/get-started
2. In a terminal inside this folder:
   ```bash
   docker build -t mmo-rpg .
   docker run --rm -p 3000:3000 mmo-rpg
   ```
3. Open http://localhost:3000 in your browser.

### Option B: Online (no install at all)
- Replit:
  1) Go to https://replit.com → Create Repl → Import from GitHub or Upload this folder as a zip
  2) Shell:
     ```bash
     npm install
     npm start
     ```
  3) Click the WebView link Replit shows

## Run locally (Node.js)
1. Install Node.js LTS from https://nodejs.org
2. In a terminal inside this folder:
   ```bash
   npm install
   npm start
   ```
3. Open http://localhost:3000

## Controls
- WASD / Arrows: move
- Space: attack
- E: gather
- 1: upgrade weapon
- 2: upgrade armor