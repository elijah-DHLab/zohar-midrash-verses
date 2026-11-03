(function(root){'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./search-core.js'):root.VerseSearch,C=typeof module!=='undefined'&&module.exports?require('./sequence-core.js'):root.VerseCore;
async function compute(q,load,progress=()=>{}){
 const ids=[...new Set([q.base,...q.targets])],indexes={};for(const id of ids)indexes[id]=await load(id);
 let refs=q.options.refs||null;if(q.intersection){const sets=q.intersection.map(id=>new Set(indexes[id].units.flatMap(u=>u.seq.map(e=>e[0]))));refs=[...sets[0]].filter(v=>sets.every(s=>s.has(v)));}
 const options={...q.options,...(refs?{refs}:{})},base=indexes[q.base];
 const unitIds=Array.isArray(q.units)?new Set(q.units):null,sections=Array.isArray(q.sections)?new Set(q.sections):null;const zi=base.units.map((u,i)=>i).filter(i=>(unitIds?unitIds.has(base.units[i].id):!q.unit||base.units[i].id===q.unit)&&(sections?sections.has(base.units[i].section):!q.section||base.units[i].section===q.section)),pairs=[];
 for(let n=0;n<zi.length;n++){const i=zi[n],es=S.sequence(base.units[i],options);
  if(es.length>=q.min)for(const bid of q.targets){const idx=indexes[bid];for(const j of S.candidates(es.map(e=>e.key),idx,q.min)){
   if(q.targetUnit&&idx.units[j].id!==q.targetUnit)continue;const ts=S.sequence(idx.units[j],options);if(S.multisetUpper(es,ts)<q.min)continue;
   const o=C.longest(es,ts,'gapped').ai.length,bg=C.longest(es,ts,'bag').ai.length,c=C.longest(es,ts,'contiguous').ai.length,l={gapped:o,bag:bg,contiguous:c}[options.mode];if(l>=q.min)pairs.push({b:bid,z:i,t:j,l,o,bg,c});
  }}
  if(n%40===0){progress({done:n,total:zi.length});await new Promise(r=>setTimeout(r,0));}
 }
 const groups=ids.map(id=>({id,units:id===q.base?zi:(q.cohort? [...new Set(pairs.filter(p=>p.b===id).map(p=>p.t))]:indexes[id].units.map((u,i)=>i))}));
 return {q:{...q,options},groups,pairs,refs};
}
const api={compute};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VerseLab=api;
})(typeof self!=='undefined'?self:globalThis);
