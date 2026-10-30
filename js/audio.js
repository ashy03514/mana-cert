/* No external assets. Slots can be replaced with decoded AudioBuffers via setBuffer. */
(function(root){
  'use strict';
  const SLOTS=Object.freeze({touch:[440,660,0.12],movement:[260,340,0.09],resonance:[520,1040,0.28],
    gather:[660,180,0.35],element:[390,780,0.3],rankUp:[550,880,0.16],
    confirmed:[660,990,0.28],ssWarning:[180,130,0.22],muggleFailure:[200,80,0.2],
    lightAwaken:[330,338.25,1.9]});
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
      if(slot==='lightAwaken'&&!this.buffers.has(slot))return this.playLightAwakening(c,now);
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
    playLightAwakening(c,now){
      // Reserve the complete chord. Partial allocation would make a repeated
      // reveal sound different, and must not exceed the shared four-voice cap.
      if(this.voices.size+3>4)return false;
      const created=[];
      try{
        for(const [i,frequency] of [330,495,660].entries()){
          const voice={source:null,gain:c.createGain()};created.push(voice);
          const source=voice.source=c.createOscillator(),gain=voice.gain;
          const start=now+i*.035,peak=[.010,.0075,.006][i];
          source.type='sine';source.frequency.setValueAtTime(frequency,start);
          source.frequency.exponentialRampToValueAtTime(frequency*1.025,now+1.7);
          gain.gain.setValueAtTime(.0001,start);
          gain.gain.exponentialRampToValueAtTime(peak,now+.52+i*.035);
          gain.gain.exponentialRampToValueAtTime(peak*.72,now+1.12);
          gain.gain.exponentialRampToValueAtTime(.0001,now+1.9);
          source.connect(gain);gain.connect(c.destination);this.voices.add(voice);
          source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
          source.start(start);source.stop(now+1.92);
        }
        this.last.set('lightAwaken',now);return true;
      }catch(_){
        // Tear down every node, including a gain created just before an
        // oscillator allocation/start failure. Never leak a partial chord.
        for(const voice of created){
          if(voice.source)voice.source.onended=null;
          try{voice.source?.stop();}catch(_){}
          try{voice.source?.disconnect();}catch(_){}
          try{voice.gain.disconnect();}catch(_){}
          this.voices.delete(voice);
        }
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
