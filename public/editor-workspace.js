/* AutoClip Edit. Reuses original nodes and editing actions, including their IDs. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const shell = $('#workspace'), viewport = $('.studio-main-viewport');
  const video = $('#previewVideo');
  if (!shell || !viewport || !video) return;
  shell.classList.add('editor-shell');
  // Keep the player large on entry. Properties open only when a tool is chosen.
  viewport.classList.add('inspector-closed');
  const icons = {
    library:'M3 5h18v15H3zM3 9h18M8 9v11',
    play:'m9 5 11 7-11 7V5Z',pause:'M8 5v14M16 5v14',
    back:'M5 5v14M19 5 7 12l12 7V5Z',next:'M19 5v14M5 5l12 7-12 7V5Z',
    undo:'M9 5 3 10l6 5M3 10h11a6 6 0 0 1 0 12',redo:'m15 5 6 5-6 5M21 10H10a6 6 0 0 0 0 12',
    focus:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
    volume:'M4 9h4l5-5v16l-5-5H4V9ZM17 8a7 7 0 0 1 0 8M20 5a11 11 0 0 1 0 14',
    panel:'M3 4h18v16H3zM15 4v16',film:'M3 4h18v16H3zM8 4v16M3 9h5M3 15h5',
    close:'m6 6 12 12M18 6 6 18'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.film}"/></svg>`;
  const button = (label,icon,action,cls='editor-icon-btn') => {
    const el = document.createElement('button'); el.type='button'; el.className=cls;
    el.setAttribute('aria-label',label); el.title=label; el.innerHTML=svg(icon);
    el.addEventListener('click',action); return el;
  };

  // A dedicated tool strip frees the player from editing controls.
  const tools = document.createElement('div');tools.className='editor-toolbar';
  const left = document.createElement('div'); left.className='editor-toolbar-left';
  const right = document.createElement('div'); right.className='editor-toolbar-right';
  const libraryToggle = button('Show or hide media library','library',() => {
    viewport.classList.toggle('library-closed');
    libraryToggle.setAttribute('aria-pressed',String(!viewport.classList.contains('library-closed')));
  },'editor-tool');
  libraryToggle.insertAdjacentText('beforeend','Media');libraryToggle.setAttribute('aria-pressed','true');
  left.append(libraryToggle);
  const separator=document.createElement('span');separator.className='editor-toolbar-divider';left.append(separator);
  const tabs=$('.editor-tabs');
  if(tabs) {
    const labels={captions:'Text',framing:'Frame',watermark:'Brand',overlays:'Overlays',transcript:'Transcript'};
    tabs.querySelectorAll('button').forEach(tab=>{
      tab.textContent=labels[tab.dataset.subtab] || tab.textContent;
      tab.addEventListener('click',()=>{
        viewport.classList.remove('inspector-closed');viewport.classList.add('mobile-inspector');
        inspectorToggle.setAttribute('aria-pressed','true');
        inspectorTitle.textContent=`${labels[tab.dataset.subtab] || 'Clip'} properties`;
      });
    });left.append(tabs);
  }
  const saveStatus=document.createElement('span'); saveStatus.className='editor-save-status';saveStatus.textContent='Ready to edit';saveStatus.setAttribute('role','status');
  const undoBtn=button('Undo clip edit · Ctrl+Z','undo',()=>restoreHistory(-1));
  const redoBtn=button('Redo clip edit · Ctrl+Shift+Z','redo',()=>restoreHistory(1));
  const inspectorToggle=button('Show or hide properties','panel',()=>{
    viewport.classList.toggle('inspector-closed');viewport.classList.toggle('mobile-inspector',!viewport.classList.contains('inspector-closed'));
    inspectorToggle.setAttribute('aria-pressed',String(!viewport.classList.contains('inspector-closed')));
  });inspectorToggle.setAttribute('aria-pressed','false');
  const focusBtn=button('Focus player · F','focus',()=>{
    shell.classList.toggle('is-focus');focusBtn.setAttribute('aria-pressed',String(shell.classList.contains('is-focus')));
  });focusBtn.setAttribute('aria-pressed','false');
  right.append(saveStatus,undoBtn,redoBtn,inspectorToggle,focusBtn);tools.append(left,right);
  $('.workspace-header').after(tools);

  // This stays inside the enlarged player, even when the toolbar is hidden.
  const returnToEditor=document.createElement('button');
  returnToEditor.type='button';returnToEditor.className='editor-return-button';
  returnToEditor.textContent='← Back to editor';
  returnToEditor.addEventListener('click',async()=>{
    if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    shell.classList.remove('is-focus');focusBtn.setAttribute('aria-pressed','false');
  });
  $('#videoContainer').append(returnToEditor);
  const cinemaBack=document.createElement('button');cinemaBack.type='button';
  cinemaBack.className='pill-btn cinema-return-button';cinemaBack.textContent='← Back to editor';
  cinemaBack.addEventListener('click',async()=>{
    if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    $('#cinemaVideo')?.pause();
    window.switchAppView('studio');
  });
  $('.cinema-top-bar')?.prepend(cinemaBack);
  const cinemaFullscreenBack=cinemaBack.cloneNode(true);
  cinemaFullscreenBack.className='editor-return-button cinema-fullscreen-return';
  cinemaFullscreenBack.addEventListener('click',()=>cinemaBack.click());
  $('#cinemaVideoContainer')?.append(cinemaFullscreenBack);

  const inspectorTitle=document.createElement('strong');inspectorTitle.textContent='Text properties';
  const inspectorHead=document.createElement('div');inspectorHead.className='editor-inspector-title';
  inspectorHead.append(inspectorTitle);const inspectorTag=document.createElement('span');inspectorTag.textContent='INSPECTOR';inspectorHead.append(inspectorTag);
  $('.inspector-column').prepend(inspectorHead);

  // Library tabs keep original highlight controls and handlers intact.
  const library=$('.candidates-column');
  const libraryHead=document.createElement('div');libraryHead.className='editor-library-heading';
  libraryHead.innerHTML='Project media <span>LOCAL WORKSPACE</span>';
  const libraryTabs=document.createElement('div');libraryTabs.className='editor-library-tabs';libraryTabs.setAttribute('role','tablist');
  const source=document.createElement('div');source.className='editor-source-card';source.hidden=true;
  source.innerHTML=`${svg('film')}<strong></strong><small></small>`;
  const fullSourceBtn=document.createElement('button');fullSourceBtn.type='button';fullSourceBtn.className='pill-btn';fullSourceBtn.textContent='Edit full recording';
  fullSourceBtn.addEventListener('click',()=>$('#modeManualRaw').click());source.append(fullSourceBtn);
  const highlightNodes=[$('.candidates-header'),$('#streamPartsBar'),$('#clipsList')];
  ['Highlights','Source'].forEach((label,index)=>{
    const tab=document.createElement('button');tab.type='button';tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(index===0));
    tab.addEventListener('click',()=>{
      [...libraryTabs.children].forEach(t=>t.setAttribute('aria-selected',String(t===tab)));
      source.hidden=index===0;highlightNodes.forEach(n=>n?.classList.toggle('hidden',index===1));
    });libraryTabs.append(tab);
  });library.prepend(libraryHead,libraryTabs,source);
  source.querySelector('svg').style.cssText='width:40px;height:40px;color:#607a91';
  $('.candidates-header').querySelector('h3').textContent='Highlights';
  $('#reanalyzeClipsBtn').textContent='Re-score';$('#batchScheduleAllClipsBtn').textContent='Post / schedule clips';$('#addClipBtn').textContent='+ New clip';
  $('#renderBtn').textContent='Export clips ↗';
  $('#modeAiClips').textContent='AI selects';$('#modeManualRaw').textContent='Full recording';
  $('.canvas-header-bar .cbar-tag').textContent='FORMAT';
  document.querySelectorAll('.aspect-pill-btn').forEach(el=>el.textContent=el.dataset.aspect);

  // Visible loading/error states, instead of an unexplained black rectangle.
  const status=document.createElement('div');status.className='editor-player-status';
  const statusHeading=document.createElement('strong');const statusText=document.createElement('p');
  const statusActions=document.createElement('div');
  const retry=document.createElement('button');retry.type='button';retry.className='pill-btn';retry.textContent='Retry video';retry.onclick=()=>video.load();
  const importBtn=document.createElement('button');importBtn.type='button';importBtn.className='pill-btn';importBtn.textContent='Import video';importBtn.onclick=()=>window.switchAppView('ingest');
  statusActions.append(retry,importBtn);status.innerHTML=svg('film');status.append(statusHeading,statusText,statusActions);$('#videoContainer').append(status);
  const showStatus=(heading,text,canRetry=false)=>{
    status.hidden=false;statusHeading.textContent=heading;statusText.textContent=text;retry.hidden=!canRetry;
  };
  showStatus('Your player is ready','Choose a project or import a recording to begin.');
  let loadTimer;
  video.addEventListener('loadstart',()=>{
    showStatus('Opening your recording…','The preview will appear here as soon as the first frame is ready.');
    clearTimeout(loadTimer);loadTimer=setTimeout(()=>{
      if(video.readyState<2)showStatus('The recording is taking longer to load','Check that the source file is still available. You can retry or import the recording again.',true);
    },12000);
  });
  ['loadeddata','canplay','playing'].forEach(event=>video.addEventListener(event,()=>{status.hidden=true;clearTimeout(loadTimer);}));
  video.addEventListener('error',()=>{
    clearTimeout(loadTimer);
    const code=video.error?.code;
    showStatus('This recording could not be opened',code===3 || code===4 ? 'The file may be unavailable or use a codec this player cannot decode. Retry, or import an MP4 with H.264 video.' : 'The source file may have moved or been removed. Retry, or import the recording again.',true);
  });

  // Full-width transport with scrubbing, frame steps, volume and fullscreen.
  const transport=document.createElement('div');transport.className='editor-playback';
  const seek=document.createElement('input');seek.type='range';seek.className='editor-seek';seek.min='0';seek.max='1000';seek.value='0';seek.setAttribute('aria-label','Seek through recording');
  seek.oninput=()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value)/1000*video.duration;};
  const row=document.createElement('div');row.className='editor-playback-row';
  const rowLeft=document.createElement('div');rowLeft.className='editor-playback-buttons';
  const rowRight=document.createElement('div');rowRight.className='editor-playback-buttons';
  const step=amount=>{video.currentTime=Math.max(0,Math.min(video.duration || 0,video.currentTime+amount));};
  const play=button('Play preview · Space','play',async()=>{
    if(!video.currentSrc)return;
    if(video.paused){try{await video.play();}catch{showStatus('Playback could not start','Retry the recording, or check that its video format is supported.',true);}}
    else video.pause();
  },'editor-icon-btn editor-play-toggle');
  const time=document.createElement('output');time.setAttribute('aria-label','Playback time');
  const format=t=>{t=Number.isFinite(t)?t:0;return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(Math.floor(t)%60).padStart(2,'0')}.${String(Math.floor((t%1)*1000)).padStart(3,'0')}`;};
  rowLeft.append(button('Previous frame · Left arrow','back',()=>step(-1/30)),play,button('Next frame · Right arrow','next',()=>step(1/30)),time);
  const mute=button('Mute preview','volume',()=>{video.muted=!video.muted;});
  const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.value=String(video.volume);volume.className='editor-volume';volume.setAttribute('aria-label','Preview volume');volume.oninput=()=>{video.volume=Number(volume.value);video.muted=Number(volume.value)===0;};
  rowRight.append(mute,volume,button('Fullscreen preview','focus',()=>{const el=$('#videoContainer');if(!document.fullscreenElement)el.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();}));
  row.append(rowLeft,rowRight);transport.append(seek,row);$('.preview-column').append(transport);
  let previousPaused;
  const sync=()=>{
    const label=`${format(video.currentTime)} / ${format(video.duration)}`;
    if(time.value!==label)time.value=label;
    seek.value=String(Number.isFinite(video.duration)&&video.duration>0?video.currentTime/video.duration*1000:0);
    if(previousPaused!==video.paused){
      previousPaused=video.paused;
      play.innerHTML=svg(video.paused?'play':'pause');play.setAttribute('aria-label',video.paused?'Play preview · Space':'Pause preview · Space');
    }
    play.disabled=video.readyState<2;seek.disabled=!Number.isFinite(video.duration);mute.setAttribute('aria-pressed',String(video.muted));
  };
  ['timeupdate','play','pause','loadedmetadata','loadeddata','emptied','volumechange'].forEach(event=>video.addEventListener(event,sync));sync();
  video.controls=false;
  // Clicking the image toggles playback; caption/framing overlays keep their own actions.
  video.addEventListener('click',()=>play.click());
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)document.querySelectorAll('video').forEach(player=>{if(!player.paused)player.pause();});
  });

  // In-session undo/redo for clip edits. Restores the same clip data used by exports.
  let history=[],historyIndex=-1,historyJob=null;
  const snapshot=()=>JSON.stringify(state.currentJob?.clips || []);
  const updateHistoryUI=()=>{undoBtn.disabled=historyIndex<=0;redoBtn.disabled=historyIndex>=history.length-1;};
  function resetHistory(){historyJob=state.currentJob?.id;history=[snapshot()];historyIndex=0;updateHistoryUI();}
  const recordHistory=()=>{
    if(historyJob!==state.currentJob?.id)resetHistory();
    const next=snapshot();if(history[historyIndex]===next)return;
    history=history.slice(0,historyIndex+1);history.push(next);
    if(history.length>60)history.shift();historyIndex=history.length-1;updateHistoryUI();
  };
  const originalSave=saveClipsToServer;
  saveClipsToServer=async function(...args){
    recordHistory();saveStatus.textContent='Saving clip edits…';
    try{const result=await originalSave.apply(this,args);saveStatus.textContent=result===false?'Could not save edits':'Clip edits saved';return result;}
    catch(error){saveStatus.textContent='Could not save edits';throw error;}
  };
  function restoreHistory(direction){
    const next=historyIndex+direction;if(!state.currentJob || next<0 || next>=history.length)return;
    historyIndex=next;state.currentJob.clips=JSON.parse(history[next]);
    renderClipsList();renderCapCutTimeline();
    const selected=state.currentJob.clips.find(c=>c.id===state.activeClipId) || state.currentJob.clips[0];
    if(selected)selectClip(selected.id);else state.activeClipId=null;
    updateHistoryUI();originalSave().then(ok=>{if(ok===false)saveStatus.textContent='Could not save edits';}).catch(()=>{saveStatus.textContent='Could not save edits';});
    saveStatus.textContent=direction<0?'Clip edit undone':'Clip edit restored';
  }
  const refreshProject=()=>{
    const job=state.currentJob;
    source.querySelector('strong').textContent=job?.sourceName || 'No source recording';
    source.querySelector('small').textContent=job?`${format(job.duration)} · Original recording`:'Import a recording to start editing.';
    fullSourceBtn.disabled=!job;
    if(job && !job.sourcePath)showStatus('No source recording available','Import the original video to edit and preview this project.');
    if(historyJob!==job?.id)resetHistory();
  };
  const originalShow=showJob;
  showJob=function(...args){const result=originalShow.apply(this,args);refreshProject();return result;};
  refreshProject();updateHistoryUI();
  if(video.readyState>=2)status.hidden=true;
  // The old header creates the same editor actions, so no fake tool buttons are needed.
  $('#loadMasterVideoBtn')?.addEventListener('click',()=>$('#modeManualRaw').click());
  const closeOutputs=button('Close exported clips','close',()=>$('#outputsSection').classList.add('hidden'));
  closeOutputs.classList.add('editor-output-close');$('.outputs-header')?.append(closeOutputs);
  document.addEventListener('keydown',event=>{
    if($('#studioView').classList.contains('hidden') || event.target.closest('input,textarea,select,[contenteditable=true],.modal-backdrop'))return;
    if(document.querySelector('.modal-backdrop:not(.hidden)'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();event.stopImmediatePropagation();restoreHistory(event.shiftKey?1:-1);
    } else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='f'){
      event.preventDefault();focusBtn.click();
    } else if(event.key==='Escape'&&shell.classList.contains('is-focus')){focusBtn.click();}
  },true);
})();
