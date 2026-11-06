/* Expressive, draggable doodle with persistent user preferences. */
(() => {
  const host=document.querySelector('.studio-companion'),pet=host?.querySelector('.companion-pet');if(!pet)return;
  const read=()=>{try{return JSON.parse(localStorage.getItem('autoclip.companion')||'{}');}catch{return {};}};
  const preferences={enabled:true,motion:true,size:90,...read()};
  // Move legacy floating positions to the new rail dock once; later drags persist.
  if(preferences.dockVersion!==1){delete preferences.x;delete preferences.y;preferences.dockVersion=1;}
  const save=()=>{try{localStorage.setItem('autoclip.companion',JSON.stringify(preferences));}catch{}};
  host.classList.add('doodle-companion');
  pet.querySelector('.companion-antenna')?.remove();pet.querySelector('.companion-face')?.remove();
  const picture=document.createElementNS('http://www.w3.org/2000/svg','svg');picture.setAttribute('viewBox','0 0 120 140');picture.setAttribute('aria-hidden','true');picture.classList.add('clip-doodle');
  picture.innerHTML='<ellipse class="doodle-shadow" cx="60" cy="132" rx="30" ry="4"/><g class="doodle-body"><path class="doodle-fill" d="M38 83 Q28 99 27 125 Q60 132 93 125 L84 83Z"/><path class="doodle-arm arm-left" d="M37 91 Q18 110 15 91"/><path class="doodle-arm arm-right" d="M85 91 Q104 109 105 89"/><path class="doodle-fill" d="M16 51 C15 0 104 0 105 49 C110 101 19 110 16 51Z"/><g class="doodle-cheeks"><path d="M26 66l-2 5m7-5l-2 5M89 66l-2 5m7-5l-2 5"/></g><g class="doodle-expression expression-happy"><path d="M33 49q7-10 14 0m25 0q7-10 14 0M46 67q14 18 29-1"/></g><g class="doodle-expression expression-wink"><path d="M32 49l14 5-13 4m45-12v12M46 69q15 12 29-2"/></g><g class="doodle-expression expression-proud"><path d="M32 51q8 7 15 0m24 0q8 7 15 0M48 70q12 9 24 0"/></g><g class="doodle-expression expression-thinking"><path d="M34 41l12-3m28-1l11 6M40 50v9m39-9v9M53 74l16-3"/><path d="M97 24q13-6 12 4t-6 10m0 6v1"/></g><g class="doodle-expression expression-busy"><path d="M31 45l15 4m27 0l14-4M39 54v7m40-7v7M49 76h23"/><path class="doodle-sweat" d="M98 40q-9 13 0 13t0-13Z"/></g><g class="doodle-expression expression-worried"><path d="M32 39q7 7 15 3m26 0q8 3 14-4M39 51v10m40-10v10M46 79q14-15 29 0"/><path class="doodle-sweat" d="M99 44q-9 13 0 13t0-13Z"/></g><g class="doodle-expression expression-sad"><path d="M31 42q8 8 16 0m26 0q8 8 16 0M33 54q7 6 13 0m28 0q7 6 13 0M48 81q12-11 24 0"/><path class="doodle-tear" d="M30 62q-6 15 0 15t0-15Z"/></g><g class="doodle-expression expression-celebrate"><path d="M32 48l14 6-14 6m55-12l-14 6 14 6M45 68q15 35 31 0Z"/><path d="M9 18v10m-5-5h10m94-9v10m-5-5h10"/></g></g>';
  pet.prepend(picture);pet.title='Drag to move · click for activity';
  const settings=document.createElement('section');settings.className='companion-customize';settings.hidden=true;settings.setAttribute('role','dialog');settings.setAttribute('aria-modal','true');settings.setAttribute('aria-labelledby','companionCustomizeTitle');
  settings.innerHTML='<div class="companion-customize-card"><header><div><small>PERSONALIZE YOUR STUDIO</small><h2 id="companionCustomizeTitle">Customize</h2></div><button type="button" class="customize-close" aria-label="Close customize">×</button></header><h3>Bot</h3><p>Clip reacts to your studio. Drag your companion anywhere.</p><label class="bot-setting"><span>Show Clip<small>Your on-screen studio companion</small></span><input type="checkbox" id="companionEnabled"></label><label class="bot-setting"><span>Animated expressions<small>Blinks, gestures and changing moods</small></span><input type="checkbox" id="companionMotion"></label><label class="bot-setting"><span>Size</span><input type="range" id="companionSize" min="64" max="140" step="2"></label><button type="button" class="companion-reset-position">Reset position</button></div>';
  document.body.append(settings);
  const customize=document.createElement('button');customize.type='button';customize.className='companion-customize-trigger';customize.textContent='Customize';document.querySelector('.topbar-right')?.prepend(customize);
  const enabled=settings.querySelector('#companionEnabled'),motion=settings.querySelector('#companionMotion'),size=settings.querySelector('#companionSize');
  const position=()=>{
    const scale=window.getAppLayoutScale?.()||1,viewport=window.getAppViewport?.()||{width:window.innerWidth,height:window.innerHeight};
    if(!Number.isFinite(preferences.x)||!Number.isFinite(preferences.y)){
      host.classList.remove('companion-positioned');host.classList.add('companion-left','companion-low');
      const rail=document.querySelector('.app-rail'),bounds=rail?.getBoundingClientRect();
      const width=bounds?.width?bounds.width/scale:94;host.style.setProperty('left',`${Math.max(0,(width-preferences.size)/2)}px`);host.style.removeProperty('top');
      return;
    }
    preferences.x=Math.max(0,Math.min(viewport.width-preferences.size,preferences.x));preferences.y=Math.max(0,Math.min(viewport.height-preferences.size*1.17,preferences.y));
    host.style.setProperty('left',`${preferences.x}px`);host.style.setProperty('top',`${preferences.y}px`);host.classList.add('companion-positioned');
    host.classList.toggle('companion-left',preferences.x<360);host.classList.toggle('companion-low',preferences.y>viewport.height/2);
  };
  const apply=()=>{host.hidden=!preferences.enabled;enabled.checked=preferences.enabled;motion.checked=preferences.motion;size.value=String(preferences.size);host.style.setProperty('--pet-size',`${preferences.size}px`);host.classList.toggle('companion-still',!preferences.motion);position();save();};
  const showSettings=value=>{settings.hidden=!value;if(value)settings.querySelector('.customize-close').focus();else customize.focus();};
  customize.onclick=()=>showSettings(true);settings.querySelector('.customize-close').onclick=()=>showSettings(false);settings.addEventListener('click',event=>{if(event.target===settings)showSettings(false);});
  document.addEventListener('keydown',event=>{if(settings.hidden)return;if(event.key==='Escape')showSettings(false);if(event.key==='Tab'){const elements=[...settings.querySelectorAll('button,input')],first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  enabled.onchange=()=>{preferences.enabled=enabled.checked;apply();};motion.onchange=()=>{preferences.motion=motion.checked;apply();};size.oninput=()=>{preferences.size=Number(size.value);apply();};
  settings.querySelector('.companion-reset-position').onclick=()=>{delete preferences.x;delete preferences.y;host.classList.remove('companion-positioned','companion-left','companion-low');host.style.removeProperty('left');host.style.removeProperty('top');apply();};
  let dragging=null,suppressClick=false;
  pet.addEventListener('pointerdown',event=>{if(event.button!==0)return;const rect=host.getBoundingClientRect(),scale=window.getAppLayoutScale?.()||1;dragging={x:event.clientX,y:event.clientY,left:rect.left/scale,top:rect.top/scale,moved:false,scale};pet.setPointerCapture?.(event.pointerId);});
  pet.addEventListener('pointermove',event=>{if(!dragging)return;const dx=event.clientX-dragging.x,dy=event.clientY-dragging.y;if(Math.abs(dx)+Math.abs(dy)>5)dragging.moved=true;if(!dragging.moved)return;preferences.x=dragging.left+dx/dragging.scale;preferences.y=dragging.top+dy/dragging.scale;position();});
  const finish=()=>{if(!dragging)return;suppressClick=dragging.moved;dragging=null;save();};pet.addEventListener('pointerup',finish);pet.addEventListener('pointercancel',finish);
  pet.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  window.addEventListener('resize',position);
  let phase=0;
  const express=()=>{const options=host.dataset.mood==='error'?['worried','sad']:host.dataset.mood==='working'?['thinking','busy']:host.dataset.mood==='success'?['celebrate','happy','proud']:['happy','wink','proud'];host.dataset.expression=options[phase++%options.length];};
  new MutationObserver(express).observe(host,{attributes:true,attributeFilter:['data-mood']});
  setInterval(()=>{if(preferences.enabled&&preferences.motion&&!document.hidden)express();},3600);
  apply();express();
})();
