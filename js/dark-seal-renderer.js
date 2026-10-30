/* Generated iron texture follows articulated restraints. All assets work via
 * file:// as well as HTTP; the host owns the active clock and canvas. */
(function(root){
 'use strict';
 const M=root.DarkSealMotion;
 class DarkSealRenderer{
  constructor(){
   this.canvas=document.createElement('canvas');this.gl=null;this.program=null;this.loaded=false;this.error='';this.disposed=false;this.lost=false;
   this.image=new Image();this.ringImage=new Image();this.lastTime=-Infinity;
   this.onLost=e=>{e.preventDefault();this.lost=true;};
   this.onRestored=()=>{this.lost=false;this.gl=null;this.program=null;this.lastTime=-Infinity;};
   this.canvas.addEventListener('webglcontextlost',this.onLost);this.canvas.addEventListener('webglcontextrestored',this.onRestored);
   this.ready=new Promise(resolve=>{
    this.resolveReady=resolve;
    let remaining=2;const ready=()=>{if(this.disposed)return resolve(false);if(--remaining)return;try{this.measureAsset();this.prepareRing();this.loaded=true;resolve(true);}catch(e){this.error='封印素材無法讀取，請重新整理。';resolve(false);}};
    this.image.onload=ready;this.ringImage.onload=ready;
    this.image.onerror=()=>{this.error='鎖鏈素材載入失敗，請重新整理。';resolve(false);};
    this.ringImage.onerror=()=>{this.error='封印素材載入失敗，請重新整理。';resolve(false);};
    this.image.src=root.DarkChainAsset||new URL('../assets/dark-chain-v1.png',document.currentScript?.src||location.href).href;
    this.ringImage.src=root.DarkSealRingAsset||new URL('../assets/dark-seal-ring-v1.png',document.currentScript?.src||location.href).href;
   });
  }
  prepareRing(){
   this.plates=[];
   for(let i=0;i<9;i++){
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),angle=i*M.TAU/9-.17;
    ctx.translate(256,256);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,370,angle+.012,angle+M.TAU/9-.012);ctx.closePath();ctx.clip();
    ctx.drawImage(this.ringImage,-256,-256,512,512);this.plates.push(c);
   }
  }
  measureAsset(){
   const c=document.createElement('canvas');c.width=this.image.naturalWidth;c.height=this.image.naturalHeight;
   const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(this.image,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
   let left=c.width,top=c.height,right=0,bottom=0,transparent=0;
   for(let y=0;y<c.height;y++)for(let i=0;i<c.width;i++){const a=d[(y*c.width+i)*4+3];if(a>16){left=Math.min(left,i);right=Math.max(right,i);top=Math.min(top,y);bottom=Math.max(bottom,y);}else transparent++;}
   if(right<=left||bottom<=top||transparent<c.width*c.height*.2)throw Error('Chain requires transparent padding');
   this.textureBounds={x:left,y:Math.max(0,top-2),width:right-left+1,height:bottom-top+5};
  }
  init(){
   if(this.program)return true;if(this.disposed||this.lost)return false;
   const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false});
   try{
    if(!gl)throw Error('WebGL unavailable');const p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,root.DarkSealShader.vertex],[gl.FRAGMENT_SHADER,root.DarkSealShader.fragment]]){
     const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
     if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(p,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    this.program=p;this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.position=gl.getAttribLocation(p,'aPosition');this.uniforms={};
    for(const n of ['uResolution','uCenter','uRadius','uTime','uCharge','uSurge','uImpact','uReveal'])this.uniforms[n]=gl.getUniformLocation(p,n);
    return true;
   }catch(e){this.diagnostic=String(e);this.error='目前無法顯示深淵封印，請重新整理。';return false;}
  }
  background(ctx,w,h,a,s){
   const gl=this.gl,u=this.uniforms,dpr=Math.min(root.devicePixelRatio||1,1.25,Math.sqrt(420000/(w*h)));
   const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
   if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
   gl.viewport(0,0,pw,ph);gl.useProgram(this.program);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
   gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
   gl.uniform2f(u.uResolution,w,h);gl.uniform2f(u.uCenter,a.cx,a.cy);gl.uniform1f(u.uRadius,a.radius);
   for(const [n,v] of [['uTime',s.time],['uCharge',s.charge],['uSurge',s.surge],['uImpact',s.impact],['uReveal',s.reveal]])gl.uniform1f(u[n],v);
   gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(this.canvas,0,0,w,h);
  }
  chain(ctx,index,a,s){
   const chain=M.CHAINS[index],bounds=this.textureBounds,points=[],steps=40;
   const dx=Math.cos(chain.end),dy=Math.sin(chain.end),tx=dx>0?(this.width-a.cx)/dx:-a.cx/dx,ty=dy>0?(this.height-a.cy)/dy:-a.cy/dy;
   const outerDistance=Math.max(2.8,Math.min(tx,ty)/a.radius+.35);
   let length=0;for(let j=0;j<=steps;j++){const p=M.chainPoint(index,j/steps,s,outerDistance);points.push({x:a.cx+p.x*a.radius,y:a.cy+p.y*a.radius});if(j)length+=Math.hypot(points[j].x-points[j-1].x,points[j].y-points[j-1].y);}
   const thick=a.radius*chain.thickness,span=Math.min(bounds.width-4,length/thick*bounds.height),offset=(bounds.width-span)*M.seed(index+12);
   ctx.save();ctx.globalAlpha=s.reveal*(chain.depth<.9?.64:1);
   // Overlapping narrow strips bend the entire authored strand without losing
   // its interlocking order. The alpha between each iron link stays transparent.
   let walked=0;
   for(let j=0;j<steps;j++){
    const p=points[j],q=points[j+1],distance=Math.hypot(q.x-p.x,q.y-p.y),sx=bounds.x+offset+walked/length*span,sw=distance/length*span;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(q.y-p.y,q.x-p.x));
    ctx.drawImage(this.image,sx,bounds.y,sw,bounds.height,-.45,-thick*.5,distance+.9,thick);ctx.restore();walked+=distance;
   }
   ctx.restore();
  }
  seal(ctx,a,s){
   const r=a.radius;
   ctx.save();ctx.translate(a.cx,a.cy);ctx.globalAlpha=s.reveal;
   // Broken, bevelled iron plates carry the binding inscription; their slow
   // independent movement follows the same pressure as the restraint anchors.
   for(let i=0;i<9;i++){
    const angle=i*M.TAU/9-.17,begin=angle+.045,end=angle+M.TAU/9-.055;
    const pushed=s.surge*.13-s.charge*.025+s.recoil+Math.sin(s.time*.61+i*1.7)*.007;
    ctx.save();ctx.translate(Math.cos(angle+.3)*r*pushed,Math.sin(angle+.3)*r*pushed);
    ctx.scale(1,1.10);
    ctx.drawImage(this.plates[i],-r,-r,2*r,2*r);
    // A restrained grazing glow follows the engraved inner lip only when
    // pressure rises, leaving the generated metal damage readable.
    if(s.surge+s.impact>.02){
     ctx.globalCompositeOperation='screen';ctx.globalAlpha=s.reveal*(s.surge*.22+s.impact*.35);
     ctx.shadowColor='#9f70e0';ctx.shadowBlur=r*.045;ctx.strokeStyle='#a786d3';ctx.lineWidth=r*.009;
     ctx.beginPath();ctx.arc(0,0,r*.61,begin+.03,end-.03);ctx.stroke();
    }
    ctx.restore();
   }
   // Thin distant fragments establish depth without a bright enclosing disc.
   for(let i=0;i<12;i++){
    const theta=i*M.TAU/12+s.time*.018,rr=r*(1.15+M.seed(i+71)*.16+s.surge*.07),z=.5+M.seed(i+92)*.5;
    ctx.save();ctx.translate(Math.cos(theta)*rr,Math.sin(theta)*rr*1.1);ctx.rotate(theta+s.time*.10);ctx.globalAlpha=s.reveal*z*.7;
    ctx.beginPath();ctx.moveTo(-r*.025,-r*.015);ctx.lineTo(r*.035,-r*.006);ctx.lineTo(r*.014,r*.018);ctx.closePath();ctx.fillStyle='#56505f';ctx.fill();ctx.strokeStyle='#b5a4cf44';ctx.lineWidth=.7;ctx.stroke();ctx.restore();
   }
   ctx.restore();
  }
  dust(ctx,a,s){
   ctx.save();ctx.globalCompositeOperation='screen';
   for(let i=0;i<54;i++){
    const life=3.4+M.seed(i+501)*3,age=(s.time+M.seed(i+710)*life)%life,p=age/life,theta=M.seed(i+390)*M.TAU+p*.28;
    const radius=a.radius*(.40+(1-p)*(1.5+M.seed(i+418)*.6)),x=a.cx+Math.cos(theta)*radius,y=a.cy+Math.sin(theta)*radius*1.08;
    const alpha=Math.sin(p*Math.PI)*(.14+M.seed(i+620)*.22)*s.reveal,size=.5+M.seed(i+447)*1.4;
    ctx.globalAlpha=alpha;ctx.fillStyle='#b3a3ce';ctx.beginPath();ctx.arc(x,y,size,0,M.TAU);ctx.fill();
   }
   const age=s.phase-3.1;
   if(age>=0&&age<1.3)for(let i=0;i<48;i++){
    const chain=i%6,at=M.anchor(M.CHAINS[chain].angle,s),theta=M.CHAINS[chain].angle+(M.seed(i+35)-.5)*2.2;
    const speed=a.radius*(.26+M.seed(i+60)*.65),travel=speed*age;
    const x=a.cx+at.x*a.radius+Math.cos(theta)*travel,y=a.cy+at.y*a.radius+Math.sin(theta)*travel+age*age*a.radius*.15;
    ctx.globalAlpha=(1-age/1.3)**2*s.reveal*(.35+M.seed(i+44)*.5);ctx.strokeStyle=i%3?'#b7a4e7':'#f4d9af';ctx.lineWidth=.6+M.seed(i+77)*1.2;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(theta)*a.radius*.025,y-Math.sin(theta)*a.radius*.025);ctx.stroke();
   }
   ctx.restore();
  }
  draw(ctx,w,h,{time=0,box}={}){
   if(!this.loaded||this.disposed||this.lost||w<=0||h<=0||!Number.isFinite(w+h)||!this.init())return false;
   const s=M.sample(time),a=M.layout(w,h,box);this.frame=s;this.art=a;this.width=w;this.height=h;
   ctx.save();this.background(ctx,w,h,a,s);
   for(let i=0;i<M.CHAINS.length;i++)if(M.CHAINS[i].depth<.9)this.chain(ctx,i,a,s);
   this.seal(ctx,a,s);
   for(let i=0;i<M.CHAINS.length;i++)if(M.CHAINS[i].depth>=.9)this.chain(ctx,i,a,s);
   this.dust(ctx,a,s);ctx.restore();this.lastTime=s.time;return true;
  }
  dispose(){
   this.disposed=true;this.resolveReady?.(false);this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
   if(this.gl&&!this.lost){this.gl.deleteProgram(this.program);this.gl.deleteBuffer(this.quad);}this.gl=null;this.program=null;
  }
 }
 root.DarkSealRenderer=DarkSealRenderer;
})(globalThis);
