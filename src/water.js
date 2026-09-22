import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { noiseGLSL, skyGLSL, waveGLSL } from './shaders.js';

function oceanGeometry(segments = 320) {
  const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setXY(i, Math.sign(x) * Math.pow(Math.abs(x), 2.7) * 2400, Math.sign(y) * Math.pow(Math.abs(y), 2.7) * 2400);
  }
  geo.computeBoundingSphere();
  return geo;
}

export function createOcean(shared) {
 const water = new Water(oceanGeometry(), { textureWidth: 1024, textureHeight: 1024, clipBias: .02 });
 water.rotation.x = -Math.PI / 2;
 water.frustumCulled = false;
 const mat = water.material;
 mat.lights = false;
 Object.assign(mat.uniforms, shared, {
   uFoam: {value:.45}, uRain:{value:0}, uShip:{value:new THREE.Vector4(0,0,0,1)},
   uRipples:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0))},
   uIsland:{value:1},
 });
 mat.vertexShader = /* glsl */`
 uniform mat4 textureMatrix;
 varying vec4 vMirror;
 varying vec3 vWorld;
 varying vec3 vNormal;
 varying float vCrest;
 ${waveGLSL}
 void main() {
  vec3 p=(modelMatrix*vec4(position,1.0)).xyz;
  float shore=clamp((length((p.xz-vec2(-25.0,-43.0))*vec2(.8,1.0))-12.0)/16.0,.15,1.0);
  vec3 pos=waves(p.xz,vNormal,vCrest);
  pos.y*=shore;
  vNormal=normalize(mix(vec3(0,1,0),vNormal,shore));
  vWorld=pos;
  vMirror=textureMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.0);
 }`;
 mat.fragmentShader = /* glsl */`
 uniform sampler2D mirrorSampler;
 uniform vec3 eye;
 uniform float uWind,uSwell,uFoam,uRain,uIsland;
 uniform vec4 uShip;
 uniform vec4 uRipples[8];
 varying vec4 vMirror;
 varying vec3 vWorld;
 varying vec3 vNormal;
 varying float vCrest;
 ${noiseGLSL}
 ${skyGLSL}
 void main() {
  vec2 p=vWorld.xz;
  vec3 V=normalize(eye-vWorld);
  float dist=length(eye-vWorld);
  // The small wave band fades out before its pixels would alias at the horizon.
  float microFade=1.0-smoothstep(80.0,350.0,dist);
  vec2 micro=vec2(0.0);
  for(int i=0;i<9;i++) {
   float fi=float(i), angle=fi*2.399+.25;
   vec2 d=vec2(cos(angle),sin(angle));
   float k=1.7*pow(1.32,fi);
   float phase=dot(p,d)*k-time*sqrt(9.81*k)*.55+sin(dot(p,d.yx)*.4+fi)*1.2;
   micro+=d*cos(phase)*.036*pow(.9,fi);
  }
  vec2 adv=p*.8+vec2(-time*.18,time*.1);
  float n=fbm(adv);
  micro+=vec2(fbm(adv+vec2(.06,0))-n,fbm(adv+vec2(0,.06))-n)*1.6;
  vec3 N=normalize(vNormal+vec3(micro.x,0,micro.y)*microFade*(.18+uWind*.065));
  float rippleFoam=0.0;
  for(int i=0;i<8;i++) {
   vec4 r=uRipples[i];float age=time-r.z;vec2 delta=p-r.xy;float radius=length(delta);
   float envelope=exp(-pow((radius-age*2.2)*1.8,2.0))*exp(-age*.45)*step(0.0,age)*r.w;
   N.xz+=normalize(delta+vec2(.001))*cos(radius*8.0-age*15.0)*envelope*.22;
   rippleFoam+=envelope*.25;
  }
  // Ship's moving Kelvin-style wake: two diverging wave arms and aerated stern water.
  vec2 dShip=p-uShip.xy;float co=cos(uShip.z),si=sin(uShip.z);
  vec2 boat=vec2(co*dShip.x-si*dShip.y,si*dShip.x+co*dShip.y);
  float aft=max(0.0,-boat.y-7.0);
  float edge=abs(abs(boat.x)-aft*.29);
  float wake=exp(-edge*edge/(.65+aft*.12))*exp(-aft*.04)*step(7.0,-boat.y)*uShip.w;
  float trail=exp(-boat.x*boat.x/(1.2+aft*.13))*exp(-aft*.055)*step(7.0,-boat.y)*uShip.w;
  N.x+=sin(edge*6.0-time*4.0)*wake*.14;
  N=normalize(N);
  vec3 R=reflect(-V,N);
  vec3 reflected=skyColor(vec3(R.x,abs(R.y),R.z),false);
  vec2 mirrorUV=vMirror.xy/vMirror.w;
  vec2 distortion=N.xz*(.002+1.0/max(dist,5.0))*.72;
  vec3 mirror=texture2D(mirrorSampler,clamp(mirrorUV+distortion,vec2(.001),vec2(.999))).rgb;
  reflected=mix(reflected,mirror,.88);
  float facing=max(dot(N,V),.0);
  float fresnel=.022+.978*pow(1.0-facing,5.0);
  float islandDist=length((p-vec2(-25.0,-43.0))*vec2(.8,1.0));
  float shallow=(1.0-smoothstep(13.0,41.0,islandDist))*uIsland;
  vec3 deep=vec3(.002,.036,.065);
  vec3 shoal=vec3(.035,.34,.25);
  float sand=fbm(p*.4+N.xz*.7);
  vec3 waterColor=mix(deep,shoal,shallow);
  waterColor*=.85+.3*sand;
  float caustic=pow(max(0.0,1.0-abs(sin(p.x*1.1+sin(p.y*1.9+time))+sin(p.y*1.3-time*.8))*.7),8.0);
  waterColor+=vec3(.13,.20,.12)*caustic*shallow*(1.0-uCloud*.8);
  float sss=pow(max(0.0,dot(V,-sunDirection+N*.7)),3.0);
  waterColor+=vec3(.013,.13,.10)*sss*max(vWorld.y+.3,0.0)*(1.0-uCloud*.7);
  waterColor*=mix(1.0,.36,smoothstep(.6,1.0,uCloud));
  waterColor=mix(waterColor,waterColor*vec3(.13,.22,.38),uNight);
  vec3 color=mix(waterColor,reflected,clamp(fresnel+.035,0.0,1.0));
  vec3 H=normalize(sunDirection+V);
  float nh=max(dot(N,H),0.0);
  float rough=.035+uWind*.001;
  float a2=rough*rough;
  float denom=nh*nh*(a2-1.0)+1.0;
  float spec=a2/(3.14159*denom*denom+.00001);
  vec3 sunTint=mix(vec3(1.0,.9,.71),vec3(1.0,.50,.20),uWarmth);
  sunTint=mix(sunTint,vec3(.35,.55,.9),uNight);
  color+=sunTint*spec*.045*(1.0-uCloud*.92)*max(dot(N,sunDirection),0.0);
  // Multi-scale porous foam travels slowly downwind after the crest has passed.
  vec2 fp=p*1.65+vec2(-time*.25,time*.12);
  float fn=fbm(fp);
  float pores=noise2(fp*7.0);
  float crest=smoothstep(.16+(1.0-uFoam)*.23,.29+(1.0-uFoam)*.24,vCrest+fn*.11);
  crest*=smoothstep(.25,.62,fn)*uFoam;
  float shoreLine=abs(islandDist-(15.7+sin(time*.9-islandDist*.2)*.65));
  float shoreFoam=exp(-shoreLine*shoreLine*.72)*(.3+fn*.7)*uIsland;
  float bowFoam=exp(-pow(abs(boat.x)-2.25,2.0)*3.0)*exp(-boat.y*boat.y*.018)*uShip.w;
  float foam=clamp(crest*1.25+shoreFoam*.85+(wake*.35+trail*.8+bowFoam*.6)*smoothstep(.2,.67,fn)+rippleFoam,0.0,1.0);
  foam*=mix(.7,1.0,pores);
  vec3 foamColor=mix(vec3(.81,.90,.85),vec3(.36,.43,.47),smoothstep(.5,1.0,uCloud));
  foamColor=mix(foamColor,vec3(.11,.18,.25),uNight);
  color=mix(color,foamColor,foam);
  float fog=1.0-exp(-dist*.00085*(1.0+uCloud*2.0));
  color=mix(color,skyColor(normalize(vec3(-V.x,.015,-V.z)),false),fog);
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
 let rippleIndex=0;
 return {
  mesh:water,uniforms:mat.uniforms,
  ripple(x,z,time){mat.uniforms.uRipples.value[rippleIndex++%8].set(x,z,time,1);},
  setQuality(quality){
   const segments={balanced:320,high:448,ultra:576}[quality];
   water.geometry.dispose();water.geometry=oceanGeometry(segments);
  },
 };
}
