/* Minimal Matter: sample the real visible UI, dissolve its pixels, reassemble the destination.
   No screenshot downloads, panel-outline approximation or decorative fade overlay. */
(()=>{
  const layer=document.createElement('canvas');layer.className='minimal-matter';layer.hidden=true;layer.setAttribute('aria-hidden','true');document.body.append(layer);
  let frame=0,token=0,release=null;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function cancel(){token++;cancelAnimationFrame(frame);layer.hidden=true;document.body.classList.remove('minimal-matter-building');release?.();release=null;}
  const transparent=c=>!c||c==='transparent'||c==='rgba(0, 0, 0, 0)';
  function capture(width,height){
    const surface=document.createElement('canvas');surface.width=width;surface.height=height;const c=surface.getContext('2d',{willReadFrequently:true});
    if(!c?.getImageData||!c?.fillText||!document.createRange)return null;
    c.fillStyle='#fff';c.fillRect(0,0,width,height);
    const root=document.querySelector('dialog[open]')||document.body,scale=window.getAppLayoutScale?.()||1;
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.left/scale,y:r.top/scale,w:r.width/scale,h:r.height/scale};};
    let count=0;
    function visit(node){
      if(++count>14000)return;
      if(node.nodeType===3){const text=node.textContent;if(!text?.trim())return;const parent=node.parentElement;if(!parent||parent.closest('canvas,script,style,select,textarea,option'))return;const style=getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none')return;
        const range=document.createRange();const fontSize=parseFloat(style.fontSize)||12;c.font=`${style.fontStyle||'normal'} ${style.fontWeight||400} ${fontSize}px ${style.fontFamily||'sans-serif'}`;c.fillStyle=style.color||'#111';c.textBaseline='top';
        // Range geometry preserves real wrapping and word positions instead of inventing text layout.
        const words=[...text.matchAll(/\S+/g)];for(const word of words){range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);const r=range.getBoundingClientRect();const x=r.left/scale,y=r.top/scale;if(r.width&&x<width&&y<height&&x+r.width/scale>0&&y+r.height/scale>0)c.fillText(word[0],x,y);}range.detach?.();return;
      }
      if(node.nodeType!==1||node===layer||node.matches('script,style,link,.minimal-grains,.minimal-matter'))return;
      const style=getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return;
      const r=rect(node);if(r.w&&r.h&&r.x<width&&r.y<height&&r.x+r.w>0&&r.y+r.h>0){
        c.save();const bg=style.backgroundColor;if(!transparent(bg)&&!node.classList.contains('minimal-dot')){c.fillStyle=bg;c.fillRect(r.x,r.y,r.w,r.h);}
        for(const [side,x,y,w,h]of [['Top',r.x,r.y,r.w,parseFloat(style.borderTopWidth)||0],['Bottom',r.x,r.y+r.h-(parseFloat(style.borderBottomWidth)||0),r.w,parseFloat(style.borderBottomWidth)||0],['Left',r.x,r.y,parseFloat(style.borderLeftWidth)||0,r.h],['Right',r.x+r.w-(parseFloat(style.borderRightWidth)||0),r.y,parseFloat(style.borderRightWidth)||0,r.h]])if(w&&h){c.fillStyle=style[`border${side}Color`]||'#111';c.fillRect(x,y,w,h);}
        const tag=node.tagName.toLowerCase();
        if(['canvas','video','img'].includes(tag)){try{const source=node.currentSrc||node.src;const safe=!source||source.startsWith('data:')||source.startsWith('blob:')||new URL(source,location.href).origin===location.origin;if(safe&&(tag!=='video'||node.readyState>=2)){const sw=node.videoWidth||node.naturalWidth||node.width,sh=node.videoHeight||node.naturalHeight||node.height;if(style.objectFit==='contain'&&sw&&sh){const ratio=Math.min(r.w/sw,r.h/sh),dw=sw*ratio,dh=sh*ratio;c.drawImage(node,r.x+(r.w-dw)/2,r.y+(r.h-dh)/2,dw,dh);}else c.drawImage(node,r.x,r.y,r.w,r.h);}}catch{/* Protected media cannot block navigation. */}}
        if(tag==='svg'&&typeof Path2D!=='undefined'){const vb=(node.getAttribute('viewBox')||'0 0 24 24').split(/[ ,]+/).map(Number);c.save();c.translate(r.x,r.y);c.scale(r.w/(vb[2]||24),r.h/(vb[3]||24));c.translate(-vb[0],-vb[1]);for(const path of node.querySelectorAll('path[d]')){const ps=getComputedStyle(path),shape=new Path2D(path.getAttribute('d'));if(ps.fill&&ps.fill!=='none'){c.fillStyle=ps.fill;c.fill(shape);}if(ps.stroke&&ps.stroke!=='none'){c.strokeStyle=ps.stroke;c.lineWidth=parseFloat(ps.strokeWidth)||1;c.stroke(shape);}}c.restore();}
        if(tag==='button'&&node.classList.contains('minimal-dot')){c.fillStyle=bg||'#111';c.beginPath();c.arc(r.x+r.w/2,r.y+r.h/2,Math.min(r.w,r.h)/2,0,Math.PI*2);c.fill();}
        if(tag==='input'||tag==='select'||tag==='textarea'){const label=tag==='select'?node.selectedOptions?.[0]?.textContent:node.value||node.placeholder;if(label&&node.type!=='checkbox'&&node.type!=='range'){c.font=`${style.fontWeight||400} ${parseFloat(style.fontSize)||12}px ${style.fontFamily||'sans-serif'}`;c.fillStyle=style.color||'#111';c.textBaseline='middle';c.fillText(label,r.x+(parseFloat(style.paddingLeft)||6),r.y+r.h/2,Math.max(1,r.w-12));}}
        c.restore();
      }
      const clip=/(hidden|auto|scroll)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)&&r.w&&r.h;if(clip){c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();}for(const child of node.childNodes)visit(child);if(clip)c.restore();
    }
    visit(root);
    // Read after painting; tainted third-party media simply falls back to the live view.
    try{return{surface,pixels:c.getImageData(0,0,width,height).data};}catch{return null;}
  }
  function sample(image,width,height,max){const points=[];const data=image.pixels;for(let y=1;y<height;y+=3)for(let x=1;x<width;x+=3){const offset=(y*width+x)*4,r=data[offset],g=data[offset+1],b=data[offset+2];if(data[offset+3]>80&&(r+g+b)<710)points.push({x,y,r,g,b});}if(points.length<=max)return points;const stride=points.length/max;return Array.from({length:max},(_,i)=>points[Math.floor(i*stride)]);}
  function transition(commit,options={}){
    cancel();
    const ctx=layer.getContext('2d');if(reduced()||!ctx?.getImageData||!document.createRange){commit();return;}
    const scale=window.getAppLayoutScale?.()||1,width=Math.max(1,Math.round(window.innerWidth/scale)),height=Math.max(1,Math.round(window.innerHeight/scale));
    document.body.classList.add('minimal-matter-measuring');let before,after;try{before=capture(width,height);commit();after=capture(width,height);}finally{document.body.classList.remove('minimal-matter-measuring');}if(!before||!after)return;
    const source=sample(before,width,height,14000),target=sample(after,width,height,14000);if(!source.length||!target.length)return;
    const n=Math.min(14000,Math.max(source.length,target.length)),id=++token;layer.width=width;layer.height=height;
    // The destination exists for layout measurement, but is never visible underneath the assembly.
    (document.querySelector('dialog[open]')||document.body).append(layer);document.body.classList.add('minimal-matter-building');layer.hidden=false;layer.dataset.phase='dissolve';
    const hash=i=>{const v=Math.sin(i*91.71+12.3)*43758.54;return v-Math.floor(v);};
    const particles=Array.from({length:n},(_,i)=>{const a=source[Math.floor(hash(i+1)*source.length)],b=target[i%target.length];return{a,b,dx:(hash(i+71)-.5)*300,dy:(hash(i+91)-.5)*260,delay:hash(i+10)*.12};});
    let start=null,last=0;
    const tick=now=>{if(id!==token)return;if(start===null)start=now;const elapsed=now-start,t=Math.min(1,elapsed/(options.duration||1450));if(!last||now-last>=30||t===1){last=now;layer.dataset.phase=t<.3?'dissolve':t<.92?'assemble':'formed';ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
      for(const p of particles){const u=Math.min(1,Math.max(0,(t-p.delay)/(1-p.delay))),ease=u*u*(3-2*u),wave=Math.sin(Math.PI*u);const x=p.a.x+(p.b.x-p.a.x)*ease+wave*p.dx,y=p.a.y+(p.b.y-p.a.y)*ease+wave*p.dy;const r=Math.round(p.a.r+(p.b.r-p.a.r)*ease),g=Math.round(p.a.g+(p.b.g-p.a.g)*ease),b=Math.round(p.a.b+(p.b.b-p.a.b)*ease);ctx.fillStyle=`rgb(${r},${g},${b})`;const size=2.2+Math.sin(Math.PI*u)*.5;ctx.fillRect(x,y,size,size);}}
      if(t<1)frame=requestAnimationFrame(tick);else{layer.dataset.phase='ready';document.body.classList.remove('minimal-matter-building');layer.hidden=true;}
    };frame=requestAnimationFrame(tick);
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!layer.hidden)cancel();});
  window.minimalMatter={cancel,transition(commit,options){let committed=false;const once=()=>{if(!committed){committed=true;commit();}};try{transition(once,options);}catch(error){cancel();once();console.warn('Minimal pixel capture skipped:',error);}}};document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
})();
