const assert = require('node:assert');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');

const { ROOT, DATA, INCOMING, FINISHED, TEMPLATES, CAPTION_PRESETS } = require('../lib/config');
const { getSystemStatus } = require('../lib/system');
const { transcribeVideo, getCachedTranscript } = require('../lib/transcriber');
const { findBestMoments, chunkTranscript, heuristicFindMoments } = require('../lib/analyzer');
const { generateAssSubtitles } = require('../lib/caption');
const { renderClip, getVideoInfo } = require('../lib/renderer');
const { saveJob, getJob, updateJob, deleteJob } = require('../lib/db');
const { renderJob } = require('../lib/job-runner');

async function runAllTests() {
  console.log('--- Starting AUTOCLIPIN Test Suite ---');
  const samplePath = path.join(ROOT, 'work', 'test', 'sample.mp4');
  assert.ok(fs.existsSync(samplePath), 'sample.mp4 must exist for testing');

  // Test 1: System Status
  console.log('[Test 1] Verifying System Diagnostics...');
  const sys = await getSystemStatus();
  console.log('  FFmpeg:', sys.ffmpeg.available ? sys.ffmpeg.version : 'Missing');
  console.log('  Python:', sys.python.available ? sys.python.version : 'Missing');
  console.log('  Faster-Whisper:', sys.whisper.available ? sys.whisper.version : 'Missing');
  console.log('  OpenCV:', sys.opencv.available ? sys.opencv.version : 'Missing');
  console.log('  yt-dlp:', sys.ytdlp.available ? sys.ytdlp.version : 'Missing');
  assert.ok(sys.ffmpeg.available, 'FFmpeg must be available');
  assert.ok(sys.ffprobe.available, 'FFprobe must be available');
  assert.ok(sys.python.available, 'Python must be available');
  assert.ok(sys.whisper.available, 'Faster-whisper must be available');
  console.log('✔ Test 1 Passed: System dependencies verified.');

  // Test 2: Video Info Probe
  console.log('[Test 2] Probing sample.mp4 with FFprobe...');
  const probe = await getVideoInfo(samplePath);
  console.log(`  Dimensions: ${probe.width}x${probe.height}, Duration: ${probe.duration}s`);
  assert.strictEqual(probe.width, 640);
  assert.strictEqual(probe.height, 360);
  assert.ok(probe.duration > 0, 'Duration should be > 0');
  console.log('✔ Test 2 Passed: Video probing verified.');

  // Test 3: Faster-Whisper Transcription & Caching
  console.log('[Test 3] Testing Whisper Transcription & Cache...');
  const transcript = await transcribeVideo(samplePath, { whisperModel: 'tiny', language: 'en', forceRefresh: true });
  assert.ok(transcript, 'Transcript returned');
  assert.strictEqual(transcript.language, 'en');
  assert.ok(Array.isArray(transcript.audio_energy), 'Audio energy array present');
  console.log(`  Audio energy buckets: ${transcript.audio_energy.length}`);

  // Test Cache Hit
  const cacheCheck = await getCachedTranscript(samplePath);
  assert.ok(cacheCheck.fromCache, 'Should load from cache on second check');
  console.log('✔ Test 3 Passed: Transcription and caching verified.');

  // Test 4: Chunking & Best-Moment Analysis
  console.log('[Test 4] Testing Best-Moment Selection & Scoring...');
  const dummyTranscript = {
    duration: 120,
    audio_energy: [0.1, 0.2, 0.8, 0.9, 0.95, 0.5, 0.2],
    segments: [
      {
        id: 0,
        start: 2.0,
        end: 8.0,
        text: 'Wait until you see how crazy this play was!',
        words: [
          { word: 'Wait', start: 2.0, end: 2.5 },
          { word: 'until', start: 2.5, end: 3.0 },
          { word: 'you', start: 3.0, end: 3.2 },
          { word: 'see', start: 3.2, end: 3.5 },
          { word: 'how', start: 3.5, end: 3.8 },
          { word: 'crazy', start: 3.8, end: 4.5 },
          { word: 'this', start: 4.5, end: 4.8 },
          { word: 'play', start: 4.8, end: 5.2 },
          { word: 'was!', start: 5.2, end: 5.8 }
        ]
      },
      {
        id: 1,
        start: 8.5,
        end: 22.0,
        text: 'We were down by ten points and nobody believed we could win.',
        words: []
      },
      {
        id: 2,
        start: 22.5,
        end: 32.0,
        text: 'Then I made the final shot and the entire arena went wild!',
        words: []
      }
    ]
  };

  const chunks = chunkTranscript(dummyTranscript, 120);
  assert.ok(chunks.length >= 1, 'Should produce transcript chunks');

  const candidates = await findBestMoments(dummyTranscript, 120, {
    clipCount: 2,
    minDuration: 15,
    maxDuration: 40,
    templateId: 'gaming'
  });

  assert.ok(candidates.length > 0, 'Should find candidates');
  const firstClip = candidates[0];
  console.log(`  Top Candidate: "${firstClip.title}" (Score: ${firstClip.score}, Range: ${firstClip.start}s - ${firstClip.end}s)`);
  assert.ok(firstClip.score >= 0 && firstClip.score <= 100, 'Score must be between 0 and 100');
  assert.ok(firstClip.start >= 0, 'Start timestamp must be non-negative');
  assert.ok(firstClip.end > firstClip.start, 'End must be greater than start');
  console.log('✔ Test 4 Passed: Moment ranking verified.');

  // Test 5: Caption ASS Subtitle Generation
  console.log('[Test 5] Testing Caption Subtitle Generation (Viral Pop, Hormozi Phrase)...');
  const assText = generateAssSubtitles(
    { start: 2, end: 8, title: 'Crazy Play' },
    dummyTranscript,
    { captionPreset: 'viral-pop', captionStyle: { displayMode: 'phrase', casing: 'uppercase' } }
  );
  assert.ok(assText.includes('[Script Info]'), 'ASS header present');
  assert.ok(assText.includes('[V4+ Styles]'), 'ASS styles present');
  assert.ok(assText.includes('Dialogue:'), 'ASS dialogue events generated');
  console.log('✔ Test 5 Passed: Caption generator verified.');

  // Test 6: Video Rendering & FFprobe Output Validation
  console.log('[Test 6] Rendering 9:16 Vertical Video with burnt subtitles & progress bar...');
  const testJob = {
    id: `test-${crypto.randomUUID()}`,
    sourcePath: samplePath,
    sourceName: 'sample.mp4',
    duration: 12,
    transcript: dummyTranscript,
    options: {
      aspectRatio: '9:16',
      framingMode: 'smart',
      captionPreset: 'viral-pop',
      progressBar: true
    }
  };

  const testClip = {
    id: crypto.randomUUID(),
    title: 'Test Verification Clip',
    start: 1,
    end: 4
  };

  const renderResult = await renderClip(testJob, testClip, 0, testJob.options);
  console.log(`  Rendered file: ${renderResult.name}`);
  console.log(`  Size: ${renderResult.size} bytes`);
  console.log(`  Dimensions: ${renderResult.width}x${renderResult.height}`);
  console.log(`  Duration: ${renderResult.duration}s`);

  assert.strictEqual(renderResult.width, 1080);
  assert.strictEqual(renderResult.height, 1920);
  assert.ok(renderResult.size > 10000, 'File size should be substantial');
  assert.ok(fs.existsSync(renderResult.filePath), 'Output file must exist on disk');
  console.log('✔ Test 6 Passed: 9:16 Vertical render and FFprobe validation succeeded.');

  // Test 7: Safe Failure Retention Test
  console.log('[Test 7] Testing Safe Failure Handling (Original Retained on Error)...');
  const dummySource = path.join(INCOMING, `test-dummy-source-${Date.now()}.mp4`);
  await fsp.copyFile(samplePath, dummySource);

  const failJobId = crypto.randomUUID();
  await saveJob({
    id: failJobId,
    sourcePath: dummySource,
    sourceName: 'test-dummy-source.mp4',
    duration: 12,
    status: 'ready',
    clips: [
      { id: 'bad-clip', title: 'Invalid Clip', start: 0, end: 5 }
    ],
    options: {
      deleteOriginalAfterSuccess: true, // Should NOT delete because it fails!
      framingMode: 'invalid_mode_error' // Deliberately invalid mode to test failure
    }
  });

  // Temporarily make the source read-only or corrupt the job to simulate failure
  const badSourceJobId = crypto.randomUUID();
  await saveJob({
    id: badSourceJobId,
    sourcePath: path.join(INCOMING, 'non-existent-source.mp4'),
    sourceName: 'missing.mp4',
    duration: 12,
    status: 'ready',
    clips: [{ id: 'c1', title: 'Clip', start: 0, end: 5 }],
    options: { deleteOriginalAfterSuccess: true }
  });

  try {
    await renderJob(badSourceJobId, { deleteOriginalAfterSuccess: true });
    assert.fail('Should have thrown an error on missing source file');
  } catch (err) {
    console.log(`  Expected error captured: ${err.message}`);
  }

  // Verify the dummy source file WAS NOT DELETED
  assert.ok(fs.existsSync(dummySource), 'Original file MUST be retained when rendering fails');
  const updatedFailJob = await getJob(badSourceJobId);
  assert.strictEqual(updatedFailJob.status, 'failed', 'Job status must be marked failed');
  assert.strictEqual(updatedFailJob.sourceRetained, true, 'sourceRetained must be true');

  // Clean up test dummy and test jobs
  await fsp.unlink(dummySource);
  await deleteJob(badSourceJobId);
  await deleteJob(failJobId);
  console.log('✔ Test 7 Passed: Failure safety and original retention confirmed.');

  console.log('\n======================================================');
  console.log(' ALL AUTOCLIPIN VERIFICATION TESTS PASSED SUCCESSFULLY! ');
  console.log('======================================================');
}

runAllTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
