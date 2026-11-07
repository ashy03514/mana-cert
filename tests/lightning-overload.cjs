'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=process.env.MANA_TEST_ROOT||path.resolve(__dirname,'..');
const baselineArgument=process.argv.indexOf('--baseline');
const baselinePath=baselineArgument<0?null:process.argv[baselineArgument+1];
const modules=['config','fire-scan-transition','lightning-rank-effects','lightning-discharge','lightning-storm-renderer'];

function load(directory){
  const context=vm.createContext({document:{createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}}});
  context.window=context;
  for(const name of modules)vm.runInContext(fs.readFileSync(path.join(directory,name+'.js'),'utf8'),context,{filename:name+'.js'});
  vm.runInContext('Math.random=()=>{throw Error("visual effects must not consume certification randomness")}',context);
  return context;
}
const current=load(path.join(root,'js')),baseline=baselinePath?load(baselinePath):null;
const D=current.LightningDischarge,L=current.LightningRankEffects,R=current.LightningStormRenderer;
const json=value=>JSON.stringify(value),data=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
function state(t,rank='SS'){return R.stateAt(t,23,L.preview(t,rank));}
function frame(context,rank,time,width=195,height=422){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),renderer=new context.LightningStormRenderer(23);
  renderer.draw(ctx,canvas,width,height,{time,lightningEffects:context.LightningRankEffects.preview(time,rank)});
  renderer.dispose();return canvas;
}

assert.equal(typeof D.plasmaState,'function');
for(const fps of [24,60]){
  let lastEvent=-1,peak=0,cycles=0,previous;
  for(let i=0;i<=fps*12;i++){
    const t=i/fps,p=D.plasmaState(t),s=state(t);
    assert.equal(json(D.plasmaState(t)),json(p),'overload sampling is deterministic');
    assert.equal(json(s.plasmaState),json(p),'renderer and discharge share one overload clock');
    assert.equal(s.plasmaGain,1);assert.equal(s.salvos.length,0);
    assert.equal(p.sky.length,4);
    for(const n of [p.age,p.impactAge,p.burst,p.packet,...p.sky])assert.ok(Number.isFinite(n));
    for(const n of [p.burst,p.packet,...p.sky])assert.ok(n>=0&&n<=1);
    assert.equal(p.event,Math.floor(t/1.2));
    assert.ok(Math.abs(p.age-(t-p.event*1.2))<1e-9);
    assert.ok(Math.abs(p.impactAge-(p.age-.42))<1e-9);
    if(p.event!==lastEvent){
      if(lastEvent>=0){assert.ok(peak>.65,'each cycle includes a visible core burst at '+fps+' fps');cycles++;}
      peak=0;lastEvent=p.event;
    }
    peak=Math.max(peak,p.burst);
    if(previous&&p.event===previous.event&&p.age>=.04&&p.age<=.42)
      assert.ok(p.packet>=previous.packet,'the energy packet travels toward the core');
    previous=p;
  }
  assert.ok(cycles>=9);
}
for(let cycle=1;cycle<=8;cycle++){
  const before=D.plasmaState(cycle*1.2-1e-6),after=D.plasmaState(cycle*1.2+1e-6);
  assert.ok(Math.abs(before.burst-after.burst)<.002,'burst tail is continuous across cycle wrap');
}
assert.equal(D.plasmaState(.04).packet,0);
assert.ok(D.plasmaState(.42).packet>.999);
assert.ok(D.plasmaState(.3).burst<D.plasmaState(.48).burst,'transport precedes core impact');
for(const time of [7.2,.17,2.48,0,101.4,.48]){
  const first=frame(current,'SS',time);frame(current,'SS',time+8.7);
  assert.deepEqual(data(frame(current,'SS',time)),data(first),'seeking restores exact pixels after another cycle');
}

const result=Object.freeze({type:'magic',element:'雷',rank:'SS',mana:999}),unchanged=json(result);
for(let t=0;t<12;t+=.025){const effects=L.sample(t,result,.8);R.stateAt(t+.8,23,effects);}
assert.equal(json(result),unchanged);assert.ok(Object.isFrozen(result));

// Sample every pixel along each main channel. The normal production rendering
// must remain connected through the intentional gold-core mask during both the
// travelling packet and the blast, including narrow and landscape viewports.
for(const [width,height] of [[195,280],[390,495],[640,240]])for(const time of [.03,.17,.41,.455,.65,1.199,1.201]){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),p=state(time);
  D.draw(ctx,width,height,time,23,p);
  const pixels=data(canvas);
  for(const beam of D.plasmaPaths(width,height,time)){
    assert.deepEqual(json(beam.points.at(-1)),json({x:width*.5,y:height*.76}));
    for(let i=1;i<beam.points.length;i++){
      const a=beam.points[i-1],b=beam.points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));
      for(let j=0;j<=steps;j++){
        const x=Math.round(a.x+(b.x-a.x)*j/steps),y=Math.round(a.y+(b.y-a.y)*j/steps);
        if(x>=0&&x<width&&y>=0&&y<height)
          assert.ok(pixels[(y*width+x)*4+3]>80,'plasma stays connected at '+width+'x'+height+', t='+time);
      }
    }
  }
}

if(baseline){
  for(const rank of ['E','C','S'])for(const t of [0,.17,.48,1.19,2.35,4.8])
    assert.deepEqual(data(frame(current,rank,t)),data(frame(baseline,rank,t)),rank+' pixels unchanged at '+t);
  console.log('PASS exact v169 E/C/S pixels at 18 representative frames.');
}

// Lightning's layout reserves 150 local units below the core. Sample the
// complete discharge on a taller transparent canvas so clipping cannot hide an
// overlong new spark/front behind the result text.
for(const [width,stageHeight] of [[320,430],[390,495]]){
  const height=stageHeight+250,unit=Math.max(.52,Math.min(width/390,stageHeight/495));
  const safeBottom=Math.ceil(stageHeight*.76+150*unit+2);
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  for(let i=0;i<58;i++){
    const time=i/24;ctx.clearRect(0,0,width,height);D.draw(ctx,width,stageHeight,time,23,state(time));
    const pixels=data(canvas);let peak=0;
    for(let y=safeBottom;y<height;y++)for(let x=0;x<width;x++)peak=Math.max(peak,pixels[(y*width+x)*4+3]);
    assert.ok(peak<96,'no bright overload fragment enters the reserved readout area at '+width+'px, t='+time);
  }
}

function metrics(canvas){
  const pixels=data(canvas);let luminance=0,hot=0,lit=0;
  // Only the presentation area, excluding blank lower readout space.
  const count=canvas.width*Math.floor(canvas.height*.68);
  for(let i=0;i<count;i++){
    const l=(.2126*pixels[i*4]+.7152*pixels[i*4+1]+.0722*pixels[i*4+2])/255;
    luminance+=l;if(l>.8)hot++;if(l>.25)lit++;
  }
  return {luminance:luminance/count,hot:hot/count,lit:lit/count};
}
const diagnostics=[];
for(const [label,context,rank] of [['S',current,'S'],...(baseline?[['old SS',baseline,'SS']]:[]),['new SS',current,'SS']]){
  const samples=[],canvas=createCanvas(195,422),ctx=canvas.getContext('2d'),renderer=new context.LightningStormRenderer(23);
  const draw=time=>renderer.draw(ctx,canvas,195,422,{time,lightningEffects:context.LightningRankEffects.preview(time,rank)});
  draw(0);let elapsed=0;
  for(let i=0;i<36;i++){
    const start=performance.now();draw(i*.1);elapsed+=performance.now()-start;
    samples.push(metrics(canvas));
  }
  renderer.dispose();
  const summary={label,samples:samples.length,renderMsPerFrame:+(elapsed/samples.length).toFixed(2)};
  for(const key of ['luminance','hot','lit']){
    summary[key+'Mean']=+(samples.reduce((sum,s)=>sum+s[key],0)/samples.length).toFixed(4);
    summary[key+'Peak']=+Math.max(...samples.map(s=>s[key])).toFixed(4);
  }
  diagnostics.push(summary);
}

const output=fs.mkdtempSync(path.join(os.tmpdir(),'mana-lightning-overload-'));
const sources=[['S',current,'S'],...(baseline?[['SS v169',baseline,'SS']]:[]),['SS overload',current,'SS']];
const width=260,height=562,caption=32,sheet=createCanvas(width*sources.length,(height+caption)*2),g=sheet.getContext('2d');
g.fillStyle='#070b18';g.fillRect(0,0,sheet.width,sheet.height);g.font='16px sans-serif';
for(const [row,time] of [[0,.25],[1,.48]])for(let col=0;col<sources.length;col++){
  const [label,context,rank]=sources[col],x=col*width,y=row*(height+caption);
  g.fillStyle='#ffe8b4';g.fillText(label+' / '+time.toFixed(2)+' s',x+10,y+23);
  const image=frame(context,rank,time,width,height);g.drawImage(image,x,y+caption);
  if(label==='SS overload')fs.writeFileSync(path.join(output,row?'SS-burst.png':'SS-flow.png'),image.toBuffer('image/png'));
}
fs.writeFileSync(path.join(output,'comparison.png'),sheet.toBuffer('image/png'));
fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(diagnostics,null,2));
console.log('PASS overload timing at 24/60 fps, packet-to-impact order, wrap continuity, pixel continuity, replay and immutable result.');
console.log(JSON.stringify({diagnostics,output,note:'Canvas CPU render timings and image statistics are diagnostics, not physical-device FPS or a substitute for visual acceptance.'}));
