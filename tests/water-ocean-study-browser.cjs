'use strict';
// Run the real isolated SS ocean page and its single surface program. The controlled
// animation clock keeps lifecycle checks deterministic and avoids timing flakes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp'};
  const server=http.createServer((request,response)=>{
    if(request.method!=='GET'){response.writeHead(405);return response.end();}
    let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400);return response.end();}
    const filename=path.resolve(root,'.'+pathname);
    if(!filename.startsWith(root+path.sep)){response.writeHead(403);return response.end();}
    fs.readFile(filename,(error,data)=>{
      if(error){response.writeHead(404);return response.end();}
      response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});response.end(data);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser;
  const errors=[],metrics=[],projectionMetrics=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      let now=0,id=0,hidden=false;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      Object.defineProperty(document,'hidden',{get:()=>hidden,configurable:true});
      Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible',configurable:true});
      requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
      cancelAnimationFrame=id=>callbacks.delete(id);
      window.advance=ms=>{now+=ms;const run=[...callbacks.values()];callbacks.clear();run.forEach(callback=>callback(now));};
      window.setVisibility=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/water-ocean-study.html');
    const texture=await page.evaluate(async()=>{
      const renderer=waterOceanStudy.renderer;
      return {loaded:await renderer.ready,ready:renderer.textureReady,diagnostic:renderer.diagnostic};
    });
    assert.equal(texture.loaded,true,texture.diagnostic);assert.equal(texture.ready,true,'the ocean detail texture loads from the local origin');
    assert.equal(await page.locator('#error').isVisible(),false,'the GPU shader should initialize');
    const shader=await page.evaluate(()=>{
      const renderer=waterOceanStudy.renderer,gl=renderer.gl;
      return {error:renderer.error,diagnostic:renderer.diagnostic,gl:gl?.getError(),
        linked:Boolean(renderer.waterProgram&&gl.getProgramParameter(renderer.waterProgram.program,gl.LINK_STATUS)),
        collisionPrograms:['curlProgram','sprayProgram'].filter(key=>renderer[key])};
    });
    assert.equal(shader.error,'',shader.diagnostic);assert.equal(shader.gl,0);assert.ok(shader.linked);
    assert.deepEqual(shader.collisionPrograms,[],'the ocean study no longer allocates colliding crests or collision spray');
    await page.evaluate(()=>{
      window.captureOcean=()=>{
        const {renderer}=waterOceanStudy,gl=renderer.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
        const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let hash=2166136261,opaque=0,lit=0;
        for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);}
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>127)opaque++;if(pixels[i]+pixels[i+1]+pixels[i+2]>60)lit++;}
        // The front patch must retain detail in both directions as the current
        // rotates. A collapsed projection turns foam into horizontal stripes.
        let horizontal=0,vertical=0;
        for(let y=Math.floor(h*.4);y<Math.floor(h*.6);y++)for(let x=Math.floor(w*.4);x<Math.floor(w*.6);x++){
          const at=(y*w+x)*4;
          for(let channel=0;channel<3;channel++){
            horizontal+=Math.abs(pixels[at+channel+4]-pixels[at+channel]);
            vertical+=Math.abs(pixels[at+channel+w*4]-pixels[at+channel]);
          }
        }
        return {hash:hash>>>0,opaque,lit,pixels:w*h,gl:gl.getError(),time:waterOceanStudy.time,drawCount:renderer.drawCount,
          detailRatio:horizontal/Math.max(1,vertical)};
      };
    });
    const capture=()=>page.evaluate(()=>captureOcean());
    await page.evaluate(()=>waterOceanStudy.renderAt(1.05));const early=await capture();
    assert.ok(early.opaque>early.pixels*.10&&early.opaque<early.pixels*.95,'a substantial isolated water surface renders');
    assert.ok(early.lit>early.pixels*.05,'the rendered water is visible rather than an empty dark buffer');
    await page.evaluate(()=>waterOceanStudy.renderAt(1.75));const moving=await capture();
    assert.notEqual(moving.hash,early.hash,'water changes as its material time advances');
    await page.evaluate(()=>waterOceanStudy.renderAt(1.05));assert.equal((await capture()).hash,early.hash,'seeking the same time reproduces the same water frame');
    assert.equal(await page.locator('#pause').textContent(),'繼續播放');
    await page.evaluate(()=>advance(5000));assert.equal((await capture()).hash,early.hash,'paused GPU frame stays unchanged');
    assert.equal(await page.evaluate(()=>waterOceanStudy.time),1.05);
    await page.locator('#pause').click();
    await page.evaluate(()=>{advance(0);advance(50);});
    assert.ok(Math.abs(await page.evaluate(()=>waterOceanStudy.time)-1.1)<1e-9,'resume advances from the same moment');
    await page.locator('[data-speed="0.5"]').click();
    const slowStart=await page.evaluate(()=>waterOceanStudy.time);
    await page.evaluate(()=>{advance(0);advance(50);});
    assert.ok(Math.abs(await page.evaluate(()=>waterOceanStudy.time)-slowStart-.025)<1e-9);
    assert.equal(await page.locator('[data-speed="0.5"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-speed="1.5"]').click();
    const fastStart=await page.evaluate(()=>waterOceanStudy.time);
    await page.evaluate(()=>{advance(0);advance(50);});
    assert.ok(Math.abs(await page.evaluate(()=>waterOceanStudy.time)-fastStart-.075)<1e-9);
    // Dispatch visibility and bfcache lifecycle events through the page's real
    // handlers; hidden intervals must never enter its active material clock.
    const visible=await capture();
    await page.evaluate(()=>{setVisibility(true);advance(12000);});
    const hidden=await capture();assert.equal(hidden.time,visible.time);assert.equal(hidden.hash,visible.hash);
    assert.equal(await page.evaluate(()=>waterOceanStudy.status),'hidden');
    await page.evaluate(()=>{setVisibility(false);advance(0);advance(50);});
    assert.ok(Math.abs(await page.evaluate(()=>waterOceanStudy.time)-visible.time-.075)<1e-9);
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const cached=await capture();
    await page.evaluate(()=>advance(20000));assert.equal((await capture()).time,cached.time);
    await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));advance(0);advance(50);});
    assert.ok(Math.abs(await page.evaluate(()=>waterOceanStudy.time)-cached.time-.075)<1e-9);
    await page.locator('#replay').click();assert.equal(await page.evaluate(()=>waterOceanStudy.time),0);
    assert.equal(await page.evaluate(()=>waterOceanStudy.paused),false);
    await page.evaluate(()=>waterOceanStudy.renderAt(1.75));const strong=await capture();
    await page.locator('#surge').evaluate(input=>{input.value='20';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#surgeValue').textContent(),'20%');
    assert.notEqual((await capture()).hash,strong.hash,'strength changes redraw immediately even while paused');
    await page.locator('#surge').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal((await capture()).hash,strong.hash);
    // Sample both quarter turns and late playback. The former projection bug
    // produced a ratio near 0.12 at 112 s; these broad bounds allow directional
    // ocean flow but reject detail collapsing into effectively 1-D streaks.
    for(const time of [0,56,112,224,336,449,1800]){
      await page.evaluate(time=>waterOceanStudy.renderAt(time),time);
      const frame=await capture();
      assert.equal(frame.gl,0);
      assert.ok(frame.detailRatio>.35&&frame.detailRatio<3,
        'ocean details keep both dimensions at '+time+' s; ratio='+frame.detailRatio);
      projectionMetrics.push({time,detailRatio:frame.detailRatio});
    }
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    for(const [width,height,name] of [[390,844,'portrait'],[320,568,'small'],[844,390,'landscape']]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>{waterOceanStudy.resize();waterOceanStudy.renderAt(1.75);});
      const layout=await page.evaluate(()=>{
        const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        return {canvas:rect(document.querySelector('#ocean')),controls:rect(document.querySelector('.controls')),
          title:rect(document.querySelector('#title')),buttons:[...document.querySelectorAll('button,input,a')].map(rect),
          scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight};
      });
      const {canvas,controls}=layout;
      assert.ok(canvas.width>140&&canvas.height>140,'the ocean has a visible rendering area');
      assert.ok(canvas.x>=-1&&canvas.y>=-1&&canvas.right<=width+1&&canvas.bottom<=height+1,'the ocean canvas fits the viewport');
      assert.ok(controls.right<=canvas.x+1||canvas.right<=controls.x+1||controls.bottom<=canvas.y+1||canvas.bottom<=controls.y+1,'controls do not cover the ocean');
      assert.ok(layout.buttons.every(r=>r.x>=-1&&r.y>=-1&&r.right<=width+1&&r.bottom<=height+1),'all controls fit on screen at '+name);
      assert.ok(layout.scrollWidth<=width+1,'the study has no horizontal overflow');
      const frame=await capture();assert.equal(frame.gl,0);assert.ok(frame.opaque>frame.pixels*.1);
      assert.equal(await page.evaluate(()=>waterOceanStudy.time),1.75,'resizing preserves paused time');
      await page.screenshot({path:path.join(root,'artifacts','ocean-study-'+name+'.png'),timeout:60000});
      metrics.push({name,width,height,canvasWidth:canvas.width,canvasHeight:canvas.height,opaque:frame.opaque});
    }
    assert.equal(await page.locator('.back').getAttribute('href'),'./index.html');
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>waterOceanStudy.dispose());
    assert.equal(await page.evaluate(()=>waterOceanStudy.renderer.disposed),true);
    console.log('Ocean study GPU/lifecycle/layout checks passed',JSON.stringify(metrics));
    console.log('Long-time ocean projection checks passed',JSON.stringify(projectionMetrics));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
