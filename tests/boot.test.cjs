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

const listeners={},winListeners={};
const document={body:node('body'),documentElement:node('html'),baseURI:'https://example.test/project/',createElement:()=>node('new'),addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:s=>nodes.get(s.slice(1))||null,querySelectorAll:s=>s==='.page'?[...nodes.values()].filter(x=>x.id.startsWith('page-')):s==='[data-order]'?orders:[]};
for(const m of html.matchAll(/<(?:button|input)\b([^>]*)>/g)){const a=attributes(m[1]);if(a['data-order']){const n=nodes.get(a.id);n.dataset.order=a['data-order'];orders.push(n);}}
const requests=[],errors=[],nativeFetch=global.fetch;
async function localFetch(input){const u=new URL(input,document.baseURI),rel=u.pathname.replace(/^\/project\//,''),file=path.join(root,rel);requests.push(rel);if(!fs.existsSync(file)){errors.push('404 '+rel);return new Response('missing',{status:404});}return new Response(fs.readFileSync(file));}
class Worker{constructor(src){this.owner=this;const owner=this,base=new URL(src,document.baseURI);this.ctx=vm.createContext({URL,setTimeout,clearTimeout,console,Blob,Response,DecompressionStream,TextDecoder,fetch:localFetch,postMessage(data){if(!owner.stopped)queueMicrotask(()=>owner.onmessage?.({data}));}});this.ctx.importScripts=(...xs)=>xs.forEach(p=>vm.runInContext(fs.readFileSync(path.join(root,new URL(p,base).pathname.replace(/^\/project\//,'')),'utf8'),this.ctx));vm.runInContext(fs.readFileSync(path.join(root,base.pathname.replace(/^\/project\//,'')),'utf8'),this.ctx);}postMessage(data){this.ctx.onmessage({data});}terminate(){this.stopped=true;}}
const stored=new Map(),ctx=vm.createContext({document,URL,Blob,Response,DecompressionStream,TextDecoder,console,Worker,fetch:localFetch,setTimeout,clearTimeout,Event:class{constructor(type){this.type=type;}},requestAnimationFrame:f=>f(),history:{replaceState(a,b,hash){ctx.location.hash=hash;}},location:{protocol:'https:',hash:''},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)}});ctx.window=ctx;ctx.addEventListener=(t,f)=>(winListeners[t]||=[]).push(f);ctx.dispatchEvent=e=>(winListeners[e.type]||[]).forEach(f=>f(e));
const wait=async f=>{for(let i=0;i<500;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+nodes.get('toast')?.textContent+' '+nodes.get('loadError')?.textContent);};
(async()=>{
 for(const m of html.matchAll(/<script defer src="([^"]+)"/g))vm.runInContext(fs.readFileSync(root+'/'+m[1].split('?')[0],'utf8'),ctx,{filename:m[1]});
 await wait(()=>nodes.get('bootState').textContent==='· נטען'&&!nodes.get('run').disabled&&vm.runInContext('activeResult!==null',ctx));
 assert.equal(vm.runInContext('loadedColumns.length',ctx),3);assert.equal(vm.runInContext('lastQuery.base',ctx),'zohar');assert.equal(vm.runInContext('selectedTargets().length',ctx),2);assert(!nodes.get('trainAll').checked);assert(nodes.get('collapse').checked,'Consecutive repeated quotations count once by default');assert.equal(nodes.get('mode').value,'bag');
 const initialRequests=requests.slice();assert(initialRequests.every(p=>!['bereishit-rabbah','yalkut-shimoni-on-torah','devarim-rabbah'].some(id=>p.includes(id))),'Unselected corpora are not fetched at startup');
 nodes.get('sourceSummary').onclick();assert(!nodes.get('sourcePanel').hidden);nodes.get('sourceAll').onclick();nodes.get('sourceApply').onclick();
 await wait(()=>vm.runInContext('lastQuery?.targets.length===9&&activeResult!==null',ctx)&&!nodes.get('run').disabled);
 assert(vm.runInContext('loadedColumns.length',ctx)<=3);assert.equal(vm.runInContext('stats.selectedUnits',ctx),3093);assert.equal(Object.keys(vm.runInContext('stats.byTarget',ctx)).length,9);
 for(const id of vm.runInContext('selectedTargets()',ctx)){assert(vm.runInContext('results',ctx).some(r=>r.target===id),'Reserved results '+id);}
 nodes.get('browseBook').value='bereishit-rabbah';await vm.runInContext('loadBrowse()',ctx);nodes.get('browseWord').value='אמר';await vm.runInContext('lookupBrowseWords()',ctx);assert(vm.runInContext('browseTextMatches.size>0',ctx));const foundUnit=vm.runInContext('browseUnits()[0].id',ctx);ctx.foundUnit=foundUnit;await vm.runInContext('openBrowse(foundUnit)',ctx);assert(nodes.get('browseReader').innerHTML.includes('hit-word'),'Word matches visible in the source text');
 const oldQuery=vm.runInContext('JSON.stringify(lastQuery)',ctx);nodes.get('orderYes').checked=true;nodes.get('orderYes').onchange();await wait(()=>vm.runInContext('lastQuery?.options.mode==="gapped"&&activeResult!==null',ctx)&&!nodes.get('run').disabled);
 nodes.get('trainAll').checked=true;await nodes.get('trainAll').onchange();assert(nodes.get('trains').innerHTML.includes('wagon'));nodes.get('trainAll').checked=false;await nodes.get('trainAll').onchange();
 const cols=vm.runInContext('loadedColumns.length',ctx);assert(cols<=3);await vm.runInContext("switchReadingBook(0,'yalkut-shimoni-on-torah')",ctx);assert(vm.runInContext("loadedColumns.some(c=>c.book==='yalkut-shimoni-on-torah')",ctx)||nodes.get('readings').innerHTML.includes('לא נמצאה'));
 await vm.runInContext('ResearchUI.open()',ctx);assert(nodes.get('rView').innerHTML.includes('מה מחזיק'));const preCorpus=requests.length;
 const allTags=[...new Set(requests.filter(x=>x.startsWith('data/texts/')).map(x=>x.split('/')[2]))];assert(allTags.length<=10);
 nodes.get('sourceSummary').onclick();nodes.get('sourceNone').onclick();nodes.get('sourceApply').onclick();assert.equal(vm.runInContext('selectedTargets().length',ctx),0);
 nodes.get('sourceSummary').onclick();nodes.get('sourceDefault').onclick();nodes.get('sourceApply').onclick();await wait(()=>vm.runInContext('lastQuery?.targets.length===2&&activeResult!==null',ctx)&&!nodes.get('run').disabled);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'passed',defaultTargets:2,allTargets:9,maxReadingColumns:3,actualDecompression:true,actualWorkerScript:true,browseWords:true,orderControl:true,allVersesControl:true,defaultInitialDataBytes:initialRequests.reduce((n,p)=>n+fs.statSync(root+'/'+p).size,0),requests:requests.length}));
 vm.runInContext('cancel()',ctx);
})().catch(e=>{console.error(e);process.exitCode=1;});
