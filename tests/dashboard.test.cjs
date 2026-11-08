const fs=require('fs'),vm=require('vm'),assert=require('assert'),root=__dirname+'/..';
const read=require('./read-data.cjs');
const C=require(root+'/assets/release-6.3/sequence-core.js'),S=require(root+'/assets/release-6.3/search-core.js');
const m=read('manifest.json'),v=read(m.verses),base=read(m.books.find(b=>b.id==='zohar').catalog);
const nodes=new Map();function node(k){if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',textContent:'',checked:false,hidden:false,scrollTop:0,style:{setProperty(){}},classList:{toggle(){},remove(){},add(){},contains(){return false}},scrollIntoView(){},getBoundingClientRect(){return {top:0}},querySelector(s){const n=s.match(/data-token="(\d+)"/);return n?{classList:{add(){}},getBoundingClientRect(){return {top:+n[1]*10}}}:null;}});return nodes.get(k);}
const targets=m.books.filter(b=>b.id!=='zohar').map(b=>({dataset:{target:b.id},checked:true}));
const ctx=vm.createContext({VerseEvidence:require(root+'/assets/release-6.3/evidence-core.js'),VerseCore:C,VerseSearch:S,document:{body:{dataset:{}},querySelector:node,querySelectorAll:s=>s.startsWith('[data-target]')?targets:[]},fetch:async p=>({ok:true,json:()=>read(p.replace(/^data\//,'').split('?')[0])}),requestAnimationFrame:f=>f(),setTimeout,clearTimeout,console});
ctx.URL=URL;ctx.document.baseURI='https://example.test/project/';ctx.SourceUI={chosen:()=>{const id=node('#comparisonBook').value;return id==='both'?['midrash-tanchuma','midrash-tanchuma-buber']:[id||'midrash-tanchuma'];},init(){},set(ids){node('#comparisonBook').value=ids.length>1?'both':ids[0];},purpose(){return {role:'מדרש משווה'};},resultsForView:()=>vm.runInContext('results',ctx),filterLabel:()=>'',resetFilter(){},resultStats(){},displayTargets:(ids,id)=>[id,...ids.filter(x=>x!==id)].slice(0,2)};ctx.DataFiles={read:async p=>read(p)};
for(const file of ['selection.js','guidance.js'])vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/'+file,'utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/app.js','utf8').split("document.addEventListener('click'")[0],ctx);
vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/analytics.js','utf8').split("document.addEventListener('click'")[0],ctx);
Object.assign(ctx,{m,v,base});vm.runInContext('manifest=m;verses=v;baseIndex=base;',ctx);
node('#comparisonBook').value='midrash-tanchuma';node('#contextRange').value='0';node('#base').value='zohar';node('#unit').value=base.units[0].id;node('#mode').value='gapped';node('#collapse').checked=true;node('#lengthN').value=2;node('#trainAll').checked=true;
(async()=>{
 const engine=new S.Engine(m,read);
 // Analytics and search must describe exactly the same selected unit and filters.
 for(const mode of ['gapped','contiguous','bag'])for(const short of [false,true]){
  node('#mode').value=mode;node('#short').checked=short;
  await vm.runInContext('loadAnalytics()',ctx);
  const a=vm.runInContext('analyticsData',ctx),found=await engine.query({...a.q,query:'',limit:500});
  assert.equal(a.rows.length,found.stats.matches);assert.equal(a.q.unit,base.units[0].id);
  for(const r of a.rows){assert.equal(r.z.id,a.q.unit);const match=found.results.find(x=>x.tid===r.u.id);assert(match);assert.equal(r.length,match.length);}
 }
 node('#mode').value='gapped';node('#short').checked=false;await vm.runInContext('loadAnalytics()',ctx);
 const a=vm.runInContext('analyticsData',ctx),allowed=new Set([a.z.id,...a.rows.map(r=>r.u.id)]);
 for(let i=0;i<8;i++){
  ctx.i=i;vm.runInContext('vizActive=i;renderVisualization();',ctx);
  assert(node('#vizPlot').innerHTML.includes('data-viz-hit='),'chart '+i+' must be interactive');
  assert(!/NaN|Infinity/.test(node('#vizPlot').innerHTML));
  const collected=[];
  for(let j=0;j<vm.runInContext('vizActions.length',ctx);j++){
   ctx.j=j;vm.runInContext('vizActions[j]()',ctx);
   for(const r of vm.runInContext('evidenceRows',ctx)){assert(allowed.has(r.u.id),'Evidence escaped the selected unit cohort');collected.push(r);}
  }
  if(i===6||i===7){assert.equal(collected.length,a.rows.length);assert.equal(new Set(collected.map(r=>r.u.id)).size,collected.length);}
 }
 const q={...a.q,query:''},rs=await engine.query(q);assert(rs.results.length);
 const exact=await engine.query({...q,targetUnit:rs.results[0].tid});assert.equal(exact.results.length,1);
 Object.assign(ctx,{r:rs.results[0],q});vm.runInContext('activeResult=r;lastQuery=q;matches=[{book:r.target,count:1,units:[{id:r.tid,shard:r.tshard,label:r.tlabel,indices:r.ti}]}];bookColumns=[r.target];sourceColumns={[r.target]:r.tid};',ctx);
 await vm.runInContext('renderComparison()',ctx);
 const cols=vm.runInContext('loadedColumns',ctx),colors=vm.runInContext('eventPalette',ctx);
 for(const c of cols){assert.equal(new Set(c.r.events.map(e=>colors.get(c.id+':'+e.index).color)).size,ctx.VerseEvidence.siteSummary(c.r).events);for(const e of c.r.events){const color=colors.get(c.id+':'+e.index);assert(node('#readings').innerHTML.includes('data-slot="'+color.n+'"'));assert(node('#trains').innerHTML.includes('data-slot="'+color.n+'"'));}
  const first=c.r.events[c.indices[0]];assert.equal(node('#column-'+cols.indexOf(c)).scrollTop,first.pos[0]*10-65,'Scroll must reach the aligned occurrence');
 }
 assert.equal((node('#trains').innerHTML.match(/class="wagon /g)||[]).length,cols.reduce((n,c)=>n+ctx.VerseEvidence.siteSummary(c.r).events,0));
 assert.equal((node('#readings').innerHTML.match(/data-token=/g)||[]).length,cols.reduce((n,c)=>n+c.r.tokens.length,0));
 ctx.fixture={id:'overlap',tokens:['א','ב'],events:[0,1,2].map(i=>({index:i,v:i,pos:i===0?[0]:i===1?[0,1]:[1],words:['א','ב']}))};vm.runInContext('loadedColumns=[{id:fixture.id,r:fixture,indices:[]}];buildEventPalette();',ctx);const overlap=vm.runInContext('reading(fixture)',ctx);assert.equal((overlap.match(/class="event-badge"/g)||[]).length,3);assert(overlap.includes('linear-gradient'));
 // No-match and empty source units must render, with finite chart values.
 const empty=base.units.find(u=>u.sequenceLength===0&&!read(u.shard)[u.id].text.trim());node('#unit').value=empty.id;
 vm.runInContext('activeResult=null;',ctx);await vm.runInContext('showBaseUnit()',ctx);
 assert(node('#readings').innerHTML.includes('אינו מכיל טקסט'));assert.equal(vm.runInContext('loadedColumns[0].r.tokens.length',ctx),0);
 await vm.runInContext('loadAnalytics()',ctx);assert.equal(vm.runInContext('analyticsData.rows.length',ctx),0);
 for(let i=0;i<8;i++){ctx.i=i;vm.runInContext('vizActive=i;renderVisualization()',ctx);assert(!/NaN|Infinity/.test(node('#vizPlot').innerHTML));}
 console.log('PASS: 8 unit-scoped charts, all modes/short filters agree with search, exact pair, evidence scope, color/train mapping, full text, aligned scrolling, overlaps and empty units.');
})().catch(e=>{console.error(e);process.exit(1)});
