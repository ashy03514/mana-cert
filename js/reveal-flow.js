/* Shared reveal pacing. No timers, DOM, randomness, or certification outcome. */
(function(root) {
  'use strict';
  const ELEMENTS=Object.freeze(['fire','water','wind','earth','light','dark']);
  // Two inward waves finish at 1.2 s, then build pressure for another 0.5 s.
  const DURATIONS=Object.freeze({WAITING:1.7,GATHER:2.1,AWAKEN:1.9,FORM:.8,REVEAL:1.8,SETTLE:.8});
  const NEXT=Object.freeze({WAITING:'GATHER',GATHER:'FORM',AWAKEN:'FORM',FORM:'REVEAL',REVEAL:'SETTLE',SETTLE:'DONE'});
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const x=clamp(v);return x*x*(3-2*x);};

  class RevealFlow {
    constructor(settings={},options={}){this.configure(settings,options);this.reset();}
    configure(settings={}, {holdAtReveal=false,lightAwakening=false,darkAwakening=false}={}){
      this._gatherDuration=Number.isFinite(settings.burstDuration)?Math.max(1.2,Math.min(4,settings.burstDuration)):DURATIONS.GATHER;
      this.burstRadius=Number.isFinite(settings.burstRadius)?Math.max(50,Math.min(160,settings.burstRadius)):100;
      this.holdAtReveal=holdAtReveal===true;
      this.lightAwakening=lightAwakening===true;
      this.darkAwakening=darkAwakening===true;
      return this;
    }
    reset(element='fire'){
      this.element=element===null?null:(ELEMENTS.includes(element)?element:'fire');
      this.state='DRAWING';this.elapsed=0;this.paused=false;
      this.pointerId=null;this.distance=0;this._point=null;
      return this;
    }
    get ready(){return this.distance>=24;}
    get gatherDuration(){return this._gatherDuration;}
    get awakeningEnabled(){return (this.lightAwakening&&this.element==='light')||(this.darkAwakening&&this.element==='dark');}
    get awakeningDuration(){return this.awakeningEnabled?(this.element==='dark'?3.2:DURATIONS.AWAKEN):0;}
    get formationDuration(){return this.awakeningEnabled&&this.element==='light' ? .6 : this.element==='fire'||this.element==='water'?1.2:DURATIONS.FORM;}
    get duration(){if(this.state==='AWAKEN')return this.awakeningDuration;return this.state==='GATHER'?this.gatherDuration:this.state==='FORM'?this.formationDuration:DURATIONS[this.state];}
    get progress(){
      if(this.state==='DONE')return 1;
      return this.duration?clamp(this.elapsed/this.duration):0;
    }
    get materialFrame(){
      let time,opacity;
      if(this.state==='FORM'){
        time=this.elapsed;opacity=this.element==='fire'||this.element==='water'?1:smooth(this.progress);
      }else if(this.state==='REVEAL'){
        time=this.formationDuration+this.elapsed;opacity=1;
      }else if(this.state==='SETTLE'){
        time=this.formationDuration+DURATIONS.REVEAL+this.elapsed;
        opacity=1-.55*smooth(this.progress);
      }else if(this.state==='DONE'){
        time=this.formationDuration+DURATIONS.REVEAL+DURATIONS.SETTLE;opacity=.45;
      }else return null;
      // Keep a formed material alive: shader time continues, while its reveal
      // envelope stops before the late fade/disassembly portion.
      return {time,phase:Math.min(this.holdAtReveal ? .5 : 1,clamp(time/6.4)),opacity};
    }
    down(id,x,y){
      if(this.paused||this.pointerId!==null||id===null||id===undefined||
        !Number.isFinite(x)||!Number.isFinite(y)||
        (this.state!=='DRAWING'&&this.state!=='WAITING'))return false;
      this.pointerId=id;this._point={x,y};this.state='DRAWING';this.elapsed=0;
      return true;
    }
    move(id,x,y){
      if(this.paused||this.pointerId===null||id!==this.pointerId||
        !Number.isFinite(x)||!Number.isFinite(y))return false;
      const distance=Math.hypot(x-this._point.x,y-this._point.y);
      // Keep the last meaningful point so tiny back-and-forth input jitter
      // cannot become a completed drawing after a stationary long press.
      if(distance<2)return false;
      this.distance=Math.min(1e6,this.distance+distance);this._point={x,y};
      return true;
    }
    up(id,{cancelled=false}={}){
      if(this.paused||this.pointerId===null||id!==this.pointerId)return false;
      if(cancelled){this.cancelPointer();return true;}
      this.pointerId=null;this._point=null;this.elapsed=0;
      this.state=this.ready?'WAITING':'DRAWING';
      return true;
    }
    cancelPointer(){
      // Lifecycle cancellation must still release capture while animation is paused.
      this.pointerId=null;this._point=null;
      if(this.state==='WAITING'||this.state==='DRAWING'){
        this.state='DRAWING';this.elapsed=0;
      }
    }
    step(dt){
      if(this.paused||!Number.isFinite(dt)||dt<=0||!this.duration)return;
      let remaining=Math.min(dt,.05);
      while(remaining>0&&this.duration){
        if(this.holdAtReveal&&this.state==='REVEAL'){
          this.elapsed+=remaining;break;
        }
        const duration=this.duration,untilEnd=Math.max(0,duration-this.elapsed);
        if(remaining+1e-9<untilEnd){this.elapsed+=remaining;break;}
        remaining=Math.max(0,remaining-untilEnd);
        // Rare-element openings occupy their own clock after the last orb
        // reaches the core. Material/scan time only starts when FORM begins.
        this.state=this.state==='GATHER'&&this.awakeningEnabled?'AWAKEN':NEXT[this.state];this.elapsed=0;
      }
    }
  }
  root.RevealFlow=RevealFlow;
})(globalThis);
