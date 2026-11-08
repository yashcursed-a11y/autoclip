/* Original grain globe: small deterministic point cloud, drawn only while on screen. */
(()=>{
  const canvas=document.querySelector('.minimal-globe-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx?.fillRect||typeof performance==='undefined')return;
  const continents=[
    [[-168,70],[-135,73],[-120,62],[-98,57],[-58,52],[-64,44],[-82,25],[-98,16],[-115,29],[-126,47],[-155,57]],
    [[-82,12],[-66,10],[-49,-2],[-34,-10],[-43,-24],[-56,-53],[-70,-55],[-75,-30],[-79,-5]],
    [[-18,34],[5,37],[32,30],[50,12],[39,-5],[33,-28],[18,-35],[7,-25],[-3,2],[-16,16]],
    [[-11,36],[-10,58],[8,71],[34,69],[45,56],[28,39],[16,35]],
    [[30,70],[70,78],[125,71],[178,59],[153,43],[141,34],[122,24],[105,6],[78,7],[68,26],[45,34],[36,53]],
    [[112,-12],[131,-11],[153,-25],[146,-40],[119,-35]],
    [[-58,60],[-45,60],[-20,76],[-42,84],[-63,77]],
    [[43,-12],[51,-15],[49,-25],[44,-25]],[[95,5],[116,5],[137,-6],[121,-11],[104,-6]]
  ];
  const inside=(x,y,polygon)=>{let found=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])found=!found;}return found;};
  const hash=n=>{const x=Math.sin(n*91.7+13.3)*43758.54;return x-Math.floor(x);};
  const points=Array.from({length:6800},(_,i)=>{const y=1-2*(i+.5)/6800,lat=Math.asin(y),lon=i*2.399963229728653%(Math.PI*2)-Math.PI,r=Math.sqrt(1-y*y);return{x:r*Math.sin(lon),y,z:r*Math.cos(lon),land:continents.some(p=>inside(lon*180/Math.PI,lat*180/Math.PI,p)),grain:hash(i),size:.8+hash(i+14)*1.1};});
  canvas.parentElement.dataset.grainReady='true';
  let frame=0,last=0,angle=.2;
  const visible=()=>document.body.dataset.uiStyle==='minimal'&&document.body.dataset.minimalScreen==='globe'&&!document.hidden;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function draw(){ctx.clearRect(0,0,360,360);const c=Math.cos(angle),s=Math.sin(angle),tilt=.16,ct=Math.cos(tilt),st=Math.sin(tilt);ctx.fillStyle='#080808';
    for(const p of points){const x=p.x*c+p.z*s,z=p.z*c-p.x*s,y=p.y*ct-z*st,depth=p.y*st+z*ct;if(depth<-.025)continue;const edge=Math.max(.12,Math.pow(Math.max(0,depth),.25));ctx.globalAlpha=(p.land ? .72 : .26)*edge*(.6+p.grain*.4);const size=p.size*(p.land?1.5:1);ctx.fillRect(180+x*151-size/2,180-y*151-size/2,size,size);}
    ctx.globalAlpha=1;
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function tick(now){if(!visible()){stop();return;}if(!last||now-last>=40){angle+=last?Math.min(100,now-last)*.00019:0;last=now;draw();}frame=requestAnimationFrame(tick);}
  function update(){stop();if(!visible())return;draw();if(!reduced())frame=requestAnimationFrame(tick);}
  document.addEventListener('autoclip-minimal-screen',update);document.addEventListener('autoclip-ui-changed',update);document.addEventListener('visibilitychange',update);window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',update);update();
})();
