(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const clamp = (n,a=0,b=1) => Math.min(b,Math.max(a,n));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const lowData = Boolean(navigator.connection?.saveData);
  let paused = reduce.matches || lowData, heroVisible = true, machineVisible = false;
  let frameId = 0, lastPaint = 0, burstUntil = 0, burstCount = 0;
  let sources = [], tiles = [], shots = [], scrollDirty = true;
  // Initialize the signature story before optional hero, checkout or dialog bindings.
  const cinema=window.AutoClipCinema?.create({paused});
  const names = ['ocean','trick','coffee','jelly','skate'];
  const labels = ['OUTSIDE THE FRAME','ONE MORE TRY','SLOW MORNINGS','AFTER HOURS','IN MOTION'];
  const modal = $('#clipDialog'), motion = $('#motionToggle');
  const wall = $('#clipWall'), sourceHost = $('#videoSources');
  const safePlay = (v) => { const p=v.play(); p?.catch(() => {}); };
  const drawFrame = (canvas,video) => {
    if (video.readyState < 2) return;
    const ctx=canvas.getContext('2d',{alpha:false});
    if (!ctx) return;
    const sw=video.videoWidth,sh=video.videoHeight;
    if (!sw || !sh) return;
    const target=canvas.width/canvas.height,ratio=sw/sh;
    let sx=0,sy=0,cw=sw,ch=sh;
    if (ratio>target) { cw=sh*target; sx=(sw-cw)/2; } else { ch=sw/target; sy=(sh-ch)/2; }
    ctx.drawImage(video,sx,sy,cw,ch,0,0,canvas.width,canvas.height);
  };
  names.forEach((name) => {
    const v=document.createElement('video');
    v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.preload=lowData?'none':'metadata';
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.src=`./marketing/media/${name}.mp4`;
    v.addEventListener('loadeddata', () => { tiles.filter(t=>t.video===v).forEach(t=>drawFrame(t.canvas,v)); });
    sourceHost.append(v);sources.push(v);
  });
  for(let i=0;i<30;i++) {
    const index=(i*3+Math.floor(i/10))%names.length;
    const button=document.createElement('button');button.className='wall-tile';
    button.setAttribute('aria-label',`Preview sample ${i+1}: ${labels[index].toLowerCase()}`);
    button.style.backgroundImage=`url('./marketing/media/${names[index]}.jpg')`;
    const canvas=document.createElement('canvas');canvas.width=144;canvas.height=220;canvas.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='tile-number';label.textContent=`${String(i+1).padStart(2,'0')} / ${labels[index]}`;
    button.append(canvas,label);wall.append(button);tiles.push({canvas,video:sources[index],button,index:i});
    button.addEventListener('click',() => {
      const v=modal.querySelector('video');v.src=sources[index].src;v.poster=`./marketing/media/${names[index]}.jpg`;
      modal.showModal();updatePlayback();safePlay(v);
    });
  }
  function schedule() { if (!frameId) frameId=requestAnimationFrame(tick); }
  function updatePlayback() {
    document.body.classList.toggle('motion-paused',paused);
    cinema?.setPaused(paused);
    if(paused)poseRibbon(0);
    const active=!paused&&!document.hidden&&!modal.open&&(heroVisible||burstUntil>performance.now());
    sources.forEach(v=>active?safePlay(v):v.pause());
    motion.textContent=paused?'▶ Play motion':'Ⅱ Pause motion';motion.setAttribute('aria-pressed',String(paused));
    if(active) schedule();
  }
  function clearBurst(){shots.forEach(s=>{s.animation?.cancel();s.canvas.remove();});shots=[];burstUntil=0;$('#autoClipBtn').classList.remove('firing');}
  $('#autoClipBtn').addEventListener('click',() => {
    clearBurst();burstCount++;
    const staticMotion=paused||reduce.matches;
    const stage=$('.launch-stage').getBoundingClientRect();
    const reach=Math.max(180,Math.min(stage.width*.65,850));
    for(let i=0;i<16;i++) {
      const canvas=document.createElement('canvas');canvas.className='burst-tile';canvas.width=144;canvas.height=220;
      const video=sources[i%5];canvas.style.backgroundImage=`url('./marketing/media/${names[i%5]}.jpg')`;$('#clipBurst').append(canvas);drawFrame(canvas,video);
      const angle=(i/16*Math.PI*2)-Math.PI/2;
      const dx=Math.cos(angle)*reach,dy=Math.sin(angle)*Math.min(300,reach*.7),rotation=(i%2?1:-1)*(20+i*7);
      let animation;
      if(staticMotion) {canvas.style.transform=`translate(calc(-50% + ${dx*.4}px),calc(-50% + ${dy*.4}px)) rotate(${rotation*.3}deg) scale(.7)`;canvas.style.opacity='.8';}
      else animation=canvas.animate([
        {transform:'translate(-50%,-50%) rotate(0deg) scale(.2)',opacity:0,filter:'blur(0px)'},
        {transform:`translate(calc(-50% + ${dx*.14}px),calc(-50% + ${dy*.14}px)) rotate(${rotation*.1}deg) scale(.55)`,opacity:1,filter:'blur(0px)',offset:.15},
        {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${rotation}deg) scale(1.15)`,opacity:0,filter:'blur(5px)'}
      ],{duration:1050+i%4*95,delay:i%4*45,easing:'cubic-bezier(.12,.65,.3,1)',fill:'forwards'});
      shots.push({canvas,video,animation});
    }
    $('#autoClipBtn').classList.add('firing');burstUntil=performance.now()+1700;
    $('#burstStatus').textContent=`Burst ${String(burstCount).padStart(2,'0')} · 16 sample clips unleashed.`;
    updatePlayback();schedule();
  });
  motion.addEventListener('click',()=>{paused=!paused;if(paused){clearBurst();}scrollDirty=true;updatePlayback();schedule();});
  reduce.addEventListener('change',()=>{paused=reduce.matches;clearBurst();scrollDirty=true;updatePlayback();schedule();});
  modal.addEventListener('close',()=>{const v=modal.querySelector('video');v.pause();v.removeAttribute('src');v.load();updatePlayback();});
  document.querySelectorAll('dialog').forEach(dialog=>{
    // Legal/checkout dialogs added by the redesign have their own close controls.
    dialog.querySelector('.dialog-close')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  });
  $('#creditsOpen').addEventListener('click',()=>$('#creditsDialog').showModal());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearBurst();modal.querySelector('video').pause();}scrollDirty=true;updatePlayback();});
  new IntersectionObserver(([e])=>{heroVisible=e.isIntersecting;updatePlayback();},{threshold:0}).observe($('.hero'));
  new IntersectionObserver(([e])=>{machineVisible=e.isIntersecting;if(!machineVisible&&shots.length){clearBurst();updatePlayback();}},{threshold:0}).observe($('#machine'));
  const control=$('#autoClipBtn');
  control.addEventListener('pointermove',e=>{if(paused||reduce.matches)return;const r=control.getBoundingClientRect();control.style.setProperty('--control-x',`${(e.clientX-r.left)/r.width*100}%`);control.style.setProperty('--control-y',`${(e.clientY-r.top)/r.height*100}%`);});
  control.addEventListener('pointerleave',()=>{control.style.removeProperty('--control-x');control.style.removeProperty('--control-y');});
  let heroProgress=0,pointerX=0,pointerY=0;
  $('.clip-universe').addEventListener('pointermove',event=>{if(paused)return;const r=$('.clip-universe').getBoundingClientRect();pointerX=clamp((event.clientX-r.left)/r.width)*2-1;pointerY=clamp((event.clientY-r.top)/r.height)*2-1;});
  $('.clip-universe').addEventListener('pointerleave',()=>{pointerX=0;pointerY=0;});
  function poseRibbon(now=0){
    const box=$('.clip-universe').getBoundingClientRect(),mobile=window.innerWidth<700;
    const step=Math.min(mobile?27:40,(box.width+130)/29),time=paused?0:now/1000;
    const amplitude=(mobile?38:65)*(1-heroProgress*.4);
    tiles.forEach((tile,i)=>{
      const u=i/29,wave=u*Math.PI*3.8-time*.48;
      const x=(i-14.5)*step,y=Math.sin(wave)*amplitude+pointerY*12;
      const z=Math.cos(wave)*55;
      const turn=Math.cos(wave)*48+pointerX*14,twist=Math.sin(wave+.5)*20;
      tile.button.style.transform=`translate3d(${x}px,${y}px,${z}px) rotateY(${turn}deg) rotateZ(${twist}deg)`;
      tile.button.style.zIndex=String(Math.round(z+100));
      tile.button.style.setProperty('--edge-light',String(.2+(Math.cos(wave)+1)*.28));
    });
    wall.style.transform=`rotateX(${-8+pointerY*5}deg) rotateZ(${-4+pointerX*2}deg) scale(${1+heroProgress*.04})`;
  }
  function drawScroll(){
    heroProgress=clamp(-$('.hero').getBoundingClientRect().top/window.innerHeight);
    $('#heroTitle').style.setProperty('--metal-x',`${40+heroProgress*50}%`);
    if(paused)poseRibbon(0);
    scrollDirty=false;
  }
  function tick(now){
    frameId=0;
    if(scrollDirty)drawScroll();
    const active=!paused&&!document.hidden&&!modal.open;
    if(now-lastPaint>42){
      if(active&&heroVisible){poseRibbon(now);tiles.forEach(t=>drawFrame(t.canvas,t.video));}
      if(active&&shots.length)shots.forEach(s=>drawFrame(s.canvas,s.video));
      lastPaint=now;
    }
    if(shots.length&&now>burstUntil){clearBurst();updatePlayback();}
    if((active&&heroVisible)||shots.length)schedule();
  }
  window.addEventListener('scroll',()=>{scrollDirty=true;schedule();},{passive:true});
  poseRibbon(0);updatePlayback();
})();
