/* Persistent contact stars and their constellation. No input or outcome ownership. */
(function(root) {
  'use strict';
  const DEFAULT_COLORS=['#65eaff','#ce83ff','#ffffff'];
  const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  const rgb=color=>[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16)).join(',');
  class TapStars {
    constructor(createCanvas=()=>document.createElement('canvas'),settings={}) {
      this.createCanvas=createCanvas;
      this.width=this.height=1;
      this.maxStars=256;
      this.maxCaptureParticles=512;
      this.links=createCanvas();
      this.linkContext=this.links.getContext('2d');
      this.configure(settings);
      this.reset();
    }
    configure(settings={}) {
      const values=root.EffectSettings?root.EffectSettings.normalize(settings):settings;
      const colors=(values.starPalette||DEFAULT_COLORS).filter(color=>/^#[0-9a-f]{6}$/i.test(color));
      this.colors=colors.length?colors.slice(0,12):DEFAULT_COLORS.slice();
      this.sizeScale=clamp(Number.isFinite(values.starSize)?values.starSize/100:1,.5,2);
      // Tap feedback remains present when ambient sparkles are disabled.
      this.sprites=new Map();
    }
    reset() {
      this.stars=[];
      this.time=0;
      this.sequence=0;
      this.linksDirty=true;
    }
    get linkCount() { return this.stars.length*Math.max(0,this.stars.length-1)/2; }
    resize(width,height) {
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
      for(const star of this.stars){star.x*=width/this.width;star.y*=height/this.height;}
      this.width=width;this.height=height;
      // One bounded backing store for all connections; no per-link allocation.
      this.linkScale=Math.min(1,2048/Math.max(width,height));
      this.links.width=Math.max(1,Math.ceil(width*this.linkScale));
      this.links.height=Math.max(1,Math.ceil(height*this.linkScale));
      this.linksDirty=true;
    }
    add(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return false;
      const sequence=this.sequence++;
      const star={x:clamp(x,0,this.width),y:clamp(y,0,this.height),born:this.time,
        color:this.colors[sequence%this.colors.length],phase:sequence*2.39996323};
      if(this.stars.length===this.maxStars)this.stars.shift();
      this.stars.push(star);this.linksDirty=true;
      return star;
    }
    step(dt) {
      if(Number.isFinite(dt)&&dt>0)this.time+=Math.min(dt,.05);
    }
    _sprite(color) {
      if(this.sprites.has(color))return this.sprites.get(color);
      const sprite=this.createCanvas();sprite.width=sprite.height=128;
      const ctx=sprite.getContext('2d'),halo=rgb(color);
      const glow=ctx.createRadialGradient(64,64,0,64,64,60);
      glow.addColorStop(0,'rgba('+halo+',.55)');
      glow.addColorStop(.28,'rgba('+halo+',.2)');
      glow.addColorStop(1,'rgba('+halo+',0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(64,16);
      ctx.quadraticCurveTo(67,59,101,64);ctx.quadraticCurveTo(67,69,64,112);
      ctx.quadraticCurveTo(61,69,27,64);ctx.quadraticCurveTo(61,59,64,16);
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(64,64,3,0,Math.PI*2);ctx.fill();
      this.sprites.set(color,sprite);
      return sprite;
    }
    _drawLinks() {
      if(!this.linksDirty)return;
      const ctx=this.linkContext;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.links.width,this.links.height);
      ctx.setTransform(this.linkScale||1,0,0,this.linkScale||1,0,0);
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      ctx.lineCap='round';ctx.lineWidth=.85;ctx.strokeStyle='#a0c8ff';ctx.beginPath();
      for(let i=0;i<this.stars.length;i++){
        const a=this.stars[i];
        for(let j=0;j<i;j++){
          const b=this.stars[j];ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        }
      }
      ctx.stroke();this.linksDirty=false;
    }
    draw(ctx,alpha=1) {
      if(!this.stars.length||!Number.isFinite(alpha)||alpha<=0)return;
      this._drawLinks();
      ctx.save();ctx.globalCompositeOperation='source-over';
      // Dense constellations keep their complete graph without washing out ink.
      ctx.globalAlpha=clamp(alpha)*Math.max(.045,.3/Math.sqrt(Math.max(1,this.stars.length/4)));
      ctx.drawImage(this.links,0,0,this.links.width,this.links.height,0,0,this.width,this.height);
      for(const star of this.stars){
        const age=Math.max(0,this.time-star.born),entrance=smooth(age/.22);
        const pulse=.93+.07*Math.sin(this.time*2.2+star.phase);
        const size=(44+12*(1-entrance))*this.sizeScale*pulse;
        ctx.globalAlpha=clamp(alpha)*(.88+.12*pulse);
        ctx.drawImage(this._sprite(star.color),star.x-size/2,star.y-size/2,size,size);
      }
      ctx.restore();
    }
    captureParticles() {
      // Every star gets an exact source point. Remaining samples make the web
      // itself participate in the existing gather without an unbounded snapshot.
      const particles=this.stars.map(star=>({x:star.x,y:star.y,color:star.color,opacity:1}));
      const budget=Math.min(this.maxCaptureParticles-particles.length,this.linkCount*3);
      if(budget<=0)return particles;
      const stride=this.linkCount/budget;
      let edge=0,sample=0;
      for(let i=1;i<this.stars.length&&sample<budget;i++){
        const a=this.stars[i];
        for(let j=0;j<i&&sample<budget;j++,edge++){
          const b=this.stars[j];
          while(sample<budget&&Math.floor(sample*stride)===edge){
            const t=.25+.25*(sample%3);
            particles.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,color:a.color,opacity:.48});
            sample++;
          }
        }
      }
      return particles;
    }
  }
  root.TapStars=TapStars;
})(globalThis);
