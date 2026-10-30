/* Rare light interlude, sampled from RevealFlow's clock. No rank/outcome,
 * wall-clock timers or mutable particle pools: pause and replay are exact. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const p=clamp(v);return p*p*(3-2*p);};
  const seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const noise=t=>{const i=Math.floor(t);return seed(i)+(seed(i+1)-seed(i))*smooth(t-i);};
  function sample(elapsed){
    const time=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
    const gather=smooth(time/.4),rays=smooth((time-.32)/.78),opening=smooth((time-1.1)/.8);
    const handoff=smooth((time-1.9)/.6),live=1-handoff;
    return {time,gather,rays,opening,handoff,live,
      phase:time<.4?'光核凝聚':time<1.1?'聖光透出':time<1.9?'光幕展開':'羽翼顯現'};
  }
  function glow(ctx,x,y,radius,alpha,white=false){
    if(radius<=0||alpha<=0)return;
    const g=ctx.createRadialGradient(x,y,0,x,y,radius);
    g.addColorStop(0,white?'rgba(255,255,248,.98)':'rgba(255,241,179,.78)');
    g.addColorStop(.16,white?'rgba(255,254,227,.78)':'rgba(255,226,138,.35)');
    g.addColorStop(.48,'rgba(255,222,124,.12)');g.addColorStop(1,'rgba(255,225,157,0)');
    ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  function draw(ctx,{width,height,elapsed=0,target,layer='all'}){
    if(!ctx||!(width>0&&height>0))return;
    const s=sample(elapsed);if(s.live<=0)return;
    const cx=target?.x??width*.5,cy=target?.y??height*.4;
    const unit=Math.min(width,height),reach=Math.hypot(Math.max(cx,width-cx),Math.max(cy,height-cy));
    ctx.save();ctx.globalCompositeOperation='source-over';
    if(layer!=='foreground'){
    // Darkening focuses attention on the compressed arrival. It remains a
    // translucent layer so the original portal has a continuous handoff.
    ctx.globalAlpha=smooth(s.time/.20)*(1-s.opening)*.66*s.live;ctx.fillStyle='#060714';ctx.fillRect(0,0,width,height);
    // A soft, expanding illumination front brings in the approved gold/ivory
    // palette. During FORM it dissolves over the material's own background.
    if(s.opening>0){
      const radius=unit*.03+reach*1.75*s.opening;
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
      g.addColorStop(0,'rgba(233,207,132,1)');g.addColorStop(.46,'rgba(211,177,93,.98)');
      g.addColorStop(.75,'rgba(198,161,77,.9)');g.addColorStop(1,'rgba(198,161,77,0)');
      const backdropAlpha=layer==='background'?1:s.live;
      ctx.globalAlpha=backdropAlpha;ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
      const lower=ctx.createLinearGradient(0,cy,0,height);
      lower.addColorStop(0,'rgba(244,235,202,0)');lower.addColorStop(1,'rgba(244,235,202,1)');
      ctx.globalAlpha=smooth((s.opening-.3)/.7)*backdropAlpha;ctx.fillStyle=lower;ctx.fillRect(0,0,width,height);
    }
    }
    if(layer==='background'){ctx.restore();return;}
    ctx.globalCompositeOperation='screen';
    // Unequal apertures breathe independently; the ray fan never rotates as a
    // rigid wheel. Broad shoulders soften the visible shaft edges.
    for(let i=0;i<15;i++){
      const phase=seed(i+32),gate=smooth((s.time-(.30+phase*.48))/.44)*s.live;
      if(gate<=0)continue;
      const opening=noise(s.time*(.56+phase*.35)+i*7.9),pulse=.4+.6*opening;
      const angle=i===0?-Math.PI/2:i*TAU/14+(phase-.5)*.18+Math.sin(s.time*.8+i)*.014;
      const length=reach*(.45+seed(i+13)*.9)*(.7+s.rays*.3),spread=unit*(.008+opening*.027)*(1+s.opening*1.6);
      ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
      const g=ctx.createLinearGradient(0,0,length,0);g.addColorStop(0,'rgba(255,255,241,.95)');
      g.addColorStop(.18,'rgba(255,247,208,.64)');g.addColorStop(.58,'rgba(255,235,173,.20)');g.addColorStop(1,'rgba(255,239,190,0)');ctx.fillStyle=g;
      for(const [scale,alpha] of [[3.4,.035],[2.1,.055],[1.15,.10],[.45,.14]]){
        const half=spread*scale;ctx.globalAlpha=alpha*gate*pulse;
        ctx.beginPath();ctx.moveTo(0,-unit*.002);ctx.quadraticCurveTo(length*.42,-half*.45,length,-half);
        ctx.lineTo(length,half);ctx.quadraticCurveTo(length*.42,half*.45,0,unit*.002);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    // Fine inward dust keeps the pressure beat alive, then becomes outward
    // luminous dust in the opening. Trajectories are deterministic and staggered.
    for(let i=0;i<36;i++){
      const lane=seed(i+51),angle=i*2.399963+lane*.3,age=(s.time*.54+lane)%1;
      const radius=unit*((1-age)*(.13+seed(i+86)*.19)*(1-s.opening)+s.opening*(.05+age*.55));
      const x=cx+Math.cos(angle+s.time*.10)*radius,y=cy+Math.sin(angle+s.time*.10)*radius*.85;
      const alpha=Math.sin(age*Math.PI)*(.30+lane*.4)*s.live;
      glow(ctx,x,y,(1+lane*1.7)*Math.max(.7,unit/390),alpha,true);
    }
    const flutter=1+Math.sin(s.time*17)*.035+Math.sin(s.time*29)*.02;
    const core=unit*(.018-.007*s.gather+.013*s.rays+.018*s.opening)*flutter;
    glow(ctx,cx,cy,unit*(.17+s.rays*.22+s.opening*.2),(.45+s.rays*.25)*s.live);
    glow(ctx,cx,cy,core*4,(.65+s.rays*.3)*s.live,true);
    glow(ctx,cx,cy,core,s.live,true);
    ctx.restore();
  }
  root.LightAwakening=Object.freeze({sample,draw,duration:1.9,totalDuration:2.5});
})(globalThis);
