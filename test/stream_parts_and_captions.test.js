const assert = require('node:assert');
const { splitStreamIntoParts, formatTimeHMS } = require('../lib/analyzer');
const { generateAssSubtitles } = require('../lib/caption');
const { CAPTION_PRESETS } = require('../lib/config');

console.log('--- Running Stream Parts & Subtitles Test Suite ---');

// Test 1: formatTimeHMS helper
console.log('[Test 1] Testing formatTimeHMS...');
assert.strictEqual(formatTimeHMS(0), '0:00');
assert.strictEqual(formatTimeHMS(6580), '1:49:40');
assert.strictEqual(formatTimeHMS(13160), '3:39:20');
assert.strictEqual(formatTimeHMS(19741), '5:29:01');
console.log('✔ Test 1 Passed: formatTimeHMS formatted timestamps accurately.');

// Test 2: Multi-Part Stream Splitter
console.log('[Test 2] Testing splitStreamIntoParts (3 parts, 75 clips)...');
// Mock a 5.5 hour transcript
const mockSegments = [];
const totalDuration = 19741; // ~5.5 hours
for (let sec = 10; sec < totalDuration; sec += 30) {
  mockSegments.push({
    start: sec,
    end: sec + 25,
    text: `This is high engagement stream dialogue at second ${sec} with viral punchline.`,
    words: [
      { word: 'This', start: sec, end: sec + 0.3 },
      { word: 'is', start: sec + 0.3, end: sec + 0.6 },
      { word: 'high', start: sec + 0.6, end: sec + 1.0 },
      { word: 'engagement', start: sec + 1.0, end: sec + 1.5 },
      { word: 'stream', start: sec + 1.5, end: sec + 2.0 },
      { word: 'dialogue', start: sec + 2.0, end: sec + 2.5 }
    ]
  });
}
const mockTranscript = { segments: mockSegments };

const splitResult = splitStreamIntoParts(mockTranscript, totalDuration, {
  partsCount: 3,
  totalClips: 75,
  minDuration: 20,
  maxDuration: 65,
  minScore: 50
});

assert.strictEqual(splitResult.parts.length, 3, 'Should have 3 parts');
assert.strictEqual(splitResult.parts[0].partIndex, 1);
assert.strictEqual(splitResult.parts[1].partIndex, 2);
assert.strictEqual(splitResult.parts[2].partIndex, 3);
assert(splitResult.clips.length > 0 && splitResult.clips.length <= 75, 'Return only measured candidates, up to the requested quota');

const part1Clips = splitResult.clips.filter(c => c.part === 1);
const part2Clips = splitResult.clips.filter(c => c.part === 2);
const part3Clips = splitResult.clips.filter(c => c.part === 3);

for (const [index, clips] of [part1Clips, part2Clips, part3Clips].entries()) {
  assert(clips.length > 0 && clips.length <= 25, 'Each part must respect its quota');
  assert.strictEqual(splitResult.parts[index].clipsCount, clips.length, 'Part metadata must match actual candidates');
  assert(clips.every(c => c.score >= 50 && c.source === 'local'), 'Clips must meet the requested threshold with source evidence');
}

// Check that clips in Part 1 are in Part 1 time window, Part 2 in Part 2, etc.
assert(part1Clips.every(c => c.start < splitResult.parts[0].end), 'Part 1 clips should start before Part 1 end');
assert(part2Clips.every(c => c.start >= splitResult.parts[0].end - 10 && c.start < splitResult.parts[1].end), 'Part 2 clips should be in Part 2 window');
assert(part3Clips.every(c => c.start >= splitResult.parts[1].end - 10), 'Part 3 clips should be in Part 3 window');
console.log(`✔ Test 2 Passed: 3 parts generated with ${splitResult.clips.length} measured candidates, without quota padding.`);

// Test 3: Caption Non-Overlapping Dialogue Verification
console.log('[Test 3] Testing Subtitle Generation - Proving ZERO Dialogue Overlaps...');
const sampleClip = { start: 100, end: 125, title: 'Sample Viral Clip' };
const sampleTranscript = {
  segments: [
    {
      start: 100,
      end: 110,
      text: 'Yall know what time it is hold on hold on',
      // Simulate raw overlapping words as emitted by YouTube auto-captions
      words: [
        { word: "Y'all", start: 100.0, end: 100.4 },
        { word: 'know', start: 100.12, end: 100.52 },
        { word: 'what', start: 100.20, end: 100.60 },
        { word: 'time', start: 100.44, end: 100.84 },
        { word: 'it', start: 100.52, end: 100.92 },
        { word: 'is', start: 100.68, end: 101.08 },
        { word: 'hold', start: 102.0, end: 102.4 },
        { word: 'on', start: 102.1, end: 102.5 }
      ]
    }
  ]
};

// Generate ASS with default Hormozi Viral Pop
const ass = generateAssSubtitles(sampleClip, sampleTranscript, { captionPreset: 'viral-pop' });
const dialogueLines = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
assert(dialogueLines.length > 0, 'Should produce dialogue lines');

// Parse timestamps and verify non-overlapping condition: end of previous <= start of next
function assTimeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseFloat(parts[2]);
  return (h * 3600) + (m * 60) + s;
}

let lastDialogueEnd = 0;
for (let i = 0; i < dialogueLines.length; i++) {
  const line = dialogueLines[i];
  const parts = line.split(',');
  const startSec = assTimeToSeconds(parts[1]);
  const endSec = assTimeToSeconds(parts[2]);

  assert(endSec > startSec, `Dialogue ${i} end (${endSec}) must be greater than start (${startSec})`);
  assert(startSec >= lastDialogueEnd - 0.01, `Dialogue ${i} start (${startSec}) must be >= previous end (${lastDialogueEnd}) - NO OVERLAPPING WORDS ALLOWED`);
  lastDialogueEnd = endSec;
}
console.log(`✔ Test 3 Passed: Verified ${dialogueLines.length} dialogue lines. Strictly ZERO overlapping lines (words are never on top of each other).`);

// Test 4: Verify All Caption Presets Load Cleanly
console.log('[Test 4] Testing Caption Presets...');
assert(CAPTION_PRESETS.some(p => p.id === 'viral-pop'), 'viral-pop preset must exist');
assert(CAPTION_PRESETS.some(p => p.id === 'hormozi-punch'), 'hormozi-punch preset must exist');
assert(CAPTION_PRESETS.some(p => p.id === 'beast-electric'), 'beast-electric preset must exist');
console.log('✔ Test 4 Passed: All upgraded presets (Viral Pop, Hormozi, Beast Electric) configured.');

console.log('\n======================================================');
console.log(' ALL STREAM PARTS & CAPTION TESTS PASSED SUCCESSFULLY! ');
console.log('======================================================\n');
