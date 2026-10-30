const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return original.call(this,type,type==='2d'?{...options,willReadFrequently:true}:options);};let id=0;requestAnimationFrame=()=>++id;cancelAnimationFrame=()=>{};});
 await page.goto(pathToFileURL(path.resolve('dark-demon-wing-motion-study.html')).href);await page.waitForFunction(()=>!darkDemonWingMotionStudy.state.loading,null,{polling:100});
 console.log(await page.evaluate(()=>{
  const study=darkDemonWingMotionStudy,r=study.renderer,c=document.querySelector('canvas'),ctx=c.getContext('2d');
  const hash=bytes=>{let h=2166136261;for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619)>>>0;return h;};
  const sample=t=>{study.renderAt(t);const gl=r.gl,pixels=ctx.getImageData(0,0,c.width,c.height).data,gp=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,gp);return {pixels:new Uint8Array(pixels),gp,art:r.lastArt,poseHash:hash(new Uint8Array(r.meshes[0].vertices.buffer)),chainHash:hash(new Uint8Array(r.chains[0].vertices.buffer)),hash:hash(pixels),glhash:hash(gp),w:c.width,h:c.height};};
  const a=sample(6.6);sample(.7);const b=sample(6.6);const next=sample(6.6);
  const diff=(a,b)=>{let count=0,sum=0,max=0,left=c.width,top=c.height,right=0,bottom=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<4;k++)d+=Math.abs(a[i+k]-b[i+k]);if(d){count++;sum+=d;max=Math.max(max,d);const x=(i/4)%c.width,y=Math.floor(i/4/c.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}return {count,sum,max,left,right,top,bottom};};
  window.firstPixels=a.pixels;window.lastPixels=b.pixels;
  const compact=v=>({art:v.art,poseHash:v.poseHash,chainHash:v.chainHash,hash:v.hash,glhash:v.glhash,w:v.w,h:v.h});
  return {a:compact(a),b:compact(b),next:compact(next),diff:diff(a.pixels,b.pixels),gldiff:diff(a.gp,b.gp),nextdiff:diff(b.pixels,next.pixels)};
 }));
 for(const [label,key]of [['before','firstPixels'],['after','lastPixels']]){
  const url=await page.evaluate(key=>{const c=document.createElement('canvas');c.width=390;c.height=844;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(window[key]),390,844),0,0);return c.toDataURL();},key);fs.writeFileSync('artifacts/demon-debug-'+label+'.png',Buffer.from(url.split(',')[1],'base64'));
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
