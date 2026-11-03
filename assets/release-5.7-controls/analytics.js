'use strict';
let analyticsData=null,analysisIndexes={},analysisVersion=0,vizActive=0,vizActions=[],evidenceRows=[],evidencePage=0;
const corpusColors=['#283f62','#ae563f','#997b38'];
const vizDefs=[
 ['פסוקים לפי ספר מקרא','מאילו ספרי מקרא באים הפסוקים בדרשות הבסיס ובדרשות המקבילות?'],
 ['הפסוקים המשותפים','בכמה יחידות מקבילות מופיע כל פסוק של דרשות הבסיס? כל יחידה נספרת פעם אחת לכל פסוק.'],
 ['באילו ספרים יש התאמה','חלוקת הפסוקים של דרשות הבסיס לפי הספרים שבהם הם מופיעים במקבילות שנמצאו.'],
 ['כמות פסוקים ביחידה','כמה הופעות פסוקים יש בדרשות הבסיס ובכל אחת מהדרשות המקבילות? חזרות נספרות.'],
 ['השוואת סדר הפסוקים','לכל זוג דרשות מקבילות: כמה פסוקים משותפים יש ללא סדר, וכמה מהם אפשר לסדר באותו סדר?'],
 ['מקבילות לפי פרשה','באילו פרשות נמצאות היחידות המקבילות לדרשות הבסיס?'],
 ['פסוקים ברצף','האם הפסוקים המשותפים מופיעים ברצף, או שצריך לדלג על הפניות אחרות?'],
 ['כמה פסוקים משותפים','חלוקת המקבילות לפי מספר הפסוקים המשותפים לדרשות הבסיס, בשיטת ההשוואה שנבחרה.']
];
function renderVizNav(){$('#chartSelect').innerHTML=vizDefs.map((v,i)=>'<option value="'+i+'">'+esc(v[0])+'</option>').join('');$('#chartSelect').value=vizActive;}
async function analysisIndex(id){if(!analysisIndexes[id]){const data=await getJSON(book(id).index);analysisIndexes[id]=data;}return analysisIndexes[id];}
async function loadAnalytics(){
 const version=++analysisVersion,selected=selectedBaseUnits();if(!manifest)return;if(!selected.length){analyticsData=null;invalidateGuidance('analytics');$('#analyticsGuidance').innerHTML='';$('#vizPlot').innerHTML='<p class="empty">בחרו לפחות דרשה אחת למעלה, או בחרו הכול.</p>';return;}
 const q={base:$('#base').value,...selectionQuery(),targets:selectedTargets().filter(id=>id!==$('#base').value),options:options(),min:Math.max(2,+$('#lengthN').value||2)};
 invalidateGuidance('analytics');$('#analyticsGuidance').innerHTML='';$('#vizPlot').innerHTML='<p class="empty">מחשב את המקבילות לדרשות שנבחרו…</p>';$('#vizEvidence').innerHTML='';$('#evidencePager').innerHTML='';vizActions=[];evidenceRows=[];
 try{
  const ids=[q.base,...q.targets];await Promise.all(ids.map(analysisIndex));if(version!==analysisVersion)return;
  const wanted=new Set(q.units),zs=analysisIndexes[q.base].units.filter(u=>wanted.has(u.id)),z=zs[0],rows=[];
  for(let n=0;n<zs.length;n++){const z=zs[n],es=VerseSearch.sequence(z,q.options);
  for(const bid of q.targets){const idx=analysisIndexes[bid];
   for(const i of VerseSearch.candidates(es.map(e=>e.key),idx,q.min)){
    const u=idx.units[i],ts=VerseSearch.sequence(u,q.options);if(VerseSearch.multisetUpper(es,ts)<q.min)continue;
    const ordered=VerseCore.longest(es,ts,'gapped'),bag=VerseCore.longest(es,ts,'bag'),contiguous=VerseCore.longest(es,ts,'contiguous');
    const alignment={gapped:ordered,bag,contiguous}[q.options.mode];if(alignment.ai.length<q.min)continue;
    rows.push({book:bid,z,u,length:alignment.ai.length,ordered:ordered.ai.length,bag:bag.ai.length,contiguous:contiguous.ai.length,alignment});
   }
  }
  if(n%40===0){await new Promise(r=>setTimeout(r,0));if(version!==analysisVersion)return;}
  }
  if(version!==analysisVersion)return;
  analyticsData={q,z,zs,rows,books:ids.map(book)};
  const old=$('#vizTarget').value;$('#vizTarget').innerHTML='<option value="">כל הספרים להשוואה</option>'+q.targets.map(id=>'<option value="'+id+'">'+esc(title(id))+'</option>').join('');$('#vizTarget').value=q.targets.includes(old)?old:'';
  $('#dashStats').innerHTML=[['דרשות בבסיס',zs.length],['פסוקים שונים',new Set(zs.flatMap(u=>u.seq.map(e=>e[0]))).size],['זוגות מקבילים',rows.length]].map(([t,n])=>'<div><strong>'+fmt(n)+'</strong><span>'+t+'</span></div>').join('');
  $('#analysisScope').textContent=title(q.base)+' · '+zs.length+' דרשות · לפחות '+q.min+' פסוקים משותפים · '+({gapped:'לפי הסדר, עם דילוגים',bag:'ללא סדר',contiguous:'רצף רציף'}[q.options.mode]);
  renderVisualization();if(!rows.length)showGuidance('analytics',q).catch(error);
 }catch(e){if(version===analysisVersion){analyticsData=null;$('#vizPlot').innerHTML='<p class="empty">לא ניתן לטעון את התרשימים. <button id="retryAnalytics">ניסיון נוסף</button></p>';throw e;}}
}
function vizButton(html,action,attrs=''){const i=vizActions.push(action)-1;return '<button '+attrs+' data-viz-hit="'+i+'">'+html+'</button>';}
function evidence(label,rows){evidenceRows=rows;evidencePage=0;$('#evidenceTitle').textContent=label;renderEvidence();}
function renderEvidence(){
 const pages=Math.ceil(evidenceRows.length/25);evidencePage=Math.max(0,Math.min(evidencePage,Math.max(0,pages-1)));
 $('#vizEvidence').innerHTML=(!evidenceRows.length?'<p class="empty">אין עדויות בנתון הזה. בחרו תא או עמודה עם ערך גדול מאפס, או עברו לתרשים המקורות.</p><button data-viz-tab="0">פסוקים לפי ספר מקרא</button>':'')+'<p class="evidence-count">'+fmt(evidenceRows.length)+' יחידות</p>'+evidenceRows.slice(evidencePage*25,evidencePage*25+25).map((r,i)=>'<button class="evidence" data-evidence="'+(evidencePage*25+i)+'"><small>'+esc(title(r.book))+'</small><strong>'+esc(r.u.label)+'</strong><span>'+(r.alignment?r.length+' פסוקים משותפים · פתיחת ההשוואה ↗':'פתיחת הטקסט המלא ↗')+'</span></button>').join('');
 $('#evidencePager').innerHTML=pages?'<button data-evpage="-1" '+(!evidencePage?'disabled':'')+'>הקודם</button><span>'+(evidencePage+1)+' / '+pages+'</span><button data-evpage="1" '+(evidencePage+1>=pages?'disabled':'')+'>הבא</button>':'';
}
function renderVisualization(){
 if(!analyticsData)return;
 const {q,z,rows,books}=analyticsData,zs=analyticsData.zs||[z],baseEvents=zs.flatMap(u=>u.seq);
 const groups=books.map((b,i)=>({book:b,units:i?[...new Map(rows.filter(r=>r.book===b.id).map(r=>[r.u.id,r.u])).values()]:zs,color:corpusColors[i%3]}));
 const selectedRows=$('#vizTarget').value?rows.filter(r=>r.book===$('#vizTarget').value):rows;
 const refs=[...new Set(baseEvents.map(e=>e[0]))];
 const unitRows=(g,predicate,hit=()=>true)=>g.units.filter(predicate).map(u=>({book:g.book.id,u,event:u.seq.find(hit)?.[1]}));
 const legend=()=>'<div class="corpus-legend">'+groups.map((g,i)=>'<span style="--c:'+g.color+'">'+esc(g.book.title)+(i?' · '+g.units.length+' מקבילות':' · '+zs.length+' דרשות בסיס')+'</span>').join('')+'</div>';
 const bars=items=>'<div class="summary-bars">'+items.map(x=>vizButton('<span class="summary-label">'+esc(x.label)+'</span><span class="summary-track"><i style="width:'+x.percent+'%;background:'+x.color+'"></i></span><strong>'+esc(x.value)+'</strong><small>'+esc(x.detail||'')+'</small>',x.action,'class="summary-bar"')).join('')+'</div>';
 vizActions=[];evidenceRows=[];evidencePage=0;renderVizNav();$('#evidenceTitle').textContent='לחצו על נתון בתרשים';$('#vizEvidence').innerHTML='<p class="empty">כאן יופיעו הקטעים שנכללים בנתון שבחרתם.</p>';$('#evidencePager').innerHTML='';
 $('#vizTitle').textContent=vizDefs[vizActive][0];$('#vizCaption').textContent=vizDefs[vizActive][1];$('#vizTarget').hidden=true;
 if(!rows.length&&vizActive>=4){$('#vizPlot').innerHTML='<p class="empty">אין זוגות מקבילים בבחירה זו. אפשר לראות את הפסוקים בדרשות שנבחרו או לבחור הצעת חיפוש עם תוצאות.</p><button data-viz-tab="0">פסוקים לפי ספר מקרא</button><button data-viz-tab="3">כמות פסוקים בדרשה</button>';$('#vizNote').textContent='תרשימי הזוגות דורשים מקבילות; תרשימי המקורות זמינים גם בלעדיהן.';return;}
 let html='',insight='';
 if(vizActive===0){
  const keys=VerseCore.BOOKS.filter(([key])=>groups.some(g=>g.units.some(u=>u.seq.some(e=>verses[e[0]].startsWith(key+':')))));
  html='<div class="chart-scroll"><table class="heat-table"><thead><tr><th>יחידות</th>'+keys.map(b=>'<th>'+b[1]+'</th>').join('')+'</tr></thead><tbody>'+groups.map((g,i)=>{
   const total=g.units.reduce((n,u)=>n+u.seq.length,0);
   return '<tr><th>'+esc(g.book.title)+(i?' · המקבילות':' · הבסיס')+'</th>'+keys.map(([key,name])=>{const n=g.units.reduce((n,u)=>n+u.seq.filter(e=>verses[e[0]].startsWith(key+':')).length,0),pct=total?100*n/total:0;
    return '<td>'+vizButton('<strong>'+pct.toFixed(1)+'%</strong><small>'+n+' הופעות</small>',()=>evidence(g.book.title+' · '+name,unitRows(g,u=>u.seq.some(e=>verses[e[0]].startsWith(key+':')),e=>verses[e[0]].startsWith(key+':'))),'class="heat-cell" style="--heat:'+(.04+.85*pct/100)+'"')+'</td>';}).join('')+'</tr>';
  }).join('')+'</tbody></table></div>';
  insight='הבסיס: '+zs.length+' דרשות נפרדות. בכל ספר אחר נספרים רק הפסוקים שביחידות המקבילות שנמצאו, כולל פסוקים נוספים שאינם ברצף המשותף.';
 }
 if(vizActive===1){
  const ranked=refs.map(v=>({v,n:new Set(rows.filter(r=>r.u.seq.some(e=>e[0]===v)).map(r=>r.book+':'+r.u.id)).size})).sort((a,b)=>b.n-a.n),max=Math.max(1,...ranked.map(r=>r.n));
  html=legend()+'<div class="rank-chart">'+ranked.map(({v})=>'<div class="rank-row"><strong>'+esc(label(v))+'</strong><div>'+groups.slice(1).map(g=>{const us=g.units.filter(u=>u.seq.some(e=>e[0]===v));return vizButton('<i style="width:'+100*us.length/max+'%;background:'+g.color+'"></i><span>'+us.length+'</span>',()=>evidence(label(v)+' · '+g.book.title,us.map(u=>({book:g.book.id,u,event:u.seq.find(e=>e[0]===v)[1]}))),'class="bar-button" title="'+esc(g.book.title)+'"');}).join('')+'</div></div>').join('')+'</div>';
  insight=ranked[0]?label(ranked[0].v)+' מופיע ב־'+ranked[0].n+' מהיחידות המקבילות.':'ביחידה זו לא זוהו פסוקים.';
 }
 if(vizActive===2){
  const sets=new Map();for(const v of refs){const mask=groups.slice(1).map(g=>g.units.some(u=>u.seq.some(e=>e[0]===v))?'1':'0').join('');if(!sets.has(mask))sets.set(mask,[]);sets.get(mask).push(v);}
  html=bars([...sets].map(([mask,vs])=>{const names=groups.slice(1).filter((g,i)=>mask[i]==='1').map(g=>g.book.title);return {label:names.length?names.join(' + '):'רק ביחידת הבסיס',percent:refs.length?100*vs.length/refs.length:0,value:vs.length+' פסוקים',color:corpusColors[0],action:()=>{const set=new Set(vs);evidence(names.join(' + ')||'פסוקים ללא מקבילה',groups.flatMap(g=>g.units.filter(u=>u.seq.some(e=>set.has(e[0]))).map(u=>({book:g.book.id,u,event:u.seq.find(e=>set.has(e[0]))[1]}))));}};}));
  insight='נספרים '+refs.length+' פסוקים שונים של דרשות הבסיס. הופעות חוזרות של אותו פסוק נספרות כאן פעם אחת.';
 }
 if(vizActive===3){
  const bins=[[0,0,'0'],[1,1,'1'],[2,4,'2–4'],[5,9,'5–9'],[10,19,'10–19'],[20,Infinity,'20+']];
  html=legend()+'<div class="histogram">'+bins.map(([lo,hi,name])=>'<div class="hist-bin"><div class="hist-bars">'+groups.map(g=>{const us=g.units.filter(u=>u.seq.length>=lo&&u.seq.length<=hi),pct=g.units.length?100*us.length/g.units.length:0;return vizButton('<b>'+us.length+'</b><i style="height:'+Math.max(2,pct*2)+'px;background:'+g.color+'"></i>',()=>evidence(g.book.title+' · '+name+' הופעות פסוקים',us.map(u=>({book:g.book.id,u,event:u.seq[0]?.[1]}))),'class="hist-bar" title="'+esc(g.book.title+' · '+pct.toFixed(1)+'%')+'"');}).join('')+'</div><strong>'+name+'</strong></div>').join('')+'</div><p class="axis-label">הטווח בתחתית = כמות הופעות פסוקים ביחידה; המספר מעל העמודה = מספר יחידות. גובה העמודה = אחוז היחידות באותו ספר.</p>';
  insight='בדרשות הבסיס יש '+baseEvents.length+' הופעות של '+refs.length+' פסוקים שונים. חזרה על פסוק נספרת כהופעה נוספת.';
 }
 if(vizActive===4){
  const bins=new Map();for(const r of selectedRows){const key=r.bag+':'+r.ordered;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(r);}
  const max=Math.max(2,...selectedRows.map(r=>r.bag)),peak=Math.max(1,...[...bins.values()].map(rs=>rs.length)),x=v=>52+596*v/max,y=v=>368-316*v/max;
  html='<div class="scatter"><svg viewBox="0 0 700 420" role="img" aria-label="כמות פסוקים משותפים לפי סדר וללא סדר"><path d="M52 22V368H680" fill="none" stroke="#a7a29a"/><path d="M52 368L648 52" stroke="#9c9a90" stroke-dasharray="5 5"/>';
  for(let t=0;t<=max;t++)html+='<text x="'+x(t)+'" y="389" text-anchor="middle">'+t+'</text><text x="36" y="'+(y(t)+4)+'">'+t+'</text>';
  for(const [key,rs] of bins){const [a,b]=key.split(':').map(Number),i=vizActions.push(()=>evidence(a+' פסוקים ללא סדר / '+b+' לפי סדר',rs))-1;html+='<circle cx="'+x(a)+'" cy="'+y(b)+'" r="'+Math.max(4,22*Math.sqrt(rs.length/peak))+'" fill="#a64c3c" fill-opacity=".7" stroke="white" data-viz-hit="'+i+'" role="button" tabindex="0" aria-label="'+rs.length+' יחידות, '+a+' ללא סדר, '+b+' לפי סדר"><title>'+rs.length+' יחידות</title></circle>';}
  html+='<text x="350" y="415" text-anchor="middle">מספר פסוקים משותפים ללא סדר</text><text x="55" y="16">מספר פסוקים לפי סדר</text></svg></div>';
  insight=selectedRows.filter(r=>r.ordered===r.bag).length+' מתוך '+selectedRows.length+' מקבילות שומרות על מלוא סדר הפסוקים המשותפים. גודל הנקודה מייצג מספר יחידות.';
 }
 if(vizActive===5){
  const bins=new Map();for(const r of selectedRows){const key=r.book+'|'+r.u.section;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(r);}const values=[...bins.values()].sort((a,b)=>b.length-a.length),max=Math.max(1,...values.map(rs=>rs.length));
  html=bars(values.map(rs=>({label:title(rs[0].book)+' · '+rs[0].u.section,percent:100*rs.length/max,value:rs.length+' זוגות',color:corpusColors[1],action:()=>evidence(rs[0].u.section,rs)})));
  insight=values.length?'המקבילות מפוזרות ב־'+values.length+' קבוצות של ספר ופרשה. כל זוג דרשות נספר פעם אחת.':'לא נמצאו מקבילות בהגדרות הנוכחיות.';
 }
 if(vizActive===6){
  const bins=[['כל הפסוקים המשותפים ברצף',r=>r.contiguous===r.bag],['חלקם ברצף וחלקם בדילוגים',r=>r.contiguous>=2&&r.contiguous<r.bag],['אין שני פסוקים משותפים ברצף',r=>r.contiguous<2]];
  html=bars(bins.map(([name,test],i)=>{const rs=selectedRows.filter(test),pct=selectedRows.length?100*rs.length/selectedRows.length:0;return {label:name,percent:pct,value:pct.toFixed(1)+'%',detail:rs.length+' זוגות',color:corpusColors[i],action:()=>evidence(name,rs)};}));
  insight='הרציפות נמדדת בין הפניות הפסוקים, לאחר הסינון שנבחר. אין הכוונה לכך שכל מילות הציטוט צמודות זו לזו.';
 }
 if(vizActive===7){
  const bins=new Map();for(const r of selectedRows){if(!bins.has(r.length))bins.set(r.length,[]);bins.get(r.length).push(r);}const max=Math.max(1,...[...bins.values()].map(rs=>rs.length));
  html=bars([...bins].sort((a,b)=>a[0]-b[0]).map(([n,rs])=>({label:n+' פסוקים משותפים',percent:100*rs.length/max,value:rs.length+' זוגות',color:corpusColors[0],action:()=>evidence(n+' פסוקים משותפים',rs)})));
  insight=selectedRows.length?'ההתאמה הארוכה ביותר כוללת '+Math.max(...selectedRows.map(r=>r.length))+' פסוקים משותפים.':'לא נמצאו מקבילות. אפשר להקטין את מספר הפסוקים הנדרש בחיפוש.';
 }
 $('#vizPlot').innerHTML='<div class="insight-strip">'+esc(insight)+'</div>'+(html||'<p class="empty">אין נתונים להצגה ביחידה שנבחרה.</p>');
 $('#vizNote').textContent=zs.length+' דרשות בסיס והמקבילות שלהן · כל רצף מחושב בתוך דרשה נפרדת · החיפוש והתרשימים משתמשים באותם מסננים · ספירות פסוקים בתוך טקסט כוללות את כל ההופעות שבמקור. אפשר לפתוח כל עדות ולבדוק אותה.';
}
async function openEvidence(r){
 if(r.alignment){const q=analyticsData.q;$('#base').value=q.base;await changeBase();fillUnits(r.z.id);$('#comparisonBook').value=q.targets.length>1?'both':r.book;$('#mode').value=q.options.mode;$('#collapse').checked=q.options.collapse;$('#short').checked=q.options.short;$('#lengthN').value=q.min;showPage('search');await run(r.u.id);return;}
 await browseTo(r.book,r.u.id);
 if(r.event!==undefined){const e=browseRecord?.events[r.event],box=$('#browseReader .read-text');if(e&&box){for(const pos of e.pos)box.querySelector('[data-token="'+pos+'"]')?.classList.add('token-focus');const mark=box.querySelector('[data-token="'+e.pos[0]+'"]');if(mark)box.scrollTop+=mark.getBoundingClientRect().top-box.getBoundingClientRect().top-45;}}
}
document.addEventListener('click',e=>{let t=e.target.closest('[data-viz-tab]');if(t){vizActive=+t.dataset.vizTab;showPage('analytics');return;}if(e.target.closest('#retryAnalytics')){loadAnalytics().catch(error);return;}t=e.target.closest('[data-viz-hit]');if(t){vizActions[+t.dataset.vizHit]?.();return;}t=e.target.closest('[data-evidence]');if(t){openEvidence(evidenceRows[+t.dataset.evidence]).catch(error);return;}t=e.target.closest('[data-evpage]');if(t){evidencePage+=+t.dataset.evpage;renderEvidence();}});
$('#vizTarget').onchange=renderVisualization;

$('#chartSelect').onchange=()=>{vizActive=+$('#chartSelect').value;renderVisualization();};
