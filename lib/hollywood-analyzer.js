/**
 * AutoClip HOLLYWOOD Rating System
 * Engineered using the 4 Callaway Short-Form Hook Pillars:
 * 
 * 1. ZERO DELAY (Speed to Value):
 *    - Topic introduction must happen in first 1-3 seconds.
 *    - Penalizes throat-clearing intro fluff ("Guys this is...", "In this video...").
 * 
 * 2. ZERO CONFUSION (6th-Grade Readability & Active Voice):
 *    - Clear, punchy, active voice ("Subject + Action + Object").
 *    - High comprehension hit rate, penalizes convoluted passive sentence structures.
 * 
 * 3. AUDIENCE RELEVANCE (You/Your Framing & Pain Point Agitation):
 *    - Targets viewer directly ("you", "your", "if you've ever...").
 *    - Agitates an urgent pain point (need-to-have solve vs nice-to-have trend).
 * 
 * 4. HIGH-CONTRAST CURIOSITY LOOP (A vs B Contrarian Tension):
 *    - Stated or implied contrast between baseline belief (A) and contrarian shortcut (B).
 *    - Opens an irresistible curiosity loop requiring viewer to watch to payoff.
 */

const crypto = require('crypto');
const { wordShingles, synthesizeViralTitle } = require('./smart-text');

const HOLLYWOOD_PILLARS = [
  {
    id: 'zero_delay',
    name: 'Zero Delay (Speed to Value)',
    weight: 25,
    description: 'Hook introduces topic clarity within 0-2 seconds. Eliminates throat-clearing fluff.'
  },
  {
    id: 'zero_confusion',
    name: 'Zero Confusion (6th-Grade Clarity)',
    weight: 25,
    description: 'Active voice syntax, simple vocabulary, short sentences for instant comprehension.'
  },
  {
    id: 'audience_relevance',
    name: 'Audience Relevance (You/Your Framing)',
    weight: 25,
    description: 'Direct viewer targeting ("you/your") and urgent pain point agitation.'
  },
  {
    id: 'curiosity_loop',
    name: 'Curiosity Tension Loop (Contrarian Contrast)',
    weight: 25,
    description: 'High-contrast A vs B tension, common mistake vs contrarian shortcut.'
  }
];

/**
 * Score a hook based on Hollywood 4-Pillar Hook Psychology
 */
function scoreHollywoodHook(hookText, fullSnippet = '') {
  const text = (hookText || '').trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  // Pillar 1: Speed to Value (Zero Delay) - Max 25 pts
  let speed = 25;
  let speedTip = 'Immediate topic context delivered';
  let fluffPenalty = 0;
  const fluffPhrases = [
    'hey guys', 'guys this is', 'in this video', 'today we are going to', "today we're talking about",
    'i wanted to share', 'i wanted to talk about', 'i was thinking', 'what is up guys', 'welcome back',
    'so basically', 'listen to this', 'one of the craziest things', 'check this out'
  ];
  for (const fp of fluffPhrases) {
    if (lower.startsWith(fp) || lower.slice(0, 50).includes(fp)) {
      speed -= 10;
      fluffPenalty += 10;
      speedTip = `Cut intro fluff ("${fp}"). Move topic to 0s mark.`;
      break;
    }
  }
  const first5Words = words.slice(0, 5).join(' ').toLowerCase();
  const hasDirectTopic = /\b(why|how|if you|stop|never|the secret|3 ways|this trick|most people|don't|here's|you've|are you)\b/.test(first5Words);
  if (!hasDirectTopic && speed > 16) {
    speed -= 5;
    if (speedTip.includes('Immediate')) speedTip = 'Topic clarity delayed past 2 seconds';
  }
  speed = Math.max(5, Math.min(25, speed));

  // Pillar 2: Zero Confusion (Clarity & Active Voice) - Max 25 pts
  let clarity = 25;
  let clarityTip = 'Punchy 6th-grade active voice';
  const avgWordLen = words.length ? (words.reduce((acc, w) => acc + w.length, 0) / words.length) : 0;
  if (avgWordLen > 6.2) {
    clarity -= 6;
    clarityTip = 'Use simpler, shorter words for instant comprehension';
  }
  if (words.length > 24) {
    clarity -= 5;
    clarityTip = 'Break long sentence into 2 punchy lines';
  }
  if (/\b(was built by|is being made|had been seen|were told by|can be found by)\b/i.test(lower)) {
    clarity -= 6;
    clarityTip = 'Switch passive voice to active voice (Subject + Verb)';
  }
  clarity = Math.max(5, Math.min(25, clarity));

  // Pillar 3: Viewer Relevance (You/Your & Pain Agitation) - Max 25 pts
  let relevance = 14;
  let relevanceTip = 'Viewer-targeted framing';
  const youCount = (lower.match(/\b(you|your|you're|you've|yourself)\b/g) || []).length;
  const meCount = (lower.match(/\b(i|me|my|mine|i've|i'm)\b/g) || []).length;
  if (youCount >= 2) {
    relevance += 7;
    relevanceTip = 'Strong second-person "you" targeting';
  } else if (youCount === 1) {
    relevance += 5;
  }
  if (meCount > youCount + 1) {
    relevance -= 5;
    relevanceTip = 'Flip self-centered monologue ("I/My") to viewer problem ("You/Your")';
  }
  const hasPain = /\b(acne|broke|struggle|mistake|lose|fail|stop|hate|problem|pain|wasting|ruin|hurts|fix|solve|worst|fat|calories|diet|scam|lied to)\b/i.test(lower);
  if (hasPain) {
    relevance += 5;
    relevanceTip = 'Agitates an urgent pain point (need-to-have solve)';
  }
  relevance = Math.max(5, Math.min(25, relevance));

  // Pillar 4: High-Contrast Curiosity Loop (A vs B) - Max 25 pts
  let contrast = 12;
  let contrastTip = 'Curiosity loop opened';
  const hasStatedContrast = /\b(versus|vs|instead of|rather than|most people .* but|they said .* but|everyone thinks .* but|still .* lied to|not .* but)\b/i.test(lower);
  const hasImpliedContrast = /\b(secret|faster|without|actually|contrarian|nobody talks about|hidden|trick|better than|cheat code|what they don't|lied to|lies|more than|3x|burns 3x)\b/i.test(lower);
  if (hasStatedContrast) {
    contrast += 13;
    contrastTip = 'Stated A vs B comparison creates high curiosity tension';
  } else if (hasImpliedContrast) {
    contrast += 10;
    contrastTip = 'Implied contrast with contrarian payoff trigger';
  } else {
    contrastTip = 'Add A vs B contrast (common belief A vs contrarian solve B)';
  }
  contrast = Math.max(5, Math.min(25, contrast));

  const total = speed + clarity + relevance + contrast;

  let grade = '⭐ Feature Film Candidate';
  let badge = '🎬 Solid Retention Candidate';
  if (total >= 90) {
    grade = '⭐⭐⭐ Hollywood Blockbuster';
    badge = '🔥 Hollywood Viral Goldmine';
  } else if (total >= 80) {
    grade = '⭐⭐ Hollywood Premiere';
    badge = '⚡ Hollywood High Retention';
  }

  // Tactical Hook Diagnosis
  let tacticalFix = 'Hook is optimized for high retention.';
  if (speed < 18) {
    tacticalFix = 'Cut first 2 seconds of fluff. State the core topic in word 1.';
  } else if (relevance < 18) {
    tacticalFix = 'Reframe around the viewer: replace "I did this" with "If you want this...".';
  } else if (contrast < 18) {
    tacticalFix = 'Add A vs B contrast: contrast the common mistake with your fast shortcut.';
  } else if (clarity < 18) {
    tacticalFix = 'Simplify phrasing: use 6th-grade active voice to prevent comprehension loss.';
  }

  return {
    score: total,
    grade,
    badge,
    speedToValue: { score: speed, max: 25, tip: speedTip, fluffPenalty },
    clarity: { score: clarity, max: 25, tip: clarityTip },
    relevance: { score: relevance, max: 25, tip: relevanceTip },
    contrast: { score: contrast, max: 25, tip: contrastTip },
    tacticalFix,
    improvementTip: tacticalFix
  };
}

/**
 * Extract clean segments from transcript
 */
function normalizeSegments(transcript) {
  if (!transcript) return [];
  if (Array.isArray(transcript)) return transcript;
  if (Array.isArray(transcript.segments)) return transcript.segments;
  if (typeof transcript === 'string') {
    // Split sentences
    const sentences = transcript.split(/(?<=[.?!])\s+/).filter(Boolean);
    let time = 0;
    return sentences.map(s => {
      const dur = Math.max(2, s.split(/\s+/).length * 0.35);
      const start = time;
      time += dur;
      return { start, end: time, text: s };
    });
  }
  return [];
}

/**
 * Discover & rank viral moments using HOLLYWOOD Rating System
 */
async function findHollywoodMoments(transcript, videoDuration, options = {}) {
  const segments = normalizeSegments(transcript);
  if (!segments.length) return [];

  const minDuration = Math.max(20, Number(options.minDuration || 20));
  const maxDuration = Math.min(120, Number(options.clipLength || options.maxDuration || 60));
  const targetCount = Math.max(1, Math.min(100, Number(options.clipCount || 5)));

  const totalDuration = Math.max(
    Number(videoDuration || 0),
    segments.length > 0 ? (segments[segments.length - 1].end || 0) : 0
  );

  const candidates = [];

  // Slide window over segments
  for (let i = 0; i < segments.length; i++) {
    const first = segments[i];
    const prev = i > 0 ? segments[i - 1] : null;

    // Sentence boundary snapping: avoid starting mid-conjunction if previous segment was incomplete
    if (prev && !/[.!?]$/.test(prev.text.trim()) && (first.start - prev.end < 0.4)) {
      if (/^(and|so|but|or|because|well|like)\b/i.test(first.text.trim())) continue;
    }

    let candidateText = '';
    let start = first.start;
    let end = first.end;

    for (let j = i; j < segments.length; j++) {
      const curr = segments[j];
      const next = j < segments.length - 1 ? segments[j + 1] : null;
      end = curr.end;
      candidateText += (candidateText ? ' ' : '') + curr.text;

      const dur = end - start;
      if (dur < minDuration) continue;
      if (dur > maxDuration) break;

      // Sentence boundary snapping on ending
      const hasTerminalPunctuation = /[.!?]$/.test(curr.text.trim());
      const hasSilenceAfter = next && (next.start - curr.end >= 0.38);
      const isLastSeg = j === segments.length - 1;

      if (!hasTerminalPunctuation && !hasSilenceAfter && !isLastSeg && dur < maxDuration - 8) {
        continue;
      }

      // Extract hook (first 1-2 sentences or up to 160 chars)
      const sentences = candidateText.split(/(?<=[.?!])\s+/).filter(Boolean);
      const hookText = sentences.slice(0, 2).join(' ') || candidateText.slice(0, 160);

      const hw = scoreHollywoodHook(hookText, candidateText);

      // Audio dynamics / speech density bonus
      const wordCount = candidateText.split(/\s+/).length;
      const wps = wordCount / dur;
      let finalScore = hw.score;
      if (wps >= 2.2 && wps <= 3.8) finalScore += 3; // Natural high-energy speech flow

      finalScore = Math.min(99, Math.round(finalScore));

      candidates.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        start: Math.round(start * 10) / 10,
        end: Math.round(end * 10) / 10,
        duration: Math.round(dur),
        score: finalScore,
        title: typeof synthesizeViralTitle === 'function' ? synthesizeViralTitle(hookText, candidateText) : (sentences[0] || 'Viral Moment').slice(0, 50),
        hook: hookText.slice(0, 180),
        reason: `Hollywood Score: ${hw.score}/100 [Speed: ${hw.speedToValue.score}/25, Clarity: ${hw.clarity.score}/25, You: ${hw.relevance.score}/25, Contrast: ${hw.contrast.score}/25] - ${hw.tacticalFix}`,
        viralBadge: hw.badge,
        category: '🎬 Hollywood Viral Cut',
        ratingSystem: 'hollywood',
        hollywood: {
          score: hw.score,
          grade: hw.grade,
          speedToValue: hw.speedToValue.score,
          clarity: hw.clarity.score,
          relevance: hw.relevance.score,
          contrast: hw.contrast.score,
          tip: hw.tacticalFix
        }
      });

      // Jump forward once a clean sentence ending is reached
      if (hasTerminalPunctuation || hasSilenceAfter || dur >= minDuration + 14) break;
    }
  }

  if (!candidates.length) return [];

  // Temporal timeline distribution across full duration
  const minSpacing = totalDuration > 60
    ? Math.max(24, Math.min(90, (totalDuration / targetCount) * 0.72))
    : 14;

  const numBuckets = Math.max(3, Math.min(10, Math.ceil(totalDuration / 180)));
  const bucketDuration = totalDuration / numBuckets;
  const quotaPerBucket = Math.max(1, Math.ceil(targetCount / numBuckets));

  const buckets = Array.from({ length: numBuckets }, () => []);
  for (const c of candidates) {
    const bIndex = Math.min(numBuckets - 1, Math.max(0, Math.floor(c.start / bucketDuration)));
    buckets[bIndex].push(c);
  }
  buckets.forEach(b => b.sort((x, y) => y.score - x.score));

  const selected = [];
  const isCandidateValid = (c, reqSpacing) => {
    return !selected.some(s => {
      const overlapDur = Math.max(0, Math.min(s.end, c.end) - Math.max(s.start, c.start));
      if (overlapDur > 4) return true;
      if (Math.abs(s.start - c.start) < reqSpacing) return true;
      return false;
    });
  };

  // Pass 1: Timeline breadth - pick from each bucket across the duration
  for (let pass = 0; pass < quotaPerBucket; pass++) {
    for (let b = 0; b < numBuckets; b++) {
      if (selected.length >= targetCount) break;
      const match = buckets[b].find(c => isCandidateValid(c, minSpacing));
      if (match) selected.push(match);
    }
    if (selected.length >= targetCount) break;
  }

  // Pass 2: Global top score fill
  if (selected.length < targetCount) {
    const remaining = candidates
      .filter(c => !selected.some(s => s.id === c.id))
      .sort((a, b) => b.score - a.score);

    for (const c of remaining) {
      if (selected.length >= targetCount) break;
      if (isCandidateValid(c, Math.max(18, minSpacing * 0.65))) {
        selected.push(c);
      }
    }
  }

  // Pass 3: Relaxed spacing fallback
  if (selected.length < targetCount) {
    const remaining = candidates
      .filter(c => !selected.some(s => s.id === c.id))
      .sort((a, b) => b.score - a.score);

    for (const c of remaining) {
      if (selected.length >= targetCount) break;
      if (isCandidateValid(c, 14)) {
        selected.push(c);
      }
    }
  }

  selected.sort((a, b) => a.start - b.start);
  selected.forEach((c, idx) => {
    c.timelineIndex = idx + 1;
  });

  return selected;
}

module.exports = {
  HOLLYWOOD_PILLARS,
  scoreHollywoodHook,
  findHollywoodMoments
};
