/* Rank glints sampled from the reveal clock; no timers or result randomness. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const palette=['#fff1bf','#ffd183','#fff9e9'];
  const LIFETIME=1;
  class FireRankSparkles {
    static referenceWidth(width,height){
      // Match the fire material's screen-space unit, not another element's
      // enlarged volume window. Keep the standalone renderer dependency-free.
      return Math.max(100,Math.min(width*1.27,height-250,660))/1.35;
    }
    static manaForRank(rank){return rank==='SS'?999:rank==='S'?950:0;}
    static samples({time=0,mana=0,referenceWidth=366.9,sizeScale:rankSize=1}={}){
      if(!Number.isFinite(time)||!Number.isFinite(mana)||mana<900||rankSize<=0)return [];
      const ss=smooth((mana-950)/49),entry=.25+.75*smooth((mana-900)/40);
      const sizeScale=Math.max(.45,Math.min(1.35,(referenceWidth/2)/183.45));
      const slots=8+ss*16,frames=[];
      for(let i=0;i<24;i++){
        const gate=clamp(slots-i);if(!gate)continue;
        const period=LIFETIME+.28+hash(i+3)*.35,offset=hash(i+19)*period;
        const clock=(Math.max(0,time)+offset)/period,cycle=Math.floor(clock);
        const age=(clock-cycle)*period;if(age<=0||age>=LIFETIME)continue;
        const life=age/LIFETIME;
        const expansion=smooth(life/.32)*(1-smooth((life-.32)/.68));
        const pulse=smooth(life/.10)*(1-smooth((life-.78)/.22));
        const alpha=pulse*gate*entry*(.64+.30*hash(i+8));if(alpha<.004)continue;
        const maxRadius=(4+hash(i+5)*5)*(1+ss*.85)*sizeScale*.75*.85*clamp(rankSize);
        frames.push({id:i,seed:i*31+cycle*71,birth:cycle*period-offset,age,lifetime:LIFETIME,
          radius:maxRadius*expansion,maxRadius,glow:maxRadius*1.65,
          rise:(24+hash(i+13)*18)*sizeScale,alpha,
          angle:hash(i+7)*Math.PI*2+life*Math.PI*(.70+hash(i+11)*.60)});
      }
      return frames;
    }
    static frames(width,height,{time=0,mana=0,box,element='fire',sizeScale:rankSize=1}={}){
      if(!box||!Number.isFinite(time)||!Number.isFinite(mana)||mana<900||rankSize<=0)return [];
      const ss=smooth((mana-950)/49),entry=.25+.75*smooth((mana-900)/40);
      const unit=box.width/2,cx=box.x+unit,rootY=box.y+box.height/2+unit*.66;
      const sizeScale=Math.max(.45,Math.min(1.35,unit/183.45));
      const upper=Math.max(68,rootY-unit*(1.55+ss*.64));
      const lower=rootY-12,cy=(upper+lower)/2;
      const rx=unit*(.74+ss*.32),ry=Math.max(8,(lower-upper)/2-28*sizeScale);
      const frames=[];
      for(const p of this.samples({time,mana,referenceWidth:box.width,sizeScale:rankSize})){
        const {id:i,seed,age,radius,alpha,glow}=p;
        const life=age/LIFETIME;
        const angle=i*2.39996323+(hash(seed+1)-.5)*.30;
        const edge=i%4!==0;
        const radial=edge?.72+hash(seed+2)*.22:.28+hash(seed+2)*.44;
        const rise=Math.min(p.rise,Math.max(0,lower-upper-glow*2));
        // Reserve the whole rising path using the peak size. Clamping the
        // animated size would pin a star at the top or move it back down.
        const x=cx+Math.cos(angle)*rx*radial;
        const startY=Math.max(upper+glow+rise,Math.min(lower-glow,cy+Math.sin(angle)*ry*radial));
        frames.push({id:i,birth:p.birth,age,lifetime:LIFETIME,
          x:Math.max(glow+2,Math.min(width-glow-2,x)),y:startY-life*rise,radius,alpha,
          angle:p.angle,
          color:(element==='water'?['#b5f3ff','#81cfff','#f1fcff']:palette)[i%palette.length]});
      }
      return frames;
    }
    static draw(ctx,width,height,options){
      this.drawFrames(ctx,this.frames(width,height,options));
    }
    static drawFrames(ctx,frames,opacity=1){
      if(!frames.length||opacity<=0)return;
      ctx.save();ctx.globalCompositeOperation='source-over';
      for(const p of frames){
        const r=p.radius,c=Math.cos(p.angle),s=Math.sin(p.angle);
        const point=(x,y)=>[p.x+(x*c-y*s)*r,p.y+(x*s+y*c)*r];
        const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.65);
        glow.addColorStop(0,p.color+'64');glow.addColorStop(.28,p.color+'24');glow.addColorStop(1,p.color+'00');
        ctx.globalAlpha=p.alpha*clamp(opacity);ctx.fillStyle=glow;
        ctx.fillRect(p.x-r*1.65,p.y-r*1.65,r*3.3,r*3.3);
        ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(...point(0,-1));
        ctx.quadraticCurveTo(...point(.10,-.10),...point(1,0));
        ctx.quadraticCurveTo(...point(.10,.10),...point(0,1));
        ctx.quadraticCurveTo(...point(-.10,.10),...point(-1,0));
        ctx.quadraticCurveTo(...point(-.10,-.10),...point(0,-1));
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
  }
  root.FireRankSparkles=FireRankSparkles;
})(globalThis);
