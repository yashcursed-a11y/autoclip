/* Timeline interaction: pixel-aware ruler, anchored zoom and click-to-cut. */
(() => {
  const $=s=>document.querySelector(s),scroll=$('#tracksLanesScroll'),content=$('#tracksLanesContent'),slider=$('#timelineZoomSlider'),video=$('#previewVideo');
  if(!scroll||!content||!slider||!video)return;
  slider.min='1';slider.max='512';slider.step='.1';
  let cutMode=false,drawFrame=null,seekFrame=null,pendingX=null,drag=null;
  const duration=()=>Math.max(1,Number(state.currentJob?.duration)||Number(video.duration)||1);
  const baseWidth=()=>Math.max(1,Number(scroll.clientWidth)||800);
  const zoom=()=>Math.max(1,Number(slider.value)||1);
  const timeLabel=value=>{
    const h=Math.floor(value/3600),m=Math.floor(value/60)%60,s=Math.floor(value%60);
    return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  };
  const ruler=()=>{
    const lane=$('#rulerLane');if(!lane)return;
    const fullWidth=baseWidth()*zoom(),pps=fullWidth/duration();
    const intervals=[.05,.1,.2,.5,1,2,5,10,15,30,60,120,300,600,900,1800,3600,7200];
    const interval=intervals.find(n=>n*pps>=90)||14400;
    const first=Math.max(0,Math.floor(scroll.scrollLeft/pps/interval)-1);
    const last=Math.min(Math.floor(duration()/interval),Math.ceil((scroll.scrollLeft+baseWidth())/pps/interval)+1);
    const fragment=document.createDocumentFragment();
    for(let i=first;i<=last;i++){
      const t=i*interval,tick=document.createElement('div');tick.className='ruler-tick';tick.style.left=`${t/duration()*100}%`;
      const label=document.createElement('span');label.className='ruler-time-label';label.textContent=interval<1?`${t.toFixed(interval<.1?2:1)}s`:timeLabel(t);tick.append(label);fragment.append(tick);
    }
    lane.replaceChildren(fragment);
  };
  const scheduleRuler=()=>{if(drawFrame===null)drawFrame=requestAnimationFrame(()=>{drawFrame=null;ruler();});};
  const originalRender=renderCapCutTimeline;
  renderCapCutTimeline=function(...args){const result=originalRender.apply(this,args);ruler();return result;};
  const toolbar=$('.capcut-toolbar .ct-left');
  const cut=document.createElement('button');cut.type='button';cut.className='ct-btn timeline-cut-tool';cut.textContent='Cut tool · B';cut.title='Enable cut tool, then click a clip to split it';cut.setAttribute('aria-pressed','false');
  const setCut=value=>{cutMode=value;cut.setAttribute('aria-pressed',String(value));scroll.classList.toggle('timeline-cut-mode',value);};
  cut.onclick=()=>setCut(!cutMode);toolbar?.prepend(cut);
  const zoomGroup=document.querySelector('.ct-zoom-wrap');
  const makeButton=(label,text,action)=>{const button=document.createElement('button');button.type='button';button.className='ct-btn timeline-zoom-button';button.setAttribute('aria-label',label);button.title=label;button.textContent=text;button.onclick=action;return button;};
  const setZoom=(value,anchor=baseWidth()/2)=>{
    const old=zoom(),next=Math.round(Math.max(1,Math.min(512,value))*10)/10;
    const fraction=(scroll.scrollLeft+anchor)/(baseWidth()*old);
    slider.value=String(next);content.style.width=`${next*100}%`;
    scroll.scrollLeft=Math.max(0,fraction*baseWidth()*next-anchor);ruler();
  };
  zoomGroup?.prepend(makeButton('Zoom out','−',()=>setZoom(zoom()/1.5)));
  zoomGroup?.append(makeButton('Zoom in','+',()=>setZoom(zoom()*1.5)),makeButton('Fit full recording','Fit',()=>{setZoom(1);scroll.scrollLeft=0;ruler();}));
  slider.title='Timeline zoom · Ctrl + mouse wheel';slider.oninput=()=>{content.style.width=`${zoom()*100}%`;ruler();};
  const hint=document.createElement('span');hint.className='timeline-mouse-hint';hint.textContent='Wheel: scroll · Ctrl + wheel: zoom · B: cut';$('.capcut-toolbar')?.after(hint);
  scroll.addEventListener('wheel',event=>{
    event.preventDefault();
    if(event.ctrlKey||event.metaKey||event.altKey){const rect=scroll.getBoundingClientRect();setZoom(zoom()*Math.exp(-event.deltaY*.003),Math.max(0,Math.min(baseWidth(),(event.clientX-rect.left)/(window.getAppLayoutScale?.()||1))));}
    else{const unit=event.deltaMode===1?20:event.deltaMode===2?baseWidth():1;scroll.scrollLeft+=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*unit;scheduleRuler();}
  },{passive:false});
  scroll.addEventListener('scroll',scheduleRuler,{passive:true});new ResizeObserver(scheduleRuler).observe(scroll);
  const ghost=document.createElement('div');ghost.className='timeline-hover-position';ghost.hidden=true;const ghostTime=document.createElement('span');ghost.append(ghostTime);content.append(ghost);
  const timeAt=x=>{const rect=drag?.rect||content.getBoundingClientRect();return Math.max(0,Math.min(duration(),(x-rect.left)/Math.max(1,rect.width)*duration()));};
  const seek=x=>{
    const t=timeAt(x);video.currentTime=t;
    const playhead=$('#timelinePlayhead');if(playhead)playhead.style.left=`${t/duration()*100}%`;
    return t;
  };
  const flushSeek=()=>{seekFrame=null;if(pendingX!==null){seek(pendingX);pendingX=null;}};
  scroll.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.clip-range-handle,button,input')||!state.currentJob)return;
    event.preventDefault();const t=timeAt(event.clientX),clip=event.target.closest('.timeline-clip-range');
    const playing=!video.paused;video.pause();
    if(clip?.dataset.clipId)selectClip(clip.dataset.clipId,false,t);
    else video.currentTime=t;
    const head=$('#timelinePlayhead');if(head)head.style.left=`${t/duration()*100}%`;
    drag={startX:event.clientX,clipId:clip?.dataset.clipId,playing,moved:false,rect:content.getBoundingClientRect()};
    scroll.setPointerCapture?.(event.pointerId);
  });
  scroll.addEventListener('pointermove',event=>{
    const t=timeAt(event.clientX);ghost.hidden=false;ghost.style.left=`${t/duration()*100}%`;ghostTime.textContent=timeLabel(t);
    if(!drag)return;
    drag.moved=drag.moved||Math.abs(event.clientX-drag.startX)>3;
    pendingX=event.clientX;if(seekFrame===null)seekFrame=requestAnimationFrame(flushSeek);
  });
  const finish=event=>{
    if(!drag)return;
    if(seekFrame!==null)cancelAnimationFrame(seekFrame);pendingX=event.clientX;flushSeek();
    const previous=drag;drag=null;
    if(cutMode&&previous.clipId&&!previous.moved)$('#splitAtPlayheadBtn')?.click();
    else if(previous.playing)video.play().catch(()=>{});
    if(scroll.hasPointerCapture?.(event.pointerId))scroll.releasePointerCapture(event.pointerId);
  };
  scroll.addEventListener('pointerup',finish);
  scroll.addEventListener('pointercancel',()=>{drag=null;pendingX=null;if(seekFrame!==null)cancelAnimationFrame(seekFrame);seekFrame=null;});
  scroll.addEventListener('pointerleave',()=>{if(!drag)ghost.hidden=true;});
  // Do not allow the legacy click handler to jump back to the clip's start.
  scroll.addEventListener('click',event=>{if(!event.target.closest('.clip-range-handle,button,input')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event=>{
    if($('#studioView').classList.contains('hidden')||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('.modal-backdrop:not(.hidden),.companion-customize:not([hidden]),dialog[open],.editor-context-menu:not([hidden])'))return;
    if(event.key.toLowerCase()==='b'){event.preventDefault();setCut(!cutMode);}else if(event.key==='Escape')setCut(false);
  });
  ruler();
})();
