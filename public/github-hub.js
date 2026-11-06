// public/github-hub.js - GitHub Auto-Update & Creator Hub for AUTOCLIPIN
(() => {
  'use strict';

  let cachedUpdateInfo = null;

  async function fetchUpdateStatus() {
    try {
      const res = await fetch('/api/github/check-update');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cachedUpdateInfo = data;
      renderUpdatePill(data);
      if (data.hasUpdate) {
        showUpdateBanner(data);
      }
      return data;
    } catch (err) {
      console.warn('[GitHub Hub] Failed to check for updates:', err);
      return null;
    }
  }

  function renderUpdatePill(data) {
    const pill = document.getElementById('btnGithubUpdate');
    const text = document.getElementById('ghPillText');
    const dot = document.getElementById('ghUpdateDot');
    if (!pill || !text || !dot) return;

    if (data && data.hasUpdate) {
      text.textContent = `⚡ v${data.latestVersion} Available!`;
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 8px #f59e0b';
      pill.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      pill.style.background = 'rgba(245, 158, 11, 0.12)';
    } else {
      const ver = data?.currentVersion || '1.0.2';
      text.textContent = `v${ver} (Up to date)`;
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 6px #22c55e';
      pill.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      pill.style.background = 'rgba(255, 255, 255, 0.05)';
    }
  }

  function showUpdateBanner(data) {
    if (document.getElementById('ghUpdateTopBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'ghUpdateTopBanner';
    banner.style.cssText = `
      position: fixed;
      top: 48px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: linear-gradient(135deg, #1b293d, #0e1725);
      border: 1px solid #38bdf8;
      border-radius: 10px;
      padding: 10px 18px;
      color: #f8fafc;
      font-size: 13px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      gap: 14px;
      animation: fadeInSlide 0.3s ease-out;
    `;
    banner.innerHTML = `
      <span style="font-size: 16px;"></span>
      <div>
        <strong>AUTOCLIPIN v${data.latestVersion} is available!</strong>
        <span style="color: #94a3b8; margin-left: 6px;">(You are on v${data.currentVersion})</span>
      </div>
      <button id="btnBannerOpenUpdate" style="padding: 4px 12px; background: #38bdf8; color: #020617; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px;">View &amp; Update ↗</button>
      <button id="btnBannerDismiss" style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 4px;">&times;</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('btnBannerOpenUpdate')?.addEventListener('click', () => {
      openGithubModal();
      banner.remove();
    });
    document.getElementById('btnBannerDismiss')?.addEventListener('click', () => {
      banner.remove();
    });
  }

  function createGithubModal() {
    if (document.getElementById('githubModal')) return;

    const modal = document.createElement('dialog');
    modal.id = 'githubModal';
    modal.style.cssText = `
      border: 1px solid #7289ad;
      border-radius: 16px;
      background: linear-gradient(145deg, #131c2a, #080c14);
      color: #f0f6ff;
      padding: 0;
      max-width: 620px;
      width: 92%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06);
    `;

    modal.innerHTML = `
      <div style="padding: 22px 26px; border-bottom: 1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <span style="font-size: 26px;">GH</span>
          <div>
            <h3 style="margin:0; font-size: 18px; font-weight: 800; color: #f0f6ff; letter-spacing: -0.3px;">GitHub Auto-Update &amp; Creator Hub</h3>
            <div style="font-size: 12px; color: #8fa5c5; margin-top: 2px;">Automatic version checks, releases &amp; creator sync</div>
          </div>
        </div>
        <button id="closeGithubModal" style="background:transparent; border:none; color:#8fa5c5; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
      </div>

      <div style="padding: 24px 26px;">
        <!-- Card 1: Version & Update Status -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #8fa5c5; text-transform: uppercase;">Software Release Status</span>
            <span id="ghModalStatusBadge" style="padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);">● Up to date</span>
          </div>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 8px;">
              <div style="font-size: 11px; color: #8fa5c5;">Installed Version</div>
              <div id="ghModalCurrentVer" style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 2px;">v1.0.2</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 8px;">
              <div style="font-size: 11px; color: #8fa5c5;">Latest on GitHub</div>
              <div id="ghModalLatestVer" style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 2px;">Checking...</div>
            </div>
          </div>

          <div id="ghUpdateActionsArea" style="display:none; margin-bottom: 12px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px;">
            <div style="font-weight: 700; color: #38bdf8; font-size: 13px; margin-bottom: 6px;"> Update Available!</div>
            <p id="ghUpdateReleaseTitle" style="font-size: 12px; color: #cbd5e1; margin: 0 0 10px;"></p>
            <div style="display:flex; gap: 10px; flex-wrap: wrap;">
              <a id="btnGhDownloadExe" href="#" target="_blank" style="padding: 6px 14px; background: #38bdf8; color: #020617; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 12px; display:inline-flex; align-items:center; gap: 6px;">Download Installer (.exe) <span>&darr;</span></a>
              <a id="btnGhDownloadZip" href="#" target="_blank" style="padding: 6px 14px; background: rgba(255,255,255,0.08); color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; font-weight: 600; font-size: 12px; display:inline-flex; align-items:center; gap: 6px;">Download Portable ZIP <span></span></a>
              <a id="btnGhViewRelease" href="#" target="_blank" style="padding: 6px 12px; color: #8fa5c5; text-decoration: underline; font-size: 12px; align-self: center;">View Changelog &nearr;</a>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button id="btnGhCheckNow" type="button" style="padding: 7px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;"> Check for Updates Now</button>
            <span id="ghCheckFeedback" style="font-size: 11px; color: #8fa5c5;"></span>
          </div>
        </div>

        <!-- Card 2: GitHub Account Connect -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #8fa5c5; text-transform: uppercase;">GitHub Account &amp; Sync</span>
            <span id="ghAccountBadge" style="font-size: 11px; color: #8fa5c5;">Guest Mode</span>
          </div>

          <div id="ghConnectedProfile" style="display:none; align-items:center; justify-content:space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <div style="display:flex; align-items:center; gap: 12px;">
              <img id="ghProfileAvatar" src="" alt="Avatar" style="width:36px; height:36px; border-radius:50%; border: 1px solid #7289ad;">
              <div>
                <div id="ghProfileName" style="font-weight: 700; color: #fff; font-size: 13px;"></div>
                <a id="ghProfileLink" href="#" target="_blank" style="font-size: 11px; color: #38bdf8; text-decoration:none;"></a>
              </div>
            </div>
            <button id="btnGhDisconnect" type="button" style="padding: 5px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 6px; font-size: 11px; cursor:pointer;">Disconnect</button>
          </div>

          <div id="ghConnectForm" style="display:block;">
            <p style="font-size: 12px; line-height: 1.5; color: #b6c7e2; margin: 0 0 12px;">
              Connect your GitHub account to enable automatic update alerts on every launch, unlock 5,000 API requests/hr, and report bugs with 1 click.
            </p>
            <div style="display:flex; gap: 8px; margin-bottom: 8px;">
              <input id="ghTokenInput" type="password" placeholder="GitHub Personal Access Token (classic or fine-grained)" style="flex:1; padding: 9px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 12px;">
              <button id="btnGhConnectToken" type="button" style="padding: 9px 16px; background: #22c55e; color: #020617; border: none; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">Connect</button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <a href="https://github.com/settings/tokens/new?description=AUTOCLIPIN+Auto-Update&scopes=" target="_blank" style="font-size: 11px; color: #38bdf8; text-decoration: underline;">Generate free token on GitHub &nearr; (no scopes needed)</a>
              <button id="btnGhGuestMode" type="button" style="background:transparent; border:none; color: #8fa5c5; font-size: 11px; text-decoration: underline; cursor:pointer;">Continue as Guest</button>
            </div>
            <div id="ghConnectFeedback" style="font-size: 11px; margin-top: 6px; min-height: 16px;"></div>
          </div>
        </div>

        <!-- Card 3: Auto-Update Startup Toggle & Creator Community -->
        <div style="display:flex; flex-direction:column; gap: 10px;">
          <label style="display:flex; align-items:center; gap: 8px; font-size: 12px; color: #b6c7e2; cursor:pointer;">
            <input type="checkbox" id="ghStartupCheckToggle" checked style="accent-color: #38bdf8;">
            <span>Automatically check GitHub for updates whenever AUTOCLIPIN starts</span>
          </label>
          <div style="display:flex; gap: 10px; margin-top: 8px; flex-wrap:wrap;">
            <a href="https://github.com/yashcursed-a11y/autoclip" target="_blank" style="flex:1; text-align:center; padding: 8px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #f0f6ff; font-size: 12px; font-weight: 600; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
              <span>⭐</span> Star Repository
            </a>
            <a href="https://github.com/yashcursed-a11y/autoclip/issues/new" target="_blank" style="flex:1; text-align:center; padding: 8px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #f0f6ff; font-size: 12px; font-weight: 600; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
              <span>💡</span> Request Feature / Report Issue
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('closeGithubModal')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        modal.close();
      }
    });

    document.getElementById('btnGhCheckNow')?.addEventListener('click', async () => {
      const fb = document.getElementById('ghCheckFeedback');
      if (fb) fb.textContent = 'Checking GitHub...';
      const data = await fetchUpdateStatus();
      updateModalUI(data);
      if (fb) fb.textContent = 'Checked just now.';
    });

    document.getElementById('btnGhConnectToken')?.addEventListener('click', async () => {
      const input = document.getElementById('ghTokenInput');
      const fb = document.getElementById('ghConnectFeedback');
      const token = (input?.value || '').trim();
      if (!token) {
        if (fb) { fb.style.color = '#f87171'; fb.textContent = 'Please enter a GitHub Personal Access Token.'; }
        return;
      }
      if (fb) { fb.style.color = '#38bdf8'; fb.textContent = 'Verifying token with GitHub...'; }

      try {
        const resp = await fetch('/api/github/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const res = await resp.json();
        if (res.success && res.user) {
          if (fb) { fb.style.color = '#4ade80'; fb.textContent = `Connected as @${res.user.login}!`; }
          renderConnectedUser(res.user);
          localStorage.setItem('autoclip_github_user', JSON.stringify(res.user));
          fetchUpdateStatus();
        } else {
          if (fb) { fb.style.color = '#f87171'; fb.textContent = res.error || 'Verification failed.'; }
        }
      } catch (err) {
        if (fb) { fb.style.color = '#f87171'; fb.textContent = err.message; }
      }
    });

    document.getElementById('btnGhDisconnect')?.addEventListener('click', async () => {
      try {
        await fetch('/api/github/disconnect', { method: 'POST' });
        localStorage.removeItem('autoclip_github_user');
        renderDisconnected();
        const fb = document.getElementById('ghConnectFeedback');
        if (fb) { fb.style.color = '#8fa5c5'; fb.textContent = 'Disconnected. Operating in Guest Mode.'; }
      } catch {}
    });

    document.getElementById('btnGhGuestMode')?.addEventListener('click', () => {
      modal.close();
    });

    document.getElementById('ghStartupCheckToggle')?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('autoclip_auto_update_enabled', String(enabled));
      fetch('/api/github/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoCheckOnStartup: enabled })
      }).catch(() => {});
    });
  }

  function renderConnectedUser(user) {
    const profile = document.getElementById('ghConnectedProfile');
    const form = document.getElementById('ghConnectForm');
    const badge = document.getElementById('ghAccountBadge');
    const avatar = document.getElementById('ghProfileAvatar');
    const name = document.getElementById('ghProfileName');
    const link = document.getElementById('ghProfileLink');

    if (profile && form && badge && avatar && name && link) {
      avatar.src = user.avatarUrl || '';
      name.textContent = user.name || user.login;
      link.textContent = `@${user.login} ↗`;
      link.href = user.htmlUrl || `https://github.com/${user.login}`;
      profile.style.display = 'flex';
      form.style.display = 'none';
      badge.textContent = `Connected (@${user.login})`;
      badge.style.color = '#4ade80';
    }
  }

  function renderDisconnected() {
    const profile = document.getElementById('ghConnectedProfile');
    const form = document.getElementById('ghConnectForm');
    const badge = document.getElementById('ghAccountBadge');
    if (profile && form && badge) {
      profile.style.display = 'none';
      form.style.display = 'block';
      badge.textContent = 'Guest Mode';
      badge.style.color = '#8fa5c5';
    }
  }

  function updateModalUI(data) {
    if (!data) return;
    const curEl = document.getElementById('ghModalCurrentVer');
    const latEl = document.getElementById('ghModalLatestVer');
    const statusBadge = document.getElementById('ghModalStatusBadge');
    const actionsArea = document.getElementById('ghUpdateActionsArea');
    const titleEl = document.getElementById('ghUpdateReleaseTitle');
    const exeBtn = document.getElementById('btnGhDownloadExe');
    const zipBtn = document.getElementById('btnGhDownloadZip');
    const viewBtn = document.getElementById('btnGhViewRelease');

    if (curEl) curEl.textContent = `v${data.currentVersion}`;
    if (latEl) latEl.textContent = `v${data.latestVersion}`;

    if (data.hasUpdate) {
      if (statusBadge) {
        statusBadge.textContent = '● Update Available';
        statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        statusBadge.style.color = '#f59e0b';
        statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      }
      if (actionsArea) actionsArea.style.display = 'block';
      if (titleEl) titleEl.textContent = data.releaseName || `New Release v${data.latestVersion}`;
      if (viewBtn) viewBtn.href = data.htmlUrl || 'https://github.com/yashcursed-a11y/autoclip/releases';

      const exeAsset = data.assets?.find(a => a.name.endsWith('.exe'));
      const zipAsset = data.assets?.find(a => a.name.endsWith('.zip'));

      if (exeBtn) {
        exeBtn.href = exeAsset ? exeAsset.downloadUrl : (data.htmlUrl || '#');
      }
      if (zipBtn) {
        zipBtn.href = zipAsset ? zipAsset.downloadUrl : (data.htmlUrl || '#');
      }
    } else {
      if (statusBadge) {
        statusBadge.textContent = '● Up to date';
        statusBadge.style.background = 'rgba(34, 197, 94, 0.15)';
        statusBadge.style.color = '#4ade80';
        statusBadge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      }
      if (actionsArea) actionsArea.style.display = 'none';
    }

    if (data.githubUser) {
      renderConnectedUser(data.githubUser);
    }
  }

  function openGithubModal() {
    createGithubModal();
    const modal = document.getElementById('githubModal');
    if (modal && typeof modal.showModal === 'function') {
      modal.showModal();
      if (cachedUpdateInfo) {
        updateModalUI(cachedUpdateInfo);
      } else {
        fetchUpdateStatus().then(updateModalUI);
      }
    }
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    createGithubModal();

    // Hook topbar button
    const pill = document.getElementById('btnGithubUpdate');
    if (pill) {
      pill.onclick = openGithubModal;
    }

    // Auto-check on startup if enabled
    const autoCheck = localStorage.getItem('autoclip_auto_update_enabled') !== 'false';
    if (autoCheck) {
      setTimeout(() => {
        fetchUpdateStatus();
      }, 1500);
    }

    // Manual open only via topbar button
  });

  window.openGithubUpdateModal = openGithubModal;
})();
