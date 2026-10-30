/* Continuous ocean surface. No collision sheets or detached effect particles.
 * Broad geometry and independent fine normals follow the multiscale approach
 * described in GPU Gems, chapter 1; the spherical field and shading are local.
 */
(function(root){
  'use strict';
  const common=`
    precision highp float;
    uniform float uTime,uSurge,uAspect;
    float sat(float x){return clamp(x,0.,1.);}
    float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float noise3(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    vec3 current(vec3 p,float t){
      float a=t*.014,c=cos(a),s=sin(a);
      vec3 q=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      vec3 warp=vec3(noise3(q*4.+vec3(t*.04,0.,0.)),noise3(q*4.+13.+vec3(0.,t*.03,0.)),noise3(q*4.+29.))-.5;
      return q+warp*.028;
    }
    vec4 project(vec3 p){float z=3.4-p.z;return vec4(p.x*2.61/uAspect,p.y*2.61,1.01005025*z-.201005,z);}
    // Sharper crests and wider troughs. XYZ is the analytic height gradient,
    // W the height, so tiny surface ripples never depend on mesh resolution.
    vec4 wave(vec3 p,vec3 d,float k,float speed,float amp,float offset,float t){
      d=normalize(d);float a=dot(p,d)*k-t*speed+offset;
      float s=.5+.5*sin(a),h=s*s-.375;
      return vec4(d*(amp*k*s*cos(a)),h*amp);
    }
    vec4 swell(vec3 p,float t){
      vec4 w=vec4(0.);
      for(int i=0;i<12;i++){
        float id=float(i),r=fract(sin(id*27.19+4.)*4321.34);
        float a=(r-.5)*1.3+.22;
        vec3 d=vec3(cos(a),sin(a),sin(id*13.3)*.43);
        float k=15.+pow(1.21,id)*6.;
        w+=wave(p,d,k,sqrt(k)*.28,.009*pow(.83,id),id*13.67,t);
      }
      return w*mix(.45,1.,uSurge);
    }
    vec4 ripples(vec3 p,float t){
      vec4 w=vec4(0.);
      for(int i=0;i<16;i++){
        float id=float(i),r=fract(sin(id*39.17+8.)*8731.12);
        float a=(r-.5)*1.6+.2;
        vec3 d=vec3(cos(a),sin(a),cos(id*7.7)*.49);
        float k=99.+pow(1.15,id)*21.;
        w+=wave(p,d,k,sqrt(k)*.28,.00095*pow(.91,id),id*18.38,t);
      }
      return w*mix(.65,1.,uSurge);
    }
  `;
  const vertex=common+`
    attribute vec3 aPosition;
    varying vec3 vPosition,vSurface;
    void main(){
      vec3 n=normalize(aPosition),q=current(n,uTime);
      float h=swell(q,uTime).w;
      vec3 p=n*(1.+h);vPosition=p;vSurface=n;gl_Position=project(p);
    }
  `;
  const fragment=common+`
    uniform sampler2D uOcean;
    uniform float uTextureReady;
    varying vec3 vPosition,vSurface;
    vec3 oceanTexture(vec3 q,vec3 direction,float t){
      // Three projections avoid pole stretching and keep details attached to
      // the curved water surface. Local flow warps each projection gradually.
      vec3 weight=pow(abs(direction),vec3(8.));weight/=max(.001,weight.x+weight.y+weight.z);
      vec3 flow=vec3(sin(q.y*5.+t*.45),sin(q.z*5.-t*.36),cos(q.x*4.+t*.29))*.013;
      vec3 uv=(q+flow)*.47+.5;
      vec2 a=uv.yz,b=uv.zx,c=uv.xy;
      // Mirrored repeat avoids a visible edge if the slow current crosses a
      // texture boundary; the material never snaps to a new image phase.
      a=1.-abs(mod(a,2.)-1.);b=1.-abs(mod(b,2.)-1.);c=1.-abs(mod(c,2.)-1.);
      return texture2D(uOcean,a).rgb*weight.x+texture2D(uOcean,b).rgb*weight.y+texture2D(uOcean,c).rgb*weight.z;
    }
    vec3 sky(vec3 ray){
      float up=sat(ray.y*.5+.5);
      vec3 color=mix(vec3(.048,.075,.12),vec3(.18,.29,.43),pow(up,.65));
      vec3 p=ray*3.8+vec3(2.1,5.7,9.3);
      float cloud=noise3(p)*.62+noise3(p*2.03)*.26+noise3(p*4.11)*.12;
      cloud=smoothstep(.44,.70,cloud)*smoothstep(-.22,.4,ray.y);
      return mix(color,vec3(.50,.60,.69),cloud*.60);
    }
    void main(){
      vec3 unit=normalize(vSurface),q=current(unit,uTime);
      vec4 large=swell(q,uTime),small=ripples(q,uTime);
      vec3 grad=large.xyz+small.xyz;
      float a=-uTime*.014,c=cos(a),s=sin(a);
      grad=vec3(c*grad.x+s*grad.z,grad.y,-s*grad.x+c*grad.z);
      grad-=unit*dot(grad,unit);
      vec3 n=normalize(unit-grad),eye=normalize(vec3(0.,0.,3.4)-vPosition);
      vec3 light=normalize(vec3(-.40,.72,.62));
      float face=sat(dot(n,eye)),fresnel=.0204+.9796*pow(1.-face,5.);
      vec3 reflection=reflect(-eye,n);
      float top=sat(dot(n,light));
      float crest=smoothstep(-.006,.022,large.w);
      vec3 deep=vec3(.003,.018,.038),water=vec3(.006,.074,.108);
      vec3 body=mix(deep,water,crest*.68)*(.68+.32*top);
      // Light passing through thin crest walls stays blue-green. Valleys
      // remain dark navy; reflected sky supplies neutral silver highlights.
      float transmission=pow(sat(dot(eye,-light+n*.6)),3.);
      body+=vec3(.004,.045,.049)*crest*(.35+.65*transmission);
      vec3 color=mix(body,sky(reflection),fresnel*.84);
      vec3 halfLight=normalize(light+eye);
      float spec=pow(sat(dot(n,halfLight)),210.);
      color+=vec3(.75,.86,.95)*spec*.25;

      // Foam travels with the current, gathers on sharp crests, then breaks
      // into filament islands. There are no enclosing luminous contour lines.
      vec3 f=q+vec3(-uTime*.018,uTime*.006,uTime*.011);
      vec3 warp=vec3(noise3(f*5.+4.),noise3(f*5.+19.),noise3(f*5.+37.))-.5;
      f+=warp*.055;
      float patches=noise3(f*18.)*.64+noise3(f*39.+13.)*.36;
      float lace=noise3(f*91.)*.58+noise3(f*183.+7.)*.28+noise3(f*347.+3.)*.14;
      float cells=1.-smoothstep(.015,.085,abs(lace-.51));
      float crestMask=smoothstep(.006,.019,large.w+(patches-.5)*.030);
      float residual=smoothstep(.56,.73,patches)*.36;
      float mass=smoothstep(.40,.65,lace);
      float foam=(crestMask*(.20+.80*mass)+residual*cells)*mix(.30,.95,uSurge);
      foam*=.50+.50*noise3(f*257.+vec3(uTime*.05,0.,0.));
      foam=sat(foam);
      vec3 white=vec3(.67,.76,.79)*(.72+.28*top);
      color=mix(color,white,foam);
      vec3 detail=oceanTexture(q,unit,uTime);
      vec3 linearDetail=pow(detail,vec3(2.2));
      float seaFoam=smoothstep(.31,.73,dot(detail,vec3(.25,.5,.25)));
      float depthLight=.70+.30*sat(dot(unit,light));
      // Photographic detail provides fine foam shapes; actual displaced water
      // and its moving normals still control shading, reflection and volume.
      vec3 textured=linearDetail*depthLight*(.83+.27*crest);
      textured+=sky(reflection)*fresnel*.22*(1.-seaFoam*.8);
      textured+=vec3(.65,.77,.84)*spec*.025*(1.-seaFoam);
      textured+=vec3(.010,.024,.028)*foam*(1.-seaFoam);
      color=mix(color,textured,uTextureReady);
      color=pow(max(color,vec3(0.)),vec3(1./2.2));
      gl_FragColor=vec4(color,1.);
    }
  `;
  root.OceanSurfaceShader=Object.freeze({vertex,fragment});
})(globalThis);
