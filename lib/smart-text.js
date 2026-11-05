const { formatAssTime } = require('./caption');
const clean = text => String(text || '').replace(/[{}\\\r\n]/g,' ').replace(/\s+/g,' ').trim();

// Offline emphasis extraction: grounded in transcript phrases, never invented claims.
function buildSmartCallouts(clip,transcript,density='subtle') {
  const start=Number(clip.start)||0,end=Number(clip.end)||start;
  const gap=density==='punchy'?5:density==='balanced'?8:12;
  const candidates=[];
  for(const seg of transcript?.segments || []){
    const segStart=Number(seg.start),segEnd=Number(seg.end);
    if(segEnd<=start || segStart>=end)continue;
    const words=clean(seg.text).split(' ').filter(Boolean);
    if(words.length<3)continue;
    let best=-1,score=0;
    words.forEach((w,i)=>{
      const n=/\d|secret|never|always|important|remember|mistake|imagine|million|billion|first|finally|warning|actually|truth|changed/i.test(w)?2:0;
      if(n>score){score=n;best=i;}
    });
    if(best<0)continue;
    const from=Math.max(0,Math.min(words.length-5,best-2));
    const text=words.slice(from,from+5).join(' ').slice(0,64);
    const at=Math.max(start,segStart)+(Math.max(0,Math.min(segEnd,end)-Math.max(segStart,start)) * from/words.length);
    const duration=Math.min(2.5,end-at);
    if(duration>=.8)candidates.push({start:Number((at-start).toFixed(2)),end:Number((at-start+duration).toFixed(2)),text,enabled:true,source:'transcript'});
  }
  const chosen=[],seen=new Set();
  for(const candidate of candidates){
    if(chosen.length>=Math.min(8,Math.ceil((end-start)/gap)))break;
    if(seen.has(candidate.text.toLowerCase()) || (chosen.length && candidate.start-chosen.at(-1).start<gap))continue;
    chosen.push(candidate);seen.add(candidate.text.toLowerCase());
  }
  return chosen;
}

function normalizeCallouts(callouts,duration) {
  return (Array.isArray(callouts)?callouts:[]).slice(0,8).filter(c=>c.enabled!==false).map(c=>({
    text:clean(c.text).slice(0,64),start:Math.max(0,Number(c.start)),end:Math.min(duration,Number(c.end))
  })).filter(c=>c.text && Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start);
}

function appendSmartCallouts(ass,callouts,width,height,style='pill') {
  const rows=normalizeCallouts(callouts,86400);
  if(!rows.length)return ass;
  const size=Math.round(width*.042),border=style==='headline'?1:3;
  const entry=`Style: SmartText,Arial,${size},&H00FFFFFF,&H00FFFFFF,&H00100C0A,&H90100C0A,-1,0,0,0,100,100,0,0,${border},${style==='headline'?3:12},0,8,70,70,0,1\n`;
  ass=ass.replace('[Events]',entry+'\n[Events]');
  for(const item of rows){
    ass+=`Dialogue: 1,${formatAssTime(item.start)},${formatAssTime(item.end)},SmartText,,0,0,0,,{\\an8\\pos(${Math.round(width/2)},${Math.round(height*.20)})\\fad(100,150)}${item.text}\n`;
  }
  return ass;
}
module.exports={buildSmartCallouts,normalizeCallouts,appendSmartCallouts};
