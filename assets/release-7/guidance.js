'use strict';
let guidanceVersions={},guidanceChoices={};
function invalidateGuidance(place){guidanceVersions[place]=(guidanceVersions[place]||0)+1;guidanceChoices[place]=[];}
async function showGuidance(place,q){
 const element=$('#'+place+'Guidance');if(!element)return;invalidateGuidance(place);const version=guidanceVersions[place];
 element.innerHTML='<p>לא נמצאו מקבילות בהגדרות האלה. בודק באילו בחירות יש תוצאות…</p>';
 const configs=[
  {label:'בדרשות שנבחרו · לפחות 2 פסוקים · אותם מסננים',query:{...q,min:2,targetUnit:null}},
  {label:'בדרשות שנבחרו · לפחות 2 פסוקים · ללא סדר',query:{...q,min:2,targetUnit:null,options:{...q.options,mode:'bag'}}},
  {label:'כל דרשות '+title(q.base)+' · אותם מסננים',query:{...q,unit:null,units:null,section:'',sections:null,targetUnit:null}},
  {label:'כל דרשות '+title(q.base)+' · 2 פסוקים לפי הסדר · כולל זיהויים קצרים, ללא סינון פסוקים',query:{...q,unit:null,units:null,section:'',sections:null,targetUnit:null,intersection:null,min:2,options:{mode:'gapped',collapse:true,short:false}}}
 ];
 const seen=new Set();for(const config of configs){const key=JSON.stringify(config.query);if(seen.has(key))continue;seen.add(key);
  try{const r=await request('query',{query:{...config.query,limit:1}});if(version!==guidanceVersions[place])return;
   if(r.result.stats.matches){guidanceChoices[place].push({...config,count:r.result.stats.matches});element.innerHTML='<strong>אפשר לעבור לחיפוש שיש בו מקבילות:</strong><div class="guidance-actions">'+guidanceChoices[place].map((c,i)=>'<button data-guidance="'+place+'" data-choice="'+i+'">'+esc(c.label)+' <b>'+fmt(c.count)+' מקבילות</b></button>').join('')+'</div><small>ההגדרות ישתנו רק בלחיצה על אחת ההצעות. הספירות חושבו באינדקס המלא.</small>';}
  }catch(e){if(version!==guidanceVersions[place]||e.message==='החיפוש הופסק')return;throw e;}
 }
 if(version===guidanceVersions[place]&&!guidanceChoices[place].length)element.innerHTML='<strong>לא נמצאו רצפים משותפים גם בהרחבות שנבדקו.</strong><p>אפשר לבחור מקור אחר או לעבור לתרשימי שכיחויות, שאינם דורשים רצף מקביל.</p><button data-page="lab">פתיחת המעבדה</button><button data-page="browse">דפדוף בטקסטים</button>';
}
async function applyGuidance(place,index){const c=guidanceChoices[place]?.[index];if(!c)return;const q=c.query;
 if(place==='lab'){labOverride=JSON.parse(JSON.stringify(q));$('#labCustomScope').hidden=false;$('#labScope').value='custom';$('#labMin').value=String(q.min);$('#labMode').value=q.options.mode;await runLab();return;}
 $('#base').value=q.base;await changeBase();restoreSelection({...q,units:q.units??(q.unit?[q.unit]:baseIndex.units.map(u=>u.id))});$('#mode').value=q.options.mode;$('#collapse').checked=q.options.collapse;$('#short').checked=q.options.short;$('#lengthN').value=q.min;$('#length').value=q.min;SourceUI.set(q.targets);syncModeControls();
 if(place==='analytics'){await loadAnalytics();}else{showPage('search');await run(null,{reveal:false,refs:q.options.refs||null});}
}
function initGuidance(){document.addEventListener('click',e=>{const t=e.target.closest('[data-guidance]');if(t)applyGuidance(t.dataset.guidance,+t.dataset.choice).catch(error);});}
