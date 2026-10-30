'use strict';

// Pixel oracle: the frozen, user-approved preview is independent of production.
// Run with: node tests/ribbon-parity.cjs
// Override MANA_CANVAS_MODULE on machines with a different native Canvas install.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {MagicTrailReference,W,H}=require('./fixtures/magic-trail-reference.cjs');
require('../js/effect-settings.js');
require('../js/ribbon-renderer.js');
require('../js/finger-trails.js');
require('../js/config.js');
require('../js/portal-scene.js');

const SCALE=2;
const clone=value=>JSON.parse(JSON.stringify(value));
const makeCanvas=()=>createCanvas(W*SCALE,H*SCALE);
function prepare(canvas){
  const c=canvas.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);
  c.setTransform(SCALE,0,0,SCALE,0,0);
  c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='source-over';
  return c;
}
function paintReference(strokes,time,{background=false,composite=false}={}){
  const ref=new MagicTrailReference();ref.time=time;
  const layer=makeCanvas(),lc=prepare(layer);
  for(const stroke of clone(strokes)){
    ref.options.color=stroke.color||'#7deaff';
    ref.renderStroke(stroke,lc);
  }
  if(!composite)return layer;
  const output=makeCanvas(),c=prepare(output);
  if(background)ref.background(c);
  c.globalAlpha=.86;c.drawImage(layer,0,0,W,H);c.globalAlpha=1;
  return output;
}
function paintRenderer(strokes,time){
  const canvas=makeCanvas(),c=prepare(canvas);
  const renderer=new RibbonRenderer({color:'#7deaff',flow:80,detail:100,hold:2});
  renderer.time=time;
  for(const stroke of clone(strokes)){
    renderer.options.color=stroke.color||'#7deaff';
    renderer.renderStroke(stroke,c);
  }
  return canvas;
}
function makeTrails(){
  const trails=new FingerTrails(EffectSettings.normalize(),()=>createCanvas(1,1));
  trails.resize(W,H);
  return trails;
}
function paintTrails(strokes,time,{background=false}={}){
  const trails=makeTrails();
  trails.strokes=clone(strokes);trails.time=time;
  const canvas=makeCanvas(),c=prepare(canvas);
  if(background){
    const portal=new PortalScene(c,W,H,()=>createCanvas(1,1));
    portal.time=time;portal.orbitTime=time;portal.positionPools();portal.drawBackground();
  }
  trails.draw(c);
  return canvas;
}
function equalPixels(actual,expected,label){
  assert.equal(actual.width,expected.width,label+' width');
  assert.equal(actual.height,expected.height,label+' height');
  const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;
  const b=expected.getContext('2d').getImageData(0,0,expected.width,expected.height).data;
  let differences=0,max=0,first=-1;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
    differences++;max=Math.max(max,Math.abs(a[i]-b[i]));if(first<0)first=i;
  }
  assert.equal(differences,0,
    `${label}: ${differences} different channels, max error ${max}, first channel ${first}`);
}

const ref=new MagicTrailReference();
const curve=ref.makeExample();
const corner=[
  {x:55,y:180,speed:.1},{x:130,y:120,speed:.8},
  {x:285,y:180,speed:.6},{x:220,y:290,speed:.15},
  {x:115,y:330,speed:.5},{x:185,y:450,speed:.95}
];
const stroke=(points,released=null,seed=1,color='#7deaff')=>
  ({points:clone(points),released,seed,color,route:null});
const cases=[
  {name:'active figure-eight / 1.6s',time:1.6,strokes:[stroke(curve)]},
  {name:'active figure-eight / 3.8s',time:3.8,strokes:[stroke(curve)]},
  {name:'held curve at retention boundary',time:4,strokes:[stroke(curve,2)]},
  {name:'curve begins dissolving',time:4.3,strokes:[stroke(curve,2)]},
  {name:'curve mid dissolution',time:4.8,strokes:[stroke(curve,2)]},
  {name:'late dust only',time:6.2,strokes:[stroke(curve,2)]},
  {name:'fully expired stroke',time:6.5,strokes:[stroke(curve,2)]},
  {name:'active stationary tap',time:7,strokes:[stroke([{x:195,y:300,speed:.5}])]},
  {name:'released stationary tap',time:4.8,strokes:[stroke([{x:195,y:300,speed:.5}],2)]},
  {name:'single short segment',time:2.7,strokes:[stroke([{x:100,y:200,speed:.2},{x:111,y:207,speed:.8}],1)]},
  {name:'sharp corner speed variation',time:3.1,strokes:[stroke(corner)]},
  {name:'purple stroke',time:1.6,strokes:[stroke(curve,null,2.3,'#ce83ff')]},
  {name:'white stroke',time:1.6,strokes:[stroke(curve,null,3.7,'#ffffff')]},
  {name:'two crossing multicolor strokes',time:3.1,
    strokes:[stroke(curve,1,2.3),stroke(corner,null,3.7,'#ce83ff')]},
  {name:'six exactly overlapping strokes',time:2.5,
    strokes:Array.from({length:6},(_,i)=>stroke(curve,null,i+.25))}
];

for(const test of cases){
  equalPixels(paintRenderer(test.strokes,test.time),
    paintReference(test.strokes,test.time),`RibbonRenderer / ${test.name}`);
  equalPixels(paintTrails(test.strokes,test.time),
    paintReference(test.strokes,test.time,{composite:true}),`FingerTrails / ${test.name}`);
}

// Exercise real integration state as well as controlled render inputs. Geometry
// is the recorded input to the oracle; rendering/fade/compositing remains separate.
const live=makeTrails();
live.down(70,90,0);
for(let i=1;i<corner.length;i++)live.move(corner[i].x,corner[i].y,i*35);
live.step(.5);
assert.equal(live.strokes[0].color,'#7deaff','default color matches the approved preview');
assert.ok(live.strokes[0].points.every(p=>Number.isFinite(p.speed)),
  'pointer geometry carries finite speed for the reference variable-width line');
const liveCanvas=makeCanvas();live.draw(prepare(liveCanvas));
equalPixels(liveCanvas,paintReference(live.strokes,live.time,{composite:true}),
  'FingerTrails / actual input and active pointer');
live.release();live.step(2.7);
const releasedCanvas=makeCanvas();live.draw(prepare(releasedCanvas));
equalPixels(releasedCanvas,paintReference(live.strokes,live.time,{composite:true}),
  'FingerTrails / actual release and fade timing');

// A stopped pointer is not a paused animation. The retained reveal drawing
// keeps its exact geometry/opacity while light packets, wisps and dust advance.
const retained=makeTrails();
retained.down(70,90,0);
for(let i=1;i<corner.length;i++)retained.move(corner[i].x,corner[i].y,i*35);
const paintRetained=()=>{const canvas=makeCanvas();retained.draw(prepare(canvas));return canvas;};
const moving=paintRetained().toBuffer('image/png');
const retainedGeometry=JSON.stringify(retained.active.points);
retained.step(.4);
assert.ok(!paintRetained().toBuffer('image/png').equals(moving),
  'holding a drawn curve still keeps its light flowing without new pointer events');
assert.equal(JSON.stringify(retained.active.points),retainedGeometry,
  'stationary-pointer animation preserves the recorded drawing');
retained.release();retained.step(2.75);
const retainedStroke=retained.strokes[0],heldAge=retained.ageTime;
const heldOpacity=retained.opacity(retainedStroke),heldRelease=retainedStroke.released;
const beforeRetain=paintRetained().toBuffer('image/png');
for(let i=0;i<24;i++)retained.step(.05,{freezeAging:true});
assert.ok(Math.abs(retained.ageTime-heldAge)<1e-9,'reveal retention freezes only the lifetime clock');
assert.equal(retainedStroke.released,heldRelease,'retention never rewrites the release timestamp');
assert.ok(Math.abs(retained.opacity(retainedStroke)-heldOpacity)<1e-9,
  'custom hold/fade progress is retained without resetting its opacity');
const afterRetain=paintRetained();
assert.ok(!afterRetain.toBuffer('image/png').equals(beforeRetain),
  'released ink visibly animates throughout the reveal waiting period');
const referenceRetained=clone(retained.strokes);
for(const s of referenceRetained)if(s.released!==null)s.released+=retained.time-retained.ageTime;
equalPixels(afterRetain,paintReference(referenceRetained,retained.time,{composite:true}),
  'retained ink uses current visual phase with the unchanged reference fade progress');
equalPixels(paintRetained(),afterRetain,'a true pause without clock updates freezes every ribbon pixel');
retained.step(.75);
assert.equal(retained.opacity(retainedStroke),0,'normal fading resumes from its preserved progress');
retained.reset();assert.equal(retained.time,0);assert.equal(retained.ageTime,0);

// Compare the entire default scene as well, using the production backdrop.
const rowHeight=H+42;
const sheet=createCanvas(W*2,rowHeight*3),sc=sheet.getContext('2d');
sc.fillStyle='#080915';sc.fillRect(0,0,sheet.width,sheet.height);
const previewRows=[cases[0],cases[2],cases[4]];
for(let i=0;i<previewRows.length;i++){
  const test=previewRows[i],y=i*rowHeight;
  const expected=paintReference(test.strokes,test.time,{background:true,composite:true});
  const actual=paintTrails(test.strokes,test.time,{background:true});
  equalPixels(actual,expected,'Whole scene / '+test.name);
  sc.fillStyle='#e0dff7';sc.font='14px sans-serif';
  sc.fillText(`REFERENCE / t=${test.time.toFixed(1)}s`,12,y+26);
  sc.fillText(`PWA / t=${test.time.toFixed(1)}s`,W+12,y+26);
  sc.drawImage(expected,0,y+42,W,H);sc.drawImage(actual,W,y+42,W,H);
}
const artifact=path.resolve(__dirname,'../artifacts/ribbon-reference-parity.png');
fs.mkdirSync(path.dirname(artifact),{recursive:true});
fs.writeFileSync(artifact,sheet.toBuffer('image/png'));

const perf=makeTrails(),perfCanvas=makeCanvas(),pc=prepare(perfCanvas);
perf.strokes=[stroke(curve)];
for(let i=0;i<8;i++){perf.time=i/60;perf.draw(pc);}
const start=performance.now(),frames=60;
for(let i=0;i<frames;i++){prepare(perfCanvas);perf.time=1.6+i/60;perf.draw(pc);}
const mean=(performance.now()-start)/frames;
console.log(`Ribbon parity: ${cases.length*2+4+previewRows.length} strict RGBA comparisons passed (zero differing channels), including retained motion and true pause.`);
console.log(`Native Canvas one-stroke render: ${mean.toFixed(2)} ms/frame mean over ${frames} frames; this is not an iPhone benchmark.`);
console.log(`Comparison sheet: ${artifact}`);
