'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/fire-rank-sparkles.js');
require('../js/wind-rank-effects.js');
require('../js/wind-tornado-renderer.js');
// Exercise the actual sampling/drawing methods without creating a GPU owner.
const wind=Object.create(WindTornadoRenderer.prototype),box=wind.layout(390,844);
const sample=(time,speed=2.25,formation=1)=>wind.sparkleFrames(box,time,speed,formation);
const random=Math.random;
Math.random=()=>{throw Error('wind glints cannot consume certification randomness');};
try{
  assert.deepEqual(sample(2,2.25,0),[],'stars cannot appear before the wind forms');
  assert.deepEqual(sample(2.17),sample(2.17),'pausing the host clock freezes every star');
  assert.notDeepEqual(sample(2.17),sample(2.37),'stars keep moving while the revealed wind remains visible');
  const sides=new Set();
  for(let time=0;time<8;time+=.07){
    const frames=sample(time);assert.ok(frames.length<=24,'the population shares the fire limit of 24 slots');
    for(const p of frames){
      sides.add(p.front);
      for(const key of ['birth','age','x','y','radius','alpha','angle'])assert.ok(Number.isFinite(p[key]));
      assert.ok(p.age>0&&p.age<1);assert.equal(p.lifetime,1);
      assert.ok(p.radius>0&&p.alpha>=0&&p.alpha<=1);
    }
  }
  assert.deepEqual([...sides].sort(),[false,true],'stars occupy both near and far sides of the wind');
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
    const referenceWidth=FireRankSparkles.referenceWidth(width,height);
    for(const mana of [899,900,920,950,975,999,1000,9999]){
      const profile=WindRankEffects.profileForValue(mana),bounds=wind.layout(width,height,profile);
      for(const time of [.17,.65,1.25,2.17,3.32,7.9]){
        const shared=FireRankSparkles.samples({time,mana,referenceWidth});
        const frames=wind.sparkleFrames(bounds,time,2.25,1,profile,null,{mana,viewportWidth:width,viewportHeight:height});
        assert.equal(frames.length,shared.length,'wind and fire have the same active population for the displayed mana');
        for(let i=0;i<frames.length;i++){
          for(const key of ['id','radius','maxRadius','birth','age','lifetime','angle'])
            assert.equal(frames[i][key],shared[i][key],key+' matches fire without extra rank or depth scaling');
        }
      }
    }
    for(const rank of ['E','D','C','B','A','S','SS']){
      const profile=WindRankEffects.forRank(rank),bounds=wind.layout(width,height,profile);
      const options={viewportWidth:width,viewportHeight:height};
      const preview=wind.sparkleFrames(bounds,2.17,2.25,1,profile,null,options);
      const expected=FireRankSparkles.samples({time:2.17,mana:FireRankSparkles.manaForRank(rank),referenceWidth});
      assert.deepEqual(preview.map(p=>[p.id,p.radius,p.birth]),expected.map(p=>[p.id,p.radius,p.birth]),
        rank+' preview shares the fire rank baseline');
    }
  }
  const reference=FireRankSparkles.samples({time:2.17,mana:1000,referenceWidth:FireRankSparkles.referenceWidth(390,844)});
  assert.deepEqual(sample(2.17).map(p=>[p.id,p.radius,p.birth]),reference.map(p=>[p.id,p.radius,p.birth]),
    'the existing six-argument call retains the default viewport contract');
  assert.deepEqual(wind.sparkleFrames(box,2.17,2.25,1,{...WindRankEffects.forRank('SS'),starScale:0}),sample(2.17),
    'legacy profile starScale does not shrink or suppress shared fire stars');
  const seed=sample(3.17).find(p=>p.birth>0),birth=seed.birth;
  for(const speed of [1,2.25]){
    const follow=age=>sample(birth+age,speed).find(p=>p.id===seed.id&&Math.abs(p.birth-birth)<1e-8);
    assert.equal(follow(-.001),undefined,'the selected star is absent before birth');
    assert.equal(follow(1.001),undefined,'the selected star disappears after one active second at either speed');
    const life=[.025,.16,.32,.62,.90,.97].map(follow);
    assert.ok(life.every(Boolean),'the full one-second life remains readable at 1.5x wind playback');
    assert.ok(life[0].radius<life[1].radius&&life[1].radius<life[2].radius,'the star grows into view');
    for(let i=3;i<life.length;i++)assert.ok(life[i].radius<life[i-1].radius,'the star shrinks away');
    for(let i=1;i<life.length;i++){
      assert.ok(life[i].y<life[i-1].y,'the star rises throughout growth and shrinkage');
      assert.ok(life[i].angle>life[i-1].angle,'the star continues to rotate');
    }
    assert.ok(life[0].y-life.at(-1).y>15,'upward movement is visibly more than a shimmer');
  }
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
    const bounds=wind.layout(width,height);
    for(let time=0;time<8;time+=.07)for(const p of wind.sparkleFrames(bounds,time,2.25,1,WindRankEffects.forRank('SS'),null,
      {viewportWidth:width,viewportHeight:height})){
      assert.ok(p.y+p.radius*1.65<height-220,'stars and glow remain above the title and controls');
    }
  }
  const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');
  const glint=[{x:50,y:50,radius:20,angle:0,alpha:1,color:'#ffffff'}];
  ctx.globalAlpha=.6;ctx.globalCompositeOperation='screen';
  const previousAlpha=ctx.globalAlpha;
  const maxAlpha=opacity=>{
    ctx.clearRect(0,0,100,100);FireRankSparkles.drawFrames(ctx,glint,opacity);
    const pixels=ctx.getImageData(0,0,100,100).data;let max=0;
    for(let i=3;i<pixels.length;i+=4)max=Math.max(max,pixels[i]);return max;
  };
  // Halo and solid core overlap; compare their composited alpha instead of
  // assuming that a two-layer drawing has the alpha of a single fill.
  const full=maxAlpha(1),faded=maxAlpha(.4);
  assert.ok(full>200&&faded<full*.7&&faded>full*.25,'formation opacity fades the complete core and halo');
  assert.equal(maxAlpha(0),0,'zero formation opacity draws no star or halo');
  assert.equal(ctx.globalAlpha,previousAlpha);assert.equal(ctx.globalCompositeOperation,'screen');
  console.log('Wind sparkles passed: fire-matched population, size and timing; deterministic one-second growth/shrink, rise/spin, depth, viewport clearance and shared opacity.');
}finally{Math.random=random;}
