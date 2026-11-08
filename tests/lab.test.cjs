const fs=require('fs'),vm=require('vm'),assert=require('assert'),root=__dirname+'/..';
const read=require('./read-data.cjs'),S=require(root+'/assets/release-6.4/search-core.js'),C=require(root+'/assets/release-6.4/sequence-core.js'),L=require(root+'/assets/release-6.4/lab-core.js');
const nodes=new Map();function node(s){if(!nodes.has(s))nodes.set(s,{value:'',checked:false,disabled:false,innerHTML:'',textContent:'',hidden:false,style:{setProperty(){}},classList:{toggle(){},remove(){},add(){},contains(){return false}}});return nodes.get(s);}
const ctx=vm.createContext({VerseEvidence:require(root+'/assets/release-6.4/evidence-core.js'),VerseSearch:S,VerseCore:C,VerseLab:L,document:{querySelector:node,querySelectorAll:()=>[],body:{dataset:{}}},fetch:async p=>({ok:true,json:()=>read(p.replace(/^data\//,'').split('?')[0])}),requestAnimationFrame:f=>f(),setTimeout,clearTimeout,console});
ctx.URL=URL;ctx.document.baseURI='https://example.test/project/';ctx.SourceUI={chosen:()=>{const id=node('#comparisonBook').value;return id==='both'?['midrash-tanchuma','midrash-tanchuma-buber']:[id||'midrash-tanchuma'];},init(){},set(ids){node('#comparisonBook').value=ids.length>1?'both':ids[0];},purpose(){return {role:'מדרש משווה'};},resultsForView:()=>vm.runInContext('results',ctx),filterLabel:()=>'',resetFilter(){},resultStats(){},displayTargets:(ids,id)=>[id,...ids.filter(x=>x!==id)].slice(0,2)};ctx.DataFiles={read:async p=>read(p)};
for(const file of ['selection.js','guidance.js'])vm.runInContext(fs.readFileSync(root+'/assets/release-6.4/'+file,'utf8'),ctx);
for(const file of ['app.js','analytics.js','lab.js'])vm.runInContext(fs.readFileSync(root+'/assets/release-6.4/'+file,'utf8').split("document.addEventListener('click'")[0],ctx);
const m=read('manifest.json'),v=read(m.verses),catalog=read(m.books.find(b=>b.id==='zohar').catalog);Object.assign(ctx,{m,v,catalog});vm.runInContext('manifest=m;verses=v;baseIndex=catalog;',ctx);
node('#base').value='zohar';node('#unit').value=catalog.units[0].id;node('#comparisonBook').value='both';node('#mode').value='gapped';node('#collapse').checked=true;node('#lengthN').value=2;node('#labSource').value='zohar';node('#labIntersection').value='all';node('#labContrast').value='midrash-tanchuma';
ctx.perform=async q=>({result:await L.compute(q,async id=>read(m.books.find(b=>b.id===id).index))});vm.runInContext("request=async(type,{query})=>{if(type!=='lab')throw Error(type);return perform(query);};",ctx);
(async()=>{const e=new S.Engine(m,read),answers=[];
 for(const scope of ['all','search','source','intersection']){
  node('#labScope').value=scope;await vm.runInContext('runLab()',ctx);const data=vm.runInContext('labData',ctx);
  const query={...data.q,query:'',limit:500};const expected=await e.query(query);assert.equal(data.pairs.length,expected.stats.matches,'Full pair count '+scope);assert(data.groups.every(g=>new Set(g.units.map(u=>u.id)).size===g.units.length));
  if(scope==='search')assert.equal(data.groups[0].units.length,1);
  if(scope==='intersection')for(const g of data.groups)for(const u of g.units)for(const [v]of u.seq)assert(data.refs.includes(v));
  const valid=new Set(data.groups.flatMap(g=>g.units.map(u=>u.id)));
  for(let i=0;i<10;i++){ctx.i=i;vm.runInContext('labView=i;renderLab()',ctx);const out=node('#labPlot').innerHTML;assert(!/NaN|Infinity|undefined/.test(out),'Invalid chart values '+scope+'/'+i);assert(out.includes('data-lab-hit='),'Interactive chart '+scope+'/'+i);const n=vm.runInContext('labActions.length',ctx);for(let j=0;j<n;j++){ctx.j=j;vm.runInContext('labActions[j]()',ctx);for(const r of vm.runInContext('labEvidenceRows',ctx))assert(valid.has(r.u.id),'Evidence outside scope');}if(scope==='all')answers.push({question:vm.runInContext('labQuestions[labView]',ctx),answer:out.match(/class="insight-strip">(.*?)<\/div>/s)?.[1],method:node('#labMethod').textContent});}
 }
 fs.writeFileSync(root+'/tests/lab-results.json',JSON.stringify(answers,null,2));
 console.log('PASS: 10 interactive visualizations × 4 scopes; uncapped pair counts agree with engine; intersection references, evidence scope, complete unit sets and finite metrics.');
})().catch(e=>{console.error(e);process.exit(1)});
