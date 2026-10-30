'use strict';
// Actual production file:// ocean renderer; GPU suites must run serially.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),width=390,height=600;
const cases=[['E',124,.3,0,0,91.88289304403055],['D',275,.4,1,.18,133.02820882879823],
  ['C',450,.5,1,.18,174.64611301663948],['B',650,.6,1,.5,217.9723641341288],
  ['A',825,.7,1,.5,253.94163829787232],['S',950,1,1,1,319.203],['SS',9999,1,1,1,385.245]];
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{requestAnimationFrame=()=>0;cancelAnimationFrame=()=>{};});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.setContent('<style>html,body{margin:0;background:#03121c}canvas{display:block}</style><canvas width="390" height="600"></canvas>');
    await page.evaluate(async()=>{
      window.rankCanvas=document.querySelector('canvas');window.rankContext=rankCanvas.getContext('2d');
      window.rankReveal=new WaterOceanReveal();
      if(!await rankReveal.ready)throw new Error(rankReveal.surface.diagnostic||rankReveal.error);
      window.rankBox={x:11.55,y:92,width:366.9,height:366.9};
      window.surfaceMetrics=()=>{
        const r=rankReveal.surface,gl=r.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
        const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,lit=0,opaque=0,white=0;
        for(const byte of pixels)hash=Math.imul(hash^byte,16777619);
        for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>127){opaque++;if(pixels[i]+pixels[i+1]+pixels[i+2]>50)lit++;white+=Math.min(pixels[i],pixels[i+1],pixels[i+2]);}
        const uniforms={};for(const name of ['uTime','uWaveScale','uSeaTexture','uFoamAmount','uBreakers'])uniforms[name]=gl.getUniform(r.waterProgram.program,r.waterProgram.uniforms[name]);
        return {hash:hash>>>0,lit,opaque,white: white/Math.max(1,opaque),pixels:w*h,uniforms,count:r.spray.count,gl:gl.getError()};
      };
      window.drawWaterRank=(mana,visualTime=.6,hostTime=6)=>{
        const profile=WaterRankEffects.profileForValue(mana),ctx=rankContext;
        ctx.fillStyle='#03121c';ctx.fillRect(0,0,390,600);
        const drawn=rankReveal.draw(ctx,rankCanvas,390,600,{box:rankBox,time:hostTime,opacity:1,formation:1,
          waterPower:FireScanTransition.powerForValue(mana),waterEffects:{profile,time:visualTime}});
        const sparkles={time:hostTime,mana,box:rankBox};
        const waterStars=FireRankSparkles.frames(390,600,{...sparkles,element:'water'});
        const fireStars=FireRankSparkles.frames(390,600,{...sparkles,element:'fire'});
        FireRankSparkles.drawFrames(ctx,waterStars);
        ctx.fillStyle='#c3efff';ctx.textAlign='center';ctx.font='18px sans-serif';ctx.fillText('水屬性 · '+profile.rank,195,462);
        ctx.font='42px Georgia';ctx.fillText(String(mana),195,520);
        ctx.font='14px sans-serif';ctx.fillText('速度 '+Math.round(profile.speed*100)+'% · 波形 '+Math.round(profile.waveScale*100)+'%',195,561);
        return {drawn,...surfaceMetrics(),diameter:rankReveal.placement.diameter,rootY:rankReveal.placement.rootY,
          effects:rankReveal.effects,stars:waterStars.length,
          waterSparkles:waterStars.map(({id,radius,birth,age})=>({id,radius,birth,age})),
          fireSparkles:fireStars.map(({id,radius,birth,age})=>({id,radius,birth,age}))};
      };
    });
    const sheet=createCanvas(width*4,height*2),ctx=sheet.getContext('2d'),metrics=[];
    ctx.fillStyle='#03121c';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(const [index,[rank,mana,wave,texture,foam,diameter]]of cases.entries()){
      const frame=await page.evaluate(mana=>drawWaterRank(mana),mana);metrics.push({rank,mana,...frame});
      assert.equal(frame.drawn,true);assert.equal(frame.gl,0);
      assert.ok(frame.opaque>frame.pixels*.1&&frame.lit>frame.pixels*.04,rank+' renders a visible water sphere');
      assert.ok(Math.abs(frame.uniforms.uWaveScale-wave)<1e-6);assert.equal(frame.uniforms.uSeaTexture,texture);
      assert.equal(frame.uniforms.uBreakers,mana>=900?1:0,rank+' only S/SS enable the full wave crest');
      assert.ok(Math.abs(frame.uniforms.uFoamAmount-foam)<1e-6);assert.ok(Math.abs(frame.uniforms.uTime-1.8)<1e-6);
      assert.ok(Math.abs(frame.diameter-diameter)<1e-8,rank+' preserves its established size');
      assert.ok(Math.abs(frame.rootY-396.527)<1e-8);
      assert.deepEqual(frame.waterSparkles,frame.fireSparkles,rank+' uses fire sparkle population, size and one-second host-clock timing');
      if(mana<900){assert.equal(frame.count,0);assert.equal(frame.stars,0);}
      else{assert.ok(frame.count>0);assert.ok(frame.stars>0);}
      ctx.drawImage(await loadImage(await page.screenshot({timeout:60000})),index%4*width,Math.floor(index/4)*height);
      if(mana<900){
        const comparison=await page.evaluate(({wave,texture,foam})=>{
          const r=rankReveal.surface,options={surge:1,spray:0,waveScale:wave,seaTexture:texture,foamAmount:foam};
          r.draw(.6,{...options,breakers:0});const withoutCrest=surfaceMetrics().hash;
          r.draw(.6,{...options,breakers:1});const withCrest=surfaceMetrics().hash;
          return {withoutCrest,withCrest};
        },{wave,texture,foam});
        assert.equal(frame.hash,comparison.withoutCrest,rank+' matches the ocean with the whole crest disabled');
        assert.notEqual(frame.hash,comparison.withCrest,rank+' no longer draws the previous travelling wave');
      }
    }
    const probes=await page.evaluate(()=>{
      const r=rankReveal.surface,gl=r.gl;
      // SS rank uploads the exact same options as the established full study.
      const ss=surfaceMetrics();r.draw(.6);const defaults=surfaceMetrics();
      // An E sphere must be independent of the ocean photograph, not merely
      // dimmer. Replacing that image must affect D, but leave E identical.
      const opts={surge:1,spray:0,waveScale:.3,seaTexture:0,foamAmount:0};
      r.draw(.6,opts);const e=surfaceMetrics();
      r.draw(.6,{...opts,seaTexture:1,foamAmount:.18});const textured=surfaceMetrics();
      gl.bindTexture(gl.TEXTURE_2D,r.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([240,10,170,255]));
      r.draw(.6,opts);const eChangedImage=surfaceMetrics();
      r.draw(.6,{...opts,seaTexture:1,foamAmount:.18});const texturedChangedImage=surfaceMetrics();
      r.uploadTexture();
      const foams=[.18,.5,1].map(foamAmount=>{r.draw(.6,{spray:0,waveScale:1,seaTexture:1,foamAmount});return {foamAmount,...surfaceMetrics()};});
      const sTimes=[0,.3,.6,1.3,2.4,2.9].map((time,index)=>({time,...drawWaterRank(950,time,10+index)}));
      return {ss,defaults,e,eChangedImage,textured,texturedChangedImage,foams,sTimes};
    });
    assert.equal(probes.ss.hash,probes.defaults.hash,'SS keeps the complete study appearance');
    assert.equal(probes.e.hash,probes.eChangedImage.hash,'E does not display the ocean image');
    assert.notEqual(probes.textured.hash,probes.texturedChangedImage.hash,'textured ranks actually use the original ocean image');
    assert.ok(probes.foams[0].white<probes.foams[1].white&&probes.foams[1].white<probes.foams[2].white,'C/D have less whitewater than A/B, and both have less than SS');
    assert.ok(probes.sTimes.some(frame=>frame.count===0)&&probes.sTimes.some(frame=>frame.count>0),'S wave particles alternate between short bursts and quiet gaps');
    assert.ok(probes.sTimes.every(frame=>frame.gl===0));
    const transitions=await page.evaluate(()=>{
      const r=rankReveal.surface,gl=r.gl,read=()=>{
        const data=new Uint8Array(r.canvas.width*r.canvas.height*4);
        gl.readPixels(0,0,r.canvas.width,r.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;
      };
      const difference=(a,b)=>{let total=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a[i+c]-b[i+c]);return total/(a.length*.75);};
      const sample=(mana,age)=>{
        const effects=WaterRankEffects.sample(FireScanTransition.timing.complete+age,{mana,element:'水'},1.2);
        // Freeze motion and size to isolate the material transition itself.
        rankReveal.draw(rankContext,rankCanvas,390,600,{box:rankBox,time:100,opacity:1,formation:1,
          waterPower:FireScanTransition.powerForValue(mana),waterEffects:{...effects,time:mana===1000?1.6:.6}});
        return read();
      };
      // S and SS already share their sea material. Sample the S quiet phase
      // at the SS crossing to verify the continuous spray actually fades in.
      const crossings=[200,350,550,750,900,1000].map(mana=>{
        const before=sample(mana,-.0001),at=sample(mana,0),after=sample(mana,.0001),middle=sample(mana,.325),end=sample(mana,.65);
        return {mana,boundary:Math.max(difference(before,at),difference(at,after)),
          firstHalf:difference(at,middle),secondHalf:difference(middle,end),whole:difference(at,end)};
      });
      r.resize(280,280,1);
      const options={spray:0,breakers:0,seaTexture:1,waveScale:1};
      r.draw(.6,{...options,foamAmount:.99998});const nearFull=read();
      r.draw(.6,{...options,foamAmount:1});const full=read();
      return {crossings,fullFoamBoundary:difference(nearFull,full),gl:gl.getError()};
    });
    assert.equal(transitions.gl,0);
    for(const frame of transitions.crossings){
      assert.ok(frame.boundary<.15,'material does not switch at rank '+frame.mana+': '+JSON.stringify(frame));
      assert.ok(frame.whole>.03&&frame.firstHalf>0&&frame.secondHalf>0,'rank '+frame.mana+' visibly blends over both halves of the transition');
    }
    assert.ok(transitions.fullFoamBoundary<.1,'full SS foam has no hidden shader branch pop');
    const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
    fs.writeFileSync(path.join(artifacts,'water-ranks.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(artifacts,'water-ranks-metrics.json'),JSON.stringify({metrics,probes,transitions},null,2));
    assert.deepEqual(errors,[]);await page.evaluate(()=>rankReveal.dispose());
    console.log('Water rank GPU checks passed: all seven profiles, original sizes, texture-free E, graduated whitewater, gated S spray and unchanged full SS.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
