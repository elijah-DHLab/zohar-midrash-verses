(function(root){'use strict';
function info(v,refs){const [book,ch,verse]=String(refs[v]||'').split(':');return {book,ch:+ch,verse:+verse};}
function relation(a,b,refs){const x=info(a,refs),y=info(b,refs);if(a===b)return 'repeat';if(x.book!==y.book)return 'cross';if(x.ch===y.ch&&y.verse===x.verse+1)return 'adjacent';return 'within';}
function groups(events,refs,{collapse=true,group=false,exclude=null,indices=null}={}){
 const allowed=indices?new Set(indices):null,out=[];
 for(let i=0;i<events.length;i++){const e=events[i];if((allowed&&!allowed.has(i))||e.v===exclude)continue;const prev=out.at(-1);const last=prev?.events.at(-1);const consecutive=last&&i===last.i+1;
 if(consecutive&&((collapse&&last.v===e.v)||(group&&relation(last.v,e.v,refs)==='adjacent'))){prev.events.push({...e,i});prev.refs.push(e.v);continue;}
 out.push({v:e.v,refs:[e.v],events:[{...e,i}]});
 }return out;
}
function transitions(gs,refs){return gs.slice(1).map((b,i)=>{const a=gs[i],x=a.events.at(-1),y=b.events[0];return {a:x.v,b:y.v,key:x.v+'>'+y.v,type:relation(x.v,y.v,refs),gap:y.i-x.i-1,from:x.i,to:y.i};});}
function analyze(events,refs,opts={}){const gs=groups(events,refs,opts),ts=transitions(gs,refs);return {groups:gs,transitions:ts,raw:gs.reduce((n,g)=>n+g.events.length,0),unique:new Set(gs.flatMap(g=>g.refs)).size,cross:ts.filter(t=>t.type==='cross'&&t.gap===0).length,adjacent:ts.filter(t=>t.type==='adjacent'&&t.gap===0).length,repeats:gs.reduce((n,g)=>n+g.events.filter((e,i)=>i&&e.v===g.events[i-1].v).length,0)};}
function lcs(a,b){let row=new Uint16Array(b.length+1);for(const x of a){const next=new Uint16Array(b.length+1);for(let j=1;j<=b.length;j++)next[j]=x===b[j-1]?row[j-1]+1:Math.max(row[j],next[j-1]);row=next;}return row[b.length];}
function compare(analyses){if(analyses.length<2)return [];return analyses.slice(1).map(a=>{const base=analyses[0];const keys=new Set(a.groups.flatMap(g=>g.refs));const bs=new Set(base.groups.flatMap(g=>g.refs));const common=[...bs].filter(v=>keys.has(v));const set=new Set(a.transitions.filter(t=>t.gap===0&&t.type!=='repeat'&&t.type!=='adjacent').map(t=>t.key));return {common,ordered:lcs(base.groups.map(g=>g.v),a.groups.map(g=>g.v)),transitions:base.transitions.filter(t=>t.gap===0&&t.type!=='repeat'&&t.type!=='adjacent'&&set.has(t.key))};});}
function residual(record){const tokens=record.tokens||record.text.trim().split(/\s+/),removed=new Set(record.events.flatMap(e=>e.pos)),parts=[];let start=null;for(let i=0;i<=tokens.length;i++){if(i<tokens.length&&!removed.has(i)){if(start===null)start=i;}else if(start!==null){parts.push({start,end:i,text:tokens.slice(start,i).join(' ')});start=null;}}return parts;}
function family(unit){const s=(unit.location||unit.id||'')+' '+(unit.section||'');if(/Idra|אדרא/i.test(s))return 'אידרות — לפי שם הקובץ';if(/Ne.?elam|נעלם/i.test(s))return 'מדרש הנעלם — לפי שם הקובץ';if(/Ra.?ya|Meheimna|מהימנא/i.test(s))return 'רעיא מהימנא — לפי שם הקובץ';if(/Tikkun|Tiqun|תיקונ/i.test(s))return 'תיקונים — לפי שם הקובץ';return 'שיוך לחטיבה לא נקבע';}
function frequencies(indexes,refs){const verse=new Map(),edge=new Map();let units=0;for(const idx of indexes)for(const u of idx.units){units++;const vs=new Set(u.seq.map(x=>x[0])),es=new Set();for(const v of vs)verse.set(v,(verse.get(v)||0)+1);for(let i=1;i<u.seq.length;i++){const a=u.seq[i-1][0],b=u.seq[i][0];if(a!==b)es.add(a+'>'+b);}for(const k of es)edge.set(k,(edge.get(k)||0)+1);}return {verse,edge,units};}
const api={info,relation,groups,transitions,analyze,compare,lcs,residual,family,frequencies};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ResearchCore=api;
})(typeof self!=='undefined'?self:globalThis);
