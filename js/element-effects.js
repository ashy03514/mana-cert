/* Six bounded, deterministic Canvas reveals. No result draws or private animation loops. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
  class ElementEffects {
    constructor(ctx,config,createCanvas=()=>document.createElement('canvas')) {
      this.ctx=ctx;this.config=config;
      this.glows={};
      for(const [element,color] of Object.entries(config.colors)) {
        const canvas=createCanvas();canvas.width=canvas.height=96;
        const c=canvas.getContext('2d'),g=c.createRadialGradient(48,48,0,48,48,48);
        g.addColorStop(0,'#fff9ed');g.addColorStop(0.15,color);g.addColorStop(0.4,color+'88');g.addColorStop(1,color+'00');
        c.fillStyle=g;c.fillRect(0,0,96,96);this.glows[element]=canvas;
      }
    }
    glow(element,x,y,r,alpha){if(r<=0)return;const c=this.ctx;c.globalAlpha=clamp(alpha);c.drawImage(this.glows[element],x-r,y-r,r*2,r*2);}
    star(x,y,r){const c=this.ctx;c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*0.2,y-r*0.2);c.lineTo(x+r,y);c.lineTo(x+r*0.2,y+r*0.2);c.lineTo(x,y+r);c.lineTo(x-r*0.2,y+r*0.2);c.lineTo(x-r,y);c.lineTo(x-r*0.2,y-r*0.2);c.closePath();c.fill();}
    draw(width,height,element,elapsed){
      const c=this.ctx;c.clearRect(0,0,width,height);
      if(!this.glows[element])return;
      const p=clamp(elapsed/this.config.duration),fade=1-clamp((p-0.7)/0.3);
      const r=Math.min(width*0.48,250),t=elapsed/1000;
      c.save();c.translate(width/2,height/2);c.globalCompositeOperation='lighter';
      c.fillStyle=this.config.colors[element];c.strokeStyle=this.config.colors[element];c.lineCap='round';
      this.glow(element,0,0,r*(0.6+Math.sin(p*Math.PI)*0.8),0.23*fade);
      if(element==='火') {
        for(let i=0;i<80;i++) {
          const a=i*2.399,age=clamp(p*1.7-(i%7)*0.045),radius=r*1.8*age;
          const x=Math.cos(a)*radius,y=Math.sin(a)*radius-age*age*80;
          c.globalAlpha=(1-age)*fade;c.lineWidth=1+i%3;
          c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-Math.cos(a)*25,y+12,x-Math.cos(a)*(15+age*45),y-Math.sin(a)*25);c.stroke();
          this.glow(element,x,y,4+i%4,(1-age)*fade);
        }
      } else if(element==='水') {
        for(let i=0;i<5;i++) {
          const age=clamp(p*1.7-i*0.13);if(!age)continue;
          c.globalAlpha=(1-age)*fade*0.65;c.lineWidth=2+(1-age)*7;
          c.beginPath();c.ellipse(0,0,r*age*1.6,r*age*(1.25+Math.sin(t*3+i)*0.06),i*0.15,0,TAU);c.stroke();
        }
        for(let i=0;i<32;i++) {const a=i*2.399,d=r*(0.2+p)*((i%5+2)/7);this.glow(element,Math.cos(a)*d,Math.sin(a)*d+p*p*45,4+i%5,fade*0.8);}
      } else if(element==='風') {
        for(let arm=0;arm<7;arm++) {
          c.globalAlpha=fade*(0.18+arm*0.035);c.lineWidth=1+arm%3;c.beginPath();
          for(let i=0;i<=55;i++){const k=i/55,a=arm*TAU/7+k*4.5-t*3,d=r*k*(0.5+p);const x=Math.cos(a)*d,y=Math.sin(a)*d*0.8;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();
        }
        for(let i=0;i<30;i++){const a=i*2.399-t*3,d=r*(i%10)/10;this.glow(element,Math.cos(a)*d,Math.sin(a)*d*0.8,3+i%3,fade*0.6);}
      } else if(element==='土') {
        const grow=1-Math.pow(1-clamp(p*3),3);
        for(let i=0;i<14;i++) {
          c.save();c.rotate(i*TAU/14);c.translate(0,-r*0.64*grow);
          const size=(15+i%4*8)*grow;c.globalAlpha=fade*0.65;c.lineWidth=1.5;c.beginPath();
          c.moveTo(0,-size);c.lineTo(size*0.48,0);c.lineTo(0,size*0.7);c.lineTo(-size*0.48,0);c.closePath();c.fill();c.stroke();
          c.globalAlpha=fade*0.7;c.strokeStyle='#fff1c6';c.beginPath();c.moveTo(0,-size);c.lineTo(0,size*0.7);c.stroke();c.restore();
        }
        c.globalAlpha=fade*0.35;c.lineWidth=3;c.beginPath();c.arc(0,0,r*0.85*grow,0,TAU);c.stroke();
      } else if(element==='光') {
        for(let i=0;i<7;i++){c.globalAlpha=fade*(0.04+Math.sin(p*Math.PI)*0.08);c.fillRect((i-3)*r*0.2-6,-height/2,12,height);}
        for(let i=0;i<85;i++) {
          const a=i*2.399,d=r*Math.sqrt((i+1)/85)*(0.5+p),alpha=fade*(0.35+Math.sin(t*5+i)*0.3);
          c.globalAlpha=alpha;this.star(Math.cos(a)*d,Math.sin(a)*d,2+i%6);
        }
        this.glow(element,0,0,r*(0.3+p),Math.max(0,1-p*3));
      } else if(element==='暗') {
        c.globalCompositeOperation='source-over';c.globalAlpha=fade*0.55;c.fillStyle='#080510';c.beginPath();c.arc(0,0,r*0.7,0,TAU);c.fill();
        // Interlocking capsule links sweep across the core; cracks curl inward behind them.
        c.strokeStyle='#b980ee';
        for(let chain=0;chain<4;chain++) {
          c.save();c.rotate(-0.65+chain*0.45);c.translate((chain-1.5)*r*0.28,0);
          const head=-height/2+clamp(p*2.8-chain*0.12)*height*1.4;
          for(let y=-height/2;y<head;y+=29){c.globalAlpha=fade*0.78;c.lineWidth=4;c.beginPath();c.ellipse(Math.sin(y*0.025)*5,y,8,17,(Math.round(y/29)%2)*0.45,0,TAU);c.stroke();}
          c.restore();
        }
        c.globalCompositeOperation='lighter';c.strokeStyle='#7648a8';
        for(let i=0;i<12;i++){const a=i*TAU/12-t*0.6;c.globalAlpha=fade*0.6;c.lineWidth=1.5;c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a+0.18)*r*0.55,Math.sin(a+0.18)*r*0.55);c.lineTo(Math.cos(a)*r*0.17,Math.sin(a)*r*0.17);c.stroke();}
      }
      c.restore();
    }
  }
  root.ElementEffects=ElementEffects;
})(globalThis);
