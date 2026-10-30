'use strict';
// Track the actual photographic sea material with breakers and spray disabled.
// Run serially with other GPU suites. No shader or texture substitute is used.
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
    assert.equal(await page.evaluate(()=>waterOceanStudy.renderer.ready),true);
    await page.evaluate(()=>waterOceanStudy.dispose());
    await page.setContent('<style>html,body{margin:0;background:#02121c}canvas{display:block;width:440px;height:440px}</style><canvas></canvas>');
    await page.evaluate(async()=>{
      window.currentRenderer=new WaterOceanStudy(document.querySelector('canvas'));
      currentRenderer.resize(440,440,1);
      if(!await currentRenderer.ready)throw new Error(currentRenderer.diagnostic||currentRenderer.error);
      window.currentFrames=new Map();
      window.captureCurrent=time=>{
        const r=currentRenderer,gl=r.gl,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
        if(!r.draw(time,{surge:1,breakers:0,spray:0}))throw new Error(r.diagnostic||r.error);
        const rgba=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        // Screen-coordinate luminance with a light blur rejects isolated glints,
        // while preserving the photograph's distinctive foam filaments.
        const grey=new Float32Array(w*h),blur=new Float32Array(w*h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const at=((h-1-y)*w+x)*4;grey[y*w+x]=rgba[at]*.25+rgba[at+1]*.5+rgba[at+2]*.25;
        }
        for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
          let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=grey[(y+dy)*w+x+dx];
          blur[y*w+x]=sum/9;
        }
        currentFrames.set(time,blur);
        return {gl:gl.getError(),spray:r.spray.count,time:r.time};
      };
      window.measureCurrent=(first,second)=>{
        const a=currentFrames.get(first),b=currentFrames.get(second),w=440;
        const median=values=>values.sort((x,y)=>x-y)[Math.floor(values.length/2)];
        function track(cx,cy){
          let best={score:-Infinity,dx:0,dy:0};
          for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
            let sa=0,sb=0,aa=0,bb=0,ab=0,n=0;
            for(let y=-16;y<=16;y+=2)for(let x=-16;x<=16;x+=2){
              const av=a[(cy+y)*w+cx+x],bv=b[(cy+y+dy)*w+cx+x+dx];
              sa+=av;sb+=bv;aa+=av*av;bb+=bv*bv;ab+=av*bv;n++;
            }
            const score=(ab-sa*sb/n)/Math.sqrt(Math.max(1e-9,(aa-sa*sa/n)*(bb-sb*sb/n)));
            if(score>best.score)best={score,dx,dy};
          }
          return best;
        }
        return [['left',145],['center',220],['right',295]].map(([region,cx])=>{
          const tracks=[];for(const y of [-14,0,14])for(const x of [-14,0,14])tracks.push(track(cx+x,220+y));
          const reliable=tracks.filter(track=>track.score>.55);
          return {region,tracks,reliable:reliable.length,dx:median(reliable.map(p=>p.dx)),dy:median(reliable.map(p=>p.dy)),
            score:median(reliable.map(p=>p.score))};
        });
      };
    });
    const metrics=[],sheet=createCanvas(edge*2,(edge+36)*3),ctx=sheet.getContext('2d');
    ctx.fillStyle='#02121c';ctx.fillRect(0,0,sheet.width,sheet.height);
    for(const [row,time]of [0,56,112].entries()){
      for(const [column,t]of [time,time+.6].entries()){
        const frame=await page.evaluate(t=>captureCurrent(t),t);
        assert.equal(frame.gl,0);assert.equal(frame.spray,0);assert.equal(frame.time,t);
        const png=await page.screenshot({timeout:60000});
        ctx.fillStyle='#d6f0fa';ctx.font='18px sans-serif';ctx.fillText(t.toFixed(1)+' s · material only',column*edge+12,row*(edge+36)+25);
        ctx.drawImage(await loadImage(png),column*edge,row*(edge+36)+36,edge,edge);
      }
      metrics.push({time,regions:await page.evaluate(([first,second])=>measureCurrent(first,second),[time,time+.6])});
    }
    const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
    fs.writeFileSync(path.join(artifacts,'ocean-current-direction.png'),sheet.toBuffer('image/png'));
    fs.writeFileSync(path.join(artifacts,'ocean-current-direction.json'),JSON.stringify(metrics,null,2));
    for(const {time,regions}of metrics)for(const region of regions){
      assert.ok(region.reliable>=5,'recognisable ocean texture in '+region.region+' at '+time+' s');
      assert.ok(region.dx>0,'sea texture moves right in '+region.region+' at '+time+' s: '+JSON.stringify(region));
      assert.ok(region.dy<0,'sea texture moves up in '+region.region+' at '+time+' s: '+JSON.stringify(region));
    }
    assert.deepEqual(errors,[]);await page.evaluate(()=>currentRenderer.dispose());
    console.log('Ocean material direction passed: real texture moves lower-left to upper-right across left/center/right, at early and late phases.');
    console.log(JSON.stringify(metrics.map(m=>({time:m.time,regions:m.regions.map(({region,dx,dy,score})=>({region,dx,dy,score}))}))));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
