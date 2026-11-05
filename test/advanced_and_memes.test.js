const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { getAllOverlays, detectClipMemes, MEME_CATALOG } = require('../lib/memes');
const { heuristicFindMoments } = require('../lib/analyzer');
const { renderClip, getVideoInfo } = require('../lib/renderer');
const { ROOT } = require('../lib/config');

async function runTests() {
  console.log('--- Testing Advanced Clip Discovery & B-Roll/Meme Overlays ---');

  // Test 1: Meme Catalog
  console.log('[Test 1] Testing Meme & Reaction Catalog...');
  const overlays = await getAllOverlays();
  assert(Array.isArray(overlays.builtIn), 'builtIn should be an array');
  assert.strictEqual(overlays.builtIn.length, 10, 'Expected 10 built-in memes');
  
  for (const m of overlays.builtIn) {
    assert(fs.existsSync(m.imagePath), `Meme image missing: ${m.imagePath}`);
    assert(fs.existsSync(m.soundPath), `Meme sound missing: ${m.soundPath}`);
  }
  console.log('✔ Test 1 Passed: All 10 built-in meme badges and SFX verified on disk.');

  // Test 2: Auto Meme Detection from Transcript
  console.log('[Test 2] Testing Auto-Detection of Memes from Transcript...');
  const mockTranscript = {
    segments: [
      { start: 1.0, end: 4.0, text: "Hey bro welcome back to the stream." },
      { start: 4.5, end: 8.5, text: "Wait what? That mind blown play was insane!" },
      { start: 9.0, end: 14.0, text: "We just made a million dollars profit stonks!" },
      { start: 14.5, end: 19.0, text: "Emotional damage to the other team!" },
      { start: 19.5, end: 24.0, text: "That was an absolute gigachad move." }
    ]
  };

  const detected = detectClipMemes(mockTranscript, 0, 25, 3);
  assert(detected.length >= 2, `Expected at least 2 detected memes, got ${detected.length}`);
  console.log(`  Detected ${detected.length} memes:`, detected.map(d => `${d.name} at ${d.startSec}s (trigger: "${d.triggerWord}")`));
  assert(detected.some(d => d.memeId === 'mind_blown'), 'Expected mind_blown to be detected');
  console.log('✔ Test 2 Passed: Automatic transcript meme trigger detection verified.');

  // Test 3: Advanced Moment Discovery (Strict Boundaries, Min Score, Niche Keywords)
  console.log('[Test 3] Testing Advanced Moment Discovery...');
  const advancedMockTranscript = {
    segments: [
      { start: 0.0, end: 5.0, text: "And so we were just talking about nothing special." }, // Starts with "And so"
      { start: 6.0, end: 12.0, text: "Why does nobody talk about this unbelievable secret formula?" },
      { start: 12.5, end: 18.0, text: "Because this exact method will win you every single match." },
      { start: 18.5, end: 25.0, text: "Wait until you see how this clutch strategy completely shock the opponent!" },
      { start: 25.5, end: 32.0, text: "Finally, that is the most genius play ever created." },
      { start: 33.0, end: 40.0, text: "and like I said, whatever." }
    ]
  };

  const moments = heuristicFindMoments(
    advancedMockTranscript,
    42,
    {
      minScore: 82,
      hookSensitivity: 'aggressive',
      energyBias: 'wisdom',
      strictBoundaries: true,
      filterDeadAir: true,
      nicheKeywords: ['clutch', 'secret']
    },
    [0.1, 0.2, 0.4, 0.5, 0.8, 0.9, 0.4]
  );

  assert(moments.length > 0, 'Expected at least 1 high scoring candidate');
  for (const m of moments) {
    assert(m.score >= 82, `Moment score ${m.score} below minScore 82`);
    assert(m.viralBadge, 'Moment missing viralBadge');
    assert(m.category, 'Moment missing category');
    assert(m.end - m.start >= 20, 'Moment duration must be >= 20s');
    console.log(`  Candidate: "${m.title}" | Score: ${m.score} | Badge: ${m.viralBadge} | Category: ${m.category} | ${m.start}s - ${m.end}s`);
  }
  console.log('✔ Test 3 Passed: Advanced moment detection, scoring threshold, and viral badging verified.');

  // Test 4: Video Rendering with Meme Overlay & Sound Effect Mixing
  console.log('[Test 4] Testing Render with Meme Overlay & Sound Effect Mixing...');
  const sampleVideo = path.join(ROOT, 'work', 'test', 'sample.mp4');
  assert(fs.existsSync(sampleVideo), 'sample.mp4 test file must exist');

  const testJob = {
    id: `test-memes-${Date.now()}`,
    sourcePath: sampleVideo,
    duration: 12,
    transcript: mockTranscript
  };

  const testClip = {
    id: 'test-clip-1',
    start: 0,
    end: 11,
    title: 'Test Meme Render'
  };

  const renderResult = await renderClip(
    testJob,
    testClip,
    0,
    {
      aspectRatio: '9:16',
      captionsEnabled: false,
      progressBar: true,
      hookStitcher: false,
      autoMemes: false,
      overlays: [
        {
          memeId: 'mind_blown',
          startSec: 2.0,
          duration: 2.0,
          position: 'center',
          scale: 0.55,
          soundEnabled: true
        }
      ]
    }
  );

  assert(fs.existsSync(renderResult.filePath), `Render output missing: ${renderResult.filePath}`);
  const renderedInfo = await getVideoInfo(renderResult.filePath);
  assert.strictEqual(renderedInfo.width, 1080, 'Rendered width should be 1080');
  assert.strictEqual(renderedInfo.height, 1920, 'Rendered height should be 1920');
  console.log(`  Rendered vertical 9:16 video with meme overlay at: ${renderResult.filePath}`);
  console.log('✔ Test 4 Passed: FFmpeg overlay compositing & audio sound mixing succeeded.');

  // Clean up test render folder
  try {
    fs.rmSync(path.dirname(renderResult.filePath), { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log(' ALL ADVANCED CLIP & B-ROLL/MEME TESTS PASSED! ');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
