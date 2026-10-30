/* Deterministic 3D foam/spray sampled from the ocean's existing active clock. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,FRONTS=5,FOAM=560,DROPS=32,MIST=10;
  const travelLength=Math.hypot(.68,.74),DX=.68/travelLength,DY=.74/travelLength;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{const p=clamp((v-a)/(b-a));return p*p*(3-2*p);};
  const hash=n=>{
    let x=n|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);
    return ((x^(x>>>16))>>>0)/4294967296;
  };
  function front(side,time,lane){
    return time*.38+Math.sin(side*7.7+time*.47)*.032
      +Math.sin(side*19.3-time*.31)*.011-.16+lane*TAU/FRONTS;
  }
  function point(side,angle,height){
    const ring=Math.sqrt(Math.max(0,1-side*side)),along=ring*Math.sin(angle),radial=1+height;
    return {x:(-DY*side+DX*along)*radial,y:(DX*side+DY*along)*radial,z:ring*Math.cos(angle)*radial};
  }
  class OceanSprayField {
    static get maxParticles(){return FRONTS*(FOAM+DROPS+MIST);}
    static sample(time,{surge=1,breakers=1}={}){
      time=Number.isFinite(time)?Math.max(0,time):0;
      surge=Number.isFinite(surge)?clamp(surge):0;
      breakers=Number.isFinite(breakers)?clamp(breakers):0;
      const gain=smooth(.20,.90,surge)*breakers;
      if(gain<=0)return [];
      const particles=[];
      for(let lane=0;lane<FRONTS;lane++)for(let slot=0;slot<FOAM+DROPS+MIST;slot++){
        const kind=slot<FOAM?0:slot<FOAM+DROPS?1:2;
        const index=kind===0?slot:kind===1?slot-FOAM:slot-FOAM-DROPS;
        const id=lane*(FOAM+DROPS+MIST)+slot,base=id*31+811;
        // Four overlapping, staggered patches span the crest and its wake.
        // They replenish a connected foam mass rather than separate round puffs.
        const group=kind===0?Math.floor(index/4):index;
        const groupSeed=lane*2017+group*73+kind*100003+19;
        const period=kind===0?.76+hash(groupSeed)*.55:kind===1?.60+hash(base)*.52:1.05+hash(base)*.55;
        const offset=hash(groupSeed+83)*period+(kind===0?(index%4)*period*.19:0);
        const clock=(time+offset)/period,cycle=Math.floor(clock),life=clock-cycle;
        const age=life*period,birth=time-age,seed=base+cycle*1013;
        const fade=smooth(0,.12,life)*(1-smooth(kind===2?.45:.68,1,life));
        if(fade<.002)continue;
        let side,height,angle,radius,opacity,orientation;
        if(kind===0){
          const center=-.94+(group+.18+hash(groupSeed+31)*.64)/(FOAM/4)*1.88;
          side=clamp(center+(hash(seed+7)-.5)*.009+Math.sin(life*Math.PI*2+hash(seed+9)*TAU)*.003,-.97,.97);
          const turn=4*life*(1-life);
          const roll=-.048+(index%4)*.019+.010*Math.sin(life*Math.PI)-.014*life+(hash(seed+17)-.5)*.008;
          angle=front(side,time,lane)+roll;
          height=(.031+(.007+hash(seed+23)*.006)*turn)*(.55+.45*gain);
          const thickness=.86+.14*Math.sin(side*19.+Math.sin(side*31.-time*.43)+time*.29);
          radius=(.022+hash(seed+37)*.010)*thickness*(.86+.14*Math.sin(life*Math.PI))*(.78+.22*gain);
          opacity=.74+hash(seed+43)*.15;
          const ahead=point(side+.001,front(side+.001,time,lane)+roll,height);
          const behind=point(side-.001,front(side-.001,time,lane)+roll,height);
          orientation=Math.atan2(ahead.y/(3.4-ahead.z)-behind.y/(3.4-behind.z),
            ahead.x/(3.4-ahead.z)-behind.x/(3.4-behind.z))+(hash(seed+59)-.5)*.14;
        }else if(kind===1){
          side=-.91+(index+.1+hash(seed+7)*.8)/DROPS*1.82;
          side=clamp(side+(hash(seed+11)-.5)*age*.06,-.96,.96);
          // The initial point is on the crest at birth. Tangential momentum
          // carries the droplet forward while its radial arc rises and falls.
          angle=front(side,birth,lane)+age*(.40+hash(seed+17)*.16);
          height=.024+(.065+hash(seed+23)*.085)*4*life*(1-life)*gain;
          radius=(.0022+hash(seed+37)*.0045)*(.8+.2*Math.sin(life*Math.PI));
          opacity=.45+hash(seed+43)*.30;
        }else{
          side=-.87+(index+hash(seed+7))/MIST*1.74;
          angle=front(side,birth,lane)+age*.34-.025;
          height=.026+life*(.028+hash(seed+23)*.040)*gain;
          radius=(.017+hash(seed+37)*.014)*(.55+.75*life);
          opacity=.055+hash(seed+43)*.035;
        }
        const p=point(side,angle,height),nz=p.z/(1+height);
        // The nominal SS orb already fills the viewport. Preserve its outline
        // with a broad limb fade instead of clipping spray against a screen box.
        const rim=smooth(kind===1?.36:.48,kind===1?.64:.72,Math.abs(nz)),pole=smooth(.03,.30,1-side*side);
        const alpha=fade*opacity*gain*rim*pole;
        if(alpha<.001)continue;
        particles.push({...p,radius,angle:orientation??(hash(seed+59)*TAU+life*.7),
          alpha,seed:hash(seed+67),kind,life,id,birth,age,lifetime:period});
      }
      return particles;
    }
  }
  root.OceanSprayField=OceanSprayField;
})(globalThis);
