# AUTOCLIPIN Pro Studio (v2.1)

**The autonomous, local-first short-form video clipping studio.**  
Convert hours-long podcasts, streams, and YouTube videos into high-retention 9:16 vertical Shorts, TikToks, and Reels — tuned on algorithmic retention science.

**100% Free & Open-Source ($0 API costs by default). Works completely offline.**

---

## Cross-Platform Support (Windows, macOS, Linux & Docker)

AUTOCLIPIN runs natively across all major desktop and server operating systems:

### Windows (10 / 11)
- **1-Click Installer**: Double-click `AUTOCLIPIN-Setup-2.1.0.exe` in `dist/`.
- **Portable Edition**: Run `AUTOCLIPIN-Portable-2.1.0.exe` directly without installing anything.
- **Standalone ZIP**: Extract `AUTOCLIPIN-Windows-v2.1.0.zip`.
- **Run from Source**:
  ```powershell
  npm install
  npm start
  ```

---

### macOS (Intel & Apple Silicon M1/M2/M3/M4)
Run the automated one-click macOS setup:
```bash
chmod +x setup-mac.sh
./setup-mac.sh
```
*What it does:*
1. Automatically installs FFmpeg and Python 3 via Homebrew if needed.
2. Sets up the local speech transcription and rendering environment.
3. Installs Node packages and launches the native desktop studio.

To compile a native `.dmg` installer:
```bash
npm run build:mac
```

---

### Linux (Ubuntu, Debian, Fedora, Arch, Pop!_OS)
Run the automated one-click Linux setup:
```bash
chmod +x setup-linux.sh
./setup-linux.sh
```
*What it does:*
1. Auto-detects package managers (`apt`, `dnf`, `pacman`) and installs required build dependencies.
2. Sets up local speech recognition, visual processing, and media tools.
3. Launches the studio.

To compile a standalone `.AppImage` or `.deb`:
```bash
npm run build:linux
```

---

### 🐳 Docker (Universal Server & Cloud Container)
Run AUTOCLIPIN on any Linux server, VPS, or Mac with zero dependency setup:
```bash
docker compose up -d
```
Open your browser at `http://localhost:4173`.

---

## 🦁 Algorithmic Features & Retention Engines

### 1. 🦁 CRAZY BEAST Engine v2.0
- **Brock Johnson 1,300 Hook Dataset**: Scans transcripts against 15 viral archetypes.
- **Negative Loss-Aversion Framing**: Prioritizes negative hooks (*"Stop doing this..."*, *"The biggest mistake..."*) which empirically generate **2.3x higher CTR**.
- **5-to-8 Word Sweet Spot**: Targets spoken hooks delivered within the first 2.5 seconds.
- **Deagzzz Redline Audio Spike (+6.5dB)**: Detects dialogue peaks and automatically layers acoustic risers, whooshes, and pop sound effects at the moment of the hook drop.

### 2. 🔄 Daniel Bitton $1M/Month 31s Golden Zone & 200% Loop
- **31-Second Sweet Spot**: Balances maximum watch time minutes with 120%–180% average percentage viewed (APV).
- **200% Rewatch Loop**: Analyzes candidate outro syllables to transition seamlessly back into the opening hook, doubling viewer retention.
- **Smart Audio Ducking**: Royalty-free background phonk, suspense, and lofi music beds are automatically ducked by **-20dB** under spoken voice.

### 3. 🤖 Pixel — Interactive In-App AI Studio Companion
- Docked in the studio rail to monitor renders, export health, and system telemetry.
- **Interactive Walkthroughs**: Step-by-step guides for YouTube Data API v3, Google Drive, and Claude MCP with **checkable step checklists** and celebration fanfares.
- **Live Diagnostics**: 1-click test buttons to verify API connections and PC rig hardware health.
- **Cute & Human-Like**: Cheerful personality, creator humor, and Web Audio synthesizers (boops, pops, and chimes).

### 4. 🧠 Model Context Protocol (MCP) Server
AutoClip includes a built-in MCP server at `scripts/mcp-server.js` allowing **Claude Desktop**, **Cursor**, and **ChatGPT** to autonomously find clips, score hooks, and trigger renders via natural language.

### 5. ⚡ 1-Click Publishing & Automated Cloud Sync
- **YouTube Shorts**: Publish 9:16 Shorts directly to your channel using official OAuth credentials.
- **Google Drive Backup**: Automatically upload finished vertical MP4s to your phone-linked Google Drive.

---

## 🛠️ System Verification Tests

Run the full end-to-end verification suite anytime:
```bash
npm test
```
Runs system diagnostics, FFprobe dimension checks, Faster-Whisper transcription, moment ranking, Hormozi subtitle generation, and renders an actual 9:16 vertical test clip.

---

## 📄 License
MIT / Personal Studio License. Crafted with precision for creators.
