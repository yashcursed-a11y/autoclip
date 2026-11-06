/* One hover hub replaces the header action strip; original actions stay intact. */
(() => {
  const header=document.querySelector('.topbar-right');if(!header)return;
  const hub=document.createElement('div');hub.className='studio-hub';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='studio-hub-trigger';trigger.textContent='✦ Studio hub';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','studioHubPanel');
  const panel=document.createElement('div');panel.id='studioHubPanel';panel.className='studio-hub-panel';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Studio tools and connections');
  const center=document.createElement('div');center.className='studio-hub-center';center.innerHTML='<span>✦</span><strong>Studio hub</strong><small>Choose a tool</small>';panel.append(center);
  const items=[['topbarMaxBtn','Channel clipper'],['topbarAiMcpBtn','AI & MCP'],['licenseStatusBtn','Creator pass'],['topbarHelpBtn','Connect guide'],['geminiBadge','Gemini AI'],['youtubeBadge','YouTube'],['driveBadge','Google Drive'],['sysStatusBtn','System'],['.landing-pill','Website']];
  const actions=[];
  for(const [selector,label] of items){
    const action=selector.startsWith('.')?document.querySelector(selector):document.getElementById(selector);if(!action)continue;
    action.classList.add('studio-hub-action');action.dataset.hubAction='true';action.title=label;actions.push(action);panel.append(action);
    action.addEventListener('mouseenter',()=>{center.querySelector('strong').textContent=label;center.querySelector('small').textContent='Click to open';});
    action.addEventListener('focus',()=>{center.querySelector('strong').textContent=label;});
  }
  actions.forEach((action,i)=>{const angle=(-90+i*360/actions.length)*Math.PI/180;action.style.setProperty('--hub-x',`${Math.cos(angle)*132}px`);action.style.setProperty('--hub-y',`${Math.sin(angle)*132}px`);});
  document.querySelector('.workspace-account-menu')?.remove();
  hub.append(trigger,panel);header.append(hub);
  let closeTimer;
  const setOpen=open=>{clearTimeout(closeTimer);panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(!open){center.querySelector('strong').textContent='Studio hub';center.querySelector('small').textContent='Choose a tool';}};
  hub.addEventListener('mouseenter',()=>setOpen(true));hub.addEventListener('mouseleave',()=>{closeTimer=setTimeout(()=>setOpen(false),180);});
  trigger.onclick=()=>setOpen(panel.hidden);
  hub.addEventListener('focusin',event=>{if(event.target!==trigger)setOpen(true);});
  hub.addEventListener('focusout',event=>{if(!hub.contains(event.relatedTarget))setOpen(false);});
  panel.addEventListener('click',event=>{if(event.target.closest('button,a'))setOpen(false);});
  document.addEventListener('pointerdown',event=>{if(!hub.contains(event.target))setOpen(false);});
  hub.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);trigger.focus();}else if(event.key==='ArrowDown'&&event.target===trigger){event.preventDefault();setOpen(true);actions[0]?.focus();}});
})();

