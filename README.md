# AUTOCLIP (v2.0)

Personal, local-first studio for converting hours-long streams and videos into polished, caption-rendered short-form vertical clips.

---

## Quick Start (Windows)

Double-click `Start AUTOCLIP.cmd`.

The launcher will:
1. Verify that Node.js and npm dependencies are ready.
2. Start the local server in the project folder.
3. Wait until the server responds on HTTP.
4. Launch AUTOCLIP in your default desktop browser (`http://localhost:4173`).
5. Keep the server running with live logs.

Or run manually:

```powershell
npm install
npm test    # runs full verification test suite
npm start
```

---

## Features

- **Video Ingestion**: Local drag & drop video uploads (up to 100 GB) or direct stream downloading via `yt-dlp` (YouTube, Twitch, Kick, direct MP4).
- **Fast Local Whisper Transcription**: Word-level and segment-level timestamps via `faster-whisper`, language auto-detection or manual selection, persistent transcript caching, and an in-app editable transcript.
- **AI Moment Ranking**:
  - Gemini AI Pro integration (via Google AI Studio API key) analyzing dialogue hooks, emotional arcs, comedic timing, and payoffs.
  - Built-in heuristic + audio-energy moment detector (operates out-of-the-box even without an API key).
  - Transcript chunking for multi-hour streams (10-minute overlapping windows).
  - Continuous creator feedback loop (remembers accepted, rejected, and trimmed clips).
- **Interactive Review Studio**:
  - **Quick Mode**: One-click accept and render high-scoring moments.
  - **Editor Mode**: Timeline scrubber with candidate markers, looping clip preview, and fine-grained controls (split, merge, duplicate, reorder, delete, manual clip creation).
- **Full Caption Studio**:
  - Renders styled subtitles using FFmpeg ASS filters.
  - Word-by-word popups, Alex Hormozi phrase highlights, or full sentence modes.
  - Presets: *Viral Pop*, *Clean Podcast*, *Gaming Energy*, *Minimal*, *Cinematic*.
  - Font family, size, colors, highlight colors, outline, shadow, box background, position, profanity masking, and keyword-based emoji insertion.
- **Framing & Aspect Ratio Controls**:
  - 9:16 Vertical (1080×1920), 4:5 Portrait (1080×1350), 1:1 Square (1080×1080), 16:9 Horizontal (1920×1080).
  - Smart Center Crop, OpenCV Speaker / Motion Tracking with safe fallback, TikTok-style Blurred Canvas background, Split Screen (top/bottom webcam + gameplay), and Solid Color padding.
  - Top headline banner overlay, animated bottom progress bar, and safe-zone overlay toggles.
- **Google Drive Cloud Integration**:
  - Automated structured folders:
    ```text
    AUTOCLIP/
    ├── Incoming/          (Source video backups)
    ├── Processing/        (Working files)
    ├── Finished Clips/    (Completed short-form clips organized by source)
    └── Failed/            (Safely retained originals if processing fails)
    ```
  - Strict verification: checks that all outputs exist locally and on Drive before moving the source to Drive Trash.
  - Safe failure retention: never deletes originals on failure, and never permanently deletes files (only moves to Trash).
- **Windows Launcher**: Robust batch launcher with automatic pre-flight checks and background server health polling.

---

## Authentication & Setup

### 1. Google Drive (Optional Cloud Sync)
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project and enable the **Google Drive API**.
3. Go to **APIs & Services > Credentials** and click **Create Credentials > OAuth client ID**.
4. Select **Desktop app**.
5. Download the JSON credentials file and save it to:
   `config/google-oauth.json`
6. Start AUTOCLIP, click the **Google Drive** badge in the header, and click **Authorize with Google**.
7. The application requests only the narrow `https://www.googleapis.com/auth/drive.file` scope.

### 2. Offline moment ranking (default)
Clip discovery runs locally, even with a Gemini key saved. It uses the existing timestamped transcript and one-second RMS audio buckets. No cloud request, model download, or new package is required for selection. Speech transcription may still use the existing local Whisper model.

The engine compares multiple sentence endings for each eligible opening, evaluates the first three seconds, and scores pacing, resolution, standalone context, specificity, and audio contrast. Missing audio is omitted from the weighted rating. Loud music alone cannot establish a hook or payoff. Silence, repeated dialogue, promotional reads, technical delays, and unresolved endings reduce ratings. Word timestamps improve sentence boundaries and pause measurements; coarse segments cannot reveal internal silence. English phrase rules are used; other languages have limited cue coverage. Ratings are editorial comparisons, not probabilities of going viral, and no visual analysis is performed.

Version 3 also uses TF-IDF lexical cohesion to identify supported topic changes, question/explanation linkage, and setup/escalation/resolution cues. These are lexical inferences, not full semantic understanding. A BM25-based match gives custom briefs a bounded relevance bonus. Speech-recognition reliability (existing word probabilities or segment log probabilities when available) can lower ratings; unknown reliability is not fabricated. New Whisper transcripts retain segment log probabilities and no-speech estimates. Existing cached transcripts remain usable without retranscription.

Duplicate suppression now uses ordered four-word phrases rather than declaring similar vocabulary identical. General selection searches the full timeline even for large clip counts; explicit multipart requests still partition the stream. Internal evidence and score breakdowns include topic changes, question linkage, brief matches, and recognition reliability. No new dependencies or external model calls were added.

Research references: [Hearst’s TextTiling](https://people.ischool.berkeley.edu/~hearst/research/tiling.html), [Robertson and Zaragoza’s BM25 framework](https://www.nowpublishers.com/article/Details/INR-019), and [faster-whisper segment metadata](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py). Clip-specific thresholds and score adjustments are application heuristics, not findings established by these sources.

- Default minimum score: 65. Existing job settings, including higher thresholds, remain in force.
- `clipCount` is a maximum; weak or duplicate clips are never added to fill it.
- The existing 20-second minimum is enforced; maximum duration and absolute analysis windows are respected.
- `templateId`, `energyBias`, `nicheKeywords`, `hookSensitivity`, `strictBoundaries`, and `filterDeadAir` remain supported. Similar accepted/rejected feedback produces at most a five-point adjustment after three reviews.
- Candidate results include component ratings, opening/ending evidence, source confidence, warnings, and selection rank. Returned clips remain chronological.
- Click **Re-Score Clips** on an existing job to load the updated analyzer. Existing rendered videos are not changed by the code update.
- Optional cloud selection remains available to API callers using `analysisMode: "gemini"` and a configured Gemini key. The default mode never contacts Gemini.
- Run focused regressions with `node --test test/offline-analyzer.test.js`.

---

## Project Structure

```text
im-x20/
├── config/
│   └── google-oauth.example.json   # Drive OAuth template
├── lib/
│   ├── analyzer.js                 # Moment ranking, Gemini & heuristic engines
│   ├── caption.js                  # ASS subtitle synthesis, Hormozi phrase highlight, presets
│   ├── config.js                   # Presets, templates, paths, and constants
│   ├── db.js                       # Thread-safe atomic JSON database
│   ├── downloader.js               # yt-dlp stream downloading with progress
│   ├── drive.js                    # Google Drive folder management & OAuth
│   ├── job-runner.js               # Pipeline orchestration & verification
│   ├── renderer.js                 # FFmpeg framing, blur canvas, and render pipeline
│   ├── system.js                   # Dependency diagnostic checks
│   └── transcriber.js              # Faster-Whisper runner & transcript cache
├── public/
│   ├── app.js                      # Studio frontend controller & player
│   ├── index.html                  # Responsive UI layout
│   └── styles.css                  # Modern dark/acid/violet styling
├── scripts/
│   ├── face_track.py               # OpenCV speaker/motion tracker with safe fallback
│   └── transcribe.py               # Faster-Whisper audio extraction & word timestamps
├── test/
│   └── e2e.test.js                 # Automated end-to-end verification test suite
├── work/
│   ├── data/                       # Incoming videos, transcripts, finished clips
│   └── test/sample.mp4             # Test sample video
├── .agents/skills/find-best-clips/ # Upgraded Antigravity moment-ranking skill
├── Start AUTOCLIP.cmd              # Robust Windows desktop launcher
├── server.js                       # Express backend entry point
└── package.json
```
