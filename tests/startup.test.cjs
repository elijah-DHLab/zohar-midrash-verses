// Exercise the deployed HTML and real worker code through an HTTP server at /project/.
// Relative URLs use browser URL semantics. The DOM adapter does not verify visual layout.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path'), http = require('http'), root = path.join(__dirname, '..');
const nativeFetch=globalThis.fetch,requests=[];
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname;const file=path.join(root,pathname.replace(/^\/project\//,''));const exists=fs.existsSync(file)&&fs.statSync(file).isFile();requests.push({pathname,ok:exists});if(!exists){res.writeHead(404);res.end('not found');return;}res.end(fs.readFileSync(file));});
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const nodes = new Map(), nav = [], orders = [];
let targets = [], scrollCalls = 0;
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
    scrollIntoView() { scrollCalls++; },
    querySelector(selector) { return selector.startsWith('[data-token=') ? node('token') : null; },
    get innerHTML() { return content; },
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
for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
  const a = attributes(m[1]); if (a.id) nodes.get(a.id).value = m[2].match(/value="([^"]*)"/)?.[1] || '';
}
for (const m of html.matchAll(/<(?:button|input)\b([^>]*)>/g)) {
  const a = attributes(m[1]), el = nodes.get(a.id)||node('', a);
  if (a['data-page'] && a.class?.includes('nav')) { el.dataset.page = a['data-page']; nav.push(el); }
  if (a['data-order']) { el.dataset.order = a['data-order']; orders.push(el); }
}
const body = node('body');
const listeners={};const document = {body, documentElement: node('html'), addEventListener(type,fn) {(listeners[type] ||= []).push(fn);},
  querySelector(s) { return nodes.get(s.slice(1)) || null; },
  querySelectorAll(s) {
    if (s === '.page') return [...nodes.values()].filter(n => n.id.startsWith('page-'));
    if (s === '.nav') return nav;
    if (s === '[data-target]') return targets;
    if (s === '[data-target]:checked') return targets.filter(t => t.checked);
    if (s === '[data-order]') return orders;
    return [];
  }
};
const delays={},failures={};
const fetchAt = async (input,base) => {const url=new URL(input,base),file=url.pathname.split('/data/')[1];if(delays[file])await new Promise(r=>setTimeout(r,delays[file]));if(failures[file]){failures[file]--;throw Error('Simulated network interruption');}return nativeFetch(url);};
const fetch = input=>fetchAt(input,document.baseURI);
class Worker {
  constructor(src) {
    const owner = this,workerURL=new URL(src,document.baseURI);
    this.context = vm.createContext({URL,fetch:input=>fetchAt(input,workerURL), setTimeout, console,
      postMessage(data) { if (!owner.stopped) queueMicrotask(() => owner.onmessage?.({data})); }});
    this.context.importScripts = (...files) => files.forEach(f => vm.runInContext(
      fs.readFileSync(path.join(root,new URL(f,workerURL).pathname.replace(/^\/project\//,'')), 'utf8'), this.context));
    vm.runInContext(fs.readFileSync(path.join(root,workerURL.pathname.replace(/^\/project\//,'')), 'utf8'), this.context);
  }
  postMessage(data) { this.context.onmessage({data}); }
  terminate() { this.stopped = true; }
}
const location = {protocol: 'http:', hash: ''};
const ctx = vm.createContext({URL,document, fetch, Worker, location, console, setTimeout, clearTimeout,
  requestAnimationFrame: f => f(), window: {matchMedia: () => ({matches: false})},
  history: {replaceState(_, __, hash) { location.hash = hash; }}});
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  document.baseURI=`http://127.0.0.1:${server.address().port}/project/`;
  for (const m of html.matchAll(/<script defer src="([^"]+)"/g)) vm.runInContext(
    await (await fetch(m[1])).text(), ctx);
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 10));
    if (nodes.get('readings').innerHTML && !nodes.get('run').disabled) break;
  }
  assert.equal(vm.runInContext('lastQuery.units.length',ctx),3093);
  assert.equal(nodes.get('mode').value,'bag');assert(!nodes.get('trainAll').checked);assert(!nodes.get('collapse').checked);
  nodes.get('sectionSummary').onclick();assert(!nodes.get('sectionPanel').hidden);nodes.get('unitSummary').onclick();assert(nodes.get('sectionPanel').hidden);assert(!nodes.get('unitPanel').hidden);nodes.get('unitClose').onclick();assert(nodes.get('unitPanel').hidden);
  vm.runInContext('fillUnits(baseIndex.units[0].id)',ctx);nodes.get('mode').value='gapped';nodes.get('collapse').checked=true;nodes.get('trainAll').checked=false;await vm.runInContext('run(null,{reveal:false})',ctx);
  // In a real DOM, every control has body[data-page] as an ancestor.
  // Navigation must not cancel native radio or checkbox default actions.
  let cancelledNativeClicks=0;
  for(const id of ['orderYes','orderNo','trainAll']){
    const target=nodes.get(id);target.closest=selector=>selector==='[data-page]'?body:null;
    for(const handler of listeners.click||[])handler({target,preventDefault(){cancelledNativeClicks++;},stopPropagation(){}});
  }
  assert.equal(cancelledNativeClicks,0,'body[data-page] must never intercept native control clicks');
  assert.equal(location.hash, '#search');
  assert(nodes.get('page-search').classList.contains('active'));
  assert(nodes.get('readings').innerHTML.includes('event-badge'), nodes.get('loadError').textContent || nodes.get('toast').textContent);
  assert.equal(vm.runInContext('readingMode', ctx), 'full');
  assert(vm.runInContext('loadedColumns.length', ctx) >= 2);
  assert.equal(nodes.get('trainAll').checked,false);assert.equal(vm.runInContext('lastQuery.targets.length',ctx),2);assert.equal(vm.runInContext('loadedColumns.length',ctx),3);
  const initialColumns=vm.runInContext('loadedColumns',ctx),initialColors=vm.runInContext('eventPalette',ctx);for(const col of initialColumns.slice(1)){const bi=col.baseIndices||initialColumns[0].indices;col.indices.forEach((e,i)=>assert.equal(initialColors.get(col.id+':'+e).n,initialColors.get(initialColumns[0].id+':'+bi[i]).n));}
  assert.equal(scrollCalls, 0, 'Initial loading must keep search controls on screen');
  assert.equal(nodes.get('mode').value, 'gapped');
  assert.equal(orders[0]['aria-checked'], 'true');
  assert.equal((html.match(/<nav\b/g) || []).length, 1);
  assert(!html.includes('page-atlas'));
  assert(!html.includes('class="viz-tabs"'));
  assert.equal(vm.runInContext('analyticsData', ctx), null, 'Analytics must load only on demand');
  const waitForComparison=async()=>{for(let t=0;t<300;t++){await new Promise(r=>setTimeout(r,10));if(vm.runInContext('lastQuery!==null&&activeResult!==null',ctx)&&!nodes.get('run').disabled)return;}throw Error('Automatic comparison did not open');};
  vm.runInContext("setOrderMode('unordered')", ctx);
  assert.equal(orders[1]['aria-checked'], 'true');assert(nodes.get('orderNo').checked);
  await waitForComparison();
  assert.equal(vm.runInContext('lastQuery.options.mode', ctx), 'bag');
  assert(nodes.get('readings').innerHTML.includes('event-badge'));
  
  assert(vm.runInContext('lastQuery.unit.length>0 && stats.baseUnits===1',ctx),'A search must always use exactly one base unit');
  const original=vm.runInContext('currentUnit().id',ctx);
  // Regression: browsing used to read nonexistent u.seq from catalog entries.
  await vm.runInContext('loadBrowse()',ctx);assert(nodes.get('browseList').innerHTML.includes('data-open-unit'));
  ctx.original=original;await vm.runInContext("browseTo('zohar',original)",ctx);assert(nodes.get('browseReader').innerHTML.includes('data-token'));
  const clickPage=(page)=>{const button=nav.find(n=>n.dataset.page===page);assert(button.onclick);button.onclick({preventDefault(){},stopPropagation(){}});};
  clickPage('analytics');await vm.runInContext('loadAnalytics()',ctx);assert(nodes.get('page-analytics').classList.contains('active'));assert(nodes.get('vizPlot').innerHTML.includes('data-viz-hit'));
  nodes.get('chartSelect').value='3';nodes.get('chartSelect').onchange();assert.equal(vm.runInContext('vizActive',ctx),3);
  clickPage('search');nodes.get('trainAll').checked=true;await nodes.get('trainAll').onchange();const all=(nodes.get('trains').innerHTML.match(/class="wagon /g)||[]).length;
  nodes.get('trainAll').checked=false;await nodes.get('trainAll').onchange();const matched=(nodes.get('trains').innerHTML.match(/class="wagon /g)||[]).length;assert(all>matched);assert.equal((nodes.get('readings').innerHTML.match(/class="event-badge"/g)||[]).length,matched);assert.equal(matched,vm.runInContext('[...eventPalette.values()].filter(c=>c.matched).length',ctx));
  nodes.get('contextRange').value='1';await vm.runInContext('renderContext()',ctx);assert(nodes.get('contextRail').innerHTML.includes('json-neighbor'));assert.equal(vm.runInContext('lastQuery.unit',ctx),original);nodes.get('contextRange').value='0';await vm.runInContext('renderContext()',ctx);assert.equal(nodes.get('contextRail').innerHTML,'');
  nodes.get('comparisonBook').value='midrash-tanchuma-buber';await nodes.get('comparisonBook').onchange();await vm.runInContext('run(null,{reveal:false})',ctx);assert.equal(vm.runInContext('lastQuery.targets.join()',ctx),'midrash-tanchuma-buber');assert.equal(vm.runInContext('loadedColumns[1].book',ctx),'midrash-tanchuma-buber');nodes.get('comparisonBook').value='midrash-tanchuma';await vm.runInContext('run(null,{reveal:false})',ctx);
  const labPacket=await vm.runInContext("request('lab',{query:{base:'zohar',targets:['midrash-tanchuma','midrash-tanchuma-buber'],unit:currentUnit().id,min:2,options:options(),cohort:true}})",ctx);assert(labPacket.result.pairs.length);assert.equal(labPacket.result.groups.length,3);
  clickPage('lab');for(let t=0;t<200;t++){await new Promise(r=>setTimeout(r,5));if(vm.runInContext('labData!==null',ctx)&&!nodes.get('labRun').disabled)break;}assert(nodes.get('page-lab').classList.contains('active'));assert(nodes.get('labPlot').innerHTML.includes('data-lab-hit'));assert.equal((nodes.get('labQuestions').innerHTML.match(/data-lab-view=/g)||[]).length,10);ctx.labRow=vm.runInContext('labPair(labData.pairs[0])',ctx);await vm.runInContext('openLabEvidence(labRow)',ctx);assert.equal(vm.runInContext('activeResult.tid',ctx),ctx.labRow.u.id);assert(nodes.get('readings').innerHTML.includes('event-badge'));
  // Lookup selects one unit rather than silently comparing an entire book.
  nodes.get('query').value=vm.runInContext('currentUnit().label',ctx);nodes.get('scope').value='unit';
  await vm.runInContext('lookupUnits()',ctx);assert(nodes.get('lookupStatus').textContent.includes('נבחרו'));assert(nodes.get('unit').value);
  nodes.get('query').value='אמר';nodes.get('scope').value='word';await vm.runInContext('lookupUnits()',ctx);assert(nodes.get('lookupStatus').textContent.includes('נבחרו'));
  vm.runInContext('clearUnitLookup()',ctx);assert(nodes.get('unit').value);

  vm.runInContext('fillUnits(original)',ctx);
  // Each column and wagon uses exactly the same occurrence color; choosing a different target updates the base union.
  nodes.get('comparisonBook').value='both';await nodes.get('comparisonBook').onchange();
  assert.equal(vm.runInContext('loadedColumns.length',ctx),3);
  const sources=vm.runInContext('matches',ctx),alternative=sources.find(m=>m.units.length>1);
  assert(alternative);ctx.changeSource={bid:alternative.book,id:alternative.units.at(-1).id};
  await vm.runInContext('sourceColumns[changeSource.bid]=changeSource.id;renderComparison(++selectionId)',ctx);
  assert(vm.runInContext('loadedColumns.some(c=>c.id===changeSource.id)',ctx));
  const actual=vm.runInContext('loadedColumns',ctx),colors=vm.runInContext('eventPalette',ctx),base=actual[0];
  const union=new Set(actual.slice(1).flatMap(c=>c.baseIndices||base.indices));
  for(const e of base.r.events)assert.equal(colors.get(base.id+':'+e.index).matched,union.has(e.index));
  for(const c of actual.slice(1))c.indices.forEach((event,i)=>{const b=(c.baseIndices||base.indices)[i];assert.equal(c.r.events[event].v,base.r.events[b].v);assert.deepEqual(colors.get(c.id+':'+event),colors.get(base.id+':'+b));});
  const next=vm.runInContext('baseIndex.units.find(u=>u.id!==currentUnit().id&&u.sequenceLength>10)',ctx);
  nodes.get('unit').value=next.id;nodes.get('unit').onchange();await waitForComparison();
  assert.equal(vm.runInContext('lastQuery.unit',ctx),next.id);assert.equal(vm.runInContext('loadedColumns[0].id',ctx),next.id);
  assert.equal(vm.runInContext('readingMode',ctx),'full');assert(nodes.get('readings').innerHTML.includes('event-badge'));
  assert.equal(vm.runInContext('stats.baseUnits',ctx),1);
  nodes.get('unit').value=original;nodes.get('unit').onchange();await waitForComparison();
  // Download/restore the real query payload without exercising the browser download API.
  await vm.runInContext('run(null,{reveal:false})',ctx);
  vm.runInContext('download=(text,type,name)=>{globalThis.saved={text,type,name};};save();',ctx);
  assert(ctx.saved);const saved=JSON.parse(ctx.saved.text);assert(saved.query.unit);assert.equal(saved.query.query,'');
  ctx.restoreFixture={text:async()=>ctx.saved.text};await vm.runInContext('restore(restoreFixture)',ctx);assert.equal(vm.runInContext('lastQuery.unit',ctx),saved.query.unit);
  const result=vm.runInContext('activeResult',ctx);assert(result);
  // Test actual click listeners for order mode and text/excerpt switch.
  const click=(selector,el)=>{for(const fn of listeners.click||[])fn({preventDefault(){},target:{closest:s=>s===selector?el:null}});};
  click('[data-tool]',{dataset:{tool:'readingMode'}});await new Promise(r=>setTimeout(r,10));assert.equal(vm.runInContext('readingMode',ctx),'matches');
  click('[data-tool]',{dataset:{tool:'readingMode'}});await new Promise(r=>setTimeout(r,10));assert.equal(vm.runInContext('readingMode',ctx),'full');
  nodes.get('orderYes').checked=true;nodes.get('orderYes').onchange();assert.equal(nodes.get('mode').value,'gapped');
  await vm.runInContext('findLongest()',ctx);assert.equal(vm.runInContext('lastQuery.min',ctx),vm.runInContext('stats.max',ctx));assert(vm.runInContext('results.every(r=>r.length===lastQuery.min)',ctx));
  nodes.get('lengthN').value=vm.runInContext('stats.max+1',ctx);await vm.runInContext('run(null,{reveal:false})',ctx);assert.equal(vm.runInContext('stats.matches',ctx),0);assert.equal(vm.runInContext('loadedColumns.length',ctx),1);assert(nodes.get('readings').innerHTML.includes('data-token'));assert.equal(vm.runInContext('activeResult',ctx),null);nodes.get('lengthN').value=2;
  nodes.get('consecutive').checked=true;nodes.get('consecutive').onchange();assert.equal(nodes.get('mode').value,'contiguous');await vm.runInContext('run(null,{reveal:false})',ctx);assert.equal(vm.runInContext('lastQuery.options.mode',ctx),'contiguous');nodes.get('consecutive').checked=false;nodes.get('consecutive').onchange();
  // Multi-pickers use the actual button handlers, include off-page entries, and apply the cohort automatically.
  nodes.get('lengthN').value=2;nodes.get('consecutive').checked=false;nodes.get('mode').value='gapped';
  vm.runInContext("openPicker('section')",ctx);nodes.get('sectionAll').onclick();nodes.get('sectionApply').onclick();await waitForComparison();
  assert.equal(vm.runInContext('selectedBaseUnits().length',ctx),3093);
  assert.equal(vm.runInContext('lastQuery.units.length',ctx),3093);assert.equal(vm.runInContext('stats.selectedUnits',ctx),3093);
  assert(vm.runInContext('stats.matchedBaseUnits>200',ctx));assert(nodes.get('readingChoices').innerHTML.includes('comparisonBase'));
  const offPage=vm.runInContext('Object.keys(stats.byUnit).find(id=>!results.some(r=>r.zid===id))',ctx);assert(offPage);ctx.offPage=offPage;
  await vm.runInContext('openBaseResult(offPage)',ctx);assert.equal(vm.runInContext('activeResult.zid',ctx),offPage);assert.equal(vm.runInContext('lastQuery.units.length',ctx),3093);
  assert(vm.runInContext('loadedColumns[0].id===offPage',ctx));
  for(const c of vm.runInContext('loadedColumns.slice(1)',ctx)){ctx.col=c;assert(vm.runInContext('col.indices.every((e,i)=>col.r.events[e].v===loadedColumns[0].r.events[col.baseIndices[i]].v)',ctx));}
  vm.runInContext("openPicker('section');clearPicker('section');pickerDraft.section=new Set(selectionItems('section').slice(0,2).map(x=>x.id));",ctx);
  nodes.get('sectionApply').onclick();await waitForComparison();
  assert.equal(vm.runInContext('lastQuery.sections.length',ctx),2);assert(vm.runInContext('selectedBaseUnits().every(u=>lastQuery.sections.includes(u.section))',ctx));
  vm.runInContext("openPicker('unit')",ctx);nodes.get('unitNone').onclick();nodes.get('unitApply').onclick();
  assert.equal(vm.runInContext('selectedBaseUnits().length',ctx),0);assert(nodes.get('readings').innerHTML.includes('לא נבחרו'));
  vm.runInContext("openPicker('unit')",ctx);nodes.get('unitAll').onclick();nodes.get('unitApply').onclick();await waitForComparison();
  assert(vm.runInContext('lastQuery.units.length>1',ctx));
  vm.runInContext('save()',ctx);const multiSaved=JSON.parse(ctx.saved.text);assert(multiSaved.query.units.length>1);ctx.multiFixture={text:async()=>JSON.stringify(multiSaved)};await vm.runInContext('restore(multiFixture)',ctx);assert.equal(vm.runInContext('selectedBaseUnits().length',ctx),multiSaved.query.units.length);
  const fullCohort=vm.runInContext('lastQuery',ctx);ctx.fullCohort=fullCohort;await vm.runInContext('loadAnalytics()',ctx);
  assert.equal(vm.runInContext('analyticsData.rows.length',ctx),vm.runInContext('stats.matches',ctx));assert.equal(vm.runInContext('analyticsData.zs.length',ctx),fullCohort.units.length);
  for(let i=0;i<8;i++){ctx.viewIndex=i;vm.runInContext('vizActive=viewIndex;renderVisualization()',ctx);assert(!/NaN|Infinity|undefined/.test(nodes.get('vizPlot').innerHTML));}
  const evidencePair=vm.runInContext('analyticsData.rows.find(r=>r.z.id!==analyticsData.zs[0].id)',ctx);assert(evidencePair);ctx.evidencePair=evidencePair;
  await vm.runInContext('openEvidence(evidencePair)',ctx);assert.equal(vm.runInContext('activeResult.zid',ctx),evidencePair.z.id);assert.equal(vm.runInContext('activeResult.tid',ctx),evidencePair.u.id);
  vm.runInContext('restoreSelection(fullCohort)',ctx);await vm.runInContext('run(null,{reveal:false})',ctx);
  // Both native order radios recompute the query without a second search click.
  nodes.get('orderNo').checked=true;nodes.get('orderNo').onchange();await waitForComparison();assert.equal(vm.runInContext('lastQuery.options.mode',ctx),'bag');
  nodes.get('orderYes').checked=true;nodes.get('orderYes').onchange();await waitForComparison();assert.equal(vm.runInContext('lastQuery.options.mode',ctx),'gapped');
  // The full-verse checkbox is reversible and does not change the cohort or matching method.
  const beforeOptions=JSON.stringify(vm.runInContext('lastQuery',ctx));nodes.get('trainAll').checked=true;await nodes.get('trainAll').onchange();
  const totalEvents=vm.runInContext('loadedColumns.reduce((n,c)=>n+c.r.events.length,0)',ctx);assert.equal((nodes.get('trains').innerHTML.match(/class="wagon /g)||[]).length,totalEvents);
  assert.equal((nodes.get('readings').innerHTML.match(/class="event-badge"/g)||[]).length,totalEvents);
  nodes.get('trainAll').checked=false;await nodes.get('trainAll').onchange();assert.equal(JSON.stringify(vm.runInContext('lastQuery',ctx)),beforeOptions);
  assert.equal((nodes.get('trains').innerHTML.match(/class="wagon /g)||[]).length,vm.runInContext('[...eventPalette.values()].filter(x=>x.matched).length',ctx));
  // Empty searches get verified proposals. Click one and check that its advertised count is reproduced.
  nodes.get('lengthN').value=999;await vm.runInContext('run(null,{reveal:false})',ctx);assert.equal(vm.runInContext('stats.matches',ctx),0);
  for(let t=0;t<500;t++){await new Promise(r=>setTimeout(r,10));if(vm.runInContext('guidanceChoices.search?.length>0',ctx))break;}
  const suggestion=vm.runInContext('guidanceChoices.search[0]',ctx);assert(suggestion&&suggestion.count>0);await vm.runInContext("applyGuidance('search',0)",ctx);assert.equal(vm.runInContext('stats.matches',ctx),suggestion.count);
  // The lab defaults to all sources, but a current-search scope tracks the exact multi-selection.
  nodes.get('labScope').value='search';await vm.runInContext('runLab()',ctx);assert.equal(vm.runInContext('labData.groups[0].units.length',ctx),vm.runInContext('lastQuery.units.length',ctx));
  nodes.get('labScope').value='all';nodes.get('labMin').value='999';await nodes.get('labMin').onchange();assert.equal(vm.runInContext('labData.pairs.length',ctx),0);
  vm.runInContext('labView=8;renderLab()',ctx);assert(nodes.get('labPlot').innerHTML.includes('אין נתונים לתרשים'));assert(nodes.get('labPlot').innerHTML.includes('data-lab-view="0"'));
  for(let t=0;t<600;t++){await new Promise(r=>setTimeout(r,10));if(vm.runInContext('guidanceChoices.lab?.length>0',ctx))break;}
  const labSuggestion=vm.runInContext('guidanceChoices.lab[0]',ctx);assert(labSuggestion);await vm.runInContext("applyGuidance('lab',0)",ctx);assert.equal(vm.runInContext('labData.pairs.length',ctx),labSuggestion.count);
  assert.equal(nodes.get('labScope').value,'custom');assert(vm.runInContext('labAvailability[8]>0',ctx));assert(nodes.get('labPlot').innerHTML.includes('data-lab-hit'));
  // Return to a single unit before the existing race checks.
  vm.runInContext('fillUnits(original)',ctx);nodes.get('lengthN').value=2;await vm.runInContext('run(null,{reveal:false})',ctx);
  // Out-of-order downloads must not overwrite a newer book selection.
  const books=vm.runInContext('manifest.books',ctx),a=books[0],b=books[1];
  vm.runInContext('indexCache.clear()',ctx);delays[a.catalog]=30;nodes.get('base').value=a.id;const first=vm.runInContext('changeBase()',ctx);nodes.get('base').value=b.id;const second=vm.runInContext('changeBase()',ctx);await Promise.all([first,second]);assert.equal(vm.runInContext('baseIndex.id',ctx),b.id);assert(nodes.get('unit').value);
  vm.runInContext('indexCache.clear();browseIndex=null;',ctx);nodes.get('browseBook').value=a.id;const oldBrowse=vm.runInContext('loadBrowse()',ctx);nodes.get('browseBook').value=b.id;const newBrowse=vm.runInContext('loadBrowse()',ctx);await Promise.all([oldBrowse,newBrowse]);assert.equal(vm.runInContext('browseIndex.id',ctx),b.id);delete delays[a.catalog];
  const oldUnit=vm.runInContext('browseIndex.units[0]',ctx);delays[oldUnit.shard]=25;vm.runInContext('textCache.clear()',ctx);ctx.oldUnit=oldUnit;const oldText=vm.runInContext('openBrowse(oldUnit.id)',ctx);nodes.get('browseBook').value=a.id;await vm.runInContext('loadBrowse()',ctx);await oldText;assert.equal(vm.runInContext('browseRecord',ctx),null,'Old text must not overwrite a newly selected book');delete delays[oldUnit.shard];
  // A failed analytics fetch can be retried successfully.
  failures[b.index]=1;vm.runInContext('analysisIndexes={};',ctx);await assert.rejects(()=>vm.runInContext('loadAnalytics()',ctx));assert(nodes.get('vizPlot').innerHTML.includes('retryAnalytics'));await vm.runInContext('loadAnalytics()',ctx);assert(vm.runInContext('analyticsData.q.units.includes(currentUnit().id)',ctx));
  assert(requests.some(r=>r.pathname==='/project/data/indexes/zohar.json'));
  assert.deepEqual(requests.filter(r=>!r.ok),[], 'All deployed asset and data URLs must exist at a GitHub Pages subpath');
  console.log('PASS: HTTP startup + real worker, single/multi-unit scopes, complete select-all, verified no-results recovery, catalog browsing, word/name lookup, save/restore, click controls, full/excerpt reading, async selection races and retry after network failure.');

})().catch(e => { console.error(e); process.exitCode = 1; }).finally(()=>{vm.runInContext('clearTimeout(comparisonTimer)',ctx);server.closeAllConnections();server.close();});
