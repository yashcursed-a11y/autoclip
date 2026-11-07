/* Minimal is a layout, independently selectable from the color theme.
   Move live controls, never duplicate IDs or detach their event handlers. */
(() => {
  const flow = document.createElement('nav');
  flow.className = 'minimal-flow'; flow.setAttribute('aria-label','Clipping workflow');
  const stages = [['ingest','ingestView','01','Create'],['studio','studioView','02','Edit'],['phone_feed','phoneFeedView','03','Finish'],['scheduler','schedulerView','04','Publish']];
  for (const [view,id,number,label] of stages) {
    const button = document.createElement('button'); button.type = 'button';
    const index = document.createElement('span'); index.textContent = number;
    button.append(index,document.createTextNode(label));
    button.addEventListener('click',()=>window.switchAppView?.(view));
    flow.append(button);
    const target = document.getElementById(id);
    const update = () => {
      const current = target && !target.classList.contains('hidden')?'step':'false';
      if (button.getAttribute('aria-current') !== current) button.setAttribute('aria-current',current);
    };
    if (target) new MutationObserver(update).observe(target,{attributes:true,attributeFilter:['class']});
    update();
  }
  document.querySelector('.app-content')?.prepend(flow);
  const finishTools = document.createElement('section');
  finishTools.className = 'minimal-finish-tools';
  finishTools.setAttribute('aria-label','Finishing tools');
  for (const [label,detail,tab] of [
    ['Captions','Font, highlight, position and safe zones','captions'],
    ['Watermark','Your handle or logo, placed precisely','watermark'],
    ['Framing','Aspect ratio, crop and speaker layout','framing'],
    ['Refine the cut','Correct timing and review the transcript','transcript']
  ]) {
    const button = document.createElement('button'); button.type = 'button';
    const heading = document.createElement('strong'); heading.textContent = label;
    const description = document.createElement('small'); description.textContent = detail;
    button.append(heading,description);
    button.addEventListener('click',()=>{
      const clipId = document.querySelector('.pfeed-nav-card.active')?.dataset.clipId;
      if (clipId) window.selectClip?.(clipId,true);
      window.switchAppView?.('studio');
      document.querySelector(`.editor-tab[data-subtab="${tab}"]`)?.click();
    });
    finishTools.append(button);
  }
  document.querySelector('.pfeed-sidebar-right')?.append(finishTools);
  const feedRender = document.querySelector('.pfeed-sidebar-right > .primary-btn');
  feedRender?.addEventListener('click',event=>{
    if (document.body.dataset.uiStyle !== 'minimal') return;
    const clipId = document.querySelector('.pfeed-nav-card.active')?.dataset.clipId;
    const slide = [...document.querySelectorAll('.pfeed-clip-slide')].find(node=>node.dataset.clipId===clipId);
    event.preventDefault(); event.stopImmediatePropagation();
    slide?.querySelector('[data-action="render-single"]')?.click();
  },true);
  const grid = document.querySelector('.sched-composer-grid');
  if (!grid) return;
  const originals = [...grid.children];
  if (originals.length < 2) return;
  const moves = [];
  // Reference composition: source + output together, small framing cards below,
  // optional settings in one strip, and the two real launch actions side by side.
  const createLayout=document.querySelector('.project-create-layout');
  const createRight=document.querySelector('.project-settings-column');
  const framing=document.querySelector('.new-framing-section');
  const extras=document.createElement('div');extras.className='minimal-setup-extras';
  const frameDetails=document.createElement('details');frameDetails.className='minimal-framing-details';
  const frameSummary=document.createElement('summary');frameSummary.textContent='Framing adjustments';frameDetails.append(frameSummary);
  const library=document.createElement('dialog');library.className='minimal-project-library';library.setAttribute('aria-label','Project library');
  const libraryHeader=document.createElement('header');const libraryTitle=document.createElement('h2');libraryTitle.textContent='Your projects';
  const libraryClose=document.createElement('button');libraryClose.type='button';libraryClose.textContent='×';libraryClose.setAttribute('aria-label','Close project library');libraryClose.onclick=()=>library.close();
  libraryHeader.append(libraryTitle,libraryClose);library.append(libraryHeader);
  library.addEventListener('click',event=>{if(event.target===library)library.close();});
  document.getElementById('railHistoryBtn')?.addEventListener('click',event=>{
    if(document.body.dataset.uiStyle!=='minimal')return;
    event.preventDefault();event.stopImmediatePropagation();if(!library.open)library.showModal();
  },true);
  const desk = document.createElement('div');
  desk.className = 'minimal-publish-desk';
  const panels = {};
  for (const [key, title] of Object.entries({preview:'01 / Preview',channels:'02 / Channels',schedule:'03 / Schedule',copy:'04 / Post copy'})) {
    const panel = document.createElement('section');
    panel.className = `minimal-desk-panel minimal-desk-${key}`;
    const heading = document.createElement('h3'); heading.textContent = title;
    panel.append(heading); desk.append(panel); panels[key] = panel;
  }
  const navigation = document.createElement('div'); navigation.className = 'minimal-clip-navigation';
  const position = document.createElement('span'); position.setAttribute('aria-live','polite');
  const stepButtons = [];
  const select = document.getElementById('schedClipSelect');
  for (const [delta,label] of [[-1,'Previous clip'],[1,'Next clip']]) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = delta < 0 ? '↑' : '↓'; button.setAttribute('aria-label',label);
    button.addEventListener('click', () => {
      if (!select) return;
      const options = [...select.options].filter(option => option.value && !option.disabled);
      const current = options.findIndex(option => option.value === select.value);
      const next = options[Math.max(0,Math.min(options.length-1,current+delta))];
      if (next) { select.value = next.value; select.dispatchEvent(new Event('change',{bubbles:true})); }
    }); navigation.append(button); stepButtons.push(button);
  }
  navigation.insertBefore(position,navigation.lastChild);
  panels.preview.append(navigation);
  const refreshPosition = () => {
    if (!select) return;
    const options = [...select.options].filter(option=>option.value && !option.disabled);
    const label = `${Math.max(0,options.findIndex(option => option.value === select.value)+1)} / ${options.length}`;
    if (position.textContent !== label) position.textContent = label;
    const index = options.findIndex(option => option.value === select.value);
    stepButtons[0].disabled = index <= 0;
    stepButtons[1].disabled = !options.length || index === options.length - 1;
  };
  select?.addEventListener('change',refreshPosition);
  const optionObserver = new MutationObserver(refreshPosition);
  if (select) optionObserver.observe(select,{childList:true});
  function move(node, target) {
    if (!node) return;
    const anchor = document.createComment('minimal-layout-return');
    node.before(anchor); moves.push({node,anchor}); target.append(node);
  }
  let active = false;
  function apply() {
    const next = document.body.dataset.uiStyle === 'minimal';
    if (next === active) return;
    active = next;
    if (next) {
      if(createLayout&&createRight){
        if(framing){move(framing,createLayout);for(const node of [...framing.children])if(node.classList.contains('new-framing-options')||node.classList.contains('framing-select-wrapper'))move(node,frameDetails);framing.append(frameDetails);}
        for(const node of [...createRight.children])if(node.tagName==='DETAILS')move(node,extras);
        createLayout.append(extras);
        const action=createRight.querySelector('.action-bar');if(action)move(action,createLayout);
      }
      const history=document.querySelector('#ingestView .history-section');if(history){document.body.append(library);move(history,library);}
      const first = originals[0], second = originals[1];
      const sourceNodes = new Set([first?.querySelector('.sched-source-nav'),document.getElementById('schedStudioClipWrap'),document.getElementById('schedPcVideoWrap'),document.getElementById('schedVideoPreviewWrap')]);
      [...first.children].forEach(node => { if (node.tagName !== 'H3') move(node,sourceNodes.has(node)?panels.preview:panels.copy); });
      let scheduling = false;
      [...second.children].forEach(node => {
        if (node.tagName === 'H3') scheduling = true;
        move(node,scheduling?panels.schedule:panels.channels);
      });
      originals.forEach(node => node.hidden = true);
      grid.append(desk); refreshPosition();
    } else {
      if(library.open)library.close();
      for (const {node,anchor} of moves) { anchor.replaceWith(node); }
      moves.length = 0; desk.remove();extras.remove();frameDetails.remove();library.remove();originals.forEach(node => node.hidden = false);
    }
  }
  document.addEventListener('autoclip-ui-changed',apply);
  apply();
})();

