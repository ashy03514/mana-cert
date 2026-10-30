/* Lit foam and spray billboards in the ocean's WebGL depth buffer. */
(function(root){
  'use strict';
  const vertex=`
    precision highp float;
    attribute vec3 aCenter;
    attribute vec2 aCorner;
    attribute vec4 aParticle;
    attribute float aSeed;
    uniform float uAspect;
    varying vec2 vLocal;
    varying vec4 vStyle;
    varying vec3 vSurface;
    varying vec3 vWorld;
    void main(){
      float c=cos(aParticle.y),s=sin(aParticle.y);
      vec2 corner=aCorner;
      if(aParticle.w<.5)corner*=vec2(1.52,.82);
      if(aParticle.w>.5&&aParticle.w<1.5)corner*=vec2(.72,1.32);
      vec2 offset=vec2(c*corner.x-s*corner.y,s*corner.x+c*corner.y)*aParticle.x;
      vec3 p=aCenter+vec3(offset,0.);
      float z=3.4-p.z;
      gl_Position=vec4(p.x*2.61/uAspect,p.y*2.61,1.01005025*z-.201005,z);
      vLocal=aCorner;vStyle=vec4(aParticle.z,aSeed,aParticle.w,aParticle.y);
      vSurface=normalize(aCenter);
      vWorld=p;
    }
  `;
  const fragment=`
    precision highp float;
    varying vec2 vLocal;
    varying vec4 vStyle;
    varying vec3 vSurface;
    varying vec3 vWorld;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
    }
    void main(){
      vec2 p=vLocal;float seed=vStyle.y,kind=vStyle.z;
      float grain=noise(p*12.+seed*47.);
      float fine=noise(p*29.+seed*73.);
      float r=length(p),angle=atan(p.y,p.x+.00001);
      float outline=.78+.075*sin(angle*3.+seed*19.)+.045*sin(angle*5.-seed*37.);
      outline+=(noise(p*6.+seed*91.)-.5)*.34;
      // Broad feathering lets adjacent foam patches merge. Only the thin
      // outer edge exposes the irregular outline of an individual patch.
      float edge=1.-smoothstep(outline-.28,outline+.04,r);
      if(kind>.5&&kind<1.5)edge=1.-smoothstep(.66,.95,r);
      if(kind>1.5)edge=exp(-r*r*4.)*(1.-smoothstep(.68,1.,r));
      float alpha=vStyle.x*edge;
      if(alpha<.004)discard;
      float z=sqrt(max(0.,1.-dot(p,p)));
      float c=cos(vStyle.w),s=sin(vStyle.w);
      vec2 bumps=vec2(noise(p*6.+seed*31.)-noise((p+vec2(.06,0.))*6.+seed*31.),
        noise(p*6.+seed*31.)-noise((p+vec2(0.,.06))*6.+seed*31.));
      vec2 facet=p+(kind<.5?bumps*1.8:vec2(0.));
      vec3 normal=normalize(vec3(c*facet.x-s*facet.y,s*facet.x+c*facet.y,z));
      // Share the curved water's main lighting instead of shading each patch
      // as a separate sphere; keep small facets for churned foam relief.
      if(kind<.5)normal=normalize(vSurface+normal*.18);
      float light=max(0.,dot(normal,normalize(vec3(-.40,.72,.62))));
      // Blue-grey undersides, neutral sunlit tops and porous edges make small
      // overlapping volumes. Standard alpha blending preserves dark gaps.
      vec3 color=mix(vec3(.45,.56,.60),vec3(1.,1.,.99),pow(light,.42));
      color*=.94+.04*grain+.02*fine;
      if(kind<.5){
        alpha*=.72+.28*smoothstep(.19,.68,grain*.6+fine*.4);
        // Shared spatial detail crosses sprite boundaries, so dense foam has
        // coherent folds and pores instead of repeated bright particle caps.
        vec2 water=vWorld.xy+vWorld.z*vec2(.31,.23);
        float folds=noise(water*37.+vec2(noise(water*18.),noise(water*18.+17.))*1.8);
        float pores=noise(water*218.+vec2(13.,29.));
        float lace=noise(water*410.+vec2(31.,7.));
        float foamLight=smoothstep(.20,.80,folds*.62+pores*.28+lace*.10);
        color=mix(vec3(.57,.69,.72),color,foamLight);
        alpha*=.56+.44*smoothstep(.18,.62,folds*.75+pores*.25);
      }else if(kind<1.5){
        color=mix(vec3(.12,.32,.42),vec3(.64,.84,.87),light);
        float glint=exp(-dot(p-vec2(-.24,.32),p-vec2(-.24,.32))*35.);
        color=mix(color,vec3(.91,.98,1.),glint*.85);
      }else color=vec3(.50,.67,.71);
      gl_FragColor=vec4(color*alpha,alpha);
    }
  `;
  const corners=[-1,-1,1,-1,-1,1,-1,1,1,-1,1,1],STRIDE=10,MAX_PARTICLES=3200;
  class OceanSpray {
    constructor(gl){
      this.gl=gl;this.count=0;this.disposed=false;
      this.data=new Float32Array(MAX_PARTICLES*6*STRIDE);
      const shaders=[];this.program=gl.createProgram();
      try{
        for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
          gl.attachShader(this.program,shader);
        }
        gl.linkProgram(this.program);
        if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      }catch(error){gl.deleteProgram(this.program);throw error;}
      finally{for(const shader of shaders)gl.deleteShader(shader);}
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
      this.attributes={};for(const name of ['aCenter','aCorner','aParticle','aSeed'])this.attributes[name]=gl.getAttribLocation(this.program,name);
      this.aspect=gl.getUniformLocation(this.program,'uAspect');
    }
    draw(time,{surge=1,breakers=1,strength=1}={}){
      if(this.disposed)return;
      const gl=this.gl,particles=root.OceanSprayField.sample(time,{surge,breakers});
      particles.sort((a,b)=>a.z-b.z);this.count=Math.min(MAX_PARTICLES,particles.length);
      let offset=0;
      for(let i=0;i<this.count;i++){
        const p=particles[i];
        for(let corner=0;corner<6;corner++){
          this.data[offset++]=p.x;this.data[offset++]=p.y;this.data[offset++]=p.z;
          this.data[offset++]=corners[corner*2];this.data[offset++]=corners[corner*2+1];
          this.data[offset++]=p.radius;this.data[offset++]=p.angle;
          this.data[offset++]=p.alpha*strength;this.data[offset++]=p.kind;this.data[offset++]=p.seed;
        }
      }
      if(!this.count)return;
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,offset));
      for(const [name,size,start]of [['aCenter',3,0],['aCorner',2,3],['aParticle',4,5],['aSeed',1,9]]){
        const at=this.attributes[name];gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,STRIDE*4,start*4);
      }
      gl.uniform1f(this.aspect,gl.drawingBufferWidth/gl.drawingBufferHeight);
      gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES,0,this.count*6);
      gl.depthMask(true);gl.disable(gl.BLEND);
      for(const at of Object.values(this.attributes))gl.disableVertexAttribArray(at);
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.count=0;
    }
  }
  root.OceanSpray=OceanSpray;
})(globalThis);
