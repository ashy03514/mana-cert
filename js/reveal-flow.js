/* Shared reveal pacing. No timers, DOM, randomness, or certification outcome. */
(function(root) {
  'use strict';
  const ELEMENTS=Object.freeze(['fire','water','wind','earth','light','dark','lightning']);
  // Two inward waves finish at 1.2 s, then build pressure for another 0.5 s.
  const DURATIONS=Object.freeze({RETURN:.55,WAITING:1.7,GATHER:2.1,AWAKEN:1.9,FORM:.8,REVEAL:1.8,SETTLE:.8});
  const NEXT=Object.freeze({RETURN:'WAITING',WAITING:'GATHER',GATHER:'FORM',AWAKEN:'FORM',FORM:'REVEAL',REVEAL:'SETTLE',SETTLE:'DONE'});
  const HOLD_SECONDS=3;
  const RELEASE_SECONDS=1.2;
  const TAP_SECONDS=.35;
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
    get committed(){return this.state!=='DRAWING'&&(this.state!=='WAITING'||this.completionSource==='autoHold');}
    get ready(){return this.distance>0||this.tapCount>0||this.holdFrame?.ready===true||this.heldRelease;}
    get holdFrame(){
      if(this.pointerId===null||this._drawing||!this._origin)return null;
      return {x:this._origin.x,y:this._origin.y,age:this._holdAge,
        progress:clamp(this._holdAge/HOLD_SECONDS),active:this._holdAge>=.35,ready:this._holdAge+1e-9>=RELEASE_SECONDS};
    }
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
    down(id,x,y,nowMs){
      if(this.paused||this.pointerId!==null||id===null||id===undefined||
        !Number.isFinite(x)||!Number.isFinite(y)||
        (this.state!=='DRAWING'&&(this.state!=='WAITING'||this.committed)))return false;
      this.pointerId=id;this._point={x,y};this.state='DRAWING';this.elapsed=0;
      this._origin={x,y};this._holdAge=0;this._drawing=false;
      this._lastHoldMs=Number.isFinite(nowMs)?nowMs:null;
      this.completionSource=null;this.releasePoint=null;
      return true;
    }
    move(id,x,y,nowMs){
      if(this.paused||this.pointerId===null||id!==this.pointerId||
        !Number.isFinite(x)||!Number.isFinite(y))return false;
      // Ignore movement inside the original contact area. Repeated hand jitter
      // must neither manufacture a stroke nor restart the charging animation.
      if(!this._drawing){
        if(this.advanceHold(0,nowMs))return false;
        if(Math.hypot(x-this._origin.x,y-this._origin.y)<=14)return false;
        this._drawing=true;this._holdAge=0;
      }
      const distance=Math.hypot(x-this._point.x,y-this._point.y);
      if(distance<2)return false;
      this.distance=Math.min(1e6,this.distance+distance);this._point={x,y};
      return true;
    }
    advanceHold(dt,nowMs){
      // Contact duration uses real active time, including the interval between
      // the last animation frame and pointerup on a low-frame-rate device.
      if(Number.isFinite(nowMs)){
        if(this._lastHoldMs!==null&&nowMs<this._lastHoldMs)return;
        if(this._lastHoldMs!==null)this._holdAge+=(nowMs-this._lastHoldMs)/1000;
        this._lastHoldMs=nowMs;
      }else if(dt>0){
        this._holdAge+=dt;this._lastHoldMs=null;
      }
      if(this._holdAge+1e-9<HOLD_SECONDS)return false;
      this._holdAge=HOLD_SECONDS;
      this.finishPress('autoHold');
      return true;
    }
    finishPress(source){
      this.completionSource=source;
      if(source==='tap')this.lastTap=Object.freeze({x:this._origin.x,y:this._origin.y,sequence:++this.tapCount});
      this.releasePoint=source==='hold'||source==='autoHold'
        ?{x:this._origin.x,y:this._origin.y,age:this._holdAge}:null;
      this.pointerId=null;this._point=null;this._origin=null;this._holdAge=0;this._lastHoldMs=null;
      this.elapsed=0;
      // Every completed touch gets the same quiet period. Only a full automatic
      // hold commits early; a released charge can still be followed by ink or stars.
      this.state=source?'WAITING':'DRAWING';
    }
    up(id,{cancelled=false,nowMs}={}){
      if(this.paused||this.pointerId===null||id!==this.pointerId)return false;
      if(cancelled){this.cancelPointer();return true;}
      if(!this._drawing&&this.advanceHold(0,nowMs))return true;
      const source=this._drawing?'draw':this._holdAge<=TAP_SECONDS+1e-9?'tap':this.holdFrame?.ready?'hold':'release';
      this.finishPress(source);
      return true;
    }
    cancelPointer(){
      // Lifecycle cancellation must still release capture while animation is paused.
      this.pointerId=null;this._point=null;this._origin=null;this._holdAge=0;this._lastHoldMs=null;
      if(this.state==='DRAWING'||(this.state==='WAITING'&&!this.committed)){
        this.state='DRAWING';this.elapsed=0;this._drawing=false;
        this.completionSource=null;this.releasePoint=null;
      }
    }
    step(dt,nowMs){
      if(this.paused||!Number.isFinite(dt)||dt<0)return;
      if(this.state==='DRAWING'&&this.pointerId!==null&&!this._drawing){
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
