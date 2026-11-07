const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { CAPTION_PRESETS } = require('./config');

const PROFANITY_LIST = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitting', 'bullshit',
  'bitch', 'asshole', 'dick', 'pussy', 'bastard', 'cunt'
];

// Expanded 140+ Viral Emoji Mapping for Shorts / TikTok / Reels
const EMOJI_MAP = {
  // Energy & Reaction
  fire: '🔥', lit: '🔥', hot: '🔥', flame: '🔥',
  crazy: '🤯', insane: '🤯', mindblown: '🤯', shocked: '😱', shock: '😱',
  wow: '😲', omg: '😱', scream: '😱', wtf: '👀', bruh: '💀', bro: '💀',
  dead: '💀', died: '💀', skull: '💀', lol: '😂', laugh: '😂', funny: '🤣',
  cry: '😭', crying: '😭', sad: '😢', clown: '🤡', cap: '🧢', nocap: '🚫🧢',
  truth: '💯', real: '💯', fact: '💯', facts: '💯',

  // Money & Wealth
  money: '💰', cash: '💵', rich: '🤑', millionaire: '💸', billionaire: '💸',
  dollar: '💵', bag: '💰', profit: '📈', crypto: '🪙', bitcoin: '🪙',
  expensive: '💎', diamond: '💎', gold: '🏆', luxury: '✨',

  // Success & Dominance
  win: '🏆', winner: '🏆', winning: '🏆', champion: '🥇', boss: '👑',
  king: '👑', queen: '👑', goat: '🐐', legend: '⭐', star: '⭐',
  flex: '💪', strong: '💪', gym: '🏋️', power: '⚡', hype: '⚡',

  // Conflict, Danger & Crime
  danger: '⚠️', warning: '⚠️', alert: '🚨', trap: '🪤', police: '👮',
  cop: '🚓', arrest: '🚔', jail: '⛓️', prison: '⛓️', kill: '💥',
  fight: '🥊', punch: '👊', war: '💣', bomb: '💣', shoot: '🎯',
  gun: '🔫', sword: '⚔️', blood: '🩸', rip: '🪦',

  // Gaming & Tech
  game: '🎮', gaming: '🎮', clutch: '🎯', bot: '🤖', hacker: '💻',
  cheat: '🚫', ban: '🔨', unban: '🔓', stream: '📹', pc: '🖥️',
  ai: '🧠', brain: '🧠', smart: '💡', idea: '💡', dumb: '🤦‍♂️', fail: '🤦‍♂️',

  // Speed & Action
  speed: '⚡', fast: '🏎️', quick: '⚡', run: '🏃', car: '🏎️',
  drive: '🚗', race: '🏁', fly: '🚀', rocket: '🚀', moon: '🌕',

  // Secret & Quiet
  secret: '🤫', quiet: '🤫', silence: '🤐', shh: '🤫', whisper: '🤫',
  lock: '🔒', key: '🔑',

  // Love & Heart
  love: '❤️', heart: '❤️', kiss: '💋', vibe: '✨', chill: '🧊',
  ice: '🧊', cold: '🥶', sick: '🤮', party: '🎉', beer: '🍻',
  music: '🎵', song: '🎶', dance: '💃'
};

// Word lists for dynamic viral color switching (MrBeast / Hormozi Color Switch)
const GREEN_KEYWORDS = new Set([
  'money', 'cash', 'rich', 'dollar', 'dollars', 'profit', 'free', 'win', 'winning', 'winner', 'yes', 'easy', 'growth', 'gain', 'best', 'boost'
]);

const RED_KEYWORDS = new Set([
  'never', 'worst', 'stop', 'hate', 'dead', 'died', 'kill', 'killed', 'fake', 'broke', 'danger', 'warning', 'lost', 'lose', 'failure', 'fail', 'no', 'wrong', 'banned', 'illegal', 'scam', 'terrible', 'horrible'
]);

const GOLD_KEYWORDS = new Set([
  'insane', 'crazy', 'secret', 'truth', 'genius', 'god', 'goat', 'legend', 'champion', 'billionaire', 'millionaire', 'clutch', 'unbelievable', 'shocking', 'massive', 'huge', 'mindblown'
]);

const CYAN_KEYWORDS = new Set([
  'ai', 'code', 'game', 'gaming', 'speed', 'future', 'robot', 'tech', 'online', 'hacker', 'stream'
]);

function hexToAss(hex, alpha = '00') {
  if (!hex) return `&H${alpha}FFFFFF&`;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return `&H${alpha}FFFFFF&`;
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${alpha}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}&`;
}

function sanitizeAssText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function formatAssTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function maskProfanity(word) {
  const clean = sanitizeAssText(word);
  const lower = clean.toLowerCase().replace(/[^a-z]/g, '');
  if (PROFANITY_LIST.includes(lower)) {
    return clean[0] + '*'.repeat(Math.max(1, clean.length - 2)) + (clean.length > 2 ? clean[clean.length - 1] : '*');
  }
  return clean;
}

function applyCasing(text, casing) {
  const clean = sanitizeAssText(text);
  if (!clean) return '';
  if (casing === 'uppercase') return clean.toUpperCase();
  if (casing === 'lowercase') return clean.toLowerCase();
  if (casing === 'title') {
    return clean.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
  }
  return clean;
}

function getEmoji(word) {
  const clean = sanitizeAssText(word).toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMOJI_MAP[clean] || '';
}

/**
 * Determine dynamic viral highlight color for a word
 */
function getWordHighlightColor(word, baseHighlightAss) {
  const clean = word.toLowerCase().replace(/[^a-z0-9$]/g, '');
  
  // Numbers or currency -> Electric Green
  if (/^\$?\d+[%kmb]?$/i.test(clean)) {
    return hexToAss('#00FF66');
  }
  // High-stakes red keywords
  if (RED_KEYWORDS.has(clean)) {
    return hexToAss('#FF3333');
  }
  // Electric gold keywords
  if (GOLD_KEYWORDS.has(clean)) {
    return hexToAss('#FFE600');
  }
  // Green keywords
  if (GREEN_KEYWORDS.has(clean)) {
    return hexToAss('#00FF66');
  }
  // Cyan keywords
  if (CYAN_KEYWORDS.has(clean)) {
    return hexToAss('#00F0FF');
  }
  
  return baseHighlightAss;
}

/**
 * Generate ASS Subtitle content with kinetic spring-pop, word tracking, and dynamic colors
 */
function generateAssSubtitles(clip, transcript, options = {}, canvasWidth = 1080, canvasHeight = 1920) {
  const presetId = options.captionPreset || 'viral-pop';
  const basePreset = CAPTION_PRESETS.find(p => p.id === presetId) || CAPTION_PRESETS[0];
  const style = { ...basePreset, ...options.captionStyle };

  const clipStart = Number(clip.start) || 0;
  const clipEnd = Number(clip.end) || 30;

  // 1. Collect words falling inside [clipStart, clipEnd]
  const rawWords = [];
  const segments = transcript?.segments || [];
  for (const seg of segments) {
    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) {
        if (w.end >= clipStart && w.start <= clipEnd) {
          rawWords.push({
            word: w.word,
            start: Math.max(0, w.start - clipStart),
            end: Math.max(0, w.end - clipStart)
          });
        }
      }
    } else if (seg.end >= clipStart && seg.start <= clipEnd) {
      const segWords = seg.text.trim().split(/\s+/).filter(Boolean);
      const segDur = Math.max(0.1, seg.end - seg.start);
      const wordDur = segWords.length > 0 ? segDur / segWords.length : 0.4;
      for (let i = 0; i < segWords.length; i++) {
        const wStart = seg.start + (i * wordDur);
        const wEnd = wStart + wordDur;
        if (wEnd >= clipStart && wStart <= clipEnd) {
          rawWords.push({
            word: segWords[i],
            start: Math.max(0, wStart - clipStart),
            end: Math.max(0, wEnd - clipStart)
          });
        }
      }
    }
  }

  // 2. Strict Sequential De-duplication: Ensure words NEVER overlap in time
  rawWords.sort((a, b) => a.start - b.start);
  const words = [];
  let lastEnd = 0;
  for (let i = 0; i < rawWords.length; i++) {
    const cur = rawWords[i];
    const text = cur.word ? cur.word.trim() : '';
    if (!text) continue;

    // Filter rolling duplicate artifacts
    if (words.length > 0) {
      const prev = words[words.length - 1];
      if (prev && prev.word.toLowerCase() === text.toLowerCase() && Math.abs(cur.start - prev.start) < 0.25) {
        continue;
      }
    }

    let wStart = Math.max(lastEnd, cur.start);
    let wEnd = Math.max(wStart + 0.14, cur.end);

    const next = rawWords[i + 1];
    if (next) {
      const nextStart = Math.max(0, next.start);
      if (nextStart > wStart) {
        wEnd = Math.min(wEnd, nextStart);
      }
    }

    if (wEnd <= wStart) {
      wEnd = wStart + 0.18;
    }

    words.push({
      word: text,
      start: Number(wStart.toFixed(2)),
      end: Number(wEnd.toFixed(2))
    });
    lastEnd = wEnd;
  }

  // Color Definitions
  const primaryAss = hexToAss(style.primaryColor || '#FFFFFF', '00');
  const baseHighlightAss = hexToAss(style.highlightColor || '#FFE600', '00');
  const mutedAss = hexToAss('#CCCCCC', '40'); // Translucent for karaoke mode
  const outlineAss = hexToAss(style.outlineColor || '#000000', '00');
  const shadowAss = hexToAss(style.shadowColor || '#000000', '80');
  const boxAss = hexToAss(style.boxColor || '#000000', '60');

  // Alignment: 2 = bottom-center, 5 = middle-center, 8 = top-center
  let alignment = 2;
  let marginV = style.yOffset || 280;
  if (style.position === 'center') {
    alignment = 5;
    marginV = 0;
  } else if (style.position === 'top') {
    alignment = 8;
    marginV = style.yOffset || 220;
  }

  const borderStyle = style.boxEnabled ? 3 : 1;
  const outlineWidth = Math.max(4, Number(style.outlineWidth || 7));
  const shadowWidth = Math.max(1, Number(style.shadowWidth || 3));
  const fontSize = Math.max(54, Number(style.fontSize || 64));

  // Font family resolution
  let fontFamily = 'Arial Black';
  const customFont = String(style.fontFamily || style.font || '').toLowerCase();
  if (customFont.includes('lemon milk')) fontFamily = 'Lemon Milk, Arial Black, Impact';
  else if (customFont.includes('impact')) fontFamily = 'Impact';
  else if (customFont.includes('bricolage')) fontFamily = 'Bricolage Grotesque, Impact';
  else if (customFont.includes('unbounded')) fontFamily = 'Unbounded, Arial Black';
  else if (customFont.includes('fredoka')) fontFamily = 'Fredoka, Arial Rounded MT Bold';
  else if (customFont.includes('space')) fontFamily = 'Space Grotesk, Arial Black';
  else if (customFont.includes('montserrat')) fontFamily = 'Montserrat, Arial Black';
  else if (customFont.includes('georgia')) fontFamily = 'Georgia';

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${canvasWidth}
PlayResY: ${canvasHeight}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,${fontFamily},${fontSize},${primaryAss},${baseHighlightAss},${outlineAss},${style.boxEnabled ? boxAss : shadowAss},-1,0,0,0,100,100,1,0,${borderStyle},${outlineWidth},${shadowWidth},${alignment},50,50,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (words.length === 0) {
    return ass;
  }

  const displayMode = style.displayMode || 'phrase';
  const animation = style.animation || 'pop';

  if (displayMode === 'word') {
    // Single Word Pop (iShowSpeed & Viral Shorts Style)
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let text = style.profanityMask ? maskProfanity(w.word) : w.word;
      text = applyCasing(text, style.casing);
      const emoji = style.emojiEnabled ? getEmoji(w.word) : '';
      if (emoji) text = `${text} ${emoji}`;

      const wStart = w.start;
      const nextWord = words[i + 1];
      let wEnd = nextWord ? Math.min(w.end, nextWord.start) : w.end;
      if (wEnd <= wStart) wEnd = wStart + 0.18;

      const activeColor = getWordHighlightColor(w.word, baseHighlightAss);

      // Signature Hormozi Spring Pop: scales to 124%, bounces to 94%, settles to 100%
      let effect = '';
      if (animation === 'pop') {
        effect = `{\\fscx124\\fscy124\\t(0,50,\\fscx94\\fscy94)\\t(50,110,\\fscx100\\fscy100)\\c${activeColor}}`;
      } else if (animation === 'glow') {
        effect = `{\\bord${outlineWidth + 3}\\3c${activeColor}\\c${primaryAss}\\t(0,80,\\bord${outlineWidth}\\3c${outlineAss})}`;
      } else {
        effect = `{\\c${activeColor}}`;
      }

      ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Base,,0,0,0,,${effect}${text}\n`;
    }
  } else if (displayMode === 'phrase') {
    // Group words into punchy 2-3 word phrases (Alex Hormozi & OpusClip Pro Style)
    const groupSize = Math.max(1, Math.min(4, Number(style.wordsPerLine || 3)));
    const groups = [];
    for (let i = 0; i < words.length; i += groupSize) {
      groups.push(words.slice(i, i + groupSize));
    }

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx];
      const nextGroup = groups[gIdx + 1];
      const groupStart = group[0].start;
      let groupEnd = group[group.length - 1].end;
      if (nextGroup) {
        groupEnd = Math.min(groupEnd, nextGroup[0].start);
      }
      if (groupEnd <= groupStart) groupEnd = groupStart + 0.3;

      for (let activeIdx = 0; activeIdx < group.length; activeIdx++) {
        const curWord = group[activeIdx];
        const nextInGroup = group[activeIdx + 1];

        const wStart = curWord.start;
        let wEnd = nextInGroup ? nextInGroup.start : groupEnd;
        if (wEnd <= wStart) wEnd = wStart + 0.15;

        const phraseParts = group.map((w, idx) => {
          let text = style.profanityMask ? maskProfanity(w.word) : w.word;
          text = applyCasing(text, style.casing);
          const emoji = style.emojiEnabled && idx === activeIdx ? getEmoji(w.word) : '';
          if (emoji) text = `${text} ${emoji}`;

          if (idx === activeIdx) {
            const activeColor = getWordHighlightColor(w.word, baseHighlightAss);
            // Spring bounce on active word
            const anim = animation === 'pop' 
              ? `\\fscx122\\fscy122\\t(0,50,\\fscx95\\fscy95)\\t(50,110,\\fscx100\\fscy100)`
              : (animation === 'glow' ? `\\bord${outlineWidth + 2}\\3c${activeColor}` : '');
            return `{\\c${activeColor}${anim}}${text}{\\c${primaryAss}\\bord${outlineWidth}\\3c${outlineAss}}`;
          }
          
          // Unspoken or completed words in phrase
          if (animation === 'karaoke' && idx > activeIdx) {
            return `{\\c${mutedAss}}${text}`;
          }
          return `{\\c${primaryAss}}${text}`;
        });

        const line = phraseParts.join(' ');
        ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Base,,0,0,0,,${line}\n`;
      }
    }
  } else {
    // Sentence mode
    const groupSize = Math.max(4, Number(style.wordsPerLine || 5));
    const groups = [];
    for (let i = 0; i < words.length; i += groupSize) {
      groups.push(words.slice(i, i + groupSize));
    }

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const group = groups[gIdx];
      const nextGroup = groups[gIdx + 1];
      const sStart = group[0].start;
      let sEnd = group[group.length - 1].end;
      if (nextGroup) {
        sEnd = Math.min(sEnd, nextGroup[0].start);
      }
      if (sEnd <= sStart) sEnd = sStart + 0.8;

      const sentenceText = group.map(w => {
        let t = style.profanityMask ? maskProfanity(w.word) : w.word;
        return applyCasing(t, style.casing);
      }).join(' ');

      ass += `Dialogue: 0,${formatAssTime(sStart)},${formatAssTime(sEnd)},Base,,0,0,0,,{\\c${primaryAss}}${sentenceText}\n`;
    }
  }

  return ass;
}

module.exports = {
  hexToAss,
  formatAssTime,
  maskProfanity,
  applyCasing,
  getEmoji,
  getWordHighlightColor,
  generateAssSubtitles
};
