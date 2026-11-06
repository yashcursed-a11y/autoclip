/* Editing-workspace composition based on the user's reference, not its branding. */
(() => {
  const viewport=document.querySelector('.studio-main-viewport');
  const library=document.querySelector('.candidates-column');
  const dock=document.querySelector('.editor-tools-dock');
  if(!viewport||!library||!dock)return;
  document.body.classList.add('composed-studio');
  viewport.prepend(dock);
  viewport.classList.add('library-closed','inspector-closed');
  const media=dock.querySelector('.editor-tool');media?.setAttribute('aria-pressed','true');
  const inspectorToggle=document.querySelector('[aria-label="Show or hide properties"]');inspectorToggle?.setAttribute('aria-pressed','true');
  document.querySelector('.editor-tab[data-subtab="framing"]')?.click();

  // A source-media tile uses the current video frame. No extra player or seek work.
  const tile=document.createElement('div');tile.className='studio-source-tile';
  const image=document.createElement('img');image.alt='Current recording frame';image.hidden=true;
  const label=document.createElement('div');label.className='studio-source-label';label.textContent='Your recording';
  tile.append(image,label);
  const source=document.querySelector('.editor-source-card');source?.prepend(tile);
  const sourceTab=[...document.querySelectorAll('.editor-library-tabs button')].find(button=>button.textContent==='Source');
  sourceTab?.click();
  const video=document.getElementById('previewVideo');
  let lastFrameKey='';
  const capture=()=>{
    if(!video||video.readyState<2||document.getElementById('studioView').classList.contains('hidden'))return;
    const job=state.currentJob;if(!job)return;
    const key=job.id+':'+state.activeClipId;
    label.textContent=job.sourceName || 'Your recording';
    if(key===lastFrameKey)return;
    try{
      const canvas=document.createElement('canvas');canvas.width=192;canvas.height=108;
      canvas.getContext('2d').drawImage(video,0,0,192,108);
      image.src=canvas.toDataURL('image/jpeg',.65);image.hidden=false;lastFrameKey=key;
    }catch{/* Media that cannot be captured keeps its accessible label. */}
  };
  video?.addEventListener('loadeddata',capture);video?.addEventListener('seeked',capture);
  // Initial rendering may precede bootstrap. Re-select the active tool after boot
  // without polling or forcing a view switch.
  const originalShow=showJob;
  showJob=function(...args){const result=originalShow.apply(this,args);document.querySelector('.editor-tab[data-subtab="framing"]')?.click();capture();return result;};
})();
