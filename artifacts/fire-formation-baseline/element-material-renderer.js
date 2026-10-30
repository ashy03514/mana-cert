/* Shared real-time material renderer: preview and later reveals use these same programs. */
(function(root){
  'use strict';
  const names=Object.freeze({fire:'火',water:'水',wind:'風',earth:'土',light:'光',dark:'暗'});
  const vertex=`
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
  `;
  const common=`
    precision highp float;
    uniform float uTime,uPhase,uOpacity,uFormation;
    uniform vec2 uResolution;
    uniform sampler2D uBackdrop;
    varying vec2 vUv;
    float sq(float v){return v*v;}
    float hash(float n){return fract(sin(n*127.1)*43758.5453);}
    float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
        mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float value=0.,weight=.5333333;
      for(int i=0;i<4;i++){value+=weight*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+13.17;weight*=.5;}
      return value;
    }
    vec3 backdrop(vec2 uv){return texture2D(uBackdrop,clamp(uv,vec2(.001),vec2(.999))).rgb;}
  `;
  const finish=`
    void main(){
      vec2 p=(vUv-.5)*vec2(2.,2.*uResolution.y/uResolution.x);
      vec4 color=material(p,uTime);
      float emergence=FORMATION_MASK;
      emergence=mix(emergence,1.,smoothstep(.82,1.,uFormation));
      float edge=smoothstep(0.,.075,vUv.x)*smoothstep(0.,.075,1.-vUv.x)
        *smoothstep(0.,.055,vUv.y)*smoothstep(0.,.055,1.-vUv.y);
      gl_FragColor=vec4(clamp(color.rgb,0.,1.),clamp(color.a,0.,1.)*uOpacity*edge*emergence);
    }
  `;
  class ElementMaterialRenderer {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.patchCtx=this.patch.getContext('2d');
      this.programs=new Map();this.element='fire';this.time=0;this.duration=6.4;
      this.paused=false;this.lost=false;this.error='';this.gl=null;this.lastRender=-Infinity;this.renders=0;
      this.canvas.addEventListener?.('webglcontextlost',e=>{
        e.preventDefault();this.lost=true;this.error='特效暫時中斷，正在等待恢復。';
      });
      this.canvas.addEventListener?.('webglcontextrestored',()=>{
        this.gl=null;this.programs.clear();this.lost=false;this.error='';this.lastRender=-Infinity;
      });
    }
    static get names(){return names;}
    static fragment(key){
      const source=root.ElementMaterialSources?.[key];
      if(!source)throw new Error('Missing element material: '+key);
      // The isolated studies use formation=1. Flow previews grow the actual
      // material from the gathering point without replacing its shader.
      const masks={
        fire:'1.-smoothstep(mix(-.76,1.28,uFormation)-.10,mix(-.76,1.28,uFormation)+.10,p.y)',
        water:'1.-smoothstep(uFormation*.64-.04,uFormation*.64+.06,length(p))',
        wind:'1.-smoothstep(uFormation*1.4-.12,uFormation*1.4+.12,length(p/vec2(.5,.75)))',
        earth:'1.',
        light:'1.-smoothstep(mix(-.40,1.15,uFormation)-.12,mix(-.40,1.15,uFormation)+.12,p.y)',
        dark:'1.-smoothstep(uFormation*.85-.08,uFormation*.85+.08,length(p))'
      };
      return common+source+finish.replace('FORMATION_MASK',masks[key]||'1.');
    }
    init(){
      if(this.lost)return false;
      if(this.gl)return true;
      try{
        const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl||typeof gl.createShader!=='function')throw new Error('WebGL unavailable');
        this.gl=gl;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
        return true;
      }catch(error){this.error='此裝置目前無法顯示屬性特效，請返回設定後重試。';this.diagnostic=String(error);return false;}
    }
    compile(key){
      if(this.programs.has(key))return this.programs.get(key);
      const gl=this.gl,shaders=[];let program=null;
      try{
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,ElementMaterialRenderer.fragment(key)]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
        }
        program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
        const record={program,position:gl.getAttribLocation(program,'aPosition'),uniforms:{}};
        for(const name of ['uTime','uPhase','uOpacity','uFormation','uResolution','uBackdrop'])record.uniforms[name]=gl.getUniformLocation(program,name);
        this.programs.set(key,record);return record;
      }catch(error){
        if(program)gl.deleteProgram(program);
        this.diagnostic=String(error);this.error='這個屬性暫時無法顯示，請切換其他屬性或重新開啟。';return null;
      }finally{shaders.forEach(s=>gl.deleteShader(s));}
    }
    select(key){if(!Object.hasOwn(names,key))return false;this.element=key;this.restart();return true;}
    restart(){this.time=0;this.paused=false;this.error=this.lost?'特效暫時中斷，正在等待恢復。':'';this.lastRender=-Infinity;}
    step(seconds){
      if(this.paused||this.lost||!Number.isFinite(seconds)||seconds<=0)return;
      this.time+=Math.min(.05,seconds);
    }
    get phase(){return (this.time%this.duration)/this.duration;}
    get opacity(){
      const s=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
      const elapsed=this.time%this.duration;
      return s(elapsed/.9)*(1-s((elapsed-(this.duration-.9))/.9));
    }
    layout(width,height){
      const h=Math.max(100,Math.min(width*1.27,height-250,660)),w=h/1.35;
      return {x:(width-w)/2,y:Math.max(76,(height-110)/2-h/2),width:w,height:h};
    }
    draw(ctx,background,width,height,frame=null){
      if(this.error)return false;
      if(!this.init())return false;
      const box=this.layout(width,height),gl=this.gl;
      const pw=Math.max(1,Math.min(480,Math.round(box.width*1.5))),ph=Math.round(pw*1.35);
      const resized=this.canvas.width!==pw||this.canvas.height!==ph;
      if(resized){this.canvas.width=pw;this.canvas.height=ph;this.patch.width=pw;this.patch.height=ph;this.lastRender=-Infinity;}
      const shader=this.compile(this.element);if(!shader)return false;
      const time=frame?.time??this.time,phase=frame?.phase??this.phase,opacity=frame?.opacity??this.opacity;
      // At most 30 new material frames/second. Pausing keeps the exact rendered frame.
      if(resized||time<this.lastRender||time-this.lastRender>=1/30-1e-6||!Number.isFinite(this.lastRender)){
        const scaleX=background.width/width,scaleY=background.height/height;
        this.patchCtx.clearRect(0,0,pw,ph);
        this.patchCtx.drawImage(background,box.x*scaleX,box.y*scaleY,box.width*scaleX,box.height*scaleY,0,0,pw,ph);
        gl.viewport(0,0,pw,ph);gl.useProgram(shader.program);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(shader.position);
        gl.vertexAttribPointer(shader.position,2,gl.FLOAT,false,0,0);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.patch);
        const u=shader.uniforms;
        gl.uniform1i(u.uBackdrop,0);gl.uniform2f(u.uResolution,pw,ph);
        gl.uniform1f(u.uTime,time);gl.uniform1f(u.uPhase,phase);gl.uniform1f(u.uOpacity,opacity);
        gl.uniform1f(u.uFormation,frame?.formation??1);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
        // Retain the frame on a 2D layer: WebGL drawing buffers may clear after compositing.
        this.patchCtx.clearRect(0,0,pw,ph);this.patchCtx.drawImage(this.canvas,0,0);
        this.lastRender=time;this.renders++;
      }
      ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.drawImage(this.patch,box.x,box.y,box.width,box.height);ctx.restore();return true;
    }
    dispose(){
      if(this.gl&&!this.lost){for(const s of this.programs.values())this.gl.deleteProgram(s.program);this.gl.deleteBuffer(this.buffer);this.gl.deleteTexture(this.texture);}
      this.programs.clear();this.gl=null;this.lastRender=-Infinity;
    }
  }
  root.ElementMaterialRenderer=ElementMaterialRenderer;
})(globalThis);
