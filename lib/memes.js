const path = require('node:path');
const fs = require('node:fs');
const fsp = fs.promises;
const { ROOT } = require('./config');

const OVERLAYS_DATA = path.join(ROOT, 'work', 'data', 'overlays', 'catalog.json');
const PUBLIC_MEMES_DIR = path.join(ROOT, 'public', 'assets', 'memes');
const PUBLIC_SFX_DIR = path.join(ROOT, 'public', 'assets', 'sfx');

const MEME_CATALOG = [
  {
    id: 'mind_blown',
    name: 'Mind Blown',
    icon: '🤯',
    tagline: 'Insane discovery or shocking twist',
    imageFile: 'mind_blown.png',
    soundFile: 'boom.mp3',
    keywords: ['mind blown', 'insane', 'crazy', 'unbelievable', 'shocking', 'omg', 'impossible', 'what on earth', 'no way'],
    defaultDuration: 2.0,
    defaultPosition: 'center',
    defaultScale: 0.55
  },
  {
    id: 'skull_bruh',
    name: 'Bruh Moment / Skull',
    icon: '💀',
    tagline: 'Embarrassing, awkward, or dead silent',
    imageFile: 'skull_bruh.png',
    soundFile: 'hit.mp3',
    keywords: ['bruh', 'dead', 'died', 'skull', 'bro what', 'embarrassing', 'cringe', 'awkward', 'he said what', 'bro lost'],
    defaultDuration: 2.0,
    defaultPosition: 'bottom-center',
    defaultScale: 0.52
  },
  {
    id: 'money_rain',
    name: 'Stonks / Money Rain',
    icon: '💸',
    tagline: 'Big cash, profit, sales, wealth',
    imageFile: 'money_rain.png',
    soundFile: 'cash_register.mp3',
    keywords: ['money', 'dollar', 'cash', 'rich', 'million', 'billion', 'profit', 'sales', 'stonks', 'expensive', 'wealth', 'paycheck'],
    defaultDuration: 2.2,
    defaultPosition: 'center',
    defaultScale: 0.55
  },
  {
    id: 'wait_what',
    name: 'Wait... What?!',
    icon: '❓',
    tagline: 'Confusion, double-take, hold up',
    imageFile: 'wait_what.png',
    soundFile: 'ding.mp3',
    keywords: ['wait what', 'hold up', 'wait a second', 'huh', 'what did you say', 'excuse me', 'pardon', 'are you serious'],
    defaultDuration: 1.8,
    defaultPosition: 'above-captions',
    defaultScale: 0.50
  },
  {
    id: 'emotional_damage',
    name: 'Emotional Damage!',
    icon: '💔',
    tagline: 'Brutal insult, savage roast, rejected',
    imageFile: 'emotional_damage.png',
    soundFile: 'boom.mp3',
    keywords: ['emotional damage', 'destroyed', 'ruined', 'roasted', 'violation', 'cooked', 'its over', 'done for', 'rejected'],
    defaultDuration: 2.2,
    defaultPosition: 'center',
    defaultScale: 0.55
  },
  {
    id: 'gigachad',
    name: 'Gigachad / Sigma',
    icon: '🗿',
    tagline: 'Alpha confidence, legendary move, boss',
    imageFile: 'gigachad.png',
    soundFile: 'whoosh.mp3',
    keywords: ['gigachad', 'sigma', 'chad', 'alpha', 'legend', 'boss', 'based', 'unbothered', 'respect', 'goat'],
    defaultDuration: 2.0,
    defaultPosition: 'bottom-right',
    defaultScale: 0.48
  },
  {
    id: 'fbi_warning',
    name: 'FBI Open Up!',
    icon: '🚨',
    tagline: 'Busted, caught red-handed, emergency',
    imageFile: 'fbi_warning.png',
    soundFile: 'siren.mp3',
    keywords: ['fbi', 'police', 'siren', 'arrested', 'illegal', 'caught', 'danger', 'warning', 'run', 'alert', 'emergency'],
    defaultDuration: 2.2,
    defaultPosition: 'top-center',
    defaultScale: 0.52
  },
  {
    id: 'genius_brain',
    name: '200 IQ Galaxy Brain',
    icon: '💡',
    tagline: 'Mastermind, high intelligence, genius play',
    imageFile: 'genius_brain.png',
    soundFile: 'ding.mp3',
    keywords: ['genius', 'iq', 'galaxy brain', 'smart', 'intelligence', 'idea', 'strategy', 'mastermind', 'brilliant', 'clever'],
    defaultDuration: 2.0,
    defaultPosition: 'above-captions',
    defaultScale: 0.50
  },
  {
    id: 'clutch_win',
    name: 'Massive W / Clutch',
    icon: '🏆',
    tagline: 'Victory, triumph, clutch comeback',
    imageFile: 'clutch_win.png',
    soundFile: 'cheer.mp3',
    keywords: ['clutch', 'win', 'won', 'winner', 'victory', 'champion', 'comeback', 'we did it', 'huge w', 'massive w', 'gg'],
    defaultDuration: 2.2,
    defaultPosition: 'center',
    defaultScale: 0.55
  },
  {
    id: 'rage_quit',
    name: 'Rage Quit / Lost It',
    icon: '🤬',
    tagline: 'Uncontrollable anger, scream, smashed',
    imageFile: 'rage_quit.png',
    soundFile: 'hit.mp3',
    keywords: ['rage', 'screaming', 'mad', 'angry', 'smashed', 'broke', 'lost it', 'furious', 'quit', 'uninstall', 'hate this'],
    defaultDuration: 2.0,
    defaultPosition: 'center',
    defaultScale: 0.55
  }
];

// Read custom uploaded B-roll/meme overlays
async function getCustomOverlays() {
  try {
    if (!fs.existsSync(OVERLAYS_DATA)) return [];
    const raw = await fsp.readFile(OVERLAYS_DATA, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

async function saveCustomOverlay(overlay) {
  const list = await getCustomOverlays();
  list.unshift(overlay);
  await fsp.mkdir(path.dirname(OVERLAYS_DATA), { recursive: true });
  await fsp.writeFile(OVERLAYS_DATA, JSON.stringify(list, null, 2), 'utf8');
  return overlay;
}

// Get full catalog including both built-in memes and user uploads
async function getAllOverlays() {
  const custom = await getCustomOverlays();
  const builtIn = MEME_CATALOG.map(m => ({
    ...m,
    isBuiltIn: true,
    imageUrl: `/assets/memes/${m.imageFile}`,
    soundUrl: `/assets/sfx/${m.soundFile}`,
    imagePath: path.join(PUBLIC_MEMES_DIR, m.imageFile),
    soundPath: path.join(PUBLIC_SFX_DIR, m.soundFile)
  }));
  return {
    builtIn,
    custom
  };
}

// Automatically scan transcript for punchline reaction moments
function detectClipMemes(transcript, clipStart, clipEnd, maxMemes = 2) {
  if (!transcript || !transcript.segments) return [];
  const clipDuration = Math.max(1, clipEnd - clipStart);
  const segments = transcript.segments.filter(s => s.start >= clipStart && s.end <= clipEnd);
  if (!segments.length) return [];

  const detected = [];

  for (const seg of segments) {
    const text = (seg.text || '').toLowerCase();
    const segStartRel = Math.max(0.5, seg.start - clipStart);

    // Skip first 1 second (let hook play) or last 1.5 seconds (let outro play)
    if (segStartRel < 1.0 || segStartRel > clipDuration - 2.5) continue;

    for (const meme of MEME_CATALOG) {
      const match = meme.keywords.find(kw => text.includes(kw));
      if (match) {
        // Prevent overlapping memes (must be at least 4s apart)
        const tooClose = detected.some(d => Math.abs(d.startSec - segStartRel) < 4.0);
        if (!tooClose) {
          detected.push({
            memeId: meme.id,
            name: meme.name,
            icon: meme.icon,
            startSec: Number(segStartRel.toFixed(1)),
            duration: meme.defaultDuration,
            position: meme.defaultPosition,
            scale: meme.defaultScale,
            soundEnabled: true,
            soundFile: meme.soundFile,
            imageFile: meme.imageFile,
            imageUrl: `/assets/memes/${meme.imageFile}`,
            soundUrl: `/assets/sfx/${meme.soundFile}`,
            triggerWord: match
          });
          if (detected.length >= maxMemes) break;
        }
      }
    }
    if (detected.length >= maxMemes) break;
  }

  // If no specific keyword triggered, but user has autoMemes enabled and clip is > 20s,
  // pick one climactic punchline moment around 60% into the clip with a fun reaction!
  if (detected.length === 0 && clipDuration >= 20) {
    const midPoint = Number((clipDuration * 0.58).toFixed(1));
    const fallbackMeme = MEME_CATALOG[0]; // mind_blown
    detected.push({
      memeId: fallbackMeme.id,
      name: fallbackMeme.name,
      icon: fallbackMeme.icon,
      startSec: midPoint,
      duration: fallbackMeme.defaultDuration,
      position: fallbackMeme.defaultPosition,
      scale: fallbackMeme.defaultScale,
      soundEnabled: true,
      soundFile: fallbackMeme.soundFile,
      imageFile: fallbackMeme.imageFile,
      imageUrl: `/assets/memes/${fallbackMeme.imageFile}`,
      soundUrl: `/assets/sfx/${fallbackMeme.soundFile}`,
      triggerWord: 'climactic moment'
    });
  }

  return detected;
}

module.exports = {
  MEME_CATALOG,
  getAllOverlays,
  getCustomOverlays,
  saveCustomOverlay,
  detectClipMemes,
  PUBLIC_MEMES_DIR,
  PUBLIC_SFX_DIR
};
