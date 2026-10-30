/* Production certification flow in real Chrome/WebGL. Not iPhone/PWA acceptance. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const artifact=name=>path.resolve(__dirname,'../artifacts',name);
const elements={fire:'火',water:'水',wind:'風',earth:'土',light:'光',dark:'暗'};

(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      let now=0,serial=0;const pending=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      window.requestAnimationFrame=callback=>{const id=++serial;pending.set(id,callback);return id;};
      window.cancelAnimationFrame=id=>pending.delete(id);
      window.__advanceFormal=milliseconds=>{
        let remaining=milliseconds;
        do{
          const increment=Math.min(50,remaining);now+=increment;remaining-=increment;
          const callbacks=[...pending.values()];pending.clear();
          for(const callback of callbacks)callback(now);
        }while(remaining>0);
      };
      window.__formalGl={draws:0,errors:[]};
      const original=WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays=function(...args){
        const result=original.apply(this,args),error=this.getError();
        window.__formalGl.draws++;if(error)window.__formalGl.errors.push(error);return result;
      };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const log=window.__formal={begins:0,states:[],materials:[],gather:null,recordTrail:false};
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(...args){
        log.roundStartState=log.states.length;
        const result=begin.apply(this,args);log.begins++;log.session=this;
        log.result=result;log.resultJSON=JSON.stringify(result);return result;
      };
      const transition=ManaResults.Session.prototype.transition;
      ManaResults.Session.prototype.transition=function(...args){
        const result=transition.apply(this,args);log.states.push(this.state);return result;
      };
      const step=RevealFlow.prototype.step;
      RevealFlow.prototype.step=function(...args){log.flow=this;return step.apply(this,args);};
      const capture=RevealGather.prototype.capture;
      RevealGather.prototype.capture=function(...args){
        const result=capture.apply(this,args);log.gather=this;return result;
      };
      const draw=FingerTrails.prototype.draw;
      FingerTrails.prototype.draw=function(...args){
        const result=draw.apply(this,args);
        if(log.recordTrail)log.trail={time:this.time,age:this.ageTime,image:this.layer.toDataURL('image/png')};
        return result;
      };
      const material=ElementMaterialRenderer.prototype.draw;
      ElementMaterialRenderer.prototype.draw=function(...args){
        const result=material.apply(this,args);log.renderer=this;
        log.materials.push({element:this.element,frame:args[4],ok:result});return result;
      };
    });
    const click=selector=>require('./result-action-helpers.cjs')(page,selector);
    const advance=milliseconds=>page.evaluate(value=>window.__advanceFormal(value),milliseconds);
    const bodyState=()=>page.locator('body').getAttribute('data-state');
    const canvasImage=()=>page.locator('#particleCanvas').evaluate(canvas=>canvas.toDataURL('image/png'));
    const snapshot=()=>page.evaluate(()=>{
      const s=window.__formal;
      return {begins:s.begins,states:s.states,roundStates:s.states.slice(s.roundStartState),result:s.session.currentResult,
        immutable:Object.isFrozen(s.session.currentResult),same:s.result===s.session.currentResult,
        unchanged:s.resultJSON===JSON.stringify(s.session.currentResult),
        flow:s.flow&&{state:s.flow.state,elapsed:s.flow.elapsed,duration:s.flow.gatherDuration},
        materialCount:s.materials.length,lastMaterial:s.materials.at(-1),
        settings:s.gather?.settings,orbCount:s.gather?.orbs.length,
        gl:window.__formalGl};
    });
    const checkStable=async(begins)=>{
      const s=await snapshot();assert.equal(s.begins,begins,'the reveal never rolls another result');
      assert.equal(s.same,true,'the exact result object survives the reveal');
      assert.equal(s.immutable,true,'the certification result stays frozen');
      assert.equal(s.unchanged,true,'the certification result does not mutate');
      assert.ok(!s.states.some(state=>['RANK_CONFIRM','RESULT'].includes(state)),
        'this stage must stop before rank confirmation or the final card');
      if(s.result.element!=='火'&&s.result.element!=='水')assert.ok(!s.roundStates.includes('MANA_SCAN'),
        'the other elements and muggle retain the attribute endpoint');
      assert.ok(s.roundStates.filter(state=>state==='MANA_SCAN').length<=1,'a round can enter measurement only once');
      assert.equal(await page.locator('#resultWrap').isVisible(),false,'the result card stays hidden');
      assert.equal(await page.locator('#materialControls').isVisible(),false,'formal mode has no material selector');
      assert.equal(await page.locator('#materialError').isVisible(),false,'the real material has no renderer error');
      assert.deepEqual(s.gl.errors,[]);return s;
    };
    const forceElement=async(key)=>{
      await click('#tab_switches');
      // Checking the master first resets all switches through the public UI.
      await page.locator('#s_master').check({force:true});
      await page.locator('#s_muggle').uncheck({force:true});
      for(const element of Object.keys(elements))if(element!==key)await page.locator('#s_'+element).uncheck({force:true});
      assert.equal(await page.locator('#btnStart').isEnabled(),true);
    };
    const stroke=async()=>{
      await page.mouse.move(105,365);await page.mouse.down();
      for(const [x,y] of [[125,285],[185,250],[258,278],[285,345],[225,408],[147,393],[143,320],[212,303],[250,350]])
        await page.mouse.move(x,y,{steps:5});
    };
    const save=async(name)=>{fs.mkdirSync(path.dirname(artifact(name)),{recursive:true});await page.screenshot({path:artifact(name)});};

    await forceElement('fire');await click('#btnStart');await advance(0);
    assert.equal(await bodyState(),'STANDBY');
    assert.equal((await snapshot()).result.element,'火','the public switch settings select the committed element');
    await page.mouse.click(195,330);await advance(1500);
    assert.ok(['STANDBY','INTERACTION'].includes(await bodyState()),'a blank tap cannot start a reveal');
    assert.equal((await snapshot()).flow.state,'DRAWING');
    await stroke();await advance(2600);
    assert.equal((await snapshot()).flow.state,'DRAWING','holding a drawing never starts the release countdown');
    await page.mouse.up();
    await page.evaluate(()=>{window.__formal.recordTrail=true;});await advance(0);
    const released=await page.evaluate(()=>window.__formal.trail);
    await advance(300);const flowing=await page.evaluate(()=>window.__formal.trail);
    assert.equal((await snapshot()).flow.state,'WAITING');
    assert.ok(flowing.time>released.time+.29,'releasing the pointer does not stop the ribbon animation clock');
    assert.ok(Math.abs(flowing.age-released.age)<1e-9,'the waiting ribbon is retained without fading');
    assert.notEqual(flowing.image,released.image,'the retained ribbon pixels keep flowing after release');
    await page.evaluate(()=>{window.__formal.recordTrail=false;});
    await advance(1150);assert.equal((await snapshot()).flow.state,'WAITING','the charge hold still allows resumed drawing');
    await page.mouse.move(250,350);await page.mouse.down();await page.mouse.move(300,385,{steps:5});
    await advance(1400);assert.equal((await snapshot()).flow.state,'DRAWING','resuming input during the charge hold cancels the previous wait');
    await page.mouse.up();await advance(1150);assert.equal((await snapshot()).flow.state,'WAITING');
    await advance(100);assert.equal((await snapshot()).flow.state,'WAITING','the second inward wave finishes before the charge hold');
    await advance(400);assert.equal((await snapshot()).flow.state,'WAITING','formal burst waits for the full half-second charge hold');
    await advance(100);assert.equal(await bodyState(),'GATHER');
    let s=await checkStable(1);assert.equal(s.flow.state,'GATHER');assert.equal(s.flow.duration,2.1);
    assert.ok(s.orbCount>0,'formal gather captures the actual drawn ink');

    // Backgrounding freezes the active timeline and cannot skip past the gather.
    const beforePause=s.flow.elapsed,frozen=await canvasImage();
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await advance(2200);
    assert.equal((await snapshot()).flow.elapsed,beforePause);assert.equal(await canvasImage(),frozen);
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await advance(0);await advance(50);
    assert.ok((await snapshot()).flow.elapsed<beforePause+.051,'returning from the background does not jump the timeline');
    await advance(2000);s=await snapshot();assert.equal(s.flow.state,'FORM');
    assert.equal(await bodyState(),'ELEMENT_REVEAL');
    await advance(2200);s=await checkStable(1);assert.equal(s.flow.state,'REVEAL');
    assert.equal(await page.locator('#revealTitle').textContent(),'火屬性');
    assert.equal(await page.locator('#revealTitle').isVisible(),true);
    assert.equal(await bodyState(),'MANA_SCAN','the shortened intro already starts the numeric reading');
    assert.equal(await page.locator('#formalReplay').isVisible(),false,'replay waits for the first measurement stage to complete');
    await advance(1400);s=await checkStable(1);
    assert.equal(await bodyState(),'MANA_SCAN','the shared reveal clock starts measurement after 0.85 seconds');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),true);
    assert.notEqual(await page.locator('#fireScanLabel').textContent(),'預覽數值','the production measurement is not a sample');
    const initialValue=Number(await page.locator('#fireScanValue').textContent());
    assert.ok(initialValue>=0&&initialValue<s.result.mana,'the formal counter rises toward the committed result');
    const scanElapsed=s.flow.elapsed,scanPixels=await canvasImage();
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await advance(10000);
    assert.equal((await snapshot()).flow.elapsed,scanElapsed,'backgrounding freezes the scan clock');
    assert.equal(Number(await page.locator('#fireScanValue').textContent()),initialValue,'backgrounding cannot complete the counter');
    assert.equal(await canvasImage(),scanPixels,'the backgrounded scan is pixel-identical');
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await advance(0);
    assert.equal((await snapshot()).flow.elapsed,scanElapsed,'returning does not include the background interval');
    const early=await canvasImage();await advance(16000);const late=await canvasImage();
    s=await checkStable(1);assert.equal(s.flow.state,'REVEAL','the material clock stays live after the first scan stage');
    assert.equal(await bodyState(),'MANA_SCAN','the completed first stage does not advance into result presentation');
    assert.equal(Number(await page.locator('#fireScanValue').textContent()),s.result.mana,'the displayed value equals the original frozen outcome');
    assert.equal(await page.locator('#fireScanRank').textContent(),s.result.rank,'the reached value has its matching rank');
    assert.equal(s.roundStates.filter(state=>state==='MANA_SCAN').length,1,'the formal scan transition occurs exactly once');
    assert.notEqual(late,early,'the held reveal is animated rather than a frozen completion frame');
    assert.equal(s.lastMaterial.element,'fire');assert.ok(s.lastMaterial.frame.time>16);
    assert.equal(s.lastMaterial.frame.opacity,1);assert.ok(s.lastMaterial.frame.phase<=.5,'late material remains in its formed envelope');
    await save('formal-reveal-fire.png');
    assert.equal(await page.locator('#effectPreviewBack').isVisible(),false,'completed result hides the corner button');
    for(const selector of ['#formalReplay']){
      const bounds=await page.locator(selector).boundingBox();
      assert.ok(bounds&&bounds.width>=44&&bounds.height>=44,selector+' is touch sized');
      assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,selector+' fits the phone viewport');
    }
    await click('#formalReplay');await advance(0);
    assert.equal(await bodyState(),'STANDBY');assert.equal((await snapshot()).begins,2,'explicit replay starts exactly one new round');
    assert.equal(await page.locator('#revealTitle').isVisible(),false,'replay removes the previous title');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'replay removes the previous measurement');
    assert.equal((await snapshot()).flow.state,'DRAWING');
    await click('#effectPreviewBack');assert.equal(await bodyState(),'SETTINGS');

    for(const [key,name] of Object.entries(elements).filter(([key])=>key!=='fire')){
      await forceElement(key);await click('#btnStart');await advance(0);
      const started=await snapshot(),beforeDraws=started.gl.draws;
      assert.equal(started.result.element,name);
      await stroke();await page.mouse.up();await advance(6800);
      const complete=await checkStable(started.begins);
      assert.equal(complete.flow.state,'REVEAL',key+' remains at the attribute reveal');
      assert.equal(await bodyState(),key==='water'?'MANA_SCAN':'ELEMENT_REVEAL');
      assert.equal(await page.locator('#revealTitle').textContent(),name+'屬性');
      assert.equal(await page.locator('#fireScanReadout').isVisible(),key==='water',key+' uses its own measurement capability');
      assert.ok(await page.locator('#revealTitle').evaluate(el=>Number(getComputedStyle(el).opacity))>.9);
      assert.ok(complete.gl.draws>beforeDraws,key+' draws the real shader');
      assert.equal(complete.lastMaterial.element,key);
      const frame=await canvasImage();await advance(350);
      assert.notEqual(await canvasImage(),frame,key+' material remains animated');
      if(key==='water')await save('formal-reveal-water.png');
      await click('#effectPreviewBack');assert.equal(await bodyState(),'SETTINGS');
      console.log(key+' official flow passed with immutable result and live '+name+' shader.');
    }

    // Personal effect settings also drive the formal gather clock and drawing.
    await click('#tab_effects');
    await page.getByText('爆炸與收束',{exact:true}).click({force:true});
    for(const [key,value] of Object.entries({burstDuration:1.2,burstSize:145,burstRadius:130}))
      await page.locator('#effect_'+key).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    await forceElement('water');await click('#btnStart');await advance(0);
    await stroke();await page.mouse.up();await advance(1750);s=await snapshot();
    assert.equal(s.flow.state,'GATHER');assert.equal(s.flow.duration,1.2);
    assert.equal(s.settings.burstDuration,1.2);assert.equal(s.settings.burstSize,1.45);assert.equal(s.settings.burstRadius,1.3);
    await advance(1250);assert.equal((await snapshot()).flow.state,'FORM','the shorter configured gather reaches formation on time');
    await click('#effectPreviewBack');assert.equal(await bodyState(),'SETTINGS');

    // Muggle is a real outcome. It must never be silently replaced by fire.
    await click('#tab_switches');await page.locator('#s_master').check({force:true});
    for(const key of Object.keys(elements))await page.locator('#s_'+key).uncheck({force:true});
    await click('#tab_probabilities');
    await page.locator('#muggleChance').evaluate(input=>{input.value=100;input.dispatchEvent(new Event('input',{bubbles:true}));});
    await click('#btnStart');await advance(0);const muggleStart=await snapshot();
    assert.equal(muggleStart.result.type,'muggle');assert.equal(muggleStart.result.element,null);
    await stroke();await page.mouse.up();await advance(6800);
    const muggle=await checkStable(muggleStart.begins);
    assert.equal(muggle.flow.state,'REVEAL');assert.equal(await bodyState(),'ELEMENT_REVEAL');
    assert.equal(await page.locator('#revealTitle').textContent(),'未顯現屬性');
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false,'muggle does not show a fire reading');
    assert.equal(muggle.materialCount,muggleStart.materialCount,'muggle never asks an element renderer to draw');
    assert.equal(muggle.gl.draws,muggleStart.gl.draws,'muggle does not draw a fake elemental WebGL effect');
    await save('formal-reveal-muggle.png');
    await page.setViewportSize({width:844,height:390});await advance(0);
    assert.equal(await page.locator('#effectPreviewBack').isVisible(),false,'completed result hides the corner button');
    for(const selector of ['#formalReplay']){
      const bounds=await page.locator(selector).boundingBox();
      assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=844&&bounds.y+bounds.height<=390,selector+' fits landscape');
    }
    await click('#effectPreviewBack');assert.equal(await bodyState(),'SETTINGS');
    assert.deepEqual(errors,[],'formal reveal, replay, return and backgrounding have no JavaScript exceptions');
    console.log('Formal reveal browser: 6 real WebGL elements, frozen fire measurement without confirmation/card, five preserved attribute endpoints, live waiting ribbon, muggle without fake material, scan lifecycle, configured gather, replay/return and responsive controls passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
