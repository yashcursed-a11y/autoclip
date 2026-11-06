/* Video-first Watch workspace. Existing controls are reparented, not duplicated. */
(() => {
  const $=s=>document.querySelector(s),canvas=$('#cinemaVideoContainer');
  if(!canvas)return;
  document.body.classList.add('immersive-watch');
  const panel=$('.cinema-left-panel'),controls=$('.cinema-controls-bar'),timeline=$('.cinema-master-timeline-card'),actions=$('.cinema-actions-row');
  for(const node of [panel,controls,timeline])if(node)canvas.append(node);
  const tools=document.createElement('div');tools.className='watch-floating-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','Watch overlays');
  const create=(text,action)=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',action);return button;};
  const toggle=create('Highlights',()=>{canvas.classList.toggle('watch-panel-hidden');toggle.setAttribute('aria-expanded',String(!canvas.classList.contains('watch-panel-hidden')));});toggle.setAttribute('aria-expanded','true');
  const guides=create('Safe zones',()=>$('#cinemaGuidesToggleBtn')?.click());
  const info=create('Clip info',()=>{canvas.classList.toggle('watch-info-hidden');info.setAttribute('aria-pressed',String(!canvas.classList.contains('watch-info-hidden')));});info.setAttribute('aria-pressed','true');
  tools.append(toggle,guides,info);canvas.append(tools);
  if(panel){
    const close=create('Close ×',()=>toggle.click());close.className='watch-panel-close';panel.prepend(close);
  }
  const menu=document.createElement('details');menu.className='watch-actions-menu';
  const summary=document.createElement('summary');summary.textContent='Clip actions';menu.append(summary);if(actions)menu.append(actions);canvas.append(menu);
  // Keep the bottom transport compact; less frequent controls remain in its menu.
  const extras=document.createElement('details');extras.className='watch-playback-options';
  const extrasLabel=document.createElement('summary');extrasLabel.textContent='Options';extras.append(extrasLabel);
  const center=$('.cinema-controls-bar .ctrl-group-center');if(center)extras.append(center);controls?.append(extras);
  for(const [id,text] of Object.entries({cinemaBack5Btn:'−5s',cinemaFwd5Btn:'+5s',cinemaGuidesToggleBtn:'9:16 guides',cinemaMarkClipBtn:'Save clip here',cinemaEditInStudioBtn:'Edit in Studio',cinemaPrevClipBtn:'Previous clip',cinemaNextClipBtn:'Next clip'})){const node=document.getElementById(id);if(node)node.textContent=text;}
  const video=$('#cinemaVideo');if(video)video.preload='metadata';
  // Reuse decoded frames for a same-video backdrop; never start a second player.
  if(video){
    const backdrop=document.createElement('canvas');backdrop.className='watch-video-backdrop';backdrop.setAttribute('aria-hidden','true');canvas.prepend(backdrop);
    const context=backdrop.getContext('2d',{alpha:false});
    let timer=null;
    const visible=()=>!document.hidden&&!$('#watchView').classList.contains('hidden');
    const draw=()=>{
      if(!visible()||video.readyState<2||!context||!video.videoWidth||!video.videoHeight)return;
      const scale=Math.min(320/video.videoWidth,320/video.videoHeight);
      const width=Math.max(2,Math.round(video.videoWidth*scale)),height=Math.max(2,Math.round(video.videoHeight*scale));
      if(backdrop.width!==width||backdrop.height!==height){backdrop.width=width;backdrop.height=height;}
      try{context.drawImage(video,0,0,width,height);backdrop.classList.add('has-frame');}catch{}
    };
    const stop=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
    const tick=()=>{timer=null;if(!visible()||video.paused||video.ended)return;draw();timer=setTimeout(tick,180);};
    const start=()=>{stop();draw();if(visible()&&!video.paused&&!video.ended)timer=setTimeout(tick,180);};
    video.addEventListener('play',start);video.addEventListener('pause',()=>{stop();draw();});video.addEventListener('ended',stop);
    video.addEventListener('loadeddata',start);video.addEventListener('seeked',draw);
    video.addEventListener('emptied',()=>{stop();backdrop.classList.remove('has-frame');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
    new MutationObserver(()=>{if(visible())start();else stop();}).observe($('#watchView'),{attributes:true,attributeFilter:['class']});
    start();
  }
})();
