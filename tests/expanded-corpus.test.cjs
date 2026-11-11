const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),read=require('./read-data.cjs'),C=require('../assets/release-7/sequence-core.js'),S=require('../assets/release-7/search-core.js'),D=require('../assets/release-7/data-loader.js');
(async()=>{
 const m=read('manifest.json'),targets=m.books.filter(b=>b.id!=='zohar').map(b=>b.id),base=read(m.books.find(b=>b.id==='zohar').index);assert.equal(m.units,9217);assert.equal(targets.length,9);assert.equal(m.events,153459);
 const expected={'bereishit-rabbah':456,'vayikra-rabbah':195,'shemot-rabbah':272,'bamidbar-rabbah':293,'devarim-rabbah':93,'pesikta-drav-kahanna':176,'yalkut-shimoni-on-torah':2658};for(const [id,n] of Object.entries(expected)){const b=m.books.find(b=>b.id===id);assert.equal(b.units,n);const idx=read(b.index);assert(idx.units.every(u=>u.label.includes('יחידת מקור')));assert.equal(new Set(idx.units.map(u=>u.label)).size,n);}
 const sample=base.units.filter(u=>u.seq.length>=5).filter((u,i)=>i%170===0).slice(0,12),loads=[];const engine=new S.Engine(m,async p=>{loads.push(p);return read(p);});let checks=0;
 for(const mode of ['bag','gapped','contiguous']){
  const q={base:'zohar',units:sample.map(u=>u.id),targets,min:2,options:{mode,collapse:true,short:false},limit:200};const got=await engine.query(q);let total=0;
  for(const id of targets){const idx=read(m.books.find(b=>b.id===id).index);let n=0,matched=0;for(const z of sample){const a=S.sequence(z,q.options);let yes=false;for(const t of idx.units){const ts=S.sequence(t,q.options);if(C.longest(a,ts,mode).ai.length>=2){n++;yes=true;}}if(yes)matched++;}assert.equal(got.stats.byTarget[id]||0,n,id+' '+mode);assert.equal(got.stats.matchedByTarget[id],matched);total+=n;}
  assert.equal(got.stats.matches,total);assert.equal(Object.values(got.stats.byTarget).reduce((a,b)=>a+b,0),total);assert(got.results.length<=200);for(const id of targets.filter(id=>got.stats.byTarget[id]>0))assert(got.results.some(r=>r.target===id),'each matching source must be represented');checks++;
 }
 assert(loads.every(p=>!p.startsWith('texts/')),'Search loads no text shards');
 const actualFetch=global.fetch,requests=[];global.fetch=async url=>{const p=new URL(url).pathname.split('/data/')[1];requests.push(p);const file=path.join(root,'data',p);return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('missing',{status:404});};
 try{const manifest=await D.read('manifest.json','https://example.test/project/data/');const vs=await D.read(manifest.verses,'https://example.test/project/data/',manifest);assert.deepEqual(vs,read(m.verses));const b=m.books.find(b=>b.id==='zohar');const cat=await D.read(b.catalog,'https://example.test/project/data/',manifest);assert.equal(cat.units.length,3093);assert(requests.includes('verses.json.gz'));assert(!requests.some(p=>p.startsWith('texts/')));}finally{global.fetch=actualFetch;}
 for(const b of m.books){const idx=read(b.index);for(const u of idx.units)assert(fs.existsSync(path.join(root,'data',u.shard+'.gz')));}
 const audit=read('audit-report.json');const hash=require('crypto').createHash('sha256').update(JSON.stringify(read(m.verses).slice(0,audit.oldVerseCount))).digest('hex');assert.equal(hash,audit.oldVersePrefixSHA256);
 console.log(JSON.stringify({status:'passed',units:9217,books:10,events:153459,modesCheckedAgainstBruteForce:checks,sourceRepresentation:true,compressedLoader:true,oldVerseIdsPreserved:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
