'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/fire-rank-embers.js');
require('../js/fire-scan-transition.js');
require('../js/element-material-renderer.js');
const E=FireRankEmbers,random=Math.random;
Math.random=()=>{throw Error('cinders cannot consume result randomness');};
try{
  const layoutFor=(w,h)=>FireScanTransition.layout(w,h,ElementMaterialRenderer.prototype.layout(w,h),1);
  const box=layoutFor(390,844).box;
  const sample=(mana,time)=>E.frames(390,844,{mana,time,box});
  for(const mana of [0,124,750,900,999])assert.deepEqual(sample(mana,2),[],'extra cinders only appear at SS');
  for(const bad of [{time:NaN},{mana:Infinity},{box:{...box,width:0}},{box:{...box,y:NaN}}])
    assert.deepEqual(E.frames(390,844,{mana:1000,time:2,box,...bad}),[]);
  const averages=mana=>{
    let count=0,radius=0;
    for(let t=0;t<12;t+=.1){
      const frames=sample(mana,t);assert.ok(frames.length<=96,'cinder work is bounded');
      count+=frames.length;for(const p of frames)radius+=p.radius;
    }
    return {count:count/121,radius:radius/count};
  };
  const entry=averages(1000),full=averages(9999);
  assert.ok(entry.count>=45&&entry.count<=70,'SS entry produces many separate fragments');
  assert.ok(full.count>=55&&full.count<=85,'full SS is a rich but bounded shower');
  assert.ok(full.count>entry.count*1.15,'stronger SS has a denser shower');
  assert.deepEqual(sample(9999,3.17),sample(9999,3.17),'pause is exactly stable');
  assert.notDeepEqual(sample(9999,3.17),sample(9999,3.37),'embers remain alive after the value stops');
  const frame=sample(9999,3.17),speeds=new Set(frame.map(p=>Math.round(Math.hypot(p.vx,p.vy))));
  assert.ok(speeds.size>25,'independent velocities provide depth');
  const earlier=sample(9999,3.17),later=sample(9999,3.22);let tracked=0;
  for(const p of earlier){
    const q=later.find(q=>q.id===p.id&&Math.abs(q.birth-p.birth)<1e-8);if(!q)continue;
    tracked++;assert.ok(q.y<p.y,'every live cinder travels upward');
    assert.ok(q.vy<p.vy,'buoyancy keeps accelerating the ascent');
    assert.equal(q.sourceY,p.sourceY,'a fragment has a fixed birth position');
    assert.ok(p.tailY>p.y,'the short trail stays behind rising motion');
  }
  assert.ok(tracked>40,'enough cinders persist to test continuous movement');
  for(const [w,h] of [[390,844],[320,568],[375,667],[844,390]]){
    const layout=layoutFor(w,h),b=layout.box,root=b.y+b.height/2+b.width*.33;
    for(let t=0;t<8;t+=.17)for(const p of E.frames(w,h,{mana:9999,time:t,box:b})){
      for(const key of ['x','y','vx','vy','sourceX','sourceY','radius','alpha','tailX','tailY','angle'])
        assert.ok(Number.isFinite(p[key]),`${key} is finite`);
      assert.ok(p.radius>0&&p.radius<6,'small flecks with a few near fragments');
      assert.ok(p.alpha>0&&p.alpha<=1);
      assert.ok(Math.max(p.y,p.tailY)+p.radius*3<=root-12,'cinder and trail stay above the numeric area');
      if(layout.sideBySide)assert.ok(p.x+p.radius*3<layout.numbers.x-55,'landscape readout is clear');
    }
  }
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  const draw=()=>{ctx.clearRect(0,0,390,844);E.draw(ctx,390,844,{mana:9999,time:3.17,box});return Buffer.from(ctx.getImageData(0,0,390,844).data);};
  ctx.globalAlpha=.63;ctx.globalCompositeOperation='screen';ctx.lineWidth=7;ctx.lineCap='square';
  const alpha=ctx.globalAlpha,pixels=draw();
  assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.globalCompositeOperation,'screen');
  assert.equal(ctx.lineWidth,7);assert.equal(ctx.lineCap,'square');
  assert.ok(pixels.some(v=>v>100),'real ember pixels are drawn');assert.deepEqual(draw(),pixels);
  const originalStroke=ctx.stroke;
  try{
    ctx.stroke=()=>{throw Error('draw interrupted');};assert.throws(draw,/draw interrupted/);
    assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.globalCompositeOperation,'screen','state restored after drawing failure');
  }finally{ctx.stroke=originalStroke;}
  console.log('Fire rank embers passed: SS-only cinders, depth, upward buoyancy, pause, bounded count and text clearance.',{entry,full});
}finally{Math.random=random;}
