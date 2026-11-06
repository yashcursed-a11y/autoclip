/* Source-range editor. Edits stay on the source clock and export as separate clips. */
(() => {
  const $=s=>document.querySelector(s),video=$('#previewVideo'),shell=$('#workspace'),viewport=$('.studio-main-viewport'),scroll=$('#tracksLanesScroll'),content=$('#tracksLanesContent');
  if(!video||!shell||!viewport||!scroll)return;
  document.body.classList.add('manual-editor-ready');
  const dock=$('.editor-tools-dock');if(dock)$('.editor-toolbar-left').prepend(dock);
  if($('.editor-workspace-label'))$('.editor-workspace-label').hidden=true;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const prefs={fps:30,snap:true,height:250,...read('autoclip.manual.preferences',{})};
  if(![24,25,29.97,30,50,59.94,60].includes(Number(prefs.fps)))prefs.fps=30;
  prefs.height=Math.max(220,Math.min(440,Number(prefs.height)||250));prefs.snap=!!prefs.snap;
  let jobId=null,marks={start:null,end:null},notes=[],checked=new Set(),sourceMode=false,reverseTimer=null,shuttleRate=0,previewEnd=null;
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  const button=(text,title,action,cls='manual-button')=>{const n=make('button',cls,text);n.type='button';n.title=title;n.setAttribute('aria-label',title);n.onclick=action;return n;};
  const duration=()=>Math.max(0,Number(state.currentJob?.duration)||Number(video.duration)||0);
  const clip=()=>state.currentJob?.clips?.find(c=>c.id===state.activeClipId);
  const frame=()=>1/Number(prefs.fps);
  const clamp=t=>Math.max(0,Math.min(duration(),t));
  const quantize=t=>clamp(Math.round(t*Number(prefs.fps))/Number(prefs.fps));
  const time=t=>{if(!Number.isFinite(t))return '';const ms=Math.round(Math.max(0,t)*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
  const parse=text=>{const value=String(text).trim();if(!value)return null;if(/^\d+(\.\d+)?$/.test(value))return Number(value);const match=value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)$/);if(!match||Number(match[2])>=60||Number(match[3])>=60)return null;return Number(match[1]||0)*3600+Number(match[2])*60+Number(match[3]);};
  const status=make('div','manual-editor-status','Choose a clip or mark a new range.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');$('.full-width-timeline').after(status);
  const say=message=>{status.textContent=message;};
  const retrySave=button('Retry save','Retry saving clip edits',()=>saveClipsToServer());retrySave.classList.add('manual-retry-save');retrySave.hidden=true;$('.editor-toolbar-right').prepend(retrySave);
  const trackedSave=saveClipsToServer;
  saveClipsToServer=async function(...args){const savingJob=state.currentJob?.id;let result;try{result=await trackedSave.apply(this,args);}catch{result=false;}
    if(savingJob===state.currentJob?.id){const recovering=status.dataset.saveError==='true';retrySave.hidden=result!==false;status.dataset.saveError=String(result===false);if(result===false)say('Clip edits could not be saved. Use Retry save when the connection is back.');else if(recovering)say('Clip edits saved.');}
    return result;
  };
  const seek=t=>{if(!state.currentJob)return;video.currentTime=clamp(t);const head=$('#timelinePlayhead');if(head)head.style.left=`${duration()?video.currentTime/duration()*100:0}%`;updateReadouts();};
  const stopReverse=()=>{if(reverseTimer!==null)clearInterval(reverseTimer);reverseTimer=null;shuttleRate=0;};
  const step=(amount=1)=>{stopReverse();video.pause();seek(quantize(video.currentTime+amount*frame()));};
  const persist=()=>{if(jobId)write(`autoclip.manual.${jobId}`,{marks,notes,checked:[...checked]});};
  const refreshPrefs=()=>{write('autoclip.manual.preferences',prefs);shell.style.setProperty('--manual-timeline-height',`${prefs.height}px`);};

  // Source marks create new ranges without replacing the existing clip collection.
  const rangeBar=make('div','manual-range-bar');
  rangeBar.innerHTML='<span class="manual-range-label">SOURCE RANGE</span><label>In<input class="manual-mark-in" type="text" placeholder="00:00:00.000" aria-label="Source range in timecode"></label><label>Out<input class="manual-mark-out" type="text" placeholder="00:00:00.000" aria-label="Source range out timecode"></label><output class="manual-mark-duration">—</output>';
  const rangeIn=rangeBar.querySelector('.manual-mark-in'),rangeOut=rangeBar.querySelector('.manual-mark-out');
  const createRange=button('Create clip','Create a clip from the marked range · Shift+Enter',()=>{
    if(!validRange())return say('Mark an In and Out point first. Out must be after In.');
    createManualClip(marks.start,marks.end);
  },'manual-button manual-primary');rangeBar.append(createRange);$('.capcut-toolbar').after(rangeBar);
  function validRange(){return !!state.currentJob&&Number.isFinite(marks.start)&&Number.isFinite(marks.end)&&marks.start>=0&&marks.end<=duration()+.00001&&marks.end-marks.start>=frame()-.00001;}
  function createManualClip(a,b){
    if(!state.currentJob||b-a<frame()-.00001)return say('Leave at least one grid frame before the end of the source.');
    const c={id:crypto.randomUUID(),start:a,end:b,title:`Manual clip ${(state.currentJob.clips||[]).length+1}`,isManual:true,hook:'',score:0,captionKeywords:[]};
    state.currentJob.clips??=[];state.currentJob.clips.push(c);checked.add(c.id);commit(c.id);say(`Created clip · ${time(c.end-c.start)}`);
  }
  const mark=side=>{if(!state.currentJob)return;marks[side]=quantize(video.currentTime);syncMarks();persist();say(`${side==='start'?'In':'Out'} marked at ${time(marks[side])}`);};
  const syncMarks=()=>{if(document.activeElement!==rangeIn)rangeIn.value=time(marks.start);if(document.activeElement!==rangeOut)rangeOut.value=time(marks.end);createRange.disabled=!validRange();rangeBar.querySelector('output').textContent=validRange()?time(marks.end-marks.start):'—';paintMarkers();};
  for(const [input,side] of [[rangeIn,'start'],[rangeOut,'end']])input.onchange=()=>{const value=parse(input.value);if(value===null||value<0||value>duration()){say('Use seconds or HH:MM:SS.mmm within this recording.');input.value=time(marks[side]);return;}marks[side]=value;syncMarks();persist();};
  $('#setClipInBtn').textContent='Mark in · I';$('#setClipInBtn').onclick=()=>mark('start');
  $('#setClipOutBtn').textContent='Mark out · O';$('#setClipOutBtn').onclick=()=>mark('end');

  // Compact source-clock transport: frame grid is explicit rather than guessed source FPS.
  const transport=make('div','manual-transport-extra');
  const jump=make('input','manual-jump');jump.type='text';jump.setAttribute('aria-label','Jump to source timecode');jump.title='Enter seconds or HH:MM:SS.mmm, then Enter';
  jump.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const t=parse(jump.value);if(t===null||t>duration())say('Enter a valid source timecode.');else{video.pause();seek(t);}}});
  const fps=make('select','manual-fps');fps.setAttribute('aria-label','Frame stepping grid');fps.title='Editing grid; choose the frame rate of your source';
  for(const value of [24,25,29.97,30,50,59.94,60]){const option=make('option','',`${value} fps grid`);option.value=String(value);fps.append(option);}fps.value=String(prefs.fps);fps.onchange=()=>{prefs.fps=Number(fps.value);refreshPrefs();say(`Stepping grid: ${prefs.fps} fps. Match this to your source.`);};
  const rate=make('select','manual-speed');rate.setAttribute('aria-label','Preview playback speed');for(const value of [.25,.5,1,1.5,2,4]){const option=make('option','',`${value}×`);option.value=String(value);rate.append(option);}rate.value='1';rate.onchange=()=>{stopReverse();video.playbackRate=Number(rate.value);};
  transport.append(button('│‹','Jump to selected clip start',()=>seek(clip()?.start??0)),button('‹','Previous grid frame · Left',()=>step(-1)),jump,button('›','Next grid frame · Right',()=>step(1)),button('›│','Jump to selected clip end',()=>seek(clip()?.end??duration())),fps,rate);
  $('.editor-playback').append(transport);

  // A focused inspector for the active cut. Existing caption/framing tools remain below it.
  const trim=make('section','manual-trim-inspector');
  trim.innerHTML='<div class="manual-section-heading"><strong>Selected clip</strong><span class="manual-selected-duration">—</span></div><label>Name<input class="manual-clip-name" type="text" maxlength="160" placeholder="Select a clip"></label><div class="manual-trim-grid"><label>Start<input class="manual-trim-start" type="text" placeholder="00:00:00.000"></label><label>End<input class="manual-trim-end" type="text" placeholder="00:00:00.000"></label></div>';
  const name=trim.querySelector('.manual-clip-name'),start=trim.querySelector('.manual-trim-start'),end=trim.querySelector('.manual-trim-end');
  const applyTrim=button('Apply trim','Apply exact start and end times',()=>{const c=clip(),a=parse(start.value),b=parse(end.value);if(!c)return;if(a===null||b===null||a<0||b>duration()+.00001||b-a<frame()-.00001)return say('Trim needs valid times inside the source, at least one grid frame apart.');c.start=a;c.end=b;commit(c.id);seek(a);say('Trim applied.');});
  const rename=()=>{const c=clip();if(!c)return;c.title=name.value.trim().slice(0,160)||'Untitled clip';commit(c.id);};name.onchange=rename;
  const trimActions=make('div','manual-trim-actions');trimActions.append(applyTrim,button('Preview cut','Play the selected clip from its start',()=>{const c=clip();if(!c)return;previewEnd=null;video.pause();seek(c.start);state.loopActive=false;$('#toggleLoopBtn')?.classList.remove('active');previewEnd=c.end;video.play().catch(()=>{previewEnd=null;say('The source video is not available.');});}));trim.append(trimActions);
  const trimEdges=make('div','manual-edge-controls');trimEdges.append(button('Start −','Extend start by one grid frame',()=>adjustEdge('start',-frame())),button('Start +','Trim start by one grid frame',()=>adjustEdge('start',frame())),button('End −','Trim end by one grid frame',()=>adjustEdge('end',-frame())),button('End +','Extend end by one grid frame',()=>adjustEdge('end',frame())));trim.append(trimEdges);
  $('.inspector-column').prepend(trim);
  // One transport row; marks belong with the timeline rather than over the image.
  const playbackLeft=$('.editor-playback-row .editor-playback-buttons'),playbackGroups=$('.editor-playback-row').querySelectorAll('.editor-playback-buttons'),playbackRight=playbackGroups[playbackGroups.length-1],playButton=$('.editor-play-toggle');
  playbackLeft.insertBefore(transport.querySelector('[aria-label="Previous grid frame · Left"]'),playButton);
  playbackLeft.insertBefore(transport.querySelector('[aria-label="Next grid frame · Right"]'),playButton.nextSibling);
  const sourceTotal=make('span','manual-source-duration');playbackLeft.append(jump,sourceTotal);playbackRight.prepend(rate);
  const gridLabel=make('label','manual-grid-label','Frame stepping grid');gridLabel.append(fps);trim.append(gridLabel);transport.remove();
  function adjustEdge(side,amount){const c=clip();if(!c)return;const value=clamp(c[side]+amount);if(side==='start'?value>c.end-frame()+.00001:value<c.start+frame()-.00001)return;c[side]=value;commit(c.id);seek(value);}
  $('#nudgeBackBtn').onclick=()=>adjustEdge('start',-.5);$('#nudgeFwdBtn').onclick=()=>adjustEdge('end',.5);

  // Small clip bin with explicit export inclusion, independent of active selection.
  const bin=make('div','manual-cut-bin');bin.hidden=true;$('.candidates-column').append(bin);
  const binTab=button('Cuts','Show manual clip collection',()=>{
    $('.editor-source-card').hidden=true;for(const selector of ['.candidates-header','#streamPartsBar','#clipsList'])$(selector)?.classList.add('hidden');
    bin.hidden=false;$('.editor-library-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===binTab)));
  });binTab.setAttribute('role','tab');$('.editor-library-tabs').append(binTab);
  $('.editor-library-tabs').querySelectorAll('button').forEach(b=>{if(b!==binTab)b.addEventListener('click',()=>{bin.hidden=true;});});
  const exportScope=make('select','manual-export-scope');exportScope.setAttribute('aria-label','Clips to export');
  for(const [value,text] of [['all','All clips'],['checked','Checked clips'],['active','Active clip']]){const option=make('option','',text);option.value=value;exportScope.append(option);}
  exportScope.value='all';$('.workspace-controls').insertBefore(exportScope,$('#renderBtn'));
  const exportClean=make('label','manual-clean-export');exportClean.innerHTML='<input type="checkbox"> Clean cuts<small>No captions, teasers, watermark or stickers. Framing still applies.</small>';trim.append(exportClean);
  window.getEditorExportClips=()=>{const all=state.currentJob?.clips||[];return exportScope.value==='active'?all.filter(c=>c.id===state.activeClipId):exportScope.value==='checked'?all.filter(c=>checked.has(c.id)):all;};
  window.getEditorRenderOverrides=()=>exportClean.querySelector('input').checked?{captionsEnabled:false,hookStitcher:false,autoMemes:false,memeSoundEnabled:false,headline:'',watermark:{enabled:false},progressBar:false,overlays:[]}:{};
  const drawBin=()=>{
    const all=state.currentJob?.clips||[];bin.replaceChildren();const head=make('div','manual-bin-heading',`${all.length} clips`);bin.append(head);
    if(!all.length){bin.append(make('p','manual-bin-empty','Mark In and Out in the source, then create your first clip.'));return;}
    all.forEach((c,index)=>{const row=make('div',`manual-cut-row${c.id===state.activeClipId?' active':''}`),check=make('input','');row.dataset.clipId=c.id;check.type='checkbox';check.checked=checked.has(c.id);check.setAttribute('aria-label',`Include ${c.title||'clip '+(index+1)} in checked export`);check.onchange=()=>{if(check.checked)checked.add(c.id);else checked.delete(c.id);persist();};
      const select=button('',`Select ${c.title||'clip '+(index+1)}`,()=>{sourceMode=false;selectClip(c.id,false,c.start);});const title=make('strong','',c.title||`Clip ${index+1}`),bounds=make('small','',`${time(c.start)} → ${time(c.end)}`);select.append(title,bounds);row.append(check,select);bin.append(row);
    });
  };
  const markerLayer=make('div','manual-marker-layer');content.append(markerLayer);
  const markerSection=make('details','manual-marker-section');markerSection.append(make('summary','','Source markers'));const noteList=make('div','manual-marker-list');markerSection.append(noteList);trim.append(markerSection);
  function paintMarkers(){
    if(!markerLayer)return;markerLayer.replaceChildren();
    if(duration()>0&&validRange()){const selection=make('span','manual-marked-range');selection.style.left=`${marks.start/duration()*100}%`;selection.style.width=`${(marks.end-marks.start)/duration()*100}%`;markerLayer.append(selection);}
    notes.forEach(note=>{const n=button('◆',`${note.title} · ${time(note.time)}`,event=>{event.stopPropagation();seek(note.time);},'manual-marker');n.style.left=`${duration()?note.time/duration()*100:0}%`;markerLayer.append(n);});
  }
  const drawNotes=()=>{noteList.replaceChildren();notes.forEach(note=>{const row=make('div','manual-note-row'),label=make('input','');label.value=note.title;label.setAttribute('aria-label','Marker name');label.onchange=()=>{note.title=label.value.trim().slice(0,80)||'Marker';persist();paintMarkers();};row.append(button(time(note.time),`Jump to ${note.title}`,()=>seek(note.time)),label,button('×',`Remove marker ${note.title}`,()=>{notes=notes.filter(n=>n.id!==note.id);persist();drawNotes();paintMarkers();}));noteList.append(row);});if(!notes.length)noteList.append(make('p','','Press M to bookmark a source moment.'));};
  const addMarker=()=>{if(!state.currentJob)return;if(notes.length>=100)return say('This project already has 100 markers.');notes.push({id:crypto.randomUUID(),time:quantize(video.currentTime),title:`Marker ${notes.length+1}`});persist();drawNotes();paintMarkers();say('Source marker added. Rename it in the inspector.');};

  function commit(id=state.activeClipId){renderClipsList();if(id&&(state.currentJob?.clips||[]).some(c=>c.id===id))selectClip(id,false,clamp(video.currentTime));else renderCapCutTimeline();persist();saveClipsToServer();}
  const split=()=>{
    if(!state.currentJob)return;const t=quantize(video.currentTime),all=state.currentJob.clips||[];
    const c=(clip()&&t>clip().start&&t<clip().end)?clip():all.find(c=>t>c.start&&t<c.end);
    if(!c)return say('Place the playhead inside a clip to split it. Mark a range to create a new clip.');
    if(t-c.start<frame()-.00001||c.end-t<frame()-.00001)return say('Leave at least one grid frame on each side of the cut.');
    const a={...JSON.parse(JSON.stringify(c)),id:crypto.randomUUID(),end:t,title:`${c.title||'Clip'} · A`},b={...JSON.parse(JSON.stringify(c)),id:crypto.randomUUID(),start:t,title:`${c.title||'Clip'} · B`};
    if(checked.delete(c.id)){checked.add(a.id);checked.add(b.id);}all.splice(all.indexOf(c),1,a,b);commit(b.id);say(`Split at ${time(t)}`);
  };
  $('#splitAtPlayheadBtn').onclick=split;
  const duplicate=()=>{const c=clip();if(!c)return;const copy=JSON.parse(JSON.stringify(c));copy.id=crypto.randomUUID();copy.title=`${c.title||'Clip'} copy`;state.currentJob.clips.push(copy);checked.add(copy.id);commit(copy.id);say('Clip duplicated at the same source range.');};
  const remove=()=>{const c=clip();if(!c)return;const index=state.currentJob.clips.indexOf(c);state.currentJob.clips.splice(index,1);checked.delete(c.id);state.activeClipId=state.currentJob.clips[Math.min(index,state.currentJob.clips.length-1)]?.id||null;commit();say('Clip removed. Undo restores it.');};
  $('#deleteClipAtPlayheadBtn').onclick=remove;
  const source=()=>{if(!state.currentJob)return;sourceMode=true;state.isManualMode=true;state.loopActive=false;$('#toggleLoopBtn')?.classList.remove('active');$('#modeManualRaw')?.classList.add('active');$('#modeAiClips')?.classList.remove('active');say('Browsing the full source. Existing clips are preserved.');sync();};
  for(const id of ['modeManualRaw','loadMasterVideoBtn']){const n=document.getElementById(id);if(n)n.onclick=source;}
  $('#modeAiClips').onclick=()=>{sourceMode=false;state.isManualMode=false;if(clip())seek(clip().start);sync();};
  $('#restoreAiClipsBtn').onclick=()=>$('#modeAiClips').click();
  const sourceButton=$('.editor-source-card .pill-btn');if(sourceButton)sourceButton.onclick=source;
  $('#loadMasterVideoBtn').title='Browse the original recording without replacing existing cuts';
  $('#modeManualRaw').textContent='Source';$('#modeAiClips').textContent='Clip review';
  $('#modeManualRaw').title='Browse the complete recording; existing clips stay intact';$('#modeAiClips').title='Review the active clip';
  $('#addClipAtPlayheadBtn').title='Create a 30-second clip at the playhead; use marked range for precise cuts';
  const addAtCursor=()=>{const a=quantize(video.currentTime);createManualClip(a,Math.min(duration(),a+30));};
  $('#addClipAtPlayheadBtn').onclick=addAtCursor;if($('#addClipBtn'))$('#addClipBtn').onclick=addAtCursor;

  const snapButton=button('Snap','Snap trim handles to clip edges, markers and playhead · N',()=>{prefs.snap=!prefs.snap;snapButton.setAttribute('aria-pressed',String(prefs.snap));refreshPrefs();});snapButton.setAttribute('aria-pressed',String(prefs.snap));
  const extra=make('details','manual-more-actions');extra.append(make('summary','','More'));
  const trimToCursor=side=>{const c=clip(),t=quantize(video.currentTime);if(!c)return;if(side==='start'?t>c.end-frame()+.00001:t<c.start+frame()-.00001)return say('The trim must leave at least one grid frame.');c[side]=t;commit(c.id);say(`${side==='start'?'Start':'End'} trimmed to cursor.`);};
  const joinNext=()=>{const c=clip();if(!c)return;const next=(state.currentJob.clips||[]).filter(n=>n.id!==c.id&&n.start>=c.end-.00001).sort((a,b)=>a.start-b.start)[0];if(!next||Math.abs(next.start-c.end)>frame()+.00001)return say('Join requires an adjacent cut from the same source, without a gap.');c.end=next.end;state.currentJob.clips=state.currentJob.clips.filter(n=>n.id!==next.id);if(checked.delete(next.id))checked.add(c.id);commit(c.id);say('Adjacent source cuts joined. Undo restores the split.');};
  const extraBody=make('div','manual-more-body');extraBody.append(button('Duplicate clip','Duplicate selected clip · Ctrl+D',duplicate),button('Join next cut','Join adjacent source cuts without a gap',joinNext),button('Trim start to cursor','Trim selected start to playhead · Alt+I',()=>trimToCursor('start')),button('Trim end to cursor','Trim selected end to playhead · Alt+O',()=>trimToCursor('end')),button('Add marker','Add source marker · M',addMarker),button('Zoom to clip','Zoom timeline to selected clip',()=>{
    const c=clip();if(!c)return;const zoom=Math.max(1,Math.min(512,duration()/Math.max(c.end-c.start,frame())*.75));$('#timelineZoomSlider').value=String(zoom);$('#timelineZoomSlider').oninput();scroll.scrollLeft=Math.max(0,(c.start/duration()*zoom-.1)*(scroll.clientWidth||800));
  }),button('Download cut list','Download source timecodes as CSV',()=>{
    const csv=v=>{const text=String(v).replaceAll('"','""');return `"${/^\s*[=+@-]/.test(text)?"'":''}${text}"`;};const rows=[['Clip','Source in','Source out','Duration'],...(state.currentJob?.clips||[]).map(c=>[c.title,time(c.start),time(c.end),time(c.end-c.start)])];
    const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv'})),a=make('a','');a.href=url;a.download='autoclip-cut-list.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }));extra.append(extraBody);$('.ct-left').append(snapButton,extra);
  extraBody.append(button('Jump to clip start','Jump to selected clip start',()=>seek(clip()?.start??0)),button('Jump to clip end','Jump to selected clip end',()=>seek(clip()?.end??duration())));
  for(const id of ['nudgeBackBtn','nudgeFwdBtn','seekStartBtn','loadMasterVideoBtn','restoreAiClipsBtn']){const node=document.getElementById(id);if(node)extraBody.append(node);}
  $('#nudgeBackBtn').textContent='Extend start 0.5s';$('#nudgeFwdBtn').textContent='Extend end 0.5s';
  const shortcutDialog=make('dialog','manual-shortcuts');shortcutDialog.innerHTML='<h2>Manual editing</h2><p>All times refer to the original source. Each cut exports as its own clip.</p><dl><dt>Space</dt><dd>Play / pause</dd><dt>← / →</dt><dd>One grid frame · Shift: ten · Alt: one second</dd><dt>I / O</dt><dd>Mark source range</dd><dt>Shift + Enter</dt><dd>Create clip from marks</dd><dt>S / B</dt><dd>Split / toggle click-to-cut tool</dd><dt>Delete</dt><dd>Remove active clip</dd><dt>Ctrl + D</dt><dd>Duplicate clip</dd><dt>Ctrl + Z / Shift + Z</dt><dd>Undo / redo clip edits</dd><dt>M / N</dt><dd>Add marker / toggle snapping</dd><dt>J / K / L</dt><dd>Reverse (silent) / pause / forward shuttle</dd><dt>Alt + drag clip</dt><dd>Move its source range, preserving duration</dd><dt>Middle drag / wheel</dt><dd>Pan timeline</dd><dt>Ctrl + wheel</dt><dd>Zoom around cursor</dd></dl>';shortcutDialog.append(button('Close','Close keyboard shortcuts',()=>shortcutDialog.close()));document.body.append(shortcutDialog);
  $('.workspace-controls').append(button('Shortcuts','Open editing keyboard shortcuts · ?',()=>shortcutDialog.showModal()));

  const textPreview=button('Captions','Toggle source transcript caption preview',()=>{shell.classList.toggle('manual-caption-preview');textPreview.setAttribute('aria-pressed',String(shell.classList.contains('manual-caption-preview')));updateReadouts();});textPreview.setAttribute('aria-pressed','false');$('.canvas-header-bar').append(textPreview);
  function updateReadouts(){
    if(previewEnd!==null&&video.currentTime>=previewEnd){const end=previewEnd;previewEnd=null;video.pause();video.currentTime=end;}
    if(document.activeElement!==jump)jump.value=time(video.currentTime);
    sourceTotal.textContent=`/ ${time(duration()).slice(0,8)}`;
    if(shell.classList.contains('manual-caption-preview')){
      const segments=state.currentJob?.transcript?.segments||[];let lo=0,hi=segments.length-1,found=null;
      while(lo<=hi){const mid=(lo+hi)>>1,s=segments[mid];if(video.currentTime<s.start)hi=mid-1;else if(video.currentTime>=s.end)lo=mid+1;else{found=s;break;}}
      const text=found?.text||'';if($('#captionPreviewText').textContent!==text)$('#captionPreviewText').textContent=text;
    }
  }
  function sync(){
    shell.classList.toggle('manual-source-browsing',sourceMode);
    const c=clip();if(document.activeElement!==name)name.value=c?.title||'';if(document.activeElement!==start)start.value=c?time(c.start):'';if(document.activeElement!==end)end.value=c?time(c.end):'';
    if(state.currentJob){$('#jobSub').textContent=`${time(duration()).slice(0,8)} source · ${state.currentJob.clips?.length||0} clips · Autosave`;$('#jobTitle').title=state.currentJob.sourceName||'Video project';}
    trim.querySelector('.manual-selected-duration').textContent=c?time(c.end-c.start):'No selection';for(const n of [name,start,end,applyTrim])n.disabled=!c;
    $('#modeManualRaw')?.classList.toggle('active',sourceMode);$('#modeAiClips')?.classList.toggle('active',!sourceMode);
    for(const n of [rangeIn,rangeOut])n.disabled=!state.currentJob;
    drawBin();syncMarks();updateReadouts();
  }
  const originalRender=renderCapCutTimeline;renderCapCutTimeline=function(...args){const result=originalRender.apply(this,args);$('#timelineMarkers')?.querySelectorAll('.timeline-clip-range').forEach(node=>{const c=state.currentJob?.clips?.find(c=>c.id===node.dataset.clipId);if(c)node.querySelector('.clip-range-title').textContent=c.title||'Untitled clip';});paintMarkers();sync();return result;};
  const originalShow=showJob;showJob=function(job,...args){
    if(job?.id!==jobId){jobId=job?.id;retrySave.hidden=true;status.dataset.saveError='false';const stored=read(`autoclip.manual.${jobId}`,{});marks={start:null,end:null,...stored.marks};notes=(Array.isArray(stored.notes)?stored.notes:[]).filter(n=>Number.isFinite(n.time)&&n.time>=0&&n.time<=Number(job?.duration||0)).slice(0,100);checked=new Set(Array.isArray(stored.checked)?stored.checked:(job?.clips||[]).map(c=>c.id));sourceMode=false;state.isManualMode=false;stopReverse();}
    const result=originalShow.call(this,job,...args);sync();drawNotes();setHeight(prefs.height);return result;
  };
  video.addEventListener('timeupdate',updateReadouts);video.addEventListener('seeked',updateReadouts);
  video.addEventListener('pause',()=>{previewEnd=null;});
  video.addEventListener('play',()=>{if(reverseTimer!==null)stopReverse();});

  // Capture edge drags before legacy mouse handlers; one seek per animation frame.
  let drag=null,dragFrame=null;
  const snap=(value,excluded)=>{
    if(!prefs.snap)return value;const width=drag?.rect.width||content.getBoundingClientRect().width||1,threshold=8/width*duration();
    const candidates=[0,duration(),drag?.playhead??video.currentTime,...notes.map(n=>n.time),...(state.currentJob?.clips||[]).filter(c=>c.id!==excluded).flatMap(c=>[c.start,c.end])];
    let best=value,distance=threshold;for(const t of candidates)if(Math.abs(t-value)<distance){best=t;distance=Math.abs(t-value);}return best;
  };
  const applyDrag=()=>{dragFrame=null;if(!drag)return;if(drag.kind==='pan'){scroll.scrollLeft=drag.scrollLeft-(drag.x-drag.origin);return;}
    if(drag.kind==='pending'){if(Math.abs(drag.x-drag.origin)<4)return;drag.kind='move';}
    const c=drag.clip,delta=(drag.x-drag.origin)/Math.max(1,drag.rect.width)*duration(),min=frame();
    if(drag.kind==='move'){let a=Math.max(0,Math.min(duration()-(drag.end-drag.start),snap(quantize(drag.start+delta),c.id)));c.start=a;c.end=a+(drag.end-drag.start);}
    else if(drag.kind==='start')c.start=Math.max(0,Math.min(c.end-min,snap(quantize(drag.start+delta),c.id)));
    else c.end=Math.min(duration(),Math.max(c.start+min,snap(quantize(drag.end+delta),c.id)));
    const el=[...$('#timelineMarkers').children].find(n=>n.dataset.clipId===c.id);if(el){el.style.left=`${c.start/duration()*100}%`;el.style.width=`${(c.end-c.start)/duration()*100}%`;}
    seek(drag.kind==='end'?c.end:c.start);start.value=time(c.start);end.value=time(c.end);
  };
  scroll.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('.clip-range-handle'),range=event.target.closest('.timeline-clip-range');
    if(!state.currentJob||!(event.button===1||(event.button===0&&(handle||range))))return;
    if(scroll.classList.contains('timeline-cut-mode')&&!handle&&!event.altKey&&event.button===0)return;
    event.preventDefault();event.stopImmediatePropagation();video.pause();stopReverse();
    scroll.focus?.({preventScroll:true});
    if(event.button===1)drag={kind:'pan',origin:event.clientX,x:event.clientX,scrollLeft:scroll.scrollLeft};
    else{const c=state.currentJob.clips.find(c=>c.id===(handle||range).dataset.clipId);if(!c)return;selectClip(c.id,false,video.currentTime);drag={kind:handle?.dataset.handle||(event.altKey?'move':'pending'),clip:c,start:c.start,end:c.end,origin:event.clientX,x:event.clientX,playhead:video.currentTime,rect:content.getBoundingClientRect()};}
    scroll.setPointerCapture?.(event.pointerId);
  },true);
  scroll.addEventListener('pointermove',event=>{if(!drag)return;event.preventDefault();event.stopImmediatePropagation();drag.x=event.clientX;if(dragFrame===null)dragFrame=requestAnimationFrame(applyDrag);},true);
  const finishDrag=event=>{if(!drag)return;event.preventDefault();event.stopImmediatePropagation();if(dragFrame!==null)cancelAnimationFrame(dragFrame);drag.x=event.clientX;applyDrag();const finished=drag;drag=null;if(finished.kind==='pending')seek((event.clientX-finished.rect.left)/Math.max(1,finished.rect.width)*duration());else if(finished.kind!=='pan'){commit(finished.clip.id);say(finished.kind==='move'?'Source range moved.':'Source trim updated.');}if(scroll.hasPointerCapture?.(event.pointerId))scroll.releasePointerCapture(event.pointerId);};
  scroll.addEventListener('pointerup',finishDrag,true);
  scroll.addEventListener('pointercancel',event=>{if(!drag)return;event.stopImmediatePropagation();if(dragFrame!==null)cancelAnimationFrame(dragFrame);dragFrame=null;if(drag.clip){drag.clip.start=drag.start;drag.clip.end=drag.end;}drag=null;renderCapCutTimeline();},true);

  // Resize with pointer or keyboard while leaving room for the picture.
  const resize=make('div','manual-timeline-resize');resize.tabIndex=0;resize.setAttribute('role','separator');resize.setAttribute('aria-label','Resize timeline');resize.setAttribute('aria-orientation','horizontal');$('.full-width-timeline').before(resize);
  resize.setAttribute('aria-valuemin','220');resize.setAttribute('aria-valuemax','440');
  function setHeight(value){const layout=$('.studio-layout-capcut'),available=layout.getBoundingClientRect().height/(window.getAppLayoutScale?.()||1)||650;prefs.height=Math.max(220,Math.min(Math.max(220,available-320),value,440));refreshPrefs();resize.setAttribute('aria-valuenow',String(Math.round(prefs.height)));}
  resize.addEventListener('pointerdown',event=>{event.preventDefault();const origin=event.clientY,initial=prefs.height,scale=window.getAppLayoutScale?.()||1;resize.setPointerCapture?.(event.pointerId);const move=e=>setHeight(initial+(origin-e.clientY)/scale),up=()=>{resize.removeEventListener('pointermove',move);resize.removeEventListener('pointerup',up);};resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',up,{once:true});});
  resize.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setHeight(prefs.height+(event.key==='ArrowUp'?20:-20));}});
  window.addEventListener('resize',()=>{if(!$('#studioView').classList.contains('hidden'))setHeight(prefs.height);});
  scroll.addEventListener('scroll',()=>{const headers=$('.tracks-headers-col');if(headers)headers.scrollTop=scroll.scrollTop;},{passive:true});
  scroll.addEventListener('wheel',event=>{if(event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();event.stopImmediatePropagation();scroll.scrollTop+=event.deltaY;}},{capture:true,passive:false});

  document.addEventListener('keydown',event=>{
    if($('#studioView').classList.contains('hidden')||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('.modal-backdrop:not(.hidden),.companion-customize:not([hidden]),dialog[open],.editor-context-menu:not([hidden])'))return;
    const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
    let action=null;
    if(modifier&&key==='d')action=duplicate;
    else if(!modifier&&event.altKey&&key==='i')action=()=>trimToCursor('start');
    else if(!modifier&&event.altKey&&key==='o')action=()=>trimToCursor('end');
    else if(!modifier&&!event.altKey&&key==='s')action=split;
    else if(!modifier&&!event.altKey&&key==='i')action=()=>mark('start');
    else if(!modifier&&!event.altKey&&key==='o')action=()=>mark('end');
    else if(!modifier&&['ArrowLeft','ArrowRight'].includes(event.key))action=()=>event.altKey?(video.pause(),seek(video.currentTime+(event.key==='ArrowLeft'?-1:1))):step((event.key==='ArrowLeft'?-1:1)*(event.shiftKey?10:1));
    else if(!modifier&&!event.altKey&&event.shiftKey&&event.key==='Enter')action=()=>createRange.click();
    else if(!modifier&&!event.altKey&&['Delete','Backspace'].includes(event.key))action=remove;
    else if(!modifier&&!event.altKey&&key==='m')action=addMarker;
    else if(!modifier&&!event.altKey&&key==='n')action=()=>snapButton.click();
    else if(!modifier&&!event.altKey&&event.key==='?')action=()=>shortcutDialog.showModal();
    else if(!modifier&&!event.altKey&&key==='k')action=()=>{stopReverse();video.pause();};
    else if(!modifier&&!event.altKey&&key==='l')action=()=>{const next=shuttleRate>0?Math.min(4,shuttleRate*2):1;stopReverse();shuttleRate=next;video.playbackRate=next;rate.value=String(next);video.play().catch(()=>say('The source video is not available.'));};
    else if(!modifier&&!event.altKey&&key==='j')action=()=>{const next=shuttleRate<0?Math.max(-4,shuttleRate*2):-1;stopReverse();shuttleRate=next;video.pause();state.loopActive=false;reverseTimer=setInterval(()=>{if(document.hidden||$('#studioView').classList.contains('hidden')||video.currentTime<=0){stopReverse();return;}seek(video.currentTime+next*.08);},80);say(`Reverse preview ${Math.abs(next)}× · silent`);};
    if(action){event.preventDefault();event.stopImmediatePropagation();action();}
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReverse();});
  new MutationObserver(()=>{if($('#studioView').classList.contains('hidden'))stopReverse();}).observe($('#studioView'),{attributes:true,attributeFilter:['class']});
  viewport.classList.remove('library-closed','inspector-closed');binTab.click();
  $('.editor-tools-dock .editor-tool')?.setAttribute('aria-pressed','true');$('[aria-label="Show or hide properties"]')?.setAttribute('aria-pressed','true');
  if(state.currentJob)showJob(state.currentJob,false);else sync();
  refreshPrefs();drawNotes();
  if($('.audio-header')){$('.audio-header').textContent='Audio levels';$('.audio-header').title='Relative measured audio energy, when source analysis is available';}
  // Shared actions for mouse menus; the same handlers power the visible controls.
  window.manualEditor={seek,step,split,duplicate,remove,joinNext,trimToCursor,addMarker,mark,createManualClip,
    selected:clip,notify:say,
    select(id){sourceMode=false;selectClip(id,false,video.currentTime);},
    paste(data){if(!state.currentJob||!data)return;const c=JSON.parse(JSON.stringify(data));c.id=crypto.randomUUID();c.title=`${data.title||'Clip'} copy`;c.start=clamp(c.start);c.end=clamp(c.end);if(c.end-c.start<frame())return say('This range does not fit the current source.');state.currentJob.clips.push(c);checked.add(c.id);commit(c.id);},
    rename(){viewport.classList.remove('inspector-closed');$('[aria-label="Show or hide properties"]')?.setAttribute('aria-pressed','true');name.focus();name.select?.();}
  };
})();
