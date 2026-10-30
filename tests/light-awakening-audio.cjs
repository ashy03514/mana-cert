'use strict';
const assert=require('node:assert/strict');
require('../js/audio.js');
class Param{
  constructor(){this.events=[];}
  setValueAtTime(value,time){this.events.push({type:'set',value,time});}
  exponentialRampToValueAtTime(value,time){this.events.push({type:'ramp',value,time});}
}
class Node{
  constructor(kind){this.kind=kind;this.frequency=new Param();this.gain=new Param();this.started=[];this.stopped=[];this.disconnected=false;}
  connect(target){this.target=target;}
  disconnect(){this.disconnected=true;}
  start(time){if(this.failStart)throw Error('start failed');this.started.push(time);}
  stop(time){this.stopped.push(time);}
}
class Context{
  constructor(){this.state='running';this.currentTime=10;this.destination={};this.nodes=[];this.oscillators=0;}
  createGain(){const n=new Node('gain');this.nodes.push(n);return n;}
  createOscillator(){if(++this.oscillators===this.failOscillatorAt)throw Error('allocation failed');const n=new Node('oscillator');n.failStart=this.oscillators===this.failStartAt;this.nodes.push(n);return n;}
  createBufferSource(){const n=new Node('buffer');this.nodes.push(n);return n;}
  resume(){this.state='running';return Promise.resolve();}
}
const manager=()=>{const a=new AudioManager({AudioContext:Context});a.unlock();return a;};
const absent=new AudioManager({});absent.unlock();assert.equal(absent.play('lightAwaken'),false);
const a=manager();a.context.state='suspended';assert.equal(a.play('lightAwaken'),false);assert.equal(a.context.nodes.length,0);
a.context.state='running';a.setEnabled(false);assert.equal(a.play('lightAwaken'),false);a.setEnabled(true);
assert.equal(a.play('lightAwaken'),true);assert.equal(a.voices.size,3);
const voices=[...a.voices];
for(let i=0;i<voices.length;i++){
  const {source,gain}=voices[i];assert.equal(source.type,'sine');assert.equal(source.started[0],10+i*.035);assert.equal(source.stopped[0],11.92);
  assert.equal(source.frequency.events[0].value,[330,495,660][i]);assert.equal(source.frequency.events[1].value,[330,495,660][i]*1.025);
  assert.ok(Math.max(...gain.gain.events.map(e=>e.value))<=.010,'quiet chord voices');
  assert.equal(gain.gain.events.at(-1).time,11.9);assert.equal(gain.gain.events.at(-1).value,.0001);
}
assert.equal(a.play('lightAwaken'),false,'same-event retrigger throttled');
assert.equal(a.play('touch'),true);assert.equal(a.voices.size,4);assert.equal(a.play('movement'),false);
a.stop();assert.equal(a.voices.size,0);assert.equal(a.last.size,0);assert.ok(a.context.nodes.every(n=>n.disconnected));
assert.ok(voices.every(v=>v.source.onended===null&&v.source.stopped.length===2));
const busy=manager();busy.play('touch');busy.play('gather');const count=busy.context.nodes.length;
assert.equal(busy.play('lightAwaken'),false,'three complete chord slots required');assert.equal(busy.context.nodes.length,count,'no partial allocation');assert.equal(busy.voices.size,2);busy.stop();
const room=manager();room.play('touch');assert.equal(room.play('lightAwaken'),true);assert.equal(room.voices.size,4);
for(const voice of [...room.voices])voice.source.onended();assert.equal(room.voices.size,0);assert.ok(room.context.nodes.every(n=>n.disconnected));
for(const failure of ['failOscillatorAt','failStartAt']){
  const broken=manager();broken.context[failure]=2;assert.equal(broken.play('lightAwaken'),false);assert.equal(broken.voices.size,0);
  assert.ok(broken.context.nodes.every(n=>n.disconnected),'partial chord nodes cleaned after '+failure);assert.equal(broken.last.has('lightAwaken'),false);
}
const custom=manager(),buffer={duration:1.4};custom.setBuffer('lightAwaken',buffer);
assert.equal(custom.play('lightAwaken'),true);assert.equal(custom.voices.size,1);const customVoice=[...custom.voices][0];
assert.equal(customVoice.source.kind,'buffer');assert.equal(customVoice.source.buffer,buffer);custom.stop();
console.log('PASS light awakening audio: quiet three-tone envelope, slight rise, disabled/unsupported/suspended guards, shared voice cap, throttle, completion/stop/failure cleanup, custom buffer.');
