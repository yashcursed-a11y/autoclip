/**
 * AutoClip Universal AI Intelligence Engine
 * Unifies Local Offline v3, Anthropic Claude, OpenAI ChatGPT, and Google Gemini.
 */

const { getSettings } = require('./db');

/**
 * Call Anthropic Claude Messages API
 */
async function callClaude(apiKey, systemPrompt, userPrompt, model = 'claude-3-5-sonnet-20241022') {
  if (!apiKey) throw new Error('Anthropic Claude API key is missing.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API Error ${res.status}`);
  }

  const textBlock = (data.content || []).find(c => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Call OpenAI ChatGPT API
 */
async function callOpenAI(apiKey, systemPrompt, userPrompt, model = 'gpt-4o-mini') {
  if (!apiKey) throw new Error('OpenAI API key is missing.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI API Error ${res.status}`);
  }

  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Google Gemini API
 */
async function callGemini(apiKey, systemPrompt, userPrompt, model = 'gemini-1.5-flash') {
  if (!apiKey) throw new Error('Google Gemini API key is missing.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini API Error ${res.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Discover viral clips using chosen AI Provider
 */
async function analyzeWithAI(transcript, duration, options = {}) {
  const settings = await getSettings();
  const provider = options.provider || settings.activeAiProvider || 'offline';

  // If local offline chosen, return null to let lib/analyzer handle it locally
  if (provider === 'offline') {
    return null;
  }

  const systemPrompt = `You are a viral short-form video editor for TikTok, YouTube Shorts, and Instagram Reels.
Analyze this video transcript with timestamps. Identify the top ${options.clipCount || 5} most viral, high-retention moments.
Criteria:
- Must have a strong first-3-second retention hook (curiosity, controversy, high energy, punchline).
- Must have a clear narrative resolution or comedic payoff.
- Clip duration must be between ${options.minDuration || 20}s and ${options.maxDuration || 60}s.

Output strictly valid JSON with this format:
[
  {
    "start": number,
    "end": number,
    "title": "Short Punchy Title (Max 60 chars)",
    "hook": "Opening dialogue line",
    "score": number (1-100),
    "reason": "Why this will perform well on Shorts/TikTok"
  }
]`;

  const userPrompt = `Video Duration: ${duration} seconds.
Transcript:
${typeof transcript === 'string' ? transcript : JSON.stringify(transcript.segments || transcript)}`;

  let responseText = '';

  if (provider === 'claude') {
    const key = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    responseText = await callClaude(key, systemPrompt, userPrompt);
  } else if (provider === 'openai') {
    const key = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    responseText = await callOpenAI(key, systemPrompt, userPrompt);
  } else if (provider === 'gemini') {
    const key = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    responseText = await callGemini(key, systemPrompt, userPrompt);
  } else {
    return null;
  }

  // Parse JSON response
  try {
    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const clips = JSON.parse(cleaned);
    return clips.map(c => ({
      ...c,
      id: crypto.randomUUID ? crypto.randomUUID() : `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: provider
    }));
  } catch (err) {
    console.warn(`[AI Providers] Failed to parse ${provider} response:`, err.message);
    return null;
  }
}

/**
 * Generate viral title, description, and hashtags
 */
async function generatePostCopy(title, transcriptSnippet, platform = 'all') {
  const settings = await getSettings();
  const provider = settings.activeAiProvider || (settings.anthropicApiKey ? 'claude' : settings.openaiApiKey ? 'openai' : 'gemini');

  const systemPrompt = `You are a social media copywriter for viral short-form video.
Generate high-converting titles, descriptions, and hashtags tailored for ${platform.toUpperCase()}.
Output strictly valid JSON:
{
  "title": "Compelling Title with Emoji",
  "description": "Engaging 2-sentence description with call-to-action",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#fyp", "#viral"]
}`;

  const userPrompt = `Clip Title: "${title}".
Transcript Context: "${transcriptSnippet || ''}"`;

  try {
    let responseText = '';
    if (provider === 'claude' && (settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY)) {
      responseText = await callClaude(settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY, systemPrompt, userPrompt);
    } else if (provider === 'openai' && (settings.openaiApiKey || process.env.OPENAI_API_KEY)) {
      responseText = await callOpenAI(settings.openaiApiKey || process.env.OPENAI_API_KEY, systemPrompt, userPrompt);
    } else if (settings.geminiApiKey || process.env.GEMINI_API_KEY) {
      responseText = await callGemini(settings.geminiApiKey || process.env.GEMINI_API_KEY, systemPrompt, userPrompt);
    } else {
      // Offline fallback
      return {
        title: `${title} 🤯`,
        description: 'Watch until the end! Drop your thoughts in the comments below. 👇',
        hashtags: ['#Shorts', '#Viral', '#Trending', '#FYP', '#Clips']
      };
    }

    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      title: `${title} 🤯`,
      description: 'Watch until the end! Drop your thoughts in the comments below. 👇',
      hashtags: ['#Shorts', '#Viral', '#Trending', '#FYP']
    };
  }
}

module.exports = {
  callClaude,
  callOpenAI,
  callGemini,
  analyzeWithAI,
  generatePostCopy
};
