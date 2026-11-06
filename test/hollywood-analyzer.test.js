const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreHollywoodHook, findHollywoodMoments, HOLLYWOOD_PILLARS } = require('../lib/hollywood-analyzer');

test('Hollywood Analyzer: exports 4 pillars definition', () => {
  assert.equal(HOLLYWOOD_PILLARS.length, 4);
  assert.equal(HOLLYWOOD_PILLARS[0].name, 'Zero Delay (Speed to Value)');
  assert.equal(HOLLYWOOD_PILLARS[1].name, 'Zero Confusion (6th-Grade Clarity)');
  assert.equal(HOLLYWOOD_PILLARS[2].name, 'Audience Relevance (You/Your Framing)');
  assert.equal(HOLLYWOOD_PILLARS[3].name, 'Curiosity Tension Loop (Contrarian Contrast)');
});

test('Hollywood Analyzer: scores high on punchy contrarian hook with you-framing and zero delay', () => {
  const hook = "If you're still doing cardio to burn fat, you've been lied to. Here's why strength training burns 3x more calories.";
  const result = scoreHollywoodHook(hook, "Fat Loss Secrets");
  
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.ok(result.speedToValue.score >= 20, 'Expected high speed to value');
  assert.ok(result.clarity.score >= 20, 'Expected high clarity');
  assert.ok(result.relevance.score >= 20, 'Expected high relevance');
  assert.ok(result.contrast.score >= 20, 'Expected high contrast');
  assert.match(result.grade, /Hollywood/i);
});

test('Hollywood Analyzer: penalizes fluff intro like "in this video" or "welcome back guys"', () => {
  const fluffHook = "Hey guys welcome back to the channel, in this video today I wanted to talk about my journey with productivity.";
  const result = scoreHollywoodHook(fluffHook, "My Journey");

  assert.ok(result.speedToValue.fluffPenalty > 0, 'Should detect fluff penalty');
  assert.ok(result.score < 75, `Expected score < 75 for fluff intro, got ${result.score}`);
  assert.ok(result.improvementTip.length > 0, 'Should have improvement tip');
});

test('Hollywood Analyzer: findHollywoodMoments returns sorted clips with hollywood scorecard', async () => {
  const mockTranscript = [
    { start: 0, end: 5, text: "Hey guys welcome back to another video subscribe below." },
    { start: 6, end: 15, text: "If you think waking up at 5am makes you successful, you are completely wrong." },
    { start: 16, end: 28, text: "Here is the exact sleep schedule that doubled my energy without an alarm clock." },
    { start: 29, end: 40, text: "Most creators burn out because they follow the standard advice instead of their biological chronotype." },
    { start: 41, end: 55, text: "Thanks for watching make sure to like and follow for more tips." }
  ];

  const clips = await findHollywoodMoments(mockTranscript, 60, { clipCount: 2, minDuration: 20 });
  assert.ok(Array.isArray(clips), 'Should return an array');
  assert.ok(clips.length > 0, 'Should return at least 1 clip');
  assert.ok(clips[0].hollywood, 'Clip should have hollywood scorecard');
  assert.ok(clips[0].hollywood.score >= 50, 'Clip score should be reasonable');
  assert.ok(clips[0].hollywood.grade, 'Clip should have hollywood grade');
});
