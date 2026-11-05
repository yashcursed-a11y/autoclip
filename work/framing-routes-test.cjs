const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {getAdaptiveFramingPlan}=require('../lib/auto-framing');const {buildSmartCallouts}=require('../lib/smart-text');
const source=fs.readFileSync('server.js','utf8');const start=source.indexOf('// Analyze only a selected local clip.');const end=source.indexOf('// Start Rendering',start);assert(start>=0&&end>start);
const routes={};let job={id:'test',sourcePath:path.resolve('work/framing-tests/people-layouts.mp4'),duration:9,clips:[{id:'clip',start:0,end:9}],transcript:{segments:[{start:1,end:5,text:'Remember the first important lesson today.'}]}};
vm.runInNewContext(source.slice(start,end),{app:{post:(url,handler)=>routes[url]=handler},getJob:async id=>id==='test'?job:null,fs,getAdaptiveFramingPlan,buildSmartCallouts});
const call=async(url,body,id='test')=>{const res={code:200,status(n){this.code=n;return this},json(value){this.value=value;return this}};await routes[url]({params:{id},body},res);return res};
(async()=>{
 assert.strictEqual((await call('/api/jobs/:id/framing-plan',{clipId:'clip'})).value.plan.segments.length,3);
 assert.strictEqual((await call('/api/jobs/:id/framing-plan',{clipId:'bad'})).code,404);
 assert.strictEqual((await call('/api/jobs/:id/framing-plan',{clipId:'clip',start:-1})).code,400);
 assert.strictEqual((await call('/api/jobs/:id/framing-plan',{clipId:'clip',mode:'bad'})).code,400);
 job.sourcePath='';assert.strictEqual((await call('/api/jobs/:id/framing-plan',{clipId:'clip'})).code,400);
 assert((await call('/api/jobs/:id/smart-text',{clipId:'clip'})).value.callouts.length>0);
 assert.strictEqual((await call('/api/jobs/:id/smart-text',{clipId:'clip'},'missing')).code,404);
 console.log('PASS: framing route, invalid range/mode, missing clip/project/source, and transcript-only text route.');
})().catch(e=>{console.error(e);process.exitCode=1});
