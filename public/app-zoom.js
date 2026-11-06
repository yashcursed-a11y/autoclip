/* Whole-interface zoom. Native Electron zoom keeps layout and mouse coordinates aligned. */
(() => {
  const steps=[.6,.67,.75,.8,.9,1,1.1,1.25,1.5],bridge=window.autoClipDesktop;
  let factor=1,ready=!bridge;
  try{const value=Number(localStorage.getItem('autoclip.appZoom'));if(Number.isFinite(value)&&value>=.6&&value<=1.5)factor=value;}catch{}
  const preferredFactor=factor;
  const group=document.createElement('div');group.className='app-zoom-controls';group.setAttribute('role','group');group.setAttribute('aria-label','Whole app zoom');
  group.innerHTML='<button type="button" class="app-zoom-out" aria-label="Zoom out whole app" title="Zoom out app · Ctrl+−">−</button><button type="button" class="app-zoom-reset" aria-label="Reset whole app zoom" title="Reset app zoom · Ctrl+0">100%</button><button type="button" class="app-zoom-in" aria-label="Zoom in whole app" title="Zoom in app · Ctrl++">+</button><button type="button" class="app-zoom-fit" aria-label="Fit whole app to screen" title="Fit the studio interface to this screen">Fit</button>';
  document.querySelector('.topbar-right')?.prepend(group);
  const setting=document.createElement('div');setting.className='app-zoom-setting';setting.innerHTML='<label>App zoom<select aria-label="Whole app zoom percentage"></select></label><small>Scale the entire interface. Timeline zoom stays separate. Ctrl + / − to zoom; Ctrl + 0 to reset.</small><p class="app-zoom-status" role="status" aria-live="polite"></p>';
  document.querySelector('.customize-page[data-page=appearance]')?.append(setting);
  const select=setting.querySelector('select'),status=setting.querySelector('p');
  for(const step of steps){const option=document.createElement('option');option.value=String(step);option.textContent=`${Math.round(step*100)}%`;select.append(option);}
  window.getAppLayoutScale=()=>document.body.classList.contains('css-app-zoom')?factor:1;
  window.getAppViewport=()=>({width:window.innerWidth/window.getAppLayoutScale(),height:window.innerHeight/window.getAppLayoutScale()});
  const update=value=>{
    factor=Math.max(.6,Math.min(1.5,Number(value)||1));
    if(!bridge){document.body.classList.toggle('css-app-zoom',factor!==1);document.documentElement.style.setProperty('--app-zoom-factor',String(factor));}
    group.querySelector('.app-zoom-reset').textContent=`${Math.round(factor*100)}%`;select.value=String(factor);
    group.querySelector('.app-zoom-out').disabled=!ready||factor<=.6;group.querySelector('.app-zoom-in').disabled=!ready||factor>=1.5;select.disabled=!ready;
    try{localStorage.setItem('autoclip.appZoom',String(factor));}catch{}
    window.dispatchEvent(new Event('resize'));
  };
  const change=async value=>{if(!ready)return;try{if(bridge){const result=await bridge.setZoom(value);update(result.factor);}else update(value);status.textContent=`App zoom ${Math.round(factor*100)}%.`;}catch{status.textContent='App zoom could not be changed. Please reopen AutoClip.';}};
  group.querySelector('.app-zoom-out').onclick=()=>change([...steps].reverse().find(v=>v<factor-.001)??.6);
  group.querySelector('.app-zoom-in').onclick=()=>change(steps.find(v=>v>factor+.001)??1.5);
  group.querySelector('.app-zoom-reset').onclick=()=>change(1);select.onchange=()=>change(Number(select.value));
  group.querySelector('.app-zoom-fit').onclick=()=>{const width=window.innerWidth*(bridge?factor:1),height=window.innerHeight*(bridge?factor:1),target=Math.max(.6,Math.min(1,width/1440,height/860));return change([...steps].reverse().find(value=>value<=target+.001)??.6);};
  if(bridge){
    bridge.onZoomChange?.(value=>{if(!ready&&value.configured===false)return;ready=true;update(value.factor);});
    bridge.getZoom().then(async value=>{const initial=value.configured?value:await bridge.setZoom(preferredFactor);ready=true;update(initial.factor);}).catch(()=>{status.textContent='Zoom controls are unavailable until the desktop app is reopened.';});
  }else{
    document.addEventListener('keydown',event=>{if((!event.ctrlKey&&!event.metaKey)||event.altKey)return;
      if(['+','=','-','_','0'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='0')change(1);else if(['-','_'].includes(event.key))group.querySelector('.app-zoom-out').click();else group.querySelector('.app-zoom-in').click();}
    },true);
  }
  update(factor);
})();
