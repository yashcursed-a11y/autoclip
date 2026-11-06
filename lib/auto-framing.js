const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { ROOT } = require('./config');
const { getPythonCommand, getScriptPath } = require('./python-helper');
const MODES = new Set(['adaptive','duo_auto','group_fit']);
const ASPECTS = new Set(['9:16','4:5','1:1','16:9']);
const inFlight = new Map();
let queue = Promise.resolve();

function validatePlan(plan) {
  if (!plan || plan.version !== 'visual-framing-v1' || !Number.isFinite(plan.duration) || plan.duration <= 0 || !plan.segments?.length || plan.segments.length > 32) throw new Error('Invalid framing plan.');
  const { width, height } = plan.source || {};
  if (![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=32768)) throw new Error('Invalid source dimensions.');
  let previous = 0;
  for (const seg of plan.segments) {
    if (!['fit','single','duo'].includes(seg.layout) || !Number.isFinite(seg.start) || !Number.isFinite(seg.end) || Math.abs(seg.start-previous) > .02 || seg.end <= seg.start || seg.end > plan.duration+.02) throw new Error('Invalid framing timing.');
    if (!Array.isArray(seg.crops) || seg.crops.length !== (seg.layout==='duo'?2:seg.layout==='single'?1:0)) throw new Error('Invalid crop count.');
    for(const c of seg.crops) {
      if(![c.x,c.y,c.width,c.height].every(Number.isInteger) || c.x<0 || c.y<0 || c.width<2 || c.height<2 || c.x+c.width>width || c.y+c.height>height)throw new Error('Invalid crop bounds.');
    }
    previous = seg.end;
  }
  if (Math.abs(previous-plan.duration)>.02)throw new Error('Incomplete framing plan.');
  return plan;
}

function runAnalysis(args, signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(new Error('Framing analysis cancelled.'));
    const child=spawn(getPythonCommand(),[getScriptPath('auto_frame.py'),...args],{windowsHide:true});
    let output='',errors='',settled=false;
    const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);err?reject(err):resolve(result);};
    const cancel=()=>{child.kill();finish(new Error('Framing analysis cancelled.'));};
    const timer=setTimeout(()=>{child.kill();finish(new Error('Framing analysis timed out. Try a shorter clip.'));},120000);
    signal?.addEventListener('abort',cancel,{once:true});
    child.stdout.on('data',data=>{output+=data;if(output.length>2e6){child.kill();finish(new Error('Framing analysis output exceeded its limit.'));}});
    child.stderr.on('data',data=>{errors=(errors+data).slice(-2000);});
    child.on('error',err=>finish(err));
    child.on('close',code=>{
      try{const result=JSON.parse(output);if(code!==0 || result.error)throw new Error(result.error || errors || 'Framing analysis failed.');finish(null,validatePlan(result));}
      catch(err){finish(err);}
    });
  });
}

async function getAdaptiveFramingPlan(source,start,end,aspect='9:16',mode='adaptive',signal=null) {
  start=Number(start);end=Number(end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>600)throw new Error('Analyze a clip between 0 and 600 seconds long.');
  if(!ASPECTS.has(aspect)||!MODES.has(mode))throw new Error('Unsupported adaptive framing settings.');
  const stat=await fs.stat(source);
  const key=crypto.createHash('sha256').update(JSON.stringify(['visual-framing-v1',path.resolve(source),stat.size,stat.mtimeMs,start,end,aspect,mode])).digest('hex');
  const folder=path.join(ROOT,'work','framing-cache');
  const file=path.join(folder,key+'.json');
  try{return validatePlan(JSON.parse(await fs.readFile(file,'utf8')));}catch{}
  if(inFlight.has(key))return inFlight.get(key);
  const task=queue.catch(()=>{}).then(async()=>{
    const result=await runAnalysis([source,String(start),String(end),aspect,mode],signal);
    await fs.mkdir(folder,{recursive:true});
    await fs.writeFile(file,JSON.stringify(result),'utf8');
    return result;
  });
  queue=task;inFlight.set(key,task);
  try{return await task;}finally{inFlight.delete(key);}
}

function buildAdaptiveFramingGraph(plan,width,height,background='dark') {
  validatePlan(plan);
  if(![width,height].every(v=>Number.isInteger(v)&&v>=2&&v%2===0))throw new Error('Invalid output dimensions.');
  const segments=plan.segments;
  const graph=[];
  if(segments.length>1)graph.push(`[0:v]split=${segments.length}${segments.map((_,i)=>`[af_in${i}]`).join('')}`);
  const crop=c=>`crop=${c.width}:${c.height}:${c.x}:${c.y}`;
  for(const [i,seg] of segments.entries()){
    const input=segments.length>1?`[af_in${i}]`:'[0:v]';
    const trimmed=`${input}trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS`;
    if(seg.layout==='fit' && background==='blur'){
      graph.push(`${trimmed},split=2[af_bg${i}][af_fg${i}]`);
      graph.push(`[af_bg${i}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=12:2[af_blur${i}]`);
      graph.push(`[af_fg${i}]scale=${width}:${height}:force_original_aspect_ratio=decrease[af_fit${i}]`);
      graph.push(`[af_blur${i}][af_fit${i}]overlay=(W-w)/2:(H-h)/2,setsar=1[af_out${i}]`);
    }
    else if(seg.layout==='fit')graph.push(`${trimmed},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0c10,setsar=1[af_out${i}]`);
    else if(seg.layout==='single')graph.push(`${trimmed},${crop(seg.crops[0])},scale=${width}:${height},setsar=1[af_out${i}]`);
    else{
      const half=Math.floor(height/4)*2;
      graph.push(`${trimmed},split=2[af_top${i}][af_bottom${i}]`);
      graph.push(`[af_top${i}]${crop(seg.crops[0])},scale=${width}:${half},setsar=1[af_a${i}]`);
      graph.push(`[af_bottom${i}]${crop(seg.crops[1])},scale=${width}:${height-half},setsar=1[af_b${i}]`);
      graph.push(`[af_a${i}][af_b${i}]vstack[af_out${i}]`);
    }
  }
  graph.push(segments.length>1?`${segments.map((_,i)=>`[af_out${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[v_framed]`:'[af_out0]null[v_framed]');
  return graph.join(';');
}

module.exports={getAdaptiveFramingPlan,buildAdaptiveFramingGraph,validatePlan};
