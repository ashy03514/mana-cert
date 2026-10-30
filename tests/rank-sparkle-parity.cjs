'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
for(const file of ['element-material-renderer','fire-rank-sparkles','earth-rank-effects','earth-mountain-renderer','wind-rank-effects','wind-tornado-renderer'])require('../js/'+file+'.js');
const earth=Object.create(EarthMountainRenderer.prototype),wind=Object.create(WindTornadoRenderer.prototype);
const signature=frames=>frames.map(p=>[p.id,p.birth,p.age,p.lifetime,p.radius,p.angle]);
const originalRandom=Math.random;
Math.random=()=>{throw Error('rank glints must not change certification randomness');};
try{
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
    const fireBox=ElementMaterialRenderer.prototype.layout(width,height),earthBox=earth.layout(width,height);
    assert.equal(FireRankSparkles.referenceWidth(width,height),fireBox.width);
    for(const mana of [0,899,900,925,950,975,999,1000,9999]){
      const rank=mana>=1000?'SS':mana>=900?'S':'A';
      earth.profile=EarthRankEffects.forRank(rank);earth.formation=1;
      earth.meshes=EarthMountainRenderer.stonesForRank(rank).map(spec=>({spec,count:1}));
      const windProfile=WindRankEffects.profileForValue(mana),windBox=wind.layout(width,height,windProfile);
      for(const time of [.17,.73,1.25,2.17,3.32,7.9,120.17]){
        earth.lastTime=time*.86;earth.actionTime=time*.7;
        const expected=FireRankSparkles.frames(width,height,{time,mana,box:fireBox});
        const waterFrames=FireRankSparkles.frames(width,height,{time,mana,box:fireBox,element:'water'});
        const earthFrames=earth.sparkleFrames(earthBox,time,{width,height,mana});
        const windFrames=wind.sparkleFrames(windBox,time,2.25,1,windProfile,null,{mana,viewportWidth:width,viewportHeight:height});
        for(const frames of [waterFrames,earthFrames,windFrames])assert.deepEqual(signature(frames),signature(expected),
          `same active population, radius and one-second life at ${width}x${height}, mana ${mana}, time ${time}`);
        for(const p of earthFrames){
          assert.ok(p.x-p.glow>=0&&p.x+p.glow<=width,'earth glints fit the viewport');
          assert.ok(p.y-p.glow>=0&&p.y+p.glow<=Math.min(height,earthBox.y+earthBox.height)+1e-6,'earth glints stay inside the art region');
          assert.equal(p.color,'#ead6a5','earth retains its mineral colour');
        }
        assert.deepEqual(earth.sparkleFrames(earthBox,time,{width,height,mana}),earthFrames,'pause/replay are deterministic');
      }
    }
    for(const rank of ['E','D','C','B','A','S','SS']){
      earth.profile=EarthRankEffects.forRank(rank);earth.meshes=EarthMountainRenderer.stonesForRank(rank).map(spec=>({spec,count:1}));
      const expected=FireRankSparkles.samples({time:2.17,mana:FireRankSparkles.manaForRank(rank),referenceWidth:fireBox.width});
      assert.deepEqual(signature(earth.sparkleFrames(earthBox,2.17,{width,height})),signature(expected),'earth '+rank+' preview shares the fire specification');
    }
  }
  earth.profile=EarthRankEffects.forRank('SS');earth.formation=0;
  assert.deepEqual(earth.sparkleFrames(earth.layout(390,844),2.17),[],'no glints before earth assembly');
  earth.formation=1;earth.sparkleMana=1000;earth.viewportWidth=390;earth.viewportHeight=844;
  const c=createCanvas(390,844).getContext('2d');c.globalAlpha=.25;c.globalCompositeOperation='screen';
  const inheritedAlpha=c.globalAlpha;
  earth.sparkles(c,earth.layout(390,844),2.17);
  assert.equal(c.globalAlpha,inheritedAlpha);assert.equal(c.globalCompositeOperation,'screen','earth rendering preserves caller state');
}finally{Math.random=originalRandom;}
console.log('Rank sparkle parity passed: fire/water/earth/wind S-to-SS populations, screen-space radii, timing, previews, bounds and deterministic pause.');
