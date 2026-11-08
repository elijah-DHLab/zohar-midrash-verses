#!/usr/bin/env node
// Node 18+; no dependencies. A reproducible preset, loaded only when the lab is opened.
const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=path.join(__dirname,'..');
const V=require('../assets/release-6.3/evidence-core.js');
function read(name){const p=path.join(root,'data',name);return JSON.parse(fs.existsSync(p)?fs.readFileSync(p):zlib.gunzipSync(fs.readFileSync(p+'.gz')));}
(async()=>{const m=read('manifest.json'),indexes={};for(const b of m.books)indexes[b.id]=read(b.index);
const queryFile=process.argv.find(a=>a.startsWith('--query='))?.slice(8),q=queryFile?JSON.parse(fs.readFileSync(queryFile)): {base:'zohar',targets:m.books.filter(b=>b.id!=='zohar').map(b=>b.id),min:3,options:{mode:'gapped',collapse:true,ambiguity:'site',short:false},seed:73163,permutations:99,sampleSize:3093};
q.corpusVersion=m.version;const started=Date.now();let phase='';const r=await V.report(q,indexes,read(m.verses),p=>{const k=p.phase+'|'+p.book;if(k!==phase){phase=k;process.stderr.write(k+'\n');}});const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||path.join(root,'data/evidence-baseline.json.gz');fs.writeFileSync(output,zlib.gzipSync(Buffer.from(JSON.stringify(r)),{level:9,mtime:0}));
if(!queryFile){m.evidenceBaseline='evidence-baseline.json';fs.writeFileSync(path.join(root,'data/manifest.json'),JSON.stringify(m));}
console.log(JSON.stringify({output,bytes:fs.statSync(output).size,ms:Date.now()-started,rows:r.rows.length,stages:r.stages,matchedPool:r.matched.poolSize,order:r.order.map(({nulls,...x})=>x)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
