const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),S=require('../assets/search-core.js'),L=require('../assets/lab-core.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,'data',p),'utf8'));
(async()=>{
 const manifest=read('manifest.json'),engine=new S.Engine(manifest,read),index=read(manifest.books.find(b=>b.id==='zohar').index),targets=['midrash-tanchuma','midrash-tanchuma-buber'];
 const sections=[...new Set(index.units.map(u=>u.section))].slice(0,2),selected=index.units.filter(u=>sections.includes(u.section));
 const q={base:'zohar',targets,sections,units:selected.map(u=>u.id),unit:null,min:2,options:{mode:'gapped',collapse:true,short:false},limit:500};
 const batch=await engine.query(q);assert.equal(batch.stats.selectedUnits,selected.length);assert(batch.stats.matches>0);
 const separate=(await Promise.all(selected.map(u=>engine.query({...q,units:[u.id]})))).reduce((n,r)=>n+r.stats.matches,0);assert.equal(batch.stats.matches,separate,'A cohort equals the sum of its independent unit comparisons');
 assert.equal(Object.values(batch.stats.byUnit).reduce((a,b)=>a+b,0),batch.stats.matches);assert.equal(Object.keys(batch.stats.byUnit).length,batch.stats.matchedBaseUnits);
 assert(batch.results.every(r=>q.units.includes(r.zid)));
 const bySection=await engine.query({...q,units:null});assert.equal(bySection.stats.matches,batch.stats.matches);
 assert.equal((await engine.query({...q,units:[]})).stats.matches,0,'Empty explicit units must never mean all');
 assert.equal((await engine.query({...q,sections:[]})).stats.matches,0,'Empty explicit sections must never mean all');
 const lab=await L.compute(q,async id=>read(manifest.books.find(b=>b.id===id).index));assert.equal(lab.pairs.length,batch.stats.matches);assert.equal(lab.groups[0].units.length,selected.length);
 // A two-verse match exists only if events were incorrectly concatenated across JSON boundaries.
 const unit=(id,seq)=>({id,label:id,section:'A',shard:'unused',seq:seq.map((v,i)=>[v,i,4])});
 const fixture={base:{id:'base',units:[unit('one',[1]),unit('two',[2])],postings:{}},target:{id:'target',units:[unit('target-unit',[1,2])],postings:{1:[[0,1]],2:[[0,1]]}}};
 const mini=new S.Engine({books:[{id:'base',index:'base'},{id:'target',index:'target'}]},async p=>fixture[p]);
 assert.equal((await mini.query({base:'base',targets:['target'],units:['one','two'],min:2,options:q.options})).stats.matches,0,'No synthetic sequence crossing two drashot');
 // Reference filter must remain in force with an explicit selection.
 const refs=[...new Set(index.units[0].seq.map(e=>e[0]))].slice(0,2),filtered=await engine.query({...q,units:[index.units[0].id],sections:null,options:{...q.options,refs}});assert(filtered.results.every(r=>r.keys.every(v=>refs.includes(v))));
 console.log('PASS: multi-section and multi-unit searches, union equals independent searches, empty selection, all-unit stats, lab scope, reference filters and no cross-JSON sequence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
