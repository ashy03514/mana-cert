'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/fire-rank-sparkles.js');
require('../js/fire-scan-transition.js');
require('../js/element-material-renderer.js');
const F=FireRankSparkles,random=Math.random;
Math.random=()=>{throw Error('visual glints cannot consume result randomness');};
try{
  const base=ElementMaterialRenderer.prototype.layout(390,844);
  const box=FireScanTransition.layout(390,844,base,1).box;
  const sample=(mana,time)=>F.frames(390,844,{mana,time,box});
  for(const mana of [0,124,750,899])assert.deepEqual(sample(mana,2),[],'no rank glints below S');
  const stats=mana=>{
    let count=0,radius=0,alpha=0;
    for(let t=0;t<10;t+=.1){
      const frames=sample(mana,t);assert.ok(frames.length<=24);
      for(const f of frames){count++;radius+=f.radius;alpha+=f.alpha;}
    }
    return {count:count/100,radius:radius/count,alpha:alpha/count};
  };
  const s=stats(925),ss=stats(1000);
  assert.ok(s.count>=3&&s.count<=7,'S has several independently timed glints');
  assert.ok(ss.count>s.count*2,'SS is noticeably richer in glints');
  assert.ok(ss.radius>s.radius*1.6,'SS glints are noticeably larger');
  assert.deepEqual(sample(1000,2.17),sample(1000,2.17),'pause is exact');
  assert.notDeepEqual(sample(1000,2.17),sample(1000,2.37),'glints remain alive after the number stops');
  const seed=sample(1000,2.17)[0],birth=seed.birth;
  const follow=age=>sample(1000,birth+age).find(f=>f.id===seed.id&&Math.abs(f.birth-birth)<1e-8);
  const life=[.025,.16,.32,.62,.90,.97].map(follow);
  assert.ok(life.every(Boolean),'one star can be followed through the full visible life');
  assert.equal(follow(-.001),undefined,'the star does not exist before birth');
  assert.equal(follow(1),undefined,'the star is gone exactly one second after birth');
  assert.equal(follow(1.05),undefined,'respawn gap is separate from visible life');
  assert.ok(life[0].radius<life[1].radius&&life[1].radius<life[2].radius,'the star expands to its peak');
  for(let i=3;i<life.length;i++)assert.ok(life[i].radius<life[i-1].radius,'the star shrinks through disappearance');
  for(let i=1;i<life.length;i++){
    assert.ok(life[i].y<life[i-1].y,'the star rises throughout growth and shrinkage');
    assert.ok(life[i].angle>life[i-1].angle,'the star keeps rotating');
    assert.equal(life[i].x,life[0].x,'size changes do not push a star sideways at the view bounds');
  }
  assert.ok(life[0].y-life.at(-1).y>20,'upward travel is visibly more than a tiny shimmer');
  assert.ok(life.at(-1).angle-life[0].angle>2,'rotation remains visible during the one-second life');
  for(const [w,h] of [[390,844],[320,568],[375,667],[844,390]]){
    const b=ElementMaterialRenderer.prototype.layout(w,h),layout=FireScanTransition.layout(w,h,b,1);
    const root=layout.box.y+layout.box.height/2+layout.box.width*.33;
    for(let time=0;time<5;time+=.1)for(const f of F.frames(w,h,{mana:9999,time,box:layout.box})){
      for(const key of ['x','y','radius','alpha','angle'])assert.ok(Number.isFinite(f[key]));
      assert.ok(f.y+f.radius*1.65<=root-11.9,'stars and glow remain above the numeric zone');
      assert.ok(f.x-f.radius*1.65>=0&&f.x+f.radius*1.65<=w,'glow stays within view');
      if(layout.sideBySide)assert.ok(f.x+f.radius*1.65<layout.numbers.x-80,'landscape text is clear');
    }
  }
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  const draw=()=>{ctx.clearRect(0,0,390,844);F.draw(ctx,390,844,{mana:1000,time:2.17,box});return Buffer.from(ctx.getImageData(0,0,390,844).data);};
  ctx.globalAlpha=.63;ctx.globalCompositeOperation='screen';
  const alpha=ctx.globalAlpha;
  const image=draw();assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.globalCompositeOperation,'screen');
  assert.ok(image.some(v=>v>100),'actual star pixels are drawn');assert.deepEqual(draw(),image);
  const originalFrames=F.frames;
  try{
    for(const angle of [0,Math.PI/7]){
      F.frames=()=>[{x:80,y:80,radius:32,angle,alpha:1,color:'#ffffff'}];
      const isolated=createCanvas(160,160),paint=isolated.getContext('2d');F.draw(paint,160,160,{});
      const pixels=paint.getImageData(0,0,160,160).data;let left=160,right=0,top=160,bottom=0;
      for(let y=0;y<160;y++)for(let x=0;x<160;x++)if(pixels[(y*160+x)*4+3]>200){
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      assert.ok(right-left>20,'the high-alpha core is visible independently of the halo');
      assert.ok(Math.abs((right-left)-(bottom-top))<=1,'actual four-arm silhouette has equal width and height, including when rotated');
    }
  }finally{F.frames=originalFrames;}
  console.log('Fire rank sparkles passed: equal arms, one-second growth/shrink, continuous spin/rise, S/SS, pause and text clearance.',{s,ss});
}finally{Math.random=random;}
