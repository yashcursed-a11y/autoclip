// AUTOCLIP Studio Application Logic
let state = {
  templates: [],
  captionPresets: [],
  framingPresets: [],
  aspectRatios: {},
  jobs: [],
  settings: {},
  system: {},
  selectedTemplate: 'viral',
  activeTab: 'file',
  currentJob: null,
  activeClipId: null,
  mode: 'quick', // 'quick' | 'editor'
  activeSubtab: 'captions',
  loopActive: true,
  safeZoneVisible: false,
  framing: {
    mode: 'adaptive',
    aspectRatio: '9:16',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    bgColor: '#000000'
  },
  watermark: {
    enabled: false,
    type: 'text',
    text: '@autoclip',
    position: 'top-right',
    fontSize: 36,
    color: '#ffffff',
    opacity: 85,
    box: true,
    imagePath: '',
    imageUrl: '',
    imageScale: 20,
    xPercent: 92,
    yPercent: 6,
    isCustomPos: false
  },
  scheduler: {
    activeView: 'studio',
    subTab: 'compose',
    accounts: [],
    selectedAccountIds: [],
    availableClips: [],
    selectedClip: null,
    posts: [],
    queueFilter: 'all'
  }
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

async function api(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({ error: 'Unexpected response' }));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 1. Initialization
(async function init() {
  try {
    const boot = await api('/api/bootstrap');
    state = { ...state, ...boot };

    renderTemplates();
    renderJobs();
    updateHeaderStatus();
    setupClipCountPills();
    setupWatermarkControls();
    setupFramingControls();
    setupSchedulerControls();
    setupAutoPilotControls();
    setupAdvancedDiscoveryControls();
    setupOverlayManager();
    setupCinemaWatcher();
    setupBatchDripModal();
    setupStreamPartsUI();
    setupProcessesAndDiagnostics();
    setupCanvasQuickBar();
    setupGamingAndPodcastControls();
    setupCapCutShortcuts();
    setupPhoneCaptionStudio();
    setupLicensingUI();
    setupConnectionHelpUI();
    setupAiMcpUI();
    setupMaxAutomateUI();
    document.dispatchEvent(new Event('autoclip-ready'));

    // Setup drag and drop
    setupDragAndDrop();

    // Load recent valid job if present
    const validJob = state.jobs.find(j => (j.status === 'ready' || j.status === 'complete') && j.sourcePath);
    if (validJob) {
      showJob(validJob, false);
    } else {
      window.switchAppView('ingest');
    }

    // Auto-switch to accounts view if redirected from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('youtube') === 'connected' || params.get('drive') === 'connected' || params.get('accountId')) {
      if (typeof window.switchAppView === 'function') {
        window.switchAppView('scheduler');
        window.switchSchedulerSubTab('accounts');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (err) {
    $('#message').textContent = `Init error: ${err.message}`;
  }
})();

function updateHeaderStatus() {
  const driveBadge = $('#driveBadge');
  const geminiBadge = $('#geminiBadge');
  const sysBtn = $('#sysStatusBtn');

  if (state.driveConnected) {
    driveBadge.textContent = 'Drive Connected';
    driveBadge.className = 'pill-btn pill-drive connected';
  } else if (state.oauthConfigured) {
    driveBadge.textContent = 'Connect Drive';
    driveBadge.className = 'pill-btn pill-drive';
  } else {
    driveBadge.textContent = 'Drive Setup';
    driveBadge.className = 'pill-btn pill-drive';
  }

  const ytBadge = $('#youtubeBadge');
  if (ytBadge) {
    if (state.driveConnected) {
      ytBadge.textContent = '▶️ YouTube Linked';
      ytBadge.style.background = '#27ae60';
      ytBadge.style.borderColor = '#2ecc71';
      ytBadge.style.color = '#fff';
    } else {
      ytBadge.textContent = '▶️ Link YouTube';
      ytBadge.style.background = 'rgba(255, 0, 0, 0.15)';
      ytBadge.style.borderColor = 'rgba(255, 0, 0, 0.4)';
      ytBadge.style.color = '#ff5555';
    }
  }

  if (state.settings?.geminiApiKey || state.system?.gemini?.configured) {
    geminiBadge.textContent = 'Gemini AI Active';
    geminiBadge.className = 'pill-btn pill-gemini connected';
  } else {
    geminiBadge.textContent = 'Add Gemini Key';
    geminiBadge.className = 'pill-btn pill-gemini';
  }

  const ffmpegOk = state.system?.ffmpeg?.available;
  const whisperOk = state.system?.whisper?.available;
  if (ffmpegOk && whisperOk) {
    sysBtn.textContent = 'System: Ready';
    sysBtn.className = 'pill-btn pill-sys connected';
  } else {
    sysBtn.textContent = 'System: Check Needed';
    sysBtn.className = 'pill-btn pill-sys danger';
  }
}

// 2. Templates Rendering
function renderTemplates() {
  const container = $('#templates');
  container.innerHTML = state.templates.map(t => `
    <div class="template-card ${t.id === state.selectedTemplate ? 'active' : ''}" data-template="${t.id}">
      <div>
        <strong>${t.name}</strong>
        <small>${t.description}</small>
      </div>
      <div style="margin-top: 8px;">
        <span class="keyword-tag" style="background:#fff; border-color:${t.color};">${t.length}s target</span>
      </div>
    </div>
  `).join('');

  $$('.template-card').forEach(card => {
    card.onclick = () => {
      state.selectedTemplate = card.dataset.template;
      const t = state.templates.find(x => x.id === state.selectedTemplate);
      if (t) {
        $('#clipLength').value = t.length;
      }
      $('#customWrap').classList.toggle('hidden', state.selectedTemplate !== 'custom');
      renderTemplates();
    };
  });
}

// 3. Source Selection & Drag and Drop
function setupDragAndDrop() {
  const dropZone = $('#dropZone');
  const fileInput = $('#videoFile');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      fileInput.files = files;
      $('#fileName').textContent = `${files[0].name} (${(files[0].size / (1024 * 1024)).toFixed(1)} MB)`;
    }
  });

  fileInput.onchange = e => {
    const f = e.target.files[0];
    $('#fileName').textContent = f ? `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)` : 'No file selected';
  };

  $$('.tab').forEach(b => {
    b.onclick = () => {
      state.activeTab = b.dataset.tab;
      $$('.tab').forEach(x => x.classList.toggle('active', x === b));
      $('#filePane').classList.toggle('hidden', state.activeTab !== 'file');
      $('#urlPane').classList.toggle('hidden', state.activeTab !== 'url');
      $('#maxPane')?.classList.toggle('hidden', state.activeTab !== 'max');
    };
  });
}

function getJobOptions() {
  const targetLen = Math.max(20, Number($('#clipLength').value) || 35);
  return {
    ratingSystem: $('#activeRatingSystemSelect')?.value || 'hollywood',
    templateId: state.selectedTemplate,
    customBrief: $('#customBrief').value.trim(),
    clipCount: Number($('#clipCount').value),
    clipLength: targetLen,
    minDuration: 20, // Strict minimum 20 seconds limit
    minScore: Number($('#advMinScore')?.value || 80),
    hookSensitivity: $('#advHookSensitivity')?.value || 'aggressive',
    energyBias: $('#advEnergyBias')?.value || 'auto',
    strictBoundaries: $('#advStrictBoundaries')?.checked !== false,
    filterDeadAir: $('#advFilterDeadAir')?.checked !== false,
    nicheKeywords: ($('#advNicheKeywords')?.value || '').trim(),
    autoMemes: $('#advAutoMemes')?.checked !== false,
    streamQuality: $('#streamQuality')?.value || 'turbo',
    targetPlatform: $('#targetPlatform').value,
    aspectRatio: state.framing?.aspectRatio || $('#aspectRatio').value,
    captionPreset: $('#captionPresetSelect').value,
    framingMode: state.framing?.mode || $('#framingPresetSelect').value,
    zoom: Number(state.framing?.zoom) || 1.0,
    panX: Number(state.framing?.panX) || 0,
    panY: Number(state.framing?.panY) || 0,
    bgColor: state.framing?.bgColor || '#000000',
    whisperModel: $('#whisperModelSelect').value,
    language: $('#languageSelect').value,
    uploadOriginalToDrive: $('#uploadOriginalDrive').checked,
    uploadToDrive: $('#uploadDrive').checked,
    trashOriginalInDrive: $('#trashDriveOriginal').checked,
    deleteOriginalAfterSuccess: $('#cleanupLocal').checked,
    watermark: getWatermarkOptions()
  };
}

// Clip count pills setup
function setupClipCountPills() {
  const input = $('#clipCount');
  const pills = $$('.clip-count-pills .count-pill');
  if (!input || !pills.length) return;

  pills.forEach(p => {
    p.onclick = () => {
      const val = Number(p.dataset.val);
      if (!isNaN(val)) {
        input.value = val;
        pills.forEach(x => x.classList.toggle('active', x === p));
      }
    };
  });

  input.oninput = () => {
    const val = Number(input.value);
    pills.forEach(x => x.classList.toggle('active', Number(x.dataset.val) === val));
  };
}

// Watermark system setup
function setupWatermarkControls() {
  const enableMain = $('#enableWatermark');
  const enableEdit = $('#editWmEnabled');
  const typeSwitch = $('#wmTypeSwitch');
  const bodyMain = $('#watermarkBody');
  const tabs = $$('.wm-tab');
  const textSection = $('#wmTextSection');
  const imageSection = $('#wmImageSection');

  const onToggle = (checked) => {
    state.watermark.enabled = checked;
    if (enableMain) enableMain.checked = checked;
    if (enableEdit) enableEdit.checked = checked;
    if (typeSwitch) typeSwitch.classList.toggle('hidden', !checked);
    if (bodyMain) bodyMain.classList.toggle('hidden', !checked);
    updateLiveWatermarkPreview();
  };

  if (enableMain) enableMain.onchange = e => onToggle(e.target.checked);
  if (enableEdit) enableEdit.onchange = e => onToggle(e.target.checked);

  const setType = (type) => {
    state.watermark.type = type;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.wmtype === type));
    if (textSection) textSection.classList.toggle('hidden', type !== 'text');
    if (imageSection) imageSection.classList.toggle('hidden', type !== 'image');
    if ($('#editWmType')) $('#editWmType').value = type;
    if ($('#editWmTextWrap')) $('#editWmTextWrap').classList.toggle('hidden', type !== 'text');
    if ($('#editWmImageWrap')) $('#editWmImageWrap').classList.toggle('hidden', type !== 'image');
    syncModalScaleConfig();
    updateLiveWatermarkPreview();
  };

  tabs.forEach(t => {
    t.onclick = () => setType(t.dataset.wmtype);
  });

  if ($('#editWmType')) {
    $('#editWmType').onchange = e => setType(e.target.value);
  }

  const onTextChange = (text) => {
    state.watermark.text = text;
    if ($('#watermarkTextInput') && $('#watermarkTextInput').value !== text) $('#watermarkTextInput').value = text;
    if ($('#editWmText') && $('#editWmText').value !== text) $('#editWmText').value = text;
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkTextInput')) $('#watermarkTextInput').oninput = e => onTextChange(e.target.value);
  if ($('#editWmText')) $('#editWmText').oninput = e => onTextChange(e.target.value);

  const onFontSize = (val) => {
    state.watermark.fontSize = Number(val);
    if ($('#wmFontSizeLabel')) $('#wmFontSizeLabel').textContent = `${val}px`;
    if ($('#editWmSizeVal')) $('#editWmSizeVal').textContent = `${val}px`;
    if ($('#watermarkFontSize')) $('#watermarkFontSize').value = val;
    if ($('#editWmSize')) $('#editWmSize').value = val;
    if (state.watermark.type !== 'image') {
      if ($('#wmModalSize')) $('#wmModalSize').value = val;
      if ($('#wmModalSizeVal')) $('#wmModalSizeVal').textContent = `${val}px`;
    }
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkFontSize')) $('#watermarkFontSize').oninput = e => onFontSize(e.target.value);
  if ($('#editWmSize')) $('#editWmSize').oninput = e => onFontSize(e.target.value);

  const onScale = (sc) => {
    state.watermark.imageScale = Number(sc);
    if ($('#wmScaleLabel')) $('#wmScaleLabel').textContent = `${sc}%`;
    if ($('#watermarkImageScale')) $('#watermarkImageScale').value = sc;
    if (state.watermark.type === 'image') {
      if ($('#wmModalSize')) $('#wmModalSize').value = sc;
      if ($('#wmModalSizeVal')) $('#wmModalSizeVal').textContent = `${sc}%`;
    }
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkImageScale')) $('#watermarkImageScale').oninput = e => onScale(e.target.value);

  // Zoom / Scale helper for both text & logo
  const zoomWatermark = (delta) => {
    if (state.watermark.type === 'image') {
      const current = Number(state.watermark.imageScale || 22);
      const next = Math.max(5, Math.min(80, Math.round(current + delta)));
      onScale(next);
    } else {
      const current = Number(state.watermark.fontSize || 36);
      const next = Math.max(12, Math.min(120, Math.round(current + delta)));
      onFontSize(next);
    }
  };

  // Zoom nudger buttons
  if ($('#wmFontDown')) $('#wmFontDown').onclick = () => onFontSize(Math.max(16, (state.watermark.fontSize || 36) - 4));
  if ($('#wmFontUp')) $('#wmFontUp').onclick = () => onFontSize(Math.min(120, (state.watermark.fontSize || 36) + 4));
  if ($('#wmScaleDown')) $('#wmScaleDown').onclick = () => onScale(Math.max(5, (state.watermark.imageScale || 22) - 3));
  if ($('#wmScaleUp')) $('#wmScaleUp').onclick = () => onScale(Math.min(80, (state.watermark.imageScale || 22) + 3));
  if ($('#editWmSizeDown')) $('#editWmSizeDown').onclick = () => zoomWatermark(-3);
  if ($('#editWmSizeUp')) $('#editWmSizeUp').onclick = () => zoomWatermark(+3);
  if ($('#wmModalZoomDown')) $('#wmModalZoomDown').onclick = () => zoomWatermark(-3);
  if ($('#wmModalZoomUp')) $('#wmModalZoomUp').onclick = () => zoomWatermark(+3);
  if ($('#wmModalOpDown')) $('#wmModalOpDown').onclick = () => onOpacity(Math.max(20, (state.watermark.opacity || 85) - 5));
  if ($('#wmModalOpUp')) $('#wmModalOpUp').onclick = () => onOpacity(Math.min(100, (state.watermark.opacity || 85) + 5));

  const onColor = (color) => {
    state.watermark.color = color;
    if ($('#watermarkColor')) $('#watermarkColor').value = color;
    if ($('#editWmColor')) $('#editWmColor').value = color;
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkColor')) $('#watermarkColor').oninput = e => onColor(e.target.value);
  if ($('#editWmColor')) $('#editWmColor').oninput = e => onColor(e.target.value);

  const onBox = (checked) => {
    state.watermark.box = checked;
    if ($('#watermarkBox')) $('#watermarkBox').checked = checked;
    if ($('#editWmBox')) $('#editWmBox').checked = checked;
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkBox')) $('#watermarkBox').onchange = e => onBox(e.target.checked);
  if ($('#editWmBox')) $('#editWmBox').onchange = e => onBox(e.target.checked);

  const PRESET_COORDS = {
    'top-right': { x: 92, y: 6, label: 'Top Right' },
    'top-left': { x: 8, y: 6, label: 'Top Left' },
    'top-center': { x: 50, y: 6, label: 'Top Center' },
    'center': { x: 50, y: 50, label: 'Center' },
    'above-captions': { x: 50, y: 68, label: 'Above Captions' },
    'bottom-right': { x: 92, y: 90, label: 'Bottom Right' },
    'bottom-left': { x: 8, y: 90, label: 'Bottom Left' }
  };

  const setWatermarkCoordinates = (x, y, fromPreset = false) => {
    const clampedX = Math.max(4, Math.min(96, Math.round(x)));
    const clampedY = Math.max(4, Math.min(96, Math.round(y)));
    
    state.watermark.xPercent = clampedX;
    state.watermark.yPercent = clampedY;

    if (!fromPreset) {
      state.watermark.isCustomPos = true;
      state.watermark.position = 'custom';
      if ($('#watermarkPosition')) $('#watermarkPosition').value = 'custom';
      if ($('#editWmPos')) $('#editWmPos').value = 'custom';
    }

    // Update modal screen target position
    const target = $('#wmDraggableTarget');
    if (target) {
      target.style.left = `${clampedX}%`;
      target.style.top = `${clampedY}%`;
    }

    // Update modal sliders and indicators
    if ($('#wmRangeX')) $('#wmRangeX').value = clampedX;
    if ($('#wmRangeY')) $('#wmRangeY').value = clampedY;
    if ($('#wmCoordXVal')) $('#wmCoordXVal').textContent = `${clampedX}%`;
    if ($('#wmCoordYVal')) $('#wmCoordYVal').textContent = `${clampedY}%`;
    if ($('#wmScreenPillX')) $('#wmScreenPillX').textContent = `${clampedX}%`;
    if ($('#wmScreenPillY')) $('#wmScreenPillY').textContent = `${clampedY}%`;

    const label = fromPreset && PRESET_COORDS[state.watermark.position]
      ? `${PRESET_COORDS[state.watermark.position].label} (${clampedX}%, ${clampedY}%)`
      : `Custom (${clampedX}%, ${clampedY}%)`;

    if ($('#wmCoordText')) $('#wmCoordText').textContent = label;
    if ($('#editWmCoordText')) $('#editWmCoordText').textContent = label;

    updateLiveWatermarkPreview();
  };

  const onPosition = (pos) => {
    state.watermark.position = pos;
    if ($('#watermarkPosition')) $('#watermarkPosition').value = pos;
    if ($('#editWmPos')) $('#editWmPos').value = pos;

    if (PRESET_COORDS[pos]) {
      state.watermark.isCustomPos = false;
      setWatermarkCoordinates(PRESET_COORDS[pos].x, PRESET_COORDS[pos].y, true);
    } else {
      updateLiveWatermarkPreview();
    }
  };
  if ($('#watermarkPosition')) $('#watermarkPosition').onchange = e => onPosition(e.target.value);
  if ($('#editWmPos')) $('#editWmPos').onchange = e => onPosition(e.target.value);

  const onOpacity = (op) => {
    state.watermark.opacity = Number(op);
    if ($('#wmOpacityLabel')) $('#wmOpacityLabel').textContent = `${op}%`;
    if ($('#editWmOpacityVal')) $('#editWmOpacityVal').textContent = `${op}%`;
    if ($('#wmModalOpacityVal')) $('#wmModalOpacityVal').textContent = `${op}%`;
    if ($('#watermarkOpacity')) $('#watermarkOpacity').value = op;
    if ($('#editWmOpacity')) $('#editWmOpacity').value = op;
    if ($('#wmModalOpacity')) $('#wmModalOpacity').value = op;
    updateLiveWatermarkPreview();
  };
  if ($('#watermarkOpacity')) $('#watermarkOpacity').oninput = e => onOpacity(e.target.value);
  if ($('#editWmOpacity')) $('#editWmOpacity').oninput = e => onOpacity(e.target.value);
  if ($('#wmModalOpacity')) $('#wmModalOpacity').oninput = e => onOpacity(e.target.value);

  function syncModalScaleConfig() {
    const isImage = state.watermark.type === 'image';
    const header = $('#wmModalScaleHeader');
    const slider = $('#wmModalSize');
    const label = $('#wmModalSizeVal');
    const bgRemWrap = $('#wmModalBgRemWrap');

    if (isImage) {
      if (header) header.textContent = 'Logo Zoom / Scale';
      if (slider) {
        slider.min = '5';
        slider.max = '80';
        slider.value = state.watermark.imageScale || 22;
      }
      if (label) label.textContent = `${state.watermark.imageScale || 22}%`;
      if (bgRemWrap) bgRemWrap.classList.toggle('hidden', !state.watermark.imagePath);
    } else {
      if (header) header.textContent = 'Font Size / Zoom';
      if (slider) {
        slider.min = '12';
        slider.max = '120';
        slider.value = state.watermark.fontSize || 36;
      }
      if (label) label.textContent = `${state.watermark.fontSize || 36}px`;
      if (bgRemWrap) bgRemWrap.classList.add('hidden');
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('watermark', file);
    try {
      const res = await api('/api/watermark/upload', { method: 'POST', body: fd });
      state.watermark.imagePath = res.filePath;
      state.watermark.imageUrl = res.url;
      if ($('#wmImagePreviewContainer')) $('#wmImagePreviewContainer').classList.remove('hidden');
      if ($('#wmImageThumb')) {
        $('#wmImageThumb').src = res.url;
        $('#wmImageThumb').classList.add('has-checkerboard');
      }
      if ($('#wmImageName')) $('#wmImageName').textContent = res.filename;

      if ($('#editWmThumbRow')) $('#editWmThumbRow').classList.remove('hidden');
      if ($('#editWmThumb')) {
        $('#editWmThumb').src = res.url;
        $('#editWmThumb').classList.add('has-checkerboard');
      }
      if ($('#editWmThumbName')) $('#editWmThumbName').textContent = res.filename;

      syncModalScaleConfig();
      updateLiveWatermarkPreview();
    } catch (err) {
      alert(`Logo upload failed: ${err.message}`);
    }
  };

  if ($('#watermarkFileInput')) {
    $('#watermarkFileInput').onchange = e => handleUpload(e.target.files[0]);
  }
  if ($('#editWmFile')) {
    $('#editWmFile').onchange = e => handleUpload(e.target.files[0]);
  }

  if ($('#clearWmImageBtn')) {
    $('#clearWmImageBtn').onclick = () => {
      state.watermark.imagePath = '';
      state.watermark.imageUrl = '';
      if ($('#wmImagePreviewContainer')) $('#wmImagePreviewContainer').classList.add('hidden');
      if ($('#editWmThumbRow')) $('#editWmThumbRow').classList.add('hidden');
      if ($('#watermarkFileInput')) $('#watermarkFileInput').value = '';
      if ($('#editWmFile')) $('#editWmFile').value = '';
      syncModalScaleConfig();
      updateLiveWatermarkPreview();
    };
  }

  // --- Background Remover (Solid background removal to transparent PNG) ---
  const bgRemState = {
    mode: 'auto',
    tolerance: 35,
    keyColor: '#ffffff'
  };

  // Toggle Background Remover Panel
  if ($('#removeBgBtn')) {
    $('#removeBgBtn').onclick = () => {
      const panel = $('#bgRemoverPanel');
      if (panel) panel.classList.toggle('hidden');
    };
  }

  // Mode buttons inside panel
  $$('.bg-mode-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.bg-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bgRemState.mode = btn.dataset.mode || 'auto';
      if (btn.dataset.color) bgRemState.keyColor = btn.dataset.color;
    };
  });

  // Tolerance slider
  if ($('#bgTolRange')) {
    $('#bgTolRange').oninput = e => {
      bgRemState.tolerance = Number(e.target.value);
      if ($('#bgTolVal')) $('#bgTolVal').textContent = `${e.target.value}%`;
    };
  }

  // Execute Background Removal API
  const executeBgRemoval = async (btn) => {
    if (!state.watermark.imagePath) {
      alert('Please select or upload a logo image first.');
      return;
    }
    const origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🪄 Cleaning Background...';
    }
    const statusEl = $('#bgRemStatus');
    const modalStatusEl = $('#wmModalBgRemStatus');
    if (statusEl) statusEl.textContent = 'Processing transparent PNG...';
    if (modalStatusEl) modalStatusEl.textContent = 'Processing transparent PNG...';

    try {
      const res = await api('/api/watermark/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath: state.watermark.imagePath,
          mode: bgRemState.mode || 'auto',
          tolerance: bgRemState.tolerance || 35,
          keyColor: bgRemState.keyColor || '#ffffff',
          feather: 1
        })
      });

      if (!res.success || !res.url) {
        throw new Error(res.error || 'Failed to remove background.');
      }

      state.watermark.imagePath = res.filePath;
      state.watermark.imageUrl = res.url;

      if ($('#wmImageThumb')) {
        $('#wmImageThumb').src = res.url;
        $('#wmImageThumb').classList.add('has-checkerboard');
      }
      if ($('#wmImageName')) $('#wmImageName').textContent = res.filename;
      if ($('#editWmThumb')) {
        $('#editWmThumb').src = res.url;
        $('#editWmThumb').classList.add('has-checkerboard');
      }
      if ($('#editWmThumbName')) $('#editWmThumbName').textContent = res.filename;

      if (statusEl) statusEl.textContent = '✓ Transparent PNG ready!';
      if (modalStatusEl) modalStatusEl.textContent = '✓ Transparent PNG ready!';
      updateLiveWatermarkPreview();
    } catch (err) {
      alert(`Background removal error: ${err.message}`);
      if (statusEl) statusEl.textContent = 'Failed to clean';
      if (modalStatusEl) modalStatusEl.textContent = 'Failed to clean';
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  };

  if ($('#applyBgRemoveBtn')) $('#applyBgRemoveBtn').onclick = e => executeBgRemoval(e.target);
  if ($('#wmModalRemoveBgBtn')) $('#wmModalRemoveBgBtn').onclick = e => executeBgRemoval(e.target);
  if ($('#editRemoveBgBtn')) $('#editRemoveBgBtn').onclick = e => executeBgRemoval(e.target);

  // --- Modal Screen & Interactive Drag Setup ---
  const wmModal = $('#watermarkModal');
  const openModal = () => {
    if (wmModal) {
      wmModal.classList.remove('hidden');
      // If preview video has source, mirror it into screen mockup
      const previewVid = $('#previewVideo');
      const screenVid = $('#wmScreenVideo');
      if (previewVid && screenVid && previewVid.src) {
        screenVid.src = previewVid.src;
        try { screenVid.currentTime = previewVid.currentTime || 0; } catch {}
      }
      // Sync target preview
      updateModalTargetView();
      // Sync scale slider according to watermark type
      syncModalScaleConfig();
      // Sync sliders
      if ($('#wmRangeX')) $('#wmRangeX').value = state.watermark.xPercent;
      if ($('#wmRangeY')) $('#wmRangeY').value = state.watermark.yPercent;
      if ($('#wmCoordXVal')) $('#wmCoordXVal').textContent = `${state.watermark.xPercent}%`;
      if ($('#wmCoordYVal')) $('#wmCoordYVal').textContent = `${state.watermark.yPercent}%`;
      if ($('#wmModalOpacity')) $('#wmModalOpacity').value = state.watermark.opacity;
      if ($('#wmModalOpacityVal')) $('#wmModalOpacityVal').textContent = `${state.watermark.opacity}%`;
      const target = $('#wmDraggableTarget');
      if (target) {
        target.style.left = `${state.watermark.xPercent}%`;
        target.style.top = `${state.watermark.yPercent}%`;
      }
    }
  };

  const closeModal = () => {
    if (wmModal) wmModal.classList.add('hidden');
  };

  if ($('#openWmModalBtn')) $('#openWmModalBtn').onclick = openModal;
  if ($('#editOpenWmModalBtn')) $('#editOpenWmModalBtn').onclick = openModal;
  if ($('#closeWmModal')) $('#closeWmModal').onclick = closeModal;
  if ($('#saveWmModalBtn')) $('#saveWmModalBtn').onclick = closeModal;

  // Preset quick anchor buttons inside modal
  $$('.wm-anchor-btn').forEach(btn => {
    btn.onclick = () => {
      const x = Number(btn.dataset.x);
      const y = Number(btn.dataset.y);
      setWatermarkCoordinates(x, y, false);
    };
  });

  // Range inputs inside modal
  if ($('#wmRangeX')) $('#wmRangeX').oninput = e => setWatermarkCoordinates(Number(e.target.value), state.watermark.yPercent);
  if ($('#wmRangeY')) $('#wmRangeY').oninput = e => setWatermarkCoordinates(state.watermark.xPercent, Number(e.target.value));

  // Nudge buttons (1% steps)
  if ($('#wmNudgeLeft')) $('#wmNudgeLeft').onclick = () => setWatermarkCoordinates(state.watermark.xPercent - 1, state.watermark.yPercent);
  if ($('#wmNudgeRight')) $('#wmNudgeRight').onclick = () => setWatermarkCoordinates(state.watermark.xPercent + 1, state.watermark.yPercent);
  if ($('#wmNudgeUp')) $('#wmNudgeUp').onclick = () => setWatermarkCoordinates(state.watermark.xPercent, state.watermark.yPercent - 1);
  if ($('#wmNudgeDown')) $('#wmNudgeDown').onclick = () => setWatermarkCoordinates(state.watermark.xPercent, state.watermark.yPercent + 1);

  // Modal Size & Safe Zone Toggle
  if ($('#wmModalSize')) {
    $('#wmModalSize').oninput = e => {
      if (state.watermark.type === 'image') {
        onScale(e.target.value);
      } else {
        onFontSize(e.target.value);
      }
    };
  }
  if ($('#wmToggleSafeZones')) {
    $('#wmToggleSafeZones').onchange = e => {
      const sz = $('#wmScreenSafeZones');
      if (sz) sz.classList.toggle('hidden', !e.target.checked);
    };
  }

  // Draggable logic on #wmDraggableTarget inside Phone Mockup
  const setupModalDragging = () => {
    const target = $('#wmDraggableTarget');
    const screen = $('#wmScreenMockup');
    const handle = $('#wmResizeHandle');
    if (!target || !screen) return;

    let dragging = false;

    const onStart = (e) => {
      // If clicking resize handle, let resize handler handle it
      if (e.target === handle || (handle && handle.contains(e.target))) return;
      dragging = true;
      target.classList.add('dragging');
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const rect = screen.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let x = Math.round(((clientX - rect.left) / rect.width) * 100);
      let y = Math.round(((clientY - rect.top) / rect.height) * 100);
      setWatermarkCoordinates(x, y, false);
    };

    const onEnd = () => {
      if (dragging) {
        dragging = false;
        target.classList.remove('dragging');
      }
    };

    target.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    target.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    // Mouse wheel zoom on target
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 3 : -3;
      zoomWatermark(delta);
    }, { passive: false });

    // Corner handle resize / zoom dragging
    if (handle) {
      let resizing = false;
      let startX = 0;
      let startSize = 0;

      const onResizeStart = (e) => {
        e.stopPropagation();
        e.preventDefault();
        resizing = true;
        handle.classList.add('active');
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startSize = state.watermark.type === 'image'
          ? (state.watermark.imageScale || 22)
          : (state.watermark.fontSize || 36);
      };

      const onResizeMove = (e) => {
        if (!resizing) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const diff = (clientX - startX) * 0.45;
        if (state.watermark.type === 'image') {
          const next = Math.max(5, Math.min(80, Math.round(startSize + diff)));
          onScale(next);
        } else {
          const next = Math.max(12, Math.min(120, Math.round(startSize + diff)));
          onFontSize(next);
        }
      };

      const onResizeEnd = () => {
        if (resizing) {
          resizing = false;
          handle.classList.remove('active');
        }
      };

      handle.addEventListener('mousedown', onResizeStart);
      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeEnd);

      handle.addEventListener('touchstart', onResizeStart, { passive: false });
      window.addEventListener('touchmove', onResizeMove, { passive: false });
      window.addEventListener('touchend', onResizeEnd);
    }
  };

  // Draggable logic directly on #liveWatermarkOverlay inside Video Player
  const setupPlayerDragging = () => {
    const overlay = $('#liveWatermarkOverlay');
    const container = overlay ? overlay.parentElement : null;
    if (!overlay || !container) return;

    let dragging = false;

    const onStart = (e) => {
      if (!state.watermark.enabled) return;
      dragging = true;
      overlay.classList.add('is-dragging');
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let x = Math.round(((clientX - rect.left) / rect.width) * 100);
      let y = Math.round(((clientY - rect.top) / rect.height) * 100);
      setWatermarkCoordinates(x, y, false);
    };

    const onEnd = () => {
      if (dragging) {
        dragging = false;
        overlay.classList.remove('is-dragging');
      }
    };

    overlay.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    overlay.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  setupModalDragging();
  setupPlayerDragging();
  updateLiveWatermarkPreview();
}

function updateModalTargetView() {
  const wm = state.watermark || {};
  const textEl = $('#wmTargetText');
  const imgEl = $('#wmTargetImg');

  if (wm.type === 'image' && wm.imageUrl) {
    if (textEl) textEl.classList.add('hidden');
    if (imgEl) {
      imgEl.classList.remove('hidden');
      imgEl.src = wm.imageUrl;
      const widthPx = Math.round(Number(wm.imageScale || 20) * 3.2);
      imgEl.style.width = `${widthPx}px`;
    }
  } else {
    if (imgEl) imgEl.classList.add('hidden');
    if (textEl) {
      textEl.classList.remove('hidden');
      textEl.textContent = wm.text || '@autoclip';
      textEl.style.fontSize = `${Math.round(Number(wm.fontSize || 36) * 0.44)}px`;
      textEl.style.color = wm.color || '#ffffff';
    }
  }

  const target = $('#wmDraggableTarget');
  if (target) {
    target.style.opacity = (wm.opacity / 100).toFixed(2);
  }
}

function updateLiveWatermarkPreview() {
  const overlay = $('#liveWatermarkOverlay');
  if (!overlay) return;

  const wm = state.watermark;
  if (!wm || !wm.enabled) {
    overlay.classList.add('hidden');
    return;
  }

  overlay.classList.remove('hidden');
  
  if (wm.isCustomPos || wm.position === 'custom') {
    overlay.className = 'live-watermark-overlay custom-pos';
    overlay.style.left = `${wm.xPercent}%`;
    overlay.style.top = `${wm.yPercent}%`;
  } else {
    overlay.className = `live-watermark-overlay ${wm.position || 'top-right'}`;
    overlay.style.left = '';
    overlay.style.top = '';
  }

  overlay.style.opacity = (wm.opacity / 100).toFixed(2);

  const textEl = $('#liveWmText');
  const imgEl = $('#liveWmImg');

  if (wm.type === 'image' && wm.imageUrl) {
    if (textEl) textEl.classList.add('hidden');
    if (imgEl) {
      imgEl.classList.remove('hidden');
      imgEl.src = wm.imageUrl;
      const widthPx = Math.round(Number(wm.imageScale || 20) * 3.2);
      imgEl.style.width = `${widthPx}px`;
    }
  } else {
    if (imgEl) imgEl.classList.add('hidden');
    if (textEl) {
      textEl.classList.remove('hidden');
      textEl.textContent = wm.text || '@autoclip';
      textEl.style.fontSize = `${Math.round(Number(wm.fontSize || 36) * 0.42)}px`;
      textEl.style.color = wm.color || '#ffffff';
      textEl.classList.toggle('has-box', Boolean(wm.box));
    }
  }

  updateModalTargetView();
}

function getWatermarkOptions() {
  const wm = state.watermark || {};
  return {
    enabled: Boolean(wm.enabled),
    type: wm.type || 'text',
    text: wm.text || '',
    position: wm.position || 'top-right',
    fontSize: Number(wm.fontSize) || 36,
    color: wm.color || '#ffffff',
    opacity: Number(wm.opacity !== undefined ? wm.opacity : 85) / 100,
    box: wm.box !== false,
    imagePath: wm.imagePath || '',
    imageScale: (Number(wm.imageScale) || 20) / 100,
    xPercent: wm.xPercent !== undefined ? Number(wm.xPercent) : 92,
    yPercent: wm.yPercent !== undefined ? Number(wm.yPercent) : 6,
    isCustomPos: Boolean(wm.isCustomPos)
  };
}

// Framing system setup & screen view
function setupFramingControls() {
  const modeMain = $('#framingPresetSelect');
  const modeEdit = $('#editFramingMode');
  const aspectMain = $('#aspectRatio');
  const aspectEdit = $('#editAspect');
  const zoomEdit = $('#editZoom');

  const onModeChange = (mode) => {
    state.framing.mode = mode;
    if (modeMain && modeMain.value !== mode) modeMain.value = mode;
    if (modeEdit && modeEdit.value !== mode) modeEdit.value = mode;
    updateLiveFramingPreview();
  };

  const onAspectChange = (aspect) => {
    state.framing.aspectRatio = aspect;
    if (aspectMain && aspectMain.value !== aspect) aspectMain.value = aspect;
    if (aspectEdit && aspectEdit.value !== aspect) aspectEdit.value = aspect;
    updateLiveFramingPreview();
  };

  const onZoomChange = (zoom) => {
    state.framing.zoom = Number(zoom);
    if (zoomEdit && Number(zoomEdit.value) !== Number(zoom)) zoomEdit.value = zoom;
    updateLiveFramingPreview();
  };

  if (modeMain) modeMain.onchange = e => onModeChange(e.target.value);
  if (modeEdit) modeEdit.onchange = e => onModeChange(e.target.value);
  if (aspectMain) aspectMain.onchange = e => onAspectChange(e.target.value);
  if (aspectEdit) aspectEdit.onchange = e => onAspectChange(e.target.value);
  if (zoomEdit) zoomEdit.oninput = e => onZoomChange(e.target.value);

  // --- Modal Screen Setup ---
  const modal = $('#framingModal');
  const openModal = () => {
    if (!modal) return;
    modal.classList.remove('hidden');

    // Sync preview video to framing screen video & blur background video
    const previewVid = $('#previewVideo');
    const screenVid = $('#framingScreenVideo');
    const blurVid = $('#framingBlurVideo');

    if (previewVid && previewVid.src) {
      if (screenVid) {
        screenVid.src = previewVid.src;
        try { screenVid.currentTime = previewVid.currentTime || 0; } catch {}
      }
      if (blurVid) {
        blurVid.src = previewVid.src;
        try { blurVid.currentTime = previewVid.currentTime || 0; } catch {}
      }
    }

    updateFramingModalView();
  };

  const closeModal = () => {
    if (modal) modal.classList.add('hidden');
    updateLiveFramingPreview();
  };

  if ($('#openFramingModalBtn')) $('#openFramingModalBtn').onclick = openModal;
  if ($('#editOpenFramingModalBtn')) $('#editOpenFramingModalBtn').onclick = openModal;
  if ($('#closeFramingModal')) $('#closeFramingModal').onclick = closeModal;
  if ($('#saveFramingModalBtn')) $('#saveFramingModalBtn').onclick = closeModal;

  // Preset Mode Buttons in Modal
  $$('.framing-mode-card').forEach(card => {
    card.onclick = () => {
      onModeChange(card.dataset.mode);
      updateFramingModalView();
    };
  });

  // Aspect Ratio Buttons in Modal
  $$('.framing-aspect-btn').forEach(btn => {
    btn.onclick = () => {
      onAspectChange(btn.dataset.aspect);
      updateFramingModalView();
    };
  });

  // Modal Zoom Slider & Nudgers
  if ($('#framingModalZoom')) {
    $('#framingModalZoom').oninput = e => {
      onZoomChange(e.target.value);
      updateFramingModalView();
    };
  }
  if ($('#framingZoomDown')) {
    $('#framingZoomDown').onclick = () => {
      const z = Math.max(1.0, Math.round((state.framing.zoom - 0.05) * 100) / 100);
      onZoomChange(z);
      updateFramingModalView();
    };
  }
  if ($('#framingZoomUp')) {
    $('#framingZoomUp').onclick = () => {
      const z = Math.min(2.5, Math.round((state.framing.zoom + 0.05) * 100) / 100);
      onZoomChange(z);
      updateFramingModalView();
    };
  }

  // Modal Pan X Slider & Nudgers
  if ($('#framingModalPanX')) {
    $('#framingModalPanX').oninput = e => {
      state.framing.panX = Number(e.target.value);
      updateFramingModalView();
    };
  }
  if ($('#framingPanLeft')) {
    $('#framingPanLeft').onclick = () => {
      state.framing.panX = Math.max(-100, state.framing.panX - 5);
      updateFramingModalView();
    };
  }
  if ($('#framingPanRight')) {
    $('#framingPanRight').onclick = () => {
      state.framing.panX = Math.min(100, state.framing.panX + 5);
      updateFramingModalView();
    };
  }
  if ($('#framingPanCenterBtn')) {
    $('#framingPanCenterBtn').onclick = () => {
      state.framing.panX = 0;
      updateFramingModalView();
    };
  }

  // Color picker for color mode
  if ($('#framingBgColor')) {
    $('#framingBgColor').oninput = e => {
      state.framing.bgColor = e.target.value;
      updateFramingModalView();
    };
  }

  // Safe zones toggle
  if ($('#framingToggleSafeZones')) {
    $('#framingToggleSafeZones').onchange = e => {
      const sz = $('#framingScreenSafeZones');
      if (sz) sz.classList.toggle('hidden', !e.target.checked);
    };
  }

  // Draggable Pan Box inside Phone Screen
  setupFramingCropDragging();

  updateLiveFramingPreview();
}

function setupFramingCropDragging() {
  const cropBox = $('#framingDraggableCropBox');
  const screen = $('#framingPhoneScreen');
  if (!cropBox || !screen) return;

  let dragging = false;
  let startX = 0;
  let startPan = 0;

  const onStart = (e) => {
    if (state.framing.mode !== 'smart') return;
    dragging = true;
    cropBox.classList.add('dragging');
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startPan = state.framing.panX || 0;
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - startX;
    const rect = screen.getBoundingClientRect();
    const panDelta = Math.round((deltaX / rect.width) * 120);
    const newPan = Math.max(-100, Math.min(100, startPan + panDelta));
    state.framing.panX = newPan;
    updateFramingModalView();
  };

  const onEnd = () => {
    if (dragging) {
      dragging = false;
      cropBox.classList.remove('dragging');
      updateLiveFramingPreview();
    }
  };

  cropBox.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  cropBox.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

function updateFramingModalView() {
  const fr = state.framing || {};
  const phoneScreen = $('#framingPhoneScreen');
  const screenVid = $('#framingScreenVideo');
  const blurVid = $('#framingBlurVideo');
  const videoWrapper = $('#framingVideoWrapper');
  const cropBox = $('#framingDraggableCropBox');
  const faceBox = $('#framingFaceBox');
  const splitDivider = $('#framingSplitDivider');
  const colorWrap = $('#framingColorWrap');

  // 1. Aspect Ratio Styling on Mockup Screen
  if (phoneScreen) {
    phoneScreen.className = `wm-phone-screen framing-phone-screen ar-${(fr.aspectRatio || '9:16').replace(':', '-')}`;
  }

  // 2. Active Mode Card & Aspect Buttons
  $$('.framing-mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === fr.mode));
  $$('.framing-aspect-btn').forEach(b => b.classList.toggle('active', b.dataset.aspect === fr.aspectRatio));

  // 3. Framing Mode Visual Simulations
  const mode = fr.mode || 'smart';
  const zoom = fr.zoom || 1.0;
  const panX = fr.panX || 0;

  if (cropBox) cropBox.classList.toggle('hidden', mode !== 'smart');
  if (faceBox) faceBox.classList.toggle('hidden', mode !== 'face');
  if (splitDivider) splitDivider.classList.toggle('hidden', mode !== 'split');
  if (colorWrap) colorWrap.classList.toggle('hidden', mode !== 'color');
  if (blurVid) blurVid.classList.toggle('hidden', mode !== 'blur');

  if (screenVid) {
    screenVid.className = `framing-screen-video mode-${mode}`;
    if (mode === 'smart') {
      const panShift = panX * 0.22;
      screenVid.style.transform = `scale(${zoom}) translate(${panShift}%, 0)`;
    } else if (mode === 'blur' || mode === 'color') {
      screenVid.style.transform = `scale(${Math.min(1.2, zoom)})`;
    } else {
      screenVid.style.transform = `scale(${zoom})`;
    }
  }

  if (videoWrapper) {
    videoWrapper.style.backgroundColor = mode === 'color' ? (fr.bgColor || '#000000') : 'transparent';
  }

  // 4. Update Indicators & Sliders
  if ($('#framingZoomVal')) $('#framingZoomVal').textContent = `${zoom.toFixed(2)}x`;
  if ($('#framingModalZoom')) $('#framingModalZoom').value = zoom;
  if ($('#framingPanXVal')) $('#framingPanXVal').textContent = `${panX > 0 ? '+' : ''}${panX}%`;
  if ($('#framingModalPanX')) $('#framingModalPanX').value = panX;

  const modeNames = {
    smart: 'Smart Crop',
    face: 'Speaker Track',
    blur: 'Blurred Canvas',
    split: 'Split Screen',
    color: 'Solid Pad'
  };

  if ($('#framingPillMode')) $('#framingPillMode').textContent = modeNames[mode] || 'Smart Crop';
  if ($('#framingPillPanX')) $('#framingPillPanX').textContent = `${panX > 0 ? '+' : ''}${panX}%`;

  const summary = `${modeNames[mode] || 'Smart Crop'} · ${fr.aspectRatio || '9:16'}${zoom > 1.05 ? ' · ' + zoom.toFixed(1) + 'x' : ''}${panX !== 0 ? ' · Pan ' + panX + '%' : ''}`;
  if ($('#framingPreviewText')) $('#framingPreviewText').textContent = summary;
  if ($('#editFramingPreviewText')) $('#editFramingPreviewText').textContent = summary;
}

function updateLiveFramingPreview() {
  const fr = state.framing || {};
  const modeNames = {
    smart: 'Smart Crop',
    face: 'Speaker Track',
    blur: 'Blurred Canvas',
    split: 'Split Screen',
    color: 'Solid Pad'
  };
  const summary = `${modeNames[fr.mode] || 'Smart Crop'} · ${fr.aspectRatio || '9:16'}${fr.zoom > 1.05 ? ' · ' + Number(fr.zoom).toFixed(1) + 'x' : ''}${fr.panX !== 0 ? ' · Pan ' + fr.panX + '%' : ''}`;
  if ($('#framingPreviewText')) $('#framingPreviewText').textContent = summary;
  if ($('#editFramingPreviewText')) $('#editFramingPreviewText').textContent = summary;

  // Simulate on preview player in workspace
  const video = $('#previewVideo');
  if (video) {
    if (fr.mode === 'smart' && (fr.zoom > 1.0 || fr.panX !== 0)) {
      video.style.transform = `scale(${fr.zoom || 1.0}) translate(${(fr.panX || 0) * 0.18}%, 0)`;
    } else {
      video.style.transform = '';
    }
  }
}

// 4. Job Creation & Progress Tracking
$('#createJob').onclick = async () => {
  const btn = $('#createJob');
  const progressWrap = $('#progressWrap');
  const progressBar = $('#progressBar');
  const progressMessage = $('#progressMessage');
  const errorText = $('#message');

  errorText.textContent = '';
  btn.disabled = true;
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '10%';
  progressMessage.textContent = 'Initiating job...';

  try {
    let job;
    const options = getJobOptions();

    if (state.activeTab === 'max') {
      btn.disabled = false;
      progressWrap.classList.add('hidden');
      $('#maxBoomBtn')?.click();
      return;
    } else if (state.activeTab === 'file') {
      const file = $('#videoFile').files[0];
      if (!file) throw new Error('Please choose a video file first.');

      const formData = new FormData();
      formData.append('video', file);
      formData.append('options', JSON.stringify(options));

      progressMessage.textContent = 'Uploading video file...';
      job = await api('/api/jobs/upload', { method: 'POST', body: formData });
    } else {
      const url = $('#videoUrl').value.trim();
      if (!url) throw new Error('Please enter a video URL.');

      progressMessage.textContent = 'Starting URL download via yt-dlp...';
      job = await api('/api/jobs/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options })
      });
    }

    // Add to state and poll progress
    state.jobs.unshift(job);
    renderJobs();
    pollJob(job.id);
  } catch (err) {
    errorText.textContent = err.message;
    progressWrap.classList.add('hidden');
    btn.disabled = false;
  }
};

async function pollJob(jobId) {
  const progressBar = $('#progressBar');
  const progressMessage = $('#progressMessage');
  const createBtn = $('#createJob');
  const progressWrap = $('#progressWrap');

  const interval = setInterval(async () => {
    try {
      const j = await api(`/api/jobs/${jobId}`);
      const idx = state.jobs.findIndex(x => x.id === jobId);
      if (idx >= 0) state.jobs[idx] = j;

      if (j.progress) {
        progressBar.style.width = `${j.progress.percent}%`;
        progressMessage.textContent = j.progress.message || j.status;

        if (j.sourcePath && !$('#watchStreamShortcutBtn')) {
          const watchShortcut = document.createElement('button');
          watchShortcut.id = 'watchStreamShortcutBtn';
          watchShortcut.type = 'button';
          watchShortcut.className = 'pill-btn lava-glow-btn';
          watchShortcut.style.cssText = 'margin-left: 12px; padding: 3px 10px; font-size: 11px; cursor: pointer;';
          watchShortcut.innerHTML = '📺 Watch in Stream Cinema';
          watchShortcut.onclick = () => {
            state.currentJob = j;
            window.switchAppView('watch');
            if (typeof loadStreamIntoCinema === 'function') {
              loadStreamIntoCinema(j);
            }
          };
          progressMessage.appendChild(watchShortcut);
        }
      }

      if (j.status === 'ready' || j.status === 'complete') {
        clearInterval(interval);
        createBtn.disabled = false;
        progressWrap.classList.add('hidden');
        showJob(j, true);
        renderJobs();
        $('#message').innerHTML = `
          <span>✅ Stream processed! ${j.clips?.length || 0} viral moments detected.</span>
          <button type="button" class="pill-btn lava-glow-btn" style="margin-left: 10px; padding: 4px 12px; font-size: 12px;" onclick="state.currentJob = state.jobs.find(x => x.id === '${j.id}'); window.switchAppView('watch'); loadStreamIntoCinema(state.currentJob);">
            📺 Open in Stream Cinema
          </button>
        `;
      } else if (j.status === 'failed' || j.status === 'cancelled') {
        clearInterval(interval);
        createBtn.disabled = false;
        $('#message').innerHTML = `
          <span>${j.error || 'Job failed.'}</span>
          <button type="button" id="retryActiveJobBtn" class="pill-btn" style="margin-left: 12px; padding: 4px 12px; font-size: 12px;">🔄 Retry Job</button>
        `;
        const retryBtn = $('#retryActiveJobBtn');
        if (retryBtn) {
          retryBtn.onclick = async () => {
            retryBtn.disabled = true;
            retryBtn.textContent = 'Retrying...';
            try {
              await api(`/api/jobs/${j.id}/retry`, { method: 'POST' });
              progressWrap.classList.remove('hidden');
              progressBar.style.width = '15%';
              progressMessage.textContent = 'Restarting pipeline...';
              pollJob(j.id);
            } catch (err) {
              alert(`Retry failed: ${err.message}`);
              retryBtn.disabled = false;
              retryBtn.textContent = '🔄 Retry Job';
            }
          };
        }
        renderJobs();
      }
    } catch {
      clearInterval(interval);
      createBtn.disabled = false;
    }
  }, 1000);
}

// 5. Studio Workspace & Review
function showJob(job, scrollToWorkspace = true) {
  state.currentJob = job;
  if (typeof window.switchAppView === 'function') {
    window.switchAppView('studio');
  }
  const emptyState = $('#studioEmptyState');
  const ws = $('#workspace');
  if (emptyState) emptyState.classList.add('hidden');
  if (ws) ws.classList.remove('hidden');

  $('#jobTitle').textContent = job.sourceName || 'Video Project';
  $('#jobSub').textContent = `${Math.round(job.duration / 60)} min · ${job.clips?.length || 0} candidate clips ranked by AI`;

  // Update topbar project breadcrumb
  const topTitle = $('#topbarProjectTitle');
  const topMeta = $('#topbarProjectMeta');
  if (topTitle) topTitle.textContent = job.sourceName || 'Active Video Project';
  if (topMeta) topMeta.textContent = `${Math.round(job.duration / 60)} min · ${job.clips?.length || 0} clips ranked`;

  // Set video preview source
  const video = $('#previewVideo');
  if (job.sourcePath && video) {
    const sourceName = job.sourcePath.split(/[\\/]/).pop();
    const encodedName = encodeURIComponent(sourceName);
    if (!video.src.endsWith(encodedName) && !video.src.endsWith(sourceName)) {
      video.src = `/incoming/${encodedName}`;
      video.addEventListener('loadedmetadata', () => {
        if (state.currentJob?.id !== job.id) return;
        const active = job.clips?.find(c => c.id === state.activeClipId);
        if (active) {
          try { video.currentTime = Math.min(active.start, video.duration || active.start); } catch {}
        }
      }, { once: true });
    } else {
      const active = job.clips?.find(c => c.id === state.activeClipId);
      if (active && video.readyState >= 1) {
        try { video.currentTime = Math.min(active.start, video.duration || active.start); } catch {}
      }
    }
  } else if (video) {
    video.removeAttribute('src');
    video.load();
  }

  // Sync job options into canvas and inspector controls
  if (job.options?.aspectRatio) {
    const asp = job.options.aspectRatio;
    state.framing.aspectRatio = asp;
    $$('.aspect-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.aspect === asp));
    const vContainer = $('#previewVideoContainer');
    if (vContainer) {
      vContainer.classList.remove('ar-9-16', 'ar-1-1', 'ar-16-9', 'ar-4-5');
      vContainer.classList.add(`ar-${asp.replace(':', '-')}`);
    }
  }
  if (job.options?.framingMode) {
    applyFramingPreset(job.options.framingMode);
  }
  if (job.options?.webcamPosition && $('#editGamingWebcamPos')) {
    $('#editGamingWebcamPos').value = job.options.webcamPosition;
    const hudBadge = $('#gamingHudPosBadge');
    if (hudBadge) hudBadge.textContent = job.options.webcamPosition.toUpperCase();
  }
  if (job.options?.webcamZoom && $('#editGamingCamZoom')) {
    $('#editGamingCamZoom').value = job.options.webcamZoom;
    if ($('#editGamingCamZoomVal')) $('#editGamingCamZoomVal').textContent = `${Number(job.options.webcamZoom).toFixed(1)}x`;
  }
  if (job.options?.podcastSpeaker && $('#editPodcastSpeaker')) {
    $('#editPodcastSpeaker').value = job.options.podcastSpeaker;
    if ($('#podcastHudSpeakerBanner')) $('#podcastHudSpeakerBanner').textContent = job.options.podcastSpeaker;
  }

  // Populate candidates
  renderClipsList();
  renderTimelineMarkers();
  renderTranscript();
  renderOutputs(job.outputs || []);

  if (job.clips && job.clips.length > 0) {
    selectClip(job.clips[0].id);
  }

  if (scrollToWorkspace) {
    $('#workspace').scrollIntoView({ behavior: 'smooth' });
  }
}

function renderClipsList() {
  const container = $('#clipsList');
  if (!state.currentJob || !state.currentJob.clips) {
    container.innerHTML = '<p class="muted">No candidates available.</p>';
    return;
  }

  // Update Stream Part Tabs counts
  const allClips = state.currentJob.clips || [];
  const part1Count = allClips.filter(c => (c.part === 1 || c.partIndex === 1 || /\[Part 1\]/i.test(c.title))).length;
  const part2Count = allClips.filter(c => (c.part === 2 || c.partIndex === 2 || /\[Part 2\]/i.test(c.title))).length;
  const part3Count = allClips.filter(c => (c.part === 3 || c.partIndex === 3 || /\[Part 3\]/i.test(c.title))).length;

  if ($('#partCountAll')) $('#partCountAll').textContent = allClips.length;
  if ($('#partCount1')) $('#partCount1').textContent = part1Count;
  if ($('#partCount2')) $('#partCount2').textContent = part2Count;
  if ($('#partCount3')) $('#partCount3').textContent = part3Count;

  // Filter clips based on active part tab
  const selPart = state.selectedPart || 'all';
  const displayedClips = selPart === 'all'
    ? allClips
    : allClips.filter(c => (c.part === Number(selPart) || c.partIndex === Number(selPart) || new RegExp(`\\[Part ${selPart}\\]`, 'i').test(c.title)));

  if (displayedClips.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
        <p style="color: #94a3b8; margin-bottom: 12px; font-size: 13px;">No clips currently assigned to Part ${selPart}.</p>
        <button type="button" class="pill-btn primary-pill" onclick="promptSplitStream()" style="font-size: 12px; font-weight: 700;">✂️ Auto-Split &amp; Generate Clips for Part ${selPart}</button>
      </div>
    `;
    return;
  }

  container.innerHTML = displayedClips.map((clip, i) => {
    const scoreClass = clip.score >= 90 ? 'score-high' : clip.score >= 80 ? 'score-med' : 'score-fair';
    const isActive = clip.id === state.activeClipId;
    const clipPart = clip.part || clip.partIndex || (clip.title?.match(/\[Part (\d+)\]/i)?.[1] ? Number(clip.title.match(/\[Part (\d+)\]/i)[1]) : null);
    const isManualSlice = Boolean(state.isManualMode || clip.isManual);
    const displayTitle = clip.title || (isManualSlice ? `✂️ Slice ${i + 1}` : `Candidate Clip ${i + 1}`);

    return `
      <div class="candidate-card ${isActive ? 'active-preview' : ''} ${isManualSlice ? 'manual-slice-card' : ''}" data-clip-id="${clip.id}">
        <div class="card-top">
          ${isManualSlice ? `<span class="score-badge" style="background: rgba(0, 240, 255, 0.2); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.4); font-weight:800;">✂️ Slice #${i + 1}</span>` : `<span class="score-badge ${scoreClass}">★ ${clip.score || 85}/100</span>`}
          ${clipPart ? `<span class="part-badge">Part ${clipPart}</span>` : ''}
          ${clip.viralBadge ? `<span class="viral-tier-badge">${clip.viralBadge}</span>` : ''}
          ${clip.juicer?.potential ? `<span class="status-badge" style="background: rgba(255,100,0,0.18); color: #ffaa00; font-size: 10px; font-weight:800; border: 1px solid rgba(255,100,0,0.35);">⚡ ${clip.juicer.potential}</span>` : ''}
          ${clip.category ? `<span class="category-badge">${clip.category}</span>` : ''}
          ${clip.recommendedFraming === 'gaming_split' || clip.contentType === 'gaming' ? `<span class="status-badge" style="background: rgba(216,255,62,0.15); color: #D8FF3E; font-size: 10px; font-weight:700; border: 1px solid rgba(216,255,62,0.3);">🎮 Gaming (Cam+Screen)</span>` : ''}
          ${clip.recommendedFraming === 'face_stack' || clip.contentType === 'duo_facetime' ? `<span class="status-badge" style="background: rgba(113,87,255,0.2); color: #B388FF; font-size: 10px; font-weight:700; border: 1px solid rgba(113,87,255,0.4);">👥 Duo FaceTime (Top/Bot)</span>` : ''}
          <span style="font-size:12px; font-weight:800; color:var(--violet);">#${String(i + 1).padStart(2, '0')}</span>
        </div>
        <input class="card-title-input" value="${displayTitle.replace(/"/g, '&quot;')}" data-action="edit-title">
        ${clip.beast ? `
          <div class="beast-scorecard">
            <div class="beast-header">
              <span class="beast-tier-badge">${clip.beast.tier || '🦁 BEAST Viral Cut'}</span>
              <span class="beast-score-num">${clip.beast.score ?? 88}/100</span>
            </div>
            <div class="beast-breakdown">
              <div class="beast-metric" title="Heatmap Audio Surge: Redline +6.5dB Ollex Spiking">
                <span class="beast-metric-name">⚡ Audio Spike</span>
                <span class="beast-metric-val">${clip.beast.audioSurge ?? '—'}/25</span>
              </div>
              <div class="beast-metric" title="Crazy Plot Twist & Absurd Hook (Serviuos Rule 1)">
                <span class="beast-metric-name">🌪️ Absurd Twist</span>
                <span class="beast-metric-val">${clip.beast.twist ?? '—'}/25</span>
              </div>
              <div class="beast-metric" title="Polarizing Debate & Share Trigger (Serviuos Rule 2)">
                <span class="beast-metric-name">🔥 High Arousal</span>
                <span class="beast-metric-val">${clip.beast.arousal ?? '—'}/25</span>
              </div>
              <div class="beast-metric" title="Oddly Satisfying Cadence & Zero Dead Air (Rule 4)">
                <span class="beast-metric-name">🌊 Zero Dead Air</span>
                <span class="beast-metric-val">${clip.beast.pacing ?? '—'}/25</span>
              </div>
            </div>
            ${clip.beast.brockHook ? `
              <div class="beast-brock-pill" title="${clip.beast.brockHook.tacticalAdvice || ''}">
                <span>🎯 <b>Brock 1,300-Hook:</b> ${clip.beast.brockHook.archetype} · ${clip.beast.brockHook.negativeFraming ? '<span style="color:#ef4444;font-weight:700;">🔥 2.3x Loss Aversion</span>' : 'Standard Framing'} · ${clip.beast.brockHook.wordCount} words ${clip.beast.brockHook.inSweetSpot ? '✓' : ''}</span>
              </div>
            ` : ''}
            ${clip.beast.preset ? `
              <div class="beast-preset-pill">
                <span>⚡ <b>Beast Setup:</b> ${clip.beast.preset.captionStyle} · ${clip.beast.preset.audioGain} · ${clip.beast.preset.outroEffect}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${clip.hollywood ? `
          <div class="hollywood-scorecard">
            <div class="hw-header">
              <span class="hw-grade-badge">🎬 ${clip.hollywood.grade || 'Hollywood Candidate'}</span>
              <span class="hw-score-num">${clip.hollywood.score ?? 85}/100</span>
            </div>
            <div class="hw-breakdown">
              <div class="hw-metric" title="Zero Delay: Fluff penalty & speed to value">
                <span class="hw-metric-name">⚡ Speed</span>
                <span class="hw-metric-val">${clip.hollywood.speedToValue ?? '—'}/25</span>
              </div>
              <div class="hw-metric" title="Zero Confusion: 6th-grade clarity & active voice">
                <span class="hw-metric-name">🎯 Clarity</span>
                <span class="hw-metric-val">${clip.hollywood.clarity ?? '—'}/25</span>
              </div>
              <div class="hw-metric" title="Audience Relevance: You/Your framing & pain agitation">
                <span class="hw-metric-name">🫵 You-Frame</span>
                <span class="hw-metric-val">${clip.hollywood.relevance ?? '—'}/25</span>
              </div>
              <div class="hw-metric" title="Curiosity Loop: A vs B Contrarian tension">
                <span class="hw-metric-name">🔄 Contrast</span>
                <span class="hw-metric-val">${clip.hollywood.contrast ?? '—'}/25</span>
              </div>
            </div>
            ${clip.hollywood.tip ? `<p class="hw-tip">💡 <b>Hollywood Fix:</b> ${clip.hollywood.tip}</p>` : ''}
          </div>
        ` : ''}
        ${clip.breakdown || clip.hookScore ? `
          <div class="score-breakdown-row">
            <span class="breakdown-pill hook" title="First 3s retention hook score">⚡ Hook: <b>${clip.breakdown?.hook ?? clip.hookScore ?? 'N/A'}</b></span>
            <span class="breakdown-pill flow" title="Conversational pacing and speech rhythm">🌊 Flow: <b>${clip.breakdown?.flow ?? clip.flowScore ?? 'N/A'}</b></span>
            <span class="breakdown-pill energy" title="Audio dynamic contrast vs baseline">🔊 Audio: <b>${clip.breakdown?.audioAvailable === false ? 'N/A' : (clip.breakdown?.energy ?? clip.energyScore ?? 'N/A')}</b></span>
            ${clip.breakdown?.surge ? `<span class="breakdown-pill surge" title="Audio volume surge vs baseline">${clip.breakdown.surge} Spike</span>` : ''}
          </div>
        ` : ''}
        ${clip.hook ? `<p class="card-hook">"${clip.hook}"</p>` : ''}
        ${clip.reason ? `<p class="card-reason">${clip.reason}</p>` : ''}
        ${clip.captionKeywords && clip.captionKeywords.length ? `
          <div class="keywords-wrap">
            ${clip.captionKeywords.map(k => `<span class="keyword-tag">#${k}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-timing">
          <label>
            Start (sec)
            <input type="number" step="0.5" min="0" max="${state.currentJob.duration}" value="${clip.start}" data-action="edit-start">
          </label>
          <label>
            End (sec)
            <input type="number" step="0.5" min="1" max="${state.currentJob.duration}" value="${clip.end}" data-action="edit-end">
          </label>
        </div>
        <div class="card-actions">
          <button class="card-btn" data-action="preview">Play</button>
          <button class="card-btn" data-action="split">Split</button>
          <button class="card-btn" data-action="duplicate">Duplicate</button>
          <button class="card-btn" data-action="schedule" style="color: #ffdd00;">Post</button>
          <button class="card-btn delete" data-action="delete">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  $$('.candidate-card').forEach(card => {
    const clipId = card.dataset.clipId;

    card.onclick = (e) => {
      if (['INPUT', 'BUTTON'].includes(e.target.tagName)) return;
      selectClip(clipId);
    };

    card.querySelector('[data-action="preview"]').onclick = () => selectClip(clipId, true);
    card.querySelector('[data-action="split"]').onclick = () => splitClip(clipId);
    card.querySelector('[data-action="duplicate"]').onclick = () => duplicateClip(clipId);
    const schedBtn = card.querySelector('[data-action="schedule"]');
    if (schedBtn) schedBtn.onclick = () => openSchedulerWithCandidateClip(clipId);
    card.querySelector('[data-action="delete"]').onclick = () => deleteClip(clipId);

    const titleInput = card.querySelector('[data-action="edit-title"]');
    titleInput.onchange = () => updateClipData(clipId, { title: titleInput.value });

    const startInput = card.querySelector('[data-action="edit-start"]');
    startInput.onchange = () => {
      const val = Number(startInput.value);
      updateClipData(clipId, { start: val });
      seekTo(val);
    };

    const endInput = card.querySelector('[data-action="edit-end"]');
    endInput.onchange = () => updateClipData(clipId, { end: Number(endInput.value) });
  });
}

function setupStreamPartsUI() {
  $$('.part-tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.part-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const part = btn.dataset.part;
      state.selectedPart = (part === 'all') ? 'all' : Number(part);
      renderClipsList();

      if (state.selectedPart !== 'all' && state.currentJob?.parts) {
        const pObj = state.currentJob.parts.find(p => p.partIndex === state.selectedPart);
        if (pObj && pObj.start !== undefined) {
          seekTo(pObj.start);
        }
      }
    };
  });

  const splitBtn = $('#splitStreamBtn');
  if (splitBtn) {
    splitBtn.onclick = () => promptSplitStream();
  }
}

async function promptSplitStream() {
  if (!state.currentJob) {
    alert('Please select or analyze a video stream first.');
    return;
  }
  const durHours = ((state.currentJob.duration || 0) / 3600).toFixed(1);
  const choice = window.prompt(
    `✂️ Multi-Part Stream Splitter\n\nDuration: ${durHours} hours\nChoose how many chronological parts to split into:\n\n• Enter 2 for 2 Parts (50 clips total)\n• Enter 3 for 3 Parts (75 clips total)\n• Enter 4 for 4 Parts (80 clips total)`,
    '3'
  );
  if (!choice) return;
  const partsCount = parseInt(choice, 10);
  if (isNaN(partsCount) || partsCount < 2 || partsCount > 6) {
    alert('Please enter a valid number of parts between 2 and 6.');
    return;
  }

  const clipsPerPart = partsCount === 3 ? 25 : Math.round(75 / partsCount);
  const totalClips = partsCount * clipsPerPart;

  const btn = $('#splitStreamBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Splitting...';
  }

  try {
    const res = await api(`/api/jobs/${state.currentJob.id}/split-parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partsCount, totalClips })
    });

    // Refresh state current job
    const updated = await api(`/api/jobs/${state.currentJob.id}`);
    state.currentJob = updated;
    state.selectedPart = 'all';
    $$('.part-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.part === 'all'));

    renderClipsList();
    renderTimelineMarkers();
    alert(`🎉 Successfully split stream into ${partsCount} parts with ${updated.clips.length} clips!`);
  } catch (err) {
    alert(`Split error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✂️ Split Stream';
    }
  }
}
window.promptSplitStream = promptSplitStream;

function selectClip(clipId, playImmediately = false, seekPosition = null) {
  state.activeClipId = clipId;
  const clip = state.currentJob?.clips?.find(c => c.id === clipId);
  if (!clip) return;

  // Highlight card
  $$('.candidate-card').forEach(c => c.classList.toggle('active-preview', c.dataset.clipId === clipId));

  // Seek video
  const video = $('#previewVideo');
  if (video) {
    const targetTime = seekPosition === null ? clip.start : seekPosition;
    if (video.readyState >= 1) {
      try { video.currentTime = targetTime; } catch {}
    } else {
      video.addEventListener('loadedmetadata', () => {
        try { video.currentTime = targetTime; } catch {}
      }, { once: true });
    }
    if (playImmediately) {
      video.play().catch(() => {});
    }
  }

  // Update live caption preview text
  $('#captionPreviewText').textContent = clip.hook || clip.title || 'CAPTION PREVIEW';
  if (typeof renderActiveOverlaysList === 'function') renderActiveOverlaysList();

  // Sync manual timing inputs
  syncManualClipBounds(clip);

  // Auto-apply recommended framing if present and user has not overridden
  if (!['auto','adaptive','duo_auto','group_fit'].includes(state.framing.mode) && clip.recommendedFraming && ['gaming_split', 'face_stack', 'smart', 'blur'].includes(clip.recommendedFraming)) {
    applyFramingPreset(clip.recommendedFraming);
  }

  // Update timeline highlights
  if (typeof renderCapCutTimeline === 'function') renderCapCutTimeline();
}

function seekTo(sec) {
  const video = $('#previewVideo');
  video.currentTime = Math.max(0, Math.min(video.duration || 9999, sec));
}

function splitClip(clipId) {
  const clips = state.currentJob.clips;
  const idx = clips.findIndex(c => c.id === clipId);
  if (idx < 0) return;

  const c = clips[idx];
  const mid = Math.round((c.start + c.end) / 2);
  const part1 = { ...c, id: crypto.randomUUID(), end: mid, title: `${c.title} (Part 1)` };
  const part2 = { ...c, id: crypto.randomUUID(), start: mid, title: `${c.title} (Part 2)` };

  clips.splice(idx, 1, part1, part2);
  renderClipsList();
  renderTimelineMarkers();
  saveClipsToServer();
}

function duplicateClip(clipId) {
  const clips = state.currentJob.clips;
  const c = clips.find(x => x.id === clipId);
  if (!c) return;

  const copy = { ...c, id: crypto.randomUUID(), title: `${c.title} (Copy)` };
  clips.push(copy);
  renderClipsList();
  renderTimelineMarkers();
  saveClipsToServer();
}

function deleteClip(clipId) {
  state.currentJob.clips = state.currentJob.clips.filter(c => c.id !== clipId);
  renderClipsList();
  renderTimelineMarkers();
  saveClipsToServer();
}

function updateClipData(clipId, patch) {
  const c = state.currentJob.clips.find(x => x.id === clipId);
  if (c) {
    Object.assign(c, patch);
    renderTimelineMarkers();
    saveClipsToServer();
  }
}

let clipSaveQueue = Promise.resolve();
async function saveClipsToServer() {
  if (!state.currentJob) return;
  const jobId = state.currentJob.id;
  const payload = JSON.stringify({ clips: state.currentJob.clips, options: state.currentJob.options });
  const save = async () => { try {
    await api(`/api/jobs/${jobId}/clips`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    return true;
  } catch (err) {
    console.error('Failed to save clips:', err);
    return false;
  }};
  const pending = clipSaveQueue.then(save, save);
  clipSaveQueue = pending.catch(() => false);
  return pending;
}

// 6. CapCut-Style Multi-Track Timeline & Manual Trimming Centre
function syncManualClipBounds(clip) {
  if (!clip) return;
  const startInp = $('#clipEditStart');
  const endInp = $('#clipEditEnd');
  const durBadge = $('#clipEditDuration');
  if (startInp) startInp.value = Number(clip.start).toFixed(1);
  if (endInp) endInp.value = Number(clip.end).toFixed(1);
  if (durBadge) durBadge.textContent = `${(clip.end - clip.start).toFixed(1)}s`;
}

function setupTimelineHandleDragging(container, duration) {
  const lanesContent = $('#tracksLanesContent');
  if (!lanesContent) return;

  container.querySelectorAll('.clip-range-handle').forEach(handle => {
    handle.onmousedown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const clipId = handle.dataset.clipId;
      const isStart = handle.dataset.handle === 'start';
      const clip = state.currentJob?.clips?.find(c => c.id === clipId);
      if (!clip) return;

      selectClip(clipId);
      handle.classList.add('is-dragging');

      const rect = lanesContent.getBoundingClientRect();
      const clipEl = container.querySelector(`.timeline-clip-range[data-clip-id="${clipId}"]`);
      let dragFrame = null;
      let pendingClientX = null;
      const applyTrimMove = () => {
        dragFrame = null;
        if (pendingClientX === null) return;
        const clientX = pendingClientX;
        pendingClientX = null;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newSec = Math.round(pct * duration * 10) / 10;

        if (isStart) {
          if (newSec < clip.end - 0.4) {
            clip.start = Math.max(0, newSec);
            videoEl.currentTime = clip.start;
          }
        } else {
          if (newSec > clip.start + 0.4) {
            clip.end = Math.min(duration, newSec);
            videoEl.currentTime = clip.end;
          }
        }

        if (clipEl) {
          const leftPct = (clip.start / duration) * 100;
          const widthPct = Math.max(0.6, ((clip.end - clip.start) / duration) * 100);
          clipEl.style.left = `${leftPct}%`;
          clipEl.style.width = `${widthPct}%`;
          clipEl.title = `${clip.title} (${(clip.end - clip.start).toFixed(1)}s)`;
        }

        syncManualClipBounds(clip);
      };

      const onMouseMove = moveEvt => {
        pendingClientX = moveEvt.clientX;
        if (dragFrame === null) dragFrame = requestAnimationFrame(applyTrimMove);
      };
      const onMouseUp = () => {
        if (dragFrame !== null) cancelAnimationFrame(dragFrame);
        applyTrimMove();
        handle.classList.remove('is-dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        renderCapCutTimeline();
        renderClipsList();
        saveClipsToServer();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  });
}

function renderTimelineMarkers() {
  renderCapCutTimeline();
}

function renderCapCutTimeline() {
  const duration = state.currentJob?.duration || 1;
  const zoomLevel = Number($('#timelineZoomSlider')?.value || 1);
  const lanesContent = $('#tracksLanesContent');
  if (lanesContent) {
    lanesContent.style.width = `${Math.max(100, zoomLevel * 100)}%`;
  }

  // 1. Time Ruler ticks
  const rulerLane = $('#rulerLane');
  if (rulerLane) {
    let tickInterval = 5;
    if (duration > 600) tickInterval = 30;
    else if (duration > 300) tickInterval = 15;
    else if (duration > 120) tickInterval = 10;
    else if (duration > 30) tickInterval = 5;
    else tickInterval = 2;

    const tickCount = Math.floor(duration / tickInterval);
    let ticksHtml = '';
    for (let i = 0; i <= tickCount; i++) {
      const sec = i * tickInterval;
      const pct = (sec / duration) * 100;
      ticksHtml += `
        <div class="ruler-tick" style="left: ${pct}%;">
          <span class="ruler-time-label">${formatTime(sec)}</span>
        </div>`;
    }
    rulerLane.innerHTML = ticksHtml;
  }

  // 2. Video Clips Lane
  const markersContainer = $('#timelineMarkers');
  if (markersContainer && state.currentJob?.clips) {
    markersContainer.innerHTML = state.currentJob.clips.map((c, idx) => {
      const leftPct = (c.start / duration) * 100;
      const widthPct = Math.max(0, ((c.end - c.start) / duration) * 100);
      const isActive = c.id === state.activeClipId;
      const isManual = c.isManual || state.isManualMode;
      return `
        <div class="timeline-clip-range ${isActive ? 'active-clip-range' : ''} ${isManual ? 'manual-slice' : ''}"
             data-clip-id="${c.id}"
             style="left: ${leftPct}%; width: ${widthPct}%;"
             title="${escapeHtml(c.title || 'Clip')} (${(c.end - c.start).toFixed(1)}s)">
          <div class="clip-range-handle left-handle" data-clip-id="${c.id}" data-handle="start" title="Drag to adjust clip start"></div>
          <div class="clip-range-content">
            <span class="clip-range-title">${isManual ? '✂️ Slice ' + (idx + 1) : '#' + (idx + 1) + ' ' + escapeHtml(c.title || 'Clip')}</span>
            <span class="clip-range-score">${c.score || 80}★</span>
          </div>
          <div class="clip-range-handle right-handle" data-clip-id="${c.id}" data-handle="end" title="Drag to adjust clip end"></div>
        </div>`;
    }).join('');

    markersContainer.querySelectorAll('.timeline-clip-range').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('clip-range-handle')) return;
        e.stopPropagation();
        const clipId = el.dataset.clipId;
        if (clipId) selectClip(clipId);
      };
    });

    setupTimelineHandleDragging(markersContainer, duration);
  }

  // 3. Subtitles Phrase Lane
  const captionLane = $('#captionLane');
  if (captionLane) {
    const segments = state.currentJob?.transcript?.segments || [];
    captionLane.innerHTML = segments.slice(0, 150).map(seg => {
      const leftPct = (seg.start / duration) * 100;
      const segDur = Math.max(0.5, seg.end - seg.start);
      const widthPct = Math.max(0.5, (segDur / duration) * 100);
      const textPreview = (seg.text || '').replace(/"/g, '&quot;');
      return `
        <div class="caption-block-pill"
             data-start="${seg.start}"
             data-end="${seg.end}"
             style="left: ${leftPct}%; width: ${widthPct}%;"
             title="${textPreview}">
          <span>${textPreview.slice(0, 22)}</span>
        </div>`;
    }).join('');

    captionLane.querySelectorAll('.caption-block-pill').forEach(pill => {
      pill.onclick = (e) => {
        e.stopPropagation();
        seekTo(Number(pill.dataset.start));
      };
    });
  }

  // 4. Audio Waveform & Energy Surge Lane
  const audioLane = $('#audioWaveLane');
  if (audioLane) {
    const energyData = state.currentJob?.audioAnalysis?.energyLevels?.length ? state.currentJob.audioAnalysis.energyLevels : (state.currentJob?.transcript?.audio_energy || []);
    const barCount = Math.min(900, energyData.length);
    audioLane.style.setProperty('--audio-bin-count',String(Math.max(1,barCount)));
    const maxEnergy = energyData.reduce((max,value)=>Number.isFinite(value)?Math.max(max,value):max,.000001);
    let barsHtml = '';
    for (let i = 0; i < barCount; i++) {
      const pct = (i / barCount) * 100;
      const dataIdx = Math.floor((i / barCount) * energyData.length);
      const energy = Math.max(0, Math.min(1, (Number(energyData[dataIdx]) || 0) / maxEnergy));
      const isSurge = energy >= 0.72;
      const heightPct = Math.max(2, Math.round(energy * 100));
      barsHtml += `
        <div class="audio-energy-bar ${isSurge ? 'surge-spike' : ''}"
             data-time="${(i / barCount) * duration}"
             style="left: ${pct}%; height: ${heightPct}%;"
             title="Relative measured audio level: ${Math.round(energy * 100)}%">
        </div>`;
    }
    audioLane.innerHTML = barsHtml || '<span class="manual-audio-unavailable">Audio levels unavailable for this source</span>';

    audioLane.querySelectorAll('.audio-energy-bar').forEach(bar => {
      bar.onclick = (e) => {
        e.stopPropagation();
        seekTo(Number(bar.dataset.time));
      };
    });
  }

  // 5. Meme Stickers & Overlays Lane
  const overlayLane = $('#overlayLane');
  if (overlayLane) {
    const overlays = state.currentJob?.overlays || [];
    if (overlays.length > 0) {
      overlayLane.innerHTML = overlays.map(ov => {
        const leftPct = ((ov.start || 0) / duration) * 100;
        const widthPct = Math.max(1.5, (((ov.end || ov.start + 3) - ov.start) / duration) * 100);
        return `
          <div class="overlay-track-chip" style="left: ${leftPct}%; width: ${widthPct}%;" title="${ov.type || 'Overlay'}">
            <span>🎭 ${ov.type || 'Meme'}</span>
          </div>`;
      }).join('');
    } else {
      overlayLane.innerHTML = `<span style="font-size: 10px; color: #6b7280; padding-left: 10px; line-height: 28px;">No meme overlays placed yet</span>`;
    }
  }
}

// Video Timeupdate & Loop Controller
const videoEl = $('#previewVideo');
videoEl.ontimeupdate = () => {
  const cur = videoEl.currentTime;
  const dur = videoEl.duration || state.currentJob?.duration || 1;
  const timeStr = `${formatTime(cur)} / ${formatTime(dur)}`;
  const timeDisplay = $('#timeDisplay');
  if (timeDisplay && timeDisplay.textContent !== timeStr) timeDisplay.textContent = timeStr;

  // Move playhead
  const pct = (cur / dur) * 100;
  const playhead = $('#timelinePlayhead');
  if (playhead) playhead.style.left = `${pct}%`;

  // Handle active clip looping
  if (!videoEl.paused && !videoEl.seeking && state.loopActive && state.activeClipId) {
    const activeClip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (activeClip && (cur >= activeClip.end || cur < activeClip.start)) {
      videoEl.currentTime = activeClip.start;
    }
  }
};

// Playhead Scrubbing on Track Board
const lanesContentEl = $('#tracksLanesContent');
if (lanesContentEl) {
  lanesContentEl.onclick = (e) => {
    if (e.target.closest('.timeline-clip-range') || e.target.closest('.caption-block-pill') || e.target.closest('.audio-energy-bar')) {
      return;
    }
    const rect = lanesContentEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const dur = videoEl.duration || state.currentJob?.duration || 1;
    videoEl.currentTime = pct * dur;
  };
}

if ($('#timelineTrack')) {
  $('#timelineTrack').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const dur = videoEl.duration || state.currentJob?.duration || 1;
    videoEl.currentTime = pct * dur;
  };
}

// Play / Pause
const togglePlayAction = () => {
  if (videoEl.paused) {
    videoEl.play();
    if ($('#togglePlayBtn')) $('#togglePlayBtn').textContent = '⏸ Pause';
  } else {
    videoEl.pause();
    if ($('#togglePlayBtn')) $('#togglePlayBtn').textContent = '▶ Play';
  }
};
if ($('#togglePlayBtn')) $('#togglePlayBtn').onclick = togglePlayAction;

// Seek Start
if ($('#seekStartBtn')) {
  $('#seekStartBtn').onclick = () => {
    if (state.activeClipId) {
      const activeClip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
      if (activeClip) videoEl.currentTime = activeClip.start;
    } else {
      videoEl.currentTime = 0;
    }
  };
}

// Loop & Safe Zone
if ($('#toggleLoopBtn')) {
  $('#toggleLoopBtn').onclick = () => {
    state.loopActive = !state.loopActive;
    $('#toggleLoopBtn').classList.toggle('active', state.loopActive);
  };
}

if ($('#toggleSafeZoneBtn')) {
  $('#toggleSafeZoneBtn').onclick = () => {
    state.safeZoneVisible = !state.safeZoneVisible;
    $('#safeZoneOverlay').classList.toggle('hidden', !state.safeZoneVisible);
    $('#toggleSafeZoneBtn').classList.toggle('active', state.safeZoneVisible);
  };
}

// Split At Playhead [S]
const splitAtPlayheadAction = () => {
  if (!state.currentJob) return;
  const dur = state.currentJob.duration || 60;
  const cur = Math.round(videoEl.currentTime * 10) / 10;

  if (!state.currentJob.clips || state.currentJob.clips.length === 0) {
    const splitTime = Math.max(0.5, Math.min(dur - 0.5, cur));
    const part1 = {
      id: crypto.randomUUID(),
      start: 0,
      end: splitTime,
      title: 'Manual Slice 1',
      hook: 'Manual Cut',
      score: 90,
      isManual: true
    };
    const part2 = {
      id: crypto.randomUUID(),
      start: splitTime,
      end: dur,
      title: 'Manual Slice 2',
      hook: 'Manual Cut',
      score: 90,
      isManual: true
    };
    state.currentJob.clips = [part1, part2];
    renderClipsList();
    selectClip(part1.id);
    renderCapCutTimeline();
    saveClipsToServer();
    return;
  }

  // Find clip containing current playhead
  let clip = state.currentJob.clips.find(c => cur > c.start + 0.3 && cur < c.end - 0.3);
  if (!clip && state.activeClipId) {
    const act = state.currentJob.clips.find(c => c.id === state.activeClipId);
    if (act && cur > act.start + 0.3 && cur < act.end - 0.3) {
      clip = act;
    }
  }

  if (clip) {
    const idx = state.currentJob.clips.findIndex(c => c.id === clip.id);
    const baseTitle = (clip.title || 'Slice').replace(/ \(Part \d+\)$/, '').replace(/ \(Slice \d+\)$/, '');
    const part1 = { ...clip, id: crypto.randomUUID(), end: cur, title: `${baseTitle} (Part 1)` };
    const part2 = { ...clip, id: crypto.randomUUID(), start: cur, title: `${baseTitle} (Part 2)` };
    state.currentJob.clips.splice(idx, 1, part1, part2);
    renderClipsList();
    selectClip(part2.id);
    renderCapCutTimeline();
    saveClipsToServer();
  } else {
    // Playhead is in empty gap: create a new manual slice starting at cur
    const end = Math.min(dur, Math.round((cur + 30) * 10) / 10);
    const newSlice = {
      id: crypto.randomUUID(),
      start: cur,
      end: end,
      title: `Manual Slice ${state.currentJob.clips.length + 1}`,
      hook: 'Manual Cut',
      score: 85,
      isManual: true
    };
    state.currentJob.clips.push(newSlice);
    state.currentJob.clips.sort((a, b) => a.start - b.start);
    renderClipsList();
    selectClip(newSlice.id);
    renderCapCutTimeline();
    saveClipsToServer();
  }
};
if ($('#splitAtPlayheadBtn')) $('#splitAtPlayheadBtn').onclick = splitAtPlayheadAction;

// Delete Selected Clip [Del]
const deleteClipAction = () => {
  if (!state.currentJob?.clips || state.currentJob.clips.length === 0) return;
  const clipId = state.activeClipId || state.currentJob.clips[0].id;
  state.currentJob.clips = state.currentJob.clips.filter(c => c.id !== clipId);
  renderClipsList();
  if (state.currentJob.clips.length > 0) {
    selectClip(state.currentJob.clips[0].id);
  } else {
    state.activeClipId = null;
  }
  renderCapCutTimeline();
  saveClipsToServer();
};
if ($('#deleteClipAtPlayheadBtn')) $('#deleteClipAtPlayheadBtn').onclick = deleteClipAction;

// Pro Manual Mode: Start with clean raw video with no already-made clips
function switchToManualMode() {
  if (!state.currentJob) return;
  state.isManualMode = true;
  $('#modeManualRaw')?.classList.add('active');
  $('#modeAiClips')?.classList.remove('active');
  $('#restoreAiClipsBtn')?.classList.remove('hidden');

  if (!state.currentJob._savedAiClips && state.currentJob.clips && state.currentJob.clips.length > 1) {
    state.currentJob._savedAiClips = JSON.parse(JSON.stringify(state.currentJob.clips));
  }

  const dur = state.currentJob.duration || 60;
  state.currentJob.clips = [{
    id: crypto.randomUUID(),
    start: 0,
    end: Math.round(dur * 10) / 10,
    title: 'Full Raw Video (Master)',
    hook: 'Full Uncut Video',
    score: 95,
    isManual: true
  }];

  renderClipsList();
  selectClip(state.currentJob.clips[0].id);
  renderCapCutTimeline();
  saveClipsToServer();
}

function switchToAiClipsMode() {
  if (!state.currentJob) return;
  state.isManualMode = false;
  $('#modeAiClips')?.classList.add('active');
  $('#modeManualRaw')?.classList.remove('active');
  $('#restoreAiClipsBtn')?.classList.add('hidden');

  if (state.currentJob._savedAiClips && state.currentJob._savedAiClips.length > 0) {
    state.currentJob.clips = JSON.parse(JSON.stringify(state.currentJob._savedAiClips));
  }

  renderClipsList();
  if (state.currentJob.clips.length > 0) {
    selectClip(state.currentJob.clips[0].id);
  }
  renderCapCutTimeline();
  saveClipsToServer();
}

if ($('#modeManualRaw')) $('#modeManualRaw').onclick = switchToManualMode;
if ($('#modeAiClips')) $('#modeAiClips').onclick = switchToAiClipsMode;
if ($('#loadMasterVideoBtn')) $('#loadMasterVideoBtn').onclick = switchToManualMode;
if ($('#restoreAiClipsBtn')) $('#restoreAiClipsBtn').onclick = switchToAiClipsMode;

// Set In [I]
const setClipInAction = () => {
  const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
  if (!clip) return;
  const cur = Math.round(videoEl.currentTime * 10) / 10;
  if (cur >= clip.end - 0.5) {
    alert('In point must be before Out point.');
    return;
  }
  clip.start = cur;
  syncManualClipBounds(clip);
  renderCapCutTimeline();
  renderClipsList();
  saveClipsToServer();
};
if ($('#setClipInBtn')) $('#setClipInBtn').onclick = setClipInAction;

// Set Out [O]
const setClipOutAction = () => {
  const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
  if (!clip) return;
  const cur = Math.round(videoEl.currentTime * 10) / 10;
  if (cur <= clip.start + 0.5) {
    alert('Out point must be after In point.');
    return;
  }
  clip.end = cur;
  syncManualClipBounds(clip);
  renderCapCutTimeline();
  renderClipsList();
  saveClipsToServer();
};
if ($('#setClipOutBtn')) $('#setClipOutBtn').onclick = setClipOutAction;

// Nudge Backward & Forward
if ($('#nudgeBackBtn')) {
  $('#nudgeBackBtn').onclick = () => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (clip && clip.start >= 0.5) {
      clip.start = Math.round((clip.start - 0.5) * 10) / 10;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    } else {
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 0.5);
    }
  };
}

if ($('#nudgeFwdBtn')) {
  $('#nudgeFwdBtn').onclick = () => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    const maxDur = state.currentJob?.duration || 9999;
    if (clip && clip.end + 0.5 <= maxDur) {
      clip.end = Math.round((clip.end + 0.5) * 10) / 10;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    } else {
      videoEl.currentTime = Math.min(maxDur, videoEl.currentTime + 0.5);
    }
  };
}

// Add Clip At Current Playhead
const addClipAtPlayheadAction = () => {
  if (!state.currentJob) return;
  const cur = Math.round((videoEl.currentTime || 0) * 10) / 10;
  const dur = state.currentJob.duration || 60;
  const end = Math.min(dur, Math.round((cur + 30) * 10) / 10);
  const newClip = {
    id: crypto.randomUUID(),
    start: cur,
    end: end,
    score: 85,
    title: `Manual Clip ${state.currentJob.clips.length + 1}`,
    hook: 'Custom selected highlight',
    reason: 'Created manually at playhead',
    captionKeywords: [],
    contextWarning: ''
  };
  state.currentJob.clips.push(newClip);
  renderClipsList();
  selectClip(newClip.id);
  renderCapCutTimeline();
  saveClipsToServer();
};
if ($('#addClipAtPlayheadBtn')) $('#addClipAtPlayheadBtn').onclick = addClipAtPlayheadAction;
if ($('#addClipBtn')) $('#addClipBtn').onclick = addClipAtPlayheadAction;

// Zoom Slider
if ($('#timelineZoomSlider')) {
  $('#timelineZoomSlider').oninput = () => {
    renderCapCutTimeline();
  };
}

// Manual Clip Boundaries Inputs in Inspector
if ($('#clipEditStart')) {
  $('#clipEditStart').onchange = (e) => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (!clip) return;
    const val = Math.max(0, parseFloat(e.target.value) || 0);
    if (val < clip.end) {
      clip.start = val;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    } else {
      e.target.value = clip.start.toFixed(1);
    }
  };
}

if ($('#clipEditEnd')) {
  $('#clipEditEnd').onchange = (e) => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (!clip) return;
    const val = parseFloat(e.target.value) || clip.start + 1;
    if (val > clip.start) {
      clip.end = val;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    } else {
      e.target.value = clip.end.toFixed(1);
    }
  };
}

if ($('#setStartToPlayheadBtn')) {
  $('#setStartToPlayheadBtn').onclick = () => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (!clip) return;
    const cur = Math.round(videoEl.currentTime * 10) / 10;
    if (cur < clip.end) {
      clip.start = cur;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    }
  };
}

if ($('#setEndToPlayheadBtn')) {
  $('#setEndToPlayheadBtn').onclick = () => {
    const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
    if (!clip) return;
    const cur = Math.round(videoEl.currentTime * 10) / 10;
    if (cur > clip.start) {
      clip.end = cur;
      syncManualClipBounds(clip);
      renderCapCutTimeline();
      renderClipsList();
      saveClipsToServer();
    }
  };
}

// Canvas Header Quick-Bar: Aspect & Layout Preset Pills
function setupCanvasQuickBar() {
  $$('.aspect-pill-btn').forEach(btn => {
    btn.onclick = () => {
      const aspect = btn.dataset.aspect;
      state.framing.aspectRatio = aspect;
      $$('.aspect-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.aspect === aspect));

      const vContainer = $('#previewVideoContainer');
      if (vContainer) {
        vContainer.classList.remove('ar-9-16', 'ar-1-1', 'ar-16-9', 'ar-4-5');
        vContainer.classList.add(`ar-${aspect.replace(':', '-')}`);
      }

      if ($('#aspectRatio')) $('#aspectRatio').value = aspect;
      if ($('#editAspect')) $('#editAspect').value = aspect;
      updateLiveFramingPreview();
    };
  });

  $$('.preset-pill-btn').forEach(btn => {
    btn.onclick = () => {
      const preset = btn.dataset.preset;
      applyFramingPreset(preset);
    };
  });
}

function applyFramingPreset(preset) {
  state.framing.mode = preset;
  $$('.preset-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));

  const gamingHud = $('#gamingSplitPreviewHud');
  const podcastHud = $('#podcastStackPreviewHud');
  const gamingControls = $('#gamingControlsWrap');
  const podcastControls = $('#podcastControlsWrap');

  if (gamingHud) gamingHud.classList.toggle('hidden', preset !== 'gaming_split');
  if (podcastHud) podcastHud.classList.toggle('hidden', preset !== 'face_stack');
  if (gamingControls) gamingControls.classList.toggle('hidden', preset !== 'gaming_split');
  if (podcastControls) podcastControls.classList.toggle('hidden', preset !== 'face_stack');

  if ($('#framingPresetSelect')) $('#framingPresetSelect').value = preset;
  if ($('#editFramingMode')) $('#editFramingMode').value = preset;
  updateLiveFramingPreview();
}

// Gaming & Podcast Setup
function setupGamingAndPodcastControls() {
  const camPosSelect = $('#editGamingWebcamPos');
  if (camPosSelect) {
    camPosSelect.onchange = (e) => {
      if (!state.currentJob) return;
      if (!state.currentJob.options) state.currentJob.options = {};
      state.currentJob.options.webcamPosition = e.target.value;
      const hudBadge = $('#gamingHudPosBadge');
      if (hudBadge) hudBadge.textContent = e.target.value.toUpperCase();
    };
  }

  const camZoom = $('#editGamingCamZoom');
  const camZoomVal = $('#editGamingCamZoomVal');
  if (camZoom) {
    camZoom.oninput = (e) => {
      if (!state.currentJob) return;
      if (!state.currentJob.options) state.currentJob.options = {};
      state.currentJob.options.webcamZoom = Number(e.target.value);
      if (camZoomVal) camZoomVal.textContent = `${Number(e.target.value).toFixed(1)}x`;
    };
  }

  const podcastSpeaker = $('#editPodcastSpeaker');
  const podcastHudBanner = $('#podcastHudSpeakerBanner');
  if (podcastSpeaker) {
    podcastSpeaker.oninput = (e) => {
      if (!state.currentJob) return;
      if (!state.currentJob.options) state.currentJob.options = {};
      state.currentJob.options.podcastSpeaker = e.target.value;
      if (podcastHudBanner) podcastHudBanner.textContent = e.target.value || 'EPISODE 1 • PODCAST HOST';
    };
  }

  const applyCleanBtn = $('#applyCleanPodcastStyleBtn');
  if (applyCleanBtn) {
    applyCleanBtn.onclick = () => {
      if ($('#captionPresetSelect')) $('#captionPresetSelect').value = 'clean_subtitles';
      if ($('#editCapDisplayMode')) $('#editCapDisplayMode').value = 'line';
      if ($('#editCapFont')) $('#editCapFont').value = 'Inter';
      if ($('#editCapSize')) $('#editCapSize').value = '42';
      if ($('#editCapHighlight')) $('#editCapHighlight').value = '#00f2fe';
      if ($('#captionPreviewText')) {
        $('#captionPreviewText').style.fontFamily = 'Inter, sans-serif';
        $('#captionPreviewText').style.fontSize = '24px';
        $('#captionPreviewText').style.color = '#ffffff';
      }
      applyCleanBtn.textContent = '✅ Applied Clean Podcast Style!';
      setTimeout(() => {
        applyCleanBtn.textContent = '✨ 1-Click Apply Clean Podcast Captions Preset';
      }, 2000);
    };
  }
}

// CapCut Keyboard Shortcuts: Space (Play/Pause), S (Split), I (In), O (Out), Arrows
function setupCapCutShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('button,[role=button],[role=separator]')) return;
    if (document.getElementById('studioView')?.classList.contains('hidden')) return;
    if (document.querySelector('.modal-backdrop:not(.hidden),.companion-customize:not([hidden]),dialog[open]')) return;
    if (e.target.closest('.template-card,.cps-preset-card,.framing-mode-card')) return;
    const key = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayAction();
    } else if (key === 's') {
      e.preventDefault();
      splitAtPlayheadAction();
    } else if (key === 'i') {
      e.preventDefault();
      setClipInAction();
    } else if (key === 'o') {
      e.preventDefault();
      setClipOutAction();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - (e.shiftKey ? 2 : 0.5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      videoEl.currentTime = Math.min(videoEl.duration || 9999, videoEl.currentTime + (e.shiftKey ? 2 : 0.5));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteClipAction();
    }
  });
}

const reanalyzeBtn = $('#reanalyzeClipsBtn');
if (reanalyzeBtn) {
  reanalyzeBtn.onclick = async () => {
    if (!state.currentJob) return;
    if (!confirm('Re-score and discover viral clips using the upgraded viral criteria? This will update the ranked clips list.')) return;
    reanalyzeBtn.disabled = true;
    reanalyzeBtn.textContent = '⏳ Re-Scoring...';
    try {
      const res = await fetch(`/api/jobs/${state.currentJob.id}/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratingSystem: $('#studioRatingSystemSelect')?.value || $('#activeRatingSystemSelect')?.value || 'hollywood',
          clipCount: Number($('#clipCount')?.value || 5),
          minScore: Number($('#advMinScore')?.value || 75),
          hookSensitivity: $('#advHookSensitivity')?.value || 'aggressive',
          energyBias: $('#advEnergyBias')?.value || 'auto',
          nicheKeywords: $('#advNicheKeywords')?.value || ''
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to re-analyze');
      }
      const updated = await res.json();
      state.currentJob = updated;
      renderClipsList();
      renderTimelineMarkers();
      if (updated.clips && updated.clips.length > 0) {
        selectClip(updated.clips[0].id);
      }
      alert(`⚡ Successfully re-scored ${updated.clips.length} viral clips!`);
    } catch (err) {
      alert('Error re-scoring clips: ' + err.message);
    } finally {
      reanalyzeBtn.disabled = false;
      reanalyzeBtn.textContent = '⚡ Re-Score Clips';
    }
  };
}

// 7. Mode Switcher & Subpanels
$('#modeQuick').onclick = () => {
  state.mode = 'quick';
  $('#modeQuick').classList.add('active');
  $('#modeEditor').classList.remove('active');
};

$('#modeEditor').onclick = () => {
  state.mode = 'editor';
  $('#modeEditor').classList.add('active');
  $('#modeQuick').classList.remove('active');
};

$$('.editor-tab').forEach(b => {
  b.onclick = () => {
    state.activeSubtab = b.dataset.subtab;
    $$('.editor-tab').forEach(x => x.classList.toggle('active', x === b));
    $('#subCaptions').classList.toggle('hidden', state.activeSubtab !== 'captions');
    $('#subFraming').classList.toggle('hidden', state.activeSubtab !== 'framing');
    $('#subWatermark').classList.toggle('hidden', state.activeSubtab !== 'watermark');
    $('#subOverlays').classList.toggle('hidden', state.activeSubtab !== 'overlays');
    $('#subTranscript').classList.toggle('hidden', state.activeSubtab !== 'transcript');

    if ($('#subBeast')) $('#subBeast').classList.toggle('hidden', state.activeSubtab !== 'beast');
  };
});

// 8. Transcript View & Editing
function renderTranscript() {
  const container = $('#transcriptList');
  const transcript = state.currentJob?.transcript;
  if (!transcript || !transcript.segments || transcript.segments.length === 0) {
    container.innerHTML = '<p class="muted">No spoken dialogue detected.</p>';
    return;
  }

  container.innerHTML = transcript.segments.map(seg => `
    <div class="transcript-row" data-start="${seg.start}" data-end="${seg.end}">
      <span class="ts-time">${formatTime(seg.start)}</span>
      <div class="ts-text" contenteditable="true" data-seg-id="${seg.id}">${seg.text}</div>
      <div class="ts-row-actions">
        <button type="button" class="ts-action-pill set-start-pill" data-start="${seg.start}" title="Set active clip start to ${formatTime(seg.start)}">⏮ Start</button>
        <button type="button" class="ts-action-pill set-end-pill" data-end="${seg.end}" title="Set active clip end to ${formatTime(seg.end)}">End ⏭</button>
      </div>
    </div>
  `).join('');

  $$('.transcript-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.classList.contains('ts-text') || e.target.classList.contains('ts-action-pill')) return;
      seekTo(Number(row.dataset.start));
    };
  });

  $$('.set-start-pill').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
      if (!clip) return;
      const start = Number(btn.dataset.start);
      if (start < clip.end) {
        clip.start = Math.round(start * 10) / 10;
        syncManualClipBounds(clip);
        renderCapCutTimeline();
        renderClipsList();
        saveClipsToServer();
      }
    };
  });

  $$('.set-end-pill').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const clip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
      if (!clip) return;
      const end = Number(btn.dataset.end);
      if (end > clip.start) {
        clip.end = Math.round(end * 10) / 10;
        syncManualClipBounds(clip);
        renderCapCutTimeline();
        renderClipsList();
        saveClipsToServer();
      }
    };
  });
}

$('#saveTranscriptBtn').onclick = async () => {
  if (!state.currentJob?.transcript) return;
  const btn = $('#saveTranscriptBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const rows = $$('.ts-text');
    rows.forEach(r => {
      const segId = Number(r.dataset.segId);
      const seg = state.currentJob.transcript.segments.find(s => s.id === segId);
      if (seg) seg.text = r.innerText.trim();
    });

    await api(`/api/jobs/${state.currentJob.id}/transcript`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: state.currentJob.transcript })
    });
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = '💾 Save Transcript Edits'; btn.disabled = false; }, 1500);
  } catch (err) {
    alert(`Failed to save transcript: ${err.message}`);
    btn.disabled = false;
  }
};

// 9. Rendering Pipeline Execution
$('#renderBtn').onclick = async () => {
  if (!state.currentJob) return;
  const exportClips = typeof window.getEditorExportClips === 'function' ? window.getEditorExportClips() : state.currentJob.clips;
  if (!exportClips.length) { alert('Choose at least one clip to export.'); return; }
  const btn = $('#renderBtn');
  btn.disabled = true;
  btn.textContent = 'Rendering...';

  try {
    // Gather active framing and styling overrides
    const renderOptions = {
      ...state.currentJob.options,
      captionsEnabled: true,
      captionPreset: $('#captionPresetSelect').value,
      captionStyle: {
        displayMode: $('#editCapDisplayMode').value,
        fontFamily: $('#editCapFont').value,
        fontSize: Number($('#editCapSize').value),
        highlightColor: $('#editCapHighlight').value,
        primaryColor: $('#editCapColor').value,
        position: $('#editCapPos').value,
        emojiEnabled: $('#editCapEmoji').checked,
        profanityMask: $('#editCapProfanity').checked
      },
      framingMode: state.framing?.mode || $('#editFramingMode').value,
      webcamPosition: $('#editGamingWebcamPos')?.value || state.currentJob.options?.webcamPosition || 'top-right',
      webcamZoom: Number($('#editGamingCamZoom')?.value || state.currentJob.options?.webcamZoom || 1.0),
      podcastSpeaker: $('#editPodcastSpeaker')?.value || state.currentJob.options?.podcastSpeaker || '',
      aspectRatio: state.framing?.aspectRatio || $('#editAspect').value,
      zoom: Number(state.framing?.zoom || $('#editZoom').value || 1.0),
      panX: Number(state.framing?.panX) || 0,
      panY: Number(state.framing?.panY) || 0,
      bgColor: state.framing?.bgColor || '#000000',
      headline: $('#editHeadline').value.trim(),
      watermark: getWatermarkOptions(),
      progressBar: $('#editProgressBar')?.checked ?? true,
      hookStitcher: $('#editHookStitcher')?.checked ?? true,
      autoMemes: $('#editAutoMemes')?.checked ?? state.currentJob.options?.autoMemes ?? true,
      memeSoundEnabled: $('#editMemeSoundEnabled')?.checked ?? true,
      overlays: getActiveClipOverlays(state.activeClipId),
      uploadToDrive: $('#uploadDrive').checked,
      trashOriginalInDrive: $('#trashDriveOriginal').checked,
      deleteOriginalAfterSuccess: $('#cleanupLocal').checked,
      ...(typeof window.getEditorRenderOverrides === 'function' ? window.getEditorRenderOverrides() : {})
    };

    await api(`/api/jobs/${state.currentJob.id}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: exportClips, options: renderOptions })
    });

    // Start polling render progress
    pollRenderProgress(state.currentJob.id);
  } catch (err) {
    if (err.message && (err.message.includes('Weekly limit') || err.message.includes('quota') || err.message.includes('Free Pass') || err.message.includes('expired'))) {
      openLicenseModal(err.message);
    } else {
      alert(`Render failed to start: ${err.message}`);
    }
    btn.disabled = false;
    btn.textContent = 'Render Selected Clips';
  }
};

function pollRenderProgress(jobId) {
  const btn = $('#renderBtn');
  const interval = setInterval(async () => {
    try {
      const j = await api(`/api/jobs/${jobId}`);
      const idx = state.jobs.findIndex(x => x.id === jobId);
      if (idx >= 0) state.jobs[idx] = j;

      if (j.progress) {
        btn.textContent = `${j.progress.message} (${j.progress.percent}%)`;
      }

      if (j.status === 'complete') {
        clearInterval(interval);
        btn.disabled = false;
        btn.textContent = 'Render Selected Clips';
        state.currentJob = j;
        renderOutputs(j.outputs || []);
        renderJobs();
      } else if (j.status === 'failed') {
        clearInterval(interval);
        btn.disabled = false;
        btn.textContent = 'Render Selected Clips';
        alert(`Render failed: ${j.error}`);
        renderJobs();
      }
    } catch {
      clearInterval(interval);
      btn.disabled = false;
      btn.textContent = 'Render Selected Clips';
    }
  }, 1200);
}

function renderOutputs(outputs) {
  const section = $('#outputsSection');
  const container = $('#outputsList');

  if (!outputs || outputs.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = outputs.map(o => `
    <div class="output-card">
      <video src="${o.url}" controls playsinline preload="metadata"></video>
      <div class="output-info">
        <strong>${o.name}</strong>
        <small>${o.width || 1080}×${o.height || 1920} · ${Math.round(o.duration || 30)}s · ${(o.size / (1024 * 1024)).toFixed(1)} MB</small>
      </div>
      <div class="output-links">
        <a class="download-link" href="${o.url}" download>⬇ Download</a>
        <button type="button" class="pill-btn primary-pill sched-out-btn" data-url="${o.url}" data-name="${o.name.replace(/"/g, '&quot;')}" style="font-size: 11px; padding: 4px 10px;">📅 Schedule Post</button>
        ${o.drive?.webViewLink ? `<a class="drive-link" href="${o.drive.webViewLink}" target="_blank">☁ Drive</a>` : ''}
      </div>
    </div>
  `).join('');

  $$('.sched-out-btn').forEach(btn => {
    btn.onclick = () => {
      openSchedulerWithClip({
        name: btn.dataset.name,
        url: btn.dataset.url,
        jobId: state.currentJob?.id,
        isRendered: true
      });
    };
  });

  // Update verification badge
  const badge = $('#verificationBadge');
  if (state.currentJob?.originalRemoved) {
    badge.textContent = '✔ All Outputs Verified · Local Original Cleaned Up';
  } else if (state.currentJob?.driveOriginalTrashed) {
    badge.textContent = '✔ All Outputs Verified · Drive Original Moved to Trash';
  } else {
    badge.textContent = '✔ All Outputs Verified · Source Retained Safely';
  }
}

// 10. History List Rendering
function renderJobs() {
  const container = $('#jobsList');
  if (!state.jobs.length) {
    container.innerHTML = '<p class="muted">Your processed projects will appear here.</p>';
    return;
  }

  container.innerHTML = state.jobs.map(j => `
    <div class="job-item" data-job-id="${j.id}">
      <div class="job-info">
        <strong>${j.sourceName}</strong>
        <small>${Math.round(j.duration / 60)} min · ${j.clips?.length || 0} clips · ${new Date(j.createdAt).toLocaleDateString()}</small>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button type="button" class="pill-btn watch-job-btn" data-job-id="${j.id}" style="padding: 2px 8px; font-size: 11px; background: rgba(255, 50, 0, 0.15); border: 1px solid rgba(255, 50, 0, 0.35); color: #ff5533; cursor: pointer;" title="Open in Cinema Watcher">📺 Watch</button>
        <span class="job-status-pill ${j.status}">${j.status}</span>
      </div>
    </div>
  `).join('');

  $$('.job-item').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('.watch-job-btn')) return;
      const job = state.jobs.find(x => x.id === el.dataset.jobId);
      if (job) showJob(job, true);
    };
  });

  $$('.watch-job-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const job = state.jobs.find(x => x.id === btn.dataset.jobId);
      if (job) {
        state.currentJob = job;
        window.switchAppView('watch');
        if (typeof loadStreamIntoCinema === 'function') loadStreamIntoCinema(job);
      }
    };
  });
}

// 11. Modals: Google Drive, Gemini AI, System Diagnostics
$('#driveBadge').onclick = () => $('#driveModal').classList.remove('hidden');
$('#closeDriveModal').onclick = () => $('#driveModal').classList.add('hidden');

$('#saveAndConnectDriveBtn').onclick = async () => {
  const btn = $('#saveAndConnectDriveBtn');
  const clientId = $('#driveClientId').value.trim();
  const clientSecret = $('#driveClientSecret').value.trim();

  if (clientId && clientSecret) {
    btn.disabled = true;
    btn.textContent = 'Saving configuration...';
    try {
      await api('/api/drive/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret })
      });
      location.href = '/api/drive/connect';
    } catch (err) {
      alert(`Configuration error: ${err.message}`);
      btn.disabled = false;
      btn.textContent = 'Save & Authorize with Google';
    }
  } else {
    // If already configured, proceed to connect
    location.href = '/api/drive/connect';
  }
};

$('#geminiBadge').onclick = () => {
  $('#geminiApiKeyInput').value = state.settings?.geminiApiKey || '';
  $('#geminiModal').classList.remove('hidden');
};
$('#closeGeminiModal').onclick = () => $('#geminiModal').classList.add('hidden');
$('#saveGeminiBtn').onclick = async () => {
  const key = $('#geminiApiKeyInput').value.trim();
  await api('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geminiApiKey: key })
  });
  state.settings.geminiApiKey = key;
  updateHeaderStatus();
  $('#geminiModal').classList.add('hidden');
};

$('#sysStatusBtn').onclick = () => {
  if (typeof window.switchAppView === 'function') {
    window.switchAppView('processes');
  }
};
$('#closeSysModal').onclick = () => $('#sysModal').classList.add('hidden');

// ========================================================
// PHONE CAPTION STUDIO (MOBILE VISUALIZER & CUSTOMIZER)
// ========================================================
function openPhoneCaptionStudio() {
  const previewVid = $('#previewVideo');
  const phoneVid = $('#cpsPhoneVideo');
  if (previewVid && previewVid.src && phoneVid) {
    phoneVid.src = previewVid.src;
    try { phoneVid.currentTime = previewVid.currentTime || 0; } catch {}
    phoneVid.play().catch(() => {});
  }

  // Update title
  const activeClip = state.currentJob?.clips?.find(c => c.id === state.activeClipId);
  const titleEl = $('#cpsPhoneClipTitle');
  if (titleEl) {
    titleEl.textContent = activeClip?.hook || activeClip?.title || 'The craziest moment from stream today 🔥';
  }

  // Update caption sample text
  updatePhoneCaptionSample();
}

function updatePhoneCaptionSample() {
  const captionBox = $('#cpsPhoneCaptionBox');
  const captionText = $('#cpsPhoneCaptionText');
  if (!captionBox || !captionText) return;

  const font = $('#cpsFontSelect')?.value || 'Montserrat';
  const size = Number($('#cpsFontSizeRange')?.value || 44);
  const highlight = $('#cpsHighlightColor')?.value || '#facc15';
  const primary = $('#cpsPrimaryColor')?.value || '#ffffff';
  const mode = $('#cpsDisplayModeSelect')?.value || 'pop';
  const hasEmoji = $('#cpsEmojiToggle')?.checked ?? true;

  captionText.style.fontFamily = `"${font}", sans-serif`;
  captionText.style.fontSize = `${Math.round(size * 0.52)}px`;
  captionText.style.color = primary;

  // Generate realistic styled preview
  let sampleHtml = '';
  if (mode === 'pop') {
    sampleHtml = `WAIT FOR THE <span class="phone-highlight-word" style="color: ${highlight};">CRAZIEST</span> PART! ${hasEmoji ? '😱' : ''}`;
  } else if (mode === 'phrase') {
    sampleHtml = `<span style="color: ${primary};">THIS WILL CHANGE</span> <span class="phone-highlight-word" style="color: ${highlight};">EVERYTHING</span> ${hasEmoji ? '🚀' : ''}`;
  } else {
    sampleHtml = `<span style="color: ${primary};">The entire journey was about this moment</span> ${hasEmoji ? '✨' : ''}`;
  }
  captionText.innerHTML = sampleHtml;
}

function setupPhoneCaptionStudio() {
  const phoneVid = $('#cpsPhoneVideo');
  const playBtn = $('#cpsPlayPauseBtn');
  const timecode = $('#cpsTimecode');

  if (phoneVid) {
    phoneVid.ontimeupdate = () => {
      if (timecode) {
        timecode.textContent = `${formatTime(phoneVid.currentTime)} / ${formatTime(phoneVid.duration || 1)}`;
      }
    };
  }

  if (playBtn && phoneVid) {
    playBtn.onclick = () => {
      if (phoneVid.paused) {
        phoneVid.play();
        playBtn.textContent = '⏸ Pause Phone Video';
      } else {
        phoneVid.pause();
        playBtn.textContent = '▶ Play Phone Video';
      }
    };
  }

  // Preset Cards click
  $$('.cps-preset-card').forEach(card => {
    card.onclick = () => {
      const preset = card.dataset.preset;
      $$('.cps-preset-card').forEach(c => c.classList.toggle('active', c.dataset.preset === preset));
      applyCaptionPresetToPhone(preset);
    };
  });

  // Position Buttons
  $$('.cps-pos-button-group .pos-btn').forEach(btn => {
    btn.onclick = () => {
      const pos = btn.dataset.pos;
      $$('.cps-pos-button-group .pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === pos));
      setPhoneCaptionPosition(pos);
    };
  });

  // Toggle Position Guide Zones
  const toggleGuidesBtn = $('#cpsToggleGuidesBtn');
  const guides = $('#cpsPosGuides');
  if (toggleGuidesBtn && guides) {
    toggleGuidesBtn.onclick = () => {
      guides.classList.toggle('hidden');
    };
  }

  // Click inside Guide Zones
  $$('.pos-guide-zone').forEach(zone => {
    zone.onclick = () => {
      const pos = zone.dataset.pos;
      $$('.cps-pos-button-group .pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === pos));
      setPhoneCaptionPosition(pos);
      if (guides) guides.classList.add('hidden');
    };
  });

  // Font Select
  const fontSelect = $('#cpsFontSelect');
  if (fontSelect) {
    fontSelect.onchange = () => {
      updatePhoneCaptionSample();
      if ($('#editCapFont')) $('#editCapFont').value = fontSelect.value;
    };
  }

  // Font Size Slider
  const sizeRange = $('#cpsFontSizeRange');
  const sizeVal = $('#cpsFontSizeVal');
  if (sizeRange) {
    sizeRange.oninput = (e) => {
      if (sizeVal) sizeVal.textContent = `${e.target.value}px`;
      updatePhoneCaptionSample();
      if ($('#editCapSize')) $('#editCapSize').value = e.target.value;
    };
  }

  // Highlight Color
  const highlightInput = $('#cpsHighlightColor');
  if (highlightInput) {
    highlightInput.oninput = (e) => {
      updatePhoneCaptionSample();
      if ($('#editCapHighlight')) $('#editCapHighlight').value = e.target.value;
    };
  }

  // Quick Swatches
  $$('.color-quick-swatches .c-swatch').forEach(swatch => {
    swatch.onclick = () => {
      const color = swatch.dataset.color;
      if (highlightInput) highlightInput.value = color;
      updatePhoneCaptionSample();
      if ($('#editCapHighlight')) $('#editCapHighlight').value = color;
    };
  });

  // Primary Color
  const primaryInput = $('#cpsPrimaryColor');
  if (primaryInput) {
    primaryInput.oninput = (e) => {
      updatePhoneCaptionSample();
      if ($('#editCapColor')) $('#editCapColor').value = e.target.value;
    };
  }

  // Display Mode
  const modeSelect = $('#cpsDisplayModeSelect');
  if (modeSelect) {
    modeSelect.onchange = () => {
      updatePhoneCaptionSample();
      if ($('#editCapDisplayMode')) $('#editCapDisplayMode').value = modeSelect.value;
    };
  }

  // Emoji & Profanity
  const emojiToggle = $('#cpsEmojiToggle');
  if (emojiToggle) {
    emojiToggle.onchange = () => {
      updatePhoneCaptionSample();
      if ($('#editCapEmoji')) $('#editCapEmoji').checked = emojiToggle.checked;
    };
  }
  const profanityToggle = $('#cpsProfanityToggle');
  if (profanityToggle) {
    profanityToggle.onchange = () => {
      if ($('#editCapProfanity')) $('#editCapProfanity').checked = profanityToggle.checked;
    };
  }

  // Back / Save
  const backBtn = $('#cpsBackToStudioBtn');
  const saveCloseBtn = $('#cpsSaveAndCloseBtn');
  const returnToStudio = () => {
    if (phoneVid) phoneVid.pause();
    syncCaptionSettingsFromPhone();
    window.switchAppView('studio');
  };
  if (backBtn) backBtn.onclick = returnToStudio;
  if (saveCloseBtn) saveCloseBtn.onclick = returnToStudio;

  // Apply to All Clips
  const applyAllBtn = $('#cpsApplyAllBtn');
  if (applyAllBtn) {
    applyAllBtn.onclick = () => {
      syncCaptionSettingsFromPhone();
      if (phoneVid) phoneVid.pause();
      applyAllBtn.textContent = '✅ Style Saved & Applied to All Clips!';
      setTimeout(() => {
        applyAllBtn.textContent = '✨ Apply Style to All Clips & Return';
        window.switchAppView('studio');
      }, 1200);
    };
  }
}

function setPhoneCaptionPosition(pos) {
  const box = $('#cpsPhoneCaptionBox');
  if (!box) return;
  box.classList.remove('pos-top', 'pos-center', 'pos-lower');
  box.classList.add(`pos-${pos}`);
  if ($('#editCapPos')) {
    $('#editCapPos').value = (pos === 'lower' ? 'bottom' : pos);
  }
}

function applyCaptionPresetToPhone(preset) {
  const fontSelect = $('#cpsFontSelect');
  const sizeRange = $('#cpsFontSizeRange');
  const sizeVal = $('#cpsFontSizeVal');
  const highlightInput = $('#cpsHighlightColor');
  const primaryInput = $('#cpsPrimaryColor');
  const modeSelect = $('#cpsDisplayModeSelect');
  const emojiToggle = $('#cpsEmojiToggle');

  if (preset === 'viral_pop') {
    if (fontSelect) fontSelect.value = 'Montserrat';
    if (sizeRange) sizeRange.value = 46;
    if (sizeVal) sizeVal.textContent = '46px';
    if (highlightInput) highlightInput.value = '#facc15';
    if (primaryInput) primaryInput.value = '#ffffff';
    if (modeSelect) modeSelect.value = 'pop';
    if (emojiToggle) emojiToggle.checked = true;
    setPhoneCaptionPosition('lower');
  } else if (preset === 'beast_electric') {
    if (fontSelect) fontSelect.value = 'Impact';
    if (sizeRange) sizeRange.value = 50;
    if (sizeVal) sizeVal.textContent = '50px';
    if (highlightInput) highlightInput.value = '#39ff14';
    if (primaryInput) primaryInput.value = '#00f2fe';
    if (modeSelect) modeSelect.value = 'pop';
    if (emojiToggle) emojiToggle.checked = true;
    setPhoneCaptionPosition('center');
  } else if (preset === 'clean_subtitles') {
    if (fontSelect) fontSelect.value = 'Inter';
    if (sizeRange) sizeRange.value = 36;
    if (sizeVal) sizeVal.textContent = '36px';
    if (highlightInput) highlightInput.value = '#00f2fe';
    if (primaryInput) primaryInput.value = '#ffffff';
    if (modeSelect) modeSelect.value = 'line';
    if (emojiToggle) emojiToggle.checked = false;
    setPhoneCaptionPosition('lower');
  } else if (preset === 'cyber_neon') {
    if (fontSelect) fontSelect.value = 'Montserrat';
    if (sizeRange) sizeRange.value = 44;
    if (sizeVal) sizeVal.textContent = '44px';
    if (highlightInput) highlightInput.value = '#ff007a';
    if (primaryInput) primaryInput.value = '#00f2fe';
    if (modeSelect) modeSelect.value = 'phrase';
    if (emojiToggle) emojiToggle.checked = true;
    setPhoneCaptionPosition('lower');
  } else if (preset === 'karaoke_fill') {
    if (fontSelect) fontSelect.value = 'Montserrat';
    if (sizeRange) sizeRange.value = 42;
    if (sizeVal) sizeVal.textContent = '42px';
    if (highlightInput) highlightInput.value = '#d8ff3e';
    if (primaryInput) primaryInput.value = '#94a3b8';
    if (modeSelect) modeSelect.value = 'phrase';
    if (emojiToggle) emojiToggle.checked = false;
    setPhoneCaptionPosition('lower');
  } else if (preset === 'netflix_box') {
    if (fontSelect) fontSelect.value = 'Inter';
    if (sizeRange) sizeRange.value = 34;
    if (sizeVal) sizeVal.textContent = '34px';
    if (highlightInput) highlightInput.value = '#ffffff';
    if (primaryInput) primaryInput.value = '#ffffff';
    if (modeSelect) modeSelect.value = 'line';
    if (emojiToggle) emojiToggle.checked = false;
    setPhoneCaptionPosition('lower');
  }

  if ($('#captionPresetSelect')) $('#captionPresetSelect').value = preset;

  updatePhoneCaptionSample();
  syncCaptionSettingsFromPhone();
}

function syncCaptionSettingsFromPhone() {
  const font = $('#cpsFontSelect')?.value || 'Montserrat';
  const size = Number($('#cpsFontSizeRange')?.value || 44);
  const highlight = $('#cpsHighlightColor')?.value || '#facc15';
  const primary = $('#cpsPrimaryColor')?.value || '#ffffff';
  const mode = $('#cpsDisplayModeSelect')?.value || 'pop';
  const emoji = $('#cpsEmojiToggle')?.checked ?? true;
  const profanity = $('#cpsProfanityToggle')?.checked ?? true;
  const posBtn = $('.cps-pos-button-group .pos-btn.active')?.dataset.pos || 'lower';
  const pos = posBtn === 'lower' ? 'bottom' : posBtn;

  if ($('#editCapFont')) $('#editCapFont').value = font;
  if ($('#editCapSize')) $('#editCapSize').value = size;
  if ($('#editCapHighlight')) $('#editCapHighlight').value = highlight;
  if ($('#editCapColor')) $('#editCapColor').value = primary;
  if ($('#editCapDisplayMode')) $('#editCapDisplayMode').value = mode;
  if ($('#editCapPos')) $('#editCapPos').value = pos;
  if ($('#editCapEmoji')) $('#editCapEmoji').checked = emoji;
  if ($('#editCapProfanity')) $('#editCapProfanity').checked = profanity;

  const livePreview = $('#captionPreviewText');
  if (livePreview) {
    livePreview.style.fontFamily = `"${font}", sans-serif`;
    livePreview.style.color = primary;
  }
}

// ========================================================
// POST SCHEDULER & MULTI-ACCOUNT AUTOMATION SYSTEM
// ========================================================

function setupSchedulerControls() {
  const railIngest = $('#railIngestBtn');
  const navStudio = $('#navStudioBtn');
  const navCaption = $('#navCaptionPhoneBtn');
  const navWatch = $('#navWatchBtn');
  const navScheduler = $('#navSchedulerBtn');
  const navProcesses = $('#navProcessesBtn');
  const ingestView = $('#ingestView');
  const studioView = $('#studioView');
  const captionPhoneView = $('#captionPhoneView');
  const watchView = $('#watchView');
  const schedulerView = $('#schedulerView');
  const processesView = $('#processesView');

  // Top Nav Switching
  window.switchAppView = (view) => {
    state.scheduler.activeView = view;
    const activePlayer = {studio:'previewVideo',captions:'cpsPhoneVideo',watch:'cinemaVideo'}[view];
    document.querySelectorAll('video').forEach(player => {
      if (player.id !== activePlayer && !player.paused) player.pause();
    });
    if (railIngest) railIngest.classList.toggle('active', view === 'ingest');
    if (navStudio) navStudio.classList.toggle('active', view === 'studio');
    if (navCaption) navCaption.classList.toggle('active', view === 'captions');
    if (navWatch) navWatch.classList.toggle('active', view === 'watch');
    if (navScheduler) navScheduler.classList.toggle('active', view === 'scheduler');
    if (navProcesses) navProcesses.classList.toggle('active', view === 'processes');

    if (ingestView) ingestView.classList.toggle('hidden', view !== 'ingest' && view !== 'max');
    const railMax = $('#railMaxAutomateBtn');
    if (railMax) railMax.classList.toggle('active', view === 'max');
    if (view === 'max') {
      state.activeTab = 'max';
      $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'max'));
      $('#filePane')?.classList.add('hidden');
      $('#urlPane')?.classList.add('hidden');
      const maxPane = $('#maxPane');
      if (maxPane) {
        maxPane.classList.remove('hidden');
        maxPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => $('#maxChannelUrl')?.focus(), 100);
    }
    if (studioView) studioView.classList.toggle('hidden', view !== 'studio');
    if (captionPhoneView) captionPhoneView.classList.toggle('hidden', view !== 'captions');
    if (watchView) watchView.classList.toggle('hidden', view !== 'watch');
    if (schedulerView) schedulerView.classList.toggle('hidden', view !== 'scheduler');
    if (processesView) processesView.classList.toggle('hidden', view !== 'processes');

    if (view === 'studio') {
      const hasJob = !!state.currentJob;
      const emptyState = $('#studioEmptyState');
      const ws = $('#workspace');
      if (emptyState) emptyState.classList.toggle('hidden', hasJob);
      if (ws) ws.classList.toggle('hidden', !hasJob);
      if (hasJob && typeof renderCapCutTimeline === 'function') {
        renderCapCutTimeline();
      }
    } else if (view === 'captions') {
      if (typeof openPhoneCaptionStudio === 'function') {
        openPhoneCaptionStudio();
      }
    } else if (view === 'scheduler') {
      loadSchedulerData();
    } else if (view === 'watch') {
      if (typeof initCinemaView === 'function') {
        initCinemaView();
      }
    } else if (view === 'processes') {
      if (typeof window.refreshDiagnostics === 'function') {
        window.refreshDiagnostics();
      }
    }
  };

  if (railIngest) railIngest.onclick = () => window.switchAppView('ingest');
  if (navStudio) navStudio.onclick = () => window.switchAppView('studio');
  if (navCaption) navCaption.onclick = () => window.switchAppView('captions');
  if (navWatch) navWatch.onclick = () => window.switchAppView('watch');
  if (navScheduler) navScheduler.onclick = () => window.switchAppView('scheduler');
  if (navProcesses) navProcesses.onclick = () => window.switchAppView('processes');

  const emptyToIngest = $('#emptyToIngestBtn');
  if (emptyToIngest) emptyToIngest.onclick = () => window.switchAppView('ingest');

  const openPhoneFromHeader = $('#openPhoneCaptionFromHeaderBtn');
  if (openPhoneFromHeader) openPhoneFromHeader.onclick = () => window.switchAppView('captions');

  const openPhoneFromSub = $('#openPhoneCaptionStudioBtn');
  if (openPhoneFromSub) openPhoneFromSub.onclick = () => window.switchAppView('captions');

  const railHistory = $('#railHistoryBtn');
  if (railHistory) {
    railHistory.onclick = () => {
      window.switchAppView('ingest');
      $('.history-section')?.scrollIntoView({ behavior: 'smooth' });
    };
  }

  // Sub-panel tabs
  const tabCompose = $('#schedTabComposeBtn');
  const tabAccounts = $('#schedTabAccountsBtn');
  const tabQueue = $('#schedTabQueueBtn');
  const tabAnalytics = $('#schedTabAnalyticsBtn');
  const panelCompose = $('#schedComposePanel');
  const panelAccounts = $('#schedAccountsPanel');
  const panelQueue = $('#schedQueuePanel');
  const panelAnalytics = $('#schedAnalyticsPanel');

  window.switchSchedulerSubTab = (tab) => {
    state.scheduler.subTab = tab;
    if (tabCompose) tabCompose.classList.toggle('active', tab === 'compose');
    if (tabAccounts) tabAccounts.classList.toggle('active', tab === 'accounts');
    if (tabQueue) tabQueue.classList.toggle('active', tab === 'queue');
    if (tabAnalytics) tabAnalytics.classList.toggle('active', tab === 'analytics');

    if (panelCompose) panelCompose.classList.toggle('hidden', tab !== 'compose');
    if (panelAccounts) panelAccounts.classList.toggle('hidden', tab !== 'accounts');
    if (panelQueue) panelQueue.classList.toggle('hidden', tab !== 'queue');
    if (panelAnalytics) panelAnalytics.classList.toggle('hidden', tab !== 'analytics');

    if (tab === 'compose') {
      loadAvailableClips();
      renderAllTagAndPresetViews();
    }
    if (tab === 'accounts') renderFullAccountsManager();
    if (tab === 'queue') loadScheduledQueue();
    if (tab === 'analytics') loadShortsAnalytics();
  };

  if (tabCompose) tabCompose.onclick = () => window.switchSchedulerSubTab('compose');
  if (tabAccounts) tabAccounts.onclick = () => window.switchSchedulerSubTab('accounts');
  if (tabQueue) tabQueue.onclick = () => window.switchSchedulerSubTab('queue');
  if (tabAnalytics) tabAnalytics.onclick = () => window.switchSchedulerSubTab('analytics');

  const refreshAnalyticsBtn = $('#refreshAnalyticsBtn');
  if (refreshAnalyticsBtn) refreshAnalyticsBtn.onclick = () => loadShortsAnalytics(true);

  // Video Source Toggle for Scheduler (Studio Clips vs PC Video Upload)
  const tabStudioClips = $('#schedTabStudioClips');
  const tabPcVideo = $('#schedTabPcVideo');
  const studioClipWrap = $('#schedStudioClipWrap');
  const pcVideoWrap = $('#schedPcVideoWrap');
  const pcFileInput = $('#schedPcFileInput');
  const pcDropZone = $('#schedPcDropZone');
  const pcFileBadge = $('#schedPcFileBadge');

  if (tabStudioClips && tabPcVideo) {
    tabStudioClips.onclick = () => {
      tabStudioClips.className = 'pill-btn primary-pill active-tab';
      tabStudioClips.style.background = '';
      tabStudioClips.style.color = '';
      tabPcVideo.className = 'pill-btn';
      tabPcVideo.style.border = '1px solid var(--border-color)';
      tabPcVideo.style.background = 'transparent';
      tabPcVideo.style.color = 'var(--text-muted)';
      if (studioClipWrap) studioClipWrap.classList.remove('hidden');
      if (pcVideoWrap) pcVideoWrap.classList.add('hidden');
    };

    tabPcVideo.onclick = () => {
      tabPcVideo.className = 'pill-btn primary-pill active-tab';
      tabPcVideo.style.background = '#7157FF';
      tabPcVideo.style.color = '#fff';
      tabStudioClips.className = 'pill-btn';
      tabStudioClips.style.border = '1px solid var(--border-color)';
      tabStudioClips.style.background = 'transparent';
      tabStudioClips.style.color = 'var(--text-muted)';
      if (studioClipWrap) studioClipWrap.classList.add('hidden');
      if (pcVideoWrap) pcVideoWrap.classList.remove('hidden');
    };
  }

  // Handle uploading video file directly from PC into Scheduler
  async function handleSchedPcFileUpload(file) {
    if (!file) return;
    if (pcFileBadge) {
      pcFileBadge.style.display = 'inline-block';
      pcFileBadge.style.background = '#e67e22';
      pcFileBadge.textContent = `⏳ Loading ${file.name}...`;
    }

    try {
      const formData = new FormData();
      formData.append('video', file);

      const res = await api('/api/posts/upload-clip', {
        method: 'POST',
        body: formData
      });

      state.scheduler.selectedClip = res;

      if (pcFileBadge) {
        pcFileBadge.style.display = 'inline-block';
        pcFileBadge.style.background = '#27ae60';
        pcFileBadge.textContent = `✓ ${res.sourceName} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      }

      // Show video preview
      const previewWrap = $('#schedVideoPreviewWrap');
      const previewVid = $('#schedPreviewVideo');
      const titleEl = $('#schedPreviewTitle');
      const metaEl = $('#schedPreviewMeta');

      if (previewWrap) previewWrap.classList.remove('hidden');
      if (previewVid && res.videoUrl) previewVid.src = res.videoUrl;
      if (titleEl) titleEl.textContent = res.title;
      if (metaEl) metaEl.textContent = `${res.width}×${res.height} · PC Video (${res.duration}s)`;

      const titleInput = $('#schedTitleInput');
      if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = res.title;
      }

      const statusEl = $('#schedActionStatus');
      if (statusEl) statusEl.textContent = `✓ Loaded video "${res.sourceName}" from your PC. Ready to craft & schedule!`;
    } catch (err) {
      if (pcFileBadge) {
        pcFileBadge.style.display = 'inline-block';
        pcFileBadge.style.background = '#e74c3c';
        pcFileBadge.textContent = `Error: ${err.message}`;
      }
      alert(`Could not load video from PC: ${err.message}`);
    }
  }

  if (pcFileInput) {
    pcFileInput.onchange = (e) => {
      const f = e.target.files?.[0];
      if (f) handleSchedPcFileUpload(f);
    };
  }

  if (pcDropZone) {
    ['dragenter', 'dragover'].forEach(evt => {
      pcDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        pcDropZone.style.borderColor = '#D8FF3E';
        pcDropZone.style.background = 'rgba(216, 255, 62, 0.08)';
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      pcDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        pcDropZone.style.borderColor = '#7157FF';
        pcDropZone.style.background = 'rgba(113, 87, 255, 0.04)';
      });
    });

    pcDropZone.addEventListener('drop', e => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleSchedPcFileUpload(files[0]);
      }
    });
  }

  // Caption character counter
  const captionInput = $('#schedCaptionInput');
  if (captionInput) {
    captionInput.oninput = () => {
      const len = captionInput.value.length;
      const countEl = $('#schedCharCount');
      if (countEl) countEl.textContent = `${len} / 2,200 chars`;
    };
  }

  // ==========================================
  // TAG & PRESET MEMORY BANK SYSTEM
  // ==========================================

  function initPresetsState() {
    if (!state.presets) {
      try {
        const cached = localStorage.getItem('autoclip_presets');
        if (cached) state.presets = JSON.parse(cached);
      } catch (_) {}
    }
    if (!state.presets || !Array.isArray(state.presets.tags)) {
      state.presets = {
        tags: [
          '#DoubleCoverage',
          '#fyp',
          '#viral',
          '#shorts',
          '#reels',
          '#trending',
          '#podcast',
          '#highlights',
          '#foryou'
        ],
        titleHooks: [
          { id: 'hook_1', label: 'Wait until the end... 🤯', text: 'Wait until the end... 🤯 ' },
          { id: 'hook_2', label: 'Double Coverage |', text: 'Double Coverage | ' },
          { id: 'hook_3', label: "You won't believe this 😱", text: "You won't believe what happened... " },
          { id: 'hook_4', label: 'PART 1 🎬', text: 'PART 1: ' },
          { id: 'hook_5', label: 'INSANE Moment 🔥', text: 'THIS MOMENT WAS INSANE 🔥 ' }
        ],
        descriptionTemplates: [
          {
            id: 'desc_1',
            name: '📌 Channel Links & Bio',
            text: "Subscribe for daily highlights and moments! 🔔\nDrop a comment with your thoughts below 👇\n\nFollow us across platforms for more exclusive clips."
          },
          {
            id: 'desc_2',
            name: '🔥 Viral Clip CTA',
            text: "Wait till you hear the full story... 🤯\n\nLike and follow for part 2! Which moment hit hardest? 👇"
          },
          {
            id: 'desc_3',
            name: '🏈 Double Coverage Signature',
            text: "Double Coverage Moments — daily sports banter & top viral plays!\n\n🔔 Subscribe to never miss a drop.\n#DoubleCoverage #NFL #Shorts"
          }
        ]
      };
    }
  }

  function persistPresetsLocal() {
    try {
      localStorage.setItem('autoclip_presets', JSON.stringify(state.presets));
    } catch (_) {}
  }

  async function syncPresetsWithServer() {
    try {
      const serverPresets = await api('/api/presets');
      if (serverPresets && Array.isArray(serverPresets.tags)) {
        state.presets = serverPresets;
        persistPresetsLocal();
        renderAllTagAndPresetViews();
      }
    } catch (err) {
      console.warn('Could not sync presets with server:', err);
    }
  }

  async function addTagToMemory(rawTag) {
    if (!rawTag) return;
    let tag = rawTag.trim();
    if (!tag.startsWith('#')) tag = '#' + tag;
    tag = tag.replace(/[^\w#\u0590-\u05ff]/g, '');
    if (tag.length <= 1) return;

    initPresetsState();
    if (!state.presets.tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
      state.presets.tags.unshift(tag);
      persistPresetsLocal();
      renderAllTagAndPresetViews();
      try {
        await api('/api/presets/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag })
        });
      } catch (e) {
        console.warn('Tag save server sync error:', e);
      }
    }
  }

  async function autoRememberTagsFromPost(title, caption, hashtags) {
    const all = [];
    if (Array.isArray(hashtags)) all.push(...hashtags);
    if (title) {
      const m = title.match(/#[\w\u0590-\u05ff]+/g);
      if (m) all.push(...m);
    }
    if (caption) {
      const m = caption.match(/#[\w\u0590-\u05ff]+/g);
      if (m) all.push(...m);
    }
    if (!all.length) return;

    initPresetsState();
    let added = false;
    const existingSet = new Set(state.presets.tags.map(t => t.toLowerCase()));
    for (let raw of all) {
      let t = String(raw).trim();
      if (!t) continue;
      if (!t.startsWith('#')) t = '#' + t;
      t = t.replace(/[^\w#\u0590-\u05ff]/g, '');
      if (t.length <= 1) continue;
      if (!existingSet.has(t.toLowerCase())) {
        existingSet.add(t.toLowerCase());
        state.presets.tags.unshift(t);
        added = true;
      }
    }
    if (added) {
      persistPresetsLocal();
      renderAllTagAndPresetViews();
      try {
        await api('/api/presets/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: all })
        });
      } catch (_) {}
    }
  }

  async function deleteTagFromMemory(tag) {
    initPresetsState();
    const target = tag.trim().toLowerCase();
    state.presets.tags = state.presets.tags.filter(t => t.toLowerCase() !== target && t.replace(/^#/, '').toLowerCase() !== target.replace(/^#/, ''));
    persistPresetsLocal();
    renderAllTagAndPresetViews();
    try {
      await api(`/api/presets/tags/${encodeURIComponent(tag.replace(/^#/, ''))}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Delete tag server sync error:', e);
    }
  }

  async function saveCurrentTitleHook() {
    const titleInput = $('#schedTitleInput');
    const val = (titleInput?.value || '').trim();
    if (!val) {
      alert('Please enter a title or hook prefix in the Title box first.');
      return;
    }
    const defaultLabel = val.length > 30 ? val.slice(0, 30) + '...' : val;
    const label = prompt('Save Title Hook Preset — Name or short label:', defaultLabel);
    if (!label) return;

    const newHook = {
      id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      text: val.endsWith(' ') ? val : val + ' '
    };

    initPresetsState();
    state.presets.titleHooks.unshift(newHook);
    persistPresetsLocal();
    renderAllTagAndPresetViews();

    try {
      await api('/api/presets/title-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHook)
      });
    } catch (e) {
      console.warn('Save hook server error:', e);
    }

    const btn = $('#schedSaveTitleHookBtn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Saved!';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    }
  }

  async function deleteTitleHook(id) {
    initPresetsState();
    state.presets.titleHooks = state.presets.titleHooks.filter(h => h.id !== id);
    persistPresetsLocal();
    renderAllTagAndPresetViews();
    try {
      await api(`/api/presets/title-hook/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Delete hook server error:', e);
    }
  }

  async function saveCurrentDescriptionTemplate() {
    const captionInput = $('#schedCaptionInput');
    const val = (captionInput?.value || '').trim();
    if (!val) {
      alert('Please write your recurring caption/signature template in the box first.');
      return;
    }
    const name = prompt('Name for this Description Signature / Template (e.g. 📌 Podcast Bio & Links):');
    if (!name) return;

    const newTpl = {
      id: `desc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      text: val
    };

    initPresetsState();
    state.presets.descriptionTemplates.unshift(newTpl);
    persistPresetsLocal();
    renderAllTagAndPresetViews();

    try {
      await api('/api/presets/description-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTpl)
      });
    } catch (e) {
      console.warn('Save template server error:', e);
    }

    const btn = $('#schedSaveDescTemplateBtn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Saved!';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    }
  }

  async function deleteDescriptionTemplate(id) {
    initPresetsState();
    state.presets.descriptionTemplates = state.presets.descriptionTemplates.filter(d => d.id !== id);
    persistPresetsLocal();
    renderAllTagAndPresetViews();
    try {
      await api(`/api/presets/description-template/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Delete template server error:', e);
    }
  }

  function renderTitleHookChips() {
    const container = $('#schedTitleHookChips');
    if (!container) return;
    initPresetsState();

    const hooks = state.presets.titleHooks || [];
    const topTags = (state.presets.tags || []).slice(0, 6);

    let html = '';
    hooks.forEach(h => {
      html += `<span class="tag-chip-btn title-hook-chip" data-hook-text="${encodeURIComponent(h.text)}" title="Click to insert hook into title">⚡ ${escapeHtml(h.label)}</span>`;
    });
    topTags.forEach(t => {
      html += `<span class="tag-chip-btn" data-title-tag="${escapeHtml(t)}" title="Click to append ${escapeHtml(t)} to title">${escapeHtml(t)}</span>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.title-hook-chip').forEach(chip => {
      chip.onclick = () => {
        const text = decodeURIComponent(chip.dataset.hookText);
        const titleInput = $('#schedTitleInput');
        if (titleInput) {
          const cur = titleInput.value.trim();
          if (!cur.includes(text.trim())) {
            titleInput.value = cur ? `${text.trim()} ${cur}` : text;
          }
          titleInput.focus();
        }
      };
    });

    container.querySelectorAll('[data-title-tag]').forEach(chip => {
      chip.onclick = () => {
        const tag = chip.dataset.titleTag;
        const titleInput = $('#schedTitleInput');
        if (titleInput) {
          const cur = titleInput.value.trim();
          if (!cur.includes(tag)) {
            titleInput.value = cur ? `${cur} ${tag}` : tag;
          }
          titleInput.focus();
        }
      };
    });
  }

  function renderDescriptionTemplates() {
    const select = $('#schedDescTemplateSelect');
    if (!select) return;
    initPresetsState();

    const tpls = state.presets.descriptionTemplates || [];
    let html = '<option value="">📋 Saved Signatures & Templates ▾</option>';
    tpls.forEach(t => {
      html += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
    });
    select.innerHTML = html;

    select.onchange = () => {
      const id = select.value;
      if (!id) return;
      const tpl = tpls.find(t => t.id === id);
      if (!tpl) return;

      const captionInput = $('#schedCaptionInput');
      if (captionInput) {
        const cur = captionInput.value.trim();
        if (!cur) {
          captionInput.value = tpl.text;
        } else {
          captionInput.value = `${cur}\n\n${tpl.text}`;
        }
        const len = captionInput.value.length;
        const countEl = $('#schedCharCount');
        if (countEl) countEl.textContent = `${len} / 2,200 chars`;
        captionInput.focus();
      }
      select.value = '';
    };
  }

  function renderDescriptionTagChips() {
    const container = $('#schedDescTagChips');
    if (!container) return;
    initPresetsState();

    const tags = state.presets.tags || [];
    let html = '';
    tags.forEach(t => {
      html += `<span class="tag-chip-btn" data-desc-tag="${escapeHtml(t)}" title="Click to add ${escapeHtml(t)} to description">${escapeHtml(t)}</span>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-desc-tag]').forEach(chip => {
      chip.onclick = () => {
        const tag = chip.dataset.descTag;
        const captionInput = $('#schedCaptionInput');
        if (captionInput) {
          const cur = captionInput.value.trim();
          if (!cur.includes(tag)) {
            captionInput.value = cur ? `${cur} ${tag}` : tag;
            const len = captionInput.value.length;
            const countEl = $('#schedCharCount');
            if (countEl) countEl.textContent = `${len} / 2,200 chars`;
          }
          captionInput.focus();
        }
      };
    });
  }

  function renderHashtagChips() {
    const container = $('#schedHashtagChips');
    if (!container) return;
    initPresetsState();

    const tags = state.presets.tags || [];
    let html = '';
    tags.forEach(t => {
      html += `<span class="ht-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)} <span class="tag-chip-remove" data-del-tag="${escapeHtml(t)}" title="Remove tag">×</span></span>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.ht-chip').forEach(chip => {
      chip.onclick = (e) => {
        if (e.target.classList.contains('tag-chip-remove')) {
          const toDel = e.target.dataset.delTag;
          e.stopPropagation();
          deleteTagFromMemory(toDel);
          return;
        }
        const tag = chip.dataset.tag;
        const htInput = $('#schedHashtagsInput');
        if (htInput) {
          const cur = htInput.value.trim();
          if (!cur.includes(tag)) {
            htInput.value = cur ? `${cur} ${tag}` : tag;
          }
          htInput.focus();
        }
      };
    });
  }

  function renderVaultModalViews() {
    initPresetsState();
    const tags = state.presets.tags || [];
    const hooks = state.presets.titleHooks || [];
    const tpls = state.presets.descriptionTemplates || [];

    if ($('#vaultTagCount')) $('#vaultTagCount').textContent = tags.length;
    if ($('#vaultHookCount')) $('#vaultHookCount').textContent = hooks.length;
    if ($('#vaultTemplateCount')) $('#vaultTemplateCount').textContent = tpls.length;

    // Vault Tags list
    const vaultTagsList = $('#vaultTagsList');
    if (vaultTagsList) {
      let html = '';
      tags.forEach(t => {
        html += `<span class="ht-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)} <span class="tag-chip-remove" data-del-tag="${escapeHtml(t)}" title="Delete tag">×</span></span>`;
      });
      vaultTagsList.innerHTML = html;
      vaultTagsList.querySelectorAll('.tag-chip-remove').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          deleteTagFromMemory(btn.dataset.delTag);
        };
      });
    }

    // Vault Hooks list
    const vaultHooksList = $('#vaultHooksList');
    if (vaultHooksList) {
      let html = '';
      hooks.forEach(h => {
        html += `
          <div class="vault-list-item">
            <div>
              <div class="item-title">⚡ ${escapeHtml(h.label)}</div>
              <div class="item-preview">${escapeHtml(h.text)}</div>
            </div>
            <button type="button" class="count-pill" style="color: #ff4d4d; border-color: rgba(255, 77, 77, 0.3);" data-del-hook="${h.id}">Delete</button>
          </div>
        `;
      });
      vaultHooksList.innerHTML = html || '<p class="muted" style="text-align: center; padding: 20px;">No saved title hooks yet. Click "💾 Save Title Hook" in the composer!</p>';
      vaultHooksList.querySelectorAll('[data-del-hook]').forEach(btn => {
        btn.onclick = () => deleteTitleHook(btn.dataset.delHook);
      });
    }

    // Vault Templates list
    const vaultTemplatesList = $('#vaultTemplatesList');
    if (vaultTemplatesList) {
      let html = '';
      tpls.forEach(t => {
        html += `
          <div class="vault-list-item">
            <div style="flex: 1;">
              <div class="item-title">📋 ${escapeHtml(t.name)}</div>
              <div class="item-preview">${escapeHtml(t.text)}</div>
            </div>
            <button type="button" class="count-pill" style="color: #ff4d4d; border-color: rgba(255, 77, 77, 0.3);" data-del-tpl="${t.id}">Delete</button>
          </div>
        `;
      });
      vaultTemplatesList.innerHTML = html || '<p class="muted" style="text-align: center; padding: 20px;">No saved description templates yet. Click "💾 Save as Template" in the composer!</p>';
      vaultTemplatesList.querySelectorAll('[data-del-tpl]').forEach(btn => {
        btn.onclick = () => deleteDescriptionTemplate(btn.dataset.delTpl);
      });
    }
  }

  function renderAllTagAndPresetViews() {
    renderTitleHookChips();
    renderDescriptionTemplates();
    renderDescriptionTagChips();
    renderHashtagChips();
    renderVaultModalViews();
  }

  function setupTagAndPresetEventListeners() {
    const saveHookBtn = $('#schedSaveTitleHookBtn');
    if (saveHookBtn) saveHookBtn.onclick = saveCurrentTitleHook;

    const saveDescBtn = $('#schedSaveDescTemplateBtn');
    if (saveDescBtn) saveDescBtn.onclick = saveCurrentDescriptionTemplate;

    const newTagInput = $('#schedNewTagInput');
    const addTagBtn = $('#schedAddTagBtn');
    if (addTagBtn && newTagInput) {
      const handleAdd = () => {
        const val = newTagInput.value.trim();
        if (val) {
          addTagToMemory(val);
          newTagInput.value = '';
        }
      };
      addTagBtn.onclick = handleAdd;
      newTagInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAdd();
        }
      };
    }

    const manageVaultBtn = $('#schedManageVaultBtn');
    const vaultModal = $('#tagVaultModal');
    const closeVaultBtn = $('#closeTagVaultModal');
    const vaultDoneBtn = $('#vaultDoneBtn');

    if (manageVaultBtn && vaultModal) {
      manageVaultBtn.onclick = () => {
        renderVaultModalViews();
        vaultModal.classList.remove('hidden');
      };
    }
    if (closeVaultBtn && vaultModal) closeVaultBtn.onclick = () => vaultModal.classList.add('hidden');
    if (vaultDoneBtn && vaultModal) vaultDoneBtn.onclick = () => vaultModal.classList.add('hidden');

    $$('.vault-tab-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.vault-tab-btn').forEach(b => b.classList.remove('active'));
        $$('.vault-tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'tags') $('#vaultPaneTags')?.classList.add('active');
        if (tab === 'hooks') $('#vaultPaneHooks')?.classList.add('active');
        if (tab === 'templates') $('#vaultPaneTemplates')?.classList.add('active');
      };
    });

    const vaultAddTagBtn = $('#vaultAddTagBtn');
    const vaultNewTagInput = $('#vaultNewTagInput');
    if (vaultAddTagBtn && vaultNewTagInput) {
      const handleVaultAddTag = () => {
        const val = vaultNewTagInput.value.trim();
        if (val) {
          addTagToMemory(val);
          vaultNewTagInput.value = '';
        }
      };
      vaultAddTagBtn.onclick = handleVaultAddTag;
      vaultNewTagInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleVaultAddTag();
        }
      };
    }

    const vaultAddHookBtn = $('#vaultAddHookBtn');
    const vaultNewHookInput = $('#vaultNewHookInput');
    if (vaultAddHookBtn && vaultNewHookInput) {
      vaultAddHookBtn.onclick = async () => {
        const val = vaultNewHookInput.value.trim();
        if (!val) return;
        const newHook = {
          id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: val.slice(0, 30),
          text: val.endsWith(' ') ? val : val + ' '
        };
        initPresetsState();
        state.presets.titleHooks.unshift(newHook);
        persistPresetsLocal();
        renderAllTagAndPresetViews();
        vaultNewHookInput.value = '';
        try {
          await api('/api/presets/title-hook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newHook)
          });
        } catch (_) {}
      };
    }

    const vaultAddTplBtn = $('#vaultAddTplBtn');
    const vaultNewTplNameInput = $('#vaultNewTplNameInput');
    const vaultNewTplTextInput = $('#vaultNewTplTextInput');
    if (vaultAddTplBtn && vaultNewTplNameInput && vaultNewTplTextInput) {
      vaultAddTplBtn.onclick = async () => {
        const name = vaultNewTplNameInput.value.trim();
        const text = vaultNewTplTextInput.value.trim();
        if (!name || !text) {
          alert('Please provide both template name and template text.');
          return;
        }
        const newTpl = {
          id: `desc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          text
        };
        initPresetsState();
        state.presets.descriptionTemplates.unshift(newTpl);
        persistPresetsLocal();
        renderAllTagAndPresetViews();
        vaultNewTplNameInput.value = '';
        vaultNewTplTextInput.value = '';
        try {
          await api('/api/presets/description-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTpl)
          });
        } catch (_) {}
      };
    }

    const resetBtn = $('#vaultResetDefaultsBtn');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (!confirm('Reset tags, title hooks, and description signatures back to recommended defaults?')) return;
        try {
          const resetData = await api('/api/presets/reset', { method: 'POST' });
          state.presets = resetData;
          persistPresetsLocal();
          renderAllTagAndPresetViews();
        } catch (err) {
          alert(`Reset failed: ${err.message}`);
        }
      };
    }
  }

  // Initialize presets and render all views
  initPresetsState();
  renderAllTagAndPresetViews();
  setupTagAndPresetEventListeners();
  syncPresetsWithServer();

  // AI Hook & Metadata Generation
  const aiBtn = $('#schedAiMetaBtn');
  if (aiBtn) {
    aiBtn.onclick = async () => {
      const title = ($('#schedTitleInput')?.value || '').trim() || state.scheduler.selectedClip?.title || 'Insane Stream Highlight';
      const origText = aiBtn.textContent;
      aiBtn.disabled = true;
      aiBtn.textContent = '✨ Generating Hook...';

      try {
        const res = await api('/api/posts/ai-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            transcriptText: state.scheduler.selectedClip?.transcriptText || '',
            platform: 'tiktok'
          })
        });

        if (res.title && $('#schedTitleInput')) $('#schedTitleInput').value = res.title;
        if (res.caption && $('#schedCaptionInput')) {
          $('#schedCaptionInput').value = res.caption;
          if ($('#schedCharCount')) $('#schedCharCount').textContent = `${res.caption.length} / 2,200 chars`;
        }
        if (res.hashtags && $('#schedHashtagsInput')) {
          $('#schedHashtagsInput').value = Array.isArray(res.hashtags) ? res.hashtags.join(' ') : res.hashtags;
        }
        if (res.firstComment && $('#schedFirstCommentInput')) {
          $('#schedFirstCommentInput').value = res.firstComment;
        }
      } catch (err) {
        alert(`AI Hook generation failed: ${err.message}`);
      } finally {
        aiBtn.disabled = false;
        aiBtn.textContent = origText;
      }
    };
  }

  // Account Selection Shortcuts
  if ($('#accSelectAllBtn')) {
    $('#accSelectAllBtn').onclick = () => {
      state.scheduler.selectedAccountIds = (state.scheduler.accounts || []).filter(a => a.enabled).map(a => a.id);
      renderAccountSelectionGrid();
    };
  }

  if ($('#accSelectNoneBtn')) {
    $('#accSelectNoneBtn').onclick = () => {
      state.scheduler.selectedAccountIds = [];
      renderAccountSelectionGrid();
    };
  }

  const selectPlatformOnly = (plat) => {
    state.scheduler.selectedAccountIds = (state.scheduler.accounts || [])
      .filter(a => a.enabled && a.platform === plat)
      .map(a => a.id);
    renderAccountSelectionGrid();
  };

  if ($('#accSelectTikTokBtn')) $('#accSelectTikTokBtn').onclick = () => selectPlatformOnly('tiktok');
  if ($('#accSelectShortsBtn')) $('#accSelectShortsBtn').onclick = () => selectPlatformOnly('shorts');
  if ($('#accSelectReelsBtn')) $('#accSelectReelsBtn').onclick = () => selectPlatformOnly('reels');
  if ($('#accSelectTwitterBtn')) $('#accSelectTwitterBtn').onclick = () => selectPlatformOnly('twitter');
  if ($('#accSelectFbBtn')) $('#accSelectFbBtn').onclick = () => selectPlatformOnly('facebook');

  // Schedule Mode Radios
  $$('input[name="schedMode"]').forEach(radio => {
    radio.onchange = () => {
      $$('.radio-card').forEach(c => c.classList.remove('active'));
      radio.closest('.radio-card')?.classList.add('active');

      const mode = radio.value;
      const timeWrap = $('#schedTimePickerWrap');
      const dripWrap = $('#schedDripWrap');
      const submitBtn = $('#submitSchedulePostBtn');
      const count = state.scheduler.selectedAccountIds?.length || 0;

      if (mode === 'immediate') {
        if (timeWrap) timeWrap.classList.add('hidden');
        if (dripWrap) dripWrap.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = `⚡ Publish Immediately to ${count} Accounts`;
      } else if (mode === 'schedule') {
        if (timeWrap) timeWrap.classList.remove('hidden');
        if (dripWrap) dripWrap.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = `📅 Schedule Post to ${count} Accounts`;
      } else if (mode === 'drip') {
        if (timeWrap) timeWrap.classList.remove('hidden');
        if (dripWrap) dripWrap.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = `⏳ Schedule Staggered Drip to ${count} Accounts`;
      }
    };
  });

  // Quick Time Pills
  $$('.qtime-btn').forEach(btn => {
    btn.onclick = () => {
      const minutes = Number(btn.dataset.minutes || (Number(btn.dataset.hours || 1) * 60));
      const targetTime = new Date(Date.now() + minutes * 60 * 1000);
      const input = $('#schedDatetimeInput');
      if (input) {
        const year = targetTime.getFullYear();
        const month = String(targetTime.getMonth() + 1).padStart(2, '0');
        const day = String(targetTime.getDate()).padStart(2, '0');
        const hours = String(targetTime.getHours()).padStart(2, '0');
        const mins = String(targetTime.getMinutes()).padStart(2, '0');
        input.value = `${year}-${month}-${day}T${hours}:${mins}`;
      }
    };
  });

  // Clip Dropdown Change
  const clipSelect = $('#schedClipSelect');
  if (clipSelect) {
    clipSelect.onchange = () => {
      const chosenId = clipSelect.value;
      const clip = (state.scheduler.availableClips || []).find(c => c.id === chosenId);
      if (clip) {
        state.scheduler.selectedClip = clip;
        const previewWrap = $('#schedVideoPreviewWrap');
        const previewVid = $('#schedPreviewVideo');
        const titleEl = $('#schedPreviewTitle');
        const metaEl = $('#schedPreviewMeta');

        if (previewWrap) previewWrap.classList.remove('hidden');
        if (previewVid && clip.videoUrl) previewVid.src = clip.videoUrl;
        if (titleEl) titleEl.textContent = clip.title;
        if (metaEl) metaEl.textContent = `${clip.isRendered ? '✔ Rendered MP4' : '⚡ Candidate Clip'} · ${clip.jobName || ''}`;

        const titleInput = $('#schedTitleInput');
        if (titleInput && !titleInput.value) {
          titleInput.value = clip.title;
        }
      } else {
        state.scheduler.selectedClip = null;
        if ($('#schedVideoPreviewWrap')) $('#schedVideoPreviewWrap').classList.add('hidden');
      }
    };
  }

  // Submit Schedule Post Button
  const submitBtn = $('#submitSchedulePostBtn');
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const clip = state.scheduler.selectedClip;
      const title = ($('#schedTitleInput')?.value || '').trim();
      const caption = ($('#schedCaptionInput')?.value || '').trim();
      const hashtagsRaw = ($('#schedHashtagsInput')?.value || '').trim();
      const firstComment = ($('#schedFirstCommentInput')?.value || '').trim();
      const accountIds = state.scheduler.selectedAccountIds || [];
      const mode = $('input[name="schedMode"]:checked')?.value || 'schedule';
      const datetimeVal = $('#schedDatetimeInput')?.value;
      const statusEl = $('#schedActionStatus');

      if (!clip && !title) {
        alert('Please select a video clip to post or enter a post title.');
        return;
      }

      if (clip && !clip.isRendered && !clip.isCustom) {
        alert('⚠️ The clip "' + (clip.title || '') + '" is an unrendered candidate, so there is no finished 9:16 video file on disk yet.\n\nTo fix:\n1. Choose any finished clip labeled "✔ [READY TO POST]"\n2. Or click "💻 Select Video from PC" to pick any video file directly from your computer!');
        return;
      }

      if (accountIds.length === 0) {
        alert('Please select at least one target social account (more than 10 accounts supported).');
        return;
      }

      const dripIntervalMins = Number($('#schedDripInterval')?.value || 60);
      const baseTime = datetimeVal ? new Date(datetimeVal).getTime() : Date.now();

      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Processing Post...';
      if (statusEl) statusEl.textContent = 'Queueing post across selected accounts...';

      try {
        if (mode === 'drip' && accountIds.length > 1) {
          // Stagger posting across accounts by the selected interval
          for (let i = 0; i < accountIds.length; i++) {
            const accId = accountIds[i];
            const itemTime = new Date(baseTime + (i * dripIntervalMins * 60 * 1000)).toISOString();
            const singlePost = {
              title: title || clip.title,
              caption,
              hashtags: hashtagsRaw.split(/\s+/).filter(Boolean),
              firstComment,
              clipId: clip?.id,
              jobId: clip?.jobId,
              clipName: clip?.title || title,
              videoPath: clip?.videoPath || '',
              videoUrl: clip?.videoUrl || '',
              accountIds: [accId],
              status: 'scheduled',
              immediate: false,
              scheduledAt: itemTime
            };
            await api('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(singlePost)
            });
          }
          if (statusEl) statusEl.textContent = `✓ Staggered drip queued: 1 post every ${dripIntervalMins} mins across ${accountIds.length} accounts!`;
        } else if (mode === 'immediate') {
          const scheduledAt = new Date().toISOString();
          const postData = {
            title: title || clip.title,
            caption,
            hashtags: hashtagsRaw.split(/\s+/).filter(Boolean),
            firstComment,
            clipId: clip?.id,
            jobId: clip?.jobId,
            clipName: clip?.title || title,
            videoPath: clip?.videoPath || '',
            videoUrl: clip?.videoUrl || '',
            accountIds,
            status: 'publishing',
            immediate: false,
            scheduledAt
          };

          // Show Multi-Post Progress Modal with all account avatars
          const multiModal = $('#multiPostModal');
          const accountsList = $('#multiPostAccountsList');
          const progressBar = $('#multiPostProgressBar');
          const summaryStatus = $('#multiPostSummaryStatus');
          const doneBtn = $('#doneMultiPostBtn');
          const multiTitle = $('#multiPostClipTitle');
          const multiMeta = $('#multiPostClipMeta');
          const multiVid = $('#multiPostThumbVideo');

          if (multiTitle) multiTitle.textContent = title || clip?.title || 'Viral Short-Form Clip';
          if (multiMeta) multiMeta.textContent = `${accountIds.length} connected platforms selected`;
          if (multiVid && clip?.videoUrl) multiVid.src = clip.videoUrl;
          if (progressBar) progressBar.style.width = '25%';
          if (summaryStatus) summaryStatus.textContent = `🚀 Broadcasting in parallel to ${accountIds.length} accounts...`;
          if (doneBtn) doneBtn.classList.add('hidden');

          const accountsMap = new Map((state.scheduler.accounts || []).map(a => [a.id, a]));
          const selectedAccounts = accountIds.map(id => accountsMap.get(id)).filter(Boolean);

          if (accountsList) {
            accountsList.innerHTML = selectedAccounts.map(a => `
              <div class="multi-post-progress-row" id="row_multi_${a.id}">
                <div class="multi-post-user-info">
                  ${getAccountAvatarHtml(a)}
                  <div style="display:flex; flex-direction:column;">
                    <strong style="font-size:12px; color:#fff;">${a.name}</strong>
                    <small style="font-size:11px; color:#94a3b8;">${a.handle} · ${a.category || a.platform}</small>
                  </div>
                </div>
                <div id="status_multi_${a.id}">
                  <span class="multi-post-status-pill publishing">⏳ Uploading...</span>
                </div>
              </div>
            `).join('');
          }

          if (multiModal) multiModal.classList.remove('hidden');

          // Save post first
          const savedPost = await api('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
          });

          if (progressBar) progressBar.style.width = '60%';

          // Trigger live parallel publish across all selected accounts
          const pubRes = await api(`/api/posts/${savedPost.id}/publish`, { method: 'POST' });
          if (progressBar) progressBar.style.width = '100%';

          const deliveryResults = pubRes.deliveryResults || [];
          for (const res of deliveryResults) {
            const statusCell = $(`#status_multi_${res.accountId}`);
            const rowEl = $(`#row_multi_${res.accountId}`);
            if (statusCell) {
              if (res.delivered) {
                if (rowEl) rowEl.classList.add('done');
                statusCell.innerHTML = `
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="multi-post-status-pill success">✔ Live</span>
                    ${res.liveUrl ? `<a href="${res.liveUrl}" target="_blank" class="pill-btn" style="font-size:10px; padding:2px 8px; text-decoration:none; color:#10b981; border:1px solid rgba(16,185,129,0.4); background:rgba(16,185,129,0.15);">🔗 View</a>` : ''}
                  </div>
                `;
              } else {
                if (rowEl) rowEl.classList.add('failed');
                statusCell.innerHTML = `
                  <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <span class="multi-post-status-pill failed">Notice</span>
                    <small style="color:#ef4444; font-size:10px; max-width:180px; text-align:right;">${res.message || 'Notice'}</small>
                  </div>
                `;
              }
            }
          }

          const successfulCount = deliveryResults.filter(r => r.delivered).length;
          if (summaryStatus) {
            summaryStatus.textContent = `✔ Broadcast completed! (${successfulCount}/${accountIds.length} published)`;
          }
          if (doneBtn) doneBtn.classList.remove('hidden');

          if (statusEl) statusEl.textContent = `✓ Successfully multi-posted across ${accountIds.length} accounts!`;
        } else {
          const scheduledAt = datetimeVal ? new Date(datetimeVal).toISOString() : new Date().toISOString();
          const postData = {
            title: title || clip.title,
            caption,
            hashtags: hashtagsRaw.split(/\s+/).filter(Boolean),
            firstComment,
            clipId: clip?.id,
            jobId: clip?.jobId,
            clipName: clip?.title || title,
            videoPath: clip?.videoPath || '',
            videoUrl: clip?.videoUrl || '',
            accountIds,
            status: 'scheduled',
            immediate: false,
            scheduledAt
          };

          await api('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
          });

          if (statusEl) statusEl.textContent = `✓ Successfully scheduled across ${accountIds.length} accounts!`;
        }
        
        // Auto-remember any hashtags used in this post across title, caption, and hashtags
        const rememberCheckbox = $('#schedAutoRememberTags');
        if (!rememberCheckbox || rememberCheckbox.checked) {
          autoRememberTagsFromPost(title, caption, postData.hashtags);
        }

        // Reset inputs
        if ($('#schedTitleInput')) $('#schedTitleInput').value = '';
        if ($('#schedCaptionInput')) $('#schedCaptionInput').value = '';
        if ($('#schedHashtagsInput')) $('#schedHashtagsInput').value = '';
        if ($('#schedFirstCommentInput')) $('#schedFirstCommentInput').value = '';

        if (mode !== 'immediate') {
          setTimeout(() => {
            window.switchSchedulerSubTab('queue');
            if (statusEl) statusEl.textContent = '';
          }, 1200);
        }

      } catch (err) {
        alert(`Failed to schedule post: ${err.message}`);
        if (statusEl) statusEl.textContent = `Error: ${err.message}`;
      } finally {
        submitBtn.disabled = false;
        const count = state.scheduler.selectedAccountIds?.length || 0;
        submitBtn.textContent = mode === 'immediate'
          ? `🚀 Multi-Post to ${count} Selected Accounts`
          : `📅 Schedule Post to ${count} Accounts`;
      }
    };
  }

  // Multi-Post Modal handlers
  if ($('#closeMultiPostModal')) {
    $('#closeMultiPostModal').onclick = () => {
      $('#multiPostModal')?.classList.add('hidden');
    };
  }
  if ($('#doneMultiPostBtn')) {
    $('#doneMultiPostBtn').onclick = () => {
      $('#multiPostModal')?.classList.add('hidden');
      window.switchSchedulerSubTab('queue');
    };
  }

  // Account Modal handlers
  const accModal = $('#accountModal');
  const closeAccModal = () => { if (accModal) accModal.classList.add('hidden'); };
  if ($('#closeAccountModal')) $('#closeAccountModal').onclick = closeAccModal;

  if ($('#accAvatarUrlInput')) {
    $('#accAvatarUrlInput').oninput = (e) => {
      const url = e.target.value.trim();
      if ($('#accAvatarPreview')) {
        $('#accAvatarPreview').src = url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      }
    };
  }

  $$('.avatar-preset-btn').forEach(btn => {
    btn.onclick = () => {
      const url = btn.dataset.url;
      if ($('#accAvatarUrlInput')) $('#accAvatarUrlInput').value = url;
      if ($('#accAvatarPreview')) $('#accAvatarPreview').src = url;
    };
  });

  if ($('#accPlatformSelect')) {
    $('#accPlatformSelect').onchange = (e) => {
      const isReels = e.target.value === 'reels';
      if ($('#accInstagramGuideWrap')) {
        $('#accInstagramGuideWrap').classList.toggle('hidden', !isReels);
      }
    };
  }

  if ($('#verifyIgTokenBtn')) {
    $('#verifyIgTokenBtn').onclick = async () => {
      const token = ($('#accIgTokenInput')?.value || '').trim();
      const statusEl = $('#accIgVerifyStatus');
      if (!token) {
        alert('Please paste your Meta Access Token to verify.');
        return;
      }
      if (statusEl) statusEl.textContent = '⏳ Verifying Meta Graph Token...';
      try {
        const res = await api('/api/accounts/verify-instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            accountId: $('#accEditId')?.value || null
          })
        });

        if (statusEl) {
          statusEl.style.color = '#10b981';
          statusEl.textContent = `✔ Verified! Profile @${res.username} linked with photo!`;
        }
        if (res.avatarUrl) {
          if ($('#accAvatarUrlInput')) $('#accAvatarUrlInput').value = res.avatarUrl;
          if ($('#accAvatarPreview')) $('#accAvatarPreview').src = res.avatarUrl;
        }
        if (res.username && $('#accHandleInput')) {
          $('#accHandleInput').value = `@${res.username}`;
        }
        if (res.name && $('#accNameInput')) {
          $('#accNameInput').value = res.name;
        }
        if ($('#accTokenInput')) {
          $('#accTokenInput').value = token;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.style.color = '#f43f5e';
          statusEl.textContent = `❌ ${err.message}`;
        }
      }
    };
  }

  if ($('#addNewAccBtn')) {
    $('#addNewAccBtn').onclick = () => {
      $('#accModalTitle').textContent = 'Add New Social Account';
      $('#accEditId').value = '';
      $('#accNameInput').value = '';
      $('#accHandleInput').value = '';
      $('#accCategoryInput').value = '';
      const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      if ($('#accAvatarUrlInput')) $('#accAvatarUrlInput').value = defaultAvatar;
      if ($('#accAvatarPreview')) $('#accAvatarPreview').src = defaultAvatar;
      if ($('#accInstagramGuideWrap')) $('#accInstagramGuideWrap').classList.add('hidden');
      if ($('#accIgVerifyStatus')) $('#accIgVerifyStatus').textContent = '';
      if ($('#accTokenInput')) $('#accTokenInput').value = '';
      if ($('#accPrivacySelect')) $('#accPrivacySelect').value = 'public';
      if (accModal) accModal.classList.remove('hidden');
    };
  }

  if ($('#accountForm')) {
    $('#accountForm').onsubmit = async (e) => {
      e.preventDefault();
      const editId = $('#accEditId')?.value;
      const name = $('#accNameInput')?.value.trim();
      const handle = $('#accHandleInput')?.value.trim();
      const platform = $('#accPlatformSelect')?.value;
      const category = $('#accCategoryInput')?.value.trim();
      const avatarUrl = $('#accAvatarUrlInput')?.value.trim() || '';
      const apiToken = ($('#accTokenInput')?.value.trim() || $('#accIgTokenInput')?.value.trim()) || '';
      const privacy = $('#accPrivacySelect')?.value || 'public';

      try {
        if (editId) {
          await api(`/api/accounts/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, handle, platform, category, avatarUrl, apiToken, privacy, directPosting: true })
          });
        } else {
          await api('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, handle, platform, category, avatarUrl, apiToken, privacy, directPosting: true })
          });
        }
        closeAccModal();
        await loadAccounts();
      } catch (err) {
        alert(`Failed to save account: ${err.message}`);
      }
    };
  }

  if ($('#resetDefaultAccBtn')) {
    $('#resetDefaultAccBtn').onclick = async () => {
      if (confirm('Reset accounts back to 12 sample high-yield short-form channels?')) {
        await api('/api/accounts/reset', { method: 'POST' });
        await loadAccounts();
      }
    };
  }

  // Queue Refresh Button
  if ($('#refreshQueueBtn')) $('#refreshQueueBtn').onclick = () => loadScheduledQueue();

  // Queue Filter Buttons
  $$('.q-filter-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.q-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.scheduler.queueFilter = btn.dataset.filter || 'all';
      renderQueueList();
    };
  });

  // Default datetime: 1 hour from now
  const defaultTime = new Date(Date.now() + 3600 * 1000);
  if ($('#schedDatetimeInput')) {
    $('#schedDatetimeInput').value = defaultTime.toISOString().slice(0, 16);
  }

  // Initial load
  loadAccounts();
  loadScheduledQueue();
}

async function loadSchedulerData() {
  await Promise.all([
    loadAccounts(),
    loadAvailableClips(),
    loadScheduledQueue()
  ]);
}

async function loadAccounts() {
  try {
    const accs = await api('/api/accounts');
    state.scheduler.accounts = accs || [];

    // If no accounts selected yet, default to all enabled accounts
    if (!state.scheduler.selectedAccountIds || state.scheduler.selectedAccountIds.length === 0) {
      state.scheduler.selectedAccountIds = accs.filter(a => a.enabled).map(a => a.id);
    }

    renderAccountSelectionGrid();
    renderFullAccountsManager();

    const total = accs.length;
    if ($('#accTotalCount')) $('#accTotalCount').textContent = total;
    if ($('#tabAccCountSpan')) $('#tabAccCountSpan').textContent = total;
  } catch (err) {
    console.error('Failed to load accounts:', err);
  }
}

function getAccountAvatarHtml(a, size = '') {
  const platformIcons = {
    tiktok: '🎵',
    shorts: '🔴',
    reels: '📸',
    twitter: '🐦',
    facebook: '📘'
  };
  const icon = platformIcons[a.platform] || '📱';
  const initial = (a.name || a.handle || 'A').replace(/^@/, '')[0].toUpperCase();
  const avatarUrl = a.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

  return `
    <div class="acc-avatar-wrap ${size === 'large' ? 'large' : ''}">
      <img src="${avatarUrl}" class="acc-avatar-img" alt="${a.name || ''}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
      <div class="acc-avatar-fallback" style="display:none; background:${a.avatarColor || '#7157ff'};">${initial}</div>
      <span class="acc-platform-sub-badge ${a.platform}" title="${a.platform}">${icon}</span>
    </div>
  `;
}

function renderAccountSelectionGrid() {
  const container = $('#schedAccountsGrid');
  if (!container) return;

  const accounts = state.scheduler.accounts || [];
  if (accounts.length === 0) {
    container.innerHTML = '<p class="muted" style="grid-column:1/-1;">No accounts found. Click "Manage Accounts" to add some.</p>';
    return;
  }

  const selectedIds = new Set(state.scheduler.selectedAccountIds || []);

  container.innerHTML = accounts.map(a => {
    const isSelected = selectedIds.has(a.id);
    return `
      <div class="sched-acc-item ${isSelected ? 'selected' : ''}" data-acc-id="${a.id}">
        <input type="checkbox" ${isSelected ? 'checked' : ''} ${!a.enabled ? 'disabled' : ''}>
        ${getAccountAvatarHtml(a)}
        <div class="acc-text-info">
          <strong>${a.name}</strong>
          <small>${a.handle} · ${a.category || a.platform}</small>
        </div>
      </div>
    `;
  }).join('');

  // Wire selection click handlers
  $$('.sched-acc-item').forEach(item => {
    const accId = item.dataset.accId;
    item.onclick = (e) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      
      const set = new Set(state.scheduler.selectedAccountIds || []);
      if (checkbox.checked) {
        set.add(accId);
      } else {
        set.delete(accId);
      }
      state.scheduler.selectedAccountIds = Array.from(set);

      item.classList.toggle('selected', checkbox.checked);
      updateSelectedAccCount();
    };
  });

  updateSelectedAccCount();
}

function updateSelectedAccCount() {
  const count = state.scheduler.selectedAccountIds?.length || 0;
  if ($('#selectedAccCount')) $('#selectedAccCount').textContent = count;
  
  const submitBtn = $('#submitSchedulePostBtn');
  if (submitBtn) {
    const mode = $('input[name="schedMode"]:checked')?.value || 'schedule';
    if (mode === 'immediate') {
      submitBtn.textContent = `🚀 Multi-Post to ${count} Selected Accounts`;
    } else if (mode === 'drip') {
      submitBtn.textContent = `⏳ Schedule Staggered Drip to ${count} Accounts`;
    } else {
      submitBtn.textContent = `📅 Schedule Post to ${count} Accounts`;
    }
  }
}

function renderFullAccountsManager() {
  const container = $('#accFullListGrid');
  if (!container) return;

  const accounts = state.scheduler.accounts || [];
  if (accounts.length === 0) {
    container.innerHTML = '<p class="muted">No accounts added yet.</p>';
    return;
  }

  const platformIcons = {
    tiktok: '🎵 TikTok',
    shorts: '🔴 YouTube Shorts',
    reels: '📸 Instagram Reels',
    twitter: '🐦 X / Twitter',
    facebook: '📘 Facebook Reels'
  };

  container.innerHTML = accounts.map(a => `
    <div class="acc-card">
      <div class="acc-card-head">
        ${getAccountAvatarHtml(a, 'large')}
        <div class="acc-card-info">
          <strong>${a.name}</strong>
          <span>${a.handle}</span>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="acc-card-tag">${platformIcons[a.platform] || a.platform}</span>
        <span class="muted" style="font-size:11px;">${a.category || 'General'}</span>
      </div>
      ${a.platform === 'shorts' ? `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; margin: 4px 0;">
          <span style="color:${a.isLinked ? '#10b981' : '#f59e0b'}; font-weight:600;">
            ${a.isLinked ? '✔ Specific Channel Linked' : '⚠️ Channel Not Linked'}
          </span>
          <a href="/api/youtube/switch?accountId=${a.id}" class="pill-btn" style="font-size: 11px; padding: 2px 8px; text-decoration: none; background: rgba(255,0,0,0.15); color: #ff5555; border: 1px solid rgba(255,0,0,0.3); border-radius: 4px;">
            🔗 Link Channel
          </a>
        </div>
      ` : a.platform === 'reels' ? `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; margin: 4px 0;">
          <span style="color:${a.apiToken ? '#10b981' : '#f43f5e'}; font-weight:600;">
            ${a.apiToken ? '✔ Meta Graph Active' : '⚡ Direct Engine Active'}
          </span>
          <button type="button" class="pill-btn edit-acc-btn" data-acc-id="${a.id}" style="font-size: 11px; padding: 2px 8px; background: rgba(225,48,108,0.15); color: #f43f5e; border: 1px solid rgba(225,48,108,0.3); border-radius: 4px;">
            📸 ${a.apiToken ? 'Sync Profile' : 'Connect Meta'}
          </button>
        </div>
      ` : `
        <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#10b981;">
          <span>⚡ Direct Engine:</span>
          <strong style="color:#fff;">${a.apiToken ? 'Custom Token Active' : 'Native Auto-Publish Active'}</strong>
        </div>
      `}
      <div class="acc-card-actions">
        <label class="check-inline" style="margin: 0; font-size: 11px;">
          <input type="checkbox" class="acc-toggle-enabled" data-acc-id="${a.id}" ${a.enabled ? 'checked' : ''}>
          <span>Active</span>
        </label>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="pill-btn edit-acc-btn" data-acc-id="${a.id}" style="font-size: 11px; padding: 2px 8px;">Edit</button>
          <button type="button" class="pill-btn danger-sm delete-acc-btn" data-acc-id="${a.id}" style="font-size: 11px; padding: 2px 8px;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Wire actions
  $$('.acc-toggle-enabled').forEach(box => {
    box.onchange = async () => {
      await api(`/api/accounts/${box.dataset.accId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: box.checked })
      });
      await loadAccounts();
    };
  });

  $$('.edit-acc-btn').forEach(btn => {
    btn.onclick = () => {
      const acc = accounts.find(a => a.id === btn.dataset.accId);
      if (!acc) return;
      $('#accModalTitle').textContent = `Edit Account (${acc.handle})`;
      $('#accEditId').value = acc.id;
      $('#accNameInput').value = acc.name;
      $('#accHandleInput').value = acc.handle;
      $('#accPlatformSelect').value = acc.platform;
      $('#accCategoryInput').value = acc.category || '';
      if ($('#accAvatarUrlInput')) {
        $('#accAvatarUrlInput').value = acc.avatarUrl || '';
      }
      if ($('#accAvatarPreview')) {
        $('#accAvatarPreview').src = acc.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      }
      if ($('#accInstagramGuideWrap')) {
        $('#accInstagramGuideWrap').classList.toggle('hidden', acc.platform !== 'reels');
      }
      if ($('#accIgTokenInput')) {
        $('#accIgTokenInput').value = acc.apiToken || '';
      }
      if ($('#accIgVerifyStatus')) {
        $('#accIgVerifyStatus').textContent = '';
      }
      if ($('#accTokenInput')) $('#accTokenInput').value = acc.apiToken || '';
      if ($('#accPrivacySelect')) $('#accPrivacySelect').value = acc.privacy || 'public';
      $('#accountModal').classList.remove('hidden');
    };
  });

  $$('.delete-acc-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Delete this account from scheduler?')) {
        await api(`/api/accounts/${btn.dataset.accId}`, { method: 'DELETE' });
        await loadAccounts();
      }
    };
  });
}

async function loadAvailableClips() {
  const select = $('#schedClipSelect');
  if (!select) return;

  try {
    const clips = await api('/api/posts/available-clips');
    state.scheduler.availableClips = clips || [];

    const rendered = clips.filter(c => c.isRendered);
    const candidates = clips.filter(c => !c.isRendered);

    let html = '<option value="">-- Choose a Clip or Select Video from PC --</option>';
    if (rendered.length > 0) {
      html += `<optgroup label="✔ READY TO POST (Finished 9:16 Shorts)">` +
        rendered.map(c => `
          <option value="${c.id}" ${state.scheduler.selectedClip?.id === c.id ? 'selected' : ''}>
            ✔ ${c.title} (${c.jobName || ''})
          </option>
        `).join('') +
        `</optgroup>`;
    }
    if (candidates.length > 0) {
      html += `<optgroup label="⚡ UNRENDERED CANDIDATES (Render in Studio First)">` +
        candidates.map(c => `
          <option value="${c.id}" ${state.scheduler.selectedClip?.id === c.id ? 'selected' : ''}>
            ⚡ [Unrendered] ${c.title}
          </option>
        `).join('') +
        `</optgroup>`;
    }

    select.innerHTML = html;

    // If a clip was pre-selected, update view
    if (state.scheduler.selectedClip) {
      select.value = state.scheduler.selectedClip.id;
      select.dispatchEvent(new Event('change'));
    }
  } catch (err) {
    console.error('Failed to load available clips:', err);
  }
}

async function loadScheduledQueue() {
  try {
    const posts = await api('/api/posts');
    state.scheduler.posts = posts || [];

    const total = posts.length;
    const scheduled = posts.filter(p => p.status === 'scheduled').length;
    const published = posts.filter(p => p.status === 'published').length;
    const failed = posts.filter(p => p.status === 'failed').length;

    if ($('#navScheduleBadge')) $('#navScheduleBadge').textContent = scheduled;
    if ($('#tabQueueCountSpan')) $('#tabQueueCountSpan').textContent = total;
    if ($('#queueCountSpan')) $('#queueCountSpan').textContent = scheduled;
    if ($('#qAllCount')) $('#qAllCount').textContent = total;
    if ($('#qSchedCount')) $('#qSchedCount').textContent = scheduled;
    if ($('#qPubCount')) $('#qPubCount').textContent = published;
    if ($('#qFailCount')) $('#qFailCount').textContent = failed;

    renderQueueList();
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
}

function renderQueueList() {
  const container = $('#queueItemsList');
  if (!container) return;

  let posts = state.scheduler.posts || [];
  const filter = state.scheduler.queueFilter || 'all';

  if (filter !== 'all') {
    posts = posts.filter(p => p.status === filter);
  }

  if (posts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; background:#14141c; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
        <p class="muted" style="margin:0;">No posts match this filter.</p>
        <button type="button" class="pill-btn primary-pill" onclick="window.switchSchedulerSubTab('compose')" style="margin-top:10px;">✍️ Create First Post</button>
      </div>
    `;
    return;
  }

  const accountsMap = new Map((state.scheduler.accounts || []).map(a => [a.id, a]));

  container.innerHTML = posts.map(p => {
    const targetAccs = (p.accountIds || []).map(id => accountsMap.get(id)).filter(Boolean);
    const dateStr = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Immediate';
    
    return `
      <div class="queue-card">
        <video class="queue-video-thumb" src="${p.videoUrl}" muted playsinline preload="metadata"></video>
        <div class="queue-body">
          <h4>${p.title || p.clipName}</h4>
          <p>${p.caption || 'No caption provided'}</p>
          ${p.hashtags && p.hashtags.length ? `
            <div style="font-size:11px; color:#38bdf8;">${p.hashtags.join(' ')}</div>
          ` : ''}
          <div class="queue-delivery-tags">
            <span style="font-size:11px; color:#94a3b8;">📅 ${dateStr}</span>
            <span style="font-size:11px; color:#94a3b8;">·</span>
            ${targetAccs.map(a => `
              <span class="q-acc-tag" style="display:inline-flex; align-items:center; gap:5px;">
                <img src="${a.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}" style="width:16px; height:16px; border-radius:50%; object-fit:cover;" alt="">
                <span>${a.handle}</span>
              </span>
            `).join('')}
          </div>
        </div>
        <div class="queue-right">
          <span class="q-status-badge ${p.status}">${p.status}</span>
          <div class="q-actions">
            ${p.status === 'scheduled' ? `
              <button type="button" class="pill-btn primary-pill q-publish-now-btn" data-post-id="${p.id}" style="font-size:11px; padding:3px 8px;">⚡ Post Now</button>
            ` : ''}
            <button type="button" class="pill-btn q-details-btn" data-post-id="${p.id}" style="font-size:11px; padding:3px 8px;">Details</button>
            <button type="button" class="pill-btn danger-sm q-delete-btn" data-post-id="${p.id}" style="font-size:11px; padding:3px 8px;">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire actions
  $$('.q-publish-now-btn').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Posting...';
      try {
        await api(`/api/posts/${btn.dataset.postId}/publish`, { method: 'POST' });
        await loadScheduledQueue();
      } catch (err) {
        alert(`Publish error: ${err.message}`);
      }
    };
  });

  $$('.q-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Delete this scheduled post?')) {
        await api(`/api/posts/${btn.dataset.postId}`, { method: 'DELETE' });
        await loadScheduledQueue();
      }
    };
  });

  $$('.q-details-btn').forEach(btn => {
    btn.onclick = () => {
      const post = (state.scheduler.posts || []).find(p => p.id === btn.dataset.postId);
      if (!post) return;
      const details = JSON.stringify(post.deliveryResults || post, null, 2);
      alert(`Post Details for "${post.title}":\n\n${details}`);
    };
  });
}

// Function called when clicking "Schedule" on a rendered clip
function openSchedulerWithClip(clip) {
  window.switchAppView('scheduler');
  window.switchSchedulerSubTab('compose');

  const formattedClip = {
    id: `custom_${Date.now()}`,
    title: clip.name ? clip.name.replace(/^\d+-/, '').replace(/\.mp4$/, '').replace(/[-_]/g, ' ') : 'Short-Form Video',
    videoUrl: clip.url,
    videoPath: clip.url,
    jobId: clip.jobId,
    isRendered: clip.isRendered !== false
  };

  state.scheduler.selectedClip = formattedClip;

  const select = $('#schedClipSelect');
  if (select) {
    const opt = document.createElement('option');
    opt.value = formattedClip.id;
    opt.textContent = `✔ [RENDERED] ${formattedClip.title}`;
    opt.selected = true;
    select.prepend(opt);
    select.dispatchEvent(new Event('change'));
  }
}

// Function called when clicking "Schedule" on a candidate card
function openSchedulerWithCandidateClip(clipId) {
  const clip = state.currentJob?.clips?.find(c => c.id === clipId);
  if (!clip) return;

  window.switchAppView('scheduler');
  window.switchSchedulerSubTab('compose');

  const formattedClip = {
    id: `cand_${clip.id}`,
    title: clip.title,
    transcriptText: clip.transcriptText || clip.hook || '',
    videoUrl: `/media/jobs/${state.currentJob.id}/stream`,
    videoPath: state.currentJob.sourcePath,
    jobId: state.currentJob.id,
    isRendered: false
  };

  state.scheduler.selectedClip = formattedClip;

  const select = $('#schedClipSelect');
  if (select) {
    const opt = document.createElement('option');
    opt.value = formattedClip.id;
    opt.textContent = `⚡ [CANDIDATE] ${formattedClip.title}`;
    opt.selected = true;
    select.prepend(opt);
    select.dispatchEvent(new Event('change'));
  }
}

// ========================================================
// FEATURE 5: YOUTUBE SHORTS LIVE ANALYTICS DASHBOARD
// ========================================================
async function loadShortsAnalytics(forceRefresh = false) {
  const list = $('#shortsAnalyticsList');
  const btn = $('#refreshAnalyticsBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Fetching Metrics...';
  }

  try {
    const res = await api(forceRefresh ? '/api/analytics/refresh' : '/api/analytics/shorts', {
      method: forceRefresh ? 'POST' : 'GET'
    });

    const summary = res.summary || {};
    const shorts = res.shorts || [];

    if ($('#statTotalViews')) $('#statTotalViews').textContent = Number(summary.totalViews || 0).toLocaleString();
    if ($('#statTotalLikes')) $('#statTotalLikes').textContent = Number(summary.totalLikes || 0).toLocaleString();
    if ($('#statTotalComments')) $('#statTotalComments').textContent = Number(summary.totalComments || 0).toLocaleString();
    if ($('#statTotalShorts')) $('#statTotalShorts').textContent = Number(summary.totalShorts || 0).toLocaleString();

    // Top Short Banner
    const topShort = summary.topShort;
    const topBanner = $('#topShortBanner');
    if (topBanner) {
      if (topShort && (topShort.viewCount > 0 || topShort.status === 'active')) {
        topBanner.classList.remove('hidden');
        topBanner.innerHTML = `
          <div class="crown-badge">👑</div>
          <div class="banner-info">
            <div class="banner-title">🏆 Top Tracked Short: "${escapeHtml(topShort.title || topShort.postTitle)}"</div>
            <div class="banner-meta">
              <span>👁️ <strong>${Number(topShort.viewCount).toLocaleString()} views</strong></span> · 
              <span>❤️ ${Number(topShort.likeCount).toLocaleString()} likes</span> · 
              <span>💬 ${Number(topShort.commentCount).toLocaleString()} comments</span> · 
              <span>Channel: <strong>${escapeHtml(topShort.channel || topShort.accountName)}</strong></span>
            </div>
          </div>
          <a href="${escapeHtml(topShort.liveUrl)}" target="_blank" class="pill-btn primary-pill" style="text-decoration:none; padding:6px 14px; font-size:12px;">
            Watch Live ↗
          </a>
        `;
      } else {
        topBanner.classList.add('hidden');
      }
    }

    // Render Cards Grid
    if (list) {
      if (shorts.length === 0) {
        list.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
            <p class="muted" style="font-size: 14px; margin: 0 0 10px;">No published YouTube Shorts tracked yet.</p>
            <button type="button" class="pill-btn primary-pill" onclick="window.switchSchedulerSubTab('compose')">
              🚀 Publish Your First Short
            </button>
          </div>
        `;
      } else {
        let html = '';
        shorts.forEach(s => {
          html += `
            <div class="short-metric-card">
              <div class="short-card-thumb-wrap">
                <img src="${escapeHtml(s.thumbnailUrl)}" alt="Thumbnail" class="short-card-thumb" onerror="this.src='https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg'">
                ${s.duration ? `<span class="short-dur-badge">${formatTime(s.duration)}</span>` : ''}
              </div>
              <div class="short-card-body">
                <h4 class="short-card-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title || s.postTitle)}</h4>
                <div class="short-card-channel">Channel: <strong>${escapeHtml(s.channel || s.accountName)}</strong></div>
                <div class="short-card-metrics">
                  <span class="metric-pill views" title="Total Views">👁️ ${Number(s.viewCount).toLocaleString()}</span>
                  <span class="metric-pill likes" title="Total Likes">❤️ ${Number(s.likeCount).toLocaleString()}</span>
                  <span class="metric-pill comments" title="Comments">💬 ${Number(s.commentCount).toLocaleString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 4px;">
                  <small class="muted" style="font-size:10px;">ID: ${escapeHtml(s.videoId)}</small>
                  <a href="${escapeHtml(s.liveUrl)}" target="_blank" style="font-size:11px; color:#ffdd00; text-decoration:none; font-weight:600;">Open Short ↗</a>
                </div>
              </div>
            </div>
          `;
        });
        list.innerHTML = html;
      }
    }
  } catch (err) {
    if (list) list.innerHTML = `<p class="error-text">Failed to fetch live analytics: ${err.message}</p>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Refresh Live Metrics';
    }
  }
}

// ========================================================
// FEATURE 1: 1-CLICK AUTO-PILOT BATCH MODE CONTROLS
// ========================================================
function setupAutoPilotControls() {
  const launchBtn = $('#launchAutoPilotBtn');
  const wsAutoPilotBtn = $('#workspaceAutoPilotBtn');
  const modal = $('#autopilotModal');
  const closeBtn = $('#closeAutopilotModal');
  const cancelBtn = $('#cancelAutopilotModalBtn');
  const form = $('#autopilotForm');
  const startBtn = $('#startAutoPilotBtn');
  const progressWrap = $('#autoPilotProgressWrap');
  const progressBar = $('#autoPilotProgressBar');
  const progressMsg = $('#autoPilotProgressMessage');

  const openModal = () => {
    renderAutoPilotAccounts();
    modal?.classList.remove('hidden');
  };

  if (launchBtn) launchBtn.onclick = openModal;
  if (wsAutoPilotBtn) wsAutoPilotBtn.onclick = openModal;

  const closeModal = () => modal?.classList.add('hidden');
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const selectAllBtn = $('#autoPilotSelectAllAccs');
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      $$('.ap-acc-checkbox').forEach(cb => { cb.checked = true; });
      updateAutoPilotAccCount();
    };
  }

  function renderAutoPilotAccounts() {
    const grid = $('#autoPilotAccountsGrid');
    if (!grid) return;
    const accounts = (state.scheduler?.accounts || []).filter(a => a.enabled);
    if (!accounts.length) {
      grid.innerHTML = '<p class="muted" style="padding: 10px; font-size: 12px;">No accounts connected. Add an account in Manage Accounts.</p>';
      return;
    }
    let html = '';
    accounts.forEach(a => {
      html += `
        <label class="sched-acc-item" style="cursor: pointer;">
          <input type="checkbox" class="ap-acc-checkbox" value="${a.id}" checked>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 12px; color: #fff;">${escapeHtml(a.name)}</div>
            <div style="font-size: 10px; color: #94a3b8;">${escapeHtml(a.handle)} (${escapeHtml(a.platform)})</div>
          </div>
        </label>
      `;
    });
    grid.innerHTML = html;
    updateAutoPilotAccCount();
    $$('.ap-acc-checkbox').forEach(cb => {
      cb.onchange = updateAutoPilotAccCount;
    });
  }

  function updateAutoPilotAccCount() {
    const count = $$('.ap-acc-checkbox:checked').length;
    if ($('#autoPilotAccCount')) $('#autoPilotAccCount').textContent = count;
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      const clipCount = Number($('#autoPilotClipCount')?.value) || 10;
      const dripIntervalMinutes = Number($('#autoPilotDripInterval')?.value || 60);
      const dripIntervalHours = Number((dripIntervalMinutes / 60).toFixed(2));
      const enableHookStitcher = $('#autoPilotHookStitcher') ? $('#autoPilotHookStitcher').checked : true;
      const enableAutoMemes = $('#autoPilotAutoMemes') ? $('#autoPilotAutoMemes').checked : true;
      const accountIds = Array.from($$('.ap-acc-checkbox:checked')).map(cb => cb.value);

      if (accountIds.length === 0) {
        alert('Please select at least one social account for Auto-Pilot to publish to.');
        return;
      }

      startBtn.disabled = true;
      startBtn.textContent = '⏳ Initializing Auto-Pilot...';
      if (progressWrap) progressWrap.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '10%';
      if (progressMsg) progressMsg.textContent = 'Preparing video source for Auto-Pilot...';

      try {
        const urlInput = ($('#videoUrl')?.value || '').trim();
        const fileInput = $('#videoFile');
        const hasFileInput = fileInput && fileInput.files && fileInput.files.length > 0;
        const hasUrlInput = urlInput.length > 0;

        let activeJobId = null;

        // If user is inside Cinema Watcher with an active loaded stream, use it; otherwise prioritize fresh URL/File input
        if (state.activeTab === 'watch' && state.cinema?.job && state.cinema.job.status !== 'failed' && state.cinema.job.sourcePath) {
          activeJobId = state.cinema.job.id;
        } else if (hasUrlInput) {
          if (progressMsg) progressMsg.textContent = 'Downloading video source with yt-dlp...';
          const jobRes = await api('/api/jobs/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput, options: { ...getJobOptions(), autoProcess: false } })
          });
          activeJobId = jobRes.id;
          state.currentJob = jobRes;
        } else if (hasFileInput) {
          if (progressMsg) progressMsg.textContent = 'Uploading video file to workspace...';
          const fd = new FormData();
          fd.append('video', fileInput.files[0]);
          fd.append('options', JSON.stringify({ ...getJobOptions(), autoProcess: false }));
          const r = await fetch('/api/jobs/upload', { method: 'POST', body: fd });
          const jobRes = await r.json();
          if (!r.ok) throw new Error(jobRes.error || 'Upload failed');
          activeJobId = jobRes.id;
          state.currentJob = jobRes;
        } else if (state.currentJob && state.currentJob.status !== 'failed' && state.currentJob.sourcePath) {
          activeJobId = state.currentJob.id;
        } else if (state.cinema?.job && state.cinema.job.status !== 'failed' && state.cinema.job.sourcePath) {
          activeJobId = state.cinema.job.id;
        } else {
          alert('Please enter a stream/video URL or drop a video file in the Studio before launching Auto-Pilot.');
          startBtn.disabled = false;
          startBtn.textContent = '🚀 Launch 100% Hands-Off Auto-Pilot';
          if (progressWrap) progressWrap.classList.add('hidden');
          return;
        }

        if (progressMsg) progressMsg.textContent = '🚀 Launching Auto-Pilot pipeline...';

        await api(`/api/jobs/${activeJobId}/autopilot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipCount,
            dripIntervalMinutes,
            dripIntervalHours,
            enableHookStitcher,
            autoMemes: enableAutoMemes,
            accountIds,
            renderOptions: {
              ...getWatermarkOptions(),
              framingMode: state.framing?.mode || 'smart',
              aspectRatio: '9:16',
              captionsEnabled: true
            }
          })
        });

        const pollTimer = setInterval(async () => {
          try {
            const status = await api(`/api/jobs/${activeJobId}/autopilot/status`);
            if (status) {
              if (progressBar) progressBar.style.width = `${Math.min(100, status.percent || 15)}%`;
              if (progressMsg) progressMsg.textContent = status.message || 'Processing...';

              if (status.status === 'completed') {
                clearInterval(pollTimer);
                startBtn.disabled = false;
                startBtn.textContent = '🚀 Launch 100% Hands-Off Auto-Pilot';
                alert(`🎉 Auto-Pilot Succeeded!\n\n${status.message}\n\nSwitching to Post Queue & History to view your scheduled release schedule.`);
                closeModal();
                window.switchAppView('scheduler');
                window.switchSchedulerSubTab('queue');
              } else if (status.status === 'failed') {
                clearInterval(pollTimer);
                startBtn.disabled = false;
                startBtn.textContent = '🚀 Launch 100% Hands-Off Auto-Pilot';
                alert(`Auto-Pilot Error: ${status.message}`);
              }
            }
          } catch (_) {}
        }, 3000);

      } catch (err) {
        alert(`Failed to start Auto-Pilot: ${err.message}`);
        startBtn.disabled = false;
        startBtn.textContent = '🚀 Launch 100% Hands-Off Auto-Pilot';
        if (progressWrap) progressWrap.classList.add('hidden');
      }
    };
  }
}

// =========================================================
// Multi-Clip Batch Drip Scheduler (5-6h Streams & High Volume)
// =========================================================
function setupBatchDripModal() {
  const modal = $('#batchDripModal');
  const closeBtn = $('#closeBatchDripModal');
  const cancelBtn = $('#cancelBatchDripModalBtn');
  const confirmBtn = $('#confirmBatchDripBtn');
  const studioBtn = $('#batchScheduleAllClipsBtn');
  const cinemaBtn = $('#cinemaBatchScheduleBtn');
  const accountsGrid = $('#batchDripAccountsGrid');
  const clipsChecklist = $('#batchClipsChecklist');
  const clipCountBadge = $('#batchSelectedClipCountBadge');
  const accCountBadge = $('#batchDripAccCountBadge');
  const instantCard = $('#batchModeInstantLabel');
  const dripCard = $('#batchModeDripLabel');
  const dripWrap = $('#batchDripIntervalWrap');
  const selectSafe5Btn = $('#batchSelectSafe5Btn');
  const selectAllClipsBtn = $('#batchSelectAllClipsBtn');
  const deselectAllClipsBtn = $('#batchDeselectAllClipsBtn');
  const progressWrap = $('#batchPostProgressWrap');
  const progressBar = $('#batchPostProgressBar');
  const progressMsg = $('#batchPostProgressMsg');

  let currentMode = 'instant';

  // Mode switching
  if (instantCard && dripCard) {
    instantCard.onclick = () => {
      currentMode = 'instant';
      instantCard.classList.add('selected');
      instantCard.style.borderColor = '#ff4400';
      instantCard.style.background = 'rgba(255, 68, 0, 0.12)';
      dripCard.classList.remove('selected');
      dripCard.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      dripCard.style.background = '#0e0e16';
      if (dripWrap) dripWrap.classList.add('hidden');
      if (confirmBtn) confirmBtn.textContent = '🚀 Publish Selected Clips Now';
    };

    dripCard.onclick = () => {
      currentMode = 'drip';
      dripCard.classList.add('selected');
      dripCard.style.borderColor = '#ff4400';
      dripCard.style.background = 'rgba(255, 68, 0, 0.12)';
      instantCard.classList.remove('selected');
      instantCard.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      instantCard.style.background = '#0e0e16';
      if (dripWrap) dripWrap.classList.remove('hidden');
      if (confirmBtn) confirmBtn.textContent = '⏳ Schedule Staggered Drip';
    };
  }

  const updateSelectedClipsCount = () => {
    const checked = $$('.batch-clip-cb:checked').length;
    if (clipCountBadge) clipCountBadge.textContent = checked;
  };

  const updateSelectedAccCount = () => {
    const checked = $$('.batch-drip-acc-cb:checked').length;
    if (accCountBadge) accCountBadge.textContent = checked;
  };

  if (selectSafe5Btn) {
    selectSafe5Btn.onclick = () => {
      const activePart = $('#batchDripPartFilter')?.value || 'all';
      let selectedCount = 0;
      $$('.batch-clip-cb').forEach(cb => {
        const matchesPart = activePart === 'all' || cb.dataset.part === activePart;
        if (matchesPart && selectedCount < 5) {
          cb.checked = true;
          selectedCount++;
        } else {
          cb.checked = false;
        }
      });
      updateSelectedClipsCount();
    };
  }

  if (selectAllClipsBtn) {
    selectAllClipsBtn.onclick = () => {
      const activePart = $('#batchDripPartFilter')?.value || 'all';
      $$('.batch-clip-cb').forEach(cb => {
        if (activePart === 'all' || cb.dataset.part === activePart) {
          cb.checked = true;
        }
      });
      updateSelectedClipsCount();
    };
  }

  if (deselectAllClipsBtn) {
    deselectAllClipsBtn.onclick = () => {
      $$('.batch-clip-cb').forEach(cb => cb.checked = false);
      updateSelectedClipsCount();
    };
  }

  const partFilter = $('#batchDripPartFilter');
  if (partFilter) {
    partFilter.onchange = () => {
      const p = partFilter.value;
      $$('.batch-clip-cb').forEach(cb => {
        const cPart = cb.dataset.part;
        if (p === 'all' || cPart === p) {
          cb.checked = true;
          cb.closest('label').style.display = 'flex';
        } else {
          cb.checked = false;
          cb.closest('label').style.display = 'none';
        }
      });
      updateSelectedClipsCount();
    };
  }

  const openModal = () => {
    const job = state.cinema?.job || state.currentJob;
    if (!job || !job.clips || job.clips.length === 0) {
      alert('Please analyze a stream or video first to discover clips before batch posting.');
      return;
    }

    if (partFilter) partFilter.value = 'all';

    // Render clips checklist
    if (clipsChecklist) {
      clipsChecklist.innerHTML = job.clips.map((clip, idx) => {
        const dur = Math.round(clip.end - clip.start);
        const score = clip.score || 85;
        const clipPart = clip.part || clip.partIndex || (clip.title?.match(/\[Part (\d+)\]/i)?.[1] ? Number(clip.title.match(/\[Part (\d+)\]/i)[1]) : 1);
        const isRendered = (job.outputs || []).some(o => o.name?.includes(clip.title) || o.filePath?.includes(clip.id));
        return `
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; font-size: 12px; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <input type="checkbox" class="batch-clip-cb" value="${clip.id}" data-part="${clipPart}" ${idx < 5 ? 'checked' : ''}>
              <span style="font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                #${idx + 1} ${clip.title}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span class="part-badge" style="font-size: 9px; padding: 1px 5px;">P${clipPart}</span>
              <span style="color: #94a3b8; font-size: 11px;">${dur}s</span>
              <span class="status-badge" style="background: rgba(255, 68, 0, 0.2); color: #ff6600; font-size: 10px; padding: 2px 6px;">${score} pts</span>
              ${isRendered ? '<span style="color: #22c55e; font-size: 10px;">✓ Ready</span>' : '<span style="color: #eab308; font-size: 10px;">⚡ Auto-Render</span>'}
            </div>
          </label>
        `;
      }).join('');

      $$('.batch-clip-cb').forEach(cb => cb.onchange = updateSelectedClipsCount);
      updateSelectedClipsCount();
    }

    // Render accounts checkboxes
    if (accountsGrid) {
      const accounts = state.scheduler?.accounts || [];
      if (accounts.length === 0) {
        accountsGrid.innerHTML = '<p class="muted" style="font-size: 12px; grid-column: 1/-1;">No social accounts connected. Connect accounts in the Post Scheduler tab.</p>';
      } else {
        accountsGrid.innerHTML = accounts.map(a => `
          <label class="sched-acc-item" style="cursor: pointer;">
            <input type="checkbox" class="batch-drip-acc-cb" value="${a.id}" ${a.enabled ? 'checked' : ''}>
            ${getAccountAvatarHtml(a)}
            <div class="acc-text">
              <strong>${a.name}</strong>
              <small>${a.handle}</small>
            </div>
          </label>
        `).join('');

        $$('.batch-drip-acc-cb').forEach(cb => { cb.onchange = updateSelectedAccCount; });
        updateSelectedAccCount();
      }
    }

    if (progressWrap) progressWrap.classList.add('hidden');
    modal?.classList.remove('hidden');
  };

  const closeModal = () => modal?.classList.add('hidden');

  if (studioBtn) studioBtn.onclick = openModal;
  if (cinemaBtn) cinemaBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const job = state.cinema?.job || state.currentJob;
      if (!job || !job.clips || job.clips.length === 0) return;

      const selectedClipIds = Array.from($$('.batch-clip-cb:checked')).map(cb => cb.value);
      const selectedAccIds = Array.from($$('.batch-drip-acc-cb:checked')).map(cb => cb.value);
      const intervalMinutes = Number($('#batchDripIntervalSelect')?.value || 60);

      if (selectedClipIds.length === 0) {
        alert('Please select at least one clip to post.');
        return;
      }

      if (selectedAccIds.length === 0) {
        alert('Please select at least one target social account.');
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ Processing Batch Post...';
      if (progressWrap) progressWrap.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '30%';
      if (progressMsg) progressMsg.textContent = `🚀 Preparing ${selectedClipIds.length} clips for ${currentMode === 'instant' ? 'instant blast' : 'drip scheduling'}...`;

      try {
        const renderOpts = {
          ...getJobOptions(),
          autoMemes: true,
          hookStitcher: $('#batchAutoRenderEnsure') ? $('#batchAutoRenderEnsure').checked : true
        };

        const res = await api(`/api/jobs/${job.id}/batch-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipIds: selectedClipIds,
            accountIds: selectedAccIds,
            filterPart: $('#batchDripPartFilter')?.value || 'all',
            mode: currentMode,
            intervalMinutes,
            renderOptions: renderOpts
          })
        });

        if (progressBar) progressBar.style.width = '100%';
        if (progressMsg) progressMsg.textContent = '✅ Batch complete!';

        setTimeout(() => {
          closeModal();
          alert(res.message || `🎉 Successfully processed batch post for ${res.count} clips!`);
          if (typeof window.switchAppView === 'function') {
            window.switchAppView('scheduler');
            if (typeof window.switchSchedulerSubTab === 'function') {
              window.switchSchedulerSubTab('queue');
            }
          }
        }, 600);
      } catch (err) {
        alert(`Batch post error: ${err.message}`);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = currentMode === 'instant' ? '🚀 Publish Selected Clips Now' : '⏳ Schedule Staggered Drip';
        if (progressWrap) progressWrap.classList.add('hidden');
      }
    };
  }
}

// =========================================================
// Advanced Discovery Controls
// =========================================================
function setupAdvancedDiscoveryControls() {
  const toggleBtn = $('#toggleAdvancedDiscoveryBtn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const body = $('#advancedCardBody');
      if (!body) return;
      const isHidden = body.classList.toggle('hidden');
      const text = $('#advToggleText');
      const chevron = $('#advToggleChevron');
      if (text) text.textContent = isHidden ? 'Show Advanced Filters' : 'Hide Advanced Filters';
      if (chevron) chevron.classList.toggle('rotated', !isHidden);
    };
  }
}

// =========================================================
// B-Roll & Meme Overlay Manager
// =========================================================
state.clipOverlays = new Map(); // clipId -> array of overlays
let memeCatalogData = [];

function getActiveClipOverlays(clipId) {
  if (!clipId) return [];
  return state.clipOverlays.get(clipId) || [];
}

async function setupOverlayManager() {
  const gridContainer = $('#memeGridContainer');
  const fileInput = $('#customOverlayFileInput');
  const insertBtn = $('#insertMemeAtCurrentTimeBtn');
  const clearBtn = $('#clearAllClipOverlaysBtn');

  // Load Memes Catalog
  try {
    const res = await api('/api/memes');
    memeCatalogData = [...(res.builtIn || []), ...(res.custom || [])];
    renderMemeCatalogGrid(memeCatalogData);
  } catch (err) {
    console.warn('Could not load memes catalog:', err);
  }

  function renderMemeCatalogGrid(items) {
    if (!gridContainer) return;
    gridContainer.innerHTML = items.map(m => `
      <div class="meme-card-btn" data-meme-id="${m.id}" title="${m.tagline || m.name}">
        <span class="m-icon">${m.icon || '🎭'}</span>
        <span class="m-title">${m.name}</span>
        <span class="m-tagline">${(m.tagline || '').slice(0, 24)}</span>
      </div>
    `).join('');

    $$('.meme-card-btn').forEach(btn => {
      btn.onclick = () => {
        const memeId = btn.dataset.memeId;
        const meme = memeCatalogData.find(m => m.id === memeId);
        if (meme) addOverlayToActiveClip(meme);
      };
    });
  }

  function addOverlayToActiveClip(meme) {
    if (!state.activeClipId) {
      alert('Please select a clip first to add reaction overlays.');
      return;
    }
    const clip = (state.currentJob?.clips || []).find(c => c.id === state.activeClipId);
    const video = $('#previewVideo') || $('#player');
    let relSec = 2.0;
    if (clip && video && video.currentTime) {
      relSec = Math.max(0.5, Number((video.currentTime - clip.start).toFixed(1)));
    }

    const currentList = state.clipOverlays.get(state.activeClipId) || [];
    const newOverlay = {
      id: `ov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memeId: meme.id,
      name: meme.name,
      icon: meme.icon || '🎭',
      imageUrl: meme.imageUrl || meme.url,
      soundUrl: meme.soundUrl,
      imagePath: meme.imagePath,
      soundPath: meme.soundPath,
      startSec: relSec,
      duration: meme.defaultDuration || 2.0,
      position: meme.defaultPosition || 'center',
      scale: meme.defaultScale || 0.52,
      soundEnabled: $('#editMemeSoundEnabled')?.checked ?? true
    };

    currentList.push(newOverlay);
    state.clipOverlays.set(state.activeClipId, currentList);
    renderActiveOverlaysList();
  }

  if (insertBtn) {
    insertBtn.onclick = () => {
      if (memeCatalogData.length > 0) {
        addOverlayToActiveClip(memeCatalogData[0]);
      }
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      if (!state.activeClipId) return;
      state.clipOverlays.set(state.activeClipId, []);
      renderActiveOverlaysList();
    };
  }

  // Custom File Upload
  if (fileInput) {
    fileInput.onchange = async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      const fd = new FormData();
      fd.append('overlayFile', file);

      try {
        const r = await fetch('/api/overlays/upload', { method: 'POST', body: fd });
        const item = await r.json();
        if (!r.ok) throw new Error(item.error || 'Upload failed');
        memeCatalogData.unshift(item);
        renderMemeCatalogGrid(memeCatalogData);
        addOverlayToActiveClip(item);
      } catch (err) {
        alert(`Overlay upload failed: ${err.message}`);
      }
    };
  }

  // Track video player time display
  const player = $('#previewVideo') || $('#player');
  if (player) {
    player.addEventListener('timeupdate', () => {
      const curDisplay = $('#playerCurrentTimeDisplay');
      if (curDisplay) {
        const cur = player.currentTime || 0;
        const mins = Math.floor(cur / 60);
        const secs = Math.floor(cur % 60);
        const label = `${mins}:${String(secs).padStart(2, '0')}`;
        if (curDisplay.textContent !== label) curDisplay.textContent = label;
      }
    });
  }
}

function renderActiveOverlaysList() {
  const container = $('#activeOverlaysList');
  const countBadge = $('#activeOverlayCount');
  if (!container) return;

  const overlays = getActiveClipOverlays(state.activeClipId);
  if (countBadge) countBadge.textContent = overlays.length;

  if (overlays.length === 0) {
    container.innerHTML = '<p class="muted" style="font-size: 12px; margin: 8px 0;">No manual overlays yet. Auto-detect will dynamically insert 1-2 reaction memes upon render.</p>';
    return;
  }

  container.innerHTML = overlays.map((ov) => `
    <div class="overlay-item-row" data-ov-id="${ov.id}">
      <div class="overlay-item-info">
        <span style="font-size: 18px;">${ov.icon}</span>
        <div>
          <strong style="color: #f1f5f9; display: block; font-size: 12px;">${ov.name}</strong>
          <small class="muted" style="font-size: 10px;">${ov.position} · ${ov.duration}s</small>
        </div>
      </div>
      <div class="overlay-item-controls">
        <label style="margin: 0; font-size: 10px; color: #94a3b8;">
          At
          <input type="number" step="0.5" min="0" max="180" class="overlay-time-input" value="${ov.startSec}" data-action="edit-start" title="Start second relative to clip">s
        </label>
        <label style="margin: 0; font-size: 10px; color: #94a3b8;">
          Dur
          <input type="number" step="0.5" min="0.5" max="10" class="overlay-time-input" value="${ov.duration}" data-action="edit-dur" style="width: 48px;" title="Duration in seconds">s
        </label>
        <select class="overlay-pos-select" data-action="edit-pos">
          <option value="center" ${ov.position === 'center' ? 'selected' : ''}>Center Pop</option>
          <option value="above-captions" ${ov.position === 'above-captions' ? 'selected' : ''}>Above Subtitles</option>
          <option value="top-right" ${ov.position === 'top-right' ? 'selected' : ''}>Top Right (PIP)</option>
          <option value="bottom-right" ${ov.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          <option value="top-center" ${ov.position === 'top-center' ? 'selected' : ''}>Top Center</option>
          <option value="bottom-center" ${ov.position === 'bottom-center' ? 'selected' : ''}>Bottom Center</option>
          <option value="fullscreen" ${ov.position === 'fullscreen' ? 'selected' : ''}>Fullscreen</option>
        </select>
        <button type="button" class="pill-btn danger-sm" data-action="delete" title="Remove overlay" style="padding: 2px 7px;">✕</button>
      </div>
    </div>
  `).join('');

  $$('.overlay-item-row').forEach(row => {
    const ovId = row.dataset.ovId;
    const list = getActiveClipOverlays(state.activeClipId);
    const target = list.find(o => o.id === ovId);
    if (!target) return;

    const delBtn = row.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.onclick = () => {
        state.clipOverlays.set(state.activeClipId, list.filter(o => o.id !== ovId));
        renderActiveOverlaysList();
      };
    }

    const startIn = row.querySelector('[data-action="edit-start"]');
    if (startIn) {
      startIn.onchange = () => {
        target.startSec = Math.max(0, Number(startIn.value) || 0);
      };
    }

    const durIn = row.querySelector('[data-action="edit-dur"]');
    if (durIn) {
      durIn.onchange = () => {
        target.duration = Math.max(0.5, Number(durIn.value) || 2.0);
      };
    }

    const posSel = row.querySelector('[data-action="edit-pos"]');
    if (posSel) {
      posSel.onchange = () => {
        target.position = posSel.value;
      };
    }
  });
}

// =========================================================
// Stream Cinema & Clip Timeline Watching Section
// =========================================================
state.cinema = {
  activeClipId: null,
  loopClip: false,
  showGuides: false,
  job: null
};

function initCinemaView() {
  const jobSelect = $('#cinemaJobSelect');
  if (jobSelect) {
    const jobsWithSource = (state.jobs || []).filter(j => j.sourcePath || (j.clips && j.clips.length > 0));
    jobSelect.innerHTML = '<option value="">Select a downloaded stream or video...</option>' +
      jobsWithSource.map(j => `
        <option value="${j.id}" ${state.currentJob?.id === j.id ? 'selected' : ''}>
          ${j.sourceName || 'Stream'} (${Math.round((j.duration || 0) / 60)} min · ${j.clips?.length || 0} clips)
        </option>
      `).join('');
  }

  // Load active job or first available job
  const targetJob = state.currentJob || (state.jobs && state.jobs[0]);
  if (targetJob) {
    loadStreamIntoCinema(targetJob);
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function cinemaSeekTo(seconds, play = true) {
  const sec = Math.max(0, Number(seconds) || 0);
  const ytIframe = $('#cinemaYoutubeIframe');
  if (ytIframe && ytIframe.style.display !== 'none') {
    try {
      ytIframe.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: 'seekTo',
        args: [sec, true]
      }), '*');
      if (play) {
        ytIframe.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: []
        }), '*');
      }
    } catch {}
  }

  const vid = $('#cinemaVideo');
  if (vid && vid.style.display !== 'none' && !isNaN(sec)) {
    vid.currentTime = sec;
    if (play) vid.play().catch(() => {});
  }
}

function loadStreamIntoCinema(job) {
  state.cinema.job = job;
  const vid = $('#cinemaVideo');
  const titleEl = $('#cinemaStreamTitle');
  const metaEl = $('#cinemaStreamMeta');
  const clipCountEl = $('#cinemaClipCount');

  if (titleEl) titleEl.textContent = job.sourceName || 'Stream Cinema Player';
  if (metaEl) {
    const mins = Math.round((job.duration || 0) / 60);
    metaEl.textContent = `${mins} min stream · ${job.clips?.length || 0} AI viral moments · Frame-Accurate Scrubbing & Trimming`;
  }
  if (clipCountEl) clipCountEl.textContent = job.clips?.length || 0;

  // Set video source or YouTube stream embed
  const ytId = extractYouTubeId(job.sourceUrl);
  let ytIframe = $('#cinemaYoutubeIframe');

  if (ytId && (job.audioOnly || !job.sourcePath || job.sourcePath.endsWith('.m4a') || job.sourcePath.endsWith('.mp3'))) {
    if (vid) vid.style.display = 'none';
    if (!ytIframe) {
      ytIframe = document.createElement('iframe');
      ytIframe.id = 'cinemaYoutubeIframe';
      ytIframe.style.cssText = 'width: 100%; height: 100%; min-height: 480px; border: none; border-radius: 8px; background: #000;';
      ytIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      ytIframe.allowFullscreen = true;
      const container = $('#cinemaVideoContainer') || vid?.parentElement;
      if (container) container.appendChild(ytIframe);
    }
    ytIframe.style.display = 'block';
    ytIframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  } else {
    if (ytIframe) ytIframe.style.display = 'none';
    if (vid) {
      vid.style.display = 'block';
      if (job.sourcePath) {
        const filename = job.sourcePath.split('\\').pop().split('/').pop();
        const videoUrl = `/incoming/${encodeURIComponent(filename)}`;
        if (!vid.src.endsWith(filename) && !vid.src.endsWith(encodeURIComponent(filename))) {
          vid.src = videoUrl;
          vid.load();
        }
      } else if (job.clips && job.clips.length > 0 && job.clips[0].renderedVideo) {
        const clipFile = job.clips[0].renderedVideo.split('\\').pop().split('/').pop();
        vid.src = `/finished/${encodeURIComponent(clipFile)}`;
        vid.load();
      }
    }
  }

  renderCinemaTimelines();
  renderCinemaMasterTrack();
}

function renderCinemaTimelines() {
  const container = $('#cinemaTimelineList');
  if (!container) return;
  const job = state.cinema.job || state.currentJob;

  if (!job || !job.clips || job.clips.length === 0) {
    container.innerHTML = `
      <div class="cinema-empty-state" style="padding: 30px 20px; text-align: center; color: #94a3b8;">
        <p style="font-size: 13px; line-height: 1.5;">No AI moments detected yet for this stream.</p>
        <small style="color: #64748b; margin-top: 6px; display: block;">Drop a link in Studio to run Whisper & discover viral clips automatically.</small>
      </div>
    `;
    return;
  }

  const duration = Math.max(1, job.duration || 1);
  const segments = job.transcript?.segments || [];

  container.innerHTML = job.clips.map((clip, i) => {
    const isActive = clip.id === state.cinema.activeClipId;
    const clipDur = Math.max(1, (clip.end - clip.start)).toFixed(1);
    const leftPct = ((clip.start / duration) * 100).toFixed(1);
    const widthPct = Math.max(2, ((clip.end - clip.start) / duration) * 100).toFixed(1);

    // Find transcript segments spoken during this clip
    const clipSegments = segments.filter(s => s.end >= clip.start && s.start <= clip.end);
    let transcriptHtml = '';
    if (clipSegments.length > 0) {
      transcriptHtml = clipSegments.map(s => `
        <span class="watch-transcript-segment" data-start="${s.start}" title="Click to seek to ${formatTime(s.start)}">
          <small class="transcript-ts">${formatTime(s.start)}</small>${s.text}
        </span>
      `).join(' ');
    } else {
      transcriptHtml = `<span class="clip-dialogue-text">"${clip.hook || clip.reason || 'Dialogue segment'}"</span>`;
    }

    const scoreClass = clip.score >= 90 ? 'diamond' : clip.score >= 80 ? 'high' : 'good';

    return `
      <div class="watch-clip-card ${isActive ? 'active' : ''}" data-clip-id="${clip.id}">
        <div class="card-meta-row">
          <span class="card-num-tag">#${String(i + 1).padStart(2, '0')}</span>
          <span class="badge-mini ${scoreClass}">★ ${clip.score || 85}/100</span>
          <span class="card-dur-tag">⏱️ ${clipDur}s</span>
        </div>

        <div class="watch-clip-title">${clip.title}</div>

        <!-- Mini Timeline Relative to Stream -->
        <div class="watch-mini-track" title="Timestamp: ${formatTime(clip.start)} - ${formatTime(clip.end)}">
          <div class="watch-mini-bar" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
        </div>

        <!-- Spoken dialogue / transcript snippet (Click words to seek) -->
        <div class="watch-transcript-box" title="Click words to forward/backward player to that part">
          ${transcriptHtml}
        </div>

        <!-- Expand & Trim Controls: User can see and expand/trim the clip -->
        <div class="watch-trim-drawer">
          <div class="watch-trim-row">
            <span style="color: #94a3b8; font-weight: 700;">Start:</span>
            <div class="nudge-ctrl-group">
              <button type="button" class="watch-nudge-btn" data-action="trim-start-minus-5">◀ -5s</button>
              <button type="button" class="watch-nudge-btn" data-action="trim-start-minus-1">-1s</button>
              <span class="watch-time-badge" data-val="start">${formatTime(clip.start)}</span>
              <button type="button" class="watch-nudge-btn" data-action="trim-start-plus-1">+1s</button>
              <button type="button" class="watch-nudge-btn" data-action="trim-start-plus-5">+5s ▶</button>
            </div>
          </div>

          <div class="watch-trim-row">
            <span style="color: #94a3b8; font-weight: 700;">End:</span>
            <div class="nudge-ctrl-group">
              <button type="button" class="watch-nudge-btn" data-action="trim-end-minus-5">◀ -5s</button>
              <button type="button" class="watch-nudge-btn" data-action="trim-end-minus-1">-1s</button>
              <span class="watch-time-badge" data-val="end">${formatTime(clip.end)}</span>
              <button type="button" class="watch-nudge-btn" data-action="trim-end-plus-1">+1s</button>
              <button type="button" class="watch-nudge-btn" data-action="trim-end-plus-5">+5s ▶</button>
            </div>
          </div>
        </div>

        <div class="watch-card-actions">
          <button type="button" class="watch-card-btn primary" data-action="seek">▶ Jump To Clip</button>
          <button type="button" class="watch-card-btn" data-action="edit-studio">✂️ Studio Editor</button>
          <button type="button" class="watch-card-btn" data-action="queue-post">📅 Schedule Post</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  $$('.watch-clip-card').forEach(card => {
    const clipId = card.dataset.clipId;
    const clip = job.clips.find(c => c.id === clipId);
    if (!clip) return;

    // Clicking card seeks to clip start
    card.onclick = (e) => {
      if (e.target.closest('button, input, .watch-transcript-segment')) return;
      cinemaSelectClip(clipId, true);
    };

    // Click transcript segment to jump to that exact timestamp
    card.querySelectorAll('.watch-transcript-segment').forEach(seg => {
      seg.onclick = (e) => {
        e.stopPropagation();
        const startSec = parseFloat(seg.dataset.start);
        if (!isNaN(startSec)) {
          cinemaSeekTo(startSec, true);
        }
      };
    });

    // Card buttons
    const seekBtn = card.querySelector('[data-action="seek"]');
    if (seekBtn) seekBtn.onclick = () => cinemaSelectClip(clipId, true);

    const editBtn = card.querySelector('[data-action="edit-studio"]');
    if (editBtn) editBtn.onclick = () => {
      cinemaSelectClip(clipId, false);
      window.switchAppView('studio');
      selectClip(clipId, true);
    };

    const queueBtn = card.querySelector('[data-action="queue-post"]');
    if (queueBtn) queueBtn.onclick = () => openSchedulerWithCandidateClip(clipId);

    // Expand / Trim handlers
    const startBadge = card.querySelector('.watch-time-badge[data-val="start"]');
    const endBadge = card.querySelector('.watch-time-badge[data-val="end"]');

    const updateTrim = (newStart, newEnd) => {
      clip.start = Math.max(0, Math.min(newEnd - 5, Number(newStart)));
      clip.end = Math.min(job.duration || 99999, Math.max(clip.start + 5, Number(newEnd)));
      if (startBadge) startBadge.textContent = formatTime(clip.start);
      if (endBadge) endBadge.textContent = formatTime(clip.end);
      const durTag = card.querySelector('.card-dur-tag');
      if (durTag) durTag.textContent = `⏱️ ${(clip.end - clip.start).toFixed(1)}s`;
      renderCinemaMasterTrack();
      updateClipData(clip.id, { start: clip.start, end: clip.end });
    };

    const sm5 = card.querySelector('[data-action="trim-start-minus-5"]');
    if (sm5) sm5.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start - 5, clip.end); };
    const sm1 = card.querySelector('[data-action="trim-start-minus-1"]');
    if (sm1) sm1.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start - 1, clip.end); };
    const sp1 = card.querySelector('[data-action="trim-start-plus-1"]');
    if (sp1) sp1.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start + 1, clip.end); };
    const sp5 = card.querySelector('[data-action="trim-start-plus-5"]');
    if (sp5) sp5.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start + 5, clip.end); };

    const em5 = card.querySelector('[data-action="trim-end-minus-5"]');
    if (em5) em5.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start, clip.end - 5); };
    const em1 = card.querySelector('[data-action="trim-end-minus-1"]');
    if (em1) em1.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start, clip.end - 1); };
    const ep1 = card.querySelector('[data-action="trim-end-plus-1"]');
    if (ep1) ep1.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start, clip.end + 1); };
    const ep5 = card.querySelector('[data-action="trim-end-plus-5"]');
    if (ep5) ep5.onclick = (e) => { e.stopPropagation(); updateTrim(clip.start, clip.end + 5); };
  });
}

function cinemaSelectClip(clipId, play = true) {
  state.cinema.activeClipId = clipId;
  const job = state.cinema.job || state.currentJob;
  if (!job) return;
  const clip = job.clips?.find(c => c.id === clipId);
  if (!clip) return;

  // Highlight left panel card
  $$('.watch-clip-card').forEach(c => c.classList.toggle('active', c.dataset.clipId === clipId));
  const activeBadge = $('#cinemaActiveClipBadge');
  if (activeBadge) activeBadge.textContent = clip.title.slice(0, 20);

  // Jump cinema video player forward or backward to clip start
  cinemaSeekTo(clip.start, play);

  // Update HUD
  const hudName = $('#cinemaHudClipName');
  if (hudName) hudName.textContent = `CLIP: ${clip.title.toUpperCase()}`;
}

function renderCinemaMasterTrack() {
  const track = $('#cinemaMasterTimelineTrack');
  const job = state.cinema.job || state.currentJob;
  if (!track || !job) return;

  const duration = Math.max(1, job.duration || 1);
  const clips = job.clips || [];

  // Remove existing zones (keep playhead)
  $$('.cinema-clip-zone').forEach(z => z.remove());

  clips.forEach((clip, i) => {
    const leftPct = (clip.start / duration) * 100;
    const widthPct = Math.max(0.8, ((clip.end - clip.start) / duration) * 100);
    const scoreClass = clip.score >= 90 ? 'diamond' : clip.score >= 80 ? 'high' : 'good';

    const zone = document.createElement('div');
    zone.className = `cinema-clip-zone ${scoreClass}`;
    zone.style.left = `${leftPct}%`;
    zone.style.width = `${widthPct}%`;
    zone.title = `#${i + 1} "${clip.title}" (${formatTime(clip.start)} - ${formatTime(clip.end)}) · Score: ${clip.score}/100`;

    zone.onclick = (e) => {
      e.stopPropagation();
      cinemaSelectClip(clip.id, true);
    };

    track.appendChild(zone);
  });
}

function setupCinemaWatcher() {
  const vid = $('#cinemaVideo');
  const playBtn = $('#cinemaPlayBtn');
  const back5Btn = $('#cinemaBack5Btn');
  const fwd5Btn = $('#cinemaFwd5Btn');
  const loopBtn = $('#cinemaLoopToggleBtn');
  const guidesBtn = $('#cinemaGuidesToggleBtn');
  const markClipBtn = $('#cinemaMarkClipBtn');
  const speedSelect = $('#cinemaSpeedSelect');
  const fsBtn = $('#cinemaFullscreenBtn');
  const prevClipBtn = $('#cinemaPrevClipBtn');
  const nextClipBtn = $('#cinemaNextClipBtn');
  const editInStudioBtn = $('#cinemaEditInStudioBtn');
  const autoPilotBtn = $('#cinemaLaunchAutoPilotBtn');
  const jobSelect = $('#cinemaJobSelect');
  const masterTrack = $('#cinemaMasterTimelineTrack');
  const searchInput = $('#cinemaTranscriptSearch');

  if (jobSelect) {
    jobSelect.onchange = () => {
      const selectedId = jobSelect.value;
      const targetJob = state.jobs.find(j => j.id === selectedId);
      if (targetJob) {
        state.currentJob = targetJob;
        loadStreamIntoCinema(targetJob);
      }
    };
  }

  if (vid) {
    vid.ontimeupdate = () => {
      const cur = vid.currentTime || 0;
      const dur = vid.duration || state.cinema.job?.duration || 1;

      // Update timer texts
      const timeStr = `${formatTime(cur)} / ${formatTime(dur)}`;
      const timerDisplay = $('#cinemaTimerDisplay');
      const hudTime = $('#cinemaHudTime');
      if (timerDisplay) timerDisplay.textContent = timeStr;
      if (hudTime) hudTime.textContent = timeStr;

      // Update master playhead
      const playhead = $('#cinemaPlayhead');
      if (playhead) {
        playhead.style.left = `${Math.min(100, (cur / dur) * 100)}%`;
      }

      // Detect active clip at playhead
      const clips = state.cinema.job?.clips || [];
      const currentClip = clips.find(c => cur >= c.start && cur <= c.end);
      if (currentClip) {
        if (state.cinema.activeClipId !== currentClip.id) {
          state.cinema.activeClipId = currentClip.id;
          $$('.watch-clip-card').forEach(c => {
            const isMatch = c.dataset.clipId === currentClip.id;
            c.classList.toggle('active', isMatch);
            if (isMatch) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
          const hudName = $('#cinemaHudClipName');
          if (hudName) hudName.textContent = `IN CLIP: ${currentClip.title.toUpperCase()}`;
        }

        // Loop clip mode
        if (state.cinema.loopClip && cur >= currentClip.end - 0.2) {
          vid.currentTime = currentClip.start;
        }
      }
    };

    vid.onplay = () => { if (playBtn) playBtn.textContent = '⏸ Pause'; };
    vid.onpause = () => { if (playBtn) playBtn.textContent = '▶ Play'; };
  }

  if (playBtn && vid) {
    playBtn.onclick = () => {
      if (vid.paused) vid.play();
      else vid.pause();
    };
  }

  if (back5Btn && vid) {
    back5Btn.onclick = () => { vid.currentTime = Math.max(0, vid.currentTime - 5); };
  }

  if (fwd5Btn && vid) {
    fwd5Btn.onclick = () => { vid.currentTime = Math.min(vid.duration || 99999, vid.currentTime + 5); };
  }

  if (speedSelect && vid) {
    speedSelect.onchange = () => { vid.playbackRate = Number(speedSelect.value); };
  }

  if (loopBtn) {
    loopBtn.onclick = () => {
      state.cinema.loopClip = !state.cinema.loopClip;
      loopBtn.textContent = state.cinema.loopClip ? '🔁 Loop Clip: ON' : '🔁 Loop Clip: OFF';
      loopBtn.classList.toggle('lava-glow-btn', state.cinema.loopClip);
    };
  }

  if (guidesBtn) {
    guidesBtn.onclick = () => {
      state.cinema.showGuides = !state.cinema.showGuides;
      $('#cinemaSafeGuides')?.classList.toggle('hidden', !state.cinema.showGuides);
      guidesBtn.classList.toggle('lava-glow-btn', state.cinema.showGuides);
    };
  }

  if (fsBtn && vid) {
    fsBtn.onclick = () => {
      const container = $('#cinemaVideoContainer');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (container) container.requestFullscreen();
    };
  }

  if (prevClipBtn) {
    prevClipBtn.onclick = () => {
      const clips = state.cinema.job?.clips || [];
      if (!clips.length) return;
      const idx = clips.findIndex(c => c.id === state.cinema.activeClipId);
      const prevIdx = idx > 0 ? idx - 1 : clips.length - 1;
      cinemaSelectClip(clips[prevIdx].id, true);
    };
  }

  if (nextClipBtn) {
    nextClipBtn.onclick = () => {
      const clips = state.cinema.job?.clips || [];
      if (!clips.length) return;
      const idx = clips.findIndex(c => c.id === state.cinema.activeClipId);
      const nextIdx = idx >= 0 && idx < clips.length - 1 ? idx + 1 : 0;
      cinemaSelectClip(clips[nextIdx].id, true);
    };
  }

  if (editInStudioBtn) {
    editInStudioBtn.onclick = () => {
      window.switchAppView('studio');
      if (state.cinema.activeClipId) {
        selectClip(state.cinema.activeClipId, true);
      }
    };
  }

  if (autoPilotBtn) {
    autoPilotBtn.onclick = () => {
      const modal = $('#autopilotModal');
      if (modal) modal.classList.remove('hidden');
    };
  }

  if (markClipBtn && vid) {
    markClipBtn.onclick = () => {
      const job = state.cinema.job || state.currentJob;
      if (!job) return;
      const cur = vid.currentTime || 0;
      const newClip = {
        id: crypto.randomUUID(),
        start: Math.max(0, Math.round(cur)),
        end: Math.min(job.duration || 99999, Math.round(cur + 30)),
        score: 88,
        title: `Custom Bookmark at ${formatTime(cur)}`,
        hook: 'User marked stream moment',
        reason: 'Manually marked moment from Cinema timeline',
        viralBadge: '🌟 High Engagement',
        category: '🔥 Viral Hook'
      };
      job.clips = job.clips || [];
      job.clips.push(newClip);
      job.clips.sort((a, b) => a.start - b.start);
      renderCinemaTimelines();
      renderCinemaMasterTrack();
      renderClipsList();
      cinemaSelectClip(newClip.id, true);
    };
  }

  if (masterTrack && vid) {
    masterTrack.onclick = (e) => {
      const rect = masterTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      const dur = vid.duration || state.cinema.job?.duration || 1;
      vid.currentTime = dur * pct;
    };
  }

  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      $$('.watch-clip-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = !q || text.includes(q) ? 'block' : 'none';
      });
    };
  }
}

// =========================================================
// BACKEND PROCESSES & SYSTEM DIAGNOSTICS MISSION CONTROL
// =========================================================

function setupProcessesAndDiagnostics() {
  let isAutoRefresh = true;
  let activeLogFilter = 'ALL';
  let cachedLogs = [];

  const autoRefreshBtn = $('#diagAutoRefreshBtn');
  const autoRefreshStatus = $('#diagAutoRefreshStatus');
  const manualRefreshBtn = $('#diagManualRefreshBtn');
  const cleanTempBtn = $('#diagCleanTempBtn');
  const emergencyStopBtn = $('#diagEmergencyStopBtn');
  const clearIncidentsBtn = $('#diagClearIncidentsBtn');
  const copyLogsBtn = $('#diagCopyLogsBtn');
  const autoScrollCb = $('#diagLogAutoscroll');

  // Expose global kill function for table row buttons
  window.killDiagProcess = async (pid) => {
    if (!confirm(`Are you sure you want to terminate process PID ${pid}?`)) return;
    try {
      const res = await api(`/api/system/diagnostics/processes/${pid}/kill`, { method: 'POST' });
      if (res.success) {
        alert(`Process PID ${pid} terminated.`);
      } else {
        alert(`Failed to terminate process: ${res.message || 'Unknown error'}`);
      }
      refreshDiagnostics();
    } catch (err) {
      alert(`Error killing process: ${err.message}`);
    }
  };

  // 1. Render Hardware Telemetry
  function renderTelemetry(data) {
    document.dispatchEvent(new CustomEvent('autoclip-telemetry', { detail: data }));
    if (!data) return;

    // Health Card
    const healthPill = $('#diagHealthPill');
    const healthMsg = $('#diagHealthMsg');
    const sysBtn = $('#sysStatusBtn');
    const navSysAlert = $('#navSysAlertBadge');

    const status = data.health?.status || 'HEALTHY';
    if (healthPill) {
      if (status === 'CRITICAL_OOM_RISK') {
        healthPill.textContent = '🚨 CRITICAL OOM';
        healthPill.style.background = 'rgba(239, 68, 68, 0.2)';
        healthPill.style.color = '#ef4444';
        healthPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else if (status === 'HIGH_LOAD') {
        healthPill.textContent = '⚠️ HIGH LOAD';
        healthPill.style.background = 'rgba(245, 158, 11, 0.2)';
        healthPill.style.color = '#f59e0b';
        healthPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      } else {
        healthPill.textContent = '● HEALTHY';
        healthPill.style.background = 'rgba(34, 197, 94, 0.15)';
        healthPill.style.color = '#22c55e';
        healthPill.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      }
    }

    if (healthMsg) {
      healthMsg.textContent = data.health?.message || 'System resources within safe limits.';
    }

    // Top Header Status Button
    if (sysBtn) {
      if (status === 'CRITICAL_OOM_RISK') {
        sysBtn.textContent = 'System: 🚨 CRITICAL RAM';
        sysBtn.style.color = '#ef4444';
        sysBtn.style.borderColor = '#ef4444';
      } else if (status === 'HIGH_LOAD') {
        sysBtn.textContent = 'System: ⚠️ High Load';
        sysBtn.style.color = '#f59e0b';
        sysBtn.style.borderColor = '#f59e0b';
      } else {
        sysBtn.textContent = 'System: Ready (Protected)';
        sysBtn.style.color = '#22c55e';
        sysBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      }
    }

    if (navSysAlert) {
      const showBadge = (data.unresolvedCriticalCount > 0 || status === 'CRITICAL_OOM_RISK');
      navSysAlert.style.display = showBadge ? 'inline-block' : 'none';
    }

    // CPU Card
    const cpuPct = $('#diagCpuPct');
    const cpuBar = $('#diagCpuBar');
    const cpuModel = $('#diagCpuModel');
    if (cpuPct) cpuPct.textContent = `${data.cpu?.usagePercent || 0}%`;
    if (cpuBar) cpuBar.style.width = `${Math.min(100, Math.max(0, data.cpu?.usagePercent || 0))}%`;
    if (cpuModel) cpuModel.textContent = `${data.cpu?.model || 'Intel CPU'} (${data.cpu?.logicalCores || 8} Logical Cores - 2 Threads Capped)`;

    // Memory / RAM Card
    const ramPct = $('#diagRamPct');
    const ramBar = $('#diagRamBar');
    const ramDetail = $('#diagRamDetail');
    const ramFree = $('#diagRamFree');

    const usedPct = data.memory?.usedPercent || 0;
    const freeMb = data.memory?.freeMb || 0;

    if (ramPct) ramPct.textContent = `${usedPct}%`;
    if (ramBar) ramBar.style.width = `${Math.min(100, Math.max(0, usedPct))}%`;
    if (ramDetail) ramDetail.textContent = `Used: ${data.memory?.usedGb || '0'} GB / Total: ${data.memory?.totalGb || '8.0'} GB`;
    if (ramFree) {
      ramFree.textContent = `Free: ${freeMb} MB`;
      if (freeMb < 500) {
        ramFree.style.color = '#ef4444';
      } else if (freeMb < 1000) {
        ramFree.style.color = '#f59e0b';
      } else {
        ramFree.style.color = '#4ade80';
      }
    }

    // Active Workers & Storage Card
    const workerBadge = $('#diagWorkerCountBadge');
    const diskSummary = $('#diagDiskSummary');
    const serverUptime = $('#diagServerUptime');

    const workerCount = (data.processes || []).length;
    if (workerBadge) {
      workerBadge.textContent = `${workerCount} Running`;
      workerBadge.style.color = workerCount > 0 ? '#38bdf8' : '#94a3b8';
    }
    if (diskSummary) {
      diskSummary.textContent = `Storage: ${data.disk?.drive || 'D:\\'} (Free: ${data.disk?.freeGb || '--'} GB)`;
    }
    if (serverUptime) {
      serverUptime.textContent = `AUTOCLIPIN Uptime: ${data.server?.uptimeStr || '--'} | PID: ${data.server?.pid || '--'}`;
    }
  }

  // 2. Render Active Backend Processes Table
  function renderProcesses(processes = []) {
    const tableBody = $('#diagProcessesTableBody');
    const countSpan = $('#diagProcessesCountSpan');
    if (countSpan) countSpan.textContent = processes.length;
    if (!tableBody) return;

    if (processes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 28px 12px; color: #94a3b8;">
            <div style="font-size: 20px; margin-bottom: 4px;">😴</div>
            <strong style="color: #cbd5e1; font-size: 13px;">No active backend processes</strong>
            <p style="margin: 2px 0 0; font-size: 11px;">FFmpeg encoders and yt-dlp downloaders will appear here in real-time when rendering or ingesting streams.</p>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = processes.map(p => {
      let icon = '⚙️';
      let typeLabel = p.type;
      let badgeColor = '#94a3b8';

      if (p.type === 'ffmpeg') {
        icon = '🎬';
        typeLabel = 'FFmpeg 9:16 Render';
        badgeColor = '#ff6600';
      } else if (p.type === 'yt-dlp') {
        icon = '📥';
        typeLabel = 'yt-dlp HD Slice';
        badgeColor = '#3b82f6';
      } else if (p.type === 'python') {
        icon = '🐍';
        typeLabel = 'Python AI Worker';
        badgeColor = '#a855f7';
      } else if (p.type === 'node') {
        icon = '🟢';
        typeLabel = 'Node Server';
        badgeColor = '#22c55e';
      }

      const taskDesc = p.title || p.meta?.clipTitle || p.meta?.outputFile || p.meta?.command || 'Active background process';
      const isManaged = p.isManaged !== false;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
          <td style="padding: 10px 12px; font-weight: 600; color: ${badgeColor}; display: flex; align-items: center; gap: 6px;">
            <span>${icon}</span>
            <span>${typeLabel}</span>
          </td>
          <td style="padding: 10px 12px;">
            <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: #f1f5f9; font-size: 11px;">
              ${p.pid}
            </code>
          </td>
          <td style="padding: 10px 12px; color: #f8fafc; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${taskDesc}
          </td>
          <td style="padding: 10px 12px; color: #94a3b8; font-size: 11px;">
            ${p.durationStr || 'Active'}
          </td>
          <td style="padding: 10px 12px; color: #cbd5e1; font-weight: 600; font-size: 11px;">
            ${p.memMb ? `${p.memMb} MB` : '--'}
          </td>
          <td style="padding: 10px 12px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #22c55e; font-weight: 600;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e;"></span>
              ${isManaged ? 'Managed' : 'OS Process'}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: right;">
            <button type="button" class="pill-btn count-pill" style="font-size: 11px; padding: 2px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08);" onclick="killDiagProcess(${p.pid})">
              Kill
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 3. Render Incidents & Failures
  function renderIncidents(incidents = []) {
    const list = $('#diagIncidentsList');
    const countSpan = $('#diagIncidentsCountSpan');
    if (countSpan) countSpan.textContent = incidents.length;
    if (!list) return;

    if (incidents.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #94a3b8; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.08);">
          <div style="font-size: 20px; margin-bottom: 4px;">🎉</div>
          <strong style="color: #4ade80; font-size: 13px;">Zero system failures or crashes recorded</strong>
          <p style="margin: 2px 0 0; font-size: 11px;">Background rendering, slicing, and transcription are operating normally.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = incidents.map(inc => {
      let badgeBg = 'rgba(245, 158, 11, 0.15)';
      let badgeBorder = 'rgba(245, 158, 11, 0.3)';
      let badgeColor = '#f59e0b';
      let borderLeft = '#f59e0b';

      if (inc.severity === 'CRITICAL') {
        badgeBg = 'rgba(239, 68, 68, 0.15)';
        badgeBorder = 'rgba(239, 68, 68, 0.3)';
        badgeColor = '#ef4444';
        borderLeft = '#ef4444';
      } else if (inc.severity === 'INFO') {
        badgeBg = 'rgba(59, 130, 246, 0.15)';
        badgeBorder = 'rgba(59, 130, 246, 0.3)';
        badgeColor = '#3b82f6';
        borderLeft = '#3b82f6';
      }

      const timeStr = inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : 'Just now';

      return `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid ${borderLeft}; border-radius: 8px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor};">
                ${inc.severity}
              </span>
              <strong style="font-size: 13px; color: #f8fafc;">${inc.title || 'Error Incident'}</strong>
            </div>
            <small style="color: #94a3b8; font-size: 11px;">${timeStr}</small>
          </div>
          <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px; line-height: 1.4;">
            ${inc.message || ''}
          </div>
          ${inc.details ? `
            <details style="margin-top: 4px; font-size: 11px; color: #94a3b8;">
              <summary style="cursor: pointer; color: #38bdf8;">View Technical Details</summary>
              <pre style="margin-top: 4px; background: #07080c; border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; color: #f87171; white-space: pre-wrap;">${inc.details}</pre>
            </details>
          ` : ''}
          ${inc.suggestion ? `
            <div style="margin-top: 8px; font-size: 11px; color: #a7f3d0; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 6px 10px; display: flex; align-items: flex-start; gap: 6px;">
              <span>💡</span>
              <div><strong>Recommended Fix:</strong> ${inc.suggestion}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // 4. Render Live Server Console Logs
  function renderLogs(logs = []) {
    cachedLogs = logs;
    const box = $('#diagLogsBox');
    if (!box) return;

    let filtered = logs;
    if (activeLogFilter === 'ERROR') {
      filtered = logs.filter(l => l.level === 'ERROR');
    } else if (activeLogFilter === 'WARN') {
      filtered = logs.filter(l => l.level === 'WARN');
    }

    if (filtered.length === 0) {
      box.innerHTML = '<div style="color: #64748b; padding: 12px; text-align: center;">No logs captured matching active filter.</div>';
      return;
    }

    box.innerHTML = filtered.map(l => {
      const time = l.timestamp ? l.timestamp.slice(11, 19) : '--:--:--';
      let lvlColor = '#64748b';
      if (l.level === 'ERROR') lvlColor = '#ef4444';
      else if (l.level === 'WARN') lvlColor = '#f59e0b';
      else if (l.level === 'INFO') lvlColor = '#38bdf8';

      const cleanMsg = (l.message || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return `<div><span style="color: #64748b;">[${time}]</span> <strong style="color: ${lvlColor};">[${l.level}]</strong> <span style="color: #e2e8f0;">${cleanMsg}</span></div>`;
    }).join('');

    if (autoScrollCb && autoScrollCb.checked) {
      box.scrollTop = box.scrollHeight;
    }
  }

  // Main Refresh Function
  let diagnosticsBusy = false;
  window.refreshDiagnostics = async () => {
    if (diagnosticsBusy || document.hidden) return;
    diagnosticsBusy = true;
    try {
      const telemetry = await api('/api/system/diagnostics/telemetry');
      renderTelemetry(telemetry);
      renderProcesses(telemetry.processes || []);

      const incidents = await api('/api/system/diagnostics/incidents');
      renderIncidents(incidents);

      const logs = await api('/api/system/diagnostics/logs?limit=120');
      renderLogs(logs);
    } catch (err) {
      console.warn('Diagnostics refresh error:', err.message);
    } finally {
      diagnosticsBusy = false;
    }
  };

  // Setup Event Listeners
  if (autoRefreshBtn && autoRefreshStatus) {
    autoRefreshBtn.onclick = () => {
      isAutoRefresh = !isAutoRefresh;
      autoRefreshStatus.textContent = isAutoRefresh ? 'ON (3s)' : 'OFF';
      autoRefreshStatus.style.color = isAutoRefresh ? '#22c55e' : '#94a3b8';
    };
  }

  if (manualRefreshBtn) {
    manualRefreshBtn.onclick = () => window.refreshDiagnostics();
  }

  if (cleanTempBtn) {
    cleanTempBtn.onclick = async () => {
      cleanTempBtn.disabled = true;
      cleanTempBtn.textContent = '🧹 Cleaning...';
      try {
        const res = await api('/api/system/diagnostics/cleanup', { method: 'POST' });
        alert(`Cleaned ${res.count || 0} temporary slice/raw files. Memory freed!`);
        window.refreshDiagnostics();
      } catch (err) {
        alert(`Cleanup error: ${err.message}`);
      } finally {
        cleanTempBtn.disabled = false;
        cleanTempBtn.textContent = '🧹 Clear Temp & Free RAM';
      }
    };
  }

  if (emergencyStopBtn) {
    emergencyStopBtn.onclick = async () => {
      if (!confirm('⚠️ EMERGENCY STOP: This will immediately kill all active FFmpeg renders and yt-dlp slice downloads! Are you sure?')) return;
      emergencyStopBtn.disabled = true;
      try {
        const res = await api('/api/system/diagnostics/emergency-stop', { method: 'POST' });
        alert(`Emergency stop triggered. Terminated ${res.count || 0} active processes.`);
        window.refreshDiagnostics();
      } catch (err) {
        alert(`Emergency stop error: ${err.message}`);
      } finally {
        emergencyStopBtn.disabled = false;
      }
    };
  }

  if (clearIncidentsBtn) {
    clearIncidentsBtn.onclick = async () => {
      try {
        await api('/api/system/diagnostics/incidents/clear', { method: 'POST' });
        renderIncidents([]);
      } catch (err) {
        alert(`Failed to clear incidents: ${err.message}`);
      }
    };
  }

  if (copyLogsBtn) {
    copyLogsBtn.onclick = () => {
      const text = cachedLogs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        alert('Logs copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy logs to clipboard.');
      });
    };
  }

  // Log filter pills
  $$('.diag-log-filter').forEach(btn => {
    btn.onclick = () => {
      $$('.diag-log-filter').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(255,255,255,0.1)';
      });
      btn.classList.add('active');
      btn.style.background = '#1e1e2d';
      btn.style.borderColor = 'rgba(255,255,255,0.2)';
      activeLogFilter = btn.dataset.filter || 'ALL';
      renderLogs(cachedLogs);
    };
  });

  // Full diagnostics are useful only on the System screen.
  let lastHeaderPoll = 0;
  setInterval(() => {
    if (document.hidden) return;
    const currentView = state.scheduler?.activeView || 'studio';
    if (currentView === 'processes') {
      if (isAutoRefresh) window.refreshDiagnostics();
    } else if (!diagnosticsBusy && Date.now() - lastHeaderPoll >= 15000) {
      lastHeaderPoll = Date.now(); diagnosticsBusy = true;
      api('/api/system/diagnostics/telemetry').then(t => {
        // Only the visible header needs an update on editing screens.
        const badge = $('#navSysAlertBadge');
        const status = t.health?.status || 'HEALTHY';
        if (badge) badge.style.display = (t.unresolvedCriticalCount > 0 || status === 'CRITICAL_OOM_RISK') ? 'inline-block' : 'none';
        const header = $('#sysStatusBtn');
        if (header) {
          header.textContent = status === 'CRITICAL_OOM_RISK' ? 'System: Critical RAM' : status === 'HIGH_LOAD' ? 'System: High load' : 'System: Ready';
          header.style.color = status === 'CRITICAL_OOM_RISK' ? '#ef4444' : status === 'HIGH_LOAD' ? '#f59e0b' : '#22c55e';
        }
      }).catch(() => {}).finally(() => { diagnosticsBusy = false; });
    }
  }, 3000);

  // The diagnostics screen refreshes when opened; boot already supplies header status.
  if (state.scheduler?.activeView === 'processes') window.refreshDiagnostics();
}

// ------------------------------------------------------------------
// YouTube & Google Drive Connection Help UI
// ------------------------------------------------------------------
function setupConnectionHelpUI() {
  const modal = $('#connectionHelpModal');
  const openTopbarBtn = $('#topbarHelpBtn');
  const openAccBtn = $('#openConnectionHelpBtn');
  const closeBtn = $('#closeConnectionHelpModalBtn');
  const doneBtn = $('#doneConnectionHelpModalBtn');

  window.showConnectionHelpModal = () => modal?.classList.remove('hidden');

  if (openTopbarBtn) openTopbarBtn.onclick = () => window.showConnectionHelpModal();
  if (openAccBtn) openAccBtn.onclick = () => window.showConnectionHelpModal();
  if (closeBtn) closeBtn.onclick = () => modal?.classList.add('hidden');
  if (doneBtn) doneBtn.onclick = () => modal?.classList.add('hidden');
}

// ------------------------------------------------------------------
// AUTOCLIPIN Creator Pass & Pro Licensing UI
// ------------------------------------------------------------------
function setupLicensingUI() {
  const statusBtn = $('#licenseStatusBtn');
  const modal = $('#licenseModal');
  const closeBtn = $('#closeLicenseModalBtn');
  const doneBtn = $('#doneLicenseModalBtn');
  const activateBtn = $('#activateKeyBtn');
  const keyInput = $('#licenseKeyInput');

  if (statusBtn) statusBtn.onclick = () => openLicenseModal();
  if (closeBtn) closeBtn.onclick = () => modal?.classList.add('hidden');
  if (doneBtn) doneBtn.onclick = () => modal?.classList.add('hidden');

  if (activateBtn && keyInput) {
    activateBtn.onclick = async () => {
      const key = keyInput.value.trim();
      const fb = $('#licenseKeyFeedback');
      if (!key) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = '#ff5555';
          fb.textContent = 'Please enter a license key.';
        }
        return;
      }

      activateBtn.disabled = true;
      activateBtn.textContent = 'Verifying...';

      try {
        const res = await api('/api/license/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });

        if (res.success) {
          state.license = res.license;
          renderLicenseStatus();
          if (fb) {
            fb.style.display = 'block';
            fb.style.color = '#00f0ff';
            fb.textContent = res.message || 'AUTOCLIPIN Max Activated Successfully!';
          }
          keyInput.value = '';
        } else {
          if (fb) {
            fb.style.display = 'block';
            fb.style.color = '#ff5555';
            fb.textContent = res.error || 'Activation failed.';
          }
        }
      } catch (err) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = '#ff5555';
          fb.textContent = err.message || 'Invalid license key.';
        }
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Unlock Max';
      }
    };
  }

  renderLicenseStatus();
}

function openLicenseModal(alertMsg = null) {
  const modal = $('#licenseModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderLicenseStatus();

  const fb = $('#licenseKeyFeedback');
  if (alertMsg && fb) {
    fb.style.display = 'block';
    fb.style.color = '#ffaa00';
    fb.textContent = alertMsg;
  }
}

function renderLicenseStatus() {
  const lic = state.license || {};
  const statusBtn = $('#licenseStatusBtn');
  const pillIcon = $('#licensePillIcon');
  const pillText = $('#licensePillText');

  const tierBadge = $('#licenseTierBadge');
  const holderTitle = $('#licenseHolderTitle');
  const subtitle = $('#licenseSubtitle');
  const daysLeft = $('#licenseDaysLeft');
  const quotaText = $('#weeklyQuotaText');
  const quotaBar = $('#weeklyQuotaBar');
  const resetText = $('#weeklyResetText');

  if (lic.isMax || lic.isUnlimited || lic.tier === 'unlimited_free') {
    if (statusBtn) {
      statusBtn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
      statusBtn.style.background = 'rgba(34, 197, 94, 0.15)';
      statusBtn.style.color = '#4ade80';
    }
    if (pillIcon) pillIcon.textContent = '👑';
    if (pillText) pillText.textContent = '100% Free & Unlimited';

    if (tierBadge) {
      tierBadge.textContent = '👑 100% Free Creator Edition (Unlimited)';
      tierBadge.style.background = 'rgba(34, 197, 94, 0.2)';
      tierBadge.style.color = '#4ade80';
      tierBadge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    }
    if (holderTitle) holderTitle.textContent = `${lic.holder || 'Creator'} (${lic.tierName || 'Pro Unlocked'})`;
    if (subtitle) subtitle.textContent = lic.isUnlimited ? 'Unlimited 4K vertical exports active' : '1,200 Monthly clip quota active';
    if (daysLeft) {
      daysLeft.textContent = lic.isLifetime ? '∞' : Math.max(0, Math.ceil(((lic.keyExpiresAt || 0) - Date.now()) / (24 * 60 * 60 * 1000)));
      daysLeft.style.color = '#ffdd00';
    }
    if (quotaText) {
      quotaText.textContent = lic.isUnlimited 
        ? `${lic.clipsExportedThisMonth || lic.clipsExportedThisWeek || 0} clips (Unlimited)`
        : `${lic.clipsExportedThisMonth || 0} / 1,200 clips used this month`;
    }
    if (quotaBar) {
      quotaBar.style.width = lic.isUnlimited ? '100%' : Math.min(100, Math.round(((lic.clipsExportedThisMonth || 0) / 1200) * 100)) + '%';
    }
    if (resetText) resetText.textContent = lic.isUnlimited ? 'No caps on exports' : 'Resets every 30 days';
  } else if (lic.isExpired) {
    if (statusBtn) {
      statusBtn.style.borderColor = 'rgba(255, 68, 68, 0.6)';
      statusBtn.style.background = 'rgba(255, 68, 68, 0.15)';
      statusBtn.style.color = '#ff5555';
    }
    if (pillIcon) pillIcon.textContent = '🔒';
    if (pillText) pillText.textContent = 'Pass Expired';

    if (tierBadge) {
      tierBadge.textContent = '🔒 Free Pass Expired';
      tierBadge.style.background = 'rgba(255, 68, 68, 0.2)';
      tierBadge.style.color = '#ff5555';
      tierBadge.style.borderColor = 'rgba(255, 68, 68, 0.4)';
    }
    if (daysLeft) {
      daysLeft.textContent = '0';
      daysLeft.style.color = '#ff5555';
    }
    if (subtitle) subtitle.textContent = 'Your 30-day Free Pass has ended. Enter a VIP key or upgrade.';
  } else {
    // Active 30-day Free Trial
    const used = lic.clipsExportedThisWeek || 0;
    const limit = lic.weeklyLimit || 100;
    const pct = Math.min(100, Math.round((used / limit) * 100));

    if (statusBtn) {
      statusBtn.style.borderColor = 'rgba(0, 240, 255, 0.4)';
      statusBtn.style.background = 'rgba(0, 240, 255, 0.12)';
      statusBtn.style.color = '#00f0ff';
    }
    if (pillIcon) pillIcon.textContent = '⚡';
    if (pillText) pillText.textContent = `${used}/${limit} Clips (${lic.trialDaysRemaining || 30}d)`;

    if (tierBadge) {
      tierBadge.textContent = '⚡ Free 30-Day Pass';
      tierBadge.style.background = 'rgba(0, 240, 255, 0.15)';
      tierBadge.style.color = '#00f0ff';
      tierBadge.style.borderColor = 'rgba(0, 240, 255, 0.3)';
    }
    if (holderTitle) holderTitle.textContent = `${lic.holder || 'Creator'} Pass`;
    if (subtitle) subtitle.textContent = '100 free clips every week for your first month';
    if (daysLeft) {
      daysLeft.textContent = String(lic.trialDaysRemaining ?? 30);
      daysLeft.style.color = '#00f0ff';
    }
    if (quotaText) quotaText.textContent = `${used} / ${limit} clips used`;
    if (quotaBar) quotaBar.style.width = `${pct}%`;
    if (resetText) resetText.textContent = `Resets in ${lic.daysUntilWeeklyReset || 7} day(s)`;
  }
}


// ------------------------------------------------------------------
// AUTOCLIPIN Universal AI & MCP Integration Hub UI
// ------------------------------------------------------------------
function setupAiMcpUI() {
  const topbarBtn = $('#topbarAiMcpBtn');
  const modal = $('#aiMcpModal');
  const closeBtn = $('#closeAiMcpModalBtn');
  const doneBtn = $('#doneAiMcpModalBtn');
  const saveBtn = $('#saveAiKeysBtn');
  const providerSelect = $('#activeAiProviderSelect');
  const claudeKeyInput = $('#anthropicApiKeyInput');
  const openaiKeyInput = $('#openaiApiKeyInput');
  const geminiKeyInput = $('#geminiApiKeyInput');
  const feedback = $('#aiKeyFeedback');
  const copyClaudeConfigBtn = $('#copyClaudeConfigBtn');
  const copyChatGptMcpBtn = $('#copyChatGptMcpBtn');

  if (topbarBtn) {
    topbarBtn.onclick = async () => {
      if (modal) modal.classList.remove('hidden');
      await loadAiSettings();
    };
  }

  if (closeBtn) closeBtn.onclick = () => modal?.classList.add('hidden');
  if (doneBtn) doneBtn.onclick = () => modal?.classList.add('hidden');

  async function loadAiSettings() {
    try {
      const settings = await api('/api/settings');
      if (providerSelect && settings.activeAiProvider) {
        providerSelect.value = settings.activeAiProvider;
      }
      if (claudeKeyInput && settings.anthropicApiKey) {
        claudeKeyInput.value = settings.anthropicApiKey;
      }
      if (openaiKeyInput && settings.openaiApiKey) {
        openaiKeyInput.value = settings.openaiApiKey;
      }
      if (geminiKeyInput && settings.geminiApiKey) {
        geminiKeyInput.value = settings.geminiApiKey;
      }
      updateAiBadge(settings.activeAiProvider || 'offline');
    } catch (e) {
      console.warn('Failed to load AI settings:', e);
    }
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving & Verifying...';
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#00f0ff';
        feedback.textContent = 'Connecting...';
      }

      try {
        const payload = {
          activeAiProvider: providerSelect?.value || 'offline',
          anthropicApiKey: claudeKeyInput?.value.trim() || '',
          openaiApiKey: openaiKeyInput?.value.trim() || '',
          geminiApiKey: geminiKeyInput?.value.trim() || ''
        };

        await api('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Test active provider if key provided
        let testMsg = 'Saved!';
        const prov = payload.activeAiProvider;
        const key = prov === 'claude' ? payload.anthropicApiKey : prov === 'openai' ? payload.openaiApiKey : prov === 'gemini' ? payload.geminiApiKey : null;

        if (key && prov !== 'offline') {
          const testRes = await api('/api/ai/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: prov, apiKey: key })
          });
          testMsg = testRes.success ? ('✓ ' + prov.toUpperCase() + ' Connected Successfully!') : ('Warning: ' + (testRes.error || 'Connection failed'));
        } else if (prov === 'offline') {
          testMsg = '✓ Offline Engine v3 Active (100% Local Processing).';
        }

        updateAiBadge(prov);

        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.color = '#3ef07a';
          feedback.textContent = testMsg;
        }
      } catch (err) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.color = '#ff5555';
          feedback.textContent = err.message || 'Error saving settings.';
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save & Test Connection';
      }
    };
  }

  if (copyClaudeConfigBtn) {
    copyClaudeConfigBtn.onclick = () => {
      const snippet = JSON.stringify({
        mcpServers: {
          autoclip: {
            command: "node",
            args: ["C:\\Users\\intel\\Documents\\Codex\\2026-11-02\\im-x20\\scripts\\mcp-server.js"]
          }
        }
      }, null, 2);
      navigator.clipboard.writeText(snippet).then(() => {
        copyClaudeConfigBtn.textContent = '✓ Copied Config!';
        setTimeout(() => { copyClaudeConfigBtn.textContent = '📋 Copy Claude Config'; }, 2000);
      });
    };
  }

  if (copyChatGptMcpBtn) {
    copyChatGptMcpBtn.onclick = () => {
      const endpoint = window.location.origin + '/api/mcp';
      navigator.clipboard.writeText(endpoint).then(() => {
        copyChatGptMcpBtn.textContent = '✓ Copied URL!';
        setTimeout(() => { copyChatGptMcpBtn.textContent = '📋 Copy Endpoint URL'; }, 2000);
      });
    };
  }

  function updateAiBadge(provider) {
    const btn = $('#topbarAiMcpBtn');
    if (!btn) return;
    if (provider === 'claude') {
      btn.innerHTML = '🧠 Claude Active';
      btn.style.color = '#f97316';
    } else if (provider === 'openai') {
      btn.innerHTML = '🟢 OpenAI Active';
      btn.style.color = '#10b981';
    } else if (provider === 'gemini') {
      btn.innerHTML = '✨ Gemini Active';
      btn.style.color = '#38bdf8';
    } else {
      btn.innerHTML = '⚡ Offline v3';
      btn.style.color = '#c084fc';
    }
  }

  // Initial load
  loadAiSettings();
}


// ------------------------------------------------------------------
// MAX AUTOMATE: One-Click YouTube Channel Scraper & Multi-Video Clipper
// ------------------------------------------------------------------
function setupMaxAutomateUI() {
  const topbarBtn = $('#topbarMaxBtn');
  const railBtn = $('#railMaxAutomateBtn');
  const maxTab = $('#maxTabBtn');
  const maxPane = $('#maxPane');
  const channelInput = $('#maxChannelUrl');
  const inspectBtn = $('#maxInspectBtn');
  const boomBtn = $('#maxBoomBtn');
  const videoCountInput = $('#maxVideoCount');
  const clipsPerVideoSelect = $('#maxClipsPerVideo');
  const qualitySelect = $('#maxQuality');
  const statusMsg = $('#maxStatusMsg');
  const batchContainer = $('#maxBatchContainer');
  const channelTitleText = $('#maxChannelTitleText');
  const batchMetaText = $('#maxBatchMetaText');
  const batchCountBadge = $('#maxBatchCountBadge');
  const videoGrid = $('#maxVideoGrid');

  function showStatus(text, color = '#ffaa00') {
    if (!statusMsg) return;
    statusMsg.style.display = 'block';
    statusMsg.style.color = color;
    statusMsg.textContent = text;
  }

  function hideStatus() {
    if (statusMsg) statusMsg.style.display = 'none';
  }

  // Open & Focus MAX Automate
  function openMaxAutomate() {
    window.switchAppView('max');
  }

  if (topbarBtn) topbarBtn.onclick = openMaxAutomate;
  if (railBtn) railBtn.onclick = openMaxAutomate;
  if (maxTab) maxTab.onclick = openMaxAutomate;

  // Channel input: Enter key triggers Inspection or BOOM
  if (channelInput) {
    channelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        inspectChannel();
      }
    });
  }

  // Sample Channel Quick Buttons
  $$('.max-sample-btn').forEach(btn => {
    btn.onclick = () => {
      const ch = btn.dataset.channel;
      if (channelInput) {
        channelInput.value = ch;
        inspectChannel(ch);
      }
    };
  });

  // Count Pills
  $$('.max-count-pill').forEach(pill => {
    pill.onclick = () => {
      const val = Number(pill.dataset.val) || 5;
      if (videoCountInput) videoCountInput.value = val;
      $$('.max-count-pill').forEach(p => p.classList.toggle('active', p === pill));
    };
  });

  // Inspect Channel function
  async function inspectChannel(targetUrl = null) {
    const raw = targetUrl || channelInput?.value.trim();
    if (!raw) {
      showStatus('⚠️ Please enter a YouTube Channel URL or @handle.', '#ff5555');
      channelInput?.focus();
      return;
    }

    showStatus('⏳ Resolving channel and fetching recent videos...', '#ffaa00');

    if (inspectBtn) {
      inspectBtn.disabled = true;
      inspectBtn.textContent = '⏳ Inspecting...';
    }

    try {
      const count = Number(videoCountInput?.value) || 5;
      const res = await api('/api/automate/channel-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: raw, count })
      });

      if (res.channelTitle && channelTitleText) {
        channelTitleText.textContent = res.channelTitle;
      }
      if (batchMetaText) {
        batchMetaText.textContent = 'Found ' + (res.videos?.length || 0) + ' latest videos from ' + res.channelTitle + '. Ready for BOOM clipping!';
      }
      if (batchCountBadge) {
        batchCountBadge.textContent = (res.videos?.length || 0) + ' Videos Selected';
      }

      renderPreviewCards(res.videos || []);
      if (batchContainer) batchContainer.classList.remove('hidden');
      showStatus('✓ Channel found: ' + res.channelTitle + ' (' + (res.videos?.length || 0) + ' videos ready). Hit BOOM to start clipping!', '#10b981');
    } catch (err) {
      showStatus('❌ Failed to inspect channel: ' + err.message, '#ff5555');
    } finally {
      if (inspectBtn) {
        inspectBtn.disabled = false;
        inspectBtn.textContent = '🔍 Inspect Channel';
      }
    }
  }

  if (inspectBtn) {
    inspectBtn.onclick = () => inspectChannel();
  }

  // Render video preview cards
  function renderPreviewCards(videos) {
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    videos.forEach((v, idx) => {
      const card = document.createElement('div');
      card.id = 'max-card-' + v.id;
      card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s;';

      const thumbUrl = v.thumbnail || ('https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg');
      card.innerHTML = `
        <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; overflow: hidden;">
          <img src="${thumbUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
          <span style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.85); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${v.durationStr || 'Video'}</span>
          <span style="position: absolute; top: 6px; left: 6px; background: rgba(255, 140, 0, 0.9); color: #000; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">#${idx + 1}</span>
        </div>
        <div style="padding: 10px; display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
          <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${v.title}</h5>
          
          <div class="max-status-wrap" style="margin-top: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span class="max-card-status-text" style="font-size: 11px; color: #94a3b8; font-weight: 600;">Ready to Clip</span>
              <span class="max-card-pct" style="font-size: 10px; color: #ffaa00; font-weight: 800;">Pending</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
              <div class="max-card-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff8800, #d8ff3e); transition: width 0.3s;"></div>
            </div>
            <div class="max-card-action" style="margin-top: 8px; display: none;"></div>
          </div>
        </div>
      `;
      videoGrid.appendChild(card);
    });
  }

  // THE BOOM BUTTON: Launch Autonomous Batch Clipping
  if (boomBtn) {
    boomBtn.onclick = async () => {
      const channelUrl = channelInput?.value.trim();
      if (!channelUrl) {
        showStatus('⚠️ Please paste a YouTube Channel URL or @handle first.', '#ff5555');
        channelInput?.focus();
        return;
      }

      const count = Number(videoCountInput?.value) || 5;
      const clipsPerVideo = Number(clipsPerVideoSelect?.value) || 5;
      const streamQuality = qualitySelect?.value || 'turbo';

      boomBtn.disabled = true;
      boomBtn.innerHTML = '💥 BOOMING... SCRAPING &amp; QUEUING VIDEOS...';
      boomBtn.style.opacity = '0.7';
      showStatus('💥 BOOM INITIATED: Scraper fetching ' + count + ' videos from ' + channelUrl + '...', '#ffaa00');

      try {
        const res = await api('/api/automate/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelUrl,
            count,
            clipsPerVideo,
            options: {
              streamQuality,
              ratingSystem: $('#maxRatingSystem')?.value || 'hollywood',
              minDuration: 20,
              clipCount: clipsPerVideo
            }
          })
        });

        if (!res.success || !res.jobs || !res.jobs.length) {
          throw new Error(res.error || 'No videos were queued.');
        }

        if (channelTitleText) channelTitleText.textContent = res.channelTitle;
        if (batchMetaText) batchMetaText.textContent = '💥 ' + res.queuedCount + ' videos actively processing! Slicing ' + clipsPerVideo + ' viral clips from each.';
        if (batchContainer) batchContainer.classList.remove('hidden');

        // Add jobs to state
        res.jobs.forEach(j => {
          state.jobs.unshift(j);
        });
        renderJobs();

        // Render card board for these jobs
        renderActiveJobCards(res.jobs);

        // Start real-time polling for all batch jobs
        res.jobs.forEach(j => {
          pollBatchJob(j.id);
        });

        boomBtn.innerHTML = '⚡ BOOM ACTIVE! ' + res.queuedCount + ' VIDEOS CLIPPING IN BACKGROUND';
        boomBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        showStatus('⚡ BOOM ACTIVE: ' + res.queuedCount + ' videos from ' + res.channelTitle + ' are now auto-clipping in the background!', '#10b981');
      } catch (err) {
        showStatus('❌ BOOM launch failed: ' + err.message, '#ff5555');
        boomBtn.disabled = false;
        boomBtn.innerHTML = '💥 BOOM! AUTOMATE CLIPPING NOW';
        boomBtn.style.opacity = '1';
        boomBtn.style.background = 'linear-gradient(135deg, #ff8800, #ff2200)';
      }
    };
  }

  function renderActiveJobCards(jobs) {
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    jobs.forEach((j, idx) => {
      const card = document.createElement('div');
      card.id = 'max-card-' + j.id;
      card.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255, 140, 0, 0.3); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: all 0.2s;';

      const thumbUrl = j.thumbnail || ('https://i.ytimg.com/vi/' + (j.sourceUrl?.split('v=')?.[1] || '') + '/hqdefault.jpg');
      card.innerHTML = `
        <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; overflow: hidden;">
          <img src="${thumbUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
          <span style="position: absolute; top: 6px; left: 6px; background: rgba(255, 140, 0, 0.9); color: #000; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">#${idx + 1}</span>
          <span class="max-badge-status" id="badge-${j.id}" style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: #ffaa00; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(255,170,0,0.4);">⚡ Downloading</span>
        </div>
        <div style="padding: 12px; display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
          <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${j.sourceName || 'Processing video...'}</h5>
          
          <div style="margin-top: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span id="msg-${j.id}" style="font-size: 11px; color: #cbd5e1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">Starting...</span>
              <span id="pct-${j.id}" style="font-size: 11px; color: #ffaa00; font-weight: 800;">0%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
              <div id="bar-${j.id}" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff8800, #d8ff3e); border-radius: 3px; transition: width 0.3s;"></div>
            </div>
            <div id="act-${j.id}" style="margin-top: 10px; display: flex; gap: 6px;"></div>
          </div>
        </div>
      `;
      videoGrid.appendChild(card);
    });
  }

  function pollBatchJob(jobId) {
    const interval = setInterval(async () => {
      try {
        const j = await api('/api/jobs/' + jobId);
        const idx = state.jobs.findIndex(x => x.id === jobId);
        if (idx >= 0) state.jobs[idx] = j;

        const bar = $('#bar-' + jobId);
        const pctText = $('#pct-' + jobId);
        const msgText = $('#msg-' + jobId);
        const badge = $('#badge-' + jobId);
        const actDiv = $('#act-' + jobId);

        if (j.progress) {
          const p = j.progress.percent || 0;
          if (bar) bar.style.width = p + '%';
          if (pctText) pctText.textContent = p + '%';
          if (msgText) msgText.textContent = j.progress.message || j.status;
        }

        if (badge) {
          if (j.status === 'downloading') {
            badge.textContent = '⚡ Downloading';
            badge.style.color = '#ffaa00';
          } else if (j.status === 'transcribing') {
            badge.textContent = '🎙️ Whisper AI';
            badge.style.color = '#00f0ff';
          } else if (j.status === 'analyzing') {
            badge.textContent = '✨ Finding Hooks';
            badge.style.color = '#c084fc';
          }
        }

        if (j.status === 'ready' || j.status === 'complete') {
          clearInterval(interval);
          if (bar) {
            bar.style.width = '100%';
            bar.style.background = '#10b981';
          }
          if (pctText) {
            pctText.textContent = '100%';
            pctText.style.color = '#10b981';
          }
          if (msgText) msgText.textContent = '✅ ' + (j.clips?.length || 0) + ' viral clips ready!';
          if (badge) {
            badge.textContent = '✓ ' + (j.clips?.length || 0) + ' Clips Ready';
            badge.style.color = '#10b981';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          }
          if (actDiv && !actDiv.hasChildNodes()) {
            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'pill-btn lava-glow-btn';
            openBtn.style.cssText = 'flex: 1; padding: 6px 10px; font-size: 11px; font-weight: 800; cursor: pointer;';
            openBtn.textContent = '🎬 Open Studio';
            openBtn.onclick = () => {
              showJob(j, true);
              window.switchAppView('studio');
            };

            const cinemaBtn = document.createElement('button');
            cinemaBtn.type = 'button';
            cinemaBtn.className = 'pill-btn';
            cinemaBtn.style.cssText = 'padding: 6px 10px; font-size: 11px; background: rgba(255,255,255,0.08);';
            cinemaBtn.textContent = '📺 Cinema';
            cinemaBtn.onclick = () => {
              state.currentJob = j;
              window.switchAppView('watch');
              if (typeof loadStreamIntoCinema === 'function') {
                loadStreamIntoCinema(j);
              }
            };

            actDiv.appendChild(openBtn);
            actDiv.appendChild(cinemaBtn);
          }
          renderJobs();
        } else if (j.status === 'failed' || j.status === 'cancelled') {
          clearInterval(interval);
          if (badge) {
            badge.textContent = '❌ Failed';
            badge.style.color = '#ff5555';
          }
          if (msgText) msgText.textContent = j.error || 'Failed';
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 2000);
  }
}




// ==========================================================================

// 🦁 BEAST & AUDIO ENGINEERING UI EVENT HANDLERS

// ==========================================================================

(function initBeastAudioControls() {

  const musicSlider = document.getElementById('beastMusicVolSlider');

  const musicLabel = document.getElementById('beastMusicVolLabel');

  if (musicSlider && musicLabel) {

    musicSlider.addEventListener('input', (e) => {

      const pct = Math.round(Number(e.target.value) * 100);

      musicLabel.textContent = `-${Math.round((1 - Number(e.target.value)) * 24)} dB (${pct}%)`;

    });

  }



  const applyBeastBtn = document.getElementById('applyBeastPresetBtn');

  if (applyBeastBtn) {

    applyBeastBtn.addEventListener('click', () => {

      // 1. Select Lemon Milk Bold / Hormozi Phrase

      const capFont = document.getElementById('editCapFont');

      if (capFont) capFont.value = 'Oxanium';

      const capDisplay = document.getElementById('editCapDisplayMode');

      if (capDisplay) capDisplay.value = 'phrase';



      // 2. Select Gaming Split or Smart Face Lock

      const framingSelect = document.getElementById('framingPresetSelect');

      if (framingSelect) framingSelect.value = 'gaming_split';



      // 3. Select Beast Phonk music bed

      const musicSelect = document.getElementById('beastMusicSelect');

      if (musicSelect) musicSelect.value = 'beast_phonk_pulse.mp3';



      // 4. Ensure toggles are active

      if (document.getElementById('beastSeamlessLoopToggle')) document.getElementById('beastSeamlessLoopToggle').checked = true;

      if (document.getElementById('beastMoodTintToggle')) document.getElementById('beastMoodTintToggle').checked = true;

      if (document.getElementById('beastDynamicZoomToggle')) document.getElementById('beastDynamicZoomToggle').checked = true;



      alert('🦁 CRAZY BEAST Preset Applied!\n• Music: Beast Phonk Pulse (-20dB ducked)\n• Retention: Daniel Bitton 200% Rewatch Loop\n• Framing: Gaming Split / Smart Face Lock\n• Captions: Lemon Milk Active Word Glow\n• Mood: Threat Red Emotion Grading');

    });

  }

})();



// ==========================================================================

// 🤖 AUTOCLIPIN IN-APP AI COPILOT & INTERACTIVE WALKTHROUGH ENGINE

// ==========================================================================

(function setupAppAssistant() {

  const modal = document.getElementById('appAssistantModal');

  const openBtn = document.getElementById('floatingAiBotBtn');

  const closeBtn = document.getElementById('closeAssistantModalBtn');

  const feed = document.getElementById('assistantChatFeed');

  const input = document.getElementById('assistantInput');

  const sendBtn = document.getElementById('assistantSendBtn');

  const sysDiagBtn = document.getElementById('assistantSysDiagBtn');

  const sysHeaderBtn = document.getElementById('sysStatusBtn');

  const topHelpBtn = document.getElementById('topbarHelpBtn');



  if (!modal) return;



  function formatMarkdown(md) {

    if (!md) return '';

    return md

      .replace(/### (.*?)\n/g, '<h4 style="margin: 8px 0 4px; color: #fff; font-size: 14px;">$1</h4>')

      .replace(/#### (.*?)\n/g, '<h5 style="margin: 6px 0 2px; color: #ffaa00; font-size: 13px;">$1</h5>')

      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

      .replace(/\*(.*?)\*/g, '<em>$1</em>')

      .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #d8ff3e;">$1</code>')

      .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; overflow-x: auto; font-family: monospace; font-size: 12px; color: #38bdf8;">$2</pre>')

      .replace(/\n/g, '<br>');

  }



  function appendMessage(sender, htmlContent, actionBtn = null) {

    if (!feed) return;

    const bubble = document.createElement('div');

    bubble.className = `chat-bubble ${sender}`;

    bubble.innerHTML = htmlContent;



    if (actionBtn && actionBtn.action) {

      const btn = document.createElement('button');

      btn.className = 'pill-btn lava-glow-btn';

      btn.style.marginTop = '10px';

      btn.style.fontSize = '12px';

      btn.style.padding = '6px 12px';

      btn.textContent = actionBtn.text || 'Action';

      btn.onclick = () => {

        if (actionBtn.action === 'open_processes') {

          modal.classList.add('hidden');

          if (typeof window.switchAppView === 'function') window.switchAppView('processes');

        }

      };

      bubble.appendChild(document.createElement('br'));

      bubble.appendChild(btn);

    }



    feed.appendChild(bubble);

    feed.scrollTop = feed.scrollHeight;

  }



  async function sendQuery(queryText) {

    const text = String(queryText || '').trim();

    if (!text) return;



    appendMessage('user', text);

    if (input) input.value = '';



    const typingId = 'typing_' + Date.now();

    const typingBubble = document.createElement('div');

    typingBubble.className = 'chat-bubble bot';

    typingBubble.id = typingId;

    typingBubble.innerHTML = '<em>Thinking &amp; searching AUTOCLIPIN knowledge base...</em>';

    feed.appendChild(typingBubble);

    feed.scrollTop = feed.scrollHeight;



    try {

      const res = await fetch('/api/assistant/chat', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ message: text })

      });

      const data = await res.json();

      const el = document.getElementById(typingId);

      if (el) el.remove();



      appendMessage('bot', formatMarkdown(data.text), data.actionButton);

    } catch (err) {

      const el = document.getElementById(typingId);

      if (el) el.remove();

      appendMessage('bot', `<span style="color:#ff5555;">⚠️ Error connecting to assistant: ${err.message}</span>`);

    }

  }



  function openAssistant(initialTopic = null) {

    modal.classList.remove('hidden');

    if (feed && feed.children.length === 0) {

      appendMessage('bot', `

        <h4 style="margin: 0 0 6px 0; color: #fff; font-size: 15px;">👋 Hi! I'm your AUTOCLIPIN AI Copilot.</h4>

        <p style="margin: 0; font-size: 12.5px; color: #cbd5e1; line-height: 1.5;">

          I'm here to answer any questions about the app and walk you step-by-step through:

        </p>

        <ul style="margin: 8px 0 8px 18px; padding: 0; font-size: 12px; color: #94a3b8;">

          <li><b>YouTube Data API v3</b> &amp; 1-click publishing setup</li>

          <li><b>Google Drive API</b> auto-upload &amp; cloud backups</li>

          <li><b>MCP Protocol Server</b> (Claude Desktop &amp; Cursor integration)</li>

          <li><b>CRAZY BEAST Engine v2.0</b> (Brock Johnson 1,300 hooks &amp; 2.3x CTR)</li>

          <li><b>Daniel Bitton 31s Golden Zone</b> &amp; 200% rewatch retention loop</li>

        </ul>

        <p style="margin: 0; font-size: 12px; color: #a855f7;">Click any topic pill above or ask your question below!</p>

      `);

    }



    if (initialTopic) {

      sendQuery(initialTopic);

    }

  }



  if (openBtn) openBtn.onclick = () => openAssistant();

  if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

  if (topHelpBtn) topHelpBtn.onclick = () => openAssistant('How to link YouTube and Google Drive');



  // When clicking sysStatusBtn, open Assistant with Live Diagnostics

  if (sysHeaderBtn) {

    sysHeaderBtn.onclick = (e) => {

      e.preventDefault();

      openAssistant('Show system status and hardware diagnostics');

    };

  }



  if (sysDiagBtn) {

    sysDiagBtn.onclick = () => {

      modal.classList.add('hidden');

      if (typeof window.switchAppView === 'function') window.switchAppView('processes');

    };

  }



  if (sendBtn && input) {

    sendBtn.onclick = () => sendQuery(input.value);

    input.addEventListener('keydown', (e) => {

      if (e.key === 'Enter') {

        e.preventDefault();

        sendQuery(input.value);

      }

    });

  }



  // Quick Topic Chips

  document.querySelectorAll('.assistant-chip').forEach(chip => {

    chip.onclick = () => {

      const topicId = chip.dataset.topic;

      const topicNames = {

        youtube_api: 'How do I create and connect YouTube API?',

        google_drive: 'How do I connect Google Drive API?',

        mcp_protocol: 'How do I connect Claude Desktop or Cursor via MCP?',

        beast_engine: 'Tell me how the CRAZY BEAST Engine v2.0 and Brock hooks work',

        daniel_bitton_loop: 'How does Daniel Bitton $1M/month 31 second rewatch loop work?',

        hollywood_rating: 'How does the Hollywood Rating System work?',

        max_batch_clipper: 'How do I use MAX Autonomous Batch Auto-Clipper?',

        troubleshooting: 'Troubleshooting: how do I fix common video and download errors?'

      };

      sendQuery(topicNames[topicId] || chip.textContent);

    };

  });

})();

