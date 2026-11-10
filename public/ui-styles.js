/* Layout/chrome styles are independent of saved theme and typography. */
(() => {
  const nav=document.querySelector('.customize-nav'),pages=document.querySelector('.customize-pages');if(!nav||!pages)return;
  const styles=[
    {id:'minimal',name:'Minimal',note:'Ambient motion film background with clear, dark studio panels.',toolbar:'side',menu:'grid'},
    {id:'modern',name:'Modern Studio',note:'Capsule navigation, soft panels and floating tools.',toolbar:'side',menu:'radial'},
    {id:'retro95',name:'Retro ’95',note:'Classic desktop windows, bevels and pixel icons.',toolbar:'side',menu:'grid'},
  ];
  const page=document.createElement('section');page.className='customize-page ui-styles-page';page.dataset.page='ui-styles';page.hidden=true;
  page.innerHTML='<h3>UI Styles</h3><p>Change the structure of your studio, from modern creative software to the early web.</p><div class="ui-style-options" role="group" aria-label="Interface style"><button type="button" data-ui-choice="modern"><span class="ui-style-preview preview-modern"><i>AutoClip</i><span>▶</span><b></b></span><strong>Modern Studio</strong><small>Soft panels, capsule navigation, floating tools.</small></button><button type="button" data-ui-choice="retro95"><span class="ui-style-preview preview-retro"><i>AutoClip.exe</i><span>▶</span><b></b></span><strong>Retro ’95</strong><small>Desktop windows, bevelled buttons, pixel icons and blue links.</small></button></div><label class="bot-setting"><span>Classic ’95 colors<small>Turn off to combine retro controls with your selected theme.</small></span><input type="checkbox" id="retroClassicPalette" checked></label><p class="ui-style-status" role="status" aria-live="polite"></p>';
  const options=page.querySelector('.ui-style-options');options.replaceChildren();
  for(const style of styles){
    const button=document.createElement('button');button.type='button';button.dataset.uiChoice=style.id;
    const preview=document.createElement('span');preview.className=`ui-style-preview preview-${style.id==='retro95'?'retro':style.id}`;preview.setAttribute('aria-hidden','true');
    preview.innerHTML='<i>AutoClip</i><span>▶</span><b></b><em></em>';
    const name=document.createElement('strong');name.textContent=style.name;const note=document.createElement('small');note.textContent=style.note;
    button.append(preview,name,note);options.append(button);
  }
  pages.append(page);
  const tab=document.createElement('button');tab.type='button';tab.dataset.page='ui-styles';tab.textContent='UI Styles';nav.insertBefore(tab,nav.querySelector('[data-page=themes]'));
  nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{pages.querySelectorAll('.customize-page').forEach(n=>n.hidden=n.dataset.page!==button.dataset.page);nav.querySelectorAll('button').forEach(n=>n.setAttribute('aria-current',n===button?'page':'false'));});
  let prefs={style:'minimal',classic:true};
  try{
    const saved=JSON.parse(localStorage.getItem('autoclip.uiStyle')||'{}');
    if(saved&&saved.style)prefs.style=saved.style;
    if(saved&&typeof saved.classic==='boolean')prefs.classic=saved.classic;
  }catch{}
  if(!localStorage.getItem('autoclip.uiStyle.v2.1')){
    prefs.style='minimal';
    try{localStorage.setItem('autoclip.uiStyle.v2.1','true');}catch{}
  }
  if(prefs.style==='kio')prefs.style='minimal';
  if(!styles.some(style=>style.id===prefs.style))prefs.style='minimal';
  // A local preview link explicitly selects an existing UI; normal launches keep the saved choice.
  const requestedStyle=new URLSearchParams(window.location.search).get('ui');
  const previewStyle=requestedStyle==='kio'?'minimal':requestedStyle;
  if(styles.some(style=>style.id===previewStyle))prefs.style=previewStyle;
  const palette=page.querySelector('#retroClassicPalette');
  // Original pixel drawings; existing SVG icons are retained for Modern.
  const drawings={
    railMaxAutomateBtn:'<path fill="#ffdb00" stroke="#805900" d="M9 1 3 9h4l-1 6 7-9H9Z"/>',
    railIngestBtn:'<path fill="#eee" stroke="#333" d="M3 1h7l3 3v11H3Z"/><path stroke="#008080" stroke-width="2" d="M8 5v7M5 8h6"/>',
    navStudioBtn:'<path fill="#555" stroke="#111" d="M1 2h14v12H1Z"/><path stroke="#fff" stroke-width="2" d="M3 3v2m0 2v2m0 2v2m10-10v2m0 2v2m0 2v2"/><path fill="#c4b5fd" d="M5 4h6v8H5Z"/>',
    navCaptionPhoneBtn:'<path fill="#eee" stroke="#333" d="M3 1h10v14H3Z"/><path stroke="#000080" stroke-width="2" d="M5 5h6M5 8h4m-4 3h6"/>',
    navWatchBtn:'<path fill="#aaa" stroke="#333" d="M1 1h14v11H1Z"/><path fill="#008080" d="M3 3h10v7H3Z"/><path stroke="#333" d="M8 12v3M4 15h8"/>',
    navSchedulerBtn:'<path fill="#eee" stroke="#333" d="M2 3h12v12H2Z"/><path fill="#000080" d="M2 3h12v4H2Z"/><path stroke="#333" d="M5 1v4m6-4v4M4 9h2m2 0h2m2 0h1m-9 3h2m2 0h2"/>',
    navProcessesBtn:'<path fill="#aaa" stroke="#333" d="M2 1h12v14H2Z"/><path fill="#eee" d="M4 3h8v4H4Z"/><path stroke="#008000" d="m4 11 2-2 2 3 3-3"/><path fill="#080" d="M10 13h2v1h-2Z"/>',
    railHistoryBtn:'<path fill="#ffd54f" stroke="#806000" d="M1 3h6l2 2h6v9H1Z"/><path fill="#ffe890" stroke="#806000" d="m1 8 14-1-2 8H1Z"/>'
  };
  for(const [id,drawing] of Object.entries(drawings)){const button=document.getElementById(id);if(!button)continue;const icon=document.createElement('span');icon.className='retro-nav-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 16 16" width="22" height="22" shape-rendering="crispEdges">'+drawing+'</svg>';button.prepend(icon);}
  const apply=()=>{const style=styles.find(item=>item.id===prefs.style);document.body.dataset.uiStyle=prefs.style;document.body.dataset.uiToolbar=style.toolbar;document.body.dataset.uiMenu=style.menu;document.body.dataset.retroPalette=prefs.classic?'classic':'theme';document.body.classList.toggle('retro95-ui',prefs.style==='retro95');document.body.classList.remove('ui-world');palette.checked=!!prefs.classic;palette.closest('label').hidden=prefs.style!=='retro95';
    page.querySelectorAll('[data-ui-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.uiChoice===prefs.style)));
    page.querySelector('.ui-style-status').textContent=prefs.style==='retro95'?`Retro ’95 · ${prefs.classic?'classic desktop palette':'your theme colors'}. Your font selection is preserved.`:prefs.style==='minimal'?'Minimal active · compact graphite desk, soft controls and full-size editing. Your saved theme and font preferences are retained.':`${style.name} active. Your theme and font selection are preserved.`;
    try{localStorage.setItem('autoclip.uiStyle',JSON.stringify(prefs));}catch{}
    document.dispatchEvent(new CustomEvent('autoclip-ui-changed',{detail:{style:prefs.style}}));
    window.dispatchEvent(new Event('resize'));
  };
  page.querySelectorAll('[data-ui-choice]').forEach(button=>button.onclick=()=>{prefs.style=button.dataset.uiChoice;apply();});palette.onchange=()=>{prefs.classic=palette.checked;apply();};apply();
})();
