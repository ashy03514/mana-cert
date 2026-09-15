/* Active-time clock and cancellable sequences pause together when the page hides. */
(function(root){
  'use strict';
  class ActiveTimeline {
    constructor(now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout) {
      // Call injected host APIs as functions, never with ActiveTimeline as `this`.
      // Window timers can otherwise throw Illegal invocation in browsers.
      this.read=()=>now();
      this.schedule=(fn,ms)=>schedule(fn,ms);
      this.cancel=id=>cancel(id);
      this.offset=0;this.pausedAt=null;
      this.tasks=new Map();this.serial=0;
    }
    now(){return (this.pausedAt===null?this.read():this.pausedAt)-this.offset;}
    set(fn,delay){const id=++this.serial,task={fn,due:this.now()+delay,handle:null};this.tasks.set(id,task);this.arm(id,task);return id;}
    arm(id,task){
      if(this.pausedAt!==null)return;
      task.handle=this.schedule(()=>{
        if(!this.tasks.has(id)||this.pausedAt!==null)return;
        this.tasks.delete(id);task.fn();
      },Math.max(0,task.due-this.now()));
    }
    clear(){for(const task of this.tasks.values())this.cancel(task.handle);this.tasks.clear();}
    pause(){if(this.pausedAt!==null)return;this.pausedAt=this.read();for(const task of this.tasks.values())this.cancel(task.handle);}
    resume(){if(this.pausedAt===null)return;this.offset+=this.read()-this.pausedAt;this.pausedAt=null;for(const [id,task] of this.tasks)this.arm(id,task);}
  }
  const PROFILES=Object.freeze([
    Object.freeze({name:'LOW',dpr:1,particleStep:2,trailStep:2,glow:false}),
    Object.freeze({name:'NORMAL',dpr:1.35,particleStep:1,trailStep:1,glow:false}),
    Object.freeze({name:'HIGH',dpr:1.75,particleStep:1,trailStep:1,glow:true})
  ]);
  class AdaptiveQuality {
    constructor(width,height,dpr){this.level=width*height*Math.min(dpr,1.75)**2>1500000?1:2;this.resetSamples();}
    get profile(){return PROFILES[this.level];}
    resetSamples(){this.slow=0;this.fast=0;this.cooldown=0;}
    observe(ms){
      if(!Number.isFinite(ms)||ms<=0||ms>250)return false;
      this.cooldown=Math.max(0,this.cooldown-ms);
      this.slow=ms>24?this.slow+ms:Math.max(0,this.slow-ms*2);
      this.fast=ms<18?this.fast+ms:0;
      if(this.cooldown)return false;
      let next=this.level;
      if(this.slow>=1800)next=Math.max(0,next-1);
      else if(this.fast>=12000)next=Math.min(2,next+1);
      if(next===this.level)return false;
      this.level=next;this.resetSamples();this.cooldown=4000;return true;
    }
  }
  root.ActiveTimeline=ActiveTimeline;root.AdaptiveQuality=AdaptiveQuality;
})(globalThis);
