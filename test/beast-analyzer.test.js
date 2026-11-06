const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreBrockHook,
  scoreBeastClip,
  findBeastMoments,
  BEAST_TIERS,
  BROCK_HOOK_ARCHETYPES,
  BROCK_NEGATIVE_TRIGGERS
} = require('../lib/beast-analyzer');

test('Beast Analyzer: exports Beast tiers and Brock hook archetypes', () => {
  assert.ok(BEAST_TIERS.ULTRA_BEAST);
  assert.ok(BEAST_TIERS.BEAST_JUICER);
  assert.ok(BEAST_TIERS.HIGH_ENERGY);
  assert.ok(BROCK_HOOK_ARCHETYPES.CONTRARIAN);
  assert.ok(BROCK_HOOK_ARCHETYPES.OUTCOME_BASED);
  assert.ok(BROCK_HOOK_ARCHETYPES.IDENTITY);
  assert.ok(BROCK_NEGATIVE_TRIGGERS.includes('stop'));
  assert.ok(BROCK_NEGATIVE_TRIGGERS.includes('mistake'));
});

test('Brock Hook: scores higher with Negative Loss-Aversion framing over positive advice', () => {
  const negativeHook = scoreBrockHook("Stop making this bench press mistake right now");
  const positiveHook = scoreBrockHook("Here are some ways to improve your bench press");

  assert.equal(negativeHook.negativeFraming, true);
  assert.equal(negativeHook.lossAversionMultiplier, '2.3x');
  assert.ok(negativeHook.score > positiveHook.score, `Negative (${negativeHook.score}) should beat Positive (${positiveHook.score})`);
});

test('Brock Hook: recognizes 5-8 word sweet spot length', () => {
  const sweetSpotHook = scoreBrockHook("Never eat these three foods before bed");
  const bloatedHook = scoreBrockHook("In today's video I really want to talk about twenty different ways that you can potentially start optimizing your diet");

  assert.equal(sweetSpotHook.inSweetSpot, true);
  assert.equal(sweetSpotHook.wordCount, 7);
  assert.equal(bloatedHook.inSweetSpot, false);
  assert.equal(bloatedHook.fluffPenalty, true);
  assert.ok(sweetSpotHook.score > bloatedHook.score + 20, 'Sweet spot with no fluff must outscore bloated intro');
});

test('Brock Hook: classifies Contrarian and Outcome-First archetypes correctly', () => {
  const contrarian = scoreBrockHook("Stop doing cardio if you want to lose belly fat");
  const outcomeFirst = scoreBrockHook("How I made $10,000 in four days without ads");

  assert.match(contrarian.archetype, /Contrarian/i);
  assert.match(outcomeFirst.archetype, /Outcome/i);
});

test('Beast Analyzer: scores high on crazy plot twist, shout energy, and polarizing debate', () => {
  const text = "Stop doing this pushup mistake right now! A fan came up smiling but actually said you are a big piece of garbage. Everyone started to argue and disagree because the debate got so polarizing.";
  const result = scoreBeastClip(text, 25, [0.05, 0.1, 0.95, 0.2, 0.8]);
  
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.ok(result.brockHook.score >= 70, 'Expected high Brock hook score');
  assert.ok(result.audioScore.score >= 15, 'Expected high audio score');
  assert.ok(result.twistScore.score >= 15, 'Expected high twist score');
  assert.ok(result.arousalScore.score >= 15, 'Expected high arousal score');
  assert.match(result.tier, /BEAST/i);
  assert.equal(result.recommendedPreset.captionStyle, 'Lemon Milk Bold (Deagzzz/Speed)');
});

test('Beast Analyzer: findBeastMoments returns candidate clips with beast scorecard and Brock hook', async () => {
  const mockTranscript = [
    { start: 0, end: 5, text: "Stop doing this pushup mistake if you want real gains." },
    { start: 5, end: 15, text: "Why did he suddenly yell let's go holy shit and do an insane move?" },
    { start: 15, end: 25, text: "Then it turns out the entire chat was disagreeing about whether it was fake or real." },
    { start: 25, end: 35, text: "Did you know this trick actually doubled his views on YouTube Shorts?" }
  ];

  const clips = await findBeastMoments(mockTranscript, 40, { clipCount: 2, minDuration: 20 });
  assert.ok(Array.isArray(clips));
  assert.ok(clips.length > 0);
  assert.ok(clips[0].beast, 'Clip must have beast scorecard');
  assert.ok(clips[0].beast.brockHook, 'Clip must contain brockHook data');
  assert.ok(clips[0].beast.score >= 70, 'Score should be high');
  assert.match(clips[0].viralBadge, /BEAST|CANDIDATE|ENERGY/i);
});
