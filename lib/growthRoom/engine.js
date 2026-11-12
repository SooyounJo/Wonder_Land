import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ASSETS } from './assets';
import { CUP_REGIONS, OUTFIT_REGIONS } from './regions';
import { DIAL_MIN, DIAL_MAX, DIAL_LABELS } from './dial';
import { chooseFlower, readAssigned, rememberAssigned } from './assignFlower';
import { OUTFIT_HEIGHT, TEA_HEIGHT, finaleLine, formatHeightDelta, heightDeltas } from './story';
import { allFloorLines, floorPack } from './copy';
import * as roomSfx from './roomSfx';

/**
 * 성장 측정실 3D 장면을 stage 안에 만들고 돌림. 반환된 dispose()로 전부 정리.
 * React 쪽은 onSceneChange로 받은 씬 이름으로 버튼·다이얼 표시를 정함.
 */
export function createGrowthRoom({ stage, dialEl, knob, reasonEl = null, onSceneChange = () => {}, onDialChange = () => {} }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let disposed = false, rafId = 0;
  const listen = (target, type, fn, opts) => target.addEventListener(type, fn, { ...(typeof opts === 'object' ? opts : {}), signal });
  const videos = [], objectURLs = [];
  const makeVideo = () => { const v = document.createElement('video'); videos.push(v); return v; };
  const objectURL = blob => { const u = URL.createObjectURL(blob); objectURLs.push(u); return u; };
  // 언마운트로 중단된 요청은 끝나지 않은 채로 두어 이후 .then/.catch(원본 주소로 재시도)가 돌지 않게 함
  const hold = e => { if (signal.aborted) return new Promise(() => {}); throw e; };
  const fetchBlob = url => fetch(url, { signal }).then(r => ({ ok: r.ok, blob: () => r.blob().catch(hold) }), hold);

  /* ---------- 치수 ---------- */
  let H = 7.87;                           // 프레임 크기: 긴 변을 7.87로 두고 화면 비율에 맞춰 짧은 변 계산
  const RIM = 0.30, LIP = 0.08, CH = 0.025;
  let D = 1.6;                            // 터널 깊이 (씬 전환 때 얕아짐)
  const L = 6;                            // 카메라 거리 (가까울수록 광각 느낌이 강해짐)
  let S = (L + D) / L;
  // 구멍이 화면에서 차지하는 비율(가로/세로). 씬 1에선 구멍이 커지고 깊이가 얕아짐
  // DESIGN: 글자 배치 기준이 된 원래 디자인의 구멍 비율. HOLE0/1: 가로형 실제 구멍 (위아래 면을 얇게)
  const DESIGN={fw:200/420, fh:388/787};
  // 좌우 벽은 세로형과 같은 비율, 위아래 벽은 더 두껍게(구멍 세로를 줄임)
  // 씬 1 구멍은 화면상 16:9 비율(가로·세로 같은 56%)로 → 가로 영상이 거의 잘리지 않고 통째로 보임
  // 첫 화면만 창(구멍)을 작게(46%), 시작 후 모든 씬은 크게(56%). 둘 다 화면상 16:9 → 16:9 영상이 잘리지 않고 통째로 보임.
  // 시작 후엔 창이 커지고 깊이가 얕아지며, 그 뒤로는 씬이 바뀌어도 영상 크기가 그대로 이어짐
  const HOLE0={fw:.46, fh:.46, d:1.6}, HOLE1={fw:.56, fh:.56, d:.75};
  let HOLE_FW=HOLE0.fw, HOLE_FH=HOLE0.fh;
  let W, FW, FH, IW, IH, IY;


  /* ---------- 렌더러 ---------- */
  const renderer = new THREE.WebGLRenderer({antialias:true});
  // 품질 모드: 기본은 '작업용 가벼운 모드'. 주소 끝에 #hq 를 붙이거나 키보드 H 를 누르면 고품질
  let HQ = location.hash==='#hq';
  renderer.setPixelRatio(Math.min(devicePixelRatio, HQ?1.5:1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 빛과 프레임이 그대로면 그림자도 그대로 → 매 프레임 다시 계산하지 않고 필요할 때만 갱신
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  stage.appendChild(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* ---------- 미니멀 오크 텍스처 ---------- */
  function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function periodicNoise(rnd, PX, PY){
    const g = new Float32Array(PX*PY).map(()=>rnd());
    const m = (a,n)=>((a%n)+n)%n;
    return (x,y)=>{
      const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
      const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
      const a=g[m(xi,PX)+m(yi,PY)*PX], b=g[m(xi+1,PX)+m(yi,PY)*PX];
      const c=g[m(xi,PX)+m(yi+1,PY)*PX], d=g[m(xi+1,PX)+m(yi+1,PY)*PX];
      return (a+(b-a)*u)+((c+(d-c)*u)-(a+(b-a)*u))*v;
    };
  }
  // 월넛 텍스처: 휘어진 나이테(늦재 짙은 띠) + 길게 흐르는 색 줄무늬 + 결 방향 물관 + 범프
  // 모든 노이즈를 정수 주기로 맞춰 가로·세로로 끊김 없이 반복
  function makeWood(seed){
    const w=2048, h=512;
    const rnd=mulberry32(seed);
    const nA=periodicNoise(rnd,6,3), nB=periodicNoise(rnd,24,12), nC=periodicNoise(rnd,10,48), nP=periodicNoise(rnd,160,256);
    const col=document.createElement('canvas'); col.width=w; col.height=h;
    const bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const cctx=col.getContext('2d'), bctx=bmp.getContext('2d');
    const ci=cctx.createImageData(w,h), bi=bctx.createImageData(w,h);
    const dark=[158,140,188], mid=[200,184,226], light=[222,210,241], red=[188,168,214];   // 연보라 톤 (기준색 #C8B8E2), 나뭇결은 유지
    const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
    const mix=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
    for(let y=0;y<h;y++){ const v=y/h;
      for(let x=0;x<w;x++){ const u=x/w;
        const warp = nA(u*6,v*3)*1.8 + nB(u*24,v*12)*.4;
        const r = v*9 + warp;
        const f = r-Math.floor(r);
        const late = sm(.5,.82,f)*(1-sm(.9,1,f));        // 늦재: 나이테의 짙은 띠
        const streak = nC(u*10,v*48);                      // 길게 흐르는 색 차이
        const pore = sm(.8,.93,nP(u*160,v*256));           // 결 방향으로 길쭉한 물관
        let c = mix(mid, light, sm(.35,.85,streak));
        c = mix(c, dark, (1-streak)*.35);
        c = mix(c, red, nB(u*24+7,v*12)*.22);
        c = mix(c, dark, late*.4 + pore*.3);
        const i=(y*w+x)*4;
        ci.data[i]=c[0]; ci.data[i+1]=c[1]; ci.data[i+2]=c[2]; ci.data[i+3]=255;
        const b=255*(1-late*.3-pore*.45);
        bi.data[i]=bi.data[i+1]=bi.data[i+2]=b; bi.data[i+3]=255;
      }
    }
    cctx.putImageData(ci,0,0); bctx.putImageData(bi,0,0);
    const map=new THREE.CanvasTexture(col), bump=new THREE.CanvasTexture(bmp);
    map.colorSpace=THREE.SRGBColorSpace;
    for(const t of [map,bump]){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=maxAniso; }
    return {map,bump};
  }
  const woodTex=makeWood(11);
  // 오일 마감 월넛: 반무광 + 얇은 클리어코트
  const woodMat = new THREE.MeshPhysicalMaterial({
    map:woodTex.map, bumpMap:woodTex.bump, bumpScale:.45,
    roughness:.5, metalness:0, clearcoat:.12, clearcoatRoughness:.5, envMapIntensity:.22
  });
  const wallMat = new THREE.MeshStandardMaterial({color:0xefe8d8, roughness:.9, envMapIntensity:.35});

  /* ---------- 연귀 밴드 ---------- */
  const SIDE_OFF = {top:[.13,.07], bottom:[.61,.42], left:[.37,.83], right:[.88,.21]};
  function band(a, b, outward=false){
    const corners = r => ({
      tl:[-r.w/2, r.y+r.h/2, r.z], tr:[ r.w/2, r.y+r.h/2, r.z],
      br:[ r.w/2, r.y-r.h/2, r.z], bl:[-r.w/2, r.y-r.h/2, r.z]
    });
    const A=corners(a), B=corners(b);
    const sides = {
      top:[A.tl,A.tr,B.tr,B.tl,[0,1]], bottom:[A.br,A.bl,B.bl,B.br,[0,-1]],
      left:[A.bl,A.tl,B.tl,B.bl,[-1,0]], right:[A.tr,A.br,B.br,B.tr,[1,0]],
    };
    const pos=[], uv=[], U=.2;
    for(const [name,[p0,p1,p2,p3,o]] of Object.entries(sides)){
      const horiz = name==='top'||name==='bottom';
      const [uo,vo]=SIDE_OFF[name];
      // 텍스처가 4:1 비율이라 결의 수직 방향은 4배로 맞춰 원래 비율 유지
      const uvOf = p => [ (horiz?p[0]:p[1])*U + uo, (-(horiz?Math.abs(p[1]):Math.abs(p[0])) - p[2])*U*4 + vo ];
      let quad=[p0,p1,p2,p3];
      const V=p=>new THREE.Vector3(...p);
      const n=new THREE.Vector3().crossVectors(V(p1).sub(V(p0)), V(p3).sub(V(p0)));
      const c=V(p0).add(V(p2)).multiplyScalar(.5);
      const probe = outward ? c.clone().add(new THREE.Vector3(o[0],o[1],0)) : new THREE.Vector3(0,0,20);
      if(n.dot(probe.sub(c))<0) quad=[p0,p3,p2,p1];
      const [q0,q1,q2,q3]=quad;
      for(const p of [q0,q1,q2, q0,q2,q3]){ pos.push(...p); uv.push(...uvOf(p)); }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.computeVertexNormals();
    const m=new THREE.Mesh(g,woodMat);
    m.castShadow=m.receiveShadow=true;
    return m;
  }

  /* ---------- 텍스트: 캔버스로 그려 경사면 위에 붙임 (실제 원근 왜곡) ---------- */
  const EM = 220;
  const GROTESK = '"Neue Haas Grotesk Display Pro", "Neue Haas Grotesk Text Pro", "Neue Haas Grotesk", "NHaasGroteskDSPro-65Md", "Helvetica Neue", Helvetica, "Inter Tight", "Noto Sans KR", Arial, sans-serif';
  // 메인 영어 서체: Doto (도트 매트릭스, SIL OFL, Google Fonts) 가장 굵은 900. 영문·숫자에 사용, 한글은 그로테스크 계열
  const DISPLAY = '"Doto", '+GROTESK;
  // 한글 서체: 갈무리11
  const KOREAN = '"Galmuri11", '+GROTESK;
  const DOT_STROKE = 220*.008;   // 같은 색 외곽선을 아주 살짝 더해 도트를 조금 더 두툼하게  // 같은 색 외곽선을 살짝만 더해 점이 적당히 도톰하게
  const INK='rgba(255,255,255,.96)', INK_SOFT='rgba(255,255,255,.6)', EMB='rgba(0,0,0,.35)';
  function inked(ctx, fn, soft=false){
    ctx.save(); ctx.translate(0, EM*.035); ctx.fillStyle=ctx.strokeStyle=EMB; fn(); ctx.restore();
    ctx.fillStyle=ctx.strokeStyle = soft?INK_SOFT:INK; fn();
  }
  function spaced(ctx, text, x, y, sp){ for(const ch of text){ fillThick(ctx,ch,x,y); x+=ctx.measureText(ch).width+sp; } return x; }
  // 서체가 Doto일 때만 같은 색 외곽선을 덧그려 획을 두껍게
  function fillThick(ctx,t,x,y){ ctx.fillText(t,x,y); if(DOT_STROKE>0 && ctx.font.includes('Doto')){ ctx.save(); ctx.lineWidth=DOT_STROKE*parseFloat(ctx.font.match(/([\d.]+)px/)[1])/EM; ctx.lineJoin='round'; ctx.strokeText(t,x,y); ctx.restore(); } }
  function spacedWidth(ctx, text, sp){ let w=0; for(const ch of text) w+=ctx.measureText(ch).width+sp; return w-sp; }
  function canvas(w,h){ const c=document.createElement('canvas'); c.width=Math.ceil(w); c.height=Math.ceil(h); return [c,c.getContext('2d')]; }

  function titleCanvas(){
    // 두 줄: 큰 GROWTH + 작은 MEASUREMENT ROOM. 글자가 윗면의 깊이 방향으로 길게 걸쳐 있어
    // 앞(화면 위)은 넓고 안쪽(화면 아래)은 좁아지는 원근 왜곡이 뚜렷하게 보임
    const f1=`900 ${EM}px ${DISPLAY}`, sp1=EM*.04, t1='GROWTH';
    const f2=`900 ${EM*.3}px ${DISPLAY}`, sp2=EM*.12, t2='MEASUREMENT ROOM';
    let [c,ctx]=canvas(10,10);
    ctx.font=f1; const w1=spacedWidth(ctx,t1,sp1);
    ctx.font=f2; const w2=spacedWidth(ctx,t2,sp2);
    const cw=Math.max(w1,w2)+EM*.4;
    [c,ctx]=canvas(cw, EM*1.42);
    ctx.textBaseline='middle';
    inked(ctx,()=>{
      ctx.font=f1; spaced(ctx,t1,(cw-w1)/2,EM*.55,sp1);
      ctx.font=f2; spaced(ctx,t2,(cw-w2)/2,EM*1.17,sp2);   // 두 줄을 바짝 붙임
    });
    return c;
  }
  function heightLogLines(clear=false){
    if(clear) return [];
    return heightDeltas(picks).map(formatHeightDelta);
  }
  function heightCanvas(reuse=null, clear=false){
    // HEIGHT 아래에는 직전 대비 변화. 늘어나면 +36, 줄어들면 -36
    const f=`900 ${EM}px ${DISPLAY}`, sp=EM*.08, lh=EM*1.48;
    const body=heightLogLines(clear);
    const lines=['HEIGHT', ...(body.length ? body : ['---'])];
    const [, m]=canvas(10,10); m.font=f;
    const cw=Math.max(...['HEIGHT','---','+000','-000'].map(t=>spacedWidth(m,t,sp)))+EM*.5;
    const [c,ctx]= reuse ? [reuse, reuse.getContext('2d')] : canvas(cw, lh*5+EM*.3);
    ctx.clearRect(0,0,c.width,c.height);
    ctx.textBaseline='middle';
    const ws=lines.map(t=>{ ctx.font=f; return spacedWidth(ctx,t,sp); });
    inked(ctx,()=>{ ctx.font=f; lines.forEach((t,i)=>spaced(ctx,t,(c.width-ws[i])/2, EM*.15+lh*(i+.5), sp)); });
    return c;
  }
  let shownH='';
  let reasonTimer=0;
  function hideHeightReason(){
    if(reasonTimer){ clearTimeout(reasonTimer); reasonTimer=0; }
    if(reasonEl) reasonEl.removeAttribute('data-on');
  }
  function setHeightPicks(clear=false){
    const d=textDefs && textDefs.find(x=>x.key==='height');
    const sig=['HEIGHT', ...(clear ? ['---'] : heightLogLines())].join('|');
    if(!d || sig===shownH) return;
    shownH=sig;
    heightCanvas(d.canvas, clear);
    d.mat.map.needsUpdate=true;
  }
  function leftCanvas(num='00', reuse=null){
    // reuse: 이미 만든 캔버스에 다시 그릴 때(씬 번호 교체)
    const [c,ctx]= reuse ? [reuse, reuse.getContext('2d')] : canvas(EM*4.9, EM*3.6);
    ctx.clearRect(0,0,c.width,c.height);
    ctx.textBaseline='top';
    inked(ctx,()=>{ ctx.font=`900 ${EM*1.7}px ${DISPLAY}`; fillThick(ctx,num, EM*.1, EM*.05); });
    // 손으로 그린 듯한 화살표: 액자(구멍) 쪽을 가리킴. 살짝 흔들리는 선을 두 번 겹쳐 그려 펜 느낌
    const jr=mulberry32(9), J=()=>(jr()-.5)*EM*.045;
    const A=[EM*.25,EM*2.75], C=[EM*2.2,EM*3.15], B=[EM*4.4,EM*2.35];
    const bez=t=>[(1-t)*(1-t)*A[0]+2*(1-t)*t*C[0]+t*t*B[0], (1-t)*(1-t)*A[1]+2*(1-t)*t*C[1]+t*t*B[1]];
    const shaft=[...Array(26)].map((_,i)=>{ const [x,y]=bez(i/25); return [x+J(),y+J()]; });
    const [tx,ty]=bez(1), [px,py]=bez(.94), ang=Math.atan2(ty-py,tx-px), hl=EM*.85;
    const head=s=>[[tx+Math.cos(ang+Math.PI-s)*hl+J(), ty+Math.sin(ang+Math.PI-s)*hl+J()],[tx,ty],];
    const stroke=(pts,w)=>{ ctx.lineWidth=w; ctx.lineCap=ctx.lineJoin='round'; ctx.beginPath();
      pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); };
    inked(ctx,()=>{
      stroke(shaft,EM*.13);
      stroke(head(.48),EM*.13); stroke(head(-.52),EM*.13);
    });
    inked(ctx,()=>{ ctx.save(); ctx.translate(EM*.03,-EM*.03);
      stroke(shaft.map(([x,y])=>[x+J()*.6,y+J()*.6]),EM*.05); ctx.restore(); }, true);
    return c;
  }
  function stepsCanvas(){
    const bw=EM*1.05, bh=EM*1.15, gap=EM*.38;
    const [c,ctx]=canvas(EM*1.5, bh*3+gap*2+EM*.4);
    const x=(c.width-bw)/2;
    for(let i=0;i<3;i++){
      const y=EM*.2+i*(bh+gap);
      inked(ctx,()=>{ ctx.lineWidth=EM*.05; ctx.setLineDash([EM*.12,EM*.08]); ctx.strokeRect(x,y,bw,bh); ctx.setLineDash([]); }, true);
      inked(ctx,()=>{ ctx.font=`900 ${EM*.42}px ${DISPLAY}`; ctx.textAlign='center'; ctx.textBaseline='middle'; fillThick(ctx,String(i+1), x+bw/2, y+bh/2); }, true);
    }
    return c;
  }
  function textMaterial(c){
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=maxAniso;
    // 그늘 면에서도 흰 글자가 회색으로 가라앉지 않도록 자체 밝기(emissive)를 더함
    return new THREE.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, emissiveIntensity:.8,
      transparent:true, depthWrite:false, roughness:.8,
      polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  }
  let textDefs = null;

  // 아래쪽 문구. 패드에서 고른 언어를 따른다
  let lang='ko';
  const pack=()=>floorPack(lang);
  function questionCanvas(lines=pack().teaDefault, reuse=null){
    // 최대 두 줄, 가운데 정렬. 한국어·영어 중 가장 긴 문구 기준으로 크기를 고정
    const font=`700 ${EM}px ${KOREAN}`, sp=EM*.02, lh=EM*1.45;
    const [, m]=canvas(10,10); m.font=font;
    const all=allFloorLines();
    const cw=Math.max(...all.map(t=>spacedWidth(m,t,sp)))+EM*.4;
    const [c,ctx]= reuse ? [reuse, reuse.getContext('2d')] : canvas(cw, lh*2+EM*.3);
    ctx.clearRect(0,0,c.width,c.height);
    ctx.textBaseline='middle'; ctx.font=font;
    const y0=(c.height-lh*lines.length)/2;
    ctx.fillStyle='rgba(20,14,8,1)';
    lines.forEach((t,i)=>spaced(ctx,t,(c.width-spacedWidth(ctx,t,sp))/2, y0+lh*(i+.5), sp));
    return c;
  }
  let shownQ='';
  function setQ(id, lines){
    const key=id+'|'+lang;
    if(key===shownQ) return;
    const qd=textDefs && textDefs.find(d=>d.key==='question');
    if(!qd) return;
    shownQ=key;
    questionCanvas(lines, qd.canvas);
    qd.mat.map.needsUpdate=true;
  }
  function setQuestion(i){ const p=pack(); setQ('tea'+i, i<0?p.teaDefault:p.teas[i]); }
  function setLang(next){ if(next==='ko'||next==='en') lang=next; }

  /* 디자인(472×842 기준) 좌표 → 경사면 위 3D 점과 면의 방향 */
  const lerp=(a,b,t)=>a+(b-a)*t;
  function solve(f, target){ let lo=0,hi=1; const dec=f(0)>f(1); for(let i=0;i<40;i++){const m=(lo+hi)/2; if((f(m)>target)===dec) lo=m; else hi=m;} return (lo+hi)/2; }
  const app=(v,z)=>v*L/(L-z);
  function wallPlacement(side, px, py){
    let tx=(px-234)/420*W, ty=-(py-421.5)/787*H;
    const iya=H*(3.5/787);
    if(side==='top'||side==='bottom'){
      const s=side==='top'?1:-1, front=s*FH/2;
      const b0=iya+s*H*DESIGN.fh/2, b1=iya+s*H*HOLE_FH/2;
      ty=front-(front-ty)*(front-b1)/(front-b0);
    }else{
      const s=side==='right'?1:-1, front=s*FW/2;
      const b0=s*W*DESIGN.fw/2, b1=s*W*HOLE_FW/2;
      tx=front-(front-tx)*(front-b1)/(front-b0);
    }
    let p, xAxis, yAxis;
    if(side==='top'||side==='bottom'){
      const s = side==='top'?1:-1;
      const y0=s*FH/2, y1=IY+s*IH/2;
      const yAt=t=>lerp(y0,y1,t);
      const t=solve(t=>app(yAt(t),-D*t), ty);
      p=new THREE.Vector3(tx*(L+D*t)/L, yAt(t), -D*t);
      xAxis=new THREE.Vector3(1,0,0);
      yAxis= side==='top' ? new THREE.Vector3(0,y0-y1,D).normalize()      // 위 면: 글자 윗쪽이 앞(바깥)으로
                          : new THREE.Vector3(0,y1-y0,-D).normalize();    // 아래 면: 글자 윗쪽이 안쪽으로
    }else{
      const s = side==='right'?1:-1;
      const x0=s*FW/2, x1=s*IW/2;
      const xAt=t=>lerp(x0,x1,t);
      const t=solve(t=>app(xAt(t),-D*t), tx);
      p=new THREE.Vector3(xAt(t), ty*(L+D*t)/L, -D*t);
      yAxis=new THREE.Vector3(0,1,0);
      xAxis= side==='left' ? new THREE.Vector3(x1-x0,0,-D).normalize()
                           : new THREE.Vector3(x0-x1,0,D).normalize();
    }
    const n=new THREE.Vector3().crossVectors(xAxis,yAxis).normalize();
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis,yAxis,n));
    return {p:p.add(n.clone().multiplyScalar(.004)), q};
  }

  /* ---------- 프레임/벽 조립 (화면 비율이 바뀌면 다시 생성) ---------- */
  let frame=null;
  function build(aspect){
    renderer.shadowMap.needsUpdate = true;   // 프레임 모양이 바뀌면 그림자 다시 계산
    if(frame){ scene.remove(frame); frame.traverse(o=>o.geometry&&o.geometry.dispose()); }
    if(aspect>=1){ W=7.87; H=W/aspect; } else { H=7.87; W=H*aspect; }
    FW=W-RIM*2; FH=H-RIM*2;
    S=(L+D)/L;
    IW=W*HOLE_FW*S; IH=H*HOLE_FH*S; IY=H*(3.5/787)*S;
    const R=(w,h,z,y=0)=>({w,h,z,y});
    frame=new THREE.Group();
    frame.add(
      band(R(W,H,-D),            R(W,H,LIP-CH), true),
      band(R(W,H,LIP-CH),        R(W-2*CH,H-2*CH,LIP)),
      band(R(W-2*CH,H-2*CH,LIP), R(FW+2*CH,FH+2*CH,LIP)),
      band(R(FW+2*CH,FH+2*CH,LIP), R(FW,FH,LIP-CH)),
      band(R(FW,FH,LIP-CH),      R(FW,FH,0)),
      band(R(FW,FH,0),           R(IW,IH,-D,IY)),
    );
    // 앞 벽 (프레임과 같은 면, 프레임 크기만큼 뚫림)
    const sh=new THREE.Shape([new THREE.Vector2(-30,-30),new THREE.Vector2(30,-30),new THREE.Vector2(30,30),new THREE.Vector2(-30,30)]);
    sh.holes.push(new THREE.Path([new THREE.Vector2(-W/2,-H/2),new THREE.Vector2(-W/2,H/2),new THREE.Vector2(W/2,H/2),new THREE.Vector2(W/2,-H/2)]));
    const wall=new THREE.Mesh(new THREE.ShapeGeometry(sh), wallMat);
    wall.castShadow=wall.receiveShadow=true;
    frame.add(wall);
    // 텍스트
    if(textDefs){
      const fs=Math.min(1, Math.min(W,H)/4.72);      // 짧은 변 기준으로 글자 크기 유지
      for(const d of textDefs){
        const {p,q}=wallPlacement(d.side,d.px,d.py);
        // 제목: 두 번째 씬부터는 절반 크기로 (전환에 맞춰 부드럽게 줄어듦)
        const tScale = d.key==='title' ? lerp(1,.5,holeP*holeP*(3-2*holeP)) : 1;
        const k=d.size*fs/EM*tScale;
        // stretch: 세로 비율, widen: 가로 비율, keystone: 윗변(앞쪽)을 넓히고 아랫변(안쪽)을 좁히는 사다리꼴 변형
        const rTB=(FH/2-H*HOLE_FH/2)/(FH/2-H*DESIGN.fh/2), rLR=(FW/2-W*HOLE_FW/2)/(FW/2-W*DESIGN.fw/2);
        const horiz=d.side==='top'||d.side==='bottom';
        const gh=d.canvas.height*k*d.stretch*(horiz?(d.fit?Math.min(1,rTB):Math.min(1,.45+rTB*.7)):1);
        const g=new THREE.PlaneGeometry(d.canvas.width*k*d.widen*(horiz?1:Math.min(1,.45+rLR*.7)), gh, 32, 8);
        if(d.keystone){
          const p=g.attributes.position;
          for(let i=0;i<p.count;i++) p.setX(i, p.getX(i)*(1 + d.keystone*p.getY(i)/(gh/2)));
        }
        const m=new THREE.Mesh(g, d.mat);
        m.position.copy(p); m.quaternion.copy(q); m.receiveShadow=true;
        frame.add(m);
      }
    }
    scene.add(frame);
  }

  // 뒤 벽: 빛이 들어오는 밝은 공간. 광원 쪽(왼쪽 위)이 더 밝은 그라디언트
  function backGradient(){
    const c=document.createElement('canvas'); c.width=c.height=512;
    const g=c.getContext('2d');
    const r=g.createRadialGradient(150,120,10, 200,180,520);
    r.addColorStop(0,'#2b2723'); r.addColorStop(.45,'#141210'); r.addColorStop(1,'#060606');
    g.fillStyle=r; g.fillRect(0,0,512,512);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }
  /* 영상·사진을 원본 색 그대로: 마지막 단계의 톤매핑(ACES, 노출 1.2)이 영상에도 걸려 밝고 뿌옇게 보였음.
     영상/사진 판에서는 그 톤매핑을 미리 거꾸로 적용해 두어, 최종 화면에서 원본 색이 나오게 함 */
  const INV_ACES_GLSL=`
  // 영상 텍스처는 sRGB 값 그대로 올라오므로 직접 짠 셰이더에서는 선형으로 바꿔줘야 함 (안 하면 뿌옇고 밝아 보임)
  vec3 srgb2lin(vec3 c){ return mix(pow(c*.9478672986+vec3(.0521327014),vec3(2.4)), c*.0773993808, vec3(lessThanEqual(c,vec3(.04045)))); }
  vec3 dec(vec3 c, float isVideo){ return isVideo>.5 ? srgb2lin(c) : c; }
  vec3 invACES(vec3 c){
    const mat3 iOut=mat3(0.643038,0.059269,0.005962, 0.311187,0.931436,0.063929, 0.045775,0.009295,0.930118);
    const mat3 iIn =mat3(1.764741,-0.147028,-0.036337, -0.675778,1.160252,-0.162436, -0.088963,-0.013224,1.198773);
    vec3 y=clamp(iOut*clamp(c,0.,.985),0.,.99);
    vec3 a=1.-0.983729*y, b=0.0245786-0.432951*y, k=-(0.000090537+0.238081*y);
    vec3 v=(-b+sqrt(max(b*b-4.*a*k,0.)))/(2.*a);
    return max(iIn*v,0.)/(1.2/0.6);
  }
  `;
  const PLANE_VERT=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  // 두 장면(A 영역 확대 가능)을 흐림과 함께 섞는 판. 자판기 줌·영상 이어 붙이기에 씀
  const BLEND_FRAG=INV_ACES_GLSL+`uniform sampler2D texA; uniform sampler2D texB; uniform vec4 rectA; uniform float mixB, blurA, blurB, vidA, vidB; varying vec2 vUv;
    // 원형으로 흩뿌린 샘플을 평균 내는 간단한 블러 (r: 흐림 반경, 텍스처 좌표 기준)
    // 화면에 보이는 밝기(감마) 기준으로 평균 → 흐려질 때 화면이 뿌옇게 밝아지지 않음
    vec3 blurTex(sampler2D t, vec2 uv, float r, float v){
      vec3 c=pow(dec(texture2D(t,uv).rgb,v), vec3(1./2.2)); float w=1.;
      if(r>.0005){
        for(int i=0;i<16;i++){
          float a=float(i)*2.39996, d=sqrt((float(i)+.5)/16.)*r;
          c+=pow(dec(texture2D(t, uv+vec2(cos(a),sin(a)*1.7778)*d).rgb,v), vec3(1./2.2)); w+=1.;
        }
      }
      return pow(c/w, vec3(2.2));
    }
    void main(){
      vec3 a=blurTex(texA, rectA.xy+vUv*rectA.zw, blurA, vidA);
      vec3 b=blurTex(texB, vUv, blurB, vidB);
      gl_FragColor=vec4(invACES(mix(a,b,mixB)),1.);
    }`;
  function rawColor(mat){
    mat.onBeforeCompile=sh=>{
      sh.fragmentShader=INV_ACES_GLSL+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n  diffuseColor.rgb=invACES(diffuseColor.rgb);');
    };
    return mat;
  }
  let bgVideo=null, bgPlane=null;
  let sceneState='loop';            // loop: 첫 영상 반복 / next: 다음 영상 재생 중 / done: 다음 영상 끝(마지막 프레임 유지)
  let remoteHover=()=>{}, remoteSelect=()=>{}, remoteDial=()=>{}, remoteDialSelect=()=>{}, getDial=()=>1;
  // 이번 회차에 고른 것들 (마지막 카드용). 번호는 각 선택지 순서, -1 = 아직 안 고름
  const picks={tea:-1, outfit:-1, snack:-1, time:-1, flower:-1};
  let playNextScene=()=>{}, backToLoop=()=>{}, updateCrossfade=()=>{}, updateCups=()=>{}, updateScene2=()=>{}, updateDim=()=>{}, updateScene3=()=>{}, resetScene3=()=>{}, updateScene4=()=>{}, updateApproach=()=>{}, resetApproach=()=>{};
  let tinyT0=0;

  // 다음 씬에서는 터널(프레임 깊이)이 살짝 얕아짐 → 창가가 더 가까이 다가오는 느낌
  const NEXT_DEPTH=.45;
  const ZOOM_OUT=1;            // 전환·씬 1에서도 영상은 구멍(앞 프레임)에 딱 맞게
  let bgBlur=null;
  // 흐린 배경: 현재 영상을 아주 작게 줄였다 키워 부드럽게 번지게 함
  const blurSmall=document.createElement('canvas'); blurSmall.width=10; blurSmall.height=18;
  const blurBig=document.createElement('canvas'); blurBig.width=40; blurBig.height=72;
  const blurSX=blurSmall.getContext('2d'), blurBX=blurBig.getContext('2d');
  const blurTex=new THREE.CanvasTexture(blurBig); blurTex.colorSpace=THREE.SRGBColorSpace;
  function updateBlur(){
    if(!bgBlur || !bgBlur.visible) return;
    // 영상이 아직 준비 전이면 지금 판에 보이는 이미지(첨 프레임)로
    const src=(bgVideo && bgVideo.readyState>=2) ? bgVideo : (bgPlane && bgPlane.material.map && bgPlane.material.map.image);
    if(!src) return;
    try{
      blurSX.drawImage(src,0,0,10,18);
      blurBX.imageSmoothingEnabled=true; blurBX.drawImage(blurSmall,0,0,40,72);
      blurTex.needsUpdate=true;
    }catch(e){}
  }
  // 구멍과 영상 판 사이 간격: 평소엔 구멍에 거의 붙여(0.02) 시점이 움직여도 어긋남이 없게 → 확대 없이 영상 전체가 보임.
  // 종이비행기가 프레임 뒤로 숨어야 할 때만 잠깐 띄움(0.45)
  let vidGap=.02;
  let depthS=1, holeP=0, builtP=0, vidShift=0;
  const SCENE1_ZOOM=0;           // 씬 1 추가 확대 없음 (가능한 한 멀리 보이게)
  function applyDepth(dt){
    // holeP: 0 = 씬 0 (깊은 터널, 작은 구멍) → 1 = 씬 1 (얕은 터널, 큰 구멍)
    const target = sceneState==='loop' ? 0 : 1;
    holeP += (target-holeP)*Math.min(1, dt*1.4);
    if(Math.abs(target-holeP)<1e-4) holeP=target;
    if(Math.abs(holeP-builtP)>1e-3 || (holeP===target && builtP!==target)){
      const e=holeP*holeP*(3-2*holeP);
      D=lerp(HOLE0.d,HOLE1.d,e); HOLE_FW=lerp(HOLE0.fw,HOLE1.fw,e); HOLE_FH=lerp(HOLE0.fh,HOLE1.fh,e);
      if(aspect){ build(aspect); placeHoleLights(); }
      builtP=holeP;
    }
    depthS=1;
    const holeZ=-D;
    if(bgPlane){
      // 씬 0: 영상 판을 구멍 폭에 딱 맞춤
      // 전환·씬 1: 프레임이 얕아지는 것과 함께 영상이 더 작아지며 줌아웃,
      //   빈 가장자리는 같은 영상을 흐리게 키운 배경으로 채움
      const k=holeP;
      const shrink=1-(1-ZOOM_OUT)*(k*k*(3-2*k));
      // 영상 판을 구멍 뒤로 조금 띄워 둠 → 종이비행기가 구멍을 지나 프레임 뒤로 꺾어 숨을 공간.
      // 떨어진 만큼 원근으로 작아지니 그만큼 키워서, 화면상 구멍을 빈틈없이 덮게 함
      vidGap+=((flight?.45:.02)-vidGap)*Math.min(1,dt*3);
      const gap=vidGap, persp=(L+D+gap)/(L+D);
      bgPlane.position.z=holeZ-gap;
      // 판 비율은 16:9로 고정. 영상마다 실제 비율(832×464, 1280×720 등)을 따르면 영상이 바뀌는 순간 판 크기가 미세하게 튐
      const aspect=16/9;
      const BHg=bgPlane.geometry.parameters.height, BWg=bgPlane.geometry.parameters.width;
      // 영상 가장자리가 보이지 않을 만큼만 확대. 씬 1은 여유를 최소로 줄여 최대한 줌아웃
      // 가장자리가 보이지 않을 최소한만 확대
      // 영상 판이 구멍에 붙어 있으면 거의 확대할 필요가 없음 (띄워져 있을 때만 시점 이동 여유만큼)
      const mg=1.008+gap*.09;
      // 씬 1(테이블)에서는 영상을 살짝 키워 아래로 내림 (부드럽게 전환)
      const vsTarget=(sceneState==='scene1'||sceneState==='height') ? 1 : 0;
      vidShift+=(vsTarget-vidShift)*Math.min(1,dt*1.5);
      const g=Math.max(IW*persp*mg/(BHg*aspect), IH*persp*mg/BHg)*shrink*(1+SCENE1_ZOOM*vidShift);
      bgPlane.scale.set(g*aspect*BHg/BWg, g, 1);
      // 세로 영상이 가로 구멍에 들어가면 위아래가 잘리므로, 영상의 주인공(위에서 45% 지점)이 구멍 중앙에 오도록
      const hp=bgPlane.geometry.parameters.height*g/2, hh=IH*persp*mg/2;
      const off=lerp(THREE.MathUtils.clamp(-hp*(1-2*.45), -(hp-hh), hp-hh), -(hp-hh)*.95, vidShift);
      bgPlane.position.y=IY+off;
      if(bgBlur){
        bgBlur.visible=ZOOM_OUT<1 && k>.001;
        bgBlur.position.set(0,IY,holeZ-.1);
        const gb=(IW*1.3)/bgBlur.geometry.parameters.width;
        bgBlur.scale.set(gb,gb,1);
      }
    }
    holeSky.position.z=holeGrass.position.z=holeZ-.02;
  }

  // 왼쪽 씬 번호: 씬이 바뀔 때 숫자가 잠깐 드르륵 섞였다가 새 번호에서 멈춤
  let numTimer=null;
  let shownNumber='00';
  function setSceneNumber(n){
    // 선택 씬만 센다: 차 1 · 옷 2 · 과자 3 · 라디오 4
    n=Math.max(0, Math.min(4, n));
    const def=textDefs && textDefs.find(d=>d.key==='left');
    const v=String(n).padStart(2,'0');
    if(!def || v===shownNumber) return;
    shownNumber=v;
    leftCanvas(v, def.canvas);
    def.mat.map.needsUpdate=true;
  }
  /* ---------- 구멍 너머: 배경 사진 ---------- */
  // 터널 뒤 깊숙이 사진 한 장을 세워 둠. 시점이 움직이면 깊이만큼 시차가 생김
  const BACK_POSTER=ASSETS.poster;
  const BACK_VIDEO=ASSETS.video.opening;   // 가로형 오프닝: 분홍 구름 길, 832×464 → 60fps 보간본
  const NEXT_VIDEO=ASSETS.video.intro;   // 가로형 전환: 분홍 구름 길 → 초록 벽 테이블, 1280×720 6초 → 60fps 보간본
  const SCENE1_VIDEO=ASSETS.video.table;   // 가로형 씬 1: 초록 벽 테이블 위 세 잔, 60fps 보간본
  scene.background=new THREE.Color(0x0a0a0a);
  {
    // 영상이 재생되기 전까지는 첫 프레임을 보여주고, 재생되면 영상 텍스처로 교체
    const img=new Image(), tex=new THREE.Texture(img);
    img.onload=()=>{ tex.needsUpdate=true; };
    img.src=BACK_POSTER;
    tex.colorSpace=THREE.SRGBColorSpace;
    const video=bgVideo=makeVideo();
    Object.assign(video,{muted:true, loop:true, playsInline:true, autoplay:true, preload:'auto'});
    video.setAttribute('muted',''); video.setAttribute('playsinline','');
    const vtex=new THREE.VideoTexture(video);
    vtex.colorSpace=THREE.SRGBColorSpace;
    video.addEventListener('playing',()=>{ back.material.map=vtex; back.material.needsUpdate=true; },{once:true});
    const tryPlay=()=>{ if(sceneState==='loop') video.play().catch(()=>{}); };
    // 서버가 구간 요청을 지원하지 않으면 브라우저가 처음으로 되감지 못해 반복이 멈춤
    // → 영상을 통째로 받아 메모리(blob)에서 재생하고, 실패하면 원본 주소로
    let usedDirect=false;
    const useDirect=()=>{ if(usedDirect) return; usedDirect=true; video.src=BACK_VIDEO; tryPlay(); };
    video.addEventListener('error',useDirect);
    fetchBlob(BACK_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ video.src=objectURL(b); tryPlay(); })
      .catch(useDirect);
    // 끝에 도달하면 직접 처음으로 돌려 다시 재생 (loop 속성 보조)
    video.addEventListener('ended',()=>{ video.currentTime=0; tryPlay(); });
    video.addEventListener('pause',()=>{ if(video.ended || (video.duration && video.currentTime>=video.duration-.05)){ video.currentTime=0; tryPlay(); } });
    // 자동재생이 막힌 환경에선 첫 터치/클릭 때 재생
    listen(window,'pointerdown',tryPlay,{once:true});
    listen(document,'visibilitychange',()=>{ if(!document.hidden) tryPlay(); });
    // 영상 판을 구멍 바로 뒤로 당기고 크기를 줄여, 구멍 안에 영상이 더 넓게(줌아웃) 보이도록
    const BH=5.75, BW=BH*0.5577;
    const back=new THREE.Mesh(new THREE.PlaneGeometry(BW,BH),
      rawColor(new THREE.MeshBasicMaterial({map:tex, toneMapped:false})));
    back.position.set(0, .03, -D-.45);
    scene.add(back);
    bgPlane=back;
    bgBlur=new THREE.Mesh(new THREE.PlaneGeometry(BW,BH), new THREE.MeshBasicMaterial({map:blurTex, color:0xb8b8b8, toneMapped:false}));
    bgBlur.visible=false;
    scene.add(bgBlur);

    /* ----- 영상 이어 붙이기 -----
       맞닿는 두 프레임은 같게 만들어도 미세하게 달라, 움직이는 채로 바꾸면 크기·상태가 튀어 보임.
       → 나가는 영상을 멈춰 잠깐 머물고, 들어올 영상의 첫 프레임(정지)으로 살짝 흐려지며 넘어간 뒤
         그 프레임에서 한 번 더 머물렀다가 재생 */
    const HANDOFF={holdOut:250, blend:650, holdIn:500, blur:.006};
    const handoffMat=new THREE.ShaderMaterial({
      uniforms:{texA:{value:null}, texB:{value:null}, rectA:{value:new THREE.Vector4(0,0,1,1)}, mixB:{value:0}, blurA:{value:0}, blurB:{value:0}, vidA:{value:0}, vidB:{value:0}},
      vertexShader:PLANE_VERT, fragmentShader:BLEND_FRAG, toneMapped:false, depthWrite:false});
    const handoffPlane=new THREE.Mesh(back.geometry, handoffMat);
    handoffPlane.visible=false; handoffPlane.renderOrder=6; scene.add(handoffPlane);
    let handoff=null;
    // 영상을 멈춘 채 at 지점 프레임이 실제로 준비되면 cb (준비 전에 바꾸면 검은 화면이 깜빡임)
    const showFrame=(v,tex,at,cb)=>{
      v.pause();
      const done=()=>{ tex.needsUpdate=true; cb(); };
      const seek=()=>{
        if(Math.abs(v.currentTime-at)<.001 && v.readyState>=2){ done(); return; }
        v.addEventListener('seeked',()=>{ v.readyState>=2 ? done() : v.addEventListener('loadeddata',done,{once:true}); },{once:true});
        v.currentTime=at;
      };
      v.readyState>=1 ? seek() : v.addEventListener('loadedmetadata',seek,{once:true});
    };
    function handoffTo({to, tex, from=bgVideo, fromTex=back.material.map, at=0, play=true, onSwap, onDone}){
      if(from && from!==to) from.pause();
      const h=handoff={t0:performance.now(), ready:false, blendT0:0, swapped:false, to, tex, play, onSwap, onDone};
      handoffMat.uniforms.texA.value=fromTex;
      handoffMat.uniforms.vidA.value=fromTex && fromTex.isVideoTexture ? 1 : 0;
      showFrame(to, tex, at, ()=>{ if(handoff===h) h.ready=true; });
    }
    const cancelHandoff=()=>{ handoff=null; handoffPlane.visible=false; };
    const updateHandoff=now=>{
      const h=handoff; if(!h) return;
      handoffPlane.position.copy(back.position); handoffPlane.position.z+=.007; handoffPlane.scale.copy(back.scale);
      if(!h.ready || now-h.t0<HANDOFF.holdOut) return;
      if(!h.blendT0){
        h.blendT0=now;
        handoffMat.uniforms.texB.value=h.tex; handoffMat.uniforms.vidB.value=1;
        handoffPlane.visible=true;
      }
      const t=Math.min(1,(now-h.blendT0)/HANDOFF.blend);
      const blur=Math.sin(t*Math.PI)*HANDOFF.blur;    // 가운데에서 가장 흐려져 두 장면의 차이를 덮음
      handoffMat.uniforms.mixB.value=t*t*(3-2*t);
      handoffMat.uniforms.blurA.value=handoffMat.uniforms.blurB.value=blur;
      if(t<1) return;
      if(!h.swapped){
        h.swapped=true;
        back.material.map=h.tex; back.material.needsUpdate=true; bgVideo=h.to;
        handoffPlane.visible=false;
        h.onSwap && h.onSwap();
      }
      if(now-h.blendT0-HANDOFF.blend<HANDOFF.holdIn) return;
      handoff=null;
      if(h.play) h.to.play().catch(()=>{});
      h.onDone && h.onDone();
    };

    // 다음 장면 영상: 시작 버튼을 누르면 재생, 한 번만 재생하고 마지막 프레임에서 멈춤
    // (첫 영상과 같은 구도에서 시작해 창가 장면으로 빠지므로 자연스럽게 이어짐)
    const nv=makeVideo();
    Object.assign(nv,{muted:true, loop:false, playsInline:true, preload:'auto'});
    nv.setAttribute('muted',''); nv.setAttribute('playsinline','');
    const ntex=new THREE.VideoTexture(nv);
    ntex.colorSpace=THREE.SRGBColorSpace;
    fetchBlob(NEXT_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ nv.src=objectURL(b); nv.load(); })
      .catch(()=>{ nv.src=NEXT_VIDEO; nv.load(); });
    // 씬 1 반복 영상: 전환 영상이 끝나면 이어서 계속 반복 (전환 영상 마지막 프레임과 같은 구도)
    const sv=makeVideo();
    Object.assign(sv,{muted:true, loop:true, playsInline:true, preload:'auto'});
    const SCENE1_RATE=.6;           // 씬 1 영상 재생 속도 (1 = 원래 속도)
    sv.defaultPlaybackRate=SCENE1_RATE; sv.playbackRate=SCENE1_RATE;
    sv.addEventListener('loadedmetadata',()=>{ sv.playbackRate=SCENE1_RATE; });
    sv.addEventListener('play',()=>{ sv.playbackRate=SCENE1_RATE; });
    sv.setAttribute('muted',''); sv.setAttribute('playsinline','');
    const stex=new THREE.VideoTexture(sv);
    stex.colorSpace=THREE.SRGBColorSpace;
    fetchBlob(SCENE1_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ sv.src=objectURL(b); sv.load(); })
      .catch(()=>{ sv.src=SCENE1_VIDEO; sv.load(); });
    const playScene1=()=>{ if(sceneState==='scene1' && !handoff) sv.play().catch(()=>{}); };
    sv.addEventListener('ended',()=>{ sv.currentTime=0; playScene1(); });
    sv.addEventListener('pause',()=>{ if(sv.ended || (sv.duration && sv.currentTime>=sv.duration-.05)){ sv.currentTime=0; playScene1(); } });
    listen(document,'visibilitychange',()=>{ if(!document.hidden) playScene1(); });
    // 전환 영상이 끝나면(마지막 프레임에서 멈춘 채) 씬 1 영상으로 이어 붙임. 안내 문구·번호는 바뀌는 순간 등장
    nv.addEventListener('ended',()=>{
      if(sceneState!=='next' || handoff) return;
      handoffTo({to:sv, tex:stex, from:nv, onSwap:()=>{ sceneState='scene1'; setSceneNumber(1); }});
    });
    // 씬 1의 세 잔: 영상에서 각 잔 부분만 잘라 같은 자리에 겹쳐 둔 판.
    // 마우스를 올리면 그 판이 앞으로 살짝 나오며 커져서 잔이 튀어나와 보임 (가장자리는 부드럽게 사라짐)
    // 영상 좌표(u0,v0,u1,v1)와 잔 모양 마스크(잔·손잡이·꽃 윤곽을 따라 그린 뒤 가장자리를 부드럽게 흐림)
    // 왼쪽부터 캐모마일·자스민·라벤더
    const CUP_DATA=CUP_REGIONS;
    const CUP_RECTS=CUP_DATA.map(d=>d.rect);
    const maskLoader=new THREE.TextureLoader();
    const cupMeshes=CUP_RECTS.map((r,ci)=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.ShaderMaterial({
        uniforms:{map:{value:stex}, mask:{value:maskLoader.load(CUP_DATA[ci].mask)}, rect:{value:new THREE.Vector4(...r)}, hover:{value:0}, isVid:{value:1}},
        vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader:INV_ACES_GLSL+`uniform sampler2D map; uniform sampler2D mask; uniform vec4 rect; uniform float hover; uniform float isVid; varying vec2 vUv;
          void main(){
            vec2 uv=mix(rect.xy, rect.zw, vUv);
            vec3 c=invACES(min(dec(texture2D(map,uv).rgb,isVid)*(1.+.035*hover), vec3(.97)));   // 원본 색 기준으로 아주 살짝만 밝게 (하이라이트가 하얗게 날아가지 않게)
            float a=texture2D(mask,vUv).r;              // 잔 모양대로만 보이게
            gl_FragColor=vec4(c, a*min(1.,hover*4.));
          }`,
        transparent:true, depthWrite:false, toneMapped:false}));
      m.visible=false; m.renderOrder=2; scene.add(m);
      return m;
    });
    const cupHover=[0,0,0];
    let hoverIdx=-1;
    const ray2=new THREE.Raycaster(), nd2=new THREE.Vector2();
    const pickCup=e=>{
      const r=stage.getBoundingClientRect();
      nd2.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
      ray2.setFromCamera(nd2,camera);
      const hit=ray2.intersectObjects(cupMeshes)[0];
      return hit ? cupMeshes.indexOf(hit.object) : -1;
    };
    listen(stage,'pointermove',e=>{
      if(sceneState!=='scene1' || e.pointerType==='touch') return;
      hoverIdx=pickCup(e);
      stage.style.cursor = hoverIdx>=0 ? 'pointer' : '';
    });
    listen(stage,'pointerleave',()=>{ hoverIdx=-1; });
    // 터치 화면(스탠바이미 등): 탭하면 그 잔이 튀어나오고, 같은 잔을 다시 탭하면 원래대로
    listen(stage,'pointerdown',e=>{
      if(sceneState!=='scene1' || e.pointerType!=='touch') return;
      const i=pickCup(e); hoverIdx = (i===hoverIdx) ? -1 : i;
    });
    updateCups=(dt)=>{
      const on=sceneState==='scene1';
      if(!on) hoverIdx=-1;
      if(on) setQuestion(hoverIdx);
      const bw=back.geometry.parameters.width*back.scale.x, bh=back.geometry.parameters.height*back.scale.y;
      cupMeshes.forEach((m,i)=>{
        cupHover[i]+=((hoverIdx===i?1:0)-cupHover[i])*Math.min(1,dt*9);
        const h=cupHover[i], r=CUP_RECTS[i];
        m.material.uniforms.hover.value=h;
        m.visible=on && h>.002;
        const s=1+.1*h;
        m.position.set(back.position.x+((r[0]+r[2])/2-.5)*bw, back.position.y+((r[1]+r[3])/2-.5)*bh, back.position.z+.01+h*.35);
        m.scale.set((r[2]-r[0])*bw*s, (r[3]-r[1])*bh*s, 1);
      });
    };
    /* ----- 잔을 누르면: HEIGHT에 키가 기록되고 시점이 이동 → 잠시 뒤 방 전체 사진으로 줌아웃 ----- */
    // 이미지 2(방 전체)에서 영상 화면과 같은 영역(창틀 기준으로 맞춤): u0,v0,u1,v1
    // 씬 2 방 영상(클레이 스톱모션, 반복). 테이블 영상의 창틀을 방 영상 창틀에 맞춘 영역에서 시작해 방 전체로 줌아웃
    const ROOM_CROP=[.146,.250,.869,.970];
    const rv=makeVideo();
    Object.assign(rv,{muted:true, loop:true, playsInline:true, preload:'auto'});
    rv.setAttribute('muted',''); rv.setAttribute('playsinline','');
    const ROOM_VIDEO=ASSETS.video.room;   // 씬 2 방 영상 (1280×720 → 60fps 보간본)
    fetchBlob(ROOM_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ rv.src=objectURL(b); rv.load(); })
      .catch(()=>{ rv.src=ROOM_VIDEO; rv.load(); });
    const playRoom=()=>{ if(['height','scene2','tiny'].includes(sceneState) && !handoff) rv.play().catch(()=>{}); };
    rv.addEventListener('ended',()=>{ rv.currentTime=0; playRoom(); });
    rv.addEventListener('pause',()=>{ if(rv.ended || (rv.duration && rv.currentTime>=rv.duration-.05)){ rv.currentTime=0; playRoom(); } });
    listen(document,'visibilitychange',()=>{ if(!document.hidden) playRoom(); });
    const roomTex=new THREE.VideoTexture(rv);
    roomTex.colorSpace=THREE.SRGBColorSpace;
    const setRoomCrop=t=>{                  // t: 0 = 영상과 같은 영역, 1 = 방 전체
      const r=ROOM_CROP;
      roomTex.repeat.set(lerp(r[2]-r[0],1,t), lerp(r[3]-r[1],1,t));
      roomTex.offset.set(lerp(r[0],0,t), lerp(r[1],0,t));
    };
    setRoomCrop(1);   // 방 영상은 전체 화면 그대로 (줌 연출은 전환 영상이 담당)
    // 씬 1(창가 테이블)만 살짝 어둡게: 영상 위에 '곱하기(Multiply)' 블렌드 판을 얹음
    const SCENE1_DIM=.84;                    // 1 = 원본, 낮을수록 어두움
    const dimMesh=new THREE.Mesh(back.geometry, new THREE.MeshBasicMaterial({color:0xffffff, blending:THREE.MultiplyBlending,
      transparent:true, premultipliedAlpha:true, depthWrite:false, toneMapped:false}));
    dimMesh.renderOrder=5; dimMesh.visible=false; scene.add(dimMesh);
    let dimT=0;
    updateDim=dt=>{
      const target=(sceneState==='scene1'||sceneState==='height') ? 1 : 0;
      dimT+=(target-dimT)*Math.min(1,dt*2);
      dimMesh.visible=dimT>.002;
      if(!dimMesh.visible) return;
      const v=1-(1-SCENE1_DIM)*dimT;
      dimMesh.material.color.setRGB(v,v,v);
      dimMesh.position.copy(back.position); dimMesh.position.z+=.6;   // 튀어나온 잔보다도 앞 (구멍보다는 뒤)
      dimMesh.scale.copy(back.scale);
    };
    let pickT0=0, zoomT0=0, updateOutfitsRef=null;
    // 차를 고른 뒤 재생되는 테이블 → 방 전환 영상 (한 번)
    const t2=makeVideo();
    Object.assign(t2,{muted:true, loop:false, playsInline:true, preload:'auto'});
    t2.setAttribute('muted',''); t2.setAttribute('playsinline','');
    const T2_VIDEO=ASSETS.video.tableToRoom;
    fetchBlob(T2_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ t2.src=objectURL(b); t2.load(); })
      .catch(()=>{ t2.src=T2_VIDEO; t2.load(); });
    const t2tex=new THREE.VideoTexture(t2); t2tex.colorSpace=THREE.SRGBColorSpace;
    const selectTea=i=>{
      if(sceneState!=='scene1') return;
      sceneState='height'; picks.tea=i;
      setHeightPicks();
      pickT0=performance.now();
    };
    listen(stage,'click',e=>{
      if(sceneState!=='scene1') return;
      const i=pickCup(e); if(i>=0) selectTea(i);
    });
    updateScene2=(dt)=>{
      const now=performance.now();
      // 키가 바뀐 뒤 1.4초 기다렸다가 테이블 → 방 전환 영상으로
      if(sceneState==='height' && pickT0 && now-pickT0>1400 && !handoff){
        pickT0=0;
        handoffTo({to:t2, tex:t2tex, from:sv});
      }
      // 전환 영상이 끝나면(마지막 프레임에서 멈춘 채) 방 영상으로
      if(sceneState==='height' && back.material.map===t2tex && t2.ended && !handoff){
        setRoomCrop(1);
        handoffTo({to:rv, tex:roomTex, from:t2, onSwap:()=>{ sceneState='scene2'; setSceneNumber(2); setQ('room',pack().room); }});
      }
      // 방 전체가 보일 때까지 천천히 줌아웃
      updateOutfitsRef && updateOutfitsRef(dt);
      if(zoomT0){
        const t=Math.min(1,(now-zoomT0)/2600), e2=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
        setRoomCrop(e2);
        if(t>=1) zoomT0=0;
      }
    };
    /* ----- 씬 2: 옷 세 벌. 호버하면 튀어나오고 특성 문구, 누르면 키가 비정상적으로 작아짐 ----- */
    const OUTFIT_DATA=OUTFIT_REGIONS;
    const outfitMeshes=OUTFIT_DATA.map(d=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.ShaderMaterial({
        uniforms:{map:{value:roomTex}, mask:{value:maskLoader.load(d.mask)}, rect:{value:new THREE.Vector4(...d.rect)}, hover:{value:0}, isVid:{value:1}},
        vertexShader:cupMeshes[0].material.vertexShader,
        fragmentShader:cupMeshes[0].material.fragmentShader,
        transparent:true, depthWrite:false, toneMapped:false}));
      m.visible=false; m.renderOrder=2; scene.add(m);
      return m;
    });
    const outfitHover=[0,0,0];
    let outfitIdx=-1;
    const outfitReady=()=>sceneState==='scene2' && !zoomT0;    // 줌아웃이 끝난 뒤부터 고를 수 있음
    const pickOutfit=e=>{
      const r=stage.getBoundingClientRect();
      nd2.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
      ray2.setFromCamera(nd2,camera);
      const hit=ray2.intersectObjects(outfitMeshes)[0];
      return hit ? outfitMeshes.indexOf(hit.object) : -1;
    };
    listen(stage,'pointermove',e=>{
      if(!outfitReady() || e.pointerType==='touch') return;
      outfitIdx=pickOutfit(e);
      stage.style.cursor = outfitIdx>=0 ? 'pointer' : '';
    });
    listen(stage,'pointerdown',e=>{
      if(!outfitReady() || e.pointerType!=='touch') return;
      outfitIdx=pickOutfit(e);
    });
    // 옷을 고르면: 키가 아주 작아지고 시점이 바닥 가까이로 내려감 (다음 씬으로 넘어갈 준비)
    const selectOutfit=i=>{
      if(!outfitReady() || !(i>=0 && i<OUTFIT_HEIGHT.length)) return;
      sceneState='tiny'; tinyT0=performance.now(); picks.outfit=i;
      setHeightPicks();
      stage.style.cursor='';
    };
    listen(stage,'click',e=>{
      if(!outfitReady()) return;
      selectOutfit(pickOutfit(e));
    });
    const updateOutfits=dt=>{
      const on=outfitReady();
      if(!on) outfitIdx=-1;
      if(on){ const p=pack(); setQ('outfit'+outfitIdx, outfitIdx<0?p.room:p.outfits[outfitIdx]); }
      const bw=back.geometry.parameters.width*back.scale.x, bh=back.geometry.parameters.height*back.scale.y;
      outfitMeshes.forEach((m,i)=>{
        outfitHover[i]+=((outfitIdx===i?1:0)-outfitHover[i])*Math.min(1,dt*9);
        const h=outfitHover[i], r=OUTFIT_DATA[i].rect;
        m.material.uniforms.hover.value=h;
        m.visible=(on||h>.01) && h>.002 && sceneState!=='loop';
        const s=1+.1*h;
        m.position.set(back.position.x+((r[0]+r[2])/2-.5)*bw, back.position.y+((r[1]+r[3])/2-.5)*bh, back.position.z+.01+h*.35);
        m.scale.set((r[2]-r[0])*bw*s, (r[3]-r[1])*bh*s, 1);
      });
    };
    updateOutfitsRef=updateOutfits;

    /* ----- 옷을 고른 뒤: 키가 작아지고 1.2초 뒤 방 밖으로 빠지는 줌아웃 영상 재생 (한 번, 마지막 장면에서 멈춤) ----- */
    const zv=makeVideo();
    Object.assign(zv,{muted:true, loop:false, playsInline:true, preload:'auto'});
    zv.setAttribute('muted',''); zv.setAttribute('playsinline','');
    const ZOOM_VIDEO=ASSETS.video.roomZoomOut;
    fetchBlob(ZOOM_VIDEO).then(r=>{ if(!r.ok) throw 0; return r.blob(); })
      .then(b=>{ zv.src=objectURL(b); zv.load(); })
      .catch(()=>{ zv.src=ZOOM_VIDEO; zv.load(); });
    const ztex=new THREE.VideoTexture(zv); ztex.colorSpace=THREE.SRGBColorSpace;
    updateScene3=()=>{
      if(sceneState==='tiny' && tinyT0 && performance.now()-tinyT0>1200 && !handoff){
        tinyT0=0;
        handoffTo({to:zv, tex:ztex, from:rv, onSwap:()=>{ sceneState='scene3'; setSceneNumber(3); }});
      }
    };
    /* ----- 씬 3 → 4: 줌아웃 영상이 끝나면 왼쪽 자판기로 줌인, 점점 흐려지다가 과자 봉지 화면으로 바뀌며 다시 선명해짐 ----- */
    const snackImg=new Image(), snackTex=new THREE.Texture(snackImg);
    snackImg.onload=()=>{ snackTex.needsUpdate=true; };
    snackImg.src=ASSETS.snackImage;
    snackTex.colorSpace=THREE.SRGBColorSpace; snackTex.anisotropy=maxAniso;
    const VEND={u:.155, v:1-.42, s:.32};      // 자판기 진열칸 중심(영상 좌표)과 줌인 끝 크기(1 = 전체)
    const blurMat=new THREE.ShaderMaterial({
      uniforms:{texA:{value:ztex}, texB:{value:snackTex}, rectA:{value:new THREE.Vector4(0,0,1,1)}, mixB:{value:0}, blurA:{value:0}, blurB:{value:0}, vidA:{value:1}, vidB:{value:0}},
      vertexShader:PLANE_VERT, fragmentShader:BLEND_FRAG,
      toneMapped:false, depthWrite:false});
    const blurPlane=new THREE.Mesh(back.geometry, blurMat);
    blurPlane.visible=false; blurPlane.renderOrder=4; scene.add(blurPlane);
    // 자판기 연출 타임라인(초). 앞으로 진행하면 줌인→흐림→과자 화면, 거꾸로 진행하면 과자 화면→흐림→자판기→줌아웃
    const VEND_END=4.2;
    let vendEl=0, vendDir=0, vendWait=0;
    zv.addEventListener('ended',()=>{ if(sceneState==='scene3'){ vendWait=performance.now()+600; vendDir=1; vendEl=0; } });
    const ease3=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const applyVend=el=>{
      const z=ease3(Math.min(1,el/2.4)), sz=lerp(1,VEND.s,z);
      const cu=lerp(.5,VEND.u,z), cv=lerp(.5,VEND.v,z);
      blurMat.uniforms.rectA.value.set(cu-sz/2, cv-sz/2, sz, sz);
      blurMat.uniforms.blurA.value=Math.pow(Math.min(1,el/2.4),2)*.018;
      const m=Math.min(1,Math.max(0,(el-1.8)/1.2));
      blurMat.uniforms.mixB.value=m*m*(3-2*m);
      const sharp=Math.min(1,Math.max(0,(el-3.0)/1.2));
      blurMat.uniforms.blurB.value=.02*(1-sharp*sharp*(3-2*sharp));
    };

    /* 과자 봉지 6개: 호버하면 튀어나오고, 누르면 같은 방식으로 거꾸로 줌아웃 → 엘리베이터 영상 두 편 */
    const BAG_RECTS=[   // 과자 이미지 좌표(u0,v0,u1,v1): 위 줄 Cheerful·Dreamy·Brave, 아래 줄 Kind·Free·Lucky
      [.017,.573,.227,.969],[.291,.575,.505,.958],[.559,.575,.780,.948],
      [.012,.074,.233,.434],[.295,.074,.508,.438],[.571,.074,.792,.434],
    ];
    const bagMask=maskLoader.load(ASSETS.bagMask);
    const bagMeshes=BAG_RECTS.map(r=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.ShaderMaterial({
        uniforms:{map:{value:snackTex}, mask:{value:bagMask}, rect:{value:new THREE.Vector4(...r)}, hover:{value:0}, isVid:{value:0}},
        vertexShader:cupMeshes[0].material.vertexShader, fragmentShader:cupMeshes[0].material.fragmentShader,
        transparent:true, depthWrite:false, toneMapped:false}));
      m.visible=false; m.renderOrder=6; scene.add(m); return m;
    });
    const bagHover=BAG_RECTS.map(()=>0);
    let bagIdx=-1;
    const bagReady=()=>sceneState==='scene4' && vendDir===0;
    const pickBag=e=>{
      const r=stage.getBoundingClientRect();
      nd2.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
      ray2.setFromCamera(nd2,camera);
      const hit=ray2.intersectObjects(bagMeshes)[0];
      return hit ? bagMeshes.indexOf(hit.object) : -1;
    };
    listen(stage,'pointermove',e=>{ if(!bagReady() || e.pointerType==='touch') return; bagIdx=pickBag(e); stage.style.cursor=bagIdx>=0?'pointer':''; });
    listen(stage,'pointerdown',e=>{ if(!bagReady() || e.pointerType!=='touch') return; bagIdx=pickBag(e); });
    // 고른 과자의 영상 재생 → 끝나면 3초 멈춤 → 흐려지며 자판기로 → 줌아웃 → 엘리베이터
    const selectBag=i=>{
      if(!bagReady() || !(i>=0 && i<BAG_RECTS.length)) return;
      sceneState='snackPlay'; bagIdx=-1; stage.style.cursor=''; picks.snack=i;
      setHeightPicks();
      snackPick=snackClips[i]; snackHoldT0=0;
      roomSfx.vendBeep();
      curClip=null; startClip(snackPick, snackTex);   // 지금 보이는 건 과자 사진(흐림 판)
    };
    listen(stage,'click',e=>{
      if(!bagReady()) return;
      selectBag(pickBag(e));
    });

    /* 엘리베이터 영상 두 편: 내려감 → 이어서 올라감 (마지막 장면에서 멈춤) */
    const makeClip=url=>{
      const v=makeVideo();
      Object.assign(v,{muted:true, loop:false, playsInline:true, preload:'auto'});
      v.setAttribute('muted',''); v.setAttribute('playsinline','');
      fetchBlob(url).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>{ v.src=objectURL(b); v.load(); }).catch(()=>{ v.src=url; v.load(); });
      const tex=new THREE.VideoTexture(v); tex.colorSpace=THREE.SRGBColorSpace;
      return {v, tex};
    };
    // 과자별 결과 영상: 1 Cheerful · 2 Dreamy · 3 Brave (위 줄) / 4 Kind · 5 Free · 6 Lucky (아래 줄)
    const snackClips=[
      ASSETS.video.snacks[0],   // 1 cheerful
      ASSETS.video.snacks[1],   // 2 dreamy
      ASSETS.video.snacks[2],   // 3 brave
      ASSETS.video.snacks[3],   // 4 kind
      ASSETS.video.snacks[4],   // 5 free
      ASSETS.video.snacks[5],   // 6 lucky
    ].map(u=>makeClip(u));
    let snackPick=null, snackHoldT0=0;
    const elevDown=makeClip(ASSETS.video.elevatorDown);
    const elevUp=makeClip(ASSETS.video.elevatorUp);
    // 영상 속 시점에 맞춰 나는 효과음(문 · 딩동 · 나선 모터 · 털썩)
    snackClips.forEach((c,i)=>{ c.cues=roomSfx.snackCues[i]; });
    elevDown.cues=roomSfx.elevatorDownCues;
    elevUp.cues=roomSfx.elevatorUpCues;
    // 하루 영상(아침→뉘엿→저녁→밤 세 편을 이어 붙임, 다이얼로 되감기 쉽게 키프레임을 촘촘히)
    const dayClip=makeClip(ASSETS.video.day);

    /* ----- 라디오 다이얼 ----- */
    let dialVal=1, dialDrag=false, seekPending=null, seeking=false;
    const setKnob=v=>{ knob.style.transform=`translate(-50%,-50%) rotate(${lerp(DIAL_MIN,DIAL_MAX,v)}deg)`; };
    const seekTo=t=>{
      const v=dayClip.v; if(!v.duration) return;
      if(seeking){ seekPending=t; return; }
      seeking=true; v.currentTime=Math.min(v.duration-.05,Math.max(0,t));
    };
    dayClip.v.addEventListener('seeked',()=>{ dayClip.tex.needsUpdate=true; seeking=false; if(seekPending!==null){ const t=seekPending; seekPending=null; seekTo(t); } });
    const angleFromEvent=e=>{
      const r=knob.getBoundingClientRect();
      const a=Math.atan2(e.clientY-(r.top+r.height/2), e.clientX-(r.left+r.width/2))*180/Math.PI+90;   // 위쪽이 0도
      return Math.max(DIAL_MIN,Math.min(DIAL_MAX, a>180?a-360:a));
    };
    const turnTo=e=>{
      dialVal=(angleFromEvent(e)-DIAL_MIN)/(DIAL_MAX-DIAL_MIN);
      setKnob(dialVal);
      seekTo(dialVal*dayClip.v.duration);          // 다이얼 위치 = 하루 영상의 그 시점
    };
    // 잡은 지점 기준으로 돌린 만큼만 움직임(손잡이가 갑자기 튀지 않음). 거의 움직이지 않고 짧게 누르면 '선택'
    // 손을 떼면 가장 가까운 시간대(아침·뉘엿·저녁·밤)로 부드럽게 맞춰 돌아감
    const DIAL_STOPS=DIAL_LABELS.length-1;
    let snapRaf=0, wheelTimer=0;
    const setDial=(v,fromPad=false)=>{ dialVal=v; setKnob(v); seekTo(v*dayClip.v.duration); if(!fromPad) onDialChange(v); };
    const stopSnap=()=>{ cancelAnimationFrame(snapRaf); snapRaf=0; clearTimeout(wheelTimer); };
    const snapDial=()=>{
      stopSnap();
      const from=dialVal, to=Math.round(dialVal*DIAL_STOPS)/DIAL_STOPS;
      if(Math.abs(to-from)<1e-4){ setDial(to); return; }
      const t0=performance.now(), dur=180+Math.abs(to-from)*900;
      const step=now=>{
        if(disposed || sceneState!=='dial'){ snapRaf=0; return; }
        const k=Math.min(1,(now-t0)/dur);
        setDial(lerp(from,to,1-Math.pow(1-k,3)));
        snapRaf=k<1 ? requestAnimationFrame(step) : 0;
      };
      snapRaf=requestAnimationFrame(step);
    };
    let dragA0=0, dragV0=0, downX=0, downY=0, downT=0, moved=false;
    const rawAngle=e=>{ const r=knob.getBoundingClientRect(); return Math.atan2(e.clientY-(r.top+r.height/2), e.clientX-(r.left+r.width/2))*180/Math.PI; };
    listen(dialEl,'pointerdown',e=>{
      if(sceneState!=='dial') return; e.stopPropagation();
      stopSnap();
      dialDrag=true; dialEl.dataset.drag='true'; dialEl.setPointerCapture(e.pointerId); dayClip.v.pause();
      dragA0=rawAngle(e); dragV0=dialVal; downX=e.clientX; downY=e.clientY; downT=performance.now(); moved=false;
    });
    listen(dialEl,'pointermove',e=>{
      if(!dialDrag) return; e.stopPropagation();
      if(Math.hypot(e.clientX-downX,e.clientY-downY)>5) moved=true;
      let d=rawAngle(e)-dragA0; d=((d+540)%360)-180;
      dragA0+=d; dragV0=Math.min(1,Math.max(0,dragV0+d/(DIAL_MAX-DIAL_MIN)));
      setDial(dragV0);
    });
    const endDrag=e=>{
      if(!dialDrag) return;
      dialDrag=false; delete dialEl.dataset.drag;
      if(e && e.type==='pointerup' && !moved && performance.now()-downT<400) selectTime();
      else if(moved) snapDial();
    };
    listen(dialEl,'pointerup',endDrag); listen(dialEl,'pointercancel',endDrag);
    listen(dialEl,'wheel',e=>{ if(sceneState!=='dial') return; e.preventDefault();
      stopSnap();
      setDial(Math.min(1,Math.max(0,dialVal+e.deltaY*.0008)));
      wheelTimer=setTimeout(snapDial,220); },{passive:false});
    listen(dialEl,'click',e=>e.stopPropagation());
    setKnob(1);

    /* ----- 아이패드(웹소켓)에서 온 조작: 화면을 직접 누른 것과 같은 동작 ----- */
    remoteHover=i=>{
      if(sceneState==='scene1') hoverIdx=i;
      else if(outfitReady()) outfitIdx=i;
      else if(bagReady()) bagIdx=i;
    };
    remoteSelect=i=>{
      if(sceneState==='scene1'){ if(i>=0 && i<TEA_HEIGHT.length){ hoverIdx=i; selectTea(i); } }
      else if(outfitReady()) selectOutfit(i);
      else if(sceneState==='scene4'){   // 과자 화면이 아직 선명해지는 중이면 끝날 때까지 기다렸다가 고름
        const tryBag=()=>{ if(disposed || sceneState!=='scene4') return; if(bagReady()) selectBag(i); else setTimeout(tryBag,100); };
        tryBag();
      }
    };
    // 아이패드가 스스로 스냅까지 계산해서 보내므로 여기서는 그대로 따라감
    remoteDial=v=>{
      if(sceneState!=='dial' || dialDrag || !(v>=0 && v<=1)) return;
      stopSnap(); dayClip.v.pause(); setDial(v,true);
    };
    remoteDialSelect=()=>{ if(!dialDrag) selectTime(); };
    getDial=()=>dialVal;

    /* ----- 시간대 선택 후: 가운데 인물에게 다가가고, 앞선 선택으로 고른 꽃이 머리(목 위)에서 피어남 ----- */
    const NECK={u:.568, v:1-.451};            // 하루 영상에서 인물 목 위치(영상 좌표, 아래가 0)
    const APPROACH={u:.56, v:1-.42, s:.62};   // 다가간 뒤 보이는 영역(중심, 크기) — 인물과 주변이 함께 보이도록 덜 확대
    // 블루 배경 꽃 영상(피어나도록 거꾸로 인코딩) + 배경 파랑 값 + 다 핀 꽃이 영상 안에서 차지하는 세로 범위(위에서부터: 꽃 맨 위, 줄기 밑동)
    const FLOWERS=[
      [ASSETS.video.flowers[0],[2,31,230],[.245,.743]],   // 나팔꽃
      [ASSETS.video.flowers[1],[1,20,243],[.149,.804]],   // 데이지
      [ASSETS.video.flowers[2],[2,88,233],[.167,.734]],   // 장미
      [ASSETS.video.flowers[3],[1,10,240],[.147,.493]],   // 은방울꽃
      [ASSETS.video.flowers[4],[1,24,230],[.122,.696]],   // 연꽃
      [ASSETS.video.flowers[5],[4,26,238],[.106,.896]],   // 튤립
    ];
    const fv=makeVideo();
    Object.assign(fv,{muted:true, loop:false, playsInline:true, preload:'auto'});
    fv.setAttribute('muted',''); fv.setAttribute('playsinline','');
    const ftex=new THREE.VideoTexture(fv); ftex.colorSpace=THREE.SRGBColorSpace;
    // 파란 배경만 투명하게(색차 거리로 판별) + 가장자리에 번진 파랑 제거
    const flowerMat=new THREE.ShaderMaterial({
      uniforms:{map:{value:ftex}, key:{value:new THREE.Vector3(0,.08,.92)}, op:{value:0}},
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader:INV_ACES_GLSL+`uniform sampler2D map; uniform vec3 key; uniform float op; varying vec2 vUv;
        vec2 cbcr(vec3 c){ return vec2(-.168736*c.r-.331264*c.g+.5*c.b, .5*c.r-.418688*c.g-.081312*c.b); }
        void main(){
          vec3 c=texture2D(map,vUv).rgb;   // 영상(sRGB) 값 그대로 → 색차 판별은 이 값으로
          float a=smoothstep(.12,.30,distance(cbcr(c),cbcr(key)));
          c.b=min(c.b, max(c.r,c.g)*1.05+.02);
          gl_FragColor=vec4(invACES(pow(c,vec3(2.2))), a*op);
        }`,
      transparent:true, depthWrite:false, toneMapped:false});
    const flowerPlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1), flowerMat);
    flowerPlane.visible=false; flowerPlane.renderOrder=7; scene.add(flowerPlane);
    let flowerIdx=-1, approachT0=0, flowerOn=false;
    // 마지막: 머리 위에서 피기 시작하고 3초 뒤, 배경이 첫 화면 같은 들판으로 바뀌며 꽃이 길 끝에 크게 섬 → 27초 머문 뒤 첫 화면으로
    // baseY: 줄기 밑동 높이(위에서부터, 배경 길의 소실점). height: 다 핀 꽃(맨 위~밑동)의 높이(구멍 높이 기준)
    const SOLO={delay:3000, move:2200, hold:27000, fadeOut:1000, baseY:.665, height:.55, blur:.012};
    const finaleImg=new Image(), finaleTex=new THREE.Texture(finaleImg);
    finaleImg.onload=()=>{ finaleTex.needsUpdate=true; };
    finaleImg.src=ASSETS.finale;
    finaleTex.colorSpace=THREE.SRGBColorSpace; finaleTex.anisotropy=maxAniso;
    let bloomT0=0;
    const loadFlower=(idx)=>{
      if(!(idx>=0) || (idx===flowerIdx && fv.src)) return;
      flowerIdx=idx;
      const [url,k]=FLOWERS[flowerIdx];
      flowerMat.uniforms.key.value.set(k[0]/255,k[1]/255,k[2]/255);
      fetchBlob(url).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>{ fv.src=objectURL(b); fv.load(); }).catch(()=>{ fv.src=url; fv.load(); });
    };
    const pickFlower=()=>{       // 차·옷·과자(+시간)로 고르고, 이미 준 꽃은 빼 둠. 다이얼에선 시간 없이 미리 불러 둠
      loadFlower(chooseFlower(picks, readAssigned()));
    };
    function selectTime(){
      if(sceneState!=='dial') return;
      sceneState='approach'; approachT0=performance.now(); picks.time=Math.round(dialVal*DIAL_STOPS);
      setHeightPicks();
      pickFlower();
      blurMat.uniforms.texA.value=dayClip.tex; blurMat.uniforms.mixB.value=0; blurMat.uniforms.blurA.value=0; blurMat.uniforms.blurB.value=0;
      blurMat.uniforms.rectA.value.set(0,0,1,1); blurPlane.visible=true;
    }
    updateApproach=()=>{
      const now=performance.now();
      if(sceneState==='dial' && flowerIdx<0) pickFlower();
      if(!approachT0) return;
      const soloP=bloomT0 ? ease3(THREE.MathUtils.clamp((now-bloomT0-SOLO.delay)/SOLO.move,0,1)) : 0;
      // 다가간 하루 영상 → 들판 배경: 흐려지며 섞였다가 다시 선명해짐
      if(soloP>0){
        const u=blurMat.uniforms;
        u.texB.value=finaleTex; u.mixB.value=soloP;
        u.blurA.value=Math.sin(Math.PI*Math.min(1,soloP*1.5))*SOLO.blur;
        u.blurB.value=(1-soloP)*SOLO.blur;
      }
      const t=Math.min(1,(now-approachT0)/2600), e=ease3(t);
      const sz=lerp(1,APPROACH.s,e), cu=lerp(.5,APPROACH.u,e), cv=lerp(.5,APPROACH.v,e);
      const rx=cu-sz/2, ry=cv-sz/2;
      blurMat.uniforms.rectA.value.set(rx,ry,sz,sz);
      blurPlane.position.copy(back.position); blurPlane.position.z+=.005; blurPlane.scale.copy(back.scale);
      // 다가간 뒤 꽃 재생 시작
      if(t>=1 && !flowerOn){ flowerOn=true; bloomT0=now; picks.flower=flowerIdx; rememberAssigned(flowerIdx); fv.currentTime=0; fv.play().catch(()=>{}); sceneState='bloom'; setSceneNumber(4); }
      if(flowerOn){
        const bw=back.geometry.parameters.width*back.scale.x, bh=back.geometry.parameters.height*back.scale.y;
        // 목 위치를 현재 보이는 영역 안의 위치로 바꿔 꽃 판을 놓음 (줄기 밑동이 목 위에 오도록)
        const [fTop,fBase]=FLOWERS[flowerIdx][2];
        const nx=(NECK.u-rx)/sz-.5, ny=(NECK.v-ry)/sz-.5;
        const fh=bh*.296/sz;   // 원본 화면 대비 같은 크기(확대한 만큼 커짐)
        // 배경이 바뀌는 만큼 길 끝(소실점)으로 옮기며 키움 — 꽃마다 영상 속 크기가 달라 다 핀 꽃 높이로 맞춤
        const hF=bh*SOLO.height/(fBase-fTop), yF=(.5-SOLO.baseY)*bh+(fBase-.5)*hF;
        const h=lerp(fh, hF, soloP), w=h*556/742;
        flowerPlane.scale.set(w,h,1);
        flowerPlane.position.set(
          back.position.x+lerp(nx*bw, 0, soloP),
          back.position.y+lerp(ny*bh+(fBase-.5)*fh, yF, soloP),
          back.position.z+.02);
        flowerPlane.visible=fv.readyState>=2;
        if(soloP>0 && sceneState==='bloom'){ sceneState='solo'; setQ('finale',finaleLine(flowerIdx, lang)); }
        const outT=now-bloomT0-SOLO.delay-SOLO.move-SOLO.hold;
        if(outT<0) flowerMat.uniforms.op.value=Math.min(1,flowerMat.uniforms.op.value+.06);
        else{
          flowerMat.uniforms.op.value=Math.max(0,1-outT/SOLO.fadeOut);
          if(outT>=SOLO.fadeOut) returnToStart();
        }
      }
    };
    resetApproach=()=>{
      approachT0=0; flowerOn=false; bloomT0=0; flowerIdx=-1; fv.pause(); flowerPlane.visible=false; flowerMat.uniforms.op.value=0; showDay.started=false;
      const u=blurMat.uniforms; u.texA.value=ztex; u.mixB.value=0; u.blurA.value=0; u.blurB.value=0;
    };
    let clipQueue=[], curClip=null, shakeT0=0;
    // 화면 흔들림: 엘리베이터가 움직이는 듯 작은 진동 + 가끔 덜컹. 시작과 끝은 부드럽게
    const cvs=renderer.domElement;
    const applyShake=()=>{
      if(!shakeT0){ if(cvs.style.transform) cvs.style.transform=''; return; }
      const t=(performance.now()-shakeT0)/1000, env=Math.min(1,t/.4)*Math.min(1,(3-t)/.5);
      if(env<=0){ cvs.style.transform=''; return; }
      const w=stage.clientWidth;
      const k=w*.0035*env;
      const dx=(Math.sin(t*37)*.6+Math.sin(t*23+1.3)*.4)*k;
      const bump=Math.pow(Math.max(0,Math.sin(t*2.1*Math.PI)),18)*2.2;    // 주기적인 덜컹
      const dy=(Math.sin(t*41+.7)*.5+Math.sin(t*19)*.5)*k + bump*k;
      const rot=Math.sin(t*13+.4)*.18*env;
      cvs.style.transform=`translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${1+.012*env})`;   // 살짝 키워 가장자리 빈틈 가림
    };
    const DAY_START=4.375;   // 엘베 올라감 마지막 장면과 가장 비슷한 하루 영상 지점
    // 하루 영상은 재생하지 않고 그 지점에 멈춘 채로 이어 붙임 (다이얼로 탐색)
    function showDay(){
      showDay.started=true; curClip=dayClip;
      roomSfx.stopAll();
      handoffTo({to:dayClip.v, tex:dayClip.tex, at:DAY_START, play:false, onSwap:()=>{
        sceneState='dial'; setSceneNumber(4); dialVal=DAY_START/dayClip.v.duration; setKnob(dialVal);
      }});
    }
    // fromTex: 지금 화면에 보이는 장면이 영상 판이 아니라 흐림 판(과자 사진·자판기)일 때 그 텍스처
    const startClip=(c,fromTex)=>{
      curClip=c; c.cueT=-1;
      handoffTo({to:c.v, tex:c.tex, fromTex, onSwap:()=>{ blurPlane.visible=false; }});
    };
    const fireCues=c=>{
      if(!c || !c.cues || c.v.paused && !c.v.ended) return;
      const t=c.v.currentTime;
      for(const q of c.cues) if(q.t>c.cueT && q.t<=t) q.fn();
      c.cueT=t;
    };
    const updateClips=()=>{
      applyShake();
      fireCues(curClip);
      if(!curClip || handoff) return;
      const c=curClip;
      // 앞 영상이 끝나면 다음 영상으로
      // 엘베 내려감이 끝나면: 멈춘 화면에서 3초 동안 덜컹덜컹 흔들린 뒤 문 열리는 영상으로
      if(back.material.map===c.tex && c.v.ended && clipQueue.length){
        if(c===elevDown){
          if(!shakeT0){ shakeT0=performance.now(); roomSfx.elevatorShake(); }
          if(performance.now()-shakeT0>3000){ shakeT0=0; startClip(clipQueue.shift()); }
        } else startClip(clipQueue.shift());
      }
      // 엘베 올라감이 끝나면: 하루 영상을 같은 장면(4.4초 지점)에 멈춘 채로 겹쳐 보여주고 다이얼 바로 등장
      if(c===elevUp && back.material.map===c.tex && c.v.ended && sceneState==='elevator' && !showDay.started) showDay();
    };

    updateScene4=()=>{
      blurMat.uniforms.vidA.value=blurMat.uniforms.texA.value.isVideoTexture?1:0;
      blurMat.uniforms.vidB.value=blurMat.uniforms.texB.value.isVideoTexture?1:0;
      const now=performance.now();
      const dt4=Math.min(.1,(now-(updateScene4.last||now))/1000); updateScene4.last=now;
      updateClips();
      if(sceneState==='snackPlay' && snackPick && back.material.map===snackPick.tex && snackPick.v.ended){
        if(!snackHoldT0) snackHoldT0=now;
        if(now-snackHoldT0>3000){
          snackHoldT0=0; sceneState='snackPick';
          blurMat.uniforms.texB.value=snackPick.tex;     // 멈춘 마지막 장면부터 흐려짐
          vendEl=VEND_END; vendDir=-1;
          blurPlane.visible=true; applyVend(vendEl);
        }
      }
      if(vendWait && now<vendWait) return;
      vendWait=0;
      if(blurPlane.visible){   // 영상 판 위치가 바뀌어도 늘 같은 자리에
        blurPlane.position.copy(back.position); blurPlane.position.z+=.005;
        blurPlane.scale.copy(back.scale);
      }
      if(vendDir!==0){
        vendEl=Math.min(VEND_END,Math.max(0,vendEl+dt4*vendDir));
        blurPlane.visible=true;
        blurPlane.position.copy(back.position); blurPlane.position.z+=.005;
        blurPlane.scale.copy(back.scale);
        applyVend(vendEl);
        if(vendDir>0 && vendEl>=1.8+1.2 && sceneState==='scene3'){ sceneState='scene4'; setSceneNumber(3); roomSfx.vendHumOn(); }
        if(vendDir>0 && vendEl>=VEND_END) vendDir=0;
        if(vendDir<0 && vendEl<=0){
          // 줌아웃 완료: 엘리베이터 내려감 → 올라감
          vendDir=0; sceneState='elevator'; setSceneNumber(3); roomSfx.vendHumOff();
          clipQueue=[elevUp]; startClip(elevDown, blurMat.uniforms.texA.value);
        }
      }
      // 과자 봉지 호버 (과자 화면이 선명하게 보일 때만)
      const bw=back.geometry.parameters.width*back.scale.x, bh=back.geometry.parameters.height*back.scale.y;
      bagMeshes.forEach((m,i)=>{
        bagHover[i]+=(((bagReady()&&bagIdx===i)?1:0)-bagHover[i])*Math.min(1,dt4*9);
        const h=bagHover[i], r=BAG_RECTS[i];
        m.material.uniforms.hover.value=h;
        m.visible=h>.002;
        const s=1+.1*h;
        m.position.set(back.position.x+((r[0]+r[2])/2-.5)*bw, back.position.y+((r[1]+r[3])/2-.5)*bh, back.position.z+.012+h*.3);
        m.scale.set((r[2]-r[0])*bw*s, (r[3]-r[1])*bh*s, 1);
      });
    };
    resetScene3=()=>{
      zv.pause(); tinyT0=0;
      vendEl=0; vendDir=0; vendWait=0; blurPlane.visible=false; bagIdx=-1;
      for(const c of [elevDown,elevUp,dayClip,...snackClips]) c.v.pause();
      snackPick=null; snackHoldT0=0; blurMat.uniforms.texB.value=snackTex;
      resetApproach();
      curClip=null; clipQueue=[]; shakeT0=0; renderer.domElement.style.transform='';
      roomSfx.stopAll();
    };
    updateCrossfade=()=>updateHandoff(performance.now());
    playNextScene=()=>{
      sceneState='next';
      handoffTo({to:nv, tex:ntex, from:video});
    };
    backToLoop=()=>{
      sceneState='loop';
      cancelHandoff();
      pickT0=0; zoomT0=0; setRoomCrop(1); rv.pause(); resetScene3();
      t2.pause();
      setHeightPicks(true); hideHeightReason();
      setSceneNumber(0);
      nv.pause(); sv.pause();
      back.material.map=vtex; back.material.needsUpdate=true;
      bgVideo=video; video.currentTime=0; tryPlay();
    };
  }

  /* ---------- 조명: 왼쪽 위 반측면 뒤쪽에서 들어오는 역광 ---------- */
  // 빛은 뒤 공간에서 구멍을 통해 앞으로 들어오고, 왼쪽 위 비스듬한 각도라
  // 오른쪽·아래 면 안쪽 가장자리에 빛이 걸리고 앞면은 실루엣처럼 가라앉습니다.
  const key=new THREE.DirectionalLight(0xffeedb, 3.4);
  key.position.set(-6, 7, -6);
  key.target.position.set(0,0,-D*.5);
  key.castShadow=true;
  key.shadow.mapSize.set(HQ?2048:1024, HQ?2048:1024);
  Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});
  key.shadow.bias=-0.0004; key.shadow.normalBias=0.02;
  scene.add(key, key.target);
  // 그늘 면이 완전히 죽지 않도록 반대편에서 아주 약한 차가운 보조광
  scene.add(new THREE.HemisphereLight(0xdcebff,0x3a4a28,.12));

  // 구멍에서 번지는 빛: 영상의 하늘(위)·잔디(아래) 색이 터널 안쪽 나무에 은은하게 반사
  RectAreaLightUniformsLib.init();
  const holeSky=new THREE.RectAreaLight(0x8fc4ff, .7, 1, 1);
  const holeGrass=new THREE.RectAreaLight(0x6fbf6a, .45, 1, 1);
  scene.add(holeSky, holeGrass);
  function placeHoleLights(){
    holeSky.width=holeGrass.width=IW; holeSky.height=holeGrass.height=IH/2;
    holeSky.position.set(0, IY+IH/4, -D-.02); holeSky.lookAt(0, IY+IH/4, 10);
    holeGrass.position.set(0, IY-IH/4, -D-.02); holeGrass.lookAt(0, IY-IH/4, 10);
  }
  // 영상 색을 주기적으로 읽어 구멍 빛 색에 반영
  const sC=document.createElement('canvas'); sC.width=4; sC.height=8;
  const sX=sC.getContext('2d',{willReadFrequently:true});
  const skyCol=new THREE.Color(0x8fc4ff), grassCol=new THREE.Color(0x6fbf6a);
  let lastSample=0;
  // 영상별 평균 색(미리 계산): 매번 영상에서 색을 읽으면 그래픽 처리가 잠깐 멈춰 영상이 끊기므로,
  // 씬에 따라 정해진 색으로 부드럽게 바꾸기만 함
  const SCENE_COLORS={loop:['#7c80d7','#5ea64f'], next:['#717ac0','#5a8946'], scene1:['#729497','#58a35b'], height:['#729497','#58a35b'], scene2:['#72838c','#507d3d'], tiny:['#72838c','#507d3d'], scene3:['#868e95','#6c8951'], scene4:['#8fbf9a','#c9a0c0'], snackPick:['#8fbf9a','#c9a0c0'], snackPlay:['#8fbf9a','#c9a0c0'], elevator:['#7f868a','#69795a'], dial:['#495d6c','#384a4b'], approach:['#495d6c','#384a4b'], bloom:['#495d6c','#384a4b'], solo:['#7c80d7','#5ea64f']};
  const _cA=new THREE.Color(), _cB=new THREE.Color();
  function sampleVideo(now){
    if(now-lastSample<100) return;
    lastSample=now;
    const [a,b]=SCENE_COLORS[sceneState]||SCENE_COLORS.loop;
    _cA.set(a); _cB.set(b);
    skyCol.lerp(_cA.clone().lerp(_cB,.35),.12); grassCol.lerp(_cB.clone().lerp(_cA,.35),.12);
    holeSky.color.copy(skyCol); holeGrass.color.copy(grassCol);
  }
  function sampleVideoOld(now){
    if(!bgVideo || bgVideo.readyState<2 || now-lastSample<400 || sceneState==='next') return;   // 전환 중엔 색 읽기(동기화 지연 유발)를 쉬어 끊김 방지
    lastSample=now;
    try{
      sX.drawImage(bgVideo,0,0,4,8);
      const d=sX.getImageData(0,0,4,8).data;
      const avg=(y0,y1)=>{ let r=0,g=0,b=0,n=0;
        for(let y=y0;y<y1;y++) for(let x=0;x<4;x++){ const i=(y*4+x)*4; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
        return new THREE.Color().setRGB(r/n/255,g/n/255,b/n/255,THREE.SRGBColorSpace); };
      const a=avg(0,4), b=avg(5,8);
      skyCol.lerp(a.clone().lerp(b,.35),.5); grassCol.lerp(b.clone().lerp(a,.35),.5);   // 위아래 색을 섞어 경계가 티 나지 않게
      holeSky.color.copy(skyCol); holeGrass.color.copy(grassCol);
    }catch(e){}
  }

  /* ---------- 후처리: 앰비언트 오클루전 + 은은한 블룸 + 비네팅/그레인 ---------- */
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const gtao=new GTAOPass(scene,camera,1,1);
  gtao.updateGtaoMaterial({radius:.45, distanceExponent:1.4, thickness:1.2, scale:1.25, samples:10});
  gtao.updatePdMaterial({lumaPhi:10, depthPhi:2, normalPhi:3, radius:5, rings:2, samples:8});
  composer.addPass(gtao);
  const bloomPass=new UnrealBloomPass(new THREE.Vector2(256,256), .22, .55, .88);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null}, time:{value:0}, px:{value:2}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    // 옛 윈도우 느낌: 채널당 색 단계를 줄이고 격자형(베이어) 디더링으로 채움 + 거친 픽셀 노이즈 + 아주 엷은 주사선·색번짐
    fragmentShader:`uniform sampler2D tDiffuse; uniform float time; uniform float px; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      float b2(vec2 a){ a=floor(a); return fract(dot(a, vec2(.5, a.y*.75))); }
      float b4(vec2 a){ return b2(.5*a)*.25 + b2(a); }
      void main(){
        vec2 off=(vUv-.5)*.003;
        vec4 c=texture2D(tDiffuse,vUv);
        c.r=texture2D(tDiffuse,vUv+off).r; c.b=texture2D(tDiffuse,vUv-off).b;   // 가장자리 색번짐
        vec2 q=(vUv-.5)*vec2(1.,.75);
        c.rgb*=mix(.68,1.,smoothstep(.62,.18,length(q)));      // 비네팅
        c.rgb=mix(c.rgb, c.rgb*vec3(1.04,1.,.94), .6);          // 살짝 웜 그레이딩
        vec2 cell=floor(gl_FragCoord.xy/px);                    // 노이즈·디더는 화면 픽셀 단위(살짝 큼직)로
        c.rgb+=(h(cell+floor(time*12.)*vec2(7.13,3.71))-.5)*.032; // 픽셀 노이즈 (초당 12번 바뀜)
        float L=34.;
        c.rgb=floor(c.rgb*L + b4(cell) )/L;                     // 색 단계 줄이기 + 디더링
        c.rgb*=.98+.02*step(.5,fract(cell.y*.5));               // 엷은 주사선
        gl_FragColor=c;
      }`
  });
  composer.addPass(grade);
  grade.uniforms.px.value=Math.max(2, Math.round(renderer.getPixelRatio()*1.5));

  /* ---------- 크기 / 카메라 ---------- */
  let vw=1, vh=1, aspect=0;
  function resize(){
    vw=stage.clientWidth; vh=stage.clientHeight;
    renderer.setSize(vw,vh,false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(vw,vh);
    const a=vw/vh;
    if(Math.abs(a-aspect)>1e-3){ aspect=a; build(aspect); placeHoleLights(); }
  }
  listen(window,'resize', resize);

  // 오프축 투영: 프레임 바깥 테두리를 화면 가장자리에 고정한 채 시점만 움직임 (창문 효과)
  const NEAR=.1, FAR=100;
  // 클로즈업: 프레임·공간·카메라는 그대로 두고, 뒤의 영상만 장미를 중심으로 살짝 확대
  const ROSE={x:-.23, y:.6};          // 영상 판 위 장미 꽃송이 근처(월드 좌표)
  const BG_BASE={x:0, y:-.15};        // 영상 판 원래 위치
  const ZOOM_SCALE=1.6;               // 클로즈업 배율
  let zoomT=0, zoomTarget=0;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  function updateBgZoom(){
    if(!bgPlane) return;
    const sc=lerp(1,ZOOM_SCALE,ease(zoomT));
    bgPlane.scale.set(sc,sc,1);
    bgPlane.position.x=ROSE.x+(BG_BASE.x-ROSE.x)*sc;
    bgPlane.position.y=ROSE.y+(BG_BASE.y-ROSE.y)*sc;
  }
  function updateCamera(cx,cy){
    camera.position.set(cx,cy,L);
    camera.rotation.set(0,0,0);
    camera.updateMatrixWorld();
    const d=L-(LIP-CH), k=NEAR/d;
    camera.projectionMatrix.makePerspective((-W/2-cx)*k, (W/2-cx)*k, (H/2-cy)*k, (-H/2-cy)*k, NEAR, FAR);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  // 맨 처음: 화면 아래쪽을 누르면 시작 (버튼 없음)
  function inStartZone(e){
    if(sceneState!=='loop') return false;
    const r=stage.getBoundingClientRect();
    return (e.clientY-r.top)/r.height>=0.5;
  }
  listen(stage,'click',e=>{ if(inStartZone(e)) start(); });
  listen(stage,'pointermove',e=>{ if(sceneState!=='loop') return; stage.style.cursor=inStartZone(e)?'pointer':''; });
  listen(stage,'pointerleave',()=>{ if(sceneState==='loop') stage.style.cursor=''; });
  /* ---------- 종이비행기: 시작을 누르면 화면 밖에서 날아와 프레임 구멍 안으로 들어감 ---------- */
  // 접힌 면이 보이도록 날개를 두 면씩 나눈 다트형 종이비행기 (앞코가 +z)
  function paperPlaneGeo(){
    const N=[0,0,.55], T=[0,.01,-.5], K=[0,-.13,-.48];
    const Lm=[-.15,.03,-.5], L=[-.44,.08,-.47], Rm=[.15,.03,-.5], R=[.44,.08,-.47];
    const tris=[ N,Lm,T,  N,L,Lm,  N,T,Rm,  N,Rm,R,  N,T,K,  N,K,T ];
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(),3));
    g.computeVertexNormals();
    return g;
  }
  const planeMat=new THREE.MeshStandardMaterial({color:0xf7f4ec, roughness:.75, side:THREE.DoubleSide,
    flatShading:true, emissive:0xfff6e8, emissiveIntensity:.18, transparent:true, envMapIntensity:.6});
  const plane=new THREE.Mesh(paperPlaneGeo(), planeMat);
  plane.castShadow=true; plane.visible=false;
  scene.add(plane);
  let flight=null;
  function launchPlane(){
    // 그려주신 궤도: 왼쪽 아래 화면 밖에서 들어와 오른쪽 위로 완만하게 휘며 구멍 앞까지 →
    // 거기서 왼쪽으로 고리처럼 훅 돌아 구멍 왼쪽(언덕 쪽)으로 들어감
    flight={t0:performance.now(), dur:3000,
      curve:new THREE.CatmullRomCurve3([0,1,2,3,4].map(()=>new THREE.Vector3()), false, 'centripetal')};
    setPlanePath();
    plane.scale.setScalar(.8);
  }
  // 구멍 크기가 바뀌는 동안에도 궤도가 구멍에 맞도록 매 프레임 갱신
  function setPlanePath(){
    const P=flight.curve.points, hz=-D;
    P[0].set(-2.7,-1.75,3.7);                                 // 왼쪽 아래 화면 밖
    P[1].set(-1.25,-1.3,2.2);                                 // 오른쪽 위로 완만하게
    P[2].set(-IW*.18, IY-IH*.34, .55);                        // 고리의 가장 오른쪽 지점 (구멍 바로 앞)
    P[3].set(-IW*.3, IY-IH*.24, hz-.12);                      // 구멍을 지나며 왼쪽으로 크게 꺾음
    P[4].set(-IW*.5-1.1, IY-IH*.2, hz-.3);                    // 프레임 왼쪽 뒤로 완전히 숨음
  }
  const _ta=new THREE.Vector3(), _tb=new THREE.Vector3(), _look=new THREE.Vector3();
  function updatePlane(dt){
    if(flight) renderer.shadowMap.needsUpdate = true;   // 종이비행기가 나는 동안만 그림자 갱신
    if(!flight) return;
    const t=(performance.now()-flight.t0)/flight.dur;
    if(t>=1){ plane.visible=false; flight=null; return; }
    const holeZ=-D;
    setPlanePath();
    const e=1-Math.pow(1-t,1.3);                               // 차분하게, 끝까지 흐름 유지
    const ec=Math.min(1,Math.max(0,e));
    flight.curve.getPoint(ec, plane.position);
    // 진행 방향을 바라보고, 휘는 방향으로 기울어짐(뱅크)
    flight.curve.getTangent(Math.min(.999,ec), _ta);
    flight.curve.getTangent(Math.min(.999,ec+.03), _tb);
    _look.copy(plane.position).add(_ta);
    plane.up.set(0,1,0);
    plane.lookAt(_look);
    const turn=_ta.x*_tb.z-_ta.z*_tb.x;
    plane.rotateZ(THREE.MathUtils.clamp(turn*8,-.45,.45));   // 기울기는 절제해서 차분하게
    plane.visible=true;
    planeMat.opacity=Math.min(1,t/.06);                     // 끝은 프레임 뒤로 가려지며 사라짐
  }

  /* ---------- 유리 찻잔: 씬 1 안내 문구가 뜰 때 프레임 앞쪽 오른쪽에 나타남 ---------- */
  const glassMat=new THREE.MeshPhysicalMaterial({color:0xf2f8ff, metalness:0, roughness:.05, transmission:.88, thickness:.08,
    ior:1.5, envMapIntensity:1.7, clearcoat:1, clearcoatRoughness:.05, side:THREE.DoubleSide});
  const teaMat=new THREE.MeshPhysicalMaterial({color:0xd98a2b, roughness:.08, transmission:.55, thickness:.3, ior:1.33,
    attenuationColor:new THREE.Color(0xa0521a), attenuationDistance:.25, envMapIntensity:.8});
  const teacup=new THREE.Group();
  {
    // 컵: 바깥 벽을 올라갔다가 안쪽 벽으로 내려오는 단면을 회전 → 얇은 유리 두께
    const prof=[[0,0],[.19,0],[.215,.015],[.25,.1],[.285,.28],[.3,.42],[.305,.435],[.29,.435],[.282,.42],[.268,.28],[.235,.11],[.19,.045],[0,.045]]
      .map(([r,y])=>new THREE.Vector2(r,y));
    const cup=new THREE.Mesh(new THREE.LatheGeometry(prof,64), glassMat);
    // 손잡이
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.095,.02,12,32,Math.PI*1.25), glassMat);
    handle.position.set(.3,.25,0); handle.rotation.z=-Math.PI*.62;
    // 받침 접시
    const sp=[[0,-.035],[.36,-.035],[.43,.0],[.445,.015],[.43,.012],[.36,-.012],[0,-.012]].map(([r,y])=>new THREE.Vector2(r,y));
    const saucer=new THREE.Mesh(new THREE.LatheGeometry(sp,64), glassMat);
    // 차
    const tea=new THREE.Mesh(new THREE.CylinderGeometry(.272,.225,.26,48), teaMat);
    tea.position.y=.045+.13;
    for(const m of [cup,handle,saucer]){ m.castShadow=true; teacup.add(m); }   // 빈 찻잔
  }
  teacup.rotation.y=-.5;                // 손잡이가 살짝 오른쪽 앞으로 보이게
  teacup.visible=false;
  scene.add(teacup);
  let cupT=0;
  function updateTeacup(dt){
    teacup.visible=false; return;   // 가로형: 영상 속 테이블에 찻잔이 있어 3D 찻잔은 쓰지 않음
    const target = sceneState==='scene1' ? 1 : 0;
    cupT += (target-cupT)*Math.min(1,dt*2.2);
    if(Math.abs(target-cupT)<1e-3) cupT=target;
    teacup.visible=cupT>.001;
    if(!teacup.visible) return;
    // 화면 오른쪽 아래, 프레임보다 앞에 놓임. 살짝 튀어오르듯 나타남
    const c=1.70158, x=cupT-1, pop=1+(c+1)*x*x*x+c*x*x;      // easeOutBack
    teacup.scale.setScalar(Math.max(0,pop)*1.1);
    // 구멍 안쪽(영상 판 앞)에 놓아, 영상 속 창가 테이블 위에 올려진 것처럼 보이게.
    // 컵 바닥은 구멍 아래 테두리에 살짝 가려지고, 테이블 높이는 화면상 구멍 아래 테두리보다 조금 위
    const cz=-D-.4, k0=L/(L+D), k1=L/(L-cz);
    const edgeApp=(IY-IH/2)*k0, tableApp=edgeApp+.32;
    teacup.position.set(.2, tableApp/k1 - (1-cupT)*.2, cz);
  }

  function returnToStart(){
    if(sceneState==='loop') return;
    flight=null; plane.visible=false;       // 날고 있던 종이비행기도 정리
    backToLoop();
    notifyScene();
  }
  function start(){
    if(sceneState!=='loop') return;
    for(const k in picks) picks[k]=-1;
    playNextScene();
    launchPlane();
    notifyScene();
  }
  let notifiedScene=null;
  function notifyScene(){
    if(sceneState===notifiedScene) return;
    notifiedScene=sceneState;
    onSceneChange(sceneState);
  }
  // 다음 영상이 끝난 뒤 화면을 탭하면 처음 장면으로
  // (가로형) 화면 탭으로 돌아가기는 없앰 → 잔을 누르는 동작과 겹치지 않도록. 뒤로가기는 패드로

  function tryPlayBg(){ if(bgVideo) bgVideo.play().catch(()=>{}); }

  /* ---------- 시차 인터랙션 ---------- */
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target={x:0,y:0}, cur={x:reduce?0:-.8,y:reduce?0:1};
  let lastInput=-1e9;

  const parallaxGain=.55;
  listen(stage,'pointermove',e=>{
    const r=stage.getBoundingClientRect();
    target.x=((e.clientX-r.left)/r.width-.5)*2;
    target.y=-((e.clientY-r.top)/r.height-.5)*2;
    lastInput=performance.now();
  });
  listen(stage,'pointerleave',()=>{target.x=target.y=0;});

  const clock=new THREE.Clock();
  let lastT=0;
  function tick(){
    if(disposed) return;
    const t=clock.getElapsedTime(), dt=Math.min(.1,t-lastT); lastT=t;
    // 줌 진행 (약 2.4초)
    let tx=target.x, ty=target.y;
    if(!reduce && performance.now()-lastInput>2500){ tx=Math.sin(t*.35)*.4; ty=Math.cos(t*.27)*.3; }
    const e=reduce?1:.06;
    cur.x+=(tx-cur.x)*e; cur.y+=(ty-cur.y)*e;
    updateCamera(cur.x*parallaxGain, cur.y*parallaxGain);
    applyDepth(dt);
    updateCrossfade();
    updateCups(dt);
    updateScene2(dt);
    updateDim(dt);
    updateScene3();
    updateScene4();
    updateApproach();
    notifyScene();
    updatePlane(dt);
    updateTeacup(dt);
    // 씬 1에서만 안내 문구가 서서히 나타남
    const qd=textDefs && textDefs.find(d=>d.key==='question');
    if(qd){
      if(sceneState==='loop') setQ('intro',pack().intro);
      if(sceneState==='dial') setQ('dial',pack().dial);
      const target = (sceneState==='loop'||sceneState==='scene1'||sceneState==='scene2'||sceneState==='dial'||sceneState==='solo') ? 1 : 0;
      qd.mat.opacity += (target-qd.mat.opacity)*Math.min(1,dt*2.2);
    }
    sampleVideo(performance.now());
    updateBlur();
    grade.uniforms.time.value=t;
    composer.render();
    rafId=requestAnimationFrame(tick);
  }

  /* ---------- 시작: 폰트를 불러온 뒤 텍스트 생성 ---------- */
  // 가벼운 모드: 가장 무거운 앰비언트 오클루전과 블룸을 끄고 해상도를 1배로 (레트로 필터·조명·그림자는 유지)
  function applyQuality(){
    gtao.enabled=HQ; bloomPass.enabled=HQ;
    renderer.setPixelRatio(Math.min(devicePixelRatio, HQ?1.5:1));
    renderer.setSize(vw,vh,false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(vw,vh);
    grade.uniforms.px.value=Math.max(2, Math.round(renderer.getPixelRatio()*1.5));
  }
  listen(window,'keydown',e=>{ if(e.key==='h'||e.key==='H'){ HQ=!HQ; applyQuality(); } });
  resize(); applyQuality(); tick();
  const fontsReady = Promise.allSettled([   // 한 폰트가 실패해도 나머지는 끝까지 기다림
    document.fonts.load('700 40px "Galmuri11"','캐모마일 가디건 나팔꽃 은방울꽃'),
    document.fonts.load('400 40px "Galmuri11"','터치하여 시작 시선 트래킹 중 카메라 연결'),
    document.fonts.load('900 40px "Doto"','GROWTH MEASUREMENT ROOM HEIGHT --- +-0123456789'),
    document.fonts.load('700 40px "Inter Tight"','GROWTH'),
    document.fonts.load('500 40px "Inter Tight"','MEASUREMENT ROOM'),
    document.fonts.load('300 40px "Inter Tight"','00'),
    document.fonts.load('400 40px "Inter Tight"','---'),
    document.fonts.load('italic 400 40px "Inter Tight"','HEIGHT'),
    document.fonts.load('500 40px "Noto Sans KR"','터치하여 시작'),
    document.fonts.load('700 40px "Noto Sans KR"','테이블 위에 놓인 tea 중 어떤 것을 드시겠습니까?'),
  ]);
  Promise.race([fontsReady, new Promise(r=>setTimeout(r,2500))]).catch(()=>{}).then(()=>{
    if(disposed) return;
    const mk=(side,px,py,size,c,o={})=>({key:o.key,fit:o.fit,side,px,py,size,stretch:o.stretch??1,widen:o.widen??1,keystone:o.keystone??0,canvas:c,mat:textMaterial(c)});
    textDefs=[
      mk('top',   234,152,.52, titleCanvas(), {stretch:1.95, widen:1.4, keystone:.12, fit:true, key:'title'}),
      mk('right', 380,392,.17, heightCanvas(), {key:'height'}),   // HEIGHT는 오른쪽 벽으로
      mk('left',   82,370,.19,  leftCanvas(), {key:'left'}),
      mk('bottom',234,712,.165, questionCanvas(), {key:'question'}),   // 아래 벽: 구멍 쪽(앞)으로 조금 당김
    ];
    textDefs.find(d=>d.key==='question').mat.opacity=0;   // 처음엔 숨김
    build(aspect);
  });

  function dispose(){
    if(disposed) return;
    disposed=true;
    hideHeightReason();
    cancelAnimationFrame(rafId);
    roomSfx.stopAll();
    lifetime.abort();
    for(const v of videos){ v.pause(); v.removeAttribute('src'); v.srcObject=null; v.load(); }
    for(const u of objectURLs) URL.revokeObjectURL(u);
    scene.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      for(const m of [].concat(o.material||[])){
        for(const v of Object.values(m)) if(v && v.isTexture) v.dispose();
        if(m.uniforms) for(const u of Object.values(m.uniforms)) if(u.value && u.value.isTexture) u.value.dispose();
        m.dispose();
      }
    });
    composer.dispose();
    scene.environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return {
    start, back: returnToStart, dispose,
    hover: i=>remoteHover(i), select: i=>remoteSelect(i),
    dial: v=>remoteDial(v), dialSelect: ()=>remoteDialSelect(), getDial: ()=>getDial(),
    getPicks: ()=>({...picks}), setLang,
  };
}