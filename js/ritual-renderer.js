/* Progressive seal and liquid core. One existing canvas; cached core textures. */
(function(root) {
  'use strict';
  const TAU=Math.PI*2;
  const ELEMENT_COLORS={火:'#b24a2c',水:'#2d6d8c',風:'#2f7a5c',土:'#7c5c2e',光:'#f6e7a8',暗:'#3b2b55'};
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  class RitualRenderer {
    constructor(ctx,createCanvas=()=>document.createElement('canvas')) {
      this.ctx=ctx;
      this.coreTexture=this.texture(createCanvas,'#b78bdd','#edc981');
      this.hotTexture=this.texture(createCanvas,'#fff4d8','#ffffff');
    }
    texture(createCanvas,inner,outer) {
      const canvas=createCanvas();canvas.width=canvas.height=256;
      const c=canvas.getContext('2d'),g=c.createRadialGradient(112,105,5,128,128,128);
      g.addColorStop(0,'#fffbea');g.addColorStop(0.2,inner);g.addColorStop(0.5,outer+'c0');g.addColorStop(1,outer+'00');
      c.fillStyle=g;c.fillRect(0,0,256,256);return canvas;
    }
    draw(width,height,state,resonance,progress,time,element) {
      const c=this.ctx;c.clearRect(0,0,width,height);
      if(state==='SETTINGS'||state==='RESULT'||state==='MANA_SCAN'||state==='RANK_CONFIRM')return;
      c.save();c.translate(width/2,height/2);
      const gather=state==='GATHER',reveal=state==='ELEMENT_REVEAL';
      const gathering=gather||reveal;
      this.seal(Math.min(width*0.41,height*0.28,195),resonance,reveal?1:gather?progress:0,time,gathering);
      if(gather||reveal)this.core(Math.min(width*0.145,62),gather?progress:1,time,reveal?progress:0,width,height,element);
      c.restore();
    }
    seal(radius,value,progress,time,gathering) {
      if(value<=0)return;
      const c=this.ctx,fade=gathering?1-ease(progress):1;
      c.save();c.globalCompositeOperation='lighter';c.strokeStyle='#e8d3a3';c.lineCap='round';
      const shrink=gathering?1-ease(progress)*0.9:1;c.scale(shrink,shrink);
      // Uneven arcs appear first; ornamental marks and the outer petal structure wake later.
      for(let layer=0;layer<3;layer++) {
        const awake=ease((value-layer*0.25)/0.45);
        if(awake<=0)continue;
        const r=radius*(0.69+layer*0.15);
        c.globalAlpha=awake*fade*(0.22+layer*0.07);c.lineWidth=layer===0?1.5:0.8;
        c.beginPath();
        for(let side=0;side<3;side++) {
          const angle=side*TAU/3+time*(layer%2?-0.035:0.025);
          c.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);
          c.arc(0,0,r,angle,angle+TAU/3*awake*0.97);
        }
        c.stroke();
      }
      const runes=ease((value-0.3)/0.5);
      for(let i=0;i<12;i++) {
        const a=i*TAU/12+time*0.018;
        const local=ease(runes*1.7-i/18);
        if(!local)continue;
        c.save();c.rotate(a);c.translate(0,-radius*0.88);
        c.globalAlpha=local*fade*0.65;c.lineWidth=1;
        c.beginPath();c.moveTo(-3,-5);c.lineTo(3,0);c.lineTo(-3,5);
        c.moveTo(0,-7);c.lineTo(0,7);if(i%2){c.moveTo(-4,2);c.lineTo(4,2);}c.stroke();c.restore();
      }
      const petals=ease((value-0.65)/0.35);
      if(petals>0) {
        c.globalAlpha=petals*fade*0.28;c.lineWidth=1;
        for(let i=0;i<6;i++) {
          c.save();c.rotate(i*TAU/6);c.beginPath();c.moveTo(0,-radius*0.97);
          c.bezierCurveTo(radius*0.32,-radius*0.66,radius*0.32,-radius*0.43,0,-radius*0.29);
          c.bezierCurveTo(-radius*0.32,-radius*0.43,-radius*0.32,-radius*0.66,0,-radius*0.97);
          c.stroke();c.restore();
        }
      }
      c.restore();
    }
    core(base,progress,time,reveal,width,height,element) {
      const c=this.ctx,p=clamp(progress),birth=ease((p-0.08)/0.82);
      if(!birth)return;
      const expansion=1+ease(reveal)*Math.hypot(width,height)/base*0.58;
      const radius=base*(0.12+birth*0.88)*expansion;
      c.save();c.globalAlpha=birth;
      c.globalCompositeOperation='lighter';
      c.drawImage(this.coreTexture,-radius*2.6,-radius*2.6,radius*5.2,radius*5.2);
      c.globalCompositeOperation='source-over';
      c.beginPath();
      for(let i=0;i<=96;i++) {
        const a=i/96*TAU;
        const r=radius*(1+0.055*Math.sin(a*3+time*2)+0.033*Math.sin(a*5-time*2.7)+0.017*Math.sin(a*9+time));
        if(i)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);else c.moveTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      c.closePath();c.strokeStyle='#f5d99b';c.lineWidth=1.2;c.stroke();c.save();c.clip();
      // Reveals keep their existing element palette; new six-element FX land in stage 4.
      c.fillStyle=reveal>0 && element ? ELEMENT_COLORS[element] : '#443158';c.fillRect(-radius*1.2,-radius*1.2,radius*2.4,radius*2.4);
      c.globalCompositeOperation='lighter';
      for(let i=0;i<3;i++) {
        c.save();c.rotate(time*(i%2?-0.5:0.4)+i*2);
        c.globalAlpha=birth*(0.65+i*0.07);
        c.drawImage(this.coreTexture,-radius*1.25+Math.sin(time+i)*radius*0.15,-radius*1.1,radius*2.5,radius*2.2);
        c.restore();
      }
      c.strokeStyle='#fff0ca';c.lineWidth=Math.max(0.7,radius*0.015);
      for(let i=0;i<5;i++) {
        c.save();c.rotate(time*(0.3+i*0.09)+i*1.3);c.globalAlpha=birth*0.2;c.beginPath();
        c.ellipse(0,radius*0.1,radius*0.83,radius*(0.22+i*0.08),0,0,TAU);c.stroke();c.restore();
      }
      for(let i=0;i<16;i++) {
        const a=i*2.399+time*(0.3+i*0.035),r=radius*(0.18+(i%5)*0.14),s=Math.max(1,radius*0.04);
        c.globalAlpha=birth*0.7;c.drawImage(this.hotTexture,Math.cos(a)*r-s,Math.sin(a)*r-s,s*2,s*2);
      }
      c.globalAlpha=birth;c.drawImage(this.hotTexture,-radius*0.55,-radius*0.55,radius*1.1,radius*1.1);
      c.restore();
      c.restore();
    }
  }
  root.RitualRenderer=RitualRenderer;
})(globalThis);
