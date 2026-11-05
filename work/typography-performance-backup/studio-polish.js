/* Presentation-only enhancements. Existing editing actions stay in app.js. */
(() => {
  'use strict';
  const video = document.getElementById('previewVideo');
  const container = document.getElementById('videoContainer');
  if (video && container) {
    const transport = document.createElement('div');
    transport.className = 'studio-transport';
    transport.setAttribute('role', 'group');
    transport.setAttribute('aria-label', 'Preview playback');
    const play = document.createElement('button');
    play.type = 'button';
    play.title = 'Play / pause · Space';
    const time = document.createElement('output');
    time.setAttribute('aria-label', 'Playback time');
    const mute = document.createElement('button');
    mute.type = 'button';
    const format = value => {
      const seconds = Number.isFinite(value) ? value : 0;
      return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${(seconds % 60).toFixed(1).padStart(4,'0')}`;
    };
    const sync = () => {
      play.textContent = video.paused ? '▶' : 'Ⅱ';
      play.setAttribute('aria-label', video.paused ? 'Play preview' : 'Pause preview');
      mute.textContent = video.muted ? '♪̸' : '♪';
      mute.setAttribute('aria-label', video.muted ? 'Unmute preview' : 'Mute preview');
      mute.setAttribute('aria-pressed', String(video.muted));
      time.value = `${format(video.currentTime)} / ${format(video.duration)}`;
      play.disabled = !video.currentSrc;
      transport.hidden = !video.currentSrc;
    };
    play.addEventListener('click', () => document.getElementById('togglePlayBtn')?.click());
    mute.addEventListener('click', () => { video.muted = !video.muted; });
    ['timeupdate','play','pause','volumechange','loadedmetadata','emptied'].forEach(event => video.addEventListener(event,sync));
    transport.append(play,time,mute);
    container.append(transport);
    // Native controls remain the fallback until custom controls are mounted.
    video.controls = false;
    sync();
  }

  // Make existing click-based preset cards available from the keyboard.
  const cards = '.template-card,.cps-preset-card,.framing-mode-card';
  const enhance = () => {
    document.querySelectorAll(cards).forEach(card => {
      if (card.tagName !== 'BUTTON') {
        card.tabIndex = 0;
        card.setAttribute('role','button');
        card.setAttribute('aria-pressed',String(card.classList.contains('active')));
      }
    });
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      const card = backdrop.querySelector('.modal-card');
      if (!card) return;
      card.setAttribute('role','dialog');
      card.setAttribute('aria-modal','true');
      const heading = card.querySelector('h2,h3');
      if (heading) card.setAttribute('aria-label',heading.textContent.trim());
    });
    document.querySelectorAll('.rail-btn').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  };
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches(cards) && event.target.tagName !== 'BUTTON') {
      event.preventDefault(); event.stopPropagation(); event.target.click();
    }
  });
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  enhance();

  // Use transcript timings for live caption rehearsal; never change export data.
  const phoneVideo = document.getElementById('cpsPhoneVideo');
  const phoneText = document.getElementById('cpsPhoneCaptionText');
  let lastCaptionKey = '';
  const syncPhoneWords = () => {
    if (!phoneVideo || !phoneText || document.getElementById('captionPhoneView').classList.contains('hidden')) return;
    const segments = typeof state !== 'undefined' ? state.currentJob?.transcript?.segments : null;
    if (!segments?.length) return; // Keep the existing style sample without a transcript.
    const t = phoneVideo.currentTime;
    const segment = segments.find(s => t >= s.start && t < s.end);
    if (!segment) { phoneText.replaceChildren(); lastCaptionKey = ''; return; }
    const timedWords = segment.words?.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end));
    // Segment-only transcripts use evenly spaced words for preview approximation.
    const words = timedWords?.length ? timedWords : String(segment.text || '').trim().split(/\s+/).filter(Boolean).map((word,i,all) => ({word,start:segment.start+i*(segment.end-segment.start)/all.length,end:segment.start+(i+1)*(segment.end-segment.start)/all.length}));
    const index = words.findIndex(w => t >= w.start && t < w.end);
    const mode = document.getElementById('cpsDisplayModeSelect').value;
    const active = Math.max(0,index);
    const start = mode === 'line' ? 0 : Math.floor(active / 3) * 3;
    const visible = mode === 'line' ? words : words.slice(start,start+3);
    const color = document.getElementById('cpsHighlightColor').value;
    const key = `${segment.start}:${active}:${mode}:${color}:${segment.text}`;
    if (key === lastCaptionKey) return;
    lastCaptionKey = key;
    phoneText.replaceChildren(...visible.flatMap((word,i) => {
      const span = document.createElement('span');
      span.textContent = word.word || word.text || '';
      if (start+i === active) { span.className = 'phone-highlight-word kinetic-active'; span.style.color = color; }
      return [span,document.createTextNode(' ')];
    }));
  };
  phoneVideo?.addEventListener('timeupdate',syncPhoneWords);
  phoneVideo?.addEventListener('seeked',syncPhoneWords);
  document.getElementById('cpsDisplayModeSelect')?.addEventListener('change',() => {lastCaptionKey='';syncPhoneWords();});
  document.getElementById('cpsHighlightColor')?.addEventListener('input',() => {lastCaptionKey='';syncPhoneWords();});
  document.getElementById('cpsOutlineRange')?.addEventListener('input',event => {
    phoneText.style.webkitTextStroke = `${Number(event.target.value)*.5}px #000`;
    document.getElementById('cpsOutlineValue').textContent = `${event.target.value}px`;
  });

  // Focus enters a dialog, stays inside it, and returns to its opening control.
  let openModal = null;
  let previousFocus = null;
  const focusable = modal => [...modal.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
  const modals = [...document.querySelectorAll('.modal-backdrop')];
  const updateModal = () => {
    const next = modals.filter(el => el.getClientRects().length).at(-1) || null;
    if (next === openModal) return;
    if (next) {
      if (!openModal) previousFocus = document.activeElement;
      openModal = next;
      focusable(next)[0]?.focus({preventScroll:true});
    } else {
      openModal = null;
      previousFocus?.focus({preventScroll:true});
    }
  };
  modals.forEach(modal => new MutationObserver(updateModal).observe(modal,{attributes:true,attributeFilter:['class','style']}));
  document.addEventListener('keydown', event => {
    if (!openModal) return;
    if (event.key === 'Escape') {
      openModal.querySelector('.modal-close')?.click();
      event.preventDefault();
    } else if (event.key === 'Tab') {
      const controls = focusable(openModal);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    event.stopPropagation();
  },true);
})();
