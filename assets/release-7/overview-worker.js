importScripts('data-loader.js','sequence-core.js','search-core.js');
let job=0;
onmessage=async({data})=>{
 if(data.type==='cancel'){job++;return;}
 const token=++job;
 try{
  const {manifest,dataURL,comparisons,minimum,options}=data;
  const engine=new VerseSearch.Engine(manifest,(path)=>DataFiles.read(path,dataURL,manifest));
  const rows=[];
  for(let i=0;i<comparisons.length;i++){
   if(token!==job)return;
   const c=comparisons[i],sameSet=c.a.id===c.b.id&&JSON.stringify(c.a.sections||null)===JSON.stringify(c.b.sections||null);
   const q={base:c.a.id,sections:c.a.sections||undefined,targets:[c.b.id],targetSections:c.b.sections||undefined,sameSet,min:minimum,options,limit:100};
   const ab=await engine.query(q,()=>{});
   if(token!==job)return;
   const ba=await engine.query({...q,base:c.b.id,sections:c.b.sections||undefined,targetSections:c.a.sections||undefined,sameSet},()=>{});
   const aCoverage=ab.stats.baseUnits?100*ab.stats.matchedBaseUnits/ab.stats.baseUnits:0;
   const bCoverage=ba.stats.baseUnits?100*ba.stats.matchedBaseUnits/ba.stats.baseUnits:0;
   const similarity=(aCoverage+bCoverage)?2*aCoverage*bCoverage/(aCoverage+bCoverage):0;
   rows.push({a:c.a,b:c.b,pairs:ab.stats.matches,reversePairs:ba.stats.matches,aUnits:ab.stats.baseUnits,bUnits:ba.stats.baseUnits,aMatched:ab.stats.matchedBaseUnits,bMatched:ba.stats.matchedBaseUnits,aCoverage,bCoverage,similarity,max:ab.stats.max,examples:[...ab.results,...ba.results].sort((x,y)=>y.length-x.length).slice(0,80),example:ab.results[0]||ba.results[0]||null});
   postMessage({type:'progress',done:i+1,total:comparisons.length,label:c.label});
  }
  postMessage({type:'result',rows,options,minimum});
 }catch(e){postMessage({type:'error',message:e.message||String(e)});}
};
