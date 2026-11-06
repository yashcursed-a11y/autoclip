/* Reference-led capsule navigation and curved framing selector. */
(() => {
  const nav=document.querySelector('.rail-nav');
  if(!nav)return;
  document.body.classList.add('capsule-navigation');
  const indicator=document.createElement('span');indicator.className='capsule-active-indicator';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator);
  const sectionName=document.createElement('span');sectionName.className='current-section-name';
  sectionName.setAttribute('aria-live','polite');document.querySelector('.topbar-left')?.prepend(sectionName);
  const tooltip=document.createElement('div');tooltip.className='section-name-tooltip';tooltip.id='sectionNameTooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  const names={railMaxAutomateBtn:'MAX Channel Clipper',railIngestBtn:'New project',navStudioBtn:'Editor',navCaptionPhoneBtn:'Captions',navWatchBtn:'Watch',navSchedulerBtn:'Publishing',navProcessesBtn:'System',railHistoryBtn:'Project library'};
  const labelFor=button=>names[button.id] || ({captions:'Text & captions',framing:'Auto framing',watermark:'Branding',overlays:'Overlays',transcript:'Transcript'})[button.dataset.subtab] || button.querySelector('.rail-label')?.textContent || button.textContent.trim();
  let tooltipOwner=null;
  const showName=button=>{
    tooltipOwner=button;tooltip.textContent=labelFor(button);tooltip.hidden=false;
    const rect=button.getBoundingClientRect();
    const width=tooltip.offsetWidth || 140,height=tooltip.offsetHeight || 36;
    const scale=window.getAppLayoutScale?.()||1,viewport=window.getAppViewport?.()||{width:window.innerWidth,height:window.innerHeight};
    tooltip.style.left=`${Math.min(rect.right/scale+14,viewport.width-width-12)}px`;
    tooltip.style.top=`${Math.max(8,Math.min(rect.top/scale+(rect.height/scale-height)/2,viewport.height-height-8))}px`;
    button.setAttribute('aria-describedby',tooltip.id);
  };
  const hideName=()=>{tooltipOwner?.removeAttribute('aria-describedby');tooltipOwner=null;tooltip.hidden=true;};
  document.querySelectorAll('.app-rail .rail-btn,.editor-tools-dock button,.app-rail .rail-logo').forEach(button=>{
    // Replace browser-native legacy tooltips with short section names.
    button.removeAttribute('title');button.setAttribute('aria-label',button.classList.contains('rail-logo')?'AutoClip home':labelFor(button));
    button.addEventListener('mouseenter',()=>showName(button));button.addEventListener('mouseleave',hideName);
    button.addEventListener('focus',()=>showName(button));button.addEventListener('blur',hideName);
    button.addEventListener('click',hideName);
  });
  window.addEventListener('resize',hideName);
  let initialized=false;
  let frame=null;
  const update=()=>{
    frame=null;
    const active=nav.querySelector('.rail-btn.active');
    if(!active){indicator.hidden=true;return;}
    indicator.hidden=false;
    indicator.style.transform=`translateY(${active.offsetTop}px)`;
    indicator.style.height=`${active.offsetHeight}px`;
    const label=labelFor(active);if(sectionName.textContent!==label)sectionName.textContent=label;
    if(!initialized){initialized=true;requestAnimationFrame(()=>nav.classList.add('capsule-motion-ready'));}
  };
  const schedule=()=>{if(frame===null)frame=requestAnimationFrame(update);};
  const observer=new MutationObserver(schedule);
  nav.querySelectorAll('.rail-btn').forEach(button=>{
    button.setAttribute('aria-label',labelFor(button));
    observer.observe(button,{attributes:true,attributeFilter:['class']});
  });
  new ResizeObserver(schedule).observe(nav);
  const frames=document.querySelector('.new-framing-grid');
  if(frames){
    frames.classList.add('curved-mode-selector');
    [...frames.children].forEach((button,index)=>{
      button.style.setProperty('--arc-offset',`${[0,20,32,32,20,0][index] || 0}px`);
      const mark=document.createElement('span');mark.className='curve-selection-mark';mark.textContent='✓';mark.setAttribute('aria-hidden','true');button.append(mark);
    });
  }
  schedule();
})();
