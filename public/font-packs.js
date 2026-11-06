/* Typography is a saved preference independent of theme and caption styling. */
(() => {
  const nav=document.querySelector('.customize-nav'),pages=document.querySelector('.customize-pages');if(!nav||!pages)return;
  const families=['Space Grotesk','Syne','Unbounded','Oxanium','Fraunces','Fredoka','Bricolage Grotesque','Space Mono','UnifrakturCook','Rubik Glitch'];
  const packs=[
    {id:'precision',name:'Precision',heading:'Space Grotesk',ui:'Space Grotesk',sample:'Make the cut.',note:'Sharp, balanced, all-day studio type.'},
    {id:'afterhours',name:'After Hours',heading:'Syne',ui:'Space Grotesk',sample:'Out of frame.',note:'Expressive art-school curves.'},
    {id:'widefuture',name:'Wide Future',heading:'Unbounded',ui:'Space Grotesk',sample:'NO LIMITS',note:'Wide silhouettes. Big presence.'},
    {id:'neongrid',name:'Neon Grid',heading:'Oxanium',ui:'Space Grotesk',sample:'NEXT FRAME',note:'Angular sci-fi, clean controls.'},
    {id:'softserve',name:'Soft Serve',heading:'Fredoka',ui:'Fredoka',sample:'a little magic',note:'Soft, playful, rounded everywhere.'},
    {id:'editorial',name:'Editorial',heading:'Fraunces',ui:'Space Grotesk',sample:'Worth a look.',note:'Characterful serif meets modern UI.'},
    {id:'workshop',name:'Workshop',heading:'Bricolage Grotesque',ui:'Bricolage Grotesque',sample:'Oddly perfect.',note:'Warm, quirky, carefully imperfect.'},
    {id:'terminal',name:'Terminal',heading:'Space Mono',ui:'Space Grotesk',sample:'PLAY_01',note:'Code-room lettering, readable tools.'},
    {id:'nocturne',name:'Nocturne',heading:'UnifrakturCook',ui:'Space Grotesk',sample:'After Midnight',note:'Blackletter drama, clear interface.'},
    {id:'signal',name:'Broken Signal',heading:'Rubik Glitch',ui:'Space Grotesk',sample:'OFF AIR',note:'Glitched display type with steady UI.'}
  ];
  let prefs={heading:'theme',ui:'theme'};try{prefs={...prefs,...JSON.parse(localStorage.getItem('autoclip.typography')||'{}')};}catch{}
  for(const role of ['heading','ui'])if(prefs[role]!=='theme'&&!families.includes(prefs[role]))prefs[role]='theme';
  const page=document.createElement('section');page.className='customize-page fonts-page';page.dataset.page='fonts';page.hidden=true;
  page.innerHTML='<h3>Font packs</h3><p>Change the voice of your studio. Every pack works with every theme.</p><div class="font-live-specimen"><span class="font-specimen-label">LIVE PREVIEW</span><span class="font-live-heading">Your next great cut.</span><span class="font-live-body">Source footage. Smart framing. A story worth sharing.</span><code>00:14:22.500</code></div><div class="font-role-controls"><label>Headings<select id="customHeadingFont" aria-label="Heading font"></select></label><label>Interface<select id="customInterfaceFont" aria-label="Interface font"></select></label></div><button type="button" class="font-theme-reset">Use theme fonts</button><div class="font-pack-grid" role="group" aria-label="Choose font pack"></div><p class="font-selection-status" role="status" aria-live="polite"></p><p class="font-pack-footnote">Bundled locally · works offline. App typography only; your video captions keep their own styling.</p>';
  pages.append(page);
  const tab=document.createElement('button');tab.type='button';tab.dataset.page='fonts';tab.textContent='Fonts';nav.insertBefore(tab,nav.querySelector('[data-page=editor]'));
  nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{pages.querySelectorAll('.customize-page').forEach(n=>n.hidden=n.dataset.page!==button.dataset.page);nav.querySelectorAll('button').forEach(n=>n.setAttribute('aria-current',n===button?'page':'false'));});
  const heading=page.querySelector('#customHeadingFont'),ui=page.querySelector('#customInterfaceFont');
  const stack=name=>`"${name}", "Segoe UI", sans-serif`;
  for(const select of [heading,ui])for(const name of ['theme',...families]){const option=document.createElement('option');option.value=name;option.textContent=name==='theme'?'Follow theme':name;select.append(option);}
  const apply=()=>{
    for(const [role,variable] of [['heading','--theme-heading-font'],['ui','--theme-font']]){if(prefs[role]==='theme')document.body.style.removeProperty(variable);else document.body.style.setProperty(variable,stack(prefs[role]));}
    // Following theme headings stays independent of a custom interface family.
    if(prefs.heading==='theme'&&prefs.ui!=='theme'){
      const defaults={dark:'Segoe UI',white:'Calibri',minimal:'Bahnschrift',flurry:'Trebuchet MS',goth:'Georgia',sticker:'Comic Sans MS'};
      document.body.style.setProperty('--theme-heading-font',stack(defaults[document.body.dataset.theme]||defaults.dark));
    }
    heading.value=prefs.heading;ui.value=prefs.ui;
    const match=packs.find(pack=>pack.heading===prefs.heading&&pack.ui===prefs.ui);
    page.querySelectorAll('[data-font-pack]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fontPack===match?.id)));
    page.querySelector('.font-selection-status').textContent=match?`${match.name} applied across all themes.`:prefs.heading==='theme'&&prefs.ui==='theme'?'Following the current theme’s fonts.':`Custom mix · ${prefs.heading==='theme'?'Theme headings':prefs.heading} + ${prefs.ui==='theme'?'Theme interface':prefs.ui}`;
    try{localStorage.setItem('autoclip.typography',JSON.stringify(prefs));}catch{}
  };
  for(const pack of packs){const button=document.createElement('button');button.type='button';button.className='font-pack-card';button.dataset.fontPack=pack.id;
    const sample=document.createElement('span');sample.className='font-pack-sample';sample.textContent=pack.sample;sample.style.setProperty('font-family',stack(pack.heading),'important');
    const name=document.createElement('strong');name.textContent=pack.name;
    const note=document.createElement('small');note.textContent=pack.note;
    const detail=document.createElement('span');detail.className='font-pack-families';detail.textContent=pack.heading===pack.ui?pack.heading:`${pack.heading} + ${pack.ui}`;
    button.append(sample,name,note,detail);button.onclick=()=>{prefs={heading:pack.heading,ui:pack.ui};apply();};page.querySelector('.font-pack-grid').append(button);
  }
  heading.onchange=()=>{prefs.heading=heading.value;apply();};ui.onchange=()=>{prefs.ui=ui.value;apply();};
  page.querySelector('.font-theme-reset').onclick=()=>{prefs={heading:'theme',ui:'theme'};apply();};
  document.addEventListener('autoclip-theme-changed',apply);
  apply();
})();
