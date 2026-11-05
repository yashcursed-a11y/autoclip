const crypto = require('node:crypto');
const { TEMPLATES } = require('./config');
const { getSettings, getFeedback } = require('./db');

// Multi-hour transcript chunking: 10-minute window with 2-minute overlap
const CHUNK_DURATION = 600; // 10 minutes in seconds
const CHUNK_OVERLAP = 120;  // 2 minutes in seconds

function chunkTranscript(transcript, duration) {
  const segments = transcript.segments || [];
  if (segments.length === 0 || duration <= CHUNK_DURATION) {
    return [{ chunkIndex: 0, start: 0, end: duration, segments }];
  }

  const chunks = [];
  let chunkStart = 0;
  let chunkIndex = 0;

  while (chunkStart < duration) {
    const chunkEnd = Math.min(duration, chunkStart + CHUNK_DURATION);
    const chunkSegments = segments.filter(
      s => s.end >= chunkStart && s.start <= chunkEnd
    );

    chunks.push({
      chunkIndex,
      start: chunkStart,
      end: chunkEnd,
      segments: chunkSegments
    });

    if (chunkEnd >= duration) break;
    chunkStart += (CHUNK_DURATION - CHUNK_OVERLAP);
    chunkIndex++;
  }

  return chunks;
}

// Offline editorial ranking v2. Scores compare candidates; they are not view forecasts.
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const finite = (v, fallback) => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
const tokens = text => (String(text || '').toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || []);
const STOP = new Set('a an the and or but so to of in on at for with is are was were be been it this that these those i we you he she they my our your his her their as by from have has had do did not just very can will would'.split(' '));
const terms = text => new Set(tokens(text).filter(w => w.length > 2 && !STOP.has(w)));
const terminal = text => /[.!?…]["'”’\])]*$/.test(text.trim());
const dangling = text => /\b(and|but|because|if|when|with|to|or|which|that means|the reason is)\s*[,.!?]*$/i.test(text.trim());
const CUES = {
  stakes: /\b(risk|lost|lose|win|won|failed|mistake|danger|bet|challenge|cost|saved|survive|almost died|last chance)\b/i,
  insight: /\b(because|instead|here'?s why|the reason|for example|means|learned|realized|lesson|rule|tip|how to)\b/i,
  resolution: /\b(finally|in the end|turned out|realized|learned|that'?s why|that is why|the answer|as a result|so now|won|win|lost|solved|finished|saved|worked|done|gg|final shot|went wild)\b/i,
  emotion: /\b(laugh|laughing|haha|lol|crying|speechless|shocked|no way|can'?t believe|cannot believe|terrified|furious|screaming)\b/i,
  story: /\b(one day|one time|last night|years ago|when i|when we|suddenly|then|after|before|happened)\b/i,
  gaming: /\b(game|gaming|clutch|boss|round|respawn|controller|match|opponent|shot|gg)\b/i,
  conflict: /\b(disagree|wrong|lying|lie|fight|argue|argument|hate|shut up)\b/i,
  promo: /\b(sponsored by|use (?:my |our )?(?:promo |discount )?code|link in (?:my |the )?(?:bio|description)|subscribe to my|thanks to our sponsor)\b/i,
  technical: /\b(can you hear me|mic check|testing one two|fix (?:the |my )?(?:microphone|audio)|technical difficulties|waiting for (?:the )?(?:stream|connection))\b/i
};

function audioProfile(audioEnergy) {
  const values = Array.isArray(audioEnergy) ? audioEnergy.map(v => Math.max(0, finite(v, 0))) : [];
  const sorted = values.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const deviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const scale = Math.max((deviations[Math.floor(deviations.length / 2)] || 0) * 1.4826, median * 0.15, 0.0001);
  const prefix = [0];
  for (const value of values) prefix.push(prefix[prefix.length - 1] + value);
  return { values, median, scale, prefix };
}

function getAudioDynamics(audioEnergy, start, end, profile = audioProfile(audioEnergy)) {
  const { values, median, scale, prefix } = profile;
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(values.length, Math.ceil(end));
  if (e <= s) return { available: false, coverage: 0, energyScore: 0, surgeRatio: 1, isSpike: false, dynamicRange: 0, silenceRatio: 0 };
  let peak = 0, low = Infinity, quiet = 0, peakIndex = s;
  for (let i = s; i < e; i++) {
    if (values[i] > peak) { peak = values[i]; peakIndex = i; }
    low = Math.min(low, values[i]);
    if (values[i] <= Math.max(0.0001, median * 0.12)) quiet++;
  }
  // Compare with surrounding audio too: a loud music bed should not count as a reaction.
  const left = Math.max(0, s - 30), right = Math.min(values.length, e + 30);
  const surroundCount = (s - left) + (right - e);
  const baseline = surroundCount ? (prefix[s] - prefix[left] + prefix[right] - prefix[e]) / surroundCount : median;
  const reference = Math.max(median, baseline, 0.0001);
  const surgeRatio = peak / reference;
  const contrast = (peak - low) / Math.max(peak, 0.0001);
  const robustZ = (peak - reference) / scale;
  const coverage = Math.min(1, (e - s) / Math.max(1, end - start));
  const silenceRatio = quiet / (e - s);
  const energyScore = Math.round(clamp(35 + Math.min(30, Math.max(0, robustZ) * 5) + contrast * 25 - silenceRatio * 25));
  return { available: true, coverage, energyScore, surgeRatio: Number(surgeRatio.toFixed(2)),
    isSpike: surgeRatio >= 1.5 && contrast >= 0.3, dynamicRange: peak - low, silenceRatio,
    peakTime: peakIndex, robustZ: Number(robustZ.toFixed(2)) };
}

function synthesizeViralTitle(firstText, fullText = '') {
  // Extract an actual sentence; never invent arrests, dollar amounts, or outcomes.
  const text = String(firstText || fullText || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Audio highlight — review needed';
  const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
  const words = sentence.split(/\s+/);
  return words.length > 14 ? words.slice(0, 14).join(' ') + '…' : sentence;
}

function evaluateHookQuality(text, words, sensitivity = 'balanced') {
  let score = 38;
  const reasons = [];
  if (/\?|^(why|how|what if|did you know|would you|can you)\b/i.test(text)) { score += 22; reasons.push('opening question'); }
  if (/\b(nobody|never|secret|instead|actually|mistake|the truth|what happens|what happened|wait until|unbelievable)\b/i.test(text)) { score += 15; reasons.push('curiosity or contrast'); }
  if (CUES.stakes.test(text)) { score += 16; reasons.push('specific stakes'); }
  if (/\d|\b(first|last|only|every|exact)\b/i.test(text)) score += 8;
  if (CUES.emotion.test(text) || /!/.test(text)) score += 6;
  if (/^(look|listen|watch|wait|imagine|stop)\b/i.test(text)) score += 6;
  if (/^(um|uh|so basically|well anyway|welcome back|hey guys)\b/i.test(text)) score -= 22;
  if (sensitivity === 'aggressive' && reasons.length) score += 3;
  return { hookScore: Math.round(clamp(score)), hookReason: reasons.join(', ') || 'plain opening' };
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common++;
  return common / (a.size + b.size - common);
}

function normalizedSegments(transcript, duration, lo, hi) {
  const result = [];
  for (const raw of Array.isArray(transcript?.segments) ? transcript.segments : []) {
    const start = finite(raw?.start, NaN), end = finite(raw?.end, NaN);
    const text = typeof raw?.text === 'string' ? raw.text.replace(/^\s*>>\s*/, '').replace(/\s+/g, ' ').trim() : '';
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || start < lo || end > hi || end > duration || end <= start) continue;
    const wordList = tokens(text);
    if (!wordList.length || /^\s*[\[(](?:music|silence|applause)[\])]\s*$/i.test(text)) continue;
    const validWords = (Array.isArray(raw.words) ? raw.words : []).filter(w =>
      typeof w?.word === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= start && w.end <= end && w.end > w.start);
    // Split only with complete real word timings; never interpolate sentence timestamps.
    const timedTokens = tokens(validWords.map(w => w.word).join(' '));
    const complete = timedTokens.join(' ') === wordList.join(' ') && validWords.every((w, i) => !i || w.start >= validWords[i - 1].end);
    if (complete && validWords.some((w, i) => i < validWords.length - 1 && terminal(w.word))) {
      let group = [];
      for (let i = 0; i < validWords.length; i++) {
        group.push(validWords[i]);
        if (terminal(validWords[i].word) || i === validWords.length - 1) {
          const part = group.map(w => w.word).join(' ');
          result.push({ start: group[0].start, end: group[group.length - 1].end, text: part, words: group, speaker: raw.speaker });
          group = [];
        }
      }
    } else result.push({ start, end, text, words: complete ? validWords : [], speaker: raw.speaker });
  }
  result.sort((a, b) => a.start - b.start || a.end - b.end);
  return result.filter((s, i) => !i || !(s.start === result[i - 1].start && s.end === result[i - 1].end && s.text === result[i - 1].text));
}

function speechStats(segments, start, end) {
  const intervals = segments.flatMap(s => s.words.length ? s.words.map(w => [w.start, w.end]) : [[s.start, s.end]]).sort((a, b) => a[0] - b[0]);
  let cursor = start, covered = 0, longestGap = 0, earlyGap = 0;
  for (const [a, b] of intervals) {
    const gap = Math.max(0, a - cursor);
    longestGap = Math.max(longestGap, gap);
    if (cursor < start + (end - start) / 2) earlyGap = Math.max(earlyGap, gap);
    covered += Math.max(0, b - Math.max(cursor, a));
    cursor = Math.max(cursor, b);
  }
  longestGap = Math.max(longestGap, end - cursor);
  return { coverage: clamp(covered / (end - start), 0, 1), longestGap, earlyGap,
    timing: segments.every(s => s.words.length) ? 'word' : 'segment' };
}

function buildFeedbackProfile(feedback) {
  const positives = Array.isArray(feedback?.accepted) ? feedback.accepted : [];
  const negatives = Array.isArray(feedback?.rejected) ? feedback.rejected : [];
  if (positives.length + negatives.length < 3) return { accepted: [], rejected: [] };
  const prepare = entries => entries.slice(-200).map(entry => {
    const clip = entry?.clip || entry || {};
    return terms(`${clip.hook || ''} ${(Array.isArray(clip.captionKeywords) ? clip.captionKeywords : []).join(' ')}`);
  }).filter(known => known.size >= 3);
  return { accepted: prepare(positives), rejected: prepare(negatives) };
}

function feedbackAdjustment(contentTerms, profile) {
  // Feedback is a bounded preference, never a way to bypass quality gates.
  const match = entries => entries.reduce((best, known) => Math.max(best, similarity(contentTerms, known)), 0);
  return Math.round(clamp((match(profile.accepted) - match(profile.rejected)) * 8, -5, 5));
}

function selectDiverse(candidates, count) {
  const selected = [];
  const pool = candidates.slice();
  while (pool.length && selected.length < count) {
    let best = -1, bestUtility = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const overlap = selected.some(other => Math.max(0, Math.min(candidate.end, other.end) - Math.max(candidate.start, other.start)) > 0.1 * Math.min(candidate.end - candidate.start, other.end - other.start));
      if (overlap) continue;
      const repetition = selected.reduce((n, other) => Math.max(n, similarity(candidate._terms, other._terms)), 0);
      if (repetition >= 0.85) continue;
      // Also suppress a shorter retelling contained almost entirely in a selected passage.
      const contained = selected.some(other => {
        const smaller = candidate._terms.size < other._terms.size ? candidate._terms : other._terms;
        if (smaller.size < 8) return false;
        let common = 0;
        for (const word of smaller) if (candidate._terms.has(word) && other._terms.has(word)) common++;
        return common / smaller.size >= 0.95;
      });
      if (contained) continue;
      const utility = candidate.score - repetition * 6;
      if (utility > bestUtility || (utility === bestUtility && candidate.start < pool[best]?.start)) { bestUtility = utility; best = i; }
    }
    if (best < 0) break;
    selected.push(pool.splice(best, 1)[0]);
  }
  selected.forEach((clip, i) => { clip.rank = i + 1; delete clip._terms; });
  return selected.sort((a, b) => a.start - b.start);
}

function localLimits(duration, options) {
  const end = Math.max(0, finite(duration, 0));
  const min = Math.max(20, finite(options.minDuration, 20));
  return { min, max: Math.max(min, finite(options.maxDuration, 65)),
    count: Math.floor(clamp(finite(options.clipCount, 5), 0, 200)),
    lo: clamp(finite(options.windowStart, 0), 0, end), hi: clamp(finite(options.windowEnd, end), 0, end),
    cutoff: clamp(finite(options.minScore, 65), 0, 100), target: Math.max(min, finite(options.clipLength, 35)) };
}

function heuristicFindMoments(transcript, duration, options = {}, audioEnergy = transcript?.audio_energy || [], feedback = null) {
  const limits = localLimits(duration, options);
  const { min, max, count, lo, hi, cutoff, target } = limits;
  if (!count || hi - lo < min) return [];
  const profile = audioProfile(audioEnergy);
  const preferences = buildFeedbackProfile(feedback);
  const segments = normalizedSegments(transcript, finite(duration, 0), lo, hi);
  const candidates = [];
  if (!segments.length) {
    // Audio-only suggestions require a real local peak. Silence/music never earns a fabricated hook.
    for (let second = Math.ceil(lo); second < Math.min(hi, profile.values.length); second++) {
      const value = profile.values[second];
      if (value <= profile.median + 3 * profile.scale || value < (profile.values[second - 1] || 0) || value <= (profile.values[second + 1] || 0)) continue;
      const length = Math.min(max, target, hi - lo);
      const start = clamp(second - length * 0.6, lo, hi - length), end = start + length;
      const dynamics = getAudioDynamics(audioEnergy, start, end, profile);
      if (!dynamics.isSpike || dynamics.coverage < 0.9) continue;
      const score = Math.min(60, Math.round(dynamics.energyScore * 0.65));
      if (score < cutoff) continue;
      candidates.push({ id: crypto.randomUUID(), start, end, score, hookScore: 0, flowScore: 0, payoffScore: 0,
        energyScore: dynamics.energyScore, breakdown: { hook: 0, flow: 0, payoff: 0, energy: dynamics.energyScore, surge: `${dynamics.surgeRatio}x` },
        viralBadge: 'Review candidate', category: 'Audio peak', contentType: 'general', recommendedFraming: 'smart',
        title: 'Audio peak — review needed', hook: '', reason: `Measured audio peak at ${second}s; speech and visuals unverified`,
        captionKeywords: [], contextWarning: 'Audio-only suggestion; check visual context and payoff.',
        confidence: 'low', source: 'local', engineVersion: 'offline-v2', _terms: new Set() });
    }
    return selectDiverse(candidates, count);
  }
  const niche = (Array.isArray(options.nicheKeywords) ? options.nicheKeywords : String(options.nicheKeywords || '').split(',')).map(s => tokens(s).join(' ')).filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const first = segments[i], previous = segments[i - 1];
    const cleanStart = !previous || terminal(previous.text) || first.start - previous.end >= 0.65 || (first.speaker !== undefined && previous.speaker !== undefined && first.speaker !== previous.speaker);
    const dependent = /^(and|but|so|or|because|well|like|as i said|that one|he did|she did|it was|they did)\b/i.test(first.text);
    if (options.strictBoundaries !== false && (!cleanStart || dependent)) continue;
    // A question mark or a later good sentence cannot rescue a contextless first utterance.
    const firstSentence = first.text.split(/(?<=[.!?])\s+/)[0];
    const firstTokens = tokens(firstSentence);
    if (firstTokens.length < 4 || terms(firstSentence).size < 2) continue;
    let fullText = '';
    for (let j = i; j < segments.length; j++) {
      const last = segments[j], span = last.end - first.start;
      if (span > max) break;
      fullText += (fullText ? ' ' : '') + last.text;
      if (span < min) continue;
      const next = segments[j + 1];
      const cleanEnd = terminal(last.text) || (next && next.start - last.end >= 0.8);
      if (options.strictBoundaries !== false && (!cleanEnd || dangling(last.text))) continue;
      const words = tokens(fullText);
      if (words.length < 12) continue;
      const window = segments.slice(i, j + 1);
      const speech = speechStats(window, first.start, last.end);
      const wps = words.length / span;
      if (options.filterDeadAir !== false && (speech.coverage < 0.48 || speech.earlyGap > 3.5 || speech.longestGap > 6)) continue;
      // First three seconds only; long ASR segments must not leak late hooks into the opening.
      const opening = window.filter(s => s.start < first.start + 3).map(s => {
        if (s.words.length) return s.words.filter(w => w.start < first.start + 3).map(w => w.word).join(' ');
        return s.text.split(/\s+/).slice(0, Math.max(1, Math.ceil(tokens(s.text).length * Math.min(1, (first.start + 3 - s.start) / (s.end - s.start))))).join(' ');
      }).join(' ');
      const hook = evaluateHookQuality(opening, tokens(opening), options.hookSensitivity);
      const dynamics = getAudioDynamics(audioEnergy, first.start, last.end, profile);
      let flow = 90 - Math.max(0, 1.6 - wps) * 24 - Math.max(0, wps - 3.8) * 22 - (1 - speech.coverage) * 25 - Math.max(0, speech.longestGap - 1.2) * 6;
      const sentences = window.map(s => tokens(s.text).join(' '));
      const repeated = 1 - new Set(sentences).size / sentences.length;
      const lexical = new Set(words).size / words.length;
      const repetitionPenalty = Math.min(24, repeated * 30 + Math.max(0, 0.3 - lexical) * 40);
      flow = Math.round(clamp(flow - repetitionPenalty));
      // Resolution requires more than punctuation. Look at the actual final sentence/tail.
      const tail = last.text.split(/(?<=[.!?])\s+/).slice(-1)[0];
      let payoff = 28 + (cleanEnd ? 18 : 0) + (CUES.resolution.test(tail) ? 32 : 0) + (CUES.emotion.test(tail) ? 15 : 0);
      if (CUES.insight.test(tail) && !/\?$/.test(tail)) payoff += 20;
      if (/\?$/.test(tail) && !CUES.resolution.test(tail)) payoff -= 18;
      if (dangling(tail)) payoff -= 35;
      if (/^(if|unless|maybe|perhaps|imagine|what if)\b/i.test(tail)) payoff -= 20;
      const unresolvedPromise = /\b(i will (?:show|explain)|let me (?:show|explain)|wait until|here is what happened next|here'?s what happened next)\b/i.test(tail);
      if (unresolvedPromise) payoff -= 30;
      payoff = Math.round(clamp(payoff));
      const contentTerms = terms(fullText);
      const openingTerms = terms(opening), tailTerms = terms(tail);
      let clarity = 82 - (dependent ? 28 : 0) - (!cleanStart ? 20 : 0);
      if (/^(he|she|they|it|this|that)\b/i.test(opening)) clarity -= 12;
      if (openingTerms.size >= 3 && similarity(openingTerms, tailTerms) > 0.08) clarity += 8;
      if (/\b(as (?:i|we) (?:said|mentioned)|earlier|previous video|part two|part 2)\b/i.test(fullText)) clarity -= 18;
      clarity = Math.round(clamp(clarity));
      const specificity = Math.round(clamp(40 + Math.min(25, contentTerms.size * 0.8) + (/\d/.test(fullText) ? 12 : 0) + (CUES.insight.test(fullText) ? 12 : 0) + (CUES.story.test(fullText) ? 8 : 0)));
      const template = options.templateId || 'viral';
      const weights = template === 'insight' || options.energyBias === 'wisdom'
        ? { hook: 0.23, flow: 0.17, payoff: 0.25, clarity: 0.19, specificity: 0.12, energy: 0.04 }
        : { hook: 0.26, flow: 0.18, payoff: 0.24, clarity: 0.16, specificity: 0.08, energy: 0.08 };
      const availableAudio = dynamics.available && dynamics.coverage >= 0.9;
      const components = { hook: hook.hookScore, flow, payoff, clarity, specificity, energy: dynamics.energyScore };
      let weighted = 0, weightSum = 0;
      for (const [key, weight] of Object.entries(weights)) {
        if (key === 'energy' && !availableAudio) continue;
        weighted += components[key] * weight; weightSum += weight;
      }
      const templateMatch = (template === 'insight' && CUES.insight.test(fullText)) || (template === 'gaming' && CUES.gaming.test(fullText)) ||
        (template === 'funny' && CUES.emotion.test(fullText)) || (template === 'story' && CUES.story.test(fullText) && CUES.resolution.test(tail)) ||
        (template === 'reactions' && CUES.emotion.test(fullText)) || (options.energyBias === 'conflict' && CUES.conflict.test(fullText)) ||
        (options.energyBias === 'wisdom' && CUES.insight.test(fullText)) ||
        (options.energyBias === 'comedy' && CUES.emotion.test(fullText)) ||
        (options.energyBias === 'high_voltage' && availableAudio && dynamics.isSpike);
      const normalizedText = ` ${words.join(' ')} `;
      const relevance = Math.min(4, niche.filter(phrase => normalizedText.includes(` ${phrase} `)).length * 2);
      const preference = feedbackAdjustment(contentTerms, preferences);
      const penalties = [];
      if (CUES.promo.test(fullText)) penalties.push({ reason: 'sponsor or promotion', points: 22 });
      if (CUES.technical.test(fullText)) penalties.push({ reason: 'technical setup', points: 25 });
      if (speech.earlyGap > 3.5) penalties.push({ reason: 'long opening silence', points: 20 });
      if (repetitionPenalty > 0) penalties.push({ reason: 'repeated dialogue', points: Math.round(repetitionPenalty * 0.4) });
      const lengthPenalty = Math.min(4, Math.abs(span - target) / Math.max(1, target) * 4);
      let score = Math.round(clamp(weighted / weightSum + (templateMatch ? 3 : 0) + relevance + preference - lengthPenalty - penalties.reduce((sum, p) => sum + p.points, 0), 0, 99));
      // Loudness/keywords cannot rescue an absent ending or a weak opening.
      if (payoff < 50) score = Math.min(score, 64);
      if (hook.hookScore < 45 || clarity < 50) score = Math.min(score, 64);
      if (score < cutoff) continue;
      const warnings = [];
      if (!availableAudio) warnings.push('Full audio measurements unavailable');
      if (speech.timing === 'segment') warnings.push('Silence inside coarse transcript segments is unverified');
      if (dependent || clarity < 65) warnings.push('Opening may need earlier context');
      if (payoff < 50) warnings.push('Ending has weak resolution evidence');
      const category = classifyMoment(score, words, availableAudio ? dynamics.energyScore : 0, template, options.energyBias);
      category.viralBadge = score >= 85 ? 'Strong editorial candidate' : score >= 70 ? 'Promising candidate' : 'Review candidate';
      candidates.push({ id: crypto.randomUUID(), start: first.start, end: last.end, score,
        hookScore: hook.hookScore, flowScore: flow, payoffScore: payoff, energyScore: dynamics.energyScore,
        breakdown: { ...components, surge: availableAudio ? `${dynamics.surgeRatio}x` : null,
          weights, audioAvailable: availableAudio, preference, relevance, penalties, lengthPenalty: Number(lengthPenalty.toFixed(2)) },
        ...category, title: synthesizeViralTitle(first.text, fullText), hook: opening.slice(0, 180),
        reason: `${hook.hookReason}; ${wps.toFixed(2)} words/s; ${Math.round(speech.coverage * 100)}% measured speech coverage; ${payoff >= 70 ? 'resolution cue' : 'limited resolution evidence'} in ending${penalties.length ? '; ' + penalties.map(p => p.reason).join(', ') : ''}`,
        captionKeywords: [...contentTerms].slice(0, 4), speechDensity: Number(wps.toFixed(2)), contextWarning: warnings.join('. '),
        confidence: speech.timing === 'word' && availableAudio ? 'medium' : 'low',
        evidence: { opening, ending: tail, speechTiming: speech.timing, longestGap: Number(speech.longestGap.toFixed(2)), visualAnalysis: false },
        source: 'local', engineVersion: 'offline-v2', _terms: contentTerms });
    }
  }
  return selectDiverse(candidates, count);
}


// Helper to assign viral badge and category
function classifyMoment(score, words, energy, templateId, energyBias) {
  let viralBadge = '✨ Strong Retention';
  if (score >= 92) viralBadge = '🔥 Diamond Viral Goldmine';
  else if (score >= 86) viralBadge = '⚡ Elite Hook Master';
  else if (score >= 80) viralBadge = '🌟 High Engagement';

  let category = '🔥 Viral Hook';
  let contentType = 'general';
  let recommendedFraming = 'smart';

  const textStr = words.join(' ');
  const comedyCount = (textStr.match(/\b(haha|lol|laugh|funny|joke|bro|crying|died|cringe)\b/g) || []).length;
  const wisdomCount = (textStr.match(/\b(because|reason|learn|remember|secret|truth|rule|tip|fact|million|how to)\b/g) || []).length;
  const conflictCount = (textStr.match(/\b(wrong|lie|disagree|fight|hate|never|no way|argue|shut up|yelling)\b/g) || []).length;
  const gamingCount = (textStr.match(/\b(game|gaming|play|playing|controller|clutch|boss|died|kill|respawn|round|spectate|rage|fortnite|fifa|roblox|gta|minecraft|nba|elden|shoot|aim|gun|jump)\b/g) || []).length;
  const duoCallCount = (textStr.match(/\b(facetime|call|calling|ring|phone|pick up|answer|discord|ometv|zoom|guest|two of us)\b/g) || []).length;
  const chatReviewCount = (textStr.match(/\b(chat|reddit|tweet|twitter|tiktok|video|react|reacting|look at this|comments|read|pause)\b/g) || []).length;

  if (duoCallCount >= 2 || (duoCallCount >= 1 && (textStr.includes('pick up') || textStr.includes('facetime')))) {
    category = '👥 Duo FaceTime / Call';
    contentType = 'duo_facetime';
    recommendedFraming = 'face_stack';
  } else if (gamingCount >= 2 || (gamingCount >= 1 && energy >= 60) || templateId === 'gaming') {
    category = '🎮 Gaming Clutch & Rage';
    contentType = 'gaming';
    recommendedFraming = 'gaming_split';
  } else if (chatReviewCount >= 2 || templateId === 'reaction') {
    category = '💬 Chat Review & Reaction';
    contentType = 'chat_review';
    recommendedFraming = 'smart';
  } else if (energyBias === 'comedy' || comedyCount >= 2 || templateId === 'funny') {
    category = '😂 Comedy Punchline';
    contentType = 'comedy';
    recommendedFraming = 'smart';
  } else if (energyBias === 'wisdom' || wisdomCount >= 2 || templateId === 'insight') {
    category = '💡 Deep Insight';
    contentType = 'insight';
    recommendedFraming = 'smart';
  } else if (energyBias === 'conflict' || conflictCount >= 2) {
    category = '🥊 Heated Conflict';
    contentType = 'conflict';
    recommendedFraming = 'face';
  } else if (energyBias === 'high_voltage' || energy >= 65) {
    category = '⚡ Action Spike';
    contentType = 'action';
    recommendedFraming = 'gaming_split';
  }

  return { viralBadge, category, contentType, recommendedFraming };
}

// Call Gemini API via Google AI Pro key
async function geminiFindMoments(transcriptChunk, duration, options, apiKey, audioEnergy, feedback) {
  const template = TEMPLATES.find(t => t.id === options.templateId) || TEMPLATES[0];
  const targetCount = Number(options.clipCount || 5);
  const minDur = Math.max(20, Number(options.minDuration || 20));
  const maxDur = Math.max(minDur + 10, Number(options.maxDuration || 65));

  const minScoreCutoff = Math.max(50, Math.min(95, Number(options.minScore || 80)));
  const hookSensitivity = options.hookSensitivity || 'balanced';
  const energyBias = options.energyBias || 'auto';
  const nicheKeywords = options.nicheKeywords ? String(options.nicheKeywords) : '';

  const formattedSegments = (transcriptChunk.segments || []).map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: "${s.text}"`).join('\n');

  const systemInstruction = `You are AUTOCLIP AI, the world's most elite short-form viral video editor (style of OpusClip Pro, MrBeast, and Kai Cenat clips).
Your mission: Analyze timestamped transcript segments and pinpoint high-retention viral moments that will blow up on TikTok, YouTube Shorts, and Reels.

Template Selected: ${template.name}
Template Goal: ${template.promptCriteria}
${options.customBrief ? `User Custom Brief: "${options.customBrief}"` : ''}
${nicheKeywords ? `User Priority Keywords: "${nicheKeywords}"` : ''}
Scoring Criteria: Hook Sensitivity=${hookSensitivity}, Emotion Bias=${energyBias}, Min Score Cutoff=${minScoreCutoff}

Strict Viral Rules:
1. MINIMUM DURATION: Every clip MUST be at least 20.0 seconds long (end - start >= 20). Reject anything shorter than 20 seconds.
2. MAXIMUM DURATION: Between 20s and ${maxDur}s.
3. GROUNDING: Timestamps MUST fall strictly within [${transcriptChunk.start}s - ${transcriptChunk.end}s]. Snap start and end to real spoken sentence boundaries. Never cut off mid-word or mid-thought.
4. THE 3-SECOND HOOK: The first sentence MUST command attention (curiosity gap, high-stakes claim, heated conflict, or crazy question). Reject slow rambling intros starting with "um", "uh", or "so basically".
5. CLEAN PAYOFF: The clip MUST conclude with a punchline, emotional reaction, or decisive revelation.
6. VIRAL HEADLINES: Give each clip a high-CTR, click-worthy title formatted for social media with capitalization and emojis (e.g., "HE ACTUALLY DID THIS?! 💀", "Surviving Miami With ONLY $100 💸", "Wait For The Reaction... 😭"). Never output boring sentence fragments.
7. MULTI-FACTOR SCORING: Provide component scores: hook_score (0-100), flow_score (0-100), energy_score (0-100), payoff_score (0-100), and overall score (0-100).
8. NO "L" CLIPS: Reject boring filler, technical delays, or monotone discussions. Only return moments scoring ${minScoreCutoff}+.
9. Return JSON ONLY adhering to the requested schema.`;

  const chunkSpan = Math.max(1, (transcriptChunk.end - transcriptChunk.start));
  const estimatedTotalChunks = Math.max(1, Math.ceil(duration / chunkSpan));
  const clipsPerChunk = Math.max(3, Math.min(12, Math.ceil((targetCount * 1.4) / estimatedTotalChunks)));

  const prompt = `Here is the timestamped transcript from ${transcriptChunk.start}s to ${transcriptChunk.end}s:

${formattedSegments.slice(0, 25000)}

Find up to ${clipsPerChunk} top-tier viral clips matching the criteria. Return JSON in this exact structure:
{
  "clips": [
    {
      "start": 12.0,
      "end": 35.0,
      "score": 95,
      "hook_score": 96,
      "flow_score": 92,
      "energy_score": 94,
      "payoff_score": 90,
      "title": "BRO COMPLETELY SNAPPED 💀",
      "hook": "The opening hook line spoken",
      "reason": "Explosive curiosity hook with high conversational tension and punchline finish",
      "caption_keywords": ["keyword1", "keyword2"],
      "context_warning": "Any context note, or empty string"
    }
  ]
}`;

  const candidateModels = Array.from(new Set([
    options.geminiModel,
    'gemini-3-flash-preview',
    'gemini-3.8-flash'
  ].filter(Boolean))).slice(0, 2);

  let lastErr = null;
  let textOutput = null;

  for (const modelName of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4500),
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          throw new Error(`QUOTA_EXCEEDED: Gemini quota reached (${errText.slice(0, 150)})`);
        }
        throw new Error(`Gemini API error (${response.status} on ${modelName}): ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textOutput) break;
    } catch (err) {
      lastErr = err;
      if (err.message && err.message.startsWith('QUOTA_EXCEEDED:')) {
        // Entire API key is rate-limited; skip other models
        break;
      }
      console.warn(`[Gemini] Model ${modelName} failed: ${err.message}, trying next candidate...`);
    }
  }

  if (!textOutput) {
    throw lastErr || new Error('Empty response from Gemini.');
  }

  const parsed = JSON.parse(textOutput);
  const rawClips = Array.isArray(parsed.clips) ? parsed.clips : (Array.isArray(parsed) ? parsed : []);

  // Validate and ground candidates
  return rawClips.map((c, i) => {
    let start = Math.max(transcriptChunk.start, Number(c.start) || 0);
    let end = Math.min(transcriptChunk.end, Number(c.end) || start + 30);
    if (end - start < 20 && duration >= 20) {
      end = Math.min(duration, start + 25);
    }
    const dynamics = getAudioDynamics(audioEnergy, start, end);
    const score = Math.min(100, Math.max(1, Number(c.score) || 75));
    const words = (c.hook || c.title || '').toLowerCase().split(/\s+/).filter(Boolean);
    const { viralBadge, category, contentType, recommendedFraming } = classifyMoment(score, words, dynamics.energyScore, options.templateId, options.energyBias);

    const hookScore = Math.min(99, Math.max(30, Number(c.hook_score) || Math.min(99, score + 2)));
    const flowScore = Math.min(99, Math.max(30, Number(c.flow_score) || score));
    const energyScore = Math.min(99, Math.max(30, Number(c.energy_score) || dynamics.energyScore));
    const payoffScore = Math.min(99, Math.max(30, Number(c.payoff_score) || Math.max(50, score - 2)));

    // Clean title
    let title = (c.title || '').trim();
    if (!title || title.split(/\s+/).length < 2) {
      title = synthesizeViralTitle(c.hook || title);
    }

    return {
      id: crypto.randomUUID(),
      start: Math.round(start),
      end: Math.round(end),
      score,
      hookScore,
      flowScore,
      energyScore,
      payoffScore,
      breakdown: {
        hook: hookScore,
        flow: flowScore,
        energy: energyScore,
        payoff: payoffScore,
        surge: `${dynamics.surgeRatio}x`
      },
      viralBadge,
      category,
      contentType: contentType || 'general',
      recommendedFraming: recommendedFraming || 'smart',
      title,
      hook: c.hook || '',
      reason: c.reason || `${hookScore}/100 hook • ${flowScore}/100 flow • ${category}`,
      captionKeywords: Array.isArray(c.caption_keywords) ? c.caption_keywords : [],
      contextWarning: c.context_warning || ''
    };
  });
}

// Helper to format seconds as H:MM:SS or M:SS
function formatTimeHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${m}:${String(rem).padStart(2, '0')}`;
}

// Multi-Part Stream Splitter: Split long videos/streams into 2 or 3 chronological parts
function splitStreamIntoParts(transcript, duration, options = {}, audioEnergy = transcript?.audio_energy || [], feedback = null) {
  const partsCount = Math.floor(clamp(finite(options.partsCount, duration >= 7200 ? 3 : 2), 2, 6));
  const totalClips = Math.floor(clamp(finite(options.clipCount ?? options.totalClips, 75), 0, 200));
  const partDuration = duration / partsCount;

  const parts = [];
  const allClips = [];

  for (let p = 0; p < partsCount; p++) {
    const pStart = Math.floor(p * partDuration);
    const pEnd = (p === partsCount - 1) ? Math.floor(duration) : Math.floor((p + 1) * partDuration);
    const timeRangeStr = `${formatTimeHMS(pStart)} - ${formatTimeHMS(pEnd)}`;
    const partTitle = `Part ${p + 1} (${timeRangeStr})`;

    // Filter segments in this part's window
    const partSegments = (Array.isArray(transcript?.segments) ? transcript.segments : []).filter(s => s && s.start >= pStart && s.end <= pEnd);
    const subTranscript = {
      ...transcript,
      segments: partSegments
    };

    // Find top moments for this part
    const partClips = heuristicFindMoments(subTranscript, pEnd, {
      ...options,
      windowStart: Math.max(pStart, finite(options.windowStart, pStart)),
      windowEnd: Math.min(pEnd, finite(options.windowEnd, pEnd)),
      clipCount: Math.floor(totalClips / partsCount) + (p < totalClips % partsCount ? 1 : 0),
      minDuration: Math.max(20, finite(options.minDuration, 20)),
      maxDuration: finite(options.maxDuration, 65),
      minScore: finite(options.minScore, 65)
    }, audioEnergy, feedback);

    // Tag each clip with part metadata
    partClips.forEach((c, idx) => {
      c.part = p + 1;
      c.partIndex = p + 1;
      c.partTitle = `Part ${p + 1}`;
      c.partTimeRange = timeRangeStr;
      c.partClipIndex = idx + 1;
      if (!c.title.startsWith(`[Part ${p + 1}]`)) {
        c.title = `[Part ${p + 1}] ${c.title}`;
      }
    });

    parts.push({
      partIndex: p + 1,
      title: partTitle,
      timeRange: timeRangeStr,
      start: pStart,
      end: pEnd,
      duration: pEnd - pStart,
      clipsCount: partClips.length
    });

    allClips.push(...partClips);
  }

  const trimmedClips = allClips.slice(0, totalClips);
  trimmedClips.parts = parts;

  return {
    parts,
    clips: trimmedClips
  };
}

// Main Best-Moments Detection Pipeline
async function findBestMoments(transcript, duration, options = {}) {
  const feedback = await getFeedback();
  // Local is the default even when a key is saved. Cloud is an explicit opt-in.
  let apiKey = null;
  if (options.analysisMode === 'gemini') {
    const settings = await getSettings();
    apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
  }
  const audioEnergy = transcript?.audio_energy || [];

  // Multi-part stream splitting for long streams or explicit user setting
  const shouldSplit = Boolean(
    options.splitParts ||
    options.partsCount ||
    (duration >= 3600 && Number(options.clipCount || 0) >= 15)
  );

  if (shouldSplit && transcript?.segments?.length > 0) {
    const result = splitStreamIntoParts(transcript, duration, options, audioEnergy, feedback);
    return result.clips;
  }

  if (!apiKey) return heuristicFindMoments(transcript, duration, options, audioEnergy, feedback);

  // Chunk transcript if multi-hour
  const chunks = chunkTranscript(transcript, duration);
  const allCandidates = [];

  if (apiKey) {
    try {
      for (const chunk of chunks) {
        if (!chunk.segments || chunk.segments.length === 0) continue;
        const chunkMoments = await geminiFindMoments(chunk, duration, options, apiKey, audioEnergy, feedback);
        allCandidates.push(...chunkMoments);
      }
    } catch (err) {
      console.warn('Gemini moment selection encountered error, falling back to local heuristic:', err.message);
      // Fallback if API fails or quota exceeded
      const fallbackMoments = heuristicFindMoments(transcript, duration, options, audioEnergy, feedback);
      allCandidates.push(...fallbackMoments);
    }
  } else {
    // Built-in intelligent heuristic engine
    const moments = heuristicFindMoments(transcript, duration, options, audioEnergy, feedback);
    allCandidates.push(...moments);
  }

  // Deduplicate and suppress overlapping clips
  allCandidates.sort((a, b) => b.score - a.score);
  const finalCandidates = [];
  const targetCount = Number(options.clipCount || 5);

  for (const c of allCandidates) {
    const overlaps = finalCandidates.some(f => Math.max(c.start, f.start) < Math.min(c.end, f.end) - 5);
    if (!overlaps) {
      finalCandidates.push(c);
      if (finalCandidates.length >= targetCount) break;
    }
  }

  return finalCandidates.sort((a, b) => a.start - b.start);
}

module.exports = {
  findBestMoments,
  chunkTranscript,
  heuristicFindMoments,
  splitStreamIntoParts,
  formatTimeHMS
};
