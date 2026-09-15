const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
require('../js/runtime.js');require('../js/audio.js');
// Native browser timer APIs reject an arbitrary class instance as their receiver.
// The earlier arrow-function mocks did not enforce this browser contract.
function browserSchedule(){'use strict';assert.ok(this===undefined||this===globalThis,'Illegal invocation: timer receiver');return 1;}
function browserCancel(){'use strict';assert.ok(this===undefined||this===globalThis,'Illegal invocation: cancel receiver');}
const browserTimeline=new ActiveTimeline(()=>0,browserSchedule,browserCancel);
browserTimeline.set(()=>{},180);browserTimeline.pause();browserTimeline.resume();browserTimeline.clear();
let now=0,id=0;const tasks=new Map();
const timeline=new ActiveTimeline(()=>now,(fn,ms)=>{tasks.set(++id,{fn,at:now+ms});return id;},id=>tasks.delete(id));
function tick(ms){now+=ms;for(const [id,t] of [...tasks])if(t.at<=now){tasks.delete(id);t.fn();}}
let fired=0;timeline.set(()=>fired++,1000);tick(400);timeline.pause();tick(10000);
assert.equal(timeline.now(),400);assert.equal(fired,0);assert.equal(tasks.size,0);
timeline.resume();tick(599);assert.equal(fired,0);tick(1);assert.equal(fired,1);
timeline.set(()=>fired++,20);timeline.pause();timeline.clear();timeline.resume();tick(100);
assert.equal(fired,1);assert.equal(timeline.tasks.size,0);
const quality=new AdaptiveQuality(390,844,3);assert.equal(quality.profile.name,'HIGH');
assert.equal(quality.observe(1000),false,'ignore suspension gaps');
for(let i=0;i<60;i++)quality.observe(33);assert.equal(quality.profile.name,'NORMAL');
for(let i=0;i<200;i++)quality.observe(33);assert.equal(quality.profile.name,'LOW');
for(let i=0;i<1300;i++)quality.observe(16);assert.ok(quality.level>0,'sustained fast frames recover quality');
assert.equal(optionalVibrate({},20),false);
assert.equal(optionalVibrate({vibrate(){throw Error('unsupported');}},20),false);
const absent=new AudioManager({});absent.unlock();assert.equal(absent.play('touch'),false);
const blocked=new AudioManager({AudioContext:class{constructor(){throw Error('blocked');}}});blocked.unlock();
const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
class Context {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return {gain:param,connect(){},disconnect(){}};}
  createOscillator(){return {frequency:param,connect(){},disconnect(){},start(){},stop(){}};}
}
const audio=new AudioManager({webkitAudioContext:Context});audio.unlock();
assert.equal(audio.play('touch'),true);assert.equal(audio.play('touch'),false,'throttle duplicate slots');
assert.equal(audio.play('missing'),false);
audio.play('gather');audio.play('element');audio.play('confirmed');assert.equal(audio.voices.size,4);
assert.equal(audio.play('movement'),false,'voice limit');audio.stop();assert.equal(audio.voices.size,0);
audio.setEnabled(false);assert.equal(audio.play('touch'),false);audio.setEnabled(true);assert.equal(audio.play('touch'),true);
// Run real worker install/fetch/activate against a scoped cache test double.
(async()=>{
  const handlers={},cache=new Map(),deleted=[];let network=0;
  const worker={self:{location:{origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(k,fn)=>handlers[k]=fn},URL,
    caches:{open:async()=>({addAll:async assets=>assets.forEach(a=>cache.set(a,{asset:a})),match:async req=>cache.get(req.path)}),keys:async()=>['mana-pwa-old','other-app'],delete:async key=>deleted.push(key)},
    fetch:async()=>{network++;return {network:true};}};
  vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),worker);
  let pending;handlers.install({waitUntil:p=>pending=p});await pending;
  for(const name of ['audio','runtime','pwa'])assert.ok(cache.has('./js/'+name+'.js'));
  handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['mana-pwa-old']);
  handlers.fetch({request:{method:'GET',url:'https://example.test/project/js/audio.js',path:'./js/audio.js'},respondWith:p=>pending=p});
  assert.equal((await pending).asset,'./js/audio.js');assert.equal(network,0,'cached resources work without network');
  // Missing API is also a safe PWA UI path.
  const nodes={pwaStatus:{},checkUpdate:{}};
  vm.runInNewContext(fs.readFileSync('js/pwa.js','utf8'),{document:{getElementById:id=>nodes[id]},navigator:{}});
  assert.equal(nodes.checkUpdate.disabled,true);
  console.log('Stage 6 checks passed: paused timers, quality hysteresis, audio fallbacks/limits, optional vibration, worker cache and scoped cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
