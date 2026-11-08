(function(root){'use strict';
const Seq=typeof module!=='undefined'&&module.exports?require('./sequence-core.js'):root.VerseCore;
function normalize(s){return String(s||'').normalize('NFD').toLowerCase().replace(/[\u0591-\u05c7]/g,'').replace(/[^\p{L}\p{N}_]+/gu,' ').replace(/\s+/g,' ').trim();}
function sites(u){
 const source=u.fullSeq||u.seq,merged=u.sites||[],members=new Set(merged.flat()),groups=[...merged,...source.filter(e=>!members.has(e[1])).map(e=>[e[1]])].sort((a,b)=>a[0]-b[0]);const map=new Map(source.map(e=>[e[1],e]));
 return groups.map((ix,site)=>({ix,site,es:ix.map(i=>map.get(i)).filter(Boolean)})).filter(x=>x.es.length).map(({ix,site,es})=>{const keys=[...new Set(es.map(e=>e[0]))].sort((a,b)=>a-b),choices=Object.fromEntries(keys.map(k=>[k,es.find(e=>e[0]===k)[1]]));return {key:keys[0],keys,choices,index:es[0][1],n:Math.max(...es.map(e=>e[2])),site,indices:ix,overlap:(u.overlapSites||[]).includes(site),ambiguous:keys.length>1};});
}
function sequence(u,o={}){
 let es=o.ambiguity==='legacy'?u.seq.map(([key,index,n])=>({key,keys:[key],choices:{[key]:index},index,n,site:index,indices:[index],ambiguous:false})):sites(u);
 es=es.filter(e=>(!o.short||e.n>=3)&&(!o.refs||e.keys.some(k=>o.refs.includes(k)))&&(o.ambiguity!=='exclude'||(!e.ambiguous&&!e.overlap)));
 if(o.refs)es=es.map(e=>({...e,keys:e.keys.filter(k=>o.refs.includes(k))})).map(e=>({...e,key:e.keys[0]}));
 if(o.excludeKeys?.length)es=es.filter(e=>!e.keys.some(k=>o.excludeKeys.includes(k)));
 if(o.collapse){const out=[];for(const e of es){const p=out.at(-1);if(p&&e.keys.join('|')===p.keys.join('|')&&e.site===(p.endSite??p.site)+1){p.endSite=e.site;p.overlap=p.overlap||e.overlap;}else out.push({...e});}es=out;}
 return es;
}
function candidateKeys(es){return es.flatMap(e=>e.keys||[e.key]);}
function candidates(keys,index,minimum){const counts=new Map();for(const k of keys)counts.set(k,(counts.get(k)||0)+1);const scores=new Map();for(const [v,n] of counts)for(const [i,m] of index.postings[v]||[])scores.set(i,(scores.get(i)||0)+Math.min(n,m));return [...scores].filter(([i,s])=>s>=minimum).map(([i])=>i);}
function multisetUpper(a,b){const keys=new Set(candidateKeys(b));return Math.min(b.length,a.filter(e=>(e.keys||[e.key]).some(k=>keys.has(k))).length);}
class Engine{
 constructor(manifest,load){this.manifest=manifest;this.load=load;this.cache=new Map();}
 book(id){const b=this.manifest.books.find(x=>x.id===id);if(!b)throw Error('Unknown book: '+id);return b;}
 async get(path){if(this.cache.has(path)){let data=this.cache.get(path);this.cache.delete(path);this.cache.set(path,data);return data;}const data=await this.load(path);this.cache.set(path,data);while(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);return data;}
 async selectUnits(q){const base=await this.get(this.book(q.base).index);const unitIds=Array.isArray(q.units)?new Set(q.units):null,sections=Array.isArray(q.sections)?new Set(q.sections):null;let units=base.units.filter(u=>(unitIds?unitIds.has(u.id):!q.unit||u.id===q.unit)&&(sections?sections.has(u.section):!q.section||u.section===q.section));const query=normalize(q.query),terms=query.split(' ').filter(Boolean);
 if(query&&q.scope==='word'){const meta=this.book(q.base);let allowed=null;const shards=new Map();for(const term of terms){let words;if(meta.wordBuckets){const bucket=String(Array.from(term).reduce((n,c)=>n+c.codePointAt(0),0)%64),path=meta.wordBuckets[bucket];if(!path){allowed=new Set();break;}if(!shards.has(path))shards.set(path,await this.get(path));words=shards.get(path);}else words=await this.get(meta.words);let ids=new Set(words[term]||[]);allowed=allowed===null?ids:new Set([...allowed].filter(i=>ids.has(i)));}units=units.filter(u=>allowed.has(base.units.indexOf(u)));}
 else if(query&&q.scope==='unit')units=units.filter(u=>terms.every(t=>normalize(u.label+' '+u.location).includes(t)));
 else if(query&&q.scope==='verse'){const refs=await this.get(this.manifest.verses);const allowed=new Set(refs.map((r,i)=>({r:normalize((Seq.BOOKS.find(b=>b[0]===r.split(':')[0])?.[1]||'')+' '+r),i})).filter(x=>terms.every(t=>x.r.includes(t))).map(x=>x.i));units=units.filter(u=>u.seq.some(e=>allowed.has(e[0])));}
 return {base,units};}
 async query(q,progress=()=>{}){const started=Date.now(),{base,units}=await this.selectUnits(q),minimum=Math.max(2,Number(q.min)||2),o=q.options;
 const prepared=units.map(u=>({u,es:sequence(u,o)})).filter(x=>x.es.length>=minimum),results=[],stats={selectedUnits:units.length,matchedBaseUnits:0,byUnit:{},byTarget:{},matchedByTarget:{},baseUnits:prepared.length,targetUnits:0,potentialPairs:0,candidates:0,alignments:0,matches:0,max:0,ms:0},limit=Math.max(1,Math.min(500,q.limit||200));let targets=[...new Set(q.targets)],buckets=[];
 for(let ti=0;ti<targets.length;ti++){const local=[],matchedIds=new Set();const bid=targets[ti],idx=await this.get(this.book(bid).index),effective=new Map();stats.targetUnits+=idx.units.length;stats.potentialPairs+=prepared.length*idx.units.length;
 for(let zi=0;zi<prepared.length;zi++){const {u,es}=prepared[zi];const ci=candidates(candidateKeys(es),idx,minimum);stats.candidates+=ci.length;
 for(const i of ci){const t=idx.units[i];if(q.targetUnit&&t.id!==q.targetUnit)continue;if(t.id===u.id)continue;if(!q.unit&&bid===q.base&&t.id<u.id)continue;let ts=effective.get(i);if(!ts){ts=sequence(t,o);effective.set(i,ts);}if(multisetUpper(es,ts)<minimum)continue;stats.alignments++;const m=Seq.longest(es,ts,o.mode);if(m.ai.length<minimum)continue;stats.matches++;matchedIds.add(u.id);stats.byTarget[bid]=(stats.byTarget[bid]||0)+1;if(!stats.byUnit[u.id])stats.matchedBaseUnits++;stats.byUnit[u.id]=(stats.byUnit[u.id]||0)+1;stats.max=Math.max(stats.max,m.ai.length);local.push({base:q.base,zid:u.id,zlabel:u.label,zshard:u.shard,target:bid,tid:t.id,tlabel:t.label,tshard:t.shard,keys:m.keys,zi:m.ae,ti:m.be,length:m.ai.length,distinct:new Set(m.keys).size,ambiguous:m.ai.filter((i,k)=>es[i].ambiguous||ts[m.bi[k]].ambiguous).length});if(local.length>limit*2){local.sort(compare);local.length=limit;}}
 if(zi%30===0){progress({book:bid,bookIndex:ti+1,books:targets.length,done:zi,total:prepared.length});await new Promise(r=>setTimeout(r,0));}}
 stats.matchedByTarget[bid]=matchedIds.size;local.sort(compare);buckets.push(local.slice(0,limit));}
 const quota=Math.max(1,Math.floor(limit/Math.max(1,targets.length)));const reserved=buckets.flatMap(xs=>xs.slice(0,quota));const reservedKeys=new Set(reserved.map(r=>r.zid+'|'+r.target+'|'+r.tid));const rest=buckets.flat().filter(r=>!reservedKeys.has(r.zid+'|'+r.target+'|'+r.tid)).sort(compare);results.push(...reserved,...rest.slice(0,Math.max(0,limit-reserved.length)));
 results.sort(compare);results.length=Math.min(results.length,limit);stats.ms=Date.now()-started;return {results,stats,limited:stats.matches>results.length};}
 async find(pattern,q){const matches=[];for(const bid of [...new Set(q.targets)]){const idx=await this.get(this.book(bid).index);let count=0,list=[];for(const i of candidates(pattern.keys,idx,pattern.keys.length)){const u=idx.units[i];if(u.id===pattern.zid)continue;const es=sequence(u,q.options),found=Seq.locate(pattern.keys,es,q.options.mode);if(!found)continue;count++;if(list.length<50)list.push({id:u.id,label:u.label,shard:u.shard,indices:found.map((i,k)=>es[i].choices?.[pattern.keys[k]]??es[i].index)});}if(count)matches.push({book:bid,count,units:list,limited:count>list.length});}return matches;}
}
function compare(a,b){return b.length-a.length||a.zid.localeCompare(b.zid)||a.target.localeCompare(b.target)||a.tid.localeCompare(b.tid);}
const api={Engine,normalize,sites,sequence,candidateKeys,candidates,multisetUpper};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VerseSearch=api;
})(typeof self!=='undefined'?self:globalThis);
