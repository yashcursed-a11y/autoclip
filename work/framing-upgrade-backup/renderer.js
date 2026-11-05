const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs').promises;
const path = require('node:path');
const { ASPECT_RATIOS, FINISHED, ROOT } = require('./config');
const { generateAssSubtitles } = require('./caption');
const { detectClipMemes, MEME_CATALOG, PUBLIC_MEMES_DIR, PUBLIC_SFX_DIR } = require('./memes');
const { downloadClipSection } = require('./downloader');
const { registerProcess, unregisterProcess, recordIncident } = require('./diagnostics');

function safeName(v) {
  return (v || 'clip')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'clip';
}

function runCommand(command, args, abortSignal = null, meta = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    registerProcess(command, child, meta);
    let stdout = '';
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try { child.kill('SIGTERM'); } catch {}
        unregisterProcess(child);
        reject(new Error('Process cancelled by user.'));
      });
    }

    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => {
      unregisterProcess(child);
      recordIncident({
        type: 'PROCESS_ERROR',
        title: `${command} Process Error`,
        message: err.message,
        details: args.join(' '),
        severity: 'CRITICAL',
        clipTitle: meta.clipTitle,
        jobId: meta.jobId
      });
      reject(err);
    });
    child.on('close', code => {
      unregisterProcess(child);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const errMsg = `${command} failed (code ${code}): ${stderr.slice(-400)}`;
        recordIncident({
          type: command === 'ffmpeg' ? 'FFMPEG_CRASH' : 'PROCESS_ERROR',
          title: `${command} failed (code ${code})`,
          message: errMsg,
          details: stderr,
          severity: 'CRITICAL',
          clipTitle: meta.clipTitle,
          jobId: meta.jobId
        });
        reject(new Error(errMsg));
      }
    });
  });
}

async function getVideoInfo(filePath) {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=width,height,r_frame_rate,duration:format=duration',
      '-of', 'json',
      filePath
    ]);
    const data = JSON.parse(stdout);
    const stream = (data.streams || []).find(s => s.width && s.height) || {};
    const duration = Number(stream.duration || data.format?.duration || 0);
    return {
      width: Number(stream.width || 1920),
      height: Number(stream.height || 1080),
      duration
    };
  } catch (err) {
    if (err.message && (err.message.includes('moov atom not found') || err.message.includes('Invalid data found'))) {
      throw new Error(`Video file is corrupted or incomplete (moov atom missing). Please re-download or check the source video.`);
    }
    throw err;
  }
}

// Compute face tracking coordinates
async function getFaceTrackingCrop(sourcePath, start, end, aspect) {
  try {
    const script = path.join(ROOT, 'scripts', 'face_track.py');
    const { stdout } = await runCommand('python', [script, sourcePath, String(start), String(end), aspect]);
    return JSON.parse(stdout);
  } catch (err) {
    console.warn('Face tracking failed, falling back to center:', err.message);
    return null;
  }
}

// Find high-energy climactic sentence for Retention Hook Stitcher
function findClimacticTeaser(job, startSec, endSec) {
  const duration = Math.max(1, endSec - startSec);
  const teaserDur = Math.min(2.0, Math.max(1.5, duration * 0.15));
  let bestStart = startSec + duration * 0.55;
  let teaserText = 'WAIT FOR THIS... 🤯';

  if (job.transcript?.segments?.length) {
    const minStart = startSec + duration * 0.35;
    const maxStart = startSec + duration * 0.85;
    let highestEnergy = -1;

    for (const seg of job.transcript.segments) {
      if (seg.start >= minStart && seg.end <= maxStart) {
        let score = (seg.text || '').length;
        if (/[!?]/.test(seg.text)) score += 50;
        if (/[A-Z]{3,}/.test(seg.text)) score += 30;
        if (score > highestEnergy) {
          highestEnergy = score;
          bestStart = Math.max(startSec, seg.start);
          teaserText = (seg.text || '').slice(0, 32).trim() || teaserText;
        }
      }
    }
  }

  bestStart = Math.max(startSec, Math.min(endSec - teaserDur, bestStart));
  return { start: bestStart, duration: teaserDur, text: teaserText };
}

// Render a single clip
async function renderClip(job, clip, index, options = {}, abortSignal = null) {
  const batchFolder = job.batchFolder || job.id;
  const dir = path.join(FINISHED, batchFolder);
  await fsp.mkdir(dir, { recursive: true });

  const clipIndexStr = String(index + 1).padStart(2, '0');
  const clipTitleSafe = safeName(clip.title || `Clip-${index + 1}`);
  const outputFilename = `${clipIndexStr}-${clipTitleSafe}.mp4`;
  const outputPath = path.join(dir, outputFilename);

  // If Hook Stitcher is enabled, render the main video to a temporary path, then prepend teaser
  const isHookStitcher = options.hookStitcher === true;
  const mainOutputPath = isHookStitcher ? path.join(dir, `_raw_${outputFilename}`) : outputPath;

  const maxAvail = job.duration > 0 ? job.duration : 9999;
  const startSec = Math.max(0, Math.min(maxAvail - 1, Number(clip.start) || 0));
  // Enforce minimum 20 seconds duration if video duration allows
  const targetMin = maxAvail >= 20 ? 20 : Math.max(1, maxAvail - startSec);
  const endSec = Math.min(maxAvail, Math.max(startSec + targetMin, Number(clip.end) || startSec + 30));
  const clipDuration = Math.max(1, endSec - startSec);

  // Check if source is audio-only (Smart Stream Ingestion) and slice on-demand in full HD
  let activeSourceVideo = job.sourcePath;
  let tempSlicePath = null;
  let effectiveStartSec = startSec;

  const isAudioOnlySource = Boolean(
    job.audioOnly ||
    !job.sourcePath ||
    job.sourcePath.endsWith('.m4a') ||
    job.sourcePath.endsWith('.mp3') ||
    job.sourcePath.endsWith('.wav') ||
    job.sourcePath.endsWith('.ogg')
  );

  try {
    if (isAudioOnlySource && job.sourceUrl) {
      tempSlicePath = path.join(dir, `_hd_slice_${clipIndexStr}_${Date.now()}.mp4`);
      await downloadClipSection(job.sourceUrl, startSec, endSec, tempSlicePath);
      activeSourceVideo = tempSlicePath;
      effectiveStartSec = 0; // The slice is already cut to this clip's time range
    }

  const aspectKey = options.aspectRatio || '9:16';
  const canvas = ASPECT_RATIOS[aspectKey] || ASPECT_RATIOS['9:16'];
  const targetW = canvas.width;
  const targetH = canvas.height;

  const framingMode = options.framingMode || 'smart'; // 'smart' | 'face' | 'blur' | 'color' | 'split' | 'gaming_split' | 'face_stack' | 'auto'
  let effectiveFramingMode = framingMode;
  if (effectiveFramingMode === 'auto') {
    if (clip.recommendedFraming) {
      effectiveFramingMode = clip.recommendedFraming;
    } else if (clip.category?.includes('Gaming') || /gaming|game|fortnite|fifa|roblox|gta|elden|controller|clutch/i.test(clip.title + ' ' + (clip.hook || ''))) {
      effectiveFramingMode = 'gaming_split';
    } else if (clip.category?.includes('FaceTime') || /facetime|discord|call|calling|phone|guest|ometv/i.test(clip.title + ' ' + (clip.hook || ''))) {
      effectiveFramingMode = 'face_stack';
    } else {
      effectiveFramingMode = 'smart';
    }
  }

  const zoom = Math.max(1.0, Math.min(2.5, Number(options.zoom || 1.0)));
  const panX = Number(options.panX || 0);
  const panY = Number(options.panY || 0);

  // Generate ASS Subtitles file if captions enabled
  let assFilePath = null;
  if (options.captionsEnabled !== false && job.transcript) {
    const assContent = generateAssSubtitles(clip, job.transcript, options, targetW, targetH);
    assFilePath = path.join(dir, `${clipIndexStr}-${clipTitleSafe}.ass`);
    await fsp.writeFile(assFilePath, assContent, 'utf8');
  }

  // Construct FFmpeg Video Filter chain
  let framingGraph = null;
  let linearFramingFilter = null;

  if (effectiveFramingMode === 'gaming_split') {
    // Gaming split: Streamer Facecam Top + Gameplay Action Bottom
    const halfH = Math.floor(targetH / 2);
    const camPos = options.webcamPosition || 'top-right';
    let camCrop = 'crop=iw*0.35:ih*0.48:iw*0.65:0'; // top-right default (Kai/Speed facecam spot)
    if (camPos === 'top-left') camCrop = 'crop=iw*0.35:ih*0.48:0:0';
    else if (camPos === 'bottom-right') camCrop = 'crop=iw*0.35:ih*0.48:iw*0.65:ih*0.52';
    else if (camPos === 'bottom-left') camCrop = 'crop=iw*0.35:ih*0.48:0:ih*0.52';
    else if (camPos === 'top-half') camCrop = 'crop=iw:ih/2:0:0';

    framingGraph = `[0:v]split=2[cam_in][game_in];` +
      `[cam_in]${camCrop},scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[top_cam];` +
      `[game_in]crop=iw*0.75:ih:iw*0.125:0,scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[bot_game];` +
      `[top_cam][bot_game]vstack[v_framed]`;
  } else if (effectiveFramingMode === 'face_stack') {
    // 2-Person FaceTime / Discord Call: Caller on Top, Callee on Bottom
    const halfH = Math.floor(targetH / 2);
    framingGraph = `[0:v]split=2[left_face][right_face];` +
      `[left_face]crop=iw/2:ih:0:0,scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[top_person];` +
      `[right_face]crop=iw/2:ih:iw/2:0,scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[bot_person];` +
      `[top_person][bot_person]vstack[v_framed]`;
  } else if (effectiveFramingMode === 'blur') {
    // Blurred background with crisp centered video
    framingGraph = `[0:v]split=2[bg][fg];` +
      `[bg]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=25:5[bgblur];` +
      `[fg]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fgscaled];` +
      `[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2[v_framed]`;
  } else if (effectiveFramingMode === 'split') {
    // Top & bottom split screen
    const halfH = Math.floor(targetH / 2);
    framingGraph = `[0:v]split=2[top][bot];` +
      `[top]crop=iw:ih/2:0:0,scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[t];` +
      `[bot]crop=iw:ih/2:0:ih/2,scale=${targetW}:${halfH}:force_original_aspect_ratio=increase,crop=${targetW}:${halfH}[b];` +
      `[t][b]vstack[v_framed]`;
  } else if (effectiveFramingMode === 'color') {
    // Pad with background color
    const bgColor = (options.bgColor || '#000000').replace('#', '');
    linearFramingFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=${bgColor}`;
  } else {
    // 'smart' or 'face' crop
    let cropX = 0, cropY = 0, cropW = 0, cropH = 0;
    if (effectiveFramingMode === 'face') {
      const tracking = await getFaceTrackingCrop(activeSourceVideo, effectiveStartSec, effectiveStartSec + clipDuration, aspectKey);
      if (tracking && tracking.crop) {
        cropX = tracking.crop.x;
        cropY = tracking.crop.y;
        cropW = tracking.crop.width;
        cropH = tracking.crop.height;
      }
    }

    const srcInfo = await getVideoInfo(activeSourceVideo);
    const targetRatio = targetW / targetH;
    const srcRatio = srcInfo.width / srcInfo.height;

    if (!cropW || !cropH) {
      // Smart center crop
      if (srcRatio > targetRatio) {
        cropH = srcInfo.height;
        cropW = Math.round(srcInfo.height * targetRatio);
        cropX = Math.round((srcInfo.width - cropW) / 2);
        cropY = 0;
      } else {
        cropW = srcInfo.width;
        cropH = Math.round(srcInfo.width / targetRatio);
        cropX = 0;
        cropY = Math.round((srcInfo.height - cropH) / 2);
      }
    }

    // Apply zoom & pan adjustments
    const currentZoom = Math.max(1.0, Number(options.zoom || zoom || 1.0));
    const pX = Number(options.panX !== undefined ? options.panX : panX) || 0;
    const pY = Number(options.panY !== undefined ? options.panY : panY) || 0;

    if (currentZoom > 1.0 || pX !== 0 || pY !== 0) {
      const zoomedW = Math.round(cropW / currentZoom);
      const zoomedH = Math.round(cropH / currentZoom);
      const maxPanShiftX = Math.max(1, Math.round((srcInfo.width - zoomedW) / 2));
      const maxPanShiftY = Math.max(1, Math.round((srcInfo.height - zoomedH) / 2));
      const pixelShiftX = Math.abs(pX) <= 100 ? Math.round((pX / 100) * maxPanShiftX) : pX;
      const pixelShiftY = Math.abs(pY) <= 100 ? Math.round((pY / 100) * maxPanShiftY) : pY;

      cropX = Math.max(0, Math.min(srcInfo.width - zoomedW, cropX + Math.round((cropW - zoomedW) / 2) + pixelShiftX));
      cropY = Math.max(0, Math.min(srcInfo.height - zoomedH, cropY + Math.round((cropH - zoomedH) / 2) + pixelShiftY));
      cropW = zoomedW;
      cropH = zoomedH;
    }

    linearFramingFilter = `crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${targetW}:${targetH}`;
  }

  // Secondary Linear Filters (Headlines, Watermark Text, Progress Bar, Subtitles)
  const secondaryFilters = [];

  // Headline Banner Overlay
  if (options.headline) {
    const cleanHeadline = options.headline.replace(/['"\\]/g, ' ').slice(0, 60);
    secondaryFilters.push(`drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${cleanHeadline}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.65:boxborderw=20:x=(w-text_w)/2:y=90`);
  }

  // Chooseable Watermark Overlay (Text or Image)
  const wm = options.watermark || {};
  const isWmEnabled = Boolean(wm.enabled !== false && (wm.text || (wm.type === 'image' && wm.imagePath)));

  let wmTextFilter = null;
  let wmImageInput = null;
  let wmImageOverlay = null;

  if (isWmEnabled) {
    let posX = 'w-tw-50';
    let posY = options.headline ? '180' : '80';
    let ovX = 'W-w-50';
    let ovY = options.headline ? '180' : '80';

    const hasCustomCoords = (wm.xPercent !== undefined && wm.yPercent !== undefined && wm.xPercent !== null && !isNaN(Number(wm.xPercent)));

    if (hasCustomCoords) {
      const xFactor = Math.max(0, Math.min(100, Number(wm.xPercent))) / 100;
      const yFactor = Math.max(0, Math.min(100, Number(wm.yPercent))) / 100;
      posX = `(w-tw)*${xFactor.toFixed(4)}`;
      posY = `(h-th)*${yFactor.toFixed(4)}`;
      ovX = `(W-w)*${xFactor.toFixed(4)}`;
      ovY = `(H-h)*${yFactor.toFixed(4)}`;
    } else {
      const pos = wm.position || 'top-right';
      switch (pos) {
        case 'top-left':
          posX = '50';
          posY = options.headline ? '180' : '80';
          ovX = '50';
          ovY = options.headline ? '180' : '80';
          break;
        case 'top-center':
          posX = '(w-tw)/2';
          posY = options.headline ? '180' : '80';
          ovX = '(W-w)/2';
          ovY = options.headline ? '180' : '80';
          break;
        case 'center':
          posX = '(w-tw)/2';
          posY = '(h-th)/2';
          ovX = '(W-w)/2';
          ovY = '(H-h)/2';
          break;
        case 'above-captions':
          posX = '(w-tw)/2';
          posY = 'h*0.65';
          ovX = '(W-w)/2';
          ovY = 'H*0.65';
          break;
        case 'bottom-left':
          posX = '50';
          posY = 'h-th-90';
          ovX = '50';
          ovY = 'H-h-90';
          break;
        case 'bottom-right':
          posX = 'w-tw-50';
          posY = 'h-th-90';
          ovX = 'W-w-50';
          ovY = 'H-h-90';
          break;
        case 'top-right':
        default:
          posX = 'w-tw-50';
          posY = options.headline ? '180' : '80';
          ovX = 'W-w-50';
          ovY = options.headline ? '180' : '80';
          break;
      }
    }

    if (wm.type === 'image' && wm.imagePath && fs.existsSync(wm.imagePath)) {
      const scaleW = Math.round(targetW * (Number(wm.imageScale) || 0.22));
      const opacity = (wm.opacity !== undefined ? Number(wm.opacity) : 0.85).toFixed(2);
      wmImageInput = wm.imagePath;
      wmImageOverlay = { scaleW, opacity, ovX, ovY };
    } else if (wm.text) {
      const cleanText = wm.text.replace(/['"\\]/g, ' ').slice(0, 40);
      const fontSize = Number(wm.fontSize) || 36;
      let fontColor = (wm.color || 'white').trim();
      if (fontColor.startsWith('#')) {
        fontColor = '0x' + fontColor.slice(1);
      }
      const opacity = (wm.opacity !== undefined ? Number(wm.opacity) : 0.85).toFixed(2);
      const boxClause = wm.box !== false ? ':box=1:boxcolor=black@0.45:boxborderw=8' : '';
      wmTextFilter = `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${cleanText}':fontsize=${fontSize}:fontcolor=${fontColor}@${opacity}:x=${posX}:y=${posY}:shadowcolor=black@0.6:shadowx=2:shadowy=2${boxClause}`;
    }
  }

  if (wmTextFilter) {
    secondaryFilters.push(wmTextFilter);
  }

  // Animated Progress Bar Overlay
  if (options.progressBar !== false) {
    const progressColor = options.progressColor || 'yellow';
    secondaryFilters.push(`drawbox=x=0:y=ih-8:w=iw*t/${clipDuration.toFixed(2)}:h=8:color=${progressColor}:t=fill`);
  }

  // Burn ASS Subtitles with robust Windows escaping
  if (assFilePath && fs.existsSync(assFilePath)) {
    const escapedAss = assFilePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    secondaryFilters.push(`ass=filename='${escapedAss}'`);
  }

  // 1. Gather Overlays (explicit or auto-detected meme reactions)
  let activeOverlays = Array.isArray(options.overlays) ? [...options.overlays] : [];
  if (options.autoMemes !== false && activeOverlays.length === 0 && job.transcript) {
    activeOverlays = detectClipMemes(job.transcript, startSec, endSec, 2);
  }

  // Resolve valid overlay items and their paths
  const resolvedOverlays = [];
  for (const ov of activeOverlays) {
    let imgPath = ov.imagePath || ov.filePath;
    let sndPath = ov.soundPath;
    if (!imgPath && ov.memeId) {
      const meme = MEME_CATALOG.find(m => m.id === ov.memeId);
      if (meme) {
        imgPath = path.join(PUBLIC_MEMES_DIR, meme.imageFile);
        if (ov.soundEnabled !== false && !sndPath) {
          sndPath = path.join(PUBLIC_SFX_DIR, meme.soundFile);
        }
      }
    }
    if (imgPath && fs.existsSync(imgPath)) {
      resolvedOverlays.push({
        ...ov,
        imagePath: imgPath,
        soundPath: (sndPath && fs.existsSync(sndPath)) ? sndPath : null
      });
    }
  }

  let ffmpegArgs = [];
  const isComplexFraming = Boolean(framingGraph);
  const hasFilterComplexNeeds = isComplexFraming || Boolean((wmImageInput && wmImageOverlay) || resolvedOverlays.length > 0);

  if (hasFilterComplexNeeds) {
    const inputArgs = [
      '-y',
      '-ss', String(effectiveStartSec),
      '-i', activeSourceVideo
    ];

    let nextInputIdx = 1;
    let wmIdx = null;
    if (wmImageInput && wmImageOverlay) {
      inputArgs.push('-i', wmImageInput);
      wmIdx = nextInputIdx++;
    }

    const overlayInputs = [];
    for (let i = 0; i < resolvedOverlays.length; i++) {
      const ov = resolvedOverlays[i];
      inputArgs.push('-i', ov.imagePath);
      overlayInputs.push({
        ...ov,
        videoInputIdx: nextInputIdx++
      });
    }

    const sfxInputs = [];
    for (let i = 0; i < overlayInputs.length; i++) {
      const ov = overlayInputs[i];
      if (ov.soundEnabled !== false && ov.soundPath) {
        inputArgs.push('-i', ov.soundPath);
        sfxInputs.push({
          audioInputIdx: nextInputIdx++,
          startSec: Math.max(0, Number(ov.startSec) || 0)
        });
      }
    }

    inputArgs.push('-t', String(clipDuration));

    // Build filter complex
    const filterComplexParts = [];
    let vHead = 'v_base';

    if (isComplexFraming) {
      if (secondaryFilters.length > 0) {
        filterComplexParts.push(`${framingGraph};[v_framed]${secondaryFilters.join(',')}[v_base]`);
      } else {
        filterComplexParts.push(framingGraph.replace(/\[v_framed\]$/, '[v_base]'));
      }
    } else {
      const allLinear = [linearFramingFilter, ...secondaryFilters].filter(Boolean).join(',');
      filterComplexParts.push(`[0:v]${allLinear}[v_base]`);
    }

    // Composite Watermark if image
    if (wmIdx !== null) {
      filterComplexParts.push(`[${wmIdx}:v]scale=${wmImageOverlay.scaleW}:-1,format=rgba,colorchannelmixer=aa=${wmImageOverlay.opacity}[v_wm]`);
      filterComplexParts.push(`[${vHead}][v_wm]overlay=${wmImageOverlay.ovX}:${wmImageOverlay.ovY}[v_wm_out]`);
      vHead = 'v_wm_out';
    }

    // Composite Overlays
    for (let i = 0; i < overlayInputs.length; i++) {
      const ov = overlayInputs[i];
      const scaleFactor = Math.max(0.2, Math.min(1.0, Number(ov.scale) || 0.52));
      const scaleW = Math.round(targetW * scaleFactor);
      const ovStart = Math.max(0, Number(ov.startSec) || 0);
      const ovDur = Math.max(0.5, Number(ov.duration) || 2.0);
      const ovEnd = ovStart + ovDur;

      let posX = `(W-w)/2`;
      let posY = `(H-h)/2`;
      const pos = ov.position || 'center';
      if (pos === 'top-right') {
        posX = `W-w-50`;
        posY = `90`;
      } else if (pos === 'top-center') {
        posX = `(W-w)/2`;
        posY = `90`;
      } else if (pos === 'bottom-right') {
        posX = `W-w-50`;
        posY = `H-h-160`;
      } else if (pos === 'bottom-center') {
        posX = `(W-w)/2`;
        posY = `H-h-160`;
      } else if (pos === 'above-captions') {
        posX = `(W-w)/2`;
        posY = `H*0.62`;
      } else if (pos === 'fullscreen') {
        posX = `0`;
        posY = `0`;
      }

      filterComplexParts.push(`[${ov.videoInputIdx}:v]scale=${scaleW}:-1,format=rgba[ov_${i}_scaled]`);
      filterComplexParts.push(`[${vHead}][ov_${i}_scaled]overlay=${posX}:${posY}:enable='between(t,${ovStart.toFixed(2)},${ovEnd.toFixed(2)})'[v_step_${i}]`);
      vHead = `v_step_${i}`;
    }

    // Audio mixing for sound effects
    let hasAudioMix = false;
    if (sfxInputs.length > 0) {
      hasAudioMix = true;
      const sfxLabels = [];
      for (let k = 0; k < sfxInputs.length; k++) {
        const sfx = sfxInputs[k];
        const delayMs = Math.round(sfx.startSec * 1000);
        filterComplexParts.push(`[${sfx.audioInputIdx}:a]adelay=${delayMs}|${delayMs},volume=0.85[sfx_${k}]`);
        sfxLabels.push(`[sfx_${k}]`);
      }
      filterComplexParts.push(`[0:a]${sfxLabels.join('')}amix=inputs=${1 + sfxInputs.length}:duration=first:dropout_transition=2[outa]`);
    }

    ffmpegArgs = [
      ...inputArgs,
      '-filter_complex', filterComplexParts.join(';'),
      '-map', `[${vHead}]`,
      '-map', hasAudioMix ? '[outa]' : '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-threads', '2',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      mainOutputPath
    ];
  } else {
    const finalVf = [linearFramingFilter, ...secondaryFilters].filter(Boolean).join(',');
    ffmpegArgs = [
      '-y',
      '-ss', String(effectiveStartSec),
      '-i', activeSourceVideo,
      '-t', String(clipDuration),
      '-vf', finalVf,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-threads', '2',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      mainOutputPath
    ];
  }

  await runCommand('ffmpeg', ffmpegArgs, abortSignal, {
    clipTitle: clip.title,
    jobId: job.id,
    outputFile: outputFilename,
    duration: clipDuration
  });

  // If Hook Stitcher is enabled, render teaser snippet and concatenate to front of video
  if (isHookStitcher) {
    try {
      const teaser = findClimacticTeaser(job, startSec, endSec);
      const teaserFile = path.join(dir, `_teaser_${outputFilename}`);

      const cleanTeaserCrop = linearFramingFilter || `scale=${targetW}:${targetH}`;
      const teaserVf = `${cleanTeaserCrop},drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='⚡ WAIT TILL THE END 🤯':fontsize=52:fontcolor=yellow:box=1:boxcolor=black@0.75:boxborderw=16:x=(w-text_w)/2:y=140`;
      const teaserStart = activeSourceVideo === tempSlicePath 
        ? Math.max(0, teaser.start - startSec)
        : teaser.start;

      await runCommand('ffmpeg', [
        '-y',
        '-ss', String(teaserStart),
        '-i', activeSourceVideo,
        '-t', String(teaser.duration),
        '-vf', teaserVf,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-threads', '2',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        teaserFile
      ], abortSignal);

      const concatListFile = path.join(dir, `_concat_${clipIndexStr}.txt`);
      const file1 = teaserFile.replace(/\\/g, '/');
      const file2 = mainOutputPath.replace(/\\/g, '/');
      await fsp.writeFile(concatListFile, `file '${file1}'\nfile '${file2}'\n`, 'utf8');

      try {
        await runCommand('ffmpeg', [
          '-y', '-f', 'concat', '-safe', '0', '-i', concatListFile,
          '-c', 'copy', '-movflags', '+faststart', outputPath
        ], abortSignal);
      } catch (copyErr) {
        await runCommand('ffmpeg', [
          '-y', '-i', teaserFile, '-i', mainOutputPath,
          '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]',
          '-map', '[v]', '-map', '[a]',
          '-c:v', 'libx264', '-preset', 'veryfast', '-threads', '2', '-crf', '22', '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart', outputPath
        ], abortSignal);
      }

      try { await fsp.unlink(teaserFile); } catch {}
      try { await fsp.unlink(mainOutputPath); } catch {}
      try { await fsp.unlink(concatListFile); } catch {}
    } catch (teaserErr) {
      console.warn('Hook stitcher fallback, keeping main video:', teaserErr.message);
      if (fs.existsSync(mainOutputPath) && !fs.existsSync(outputPath)) {
        await fsp.rename(mainOutputPath, outputPath);
      }
    }
  }

  // Validate output MP4 exists and has non-zero size
  const stat = await fsp.stat(outputPath);
  if (stat.size === 0) throw new Error(`Rendered clip ${outputFilename} is empty.`);

  // Verify with FFprobe
  const probe = await getVideoInfo(outputPath);
  if (probe.duration <= 0) throw new Error(`Rendered clip ${outputFilename} has invalid duration.`);

  return {
    name: outputFilename,
    filePath: outputPath,
    size: stat.size,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    url: `/media/${encodeURIComponent(batchFolder)}/${encodeURIComponent(outputFilename)}`
  };
} finally {
  // Always cleanup temporary HD slice file even on error or crash
  if (tempSlicePath && fs.existsSync(tempSlicePath)) {
    try { await fsp.unlink(tempSlicePath); } catch {}
  }
  // Cleanup raw main output if Hook Stitcher was active and final file was written
  if (isHookStitcher && fs.existsSync(mainOutputPath) && fs.existsSync(outputPath)) {
    try { await fsp.unlink(mainOutputPath); } catch {}
  }
}
}

module.exports = {
  renderClip,
  getVideoInfo,
  runCommand
};
