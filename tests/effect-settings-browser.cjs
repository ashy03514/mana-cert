'use strict';
// Real production controls at phone widths; desktop Chrome, not device acceptance.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url);
    await page.evaluate(()=>localStorage.clear());await page.reload();
    const click=selector=>page.locator(selector).click();
    const open=async title=>{await page.locator('details').filter({has:page.locator('summary',{hasText:new RegExp('^'+title+'$')})}).evaluate(e=>e.open=true);};
    const set=async(key,value)=>page.locator('#effect_'+key).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mana.portal.effects.v1')).values);
    await click('#tab_effects');
    assert.equal(await page.locator('#panel_effects details[open]').count(),0);
    await open('瞬閃星芒');
    const pool=page.locator('#effect_flashPalette'),swatches=pool.locator('input[type=color]');
    assert.equal(await swatches.count(),3);
    await pool.locator('.effectPaletteAdd').click();
    assert.equal(await swatches.count(),4);
    await swatches.nth(3).evaluate(e=>{window.__picker=e;e.value='#12ab34';e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await swatches.nth(3).evaluate(e=>e===window.__picker),true,'color picker remains mounted while editing');
    assert.equal(await swatches.nth(3).evaluate(e=>e.labels[0].textContent),'顏色 4');
    assert.equal((await saved()).flashPalette[3],'#12ab34');
    for(let i=4;i<12;i++)await pool.locator('.effectPaletteAdd').click();
    assert.equal(await swatches.count(),12);assert.ok(await pool.locator('.effectPaletteAdd').isDisabled());
    for(let i=12;i>4;i--)await pool.locator('.effectSwatchRemove').last().click();
    await set('flashCount',45);await set('flashDuration',.23);await set('burstDuration',3.4);
    assert.equal(await page.locator('#effect_value_flashDuration').textContent(),'0.23秒');
    await click('#effectSetDefault');
    const preset=await saved();
    await set('flashCount',9);await pool.locator('.effectSwatchRemove').last().click();
    await click('#effect_reset_flashes');
    assert.equal(await page.locator('#effect_flashCount').inputValue(),'45');assert.equal(await swatches.count(),4);
    await page.reload();await click('#tab_effects');await open('瞬閃星芒');
    assert.equal(await swatches.count(),4);assert.equal(await swatches.nth(3).inputValue(),'#12ab34');
    await set('flashCount',8);await click('#effectResetAll');assert.deepEqual(await saved(),preset);
    fs.mkdirSync(path.resolve(__dirname,'../artifacts'),{recursive:true});
    await pool.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/effects-palettes-settings.png')});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      for(const id of ['effectPreview','effectSetDefault','effectResetAll','btnStart']){
        const box=await page.locator('#'+id).boundingBox();
        assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+.1&&box.y+box.height<=844,id+' pinned inside viewport');
      }
    }
    for(let i=4;i>1;i--)await pool.locator('.effectSwatchRemove').last().click();
    assert.ok(await pool.locator('.effectSwatchRemove').isDisabled(),'keep at least one color');
    await swatches.first().evaluate(e=>{e.value='#00bdf2';e.dispatchEvent(new Event('input',{bubbles:true}));});
    // Test independent new reveal controls through the actual preview entry.
    await page.setViewportSize({width:390,height:844});await open('爆炸與收束');
    await set('burstDuration',3.4);await set('burstSize',150);await set('flashCount',45);
    await page.evaluate(()=>{
      const capture=RevealGather.prototype.capture;
      RevealGather.prototype.capture=function(...args){const r=capture.apply(this,args);window.__captured={settings:this.settings,flashes:this.flashes.length};window.__gather=this;return r;};
      const configure=RevealFlow.prototype.configure;
      RevealFlow.prototype.configure=function(...args){const r=configure.apply(this,args);window.__duration=this.gatherDuration;return r;};
    });
    const burst=page.locator('details').filter({has:page.locator('summary',{hasText:/^爆炸與收束$/})});
    await burst.locator('summary').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/effects-burst-settings.png')});
    await burst.locator('[data-flow-preview]').click();
    assert.equal(await page.locator('body').getAttribute('data-state'),'FLOW_PREVIEW');
    assert.equal(await page.evaluate(()=>window.__duration),3.4);
    await page.mouse.move(100,270);await page.mouse.down();await page.mouse.move(260,430,{steps:20});await page.mouse.up();
    await page.waitForFunction(()=>window.__captured?.flashes===45);
    const actual=await page.evaluate(()=>window.__captured.settings);
    assert.equal(actual.burstSize,1.5);assert.equal(actual.flashCount,45);assert.equal(actual.burstDuration,3.4);
    assert.deepEqual(actual.flashPalette,[[0,189,242]]);
    // Follow the actual edited swatch through capture into Chromium pixels.
    const rendered=await page.evaluate(()=>{
      const g=window.__gather,flashes=g.flashes,flash=flashes[0];
      const c=document.createElement('canvas');c.width=g.width;c.height=g.height;
      const ctx=c.getContext('2d');
      try{
        g.flashes=[flash];g.drawFlashes(ctx,{progress:flash.start+flash.life*.12});
        const p=g.flashFrame(flash,flash.start+flash.life*.12);
        return [...ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data];
      }finally{g.flashes=flashes;}
    });
    assert.ok(rendered[3]>190,'a configured flash still has a strong visible core');
    assert.ok(rendered[0]<10&&Math.abs(rendered[1]-189)<6&&Math.abs(rendered[2]-242)<6,
      'the sharp flash preserves the vivid picker color instead of mixing in white: '+rendered);
    await click('#effectPreviewBack');
    assert.ok(await burst.locator('[data-flow-preview]').evaluate(e=>document.activeElement===e),'preview returns focus to its actual launch button');
    // Previous three-color switches migrate without resetting current visuals.
    await page.evaluate(()=>{
      localStorage.setItem('mana.portal.effects.v1',JSON.stringify({version:1,appearanceRevision:2,values:{dotCount:115,starBlue:false,starPurple:true,starWhite:false,starColor2:'#aabbcc',backgroundOuter:'#123456'}}));
    });
    await page.reload();await click('#tab_effects');await open('閃爍星芒');
    assert.equal(await page.locator('#effect_starPalette input[type=color]').count(),1);
    assert.equal(await page.locator('#effect_starPalette input[type=color]').inputValue(),'#aabbcc');
    assert.equal(await page.locator('#effect_dotCount').inputValue(),'115');
    assert.equal(await page.locator('#effect_backgroundOuter').inputValue(),'#123456');
    assert.deepEqual(errors,[]);
    console.log('Settings browser: palette editing/bounds, persistence/defaults/migration, mobile layout, fixed footer and configured reveal preview passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
