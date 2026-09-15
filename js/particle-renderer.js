(function(root) {
  'use strict';
  class MagicRenderer {
    constructor(context, field, createCanvas = () => document.createElement('canvas')) {
      this.ctx=context;this.field=field;
      this.colors=['#ffe4a4','#d1b9f3','#a9e3dc'];
      // Small reusable glow textures: no shadowBlur, gradient creation, or pools allocated per frame.
      this.sprites=this.colors.map(color => {
        const canvas=createCanvas();canvas.width=canvas.height=64;
        const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);
        g.addColorStop(0,'#fff9ea');g.addColorStop(0.12,color);g.addColorStop(0.4,color+'60');g.addColorStop(1,color+'00');
        c.fillStyle=g;c.fillRect(0,0,64,64);return canvas;
      });
    }
    draw(gather=0,resonance=0,quality=null) {
      const c=this.ctx,f=this.field;
      c.clearRect(0,0,f.width,f.height);c.save();c.globalCompositeOperation='lighter';
      const fade=f.gathering?Math.max(0,1-Math.pow(gather,5)):1;
      // Uneven translucent clouds behind the dust; no rigid central disc.
      for(let i=0;i<(quality&&!quality.glow?1:3);i++) {
        const collapse=f.gathering?1-gather*gather:1;
        const r=Math.min(f.width*0.62,245)*collapse,x=f.width/2+Math.sin(f.time*0.3+i*2)*48*collapse,y=f.height/2+Math.cos(f.time*0.4+i)*55*collapse;
        c.globalAlpha=(0.08+resonance*0.08)*fade;c.drawImage(this.sprites[i],x-r,y-r,r*2,r*2);
      }
      const trails=f.trails;
      for(let i=0;i<trails.length;i++) {
        if(quality&&i%quality.trailStep)continue;
        const t=trails[(f.trailHead+i)%trails.length];if(t.life<=0)continue;
        const life=t.life/f.config.trailLife,width=t.width*(0.5+life*0.8);
        c.globalAlpha=life*life*(0.25+resonance*0.1)*fade;
        c.drawImage(this.sprites[t.stroke%3],t.x-width*2,t.y-width*2,width*4,width*4);
        // Three varying-width translucent layers make a liquid ribbon, not a plain line.
        const previous=trails[(f.trailHead+i+trails.length-1)%trails.length];
        if(i && previous.life>0 && previous.stroke===t.stroke && Math.hypot(t.x-previous.x,t.y-previous.y)<100) {
          c.lineCap='round';c.strokeStyle=this.colors[t.stroke%3];
          for(let layer=quality&&!quality.glow?1:0;layer<3;layer++) {
            c.globalAlpha=life*life*(layer===2?0.3:0.045)*fade;
            c.lineWidth=width*(layer===0?1.3:layer===1?0.48:0.07);
            c.beginPath();c.moveTo(previous.x,previous.y);
            c.quadraticCurveTo((previous.x+t.x)/2-t.vy*0.012,(previous.y+t.y)/2+t.vx*0.012,t.x,t.y);c.stroke();
          }
        }
      }
      for(let index=0;index<f.particles.length;index++) {
        const q=f.particles[index];
        if(quality&&q.kind===0&&index%quality.particleStep)continue;
        const twinkle=0.65+Math.sin(f.time*(1+q.depth)+q.seed)*0.25;
        c.globalAlpha=twinkle*fade*(q.kind===2?0.09:0.55+resonance*0.3);
        if(q.kind===2) {const r=22+q.depth*20;c.drawImage(this.sprites[q.tint],q.x-r,q.y-r,r*2,r*2);continue;}
        const r=q.kind===1?5+q.depth*5:1.4+q.depth*2.1;
        c.drawImage(this.sprites[q.tint],q.x-r,q.y-r,r*2,r*2);
        if(q.kind===1) {
          c.fillStyle=this.colors[q.tint];c.beginPath();
          const size=1.8+q.depth*1.8;
          c.moveTo(q.x,q.y-size*2);c.lineTo(q.x+size*0.5,q.y);c.lineTo(q.x,q.y+size*2);c.lineTo(q.x-size*0.5,q.y);c.closePath();c.fill();
        }
        if(Math.hypot(q.vx,q.vy)>140) {
          c.globalAlpha*=0.25;c.strokeStyle=this.colors[q.tint];c.lineWidth=q.depth;
          c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x-q.vx*0.035,q.y-q.vy*0.035);c.stroke();
        }
      }
      c.restore();
    }
  }
  root.MagicRenderer=MagicRenderer;
})(globalThis);
