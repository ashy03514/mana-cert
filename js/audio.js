/* No external assets. Slots can be replaced with decoded AudioBuffers via setBuffer. */
(function(root){
  'use strict';
  const SLOTS=Object.freeze({touch:[440,660,0.12],movement:[260,340,0.09],resonance:[520,1040,0.28],
    gather:[660,180,0.35],element:[390,780,0.3],rankUp:[550,880,0.16],
    confirmed:[660,990,0.28],ssWarning:[180,130,0.22],muggleFailure:[200,80,0.2]});
  class AudioManager {
    constructor(host=root){this.host=host;this.context=null;this.enabled=true;this.voices=new Set();this.buffers=new Map();this.last=new Map();}
    unlock(){
      if(!this.enabled)return;
      try{
        const Context=this.host.AudioContext||this.host.webkitAudioContext;
        if(!Context)return;
        if(!this.context)this.context=new Context();
        if(this.context.state!=='running')this.context.resume()?.catch(()=>{});
      }catch(_){ /* Unsupported / blocked audio must never interrupt certification. */ }
    }
    setBuffer(slot,buffer){if(SLOTS[slot])this.buffers.set(slot,buffer);}
    play(slot){
      const c=this.context,s=SLOTS[slot];
      if(!this.enabled||!s||!c||c.state!=='running'||this.voices.size>=4)return false;
      const now=c.currentTime;
      if(now-(this.last.get(slot)??-Infinity)<(slot==='movement'?0.16:0.07))return false;
      let source,gain;
      try {
        const buffer=this.buffers.get(slot);gain=c.createGain();
        source=buffer?c.createBufferSource():c.createOscillator();
        const duration=buffer?Math.min(buffer.duration,2):s[2];
        if(buffer)source.buffer=buffer;
        else{source.type='sine';source.frequency.setValueAtTime(s[0],now);source.frequency.exponentialRampToValueAtTime(s[1],now+duration);}
        gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.035,now+0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
        source.connect(gain);gain.connect(c.destination);
        const voice={source,gain};this.voices.add(voice);
        source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
        source.start(now);source.stop(now+duration+0.02);this.last.set(slot,now);return true;
      } catch(_){
        try{source?.stop();source?.disconnect();gain?.disconnect();}catch(_){}
        for(const v of this.voices)if(v.source===source)this.voices.delete(v);
        return false;
      }
    }
    stop(){
      for(const v of this.voices){try{v.source.onended=null;v.source.stop();v.source.disconnect();v.gain.disconnect();}catch(_){}}
      this.voices.clear();this.last.clear();
    }
    setEnabled(on){this.enabled=!!on;if(!on)this.stop();else this.unlock();}
  }
  function optionalVibrate(navigator,pattern){try{return typeof navigator.vibrate==='function'&&navigator.vibrate(pattern);}catch(_){return false;}}
  root.AudioManager=AudioManager;root.optionalVibrate=optionalVibrate;
})(globalThis);
