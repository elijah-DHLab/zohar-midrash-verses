(function(root){
"use strict";
const C={zohar:{name:'זוהר',color:'#087f83',badge:''},tanchuma:{name:'תנחומא',color:'#c86b30',badge:'orange'},buber:{name:'תנחומא בובר',color:'#8064b1',badge:'purple'}};
const BOOKS=[['Genesis','בראשית'],['Exodus','שמות'],['Leviticus','ויקרא'],['Numbers','במדבר'],['Deuteronomy','דברים'],['Joshua','יהושע'],['Judges','שופטים'],['I_Samuel','שמואל א'],['II_Samuel','שמואל ב'],['I_Kings','מלכים א'],['II_Kings','מלכים ב'],['Isaiah','ישעיהו'],['Jeremiah','ירמיהו'],['Ezekiel','יחזקאל'],['Hosea','הושע'],['Joel','יואל'],['Amos','עמוס'],['Obadiah','עובדיה'],['Jonah','יונה'],['Micah','מיכה'],['Nahum','נחום'],['Habakkuk','חבקוק'],['Zephaniah','צפניה'],['Haggai','חגי'],['Zechariah','זכריה'],['Malachi','מלאכי'],['Psalms','תהלים'],['Proverbs','משלי'],['Job','איוב'],['Song_of_Songs','שיר השירים'],['Ruth','רות'],['Lamentations','איכה'],['Ecclesiastes','קהלת'],['Esther','אסתר'],['Daniel','דניאל'],['Ezra','עזרא'],['Nehemiah','נחמיה'],['I_Chronicles','דברי הימים א'],['II_Chronicles','דברי הימים ב']];
const SECTIONS={'Addenda':'תוספות',"Idra Zuta":'אדרא זוטא',"Ha'Azinu":'האזינו','Ki Teitzei':'כי תצא','Vayeilech':'וילך','Devarim':'דברים','Eikev':'עקב','Ki Tavo':'כי תבוא','Masei':'מסעי','Nitzavim':'ניצבים',"Re'eh":'ראה','Shoftim':'שופטים',"V'Zot HaBerachah":'וזאת הברכה','Vaetchanan':'ואתחנן','Appendix to Devarim':'נספח לדברים',"Appendix to Re'eh":'נספח לראה','Appendix to Vaetchanan':'נספח לואתחנן'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0591-\u05c7]/g,'').replace(/["'׳״:.,;!?()[\]{}־–—]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function refInfo(ref){const m=String(ref).replace(/_+/g,'_').match(/^Tanakh_(?:Torah|Prophets|Writings)_(.+)_(\d+)_(\d+)$/);if(!m)return null;const ix=BOOKS.findIndex(b=>b[0]===m[1]);if(ix<0)return null;return {book:m[1],bookName:BOOKS[ix][1],order:ix,ch:+m[2],v:+m[3],key:m[1]+':'+m[2]+':'+m[3],label:BOOKS[ix][1]+' '+m[2]+':'+m[3]};}
function prep(r){r.corpus=C[r.corpus]?r.corpus:(r.location.includes('Buber')?'buber':r.location.includes('Zohar')?'zohar':'tanchuma');const m=r.location.split('__').pop().match(/^(.*?)_(\d+)_(\d+)_(\d+)$/);r.section=m?m[1]:r.location;r.sectionName=SECTIONS[r.section]||r.section;r.title=r.sectionName+(m?' · '+m[3]+(m[4]!=='1'?'.'+m[4]:''):'');r.events=r.events.filter(e=>Array.isArray(e.pos)&&e.pos.length&&e.pos.every(p=>Number.isInteger(p)&&p>=0)).map(e=>({...e,...refInfo(e.ref),words:Array.isArray(e.words)?e.words:[]})).filter(e=>e.key).sort((a,b)=>a.pos[0]-b.pos[0]);r.events.forEach((e,i)=>e.index=i);const texts=[r.text||'',r.clean||''];const scores=texts.map(t=>{let tok=t.trim().split(/\s+/);let good=0,total=0;for(const e of r.events)for(let j=0;j<e.pos.length;j++){total++;if(norm(tok[e.pos[j]])===norm(e.words[j]))good++;}return total?good/total:1;});r.displayText=texts[0]||texts[1];r.align=texts[0]?scores[0]:scores[1];r.tokens=r.displayText.trim().split(/\s+/);r.search=norm(r.title+' '+r.location+' '+r.displayText+' '+r.events.map(e=>e.label+' '+e.book+' '+e.ch+' '+e.v).join(' '));return r;}
function sequence(r,opts={}){let es=r.events.filter(e=>!opts.short||e.words.length>=3);if(opts.collapse)es=es.filter((e,i)=>i===0||es[i-1].key!==e.key);return es;}
function keys(e){return e.keys||[e.key];}
function common(a,b){const bs=new Set(keys(b));return keys(a).find(k=>bs.has(k));}
function longest(a,b,mode){
 const compatible=(i,j)=>common(a[i],b[j])!==undefined;
 let ai=[],bi=[];const n=a.length,m=b.length;
 if(mode==='bag'){
  // Maximum bipartite matching: a citation site can be used at most once.
  const owner=new Int32Array(m).fill(-1),edges=a.map(x=>b.map((y,j)=>common(x,y)!==undefined?j:-1).filter(j=>j>=0));
  function visit(i,seen){for(const j of edges[i]){if(seen.has(j))continue;seen.add(j);if(owner[j]===-1||visit(owner[j],seen)){owner[j]=i;return true;}}return false;}
  for(let i=0;i<n;i++)visit(i,new Set());
  const pairs=Array.from(owner,(i,j)=>[i,j]).filter(([i])=>i>=0).sort((x,y)=>x[0]-y[0]);ai=pairs.map(x=>x[0]);bi=pairs.map(x=>x[1]);
 }else if(mode==='contiguous'){
  let prev=new Uint16Array(m+1),best=0,endA=0,endB=0;
  for(let i=1;i<=n;i++){const row=new Uint16Array(m+1);for(let j=1;j<=m;j++)if(compatible(i-1,j-1)){row[j]=prev[j-1]+1;if(row[j]>best){best=row[j];endA=i;endB=j;}}prev=row;}
  ai=Array.from({length:best},(_,i)=>endA-best+i);bi=Array.from({length:best},(_,i)=>endB-best+i);
 }else{
  const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=Math.max(compatible(i,j)?dp[i+1][j+1]+1:0,dp[i+1][j],dp[i][j+1]);
  let i=0,j=0;while(i<n&&j<m){if(compatible(i,j)&&dp[i][j]===dp[i+1][j+1]+1){ai.push(i++);bi.push(j++);}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
 }
 const matchedKeys=ai.map((i,k)=>common(a[i],b[bi[k]]));
 return {ai,bi,keys:matchedKeys,ae:ai.map((i,k)=>a[i].choices?.[matchedKeys[k]]??a[i].index),be:bi.map((i,k)=>b[i].choices?.[matchedKeys[k]]??b[i].index)};
}
function locate(keys,es,mode){
 const pattern=keys.map(key=>({key})),m=longest(pattern,es,mode);return m.ai.length===keys.length?m.bi:null;
}
async function analyze(records,opts={},progress=()=>{},cancel=()=>false){
 const z=records.filter(r=>r.corpus==='zohar'),targets=records.filter(r=>r.corpus!=='zohar');const seq=new Map(records.map(r=>[r.id,sequence(r,opts)])),groups=new Map();let done=0,total=z.length*targets.length;
 for(const r of z){const a=seq.get(r.id);for(const t of targets){const b=seq.get(t.id);if(a.length>1&&b.length>1){const match=longest(a,b,opts.mode);if(match.ai.length>=2){const keys=match.ai.map(i=>a[i].key),signature=(opts.mode==='bag'?[...keys].sort():keys).join('|'),id=r.id+'::'+signature;let g=groups.get(id);if(!g){g={id,zid:r.id,keys,zi:match.ai.map(i=>a[i].index),length:keys.length,tanchuma:[],buber:[]};groups.set(id,g);}}}done++;}progress(Math.round(done/Math.max(1,total)*75));await new Promise(r=>setTimeout(r,0));if(cancel())return null;}
 // Check the complete candidate against both Tanchuma corpora, even when it is not their pairwise maximal result.
 const out=[...groups.values()];for(let k=0;k<out.length;k++){const g=out[k];for(const t of targets){const es=seq.get(t.id),ix=locate(g.keys,es,opts.mode);if(ix)g[t.corpus].push({id:t.id,indices:ix.map(i=>es[i].index)});}if(k%30===0){progress(75+Math.round(k/Math.max(1,out.length)*25));await new Promise(r=>setTimeout(r,0));if(cancel())return null;}}
 out.sort((a,b)=>b.length-a.length||Number(!!b.tanchuma.length&&!!b.buber.length)-Number(!!a.tanchuma.length&&!!a.buber.length)||a.id.localeCompare(b.id));progress(100);return {groups:out,max:Math.max(2,...out.map(g=>g.length)),pairs:total};
}
function fromRaw(x){if(!x||typeof x.location!=='string'||!Array.isArray(x.nodes))throw Error('Unsupported JSON');const corpus=x.location.includes('Zohar')?'zohar':x.location.includes('Buber')?'buber':x.location.includes('Tanchuma')?'tanchuma':null;if(!corpus)throw Error('Unsupported corpus');return {id:'local:'+x.location,corpus,location:x.location,source:'',text:x.gt_text||'',clean:x.gt_clean_text||'',events:x.nodes.filter(n=>n.valid!==false&&String(n.reference).startsWith('Tanakh_')&&Array.isArray(n.pos)).map(n=>({ref:n.reference,pos:n.pos,words:n.tokens||[],kind:n.type||'',class:n.calss||'',rank:n.rank,quote:n.quote||''})),originalSequence:x.citation_seq||[]};}
const api={keys,common,C,BOOKS,SECTIONS,norm,refInfo,prepare:prep,sequence,longest,locate,analyze,fromRaw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VerseCore=api;
})(typeof self!=='undefined'?self:globalThis);
