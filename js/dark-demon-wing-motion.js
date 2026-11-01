/* Demon wings: a continuous shoulder/wrist pose with a separate, attached
 * chain response. Sampling uses only the supplied clock, never result RNG. */
(function(root){
 'use strict';
 const PERIOD=9.4,ROOT_X=.5,ROOT_Y=.43;
 const profiles=Object.freeze({
  A:Object.freeze({rank:'A',speed:.70,charge:.22,release:.24,burst:.18,idle:.74,chainOpacity:.35,chainMotion:.45,particleDensity:.32,particleSize:.65,core:.62,rays:.52,idleCount:8,gatherCount:6,burstCount:8,starCount:0}),
  S:Object.freeze({rank:'S',speed:.85,charge:.60,release:.65,burst:.62,idle:.90,chainOpacity:.76,chainMotion:.76,particleDensity:.66,particleSize:.82,core:.84,rays:.78,idleCount:15,gatherCount:11,burstCount:32,starCount:13}),
  SS:Object.freeze({rank:'SS',speed:1,charge:1,release:1,burst:1,idle:1,chainOpacity:1,chainMotion:1,particleDensity:1,particleSize:1,core:1,rays:1,idleCount:22,gatherCount:16,burstCount:48,starCount:22})
 });
 const profile=rank=>Object.hasOwn(profiles,rank)?profiles[rank]:profiles.SS;
 const clamp=v=>Math.max(0,Math.min(1,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const safeTime=v=>Number.isFinite(v)?Math.max(0,v):0;
 const seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 const noise=n=>{const i=Math.floor(n);return seed(i)+(seed(i+1)-seed(i))*smooth(n-i);};
 const rotate=(p,x,y,a,w)=>{const dx=p.x-x,dy=p.y-y,c=Math.cos(a),s=Math.sin(a);return {x:p.x+(dx*c-dy*s-dx)*w,y:p.y+(dx*s+dy*c-dy)*w};};
 function sample(value,rank='SS',evolutionAction){
  const time=safeTime(value),phase=time%PERIOD,p=profile(rank);
  // An evolution overrides only the ceremony, never the continuous idle clock.
  const weight=clamp(Number.isFinite(evolutionAction?.weight)?evolutionAction.weight:0);
  const action=(key,periodic)=>periodic*(1-weight)+clamp(Number.isFinite(evolutionAction?.[key])?evolutionAction[key]:0)*weight;
  const charge=action('charge',smooth((phase-.42)/1.40)*(1-smooth((phase-2.02)/.40)))*p.charge;
  const release=action('release',smooth((phase-2.02)/.48)*(1-smooth((phase-2.78)/1.25)))*p.release;
  const burst=action('burst',smooth((phase-2.14)/.16)*(1-smooth((phase-2.40)/.70)))*p.burst;
  return {time,phase,rank:p.rank,cycle:Math.floor(time/PERIOD),charge,release,burst,
   ...(evolutionAction?{evolutionAction}:{}),
   idleStrength:p.idle,chainStrength:p.chainMotion,chainOpacity:p.chainOpacity,
   visible:smooth(time/.48),
   phaseName:phase<.42?'魔力甦醒':phase<2.14?'凝聚魔力':phase<3.10?'展翼爆發':phase<4.10?'餘波回盪':'魔翼呼吸',
   core:(.66+noise(time*1.12+9)*.20+charge*.27+burst*.62)*p.core,
   rays:(.35+noise(time*.68+51)*.17+burst*.65)*p.rays,
   breath:Math.sin(time*.95)*.5+.5};
 }
 function point(u,v,value,sideOverride,cachedSample){
  u=Number.isFinite(u)?u:ROOT_X;v=Number.isFinite(v)?v:ROOT_Y;
  const s=cachedSample||sample(value),side=sideOverride===-1||sideOverride===1?sideOverride:(u<ROOT_X?-1:1);
  const strength=s.idleStrength??profile(s.rank).idle;
  const reach=Math.abs(u-ROOT_X),idle=(1-Math.max(s.charge,s.release)*.86)*strength;
  // Coordinates are in image-width units, so joint rotations keep their
  // physical angle on the 3:2 authored image. Return image UV coordinates.
  let p={x:reach,y:(v-ROOT_Y)/1.5};
  const stroke=s.time*.95+side*.065;
  const shoulder=s.charge*.060-s.release*.074+(Math.sin(stroke)*.047+Math.sin(s.time*.39+.7)*.010)*idle;
  p=rotate(p,0,0,shoulder,1);
  const wristFollow=smooth((reach-.105)/.28);
  const wrist=s.charge*.095-s.release*.115+(Math.sin(stroke-.80)*.067+Math.sin(s.time*.53+.4)*.010)*idle;
  p=rotate(p,.15,(.17-ROOT_Y)/1.5,wrist,wristFollow);
  const anchor=smooth(Math.hypot(reach,(v-ROOT_Y)/1.5)/.13);
  const trailing=smooth((v-.28)/.57)*smooth((reach-.08)/.26)*anchor;
  const outer=smooth((reach-.19)/.27)*anchor;
  // The broad membrane follows the bones. A tiny delayed ripple lives only
  // in the trailing area; it cannot pull the roots or shred the silhouette.
  p.x*=1-s.charge*.075+s.release*.043;
  p.y+=(s.charge*.022-s.release*.029)*trailing;
  p.y+=Math.sin(stroke-1.22-reach*.75)*.012*trailing*idle;
  p.y+=Math.sin(s.time*1.47-reach*5.1+v*2.4+side*.22)*.0033*outer*trailing*strength;
  p.x+=Math.sin(s.time*1.12-reach*3.7+v*1.9)*.0022*outer*trailing*idle;
  return {x:ROOT_X+side*p.x,y:ROOT_Y+p.y*1.5};
 }
 function chainPoint(u,v,value,sideOverride,fraction,cachedSample){
  const s=cachedSample||sample(value),side=sideOverride===-1||sideOverride===1?sideOverride:(u<ROOT_X?-1:1);
  const p=point(u,v,value,side,s),f=clamp(Number.isFinite(fraction)?fraction:0);
  // Keeping both attachment points exact prevents the ornament slipping
  // across the moving bone. Only the middle of the hanging chain lags.
  if(f===0||f===1)return p;
  const middle=Math.sin(Math.PI*f)*(s.chainStrength??profile(s.rank).chainMotion),age=Math.max(0,s.phase-2.13);
  const impulse=age=>age>0?Math.sin(age*8.8)*Math.exp(-age*2.05)*smooth(age/.14)*(1-smooth((age-2.6)/.7)):0;
  const action=s.evolutionAction,weight=clamp(Number.isFinite(action?.weight)?action.weight:0);
  // The chain recoil follows the actual release, including its settling tail.
  const recoil=(Array.isArray(action?.pulses)?action.pulses:[]).reduce((sum,pulse)=>sum+(Number.isFinite(pulse.age)?impulse(pulse.age-.23):0),0);
  const ring=impulse(age)*(1-weight)+recoil;
  p.x+=side*middle*(Math.sin(s.time*.95-1.1)*.0058+ring*.025-s.charge*.004);
  p.y+=middle*(Math.sin(s.time*.95-1.65)*.005+ring*.012+s.charge*.004);
  return p;
 }
 function particles(value,rank='SS',evolutionAction){
  const s=sample(value,rank,evolutionAction),p=profile(rank),out=[];
  const weight=clamp(Number.isFinite(evolutionAction?.weight)?evolutionAction.weight:0);
  // Long-lived dust lanes have their own clock, independent of the ceremony.
  for(let i=0;i<p.idleCount;i++){
   const life=4.8+seed(i+71)*3.4,clock=s.time+seed(i+110)*life;
   const age=clock%life,progress=age/life,lap=Math.floor(clock/life);
   const angle=seed(i*17+lap*53+430)*Math.PI*2,drift=(seed(i+531)-.5)*progress*.32;
   const radius=.10+progress*(.38+seed(i+277)*.40);
   out.push({id:'idle-'+i,x:ROOT_X+Math.cos(angle+drift)*radius,y:ROOT_Y+Math.sin(angle+drift)*radius*1.2-progress*.025,
    size:.0012+seed(i+187)*.0022,alpha:smooth(progress/.12)*(1-smooth((progress-.72)/.28))*.34*s.visible,
    rotation:0,star:false,tint:i%2});
  }
  if(s.charge>0){
   for(let i=0;i<p.gatherCount;i++){
    const progress=(s.phase*.71+seed(i+630))%1,angle=seed(i+780)*Math.PI*2;
    const radius=.32*(1-progress)+.025;
    out.push({id:'charge-'+i,x:ROOT_X+Math.cos(angle+progress*.2)*radius,y:ROOT_Y+Math.sin(angle+progress*.2)*radius*1.2,
     size:.0019+seed(i+90)*.0013,alpha:Math.sin(progress*Math.PI)*s.charge*.70*s.visible,
     rotation:0,star:false,tint:i%2});
   }
  }
  const addBurst=(phase,p,opacity,prefix)=>{
   if(opacity<=0)return;
   for(let i=0;i<p.burstCount;i++){
    const age=phase-2.20-seed(i+923)*.18,life=1.1+seed(i+70)*.95;
    if(age<0||age>life)continue;
    const progress=age/life,angle=i*2.39996323+seed(i+19)*.19,curve=(seed(i+149)-.5)*progress*.30;
    const radius=.025+(.22+seed(i+109)*.42)*(1-Math.pow(1-progress,2.4));
    const star=i<p.starCount,envelope=smooth(age/.07)*(1-smooth((progress-.2)/.8));
    out.push({id:prefix+i,x:ROOT_X+Math.cos(angle+curve)*radius,y:ROOT_Y+Math.sin(angle+curve)*radius*1.25-progress*progress*.045,
     size:(star?.0042+Math.pow(seed(i+79),2)*.0088:.0013+seed(i+29)*.002)*p.particleSize,
     alpha:envelope*(.65+seed(i+219)*.30)*s.visible*p.burst*opacity,
     rotation:seed(i+179)*Math.PI+age*(seed(i+199)-.5)*2.0,star,tint:i%3});
   }
  };
  addBurst(s.phase,p,1-weight,'burst-');
  // Each event retains its own birth time and rank until the last spark dies.
  for(const pulse of Array.isArray(evolutionAction?.pulses)?evolutionAction.pulses:[]){
   if(!['S','SS'].includes(pulse.rank)||!Number.isFinite(pulse.age))continue;
   addBurst(2.20+pulse.age-.30,profile(pulse.rank),1,'evolution-'+pulse.rank+'-');
  }
  return out;
 }
 root.DarkDemonWingMotion=Object.freeze({sample,point,chainPoint,particles,profile,noise,PERIOD,ROOT_X,ROOT_Y});
})(globalThis);
