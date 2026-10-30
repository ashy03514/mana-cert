/* Visual-only choreography of the existing portal pools. No outcome or input ownership. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const smoother=v=>{v=clamp(v);return v*v*v*(10+v*(-15+6*v));};
  const sample=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  class RevealAtmosphere {
    constructor(){this.reset();}
    reset(){this.state='DRAWING';this.progress=0;this.compression=0;this.mistCompression=0;this.burstRadius=1;}
    step(seconds,{state='DRAWING',progress=0,elapsed,burstRadius=100}={}){
      const dt=Number.isFinite(seconds)?Math.max(0,Math.min(.05,seconds)):0;
      this.state=state;this.progress=Number.isFinite(progress)?clamp(progress):0;
      this.burstRadius=Number.isFinite(burstRadius)?Math.max(.5,Math.min(1.6,burstRadius/100)):1;
      // Share the release envelope across continued drawing and a fresh wait:
      // a quick touch-and-release must not bypass the mist's speed limit.
      const total=this.compression+this.mistCompression;
      const releasedCompression=this.compression*Math.exp(-dt*14);
      const remaining=total*Math.exp(-dt*Math.min(14,3.3/Math.max(.001,total)));
      const releasedMist=Math.min(this.mistCompression,Math.max(0,remaining-releasedCompression));
      if(state==='WAITING'){
        // Both pools finish the first compression with wave two. During the
        // following half-second, only mist continues easing toward the centre.
        const waitingTime=Number.isFinite(elapsed)?Math.max(0,elapsed):this.progress*1.7;
        const anticipation=clamp(waitingTime/1.2);
        this.compression=Math.max(.26*smoother((anticipation-.7)/.3),releasedCompression);
        this.mistCompression=Math.max(.12*smooth((waitingTime-1.2)/.5),releasedMist);
      }else if(state==='DRAWING'){
        // Continuing a drawing gently releases the pressure instead of snapping.
        this.compression=releasedCompression;this.mistCompression=releasedMist;
      }else{this.compression=.26;this.mistCompression=.12;}
    }
    point(q,kind,width,height,target={x:width/2,y:height/2}){
      const cx=width/2,cy=height/2,baseX=q.x-cx,baseY=q.y-cy;
      if(this.state==='DRAWING'||this.state==='WAITING'){
        const compression=this.compression+(kind==='mist'?this.mistCompression:0);
        return {x:cx+baseX*(1-compression),y:cy+baseY*(1-compression),
          scale:1-compression*.18,alpha:1};
      }
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
      const radius=Math.min(width,height)*(.81+.24*sample(seed,5))*this.burstRadius;
      const startCompression=kind==='mist'?.38:.26;
      let x=baseX*(1-startCompression)*(1-burst)+Math.cos(angle)*radius*push*burst;
      let y=baseY*(1-startCompression)*(1-burst)+Math.sin(angle)*radius*push*burst;
      const phase=clamp((p-pullAt)/(end-pullAt));
      // Start with continuous velocity, but enter the visible screen earlier
      // than cubic ease-in. Otherwise nearly all inward travel happens offscreen.
      const pull=phase*phase*(2-phase);
      const turn=pull*(.32+.28*sample(seed,8)),c=Math.cos(turn),s=Math.sin(turn);
      const fall=(1-pull)**1.4;
      const px=(x*c-y*s)*fall,py=(x*s+y*c)*fall;
      const mist=kind==='mist';
      const resultX=cx+px+(target.x-cx)*pull,resultY=cy+py+(target.y-cy)*pull;
      const distance=Math.hypot(resultX-target.x,resultY-target.y);
      const flow=smooth(phase/.38);
      // Fade by distance to arrival, not by a large fraction of the journey.
      // Subpixel dots and prematurely transparent haze looked like no return.
      const arrival=smooth(distance/(Math.min(width,height)*(mist?.055:.025)||1));
      return {
        x:resultX,y:resultY,
        scale:(1-startCompression*.18+burst*(.12+depth*.2))*(mist?1-pull*.55:1+flow*.7-pull*.22),
        alpha:arrival,
        brightness:1+flow*(mist?2.1:1.5),
        // Stretch only the mist during inward travel; normal portal paint stays
        // identical. Direction is in CSS pixels, converted by the scene renderer.
        flow,stretch:mist?1+flow*1.25:1,
        heading:Math.atan2(target.y-resultY,target.x-resultX)
      };
    }
  }
  root.RevealAtmosphere=RevealAtmosphere;
})(globalThis);
