/* SS ocean art study. Isolated from certification state and production materials. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ANIMATION_RATE=3;
  const {vertex:sphereVertex,fragment:waterFragment}=root.OceanSurfaceShader;
  const scriptUrl=typeof document!=='undefined'?(document.currentScript?.src||document.baseURI):'';
  let localTexturePromise=null;
  function textureSource(override){
    if(override)return Promise.resolve(override);
    if(root.location?.protocol!=='file:')return Promise.resolve(new URL('../assets/ocean-surface-v1.webp',scriptUrl).href);
    // Local files have opaque origins in Chrome. A sibling image can display
    // in HTML but cannot be uploaded to WebGL. Embed the exact same WebP bytes
    // only for file://; normal websites retain the small, cacheable image URL.
    if(!localTexturePromise){
      localTexturePromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=new URL('../assets/ocean-surface-v1.local.js',scriptUrl).href;
        script.onload=()=>{
          script.remove();
          const source=root.OceanSurfaceLocalTexture;
          if(typeof source==='string'&&source.startsWith('data:image/webp;base64,'))resolve(source);
          else reject(new Error('Local ocean texture data is missing'));
        };
        script.onerror=()=>{script.remove();reject(new Error('Local ocean texture script could not load'));};
        document.head.append(script);
      }).catch(error=>{localTexturePromise=null;throw error;});
    }
    return localTexturePromise;
  }

  function meshSphere(cols=192,rows=128){
    const vertices=[],indices=[];
    for(let y=0;y<=rows;y++){
      const phi=y/rows*Math.PI;
      for(let x=0;x<=cols;x++){
        const a=x/cols*Math.PI*2;
        vertices.push(Math.sin(phi)*Math.cos(a),Math.cos(phi),Math.sin(phi)*Math.sin(a));
      }
    }
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const a=y*(cols+1)+x,b=a+cols+1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices)};
  }
  class WaterOceanStudy{
    constructor(canvas,{textureUrl}={}){
      this.canvas=canvas;this.error='';this.diagnostic='';this.gl=null;this.resources=[];this.drawCount=0;this.disposed=false;
      this.onLost=e=>{e.preventDefault();this.lost=true;this.error='水面特效暫時中斷，等待恢復。';};
      this.onRestored=()=>{this.lost=false;this.error='';this.init();};
      canvas.addEventListener('webglcontextlost',this.onLost);canvas.addEventListener('webglcontextrestored',this.onRestored);
      this.init();
      this.ready=textureSource(textureUrl).then(source=>new Promise(resolve=>{
        if(this.disposed){resolve(false);return;}
        this.image=new Image();
        this.image.onload=()=>{
          if(this.disposed){resolve(false);return;}
          try{this.textureReady=true;this.uploadTexture();resolve(true);}
          catch(error){this.textureReady=false;this.diagnostic=String(error);this.error='海面材質無法載入繪圖，請重新整理。';resolve(false);}
        };
        this.image.onerror=()=>{if(!this.disposed)this.error='海面材質載入失敗，請重新整理。';resolve(false);};
        this.image.src=source;
      })).catch(error=>{
        if(!this.disposed){this.diagnostic=String(error);this.error='本機海面素材無法載入，請確認 assets 資料夾完整後重新開啟。';}
        return false;
      });
    }
    static frameAt(time){
      return Object.freeze({time:Math.max(0,Number.isFinite(time)?time:0)});
    }
    init(){
      try{
        const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:true,preserveDrawingBuffer:true});
        if(!gl)throw new Error('WebGL unavailable');this.gl=gl;this.resources=[];
        this.waterProgram=this.program(sphereVertex,waterFragment);
        this.sphere=this.upload(meshSphere());
        this.spray=new root.OceanSpray(gl);
        this.texture=gl.createTexture();this.resources.push(['texture',this.texture]);
        gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([8,35,52,255]));
        if(this.textureReady)this.uploadTexture();
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
      }catch(e){this.diagnostic=String(e);this.error='這個裝置暫時無法顯示水之星球樣板。';}
    }
    uploadTexture(){
      if(!this.gl||this.lost||!this.textureReady)return;
      const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.image);
    }
    program(vertex,fragment){
      const gl=this.gl,program=gl.createProgram();this.resources.push(['program',program]);
      for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const err=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(err);}
        gl.attachShader(program,shader);gl.deleteShader(shader);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      const uniforms={};for(const n of ['uTime','uSurge','uAspect','uOcean','uTextureReady','uBreakers','uWaveScale','uSeaTexture','uFoamAmount'])uniforms[n]=gl.getUniformLocation(program,n);
      return {program,uniforms,position:gl.getAttribLocation(program,'aPosition')};
    }
    upload(data){
      const gl=this.gl,vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);this.resources.push(['buffer',vertices]);
      let indices=null;if(data.indices){indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);this.resources.push(['buffer',indices]);}
      return {vertices,indices,count:data.indices?.length??data.vertices.length/3};
    }
    resize(width,height,dpr=1){
      this.width=Math.max(1,width);this.height=Math.max(1,height);
      // The prototype retains fine foam at phone size with a bounded buffer.
      this.pixelRatio=Math.min(1.75,Math.max(1,dpr),880/Math.max(width,height));
      const w=Math.max(1,Math.round(width*this.pixelRatio)),h=Math.max(1,Math.round(height*this.pixelRatio));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    }
    bind(program,mesh,time,surge,breakers,{waveScale,seaTexture,foamAmount}){
      const gl=this.gl;gl.useProgram(program.program);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertices);
      gl.enableVertexAttribArray(program.position);gl.vertexAttribPointer(program.position,3,gl.FLOAT,false,0,0);
      const u=program.uniforms;gl.uniform1f(u.uTime,time);gl.uniform1f(u.uSurge,surge);
      gl.uniform1f(u.uBreakers,breakers);
      gl.uniform1f(u.uWaveScale,waveScale);gl.uniform1f(u.uSeaTexture,seaTexture);gl.uniform1f(u.uFoamAmount,foamAmount);
      gl.uniform1f(u.uAspect,this.canvas.width/this.canvas.height);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.uniform1i(u.uOcean,0);gl.uniform1f(u.uTextureReady,this.textureReady?1:0);
      if(mesh.indices){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
      else gl.drawArrays(gl.POINTS,0,mesh.count);
    }
    draw(time,{surge=1,breakers=1,spray=1,waveScale=1,seaTexture=1,foamAmount=1}={}){
      if(this.disposed||this.lost||this.error||!this.gl)return false;
      time=WaterOceanStudy.frameAt(time).time;surge=clamp(surge);
      // Speed up the whole ocean together without changing the host's reveal,
      // readout or pause clock. Foam must sample the same time as its wavefront.
      const animationTime=time*ANIMATION_RATE;
      const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);
      gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);
      this.bind(this.waterProgram,this.sphere,animationTime,surge,clamp(breakers),{
        waveScale:clamp(waveScale),seaTexture:clamp(seaTexture),foamAmount:clamp(foamAmount)});
      if(spray>0)this.spray.draw(animationTime,{surge,breakers:clamp(breakers),strength:clamp(spray)});
      else this.spray.count=0;
      this.time=time;this.drawCount++;return true;
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;const gl=this.gl;
      if(gl&&!this.lost){
        this.spray?.dispose();
        for(const[type,item]of this.resources){if(type==='buffer')gl.deleteBuffer(item);else if(type==='texture')gl.deleteTexture(item);else gl.deleteProgram(item);}
      }
      this.resources=[];this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
    }
  }
  root.WaterOceanStudy=WaterOceanStudy;
})(globalThis);
