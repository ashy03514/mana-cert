/* Actual app, Canvas/WebGL and DOM geometry; device/PWA acceptance is separate. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const artifact=name=>path.resolve(__dirname,'../artifacts',name);
(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const pending=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      requestAnimationFrame=callback=>{pending.set(++id,callback);return id;};
      cancelAnimationFrame=id=>pending.delete(id);
      window.advanceScan=ms=>{do{
        const dt=Math.min(ms,50);now+=dt;ms-=dt;
        const callbacks=[...pending.values()];pending.clear();callbacks.forEach(cb=>cb(now));
      }while(ms>0);};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const draw=ElementMaterialRenderer.prototype.draw;
      ElementMaterialRenderer.prototype.draw=function(...args){
        const ok=draw.apply(this,args);window.scanMaterial={frame:args[4],base:this.layout(args[2],args[3]),ok};return ok;
      };
    });
    const click=id=>page.locator('#'+id).click({force:true});
    const advance=ms=>page.evaluate(ms=>advanceScan(ms),ms);
    const shot=name=>page.screenshot({path:artifact(name)});
    const material=()=>page.evaluate(()=>scanMaterial);
    const value=async()=>Number(await page.locator('#fireScanValue').textContent());
    const canvas=()=>page.locator('#particleCanvas').evaluate(c=>c.toDataURL());
    const draw=async()=>{
      await page.mouse.move(110,300);await page.mouse.down();
      await page.mouse.move(260,400,{steps:12});await page.mouse.up();
    };
    const checkLayout=async(width,height)=>{
      const m=await material(),n=await page.locator('#fireScanValue').boundingBox();
      const rank=await page.locator('#fireScanRank').boundingBox();
      const label=await page.locator('#fireScanLabel').boundingBox();
      const title=await page.locator('#revealTitle').boundingBox();
      const controls=await page.locator('#materialControls').boundingBox();
      const box=m.frame.box;
      const hotPixels=await page.locator('#particleCanvas').evaluate((c,box)=>{
        const sx=c.width/innerWidth,sy=c.height/innerHeight;
        const pixels=c.getContext('2d').getImageData(Math.round(box.x*sx),Math.round(box.y*sy),Math.round(box.width*sx),Math.round(box.height*sy)).data;
        let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>160&&pixels[i+1]>80&&pixels[i]>pixels[i+1]*1.15&&pixels[i+1]>pixels[i+2]*1.5)count++;
        return count;
      },box);
      assert.ok(hotPixels>30,'visible fire pixels survive layout/resize, not just its DOM readout');
      assert.equal(box.width,m.base.width,'flame width is never scaled by the transition');
      assert.equal(box.height,m.base.height,'flame height is never scaled by the transition');
      assert.ok(box.y<m.base.y,'fire moves upwards');
      for(const [key,b] of Object.entries({n,rank,label,title})){
        assert.ok(b.x>=0&&b.x+b.width<=width,key+' fits horizontally');
        assert.ok(b.y>=65&&b.y+b.height<controls.y,key+' fits above preview controls');
      }
      assert.ok(title.y+title.height<label.y&&label.y+label.height<n.y,'title, label and value do not overlap');
      assert.ok(n.y+n.height<rank.y,'rank sits below the value');
      if(width<height)assert.ok(title.y>box.y+box.height*.81,'the flame root clears all text');
      else assert.ok(n.x>box.x+box.width,'landscape uses separate fire and readout columns');
      assert.equal(m.ok,true);
    };
    fs.mkdirSync(path.dirname(artifact('unused')),{recursive:true});
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
    await click('flowPreviewOpen');await advance(0);await draw();await advance(5050);
    const base=await material();assert.equal(base.frame.box.y,base.base.y);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    await shot('fire-scan-01-formed.png');
    await advance(700);assert.equal(await value(),0);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),true,'readout appears promptly after the flame forms');
    assert.ok(Number(await page.locator('#fireScanReadout').evaluate(el=>getComputedStyle(el).opacity))>.9,'000 is already readable, not only mounted invisibly');
    assert.ok(Number(await page.locator('#revealTitle').evaluate(el=>getComputedStyle(el).opacity))>.9,'attribute title appears together with the early readout');
    assert.equal(await page.locator('#fireScanLabel').textContent(),'預覽數值');
    await shot('fire-scan-02-ignition.png');
    if(process.env.MANA_SCAN_INTRO_ONLY==='1'){
      assert.deepEqual(errors,[]);
      console.log('Fire scan intro browser passed: early readable 000 and synchronized attribute title.');return;
    }
    await advance(1600);const rising=await value();assert.ok(rising>0&&rising<862);
    await checkLayout(390,844);await shot('fire-scan-03-rising.png');
    await click('materialPause');const pausedImage=await canvas(),pausedFrame=await material();
    await advance(2000);assert.equal(await value(),rising);assert.equal(await canvas(),pausedImage);
    assert.deepEqual((await material()).frame,pausedFrame.frame,'pause also fixes heat and layout');
    await click('materialPause');await advance(2300);
    assert.equal(await value(),862);assert.equal(await page.locator('#fireScanRank').textContent(),'A');
    assert.equal(await page.locator('#materialStatus').textContent(),'階段完成');
    const live=await canvas();await advance(300);assert.notEqual(await canvas(),live,'fire continues burning after the count finishes');
    await shot('fire-scan-04-complete.png');
    await click('materialPause');
    for(const [width,height,name] of [[320,568,'small'],[375,667,'medium'],[844,390,'landscape']]){
      await page.setViewportSize({width,height});
      // Emulate an additional bottom safe area on a medium phone.
      await page.locator('#materialControls').evaluate((el,name)=>{el.style.bottom=name==='medium'?'46px':'';},name);
      await page.evaluate(()=>dispatchEvent(new Event('resize')));
      await shot('fire-scan-'+name+'.png');await checkLayout(width,height);
    }
    await page.setViewportSize({width:390,height:844});await advance(100);
    await click('material_water');assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    await advance(0);await draw();await advance(9500);
    assert.equal(await page.locator('#materialStatus').textContent(),'階段完成','switching to water runs its own measurement');
    await click('material_fire');await advance(0);await draw();await advance(10600);
    assert.equal(await value(),862,'switching back restores the live fire measurement');
    await click('materialReplay');assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    assert.equal(await value(),0,'replay clears the previous number');
    await click('effectPreviewBack');assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('Fire scan browser passed: actual formation/translation, readable layout at 4 sizes, safe area, paused resize pixels, count, pause, live endpoint, replay and element switching.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
