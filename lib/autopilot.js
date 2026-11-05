const { getJob, updateJob, getSettings, getAccounts, savePost, rememberTags } = require('./db');
const { renderClip } = require('./renderer');
const { generatePostMetadata } = require('./poster');
const { executeProcessVideo } = require('./job-runner');

let activeAutoPilots = new Map();

async function runAutoPilot(jobId, config = {}) {
  const clipCount = Math.max(1, Math.min(150, Number(config.clipCount) || 10));
  
  // Support flexible drip interval delays in minutes (e.g. 10m, 15m, 30m, 1h, 2h)
  let dripIntervalMinutes = 60;
  if (config.dripIntervalMinutes !== undefined && !isNaN(Number(config.dripIntervalMinutes))) {
    dripIntervalMinutes = Math.max(5, Math.min(4320, Number(config.dripIntervalMinutes)));
  } else if (config.dripIntervalHours !== undefined && !isNaN(Number(config.dripIntervalHours))) {
    dripIntervalMinutes = Math.max(5, Math.min(4320, Math.round(Number(config.dripIntervalHours) * 60)));
  }
  const dripIntervalHours = Number((dripIntervalMinutes / 60).toFixed(2));
  const enableHookStitcher = config.enableHookStitcher !== false;
  const renderOptions = config.renderOptions || {};

  activeAutoPilots.set(jobId, { status: 'running', percent: 5, message: 'Initializing Auto-Pilot pipeline...' });

  try {
    let job = await getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);

    const fs = require('node:fs');
    if (!job.sourcePath || !fs.existsSync(job.sourcePath)) {
      throw new Error(`Source video file not found on disk: "${job.sourceName || 'source.mp4'}". Please paste a fresh stream URL or upload a video file to run Auto-Pilot.`);
    }

    // Target accounts
    let targetAccountIds = config.accountIds;
    if (!targetAccountIds || !targetAccountIds.length) {
      const allAccounts = await getAccounts();
      targetAccountIds = allAccounts.filter(a => a.enabled).map(a => a.id);
    }
    if (!targetAccountIds.length) {
      targetAccountIds = ['acc_2']; // Default to shorts if none
    }

    // Step 1: Process video (transcribe + find moments) if not already done
    if (!job.clips || job.clips.length === 0) {
      await updateJob(jobId, {
        status: 'autopilot',
        progress: { percent: 10, message: '🚀 Auto-Pilot: Transcribing video with Faster-Whisper...' }
      });
      activeAutoPilots.set(jobId, { status: 'running', percent: 15, message: 'Transcribing with Whisper...' });

      await executeProcessVideo(jobId, job.options || {});
      job = await getJob(jobId);
    }

    if (!job.clips || job.clips.length === 0) {
      throw new Error('Auto-Pilot could not detect any high-energy clip candidates from this video.');
    }

    // Step 2: Rank and pick top N moments
    const sortedClips = job.clips.slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const selectedClips = sortedClips.slice(0, clipCount);

    const settings = await getSettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || null;

    const scheduledPosts = [];
    const outputs = [];

    // Step 3: Render & Schedule each selected clip
    for (let i = 0; i < selectedClips.length; i++) {
      const clip = selectedClips[i];
      const stepPct = Math.round(25 + (i / selectedClips.length) * 65);
      const msg = `🚀 Auto-Pilot [${i + 1}/${selectedClips.length}]: Rendering 9:16 vertical short "${clip.title}"${enableHookStitcher ? ' with Hook Stitcher' : ''}...`;

      await updateJob(jobId, {
        status: 'autopilot',
        progress: { percent: stepPct, message: msg }
      });
      activeAutoPilots.set(jobId, { status: 'running', percent: stepPct, message: msg });

      // Render vertical 9:16 clip with captions, watermark, hook stitcher and auto-memes
      const rendered = await renderClip(job, clip, i, {
        ...renderOptions,
        hookStitcher: enableHookStitcher,
        autoMemes: config.autoMemes !== false,
        aspectRatio: renderOptions.aspectRatio || '9:16',
        captionsEnabled: renderOptions.captionsEnabled !== false,
        captionPreset: renderOptions.captionPreset || settings.defaultCaptionPreset || 'viral-pop',
        framingMode: renderOptions.framingMode || settings.defaultFramingPreset || 'smart'
      });
      outputs.push(rendered);

      // Generate AI Hook Title, Caption & Viral Tags
      const meta = await generatePostMetadata(clip.title, clip.transcriptText || '', 'all', apiKey);

      // Calculate staggered schedule time using exact dripIntervalMinutes
      const scheduledAt = new Date(Date.now() + (i * dripIntervalMinutes * 60 * 1000)).toISOString();

      const postData = {
        title: meta.title || clip.title,
        caption: meta.caption || `Wait until you see what happens next! 👇 #DoubleCoverage`,
        hashtags: Array.isArray(meta.hashtags) ? meta.hashtags : ['#fyp', '#viral', '#shorts', '#trending'],
        firstComment: meta.firstComment || 'Which moment was your favorite? Let us know below 👇',
        clipId: rendered.name,
        jobId: job.id,
        clipName: clip.title,
        videoPath: rendered.filePath,
        videoUrl: rendered.url,
        accountIds: targetAccountIds,
        status: 'scheduled',
        immediate: false,
        scheduledAt,
        autopilot: true
      };

      const saved = await savePost(postData);
      scheduledPosts.push(saved);

      // Auto-remember tags into the Tag Memory Bank
      rememberTags(postData.hashtags).catch(() => {});
    }

    // Step 4: Finish Auto-Pilot
    const successMsg = `🎉 Auto-Pilot Complete: ${selectedClips.length} viral shorts rendered & scheduled across ${targetAccountIds.length} accounts!`;
    await updateJob(jobId, {
      status: 'completed',
      outputs,
      progress: { percent: 100, message: successMsg },
      autopilot: {
        completedAt: new Date().toISOString(),
        clipCount: selectedClips.length,
        dripIntervalHours,
        targetAccountIds,
        scheduledPostIds: scheduledPosts.map(p => p.id)
      }
    });

    activeAutoPilots.set(jobId, {
      status: 'completed',
      percent: 100,
      message: successMsg,
      scheduledCount: scheduledPosts.length
    });

    return {
      success: true,
      jobId,
      renderedCount: outputs.length,
      scheduledPosts
    };
  } catch (err) {
    console.error(`Auto-Pilot failed for job ${jobId}:`, err);
    activeAutoPilots.set(jobId, { status: 'failed', percent: 0, message: `Auto-Pilot failed: ${err.message}` });
    await updateJob(jobId, {
      status: 'failed',
      error: err.message,
      progress: { percent: 0, message: `Auto-Pilot error: ${err.message}` }
    });
    throw err;
  }
}

function getAutoPilotStatus(jobId) {
  return activeAutoPilots.get(jobId) || null;
}

module.exports = {
  runAutoPilot,
  getAutoPilotStatus
};
