'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=process.env.MANA_TEST_ROOT||path.resolve(__dirname,'..');
global.window=globalThis;
global.document={createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}};
for(const name of ['config','fire-scan-transition','lightning-rank-effects','lightning-discharge','lightning-storm-renderer'])
  require(path.join(root,'js',name+'.js'));
const L=LightningRankEffects,D=LightningDischarge,R=LightningStormRenderer;
const ranks=['E','D','C','B','A','S','SS'];
const originalRandom=Math.random;
Math.random=()=>{throw Error('presentation must not consume certification randomness');};

function visible(stroke){
  return stroke.strength>.05 && stroke.upper>1-1e-9 && stroke.lower>1-1e-9 &&
    (stroke.flash>.01||stroke.afterglow>.10);
}
function state(time,rank='SS',seed=23){return R.stateAt(time,seed,L.preview(time,rank));}
function pixels(canvas){return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;}
function alphaNear(data,width,height,x,y,radius=2){
  let peak=0;
  for(let py=Math.max(0,Math.round(y)-radius);py<=Math.min(height-1,Math.round(y)+radius);py++)
    for(let px=Math.max(0,Math.round(x)-radius);px<=Math.min(width-1,Math.round(x)+radius);px++)
      peak=Math.max(peak,data[(py*width+px)*4+3]);
  return peak;
}

try{
  assert.equal(L.forRank('SS').orbScale,2,'SS core has twice its previous linear size');
  for(let i=1;i<ranks.length;i++)assert.ok(L.forRank(ranks[i]).orbScale>L.forRank(ranks[i-1]).orbScale);
  const variants=new Set();
  for(const fps of [24,60])for(const seed of [0,23])for(let frame=0;frame<=fps*20;frame++){
    const time=frame/fps,s=state(time,'S',seed);
    assert.equal(s.plasmaGain,0,'S retains branching strikes instead of SS plasma');
    assert.equal(s.salvos.length,3,'continuous S keeps three bounded overlapping salvos');
    assert.ok(s.strokes.some(visible),'S always has a visibly connected sky-to-core strike at '+fps+' fps, t='+time);
    for(const salvo of s.salvos){
      variants.add(D.strikeType(salvo.cycle));
      assert.equal(salvo.profile.strikeWidth,1);assert.equal(salvo.profile.skyStrength,1);
      assert.ok(salvo.strokes.length>=1&&salvo.strokes.length<=3);
    }
    const ss=state(time,'SS',seed);
    assert.equal(ss.plasmaGain,1);assert.equal(ss.salvos.length,0,'fully formed SS replaces ordinary falling strikes');
  }
  assert.deepEqual([...variants].sort(),['double','large','medium','triple'],'S inherits every former SS strike variant');

  const result=Object.freeze({type:'magic',element:'雷',rank:'SS',mana:999});
  const original=JSON.stringify(result);let before=L.initial(.8),sawS=false,sawPlasmaBlend=false;
  for(let time=0;time<9;time+=.01){
    const effects=L.sample(time,result,.8),p=R.stateAt(time+.8,23,effects);
    assert.ok(p.plasmaGain>=before.profile.plasmaGain-1e-10);
    assert.ok(Math.abs(p.plasmaGain-before.profile.plasmaGain)<.025,'SS channels fade in across the existing rank transition');
    if(effects.profile.rank==='S')sawS=true;
    if(p.plasmaGain>0&&p.plasmaGain<1)sawPlasmaBlend=true;
    if(effects.profile.continuousGain>.9)
      assert.ok(p.plasmaGain+p.strokes.reduce((max,s)=>Math.max(max,visible(s)?s.strength:0),0)>.05,
        'the S-to-SS change retains visible conductive energy');
    before=effects;
  }
  assert.ok(sawS&&sawPlasmaBlend);assert.equal(JSON.stringify(result),original);assert.ok(Object.isFrozen(result));

  for(const [width,height] of [[320,400],[390,574],[844,265]]){
    const core={x:width*.5,y:height*.76};
    for(const time of [0,.17,.58,1.28,2.93,8.4,29.9]){
      const paths=D.plasmaPaths(width,height,time);
      assert.equal(paths.length,4);assert.deepEqual(D.plasmaPaths(width,height,time),paths,'seeking is deterministic');
      assert.equal(new Set(paths.map(p=>p.points[0].x)).size,4,'the sky origins remain distinct');
      const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
      const p=state(time);
      // Suppress the orb/corona and its interior mask to verify the complete
      // plasma geometry independently, including its exact endpoint.
      const isolated={...p,profile:{...p.profile,brightness:0,orbScale:0},salvos:[]};
      ctx.globalAlpha=.57;ctx.globalCompositeOperation='source-over';
      D.draw(ctx,width,height,time,23,isolated);
      assert.ok(Math.abs(ctx.globalAlpha-.57)<.01,'discharge restores caller alpha');
      assert.equal(ctx.globalCompositeOperation,'source-over');
      const data=pixels(canvas);
      for(const beam of paths){
        assert.ok(beam.points[0].y<0,'plasma enters from above the visible sky');
        assert.deepEqual(beam.points.at(-1),core,'each plasma channel ends at the same core');
        for(const point of beam.points){
          assert.ok(Number.isFinite(point.x+point.y));
          if(point.y>=0&&point.y<height)
            assert.ok(alphaNear(data,width,height,point.x,point.y)>80,'every visible section of every plasma beam stays lit');
        }
      }
      // Production clips plasma inside the gold core. Verify that the actual
      // orb fills this junction continuously, without branches or other salvos
      // concealing a gap. Sample at pixel spacing, including between path knots.
      const joined=createCanvas(width,height),joinedCtx=joined.getContext('2d');
      D.draw(joinedCtx,width,height,time,23,{...p,
        profile:{...p.profile,arcReach:0,arcSecondary:0,branches:0},salvos:[]});
      const joinedData=pixels(joined);
      for(const beam of paths)for(let i=1;i<beam.points.length;i++){
        const a=beam.points[i-1],b=beam.points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y));
        for(let step=0;step<=steps;step++){
          const u=step/steps,x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u;
          if(y>=0&&y<height)
            assert.ok(alphaNear(joinedData,width,height,x,y,0)>80,
              'rendered plasma and gold core join without an unlit pixel at '+width+'x'+height+', t='+time);
        }
      }
    }
  }

  // Compare actual isolated orb pixels with the old scale at the same phase,
  // rather than inferring enlargement solely from the profile number.
  function orbExtent(scale){
    const width=390,height=574,canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    const profile={...L.forRank('SS'),orbScale:scale,arcReach:0,arcSecondary:0};
    D.draw(ctx,width,height,.73,23,{profile,charge:.5,flash:0,impactAge:0,salvos:[],plasmaGain:0});
    const data=pixels(canvas);let left=width,right=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>96){left=Math.min(left,x);right=Math.max(right,x);}
    return right-left+1;
  }
  const oldDiameter=orbExtent(1),newDiameter=orbExtent(L.forRank('SS').orbScale);
  assert.ok(newDiameter/oldDiameter>1.9&&newDiameter/oldDiameter<2.1,'rendered SS core diameter doubles');

  // Continuous schedule coverage also produces real sky pixels. The top third
  // excludes the central orb and its corona, avoiding a false positive.
  for(let i=0;i<24;i++){
    const width=195,height=300,time=i*.137,canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),p=state(time,'S');
    D.draw(ctx,width,height,time,23,{...p,profile:{...p.profile,brightness:0}});
    const data=pixels(canvas);let skyPixels=0;
    for(let y=5;y<height/3;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>16)skyPixels++;
    assert.ok(skyPixels>30,'S draws visible falling lightning throughout its overlapping schedule');
  }

  const output=fs.mkdtempSync(path.join(os.tmpdir(),'mana-lightning-plasma-'));
  for(const rank of ['S','SS']){
    const width=390,height=844,time=2.35,canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    const renderer=new R(23);
    renderer.draw(ctx,canvas,width,height,{time,lightningEffects:L.preview(time,rank)});
    fs.writeFileSync(path.join(output,'lightning-'+rank+'.png'),canvas.toBuffer('image/png'));renderer.dispose();
  }
  console.log('PASS S continuous branches at 24/60 fps, SS connected plasma pixels, doubled core pixels, deterministic growth and immutable result.');
  console.log('Lightning comparison renders: '+output);
}finally{Math.random=originalRandom;}
