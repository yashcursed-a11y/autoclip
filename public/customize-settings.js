/* Settings navigation; retain the Bot controls and their saved behavior. */
(() => {
  // Settings must also work when the optional companion is not loaded.
  if (!document.querySelector('.companion-customize-card')) {
    const trigger=document.createElement('button');trigger.type='button';trigger.className='companion-customize-trigger pill-btn';trigger.textContent='Customize';trigger.setAttribute('aria-haspopup','dialog');
    const modal=document.createElement('div');modal.className='companion-customize settings-standalone';modal.hidden=true;
    modal.innerHTML='<section class="companion-customize-card" role="dialog" aria-modal="true" aria-label="Customize your studio" tabindex="-1"><header><div><small>STUDIO PREFERENCES</small><h2>Customize your studio</h2></div><button type="button" aria-label="Close Customize">×</button></header></section>';
    document.body.append(modal);document.querySelector('.studio-topbar')?.append(trigger);
    const close=()=>{modal.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();};
    trigger.addEventListener('click',()=>{modal.hidden=false;trigger.setAttribute('aria-expanded','true');modal.querySelector('[aria-label="Close Customize"]').focus();});
    modal.querySelector('[aria-label="Close Customize"]').addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
  }
  const card=document.querySelector('.companion-customize-card');if(!card)return;
  const header=card.querySelector('header'),original=[...card.children].filter(n=>n!==header);
  const layout=document.createElement('div');layout.className='customize-layout';
  const nav=document.createElement('nav');nav.className='customize-nav';nav.setAttribute('aria-label','Settings sections');
  const pages=document.createElement('div');pages.className='customize-pages';
  const bot=document.createElement('section');bot.className='customize-page';bot.dataset.page='bot';original.forEach(n=>bot.append(n));
  const appearance=document.createElement('section');appearance.className='customize-page';appearance.dataset.page='appearance';appearance.innerHTML='<h3>Appearance</h3><p>Adjust the workspace to suit your screen.</p><label class="bot-setting"><span>Compact interface<small>Tighter spacing in lists and controls</small></span><input type="checkbox" id="settingsCompact"></label><label class="bot-setting"><span>Reduce motion<small>Keep transitions and the companion still</small></span><input type="checkbox" id="settingsReduceMotion"></label>';
  const editor=document.createElement('section');editor.className='customize-page';editor.dataset.page='editor';editor.innerHTML='<h3>Editor</h3><p>Choose how much of your workspace stays visible.</p><label class="bot-setting"><span>Media library<small>Show source footage and highlight candidates</small></span><input type="checkbox" id="settingsMedia"></label><label class="bot-setting"><span>Properties panel<small>Show framing, captions and tool settings</small></span><input type="checkbox" id="settingsInspector"></label>';
  pages.append(appearance,editor);if(original.length)pages.append(bot);layout.append(nav,pages);card.append(layout);
  header.querySelector('small').textContent='AUTOCLIP PREFERENCES';
  const select=key=>{pages.querySelectorAll('.customize-page').forEach(page=>page.hidden=page.dataset.page!==key);nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-current',button.dataset.page===key?'page':'false'));};
  for(const [key,label] of [['appearance','Appearance'],['editor','Editor'],...(original.length?[['bot','Bot']]:[])]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.page=key;b.onclick=()=>select(key);nav.append(b);}
  let prefs={};try{prefs=JSON.parse(localStorage.getItem('autoclip.interface')||'{}');}catch{}
  const store=()=>{try{localStorage.setItem('autoclip.interface',JSON.stringify(prefs));}catch{}};
  const compact=card.querySelector('#settingsCompact'),motion=card.querySelector('#settingsReduceMotion'),media=card.querySelector('#settingsMedia'),inspector=card.querySelector('#settingsInspector'),viewport=document.querySelector('.studio-main-viewport');
  const apply=()=>{document.body.classList.toggle('interface-compact',!!prefs.compact);document.body.classList.toggle('interface-still',!!prefs.still);compact.checked=!!prefs.compact;motion.checked=!!prefs.still;};
  compact.onchange=()=>{prefs.compact=compact.checked;apply();store();};motion.onchange=()=>{prefs.still=motion.checked;apply();store();};
  const setPanel=(name,shown)=>{viewport?.classList.toggle(`${name}-closed`,!shown);const button=document.querySelector(name==='library'?'.editor-tools-dock .editor-tool':'[aria-label="Toggle properties panel"]');button?.setAttribute('aria-pressed',String(shown));};
  if(typeof prefs.media==='boolean')setPanel('library',prefs.media);if(typeof prefs.inspector==='boolean')setPanel('inspector',prefs.inspector);
  media.onchange=()=>{prefs.media=media.checked;setPanel('library',prefs.media);store();};inspector.onchange=()=>{prefs.inspector=inspector.checked;setPanel('inspector',prefs.inspector);store();};
  document.querySelector('.companion-customize-trigger').addEventListener('click',()=>{media.checked=!viewport?.classList.contains('library-closed');inspector.checked=!viewport?.classList.contains('inspector-closed');});
  // Trap focus using only the currently visible settings section.
  document.querySelector('.companion-customize').addEventListener('keydown',event=>{if(event.key!=='Tab')return;event.stopImmediatePropagation();const focusable=[...card.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled&&!n.closest('[hidden]'));const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}},true);
  apply();select('appearance');
})();
