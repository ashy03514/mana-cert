/* SS cinders sampled from the reveal clock, so pause never loses their phase. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const MAX_SLOTS=96;
  class FireRankEmbers {
    static frames(width,height,{time=0,mana=0,box}={}){
      if(!box||!Number.isFinite(time)||!Number.isFinite(mana)||mana<999||
        ![width,height,box.x,box.y,box.width,box.height].every(Number.isFinite)||
        width<=0||height<=0||box.width<=0||box.height<=0)return [];
      const intensity=1,slots=68+intensity*18;
      const unit=box.width/2,cx=box.x+unit,rootY=box.y+box.height/2+unit*.66;
      const scale=Math.max(.45,Math.min(1.35,unit/183.45));
      // In landscape the flame owns the left column; cinders leave that column
      // instead of crossing the readout. Portrait cinders may cross both edges.
      const maxX=width>height*1.25?Math.min(width,box.x+box.width+unit*.08):width;
      const frames=[];
      for(let i=0;i<MAX_SLOTS;i++){
        const gate=clamp(slots-i);if(!gate)continue;
        const lifetime=1.35+hash(i+11)*1.0,gap=.12+hash(i+9)*.20;
        const period=lifetime+gap,offset=hash(i+21)*period;
        const clock=(Math.max(0,time)+offset)/period,cycle=Math.floor(clock);
        const age=(clock-cycle)*period;if(age<=0||age>=lifetime)continue;
        const life=age/lifetime,seed=i*41+cycle*97;
        const depth=.66+hash(seed+8)*.66,side=i%2?-1:1;
        const sourceX=cx+side*unit*(.12+hash(seed+1)*.53);
        const sourceY=rootY-unit*(.32+hash(seed+2)*.66);
        const outward=side*(16+hash(seed+3)*41)*scale*depth;
        const rise=(62+hash(seed+4)*69)*scale*depth;
        const lift=(11+hash(seed+5)*21)*scale;
        const swirl=(5+hash(seed+6)*12)*scale;
        const spin=2.2+hash(seed+7)*3.3,phase=hash(seed+10)*Math.PI*2;
        // Sideways eddies vary independently. Vertical speed stays upward even
        // at the slowest point of an eddy, while buoyancy accelerates the rise.
        const x=sourceX+outward*age+swirl*(Math.sin(phase+spin*age)-Math.sin(phase));
        const y=sourceY-rise*age-lift*age*age;
        const vx=outward+swirl*spin*Math.cos(phase+spin*age),vy=-rise-2*lift*age;
        const close=hash(i+31)>.91;
        const radius=(close?2.3+hash(i+32)*.7:.7+hash(i+32)*1.1)*scale*depth;
        const alpha=gate*smooth(age/.07)*(1-smooth((life-.70)/.30))*(.64+hash(i+13)*.31);
        const speed=Math.hypot(vx,vy),tail=Math.min(15*scale,radius*3+speed*.025);
        const tailX=x-vx/speed*tail,tailY=y-vy/speed*tail;
        // Culling uses the tail as well as the fragment. Never let a hot fleck
        // enter the space reserved below the flame, including its soft edge.
        if(alpha<.004||x+radius*3<0||x-radius*3>maxX||
          Math.max(y,tailY)+radius*3<0||Math.max(y,tailY)+radius*3>rootY-12)continue;
        frames.push({id:i,birth:cycle*period-offset,age,lifetime,x,y,vx,vy,
          sourceX,sourceY,radius,alpha,tailX,tailY,angle:Math.atan2(vy,vx),
          color:life<.48?'#ffbd59':life<.78?'#ff8c35':'#e54b21'});
      }
      return frames;
    }
    static draw(ctx,width,height,options){
      const frames=this.frames(width,height,options);if(!frames.length)return;
      ctx.save();
      try{
        ctx.globalCompositeOperation='source-over';
        for(const p of frames){
          const r=p.radius;
          ctx.globalAlpha=p.alpha*.31;ctx.strokeStyle=p.color;
          ctx.lineWidth=Math.max(.45,r*.62);ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(p.tailX,p.tailY);ctx.lineTo(p.x,p.y);ctx.stroke();
          ctx.globalAlpha=p.alpha*.12;ctx.fillStyle='#f65a20';
          ctx.beginPath();ctx.ellipse(p.x,p.y,r*2.4,r*1.65,p.angle,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=p.alpha*.80;ctx.fillStyle=p.color;
          ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.12,r*.67,p.angle,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=p.alpha;ctx.fillStyle='#ffe7a2';
          ctx.beginPath();ctx.ellipse(p.x,p.y,r*.51,r*.30,p.angle,0,Math.PI*2);ctx.fill();
        }
      }finally{ctx.restore();}
    }
  }
  root.FireRankEmbers=FireRankEmbers;
})(globalThis);
