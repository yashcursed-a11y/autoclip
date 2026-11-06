/* Reference-inspired resource dashboard. All charts use observed telemetry. */
(() => {
  const root=document.querySelector('.processes-section');if(!root)return;
  root.classList.add('system-dashboard');
  const header=root.firstElementChild;header.classList.add('system-dashboard-header');
  header.querySelector('h2').textContent='Your studio, under the hood.';
  header.querySelector('p').textContent='Resources, workers and engine activity. Everything in one place.';
  const grid=header.nextElementSibling;grid.classList.add('system-metric-grid');
  const cards=[...grid.children];['health','cpu','memory','workers'].forEach((type,i)=>cards[i]?.classList.add('system-metric',`system-metric-${type}`));
  const create=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  const healthMark=create('div','system-health-mark','—');cards[0].insertBefore(healthMark,cards[0].children[1]);
  const history=create('article','system-history-card');
  history.innerHTML='<div class="system-chart-header"><div><span class="system-overline">RESOURCE ACTIVITY</span><h3>CPU over time</h3></div><span class="system-history-summary">Waiting for samples</span></div><svg class="system-cpu-chart" viewBox="0 0 600 140" role="img" aria-label="CPU utilization history"><path class="system-chart-grid" d="M0 20H600 M0 70H600 M0 120H600"/><polyline class="system-chart-line" points=""/></svg><div class="system-chart-footer"><span>Earlier</span><span>Latest · up to 40 samples</span></div>';
  grid.append(history);
  const gauge=create('div','system-memory-gauge');gauge.innerHTML='<svg viewBox="0 0 200 112" aria-hidden="true"><path class="system-gauge-track" d="M15 100 A85 85 0 0 1 185 100" pathLength="100"/><path class="system-gauge-value" d="M15 100 A85 85 0 0 1 185 100" pathLength="100"/></svg>';
  cards[2].append(gauge);
  const bars=create('div','system-worker-bars');bars.setAttribute('aria-label','Recent active worker counts');cards[3].append(bars);
  const activity=root.children[2];activity.classList.add('system-detail-grid');
  [...activity.children].forEach((card,i)=>card.classList.add('system-detail-card',['system-processes','system-incidents','system-console'][i]));
  const samples=[];
  document.addEventListener('autoclip-telemetry',event=>{
    const data=event.detail||{},cpu=Math.max(0,Math.min(100,Number(data.cpu?.usagePercent)||0)),ram=Math.max(0,Math.min(100,Number(data.memory?.usedPercent)||0));
    samples.push({cpu,workers:(data.processes||[]).length});if(samples.length>40)samples.shift();
    const status=data.health?.status||'UNKNOWN';healthMark.textContent=status==='HEALTHY'?'Ready':status==='HIGH_LOAD'?'Busy':status==='CRITICAL_OOM_RISK'?'At risk':'Live';cards[0].dataset.health=status;
    history.querySelector('.system-history-summary').textContent=`${cpu}% now`;
    const points=samples.map((s,i)=>`${samples.length===1?600:i/(samples.length-1)*600},${120-s.cpu}`).join(' ');
    history.querySelector('polyline').setAttribute('points',samples.length===1?`590,${120-cpu} ${points}`:points);
    gauge.querySelector('.system-gauge-value').style.strokeDasharray=`${ram} 100`;
    gauge.setAttribute('aria-label',`Memory ${ram}% used`);
    bars.replaceChildren(...samples.slice(-18).map(sample=>{const bar=create('span','');bar.style.height=`${Math.max(4,Math.min(100,sample.workers*12))}%`;bar.title=`${sample.workers} active workers`;return bar;}));
  });
})();
