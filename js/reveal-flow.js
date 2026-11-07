/* Shared reveal pacing. No timers, DOM, randomness, or certification outcome. */
(function(root) {
  'use strict';
  const ELEMENTS=Object.freeze(['fire','water','wind','earth','light','dark','lightning']);
  // The first inward wave starts at .48 on the choreography clock. Released
  // touches delay that clock so the first wave begins exactly 2 s after lift.
  const RELEASE_DELAY=2-.48;
  const AUTO_HOLD_WAIT=1.7;
  const DURATIONS=Object.freeze({RETURN:.55,WAITING:RELEASE_DELAY+AUTO_HOLD_WAIT,GATHER:2.1,AWAKEN:1.9,FORM:.8,REVEAL:1.8,SETTLE:.8});
  const NEXT=Object.freeze({RETURN:'WAITING',WAITING:'GATHER',GATHER:'FORM',AWAKEN:'FORM',FORM:'REVEAL',REVEAL:'SETTLE',SETTLE:'DONE'});
  const HOLD_SECONDS=3;
  const RELEASE_SECONDS=1.2;
  const TAP_SECONDS=.35;
  const HOLD_SETTLE_SECONDS=.35;
  const TAP_SLOP=24, DRAW_STILL_SLOP=6, HOLD_SLOP=14;
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
      this._origin=null;this._holdAge=0;this._drawing=false;this._lastHoldMs=null;
      this._start=null;this._lastSample=null;this._contactAge=0;this._hasDrawn=false;
      this.completionSource=null;this.releasePoint=null;
      this.tapCount=0;this.lastTap=null;
      return this;
    }
    get paused(){return this._paused;}
    set paused(value){
      this._paused=value;
      if(value)this._lastHoldMs=null;
    }
    get heldRelease(){return this.releasePoint!==null;}
    get waitingElapsed(){return this.state==='WAITING'&&this.completionSource!=='autoHold'?this.elapsed-RELEASE_DELAY:this.elapsed;}
    get committed(){return this.state!=='DRAWING'&&(this.state!=='WAITING'||this.completionSource==='autoHold');}
    get ready(){return this.distance>0||this.tapCount>0||this.holdFrame?.ready===true||this.heldRelease;}
    get holdFrame(){
      if(this.pointerId===null||this._drawing||!this._origin)return null;
      return {x:this._origin.x,y:this._origin.y,age:this._holdAge,
        progress:clamp(this._holdAge/HOLD_SECONDS),active:this._holdAge+1e-9>=HOLD_SETTLE_SECONDS,ready:this._holdAge+1e-9>=RELEASE_SECONDS};
    }
    get gatherDuration(){return this._gatherDuration;}
    get awakeningEnabled(){return (this.lightAwakening&&this.element==='light')||(this.darkAwakening&&this.element==='dark');}
    get awakeningDuration(){return this.awakeningEnabled?(this.element==='dark'?3.2:DURATIONS.AWAKEN):0;}
    get formationDuration(){return this.awakeningEnabled&&this.element==='light' ? .6 : this.element==='fire'||this.element==='water'?1.2:DURATIONS.FORM;}
    get duration(){if(this.state==='WAITING'&&this.completionSource==='autoHold')return AUTO_HOLD_WAIT;if(this.state==='AWAKEN')return this.awakeningDuration;return this.state==='GATHER'?this.gatherDuration:this.state==='FORM'?this.formationDuration:DURATIONS[this.state];}
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
    down(id,x,y,nowMs){
      if(this.paused||this.pointerId!==null||id===null||id===undefined||
        !Number.isFinite(x)||!Number.isFinite(y)||
        (this.state!=='DRAWING'&&(this.state!=='WAITING'||this.committed)))return false;
      this.pointerId=id;this._point={x,y};this.state='DRAWING';this.elapsed=0;
      this._origin={x,y};this._holdAge=0;this._drawing=false;
      this._start={x,y};this._lastSample={x,y};this._contactAge=0;this._hasDrawn=false;
      this._lastHoldMs=Number.isFinite(nowMs)?nowMs:null;
      this.completionSource=null;this.releasePoint=null;
      return true;
    }
    move(id,x,y,nowMs,{ending=false}={}){
      if(this.paused||this.pointerId===null||id!==this.pointerId||
        !Number.isFinite(x)||!Number.isFinite(y))return false;
      if(ending){
        // Lifting can shift a touch centroid. Its endpoint may finish existing
        // ink, but cannot turn a tap/settled hold into a newly drawn gesture.
        if(this.advanceHold(0,nowMs)||!this._drawing)return false;
      }else{
        this._lastSample={x,y};
        const moving=this._hasDrawn
          ?Math.hypot(x-this._origin.x,y-this._origin.y)>(this._drawing?DRAW_STILL_SLOP:HOLD_SLOP)
          :Math.hypot(x-this._start.x,y-this._start.y)>=TAP_SLOP;
        // Evaluate reported motion before a delayed frame can finish a hold.
        if(moving){
          this.advanceHold(0,nowMs,true);
          this._origin={x,y};this._drawing=true;this._hasDrawn=true;
        }else if(this.advanceHold(0,nowMs))return false;
        if(!this._drawing)return false;
      }
      const distance=Math.hypot(x-this._point.x,y-this._point.y);
      if(distance<2)return false;
      this.distance=Math.min(1e6,this.distance+distance);this._point={x,y};
      return true;
    }
    advanceHold(dt,nowMs,moving=false){
      // Contact duration uses real active time, including the interval between
      // the last animation frame and pointerup on a low-frame-rate device.
      let elapsed=0;
      if(Number.isFinite(nowMs)){
        if(this._lastHoldMs!==null&&nowMs<this._lastHoldMs)return;
        if(this._lastHoldMs!==null)elapsed=(nowMs-this._lastHoldMs)/1000;
        this._lastHoldMs=nowMs;
      }else if(dt>0){
        elapsed=dt;this._lastHoldMs=null;
      }
      this._contactAge+=elapsed;
      this._holdAge=moving?0:this._holdAge+elapsed;
      if(moving)return false;
      // The same finger can draw, stop to charge, then draw again. The quiet
      // clock also runs on RAF, so stopping needs no extra pointermove event.
      if(this._drawing&&this._holdAge+1e-9>=HOLD_SETTLE_SECONDS){
        this._drawing=false;this._origin={...this._lastSample};
      }
      if(this._holdAge+1e-9<HOLD_SECONDS)return false;
      this._holdAge=HOLD_SECONDS;
      this.finishPress('autoHold');
      return true;
    }
    finishPress(source){
      this.completionSource=source;
      if(source==='tap')this.lastTap=Object.freeze({x:this._start.x,y:this._start.y,sequence:++this.tapCount});
      this.releasePoint=source==='hold'||source==='autoHold'
        ?{x:this._origin.x,y:this._origin.y,age:this._holdAge}:null;
      this.pointerId=null;this._point=null;this._origin=null;this._holdAge=0;this._lastHoldMs=null;
      this._start=null;this._lastSample=null;this._contactAge=0;this._hasDrawn=false;this._drawing=false;
      this.elapsed=0;
      // Every completed touch gets the same quiet period. Only a full automatic
      // hold commits early; a released charge can still be followed by ink or stars.
      this.state=source?'WAITING':'DRAWING';
    }
    up(id,{cancelled=false,nowMs}={}){
      if(this.paused||this.pointerId===null||id!==this.pointerId)return false;
      if(cancelled){this.cancelPointer();return true;}
      if(this.advanceHold(0,nowMs))return true;
      const contact=this.holdFrame;
      const source=!this._hasDrawn&&this._contactAge<=TAP_SECONDS+1e-9?'tap'
        :contact?.ready?'hold':contact?.active?'release':this._hasDrawn?'draw':'release';
      this.finishPress(source);
      return true;
    }
    cancelPointer(){
      // Lifecycle cancellation must still release capture while animation is paused.
      this.pointerId=null;this._point=null;this._origin=null;this._holdAge=0;this._lastHoldMs=null;
      this._start=null;this._lastSample=null;this._contactAge=0;this._hasDrawn=false;
      if(this.state==='DRAWING'||(this.state==='WAITING'&&!this.committed)){
        this.state='DRAWING';this.elapsed=0;this._drawing=false;
        this.completionSource=null;this.releasePoint=null;
      }
    }
    step(dt,nowMs){
      if(this.paused||!Number.isFinite(dt)||dt<0)return;
      if(this.state==='DRAWING'&&this.pointerId!==null){
        this.advanceHold(dt,nowMs);
        return;
      }
      if(!this.duration)return;
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
