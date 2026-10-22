import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('src/app.js','utf8');
function harness({runtime={static:true,apiBase:'',config:{live:false}},saved={}}={}){
 const nodes=new Map(),handlers={},windowHandlers={},timers=new Map(),local=new Map(Object.entries(saved));let clock=Date.now(),timerId=0,requests=[];
 function node(selector){if(!nodes.has(selector)){const events={};const n={innerHTML:'',textContent:'',value:'',checked:false,dataset:{},events,classList:{add(){},remove(){},toggle(){}},focus(){context.document.activeElement=n},addEventListener:(key,fn)=>events[key]=fn,setPointerCapture(){},querySelector(){return null},get firstChild(){return this.innerHTML?{}:null}};nodes.set(selector,n)}return nodes.get(selector)}
 class FakeDate extends Date{static now(){return clock}}
 const context={console,URL,Date:FakeDate,Intl,Map,JSON,Math,Promise,AbortSignal,crypto,
 navigator:{onLine:true,userAgent:'test'},history:{replaceState(){}},location:{hash:'',pathname:'/conecta-segura/'},
 localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
 setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms,interval:false});return timerId},clearTimeout:id=>timers.delete(id),
 setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms,interval:true});return timerId},clearInterval:id=>timers.delete(id),
 fetch:(...args)=>{requests.push(args);return new Promise(()=>{})},
 window:{CONECTA_RUNTIME:runtime,addEventListener:(key,fn)=>windowHandlers[key]=fn,scrollTo(){}},
 document:{body:{classList:{toggle(){}},appendChild(){}},querySelector:node,querySelectorAll:()=>[],addEventListener:(key,fn)=>handlers[key]=fn,activeElement:null,hidden:false}};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,nodes,handlers,windowHandlers,local,requests,run:code=>vm.runInContext(code,context),node,
 tick(ms){clock+=ms;for(const [id,t] of [...timers])if(t.ms===ms){if(!t.interval)timers.delete(id);t.fn()}},
 event(n,key,extra={}){node(n).events[key]({type:key,preventDefault(){},...extra})}};
}
const contact={id:'00000000-0000-4000-8000-000000000001',name:'Contato fictício',phone:'+5592999990000',relation:'Teste',active:true,consent:true};
test('Screens, tutorial and escaped contact content',()=>{
 const h=harness();assert.match(h.node('#main').innerHTML,/Um gesto/);assert.equal(h.run('contacts.length'),0);
 for(const p of ['contatos','localizacao','ajuda','ajustes']){h.run(`navigate('${p}')`);assert.ok(h.node('#main').innerHTML.length>400)}
 h.run(`contacts=[${JSON.stringify({...contact,name:'<img src=x onerror=alert(1)>'})}];navigate('contatos')`);
 assert.doesNotMatch(h.node('#main').innerHTML,/<img src=x/);assert.match(h.node('#main').innerHTML,/&lt;img/);
 for(let i=0;i<6;i++){h.run(`tour=${i};navigate('ajuda')`);assert.match(h.node('#main').innerHTML,/Ouvir este passo/)}
});
test('Brazilian and explicit international phones reject malformed and impossible input',()=>{
 const h=harness();for(const [value,expected] of [['(92) 99999-0000','+5592999990000'],['+1 (202) 555-0100','+12025550100'],['+55 11 2345-6789','+551123456789'],['123',null],['00000000000',null],['+55 20 99999-0000',null],['+55 92 89999-0000',null],['abc92999990000',null],['++5592999990000',null]])assert.equal(h.run(`normalizePhone(${JSON.stringify(value)})`),expected,value);
});
test('Pages never calls same-origin API and prevents real mode',async()=>{
 const h=harness();await Promise.resolve();assert.equal(h.requests.length,0);h.run('setDemo(false)');assert.equal(h.run('prefs.demo'),true);
 await assert.rejects(h.run("api('/api/alerts',{method:'POST'})"),/Backend não configurado/);assert.equal(h.requests.length,0);
});
test('Countdown preserves cancel focus, cancels before send and guards duplicate requests',()=>{
 const h=harness();h.run('startCountdown()');const id=h.run('activeAlert.id');const focus=h.context.document.activeElement;
 h.tick(1000);assert.equal(h.run('activeAlert.remaining'),4);assert.equal(h.context.document.activeElement,focus);
 h.run('startCountdown()');assert.equal(h.run('activeAlert.id'),id);h.run('cancelCountdown()');h.tick(1000);
 assert.equal(h.run('activeAlert.stage'),'cancelled');assert.equal(h.requests.length,0);
 h.run('activeAlert=null;startCountdown()');for(let i=0;i<5;i++)h.tick(1000);
 assert.equal(h.run('activeAlert.stage'),'demo');assert.match(h.node('#main').innerHTML,/não enviou SMS nem WhatsApp/);
 h.run('sendAlert()');assert.equal(h.run('activeAlert.stage'),'demo');assert.equal(h.requests.length,0);
});
test('Pointer and keyboard hold, release, blur and navigation cancellation',()=>{
 for(const key of [' ','Enter']){const h=harness();h.event('#sos','keydown',{key});h.tick(75);assert.equal(h.run('activeAlert'),null);h.event('#sos','keyup',{key});h.tick(75);assert.equal(h.run('holdTimer'),null);h.event('#sos','keydown',{key});for(let i=0;i<40;i++)h.tick(75);assert.equal(h.run('activeAlert.stage'),'countdown')}
 const h=harness();h.event('#sos','pointerdown',{button:2});assert.equal(h.run('holdTimer'),null);
 h.event('#sos','pointerdown',{button:0});h.run("navigate('contatos')");assert.equal(h.run('holdTimer'),null);
 h.run("navigate('inicio')");h.event('#sos','pointerdown',{button:0});h.windowHandlers.blur();assert.equal(h.run('holdTimer'),null);
 h.event('#sos','pointerdown',{button:0});for(let i=0;i<40;i++)h.tick(75);assert.equal(h.run('activeAlert.stage'),'countdown');
 h.context.document.hidden=true;h.handlers.visibilitychange();assert.equal(h.run('activeAlert.stage'),'cancelled');
});
test('Contacts create, reject duplicate, edit, toggle and delete using form handlers',()=>{
 const h=harness();h.run('contactForm()');h.node('#contactName').value=contact.name;h.node('#contactPhone').value='(92) 99999-0000';h.node('#contactRelation').value='Teste';h.node('#contactConsent').checked=true;
 const submit=()=>h.handlers.submit({target:{id:'contactForm'},preventDefault(){}});submit();assert.equal(h.run('contacts.length'),1);
 h.run('contactForm()');submit();assert.equal(h.run('contacts.length'),1);assert.match(h.node('#contactError').textContent,/já está/);
 h.run('contactForm(contacts[0])');h.node('#contactName').value='Contato editado';submit();assert.equal(h.run('contacts[0].name'),'Contato editado');
 h.handlers.change({target:{dataset:{contactToggle:h.run('contacts[0].id')},checked:false}});assert.equal(h.run('contacts[0].active'),false);
 h.handlers.click({target:{closest:()=>({dataset:{delete:h.run('contacts[0].id')}})}});h.node('#confirmDelete').onclick();assert.equal(h.run('contacts.length'),0);
});
test('Corrupt storage recovers safely; manual links require user confirmation',()=>{
 const h=harness({saved:{'cs:/conecta-segura/:demo:contacts':'{}','cs:/conecta-segura/:demo:prefs':'null'}});assert.equal(h.run('contacts.length'),0);
 h.run(`manualContact(${JSON.stringify(contact)})`);assert.match(h.node('#modalRoot').innerHTML,/envio manual real/);assert.match(h.node('#modalRoot').innerHTML,/tocar em Enviar/);assert.match(h.node('#modalRoot').innerHTML,/sms:\+5592/);
});
test('Denied GPS, stale coordinates and offline demo stay usable',()=>{
 const h=harness();h.context.navigator.geolocation={getCurrentPosition(ok,fail){fail({code:1})}};h.run("navigate('localizacao');locate()");assert.match(h.node('#main').innerHTML,/Permissão negada/);
 h.run('position={lat:1,lng:2,time:Date.now()-120000,accuracy:5}');assert.equal(h.run('freshLocation()'),null);
 h.context.navigator.onLine=false;h.windowHandlers.offline();assert.equal(h.node('#offlineBar').hidden,false);
 h.run('startCountdown()');for(let i=0;i<5;i++)h.tick(1000);assert.equal(h.run('activeAlert.stage'),'demo');assert.equal(h.requests.length,0);
});
test('A late GPS callback cannot restore a position after stop',()=>{
 const h=harness();let resolvePosition;
 h.context.navigator.geolocation={getCurrentPosition(ok){resolvePosition=ok}};
 h.run('locate();stopLocation()');resolvePosition({coords:{latitude:1,longitude:2,accuracy:10},timestamp:Date.now()});
 assert.equal(h.run('position'),null);
});
