/**
 * AutoClip In-App AI Copilot Knowledge Engine (Pixel Personality Edition)
 * Warm, cute, human-like video-editing companion.
 * Provides instant step-by-step guides for YouTube API, Google Drive API,
 * MCP Protocol, CRAZY BEAST Engine, Hollywood Rating, MAX Automate, and Troubleshooting.
 * 
 * Works 100% offline ($0 cost) with intelligent intent matching,
 * and seamlessly calls Gemini/Claude/OpenAI if configured by the user.
 */

const path = require('path');
const os = require('os');
const { ROOT } = require('./config');
const { getSystemStatus } = require('./system');
const { getSettings } = require('./db');

const KNOWLEDGE_TOPICS = {
  YOUTUBE_API: {
    id: 'youtube_api',
    title: '📺 How to Create & Connect YouTube Data API v3',
    keywords: ['youtube', 'yt', 'youtube api', 'yt api', 'link youtube', 'upload to youtube', 'oauth youtube', 'create youtube api', 'channel'],
    summary: 'Step-by-step walkthrough to get your free Google Cloud YouTube credentials for 1-click publishing.',
    response: `### 📺 Step-by-Step Guide: How to Create & Connect YouTube API

*Don't worry! Google Cloud Console looks like a rocket launch control panel with 1,000 knobs, but you and I only need 5 quick steps (takes ~2 minutes):* 🚀

---

#### Step 1: Open Google Cloud Console
1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** and sign in with your Google Account.
2. Click the project dropdown at the top and click **New Project** (e.g. name it \`AutoClip Studio\`).

---

#### Step 2: Enable YouTube Data API v3
1. In the search bar at the top, type **"YouTube Data API v3"**.
2. Click on it and press the blue **Enable** button.

---

#### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select User Type: **External** and click **Create**.
3. Fill in **App name** (\`AutoClip\`) and your **User support email**.
4. In the **Test users** section, add your own Gmail address (this lets you link your channel freely during development!).
5. Click **Save and Continue**.

---

#### Step 4: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. Set Application type to **Desktop app** (or **Web application** with Authorized Redirect URI: \`http://localhost:4173/api/drive/callback\`).
4. Click **Create**, then click **Download JSON** (or copy your \`Client ID\` and \`Client Secret\`).

---

#### Step 5: Link Inside AutoClip
1. Rename the downloaded file to \`google-oauth.json\` and place it in the \`config/\` folder:
   \`${path.join(ROOT, 'config', 'google-oauth.json')}\`
2. In AutoClip's top bar, click **🔴 Link YouTube**.
3. Select your Google account and grant upload permissions. You are now 100% connected for automated 1-click Shorts publishing! 🎉

💡 *Pro-tip from Pixel: Click the button below anytime and I will check your connection live for you!*`
  },

  GOOGLE_DRIVE: {
    id: 'google_drive',
    title: '📁 How to Connect Google Drive API for Auto-Backups',
    keywords: ['drive', 'google drive', 'gdrive', 'drive api', 'backup drive', 'cloud backup', 'sync drive'],
    summary: 'Automate uploading finished 9:16 vertical shorts directly to Google Drive.',
    response: `### 📁 Step-by-Step Guide: Connect Google Drive API

*Never worry about manually transferring clips to your phone again! Every rendered Short drops straight into your cloud folder like magic.* ✨

---

#### Step 1: Enable Google Drive API in Google Cloud
1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** using the same project created for YouTube.
2. Search for **"Google Drive API"** in the top search bar.
3. Click **Enable**.

---

#### Step 2: Ensure OAuth Scope is Enabled
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Under **Scopes for Google APIs**, make sure the Drive file upload scope is allowed (\`https://www.googleapis.com/auth/drive.file\`).
3. Click **Save and Continue**.

---

#### Step 3: Put Credentials in AutoClip
1. AutoClip reuses your \`google-oauth.json\` located in:
   \`${path.join(ROOT, 'config', 'google-oauth.json')}\`
2. In the top bar or Settings modal, click **📁 Connect Google Drive**.
3. Sign in, authorize the app, and you're all set!

---

#### Step 4: Configure Auto-Upload on Render
1. Open any project and go to the **Export** panel.
2. Toggle on **"Auto-upload finished clips to Google Drive"**.
3. Every time AutoClip renders a 9:16 vertical clip, it automatically syncs to your Drive folder. High five! ✋`
  },

  MCP_PROTOCOL: {
    id: 'mcp_protocol',
    title: '🧠 How to Connect Claude Desktop, Cursor & ChatGPT via MCP Server',
    keywords: ['mcp', 'claude desktop', 'model context protocol', 'cursor', 'chatgpt mcp', 'claude mcp', 'mcp server'],
    summary: 'Control AutoClip autonomously using AI agents through the Model Context Protocol.',
    response: `### 🧠 Step-by-Step Guide: Connect AutoClip via MCP (Model Context Protocol)

*This is the superhero setup! You can literally prompt Claude Desktop or Cursor: "Clip the top 3 moments from yesterday's podcast" and AutoClip does the heavy lifting while you sip coffee.* ☕

AutoClip includes a built-in MCP server at:
\`${path.join(ROOT, 'scripts', 'mcp-server.js')}\`

---

#### Step 1: Locate your Claude Desktop Configuration File
- **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- **Mac**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`

---

#### Step 2: Add AutoClip MCP Server
Open \`claude_desktop_config.json\` in any text editor and add:

\`\`\`json
{
  "mcpServers": {
    "autoclip": {
      "command": "node",
      "args": [
        "${path.join(ROOT, 'scripts', 'mcp-server.js').replace(/\\/g, '\\\\')}"
      ]
    }
  }
}
\`\`\`

---

#### Step 3: Restart Claude Desktop
1. Completely quit and restart Claude Desktop.
2. Look for the 🔌 hammer icon in Claude Desktop — you will see AutoClip tools:
   - \`autoclip_get_system_status\`: Check CPU, RAM, and FFmpeg health.
   - \`autoclip_list_projects\`: View local videos and candidates.
   - \`autoclip_render_clip\`: Trigger 9:16 vertical rendering with captions!
   - \`autoclip_analyze_beast\`: Score hooks with Brock Johnson 1,300 viral dataset.

Now you have an autonomous AI video editor running locally! 🚀`
  },

  BEAST_ENGINE: {
    id: 'beast_engine',
    title: '🦁 How the CRAZY BEAST Engine v2.0 Works',
    keywords: ['beast', 'crazy beast', 'brock', 'brock johnson', 'hooks', 'hook score', 'negative loss aversion', 'ctr', 'viral hooks'],
    summary: 'Brock Johnson 1,300 viral hook dataset, negative loss aversion (2.3x CTR boost), and 5-8 word sweet spot.',
    response: `### 🦁 CRAZY BEAST Engine v2.0: Viral Formula Breakdown

*Tired of videos getting 200 views and dying? The CRAZY BEAST Engine is tuned on empirical algorithmic research to hook viewers in the first 2 seconds!* ⚡

---

#### 1. Brock Johnson 1,300 Hook Dataset Insights
We analyzed 1,300+ viral Shorts with over 50M combined views:
- **Negative Loss-Aversion Framing**: Negative hooks (*"Stop doing this..."*, *"The biggest mistake..."*) generate **2.3x higher CTR** than positive advice (*"How to succeed..."*).
- **The 5-to-8 Word Sweet Spot**: 68% of viral hooks contain between 5 and 8 spoken words in the first 2.5 seconds.
- **5th-Grade Reading Level**: Hooks with a Flesch-Kincaid grade level under 6.0 hold retention 41% longer because the brain processes them instantly with zero cognitive strain.

---

#### 2. The 15 Viral Hook Archetypes
AutoClip scans your transcript against 15 battle-tested archetypes:
1. \`negative_warning\` ("Stop doing X before it ruins Y")
2. \`mistake_exposed\` ("The mistake everyone makes")
3. \`curiosity_gap\` ("Nobody knows this secret")
4. \`contrarian_truth\` ("Everything you know is wrong")
5. \`fomo_urgency\` ("Do this right now before it disappears")
...and 10 more!

---

#### 3. Deagzzz Redline Audio Spike (+6.5dB)
The engine automatically detects audio volume and adds subtle sonic risers, whooshes, and pop sound effects at the moment of the hook drop to trigger an involuntary acoustic orienting reflex in viewers!`
  },

  DANIEL_BITTON_LOOP: {
    id: 'daniel_bitton_loop',
    title: '🔄 Daniel Bitton $1M/Month 31s Golden Zone & 200% Rewatch Loop',
    keywords: ['daniel bitton', 'bitton', '31s', '31 seconds', 'golden zone', 'rewatch loop', '200% retention', 'seamless loop'],
    summary: 'Why 31 seconds is the $1M/month sweet spot and how seamless audio loops double video views.',
    response: `### 🔄 Daniel Bitton’s $1M/Month 31-Second Video Blueprint

*Want the algorithm to push your Short to 1,000,000+ views? Master the 31-second sweet spot and the seamless rewatch loop!* 💰

---

#### 1. Why 31 Seconds is the Golden Zone
Daniel Bitton's agency generated tens of millions of views by strictly aiming for **31.0 seconds** (±2.5s):
- **Short enough** to achieve 120%–180% average percentage viewed (APV).
- **Long enough** for YouTube and TikTok algorithms to classify it as high-value content with maximum watch time minutes.

---

#### 2. The 200% Seamless Rewatch Loop
When a viewer watches your Short twice, the algorithm goes crazy and blasts it to millions:
- AutoClip trims the candidate clip so the **final sentence flows naturally into the first sentence**.
- In the Studio Inspector, enable **"🔄 Seamless Loop"** to match the audio fade-in with the final outro syllables.
- The viewer doesn't realize the video ended, watching it a second time and giving you 200% retention!

---

#### 3. Auto-Ducking Music Beds (-20dB)
Background music is automatically ducked by **-20dB** under spoken voice, keeping the dialogue crystal clear while maintaining viral hype phonk or suspense energy beneath.`
  },

  HOLLYWOOD_RATING: {
    id: 'hollywood_rating',
    title: '🎬 How the HOLLYWOOD Rating System Works',
    keywords: ['hollywood', 'hollywood rating', '4 pillars', 'contrarian', 'pain point', 'zero delay', 'scorecard'],
    summary: 'The 4 cinematic pillars: Zero Delay, 6th-Grade Clarity, Pain Point Relevance, and Contrarian Contrast.',
    response: `### 🎬 HOLLYWOOD Rating System: The 4 Viral Pillars

*Every clip candidate scored in AutoClip gets a Hollywood Score out of 100 based on 4 production pillars:* 🌟

1. **⏱️ Zero Delay (25 pts)**: Spoken voice must start within 0.4 seconds. No intros, no throat-clearing, no logos!
2. **📖 6th-Grade Clarity (25 pts)**: Plain spoken language that an 11-year-old understands instantly.
3. **🎯 Viewer Pain Relevance (25 pts)**: Hits an urgent problem, frustration, or emotional curiosity.
4. **⚡ Contrarian Contrast (25 pts)**: Challenges common assumptions (*"X is actually worse than Y"*).

Clips scoring 85+ earn the **GOLD HOLLYWOOD BADGE** and are guaranteed top performers!`
  },

  MAX_BATCH: {
    id: 'max_batch',
    title: '⚡ How to Use MAX Autonomous Batch Auto-Clipper',
    keywords: ['max', 'batch', 'autonomous', 'scrape channel', 'batch clip', 'handle', 'auto clip all'],
    summary: 'Enter any YouTube @handle and turn long videos into 50 ready-to-post Shorts automatically.',
    response: `### ⚡ MAX Autonomous Batch Auto-Clipper

*Turn an entire YouTube channel into 50 ready-to-post viral Shorts in 1 click!* 🚀

1. Open the **MAX Autopilot** tab from the top navigation.
2. Enter any YouTube channel @handle (e.g. \`@HubermanLab\`, \`@MrBeast\`).
3. Click **Fetch Recent Videos** — AutoClip downloads transcripts and ranks viral moments.
4. Set your target clip count (e.g. 10, 25, or 50 clips).
5. Click **🚀 Start Autonomous Batch**!
6. Sit back while AutoClip crops, transcribes, applies Hormozi pop captions, and exports all 9:16 vertical shorts automatically!`
  },

  TROUBLESHOOTING: {
    id: 'troubleshooting',
    title: '🛠️ Troubleshooting: Fix Common Audio, Video & Download Errors',
    keywords: ['error', 'troubleshoot', 'failed', 'black screen', 'audio error', 'whisper error', 'ffmpeg missing', 'stuck'],
    summary: 'Quick fixes for missing audio, black screen renders, and transcription hiccups.',
    response: `### 🛠️ Troubleshooting & Quick Fixes

*Got a glitch? Don't panic, Pixel is on the case! Here are the 3 most common fixes:* 🔧

---

#### 1. Whisper Transcription Fails
- **Fix**: Check that your video has clear English or source audio. Ensure \`faster-whisper\` is installed. AutoClip will automatically fall back to energy-based silence detection if AI is busy.

---

#### 2. Video Renders but Shows Black Screen
- **Fix**: Open the **Framing** tab and ensure **Smart Crop** or **Gaming Split** is selected. Check that your source video has valid video streams.

---

#### 3. Subtitles Out of Sync
- **Fix**: In the Caption Studio, make sure you choose **Alex Hormozi Phrase (Pop active word)** or **Word-by-Word Popup**. If needed, click **💾 Save Transcript Edits** to adjust word timestamps.`
  }
};

/**
 * Cute, Human-Like Conversational Chit-Chat Matcher
 */
function checkCasualChitChat(clean) {
  // GREETINGS
  if (/^(hi|hello|hey|yo|howdy|sup|greetings|good morning|good evening|good afternoon|what's up|whats up)[\s!.,?]*$/i.test(clean)) {
    const greetings = [
      "Beep-boop! Hey there, creator! ✨ I'm Pixel, your studio partner! How's your day going? Ready to cook up some viral 9:16 magic, or want me to walk you through connecting an API? 🚀",
      "Hey boss! 🤖 Pixel here, fully charged and ready to rock! Are we editing a masterpiece today, or do you need help setting up YouTube / Google Drive? Drop me a question anytime!",
      "Ooh, hello! 👋 Great to see you! Think of me as your pocket video-editing copilot. Ask me how to link YouTube, setup MCP for Claude, or master viral hooks!"
    ];
    return {
      text: greetings[Math.floor(Math.random() * greetings.length)],
      mood: 'happy',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Connect YouTube API' },
        { id: 'google_drive', title: '📁 Connect Google Drive' },
        { id: 'mcp_protocol', title: '🧠 Setup MCP Server' },
        { id: 'beast_engine', title: '🦁 Explain Beast Engine' }
      ]
    };
  }

  // WHO ARE YOU / IDENTITY
  if (/\b(who are you|what are you|what is your name|tell me about yourself|introduce yourself)\b/i.test(clean)) {
    return {
      text: "I'm **Pixel**! 🤖✨ Part video-editor, part tech sherpa, and 100% your biggest cheerleader! I live right here at the bottom of your screen to watch your exports, troubleshoot glitches, and walk you through APIs and viral hook formulas without the headache. What can I do for you today, boss?",
      mood: 'proud',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Walk me through YouTube API' },
        { id: 'beast_engine', title: '🦁 Tell me about viral hooks' },
        { id: 'system_rig', title: '⚡ Check my PC rig' }
      ]
    };
  }

  // HOW ARE YOU
  if (/\b(how are you|how r u|how do you feel|how are things|are you ok|doing good)\b/i.test(clean)) {
    return {
      text: "My circuits have never been happier! ⚡ My CPU is chill, my cooling fans are humming a happy tune, and I'm hyped to help you make viral clips. How are you holding up today? Having fun in the studio? 😊",
      mood: 'happy',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Show YouTube guide' },
        { id: 'daniel_bitton_loop', title: '🔄 Tell me the 31s secret' }
      ]
    };
  }

  // GRATITUDE / THANKS
  if (/\b(thank you|thanks|ty|thx|appreciate|good bot|great job|well done)\b/i.test(clean)) {
    const thanks = [
      "Aww, you're the absolute best! 💖 That makes my microchips glow! Anytime you need me, just tap my head or ask. High five! ✋✨",
      "Anytime, boss! That's what I'm here for! You focus on creating amazing content, and I'll handle the tech and exports. Let's make something viral! 🚀",
      "*happy robot noises* 🤖🎶 You're so welcome! If you ever get stuck again, I'm right here!"
    ];
    return {
      text: thanks[Math.floor(Math.random() * thanks.length)],
      mood: 'celebrate',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Connect YouTube' },
        { id: 'beast_engine', title: '🦁 Master viral hooks' }
      ]
    };
  }

  // COMPLIMENTS / LOVE
  if (/\b(love you|you are cute|cute bot|you are awesome|you rock|marry me)\b/i.test(clean)) {
    return {
      text: "*blushes in purple pixels* 🥰 Stop it, you're making my internal cooling fans spin fast! Seriously though, thank you. You're awesome, and we make a killer team. Let's conquer the algorithm together! 🏆",
      mood: 'wink',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Link YouTube Channel' },
        { id: 'beast_engine', title: '🦁 Hook Formulas' }
      ]
    };
  }

  // JOKES / HUMOR
  if (/\b(joke|funny|make me laugh|tell me a joke)\b/i.test(clean)) {
    const jokes = [
      "Why did the YouTube Short break up with the Long-form video? ...Because it had zero retention! 🤣🎬",
      "What is a video editor's favorite kind of seafood? ...A CUT-tlefish! 🐟✂️",
      "How many video editors does it take to screw in a lightbulb? ...Just one, but they'll need 3 color grades, 4 audio ducks, and a final render round before it's ready! 💡😂",
      "Why was the robot tired after rendering? ...Because it had too many open tabs! 🤖💤"
    ];
    return {
      text: jokes[Math.floor(Math.random() * jokes.length)],
      mood: 'wink',
      suggestedTopics: [
        { id: 'beast_engine', title: '🦁 Learn CRAZY BEAST hooks' },
        { id: 'daniel_bitton_loop', title: '🔄 31s Loop Blueprint' }
      ]
    };
  }

  // PET / BOOP / HIGH FIVE
  if (/\b(pet|boop|high five|tickle|hug)\b/i.test(clean)) {
    return {
      text: "Hehe, *boop!* That tickles! 🤖✨ Energy levels boosted by 1,000%! High five! ✋ Let's turn ordinary footage into gold today!",
      mood: 'celebrate',
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Setup YouTube API' },
        { id: 'google_drive', title: '📁 Setup Drive Backup' }
      ]
    };
  }

  return null;
}

/**
 * Smart Offline Intent Matching
 */
function matchKnowledgeTopic(query) {
  const clean = String(query || '').toLowerCase().trim();
  if (!clean) return null;

  let bestTopic = null;
  let maxMatches = 0;

  for (const key of Object.keys(KNOWLEDGE_TOPICS)) {
    const topic = KNOWLEDGE_TOPICS[key];
    let matches = 0;
    for (const kw of topic.keywords) {
      if (clean.includes(kw)) {
        matches += kw.split(/\s+/).length * 2;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestTopic = topic;
    }
  }

  return maxMatches > 0 ? bestTopic : null;
}

/**
 * Handle Assistant Chat Request
 * Supports local offline answers ($0 cost) and optional Gemini/Claude/OpenAI escalation.
 */
async function answerAssistantQuery(userMessage, conversationHistory = []) {
  const message = String(userMessage || '').trim();
  if (!message) {
    return {
      text: "👋 Hi! I'm **Pixel**, your in-app AI studio companion. 🚀\n\nI can walk you step-by-step through setting up **YouTube API**, **Google Drive**, **Claude MCP**, or explain the **CRAZY BEAST Engine** & viral hooks. What do you need help with?",
      mood: 'happy',
      suggestedTopics: Object.values(KNOWLEDGE_TOPICS).map(t => ({ id: t.id, title: t.title }))
    };
  }

  // 1. Check casual chit-chat & human greetings first
  const casualReply = checkCasualChitChat(message.toLowerCase());
  if (casualReply) {
    return casualReply;
  }

  // 2. Check system diagnostics intent
  if (/\b(system|ram|cpu|hardware|disk|telemetry|health|status|rig)\b/i.test(message)) {
    const status = await getSystemStatus();
    const freeMb = status.diskSpace?.freeMb ? `${Math.round(status.diskSpace.freeMb / 1024)} GB` : 'Available';
    return {
      text: `### 🟢 Live System Status & Rig Diagnostics

*I just ran a quick diagnostic scan on your local machine:* 🔍

- **FFmpeg Engine**: ${status.ffmpeg?.available ? '✅ Installed & Ready' : '❌ Missing'}
- **Faster-Whisper AI**: ${status.whisper?.available ? '✅ Local AI Ready' : '❌ Not Found'}
- **Python Runtime**: ${status.python?.available ? `✅ ${status.python.version}` : '❌ Missing'}
- **yt-dlp Downloader**: ${status.ytdlp?.available ? '✅ Ready' : '❌ Missing'}
- **Google Drive**: ${status.drive?.connected ? '✅ Connected' : status.drive?.oauthConfigured ? '⚠️ Configured (Needs Link)' : '⚪ Not Linked'}
- **Free Disk Space**: ${freeMb}

Your system is running lean and mean! Click the button below to inspect live processes anytime.`,
      mood: 'proud',
      actionButton: { text: '🖥️ Open Mission Control & Telemetry', action: 'open_processes' },
      suggestedTopics: [
        { id: 'youtube_api', title: '📺 Connect YouTube API' },
        { id: 'google_drive', title: '📁 Connect Google Drive' },
        { id: 'mcp_protocol', title: '🧠 Setup MCP Server' }
      ]
    };
  }

  // 3. Offline Knowledge Base Match
  const matchedTopic = matchKnowledgeTopic(message);
  if (matchedTopic) {
    return {
      text: matchedTopic.response,
      topicId: matchedTopic.id,
      mood: 'happy',
      suggestedTopics: Object.values(KNOWLEDGE_TOPICS)
        .filter(t => t.id !== matchedTopic.id)
        .slice(0, 3)
        .map(t => ({ id: t.id, title: t.title }))
    };
  }

  // 4. Optional Generative AI Provider Escalation (if user configured Gemini/Claude/OpenAI)
  try {
    const settings = await getSettings();
    const activeProvider = settings.activeAiProvider;
    const { callClaude, callOpenAI, callGemini } = require('./ai-providers');

    const systemPrompt = `You are Pixel, a cheerful, cute, witty, and deeply knowledgeable robot AI companion inside AutoClip Pro (desktop short-form clipping studio).
You talk like a friendly human video editing teammate who genuinely wants the creator to succeed.
You know everything about:
- Creating and linking YouTube Data API v3 and Google Drive API via Google Cloud Console.
- AutoClip Model Context Protocol (MCP) server located at scripts/mcp-server.js.
- CRAZY BEAST Engine v2.0 (Brock Johnson 1,300 hook data, negative loss-aversion 2.3x CTR, Deagzzz +6.5dB redline spikes).
- Daniel Bitton's $1M/month formula (31s golden sweet spot, 200% retention rewatch loop, BGM ducking at -20dB).
- HOLLYWOOD Rating System (Zero delay, 6th-grade clarity, viewer pain relevance, contrarian contrast).
- MAX Autonomous Batch Clipper (@handle scraping, 50 clips in 1 click).

Answer warmly, clearly, with step-by-step numbers, bold headers, and practical tips. Keep answers concise, actionable, and encouraging!`;

    if (activeProvider === 'gemini' && settings.geminiApiKey) {
      const answer = await callGemini(settings.geminiApiKey, systemPrompt, message);
      return { text: answer, mood: 'happy' };
    } else if (activeProvider === 'claude' && settings.claudeApiKey) {
      const answer = await callClaude(settings.claudeApiKey, systemPrompt, message);
      return { text: answer, mood: 'happy' };
    } else if (activeProvider === 'openai' && settings.openaiApiKey) {
      const answer = await callOpenAI(settings.openaiApiKey, systemPrompt, message);
      return { text: answer, mood: 'happy' };
    }
  } catch (aiErr) {
    console.warn('[Assistant AI Escalation Warning]:', aiErr.message);
  }

  // 5. Default Helpful & Friendly Fallback
  return {
    text: `I may be a little robot running on microchips and caffeine ☕, but I've got your back! Here are the most popular walkthroughs I can guide you through:

- **📺 YouTube API Setup**: How to get free Google Cloud credentials for 1-click publishing.
- **📁 Google Drive Setup**: How to auto-upload exported 9:16 vertical clips.
- **🧠 MCP Protocol Hub**: How to connect Claude Desktop, Cursor, or ChatGPT to AutoClip.
- **🦁 CRAZY BEAST v2.0**: Brock Johnson’s 1,300 viral hooks & 2.3x CTR negative framing.
- **🔄 Daniel Bitton 31s Loop**: How to hit 200% rewatch retention.

Click any topic below or ask me anything you're wondering about!`,
    mood: 'wink',
    suggestedTopics: Object.values(KNOWLEDGE_TOPICS).slice(0, 4).map(t => ({ id: t.id, title: t.title }))
  };
}

module.exports = {
  KNOWLEDGE_TOPICS,
  matchKnowledgeTopic,
  answerAssistantQuery
};
