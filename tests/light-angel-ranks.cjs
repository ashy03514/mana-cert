'use strict';
const assert=require('node:assert/strict');
require('../js/light-angel-motion.js');
require('../js/fire-rank-sparkles.js');
require('../js/light-angel-motion-renderer.js');
const M=LightAngelMotion,R=LightAngelMotionRenderer.prototype;
const ranks=['A','S','SS'],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const signedArea=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const snapshot=(t,rank)=>[M.sample(t,rank),M.particles(t,rank),M.ambientParticles(t,rank),M.point(.92,.12,t,1,rank)];
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('rank effects must not consume result randomness');};
Date.now=()=>{throw Error('rank effects must use the supplied clock');};
try{
  for(const rank of ranks){
    const p=M.profile(rank);
    assert.equal(p.rank,rank);assert.ok(Object.isFrozen(p));
    assert.throws(()=>{p.speed=99;},TypeError,'a preview cannot mutate shared rank settings');
    const fixed=snapshot(2.4,rank);snapshot(1000000,rank);
    assert.deepEqual(snapshot(2.4,rank),fixed,'replay is independent of animation history');
    for(const t of [0,.3,1.72,2.38,5.2,9.2,12,100]){
      for(const side of [-1,1]){
        const root=M.point(.5,.72,t,side,rank);
        assert.ok(Math.abs(root.x)<1e-12&&Math.abs(root.y)<1e-12,'wing roots remain joined in '+rank);
      }
      const sample=M.sample(t,rank),next=M.sample(t+.00001,rank);
      for(const field of ['charge','expansion','burst','visible','core','crown','rays','scale']){
        assert.ok(Number.isFinite(sample[field]));
        assert.ok(Math.abs(sample[field]-next[field])<.001,rank+' envelopes remain continuous');
      }
      // Deformation must retain a valid mesh; thinner energy cannot fold feathers.
      for(const [start,side] of [[0,-1],[.5,1]])for(let y=0;y<12;y++)for(let x=0;x<12;x++){
        const u=start+x/24,v=y/12,du=1/24,dv=1/12;
        const a=M.point(u,v,t,side,rank),b=M.point(u+du,v,t,side,rank),c=M.point(u,v+dv,t,side,rank);
        assert.ok(signedArea(a,b,c)>0,rank+' preserves feather triangle orientation');
      }
    }
    assert.ok(distance(M.point(.92,.12,5.2,1,rank),M.point(.92,.12,6.2,1,rank))>.001,rank+' has live idle tips');
    assert.notEqual(M.sample(5.2,rank).rays,0,rank+' retains light during recovery');
    assert.ok(M.ambientParticles(5.2,rank).some(p=>p.alpha>.2),rank+' retains living background dots');
    // The frame/camera and apparent idle span remain shared, not rank-sized thumbnails.
    const lower=M.point(.95,.2,5.2,1,rank),upper=M.point(.95,.2,5.2,1,'SS');
    assert.ok(lower.x/upper.x>.95&&lower.x/upper.x<1.05,rank+' keeps the shared full-size silhouette');
  }
  assert.equal(M.profile('E').rank,'SS','unsupported preview rank falls back safely');
  for(let t=0;t<30;t+=.08){
    const a=M.sample(t,'A');
    assert.equal(a.charge+a.expansion+a.burst,0,'A has no explosive charge/release envelope');
    assert.equal(a.scale,1,'A is articulated without uniform zoom breathing');
    assert.deepEqual(M.particles(t,'A'),[],'A emits no burst stars or inward charge motes');
  }
  const charged=ranks.map(rank=>M.sample(1.72,rank)),released=ranks.map(rank=>M.sample(2.38,rank)),idle=ranks.map(rank=>M.sample(5.2,rank));
  for(const [samples,field] of [[charged,'charge'],[released,'expansion'],[released,'burst'],[idle,'core'],[idle,'rays'],[idle,'crown']]){
    assert.ok(samples[0][field]<samples[1][field]&&samples[1][field]<samples[2][field],field+' increases from A through S to SS');
  }
  const ambient=ranks.map(rank=>M.ambientParticles(5.2,rank).length),spray=ranks.map(rank=>M.particles(2.4,rank));
  assert.ok(ambient[0]<ambient[1]&&ambient[1]<ambient[2]);
  assert.ok(spray[0].length<spray[1].length&&spray[1].length<spray[2].length,'S has a restrained burst spray');
  assert.ok(spray[1].some(p=>p.star)&&spray[1].some(p=>!p.star),'S retains both burst stars and tiny dust');
  assert.ok(Math.max(...spray[1].map(p=>p.size))<Math.max(...spray[2].map(p=>p.size)),'S burst stars remain smaller than SS');
  // Foreground stars follow fire rank count/size and the real host clock,
  // not the slower wing clock: all grades keep the one-second lifecycle.
  let matched=0;
  for(const [w,h] of [[320,568],[390,844],[844,390],[1440,900]]){
    const box={x:12,y:28,width:Math.min(w-24,600),height:Math.max(120,h-300)},art=R.layout(w,h,box);
    for(const rank of ranks)for(let n=0;n<120;n++){
      const hostTime=.7+n*.07,s={...M.sample(hostTime*M.profile(rank).speed,rank),starTime:hostTime};
      const stars=R.sparkleFrames(w,h,art,s);
      const fire=FireRankSparkles.samples({time:hostTime,mana:FireRankSparkles.manaForRank(rank),referenceWidth:FireRankSparkles.referenceWidth(w,h)});
      assert.equal(stars.length,fire.length,rank+' has exactly the fire rank live count');
      for(let i=0;i<stars.length;i++){
        for(const field of ['id','birth','age','lifetime','radius','maxRadius','glow','alpha','angle'])assert.equal(stars[i][field],fire[i][field],rank+' preserves fire '+field);
        assert.equal(stars[i].lifetime,1);matched++;
      }
    }
  }
  assert.ok(matched>3000);
  console.log('Light ranks CPU passed: A gentle live wings without bursts, S intermediate energy, unchanged framing/roots, immutable deterministic profiles and exact fire S/SS foreground stars.',{ambient,spray:spray.map(p=>p.length),matched});
}finally{Math.random=random;Date.now=now;}
