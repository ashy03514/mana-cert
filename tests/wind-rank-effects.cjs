'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/wind-rank-effects.js');
require('../js/fire-rank-sparkles.js');
require('../js/wind-tornado-renderer.js');
const profiles=WindRankEffects,wind=Object.create(WindTornadoRenderer.prototype);
const originalRandom=Math.random;
Math.random=()=>{throw Error('preview ranks must not draw a certification result');};
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,message);
try{
  assert.deepEqual(profiles.profiles.map(p=>p.rank),['E','D','C','B','A','S','SS']);
  assert.ok(Object.isFrozen(profiles)&&Object.isFrozen(profiles.profiles));
  for(const p of profiles.profiles)assert.ok(Object.isFrozen(p),'profile values cannot be mutated by preview controls');
  const [E,D,C,B,A,S,SS]=profiles.profiles;
  assert.equal(profiles.forRank('unknown'),SS,'an invalid visual selection uses the established SS reference');
  assert.deepEqual([S.speed,A.speed,B.speed,C.speed],[.8,.7,.6,.5],'requested speeds are relative to SS, not cumulative');
  assert.deepEqual([S.widthScale,A.widthScale,B.widthScale,C.widthScale],[.9,.9,.7,.5]);
  near(S.swayScale,.8*.85,'S reduces its existing sway by another 15%');
  near(A.swayScale,.8*.8,'A reduces its existing sway by another 20%');
  near(B.swayScale,.6*.8,'B reduces its existing sway by another 20%');
  assert.deepEqual([E.swayScale,D.swayScale,C.swayScale],[0,0,0]);
  assert.deepEqual(profiles.profiles.map(p=>p.populationScale),[.4,.6,.8,.8,.9,1,1]);
  assert.deepEqual(profiles.profiles.filter(p=>p.cloudAmount>0).map(p=>p.rank),['S','SS'],'thick cloud ceiling starts at S');
  assert.deepEqual(profiles.profiles.filter(p=>p.starScale>0).map(p=>p.rank),['S','SS'],'glints start at S');
  assert.ok(S.starScale<SS.starScale&&S.starScale>0,'S keeps visibly smaller glints');
  assert.ok(profiles.profiles.every(p=>p.vortexMix===0),'all ranks are tornadoes; D/E no longer use hollow wind rings');
  assert.ok(profiles.profiles.every(p=>p.sizeScale===1),'rank growth never changes camera/object scale');
  assert.deepEqual([E.widthScale,D.widthScale,C.widthScale],[.30,.40,.5]);
  assert.deepEqual([E.heightScale,D.heightScale,C.heightScale,B.heightScale],[.40,.58,.8,1]);
  assert.deepEqual(profiles.profiles.map(p=>p.cohesion),[.12,.58,1,1,1,1,1],'wind structures progress from loose curls to connected funnel');
  const ground=box=>box.y+box.height/2+1.05*box.height/2.68;
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
    const base=wind.layout(width,height,SS),c=wind.layout(width,height,C),d=wind.layout(width,height,D),e=wind.layout(width,height,E);
    assert.deepEqual(wind.layout(width,height),base,'unselected previews preserve the SS reference');
    near(c.width/base.width,1,'C keeps its horizontal scale while becoming shorter');
    near(c.height/base.height,.8,'C height is reduced to the requested compact funnel framing');
    near(d.height/base.height,.58,'D grows taller as its vortex connects');
    near(e.height/base.height,.40,'E retains a low incomplete wind column');
    near(e.width/d.width,1,'low ranks share the physical world scale');
    near(e.height/d.height,.40/.58,'low-rank height changes independently of width');
    assert.notEqual(E.widthScale/D.widthScale,E.heightScale/D.heightScale,'E/D cannot be uniform miniatures of one another');
    for(const p of profiles.profiles)near(wind.detailScale(wind.layout(width,height,p),p),wind.detailScale(base,SS),'leaves and line thickness retain the same reference size across grades');
    for(const box of [base,c,d,e]){
      near(box.x+box.width/2,width/2,'each tornado stays horizontally centred');
      near(ground(box),ground(base),'growth preserves the ground contact');
      assert.equal(box.gatherY,base.gatherY);
    }
    for(const p of [B,A,S])assert.deepEqual(wind.layout(width,height,p),base,'B to S preserve their existing height');
    const standalone={x:20,y:50,width:300,height:402};
    for(const p of profiles.profiles)near(ground(wind.rankBox(standalone,p)),ground(standalone),'standalone and formal previews use the same ground anchor');
  }
  for(const h of [.15,.35,.6,.83])for(const time of [0,1.1,4.7,120]){
    const full=wind.spine(h,time,SS),a=wind.spine(h,time,A),s=wind.spine(h,time,S),b=wind.spine(h,time,B),c=wind.spine(h,time,C);
    near(s.x,full.x*.68,'S sway matches its revised multiplier');near(s.z,full.z*.68,'S depth sway matches its revised multiplier');
    near(a.x,full.x*.64,'A sway matches its revised multiplier');near(a.z,full.z*.64,'A depth sway matches its revised multiplier');
    near(b.x,full.x*.48,'B sway matches its revised multiplier');near(b.z,full.z*.48,'B depth sway matches its revised multiplier');
    near(c.x,0,'C has no sideways sway');near(c.z,0,'C has no depth sway');
    const fullSurface=wind.surface(h,.7,time,SS),fullRadius=Math.hypot(fullSurface.x-full.x,fullSurface.z-full.z);
    near(wind.envelope(h,SS),.054+.54*h**1.45+.14*h**5,'mature wind retains its accepted funnel silhouette');
    for(const p of [S,A,B,C,D,E]){
      const axis=wind.spine(h,time,p),surface=wind.surface(h,.7,time,p);
      const expected=wind.envelope(h,p)*p.widthScale;
      near(Math.hypot(surface.x-axis.x,surface.z-axis.z),expected,'surface lines follow the changing low-rank structure and width');
      near(surface.y,fullSurface.y,'the shared world-space funnel is shortened by its projected height, not detached overlays');
    }
  }
  // A loose curl has a broader base and a less exaggerated mouth than a
  // mature funnel. D lies between E and C at both ends of the same column.
  for(const h of [0,.15,.4,.7,1]){
    const loose=.24+.28*h**.65,mature=.054+.54*h**1.45+.14*h**5;
    for(const p of [E,D,C])near(wind.envelope(h,p),loose+(mature-loose)*p.cohesion,'low-rank contour follows structural cohesion');
  }
  assert.ok(wind.envelope(0,E)>wind.envelope(0,D)&&wind.envelope(0,D)>wind.envelope(0,C),'E starts as broad surface curls rather than a full pointed funnel');
  assert.ok(wind.envelope(1,E)<wind.envelope(1,D)&&wind.envelope(1,D)<wind.envelope(1,C),'the funnel mouth develops as the structure connects');
  const reference=wind.layout(390,844,C),reduced={...C,sizeScale:.5};
  near(wind.detailScale(wind.rankBox(reference,reduced),reduced),wind.detailScale(reference,C),'detail size cannot accidentally shrink with an object scale');
  // Record the actual glyph paths and stroke widths emitted by the Canvas
  // overlay methods. Geometry positions may move, but detail dimensions must
  // remain a stable visual ruler for the wind's size.
  function detailDrawing(box,profile,time){
    const widths=[],glyphs=[],stack=[];let path=[];
    const ctx={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},
      translate(){},rotate(){},scale(){},beginPath(){path=[];},
      moveTo(...v){path.push(['m',...v]);},lineTo(){},quadraticCurveTo(...v){path.push(['q',...v]);},
      ellipse(...v){path.push(['e',...v]);},fill(){glyphs.push(path);},stroke(){widths.push(this.lineWidth);}};
    const complete={...profile,populationScale:1};
    for(const front of [false,true]){
      wind.speedLines(ctx,box,time,1,front,complete);
      wind.debris(ctx,box,time,1,front,complete);
    }
    return {widths:widths.map(v=>v.toFixed(8)).sort(),
      glyphs:glyphs.map(g=>JSON.stringify(g,(_k,v)=>typeof v==='number'?Number(v.toFixed(8)):v)).sort()};
  }
  for(const time of [.3,1.7,3.2]){
    const expected=detailDrawing(reference,C,time);
    assert.ok(expected.widths.length>0&&expected.glyphs.length>0,'actual exterior details are drawn');
    for(const p of [E,D,C,reduced]){
      const box=wind.layout(390,844,p),actual=detailDrawing(box,p,time);
      assert.deepEqual(actual.glyphs,expected.glyphs,'leaf and fragment glyphs cannot shrink with lower wind grades');
      assert.deepEqual(actual.widths,expected.widths,'flow-line thickness cannot shrink with lower wind grades');
    }
  }
  const curveLength=points=>points.reduce((length,p,i)=>i?length+Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0,0);
  for(const h of [.2,.45,.7]){
    const target=curveLength(wind.linePoints(reference,h,.8,1.3,2,C));
    for(const p of [E,D]){
      const box=wind.layout(390,844,p),points=wind.linePoints(box,h,.8,1.3,2,p);
      assert.ok(Math.abs(curveLength(points)/target-1)<.03,'low-grade streaks retain the readable projected length');
      assert.ok(points.every(point=>point.y<ground(box)+4),'compensated streaks remain above the ground');
    }
  }
  // Lines, leaves and small debris have separate slot populations, so reducing
  // the full debris list cannot accidentally retain every leaf unchanged.
  for(const count of [22,9,25]){
    let previousWeights=Array(count).fill(0);
    for(const scale of [0,.4,.6,.8,.9,1]){
      const weights=Array.from({length:count},(_,i)=>wind.populationWeight(i,count,scale));
      assert.ok(weights.every(w=>w>=0&&w<=1),'population fades stay bounded');
      near(weights.reduce((a,b)=>a+b,0),count*scale,'effective visible population follows the requested reduction');
      weights.forEach((w,i)=>assert.ok(w>=previousWeights[i],'growing ranks retain the existing deterministic slots'));
      assert.deepEqual(weights,Array.from({length:count},(_,i)=>wind.populationWeight(i,count,scale)),'paused population selection is deterministic');
      previousWeights=weights;
    }
  }
  const box=wind.layout(390,844,SS);
  for(let time=0;time<5;time+=.11){
    for(const p of [E,D,C,B,A])assert.deepEqual(wind.sparkleFrames(box,time,2.25*p.speed,1,p),[],'lower ranks never produce glints');
    // Equal host clocks retain the fire reference's distinct S/SS populations
    // and sizes, independently of the wind's separately checked speed.
    for(const profile of [S,SS]){
      const actual=wind.sparkleFrames(box,time,2.25,1,profile);
      const expected=FireRankSparkles.samples({time,mana:FireRankSparkles.manaForRank(profile.rank),
        referenceWidth:FireRankSparkles.referenceWidth(390,844)});
      assert.deepEqual(actual.map(p=>[p.id,p.birth,p.radius]),expected.map(p=>[p.id,p.birth,p.radius]),
        profile.rank+' glint population and size match fire');
    }
  }
  const keys=['speed','widthScale','swayScale','cloudAmount','vortexMix','sizeScale','heightScale','populationScale','starScale','stormFlash','cohesion'];
  const ssResult=Object.freeze({type:'magic',element:'風',rank:'SS',mana:9999});
  const crossingAt=(result,threshold)=>{
    let lo=0,hi=FireScanTransition.timing.complete;
    for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(FireScanTransition.sample(mid,result).value<threshold)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  };
  for(const [mana,rank] of [[0,'E'],[199,'E'],[200,'D'],[349,'D'],[350,'C'],[549,'C'],[550,'B'],[749,'B'],[750,'A'],[899,'A'],[900,'S'],[999,'S'],[1000,'SS']]){
    assert.equal(profiles.profileForValue(mana).rank,rank,'formal threshold '+mana);
  }
  near(profiles.sample(0,ssResult,1.2).time,.36,'formation joins the readout at E speed');
  for(const threshold of [200,350,550,750,900,1000]){
    const at=crossingAt(ssResult,threshold),dt=1e-5;
    const before=profiles.sample(at-dt,ssResult,1.2),after=profiles.sample(at+dt,ssResult,1.2);
    assert.ok(after.time>=before.time&&after.time-before.time<dt*2.01,'no phase jump when entering '+threshold);
    for(const key of keys)assert.ok(Math.abs(after.profile[key]-before.profile[key])<.0001,key+' stays continuous at '+threshold);
    const b=wind.layout(390,844,before.profile),a=wind.layout(390,844,after.profile);
    const innerB=wind.layout(390,844,profiles.sample(at-dt/10,ssResult,1.2).profile);
    const innerA=wind.layout(390,844,profiles.sample(at+dt/10,ssResult,1.2).profile);
    for(const key of ['x','y','width','height']){
      const delta=Math.abs(a[key]-b[key]),innerDelta=Math.abs(innerA[key]-innerB[key]);
      // A growing 600px volume can legitimately travel >.02px in this
      // interval. A tenfold shorter interval must reduce motion tenfold;
      // a discontinuous branch would retain its jump at either interval.
      assert.ok(delta<.1&&innerDelta<=delta*.11+1e-9,'wind layout converges continuously at '+threshold);
    }
    const earlier=profiles.sample(at-dt*2,ssResult,1.2),later=profiles.sample(at+dt*2,ssResult,1.2);
    assert.ok(Math.abs((before.time-earlier.time)/dt-(later.time-after.time)/dt)<.0001,'velocity does not snap at '+threshold);
    const result=Object.freeze({type:'magic',element:'風',rank:profiles.profileForValue(threshold).rank,mana:threshold});
    const snapshot=JSON.stringify(result),end=profiles.sample(4.71,result,1.2),tail=profiles.sample(5.71,result,1.2);
    for(const key of keys)near(end.profile[key],profiles.profileForValue(threshold)[key],'exact threshold finishes '+key+' blend');
    near(tail.time-end.time,end.profile.speed,'held outcome keeps its final velocity');
    assert.equal(JSON.stringify(result),snapshot,'sampling does not mutate a result');
  }
  let previous=profiles.sample(0,ssResult,1.2);
  for(let i=1;i<=600;i++){
    const time=i/100,current=profiles.sample(time,ssResult,1.2);
    assert.equal(current.value,FireScanTransition.sample(time,ssResult).value,'the visual uses actual displayed mana');
    assert.ok(current.time>previous.time&&current.time-previous.time<=.0100001,'speed-integrated animation never jumps or reverses');
    near(current.timeAt(time+1.2),current.time,'star birth clock and material clock agree');
    const sampled=profiles.sample(time,ssResult,1.2);
    assert.deepEqual(current.profile,sampled.profile,'paused profile sampling is deterministic');near(current.time,sampled.time,'paused phase is deterministic');
    for(const key of keys)assert.ok(current.profile[key]>=-1e-12&&current.profile[key]<=1+1e-12,key+' remains bounded');
    near(ground(wind.layout(390,844,current.profile)),ground(box),'formal rank growth never lifts or drops the tornado base');
    assert.equal(current.profile.vortexMix,0,'formal growth never reintroduces the retired hollow ring');
    if(current.value<900){assert.equal(current.profile.starScale,0);assert.equal(current.profile.cloudAmount,0);}
    if(current.value<1000)assert.equal(current.profile.stormFlash,0,'internal thunder cannot leak below SS');
    previous=current;
  }
  // Independent height and geometry remain continuous as incomplete wind
  // connects into the mature column.
  const almostC={...C,sizeScale:1-1e-8},nearC=wind.layout(390,844,almostC),exactC=wind.layout(390,844,C);
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(nearC[key]-exactC[key])<.00002,'D/C framing is continuous through '+key);
  const almostB={...B,heightScale:1-1e-8},nearB=wind.layout(390,844,almostB),exactB=wind.layout(390,844,B);
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(nearB[key]-exactB[key])<.00002,'C/B height growth is continuous through '+key);
  for(const [width,height] of [[320,568],[390,844],[844,390]])for(const p of profiles.profiles){
    const view=wind.scanLayout(width,height,p,1),n=view.numbers;
    assert.ok(n.rankY<height-80,'rank clears the formal replay button');
    assert.ok(n.labelY-28>60,'attribute title clears the top controls');
    if(width<height)assert.deepEqual(view.box,wind.layout(width,height,p),'formal portrait preserves the accepted rank size and anchor');
    else assert.ok(view.box.x+view.box.width/2<width*.5&&n.x>width*.5,'short landscape separates effect and readout');
  }
  const clock=profiles.sample(1.6,ssResult,1.2).timeAt;
  const fixedProfile={...SS};
  assert.deepEqual(wind.sparkleFrames(box,2.8,.3,1,fixedProfile,t=>clock(t)*2.25),
    wind.sparkleFrames(box,2.8,1,1,fixedProfile,t=>clock(t)*2.25),'integrated birth positions cannot jump when the current speed changes');
  console.log('Wind ranks passed: structural E/D curls, fixed leaf/line scale, mature silhouettes, shared ground, immutable mana sampling, continuous cohesion and formal layouts.');
}finally{Math.random=originalRandom;}
