const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const R=require('../assets/research-core.js');
const refs=['Genesis:1:1','Genesis:1:2','Job:1:1','Psalms:1:1'];
const es=vs=>vs.map((v,i)=>({v,index:i,pos:[i],words:['מילה']}));
assert.equal(R.groups(es([0,0,1]),refs,{collapse:true}).length,2);
assert.equal(R.groups(es([0,2,0]),refs,{collapse:true}).length,3,'Nonconsecutive return must survive');
assert.equal(R.groups(es([0,0,1]),refs,{collapse:true,group:true}).length,1);
let a=R.analyze(es([0,2,3]),refs,{indices:[0,2]});assert.equal(a.transitions[0].gap,1);
assert.equal(R.compare([a,a])[0].transitions.length,0,'Hidden intermediate quotation must not create a direct bridge');
a=R.analyze(es([0,0,2]),refs,{collapse:true});assert.equal(a.transitions[0].gap,0);assert.equal(R.compare([a,a])[0].transitions.length,1);
a=R.analyze(es([0,1,2]),refs,{exclude:1});assert.equal(a.transitions[0].gap,1,'Removing a verse must not create direct adjacency');
assert.deepEqual(R.residual({tokens:['א','ב','ג','ד','ה'],events:[{pos:[1,3]}]}).map(x=>x.text),['א','ג','ה'],'Residual fragments must preserve deletion boundaries');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(root+'/data/manifest.json')),v=JSON.parse(fs.readFileSync(root+'/data/'+manifest.verses));
let units=0,events=0,triples=0;for(const b of manifest.books){const idx=JSON.parse(fs.readFileSync(root+'/data/'+b.index));for(const u of idx.units){units++;events+=u.seq.length;const source=u.seq.map(([v,index])=>({v,index}));const a=R.analyze(source,v,{collapse:true,group:true});assert(a.groups.length<=source.length);assert.equal(a.raw,source.length);for(const t of a.transitions){assert(t.gap>=0);if(t.type==='cross')triples++;}}}
console.log(JSON.stringify({status:'passed',units,events,crossBookGroupTransitions:triples,boundaries:'verified'}));
