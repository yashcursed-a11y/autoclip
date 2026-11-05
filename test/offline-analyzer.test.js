// Isolate settings/feedback and prevent any accidental cloud usage in these tests.
const path = require('node:path');
process.env.AUTOCLIP_DATA_DIR = path.join(__dirname, '..', 'work', 'offline-analyzer-test-data');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { heuristicFindMoments: find, findBestMoments, splitStreamIntoParts } = require('../lib/analyzer');

const story = (offset = 0) => ({ segments: [
  { start: offset + 0.125, end: offset + 7.125, text: 'Why did this one mistake cost our team the entire match?' },
  { start: offset + 7.125, end: offset + 15.125, text: 'We had only one chance left, so I tried a different strategy instead of attacking.' },
  { start: offset + 15.125, end: offset + 21.125, text: 'Wait until I show you what happened next.' },
  { start: offset + 21.125, end: offset + 30.125, text: 'Finally we won the match because the opponent chased the wrong player. That is why the strategy worked.' }
] });
const options = { minScore: 0, clipCount: 3, maxDuration: 40 };

test('searches past an unresolved first ending and preserves exact source boundaries', () => {
  const clips = find(story(), 40, options);
  assert.ok(clips.length);
  assert.equal(clips[0].start, 0.125);
  assert.equal(clips[0].end, 30.125);
  assert.ok(clips[0].payoffScore >= 70);
  assert.ok(clips[0].reason.includes('resolution cue'));
  assert.equal(clips[0].source, 'local');
  assert.equal(clips[0].evidence.visualAnalysis, false);
});

test('does not fill quotas or rate silence and constant music as highlights', () => {
  for (const audio_energy of [[], Array(120).fill(0), Array(120).fill(0.8)]) {
    assert.deepEqual(find({ segments: [], audio_energy }, 120, options), []);
  }
  assert.deepEqual(find(story(), 40, { ...options, minScore: 100 }), []);
});

test('audio-only suggestions require a peak and carry low-confidence review warnings', () => {
  const audio_energy = Array(120).fill(0.02);
  audio_energy[60] = 0.8;
  const clips = find({ audio_energy }, 120, { ...options, minScore: 40 });
  assert.equal(clips.length, 1);
  assert.ok(clips[0].start <= 60 && clips[0].end > 60);
  assert.ok(clips[0].score <= 60);
  assert.equal(clips[0].hookScore, 0);
  assert.equal(clips[0].confidence, 'low');
  assert.deepEqual(find({ audio_energy }, 120, { ...options, minScore: 65 }), []);
});

test('missing audio does not create an invented audio rating', () => {
  const [clip] = find(story(), 40, options);
  assert.equal(clip.energyScore, 0);
  assert.equal(clip.breakdown.audioAvailable, false);
  assert.equal(clip.breakdown.surge, null);
  assert.ok(clip.contextWarning.includes('unavailable'));
});

test('filters dead air and penalizes promotions compared with the same spoken arc', () => {
  const normal = find(story(), 40, options)[0];
  const promo = story();
  promo.segments[1].text += ' Use my discount code and link in the description.';
  assert.ok(find(promo, 40, options)[0].score < normal.score);
  const gaps = story();
  gaps.segments[1].start += 5;
  assert.deepEqual(find(gaps, 40, { ...options, maxDuration: 40 }), []);
});

test('respects exact maximum duration, absolute windows and zero count', () => {
  assert.deepEqual(find(story(), 40, { ...options, clipCount: 0 }), []);
  assert.deepEqual(find(story(), 19, options), []);
  assert.deepEqual(find(story(), 40, { ...options, windowStart: 35, windowEnd: 10 }), []);
  const clips = find(story(100), 150, { ...options, windowStart: 100, windowEnd: 131, maxDuration: 30 });
  for (const clip of clips) {
    assert.ok(clip.start >= 100 && clip.end <= 131);
    assert.ok(clip.end - clip.start >= 20 && clip.end - clip.start <= 30);
  }
});

test('handles unsorted, malformed and duplicate transcript rows', () => {
  const input = story();
  input.segments.reverse();
  input.segments.push(null, {}, { start: -4, end: 8, text: 'bad' }, { start: 4, end: 3, text: 'bad' }, input.segments[0]);
  const result = find(input, 40, options);
  assert.deepEqual(result.map(c => [c.start, c.end, c.score]), find(story(), 40, options).map(c => [c.start, c.end, c.score]));
});

test('repeated passages at separate times do not crowd the output', () => {
  const input = { segments: [...story().segments, ...story(60).segments] };
  assert.equal(find(input, 100, options).length, 1);
});

test('feedback affects ranking modestly without overriding the threshold', () => {
  const [baseline] = find(story(), 40, options);
  const entry = { clip: { hook: baseline.hook, captionKeywords: baseline.captionKeywords } };
  const feedback = { accepted: [entry, entry, entry], rejected: [] };
  const [personalized] = find(story(), 40, options, [], feedback);
  assert.ok(personalized.score > baseline.score && personalized.score <= baseline.score + 5);
  assert.deepEqual(find(story(), 40, { ...options, minScore: 100 }, [], feedback), []);
});

test('local is the default even with a configured cloud key', async () => {
  const oldFetch = global.fetch, oldKey = process.env.GEMINI_API_KEY;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Cloud must not be used'); };
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const clips = await findBestMoments(story(), 40, options);
    assert.ok(clips.length);
    assert.equal(calls, 0);
    assert.ok(clips.every(c => c.source === 'local'));
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  }
});

test('split parts retain audio and strict score threshold', () => {
  const input = { segments: [...story().segments, ...story(60).segments], audio_energy: Array(100).fill(0.02) };
  const result = splitStreamIntoParts(input, 100, { ...options, partsCount: 2, minScore: 100 });
  assert.equal(result.parts.length, 2);
  assert.equal(result.clips.length, 0);
});

test('grounded titles do not invent money, police incidents or outcomes', () => {
  const input = story();
  input.segments[0].text = 'Why is saving money a mistake when our team needs better equipment?';
  const [clip] = find(input, 40, options);
  assert.ok(clip);
  assert.ok(!/\$100|ARRESTED|GONE WRONG/i.test(clip.title));
  assert.ok(input.segments[0].text.startsWith(clip.title.replace(/…$/, '')));
});

test('empty opening fragments cannot borrow a hook from later dialogue', () => {
  const input = story();
  input.segments.unshift({ start: 0, end: 0.1, text: 'Why?' });
  const clips = find(input, 40, options);
  assert.ok(clips.length);
  assert.ok(clips.every(c => c.start !== 0));
});

test('complete word timings allow sentence-level starts inside an ASR segment', () => {
  const input = story();
  input.segments[0].start = 0;
  input.segments[0].text = 'Okay. ' + input.segments[0].text;
  const pieces = input.segments[0].text.split(' ');
  input.segments[0].words = pieces.map((word, index) => ({ word, start: index * 0.5, end: index * 0.5 + 0.4 }));
  const clips = find(input, 40, options);
  assert.ok(clips.length);
  assert.equal(clips[0].start, 0.5);
  assert.ok(clips[0].title.startsWith('Why'));
});

test('incomplete word timings never fabricate new sentence timestamps', () => {
  const input = story();
  input.segments[0].words = [{ word: 'Why', start: 0.125, end: 0.4 }];
  const [clip] = find(input, 40, options);
  assert.equal(clip.start, 0.125);
  assert.equal(clip.evidence.speechTiming, 'segment');
});

test('partial audio cannot misrepresent an entire clip measurement', () => {
  const [clip] = find(story(), 40, options, [0.1, 0.9]);
  assert.equal(clip.breakdown.audioAvailable, false);
});

test('multipart discovery respects zero count and passes audio measurements', () => {
  const input = { ...story(), audio_energy: Array(100).fill(0.1) };
  assert.equal(splitStreamIntoParts(input, 100, { ...options, clipCount: 0 }).clips.length, 0);
  const result = splitStreamIntoParts(input, 100, { ...options, clipCount: 2 });
  assert.ok(result.clips.length);
  assert.ok(result.clips[0].breakdown.audioAvailable);
});

test('multipart discovery honors absolute analysis windows and maximum duration', () => {
  const input = { segments: [...story().segments, ...story(60).segments] };
  const result = splitStreamIntoParts(input, 100, { ...options, clipCount: 4, windowStart: 60, windowEnd: 95, maxDuration: 25 });
  assert.ok(result.clips.length);
  assert.ok(result.clips.every(c => c.start >= 60 && c.end <= 95 && c.end - c.start <= 25));
});

test('topic-switch bait cannot borrow an unrelated payoff', () => {
  const original = find(story(), 40, options)[0];
  const changed = story();
  changed.segments[3].text = 'Moving on, the bakery finally finished the wedding cake because the oven worked.';
  const [clip] = find(changed, 40, options);
  assert.ok(clip.score < original.score);
  assert.ok(clip.evidence.discourse.topicChanges > 0);
  assert.ok(clip.contextWarning.includes('Topic change'));
});

test('linked explanations receive question-answer evidence', () => {
  const [clip] = find(story(), 40, options);
  assert.equal(clip.evidence.discourse.answered, true);
  assert.equal(clip.evidence.discourse.arc.resolution, true);
});

test('custom brief rewards relevant evidence with a bounded bonus', () => {
  const baseline = find(story(), 40, options)[0];
  const relevant = find(story(), 40, { ...options, customBrief: 'team strategy opponent match' })[0];
  const unrelated = find(story(), 40, { ...options, customBrief: 'baking wedding cakes' })[0];
  assert.ok(relevant.score > baseline.score && relevant.score <= baseline.score + 6);
  assert.equal(unrelated.score, baseline.score);
  assert.ok(relevant.breakdown.briefRelevance.matched.includes('strategy'));
});

test('low ASR reliability reduces rating and cannot pass the default threshold', () => {
  const low = story();
  low.segments.forEach(s => { s.avg_logprob = -2; s.no_speech_prob = 0.9; });
  const [clip] = find(low, 40, options);
  assert.ok(clip.score <= 64);
  assert.ok(clip.evidence.recognition.reliability < 0.45);
  assert.ok(clip.contextWarning.includes('reliability'));
  assert.deepEqual(find(low, 40, { ...options, minScore: 65 }), []);
});

test('unknown ASR confidence is not invented or penalized', () => {
  const [clip] = find(story(), 40, options);
  assert.equal(clip.evidence.recognition.reliability, null);
  assert.equal(clip.evidence.recognition.penalty, 0);
});

test('word probabilities are used when complete timings are available', () => {
  const low = story();
  low.segments.forEach(s => {
    const words = s.text.split(' '), step = (s.end - s.start) / words.length;
    s.words = words.map((word, i) => ({ word, start: s.start + i * step, end: s.start + (i + 0.8) * step, probability: 0.2 }));
  });
  const [clip] = find(low, 40, options);
  assert.ok(clip);
  assert.equal(clip.evidence.recognition.reliability, 0.2);
  assert.ok(clip.score <= 64);
});

test('similar vocabulary with different word order is not an exact duplicate', () => {
  const input = { segments: [
    { start: 0, end: 25, text: 'Why did Alice defeat Bob? Alice finally won because Bob failed the challenge.' },
    { start: 60, end: 85, text: 'Why did Bob defeat Alice? Bob finally won because Alice failed the challenge.' }
  ] };
  assert.equal(find(input, 100, { ...options, clipCount: 2 }).length, 2);
});
