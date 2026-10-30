const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createCanvas,loadImage}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:440,height:440}});
 await page.goto((process.env.MANA_ORIGIN||'http://127.0.0.1:8795')+'/water-ocean-study.html');
 await page.evaluate(()=>waterOceanStudy.dispose());
 await page.setContent('<style>body{margin:0;background:#02121c}canvas{display:block;width:440px;height:440px}</style><canvas></canvas>');
 await page.evaluate(async()=>{window.r=new WaterOceanStudy(document.querySelector('canvas'));r.resize(440,440,1);await r.ready;});
 const sheet=createCanvas(440*3,480*2),ctx=sheet.getContext('2d');ctx.fillStyle='#02121c';ctx.fillRect(0,0,sheet.width,sheet.height);
 for(const[i,t]of [0,56,112,224,449,1800].entries()){
  const ok=await page.evaluate(t=>{r.draw(t);return {error:r.gl.getError(),ok:!r.error};},t);if(ok.error||!ok.ok)throw new Error(JSON.stringify(ok));
  const png=await page.screenshot();ctx.drawImage(await loadImage(png),(i%3)*440,Math.floor(i/3)*480+40);
  ctx.fillStyle='#d6f0fa';ctx.font='18px sans-serif';ctx.fillText(t+' s',(i%3)*440+16,Math.floor(i/3)*480+28);
 }
 const name=process.argv[2]||'after';fs.writeFileSync(path.join(__dirname,'ocean-projection-'+name+'.png'),sheet.toBuffer('image/png'));
 console.log('Ocean long-time projection captures complete: '+name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
