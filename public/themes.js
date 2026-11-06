/* Theme registry is independent of companion appearance. */
(() => {
  const nav=document.querySelector('.customize-nav'),pages=document.querySelector('.customize-pages');if(!nav||!pages)return;
  const themes=[
    {id:'dark',name:'Studio Dark',note:'Graphite panels · chrome silver · cool-white controls',font:'Segoe UI',colors:['#080a0f','#151d2a','#d3deef'],motifs:['film','wave','brackets','lens','play','timeline']},
    {id:'white',name:'White',note:'Editorial frames · camera & pencil drawings',font:'Calibri',colors:['#f5f7fa','#ffffff','#345bd6'],motifs:['camera','pencil','crop','clapper','cursor','sun']},
    {id:'minimal',name:'Minimal',note:'Numbered sections · pure monochrome',font:'Bahnschrift',colors:['#ffffff','#e6e6e6','#151515'],motifs:['brackets','lens','play','timeline','crop','wave']},
    {id:'flurry',name:'Flurry',note:'Puffy panels · clouds, cats & little bows',font:'Trebuchet MS',colors:['#f8f0fa','#ffe3dd','#9b64bc'],motifs:['cloud','cat','bunny','star','bow','flower']},
    {id:'goth',name:'Goth',note:'Carved frames · ravens, roses & moonlight',font:'Georgia',colors:['#100e13','#261720','#ad526f'],motifs:['raven','rose','moon','thorn','key','arch']},
    {id:'sticker',name:'Sticker',note:'Die-cut paper · tape, scissors & scribbles',font:'Comic Sans MS',colors:['#fff8df','#ffdc91','#ea87b1'],motifs:['camera','scissors','star','tape','arrow','bolt']}
  ];
  const page=document.createElement('section');page.className='customize-page themes-page';page.dataset.page='themes';page.hidden=true;
  page.innerHTML='<h3>Themes</h3><p>Choose your studio’s world. Panel shapes, drawings, controls and typography change together.</p><label class="bot-setting theme-artwork-setting"><span>Theme artwork<small>Illustrations and decorative section details</small></span><input type="checkbox" id="themeArtworkToggle" checked></label><div class="theme-choices" role="group" aria-label="Choose app theme"></div><p class="theme-current" role="status" aria-live="polite"></p>';
  pages.append(page);
  const tab=document.createElement('button');tab.type='button';tab.dataset.page='themes';tab.textContent='Themes';nav.insertBefore(tab,nav.children[1]);
  const select=key=>{pages.querySelectorAll('.customize-page').forEach(n=>n.hidden=n.dataset.page!==key);nav.querySelectorAll('button').forEach(n=>n.setAttribute('aria-current',n.dataset.page===key?'page':'false'));};
  // Use one navigation handler for dynamically added and existing sections.
  nav.querySelectorAll('button').forEach(button=>button.onclick=()=>select(button.dataset.page));
  const artToggle=page.querySelector('#themeArtworkToggle');
  document.querySelectorAll('.sched-form-card,.sched-config-card,.sched-subpanel,.cps-controls-sidebar,.cps-presets-sidebar,.caption-preset-disclosure,.watch-actions-menu,.watch-playback-options,.editor-more-popover,.workspace-account-popover,.modal-card').forEach(node=>node.classList.add('theme-world-panel'));
  document.querySelectorAll('.cps-panel-title,.scheduler-meta h2,.inspector-header h3,.editor-library-heading').forEach((node,index)=>{node.classList.add('theme-section-title');node.dataset.sectionNumber=String(index+1).padStart(2,'0');});
  const artwork=[];
  // Stable slots reserve their own space. No decoration enters media canvases.
  for(const selector of ['#ingestView .hero-content','.max-channel-heading','.system-dashboard-header > div:first-child','.scheduler-header > div:first-child','.cps-header-left']){
    const target=document.querySelector(selector);if(!target)continue;target.classList.add('theme-illustrated-heading');
    const img=document.createElement('img');img.className='theme-scene-art';img.alt='';img.setAttribute('aria-hidden','true');img.width=170;img.height=85;target.append(img);artwork.push({node:img,scene:true});
  }
  const slots=['.source-card','.project-settings-column','.new-framing-section','.system-metric-health','.system-metric-cpu','.system-metric-memory','.system-metric-workers','.system-history-card','.max-channel-card','#studioEmptyState .empty-state-card','.sched-form-card','.companion-customize-card'];
  slots.forEach((selector,index)=>document.querySelectorAll(selector).forEach(target=>{
    const strip=document.createElement('span');strip.className='theme-art-strip';strip.setAttribute('aria-hidden','true');strip.dataset.variant=String(index%6);target.append(strip);artwork.push({node:strip,index:index%6});
  }));
  const applyArtwork=()=>{document.body.dataset.themeArtwork=artToggle.checked?'on':'off';try{localStorage.setItem('autoclip.themeArtwork',artToggle.checked?'on':'off');}catch{}};
  try{artToggle.checked=localStorage.getItem('autoclip.themeArtwork')!=='off';}catch{}artToggle.onchange=applyArtwork;applyArtwork();
  const apply=id=>{
    const theme=themes.find(t=>t.id===id)||themes[0];document.body.dataset.theme=theme.id;document.documentElement.style.colorScheme=['dark','goth'].includes(theme.id)?'dark':'light';
    page.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme.id)));
    page.querySelector('.theme-current').textContent=`${theme.name} · ${theme.font}`;
    artwork.forEach(({node,scene,index})=>{const url=`/assets/themes/${theme.id}/${scene?'scene':theme.motifs[index]}.svg`;if(scene)node.src=url;else node.style.backgroundImage=`url("${url}")`;});
    try{localStorage.setItem('autoclip.theme',theme.id);}catch{}
    document.dispatchEvent(new CustomEvent('autoclip-theme-changed',{detail:{theme:theme.id}}));
  };
  for(const theme of themes){const button=document.createElement('button');button.type='button';button.className='theme-choice';button.dataset.themeChoice=theme.id;
    const preview=document.createElement('span');preview.className=`theme-workspace-preview preview-${theme.id}`;preview.setAttribute('aria-hidden','true');
    preview.style.setProperty('--preview-base',theme.colors[0]);preview.style.setProperty('--preview-surface',theme.colors[1]);preview.style.setProperty('--preview-accent',theme.colors[2]);
    preview.innerHTML='<span class="preview-sidebar"><i></i><i></i><i></i></span><span class="preview-heading">AUTOCLIP</span><span class="preview-canvas"><i>▶</i></span><span class="preview-inspector"><i></i><i></i><i></i></span><span class="preview-timeline"><i></i><i></i></span>';
    const drawing=document.createElement('img');drawing.src=`/assets/themes/${theme.id}/${theme.motifs[0]}.svg`;drawing.alt='';preview.append(drawing);
    const name=document.createElement('strong');name.textContent=theme.name;const description=document.createElement('small');description.textContent=theme.note;button.append(preview,name,description);button.onclick=()=>apply(theme.id);page.querySelector('.theme-choices').append(button);
  }
  let saved='dark';try{saved=localStorage.getItem('autoclip.theme')||'dark';}catch{}apply(saved);
})();
