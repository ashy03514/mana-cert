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
      this.fog=createCanvas();this.fog.width=this.fog.height=128;
      const fogCtx=this.fog.getContext('2d'),fog=fogCtx.createRadialGradient(61,59,0,64,64,64);
      fog.addColorStop(0,'#9d93b350');fog.addColorStop(0.36,'#82799430');fog.addColorStop(0.72,'#69658310');fog.addColorStop(1,'#69658300');
      fogCtx.fillStyle=fog;fogCtx.fillRect(0,0,128,128);
    }
    draw(gather=0,resonance=0,quality=null,standby=null) {
      const c=this.ctx,f=this.field;
      c.clearRect(0,0,f.width,f.height);c.save();c.globalCompositeOperation='lighter';
      const fade=f.gathering?Math.max(0,1-Math.pow(gather,5)):1;
      const quiet=standby?standby.weight:0;
      if(quiet>0)this.nebula(standby,quality);
      // Uneven translucent clouds behind the dust; no rigid central disc.
      for(let i=0;i<(quality&&!quality.glow?1:3);i++) {
        const collapse=f.gathering?1-gather*gather:1;
        const r=Math.min(f.width*0.62,245)*collapse,x=f.width/2+Math.sin(f.time*0.3+i*2)*48*collapse,y=f.height/2+Math.cos(f.time*0.4+i)*55*collapse;
        c.globalAlpha=(0.08+resonance*0.08)*fade*(1-quiet);c.drawImage(this.sprites[i],x-r,y-r,r*2,r*2);
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
        const twinkle=0.65+Math.sin(f.time*(1+q.depth)*(1-quiet*0.7)+q.seed)*0.25;
        c.globalAlpha=twinkle*fade*(q.kind===2?0.09:0.55+resonance*0.3);
        c.globalAlpha*=1-quiet*(q.kind===1?(index%4===0?0.5:0.94):q.kind===2?0.55:0.38);
        c.globalAlpha*=q.idleAlpha??1;
        if(q.kind===2) {const r=22+q.depth*20;c.drawImage(this.sprites[q.tint],q.x-r,q.y-r,r*2,r*2);continue;}
        const r=(q.kind===1?5+q.depth*5:1.4+q.depth*2.1)*(1-quiet*0.23);
        c.drawImage(this.sprites[q.tint],q.x-r,q.y-r,r*2,r*2);
        if(q.kind===1) {
          c.fillStyle=this.colors[q.tint];c.beginPath();
          const size=(1.8+q.depth*1.8)*(1-quiet*0.4);
          c.moveTo(q.x,q.y-size*2);c.lineTo(q.x+size*0.5,q.y);c.lineTo(q.x,q.y+size*2);c.lineTo(q.x-size*0.5,q.y);c.closePath();c.fill();
        }
        if(Math.hypot(q.vx,q.vy)>140) {
          c.globalAlpha*=0.25;c.strokeStyle=this.colors[q.tint];c.lineWidth=q.depth;
          c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x-q.vx*0.035,q.y-q.vy*0.035);c.stroke();
        }
      }
      c.restore();
    }
    nebula(idle,quality){
      const c=this.ctx,f=this.field,t=idle.time,w=idle.weight;
      const radius=Math.min(f.width*0.48,220),cx=f.width/2,cy=f.height/2;
      // Normal compositing keeps the liquid translucent instead of adding a white core.
      c.save();c.globalCompositeOperation='source-over';c.beginPath();
      for(let j=0;j<=96;j++){
        const a=j/96*Math.PI*2;
        const r=radius*(0.86+0.018*Math.sin(t*0.48)+0.025*Math.sin(a*3+t*0.31)+0.014*Math.sin(a*5-t*0.23));
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*(1.035+0.012*Math.sin(t*0.37));
        if(j===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.closePath();c.globalAlpha=w*0.22;c.fillStyle='#65617e';c.fill();
      c.globalAlpha=w*0.12;c.strokeStyle='#b5b3ce';c.lineWidth=1.2;c.stroke();c.clip();
      const count=quality&&quality.name==='LOW'?3:5;
      for(let i=0;i<count;i++){
        const a=i*2.399+t*(0.045+i*0.009),spread=radius*0.52;
        const x=cx+Math.cos(a)*spread+Math.sin(t*0.19+i)*radius*0.1;
        const y=cy+Math.sin(a*1.13)*spread*0.8+Math.cos(t*0.15+i*2)*radius*0.09;
        const rx=radius*(0.65+0.08*Math.sin(t*0.36+i*1.4)),ry=radius*(0.77+0.1*Math.sin(t*0.28+i*2.1));
        c.globalAlpha=w*(0.24+Math.sin(t*0.43+i*1.7)*0.04);
        c.drawImage(this.fog,x-rx,y-ry,rx*2,ry*2);
      }
      // Offset reflections follow the surface; the center remains dim.
      for(let i=0;i<2;i++){
        c.beginPath();
        for(let j=0;j<=32;j++){
          const a=3.5+i*2.9+j/32*0.95+Math.sin(t*0.22+i)*0.08;
          const r=radius*(0.79+0.02*Math.sin(a*3+t*0.31));
          const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*1.04;
          if(j===0)c.moveTo(x,y);else c.lineTo(x,y);
        }
        c.globalAlpha=w*(0.09+0.025*Math.sin(t*0.39+i));
        c.strokeStyle=i?'#949ab5':'#c0bbd0';c.lineWidth=2.4;c.lineCap='round';c.stroke();
      }
      // Extremely faint short internal filaments; never a complete orbit/radar ring.
      const event=idle.event===2?Math.sin(Math.PI*Math.min(1,idle.age/2.6)):0;
      for(let i=0;i<3;i++){
        const envelope=Math.pow(Math.max(0,Math.sin(t*0.24+i*2)),4);
        c.globalAlpha=w*(envelope*0.022+event*0.035);c.strokeStyle='#c0b8d3';c.lineWidth=0.7;
        const a=t*0.055+i*2.1;
        c.beginPath();c.moveTo(cx+Math.cos(a)*radius*0.52,cy+Math.sin(a)*radius*0.42);
        c.bezierCurveTo(cx-radius*0.15,cy-radius*0.35,cx+radius*0.24,cy+radius*0.3,cx+Math.cos(a+1.4)*radius*0.5,cy+Math.sin(a+1.4)*radius*0.5);c.stroke();
      }
      c.restore();
      // Near-invisible ambient haze extends space above/below the central cloud.
      c.globalAlpha=w*0.09;
      c.drawImage(this.fog,cx-radius*1.5,cy-radius*2.1,radius*3,radius*4.2);
    }
  }
  root.MagicRenderer=MagicRenderer;
})(globalThis);
