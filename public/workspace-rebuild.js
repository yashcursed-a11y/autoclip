/* Workspace architecture: project dashboard, guided import and a dedicated edit suite. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s),make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  const home=$('#ingestView'),setup=$('#setupSection'),history=home?.querySelector('.history-section');
  if(!home||!setup||!history)return;
  document.body.classList.add('workspace-v3');
  const icon=name=>{
    const paths={import:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',channel:'M5 4h14v16H5zM9 8l7 4-7 4Z',edit:'M4 6h16v12H4zM9 6v12m-5-7h5m-5 4h5',plus:'M12 4v16M4 12h16',grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'};
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.plus}"/></svg>`;
  };
  const dashboard=make('section','workspace-dashboard');dashboard.setAttribute('aria-label','Project workspace');
  dashboard.innerHTML=`<div class="workspace-pagebar"><div><span class="workspace-overline">PERSONAL WORKSPACE</span><h1>Your studio.</h1></div><button type="button" class="workspace-new-project">${icon('plus')}<span>New project</span><kbd>N</kbd></button></div><div class="workspace-launchpad"><div class="workspace-launch-heading"><span class="workspace-overline">CREATE SOMETHING WORTH WATCHING</span><h2>Long footage.<br><em>Endless possibilities.</em></h2><p>Pick up where you left off, or give your next recording a fresh start.</p><span class="workspace-launch-number" aria-hidden="true">01 / CREATE</span></div><div class="workspace-start-actions"><button type="button" class="workspace-start-card" data-start="import"><span class="workspace-task-icon">${icon('import')}</span><span><strong>Import a recording</strong><small>A local file or a video link.</small></span><b>↗</b></button><button type="button" class="workspace-start-card" data-start="channel"><span class="workspace-task-icon">${icon('channel')}</span><span><strong>Channel clipper</strong><small>Discover moments across a channel.</small></span><b>↗</b></button><button type="button" class="workspace-start-card" data-start="resume"><span class="workspace-task-icon">${icon('edit')}</span><span><strong>Continue editing</strong><small class="workspace-resume-note">Open your most recent project.</small></span><b>↗</b></button></div></div>`;
  home.querySelector('.hero')?.setAttribute('hidden','');
  home.prepend(dashboard);
  const libraryBar=make('div','workspace-library-bar');libraryBar.innerHTML='<div><span class="workspace-overline">YOUR LIBRARY</span><h2>Recent projects <span class="workspace-project-count">0</span></h2></div><div class="workspace-library-controls"><label class="workspace-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search projects…" aria-label="Search projects"><kbd>⌘ K</kbd></label><div role="group" aria-label="Project display"><button type="button" data-library-view="grid" aria-pressed="true" title="Project grid">⊞</button><button type="button" data-library-view="list" aria-pressed="false" title="Project list">☰</button></div></div>';
  history.querySelector('.section-title-wrap')?.setAttribute('hidden','');history.prepend(libraryBar);dashboard.append(history);
  const noResults=make('p','workspace-no-results','No projects match your search.');noResults.hidden=true;noResults.setAttribute('role','status');history.append(noResults);
  const wizard=make('dialog','project-wizard');wizard.id='projectWizard';wizard.setAttribute('aria-labelledby','projectWizardTitle');
  wizard.innerHTML='<header class="project-wizard-header"><div><span class="workspace-overline">NEW PROJECT</span><h2 id="projectWizardTitle">Start with a recording.</h2></div><button type="button" class="project-wizard-close" aria-label="Close new project">×</button></header><nav class="project-wizard-steps" aria-label="Project setup steps"><button type="button" data-wizard-step="0" aria-current="step"><b>01</b> Recording</button><button type="button" data-wizard-step="1"><b>02</b> Style & framing</button><button type="button" data-wizard-step="2"><b>03</b> Review</button></nav><div class="project-wizard-body"></div><footer class="project-wizard-footer"><button type="button" class="project-wizard-back">Back</button><span class="project-wizard-position">Step 1 of 3</span><button type="button" class="project-wizard-next">Continue <span>→</span></button></footer>';
  document.body.append(wizard);
  const body=wizard.querySelector('.project-wizard-body');body.append(setup);
  const oldGrid=setup.querySelector('.project-create-layout'),sourceCol=setup.querySelector('.project-source-column'),settings=setup.querySelector('.project-settings-column'),framing=setup.querySelector('.new-framing-section'),action=setup.querySelector('.action-bar');
  const sourceStep=make('section','project-wizard-page wizard-source'),styleStep=make('section','project-wizard-page wizard-style'),reviewStep=make('section','project-wizard-page wizard-review');
  sourceStep.dataset.wizardPage='0';styleStep.dataset.wizardPage='1';reviewStep.dataset.wizardPage='2';
  if(sourceCol)sourceStep.append(sourceCol);
  if(framing)styleStep.append(framing);
  if(settings){styleStep.append(settings);settings.querySelector('.project-settings-heading')?.setAttribute('hidden','');settings.querySelector('.project-settings-description')?.setAttribute('hidden','');}
  reviewStep.innerHTML='<span class="workspace-overline">READY FOR THE GOOD PART?</span><h3>Your recording. Your rules.</h3><p>Check the details, then let the studio find your clips. You can fine-tune every cut in the editor.</p><dl class="project-review-details"></dl><button type="button" class="project-review-change">Change style & framing ↗</button>';
  const pages=make('div','project-wizard-pages');pages.append(sourceStep,styleStep,reviewStep);setup.append(pages);oldGrid?.remove();
  if(action)wizard.querySelector('footer').append(action);
  let step=0,opener=null;
  const sourceLabel=()=>$('#videoFile')?.files?.[0]?.name||$('#videoUrl')?.value.trim()||'No recording selected';
  function updateReview(){
    const selectText=id=>{const n=document.getElementById(id);return n?.selectedOptions?.[0]?.textContent||n?.querySelector('option:checked')?.textContent||n?.value||'Default';};
    const details=wizard.querySelector('.project-review-details');details.replaceChildren();
    [['Recording',sourceLabel()],['Canvas',selectText('aspectRatio')],['Framing',selectText('framingPresetSelect')],['Caption style',selectText('captionPresetSelect')],['Clip target',`${$('#clipCount')?.value||'Auto'} clips`]].forEach(([term,value])=>{const row=make('div','');row.append(make('dt','',term),make('dd','',value));details.append(row);});
  }
  function setStep(value){step=Math.max(0,Math.min(2,value));wizard.dataset.step=String(step);pages.querySelectorAll('[data-wizard-page]').forEach(p=>p.hidden=Number(p.dataset.wizardPage)!==step);wizard.querySelectorAll('[data-wizard-step]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.wizardStep)===step?'step':'false'));wizard.querySelector('.project-wizard-back').disabled=step===0;wizard.querySelector('.project-wizard-next').hidden=step===2;wizard.querySelector('.project-wizard-position').textContent=`Step ${step+1} of 3`;if(action)action.hidden=step!==2;wizard.querySelector('h2').textContent=['Start with a recording.','Give it your signature.','Make the first cut.'][step];if(step===2)updateReview();body.scrollTop=0;}
  function openNewProject(){opener=document.activeElement;setStep(0);if(typeof wizard.showModal==='function')wizard.showModal();else wizard.setAttribute('open','');}
  function closeNewProject(){if(!wizard.hasAttribute('open'))return;if(typeof wizard.close==='function')wizard.close();wizard.removeAttribute('open');opener?.focus?.();}
  wizard.querySelector('.project-wizard-close').onclick=closeNewProject;wizard.querySelector('.project-wizard-back').onclick=()=>setStep(step-1);wizard.querySelector('.project-wizard-next').onclick=()=>setStep(step+1);wizard.querySelector('.project-review-change').onclick=()=>setStep(1);wizard.querySelectorAll('[data-wizard-step]').forEach(b=>b.onclick=()=>setStep(Number(b.dataset.wizardStep)));
  wizard.addEventListener('click',e=>{if(e.target!==wizard)return;const r=wizard.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeNewProject();});
  dashboard.querySelector('.workspace-new-project').onclick=openNewProject;
  dashboard.querySelector('[data-start=import]').onclick=openNewProject;
  dashboard.querySelector('[data-start=channel]').onclick=()=>$('#railMaxAutomateBtn')?.click();
  const resume=dashboard.querySelector('[data-start=resume]');resume.onclick=()=>{const job=state.currentJob||state.jobs[0];if(job)showJob(job,true);else openNewProject();};
  const search=dashboard.querySelector('input[type=search]'),jobs=$('#jobsList');let libraryView='grid';try{libraryView=localStorage.getItem('autoclip.libraryView')==='list'?'list':'grid';}catch{}
  function filterProjects(){const term=search.value.trim().toLowerCase();let visible=0;jobs.querySelectorAll('.job-item').forEach(card=>{const match=!term||card.textContent.toLowerCase().includes(term);card.classList.toggle('workspace-filtered-out',!match);if(match)visible++;});noResults.hidden=!term||visible>0;}
  function applyLibrary(){jobs.dataset.libraryView=libraryView;dashboard.querySelectorAll('[data-library-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryView===libraryView)));try{localStorage.setItem('autoclip.libraryView',libraryView);}catch{}}
  dashboard.querySelectorAll('[data-library-view]').forEach(b=>b.onclick=()=>{libraryView=b.dataset.libraryView;applyLibrary();});search.addEventListener('input',filterProjects);
  function decorateProjects(){
    dashboard.querySelector('.workspace-project-count').textContent=String(state.jobs.length);
    resume.disabled=!state.jobs.length&&!state.currentJob;dashboard.querySelector('.workspace-resume-note').textContent=resume.disabled?'Your first project starts with an import.':'Pick up the last recording you worked on.';
    if(!state.jobs.length){if(!jobs.querySelector('.workspace-empty-library')){const empty=make('div','workspace-empty-library');empty.innerHTML=`<span class="workspace-empty-icon">${icon('edit')}</span><h3>A clean slate.</h3><p>Your recordings and cuts will live here.</p><button type="button">Import your first recording ↗</button>`;empty.querySelector('button').onclick=openNewProject;jobs.replaceChildren(empty);}}
    jobs.querySelectorAll('.job-item').forEach((card,i)=>{
      if(!card.querySelector('.workspace-project-cover')){const cover=make('div','workspace-project-cover');cover.setAttribute('aria-hidden','true');cover.style.setProperty('--cover-phase',String([...card.dataset.jobId].reduce((a,c)=>a+c.charCodeAt(0),0)%3));cover.innerHTML=`<span class="workspace-cover-index">PROJECT / ${String(i+1).padStart(2,'0')}</span><span class="workspace-cover-film">${icon('edit')}</span><span class="workspace-cover-open">Open editor ↗</span>`;card.prepend(cover);card.tabIndex=0;card.setAttribute('role','button');card.addEventListener('keydown',e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});}
    });applyLibrary();filterProjects();
  }
  const originalRender=renderJobs;renderJobs=function(...args){const result=originalRender.apply(this,args);decorateProjects();return result;};decorateProjects();
  function connectNavigation(){const originalSwitch=window.switchAppView;if(typeof originalSwitch!=='function'||originalSwitch.workspaceConnected)return;const wrapped=function(view,...args){if(view!=='ingest')closeNewProject();return originalSwitch.call(this,view,...args);};wrapped.workspaceConnected=true;window.switchAppView=wrapped;}connectNavigation();document.addEventListener('autoclip-ready',connectNavigation);
  const originalShow=showJob;showJob=function(...args){closeNewProject();return originalShow.apply(this,args);};
  $('#emptyToIngestBtn')?.addEventListener('click',openNewProject);
  document.addEventListener('keydown',event=>{if(home.classList.contains('hidden')||wizard.hasAttribute('open')||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('.modal-backdrop:not(.hidden),.companion-customize:not([hidden])'))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();}else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='n'){event.preventDefault();openNewProject();}});
  // A genuine editing workbench: tools become a horizontal mode bar; range marking moves into properties.
  const layout=$('.studio-layout-capcut'),toolbar=$('.editor-toolbar'),viewer=$('.preview-column'),inspector=$('.inspector-column'),range=$('.manual-range-bar');
  if(layout&&toolbar){toolbar.classList.add('workspace-editor-modebar');layout.prepend(toolbar);}
  if(viewer){const format=viewer.querySelector('.canvas-header-bar'),transport=viewer.querySelector('.editor-playback');if(format&&transport)viewer.insertBefore(format,transport);}
  if(inspector&&range){const block=make('section','workspace-range-inspector');block.innerHTML='<span class="workspace-overline">SOURCE SELECTION</span><h3>Make a precise cut.</h3>';block.append(range);inspector.prepend(block);}
  const library=$('.candidates-column');if(library&&!library.querySelector('.workspace-bin-title'))library.prepend(make('div','workspace-bin-title','PROJECT LIBRARY'));
  const image=$('.studio-source-tile img');if(image)new MutationObserver(()=>{if(image.src?.startsWith('data:image/'))$('#tracksLanesContent')?.style.setProperty('--recording-frame',`url(${JSON.stringify(image.src)})`);}).observe(image,{attributes:true,attributeFilter:['src']});
  const workspaceLabel=$('#railIngestBtn .rail-label');if(workspaceLabel)workspaceLabel.textContent='Workspace';
  const homeIcon=$('#railIngestBtn .rail-icon');if(homeIcon)homeIcon.innerHTML=icon('grid');
  window.studioWorkspace={openNewProject,closeNewProject,setStep};
  window.dispatchEvent(new Event('resize'));
})();


