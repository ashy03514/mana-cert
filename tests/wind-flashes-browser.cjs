/* Compare the same volume at the same time with/without embedded SS light. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
    page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const r=window.flashRenderer=new WindTornadoRenderer();
      const c=document.createElement('canvas');c.width=390;c.height=844;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      window.flashTest=(time,rank,gain)=>{
        const original=WindRankEffects.forRank(rank),profile={...original,stormFlash:gain??original.stormFlash};
        ctx.clearRect(0,0,390,844);
        r.draw(ctx,c,390,844,{time,profile,formation:1,playbackRate:1.5});
        const rgba=r.patchCtx.getImageData(0,0,r.patch.width,r.patch.height).data;
        return {rgba:Array.from(rgba),w:r.patch.width,h:r.patch.height,flashes:r.flashes,
          error:r.error,gl:r.gl.getError(),png:c.toDataURL('image/png')};
      };
      const ss=WindRankEffects.forRank('SS');
      const peaks={cloud:{time:0,gain:0},funnel:{time:0,gain:0}};
      for(let t=0;t<3.8;t+=.01){const f=r.flashFrame(t,t*2.25,ss);
        for(const key of ['cloud','funnel'])if(f[key][3]>peaks[key].gain)peaks[key]={time:t,gain:f[key][3]};}
      window.flashPeaks=peaks;
    });
    const peaks=await page.evaluate(()=>flashPeaks);
    for(const key of ['cloud','funnel']){
      assert.ok(peaks[key].gain>.8);
      const t=peaks[key].time;
      const base=await page.evaluate(t=>flashTest(t,'SS',0),t);
      const lit=await page.evaluate(t=>flashTest(t,'SS'),t);
      assert.equal(lit.error,'');assert.equal(lit.gl,0);
      let changed=0,alphaChanged=0,outside=0,brightened=0;
      for(let i=0;i<lit.rgba.length;i+=4){
        if(lit.rgba[i+3]!==base.rgba[i+3])alphaChanged++;
        const delta=lit.rgba[i]+lit.rgba[i+1]+lit.rgba[i+2]-base.rgba[i]-base.rgba[i+1]-base.rgba[i+2];
        if(delta>12){changed++;brightened+=delta;if(base.rgba[i+3]===0)outside++;}
      }
      assert.equal(alphaChanged,0,'embedded light cannot change the cloud silhouette or opacity');
      assert.equal(outside,0,'there are no external flashes or lightning in empty air');
      assert.ok(changed>100&&brightened>4000,key+' visibly lights the existing cloud volume');
      const again=await page.evaluate(t=>flashTest(t,'SS'),t);
      assert.deepEqual(again.rgba,lit.rgba,'a paused flash preserves every volume pixel');
      const save=(name,frame)=>fs.writeFileSync(path.join(root,'artifacts/'+name+'.png'),Buffer.from(frame.png.split(',')[1],'base64'));
      save('wind-ss-'+key+'-unlit',base);save('wind-ss-'+key+'-flash',lit);
      console.log(key+' flash: '+changed+' illuminated pixels; unchanged alpha and empty air.');
    }
    const s=await page.evaluate(t=>flashTest(t,'S'),peaks.cloud.time);
    const sDark=await page.evaluate(t=>flashTest(t,'S',0),peaks.cloud.time);
    assert.deepEqual(s.rgba,sDark.rgba,'S keeps its original material without any internal flash');
    assert.ok(s.flashes.cloud[3]===0&&s.flashes.funnel[3]===0);
    await page.evaluate(()=>flashRenderer.dispose());assert.deepEqual(errors,[]);
    console.log('SS internal flash GPU checks passed: cloud/funnel light, unchanged density/alpha, S exclusion and pause.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
