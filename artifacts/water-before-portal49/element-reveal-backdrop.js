/* Attribute atmosphere only. Uses the material clock; owns no timer or outcome. */
(function(root){
  'use strict';
  const PERIOD=2,TRAVEL=1.65;
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const vertex='attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
  const fragment=`
    precision highp float;
    varying vec2 vUv;
    uniform float uTime,uAspect,uFront,uPulse,uStrength;
    uniform vec4 uFocus;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.57;for(int i=0;i<3;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+9.7;a*=.5;}return v;}
    void main(){
      vec2 p=vec2(vUv.x,vUv.y*uAspect);
      vec2 distance=(p-uFocus.xy)/uFocus.zw;
      float clear=1.-smoothstep(.30,1.35,length(distance));
      // Warm perimeter, near-black centre: the material supplies the brightest
      // yellows. No white or yellow background can swallow its hot filaments.
      vec3 color=mix(vec3(.19,.058,.036),vec3(.070,.026,.042),vUv.y);
      float side=pow(abs(vUv.x-.5)*2.,1.5);
      color+=vec3(.085,.022,.006)*side*(.35+.65*(1.-vUv.y));
      color=mix(color,vec3(.025,.014,.021),clear*.94);
      color*=mix(.55,1.,min(uStrength,1.));
      // A connected, irregular front rolls all the way across the viewport.
      // Density is advected upward behind the tips instead of stroking a line.
      float eddy=fbm(vec2(p.x*5.2,uTime*.77));
      float crest=uFront*uAspect+(eddy-.48)*.42
        +sin(p.x*19.-uTime*2.6)*.035;
      float behind=crest-p.y;
      vec2 flow=vec2(p.x*7.2,p.y*5.3-uTime*3.2);
      float folds=fbm(flow+vec2(eddy*1.8,0.));
      float filaments=noise(flow*2.7+vec2(0.,-uTime*.9));
      float tongue=(folds-.46)*.22+sin(p.x*33.+uTime*2.0)*.018;
      float depth=behind+tongue;
      float veil=exp(-pow((depth-.07)/.19,2.))*(.24+.76*folds);
      float body=smoothstep(-.025,.065,depth)*(1.-smoothstep(.12,.39,depth));
      body*=smoothstep(.22,.72,folds+filaments*.22);
      float hot=pow(body,1.6)*(.4+.6*filaments);
      float shelter=1.-clear*.94;
      vec3 energy=vec3(.23,.035,.008)*veil+vec3(.38,.095,.018)*body+vec3(.19,.075,.018)*hot;
      color+=energy*uPulse*shelter;
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }
  `;
  class ElementRevealBackdrop {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.ctx=this.patch.getContext('2d');
      this.gl=null;this.failed=false;this.lost=false;this.lastKey='';this.lastTime=-Infinity;
      this.canvas.addEventListener?.('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
      this.canvas.addEventListener?.('webglcontextrestored',()=>{this.gl=null;this.failed=false;this.lost=false;this.lastKey='';});
    }
    static sample(time,width,height){
      time=Number.isFinite(time)?Math.max(0,time):0;
      const cycle=Math.floor(time/PERIOD),age=time-cycle*PERIOD;
      const front=-.24+1.48*smooth(age/TRAVEL);
      return {cycle,phase:age/PERIOD,front,y:height*(1-front),
        alpha:smooth(age/.16)*(1-smooth((age-1.45)/.20))};
    }
    init(){
      if(this.lost||this.failed)return false;if(this.gl)return true;
      let gl,program;const shaders=[];
      try{
        gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl||typeof gl.createShader!=='function')throw new Error('No background WebGL');
        program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
          if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
          gl.attachShader(program,s);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
        this.program=program;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        this.position=gl.getAttribLocation(program,'aPosition');this.uniforms={};
        for(const name of ['uTime','uAspect','uFront','uPulse','uFocus','uStrength'])this.uniforms[name]=gl.getUniformLocation(program,name);
        gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);this.gl=gl;return true;
      }catch(error){if(program)gl?.deleteProgram(program);this.failed=true;this.diagnostic=String(error);return false;}
      finally{for(const s of shaders)gl.deleteShader(s);}
    }
    fallback(ctx,w,h,frame,focus,strength=1){
      const gain=.55+.45*Math.min(1,strength),rgb=(r,g,b)=>`rgb(${Math.round(r*gain)},${Math.round(g*gain)},${Math.round(b*gain)})`;
      const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,rgb(22,11,18));g.addColorStop(.5,rgb(33,11,16));g.addColorStop(1,rgb(67,25,14));
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      if(frame.alpha>0){
        const band=ctx.createLinearGradient(0,frame.y-w*.12,0,frame.y+w*.38);
        band.addColorStop(0,'rgba(170,45,8,0)');band.addColorStop(.3,'rgba(170,45,8,.34)');band.addColorStop(1,'rgba(170,45,8,0)');
        const savedAlpha=ctx.globalAlpha;ctx.globalAlpha*=Math.min(1,frame.alpha*strength);
        ctx.fillStyle=band;ctx.fillRect(0,frame.y-w*.12,w,w*.5);ctx.globalAlpha=savedAlpha;
      }
      const shade=ctx.createRadialGradient(focus.x+focus.width/2,focus.y+focus.height/2,0,
        focus.x+focus.width/2,focus.y+focus.height/2,Math.max(focus.width,focus.height)*.85);
      shade.addColorStop(0,'rgba(5,4,7,.98)');shade.addColorStop(.45,'rgba(5,4,7,.90)');shade.addColorStop(1,'rgba(5,4,7,0)');
      ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    }
    draw(ctx,width,height,{element,time=0,opacity=1,focus,firePower}={}){
      if(element!=='fire'||!Number.isFinite(opacity)||opacity<=0||width<=0||height<=0)return false;
      time=Number.isFinite(time)?Math.max(0,time):0;
      const alpha=clamp(opacity)*smooth(time/.65);if(alpha<=0)return false;
      focus=focus||{x:width*.18,y:height*.26,width:width*.64,height:height*.48};
      const f=ElementRevealBackdrop.sample(time,width,height);
      const strength=Number.isFinite(firePower)?.16+1.19*clamp(firePower):1;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;
      try{
        if(!this.init()){this.fallback(ctx,width,height,f,focus,strength);return true;}
        const pw=Math.max(1,Math.floor(Math.min(320,width,640*width/height))),ph=Math.max(1,Math.min(640,Math.round(pw*height/width)));
        const key=[width,height,focus.x,focus.y,focus.width,focus.height].join(',');
        const gl=this.gl;
        if(key!==this.lastKey||(time===this.lastTime&&strength!==this.lastStrength)||time<this.lastTime||time-this.lastTime>=1/30-1e-6){
          if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;this.patch.width=pw;this.patch.height=ph;}
          gl.viewport(0,0,pw,ph);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
          gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
          const u=this.uniforms;gl.uniform1f(u.uTime,time);gl.uniform1f(u.uAspect,height/width);
          gl.uniform1f(u.uFront,f.front);gl.uniform1f(u.uPulse,f.alpha*strength);gl.uniform1f(u.uStrength,strength);
          gl.uniform4f(u.uFocus,(focus.x+focus.width/2)/width,(height-focus.y-focus.height/2)/width,
            focus.width*.68/width,focus.height*.64/width);
          gl.drawArrays(gl.TRIANGLES,0,6);
          this.ctx.clearRect(0,0,pw,ph);this.ctx.drawImage(this.canvas,0,0);
          this.lastKey=key;this.lastTime=time;this.lastStrength=strength;
        }
        ctx.drawImage(this.patch,0,0,width,height);return true;
      }finally{ctx.restore();}
    }
  }
  root.ElementRevealBackdrop=ElementRevealBackdrop;
})(globalThis);
