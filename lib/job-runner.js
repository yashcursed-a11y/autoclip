const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { updateJob, getJob, recordFeedback } = require('./db');
const { transcribeVideo } = require('./transcriber');
const { findBestMoments } = require('./analyzer');
const { renderClip, getVideoInfo } = require('./renderer');
const {
  getOAuthClient,
  getAutoclipFolders,
  uploadFileToDrive,
  moveFileToTrash,
  moveFileFolder
} = require('./drive');
const { google } = require('googleapis');

// Format batch folder with Year-Month-Day_Hour-Minute and title
function formatBatchFolderName(sourceName, d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const cleanTitle = (sourceName || 'Batch')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return `${dateStr}_${cleanTitle || 'Clips'}`;
}

// Smart Batch Queue (Concurrency: 1 for low-end laptop safety)
class JobQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.queue = [];
    this.running = new Set();
  }

  enqueue(jobId, taskType = 'process', options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ jobId, taskType, options, resolve, reject, addedAt: Date.now() });
      const pos = this.queue.length;
      updateJob(jobId, {
        status: 'queued',
        queuePosition: pos,
        progress: { percent: 0, message: `Queued (#${pos} in batch line)...` }
      }).catch(() => {});
      this.tick();
    });
  }

  async tick() {
    if (this.running.size >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const nextTask = this.queue.shift();
    if (!nextTask) return;

    this.running.add(nextTask.jobId);
    this.updateQueuePositions();

    try {
      let result;
      if (nextTask.taskType === 'render') {
        result = await executeRenderJob(nextTask.jobId, nextTask.options);
      } else {
        result = await executeProcessVideo(nextTask.jobId, nextTask.options);
      }
      nextTask.resolve(result);
    } catch (err) {
      nextTask.reject(err);
    } finally {
      this.running.delete(nextTask.jobId);
      this.updateQueuePositions();
      this.tick();
    }
  }

  updateQueuePositions() {
    this.queue.forEach((item, index) => {
      const pos = index + 1;
      updateJob(item.jobId, {
        queuePosition: pos,
        progress: { percent: 0, message: `Queued (#${pos} in batch line)...` }
      }).catch(() => {});
    });
  }

  remove(jobId) {
    const item = this.queue.find(q => q.jobId === jobId);
    if (item && item.reject) item.reject(new Error('Job cancelled from queue.'));
    this.queue = this.queue.filter(q => q.jobId !== jobId);
    this.updateQueuePositions();
  }
}

const batchQueue = new JobQueue(1);

// Active job abort controllers
const activeControllers = new Map();

function getAbortSignal(jobId) {
  if (!activeControllers.has(jobId)) {
    activeControllers.set(jobId, new AbortController());
  }
  return activeControllers.get(jobId).signal;
}

function cancelJob(jobId) {
  batchQueue.remove(jobId);
  if (activeControllers.has(jobId)) {
    activeControllers.get(jobId).abort();
    activeControllers.delete(jobId);
    return true;
  }
  return false;
}

// 1. Process Video Pipeline: Transcribe + Analyze Moments
async function executeProcessVideo(jobId, options = {}) {
  const signal = getAbortSignal(jobId);
  try {
    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found.');
    if ((!job.sourcePath || !fs.existsSync(job.sourcePath)) && !job.sourceUrl) {
      throw new Error(`Video file not found on disk: "${job.sourceName || 'source.mp4'}". Please re-download or re-upload the video.`);
    }

    // Upload original to Google Drive Incoming if requested & connected
    if (job.options?.uploadOriginalToDrive && !job.driveOriginalId) {
      try {
        await updateJob(jobId, { status: 'uploading_original', progress: { percent: 10, message: 'Uploading original to Google Drive Incoming...' } });
        const client = getOAuthClient();
        if (client) {
          const drive = google.drive({ version: 'v3', auth: client });
          const folders = await getAutoclipFolders(drive);
          const driveFile = await uploadFileToDrive(job.sourcePath, path.basename(job.sourceName), folders.incomingId);
          if (driveFile?.id) {
            await updateJob(jobId, { driveOriginalId: driveFile.id, driveFolders: folders });
          }
        }
      } catch (driveErr) {
        console.warn('Drive upload of original failed (continuing local workflow):', driveErr.message);
      }
    }

    // Transcription phase
    await updateJob(jobId, {
      status: 'transcribing',
      progress: { percent: 15, message: 'Starting speech transcription (Faster-Whisper)...' }
    });

    const transcript = await transcribeVideo(
      job.sourcePath,
      {
        whisperModel: options.whisperModel || job.options?.whisperModel || 'tiny',
        language: options.language || job.options?.language || 'auto',
        forceRefresh: Boolean(options.forceRefresh)
      },
      (p) => {
        updateJob(jobId, { progress: p }).catch(() => {});
      },
      signal
    );

    await updateJob(jobId, {
      transcript,
      status: 'analyzing',
      progress: { percent: 85, message: 'Detecting best moments (filtering low-quality moments)...' }
    });

    // Best moments analysis phase (with Universal AI & offline v3 fallback)
    let clips = null;
    try {
      const { analyzeWithAI } = require('./ai-providers');
      clips = await analyzeWithAI(transcript, job.duration, { ...job.options, ...options });
    } catch (aiErr) {
      console.warn('[AI Analysis] Fallback to offline analyzer:', aiErr.message);
    }

    if (!clips || clips.length === 0) {
      delete require.cache[require.resolve('./analyzer')];
      const { findBestMoments } = require('./analyzer');
      clips = await findBestMoments(transcript, job.duration, {
        ...job.options,
        ...options,
        minDuration: Math.max(20, Number(options.minDuration || job.options?.minDuration || 20))
      });
    }

    const parts = clips.parts || null;

    await updateJob(jobId, {
      clips,
      ...(parts ? { parts } : {}),
      status: 'ready',
      progress: {
        percent: 100,
        message: `Found ${clips.length} top moment candidates (>20s)${parts ? ` across ${parts.length} stream parts.` : '.'}`
      }
    });

    activeControllers.delete(jobId);
    return await getJob(jobId);
  } catch (err) {
    activeControllers.delete(jobId);
    await updateJob(jobId, {
      status: 'failed',
      error: err.message,
      progress: { percent: 0, message: `Failed: ${err.message}` }
    });
    throw err;
  }
}

// 2. Render Pipeline: Burn subtitles, crop, upload to Drive, verify, trash original if configured
async function executeRenderJob(jobId, renderOptions = {}) {
  const signal = getAbortSignal(jobId);
  try {
    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found.');
    if ((!job.sourcePath || !fs.existsSync(job.sourcePath)) && !job.sourceUrl) {
      throw new Error(`Video file not found on disk: "${job.sourceName || 'source.mp4'}". Please re-download or re-upload the video.`);
    }
    if (!job.clips || job.clips.length === 0) throw new Error('No clips to render.');

    // Create unique timestamped batch folder name
    const batchFolder = job.batchFolder || formatBatchFolderName(job.sourceName);
    job.batchFolder = batchFolder;
    await updateJob(jobId, {
      batchFolder,
      status: 'rendering',
      progress: { percent: 5, message: `Preparing batch folder: ${batchFolder}...` }
    });

    const options = { ...job.options, ...renderOptions };
    const outputs = [];

    // Always load fresh renderer to support hot updates without server restart
    delete require.cache[require.resolve('./renderer')];
    const { renderClip: freshRenderClip } = require('./renderer');

    // Render each clip
    for (let i = 0; i < job.clips.length; i++) {
      const clip = job.clips[i];
      const stepPct = Math.round(10 + (i / job.clips.length) * 70);
      await updateJob(jobId, {
        progress: { percent: stepPct, message: `Rendering clip ${i + 1} of ${job.clips.length}: "${clip.title}"` }
      });

      const rendered = await freshRenderClip(job, clip, i, options, signal);
      outputs.push(rendered);

      try {
        const { recordClipsExported } = require('./licensing');
        await recordClipsExported(1);
      } catch (e) {
        console.warn('[JobRunner] Failed to increment clip count:', e.message);
      }
    }

    // Drive upload if requested
    let driveFolder = null;
    if (options.uploadToDrive) {
      await updateJob(jobId, {
        status: 'uploading_drive',
        progress: { percent: 85, message: `Uploading clips to Google Drive Finished Clips/${batchFolder}...` }
      });

      const client = getOAuthClient();
      if (client) {
        const drive = google.drive({ version: 'v3', auth: client });
        const folders = await getAutoclipFolders(drive);

        // Create or get subfolder for this video batch named with Date & Time
        const sourceFolderRes = await drive.files.create({
          requestBody: {
            name: batchFolder,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folders.finishedId]
          },
          fields: 'id, name, webViewLink'
        });
        driveFolder = sourceFolderRes.data;

        for (const out of outputs) {
          const driveFile = await uploadFileToDrive(out.filePath, out.name, driveFolder.id);
          out.drive = driveFile;
        }
      }
    }

    // STRICT VERIFICATION:
    // 1. Verify every requested output exists and is readable on disk
    for (const out of outputs) {
      if (!fs.existsSync(out.filePath)) {
        throw new Error(`Verification failed: missing output file ${out.name}`);
      }
      const stat = await fsp.stat(out.filePath);
      if (stat.size === 0) {
        throw new Error(`Verification failed: empty output file ${out.name}`);
      }
    }

    // 2. If Drive upload was requested, verify every file has a Drive file ID
    if (options.uploadToDrive && driveFolder) {
      for (const out of outputs) {
        if (!out.drive || !out.drive.id) {
          throw new Error(`Drive verification failed for ${out.name}. Original retained.`);
        }
      }
    }

    // ONLY NOW: Safe source cleanup / trash
    let driveOriginalTrashed = false;
    let localOriginalRemoved = false;

    // Move Google Drive original to Trash if requested & present
    if (options.trashOriginalInDrive && job.driveOriginalId) {
      try {
        driveOriginalTrashed = await moveFileToTrash(job.driveOriginalId);
      } catch (trashErr) {
        console.warn('Failed to move Drive original to Trash:', trashErr.message);
      }
    }

    // Delete local original if requested
    if (options.deleteOriginalAfterSuccess && job.sourcePath && fs.existsSync(job.sourcePath)) {
      try {
        await fsp.rm(job.sourcePath, { force: true });
        localOriginalRemoved = true;
      } catch (rmErr) {
        console.warn('Failed to delete local original:', rmErr.message);
      }
    }

    const updatedJob = await updateJob(jobId, {
      status: 'complete',
      outputs,
      batchFolder,
      driveFolder,
      originalRemoved: localOriginalRemoved,
      driveOriginalTrashed,
      sourceRetained: !localOriginalRemoved && !driveOriginalTrashed,
      progress: { percent: 100, message: `All clips saved in batch folder: ${batchFolder}!` }
    });

    activeControllers.delete(jobId);
    return updatedJob;
  } catch (err) {
    activeControllers.delete(jobId);
    await updateJob(jobId, {
      status: 'failed',
      error: err.message,
      sourceRetained: true,
      progress: { percent: 0, message: `Render failed: ${err.message}. Original file retained safely.` }
    });
    throw err;
  }
}

function processVideo(jobId, options = {}) {
  return batchQueue.enqueue(jobId, 'process', options);
}

function renderJob(jobId, options = {}) {
  return batchQueue.enqueue(jobId, 'render', options);
}

module.exports = {
  processVideo,
  renderJob,
  cancelJob,
  batchQueue,
  formatBatchFolderName,
  executeProcessVideo,
  executeRenderJob
};
