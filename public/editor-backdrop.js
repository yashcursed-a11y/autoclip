/* Low-resolution backdrop reuses the main video's decoded frames. */
(() => {
  const video=document.getElementById('previewVideo'),stage=document.querySelector('.preview-column'),view=document.getElementById('studioView');
  if(!video||!stage||!view)return;
  const canvas=document.createElement('canvas');canvas.className='editor-video-backdrop';canvas.setAttribute('aria-hidden','true');stage.prepend(canvas);
  const context=canvas.getContext('2d',{alpha:false});let timer=null;
  const visible=()=>!document.hidden&&!view.classList.contains('hidden');
  const draw=()=>{
    if(!visible()||video.readyState<2||!video.videoWidth||!video.videoHeight||!context)return;
    const scale=Math.min(320/video.videoWidth,320/video.videoHeight),w=Math.max(2,Math.round(video.videoWidth*scale)),h=Math.max(2,Math.round(video.videoHeight*scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    try{context.drawImage(video,0,0,w,h);canvas.classList.add('has-frame');}catch{}
  };
  const stop=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
  const tick=()=>{timer=null;if(!visible()||video.paused||video.ended)return;draw();timer=setTimeout(tick,200);};
  const start=()=>{stop();draw();if(visible()&&!video.paused&&!video.ended)timer=setTimeout(tick,200);};
  video.addEventListener('play',start);video.addEventListener('loadeddata',start);video.addEventListener('seeked',draw);
  video.addEventListener('pause',()=>{stop();draw();});video.addEventListener('ended',stop);
  video.addEventListener('emptied',()=>{stop();canvas.classList.remove('has-frame');});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  new MutationObserver(()=>visible()?start():stop()).observe(view,{attributes:true,attributeFilter:['class']});
  start();
})();
