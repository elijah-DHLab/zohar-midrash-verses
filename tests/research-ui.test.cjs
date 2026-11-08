const readData=require('./read-data.cjs');const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');const nodes=new Map(),nav=[],orders=[];let targets=[],scrollCalls=0;
function classes(value = '') {
  const set = new Set(value.split(/\s+/));
  return {contains: x => set.has(x), add: x => set.add(x), remove: x => set.delete(x),
    toggle(x, on) { if (on === undefined) on = !set.has(x); on ? set.add(x) : set.delete(x); }};
}
function node(id, attrs = {}) {
  let content = '';
  return {id, value: attrs.value || '', checked: 'checked' in attrs, hidden: 'hidden' in attrs,
    disabled: false, dataset: {}, classList: classes(attrs.class), style: {setProperty() {}},
    textContent: '', scrollTop: 0, max: attrs.max || '',
    setAttribute(k, v) { this[k] = v; }, getBoundingClientRect() { return {top: 0}; },
    scrollIntoView() {}, addEventListener(){}, append(el){nodes.set(el.id,el);}, hasAttribute(k){return k in this;},
    querySelector(selector) { return selector.startsWith('[data-token=') ? node('token') : null; },
    matches(){return false;}, get innerHTML() { return content; },
    set innerHTML(value) {
      content = value;
      absorb(value);
      if (id === 'targets') targets = [...value.matchAll(/<input\b([^>]+)>/g)].map(m => {
        const a = attributes(m[1]), el = nodes.get(a.id)||node('', a); el.dataset.target = a['data-target']; return el;
      });
      if (id === 'section' || id === 'unit' || id === 'vizTarget')
        this.value = value.match(/<option value="([^"]*)"/)?.[1] || '';
    }
  };
}
function attributes(text) {
  const a = {};
  for (const m of text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] || '';
  return a;
}
function absorb(text) {
  for (const m of text.matchAll(/<[\w-]+\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const a = attributes(m[1]); if (a.id && !nodes.has(a.id)) nodes.set(a.id, node(a.id, a));
  }
}
absorb(html);
const listeners={},windowListeners={};
const document={body:node('body'),documentElement:node('html'),baseURI:'http://localhost/project/',createElement:()=>node('new'),addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:s=>nodes.get(s.slice(1))||null,querySelectorAll:s=>s==='.page'?[...nodes.values()].filter(x=>x.id.startsWith('page-')):[]};
const stored=new Map();const ctx=vm.createContext({VerseEvidence:require(root+'/assets/release-6.3/evidence-core.js'),document,console,URL,setTimeout,clearTimeout,Event:class{constructor(t){this.type=t}},requestAnimationFrame:f=>f(),history:{replaceState(){}},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},fetch:async p=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(root+'/data/'+String(p).replace(/^data\//,'').split('?')[0]))})});
ctx.window=ctx;ctx.addEventListener=(t,f)=>(windowListeners[t]||=[]).push(f);ctx.dispatchEvent=e=>(windowListeners[e.type]||[]).forEach(f=>f(e));
for(const f of ['sequence-core','search-core','evidence-core','selection','guidance'])vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/'+f+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/app.js','utf8').split("document.addEventListener('click'")[0],ctx);
vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/sources.js','utf8'),ctx);
for(const f of ['research-core','research'])vm.runInContext(fs.readFileSync(root+'/assets/release-6.3/'+f+'.js','utf8'),ctx);
ctx.DataFiles={read:async p=>readData(p)};const data=readData;const m=data('manifest.json'),v=data(m.verses),base=data(m.books.find(x=>x.id==='zohar').index);Object.assign(ctx,{m,v,base});vm.runInContext('manifest=m;verses=v;baseIndex=base;SourceUI.init();renderTrains=()=>ResearchUI.trains();',ctx);
function click(attrs){const b={dataset:{},hasAttribute:k=>k in attrs,...attrs};for(const f of listeners.click||[])f({target:{closest:s=>s==='button,[data-rpoint]'?b:null}});}
(async()=>{
 const engine=new ctx.VerseSearch.Engine(m,data);let q={base:'zohar',targets:['midrash-tanchuma','midrash-tanchuma-buber'],unit:base.units[0].id,min:2,options:{mode:'bag',collapse:true},limit:200};const found=await engine.query(q);assert(found.results.length);assert.equal(vm.runInContext('SourceUI.chosen().length',ctx),2);const r=found.results[0];ctx.q=q;ctx.r=r;ctx.fixtureStats=found.stats;
 nodes.get('mode').value='bag';nodes.get('contextRange').value='0';nodes.get('trainAll').checked=false;
 vm.runInContext('lastQuery=q;stats=fixtureStats;activeResult=r;bookColumns=q.targets;matches=q.targets.map(book=>({book,units:[]}));',ctx);
 for(const bid of q.targets){const row=found.results.find(x=>x.target===bid&&x.zid===r.zid);if(row){ctx.row=row;vm.runInContext("matches.find(x=>x.book===row.target).units.push({id:row.tid,label:row.tlabel,shard:row.tshard,indices:row.ti,baseIndices:row.zi});",ctx);}}
 await vm.runInContext('renderComparison(++selectionId,false)',ctx);assert(nodes.get('rCompareEntry').innerHTML.includes('data-researchopen'));
 const cleanTrain=nodes.get('trains').innerHTML,cleanText=nodes.get('readings').innerHTML,originalQuery=vm.runInContext('JSON.stringify(lastQuery)',ctx);assert(!cleanTrain.includes('r-rail-link'),'Clean train is the default');click({'data-rtraintoggle':'',dataset:{}});assert(nodes.get('trains').innerHTML.includes('r-rail'),'Grouped train is available');assert.equal(nodes.get('readings').innerHTML,cleanText,'View toggle does not alter text');assert.equal(vm.runInContext('JSON.stringify(lastQuery)',ctx),originalQuery);click({'data-rtraintoggle':'',dataset:{}});assert.equal(nodes.get('trains').innerHTML,cleanTrain,'Toggle restores the exact previous train');
 await vm.runInContext('ResearchUI.open()',ctx);assert(nodes.get('rView').innerHTML.includes('מה מחזיק'));
 for(const k of ['collapse','group','opening','onlyTransitions']){const t=nodes.get('r-'+k);t.checked=!t.checked;for(const f of listeners.change||[])f({target:t});assert(nodes.get('rView').innerHTML.includes('מה מחזיק'));}
 for(const name of ['overview','routes','bridges','roles','witnesses','cases']){click({dataset:{rview:name}});assert(nodes.get('rView').innerHTML.length>100,name);assert(!/NaN|undefined/.test(nodes.get('rView').innerHTML),name);}
 click({dataset:{rview:'roles'}});const cols=vm.runInContext('loadedColumns',ctx);const noteId=cols[0].id+':'+cols[0].indices[0];for(const f of listeners.change||[])f({target:{id:'',dataset:{rnote:noteId,rfield:'claim'},value:'טענה פרשנית'}});assert(nodes.get('rRoleGraph').innerHTML.includes('טענה פרשנית'));click({dataset:{rview:'cases'}});
 nodes.get('rCaseTitle').value='מקרה בדיקה';nodes.get('rCaseClaim').value='טענה שמורה';click({'data-rcasesave':'',dataset:{}});assert(stored.size===1);const saved=JSON.parse([...stored.values()][0]);assert.equal(saved[0].claim,'טענה שמורה');assert.equal(saved[0].notes[noteId].claim,'טענה פרשנית');assert.equal(saved[0].columns.length,vm.runInContext('loadedColumns.length',ctx));
 click({dataset:{rview:'routes'}});click({dataset:{rview:'cases'}});assert(nodes.get('rView').innerHTML.includes('טענה שמורה'),'Draft survives view changes');
 click({dataset:{rcaseopen:saved[0].id}});await new Promise(r=>setTimeout(r,50));assert(nodes.get('rView').innerHTML.includes('טענה שמורה'));assert.equal(vm.runInContext('lastQuery.unit',ctx),saved[0].columns[0].id);assert(!nodes.get('toast').textContent.includes('אינו תואם'));
 click({dataset:{rview:'corpus'}});for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if(nodes.get('rView').innerHTML.includes('הופעות פסוקי ההשוואה'))break;}assert(nodes.get('rView').innerHTML.includes('הופעות פסוקי ההשוואה'));assert(!/undefined|NaN/.test(nodes.get('rView').innerHTML));
 vm.runInContext("SourceUI.set(manifest.books.filter(b=>b.id!=='zohar').map(b=>b.id))",ctx);assert.equal(vm.runInContext('selectedTargets().length',ctx),9);assert(vm.runInContext("SourceUI.displayTargets(selectedTargets(),'yalkut-shimoni-on-torah').length",ctx)<=2);
 console.log(JSON.stringify({status:'passed',views:8,realCorpus:true,casePersistence:true,comparison:vm.runInContext('loadedColumns.length',ctx)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
