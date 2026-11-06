/**
 * AutoClip CRAZY BEAST Engine v2.0
 * 
 * Engineered from the Viral Clipping Secrets of:
 * 1. Brock Johnson (1,300 Hook Study: Negative Framing Bias, 5-8 Word Sweet Spot, 15 Viral Hook Archetypes)
 * 2. Callaway (4 Hook Pillars: Zero Delay, Clarity, Relevance, Curiosity Loop)
 * 3. Serviuos (MonsterLab / ClipIt 4 Rules: 180° Plot Twist, High Polarization, Savable Bookmark Hack, Zero Dead Air)
 * 4. Ollex (Streamer Reaction Clipping, +6.5dB Audio Spiking, High-Volume Outlier Model)
 * 5. DeagzzzShorts (iShowSpeed Viral Heatmap Spikes, Lemon Milk Subtitles, Face-Lock Tracking)
 */

const crypto = require('crypto');

function synthesizeBeastTitle(firstText, fullText = '') {
  const text = String(firstText || fullText || '').replace(/\s+/g, ' ').trim();
  const firstSentence = text.split(/[.!?]/)[0] || text.slice(0, 60);
  return firstSentence.length > 70 ? firstSentence.slice(0, 67) + '...' : firstSentence;
}

const BEAST_TIERS = {
  ULTRA_BEAST: { min: 90, label: '👑 10,000,000+ ULTRA BEAST', badge: '🔥 Guaranteed Outlier God' },
  BEAST_JUICER: { min: 80, label: '🦁 1,000,000+ BEAST JUICER', badge: '⚡ Print $$$ Viral Short' },
  HIGH_ENERGY: { min: 70, label: '⚡ 500,000+ HIGH-ENERGY CLIP', badge: '🎬 Strong Outlier' },
  VIRAL_CANDIDATE: { min: 58, label: '🎬 100,000+ VIRAL CANDIDATE', badge: '✨ Solid Retentive Cut' }
};

// Brock Johnson's 15 Empirical Hook Archetypes (from 1,300 viral Reels & Shorts study)
const BROCK_HOOK_ARCHETYPES = {
  CONTRARIAN: { name: 'Contrarian Paradox', weight: 1.25, tip: 'Goes against common advice; forces immediate stop' },
  OUTCOME_BASED: { name: 'Outcome-First Proof', weight: 1.22, tip: 'Leads with massive payoff; withholds mechanism' },
  IDENTITY: { name: 'Identity Alignment', weight: 1.20, tip: 'Calls out aspirational or negative persona trait' },
  DIRECT_ADDRESS: { name: 'Direct Audience Callout', weight: 1.15, tip: 'Speaks directly to the exact target viewer' },
  STORYTELLING: { name: 'Vulnerable Story Hook', weight: 1.18, tip: 'Uses "I almost quit" / "Last year I was stuck" (22x more memorable)' },
  CURIOSITY_GAP: { name: 'Goldilocks Curiosity Gap', weight: 1.22, tip: 'Psychological open loop viewer must watch to close' },
  AUTHORITY_DATA: { name: 'Authority / Data-Backed', weight: 1.20, tip: 'Eliminates stranger skepticism with studies or numbers' },
  BOLD_CLAIM: { name: 'Bold Polarizing Claim', weight: 1.18, tip: 'Certainty in statement signals undeniable authority' },
  TIME_BOUND: { name: 'Urgency & Time-Bound', weight: 1.16, tip: 'Creates urgency before sleep, new year, or gym' },
  LIST_STRUCTURE: { name: 'Predictable List Hook', weight: 1.12, tip: 'Promises organized structured value in 3-5 points' },
  POV_RELATABLE: { name: 'Relatable POV Moment', weight: 1.14, tip: 'Places viewer inside the scene as a voyeur' },
  COMPARISON: { name: 'Before vs After Contrast', weight: 1.15, tip: 'Shows visual or state difference instantly' },
  PATTERN_INTERRUPT: { name: 'Visual/Verbal Pattern Interrupt', weight: 1.20, tip: 'Shatters scrolling inertia with sudden break' },
  SAVABLE_HACK: { name: 'Savable Utility Hack', weight: 1.18, tip: 'Forces viewer to save/bookmark to reference later' }
};

// Negative Loss-Aversion trigger lexicon (Brock Johnson: +67% to 2.3x CTR over positive)
const BROCK_NEGATIVE_TRIGGERS = [
  'stop', "don't", 'never', 'worst', 'mistake', 'ruining', 'wasting', 'fail', 'failed',
  'lies', 'lied', 'quit', 'quitting', 'avoid', 'warning', 'terrible', 'toxic', 'scam',
  'hate', 'fake', 'broke', 'hiding', 'danger', 'dangerous', 'cancelled', 'killing', 'dead'
];

/**
 * Score a hook based on Brock Johnson's 1,300-Hook Study
 */
function scoreBrockHook(hookText, hookDuration = 3.5) {
  const text = String(hookText || '').trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Negative Framing Bias (Brock Rule: Negative outperforms positive 67% to 2.3x)
  let negativeScore = 15;
  const hasNegativeWord = BROCK_NEGATIVE_TRIGGERS.some(trigger => {
    const rx = new RegExp(`\\b${trigger}\\b`, 'i');
    return rx.test(lower);
  });
  const lossAversionMultiplier = hasNegativeWord ? 2.3 : 1.0;
  if (hasNegativeWord) {
    negativeScore = 25;
  } else {
    // Check if overly sweet/positive generic advice
    if (/\b(how to get|ways to improve|benefits of|make sure you)\b/i.test(lower)) {
      negativeScore = 12; // Positive framing penalty
    } else {
      negativeScore = 16;
    }
  }

  // 2. Sweet-Spot Hook Length & Word Density (Brock: 5-8 words is sweet spot, 11 max)
  let sweetSpotScore = 25;
  let inSweetSpot = false;
  if (wordCount >= 5 && wordCount <= 8) {
    sweetSpotScore = 25;
    inSweetSpot = true;
  } else if (wordCount >= 9 && wordCount <= 11) {
    sweetSpotScore = 22;
    inSweetSpot = true;
  } else if (wordCount >= 3 && wordCount < 5) {
    sweetSpotScore = 18;
  } else if (wordCount >= 12 && wordCount <= 15) {
    sweetSpotScore = 15; // Starting to get bloated
  } else {
    sweetSpotScore = Math.max(8, 25 - (wordCount - 11) * 2); // Heavy penalty for clutter
  }

  // Speed-to-value bonus / penalty
  if (hookDuration > 4.5) {
    sweetSpotScore = Math.max(5, sweetSpotScore - 4);
  }

  // 3. Fluff / Millennial Pause Penalty (Zero Delay Rule)
  let fluffPenalty = 0;
  if (/^(in (?:this|today'?s) video|hey (?:guys|everyone)|welcome back|so basically|what'?s up (?:guys|everyone)|today i(?:'m| am) going to|i wanted to share)/i.test(lower)) {
    fluffPenalty = 15;
  }

  // 4. Hook Archetype Classification (Brock's 15 Frameworks)
  let detectedArchetype = BROCK_HOOK_ARCHETYPES.PATTERN_INTERRUPT;
  let archetypeScore = 18;

  if (/\b(stop doing|stop using|actually|unpopular opinion|controversial|lied to|worst advice|myth|opposite|against the grain)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.CONTRARIAN;
    archetypeScore = 25;
  } else if (/\b(here'?s how (?:i|he|she|we)|how i made|how i gained|lost \d+|made \$\d+|\d+ million views|\d+k views|and here'?s how|the result|finally finished)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.OUTCOME_BASED;
    archetypeScore = 25;
  } else if (/\b((?:good|disciplined|smart|lazy|successful|top \d+%?|rich|pro)\s+(?:entrepreneurs|snowboarders|creators|moms|men|women|students|people|athletes|investors)\s+(?:always|never|don'?t|start|do))\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.IDENTITY;
    archetypeScore = 24;
  } else if (/\b(if you(?:'re| are)|this is for (?:anyone|everyone|those)|calling all|if you have|if you want)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.DIRECT_ADDRESS;
    archetypeScore = 23;
  } else if (/\b(i almost quit|last year i was|i lost|it took me \d+ (?:years|months|days)|when i started|i was stuck)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.STORYTELLING;
    archetypeScore = 24;
  } else if (/\b(this one thing|this changed everything|the real reason|the secret to|nobody talks about|what happens when|they don'?t want you to know)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.CURIOSITY_GAP;
    archetypeScore = 25;
  } else if (/\b(i analyzed \d+|according to|the data shows|study shows|science says|research shows|fda|harvard|stanford|world health organization)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.AUTHORITY_DATA;
    archetypeScore = 24;
  } else if (/\b(is dead|is a scam|is completely useless|will change your life|guaranteed to|the only way to|100% of|never works)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.BOLD_CLAIM;
    archetypeScore = 23;
  } else if (/\b(before you go to|before your head hits|before 202\d|in 202\d|tonight|stop scrolling right now|do this today|before it'?s too late)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.TIME_BOUND;
    archetypeScore = 23;
  } else if (/\b(\b(?:[2-9]|10)\s+(?:ways|things|foods|mistakes|rules|steps|tips|tricks|reasons|habits)\b)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.LIST_STRUCTURE;
    archetypeScore = 22;
  } else if (/\b(pov:|when you |me when i |that feeling when)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.POV_RELATABLE;
    archetypeScore = 22;
  } else if (/\b(me before|vs|before and after|difference between)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.COMPARISON;
    archetypeScore = 22;
  } else if (/\b(wait a second|hold on|look at this|stop scrolling|wait what|did you see)\b/i.test(lower)) {
    detectedArchetype = BROCK_HOOK_ARCHETYPES.PATTERN_INTERRUPT;
    archetypeScore = 24;
  }

  // 5. Readability & 5th-Grade Simplicity Test (Brock: drunk grandma / 5th grader comprehension)
  let readabilityScore = 25;
  const longWords = words.filter(w => w.length > 8).length;
  if (longWords > 2) {
    readabilityScore -= 8;
  } else if (longWords === 1) {
    readabilityScore -= 3;
  }
  const hasDirectYou = /\b(you|your|you're)\b/i.test(lower);
  if (!hasDirectYou) {
    readabilityScore -= 3;
  }
  readabilityScore = Math.max(10, readabilityScore);

  const rawTotal = negativeScore + sweetSpotScore + archetypeScore + readabilityScore - fluffPenalty;
  const finalScore = Math.max(15, Math.min(100, Math.round(rawTotal)));

  let tacticalAdvice = 'Solid hook foundation';
  if (fluffPenalty > 0) {
    tacticalAdvice = 'Remove intro greeting/fluff! Cut straight to the first action word.';
  } else if (!hasNegativeWord) {
    tacticalAdvice = 'Flip to Negative Loss-Aversion framing (e.g. "Stop doing X", "The #1 mistake") for 2.3x CTR.';
  } else if (!inSweetSpot) {
    tacticalAdvice = wordCount > 11 ? `Hook is too long (${wordCount} words). Trim down to 5-8 words.` : 'Make the opening punch punchier with 5-8 clear words.';
  } else {
    tacticalAdvice = `Optimal ${detectedArchetype.name} with ${lossAversionMultiplier}x loss-aversion bias!`;
  }

  return {
    score: finalScore,
    negativeFraming: hasNegativeWord,
    lossAversionMultiplier: `${lossAversionMultiplier}x`,
    wordCount,
    inSweetSpot,
    archetype: detectedArchetype.name,
    archetypeTip: detectedArchetype.tip,
    fluffPenalty: fluffPenalty > 0,
    tacticalAdvice
  };
}

/**
 * Score a candidate clip through the upgraded Beast Engine v2.0
 */
function scoreBeastClip(text, duration, audioEnergy = null, options = {}) {
  const cleanText = (text || '').trim();
  const lower = cleanText.toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wps = duration > 0 ? (words.length / duration) : 2.5;

  // Extract opening hook statement (first 8-12 words or first sentence)
  const firstSentence = cleanText.split(/[.!?]/)[0] || words.slice(0, 10).join(' ');
  const brockHook = scoreBrockHook(firstSentence, 3.5);

  // 1. BEAST PILLAR 1: Brock 1,300 Hook Mastery (Max 25 pts)
  // Maps the Brock 100-pt hook evaluation into 25 pts
  const brockPillarScore = Math.round((brockHook.score / 100) * 25);

  // 2. BEAST PILLAR 2: Ollex Heatmap Audio Redline Spike (+6.5dB redline) (Max 20 pts)
  let audioScore = 14;
  let audioTip = 'Consistent energy flow';
  if (Array.isArray(audioEnergy) && audioEnergy.length > 0) {
    const maxVal = Math.max(...audioEnergy);
    const avgVal = audioEnergy.reduce((a, b) => a + b, 0) / audioEnergy.length;
    const peakRatio = avgVal > 0 ? (maxVal / avgVal) : 1;
    if (peakRatio >= 2.5 || maxVal >= 0.85) {
      audioScore = 20;
      audioTip = '⚡ Extreme audio surge (Ollex +6.5dB Redline Spiking hit)';
    } else if (peakRatio >= 1.8) {
      audioScore = 17;
      audioTip = 'High acoustic contrast and reaction spike';
    } else {
      audioScore = 12;
      audioTip = 'Moderate audio level; boost gain +4dB for streamer punch';
    }
  } else {
    // Transcript emotional loudness heuristic
    const hasShout = /\b(omg|wtf|screaming|shouting|backflip|rage|insane|let'?s go|shut up|oh my god|no way|holy|screams)\b/i.test(lower) || /!{2,}/.test(cleanText);
    if (hasShout) {
      audioScore = 19;
      audioTip = 'High emotional scream/hype peak detected in dialogue';
    }
  }

  // 3. BEAST PILLAR 3: Serviuos 180° Crazy Plot Twist (Max 20 pts)
  let twistScore = 12;
  let twistTip = 'Standard conversational progression';
  const hasPlotTwist = /\b(wait a second|move over|actually|turns out|plot twist|impossible|all of a sudden|out of nowhere|turn of events|until suddenly|wait what|hold on|big piece of|lied to)\b/i.test(lower);
  const hasAbsurdHook = /\b(why|how|if you|stop|never|the secret|you won'?t believe|this is why|crazy|nobody talks about|watch until the end|look at this)\b/i.test(words.slice(0, 6).join(' ').toLowerCase());

  if (hasPlotTwist && hasAbsurdHook) {
    twistScore = 20;
    twistTip = '🌪️ 180° Crazy Plot Twist + Absurd Opening Hook (Serviuos Rule 1)';
  } else if (hasPlotTwist) {
    twistScore = 17;
    twistTip = 'Pattern interrupt / unexpected turn keeps attention locked';
  } else if (hasAbsurdHook) {
    twistScore = 15;
    twistTip = 'Strong zero-delay opening hook stops the feed scroll';
  }

  // 4. BEAST PILLAR 4: High-Arousal Polarization & Savable Hack (Max 20 pts)
  let arousalScore = 12;
  let arousalTip = 'General relatable dialogue';
  const hasDebateClash = /\b(agree|disagree|masculine|feminine|fake|scam|hate|love|controversy|dangerous|hiding something|truth exposed|polarizing|cheat|caught|exposed)\b/i.test(lower);
  const hasSavableValue = /\b(did you know|life hack|secret trick|new trick|how to avoid|the real reason|shadow ban|shadowban|rule of|step by step|how to go viral|how to make money)\b/i.test(lower);

  if (hasDebateClash && hasSavableValue) {
    arousalScore = 20;
    arousalTip = '🔥 Polarizing Debate + Savable Knowledge (Massive Group Chat Shares)';
  } else if (hasDebateClash) {
    arousalScore = 17;
    arousalTip = 'Polarizing ideological debate triggers comments and sharing';
  } else if (hasSavableValue) {
    arousalScore = 16;
    arousalTip = 'High-utility hack forces viewers to hit Save/Bookmark';
  } else {
    arousalScore = 13;
  }

  // 5. BEAST PILLAR 5: Pacing Rhythm & Zero Dead Air (Max 15 pts)
  let pacingScore = 15;
  let pacingTip = 'Oddly satisfying cadence without dead air';
  if (wps < 1.9) {
    pacingScore -= 5;
    pacingTip = 'Cadence too slow (<1.9 wps). Aggressively cut silent pauses.';
  } else if (wps > 4.2) {
    pacingScore -= 3;
    pacingTip = 'Speech too rushed (>4.2 wps). Ensure key words have breathing room.';
  }

  // Daniel Bitton 31-Second Golden Sweet Spot ($1M/month formula)
  const is31sGoldenZone = duration >= 28 && duration <= 34;
  if (is31sGoldenZone) {
    pacingTip = '🎯 Daniel Bitton 31s Golden Sweet Spot (Optimal for 100%+ AVD & 200% Rewatch Loop)';
  } else if (duration > 65) {
    pacingScore -= 4;
    pacingTip = 'Trim to 28s-34s golden zone for maximum Shorts/TikTok completion %';
  } else if (duration < 18) {
    pacingScore -= 4;
    pacingTip = 'Too short (<18s). Needs proper resolution payoff.';
  }
  pacingScore = Math.max(5, Math.min(15, pacingScore));

  const totalScore = brockPillarScore + audioScore + twistScore + arousalScore + pacingScore;

  let tier = BEAST_TIERS.VIRAL_CANDIDATE;
  if (totalScore >= BEAST_TIERS.ULTRA_BEAST.min) tier = BEAST_TIERS.ULTRA_BEAST;
  else if (totalScore >= BEAST_TIERS.BEAST_JUICER.min) tier = BEAST_TIERS.BEAST_JUICER;
  else if (totalScore >= BEAST_TIERS.HIGH_ENERGY.min) tier = BEAST_TIERS.HIGH_ENERGY;

  let recommendedBgMusic = 'beast_phonk_pulse.mp3';
  if (twistScore >= 17) {
    recommendedBgMusic = 'suspense_tension_drone.mp3';
  } else if (hasSavableValue || brockHook.archetype.includes('Story') || brockHook.archetype.includes('Outcome')) {
    recommendedBgMusic = 'lofi_viral_groove.mp3';
  }

  return {
    score: totalScore,
    tier: tier.label,
    badge: tier.badge,
    brockHook,
    is31sGoldenZone,
    audioScore: { score: audioScore, max: 20, tip: audioTip },
    twistScore: { score: twistScore, max: 20, tip: twistTip },
    arousalScore: { score: arousalScore, max: 20, tip: arousalTip },
    pacingScore: { score: pacingScore, max: 15, tip: pacingTip },
    recommendedPreset: {
      captionStyle: 'Lemon Milk Bold (Deagzzz/Speed)',
      framing: lower.includes('game') || lower.includes('clutch') ? 'gaming_split' : 'smart_face_lock',
      audioGain: '+6.5dB Redline Punch',
      bgMusic: recommendedBgMusic,
      musicDucking: '-20dB Sidechain Bed',
      dynamicZoom: '1.25x Dynamic Punch-Ins',
      seamlessLoop: 'Daniel Bitton 200% Rewatch Loop',
      colorGrade: brockHook.negativeFraming ? 'Threat Red Alert Mood' : 'Clean Punch Saturation',
      outroEffect: 'Climax Blur + Shake + Glow Reaction',
      hookVisual: brockHook.negativeFraming ? 'Loss-Aversion Red Alert Tag' : 'Curiosity Gold Pill'
    }
  };
}

/**
 * Discover best beast moments across a full video transcript
 */
async function findBeastMoments(transcript, duration, options = {}) {
  const segments = Array.isArray(transcript) ? transcript : (transcript.segments || []);
  if (!segments.length) return [];

  const targetCount = Math.max(1, Math.min(100, Number(options.clipCount || 10)));
  const minDuration = Math.max(18, Number(options.minDuration || 20));
  const maxDuration = Math.min(90, Math.max(minDuration + 10, Number(options.maxDuration || 45)));

  const candidates = [];

  for (let i = 0; i < segments.length; i++) {
    const startSeg = segments[i];
    let windowText = startSeg.text;
    let endIdx = i;

    for (let j = i; j < segments.length; j++) {
      endIdx = j;
      const endSeg = segments[j];
      const dur = endSeg.end - startSeg.start;

      if (dur < minDuration) continue;
      if (dur > maxDuration) break;

      const fullSnippet = segments.slice(i, j + 1).map(s => s.text).join(' ');
      const beast = scoreBeastClip(fullSnippet, dur, transcript.audio_energy, options);

      // Generate viral title with Ollex / Deagzzz / Brock multi-color keyword flair
      const title = synthesizeBeastTitle(startSeg.text, fullSnippet);

      candidates.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `beast_${Date.now()}_${i}_${j}`,
        start: Number(startSeg.start.toFixed(2)),
        end: Number(endSeg.end.toFixed(2)),
        duration: Number(dur.toFixed(2)),
        title,
        hook: startSeg.text.slice(0, 160),
        score: beast.score,
        viralBadge: beast.tier,
        category: `⚡ ${beast.brockHook.archetype}`,
        recommendedFraming: beast.recommendedPreset.framing,
        beast: {
          score: beast.score,
          tier: beast.tier,
          badge: beast.badge,
          audioSurge: beast.audioScore.score,
          twist: beast.twistScore.score,
          arousal: beast.arousalScore.score,
          pacing: beast.pacingScore.score,
          audioTip: beast.audioScore.tip,
          twistTip: beast.twistScore.tip,
          arousalTip: beast.arousalScore.tip,
          pacingTip: beast.pacingScore.tip,
          brockHook: beast.brockHook,
          preset: beast.recommendedPreset
        }
      });

      if (dur >= minDuration + 12) break;
    }
  }

  // Sort descending by score and eliminate heavily overlapping clips
  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  for (const c of candidates) {
    if (selected.length >= targetCount) break;
    const overlaps = selected.some(s => Math.abs(s.start - c.start) < 14);
    if (!overlaps) {
      selected.push(c);
    }
  }

  return selected;
}

module.exports = {
  scoreBrockHook,
  scoreBeastClip,
  findBeastMoments,
  BEAST_TIERS,
  BROCK_HOOK_ARCHETYPES,
  BROCK_NEGATIVE_TRIGGERS
};
