/* Reproducible, text-free experiments. All units stay inside their JSON boundaries. */
(function(root){'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./search-core.js'):root.VerseSearch,C=typeof module!=='undefined'&&module.exports?require('./sequence-core.js'):root.VerseCore;
const VERSION='verse-evidence/1';
function rng(seed=73163){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function shuffle(xs,rand){const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function quantile(xs,p){if(!xs.length)return null;const a=xs.slice().sort((a,b)=>a-b),v=(a.length-1)*p,l=Math.floor(v);return a[l]+(a[Math.ceil(v)]-a[l])*(v-l);}
function bh(ps){const a=ps.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p),out=Array(ps.length);let next=1;for(let k=a.length-1;k>=0;k--){next=Math.min(next,a[k].p*a.length/(k+1));out[a[k].i]=next;}return out;}
function seq(u,opts={}){return S.sequence(u,{collapse:true,ambiguity:'exclude',...opts});}
function adjacent(a,b,refs){const x=refs[a]?.split(':'),y=refs[b]?.split(':');return a===b||(x&&y&&x[0]===y[0]&&x[1]===y[1]&&+y[2]===+x[2]+1);}
function edges(es,refs,permuted=false){const out=new Set();for(let i=1;i<es.length;i++){const a=es[i-1],b=es[i];if(a.ambiguous||b.ambiguous)continue;if(!permuted&&b.site>(a.endSite??a.site)+1)continue;if(adjacent(a.key,b.key,refs))continue;out.add(a.key+'>'+b.key);}return out;}
function sharedEdges(a,b,refs,permuted=false){const x=edges(a,refs,permuted),y=edges(b,refs,permuted);return [...x].filter(k=>y.has(k));}
function alignment(a,b,mode='gapped'){return C.longest(a,b,mode);}
function distinctShared(a,b){const x=new Set(S.candidateKeys(a)),y=new Set(S.candidateKeys(b));return [...x].filter(k=>y.has(k));}
function pair(z,t,q,opts={},refs=[]){const options={...q.options,...opts},a=seq(z,options),b=seq(t,options),m=alignment(a,b,options.mode||'bag');return {a,b,m,length:S.accepted(m,a,b,options,refs)?m.ai.length:0,distinct:new Set(m.keys).size,ambiguous:m.ai.filter((ix,k)=>a[ix].ambiguous||b[m.bi[k]].ambiguous).length};}
function resultRow(z,t,bid,p){return {base:'zohar',zid:z.id,zlabel:z.label,zshard:z.shard,target:bid,tid:t.id,tlabel:t.label,tshard:t.shard,keys:p.m.keys,zi:p.m.ae,ti:p.m.be,length:p.length,distinct:p.distinct,ambiguous:p.ambiguous};}
function stripFirst(z){return S.sites(z)[0]?.keys||[];}
function stages(z,t,q,refs){
 const legacy=pair(z,t,q,{ambiguity:'legacy'},refs),site=pair(z,t,q,{ambiguity:'site'},refs),certain=pair(z,t,q,{ambiguity:'exclude'},refs),clean=pair(z,t,q,{ambiguity:'exclude',excludeKeys:stripFirst(z)},refs),min=q.min||2,unique=Math.max(3,min),flags=[];
 flags.push(legacy.length>=min);flags.push(site.length>=min);flags.push(flags[1]&&certain.length>=min);flags.push(flags[2]&&certain.distinct>=unique);flags.push(flags[3]&&clean.length>=min&&clean.distinct>=unique);flags.push(flags[4]&&sharedEdges(clean.a,clean.b,refs).length>0);
 return {flags,legacy,site,certain,clean,edges:sharedEdges(certain.a,certain.b,refs),openingEdges:sharedEdges(clean.a,clean.b,refs)};
}
function siteSummary(record){const groups=new Map();for(let i=0;i<record.events.length;i++){const e=record.events[i],key=e.pos?.slice().sort((a,b)=>a-b).join(',')||String(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...e,index:e.index??i});}const sites=[...groups.values()].map(es=>({events:es,keys:[...new Set(es.map(e=>e.v))].sort((a,b)=>a-b),index:es[0].index,pos:es[0].pos}));let overlaps=0;for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++)if(sites[i].pos?.some(p=>sites[j].pos?.includes(p))){sites[i].overlap=true;sites[j].overlap=true;overlaps++;}return {sites,overlaps,annotations:record.events.length,events:sites.length,ambiguous:sites.filter(s=>s.keys.length>1).length,certainDistinct:new Set(sites.filter(s=>s.keys.length===1).map(s=>s.keys[0])).size};}
function dominantTorah(u,refs){const c=new Map();for(const e of seq(u)) {const b=refs[e.key]?.split(':')[0];if(['Genesis','Exodus','Leviticus','Numbers','Deuteronomy'].includes(b))c.set(b,(c.get(b)||0)+1);}return [...c].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'unknown';}
function stratum(u,refs){const es=seq(u),words=Math.max(1,u.tokenCount||1),density=100*es.length/words;return dominantTorah(u,refs)+'|'+Math.floor(Math.log2(words))+'|'+(density<2?'low':density<5?'medium':'high');}
function matchedPools(indexes,targets,refs,rand){const bins=new Map();for(const id of targets)for(const u of indexes[id].units){const k=stratum(u,refs);if(k.startsWith('unknown|'))continue;if(!bins.has(k))bins.set(k,Object.fromEntries(targets.map(t=>[t,[]])));bins.get(k)[id].push(u.id);}const pools=Object.fromEntries(targets.map(id=>[id,new Set()])),strata=[];
 for(const [key,bs] of bins){const n=Math.min(...targets.map(id=>bs[id].length));if(!n)continue;strata.push({key,n});for(const id of targets)for(const uid of shuffle(bs[id],rand).slice(0,n))pools[id].add(uid);}return {pools,strata};}
async function report(q,indexes,refs,progress=()=>{}){
 const seed=Number(q.seed)||73163,rand=rng(seed),targets=[...new Set(q.targets)].filter(id=>id!=='zohar'&&indexes[id]),zi=indexes.zohar.units.filter(u=>(!q.units||q.units.includes(u.id))&&(!q.sections||q.sections.includes(u.section))&&(!q.unit||q.unit===u.id)),minimum=Math.max(2,+q.min||2),rows=[],rawOnly=[],matrix=zi.map(z=>({id:z.id,label:z.label,section:z.section,counts:{}})),allByTarget={};
 const stagesCounts=targets.map(id=>({id,pairs:Array(6).fill(0),units:Array.from({length:6},()=>new Set())}));
 const fq=new Map();for(const id of ['zohar',...targets])for(const u of indexes[id].units)for(const k of edges(seq(u),refs))fq.set(k,(fq.get(k)||0)+1);
 for(let ti=0;ti<targets.length;ti++){
  const id=targets[ti],ix=indexes[id],targetSeq=new Map(ix.units.map(t=>[t.id,seq(t,{short:!!q.options.short})]));allByTarget[id]=[];
  for(let i=0;i<zi.length;i++){
   const z=zi[i],a=seq(z,{...q.options,ambiguity:'legacy'}),ids=S.candidates(S.candidateKeys(a),ix,minimum);
   for(const j of ids){const t=ix.units[j];if(q.targetUnit&&t.id!==q.targetUnit)continue;const d=stages(z,t,{...q,min:minimum},refs);
    if(d.site.length>=minimum){matrix[i].counts[id]=(matrix[i].counts[id]||0)+1;const row=resultRow(z,t,id,d.site);row.flags=d.flags;row.sharedEdges=d.edges;row.rarity=d.edges.reduce((n,k)=>n+1/(fq.get(k)||1),0);row.survival=d.flags.slice(1).filter(Boolean).length;rows.push(row);}
    if(d.legacy.length>=minimum&&d.site.length<minimum){const row=resultRow(z,t,id,d.legacy);row.flags=d.flags;row.sharedEdges=[];row.rarity=0;row.survival=0;row.basis='legacy';rawOnly.push(row);}
    for(let s=0;s<6;s++)if(d.flags[s]){stagesCounts[ti].pairs[s]++;stagesCounts[ti].units[s].add(z.id);}
    // Order experiment holds the unordered verse overlap and candidate pairs fixed.
    const ca=seq(z,{short:!!q.options.short}),cb=targetSeq.get(t.id);if(distinctShared(ca,cb).length>=Math.max(3,minimum))allByTarget[id].push({z,t,a:ca,b:cb});
   }
   if(i%30===0){progress({phase:'pairs',book:id,done:i,total:zi.length,bookIndex:ti+1,books:targets.length});await new Promise(r=>setTimeout(r,0));}
  }
 }
 const matched={draws:20,byTarget:{},strata:[],poolSize:0};
 for(let d=0;d<20;d++){const {pools,strata}=matchedPools(indexes,targets,refs,rand);matched.strata=strata;matched.poolSize=pools[targets[0]]?.size||0;for(const id of targets){const ms=new Set(rows.filter(r=>r.target===id&&pools[id].has(r.tid)&&r.flags[3]).map(r=>r.zid));(matched.byTarget[id]??=[]).push(ms.size);}}
 const permutations=Math.max(19,Math.min(999,+q.permutations||99)),sampleSize=Math.max(1,Math.min(3093,+q.sampleSize||80)),eligibleIds=new Set(Object.values(allByTarget).flatMap(ps=>ps.map(p=>p.z.id))),eligible=zi.filter(u=>eligibleIds.has(u.id)),sample=shuffle(eligible,rand).slice(0,sampleSize),sampleIds=new Set(sample.map(u=>u.id)),order=[];
 for(const id of targets){const pairs=allByTarget[id].filter(p=>sampleIds.has(p.z.id)),observed=pairs.reduce((n,p)=>n+sharedEdges(p.a,p.b,refs).length,0),nulls=[];
  // Preserve non-citation gaps as barriers; shuffle only contiguous blocks of retained sites.
  function permute(es){const blocks=[];for(const e of es){const last=blocks.at(-1)?.at(-1);if(!last||e.site>(last.endSite??last.site)+1)blocks.push([]);blocks.at(-1).push(e);}return blocks.flatMap(block=>shuffle(block,rand).map((e,i)=>({...e,site:block[i].site,endSite:block[i].endSite??block[i].site})));}
  for(let k=0;k<permutations;k++){const zmap=new Map(),tmap=new Map();for(const p of pairs){if(!zmap.has(p.z.id))zmap.set(p.z.id,permute(p.a));if(!tmap.has(p.t.id))tmap.set(p.t.id,permute(p.b));}nulls.push(pairs.reduce((n,p)=>n+sharedEdges(zmap.get(p.z.id),tmap.get(p.t.id),refs).length,0));if(k%10===0){progress({phase:'permutation',book:id,done:k,total:permutations});await new Promise(r=>setTimeout(r,0));}}
  order.push({id,pairs:pairs.length,observed,mean:nulls.reduce((a,b)=>a+b,0)/permutations,lo:quantile(nulls,.025),hi:quantile(nulls,.975),p:(1+nulls.filter(n=>n>=observed).length)/(permutations+1),nulls});
 }
 const qs=bh(order.map(x=>x.p));order.forEach((x,i)=>x.q=qs[i]);
 rows.sort((a,b)=>b.survival-a.survival||b.rarity-a.rarity||b.distinct-a.distinct||a.zid.localeCompare(b.zid));
 return {schema:VERSION,corpusVersion:q.corpusVersion,seed,query:q,scope:{kind:'all-matches',selectedZohar:zi.length,targets,returnedSearchLimit:null,orderSample:sample.map(u=>u.id),orderPopulation:eligible.length,orderPopulationRule:'Zohar units with >= max(3,min) distinct certain shared verses with at least one unit in any selected target, independent of their order',permutations},matrix,rows,rawOnly,stages:stagesCounts.map(x=>({...x,units:x.units.map(s=>s.size)})),matched,order,method:{primary:'Sum of distinct shared directed non-routine edges per fixed candidate pair; site ambiguity excluded; gaps preserved; permutations shuffle retained contiguous blocks within each JSON, jointly reused per unit within each target experiment.',matched:'Equal target pool size within dominant-Torah-book proxy × log2 word length × citation density strata; 20 seeded draws; full selected Zohar denominator. This is exploratory standardisation, not validated pericope matching.',p:'One-sided Monte Carlo plus-one p; BH across selected targets. Exploratory, conditional on this corpus and null model. No historical dependence inference.'}};
}
const api={VERSION,rng,shuffle,quantile,bh,seq,adjacent,edges,sharedEdges,alignment,distinctShared,pair,resultRow,stages,siteSummary,dominantTorah,stratum,matchedPools,report};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VerseEvidence=api;
})(typeof self!=='undefined'?self:globalThis);
