/* Visual-only choreography of the existing portal pools. No outcome or input ownership. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const smoother=v=>{v=clamp(v);return v*v*v*(10+v*(-15+6*v));};
  const sample=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  class RevealAtmosphere {
    constructor(){this.reset();}
    reset(){this.state='DRAWING';this.progress=0;this.compression=0;}
    step(seconds,{state='DRAWING',progress=0}={}){
      const dt=Number.isFinite(seconds)?Math.max(0,Math.min(.05,seconds)):0;
      this.state=state;this.progress=Number.isFinite(progress)?clamp(progress):0;
      if(state==='WAITING'){
        // Anticipation borrows the final 360 ms of the existing quiet period.
        // The ribbon stays alive and the outward burst still lasts 2.1 seconds.
        this.compression=Math.max(.26*smoother((this.progress-.7)/.3),this.compression*Math.exp(-dt*14));
      }else if(state==='DRAWING'){
        // Continuing a drawing gently releases the pressure instead of snapping.
        this.compression*=Math.exp(-dt*14);
      }else this.compression=.26;
    }
    point(q,kind,width,height,target={x:width/2,y:height/2}){
      const cx=width/2,cy=height/2,baseX=q.x-cx,baseY=q.y-cy;
      if(this.state==='DRAWING'||this.state==='WAITING')return {
        x:cx+baseX*(1-this.compression),y:cy+baseY*(1-this.compression),
        scale:1-this.compression*.18,alpha:1
      };
      if(this.state!=='GATHER')return {x:target.x,y:target.y,scale:.15,alpha:0};
      const p=this.progress,seed=(q.seed??q.angle??0)+(kind==='mist'?137:0);
      const depth=q.depth??sample(seed,1);
      const burstEnd=.50+.07*sample(seed,20)-.025*depth;
      const nudgeAt=burstEnd+.035+.025*sample(seed,21);
      const pullAt=nudgeAt+.09+.025*sample(seed,22);
      const end=.955+.035*sample(seed,12)-.015*depth;
      const u=clamp(p/burstEnd),burst=u*u*(10+u*(-20+u*(15-4*u)));
      const nudge=smoother((p-nudgeAt)/(pullAt-nudgeAt));
      const push=1+(.08+.06*sample(seed,23))*nudge;
      const angle=(q.angle??Math.atan2(baseY,baseX))+p*(.18+.28*sample(seed,24));
      // Start on the actual ellipse, then open into the same round space as the
      // magic spheres. Continue orbiting at maximum spread; never park a shell.
      const radius=Math.min(width,height)*(.81+.24*sample(seed,5));
      let x=baseX*.74*(1-burst)+Math.cos(angle)*radius*push*burst;
      let y=baseY*.74*(1-burst)+Math.sin(angle)*radius*push*burst;
      const pull=clamp((p-pullAt)/(end-pullAt))**3;
      const turn=pull*(.32+.28*sample(seed,8)),c=Math.cos(turn),s=Math.sin(turn);
      const fall=(1-pull)**1.4;
      const px=(x*c-y*s)*fall,py=(x*s+y*c)*fall;
      const mist=kind==='mist';
      return {
        x:cx+px+(target.x-cx)*pull,y:cy+py+(target.y-cy)*pull,
        scale:(.9532+burst*(.12+depth*.2))*(1-pull*.85),
        // Mist loses energy before overlap becomes dense at the centre.
        alpha:(mist?1-burst*.18:1)*(1-smooth((pull-(mist?.18:.62))/(mist?.72:.36)))
      };
    }
  }
  root.RevealAtmosphere=RevealAtmosphere;
})(globalThis);
