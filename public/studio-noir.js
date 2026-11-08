/* Studio Noir. An independent presentation layer; original controls keep their IDs. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  document.body.classList.add('studio-noir');
  const hero=$('#ingestView .hero-content');
  if(hero){
    hero.querySelector('h1').innerHTML='Good footage.<br><em>Great possibilities.</em>';
    hero.querySelector('.eyebrow').textContent='THE CREATOR’S DESK / NEW PROJECT';
    hero.querySelector('.lede').textContent='One recording. Your next collection of great cuts. Bring the footage; keep your signature.';
    if(!hero.querySelector('.noir-hero-index')){
      const index=document.createElement('span');index.className='noir-hero-index';index.setAttribute('aria-hidden','true');index.innerHTML='<span>AUTOCLIPIN</span><strong>01</strong><small>THE BEGINNING<br>OF SOMETHING GOOD.</small>';hero.append(index);
    }
  }
  const rename=(selector,text)=>{const n=$(selector);if(n)n.textContent=text;};
  rename('.project-settings-heading','The finishing touches.');
  rename('.project-settings-description','A few choices now. Every detail editable later.');
  rename('.project-pane-label','01 / THE RECORDING');
  rename('.sidebar-section-label','YOUR WORKSPACE');
  rename('.editor-workspace-label','EDIT SUITE');
  rename('.studio-hub-trigger','Studio tools');
  rename('.companion-customize-trigger','Customize');
  rename('.library-drawer-close','Hide library');
  rename('#createJob','Find my clips');
  rename('#dropZone > strong','Your next story starts here.');
  rename('#dropZone > small','Drop a video, or click to browse your files.');
  const dropIcon=$('#dropZone .drop-icon');if(dropIcon)dropIcon.innerHTML='<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 9H9v6M33 9h6v6M9 33v6h6M39 33v6h-6" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="20" height="20" rx="4" stroke="currentColor" stroke-width="1.5"/><path d="m21 19 9 5-9 5Z" fill="currentColor"/></svg>';
  const sourceNames={file:'Local video',url:'Video link',max:'Channel clipper'};
  document.querySelectorAll('.source-tabs [data-tab]').forEach(tab=>{if(sourceNames[tab.dataset.tab])tab.textContent=sourceNames[tab.dataset.tab];});
  // Neutral editorial labels, without touching status values or live user content.
  const dockLabels={railMaxAutomateBtn:'Automate',railIngestBtn:'Create',navStudioBtn:'Edit',navCaptionPhoneBtn:'Captions',navWatchBtn:'Watch',navSchedulerBtn:'Publish',navProcessesBtn:'System'};
  Object.entries(dockLabels).forEach(([id,label])=>{const n=document.getElementById(id)?.querySelector('.rail-label');if(n)n.textContent=label;});
  const stateTag=document.createElement('span');stateTag.className='noir-edition';stateTag.textContent='NOIR / 01';stateTag.setAttribute('aria-hidden','true');$('.brand-mark')?.append(stateTag);
  // Keep the original trigger and actions; make the tools hub a legible command sheet.
  const hub=$('.studio-hub-panel');if(hub){const title=hub.querySelector('.studio-hub-center strong');if(title)title.textContent='Studio tools';}
  const cleanButtons=['#loadMasterVideoBtn','#restoreAiClipsBtn','#workspaceAutoPilotBtn','#emptyToIngestBtn'];
  const labels=['Full recording','AI selects','Auto-pilot','Create a project'];
  cleanButtons.forEach((selector,i)=>{const n=$(selector);if(n)n.textContent=labels[i];});
  const tone=()=>{document.body.classList.toggle('noir-active',document.body.dataset.theme==='dark'&&document.body.dataset.uiStyle!=='retro95');};
  document.addEventListener('autoclip-theme-changed',tone);tone();
})();
