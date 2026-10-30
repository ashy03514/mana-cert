/* Three concentric pressure fronts, sampled from the shared reveal clock.
 * No timers, random state, pointer ownership, or changes to the reveal outcome. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const IN_START=.48,IN_DURATION=.36,OUT_DURATION=.42;
  class RevealShockwaves {
    static sample({state,elapsed=0,width,height}={}){
      if(!Number.isFinite(elapsed)||!Number.isFinite(width)||!Number.isFinite(height)||
        elapsed<0||width<=0||height<=0)return null;
      let id,direction,progress,radius,alpha;
      if(state==='WAITING'&&elapsed>=IN_START&&elapsed<1.2){
        id=elapsed<IN_START+IN_DURATION?1:2;direction='in';
        progress=clamp((elapsed-IN_START-(id-1)*IN_DURATION)/IN_DURATION);
        const pull=.18*progress+.82*progress*progress;
        radius=Math.min(width,height)*.82*(1-pull);
        alpha=smooth(progress/.12)*(1-smooth((progress-.91)/.09));
      }else if(state==='GATHER'&&elapsed<OUT_DURATION){
        id=3;direction='out';progress=clamp(elapsed/OUT_DURATION);
        radius=Math.hypot(width,height)*.60*(1-(1-progress)**2.4);
        alpha=smooth(progress/.075)*(1-smooth((progress-.32)/.68));
      }else return null;
      return {id,direction,progress,x:width/2,y:height/2,radius,alpha};
    }
    static draw(ctx,frame={}){
      const wave=this.sample(frame);
      if(!ctx||!wave||wave.alpha<.001||wave.radius<.2)return false;
      const {x,y,radius:r}=wave;
      const scale=Math.max(.65,Math.min(1.8,Math.min(frame.width,frame.height)/390));
      const inward=wave.direction==='in';
      // Airbrushed density with a broad, rounded peak and feathered edges.
      // No stroke, bright rim, or thin glint: both sides dissolve into the air.
      const sigma=Math.min(r*.28,(inward?18:24)*scale);
      const inner=Math.max(0,r-sigma*3.2),outer=r+sigma*3.2;
      const cutoff=Math.exp(-.5*3.2*3.2),strength=inward?.32:.29;
      ctx.save();
      try{
        ctx.globalCompositeOperation='source-over';ctx.globalAlpha=wave.alpha;
        const veil=ctx.createRadialGradient(x,y,inner,x,y,outer);
        for(let i=0;i<=32;i++){
          const position=i/32,distance=(inner+(outer-inner)*position-r)/sigma;
          const density=Math.max(0,(Math.exp(-.5*distance*distance)-cutoff)/(1-cutoff));
          veil.addColorStop(position,'rgba(166,231,255,'+(strength*density)+')');
        }
        ctx.fillStyle=veil;ctx.fillRect(x-outer,y-outer,outer*2,outer*2);
        return true;
      }finally{ctx.restore();}
    }
  }
  root.RevealShockwaves=RevealShockwaves;
})(globalThis);
