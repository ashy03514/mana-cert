/* Real shader compilation/render checks. Headless desktop evidence, not iPhone acceptance. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:700},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.setContent('<html><body style="margin:0;background:#080915"><canvas id="scene" width="780" height="1400" style="width:390px;height:700px"></canvas></body></html>');
    for(const name of ['config','effect-settings','ribbon-renderer','finger-trails','portal-scene','element-material-fluids','element-material-matter','element-material-energy','element-material-renderer'])
      await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8')});
    await page.evaluate(()=>{
      const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');ctx.scale(2,2);
      window.fixture={canvas,ctx,portal:new PortalScene(ctx,390,700,undefined,EffectSettings.defaults),material:new ElementMaterialRenderer()};
    });
    const keys=['fire','water','wind','earth','light','dark'],frames=[],metrics=[];
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    for(const key of keys){
      for(const time of [1.4,3.2,5.5]){
        const result=await page.evaluate(({key,time})=>{
          const f=window.fixture,m=f.material;
          m.select(key);m.time=time;f.portal.time=time;f.portal.orbitTime=time;f.portal.positionPools();f.portal.drawBackground();
          const before=f.ctx.getImageData(0,0,780,1400).data;
          const start=performance.now(),ok=m.draw(f.ctx,f.canvas,390,700),ms=performance.now()-start;
          const after=f.ctx.getImageData(0,0,780,1400).data;let changed=0,clipped=0,total=0,energy=0;
          for(let i=0;i<after.length;i+=4){
            const d=Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2]);
            if(d>15){changed++;energy+=d;}
            if(after[i]>248&&after[i+1]>248&&after[i+2]>248)clipped++;
            total++;
          }
          return {key,time,ok,error:m.error,diagnostic:m.diagnostic,glError:m.gl?.getError(),changed,clipped,total,energy,ms,
            width:m.canvas.width,height:m.canvas.height,image:f.canvas.toDataURL('image/png')};
        },{key,time});
        assert.ok(result.ok,`${key}: ${result.diagnostic||result.error}`);
        assert.equal(result.glError,0,`${key} GL error`);
        assert.ok(result.changed>1500,`${key} must produce visible material, got ${result.changed}`);
        assert.ok(result.clipped/result.total<.025,`${key} cannot bleach the screen`);
        assert.ok(result.width<=480&&result.height<=648,'bounded material buffer');
        const output=path.join(__dirname,`../artifacts/element-${key}-${String(time).replace('.','_')}.png`);
        fs.writeFileSync(output,Buffer.from(result.image.split(',')[1],'base64'));
        frames.push({key,time,path:output});delete result.image;metrics.push(result);
        console.log(`${key} t=${time}: visible=${result.changed}, clipped=${result.clipped}, GL=0`);
      }
    }
    for(const key of keys){
      const sizes=metrics.filter(m=>m.key===key).map(m=>m.energy);
      assert.ok(new Set(sizes).size===3,key+' changes through the performance');
    }
    const lifecycle=await page.evaluate(()=>{
      const m=fixture.material;m.select('water');m.time=2;m.paused=true;m.step(.02);
      const stopped=m.time;m.paused=false;m.step(.02);const advanced=m.time;
      m.step(NaN);m.step(-1);const invalid=m.time;const valid=m.select('unknown');
      m.restart();return {stopped,advanced,invalid,valid,time:m.time,programs:m.programs.size};
    });
    assert.equal(lifecycle.stopped,2);assert.equal(lifecycle.advanced,2.02);assert.equal(lifecycle.invalid,2.02);
    assert.equal(lifecycle.valid,false);assert.equal(lifecycle.time,0);assert.equal(lifecycle.programs,6);
    assert.deepEqual(errors,[]);
    const sheet=createCanvas(390*3,740*2),c=sheet.getContext('2d');
    c.fillStyle='#080915';c.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<keys.length;i++){
      const shot=await loadImage(frames.find(f=>f.key===keys[i]&&f.time===3.2).path),x=i%3*390,y=Math.floor(i/3)*740;
      c.fillStyle='#dcd4e6';c.font='16px sans-serif';c.fillText(keys[i].toUpperCase(),x+16,y+27);
      c.drawImage(shot,x,y+40,390,700);
    }
    fs.writeFileSync(path.join(__dirname,'../artifacts/element-materials-stage1.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(__dirname,'../artifacts/element-materials-metrics.json'),JSON.stringify(metrics,null,2));
    // Actual page wiring and touch-sized controls, using the real render programs.
    await page.setViewportSize({width:390,height:844});
    await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.locator('#tab_effects').click();
    await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await page.locator('#materialPreviewOpen').click();
    await page.waitForFunction(()=>document.getElementById('materialStatus').textContent==='展開');
    await page.locator('#materialPause').click();
    assert.equal(await page.locator('#materialPause').textContent(),'繼續播放');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    const bounds=await page.locator('#materialControls').boundingBox();
    assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,'controls fit a phone viewport');
    await page.screenshot({path:path.join(__dirname,'../artifacts/element-materials-phone-ui.png')});
    for(const key of keys){
      await page.locator('#material_'+key).click();
      assert.equal(await page.locator('#material_'+key).getAttribute('aria-pressed'),'true');
    }
    await page.locator('#effectPreviewBack').click();
    assert.equal(await page.locator('#materialControls').isVisible(),false);
    await page.locator('#effectPreview').click();
    assert.equal(await page.locator('body').getAttribute('data-state'),'EFFECT_PREVIEW');
    await page.locator('#effectPreviewBack').click();
    await page.locator('#btnStart').click();
    assert.equal(await page.locator('body').getAttribute('data-state'),'STANDBY');
    assert.deepEqual(errors,[],'real page has no JavaScript exceptions');
    console.log('Six WebGL materials: 18 rendered frames, visible output, bounded white clipping, pause/replay and six-program cache passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
