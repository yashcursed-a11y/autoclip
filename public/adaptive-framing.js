/* Visual framing rehearsal uses the existing decoder, not a second video player. */
(() => {
  const $=s=>document.querySelector(s),video=$('#previewVideo'),stage=$('#videoContainer');
  if(!video||!stage)return;
  const modes=[['adaptive','Adaptive people framing'],['duo_auto','Two-person stack (detected faces)'],['group_fit','Group / full picture centered']];
  for(const id of ['framingPresetSelect','editFramingMode']){
    const select=document.getElementById(id);
    if(!select)continue;
    for(const [value,label] of modes){const option=document.createElement('option');option.value=value;option.textContent=label;select.prepend(option);}
    const auto=select.querySelector('option[value="auto"]');if(auto)auto.textContent='Auto: people analysis / gaming layout';
  }
  if(!state.currentJob){state.framing.mode='adaptive';$('#framingPresetSelect').value='adaptive';$('#editFramingMode').value='adaptive';}
  const controls=document.createElement('section');controls.className='adaptive-framing-controls';
  controls.innerHTML=`<div class="adaptive-heading">Adaptive director <span>LOCAL</span></div>
    <p>One person: focus. Two people: stack or follow the visible speaker. Three or more: preserve the full picture.</p>
    <p class="adaptive-caveat">Speaker activity is estimated from mouth movement. Review the result, especially for overlapping speech.</p>
    <button type="button" class="pill-btn primary-pill adaptive-analyze">Analyze selected clip</button>
    <label class="check-inline"><input type="checkbox" class="adaptive-preview-toggle"> Preview detected layout</label>
    <div class="adaptive-analysis-status" role="status">Choose a clip, then analyze it. Exports analyze adaptive layouts automatically.</div>
    <div class="adaptive-shots"></div>`;
  $('#subFraming .sub-grid').prepend(controls);
  const textControls=document.createElement('section');textControls.className='adaptive-framing-controls';
  textControls.innerHTML=`<div class="adaptive-heading">Smart text <span>TRANSCRIPT</span></div>
    <label class="check-inline"><input type="checkbox" class="smart-text-enabled"> Add emphasis callouts to exports</label>
    <p>Brief phrases from the transcript, placed separately from subtitles. Edit or remove every suggestion before exporting.</p>
    <label>Frequency<select class="smart-text-density"><option value="subtle">Subtle</option><option value="balanced">Balanced</option><option value="punchy">Frequent</option></select></label>
    <label>Appearance<select class="smart-text-style"><option value="pill">Dark pill</option><option value="headline">Clean headline</option></select></label>
    <button type="button" class="pill-btn smart-text-generate">Suggest text for this clip</button>
    <div class="smart-text-status" role="status">Suggestions use the transcript, not random invented claims.</div>
    <div class="smart-text-list"></div>`;
  $('#subCaptions .sub-grid').prepend(textControls);
  const preview=document.createElement('div');preview.className='adaptive-preview-wrap';preview.hidden=true;
  const canvas=document.createElement('canvas');canvas.className='adaptive-preview-canvas';
  canvas.setAttribute('aria-label','Detected framing preview');preview.append(canvas);
  const callout=document.createElement('div');callout.className='smart-text-preview';callout.hidden=true;preview.append(callout);stage.append(preview);
  const ctx=canvas.getContext('2d',{alpha:false});
  let currentPlan=null,currentKey='',previewEnabled=false,frameId=null,rafId=null,lastDraw=0;
  const cache=new Map();
  const activeClip=()=>state.currentJob?.clips?.find(c=>c.id===state.activeClipId);
  const key=()=>{const c=activeClip();return `${state.currentJob?.id}:${c?.id}:${c?.start}:${c?.end}:${state.framing?.aspectRatio}:${state.framing?.mode}`;};
  const selectedMode=()=>['adaptive','duo_auto','group_fit'].includes(state.framing?.mode)?state.framing.mode:'adaptive';
  const resize=()=>{
    const aspect=state.framing?.aspectRatio || '9:16';const [w,h]=aspect.split(':').map(Number);const ratio=w/h;
    canvas.width=ratio>1?720:Math.round(720*ratio);canvas.height=ratio>1?Math.round(720/ratio):720;
    const availableW=Math.max(1,stage.clientWidth-24),availableH=Math.max(1,stage.clientHeight-16);
    const width=Math.min(availableW,availableH*ratio);preview.style.width=`${width}px`;preview.style.height=`${width/ratio}px`;
  };
  new ResizeObserver(resize).observe(stage);
  const draw=()=>{
    const clip=activeClip();const valid=previewEnabled&&currentPlan&&currentKey===key();
    const t=video.currentTime-(clip?.start || 0);
    const item=state.currentJob?.options?.smartTextEnabled?(clip?.smartText || []).find(c=>c.enabled!==false&&t>=c.start&&t<c.end):null;
    preview.hidden=!valid&&!item;canvas.hidden=!valid;preview.style.background=valid?'#0a0c10':'transparent';
    stage.classList.toggle('has-adaptive-preview',Boolean(valid));
    callout.hidden=!item;if(item)callout.textContent=item.text;
    callout.classList.toggle('headline',state.currentJob?.options?.smartTextStyle==='headline');
    if(!valid||!ctx||video.readyState<2)return;
    const segment=currentPlan.segments.find(s=>t>=s.start&&t<s.end) || currentPlan.segments[0];
    ctx.fillStyle='#0a0c10';ctx.fillRect(0,0,canvas.width,canvas.height);
    const place=(c,y,h)=>ctx.drawImage(video,c.x,c.y,c.width,c.height,0,y,canvas.width,h);
    if(segment.layout==='single')place(segment.crops[0],0,canvas.height);
    else if(segment.layout==='duo'){place(segment.crops[0],0,canvas.height/2);place(segment.crops[1],canvas.height/2,canvas.height/2);}
    else{
      if(state.currentJob?.options?.autoFramingBackground==='blur'){
        const cover=Math.max(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
        const bw=video.videoWidth*cover,bh=video.videoHeight*cover;
        ctx.save();ctx.filter='blur(10px)';ctx.drawImage(video,(canvas.width-bw)/2,(canvas.height-bh)/2,bw,bh);ctx.restore();
      }
      const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
      const w=video.videoWidth*scale,h=video.videoHeight*scale;
      ctx.drawImage(video,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    }
  };
  const stop=()=>{if(frameId!==null)video.cancelVideoFrameCallback?.(frameId);if(rafId!==null)cancelAnimationFrame(rafId);frameId=null;rafId=null;};
  const running=()=>previewEnabled&&currentPlan&&currentKey===key()&&!video.paused&&!document.hidden&&!$('#studioView').classList.contains('hidden');
  const tick=now=>{frameId=null;rafId=null;if(!running())return;if(now-lastDraw>=40){draw();lastDraw=now;}schedule();};
  const schedule=()=>{if(!running()||frameId!==null||rafId!==null)return;if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(tick);else rafId=requestAnimationFrame(tick);};
  video.addEventListener('play',schedule);video.addEventListener('pause',()=>{stop();draw();});
  video.addEventListener('seeked',draw);video.addEventListener('loadeddata',draw);
  video.addEventListener('timeupdate',()=>{if(!running())draw();});
  document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden)schedule();});
  new MutationObserver(()=>{stop();if(!$('#studioView').classList.contains('hidden')){draw();schedule();}}).observe($('#studioView'),{attributes:true,attributeFilter:['class']});
  const toggle=controls.querySelector('.adaptive-preview-toggle');
  toggle.onchange=()=>{previewEnabled=toggle.checked;resize();stop();draw();schedule();};
  const status=controls.querySelector('.adaptive-analysis-status'),shots=controls.querySelector('.adaptive-shots');
  const renderShots=()=>{
    shots.replaceChildren();
    for(const seg of currentPlan?.segments || []){
      const row=document.createElement('button');row.type='button';row.className='adaptive-shot';
      const label={single:'Speaker focus',duo:'Two-person stack',fit:'Full picture'}[seg.layout];
      row.textContent=`${seg.start.toFixed(1)}–${seg.end.toFixed(1)}s · ${label}`;
      row.onclick=()=>{const c=activeClip();if(c)video.currentTime=c.start+seg.start;};shots.append(row);
    }
  };
  const enabled=textControls.querySelector('.smart-text-enabled'),density=textControls.querySelector('.smart-text-density'),style=textControls.querySelector('.smart-text-style');
  const list=textControls.querySelector('.smart-text-list'),textStatus=textControls.querySelector('.smart-text-status');
  const save=()=>{if(state.currentJob)saveClipsToServer();};
  const syncOptions=()=>{
    if(!state.currentJob)return;
    state.currentJob.options={...state.currentJob.options,smartTextEnabled:enabled.checked,smartTextDensity:density.value,smartTextStyle:style.value};save();draw();
  };
  enabled.onchange=syncOptions;style.onchange=syncOptions;density.onchange=syncOptions;
  const renderText=()=>{
    list.replaceChildren();const clip=activeClip();
    for(const item of clip?.smartText || []){
      const row=document.createElement('div');row.className='smart-text-row';
      const input=document.createElement('input');input.type='text';input.maxLength=64;input.value=item.text;input.setAttribute('aria-label',`Callout at ${item.start} seconds`);
      input.onchange=()=>{item.text=input.value;save();draw();};
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove callout');remove.onclick=()=>{clip.smartText=clip.smartText.filter(c=>c!==item);save();renderText();draw();};
      const time=document.createElement('small');time.textContent=`${item.start.toFixed(1)}s`;row.append(time,input,remove);list.append(row);
    }
  };
  const analyze=async(includeText=false)=>{
    const clip=activeClip(),job=state.currentJob;if(!clip||!job){status.textContent='Select a clip first.';return;}
    if(!['adaptive','duo_auto','group_fit'].includes(state.framing.mode)){
      state.framing.mode='adaptive';$('#editFramingMode').value='adaptive';$('#framingPresetSelect').value='adaptive';
      job.options={...job.options,framingMode:'adaptive'};save();
    }
    const requestKey=key(),button=controls.querySelector('.adaptive-analyze');button.disabled=true;
    status.textContent='Analyzing sampled frames locally…';textStatus.textContent=includeText?'Reading transcript highlights…':textStatus.textContent;
    try{
      let result=cache.get(requestKey+':'+density.value);
      if(!result){const res=await fetch(`/api/jobs/${encodeURIComponent(job.id)}/framing-plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clipId:clip.id,start:clip.start,end:clip.end,mode:selectedMode(),aspect:state.framing?.aspectRatio || '9:16',density:density.value})});result=await res.json();if(!res.ok)throw new Error(result.error || 'Analysis failed.');cache.set(requestKey+':'+density.value,result);if(cache.size>20)cache.delete(cache.keys().next().value);}
      if(requestKey!==key())return;
      currentPlan=result.plan;currentKey=requestKey;
      status.textContent=`${currentPlan.segments.length} shots · ${currentPlan.sampleCount} sampled frames. ${currentPlan.warning}`;
      if(includeText){clip.smartText=result.callouts;save();renderText();textStatus.textContent=clip.smartText.length?`${clip.smartText.length} suggestions. Edit or remove them below.`:'No strong transcript phrases found. Subtitles will still work.';}
      renderShots();previewEnabled=true;toggle.checked=true;resize();draw();schedule();
    }catch(error){status.textContent=error.message;if(includeText)textStatus.textContent=error.message;}
    finally{button.disabled=false;}
  };
  controls.querySelector('.adaptive-analyze').onclick=()=>analyze(false);
  textControls.querySelector('.smart-text-generate').onclick=async event=>{
    const clip=activeClip(),job=state.currentJob;if(!clip||!job){textStatus.textContent='Select a clip first.';return;}
    const button=event.currentTarget;button.disabled=true;textStatus.textContent='Reading transcript highlights…';
    try{
      const res=await fetch(`/api/jobs/${encodeURIComponent(job.id)}/smart-text`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clipId:clip.id,start:clip.start,end:clip.end,density:density.value})});
      const result=await res.json();if(!res.ok)throw new Error(result.error || 'Text suggestions failed.');
      if(state.currentJob!==job)return;
      clip.smartText=result.callouts;save();
      if(activeClip()===clip){renderText();resize();draw();textStatus.textContent=result.callouts.length?`${result.callouts.length} suggestions. Edit or remove them below.`:'No strong phrases found in this clip’s transcript.';}
    }catch(error){textStatus.textContent=error.message;}finally{button.disabled=false;}
  };
  const refresh=()=>{
    stop();currentPlan=null;currentKey='';previewEnabled=false;toggle.checked=false;preview.hidden=true;stage.classList.remove('has-adaptive-preview');shots.replaceChildren();
    $('#gamingSplitPreviewHud')?.classList.toggle('hidden',state.framing.mode!=='gaming_split');
    $('#podcastStackPreviewHud')?.classList.toggle('hidden',state.framing.mode!=='face_stack');
    enabled.checked=state.currentJob?.options?.smartTextEnabled===true;density.value=state.currentJob?.options?.smartTextDensity || 'subtle';style.value=state.currentJob?.options?.smartTextStyle || 'pill';
    renderText();status.textContent='Analyze this clip to preview detected framing.';
    textStatus.textContent=activeClip()?.smartText?.length?`${activeClip().smartText.length} editable callouts for this clip.`:'Suggest transcript-based text, or leave callouts off.';
  };
  const originalSelect=selectClip;selectClip=function(...args){const result=originalSelect.apply(this,args);refresh();return result;};
  ['editFramingMode','editAspect','framingPresetSelect','aspectRatio'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{
    if(state.currentJob && state.scheduler?.activeView!=='ingest'){state.currentJob.options={...state.currentJob.options,framingMode:state.framing.mode,aspectRatio:state.framing.aspectRatio};save();}
    refresh();
  }));
  refresh();
})();
