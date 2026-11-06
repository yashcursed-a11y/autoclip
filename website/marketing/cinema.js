(() => {
  'use strict';
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
  window.AutoClipCinema={create({paused=false}={}){
    const $=s=>document.querySelector(s),section=$('#quality'),stage=section.querySelector('.cinema-stage');
    const canvas=$('#grainCanvas'),ctx=canvas.getContext('2d');
    const copy=$('#cinemaCopy'),amount=$('#cinemaAmount'),number=$('#sceneNumber');
    const format=new Intl.NumberFormat('en-US');
    let width=0,height=0,scale=1,p=0,target=0,raf=0,resizeTimer=0,lastTime=0,visible=false,ready=false;
    let points=[],amountPixels=[],textPixels=[];
    const maxParticles=window.innerWidth<700?6500:11500;
    const random=i=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
    function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
    function sample(off){
      const data=off.getContext('2d').getImageData(0,0,width,height).data,arr=[];
      const step=Math.max(3,Math.round(width/330));
      for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const i=(y*width+x)*4;
        if(data[i+3]>100)arr.push({x,y,r:data[i],g:data[i+1],b:data[i+2],a:data[i+3]/255});
      }
      // Spatially ordered targets create coherent streams rather than random confetti.
      arr.sort((a,b)=>(a.x/width+a.y/height*.32)-(b.x/width+b.y/height*.32));return arr;
    }
    function numberPixels(){
      const off=document.createElement('canvas');off.width=width;off.height=height;const c=off.getContext('2d');
      const previous=number.textContent;number.textContent='$0';
      const base=stage.getBoundingClientRect(),box=number.getBoundingClientRect(),style=getComputedStyle(number),size=parseFloat(style.fontSize)*scale;
      c.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;c.fillStyle=style.color;c.textBaseline='alphabetic';
      if('letterSpacing' in c)c.letterSpacing=`${parseFloat(style.letterSpacing||0)*scale||0}px`;
      c.fillText('$0',(box.left-base.left)*scale,(box.top-base.top)*scale+size*.82);
      number.textContent=previous;return sample(off);
    }
    function build(){
      if(paused||!ctx){render();return;}
      copy.style.transform='none';
      const box=stage.getBoundingClientRect();scale=Math.min(1,1440/box.width);width=Math.max(1,Math.round(box.width*scale));height=Math.max(1,Math.round(box.height*scale));
      canvas.width=width;canvas.height=height;
      const off=document.createElement('canvas');off.width=width;off.height=height;const c=off.getContext('2d');
      document.querySelectorAll('.cinema-line').forEach(line=>{
        const rect=line.getBoundingClientRect(),style=getComputedStyle(line),size=parseFloat(style.fontSize)*scale;
        c.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;c.fillStyle=style.color;c.textBaseline='alphabetic';
        if('letterSpacing' in c)c.letterSpacing=`${parseFloat(style.letterSpacing||0)*scale||0}px`;
        c.fillText(line.textContent,(rect.left-box.left)*scale,(rect.top-box.top)*scale+size*.82);
      });
      textPixels=sample(off);amountPixels=numberPixels();
      ready=Boolean(textPixels.length&&amountPixels.length);
      const count=Math.min(maxParticles,Math.max(textPixels.length,amountPixels.length));points=[];
      if(ready)for(let i=0;i<count;i++){
        const pick=arr=>arr[Math.min(arr.length-1,Math.floor(i/count*arr.length))];
        points.push({text:pick(textPixels),amount:pick(amountPixels),dx:(random(i)-.5)*width*.8,dy:(random(i+900)-.5)*height*.65,size:1.25+random(i+31)*1.6,delay:random(i+77)*.13});
      }
      readProgress();p=target;render();
    }
    function readProgress(){const r=section.getBoundingClientRect();target=clamp(-r.top/Math.max(1,r.height-window.innerHeight));}
    function morph(from,to,t){
      if(!ctx)return;ctx.clearRect(0,0,width,height);
      const fly=Math.sin(t*Math.PI),fade=1-smooth(.91,1,t);
      points.forEach(pt=>{
        const k=smooth(pt.delay,.84+pt.delay,t),a=pt[from],b=pt[to];
        const bend=Math.sin(k*Math.PI),x=a.x+(b.x-a.x)*k+pt.dx*bend,y=a.y+(b.y-a.y)*k+pt.dy*bend;
        const r=Math.round(a.r+(b.r-a.r)*k),g=Math.round(a.g+(b.g-a.g)*k),blue=Math.round(a.b+(b.b-a.b)*k);
        ctx.fillStyle=`rgba(${r},${g},${blue},${fade*(.7+.3*fly)})`;
        const s=pt.size*(1+bend*.4);ctx.fillRect(x,y,s,s);
      });
    }
    function render(){
      if(paused){if(ctx)ctx.clearRect(0,0,width,height);number.textContent='$1,000,000';return;}
      const progress=smooth(.12,.4,p);
      copy.style.opacity=String(1-smooth(.115,.145,p));
      copy.querySelector('.cinema-cta').style.opacity=String(1-smooth(.06,.11,p));
      amount.style.opacity=String(smooth(.365,.415,p));
      const value=Math.round(smooth(.43,.92,p)*1_000_000);
      const text='$'+format.format(value);if(number.textContent!==text)number.textContent=text;
      $('.cinema-halo').style.opacity=String(smooth(.16,.4,p)*.65);
      $('.cinema-halo').style.transform=`scale(${1+p*.12})`;
      if(ready&&p>.115&&p<.405)morph('text','amount',progress);
      else if(ctx)ctx.clearRect(0,0,width,height);
      $('#sceneProgress').style.width=`${p*100}%`;
      const chapter=p<.15?0:p<.41?1:2;
      document.querySelectorAll('[data-chapter]').forEach((el,i)=>el.classList.toggle('active',i===chapter));
      $('#sceneCue').textContent=p<.12?'SCROLL SLOW. THINK BIG. ↓':p<.41?'WORDS INTO GRAIN. GRAIN INTO POSSIBILITY.':p<.92?'$0 → $1 MILLION. KEEP SCROLLING.':'YOUR NEXT MOVE. ↓';
    }
    function frame(now){raf=0;if(paused)return;const dt=Math.min(50,now-(lastTime||now-16));lastTime=now;
      p+=(target-p)*(1-Math.exp(-dt/105));if(Math.abs(p-target)<.0004)p=target;render();
      if(Math.abs(p-target)>.0004&&visible)schedule();
    }
    function setPaused(value){if(paused===value&&section.classList.contains('cinema-static')===value)return;paused=value;section.classList.toggle('cinema-static',paused);if(paused){if(raf)cancelAnimationFrame(raf);raf=0;render();}else requestAnimationFrame(build);}
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){readProgress();schedule();}},{rootMargin:'100px'}).observe(section);
    window.addEventListener('scroll',()=>{if(!paused&&visible){readProgress();schedule();}},{passive:true});
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(build,120);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible){readProgress();schedule();}});
    document.fonts?.ready.then(build);
    section.classList.toggle('cinema-static',paused);build();
    return {setPaused,refresh:build};
  }};
  // Short, one-time entrance motion outside the long pinned story.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');revealObserver.unobserve(e.target);}}),{threshold:.12});
  if(!reduced.matches)document.querySelectorAll('.steps article,.pricing-title,.download h2,.lookbook-heading').forEach(el=>{el.classList.add('reveal-ready');revealObserver.observe(el);});
})();
