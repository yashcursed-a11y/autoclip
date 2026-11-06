/* Upgraded In-App AI Studio Companion & Guide (Pixel - Cute, Interactive & Human-like Edition)
 * Features:
 * - Conversational, warm video-editing partner personality with humor and encouragement
 * - Interactive checkable step-by-step walkthroughs with celebration chimes
 * - Cute Web Audio API chimes (boop, pop, fanfare) with mute toggle
 * - Live connection test buttons for YouTube, Google Drive, and Studio Rig diagnostics
 * - Interactive "High Five! / Pet Pixel" reactions with bouncy expressions
 * - Smooth typewriter streaming effect with instant-reveal skip
 * - Preserves all live studio activity, telemetry, and background job logs
 */
(() => {
  const host = document.createElement('aside');
  host.className = 'studio-companion';
  host.dataset.mood = 'idle';

  let soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem('autoclip.companion_sound') !== 'false';
  } catch(e) {}

  // Synthesize cute soothing web-audio chimes (100% offline, zero external files)
  const playCuteSound = (type = 'boop') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      if (type === 'boop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'fanfare') {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.08);
          g.gain.setValueAtTime(0.09, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.18);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(now + i * 0.08);
          o.stop(now + i * 0.08 + 0.18);
        });
      }
    } catch(e) {}
  };

  host.innerHTML = `
<section class="companion-panel" id="companionActivity" hidden aria-label="Pixel Assistant and Activity">
  <header class="companion-header">
    <div class="companion-identity">
      <div class="companion-avatar-badge" title="Click to pet Pixel!">🤖</div>
      <div class="companion-name-wrap">
        <strong>Pixel</strong>
        <small>Studio robot · AI companion & guide</small>
      </div>
    </div>
    <div class="companion-tabs" role="tablist">
      <button type="button" class="companion-tab active" data-tab="guide" role="tab" aria-selected="true" title="Guides and AI Help">🤖 Guides</button>
      <button type="button" class="companion-tab" data-tab="activity" role="tab" aria-selected="false" title="Live Studio Activity">📋 Activity <span class="companion-activity-badge" hidden>0</span></button>
    </div>
    <div class="companion-header-actions">
      <button type="button" class="companion-pet-btn" title="Give Pixel a high five! ✨">✋ High Five</button>
      <button type="button" class="companion-sound-btn" aria-label="Toggle sounds" title="Toggle cute sound effects">${soundEnabled ? '🔊' : '🔇'}</button>
      <button type="button" class="companion-close" aria-label="Close assistant">×</button>
    </div>
  </header>

  <!-- TAB 1: INTERACTIVE AI GUIDE & COPILOT -->
  <div class="companion-tab-content companion-guide-view" id="companionGuideView">
    <div class="companion-chips-bar" aria-label="Quick guides">
      <button type="button" class="companion-chip" data-query="How to create and connect YouTube API?">📺 YouTube API</button>
      <button type="button" class="companion-chip" data-query="How to connect Google Drive API backup?">📁 Drive API</button>
      <button type="button" class="companion-chip" data-query="How to setup MCP Server for Claude Desktop?">🧠 MCP Setup</button>
      <button type="button" class="companion-chip" data-query="Explain CRAZY BEAST Engine v2.0 and Brock Johnson hooks">🦁 Beast Engine</button>
      <button type="button" class="companion-chip" data-query="What is Daniel Bitton 31s golden sweet spot and 200% loop?">🔄 31s Loop</button>
      <button type="button" class="companion-chip" data-query="Tell me a joke">😂 Tell a Joke</button>
      <button type="button" class="companion-chip" data-query="Check my PC rig diagnostics">⚡ Check Rig</button>
    </div>

    <div class="companion-chat-feed" role="log" aria-live="polite">
      <div class="companion-chat-msg companion-msg-bot">
        <div class="companion-msg-avatar">🤖</div>
        <div class="companion-msg-body">
          <p>Beep-boop! Hey there, creator! ✨ I'm <strong>Pixel</strong>, your in-app AI studio companion.</p>
          <p>I'm here to help you turn long videos into viral 9:16 Shorts, set up <strong>YouTube & Google Drive APIs</strong>, hook up <strong>Claude MCP</strong>, or optimize your retention with the <strong>CRAZY BEAST Engine</strong>!</p>
          <div class="companion-interactive-banner">
            <span class="companion-banner-sparkle">💡</span>
            <span>You can click any guide chip above, ask me questions, or even test your live connections below!</span>
          </div>
          <div class="companion-suggestions-box">
            <button type="button" class="companion-suggest-btn" data-query="How to create and connect YouTube API?">📺 Setup YouTube API</button>
            <button type="button" class="companion-suggest-btn" data-query="How to connect Google Drive API backup?">📁 Setup Drive API</button>
            <button type="button" class="companion-suggest-btn" data-query="How to setup MCP Server for Claude Desktop?">🧠 Setup Claude MCP</button>
            <button type="button" class="companion-action-btn" data-action="test_youtube">🔴 Test YouTube Link</button>
            <button type="button" class="companion-action-btn" data-action="test_drive">📁 Test Drive Link</button>
          </div>
        </div>
      </div>
    </div>

    <form class="companion-chat-bar">
      <input type="text" class="companion-chat-input" placeholder="Ask Pixel anything... (e.g. 'How to setup YouTube?', 'Tell me a joke')" autocomplete="off" />
      <button type="submit" class="companion-chat-submit" aria-label="Send question">Ask ✨</button>
    </form>
  </div>

  <!-- TAB 2: SYSTEM ACTIVITY & LOGS -->
  <div class="companion-tab-content companion-activity-view" id="companionActivityView" hidden>
    <p class="companion-current" role="status" aria-live="polite">Ready when you are.</p>
    <button type="button" class="companion-skip" hidden>Show now</button>
    <ol class="companion-feed"></ol>
    <footer class="companion-activity-footer">
      <button type="button" class="companion-clear">Clear activity</button>
      <button type="button" class="companion-quiet" aria-pressed="false">Quiet mode</button>
    </footer>
  </div>
</section>
<div class="companion-bubble" role="status" aria-live="polite" hidden></div>
<button type="button" class="companion-pet" aria-label="Clip companion: open studio activity" aria-controls="companionActivity" aria-expanded="false">
  <span class="companion-antenna"></span>
  <span class="companion-face"><i></i><i></i></span>
  <span class="companion-unread" hidden></span>
</button>
`;

  document.body.append(host);

  const panel = host.querySelector('.companion-panel');
  const pet = host.querySelector('.companion-pet');
  const bubble = host.querySelector('.companion-bubble');
  const feed = host.querySelector('.companion-feed');
  const current = host.querySelector('.companion-current');
  const skip = host.querySelector('.companion-skip');
  const unread = host.querySelector('.companion-unread');
  const activityBadge = host.querySelector('.companion-activity-badge');
  const chatFeed = host.querySelector('.companion-chat-feed');
  const chatInput = host.querySelector('.companion-chat-input');
  const chatForm = host.querySelector('.companion-chat-bar');
  const tabs = host.querySelectorAll('.companion-tab');
  const guideView = host.querySelector('#companionGuideView');
  const activityView = host.querySelector('#companionActivityView');
  const soundBtn = host.querySelector('.companion-sound-btn');
  const petBtn = host.querySelector('.companion-pet-btn');
  const avatarBadge = host.querySelector('.companion-avatar-badge');

  let quiet = false;
  let timer = null;
  const last = new Map();
  let typingTimer = null;
  let latestMessage = 'Ready when you are.';
  let typed = 0;
  let unreadActivityCount = 0;
  const chatHistory = [];

  // Toggle Sound Effects
  soundBtn?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem('autoclip.companion_sound', String(soundEnabled)); } catch(e) {}
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playCuteSound('boop');
  });

  // Pet / High Five Pixel Interaction
  const triggerPetReaction = () => {
    playCuteSound('fanfare');
    host.classList.remove('companion-wiggle-anim');
    void host.offsetWidth; // trigger reflow
    host.classList.add('companion-wiggle-anim');

    const compliments = [
      "Hehe, *boop!* That tickles! 🤖✨",
      "High five! ✋ Let's make something viral today!",
      "Aww! Energy levels boosted to 100%! ⚡",
      "Sending creative vibes straight to your timeline! 🎨",
      "Proud of you, creator! You're crushing it! 🏆"
    ];
    const picked = compliments[Math.floor(Math.random() * compliments.length)];

    host.dataset.mood = 'success';
    host.dataset.expression = 'celebrate';

    // Append cute speech bubble into chat
    const cheerMsg = document.createElement('div');
    cheerMsg.className = 'companion-chat-msg companion-msg-bot companion-msg-cheer';
    cheerMsg.innerHTML = `<div class="companion-msg-avatar">💖</div><div class="companion-msg-body"><p>${picked}</p></div>`;
    chatFeed.appendChild(cheerMsg);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    setTimeout(() => {
      host.classList.remove('companion-wiggle-anim');
      if (host.dataset.mood === 'success') host.dataset.mood = 'idle';
    }, 3000);
  };

  petBtn?.addEventListener('click', triggerPetReaction);
  avatarBadge?.addEventListener('click', triggerPetReaction);

  // Markdown formatter with interactive checkable steps
  function formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks with copy button
    html = html.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (m, code) => {
      const clean = code.trim();
      return `<div class="companion-code-block"><pre><code>${clean}</code></pre><button type="button" class="companion-copy-btn" title="Copy to clipboard">Copy</button></div>`;
    });

    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h5 class="companion-h5">$1</h5>');
    html = html.replace(/^### (.*$)/gim, '<h4 class="companion-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="companion-h3">$1</h3>');

    // Dividers
    html = html.replace(/^---$/gim, '<hr class="companion-divider" />');

    // Bold & italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="companion-inline-code">$1</code>');

    // Numbered step lists with interactive checkable box
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, (m, num, content) => {
      return `<li class="companion-step-li">
        <label class="companion-step-label">
          <input type="checkbox" class="companion-step-checkbox" />
          <span class="companion-step-custom-box"></span>
          <span class="companion-step-num">${num}</span>
        </label>
        <div class="companion-step-content">${content}</div>
      </li>`;
    });

    // Unordered bullet lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="companion-bullet-li">$1</li>');

    // Wrap consecutive list items
    html = html.replace(/(<li class="companion-step-li">[\s\S]*?<\/li>)/g, '<ol class="companion-step-list">$1</ol>');
    html = html.replace(/<\/ol>\s*<ol class="companion-step-list">/g, '');

    html = html.replace(/(<li class="companion-bullet-li">[\s\S]*?<\/li>)/g, '<ul class="companion-bullet-list">$1</ul>');
    html = html.replace(/<\/ul>\s*<ul class="companion-bullet-list">/g, '');

    // Paragraphs
    return html.split('\n\n').map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<div') || p.startsWith('<hr') || p.startsWith('<ol') || p.startsWith('<ul') || p.startsWith('<li')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
  }

  // Handle Tab Switch
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      playCuteSound('pop');
      tabs.forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      if (target === 'guide') {
        guideView.hidden = false;
        activityView.hidden = true;
        chatInput?.focus();
      } else {
        guideView.hidden = true;
        activityView.hidden = false;
        unreadActivityCount = 0;
        if (activityBadge) activityBadge.hidden = true;
      }
    });
  });

  const finishTyping = () => {
    clearTimeout(typingTimer);
    typingTimer = null;
    current.textContent = latestMessage;
    current.classList.remove('is-typing');
    skip.hidden = true;
  };
  skip.onclick = finishTyping;

  const typeMessage = () => {
    clearTimeout(typingTimer);
    typed = 0;
    current.textContent = '';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finishTyping();
      return;
    }
    current.classList.add('is-typing');
    skip.hidden = false;
    const step = () => {
      if (panel.hidden) {
        finishTyping();
        return;
      }
      typed = Math.min(latestMessage.length, typed + 2);
      current.textContent = latestMessage.slice(0, typed);
      if (typed < latestMessage.length) typingTimer = setTimeout(step, 24);
      else finishTyping();
    };
    step();
  };

  const open = value => {
    panel.hidden = !value;
    pet.setAttribute('aria-expanded', String(value));
    bubble.hidden = true;
    if (value) {
      playCuteSound('boop');
      unread.hidden = true;
      unreadActivityCount = 0;
      if (activityBadge) activityBadge.hidden = true;
      if (!activityView.hidden) typeMessage();
      else chatInput?.focus();
    } else {
      finishTyping();
    }
  };

  pet.onclick = () => open(panel.hidden);
  host.querySelector('.companion-close').onclick = () => {
    playCuteSound('pop');
    open(false);
  };
  host.querySelector('.companion-clear').onclick = () => {
    feed.replaceChildren();
    unread.hidden = true;
    playCuteSound('pop');
  };
  host.querySelector('.companion-quiet').onclick = event => {
    quiet = !quiet;
    event.currentTarget.setAttribute('aria-pressed', String(quiet));
    bubble.hidden = true;
    playCuteSound('pop');
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      open(false);
      pet.focus();
    }
  });

  // Live Connection Testers (Interactive Actions)
  async function runInteractiveAction(action) {
    if (action === 'test_youtube') {
      playCuteSound('pop');
      const testMsg = document.createElement('div');
      testMsg.className = 'companion-chat-msg companion-msg-bot';
      testMsg.innerHTML = `<div class="companion-msg-avatar">🔍</div><div class="companion-msg-body"><p><em>Checking YouTube connection...</em></p></div>`;
      chatFeed.appendChild(testMsg);
      chatFeed.scrollTop = chatFeed.scrollHeight;

      try {
        const res = await fetch('/api/youtube/status');
        const data = await res.json();
        if (data.connected) {
          playCuteSound('fanfare');
          testMsg.innerHTML = `<div class="companion-msg-avatar">🎉</div><div class="companion-msg-body"><p><strong>Awesome news!</strong> Your YouTube channel is <strong>connected and ready</strong> for 1-click publishing! 🚀</p></div>`;
          host.dataset.mood = 'success';
        } else {
          testMsg.innerHTML = `<div class="companion-msg-avatar">⚠️</div><div class="companion-msg-body"><p>YouTube is not linked yet! Follow <strong>Step 5</strong> above: place <code>google-oauth.json</code> in <code>config/</code> and click <strong>🔴 Link YouTube</strong> in the top bar.</p></div>`;
          host.dataset.mood = 'working';
        }
      } catch(e) {
        testMsg.innerHTML = `<div class="companion-msg-avatar">⚠️</div><div class="companion-msg-body"><p>Could not check YouTube status: ${e.message}</p></div>`;
      }
    } else if (action === 'test_drive') {
      playCuteSound('pop');
      const testMsg = document.createElement('div');
      testMsg.className = 'companion-chat-msg companion-msg-bot';
      testMsg.innerHTML = `<div class="companion-msg-avatar">🔍</div><div class="companion-msg-body"><p><em>Checking Google Drive connection...</em></p></div>`;
      chatFeed.appendChild(testMsg);
      chatFeed.scrollTop = chatFeed.scrollHeight;

      try {
        const res = await fetch('/api/drive/status');
        const data = await res.json();
        if (data.connected) {
          playCuteSound('fanfare');
          testMsg.innerHTML = `<div class="companion-msg-avatar">🎉</div><div class="companion-msg-body"><p><strong>Google Drive is Connected!</strong> Your finished 9:16 vertical shorts will automatically sync to your cloud folder. ☁️✨</p></div>`;
          host.dataset.mood = 'success';
        } else {
          testMsg.innerHTML = `<div class="companion-msg-avatar">⚠️</div><div class="companion-msg-body"><p>Drive is not connected yet! Click <strong>📁 Connect Google Drive</strong> in the top bar to authorize.</p></div>`;
        }
      } catch(e) {
        testMsg.innerHTML = `<div class="companion-msg-avatar">⚠️</div><div class="companion-msg-body"><p>Could not check Drive status: ${e.message}</p></div>`;
      }
    }
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  // Assistant Query Handler
  async function askPixel(query) {
    if (!query || !query.trim()) return;
    const text = query.trim();

    playCuteSound('pop');

    // Append user message to chat
    const userMsg = document.createElement('div');
    userMsg.className = 'companion-chat-msg companion-msg-user';
    userMsg.innerHTML = `<div class="companion-msg-body"><p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>`;
    chatFeed.appendChild(userMsg);

    // Append thinking indicator
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'companion-chat-msg companion-msg-bot companion-msg-thinking';
    thinkingMsg.innerHTML = `<div class="companion-msg-avatar">🤖</div><div class="companion-msg-body"><p><em>Pixel is thinking...</em> <span class="companion-thinking-dots"><span>.</span><span>.</span><span>.</span></span></p></div>`;
    chatFeed.appendChild(thinkingMsg);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    // Set mood & face to thinking
    host.dataset.mood = 'working';
    host.dataset.expression = 'thinking';

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      thinkingMsg.remove();

      const answerText = data.answer || data.text || '';
      const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : Array.isArray(data.suggestedTopics) ? data.suggestedTopics.map(s => s.title || s) : []);

      // Append bot response
      const botMsg = document.createElement('div');
      botMsg.className = 'companion-chat-msg companion-msg-bot';
      
      let html = `<div class="companion-msg-avatar">🤖</div><div class="companion-msg-body">${formatMarkdown(answerText)}`;
      
      // Interactive action buttons based on topic
      if (data.topicId === 'youtube_api') {
        html += `<div class="companion-actions-row"><button type="button" class="companion-action-btn" data-action="test_youtube">🔴 Test YouTube Connection</button></div>`;
      } else if (data.topicId === 'google_drive') {
        html += `<div class="companion-actions-row"><button type="button" class="companion-action-btn" data-action="test_drive">📁 Test Drive Connection</button></div>`;
      }

      // Suggestions
      if (suggestions.length > 0) {
        html += `<div class="companion-suggestions-box">`;
        suggestions.forEach(s => {
          const sLabel = typeof s === 'string' ? s : (s.title || s.id || '');
          html += `<button type="button" class="companion-suggest-btn" data-query="${sLabel.replace(/"/g, '&quot;')}">${sLabel}</button>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
      botMsg.innerHTML = html;
      chatFeed.appendChild(botMsg);

      playCuteSound('boop');

      // Record to history
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: answerText });
      if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);

      // Cute expression switch
      const mood = data.mood || 'happy';
      host.dataset.mood = mood === 'celebrate' || mood === 'proud' ? 'success' : 'idle';
      host.dataset.expression = mood;

    } catch (err) {
      thinkingMsg.remove();
      const errorMsg = document.createElement('div');
      errorMsg.className = 'companion-chat-msg companion-msg-bot companion-msg-error';
      errorMsg.innerHTML = `<div class="companion-msg-avatar">😿</div><div class="companion-msg-body"><p>Oops! My circuits got a little confused: ${err.message}. Want to try asking again?</p></div>`;
      chatFeed.appendChild(errorMsg);
      host.dataset.mood = 'error';
      host.dataset.expression = 'worried';
    }

    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  // Chat Form Submit
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    const query = chatInput.value;
    chatInput.value = '';
    askPixel(query);
  });

  // Click Delegations: Chips, Suggestions, Copy, Checkboxes & Action Buttons
  host.addEventListener('click', event => {
    // Action buttons (Test YouTube, Test Drive)
    const actionBtn = event.target.closest('.companion-action-btn');
    if (actionBtn && actionBtn.dataset.action) {
      runInteractiveAction(actionBtn.dataset.action);
      return;
    }

    // Chips & Suggestions
    const chip = event.target.closest('.companion-chip, .companion-suggest-btn');
    if (chip && chip.dataset.query) {
      askPixel(chip.dataset.query);
      return;
    }

    // Copy to clipboard
    const copyBtn = event.target.closest('.companion-copy-btn');
    if (copyBtn) {
      playCuteSound('pop');
      const code = copyBtn.previousElementSibling?.textContent || '';
      navigator.clipboard?.writeText(code).then(() => {
        copyBtn.textContent = 'Copied! ✨';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
      return;
    }

    // Interactive Checkboxes in step lists
    const checkbox = event.target.closest('.companion-step-checkbox');
    if (checkbox) {
      const stepLi = checkbox.closest('.companion-step-li');
      stepLi?.classList.toggle('is-completed', checkbox.checked);
      if (checkbox.checked) {
        playCuteSound('boop');
      }

      // Check if all steps in this list are completed!
      const stepList = checkbox.closest('.companion-step-list');
      if (stepList) {
        const allCheckboxes = [...stepList.querySelectorAll('.companion-step-checkbox')];
        const allDone = allCheckboxes.every(cb => cb.checked);
        if (allDone && allCheckboxes.length > 1) {
          playCuteSound('fanfare');
          triggerPetReaction();
        }
      }
    }
  });

  // Activity Report (Studio Events, Renders & Telemetry)
  const report = (message, mood = 'idle', key = message) => {
    if (!message || last.get(key) === message) return;
    last.set(key, message);
    if (last.size > 120) last.delete(last.keys().next().value);

    host.dataset.mood = mood;
    latestMessage = message;
    if (!panel.hidden && !activityView.hidden) typeMessage();
    else current.textContent = message;

    const item = document.createElement('li');
    const time = document.createElement('time');
    const text = document.createElement('span');
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    text.textContent = message;
    item.dataset.mood = mood;
    item.append(time, text);
    feed.prepend(item);
    while (feed.children.length > 40) feed.lastElementChild.remove();

    if (panel.hidden) {
      unread.hidden = false;
      if (!quiet) {
        bubble.textContent = message;
        bubble.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(() => { bubble.hidden = true; }, 6500);
      }
    } else if (activityView.hidden) {
      unreadActivityCount++;
      if (activityBadge) {
        activityBadge.textContent = String(unreadActivityCount);
        activityBadge.hidden = false;
      }
    }
  };

  const observeJob = job => {
    if (!job?.id) return;
    const status = String(job.status || '');
    const failed = status === 'failed';
    const done = ['complete', 'ready'].includes(status);
    const title = job.sourceName || job.title || 'Project';
    const message = failed
      ? `${title}: ${job.error || 'Processing failed. Open the project to review.'}`
      : done
      ? `${title}: ${status === 'ready' ? 'clips are ready to edit' : 'export complete'}.`
      : `${title}: ${job.progress?.message || status || 'Working'}${Number.isFinite(job.progress?.percent) ? ` · ${Math.round(job.progress.percent)}%` : ''}`;

    const stage = `${status}:${job.progress?.message || ''}`;
    if (last.get(`stage:${job.id}`) === stage) return;
    last.set(`stage:${job.id}`, stage);
    report(message, failed ? 'error' : done ? 'success' : 'working', `job:${job.id}`);
  };

  const originalApi = window.api || (async (u, opt) => (await fetch(u, opt)).json());
  window.api = async function(url, ...args) {
    try {
      const result = await originalApi.call(this, url, ...args);
      if (/^\/api\/jobs(?:\/[^/?]+)?$/.test(String(url)) && !Array.isArray(result)) observeJob(result);
      return result;
    } catch (error) {
      report(error.message || 'A request failed. Check your connection and try again.', 'error', `request:${String(url).split('?')[0]}`);
      throw error;
    }
  };

  document.addEventListener('autoclip-telemetry', event => {
    const health = event.detail?.health;
    if (!health) return;
    const status = health.status;
    if (['CRITICAL_OOM_RISK', 'HIGH_LOAD'].includes(status)) {
      report(health.message || 'System resources are running low.', status === 'HIGH_LOAD' ? 'working' : 'error', 'system-health');
    } else if (last.has('system-health')) {
      report('System resources are back within safe limits.', 'success', 'system-health');
    }
  });

  for (const id of ['previewVideo', 'cinemaVideo']) {
    document.getElementById(id)?.addEventListener('error', () => {
      report('The video could not be loaded. Check that its source file is still available.', 'error', `video:${id}`);
    });
  }

  report('Ready when you are. I’ll keep track of processing, exports and errors.', 'idle', 'welcome');
  bubble.hidden = true;
  unread.hidden = true;
})();
