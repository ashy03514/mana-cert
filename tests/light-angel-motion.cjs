'use strict';
const assert=require('node:assert/strict');
require('../js/light-angel-motion.js');
require('../js/fire-rank-sparkles.js');
require('../js/light-angel-motion-renderer.js');
const M=LightAngelMotion;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

for(const invalid of [-1,NaN,Infinity,-Infinity]){
  assert.deepEqual(M.sample(invalid),M.sample(0),'invalid time starts at the reveal origin');
  assert.deepEqual(M.point(.84,.12,invalid),M.point(.84,.12,0));
  assert.deepEqual(M.particles(invalid),M.particles(0));
  assert.deepEqual(M.ambientParticles(invalid),M.ambientParticles(0));
}
const originalRandom=Math.random,originalNow=Date.now;
Math.random=()=>{throw Error('wing animation must not consume certification randomness');};
Date.now=()=>{throw Error('wing animation must use the supplied active clock');};
try{
  let previous=M.sample(0);
  for(let i=0;i<=3000;i++){
    const time=i/100,s=M.sample(time),next=M.sample(time+.00001);
    for(const field of ['charge','expansion','burst','visible','core','crown']){
      assert.ok(Number.isFinite(s[field])&&s[field]>=0&&s[field]<=1,field+' is bounded');
      assert.ok(Math.abs(s[field]-next[field])<.001,field+' has a continuous envelope');
    }
    assert.ok(s.breath>=.9549&&s.breath<=1.0451,'idle light breathing stays restrained');
    assert.ok(s.scale>=.90&&s.scale<=1.07,'concentration and release use a modest size range');
    assert.ok(s.rays>=0&&s.rays<=1.38,'backlight has bounded release emphasis');
    assert.ok(Math.abs(s.rays-next.rays)<.001,'backlight envelope is continuous');
    assert.ok(s.glint>=0&&s.glint<=1&&s.coreGlare>=.70&&s.coreGlare<=1.37,'constant core radiance stays bounded');
    assert.ok(Math.abs(s.glint-next.glint)<.001&&Math.abs(s.coreGlare-next.coreGlare)<.001,'core flicker changes smoothly');
    for(const field of ['visible','core','crown'])assert.ok(s[field]>=previous[field],field+' does not restart or disappear on a later cycle');
    for(const side of [-1,1]){
      const anchor=M.point(.5,.72,time,side);
      assert.ok(Math.abs(anchor.x)<1e-12&&Math.abs(anchor.y)<1e-12,'both joined wing roots stay anchored');
    }
    previous=s;
  }
  assert.equal(M.sample(0).visible,0,'no fully formed wing is displayed before the reveal');
  const chargeTime=1.72,releaseTime=2.38,restTime=5.2;
  const charging=M.sample(chargeTime),release=M.sample(releaseTime),rest=M.sample(restTime);
  assert.ok(charging.visible>.99&&charging.charge>.99&&charging.expansion===0&&charging.burst===0,'concentration is visible and precedes release');
  assert.ok(charging.scale<rest.scale&&charging.scale>=rest.scale*.90,'concentration slightly contracts the art without folding it closed');
  assert.ok(release.charge===0&&release.expansion>.99&&release.burst>.7,'release simultaneously unfolds and illuminates');
  assert.ok(release.scale>rest.scale&&release.rays>rest.rays&&rest.rays>charging.rays,'size and backlight build toward the release');
  assert.equal(rest.charge+rest.expansion+rest.burst,0,'long recovery leaves a calm resting pair');
  const span=t=>{
    let left=Infinity,right=-Infinity;
    for(const u of [.05,.10,.15,.85,.90,.95])for(const v of [.05,.15,.30,.45,.60,.75,.90]){
      const p=M.point(u,v,t);left=Math.min(left,p.x);right=Math.max(right,p.x);
    }
    return right-left;
  };
  assert.ok(span(chargeTime)>=span(restTime)*.90&&span(chargeTime)<=span(restTime)*1.02,'charging retains the spread-wing silhouette within ten percent of resting width');
  assert.ok(span(releaseTime)>span(chargeTime)*1.10,'release visibly widens the pair');
  for(const u of [.2,.25,.75,.8]){
    // Divide out the whole-wing scale to check real trailing-feather flex.
    const chargedY=M.point(u,.85,chargeTime).y/charging.scale;
    const releasedY=M.point(u,.85,releaseTime).y/release.scale;
    const restingY=M.point(u,.85,restTime).y/rest.scale;
    assert.ok(chargedY>restingY+.025,'trailing feathers bend down during charge');
    assert.ok(releasedY<restingY-.015,'trailing feathers sweep up during release');
  }

  // Sample both actual wing halves independently. The centre line is the
  // attachment seam, not a triangle spanning between left and right wings.
  let minArea=Infinity,maxExtent=0;
  for(const time of [0,.3,.6,1,1.72,1.82,2.01,2.12,2.24,2.38,2.55,2.8,3.6,5.2,6.2,9.19999,9.20001,12,27,60,120,10000]){
    for(const [u0,u1,side] of [[-.065,.5,-1],[.5,1.065,1]]){
      const cols=36,rows=30,du=(u1-u0)/cols,dv=1.16/rows;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const u=u0+x*du,v=-.08+y*dv;
        const a=M.point(u,v,time,side),b=M.point(u+du,v,time,side),c=M.point(u,v+dv,time,side),d=M.point(u+du,v+dv,time,side);
        for(const p of [a,b,c,d]){
          assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),'all padded mesh points remain finite');
          assert.ok(Math.abs(p.x)<.64&&Math.abs(p.y)<.73,'deformed wings stay within their render margin');
          maxExtent=Math.max(maxExtent,Math.abs(p.x),Math.abs(p.y));
        }
        for(const signedArea of [area(a,b,c),area(c,b,d)]){
          minArea=Math.min(minArea,signedArea);
          assert.ok(signedArea>1e-6,'no inverted triangles or texture folds at '+time+'s');
        }
      }
    }
    for(const [u,v] of [[.08,.17],[.28,.45],[.47,.72],[.53,.72],[.72,.45],[.92,.17]]){
      assert.ok(distance(M.point(u,v,time),M.point(u,v,time+.00001))<.0001,'pose remains continuous at '+time+'s');
    }
  }
  assert.ok(distance(M.point(.9,.1,5.2),M.point(.9,.1,6.2))>.005,'tip keeps drifting during recovery');
  assert.ok(distance(M.point(.9,.1,5.2),M.point(.9,.1,6.2))>distance(M.point(.52,.70,5.2),M.point(.52,.70,6.2))*5,'wing tips flex more than their attached roots');

  for(const cycle of [1,2,17,1000]){
    const before=cycle*M.PERIOD-.00001,after=cycle*M.PERIOD+.00001;
    for(const field of ['charge','expansion','burst','visible','core','crown','scale','rays','breath','coreGlare']){
      assert.ok(Math.abs(M.sample(before)[field]-M.sample(after)[field])<.0001,'cycle boundary does not jump '+field);
    }
    // Glints change faster than wing breathing. Check their analytical
    // maximum slew (two smoothstep derivatives) and matching velocity on
    // both sides, rather than treating a smooth faster flash as a jump.
    const center=cycle*M.PERIOD,glintA=M.sample(before).glint,glintB=M.sample(center).glint,glintC=M.sample(after).glint;
    const maxGlintRate=1.5*2.15*1.5/.52;
    assert.ok(Math.abs(glintC-glintA)<=maxGlintRate*(after-before),'glint stays within its continuous noise slew');
    assert.ok(Math.abs((glintC-glintB)-(glintB-glintA))<1e-7,'glint velocity stays continuous across the wing loop');
    for(const [u,v] of [[.05,.1],[.25,.85],[.5,.72],[.75,.85],[.95,.1]]){
      assert.ok(distance(M.point(u,v,before),M.point(u,v,after))<.0001,'cycle wraps without snapping the feathers');
    }
    assert.deepEqual(M.particles(before),[]);assert.deepEqual(M.particles(after),[],'cycle has no stale particles');
    const ambientBefore=M.ambientParticles(before),ambientAfter=M.ambientParticles(after);
    assert.ok(ambientBefore.some(p=>p.alpha>.2),'ambient glow remains present at burst-cycle boundaries');
    for(let i=0;i<ambientBefore.length;i++){
      assert.equal(ambientBefore[i].id,ambientAfter[i].id);
      assert.ok(distance(ambientBefore[i],ambientAfter[i])<.0001,'background particles do not reset with the wing cycle');
      assert.ok(Math.abs(ambientBefore[i].alpha-ambientAfter[i].alpha)<.0001,'ambient visibility does not jump with the wing cycle');
    }
  }
  for(const t of [0,.6,1.72,1.99,2.0])assert.equal(M.particles(t).filter(p=>p.star).length,0,'stars wait until the actual outward release');
  const starsA=M.particles(2.4).filter(p=>p.star),starsB=M.particles(2.5).filter(p=>p.star);
  assert.ok(starsA.length>=30,'release contains a substantial star spray');
  assert.equal(starsA.length,starsB.length,'compare the same live star cohort after all births');
  for(let i=0;i<starsA.length;i++){
    assert.ok(Math.hypot(starsB[i].x,starsB[i].y)>Math.hypot(starsA[i].x,starsA[i].y),'stars fly out from the core');
  }
  const fadingA=M.particles(3.0).filter(p=>p.star),fadingB=M.particles(3.1).filter(p=>p.star);
  assert.equal(fadingA.length,starsA.length);assert.equal(fadingB.length,starsA.length,'compare the same stars after their initial brilliance hold');
  for(let i=0;i<fadingA.length;i++)assert.ok(fadingB[i].alpha<fadingA[i].alpha,'stars soften and fade during the outgoing spray');
  for(let t=0;t<30;t+=.07)for(const p of M.particles(t)){
    for(const key of ['x','y','size','alpha','rotation'])assert.ok(Number.isFinite(p[key]),'particle '+key+' remains finite');
    assert.ok(p.size>0&&p.size<=.025&&p.alpha>=0&&p.alpha<=1,'particle size and alpha remain bounded');
  }
  assert.deepEqual(M.particles(restTime),[],'release spray expires before calm recovery');
  assert.ok(M.particles(1.72).some(p=>!p.star),'charge has inward motes before release stars');
  const glints=[],glares=[],speeds=[];
  const radius=p=>Math.hypot(p.x,p.y/.88);
  let outward=0,rebirths=0;
  for(let frame=0;frame<=200;frame++){
    const t=5+frame*.02,s=M.sample(t),a=M.ambientParticles(t),b=M.ambientParticles(t+.02);
    assert.equal(s.burst+s.charge,0,'sample idle rather than the release animation');
    glints.push(s.glint);glares.push(s.coreGlare);
    assert.ok(a.filter(p=>p.alpha>.2).length>=35,'idle continuously contains visible outgoing light dots');
    assert.equal(new Set(a.map(p=>p.id)).size,a.length,'background lanes have stable unique identity');
    for(let i=0;i<a.length;i++){
      const p=a[i],q=b[i],ra=radius(p),rb=radius(q);
      for(const key of ['x','y','size','alpha','softness'])assert.ok(Number.isFinite(p[key]),'ambient '+key+' stays finite');
      assert.ok(p.alpha>=0&&p.alpha<=1&&p.size>0&&p.size<.02&&p.softness>=0&&p.softness<=1,'ambient appearance stays bounded');
      assert.equal(p.id,q.id);
      if(rb>=ra){outward++;speeds.push((rb-ra)/.02);}
      else{
        assert.ok(rb<.04,'recycled particles restart near the source rather than reverse direction');
        assert.ok(p.alpha<.001&&q.alpha<.001,'lane recycling is invisible');
        // Locate the actual slot birth to verify alpha continuity even
        // though a new direction is chosen for the next outward lifetime.
        let lo=t,hi=t+.02;
        for(let step=0;step<24;step++){
          const mid=(lo+hi)/2;
          if(radius(M.ambientParticles(mid)[i])>=ra)lo=mid;else hi=mid;
        }
        assert.ok(M.ambientParticles(lo-.000001)[i].alpha<1e-7&&M.ambientParticles(hi+.000001)[i].alpha<1e-7,'slot fade and new birth meet at invisible alpha');
        rebirths++;
      }
    }
  }
  assert.ok(outward>10000&&rebirths>20,'tested sustained outward motion and staggered respawns during idle');
  assert.ok(Math.max(...glints)-Math.min(...glints)>.5,'central glints visibly vary without any explosion');
  assert.ok(Math.max(...glares)-Math.min(...glares)>.12,'central glare keeps changing during idle');
  const dust=M.ambientParticles(restTime),sizes=dust.map(p=>p.size),radii=dust.map(radius),softness=dust.map(p=>p.softness);
  assert.ok(sizes.every(size=>size>=.0017&&size<=.01099+1e-12),'background dots retain the small minimum and a thirty-percent smaller maximum');
  assert.ok(Math.min(...sizes)<.00171&&Math.max(...sizes)>.0105,'size distribution still spans the small and reduced large dots');
  assert.ok(Math.max(...sizes)>Math.min(...sizes)*5,'background dots include distinct near and far sizes');
  assert.ok(Math.max(...radii)-Math.min(...radii)>.7,'dots occupy different depths of outward travel');
  assert.ok(Math.max(...speeds)>Math.min(...speeds)*2,'particles have visibly varied travel speeds');
  assert.ok(Math.max(...softness)-Math.min(...softness)>.5,'large near dots can be softer than fine distant dots');
  assert.ok(M.ambientParticles(0).every(p=>p.alpha===0),'background emission fades in without a startup pop');
  const samplePose=time=>[M.sample(time),M.particles(time),M.ambientParticles(time),...[[.05,.1],[.25,.4],[.47,.72],[.53,.72],[.75,.4],[.95,.1]].map(([u,v])=>M.point(u,v,time))];
  const paused=samplePose(5.2);assert.deepEqual(samplePose(5.2),paused,'paused pose is deterministic');
  samplePose(1000000);assert.deepEqual(samplePose(5.2),paused,'long playback cannot stretch or mutate the artwork when rewound');
  const spray=samplePose(2.4);samplePose(1000000);assert.deepEqual(samplePose(2.4),spray,'star spray and illuminated pose replay without mutable history');
  // The new front layer must inherit fire's actual envelope and screen-space
  // sizing, while changing only its travel from upward to centre-outward.
  const renderer=LightAngelMotionRenderer.prototype;
  let starPaths=0;
  for(const [w,h] of [[320,568],[390,844],[844,390],[1440,900]]){
    const box=w<h?{x:4,y:52,width:w-8,height:Math.min(h*.53,h-354)}:
      {x:18,y:52,width:Math.min(w*.63,w-320),height:h-88};
    const art=renderer.layout(w,h,box),referenceWidth=FireRankSparkles.referenceWidth(w,h);
    const frames=t=>renderer.sparkleFrames(w,h,art,M.sample(t));
    for(let step=0;step<=180;step++){
      const t=step*.05,stars=frames(t),later=frames(t+.01);
      const fire=FireRankSparkles.samples({time:t,mana:1000,referenceWidth});
      const colored=FireRankSparkles.frames(w,h,{time:t,mana:1000,box:{x:0,y:0,width:referenceWidth,height:referenceWidth}});
      assert.equal(stars.length,fire.length,'front layer uses the same SS live star count as fire');
      for(const p of stars){
        const baseline=fire.find(q=>q.id===p.id),color=colored.find(q=>q.id===p.id);
        for(const field of ['birth','age','lifetime','radius','maxRadius','glow','alpha','angle']){
          assert.equal(p[field],baseline[field],'shared fire '+field+' is retained exactly');
        }
        assert.equal(p.lifetime,1,'front star expands and disappears within the fire one-second lifetime');
        assert.equal(p.color,color.color,'front star retains fire coloring');
        assert.ok(p.x-p.glow>=2-1e-8&&p.x+p.glow<=w-2+1e-8,'peak star halo fits the horizontal viewport');
        assert.ok(p.y-p.glow>=2-1e-8&&p.y+p.glow<=Math.min(h-2,art.bottom-5)+1e-8,'peak star halo stays clear of the lower controls');
        const q=later.find(q=>q.id===p.id&&q.birth===p.birth);
        if(q){
          const startDistance=Math.hypot(p.x-art.cx,p.y-art.cy),nextDistance=Math.hypot(q.x-art.cx,q.y-art.cy);
          assert.ok(nextDistance>startDistance,'a surviving front star continues outward instead of stopping or returning');
          starPaths++;
        }
      }
    }
    const fixed=frames(6.3);frames(1000000);assert.deepEqual(frames(6.3),fixed,'foreground stars replay without history or result randomness');
  }
  assert.ok(starPaths>10000,'outgoing front stars exercised across four viewport sizes');
  console.log('Angel pair motion CPU passed: articulated charge/release, continuous idle glare, smaller depth dots, exact fire-star parity and outward top-layer routes, deterministic clock and mesh bounds.',{minArea,maxExtent,outward,rebirths,starPaths});
}finally{Math.random=originalRandom;Date.now=originalNow;}
