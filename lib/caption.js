const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { CAPTION_PRESETS } = require('./config');

const PROFANITY_LIST = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitting', 'bullshit',
  'bitch', 'asshole', 'dick', 'pussy', 'bastard', 'cunt'
];

const EMOJI_MAP = {
  fire: '🔥',
  lit: '🔥',
  hot: '🔥',
  money: '💰',
  cash: '💵',
  rich: '🤑',
  win: '🏆',
  winner: '👑',
  boss: '👑',
  crazy: '🤯',
  mindblown: '🤯',
  insane: '⚡',
  hype: '⚡',
  laugh: '😂',
  funny: '🤣',
  died: '💀',
  dead: '💀',
  fail: '🤦‍♂️',
  no: '❌',
  wrong: '❌',
  yes: '✅',
  truth: '💯',
  real: '💯',
  secret: '🤫',
  quiet: '🤫',
  danger: '⚠️',
  warning: '⚠️',
  game: '🎮',
  stream: '📹',
  love: '❤️',
  shock: '😱',
  wow: '😲'
};

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
  const clean = sanitizeAssText(word).toLowerCase().replace(/[^a-z]/g, '');
  return EMOJI_MAP[clean] || '';
}

function generateAssSubtitles(clip, transcript, options = {}, canvasWidth = 1080, canvasHeight = 1920) {
  const presetId = options.captionPreset || 'viral-pop';
  const basePreset = CAPTION_PRESETS.find(p => p.id === presetId) || CAPTION_PRESETS[0];
  const style = { ...basePreset, ...options.captionStyle };

  const clipStart = Number(clip.start) || 0;
  const clipEnd = Number(clip.end) || 30;

  // 1. Collect all words falling inside [clipStart, clipEnd]
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
      // Fallback if segment has no word breakdown: split evenly
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

  // 2. Strict Sequential De-duplication: Ensure words NEVER overlap in time and filter rolling artifacts
  rawWords.sort((a, b) => a.start - b.start);
  const words = [];
  let lastEnd = 0;
  for (let i = 0; i < rawWords.length; i++) {
    const cur = rawWords[i];
    const text = cur.word ? cur.word.trim() : '';
    if (!text) continue;

    // Filter rolling duplicate artifacts from auto-generated subtitles
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

  // ASS Header & Styles
  const primaryAss = hexToAss(style.primaryColor || '#FFFFFF', '00');
  const highlightAss = hexToAss(style.highlightColor || '#D8FF3E', '00');
  const outlineAss = hexToAss(style.outlineColor || '#000000', '00');
  const shadowAss = hexToAss(style.shadowColor || '#000000', '70');
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
  const outlineWidth = Math.max(4, Number(style.outlineWidth || 6));
  const shadowWidth = Math.max(1, Number(style.shadowWidth || 3));
  const fontSize = Math.max(52, Number(style.fontSize || 62));
  let fontFamily = 'Arial';
  if (style.fontFamily === 'Impact') fontFamily = 'Impact';
  else if (style.fontFamily === 'Georgia') fontFamily = 'Georgia';
  else if (style.fontFamily === 'Montserrat') fontFamily = 'Montserrat';
  else if (style.fontFamily === 'Arial Black') fontFamily = 'Arial Black';

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${canvasWidth}
PlayResY: ${canvasHeight}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,${fontFamily},${fontSize},${primaryAss},${highlightAss},${outlineAss},${style.boxEnabled ? boxAss : shadowAss},-1,0,0,0,100,100,1,0,${borderStyle},${outlineWidth},${shadowWidth},${alignment},50,50,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (words.length === 0) {
    return ass;
  }

  const displayMode = style.displayMode || 'phrase';

  if (displayMode === 'word') {
    // Single word pop - strictly non-overlapping
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

      let effect = '';
      if (style.animation === 'pop') {
        effect = `{\\fscx112\\fscy112\\t(0,60,\\fscx100\\fscy100)}{\\c${highlightAss}}`;
      } else {
        effect = `{\\c${highlightAss}}`;
      }

      ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Base,,0,0,0,,${effect}${text}\n`;
    }
  } else if (displayMode === 'phrase') {
    // Group words into punchy 2-3 word phrases (Hormozi / Viral Pop style)
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
            const anim = style.animation === 'pop' ? `\\fscx112\\fscy112\\t(0,60,\\fscx100\\fscy100)` : '';
            return `{\\c${highlightAss}${anim}}${text}{\\c${primaryAss}}`;
          }
          return `{\\c${primaryAss}}${text}`;
        });

        const line = phraseParts.join(' ');
        ass += `Dialogue: 0,${formatAssTime(wStart)},${formatAssTime(wEnd)},Base,,0,0,0,,${line}\n`;
      }
    }
  } else {
    // Sentence mode - strictly sequential
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
  generateAssSubtitles
};
