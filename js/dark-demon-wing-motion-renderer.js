/* Approved membrane artwork on two articulated meshes. Chain ribbons share
 * the wing's attachment coordinates but have their own delayed motion. */
(function(root){
 'use strict';
 const vertex=`attribute vec2 aPosition;attribute vec2 aUv;uniform vec2 uResolution;varying vec2 vUv;
 void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uResolution.x*2.-1.,1.-aPosition.y/uResolution.y*2.,0.,1.);}`;
 const fragment=`precision mediump float;uniform sampler2D uImage;uniform float uLight,uOpacity;varying vec2 vUv;
 void main(){vec4 c=texture2D(uImage,vUv);gl_FragColor=vec4(c.rgb*uLight,c.a)*uOpacity;}`;
 const seed=n=>{const v=Math.sin(n*127.1+43.7)*43758.5453;return v-Math.floor(v);};
 const chainSpecs=[
  {points:[[.342,.153],[.373,.153],[.365,.185]],thickness:.014,behind:true,wrap:true,start:.35},
  {points:[[.350,.177],[.335,.620],[.210,.560]],thickness:.013,start:.18},
  {points:[[.350,.204],[.325,.480],[.450,.415]],thickness:.009,start:.43},
  {points:[[.342,.153],[.337,.201],[.365,.185]],thickness:.014,wrap:true,start:.35}
 ];
 class DarkDemonWingMotionRenderer{
  constructor(){
   this.canvas=document.createElement('canvas');this.gl=null;this.program=null;
   this.meshes=[];this.chains=[];this.textures=[];this.loaded=false;this.lost=false;this.disposed=false;this.error='';this.diagnostic='';
   this.image=new Image();this.chain=new Image();this.drawCount=0;
   this.onLost=e=>{e.preventDefault();this.lost=true;};
   this.onRestored=()=>{if(this.disposed)return;this.lost=false;this.program=null;this.meshes=[];this.chains=[];this.textures=[];this.init();};
   this.canvas.addEventListener('webglcontextlost',this.onLost);this.canvas.addEventListener('webglcontextrestored',this.onRestored);
   this.ready=new Promise(resolve=>{this.resolveReady=resolve;let left=2;
    const ready=()=>{if(this.disposed||this.error)return resolve(false);if(--left)return;
     try{this.readChainBounds();this.loaded=true;resolve(true);}catch(e){this.fail(e);resolve(false);}};
    this.image.onload=this.chain.onload=ready;
    this.image.onerror=this.chain.onerror=()=>{if(this.disposed)return;this.fail('羽翼或鎖鏈素材無法載入');resolve(false);};
    this.image.src=root.DarkDemonWingAsset||new URL('../assets/dark-demon-wings-ss-v2.png',document.currentScript?.src||location.href).href;
    this.chain.src=root.DarkChainAsset||new URL('../assets/dark-chain-v1.png',document.currentScript?.src||location.href).href;
   });
  }
  fail(error){this.error='目前無法顯示闇翼動畫，請重新整理。';this.diagnostic=String(error);}
  readChainBounds(){
   const c=document.createElement('canvas');c.width=this.chain.naturalWidth;c.height=this.chain.naturalHeight;
   const ctx=c.getContext('2d');ctx.drawImage(this.chain,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;
   let left=c.width,right=0,top=c.height,bottom=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   if(right<=left||bottom<=top)throw Error('Empty chain texture');
   this.bounds={x:left,y:Math.max(0,top-2),w:right-left+1,h:Math.min(c.height-top,bottom-top+5)};
  }
  makeProgram(vertexSource=vertex,fragmentSource=fragment){
   const gl=this.gl,p=gl.createProgram(),shaders=[];
   try{for(const [type,source]of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]){
    const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);
   }gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
   }catch(e){gl.deleteProgram(p);throw e;}finally{shaders.forEach(s=>gl.deleteShader(s));}
  }
  mesh(vertices,indices){
   const gl=this.gl,m={vertices,buffer:gl.createBuffer(),indices:gl.createBuffer(),count:indices.length};
   gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);return m;
  }
  init(){
   if(this.disposed||this.lost||!this.loaded||this.error)return false;if(this.program)return true;
   try{
    const gl=this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:false,stencil:false});
    if(!gl)throw Error('WebGL unavailable');this.program=this.makeProgram();
    this.position=gl.getAttribLocation(this.program,'aPosition');this.uv=gl.getAttribLocation(this.program,'aUv');
    this.resolution=gl.getUniformLocation(this.program,'uResolution');this.light=gl.getUniformLocation(this.program,'uLight');this.sampler=gl.getUniformLocation(this.program,'uImage');
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    for(const image of [this.image,this.chain]){
     const texture=gl.createTexture();this.textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    for(const side of [-1,1]){
     const cols=32,rows=28,vertices=new Float32Array((cols+1)*(rows+1)*4),indices=[];
     for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
      const i=(y*(cols+1)+x)*4;vertices[i+2]=(side<0?0:.5)+x/cols*.5;vertices[i+3]=y/rows;
      if(x<cols&&y<rows){const a=y*(cols+1)+x,b=a+1,c=a+cols+1;indices.push(a,b,c,b,c+1,c);}
     }
     this.meshes.push(Object.assign(this.mesh(vertices,indices),{side}));
     for(const spec of chainSpecs){
      const steps=56,vertices=new Float32Array((steps+1)*8),indices=[];
      for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      const points=spec.points.map(([x,y])=>[side<0?x:1-x,y]);
      const curve=[];let length=0;
      for(let i=0;i<=steps;i++){const t=i/steps,q=this.bezier(points,t);if(i)length+=Math.hypot(q.x-curve[i-1].x,(q.y-curve[i-1].y)*2/3);curve.push(q);}
      // Freeze the number of links at rest: the texture never slides through
      // its attachment rings while the curve flexes or receives an impulse.
      const span=Math.min(this.bounds.w-2,length/spec.thickness*this.bounds.h),offset=(this.bounds.w-span)*spec.start;
      this.chains.push(Object.assign(this.mesh(vertices,indices),{side,spec,steps,curve,span,offset}));
     }
    }
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);return true;
   }catch(e){this.fail(e);this.release();return false;}
  }
  bezier(points,t){const m=1-t;return {x:m*m*points[0][0]+2*m*t*points[1][0]+t*t*points[2][0],y:m*m*points[0][1]+2*m*t*points[1][1]+t*t*points[2][1]};}
  layout(w,h,box){const b=box||{x:0,y:45,width:w,height:h*.54},width=Math.min(b.width*.88,b.height*1.35),height=width*2/3;
   const x=b.x+(b.width-width)/2,y=b.y+(b.height-height)/2;
   return {x,y,w:width,h:height,width,height,cx:x+width*.5,cy:y+height*.43};}
  paintWings(a,time,s){
   for(const m of this.meshes){for(let i=0;i<m.vertices.length;i+=4){const p=root.DarkDemonWingMotion.point(m.vertices[i+2],m.vertices[i+3],time,m.side,s);m.vertices[i]=a.x+p.x*a.w;m.vertices[i+1]=a.y+p.y*a.h;}this.upload(m);}
  }
  paintChains(a,time,s){
   const b=this.bounds;
   for(const m of this.chains){
    const projected=m.curve.map((q,i)=>{
     const p=m.spec.wrap?root.DarkDemonWingMotion.point(q.x,q.y,time,m.side,s):root.DarkDemonWingMotion.chainPoint(q.x,q.y,time,m.side,i/m.steps,s);
     return {x:a.x+p.x*a.w,y:a.y+p.y*a.h};
    });
    for(let i=0;i<=m.steps;i++){
     const p=projected[i],prev=projected[Math.max(0,i-1)],next=projected[Math.min(m.steps,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,length=Math.max(.001,Math.hypot(dx,dy)),r=a.w*m.spec.thickness*.5;
     const nx=-dy/length*r,ny=dx/length*r,u=(b.x+m.offset+i/m.steps*m.span)/this.chain.naturalWidth;
     m.vertices.set([p.x-nx,p.y-ny,u,b.y/this.chain.naturalHeight,p.x+nx,p.y+ny,u,(b.y+b.h)/this.chain.naturalHeight],i*8);
    }this.upload(m);
   }
  }
  upload(m){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,m.vertices);}
  drawMesh(m){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indices);
   gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,16,8);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
  glow(ctx,x,y,r,colors,alpha=1){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [at,color]of colors)g.addColorStop(at,color);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();}
  background(ctx,w,h,a,s){
   const x=a.x+a.w*.5,y=a.y+a.h*.43,t=s.time;
   const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#090b16');bg.addColorStop(.52,'#150d20');bg.addColorStop(1,'#080b14');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
   this.glow(ctx,x,y,a.w*(.76+s.release*.30),[[0,'#664f9665'],[.3,'#442d6940'],[.7,'#30224a22'],[1,'#211c3700']],.75+s.burst*.25);
   // Separate broad light volumes breathe at different rates. Their edges
   // dissolve into the background rather than rotating as a rigid sunburst.
   for(let i=0;i<9;i++){
    const drift=Math.sin(t*(.21+i*.017)+i*2.6),angle=-Math.PI+i*Math.PI/8+drift*.07;
    const reach=a.w*(.52+seed(i+21)*.40),spread=.055+seed(i+55)*.065;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=Math.min(1,(.5+drift*.2)*(1+s.burst*.9));
    const g=ctx.createLinearGradient(0,0,reach,0);g.addColorStop(0,'#b697eb20');g.addColorStop(.3,'#7669bf0c');g.addColorStop(1,'#9177bb00');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(reach*.4,-reach*spread*.7,reach,-reach*spread);ctx.quadraticCurveTo(reach*1.08,0,reach,reach*spread);ctx.quadraticCurveTo(reach*.4,reach*spread*.7,0,0);ctx.fill();ctx.restore();
   }
   for(let i=0;i<42;i++){
    const angle=seed(i+160)*Math.PI*2,r=a.w*(.3+seed(i+220)*.65),depth=seed(i+300);
    ctx.globalAlpha=(.15+depth*.25)*s.visible;ctx.fillStyle=i%3?'#b79ac9':'#a9bad7';ctx.beginPath();ctx.arc(x+Math.cos(angle)*r+Math.sin(t*.17+i)*a.w*.012,y+Math.sin(angle)*r*.8+Math.cos(t*.23+i)*a.w*.018,.5+depth,0,Math.PI*2);ctx.fill();
   }ctx.globalAlpha=1;
   const wave=(s.phase-2.20)/1.15;
   if(wave>0&&wave<1){const r=a.w*(.06+wave*.95),band=a.w*(.06+.05*wave),g=ctx.createRadialGradient(x,y,Math.max(0,r-band),x,y,r+band);
    g.addColorStop(0,'#937ee700');g.addColorStop(.48,'#b5a9ff30');g.addColorStop(1,'#937ee700');ctx.globalAlpha=Math.sin(wave*Math.PI)*.65;ctx.fillStyle=g;ctx.fillRect(x-r-band,y-r-band,2*(r+band),2*(r+band));ctx.globalAlpha=1;
   }
  }
  particles(ctx,a,time,rank='SS'){
   const colors=['#c5ceff','#bc97f5','#9ba6e3'];
   for(const p of root.DarkDemonWingMotion.particles(time,rank)){
    if(p.alpha<=.005)continue;const x=a.x+p.x*a.w,y=a.y+p.y*a.h,r=Math.max(.45,p.size*a.w);
    ctx.save();ctx.globalAlpha=p.alpha;ctx.fillStyle=colors[p.tint%3]||colors[0];ctx.translate(x,y);ctx.rotate(p.rotation||0);
    if(p.star){ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.12,-r*.12,r,0);ctx.quadraticCurveTo(r*.12,r*.12,0,r);ctx.quadraticCurveTo(-r*.12,r*.12,-r,0);ctx.quadraticCurveTo(-r*.12,-r*.12,0,-r);ctx.fill();}
    else{ctx.beginPath();ctx.ellipse(0,0,r*.65,r,0,0,Math.PI*2);ctx.fill();}ctx.restore();
   }
  }
  core(ctx,a,s){
   const x=a.x+a.w*.5,y=a.y+a.h*.43,pulse=.78+Math.sin(s.time*2.1)*.08+Math.sin(s.time*3.7+.6)*.05;
   ctx.save();ctx.globalCompositeOperation='screen';
   this.glow(ctx,x,y,a.w*(.075+s.charge*.025+s.burst*.11),[[0,'#c4b1ffb0'],[.17,'#9078df60'],[.5,'#6358ba20'],[1,'#5953af00']],pulse);
   this.glow(ctx,x,y,a.w*(.015+s.charge*.01+s.burst*.020),[[0,'#edeaffee'],[.2,'#b8c9ffb0'],[1,'#7775c600']],.7+s.burst*.3);ctx.restore();
  }
  draw(ctx,w,h,options={}){
   if(!this.init())return false;
   const gl=this.gl,time=Number.isFinite(options.time)?Math.max(0,options.time):0,s=root.DarkDemonWingMotion.sample(time),a=this.layout(w,h,options.box),dpr=Math.min(1.5,Math.max(1,ctx.getTransform().a));
   const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
   this.paintWings(a,time,s);if(options.chains!==false)this.paintChains(a,time,s);
   gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.uniform2f(this.resolution,w,h);gl.uniform1i(this.sampler,0);gl.activeTexture(gl.TEXTURE0);
   gl.uniform1f(gl.getUniformLocation(this.program,'uOpacity'),1);
   gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);gl.uniform1f(this.light,.8+s.release*.15);
   if(options.chains!==false)for(const m of this.chains)if(m.spec.behind)this.drawMesh(m);
   gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.uniform1f(this.light,1+s.release*.15+Math.sin(time*.75)*.025);for(const m of this.meshes)this.drawMesh(m);
   gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);gl.uniform1f(this.light,1+s.release*.20);
   if(options.chains!==false)for(const m of this.chains)if(!m.spec.behind)this.drawMesh(m);
   ctx.save();this.background(ctx,w,h,a,s);ctx.globalAlpha=s.visible;ctx.drawImage(this.canvas,0,0,w,h);ctx.globalAlpha=1;this.core(ctx,a,s);this.particles(ctx,a,time);ctx.restore();
   this.lastArt=a;this.lastSample=s;this.drawCount++;return true;
  }
  release(){const gl=this.gl;if(gl&&!this.lost){for(const m of [...this.meshes,...this.chains]){gl.deleteBuffer(m.buffer);gl.deleteBuffer(m.indices);}this.textures.forEach(t=>gl.deleteTexture(t));if(this.program)gl.deleteProgram(this.program);}this.program=null;this.meshes=[];this.chains=[];this.textures=[];}
  dispose(){if(this.disposed)return;this.disposed=true;this.image.onload=this.chain.onload=this.image.onerror=this.chain.onerror=null;this.resolveReady?.(false);this.release();this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);this.gl=null;}
 }
 root.DarkDemonWingMotionRenderer=DarkDemonWingMotionRenderer;
})(globalThis);
