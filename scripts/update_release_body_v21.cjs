const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.argv[2];
if (!GITHUB_TOKEN) {
  console.error('Error: Token required');
  process.exit(1);
}
const OWNER = 'yashcursed-a11y';
const REPO = 'autoclip';
const RELEASE_ID = 441010774;

const body = `## AutoClip Studio v2.1.0 - Windows Release

Complete autonomous clipping studio with smart neural face tracking, kinetic typography, and direct phone preview flow.

### What's New in v2.1.0
- **Complete All-In-One Package**: All engines (FFmpeg, FFprobe, stream ingestion, offline speech recognition, neural face tracking) are pre-bundled in a single standalone folder. Zero external installations or setup needed.
- **Full AI Auto-Edit Toggle on Main Page**: Generate, trim, crop, and polish viral highlights directly from the start.
- **Direct Phone Preview Feed**: Instant vertical preview with optional CapCut-style timeline studio editing.
- **Updated Rate Structure**:
  - Starter Free Pass: 70 reels every week (100% free with automatic weekly reset).
  - AUTOCLIPIN Max ($20 / ₹1,499/mo): 50 reels per day (~1,500 reels/month).
  - Ultra Studio ($50/mo) & Yearly VIP ($200/yr): Unlimited 4K vertical exports.
- **Smart Neural Face Tracking**: Dynamic 9:16 auto-framing with smooth speaker centering.
- **Minimal UI Default**: Clean, distraction-free editing layout with ambient motion background.
- **Direct PhonePe / UPI QR Checkout**: Instant activation via UPI ID (9183352545@ibl) and Union Bank of India.

### Downloads
- **AUTOCLIPIN-v2.1.0-Ultimate-Creator-Bundle-Windows.zip** (Recommended, ~100% Self-Contained): The ultimate offline creator bundle. Includes the complete standalone Python AI runtime, all speech transcription models, neural face tracking, and FFmpeg rendering engines in one single folder. Extract and double-click \`Launch-AutoClip.bat\` or \`AUTOCLIPIN.exe\`. Zero Python or external dependencies needed.
- **AUTOCLIPIN-v2.1.0-Complete-All-Engines-Windows.zip** (404 MB): Lightweight standalone folder with pre-bundled FFmpeg, models, and binaries.
- **AUTOCLIPIN-Setup-2.1.0.exe** (125 MB): Standard Windows installer with desktop and start menu shortcuts.
- **AUTOCLIPIN-Portable-2.1.0.exe** (113 MB): Single executable zero-install portable edition.
`;

const postData = JSON.stringify({
  body,
  make_latest: 'true'
});

const req = https.request({
  hostname: 'api.github.com',
  path: `/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}`,
  method: 'PATCH',
  headers: {
    'User-Agent': 'NodeJS',
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Release body updated. Status:', res.statusCode));
});

req.on('error', console.error);
req.write(postData);
req.end();
