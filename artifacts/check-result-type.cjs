const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{let t=0,id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);Object.defineProperty(performance,'now',{value:()=>t});window.tick=()=>{t+=16;const a=[...jobs.values()];jobs.clear();a.forEach(f=>f(t));};});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.evaluate(()=>{
  const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.flowCheck=this;return reset.apply(this,args);};
  const begin=ManaResults.Session.prototype.begin;window.target='風';ManaResults.Session.prototype.begin=function(settings){begin.call(this,settings);this.currentResult=Object.freeze({type:'magic',element:target,rank:target==='風'?'B':'SS',mana:target==='風'?574:999});return this.currentResult;};
 });
 for(const element of ['風','火','水','土','光','暗']){
  await page.evaluate(e=>target=e,element);await page.locator('#btnStart').click();
  await page.waitForTimeout(300);
  await page.evaluate(()=>{flowCheck.state='REVEAL';flowCheck.elapsed=20;tick();});
  for(const [width,height,safe=0]of [[390,844],[320,568],[844,390],[390,844,34]]){
   await page.locator('#formalReplay').evaluate((el,safe)=>{el.style.bottom=(28+safe)+'px';},safe);
   await page.setViewportSize({width,height});await page.evaluate(()=>{dispatchEvent(new Event('resize'));tick();});
   assert.equal(await page.locator('#fireScanLabel').isVisible(),false);
   const style=await page.evaluate(()=>({value:getComputedStyle(fireScanValue).fontSize,rank:getComputedStyle(fireScanRank).fontSize,before:getComputedStyle(fireScanRank,'::before').content,
    main:parseFloat(getComputedStyle(document.querySelector('.elementName')).fontSize),title:parseFloat(getComputedStyle(revealTitle).fontSize)}));
   assert.ok(Math.abs(parseFloat(style.rank)/parseFloat(style.value)-1.65)<.001);assert.equal(style.before,'none');assert.ok(Math.abs(style.main/style.title-1.3)<.001);
   const boxes=[];for(const id of ['revealTitle','fireScanValue','fireScanRank','formalReplay']){const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,element+' '+id+' fits');boxes.push(b);}
   for(let i=0;i<3;i++)assert.ok(boxes[i].y+boxes[i].height<boxes[i+1].y,element+' text rows do not overlap');
   // Inspect full animated star bounds, not just the rank text rectangle.
   const decorative=await page.evaluate(()=>{
    const host=fireScanRank,number=fireScanValue.getBoundingClientRect(),button=formalReplay.getBoundingClientRect();
    const violations=[];
    for(let time=20;time<=24;time+=.25){
     RankLettering.apply(host,host.dataset.rank,time);
     for(const star of host.querySelectorAll('.rankSpark')){
      if(Number(star.style.opacity)<.04)continue;
      const box=star.getBoundingClientRect();
      if(box.bottom+6>button.top-16||box.top-6<number.bottom+2||box.left<0||box.right>innerWidth)violations.push({time,x:box.x,y:box.y,bottom:box.bottom,numberBottom:number.bottom,buttonTop:button.top});
     }
    }
    RankLettering.apply(host,host.dataset.rank,20);
    const hit=document.elementFromPoint(button.x+button.width/2,button.y+button.height/2);
    return {violations,buttonClickable:!!hit?.closest('#formalReplay')};
   });
   assert.deepEqual(decorative.violations,[],element+' star envelope clears numbers and action button');
   assert.equal(decorative.buttonClickable,true);
   if(element==='風'&&!safe)await page.screenshot({path:path.resolve(`artifacts/result-type-wind-${width}x${height}.png`)});
  }
  await page.locator('#formalReplay').click();await page.locator('#btnGoHome').click();
 }
 assert.deepEqual(errors,[]);console.log('PASS six elements, removed labels, 130% main character, 165% rank font size, three viewport layouts, simulated 34px safe area, star envelope and result actions.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
