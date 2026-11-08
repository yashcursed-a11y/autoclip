/* Silver Surge transforms the shell while retaining each original control. */
(()=>{
  const $=s=>document.querySelector(s),nav=$('.rail-nav'),rail=$('.rail-top'),top=$('.studio-topbar');if(!nav||!rail||!top)return;
  const marker=document.createComment('navigation home');nav.before(marker);
  const bar=document.createElement('nav');bar.className='surge-navigation';bar.setAttribute('aria-label','Silver Surge workspaces');bar.hidden=true;top.after(bar);
  const edition=document.createElement('div');edition.className='surge-edition';edition.innerHTML='<span class="surge-monogram" aria-hidden="true">S<span>↗</span></span><span>SILVER<br>SURGE<small>MAX WORKSPACE / 01</small></span>';rail.prepend(edition);
  const membership=document.createElement('button');membership.type='button';membership.className='surge-membership';membership.innerHTML='<span>MAX</span><small>Creator membership</small><b>↗</b>';membership.onclick=()=>$('#licenseStatusBtn')?.click();$('.rail-bottom')?.prepend(membership);
  const preview=document.createElement('div');preview.className='surge-preview-notice';preview.hidden=true;preview.innerHTML='<span>Silver Surge <b>Preview</b></span><button type="button" data-surge-activate>Activate MAX ↗</button><button type="button" data-surge-exit aria-label="Exit Silver Surge preview">×</button>';top.before(preview);preview.querySelector('[data-surge-activate]').onclick=()=>$('#licenseStatusBtn')?.click();preview.querySelector('[data-surge-exit]').onclick=()=>window.autoclipThemes.apply('dark');
  const dashboard=$('.workspace-dashboard');
  if(dashboard){
    const index=document.createElement('div');index.className='surge-collection-index';index.innerHTML='<span>THE CREATOR’S COLLECTION</span><span>PRIVATE WORKSPACE <i aria-hidden="true">●</i></span>';dashboard.prepend(index);
    const summary=document.createElement('div');summary.className='surge-library-summary';summary.setAttribute('aria-label','Project library summary');summary.innerHTML='<div><span>RECORDINGS</span><strong data-surge-recordings>0</strong></div><div><span>CLIPS DISCOVERED</span><strong data-surge-clips>0</strong></div><p>A place for your next<br><em>great cut.</em></p>';dashboard.querySelector('.workspace-launch-heading')?.append(summary);
  }
  function updateCounts(){if(typeof state==='undefined')return;const jobs=state.jobs||[];const a=$('[data-surge-recordings]'),b=$('[data-surge-clips]');if(a)a.textContent=String(jobs.length).padStart(2,'0');if(b)b.textContent=String(jobs.reduce((sum,j)=>sum+(j.clips?.length||0),0)).padStart(2,'0');}
  const prior=renderJobs;renderJobs=function(...args){const result=prior.apply(this,args);updateCounts();return result;};
  function apply(){const active=document.body.dataset.theme==='silver-surge';bar.hidden=!active;edition.hidden=!active;membership.hidden=!active;preview.hidden=!active||document.body.dataset.premiumPreview!=='true';if(active){bar.append(nav);nav.querySelectorAll('.rail-btn').forEach((b,i)=>b.style.setProperty('--surge-nav-index',`"0${i+1}"`));}else marker.after(nav);updateCounts();window.dispatchEvent(new Event('resize'));}
  document.addEventListener('autoclip-theme-changed',apply);document.addEventListener('autoclip-ready',apply);
  if(typeof renderLicenseStatus==='function'){const original=renderLicenseStatus;renderLicenseStatus=function(...args){const r=original.apply(this,args);if(document.body.dataset.theme==='silver-surge'){const paid=state.license?.isMax===true;document.body.dataset.premiumPreview=String(!paid);if(paid)try{localStorage.setItem('autoclip.theme','silver-surge');}catch{}apply();}return r;};}
  apply();
})();
