/* The abyss is an occluding tear in space, with shaded, uneven lips. The
 * host owns the clock and the intake/release envelopes; no local timers. */
(function(root){
  'use strict';
  const vertex=`
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
  `;
  const fragment=`
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution,uCenter;
    uniform float uRadius,uTime,uCharge,uSurge,uImpact,uReveal;

    float hash(vec2 p){
      p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);
      return fract(p.x*p.y);
    }
    float noise(vec2 p){
      vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),
        mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);
    }
    float fbm(vec2 p){
      float result=0.,weight=.5;
      mat2 turn=mat2(.80,.60,-.60,.80);
      for(int i=0;i<4;i++){
        result+=noise(p)*weight;p=turn*p*2.03+vec2(7.13,1.79);weight*=.5;
      }
      return result;
    }
    float bell(float x,float width){return exp(-x*x/(width*width));}

    void main(){
      vec2 pixel=vec2(vUv.x,1.-vUv.y)*uResolution;
      vec2 p=(pixel-uCenter)/max(1.,uRadius);
      float t=uTime,reveal=clamp(uReveal,0.,1.);
      float charge=clamp(uCharge,0.,1.),surge=clamp(uSurge,0.,1.);
      float impact=clamp(uImpact,0.,1.);
      float radius=length(p),angle=atan(p.y,p.x);

      // Sparse, slowly shearing backclouds. Fine detail stays subordinate to
      // the authored iron and seal surfaces painted over this pass.
      vec2 sky=p*.67+vec2(.05*sin(t*.09),t*.018);
      float cloud=fbm(sky+vec2(.17*sin(p.y*.8-t*.11),.14*cos(p.x*.7+t*.07)));
      float haze=smoothstep(.28,.80,cloud);
      float overhead=exp(-dot(p-vec2(-.5,-1.5),p-vec2(-.5,-1.5))*.13);
      vec3 color=mix(vec3(.009,.011,.026),vec3(.026,.022,.060),overhead*.8);
      color+=vec3(.029,.018,.059)*haze*overhead;
      color+=vec3(.014,.021,.037)*haze*(1.-overhead*.6);

      // A broad refractive pulse falls inward every two seconds. Its edges
      // dissolve in the clouds, never becoming a thin neon circle.
      float pulse=fract(t*.5),pulseEnvelope=pow(sin(pulse*3.14159265),2.);
      float pulseRadius=mix(4.4,.12,pulse*pulse*(3.-2.*pulse));
      float warpedRadius=length(p*vec2(.91,1.04))+(cloud-.45)*.34;
      float pulseBand=bell(warpedRadius-pulseRadius,.28+.19*pulse);
      color*=1.-pulseBand*pulseEnvelope*.20*reveal;
      color+=vec3(.035,.022,.075)*pulseBand*pulseEnvelope*(.3+.7*haze)*reveal;

      // The two lips have unrelated wrinkles and a drifting crooked axis.
      // Keeping the center opaque makes the tear read as depth, not a glowing
      // orb. Its long axis and soft pointed ends remain visible while moving.
      float height=1.04+surge*.10-charge*.025;
      float y=p.y/height;
      float endFade=1.-smoothstep(.83,1.13,abs(y));
      float axis=.042*sin(y*3.9+t*.24)+.024*sin(y*8.1-t*.18);
      float side=step(axis,p.x);
      float edgeNoise=fbm(vec2(y*4.4+t*.12,side*8.7-t*.15));
      float crossSection=pow(max(0.,1.-y*y),.72);
      float opening=(.235+surge*.115-charge*.048)*(.84+.16*sin(t*.66+.7));
      float width=crossSection*opening*(.82+edgeNoise*.55);
      width+=(noise(vec2(y*21.+t*.3,side*12.4))-.5)*.029*endFade;
      float dx=p.x-axis;
      float distance=abs(dx)-max(.002,width);
      float edge=smoothstep(-.025,.035,distance);
      float cavity=(1.-smoothstep(-.012,.025,distance))*endFade;

      // Wind-drawn vapor follows the rims and streams back inward. Broken
      // density exposes different layers instead of tracing a uniform line.
      vec2 flow=vec2(abs(dx)*4.1-t*(.07+charge*.09),p.y*2.7-t*.13);
      flow.x+=sin(p.y*2.9+t*.3)*.34;
      float vapor=fbm(flow+vec2(edgeNoise*.7,cloud*.3));
      float skirt=exp(-max(0.,distance)*3.4)*endFade;
      float filaments=pow(smoothstep(.22,.65,vapor),1.35)*skirt*edge;
      vec3 mist=mix(vec3(.070,.053,.122),vec3(.20,.16,.30),vapor);
      color=mix(color,mist,filaments*(.58+surge*.15)*reveal);

      // A dark folded face sits outside the opening; grazing illumination
      // gives it thickness. Small bright fractures are intermittent in space.
      float folded=bell(distance-.065,.11)*endFade;
      float ridgeNoise=noise(vec2(y*12.-t*.21,abs(dx)*23.+t*.13));
      float foldShade=.36+.64*ridgeNoise;
      color=mix(color,vec3(.022,.018,.043)*foldShade,folded*.44*reveal);
      float thinRim=bell(distance,.024+.022*ridgeNoise)*endFade;
      float broadRim=bell(distance,.095)*endFade;
      float lightBreak=.21+.79*smoothstep(.25,.73,edgeNoise);
      float sideLight=mix(.69,1.,side);
      color+=vec3(.22,.125,.36)*broadRim*lightBreak*sideLight*(.40+surge*.50)*reveal;
      color+=mix(vec3(.34,.21,.48),vec3(.63,.51,.76),ridgeNoise)*thinRim
        *lightBreak*sideLight*(.28+surge*.43+impact*.75)*reveal;

      // The interior eats the backlight. Only almost invisible moving folds
      // remain inside, with a small glancing light at the deeper rear wall.
      float deepNoise=noise(vec2(p.x*13.+sin(p.y*6.-t*.2),p.y*6.+t*.11));
      vec3 abyss=vec3(.0025,.002,.007)+vec3(.009,.004,.019)*deepNoise;
      float innerLight=bell(distance+.045,.047)*endFade;
      abyss+=vec3(.047,.020,.083)*innerLight*(.4+surge*.8);
      color=mix(color,abyss,cavity*reveal);

      // The impact illuminates the local fog without bleaching the entire
      // screen or hiding the chain material with a white flash.
      color+=vec3(.074,.039,.117)*impact*exp(-radius*radius*.5)*(.3+cloud)*reveal;
      float edgeVignette=dot((pixel/uResolution-.5)*vec2(1.,.72),
        (pixel/uResolution-.5)*vec2(1.,.72));
      color*=1.-smoothstep(.06,.40,edgeVignette)*.29;
      gl_FragColor=vec4(max(color,vec3(0.)),1.);
    }
  `;
  root.DarkSealShader=Object.freeze({vertex,fragment});
})(globalThis);
