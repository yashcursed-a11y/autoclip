/* One local decorative video. Never affects footage, captions or exports. */
(() => {
  const layer=document.createElement('div');layer.className='minimal-film-background';layer.setAttribute('aria-hidden','true');
  const video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.tabIndex=-1;
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('loop','');
  video.setAttribute('data-autoclip-background','');
  video.poster='/assets/backgrounds/minimal-motion-poster.jpg';layer.append(video);document.body.prepend(layer);
  const control=document.createElement('button');control.type='button';control.className='minimal-background-control';
  document.querySelector('.topbar-right')?.prepend(control);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let choice=null,enabled=true;
  try{choice=localStorage.getItem('autoclip.minimalBackgroundMotion');enabled=choice!=='off';}catch{}
  const updateControl=()=>{const playing=!video.paused&&!video.error;control.textContent=playing?'Pause background':'Play background';control.setAttribute('aria-pressed',String(playing));};
  function refresh(){
    const active=document.body.dataset.uiStyle==='minimal';layer.hidden=!active;control.hidden=!active;
    const moving=active&&enabled&&(!reduced.matches||choice==='on');video.autoplay=moving;
    if(moving){if(!video.getAttribute('src'))video.src='/assets/backgrounds/minimal-motion.mp4';video.muted=true;video.play().then(updateControl).catch(updateControl);}else video.pause();updateControl();
  }
  control.addEventListener('click',()=>{enabled=video.paused;choice=enabled?'on':'off';try{localStorage.setItem('autoclip.minimalBackgroundMotion',choice);}catch{}refresh();});
  for(const event of ['playing','pause','error'])video.addEventListener(event,updateControl);
  document.addEventListener('pointerdown',event=>{if(event.target!==control&&enabled&&video.paused)refresh();});
  document.addEventListener('autoclip-ui-changed',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('pagehide',()=>video.pause());reduced.addEventListener('change',refresh);refresh();
})();
