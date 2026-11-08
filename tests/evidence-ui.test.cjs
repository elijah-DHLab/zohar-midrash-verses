const readData=require('./read-data.cjs');const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');const nodes=new Map(),nav=[],orders=[];let targets=[],scrollCalls=0,anonymous=[];
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
      if(id==='evidenceWorkspace'){const inner=value.match(/<section id="evView">([\s\S]*)<\/section>$/);if(inner)nodes.get('evView').innerHTML=inner[1];}
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
  anonymous=[];
  for(const mm of text.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>|<input\b([^>]*)>/g)){
    const a=attributes(mm[1]||mm[3]||'');if(!Object.keys(a).some(k=>k.startsWith('data-ev-')))continue;
    const n=node(a.id||'',a);for(const [k,v] of Object.entries(a))if(k.startsWith('data-'))n.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;
    if(mm[2]){const os=[...mm[2].matchAll(/<option\b([^>]*)>/g)].map(m=>attributes(m[1]));n.options=os;n.value=(os.find(o=>'selected' in o)||os[0]||{}).value||'';}
    anonymous.push(n);
  }

  for (const m of text.matchAll(/<[\w-]+\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const a = attributes(m[1]); if (a.id && !nodes.has(a.id)) nodes.set(a.id, node(a.id, a));
  }
}
absorb(html);

const listeners={},winListeners={};
const document={body:node('body'),documentElement:node('html'),baseURI:'https://example.test/project/',createElement:()=>node('new'),addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:s=>nodes.get(s.slice(1))||null,querySelectorAll:s=>s==='[data-ev-witness]'?anonymous.filter(n=>n.dataset.evWitness):s==='[data-ev-verified]'?anonymous.filter(n=>n.dataset.evVerified):s==='.page'?[...nodes.values()].filter(x=>x.id.startsWith('page-')):s==='[data-order]'?orders:[]};
for(const m of html.matchAll(/<(?:button|input)\b([^>]*)>/g)){const a=attributes(m[1]);if(a['data-order']){const n=nodes.get(a.id);n.dataset.order=a['data-order'];orders.push(n);}}
const requests=[],errors=[],nativeFetch=global.fetch;
async function localFetch(input){const u=new URL(input,document.baseURI),rel=u.pathname.replace(/^\/project\//,''),file=path.join(root,rel);requests.push(rel);if(!fs.existsSync(file)){errors.push('404 '+rel);return new Response('missing',{status:404});}return new Response(fs.readFileSync(file));}
class Worker{constructor(src){this.owner=this;const owner=this,base=new URL(src,document.baseURI);this.ctx=vm.createContext({URL,setTimeout,clearTimeout,console,Blob,Response,DecompressionStream,TextDecoder,fetch:localFetch,postMessage(data){if(!owner.stopped)queueMicrotask(()=>owner.onmessage?.({data}));}});this.ctx.importScripts=(...xs)=>xs.forEach(p=>vm.runInContext(fs.readFileSync(path.join(root,new URL(p,base).pathname.replace(/^\/project\//,'')),'utf8'),this.ctx));vm.runInContext(fs.readFileSync(path.join(root,base.pathname.replace(/^\/project\//,'')),'utf8'),this.ctx);}postMessage(data){this.ctx.onmessage({data});}terminate(){this.stopped=true;}}
const stored=new Map(),ctx=vm.createContext({document,URL,Blob,Response,DecompressionStream,TextDecoder,console,Worker,fetch:localFetch,setTimeout,clearTimeout,Event:class{constructor(type){this.type=type;}},requestAnimationFrame:f=>f(),history:{replaceState(a,b,hash){ctx.location.hash=hash;}},location:{protocol:'https:',hash:''},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)}});ctx.window=ctx;ctx.addEventListener=(t,f)=>(winListeners[t]||=[]).push(f);ctx.dispatchEvent=e=>(winListeners[e.type]||[]).forEach(f=>f(e));
const wait=async f=>{for(let i=0;i<500;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+nodes.get('toast')?.textContent+' '+nodes.get('loadError')?.textContent);};
(async()=>{
 for(const m of html.matchAll(/<script defer src="([^"]+)"/g))vm.runInContext(fs.readFileSync(root+'/'+m[1].split('?')[0],'utf8'),ctx,{filename:m[1]});
 await wait(()=>nodes.get('bootState').textContent==='· נטען'&&!nodes.get('run').disabled&&vm.runInContext('activeResult!==null',ctx));
 await vm.runInContext('ResearchUI.open()',ctx);
 function click(attrs){const b={dataset:attrs,hasAttribute:k=>k in attrs};for(const f of listeners.click||[])f({target:{closest:s=>s==='button,[data-rpoint]'&&attrs.rview?b:s.startsWith('[data-ev-preset]')?b:null}});}
 click({rview:'evidence'});await wait(()=>vm.runInContext('EvidenceUI.report()!==null',ctx));
 assert.equal(vm.runInContext('EvidenceUI.report().scope.selectedZohar',ctx),3093);
 for(const tab of ['findings','map','funnel','candidates','witness','bridges','stability']){ctx.tab=tab;vm.runInContext('EvidenceUI.setTab(tab)',ctx);assert(nodes.get('evView').innerHTML.length>100,tab);assert(!/NaN|undefined|Infinity/.test(nodes.get('evView').innerHTML),tab);}
 vm.runInContext("EvidenceUI.setTab('witness')",ctx);
 const selects=anonymous.filter(n=>n.dataset.evWitness),zid=selects[0]?.dataset.evWitness;assert(zid,'Witness suggestions exist');
 const pair=selects.filter(n=>n.dataset.evWitness===zid),check=anonymous.find(n=>n.dataset.evVerified===zid);assert.equal(pair.length,2);check.checked=true;for(const f of listeners.change||[])f({target:check});assert([...stored.keys()].includes('verse-witness-checks-v1'));
 const originalPair=pair.map(n=>n.value);if(pair[0].options.length>1){pair[0].value=pair[0].options[1].value;for(const f of listeners.change||[])f({target:pair[0]});assert.equal(check.checked,false,'Changing the witness pair clears verification');}
 const wanted=pair.map(n=>vm.runInContext('EvidenceUI.report()',ctx).rows[+n.value]);click({evTriplet:zid});await wait(()=>vm.runInContext('activeResult?.zid',ctx)===zid&&wanted.every(r=>vm.runInContext('loadedColumns',ctx).some(c=>c.id===r.tid)));const loaded=vm.runInContext('loadedColumns',ctx);assert(wanted.every(r=>loaded.some(c=>c.id===r.tid)),'Both selected witnesses open exactly');assert.equal(nodes.get('mode').value,'gapped','Experiment filters copied to search controls');
 await vm.runInContext('ResearchUI.open()',ctx);
 const baseline=vm.runInContext('EvidenceUI.report()',ctx);const p=baseline.rows.find(r=>r.target==='midrash-tanchuma'&&r.sharedEdges.length);assert(p);ctx.p=p;
 // Native inputs configure a fresh independent worker, using a single base unit and two books.
 nodes.get('evScope').value='unit';for(const f of listeners.change||[])f({target:nodes.get('evScope')});
 nodes.get('evPerms').value='19';for(const f of listeners.change||[])f({target:nodes.get('evPerms')});
 vm.runInContext("lastQuery={...lastQuery,unit:p.zid,units:[p.zid],targets:['midrash-tanchuma','midrash-tanchuma-buber'],min:3,options:{mode:'gapped',collapse:true}}",ctx);
 // Keep the displayed unit selection explicit, as the interface does.
 vm.runInContext('EvidenceUI.run()',ctx);await wait(()=>vm.runInContext('EvidenceUI.report()!==null&&EvidenceUI.report().query.permutations===19&&EvidenceUI.report().scope.selectedZohar===1',ctx));
 assert(!nodes.get('evView').innerHTML.includes('NaN'));assert.equal(errors.length,0,errors.join('\n'));
 for(const tab of ['findings','map','funnel','candidates','witness','bridges','stability']){ctx.tab=tab;vm.runInContext('EvidenceUI.setTab(tab)',ctx);assert(nodes.get('evView').innerHTML.length>80,tab);}
 vm.runInContext("EvidenceUI.setTab('map')",ctx);const rr=vm.runInContext('EvidenceUI.report().rows[0]',ctx);if(rr){click({evOpen:'0'});await wait(()=>vm.runInContext('activeResult?.zid',ctx)===rr.zid);assert(vm.runInContext('loadedColumns.length',ctx)<=3);}
 vm.runInContext('EvidenceUI.run();EvidenceUI.stop()',ctx);assert(nodes.get('evidenceWorkspace').innerHTML.includes('הופסק'));
 console.log(JSON.stringify({status:'passed',realEvidenceWorker:true,compressedPreset:true,views:7,witnessSelectionAndVerification:true,runAndStop:true,labToReading:true,requests:requests.length}));vm.runInContext('cancel()',ctx);
})().catch(e=>{console.error(e);process.exitCode=1;});
