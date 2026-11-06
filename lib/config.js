const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const defaultDataDir = (fs.existsSync('D:\\AutoClip_Data') || fs.existsSync('D:\\'))
  ? 'D:\\AutoClip_Data'
  : path.join(ROOT, 'work', 'data');
const DATA = process.env.AUTOCLIP_DATA_DIR || defaultDataDir;
const INCOMING = path.join(DATA, 'incoming');
const FINISHED = path.join(DATA, 'finished');
const TRANSCRIPTS = path.join(DATA, 'transcripts');
const WATERMARKS_DIR = path.join(DATA, 'watermarks');
const JOBS_FILE = path.join(DATA, 'jobs.json');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const PRESETS_FILE = path.join(DATA, 'presets.json');
const FEEDBACK_FILE = path.join(DATA, 'feedback.json');
const ACCOUNTS_FILE = path.join(DATA, 'accounts.json');
const POSTS_FILE = path.join(DATA, 'posts.json');
const POST_LOGS_FILE = path.join(DATA, 'post-logs.json');
const TOKEN_FILE = path.join(DATA, 'google-token.json');
const TOKENS_DIR = path.join(DATA, 'tokens');
const OAUTH_FILE = path.join(ROOT, 'config', 'google-oauth.json');

if (!fs.existsSync(TOKENS_DIR)) {
  fs.mkdirSync(TOKENS_DIR, { recursive: true });
}

const DEFAULT_ACCOUNTS = [
  { id: 'acc_1', name: 'Main Brand Clips', handle: '@CodyClips_HQ', platform: 'tiktok', enabled: true, category: 'Main Brand', avatarColor: '#fe2c55', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_2', name: 'Daily Shorts Network', handle: '@DailyShorts_US', platform: 'shorts', enabled: true, category: 'Shorts Global', avatarColor: '#ff0000', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_3', name: 'Reels Viral 01', handle: '@ReelsViral_HQ', platform: 'reels', enabled: true, category: 'Instagram Fanpage', avatarColor: '#e1306c', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_4', name: 'Podcast Clips Vault', handle: '@PodClipsVault', platform: 'tiktok', enabled: true, category: 'Podcast Vault', avatarColor: '#fe2c55', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_5', name: 'Shorts Global HQ', handle: '@ShortsGlobal_Off', platform: 'shorts', enabled: true, category: 'YouTube Global', avatarColor: '#ff0000', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_6', name: 'Viral Moments IG', handle: '@ViralMoments_IG', platform: 'reels', enabled: true, category: 'Instagram Reels', avatarColor: '#e1306c', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_7', name: 'X Clips Hub', handle: '@BreakingClips_X', platform: 'twitter', enabled: true, category: 'X / Twitter Feed', avatarColor: '#1da1f2', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_8', name: 'Streamer FB Reels', handle: '@StreamerReels_FB', platform: 'facebook', enabled: true, category: 'FB Reels Network', avatarColor: '#1877f2', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_9', name: 'Trending TikTok #2', handle: '@TrendPulse_TT', platform: 'tiktok', enabled: true, category: 'Growth Experiments', avatarColor: '#fe2c55', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_10', name: 'Shorts Archive B', handle: '@ShortsVault_B', platform: 'shorts', enabled: true, category: 'Backup Channel', avatarColor: '#ff0000', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_11', name: 'Daily Motivation Reels', handle: '@ReelsDaily_Drip', platform: 'reels', enabled: true, category: 'Reels Drip', avatarColor: '#e1306c', apiToken: '', privacy: 'public', directPosting: true },
  { id: 'acc_12', name: 'Alpha Clippers Empire', handle: '@EmpireClips', platform: 'tiktok', enabled: true, category: 'Agency Account', avatarColor: '#fe2c55', apiToken: '', privacy: 'public', directPosting: true }
];

const TEMPLATES = [
  {
    id: 'viral',
    name: 'Viral Energy',
    description: 'High-pace, shocking, or funny moments with punchy delivery and high retention.',
    length: 35,
    minDuration: 20,
    maxDuration: 60,
    color: '#d8ff3e',
    promptCriteria: 'Focus on high emotion, unexpected twists, fast banter, or intense moments with an instant hook in the first 3 seconds.'
  },
  {
    id: 'funny',
    name: 'Funny Moments',
    description: 'Comedy, bloopers, sudden fails, laughing fits, and witty comebacks.',
    length: 30,
    minDuration: 20,
    maxDuration: 60,
    color: '#ff4d6d',
    promptCriteria: 'Identify comedic timing, punchlines, contagious laughter, absurd remarks, or funny failures.'
  },
  {
    id: 'gaming',
    name: 'Gaming Highlights',
    description: 'Clutch plays, hype victories, hilarious fails, and big game reactions.',
    length: 45,
    minDuration: 20,
    maxDuration: 75,
    color: '#7157ff',
    promptCriteria: 'Find intense clutch plays, screams of victory or defeat, unexpected game physics bugs, or peak gamer hype.'
  },
  {
    id: 'insight',
    name: 'Educational Insights',
    description: 'Actionable tips, life advice, deep explanations, and standalone thought-provokers.',
    length: 50,
    minDuration: 25,
    maxDuration: 90,
    color: '#32d6c5',
    promptCriteria: 'Extract standalone advice, counter-intuitive facts, aha-moments, or clear explanations that deliver value without prior context.'
  },
  {
    id: 'story',
    name: 'Storytelling',
    description: 'Narrative arcs with clear exposition, rising action, and satisfying payoff.',
    length: 60,
    minDuration: 30,
    maxDuration: 120,
    color: '#ff9f43',
    promptCriteria: 'Look for personal anecdotes, suspenseful stories, or drama with a clear beginning, middle conflict, and punchy resolution.'
  },
  {
    id: 'reactions',
    name: 'Reactions',
    description: 'Genuine shock, awe, disgust, or hype in response to media or events.',
    length: 35,
    minDuration: 20,
    maxDuration: 60,
    color: '#00d2d3',
    promptCriteria: 'Highlight authentic emotional reactions, jaw-drop moments, visceral laughs, or heated debates.'
  },
  {
    id: 'podcast',
    name: 'Podcast Highlights',
    description: 'Intriguing questions, heated discussions, and deep insights from conversations.',
    length: 55,
    minDuration: 25,
    maxDuration: 90,
    color: '#54a0ff',
    promptCriteria: 'Extract engaging conversational exchanges, controversial viewpoints, humorous banter, or memorable guest quotes.'
  },
  {
    id: 'custom',
    name: 'Custom Instructions',
    description: 'Describe your own custom criteria for finding specific moments.',
    length: 40,
    minDuration: 20,
    maxDuration: 90,
    color: '#ffffff',
    promptCriteria: 'Follow the user custom brief meticulously.'
  }
];

const CAPTION_PRESETS = [
  {
    id: 'lemon-milk-speed',
    name: '🍋 Lemon Milk Bold (iShowSpeed & Deagzzz)',
    description: 'The #1 viral clipping font: Lemon Milk Bold with heavy shadow, emotion-based color pops & dynamic zoom punch.',
    fontFamily: 'Lemon Milk, Arial Black, Impact',
    fontWeight: '900',
    fontSize: 66,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFE600',
    outlineColor: '#000000',
    outlineWidth: 8,
    shadowWidth: 5,
    shadowColor: '#000000',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.6)',
    position: 'center',
    yOffset: 120,
    displayMode: 'word',
    wordsPerLine: 2,
    casing: 'uppercase',
    profanityMask: true,
    emojiEnabled: true,
    animation: 'pop'
  },
  {
    id: 'viral-pop',
    name: 'Viral Pop (Hormozi)',
    description: 'High-retention 2-3 word phrases with neon-yellow highlight & pop bounce animation.',
    fontFamily: 'Arial',
    fontWeight: '900',
    fontSize: 60,
    primaryColor: '#FFFFFF',
    highlightColor: '#D8FF3E',
    outlineColor: '#000000',
    outlineWidth: 6,
    shadowWidth: 3,
    shadowColor: '#000000',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.6)',
    position: 'bottom', // 'bottom' | 'center' | 'top'
    yOffset: 280,
    displayMode: 'phrase', // 'word' | 'phrase' | 'sentence'
    wordsPerLine: 3,
    casing: 'uppercase', // 'uppercase' | 'title' | 'as_spoken'
    profanityMask: true,
    emojiEnabled: true,
    animation: 'pop' // 'pop' | 'karaoke' | 'fade' | 'none'
  },
  {
    id: 'hormozi-punch',
    name: 'Alex Hormozi Impact',
    description: 'Ultra-bold Impact font with heavy 7px outline and electric yellow punch.',
    fontFamily: 'Impact',
    fontWeight: '900',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFE600',
    outlineColor: '#000000',
    outlineWidth: 7,
    shadowWidth: 4,
    shadowColor: '#000000',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.6)',
    position: 'bottom',
    yOffset: 280,
    displayMode: 'phrase',
    wordsPerLine: 3,
    casing: 'uppercase',
    profanityMask: true,
    emojiEnabled: true,
    animation: 'pop'
  },
  {
    id: 'beast-electric',
    name: 'MrBeast Electric',
    description: 'Rapid cut 1-2 words with electric cyan highlights and high-contrast outline.',
    fontFamily: 'Impact',
    fontWeight: '900',
    fontSize: 66,
    primaryColor: '#FFFFFF',
    highlightColor: '#00F2FE',
    outlineColor: '#000000',
    outlineWidth: 7,
    shadowWidth: 4,
    shadowColor: '#000000',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.5)',
    position: 'bottom',
    yOffset: 280,
    displayMode: 'word',
    wordsPerLine: 2,
    casing: 'uppercase',
    profanityMask: false,
    emojiEnabled: true,
    animation: 'pop'
  },
  {
    id: 'clean-podcast',
    name: 'Clean Podcast',
    description: 'Understated, clean phrase captions positioned for podcast clarity.',
    fontFamily: 'Arial',
    fontWeight: '700',
    fontSize: 48,
    primaryColor: '#FFFFFF',
    highlightColor: '#32D6C5',
    outlineColor: '#000000',
    outlineWidth: 3,
    shadowWidth: 1,
    shadowColor: '#000000',
    boxEnabled: true,
    boxColor: 'rgba(15,15,20,0.7)',
    position: 'bottom',
    yOffset: 260,
    displayMode: 'phrase',
    wordsPerLine: 4,
    casing: 'as_spoken',
    profanityMask: true,
    emojiEnabled: false,
    animation: 'fade'
  },
  {
    id: 'gaming-energy',
    name: 'Gaming Energy',
    description: 'Italic fire styling with red & orange glow for high-adrenaline moments.',
    fontFamily: 'Impact',
    fontWeight: '900',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    highlightColor: '#FF4D6D',
    outlineColor: '#000000',
    outlineWidth: 6,
    shadowWidth: 4,
    shadowColor: '#FF9F43',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.5)',
    position: 'center',
    yOffset: 0,
    displayMode: 'word',
    wordsPerLine: 2,
    casing: 'uppercase',
    profanityMask: false,
    emojiEnabled: true,
    animation: 'pop'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, elegant white subtitles with subtle shadow for clean storytelling.',
    fontFamily: 'Arial',
    fontWeight: '600',
    fontSize: 42,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFFFFF',
    outlineColor: '#171714',
    outlineWidth: 2,
    shadowWidth: 1,
    shadowColor: '#171714',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.4)',
    position: 'bottom',
    yOffset: 220,
    displayMode: 'sentence',
    wordsPerLine: 6,
    casing: 'as_spoken',
    profanityMask: false,
    emojiEnabled: false,
    animation: 'none'
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Letter-spaced serif styling with golden highlights for dramatic stories.',
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 46,
    primaryColor: '#F4F0E8',
    highlightColor: '#FFD700',
    outlineColor: '#000000',
    outlineWidth: 3,
    shadowWidth: 3,
    shadowColor: '#000000',
    boxEnabled: false,
    boxColor: 'rgba(0,0,0,0.6)',
    position: 'bottom',
    yOffset: 220,
    displayMode: 'phrase',
    wordsPerLine: 4,
    casing: 'as_spoken',
    profanityMask: true,
    emojiEnabled: false,
    animation: 'fade'
  }
];

const FRAMING_PRESETS = [
  {
    id: 'smart-crop',
    name: 'Smart Crop / Center',
    aspectRatio: '9:16', // '9:16' | '4:5' | '1:1' | '16:9'
    mode: 'smart', // 'smart' | 'face' | 'blur' | 'color' | 'split'
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#D8FF3E',
    safeZone: true
  },
  {
    id: 'face-track',
    name: 'Speaker / Face Track',
    aspectRatio: '9:16',
    mode: 'face',
    zoom: 1.1,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#7157FF',
    safeZone: true
  },
  {
    id: 'blurred-bg',
    name: 'Blurred Canvas',
    aspectRatio: '9:16',
    mode: 'blur',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#D8FF3E',
    safeZone: true
  },
  {
    id: 'split-screen',
    name: 'Split Screen (Cam + Game)',
    aspectRatio: '9:16',
    mode: 'split',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#FF9F43',
    safeZone: true
  },
  {
    id: 'gaming-split',
    name: '🎮 Gaming Split (Facecam Top + Gameplay Bottom)',
    description: 'Auto-crops streamer facecam to top half and centered gameplay screen to bottom half.',
    aspectRatio: '9:16',
    mode: 'gaming_split',
    webcamPosition: 'top-right',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#D8FF3E',
    safeZone: true
  },
  {
    id: 'face-stack',
    name: '👥 Duo FaceTime / Call (One Face Above & One Below)',
    description: 'Auto-crops 2-person video call/FaceTime/Discord into vertically stacked top and bottom faces.',
    aspectRatio: '9:16',
    mode: 'face_stack',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#7157FF',
    safeZone: true
  },
  {
    id: 'auto-stream',
    name: '⚡ Auto-Detect Stream Format (Gaming / FaceTime / Chat)',
    description: 'Automatically chooses Gaming Split for gaming, Duo Stack for FaceTime calls, or Smart Crop for chat.',
    aspectRatio: '9:16',
    mode: 'auto',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000',
    headline: '',
    progressBar: true,
    progressColor: '#00F2FE',
    safeZone: true
  }
];

const ASPECT_RATIOS = {
  '9:16': { width: 1080, height: 1920, label: '9:16 Vertical (TikTok, Shorts, Reels)' },
  '4:5': { width: 1080, height: 1350, label: '4:5 Portrait (Instagram Feed)' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square (Feed, X / Twitter)' },
  '16:9': { width: 1920, height: 1080, label: '16:9 Horizontal (YouTube, Standard)' }
};

module.exports = {
  ROOT,
  DATA,
  INCOMING,
  FINISHED,
  TRANSCRIPTS,
  WATERMARKS_DIR,
  JOBS_FILE,
  SETTINGS_FILE,
  PRESETS_FILE,
  FEEDBACK_FILE,
  ACCOUNTS_FILE,
  POSTS_FILE,
  POST_LOGS_FILE,
  DEFAULT_ACCOUNTS,
  TOKEN_FILE,
  TOKENS_DIR,
  OAUTH_FILE,
  TEMPLATES,
  CAPTION_PRESETS,
  FRAMING_PRESETS,
  ASPECT_RATIOS
};
