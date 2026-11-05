/**
 * AUTOCLIP STUDIO — Landing Page Interactive Engine
 * Handles real-time viral scoring playground, interactive studio mockups, and UI animations.
 */

document.addEventListener('DOMContentLoaded', () => {
  initViralPlayground();
  initMockupStudio();
  initNavbarScroll();
});

/* ===================================================================
   1. Interactive Viral Rating Algorithm Playground
   =================================================================== */

function initViralPlayground() {
  const sliderHook = document.getElementById('sliderHook');
  const sliderFlow = document.getElementById('sliderFlow');
  const sliderAudio = document.getElementById('sliderAudio');
  const sliderPayoff = document.getElementById('sliderPayoff');

  const valHook = document.getElementById('sliderHookVal');
  const valFlow = document.getElementById('sliderFlowVal');
  const valAudio = document.getElementById('sliderAudioVal');
  const valPayoff = document.getElementById('sliderPayoffVal');

  const displayScore = document.getElementById('displayScoreNum');
  const displayRing = document.getElementById('scoreRingFill');
  const displayBadge = document.getElementById('displayScoreBadge');
  const displayTitle = document.getElementById('displayGeneratedTitle');
  const displayVerdict = document.getElementById('displayVerdictText');

  if (!sliderHook || !displayScore) return;

  const circumference = 2 * Math.PI * 42; // ~263.89px

  const sampleTitles = [
    { min: 90, titles: ["Surviving With ONLY $100?! 💸", "THE CLEANEST 1V5 CLUTCH EVER?! 🔥", "HE ACTUALLY DID THIS ON STREAM?! 💀", "I CANNOT BELIEVE THIS HAPPENED... 😱"] },
    { min: 80, titles: ["Things Got WAY Too Heated 🥊", "The Unluckiest Timing in History 🤦‍♂️", "When You Forget the Mic is Still On 🎙️"] },
    { min: 70, titles: ["He Tried to Play It Off So Cool 😂", "Chat Said It Wouldn't Work...", "Watch Until The Very End ⏳"] },
    { min: 0,  titles: ["Standard Casual Commentary", "Slow Conversational Build", "Low Dynamic Stream Moment"] }
  ];

  function updateScore() {
    const hook = parseInt(sliderHook.value, 10);
    const flow = parseInt(sliderFlow.value, 10);
    const audio = parseInt(sliderAudio.value, 10);
    const payoff = parseInt(sliderPayoff.value, 10);

    // Update label values
    valHook.textContent = `${hook}%`;
    valFlow.textContent = `${flow}%`;
    valAudio.textContent = `${audio}%`;
    valPayoff.textContent = `${payoff}%`;

    // Production-accurate 4-pillar weighting:
    // Hook (35%) + Speech Flow (25%) + Relative Audio Surge (25%) + Payoff (15%)
    const finalScore = Math.min(99, Math.max(30, Math.round(
      (hook * 0.35) + (flow * 0.25) + (audio * 0.25) + (payoff * 0.15)
    )));

    // Animate score counter
    displayScore.textContent = finalScore;

    // Update circular SVG progress
    const offset = circumference - (circumference * (finalScore / 100));
    displayRing.style.strokeDasharray = `${circumference}`;
    displayRing.style.strokeDashoffset = `${offset}`;

    // Update tier, colors, title, and verdict based on score thresholds
    if (finalScore >= 90) {
      displayRing.style.stroke = '#D8FF3E'; // Neon Lime
      displayBadge.className = 'display-tier-badge gold-tier';
      displayBadge.textContent = '🔥 Diamond Viral Goldmine';
      displayVerdict.textContent = `"Instant curiosity hook with high conversational tension and +${(audio / 24).toFixed(1)}x volume surge. High probability of TikTok FYP breakout."`;
      displayTitle.textContent = sampleTitles[0].titles[(hook + audio) % sampleTitles[0].titles.length];
    } else if (finalScore >= 80) {
      displayRing.style.stroke = '#00F2FE'; // Cyber Cyan
      displayBadge.className = 'display-tier-badge';
      displayBadge.style.background = 'rgba(0, 242, 254, 0.15)';
      displayBadge.style.color = '#00F2FE';
      displayBadge.style.border = '1px solid rgba(0, 242, 254, 0.4)';
      displayBadge.textContent = '⚡ Elite High-CTR Clip';
      displayVerdict.textContent = `"Strong opening retention and sustained speech pacing (${(flow / 25).toFixed(1)} words/sec). Solid algorithmic completion probability."`;
      displayTitle.textContent = sampleTitles[1].titles[(flow + payoff) % sampleTitles[1].titles.length];
    } else if (finalScore >= 70) {
      displayRing.style.stroke = '#10B981'; // Emerald Green
      displayBadge.className = 'display-tier-badge';
      displayBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      displayBadge.style.color = '#10B981';
      displayBadge.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      displayBadge.textContent = '✨ Solid Engagement';
      displayVerdict.textContent = `"Good conversational delivery, moderate audio contrast. Recommended for YouTube Shorts feed."`;
      displayTitle.textContent = sampleTitles[2].titles[(hook) % sampleTitles[2].titles.length];
    } else {
      displayRing.style.stroke = '#EF4444'; // Red
      displayBadge.className = 'display-tier-badge';
      displayBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      displayBadge.style.color = '#EF4444';
      displayBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      displayBadge.textContent = '⚠️ Low Retention Risk';
      displayVerdict.textContent = `"Slow opening hook or flat audio dynamics. Consider re-framing the opening 3 seconds with tighter cuts."`;
      displayTitle.textContent = sampleTitles[3].titles[(hook) % sampleTitles[3].titles.length];
    }
  }

  [sliderHook, sliderFlow, sliderAudio, sliderPayoff].forEach(slider => {
    slider.addEventListener('input', updateScore);
  });

  // Run initial calculation
  updateScore();
}

/* ===================================================================
   2. Interactive Studio Hero Mockup
   =================================================================== */

function initMockupStudio() {
  // Candidate card selection in mockup
  const cards = document.querySelectorAll('.mock-candidates .mock-card');
  const burnedCaptions = document.querySelector('.phone-burned-captions');

  const cardMockData = [
    {
      title: "Surviving With ONLY $100?! 💸",
      words: ["WAIT", "FOR", "THE", "REACTION..."],
      emoji: "💀",
      glowWord: "THE"
    },
    {
      title: "THE CLEANEST CLUTCH EVER?! 🔥",
      words: ["NO", "WAY", "HE", "HIT", "THAT!"],
      emoji: "🎯",
      glowWord: "THAT!"
    },
    {
      title: "Things Got WAY Too Heated 🥊",
      words: ["CHAT", "IS", "THIS", "REAL?!"],
      emoji: "🥊",
      glowWord: "REAL?!"
    }
  ];

  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active-card'));
      card.classList.add('active-card');

      if (cardMockData[index] && burnedCaptions) {
        const data = cardMockData[index];
        burnedCaptions.innerHTML = data.words.map(w => {
          if (w === data.glowWord) {
            return `<span class="caption-word pop-active">${w}</span>`;
          }
          return `<span class="caption-word">${w}</span>`;
        }).join(' ') + ` <span class="caption-emoji">${data.emoji}</span>`;
      }
    });
  });

  // Mock Part Selector
  const parts = document.querySelectorAll('.mock-parts-bar .mock-part');
  parts.forEach(part => {
    part.addEventListener('click', () => {
      parts.forEach(p => p.classList.remove('active'));
      part.classList.add('active');
    });
  });

  // Mock Aspect Ratio Options
  const aspectOptions = document.querySelectorAll('.hud-aspect-pill .hud-opt');
  aspectOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      aspectOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Color Swatches
  const swatches = document.querySelectorAll('.color-swatch-row .swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const activeWord = document.querySelector('.phone-burned-captions .pop-active');
      if (activeWord) {
        const color = swatch.style.backgroundColor;
        activeWord.style.color = color;
        activeWord.style.textShadow = `0 0 10px ${color}`;
      }
    });
  });

  // Caption Preset Chips
  const presetChips = document.querySelectorAll('.preset-pill-grid .preset-chip');
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Framing Toggles
  const framingOpts = document.querySelectorAll('.framing-toggle-box .ft-opt');
  framingOpts.forEach(ft => {
    ft.addEventListener('click', () => {
      framingOpts.forEach(f => f.classList.remove('active'));
      ft.classList.add('active');
    });
  });

  // Render Demo Button
  const renderBtn = document.querySelector('.render-demo-btn');
  if (renderBtn) {
    renderBtn.addEventListener('click', () => {
      const originalText = renderBtn.innerHTML;
      renderBtn.innerHTML = `<span>⚡ Rendering Clip (OpenCV + Whisper)...</span>`;
      renderBtn.style.opacity = '0.8';
      renderBtn.style.pointerEvents = 'none';

      setTimeout(() => {
        renderBtn.innerHTML = `<span>✓ 1080p Export Ready! Click Launch Studio</span>`;
        renderBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        renderBtn.style.pointerEvents = 'auto';

        setTimeout(() => {
          renderBtn.innerHTML = originalText;
          renderBtn.style.background = '';
          renderBtn.style.opacity = '1';
        }, 3000);
      }, 1400);
    });
  }
}

/* ===================================================================
   3. Floating Navbar Scroll Polish
   =================================================================== */

function initNavbarScroll() {
  const navbar = document.querySelector('.glass-navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.style.background = 'rgba(8, 10, 18, 0.88)';
      navbar.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)';
    } else {
      navbar.style.background = 'rgba(12, 14, 23, 0.75)';
      navbar.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    }
  });
}
