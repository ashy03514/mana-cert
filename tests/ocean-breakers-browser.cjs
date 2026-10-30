'use strict';
// Real shared ocean shader, including its file:// texture path. Run serially
// with other GPU suites. Track newly added whitewater independently of the
// photographic base so a moving base texture cannot fake a travelling crest.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),edge=440;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:edge,height:edge},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(pathToFileURL(path.join(root,'water-ocean-study.html')).href);
    assert.equal(await page.evaluate(()=>waterOceanStudy.renderer.ready),true,'the file texture loads');
    await page.evaluate(()=>waterOceanStudy.dispose());
    await page.setContent('<style>html,body{margin:0;background:#02121c}canvas{display:block;width:440px;height:440px}</style><canvas></canvas>');
    await page.evaluate(async()=>{
      window.breakerRenderer=new WaterOceanStudy(document.querySelector('canvas'));
      breakerRenderer.resize(440,440,1);
      if(!await breakerRenderer.ready)throw new Error(breakerRenderer.diagnostic||breakerRenderer.error);
      window.captureBreaker=(time,surge=1,breakers=1)=>{
        const r=breakerRenderer,drawn=r.draw(time,{surge,breakers}),gl=r.gl;
        const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,opaque=0,clipped=0,lit=0;
        for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
        for(let i=0;i<pixels.length;i+=4){
          if(pixels[i+3]>127){opaque++;if(pixels[i]+pixels[i+1]+pixels[i+2]>60)lit++;}
          if(pixels[i]>248&&pixels[i+1]>248&&pixels[i+2]>248)clipped++;
        }
        return {drawn,time,surge,breakers,width,height,hash:hash>>>0,opaque,clipped,lit,gl:gl.getError(),pixels:Array.from(pixels)};
      };
    });
    const capture=(time,surge=1,breakers=1)=>page.evaluate(([t,s,b])=>captureBreaker(t,s,b),[time,surge,breakers]);
    const check=frame=>{
      assert.equal(frame.drawn,true);assert.equal(frame.gl,0);
      assert.ok(frame.opaque>frame.width*frame.height*.1,'visible round water body');
      assert.ok(frame.lit>frame.opaque*.1,'ocean remains visible');
      assert.ok(frame.clipped/Math.max(1,frame.opaque)<.04,'breakers do not bleach the water to clipped white');
    };
    const compare=(baseline,active)=>{
      assert.equal(baseline.width,active.width);assert.equal(baseline.height,active.height);
      let energy=0,changed=0,positive=0,count=0,weightedX=0,weightedY=0,weight=0;
      // A corridor through the central wave avoids the other longitude crests
      // entering/leaving the rim. WebGL y points up; report screen y downward.
      const dx=.68/Math.hypot(.68,.74),dy=.74/Math.hypot(.68,.74),bins=Array(48).fill(0);
      for(let y=0;y<active.height;y++)for(let x=0;x<active.width;x++){
        const i=(y*active.width+x)*4;if(baseline.pixels[i+3]<200||active.pixels[i+3]<200)continue;
        const delta=Math.abs(active.pixels[i]-baseline.pixels[i])+Math.abs(active.pixels[i+1]-baseline.pixels[i+1])+Math.abs(active.pixels[i+2]-baseline.pixels[i+2]);
        energy+=delta;count++;if(delta>18)changed++;
        const light=(active.pixels[i]-baseline.pixels[i])*.25+(active.pixels[i+1]-baseline.pixels[i+1])*.5+(active.pixels[i+2]-baseline.pixels[i+2])*.25;
        if(light>10)positive++;
        const nx=(x+.5-active.width/2)/(active.width/2),ny=(y+.5-active.height/2)/(active.height/2);
        const along=nx*dx+ny*dy,across=-nx*dy+ny*dx;
        if(Math.abs(across)<.12&&along>-.45&&along<.65){
          const value=Math.max(0,light-14);weight+=value;
          weightedX+=value*(x+.5);weightedY+=value*(active.height-y-.5);
          const bin=Math.min(bins.length-1,Math.floor((along+.45)/1.1*bins.length));bins[bin]+=value;
        }
      }
      const peak=bins.indexOf(Math.max(...bins));
      return {meanDelta:energy/Math.max(1,count)/3,changedFraction:changed/Math.max(1,count),positiveFraction:positive/Math.max(1,count),
        front:{screenX:weight?weightedX/weight:null,screenY:weight?weightedY/weight:null,weight,
          peakAlong:-.45+(peak+.5)*1.1/bins.length}};
    };
    const base=await capture(1,1,0),active=await capture(1,1,1),repeat=await capture(1,1,1);
    check(base);check(active);assert.equal(active.hash,repeat.hash,'same time and options reproduce exactly the same breaker frame');
    assert.notEqual(active.hash,base.hash,'breaker opt-in changes actual water pixels');
    const strong=compare(base,active);
    assert.ok(strong.meanDelta>.5&&strong.changedFraction>.01,'breaking waves contribute visible material detail');
    const lowBase=await capture(1,.25,0),low=await capture(1,.25,1),weak=compare(lowBase,low);
    check(low);
    assert.ok(strong.meanDelta>weak.meanDelta*2,'small water seed has much weaker breakers than SS sea');
    const timeMetrics=[];
    for(const time of [0,1,2,112,1800]){
      const frame=await capture(time);check(frame);
      timeMetrics.push({time,hash:frame.hash,clipped:frame.clipped,opaque:frame.opaque});
    }
    const sheet=createCanvas(edge*3,(edge+40)*2),ctx=sheet.getContext('2d'),direction=[];
    ctx.fillStyle='#02121c';ctx.fillRect(0,0,sheet.width,sheet.height);
    const tiles=[{time:1,breakers:0,label:'Ocean baseline'},{time:1,breakers:1,label:'Breaking crests'},
      ...[0,.45,.9,1.35].map(time=>({time,breakers:1,label:'Motion '+time.toFixed(2)+' s'}))];
    for(const [index,tile]of tiles.entries()){
      if(index>=2){
        const reference=await capture(tile.time,1,0),moving=await capture(tile.time,1,1);
        direction.push({time:tile.time,...compare(reference,moving).front});
      }else await capture(tile.time,1,tile.breakers);
      const image=await page.screenshot({timeout:60000});
      const x=index%3*edge,y=Math.floor(index/3)*(edge+40);
      ctx.fillStyle='#d6f0fa';ctx.font='18px sans-serif';ctx.fillText(tile.label,x+16,y+27);
      ctx.drawImage(await loadImage(image),x,y+40,edge,edge);
    }
    const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
    fs.writeFileSync(path.join(artifacts,'ocean-breakers-motion.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(artifacts,'ocean-breakers-metrics.json'),JSON.stringify({strong,weak,timeMetrics,direction},null,2));
    for(let i=1;i<direction.length;i++){
      const previous=direction[i-1],current=direction[i];
      assert.ok(current.weight>500,'the tracked crest remains visible');
      assert.ok(current.screenX>previous.screenX+5,'the same crest advances rightward');
      assert.ok(current.screenY<previous.screenY-5,'the same crest advances upward');
      assert.ok(current.peakAlong>previous.peakAlong,'the crest peak follows the spherical travel direction');
    }
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>breakerRenderer.dispose());
    console.log('Ocean breakers GPU checks passed: visible change, deterministic time, strength response, bounded white clipping and long-time renders.');
    console.log('Lower-left to upper-right crest checks passed:',JSON.stringify(direction));
    console.log('Breaker energy:',JSON.stringify({strong:strong.meanDelta,weak:weak.meanDelta}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
