const test = require('node:test');
const assert = require('node:assert/strict');
const { heuristicFindMoments } = require('../lib/analyzer');

test('Serviuos Juicer: detects unexpected plot twist and awards crazy turn badge', () => {
  const input = {
    segments: [
      { start: 0, end: 6, text: "A fan came up to me on the street smiling and said I am your biggest fan." },
      { start: 6, end: 14, text: "Then he leaned in close and said actually you are a big piece of garbage." },
      { start: 14, end: 24, text: "I was completely speechless and that is why I never trust public appearances anymore." }
    ]
  };
  const clips = heuristicFindMoments(input, 30, { minScore: 0, clipCount: 1, maxDuration: 40 });
  assert.ok(clips.length > 0, 'Should return a clip');
  assert.ok(clips[0].juicer.hasTurn, 'Should detect crazy turn');
  assert.match(clips[0].viralBadge, /Crazy Plot Twist|1,000,000\+/i);
});

test('Serviuos Juicer: detects polarizing debate and awards high-arousal badge', () => {
  const input = {
    segments: [
      { start: 0, end: 8, text: "The interviewer asked Tony Robbins how he deals with someone who claims to be ninety-nine percent masculine." },
      { start: 8, end: 18, text: "Tony Robbins smiled and said I am glad the feminine is still alive in you." },
      { start: 18, end: 28, text: "The entire room started to argue and disagree because the debate got so polarizing." }
    ]
  };
  const clips = heuristicFindMoments(input, 30, { minScore: 0, clipCount: 1, maxDuration: 40 });
  assert.ok(clips.length > 0, 'Should return a clip');
  assert.ok(clips[0].juicer.hasPolarization, 'Should detect polarizing debate');
  assert.match(clips[0].viralBadge, /High-Arousal Debate|1,000,000\+/i);
});

test('Serviuos Juicer: detects savable helpful information and awards viral saves badge', () => {
  const input = {
    segments: [
      { start: 0, end: 7, text: "Did you know there is a secret trick to how to avoid shadow bans on social media?" },
      { start: 7, end: 15, text: "The real reason your videos get zero views is because of metadata flags." },
      { start: 15, end: 25, text: "Follow this rule of three steps and your views will instantly recover." }
    ]
  };
  const clips = heuristicFindMoments(input, 30, { minScore: 0, clipCount: 1, maxDuration: 40 });
  assert.ok(clips.length > 0, 'Should return a clip');
  assert.ok(clips[0].juicer.hasSavableValue, 'Should detect savable life hack');
  assert.match(clips[0].viralBadge, /High-Value Hack|Algorithm Saves/i);
});
