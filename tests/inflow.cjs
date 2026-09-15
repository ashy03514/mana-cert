const assert=require('node:assert/strict');
require('../js/config.js');require('../js/magic-interaction.js');
{
  const f=new MagicField(ManaConfig.interaction,390,844,()=>0.43);
  f.down(1,195,422,0);
  const q=f.particles[0];q.x=200;q.y=422;q.feedAge=0;q.feedDwell=0;
  f.step(1/60);
  assert.equal(q.feedAlpha,0,'arrival disappears in the first simulation frame');
  assert.ok(q.x<0||q.x>390||q.y<0||q.y>844,'arrival immediately replenishes from outside');
  assert.equal(q.feedDwell,0);
}
for(const [width,height] of [[390,844],[1440,900]]){
  let seed=19;
  const f=new MagicField(ManaConfig.interaction,width,height,()=>{seed=seed*16807%2147483647;return seed/2147483647;});
  const refs=f.particles.slice(),edges=new Set();let arrivals=0,previous=0;
  f.down(1,width/2,height/2,0);
  for(let i=0;i<3600;i++){
    if(i%120===0)f.move(1,width*(0.3+0.4*(i%240===0)),height/2,i/60*1000);
    f.step(1/60);
    for(const q of f.particles){
      assert.ok(q.feedAlpha>=0&&q.feedAlpha<=1);
      if(q.feedAge===0&&q.feedAlpha===0&&q.kind!==2){
        arrivals++;
        edges.add(q.x<0?'left':q.x>width?'right':q.y<0?'top':'bottom');
        assert.ok(q.x<0||q.x>width||q.y<0||q.y>height,'replacement is outside viewport');
        assert.ok((f.pointer.x-q.x)*q.vx+(f.pointer.y-q.y)*q.vy>0,'replacement travels toward the finger');
      }
    }
    if(i%600===599){assert.ok(arrivals>previous,'supply continues every ten seconds');previous=arrivals;}
  }
  assert.equal(edges.size,4);assert.ok(refs.every((q,i)=>q===f.particles[i]));
  assert.equal(refs.length,f.particles.length);
  f.release();const serial=f.feedSerial;
  for(let i=0;i<60;i++)f.step(1/60);
  assert.equal(f.feedSerial,serial);assert.ok(f.particles.every(q=>q.feedAlpha===1));
  f.down(2,width/2,height/2,61000);f.takeControl();
  for(let i=0;i<60;i++)f.step(1/60,i/60);
  assert.equal(f.feedSerial,serial,'gathering cannot recycle particles');
  f.reset();assert.equal(f.feedSerial,0);assert.ok(f.particles.every(q=>q.feedAlpha===1&&q.feedDwell===0));
}
console.log('Inflow checks passed: sustained four-edge supply, inward travel, stable pool, release, gather and reset.');
