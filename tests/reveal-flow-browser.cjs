/* Stage 2 production UI + real WebGL/Canvas. Desktop evidence, not iPhone acceptance. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const artifact=name=>path.join(__dirname,'../artifacts',name);

(async()=>{
  const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader'],
  });
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      // Drive the production RAF/ActiveTimeline, in bounded 50 ms steps.
      // Real pointer events still enter through the actual scene handlers.
      let now=0,serial=0;
      const pending=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      window.requestAnimationFrame=callback=>{const id=++serial;pending.set(id,callback);return id;};
      window.cancelAnimationFrame=id=>pending.delete(id);
      window.__advanceRevealTest=milliseconds=>{
        let remaining=milliseconds;
        do{
          const increment=Math.min(50,remaining);
          now+=increment;remaining-=increment;
          const callbacks=[...pending.values()];pending.clear();
          for(const callback of callbacks)callback(now);
        }while(remaining>0);
      };
      window.__revealGl={draws:0,errors:[]};
      const draw=WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays=function(...args){
        const value=draw.apply(this,args);
        const error=this.getError();
        window.__revealGl.draws++;
        if(error)window.__revealGl.errors.push(error);
        return value;
      };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const draw=FingerTrails.prototype.draw;
      FingerTrails.prototype.draw=function(...args){
        const value=draw.apply(this,args);
        if(window.__recordReleasedTrail)window.__releasedTrail={time:this.time,age:this.ageTime,
          image:this.layer.toDataURL('image/png')};
        return value;
      };
    });
    const click=selector=>page.locator(selector).click({force:true});
    const advance=milliseconds=>page.evaluate(value=>window.__advanceRevealTest(value),milliseconds);
    const status=()=>page.locator('#materialStatus').textContent();
    const canvasImage=()=>page.locator('#particleCanvas').evaluate(canvas=>canvas.toDataURL('image/png'));
    const assertStatus=async(expected,message)=>assert.equal(await status(),expected,message);
    const move=async(x,y)=>page.mouse.move(x,y,{steps:5});
    const stroke=async()=>{
      await page.mouse.move(105,365);
      await page.mouse.down();
      for(const [x,y] of [[125,285],[185,250],[258,278],[285,345],[225,408],[147,393],[143,320],[212,303],[250,350]])
        await move(x,y);
    };
    const shots=[];
    const capture=async(name,label)=>{
      const image=await canvasImage(),file=artifact('reveal-flow-'+name+'.png');
      fs.writeFileSync(file,Buffer.from(image.split(',')[1],'base64'));
      shots.push({name,label,file,image});
    };
    fs.mkdirSync(path.dirname(artifact('unused')),{recursive:true});
    await click('#tab_effects');
    await page.getByText('屬性揭曉樣板',{exact:true}).click({force:true});
    await click('#flowPreviewOpen');
    await advance(0);
    assert.equal(await page.locator('body').getAttribute('data-state'),'FLOW_PREVIEW');
    await assertStatus('畫完後放開');
    const controls=await page.locator('#materialControls').boundingBox();
    assert.ok(controls.x>=0&&controls.y>=0&&controls.x+controls.width<=390&&controls.y+controls.height<=844,
      'flow controls fit the complete 390 × 844 phone viewport');
    for(const selector of ['#material_fire','#material_water','#material_wind','#material_earth','#material_light','#material_dark','#materialPause','#materialReplay']){
      const bounds=await page.locator(selector).boundingBox();
      assert.ok(bounds.width>=44&&bounds.height>=44,selector+' retains a touch-sized target');
    }
    assert.equal(await page.locator('#materialReplay').textContent(),'重新畫一次');

    // A blank tap cannot start the release timer.
    await page.mouse.click(195,330);
    await advance(1500);
    await assertStatus('畫完後放開','a stationary tap is not a completed drawing');

    // A meaningful stroke held down for longer than the waiting period stays drawable.
    await stroke();
    await advance(2600);
    await assertStatus('畫完後放開','holding a drawn stroke must never auto-start');
    await page.mouse.up();
    await page.evaluate(()=>{window.__recordReleasedTrail=true;});
    await advance(0);
    await assertStatus('可接著畫');
    const releasedTrail=await page.evaluate(()=>window.__releasedTrail);
    await advance(300);
    const movingTrail=await page.evaluate(()=>window.__releasedTrail);
    assert.ok(movingTrail.time>releasedTrail.time+.29,'release keeps the real ribbon clock moving');
    assert.ok(Math.abs(movingTrail.age-releasedTrail.age)<1e-9,'retaining ink does not advance fading');
    assert.notEqual(movingTrail.image,releasedTrail.image,'the ribbon pixels themselves move after release');
    await page.evaluate(()=>{window.__recordReleasedTrail=false;});
    await advance(1150);
    await assertStatus('魔力蓄勢','input remains resumable during the charge hold after both inward waves');
    await page.mouse.move(250,350);
    await page.mouse.down();
    await move(300,385);
    await advance(1400);
    await assertStatus('畫完後放開','continuing the stroke during the charge hold cancels the previous release timer');
    await page.mouse.up();
    await advance(550);
    await assertStatus('可接著畫','the second release starts a fresh waiting interval');
    await capture('waiting','1 / RELEASE WAIT');

    await advance(1000);
    await assertStatus('魔力蓄勢','the inward waves finish before the half-second charge hold');
    await advance(100);
    await assertStatus('魔力蓄勢','the burst cannot begin before the full charge hold');
    await advance(400);
    await assertStatus('魔力收束');
    await capture('burst','2 / ORB BURST');
    await advance(600);
    await assertStatus('魔力收束');
    await capture('gather','3 / SLOW DRIFT');

    // Pausing freezes the actual combined Canvas pixels, including the background.
    await click('#materialPause');
    assert.equal(await page.locator('#materialPause').getAttribute('aria-pressed'),'true');
    const frozen=await canvasImage();
    await advance(700);
    assert.equal(await canvasImage(),frozen,'pause freezes the entire rendered frame');
    await click('#materialPause');
    assert.equal(await page.locator('#materialPause').getAttribute('aria-pressed'),'false');

    await advance(900);
    await assertStatus('魔力收束','the final fast pull stays inside the 2.1-second gather phase');
    await capture('implosion','4 / FAST IMPLOSION');
    await advance(650);
    await assertStatus('屬性形成');
    await capture('formation','5 / FORMATION');
    assert.equal(await page.locator('#materialError').isVisible(),false,'formation compiles and draws its real shader');
    await advance(1300);
    await assertStatus('火焰蓄熱');
    await capture('reveal','6 / REVEAL');
    await advance(2400);
    await assertStatus('魔力攀升');
    await advance(3000);
    await assertStatus('階段完成');
    assert.match(await page.locator('#revealTitle').textContent(),/火/,'completion names the selected element');
    assert.equal(await page.locator('#revealTitle').isVisible(),true);
    const titleOpacity=await page.locator('#revealTitle').evaluate(el=>Number(getComputedStyle(el).opacity));
    assert.ok(titleOpacity>.9,'the revealed title is visually readable');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    const gl=await page.evaluate(()=>window.__revealGl);
    assert.ok(gl.draws>0,'flow used real WebGL rendering');
    assert.deepEqual(gl.errors,[],'material draw calls have no WebGL errors');
    assert.equal(new Set(shots.map(shot=>shot.image)).size,6,'all six production transition frames differ');
    await page.screenshot({path:artifact('reveal-flow-phone-ui.png')});

    // Every element switch clears the prior drawing/title and then completes
    // through the production pointer handlers and real material shader.
    for(const [key,name] of Object.entries({water:'水',wind:'風',earth:'土',light:'光',dark:'暗',fire:'火'})){
      await click('#material_'+key);
      await advance(0);
      assert.equal(await page.locator('#material_'+key).getAttribute('aria-pressed'),'true');
      await assertStatus('畫完後放開',key+' starts a new drawing');
      const hiddenTitle=await page.locator('#revealTitle').evaluate(el=>el.hidden||getComputedStyle(el).display==='none'||Number(getComputedStyle(el).opacity)===0);
      assert.equal(hiddenTitle,true,key+' clears the previous title');
      const before=await page.evaluate(()=>window.__revealGl.draws);
      await stroke();await page.mouse.up();await advance((key==='fire'||key==='water')?10800:7300);
      await assertStatus((key==='fire'||key==='water')?'階段完成':'播放完成',key+' reaches the complete preview');
      assert.equal(await page.locator('#revealTitle').textContent(),name+'屬性');
      assert.equal(await page.locator('#revealTitle').isVisible(),true,key+' title is visible');
      assert.ok(await page.locator('#revealTitle').evaluate(el=>Number(getComputedStyle(el).opacity))>.9,key+' title is legible');
      assert.equal(await page.locator('#materialError').isVisible(),false,key+' has no shader error');
      const checked=await page.evaluate(()=>window.__revealGl);
      assert.ok(checked.draws>before,key+' actually rendered material frames');
      assert.deepEqual(checked.errors,[],key+' has no GL errors');
      console.log(key+' full production flow completed with a visible title and real shader.');
    }
    await click('#materialReplay');await advance(0);
    await stroke();await page.mouse.up();await advance(500);
    await assertStatus('可接著畫');
    await click('#materialReplay');
    await advance(1400);
    await assertStatus('畫完後放開','replay clears the old input and pending timer');

    // Fire continues into its numeric scan; the certification card remains deferred.
    await click('#effectPreviewBack');
    assert.equal(await page.locator('body').getAttribute('data-state'),'SETTINGS');
    assert.equal(await page.locator('#materialControls').isVisible(),false);
    await click('#tab_switches');
    await page.locator('#s_master').uncheck({force:true});
    await page.locator('#s_fire').check({force:true});
    await click('#btnStart');
    await advance(0);
    assert.equal(await page.locator('body').getAttribute('data-state'),'STANDBY');
    await stroke();await advance(2600);
    assert.equal(await page.locator('body').getAttribute('data-state'),'INTERACTION','formal held input stays drawable');
    await page.mouse.up();await advance(7500);
    assert.equal(await page.locator('body').getAttribute('data-state'),'MANA_SCAN','formal fire starts its numeric scan after the transition');
    assert.equal(await page.locator('#revealTitle').textContent(),'火屬性');
    assert.equal(await page.locator('#revealTitle').isVisible(),true);
    assert.equal(await page.locator('#formalReplay').isVisible(),false,'replay appears after the numeric rise finishes');
    assert.equal(await page.locator('#resultCard').isVisible(),false,'formal endpoint cannot show the certification card');
    const formalFrame=await canvasImage(),formalGlBefore=await page.evaluate(()=>window.__revealGl.draws);
    await advance(5000);
    assert.equal(await page.locator('body').getAttribute('data-state'),'MANA_SCAN','formal endpoint does not advance to result-card phases');
    assert.equal(await page.locator('#formalReplay').isVisible(),true);
    assert.notEqual(await canvasImage(),formalFrame,'formal material remains visibly animated');
    assert.ok(await page.evaluate(()=>window.__revealGl.draws)>formalGlBefore,'formal material keeps drawing its shader');
    assert.equal(await page.locator('#materialControls').isVisible(),false);
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.deepEqual(await page.evaluate(()=>window.__revealGl.errors),[]);
    await click('#effectPreviewBack');
    assert.equal(await page.locator('body').getAttribute('data-state'),'SETTINGS');
    assert.equal(await page.locator('#panel_switches').isVisible(),true);
    assert.equal(await page.locator('#revealTitle').isVisible(),false);
    assert.deepEqual(errors,[],'production flow and return paths have no JavaScript exceptions');

    const sheet=createCanvas(390*3,884*2),ctx=sheet.getContext('2d');
    ctx.fillStyle='#080915';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<shots.length;i++){
      const image=await loadImage(shots[i].file),x=(i%3)*390,y=Math.floor(i/3)*884;
      ctx.fillStyle='#dcd4e6';ctx.font='16px sans-serif';ctx.fillText(shots[i].label,x+16,y+26);
      ctx.drawImage(image,x,y+40,390,844);
    }
    fs.writeFileSync(artifact('reveal-flow-stage2.png'),sheet.toBuffer('image/png'));
    console.log('Reveal flow browser: real pointer hold/release/continue, blank tap, exact pause, orb burst/drift/implosion frames, six complete WebGL previews, phone control bounds, replay and live formal fire scan endpoint passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
