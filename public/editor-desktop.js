/* Desktop mouse model and contextual actions for the source-range editor. */
(() => {
  const api=window.manualEditor,view=document.getElementById('studioView'),scroll=document.getElementById('tracksLanesScroll'),content=document.getElementById('tracksLanesContent'),video=document.getElementById('previewVideo');
  if(!api||!view||!scroll)return;
  document.body.classList.add('desktop-clip-editor');
  scroll.tabIndex=0;scroll.setAttribute('aria-label','Source timeline: click to seek, drag clips to move source ranges, drag edges to trim');
  const menu=document.createElement('div');menu.className='editor-context-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Clip editing actions');document.body.append(menu);
  let returnFocus=null,buffer=null;
  const close=restore=>{if(menu.hidden)return;menu.hidden=true;if(restore){if(returnFocus?.isConnected)returnFocus.focus?.();else scroll.focus?.();}};
  const copy=()=>{const clip=api.selected();if(!clip)return;buffer={job:state.currentJob?.id,clip:JSON.parse(JSON.stringify(clip))};api.notify('Clip copied. Paste duplicate keeps the same source range.');};
  const paste=()=>{if(buffer?.job===state.currentJob?.id)api.paste(buffer.clip);else api.notify('Copy a clip from this project first.');};
  const button=(label,shortcut,action,enabled=true)=>{const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.disabled=!enabled;const title=document.createElement('span');title.textContent=label;const key=document.createElement('kbd');key.textContent=shortcut||'';item.append(title,key);item.onclick=()=>{close(false);action();};return item;};
  const separator=()=>{const line=document.createElement('hr');line.setAttribute('role','separator');return line;};
  const at=(time,action)=>()=>{api.seek(time);action();};
  const timelineTime=clientX=>{const rect=content.getBoundingClientRect();return Math.max(0,Math.min(state.currentJob?.duration||0,(clientX-rect.left)/Math.max(1,rect.width)*(state.currentJob?.duration||0)));};
  const show=(event,items)=>{
    event.preventDefault();returnFocus=document.activeElement;menu.replaceChildren(...items);menu.hidden=false;
    const width=menu.offsetWidth||258,height=menu.offsetHeight||Math.min(450,items.length*30),scale=window.getAppLayoutScale?.()||1,viewport=window.getAppViewport?.()||{width:window.innerWidth,height:window.innerHeight};
    menu.style.left=`${Math.max(6,Math.min(event.clientX/scale,viewport.width-width-6))}px`;
    menu.style.top=`${Math.max(6,Math.min(event.clientY/scale,viewport.height-height-6))}px`;
    menu.querySelector('button:not(:disabled)')?.focus();
  };
  view.addEventListener('contextmenu',event=>{
    if(event.target.closest('input,textarea,select,[contenteditable=true]')||!state.currentJob)return;
    const target=event.target.closest('.timeline-clip-range,.manual-cut-row,.candidate-card'),inTimeline=!!event.target.closest('#tracksLanesScroll'),inPlayer=!!event.target.closest('#videoContainer'),inBin=!!event.target.closest('.candidates-column');
    if(!target&&!inTimeline&&!inPlayer&&!inBin)return;
    video.pause();
    const t=inTimeline?timelineTime(event.clientX):video.currentTime;
    if(target?.dataset.clipId)api.select(target.dataset.clipId);
    const clip=target?api.selected():null,canPaste=buffer?.job===state.currentJob.id;
    if(clip){
      const grid=1/Number(document.querySelector('.manual-fps')?.value||30),canSplit=t>=clip.start+grid&&t<=clip.end-grid;
      show(event,[button(inTimeline?'Split here':'Split at playhead','S',at(t,api.split),canSplit),button('Rename','',api.rename),separator(),button('Copy clip','Ctrl+C',copy),button('Paste duplicate','Ctrl+V',paste,canPaste),button('Duplicate','Ctrl+D',api.duplicate),button('Join adjacent cut','',api.joinNext),separator(),button('Trim start here','Alt+I',at(t,()=>api.trimToCursor('start')),t<clip.end),button('Trim end here','Alt+O',at(t,()=>api.trimToCursor('end')),t>clip.start),button('Zoom to clip','',()=>document.querySelector('[aria-label="Zoom timeline to selected clip"]')?.click()),separator(),button('Export this clip','',()=>{document.querySelector('.manual-export-scope').value='active';document.getElementById('renderBtn').click();},!document.getElementById('renderBtn').disabled),button('Delete clip','Del',api.remove)]);
    }else if(inTimeline){
      show(event,[button('Set playhead here','',()=>api.seek(t)),button('Mark in here','I',at(t,()=>api.mark('start'))),button('Mark out here','O',at(t,()=>api.mark('end'))),button('Create clip from marks','Shift+Enter',()=>document.querySelector('.manual-range-bar .manual-primary').click(),!document.querySelector('.manual-range-bar .manual-primary').disabled),separator(),button('New 30-second clip here','',()=>api.createManualClip(t,Math.min(state.currentJob.duration,t+30))),button('Add marker here','M',at(t,api.addMarker)),button('Paste duplicate','Ctrl+V',paste,canPaste),separator(),button('Fit full source','',()=>document.querySelector('[aria-label="Fit full recording"]')?.click())]);
    }else if(inBin){
      show(event,[button('Browse source recording','',()=>document.getElementById('modeManualRaw').click()),button('Create clip from marks','Shift+Enter',()=>document.querySelector('.manual-range-bar .manual-primary').click(),!document.querySelector('.manual-range-bar .manual-primary').disabled),button('Paste duplicate','Ctrl+V',paste,canPaste),separator(),button('Open another recording','',()=>window.switchAppView('ingest'))]);
    }else{
      show(event,[button('Play / pause','Space',()=>document.querySelector('.editor-play-toggle')?.click()),button('Previous grid frame','←',()=>api.step(-1)),button('Next grid frame','→',()=>api.step(1)),separator(),button('Mark in','I',()=>api.mark('start')),button('Mark out','O',()=>api.mark('end')),button('Add marker','M',api.addMarker),button('Fullscreen','',()=>document.querySelector('[aria-label="Fullscreen preview"]')?.click())]);
    }
  });
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))close(false);},true);
  scroll.addEventListener('scroll',()=>close(false),{passive:true});window.addEventListener('resize',()=>close(false));
  scroll.addEventListener('pointerdown',event=>{if(event.button===0&&!event.target.closest('button,input,textarea,select'))scroll.focus?.({preventScroll:true});},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close(false);});
  new MutationObserver(()=>{if(view.classList.contains('hidden'))close(false);}).observe(view,{attributes:true,attributeFilter:['class']});
  menu.addEventListener('keydown',event=>{
    const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    else if(event.key==='Tab'){event.preventDefault();close(true);}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'){event.preventDefault();copy();close(false);}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'){event.preventDefault();paste();close(false);}
  });
  const cut=document.querySelector('.timeline-cut-tool'),toolbar=document.querySelector('.ct-left');
  const select=document.createElement('button');select.type='button';select.className='ct-btn desktop-select-tool';select.textContent='Select · V';select.title='Select and move source ranges · V';toolbar.prepend(select);
  select.onclick=()=>{if(scroll.classList.contains('timeline-cut-mode'))cut.click();};
  const updateTools=()=>select.setAttribute('aria-pressed',String(!scroll.classList.contains('timeline-cut-mode')));new MutationObserver(updateTools).observe(scroll,{attributes:true,attributeFilter:['class']});updateTools();
  document.addEventListener('keydown',event=>{
    if(view.classList.contains('hidden')||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('.modal-backdrop:not(.hidden),.companion-customize:not([hidden]),dialog[open]'))return;
    if(!menu.hidden)return;
    const key=event.key.toLowerCase();
    if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.code==='Space'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();document.querySelector('.editor-play-toggle')?.click();}
    else if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&key==='c'){event.preventDefault();event.stopImmediatePropagation();copy();}
    else if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&key==='v'){event.preventDefault();event.stopImmediatePropagation();paste();}
    else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&key==='v'){event.preventDefault();select.click();}
  },true);
})();
