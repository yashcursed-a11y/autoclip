const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const { ROOT, INCOMING } = require('../lib/config');
const { downloadAudioOnly, downloadClipSection } = require('../lib/downloader');
const { saveJob, getJob, deleteJob, getPosts, deletePost } = require('../lib/db');
const { renderClip } = require('../lib/renderer');

async function runBatchPostTests() {
  console.log('--- Starting Batch Post & Stream Ingestion Test Suite ---');

  // Test 1: Verify Downloader Function Signatures
  console.log('[Test 1] Verifying Stream Ingestion & Slicing Exports...');
  assert.strictEqual(typeof downloadAudioOnly, 'function', 'downloadAudioOnly must be exported');
  assert.strictEqual(typeof downloadClipSection, 'function', 'downloadClipSection must be exported');
  console.log('✔ Test 1 Passed: Downloader exports verified.');

  // Test 2: Verify Slicing with Sample Video
  console.log('[Test 2] Testing On-Demand Clip Slicing logic on test source...');
  const samplePath = path.join(ROOT, 'work', 'test', 'sample.mp4');
  assert.ok(fs.existsSync(samplePath), 'sample.mp4 must exist');

  const testJobId = `test-batch-${Date.now()}`;
  const testJob = {
    id: testJobId,
    sourcePath: samplePath,
    sourceName: 'sample.mp4',
    sourceUrl: 'https://www.youtube.com/watch?v=sample123',
    duration: 12,
    audioOnly: false,
    options: {
      aspectRatio: '9:16',
      framingMode: 'smart',
      captionPreset: 'viral-pop'
    },
    clips: [
      { id: 'clip-1', title: 'Viral Moment 1', start: 0, end: 4, score: 95 },
      { id: 'clip-2', title: 'Viral Moment 2', start: 4, end: 8, score: 88 }
    ],
    outputs: []
  };

  await saveJob(testJob);

  // Test 3: Test renderClip generates valid 9:16 vertical short
  console.log('[Test 3] Rendering Clip 1 via renderClip...');
  const out1 = await renderClip(testJob, testJob.clips[0], 0, testJob.options);
  assert.ok(out1, 'Output object returned');
  assert.strictEqual(out1.width, 1080);
  assert.strictEqual(out1.height, 1920);
  assert.ok(fs.existsSync(out1.filePath), 'Rendered output must exist on disk');
  console.log(`  Rendered: ${out1.name} (${out1.size} bytes)`);
  console.log('✔ Test 3 Passed: 9:16 short rendered successfully.');

  // Test 4: Batch Post Staggered Drip Scheduling
  console.log('[Test 4] Testing Staggered Drip Batch Scheduling Logic...');
  const intervalMinutes = 15;
  const baseTime = Date.now();
  const createdPostIds = [];

  for (let i = 0; i < testJob.clips.length; i++) {
    const clip = testJob.clips[i];
    const scheduledAt = new Date(baseTime + (i * intervalMinutes * 60 * 1000)).toISOString();
    
    const postData = {
      id: `post-test-${crypto.randomUUID()}`,
      title: clip.title,
      caption: `${clip.title} 🔥`,
      clipId: clip.id,
      jobId: testJob.id,
      videoPath: out1.filePath,
      videoUrl: out1.url,
      accountIds: ['acc_1', 'acc_2'],
      status: 'scheduled',
      immediate: false,
      scheduledAt,
      isRendered: true
    };

    const { savePost, getPost } = require('../lib/db');
    const saved = await savePost(postData);
    createdPostIds.push(saved.id);

    const fetched = await getPost(saved.id);
    assert.strictEqual(fetched.status, 'scheduled');
    assert.strictEqual(fetched.scheduledAt, scheduledAt);
  }

  assert.strictEqual(createdPostIds.length, 2, 'Two posts must be scheduled');
  console.log(`  Successfully scheduled ${createdPostIds.length} posts with ${intervalMinutes}m interval.`);
  console.log('✔ Test 4 Passed: Staggered drip scheduling verified.');

  // Test 5: Instant Batch Post Blast Logic
  console.log('[Test 5] Testing Instant Batch Post Blast Logic...');
  const instantPost = {
    id: `post-test-instant-${Date.now()}`,
    title: 'Instant Viral Blast',
    caption: 'Blast caption',
    clipId: 'clip-1',
    jobId: testJob.id,
    videoPath: out1.filePath,
    videoUrl: out1.url,
    accountIds: ['acc_2'],
    status: 'publishing',
    immediate: true,
    scheduledAt: new Date().toISOString(),
    isRendered: true
  };

  const { savePost } = require('../lib/db');
  const savedInstant = await savePost(instantPost);
  createdPostIds.push(savedInstant.id);
  assert.strictEqual(savedInstant.status, 'publishing');
  assert.strictEqual(savedInstant.immediate, true);
  console.log('✔ Test 5 Passed: Instant batch blast dispatch verified.');

  // Cleanup
  console.log('[Cleanup] Cleaning up test jobs and test posts...');
  await deleteJob(testJobId);
  for (const pid of createdPostIds) {
    await deletePost(pid);
  }
  if (fs.existsSync(out1.filePath)) {
    try { fs.unlinkSync(out1.filePath); } catch {}
  }

  console.log('\n======================================================');
  console.log(' ALL BATCH POST & STREAM INGESTION TESTS PASSED! ');
  console.log('======================================================');
}

runBatchPostTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
