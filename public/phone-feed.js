/**
 * AUTOCLIPIN — Mobile Phone Feed Review System (TikTok / Reels Vertical Scroll)
 * Allows creators to swipe/scroll through discovered clips in a realistic 9:16 phone mockup.
 */

(function () {
  'use strict';

  let currentIndex = 0;
  let activeClip = null;
  let isScrolling = false;
  let playbackLoopTimer = null;
  let captionStyle = 'viral_pop';
  let controlsReady = false;

  const CAPTION_STYLES = {
    viral_pop: {
      name: 'Viral Pop (Hormozi)',
      color: '#ffe600',
      font: '"Montserrat", "Arial Black", sans-serif',
      uppercase: true
    },
    beast_neon: {
      name: 'MrBeast Electric',
      color: '#00ff88',
      font: '"Impact", "Arial Black", sans-serif',
      uppercase: true
    },
    clean_podcast: {
      name: 'Minimal Podcast',
      color: '#ffffff',
      font: 'Inter, system-ui, sans-serif',
      uppercase: false
    },
    cyber_neon: {
      name: 'Cyber Neon',
      color: '#00f0ff',
      font: '"JetBrains Mono", monospace',
      uppercase: true
    }
  };

  const GREEN_KEYWORDS = new Set([
    'money', 'cash', 'rich', 'dollar', 'dollars', 'profit', 'free', 'win', 'winning', 'winner', 'yes', 'easy', 'growth', 'gain', 'best', 'boost'
  ]);
  const RED_KEYWORDS = new Set([
    'never', 'worst', 'stop', 'hate', 'dead', 'died', 'kill', 'killed', 'fake', 'broke', 'danger', 'warning', 'lost', 'lose', 'failure', 'fail', 'no', 'wrong', 'banned', 'illegal', 'scam', 'terrible', 'horrible'
  ]);
  const GOLD_KEYWORDS = new Set([
    'insane', 'crazy', 'secret', 'truth', 'genius', 'god', 'goat', 'legend', 'champion', 'billionaire', 'millionaire', 'clutch', 'unbelievable', 'shocking', 'massive', 'huge', 'mindblown'
  ]);
  const CYAN_KEYWORDS = new Set([
    'ai', 'code', 'game', 'gaming', 'speed', 'future', 'robot', 'tech', 'online', 'hacker', 'stream'
  ]);

  const VIRAL_EMOJI_MAP = {
    fire: '🔥', lit: '🔥', hot: '🔥', crazy: '🤯', insane: '🤯', mindblown: '🤯',
    dead: '💀', died: '💀', skull: '💀', lol: '😂', laugh: '😂', funny: '🤣',
    truth: '💯', real: '💯', fact: '💯', money: '💰', cash: '💵', rich: '🤑',
    dollar: '💵', bag: '💰', win: '🏆', winner: '🏆', boss: '👑', king: '👑',
    goat: '🐐', legend: '⭐', flex: '💪', strong: '💪', danger: '⚠️', warning: '⚠️',
    alert: '🚨', game: '🎮', clutch: '🎯', ai: '🧠', brain: '🧠', speed: '⚡',
    hype: '⚡', run: '🏃', fly: '🚀', rocket: '🚀', secret: '🤫', quiet: '🤫',
    love: '❤️', heart: '❤️', chill: '🧊', party: '🎉'
  };

  function getDynamicWordColor(word, baseColor) {
    const clean = String(word || '').toLowerCase().replace(/[^a-z0-9$]/g, '');
    if (/^\$?\d+[%kmb]?$/i.test(clean)) return '#00FF66';
    if (RED_KEYWORDS.has(clean)) return '#FF3333';
    if (GOLD_KEYWORDS.has(clean)) return '#FFE600';
    if (GREEN_KEYWORDS.has(clean)) return '#00FF66';
    if (CYAN_KEYWORDS.has(clean)) return '#00F0FF';
    return baseColor;
  }

  function getWordEmoji(word) {
    const clean = String(word || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return VIRAL_EMOJI_MAP[clean] || '';
  }

  function getClips() {
    return (getStudioState()?.currentJob?.clips || []).slice();
  }

  // app.js keeps state in a global lexical binding, not a Window property.
  function getStudioState() {
    return typeof state === 'object' && state ? state : window.state;
  }

  function getSourceVideoUrl() {
    const job = getStudioState()?.currentJob;
    if (!job?.sourcePath) return '';
    const name = job.sourcePath.split(/[\\/]/).pop();
    return `/incoming/${encodeURIComponent(name)}`;
  }

  function initPhoneFeedReview() {
    const clips = getClips();
    const emptyState = document.getElementById('pfeedEmptyState');
    const mainWorkspace = document.getElementById('pfeedWorkspaceGrid');

    if (!clips || clips.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (mainWorkspace) mainWorkspace.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (mainWorkspace) mainWorkspace.classList.remove('hidden');

    const totalBadge = document.getElementById('pfeedTotalBadge');
    if (totalBadge) totalBadge.textContent = `${clips.length} Clips`;

    renderClipsQueue(clips);
    renderPhoneSlides(clips);

    // Initial selection
    const initialId = getStudioState()?.activeClipId;
    let initialIdx = clips.findIndex(c => c.id === initialId);
    if (initialIdx < 0) initialIdx = 0;

    scrollToClipIndex(initialIdx, false);
    setupKeyboardNavigation();
  }

  function renderClipsQueue(clips) {
    const list = document.getElementById('pfeedClipsScrollList');
    if (!list) return;

    list.innerHTML = clips.map((clip, i) => {
      const isHigh = (clip.score || 85) >= 88;
      const dur = Math.round(clip.end - clip.start);
      const startMin = Math.floor(clip.start / 60);
      const startSec = Math.floor(clip.start % 60);
      const timeStr = `${startMin}:${String(startSec).padStart(2, '0')}`;

      return `
        <div class="pfeed-nav-card ${i === currentIndex ? 'active' : ''}" data-index="${i}" data-clip-id="${clip.id}">
          <div class="pfeed-nav-card-top">
            <span class="pfeed-card-idx">#${String(i + 1).padStart(2, '0')}</span>
            <span class="pfeed-card-score ${isHigh ? 'high' : ''}">★ ${clip.score || 85}</span>
          </div>
          <div class="pfeed-card-title">${escapeHtml(clip.title || 'Candidate Clip')}</div>
          <div class="pfeed-card-meta">
            <span>⏱️ ${dur}s</span>
            <span>📍 ${timeStr}</span>
            ${clip.category ? `<span>· ${escapeHtml(clip.category)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.pfeed-nav-card').forEach(card => {
      card.onclick = () => {
        const idx = Number(card.dataset.index);
        scrollToClipIndex(idx, true);
      };
    });
  }

  function renderPhoneSlides(clips) {
    const viewport = document.getElementById('pfeedFeedViewport');
    if (!viewport) return;

    const videoSrc = getSourceVideoUrl();

    viewport.innerHTML = clips.map((clip, i) => {
      const isUltra = (clip.score || 85) >= 90;
      const dur = Math.round(clip.end - clip.start);

      return `
        <div class="pfeed-clip-slide" data-index="${i}" data-clip-id="${clip.id}">
          <video class="pfeed-slide-video" playsinline preload="auto" muted loop></video>
          
          <div class="pfeed-slide-hud">
            <div class="pfeed-hud-top">
              <span class="pfeed-hud-badge ${isUltra ? 'viral' : ''}">
                ${isUltra ? 'HIGH RETENTION' : 'CANDIDATE'}
              </span>
              <span class="pfeed-hud-badge" style="font-family: var(--pro-font-mono, monospace);">
                ${i + 1} / ${clips.length}
              </span>
            </div>

            <!-- Kinetic Word Subtitle Center Bubble -->
            <div class="pfeed-hud-captions">
              <div class="pfeed-caption-bubble" id="pfeedCap_${clip.id}">
                ${escapeHtml(clip.hook || clip.title || '')}
              </div>
            </div>

            <!-- Mobile Right Rails -->
            <div class="pfeed-hud-right-rail">
              <button type="button" class="pfeed-rail-action-btn" title="Retention Index">
                <div class="pfeed-action-circle" style="font-family: var(--pro-font-mono, monospace); font-size: 11px; font-weight: 800;">${clip.score || 88}</div>
                <span class="pfeed-action-label">Score</span>
              </button>

              <button type="button" class="pfeed-rail-action-btn" data-action="edit-timeline" title="Open in Studio Timeline">
                <div class="pfeed-action-circle">✂️</div>
                <span class="pfeed-action-label">Timeline</span>
              </button>

              <button type="button" class="pfeed-rail-action-btn" data-action="copy-hook" title="Copy Clip Title & Hook">
                <div class="pfeed-action-circle">📋</div>
                <span class="pfeed-action-label">Copy</span>
              </button>

              <button type="button" class="pfeed-rail-action-btn" data-action="render-single" title="Render Clip in 9:16">
                <div class="pfeed-action-circle" style="background: var(--pro-accent-amber, #e88d28); color: #000; font-weight: 800;">⚡</div>
                <span class="pfeed-action-label">Render</span>
              </button>
            </div>

            <!-- Bottom Creator Details -->
            <div class="pfeed-hud-bottom">
              <div class="pfeed-hud-author">
                <span>@autoclip</span>
                <span style="font-family: var(--pro-font-mono, monospace); font-size: 10px; color: var(--pro-accent-amber, #e88d28); background: rgba(232, 141, 40, 0.15); padding: 1px 6px; border-radius: 4px;">VERIFIED</span>
              </div>
              <div class="pfeed-hud-title">${escapeHtml(clip.title || '')}</div>
              <div class="pfeed-hud-sound">
                <span style="font-family: var(--pro-font-mono, monospace);">Original Audio · ${dur}s loop</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Setup action handlers
    viewport.querySelectorAll('[data-action="edit-timeline"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const slide = btn.closest('.pfeed-clip-slide');
        const clipId = slide?.dataset.clipId;
        if (clipId) jumpToStudioTimeline(clipId);
      };
    });

    viewport.querySelectorAll('[data-action="copy-hook"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const slide = btn.closest('.pfeed-clip-slide');
        const clipId = slide?.dataset.clipId;
        const clip = getClips().find(c => c.id === clipId);
        if (clip) {
          const text = `${clip.title}\n\n${clip.hook || ''}\n\n#shorts #viral #autoclip`;
          navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Title & Viral Hook copied to clipboard!');
          });
        }
      };
    });

    viewport.querySelectorAll('[data-action="render-single"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const slide = btn.closest('.pfeed-clip-slide');
        const clipId = slide?.dataset.clipId;
        if (clipId) renderSingleClip(clipId);
      };
    });

    // Feed scroll listener with debounce
    let scrollTimeout = null;
    viewport.onscroll = () => {
      if (isScrolling) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        detectCurrentSlide();
      }, 120);
    };
  }

  function detectCurrentSlide() {
    const viewport = document.getElementById('pfeedFeedViewport');
    if (!viewport) return;

    const slides = Array.from(viewport.querySelectorAll('.pfeed-clip-slide'));
    const scrollTop = viewport.scrollTop;
    const slideHeight = viewport.clientHeight || 1;

    const detectedIdx = Math.round(scrollTop / slideHeight);
    if (detectedIdx >= 0 && detectedIdx < slides.length && detectedIdx !== currentIndex) {
      scrollToClipIndex(detectedIdx, false);
    }
  }

  function scrollToClipIndex(idx, performScroll = true) {
    const clips = getClips();
    if (idx < 0 || idx >= clips.length) return;

    currentIndex = idx;
    activeClip = clips[idx];

    // Highlight left nav card
    const navCards = document.querySelectorAll('.pfeed-nav-card');
    navCards.forEach((c, i) => {
      c.classList.toggle('active', i === idx);
      if (i === idx) {
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Snap scroll phone viewport
    const viewport = document.getElementById('pfeedFeedViewport');
    if (viewport && performScroll) {
      const slideHeight = viewport.clientHeight;
      isScrolling = true;
      viewport.scrollTo({
        top: idx * slideHeight,
        behavior: 'smooth'
      });
      setTimeout(() => { isScrolling = false; }, 400);
    }

    // Play active clip video and stop others
    managePhoneVideoPlayback(activeClip, idx);

    // Update Right Inspector Panel
    updateInspector(activeClip, idx, clips.length);
  }

  function managePhoneVideoPlayback(clip, index) {
    if (!clip) return;
    clearInterval(playbackLoopTimer);

    const viewport = document.getElementById('pfeedFeedViewport');
    if (!viewport) return;

    const slides = viewport.querySelectorAll('.pfeed-clip-slide');
    const videoSrc = getSourceVideoUrl();

    slides.forEach((slide, i) => {
      const video = slide.querySelector('video');
      if (!video) return;

      if (i === index) {
        if (!videoSrc) return;
        video.onloadedmetadata = () => {
          video.currentTime = clip.start;
        };
        // Load source if missing
        if (!video.src || !video.src.includes(videoSrc)) {
          video.src = videoSrc;
          video.load();
        }

        video.currentTime = clip.start;
        video.muted = false; // unmuted on active phone review
        video.play().catch(() => {
          // Fallback to muted if browser blocks autoplay
          video.muted = true;
          video.play().catch(() => {});
        });

        // Loop control: restart when reaching clip.end
        video.ontimeupdate = () => {
          if (video.currentTime >= clip.end || video.currentTime < clip.start - 0.5) {
            video.currentTime = clip.start;
          }
          renderDynamicCaption(clip, video.currentTime);
        };
      } else {
        video.pause();
        video.removeAttribute('src'); // Free memory
      }
    });
  }

  function getClipTranscriptWords(clip) {
    const segments = getStudioState()?.currentJob?.transcript?.segments;
    if (!Array.isArray(segments)) return null;
    const clipStart = Number(clip.start) || 0;
    const clipEnd = Number(clip.end) || 30;
    const words = [];
    for (const seg of segments) {
      if (seg.words && seg.words.length > 0) {
        for (const w of seg.words) {
          if (w.end >= clipStart && w.start <= clipEnd) {
            words.push({ word: w.word, start: w.start, end: w.end });
          }
        }
      } else if (seg.end >= clipStart && seg.start <= clipEnd) {
        const segWords = seg.text.trim().split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.1, seg.end - seg.start);
        const wordDur = segWords.length > 0 ? segDur / segWords.length : 0.4;
        for (let i = 0; i < segWords.length; i++) {
          const wStart = seg.start + (i * wordDur);
          const wEnd = wStart + wordDur;
          if (wEnd >= clipStart && wStart <= clipEnd) {
            words.push({ word: segWords[i], start: wStart, end: wEnd });
          }
        }
      }
    }
    return words.length > 0 ? words : null;
  }

  function renderDynamicCaption(clip, currentTime) {
    const capEl = document.getElementById(`pfeedCap_${clip.id}`);
    if (!capEl) return;

    const style = CAPTION_STYLES[captionStyle] || CAPTION_STYLES.viral_pop;
    const transcriptWords = getClipTranscriptWords(clip);

    if (transcriptWords && transcriptWords.length > 0) {
      // Find active 3-word phrase
      const groupSize = 3;
      let activeGroup = null;
      let activeWordIdx = -1;

      for (let i = 0; i < transcriptWords.length; i += groupSize) {
        const group = transcriptWords.slice(i, i + groupSize);
        const gStart = group[0].start;
        const gEnd = group[group.length - 1].end;
        if (currentTime >= gStart - 0.1 && currentTime <= gEnd + 0.3) {
          activeGroup = group;
          for (let j = 0; j < group.length; j++) {
            if (currentTime >= group[j].start && (currentTime < group[j].end || j === group.length - 1)) {
              activeWordIdx = j;
              break;
            }
          }
          if (activeWordIdx === -1) activeWordIdx = 0;
          break;
        }
      }

      if (activeGroup) {
        capEl.innerHTML = activeGroup.map((item, idx) => {
          let text = style.uppercase ? item.word.toUpperCase() : item.word;
          const emoji = getWordEmoji(item.word);
          if (emoji) text += ` ${emoji}`;
          if (idx === activeWordIdx) {
            const wordColor = getDynamicWordColor(item.word, style.color);
            return `<span class="pop-word" style="color: ${wordColor}; text-shadow: 0 0 16px ${wordColor}AA;">${escapeHtml(text)}</span>`;
          }
          return `<span>${escapeHtml(text)}</span>`;
        }).join(' ');
        capEl.style.fontFamily = style.font;
        return;
      }
    }

    // Fallback: Animated title/hook words
    const text = (clip.hook || clip.title || 'AUTOCLIP').trim();
    const words = text.split(/\s+/);

    if (words.length <= 1) {
      capEl.textContent = text;
      capEl.style.fontFamily = style.font;
      return;
    }

    const dur = Math.max(1, clip.end - clip.start);
    const progress = Math.max(0, Math.min(1, (currentTime - clip.start) / dur));
    const activeWordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

    capEl.innerHTML = words.map((w, i) => {
      let wordText = style.uppercase ? w.toUpperCase() : w;
      const emoji = getWordEmoji(w);
      if (emoji) wordText += ` ${emoji}`;
      if (i === activeWordIdx) {
        const wordColor = getDynamicWordColor(w, style.color);
        return `<span class="pop-word" style="color: ${wordColor}; text-shadow: 0 0 16px ${wordColor}AA;">${escapeHtml(wordText)}</span>`;
      }
      return `<span>${escapeHtml(wordText)}</span>`;
    }).join(' ');

    capEl.style.fontFamily = style.font;
  }

  function updateInspector(clip, index, total) {
    if (!clip) return;

    const titleInput = document.getElementById('pfeedClipTitleInput');
    if (titleInput) {
      titleInput.value = clip.title || '';
      titleInput.oninput = () => {
        clip.title = titleInput.value;
        const navTitle = document.querySelector(`.pfeed-nav-card[data-index="${index}"] .pfeed-card-title`);
        if (navTitle) navTitle.textContent = clip.title;
        const hudTitle = document.querySelector(`.pfeed-clip-slide[data-index="${index}"] .pfeed-hud-title`);
        if (hudTitle) hudTitle.textContent = clip.title;
        // Save to global state
        if (window.saveClipsToServer) window.saveClipsToServer();
      };
    }

    // Metrics
    const mTwist = document.getElementById('pfeedMetricTwist');
    const mAudio = document.getElementById('pfeedMetricAudio');
    const mArousal = document.getElementById('pfeedMetricArousal');
    const mPacing = document.getElementById('pfeedMetricPacing');

    const beast = clip.beast || {};
    if (mTwist) mTwist.textContent = `${beast.twist ?? 22}/25`;
    if (mAudio) mAudio.textContent = `${beast.audioSurge ?? 23}/25`;
    if (mArousal) mArousal.textContent = `${beast.arousal ?? 24}/25`;
    if (mPacing) mPacing.textContent = `${beast.pacing ?? 21}/25`;

    // Nudge controls
    setupNudgeButtons(clip, index);
  }

  function setupNudgeButtons(clip, index) {
    const btnStartMinus = document.getElementById('pfeedNudgeStartMinus');
    const btnStartPlus = document.getElementById('pfeedNudgeStartPlus');
    const btnEndMinus = document.getElementById('pfeedNudgeEndMinus');
    const btnEndPlus = document.getElementById('pfeedNudgeEndPlus');

    if (btnStartMinus) btnStartMinus.onclick = () => nudge(clip, -1, 0, index);
    if (btnStartPlus) btnStartPlus.onclick = () => nudge(clip, 1, 0, index);
    if (btnEndMinus) btnEndMinus.onclick = () => nudge(clip, 0, -1, index);
    if (btnEndPlus) btnEndPlus.onclick = () => nudge(clip, 0, 1, index);
  }

  function nudge(clip, dStart, dEnd, index) {
    clip.start = Math.max(0, Number((clip.start + dStart).toFixed(2)));
    clip.end = Math.max(clip.start + 5, Number((clip.end + dEnd).toFixed(2)));

    managePhoneVideoPlayback(clip, index);
    if (window.saveClipsToServer) window.saveClipsToServer();
    showToast(`⏱️ Adjusted: ${clip.start}s - ${clip.end}s (${Math.round(clip.end - clip.start)}s)`);
  }

  function jumpToStudioTimeline(clipId) {
    if (typeof window.selectClip === 'function') {
      window.selectClip(clipId, true);
    }
    if (typeof window.switchAppView === 'function') {
      window.switchAppView('studio');
    }
  }

  function renderSingleClip(clipId) {
    const clip = getClips().find(c => c.id === clipId);
    if (!clip) return;

    if (typeof window.startRenderSingleClip === 'function') {
      window.startRenderSingleClip(clip);
    } else {
      // Use the editor's real export path, including current caption/framing options
      // and quota/error handling. The render API does not support clipIds.
      const scope = document.querySelector('.manual-export-scope');
      const render = document.getElementById('renderBtn');
      if (!scope || !render || render.disabled || typeof window.getEditorExportClips !== 'function') {
        showToast('Open the editor to export this clip.', true);
        return;
      }
      window.selectClip?.(clipId, false);
      window.switchAppView?.('studio');
      const previous = scope.value;
      try {
        scope.value = 'active';
        render.click();
      } finally {
        scope.value = previous;
      }
    }
  }

  function setupKeyboardNavigation() {
    if (controlsReady) return;
    controlsReady = true;
    window.addEventListener('keydown', (e) => {
      // Only handle if phone review feed is currently visible
      const view = document.getElementById('phoneFeedView');
      if (!view || view.classList.contains('hidden')) return;

      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToClipIndex(currentIndex + 1, true);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToClipIndex(currentIndex - 1, true);
      }
    });

    // Floating step buttons
    const btnPrev = document.getElementById('btnPhoneFeedPrev');
    const btnNext = document.getElementById('btnPhoneFeedNext');
    if (btnPrev) btnPrev.onclick = () => scrollToClipIndex(currentIndex - 1, true);
    if (btnNext) btnNext.onclick = () => scrollToClipIndex(currentIndex + 1, true);

    // Caption style pills
    document.querySelectorAll('.pfeed-style-pill-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pfeed-style-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        captionStyle = btn.dataset.style || 'viral_pop';
        if (activeClip) {
          const video = document.querySelector('.pfeed-clip-slide.active video');
          renderDynamicCaption(activeClip, video?.currentTime || activeClip.start);
        }
      };
    });

    // Back to Studio button
    const backBtn = document.getElementById('pfeedBackToStudioBtn');
    if (backBtn) {
      backBtn.onclick = () => {
        if (typeof window.switchAppView === 'function') {
          window.switchAppView('studio');
        }
      };
    }
  }

  function showToast(msg, isErr = false) {
    let toast = document.getElementById('pfeedToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pfeedToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        background: rgba(15, 20, 30, 0.95);
        color: #fff;
        border: 1px solid rgba(255, 140, 0, 0.4);
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        z-index: 99999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        pointer-events: none;
        transition: opacity 0.25s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.borderColor = isErr ? '#ef4444' : '#ff9900';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2600);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Export to global scope
  window.initPhoneFeedReview = initPhoneFeedReview;
  window.scrollToClipIndex = scrollToClipIndex;

})();
