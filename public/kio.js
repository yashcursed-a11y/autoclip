/* KIO composes existing controls. Leaving KIO restores their exact positions. */
(() => {
  const rail=document.querySelector('.app-rail');
  if(!rail)return;
  const name=document.createElement('span');name.className='kio-edition';name.textContent='KIO';
  const caption=document.createElement('span');caption.className='kio-edition-caption';caption.textContent='Clipping workspace';
  const identity=document.createElement('div');identity.className='kio-identity';identity.append(name,caption);
  const footer=document.createElement('div');footer.className='kio-rail-settings';
  const moves=[],copy=[];let active=false;
  const replace=(selector,text)=>{const node=document.querySelector(selector);if(node){copy.push([node,node.textContent]);node.textContent=text;}};
  function apply(){
    const next=document.body.dataset.uiStyle==='kio';if(next===active)return;active=next;
    if(next){
      rail.querySelector('.rail-logo')?.after(identity);rail.append(footer);
      const customize=document.querySelector('.companion-customize-trigger');
      if(customize){const anchor=document.createComment('kio-settings-return');customize.before(anchor);moves.push([customize,anchor]);footer.append(customize);}
      replace('#ingestView .pro-ingest-top h1','Make the cut.');
      replace('#ingestView .pro-ingest-top p','Bring your recording. Choose the frame. Find the moments.');
    }else{
      for(const [node,anchor]of moves)anchor.replaceWith(node);moves.length=0;
      for(const [node,text]of copy)node.textContent=text;copy.length=0;
      identity.remove();footer.remove();
    }
  }
  document.addEventListener('autoclip-ui-changed',apply);apply();
})();
