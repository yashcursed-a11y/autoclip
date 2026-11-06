/* The lightning rail owns channel clipping; New project owns single recordings. */
function setupChannelWorkspace() {
  const pane=document.getElementById('maxPane'),ingest=document.getElementById('ingestView');
  if(!pane||!ingest||typeof window.switchAppView!=='function'||document.getElementById('maxChannelView'))return;
  const view=document.createElement('section');view.id='maxChannelView';view.className='max-channel-view hidden';view.setAttribute('aria-labelledby','maxChannelHeading');
  const heading=document.createElement('header');heading.className='max-channel-heading';
  heading.innerHTML='<span class="max-channel-eyebrow">CHANNEL WORKSPACE</span><h1 id="maxChannelHeading">MAX Channel Clipper<span>⚡</span></h1><p>Turn a channel’s recent videos into a batch of clips. Inspect the channel, choose your limits, then start clipping.</p>';
  view.append(heading,pane);ingest.after(view);
  const tab=document.getElementById('maxTabBtn');if(tab)tab.hidden=true;
  const card=pane.firstElementChild;if(card)card.classList.add('max-channel-card');
  const title=pane.querySelector('h3');if(title)title.textContent='Set up your channel batch';
  const description=title?.nextElementSibling;if(description)description.textContent='Preview recent uploads before starting a batch.';
  const switchView=window.switchAppView;
  window.switchAppView=function(name,...args){
    // Restore the recording source when returning from the channel workspace.
    if(name==='ingest'&&state.activeTab==='max'){
      state.activeTab='file';
      document.getElementById('filePane')?.classList.remove('hidden');
      document.getElementById('urlPane')?.classList.add('hidden');
      document.querySelectorAll('.source-card .tab').forEach(button=>button.classList.toggle('active',button.dataset.tab==='file'));
    }
    const result=switchView.call(this,name,...args);
    view.classList.toggle('hidden',name!=='max');
    if(name==='max'){
      ingest.classList.add('hidden');pane.classList.remove('hidden');
      document.getElementById('maxChannelUrl')?.focus({preventScroll:true});
    }
    document.body.classList.toggle('channel-workspace-active',name==='max');
    return result;
  };
}
document.addEventListener('autoclip-ready',setupChannelWorkspace,{once:true});
setupChannelWorkspace();
