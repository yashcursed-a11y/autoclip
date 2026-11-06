/* Structural layout: move original controls, preserve their identities and events. */
(() => {
  const $=s=>document.querySelector(s);
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  document.body.classList.add('workspace-redesign');

  // Full project sidebar on setup pages; compact navigation while editing.
  const logo=$('.rail-logo');logo?.append(make('span','sidebar-wordmark','AutoClip'));
  const nav=$('.rail-nav');nav?.prepend(make('div','sidebar-section-label','WORKSPACE'));
  const labels={railIngestBtn:'New project',navStudioBtn:'Editor',navCaptionPhoneBtn:'Captions',navWatchBtn:'Watch',navSchedulerBtn:'Publishing',navProcessesBtn:'System',railHistoryBtn:'Project library',railMaxAutomateBtn:'MAX Channel Clipper'};
  for(const [id,label] of Object.entries(labels)){const n=document.getElementById(id)?.querySelector('.rail-label');if(n)n.textContent=label;}

  // Top bar secondary actions live in a native menu, not a row of badges.
  const menu=make('details','workspace-account-menu');const summary=make('summary','','Connections & tools');const menuBody=make('div','workspace-account-popover');
  menu.append(summary,menuBody);
  for(const selector of ['#geminiBadge','#youtubeBadge','#driveBadge','#sysStatusBtn','.landing-pill']){const node=$(selector);if(node)menuBody.append(node);}
  $('.topbar-right')?.append(menu);

  const setup=$('#setupSection');
  if(setup){
    const originals=[...setup.children];
    const source=setup.querySelector('.source-card'),framing=setup.querySelector('.new-framing-section');
    const grid=make('div','project-create-layout'),left=make('div','project-source-column'),right=make('aside','project-settings-column');
    grid.append(left,right);
    left.append(make('div','project-pane-label','01  /  RECORDING'));
    if(source)left.append(source);
    if(framing)left.append(framing);
    right.append(make('h2','project-settings-heading','Make it yours'),make('p','project-settings-description','Set the format. Fine-tune the details when you need to.'));
    const intent=make('details','project-setting-disclosure');intent.append(make('summary','','What should we look for?'));
    const advanced=make('details','project-setting-disclosure');advanced.append(make('summary','','Branding, storage & discovery'));
    for(const node of originals){
      if(node===source||node===framing)continue;
      if(node.classList.contains('steps')){node.hidden=true;continue;}
      if(node.classList.contains('action-bar'))continue;
      if(node.classList.contains('section-title-wrap')||node.id==='templates'||node.id==='customWrap'){intent.append(node);continue;}
      if(node.classList.contains('settings-grid')){right.append(node);continue;}
      if(node.tagName==='DETAILS'){right.append(node);continue;}
      advanced.append(node);
    }
    right.append(intent,advanced);
    const action=originals.find(n=>n.classList.contains('action-bar'));if(action)right.append(action);
    setup.append(grid);
    // The old marketing hero becomes the project page title.
    const heading=$('#ingestView .hero h1');if(heading)heading.textContent='Create a project';
    const lede=$('#ingestView .hero .lede');if(lede)lede.textContent='Import a recording, choose how it should look, and find your clips.';
    const eyebrow=$('#ingestView .hero .eyebrow');if(eyebrow)eyebrow.textContent='YOUR WORKSPACE';
    const create=$('#createJob');if(create)create.replaceChildren(document.createTextNode('Create clips →'));
  }

  // The editor now has a vertical tool dock, a clean canvas and a right drawer.
  const viewport=$('.studio-main-viewport'),toolLeft=$('.editor-toolbar-left'),tabs=$('.editor-tabs');
  if(viewport&&tabs){
    const dock=make('nav','editor-tools-dock');dock.setAttribute('aria-label','Editing tools');
    const media=toolLeft?.querySelector('.editor-tool');if(media)dock.append(media);
    dock.append(tabs);viewport.prepend(dock);
    viewport.classList.add('library-closed');
    media?.setAttribute('aria-pressed','false');
    if(toolLeft){toolLeft.querySelector('.editor-toolbar-divider')?.remove();toolLeft.append(make('span','editor-workspace-label','EDIT WORKSPACE'));}
    const library=$('.candidates-column');
    if(library){const close=make('button','library-drawer-close','Close media ×');close.type='button';close.onclick=()=>{viewport.classList.add('library-closed');media?.setAttribute('aria-pressed','false');};library.prepend(close);}
    // Put the immediate framing choices first; optional controls fold away.
    const framingGrid=$('#subFraming .sub-grid');
    if(framingGrid){
      const mode=$('#editFramingMode')?.closest('label'),aspect=$('#editAspect')?.closest('label'),analysis=framingGrid.querySelector('.adaptive-framing-controls');
      const extra=make('details','property-disclosure');extra.append(make('summary','','Manual adjustments & timing'));
      for(const node of [...framingGrid.children])if(node!==mode&&node!==aspect&&node!==analysis)extra.append(node);
      if(mode)framingGrid.append(mode);if(aspect)framingGrid.append(aspect);if(analysis)framingGrid.append(analysis);framingGrid.append(extra);
    }
    // Properties stay closed until a tool is chosen; the normal preview stays large.
    const more=make('details','editor-more-actions'),moreLabel=make('summary','','More'),moreBody=make('div','editor-more-popover');more.append(moreLabel,moreBody);
    for(const id of ['openPhoneCaptionFromHeaderBtn','workspaceAutoPilotBtn']){const node=document.getElementById(id);if(node)moreBody.append(node);}
    $('.workspace-controls')?.append(more);
  }
  const presets=$('.cps-presets-sidebar'),captionControls=$('.cps-controls-sidebar');
  if(presets&&captionControls){
    const gallery=make('details','caption-preset-disclosure');gallery.append(make('summary','','Choose a caption style'),presets);captionControls.prepend(gallery);
  }
})();
