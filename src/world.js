import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { noiseGLSL, skyGLSL } from './shaders.js';
import { sampleWave } from './state.js';

const rand = (()=>{let seed=173;return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};})();
const temp = new THREE.Vector3();

function mesh(geo,mat,parent,pos=[0,0,0]) {
 const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function rod(a,b,r,mat,parent,r2=r) {
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
 const m=mesh(new THREE.CylinderGeometry(r2,r,d.length(),7),mat,parent,av.add(bv).multiplyScalar(.5).toArray());
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
function rope(points,mat,parent,r=.025) {
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 return mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*3),r,4,false),mat,parent);
}
function surfaceTexture(kind) {
 const size=256,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const index=(y*size+x)*4;
  let n=rand();
  if(kind==='wood')n=.3+n*.2+Math.sin(y*.55+Math.sin(x*.025)*1.7)*.15+Math.sin(y*2.4)*.1;
  if(kind==='rock')n=.5+Math.sin(x*.1+Math.cos(y*.05)*4)*.1+Math.sin(y*.1+x*.11)*.1+n*.25;
  const v=Math.floor(n*255);data[index]=v;data[index+1]=v;data[index+2]=v;data[index+3]=255;
 }
 const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;return tex;
}

export function createWorld(scene,shared) {
 const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,uniforms:shared,
  vertexShader:`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.0);gl_Position=p.xyww;}`,
  fragmentShader:`varying vec3 vDir;${noiseGLSL}${skyGLSL}void main(){gl_FragColor=vec4(skyColor(normalize(vDir),true),1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include'),
 });
 const sky=new THREE.Mesh(new THREE.SphereGeometry(4000,32,16),skyMat);sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
 const hemi=new THREE.HemisphereLight(0xb1d4e9,0x4c5440,2.0);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffedce,3.1);sun.position.set(-60,90,-70);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:70,bottom:-70,near:1,far:250});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);

 const island=new THREE.Group();island.position.set(-25,0,-43);scene.add(island);
 const sandTex=surfaceTexture('sand');sandTex.repeat.set(18,18);
 const sandMat=new THREE.MeshStandardMaterial({color:0xddcca1,roughness:1,map:sandTex,bumpMap:sandTex,bumpScale:.10});
 const ground=new THREE.SphereGeometry(1,96,48);const gp=ground.attributes.position;
 for(let i=0;i<gp.count;i++) {
  const x=gp.getX(i),y=gp.getY(i),z=gp.getZ(i);const a=Math.atan2(z,x);
  const edge=1+.09*Math.sin(a*5)+.045*Math.cos(a*9);
  gp.setXYZ(i,x*21*edge,y*4.3-1.9,z*16*edge);
 }
 ground.computeVertexNormals();mesh(ground,sandMat,island);
 const rockTex=surfaceTexture('rock');rockTex.repeat.set(2,2);
 const rockMat=new THREE.MeshStandardMaterial({color:0xb8a185,roughness:.92,map:rockTex,bumpMap:rockTex,bumpScale:.35});
 for(let i=0;i<30;i++) {
  const a=i*2.399,rad=12+rand()*5;
  const geo=mergeVertices(new THREE.IcosahedronGeometry(1,6));const p=geo.attributes.position;
  for(let j=0;j<p.count;j++){
   const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
   const n=1+.10*Math.sin(x*7+z*4)*Math.sin(y*5+z*3)+.025*Math.sin(x*17+y*11);
   p.setXYZ(j,x*n,y*n,z*n);
  }geo.computeVertexNormals();
  const r=mesh(geo,rockMat,island,[Math.cos(a)*rad*1.13,rand()*.7,Math.sin(a)*rad*.75]);
  const size=1.4+rand()*3.2;r.scale.set(size*(.7+rand()),size*(.8+rand()*.7),size);r.rotation.set(rand()*.4,rand()*6,rand()*.4);
 }
 const barkTex=surfaceTexture('wood');barkTex.repeat.set(1,12);
 const bark=new THREE.MeshStandardMaterial({color:0x73644b,roughness:1,map:barkTex,bumpMap:barkTex,bumpScale:.12});
 const leafMats=[0x3a5725,0x486632,0x61783a].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.84,side:THREE.DoubleSide}));
 function palm(x,z,h,lean) {
  const g=new THREE.Group();g.position.set(x,1.5,z);island.add(g);
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(lean*.12,h*.35,0),new THREE.Vector3(lean*.5,h*.72,.2),new THREE.Vector3(lean,h,.35)]);
  const trunk=new THREE.TubeGeometry(path,20,.28,8,false);
  const p=trunk.attributes.position;for(let i=0;i<p.count;i++){const factor=1-.4*p.getY(i)/h;const center=path.getPoint(Math.min(1,Math.max(0,p.getY(i)/h)));p.setX(i,center.x+(p.getX(i)-center.x)*factor);}trunk.computeVertexNormals();mesh(trunk,bark,g);
  const crown=new THREE.Group();crown.position.copy(path.getPoint(1));g.add(crown);
  for(let f=0;f<10;f++){
   const a=f*Math.PI*2/10+rand()*.2,L=3.4+rand()*2;
   const verts=[];
   for(let j=1;j<15;j++) {
    const t=j/15;const t2=Math.min(1,t+.11);const width=Math.sin(t*Math.PI)*L*.29;
    const center=new THREE.Vector3(Math.cos(a)*L*t,Math.sin(t*Math.PI)*1.15-t*t*1.6,Math.sin(a)*L*t);
    const tip=new THREE.Vector3(Math.cos(a)*L*t2,Math.sin(t2*Math.PI)*1.15-t2*t2*1.6,Math.sin(a)*L*t2);
    for(const s of [-1,1]){
      const side=center.clone().add(new THREE.Vector3(Math.cos(a+Math.PI/2)*width*s,-.2-Math.abs(t-.5)*.2,Math.sin(a+Math.PI/2)*width*s));
      verts.push(...center.toArray(),...side.toArray(),...tip.toArray());
    }
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();mesh(geo,leafMats[f%3],crown);
  }
 }
 [[-7,-2,11,-2.2],[2,-4,14,1.7],[7,1,10,1.9],[-1,5,12,-1.8],[10,-5,9,2.3],[-10,5,9,-2]].forEach(v=>palm(...v));
 for(let i=0;i<22;i++){
  const a=rand()*6.28,r=rand()*10;
  const bush=mesh(new THREE.IcosahedronGeometry(.65+rand()*.7,1),leafMats[i%3],island,[Math.cos(a)*r,2,Math.sin(a)*r*.6]);bush.scale.y=.7;
 }

 const ship=makeShip(shared);scene.add(ship);
 const buoy=new THREE.Group();scene.add(buoy);const metal=new THREE.MeshStandardMaterial({color:0xc89930,metalness:.45,roughness:.45});
 mesh(new THREE.CylinderGeometry(.45,.8,1.0,12),metal,buoy,[0,.35,0]);rod([0,.8,0],[0,4.1,0],.055,metal,buoy);
 mesh(new THREE.ConeGeometry(.32,.6,8),metal,buoy,[0,3.8,0]);
 const ring=mesh(new THREE.TorusGeometry(.55,.08,5,18),metal,buoy,[0,1.3,0]);ring.rotation.x=Math.PI/2;
 const birds=new THREE.Group();scene.add(birds);const birdMat=new THREE.MeshBasicMaterial({color:0xc4c8c5,side:THREE.DoubleSide});
 for(let i=0;i<7;i++){
  const g=new THREE.Group();birds.add(g);
  for(const s of [-1,1]){
   const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,s*1.3,.15,.25,s*.65,0,-.16],3));geom.computeVertexNormals();mesh(geom,birdMat,g);
  }
 }

 const rainGeo=new THREE.BufferGeometry(),rainCount=1900,rainArray=new Float32Array(rainCount*6);
 for(let i=0;i<rainCount;i++) {
  const x=(rand()-.5)*140,y=rand()*65,z=(rand()-.5)*140;
  rainArray.set([x,y,z,x+.18,y-1.1,z+.1],i*6);
 }
 rainGeo.setAttribute('position',new THREE.BufferAttribute(rainArray,3));
 const rainMat=new THREE.LineBasicMaterial({color:0xb1cbd5,transparent:true,opacity:0,depthWrite:false});
 const rain=new THREE.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);
 const sprayCount=380,sprayGeo=new THREE.BufferGeometry(),sprayArray=new Float32Array(sprayCount*3),spraySeeds=Array.from({length:sprayCount},()=>[rand(),rand(),rand()]);
 sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayArray,3));
 const sprayMat=new THREE.PointsMaterial({color:0xdeedea,size:.10,transparent:true,opacity:.6,depthWrite:false});
 const spray=new THREE.Points(sprayGeo,sprayMat);spray.frustumCulled=false;scene.add(spray);
 const normal=new THREE.Vector3(),targetRotation=new THREE.Euler();
 return { island,ship,sun,hemi,
  update(time,dt,state,camera) {
   const angle=1.95+Math.sin(time*.022)*.13;
   const shipX=8+Math.sin(time*.022)*9,shipZ=Math.sin(time*.033)*5;
   ship.position.set(shipX,sampleWave(shipX,shipZ,time,state.swell,state.wind)*.6,shipZ);
   ship.rotation.set(Math.sin(time*.8)*.025*state.swell,angle,Math.sin(time*.61)*.045*state.swell);
   ship.visible=state.ship;
   buoy.position.set(-6,sampleWave(-6,-16,time,state.swell,state.wind)*.85,-16);buoy.rotation.z=Math.sin(time*.7)*.08*state.swell;
   const light=shared.sunDirection.value;
   sun.position.copy(light).multiplyScalar(120);sun.target.position.set(-10,0,-20);
   sun.intensity=(3.1-state.cloud*2.3)*(state.night? .24:1);
   sun.color.set(state.night?0x88b7ff:state.warmth?0xffbb77:0xffedcf);
   hemi.intensity=(1.6-state.cloud*.8)*(state.night?.18:1);hemi.color.set(state.night?0x56729b:state.warmth?0xb1a7b6:0xafd3ec);
   for(let i=0;i<birds.children.length;i++){
    const g=birds.children[i],a=time*.035+i*.8;g.position.set(-22+Math.sin(a)*30,18+i*1.5,-42+Math.cos(a)*22);g.rotation.y=-a;
    g.children[0].rotation.z=Math.sin(time*3.6+i)*.18;g.children[1].rotation.z=-Math.sin(time*3.6+i)*.18;
   }
   rain.visible=state.rain>.01;rainMat.opacity=state.rain*.24;
   if(rain.visible){rain.position.set(camera.position.x,0,camera.position.z);for(let i=0;i<rainCount;i++){const idx=i*6;rainArray[idx+1]-=dt*29;rainArray[idx+4]-=dt*29;if(rainArray[idx+1]<-1){rainArray[idx+1]+=66;rainArray[idx+4]+=66;}}rainGeo.attributes.position.needsUpdate=true;}
   spray.visible=state.ship && state.wind>6;
   if(spray.visible){for(let i=0;i<sprayCount;i++){
    const [a,b,c]=spraySeeds[i],life=(time*.7+a)%1;
    temp.set((i%2?1:-1)*(2+life*2),.35+Math.sin(life*Math.PI)*(.4+b*1.4)*state.swell,-4+c*10-life*6);
    temp.applyEuler(ship.rotation).add(ship.position);sprayArray.set(temp.toArray(),i*3);
   }sprayGeo.attributes.position.needsUpdate=true;}
  },
 };
}

function makeShip(shared) {
 const boat=new THREE.Group();
 const woodTex=surfaceTexture('wood');woodTex.repeat.set(2,9);
 const hullMat=new THREE.MeshStandardMaterial({color:0x967451,map:woodTex,bumpMap:woodTex,bumpScale:.06,roughness:.82,side:THREE.DoubleSide});
 const deckMat=new THREE.MeshStandardMaterial({color:0xa58d65,map:woodTex,bumpMap:woodTex,bumpScale:.045,roughness:.85});
 const trimMat=new THREE.MeshStandardMaterial({color:0x292d2b,roughness:.62});
 const gold=new THREE.MeshStandardMaterial({color:0xb39a5a,metalness:.6,roughness:.47});
 const ropeMat=new THREE.MeshStandardMaterial({color:0x8d8568,roughness:1});
 const mastMat=new THREE.MeshStandardMaterial({color:0x6f5033,map:woodTex,roughness:.8});
 const positions=[],uvs=[],indices=[];const sections=36,levels=9;
 for(let j=0;j<=sections;j++){
  const t=j/sections,z=-10+t*21;
  const w=2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22)+.035;
  for(let k=0;k<=levels;k++){
   const a=k/levels*Math.PI;const x=-Math.cos(a)*w;
  const y=2.15-Math.sin(a)*3.65+Math.pow(Math.abs(t-.5)*2,4)*1.25;
   positions.push(x,y,z);uvs.push(t*4,k/levels);
  }
 }
 for(let j=0;j<sections;j++)for(let k=0;k<levels;k++){const a=j*(levels+1)+k,b=a+levels+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hull.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));hull.setIndex(indices);hull.computeVertexNormals();mesh(hull,hullMat,boat);
 const shape=new THREE.Shape();shape.moveTo(0,-10);
 for(let i=0;i<=36;i++){const t=i/36;shape.lineTo(2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22),-10+t*21);}
 for(let i=36;i>=0;i--){const t=i/36;shape.lineTo(-2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22),-10+t*21);}
 const deckGeo=new THREE.ShapeGeometry(shape);deckGeo.rotateX(-Math.PI/2);deckGeo.scale(1,1,-1);deckGeo.computeVertexNormals();
 deckMat.side=THREE.DoubleSide;mesh(deckGeo,deckMat,boat,[0,2.15,0]);
 // Hull strakes, gunwales, evenly spaced stanchions, and rope railings.
 for(const s of [-1,1]) {
  for(let band=0;band<4;band++){
   const points=[];
   for(let i=1;i<36;i++){const t=i/36;const w=2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22);points.push([s*w*(1-band*.028),2.18-band*.42+Math.pow(Math.abs(t-.5)*2,4)*1.25,-10+t*21]);}
   rope(points,band===0?trimMat:gold,boat,band===0?.10:.035);
  }
  const rail=[];
  for(let j=2;j<35;j+=2){const t=j/36;const z=-10+t*21,x=s*2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22),y=2.18+Math.pow(Math.abs(t-.5)*2,4)*1.25;rod([x,y,z],[x,y+1.0,z],.046,trimMat,boat);rail.push([x,y+1.0,z]);}
  rope(rail,trimMat,boat,.065);
  for(let i=0;i<7;i++){
   const z=-6+i*1.8,t=(z+10)/21,x=s*(2.85*Math.pow(Math.sin(t*Math.PI),.55)*(.86+t*.22));
   const hatch=mesh(new THREE.BoxGeometry(.08,.48,.52),trimMat,boat,[x,1.45,z]);
   rod([x,1.5,z],[x+s*.35,1.5,z],.10,trimMat,boat);
  }
 }
 mesh(new THREE.BoxGeometry(3.8,.9,3.8),hullMat,boat,[0,2.55,-6.8]);mesh(new THREE.BoxGeometry(4.1,.12,4.1),deckMat,boat,[0,3.05,-6.8]);
 for(let i=0;i<4;i++)mesh(new THREE.BoxGeometry(.44,.43,.07),gold,boat,[-1.25+i*.83,2.56,-8.74]);
 const sailMat=new THREE.MeshStandardMaterial({color:0xe3d8b8,roughness:1,side:THREE.DoubleSide});
 sailMat.onBeforeCompile=shader=>{shader.uniforms.uTime=shared.time;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(position.x*2.0 + uTime*1.8 + position.y)*.035;');};
 function sail(y,z,width,height) {
  const geo=new THREE.PlaneGeometry(width,height,20,18);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),yy=p.getY(i),v=(yy+height*.5)/height;const u=x/(width*.5);p.setXYZ(i,x*(.83+v*.17),yy+Math.pow(Math.abs(u),2)*.3,Math.sin((u+1)*Math.PI*.5)*Math.sin(v*Math.PI)*1.4);}
  geo.computeVertexNormals();mesh(geo,sailMat,boat,[0,y,z+.15]);
  rod([-width*.54,y+height*.5,z],[width*.54,y+height*.5,z],.085,mastMat,boat);
  for(const s of [-1,1])rope([[s*width*.5,y+height*.5,z],[s*width*.43,y-height*.5+.3,z+.15],[s*2.5,3,z+1]],ropeMat,boat,.022);
 }
 for(const [z,h] of [[-3.4,18],[3.6,15]]){
  rod([0,2,z],[0,h,z],.22,mastMat,boat,.08);
  mesh(new THREE.CylinderGeometry(.63,.45,.48,12),mastMat,boat,[0,h*.72,z]);
  sail(h*.51,z,7.8,h*.29);sail(h*.80,z,5.5,h*.18);
  for(const s of [-1,1]){
   for(let i=0;i<4;i++)rope([[s*.17,h*.73,z],[s*2.6,3,z-1.4+i*.85]],ropeMat,boat,.022);
   for(let i=0;i<15;i++){
    const y=3+i*(h*.73-3)/15,ratio=(y-3)/(h*.73-3),x=s*(2.6*(1-ratio)+.17*ratio);
    rod([x,y,z-1.4*(1-ratio)],[x,y,z+1.15*(1-ratio)],.012,ropeMat,boat);
   }
  }
  rope([[0,h,z],[0,3,10.5]],ropeMat,boat,.026);
  const flag=mesh(new THREE.PlaneGeometry(1.4,.65,6,3),sailMat,boat,[.65,h-.1,z]);flag.rotation.y=.5;
 }
 rod([0,2.7,8],[0,5.3,16],.16,mastMat,boat,.055);
 rope([[0,15,3.6],[0,5.3,16],[0,1.2,10]],ropeMat,boat,.03);
 const jib=new THREE.BufferGeometry();jib.setAttribute('position',new THREE.Float32BufferAttribute([.05,13.5,4.5,.05,5.3,14.8,.6,5.0,5.5],3));jib.computeVertexNormals();mesh(jib,sailMat,boat);
 // Cabin lanterns, capstan, deck hatches and a wheel keep close views readable.
 for(const s of [-1,1]){
  const lamp=new THREE.MeshStandardMaterial({color:0xc79940,emissive:0xffba44,emissiveIntensity:.25,metalness:.5,roughness:.5});
  rod([s*1.9,3,-8],[s*1.9,4,-8],.035,trimMat,boat);mesh(new THREE.BoxGeometry(.25,.4,.25),lamp,boat,[s*1.9,4,-8]);
 }
 mesh(new THREE.BoxGeometry(1.6,.16,1.9),trimMat,boat,[0,2.29,0]);
 mesh(new THREE.CylinderGeometry(.42,.42,.75,10),mastMat,boat,[0,2.5,7]);
 const wheel=mesh(new THREE.TorusGeometry(.55,.045,6,18),mastMat,boat,[0,4,-5.6]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([0,4,-5.6],[Math.cos(a)*.73,4+Math.sin(a)*.73,-5.6],.025,mastMat,boat);}
 rod([0,3,-5.6],[0,4,-5.6],.09,mastMat,boat);
 boat.scale.setScalar(.9);return boat;
}
