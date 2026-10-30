/* Rank glints sampled from the reveal clock; no timers or result randomness. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const palette=['#fff1bf','#ffd183','#fff9e9'];
  const LIFETIME=1;
  class FireRankSparkles {
    static frames(width,height,{time=0,mana=0,box}={}){
      if(!box||!Number.isFinite(time)||!Number.isFinite(mana)||mana<900)return [];
      const ss=smooth((mana-950)/50),entry=.25+.75*smooth((mana-900)/40);
      const unit=box.width/2,cx=box.x+unit,rootY=box.y+box.height/2+unit*.66;
      const sizeScale=Math.max(.45,Math.min(1.35,unit/183.45));
      const upper=Math.max(68,rootY-unit*(1.55+ss*.64));
      const lower=rootY-12,cy=(upper+lower)/2;
      const rx=unit*(.74+ss*.32),ry=Math.max(8,(lower-upper)/2-28*sizeScale);
      const slots=8+ss*16,frames=[];
      for(let i=0;i<24;i++){
        const gate=clamp(slots-i);if(!gate)continue;
        // Visible life is exactly one second. Only the dark gap varies, so
        // independently staggered glints never acquire different lifetimes.
        const period=LIFETIME+.28+hash(i+3)*.35,offset=hash(i+19)*period;
        const clock=(Math.max(0,time)+offset)/period,cycle=Math.floor(clock);
        const age=(clock-cycle)*period;if(age<=0||age>=LIFETIME)continue;
        const life=age/LIFETIME;
        const expansion=smooth(life/.32)*(1-smooth((life-.32)/.68));
        const pulse=smooth(life/.10)*(1-smooth((life-.78)/.22));
        const alpha=pulse*gate*entry*(.64+.30*hash(i+8));if(alpha<.004)continue;
        const seed=i*31+cycle*71;
        const angle=i*2.39996323+(hash(seed+1)-.5)*.30;
        const edge=i%4!==0;
        const radial=edge?.72+hash(seed+2)*.22:.28+hash(seed+2)*.44;
        const maxRadius=(4+hash(i+5)*5)*(1+ss*.85)*sizeScale;
        const radius=maxRadius*expansion,glow=maxRadius*1.65;
        const rise=Math.min((24+hash(i+13)*18)*sizeScale,Math.max(0,lower-upper-glow*2));
        // Reserve the whole rising path using the peak size. Clamping the
        // animated size would pin a star at the top or move it back down.
        const x=cx+Math.cos(angle)*rx*radial;
        const startY=Math.max(upper+glow+rise,Math.min(lower-glow,cy+Math.sin(angle)*ry*radial));
        frames.push({id:i,birth:cycle*period-offset,age,lifetime:LIFETIME,
          x:Math.max(glow+2,Math.min(width-glow-2,x)),y:startY-life*rise,radius,alpha,
          angle:hash(i+7)*Math.PI*2+life*Math.PI*(.70+hash(i+11)*.60),
          color:palette[i%palette.length]});
      }
      return frames;
    }
    static draw(ctx,width,height,options){
      const frames=this.frames(width,height,options);if(!frames.length)return;
      ctx.save();ctx.globalCompositeOperation='source-over';
      for(const p of frames){
        const r=p.radius,c=Math.cos(p.angle),s=Math.sin(p.angle);
        const point=(x,y)=>[p.x+(x*c-y*s)*r,p.y+(x*s+y*c)*r];
        const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.65);
        glow.addColorStop(0,p.color+'64');glow.addColorStop(.28,p.color+'24');glow.addColorStop(1,p.color+'00');
        ctx.globalAlpha=p.alpha;ctx.fillStyle=glow;
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
