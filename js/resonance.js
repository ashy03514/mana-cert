/* Interaction pacing only. No dependency on random outcomes. Times are seconds. */
(function(root) {
  'use strict';
  class Resonance {
    constructor(config,timing) { this.config=config;this.timing=timing;this.reset(); }
    reset() { this.elapsed=0;this.energy=0;this.distanceEnergy=0;this.touchEnergy=0;this.value=0;this.complete=false; }
    touch() { if(!this.complete)this.touchEnergy=Math.min(this.config.touchCap,this.touchEnergy+this.config.touchGain); }
    move(distance) {
      if(!this.complete && Number.isFinite(distance))
        this.distanceEnergy=Math.min(this.config.distanceCap,this.distanceEnergy+Math.max(0,distance)*this.config.distanceRate);
    }
    step(dt,pointer) {
      if(this.complete || !Number.isFinite(dt) || dt<=0) return this.complete;
      this.elapsed+=dt;
      const held=pointer.id!==null;
      this.energy+=dt*(this.config.passiveRate+(held?this.config.heldRate:0)+
        (held?Math.min(1,Math.abs(pointer.turn)/4)*this.config.turnRate:0));
      const score=this.energy+this.distanceEnergy+this.touchEnergy;
      const max=this.timing.interactionMax/1000,min=this.timing.interactionMin/1000;
      this.complete=this.elapsed>=max || (this.elapsed>=min && score>=1);
      // A gentle time floor ensures even a single tap awakens the whole seal by the fallback.
      const p=Math.min(1,this.elapsed/max), floor=p*p*(3-2*p);
      this.value=this.complete?1:Math.min(0.985,Math.max(score,floor));
      return this.complete;
    }
  }
  root.Resonance=Resonance;
})(globalThis);
