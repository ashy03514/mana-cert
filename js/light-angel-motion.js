/* One authored wing pair, articulated in texture space. All poses are sampled
 * from the host clock so inspection, replay and context recovery agree. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const time=v=>Number.isFinite(v)?Math.max(0,v):0;
  const rotate=(p,x,y,a,w)=>{const dx=p.x-x,dy=p.y-y,c=Math.cos(a),s=Math.sin(a);return {x:p.x+(dx*c-dy*s-dx)*w,y:p.y+(dx*s+dy*c-dy)*w};};
  const PERIOD=9.2;
  // The three images have different feather margins. At their registered
  // roots, these fixed scales give roughly 88%, 96% and 100% visible span.
  const wingScale=Object.freeze({A:1.225,S:1.135,SS:1.12});
  function registeredWingUV(u,v,rank){
    const ratio=wingScale[rank]/wingScale.SS;
    return {u:.5+(u-.5)*ratio,v:.72+(v-(rank==='A'?.62:.72))*ratio};
  }
  // One camera and one feather asset. Rank changes the energy and articulation,
  // rather than making the same wings look farther from the viewer.
  const profiles=Object.freeze({
    A:Object.freeze({rank:'A',speed:.70,charge:0,expansion:0,burst:0,drift:.50,idle:.84,core:.58,rays:.40,crown:.45,glow:.60,ambientCount:32,burstCount:0}),
    S:Object.freeze({rank:'S',speed:.85,charge:.55,expansion:.60,burst:.50,drift:.80,idle:.94,core:.82,rays:.72,crown:.75,glow:.82,ambientCount:64,burstCount:36}),
    SS:Object.freeze({rank:'SS',speed:1,charge:1,expansion:1,burst:1,drift:1,idle:1,core:1,rays:1,crown:1,glow:1,ambientCount:96,burstCount:72})
  });
  const profile=rank=>Object.hasOwn(profiles,rank)?profiles[rank]:profiles.SS;
  const AMBIENT_MIN_SIZE=.0017,AMBIENT_MAX_SIZE=(.0017+.014)*.70;
  const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const noise=n=>{const i=Math.floor(n);return seed(i)+(seed(i+1)-seed(i))*smooth(n-i);};
  function sample(value,rank='SS'){
    const t=time(value),phase=t%PERIOD,p=profile(rank);
    // A deliberate intake, quick release and long recovery. The fully spread
    // silhouette remains readable even at maximum concentration.
    const charge=smooth((phase-.25)/1.45)*(1-smooth((phase-1.82)/.42))*p.charge;
    const expansion=smooth((phase-1.82)/.52)*(1-smooth((phase-2.55)/1.55))*p.expansion;
    const burst=smooth((phase-1.97)/.15)*(1-smooth((phase-2.17)/.75))*p.burst;
    return {time:t,phase,rank:p.rank,cycle:Math.floor(t/PERIOD),charge,expansion,burst,
      visible:smooth((t-.05)/.5),core:smooth(t/.5)*p.core,crown:smooth(t/1.25)*p.crown,
      scale:1-charge*.09+expansion*.065,
      breath:1+Math.sin(t*.82)*.045,
      glint:smooth((noise(t*2.15+23)-.38)/.52),
      coreGlare:.70+noise(t*1.05+5)*.45+noise(t*3.2+11)*.22,
      rays:smooth((t-.12)/.8)*(1-charge*.17+burst*.38)*p.rays};
  }
  function point(u,v,value,sideOverride,rank='SS'){
    const s=sample(value,rank),rankProfile=profile(rank),side=sideOverride===-1||sideOverride===1?sideOverride:(u<.5?-1:1),reach=Math.abs(u-.5)*2;
    let p={x:Math.abs(u-.5),y:(v-.72)/1.5};
    const follow=smooth((reach-.28)/.58);
    // A continuous, slow shoulder stroke also runs between ceremonial bursts.
    // The wrist and feather tips follow later, like a light wing carrying air.
    // Suppress only its amplitude during the stronger authored release; never
    // reset its phase at a cycle or rank boundary.
    const idle=rankProfile.idle*(1-Math.max(s.charge,s.expansion)*.92);
    const stroke=s.time*1.04+side*.08;
    // Concentration bends the trailing feathers down while the wing stays
    // open. The outer joint follows the explosive upward release.
    const innerAngle=s.charge*.018-s.expansion*.014+(Math.sin(stroke)*.070+Math.sin(s.time*.43+.8)*.012)*idle;
    p=rotate(p,0,0,innerAngle,1);
    const wristAngle=s.charge*.07-s.expansion*.08+(Math.sin(stroke-.85)*.075+Math.sin(s.time*.61+.7)*.012)*idle;
    p=rotate(p,.205,-.145,wristAngle,follow);
    const edge=smooth((reach-.44)/.52),anchor=smooth(Math.hypot(u-.5,(v-.72)/1.5)/.18);
    const trailing=smooth((reach-.20)/.64)*(.35+.65*smooth((v-.28)/.58))*anchor;
    p.y+=(s.charge*.075-s.expansion*.073)*trailing;
    p.y+=Math.sin(stroke-1.35-reach*.6)*.022*trailing*idle;
    p.y+=Math.sin(s.time*1.17-reach*2.0+v*1.6+side*.16)*.010*edge*anchor*idle;
    p.x+=Math.sin(stroke-.65-reach*.8+v*.7)*.006*edge*idle;
    p.x*=s.scale;p.y*=s.scale;
    return {x:p.x*side,y:p.y};
  }
  function particles(value,rank='SS'){
    const s=sample(value,rank),p=profile(rank),out=[];
    if(s.charge>0){
      for(let i=0;i<Math.round(18*p.charge);i++){
        const age=(s.phase*.67+seed(i+50))%1,angle=seed(i+80)*Math.PI*2;
        const radius=.32*(1-age)+.025;
        out.push({x:Math.cos(angle+age*.12)*radius,y:Math.sin(angle+age*.12)*radius*.7,
          size:.0023+seed(i+90)*.0018,alpha:Math.sin(age*Math.PI)*s.charge*.55,rotation:0,star:false,tint:0});
      }
    }
    for(let i=0;i<p.burstCount;i++){
      const age=s.phase-2.01-seed(i+9)*.23,life=1.10+seed(i+70)*1.15;
      if(age<0||age>life)continue;
      const progress=age/life,angle=i*2.39996323+seed(i+39)*.17;
      const reach=.24+seed(i+109)*.45,travel=1-Math.pow(1-progress,2.4);
      const radius=.025+reach*travel,curve=(seed(i+149)-.5)*progress*.34;
      out.push({x:Math.cos(angle+curve)*radius,y:Math.sin(angle+curve)*radius*.84-progress*progress*.045,
        size:(i<Math.round(p.burstCount*46/72)?(.0075+Math.pow(seed(i+19),2)*.0175):(.0015+seed(i+29)*.002))*(rank==='S'?.72:1),
        alpha:smooth(age/.065)*(1-smooth((progress-.25)/.75))*(.80+seed(i+219)*.20)*p.glow,
        rotation:seed(i+179)*Math.PI+age*(seed(i+199)-.5)*2.2,star:i<Math.round(p.burstCount*46/72),tint:i%3});
    }
    return out;
  }
  // The background source has its own uninterrupted clock. Every lane is
  // staggered, so a burst/recovery boundary never clears the glowing dust.
  function ambientParticles(value,rank='SS'){
    const t=time(value),out=[],visible=smooth(t/.7);
    for(let i=0;i<profile(rank).ambientCount;i++){
      const depth=seed(i+451),life=7.8-depth*3.7+seed(i+679)*1.4;
      const clock=t+seed(i+379)*life,lap=Math.floor(clock/life),progress=(clock%life)/life;
      const angle=seed(i*19+lap*53+901)*Math.PI*2;
      const radius=.018+Math.pow(progress,1.06)*(.80+depth*.52+seed(i+517)*.24);
      const bend=(seed(i+571)-.5)*progress*.20;
      out.push({id:i,x:Math.cos(angle+bend)*radius,y:Math.sin(angle+bend)*radius*.88,
        size:AMBIENT_MIN_SIZE+Math.pow(depth,2.6)*(AMBIENT_MAX_SIZE-AMBIENT_MIN_SIZE),
        alpha:smooth((progress-.012)/.08)*(1-smooth((progress-.67)/.33))*(.43+depth*.48)*visible,
        softness:.18+depth*.72});
    }
    return out;
  }
  root.LightAngelMotion=Object.freeze({sample,point,particles,ambientParticles,profile,noise,wingScale,registeredWingUV,PERIOD});
})(globalThis);
