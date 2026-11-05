/* Presentation only. Observe RevealFlow without controlling input or results. */
(function (root) {
  'use strict';
  const copy = Object.freeze({sensed:'感應到魔力波動', drawing:'正在解析魔力軌跡',
    holding:'魔力持續注入中', resonance:'共鳴已建立', gathering:'正在凝聚魔力'});
  const FADE = .25, MINIMUM = .8;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t=clamp(value); return t*t*(3-2*t); };

  class Model {
    constructor() { this.reset(); }
    reset() {
      this.active=false; this.key=''; this.previous=''; this.previousGuide=false;
      this.time=0; this.age=0; this.mixAge=0; this.visibility=0; this.energy=0;
      this.committed=false; this.announced=false;
    }
    start(guide='') {
      if (this.active) return;
      this.reset(); this.active=true; this.key='sensed'; this.previous=guide;
      this.previousGuide=Boolean(guide); this.visibility=1;
    }
    step(delta, flow) {
      if (!this.active || flow.paused || !Number.isFinite(delta) || delta<0) return;
      if (!['DRAWING','RETURN','WAITING','GATHER'].includes(flow.state)) { this.reset(); return; }
      // Use the same bounded, active frame time as RevealFlow. No wall-clock timers.
      const dt=Math.min(delta,.05);
      this.time+=dt; this.age+=dt; this.mixAge+=dt;
      const hold=flow.holdFrame;
      const locked=flow.state==='RETURN' || (flow.state==='WAITING' && flow.heldRelease) || flow.state==='GATHER';
      this.committed ||= locked;
      const idle=flow.state==='DRAWING' && flow.pointerId===null;
      let desired=this.key;
      if (this.committed) desired=!this.announced || (this.key==='resonance' && this.age<MINIMUM) ? 'resonance' : 'gathering';
      else if (!idle) desired=hold ? (hold.active?'holding':'sensed') : 'drawing';
      if (desired!==this.key && this.age+1e-9>=MINIMUM) {
        this.previous=copy[this.key]; this.previousGuide=false;
        this.key=desired; this.age=0; this.mixAge=0;
        if (desired==='resonance') this.announced=true;
      }
      // A cancelled gesture / short tap fades quietly; it never claims success.
      const fading=idle && this.age>=MINIMUM;
      this.visibility=clamp(this.visibility+(fading?-1:1)*dt/FADE);
      if (flow.state==='GATHER') this.visibility=Math.min(this.visibility,smooth((flow.gatherDuration-flow.elapsed)/FADE));
      this.energy+=(clamp(hold?.progress || (this.committed ? .8 : .12))-this.energy)*Math.min(1,dt*4);
      if (fading && this.visibility<=0) this.reset();
    }
    frame() {
      return {active:this.active,key:this.key,text:copy[this.key]||'',previous:this.previous,
        previousGuide:this.previousGuide,mix:smooth(this.mixAge/FADE),opacity:this.visibility,
        time:this.time,energy:this.energy};
    }
  }

  class View {
    constructor(element) {
      this.element=element; this.model=new Model();
      this.current=element.querySelector('[data-prompt-current]');
      this.previous=element.querySelector('[data-prompt-previous]');
      this.live=element.querySelector('[data-prompt-live]');
      this.reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.render();
    }
    start() {
      this.model.start(); this.render();
    }
    reset() { this.model.reset(); this.render(); }
    step(dt,flow) { this.model.step(dt,flow); this.render(); }
    render() {
      const frame=this.model.frame(),element=this.element;
      element.hidden=!frame.active;
      element.dataset.promptState=frame.key;
      if (this.live.textContent!==frame.text) this.live.textContent=frame.text;
      if (!frame.active) return;
      if (this.current.textContent!==frame.text) this.current.textContent=frame.text;
      if (this.previous.textContent!==frame.previous) this.previous.textContent=frame.previous;
      this.previous.classList.toggle('interactionPromptGuide',frame.previousGuide);
      const breath=this.reduced?.matches ? 1 : .91+.09*Math.sin(frame.time*2.1);
      element.style.opacity=String(frame.opacity);
      this.current.style.opacity=String(frame.mix*breath);
      this.previous.style.opacity=String(1-frame.mix);
      element.style.setProperty('--status-glow',(10+frame.energy*7)+'px');
      element.style.setProperty('--status-line-alpha',String(frame.mix*breath*(.3+frame.energy*.28)));
      element.style.setProperty('--status-line-scale',String(.72+frame.energy*.28));
    }
  }
  root.InteractionPrompt=Object.freeze({Model,View,copy});
})(globalThis);
