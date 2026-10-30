'use strict';
const assert=require('node:assert/strict');
require('../js/fire-rank-sparkles.js');
require('../js/light-holy-shader.js');
require('../js/light-holy-wings.js');
require('../js/light-holy-renderer.js');
const L=LightHolyRenderer,shared=FireRankSparkles,helper=Object.create(L.prototype);

// Reveal samples must be seekable, bounded, and gentle across phase boundaries.
for(const t of [-1,NaN,Infinity,-Infinity])assert.deepEqual(L.sample(t),L.sample(0));
for(let i=0;i<=1200;i++){
  const t=i/100,s=L.sample(t),next=L.sample(t+.00001);
  for(const key of ['core','wings','crown','awaken','pulse']){
    assert.ok(Number.isFinite(s[key])&&s[key]>=0&&s[key]<=1,key+' stays in range');
    assert.ok(Math.abs(s[key]-next[key])<.001,key+' has no abrupt phase jump');
  }
  if(t>=3.6)assert.equal(s.awaken,0,'awakening flash resolves into a persistent effect');
  if(t>=3.2){assert.equal(s.core,1);assert.equal(s.wings,1);assert.equal(s.crown,1);}
  if(t>=3)assert.ok(Math.abs(s.pulse-L.sample(t+2).pulse)<1e-12,'background pulse repeats every two active seconds');
}
assert.ok(L.sample(.6).core>.5&&L.sample(.6).wings===0,'light condenses before wing emergence');
assert.ok(L.sample(2.3).wings>.7&&L.sample(2.3).wings<1,'unfolding precedes final awakening');
assert.ok(L.sample(2.8).awaken>.9,'final awakening is a short accent');

const oldRandom=Math.random;
Math.random=()=>{throw Error('art sampling must not consume certification randomness');};
try{
  for(const [w,h,box] of [
    [320,568,{x:4,y:48,width:312,height:214}],
    [390,844,{x:4,y:52,width:382,height:447}],
    [844,390,{x:18,y:52,width:480,height:302}],
    [1440,900,{x:158,y:52,width:714,height:760}]
  ]){
    const art=helper.layout(w,h,box),original={...box};
    assert.ok(art.unit>0&&art.unit<=320,'projection scale is bounded');
    assert.equal(art.cx,box.x+box.width/2,'light stays centred in the art viewport');
    assert.ok(art.cy>box.y&&art.cy<box.y+box.height);
    art.box.x++;assert.deepEqual(box,original,'layout never mutates the host viewport');
    assert.equal(helper.sparkleFrames(w,h,art,L.sample(.6)).length,0,'no rank stars before wing emergence');
    for(const time of [3.6,5.2,6.3,12,120,10000]){
      const samples=shared.samples({time,mana:1000,referenceWidth:shared.referenceWidth(w,h)});
      const stars=helper.sparkleFrames(w,h,art,L.sample(time));
      assert.equal(stars.length,samples.length,'SS star count matches the shared fire specification');
      assert.deepEqual(stars,helper.sparkleFrames(w,h,art,L.sample(time)),'star positions are deterministic');
      for(let i=0;i<stars.length;i++){
        const p=stars[i],reference=samples[i];
        for(const key of ['id','birth','age','lifetime','radius','maxRadius','glow','angle'])assert.equal(p[key],reference[key],key+' retains fire parity');
        assert.equal(p.lifetime,1,'each star lasts one active second');
        assert.ok([p.x,p.y,p.alpha].every(Number.isFinite));
        assert.ok(p.x-p.glow>=0&&p.x+p.glow<=w,'star peak glow stays inside horizontal edges');
        assert.ok(p.y-p.glow>=0&&p.y+p.glow<=Math.min(h,art.bottom),'rank stars stay above the readout area');
      }
    }
    const snapshot=helper.sparkleFrames(w,h,art,L.sample(5.2));
    helper.sparkleFrames(w,h,art,L.sample(100000));
    assert.deepEqual(helper.sparkleFrames(w,h,art,L.sample(5.2)),snapshot,'seeking into the future does not alter earlier art');
  }
}finally{Math.random=oldRandom;}

function context2d(){
  const stack=[],c={globalAlpha:1,globalCompositeOperation:'source-over',fills:[],images:[]};
  c.save=()=>stack.push({globalAlpha:c.globalAlpha,globalCompositeOperation:c.globalCompositeOperation});
  c.restore=()=>Object.assign(c,stack.pop());
  c.drawImage=(...args)=>c.images.push({alpha:c.globalAlpha,args});
  c.fill=()=>c.fills.push(c.globalAlpha);
  c.fillRect=()=>c.fills.push(c.globalAlpha);
  c.stroke=()=>c.fills.push(c.globalAlpha);
  for(const name of ['clearRect','beginPath','arc','moveTo','quadraticCurveTo','bezierCurveTo','closePath','translate','scale','rotate','clip'])c[name]=()=>{};
  c.createRadialGradient=()=>({addColorStop(){}});
  c.createLinearGradient=()=>({addColorStop(){}});
  return c;
}
function makeGL(failCompile=false){
  const gl={shaders:new Set(),programs:new Set(),buffers:new Set(),draws:0,failCompile};
  for(const name of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','BLEND','DEPTH_TEST','CULL_FACE','FLOAT','TRIANGLES'])gl[name]=name;
  for(const [name,collection] of [['Shader','shaders'],['Program','programs'],['Buffer','buffers']]){
    gl['create'+name]=()=>{const resource={};gl[collection].add(resource);return resource;};
    gl['delete'+name]=resource=>{assert.ok(gl[collection].delete(resource),'only owned '+name+' resources are released');};
  }
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','bufferData','disable','viewport','useProgram','enableVertexAttribArray','vertexAttribPointer','uniform2f','uniform4f','uniform1f'])gl[name]=()=>{};
  gl.getShaderParameter=()=>!gl.failCompile;gl.getProgramParameter=()=>true;
  gl.getShaderInfoLog=()=> 'intentional compile failure';
  gl.getAttribLocation=()=>0;gl.getUniformLocation=(_,name)=>name;
  gl.drawArrays=()=>gl.draws++;
  return gl;
}
function fixture(gl=makeGL()){
  const canvases=[];
  const create=()=>{
    const listeners=new Map(),ctx=context2d();
    const canvas={width:300,height:150,listeners,ctx,
      getContext:type=>type==='2d'?ctx:gl,
      addEventListener:(name,callback)=>listeners.set(name,callback),
      removeEventListener:(name,callback)=>{assert.equal(listeners.get(name),callback);listeners.delete(name);}
    };canvases.push(canvas);return canvas;
  };
  return {renderer:new L(create),gl,canvases,ctx:context2d()};
}
{
  const {renderer:r,gl,ctx}=fixture();
  assert.equal(gl.programs.size,0,'WebGL initialization is lazy');
  for(const [w,h] of [[0,844],[390,-1],[NaN,844],[390,Infinity]])assert.equal(r.draw(ctx,w,h),false);
  assert.equal(gl.programs.size,0,'invalid viewport does not allocate GPU resources');
  ctx.globalAlpha=.5;
  assert.equal(r.draw(ctx,390,844,{time:5.2,opacity:.4}),true);
  assert.equal(gl.shaders.size,0,'linked temporary shader objects are released');
  assert.equal(gl.programs.size,1);assert.equal(gl.buffers.size,1);
  assert.equal(ctx.globalAlpha,.5,'draw restores caller alpha');
  assert.ok(ctx.fills.length>0&&ctx.fills.every(alpha=>alpha>=0&&alpha<=.2),'dust and stars inherit caller opacity');
  assert.equal(ctx.images[0].alpha,.2,'full-frame image inherits caller opacity');
  const count=gl.draws;
  r.draw(ctx,390,844,{time:5.2});assert.equal(gl.draws,count,'identical paused render uses the cached composite');
  r.draw(ctx,390,844,{time:5.21});assert.equal(gl.draws,count,'GPU updates are capped without advancing inspected state');
  r.draw(ctx,390,844,{time:5.25});assert.equal(gl.draws,count+1,'active time advances the effect');
  r.draw(ctx,390,844,{time:.6});assert.equal(gl.draws,count+2,'rewinding refreshes immediately');
  r.draw(ctx,844,390,{time:.6});assert.equal(gl.draws,count+3,'paused resize refreshes the art projection');
  let prevented=false;r.canvas.listeners.get('webglcontextlost')({preventDefault(){prevented=true;}});
  assert.ok(prevented&&r.lost);assert.equal(r.draw(ctx,390,844,{time:5.2}),false,'lost context does not attempt drawing');
  // A real driver invalidates all old objects on loss.
  gl.programs.clear();gl.buffers.clear();
  r.canvas.listeners.get('webglcontextrestored')();assert.equal(r.lost,false);assert.equal(gl.programs.size,1);
  assert.equal(r.draw(ctx,390,844,{time:5.2}),true,'restoration rebuilds resources at the same active time');
  r.dispose();r.dispose();assert.equal(gl.programs.size,0);assert.equal(gl.buffers.size,0);
  assert.equal(r.canvas.listeners.size,0,'dispose removes owned context listeners');
  assert.equal(r.canvas.width,1);assert.equal(r.patch.width,1);
  assert.equal(r.draw(ctx,390,844,{time:5.2}),false,'disposed art cannot restart itself');
}
{
  const {renderer:r,gl,ctx}=fixture(makeGL(true));
  assert.equal(r.draw(ctx,390,844),false);assert.ok(r.error&&r.diagnostic.includes('intentional compile failure'));
  assert.equal(gl.programs.size,0);assert.equal(gl.shaders.size,0);assert.equal(gl.buffers.size,0,'initialization failure leaves no GPU resources');
  r.dispose();
}
{
  // Exercise the real feather paths and overlap, independently of WebGL, so
  // paused/replayed wings cannot silently depend on prior animation frames.
  const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
  const {createHash}=require('node:crypto'),canvas=createCanvas(640,640),ctx=canvas.getContext('2d');
  const art={cx:320,cy:320,unit:180,bottom:620};
  const at=(time,opacity=1)=>{
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,640,640);ctx.globalAlpha=opacity;
    const before=ctx.getTransform();LightHolyWings.draw(ctx,art,L.sample(time));
    assert.equal(ctx.globalAlpha,opacity,'feathers preserve caller alpha');
    const after=ctx.getTransform();
    for(const key of ['a','b','c','d','e','f'])assert.equal(after[key],before[key],'feathers restore the caller transform');
    const pixels=ctx.getImageData(0,0,640,640).data;
    let occupied=0,alpha=0,left=0,right=0,ivory=0;
    for(let i=0;i<pixels.length;i+=4){
      alpha+=pixels[i+3];
      if(pixels[i+3]>12){
        occupied++;if((i/4)%640<320)left++;else right++;
        if(pixels[i]>150&&pixels[i+1]>140&&pixels[i+2]>100)ivory++;
      }
    }
    return {hash:createHash('sha256').update(pixels).digest('hex'),occupied,alpha,left,right,ivory};
  };
  const noRandom=Math.random;Math.random=()=>{throw Error('feather geometry must not consume result randomness');};
  try{
    assert.equal(at(.6).occupied,0,'wings remain absent during initial core condensation');
    const early=at(.9),full=at(5.2);
    assert.ok(full.occupied>early.occupied*2,'feather silhouette opens substantially during the reveal');
    assert.ok(full.left>5000&&full.right>5000,'actual feather paths paint both wings with substantial area');
    assert.ok(full.ivory>full.occupied*.80,'feather material retains a light ivory body');
    assert.deepEqual(at(5.2),full,'paused feather surface is pixel-identical');
    assert.notEqual(at(6.3).hash,full.hash,'wing and flexible feather tips keep moving after reveal');
    at(10000);assert.deepEqual(at(5.2),full,'long playback and rewind reproduce the same feather pose');
    assert.ok(at(5.2,.2).alpha<full.alpha*.75,'feather overlaps still respect fading of the entire effect');
    assert.equal(at(5.2,0).alpha,0,'zero opacity leaves no feather residue');
  }finally{Math.random=noRandom;}
}
console.log('Light SS CPU passed: continuous timeline, shared fire star parity, bounds and deterministic rewind, feather geometry/ivory material/ongoing motion, opacity, cached rendering, context recovery and resource cleanup.');
