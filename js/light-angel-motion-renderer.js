/* Textured, articulated single-pair art. The original approved PNG remains
 * intact. Padded meshes allow bloom to escape the outer feather silhouette. */
(function(root){
  'use strict';
  const meshVertex=`attribute vec2 aPosition;attribute vec2 aUv;varying vec2 vTex;
    uniform vec2 uResolution;void main(){vTex=aUv;gl_Position=vec4(aPosition.x/uResolution.x*2.-1.,1.-aPosition.y/uResolution.y*2.,0.,1.);}`;
  const meshFragment=`precision mediump float;varying vec2 vTex;uniform sampler2D uImage;
    uniform float uSide,uRadius,uGlow,uOpacity;
    vec4 tex(vec2 p){if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||(p.x-.5)*uSide<0.)return vec4(0.);return texture2D(uImage,p);}
    void main(){if(uGlow<.5){gl_FragColor=tex(vTex)*uOpacity;return;}
      vec2 d=vec2(uRadius,uRadius*1.5);float a=tex(vTex).a*.20;
      a+=(tex(vTex+vec2(d.x,0.)).a+tex(vTex-vec2(d.x,0.)).a+tex(vTex+vec2(0.,d.y)).a+tex(vTex-vec2(0.,d.y)).a)*.12;
      a+=(tex(vTex+d).a+tex(vTex-d).a+tex(vTex+vec2(d.x,-d.y)).a+tex(vTex+vec2(-d.x,d.y)).a)*.08;
      a*=uOpacity;gl_FragColor=vec4(vec3(1.,.97,.83)*a,a);}`;
  const growthVertex=`attribute vec2 aPosition;attribute vec2 aFrom;attribute vec2 aTo;
    varying vec2 vFrom,vTo;uniform vec2 uResolution;
    void main(){vFrom=aFrom;vTo=aTo;gl_Position=vec4(aPosition.x/uResolution.x*2.-1.,1.-aPosition.y/uResolution.y*2.,0.,1.);}`;
  const growthFragment=`precision mediump float;varying vec2 vFrom,vTo;
    uniform sampler2D uFrom,uTo;uniform float uMix,uSide,uRadius,uGlow,uOpacity;
    vec4 safeTex(sampler2D tex,vec2 p){if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||(p.x-.5)*uSide<0.)return vec4(0.);return texture2D(tex,p);}
    vec4 read(vec2 d){return mix(safeTex(uFrom,vFrom+d),safeTex(uTo,vTo+d),uMix);}
    void main(){if(uGlow<.5){gl_FragColor=read(vec2(0.))*uOpacity;return;}
      vec2 d=vec2(uRadius,uRadius*1.5);float a=read(vec2(0.)).a*.20;
      a+=(read(vec2(d.x,0.)).a+read(vec2(-d.x,0.)).a+read(vec2(0.,d.y)).a+read(vec2(0.,-d.y)).a)*.12;
      a+=(read(d).a+read(-d).a+read(vec2(d.x,-d.y)).a+read(vec2(-d.x,d.y)).a)*.08;
      a*=uOpacity;gl_FragColor=vec4(vec3(1.,.97,.83)*a,a);}`;
  const mix=(a,b,t)=>a+(b-a)*t;
  const RANKS=['A','S','SS'];
  const dustVertex=`attribute vec4 aDust;attribute float aSoftness;uniform vec2 uResolution;
    uniform float uPixelScale,uPointMax;varying float vAlpha,vSoftness;
    void main(){gl_Position=vec4(aDust.x/uResolution.x*2.-1.,1.-aDust.y/uResolution.y*2.,0.,1.);
      gl_PointSize=min(uPointMax,max(2.,aDust.z*6.*uPixelScale));vAlpha=aDust.w;vSoftness=aSoftness;}`;
  const dustFragment=`precision mediump float;varying float vAlpha,vSoftness;
    void main(){float d=length(gl_PointCoord*2.-1.);
      float halo=exp(-d*d*6.)*.23;
      float core=1.-smoothstep(.10,mix(.28,.65,vSoftness),d);
      float a=(core*.92+halo)*(1.-smoothstep(.78,1.,d))*vAlpha;
      gl_FragColor=vec4(vec3(.97,.985,1.)*a,a);}`;
  class LightAngelMotionRenderer {
    constructor(){
      this.canvas=document.createElement('canvas');this.patch=document.createElement('canvas');this.patchCtx=this.patch.getContext('2d');
      this.gl=null;this.program=null;this.meshProgram=null;this.dustProgram=null;this.dustBuffer=null;this.texture=null;this.textures={};this.quad=null;this.meshes=[];
      this.dustVertices=new Float32Array(96*5);
      this.growthProgram=null;this.growthMeshes=[];this.outlines={};
      this.error='';this.diagnostic='';this.lost=false;this.disposed=false;this.loaded=false;this.drawCount=0;this.lastTime=-Infinity;this.lastKey='';
      this.onLost=e=>{e.preventDefault();this.lost=true;};
      this.onRestored=()=>{if(this.disposed)return;this.lost=false;this.gl=null;this.program=null;this.meshProgram=null;this.dustProgram=null;this.dustBuffer=null;this.texture=null;this.textures={};this.quad=null;this.meshes=[];this.growthProgram=null;this.growthMeshes=[];this.lastTime=-Infinity;this.error='';this.init();};
      this.canvas.addEventListener('webglcontextlost',this.onLost);this.canvas.addEventListener('webglcontextrestored',this.onRestored);
      // data URI avoids file-origin WebGL security errors when opened locally.
      const sources={SS:root.LightAngelWingAsset||new URL('../assets/light-angel-wings-v1.png',document.currentScript?.src||location.href).href};
      for(const rank of ['A','S'])if(root.LightAngelWingRankAssets?.[rank])sources[rank]=root.LightAngelWingRankAssets[rank];
      this.images={};this.activeAssetRank='SS';
      this.ready=new Promise(resolve=>{this.resolveReady=resolve;let remaining=Object.keys(sources).length;
        for(const [rank,src] of Object.entries(sources)){
          const image=this.images[rank]=new Image();if(rank==='SS')this.image=image;
          image.onload=()=>{if(this.disposed){resolve(false);return;}if(--remaining===0&&!this.error){this.loaded=true;resolve(true);}};
          image.onerror=()=>{if(this.disposed)return;this.error=rank+' 級羽翼素材載入失敗，請重新整理。';resolve(false);};
          image.src=src;
        }
      });
    }
    makeProgram(vertex,fragment){
      const gl=this.gl,program=gl.createProgram(),shaders=[];
      try{for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
      }gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program;
      }catch(e){gl.deleteProgram(program);throw e;}finally{shaders.forEach(s=>gl.deleteShader(s));}
    }
    init(){
      if(this.disposed||this.lost||!this.loaded)return false;if(this.program)return true;
      try{
        const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl)throw Error('WebGL unavailable');
        this.maxAttributes=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        this.program=this.makeProgram(root.LightHolyShader.vertex,root.LightHolyShader.fragment);
        this.meshProgram=this.makeProgram(meshVertex,meshFragment);
        this.dustProgram=this.makeProgram(dustVertex,dustFragment);
        this.dustPosition=gl.getAttribLocation(this.dustProgram,'aDust');this.dustSoftness=gl.getAttribLocation(this.dustProgram,'aSoftness');
        this.dustUniforms={};for(const name of ['uResolution','uPixelScale','uPointMax'])this.dustUniforms[name]=gl.getUniformLocation(this.dustProgram,name);
        this.pointMax=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
        this.dustBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.dustBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.dustVertices,gl.DYNAMIC_DRAW);
        this.bgPosition=gl.getAttribLocation(this.program,'aPosition');this.bgUniforms={};
        for(const name of ['uResolution','uArt','uTime','uCore','uWings','uCrown','uAwaken','uPulse','uGodRays','uRayMotion','uRayBurst'])this.bgUniforms[name]=gl.getUniformLocation(this.program,name);
        this.meshPosition=gl.getAttribLocation(this.meshProgram,'aPosition');this.meshUv=gl.getAttribLocation(this.meshProgram,'aUv');this.meshUniforms={};
        for(const name of ['uResolution','uImage','uSide','uRadius','uGlow','uOpacity'])this.meshUniforms[name]=gl.getUniformLocation(this.meshProgram,name);
        this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
        for(const [rank,image] of Object.entries(this.images)){
          const texture=this.textures[rank]=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        }
        this.texture=this.textures.SS;
        for(const side of [-1,1]){
          const columns=36,rows=30,vertices=new Float32Array((columns+1)*(rows+1)*4),indices=[];
          for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
            const i=(y*(columns+1)+x)*4,u=side<0?-.065+x/columns*.565:.5+x/columns*.565;
            vertices[i+2]=u;vertices[i+3]=-.08+y/rows*1.16;
            if(x<columns&&y<rows){const a=y*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
          }
          const mesh={side,vertices,indexCount:indices.length,buffer:gl.createBuffer(),indices:gl.createBuffer()};this.meshes.push(mesh);
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
        }
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);return true;
      }catch(e){this.error='目前無法顯示羽翼動畫，請重新整理。';this.diagnostic=String(e);this.release();return false;}
    }
    layout(w,h,box){
      const b=box||{x:4,y:52,width:w-8,height:h*.50};
      // Reserve room for the release overshoot so the long tips remain soft.
      const artHeight=Math.min(b.height*.87,b.width/1.5*.87),artWidth=artHeight*1.5;
      return {cx:b.x+b.width*.5,cy:b.y+(b.height-artHeight)*.5+artHeight*.72,width:artWidth,height:artHeight,
        unit:Math.max(1,Math.min(b.width*.385,b.height*.38,320)),bottom:b.y+b.height*.98};
    }
    paintMesh(mesh,art,time,rank='SS'){
      const gl=this.gl;
      // The juvenile artwork has shorter wings and a higher root in its image.
      // Align that root with the same magical core; keep the asset's own size.
      const pivot=this.activeAssetRank==='A'?.62:.72,offset=.72-pivot;
      for(let i=0;i<mesh.vertices.length;i+=4){const p=root.LightAngelMotion.point(mesh.vertices[i+2],mesh.vertices[i+3]+offset,time,mesh.side,rank);mesh.vertices[i]=art.cx+p.x*art.width;mesh.vertices[i+1]=art.cy+p.y*art.width;}
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.vertices);
    }
    drawMesh(mesh,radius,glow,opacity){
      const gl=this.gl,u=this.meshUniforms;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
      gl.enableVertexAttribArray(this.meshPosition);gl.vertexAttribPointer(this.meshPosition,2,gl.FLOAT,false,16,0);
      gl.enableVertexAttribArray(this.meshUv);gl.vertexAttribPointer(this.meshUv,2,gl.FLOAT,false,16,8);
      gl.uniform1f(u.uSide,mesh.side);gl.uniform1f(u.uRadius,radius);gl.uniform1f(u.uGlow,glow);gl.uniform1f(u.uOpacity,opacity);
      gl.drawElements(gl.TRIANGLES,mesh.indexCount,gl.UNSIGNED_SHORT,0);
    }
    outline(rank,side){
      const key=rank+':'+side;if(this.outlines[key])return this.outlines[key];
      const image=this.images[rank]||this.image,c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const {width:w,height:h}=c,data=ctx.getImageData(0,0,w,h).data,center=w/2;
      // Follow each image's feather envelope. The grid attaches at the same
      // root, so new flight feathers extend along the existing wing surface.
      const cols=[];let reach=0;
      for(let distance=0;distance<center;distance++){
        const x=Math.max(0,Math.min(w-1,Math.floor(center+side*distance)));
        let top=h,bottom=-1;for(let y=0;y<h;y++)if(data[(y*w+x)*4+3]>24){top=Math.min(top,y);bottom=y;}
        if(bottom>=top){reach=distance;cols[distance]={top:Math.max(0,top-24)/h,bottom:Math.min(h,bottom+24)/h};}
      }
      reach=Math.min(center-1,reach+24);
      // Empty root/tip columns inherit the nearest outline, while transparent
      // source pixels keep their gap and soft tips intact.
      for(let i=0;i<=reach;i++)if(!cols[i]){
        let nearest=1;while(!cols[i-nearest]&&!cols[i+nearest]&&nearest<w)nearest++;
        cols[i]=cols[i-nearest]||cols[i+nearest]||{top:.5,bottom:.8};
      }
      return this.outlines[key]={reach:reach/w,cols,width:w,pivot:rank==='A'?.62:.72};
    }
    initGrowth(){
      if(this.growthProgram)return;
      // Prepare every shape before the first visible growth, so crossing S
      // does not introduce an image-read stall during the animation.
      for(const rank of RANKS)for(const side of [-1,1])this.outline(rank,side);
      const gl=this.gl;this.growthProgram=this.makeProgram(growthVertex,growthFragment);
      this.growthAttributes={};for(const name of ['aPosition','aFrom','aTo'])this.growthAttributes[name]=gl.getAttribLocation(this.growthProgram,name);
      this.growthUniforms={};for(const name of ['uResolution','uFrom','uTo','uMix','uSide','uRadius','uGlow','uOpacity'])this.growthUniforms[name]=gl.getUniformLocation(this.growthProgram,name);
      for(const side of [-1,1]){
        const columns=56,rows=36,vertices=new Float32Array((columns+1)*(rows+1)*6),indices=[];
        for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
        const mesh={side,columns,rows,vertices,indexCount:indices.length,buffer:gl.createBuffer(),indices:gl.createBuffer()};
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);this.growthMeshes.push(mesh);
      }
    }
    paintGrowingWings(art,s,state,profile){
      this.initGrowth();const gl=this.gl,u=this.growthUniforms,a=this.growthAttributes;
      const uv=(outline,side,x,y)=>{
        const d=x*outline.reach*outline.width,lo=Math.floor(d),hi=Math.min(outline.cols.length-1,lo+1),f=d-lo;
        const c=outline.cols[lo],n=outline.cols[hi];return {u:.5+side*x*outline.reach,v:mix(mix(c.top,n.top,f),mix(c.bottom,n.bottom,f),y)};
      };
      for(const mesh of this.growthMeshes){
        const from=this.outline(state.from,mesh.side),to=this.outline(state.to,mesh.side);
        for(let y=0;y<=mesh.rows;y++)for(let x=0;x<=mesh.columns;x++){
          const i=(y*(mesh.columns+1)+x)*6,one=uv(from,mesh.side,x/mesh.columns,y/mesh.rows),two=uv(to,mesh.side,x/mesh.columns,y/mesh.rows);
          // Both textures share a growing feather grid, instead of fading
          // two differently sized silhouettes over each other.
          const u= mix(one.u,two.u,state.mix),v=mix(one.v+.72-from.pivot,two.v+.72-to.pivot,state.mix);
          const p=root.LightAngelMotion.point(u,v,s.time,mesh.side,state.from),q=root.LightAngelMotion.point(u,v,s.time,mesh.side,state.to);
          mesh.vertices.set([art.cx+mix(p.x,q.x,state.mix)*art.width,art.cy+mix(p.y,q.y,state.mix)*art.width,one.u,one.v,two.u,two.v],i);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.DYNAMIC_DRAW);
      }
      gl.useProgram(this.growthProgram);gl.uniform2f(u.uResolution,this.logicalWidth,this.logicalHeight);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[state.from]||this.textures.SS);gl.uniform1i(u.uFrom,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[state.to]||this.textures.SS);gl.uniform1i(u.uTo,1);
      gl.uniform1f(u.uMix,state.mix);gl.enable(gl.BLEND);
      for(const [radius,glow,opacity,mode] of [[.020+s.burst*.006,1,s.visible*(.35+s.burst*.12)*profile.glow,gl.ONE_MINUS_SRC_COLOR],[0,0,s.visible,gl.ONE_MINUS_SRC_ALPHA],[.004,1,s.visible*.12*profile.glow,gl.ONE_MINUS_SRC_COLOR]]){
        gl.blendFunc(gl.ONE,mode);gl.uniform1f(u.uRadius,radius);gl.uniform1f(u.uGlow,glow);gl.uniform1f(u.uOpacity,opacity);
        for(const mesh of this.growthMeshes){
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
          for(const [name,offset] of [['aPosition',0],['aFrom',8],['aTo',16]]){gl.enableVertexAttribArray(a[name]);gl.vertexAttribPointer(a[name],2,gl.FLOAT,false,24,offset);}
          gl.uniform1f(u.uSide,mesh.side);gl.drawElements(gl.TRIANGLES,mesh.indexCount,gl.UNSIGNED_SHORT,0);
        }
      }
      gl.activeTexture(gl.TEXTURE0);
    }
    paintCore(ctx,art,s){
      ctx.save();ctx.translate(art.cx,art.cy);const width=art.width;
      const glow=(radius,stops,alpha)=>{const g=ctx.createRadialGradient(0,0,0,0,0,radius);for(const [at,color] of stops)g.addColorStop(at,color);
        ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();};
      glow(width*(.32+s.burst*.19+s.glint*.035),[[0,'#fffdebb0'],[.2,'#fff5c36b'],[.5,'#ffe9a332'],[1,'#fff7db00']],s.core*(.70+s.burst*.28));
      glow(width*(.15-s.charge*.025+s.burst*.09)*s.coreGlare,[[0,'#ffffffff'],[.15,'#fffef3ff'],[.28,'#fffbe3d0'],[.5,'#fff1bd61'],[1,'#fff0c200']],s.core*(.88+s.charge*.08+s.burst*.04));
      // Irregular optical spikes remain alive between releases. Each one
      // varies separately; the fan neither rotates nor turns on/off together.
      for(let i=0;i<12;i++){
        const opening=root.LightAngelMotion.noise(s.time*(.75+i*.061)+i*17.31);
        const reach=width*(.105+opening*.18)*(1+s.burst*.25);
        const half=width*(.0012+opening*.0022),start=width*.012;
        ctx.save();ctx.rotate(i*Math.PI/6+(root.LightAngelMotion.noise(i*7.3)-.5)*.22);
        const ray=ctx.createLinearGradient(0,0,0,-reach);
        ray.addColorStop(0,'#ffffff');ray.addColorStop(.25,'#fffef5eb');ray.addColorStop(.65,'#fff7d273');ray.addColorStop(1,'#fff6d000');
        ctx.globalAlpha=Math.min(1,s.core*(.35+opening*.65)*(1+s.burst*.15));ctx.fillStyle=ray;
        ctx.beginPath();ctx.moveTo(-half,start);ctx.quadraticCurveTo(-half*.35,-reach*.36,0,-reach);
        ctx.quadraticCurveTo(half*.35,-reach*.36,half,start);ctx.closePath();ctx.fill();ctx.restore();
      }
      glow(width*(.066+s.glint*.020+s.charge*.008+s.burst*.031),[[0,'#ffffff'],[.28,'#fffff8'],[.7,'#fffde590'],[1,'#fff8ce00']],s.core);
      ctx.restore();
    }
    paintAmbient(art,s,w,h,pixelScale){
      const gl=this.gl,particles=root.LightAngelMotion.ambientParticles(s.time,s.rankBlend?'SS':s.rank),u=this.dustUniforms;
      const density=s.rankBlend?mix(root.LightAngelMotion.profile(s.rankBlend.from).ambientCount,root.LightAngelMotion.profile(s.rankBlend.to).ambientCount,s.rankBlend.mix):particles.length;
      let count=0;
      for(const p of particles){
        const y=art.cy+p.y*art.width,fade=Math.max(0,Math.min(1,(art.bottom+art.unit*.14-y)/(art.unit*.30)));
        const i=count++*5;this.dustVertices[i]=art.cx+p.x*art.width;this.dustVertices[i+1]=y;
        this.dustVertices[i+2]=p.size*art.width;this.dustVertices[i+3]=p.alpha*fade*Math.max(0,Math.min(1,density-p.id));this.dustVertices[i+4]=p.softness;
      }
      gl.useProgram(this.dustProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.dustBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.dustVertices);
      gl.enableVertexAttribArray(this.dustPosition);gl.vertexAttribPointer(this.dustPosition,4,gl.FLOAT,false,20,0);
      gl.enableVertexAttribArray(this.dustSoftness);gl.vertexAttribPointer(this.dustSoftness,1,gl.FLOAT,false,20,16);
      gl.uniform2f(u.uResolution,w,h);gl.uniform1f(u.uPixelScale,pixelScale);gl.uniform1f(u.uPointMax,this.pointMax);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,count);gl.disable(gl.BLEND);
    }
    paintParticles(ctx,art,s){
      const colors=['#fffdf1','#d5f3ff','#fff0bd'];
      ctx.save();
      const b=s.rankBlend,particles=b?[
        ...root.LightAngelMotion.particles(s.time,b.from).map(p=>({...p,alpha:p.alpha*(1-b.mix)})),
        ...root.LightAngelMotion.particles(s.time,b.to).map(p=>({...p,alpha:p.alpha*b.mix}))
      ]:root.LightAngelMotion.particles(s.time,s.rank);
      for(const p of particles){
        const size=art.width*p.size,y=art.cy+p.y*art.width;
        const alpha=p.alpha*Math.max(0,Math.min(1,(art.bottom+art.unit*.12-y)/(art.unit*.25)));
        ctx.save();ctx.translate(art.cx+p.x*art.width,y);ctx.rotate(p.rotation);
        // Soft radiant surround with a crisp pearl centre; no hard white dots
        // lining a circle, and no equal-speed ring of confetti.
        const halo=ctx.createRadialGradient(0,0,0,0,0,size*3.2);
        halo.addColorStop(0,'#fff7dba0');halo.addColorStop(.2,'#fff4cb55');halo.addColorStop(1,'#fff1bd00');
        ctx.globalAlpha=alpha*.75;ctx.fillStyle=halo;ctx.fillRect(-size*3.2,-size*3.2,size*6.4,size*6.4);
        ctx.globalAlpha=alpha;ctx.fillStyle=colors[p.tint];ctx.beginPath();
        if(p.star){
          ctx.moveTo(0,-size);ctx.quadraticCurveTo(size*.12,-size*.12,size,0);
          ctx.quadraticCurveTo(size*.12,size*.12,0,size);ctx.quadraticCurveTo(-size*.12,size*.12,-size,0);
          ctx.quadraticCurveTo(-size*.12,-size*.12,0,-size);
        }else ctx.arc(0,0,size,0,Math.PI*2);
        ctx.fill();ctx.restore();
      }
      ctx.restore();
    }
    sparkleFrames(w,h,art,s){
      const shared=root.FireRankSparkles,hash=root.LightAngelMotion.noise;
      // Keep the fire glint's one-second lifetime independent of wing speed.
      return shared.samples({time:s.starTime??s.time,mana:s.starMana??shared.manaForRank(s.rank||'SS'),referenceWidth:shared.referenceWidth(w,h)}).map(p=>{
        const direction=p.id*2.39996323+(hash(p.seed+41)-.5)*.36;
        const dx=Math.cos(direction),dy=Math.sin(direction)*.85;
        const left=p.glow+2,right=w-p.glow-2,top=p.glow+2,bottom=Math.min(h-p.glow-2,art.bottom-p.glow-5);
        const limitX=dx>0?(right-art.cx)/dx:dx<0?(left-art.cx)/dx:Infinity;
        const limitY=dy>0?(bottom-art.cy)/dy:dy<0?(top-art.cy)/dy:Infinity;
        // Reserve the full route using peak size, keeping the one-second
        // fire glint envelope intact without clipping or piling up at edges.
        const reach=Math.max(0,Math.min(art.width*(.32+hash(p.seed+53)*.34),limitX,limitY));
        const travel=1-Math.pow(1-p.age/p.lifetime,1.55);
        return {...p,x:art.cx+dx*reach*travel,y:art.cy+dy*reach*travel,
          color:['#fff1bf','#ffd183','#fff9e9'][p.id%3]};
      });
    }
    paintForegroundStars(ctx,w,h,art,s){
      root.FireRankSparkles.drawFrames(ctx,this.sparkleFrames(w,h,art,s),s.visible);
    }
    draw(ctx,w,h,{time=0,box,opacity=1,rank='SS',growth,motionTime,starMana}={}){
      if(this.disposed||this.lost||!this.loaded||w<=0||h<=0||!Number.isFinite(w+h)||!this.init())return false;
      let profile=root.LightAngelMotion.profile(rank);
      let s={...root.LightAngelMotion.sample(time*profile.speed,profile.rank),starTime:time};
      this.growthState=null;
      if(Number.isFinite(growth)){
        const g=Math.max(0,Math.min(2,growth)),i=g<1?0:1,b={growth:g,from:RANKS[i],to:RANKS[i+1],mix:g-i};
        this.growthState=b;
        const from=root.LightAngelMotion.profile(b.from),to=root.LightAngelMotion.profile(b.to);
        profile={...from};for(const key of Object.keys(from))if(typeof from[key]==='number')profile[key]=mix(from[key],to[key],b.mix);
        profile.rank=b.mix===1?b.to:b.from;
        const clock=Number.isFinite(motionTime)?motionTime:time*.7;
        const one=root.LightAngelMotion.sample(clock,b.from),two=root.LightAngelMotion.sample(clock,b.to);
        s={...one};for(const key of Object.keys(one))if(typeof one[key]==='number')s[key]=mix(one[key],two[key],b.mix);
        s.rank=profile.rank;
        s.rankBlend=b;s.starTime=time;s.starMana=starMana??(g<=1?950*g:950+49*(g-1));
      }
      this.activeAssetRank=this.textures[profile.rank]?profile.rank:'SS';
      this.texture=this.textures[this.activeAssetRank];
      const art=this.layout(w,h,box),scale=Math.min(root.devicePixelRatio||1,1.25,Math.sqrt(560000/(w*h)));
      this.logicalWidth=w;this.logicalHeight=h;
      const pw=Math.max(1,Math.round(w*scale)),ph=Math.max(1,Math.round(h*scale)),key=[profile.rank,Number.isFinite(growth),w,h,art.cx,art.cy,art.width,art.height,art.bottom,pw,ph].join(':');
      // A continuously changing growth value must not bypass the frame cap.
      // Paused inspection still redraws a changed pose at the same time.
      if(this.lastTime===-Infinity||s.time<this.lastTime||s.time-this.lastTime>=1/30-1e-6||key!==this.lastKey||(s.time===this.lastTime&&growth!==this.lastGrowth)){
        const gl=this.gl,u=this.bgUniforms;
        for(let i=0;i<this.maxAttributes;i++)gl.disableVertexAttribArray(i);
        if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;}
        gl.viewport(0,0,pw,ph);gl.disable(gl.BLEND);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
        gl.enableVertexAttribArray(this.bgPosition);gl.vertexAttribPointer(this.bgPosition,2,gl.FLOAT,false,0,0);
        // Disable a stale UV attribute before binding the small background quad.
        if(this.meshUv!==this.bgPosition)gl.disableVertexAttribArray(this.meshUv);
        gl.uniform2f(u.uResolution,w,h);gl.uniform4f(u.uArt,art.cx,art.cy,art.unit,art.bottom);
        for(const [name,value] of [['uTime',s.time],['uCore',0],['uWings',1],['uCrown',s.crown],['uAwaken',0],['uPulse',0],['uGodRays',s.rays],['uRayMotion',1],['uRayBurst',s.burst]])gl.uniform1f(u[name],value);
        gl.drawArrays(gl.TRIANGLES,0,6);
        this.paintAmbient(art,s,w,h,pw/w);
        if(this.growthState){
          try{this.paintGrowingWings(art,s,this.growthState,profile);}
          catch(error){this.error='目前無法顯示羽翼生長，請重新整理。';this.diagnostic=String(error);this.release();return false;}
        }
        else{
        for(const mesh of this.meshes)this.paintMesh(mesh,art,s.time,profile.rank);
        gl.useProgram(this.meshProgram);gl.uniform2f(this.meshUniforms.uResolution,w,h);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.meshUniforms.uImage,0);gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);for(const mesh of this.meshes)this.drawMesh(mesh,.020+s.burst*.006,1,s.visible*(.35+s.burst*.12)*profile.glow);
        gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);for(const mesh of this.meshes)this.drawMesh(mesh,0,0,s.visible);
        gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);for(const mesh of this.meshes)this.drawMesh(mesh,.004,1,s.visible*.12*profile.glow);
        }
        gl.disable(gl.BLEND);
        this.patchCtx.clearRect(0,0,pw,ph);this.patchCtx.drawImage(this.canvas,0,0);this.patchCtx.save();this.patchCtx.scale(pw/w,ph/h);this.paintParticles(this.patchCtx,art,s);this.paintCore(this.patchCtx,art,s);this.paintForegroundStars(this.patchCtx,w,h,art,s);this.patchCtx.restore();
        this.lastTime=s.time;this.lastKey=key;this.lastGrowth=growth;this.art=art;this.frame=s;this.drawCount++;
      }
      ctx.save();ctx.globalAlpha*=Math.max(0,Math.min(1,opacity));ctx.drawImage(this.patch,0,0,w,h);ctx.restore();return true;
    }
    release(){
      const gl=this.gl;if(gl&&!this.lost){for(const mesh of this.meshes){gl.deleteBuffer(mesh.buffer);gl.deleteBuffer(mesh.indices);}
        for(const mesh of this.growthMeshes){gl.deleteBuffer(mesh.buffer);gl.deleteBuffer(mesh.indices);}if(this.growthProgram)gl.deleteProgram(this.growthProgram);
        for(const texture of Object.values(this.textures))gl.deleteTexture(texture);if(this.quad)gl.deleteBuffer(this.quad);if(this.dustBuffer)gl.deleteBuffer(this.dustBuffer);if(this.program)gl.deleteProgram(this.program);if(this.meshProgram)gl.deleteProgram(this.meshProgram);if(this.dustProgram)gl.deleteProgram(this.dustProgram);}
      this.gl=null;this.program=null;this.meshProgram=null;this.dustProgram=null;this.dustBuffer=null;this.texture=null;this.textures={};this.quad=null;this.meshes=[];
      this.growthProgram=null;this.growthMeshes=[];
    }
    dispose(){if(this.disposed)return;this.disposed=true;this.resolveReady?.(false);for(const image of Object.values(this.images))image.onload=image.onerror=null;
      this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);this.release();this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;}
  }
  root.LightAngelMotionRenderer=LightAngelMotionRenderer;
})(globalThis);
