(() => {
  const root=document.querySelector('.new-framing-grid');
  const select=document.getElementById('framingPresetSelect');
  if(!root||!select)return;
  const layouts=[
    ['auto','AI Auto','Let clip analysis choose people framing or gaming.','auto'],
    ['adaptive','People & speakers','Focus on one person; stack two; keep groups visible.','person'],
    ['gaming_split','Gaming split','Facecam above, gameplay below.','game'],
    ['duo_auto','Two-person stack','Detect both faces and place one above the other.','duo'],
    ['blur','Blur canvas','Keep the whole video over a blurred background.','blur'],
    ['group_fit','Full picture','Keep everyone in frame, centered on the canvas.','fit']
  ];
  const summary=document.querySelector('.new-framing-summary');
  const background=document.getElementById('newFramingBackground');
  const sync=()=>{
    root.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.framingMode===select.value)));
    const match=layouts.find(item=>item[0]===select.value);
    summary.textContent=match?`${match[1]} selected · ${match[2]}`:'Custom framing selected. Adjust it below.';
  };
  for(const [mode,title,description,diagram] of layouts){
    const button=document.createElement('button');button.type='button';button.className='new-framing-card';button.dataset.framingMode=mode;
    const picture=document.createElement('span');picture.className=`new-framing-diagram diagram-${diagram}`;picture.setAttribute('aria-hidden','true');picture.innerHTML='<i></i><i></i><i></i>';
    const name=document.createElement('strong');name.textContent=title;
    const detail=document.createElement('small');detail.textContent=description;
    button.append(picture,name,detail);
    button.onclick=()=>{
      select.value=mode;state.framing.mode=mode;
      const editorSelect=document.getElementById('editFramingMode');if(editorSelect)editorSelect.value=mode;
      select.dispatchEvent(new Event('change',{bubbles:true}));sync();
    };root.append(button);
  }
  select.addEventListener('change',sync);
  // The New screen controls the next job; it does not edit an existing job.
  if(!state.currentJob){select.value='auto';state.framing.mode='auto';document.getElementById('editFramingMode').value='auto';}
  const originalOptions=getJobOptions;
  getJobOptions=function(...args){return {...originalOptions.apply(this,args),framingMode:select.value,autoFramingBackground:background.value};};
  const originalShow=showJob;
  showJob=function(job,...args){const result=originalShow.call(this,job,...args);background.value=job.options?.autoFramingBackground || 'blur';sync();return result;};
  sync();
})();
