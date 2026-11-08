const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),H=require('../assets/release-6.3/info.js');
assert(H.lookup('p').body.includes('אינו ההסתברות'));
assert(H.lookup('q').body.includes('Benjamini'));
assert(H.lookup('זרע לשחזור').body.includes('אותם נתונים'));
for(const text of ['כל הפסוקים ביחידה','ללא סדר','לפי הסדר','ייחוסים חלופיים','חפיפות','נדפס מול בובר','מפת המקבילות','יציבות המקרה','ערבובים','נצפה / צפוי','תנחומא בובר','רכבת הפסוקים','יחידות הזוהר','תיקי מקרה','תפקידי הפסוקים'])assert(H.lookup(text),text);
for(const [vw,vh]of [[390,844],[1280,720],[320,300]]){const p=H.position({right:vw-1,bottom:vh-10,top:vh-30},Math.min(340,vw-24),160,vw,vh);assert(p.left>=12&&p.top>=12);assert(p.left+Math.min(340,vw-24)<=vw-12);assert(p.top+160<=vh-12);}
const listeners={},winListeners={};let observer;
class Node{
 constructor(tag,text=''){this.tagName=tag.toLowerCase();this._text=text;this.children=[];this.parentElement=null;this.attrs={};this.style={};this.hidden=false;this._listeners={};this.id='';this.className='';}
 get classList(){return {add:c=>{if(!this.className.split(' ').includes(c))this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');}};}
 get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}set textContent(v){this._text=v;for(const c of this.children)c.parentElement=null;this.children=[];}
 set innerHTML(v){this.children=[];if(this.id==='contextInfoPopup'){for(const [tag,cls]of [['button','context-info-close'],['strong','context-info-title'],['p','context-info-body'],['span','context-info-hint']]){const n=new Node(tag);n.className=cls;this.append(n);}}}
 get isConnected(){return this===body||!!this.parentElement?.isConnected;}get offsetWidth(){return 340;}get offsetHeight(){return 160;}
 append(n){if(n.parentElement)n.remove();this.children.push(n);n.parentElement=this;}
 remove(){if(this.parentElement){const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}}
 insertAdjacentElement(where,n){assert.equal(where,'afterend');const p=this.parentElement;p.children.splice(p.children.indexOf(this)+1,0,n);n.parentElement=p;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;}getAttribute(k){return k==='aria-label'?this.attrs[k]||null:this.attrs[k]||null;}removeAttribute(k){delete this.attrs[k];}
 matches(selector){return selector.split(',').some(s=>{s=s.trim();if(s==='thead th')return this.tagName==='th'&&this.parentElement?.closest('thead');if(s[0]==='.')return this.className.split(' ').includes(s.slice(1));if(s[0]==='#')return this.id===s.slice(1);if(s[0]==='[')return s.slice(1,-1) in this.attrs;return this.tagName===s;});}
 closest(s){let n=this;while(n){if(n.matches(s))return n;n=n.parentElement;}return null;}
 querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 contains(n){while(n){if(n===this)return true;n=n.parentElement;}return false;}
 addEventListener(t,f){(this._listeners[t]??=[]).push(f);}getBoundingClientRect(){return {top:80,bottom:110,left:50,right:90};}
 focus(){document.activeElement=this;fire('focusin',this);}
}
const body=new Node('body');const document={body,activeElement:null,createElement:t=>new Node(t),querySelectorAll:s=>body.querySelectorAll(s),addEventListener:(t,f)=>(listeners[t]??=[]).push(f)};
function add(tag,text,id,parent=body){const n=new Node(tag,text);n.id=id||'';parent.append(n);return n;}
function fire(type,target,extra={}){const e={target,pointerType:'mouse',preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},stopPropagation(){this.stopped=true;},...extra};for(const f of listeners[type]||[]){f(e);if(e.stopped)break;}return e;}
const heading=add('h2','ניסויים וממצאים');const label=add('label','כל הפסוקים ביחידה');label.setAttribute('for','trainAll');const input=add('input','','trainAll',label);input.checked=false;
const field=add('div','');field.className='multi-field';const picker=add('button','הכול','unitSummary',field);const nested=add('h3','זוהר','',add('button','תוצאה'));const options=add('div','');options.className='multi-options';add('label','דרשה א','',options);
const table=add('table',''),thead=add('thead','','',table),tr=add('tr','','',thead),p=add('th','p','',tr),q=add('th','q','',tr);
const ctx=vm.createContext({document,console,setTimeout,clearTimeout,MutationObserver:class{constructor(f){observer=f;}observe(){}},innerWidth:1024,innerHeight:768,addEventListener:(t,f)=>(winListeners[t]??=[]).push(f)});ctx.window=ctx;
vm.runInContext(fs.readFileSync(__dirname+'/../assets/release-6.3/info.js','utf8'),ctx);
(async()=>{
 const icons=()=>body.querySelectorAll('.context-info-button');assert.equal(icons().length,5);assert(!label.querySelector('button'),'Label activation is not polluted by another button');assert(!nested.querySelector('button'),'No nested buttons');
 ctx.ContextInfo.decorate();assert.equal(icons().length,5,'Decoration is idempotent');const pop=body.querySelector('#contextInfoPopup'),icon=heading.querySelector('.context-info-button');assert(pop.hidden);
 fire('pointerover',icon);assert(!pop.hidden);assert.equal(pop.getAttribute('role'),'tooltip');assert(pop.querySelector('.context-info-body').textContent.includes('ניסויים חקרניים'));
 const click=fire('click',icon);assert(click.prevented&&click.stopped);assert.equal(icon.getAttribute('aria-expanded'),'true');assert.equal(pop.getAttribute('role'),'dialog');assert.equal(document.activeElement,pop.querySelector('.context-info-close'));
 fire('keydown',document.activeElement,{key:'Escape'});assert(pop.hidden);assert.equal(document.activeElement,icon);assert.equal(icon.getAttribute('aria-describedby'),null,'Restoring focus must not reopen the explanation');
 fire('click',icon);fire('click',input);assert(pop.hidden);assert.equal(input.checked,false,'Info clicks do not modify controls');
 const infoOfLabel=label.querySelector('.context-info-button');assert.equal(infoOfLabel.className,'context-info-button');fire('click',infoOfLabel);assert(pop.querySelector('.context-info-body').textContent.includes('כבויה'));assert.equal(input.checked,false);
 fire('click',infoOfLabel);assert(pop.hidden,'Second click toggles closed');fire('keydown',infoOfLabel,{key:'Enter'});assert(!pop.hidden&&pop.getAttribute('role')==='dialog','Enter opens span control');fire('keydown',infoOfLabel,{key:' '});assert(pop.hidden,'Space closes span control');assert.equal(label.children[0],input,'No native control was moved');assert.equal(infoOfLabel.parentElement,label,'No layout sibling is inserted');
 const orderGroup=add('fieldset',''),orderLegend=add('legend','סדר הפסוקים','',orderGroup);for(const id of ['orderYes','orderNo']){const option=add('label',id==='orderYes'?'לפי הסדר':'ללא סדר','',orderGroup);const radio=add('input','',id,option);}ctx.ContextInfo.decorate();assert.equal(orderGroup.querySelectorAll('.context-info-button').length,1,'Radio group has one shared explanation');const groupInfo=orderLegend.querySelector('.context-info-button');fire('click',groupInfo);assert(pop.querySelector('.context-info-body').textContent.includes('ללא סדר'));fire('keydown',groupInfo,{key:'Escape'});for(const b of icons())assert(!b.closest('button,a'),'No nested interactive controls');
 const late=add('h2','יציבות המקרה');observer([{target:body}]);await new Promise(r=>setTimeout(r,70));assert(late.querySelector('.context-info-button'),'Dynamic lab views get help');
 fire('click',late.querySelector('.context-info-button'));late.remove();ctx.ContextInfo.decorate();assert(pop.hidden,'Removing the active panel dismisses its popup');
 const duplicate=add('h2','תיקי מקרה');const same=add('h2','תיקי מקרה');ctx.ContextInfo.decorate();assert(duplicate.querySelector('.context-info-button'));assert(!same.querySelector('.context-info-button'),'Identical notes in one section are merged');duplicate.remove();ctx.ContextInfo.decorate();assert(same.querySelector('.context-info-button'),'Help transfers when its original host disappears');same.remove();ctx.ContextInfo.decorate();const n=icons().length;heading.textContent='תיקי מקרה';ctx.ContextInfo.decorate();assert.equal(icons().length,n,'Re-rendered title gets a fresh icon');fire('pointerover',heading.querySelector('.context-info-button'));assert(pop.querySelector('.context-info-body').textContent.includes('גיבוי'));fire('keydown',heading,{key:'Escape'});
 const pIcon=p.querySelector('.context-info-button');fire('click',pIcon);assert(pop.querySelector('.context-info-body').textContent.includes('אינו ההסתברות'));ctx.ContextInfo.hide();
 console.log(JSON.stringify({status:'passed',topics:H.definitions.length,hover:true,click:true,escape:true,focusRestored:true,dynamicViews:true,noNestedButtons:true,noControlSideEffects:true,viewportClamping:true,noLayoutSiblings:true,duplicateNotesMerged:true,keyboardActivation:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
