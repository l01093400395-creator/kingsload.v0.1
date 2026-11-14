(()=>{
'use strict';
/* 전장 크기 (월드 좌표) */
const W=1600,H=900,P=2,BUDGET=120,MAXU=30;
const YMIN=84,YMAX=H-56;
const ZONE0=Math.round(W*.38),ZONE1=Math.round(W*.62);
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);

/* ---------- 카메라 ---------- */
let dpr=1,fitZ=1;
const cam={x:0,y:0,z:1};
const isPortrait=()=>matchMedia('(max-width:640px) and (orientation:portrait)').matches;
function panelPad(){
  const el=state==='deploy'?$('deploy'):state==='hub'?$('hub'):null;
  if(!el||el.classList.contains('hidden'))return{r:0,b:0};
  return isPortrait()?{r:0,b:el.offsetHeight+16}:{r:el.offsetWidth+24,b:0};
}
function clampCam(){
  const vw=innerWidth/cam.z,vh=innerHeight/cam.z,pp=panelPad();
  const pr=pp.r/cam.z,pb=pp.b/cam.z;
  const minX=Math.min(0,(W-vw)/2)-vw*.04,maxX=Math.max(W-vw,(W-vw)/2)+pr+vw*.04;
  const minY=Math.min(0,(H-vh)/2)-vh*.04,maxY=Math.max(H-vh,(H-vh)/2)+pb+vh*.04;
  cam.x=Math.max(minX,Math.min(maxX,cam.x));
  cam.y=Math.max(minY,Math.min(maxY,cam.y));
  if(inTown()){if(vw<W)cam.x=Math.max(0,Math.min(W-vw,cam.x));else cam.x=(W-vw)/2;if(vh<H)cam.y=Math.max(0,Math.min(H-vh,cam.y));else cam.y=(H-vh)/2;}
}
// 마을에서는 화면을 꽉 채우도록 (세로 폰에서 아래가 비지 않게)
const zMin=()=>(state==='p1'||state==='kt')?Math.max(innerWidth/W,innerHeight/H):fitZ*(state==='hub'?.55:.95),zMax=()=>2;
function zoomAt(sx,sy,f){
  const wx=cam.x+sx/cam.z,wy=cam.y+sy/cam.z;
  cam.z=Math.max(zMin(),Math.min(zMax(),cam.z*f));
  cam.x=wx-sx/cam.z;cam.y=wy-sy/cam.z;clampCam();
}
function focusCam(wx,wy){
  const pp=panelPad();
  cam.x=wx-(innerWidth-pp.r)/2/cam.z;cam.y=wy-(innerHeight-pp.b)/2/cam.z;clampCam();
}
function resetCam(){
  const z0=Math.max(fitZ,Math.min(.8,innerHeight/620));
  cam.z=z0;focusCam(W*.3,H/2);
}
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr);
  fitZ=Math.min(innerWidth/W,innerHeight/H);
  cam.z=Math.max(zMin(),Math.min(zMax(),cam.z));clampCam();
}
addEventListener('resize',resize);

/* ---------- 데이터 ---------- */
const TYPES={
  spear :{name:'창병',  cost:5, hp:110,atk:13,range:16, speed:44, cd:1.0, desc:'튼튼한 전열. 기병에 강함'},
  cav   :{name:'기병',  cost:9, hp:130,atk:15,range:20, speed:100,cd:1.1, desc:'빠름. 궁병·마법사에 강함, 창병에 약함'},
  archer:{name:'궁병',  cost:6, hp:60, atk:10,range:160,speed:46, cd:1.25,desc:'원거리 사격. 창병에 강함'},
  mage  :{name:'마법사',cost:12,hp:55, atk:18,range:140,speed:40, cd:2.6, aoe:38,desc:'화염구 범위 피해. 체력 낮음'}
};
const ORDER=['spear','cav','archer','mage'];
const BONUS={spear:{cav:2},cav:{archer:2,mage:2,spear:.7},archer:{spear:1.6},mage:{}};
const PRESETS=[
  {name:'베른 변경령 창병대',  biome:'forest',  c:{spear:14,cav:2,archer:4,mage:0}},
  {name:'그라센 제국 기병단',  biome:'plains',  c:{spear:3,cav:8,archer:3,mage:1}},
  {name:'아르델 공국 사수대',  biome:'river',   c:{spear:5,cav:2,archer:10,mage:1}},
  {name:'솔라리스 마도군',    biome:'highland',c:{spear:6,cav:2,archer:4,mage:4}},
  {name:'카르둔 반란군',      biome:'marsh',   c:{spear:7,cav:4,archer:4,mage:1}}
];
/* 지역(바이옴): 지형 생성 비율 */
const BIOMES={
  plains  :{name:'평원',    forest:[2,3], fr:[60,95], hill:[2,3], hr:[100,140], swamp:[0,1],river:.25,road:.8},
  forest  :{name:'숲 지대', forest:[4,6], fr:[85,130],hill:[1,2], hr:[95,130],  swamp:[0,1],river:.3, road:.5},
  highland:{name:'고원',    forest:[1,3], fr:[60,90], hill:[3,4], hr:[115,165], swamp:[0,0],river:.2, road:.5},
  river   :{name:'강 유역', forest:[2,3], fr:[60,95], hill:[1,2], hr:[95,130],  swamp:[1,1],river:1,  road:1},
  marsh   :{name:'습지',    forest:[1,2], fr:[60,90], hill:[1,1], hr:[95,130],  swamp:[2,3],river:.6, road:.4}
};
const LOCS={
  home  :{name:'아군 영토',bias:-1,desc:'우리 땅에서 싸웁니다. 언덕과 숲이 아군 쪽에 몰려 있고, 강은 적 앞을 가로막습니다.'},
  border:{name:'국경',     bias:0, desc:'중립 지대입니다. 지형이 어느 쪽에 유리할지는 운에 달렸습니다.'},
  enemy :{name:'적 영토',  bias:1, desc:'적의 땅을 침공합니다. 적이 높은 곳을 선점하고, 자기 진영에서 기다립니다.'}
};

/* ---------- 도트 스프라이트 ---------- */
const TEAMCOL=[{T:'#3f7be0',D:'#21468f'},{T:'#d94848',D:'#8a2323'}];
const BASE={K:'#1a1a24',S:'#f0c39a',M:'#c8ced8',W:'#8a5a2b',H:'#7a4a2a',h:'#3f2414',O:'#ff9a2e',Y:'#fff3a0'};
const GRIDS={
  spear:[
    "....MMM.......",
    "...MMMMM.....M",
    "...KSSSK....MM",
    "...SSSSS.....W",
    "..DTTTTTD....W",
    ".SSTTTTTSSSSSW",
    "..DTTDTTD....W",
    "..DTTTTTD....W",
    "...DDDDD.....W",
    "...TT.TT.....W",
    "...KK.KK.....W"],
  archer:[
    "...DDDD......",
    "..DTTTTD..W..",
    "..DKSSKD...W.",
    "...SSSS....W.",
    "..TTTTTT...KW",
    ".STTTTTTSSSKW",
    "..TTDDTT...KW",
    "..TTTTTT...W.",
    "..DDDDDD..W..",
    "..TT..TT.....",
    "..KK..KK....."],
  mage:[
    ".....D.......",
    "....TTD......",
    "...TTTTD...O.",
    "..DDDDDDD.OYO",
    "...KSSSK...O.",
    "...SSSSS...W.",
    "..TTTTTTTSSW.",
    "..TTTYTTT..W.",
    "..TTTTTTT..W.",
    ".TTTTTTTTT.W.",
    ".DDDDDDDDD.W.",
    "..KK...KK..W."],
  cav:[
    "......MMM..........",
    ".....MMMMM.........",
    ".....KSSSK.........",
    ".....SSSSS.........",
    "....DTTTTTDSSWWWWMM",
    "....DTTDTTD........",
    ".h..DTTTTTD....HH..",
    "hHHHHHHHHHHHHHHHHH.",
    ".HHHHHHHHHHHHHHHKHh",
    "..HHHHHHHHHHHHH....",
    "..HH.HH....HH.HH...",
    "..hh.hh....hh.hh..."]
};
function makeSprite(grid,pal,white){
  const w=Math.max(...grid.map(r=>r.length)),h=grid.length;
  const c=document.createElement('canvas');c.width=w*P;c.height=h*P;
  const g=c.getContext('2d');
  grid.forEach((row,y)=>{[...row].forEach((ch,x)=>{
    if(ch==='.')return;
    g.fillStyle=white?'#ffffff':(pal[ch]||'#f0f');
    g.fillRect(x*P,y*P,P,P);
  });});
  return c;
}
const SPR={},WSPR={};
ORDER.forEach(t=>{
  SPR[t]=[0,1].map(i=>makeSprite(GRIDS[t],Object.assign({},BASE,TEAMCOL[i])));
  WSPR[t]=makeSprite(GRIDS[t],BASE,true);
});


/* ---------- 지형 ---------- */
const C=12,GW=Math.ceil(W/C),GH=Math.ceil(H/C);
const G_GRASS=0,G_HILL=1,G_FOREST=2,G_SWAMP=3,G_RIVER=4,G_ROAD=5,G_BRIDGE=6;
const TER=[
  {name:'평지',tip:'특별한 효과 없음'},
  {name:'언덕',tip:'원거리 사거리 +25%·피해 +15% / 근접 방어 +15%'},
  {name:'숲',tip:'화살 피해 −40% / 불 피해 +20% / 느림, 돌격 불가'},
  {name:'늪',tip:'매우 느림 / 받는 피해 +10% / 돌격 불가'},
  {name:'강',tip:'깊어서 건널 수 없음 — 다리로만 건넌다 (강 위 다리에 선 적은 받는 피해 +25%)'},
  {name:'길',tip:'이동 속도 +25%'},
  {name:'다리',tip:'강을 안전하게 건너는 길목 / 이동 +25%'}
];
const SPEEDM=[1,.85,.7,.5,.45,1.25,1.25];
const grid=new Uint8Array(GW*GH);
let hills=[],eoff={},terrainLabel='',loc='border',biomeKey='plains',RVR=null,BRG=[],HB=null,BOV={wat:[],brg:[]},RDS=[],STAIR=null,HBW=50,HBH=29,FLOW=new Map();
const terrAt=(x,y)=>{const cx=Math.floor(x/C),cy=Math.floor(y/C);return(cx<0||cy<0||cx>=GW||cy>=GH)?0:grid[cy*GW+cx];};
const tOf=u=>terrAt(u.x,u.y);
const bg=document.createElement('canvas');bg.width=W;bg.height=H;
const canopy=document.createElement('canvas');canopy.width=W;canopy.height=H;

function genTerrain(){
  grid.fill(0);hills=[];eoff={};RVR=null;BRG=[];RDS=[];HB=null;STAIR=null;FLOW=new Map();
  const R=Math.random,rr=(a,b)=>a+R()*(b-a),ri=([a,b])=>a+Math.floor(R()*(b-a+1));
  const L=LOCS[loc],bias=L.bias;
  const keys=Object.keys(BIOMES);
  biomeKey=forceBiome?forceBiome:battleCtx&&!battleCtx.p1?REG[battleCtx.rid].biome:loc==='enemy'?preset.biome:keys[Math.floor(R()*keys.length)];
  const B=BIOMES[biomeKey];
  // 유리한 쪽 선택: bias -1 = 아군 쪽, +1 = 적 쪽, 0 = 무작위
  const favSide=()=>bias===0?(R()<.5?0:1):(R()<.78?(bias<0?0:1):(bias<0?1:0));
  const sideX=(lo,hi)=>{const s=favSide(),x=rr(lo,hi);return s===0?x:W-x;};
  let nz=new Float32Array(GW*GH).map(()=>R());
  for(let pass=0;pass<2;pass++){
    const o=new Float32Array(GW*GH);
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){let s=0,n=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=GW||yy>=GH)continue;s+=nz[yy*GW+xx];n++;}
      o[y*GW+x]=s/n;}
    nz=o;
  }
  const y0=Math.floor(YMIN/C)-1,y1=Math.ceil(YMAX/C);
  const blob=(cx,cy,rx,ry,t)=>{
    const xa=Math.max(0,Math.floor((cx-rx*1.6)/C)),xb=Math.min(GW-1,Math.ceil((cx+rx*1.6)/C));
    for(let y=y0;y<=y1;y++)for(let x=xa;x<=xb;x++){
      const dx=(x*C+C/2-cx)/rx,dy=(y*C+C/2-cy)/ry;
      if(dx*dx+dy*dy<1+(nz[y*GW+x]-.5)*1.8)grid[y*GW+x]=t;}};
  const nF=ri(B.forest),nS=ri(B.swamp),nH=ri(B.hill);
  for(let i=0;i<nF;i++)blob(sideX(60,W*.5),rr(YMIN+20,YMAX-20),rr(B.fr[0],B.fr[1]),rr(B.fr[0]*.8,B.fr[1]*.8),G_FOREST);
  // 늪: 공격하는 쪽 앞에 생기기 쉬움
  for(let i=0;i<nS;i++){const x=bias===0?rr(W*.3,W*.7):(bias<0?rr(W*.42,W*.66):rr(W*.34,W*.58));blob(x,rr(YMIN+60,YMAX-60),rr(95,150),rr(65,100),G_SWAMP);}
  for(let i=0;i<nH;i++){const x=sideX(120,W*.44),y=rr(YMIN+60,YMAX-60);blob(x,y,rr(B.hr[0],B.hr[1]),rr(B.hr[0]*.7,B.hr[1]*.7),G_HILL);hills.push({x,y});}
  let river=false;
  if(R()<B.river){
    river=true;
    const cx=bias===0?rr(W*.42,W*.58):(bias<0?rr(W*.44,W*.52):rr(W*.48,W*.56));
    const A=rr(20,50),f=rr(.006,.015),ph=rr(0,6);RVR={cx,A,f,ph};
    for(let y=y0;y<=y1;y++){const c=cx+A*Math.sin(y*C*f+ph),hw=rr(26,32);for(let x=0;x<GW;x++)if(Math.abs(x*C+C/2-c)<hw)grid[y*GW+x]=G_RIVER;}
  }
  const road=(cy0)=>{let best=null,bs=1e9;for(let k=0;k<10;k++){const cy=cy0+(k?rr(-60,60):0),A=rr(15,45),f=rr(.003,.008),ph=rr(0,6);let hit=0;for(let x=0;x<GW;x+=2){const c=cy+A*Math.sin(x*C*f+ph),y=Math.floor(c/C);for(let dy=-3;dy<=3;dy++){const yy=y+dy;if(yy>=0&&yy<GH&&grid[yy*GW+x]===G_HILL)hit++;}}if(hit<bs){bs=hit;best={cy,A,f,ph};}if(!hit)break;}
    const {cy,A,f,ph}=best;RDS.push({cy,A,f,ph});
    for(let x=0;x<GW;x++){const c=cy+A*Math.sin(x*C*f+ph);
      for(let y=y0;y<=y1;y++){const dd=Math.abs(y*C+C/2-c),i=y*GW+x;if(grid[i]===G_RIVER){if(dd<17)grid[i]=G_BRIDGE;}else if(dd<10)grid[i]=G_ROAD;}}};
  if(river){road(rr(YMIN+80,H*.45));if(R()<.6)road(rr(H*.55,YMAX-80));
    // 다리 목록 (강은 다리로만 건넌다)
    const seen=new Uint8Array(GW*GH);for(let i=0;i<GW*GH;i++){if(grid[i]!==G_BRIDGE||seen[i])continue;const st=[i];seen[i]=1;let x0=1e9,x1=-1,y0=1e9,y1=-1,sy=0,n=0;
      while(st.length){const k=st.pop(),x=k%GW,y=(k/GW)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);sy+=y;n++;[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dx,dy])=>{const xx=x+dx,yy=y+dy,j=yy*GW+xx;if(xx>=0&&yy>=0&&xx<GW&&yy<GH&&!seen[j]&&grid[j]===G_BRIDGE){seen[j]=1;st.push(j);}});}
      BRG.push({x0:x0*C,x1:(x1+1)*C,y0:y0*C,y1:(y1+1)*C,y:(sy/n+.5)*C});}}
  else{road(rr(H*.32,H*.68));if(R()<.35)road(R()<.5?rr(YMIN+70,H*.3):rr(H*.7,YMAX-70));}
  // 언덕은 32px 블록 단위 고지대로 정리 (그림과 실제 판정이 일치하도록)
  {const BW=Math.ceil(W/32),BH=Math.ceil(H/32),cnt=new Uint16Array(BW*BH),blk=new Uint16Array(BW*BH),tot=new Uint16Array(BW*BH);HB=new Uint8Array(BW*BH);
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const b=Math.floor((y*C+C/2)/32)*BW+Math.floor((x*C+C/2)/32),t=grid[y*GW+x];tot[b]++;if(t===G_HILL)cnt[b]++;if(t===G_RIVER||t===G_BRIDGE)blk[b]++;}
    for(let i=0;i<BW*BH;i++)HB[i]=cnt[i]>=tot[i]*.3&&!blk[i]&&tot[i]?1:0;
    for(let it=0;it<2;it++){const nH=i=>{const x=i%BW,y=(i/BW)|0;return(x>0&&HB[i-1])+(x<BW-1&&HB[i+1])+(y>0&&HB[i-BW])+(y<BH-1&&HB[i+BW]);};const nx=HB.slice();for(let i=0;i<BW*BH;i++){const n=nH(i);if(HB[i]&&n<=1)nx[i]=0;else if(!HB[i]&&n>=3&&!blk[i]&&tot[i])nx[i]=1;}HB.set(nx);}
    for(let i=0;i<BW*BH;i++){const bx=i%BW,by=(i/BW)|0;if(!HB[i])continue;const n=(bx>0&&HB[i-1])+(bx<BW-1&&HB[i+1])+(by>0&&HB[i-BW])+(by<BH-1&&HB[i+BW]);if(!n)HB[i]=0;}
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const b=Math.floor((y*C+C/2)/32)*BW+Math.floor((x*C+C/2)/32),i=y*GW+x,t=grid[i];if(HB[b]){if(t!==G_RIVER&&t!==G_BRIDGE)grid[i]=G_HILL;}else if(t===G_HILL)grid[i]=G_GRASS;}
    hills=[];const seen=new Uint8Array(BW*BH);for(let i=0;i<BW*BH;i++){if(!HB[i]||seen[i])continue;const st=[i];seen[i]=1;let sx=0,sy=0,n=0;while(st.length){const k=st.pop(),bx=k%BW,by=(k/BW)|0;sx+=bx;sy+=by;n++;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const xx=bx+dx,yy=by+dy,j=yy*BW+xx;if(xx>=0&&yy>=0&&xx<BW&&yy<BH&&HB[j]&&!seen[j]){seen[j]=1;st.push(j);}});}
      if(n>=3)hills.push({x:(sx/n+.5)*32,y:(sy/n+.5)*32});}
    // 계단: 언덕마다 아래쪽 절벽면에 오르내리는 길 (걸어서 절벽은 못 넘는다)
    HBW=BW;HBH=BH;STAIR=new Uint8Array(BW*BH);const hb=(x,y)=>x>=0&&y>=0&&x<BW&&y<BH&&HB[y*BW+x]===1;
    const foot=(x,y)=>{const yy=y+1;if(yy>=BH||(yy+1)*32>YMAX+20)return false;for(let cy=Math.floor(yy*32/C);cy<Math.ceil((yy+1)*32/C);cy++)for(let cx=Math.floor(x*32/C);cx<Math.ceil((x+1)*32/C);cx++){const t=grid[cy*GW+cx];if(t===G_RIVER)return false;}return !hb(x,yy);};
    const cid=new Int16Array(BW*BH).fill(-1);let nc=0;for(let i=0;i<BW*BH;i++){if(!HB[i]||cid[i]>=0)continue;const st=[i];cid[i]=nc;while(st.length){const k=st.pop(),bx=k%BW,by=(k/BW)|0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const j=(by+dy)*BW+bx+dx;if(hb(bx+dx,by+dy)&&cid[j]<0){cid[j]=nc;st.push(j);}});}nc++;}
    for(let c=0;c<nc;c++){const runs=[];for(let y=0;y<BH;y++){let r=[];for(let x=0;x<=BW;x++){const ok=x<BW&&cid[y*BW+x]===c&&foot(x,y);if(ok)r.push(x);else{if(r.length)runs.push({y,xs:r});r=[];}}}
      runs.sort((a,b)=>b.xs.length-a.xs.length);const pickRun=runs.slice(0,runs.length&&runs[0].xs.length>=8?2:1);
      if(!pickRun.length){for(let i=0;i<BW*BH;i++)if(cid[i]===c){HB[i]=0;}continue;}
      pickRun.forEach(r=>{const m=r.xs.length>=2?r.xs[(r.xs.length>>1)-1]:r.xs[0];STAIR[r.y*BW+m]=r.xs.length>=2?1:3;if(r.xs.length>=2)STAIR[r.y*BW+m+1]=2;});}
    for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const b=Math.floor((y*C+C/2)/32)*BW+Math.floor((x*C+C/2)/32),i=y*GW+x;if(!HB[b]&&grid[i]===G_HILL)grid[i]=G_GRASS;
      // 계단 앞(두 칸)은 숲·늪을 걷어 길목을 연다
      const by=(b/BW)|0;if((grid[i]===G_FOREST||grid[i]===G_SWAMP)&&!HB[b]&&by>=1&&(HB[b-BW]||(by>=2&&STAIR[b-2*BW])))grid[i]=G_GRASS;}
    FLOW=new Map();}
  // 진영별 언덕 수
  const h0=hills.filter(h=>h.x<W/2).length,h1=hills.length-h0;
  const parts=[`언덕 ${hills.length}`,`숲 ${nF}`];
  if(nS)parts.push(`늪 ${nS}`);
  if(river)parts.push('강·다리');
  terrainLabel=battleCtx&&battleCtx.p1?`${battleCtx.q.name} · ${B.name}`:battleCtx?`${REG[battleCtx.rid].name} · ${B.name} (${battleCtx.mode==='defend'?'방어전':L.name})`:`${B.name} (${L.name})`;
  $('tname').textContent=terrainLabel;
  $('tadv').innerHTML=`${parts.join(' · ')}<br>언덕 위치: <span style="color:#7fb0ff">아군 쪽 ${h0}</span> / <span style="color:#ff8a8a">적 쪽 ${h1}</span><br><span style="color:#9aa3c4">${L.desc}</span>`;
  // 적 AI: 자기 진영 가장 앞쪽 언덕에 궁병·마법사 배치
  const eh=hills.filter(h=>h.x>ZONE1+20).sort((a,b)=>a.x-b.x)[0];
  if(eh){eoff.archer={dx:eh.x-(W-450),dy:eh.y-H/2};eoff.mage={dx:eh.x+45-(W-375),dy:eh.y-H/2};}
  buildTerrainArt();
}
function drawTree(g,x,y,r,crownOnly){
  if(!crownOnly){g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(x,y+1,r,r*.35,0,0,7);g.fill();
    g.fillStyle='#5a3a1e';g.fillRect(x-2,y-r*.8,4,r*.8+1);}
  const parts=[[0,-r*1.6,r,'#1f4f22'],[-r*.5,-r*1.25,r*.7,'#2c6a2c'],[r*.5,-r*1.25,r*.7,'#2c6a2c'],[0,-r*2.1,r*.6,'#3c8236']];
  for(const [dx,dy,rad,col] of parts){g.fillStyle=col;const R2=rad*rad;
    for(let yy=-rad;yy<=rad;yy+=2)for(let xx=-rad;xx<=rad;xx+=2)if(xx*xx+yy*yy<=R2)g.fillRect(Math.round(x+dx+xx),Math.round(y+dy+yy),2,2);}
  g.fillStyle='#5aa84e';g.fillRect(Math.round(x-r*.4),Math.round(y-r*2.4),3,2);
}
/* ---------- Tiny Swords 전투 ---------- */
function bSide(team){
  if(team===0){const c=castleCol(prog.phase===2?NATIONS[0].col:NATIONS[(PP()||{home:0}).home]?NATIONS[(PP()||{home:0}).home].col:NATIONS[0].col);return{k:'knight',c};}
  const e=battleCtx&&!battleCtx.p1?battleCtx.enemy:-1;
  if(e!=null&&e>=0){let c=castleCol(ownerCol(e));const mine=bSide(0).c;if(c===mine)c=mine==='Red'?'Purple':'Red';return{k:'knight',c};}
  return{k:'goblin',c:'Red'};
}
function unitLook(u){
  const S=bSide(u.team);
  if(u.hero){if(u.hero.king)return{p:'rpg',sc:2.1};if(S.k==='goblin')return{p:'orc',sc:2.1};}
  if(S.k==='goblin')return u.type==='archer'||u.type==='mage'?{p:'Factions/Goblins/Troops/TNT/Red/TNT_Red.png',fw:192,run:1,atk:2,sc:.42,oy:.7,hue:u.type==='mage'?260:0}:{p:'Factions/Goblins/Troops/Torch/Red/Torch_Red.png',fw:192,run:1,atk:2,sc:u.type==='cav'?.5:.42,oy:.69};
  const c=S.c;
  if(u.type==='archer')return{p:tsUnit('archer',c),fw:192,run:1,atk:4,sc:.42,oy:.7};
  if(u.type==='mage')return{p:tsUnit('pawn',c),fw:192,run:1,atk:2,sc:.42,oy:.66,hue:250};
  return{p:tsUnit('warrior',c),fw:192,run:1,atk:2,sc:u.type==='cav'?.46:.38,oy:.71,cav:u.type==='cav'};
}
function drawUnitTS(u){
  const L=unitLook(u),t=performance.now(),hs=u.hero?1.3:1;
  ctx.save();ctx.translate(Math.round(u.x),Math.round(u.y));
  if(u.dead){const fr=Math.min(13,Math.floor(u.deathT*10));ctx.globalAlpha=Math.max(.3,1-u.deathT*.25);ctx.imageSmoothingEnabled=true;ctx.drawImage(tsi('Factions/Knights/Troops/Dead/Dead.png'),(fr%7)*128,Math.floor(fr/7)*128,128,128,-24,-40,48,48);ctx.restore();return;}
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,0,10*hs,3.5,0,0,7);ctx.fill();
  ctx.fillStyle=u.team===0?'rgba(80,150,255,.5)':'rgba(255,80,70,.5)';ctx.beginPath();ctx.ellipse(0,0,8*hs,3,0,0,7);ctx.fill();
  if(u.hero){ctx.strokeStyle=u.team===0?'#f0c050':'#ff6a3a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,15,5,0,0,7);ctx.stroke();}
  if(u.slow>bt){ctx.fillStyle='rgba(150,220,255,.35)';ctx.beginPath();ctx.ellipse(0,0,12,4,0,0,7);ctx.fill();}
  if(u.wall>bt){ctx.strokeStyle='rgba(143,195,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-14,15,20,0,0,7);ctx.stroke();}
  if(u.flash>0)ctx.filter='brightness(2.2)';else if(L.hue)ctx.filter=`hue-rotate(${L.hue}deg)`;
  ctx.imageSmoothingEnabled=true;
  if(L.p==='rpg'||L.p==='orc'){const nm=L.p==='rpg'?'Soldier':'Orc',mode=u.lunge>0?'Attack01':u.moving?'Walk':'Idle',n=mode==='Walk'?8:6,fr=Math.floor(t/(u.moving?90:130))%n;
    const im=tsi(`rpg/${nm}_${mode}.png`);if(im.complete){ctx.scale(u.face,1);ctx.drawImage(im,fr*100,0,100,100,-50*L.sc,-60*L.sc,100*L.sc,100*L.sc);}}
  else{const row=u.lunge>0?L.atk:u.moving?L.run:0,n=row===0?6:6,fr=Math.floor(t/100+u.x*.05)%n,im=tsi(L.p);
    if(im.complete){ctx.scale(u.face,1);const s=L.sc*hs;ctx.drawImage(im,fr*L.fw,row*L.fw,L.fw,L.fw,-L.fw*s/2,-L.fw*s*L.oy,L.fw*s,L.fw*s);}}
  ctx.filter='none';ctx.restore();
}
function tsTerrainArt(){
  bg.width=W*2;bg.height=H*2;const g=bg.getContext('2d'),cg=canopy.getContext('2d');g.setTransform(2,0,0,2,0,0);g.imageSmoothingEnabled=true;cg.clearRect(0,0,W,H);BOV={wat:[],brg:[]};
  let s=(Math.random()*2e9|0)+1;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const F=tsi('Terrain/Ground/Tilemap_Flat.png'),E=tsi('Terrain/Ground/Tilemap_Elevation.png');
  const tile=(sx,sy,filter)=>{const c=document.createElement('canvas');c.width=64;c.height=64;const q=c.getContext('2d');q.imageSmoothingEnabled=true;if(filter)q.filter=filter;q.drawImage(F,sx*64,sy*64,64,64,0,0,64,64);const p=g.createPattern(c,'repeat');p.setTransform(new DOMMatrix().scale(.5));return p;};
  const tint=biomeKey==='forest'?'saturate(1.15) brightness(.86)':biomeKey==='marsh'?'hue-rotate(28deg) saturate(.7) brightness(.82)':biomeKey==='highland'?'saturate(.75)':'';
  g.fillStyle=tile(1,1,tint);g.fillRect(0,0,W,H);
  const P={2:tile(1,1,(tint?tint+' ':'')+'brightness(.88) saturate(1.1)'),3:tile(1,1,'hue-rotate(40deg) saturate(.6) brightness(.72)'),5:tile(6,1,'')};
  const T8=(x,y)=>terrAt(x*8+4,y*8+4),SW=Math.ceil(W/8),SH=Math.ceil(H/8);
  const near=(x,y,r,ty)=>{for(let dy=-r;dy<=r;dy+=6)for(let dx=-r;dx<=r;dx+=6){const t=terrAt(x+dx,y+dy);if(ty.includes(t))return true;}return false;};
  // 짓밟힌 땅
  g.save();g.globalAlpha=.4;g.fillStyle=P[5];for(let i=0;i<4;i++){const cx=W*.34+rnd()*W*.32,cy=YMIN+60+rnd()*(YMAX-YMIN-120),rx=40+rnd()*50,ry=20+rnd()*26;g.beginPath();for(let a=0;a<6.3;a+=.5){const k=1+(rnd()-.5)*.35;g.lineTo(cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k);}g.closePath();g.fill();}g.restore();
  // 숲 바닥·늪 바닥
  const soft=(ty,pat,al)=>{const m=document.createElement('canvas');m.width=GW;m.height=GH;const mg=m.getContext('2d'),id=mg.createImageData(GW,GH);for(let i=0;i<GW*GH;i++)if(grid[i]===ty)id.data[i*4+3]=255;mg.putImageData(id,0,0);
    const c=document.createElement('canvas');c.width=W*2;c.height=H*2;const q=c.getContext('2d');q.setTransform(2,0,0,2,0,0);q.fillStyle=pat;q.fillRect(0,0,W,H);q.globalCompositeOperation='destination-in';q.imageSmoothingEnabled=true;q.filter='blur(3px)';q.drawImage(m,0,0,W,H);
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=al;g.drawImage(c,0,0);g.restore();};
  soft(G_FOREST,P[2],1);soft(G_SWAMP,P[3],1);
  g.imageSmoothingEnabled=false;
  // 언덕: Tiny Swords 고지대 (그림자 → 절벽면 → 풀 윗면)
  if(HB){const BW=Math.ceil(W/32),BH=Math.ceil(H/32),Hb=(x,y)=>x>=0&&y>=0&&x<BW&&y<BH&&HB[y*BW+x]===1,sh=tsi('Terrain/Ground/Shadows.png');
    g.imageSmoothingEnabled=true;for(let y=0;y<BH;y++)for(let x=0;x<BW;x++)if(Hb(x,y)&&!Hb(x,y+1))g.drawImage(sh,0,0,192,192,x*32-32,(y+1)*32-20,96,96);g.imageSmoothingEnabled=false;
    for(let y=0;y<BH;y++)for(let x=0;x<BW;x++){if(!Hb(x,y)||Hb(x,y+1))continue;const st=STAIR?STAIR[y*BW+x]:0,l=Hb(x-1,y)&&!Hb(x-1,y+1),r=Hb(x+1,y)&&!Hb(x+1,y+1),cx=!l&&!r?3:!l?0:!r?2:1;
      if(st)g.drawImage(E,(st===1?0:st===2?2:3)*64,7*64,64,64,x*32,(y+1)*32,32,32);else g.drawImage(E,cx*64,3*64,64,64,x*32,(y+1)*32,32,32);}
    g.filter='brightness(1.1) saturate(1.12)';for(let y=0;y<BH;y++)for(let x=0;x<BW;x++){if(!Hb(x,y))continue;const m=(Hb(x,y-1)?1:0)|(Hb(x+1,y)?2:0)|(Hb(x,y+1)?4:0)|(Hb(x-1,y)?8:0),a=AUTO[m];g.drawImage(F,a[0]*64,a[1]*64,64,64,x*32,y*32,32,32);}g.filter='none';}
  // 늪 웅덩이 (Fan-tasy 물)
  {const nz=(x,y)=>Math.sin(x*1.7+y*.6)*Math.sin(y*1.3-x*.4)+Math.sin(x*.5+y*.9)*.5;
    const pm=(x,y)=>T8(x,y)===G_SWAMP&&nz(x*.4,y*.4)>.3&&T8(x+1,y)===G_SWAMP&&T8(x-1,y)===G_SWAMP&&T8(x,y-1)===G_SWAMP&&T8(x,y+1)===G_SWAMP;
    fanTiles(pm,SW,SH,FW_WAT,true).forEach(q=>BOV.wat.push(q));}
  // 길 (Fan-tasy 흙길)
  const onRoadA=(px,py)=>RDS.some(r=>Math.abs(py-(r.cy+r.A*Math.sin(px*r.f+r.ph)))<11),onRivA=(px,py)=>RVR&&Math.abs(px-(RVR.cx+RVR.A*Math.sin(py*RVR.f+RVR.ph)))<29;
  fanTiles((x,y)=>onRoadA(x*8+4,y*8+4)&&!onRivA(x*8+4,y*8+4)&&T8(x,y)!==G_HILL,SW,SH,FW_ROAD).forEach(([id,x,y])=>g.drawImage(TS.FanRoad,(id%6)*16,((id/6)|0)*16,16,16,x*8,y*8,8,8));
  // 강: 다수결로 매끈하게 → Fan-tasy 물(애니)은 매 프레임 그린다
  {const raw=new Uint8Array(SW*SH);for(let y=0;y<SH;y++)for(let x=0;x<SW;x++){const t=T8(x,y);raw[y*SW+x]=onRivA(x*8+4,y*8+4)?1:0;}
    const sm=(x,y)=>{if(y<0||y>=SH)return raw[Math.max(0,Math.min(SH-1,y))*SW+Math.max(0,Math.min(SW-1,x))]===1;if(x<0||x>=SW)return false;let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=Math.max(0,Math.min(SH-1,y+dy));if(xx>=0&&xx<SW&&raw[yy*SW+xx])n++;}return n>=5;};
    fanTiles(sm,SW,SH,FW_WAT,true).forEach(q=>BOV.wat.push(q));}
  for(const b of BRG){const h=b.y1-b.y0+8,y=b.y0-4,x0=b.x0-h*.5,x1=b.x1+h*.5-h;BOV.brg.push([0,x0,y,h,h]);for(let x=x0+h;x<x1;x+=h)BOV.brg.push([1,x,y,Math.min(h,x1-x+1),h]);BOV.brg.push([2,x1,y,h,h]);}
  // 소품: 바위·덤불·꽃 (풀밭에만, 길·물 가까이 X)
  const spr=(k,x,y,gg)=>{const S=SP[k],kk=(S[5]||2)/2;(gg||g).drawImage(TS[S[0]],S[1],S[2],S[3],S[4],Math.round(x-S[3]*kk/2),Math.round(y-S[4]*kk),S[3]*kk,S[4]*kk);};
  const DEC=biomeKey==='highland'?['fRock1','fRock2','fRock4','fRock5','fRock3','fBush']:biomeKey==='marsh'?['fBush','fRock2','fRock3','fBush']:['fRock2','fRock3','fBush','fRock5','fRock1'];
  for(let i=0,n=0;i<300&&n<26;i++){const x=20+rnd()*(W-40),y=YMIN+10+rnd()*(YMAX-YMIN-20);if(terrAt(x,y)!==G_GRASS||near(x,y,22,[G_ROAD,G_RIVER,G_BRIDGE,G_HILL]))continue;spr(DEC[Math.floor(rnd()*DEC.length)],x,y);n++;}
  for(let i=0,n=0;i<200&&n<(biomeKey==='marsh'?4:14);i++){const x=20+rnd()*(W-40),y=YMIN+10+rnd()*(YMAX-YMIN-20);if(terrAt(x,y)!==G_GRASS||near(x,y,16,[G_ROAD,G_RIVER,G_BRIDGE]))continue;g.drawImage(rnd()<.5?TS.FanFlowR:TS.FanFlowW,0,0,32,32,x-8,y-12,16,16);n++;}
  const D=k=>tsi(`Deco/${String(k).padStart(2,'0')}.png`);g.imageSmoothingEnabled=true;
  for(let i=0,n=0;i<200&&n<10;i++){const x=rnd()*W|0,y=YMIN+rnd()*(YMAX-YMIN)|0;if(terrAt(x,y)!==G_GRASS||near(x,y,14,[G_ROAD,G_RIVER]))continue;g.drawImage(D([7,8,10,11,4,5][Math.floor(rnd()*6)]),x-16,y-24,32,32);n++;}
  // 숲: 빽빽한 나무 무리 + 가장자리 덤불
  const tr=tsi('Resources/Trees/Tree.png'),trees=[];
  for(let y=0;y<H;y+=20)for(let x=0;x<W;x+=22){const px=x+(rnd()-.5)*14,py=y+(rnd()-.5)*12;if(terrAt(px,py)===G_FOREST&&!near(px,py,10,[G_ROAD,G_RIVER,G_BRIDGE]))trees.push({x:px,y:py+8,k:.62+rnd()*.22});}
  const dt=(gg,x,y,k)=>gg.drawImage(tr,0,0,192,192,x-48*k,y-88*k,96*k,96*k);
  trees.sort((a,b)=>a.y-b.y).forEach(t=>{dt(g,t.x,t.y,t.k);dt(cg,t.x,t.y,t.k);});
  g.imageSmoothingEnabled=false;
  for(let i=0,n=0;i<400&&n<14;i++){const x=rnd()*W,y=YMIN+rnd()*(YMAX-YMIN);if(terrAt(x,y)!==G_GRASS||!near(x,y,14,[G_FOREST])||near(x,y,14,[G_ROAD]))continue;spr('fBush',x,y+6);n++;}
  g.imageSmoothingEnabled=true;
  for(let x=-10;x<W+40;x+=44+rnd()*20)dt(g,x,YMIN+4-rnd()*20,.9+rnd()*.2);
  for(let x=10;x<W+40;x+=44+rnd()*20)dt(g,x,H+30-rnd()*10,.9+rnd()*.2);
  // 양쪽 진영
  const s0=bSide(0),s1=bSide(1);
  const B=(p,x,y,w,h)=>g.drawImage(tsi(p),x,y,w,h);
  B(`Factions/Knights/Buildings/Tower/Tower_${s0.c}.png`,-6,YMIN+20,64,128);B(`Factions/Knights/Buildings/House/House_${s0.c}.png`,-10,YMAX-110,64,96);
  if(s1.k==='goblin'){g.drawImage(tsi('Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png'),0,0,256,192,W-110,YMIN+30,128,96);B('Factions/Goblins/Buildings/Wood_House/Goblin_House.png',W-60,YMAX-110,64,96);}
  else{B(`Factions/Knights/Buildings/Tower/Tower_${s1.c}.png`,W-58,YMIN+20,64,128);B(`Factions/Knights/Buildings/House/House_${s1.c}.png`,W-56,YMAX-110,64,96);}
  g.imageSmoothingEnabled=false;
  [[70,YMAX-40],[W-80,YMAX-40]].forEach(([x,y])=>{g.drawImage(TS.FanCamp,0,0,32,32,x-16,y-26,32,32);spr('fCrate',x+30,y+2);spr('fBarrel',x-26,y+4);});
  [[60,YMIN+150],[W-60,YMIN+150]].forEach(([x,y])=>spr('fBanner',x,y));
}
function tilePat(im,sx,sy){const c=document.createElement('canvas');c.width=32;c.height=32;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(TS[im],sx*16,sy*16,16,16,0,0,32,32);return c;}
function tileTerrainArt(){
  const g=bg.getContext('2d'),cg=canopy.getContext('2d');g.imageSmoothingEnabled=false;cg.imageSmoothingEnabled=false;
  let s=(Math.random()*2e9|0)+1;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const dk=biomeKey==='forest'||biomeKey==='marsh';
  for(let y=0;y<H;y+=32)for(let x=0;x<W;x+=32){g.drawImage(TS.TilesetFloor,(dk?11:0)*16,192,16,16,x,y,32,32);if(rnd()<.14)g.drawImage(TS.TilesetFloor,((dk?11:0)+1+Math.floor(rnd()*4))*16,192,16,16,x,y,32,32);}
  const pat=c=>g.createPattern(c,'repeat');
  const P={1:pat(tilePat('TilesetFloor',dk?0:11,12)),2:pat(tilePat('TilesetFloor',11,12)),3:pat(tilePat('TilesetFloor',12,12)),4:pat(tilePat('TilesetWater',1,7)),5:pat(tilePat('TilesetFloor',1,8)),6:pat(tilePat('TilesetWater',6,13))};
  // 짓밟힌 땅 (전장 한가운데)
  g.save();g.globalAlpha=.55;g.fillStyle=P[5];for(let i=0;i<5;i++){const cx=W*.32+rnd()*W*.36,cy=YMIN+60+rnd()*(YMAX-YMIN-120),rx=40+rnd()*60,ry=20+rnd()*30;g.beginPath();for(let a=0;a<6.3;a+=.5){const rr2=1+(rnd()-.5)*.35;g.lineTo(cx+Math.cos(a)*rx*rr2,cy+Math.sin(a)*ry*rr2);}g.closePath();g.fill();}g.restore();
  const at=(x,y)=>(x<0||y<0||x>=GW||y>=GH)?-1:grid[y*GW+x],wet=t=>t===G_RIVER||t===G_BRIDGE;
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const t=grid[y*GW+x],px=x*C,py=y*C;if(!t)continue;
    g.fillStyle=P[t];g.fillRect(px,py,C,C);
    if(t===G_HILL){if(at(x,y-1)!==G_HILL){g.fillStyle='rgba(255,255,220,.35)';g.fillRect(px,py,C,2);}
      if(at(x,y+1)!==G_HILL){g.fillStyle='#3a5e2a';g.fillRect(px,py+C-5,C,5);g.fillStyle='#24401c';g.fillRect(px,py+C-1,C,1);}
      if(at(x-1,y)!==G_HILL){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(px,py,2,C);}if(at(x+1,y)!==G_HILL){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(px+C-2,py,2,C);}}
    else if(t===G_SWAMP){if(rnd()<.5){g.fillStyle='rgba(60,120,140,.55)';g.fillRect(px+(rnd()*5|0),py+(rnd()*6|0),7,4);}}
    else if(t===G_RIVER){g.fillStyle='#f4f0e0';if(!wet(at(x-1,y)))g.fillRect(px,py,2,C);if(!wet(at(x+1,y)))g.fillRect(px+C-2,py,2,C);g.fillStyle='#8a6a3a';if(!wet(at(x-1,y)))g.fillRect(px-2,py,2,C);if(!wet(at(x+1,y)))g.fillRect(px+C,py,2,C);}
    else if(t===G_ROAD){g.fillStyle='rgba(60,90,30,.35)';if(at(x,y-1)!==G_ROAD&&at(x,y-1)!==G_BRIDGE)g.fillRect(px,py,C,2);if(at(x,y+1)!==G_ROAD&&at(x,y+1)!==G_BRIDGE)g.fillRect(px,py+C-2,C,2);}
    else if(t===G_BRIDGE){g.fillStyle='#3e2612';if(at(x,y-1)!==G_BRIDGE)g.fillRect(px,py,C,2);if(at(x,y+1)!==G_BRIDGE)g.fillRect(px,py+C-2,C,2);}}
  // 양쪽 진영 막사
  const camp=(sx,sy,sw,sh,x,y,f)=>{g.save();g.translate(Math.round(x),Math.round(y));if(f)g.scale(-1,1);g.drawImage(TS.Camp,sx,sy,sw,sh,f?-sw*2:0,0,sw*2,sh*2);g.restore();};
  [[0,YMIN+6],[0,YMAX-110]].forEach(([x,y],i)=>{camp(64+i*48,0,48,48,x-30,y,0);camp(160,48,32,32,x+60,y+40,0);});
  [[W-66,YMIN+6],[W-66,YMAX-110]].forEach(([x,y],i)=>{camp(64+i*48,0,48,48,x-6,y,1);camp(160,48,32,32,x-70,y+40,0);});
  [[34,H/2-40,2],[W-50,H/2-40,1]].forEach(([x,y,b])=>{g.drawImage(TS.TilesetHouse,352+16*b,320,16,32,x,y,32,64);g.drawImage(TS.TilesetHouse,352+16*b,320,16,32,x,y+110,32,64);});
  for(let i=0;i<12;i++){const x=rnd()*W|0,y=YMIN+rnd()*(YMAX-YMIN)|0;if(grid[Math.floor(y/C)*GW+Math.floor(x/C)])continue;g.drawImage(TS.TilesetFloorDetail,Math.floor(rnd()*8)*16,32,16,16,x,y,32,32);}
  cg.clearRect(0,0,W,H);
  const trees=[],TK=biomeKey==='highland'?['tr1','tr3']:biomeKey==='marsh'?['tr3','tr9']:['tr0','tr1','tr8'];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(grid[y*GW+x]===G_FOREST&&rnd()<.055)trees.push({x:x*C+rnd()*C,y:y*C+rnd()*C+8,k:TK[Math.floor(rnd()*TK.length)]});
  const spr=(gg,k,x,y)=>{const S=SP[k];gg.drawImage(TS[S[0]],S[1],S[2],S[3],S[4],Math.round(x-S[3]),Math.round(y-S[4]*2),S[3]*2,S[4]*2);};
  trees.sort((a,b)=>a.y-b.y).forEach(t=>{spr(g,t.k,t.x,t.y);spr(cg,t.k,t.x,t.y);});
  const edge=biomeKey==='highland'?'rockG':'pine3';
  for(let x=-20;x<W+60;x+=110)spr(g,edge,x,92+((x/110|0)%2)*6);
  for(let x=30;x<W+60;x+=110)spr(g,biomeKey==='highland'?'rockB':'pine3',x,H+40);
}
function buildTerrainArt(){
  if(tsReady())return tsTerrainArt();
  bg.width=W;bg.height=H;BOV={wat:[],brg:[]};
  const g=bg.getContext('2d'),cg=canopy.getContext('2d');
  let s=(Math.random()*2e9|0)+1;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  g.fillStyle='#4f8a3d';g.fillRect(0,0,W,H);
  for(let i=0;i<7800;i++){const x=Math.floor(rnd()*W/4)*4,y=Math.floor(rnd()*H/4)*4;g.fillStyle=rnd()<.5?'#468033':'#5a9746';g.fillRect(x,y,4,4);}
  for(let i=0;i<750;i++){const x=rnd()*W|0,y=rnd()*H|0;g.fillStyle='#3a6e2b';g.fillRect(x,y,2,4);g.fillRect(x+3,y+1,2,3);}
  for(let i=0;i<200;i++){const x=rnd()*W|0,y=rnd()*H|0;g.fillStyle=['#f4e36b','#f19ad0','#ffffff'][i%3];g.fillRect(x,y,2,2);}
  const at=(x,y)=>(x<0||y<0||x>=GW||y>=GH)?-1:grid[y*GW+x];
  const wet=t=>t===G_RIVER||t===G_BRIDGE;
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const t=grid[y*GW+x],px=x*C,py=y*C;
    if(t===G_HILL){
      g.fillStyle='#6aa64f';g.fillRect(px,py,C,C);
      for(let k=0;k<3;k++){g.fillStyle=rnd()<.5?'#79b65a':'#5f9846';g.fillRect(px+(rnd()*C&~1),py+(rnd()*C&~1),2,2);}
      if(at(x,y-1)!==G_HILL){g.fillStyle='#8fc96c';g.fillRect(px,py,C,2);}
      if(at(x,y+1)!==G_HILL){g.fillStyle='#3d6d2c';g.fillRect(px,py+C-4,C,4);g.fillStyle='#2f5823';g.fillRect(px,py+C-1,C,1);}
      if(at(x-1,y)!==G_HILL){g.fillStyle='#5a9344';g.fillRect(px,py,2,C);}
      if(at(x+1,y)!==G_HILL){g.fillStyle='#4c813a';g.fillRect(px+C-2,py,2,C);}
    }else if(t===G_FOREST){
      g.fillStyle='#3c6e30';g.fillRect(px,py,C,C);
      g.fillStyle='#335f29';g.fillRect(px+(rnd()*C&~1),py+(rnd()*C&~1),3,2);
    }else if(t===G_SWAMP){
      g.fillStyle='#4a6440';g.fillRect(px,py,C,C);
      if(rnd()<.55){g.fillStyle='#4f7a78';g.fillRect(px+(rnd()*6|0),py+(rnd()*7|0),6,4);g.fillStyle='#6f9c98';g.fillRect(px+2,py+2,2,1);}
      if(rnd()<.4){g.fillStyle='#2f4a2a';const rx=px+(rnd()*10|0);g.fillRect(rx,py+3,1,6);g.fillRect(rx+2,py+4,1,5);}
    }else if(t===G_RIVER){
      g.fillStyle='#3e74b0';g.fillRect(px,py,C,C);
      if(rnd()<.45){g.fillStyle='#78a9db';g.fillRect(px+(rnd()*8|0),py+(rnd()*10|0),4,1);}
      g.fillStyle='#c9b27a';
      if(!wet(at(x-1,y)))g.fillRect(px,py,2,C);
      if(!wet(at(x+1,y)))g.fillRect(px+C-2,py,2,C);
    }else if(t===G_ROAD){
      g.fillStyle='#9b7d52';g.fillRect(px,py,C,C);
      for(let k=0;k<2;k++){g.fillStyle=rnd()<.5?'#b39567':'#7d6340';g.fillRect(px+(rnd()*C&~1),py+(rnd()*C&~1),2,2);}
    }else if(t===G_BRIDGE){
      g.fillStyle='#7a4f28';g.fillRect(px,py,C,C);
      g.fillStyle='#5a3a1e';for(let k=0;k<C;k+=4)g.fillRect(px+k,py,1,C);
      if(at(x,y-1)!==G_BRIDGE){g.fillStyle='#3e2612';g.fillRect(px,py,C,2);}
      if(at(x,y+1)!==G_BRIDGE){g.fillStyle='#3e2612';g.fillRect(px,py+C-2,C,2);}
    }else if(rnd()<.01&&y*C>YMIN&&y*C<YMAX){
      g.fillStyle='#6d6f78';g.fillRect(px,py+3,8,5);g.fillStyle='#9a9ca6';g.fillRect(px+1,py+3,5,2);
    }
  }
  cg.clearRect(0,0,W,H);
  const trees=[];
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(grid[y*GW+x]===G_FOREST&&rnd()<.42)trees.push({x:x*C+rnd()*C,y:y*C+rnd()*C+6,r:6+rnd()*3});
  trees.sort((a,b)=>a.y-b.y).forEach(t=>{drawTree(g,t.x,t.y,t.r);drawTree(cg,t.x,t.y,t.r,true);});
  for(let x=8;x<W+20;x+=30+rnd()*30)drawTree(g,x,34+rnd()*14,10+rnd()*4);
  for(let x=18;x<W+20;x+=30+rnd()*30)drawTree(g,x,H-4+rnd()*4,10+rnd()*4);
}

/* ---------- 상태 ---------- */
let state='deploy',units=[],projs=[],parts=[],texts=[],sfxA=[];
// 마법 이펙트 (닌자 어드벤처 FX): [프레임 너비, 높이, 프레임 수]
const FXD={Explosion:[40,40,9],Ice:[32,32,10],RockSpike:[45,48,12],Spark:[30,35,9],WaterPillar:[45,41,6]},FXI={};
const fxi=n=>FXI[n]||(FXI[n]=Object.assign(new Image(),{src:'assets/fx/'+n+'.png'}));Object.keys(FXD).forEach(fxi);
const fxAnim=(k,x,y,sc,dur)=>sfxA.push({k,x,y,sc:sc||2,t:0,dur:dur||.5});
let speed=1,paused=false,bt=0,shake=0,endT=0,kills=0,start0=0,start1=0;
let counts={spear:6,cav:3,archer:4,mage:1};
let preset=PRESETS[Math.floor(Math.random()*PRESETS.length)];
let uid=0,goff={},drag=null,hover=null;

/* ---------- 장수 ---------- */
// 스킬 풀 (병종마다 가능한 스킬이 다름)
const SKILLS={
  rally :{name:'돌격 함성',cd:20,txt:'부대 이동 +50%, 근접 피해 +40% (6초)'},
  warcry:{name:'전투 함성',cd:22,txt:'주변 아군 피해 +25% (6초)'},
  wall  :{name:'방패벽',  cd:22,txt:'부대 받는 피해 −55%, 느려짐 (7초)'},
  rain  :{name:'화살비',  cd:18,txt:'지정한 곳에 화살 3연속',target:true,R:70},
  snipe :{name:'저격',    cd:15,txt:'가장 위협적인 적 하나에 강력한 한 발'},
  storm :{name:'화염 폭풍',cd:26,txt:'지정한 곳에 폭발 3회',target:true,R:90},
  royal :{name:'왕의 함성',cd:30,txt:'주변 아군 피해 +25%, 받는 피해 −15% (8초)'},
  frost :{name:'빙결',    cd:20,txt:'지정한 곳의 적 감속(5초) + 피해',target:true,R:80},
  heal  :{name:'치유의 빛',cd:24,txt:'부대 체력 30% 회복'}
};
const SKILL_BY_TYPE={cav:['rally','warcry'],spear:['wall','warcry'],archer:['rain','snipe'],mage:['storm','frost','heal']};
const AURAS={
  atk:p=>`근처 아군 공격 +${p}%`, def:p=>`근처 아군 받는 피해 −${p}%`, range:p=>`근처 아군 사거리 +${p}%`,
  cast:p=>`근처 마법사 시전 +${p}%`, speed:p=>`근처 아군 이동 +${p}%`
};
const AURA_BY_TYPE={cav:['atk','speed'],spear:['def','atk'],archer:['range','atk'],mage:['cast','def']};
const TRAITS={
  용맹:'무력 +10%', 거인:'체력 +15%', 철벽:'본인 받는 피해 −15%', 명사수:'원거리 사거리 +15%', 기마술:'이동 +15%',
  카리스마:'오라 반경 +30%', 지휘관:'오라 효과 +30%', 전술가:'스킬 쿨타임 −20%', 학자:'경험치 +25%',
  충직:'충성 상승 2배', 탐욕:'급여 +30%, 충성 상승 절반', 변덕:'충성이 크게 오르내림', 허약:'부상 기간 +1개월',
  불굴:'부상 기간 절반', 행운아:'출전 시 전리품 +15%', 노력가:'Lv10 이후 성장 +30%'
};
const TRAIT_KEYS=Object.keys(TRAITS);
const RARITY=[
  {name:'일반',col:'#c9ced8',w:52,base:[18,28],gain:[1.0,1.8],cost:60},
  {name:'희귀',col:'#5fb3ff',w:31,base:[24,34],gain:[1.4,2.3],cost:140},
  {name:'영웅',col:'#c07aff',w:13,base:[30,42],gain:[1.8,2.8],cost:300},
  {name:'전설',col:'#ffb02e',w:4, base:[38,50],gain:[2.3,3.4],cost:650}
];
// 성장형: xpMul(작을수록 빨리 레벨업), cap(최대 레벨), gm(레벨당 상승량 배율)
const ARCHE=[
  {key:'early', name:'조숙형',  desc:'빨리 크지만 일찍 멈춤',xpMul:.6, cap:[7,11], gm:1.0, w:24},
  {key:'normal',name:'균형형',  desc:'무난한 성장',        xpMul:1,  cap:[13,18],gm:1.0, w:34},
  {key:'late',  name:'대기만성',desc:'느리지만 끝이 높음',  xpMul:1.6,cap:[22,30],gm:1.2, w:22},
  {key:'dull',  name:'범재형',  desc:'느리고 고점도 낮음',  xpMul:1.3,cap:[6,10], gm:.9,  w:14},
  {key:'genius',name:'천재형',  desc:'빠르고 고점도 높음',  xpMul:.75,cap:[24,30],gm:1.15,w:6}
];
const TYPE_BIAS={cav:{STR:1.15,VIT:1.05,LEAD:1,INT:.8},spear:{STR:.95,VIT:1.25,LEAD:1.05,INT:.8},archer:{STR:1.1,VIT:.85,LEAD:1,INT:1},mage:{STR:.7,VIT:.8,LEAD:1,INT:1.35}};
const CLS={cav:'기마 장수',spear:'보병 장수',archer:'궁수 장수',mage:'마도사'};
const STATN={STR:'무력',VIT:'체력',LEAD:'통솔',INT:'지략'};
const NAME_A=['아','베','카','레','로','마','세','이','유','가','하','드','케','루','에','리','오','티','시','브','크','라','니','제','바','모','나','헬','칼','소','타','미','지','벨'];
const NAME_B=['른','온','란','엘','나','안','린','렌','스','드','아','오','트','벨','로','민','카','리','데','엔','라','윈','토','즈','르'];
const NAME_C=['','','','스','드','아','엘','온','린','트','르','나'];
const EPI=['붉은 창','검은 늑대','은빛 매','철벽','폭풍','새벽','강철','서리','불꽃','방랑','외눈','황금 활','잿빛','바람','천둥','고요한','피의','달그림자'];
const rnd=(a,b)=>a+Math.random()*(b-a),rint=(a,b)=>Math.floor(rnd(a,b+1)),pick=a=>a[Math.floor(Math.random()*a.length)];
const wpick=a=>{let t=a.reduce((q,x)=>q+x.w,0)*Math.random();for(const x of a){t-=x.w;if(t<=0)return x;}return a[0];};
const clampL=v=>Math.max(0,Math.min(100,Math.round(v)));
let hid=100;
function genName(r){const n=pick(NAME_A)+pick(NAME_B)+pick(NAME_C);return(r>=2&&Math.random()<.7)?`'${pick(EPI)}' ${n}`:n;}
function genHero(o={}){
  const type=o.type||pick(ORDER),ri=o.rarity!=null?o.rarity:RARITY.indexOf(wpick(RARITY)),R=RARITY[ri];
  let ar=o.arche?ARCHE.find(a=>a.key===o.arche):wpick(ARCHE);
  if(ri===3&&Math.random()<.4)ar=ARCHE[4];
  const base={},gain={};
  for(const k of ['STR','VIT','LEAD','INT']){base[k]=Math.round(rnd(R.base[0],R.base[1])*TYPE_BIAS[type][k]);gain[k]=+(rnd(R.gain[0],R.gain[1])*TYPE_BIAS[type][k]*ar.gm).toFixed(1);}
  const traits=[],nt=ri>=2?2:(Math.random()<.6?1:2);
  const pool=TRAIT_KEYS.filter(t=>!(t==='명사수'&&(type==='cav'||type==='spear'))&&!(t==='기마술'&&type!=='cav'));
  while(traits.length<nt){const t=pick(pool);if(!traits.includes(t))traits.push(t);}
  const h={id:'h'+(++hid),name:genName(ri),type,rarity:ri,arche:ar.key,cap:rint(ar.cap[0],ar.cap[1]),
    base,gain,traits,skill:pick(SKILL_BY_TYPE[type]),aura:pick(AURA_BY_TYPE[type]),lv:1,xp:0,loyalty:rint(35,60),
    injured:0,sq:null,cdLeft:0,downed:false,fought:false,captured:false};
  h.lv=Math.max(1,Math.min(h.cap,o.lv||1));
  h.cost=heroCost(h);h.wage=heroWage(h);
  return h;
}
const archeOf=h=>ARCHE.find(a=>a.key===h.arche)||ARCHE[1];
const has=(h,t)=>!!(h&&h.traits&&h.traits.includes(t));
const loyMul=h=>h.loyalty>=90?1.1:h.loyalty>=70?1.05:h.loyalty<30?.95:1;
function heroStat(h,k,noLoy){
  let v=h.base[k]+h.gain[k]*(h.lv-1);
  if(has(h,'노력가')&&h.lv>10)v+=h.gain[k]*(h.lv-10)*.3;
  if(k==='STR'&&has(h,'용맹'))v*=1.1;
  if(k==='VIT'&&has(h,'거인'))v*=1.15;
  v+=eqB(h,k);
  if(!noLoy)v*=loyMul(h);
  return Math.round(Math.max(1,v));
}
const HATK={cav:24,spear:20,archer:16,mage:26};
const heroHp=h=>Math.round(120+heroStat(h,'VIT')*7);
const heroAtk=h=>HATK[h.type]*heroStat(h,'STR')/30;
const heroPow=h=>Math.max(.7,1+(heroStat(h,'INT')-25)/70);
const heroCd=h=>SKILLS[h.skill].cd*(has(h,'전술가')?.8:1)*Math.max(.6,1-heroStat(h,'INT')/300)*(heroes.includes(h)?Math.max(.8,1-(kst('지략')-50)/400):1)*(1-Math.min(.4,eqB(h,'cd')));
const auraPct=h=>Math.min(30,Math.round((5+heroStat(h,'LEAD')/6)*(has(h,'지휘관')?1.3:1)));
const auraRad=h=>110*(has(h,'카리스마')?1.3:1);
const heroNeed=h=>Math.round(40*h.lv*archeOf(h).xpMul);
const loyGain=h=>has(h,'충직')?2:has(h,'탐욕')?.5:1;
function potGrade(h){const g=(h.gain.STR+h.gain.VIT+h.gain.LEAD+h.gain.INT)/4,sc=(h.cap/30)*.55+(g/3.4)*.45;return sc>.8?'S':sc>.65?'A':sc>.5?'B':sc>.36?'C':'D';}
function heroCost(h){return Math.round(RARITY[h.rarity].cost*(1+(h.lv-1)*.15)*({S:1.5,A:1.25,B:1,C:.85,D:.7}[potGrade(h)]));}
function heroWage(h){if(h.king)return 0;return Math.max(5,Math.round(heroCost(h)*.1*(has(h,'탐욕')?1.3:1)));}
/* ---------- 장비 · 아이템 ---------- */
const ID=window.ITEMDATA;
const SLOTS=['wpn','arm','head','feet','acc'],SLOTN={wpn:'무기',arm:'갑옷',head:'머리',feet:'신발',acc:'장신구'};
const SLOTIC={wpn:'slot_Kunai',arm:'slot_Armor',head:'slot_Helmet',feet:'slot_Boot',acc:'slot_Ring'};
const IRAR=[{n:'일반',c:'#e2dccc',m:1},{n:'고급',c:'#7fd06a',m:1.15},{n:'희귀',c:'#5fb3ff',m:1.3},{n:'영웅',c:'#c07aff',m:1.5},{n:'전설',c:'#ffb02e',m:1.8}];
const TV=[3,5,8,11,15],TYPEI={spear:0,cav:1,archer:2,mage:3},PCTK=['spd','rng','cd'],CIVK=['매력','내정'];
const STN={STR:'무력',VIT:'체력',LEAD:'통솔',INT:'지략',spd:'이동 속도',rng:'사거리',cd:'스킬 재사용',매력:'매력',내정:'내정'};
const BASES={};
ID.WPN.forEach(([k,n,c,r,col])=>BASES[k]={k,n,slot:'wpn',cls:c,ic:t=>(ID.WB(t)+r)*16+col});
ID.ARM.forEach(([k,n,s,c,ics])=>BASES[k]={k,n,slot:s,cls:c,ic:t=>ics[t-1]});
const BKEYS=Object.keys(BASES),UNIQ=Object.fromEntries(ID.UNI.map(u=>[u.id,u]));
const INVMAX=60;
const TNAME={metal:['청동','철','강철','황금','미스릴'],wood:['참나무','물푸레','주목','황금','미스릴'],magic:['참나무','물푸레','룬','수정','별빛'],
  soft:['거친','튼튼한','정교한','화려한','전설의'],jewel:['구리','은','금','백금','미스릴'],arcane:['초보자의','수습생의','마법사의','대마법사의','현자의']};
const TFAM={bow:'wood',crossbow:'wood',staff:'magic',wand:'magic',scythe:'magic',light:'soft',robe:'soft',cloth:'soft',cape:'soft',ring:'jewel',amulet:'jewel',orb:'arcane',book:'arcane'};
let iid=Date.now()%100000;
const scaleSt=(k,v,t)=>PCTK.includes(k)?(v<0?v:+(v*(.6+.4*t)).toFixed(3)):CIVK.includes(k)?Math.round(v*TV[t-1]*.9):Math.round(v*TV[t-1]);
function makeItem(bk,t,r,o={}){
  const b=BASES[bk];t=Math.max(1,Math.min(5,t));r=Math.max(0,Math.min(3,r));
  const C=ID.CLS[b.cls],src=C.st[b.slot]||C.st,st={};
  let q=1,qn='';
  const fam=TFAM[b.cls]||'metal';
  if(r===0){const x=Math.random();if(x<.18){q=.75;qn=fam==='metal'?'녹슨 ':'해진 ';}else if(x>.85){q=1.12;qn='질 좋은 ';}}
  if(o.q){q=o.q;qn=o.qn||'';}
  for(const k in src)st[k]=scaleSt(k,src[k]*(src[k]>0?IRAR[r].m*q:1),t);
  const af=[];
  while(af.length<r){const a=pick(ID.AFX);if(!af.includes(a.n)){af.push(a.n);for(const k in a.e)st[k]=+(((st[k]||0)+scaleSt(k,a.e[k],t))).toFixed(3);}}
  let cursed=false;
  if(r>=2&&Math.random()<.05){cursed=true;for(const k in st)if(!PCTK.includes(k)&&st[k]>0)st[k]=Math.round(st[k]*1.45);st.VIT=(st.VIT||0)-Math.round(TV[t-1]*.6);st.매력=(st.매력||0)-3;}
  for(const k in st)if(!st[k])delete st[k];
  return {id:++iid,b:bk,t,r,st,af,n:(cursed?'저주받은 ':'')+(af[0]?af[0]+' ':qn)+TNAME[fam][t-1]+' '+b.n,cursed};
}
function makeUnique(uid){const U=UNIQ[uid];return {id:++iid,u:uid,r:4,t:5,st:{...U.st},n:U.n};}
const itBase=it=>it.u?UNIQ[it.u]:BASES[it.b];
const itSlot=it=>itBase(it).slot,itCls=it=>itBase(it).cls;
const itIcon=it=>it.u?UNIQ[it.u].ic:BASES[it.b].ic(it.t);
const itVal=it=>it.u?1600:Math.round(TV[it.t-1]*11*(1+it.r*.9)*(it.cursed?1.3:1));
const itFit=(it,h)=>h?ID.CLS[itCls(it)].fit[TYPEI[h.type]||0]:1;
const fitTxt=f=>f>=1.2?'<span class="fit3">★★★ 아주 잘 맞음</span>':f>=1?'<span class="fit2">★★ 잘 맞음</span>':f>=.8?'<span class="fit2">★ 보통</span>':'<span class="fit1">✘ 맞지 않음 (효과 감소)</span>';
function eqB(h,k){if(!h||!h.eq)return 0;let v=0;for(const s of SLOTS){const it=h.eq[s];if(!it||!it.st[k])continue;const x=it.st[k];v+=x<0?x:x*itFit(it,h);}return PCTK.includes(k)?v:Math.round(v);}
const civOf=h=>({무예:Math.round(eqB(h,'STR')*.5),통솔:Math.round(eqB(h,'LEAD')*.5),지략:Math.round(eqB(h,'INT')*.5),매력:eqB(h,'매력'),내정:eqB(h,'내정')});
function applyCiv(){ // 시민 시절: 장비의 생활 능력치를 p.st에 반영
  if(prog.phase!==1||!prog.p1)return;const p=PP(),me=heroes.find(h=>h.king);if(!me)return;
  const now=civOf(me),old=p.eqciv||{};KSTAT.forEach(k=>{p.st[k]=r1((p.st[k]||0)+(now[k]||0)-(old[k]||0));});p.eqciv=now;
}
function stripCiv(p){const old=p.eqciv||{};KSTAT.forEach(k=>{p.st[k]=r1((p.st[k]||0)-(old[k]||0));});p.eqciv={};}
const inv=()=>prog.inv||(prog.inv=[]);
const goldNow=()=>prog.phase===1&&prog.p1?PP().gold:prog.gold;
const goldAdd=v=>{if(prog.phase===1&&prog.p1)PP().gold+=v;else prog.gold+=v;};
function gainItem(it,why){
  if(it.u){(prog.uni=prog.uni||{})[it.u]=1;}
  if(inv().length>=INVMAX){const v=Math.round(itVal(it)*.4);goldAdd(v);toast(`가방이 가득 차 ${it.n}을(를) 💰${v}에 팔았습니다`);return `🎒 ${it.n} (가방이 가득 차 💰${v}에 팜)`;}
  inv().push(it);
  const t=`🎁 <span style="color:${IRAR[it.r].c}">${it.n}</span> 획득${why?` — ${why}`:''}`;
  toast(`🎁 ${it.n} 획득!`);return t;
}
const hasUni=id=>!!(prog.uni&&prog.uni[id]);
function giveUnique(id,why){if(hasUni(id)||!UNIQ[id])return '';return gainItem(makeUnique(id),why||UNIQ[id].src);}
function rollRar(lv,luck){const w=[60,28,9,2.5].map((x,i)=>x*Math.pow(1+lv*.12+(luck||0),i));let t=w.reduce((a,b)=>a+b)*Math.random();for(let i=0;i<4;i++){t-=w[i];if(t<=0)return i;}return 0;}
function rollItem(lv,o={}){
  let pool=BKEYS;if(o.slot)pool=pool.filter(k=>BASES[k].slot===o.slot);if(o.cls)pool=pool.filter(k=>o.cls.includes(BASES[k].cls));
  const t=Math.max(1,Math.min(5,Math.round(lv/2+rnd(-.6,.9)))),r=o.r!=null?o.r:rollRar(lv,o.luck);
  return makeItem(pick(pool),t,r);
}
function lootChance(ch,lv,why,o){if(Math.random()>=ch)return '';return gainItem(rollItem(lv,o),why);}
const p1Lv=()=>{const p=PP();return 1+p.rank*1.6+Math.min(3,p.month/12);};
const p2Lv=()=>Math.min(10,3+prog.month/8+myRegs().length/5);
function refreshShop(force){
  const lv=prog.phase===1&&prog.p1?p1Lv():p2Lv(),m=prog.phase===1&&prog.p1?PP().month:prog.month;
  if(!force&&prog.shop&&prog.shop.m===m)return;
  const items=[];for(let i=0;i<8;i++)items.push(rollItem(lv,{luck:-.1}));
  prog.shop={m,items};
}
const shopPrice=it=>Math.round(itVal(it)*1.25);
/* --- 장비 창 --- */
let eqUI={tab:'bag',h:null,sel:null,filt:'all',slotSel:null};
function icoHTML(it,cls){const i=itIcon(it),s=cls==='s2'?64:cls==='s15'?48:32;return `<span class="ico ${cls||''}" style="background-position:-${(i%16)*s}px -${Math.floor(i/16)*s}px"></span>`;}
function cellHTML(it,sel){return `<div class="cell${sel?' sel':''}" data-id="${it.id}">${icoHTML(it)}<i class="r" style="background:${IRAR[it.r].c}"></i>${it.u?'<span class="lv">★</span>':`<span class="lv">${it.t}</span>`}</div>`;}
function stLines(it,h){const f=itFit(it,h);return Object.entries(it.st).map(([k,v])=>{const e=v<0?v:v*f;const s=PCTK.includes(k)?`${e>0?'+':''}${Math.round(e*100)}%`:`${e>0?'+':''}${Math.round(e)}`;
  return `<span class="${e<0?'ineg':'istat'}">${STN[k]} ${s}</span>${f!==1&&v>0?` <small class="sub">(기본 ${PCTK.includes(k)?Math.round(v*100)+'%':v})</small>`:''}`;}).join(' · ');}
function openEquip(tab){eqUI.tab=tab||'bag';if(!eqUI.h||!heroes.includes(eqUI.h))eqUI.h=heroes.find(h=>h.king)||heroes[0];eqUI.sel=null;refreshShop();show('equip',true);renderEquip();}
function closeEquip(){show('equip',false);if(prog.phase===1&&state==='p1'){renderP1();updNear&&updNear();}else if(state==='hub')renderHub();save();}
function renderEquip(){
  const el=$('equip'),h=eqUI.h,list=eqUI.tab==='shop'?prog.shop.items:eqUI.tab==='dex'?[]:inv();
  el.innerHTML=`<div class="bhead"><h3>🎒 장비</h3><div class="filt"><button class="${eqUI.tab==='bag'?'':'ghost'}" data-t="bag">가방 ${inv().length}/${INVMAX}</button><button class="${eqUI.tab==='shop'?'':'ghost'}" data-t="shop">🛒 상점</button><button class="${eqUI.tab==='dex'?'':'ghost'}" data-t="dex">📜 전설 도감</button></div><span>💰 <b>${goldNow()}</b></span><button class="ghost" id="eqclose">✕ 닫기</button></div>
  <div class="eqbody"><div class="eqleft"><div class="hsel" id="eqh"></div><div class="rg" id="eqhero"></div></div>
  <div class="eqright"><div class="filt" id="eqf"></div><div class="grid" id="eqgrid"></div><div class="detail" id="eqdet"></div></div></div>`;
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{eqUI.tab=b.dataset.t;eqUI.sel=null;renderEquip();});
  $('eqclose').onclick=closeEquip;
  heroes.forEach(x=>{const b=document.createElement('button');b.className=x===h?'':'ghost';b.innerHTML=`${x.king?'👑':''}${x.name.replace(/'.*?' /,'')}`;b.style.color=x===h?'':RARITY[x.rarity].col;b.onclick=()=>{eqUI.h=x;renderEquip();};$('eqh').appendChild(b);});
  if(!h){$('eqhero').textContent='장수가 없습니다';}
  else{
    h.eq=h.eq||{};
    const sl=SLOTS.map(s=>{const it=h.eq[s];return `<div>${it?cellHTML(it,eqUI.slotSel===s).replace('class="cell','data-slot="'+s+'" class="cell'):`<div class="cell empty${eqUI.slotSel===s?' sel':''}" data-slot="${s}"><img class="ph" src="assets/ui/${SLOTIC[s]}.png"></div>`}<small>${SLOTN[s]}</small></div>`;}).join('');
    const civ=h.king&&prog.phase===2?civOf(h):null;
    $('eqhero').innerHTML=`<b style="color:${RARITY[h.rarity].col}">${h.name}</b> <span class="sub">Lv${h.lv} ${CLS[h.type]}</span>
      <div class="slots5" style="margin:6px 0">${sl}</div>
      ${['STR','VIT','LEAD','INT'].map(k=>{const b=eqB(h,k);return `${STATN[k]} <b>${heroStat(h,k)}</b>${b?` <span class="${b>0?'istat':'ineg'}">(${b>0?'+':''}${b})</span>`:''}`;}).join(' · ')}
      <br>${['spd','rng','cd'].map(k=>{const b=eqB(h,k);return b?`${STN[k]} <span class="${b>0?'istat':'ineg'}">${b>0?'+':''}${Math.round(b*100)}%</span>`:'';}).filter(Boolean).join(' · ')||'<span class="sub">특수 효과 없음</span>'}
      <br><span class="sub">체력 ${heroHp(h)} · 공격 ${heroAtk(h).toFixed(1)}</span>
      ${h.king?`<div class="sub" style="margin-top:4px">👑 ${prog.phase===1?'장비의 무력·통솔·지략 절반과 매력·내정이 시민 능력치에 더해집니다 (판정·승진에 적용)':'장비의 무력·통솔·지략 절반과 매력·내정이 왕의 능력치에 더해집니다'}</div>`:''}
      <div class="sub" style="margin-top:4px">병종마다 잘 맞는 장비가 다릅니다 — ${CLS[h.type]}: ${({spear:'창·둔기·중갑·방패',cav:'창·검·곡도·사슬',archer:'활·석궁·가죽·단검',mage:'지팡이·완드·로브·마도서'})[h.type]}</div>`;
    $('eqhero').querySelectorAll('[data-slot]').forEach(c=>c.onclick=()=>{const s=c.dataset.slot;eqUI.slotSel=eqUI.slotSel===s?null:s;eqUI.filt=eqUI.slotSel||'all';eqUI.sel=h.eq[s]||null;renderEquip();});
  }
  const fl=$('eqf');
  if(eqUI.tab!=='dex')[['all','전체'],...SLOTS.map(s=>[s,SLOTN[s]])].forEach(([k,n])=>{const b=document.createElement('button');b.className=eqUI.filt===k?'':'ghost';b.textContent=n;b.onclick=()=>{eqUI.filt=k;renderEquip();};fl.appendChild(b);});
  if(eqUI.tab==='bag'&&inv().length){const b=document.createElement('button');b.className='ghost';b.textContent='일반 등급 모두 팔기';
    b.onclick=function(){const xs=inv().filter(x=>x.r===0);if(!xs.length)return toast('팔 일반 장비가 없습니다');if(!this._arm){this._arm=1;this.textContent=`${xs.length}개 판매? 한 번 더`;return;}
      let g=0;xs.forEach(x=>g+=Math.round(itVal(x)*.4));prog.inv=inv().filter(x=>x.r!==0);goldAdd(g);toast(`💰+${g}`);renderEquip();};fl.appendChild(b);}
  const grid=$('eqgrid');
  if(eqUI.tab==='dex'){
    grid.innerHTML=ID.UNI.map(U=>{const got=hasUni(U.id);return `<div class="rg" style="width:100%;display:flex;gap:8px;align-items:center;padding:6px 8px">${got?icoHTML({u:U.id}):'<span class="ico" style="background:#131b1b"></span>'}<div><b style="color:${got?'#ffb02e':'#8a7a68'}">${got?U.n:'??? '+SLOTN[U.slot]}</b><br><span class="sub">${got?U.d:'단서: '+U.src}</span></div></div>`;}).join('');
    $('eqdet').innerHTML=`전설 장비 ${ID.UNI.filter(U=>hasUni(U.id)).length}/${ID.UNI.length}개 발견. 전설 장비는 특별한 사건, 숨겨진 인물, 업적으로만 얻을 수 있습니다.`;return;}
  const shown=list.filter(it=>eqUI.filt==='all'||itSlot(it)===eqUI.filt);
  grid.innerHTML=shown.map(it=>cellHTML(it,eqUI.sel&&eqUI.sel.id===it.id)).join('')||'<span class="sub" style="padding:8px">비어 있습니다</span>';
  grid.querySelectorAll('.cell').forEach(c=>c.onclick=()=>{eqUI.sel=list.find(x=>x.id==c.dataset.id);renderEquip();});
  renderEqDetail();
}
function renderEqDetail(){
  const d=$('eqdet'),it=eqUI.sel,h=eqUI.h;
  if(!it){d.innerHTML='<span class="sub">아이템을 누르면 자세한 정보가 나옵니다. 장비 칸을 누르면 그 부위만 보여줍니다. 아래 색 띠가 등급(일반·고급·희귀·영웅·전설), 숫자는 재질 단계(1 청동·참나무 → 5 미스릴·별빛)입니다.</span>';return;}
  const B=itBase(it),slot=itSlot(it),cur=h&&h.eq&&h.eq[slot],worn=h&&cur&&cur.id===it.id,inShop=eqUI.tab==='shop';
  const owner=heroes.find(x=>x.eq&&x.eq[slot]&&x.eq[slot].id===it.id);
  d.innerHTML=`<div style="display:flex;gap:10px"><div>${icoHTML(it,'s2')}</div><div style="flex:1">
    <b style="color:${IRAR[it.r].c};font-size:15px">${it.n}</b> <span class="sub">[${IRAR[it.r].n}] ${SLOTN[slot]} · ${ID.CLS[itCls(it)].n}${it.u?'':` · ${it.t}단계`}</span><br>
    ${stLines(it,h)}<br>${h?`${h.name.replace(/'.*?' /,'')}에게: ${fitTxt(itFit(it,h))}`:''}
    ${it.u?`<br><i class="sub">${UNIQ[it.u].d}</i>`:''}${it.cursed?'<br><span class="ineg">저주: 강하지만 체력과 매력이 깎입니다</span>':''}
    ${cur&&!worn?`<br><span class="sub">지금 장착: ${cur.n} — ${stLines(cur,h)}</span>`:''}
    ${owner&&!worn?`<br><span class="sub">${owner.name}이(가) 장착 중</span>`:''}
    <div class="filt" style="margin-top:6px" id="eqbtn"></div></div></div>`;
  const bx=$('eqbtn'),B2=(t,f,dis,ghost)=>{const b=document.createElement('button');b.className=ghost?'ghost':'';b.innerHTML=t;b.disabled=!!dis;b.onclick=f;bx.appendChild(b);};
  if(inShop){const pr=shopPrice(it);B2(`구매 💰${pr}`,()=>{if(goldNow()<pr)return toast('돈이 부족합니다');if(inv().length>=INVMAX)return toast('가방이 가득 찼습니다');goldAdd(-pr);prog.shop.items=prog.shop.items.filter(x=>x!==it);inv().push(it);toast(`${it.n} 구매`);eqUI.sel=null;renderEquip();save();},goldNow()<pr);return;}
  if(worn)B2('해제',()=>{if(inv().length>=INVMAX)return toast('가방이 가득 찼습니다');delete h.eq[slot];inv().push(it);applyCiv();renderEquip();save();});
  else if(h){B2(`${h.name.replace(/'.*?' /,'')}에게 장착`,()=>{
    heroes.forEach(x=>{if(x.eq&&x.eq[slot]&&x.eq[slot].id===it.id)delete x.eq[slot];});
    prog.inv=inv().filter(x=>x.id!==it.id);if(cur)inv().push(cur);h.eq=h.eq||{};h.eq[slot]=it;applyCiv();renderEquip();save();});}
  if(!worn&&!owner){const v=Math.round(itVal(it)*.4);B2(`판매 💰${v}`,function(){if(it.u&&!this._arm){this._arm=1;this.innerHTML='전설 장비입니다. 정말 팔까요?';return;}prog.inv=inv().filter(x=>x.id!==it.id);goldAdd(v);eqUI.sel=null;renderEquip();save();},false,true);}
}
function levelUp(h,xp,log){
  if(h.lv>=h.cap){h.xp=0;return;}
  h.xp+=Math.round(xp*(has(h,'학자')?1.25:1));
  while(h.lv<h.cap&&h.xp>=heroNeed(h)){h.xp-=heroNeed(h);h.lv++;sfx('levelup',.35,800);if(log)log.push(`⬆ ${h.name} 레벨 업! Lv${h.lv}${h.lv>=h.cap?' (최대 도달)':''}`);
    if(h.king&&prog.king){prog.king.무예+=2;prog.king.통솔+=1;const k=pick(['지략','매력','내정']);prog.king[k]+=1;if(log)log.push(`👑 왕의 능력치 성장: 무예 +2, 통솔 +1, ${k} +1`);}}
  if(h.lv>=h.cap)h.xp=0;
  h.wage=heroWage(h);
}
const MAX_ROSTER=6;
let heroes=[],tavern=[],rivals=[];   // heroes = 내 장수단, rivals[i] = PRESETS[i]의 장수들
let heroUnits=[],pending=null,evs=[],autoSkill=true,autoT=0;
/* 부대 숙련도: ★0~3, 단계마다 공격·체력 +10% */
const VET=[0,40,100,180];
const starOf=xp=>xp>=VET[3]?3:xp>=VET[2]?2:xp>=VET[1]?1:0;
const starTxt=n=>n?'★'.repeat(n):'';
const prog={wins:0,gold:400,month:1};
let SLOT=1;try{SLOT=+localStorage.getItem('throne-road-slot')||1;}catch(_){}
const slotKey=n=>'throne-road-v2-s'+(n||SLOT);
try{const old=localStorage.getItem('throne-road-v2');if(old){if(!localStorage.getItem(slotKey(1)))localStorage.setItem(slotKey(1),old);localStorage.removeItem('throne-road-v2');}}catch(_){}
function save(){
  try{
    const src=state==='deploy'?squads:(deploySnap||squads);
    const strip=h=>{const o={...h};delete o.cdLeft;delete o.downed;return o;};
    localStorage.setItem(slotKey(),JSON.stringify({at:Date.now(),
      squads:src.map(q=>({id:q.id,type:q.type,n:q.n,cx:q.cx,cy:q.cy,num:q.num,label:q.label,xp:q.xp||0})),
      heroes:heroes.map(strip),tavern:tavern.map(strip),rivals:rivals.map(r=>r.map(strip)),prog,autoSkill,hid,
      world:{seed:mapSeed,regs:REG.map(r=>[r.owner,r.cap?1:0,r.bld||[],r.rare||null,r.up||{}]),nations},pendingInv}));
  }catch(_){}
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(slotKey())||'null');
    if(!d||!d.prog)return false;
    for(const k in prog)delete prog[k];Object.assign(prog,{wins:0,gold:400,month:1});NATIONS[0].name='나의 왕국';
    squads=(d.squads||[]).map(o=>({...o,sel:false,mode:'hold',focus:null}));
    sqid=Math.max(0,...squads.map(q=>q.id));
    heroes=d.heroes||[];tavern=d.tavern||[];rivals=d.rivals||[];Object.assign(prog,d.prog||{});
    autoSkill=d.autoSkill!==false;hid=d.hid||200;
    [...heroes,...tavern,...rivals.flat()].forEach(h=>{h.cdLeft=0;h.downed=false;});
    if(rivals.length!==PRESETS.length)genRivals();
    if(d.world&&d.world.seed){
      mapSeed=d.world.seed;genWorld(mapSeed);decorateWorld(mapSeed);
      d.world.regs.forEach((a,i)=>{const r=REG[i];if(!r)return;r.owner=a[0];
        if(Array.isArray(a[2])){r.cap=!!a[1];r.bld=a[2];if(a[3]!==undefined)r.rare=a[3];r.up=a[4]||{};}else{r.cap=!!a[2];r.bld=[];}});
      nations=d.world.nations||[];if(nations.length!==NATIONS.length)initNations();fixNations();
    }else{mapSeed=Math.floor(Math.random()*1e9);genWorld(mapSeed);decorateWorld(mapSeed);initNations();}
    if(!prog.goods)prog.goods=goodsInit();if(!prog.tax)prog.tax='mid';if(prog.morale==null)prog.morale=60;
    if(!prog.weather)prog.weather='clear';if(!prog.price)rollPrices();
    if(prog.kingdomName)NATIONS[0].name=prog.kingdomName;
    if(!prog.phase)prog.phase=2;
    pendingInv=d.pendingInv||null;
    buildMapArt();
    deploySnap=squads.map(q=>({...q}));
    syncCounts();
    heroes.forEach(h=>{if(h.sq&&!SQ[h.sq])h.sq=null;});
    return true;
  }catch(_){return false;}
}
const enemyMul=()=>1+Math.min(.4,prog.wins*.04);

/* ---------- 월드맵 ---------- */
const NATIONS=[
  {name:'나의 왕국',col:'#3f7be0'},{name:'베른 변경령',col:'#3d9a4a'},{name:'그라센 제국',col:'#d1a72a'},
  {name:'아르델 공국',col:'#26a6a0'},{name:'솔라리스 마도국',col:'#9a5ad8'},{name:'카르둔 왕국',col:'#c8453a'}
];
const NEUTRAL_COL='#8a8a78';
const BANDIT={name:'도적단',biome:'plains',c:{spear:5,cav:2,archer:3,mage:0}};
const MC=10,MGW=Math.ceil(W/MC),MGH=Math.ceil(H/MC);
const rmap=new Int16Array(MGW*MGH);
let REG=[],mapSeed=1,nations=[],battleCtx=null,selReg=-1,pendingInv=null,lastWin=false;
const mapC=document.createElement('canvas');mapC.width=W;mapC.height=H;
const ownerName=o=>o<0?'무주지 (도적 출몰)':NATIONS[o].name;
const ownerCol=o=>o<0?NEUTRAL_COL:NATIONS[o].col;
const regIncome=r=>regProd(r).gold;
const regsOf=o=>REG.filter(r=>r.owner===o);
const myRegs=()=>regsOf(0);
const adjToPlayer=r=>r.adj.some(i=>REG[i].owner===0);
const armyBudget=()=>prog.phase===1?999:Math.round(80+12*myRegs().length+(kst('통솔')-50)*.4+15*myRegs().filter(r=>(r.bld||[]).includes('barracks')).length-(isOrigin('mage')?Math.round(10*conM()):0)+MOD('budget'));
const canAttack=r=>r.owner!==0&&adjToPlayer(r)&&!(r.owner>0&&nations[r.owner].rel==='peace');
const regionAt=p=>{const i=Math.floor(p.x/MC),j=Math.floor(p.y/MC);return(i<0||j<0||i>=MGW||j>=MGH)?-1:rmap[j*MGW+i];};
const BNAME={plains:['평원','들판','마을'],forest:['숲','수림','숲길'],highland:['고원','산성','고개'],river:['강변','여울','나루'],marsh:['늪지','습원','갈대밭']};
function srng(seed){let q=(Math.abs(seed)%2147483646)+1;return()=>(q=(q*16807)%2147483647)/2147483647;}
function genWorld(seed){
  const R=srng(seed),cx=W/2,cy=H/2,ax=W*.47,ay=H*.45;
  const NW=22,NH=13,nz=[];for(let i=0;i<NW*NH;i++)nz.push(R());
  const noise=(x,y)=>{x=((x%W)+W)%W;y=((y%H)+H)%H;const fx=x/W*(NW-1),fy=y/H*(NH-1),x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0;
    const g=(a,b)=>nz[Math.min(NH-1,b)*NW+Math.min(NW-1,a)];
    return(g(x0,y0)*(1-tx)+g(x0+1,y0)*tx)*(1-ty)+(g(x0,y0+1)*(1-tx)+g(x0+1,y0+1)*tx)*ty;};
  let pts=[],tries=0;
  while(pts.length<26&&tries<8000){tries++;const x=cx+(R()*2-1)*ax,y=cy+(R()*2-1)*ay;
    if(((x-cx)/ax)**2+((y-cy)/ay)**2>.74)continue;if(pts.some(p=>Math.hypot(p.x-x,p.y-y)<150))continue;pts.push({x,y});}
  for(let pass=0;pass<3;pass++){
    const cnt=pts.map(()=>0);
    for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
      const px=(i+.5)*MC,py=(j+.5)*MC;
      const e=((px-cx)/ax)**2+((py-cy)/ay)**2+(noise(px,py)-.5)*.55;
      if(e>1){rmap[j*MGW+i]=-1;continue;}
      let best=0,bd=1e9;
      pts.forEach((p,k)=>{const d=Math.hypot(p.x-px,p.y-py)*(1+(noise(px+k*131,py+k*71)-.5)*.45);if(d<bd){bd=d;best=k;}});
      rmap[j*MGW+i]=best;cnt[best]++;
    }
    const keep=pts.filter((_,k)=>cnt[k]>=25);
    if(keep.length===pts.length)break;
    pts=keep;
  }
  const bk=Object.keys(BIOMES);
  REG=pts.map((p,i)=>{const b=bk[Math.floor(R()*bk.length)];
    return{id:i,x:0,y:0,biome:b,owner:-1,dev:1,cells:0,adj:[],edges:[],cap:false,name:pick2(R,NAME_A)+pick2(R,NAME_B)+' '+pick2(R,BNAME[b])};});
  const sx=REG.map(()=>0),sy=REG.map(()=>0);
  const addAdj=(a,b)=>{if(!REG[a].adj.includes(b))REG[a].adj.push(b);if(!REG[b].adj.includes(a))REG[b].adj.push(a);};
  for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
    const a=rmap[j*MGW+i];
    if(a>=0){REG[a].cells++;sx[a]+=(i+.5)*MC;sy[a]+=(j+.5)*MC;}
    if(i+1<MGW){const b=rmap[j*MGW+i+1];if(a!==b){const sg=[(i+1)*MC,j*MC,(i+1)*MC,(j+1)*MC];if(a>=0)REG[a].edges.push(sg);if(b>=0)REG[b].edges.push(sg);if(a>=0&&b>=0)addAdj(a,b);}}
    if(j+1<MGH){const b=rmap[(j+1)*MGW+i];if(a!==b){const sg=[i*MC,(j+1)*MC,(i+1)*MC,(j+1)*MC];if(a>=0)REG[a].edges.push(sg);if(b>=0)REG[b].edges.push(sg);if(a>=0&&b>=0)addAdj(a,b);}}
  }
  REG.forEach((r,k)=>{r.x=sx[k]/Math.max(1,r.cells);r.y=sy[k]/Math.max(1,r.cells);});
  // 수도: 서로 멀리 떨어진 6곳
  const caps=[Math.floor(R()*REG.length)];
  while(caps.length<6){let best=-1,bd=-1;REG.forEach(r=>{if(caps.includes(r.id))return;const d=Math.min(...caps.map(c=>Math.hypot(REG[c].x-r.x,REG[c].y-r.y)));if(d>bd){bd=d;best=r.id;}});caps.push(best);}
  caps.forEach((c,k)=>{REG[c].owner=k;REG[c].cap=true;if(k>0)REG[c].biome=PRESETS[k-1].biome;});
  const target=[3,3,6,3,4,4];
  let grew=true;
  while(grew){grew=false;
    for(let k=0;k<6;k++){
      const mine=REG.filter(r=>r.owner===k);if(mine.length>=target[k])continue;
      const cand=[];mine.forEach(r=>r.adj.forEach(i=>{if(REG[i].owner===-1)cand.push(i);}));
      if(cand.length){const t=REG[cand[Math.floor(R()*cand.length)]];t.owner=k;if(k>0&&R()<.5)t.biome=PRESETS[k-1].biome;grew=true;}
    }
  }
}
function pick2(R,a){return a[Math.floor(R()*a.length)];}
function initNations(){
  nations=NATIONS.map((_,k)=>{
    const others=[1,2,3,4,5].filter(x=>x!==k);
    return{rel:'neutral',peace:0,alive:true,att:rint(-10,15),trade:false,ally:false,
      want:k?pick(GK.filter(g=>g!==SPEC_OF[PRESETS[k-1].biome])):'grain',rival:k?pick(others):0,why:[]};
  });
}
function fixNations(){nations.forEach((n,k)=>{if(n.att==null){n.att=rint(-10,15);n.trade=false;n.ally=false;n.why=[];}
  if(!n.want&&k)n.want=pick(GK.filter(g=>g!==SPEC_OF[PRESETS[k-1].biome]));if(n.rival==null&&k)n.rival=pick([1,2,3,4,5].filter(x=>x!==k));});}
function checkElim(o,log){
  if(o>0&&nations[o].alive&&!regsOf(o).length){nations[o].alive=false;nations[o].rel='neutral';rivals[o-1]=[];log.push(`💀 ${NATIONS[o].name} 멸망!`);}
}
function enemyCountsFor(o){
  const p=o>0?PRESETS[o-1]:BANDIT,f=o>0?.75+.06*regsOf(o).length:Math.min(1.2,.8+.03*prog.month),c={};
  ORDER.forEach(t=>c[t]=Math.round(p.c[t]*f));
  return c;
}
const enemyCounts=()=>battleCtx?(battleCtx.p1?battleCtx.ec:enemyCountsFor(battleCtx.enemy)):preset.c;
/* ---------- 세계 지도 (월드박스풍 픽셀 지형) ---------- */
function worldArt(){
  const CS=2,TW=W/CS,TH=H/CS,R=srng(mapSeed+7);
  const NW=40,NH=24,nzA=[],nzB=[];for(let i=0;i<NW*NH;i++){nzA.push(R());nzB.push(R());}
  const vn=(arr,nw,nh,x,y)=>{const fx=x/TW*(nw-1),fy=y/TH*(nh-1),x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0,g=(a,b)=>arr[Math.min(nh-1,b)*nw+Math.min(nw-1,a)];
    const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);return(g(x0,y0)*(1-sx)+g(x0+1,y0)*sx)*(1-sy)+(g(x0,y0+1)*(1-sx)+g(x0+1,y0+1)*sx)*sy;};
  const fine=[];for(let i=0;i<160*90;i++)fine.push(R());
  const hN=(x,y)=>vn(nzA,NW,NH,x,y)*.65+vn(fine,160,90,x,y)*.35,jN=(x,y)=>vn(nzB,NW,NH,x,y);
  const regAt=(x,y)=>{const i=Math.floor(x*CS/MC),j=Math.floor(y*CS/MC);if(i<0||j<0||i>=MGW||j>=MGH)return -1;return rmap[j*MGW+i];};
  const N=TW*TH,reg=new Int16Array(N),bio=new Int16Array(N),land=new Uint8Array(N);
  const BK=['plains','forest','highland','river','marsh'];
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const i=y*TW+x,jx=(jN(x,y)-.5)*7,jy=(jN(x+300,y+170)-.5)*7;
    const r=regAt(x,y),rj=regAt(x+jx,y+jy);reg[i]=r;land[i]=rj>=0?1:0;const rb=rj>=0?rj:r;bio[i]=rb>=0?BK.indexOf(REG[rb].biome):-1;}
  // 바다/육지 거리
  const bfs=(isSrc)=>{const d=new Int16Array(N).fill(999),q=new Int32Array(N);let h=0,t=0;for(let i=0;i<N;i++)if(isSrc(i)){d[i]=0;q[t++]=i;}
    while(h<t){const i=q[h++],x=i%TW,y=(i/TW)|0,nd=d[i]+1;if(nd>40)continue;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=TW||yy>=TH)return;const k=yy*TW+xx;if(d[k]>nd){d[k]=nd;q[t++]=k;}});}return d;};
  const dsea=bfs(i=>!land[i]),dland=bfs(i=>land[i]);
  // 강
  const river=new Uint8Array(N);
  REG.forEach(r=>{if(r.biome!=='river'&&!(r.biome==='highland'&&R()<.5))return;let x=Math.round(r.x/CS+(R()-.5)*20),y=Math.round(r.y/CS+(R()-.5)*14);
    let dir=null;for(let s=0;s<500;s++){const i=y*TW+x;if(i<0||i>=N||!land[i])break;river[i]=1;if(s>30&&R()<.5&&x+1<TW&&land[i+1])river[i+1]=1;
      const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{const k=(y+dy)*TW+x+dx;return k>=0&&k<N&&!river[k]&&dsea[k]<=dsea[i];});
      if(!opts.length)break;let best=opts[0],bv=1e9;opts.forEach(o=>{const k=(y+o[1])*TW+x+o[0];const v=dsea[k]*1+(R()*2.2)+(dir&&o[0]===dir[0]&&o[1]===dir[1]?-.6:0);if(v<bv){bv=v;best=o;}});dir=best;x+=best[0];y+=best[1];}});
  // 색
  const hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
  const PAL={plains:['#7cc552','#6db948','#86cc5c'],forest:['#4c9a3a','#438f34','#55a443'],highland:['#a3a86a','#96a060','#aeb276'],river:['#78c54e','#6cb946','#82cc58'],marsh:['#6a9a58','#5f8e50','#74a462']};
  const PC={};Object.keys(PAL).forEach(k=>PC[k]=PAL[k].map(hex));
  const SEA=[hex('#5cb2e2'),hex('#438fcf'),hex('#3274b8'),hex('#285f9e')],SAND=hex('#e9d68e'),SAND2=hex('#d9c27a'),ROCK=hex('#8d8b85'),ROCK2=hex('#a9a69e'),ROCKD=hex('#6d6b66'),SNOW=hex('#f3f5f8'),RIV=hex('#4d9fdc'),PUD=hex('#4d7f88');
  const oc=REG.map(r=>r.owner>=0?hex(ownerCol(r.owner)):null);
  const img=new ImageData(TW,TH),D=img.data;
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const i=y*TW+x;let c;
    if(!land[i]){const d=dland[i];c=d<=2?SEA[0]:d<=6?SEA[1]:d<=14?SEA[2]:SEA[3];if(d>3&&jN(x*7,y*13)>.62&&(x+y*3)%23===0)c=SEA[0];}
    else{const b=BK[bio[i]]||'plains',h=hN(x,y),sh=hN(x-1,y-1)-h;
      if(river[i])c=RIV;
      else if(dsea[i]<=1&&b!=='marsh')c=dsea[i]<=0?SAND2:SAND;
      else if(b==='highland'&&h>.6){c=h>.74?SNOW:sh<-.004?ROCK2:sh>.004?ROCKD:ROCK;}
      else if(b==='marsh'&&jN(x*5,y*5)>.7)c=PUD;
      else{const p=PC[b];c=p[(h*17|0)%3];if(sh<-.006)c=p[2];else if(sh>.006)c=p[1];}
      const r=reg[i];if(r>=0&&oc[r]&&!river[i]){const a=REG[r].owner===0?.24:.17;c=[c[0]*(1-a)+oc[r][0]*a,c[1]*(1-a)+oc[r][1]*a,c[2]*(1-a)+oc[r][2]*a];}}
    D[i*4]=c[0];D[i*4+1]=c[1];D[i*4+2]=c[2];D[i*4+3]=255;}
  // 국경선
  const own=i=>{const r=reg[i];return r<0?-2:REG[r].owner;};
  for(let y=1;y<TH-1;y++)for(let x=1;x<TW-1;x++){const i=y*TW+x;if(!land[i]||reg[i]<0)continue;const o=own(i);
    let ext=false,intr=false;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const k=i+dy*TW+dx;if(reg[k]<0)return;if(own(k)!==o)ext=true;else if(reg[k]!==reg[i])intr=true;});
    if(ext&&o>=0){const c=oc[reg[i]];D[i*4]=c[0]*.75;D[i*4+1]=c[1]*.75;D[i*4+2]=c[2]*.75;}
    else if(ext){D[i*4]*=.7;D[i*4+1]*=.7;D[i*4+2]*=.7;}
    else if(intr&&(x+y)%2===0){D[i*4]*=.86;D[i*4+1]*=.86;D[i*4+2]*=.86;}}
  // 길: 이웃 지역 중심끼리
  const occ=new Uint8Array(N),put=(x,y,c)=>{if(x<0||y<0||x>=TW||y>=TH)return;const i=(y|0)*TW+(x|0);D[i*4]=c[0];D[i*4+1]=c[1];D[i*4+2]=c[2];};
  const ROAD=hex('#c9a86c'),ROADD=hex('#a8885a');
  const done=new Set();REG.forEach(a=>a.adj.forEach(bi=>{const b=REG[bi],key=Math.min(a.id,bi)+'-'+Math.max(a.id,bi);if(done.has(key))return;done.add(key);if(a.owner<0||a.owner!==b.owner)return;
    const ax=a.x/CS,ay=a.y/CS,bx=b.x/CS,by=b.y/CS,mx=(ax+bx)/2+(R()-.5)*16,my=(ay+by)/2+(R()-.5)*16,L=Math.hypot(bx-ax,by-ay)*1.3|0,pts=[];
    for(let s=0;s<=L;s++){const t=s/L,x=(1-t)*(1-t)*ax+2*(1-t)*t*mx+t*t*bx,y=(1-t)*(1-t)*ay+2*(1-t)*t*my+t*t*by,i=(y|0)*TW+(x|0);if(!land[i])return;pts.push([x|0,y|0,river[i]]);}
    pts.forEach(([x,y,rv])=>{put(x,y,rv?hex('#8a5a2a'):ROAD);occ[y*TW+x]=2;});}));
  // 작은 그림 찍기 (지형 픽셀 단위)
  const stamp=(x,y,rows,pal)=>{rows.forEach((row,dy)=>{for(let dx=0;dx<row.length;dx++){const ch=row[dx];if(ch==='.')continue;put(x+dx,y+dy,pal[ch]);occ[(y+dy)*TW+x+dx]=1;}});};
  const free=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=yy*TW+xx;if(xx<0||yy<0||xx>=TW||yy>=TH||!land[i]||river[i]||occ[i])return false;}return true;};
  // 마을
  REG.forEach(r=>{const cx=r.x/CS|0,cy=r.y/CS|0,owned=r.owner>=0,roof=owned?oc[r.id]:hex('#9a6a3a'),roofD=roof.map(v=>v*.7);
    const pal={R:roof,r:roofD,w:hex('#efe2c0'),d:hex('#5a3a1e'),s:hex('#c9b48a')};
    const H1=['.RR.','RRRR','rrrr','wdww'],H2=['.RRR.','RRRRR','rrrrr','wwdww','wwdww'];
    const n=r.cap?0:owned?5+Math.min(6,(r.bld||[]).length*2+(r.cells/60|0)):2+(r.cells/120|0);
    if(owned&&(r.biome==='plains'||r.biome==='river')){const fx=cx+(R()<.5?-16:8),fy=cy+6;if(free(fx,fy,8,5))for(let yy=0;yy<5;yy++)for(let xx=0;xx<8;xx++){put(fx+xx,fy+yy,yy%2?hex('#c8a848'):hex('#e2c860'));occ[(fy+yy)*TW+fx+xx]=1;}}
    let k=0;for(let t=0;t<200&&k<n;t++){const a=R()*6.28,d=4+R()*(r.cap?18:13),x=cx+Math.cos(a)*d*1.4|0,y=cy+Math.sin(a)*d|0,big=R()<.3,S=big?H2:H1;
      if(Math.abs(x-cx)<5&&Math.abs(y-cy)<4)continue;if(!free(x-1,y-1,S[0].length+2,S.length+2))continue;stamp(x,y,S,pal);k++;}
    if(r.cap){for(let a=0;a<6.28;a+=.06){const x=cx+Math.cos(a)*30|0,y=cy+Math.sin(a)*20|0;const i=y*TW+x;if(land[i]&&!river[i])put(x,y,hex('#8a867c'));}
      let m=0;for(let t=0;t<300&&m<14;t++){const a=R()*6.28,d=9+R()*16,x=cx+Math.cos(a)*d*1.4|0,y=cy+Math.sin(a)*d|0;if(!free(x-1,y-1,6,6))continue;stamp(x,y,H1,pal);m++;}}});
  // 나무·산
  const TREE=['.G.','GgG','GGG','.t.'],PINE=['.P.','PpP','PPP','.t.'];
  const tp={G:hex('#2f6e2a'),g:hex('#5aac44'),t:hex('#6a4426'),P:hex('#2a5a34'),p:hex('#4a8a4a')};
  for(let y=2;y<TH-5;y++)for(let x=2;x<TW-4;x++){const i=y*TW+x;if(!land[i]||river[i]||occ[i]||dsea[i]<2)continue;const b=BK[bio[i]],q=(jN(x*9,y*9)*1e4|0)%1000/1000,rr=R();
    const dens=b==='forest'?(q>.3?.09:.03):b==='marsh'?.012:b==='highland'?(hN(x,y)>.55?0:.012):b==='river'?.006:.004;
    if(rr<dens&&free(x,y,3,4))stamp(x,y,b==='highland'||b==='marsh'?PINE:TREE,tp);}
  const c2=document.createElement('canvas');c2.width=TW;c2.height=TH;c2.getContext('2d').putImageData(img,0,0);
  const g=mapC.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,W,H);g.drawImage(c2,0,0,W,H);
}
function tileMapArt(){
  const g=mapC.getContext('2d'),R=srng(mapSeed+7);g.imageSmoothingEnabled=false;
  const pat=c=>g.createPattern(c,'repeat');
  g.fillStyle=pat(tilePat('TilesetWater',1,7));g.fillRect(0,0,W,H);g.fillStyle='rgba(16,50,110,.42)';g.fillRect(0,0,W,H);
  for(let i=0;i<260;i++){g.fillStyle='rgba(255,255,255,.35)';g.fillRect(Math.floor(R()*W/2)*2,Math.floor(R()*H/2)*2,6,1);}
  const P={plains:pat(tilePat('TilesetFloor',0,12)),forest:pat(tilePat('TilesetFloor',11,12)),highland:pat(tilePat('TilesetFloor',1,1)),river:pat(tilePat('TilesetFloor',0,12)),marsh:pat(tilePat('TilesetFloor',12,12))};
  const deco=[];
  for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
    const k=rmap[j*MGW+i];if(k<0)continue;const r=REG[k],px=i*MC,py=j*MC,q=R();
    g.fillStyle=P[r.biome];g.fillRect(px,py,MC,MC);
    if(r.biome==='marsh'&&q<.25){g.fillStyle='rgba(60,120,140,.6)';g.fillRect(px+2,py+3,6,3);}
    if(r.biome==='river'&&q<.12){g.fillStyle='#6ac0e8';g.fillRect(px+1,py+4,8,2);}
    g.globalAlpha=r.owner<0?.08:r.owner===0?.32:.26;g.fillStyle=ownerCol(r.owner);g.fillRect(px,py,MC,MC);g.globalAlpha=1;
    const near=Math.hypot(px-r.x,py-r.y)<34;
    if(!near){if(r.biome==='forest'&&q<.07)deco.push([['tr0','tr1','tr8'][Math.floor(R()*3)],px,py]);
      else if(r.biome==='highland'&&q<.025)deco.push([R()<.5?'rockG':'rockB',px,py]);
      else if(r.biome==='plains'&&q<.012)deco.push(['tr0',px,py]);
      else if(r.biome==='marsh'&&q<.03)deco.push(['tr9',px,py]);}
  }
  const own=k=>k<0?-2:REG[k].owner;
  for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
    const a=rmap[j*MGW+i];
    const seg=(b,vert)=>{if(a===b)return;const x=vert?(i+1)*MC:i*MC,y=vert?j*MC:(j+1)*MC;let col,w;
      if(a<0||b<0){col='#f4ead0';w=3;}else if(own(a)!==own(b)){col='rgba(20,20,28,.85)';w=3;}else{col='rgba(0,0,0,.28)';w=1;}
      g.fillStyle=col;if(vert)g.fillRect(x-w/2,y,w,MC);else g.fillRect(x,y-w/2,MC,w);};
    if(i+1<MGW)seg(rmap[j*MGW+i+1],true);if(j+1<MGH)seg(rmap[(j+1)*MGW+i],false);
  }
  deco.sort((a,b)=>a[2]-b[2]).forEach(([k,x,y])=>{const S=SP[k],sc=S[3]>32?.66:1;g.drawImage(TS[S[0]],S[1],S[2],S[3],S[4],Math.round(x-S[3]*sc/2+5),Math.round(y-S[4]*sc+8),Math.round(S[3]*sc),Math.round(S[4]*sc));});
}
function buildMapArt(){
  if(tsReady())return worldArt();
  const g=mapC.getContext('2d'),R=srng(mapSeed+7);
  const BC={plains:'#8fbf5a',forest:'#3f7a3a',highland:'#a39a6a',river:'#79b0c8',marsh:'#5f7a55'};
  g.fillStyle='#1d4a72';g.fillRect(0,0,W,H);
  for(let i=0;i<1600;i++){g.fillStyle=R()<.5?'#245785':'#1a4268';g.fillRect(Math.floor(R()*W/4)*4,Math.floor(R()*H/4)*4,6,2);}
  for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
    const k=rmap[j*MGW+i];if(k<0)continue;
    const r=REG[k],px=i*MC,py=j*MC,q=R();
    g.fillStyle=BC[r.biome];g.fillRect(px,py,MC,MC);
    g.globalAlpha=r.owner<0?.12:r.owner===0?.6:.45;g.fillStyle=ownerCol(r.owner);g.fillRect(px,py,MC,MC);g.globalAlpha=1;
    if(r.biome==='forest'&&q<.35){g.fillStyle='#1f4a22';g.fillRect(px+3,py+2,4,5);g.fillStyle='#4a2e14';g.fillRect(px+4,py+7,2,2);}
    else if(r.biome==='highland'&&q<.16){g.fillStyle='#6d6450';g.beginPath();g.moveTo(px+1,py+9);g.lineTo(px+5,py+2);g.lineTo(px+9,py+9);g.fill();g.fillStyle='#f2f2f2';g.fillRect(px+4,py+2,2,2);}
    else if((r.biome==='river'||r.biome==='marsh')&&q<.2){g.fillStyle='#3d78b0';g.fillRect(px+2,py+4,6,2);}
    else if(r.biome==='plains'&&q<.06){g.fillStyle='#d9c86a';g.fillRect(px+3,py+3,2,2);}
  }
  const own=k=>k<0?-2:REG[k].owner;
  for(let j=0;j<MGH;j++)for(let i=0;i<MGW;i++){
    const a=rmap[j*MGW+i];
    const seg=(b,vert)=>{
      if(a===b)return;
      const x=vert?(i+1)*MC:i*MC,y=vert?j*MC:(j+1)*MC;
      let col,w;
      if(a<0||b<0){col='#e8d9a8';w=2;}else if(own(a)!==own(b)){col='#14141c';w=3;}else{col='rgba(0,0,0,.35)';w=1;}
      g.fillStyle=col;if(vert)g.fillRect(x-w/2,y,w,MC);else g.fillRect(x,y-w/2,MC,w);
    };
    if(i+1<MGW)seg(rmap[j*MGW+i+1],true);
    if(j+1<MGH)seg(rmap[(j+1)*MGW+i],false);
  }
}
function drawMap(z){
  ctx.drawImage(mapC,0,0);
  const tint=['rgba(255,190,220,.05)',null,'rgba(255,150,40,.08)','rgba(225,238,255,.2)'][seasonIdx()];
  if(tint){ctx.fillStyle=tint;ctx.fillRect(0,0,W,H);}
  drawMents(z);
  const ts=Math.max(1,.9/z);
  const outline=(r,col,w)=>{ctx.fillStyle=col;r.edges.forEach(([x1,y1,x2,y2])=>{if(x1===x2)ctx.fillRect(x1-w/2,y1,w,y2-y1);else ctx.fillRect(x1,y1-w/2,x2-x1,w);});};
  myRegs().forEach(r=>outline(r,'rgba(140,190,255,.95)',2.5*ts));
  const hr=hover?regionAt(hover):-1;
  if(hr>=0&&hr!==selReg)outline(REG[hr],'rgba(255,255,255,.75)',2*ts);
  if(selReg>=0&&REG[selReg])outline(REG[selReg],'#ffd34d',3.5*ts);
  ctx.textAlign='center';ctx.lineJoin='round';
  const blink=.6+.4*Math.sin(performance.now()/250);
  REG.forEach(r=>{
    if(r.cap&&r.owner>=0){
      const pl=r.owner===0?cityLv('palace'):0,s=ts*(1+pl*.22),x=r.x,y=r.y-6*s;
      if(tsReady()){const im=TS['Castle_'+castleCol(ownerCol(r.owner))],w=56*s,h=w*.8;ctx.imageSmoothingEnabled=true;ctx.drawImage(im,x-w/2,r.y+6*s-h,w,h);ctx.imageSmoothingEnabled=false;}else{ctx.fillStyle='#14141c';ctx.fillRect(x-9*s,y-9*s,18*s,12*s);
      ctx.fillStyle=pl>=4?'#e0b030':ownerCol(r.owner);ctx.fillRect(x-8*s,y-5*s,16*s,7*s);ctx.fillRect(x-8*s,y-8*s,4*s,4*s);ctx.fillRect(x-2*s,y-8*s,4*s,4*s);ctx.fillRect(x+4*s,y-8*s,4*s,4*s);
      ctx.fillStyle='#14141c';ctx.fillRect(x-2*s,y-2*s,4*s,4*s);}
    }
    if(r.owner===0)drawMiniBlds(r,ts);
    ctx.font=`${Math.round(10*ts)}px sans-serif`;ctx.fillText(GOODS[r.spec].icon+(r.rare?GOODS[r.rare].icon:''),r.x,r.y+36*ts);
    ctx.font=`800 ${Math.round(11*ts)}px sans-serif`;ctx.lineWidth=3*ts;ctx.strokeStyle='rgba(10,12,24,.92)';
    ctx.strokeText(r.name,r.x,r.y+24*ts);ctx.fillStyle=r.owner===0?'#cfe0ff':'#ffffff';ctx.fillText(r.name,r.x,r.y+24*ts);
    if(canAttack(r)){ctx.globalAlpha=blink;ctx.font=`${Math.round(15*ts)}px sans-serif`;ctx.strokeText('⚔',r.x+14*ts,r.y-10*ts);ctx.fillStyle='#ff6a5a';ctx.fillText('⚔',r.x+14*ts,r.y-10*ts);ctx.globalAlpha=1;}
  });
}
/* ---------- 왕국 경제 ---------- */
const GOODS={
  grain:{name:'곡물',icon:'🌾',base:4}, wood:{name:'목재',icon:'🪵',base:6}, iron:{name:'철',icon:'⛏',base:10},
  herb:{name:'약초',icon:'🌿',base:9}, horse:{name:'말',icon:'🐎',base:22}, mana:{name:'마정석',icon:'🔮',base:30}
};
const GK=Object.keys(GOODS);
const SPEC_OF={plains:'grain',forest:'wood',highland:'iron',river:'grain',marsh:'herb'};
const RARE_OF={plains:'horse',forest:'herb',highland:'mana',river:'horse',marsh:'mana'};
const SPEC_BASE={grain:5,wood:5,iron:3,herb:2};
const BUILD={
  farm:    {name:'농장',icon:'🌾',cost:{gold:80,wood:10},ok:r=>['plains','river','marsh'].includes(r.biome),out:{grain:9},txt:'곡물 +9 (가을 수확기에 크게 늘고 겨울엔 거의 없음)'},
  lumber:  {name:'벌목장',icon:'🪵',cost:{gold:70},ok:r=>['forest','highland','marsh'].includes(r.biome),out:{wood:8},txt:'목재 +8 (겨울 땔감 수요로 +20%)'},
  mine:    {name:'광산',icon:'⛏',cost:{gold:120,wood:20},ok:r=>r.biome==='highland'||r.rare==='mana',out:{iron:5},txt:'철 +5'},
  herbal:  {name:'약초원',icon:'🌿',cost:{gold:90,wood:10},ok:r=>['marsh','forest'].includes(r.biome)||r.rare==='herb',out:{herb:4},txt:'약초 +4 (봄·여름에 많고 겨울엔 절반)'},
  ranch:   {name:'목장',icon:'🐎',cost:{gold:140,wood:25},ok:r=>r.rare==='horse',out:{horse:2},txt:'말 +2 (말 산지 전용)'},
  crystal: {name:'마정석 채굴장',icon:'🔮',cost:{gold:200,iron:10},ok:r=>r.rare==='mana',out:{mana:1},txt:'마정석 +1 (마정석 산지 전용)'},
  market:  {name:'시장',icon:'⚖',cost:{gold:150,wood:20},ok:()=>true,out:{gold:35},txt:'금 +35, 시장 판매가 +5%'},
  harbor:  {name:'나루터 교역소',icon:'⛵',cost:{gold:160,wood:30},ok:r=>r.biome==='river',out:{gold:50},txt:'금 +50 (여름 +30%, 겨울 −40%, 폭풍 땐 0)'},
  barracks:{name:'병영',icon:'⚔',cost:{gold:150,wood:20,iron:10},ok:()=>true,out:{},txt:'군자금 한도 +15'},
  fort:    {name:'성채',icon:'🏯',cost:{gold:200,wood:40,iron:15},ok:()=>true,out:{},txt:'이 땅 방어전에서 아군 체력 +20%, 반란·도적 피해 방지'},
  temple:  {name:'신전',icon:'⛪',cost:{gold:120,wood:20},ok:()=>true,out:{},txt:'민심 +2/월'}
};
const slotsOf=r=>2+(r.cap?1:0);
const SEASONS=['봄','여름','가을','겨울'];
const calMonth=()=>((prog.month+1)%12)+1;
const seasonIdx=()=>{const m=calMonth();return m>=3&&m<=5?0:m>=6&&m<=8?1:m>=9&&m<=11?2:3;};
const SEAS_MUL=[{grain:.8,wood:1,herb:1.3,harbor:1},{grain:1.1,wood:1,herb:1.2,harbor:1.3},{grain:1.8,wood:1.1,herb:1,harbor:1.1},{grain:.15,wood:1.2,herb:.5,harbor:.6}];
const WEATHER={
  clear:{name:'맑음',icon:'☀',txt:'특별한 영향 없음'},
  rain:{name:'비',icon:'🌧',txt:'전투에서 화살·마법 피해 −20%'},
  storm:{name:'폭풍',icon:'⛈',txt:'나루터 수입 0, 전투에서 원거리 사거리 −25%'},
  drought:{name:'가뭄',icon:'🔥',txt:'곡물 생산 −50%, 민심 −2'},
  bounty:{name:'풍년',icon:'🌈',txt:'곡물 생산 +50%, 민심 +2'},
  snow:{name:'눈',icon:'❄',txt:'전투에서 이동 −15%'},
  frost:{name:'혹한',icon:'🥶',txt:'곡물 생산 0, 민심 −3, 전투에서 이동 −20%'}
};
const WEATHER_ROLL=[[['clear',.55],['rain',.35],['storm',.1]],[['clear',.5],['rain',.2],['storm',.12],['drought',.18]],[['clear',.55],['rain',.2],['bounty',.25]],[['clear',.35],['snow',.45],['frost',.2]]];
function rollWeather(){let x=Math.random();for(const [k,q] of WEATHER_ROLL[seasonIdx()]){x-=q;if(x<=0)return k;}return 'clear';}
const TAX={low:{name:'낮음',mul:.7,mor:3,txt:'세금 −30%, 민심 +3/월'},mid:{name:'보통',mul:1,mor:0,txt:'기본'},high:{name:'높음',mul:1.35,mor:-4,txt:'세금 +35%, 민심 −4/월'}};
const ORIGINS={
  soldier:{name:'군인 출신',desc:'전장에서 공을 세워 왕좌에 올랐다',type:'cav',st:{무예:78,통솔:70,지략:40,매력:45,내정:30},pro:'왕이 출전하면 아군 전체 공격 +10%',con:'행정에 서툴러 영토 수입 −10%'},
  merchant:{name:'상인 출신',desc:'돈과 인맥으로 왕관을 샀다',type:'spear',st:{무예:30,통솔:42,지략:58,매력:68,내정:82},pro:'무역 수입 +30%, 시장에서 비싸게 팔고 싸게 산다',con:'장수들이 얕봐 충성이 매달 −1'},
  noble:{name:'귀족 출신',desc:'혼인과 계승으로 정통성을 얻었다',type:'cav',st:{무예:48,통솔:65,지략:52,매력:78,내정:55},pro:'외교 호감 상승 +50%',con:'백성과 거리가 멀어 민심 −1/월'},
  mage:{name:'마법사 출신',desc:'마탑의 섭정을 거쳐 즉위했다',type:'mage',st:{무예:25,통솔:40,지략:88,매력:50,내정:52},pro:'아군 마법사 피해 +20%, 매달 마정석 +1',con:'병사들이 불신해 군자금 한도 −10'},
  rebel:{name:'반란군 출신',desc:'옛 왕조를 무너뜨리고 새 나라를 세웠다',type:'spear',st:{무예:66,통솔:58,지략:45,매력:62,내정:35},pro:'민심 +2/월, 방어전에서 아군 공격 +10%',con:'주변국이 경계해 모든 나라 호감 −15로 시작'}
};
const KSTAT=['무예','통솔','지략','매력','내정'];
const KDESC={무예:'왕이 직접 싸울 때의 공격·체력',통솔:'군자금 한도 (+0.4/점)',지략:'아군 장수 스킬 쿨타임 (최대 −20%)',매력:'외교 호감 상승, 장수 고용비, 70 이상이면 장수 충성 +1/월',내정:'영토 금 수입 (±0.5%/점)'};
const kst=k=>((prog.king&&prog.king[k])||50)+(prog.phase===2&&typeof civOf==='function'?(civOf(heroes.find(h=>h.king))[k]||0):0);
const isOrigin=o=>prog.origin===o;
const TIERS=[{n:'순탄한 길',pro:1,con:1},{n:'평범한 길',pro:1.15,con:.85},{n:'험난한 길',pro:1.3,con:.65},{n:'전설적인 역경',pro:1.5,con:.45}];
const proM=()=>TIERS[prog.originTier||0].pro,conM=()=>TIERS[prog.originTier||0].con;
const chaMul=()=>(1+(kst('매력')-50)/100)*(isOrigin('noble')?1+.5*proM():1);
const admMul=()=>(1+(kst('내정')-50)/200)*(isOrigin('soldier')?1-.1*conM():1);
const goodsInit=()=>({grain:80,wood:40,iron:15,herb:6,horse:4,mana:2});
function regProd(r){
  const o={gold:20,grain:0,wood:0,iron:0,herb:0,horse:0,mana:0},S=SEAS_MUL[seasonIdx()],w=prog.weather,safe={};
  if(r.spec)o[r.spec]+=SPEC_BASE[r.spec]||0;
  let harbor=0;
  (r.bld||[]).forEach(b=>{const B=BUILD[b];if(!B)return;const e=upEff(r,b),pm=1+(e.pm||0);
    if(b==='harbor')harbor+=B.out.gold*(1+(e.gm||0));
    else for(const k in B.out){o[k]+=B.out[k]*(k==='gold'?1+(e.gm||0):pm);if(e.safe)safe[k]=1;}
    o.gold+=e.g||0;o.herb+=e.herb||0;});
  const gw=S.grain*(w==='drought'?.5:w==='bounty'?1.5:w==='frost'?0:1);
  o.grain*=safe.grain?Math.max(.7,gw):gw;o.wood*=safe.wood?Math.max(.9,S.wood):S.wood;o.herb*=safe.herb?Math.max(.8,S.herb):S.herb;
  o.gold+=harbor*S.harbor*(w==='storm'?0:1);
  for(const k in o)o[k]=Math.round(o[k]);
  return o;
}
const morMul=()=>.6+.8*prog.morale/100;
const soldierCount=()=>ORDER.reduce((a,t)=>a+(counts[t]||0),0);
const grainUpkeep=()=>Math.ceil(soldierCount()/2)+heroes.length;
function tradeIncome(){let g=0;for(let k=1;k<NATIONS.length;k++){const n=nations[k];if(n&&n.alive&&n.trade)g+=12+4*regsOf(k).length;}return Math.round(g*(isOrigin('merchant')?1+.3*proM():1)*(1+MOD('trade')));}
function kingdomForecast(){
  const t={gold:0,grain:0,wood:0,iron:0,herb:0,horse:0,mana:0};
  myRegs().forEach(r=>{const q=regProd(r);for(const k in t)t[k]+=q[k];});
  t.gold=Math.round(t.gold*TAX[prog.tax].mul*morMul()*admMul()*(1+MOD('gold')));
  ['grain','wood','iron','herb','horse','mana'].forEach(k=>{const v=Math.round(MOD(k));if(v)t[k]+=v;});
  if(isOrigin('mage'))t.mana+=Math.round(proM());
  t.trade=tradeIncome();t.upkeep=Math.round(grainUpkeep()*(1-Math.min(.5,MOD('upk'))));t.wages=heroes.reduce((a,h)=>a+(h.wage||0),0);
  return t;
}
const tradeCount=()=>nations.filter((n,k)=>k>0&&n.alive&&n.trade).length;
const marketCount=()=>myRegs().filter(r=>(r.bld||[]).includes('market')).length;
function priceOf(g){let q=GOODS[g].base*((prog.price&&prog.price[g])||1);if(g==='grain')q*=[1,1.1,.7,1.5][seasonIdx()];return q;}
const sellPrice=g=>Math.max(1,Math.round(priceOf(g)*.8*(1+.05*tradeCount()+.05*marketCount())*(isOrigin('merchant')?1+.15*proM():1)*(1+MOD('sell'))));
const buyPrice=g=>Math.max(1,Math.round(priceOf(g)*1.25*(isOrigin('merchant')?1-.1*proM():1)));
function rollPrices(){prog.price={};GK.forEach(g=>prog.price[g]=+(.8+Math.random()*.45).toFixed(2));}
const canBuild=(r,b)=>BUILD[b].ok(r)&&!(r.bld||[]).includes(b);
const affordable=c=>Object.entries(c).every(([k,v])=>k==='gold'?prog.gold>=v:(prog.goods[k]||0)>=v);
function pay(c){for(const [k,v] of Object.entries(c)){if(k==='gold')prog.gold-=v;else prog.goods[k]-=v;}}
const costTxt=c=>Object.entries(c).map(([k,v])=>k==='gold'?`💰${v}`:`${GOODS[k].icon}${v}`).join(' ');
const hireCost=h=>Math.max(10,Math.round(h.cost*(1-(kst('매력')-50)/300)*(1-MOD('hire'))));
const fmtGoods=o=>GK.filter(g=>o[g]).map(g=>`${GOODS[g].icon}${o[g]>0?'+':''}${o[g]}`).join(' ');
// 지역 특산물·희귀 자원·초기 건물 (지도 시드로 결정)
function decorateWorld(seed){
  const R=srng(seed+99);
  REG.forEach(r=>{
    r.spec=SPEC_OF[r.biome];r.rare=R()<.33?RARE_OF[r.biome]:null;
    const allowed=Object.keys(BUILD).filter(b=>BUILD[b].ok(r)&&BUILD[b].out&&Object.keys(BUILD[b].out).length);
    r.bld=(r.owner>0&&R()<.5&&allowed.length)?[allowed[Math.floor(R()*allowed.length)]]:[];
  });
}
/* ---------- 왕도 발전 (구역 4단계 × 선택지) ---------- */
const CITY={
  palace:{n:'왕궁',ic:'👑',desc:'왕도의 심장. 왕궁 단계가 다른 구역의 최대 단계가 됩니다.',lv:[
    [{n:'알현실',e:{att:1}},{n:'집무실',e:{gold:.05}},{n:'근위대 막사',e:{budget:10}}],
    [{n:'대연회장',e:{att:1,loy:1}},{n:'왕실 금고',e:{gold:.08}},{n:'왕실 마구간',e:{horse:1,budget:5}}],
    [{n:'왕립 법원',e:{mor:1,rebel:.5}},{n:'재무청',e:{gold:.1,trade:.1}},{n:'작전 사령부',e:{atk:.05}}],
    [{n:'황금 궁전',e:{gold:.1,att:1,mor:1}},{n:'천공의 왕좌',e:{hp:.08,atk:.05}},{n:'대륙 의회장',e:{att:2,trade:.2}}]]},
  wall:{n:'성벽',ic:'🧱',desc:'왕도를 두르는 성벽. 단계마다 목책 → 석벽 → 이중 성벽 → 백색 성벽으로 바뀝니다.',lv:[
    [{n:'목책',e:{dhp:.1}},{n:'감시탑',e:{rebel:.3,dat:.05}},{n:'해자',e:{dhp:.06,grain:3}}],
    [{n:'석벽',e:{dhp:.15}},{n:'성문 망루',e:{dat:.08}},{n:'성벽 장터',e:{gold:.04,dhp:.05}}],
    [{n:'이중 성벽',e:{dhp:.2}},{n:'투석기 탑',e:{dat:.12}},{n:'성벽 순찰대',e:{rebel:.5,mor:1}}],
    [{n:'난공불락',e:{dhp:.3}},{n:'마법 결계',e:{hp:.06,mana:1}},{n:'개선문',e:{mor:2,att:1}}]]},
  trade:{n:'상업 구역',ic:'⚖',desc:'시장과 상인들의 거리. 금과 무역이 늘어납니다.',lv:[
    [{n:'노천 시장',e:{gold:.05},a:'market'},{n:'대장간 거리',e:{iron:3},a:'forge'},{n:'여관 거리',e:{hire:.1},a:'tavern'}],
    [{n:'상인 길드',e:{sell:.08},a:'guild'},{n:'은행',e:{gold:.08},a:'bank'},{n:'대상단 숙소',e:{trade:.15},a:'stable'}],
    [{n:'대시장',e:{gold:.08,sell:.05},a:'market'},{n:'조폐국',e:{gold:.12},a:'bank'},{n:'국제 교역소',e:{trade:.25,att:1},a:'guild'}],
    [{n:'황금 거래소',e:{gold:.15},a:'bank'},{n:'대륙 상업 연합',e:{trade:.3,sell:.1},a:'guild'},{n:'장인 지구',e:{wood:6,iron:6,gold:.05},a:'forge'}]]},
  army:{n:'군사 구역',ic:'⚔',desc:'병영과 훈련장. 군자금 한도와 전투력이 오릅니다.',lv:[
    [{n:'훈련장',e:{budget:10},a:'barracks'},{n:'궁술장',e:{atk:.03},a:'range'},{n:'마구간',e:{horse:1},a:'stable'}],
    [{n:'병영 단지',e:{budget:15},a:'barracks'},{n:'무기고',e:{atk:.05},a:'forge'},{n:'군량고',e:{upk:.15},a:'granary'}],
    [{n:'기사단 본부',e:{budget:20,atk:.03},a:'barracks'},{n:'전쟁 학교',e:{loy:1,atk:.05},a:'academy'},{n:'공성 공방',e:{atk:.08},a:'forge'}],
    [{n:'대원수부',e:{budget:30},a:'barracks'},{n:'영웅의 전당',e:{loy:2,hp:.05},a:'monument'},{n:'대투기장',e:{atk:.06,mor:1},a:'arena'}]]},
  faith:{n:'신앙·학문 구역',ic:'⛪',desc:'신전과 학당. 민심, 치유, 마법을 키웁니다.',lv:[
    [{n:'작은 예배당',e:{mor:1},a:'temple'},{n:'약초 정원',e:{heal:.25},a:'garden'},{n:'서고',e:{loy:1},a:'library'}],
    [{n:'대성당',e:{mor:2},a:'cathedral'},{n:'치유원',e:{heal:.4},a:'temple'},{n:'마법 학원',e:{mana:1},a:'tower'}],
    [{n:'순례길',e:{mor:1,gold:.05},a:'garden'},{n:'왕립 학술원',e:{gold:.06,att:1},a:'academy'},{n:'마탑',e:{mana:2},a:'tower'}],
    [{n:'천상의 대성전',e:{mor:3},a:'cathedral'},{n:'대도서관',e:{gold:.08,trade:.1},a:'library'},{n:'대마탑',e:{mana:2,atk:.05},a:'tower'}]]}
};
const CKEYS=Object.keys(CITY);
const CITY_COST=[{gold:150},{gold:350,wood:30},{gold:700,wood:50,iron:20},{gold:1300,iron:40,mana:5}];
const CITY_REQ=[1,3,6,10];
const PCT_K=['gold','trade','sell','atk','hp','dhp','dat','upk','hire','heal','rebel'];
const EFN={gold:'금 수입',trade:'무역 수입',sell:'시장 판매가',atk:'아군 공격',hp:'아군 체력',dhp:'방어전 아군 체력',dat:'방어전 아군 공격',upk:'군량 소비 −',hire:'장수 고용비 −',heal:'매달 부상 추가 회복 확률',rebel:'반란 위험 −',
  budget:'군자금 한도',mor:'민심/월',att:'모든 나라 호감/월',loy:'장수 충성/월',mana:'🔮마정석/월',grain:'🌾곡물/월',iron:'⛏철/월',wood:'🪵목재/월',horse:'🐎말/월',herb:'🌿약초/월',pm:'생산 ×',g:'금/월',gm:'금 수입 ×',safe:''};
function effTxt(e){return Object.entries(e).map(([k,v])=>k==='safe'?'계절·날씨 피해 최소화':k==='pm'||k==='gm'?`${EFN[k]}${(1+v).toFixed(1)}`:PCT_K.includes(k)?`${EFN[k]}${EFN[k].endsWith('−')?'':' +'}${Math.round(v*100)}%`:`${EFN[k]} +${v}`).join(', ');}
const cityLv=k=>((prog.city||{})[k]||[]).length;
const cityTotal=()=>CKEYS.reduce((a,k)=>a+cityLv(k),0);
/* 지역 건물 Lv2·Lv3 선택 업그레이드 */
const UCAT={farm:'prod',lumber:'prod',mine:'prod',herbal:'prod',ranch:'prod',crystal:'prod',market:'market',harbor:'market',barracks:'barracks',fort:'fort',temple:'temple'};
const UPG={
  prod:[[{n:'증산',e:{pm:.5}},{n:'교역 특화',e:{pm:.2,g:15}},{n:'튼튼한 설비',e:{pm:.3,safe:1}}],
        [{n:'대규모화',e:{pm:.5}},{n:'장인 공방',e:{g:30}},{n:'일자리 창출',e:{pm:.2,mor:1}}]],
  market:[[{n:'대상인 유치',e:{gm:.5}},{n:'세관',e:{trade:.08}},{n:'축제 광장',e:{mor:1}}],
          [{n:'은행 지점',e:{g:40}},{n:'국제 시장',e:{sell:.05}},{n:'상인 회관',e:{gm:.3,att:1}}]],
  barracks:[[{n:'정예 훈련',e:{budget:10}},{n:'장수 숙소',e:{loy:1}},{n:'징병소',e:{budget:6,mor:-0}}],
            [{n:'기사단',e:{budget:15}},{n:'군수 창고',e:{upk:.1}},{n:'무기 공방',e:{atk:.03}}]],
  fort:[[{n:'석벽 보강',e:{dhp:.1}},{n:'망루',e:{dat:.1}},{n:'주둔군',e:{budget:8}}],
        [{n:'요새 도시',e:{dhp:.15,g:15}},{n:'국경 수비대',e:{budget:12}},{n:'봉화대',e:{att:1}}]],
  temple:[[{n:'대성당',e:{mor:1}},{n:'치유원',e:{heal:.2}},{n:'순례지',e:{g:20}}],
          [{n:'성지',e:{mor:2}},{n:'수도원',e:{herb:3}},{n:'신탁소',e:{att:1}}]]
};
const GLOBAL_UK=['budget','loy','upk','atk','att','mor','heal','sell','trade','hire'];
const bLv=(r,b)=>1+(((r.up||{})[b])||[]).length;
function upEff(r,b){const o={},c=UPG[UCAT[b]];if(!c)return o;(((r.up||{})[b])||[]).forEach((i,l)=>{const opt=c[l]&&c[l][i];if(opt)for(const k in opt.e)o[k]=(o[k]||0)+opt.e[k];});return o;}
function upCost(r,b){const B=BUILD[b],l=bLv(r,b);return l===1?{gold:Math.round(B.cost.gold*1.2),wood:20}:{gold:Math.round(B.cost.gold*2),wood:20,iron:15};}
function MOD(k){
  let v=0;const c=prog.city||{};
  CKEYS.forEach(d=>(c[d]||[]).forEach((i,l)=>{const o=CITY[d].lv[l][i];if(o&&o.e[k])v+=o.e[k];}));
  if(GLOBAL_UK.includes(k)&&REG.length)myRegs().forEach(r=>(r.bld||[]).forEach(b=>{const e=upEff(r,b);if(e[k])v+=e[k];}));
  return v;
}
function regDef(rid){const r=REG[rid],o={dhp:0,dat:0};if(!r)return o;(r.bld||[]).forEach(b=>{const e=upEff(r,b);o.dhp+=e.dhp||0;o.dat+=e.dat||0;});return o;}
function renderCity(el){
  if(!prog.city)prog.city={};
  const n=myRegs().length,tot=cityTotal();
  {const wb=document.createElement('button');wb.className='big';wb.style.cssText='width:100%;margin-bottom:6px';wb.innerHTML='🚶 왕도를 직접 걸어 보기 (민심·시설 확인)';wb.onclick=()=>{const c=capOf(0)||myRegs()[0];if(c)enterKT(c.id);};el.appendChild(wb);}
  const top=document.createElement('div');top.className='rg';top.style.borderLeftColor='#ffd34d';
  const all={};CKEYS.forEach(d=>(prog.city[d]||[]).forEach((i,l)=>{const e=CITY[d].lv[l][i].e;for(const k in e)all[k]=(all[k]||0)+e[k];}));
  top.innerHTML=`<h3>🏰 ${prog.kingdomName||'왕국'}의 왕도 — 발전도 ${tot}/20</h3>
    <span class="sub">단계를 올릴 때마다 셋 중 하나를 골라 짓습니다 (고른 건 바꿀 수 없어요). 단계가 오를수록 왕도가 넓어지고, 집과 사람이 늘고, 건물이 웅장해집니다. 화면의 왕도 그림에 바로 반영돼요.</span>
    <div style="margin-top:4px">지금 효과: ${Object.keys(all).length?effTxt(all):'<span class="sub">없음</span>'}</div>`;
  el.appendChild(top);
  CKEYS.forEach(d=>{const D=CITY[d],L=cityLv(d),box=document.createElement('div');box.className='rg';box.style.borderLeftColor=L>=4?'#ffd34d':'#5fb3ff';
    const chosen=(prog.city[d]||[]).map((i,l)=>`<span class="bld">Lv${l+1} ${D.lv[l][i].n}</span>`).join('');
    box.innerHTML=`<b>${D.ic} ${D.n}</b> <span style="color:#ffe08a">Lv ${L}/4</span><br><span class="sub">${D.desc}</span><div>${chosen||'<span class="sub">아직 없음</span>'}</div>`;
    if(L<4){const cost=CITY_COST[L],why=d==='palace'?(n<CITY_REQ[L]?`영토 ${CITY_REQ[L]}개가 필요합니다 (지금 ${n})`:''):(L>=cityLv('palace')?`먼저 왕궁을 Lv ${L+1}로 올리세요`:'');
      box.insertAdjacentHTML('beforeend',`<div style="margin-top:4px"><b>Lv ${L+1}로 발전</b> — ${costTxt(cost)}${why?` <span class="danger">· ${why}</span>`:''}</div>`);
      const row=document.createElement('div');row.className='blist';
      D.lv[L].forEach((o,i)=>{const b=document.createElement('button');b.innerHTML=`<b>${o.n}</b><br><span class="sub">${effTxt(o.e)}</span>`;b.disabled=!!why||!affordable(cost);
        b.onclick=function(){if(!this._arm){this._arm=1;this.innerHTML=`<b>${o.n}</b> 짓기 — 한 번 더 누르기<br><span class="sub">${costTxt(cost)}</span>`;setTimeout(()=>{if(this.isConnected){this._arm=0;renderHub();}},2500);return;}
          if(!affordable(cost))return toast('자원이 부족합니다');pay(cost);(prog.city[d]=prog.city[d]||[]).push(i);citySc=null;toast(`${D.n} Lv${L+1}: ${o.n} 완공!`);renderHub();save();};row.appendChild(b);});
      box.appendChild(row);}
    else box.insertAdjacentHTML('beforeend','<div style="color:#ffd34d;margin-top:4px">✨ 최고 단계</div>');
    el.appendChild(box);});
}
/* 왕도 그림 */
let citySc=null;
const CSLOT={army:[[400,330],[300,460],[470,560],[330,650]],faith:[[1200,330],[1300,460],[1130,560],[1280,650]],trade:[[560,780],[1040,780],[660,690],[940,690]]};
function cityTileBg(R,ins,wl){
  const T=32,CW=Math.ceil(W/T),CH=Math.ceil(H/T),bg=document.createElement('canvas');bg.width=W;bg.height=H;
  const g=bg.getContext('2d');g.imageSmoothingEnabled=false;
  const t16=(im,sx,sy,dx,dy)=>g.drawImage(TS[im],sx*16,sy*16,16,16,dx,dy,32,32);
  const grid=new Int8Array(CW*CH),at=(x,y)=>x<0||y<0||x>=CW||y>=CH?-1:grid[y*CW+x],set=(x,y,v)=>{if(x>=0&&y>=0&&x<CW&&y<CH)grid[y*CW+x]=v;};
  const c0=Math.floor(ins[0]/T),c1=Math.floor(ins[2]/T),r0=Math.floor(ins[1]/T),r1=Math.floor(ins[3]/T);
  for(let y=r0;y<r1;y++)for(let x=c0;x<c1;x++)set(x,y,3);
  for(let x=0;x<CW;x++){set(x,18,1);set(x,19,1);}for(let y=11;y<CH;y++){set(24,y,1);set(25,y,1);}for(let x=c0;x<c1;x++)set(x,13,1);
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){t16('TilesetFloor',0,12,x*T,y*T);if(R()<.2)t16('TilesetFloor',1+Math.floor(R()*4),12,x*T,y*T);}
  const auto=(v,ox,oy,ix,iy)=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const q0=at(x,y);if(q0!==v&&!(v===3&&q0===1&&y>=r0&&y<r1&&x>=c0&&x<c1))continue;
    const s=(dx,dy)=>{const q=at(x+dx,y+dy);return q===v||q===-1||(v===3&&q===1&&y+dy>=r0&&y+dy<r1&&x+dx>=c0&&x+dx<c1);},m=(s(0,-1)?1:0)|(s(1,0)?2:0)|(s(0,1)?4:0)|(s(-1,0)?8:0),a=AUTO[m];
    t16('TilesetFloor',ox+a[0],oy+a[1],x*T,y*T);
    if(m===15){if(!s(1,1))t16('TilesetFloor',ix+1,iy+1,x*T,y*T);else if(!s(-1,1))t16('TilesetFloor',ix+2,iy+1,x*T,y*T);else if(!s(1,-1))t16('TilesetFloor',ix+1,iy+2,x*T,y*T);else if(!s(-1,-1))t16('TilesetFloor',ix+2,iy+2,x*T,y*T);}}};
  auto(3,0,0,4,0);   // 성 안: 모래빛 광장 바닥
  auto(1,0,7,4,7);   // 길
  for(let i=0;i<220;i++){const x=Math.floor(R()*CW),y=Math.floor(R()*CH);if(at(x,y))continue;
    if(R()<.5)g.drawImage(TS.TilesetNature,[0,16,32,96][Math.floor(R()*4)],176,16,16,x*T+Math.floor(R()*8),y*T+Math.floor(R()*8),32,32);
    else g.drawImage(TS.TilesetFloorDetail,Math.floor(R()*8)*16,32,16,16,x*T,y*T,32,32);}
  [[1,2,6,4],[42,2,6,4],[1,23,5,4],[44,23,5,4]].forEach(([x0,y0,w,h],i)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const cx=x===x0?0:x===x0+w-1?2:1,cy=y===y0?0:y===y0+h-1?2:1;t16('TilesetField',cx,cy+(i===1?3:0),x*T,y*T);
    if(R()<.75)g.drawImage(TS.TilesetFloorDetail,[0,16,48,80][Math.floor(R()*4)],32,16,16,x*T,y*T,32,32);}});
  // 성벽
  const H_=wl>0?[11,9]:[11,5],V_=wl>0?[11,8]:[11,4];
  const ring=(a0,b0,a1,b1)=>{for(let x=a0;x<=a1;x++){t16('TilesetHouse',H_[0],H_[1],x*T,b0*T-16);if(x<24||x>25)t16('TilesetHouse',H_[0],H_[1],x*T,b1*T-16);}
    for(let y=b0;y<b1;y++){if(y===18||y===19)continue;t16('TilesetHouse',V_[0],V_[1],a0*T-16,y*T);t16('TilesetHouse',V_[0],V_[1],a1*T+16,y*T);}};
  ring(c0,r0,c1-1,r1);if(wl>=3)ring(c0-1,r0-1,c1,r1+1);
  return bg;
}
const CKIND={atk:'barracks',arena:'fanArena',academy:'academy',cathedral:'cathedral',forge:'forge',stable:'stable',bank:'bank',guild:'guild',range:'range',garden:'garden',tower:'tower',temple:'temple',library:'library',market:'market',tavern:'tavernS',granary:'granary',monument:'monument'};
function buildCity(){
  const key=JSON.stringify(prog.city||{})+'|'+myRegs().length;if(citySc&&citySc.key===key)return citySc;
  const R=srng(mapSeed+555),rr=(a,b)=>a+R()*(b-a),nc=ownerCol(0),pl=cityLv('palace'),wl=cityLv('wall'),tot=cityTotal(),nreg=myRegs().length;
  const sc={key,list:[],folk:[]};
  const ins=[220,150,1380,830];
  if(tsReady())sc.bg=cityTileBg(R,ins,wl);else{
  const bg=document.createElement('canvas');bg.width=W;bg.height=H;const g=bg.getContext('2d');
  g.fillStyle='#8cc866';g.fillRect(0,0,W,H);for(let i=0;i<2600;i++){g.fillStyle=R()<.5?'#7eb85a':'#9cd476';g.fillRect(Math.floor(R()*W/2)*2,Math.floor(R()*H/2)*2,2,2);}
  [[30,60,220,130],[1350,60,220,130],[30,720,170,150],[1400,720,170,150]].forEach(([x,y,w,h],i)=>{for(let j=0;j<h;j+=6){g.fillStyle=j%12?['#c8b050','#9ab050','#b89050','#c8b050'][i]:'#8a7a40';g.fillRect(x,y+j,w,4);}});
  g.fillStyle='#d8c8a0';g.fillRect(ins[0],ins[1],ins[2]-ins[0],ins[3]-ins[1]);for(let i=0;i<3000;i++){g.fillStyle=R()<.5?'#cbb890':'#e4d6b0';g.fillRect(rr(ins[0],ins[2]-4),rr(ins[1],ins[3]-4),4,2);}
  for(let i=0;i<500;i++){g.fillStyle=R()<.15?'#ffb0c8':'#9cd476';g.fillRect(rr(ins[0],ins[2]-6),rr(ins[1],ins[3]-6),6,4);}
  const road=(x,y,w,h)=>{g.fillStyle='#6a5e48';g.fillRect(x-2,y-2,w+4,h+4);g.fillStyle='#c8b898';g.fillRect(x,y,w,h);for(let i=0;i<w*h/50;i++){g.fillStyle=R()<.5?'#b8a888':'#d8c8a8';g.fillRect(x+R()*(w-6),y+R()*(h-4),6,4);}};
  road(776,360,48,H-360);road(0,600,W,40);road(ins[0],420,ins[2]-ins[0],34);
  // 성벽
  if(wl>0){const wc=['#7a5a32','#9a9488','#a8a498','#ece6d8'][wl-1],th=[6,10,12,14][wl-1];
    const rect=(x,y,w,h)=>{g.fillStyle=hx(wc,.55);g.fillRect(x-1,y-1,w+2,h+2);g.fillStyle=wc;g.fillRect(x,y,w,h);g.fillStyle=hx(wc,1.15);g.fillRect(x,y,w,2);};
    rect(ins[0]-th,ins[1]-th,ins[2]-ins[0]+2*th,th);rect(ins[0]-th,ins[1],th,ins[3]-ins[1]);rect(ins[2],ins[1],th,ins[3]-ins[1]);
    rect(ins[0]-th,ins[3],776-ins[0]+th,th);rect(824,ins[3],ins[2]-824+th,th);
    rect(ins[0]-th,600,th,0);
    if(wl>=3){const o=22;g.globalAlpha=.9;rect(ins[0]-th-o,ins[1]-th-o,ins[2]-ins[0]+2*(th+o),6);rect(ins[0]-th-o,ins[1]-o,6,ins[3]-ins[1]+2*o);rect(ins[2]+th+o-6,ins[1]-o,6,ins[3]-ins[1]+2*o);rect(ins[0]-th-o,ins[3]+th+o-6,776-ins[0]+th+o,6);rect(824,ins[3]+th+o-6,ins[2]-824+th+o,6);g.globalAlpha=1;}
    g.fillStyle='#6a5e48';g.fillRect(776,ins[3]-2,48,th+4);
    if(wl>=2)[[ins[0]-th,ins[1]-th],[ins[2]-6,ins[1]-th],[ins[0]-th,ins[3]-6],[ins[2]-6,ins[3]-6]].forEach(([x,y])=>{});
  }else{for(let x=ins[0];x<ins[2];x+=10){g.fillStyle='#6a4a22';g.fillRect(x,ins[1],3,8);g.fillRect(x,ins[3],3,8);}}
  sc.bg=bg;}
  if(tsReady()){
    const placed=[],box=(x,y,w,h,m)=>[x-w/2-m,y-h-m,x+w/2+m,y+m],hit=b=>placed.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1]);
    const put=(kind,x,y,o,force)=>{const a=bArt(kind,o||{}),b=box(x,y,a.w,a.h,4);if(!force&&hit(b))return false;placed.push(b);sc.list.push({x,y,a});return true;};
    if(pl===0)put('hall',800,360,{roof:nc},1);else put('castle',800,370,{lv:pl,roof:nc,acc:nc},1);
    placed.push([768,0,832,H]);
    if(cityLv('wall')>=4&&(prog.city.wall||[])[3]===2)put('monument',800,560,{lv:3},1);
    if(wl>=2){[[ins[0]+20,ins[1]+30],[ins[2]-20,ins[1]+30],[ins[0]+20,ins[3]+6],[ins[2]-20,ins[3]+6]].forEach(([x,y])=>sc.list.push({x,y,a:bArt('watch',{acc:nc})}));}
    const Z={U1L:[360,236,500],U1R:[360,1100,1366],U2L:[568,236,764],U2R:[568,836,1366],LL:[826,236,764],LR:[826,836,1366]};
    const fit=(kind,o,zones)=>{const a=bArt(kind,o||{});for(const z of zones){const [y,x0,x1]=Z[z];for(let x=x0+a.w/2;x+a.w/2<=x1;x+=8){const b=box(x,y,a.w,a.h,6);if(!hit(b)){placed.push(b);sc.list.push({x,y,a});return true;}}}return false;};
    const PREF={army:['U2L','U1L','LL','U2R'],faith:['U2R','U1R','LR','U2L'],trade:['LR','LL','U2R','U2L']};
    ['army','faith','trade'].forEach(d=>(prog.city[d]||[]).forEach((i,l)=>{const o=CITY[d].lv[l][i];fit(CKIND[o.a]||o.a||'house2',{lv:l+1,roof:nc,acc:nc,v:l},PREF[d]);}));
    const nh=4+nreg+tot,ck=['cotR','cotB','cotG','cotP'];
    for(let k=0;k<nh;k++)if(!fit('cottage',{v:ck[(k*3+nreg)%4]},['LL','LR','U2L','U2R','U1L','U1R']))break;
    const trees=(x0,x1)=>{for(let x=x0,i=0;x<=x1;x+=66,i++)for(let y=230;y<H;y+=110){if(y>540&&y<700)continue;sc.list.push({x:x+((y/110|0)%2)*14,y,a:bArt('tree',{k:['fRound','oak','tr0'][(i+(y/110|0))%3]})});}};
    trees(50,ins[0]-90);trees(ins[2]+90,W-50);
  }else{
  const add=(kind,x,y,o)=>{const a=bArt(kind,o||{});sc.list.push({x,y,a});};
  // 왕궁
  if(pl===0)add('hall',800,350,{roof:nc});else add('castle',800,360+(pl>=3?20:0),{lv:pl,roof:nc,acc:nc});
  if(cityLv('wall')>=4&&(prog.city.wall||[])[3]===2)add('monument',740,820,{lv:3});
  if(wl>=2){[[ins[0]-6,ins[1]+6],[ins[2]+6,ins[1]+6],[ins[0]-6,ins[3]+8],[ins[2]+6,ins[3]+8],[760,ins[3]+8],[840,ins[3]+8]].forEach(([x,y])=>add('watch',x,y,{acc:nc}));}
  // 구역 상징 건물
  ['army','faith','trade'].forEach(d=>(prog.city[d]||[]).forEach((i,l)=>{const o=CITY[d].lv[l][i],[x,y]=CSLOT[d][l];add(o.a||'house2',x,y,{lv:l+1,roof:nc,acc:nc});}));
  // 집
  const occ=sc.list.map(o=>({x:o.x,y:o.y,fw:o.a.w*.95,fd:o.a.h*.8}));
  const nh=Math.min(70,10+nreg*3+tot*2),roofs=['#e8735a','#f0a050','#a88ae0','#5aa8d8','#e86a8a','#70b870',nc],walls=['#fff0d8','#ffe4e0','#f4f0e4','#e8f0ff','#fff8c8'];
  for(let i=0,k=0;i<1500&&k<nh;i++){const big=R()<.15+tot*.03,a=bArt(big?'house2':'house',{v:Math.floor(R()*6),roof:roofs[Math.floor(R()*roofs.length)],wall:walls[Math.floor(R()*walls.length)]});
    const x=rr(ins[0]+30,ins[2]-30),y=rr(ins[1]+60,ins[3]-6);
    if((y>404&&y-a.h*.6<460)||(Math.abs(x-800)<a.w/2+30&&y>360)||(y>590&&y-a.h*.6<645))continue;
    if(occ.some(o=>Math.abs(o.x-x)<(o.fw+a.w)/2+4&&y>o.y-o.fd-6&&y-a.h*.7<o.y+4))continue;
    occ.push({x,y,fw:a.w,fd:a.h*.75});sc.list.push({x,y,a});k++;}
  for(let i=0;i<40;i++){const x=R()<.5?rr(20,ins[0]-40):rr(ins[2]+40,W-20),y=rr(220,H-20);if(y>580&&y<660)continue;sc.list.push({x,y,a:bArt('tree',{v:Math.floor(R()*12)})});}
  }
  sc.list.sort((a,b)=>a.y-b.y);
  const nf=Math.min(60,12+nreg*2+tot*2);
  for(let i=0;i<nf;i++)sc.folk.push({x:rr(ins[0]+20,ins[2]-20),y:R()<.5?rr(424,450):rr(604,636),ch:FOLK_CH.concat(['Knight','Noble','Villager4'])[Math.floor(R()*17)],pal:randFolkPal(),kind:R()<.4?'d':'f',face:1,mv:false,tx:null,ty:null,w:R()*2,sp:rr(22,36)});
  for(let i=0;i<Math.min(6,tradeCount()+1);i++)sc.folk.push({x:rr(0,W),y:rr(606,634),ch:'Villager4',pal:{H:'#3f2414',S:'#e0aa7a',C:'#c8a060',B:'#7a3a2a',L:'#5a4a3a',F:'#2a1a10'},kind:'f',face:1,mv:false,tx:null,ty:null,w:0,sp:30,car:1});
  return citySc=sc;
}
function updCity(dt){
  const sc=citySc;if(!sc)return;
  for(const f of sc.folk){if(f.tx==null){f.w-=dt;f.mv=false;if(f.w<=0){if(f.car){f.tx=f.x<800?W+20:-20;f.ty=f.y;}else if(Math.random()<.5){f.tx=rnd(240,1360);f.ty=f.y<520?rnd(424,450):rnd(604,636);}else{f.tx=rnd(784,816);f.ty=rnd(380,820);}}continue;}
    const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);if(d<2){f.tx=null;f.w=rnd(.5,3);if(f.car){f.x=f.x>800?-20:W+20;}continue;}
    const s=Math.min(d,f.sp*dt),nx=f.x+dx/d*s,ny=f.y+dy/d*s;if(terrBlocked(nx,ny)){f.tx=null;f.goIn=false;f.w=rnd(.3,1.5);f.mv=false;continue;}f.x=nx;f.y=ny;f.face=dx>=0?1:-1;f.dir=dirOf(dx,dy);f.mv=true;}
}
/* ---------- 정적 장면 (왕도 탭·시작 화면) ---------- */
let cityTS=null,titleTS=null;
function buildStaticTown(seed,biome,nc,size,label){
  const save=town,R=srng(seed);
  town={home:-1,city:0,b:[],deco:[],folk:[],npcs:[],me:{x:-999,y:-999,path:[],face:1,dir:0,mv:false},near:null,open:null,camFree:0,top:40,nob:[]};
  const fp={home:1+(seed%5),city:0,name:'',week:0,month:0,npc:{}};
  tsLayoutTown(fp,{t:'capital',b:biome},'capital',biome,R,{size,tower:true},nc,true);
  town.bg=tsTownBg();
  const myc=castleCol(nc);
  for(let i=0;i<34;i++){const r=R(),onSt=R()<.6;town.folk.push({x:60+R()*(W-120),y:onSt?(R()<.5?500+R()*40:770+R()*20):300+R()*500,tsk:r<.65?'pawn':r<.8?'archer':r<.93?'warrior':'rpg',tsc:R()<.4?myc:TSC[Math.floor(R()*4)],face:R()<.5?1:-1,sz:.86+R()*.2,work:R()<.4?2+Math.floor(R()*2):0});}
  {const cb=town.b.find(b=>b.id==='castle');[-1,1].forEach(dx=>town.folk.push({x:800+dx*44,y:cb.y+10,st:1,tsk:'warrior',tsc:myc,face:-dx}));}
  town.label=label;const st=town;town=save;return st;
}
function drawStatic(st,z){const save=town;town=st;drawTSTown(z);
  const ts=Math.max(.8,.95/z);ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle='rgba(10,12,24,.9)';ctx.font=`800 ${Math.round(11*ts)}px sans-serif`;ctx.lineWidth=3.2*ts;
  if(st.showLabels)st.b.forEach(b=>{const y=b.y-b.a.h-6,s=`${b.ic} ${b.n}`;ctx.strokeText(s,b.x,y);ctx.fillStyle='#fff';ctx.fillText(s,b.x,y);});
  town=save;}
function drawCity(z){
  if(tsReady()){const pl=cityLv('palace'),tot=cityTotal(),key=pl+'|'+tot+'|'+myRegs().length;
    if(!cityTS||cityTS.key!==key){const cap=capOf(0)||myRegs()[0];cityTS=buildStaticTown(mapSeed+7,cap?cap.biome:'plains',NATIONS[0].col,pl>=3?'large':pl>=2?'medium':'small','');cityTS.key=key;cityTS.showLabels=true;
      cityTS.b.forEach(b=>{if(b.id==='castle')b.n='왕궁';if(b.id==='home')b.n='농가';});}
    drawStatic(cityTS,z);const ts=Math.max(1,.9/z);ctx.textAlign='center';ctx.font=`800 ${Math.round(16*ts)}px sans-serif`;ctx.lineWidth=4*ts;ctx.strokeStyle='rgba(10,12,24,.9)';
    const nm=`🏰 ${prog.kingdomName||''} 왕도 · 발전도 ${tot}/20`;ctx.strokeText(nm,800,26);ctx.fillStyle='#ffe08a';ctx.fillText(nm,800,26);drawWeather(prog.weather);return;}
  const sc=buildCity(),t=performance.now();ctx.imageSmoothingEnabled=false;ctx.drawImage(sc.bg,0,0);
  const L=sc.list.map(o=>({y:o.y,d:()=>ctx.drawImage(o.a.c,Math.round(o.x-o.a.w/2),Math.round(o.y-o.a.h))}));
  sc.folk.forEach(f=>L.push({y:f.y,d:()=>{if(f.ch&&tsReady())drawChar(f.ch,f.x,f.y,f.dir||0,f.mv,t);else drawFolk(f.x,f.y,f.pal,f.kind,f.face,f.mv,t);if(f.car){ctx.fillStyle='#8a5a2b';ctx.fillRect(f.x-f.face*16-6,f.y-12,12,10);ctx.fillStyle='#e8d8a8';ctx.fillRect(f.x-f.face*16-6,f.y-16,12,4);}}}));
  L.sort((a,b)=>a.y-b.y).forEach(o=>o.d());
  if((prog.city&&prog.city.wall||[])[3]===1){ctx.strokeStyle=`rgba(127,240,255,${.25+.15*Math.sin(t/400)})`;ctx.lineWidth=4;ctx.strokeRect(190,120,1220,740);}
  const ts=Math.max(1,.9/z);ctx.textAlign='center';ctx.font=`800 ${Math.round(16*ts)}px sans-serif`;ctx.lineWidth=4*ts;ctx.strokeStyle='rgba(10,12,24,.9)';
  const nm=`🏰 ${prog.kingdomName||''} 왕도 · 발전도 ${cityTotal()}/20`;ctx.strokeText(nm,800,110);ctx.fillStyle='#ffe08a';ctx.fillText(nm,800,110);
  ctx.font=`800 ${Math.round(12*ts)}px sans-serif`;
  [['⚔ 군사 구역',380,250,'army'],['⛪ 신앙·학문 구역',1220,250,'faith'],['⚖ 상업 구역',800,880,'trade']].forEach(([s,x,y,d])=>{ctx.strokeText(s+` Lv${cityLv(d)}`,x,y);ctx.fillStyle='#ffffff';ctx.fillText(s+` Lv${cityLv(d)}`,x,y);});
  drawWeather(prog.weather);
}
/* 지도 위 작은 건물 */
const MINIB={farm:'#e0c050',lumber:'#8a5a2b',mine:'#8a8a84',herbal:'#5ab05a',ranch:'#c8a060',crystal:'#9a6ae0',market:'#ff9a3a',harbor:'#3f8ae0',barracks:'#d94848',fort:'#b8b0a0',temple:'#f0ece0'};
const MINIS={farm:['fHay',.5],lumber:['tr1',.55],mine:['rockG',.42],herbal:['cPot1',1.4],ranch:[['Horse'],1.1],crystal:['tw9b',.55],market:['awn',.38],harbor:['boat',.24],barracks:['barn',.22],fort:['tw6',.55],temple:['fanSw',.2]};
function drawMiniBlds(r,ts){
  const sl=slotsOf(r),nb=(r.bld||[]).length,step=17*ts,x0=r.x-(sl-1)*step/2,by=r.y+(r.cap?62:52)*ts;
  if(!tsReady()){return drawMiniBlds0(r,ts);}
  ctx.imageSmoothingEnabled=true;
  for(let d=0;d<sl;d++){const x=x0+d*step;
    if(d>=nb){ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=ts;ctx.setLineDash([2*ts,2*ts]);ctx.strokeRect(x-5*ts,by-8*ts,10*ts,8*ts);ctx.setLineDash([]);continue;}
    const b=r.bld[d],l=bLv(r,b),M=MINIS[b];
    if(M){let im,sx,sy,sw,sh;if(Array.isArray(M[0])){im=cimg('assets/animals/Horse.png');sx=0;sy=0;sw=16;sh=16;}else{const S=SP[M[0]];im=TS[S[0]];sx=S[1];sy=S[2];sw=S[3];sh=S[4];}
      const k=M[1]*ts,w=sw*k,h=sh*k;ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(x,by,w*.4,2*ts,0,0,7);ctx.fill();ctx.drawImage(im,sx,sy,sw,sh,x-w/2,by-h,w,h);}
    for(let q=0;q<l;q++){ctx.fillStyle='#ffd34d';ctx.strokeStyle='#5a3a10';ctx.lineWidth=.6*ts;ctx.beginPath();ctx.arc(x+(q-(l-1)/2)*4*ts,by+3*ts,1.4*ts,0,7);ctx.fill();ctx.stroke();}}
  ctx.imageSmoothingEnabled=false;
}
function drawMiniBlds0(r,ts){
  const sl=slotsOf(r),nb=(r.bld||[]).length,step=9*ts,x0=r.x-(sl-1)*step/2,by=r.y+14*ts;
  for(let d=0;d<sl;d++){const x=x0+d*step;
    if(d>=nb){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=ts;ctx.strokeRect(x-3*ts,by-4*ts,6*ts,4*ts);continue;}
    const b=r.bld[d],l=bLv(r,b),h=(4+l*3)*ts,c=MINIB[b]||'#ccc';
    ctx.fillStyle='#14141c';ctx.fillRect(x-4*ts,by-h-3*ts,8*ts,h+3*ts);ctx.fillStyle=c;ctx.fillRect(x-3*ts,by-h,6*ts,h-1*ts);
    ctx.fillStyle=hx(c,.6);ctx.fillRect(x-3.5*ts,by-h-2*ts,7*ts,2.5*ts);if(l>=3){ctx.fillStyle='#ffd34d';ctx.fillRect(x-1*ts,by-h-4*ts,2*ts,2*ts);}}
}
function regUpgradeUI(r,host){
  if(!(r.bld||[]).length)return;
  const box=document.createElement('div');box.className='blist';
  box.insertAdjacentHTML('beforeend','<b style="font-size:13px">⬆ 건물 발전 (Lv3까지, 단계마다 하나 선택)</b>');
  r.bld.forEach(b=>{const B=BUILD[b],l=bLv(r,b),c=UPG[UCAT[b]],ch=((r.up||{})[b]||[]).map((i,k)=>c[k][i].n);
    box.insertAdjacentHTML('beforeend',`<div style="font-size:12px">${B.icon} <b>${B.name}</b> <span style="color:#ffe08a">Lv${l}</span>${ch.length?' · '+ch.join(' → '):''}</div>`);
    if(l<3&&c){const cost=upCost(r,b);c[l-1].forEach((o,i)=>{const bt=document.createElement('button');bt.innerHTML=`⬆ Lv${l+1} <b>${o.n}</b> — ${costTxt(cost)}<br><span class="sub">${effTxt(o.e)}</span>`;bt.disabled=!affordable(cost);
      bt.onclick=()=>{if(!affordable(cost))return toast('자원이 부족합니다');pay(cost);r.up=r.up||{};(r.up[b]=r.up[b]||[]).push(i);citySc=null;toast(`${r.name} ${B.name} Lv${l+1}: ${o.n}`);renderHub();save();};box.appendChild(bt);});}});
  host.appendChild(box);
}
function makeKing(origin){
  const s=ORIGINS[origin].st;
  return{id:'king',king:true,name:prog.kingName+' 왕',type:ORIGINS[origin].type,rarity:3,arche:'normal',cap:30,
    base:{STR:Math.round(s.무예*.55),VIT:Math.round(s.무예*.45+20),LEAD:Math.round(s.통솔*.6),INT:Math.round(s.지략*.6)},
    gain:{STR:1.6,VIT:1.6,LEAD:1.4,INT:1.4},traits:[],skill:'royal',aura:'atk',lv:1,xp:0,loyalty:100,injured:0,sq:null,
    cdLeft:0,downed:false,fought:false,captured:false,cost:0,wage:0};
}
function showOrigin(){
  const el=$('ocards');el.innerHTML='';
  Object.entries(ORIGINS).forEach(([k,O])=>{
    const c=document.createElement('div');c.className='oc';
    c.innerHTML=`<h3>${O.name}</h3><div class="sub">${O.desc} · 왕은 ${CLS[O.type]}로 싸움</div>
      ${KSTAT.map(s=>`<div class="kst"><span>${s}</span><div class="bar2"><i style="width:${O.st[s]}%;background:${O.st[s]>=65?'#7fd06a':O.st[s]>=45?'#f0c050':'#ff7a6a'}"></i></div><b>${O.st[s]}</b></div>`).join('')}
      <div class="pro">▲ ${O.pro}</div><div class="con">▼ ${O.con}</div>`;
    const b=document.createElement('button');b.className='big';b.textContent='이 출신으로 즉위';
    b.onclick=()=>{
      prog.origin=k;prog.king={...O.st};prog.kingName=prog.kingName||(pick(NAME_A)+pick(NAME_B)+pick(NAME_C));
      heroes=heroes.filter(h=>!h.king);heroes.unshift(makeKing(k));
      if(k==='rebel')nations.forEach((n,i)=>{if(i>0)n.att-=Math.round(15*conM());});
      show('origin',false);hubTab='king';renderHub();save();toast(`${prog.kingName} 왕 즉위!`);
    };
    c.appendChild(b);el.appendChild(c);
  });
  show('origin',true);
}
/* ---------- 지도 위 백성·상단·군대 ---------- */
let ments=[],mentT={car:0,army:0},wpart=[],bw='clear',forceBiome=null;
function pathBetween(a,b){
  const prev=new Map([[a,-1]]),q=[a];
  while(q.length){const x=q.shift();if(x===b)break;for(const y of REG[x].adj)if(!prev.has(y)){prev.set(y,x);q.push(y);}}
  if(!prev.has(b))return null;const out=[];for(let x=b;x!==-1;x=prev.get(x))out.unshift(x);return out;
}
const capOf=k=>REG.find(r=>r.owner===k&&r.cap)||regsOf(k)[0];
function initMents(){
  ments=ments.filter(m=>m.k!=='worker');
  REG.forEach(r=>{if(r.owner<0)return;const n=r.owner===0?3+Math.min(2,(r.bld||[]).length):1;
    for(let i=0;i<n;i++)ments.push({k:'worker',r:r.id,x:r.x+rnd(-18,18),y:r.y+rnd(-12,12),tx:r.x,ty:r.y,col:ownerCol(r.owner),w:rnd(0,3),face:1});});
}
function spawnTravel(kind,a,b,col){
  if(!a||!b||a===b)return;const ids=pathBetween(a.id,b.id);if(!ids||ids.length<2)return;
  const j=()=>rnd(-8,8);
  ments.push({k:kind,pts:ids.map(i=>({x:REG[i].x+j(),y:REG[i].y+j()})),seg:0,x:a.x,y:a.y,col,face:1});
}
function updMap(dt){
  for(const m of ments){
    if(m.k==='worker'){
      m.w-=dt;
      if(m.w<=0){const r=REG[m.r];m.tx=r.x+rnd(-28,28);m.ty=r.y+rnd(-20,20);if(regionAt({x:m.tx,y:m.ty})!==m.r){m.tx=r.x;m.ty=r.y;}m.w=rnd(2,6);}
      const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy);
      if(d>.5){const st=Math.min(d,7*dt);m.x+=dx/d*st;m.y+=dy/d*st;m.face=dx>=0?1:-1;m.mv=true;}else m.mv=false;
    }else{
      let left=(m.k==='army'?20:30)*dt;
      while(left>0&&m.seg<m.pts.length-1){const a=m.pts[m.seg+1],dx=a.x-m.x,dy=a.y-m.y,d=Math.hypot(dx,dy);
        if(d<=left){m.x=a.x;m.y=a.y;m.seg++;left-=d;}else{m.x+=dx/d*left;m.y+=dy/d*left;if(Math.abs(dx)>.1)m.face=dx>=0?1:-1;left=0;}}
      if(m.seg>=m.pts.length-1)m.done=true;
    }
  }
  ments=ments.filter(m=>!m.done);
  const travelers=ments.filter(m=>m.k!=='worker').length;
  mentT.car-=dt;
  if(mentT.car<=0&&travelers<30){
    mentT.car=2.2;
    const partners=[];for(let k=1;k<NATIONS.length;k++)if(nations[k].alive&&nations[k].trade)partners.push(k);
    if(partners.length&&myRegs().length){const k=pick(partners);Math.random()<.5?spawnTravel('caravan',pick(myRegs()),capOf(k),NATIONS[0].col):spawnTravel('caravan',capOf(k),pick(myRegs()),NATIONS[k].col);}
    const alive=[1,2,3,4,5].filter(k=>nations[k].alive);
    if(alive.length>1&&Math.random()<.55){const a=pick(alive),b=pick(alive.filter(x=>x!==a));spawnTravel('caravan',capOf(a),capOf(b),NATIONS[a].col);}
    if(myRegs().length>1&&Math.random()<.6){const a=pick(myRegs()),b=pick(myRegs());spawnTravel('cart',a,b,NATIONS[0].col);}
  }
  mentT.army-=dt;
  if(mentT.army<=0){
    mentT.army=3.5;
    for(let k=1;k<NATIONS.length;k++){const n=nations[k];if(!n.alive||n.rel!=='war')continue;
      const front=myRegs().filter(r=>r.adj.some(i=>REG[i].owner===k));if(!front.length)continue;
      const t=pick(front);spawnTravel('army',REG[pick(t.adj.filter(i=>REG[i].owner===k))],t,NATIONS[k].col);}
  }
}
function drawMents(z){
  const sc=1.7*Math.max(1,.75/z);
  if(tsReady()){const t=performance.now(),k=Math.max(.6,.75/z);
    for(const m of ments){const own=m.col===NATIONS[0].col;
      if(m.k==='worker'){const im=cimg(`assets/chars/${own?'Villager':'Villager3'}/SpriteSheet.png`);if(im.complete&&im.naturalWidth){const fr=m.mv?Math.floor(t/150+m.x)%4:0;ctx.drawImage(im,(m.face>0?3:2)*16,fr*16,16,16,m.x-6*k,m.y-12*k,12*k,12*k);}continue;}
      ctx.save();ctx.translate(m.x,m.y);
      if(m.k==='army'){const im=cimg(`assets/chars/${own?'Knight':'RedGladiator'}/SpriteSheet.png`),fr=Math.floor(t/140)%4;
        for(let i=0;i<3;i++){if(im.complete&&im.naturalWidth)ctx.drawImage(im,(m.face>0?3:2)*16,((fr+i)%4)*16,16,16,(-i*7*m.face-6)*k,(-14+(i%2)*3)*k,14*k,14*k);}
        ctx.fillStyle='#5a3a1e';ctx.fillRect(4*k,-24*k,1.2*k,14*k);ctx.fillStyle=m.col;ctx.fillRect(5*k,-24*k,7*k,4.5*k);}
      else{const d=cimg('assets/animals/Donkey.png'),fr=Math.floor(t/200)%2;ctx.save();if(m.face>0)ctx.scale(-1,1);if(d.complete&&d.naturalWidth)ctx.drawImage(d,fr*16,0,16,16,-7*k,-13*k,14*k,14*k);ctx.restore();
        ctx.fillStyle='#8a5a2b';ctx.fillRect((-m.face*12-5)*k,-8*k,10*k,6*k);ctx.fillStyle=m.k==='caravan'?m.col:'#e8e0c8';ctx.fillRect((-m.face*12-5)*k,-11*k,10*k,3*k);ctx.fillStyle='#2a1a10';ctx.fillRect((-m.face*12-4)*k,-2*k,2.5*k,2.5*k);ctx.fillRect((-m.face*12+1)*k,-2*k,2.5*k,2.5*k);}
      ctx.restore();}
    return;}
  for(const m of ments){
    ctx.save();ctx.translate(m.x,m.y);ctx.scale(m.face*sc,sc);
    if(m.k==='worker'){
      const b=m.mv?Math.abs(Math.sin(performance.now()/110+m.x))*1:0;
      ctx.fillStyle='#f0c39a';ctx.fillRect(-1,-6-b,2,2);ctx.fillStyle=m.col;ctx.fillRect(-1.5,-4-b,3,3);
      ctx.fillStyle='#1a1a24';ctx.fillRect(-1.5,-1-b,1,1);ctx.fillRect(.5,-1-b,1,1);
    }else if(m.k==='army'){
      for(let i=0;i<3;i++){const ox=-i*4,oy=(i%2)*2;ctx.fillStyle='#c8ced8';ctx.fillRect(ox-1,oy-7,2,2);ctx.fillStyle=m.col;ctx.fillRect(ox-1.5,oy-5,3,4);ctx.fillStyle='#8a5a2b';ctx.fillRect(ox+1.5,oy-9,1,8);}
      ctx.fillStyle='#5a3a1e';ctx.fillRect(2,-13,1,12);ctx.fillStyle=m.col;ctx.fillRect(3,-13,5,3);
    }else{
      ctx.fillStyle='#7a4a2a';ctx.fillRect(-1,-5,5,3);ctx.fillRect(3,-7,2,3);ctx.fillStyle='#3f2414';ctx.fillRect(-1,-2,1,2);ctx.fillRect(3,-2,1,2);
      ctx.fillStyle='#c9a26a';ctx.fillRect(-10,-6,8,4);ctx.fillStyle=m.k==='caravan'?m.col:'#e8e0c8';ctx.fillRect(-10,-9,8,3);
      ctx.fillStyle='#1a1a24';ctx.fillRect(-9,-2,2,2);ctx.fillRect(-5,-2,2,2);
    }
    ctx.restore();
  }
}
function updWeather(dt,w){
  const n={rain:110,storm:170,snow:90,frost:130}[w]||0;
  while(wpart.length<n)wpart.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,s:Math.random()});
  wpart.length=n;
  const snowy=w==='snow'||w==='frost',fall=snowy?45:520,drift=w==='storm'?-240:w==='rain'?-70:15;
  for(const q of wpart){q.y+=fall*(.6+q.s*.7)*dt;q.x+=drift*dt+(snowy?Math.sin(q.y/30+q.s*6)*14*dt:0);
    if(q.y>innerHeight){q.y=-10;q.x=Math.random()*(innerWidth+200);}if(q.x<-30)q.x=innerWidth+20;}
}
function drawWeather(w){
  if(!wpart.length)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(w==='snow'||w==='frost'){ctx.fillStyle='rgba(255,255,255,.85)';for(const q of wpart)ctx.fillRect(q.x,q.y,2+q.s,2+q.s);
    if(w==='frost'){ctx.fillStyle='rgba(200,225,255,.12)';ctx.fillRect(0,0,innerWidth,innerHeight);}}
  else{ctx.strokeStyle=w==='storm'?'rgba(190,210,255,.55)':'rgba(170,200,255,.45)';ctx.lineWidth=1;ctx.beginPath();
    const dx=w==='storm'?-6:-2;for(const q of wpart){ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+dx,q.y+10+q.s*6);}ctx.stroke();
    if(w==='storm'&&Math.random()<.004){ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(0,0,innerWidth,innerHeight);}}
}
function mapCam(){
  const pp=panelPad();
  cam.z=Math.max(zMin(),Math.min((innerWidth-pp.r)/W,(innerHeight-pp.b)/H)*.98);
  focusCam(W/2,H/2);
}
const presetTypes=p=>ORDER.filter(t=>p.c[t]>0);
function genRivals(){
  rivals=PRESETS.map(p=>{const list=[],n=Math.random()<.5?2:1;
    for(let k=0;k<n;k++)list.push(genHero({type:pick(presetTypes(p)),lv:rint(1,3)+Math.floor(prog.month/3)}));
    return list;});
}
function refillTavern(keepCaptured){
  tavern=tavern.filter(h=>keepCaptured&&h.captured);
  while(tavern.length<5)tavern.push(genHero({lv:rint(1,2+Math.floor(prog.month/2))}));
}
function newGame(){
  heroes=[];tavern=[];squads=[];deploySnap=null;battleCtx=null;pendingInv=null;selReg=-1;ments=[];forceBiome=null;
  prog.phase=1;prog.p1=null;prog.origin=null;prog.king=null;prog.kingName=null;prog.kingdomName=null;
  prog.wins=0;prog.gold=0;prog.month=1;prog.won=false;prog.weather='clear';prog.city={};citySc=null;town=null;
  NATIONS[0].name='나의 왕국';
}
// 1페이즈를 건너뛰고 바로 왕으로 시작 (출신 선택)
function skipToKing(){
  prog.originTier=1;heroes=[];prog.phase=2;prog.city={};citySc=null;prog.wins=0;prog.gold=400;prog.month=1;prog.won=false;deploySnap=null;
  prog.goods=goodsInit();prog.tax='mid';prog.morale=60;prog.weather='clear';prog.hungry=false;rollPrices();
  prog.origin=null;prog.king=null;prog.kingName=null;
  mapSeed=Math.floor(Math.random()*1e9);genWorld(mapSeed);decorateWorld(mapSeed);initNations();buildMapArt();selReg=-1;pendingInv=null;battleCtx=null;ments=[];
  const a=genHero({type:'spear',rarity:1,arche:'normal'}),b=genHero({type:'archer',rarity:0,arche:'early'});
  a.loyalty=60;b.loyalty=55;heroes.push(a,b);
  counts={spear:6,cav:3,archer:4,mage:1};resetSquads();syncCounts();
  const sp=squads.find(q=>q.type==='spear'),ar=squads.find(q=>q.type==='archer');
  if(sp)a.sq=sp.id;if(ar)b.sq=ar.id;
  deploySnap=squads.map(q=>({...q}));
  tavern=[];refillTavern(false);genRivals();
}
/* 장수 그림 (희귀도 색 장식) */
const HSCALE=1.35,HSPRC={};
function heroSprite(h,team){
  const k=team+'_'+h.rarity+'_'+h.type;
  if(!HSPRC[k])HSPRC[k]=makeSprite(GRIDS[h.type],Object.assign({},BASE,TEAMCOL[team],{D:RARITY[h.rarity].col,M:h.rarity>=2?'#ffe08a':BASE.M}));
  return HSPRC[k];
}
function iconOf(h,team){const sp=heroSprite(h,team||0),c=document.createElement('canvas');c.width=sp.width;c.height=sp.height;c.getContext('2d').drawImage(sp,0,0);return c;}
/* ---------- 건물·주민 그림 (마을·왕도 공용) ---------- */
const BCACHE={};
function hx(h,f){const n=parseInt(h.slice(1),16);const m=v=>Math.max(0,Math.min(255,Math.round(f>1?v+(255-v)*(f-1):v*f)));
  return '#'+(((1<<24)|(m(n>>16)<<16)|(m((n>>8)&255)<<8)|m(n&255)).toString(16)).slice(1);}
const bp=(g,c,x,y,w,h)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function bWall(g,x,y,w,h,c){bp(g,hx(c,.55),x-2,y-2,w+4,h+2);bp(g,c,x,y,w,h);bp(g,hx(c,1.12),x,y,w,2);bp(g,hx(c,.8),x,y+h-4,w,4);
  for(let i=0;i<w*h/110;i++)bp(g,hx(c,.9),x+2+((i*37)%Math.max(4,w-6)),y+3+((i*53)%Math.max(4,h-8)),4,2);}
function bGable(g,cx,by,w,rh,c){for(let i=0;i<rh;i+=2){const ww=Math.max(4,(w+8)*(1-i/rh));bp(g,(i/2)%3===0?hx(c,.86):c,cx-ww/2,by-i-2,ww,2);bp(g,hx(c,1.25),cx-ww/2,by-i-2,2,2);}
  bp(g,hx(c,.5),cx-(w+8)/2,by-2,w+8,3);bp(g,hx(c,1.2),cx-2,by-rh-1,4,2);}
function bCren(g,x,y,w,c){bp(g,hx(c,.6),x-2,y-3,w+4,4);for(let i=0;i<w-2;i+=8){bp(g,hx(c,.5),x+i-1,y-10,7,8);bp(g,c,x+i,y-9,5,6);}}
function bDome(g,cx,by,r,c){for(let i=0;i<r;i+=2){const ww=2*Math.sqrt(Math.max(0,r*r-i*i));bp(g,i>r*.5?hx(c,1.18):c,cx-ww/2,by-i-2,ww,2);}
  bp(g,hx(c,.6),cx-r,by-2,2*r,2);bp(g,'#ffe08a',cx-1,by-r-8,2,8);}
function bSpire(g,cx,by,w,h,c){for(let i=0;i<h;i+=2){const ww=Math.max(2,w*(1-i/h));bp(g,(i/2)%4===0?hx(c,.78):c,cx-ww/2,by-i-2,ww,2);}}
function bWins(g,x,y,w,rows,gap,glow,fl){for(let r=0;r<rows;r++)for(let i=x;i<=x+w-6;i+=gap){bp(g,'#3a2a2a',i-1,y+r*15-1,8,10);bp(g,glow||'#7ab0e0',i,y+r*15,6,8);
  bp(g,glow?hx(glow,1.35):'#c8e8ff',i,y+r*15,2,3);bp(g,'#3a2a2a',i+2,y+r*15,1,8);
  if(fl!==false&&!glow){bp(g,'#8a5a2a',i-1,y+r*15+8,8,2);for(let k=0;k<3;k++)bp(g,['#ff7a9a','#ffe08a','#ff9ad0','#9ad0ff'][(i+k+r)%4],i+k*2.5,y+r*15+6,2,2);}}}
function bDoor(g,cx,by,w,h,c){c=c||'#5a3418';bp(g,'#14141c',cx-w/2-2,by-h-2,w+4,h+2);bp(g,c,cx-w/2,by-h,w,h);bp(g,hx(c,1.3),cx-w/2,by-h,2,h);bp(g,'#f0c050',cx+w/2-3,by-h/2,2,2);}
function bFlag(g,x,y,c){bp(g,'#3a2a1a',x,y,2,20);bp(g,c,x+2,y,11,8);bp(g,hx(c,.7),x+2,y+6,11,2);}
function bTree(g,cx,by,v){if(v%3===2){for(let i=0;i<3;i++){const w=22-i*6;bp(g,'#2a5a2a',cx-w/2-1,by-12-i*9-11,w+2,12);bp(g,i%2?'#3f8a44':'#4a9a4a',cx-w/2,by-12-i*9-10,w,10);bp(g,'#7ac07a',cx-w/2+2,by-12-i*9-10,4,2);}bp(g,'#4a2e14',cx-2,by-10,4,10);return;}
  bp(g,'#7a4a2a',cx-2,by-12,4,12);const c=v%3?'#58a858':'#68b848';
  [[-12,-28,24,16],[-10,-34,20,26],[-6,-36,12,30]].forEach(([a,b,w,h])=>bp(g,'#2a5a2a',cx+a-1,by+b-1,w+2,h+2));
  [[-12,-28,24,16],[-10,-34,20,26],[-6,-36,12,30]].forEach(([a,b,w,h])=>bp(g,c,cx+a,by+b,w,h));
  bp(g,hx(c,1.3),cx-7,by-33,8,4);bp(g,hx(c,1.15),cx-10,by-28,4,6);bp(g,hx(c,.8),cx-12,by-16,24,4);
  if(v%4===1)[[-6,-26],[4,-30],[0,-20],[7,-22]].forEach(([a,b])=>bp(g,'#ff5a5a',cx+a,by+b,3,3));
  if(v%4===3)[[-7,-29],[3,-32],[-1,-22],[6,-25],[-9,-21]].forEach(([a,b])=>bp(g,'#ffc0d8',cx+a,by+b,3,3));}
const BDRAW={
  house:{size:o=>[36+(o.v%3)*6+16,54],draw:(g,W,H,o)=>{const w=W-16,x=8,by=H-2,h=20;if(o.v%2){bp(g,'#8a6a5a',x+w-12,by-h-22,6,14);bp(g,'rgba(255,255,255,.55)',x+w-13,by-h-28,5,4);bp(g,'rgba(255,255,255,.4)',x+w-10,by-h-33,4,4);}
    bWall(g,x,by-h,w,h,o.wall||'#fff0d8');bGable(g,W/2,by-h,w,20,o.roof||'#e8735a');bDoor(g,x+w*.28,by,8,12);bWins(g,x+w*.55,by-h+5,w*.4,1,10);}},
  house2:{size:o=>[62,72],draw:(g,W,H,o)=>{const w=46,x=8,by=H-2,h=34;bWall(g,x,by-h,w,h,o.wall||'#d0c0a0');bp(g,hx(o.wall||'#d0c0a0',.7),x,by-18,w,2);
    bGable(g,x+w/2,by-h,w,24,o.roof||'#7a3a3a');bDoor(g,x+12,by,8,13);bWins(g,x+24,by-h+4,20,2,10);bWins(g,x+6,by-h+4,8,1,10);}},
  home:{size:()=>[64,62],draw:(g,W,H,o)=>{BDRAW.house.draw(g,W,H-6,{v:1,wall:'#e8d8b0',roof:o.acc||'#a8442e'});bp(g,'#3f7a3a',8,H-10,W-16,4);
    for(let i=12;i<W-12;i+=8)bp(g,['#ff7a9a','#ffe08a','#9ad0ff'][i%3],i,H-12,3,3);bFlag(g,W-12,H-40,o.acc||'#3f7be0');}},
  tavern:{size:()=>[90,64],draw:(g,W,H)=>{const w=62,x=14,by=H-2,h=30;bWall(g,x,by-h,w,h,'#b88a5a');for(let i=x;i<x+w;i+=8)bp(g,'#8a5a32',i,by-h,2,h);
    bGable(g,x+w/2,by-h,w,22,'#6a2e22');bDoor(g,x+w/2,by,10,15,'#3a2010');bWins(g,x+6,by-h+8,14,1,10,'#ffcf6a');bWins(g,x+w-22,by-h+8,16,1,10,'#ffcf6a');
    bp(g,'#3a2010',x+w+2,by-h+2,10,2);bp(g,'#3a2010',x+w+10,by-h+2,2,14);bp(g,'#c9962a',x+w+4,by-h+6,10,8);bp(g,'#fff3a0',x+w+5,by-h+6,8,2);
    for(let i=0;i<2;i++){bp(g,'#14141c',x-12+i*0,by-14-i*12,12,12);bp(g,'#8a5a2b',x-11,by-13-i*12,10,10);bp(g,'#5a3418',x-11,by-9-i*12,10,2);}}},
  barracks:{size:()=>[124,58],draw:(g,W,H,o)=>{const w=84,x=4,by=H-2,h=32;bWall(g,x,by-h,w,h,'#9a9488');bCren(g,x,by-h,w,'#8a8478');
    bDoor(g,x+w/2,by,16,18,'#4a3020');bWins(g,x+8,by-h+8,22,1,12);bWins(g,x+w-30,by-h+8,22,1,12);bFlag(g,x+6,by-h-30,o.acc||'#d94848');bFlag(g,x+w-14,by-h-30,o.acc||'#d94848');
    for(let i=0;i<2;i++){const dx=x+w+12+i*16;bp(g,'#5a3a1a',dx,by-26,3,26);bp(g,'#d8c070',dx-5,by-24,13,10);bp(g,'#a89040',dx-5,by-16,13,2);}}},
  market:{size:()=>[118,48],draw:(g,W,H,o)=>{const by=H-2;for(let s=0;s<3;s++){const x=4+s*38,c=['#d94848','#3f7be0','#5ab05a'][(s+(o.v||0))%3];
    bp(g,'#4a3018',x+2,by-30,3,30);bp(g,'#4a3018',x+30,by-30,3,30);for(let i=0;i<34;i+=6)bp(g,(i/6)%2?'#f0ece0':c,x+i,by-36,6,10);bp(g,hx(c,.6),x,by-27,36,2);
    bp(g,'#7a5030',x+2,by-14,32,10);for(let i=0;i<4;i++)bp(g,['#ff6a4a','#ffd34d','#8ad06a','#c08a5a'][(i+s)%4],x+5+i*7,by-17,5,4);}}},
  temple:{size:()=>[76,100],draw:(g,W,H)=>{const w=56,x=10,by=H-2,h=34;bWall(g,x,by-h,w,h,'#e8e0d0');bGable(g,x+w/2,by-h,w,18,'#4a5a8a');
    bWall(g,x+w/2-10,by-h-34,20,26,'#e0d8c8');bSpire(g,x+w/2,by-h-34,24,26,'#4a5a8a');bp(g,'#ffd34d',x+w/2-1,by-h-66,2,8);bp(g,'#ffd34d',x+w/2-4,by-h-63,8,2);
    bp(g,'#14141c',x+w/2-6,by-h-26,12,12);bp(g,'#9ad0ff',x+w/2-5,by-h-25,10,10);bp(g,'#ffcf6a',x+w/2-2,by-h-22,4,4);bDoor(g,x+w/2,by,12,18,'#6a4a2a');bWins(g,x+5,by-h+8,10,1,10,'#9ad0ff');bWins(g,x+w-14,by-h+8,10,1,10,'#9ad0ff');}},
  cathedral:{size:o=>[120+(o.lv||1)*6,128+(o.lv||1)*6],draw:(g,W,H,o)=>{const w=W-40,x=20,by=H-2,h=44+(o.lv||1)*3;bWall(g,x,by-h,w,h,'#ece6d8');bGable(g,x+w/2,by-h,w,22,'#3a4a7a');
    [x-8,x+w-12].forEach(tx=>{bWall(g,tx,by-h-34,20,h+34,'#e4dccc');bSpire(g,tx+10,by-h-34,26,34,'#3a4a7a');bWins(g,tx+7,by-h-20,6,3,10,'#9ad0ff');});
    bp(g,'#14141c',x+w/2-11,by-h+4,22,22);bp(g,'#7a5ad0',x+w/2-10,by-h+5,20,20);bp(g,'#ffd34d',x+w/2-2,by-h+5,4,20);bp(g,'#ffd34d',x+w/2-10,by-h+13,20,4);
    bDoor(g,x+w/2,by,16,20,'#6a4a2a');bWins(g,x+14,by-h+12,14,2,10,'#9ad0ff');bWins(g,x+w-28,by-h+12,14,2,10,'#9ad0ff');}},
  tower:{size:o=>[44,126+(o.lv||0)*10],draw:(g,W,H,o)=>{const w=28,x=8,by=H-2,h=84+(o.lv||0)*10;bWall(g,x,by-h,w,h,'#6a5a8a');for(let i=by-h+8;i<by-10;i+=16)bp(g,'#5a4a7a',x,i,w,2);
    bSpire(g,x+w/2,by-h,36,34,'#3a2a6a');bp(g,'#7ff0ff',x+w/2-2,by-h-40,4,4);bWins(g,x+11,by-h+10,6,Math.floor((h-30)/15),10,'#7ff0ff');bDoor(g,x+w/2,by,10,14,'#2a1a4a');}},
  ruin:{size:()=>[48,56],draw:(g,W,H)=>{const by=H-2;bWall(g,10,by-38,28,38,'#7a7a74');bp(g,'rgba(0,0,0,0)',10,by-38,28,0);
    [[10,by-42,8,6],[22,by-46,8,10],[30,by-40,8,4]].forEach(r=>bp(g,'#7a7a74',...r));bp(g,'#1a1a24',18,by-24,10,12);for(let i=0;i<5;i++)bp(g,'#8a8a84',2+i*9,by-5,6,5);}},
  library:{size:o=>[86,62+(o.dome?16:0)],draw:(g,W,H,o)=>{const w=70,x=8,by=H-2,h=34;bWall(g,x,by-h,w,h,o.wall||'#e0d8c0');
    if(o.dome)bDome(g,x+w/2,by-h-10,16,o.dome);bGable(g,x+w/2,by-h,w,12,o.roof||'#8a7a6a');for(let i=0;i<5;i++){bp(g,'#14141c',x+5+i*14,by-h+4,6,h-4);bp(g,'#f4f0e4',x+6+i*14,by-h+4,4,h-4);}
    bDoor(g,x+w/2,by,10,16,'#5a3418');bp(g,'#c8c0a8',x-2,by-4,w+4,4);}},
  manor:{size:()=>[110,80],draw:(g,W,H,o)=>{const w=86,x=12,by=H-2,h=44;bWall(g,x,by-h,w,h,'#e8dcc4');bp(g,'#c8b898',x,by-22,w,2);bGable(g,x+w/2,by-h,w,26,o.roof||'#4a4a6a');
    bDoor(g,x+w/2,by,12,18,'#5a2a1a');bWins(g,x+8,by-h+5,28,2,10,'#ffe8a0');bWins(g,x+w-36,by-h+5,28,2,10,'#ffe8a0');bp(g,'#2f6a34',2,by-10,10,10);bp(g,'#2f6a34',W-12,by-10,10,10);bFlag(g,x+w/2-1,by-h-46,o.acc||'#c9962a');}},
  castle:{size:o=>{const L=o.lv||1;return[110+L*44,96+L*34];},draw:(g,W,H,o)=>{const L=o.lv||1,by=H-2,stone=L>=4?'#e8e4d8':'#a8a498',rc=L>=4?'#e0b030':(o.roof||'#3f7be0'),cx=W/2;
    if(L>=3){bWall(g,8,by-30,W-16,30,hx(stone,.92));bCren(g,8,by-30,W-16,hx(stone,.85));}
    const kw=50+L*12,kh=46+L*16;bWall(g,cx-kw/2,by-kh,kw,kh,stone);bCren(g,cx-kw/2,by-kh,kw,hx(stone,.9));bWins(g,cx-kw/2+8,by-kh+10,kw-16,Math.max(1,Math.floor((kh-34)/15)),12,L>=3?'#ffe08a':null);
    const tw=L>=2?[[14+L*2,0],[W-30-L*2,0]]:[];if(L>=3)tw.push([cx-kw/2-24,1],[cx+kw/2+6,1]);
    tw.forEach(([tx,k])=>{const th=kh+(k?-6:16),w=18+L*2;bWall(g,tx,by-th,w,th,hx(stone,.95));if(L>=4)bDome(g,tx+w/2,by-th,w/2+2,rc);else bSpire(g,tx+w/2,by-th,w+6,22+L*4,rc);bWins(g,tx+w/2-3,by-th+10,6,Math.floor((th-30)/15),10,L>=3?'#ffe08a':null);});
    if(L>=3){bWall(g,cx-14,by-kh-28,28,30,stone);if(L>=4)bDome(g,cx,by-kh-28,18,rc);else bSpire(g,cx,by-kh-28,34,30,rc);}
    bDoor(g,cx,by,18+L*2,22+L*2,'#3a2410');bFlag(g,cx-kw/2+2,by-kh-28,o.acc||rc);bFlag(g,cx+kw/2-12,by-kh-28,o.acc||rc);if(L>=4){bFlag(g,cx-2,by-kh-78,'#ffd34d');}}},
  hall:{size:()=>[98,58],draw:(g,W,H,o)=>{const w=74,x=12,by=H-2,h=26;bWall(g,x,by-h,w,h,'#9a6a3a');for(let i=x;i<x+w;i+=6)bp(g,'#7a4a22',i,by-h,2,h);
    bGable(g,x+w/2,by-h,w,24,'#5a3a1a');bDoor(g,x+w/2,by,14,16,'#3a2010');bFlag(g,x+w-6,by-h-40,o.roof||'#3f7be0');}},
  gate:{size:()=>[150,84],draw:(g,W,H,o)=>{const by=H-2;bWall(g,26,by-44,W-52,44,'#9a9488');bCren(g,26,by-44,W-52,'#8a8478');
    [4,W-34].forEach(tx=>{bWall(g,tx,by-66,30,66,'#a8a498');bCren(g,tx,by-66,30,'#9a9488');bWins(g,tx+12,by-56,6,2,10);});
    bp(g,'#14141c',W/2-18,by-36,36,36);bp(g,'#2a2018',W/2-16,by-34,32,34);for(let i=0;i<5;i++)bp(g,'#5a5a5a',W/2-14+i*7,by-34,2,34);bFlag(g,W/2-1,by-66,o.acc||'#3f7be0');}},
  board:{size:()=>[40,44],draw:(g,W,H)=>{const by=H-2;bp(g,'#4a2e14',8,by-36,3,36);bp(g,'#4a2e14',W-11,by-36,3,36);bp(g,'#14141c',4,by-38,W-8,22);bp(g,'#8a5a2b',5,by-37,W-10,20);
    [[8,-34,8,8],[18,-35,9,10],[28,-33,6,7],[10,-24,10,6]].forEach(([x,y,w,h],i)=>bp(g,i%2?'#f0ece0':'#e8d8a8',x,by+y,w,h));bp(g,'#d94848',21,by-34,3,2);}},
  alley:{size:()=>[74,54],draw:(g,W,H)=>{const w=50,x=6,by=H-2,h=24;bWall(g,x,by-h,w,h,'#5a4a3a');for(let i=x;i<x+w;i+=7)bp(g,'#4a3a2a',i,by-h,2,h);
    for(let i=0;i<14;i+=2)bp(g,'#3a2a22',x-4+i,by-h-2-i,w+8-i*2,2);bDoor(g,x+16,by,9,13,'#2a1a10');bWins(g,x+30,by-h+6,12,1,10,'#ffb040');
    bp(g,'#3a2a1a',x+w+4,by-34,2,34);bp(g,'#ffcf6a',x+w+1,by-34,8,7);bp(g,'#6a4a2a',x+w+2,by-12,14,10);bp(g,'#7a5a3a',x+w+6,by-20,10,8);}},
  forge:{size:o=>[80,70],draw:(g,W,H,o)=>{const w=54,x=8,by=H-2,h=26;bp(g,'#4a4a4a',x+w-14,by-h-30,10,22);for(let i=0;i<3;i++)bp(g,'rgba(200,200,200,.5)',x+w-16+i*4,by-h-40-i*6,8,6);
    bWall(g,x,by-h,w,h,'#8a7a6a');bGable(g,x+w/2,by-h,w,18,'#5a4a4a');bDoor(g,x+18,by,12,15,'#ff8a3a');bp(g,'#3a3a40',x+w+4,by-10,14,6);bp(g,'#3a3a40',x+w+8,by-4,6,4);}},
  stable:{size:()=>[96,54],draw:(g,W,H)=>{const w=76,x=10,by=H-2,h=22;bWall(g,x,by-h,w,h,'#9a3a2a');bp(g,'#f0ece0',x,by-h,2,h);bp(g,'#f0ece0',x+w-2,by-h,2,h);
    bGable(g,x+w/2,by-h,w,18,'#5a2a1a');for(let i=0;i<3;i++)bDoor(g,x+14+i*24,by,12,14,'#4a2a12');bp(g,'#e0c060',2,by-8,10,8);bp(g,'#e0c060',W-12,by-8,10,8);}},
  range:{size:()=>[100,74],draw:(g,W,H)=>{const by=H-2;bp(g,'#5a3a1a',10,by-60,4,60);bp(g,'#5a3a1a',30,by-60,4,60);bp(g,'#7a5030',6,by-64,32,10);bGable(g,22,by-64,30,12,'#5a3a1a');
    [56,82].forEach(tx=>{bp(g,'#4a2e14',tx-1,by-18,3,18);bp(g,'#f0ece0',tx-8,by-34,16,16);bp(g,'#d94848',tx-6,by-32,12,12);bp(g,'#f0ece0',tx-4,by-30,8,8);bp(g,'#d94848',tx-2,by-28,4,4);});}},
  granary:{size:()=>[80,70],draw:(g,W,H)=>{const by=H-2;bWall(g,8,by-42,26,42,'#c8a878');bDome(g,21,by-42,14,'#8a5a2b');bWall(g,40,by-22,34,22,'#b89868');bGable(g,57,by-22,34,14,'#8a4a2a');bDoor(g,57,by,10,12);}},
  arena:{size:o=>[150+(o.lv||1)*8,70],draw:(g,W,H)=>{const by=H-2,cx=W/2,rx=W/2-6;for(let i=0;i<40;i+=2){const t=i/40,ww=2*rx*Math.sqrt(1-((t-.5)*2)**2);bp(g,i<4||i>34?'#8a8478':'#b8b0a0',cx-ww/2,by-48+i,ww,2);}
    bp(g,'#c8a868',cx-rx*.62,by-38,rx*1.24,22);for(let i=-rx+8;i<rx-8;i+=12)bp(g,'#7a7468',cx+i,by-50,6,4);bFlag(g,cx-rx+6,by-70,'#d94848');bFlag(g,cx+rx-16,by-70,'#3f7be0');}},
  academy:{size:o=>BDRAW.library.size({dome:1}),draw:(g,W,H,o)=>BDRAW.library.draw(g,W,H,{dome:'#3f6ab0',wall:'#e8e0d0',roof:'#3a4a7a'})},
  bank:{size:()=>BDRAW.library.size({dome:1}),draw:(g,W,H)=>BDRAW.library.draw(g,W,H,{dome:'#e0b030',wall:'#f0ead8',roof:'#a08040'})},
  guild:{size:()=>[72,80],draw:(g,W,H,o)=>{BDRAW.house2.draw(g,W-10,H-8,{wall:'#c8a878',roof:o.roof||'#2e5a7a'});bFlag(g,W-14,H-60,o.acc||'#ffd34d');bp(g,'#c9962a',W-20,H-30,8,8);}},
  garden:{size:()=>[96,54],draw:(g,W,H)=>{const by=H-2;bp(g,'#2f6a34',4,by-12,W-8,10);bp(g,'#3f8a44',6,by-11,W-12,4);bp(g,'#8a8478',W/2-14,by-14,28,8);bp(g,'#5aa0e0',W/2-12,by-13,24,5);
    bp(g,'#c8c8c0',W/2-4,by-40,8,26);bp(g,'#d8d8d0',W/2-6,by-46,12,8);for(let i=0;i<6;i++)bp(g,['#ff7a9a','#ffe08a','#c09aff'][i%3],10+i*14,by-14,4,4);}},
  monument:{size:o=>[44,92+(o.lv||1)*8],draw:(g,W,H,o)=>{const by=H-2,h=64+(o.lv||1)*8;bp(g,'#8a8478',4,by-10,W-8,10);for(let i=0;i<h;i+=2){const ww=14-i/h*6;bp(g,i%8?'#d8d4c8':'#c0bcb0',W/2-ww/2,by-10-i,ww,2);}bp(g,'#ffd34d',W/2-3,by-10-h-6,6,6);}},
  well:{size:()=>[30,34],draw:(g,W,H)=>{const by=H-2;bp(g,'#14141c',4,by-12,22,12);bp(g,'#8a8a84',5,by-11,20,10);bp(g,'#3a6aa0',8,by-11,14,3);bp(g,'#5a3a1a',6,by-30,2,20);bp(g,'#5a3a1a',22,by-30,2,20);bGable(g,15,by-28,18,8,'#7a3a2a');}},
  fountain:{size:()=>[64,40],draw:(g,W,H)=>{const by=H-2;for(let i=0;i<14;i+=2){const ww=60-Math.abs(i-6)*2;bp(g,i<2||i>10?'#7a7468':'#a8a498',W/2-ww/2,by-14+i,ww,2);}bp(g,'#5aa0e0',W/2-24,by-12,48,8);
    bp(g,'#a8a498',W/2-3,by-30,6,20);bp(g,'#9ad0ff',W/2-8,by-34,16,4);bp(g,'#cfe8ff',W/2-2,by-38,4,6);}},
  tree:{size:()=>[30,48],draw:(g,W,H,o)=>bTree(g,W/2,H-2,o.v||0)},
  watch:{size:()=>[34,80],draw:(g,W,H,o)=>{const by=H-2;bp(g,'#5a3a1a',8,by-62,3,62);bp(g,'#5a3a1a',W-11,by-62,3,62);for(let i=by-56;i<by;i+=14)bp(g,'#4a2e14',8,i,W-16,2);
    bp(g,'#7a5030',4,by-70,W-8,10);bGable(g,W/2,by-70,W-10,12,'#5a3a1a');bFlag(g,W/2,by-102,o.acc||'#3f7be0');}}
};
/* ---------- 타일셋 그림 (Ninja Adventure, 16px → 2배) ---------- */
const TS={};['TilesetFloor','TilesetHouse','TilesetNature','TilesetWater','TilesetElement','TilesetTowers','TilesetField','TilesetFloorDetail','TilesetVillageAbandoned','Boat','Camp','IntFloor','IntWall','Houses','PTDProps','CuteFence','Maple','Crops','FanB','FanP','FanT','FanGate','CuteD','CuteOak','FarmH','Castle_Blue','Castle_Red','Castle_Yellow','Castle_Purple','Tower_Blue','Tower_Red','Tower_Yellow','Tower_Purple','FanRoad','FanWater','FanRocks','FanCamp','FanFlowR','FanFlowW','Desert'].forEach(n=>{TS[n]=new Image();TS[n].src=`assets/tiles/${n}.png`;});
const tsReady=()=>Object.values(TS).every(i=>i.complete&&i.naturalWidth)&&(typeof tsOK!=='function'||tsOK());
const tsWait=()=>new Promise(res=>{const t0=Date.now(),f=()=>{if(tsReady()||Date.now()-t0>6000)res();else setTimeout(f,40);};f();});
// [이미지, sx, sy, w, h] (원본 픽셀)
const SP={
  hOr:['TilesetHouse',0,0,64,48],hBe:['TilesetHouse',64,0,64,48],hOr2:['TilesetHouse',128,0,64,48],hRed:['TilesetHouse',192,0,64,48],
  shopB:['TilesetHouse',256,0,48,48],shopG:['TilesetHouse',304,0,64,48],bread:['TilesetHouse',368,0,48,48],hWo:['TilesetHouse',416,0,48,48],wood2:['TilesetHouse',464,0,64,64],
  hall:['TilesetHouse',400,112,64,80],barn:['TilesetHouse',400,224,64,80],h21:['TilesetHouse',304,304,48,48],kiln:['TilesetHouse',464,64,48,64],
  torii:['TilesetHouse',0,80,48,32],hut1:['TilesetHouse',0,120,48,40],hut2:['TilesetHouse',48,128,48,32],arch:['TilesetHouse',464,320,48,48],
  awn:['TilesetHouse',256,256,48,32],awn2:['TilesetHouse',304,256,48,32],statue:['TilesetHouse',48,240,32,32],dojo:['TilesetHouse',64,64,32,16],
  barrel:['TilesetHouse',256,224,16,16],barrel2:['TilesetHouse',272,224,16,16],crate:['TilesetHouse',288,208,16,16],
  tw0:['TilesetTowers',0,0,32,32],tw6:['TilesetTowers',192,0,32,32],tw6c:['TilesetTowers',192,64,32,32],tw9b:['TilesetTowers',288,64,32,32],tw9:['TilesetTowers',288,0,32,32],twX:['TilesetTowers',352,0,32,32],twR:['TilesetTowers',288,32,32,32],
  board:['TilesetElement',176,32,48,32],well:['TilesetElement',64,16,16,16],lamp:['TilesetElement',96,48,16,32],hay:['TilesetElement',208,64,48,64],
  ruin:['TilesetVillageAbandoned',0,0,64,48],ruin2:['TilesetVillageAbandoned',176,0,48,48],
  tr0:['TilesetNature',0,0,32,32],tr1:['TilesetNature',32,0,32,32],tr3:['TilesetNature',96,0,32,32],tr8:['TilesetNature',256,0,32,32],tr9:['TilesetNature',288,0,32,32],
  trB:['TilesetNature',48,288,48,48],trP:['TilesetNature',0,288,48,48],trO:['TilesetNature',144,288,48,48],pine3:['TilesetNature',0,32,64,48],
  rockB:['TilesetNature',192,80,48,48],rockG:['TilesetNature',256,80,48,48],boulder:['TilesetNature',272,160,80,48],
  boat:['Boat',0,0,80,32],
  fanS:['FanB',28,8,90,105],fanWell:['FanB',147,35,58,77],fanL:['FanB',15,127,159,114],fanBig:['FanB',16,255,182,130],fan2F:['FanB',15,399,130,130],
  fBoard:['FanP',1,52,46,44],fLamp:['FanP',64,48,48,64],fBanner:['FanP',131,51,26,61],fSignL:['FanP',180,56,26,24],fHay:['FanP',160,127,32,33],fBarrel:['FanP',207,138,18,22],fFire:['FanP',112,132,32,28],fCrate:['FanP',0,9,17,23],fTable:['FanP',2,118,44,41],fTrough:['FanP',160,8,32,24],fSack:['FanP',79,17,18,16],
  // 사막 마을(닌자) · 산골 마을(닌자 폐촌) — 3 = 1.5배
  dHut:['Desert',0,0,48,48,3],dDome:['Desert',48,0,48,80,3],dFlat:['Desert',96,0,64,48,3],dL:['Desert',160,0,96,64,3],dHC:['Desert',256,0,64,64,3],d2st:['Desert',96,48,64,64,3],dTower:['Desert',224,64,48,88,3],dWall:['Desert',272,64,48,48,3],
  dPalm:['Desert',160,112,64,48,3],dPalm1:['Desert',160,160,32,32,3],dAwnB:['Desert',96,112,32,32,3],dAwnG:['Desert',96,144,32,32,3],dAwnR:['Desert',32,160,32,32,3],dAwnY:['Desert',64,160,32,32,3],dPool:['Desert',128,112,32,32,3],dLion:['Desert',0,96,32,48,3],dWell:['Desert',0,48,32,32,3],dPot:['Desert',224,160,16,32,3],
  vMoss:['TilesetVillageAbandoned',176,48,48,48,3],vA:['TilesetVillageAbandoned',192,96,64,80,3],vLodge:['TilesetVillageAbandoned',256,80,64,80,3],vHut:['TilesetVillageAbandoned',0,0,64,48,3],
  fRock1:['FanRocks',3,4,27,26],fRock2:['FanRocks',49,1,14,13],fRock3:['FanRocks',83,2,9,11],fRock4:['FanRocks',112,1,15,29],fRock5:['FanRocks',146,16,28,13],
  fPine:['FanT',0,0,65,65],fRound:['FanT',80,0,48,65],fTall:['FanT',151,2,54,94],fTall2:['FanT',223,0,50,95],fBush:['FanT',290,1,42,31],
  cLamp:['CuteD',67,71,12,42],cotR:['Houses',0,0,74,97],cotB:['Houses',76,0,74,97],cotG:['Houses',152,0,74,97],cotP:['Houses',228,0,74,97],fanSy:['Houses',304,0,90,105],fanSs:['Houses',396,0,90,105],fanSw:['Houses',488,0,90,105],fanSo:['Houses',580,0,90,105],fan2b:['Houses',672,0,130,130],fanLo:['Houses',804,0,159,114],fanBigs:['Houses',965,0,182,130],ptdStat:['PTDProps',444,19,43,75,1],maple:['Maple',96,0,32,48],cPot1:['CuteD',3,131,9,12],cPot2:['CuteD',19,147,9,12],oak:['CuteOak',0,0,64,80],farmH:['FarmH',147,2,74,97],gateF:['FanGate',0,0,80,96]
};
const castleCol=c=>{if(!c)return'Blue';const h=x=>{const n=parseInt(x.slice(1),16);return[n>>16&255,n>>8&255,n&255];},a=h(c);let b='Blue',bd=1e9;
  [['Blue','#3f7be0'],['Red','#c8453a'],['Yellow','#d1a72a'],['Purple','#9a5ad8'],['Blue','#26a6a0'],['Yellow','#3d9a4a']].forEach(([n,q])=>{const v=h(q),d=(a[0]-v[0])**2+(a[1]-v[1])**2+(a[2]-v[2])**2;if(d<bd){bd=d;b=n;}});return b;};
const TSW=(n,w,h)=>[n,0,0,w,h,1];
const BANN=[[0,'#c03030'],[1,'#d84040'],[2,'#2a9a9a'],[3,'#3aa040'],[5,'#8a40c0'],[6,'#e0c030']];
function bannerOf(col){if(!col)return 1;const h=c=>{const n=parseInt(c.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;return[r,g,b];},a=h(col);let best=1,bd=1e9;
  BANN.forEach(([i,c])=>{const b=h(c),d=(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;if(d<bd){bd=d;best=i;}});return best;}
// 조립: 원본 픽셀 좌표로 배치 후 2배 확대
function sComp(w,h,parts){
  const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  parts.forEach(q=>{if(typeof q==='function')return q(g);const [k,dx,dy]=q,S=typeof k==='string'?SP[k]:k;if(!S)return;const im=TS[S[0]];const k2=S[5]||2;g.drawImage(im,S[1],S[2],S[3],S[4],dx*2,dy*2,S[3]*k2,S[4]*k2);});
  return c;}
const banner=(col,dx,dy)=>[['TilesetHouse',352+16*bannerOf(col),320,16,32],dx,dy];
const SART={
  house:o=>{const k=['hOr','hBe','hOr2','h21','hWo','bread'][(o.v||0)%6],S=SP[k];return[S[3],S[4],[[k,0,0]]];},
  house2:o=>{const k=['barn','wood2','farmH','shopG','fanS','hOr2'][(o.v||0)%6],S=SP[k];return[S[3],S[4],[[k,0,0]]];},
  home:o=>[74,97,[['cotR',0,0]]],
  cottage:o=>{const S=SP[o.v||'cotR'];return[S[3],S[4],[[o.v||'cotR',0,0]]];},
  hall:o=>[198,130,[['fanBigs',8,0],['fBanner',0,66],['fBanner',176,66]]],
  castle:o=>{const lv=Math.max(1,o.lv||1),C=castleCol(o.roof),CA=TSW('Castle_'+C,320,256),TW=TSW('Tower_'+C,128,256);
    if(lv===1)return[160,128,[[CA,0,0]]];
    if(lv===2)return[240,128,[[TW,0,0],[TW,176,0],[CA,40,0],banner(o.roof,30,96),banner(o.roof,202,96)]];
    return[300,132,[[TW,0,4],[TW,236,4],[TW,30,0],[TW,206,0],[CA,70,4],banner(o.roof,60,100),banner(o.roof,230,100),...(lv>=4?[['fBanner',96,70],['fBanner',178,70]]:[])]];},
  barracks:o=>[80,82,[['barn',8,0],['fBanner',-4,20],['fBanner',62,20],['fCrate',70,60],['fBarrel',-6,62]]],
  tavern:o=>[175,114,[['fanLo',0,0],['fBarrel',158,92],['fBarrel',160,80],['fSignL',150,70]]],
  board:o=>[46,44,[['fBoard',0,0]]],
  temple:o=>[110,105,[['fanSw',10,0],['cLamp',0,62],['cLamp',98,62]]],
  cathedral:o=>[134,105,[['fanSw',22,0],[SP.ptdStat,0,68],[SP.ptdStat,112,68]]],
  fanArena:o=>[90,105,[['fanSo',0,0]]],
  tavernS:o=>[100,105,[['fanSy',0,0],['fBarrel',88,84]]],
  library:o=>[74,97,[['cotB',0,0]]],
  academy:o=>[74,97,[['cotP',0,0]]],
  tower:o=>[64,128,[[TSW('Tower_Purple',128,256),0,0]]],
  ruin:o=>[64,48,[['rockG',0,0],['twX',28,16]]],
  alley:o=>[64,48,[['h21',0,0],['fBarrel',46,26],['fCrate',-4,26]]],
  market:o=>[152,70,[['awn',0,16],['awn2',52,16],['awn',104,16],['fCrate',8,47],['fBarrel',66,48],['fSack',122,54],['fCrate',28,47]]],
  bank:o=>[90,105,[['fanSs',0,0]]],
  guild:o=>[100,105,[['fanSo',0,0],['fSignL',84,70]]],
  manor:o=>[140,130,[['fan2b',5,0],['fBanner',-6,68],['fBanner',122,68]]],
  gate:o=>[150,96,[['gateF',35,0],['tw0',0,64],['tw0',118,64]]],
  well:o=>[58,77,[['fanWell',0,0]]],
  fountain:o=>[22,38,[['ptdStat',0,0]]],
  monument:o=>[32,32,[['statue',0,0]]],
  watch:o=>[32,32,[['tw0',0,0]]],
  granary:o=>[64,64,[['kiln',0,0],['fHay',34,32]]],
  forge:o=>[110,105,[['fanSy',0,0],['fFire',88,78]]],
  stable:o=>[90,105,[['fanSo',0,0]]],
  range:o=>[64,80,[['barn',0,0]]],
  garden:o=>[80,80,[['oak',8,0],['cPot1',0,68],['cPot2',70,68]]],
  tree:o=>{const k=o.k||['tr0','fRound','tr8','trB','fTall','oak','fPine','trP','tr1','fTall2','trO','tr9'][(o.v||0)%12],S=SP[k];return[S[3]*(S[5]||2)/2,S[4]*(S[5]||2)/2,[[k,0,0]]];}
};
function bArt(kind,o){
  o=o||{};if(!tsReady()||!SART[kind])return bArt0(kind,o);
  const key='S|'+kind+'|'+(o.lv||0)+'|'+(o.roof||'')+'|'+(o.acc||'')+'|'+(o.v||0)+'|'+(o.k||'');if(BCACHE[key])return BCACHE[key];
  const [w,h,parts]=SART[kind](o),c=sComp(w,h,parts),W2=w*2,H2=h*2;
  return BCACHE[key]={c,w:W2,h:H2,fw:kind==='tree'?W2*.3:W2*.86,fd:kind==='tree'?10:kind==='well'?14:Math.min(46,H2*.4),spr:1};
}
function bArt0(kind,o){
  o=o||{};const key=kind+'|'+(o.lv||0)+'|'+(o.roof||'')+'|'+(o.wall||'')+'|'+(o.acc||'')+'|'+(o.v||0)+'|'+(o.dome||'');
  if(BCACHE[key])return BCACHE[key];
  const D=BDRAW[kind]||BDRAW.house,s=D.size(o),c=document.createElement('canvas');c.width=s[0];c.height=s[1];
  const g=c.getContext('2d');D.draw(g,s[0],s[1],o);
  return BCACHE[key]={c,w:s[0],h:s[1],fw:s[0]*.82,fd:Math.min(42,s[1]*.42)};
}
/* 주민·주인공 (같은 크기) */
const FG=[["..HHHHH..",".HHHHHHH.","HHSSSSSHH",".SESSSES.",".SPSmSPS.","..SSSSS..","..CCCCC..",".SCCBCCS.","..CCCCC..","..L...L..","..F...F.."],
          ["..HHHHH..",".HHHHHHH.","HHSSSSSHH",".SESSSES.",".SPSmSPS.","..SSSSS..","..CCCCC..",".SCCBCCS.","..CCCCC..","...L.L...","..FF.FF.."]];
const FGD=[["..HHHHH..",".HHHHHHH.","HHSSSSSHH","HSESSSESH","HSPSmSPSH","H.SSSSS.H","..CCCCC..",".SCCBCCS.",".CCCCCCC.","CCCCCCCCC","..F...F.."],
           ["..HHHHH..",".HHHHHHH.","HHSSSSSHH","HSESSSESH","HSPSmSPSH","H.SSSSS.H","..CCCCC..",".SCCBCCS.",".CCCCCCC.","CCCCCCCCC","..FF.FF.."]];
const FGME=[["..YYYYY..",".YYYYYYY.","YYYYYYYYY",".SESSSES.",".SPSmSPS.","..SSSSS..","KKCCCCCKK","KSCCBCCSK","KKCCCCCKK","..L...L..","..F...F.."],
            ["..YYYYY..",".YYYYYYY.","YYYYYYYYY",".SESSSES.",".SPSmSPS.","..SSSSS..","KKCCCCCKK","KSCCBCCSK","KKCCCCCKK","...L.L...","..FF.FF.."]];
const CHICK=[["..R...","..WW..",".WWEO.","WWWWW.",".WWW..","..Y.Y."],["..R...","..WW..",".WWEO.","WWWWW.",".WWW..",".Y..Y."]];
const CAT=[["K...K..","KK.KK..","KEKEK..","KKPKK.K","KKKKKKK",".K...K."],["K...K..","KK.KK..","KEKEK.K","KKPKKK.","KKKKKKK","K.....K"]];
const FCACHE={};
const FDEF={E:'#1a1a24',P:'#ff9aa8',m:'#b04a3a',F:'#3a2418',L:'#4a3a2a',B:'#6a3a1a',W:'#fffaf0',R:'#e84a4a',O:'#f0a030',Y:'#e8a040'};
function folkSpr(pal,kind,fr){const k=kind+fr+pal.H+pal.S+pal.C+pal.B+pal.L+(pal.K||'')+(pal.Y||'');
  return FCACHE[k]||(FCACHE[k]=makeSprite((kind==='me'?FGME:kind==='d'?FGD:kind==='chick'?CHICK:kind==='cat'?CAT:FG)[fr],Object.assign({},FDEF,pal)));}
const F_SKIN=['#ffd8b8','#f8c8a0','#e0a878','#b88058'],F_HAIR=['#5a3418','#8a5a2a','#f0d070','#2a2a3a','#d0603a','#e8e0f0','#c05a8a'],
  F_CLOTH=['#ff8a6a','#5ac08a','#9a8ae8','#f0c050','#5aa8f0','#f07aa8','#a8c060','#f0a0c0','#70c8c8'];
function randFolkPal(){return{H:pick(F_HAIR),S:pick(F_SKIN),C:pick(F_CLOTH),B:pick(['#6a3a1a','#ffffff','#3a3a5a']),L:pick(['#5a4a3a','#4a4a6a','#7a5a3a']),F:'#3a2418'};}
const ME_PAL={soldier:{C:'#a8b4d0',B:'#e85050',K:'#e85050',Y:'#c8d4e8'},merchant:{C:'#50c08a',B:'#ffd34d',K:'#2e8a5a',Y:'#c08040'},
  noble:{C:'#a070e0',B:'#ffd34d',K:'#ffc040',Y:'#ffd34d'},mage:{C:'#6a6af0',B:'#7ff0ff',K:'#4040b0',Y:'#5050d0'},rebel:{C:'#a08a5a',B:'#e85050',K:'#5a7a4a',Y:'#7a5a3a'}};
const FSC=1.5;
function drawFolk(x,y,pal,kind,face,mv,t){
  const fr=mv&&Math.floor(t/180+x*.05)%2?1:0,sp=folkSpr(pal,kind,fr),b=mv?Math.abs(Math.sin(t/120+x))*1.5:0;
  const sm_=kind==='chick'||kind==='cat';ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x,y,sm_?6:9,2.5,0,0,7);ctx.fill();
  ctx.save();ctx.translate(Math.round(x),Math.round(y-b));ctx.scale((face||1)*FSC,FSC);ctx.drawImage(sp,-sp.width/2,-sp.height);ctx.restore();
}
function heroInfoHTML(h){
  const R=RARITY[h.rarity],A=archeOf(h),sk=SKILLS[h.skill];
  const st=['STR','VIT','LEAD','INT'].map(k=>`<span class="stt">${STATN[k]} <b>${heroStat(h,k)}</b><i>+${h.gain[k]}</i></span>`).join('');
  return `<div class="hn"><span style="color:${R.col}">[${R.name}]</span> ${h.name} <span class="lvl">Lv${h.lv}/${h.cap} · ${CLS[h.type]}</span></div>
    <div class="hs">${st}</div>
    <div class="hs">⚡ <b>${sk.name}</b>: ${sk.txt}<br>✦ ${AURAS[h.aura](auraPct(h))}</div>
    <div class="hs">📈 ${A.name} — ${A.desc} · 잠재력 <b style="color:#ffe08a">${potGrade(h)}</b></div>
    <div class="trs">${h.traits.map(t=>`<span class="tr">${t} <small>${TRAITS[t]}</small></span>`).join('')}</div>`;
}
function loyHTML(h){
  const c=h.loyalty>=70?'#7fd06a':h.loyalty>=30?'#f0c050':'#ff6a6a';
  const eff=h.loyalty>=90?' (능력치 +10%)':h.loyalty>=70?' (능력치 +5%)':h.loyalty<30?' (능력치 −5%, 이탈 위험)':'';
  const xpw=h.lv>=h.cap?100:Math.min(100,h.xp/heroNeed(h)*100);
  return `<div class="hs">충성 <b style="color:${c}">${h.loyalty}</b>${eff} · 월급 💰${h.wage}${h.injured>0?` · <span class="danger">부상 ${h.injured}개월</span>`:''}
    <div class="xpb"><i style="width:${xpw}%"></i></div></div>`;
}

/* ---------- 부대(분대) ---------- */
// 아군은 부대 단위로 배치·명령. 같은 병종끼리만 합칠 수 있음.
let squads=[],sqid=0,SQ={},deploySnap=null;
const DEFPOS={spear:[540,0],archer:[450,0],mage:[375,0],cav:[515,-240]};
function mkSquad(type,n,cx,cy,after){
  const used=new Set(squads.filter(q=>q.type===type).map(q=>q.num));let num=1;while(used.has(num))num++;
  const s={id:++sqid,type,n,cx,cy,sel:false,mode:'hold',focus:null,num,label:TYPES[type].name+num,xp:0};
  if(after)squads.splice(squads.indexOf(after)+1,0,s);else squads.push(s);
  return s;
}
function resetSquads(){
  const c={...counts};squads=[];
  if(c.spear)mkSquad('spear',c.spear,540,H/2);
  if(c.archer)mkSquad('archer',c.archer,450,H/2);
  if(c.mage)mkSquad('mage',c.mage,375,H/2);
  const top=Math.ceil(c.cav/2);
  if(top)mkSquad('cav',top,515,H/2-240);
  if(c.cav-top)mkSquad('cav',c.cav-top,515,H/2+240);
}
function syncCounts(){
  ORDER.forEach(t=>counts[t]=0);SQ={};
  squads.forEach(s=>{counts[s.type]+=s.n;SQ[s.id]=s;});
}
const spanOf=n=>(Math.min(10,Math.max(1,n))-1)*24;
function sqPts(s){
  const per=Math.min(10,Math.max(1,s.n)),out=[];
  for(let i=0;i<s.n;i++){const col=Math.floor(i/per),row=i%per,cnt=Math.min(per,s.n-col*per),span=(cnt-1)*24;out.push({x:s.cx-col*26,y:s.cy-span/2+row*24});}
  return out;
}
function clampSquad(s){
  const pts=sqPts(s);if(!pts.length)return;
  const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y));
  if(x0<20)s.cx+=20-x0;else if(x1>ZONE0)s.cx+=ZONE0-x1;
  if(y0<YMIN+4)s.cy+=YMIN+4-y0;else if(y1>YMAX)s.cy+=YMAX-y1;
}
function buildPlayer(){
  const list=[];
  const p1=prog.phase===1,dfd=!p1&&battleCtx&&battleCtx.mode==='defend',rd=dfd?regDef(battleCtx.rid):{dhp:0,dat:0};
  const am=p1?1:(isArmed()?1.1:1)*(prog.hungry?.9:1)*(1+MOD('atk')+(dfd?MOD('dat')+rd.dat:0)),hm=p1?1:(prog.hungry?.9:1)*(dfd&&(REG[battleCtx.rid].bld||[]).includes('fort')?1.2:1)*(1+MOD('hp')+(dfd?MOD('dhp')+rd.dhp:0));
  squads.forEach(s=>{
    clampSquad(s);
    const m=1+.1*starOf(s.xp||0);
    sqPts(s).forEach(p=>{const u=newUnit(0,s.type,p.x,p.y,s.id);u.orig=s.id;u.max=u.hp=Math.round(u.hp*m*hm);u.atkMul=m*am;list.push(u);});
  });
  heroes.forEach(h=>{
    const s=h.sq&&SQ[h.sq];if(!s||h.injured>0)return;
    const pts=sqPts(s),x0=Math.min(...pts.map(p=>p.x));
    list.push(makeHeroUnit(h,0,Math.max(20,x0-26),s.cy,s.id));
  });
  return list;
}
function makeHeroUnit(h,team,x,y,g){
  const u=newUnit(team,h.type,x,y,g);
  u.hero=h;u.orig=g;u.max=u.hp=heroHp(h);u.atkMul=heroAtk(h)/TYPES[h.type].atk;u.r=11;
  u.auraP=auraPct(h)/100;u.auraR=auraRad(h);
  u.eqSpd=Math.max(.6,1+eqB(h,'spd'));u.eqRng=1+eqB(h,'rng');
  return u;
}
const members=(s,alive)=>units.filter(u=>u.team===0&&u.g===s.id&&(!alive||!u.dead));
const selTargets=()=>{const s=squads.filter(q=>q.sel);return s.length?s:squads;};
let toastT=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1800);}
// 전투 중 부대를 한자리에 모으기 (대기 위치 재설정)
function regroup(s,shiftY){
  const m=members(s,true);if(!m.length)return;
  const cx=m.reduce((a,u)=>a+u.x,0)/m.length,cy=m.reduce((a,u)=>a+u.y,0)/m.length+(shiftY||0);
  const per=Math.min(10,m.length);
  m.sort((a,b)=>a.y-b.y).forEach((u,i)=>{
    const col=Math.floor(i/per),row=i%per,cnt=Math.min(per,m.length-col*per);
    u.anchor={x:cx-col*26,y:Math.max(YMIN,Math.min(YMAX,cy-(cnt-1)*12+row*24))};
    if(s.mode==='hold')u.mode='hold';
  });
}
function splitSel(){
  const sel=squads.filter(s=>s.sel);
  if(!sel.length){toast('나눌 부대를 먼저 선택하세요');return;}
  let did=0;
  sel.forEach(s=>{
    if(state==='deploy'){
      if(s.n<2)return;
      const a=Math.ceil(s.n/2),b=s.n-a,tot=spanOf(a)+36+spanOf(b),old=s.cy;
      s.n=a;s.cy=old-tot/2+spanOf(a)/2;
      const ns=mkSquad(s.type,b,s.cx,old+tot/2-spanOf(b)/2,s);ns.sel=true;ns.xp=s.xp||0;did++;
    }else{
      const m=members(s,true).sort((p,q)=>p.y-q.y);
      if(m.length<2)return;
      const ns=mkSquad(s.type,0,0,0,s);ns.mode=s.mode;ns.focus=s.focus;ns.sel=true;ns.xp=s.xp||0;
      m.slice(Math.ceil(m.length/2)).forEach(u=>u.g=ns.id);
      if(s.mode==='hold'){regroup(s,-22);regroup(ns,22);}
      did++;
    }
  });
  if(!did)toast('2명 이상인 부대만 나눌 수 있어요');
  afterSquadChange();
}
function mergeSel(){
  const sel=squads.filter(s=>s.sel);
  if(sel.length<2){toast('합칠 부대를 2개 이상 선택하세요');return;}
  const byType={};sel.forEach(s=>(byType[s.type]=byType[s.type]||[]).push(s));
  let did=0;
  Object.values(byType).forEach(g=>{
    if(g.length<2)return;
    const f=g[0],rest=g.slice(1);
    if(state==='deploy'){
      let n=0,cx=0,cy=0,xp=0;g.forEach(s=>{n+=s.n;cx+=s.cx*s.n;cy+=s.cy*s.n;xp+=(s.xp||0)*s.n;});
      f.n=n;f.cx=cx/n;f.cy=cy/n;f.xp=Math.round(xp/n);
      rest.forEach(s=>heroes.forEach(h=>{if(h.sq===s.id){if(heroes.some(o=>o.sq===f.id)){h.sq=null;toast(h.name+' 배속 해제 (부대당 장수 1명)');}else h.sq=f.id;}}));
    }else{
      rest.forEach(s=>units.forEach(u=>{if(u.team===0&&u.g===s.id){u.g=f.id;if(!u.dead)u.mode=f.mode;}}));
      if(f.mode==='hold')regroup(f);
    }
    squads=squads.filter(s=>!rest.includes(s));did++;
  });
  if(!did)toast('같은 병종끼리만 합칠 수 있어요 · 다른 병종은 함께 선택해서 명령하세요');
  afterSquadChange();
}
function afterSquadChange(){if(state==='deploy')layout();else syncCounts();renderChips();if(state==='deploy')refreshBudget();}
let chipKey='',chipT=0;
function renderChips(){
  const inB=state!=='deploy',el=$(inB?'chipsB':'chipsD');
  const key=(inB?'B':'D')+squads.map(s=>s.id).join(',');
  if(key!==chipKey){
    chipKey=key;el.innerHTML='';
    const all=document.createElement('button');all.className='chip';all.dataset.id='all';all.textContent='전체';
    all.onclick=()=>{const any=squads.some(s=>!s.sel);squads.forEach(s=>s.sel=any);renderChips();};
    el.appendChild(all);
    squads.forEach(s=>{
      const id=s.id,b=document.createElement('button');b.className='chip';b.dataset.id=id;
      b.innerHTML='<span class="lb"></span><span class="md"></span>';
      b.onclick=()=>{const q=SQ[id];if(q){q.sel=!q.sel;renderChips();}};
      el.appendChild(b);
    });
  }
  el.querySelectorAll('.chip').forEach(b=>{
    if(b.dataset.id==='all'){b.classList.toggle('sel',squads.length>0&&squads.every(s=>s.sel));return;}
    const s=SQ[b.dataset.id];if(!s)return;
    const n=inB?members(s,true).filter(u=>!u.hero).length:s.n;
    const hn=inB?members(s,true).filter(u=>u.hero).map(u=>u.hero.name):heroes.filter(h=>h.sq===s.id&&!h.injured).map(h=>h.name);
    b.querySelector('.lb').textContent=`${s.label}${starTxt(starOf(s.xp||0))} ·${n}${hn.length?' +'+hn.join('+'):''}`;
    const md=b.querySelector('.md');md.className='md '+s.mode;
    md.textContent=inB?{charge:'돌격',hold:'대기',retreat:'후퇴'}[s.mode]:'';md.style.display=inB?'':'none';
    b.classList.toggle('sel',s.sel);b.classList.toggle('dead',inB&&n===0);
  });
  if(!inB&&state==='deploy')renderHeroCardsSel();
  const tg=selTargets();
  document.querySelectorAll('#cmds [data-m]').forEach(b=>b.classList.toggle('on',tg.length>0&&tg.every(s=>s.mode===b.dataset.m)));
}

function newUnit(team,type,x,y,g){
  const T=TYPES[type];
  return {id:uid++,team,type,g,x,y,hp:T.hp,max:T.hp,cd:Math.random()*.6,mode:'hold',
    anchor:{x,y},home:{x:team===0?Math.max(28,x-260):Math.min(W-28,x+260),y},
    face:team===0?1:-1,flash:0,lunge:0,anim:Math.random()*6,dead:false,deathT:0,
    tgt:null,rt:0,charge:0,moving:false,r:type==='cav'?10:7};
}
function column(n,x,y0,y1){
  const out=[],per=Math.max(1,Math.floor((y1-y0)/24)+1);
  for(let i=0;i<n;i++){
    const col=Math.floor(i/per),row=i%per,cnt=Math.min(per,n-col*per),span=(cnt-1)*24;
    out.push({x:x-col*26,y:(y0+y1)/2-span/2+row*24});
  }
  return out;
}
function buildArmy(team,c){
  const X=v=>team===0?v:W-v,list=[];
  const xmin=team===0?20:ZONE1,xmax=team===0?ZONE0:W-20;
  const add=(type,pos,g)=>{
    if(!pos.length)return;
    const offs=team===0?goff:eoff,o=offs[g]||{dx:0,dy:0};
    const pts=pos.map(p=>({x:X(p.x),y:p.y}));
    const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y));
    const dx=Math.max(xmin-x0,Math.min(xmax-x1,o.dx)),dy=Math.max(YMIN+4-y0,Math.min(YMAX-y1,o.dy));
    if(team===0&&offs[g])offs[g]={dx,dy};
    const em=team===1?enemyMul():1;
    pts.forEach(p=>{const u=newUnit(team,type,p.x+dx,p.y+dy,g);if(em>1){u.max=u.hp=Math.round(u.hp*em);u.atkMul=em;}list.push(u);});
  };
  const cy=H/2;
  add('spear',column(c.spear,540,cy-150,cy+150),'spear');
  add('archer',column(c.archer,450,cy-150,cy+150),'archer');
  add('mage',column(c.mage,375,cy-60,cy+60),'mage');
  const top=Math.ceil(c.cav/2);
  add('cav',column(top,515,cy-280,cy-200),'cav0');
  add('cav',column(c.cav-top,515,cy+200,cy+280),'cav1');
  if(team===1){
    (rivals[PRESETS.indexOf(preset)]||[]).forEach((h,i)=>{
      if(h.injured>0)return;
      const g=h.type==='cav'?'cav'+(i%2):h.type,m=list.filter(u=>u.g===g);
      const x=m.length?Math.max(...m.map(u=>u.x))+28:W-DEFPOS[h.type][0]+30,y=m.length?m.reduce((a,u)=>a+u.y,0)/m.length:H/2+(i?80:-80);
      list.push(makeHeroUnit(h,1,Math.min(W-20,x),y,g));
    });
  }
  return list;
}

/* ---------- 편성 UI ---------- */
const rowRefs={};
ORDER.forEach(t=>{
  const T=TYPES[t],r=document.createElement('div');r.className='row';
  const ic=document.createElement('canvas'),s=SPR[t][0];ic.width=s.width;ic.height=s.height;
  ic.getContext('2d').drawImage(s,0,0);ic.style.width=(s.width*1.5)+'px';
  const info=document.createElement('div');
  info.innerHTML=`<div class="nm">${T.name}<span class="cost">💰${T.cost}</span></div><div class="ds">${T.desc}</div>`;
  const st=document.createElement('div');st.className='step';
  const mi=document.createElement('button');mi.textContent='−';
  const sp=document.createElement('span');
  const pl=document.createElement('button');pl.textContent='+';
  mi.onclick=()=>{
    const s=[...squads].reverse().find(q=>q.type===t&&q.n>0);
    if(s){s.n--;if(s.n<=0){squads=squads.filter(q=>q!==s);heroes.forEach(h=>{if(h.sq===s.id)h.sq=null;});}}
    refreshDeploy();
  };
  pl.onclick=()=>{
    const s=[...squads].reverse().find(q=>q.type===t);
    if(s){s.xp=Math.round((s.xp||0)*s.n/(s.n+1));s.n++;}else{const d=DEFPOS[t];mkSquad(t,1,d[0],H/2+d[1]);}
    refreshDeploy();
  };
  st.append(mi,sp,pl);r.append(ic,info,st);$('rows').appendChild(r);
  rowRefs[t]={mi,sp,pl};
});
const spent=()=>ORDER.reduce((a,t)=>a+counts[t]*TYPES[t].cost,0);
const total=c=>ORDER.reduce((a,t)=>a+c[t],0);
function layout(){syncCounts();units=[...buildPlayer(),...buildArmy(1,enemyCounts())];}
const capOfType=t=>t==='cav'?(prog.goods.horse||0):t==='mage'?(prog.goods.mana||0):99;
function trimToCaps(){
  if(prog.phase===1)return;
  ['cav','mage'].forEach(t=>{let c=squads.filter(q=>q.type===t).reduce((a,q)=>a+q.n,0);
    while(c>capOfType(t)){const q=[...squads].reverse().find(x=>x.type===t&&x.n>0);if(!q)break;q.n--;c--;if(q.n<=0){squads=squads.filter(x=>x!==q);heroes.forEach(h=>{if(h.sq===q.id)h.sq=null;});}}});
  syncCounts();
}
const isArmed=()=>prog.phase!==1&&prog.goods&&(prog.goods.iron||0)>=Math.ceil(soldierCount()/2);
function refreshBudget(){
  if(prog.phase===1){
    const n=total(counts);$('rows').classList.add('locked');$('bmax').textContent='—';$('gold').textContent='무리 '+n+'명';
    ORDER.forEach(t=>{rowRefs[t].sp.textContent=counts[t];});$('start').disabled=n===0;
    $('capinfo').innerHTML=`내 무리 ${n}명과 동료가 싸웁니다. 부대 나누기·합치기, 배치, 장수 배속은 그대로 쓸 수 있어요.`;return;
  }
  $('rows').classList.remove('locked');
  const B=armyBudget(),left=B-spent(),n=total(counts);$('bmax').textContent=B;
  $('gold').textContent=left;$('gold').style.color=left<0?'#ff6a6a':'';
  ORDER.forEach(t=>{const r=rowRefs[t];r.sp.textContent=counts[t];r.mi.disabled=counts[t]<=0;r.pl.disabled=TYPES[t].cost>left||n>=MAXU||counts[t]>=capOfType(t);});
  $('start').disabled=n===0||left<0;
  const W_=WEATHER[prog.weather];
  $('capinfo').innerHTML=`🐎 말 ${prog.goods.horse||0} → 기병 최대 ${prog.goods.horse||0} · 🔮 마정석 ${prog.goods.mana||0} → 마법사 최대 ${prog.goods.mana||0}<br>
    ${isArmed()?'⛏ 철제 무장: 아군 공격 +10%':`⛏ 철 부족 (${prog.goods.iron||0}/${Math.ceil(soldierCount()/2)}): 무장 보너스 없음`}${prog.hungry?' · <span class="danger">🍞 군량 부족: −10%</span>':''}
    · 날씨 ${W_.icon}${W_.name} (${W_.txt})${left<0?' · <span class="danger">군자금 초과! 병력을 줄이세요</span>':''}`;
}
function refreshDeploy(){
  syncCounts();trimToCaps();refreshBudget();
  $('ename').textContent=preset.name;
  const em=enemyMul();
  const rv=(rivals[PRESETS.indexOf(preset)]||[]);
  const ec=enemyCounts();
  $('ecounts').innerHTML=ORDER.filter(t=>ec[t]>0).map(t=>`${TYPES[t].name} ${ec[t]}`).join(' · ')+` · 본거지: ${BIOMES[preset.biome].name}`+(em>1?` · 적 숙련 +${Math.round((em-1)*100)}%`:'')
    +`<div class="ecard">적 장수: ${rv.length?rv.map(h=>`<span style="color:${RARITY[h.rarity].col}">${h.name}</span> Lv${h.lv} ${CLS[h.type]} (⚡${SKILLS[h.skill].name})${h.injured>0?' <span class="danger">부상</span>':''}`).join(', '):'없음'}</div>`;
  document.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b.dataset.loc===loc));
  layout();
  projs=[];parts=[];texts=[];sfxA=[];
  renderChips();renderHeroes();save();
}
function renderHeroCardsSel(){
  const sel=squads.filter(q=>q.sel),cards=$('heroes').children;
  heroes.forEach((h,i)=>{if(cards[i])cards[i].classList.toggle('on',sel.length===1&&h.sq===sel[0].id);});
}
function renderHeroes(){
  const el=$('heroes');el.innerHTML='';
  if(!heroes.length){el.innerHTML='<div class="sub">장수가 없습니다. 본부의 주점에서 고용하세요.</div>';return;}
  const sel=squads.filter(q=>q.sel);
  heroes.forEach(h=>{
    const b=document.createElement('button');b.className='hcard';
    const s=h.sq&&SQ[h.sq],R=RARITY[h.rarity],sk=SKILLS[h.skill];
    const st=h.injured>0?`<span class="danger">부상 — ${h.injured}개월 출전 불가</span>`:s?`배속: <b style="color:#ffe08a">${s.label}</b>`:'대기 중';
    b.append(iconOf(h,0));
    b.insertAdjacentHTML('beforeend',`<div class="hn"><span style="color:${R.col}">${h.name}</span> <span style="font-size:11px;color:#c4cbe6">Lv${h.lv} · ${CLS[h.type]} · 충성 ${h.loyalty}</span></div>
      <div class="hs">⚡${sk.name} · ✦${AURAS[h.aura](auraPct(h))}</div><div class="hs">${h.traits.join(' · ')}</div>
      <div class="st">${st}<div class="xpb"><i style="width:${h.lv>=h.cap?100:Math.min(100,h.xp/heroNeed(h)*100)}%"></i></div></div>`);
    b.classList.toggle('on',sel.length===1&&h.sq===sel[0].id);
    b.classList.toggle('inj',h.injured>0);
    b.onclick=()=>{
      if(h.injured>0){toast(h.name+'은(는) 부상 중입니다');return;}
      const ss=squads.filter(q=>q.sel);
      if(ss.length!==1){
        if(h.sq){h.sq=null;refreshDeploy();return;}
        toast('장수를 배속할 부대를 하나만 선택하세요');return;
      }
      const t=ss[0];
      if(h.sq===t.id)h.sq=null;
      else{heroes.forEach(o=>{if(o.sq===t.id)o.sq=null;});h.sq=t.id;}
      refreshDeploy();
    };
    el.appendChild(b);
  });
}
function show(id,on){$(id).classList.toggle('hidden',!on);}
function restoreSquads(){if(deploySnap)squads=deploySnap.map(o=>({...o,sel:false,mode:'hold',focus:null}));syncCounts();}
function toDeploy(ctx){
  battleCtx=ctx;
  if(ctx.p1){
    preset={name:ctx.q.name,biome:PRESETS[prog.p1.home-1].biome,c:ctx.ec};loc='border';forceBiome=preset.biome;genTerrain();
    ['p1','p1start'].forEach(id=>show(id,false));hideTown();
  }else{
    forceBiome=null;
    preset=ctx.enemy>0?PRESETS[ctx.enemy-1]:BANDIT;
    loc=ctx.mode==='defend'?'home':(ctx.enemy>0?'enemy':'border');
    genTerrain();
    restoreSquads();
  }
  heroes.forEach(h=>{if(h.injured>0)h.sq=null;});
  state='deploy';shake=0;chipKey='';heroUnits=[];pending=null;evs=[];
  ['hub','report','event','maphint'].forEach(id=>show(id,false));
  show('deploy',true);show('dhint',true);show('top',false);show('cmds',false);show('hint',false);show('result',false);
  show('zoom',true);
  $('backhub').textContent=ctx.p1?(ctx.q.crown?'◀ 아직은 때가 아니다':'◀ 의뢰 포기'):ctx.mode==='attack'?'◀ 지도로 (침공 취소)':'🏳 싸우지 않고 땅을 내준다';
  refreshDeploy();resetCam();
}
let hubTab='map';
function toHub(reportLog){
  restoreSquads();
  state='hub';pending=null;heroUnits=[];evs=[];chipKey='';
  projs=[];parts=[];texts=[];sfxA=[];
  ['deploy','dhint','top','cmds','hint','result'].forEach(id=>show(id,false));hideTown();
  show('hub',true);show('zoom',true);show('maphint',true);
  renderHub();mapCam();
  if(reportLog&&reportLog.length){$('replog').innerHTML=reportLog.join('<br>');show('report',true);}
  else if(pendingInv)showInvasion();
  if(!prog.origin)showOrigin();
  save();
}
function showInvasion(){
  const pi=pendingInv;if(!pi)return;const r=REG[pi.rid];
  selReg=r.id;
  $('evtitle').textContent='⚠ 침공!';
  $('evbody').innerHTML=`<b style="color:${ownerCol(pi.attacker)}">${NATIONS[pi.attacker].name}</b> 군대가 <b>${r.name}</b>을(를) 침공했습니다.<br>맞서 싸우면 우리 땅에서 싸우는 이점(언덕·숲이 아군 쪽)이 있습니다.<br><span class="sub">예상 적 병력: ${ORDER.map(t=>`${TYPES[t].name} ${enemyCountsFor(pi.attacker)[t]}`).join(' · ')}</span>`;
  const b=$('evbtns');b.innerHTML='';
  const fight=document.createElement('button');fight.className='big';fight.textContent='🛡 방어전 출전';
  fight.onclick=()=>{show('event',false);toDeploy({rid:r.id,mode:'defend',enemy:pi.attacker});};
  const give=document.createElement('button');give.className='ghost';give.textContent='땅을 내준다';
  give.onclick=()=>{surrender(r,pi.attacker);};
  b.append(give,fight);show('event',true);
}
function surrender(r,att){
  r.owner=att;r.cap=false;pendingInv=null;battleCtx=null;buildMapArt();show('event',false);
  if(!myRegs().length)return gameOver();
  toHub([`<span class="danger">🏳 ${r.name}을(를) ${NATIONS[att].name}에게 내줬습니다</span>`]);
}
function gameOver(){
  try{localStorage.removeItem(slotKey());}catch(_){}
  newGame();toP1();toast('왕국이 멸망했습니다. 새로운 삶을 시작합니다');
}
function finishBattle(){
  if(battleCtx&&battleCtx.p1)return finishP1Battle();
  const c=battleCtx,log=[];
  if(c){const r=REG[c.rid];
    if(c.mode==='attack'){
      if(lastWin){const old=r.owner;r.owner=0;const wasCap=r.cap;r.cap=false;
        let bonus=wasCap?200:0;prog.gold+=bonus;
        log.push(`🏴 ${r.name} 점령!${old>0?` (${NATIONS[old].name}에게서)`:''}${bonus?` 수도 약탈 +${bonus}`:''}`);checkElim(old,log);}
      else log.push(`<span class="danger">${r.name} 침공 실패</span>`);
    }else{
      if(lastWin)log.push(`🛡 ${r.name} 방어 성공!`);
      else{r.owner=c.enemy;r.cap=false;log.push(`<span class="danger">🏳 ${r.name}을(를) 빼앗겼습니다</span>`);}
    }
  }
  if(c&&lastWin){const r=REG[c.rid],cap=c.mode==='attack'&&log.some(x=>x.includes('수도 약탈'));
    const l=cap?gainItem(rollItem(p2Lv()+1,{r:rint(2,3)}),'수도의 보물고'):lootChance(c.mode==='attack'?(r.owner===0&&c.enemy<0?.3:.45):.35,p2Lv(),'전리품');if(l)log.push(l);
    if(prog.weather==='frost'&&Math.random()<.15){const u=giveUnique('u_frost_blade','혹한 속 승리');if(u)log.push(u);}
    if(prog.wins>=25){const u=giveUnique('u_hundred_helm','전투 25승');if(u)log.push(u);}
    if(myRegs().length>=15){const u=giveUnique('u_conqueror','영토 15곳');if(u)log.push(u);}}
  battleCtx=null;pendingInv=null;buildMapArt();
  if(!myRegs().length)return gameOver();
  toHub([...log,...monthEnd()]);
}
function renderMapTab(el){
  const r=selReg>=0?REG[selReg]:null;
  const box=document.createElement('div');box.className='rg';el.appendChild(box);
  if(!r){
    const mine=myRegs(),fc=kingdomForecast();
    box.style.borderLeftColor=NATIONS[0].col;
    box.innerHTML=`<h3>${prog.kingName?prog.kingName+' 왕의 ':''}왕국</h3>영토 <b>${mine.length}</b> / ${REG.length} · 군자금 한도 <b>${armyBudget()}</b><br>
      이번 달 예상: 💰${fc.gold}${fc.trade?` + 무역 ${fc.trade}`:''} · ${fmtGoods(fc)} · 곡물 소비 🌾−${fc.upkeep}<br>
      <span class="sub">지역을 누르면 특산물과 건물을 볼 수 있습니다. 지역마다 지을 수 있는 건물이 다르고 자리가 한정돼 있어서, 어떻게 키울지 골라야 합니다.
      ⚔ 표시가 있는 이웃 땅은 침공할 수 있지만, 싸울 마음이 없으면 "다음 달"로 시간만 보내도 됩니다.</span>
      ${prog.won?'<br>👑 <b style="color:#ffd34d">세계 강국 달성!</b>':`<br>목표: 대륙의 60% (${Math.ceil(REG.length*.6)}개 지역) 차지`}
      <div class="rlist"></div>`;
    const list=box.querySelector('.rlist');
    mine.forEach(x=>{const b=document.createElement('button');b.textContent=`${x.cap?'🏰':''}${x.name} ${GOODS[x.spec].icon}${x.rare?GOODS[x.rare].icon:''} ${(x.bld||[]).map(k=>BUILD[k].icon).join('')}`;b.onclick=()=>{selReg=x.id;renderHub();};list.appendChild(b);});
    return;
  }
  box.style.borderLeftColor=ownerCol(r.owner);
  const B=BIOMES[r.biome],pr=regProd(r);
  let html=`<h3>${r.cap?'🏰 ':''}${r.name}</h3>
    소유: <b style="color:${ownerCol(r.owner)}">${ownerName(r.owner)}</b>${r.cap?' (수도)':''} · 지형 <b>${B.name}</b><br>
    특산물: ${GOODS[r.spec].icon} <b>${GOODS[r.spec].name}</b>${r.rare?` · 희귀 자원: ${GOODS[r.rare].icon} <b style="color:#ffd34d">${GOODS[r.rare].name}</b>`:''}<br>
    건물 (${(r.bld||[]).length}/${slotsOf(r)}): ${(r.bld||[]).length?(r.bld||[]).map(k=>`<span class="bld">${BUILD[k].icon} ${BUILD[k].name}</span>`).join(''):'<span class="sub">없음</span>'}<br>
    이번 달(${SEASONS[seasonIdx()]}) 생산: 💰${pr.gold} ${fmtGoods(pr)}`;
  const acts=document.createElement('div');acts.className='acts2';
  const btn=(t,c,fn,dis)=>{const b=document.createElement('button');b.innerHTML=t;if(c)b.className=c;b.onclick=fn;b.disabled=!!dis;acts.appendChild(b);return b;};
  if(r.owner===0){
    box.innerHTML=html;
    {const wb=document.createElement('button');wb.className='big';wb.style.margin='6px 0';wb.innerHTML='🚶 이 도시 걸어서 둘러보기';wb.onclick=()=>enterKT(r.id);box.appendChild(wb);}
    const free=slotsOf(r)-(r.bld||[]).length;
    const bl=document.createElement('div');bl.className='blist';
    bl.insertAdjacentHTML('beforeend',`<b style="font-size:13px">🏗 지을 수 있는 건물 ${free>0?`(빈 자리 ${free})`:'— 자리가 가득 찼습니다'}</b>`);
    Object.entries(BUILD).filter(([k])=>canBuild(r,k)).forEach(([k,Bd])=>{
      const b=document.createElement('button');b.innerHTML=`${Bd.icon} <b>${Bd.name}</b> — ${costTxt(Bd.cost)}<br><span class="sub">${Bd.txt}</span>`;
      b.disabled=free<=0||!affordable(Bd.cost);
      b.onclick=()=>{if(!affordable(Bd.cost))return toast('자원이 부족합니다');pay(Bd.cost);r.bld=[...(r.bld||[]),k];buildMapArt();initMents();toast(`${r.name}에 ${Bd.name} 건설`);renderHub();save();};
      bl.appendChild(b);
    });
    if((r.bld||[]).length){
      const d=document.createElement('button');d.className='ghost';d.textContent='건물 하나 철거 (자리 비우기)';
      d.onclick=function(){if(!this._arm){this._arm=1;this.textContent=`한 번 더: ${BUILD[r.bld[r.bld.length-1]].name} 철거`;setTimeout(()=>{this._arm=0;this.textContent='건물 하나 철거 (자리 비우기)';},2500);return;}
        const rm=r.bld[r.bld.length-1];r.bld=r.bld.slice(0,-1);if(r.up)delete r.up[rm];buildMapArt();renderHub();save();};
      bl.appendChild(d);
    }
    box.appendChild(bl);
    regUpgradeUI(r,box);
  }else{
    const ec=enemyCountsFor(r.owner);
    html+=`<br>예상 적 병력: ${ORDER.filter(t=>ec[t]).map(t=>`${TYPES[t].name} ${ec[t]}`).join(' · ')}`;
    if(r.owner>0){
      const n=nations[r.owner],rv=rivals[r.owner-1]||[];
      html+=`<br>적 장수: ${rv.length?rv.map(h=>`<span style="color:${RARITY[h.rarity].col}">${h.name}</span> Lv${h.lv}${h.injured>0?'(부상)':''}`).join(', '):'없음'}`;
      html+=`<br>관계: <span class="rel ${n.rel}">${{war:'전쟁 중',peace:`평화 (${n.peace}개월)`,neutral:'중립'}[n.rel]}</span> · 호감 ${n.att}${n.ally?' · 🤝 동맹':''}${n.trade?' · 🐪 무역':''}`;
    }
    if(!adjToPlayer(r))html+='<br><span class="sub">우리 땅과 붙어 있어야 침공할 수 있습니다</span>';
    else if(r.owner>0&&nations[r.owner].ally)html+='<br><span class="sub">동맹국은 침공할 수 없습니다 (외교 탭에서 동맹 파기)</span>';
    else if(r.owner>0&&nations[r.owner].rel==='peace')html+='<br><span class="sub">평화 조약 중에는 침공할 수 없습니다</span>';
    else if(r.owner>0&&nations[r.owner].rel==='neutral'){
      btn(`⚔ 선전포고 후 침공`,'war',function(){
        if(!this._arm){this._arm=1;this.textContent=`정말 ${NATIONS[r.owner].name}과 전쟁? 한 번 더`;setTimeout(()=>{this._arm=0;this.textContent='⚔ 선전포고 후 침공';},2500);return;}
        declareWar(r.owner);toDeploy({rid:r.id,mode:'attack',enemy:r.owner});
      });
      html+=`<br><span class="sub">이 나라와 전쟁이 시작되고 무역이 끊깁니다. 저들도 우리 땅을 침공해 올 수 있습니다</span>`;
    }else btn(`⚔ 침공 (${r.owner<0?'도적 토벌':'전쟁 중'})`,'war',()=>toDeploy({rid:r.id,mode:'attack',enemy:r.owner}));
    box.innerHTML=html;
  }
  box.appendChild(acts);
  const back=document.createElement('button');back.className='ghost';back.textContent='선택 해제';back.style.marginTop='6px';
  back.onclick=()=>{selReg=-1;renderHub();};box.appendChild(back);
}
function declareWar(k){
  const n=nations[k];n.rel='war';n.trade=false;n.ally=false;n.att=Math.max(-100,n.att-40);
  nations.forEach((o,i)=>{if(i>0&&i!==k&&o.alive&&o.rival===k)o.att=Math.min(100,o.att+8);});
}
function renderEcon(el){
  const fc=kingdomForecast(),W_=WEATHER[prog.weather];
  const net=fc.gold+fc.trade-fc.wages;
  const box=document.createElement('div');box.className='rg';box.style.borderLeftColor='#f0c050';el.appendChild(box);
  box.innerHTML=`<h3>⚖ 이번 달 예상</h3>
    금: 세금 💰${fc.gold}${fc.trade?` + 무역 💰${fc.trade}`:''} − 급여 💰${fc.wages} = <b style="color:${net>=0?'#7fd06a':'#ff7a6a'}">${net>=0?'+':''}${net}</b><br>
    생산: ${fmtGoods(fc)||'없음'}<br>
    곡물 소비: 🌾${fc.upkeep} (병사 ${soldierCount()}명의 절반 + 장수 ${heroes.length}명) → 곡물 ${fc.grain-fc.upkeep>=0?'+':''}${fc.grain-fc.upkeep}
    ${prog.hungry?'<br><span class="danger">🍞 지난달 군량이 모자랐습니다: 다음 전투에서 아군 공격·체력 −10%</span>':''}
    <br><span class="sub">계절: ${SEASONS[seasonIdx()]} (${calMonth()}월) · 날씨 ${W_.icon}${W_.name} — ${W_.txt}<br>
    가을은 수확기라 곡물이 크게 늘고, 겨울엔 곡물이 거의 나지 않습니다. 겨울을 대비해 곡물을 모아 두세요.</span>`;
  const tb=document.createElement('div');tb.className='rg';tb.style.borderLeftColor='#7fb0ff';el.appendChild(tb);
  tb.innerHTML=`<h3>세율과 민심</h3>민심 <b>${prog.morale}</b>/100 — 높으면 세금이 잘 걷히고(최대 +40%), 25 아래로 떨어지면 반란이 일어날 수 있습니다
    <div class="bar2"><i style="width:${prog.morale}%;background:${prog.morale>=60?'#7fd06a':prog.morale>=30?'#f0c050':'#ff6a6a'}"></i></div>`;
  const seg=document.createElement('div');seg.className='seg3';
  Object.entries(TAX).forEach(([k,T])=>{const b=document.createElement('button');b.innerHTML=`${T.name}<br><small>${T.txt}</small>`;b.classList.toggle('on',prog.tax===k);b.onclick=()=>{prog.tax=k;renderHub();save();};seg.appendChild(b);});
  tb.appendChild(seg);
  const mk=document.createElement('div');mk.className='rg';mk.style.borderLeftColor='#8fe08a';el.appendChild(mk);
  mk.innerHTML=`<h3>🏪 시장</h3><span class="sub">가격은 매달, 계절마다 바뀝니다. 무역 상대국과 시장 건물이 많을수록 비싸게 팝니다.</span>`;
  const t=document.createElement('table');t.className='gtab';
  GK.forEach(g=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${GOODS[g].icon} ${GOODS[g].name}</td><td><b>${prog.goods[g]||0}</b></td>`;
    const td1=document.createElement('td'),td2=document.createElement('td');
    const sp=sellPrice(g),bp=buyPrice(g);
    const sb=document.createElement('button');sb.textContent=`팔기 10 (+${sp*10})`;sb.disabled=(prog.goods[g]||0)<10;
    sb.onclick=()=>{prog.goods[g]-=10;prog.gold+=sp*10;renderHub();save();};
    const bb=document.createElement('button');bb.textContent=`사기 10 (−${bp*10})`;bb.disabled=prog.gold<bp*10;
    bb.onclick=()=>{prog.gold-=bp*10;prog.goods[g]=(prog.goods[g]||0)+10;renderHub();save();};
    td1.appendChild(sb);td2.appendChild(bb);tr.append(td1,td2);t.appendChild(tr);
  });
  mk.appendChild(t);
  el.insertAdjacentHTML('beforeend',`<div class="hubbar">자원 쓰임새: 🪵목재·⛏철은 건물, 🐎말은 기병 수 한도, 🔮마정석은 마법사 수 한도, ⛏철이 병사 수의 절반 이상이면 철제 무장(공격 +10%), 🌿약초는 장수 부상 치료, 🌾곡물은 군량.</div>`);
}
function renderKing(el){
  if(!prog.origin){showOrigin();return;}
  const O=ORIGINS[prog.origin],kh=heroes.find(h=>h.king);
  const box=document.createElement('div');box.className='rg';box.style.borderLeftColor='#ffd34d';el.appendChild(box);
  box.innerHTML=`<h3>👑 ${prog.kingName} 왕 — ${O.name}</h3><span class="sub">${O.desc}</span>
    ${KSTAT.map(s=>{const v=kst(s);return `<div class="kst"><span>${s}</span><div class="bar2"><i style="width:${Math.min(100,v)}%;background:${v>=65?'#7fd06a':v>=45?'#f0c050':'#ff7a6a'}"></i></div><b>${v}</b></div><div class="why" style="margin:-2px 0 4px 50px">${KDESC[s]}</div>`;}).join('')}
    <div style="color:#8fe08a">▲ 강점: ${O.pro}</div><div style="color:#ff9a9a">▼ 약점: ${O.con}</div>
    <div style="color:#ffd34d">⚖ 즉위의 역경: <b>${TIERS[prog.originTier||0].n}</b> — 강점 효과 ×${proM()}, 약점 효과 ×${conM()}${(prog.originTier||0)>=2?' (어려운 길을 이겨내 강점이 커지고 약점이 줄었습니다)':''}</div>
    <div class="sub" style="margin-top:6px">현재 효과: 수입 ×${admMul().toFixed(2)} · 외교 호감 상승 ×${chaMul().toFixed(2)} · 군자금 한도 ${armyBudget()} · 장수 고용비 ×${(1-(kst('매력')-50)/300).toFixed(2)}</div>
    ${kh?`<div class="sub" style="margin-top:6px">왕도 장수처럼 부대에 배속해 직접 출전할 수 있습니다 (Lv${kh.lv}, ⚡왕의 함성). 전투에서 레벨이 오르면 무예·통솔 등이 자랍니다.
      ${kh.injured>0?`<span class="danger">부상 ${kh.injured}개월</span>`:''}</div>`:''}`;
}
function renderDiplo(el){
  el.insertAdjacentHTML('beforeend',`<div class="hubbar">호감도가 오르면 무역·동맹을 맺을 수 있고, −60 아래로 떨어지면 저쪽이 먼저 선전포고할 수 있습니다. 중립 상태에서는 먼저 공격하지 않습니다.</div>`);
  for(let k=1;k<NATIONS.length;k++){
    if(nations[k].absorbed)continue;
    const n=nations[k],box=document.createElement('div');box.className='rg';box.style.borderLeftColor=NATIONS[k].col;el.appendChild(box);
    const regs=regsOf(k).length,rv=rivals[k-1]||[];
    const relTxt=!n.alive?'멸망':{war:'전쟁 중',peace:`평화 (${n.peace}개월 남음)`,neutral:'중립'}[n.rel];
    const ac=n.att>=30?'#7fd06a':n.att>=-30?'#f0c050':'#ff6a6a';
    box.innerHTML=`<h3 style="color:${NATIONS[k].col}">${NATIONS[k].name}</h3>
      <span class="rel ${n.alive?n.rel:'dead'}">${relTxt}</span>${n.ally?' <span class="rel peace">🤝 동맹</span>':''}${n.trade?' <span class="rel neutral">🐪 무역 중</span>':''}
      · 영토 ${regs} · 장수 ${rv.length}<br>
      호감도 <b style="color:${ac}">${n.att}</b><div class="bar2"><i style="width:${(n.att+100)/2}%;background:${ac}"></i></div>
      <div class="why">지난달 변화 이유: ${n.why&&n.why.length?n.why.join(' · '):'없음'}</div>
      원하는 물자: ${GOODS[n.want].icon}${GOODS[n.want].name} (무역 중에 20개 이상 있으면 매달 10개씩 수출해 금과 호감) · 숙적: <b style="color:${NATIONS[n.rival].col}">${NATIONS[n.rival].name}</b>`;
    if(!n.alive)continue;
    const acts=document.createElement('div');acts.className='acts2';box.appendChild(acts);
    const add=(t,c,fn,dis)=>{const b=document.createElement('button');b.innerHTML=t;if(c)b.className=c;b.onclick=fn;b.disabled=!!dis;acts.appendChild(b);return b;};
    if(n.rel!=='war'){
      const gv=Math.round(12*chaMul());
      add(`🎁 선물 (💰100, 호감 +${gv})`,'',()=>{prog.gold-=100;n.att=Math.min(100,n.att+gv);renderHub();save();},prog.gold<100);
      if(!n.trade)add(`🐪 무역 협정 (호감 −10 이상)`,'',()=>{n.trade=true;n.att=Math.min(100,n.att+3);toast(`${NATIONS[k].name}과 무역 시작: 매달 금, 상단 왕래`);initMents();renderHub();save();},n.att<-10);
      else add('무역 중단 (호감 −10)','ghost',()=>{n.trade=false;n.ally=false;n.att-=10;renderHub();save();});
      if(!n.ally)add(`🤝 동맹 (호감 60 이상 + 무역)`,'',()=>{n.ally=true;n.rel='neutral';toast(`${NATIONS[k].name}과 동맹! 서로 침공하지 않고, 침공당하면 도와줍니다`);renderHub();save();},n.att<60||!n.trade);
      else add('동맹 파기 (호감 −30)','ghost',()=>{n.ally=false;n.att-=30;renderHub();save();});
    }
    if(n.rel==='war'){
      const cost=80+40*regs,chance=Math.max(.15,Math.min(.95,(myRegs().length>=regs?.75:.45)+n.att/200));
      add(`🕊 평화 협상 (💰${cost}, 성공률 ${Math.round(chance*100)}%)`,'',()=>{
        if(Math.random()<chance){prog.gold-=cost;n.rel='peace';n.peace=6;n.att=Math.min(100,n.att+15);toast(`${NATIONS[k].name}과 6개월 평화 조약 체결`);}
        else{prog.gold-=20;toast('협상이 거절됐습니다 (사절단 비용 💰20)');}
        renderHub();save();},prog.gold<cost);
    }else if(n.rel==='neutral'&&!n.ally){
      add('⚔ 선전포고','war',function(){if(!this._arm){this._arm=1;this.textContent='한 번 더 누르면 전쟁';setTimeout(()=>{this._arm=0;this.textContent='⚔ 선전포고';},2500);return;}
        declareWar(k);toast(`${NATIONS[k].name}에 선전포고!`);renderHub();save();});
    }
  }
}
function renderHub(){
  const W_=WEATHER[prog.weather];
  $('hgold').textContent=prog.gold;
  $('hdate').innerHTML=`📅 ${prog.month}개월째 · <b>${SEASONS[seasonIdx()]}</b> ${calMonth()}월 · ${W_.icon}${W_.name}`;
  $('hregs').textContent=`${myRegs().length}/${REG.length}`;
  $('hmor').innerHTML=`<span style="color:${prog.morale>=60?'#7fd06a':prog.morale>=30?'#f0c050':'#ff6a6a'}">${prog.morale}</span>`;
  $('hgoods').innerHTML=GK.map(g=>`<span title="${GOODS[g].name}">${GOODS[g].icon}<b>${prog.goods[g]||0}</b></span>`).join('');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===hubTab));
  const el=$('hubbody');el.innerHTML='';
  if(hubTab==='map')return renderMapTab(el);
  show('maphint',hubTab!=='city');
  if(hubTab==='city')return renderCity(el);
  if(hubTab==='diplo')return renderDiplo(el);
  if(hubTab==='econ')return renderEcon(el);
  if(hubTab==='king')return renderKing(el);
  const bar=document.createElement('div');bar.className='hubbar';el.appendChild(bar);
  const card=(h,acts,extra)=>{
    const c=document.createElement('div');c.className='hc'+(h.captured&&hubTab==='tavern'?' cap':'')+(h.injured>0?' inj':'');
    c.append(iconOf(h,h.captured&&hubTab==='tavern'?1:0));
    c.insertAdjacentHTML('beforeend',`<div>${heroInfoHTML(h)}${extra||''}</div>`);
    const a=document.createElement('div');a.className='acts';acts.forEach(x=>a.appendChild(x));c.appendChild(a);
    el.appendChild(c);
  };
  const btn=(txt,cls,fn,dis)=>{const b=document.createElement('button');b.innerHTML=txt;if(cls)b.className=cls;b.onclick=fn;b.disabled=!!dis;return b;};
  if(hubTab==='roster'){
    bar.innerHTML=`<span>내 장수단 — 출전·승리로 충성이 오르고, 출전 못 하거나 급여가 밀리면 떨어집니다. 부상 중에도 급여는 나갑니다.</span>`;
    if(!heroes.length)el.insertAdjacentHTML('beforeend','<div class="hubbar">아직 장수가 없습니다. 주점에서 고용하세요.</div>');
    heroes.forEach(h=>{
      const gift=50;
      if(h.king){card(h,[],`<div class="hs">👑 국왕 — 급여 없음 · 쓰러지면 민심 −10, 장수 충성 −5</div>`);return;}
      card(h,[
        btn(`🎁 포상 (💰${gift}, 충성 +${has(h,'탐욕')?18:12})`,'',()=>{if(prog.gold<gift)return toast('금이 부족합니다');prog.gold-=gift;h.loyalty=clampL(h.loyalty+(has(h,'탐욕')?18:12));renderHub();save();},prog.gold<gift||h.loyalty>=100),
        btn('해고','ghost danger',function(){if(!this._arm){this._arm=1;this.textContent='한 번 더 누르면 해고';setTimeout(()=>{this._arm=0;this.textContent='해고';},2500);return;}heroes=heroes.filter(x=>x!==h);toast(h.name+' 해고');renderHub();save();})
      ],loyHTML(h));
    });
  }else{
    const rr=30;
    bar.innerHTML=`<span>주점 — 매달 새 얼굴이 들어옵니다. 고용비를 내고, 이후 매달 월급을 줘야 합니다. 붉은 테두리는 전투에서 잡은 포로(반값, 충성 낮음).</span>`;
    bar.appendChild(btn(`🔄 새 얼굴 찾기 (💰${rr})`,'',()=>{if(prog.gold<rr)return toast('금이 부족합니다');prog.gold-=rr;refillTavern(true);tavern=tavern.filter(h=>h.captured);refillTavern(true);renderHub();save();},prog.gold<rr));
    tavern.forEach(h=>{
      const full=heroes.filter(x=>!x.king).length>=MAX_ROSTER,hc=hireCost(h);
      card(h,[btn(`고용 💰${hc} <small>(월급 ${h.wage})</small>`,'buy',()=>{
        if(full)return toast('장수단이 가득 찼습니다 (최대 6명)');
        if(prog.gold<hc)return toast('금이 부족합니다');
        prog.gold-=hc;tavern=tavern.filter(x=>x!==h);h.captured=false;h.sq=null;heroes.push(h);
        toast(`${h.name} 고용!`);renderHub();save();
      },full||prog.gold<hc)],`<div class="hs">${h.captured?'<span class="danger">⛓ 포로 출신</span> · ':''}충성 ${h.loyalty} · 고용비 💰${hc} · 월급 💰${h.wage}</div>`);
    });
  }
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='equip')return openEquip('bag');const was=hubTab;hubTab=b.dataset.tab;if((was==='city')!==(hubTab==='city'))mapCam();renderHub();});
$('next').onclick=()=>{if(pendingInv)return showInvasion();toHub(monthEnd());};
$('backhub').onclick=function(){
  const c=battleCtx;if(!c)return toHub();
  if(c.p1){battleCtx=null;return toP1();}
  if(c.mode==='attack'){battleCtx=null;return toHub();}
  if(!this._arm){this._arm=1;this.textContent='한 번 더 누르면 땅을 내줍니다';setTimeout(()=>{this._arm=0;this.textContent='🏳 싸우지 않고 땅을 내준다';},2500);return;}
  this._arm=0;surrender(REG[c.rid],c.enemy);
};
$('repok').onclick=()=>{show('report',false);if(pendingInv)showInvasion();};
$('tohub').onclick=()=>finishBattle();
// 한 달이 지날 때: 급여, 충성, 부상 회복, 이탈, 경쟁국 장수 성장, 주점 갱신
function monthEnd(){
  const log=[];
  // 1) 생산 (지나가는 달의 계절·날씨 기준)
  const fc=kingdomForecast();
  GK.forEach(g=>prog.goods[g]=(prog.goods[g]||0)+fc[g]);
  prog.gold+=fc.gold+fc.trade;
  log.push(`🌾 ${SEASONS[seasonIdx()]} 생산: 💰${fc.gold}${fc.trade?` + 무역 💰${fc.trade}`:''} · ${fmtGoods(fc)||'자원 없음'}`);
  prog.goods.grain-=fc.upkeep;
  if(prog.goods.grain<0){prog.goods.grain=0;prog.hungry=true;prog.morale-=8;log.push(`<span class="danger">🍞 군량 부족! 민심 −8, 다음 전투 아군 −10% (곡물을 사거나 농장을 지으세요)</span>`);}
  else{prog.hungry=false;log.push(`🍞 군량 소비 🌾−${fc.upkeep}`);}
  // 2) 민심
  let dm=Math.round(MOD('mor'))+TAX[prog.tax].mor+2*myRegs().reduce((a,r)=>a+((r.bld||[]).includes('temple')?1:0),0)+(isOrigin('rebel')?Math.round(2*proM()):0)-(isOrigin('noble')&&conM()>=.5?1:0);
  const wx=prog.weather;if(wx==='drought')dm-=2;if(wx==='bounty')dm+=2;if(wx==='frost')dm-=3;
  if(prog.morale<50)dm+=1;
  prog.morale=clampL(prog.morale+dm);
  if(prog.morale<25&&myRegs().length>1&&Math.random()<.3*(1-Math.min(.9,MOD('rebel')))){
    const cand=myRegs().filter(r=>!r.cap&&!(r.bld||[]).includes('fort'));
    if(cand.length){const r=pick(cand);r.owner=-1;log.push(`<span class="danger">🔥 민심이 바닥나 ${r.name}에서 반란! 무주지가 됐습니다</span>`);}
  }
  // 3) 약초로 부상 치료
  heroes.forEach(h=>{if(h.injured>1&&!h.newInj&&(prog.goods.herb||0)>=2){prog.goods.herb-=2;h.injured--;log.push(`🌿 약초로 ${h.name} 치료 (부상 −1개월)`);}});
  // 4) 사건
  monthEvent(log);
  prog.month++;
  const total=heroes.reduce((a,h)=>a+h.wage,0);
  if(prog.gold>=total){prog.gold-=total;if(total)log.push(`💰 급여 지출 −${total}`);}
  else{
    let g=prog.gold;const unpaid=[];
    heroes.slice().sort((a,b)=>a.loyalty-b.loyalty).forEach(h=>{if(g>=h.wage)g-=h.wage;else{unpaid.push(h);h.loyalty=clampL(h.loyalty-20);}});
    prog.gold=g;
    log.push(`<span class="danger">💸 금이 부족해 ${unpaid.map(h=>h.name).join(', ')}에게 급여를 못 줬습니다 (충성 −20)</span>`);
  }
  heroes.forEach(h=>{
    if(h.king){if(h.newInj)h.newInj=false;else if(h.injured>0){h.injured--;if(!h.injured)log.push(`✚ ${h.name} 부상 회복`);}h.fought=false;return;}
    let d=2*loyGain(h);
    if(isOrigin('merchant')&&Math.random()<conM())d-=1;
    if(kst('매력')>=70)d+=1;
    if(!h.fought&&h.injured<=0)d-=4;
    if(has(h,'변덕'))d+=rint(-8,8);
    d+=Math.round(MOD('loy'));
    h.loyalty=clampL(h.loyalty+d);
    if(h.newInj)h.newInj=false;
    else if(h.injured>0){h.injured--;if(h.injured>0&&Math.random()<MOD('heal'))h.injured--;if(!h.injured)log.push(`✚ ${h.name} 부상 회복`);}
    h.fought=false;
  });
  heroes.slice().forEach(h=>{
    if(h.king)return;
    if(h.loyalty<20&&Math.random()<.1+(20-h.loyalty)*.04){heroes=heroes.filter(x=>x!==h);log.push(`<span class="danger">🚪 ${h.name}이(가) 충성이 바닥나 떠났습니다</span>`);}
    else if(h.loyalty<30)log.push(`<span class="danger">⚠ ${h.name}의 충성이 낮습니다 (${h.loyalty})</span>`);
  });
  rivals.forEach(r=>r.forEach(h=>{levelUp(h,25);if(h.newInj)h.newInj=false;else if(h.injured>0)h.injured--;}));
  if(Math.random()<.35){const i=rint(0,rivals.length-1);if(rivals[i].length<3&&nations[i+1]&&nations[i+1].alive){rivals[i].push(genHero({type:pick(presetTypes(PRESETS[i])),lv:rint(1,3)+Math.floor(prog.month/3)}));log.push(`📯 ${PRESETS[i].name}에 새 장수가 합류했다는 소문`);}}
  // 외교: 평화 기간
  for(let k=1;k<NATIONS.length;k++){const n=nations[k];if(n.alive&&n.rel==='peace'&&--n.peace<=0){n.rel='neutral';log.push(`🕊 ${NATIONS[k].name}과의 평화 조약이 끝났습니다 (중립)`);}}
  diploDrift(log);
  // 전쟁 중인 나라만 우리 땅을 침공 (한 달에 최대 1번)
  pendingInv=null;
  const warring=[1,2,3,4,5].filter(k=>nations[k].alive&&nations[k].rel==='war').sort(()=>Math.random()-.5);
  for(const k of warring){
    if(Math.random()>.35)continue;
    const tg=myRegs().filter(r=>r.adj.some(i=>REG[i].owner===k));
    if(tg.length){pendingInv={rid:pick(tg).id,attacker:k};log.push(`<span class="danger">⚠ ${NATIONS[k].name}이(가) ${REG[pendingInv.rid].name}을(를) 침공해 왔습니다!</span>`);break;}
  }
  if(pendingInv){
    const al=[1,2,3,4,5].filter(k=>nations[k].alive&&nations[k].ally);
    if(al.length&&Math.random()<.5){const a=pick(al);log.push(`🛡 동맹 ${NATIONS[a].name}군이 ${NATIONS[pendingInv.attacker].name}의 침공을 막아냈습니다!`);nations[a].att=Math.min(100,nations[a].att+3);pendingInv=null;}
  }
  // 다른 나라들끼리의 다툼
  if(Math.random()<.25){
    const alive=[1,2,3,4,5].filter(x=>nations[x].alive);
    if(alive.length){const k=pick(alive),opts=[];
      regsOf(k).forEach(r=>r.adj.forEach(i=>{const o=REG[i].owner;if(o!==k&&o!==0){opts.push(i);if(o===nations[k].rival)opts.push(i,i);}}));
      if(opts.length&&Math.random()<.55){const t=REG[pick(opts)],old=t.owner;t.owner=k;t.cap=false;log.push(`📯 ${NATIONS[k].name}이(가) ${t.name}을(를) 차지했습니다`);checkElim(old,log);}}
  }
  if(!prog.won&&myRegs().length>=Math.ceil(REG.length*.6)){prog.won=true;log.unshift('👑 대륙의 60%를 차지했습니다! 세계 강국 달성 (계속 플레이할 수 있습니다)');}
  prog.weather=rollWeather();rollPrices();
  const W_=WEATHER[prog.weather];
  log.push(`📅 ${SEASONS[seasonIdx()]} ${calMonth()}월 — 날씨 ${W_.icon}${W_.name}: ${W_.txt}`);
  if(seasonIdx()===3&&calMonth()===12)log.push('❄ 겨울이 왔습니다. 석 달 동안 곡물이 거의 나지 않습니다.');
  buildMapArt();initMents();
  refillTavern(true);log.push('🍺 주점에 새 얼굴들이 들어왔습니다');
  save();
  return log;
}
function diploDrift(log){
  const big=myRegs().length>REG.length*.3;
  for(let k=1;k<NATIONS.length;k++){
    const n=nations[k];if(!n.alive)continue;
    const why=[];let d=0;
    const border=myRegs().some(r=>r.adj.some(i=>REG[i].owner===k));
    if(border&&!n.trade&&!n.ally){d-=1;why.push('국경 마찰 −1');}
    if(n.trade){d+=2;why.push('무역 +2');}
    if(n.ally){d+=1;why.push('동맹 +1');}
    const rv=nations[n.rival];
    if(rv&&rv.alive&&rv.rel==='war'){d+=3;why.push(`공동의 적 ${NATIONS[n.rival].name}과 전쟁 중 +3`);}
    if(rv&&rv.alive&&(rv.trade||rv.ally)){d-=1;why.push(`숙적 ${NATIONS[n.rival].name}과 친함 −1`);}
    if(big){d-=2;why.push('우리 팽창 경계 −2');}
    if(n.rel==='war'){d-=1;why.push('전쟁 중 −1');}
    if(n.trade&&(prog.goods[n.want]||0)>=20){
      prog.goods[n.want]-=10;const g=Math.round(sellPrice(n.want)*12);prog.gold+=g;d+=2;why.push(`원하던 ${GOODS[n.want].name} 공급 +2`);
      log.push(`🐪 ${NATIONS[k].name}에 ${GOODS[n.want].icon}${GOODS[n.want].name} 10 수출 → 💰${g}`);
    }
    const ma=Math.round(MOD('att'));if(ma){d+=ma;why.push(`왕도·건물의 위상 +${ma}`);}
    if(d>0)d=Math.round(d*chaMul());
    n.att=Math.max(-100,Math.min(100,n.att+d));n.why=why;
    if(n.rel!=='war'&&n.rel!=='peace'&&!n.ally&&n.att<=-60&&Math.random()<.4){
      n.rel='war';n.trade=false;log.push(`<span class="danger">⚔ ${NATIONS[k].name}이(가) 우리에게 선전포고했습니다! (호감 ${n.att})</span>`);
    }else if(n.rel!=='war'&&n.att<=-40)log.push(`<span class="danger">⚠ ${NATIONS[k].name}과의 관계가 험악합니다 (호감 ${n.att}) — 선물이나 무역으로 달래지 않으면 전쟁이 날 수 있습니다</span>`);
  }
}
function monthEvent(log){
  if(Math.random()>.4)return;
  const mine=myRegs(),ev=pick(['harvest','merchant','bandit','plague','festival','vein','caravan']);
  if(ev==='harvest'){prog.goods.grain+=30;log.push('🎉 사건: 농민들이 숨겨둔 곡식 창고를 찾아냈습니다 (🌾+30)');}
  else if(ev==='merchant'){tavern.unshift(genHero({rarity:rint(1,3),lv:rint(2,4)}));log.push('🎉 사건: 이름난 용병이 주점에 나타났습니다 (희귀 이상)');}
  else if(ev==='bandit'){const t=mine.filter(r=>!(r.bld||[]).includes('fort'));
    if(t.length){const r=pick(t),loss=Math.min(prog.gold,60);prog.gold-=loss;prog.goods.grain=Math.max(0,prog.goods.grain-15);log.push(`<span class="danger">⚠ 사건: 도적 떼가 ${r.name}을(를) 약탈했습니다 (💰−${loss}, 🌾−15). 성채가 있으면 막을 수 있습니다</span>`);}}
  else if(ev==='plague'){if((prog.goods.herb||0)>=5){prog.goods.herb-=5;log.push('🌿 사건: 역병이 돌았지만 약초로 막았습니다 (🌿−5)');}else{prog.morale=clampL(prog.morale-8);log.push('<span class="danger">⚠ 사건: 역병이 돌아 민심 −8 (약초 5개가 있었다면 막을 수 있었습니다)</span>');}}
  else if(ev==='festival'){if(prog.gold>=40){prog.gold-=40;prog.morale=clampL(prog.morale+8);log.push('🎉 사건: 수확 축제를 열었습니다 (💰−40, 민심 +8)');}}
  else if(ev==='vein'){const t=mine.filter(r=>!r.rare);if(t.length){const r=pick(t);r.rare=pick(['iron','mana','horse'].filter(g=>g!=='iron'||true))==='iron'?null:pick(['mana','horse']);if(r.rare)log.push(`💎 사건: ${r.name}에서 ${GOODS[r.rare].icon}${GOODS[r.rare].name} 산지가 발견됐습니다! (전용 건물을 지을 수 있음)`);else{prog.goods.iron+=20;log.push(`💎 사건: ${r.name}에서 철광맥 발견 (⛏+20)`);}}}
  else if(ev==='caravan'){const g=pick(GK);prog.goods[g]=(prog.goods[g]||0)+8;log.push(`🐪 사건: 떠돌이 상단이 ${GOODS[g].icon}${GOODS[g].name} 8개를 팔고 갔습니다`);}
}
function startBattle(){
  refreshDeploy();
  deploySnap=squads.map(q=>({id:q.id,type:q.type,n:q.n,cx:q.cx,cy:q.cy,num:q.num,label:q.label,xp:q.xp||0}));
  bt=0;endT=0;kills=0;paused=false;speed=1;drag=null;hover=null;cv.style.cursor='';
  start0=units.filter(u=>u.team===0).length;start1=units.filter(u=>u.team===1).length;
  state='battle';chipKey='';
  show('deploy',false);show('dhint',false);show('top',true);show('cmds',true);show('hint',true);
  $('pause').firstChild.textContent='멈춤';$('spd').firstChild.textContent='1x';
  squads.forEach(q=>{q.sel=false;q.focus=null;});
  setMode('hold',squads);
  heroUnits=units.filter(u=>u.hero);evs=[];pending=null;autoT=0;bw=prog.weather;
  heroUnits.forEach(u=>{u.hero.cdLeft=heroCd(u.hero)*.3;u.hero.downed=false;});
  renderSkills();updateHud();clampCam();save();
}
const myHeroUnits=()=>heroUnits.filter(u=>u.team===0);
function renderSkills(){
  const el=$('skills');el.innerHTML='';
  const mine=myHeroUnits();if(!mine.length)return;
  const a=document.createElement('button');a.id='autosk';a.innerHTML='스킬 자동<small></small>';
  a.onclick=()=>{autoSkill=!autoSkill;pending=null;updSkills();save();};el.appendChild(a);
  mine.forEach(u=>{const b=document.createElement('button');b._u=u;b.innerHTML=`${u.hero.name} · ${SKILLS[u.hero.skill].name}<small></small>`;b.onclick=()=>useSkill(u);el.appendChild(b);});
  updSkills();
}
function updSkills(){
  const a=$('autosk');if(a){a.querySelector('small').textContent=(autoSkill?'켜짐':'꺼짐')+' (T)';a.classList.toggle('pend',autoSkill);}
  let i=0;
  $('skills').querySelectorAll('button').forEach(b=>{
    const u=b._u;if(!u)return;const h=u.hero,key='ZXCV'[i++]||'';
    b.querySelector('small').textContent=u.dead?'부상':h.cdLeft>0?`${Math.ceil(h.cdLeft)}초`:autoSkill?`자동 대기 (${key})`:`준비 (${key})`;
    b.disabled=u.dead;b.classList.toggle('ready',!u.dead&&h.cdLeft<=0);b.classList.toggle('pend',pending===u);
  });
}
function useSkill(u){
  if(state!=='battle')return;
  const h=u.hero,sk=SKILLS[h.skill];
  if(u.dead){toast(h.name+'은(는) 쓰러졌습니다');return;}
  if(h.cdLeft>0){toast(`${sk.name} 재사용까지 ${Math.ceil(h.cdLeft)}초`);return;}
  if(sk.target){pending=pending===u?null:u;if(pending)toast(`지도를 탭해서 ${sk.name} 위치 지정 (Esc 취소)`);updSkills();return;}
  castSkill(u,null);
}
function castSkill(u,p){
  const h=u.hero,sk=SKILLS[h.skill],pw=heroPow(h),foe=1-u.team;
  h.cdLeft=heroCd(h);if(pending===u)pending=null;
  const mates=units.filter(x=>x.team===u.team&&!x.dead&&x.g===u.g);
  const say=c=>addText(u.x,u.y-60,`${h.name}: ${sk.name}!`,c,14);
  const inArea=(e,R)=>Math.hypot(e.x-p.x,(e.y-p.y)/.7)<R;
  if(h.skill==='rally'){
    mates.forEach(x=>x.rally=bt+6);
    if(u.team===0){const q=SQ[u.g];if(q)setMode('charge',[q]);}else mates.forEach(x=>x.mode='charge');
    say('#ffd34d');
  }else if(h.skill==='warcry'){
    units.forEach(x=>{if(x.team===u.team&&!x.dead&&dist(x,u)<150)x.fury=bt+6;});say('#ff9a5a');
  }else if(h.skill==='wall'){
    mates.forEach(x=>x.wall=bt+7);say('#8fc3ff');
  }else if(h.skill==='heal'){
    mates.forEach(x=>{x.hp=Math.min(x.max,x.hp+x.max*.3*pw);if(Math.random()<.5)fxAnim('Spark',x.x,x.y,1.2,.6);for(let i=0;i<3;i++)parts.push({x:x.x+(Math.random()-.5)*10,y:x.y-10,vx:0,vy:-25,t:0,life:.7,col:'#7dff9a',s:2,g:0});});say('#7dff9a');
  }else if(h.skill==='snipe'){
    let best=null,bs=-1e9;
    units.forEach(e=>{if(e.dead||e.team!==foe)return;const d=dist(e,u);if(d>440)return;const sc=(e.hero?1000:0)+e.max-d*.2;if(sc>bs){bs=sc;best=e;}});
    if(!best){h.cdLeft=2;return;}
    projs.push({k:'arrow',sx:u.x,sy:u.y-18,x:u.x,y:u.y-18,tgt:best,tx:best.x,ty:best.y-10,t:0,T:Math.max(.2,dist(u,best)/650),src:u,a:0,st:G_GRASS,dmg:45*pw,raw:true,big:true});
    say('#ffd34d');
  }else if(h.skill==='rain'){
    say('#ffd34d');
    for(let k=0;k<3;k++)evs.push({t:bt+.35+k*.45,fn:()=>{
      for(let i=0;i<14;i++){const a=Math.random()*6.28,r=Math.sqrt(Math.random())*sk.R;parts.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r*.6-40,vx:0,vy:260,t:0,life:.16,col:'#3a2a18',s:2,g:0,arrow:true});}
      units.forEach(e=>{if(!e.dead&&e.team===foe&&inArea(e,sk.R))hit(u,e,11*pw,null,'arrow',G_GRASS,true);});
    }});
  }else if(h.skill==='storm'){
    say('#ffb02e');
    for(let k=0;k<3;k++){const a=Math.random()*6.28,r=Math.random()*sk.R*.5,ex=p.x+Math.cos(a)*r,ey=p.y+Math.sin(a)*r*.6;
      evs.push({t:bt+.5+k*.4,fn:()=>explode(ex,ey,55,26*pw,u,true)});}
  }else if(h.skill==='royal'){
    units.forEach(x=>{if(x.team===u.team&&!x.dead&&dist(x,u)<220){x.fury=bt+8;x.guard=bt+8;}});say('#ffe08a');
  }else if(h.skill==='frost'){
    say('#9fe0ff');
    evs.push({t:bt+.3,fn:()=>{
      units.forEach(e=>{if(!e.dead&&e.team===foe&&inArea(e,sk.R)){e.slow=bt+5;hit(u,e,10*pw,null,'arrow',G_GRASS,true);}});
      for(let i=0;i<30;i++){const a=Math.random()*6.28,r=Math.random()*sk.R;parts.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r*.6,vx:0,vy:-12,t:0,life:.8,col:Math.random()<.5?'#dff4ff':'#8fd0ff',s:2,g:0});}
      parts.push({ring:true,x:p.x,y:p.y,t:0,life:.45,r:sk.R,rc:'160,225,255'});fxAnim('Ice',p.x,p.y+8,3.2,.6);
    }});
  }
  updSkills();
}
// 스킬 자동 사용 (적 장수는 항상, 아군은 자동 켜짐일 때)
function aiSkill(u){
  const h=u.hero,sk=SKILLS[h.skill],foe=1-u.team;
  if(u.dead||h.cdLeft>0)return;
  const foes=units.filter(e=>!e.dead&&e.team===foe);if(!foes.length)return;
  const near=r=>foes.some(e=>dist(e,u)<r);
  const mates=units.filter(x=>x.team===u.team&&!x.dead&&x.g===u.g);
  if(h.skill==='rally'||h.skill==='warcry'||h.skill==='royal'){if(near(170))castSkill(u,null);}
  else if(h.skill==='wall'){if(mates.some(m=>foes.some(e=>dist(e,m)<60)))castSkill(u,null);}
  else if(h.skill==='heal'){const miss=mates.reduce((a,m)=>a+(m.max-m.hp),0),tot=mates.reduce((a,m)=>a+m.max,0);if(miss>tot*.3)castSkill(u,null);}
  else if(h.skill==='snipe'){if(near(420))castSkill(u,null);}
  else{
    let best=null,bc=0;
    for(const e of foes){if(dist(e,u)>460)continue;let c=0;for(const f of foes)if(Math.hypot(f.x-e.x,(f.y-e.y)/.7)<sk.R*.8)c++;if(c>bc){bc=c;best=e;}}
    if(best&&bc>=(h.skill==='storm'?4:3))castSkill(u,{x:best.x,y:best.y});
  }
}
$('start').onclick=startBattle;
$('reroll').onclick=()=>toDeploy(true);
$('regen').onclick=()=>{genTerrain();refreshDeploy();};
$('resetpos').onclick=()=>{syncCounts();resetSquads();refreshDeploy();};
$('toslot').onclick=()=>showTitle();
let wipeArm=0;
$('wipe').onclick=()=>{
  if(!wipeArm){wipeArm=setTimeout(()=>{wipeArm=0;$('wipe').textContent='새 게임';},3000);$('wipe').textContent='한 번 더 누르면 처음부터';return;}
  clearTimeout(wipeArm);wipeArm=0;
  try{localStorage.removeItem(slotKey());}catch(_){}
  newGame();$('wipe').textContent='새 게임';toP1();
};
$('splitD').onclick=splitSel;$('mergeD').onclick=mergeSel;
$('splitB').onclick=()=>{if(state==='battle')splitSel();};
$('mergeB').onclick=()=>{if(state==='battle')mergeSel();};
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{loc=b.dataset.loc;genTerrain();refreshDeploy();});
$('zin').onclick=()=>zoomAt(innerWidth/2,innerHeight/2,1.25);
$('zout').onclick=()=>zoomAt(innerWidth/2,innerHeight/2,1/1.25);
$('zfit').onclick=()=>{cam.z=inTown()?zMin():fitZ;focusCam(W/2,H/2);};

/* ---------- 명령 ---------- */
// 선택한 부대에만 명령 (선택이 없으면 전체)
function setMode(m,targets){
  targets=targets||selTargets();
  targets.forEach(s=>{
    s.mode=m;
    if(m!=='charge')s.focus=null;
    members(s,true).forEach(u=>{u.mode=m;if(m==='hold')u.anchor={x:u.x,y:u.y};});
  });
  renderChips();
}
document.querySelectorAll('#cmds [data-m]').forEach(b=>b.onclick=()=>{if(state==='battle')setMode(b.dataset.m);});
function togglePause(){if(state!=='battle')return;paused=!paused;$('pause').firstChild.textContent=paused?'재개':'멈춤';}
function toggleSpeed(){if(state!=='battle')return;speed=speed===1?2:1;$('spd').firstChild.textContent=speed+'x';}
$('pause').onclick=togglePause;$('spd').onclick=toggleSpeed;
const keys=new Set();
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}
  if(k==='='||k==='+')zoomAt(innerWidth/2,innerHeight/2,1.2);
  if(k==='-')zoomAt(innerWidth/2,innerHeight/2,1/1.2);
  if(inTown()&&(k==='e'||k==='enter')&&town&&town.near&&!town.open&&!uiBusy()){openTarget(town.near);return;}
  if(inTown()&&k==='escape'&&npcUI){closeNpc();return;}
  if(inTown()&&k==='escape'&&town&&town.open){closeB();return;}
  if(k==='escape'){if(pending){pending=null;updSkills();}else{squads.forEach(s=>s.sel=false);renderChips();}}
  if(state==='battle'){const i='zxcv'.indexOf(k),mine=myHeroUnits();if(i>=0&&mine[i])useSkill(mine[i]);if(k==='t'){autoSkill=!autoSkill;pending=null;updSkills();toast('스킬 자동 사용 '+(autoSkill?'켜짐':'꺼짐'));}}
  if(state==='deploy'||state==='battle'){if(k==='q')splitSel();if(k==='e')mergeSel();}
  if(state!=='battle')return;
  if(e.key==='1')setMode('charge');
  else if(e.key==='2')setMode('hold');
  else if(e.key==='3')setMode('retreat');
  else if(e.code==='Space'){e.preventDefault();togglePause();}
  else if(k==='f')toggleSpeed();
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());

/* ---------- 입력: 배치 드래그 / 화면 이동 / 확대 ---------- */
const worldOf=(sx,sy)=>({x:cam.x+sx/cam.z,y:cam.y+sy/cam.z});
function ownUnitAt(p,r){let best=null,bd=r;units.forEach(u=>{if(u.team!==0||u.dead)return;const d=Math.hypot(u.x-p.x,u.y-10-p.y);if(d<bd){bd=d;best=u;}});return best;}
function selectSquadOf(u,additive){
  const s=SQ[u.g];if(!s)return;
  if(additive)s.sel=!s.sel;else{squads.forEach(q=>q.sel=false);s.sel=true;}
  renderChips();
}
function battleTap(p,additive){
  if(pending){if(!pending.dead)castSkill(pending,p);pending=null;updSkills();return;}
  const own=ownUnitAt(p,Math.max(26,28/cam.z));
  if(own){selectSquadOf(own,additive);return;}
  let best=null,bd=Math.max(36,30/cam.z);
  units.forEach(u=>{if(u.dead||u.team!==1)return;const d=Math.hypot(u.x-p.x,(u.y-12)-p.y);if(d<bd){bd=d;best=u;}});
  if(best){
    const tg=selTargets();
    tg.forEach(s=>s.focus=best);
    setMode('charge',tg);
    addText(best.x,best.y-42,tg.length===squads.length?'전군 집중!':tg.map(s=>s.label).join('·')+' 집중!','#ff9a9a',12);
  }
}
const ptrs=new Map();let gesture=null;
cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){
    const [a,b]=[...ptrs.values()];
    if(drag){drag.set.forEach(o=>{o.q.cx=o.cx;o.q.cy=o.cy;});drag=null;layout();}
    gesture={type:'pinch',d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:cam.z};
    return;
  }
  if(ptrs.size>2)return;
  const p=worldOf(e.clientX,e.clientY);hover=p;
  if(state==='deploy'){
    const u=ownUnitAt(p,Math.max(26,28/cam.z));
    if(u){
      const s=SQ[u.g];
      if(e.shiftKey){s.sel=!s.sel;}
      else if(!s.sel){squads.forEach(q=>q.sel=false);s.sel=true;}
      renderChips();
      const set=squads.filter(q=>q.sel);
      drag={sx:p.x,sy:p.y,set:set.map(q=>({q,cx:q.cx,cy:q.cy}))};
      gesture={type:'drag'};cv.style.cursor='grabbing';
      return;
    }
  }
  gesture={type:'pan',sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y,moved:0};
});
cv.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=worldOf(e.clientX,e.clientY);hover=p;
  if(!gesture){if(state==='deploy')cv.style.cursor=ownUnitAt(p,Math.max(26,28/cam.z))?'grab':'';return;}
  if(gesture.type==='pinch'){
    if(ptrs.size<2)return;
    const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1;
    const target=gesture.z*d/gesture.d;
    zoomAt((a.x+b.x)/2,(a.y+b.y)/2,target/cam.z);
    hover=null;
  }else if(gesture.type==='drag'&&drag){
    drag.set.forEach(o=>{o.q.cx=o.cx+p.x-drag.sx;o.q.cy=o.cy+p.y-drag.sy;});
    layout();
  }else if(gesture.type==='pan'){
    const dx=e.clientX-gesture.sx,dy=e.clientY-gesture.sy;
    gesture.moved=Math.max(gesture.moved,Math.hypot(dx,dy));
    if(gesture.moved>6){
      cam.x=gesture.cx-dx/cam.z;cam.y=gesture.cy-dy/cam.z;clampCam();if(inTown()&&town)town.camFree=performance.now()+3500;
      cv.style.cursor='grabbing';hover=null;
    }
  }
});
function endPtr(e){
  ptrs.delete(e.pointerId);
  if(!gesture)return;
  if(gesture.type==='pan'&&gesture.moved<=6){
    if(state==='battle')battleTap(worldOf(e.clientX,e.clientY),e.shiftKey);
    else if(state==='deploy'&&!e.shiftKey){squads.forEach(s=>s.sel=false);renderChips();}
    else if(inTown())tapTown(worldOf(e.clientX,e.clientY));
    else if(state==='hub'&&hubTab!=='city'){selReg=regionAt(worldOf(e.clientX,e.clientY));hubTab='map';renderHub();}
  }
  if(gesture.type==='drag'){drag=null;layout();}
  if(gesture.type!=='pinch'||ptrs.size===0)gesture=null;
  else if(ptrs.size<2)gesture=null;
  cv.style.cursor='';
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',()=>{if(!gesture)hover=null;});
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,e.deltaY<0?1.12:1/1.12);},{passive:false});

/* ---------- 전투 로직 ---------- */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function nearestFoe(u,alive){
  let best=null,bd=1e9;
  for(const e of alive){if(e.team===u.team||e.dead)continue;const d=dist(u,e);if(d<bd){bd=d;best=e;}}
  return best;
}
// 언덕 규칙: 절벽은 못 넘고 계단(STAIR)으로만 오르내린다
const blkOf=(x,y)=>{const bx=Math.floor(x/32),by=Math.floor(y/32);return(bx<0||by<0||bx>=HBW||by>=HBH)?-1:by*HBW+bx;};
const lvlB=b=>b>=0&&HB&&HB[b]===1?1:0;
const faceB=b=>b>=HBW&&HB&&HB[b]!==1&&HB[b-HBW]===1&&!STAIR[b-HBW];
function canPass(a,b){if(a===b||!HB||!STAIR)return true;if(faceB(b))return false;if(faceB(a))return lvlB(b)===0;const la=lvlB(a),lb=lvlB(b);if(la===lb)return true;if(a<0||b<0)return false;const hi=la?a:b,lo=la?b:a;return STAIR[hi]>0&&lo===hi+HBW;}
function lineOK(x0,y0,x1,y1){const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/8);let pb=blkOf(x0,y0);for(let i=1;i<=n;i++){const t=i/n,b=blkOf(x0+(x1-x0)*t,y0+(y1-y0)*t);if(b!==pb){if(!canPass(pb,b))return false;pb=b;}}return true;}
const nbrB=b=>{const x=b%HBW,y=(b/HBW)|0,o=[];if(x>0)o.push(b-1);if(x<HBW-1)o.push(b+1);if(y>0)o.push(b-HBW);if(y<HBH-1)o.push(b+HBW);return o;};
function flowTo(t){let F=FLOW.get(t);if(F)return F;F=new Int16Array(HBW*HBH).fill(-1);F[t]=0;const q=[t];for(let h=0;h<q.length;h++){const c=q[h];for(const n of nbrB(c))if(F[n]<0&&canPass(n,c)){F[n]=F[c]+1;q.push(n);}}FLOW.set(t,F);return F;}
function hillRoute(u,x,y){
  if(!HB||!STAIR)return[x,y];const ub=blkOf(u.x,u.y),tb=blkOf(x,y);if(ub<0||tb<0||ub===tb||lineOK(u.x,u.y,x,y))return[x,y];
  const F=flowTo(tb);if(F[ub]<0)return[x,y];let cur=ub,best=null,first=null;
  for(let k=0;k<8;k++){let nb=-1;for(const n of nbrB(cur))if(F[n]>=0&&F[n]<F[cur]&&canPass(cur,n)){nb=n;break;}if(nb<0)break;cur=nb;const cx=(cur%HBW+.5)*32,cy=(((cur/HBW)|0)+.5)*32;if(!first)first=[cx,cy];if(lineOK(u.x,u.y,cx,cy))best=[cx,cy];else break;}
  return best||first||[x,y];}
const rSide=(x,y)=>x<RVR.cx+RVR.A*Math.sin(y*RVR.f+RVR.ph)?-1:1;
// 강을 건너야 하면 가까운 다리로 돌아간다
function riverRoute(u,x,y){
  if(!RVR||!BRG.length)return[x,y];const t0=tOf(u);if(t0===G_RIVER)return[x,y];
  if(t0===G_BRIDGE){const b=BRG.find(q=>u.x>=q.x0-6&&u.x<=q.x1+6&&u.y>=q.y0-8&&u.y<=q.y1+8);if(!b)return[x,y];const s1=rSide(x,y);return[s1>0?b.x1+10:b.x0-10,b.y];}
  const s0=rSide(u.x,u.y);if(s0===rSide(x,y))return[x,y];
  let b=null,bd=1e9;for(const q of BRG){const d=Math.abs(q.y-u.y)+Math.abs(q.y-y);if(d<bd){bd=d;b=q;}}
  const ex=s0<0?b.x0-8:b.x1+8;return Math.hypot(ex-u.x,b.y-u.y)>8?[ex,b.y]:[s0<0?b.x1+10:b.x0-10,b.y];
}
function moveTo(u,x,y,dt,mult){
  [x,y]=hillRoute(u,x,y);[x,y]=riverRoute(u,x,y);
  const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);
  if(d<1)return;
  const t=tOf(u),rough=t===G_FOREST||t===G_SWAMP||t===G_RIVER;
  const tm=SPEEDM[t]*(u.type==='cav'&&rough?.8:1)*(u.rally>bt?1.5:1)*(u.wall>bt?.5:1)*(u.slow>bt?.5:1)
    *(1+auraVal(u.team,u.x,u.y,'speed'))*(u.hero&&has(u.hero,'기마술')?1.15:1)*(u.eqSpd||1)*(bw==='snow'?.85:bw==='frost'?.8:1);
  const st=Math.min(d,TYPES[u.type].speed*(mult||1)*tm*dt);
  let nx=u.x+dx/d*st,ny=u.y+dy/d*st;
  if(t!==G_RIVER&&terrAt(nx,ny)===G_RIVER){if(terrAt(nx,u.y)!==G_RIVER)ny=u.y;else if(terrAt(u.x,ny)!==G_RIVER)nx=u.x;else{u.moving=false;return;}}
  if(HB&&STAIR){const b0=blkOf(u.x,u.y);if(!canPass(b0,blkOf(nx,ny))){if(canPass(b0,blkOf(nx,u.y)))ny=u.y;else if(canPass(b0,blkOf(u.x,ny)))nx=u.x;else{u.moving=false;return;}}}
  u.x=nx;u.y=ny;if(terrAt(nx,ny)!==G_RIVER){u.sx0=nx;u.sy0=ny;}
  if(Math.abs(dx)>.5)u.face=dx>0?1:-1;
  u.moving=true;
  if(t===G_RIVER&&Math.random()<.15)parts.push({x:u.x+(Math.random()-.5)*10,y:u.y,vx:0,vy:-14,t:0,life:.35,col:'#bfe0ff',s:2,g:0});
  if(u.type==='cav'){if(rough)u.charge=0;else u.charge+=st;
    if(Math.random()<.25)parts.push({x:u.x-u.face*12,y:u.y,vx:-u.face*20,vy:-10,t:0,life:.45,col:'rgba(190,165,120,.8)',s:3,g:0});}
}
function addText(x,y,txt,col,size){texts.push({x,y,txt,col,size,t:0});}
function spark(x,y,col){parts.push({x,y,vx:(Math.random()-.5)*90,vy:-Math.random()*70,t:0,life:.3,col:col||'#fff6c8',s:2,g:200});}
function terrMul(kind,st,vt){
  let m=1;
  if(kind==='arrow'&&vt===G_FOREST)m*=.6;
  if(kind==='fire'&&vt===G_FOREST)m*=1.2;
  if(kind!=='melee'&&st===G_HILL)m*=1.15;
  if(kind==='melee'){if(vt===G_HILL&&st!==G_HILL)m*=.85;if(st===G_HILL&&vt!==G_HILL)m*=1.15;}
  if(vt===G_RIVER)m*=1.25;
  if(vt===G_SWAMP)m*=1.1;
  return m;
}
// 같은 편 장수 오라 중 가장 센 값 (0~0.3)
function auraVal(team,x,y,kind){
  let v=0;
  for(const h of heroUnits){if(h.dead||h.team!==team||h.hero.aura!==kind)continue;const dx=h.x-x,dy=h.y-y;if(dx*dx+dy*dy<h.auraR*h.auraR&&h.auraP>v)v=h.auraP;}
  return v;
}
function hit(src,v,base,label,kind,st,raw){
  if(v.dead)return;
  kind=kind||'melee';
  const b=(BONUS[src.type]||{})[v.type]||1;
  const tm=terrMul(kind,st===undefined?tOf(src):st,tOf(v)),all=b*tm;
  let m=raw?1:(src.atkMul||1);
  if(!raw)m*=1+auraVal(src.team,src.x,src.y,'atk');
  if(kind==='melee'&&src.rally>bt)m*=1.4;
  if(src.fury>bt)m*=1.25;
  if(v.wall>bt)m*=.45;
  if(v.guard>bt)m*=.85;
  if(bw==='rain'&&(kind==='arrow'||kind==='fire'))m*=.8;
  if(src.team===0){
    if(isOrigin('soldier')&&heroUnits.some(h=>h.hero.king&&!h.dead))m*=1+.1*proM();
    if(isOrigin('rebel')&&battleCtx&&battleCtx.mode==='defend')m*=1+.1*proM();
    if(isOrigin('mage')&&src.type==='mage'&&!src.hero)m*=1+.2*proM();
    if(prog.phase===1&&prog.p1&&src.type==='mage'&&hasPerk(prog.p1,'화염의 손'))m*=1.25;
  }
  m*=1-auraVal(v.team,v.x,v.y,'def');
  if(v.hero&&has(v.hero,'철벽'))m*=.85;
  const dmg=Math.max(1,Math.round(base*m*all*(.88+Math.random()*.24)));
  v.hp-=dmg;v.flash=.13;
  v.x+=(v.x>=src.x?1:-1)*(src.type==='cav'?4:1.5);
  if(label)addText(v.x,v.y-34,label,'#ffffff',12);
  const col=b>1?'#ffd34d':tm>1.05?'#ffb36b':all<.95?'#a9b0cc':'#ffffff';
  addText(v.x+(Math.random()*8-4),v.y-26,b>1?dmg+'!':String(dmg),col,b>1||tm>1.05?13:10);
  if(v.hp<=0){
    v.hp=0;v.dead=true;v.deathT=0;
    if(src.team===0)kills++;
    src.kills=(src.kills||0)+1;
    if(v.hero){v.hero.downed=true;addText(v.x,v.y-48,v.hero.name+(v.team===0?' 부상!':' 격파!'),v.team===0?'#ff7a7a':'#ffd34d',15);if(pending===v)pending=null;shake=Math.max(shake,.15);}
    squads.forEach(s=>{if(s.focus===v)s.focus=null;});
    for(let i=0;i<8;i++)parts.push({x:v.x,y:v.y-8,vx:(Math.random()-.5)*60,vy:-Math.random()*50,t:0,life:.5,col:'#c9b48a',s:2,g:120});
  }
}
function attack(u,t,d){
  const T=TYPES[u.type];
  u.cd=T.cd*(.9+Math.random()*.2)*(u.type==='mage'?1-auraVal(u.team,u.x,u.y,'cast'):1);u.lunge=.16;
  sfx(u.type==='archer'?'bow':u.type==='mage'?'fire':Math.random()<.5?'slash':'hit',u.type==='mage'?.3:.16,u.type==='mage'?150:90);
  if(u.type==='archer'){
    projs.push({k:'arrow',sx:u.x+u.face*8,sy:u.y-14,x:u.x,y:u.y-14,tgt:t,tx:t.x,ty:t.y-10,t:0,T:Math.max(.15,d/400),src:u,a:0,st:tOf(u)});
  }else if(u.type==='mage'){
    projs.push({k:'fire',sx:u.x+u.face*10,sy:u.y-22,x:u.x,y:u.y-22,tx:t.x,ty:t.y-6,t:0,T:Math.max(.25,d/230),src:u,st:tOf(u)});
    for(let i=0;i<5;i++)spark(u.x+u.face*10,u.y-22,'#ffd34d');
  }else{
    let m=1,label=null;
    if(u.type==='cav'&&u.charge>70){m=1.7;label='돌격!';}
    u.charge=0;
    hit(u,t,T.atk*m,label,'melee');
    for(let i=0;i<4;i++)spark(t.x,t.y-12);
  }
}
function rangeOf(u){const r=TYPES[u.type].range;if(r<=40)return r;return r*(tOf(u)===G_HILL?1.25:1)*(1+auraVal(u.team,u.x,u.y,'range'))*(u.hero&&has(u.hero,'명사수')?1.15:1)*(u.eqRng||1)*(bw==='storm'?.75:1);}
function updUnit(u,dt,alive){
  if(u.dead){u.deathT+=dt;return;}
  const T=TYPES[u.type];
  u.cd-=dt;u.flash=Math.max(0,u.flash-dt);u.lunge=Math.max(0,u.lunge-dt);u.moving=false;u.rt-=dt;
  if(u.mode==='retreat'){
    moveTo(u,u.home.x,u.home.y,dt,1.05);
    if(dist(u,u.home)<5){u.mode='hold';u.anchor={x:u.home.x,y:u.home.y};u.face=u.team===0?1:-1;}
    return;
  }
  if(u.tgt&&u.tgt.dead)u.tgt=null;
  let want=null;
  if(u.team===0&&u.mode==='charge'){const s=SQ[u.g];if(s&&s.focus&&!s.focus.dead)want=s.focus;}
  if(!want){
    if(!u.tgt||u.rt<=0){u.tgt=nearestFoe(u,alive);u.rt=.4+Math.random()*.3;}
    want=u.tgt;
  }
  if(!want){if(u.mode==='hold'&&dist(u,u.anchor)>3)moveTo(u,u.anchor.x,u.anchor.y,dt);return;}
  const d=dist(u,want),RG=rangeOf(u);
  if(u.mode==='hold'){
    const leash=T.range>40?RG:T.range+45;
    if(dist(want,u.anchor)>leash&&d>RG){
      if(dist(u,u.anchor)>3)moveTo(u,u.anchor.x,u.anchor.y,dt);
      else u.face=want.x>=u.x?1:-1;
      return;
    }
  }
  if(d>RG)moveTo(u,want.x,want.y,dt);
  else{u.face=want.x>=u.x?1:-1;if(u.cd<=0)attack(u,want,d);}
}
function separate(alive){
  for(let i=0;i<alive.length;i++){
    const a=alive[i];
    for(let j=i+1;j<alive.length;j++){
      const b=alive[j];let dx=b.x-a.x,dy=b.y-a.y;const m=a.r+b.r;
      if(Math.abs(dx)>m||Math.abs(dy)>m)continue;
      let d2=dx*dx+dy*dy;
      if(d2<.0001){dx=Math.random()-.5;dy=Math.random()-.5;d2=dx*dx+dy*dy;}
      if(d2<m*m){const d=Math.sqrt(d2),p=(m-d)/2*.6,nx=dx/d,ny=dy/d;a.x-=nx*p;a.y-=ny*p;b.x+=nx*p;b.y+=ny*p;}
    }
  }
  for(const u of alive){u.x=Math.max(16,Math.min(W-16,u.x));u.y=Math.max(YMIN,Math.min(YMAX,u.y));}
}
function updProjs(dt){
  for(const p of projs){
    p.t+=dt;const q=Math.min(1,p.t/p.T);
    if(p.k==='arrow'&&!p.tgt.dead){p.tx=p.tgt.x;p.ty=p.tgt.y-10;}
    const hgt=Math.hypot(p.tx-p.sx,p.ty-p.sy)*(p.k==='arrow'?.18:.1);
    const nx=p.sx+(p.tx-p.sx)*q,ny=p.sy+(p.ty-p.sy)*q-Math.sin(Math.PI*q)*hgt;
    p.a=Math.atan2(ny-p.y,nx-p.x);p.x=nx;p.y=ny;
    if(p.k==='fire'&&Math.random()<.8)parts.push({x:p.x,y:p.y,vx:(Math.random()-.5)*20,vy:-10,t:0,life:.3,col:Math.random()<.5?'#ffb02e':'#ff5a1e',s:3,g:0});
    if(q>=1){
      p.done=true;
      if(p.k==='arrow'){if(!p.tgt.dead)hit(p.src,p.tgt,p.dmg||TYPES.archer.atk,p.big?'저격!':null,'arrow',p.st,p.raw);}
      else{
        explode(p.tx,p.ty,TYPES.mage.aoe,TYPES.mage.atk,p.src,false,p.st);
      }
    }
  }
  projs=projs.filter(p=>!p.done);
}
function explode(x,y,R,dmg,src,raw,st){
  units.forEach(f=>{if(f.dead||f.team===src.team)return;const d=Math.hypot(f.x-x,f.y-6-y);if(d<R)hit(src,f,dmg*(1-.4*d/R),null,'fire',st===undefined?G_GRASS:st,raw);});
  const n=Math.round(R*.7);
  for(let i=0;i<n;i++){const a=Math.random()*6.28,s=40+Math.random()*R*2.4;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.6-20,t:0,life:.5,col:['#fff3a0','#ffb02e','#ff5a1e','#a8321a'][i%4],s:3,g:60});}
  parts.push({ring:true,x,y:y+6,t:0,life:.35,r:R});fxAnim(raw&&R>45?'RockSpike':'Explosion',x,y+10,R/19,R>45?.7:.45);
  shake=Math.max(shake,R>45?.25:.18);
}
function fx(dt){
  for(const p of parts){p.t+=dt;if(!p.ring){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||0)*dt;}}
  parts=parts.filter(p=>p.t<p.life);
  for(const t of texts){t.t+=dt;t.y-=22*dt;}
  texts=texts.filter(t=>t.t<.9);
  for(const a of sfxA)a.t+=dt;sfxA=sfxA.filter(a=>a.t<a.dur);
}
function step(dt){
  bt+=dt;
  if(evs.length){const due=evs.filter(e=>e.t<=bt);evs=evs.filter(e=>e.t>bt);due.forEach(e=>e.fn());}
  if(state==='battle'){
    heroUnits.forEach(u=>{const h=u.hero;if(h.cdLeft>0)h.cdLeft=Math.max(0,h.cdLeft-dt);});
    autoT+=dt;if(autoT>.4){autoT=0;heroUnits.forEach(u=>{if(u.team===1||autoSkill)aiSkill(u);});}
  }
  for(const u of units){if(u.dead)continue;
    if(u.rally>bt&&Math.random()<.12)parts.push({x:u.x+(Math.random()-.5)*12,y:u.y-10,vx:0,vy:-30,t:0,life:.4,col:'#ffd34d',s:2,g:0});
    if(u.fury>bt&&Math.random()<.08)parts.push({x:u.x+(Math.random()-.5)*12,y:u.y-14,vx:0,vy:-24,t:0,life:.4,col:'#ff7a4a',s:2,g:0});}
  const alive=units.filter(u=>!u.dead);
  if(state==='battle'){
    const foes=alive.filter(u=>u.team===1);
    if(foes.some(e=>e.mode==='hold')){
      const near=alive.some(p=>p.team===0&&foes.some(e=>dist(e,p)<280));
      // 적 영토에서는 적이 자기 진영에서 기다림 (30초 후엔 출격)
      const go=loc==='enemy'?(near||bt>30):(near||bt>3.2);
      if(go)foes.forEach(e=>{
        if(e.mode!=='hold')return;
        // 언덕 위 궁병·마법사는 자리를 지키며 사격 (25초 후엔 전군 돌격)
        if(bt<25&&(e.type==='archer'||e.type==='mage')&&tOf(e)===G_HILL)return;
        e.mode='charge';
      });
    }
  }
  for(const u of units)updUnit(u,dt,alive);
  separate(units.filter(u=>!u.dead));
  if(RVR)for(const u of units)if(!u.dead&&u.sx0!=null&&tOf(u)===G_RIVER){u.x=u.sx0;u.y=u.sy0;}
  if(HB&&STAIR)for(const u of units)if(!u.dead&&u.sx0!=null&&lvlB(blkOf(u.x,u.y))!==lvlB(blkOf(u.sx0,u.sy0))&&!canPass(blkOf(u.sx0,u.sy0),blkOf(u.x,u.y))){u.x=u.sx0;u.y=u.sy0;}
  updProjs(dt);fx(dt);
  shake=Math.max(0,shake-dt);
  if(state==='battle'){
    updateHud();
    const a0=units.some(u=>!u.dead&&u.team===0),a1=units.some(u=>!u.dead&&u.team===1);
    if(!a0||!a1){endT+=dt;if(endT>1.3)showResult(!a1);}
  }
}
function updateHud(){
  const now=performance.now();if(now-chipT>200){chipT=now;renderChips();updSkills();}
  const n0=units.filter(u=>!u.dead&&u.team===0).length,n1=units.filter(u=>!u.dead&&u.team===1).length;
  $('n0').textContent=n0;$('n1').textContent=n1;
  $('b0').style.width=(start0?n0/start0*100:0)+'%';$('b1').style.width=(start1?n1/start1*100:0)+'%';
}
function showResult(win){
  sfx(win?'win':'lose',.5,500);
  state='result';lastWin=win;
  show('cmds',false);show('hint',false);show('result',true);
  const n0=units.filter(u=>!u.dead&&u.team===0).length;
  $('rtitle').textContent=win?'승리!':'패배…';
  $('rtitle').style.color=win?'#f0c050':'#ff7a7a';
  $('rstat1').textContent=`아군 생존 ${n0} / ${start0}  ·  처치 ${kills}`;
  const s=Math.round(bt);
  $('rstat2').textContent=`전투 시간 ${Math.floor(s/60)}분 ${s%60}초  ·  ${terrainLabel}`;
  pending=null;
  if(battleCtx&&battleCtx.p1){
    const log=[];
    heroes.forEach(h=>{const u=units.find(x=>x.hero===h);if(!u)return;
      levelUp(h,(u.kills||0)*10+(win?25:10),log);
      if(u.dead){if(h.king){prog.p1.health=Math.max(5,prog.p1.health-30);log.push('<span class="danger">✚ 쓰러져 크게 다쳤습니다 (건강 −30)</span>');}
        else{h.injured=rint(1,2);h.newInj=true;log.push(`<span class="danger">✚ 동료 ${h.name} 부상 ${h.injured}개월</span>`);}}});
    $('rlog').innerHTML=log.join('<br>');$('tohub').textContent='마을로 돌아가기 (1개월 경과)';save();return;
  }
  $('tohub').textContent='지도로 돌아가기 (1개월 경과)';
  // ---- 성장 처리 ----
  const log=[];
  (deploySnap||[]).forEach(o=>{
    const us=units.filter(u=>u.team===0&&u.orig===o.id&&!u.hero);const n=us.length;if(!n)return;
    const surv=us.filter(u=>!u.dead).length,k=us.reduce((a,u)=>a+(u.kills||0),0),old=starOf(o.xp||0);
    let xp=(o.xp||0)+k*4+(surv?(win?15:5):0);
    xp=surv?xp*(.4+.6*surv/n):0;
    o.xp=Math.round(xp);
    const ns=starOf(o.xp);
    if(ns>old)log.push(`⬆ ${o.label} 승급! ${starTxt(ns)}`);
    else if(ns<old)log.push(`<span class="danger">⬇ ${o.label} 큰 피해로 숙련도 하락 (${starTxt(ns)||'신병'})</span>`);
  });
  let gold=win?150+30*Math.floor(prog.month/2):40,lucky=false;
  heroes.forEach(h=>{
    const u=units.find(x=>x.hero===h);if(!u)return;
    h.fought=true;
    const sk=units.filter(x=>x.team===0&&x.orig===u.orig&&!x.hero).reduce((a,x)=>a+(x.kills||0),0);
    levelUp(h,(u.kills||0)*10+sk*2+(win?25:10),log);
    h.loyalty=clampL(h.loyalty+(win?4:1)*loyGain(h));
    if(has(h,'행운아'))lucky=true;
    if(u.dead){
      let m=rint(1,3);if(Math.random()<.15){m+=2;log.push(`<span class="danger">✚ ${h.name} 중상!</span>`);}
      if(has(h,'허약'))m++;if(has(h,'불굴'))m=Math.max(1,Math.ceil(m/2));
      h.injured=m;h.newInj=true;h.sq=null;
      log.push(`<span class="danger">✚ ${h.name} 부상 — ${m}개월 출전 불가 (급여는 계속 지급)</span>`);
    }
  });
  if(lucky)gold=Math.round(gold*1.15);
  const deadS=units.filter(u=>u.team===0&&!u.hero&&u.dead);
  const lc=deadS.filter(u=>u.type==='cav').length,lm=deadS.filter(u=>u.type==='mage').length,li=Math.ceil(deadS.length/3);
  prog.goods.horse=Math.max(0,(prog.goods.horse||0)-lc);prog.goods.mana=Math.max(0,(prog.goods.mana||0)-lm);prog.goods.iron=Math.max(0,(prog.goods.iron||0)-li);
  if(lc||lm||li)log.push(`📦 전투 손실: 🐎말 −${lc} · 🔮마정석 −${lm} · ⛏철 −${li}`);
  prog.morale=clampL(prog.morale+(win?2:-3));
  const ku=units.find(x=>x.hero&&x.hero.king&&x.team===0);
  if(ku&&ku.dead){prog.morale=clampL(prog.morale-10);heroes.forEach(h=>{if(!h.king)h.loyalty=clampL(h.loyalty-5);});log.push('<span class="danger">👑 왕이 전장에서 쓰러졌습니다! 민심 −10, 장수 충성 −5</span>');}
  const rv=rivals[PRESETS.indexOf(preset)]||[];
  units.filter(u=>u.hero&&u.team===1).forEach(u=>{
    const h=u.hero;levelUp(h,(u.kills||0)*10+20);
    if(!u.dead)return;
    if(win&&Math.random()<.4){
      const i=rv.indexOf(h);if(i>=0)rv.splice(i,1,genHero({type:pick(presetTypes(preset)),lv:Math.max(1,h.lv-1)}));
      h.captured=true;h.loyalty=rint(10,25);h.sq=null;h.injured=0;h.cost=Math.round(heroCost(h)*.5);h.wage=heroWage(h);
      tavern.unshift(h);
      log.push(`⛓ 적 장수 <span style="color:${RARITY[h.rarity].col}">${h.name}</span> 포로로 잡음 — 주점에서 반값에 영입 가능`);
      if(h.rarity>=2&&Math.random()<.2){const u=giveUnique('u_sun_bow','적 장수 포획');if(u)log.push(u);}
    }else{h.injured=rint(1,2);h.newInj=true;log.push(`적 장수 ${h.name} 부상 (${h.injured}개월)`);}
  });
  prog.gold+=gold;log.unshift(`💰 전리품 +${gold}${lucky?' (행운아 +15%)':''} → 보유 ${prog.gold}`);
  if(win)prog.wins++;
  $('rlog').innerHTML=log.join('<br>');
  save();
}

/* ---------- 렌더링 ---------- */
const BCH=[{spear:'Knight',cav:'GladiatorBlue',archer:'Hunter',mage:'SorcererOrange'},{spear:'RedGladiator',cav:'FighterRed',archer:'NinjaGray',mage:'SorcererBlack'}];
const HCH=[{spear:'KnightGold',cav:'Princess',archer:'Inspector',mage:'Master'},{spear:'Samurai',cav:'Vampire',archer:'MaskRacoon',mage:'NinjaMageBlack'}];
const uTop=u=>tsReady()?(u.hero?54:u.type==='cav'?40:36):(SPR[u.type][0].height*(u.hero?HSCALE:1));
function drawUnitS(u){
  const ch=(u.hero?HCH:BCH)[u.team][u.type],im=cimg(`assets/chars/${ch}/SpriteSheet.png`),sc=u.hero?3:2,cav=u.type==='cav';
  const bob=u.moving?Math.abs(Math.sin(u.anim*12))*1.5:0;
  const lx=u.lunge>0?u.face*Math.sin(u.lunge/.16*Math.PI)*(TYPES[u.type].range>40?2:6):0;
  ctx.save();ctx.translate(Math.round(u.x+lx),Math.round(u.y));
  if(!u.dead){
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,0,cav?13:9,3.5,0,0,7);ctx.fill();
    ctx.fillStyle=u.team===0?'rgba(80,150,255,.55)':'rgba(255,80,70,.55)';ctx.beginPath();ctx.ellipse(0,0,cav?12:8,3,0,0,7);ctx.fill();
    if(u.hero){ctx.strokeStyle=u.team===0?'#f0c050':'#ff6a3a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,14,5,0,0,7);ctx.stroke();}
    if(u.slow>bt){ctx.fillStyle='rgba(150,220,255,.35)';ctx.beginPath();ctx.ellipse(0,0,12,4,0,0,7);ctx.fill();}
    if(u.wall>bt){ctx.strokeStyle='rgba(143,195,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-14,15,20,0,0,7);ctx.stroke();}
  }else{const a=Math.min(1,u.deathT/.3);ctx.globalAlpha=Math.max(.35,1-u.deathT*.5);ctx.rotate(-u.face*a*Math.PI/2);}
  if(u.flash>0&&!u.dead)ctx.filter='brightness(2.2)';
  const fr=u.lunge>0?4:u.moving?Math.floor(u.anim*8)%4:0,col=u.face>0?3:2,S=16*sc;
  if(cav){const h=cimg('assets/animals/Horse.png'),hf=u.moving?Math.floor(u.anim*6)%2:0;ctx.save();if(u.face>0)ctx.scale(-1,1);if(h.complete&&h.naturalWidth)ctx.drawImage(h,hf*16,0,16,16,-16,-30-bob,32,32);ctx.restore();}
  if(im.complete&&im.naturalWidth)ctx.drawImage(im,col*16,fr*16,16,16,-S/2,-S-(cav?14:0)-Math.round(bob),S,S);
  ctx.filter='none';ctx.restore();
}
function drawUnit(u){
  if(tsReady())return drawUnitTS(u);
  const spr=u.hero?heroSprite(u.hero,u.team):SPR[u.type][u.team],w=spr.width,h=spr.height,sc=u.hero?HSCALE:1;
  const bob=u.moving?Math.abs(Math.sin(u.anim*12))*2:Math.sin(u.anim*2)*.5;
  const lx=u.lunge>0?u.face*Math.sin(u.lunge/.16*Math.PI)*(TYPES[u.type].range>40?2:6):0;
  ctx.save();ctx.translate(Math.round(u.x+lx),Math.round(u.y));
  if(!u.dead){
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,0,w*.32*sc,3.5*sc,0,0,7);ctx.fill();
    if(u.hero){ctx.strokeStyle=u.team===0?'#f0c050':'#ff6a3a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,w*.4*sc,5*sc,0,0,7);ctx.stroke();}
    if(u.slow>bt){ctx.fillStyle='rgba(150,220,255,.35)';ctx.beginPath();ctx.ellipse(0,0,12,4,0,0,7);ctx.fill();}
    if(u.wall>bt){ctx.strokeStyle='rgba(143,195,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-8,13,16,0,0,7);ctx.stroke();}
  }
  else{
    const a=Math.min(1,u.deathT/.3);
    ctx.globalAlpha=Math.max(.35,1-u.deathT*.5);
    ctx.rotate(-u.face*a*Math.PI/2);
  }
  ctx.scale(u.face*sc,sc);
  ctx.drawImage(spr,-w/2,-h-Math.round(bob));
  if(u.flash>0&&!u.dead){ctx.globalAlpha=Math.min(1,u.flash*8);ctx.drawImage(WSPR[u.type],-w/2,-h-Math.round(bob));}
  ctx.restore();
}
function render(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#0b1020';ctx.fillRect(0,0,cv.width,cv.height);
  const k=shake>0?shake/.18:0,sx=(Math.random()-.5)*6*k,sy=(Math.random()-.5)*6*k,z=cam.z;
  ctx.setTransform(dpr*z,0,0,dpr*z,dpr*(-cam.x+sx)*z,dpr*(-cam.y+sy)*z);
  ctx.imageSmoothingEnabled=false;
  if(state==='hub'){if(hubTab==='city')drawCity(z);else{drawMap(z);drawWeather(prog.weather);}return;}
  if(inTown()){drawTown(z);return;}
  if(state==='title'){if(tsReady()){if(!titleTS)titleTS=buildStaticTown(Math.floor(Math.random()*9999),pick(['plains','forest','river']),pick(NATIONS.slice(1)).col,'large','');drawStatic(titleTS,z);}else ctx.drawImage(bg,0,0);ctx.fillStyle='rgba(10,12,30,.35)';ctx.fillRect(-400,-400,W+800,H+800);return;}
  ctx.drawImage(bg,0,0,W,H);
  if(BOV.wat.length||BOV.brg.length){ctx.imageSmoothingEnabled=false;const wf=Math.floor(performance.now()/300)%4,FWI=TS.FanWater;for(const [id,x,y] of BOV.wat)ctx.drawImage(FWI,((id%24)+wf*6)*16,((id/24)|0)*16,16,16,x*8,y*8,8,8);
    ctx.imageSmoothingEnabled=true;const BRI=tsi('Terrain/Bridge/Bridge_All.png');for(const [k,x,y,w,h] of BOV.brg)ctx.drawImage(BRI,k*64,0,64,64,x,y,w,h);ctx.imageSmoothingEnabled=false;}
  ctx.strokeStyle='#05070f';ctx.lineWidth=4;ctx.strokeRect(-2,-2,W+4,H+4);
  if(state==='deploy'){
    ctx.fillStyle='rgba(63,123,224,.10)';ctx.fillRect(0,YMIN-10,ZONE0+10,YMAX-YMIN+20);
    ctx.fillStyle='rgba(217,72,72,.10)';ctx.fillRect(ZONE1-10,YMIN-10,W-ZONE1+10,YMAX-YMIN+20);
    ctx.fillStyle='rgba(120,170,255,.6)';for(let y=YMIN-10;y<YMAX+10;y+=12)ctx.fillRect(ZONE0+9,y,2,6);
    ctx.fillStyle='rgba(255,130,130,.6)';for(let y=YMIN-10;y<YMAX+10;y+=12)ctx.fillRect(ZONE1-11,y,2,6);
  }
  for(const p of parts)if(p.ring){
    const q=p.t/p.life;ctx.strokeStyle=`rgba(${p.rc||'255,170,60'},${1-q})`;ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*(.4+q*.8),p.r*(.4+q*.8)*.45,0,0,7);ctx.stroke();
  }
  units.filter(u=>u.dead).forEach(drawUnit);
  const live=units.filter(u=>!u.dead).sort((a,b)=>a.y-b.y);
  // 선택된 아군 부대 발밑 표시
  ctx.fillStyle='rgba(255,211,77,.4)';
  for(const u of live){if(u.team!==0)continue;const s=SQ[u.g];if(s&&s.sel){ctx.beginPath();ctx.ellipse(u.x,u.y,u.r+5,5,0,0,7);ctx.fill();}}
  const foci=[...new Set(squads.map(s=>s.focus).filter(f=>f&&!f.dead))];
  ctx.strokeStyle='rgba(255,90,90,.9)';ctx.lineWidth=2;
  for(const f of foci){ctx.beginPath();ctx.ellipse(f.x,f.y,f.r+5,5,0,0,7);ctx.stroke();}
  live.forEach(drawUnit);
  ctx.globalAlpha=.5;ctx.drawImage(canopy,0,0);ctx.globalAlpha=1;
  for(const u of live){
    if(u.hero){
      const w=28,x=Math.round(u.x-w/2),y=Math.round(u.y-uTop(u)-8);
      ctx.fillStyle='#14141c';ctx.fillRect(x-1,y-1,w+2,5);
      ctx.fillStyle=u.team===0?'#f0c050':'#ff6a3a';ctx.fillRect(x,y,Math.max(0,w*u.hp/u.max),3);
      const ts=Math.max(1,.85/cam.z);
      ctx.font=`800 ${Math.round(10*ts)}px sans-serif`;ctx.textAlign='center';ctx.lineWidth=3*ts;ctx.strokeStyle='#14141c';
      const t=`${u.hero.name} Lv${u.hero.lv}`;ctx.strokeText(t,u.x,y-4);ctx.fillStyle=RARITY[u.hero.rarity].col;ctx.fillText(t,u.x,y-4);
    }else if(u.hp<u.max){
      const w=18,x=Math.round(u.x-w/2),y=Math.round(u.y-uTop(u)-7);
      ctx.fillStyle='#14141c';ctx.fillRect(x-1,y-1,w+2,4);
      ctx.fillStyle=u.team===0?'#5fd06a':'#ff5a5a';ctx.fillRect(x,y,Math.max(0,w*u.hp/u.max),2);
    }
  }
  for(const f of foci){
    const y=f.y-uTop(f)-14+Math.sin(performance.now()/150)*2;
    ctx.fillStyle='#ff5a5a';ctx.beginPath();ctx.moveTo(f.x-5,y-6);ctx.lineTo(f.x+5,y-6);ctx.lineTo(f.x,y);ctx.fill();
  }
  drawSquadTags(z);
  for(const p of projs){
    ctx.save();ctx.translate(p.x,p.y);
    if(p.k==='arrow'){ctx.rotate(p.a);ctx.fillStyle='#5a3a1e';ctx.fillRect(-7,-.5,10,1.5);ctx.fillStyle='#e6e9ef';ctx.fillRect(3,-1,3,3);ctx.fillStyle='#ffffff';ctx.fillRect(-8,-1.5,2,1);ctx.fillRect(-8,1,2,1);}
    else{ctx.fillStyle='rgba(255,120,30,.35)';ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();ctx.fillStyle='#ffb02e';ctx.fillRect(-3,-3,6,6);ctx.fillStyle='#fff3a0';ctx.fillRect(-1,-1,3,3);}
    ctx.restore();
  }
  ctx.imageSmoothingEnabled=false;for(const a of sfxA){const [fw,fh,n]=FXD[a.k],im=fxi(a.k);if(!im.complete)continue;const f=Math.min(n-1,Math.floor(a.t/a.dur*n));ctx.drawImage(im,f*fw,0,fw,fh,Math.round(a.x-fw*a.sc/2),Math.round(a.y-fh*a.sc*.8),fw*a.sc,fh*a.sc);}
  for(const p of parts)if(!p.ring){ctx.globalAlpha=1-p.t/p.life;ctx.fillStyle=p.col;if(p.arrow)ctx.fillRect(Math.round(p.x),Math.round(p.y),1,7);else ctx.fillRect(Math.round(p.x),Math.round(p.y),p.s,p.s);}
  if(pending&&hover&&state==='battle'){
    const R=SKILLS[pending.hero.skill].R||70;ctx.globalAlpha=.9;ctx.strokeStyle='#ffd34d';ctx.setLineDash([6,4]);ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(hover.x,hover.y,R,R*.7,0,0,7);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,211,77,.12)';ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.lineJoin='round';
  const ts=Math.max(1,.8/z);
  for(const t of texts){
    ctx.globalAlpha=Math.min(1,(1-t.t/.9)*2);
    ctx.font=`800 ${Math.round(t.size*ts)}px sans-serif`;
    ctx.strokeStyle='#14141c';ctx.lineWidth=3*ts;ctx.strokeText(t.txt,t.x,t.y);
    ctx.fillStyle=t.col;ctx.fillText(t.txt,t.x,t.y);
  }
  ctx.globalAlpha=1;
  if(state==='deploy'&&hover)drawTip();
  drawWeather(state==='deploy'?prog.weather:bw);
}
// 부대 이름표 (지도 위)
function drawSquadTags(z){
  const ts=Math.max(1,.85/z);
  ctx.font=`800 ${Math.round(10*ts)}px sans-serif`;ctx.textAlign='center';
  for(const s of squads){
    const m=units.filter(u=>u.team===0&&u.g===s.id&&!u.dead&&!u.hero);
    if(!m.length)continue;
    const x=m.reduce((a,u)=>a+u.x,0)/m.length,top=Math.min(...m.map(u=>u.y-uTop(u)));
    const lb=s.label+starTxt(starOf(s.xp||0));
    const txt=state==='deploy'?lb:`${lb} ${{charge:'⚔',hold:'■',retreat:'↩'}[s.mode]}`;
    const w=ctx.measureText(txt).width+10*ts,h=14*ts,y=top-12*ts-h;
    ctx.fillStyle=s.sel?'rgba(58,50,22,.92)':'rgba(10,14,30,.75)';ctx.fillRect(x-w/2,y,w,h);
    ctx.strokeStyle=s.sel?'#f0c050':'#3f7be0';ctx.lineWidth=1.2*ts;ctx.strokeRect(x-w/2,y,w,h);
    ctx.fillStyle=s.sel?'#ffe9a8':'#cfe0ff';ctx.fillText(txt,x,y+h*.75);
  }
}
function drawTip(){
  let t,who='';
  if(drag){
    const ids=drag.set.map(o=>o.q.id),g=units.filter(u=>u.team===0&&ids.includes(u.g));
    if(!g.length)return;
    const cnt={};g.forEach(u=>{const k=tOf(u);cnt[k]=(cnt[k]||0)+1;});
    t=+Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];
    who=(drag.set.length>1?`부대 ${drag.set.length}개`:drag.set[0].q.label)+' → ';
  }else{
    if(hover.y<YMIN-8||hover.y>YMAX+8||hover.x<0||hover.x>W)return;
    t=terrAt(hover.x,hover.y);
    if(t===G_GRASS)return;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const x=(hover.x-cam.x)*cam.z,y=(hover.y-cam.y)*cam.z;
  const l1=who+TER[t].name,l2=TER[t].tip;
  ctx.font='800 12px sans-serif';
  const w=Math.max(ctx.measureText(l1).width,ctx.measureText(l2).width+4)+16;
  let bx=x+16,by=y-52;
  if(bx+w>innerWidth-4)bx=x-16-w;
  if(by<4)by=y+20;
  ctx.fillStyle='rgba(10,13,26,.9)';ctx.fillRect(bx,by,w,40);
  ctx.strokeStyle='#4a5688';ctx.lineWidth=1;ctx.strokeRect(bx+.5,by+.5,w-1,39);
  ctx.textAlign='left';
  ctx.fillStyle='#ffd34d';ctx.fillText(l1,bx+8,by+17);
  ctx.font='600 11px sans-serif';ctx.fillStyle='#dfe4f5';ctx.fillText(l2,bx+8,by+32);
}

/* ---------- 루프 ---------- */
let last=performance.now();
/* ---------- 소리 ---------- */
const SND={on:(()=>{try{return localStorage.getItem('throne-snd')!=='0';}catch(e){return true;}})(),bgm:null,cur:'',want:'',last:{}};
function bgmTick(){const w=state==='title'?'title':inTown()?'town':state==='hub'?'kingdom':'battle';SND.want=w;
  if(!SND.on){if(SND.bgm){SND.bgm.pause();SND.bgm=null;SND.cur='';}return;}
  if(SND.cur===w&&SND.bgm)return;SND.cur=w;if(SND.bgm)SND.bgm.pause();
  const a=new Audio(`assets/audio/${w}.ogg`);a.loop=true;a.volume=w==='battle'?.32:.38;SND.bgm=a;a.play().catch(()=>{SND.cur='';SND.bgm=null;});}
function sfx(n,v,gap){if(!SND.on)return;const t=performance.now();if(t-(SND.last[n]||0)<(gap||70))return;SND.last[n]=t;
  try{const a=new Audio(`assets/audio/${n}.wav`);a.volume=v||.4;a.play().catch(()=>{});}catch(e){}}
function sndToggle(){SND.on=!SND.on;try{localStorage.setItem('throne-snd',SND.on?'1':'0');}catch(e){}$('sndbtn').classList.toggle('off',!SND.on);if(SND.on){SND.cur='';bgmTick();}else bgmTick();}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(b&&b.id!=='sndbtn')sfx('click',.22,40);});
let last0=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(((now/500)|0)!==((last0||0)/500|0))bgmTick();last0=now;
  if(keys.size&&state!=='p1'){
    const sp=700*dt/cam.z;
    if(keys.has('arrowleft')||keys.has('a'))cam.x-=sp;
    if(keys.has('arrowright')||keys.has('d'))cam.x+=sp;
    if(keys.has('arrowup')||keys.has('w'))cam.y-=sp;
    if(keys.has('arrowdown')||keys.has('s'))cam.y+=sp;
    clampCam();
  }
  for(const u of units)u.anim+=dt;
  if(state==='hub'){if(hubTab==='city')updCity(dt);else{if(!ments.length)initMents();updMap(dt);}}
  if(inTown())updTown(dt);
  const curW=state==='hub'||state==='deploy'?prog.weather:bw;updWeather(dt,curW);
  if(state==='battle'&&!paused){for(let i=0;i<speed;i++)step(dt);}
  else if(state==='result')step(dt);
  render();
  requestAnimationFrame(frame);
}
/* ---------- 1페이즈: 시민 → 왕 ---------- */
const NINFO={
  1:{size:'small',sec:'치안 나쁨 · 몬스터 숲 접경',stance:'호전적',tower:false,fit:{soldier:1.4,merchant:.85,noble:1,mage:0,rebel:1.15},desc:'작고 거친 변경. 싸움이 잦아 군인이 빨리 출세한다'},
  2:{size:'large',sec:'치안 좋음',stance:'강대국',tower:true,fit:{soldier:1,merchant:1,noble:1,mage:.9,rebel:.7},desc:'거대한 제국. 어느 길이든 왕좌까지 멀고 험하지만, 즉위하면 처음부터 강대국'},
  3:{size:'small',sec:'치안 좋음 · 중립국',stance:'중립',tower:false,fit:{soldier:.8,merchant:1.45,noble:1.1,mage:0,rebel:.8},desc:'무역로가 모이는 작은 중립국. 상인의 천국'},
  4:{size:'medium',sec:'치안 보통 · 마탑 보유',stance:'학구적',tower:true,fit:{soldier:.9,merchant:1,noble:1,mage:1.45,rebel:.85},desc:'마탑이 다스리는 마도국. 마법사가 섭정까지 오른다'},
  5:{size:'medium',sec:'치안 나쁨 · 내전 직전',stance:'불안',tower:false,fit:{soldier:1.1,merchant:.9,noble:1.2,mage:0,rebel:1.45},desc:'왕실이 흔들리는 나라. 반란과 정치 공작이 통한다'}
};
const SIZE_MUL={small:.75,medium:1,large:1.35},SIZE_NAME={small:'작음 (영토 3)',medium:'중간 (영토 4)',large:'거대 (영토 6)'};
const ROUTES={
  soldier:{name:'군인',icon:'⚔',job:'경비 근무',type:'cav',skill:'rally',main:'무예',
    ranks:[{n:'신병'},{n:'병장',fame:10,st:{무예:30}},{n:'기사',fame:25,st:{무예:40,통솔:30}},{n:'장군',fame:45,st:{통솔:45},wins:4},{n:'원수',fame:65,st:{통솔:52,매력:35}}],
    crown:{fame:95,band:16},crownTxt:'쿠데타 — 근위대와 결전',battle:true},
  merchant:{name:'상인',icon:'💰',job:'장사',type:'spear',skill:'warcry',main:'내정',
    ranks:[{n:'행상'},{n:'상점 주인',fame:8,gold:150},{n:'상단주',fame:20,gold:450,st:{내정:38}},{n:'길드장',fame:35,gold:900,st:{매력:42}},{n:'재무대신',fame:55,gold:1500,st:{내정:55},net:45}],
    crown:{gold:2500,net:60},crownTxt:'귀족들을 매수해 왕관을 산다 (전투 없음)',battle:false},
  noble:{name:'정치',icon:'📜',job:'서기 업무',type:'cav',skill:'warcry',main:'매력',
    ranks:[{n:'서기'},{n:'관리',fame:10,st:{지략:30}},{n:'기사 작위',fame:22,net:20},{n:'영주',fame:40,net:38,st:{매력:45}},{n:'대공',fame:60,net:55,st:{통솔:42}}],
    crown:{fame:85,net:75},crownTxt:'계승권 다툼 — 왕위 경쟁자와 결전',battle:true},
  mage:{name:'마법사',icon:'🔮',job:'마탑 연구',type:'mage',skill:'storm',main:'지략',
    ranks:[{n:'견습생'},{n:'마법사',fame:8,st:{지략:36}},{n:'마도사',fame:22,st:{지략:48}},{n:'궁정마법사',fame:40,st:{지략:58},net:25},{n:'섭정',fame:60,st:{지략:68,매력:40}}],
    crown:{fame:85,st:{지략:75}},crownTxt:'섭정에서 즉위 — 왕당파와 결전',battle:true},
  rebel:{name:'반란',icon:'🔥',job:'약탈과 선동',type:'spear',skill:'rally',main:'무예',
    ranks:[{n:'불평분자'},{n:'도적단원',fame:8,st:{무예:28}},{n:'두목',fame:20,band:10},{n:'반란군 지휘관',fame:40,band:16,st:{통솔:38}},{n:'혁명 지도자',fame:60,band:20,st:{매력:45}}],
    crown:{fame:85,band:24},crownTxt:'왕궁 습격 — 왕실 근위대와 결전',battle:true}
};
const COMP={soldier:{spear:.45,cav:.3,archer:.25},merchant:{spear:.45,archer:.55},noble:{spear:.4,cav:.35,archer:.25},mage:{spear:.4,archer:.3,mage:.3},rebel:{spear:.55,archer:.45}};
const QUESTS=[
  {name:'도적 소탕',txt:'마을을 괴롭히는 도적 떼를 쓸어버린다',battle:{spear:3,archer:2},gold:60,fame:6},
  {name:'상단 호위',txt:'습격당한 상단을 지킨다',battle:{spear:2,cav:1,archer:2},gold:90,fame:4,net:2},
  {name:'숲의 짐승 떼 사냥',txt:'숲에서 몰려나온 사나운 짐승 떼를 막는다',battle:{cav:3,spear:2},gold:70,fame:8},
  {name:'탈영병 진압',txt:'무장한 탈영병 무리를 붙잡는다',battle:{spear:3,cav:1,archer:1},gold:50,fame:7},
  {name:'세금 장부 정리',txt:'엉망인 장부를 바로잡는다',check:'내정',dc:28,gold:70,fame:3,net:2},
  {name:'마을 분쟁 중재',txt:'두 마을의 물 다툼을 중재한다',check:'매력',dc:28,gold:40,fame:6,net:4},
  {name:'고대 문서 해독',txt:'유적에서 나온 문서를 읽어낸다',check:'지략',dc:32,gold:50,fame:5},
  {name:'결투 대리인',txt:'귀족 대신 결투에 나선다',check:'무예',dc:32,gold:80,fame:6},
  {name:'민병대 교관',txt:'마을 민병대를 훈련시킨다',check:'통솔',dc:28,gold:60,fame:4,net:2}
];
const P1EVENTS=[
  {t:'귀족의 뒷거래',txt:'한 귀족이 은밀한 일을 맡기며 두둑한 돈주머니를 내민다.',opts:[
    {l:'받는다 (💰+150, 명성 −4, 인맥 +5)',f:p=>{p.gold+=150;p.fame=Math.max(0,p.fame-4);p.net+=5;return '검은 돈을 받았다.';}},
    {l:'거절한다 (명성 +3, 매력 +1)',f:p=>{p.fame+=3;p.st.매력+=1;return '깨끗한 이름을 지켰다.';}}]},
  {t:'술집 싸움',txt:'술 취한 용병이 시비를 건다.',opts:[
    {l:'맞서 싸운다 (무예 판정)',f:p=>{if(Math.random()<chk(p.st.무예,32)){p.fame+=5;p.st.무예+=1;return '용병을 때려눕혔다! (명성 +5, 무예 +1)';}p.health-=20;return '얻어맞았다… (건강 −20)';}},
    {l:'웃으며 술을 산다 (💰−10, 인맥 +2)',f:p=>{p.gold-=10;p.net+=2;return '친구가 하나 늘었다.';}}]},
  {t:'떠돌이 현자',txt:'낡은 지팡이를 든 노인이 가르침을 주겠다고 한다.',opts:[
    {l:'가르침을 청한다 (💰−30, 지략 +4)',f:p=>{p.gold-=30;p.st.지략+=4;return '세상을 보는 눈이 넓어졌다.';}},
    {l:'그냥 지나친다',f:()=> '노인은 쓸쓸히 웃었다.'}]},
  {t:'흉년',txt:'올해 농사가 망쳐 굶는 마을이 생겼다.',opts:[
    {l:'곡식을 나눠준다 (💰−50, 명성 +8, 인맥 +3)',f:p=>{p.gold-=50;p.fame+=8;p.net+=3;return '백성들이 당신의 이름을 기억한다.';}},
    {l:'내 코가 석자다',f:p=>{p.fame=Math.max(0,p.fame-2);return '사람들의 눈길이 차갑다. (명성 −2)';}}]},
  {t:'국경 분쟁',txt:'이웃 나라와 국경에서 충돌이 벌어졌다. 지원병을 모집한다.',opts:[
    {l:'자원해서 싸운다 (전투)',f:p=>{startP1Quest({name:'국경 분쟁',battle:{spear:4,cav:2,archer:2},gold:80,fame:12,ev:true});return null;}},
    {l:'모른 척한다',f:()=> '전쟁은 남의 일.'}]},
  {t:'투자 제안',txt:'상단이 새 무역로에 투자하라고 권한다.',opts:[
    {l:'💰200 투자한다',f:p=>{if(p.gold<200)return '돈이 모자라 투자하지 못했다.';p.gold-=200;if(Math.random()<.6+(p.st.내정-30)/200){p.gold+=480;p.st.내정+=2;return '대박! 💰480을 돌려받았다. (내정 +2)';}return '상단이 파산했다… 💰200을 잃었다.';}},
    {l:'거절한다',f:()=> '안전한 길을 택했다.'}]},
  {t:'마탑의 시험',txt:'마탑이 재능 있는 자를 찾는 시험을 연다.',opts:[
    {l:'응시한다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,35)){p.st.지략+=5;p.fame+=5;return '합격! 지략 +5, 명성 +5';}return '아쉽게 떨어졌다.';}},
    {l:'관심 없다',f:()=> '시험장은 북적였다.'}]},
  {t:'반란 모의',txt:'술집 뒷방에서 왕실을 뒤엎자는 모의를 엿들었다.',opts:[
    {l:'가담한다 (인맥 +6, 무리 +3, 반란 루트면 명성 +6)',f:p=>{p.net+=6;p.band+=3;if(p.route==='rebel')p.fame+=6;return '위험한 동지들이 생겼다.';}},
    {l:'고발한다 (명성 +6, 반란 루트면 명성 −10)',f:p=>{if(p.route==='rebel'){p.fame=Math.max(0,p.fame-10);return '동료를 팔았다는 소문이 돌았다.';}p.fame+=6;return '왕실이 당신을 주목한다.';}}]},
  {t:'떠돌이 검객',txt:'실력 좋은 검객이 동료가 되고 싶어 한다.',opts:[
    {l:'받아들인다 (동료 합류, 월급 있음)',f:p=>{if(heroes.filter(h=>!h.king).length>=3)return '동료 자리가 가득 찼다.';const h=genHero({rarity:rint(0,2),lv:rint(1,3)});h.loyalty=55;heroes.push(h);return `${h.name}이(가) 동료가 됐다.`;}},
    {l:'정중히 거절한다',f:()=> '검객은 길을 떠났다.'}]},
  {t:'축제',txt:'마을에 축제가 열렸다.',opts:[
    {l:'흥청망청 즐긴다 (💰−20, 매력 +2, 건강 +10)',f:p=>{p.gold-=20;p.st.매력+=2;p.health+=10;return '좋은 시간을 보냈다.';}},
    {l:'일한다 (💰+30)',f:p=>{p.gold+=30;return '남들이 놀 때 벌었다.';}}]}
];
const hasPerk=(p,k)=>!!(p&&p.perks&&p.perks.includes(k));
const SPEC_INIT={soldier:{merit:0},merchant:{shops:0},noble:{roy:30,nob:30,peo:30},mage:{arcana:0},rebel:{support:10,wanted:0}};
const qb=(name,battle,gold,fame,extra)=>Object.assign({name,battle,gold,fame,ev:true},extra||{});
const tierOf=(home,route)=>{const f=fitOf(home,route);if(!f)return 1;const v=f/SIZE_MUL[NINFO[home].size];return v>=1.7?0:v>=1.15?1:v>=.85?2:3;};
const SPEC={
  soldier:{
    title:'⚔ 군인의 길 — 무훈',
    status:p=>`무훈 <b>${p.spec.merit}</b> — 전투에서 이기거나 공을 세우면 쌓이고, 3·6·10에서 보상을 받습니다`,
    actions:[
      {l:'🔥 혹독한 병영 훈련',tip:'무예·통솔 +2, 건강 −15',dis:p=>p.health<25,f:p=>{p.st.무예+=2;p.st.통솔+=2;p.health-=15;return '지옥 같은 훈련을 견뎠다 (무예·통솔 +2)';}},
      {l:'📜 작전 보고서 제출',tip:'지략 판정 → 무훈 +1·명성',f:p=>{if(Math.random()<chk(p.st.지략,30)){p.spec.merit++;const f=addFame(p,3);return `상관이 보고서를 칭찬했다 (무훈 +1, 명성 +${f})`;}return '보고서는 서랍 속에 묻혔다.';}}
    ],
    perks:[
      {k:'명검',at:p=>p.spec.merit>=3,txt:'상관이 명검을 하사했다 (무예 +5)',f:p=>{p.st.무예+=5;}},
      {k:'기병대',at:p=>p.spec.merit>=6,txt:'기병대 지휘권을 얻었다 (무리 +4)',f:p=>{p.band+=4;}},
      {k:'전쟁영웅',at:p=>p.spec.merit>=10,txt:'전쟁 영웅으로 칭송받는다 (명성 +15, 즉위 명성 조건 −15)',f:p=>{p.fame+=15;}}
    ],
    onWin:p=>{p.spec.merit++;},
    events:[
      {t:'무예 대회',txt:'왕도에서 무예 대회가 열린다. 3번 이기면 우승!',opts:[
        {l:'참가한다 (💰−20, 무예 판정 3연전)',f:p=>{p.gold-=20;let w=0;for(let i=0;i<3;i++){if(Math.random()<chk(p.st.무예,30+i*8))w++;else break;}
          if(w===3){p.gold+=200;p.spec.merit+=2;const f=addFame(p,12);return `🏆 우승! 💰+200, 무훈 +2, 명성 +${f}`;}p.fame+=w*2;return `${w}승 후 탈락 (명성 +${w*2})`;}},
        {l:'구경만 한다',f:p=>{p.st.무예+=1;return '고수들의 검술을 보며 배웠다 (무예 +1)';}}]},
      {t:'출정 명령',txt:'국경에서 적이 움직였다. 부대에 출정 명령이 떨어졌다.',opts:[
        {l:'출정한다 (전투)',f:p=>{startP1Quest(qb('국경 출정',{spear:4,cav:2,archer:3},90,12,{merit:2}));return null;}},
        {l:'꾀병을 부린다 (명성 −8)',f:p=>{p.fame=Math.max(0,p.fame-8);return '동료들이 수군거린다.';}}]},
      {t:'상관의 질투',txt:'당신의 공을 시기한 상관이 위험한 임무만 떠넘긴다.',opts:[
        {l:'윗선에 고발한다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,35)){p.spec.merit++;p.net+=4;return '상관이 좌천됐다! (무훈 +1, 인맥 +4)';}p.fame=Math.max(0,p.fame-5);return '오히려 역풍을 맞았다 (명성 −5)';}},
        {l:'묵묵히 견딘다 (무예 +2, 건강 −10)',f:p=>{p.st.무예+=2;p.health-=10;return '이를 악물고 버텼다.';}}]},
      {t:'군수품 횡령',txt:'보급관이 군수품을 빼돌리는 걸 봤다. 입막음으로 돈을 내민다.',opts:[
        {l:'돈을 받는다 (💰+120, 명성 −6)',f:p=>{p.gold+=120;p.fame=Math.max(0,p.fame-6);return '주머니가 두둑해졌다.';}},
        {l:'보고한다 (무훈 +1, 명성 +4)',f:p=>{p.spec.merit++;p.fame+=4;return '정의로운 병사로 이름이 났다.';}}]}
    ]
  },
  merchant:{
    title:'💰 상인의 길 — 상점과 교역',
    status:p=>`상점 <b>${p.spec.shops}</b>개 — 매달 💰${shopIncome(p)} 자동 수입 (상점 2·4·6개에서 보상)`,
    actions:[
      {l:'🏪 가게 열기',tip:p=>`💰−${shopCost(p)}, 매달 수입 +${Math.round(25*fitOf(p.home,'merchant'))}`,dis:p=>p.gold<shopCost(p)||p.spec.shops>=6,f:p=>{p.gold-=shopCost(p);p.spec.shops++;return `${p.spec.shops}번째 가게를 열었다!`;}},
      {l:'🐪 교역 원정',tip:'💰−100 투자, 내정에 따라 수익 (도적 습격 위험)',dis:p=>p.gold<100,f:p=>{p.gold-=100;
        if(Math.random()<.18){startP1Quest(qb('습격당한 교역 상단',{spear:3,cav:2,archer:1},220,6));return null;}
        const r=Math.round(100*(.6+Math.random()*1.3+(p.st.내정-30)/80));p.gold+=r;p.st.내정+=1;return `교역 원정 결과 💰${r} 회수 (${r>=100?'+':''}${r-100}), 내정 +1`;}}
    ],
    perks:[
      {k:'상인 길드',at:p=>p.spec.shops>=2,txt:'상인 길드에 가입했다 (인맥 +10)',f:p=>{p.net+=10;}},
      {k:'왕실 납품권',at:p=>p.spec.shops>=4,txt:'왕실 납품권을 따냈다 (💰+300)',f:p=>{p.gold+=300;}},
      {k:'무역 제국',at:p=>p.spec.shops>=6,txt:'무역 제국을 세웠다 (즉위 금 조건 −500)',f:()=>{}}
    ],
    monthly:(p)=>{p.gold+=shopIncome(p);},
    events:[
      {t:'시세 폭등',txt:'향신료 값이 폭등했다! 창고에 쌓아둔 물건을 팔 기회다.',opts:[
        {l:'다 판다',f:p=>{const g=60+p.spec.shops*50;p.gold+=g;return `💰+${g}`;}},
        {l:'더 오를 때까지 버틴다 (도박)',f:p=>{if(Math.random()<.5){const g=150+p.spec.shops*90;p.gold+=g;return `대박! 💰+${g}`;}return '값이 폭락했다… 아무것도 못 벌었다.';}}]},
      {t:'사기꾼',txt:'그럴듯한 보물 지도를 파는 상인이 나타났다.',opts:[
        {l:'꼼꼼히 따져본다 (내정 판정)',f:p=>{if(Math.random()<chk(p.st.내정,35)){p.gold+=80;p.fame+=3;return '사기를 간파하고 오히려 관청에 넘겨 포상금을 받았다 (💰+80)';}p.gold-=60;return '속았다… 💰−60';}},
        {l:'무시한다',f:()=> '현명한 선택이었을지도.'}]},
      {t:'경쟁 상인의 방해',txt:'경쟁 상단이 깡패를 고용해 가게를 협박한다.',opts:[
        {l:'맞서 싸운다 (전투)',f:p=>{startP1Quest(qb('깡패 소탕',{spear:4,archer:1},120,6));return null;}},
        {l:'돈으로 해결한다 (💰−80)',f:p=>{p.gold-=80;return '조용히 마무리됐다.';}}]},
      {t:'왕실 계약',txt:'왕실 조달관이 대규모 납품 계약을 제안한다.',opts:[
        {l:'협상한다 (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,35)){p.gold+=220;p.net+=6;return '계약 성사! 💰+220, 인맥 +6';}return '조건이 맞지 않아 결렬됐다.';}},
        {l:'거절한다',f:()=> '다음 기회를 노린다.'}]}
    ]
  },
  noble:{
    title:'📜 정치의 길 — 세 파벌',
    status:p=>{const s=p.spec;const c=v=>v>=70?'#7fd06a':v>=40?'#f0c050':'#ff8a8a';return `👑왕당파 <b style="color:${c(s.roy)}">${s.roy}</b> · 🏰귀족파 <b style="color:${c(s.nob)}">${s.nob}</b> · 🧑‍🌾민중파 <b style="color:${c(s.peo)}">${s.peo}</b><br><span class="sub">70 이상이면 매달 혜택: 왕당파 💰+30, 귀족파 인맥 +2, 민중파 무리 +1. 즉위하려면 세 파벌 평균 50 이상</span>`;},
    actions:[
      {l:'🍷 연회 개최',tip:'💰−50, 귀족파 +8, 인맥 +3',dis:p=>p.gold<50,f:p=>{p.gold-=50;p.spec.nob+=8;p.net+=3;return '화려한 연회로 귀족들의 환심을 샀다.';}},
      {l:'📨 백성 청원 처리',tip:'내정 판정 → 민중파 +10',f:p=>{if(Math.random()<chk(p.st.내정,30)){p.spec.peo+=10;p.fame+=2;return '청원을 해결해 백성들이 기뻐한다 (민중파 +10)';}p.spec.peo-=3;return '일을 그르쳤다 (민중파 −3)';}},
      {l:'🙇 왕실에 충성 서약',tip:'왕당파 +8, 민중파 −3',f:p=>{p.spec.roy+=8;p.spec.peo-=3;return '왕실의 신임을 얻었다.';}}
    ],
    perks:[{k:'파벌의 수장',at:p=>Math.max(p.spec.roy,p.spec.nob,p.spec.peo)>=80,txt:'한 파벌의 수장이 됐다 (매력 +5)',f:p=>{p.st.매력+=5;}}],
    monthly:(p,lg)=>{const s=p.spec;if(s.roy>=70)p.gold+=30;if(s.nob>=70)p.net+=2;if(s.peo>=70)p.band+=1;
      ['roy','nob','peo'].forEach(k=>{s[k]=Math.max(0,Math.min(100,s[k]+(s[k]>30?-1:s[k]<30?1:0)));});},
    crownX:p=>{const a=Math.round((p.spec.roy+p.spec.nob+p.spec.peo)/3);return[[`파벌 평균 50 (현재 ${a})`,a>=50]];},
    events:[
      {t:'스캔들',txt:'당신에 대한 추문이 퍼지기 시작했다.',opts:[
        {l:'정면 반박 (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,35)){p.fame+=4;return '오히려 인기가 올랐다 (명성 +4)';}p.fame=Math.max(0,p.fame-8);p.spec.peo-=10;return '추문이 사실처럼 굳었다 (명성 −8, 민중파 −10)';}},
        {l:'돈으로 덮는다 (💰−100)',f:p=>{p.gold-=100;return '소문이 잦아들었다.';}}]},
      {t:'정략결혼 제안',txt:'유력 가문이 혼인을 제안한다.',opts:[
        {l:'받아들인다 (인맥 +15, 귀족파 +15, 민중파 −10)',f:p=>{p.net+=15;p.spec.nob+=15;p.spec.peo-=10;return '두 가문이 손을 잡았다.';}},
        {l:'사랑을 택한다 (민중파 +8, 매력 +2)',f:p=>{p.spec.peo+=8;p.st.매력+=2;return '백성들이 낭만적인 이야기를 좋아한다.';}}]},
      {t:'암살 시도',txt:'밤길에 자객들이 덮쳐왔다!',opts:[
        {l:'싸운다 (전투)',f:p=>{startP1Quest(qb('자객 습격',{spear:2,archer:2,cav:1},60,8));return null;}},
        {l:'도망친다 (건강 −15)',f:p=>{p.health-=15;return '간신히 살아남았다.';}}]},
      {t:'세금 폭동',txt:'과도한 세금에 백성들이 들고일어났다.',opts:[
        {l:'백성 편에 선다 (민중파 +15, 왕당파 −15)',f:p=>{p.spec.peo+=15;p.spec.roy-=15;return '백성의 영웅이 됐지만 왕실의 눈 밖에 났다.';}},
        {l:'진압한다 (전투, 왕당파 +15, 민중파 −15)',f:p=>{p.spec.roy+=15;p.spec.peo-=15;startP1Quest(qb('폭동 진압',{spear:5,archer:2},70,4));return null;}}]}
    ]
  },
  mage:{
    title:'🔮 마법사의 길 — 비전 연구',
    status:p=>`비전 연구 <b>${p.spec.arcana}</b> · 습득 주문: ${['화염의 손','치유술','예지','대마도사의 인장'].filter(k=>hasPerk(p,k)).join(', ')||'없음'}<br><span class="sub">10: 화염의 손(전투 마법 피해 +25%) · 25: 치유술(매달 건강 +10) · 45: 예지(모든 판정 +10%) · 70: 대마도사의 인장</span>`,
    actions:[
      {l:'📖 주문 연구',tip:'비전 연구 +, 지략 +1',f:p=>{const g=2+Math.floor(p.st.지략/15);p.spec.arcana+=g;p.st.지략+=1;return `연구 진척 +${g}`;}},
      {l:'🗝 금지된 서고',tip:'성공: 지략 +6·연구 +6 / 실패: 건강 −25',f:p=>{if(Math.random()<.55+(p.st.지략-40)/100){p.st.지략+=6;p.spec.arcana+=6;return '금지된 지식을 손에 넣었다! (지략 +6, 연구 +6)';}p.health-=25;p.fame=Math.max(0,p.fame-2);return '저주받은 책이 정신을 갉아먹었다 (건강 −25)';}}
    ],
    perks:[
      {k:'화염의 손',at:p=>p.spec.arcana>=10,txt:'주문 습득: 화염의 손 (전투에서 마법 피해 +25%)',f:()=>{}},
      {k:'치유술',at:p=>p.spec.arcana>=25,txt:'주문 습득: 치유술 (매달 건강 +10)',f:()=>{}},
      {k:'예지',at:p=>p.spec.arcana>=45,txt:'주문 습득: 예지 (모든 판정 성공률 +10%)',f:()=>{}},
      {k:'대마도사의 인장',at:p=>p.spec.arcana>=70,txt:'대마도사의 인장을 얻었다 (지략 +8, 명성 +10)',f:p=>{p.st.지략+=8;p.fame+=10;}}
    ],
    monthly:p=>{if(hasPerk(p,'치유술'))p.health=Math.min(100,p.health+10);},
    events:[
      {t:'마력 폭주',txt:'연구실에서 마력이 폭주하기 시작했다!',opts:[
        {l:'제어한다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,40)){p.spec.arcana+=5;p.st.지략+=2;return '폭주를 다스리며 깨달음을 얻었다 (연구 +5, 지략 +2)';}p.health-=20;return '폭발에 휘말렸다 (건강 −20)';}},
        {l:'대피한다 (연구 −3)',f:p=>{p.spec.arcana=Math.max(0,p.spec.arcana-3);return '연구 자료 일부가 타버렸다.';}}]},
      {t:'마탑의 경쟁자',txt:'같은 마탑의 마법사가 마법 대결을 신청했다.',opts:[
        {l:'받아들인다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,38)){const f=addFame(p,8);p.spec.arcana+=3;return `압승! 명성 +${f}, 연구 +3`;}p.fame=Math.max(0,p.fame-4);return '체면을 구겼다 (명성 −4)';}},
        {l:'무시한다',f:()=> '시간 낭비다.'}]},
      {t:'고대 유물',txt:'유적 깊은 곳에서 마력을 띤 유물의 기척이 느껴진다. 수호자가 지키고 있다.',opts:[
        {l:'유적에 들어간다 (전투)',f:p=>{startP1Quest(qb('유적의 수호자',{spear:3,mage:2,archer:1},100,8,{arcana:8}));return null;}},
        {l:'위치 정보를 판다 (💰+100)',f:p=>{p.gold+=100;return '쏠쏠한 거래였다.';}}]},
      {t:'어둠의 계약',txt:'그림자 속 존재가 금지된 힘을 대가로 계약을 제안한다.',opts:[
        {l:'계약한다 (지략 +10, 연구 +10, 명성 −15)',f:p=>{p.st.지략+=10;p.spec.arcana+=10;p.fame=Math.max(0,p.fame-15);return '강해졌지만 사람들이 당신을 두려워한다.<br>'+giveUnique('u_cursed_blade','어둠의 계약');}},
        {l:'거부한다 (명성 +3)',f:p=>{p.fame+=3;return '유혹을 이겨냈다.';}}]}
    ]
  },
  rebel:{
    title:'🔥 반란의 길 — 지지와 수배',
    status:p=>`민중 지지 <b style="color:#7fd06a">${p.spec.support}</b> · 수배도 <b style="color:${p.spec.wanted>=60?'#ff6a6a':'#f0c050'}">${p.spec.wanted}</b><br><span class="sub">수배도 60 이상이면 토벌대가 쫓아옵니다. 즉위하려면 민중 지지 60 이상. 지지 30·60·85에서 보상</span>`,
    actions:[
      {l:'📣 선동 연설',tip:'매력 판정 → 지지 +8, 무리 +2, 수배 +6',f:p=>{if(Math.random()<chk(p.st.매력,30)){p.spec.support+=8;p.band+=2;p.spec.wanted+=6;return '연설에 군중이 열광했다! (지지 +8, 무리 +2)';}p.spec.wanted+=4;return '연설이 먹히지 않았다.';}},
      {l:'💰 귀족 창고 약탈',tip:'금 획득, 수배 +12, 지지 −4',f:p=>{const g=70+p.band*4;p.gold+=g;p.spec.wanted+=12;p.spec.support-=4;return `약탈 성공 💰+${g}`;}},
      {l:'🌲 숲에 은신',tip:'수배 −20, 건강 +10',f:p=>{p.spec.wanted=Math.max(0,p.spec.wanted-20);p.health=Math.min(100,p.health+10);return '한동안 숨어 지냈다.';}}
    ],
    perks:[
      {k:'민중의 영웅',at:p=>p.spec.support>=30,txt:'민중의 영웅으로 불린다 (무리 모집 비용 10)',f:()=>{}},
      {k:'봉기 준비',at:p=>p.spec.support>=60,txt:'봉기 준비 완료 (무리 +6)',f:p=>{p.band+=6;}},
      {k:'혁명의 불꽃',at:p=>p.spec.support>=85,txt:'혁명의 불꽃이 타오른다 (명성 +15)',f:p=>{p.fame+=15;}}
    ],
    monthly:(p,lg)=>{p.spec.wanted=Math.max(0,p.spec.wanted-2);p.spec.support=Math.max(0,Math.min(100,p.spec.support));},
    forced:p=>p.spec.wanted>=60&&Math.random()<.4?{t:'토벌대 습격',txt:`수배도 ${p.spec.wanted}! 왕실 토벌대가 은신처를 찾아냈다.`,opts:[
      {l:'맞서 싸운다 (전투)',f:p=>{startP1Quest(qb('왕실 토벌대',{spear:5,cav:2,archer:3},80,10,{wantedDown:30,support:6}));return null;}},
      {l:'흩어져 도망친다 (무리 −3, 수배 −15)',f:p=>{p.band=Math.max(1,p.band-3);p.spec.wanted-=15;return '간신히 빠져나갔다.';}}]}:null,
    crownX:p=>[[`민중 지지 60 (현재 ${p.spec.support})`,p.spec.support>=60]],
    events:[
      {t:'밀고자',txt:'무리 안에 왕실 첩자가 있다는 소문이 돈다.',opts:[
        {l:'찾아낸다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,32)){p.spec.wanted=Math.max(0,p.spec.wanted-10);p.net+=3;return '첩자를 잡아 역정보를 흘렸다 (수배 −10)';}p.spec.wanted+=15;return '첩자가 은신처를 알려버렸다 (수배 +15)';}},
        {l:'모두를 믿는다',f:p=>{p.band+=1;return '의리 있는 두목이라는 평판이 생겼다 (무리 +1)';}}]},
      {t:'굶주린 마을',txt:'세금에 시달린 마을이 굶고 있다.',opts:[
        {l:'약탈품을 나눠준다 (💰−40, 지지 +12)',f:p=>{p.gold-=40;p.spec.support+=12;return '마을 사람들이 당신 편이 됐다.';}},
        {l:'지나친다',f:p=>{p.spec.support-=3;return '소문은 빨리 퍼진다 (지지 −3)';}}]},
      {t:'왕실의 회유',txt:'왕실이 사면과 돈을 줄 테니 무리를 해산하라고 한다.',opts:[
        {l:'받아들이는 척한다 (💰+200, 수배 0, 지지 −20)',f:p=>{p.gold+=200;p.spec.wanted=0;p.spec.support-=20;return '배신자라는 손가락질을 받는다.';}},
        {l:'사신을 돌려보낸다 (지지 +8)',f:p=>{p.spec.support+=8;return '굴하지 않는 지도자라는 명성이 퍼졌다.';}}]},
      {t:'감옥 습격',txt:'동지들이 감옥에 갇혀 처형을 기다린다.',opts:[
        {l:'구출한다 (전투)',f:p=>{startP1Quest(qb('감옥 습격',{spear:4,archer:3},40,10,{band:5,support:8}));return null;}},
        {l:'때를 기다린다 (지지 −5)',f:p=>{p.spec.support-=5;return '동지를 버렸다는 비난이 일었다.';}}]}
    ]
  }
};
const shopCost=p=>Math.round(200*(1+p.spec.shops*.5));
const shopIncome=p=>Math.round(p.spec.shops*25*fitOf(p.home,'merchant'));
const ERAS={
  war:{n:'전란의 시대',txt:'전투 의뢰 보상 +30%, 국경 분쟁·출정 사건이 잦음'},
  gold:{n:'황금 시대',txt:'일·장사 수입 +30%'},
  magic:{n:'마법 부흥기',txt:'지략 훈련 +1, 마법 관련 사건이 잦음'},
  chaos:{n:'혼돈의 시대',txt:'특수 사건이 2배 자주 일어남'},
  peace:{n:'평화의 시대',txt:'매달 건강 +5 추가, 사교 모임 효과 +50%'}
};
const eraIs=(p,k)=>p.era===k;
const SPECIAL=[
  {id:'kingdead',t:'왕의 서거',cond:p=>p.month>=8,txt:'나라의 왕이 갑자기 세상을 떠났다. 왕위를 두고 나라가 들끓는다.',opts:[
    {l:'왕세자를 지지한다 (인맥 +12, 명성 +5, 정치: 왕당파 +20)',f:p=>{p.net+=12;p.fame+=5;if(p.route==='noble')p.spec.roy+=20;return '새 왕실이 당신을 기억할 것이다.';}},
    {l:'혼란을 틈탄다 (무리 +6, 명성 +8, 반란: 지지 +15)',f:p=>{p.band+=6;p.fame+=8;if(p.route==='rebel')p.spec.support+=15;return '혼란 속에서 세력을 키웠다.';}}]},
  {id:'dragon',t:'용의 출현',cond:p=>p.month>=12&&p.rank>=2,txt:'북쪽 산맥에서 거대한 용이 내려와 마을을 불태우고 있다. 용의 둥지엔 보물이 가득하다는데…',opts:[
    {l:'용 토벌대를 이끈다 (대규모 전투, 💰500 명성 40)',f:p=>{startP1Quest(qb('용과 그 무리',{spear:6,cav:4,archer:4,mage:3},500,40,{uni:'u_dragon_mail'}));return null;}},
    {l:'피난민을 돕는다 (명성 +6, 💰−30)',f:p=>{p.fame+=6;p.gold-=30;return '수많은 목숨을 구했다.';}}]},
  {id:'war',t:'전쟁 발발',cond:p=>p.month>=6,txt:'이웃 나라와 전면전이 시작됐다. 앞으로 6개월간 나라가 전시 체제가 된다. (전투 의뢰 보상 +50%)',opts:[
    {l:'애국심을 보인다 (명성 +5, 군인: 무훈 +2)',f:p=>{p.flags.war=6;p.fame+=5;if(p.route==='soldier')p.spec.merit+=2;return '전쟁의 시대가 열렸다.';}},
    {l:'전쟁 특수를 노린다 (💰+150, 상인: 상점 수입 2배 효과 한 번)',f:p=>{p.flags.war=6;p.gold+=150;if(p.route==='merchant')p.gold+=shopIncome(p);return '전쟁은 누군가에겐 기회다.';}}]},
  {id:'famine',t:'대기근',cond:p=>p.month>=5,txt:'흉작이 겹쳐 3개월간 대기근이 닥친다. (무리 유지비 +50%, 일 수입 −40%)',opts:[
    {l:'곳간을 연다 (💰−100, 명성 +15, 정치: 민중파 +15, 반란: 지지 +15)',f:p=>{p.flags.famine=3;p.gold-=100;p.fame+=15;if(p.route==='noble')p.spec.peo+=15;if(p.route==='rebel')p.spec.support+=15;return '굶주린 이들이 당신을 성자라 부른다.';}},
    {l:'곡물 투기 (💰+250, 명성 −10)',f:p=>{p.flags.famine=3;p.gold+=250;p.fame=Math.max(0,p.fame-10);return '배를 불렸지만 원성이 자자하다.';}}]},
  {id:'blood',t:'숨겨진 혈통',cond:p=>p.rank>=1&&p.month>=10,txt:'늙은 유모가 임종 직전, 당신이 옛 왕가의 핏줄이라고 털어놓았다.',opts:[
    {l:'세상에 알린다 (즉위 명성 조건 −20, 인맥 +10)',f:p=>{p.flags.blood=true;p.net+=10;return '왕가의 피가 흐른다는 소문이 퍼졌다!';}},
    {l:'비밀로 간직한다 (매력 +3, 지략 +2)',f:p=>{p.st.매력+=3;p.st.지략+=2;return '언젠가 쓸 날이 올 것이다.';}}]},
  {id:'prince',t:'망명 왕자',cond:p=>p.month>=9,txt:'쫓기는 이웃 나라의 왕자가 당신에게 숨겨달라고 애원한다. 그를 노리는 추격대가 있다.',opts:[
    {l:'보호한다 (영웅 이상 동료 합류, 추격대와 전투)',f:p=>{const h=genHero({rarity:rint(2,3),lv:rint(3,5)});h.loyalty=80;h.name=`망명 왕자 ${h.name}`;
      if(heroes.filter(x=>!x.king).length<3)heroes.push(h);else p1Log(p,'동료 자리가 가득 차 왕자는 떠났다…');startP1Quest(qb('왕자 추격대',{cav:3,spear:3,archer:2},100,12,{uni:'u_prince_ring'}));return null;}},
    {l:'추격대에 넘긴다 (💰+200, 명성 −6)',f:p=>{p.gold+=200;p.fame=Math.max(0,p.fame-6);return '은화 주머니가 묵직하다.';}}]},
  {id:'comet',t:'붉은 혜성',cond:p=>true,txt:'밤하늘에 붉은 혜성이 나타나 사람들이 동요한다.',opts:[
    {l:'"새 왕이 날 징조다!" (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,40)){p.fame+=15;p.net+=5;return '사람들이 당신을 징조의 주인공으로 믿기 시작했다! (명성 +15)';}p.fame=Math.max(0,p.fame-5);return '허풍쟁이 취급을 받았다 (명성 −5)';}},
    {l:'조용히 지켜본다',f:p=>{p.flags.comet=1;return '혜성은 사흘 밤 동안 빛나다 사라졌다. 마탑 학자들이 떨어진 파편을 찾고 있다는 소문이 돈다.';}}]},
  {id:'horde',t:'괴물 대군',cond:p=>p.month>=15,txt:'변경의 숲에서 괴물 대군이 몰려온다. 나라가 용사를 찾는다.',opts:[
    {l:'선봉에 선다 (대규모 전투, 💰300 명성 25)',f:p=>{startP1Quest(qb('괴물 대군',{spear:7,cav:3,archer:3,mage:2},300,25,{uni:'u_goblin_axe'}));return null;}},
    {l:'후방을 지킨다 (명성 +3)',f:p=>{p.fame+=3;return '누군가는 뒤를 지켜야 한다.';}}]},
  {id:'tournament',t:'대륙 무술 대회',cond:p=>p.month>=10,txt:'대륙 전역의 강자들이 모이는 대회가 열린다. 우승자에겐 명예와 황금 검이.',opts:[
    {l:'출전한다 (무예·통솔 판정 2단계)',f:p=>{let w=0;if(Math.random()<chk(p.st.무예,40))w++;if(w&&Math.random()<chk(p.st.통솔,40))w++;
      if(w===2){p.fame+=25;p.gold+=300;p.st.무예+=3;return '🏆 대륙 제일의 용사! 명성 +25, 💰+300<br>'+giveUnique('u_tournament','무술 대회 우승');}p.fame+=w*5;return w?'준결승까지 올랐다 (명성 +5)':'1회전 탈락…';}},
    {l:'관전한다 (무예 +1, 통솔 +1)',f:p=>{p.st.무예+=1;p.st.통솔+=1;return '강자들의 싸움에서 배웠다.';}}]}
];
P1EVENTS.push(
  {t:'떠돌이 음유시인',txt:'음유시인이 돈만 주면 당신의 무용담을 노래로 만들어 주겠다고 한다.',opts:[
    {l:'노래를 의뢰한다 (💰−20, 명성 +5)',f:p=>{p.gold-=20;p.fame+=5;return '당신의 노래가 술집마다 울려 퍼진다.';}},
    {l:'사양한다',f:()=> '노래는 다른 영웅을 찾아갔다.'}]},
  {t:'소매치기',txt:'시장 한복판에서 누군가 주머니를 노린다!',opts:[
    {l:'붙잡는다 (지략 판정)',f:p=>{if(Math.random()<chk(p.st.지략,25)){p.fame+=2;return '도둑을 붙잡아 경비대에 넘겼다 (명성 +2)';}p.gold-=30;return '놓쳤다… 💰−30';}},
    {l:'돈주머니를 꼭 쥔다',f:()=> '아무 일도 없었다.'}]},
  {t:'수상한 지도',txt:'술 취한 선원이 보물 지도를 싸게 팔겠다고 한다.',opts:[
    {l:'산다 (💰−30, 50%로 💰+150)',f:p=>{p.gold-=30;if(Math.random()<.5){p.gold+=150;return '진짜였다! 💰+150';}return '가짜였다…';}},
    {l:'웃어넘긴다',f:()=> '선원은 투덜거리며 갔다.'}]},
  {t:'늑대 떼',txt:'밤길에 늑대 떼가 무리를 둘러쌌다.',opts:[
    {l:'싸운다 (전투)',f:p=>{startP1Quest(qb('늑대 떼',{cav:4},40,4,{uniCh:['u_wolf_cape',.3]}));return null;}},
    {l:'횃불로 쫓는다 (건강 −10)',f:p=>{p.health-=10;return '물리긴 했지만 쫓아냈다.';}}]},
  {t:'대장장이의 부탁',txt:'대장장이가 급한 납품을 대신 전해달라고 한다.',opts:[
    {l:'돕는다 (💰+40, 무예 +1)',f:p=>{p.gold+=40;p.st.무예+=1;return '답례로 칼 다루는 요령도 배웠다.';}},
    {l:'바쁘다',f:()=> '대장장이는 한숨을 쉬었다.'}]},
  {t:'연애편지',txt:'누군가 당신에게 연애편지를 보냈다.',opts:[
    {l:'만나본다 (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,30)){p.net+=5;p.health+=10;return '좋은 인연이 생겼다 (인맥 +5, 건강 +10)';}p.st.매력=Math.max(1,p.st.매력-1);return '어색한 만남이었다…';}},
    {l:'정중히 거절한다',f:()=> '마음이 조금 쓰였다.'}]},
  {t:'버려진 성',txt:'오래전 버려진 성에 보물이 남아있다는 소문이 있다.',opts:[
    {l:'탐험한다 (50%: 💰+100 / 50%: 건강 −15)',f:p=>{if(Math.random()<.5){p.gold+=100;return '숨겨진 금고를 찾았다! 💰+100';}p.health-=15;return '무너진 천장에 다쳤다 (건강 −15)';}},
    {l:'유령 이야기가 무섭다',f:()=> '현명했을지도.'}]},
  {t:'왕실 사냥 대회',txt:'귀족들이 모이는 사냥 대회에 초대받았다.',opts:[
    {l:'참가한다 (통솔 판정)',f:p=>{if(Math.random()<chk(p.st.통솔,32)){p.net+=8;p.fame+=4;return '사냥의 영웅! 인맥 +8, 명성 +4';}p.net+=2;return '빈손이었지만 얼굴은 알렸다 (인맥 +2)';}},
    {l:'불참한다',f:()=> '귀족들 놀이엔 관심 없다.'}]},
  {t:'홍수',txt:'강이 범람해 마을이 잠겼다.',opts:[
    {l:'구조를 돕는다 (건강 −10, 명성 +6)',f:p=>{p.health-=10;p.fame+=6;return '사람들을 구해냈다.';}},
    {l:'높은 곳으로 피한다',f:()=> '물은 사흘 뒤 빠졌다.'}]},
  {t:'옛 스승',txt:'어린 시절 스승이 찾아와 마지막 가르침을 주겠다고 한다.',opts:[
    {l:'무예를 배운다 (무예 +3)',f:p=>{p.st.무예+=3;return '스승의 비기를 전수받았다.';}},
    {l:'지혜를 배운다 (지략 +3)',f:p=>{p.st.지략+=3;return '스승의 지혜를 이어받았다.';}}]},
  {t:'모욕적인 결투',txt:'오만한 귀족이 공개석상에서 당신을 모욕하고 결투를 신청했다.',cond:p=>p.rank>=2,opts:[
    {l:'받아들인다 (무예 판정)',f:p=>{if(Math.random()<chk(p.st.무예,38)){const f=addFame(p,10);return `귀족을 꺾었다! 명성 +${f}`;}p.health-=20;p.fame=Math.max(0,p.fame-5);return '패배했다… (건강 −20, 명성 −5)';}},
    {l:'무시한다 (명성 −4)',f:p=>{p.fame=Math.max(0,p.fame-4);return '겁쟁이라는 소리를 들었다.';}}]},
  {t:'밀수꾼',txt:'밀수꾼 일당이 한몫 끼라고 제안한다.',opts:[
    {l:'한몫 낀다 (💰+120, 명성 −5)',f:p=>{p.gold+=120;p.fame=Math.max(0,p.fame-5);return '쉽게 번 돈이다.';}},
    {l:'신고한다 (명성 +5)',f:p=>{p.fame+=5;return '경비대가 밀수꾼을 잡았다.';}}]},
  {t:'외국 사절단',txt:'이웃 나라 사절단의 안내를 맡게 됐다.',cond:p=>p.rank>=2,opts:[
    {l:'성심껏 모신다 (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,35)){p.net+=10;return '외국 귀빈들과 친분을 쌓았다 (인맥 +10)';}p.net+=2;return '무난하게 끝났다 (인맥 +2)';}},
    {l:'대충 한다',f:()=> '사절단은 별 인상 없이 돌아갔다.'}]},
  {t:'점쟁이',txt:'수상한 점쟁이가 운명을 봐주겠다고 한다.',opts:[
    {l:'점을 본다 (💰−10)',f:p=>{p.gold-=10;if(Math.random()<.5){const k=pick(KSTAT);p.st[k]+=2;return `"그대의 ${k}에 별이 뜬다" — 자신감이 붙었다 (${k} +2)`;}return '"…모르겠군." 돈만 날렸다.';}},
    {l:'믿지 않는다',f:()=> '점쟁이가 의미심장하게 웃었다.'}]},
  {t:'고아원 후원',txt:'전쟁고아를 돌보는 고아원이 후원자를 찾는다.',cond:p=>p.gold>=100,opts:[
    {l:'💰100 후원 (명성 +10)',f:p=>{p.gold-=100;p.fame+=10;return '아이들이 당신의 이름을 부른다.';}},
    {l:'💰20만 낸다 (명성 +2)',f:p=>{p.gold-=20;p.fame+=2;return '작은 정성이다.';}}]},
  {t:'술자리 내기',txt:'술집에서 누가 더 마시나 내기가 벌어졌다.',opts:[
    {l:'참가한다 (무예 판정, 이기면 💰+60)',f:p=>{if(Math.random()<chk(p.st.무예,30)){p.gold+=60;p.net+=2;return '마지막까지 버텼다! 💰+60';}p.health-=10;return '바닥에 쓰러졌다 (건강 −10)';}},
    {l:'구경한다',f:()=> '흥겨운 밤이었다.'}]},
  {t:'떠돌이 마법사',txt:'떠돌이 마법사가 신기한 물약을 판다.',opts:[
    {l:'산다 (💰−40, 건강 +30)',f:p=>{p.gold-=40;p.health+=30;let x='';if(p.era==='magic'&&Math.random()<.4)x='<br>마법사가 답례로 달빛이 깃든 완드를 건넨다!<br>'+giveUnique('u_moon_wand','떠돌이 마법사의 답례');return '몸이 가벼워졌다.'+x;}},
    {l:'의심스럽다',f:()=> '마법사는 연기처럼 사라졌다.'}]},
  {t:'다리 붕괴',txt:'마을의 낡은 다리가 무너졌다. 누군가 나서서 재건해야 한다.',opts:[
    {l:'공사를 지휘한다 (내정 판정)',f:p=>{if(Math.random()<chk(p.st.내정,30)){p.fame+=6;p.st.내정+=1;p.gold+=30;return '튼튼한 다리가 생겼다 (명성 +6, 내정 +1)';}p.gold-=20;return '공사비만 들었다 (💰−20)';}},
    {l:'남에게 맡긴다',f:()=> '다리는 반년 뒤에야 완성됐다.'}]}
);
P1EVENTS.push(
  {t:'도박장',txt:'뒷골목 도박장에서 큰 판이 벌어지고 있다.',opts:[
    {l:'💰50을 건다 (45%로 두 배)',f:p=>{if(p.gold<50)return '판돈이 없다.';p.gold-=50;if(Math.random()<.45){p.gold+=100;return '땄다! 💰+50';}return '날렸다… 💰−50';}},
    {l:'구경만 한다',f:()=> '현명했다.'}]},
  {t:'고아 소년',txt:'굶주린 소년이 당신을 졸졸 따라온다.',opts:[
    {l:'거둬준다 (무리 +1, 명성 +2, 💰−10)',f:p=>{p.band+=1;p.fame+=2;p.gold-=10;return '소년은 충직한 시종이 됐다.';}},
    {l:'빵 한 조각을 준다',f:p=>{p.st.매력+=1;return '소년이 환하게 웃었다 (매력 +1)';}}]},
  {t:'유행병',txt:'마을에 열병이 돈다.',opts:[
    {l:'약을 산다 (💰−30)',f:p=>{p.gold-=30;return '무사히 넘겼다.';}},
    {l:'버틴다',f:p=>{if(Math.random()<.5){p.health-=25;return '앓아누웠다 (건강 −25)';}return '운 좋게 피해 갔다.';}}]},
  {t:'길 잃은 귀족 영애',txt:'숲에서 길을 잃은 귀족 영애를 만났다.',opts:[
    {l:'저택까지 호위한다 (매력 판정)',f:p=>{if(Math.random()<chk(p.st.매력,30)){p.net+=8;p.gold+=50;return '가문의 은인이 됐다 (인맥 +8, 💰+50)';}p.net+=2;return '무사히 데려다줬지만 냉담했다 (인맥 +2)';}},
    {l:'길만 알려준다',f:()=> '그녀는 고개만 까딱했다.'}]},
  {t:'폭풍우',txt:'거센 폭풍우가 몰아친다.',opts:[
    {l:'여관에 묵는다 (💰−15)',f:p=>{p.gold-=15;return '따뜻하게 잤다.';}},
    {l:'노숙한다 (건강 −10)',f:p=>{p.health-=10;return '감기에 걸렸다.';}}]},
  {t:'고대 유적',txt:'사냥꾼이 숲속에서 무너진 유적을 발견했다고 한다.',opts:[
    {l:'탐사한다 (전투)',f:p=>{startP1Quest(qb('유적 탐사',{spear:3,archer:2,mage:1},150,10));return null;}},
    {l:'관심 없다',f:()=> '전설은 전설일 뿐.'}]},
  {t:'명마 판매',txt:'떠돌이 상인이 훌륭한 군마를 판다.',opts:[
    {l:'산다 (💰−120, 무예 +2, 통솔 +2)',f:p=>{if(p.gold<120)return '돈이 모자랐다.';p.gold-=120;p.st.무예+=2;p.st.통솔+=2;return '명마와 함께라면 어디든 간다.';}},
    {l:'사지 않는다',f:()=> '말은 떠났다.'}]},
  {t:'현상수배범',txt:'악명 높은 도적 두목에게 현상금이 걸렸다.',opts:[
    {l:'잡으러 간다 (전투)',f:p=>{startP1Quest(qb('현상수배범 체포',{spear:4,cav:1,archer:2},160,9));return null;}},
    {l:'다른 사람에게 맡긴다',f:()=> '누군가 잡겠지.'}]},
  {t:'성지 순례',txt:'순례단이 성지로 떠나며 동행을 권한다.',opts:[
    {l:'함께 간다 (건강 +25, 매력 +2, 💰−20)',f:p=>{p.health+=25;p.st.매력+=2;p.gold-=20;return '마음이 맑아졌다.';}},
    {l:'일이 바쁘다',f:()=> '다음에.'}]},
  {t:'용병단 합류 제안',txt:'떠돌이 용병 몇 명이 당신 밑에서 일하고 싶어 한다.',opts:[
    {l:'고용한다 (💰−60, 무리 +5)',f:p=>{if(p.gold<60)return '돈이 모자랐다.';p.gold-=60;p.band+=5;return '무리가 늘었다.';}},
    {l:'거절한다',f:()=> '그들은 다른 주인을 찾아갔다.'}]},
  {t:'책 상인',txt:'희귀한 책을 파는 상인을 만났다.',opts:[
    {l:'병법서를 산다 (💰−40, 통솔 +3)',f:p=>{if(p.gold<40)return '돈이 모자랐다.';p.gold-=40;p.st.통솔+=3;return '병법을 익혔다.';}},
    {l:'경제서를 산다 (💰−40, 내정 +3)',f:p=>{if(p.gold<40)return '돈이 모자랐다.';p.gold-=40;p.st.내정+=3;return '셈이 밝아졌다.';}}]},
  {t:'옛 친구',txt:'어릴 적 친구가 찾아와 돈을 빌려달라고 한다.',opts:[
    {l:'빌려준다 (💰−50, 60%로 나중에 은혜)',f:p=>{p.gold-=50;if(Math.random()<.6){p.net+=6;p.gold+=80;return '친구가 성공해 갚고, 인맥도 소개해줬다 (💰+80, 인맥 +6)';}return '친구는 연락이 끊겼다…';}},
    {l:'거절한다',f:p=>{p.st.매력=Math.max(1,p.st.매력-1);return '어색하게 헤어졌다 (매력 −1)';}}]}
);
const chk=(v,dc)=>Math.max(.1,Math.min(.95,.5+(v-dc)/40+(prog.p1&&hasPerk(prog.p1,'예지')?.1:0)));
const PP=()=>prog.p1;
const sm=()=>SIZE_MUL[NINFO[PP().home].size];
const fitOf=(home,route)=>NINFO[home].fit[route];
const addFame=(p,x)=>{const v=Math.max(0,Math.round(x*fitOf(p.home,p.route)));p.fame+=v;return v;};
function starsOf(home,route){const f=fitOf(home,route);if(!f)return '불가';const v=f/SIZE_MUL[NINFO[home].size];return '★'.repeat(v>=1.7?3:v>=1.15?2:1)+(v<.85?' (험난)':'');}
function reqList(p,req){
  const out=[],m=sm();
  if(req.fame)out.push([`명성 ${Math.round(req.fame*m)}`,p.fame>=Math.round(req.fame*m)]);
  if(req.gold)out.push([`금 ${Math.round(req.gold*m)}`,p.gold>=Math.round(req.gold*m)]);
  if(req.net)out.push([`인맥 ${req.net}`,p.net>=req.net]);
  if(req.band)out.push([`무리 ${req.band}명`,p.band>=req.band]);
  if(req.wins)out.push([`전투 승리 ${req.wins}회`,p.wins>=req.wins]);
  if(req.st)Object.entries(req.st).forEach(([k,v])=>out.push([`${k} ${v}`,p.st[k]>=v]));
  return out;
}
const reqOk=(p,req)=>reqList(p,req).every(x=>x[1]);
const ageOf=p=>18+Math.floor(p.month/12);
function genQuests(p){
  const lv=p.rank+Math.floor(p.month/10);
  p.quests=[];const pool=[...QUESTS].sort(()=>Math.random()-.5).slice(0,3);
  pool.forEach(q=>{const o={...q,lv};
    if(q.battle){o.battle={};ORDER.forEach(t=>{if(q.battle[t])o.battle[t]=Math.max(1,Math.round(q.battle[t]*(1+lv*.4)));});}
    if(q.check)o.dc=q.dc+lv*6;
    o.gold=Math.round(q.gold*(1+lv*.35)*.7);o.fame=Math.round(q.fame*(1+lv*.2));
    if(q.battle){const m=(p.era==='war'?1.3:1)*(p.flags&&p.flags.war>0?1.5:1);o.gold=Math.round(o.gold*m);o.fame=Math.round(o.fame*m);}
    p.quests.push(o);});
}
function genCompanions(p){p.pool=[0,1,2].map(()=>genHero({rarity:Math.random()<.75?0:1,lv:rint(1,2+p.rank)}));}
function syncMe(){
  const p=PP(),me=heroes.find(h=>h.king);if(!me)return;
  me.name=p.name;const ec=p.eqciv||{},b_=k=>p.st[k]-(ec[k]||0);me.base={STR:Math.round(b_('무예')*.55),VIT:Math.round(b_('무예')*.45+20),LEAD:Math.round(b_('통솔')*.6),INT:Math.round(b_('지략')*.6)};
}
function bandCounts(p){
  const c={spear:0,cav:0,archer:0,mage:0},comp=COMP[p.route];let left=p.band;
  ORDER.forEach(t=>{c[t]=Math.floor(p.band*(comp[t]||0));left-=c[t];});
  const keys=ORDER.filter(t=>comp[t]).sort((a,b)=>(comp[b]||0)-(comp[a]||0));let i=0;
  while(left>0){c[keys[i%keys.length]]++;left--;i++;}
  return c;
}
/* ---------- 1페이즈: 마을 (자유 이동 · 건물 · 주 단위 시간) ---------- */
const WK=4;
const TOWNB=[
  {id:'castle',n:'왕성',ic:'🏰',x:800,y:292,kind:'castle'},
  {id:'barracks',n:'병영·훈련장',ic:'⚔',x:330,y:470,kind:'barracks'},
  {id:'tavern',n:'선술집',ic:'🍺',x:575,y:470,kind:'tavern'},
  {id:'board',n:'의뢰 게시판',ic:'📋',x:880,y:482,kind:'board'},
  {id:'temple',n:'신전',ic:'⛪',x:1060,y:470,kind:'temple'},
  {id:'library',n:'학당',ic:'📚',x:1290,y:470,kind:'library'},
  {id:'tower',n:'마탑',ic:'🔮',x:1500,y:400,kind:'tower'},
  {id:'home',n:'내 집',ic:'🏠',x:230,y:690,kind:'home'},
  {id:'alley',n:'뒷골목',ic:'🕳',x:560,y:750,kind:'alley'},
  {id:'market',n:'시장',ic:'⚖',x:1010,y:660,kind:'market'},
  {id:'manor',n:'귀족 저택',ic:'🏛',x:1310,y:740,kind:'manor'},
  {id:'gate',n:'성문',ic:'🚪',x:800,y:884,kind:'gate'}
];
const TFLAV={
  castle:'왕과 귀족들이 머무는 성. 여기서 승진을 신청하고, 때가 되면 왕좌에 도전합니다.',
  barracks:'병사들의 함성이 끊이지 않는 곳. 무예와 통솔을 단련합니다.',
  tavern:'소문과 사람이 모이는 곳. 인맥을 넓히고, 무리를 모으고, 동료를 찾습니다.',
  board:'광장의 게시판. 사람들이 맡긴 일거리가 붙어 있습니다. 매달 새 의뢰가 붙어요.',
  temple:'조용한 기도 소리. 상처를 치료하고 봉사로 마음을 닦습니다.',
  library:'책 냄새가 가득한 학당. 지략과 내정을 공부합니다.',
  tower:'하늘을 찌르는 마법사들의 탑.',
  home:'작지만 내 집. 쉬면 건강이 돌아옵니다.',
  alley:'해가 들지 않는 골목. 수상한 거래와 정보가 오갑니다.',
  market:'온갖 물건과 흥정 소리. 장사꾼들의 무대입니다.',
  manor:'귀족 가문의 저택. 출입하려면 얼굴이 알려져 있어야 합니다.',
  gate:'바깥으로 나가는 문. 근교로 사냥을 나가거나, 다른 나라로 떠날 수 있습니다.'
};
/* ---------- 도시(지역) ---------- */
const CITIES={
  1:[{n:'베른 성채',t:'capital',b:'forest'},{n:'늑대골',t:'forest',b:'forest'},{n:'잿빛 광산촌',t:'mountain',b:'highland'}],
  2:[{n:'그라센 황도',t:'capital',b:'plains'},{n:'은빛 항구',t:'coast',b:'plains'},{n:'황금 들판',t:'farm',b:'plains'},{n:'철벽 요새',t:'fort',b:'highland'},{n:'루벤 강변',t:'river',b:'river'},{n:'동방 교역소',t:'trade',b:'plains'}],
  3:[{n:'아르델',t:'capital',b:'river'},{n:'카멜 항구',t:'coast',b:'river'},{n:'포도원 마을',t:'farm',b:'plains'}],
  4:[{n:'솔라리스 마도시',t:'capital',b:'highland'},{n:'별빛 호숫가',t:'river',b:'river'},{n:'수정 광산',t:'mountain',b:'highland'},{n:'현자의 숲',t:'forest',b:'forest'}],
  5:[{n:'카르둔',t:'capital',b:'marsh'},{n:'안개 늪 마을',t:'marsh',b:'marsh'},{n:'붉은 항구',t:'coast',b:'marsh'},{n:'국경 요새',t:'fort',b:'plains'}]
};
const CTYPE={
  capital:{n:'수도',ic:'👑',d:'왕성이 있는 큰 도시. 왕좌 도전은 수도에서만. 사람과 일거리가 많다.',job:{},npc:8},
  coast:{n:'해안 도시',ic:'⚓',d:'바다와 항구. 상인 일 +25%, 바다 낚시·무역선 일거리.',job:{merchant:1.25},npc:6},
  mountain:{n:'산골 광산촌',ic:'⛏',d:'바위산과 광산. 군인 일 +10%, 광산 일, 금속 장비가 흔하다.',job:{soldier:1.1},npc:5},
  forest:{n:'숲 마을',ic:'🌲',d:'깊은 숲. 반란 일 +15%, 사냥이 잘 되고 나무하기 일거리.',job:{rebel:1.15},npc:5},
  river:{n:'강변 마을',ic:'🌊',d:'큰 강과 다리. 상인 일 +10%, 강 낚시.',job:{merchant:1.1},npc:5},
  farm:{n:'농촌',ic:'🌾',d:'넓은 밭. 사교 비용이 싸고 농사일 돕기, 인심이 좋다.',job:{noble:1.05},npc:5},
  marsh:{n:'늪지 마을',ic:'🐸',d:'안개 낀 늪. 반란·마법 일 +10%, 약초 채집.',job:{rebel:1.1,mage:1.1},npc:5},
  fort:{n:'요새 도시',ic:'🏯',d:'국경의 요새. 군인 일 +30%, 전투 의뢰가 많고 수비 훈련.',job:{soldier:1.3},npc:5},
  trade:{n:'교역 도시',ic:'📦',d:'대상단의 교차로. 상인 일 +35%, 상점 물건이 많다.',job:{merchant:1.35},npc:6}
};
const cityOf=p=>CITIES[p.home][p.city||0]||CITIES[p.home][0];
const isCap=p=>cityOf(p).t==='capital';
const cityDist=(a,b)=>Math.abs(a-b)<=1||a===0||b===0?1:2;
/* ---------- 캐릭터 스프라이트 (Ninja Adventure 16x16, 4방향) ---------- */
const CIMG={};
const cimg=src=>CIMG[src]||(CIMG[src]=Object.assign(new Image(),{src}));
const ROUTE_CH={soldier:'Knight',merchant:'Villager4',noble:'Noble',mage:'SorcererOrange',rebel:'Hunter'};
const FOLK_CH=['Villager','Villager2','Villager3','Villager5','Villager6','Woman','OldMan','OldMan2','OldWoman','Child','Boy','EggGirl','Monk2','Eskimo'];
const dirOf=(dx,dy)=>Math.abs(dx)>Math.abs(dy)?(dx<0?2:3):(dy<0?1:0);
function drawChar(ch,x,y,dir,mv,t){
  const im=cimg(`assets/chars/${ch}/SpriteSheet.png`);
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(x,y,9,3,0,0,7);ctx.fill();
  if(!im.complete||!im.naturalWidth)return;
  const fr=mv?Math.floor(t/130+x*.01)%4:0,bob=mv?0:Math.round(Math.sin(t/500+x)*.6);
  ctx.drawImage(im,(dir||0)*16,fr*16,16,16,Math.round(x-16),Math.round(y-30+bob),32,32);
}
function drawAnimal(a,x,y,face,mv,t){
  const im=cimg(`assets/animals/${a}.png`);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x,y,7,2.5,0,0,7);ctx.fill();
  if(!im.complete||!im.naturalWidth)return;
  const fr=mv?Math.floor(t/180)%2:Math.floor(t/900)%2;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));if(face>0)ctx.scale(-1,1);ctx.drawImage(im,fr*16,0,16,16,-14,-26,28,28);ctx.restore();
}
const faceImg=ch=>`<img class="pix face" src="assets/chars/${ch}/Faceset.png">`;
/* ---------- NPC ---------- */
const ROLES={
  friend:{n:'먼 곳의 지인',at:'tavern',ch:['Villager'],only:['__none__'],l:['오랜만이야! 잘 지냈어?'],svc:null},
  inn:{n:'여관 주인',at:'tavern',ch:['Villager2','OldMan2','Woman'],l:['오늘도 손님이 많구먼. 한잔 하고 가게.','요즘 떠도는 소문? 공짜로는 안 되지~ 농담이야.','이 동네 사람 이야기는 다 내 귀로 들어온다네.'],svc:'rumor'},
  smith:{n:'대장장이',at:'barracks',ch:['Caveman','FighterWhite','Villager3'],l:['쇠는 두드릴수록 단단해지지. 사람도 마찬가지야.','장비 손볼 거 있으면 가져와.','좋은 칼엔 좋은 주인이 따르는 법.'],svc:'forge'},
  priest:{n:'사제',at:'temple',ch:['Monk','Monk2','OldWoman'],l:['신의 가호가 함께하길.','다친 데는 없나요? 무리하지 마세요.','기도는 마음을 다잡게 해 줍니다.'],svc:'bless'},
  scholar:{n:'학자',at:'library',ch:['OldMan','Inspector','Master'],l:['지식은 칼보다 멀리 닿는다네.','고대의 기록엔 전설의 무구 이야기가 가득하지.','공부는 하루아침에 되지 않아.'],svc:'lore'},
  merch:{n:'상인',at:'market',ch:['Sultan','Villager4','Villager5'],l:['싸게 드릴게요! 오늘만!','장사는 신용이 생명이지.','먼 나라 물건도 구해 드립니다.'],svc:'deal'},
  guard:{n:'경비대장',at:'castle',ch:['Knight','SamuraiBlue','GladiatorBlue'],l:['수상한 놈 보면 바로 알려라.','요즘 도적이 늘었어. 일손이 필요하다.','성을 지키는 게 내 일이다.'],svc:null},
  hunter:{n:'사냥꾼',at:'gate',ch:['Hunter','Eskimo','Caveman'],l:['숲은 정직해. 실력만큼 돌려주지.','늑대 발자국이 늘었어. 조심해.','사냥은 기다림의 기술이야.'],svc:null},
  kid:{n:'꼬마',at:'board',ch:['Child','Boy','EggGirl'],l:['형아 누나는 기사야?','우리 고양이 못 봤어요?','나도 크면 왕이 될 거야!'],svc:null},
  granny:{n:'할머니',at:'home',ch:['OldWoman','OldMan3'],l:['밥은 먹고 다니니?','젊었을 땐 나도 한가락 했지.','무릎이 쑤시는 걸 보니 비가 오려나.'],svc:null},
  bard:{n:'음유시인',at:'tavern',ch:['Villager6','Noble'],l:['당신의 이야기, 노래로 만들 가치가 있겠는데?','류트 소리 들어볼래요?','영웅담은 언제나 잘 팔리죠.'],svc:'song'},
  fisher:{n:'어부',at:'gate',ch:['Villager3','Eskimo'],l:['오늘은 물때가 좋아.','바다는 주는 만큼 가져가지.','그물 수선이 끝이 없구먼.'],svc:null,only:['coast','river']},
  miner:{n:'광부',at:'gate',ch:['Caveman','Caveman2'],l:['갱도 깊은 곳엔 이상한 소리가 나.','오늘도 무사히 나왔다.','광맥 하나면 팔자 고치지.'],svc:null,only:['mountain']},
  farmer:{n:'농부',at:'gate',ch:['Villager','Villager5'],l:['올해 농사는 하늘에 달렸지.','밭일 도와줄 손 없나?','햇볕 좋을 때 말려야 해.'],svc:null,only:['farm','plains']},
  lady:{n:'귀부인',at:'manor',ch:['Princess','Woman'],l:['어머, 처음 보는 얼굴이네요.','사교계엔 예절이 중요하답니다.','우리 가문 무도회에 와 볼래요?'],svc:null},
  thief:{n:'소매치기',at:'alley',ch:['NinjaGray','MaskRacoon'],l:['쉿, 너무 크게 말하지 마.','필요한 거 있으면 구해 줄 수도…','이 골목에선 눈을 크게 떠.'],svc:null},
  appr:{n:'견습 마법사',at:'tower',ch:['NinjaMageBlack','SorcererBlack'],l:['주문을 또 틀렸어요…','마탑 꼭대기엔 뭐가 있을까요?','마력은 마음에서 나온대요.'],svc:null,tower:true},
  vet:{n:'퇴역 병사',at:'barracks',ch:['FighterRed','RedGladiator'],l:['전쟁은 젊은이를 늙게 만들지.','진형이 무너지면 끝이야.','내 무릎에 박힌 화살 얘기 해줄까?'],svc:null}
};
// 나라 고유 인물 (수도에 등장) — 3단계 연속 부탁
const NAT_NPC={
  1:[{id:'n1a',name:'변경 사령관 그레고르',ch:'KnightGold',at:'castle',l:['변경은 매일이 전쟁이다.','쓸 만한 녀석이 필요해.'],chain:'bern'},{id:'n1b',name:'늑대골의 미라',ch:'Hunter',at:'gate',l:['숲의 왕은 늑대야. 아직은.'],chain:'bern2'}],
  2:[{id:'n2a',name:'근위대장 레오폴트',ch:'Samurai',at:'castle',l:['황실의 검은 꺾이지 않는다.','자격을 증명해 봐라.'],chain:'grasen'},{id:'n2b',name:'황녀 세레나',ch:'Princess',at:'manor',l:['궁전은 새장 같아요.','바깥 이야기를 들려줄래요?'],chain:'grasen2'}],
  3:[{id:'n3a',name:'조합장 마르코',ch:'Sultan',at:'market',l:['금화는 거짓말을 하지 않지.','큰 거래에 낄 배짱이 있나?'],chain:'ardel'},{id:'n3b',name:'선장 이사벨',ch:'RedGladiator',at:'gate',l:['바다가 날 부른다고!'],chain:'ardel2'}],
  4:[{id:'n4a',name:'대마법사 엘로윈',ch:'SorcererBlack',at:'tower',l:['마탑은 재능만 본다.','별들이 너를 가리키는군.'],chain:'solaris'},{id:'n4b',name:'별지기 소년 루',ch:'Child',at:'library',l:['별을 세다 보면 시간 가는 줄 몰라요!'],chain:'solaris2'}],
  5:[{id:'n5a',name:'반군 지도자 카샤',ch:'FighterRed',at:'alley',l:['이 나라엔 새 바람이 필요해.','믿을 수 있는 사람인가?'],chain:'kardun'},{id:'n5b',name:'늪의 은자 오르',ch:'Shaman',at:'temple',l:['늪은 모든 걸 기억하지.'],chain:'kardun2'}]
};
// 부탁 템플릿: t=battle|check|pay|visit|item|count
const NQ={
  fr_news:{n:'고향 소식 나누기',t:'check',st:'매력',dc:20,wk:1,txt:'서로 사는 나라 사정 좀 나눠 보자. 듣다 보면 쓸모 있는 게 있을 거야.',rw:{gold:25,net:3,aff:15}},
  fr_chase:{n:'쫓아온 추격자',t:'battle',b:{spear:2,archer:2},txt:'여기까지 오는 길에 도적들이 따라붙었어… 좀 도와줘!',rw:{gold:40,fame:3,aff:18}},
  fr_gift:{n:'의형제의 맹세',t:'pay',cost:60,txt:'우리 함께 큰일 한번 벌여 보자. 밑천을 조금만 보태 줄래? 평생 잊지 않을게.',rw:{aff:25,net:4,item:{lv:3,r:2}}},
  inn_barrel:{n:'술통 배달',t:'visit',to:'manor',wk:1,txt:'귀족 저택에 술통 좀 날라 주게.',rw:{gold:30,aff:10}},
  inn_brawl:{n:'술집 난동꾼',t:'battle',b:{spear:3},txt:'술 취한 용병들이 가게를 엉망으로 만들고 있어!',rw:{gold:45,fame:3,aff:12}},
  smith_ore:{n:'광석 구해오기',t:'pay',cost:40,txt:'좋은 광석이 필요한데… 시장에서 사다 줄 수 있나? (💰40)',rw:{item:{lv:1,slot:'wpn'},aff:12}},
  smith_test:{n:'새 검 시험',t:'check',st:'무예',dc:30,wk:1,txt:'새로 만든 검을 휘둘러 봐 줘.',rw:{gold:20,stat:['무예',1],aff:10}},
  smith_iron:{n:'고철 수집',t:'item',slot:'wpn',txt:'안 쓰는 무기 하나만 주게. 녹여서 다시 쓰지.',rw:{gold:40,aff:15,item:{lv:2,slot:'arm'}}},
  pri_herb:{n:'약초 심부름',t:'visit',to:'market',wk:1,txt:'시장에서 약초를 받아와 주세요.',rw:{fame:2,aff:10,health:15}},
  pri_sick:{n:'병자 돌보기',t:'count',k:'serve',n2:3,txt:'봉사 활동을 세 번 해 주시면 큰 도움이 될 거예요.',rw:{fame:5,aff:18,stat:['매력',1]}},
  pri_ghost:{n:'묘지의 망령',t:'battle',b:{mage:2,spear:2},txt:'밤마다 묘지에 망령이 나타납니다…',rw:{gold:60,fame:5,aff:15}},
  sch_book:{n:'잃어버린 고서',t:'check',st:'지략',dc:30,wk:1,txt:'서고 어딘가에 고서가 있을 텐데 찾아 주겠나?',rw:{stat:['지략',1.5],aff:12}},
  sch_letter:{n:'학회 편지 전달',t:'visit',to:'castle',wk:1,txt:'성에 이 편지를 전해 주게.',rw:{gold:25,net:2,aff:10}},
  sch_ruin:{n:'유적 조사 호위',t:'battle',b:{spear:2,archer:2},txt:'유적 조사에 호위가 필요하네.',rw:{gold:50,stat:['지략',1],aff:15,item:{lv:2}}},
  mer_deliver:{n:'급한 납품',t:'visit',to:'tavern',wk:1,txt:'선술집에 물건 좀 대신 전해 줘요.',rw:{gold:35,aff:10}},
  mer_bandit:{n:'상단 호위',t:'battle',b:{cav:2,spear:2},txt:'다음 상단이 도적 길목을 지나요. 지켜 줄래요?',rw:{gold:80,aff:15}},
  mer_haggle:{n:'흥정 대리인',t:'check',st:'매력',dc:32,wk:1,txt:'까다로운 손님이 있어요. 대신 흥정해 줄래요?',rw:{gold:50,stat:['내정',1],aff:12}},
  grd_patrol:{n:'야간 순찰',t:'check',st:'통솔',dc:28,wk:1,txt:'밤 순찰에 사람이 모자란다.',rw:{gold:30,fame:2,aff:10}},
  grd_bandit:{n:'도적 소굴 소탕',t:'battle',b:{spear:3,archer:2,cav:1},txt:'근처 도적 소굴을 쓸어버려라.',rw:{gold:90,fame:6,aff:15,item:{lv:3}}},
  grd_spy:{n:'첩자 색출',t:'visit',to:'alley',wk:1,txt:'뒷골목에 첩자가 숨어 있다는 정보다.',rw:{gold:40,fame:3,aff:12}},
  hun_wolf:{n:'늑대 사냥',t:'battle',b:{cav:3},txt:'가축을 노리는 늑대 무리를 쫓아내 줘.',rw:{gold:45,aff:14,item:{lv:2,slot:'feet'}}},
  hun_hunt:{n:'사냥 연습',t:'count',k:'hunt',n2:3,txt:'근교 사냥을 세 번 성공하면 한 수 가르쳐 주지.',rw:{stat:['무예',1.5],aff:15}},
  kid_cat:{n:'잃어버린 고양이',t:'visit',to:'home',wk:1,txt:'우리 고양이가 어디 갔을까… 찾아 주세요!',rw:{fame:2,aff:20}},
  kid_kite:{n:'연 날리기',t:'pay',cost:5,txt:'연 살 돈이 없어요… (💰5)',rw:{fame:1,aff:15,stat:['매력',.5]}},
  gr_well:{n:'우물물 길어오기',t:'check',st:'무예',dc:15,wk:1,txt:'무릎이 아파서… 물 좀 길어다 주겠니?',rw:{health:10,aff:15,gold:10}},
  gr_letter:{n:'아들에게 편지',t:'visit',to:'barracks',wk:1,txt:'병영에 있는 우리 아들에게 이것 좀 전해 줘.',rw:{aff:18,net:1,item:{lv:1,slot:'acc'}}},
  bard_song:{n:'노래 소재',t:'check',st:'매력',dc:25,wk:1,txt:'당신 무용담을 자세히 들려줘요!',rw:{fame:6,aff:12}},
  bard_rival:{n:'경쟁 시인 망신',t:'check',st:'지략',dc:35,wk:1,txt:'건방진 경쟁 시인을 말로 이겨 줘요.',rw:{fame:4,net:2,aff:14}},
  fish_net:{n:'그물 수선',t:'check',st:'내정',dc:20,wk:1,txt:'그물 좀 같이 꿰매 주게.',rw:{gold:20,aff:14}},
  fish_monster:{n:'물괴물 퇴치',t:'battle',b:{spear:2,mage:1},txt:'물가에 괴물이 나타나 배가 못 나가!',rw:{gold:70,aff:16,item:{lv:3}}},
  mine_cave:{n:'갱도 붕괴 구조',t:'check',st:'무예',dc:34,wk:2,txt:'갱도가 무너졌어! 안에 사람이 있어!',rw:{fame:8,aff:20,gold:30}},
  mine_goblin:{n:'갱도의 고블린',t:'battle',b:{spear:4,archer:1},txt:'고블린들이 갱도를 차지했어.',rw:{gold:80,aff:16,item:{lv:3,cls:['heavy','hammer','axe']}}},
  farm_harvest:{n:'추수 돕기',t:'check',st:'무예',dc:18,wk:1,txt:'일손이 모자라! 하루만 도와줘.',rw:{gold:25,aff:15}},
  farm_crow:{n:'까마귀 떼',t:'check',st:'지략',dc:24,wk:1,txt:'허수아비를 더 똑똑하게 만들 방법 없을까?',rw:{gold:20,stat:['지략',.5],aff:14}},
  lady_ball:{n:'무도회 동행',t:'check',st:'매력',dc:36,wk:1,txt:'이번 무도회에 동행해 줄래요?',rw:{net:5,stat:['매력',1],aff:16}},
  lady_gift:{n:'선물 고르기',t:'item',slot:'acc',txt:'동생에게 줄 장신구가 필요해요. 하나 양보해 줄래요?',rw:{gold:80,net:3,aff:18}},
  thf_job:{n:'수상한 심부름',t:'visit',to:'manor',wk:1,txt:'저택 하인에게 쪽지 하나만 전해. 묻지 말고.',rw:{gold:60,aff:12}},
  thf_guard:{n:'경비 따돌리기',t:'check',st:'지략',dc:30,wk:1,txt:'경비 시선 좀 끌어 줘.',rw:{gold:50,aff:14,item:{lv:2,cls:['dagger','light']}}},
  appr_spell:{n:'주문 연습 상대',t:'check',st:'지략',dc:28,wk:1,txt:'주문 연습 상대가 되어 주세요!',rw:{stat:['지략',1],aff:14}},
  appr_crystal:{n:'마정석 운반',t:'visit',to:'library',wk:1,txt:'학당에 마정석 상자를 옮겨 주세요.',rw:{gold:30,aff:12,item:{lv:2,cls:['staff','wand','orb','book']}}},
  vet_drill:{n:'옛 진형 배우기',t:'count',k:'sword',n2:4,txt:'검술 훈련을 네 번 하고 오면 비법을 알려 주마.',rw:{stat:['통솔',1.5],aff:15}},
  vet_grave:{n:'전우의 묘',t:'visit',to:'temple',wk:1,txt:'신전에 전우를 위한 향을 피워 주게.',rw:{aff:18,fame:2,stat:['통솔',.5]}}
};
const ROLEQ={friend:['fr_news','fr_chase','fr_gift'],inn:['inn_barrel','inn_brawl'],smith:['smith_ore','smith_test','smith_iron'],priest:['pri_herb','pri_sick','pri_ghost'],scholar:['sch_book','sch_letter','sch_ruin'],
  merch:['mer_deliver','mer_haggle','mer_bandit'],guard:['grd_patrol','grd_spy','grd_bandit'],hunter:['hun_hunt','hun_wolf'],kid:['kid_kite','kid_cat'],granny:['gr_well','gr_letter'],
  bard:['bard_song','bard_rival'],fisher:['fish_net','fish_monster'],miner:['mine_cave','mine_goblin'],farmer:['farm_harvest','farm_crow'],lady:['lady_ball','lady_gift'],
  thief:['thf_job','thf_guard'],appr:['appr_spell','appr_crystal'],vet:['vet_drill','vet_grave']};
const CHAIN={
  bern:[{n:'변경 순찰',t:'battle',b:{spear:3,cav:2},txt:'변경 숲에 고블린 척후가 보인다. 처리해라.',rw:{gold:60,fame:5}},{n:'요새 보급',t:'pay',cost:80,txt:'요새 식량이 바닥났다. 보급비를 대 줄 수 있나? (💰80)',rw:{fame:6,net:3}},{n:'숲의 괴물 토벌',t:'battle',b:{spear:5,cav:3,archer:3,mage:2},txt:'모든 화근은 숲 깊은 곳의 괴물이다. 끝내라.',rw:{fame:15,uni:'u_bern_axe'}}],
  bern2:[{n:'늑대 발자국',t:'count',k:'hunt',n2:4,txt:'사냥을 네 번 성공해 봐. 실력을 보고 싶어.',rw:{stat:['무예',1]}},{n:'은빛 늑대',t:'battle',b:{cav:5},txt:'은빛 늑대 우두머리를 찾았어. 같이 가자.',rw:{fame:6,uni:'u_wolf_cape'}}],
  grasen:[{n:'근위 시험 1: 검',t:'check',st:'무예',dc:40,wk:1,txt:'검술로 증명해 봐라.',rw:{fame:4}},{n:'근위 시험 2: 지휘',t:'check',st:'통솔',dc:42,wk:1,txt:'병사들을 이끌어 봐라.',rw:{fame:5}},{n:'황실 습격자 토벌',t:'battle',b:{spear:5,cav:4,archer:3},txt:'황실을 노리는 자객단을 쳐라.',rw:{fame:15,uni:'u_grasen_sword'}}],
  grasen2:[{n:'바깥 이야기',t:'check',st:'매력',dc:30,wk:1,txt:'궁 밖 이야기를 들려줘요.',rw:{net:4}},{n:'몰래 외출',t:'visit',to:'market',wk:1,txt:'시장 구경을 시켜 줄래요? 비밀이에요!',rw:{net:6,stat:['매력',2]}}],
  ardel:[{n:'장부 정리',t:'check',st:'내정',dc:32,wk:1,txt:'조합 장부가 엉망이야. 맞춰 볼 수 있나?',rw:{gold:60}},{n:'투자 제안',t:'pay',cost:150,txt:'확실한 투자처가 있어. 💰150을 걸어 보게.',rw:{gold:320}},{n:'해적 소탕',t:'battle',b:{spear:4,archer:3,cav:2},txt:'항로의 해적을 소탕하면 조합의 정식 일원이네.',rw:{fame:12,uni:'u_ardel_ledger'}}],
  ardel2:[{n:'뱃사람 모집',t:'pay',cost:60,txt:'선원 계약금이 모자라! (💰60)',rw:{net:4}},{n:'폭풍의 항해',t:'check',st:'통솔',dc:34,wk:2,txt:'폭풍 속 항해를 같이 지휘해 줘!',rw:{gold:150,fame:6,item:{lv:4,r:2}}}],
  solaris:[{n:'마력 측정',t:'check',st:'지략',dc:35,wk:1,txt:'네 마력을 재 보겠다.',rw:{stat:['지략',1]}},{n:'금지된 서고 정리',t:'visit',to:'library',wk:2,txt:'학당 지하 서고를 정리해 다오.',rw:{stat:['지략',2]}},{n:'마탑 침입자',t:'battle',b:{mage:4,spear:3,archer:2},txt:'금지된 마법을 노리는 자들이 왔다.',rw:{fame:12,uni:'u_solaris_orb'}}],
  solaris2:[{n:'별자리 그리기',t:'check',st:'지략',dc:25,wk:1,txt:'별자리 지도를 같이 그려요!',rw:{stat:['지략',1]}},{n:'떨어진 별 찾기',t:'visit',to:'gate',wk:1,txt:'성문 밖에 별똥별이 떨어졌대요!',rw:{item:{lv:3,cls:['orb','staff','wand'],r:2}}}],
  kardun:[{n:'벽보 붙이기',t:'visit',to:'board',wk:1,txt:'광장 게시판에 벽보를 붙여.',rw:{fame:3}},{n:'동지 모으기',t:'check',st:'매력',dc:33,wk:1,txt:'믿을 만한 동지를 데려와.',rw:{net:5}},{n:'감옥 습격',t:'battle',b:{spear:5,archer:3,cav:2},txt:'동지들이 갇혀 있다. 구하러 간다.',rw:{fame:12,uni:'u_kardun_banner'}}],
  kardun2:[{n:'늪의 시험',t:'check',st:'지략',dc:30,wk:1,txt:'늪의 수수께끼를 풀어 보게.',rw:{stat:['지략',1]}},{n:'늪 정령 진정',t:'battle',b:{mage:3,spear:2},txt:'성난 늪 정령을 잠재워야 하네.',rw:{health:20,uni:'u_witch_hat'}}]
};
function cityNpcs(p){
  const ci=p.city||0,C=cityOf(p),R=srng(p.home*1009+ci*97+3),N=NINFO[p.home],out=[];
  const pool=Object.keys(ROLES).filter(k=>{const r=ROLES[k];if(r.only&&!r.only.includes(C.t)&&!r.only.includes(C.b))return false;if(r.tower&&!N.tower)return false;if(r.at==='castle'&&false)return false;return true;});
  const pref={coast:['fisher','merch','inn'],mountain:['miner','smith','vet'],forest:['hunter','granny'],river:['fisher','merch'],farm:['farmer','granny','kid'],marsh:['priest','thief'],fort:['vet','guard','smith'],trade:['merch','inn','bard'],capital:['guard','lady','scholar']}[C.t]||[];
  const order=[...pref.filter(k=>pool.includes(k)),...pool.filter(k=>!pref.includes(k)).sort(()=>R()-.5)];
  const n=CTYPE[C.t].npc+(N.size==='large'?1:0);
  order.slice(0,n).forEach((k,i)=>{const r=ROLES[k];out.push({id:`${p.home}-${ci}-${k}`,role:k,name:NAME_A[Math.floor(R()*NAME_A.length)]+NAME_B[Math.floor(R()*NAME_B.length)],
    ch:r.ch[Math.floor(R()*r.ch.length)],at:r.at});});
  if(C.t==='capital')(NAT_NPC[p.home]||[]).forEach(o=>out.push({...o,role:'nat',nat:true}));
  if(p.visit&&p.visit.m===p.month&&p.friends){const f=p.friends.find(x=>x.id===p.visit.id);if(f)out.push({id:'fr-'+f.id,role:'friend',name:f.name,ch:f.ch,at:'tavern',fr:f.id});}
  return out;
}
const npcSt=(p,id)=>(p.npc=p.npc||{})[id]||(p.npc[id]={a:0,talk:-1,qi:0});
const affTxt=a=>a>=80?'💖 깊은 신뢰':a>=50?'💗 친함':a>=25?'💛 알고 지냄':'🤍 낯섦';
function npcQuest(p,n){ // 지금 줄 수 있는 부탁
  const s=npcSt(p,n.id);if(s.active)return null;
  if(n.nat){const ch=CHAIN[n.chain];return s.qi<ch.length?{key:n.chain+'#'+s.qi,...ch[s.qi]}:null;}
  const ks=ROLEQ[n.role]||[];if(s.qi>=ks.length)return null;
  if(s.qi>=1&&s.a<25)return null;if(s.qi>=2&&s.a<45)return null;
  return {key:ks[s.qi],...NQ[ks[s.qi]]};
}
const activeNQ=p=>Object.entries(p.npc||{}).filter(([id,s])=>s.active).map(([id,s])=>({id,...s.active}));
function nqDone(p,id){const s=npcSt(p,id);if(s.active)s.active.done=true;}
function bumpCount(p,k){activeNQ(p).forEach(q=>{if(q.t==='count'&&q.k===k&&!q.done){const s=npcSt(p,q.id);s.active.prog=(s.active.prog||0)+1;if(s.active.prog>=q.n2){s.active.done=true;toast(`📜 부탁 완료: ${q.n} — ${q.who}에게 보고하세요`);}}});}
function giveReward(p,rw,who){
  const L=[];if(rw.gold){p.gold+=rw.gold;L.push(`💰+${rw.gold}`);}if(rw.fame){L.push(`명성 +${addFame(p,rw.fame)}`);}if(rw.net){p.net+=rw.net;L.push(`인맥 +${rw.net}`);}
  if(rw.health){p.health=Math.min(100,p.health+rw.health);L.push(`건강 +${rw.health}`);}
  if(rw.stat){p.st[rw.stat[0]]=r1(p.st[rw.stat[0]]+rw.stat[1]);L.push(`${rw.stat[0]} +${rw.stat[1]}`);}
  let s=L.join(', ');
  if(rw.item){const it=rollItem(p1Lv()+(rw.item.lv||1)-1,{slot:rw.item.slot,cls:rw.item.cls,r:rw.item.r});s+='<br>'+gainItem(it,who+'의 선물');}
  if(rw.uni){const u=giveUnique(rw.uni,who);if(u)s+='<br>'+u;}
  return s;
}
let npcUI=null;
const FR_REL=['어릴 적 친구','사촌','옛 스승','떠돌이 시절 동료','편지 친구','외삼촌','고향 선배'];
function ensureFriends(p){if(p.friends)return;const R=Math.random,ks=[1,2,3,4,5].filter(k=>k!==p.home).sort(()=>R()-.5).slice(0,3);
  p.friends=ks.map((k,i)=>({id:'f'+i,nat:k,city:Math.floor(R()*CITIES[k].length),name:NAME_A[Math.floor(R()*NAME_A.length)]+NAME_B[Math.floor(R()*NAME_B.length)],rel:FR_REL[Math.floor(R()*FR_REL.length)],ch:pick(FOLK_CH),bond:false}));
  p.friends.forEach(f=>{(p.npc=p.npc||{})['fr-'+f.id]={a:35,talk:-1,qi:0};});}
function friendLines(p,f){const N=NATIONS[f.nat].name,C=CITIES[f.nat][f.city].n;return[`"${C}에서 여기까지 꼬박 걸렸어. ${N}는 요즘 시끌시끌해."`,`"${p.name}! 정말 오랜만이다. 얼굴 좋아 보이네."`,`"언젠가 ${N}에 오면 꼭 내 집에 들러. ${C}에서 기다릴게."`,f.bond?`"우린 의형제잖아. ${N}에 오면 내가 다 챙겨 줄게!"`:`"우리 사이에 뭘. 필요하면 언제든 말해."`];}
function rankTier(p){const R=ROUTES[p.route],L=R.ranks.length-1;let t=p.rank<=0?0:p.rank>=L?3:p.rank<=L/2?1:2;if(p.fame>=80&&t<3)t++;return t;}
function npcAddr(p,n,s){const R=ROUTES[p.route],rn=R.ranks[p.rank].n,t=rankTier(p);
  if(s.rk!=null&&s.rk<p.rank){s.rk=p.rank;s.a=Math.min(100,s.a+3);return `<span class="sub">"${rn}(으)로 오르셨다면서요? 정말 축하드려요!"</span>`;}
  s.rk=p.rank;
  const L=[[`(무심하게) "거기, 무슨 일이야?"`,`"처음 보는 얼굴인데… 뭐 필요해?"`,`"바쁘니까 용건만 말해."`],
    [`"아, ${rn} ${p.name} 씨군요. 어서 와요."`,`"${rn} 일은 좀 할 만해요?"`,`"${p.name} 씨, 오늘은 무슨 일로?"`],
    [`"${rn} ${p.name}님! 이렇게 찾아 주시다니."`,`"요즘 ${p.name}님 이야기로 동네가 떠들썩해요."`,`(공손히 인사한다) "${rn}님, 어서 오십시오."`],
    [`(깊이 고개를 숙인다) "${rn} 각하! 누추한 곳에 어인 일로…"`,`"분부만 내려 주십시오, ${rn}님."`,`(주변 사람들이 길을 비킨다) "${p.name} 님이 오셨다!"`]][t];
  return `<span class="sub">${L[(p.month+n.name.length)%L.length]}</span>`;}
function openNpc(n){
  const p=PP(),s=npcSt(p,n.id),R=n.nat?null:ROLES[n.role];npcUI=n;s.met=true;
  const F=n.fr&&p.friends?p.friends.find(x=>x.id===n.fr):null;
  const nowW=p.month*4+p.week,title=n.nat?'':F?`${NATIONS[F.nat].name}에서 온 ${F.rel}`:R.n,lines=n.nat?n.l:F?friendLines(p,F):R.l;
  const lineIdx=Math.floor((nowW+n.name.length)%lines.length);
  let text=(F?'':npcAddr(p,n,s)+'<br>')+(s.lastLine||lines[lineIdx]);
  const opts=[];
  if(s.talk!==nowW)opts.push({l:'💬 이야기하기',f:()=>{const g=Math.round(3+(p.st.매력-20)/12+Math.random()*3);s.a=Math.min(100,s.a+Math.max(2,g));s.talk=nowW;s.lastLine=pick(lines);
    if(s.a>=80&&!s.gift80){s.gift80=true;s.lastLine=`"${p.name}, 당신은 정말 좋은 친구야. 이걸 받아."<br>`+giveReward(p,n.nat?{uni:null,item:{lv:3,r:3}}:{item:{lv:3,r:3}},n.name);}
    openNpc(n);save();}});
  opts.push({l:'🎁 선물 (💰20)',dis:p.gold<20,f:()=>{p.gold-=20;s.a=Math.min(100,s.a+8);s.lastLine='"어머, 고마워요!"';openNpc(n);save();}});
  const act=s.active;
  if(act){
    if(act.done)opts.unshift({l:`📜 보고: ${act.n}`,hl:1,f:()=>{s.active=null;s.qi++;s.a=Math.min(100,s.a+(act.rw.aff||10));const r=giveReward(p,act.rw,n.name);if(n.fr&&s.qi>=3){const f=p.friends.find(x=>x.id===n.fr);if(f&&!f.bond){f.bond=true;p1Log(p,`🤝 ${f.name}와(과) 의형제를 맺었다! ${NATIONS[f.nat].name}(으)로 이주할 때 큰 도움을 받는다.`);}}p1Log(p,`📜 ${n.name}의 부탁 「${act.n}」 완료: ${r}`);s.lastLine='"정말 고마워!" — '+r;checkPerks(p);renderP1();openNpc(n);save();}});
    else if(act.t==='item'){const it=inv().find(x=>itSlot(x)===act.slot&&!x.u);opts.unshift({l:`🎁 ${act.n}: ${it?it.n+' 건네기':'('+SLOTN[act.slot]+' 장비가 가방에 없음)'}`,dis:!it,f:()=>{prog.inv=inv().filter(x=>x!==it);act.done=true;openNpc(n);save();}});}
    else text=`(진행 중) 「${act.n}」 — ${act.txt}${act.t==='count'?` (${act.prog||0}/${act.n2})`:act.t==='visit'?` → ${TOWNB.find(b=>b.id===act.to).ic} ${TOWNB.find(b=>b.id===act.to).n}에서 처리`:''}`;
  }else{const q=npcQuest(p,n);
    if(q)opts.unshift({l:`❗ 부탁 듣기: ${q.n}`,hl:1,f:()=>{
      const d=q.t==='battle'?`⚔ 전투: ${ORDER.filter(t=>q.b[t]).map(t=>TYPES[t].name+q.b[t]).join(' ')}`:q.t==='check'?`🎲 ${q.st} 판정 (성공률 ${Math.round(chk(p.st[q.st],q.dc)*100)}%) · ⏳${q.wk}주`:q.t==='pay'?`💰${q.cost} 필요`:q.t==='visit'?`📦 ${TOWNB.find(b=>b.id===q.to).n}에 다녀오기 (⏳${q.wk}주)`:q.t==='item'?`🎁 ${SLOTN[q.slot]} 장비 하나`:`🔁 ${q.n2}번 하기`;
      show("npcdlg",false);popup(`${n.name}의 부탁 — ${q.n}`,`${faceImg(n.ch)}<br>"${q.txt}"<br><span class="sub">${d}</span><br>보상: ${rwTxt(q.rw)}`,[
        {l:'수락',f:()=>acceptNQ(p,n,q)},{l:'다음에',f:()=>openNpc(n)}]);}});
    else if(!n.nat&&s.qi<(ROLEQ[n.role]||[]).length)text+=`<br><span class="sub">(더 친해지면 부탁할 일이 있는 것 같다)</span>`;
  }
  // 역할별 서비스
  if(R&&R.svc==='rumor')opts.push({l:'👂 소문 (💰5)',dis:p.gold<5,f:()=>{p.gold-=5;const U=ID.UNI.filter(u=>!hasUni(u.id));s.lastLine=U.length?`"전설 하나 알려 주지. ${pick(U).src}… 라던데?"`:'"더는 아는 게 없어!"';openNpc(n);}});
  if(R&&R.svc==='bless')opts.push({l:`✨ 축복 (💰${s.a>=50?10:25}, 건강 +30)`,dis:p.gold<(s.a>=50?10:25)||p.health>=100,f:()=>{p.gold-=s.a>=50?10:25;p.health=Math.min(100,p.health+30);s.lastLine='"신의 가호를."';renderP1();openNpc(n);}});
  if(R&&R.svc==='forge'){const me=heroes.find(h=>h.king),w=me&&me.eq&&me.eq.wpn,c=w?Math.round(itVal(w)*.5)*(s.a>=50?1:1.4)|0:0;
    opts.push({l:w?`🔨 무기 강화 ${w.n} (+${(w.fg||0)+1}) 💰${c}`:'🔨 무기 강화 (장착한 무기 없음)',dis:!w||(w.fg||0)>=3||p.gold<c,f:()=>{p.gold-=c;w.fg=(w.fg||0)+1;for(const k in w.st)if(!PCTK.includes(k)&&w.st[k]>0)w.st[k]=Math.round(w.st[k]*1.12+1);w.n=w.n.replace(/ \+\d$/,'')+' +'+w.fg;applyCiv();s.lastLine=`"${w.n}, 훨씬 좋아졌지?"`;openNpc(n);save();}});}
  if(R&&R.svc==='lore')opts.push({l:'📜 전설 장비 이야기',f:()=>{const U=ID.UNI.filter(u=>!hasUni(u.id));s.lastLine=U.length?`"「${pick(U).n.slice(0,2)}…」로 시작하는 무구가 있지. ${pick(U).src}."`:'"자네가 다 모았군!"';openNpc(n);}});
  if(R&&R.svc==='song')opts.push({l:'🎵 노래 의뢰 (💰30, 명성 +4)',dis:p.gold<30,f:()=>{p.gold-=30;addFame(p,4);s.lastLine='"♪ 들어라, 위대한 이의 이야기를~ ♪"';openNpc(n);}});
  if(R&&R.svc==='deal')opts.push({l:'🛒 상점 보기',f:()=>{closeNpc();openEquip('shop');}});
  opts.push({l:'👋 작별',f:closeNpc});
  const el=$('npcdlg');
  el.innerHTML=`<div class="nface">${faceImg(n.ch)}</div><div class="ntext"><div><b class="nname">${n.name}</b> <span class="sub">${title}${n.nat?' · ✦ '+NATIONS[p.home].name+'의 인물':''}</span> <span class="naff">${affTxt(s.a)} ${s.a}</span></div>
    <div class="nline">${text}</div><div class="nopts" id="nopts"></div></div>`;
  opts.forEach(o=>{const b=document.createElement('button');b.className=o.hl?'':'ghost';b.innerHTML=o.l;b.disabled=!!o.dis;b.onclick=o.f;$('nopts').appendChild(b);});
  show('npcdlg',true);show('tnear',false);
}
function closeNpc(){npcUI=null;show('npcdlg',false);const p=PP();if(p){const s=Object.values(p.npc||{});s.forEach(x=>delete x.lastLine);}updNear();}
const rwTxt=rw=>[rw.gold?`💰${rw.gold}`:'',rw.fame?`명성 ${rw.fame}`:'',rw.net?`인맥 ${rw.net}`:'',rw.stat?`${rw.stat[0]} +${rw.stat[1]}`:'',rw.health?`건강 ${rw.health}`:'',rw.item?'🎁 장비':'',rw.uni?'✨ 전설 장비':'',`호감 +${rw.aff||10}`].filter(Boolean).join(' · ');
function acceptNQ(p,n,q){
  const s=npcSt(p,n.id),act={...q,who:n.name,prog:0,city:p.city||0};
  if(q.t==='pay'){if(p.gold<q.cost){toast('돈이 모자랍니다');return openNpc(n);}p.gold-=q.cost;act.done=true;}
  if(q.t==='check'){if(WK-p.week<q.wk){toast('이번 달 남은 시간이 모자랍니다');return openNpc(n);}
    p.week+=q.wk;const ok=Math.random()<chk(p.st[q.st],q.dc);
    if(!ok){p.fame=Math.max(0,p.fame-1);popup(`✘ ${q.n} 실패`,`${q.st} 판정에 실패했다… 다시 부탁을 들을 수 있다.`,[{l:'다음 ▶',f:()=>{closeNpc();afterAct();}}]);save();return;}
    act.done=true;}
  s.active=act;
  if(q.t==='battle'){if(p.health<30){s.active=null;toast('건강이 30 이상이어야 싸울 수 있습니다');return openNpc(n);}
    closeNpc();p1PendWk=2;startP1Quest({name:`${n.name}의 부탁: ${q.n}`,battle:q.b,gold:0,fame:0,npcq:n.id});return;}
  save();
  if(q.t==='check'){popup(`✔ ${q.n} 성공`,`${n.name}에게 보고하세요.`,[{l:'다음 ▶',f:()=>{openNpc(n);if(p.week>=WK){closeNpc();p1MonthEnd();}}}]);return;}
  openNpc(n);
}
const biomeOf=p=>cityOf(p).b;
const JOBB={soldier:'barracks',merchant:'market',noble:'manor',mage:'tower',rebel:'alley'};
const T_GROUND={plains:'#8cc866',forest:'#74b05a',highland:'#a8b080',river:'#88c470',marsh:'#7aa868'};
let town=null,p1PendWk=0;
function townFree(x,y,w,d,list){
  if(x-w/2<16||x+w/2>W-16||y-d<(town&&town.top||130)||y>H-14)return false;
  if(y+12>486&&y-d-8<556)return false;
  if(town&&town.nob)for(const r of town.nob)if(x+w/2>r[0]&&x-w/2<r[0]+r[2]&&y>r[1]&&y-d<r[1]+r[3])return false;
  if(Math.abs(x-800)<w/2+34&&y+12>270)return false;
  for(const b of TOWNB){if(Math.abs(x-b.x)<w/2+26&&((b.y<520&&y-d<520&&y+10>b.y)||(b.y>520&&y+10>520&&y-d<b.y+20)))return false;}
  for(const o of list){const ow=o.vw||o.fw,od=o.vh||o.fd;if(x+w/2+8>o.x-ow/2&&x-w/2-8<o.x+ow/2&&y+10>o.y-od&&y-d-10<o.y)return false;}
  return true;
}
/* ---------- 마을 바닥 (타일) ---------- */
const AUTO={6:[0,0],14:[1,0],12:[2,0],4:[3,0],7:[0,1],15:[1,1],13:[2,1],5:[3,1],3:[0,2],11:[1,2],9:[2,2],1:[3,2],2:[0,3],10:[1,3],8:[2,3],0:[3,3]};
/* ---------- 마을 배치 (설계된 배치: 겹침 없음) ---------- */
const TLAY={castle:[800,330],barracks:[130,468],tavern:[410,468],board:[890,468],temple:[1190,468],manor:[1440,468],home:[200,760],alley:[545,760],market:[1020,744],library:[1300,760],tower:[1525,884],gate:[800,884]};
const HSLOT=[[380,760,0],[700,760,0],[130,290,1]];
function layoutTown(p,C,CT,biome,R,N,nc,cap){
  const placed=[],roads=new Set(),bgs=[];town.roads=roads;town.bgs=bgs;
  const box=(x,y,w,h,m)=>[x-w/2-m,y-h-m,x+w/2+m,y+m];
  const hit=b=>placed.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1])||town.nob.some(r=>b[0]<r[0]+r[2]&&b[2]>r[0]&&b[1]<r[1]+r[3]&&b[3]>r[1]);
  const road=(c,r)=>roads.add(c+','+r);
  for(let c=0;c<50;c++){road(c,15);road(c,16);}
  for(let c=(biome==='river'?2:1);c<=44;c++)road(c,24);
  for(let r=17;r<24;r++){road(37,r);}
  for(let r=24;r<=27;r++)road(44,r);for(let c=44;c<=47;c++)road(c,27);
  TOWNB.forEach(d=>{const L=TLAY[d.id];d.x=L[0];d.y=L[1];});
  if(biome==='river')TOWNB.find(d=>d.id==='barracks').x=170;
  TOWNB.forEach(d=>{let kind=d.kind,o={roof:nc},n=d.n,ic=d.ic;
    if(d.id==='tower'&&!N.tower)kind='ruin';
    if(d.id==='castle'){if(cap)o={roof:nc,lv:{small:1,medium:2,large:3}[N.size]};else{kind=CT==='fort'?'castle':'hall';o={roof:nc,lv:1};n=CT==='fort'?'요새 사령부':'영주관';ic='🏯';}}
    if(d.id==='barracks'||d.id==='home'||d.id==='gate'||d.id==='manor')o.acc=nc;
    const a=bArt(kind,o);town.b.push({...d,n,ic,kind,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h*.9,ok:!(d.id==='tower'&&!N.tower)});
    placed.push(box(d.x,d.y,a.w,a.h,6));
    const c=Math.floor(d.x/32);
    if(d.id==='castle')for(let r=Math.floor(d.y/32);r<29;r++){road(24,r);road(25,r);}
    else if(d.id==='gate'||d.id==='board'||d.id==='market'||d.id==='tower');
    else if(d.y<520)for(let r=Math.floor((d.y-8)/32);r<15;r++)road(c,r);
    else for(let r=Math.floor((d.y-8)/32);r<24;r++)road(c,r);
    if(['home','library'].includes(d.id)){bgs.push(['cPot1',d.x-34,d.y-22],['cPot2',d.x+18,d.y-22]);}});
  // 주택: 정해진 자리에만
  const nh={small:1,medium:2,large:3}[N.size]+(cap?0:-1),kinds=['cotB','cotG','cotP','cotR'];
  HSLOT.slice(0,Math.max(1,nh)).forEach(([x,y,back],i)=>{const k=kinds[(i+p.home+(p.city||0))%4],a=bArt('cottage',{v:k});const b=box(x,y,a.w,a.h,6);if(hit(b))return;
    placed.push(b);town.deco.push({x,y,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h,door:{x,y:y+8}});bgs.push(['cPot1',x-34,y-22],['cPot2',x+18,y-22]);
    const c=Math.floor(x/32);if(back){for(let cc=c;cc<=7;cc++)road(cc,9);for(let r=9;r<15;r++)road(7,r);}else for(let r=Math.floor((y-8)/32);r<24;r++)road(c,r);});
  // 광장 석상
  {const a=bArt('fountain');town.deco.push({x:800,y:536,a,fw:30,fd:8});}
  // 우물 (자리 있을 때만)
  [[300,730],[1240,730],[640,730],[1110,330],[330,240]].some(([x,y])=>{const a=bArt('well');const b=box(x,y,a.w,a.h,8);if(y>520&&y-a.h<552)return false;if(hit(b))return false;placed.push(b);town.deco.push({x,y,a,fw:a.w*.7,fd:24,vw:a.w,vh:a.h});return true;});
  // 가로등: 큰길 양옆 일정 간격
  for(let x=80;x<W;x+=180){if(Math.abs(x-800)<120)continue;[[x,474],[x,606]].forEach(([lx,ly])=>{const b=box(lx,ly,24,84,0);const c=Math.floor(lx/32);if(hit(b)||roads.has(c+','+Math.floor((ly-10)/32)))return;bgs.push(['cLamp',lx-12,ly-84]);});}
  // 농장·밭
  const fields=[];if(CT==='farm'||biome==='plains'){fields.push([2,25,6,3]);if(CT==='farm')fields.push([27,25,7,3]);}
  town.fields=fields;fields.forEach(([x0,y0,w,h])=>placed.push([x0*32,y0*32,(x0+w)*32,(y0+h)*32]));
  // 나무: 줄 맞춰 심기 (아래쪽 가로수, 양 끝 숲, 뒤쪽 빈터)
  const rows=[{ys:[890],xs:[],kinds:['fRound','oak']},{ys:[],xs:[34,1566],kinds:['fTall','fPine']},{ys:[250],xs:[],kinds:['tr0','fRound']}];
  const plant=(x,y,k)=>{const a=bArt('tree',{k});const b=box(x,y,a.w*.7,a.h*.85,2);if(hit(b))return false;placed.push(b);town.deco.push({x,y,a,fw:a.w*.3,fd:10,tree:1});return true;};
  const step=CT==='forest'||biome==='forest'?90:120;
  for(let x=60,i=0;x<W-40;x+=step,i++)plant(x+(i%2?10:-10),890-(i%2)*14,rows[0].kinds[i%2]);
  [34,1566].forEach(x=>{for(let y=200,i=0;y<880;y+=step,i++)plant(x,y,rows[1].kinds[i%2]);});
  for(let x=260,i=0;x<W-200;x+=140,i++)plant(x,250,rows[2].kinds[i%2]);
  if(CT==='forest')for(let x=110,i=0;x<W-100;x+=100,i++)plant(x,840,'fPine');
  if(CT==='fort')[[60,330],[1540,330]].forEach(([x,y])=>{const a=bArt('watch',{acc:nc});town.deco.push({x,y,a,fw:20,fd:12});});
  if(CT==='farm')fields.forEach(([x0,y0,w,h])=>{bgs.push(['fHay',(x0+w)*32-30,(y0+h)*32-70]);});
}
function tileTownBg(p,C,CT,biome,R){
  const T=32,CW=Math.ceil(W/T),CH=Math.ceil(H/T),bg=document.createElement('canvas');bg.width=W;bg.height=H;
  const g=bg.getContext('2d');g.imageSmoothingEnabled=false;
  const t16=(im,sx,sy,dx,dy)=>g.drawImage(TS[im],sx*16,sy*16,16,16,dx,dy,32,32);
  const spr=(k,x,y)=>{const S=SP[k],k2=S[5]||2;g.drawImage(TS[S[0]],S[1],S[2],S[3],S[4],Math.round(x),Math.round(y),S[3]*k2,S[4]*k2);};
  const grid=new Int8Array(CW*CH),at=(x,y)=>x<0||y<0||x>=CW||y>=CH?-1:grid[y*CW+x],set=(x,y,v)=>{if(x>=0&&y>=0&&x<CW&&y<CH)grid[y*CW+x]=v;};
  (town.roads||new Set()).forEach(k=>{const [c,r]=k.split(',').map(Number);set(c,r,1);});
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(Math.hypot(x*T+16-800,y*T+16-512)<80)set(x,y,1);}
  if(CT==='coast')for(let x=0;x<CW;x++){const d=2+[0,1,1,0,0,1,0,0][Math.floor(x/3)%8];for(let y=0;y<d;y++)set(x,y,2);}
  if(biome==='river')for(let y=0;y<CH;y++){if(y===15||y===16||y===24)continue;set(0,y,2);set(1,y,2);}
  if(biome==='marsh')[[12,25,3,2],[40,25,3,2],[13,10,2,2]].forEach(([x0,y0,w,h])=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(!at(x,y))set(x,y,2);});
  const dk=biome==='forest',grassRow=dk?[11,12]:[0,12];
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){t16('TilesetFloor',grassRow[0],grassRow[1],x*T,y*T);
    if(R()<.16)t16('TilesetFloor',grassRow[0]+1+Math.floor(R()*4),grassRow[1],x*T,y*T);}
  const auto=(v,im,ox,oy,ix,iy)=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(at(x,y)!==v)continue;
    const s=(dx,dy)=>{const q=at(x+dx,y+dy);return q===v||q===-1;},m=(s(0,-1)?1:0)|(s(1,0)?2:0)|(s(0,1)?4:0)|(s(-1,0)?8:0),a=AUTO[m];
    t16(im,ox+a[0],oy+a[1],x*T,y*T);
    if(m===15&&ix!=null){if(!s(1,1))t16(im,ix+1,iy+1,x*T,y*T);else if(!s(-1,1))t16(im,ix+2,iy+1,x*T,y*T);else if(!s(1,-1))t16(im,ix+1,iy+2,x*T,y*T);else if(!s(-1,-1))t16(im,ix+2,iy+2,x*T,y*T);}}};
  auto(1,'TilesetFloor',dk?11:0,7,dk?15:4,7);
  auto(2,'TilesetWater',0,6,4,6);
  // 들꽃: 풀밭 군데군데 무리지어
  for(let i=0;i<26;i++){const cx=Math.floor(R()*CW),cy=Math.floor(R()*CH),k=Math.floor(R()*4);
    for(let j=0;j<4;j++){const x=cx+Math.floor(R()*3)-1,y=cy+Math.floor(R()*2);if(at(x,y))continue;g.drawImage(TS.TilesetNature,[0,16,32,96][k],176,16,16,x*T+Math.floor(R()*10),y*T+Math.floor(R()*10),32,32);}}
  for(let i=0;i<60;i++){const x=Math.floor(R()*CW),y=Math.floor(R()*CH);if(at(x,y))continue;g.drawImage(TS.TilesetFloorDetail,Math.floor(R()*8)*16,32,16,16,x*T,y*T,32,32);}
  if(biome==='river')for(const y of [15,16,24])for(let x=0;x<=2;x++)t16('TilesetWater',6,13,x*T,y*T);
  if(CT==='coast'){spr('boat',280,-6);spr('boat',1180,-4);}
  else if(CT==='mountain'){for(let x=-20;x<W;x+=88)spr(R()<.5?'rockB':'rockG',x,-40+(x/88%2)*16);}
  else{const k=biome==='highland'?'rockG':'pine3';for(let x=-30;x<W;x+=104)spr(k,x,-44+((x/104|0)%2)*10);}
  (town.fields||[]).forEach(([x0,y0,w,h])=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const cx=x===x0?0:x===x0+w-1?2:1,cy=y===y0?0:y===y0+h-1?2:1;t16('TilesetField',cx,cy,x*T,y*T);
      g.drawImage(TS.Crops,[48,64,80][(x+y)%3],[16,48,80][(x0+y0)%3],16,16,x*T,y*T,32,32);}});
  if(CT==='fort'){for(let x=0;x<CW;x++){if(x===24||x===25)continue;t16('TilesetHouse',11,9,x*T,27*T);}for(let y=9;y<27;y++){t16('TilesetHouse',11,8,0,y*T);t16('TilesetHouse',11,8,(CW-1)*T,y*T);}}
  (town.bgs||[]).forEach(([k,x,y])=>spr(k,x,y));
  return bg;
}
/* ===================== Tiny Swords 마을 ===================== */
const TSI={};const tsi=p=>TSI[p]||(TSI[p]=Object.assign(new Image(),{src:'assets/ts/'+p}));
const TSPRE=['Terrain/Ground/Tilemap_Flat.png','Terrain/Ground/Tilemap_Elevation.png','Terrain/Ground/Shadows.png','Terrain/Water/Water.png','Terrain/Water/Foam/Foam.png','Terrain/Bridge/Bridge_All.png','Terrain/Water/Rocks/Rocks_01.png','Terrain/Water/Rocks/Rocks_02.png','Resources/Trees/Tree.png','Resources/Sheep/HappySheep_Idle.png','Resources/Gold Mine/GoldMine_Active.png','Resources/Resources/G_Idle.png','Resources/Resources/M_Idle.png','Resources/Resources/W_Idle.png','Factions/Goblins/Buildings/Wood_House/Goblin_House.png','rpg/Soldier_Idle.png','rpg/Soldier_Walk.png','rpg/Orc_Idle.png','rpg/Orc_Walk.png','rpg/Soldier_Attack01.png','rpg/Orc_Attack01.png','Factions/Knights/Troops/Dead/Dead.png','Factions/Goblins/Troops/Torch/Red/Torch_Red.png','Factions/Goblins/Troops/TNT/Red/TNT_Red.png','Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png'].concat(...['Blue','Red','Yellow','Purple'].map(c=>[`Factions/Knights/Buildings/House/House_${c}.png`,`Factions/Knights/Buildings/Tower/Tower_${c}.png`,`Factions/Knights/Buildings/Castle/Castle_${c}.png`,`Factions/Knights/Troops/Pawn/${c}/Pawn_${c}.png`,`Factions/Knights/Troops/Warrior/${c}/Warrior_${c}.png`,`Factions/Knights/Troops/Archer/${c}/Archer_${c==='Purple'?'Purlple':c}.png`])).concat(Array.from({length:18},(_,i)=>`Deco/${String(i+1).padStart(2,'0')}.png`));
TSPRE.forEach(tsi);
const tsOK=()=>TSPRE.every(p=>TSI[p].complete&&TSI[p].naturalWidth);
const TSC=['Blue','Red','Yellow','Purple'];
const tsUnit=(k,c)=>k==='pawn'?`Factions/Knights/Troops/Pawn/${c}/Pawn_${c}.png`:k==='warrior'?`Factions/Knights/Troops/Warrior/${c}/Warrior_${c}.png`:`Factions/Knights/Troops/Archer/${c}/Archer_${c==='Purple'?'Purlple':c}.png`;
// 건물 그림: 원본 크기 그대로 캔버스에 담고 화면엔 0.5배
function tsArt(parts,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;parts.forEach(([p,x,y,sx,sy,sw,sh])=>{if(p[0]==='@'){const S=SP[p.slice(1)],k=S[5]||2;g.drawImage(TS[S[0]],S[1],S[2],S[3],S[4],x,y,S[3]*k,S[4]*k);return;}const im=tsi(p);if(sw)g.drawImage(im,sx,sy,sw,sh,x,y,sw,sh);else g.drawImage(im,x,y);});return{c,w:w/2,h:h/2,fw:w/2*.78,fd:Math.min(30,h/2*.28),ts:1};}
const TSB=(c)=>({house:`Factions/Knights/Buildings/House/House_${c}.png`,tower:`Factions/Knights/Buildings/Tower/Tower_${c}.png`,castle:`Factions/Knights/Buildings/Castle/Castle_${c}.png`});
function tsBuilding(id,nc,lv,kind){
  const C=castleCol(nc),B=TSB(C),R0='Resources/Resources/',D='Deco/',K=town&&town.ts?town.ts.K:'';
  if(K==='desert')switch(id){ // 사막 교역도시: 사암 건물 (닌자 사막)
    case 'castle':if(kind==='hall')return tsArt([['@dTower',0,0],['@dWall',140,120],['@dWall',284,120],['@dTower',424,0],['@dDome',212,24]],568,264);break;
    case 'barracks':return tsArt([['@dTower',40,0],['@fBanner',0,150],['@fBanner',190,150]],240,264);
    case 'tavern':return tsArt([['@dL',0,0],['@fBarrel',292,150],['@fBarrel',300,124]],330,192);
    case 'temple':return tsArt([['@dLion',0,96],['@dDome',96,0],['@dLion',240,96]],336,240);
    case 'library':return tsArt([['@d2st',0,0],['@dPot',196,96]],244,192);
    case 'home':return tsArt([['@dHut',10,0],['@dPot',0,96],['@dPot',150,96]],200,144);
    case 'alley':return tsArt([['@dFlat',0,0]],192,144);
    case 'manor':return tsArt([['@dHC',40,0],['@dPalm1',0,96],['@dPalm1',196,96]],292,192);
    case 'market':return tsArt([['@dAwnB',0,40],['@dAwnR',100,40],['@dAwnY',200,40],[R0+'G_Idle.png',-10,70],[R0+'W_Idle.png',90,70],[R0+'M_Idle.png',190,70]],300,190);
  }
  if(K==='mountain')switch(id){ // 산골 광산 마을: 이끼 낀 돌집 (닌자 산골)
    case 'castle':if(kind==='hall')return tsArt([['@vA',40,0],['@fBanner',0,150],['@fBanner',240,150]],290,240);break;
    case 'tavern':return tsArt([['@vLodge',0,0],['@fBarrel',196,170],['@fSignL',200,130]],250,240);
    case 'home':return tsArt([['@vMoss',10,0],['@cPot1',0,120],['@cPot2',150,120]],170,144);
    case 'alley':return tsArt([['@vHut',0,0]],192,144);
  }
  switch(id){
    case 'castle':if(kind==='hall')return tsArt([['@fanBigs',20,0],['@fBanner',0,140],['@fBanner',352,140]],410,262);
      if(lv<=1)return tsArt([[B.castle,0,0]],320,256);
      if(lv===2)return tsArt([[B.tower,0,10],[B.tower,432,10],[B.castle,110,10]],560,266);
      return tsArt([[B.tower,0,30],[B.tower,560,30],[B.tower,90,0],[B.tower,470,0],[B.castle,184,30]],688,286);
    case 'barracks':return tsArt([[B.tower,40,0],['@fBanner',0,140],['@fBanner',174,140],['@fTable',150,200]],240,286);
    case 'tavern':return tsArt([['@fanLo',0,0],['@fBarrel',320,186],['@fBarrel',326,160],['@fSignL',300,140]],364,230);
    case 'temple':return tsArt([['@fanSw',26,0],['@cLamp',0,126],['@cLamp',206,126]],232,212);
    case 'library':return tsArt([['@fanSs',0,0],['@fSignL',166,150]],222,212);
    case 'tower':return tsArt([[TSB('Purple').tower,0,0]],128,256);
    case 'ruin':return tsArt([['Factions/Goblins/Buildings/Wood_House/Goblin_House.png',0,0]],128,192);
    case 'home':return tsArt([['@cotR',10,0],['@cPot1',0,170],['@cPot2',150,170]],170,196);
    case 'alley':return tsArt([['Factions/Goblins/Buildings/Wood_House/Goblin_House.png',0,0],[D+'14.png',100,140]],176,192);
    case 'market':return tsArt([['@awn',0,40],['@awn2',100,40],['@awn',200,40],[R0+'G_Idle.png',-10,60],[R0+'W_Idle.png',90,60],[R0+'M_Idle.png',190,60]],300,190);
    case 'manor':return tsArt([['@fan2b',20,0],['@fBanner',0,136],['@fBanner',252,136]],306,262);
    case 'board':return tsArt([['@fBoard',0,0]],92,88);
    case 'gate':return tsArt([[B.tower,0,0],[B.tower,256,0]],384,256);
  }
  return tsArt([[B.house,0,0]],128,192);
}
// 배치 (월드 좌표, 아래쪽 가운데 기준)
const TSLAY={castle:[800,270],barracks:[130,468],tavern:[370,468],board:[900,470],temple:[1210,468],manor:[1440,468],home:[190,764],alley:[560,764],market:[1040,744],library:[1330,764],tower:[1520,700],gate:[800,862]};
function tsLayoutTown(p,C,CT,biome,R,N,nc,cap){
  const CW=50,CH=29,land=new Uint8Array(CW*CH),plat=new Uint8Array(CW*CH),sand=new Uint8Array(CW*CH),water2=new Uint8Array(CW*CH);
  const I=(x,y)=>y*CW+x,inb=(x,y)=>x>=0&&y>=0&&x<CW&&y<CH;
  const nz=[];for(let i=0;i<64;i++)nz.push(R());const sm=v=>{const i=Math.floor(v),f=v-i,u=f*f*(3-2*f);return nz[((i%64)+64)%64]*(1-u)+nz[(((i+1)%64)+64)%64]*u;};
  const sandB=new Uint8Array(CW*CH),plat2=new Uint8Array(CW*CH);
  // 도시 지형 종류
  const K=CT==='coast'?'coast':CT==='mountain'||(cap&&biome==='highland')?'mountain':CT==='forest'||(cap&&biome==='forest')?'forest':(CT==='river'||biome==='river')?'river':(CT==='marsh'||biome==='marsh')?'marsh':CT==='farm'?'farm':CT==='fort'?'fort':CT==='trade'?'desert':'plains';
  const dev=cap?3:Math.min(3,1+(CT==='trade'||CT==='coast'||CT==='fort'?1:0)+(N.size==='large'?1:0));
  land.fill(1);
  if(K==='coast'){for(let x=0;x<CW;x++){const d=3+Math.round(sm(x*.22)*3);for(let y=0;y<d;y++)land[I(x,y)]=0;}
    for(let x=0;x<CW;x++)for(let y=0;y<9;y++)if(land[I(x,y)]&&(!land[I(x,Math.max(0,y-1))]||!land[I(x,Math.max(0,y-2))]))sandB[I(x,y)]=1;
    [8,40].forEach(c=>{for(let y=0;y<CH&&!land[I(c,y)];y++)water2[I(c,y)]=1;});}
  const rivW=new Uint8Array(CW*CH);
  if(K==='river'){for(let y=0;y<CH;y++){const c=1.7+sm(y*.23+3)*1.1;for(let x=Math.floor(c-1.15);x<=Math.floor(c+1.15);x++)if(inb(x,y)){land[I(x,y)]=0;rivW[I(x,y)]=1;if(y===15||y===16||y===24)water2[I(x,y)]=1;}}}
  if(K==='marsh'){[[5,3,3,2],[44,4,3,3],[13,20,3,2],[31,21,3,2],[43,20,2,2],[3,25,4,2],[36,26,4,2]].forEach(([x0,y0,w,h])=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(inb(x,y)&&((x-x0-(w-1)/2)**2/((w/2+.3)**2)+(y-y0-(h-1)/2)**2/((h/2+.3)**2))<=1.05)land[I(x,y)]=0;});}
  if(K==='desert'){sandB.fill(1);const oval=(cx,cy,rx,ry)=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const d=((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2+(sm(x*.7+y*1.3)-.5)*.5;if(d<1)sandB[I(x,y)]=0;}};oval(6.8,5.2,4.6,3.2);oval(44,20.5,3.6,2.6);
    for(let y=4;y<6;y++)for(let x=5;x<8;x++)land[I(x,y)]=0;}
  if(K==='farm'){[[2,25,7,3],[27,25,8,3],[40,25,6,3],[1,18,4,4]].forEach(([x0,y0,w,h])=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(inb(x,y))sandB[I(x,y)]=1;});}
  // 건물 자리와 시작 위치는 반드시 땅
  const fillL=(x0,y0,x1,y1)=>{for(let y=Math.max(0,Math.floor(y0/32));y<=Math.min(CH-1,Math.floor(y1/32));y++)for(let x=Math.max(0,Math.floor(x0/32));x<=Math.min(CW-1,Math.floor(x1/32));x++)if(!rivW[I(x,y)])land[I(x,y)]=1;};
  Object.entries(TSLAY).forEach(([k,[x,y]])=>{if(k==='castle'&&K==='coast')return;fillL(x-70,y-90,x+70,y+30);});fillL(150,740,260,820);
  // 고지대
  const p0=K==='coast'?[16,6,33,9]:K==='mountain'?[3,1,47,9]:[15,1,34,9];
  for(let y=p0[1];y<p0[3];y++)for(let x=p0[0];x<p0[2];x++)if(land[I(x,y)])plat[I(x,y)]=1;
  [[p0[0],p0[3]-1],[p0[2]-1,p0[3]-1],[p0[0],p0[1]],[p0[2]-1,p0[1]]].forEach(([x,y])=>plat[I(x,y)]=0);
  if(K==='mountain'){for(let y=1;y<5;y++)for(let x=14;x<36;x++)plat2[I(x,y)]=1;for(let x=4;x<12;x++)for(let y=1;y<4;y++)plat2[I(x,y)]=1;}
  // 모래길
  const S=(x,y)=>{if(inb(x,y)&&land[I(x,y)])sand[I(x,y)]=1;};
  for(let x=1;x<CW-1;x++){S(x,15);S(x,16);}
  for(let y=p0[3]+1;y<CH;y++){S(24,y);S(25,y);}
  if(dev>=2)for(let x=3;x<=44;x++)S(x,24);
  if(dev>=2)for(let y=17;y<24;y++){S(10,y);S(38,y);}
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++)if(Math.hypot(x+.5-25,y+.5-16)<(dev>=3?3.6:2.6))S(x,y);
  // 건물
  town.ts={land,plat,plat2,sand,sandB,water2,CW,CH,p0,K,dev,anim:[],coast:[]};
  const placed=[],box=(x,y,w,h,m)=>[x-w/2-m,y-h-m,x+w/2+m,y+m],hit=b=>placed.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1]);
  const MIR=!cap&&(p.home+(p.city||0))%2===1;town.ts.mir=MIR;
  TOWNB.forEach(d=>{const L=TSLAY[d.id];d.x=MIR?W-L[0]:L[0];d.y=L[1];});
  if(K==='river'&&!MIR)TOWNB.find(d=>d.id==='barracks').x=170;
  TOWNB.forEach(d=>{let kind=d.kind,n=d.n,ic=d.ic,lv=1;
    if(d.id==='tower'&&!N.tower)kind='ruin';
    if(d.id==='castle'){if(cap)lv={small:1,medium:2,large:3}[N.size];else{kind=CT==='fort'?'castle':'hall';n=CT==='fort'?'요새 사령부':'영주관';ic='🏯';}}
    const a=tsBuilding(kind==='ruin'?'ruin':d.id,nc,lv,kind);
    town.b.push({...d,n,ic,kind,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h*.9,ok:!(d.id==='tower'&&!N.tower)});placed.push(box(d.x,d.y,a.w,a.h,4));
    const c=Math.floor(d.x/32);if(['castle','gate','board','market'].includes(d.id))return;
    if(d.y<520)for(let y=Math.floor((d.y-6)/32);y<15;y++)S(c,y);else if(d.y<770)for(let y=Math.floor((d.y-6)/32);y<24;y++)S(c,y);else for(let y=24;y<Math.floor(d.y/32);y++)S(c,y);});
  // 집
  const nh=[0,5,8,11][dev]+(cap?3:0),slots=[[260,764],[470,300],[110,300],[290,300],[650,764],[920,764],[1190,764],[1420,300],[1250,300],[460,764],[1450,764],[660,468],[1060,468],[180,620],[1340,620],[720,620],[880,620]];
  let k=0;slots.forEach(([x0,y],i)=>{const x=town.ts.mir?W-x0:x0;if(k>=nh)return;const col=i%3===0?castleCol(nc):TSC[(i+p.home)%4],vr=(i*5+p.home*3+(p.city||0))%6,a=K==='desert'?tsArt([['@'+['dHut','dFlat','dHC','dHut','d2st','dFlat'][vr],0,0]],vr===1||vr===5?192:vr===2||vr===4?192:144,vr===2||vr===4?192:144):K==='mountain'&&vr!==0?tsArt([['@'+['vMoss','vMoss','vA','vMoss','vLodge'][vr-1],0,0]],vr===3||vr===5?192:144,vr===3||vr===5?240:144):vr<3?tsArt([[TSB(col).house,0,0]],128,192):vr<5?tsArt([['@'+['cotR','cotB','cotG','cotP'][(i+p.home)%4],0,0]],148,194):tsArt([['@'+['fanSy','fanSo'][i%2],0,0]],180,210),b=box(x,y,a.w,a.h,4);
    const onRoad=()=>{const cy=Math.floor((y-6)/32);for(let cx=Math.floor((x-a.w*.4)/32);cx<=Math.floor((x+a.w*.4)/32);cx++)if(inb(cx,cy)&&(sand[I(cx,cy)]||!land[I(cx,cy)]))return true;return false;};
    const fc=Math.floor((y-6)/32),fx=Math.floor(x/32),face=fc>0&&(plat[I(fx,fc-1)]&&!plat[I(fx,fc)]||plat2[I(fx,fc-1)]&&!plat2[I(fx,fc)]);
    if(face||hit(b)||onRoad()||!land[I(Math.floor(x/32),Math.floor((y-4)/32))]||plat[I(Math.floor(x/32),Math.floor((y-4)/32))])return;placed.push(b);town.deco.push({x,y,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h,door:{x,y:y+6}});k++;
    const c=Math.floor(x/32);if(y<520)for(let yy=Math.floor((y-6)/32);yy<15;yy++)S(c,yy);else if(y<700)for(let yy=Math.floor((y-6)/32);yy<15;yy++)S(c,yy);else for(let yy=Math.floor((y-6)/32);yy<24;yy++)S(c,yy);});
  // 규칙: 건물·집 밑에는 길이 깔리지 않는다 (길은 문 앞까지만)
  {const clr=(x,y,w,h)=>{for(let cy=Math.floor((y-h*.55)/32);cy<=Math.floor((y-6)/32);cy++)for(let cx=Math.floor((x-w*.4)/32);cx<=Math.floor((x+w*.4)/32);cx++)if(inb(cx,cy))sand[I(cx,cy)]=0;};
    town.b.forEach(b=>{if(b.id!=='board'&&b.id!=='gate')clr(b.x,b.y,b.a.w,b.a.h);});town.deco.forEach(o=>{if(o.door)clr(o.x,o.y,o.a.w,o.a.h);});
    // 어디로도 이어지지 않는 막다른 샛길은 걷어낸다 (문 앞 길은 남김)
    const anc=new Set();town.b.concat(town.deco.filter(o=>o.door)).forEach(b=>{const c=Math.floor(b.x/32),r=Math.floor((b.y-6)/32)+1;for(let d=-1;d<=1;d++)anc.add(r*CW+c+d);});
    for(let it=0;it<40;it++){let ch=0;for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const i=I(x,y);if(!sand[i]||anc.has(i))continue;let n=0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const xx=x+dx,yy=y+dy;if(!inb(xx,yy)||sand[I(xx,yy)]||water2[I(xx,yy)])n++;});if(n<=1){sand[i]=0;ch++;}}if(!ch)break;}
    for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const i=I(x,y);if(!sand[i])continue;let n=0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const xx=x+dx,yy=y+dy;if(inb(xx,yy)&&sand[I(xx,yy)])n++;});if(!n)sand[i]=0;}}
  // 나무 (움직임)
  const free=(x,y,r)=>{const cx=Math.floor(x/32),cy=Math.floor(y/32);if(!inb(cx,cy)||!land[I(cx,cy)]||sand[I(cx,cy)])return false;return !hit([x-r,y-r*2,x+r,y+4]);};
  const tree=(x,y)=>{if(!free(x,y,22))return false;placed.push([x-20,y-60,x+20,y+4]);town.deco.push({x,y,tsTree:1,ph:R()*4,fw:16,fd:8});return true;};
  if(dev>=3){for(let x=100;x<W-60;x+=130){if(Math.abs(x-800)<110)continue;[[x,474],[x,566]].forEach(([lx,ly])=>{if(!hit([lx-8,ly-44,lx+8,ly]))town.deco.push({x:lx,y:ly,a:tsArt([['@cLamp',0,0]],24,84),fw:6,fd:4});});}
    [[700,600],[900,600]].forEach(([x,y])=>{if(!hit([x-12,y-60,x+12,y]))town.deco.push({x,y,a:tsArt([['@fBanner',0,0]],52,122),fw:8,fd:4});});
    {const a=tsArt([['@fanWell',0,0]],116,154);const x=MIR?1000:600,y=420;if(!hit([x-30,y-77,x+30,y])){placed.push([x-32,y-80,x+32,y+4]);town.deco.push({x,y,a,fw:44,fd:16});}}}
  if(dev<=1){town.folk.splice(0,0);}
  const T=town.ts;const fieldCell=(x,y)=>{const cx=Math.floor(x/32),cy=Math.floor(y/32);return inb(cx,cy)&&(K==='farm'&&sandB[I(cx,cy)]);};
  const freeD=(x,y,r)=>free(x,y,r)&&!fieldCell(x,y);
  const tree2=(x,y)=>{if(!freeD(x,y,22))return false;placed.push([x-20,y-60,x+20,y+4]);if(K==='desert'){const a=tsArt([['@dPalm1',0,0]],96,96);town.deco.push({x,y,a,fw:12,fd:6});return true;}town.deco.push({x,y,tsTree:1,ph:R()*4,sc:.8+R()*.4,fw:16,fd:8});return true;};
  if(K==='fort'){const tc=castleCol(nc);[[60,150],[W-60,150],[60,520],[W-60,520],[60,880],[W-60,880]].forEach(([x,y])=>{const a=tsArt([[TSB(tc).tower,0,0]],128,256);if(!hit([x-32,y-128,x+32,y])){placed.push([x-34,y-130,x+34,y+4]);town.deco.push({x,y,a,fw:a.fw,fd:a.fd});}});}
  // 가장자리 숲 띠 (섬이 아니라 육지 도시)
  const belt=K==='forest'?3:K==='desert'?0:K==='coast'?1:2;
  const edgeT=(x,y)=>{if(R()<.18){const k=[7,8,9][Math.floor(R()*3)];if(freeD(x,y,10))town.deco.push({x,y,tsDeco:k,fw:0,fd:0});return;}tree2(x,y);};
  for(let j=0;j<belt;j++){const dep=(v)=>sm(v*.13+j*7)*40;
    for(let x=20;x<W;x+=46+R()*30){if(K!=='coast')edgeT(x,50+j*44+dep(x));edgeT(x,H-4-j*40-dep(x+50));}
    for(let y=110;y<H-50;y+=44+R()*28){edgeT(22+j*42+dep(y+90),y);edgeT(W-22-j*42-dep(y+130),y);}}
  const nt=K==='forest'?22:K==='desert'?5:K==='mountain'?5:K==='farm'?4:6;let t=0;
  const nearRoad=(x,y,r)=>{const cx=Math.floor(x/32),cy=Math.floor(y/32);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(inb(cx+dx,cy+dy)&&sand[I(cx+dx,cy+dy)])return true;return false;};
  for(let i=0;i<1500&&t<nt;i++){const x=80+R()*(W-160),y=80+R()*(H-160);if(nearRoad(x,y,1))continue;if(tree2(x,y)){t++;if(R()<.75){tree2(x+30+R()*10,y+10);tree2(x-28,y+18);if(R()<.5)tree2(x+4,y+34);}}}
  // 장식
  const dec=(k,x,y)=>{if(!freeD(x,y,10))return;town.deco.push({x,y,tsDeco:k,fw:k>=4&&k<=6?18:0,fd:k>=4&&k<=6?6:0});};
  const DK={forest:[7,8,9,1,2,3,10,11],marsh:[1,2,3,7,10,11,8],mountain:[4,5,6,4,5,6,7,10],desert:[4,5,6,14,15,4,5],farm:[7,8,10,11,12,13],coast:[4,5,7,10,11],plains:[7,8,9,10,11,4,1],river:[7,8,10,11,1,2],fort:[4,5,7,10,14]}[K]||[7,8,9];
  for(let i=0;i<120;i++){const x=40+R()*(W-80),y=60+R()*(H-120);if(i>=34)break;if(nearRoad(x,y,1)&&R()<.7)continue;dec(DK[Math.floor(R()*DK.length)],x,y);}
  if(K==='farm'){[[2,25,7,3],[27,25,8,3],[40,25,6,3],[1,18,4,4]].forEach(([x0,y0,w,h])=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if((x+y)%2===0&&inb(x,y)&&!sand[I(x,y)])town.deco.push({x:x*32+16,y:y*32+26,tsDeco:(x*7+y)%3?13:12,fw:0,fd:0});});
    town.deco.push({x:150,y:890,tsDeco:18,fw:20,fd:8},{x:1000,y:890,tsDeco:18,fw:20,fd:8});}
  if(K==='plains'){town.deco.push({x:300,y:700,tsDeco:18,fw:20,fd:8});}
  // 소품 (Fan-tasy): 길가 가로등·이정표·모닥불·꽃밭·바위·덤불 — 길 위와 건물 위에는 두지 않는다
  {const put=(x,y,o,r)=>{if(!freeD(x,y,r||10))return false;placed.push([x-(r||10),y-(r||10)*2,x+(r||10),y+4]);town.deco.push(Object.assign({x,y},o));return true;};
    const art=(k,w,h)=>tsArt([['@'+k,0,0]],w,h);
    if(dev>=2&&dev<3)for(let x=150;x<W-100;x+=250+R()*60){if(Math.abs(x-800)<140)continue;put(x,474,{a:art('fLamp',96,128),fw:6,fd:4},8);}
    put(MIR?W-760:760,470,{a:art('fSignL',52,48),fw:6,fd:4},8);if(dev>=2)put(MIR?W-300:300,760,{a:art('fSignL',52,48),fw:6,fd:4},8);
    const tv=town.b.find(b=>b.id==='tavern'),bk=town.b.find(b=>b.id==='barracks');
    [[tv,70],[bk,-70]].forEach(([b,dx])=>{if(b)put(b.x+dx,b.y+40,{fan:'camp',fw:18,fd:8},14);});
    if(K!=='desert'){let n=0;for(let i=0;i<300&&n<(K==='forest'||K==='farm'?22:14);i++){if(put(60+R()*(W-120),90+R()*(H-150),{fan:R()<.5?'flowR':'flowW',ph:R()*8,fw:0,fd:0},14))n++;}
      let b2=0;for(let i=0;i<200&&b2<10;i++){if(put(60+R()*(W-120),90+R()*(H-150),{a:art('fBush',84,62),fw:24,fd:8},20))b2++;}}
    const rk=['fRock1','fRock2','fRock3','fRock4','fRock5'],RW={fRock1:[54,52],fRock2:[28,26],fRock3:[18,22],fRock4:[30,58],fRock5:[56,26]};
    const nr=K==='mountain'?14:K==='desert'?10:6;let r2=0;for(let i=0;i<200&&r2<nr;i++){const k=rk[Math.floor(R()*5)];if(put(60+R()*(W-120),90+R()*(H-150),{a:art(k,...RW[k]),fw:k==='fRock1'?22:8,fd:6},16))r2++;}
    const mk=town.b.find(b=>b.id==='market');if(mk){put(mk.x-120,mk.y+10,{a:art('fCrate',34,46),fw:12,fd:6},10);put(mk.x+124,mk.y+8,{a:art('fBarrel',36,44),fw:12,fd:6},10);put(mk.x+150,mk.y+14,{a:art('fSack',36,32),fw:10,fd:4},10);}
    if(tv){put(tv.x-110,tv.y+6,{a:art('fBarrel',36,44),fw:12,fd:6},10);put(tv.x-130,tv.y+14,{a:art('fCrate',34,46),fw:12,fd:6},10);}
    if(K==='farm'){[[120,600],[470,880],[1250,880]].forEach(([x,y])=>put(MIR?W-x:x,y,{a:art('fHay',64,66),fw:24,fd:8},16));}
    if(K==='desert'){put(MIR?W-1180:1180,600,{a:art('dWell',96,96),fw:30,fd:12},26);for(let i=0;i<10;i++)tree2(130+R()*260,60+R()*230);put(MIR?W-1400:1400,860,{a:art('dPool',96,96),fw:40,fd:14},30);}
  }
  if(K==='mountain'){town.deco.push({x:1180,y:250,tsMine:1,fw:80,fd:24},{x:420,y:250,tsMine:1,fw:80,fd:24});for(let i=0;i<10;i++)dec(6,100+R()*1400,300+R()*500);}
  if(K==='desert'){for(let i=0;i<5;i++)town.deco.push({x:880+i*40,y:610+(i%2)*20,res:['G','W','M'][i%3],fw:20,fd:8});}
  // 양
  const nsh=K==='farm'?9:K==='plains'||K==='river'?4:K==='mountain'?3:0,px=K==='farm'?250:150,py=K==='farm'?640:180;
  for(let i=0;i<nsh;i++){town.folk.push({x:px+R()*120-60,y:py+R()*80-40,sheep:1,face:1,mv:false,tx:null,ty:null,w:R()*3,hid:0,sp:14,crit:{x:px,y:py,r:80}});}
  // 물 속 바위
  if(K==='coast')for(let i=0;i<7;i++)T.anim.push({rock:1+(i%2),x:60+R()*(W-120),y:10+R()*60,ph:R()*8});
}
const FW_ROAD={"1":[12],"4":[19],"5":[32],"7":[13],"16":[0],"17":[6],"20":[26],"21":[39],"23":[10],"28":[1],"29":[16],"31":[7,66,67,68],"64":[21],"65":[33],"68":[20],"69":[38],"71":[22],"80":[27],"81":[44],"84":[45],"85":[46],"87":[34],"92":[4],"93":[28],"95":[42],"112":[3],"113":[5],"116":[17],"117":[29],"119":[40],"124":[2,69,70,71],"125":[36],"127":[31],"193":[15],"197":[11],"199":[14,60,61,62],"209":[23],"213":[35],"215":[43],"221":[41],"223":[25],"241":[9,63,64,65],"245":[37],"247":[24],"253":[30],"255":[8,48,49,50,54,55,56]};
const FW_WAT={"1":[48],"4":[73],"5":[122],"7":[49,290],"16":[0],"17":[24],"20":[98],"21":[147],"23":[28],"28":[1,288],"29":[52],"31":[25,240,244,266],"64":[75],"65":[123],"68":[74],"69":[146],"71":[76],"80":[99],"81":[170],"84":[171],"85":[172],"87":[168],"92":[4],"93":[144],"95":[124],"112":[3,289],"113":[5],"116":[53],"117":[145],"119":[148],"124":[2,241,245,267],"125":[100],"127":[121],"193":[51,291],"197":[29],"199":[50,243,265,269],"209":[77],"213":[169],"215":[125],"221":[149],"223":[97],"241":[27,242,264,268],"245":[101],"247":[96],"253":[120],"255":[26,192,193,194]};
// Fan-tasy 47-블롭 자동타일: mask(x,y)는 16px 칸 단위. 반환 [타일번호,x,y]
function fanTiles(mask,SW,SH,tbl,one){const out=[];for(let y=0;y<SH;y++)for(let x=0;x<SW;x++){if(!mask(x,y))continue;const n=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=SW||yy>=SH?true:mask(xx,yy);};
  const T=n(0,-1),Rr=n(1,0),B=n(0,1),L=n(-1,0),k=(T?1:0)|(T&&Rr&&n(1,-1)?2:0)|(Rr?4:0)|(Rr&&B&&n(1,1)?8:0)|(B?16:0)|(B&&L&&n(-1,1)?32:0)|(L?64:0)|(L&&T&&n(-1,-1)?128:0);
  const ids=tbl[k]||tbl[255],h=((x*73856093)^(y*19349663))>>>0,id=one||ids.length===1||h%10<6?ids[0]:ids[1+h%(ids.length-1)];out.push([id,x,y]);}return out;}
function tsTownBg(){
  const T=town.ts,CW=T.CW,CH=T.CH,bg=document.createElement('canvas');bg.width=W*2;bg.height=H*2;let g=bg.getContext('2d');g.imageSmoothingEnabled=false;
  const F=tsi('Terrain/Ground/Tilemap_Flat.png'),E=tsi('Terrain/Ground/Tilemap_Elevation.png'),I=(x,y)=>y*CW+x;
  const t64=(im,sx,sy,x,y)=>g.drawImage(im,sx*64,sy*64,64,64,x*64,y*64,64,64);
  const auto=(mask,im,ox,oy)=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!mask(x,y))continue;const s=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=CW||yy>=CH?true:mask(xx,yy);};
    const m=(s(0,-1)?1:0)|(s(1,0)?2:0)|(s(0,1)?4:0)|(s(-1,0)?8:0),a=AUTO[m];t64(im,ox+a[0],oy+a[1],x,y);}};
  const L=(x,y)=>T.land[I(x,y)]===1,P=(x,y)=>T.plat[I(x,y)]===1,P2=(x,y)=>T.plat2[I(x,y)]===1,Sd=(x,y)=>T.sand[I(x,y)]===1&&!T.plat[I(x,y)];
  const SB=(x,y)=>L(x,y)&&T.sandB[I(x,y)]===1,G=(x,y)=>LL(x,y)&&!T.sandB[I(x,y)];
  const IN=T.K!=='coast',LL=(x,y)=>IN||L(x,y);
  const tint={forest:'saturate(1.15) brightness(.86)',marsh:'hue-rotate(28deg) saturate(.7) brightness(.82)',mountain:'saturate(.75) brightness(.95)',farm:'saturate(1.2) brightness(1.04)',fort:'saturate(.85)',coast:'saturate(1.05)'}[T.K]||'none';
  auto(LL,F,5,0);
  const layer=(fn)=>{if(tint==='none'){fn(g);return;}const c=document.createElement('canvas');c.width=bg.width;c.height=bg.height;const gg=c.getContext('2d');gg.imageSmoothingEnabled=false;fn(gg);g.filter=tint;g.drawImage(c,0,0);g.filter='none';};
  const autoTo=(gg,mask,im,ox,oy)=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!mask(x,y))continue;const s=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=CW||yy>=CH?true:mask(xx,yy);};
    const m=(s(0,-1)?1:0)|(s(1,0)?2:0)|(s(0,1)?4:0)|(s(-1,0)?8:0),a=AUTO[m];gg.drawImage(im,(ox+a[0])*64,(oy+a[1])*64,64,64,x*64,y*64,64,64);}};
  layer(gg=>autoTo(gg,G,F,0,0));
  const sh=tsi('Terrain/Ground/Shadows.png');
  const cliff=(PM,face)=>{if(T.K==='desert'&&!g.__d){const c=document.createElement('canvas');c.width=bg.width;c.height=bg.height;const gg=c.getContext('2d');gg.imageSmoothingEnabled=false;gg.__d=1;const g0=g;g=gg;cliff(PM,face);g=g0;g.filter='sepia(.7) saturate(1.2) hue-rotate(-10deg) brightness(1.12)';g.drawImage(c,0,0);g.filter='none';return;}for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!PM(x,y)||y+1>=CH||PM(x,y+1))continue;g.drawImage(sh,0,0,192,192,x*64-64,(y+1)*64-40,192,192);}
    for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!PM(x,y)||y+1>=CH||PM(x,y+1))continue;const l=PM(x-1,y),r=PM(x+1,y),cx=!l&&!r?3:!l?0:!r?2:1,stairs=face&&(x===24||x===25);
      if(stairs)t64(E,x===24?0:2,7,x,y+1);else t64(E,cx,3,x,y+1);}
    layer(gg=>autoTo(gg,PM,F,T.K==='desert'?5:0,0));};
  if(T.dev>=3){const SA={...AUTO,2:[0,1],10:[1,1],8:[2,1],0:[3,1]};const stone=gg=>{for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!Sd(x,y))continue;const s2=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=CW||yy>=CH?true:Sd(xx,yy);};
      const m=(s2(0,-1)?1:0)|(s2(1,0)?2:0)|(s2(0,1)?4:0)|(s2(-1,0)?8:0),a=SA[m];gg.drawImage(E,a[0]*64,a[1]*64,64,64,x*64,y*64,64,64);}};
    if(T.K==='desert'){const c=document.createElement('canvas');c.width=bg.width;c.height=bg.height;const gg=c.getContext('2d');gg.imageSmoothingEnabled=false;stone(gg);g.filter='sepia(.85) saturate(1.3) hue-rotate(-8deg) brightness(1.08)';g.drawImage(c,0,0);g.filter='none';}else stone(g);}
  else{fanTiles((x,y)=>Sd(x>>1,y>>1),CW*2,CH*2,FW_ROAD).forEach(([id,x,y])=>g.drawImage(TS.FanRoad,(id%6)*16,((id/6)|0)*16,16,16,x*32,y*32,32,32));}
  cliff(P,true);
  if(T.K==='mountain'){cliff(P2,false);}
  const BR=tsi('Terrain/Bridge/Bridge_All.png');
  T.brg=[];if(T.K==='river'){const rows=[];for(let y=0;y<CH;y++)if(T.water2.slice(y*CW,y*CW+CW).some(v=>v))rows.push(y);
    const grp=[];rows.forEach(y=>{const gq=grp[grp.length-1];if(gq&&gq[1]===y-1)gq[1]=y;else grp.push([y,y]);});
    grp.forEach(([ya,yb])=>{let xa=99,xb=-1;for(let y=ya;y<=yb;y++)for(let x=0;x<CW;x++)if(T.water2[I(x,y)]){xa=Math.min(xa,x);xb=Math.max(xb,x);}
      const h=(yb-ya+1)*32-(yb>ya?16:0),yy=ya*32+(yb>ya?8:0),x0=xa*32-16,x1=(xb+1)*32-16;T.brg.push([0,x0,yy,h]);for(let xx=x0+32;xx<x1;xx+=32)T.brg.push([1,xx,yy,h]);T.brg.push([2,x1,yy,h]);});}
  for(let x=0;x<CW;x++)for(let y=0;y<CH;y++){if(!T.water2[I(x,y)])continue;
    if(T.K==='river'){}
    else{const top=!T.water2[I(x,y-1)]||y===0,bot=L(x,y+1);g.drawImage(BR,0,top?64:bot?192:128,64,64,x*64,y*64,64,64);}}
  // 물가는 칸 모서리를 둥글게 깎아 자연스럽게
  const Wc=(x,y)=>x<0||y<0||x>=CW||y>=CH?(T.K==='river'?!L(Math.max(0,Math.min(CW-1,x)),Math.max(0,Math.min(CH-1,y))):false):!L(x,y);
  const Ws=(sx,sy)=>{const cx=sx>>1,cy=sy>>1,dx=(sx&1)?1:-1,dy=(sy&1)?1:-1;if(Wc(cx,cy))return Wc(cx+dx,cy)||Wc(cx,cy+dy);return Wc(cx+dx,cy)&&Wc(cx,cy+dy)&&Wc(cx+dx,cy+dy);};
  T.fwat=IN?fanTiles(Ws,CW*2,CH*2,FW_WAT,true):[];
  T.coast=[];if(!IN)for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){if(!L(x,y))continue;let c=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<CW&&yy<CH&&!L(xx,yy))c=true;}if(c)T.coast.push([x,y,(x*7+y*3)%8]);}
  return bg;
}
function tsDrawSheet(path,fw,fh,fx,fy,x,y,sc,flip,ox,oy){const im=tsi(path);if(!im.complete)return;ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);ctx.drawImage(im,fx*fw,fy*fh,fw,fh,-fw*sc*(ox==null?.5:ox),-fh*sc*(oy==null?.5:oy),fw*sc,fh*sc);ctx.restore();}
function drawTSPerson(f,t){
  if(f.dir===2)f.face=-1;else if(f.dir===3)f.face=1;
  if(f.sheep){tsDrawSheet('Resources/Sheep/HappySheep_Idle.png',128,128,Math.floor(t/120+f.x)%8,0,f.x,f.y,.4,f.face<0,.5,.66);return;}
  const k=f.tsk||'pawn',c=f.tsc||'Blue',sz=f.sz||1;
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(f.x,f.y,9*sz,3,0,0,7);ctx.fill();
  if(k==='rpg'){const mv=f.mv,fr=Math.floor(t/(mv?90:140)+f.x)%(mv?8:6);tsDrawSheet(mv?'rpg/Soldier_Walk.png':'rpg/Soldier_Idle.png',100,100,fr,0,f.x,f.y,1.45*sz,(f.face||1)<0,.5,.6);return;}
  const row=f.mv?(k==='pawn'&&f.carry?5:1):(k==='pawn'?(f.carry?4:(f.work||0)):(f.atk?2:0)),fr=Math.floor(t/100+f.x*.1)%6;
  if(f.hue)ctx.filter=`hue-rotate(${f.hue}deg)`;
  tsDrawSheet(tsUnit(k,c),192,192,fr,row,f.x,f.y,(k==='warrior'?.42:.5)*sz,(f.face||1)<0,.5,k==='warrior'?.71:.66);
  if(f.hue)ctx.filter='none';
}
function drawMeTS(m,t){
  if(m.dir===2)m.face=-1;else if(m.dir===3)m.face=1;
  const mv=m.mv,im=mv?'rpg/Soldier_Walk.png':'rpg/Soldier_Idle.png',n=mv?8:6,fr=Math.floor(t/(mv?90:140))%n;
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(m.x,m.y,10,3.5,0,0,7);ctx.fill();
  tsDrawSheet(im,100,100,fr,0,m.x,m.y,1.6,(m.face||1)<0,.5,.6);
}
function drawTSTown(z){
  const T=town.ts,t=performance.now(),p=PP();
  ctx.fillStyle='#47aba9';ctx.fillRect(-400,-400,W+800,H+800);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const fo=tsi('Terrain/Water/Foam/Foam.png'),f8=Math.floor(t/110);
  for(const [x,y,o] of T.coast)ctx.drawImage(fo,((f8+o)%8)*192,0,192,192,x*32-32,y*32-32,96,96);
  for(const a of T.anim)if(a.rock){const im=tsi(`Terrain/Water/Rocks/Rocks_0${a.rock}.png`);ctx.drawImage(im,(Math.floor(t/140+a.ph)%8)*128,0,128,128,a.x-32,a.y-32,64,64);}
  ctx.drawImage(town.bg,0,0,W,H);
  if(T.fwat&&T.fwat.length){ctx.imageSmoothingEnabled=false;const wf=Math.floor(t/300)%4;for(const [id,x,y] of T.fwat)ctx.drawImage(TS.FanWater,((id%24)+wf*6)*16,((id/24)|0)*16,16,16,x*16,y*16,16,16);
    ctx.imageSmoothingEnabled=true;const BR=tsi('Terrain/Bridge/Bridge_All.png');for(const [k,x,y,h] of T.brg||[])ctx.drawImage(BR,k*64,0,64,64,x,y,32,h||32);}
  const L=[],tr=tsi('Resources/Trees/Tree.png');
  town.b.forEach(b=>L.push({y:b.y,d:()=>ctx.drawImage(b.a.c,Math.round(b.x-b.a.w/2),Math.round(b.y-b.a.h),b.a.w,b.a.h)}));
  town.deco.forEach(o=>L.push({y:o.y,d:()=>{
    if(o.tsTree){const k=o.sc||1;ctx.drawImage(tr,(Math.floor(t/180+o.ph)%4)*192,0,192,192,o.x-48*k,o.y-88*k,96*k,96*k);}
    else if(o.tsDeco){const im=tsi(`Deco/${String(o.tsDeco).padStart(2,'0')}.png`);const w=im.naturalWidth/2,h=im.naturalHeight/2;ctx.drawImage(im,o.x-w/2,o.y-h*.85,w,h);}
    else if(o.res){ctx.drawImage(tsi(`Resources/Resources/${o.res}_Idle.png`),o.x-32,o.y-48,64,64);}
    else if(o.fan){const f8=Math.floor(t/110+(o.ph||0))%8;ctx.imageSmoothingEnabled=false;if(o.fan==='camp')ctx.drawImage(TS.FanCamp,f8*32,0,32,32,o.x-16,o.y-26,32,32);else ctx.drawImage(o.fan==='flowR'?TS.FanFlowR:TS.FanFlowW,Math.floor(t/160+(o.ph||0))%8*96,0,32,32,o.x-16,o.y-24,32,32);ctx.imageSmoothingEnabled=true;}
    else if(o.tsMine){ctx.drawImage(tsi('Resources/Gold Mine/GoldMine_Active.png'),o.x-48,o.y-64,96,64);}
    else if(o.a&&o.a.ts)ctx.drawImage(o.a.c,Math.round(o.x-o.a.w/2),Math.round(o.y-o.a.h),o.a.w,o.a.h);
    else if(o.a)ctx.drawImage(o.a.c,Math.round(o.x-o.a.w/2),Math.round(o.y-o.a.h));}}));
  town.folk.forEach(f=>{if(f.hid>0)return;L.push({y:f.y,d:()=>drawTSPerson(f,t)});});
  town.npcs.forEach(n=>L.push({y:n.y,d:()=>drawTSPerson(n,t)}));
  const m=town.me;L.push({y:m.y,d:()=>{ctx.strokeStyle='#ffd34d';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(m.x,m.y,12,4,0,0,7);ctx.stroke();drawMeTS(m,t);}});
  L.sort((a,b)=>a.y-b.y).forEach(o=>o.d());
  if(town.kt){const md=moodOf(),em=['💢','💧','♥'][md];ctx.font='13px sans-serif';ctx.textAlign='center';
    town.folk.forEach((f,i)=>{if(!f.bub||f.hid>0||f.sheep)return;const ph=(t/1000+i*1.7)%7;if(ph>2.4)return;const y=f.y-40;
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.strokeStyle='#3a2a1a';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(f.x,y,10,8,0,0,7);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(f.x-3,y+7);ctx.lineTo(f.x,y+12);ctx.lineTo(f.x+3,y+7);ctx.fill();
      ctx.fillStyle='#000';ctx.fillText(em,f.x,y+5);});}
  ctx.imageSmoothingEnabled=false;
}
function initTown(force){
  const p=PP();if(!p)return;const ci=p.city||0,C=cityOf(p),CT=C.t;
  if(town&&town.home===p.home&&town.city===ci&&!force)return;
  const R=srng(p.home*7919+ci*313+17),N=NINFO[p.home],nc=NATIONS[p.home].col,biome=C.b;
  const rr=(a,b)=>a+R()*(b-a),cap=CT==='capital';
  town={home:p.home,city:ci,b:[],deco:[],folk:[],npcs:[],me:{x:200,y:786,path:[],face:1,dir:0,mv:false,enter:null},near:null,open:null,camFree:0,top:CT==='coast'||CT==='mountain'?190:130};
  town.nob=[];
  if(biome==='river')town.nob.push([0,0,72,H]);if(biome==='marsh')town.nob.push([384,800,96,64],[1280,800,96,64],[416,320,64,64]);
  if(CT==='fort')town.nob.push([0,0,40,H],[W-40,0,40,H],[0,860,W,40]);
  const TSM=tsReady();if(TSM){town.top=40;tsLayoutTown(p,C,CT,biome,R,N,nc,cap);}else if(tsReady())layoutTown(p,C,CT,biome,R,N,nc,cap);else{
  TOWNB.forEach(d=>{let kind=d.kind,o={roof:nc},n=d.n,ic=d.ic;
    if(d.id==='tower'&&!N.tower)kind='ruin';
    if(d.id==='castle'){if(cap)o={roof:nc,lv:{small:1,medium:2,large:3}[N.size]};else{kind=CT==='fort'?'castle':'hall';o={roof:nc,lv:1};n=CT==='fort'?'요새 사령부':'영주관';ic='🏯';}}
    if(d.id==='barracks'||d.id==='home'||d.id==='gate'||d.id==='manor')o.acc=nc;
    const a=bArt(kind,o);town.b.push({...d,n,ic,kind,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h*.9,ok:!(d.id==='tower'&&!N.tower)});});
  const all=town.b.slice();
  const nh=Math.round(({small:10,medium:15,large:20}[N.size]+(cap?6:0))*(tsReady()?.7:1)),roofs=['#e8735a','#f0a050','#a88ae0','#5aa8d8','#e86a8a','#70b870',nc],walls=['#fff0d8','#ffe4e0','#f4f0e4','#e8f0ff','#fff8c8'];
  for(let i=0,n=0;i<600&&n<nh;i++){const big=R()<(cap?.5:.3),a=bArt(big?'house2':'house',{v:Math.floor(R()*6),roof:roofs[Math.floor(R()*roofs.length)],wall:walls[Math.floor(R()*walls.length)]});
    const x=rr(40,W-40),y=rr(170,H-30);if(!townFree(x,y,a.w*.95,a.h*.85,all))continue;const o={x,y,a,fw:a.fw,fd:a.fd,vw:a.w,vh:a.h*.85,door:{x:a.spr?x:x-a.w*.18,y:y+8}};all.push(o);town.deco.push(o);n++;}
  const nt=CT==='forest'?110:biome==='forest'?80:CT==='farm'?30:45;
  for(let i=0,n=0;i<900&&n<nt;i++){const a=bArt('tree',{v:Math.floor(R()*12)});const edge=R()<.65,x=edge?(R()<.5?rr(14,140):rr(W-140,W-14)):rr(20,W-20),y=edge?rr(140,H-10):rr(150,H-10);
    if(!townFree(x,y,a.spr?a.w*.55:14,a.spr?a.h*.7:10,all))continue;const o={x,y,a,fw:a.spr?a.w*.3:8,fd:a.spr?10:6,tree:1};all.push(o);town.deco.push(o);n++;}
  [{k:'fountain',x:800,y:540},{k:'well',x:440,y:640},{k:'well',x:1180,y:610}].forEach(q=>{const a=bArt(q.k);if(q.k==='well'&&a.spr&&!townFree(q.x,q.y,a.w*.8,a.h*.8,town.deco.concat(town.b)))return;town.deco.push({x:q.x,y:q.y,a,fw:a.fw*.9,fd:a.spr&&q.k==='well'?24:10,vw:a.w,vh:a.h*.8});});
  if(CT==='fort')[[110,300],[1490,300],[110,820],[1490,820]].forEach(([x,y])=>{const a=bArt('watch',{acc:nc});town.deco.push({x,y,a,fw:20,fd:12});});
  if(CT==='mountain'||CT==='farm'){const a=bArt(CT==='farm'?'granary':'forge',{});if(townFree(1430,690,a.fw,a.fd,all)){town.deco.push({x:1430,y:690,a,fw:a.fw,fd:a.fd});}}
  }
  if(TSM){town.bg=tsTownBg();fixSpawn();}else if(tsReady())town.bg=tileTownBg(p,C,CT,biome,R);else{
  // 바닥
  const bg=document.createElement('canvas');bg.width=W;bg.height=H;const g=bg.getContext('2d'),G=T_GROUND[biome];
  g.fillStyle=G;g.fillRect(0,0,W,H);
  for(let i=0;i<2600;i++){g.fillStyle=R()<.5?hx(G,.9):hx(G,1.08);g.fillRect(Math.floor(R()*W/2)*2,Math.floor(R()*H/2)*2,R()<.3?4:2,2);}
  for(let i=0;i<60;i++){const x=Math.floor(R()*W),y=Math.floor(R()*H),c=['#ff9ab0','#ffe08a','#c0a0ff','#ffffff','#ff7a7a'][i%5];for(let k=0;k<6;k++){const fx=x+Math.floor(R()*16),fy=y+Math.floor(R()*10);g.fillStyle='#4a8a3a';g.fillRect(fx,fy+2,1,2);g.fillStyle=c;g.fillRect(fx-1,fy,3,2);}}
  for(let i=0;i<200;i++){g.fillStyle=['#ff9ab0','#ffe08a','#c0a0ff','#ffffff'][i%4];g.fillRect(Math.floor(R()*W),Math.floor(R()*H),2,2);}
  if(CT==='coast'){ // 북쪽 바다·모래사장·부두
    for(let x=0;x<W;x+=2){const sh=150+Math.sin(x/60)*10+Math.sin(x/23)*4;g.fillStyle='#e8d8a0';g.fillRect(x,0,2,sh+22);g.fillStyle='#3f7fc0';g.fillRect(x,0,2,sh);g.fillStyle='#5a9ad8';g.fillRect(x,0,2,sh-30);g.fillStyle='#e8f4ff';g.fillRect(x,sh-3,2,3);}
    for(let i=0;i<120;i++){g.fillStyle='#8ac0f0';g.fillRect(rr(0,W),rr(10,120),8,2);}
    g.fillStyle='#7a5030';g.fillRect(1080,40,30,140);g.fillRect(1020,40,150,24);for(let x=1022;x<1170;x+=8){g.fillStyle='#5a3a20';g.fillRect(x,42,2,20);}
    [[1000,60],[1200,90],[300,70]].forEach(([x,y])=>{g.fillStyle='#6a4020';g.fillRect(x,y,60,14);g.fillStyle='#8a5a30';g.fillRect(x+4,y-4,52,6);g.fillStyle='#4a2a10';g.fillRect(x+28,y-40,3,40);g.fillStyle='#f0ece0';g.fillRect(x+31,y-38,18,24);});
  }else if(CT==='mountain'){
    for(let x=0;x<W;x+=4){const h=120+Math.sin(x/110)*40+Math.sin(x/37)*14;g.fillStyle='#6a6458';g.fillRect(x,0,4,h);g.fillStyle='#8a8478';g.fillRect(x,0,4,h-30);g.fillStyle='#e8e8f0';g.fillRect(x,0,4,Math.max(0,h-110));g.fillStyle='#4a4438';g.fillRect(x,h-6,4,6);}
    g.fillStyle='#1a1410';g.fillRect(1380,150,40,34);g.fillStyle='#5a3a20';g.fillRect(1376,146,48,6);g.fillRect(1376,146,6,40);g.fillRect(1418,146,6,40);
    for(let i=0;i<40;i++){const x=rr(40,W-40),y=rr(160,H-20);g.fillStyle='#7a7468';g.fillRect(x,y,12,7);g.fillStyle='#9a9488';g.fillRect(x+2,y,7,2);}
  }else{
    for(let x=0;x<W;x+=4){const h=50+Math.sin(x/90)*18+Math.sin(x/37)*8;g.fillStyle=biome==='highland'?'#7a7468':'#3f6a3a';g.fillRect(x,0,4,h);g.fillStyle=biome==='highland'?'#5a5448':'#2f5a2e';g.fillRect(x,h-6,4,6);}
  }
  if(biome==='highland'&&CT!=='mountain')for(let i=0;i<30;i++){const x=rr(40,W-40),y=rr(140,H-20);g.fillStyle='#7a7468';g.fillRect(x,y,10,6);g.fillStyle='#9a9488';g.fillRect(x+2,y,6,2);}
  if(biome==='marsh')for(let i=0;i<30;i++){const x=rr(40,W-40),y=rr(150,H-20);g.fillStyle='#4a6a6a';g.fillRect(x,y,26,8);g.fillStyle='#6a9aa0';g.fillRect(x+4,y+2,14,2);g.fillStyle='#3f7a3a';g.fillRect(x+20,y-6,2,6);g.fillRect(x+24,y-8,2,8);}
  if(biome==='river'){for(let y=0;y<H;y+=2){const x=110+Math.sin(y/70)*20;g.fillStyle='#4a7ab0';g.fillRect(x,y,46,2);g.fillStyle='#7ab0d8';g.fillRect(x+8+((y*7)%20),y,6,2);}}
  if(CT==='farm'||biome==='plains'){[[60,780,180,90],[1400,180,170,90],[60,180,170,80]].forEach(([x,y,w,h],i)=>{if(i===2&&CT!=='farm')return;for(let j=0;j<h;j+=6){g.fillStyle=j%12?(i===1?'#c8b050':'#9ac050'):'#8a7a40';g.fillRect(x,y+j,w,4);}});}
  if(CT==='fort'){g.fillStyle='#8a8478';g.fillRect(96,280,8,560);g.fillRect(1496,280,8,560);g.fillRect(96,836,1408,8);}
  const road=(x,y,w,h)=>{g.fillStyle='#8a7a5a';g.fillRect(x-2,y-2,w+4,h+4);g.fillStyle='#b9a98a';g.fillRect(x,y,w,h);for(let i=0;i<w*h/60;i++){g.fillStyle=R()<.5?'#a8987a':'#c8b898';g.fillRect(x+Math.floor(R()*(w-6)),y+Math.floor(R()*(h-4)),6,4);}};
  road(0,498,W,46);road(778,300,46,H-300);
  for(let i=0;i<72;i+=2){const ww=2*Math.sqrt(72*72-i*i);g.fillStyle='#c4b494';g.fillRect(800-ww/2,520-i,ww,2);g.fillRect(800-ww/2,520+i,ww,2);}
  TOWNB.forEach(b=>{if(b.id==='castle'||b.id==='gate'||b.id==='board')return;const y0=b.y<520?b.y+4:546,y1=b.y<520?498:b.y+14;g.fillStyle='#a8946a';g.fillRect(b.x-9,y0,18,y1-y0);});
  if(biome==='river'){g.fillStyle='#6a4a2a';g.fillRect(96,494,74,54);g.fillStyle='#8a6a3a';for(let x=98;x<168;x+=6)g.fillRect(x,496,4,50);}
  for(let x=120;x<W-60;x+=180){if(Math.abs(x-800)<80)continue;[492,552].forEach(y=>{g.fillStyle='#3a3a4a';g.fillRect(x,y-26,3,26);g.fillStyle='#ffe08a';g.fillRect(x-3,y-32,9,7);g.fillStyle='#3a3a4a';g.fillRect(x-4,y-34,11,2);});}
  const hm=TOWNB.find(b=>b.id==='home');g.fillStyle='#c89a6a';for(let x=hm.x-60;x<=hm.x+60;x+=10){if(Math.abs(x-hm.x)<14)continue;g.fillRect(x,hm.y+22,3,10);}g.fillRect(hm.x-60,hm.y+25,46,2);g.fillRect(hm.x+14,hm.y+25,46,2);
  town.bg=bg;}
  // 주민 (스프라이트)
  const nf={small:14,medium:20,large:26}[N.size]+(cap?8:0);
  for(let i=0;i<nf;i++)town.folk.push({x:rr(60,W-60),y:rr(504,540),ch:FOLK_CH[Math.floor(R()*FOLK_CH.length)],dir:0,mv:false,tx:null,ty:null,w:R()*2,hid:0,sp:rr(26,40)});
  const hb=TOWNB.find(b=>b.id==='home'),ani=(a,n,x,y,r,sp)=>{for(let i=0;i<n;i++)town.folk.push({x:x+rr(-r,r),y:y+rr(-r*.3,r*.3),an:a,face:1,mv:false,tx:null,ty:null,w:R()*3,hid:0,sp,crit:{x,y,r}});};
  ani('Chicken',3,hb.x,hb.y+45,55,18);ani(pick(['Cat','CatOrange'])==='CatOrange'?'Cat':'Cat',1,rr(300,1300),590,120,22);ani('Dog',1,rr(300,1300),600,140,30);
  if(CT==='farm'){ani('Cow',3,150,860,60,10);ani('Pig',2,1150,866,50,14);}
  if(CT==='mountain'||CT==='fort')ani('Horse',2,1100,866,60,16);
  if(CT==='trade'||cap)ani('Donkey',1,1060,792,60,12);
  {const cb=town.b.find(b=>b.id==='castle');[[-1],[1]].forEach(([dx])=>town.folk.push({x:800+dx*44,y:cb.y+(town.ts?10:16),ch:'Knight',dir:0,st:1}));}
  // 이름 있는 NPC
  cityNpcs(p).forEach((n,i)=>{const b=TOWNB.find(x=>x.id===n.at)||TOWNB[0],off=(i%2?1:-1)*(46+(i%3)*14),dy=town.ts&&b.id==='castle'?12:26;
    town.npcs.push({...n,x:b.x+off,y:Math.min(H-12,b.y+dy+(i%2)*4),hx:b.x+off,hy:Math.min(H-14,b.y+dy),dir:0,mv:false,tx:null,ty:null,w:R()*4});});  if(TSM){const myc=castleCol(nc);town.folk=town.folk.filter(f=>!f.an);
    town.folk.forEach(f=>{if(f.sheep)return;if(f.st){f.tsk='warrior';f.tsc=myc;f.face=1;return;}const r=R();f.tsk=r<.62?'pawn':r<.78?'archer':r<.9?'warrior':'rpg';f.tsc=R()<.3?myc:TSC[Math.floor(R()*4)];f.work=f.tsk==='pawn'&&R()<.35?(R()<.5?2:3):f.tsk==='pawn'&&R()<.2?5:0;f.carry=f.work===5;if(f.carry)f.work=0;f.face=R()<.5?1:-1;f.sz=.86+R()*.2;f.hue=f.tsk==='pawn'&&R()<.5?Math.round((R()-.5)*60):0;});
    const RT={guard:['warrior',myc],smith:['pawn','Red'],priest:['pawn','Purple'],scholar:['archer','Blue'],merch:['pawn','Yellow'],inn:['pawn','Yellow']};
    town.npcs.forEach((n,i)=>{const r=RT[n.role]||(n.nat?['warrior',TSC[(i+1)%4]]:[['pawn','archer','warrior'][i%3],TSC[(i+p.home)%4]]);n.tsk=r[0];n.tsc=r[1];n.face=1;});}
}
function folkTarget(f){
  if(f.crit){f.tx=f.crit.x+rnd(-f.crit.r,f.crit.r);f.ty=f.crit.y+rnd(-f.crit.r*.4,f.crit.r*.4);if(townBlocked(f.tx,f.ty))f.tx=null;f.goIn=false;return;}
  if(Math.random()<.55){const all=town.b.concat(town.deco.filter(o=>o.door));const b=pick(all);const d=b.door||{x:b.x,y:b.y+10};f.tx=d.x;f.ty=d.y;f.goIn=true;}
  else{if(Math.random()<.7){f.tx=rnd(30,W-30);f.ty=rnd(504,540);}else{f.tx=rnd(784,816);f.ty=rnd(310,H-20);}f.goIn=false;}
}
// 지형 규칙: 물(다리·부두 제외)과 절벽면은 사람도 동물도 지나갈 수 없다
function terrBlocked(x,y){
  if(!town||!town.ts)return false;const T=town.ts,cx=Math.floor(x/32),cy=Math.floor(y/32);if(cx<0||cy<0||cx>=T.CW||cy>=T.CH)return true;const i=cy*T.CW+cx;
  if(!T.land[i]&&!T.water2[i])return true;
  if(cy===T.p0[3]&&T.plat[(cy-1)*T.CW+cx]&&cx!==24&&cx!==25)return true;
  if(cy>0&&T.plat2[(cy-1)*T.CW+cx]&&!T.plat2[i])return true;
  return false;}
function fixSpawn(){const m=town.me?[town.me]:[];[...town.folk,...town.npcs,...m].forEach(f=>{if(!terrBlocked(f.x,f.y))return;f.x=Math.max(80,Math.min(W-80,f.x));f.y=522;if(f.hx!=null){f.hx=f.x;f.hy=f.y;}if(f.crit)f.crit={x:f.x,y:f.y,r:40};});}
function townBlocked(x,y){
  if(x<14||x>W-14||y<(town.top||128)||y>H-6)return true;
  if(terrBlocked(x,y))return true;
  for(const b of town.b)if(x>b.x-b.fw/2&&x<b.x+b.fw/2&&y>b.y-b.fd&&y<b.y-1)return true;
  for(const o of town.deco)if(x>o.x-o.fw/2&&x<o.x+o.fw/2&&y>o.y-o.fd&&y<o.y-1)return true;
  return false;
}
function stepMe(dx,dy){const m=town.me;if(dx||dy)m.dir=dirOf(dx,dy);
  if(!townBlocked(m.x+dx,m.y+dy)){m.x+=dx;m.y+=dy;return true;}
  if(dx&&!townBlocked(m.x+dx,m.y)){m.x+=dx;return true;}
  if(dy&&!townBlocked(m.x,m.y+dy)){m.y+=dy;return true;}
  return false;}
function segClear(a,b){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.ceil(d/8);for(let i=1;i<=n;i++){const t=i/n;if(townBlocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;}
function walkTo(x,y,enter){
  const m=town.me,T={x,y};m.enter=enter||null;
  if(townBlocked(x,y)&&!enter)return;
  if(segClear(m,T)){m.path=[T];}
  else{const a={x:m.x,y:521},b={x,y:521};m.path=segClear(m,a)?[a,b,T]:[b,T];}
}
const uiBusy=()=>!$('event').classList.contains('hidden')||!$('npcdlg').classList.contains('hidden')||!$('equip').classList.contains('hidden');
function tapTown(pt){
  if(!town||uiBusy())return;
  for(const n of town.npcs){if(Math.abs(pt.x-n.x)<16&&pt.y>n.y-34&&pt.y<n.y+6){walkTo(n.x,n.y+14,n);town.tap={x:n.x,y:n.y+14,t:performance.now()};return;}}
  for(const b of town.b){if(pt.x>b.x-b.a.w/2&&pt.x<b.x+b.a.w/2&&pt.y>b.y-b.a.h&&pt.y<b.y+14){walkTo(b.x,b.y+12,b);town.tap={x:b.x,y:b.y+12,t:performance.now()};return;}}
  walkTo(pt.x,pt.y);town.tap={x:pt.x,y:pt.y,t:performance.now()};
}
const openTarget=o=>town&&town.kt?(o&&o.role?ktTalk(o):ktBuilding(o)):o&&o.role?openNpc(o):openB(o);
function updTown(dt){
  if(!town)return;const m=town.me,SPD=150;
  for(const f of town.folk){if(f.st)continue;if(f.hid>0){f.hid-=dt;continue;}
    if(f.tx==null){f.w-=dt;f.mv=false;if(f.w<=0)folkTarget(f);continue;}
    const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);
    if(d<2){if(f.goIn)f.hid=rnd(2,7);f.tx=null;f.w=f.crit?rnd(1,5):rnd(.5,3);continue;}
    const s=Math.min(d,f.sp*dt);f.x+=dx/d*s;f.y+=dy/d*s;f.face=dx>=0?1:-1;f.dir=dirOf(dx,dy);f.mv=true;}
  for(const n of town.npcs){ // NPC는 자기 자리 근처를 서성인다
    if(npcUI===n){n.mv=false;n.dir=dirOf(m.x-n.x,m.y-n.y);continue;}
    if(n.tx==null){n.w-=dt;n.mv=false;if(n.w<=0){n.tx=n.hx+rnd(-30,30);n.ty=n.hy+rnd(-8,10);if(townBlocked(n.tx,n.ty))n.tx=null;n.w=rnd(2,6);}continue;}
    const dx=n.tx-n.x,dy=n.ty-n.y,d=Math.hypot(dx,dy);if(d<2){n.tx=null;continue;}const s=Math.min(d,18*dt),nx=n.x+dx/d*s,ny=n.y+dy/d*s;if(terrBlocked(nx,ny)){n.tx=null;continue;}n.x=nx;n.y=ny;n.dir=dirOf(dx,dy);n.mv=true;}
  let kx=0,ky=0;
  if(inTown()&&!uiBusy()){
    if(keys.has('arrowleft')||keys.has('a'))kx--;if(keys.has('arrowright')||keys.has('d'))kx++;
    if(keys.has('arrowup')||keys.has('w'))ky--;if(keys.has('arrowdown')||keys.has('s'))ky++;}
  if(kx||ky){m.path=[];m.enter=null;const l=Math.hypot(kx,ky);m.mv=stepMe(kx/l*SPD*dt,ky/l*SPD*dt);town.camFree=0;}
  else if(m.path.length){const q=m.path[0],dx=q.x-m.x,dy=q.y-m.y,d=Math.hypot(dx,dy);
    if(d<3){m.path.shift();if(!m.path.length){m.mv=false;if(m.enter){const b=m.enter;m.enter=null;openTarget(b);}}}
    else{const s=Math.min(d,SPD*dt);if(stepMe(dx/d*s,dy/d*s)){m.mv=true;m.stuck=0;}else if((m.stuck=(m.stuck||0)+dt)>.5){m.path=[];m.mv=false;m.stuck=0;if(m.enter&&Math.hypot(m.enter.x-m.x,m.enter.y-m.y)<70){openTarget(m.enter);}m.enter=null;}}}
  else m.mv=false;
  let nb=null,bd=48;town.b.forEach(b=>{const d=Math.hypot(b.x-m.x,b.y+12-m.y);if(d<bd){bd=d;nb=b;}});
  town.npcs.forEach(n=>{const d=Math.hypot(n.x-m.x,n.y-m.y)+6;if(d<Math.min(bd,40)){bd=d;nb=n;}});
  if(nb!==town.near){town.near=nb;updNear();}
  if(performance.now()>town.camFree&&inTown()){const tx=m.x-innerWidth/2/cam.z,ty=m.y-innerHeight/2/cam.z,k=Math.min(1,dt*5);cam.x+=(tx-cam.x)*k;cam.y+=(ty-cam.y)*k;clampCam();}
}
function drawTown(z){
  if(!town)return;
  const p=town.kt?town.kt.fp:PP(),t=performance.now(),m=town.me;
  if(town.ts)drawTSTown(z);else{
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(town.bg,0,0);
  const L=[];
  town.b.forEach(b=>L.push({y:b.y,d:()=>ctx.drawImage(b.a.c,Math.round(b.x-b.a.w/2),Math.round(b.y-b.a.h))}));
  town.deco.forEach(o=>L.push({y:o.y,d:()=>ctx.drawImage(o.a.c,Math.round(o.x-o.a.w/2),Math.round(o.y-o.a.h))}));
  town.folk.forEach(f=>{if(f.hid>0)return;L.push({y:f.y,d:()=>f.an?drawAnimal(f.an,f.x,f.y,f.face,f.mv,t):drawChar(f.ch,f.x,f.y,f.dir,f.mv,t)});});
  town.npcs.forEach(n=>L.push({y:n.y,d:()=>drawChar(n.ch,n.x,n.y,n.dir,n.mv,t)}));
  const m=town.me;
  L.push({y:m.y,d:()=>{ctx.strokeStyle='#ffd34d';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(m.x,m.y,11,4,0,0,7);ctx.stroke();drawChar(ROUTE_CH[p.route],m.x,m.y,m.dir,m.mv,t);}});
  L.sort((a,b)=>a.y-b.y).forEach(o=>o.d());
  }
  if(town.tap&&t-town.tap.t<700){const k=(t-town.tap.t)/700;ctx.strokeStyle=`rgba(255,211,77,${1-k})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(town.tap.x,town.tap.y,6+k*10,3+k*4,0,0,7);ctx.stroke();}
  const ts=Math.max(.75,.95/z);ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle='rgba(10,12,24,.9)';
  town.b.forEach(b=>{const near=b===town.near,y=b.y-b.a.h-6;
    ctx.font=`800 ${Math.round((near?13:11)*ts)}px sans-serif`;ctx.lineWidth=3.5*ts;const s=`${b.ic} ${b.n}`;
    ctx.strokeText(s,b.x,y);ctx.fillStyle=near?'#ffd34d':b.ok?'#ffffff':'#9aa3c4';ctx.fillText(s,b.x,y);
    const vq=activeNQ(p).some(q=>q.t==='visit'&&!q.done&&q.to===b.id&&q.city===(p.city||0));
    if(near||vq){const by=y-16*ts-Math.abs(Math.sin(t/200))*5;ctx.fillStyle=vq?'#7fd06a':'#ffd34d';ctx.font=`${Math.round(14*ts)}px sans-serif`;const ch=vq?'📦':'▼';ctx.strokeText(ch,b.x,by);ctx.fillText(ch,b.x,by);}});
  town.npcs.forEach(n=>{const s=npcSt(p,n.id),near=n===town.near;ctx.font=`800 ${Math.round(10*ts)}px sans-serif`;ctx.lineWidth=3*ts;
    const nm=n.nat?`✦ ${n.name}`:n.name;ctx.strokeText(nm,n.x,n.y-34);ctx.fillStyle=n.nat?'#ffc46b':near?'#ffd34d':'#e8f0ff';ctx.fillText(nm,n.x,n.y-34);
    const mark=s.active&&s.active.done?'❓':!s.active&&npcQuest(p,n)?'❗':'';
    if(mark){const by=n.y-48-Math.abs(Math.sin(t/220))*4;ctx.font=`${Math.round(14*ts)}px sans-serif`;ctx.fillText(mark,n.x,by);}});
  ctx.font=`800 ${Math.round(11*ts)}px sans-serif`;ctx.lineWidth=3*ts;const nm=`${p.name}`;ctx.strokeText(nm,m.x,m.y-36);ctx.fillStyle='#ffe08a';ctx.fillText(nm,m.x,m.y-36);
  const tint=[ 'rgba(255,220,160,.07)',null,null,'rgba(255,130,60,.13)'][Math.min(3,p.week||0)];
  if(tint){ctx.fillStyle=tint;ctx.fillRect(0,0,W,H);}
}
/* --- 시간·결과 진행 --- */
function popup(title,body,opts){
  $('evtitle').innerHTML=title;$('evbody').innerHTML=body;const bx=$('evbtns');bx.innerHTML='';
  (opts||[{l:'다음 ▶'}]).forEach(o=>{const b=document.createElement('button');b.className='big';b.innerHTML=o.l;b.style.fontSize='14px';
    b.onclick=()=>{show('event',false);if(o.f)o.f();};bx.appendChild(b);});
  show('event',true);show('tnear',false);
}
const sr=x=>Math.floor(x)+(Math.random()<x-Math.floor(x)?1:0);
const r1=x=>Math.round(x*10)/10;
const fmtSt=v=>Math.floor(v);
function ensureP1(p){
  ensureFriends(p);
  if(!p.spec)p.spec=JSON.parse(JSON.stringify(SPEC_INIT[p.route]));if(!p.perks)p.perks=[];if(p.moves==null)p.moves=0;
  if(!p.era)p.era=pick(Object.keys(ERAS));if(!p.flags)p.flags={};if(!p.done)p.done=[];if(p.week==null)p.week=0;
}
const weekBar=p=>`<span class="wk">${[0,1,2,3].map(i=>`<i class="${i<p.week?'used':i===p.week?'now':''}"></i>`).join('')}</span>`;
function doAct(A){
  const p=PP(),left=WK-p.week;
  if(A.wk>left)return toast('이번 달 남은 시간이 모자랍니다');
  if(A.dis)return toast(A.dis);
  p1PendWk=A.wk;
  const r=A.f();
  if(state!=='p1')return;
  p1PendWk=0;p.week+=A.wk;
  clampP1(p);checkPerks(p);KSTAT.forEach(k=>p.st[k]=Math.min(99,p.st[k]));syncMe();
  if(r)p1Log(p,r);
  renderP1();save();
  if(r===false||r===null)return afterAct();
  popup(A.l,`${r||''}<div class="sub" style="margin-top:8px">${A.wk?`⏳ ${A.wk}주가 지났다`:'⏳ 시간은 들지 않았다'} · 이번 달 남은 시간 ${WK-p.week}주 ${weekBar(p)}</div>`,[{l:'다음 ▶',f:afterAct}]);
}
function afterAct(){const p=PP();if(p.week>=WK)p1MonthEnd();else{renderP1();save();}}
function skipMonth(){
  const p=PP(),left=WK-p.week;
  if(left>0){const h=left*6;p.health=Math.min(100,p.health+h);p1Log(p,`남은 ${left}주를 쉬며 보냈다 (건강 +${h})`);}
  p.week=WK;closeB();p1MonthEnd();
}
function p1MonthEnd(skipEvent){
  const p=PP(),sum=[],L=t=>{p1Log(p,t);sum.push(t);};
  if(p._skipEv){skipEvent=true;p._skipEv=false;}
  p.month++;p.week=0;
  const hg=5+(p.era==='peace'?5:0);p.health=Math.min(100,p.health+hg);
  if(p.flags.war>0&&--p.flags.war===0)L('🕊 전쟁이 끝났다.');
  const fam=p.flags.famine>0;if(fam&&--p.flags.famine===0)L('🌾 기근이 끝났다.');
  const bandUp=Math.round((fam?1.5:1)*p.band*2),wage=heroes.filter(h=>!h.king).reduce((a,h)=>a+Math.ceil(h.wage/2),0);
  p.gold-=bandUp+wage;
  sum.push(`💸 무리 유지비 −${bandUp}${wage?` · 동료 급여 −${wage}`:''} · ❤ 건강 +${hg}`);
  if(p.gold<0){const lost=Math.min(p.band-1,3);p.band-=lost;p.gold=0;L(`<span class="danger">💸 돈이 없어 무리 ${lost}명이 떠났다</span>`);heroes.forEach(h=>{if(!h.king)h.loyalty=clampL(h.loyalty-10);});}
  heroes.forEach(h=>{if(h.newInj)h.newInj=false;else if(h.injured>0)h.injured--;});
  heroes=heroes.filter(h=>{if(!h.king&&h.loyalty<20&&Math.random()<.3){L(`<span class="danger">${h.name}이(가) 떠났다</span>`);return false;}return true;});
  genQuests(p);sum.push('📋 의뢰 게시판에 새 의뢰가 붙었다');
  ensureFriends(p);if(Math.random()<.25){const fs=p.friends.filter(f=>f.nat!==p.home&&(p.npc['fr-'+f.id]||{qi:0}).qi<3);if(fs.length){const f=pick(fs);p.visit={id:f.id,m:p.month};sum.push(`📨 ${NATIONS[f.nat].name}에 사는 ${f.rel} <b>${f.name}</b>이(가) 이번 달 선술집에 들른다고 편지를 보냈다!`);}}
  p.smith=Math.random()<.3;if(p.smith)sum.push('⚒ 떠돌이 대장장이가 성문 앞에 좌판을 폈다');
  if(p.month%3===0){genCompanions(p);sum.push('🍺 선술집에 새 얼굴들이 나타났다');}
  const SP=SPEC[p.route];if(SP.monthly)SP.monthly(p);
  checkPerks(p);KSTAT.forEach(k=>p.st[k]=Math.min(99,p.st[k]));syncMe();
  renderP1();save();
  popup(`📅 ${ageOf(p)}세, ${p.month}개월째 — 새 달이 밝았다`,sum.join('<br>'),[{l:'다음 ▶',f:()=>p1Event(skipEvent)}]);
}
function p1Event(skipEvent){
  const p=PP(),SP=SPEC[p.route];
  let forced=!skipEvent&&SP.forced?SP.forced(p):null,special=false;
  if(!forced&&!skipEvent&&Math.random()<(p.era==='chaos'?.16:.08)){
    const sp=SPECIAL.filter(x=>!p.done.includes(x.id)&&x.cond(p));
    if(sp.length){forced=pick(sp);p.done.push(forced.id);special=true;}
  }
  if(!forced&&(skipEvent||Math.random()>=.5))return finishTurn();
  let pool=P1EVENTS.filter(e=>!(e.t==='마탑의 시험'&&!NINFO[p.home].tower)&&!(e.t==='반란 모의'&&NINFO[p.home].stance==='중립')&&(!e.cond||e.cond(p))).concat(SP.events,SP.events);
  if(p.era==='war'||p.flags.war>0)pool=pool.concat(P1EVENTS.filter(e=>e.t==='국경 분쟁'||e.t==='늑대 떼'||e.t==='현상수배범'));
  if(p.era==='magic')pool=pool.concat(P1EVENTS.filter(e=>(e.t==='마탑의 시험'&&NINFO[p.home].tower)||e.t==='떠돌이 현자'||e.t==='떠돌이 마법사'));
  const e=forced||pick(pool);
  popup((special?'✨ 특수 사건: ':'📜 ')+e.t,e.txt,e.opts.map(o=>({l:o.l,f:()=>{const r=o.f(p);if(state!=='p1')return;clampP1(p);checkPerks(p);syncMe();
    if(r){p1Log(p,`${e.t}: ${r}`);renderP1();save();popup('결과',r,[{l:'다음 ▶',f:finishTurn}]);}else finishTurn();}})));
}
function finishTurn(){renderP1();save();updNear();}
/* --- 활동 정의 --- */
const trainGain=(p,k)=>r1((Math.max(1,Math.round(5-p.st[k]/20))+(k==='지략'&&p.era==='magic'?1:0))*.4);
const jobGoldOf=p=>Math.round({soldier:25,merchant:30+p.st.내정*.6,noble:22,mage:15,rebel:24}[p.route]*fitOf(p.home,p.route)*(p.era==='gold'?1.3:1)*(p.flags.famine>0?.6:1)*(CTYPE[cityOf(p).t].job[p.route]||1));
function crownReqs(p){
  const R=ROUTES[p.route],SP=SPEC[p.route],cr={...R.crown};
  if(hasPerk(p,'전쟁영웅')&&cr.fame)cr.fame-=15;if(p.flags&&p.flags.blood&&cr.fame)cr.fame-=20;if(hasPerk(p,'무역 제국')&&cr.gold)cr.gold-=500;
  return{cr,rl:reqList(p,cr).concat(SP.crownX?SP.crownX(p):[])};
}
function bActs(id,p){
  const R=ROUTES[p.route],SP=SPEC[p.route],A=[],mine=JOBB[p.route]===id;
  const add=(l,wk,tip,f,dis)=>A.push({l,wk,tip,f,dis:dis||false});
  const cnt=k=>{p.cnt=p.cnt||{};p.cnt[k]=(p.cnt[k]||0)+1;bumpCount(p,k);},cw=k=>{const a=A[A.length-1],f0=a.f;a.f=()=>{cnt(k);return f0();};};
  const tr=(k,cost,l,mul)=>{const g=r1(trainGain(p,k)*(mul||1));add(l,1,`${k} +${g}${cost?` · 💰−${cost}`:' · 무료'}`,()=>{p.gold-=cost;p.st[k]=r1(p.st[k]+g);return `${k} +${g} (현재 ${fmtSt(p.st[k])})`;},p.gold<cost&&'돈이 모자랍니다');};
  if(mine){const g=Math.round(jobGoldOf(p)*.35);
    add(`💼 ${R.job}`,1,`💰+${g}, ${R.main} +0.4, 가끔 명성 · 내 길의 일`,()=>{p.gold+=g;p.st[R.main]=r1(p.st[R.main]+.4);let x='';
      if(Math.random()<.4)x+=`, 명성 +${addFame(p,1)}`;if(p.route==='noble'){const n=sr(.7);p.net+=n;if(n)x+=`, 인맥 +${n}`;}if(p.route==='rebel'){const n=sr(.35);p.band+=n;if(n)x+=`, 무리 +${n}`;}
      return `${R.job}: 💰+${g}, ${R.main} +0.4${x}`;});
    SP.actions.forEach(X=>add(X.l,2,(typeof X.tip==='function'?X.tip(p):X.tip)+' · 내 길 전용',()=>X.f(p),X.dis&&X.dis(p)?'아직 조건이 안 됩니다':false));}
  switch(id){
    case 'home':
      add('🛌 쉬기',1,'건강 +12',()=>{p.health=Math.min(100,p.health+12);return '푹 쉬었다 (건강 +12)';},p.health>=100&&'이미 건강합니다');
      add('😴 오래 쉬기',2,'건강 +30',()=>{p.health=Math.min(100,p.health+30);return '며칠을 앓듯이 잤다 (건강 +30)';},p.health>=100&&'이미 건강합니다');
      add('🕯 밤새 독서',1,'지략 +0.3, 내정 +0.3, 건강 −4',()=>{p.st.지략=r1(p.st.지략+.3);p.st.내정=r1(p.st.내정+.3);p.health-=4;return '책을 붙들고 밤을 지새웠다.';});
      break;
    case 'barracks':
      tr('무예',0,'🗡 검술 훈련');cw('sword');tr('통솔',0,'🚩 진형 훈련');
      if(!mine)add('🛡 성벽 경비 일당',1,'💰+9, 무예 +0.2',()=>{p.gold+=9;p.st.무예=r1(p.st.무예+.2);return '하루 종일 성벽을 지켰다 (💰+9)';});
      break;
    case 'tavern':{
      const n=r1(4*(1+(p.st.매력-30)/60)*(p.era==='peace'?1.5:1)*.4);
      add('🗣 사교 모임',1,`💰−10, 인맥 약 +${n}`,()=>{p.gold-=10;const v=sr(n);p.net+=v;const f=Math.random()<.35?1:0;p.fame+=f;return `술잔을 나누며 사람들을 사귀었다 (인맥 +${v}${f?', 명성 +1':''})`;},p.gold<10&&'돈이 모자랍니다');
      const rc=Math.round((hasPerk(p,'민중의 영웅')?10:p.route==='rebel'?20:30)/3);
      add('👥 무리 모집',1,`💰−${rc}, 무리 +1 (매달 1인당 유지비 2)`,()=>{p.gold-=rc;p.band+=1;return `${pick(['떠돌이 검객','농부의 아들','퇴역 병사','사냥꾼','대장장이 견습생'])} 하나가 무리에 들어왔다 (무리 +1)`;},p.gold<rc?'돈이 모자랍니다':p.band>=40&&'무리가 가득 찼습니다');
      tr('매력',7,'🎻 이야기꾼 흉내 (말솜씨)');
      add('👂 소문 듣기',0,'시간 안 듦',()=>{const q=p.quests[0];return pick([`"요즘은 ${ERAS[p.era].n}이라 그런지… ${ERAS[p.era].txt}"`,q?`"게시판에 '${q.name}' 의뢰가 붙었다더군."`:'"게시판이 텅 비었더라고."',`"${NATIONS[pick([1,2,3,4,5].filter(k=>k!==p.home))].name} 쪽은 요즘 살기 좋다던데."`,'"왕성 사람들은 명성 높은 이를 좋아하지."','"근교 숲에 늑대가 늘었대. 사냥꾼들이 신났어."']);});
      const comp=heroes.filter(h=>!h.king);
      (p.pool||[]).forEach((h,i)=>{const cost=Math.round(h.cost*.5);
        add(`🤝 영입: <span style="color:${RARITY[h.rarity].col}">${h.name}</span>`,0,`[${RARITY[h.rarity].name}] Lv${h.lv}/${h.cap} ${CLS[h.type]} · ⚡${SKILLS[h.skill].name} · 잠재력 ${potGrade(h)} · 💰${cost}`,
          ()=>{p.gold-=cost;h.loyalty=60;heroes.push(h);p.pool=p.pool.filter(x=>x!==h);return `${h.name}이(가) 동료가 됐다! 즉위하면 장수가 된다.`;},p.gold<cost?'돈이 모자랍니다':comp.length>=3&&'동료는 3명까지');});
      break;}
    case 'temple':
      add('💊 치료받기',1,'💰−20, 건강 +25',()=>{p.gold-=20;p.health=Math.min(100,p.health+25);return '사제가 상처를 돌봐주었다 (건강 +25)';},p.gold<20?'돈이 모자랍니다':p.health>=100&&'이미 건강합니다');
      add('🙏 봉사 활동',1,`매력 +${r1(trainGain(p,'매력')*.8)}, 가끔 명성`,()=>{const g=r1(trainGain(p,'매력')*.8);p.st.매력=r1(p.st.매력+g);const f=Math.random()<.4?addFame(p,1):0;return `가난한 이들에게 빵을 나눴다 (매력 +${g}${f?`, 명성 +${f}`:''})`;});cw('serve');
      add('🕊 기도',1,'건강 +6, 다음 판정 운이 좋아질지도…',()=>{p.health=Math.min(100,p.health+6);return '마음이 고요해졌다 (건강 +6)';});
      break;
    case 'library':tr('지략',5,'📜 병법·역사 공부');tr('내정',5,'🧮 셈법·행정 공부');break;
    case 'market':
      if(!mine)add('📦 짐꾼 일',1,'💰+10, 무예 +0.2',()=>{p.gold+=10;p.st.무예=r1(p.st.무예+.2);return '하루 종일 짐을 날랐다 (💰+10)';});
      add('🛒 장비 상점',0,'무기·방어구·장신구를 사고팝니다 (매달 물건이 바뀜)',()=>{openEquip('shop');return false;});
      add('🍎 흥정 구경',1,'내정 +0.3, 매력 +0.2',()=>{p.st.내정=r1(p.st.내정+.3);p.st.매력=r1(p.st.매력+.2);return '상인들의 흥정에서 셈법을 배웠다.';});
      break;
    case 'manor':
      if(!mine){add('🧹 저택 잡일',1,'💰+8, 가끔 인맥',()=>{p.gold+=8;const v=sr(.4);p.net+=v;return `잡일을 했다 (💰+8${v?', 인맥 +1':''})`;});
        add('🎩 귀족 방문',1,'💰−15, 인맥 +2, 매력 +0.3 (인맥 15 필요)',()=>{p.gold-=15;p.net+=2;p.st.매력=r1(p.st.매력+.3);return '귀족과 차를 마셨다 (인맥 +2)';},p.net<15?'인맥 15가 필요합니다':p.gold<15&&'돈이 모자랍니다');}
      break;
    case 'tower':
      if(!NINFO[p.home].tower)break;
      if(!mine)tr('지략',15,'✨ 마법 강의 청강',1.3);
      break;
    case 'alley':
      if(!mine){add('🎲 도박',1,'💰20 걸기 (45%로 두 배)',()=>{p.gold-=20;if(Math.random()<.45){p.gold+=40;return '땄다! 💰+20';}return '잃었다… 💰−20';},p.gold<20&&'판돈이 없습니다');
        add('🕵 정보상',1,'💰−15, 인맥 +1~2',()=>{p.gold-=15;const v=rint(1,2);p.net+=v;return `쓸만한 연줄을 샀다 (인맥 +${v})`;},p.gold<15&&'돈이 모자랍니다');cw('info');}
      break;
    case 'castle':{
      const fin=p.rank>=R.ranks.length-1;
      if(!fin){const nx=R.ranks[p.rank+1],ok=reqOk(p,nx);
        add(`🎖 승진 신청: ${nx.n}`,0,reqList(p,nx).map(([t,o])=>`${o?'✔':'✘'} ${t}`).join(' · '),()=>{p.rank++;p.fame+=3;if(p.rank%2===0)genCompanions(p);return `🎖 ${R.ranks[p.rank].n}(으)로 승진했다!`;},!ok&&'아직 조건이 안 됩니다');}
      else{const {cr,rl}=crownReqs(p),ok=rl.every(x=>x[1]);
        add(R.battle?'⚔ 왕좌를 향한 결전':'💰 왕관을 산다',0,R.crownTxt+'<br>'+rl.map(([t,o])=>`${o?'✔':'✘'} ${t}`).join(' · '),()=>{
          if(!R.battle){p.gold-=Math.round(cr.gold*sm());becomeKing([`💰 ${p.name}이(가) 귀족들을 매수해 왕관을 썼다!`]);return null;}
          const mul={small:1,medium:1.3,large:1.7}[NINFO[p.home].size];
          startP1Quest({name:'왕좌를 건 결전',crown:true,battle:{spear:Math.round(8*mul),cav:Math.round(4*mul),archer:Math.round(5*mul),mage:Math.round(2*mul)},gold:0,fame:0});return null;},
          !isCap(p)?`왕좌 도전은 수도(${CITIES[p.home][0].n})에서만`:!ok?'아직 조건이 안 됩니다':R.battle&&p.health<30&&'건강이 30 이상이어야 합니다');}
      add('📯 궁정 청원',1,'매력 판정 → 명성 +2, 인맥 +1',()=>{if(Math.random()<chk(p.st.매력,30)){p.fame+=2;p.net+=1;return '청원이 받아들여졌다 (명성 +2, 인맥 +1)';}return '문지기에게 쫓겨났다…';});
      break;}
    case 'board':
      (p.quests||[]).forEach(o=>{const info=o.battle?`⚔ 전투: ${ORDER.filter(t=>o.battle[t]).map(t=>TYPES[t].name+o.battle[t]).join(' ')}`:`🎲 ${o.check} 판정 (성공률 ${Math.round(chk(p.st[o.check],o.dc)*100)}%)`;
        add(`${o.battle?'⚔':'📜'} ${o.name}`,2,`${o.txt} · ${info} · 보상 💰${o.gold} 명성 ${Math.round(o.fame*fitOf(p.home,p.route))}${o.net?` 인맥 ${o.net}`:''}`,()=>{
          p.quests=p.quests.filter(x=>x!==o);
          if(o.battle){startP1Quest(o);return null;}
          if(Math.random()<chk(p.st[o.check],o.dc)){p.gold+=o.gold;const f=addFame(p,o.fame);p.net+=o.net||0;p.st[o.check]=r1(p.st[o.check]+1);let x=lootChance(.2,p1Lv(),'의뢰 보상');if(biomeOf(p)==='highland'&&Math.random()<.1)x+=(x?'<br>':'')+giveUnique('u_thunder_hammer','광산 깊은 곳에서 발견');return `✔ ${o.name} 성공: 💰+${o.gold}, 명성 +${f}, ${o.check} +1${x?'<br>'+x:''}`;}
          p.fame=Math.max(0,p.fame-1);return `✘ ${o.name} 실패 (명성 −1)`;},o.battle&&p.health<30&&'건강이 30 이상이어야 싸울 수 있습니다');});
      break;
    case 'gate':{
      add('🏹 근교 사냥',1,'무예 판정 → 💰+25 / 실패하면 건강 −8',()=>{if(Math.random()<chk(p.st.무예,28)){p.gold+=25;p.st.무예=r1(p.st.무예+.2);cnt('hunt');const x=lootChance(.1,p1Lv()-1,'사냥터에서 주움');return '사슴을 잡아 팔았다 (💰+25)'+(x?'<br>'+x:'');}p.health-=8;return '헛걸음에 발목까지 삐었다 (건강 −8)';});
      for(let k=1;k<=5;k++){if(k===p.home)continue;const ok=fitOf(k,p.route)>0,bf=(p.friends||[]).find(f=>f.nat===k&&f.bond),mcost=Math.round((100+50*p.rank)*(bf?.5:1));
        add(`🧳 이주: <span style="color:${NATIONS[k].col}">${NATIONS[k].name}</span>`,4,`${ok?`${starsOf(k,p.route)} · ${TIERS[tierOf(k,p.route)].n}`:'마탑 없음'} · 💰${mcost} · 한 달 꼬박. ${bf?`🤝 의형제 ${bf.name}이(가) 도와줘서 계급 유지·인맥 절반 유지`:'명성 40%·인맥 대부분·무리 절반을 잃고 계급 −1'}`,()=>{
          p.gold-=mcost;const old=p.home;p.home=k;p.moves++;p.fame=Math.round(p.fame*(bf?.8:.6));p.net=Math.round(p.net*(bf?.5:.35));p.band=Math.max(1,Math.ceil(p.band/2));if(!bf)p.rank=Math.max(0,p.rank-1);
          if(p.route==='merchant'&&p.spec.shops){p.gold+=p.spec.shops*100;p.spec.shops=0;}
          if(p.route==='noble')p.spec={roy:30,nob:30,peo:30};
          if(p.route==='rebel'){p.spec.wanted=0;p.spec.support=Math.round(p.spec.support*.3);}
          p.city=0;p._skipEv=true;closeB();initTown(true);
          return `🧳 ${NATIONS[old].name}을(를) 떠나 ${NATIONS[k].name}(으)로 이주했다`;},!ok?'이 길로는 갈 수 없는 나라':p.gold<mcost?'돈이 모자랍니다':p.week>0&&'이주는 달 초(1주차)에만 떠날 수 있습니다');}
      break;}
  }
  // ── 도시 고유 일거리 ──
  {const CT=cityOf(p).t,cnt2=k=>{p.cnt=p.cnt||{};p.cnt[k]=(p.cnt[k]||0)+1;bumpCount(p,k);};
  if(CT==='coast'&&id==='market')add('⛵ 무역선 하역',1,'💰+14, 무예 +0.2',()=>{p.gold+=14;p.st.무예=r1(p.st.무예+.2);return '짐을 부렸다 (💰+14)';});
  if((CT==='coast'||cityOf(p).b==='river')&&id==='gate')add(CT==='coast'?'🎣 바다 낚시':'🎣 강 낚시',1,'💰 운에 따라 · 가끔 진귀한 물건',()=>{const g=rint(3,CT==='coast'?32:20);p.gold+=g;cnt2('fish');const x=lootChance(.04,p1Lv(),'그물에 걸려 올라옴');return `물고기를 팔아 💰+${g}`+(x?'<br>'+x:'');});
  if(CT==='mountain'&&id==='gate')add('⛏ 광산 일',1,'💰+16, 무예 +0.3, 건강 −4, 가끔 금속 장비',()=>{p.gold+=16;p.st.무예=r1(p.st.무예+.3);p.health-=4;const x=lootChance(.06,p1Lv(),'광산에서 발견',{cls:['heavy','medium','sword','axe','hammer','spear']});return '곡괭이질을 했다 (💰+16)'+(x?'<br>'+x:'');});
  if(CT==='forest'&&id==='gate')add('🪓 나무하기',1,'💰+10, 무예 +0.2',()=>{p.gold+=10;p.st.무예=r1(p.st.무예+.2);return '장작을 팼다 (💰+10)';});
  if(CT==='farm'&&id==='gate')add('🌾 농사일 돕기',1,'💰+9, 매력 +0.2, 건강 +3',()=>{p.gold+=9;p.st.매력=r1(p.st.매력+.2);p.health=Math.min(100,p.health+3);return '흙냄새 나는 하루였다 (💰+9)';});
  if(CT==='marsh'&&id==='temple')add('🌿 약초 채집',1,'건강 +10, 💰+6',()=>{p.health=Math.min(100,p.health+10);p.gold+=6;return '약초를 캐서 달였다 (건강 +10)';});
  if(CT==='fort'&&id==='barracks')add('🏹 성벽 수비 훈련',1,'통솔 +0.5, 무예 +0.3',()=>{p.st.통솔=r1(p.st.통솔+.5);p.st.무예=r1(p.st.무예+.3);return '요새 수비대와 함께 훈련했다';});
  if(CT==='trade'&&id==='market')add('📦 교역품 중개',1,'💰+18, 내정 +0.3',()=>{p.gold+=18;p.st.내정=r1(p.st.내정+.3);return '수수료를 챙겼다 (💰+18)';});
  if(CT==='capital'&&id==='castle')add('🎭 왕궁 축제 구경',1,'매력 +0.3, 가끔 인맥',()=>{p.st.매력=r1(p.st.매력+.3);const v=sr(.5);p.net+=v;return `축제를 즐겼다${v?' (인맥 +1)':''}`;});
  // 부탁: 이 건물에 다녀오기
  activeNQ(p).forEach(q=>{if(q.t==='visit'&&!q.done&&q.to===id&&q.city===(p.city||0))add(`📦 [부탁] ${q.n}`,q.wk||1,`${q.who}의 부탁 · 끝나면 돌아가서 보고`,()=>{nqDone(p,q.id);return `「${q.n}」을(를) 마쳤다. ${q.who}에게 보고하자.`;});});
  if(id==='gate')CITIES[p.home].forEach((c,ci)=>{if(ci===(p.city||0))return;const wk=cityDist(ci,p.city||0);
    add(`🧭 ${CTYPE[c.t].ic} ${c.n}(으)로 이동`,wk,`${CTYPE[c.t].n} · ${CTYPE[c.t].d} · 💰5`,()=>{p.gold-=5;p.city=ci;closeB();initTown(true);const T=town;T.me.x=800;T.me.y=860;return `${c.n}에 도착했다. ${CTYPE[c.t].d}`;},p.gold<5&&'💰5 필요');});
  }
  // ── 숨겨진 인물·특별한 기회 ──
  {const C=p.cnt||{},U=hasUni,bio=biomeOf(p),H='✨ ';
  if(id==='barracks'&&!U('u_sword_master')&&p.st.무예>=70&&(C.sword||0)>=15)add(H+'🧓 낯선 노검객과 대련',1,'숨겨진 인물 · 무예 판정 (어려움)',()=>{if(Math.random()<chk(p.st.무예,60))return '노검객이 검을 거두며 웃는다. "이제 이 검은 네 것이다."<br>'+giveUnique('u_sword_master','검성의 시험');p.health-=10;return '한 수도 받아내지 못했다… (건강 −10) 노검객은 다시 오라 한다.';});
  if(id==='gate'&&!U('u_hunter_bow')&&(C.hunt||0)>=8)add(H+'🌲 숲의 은둔자를 찾아간다',1,'숨겨진 인물 · 사냥을 많이 한 사람만 길을 찾는다',()=>'은둔자가 오래된 활을 내민다. "숲이 너를 인정했다."<br>'+giveUnique('u_hunter_bow','숲의 은둔자'));
  if(id==='temple'&&!U('u_saint_robe')&&(C.serve||0)>=12)add(H+'😇 성녀의 부름',0,'숨겨진 인물 · 꾸준한 봉사에 대한 보답',()=>'늙은 성녀가 당신의 손을 잡는다. "이 옷이 당신을 지켜줄 거예요."<br>'+giveUnique('u_saint_robe','성녀의 축복'));
  if(id==='alley'&&!U('u_shadow_dagger')&&(C.info||0)>=6)add(H+'🌑 그림자와의 거래',1,'숨겨진 인물 · 💰200',()=>{p.gold-=200;return '그림자가 속삭인다. "이건 아무에게도 말하지 마."<br>'+giveUnique('u_shadow_dagger','그림자');},p.gold<200&&'💰200 필요');
  if(id==='alley'&&!U('u_merchant_seal')&&p.gold>=1500)add(H+'💎 수상한 보석상',0,'숨겨진 인물 · 💰900에 인장을 판다',()=>{p.gold-=900;return '보석상이 낡은 인장을 건넨다. "주인을 알아보는 물건이지."<br>'+giveUnique('u_merchant_seal','수상한 보석상');});
  if(id==='alley'&&!U('u_witch_hat')&&bio==='marsh')add(H+'🧙 늪 마녀의 오두막',1,'습지 지방에서만 · 💰120',()=>{p.gold-=120;if(Math.random()<.5)return '마녀가 깔깔 웃으며 모자를 씌워준다.<br>'+giveUnique('u_witch_hat','늪 마녀');return '마녀는 오늘 기분이 나쁘다… 돈만 받고 문을 닫았다.';},p.gold<120&&'💰120 필요');
  if(id==='library'&&!U('u_blind_sage')&&p.st.지략>=55&&p.week===3)add(H+'👁 밤늦게 남은 눈먼 현자',1,'숨겨진 인물 · 4주차 밤에만',()=>'현자가 글자 없는 책을 건넨다. "눈이 아니라 마음으로 읽게."<br>'+giveUnique('u_blind_sage','눈먼 현자'));
  if(id==='tavern'&&!U('u_old_knight')&&p.wins>=10)add(H+'🛡 구석자리의 늙은 기사',1,'숨겨진 인물 · 전투 10승 이상',()=>'늙은 기사가 당신의 무용담을 듣고 검을 내려놓는다. "내 맹세를 이어다오."<br>'+giveUnique('u_old_knight','늙은 기사'));
  if(id==='tower'&&NINFO[p.home].tower&&!U('u_comet_staff')&&p.flags.comet)add(H+'☄ 혜성 파편 연구',2,'붉은 혜성 이후에만 · 지략 판정',()=>{if(Math.random()<chk(p.st.지략,45))return '파편이 지팡이에 녹아들었다!<br>'+giveUnique('u_comet_staff','혜성 파편 연구');return '파편의 힘을 다루지 못했다. 다시 시도해 보자.';});
  if(id==='market'&&!U('u_sea_trident')&&bio==='river')add(H+'🎣 강가 노인의 부탁',1,'강 유역 지방에서만 · 💰50',()=>{p.gold-=50;if(Math.random()<.35)return '노인이 강바닥에서 건진 삼지창을 준다. "바다에서 흘러왔다네."<br>'+giveUnique('u_sea_trident','강가의 노인');p.st.매력=r1(p.st.매력+.5);return '노인의 그물을 고쳐줬다. 고맙다며 웃는다 (매력 +0.5)';},p.gold<50&&'💰50 필요');
  if(id==='gate'&&p.smith){const fc=200+p.rank*120;
    add(H+'⚒ 떠돌이 대장장이 — 맞춤 제작',0,`💰${fc} · 원하는 부위의 희귀 이상 장비`,()=>{popup('⚒ 떠돌이 대장장이','"어디에 쓸 물건이 필요하지?"',[...SLOTS.map(sl=>({l:SLOTN[sl],f:()=>{p.gold-=fc;p.smith=false;const it=rollItem(p1Lv()+1.5,{slot:sl,r:rint(2,3)});popup('⚒ 완성!',gainItem(it,'맞춤 제작'),[{l:'다음 ▶',f:finishTurn}]);save();}})),{l:'그만둔다',f:finishTurn}]);return null;},p.gold<fc&&`💰${fc} 필요`);
    if(!U('u_mithril_plate'))add(H+'⚒ 떠돌이 대장장이 — 미스릴 갑옷 주문',0,'💰2500',()=>{p.gold-=2500;p.smith=false;return giveUnique('u_mithril_plate','떠돌이 대장장이');},p.gold<2500&&'💰2500 필요');}
  }
  return A;
}
/* --- 화면 (HUD · 건물 · 정보 · 가이드) --- */
function renderTHud(){
  const p=PP(),R=ROUTES[p.route],el=$('thud'),fin=p.rank>=R.ranks.length-1;
  const ok=fin?crownReqs(p).rl.every(x=>x[1]):reqOk(p,R.ranks[p.rank+1]);
  let fold=null;try{fold=localStorage.getItem('hudFold');}catch(e){}const F=fold===null?innerWidth<640:fold==='1';el.classList.toggle('folded',F);
  el.innerHTML=`<button id="tfold" class="fold" title="정보창 접기/펴기">${F?'▾':'▴'}</button><div class="hr"><b style="color:#ffe08a">${R.icon} ${p.name}</b><span>${R.ranks[p.rank].n} · <span style="color:${NATIONS[p.home].col}">${NATIONS[p.home].name}</span> ${CTYPE[cityOf(p).t].ic}${cityOf(p).n}${town&&town.ts?` <span style="color:#ffd36b" title="발전도">${'★'.repeat(town.ts.dev)}</span>`:''}</span></div>
    <div class="hr">💰<b>${p.gold}</b> ❤<b style="color:${p.health>=50?'#7fd06a':'#ff8a8a'}">${p.health}</b> ⭐<b>${p.fame}</b> 🤝<b>${p.net}</b> 👥<b>${p.band}</b></div>
    <div class="hr x">📅 ${ageOf(p)}세 ${p.month}개월째 · ${weekBar(p)} <b>${p.week+1}주차</b></div>
    ${ok?`<div class="hr" style="color:#7fd06a;font-weight:800">🏰 왕성에서 ${fin?'왕좌에 도전':'승진 신청'}할 수 있어요!</div>`:''}
    <div class="hr x"><button id="tinfo">📊 내 정보</button><button id="tequip">🎒 장비</button><button id="tguide">📖 가이드</button><button id="tnext">⏭ 다음 달</button><button id="tslot">💾</button></div>`;
  $('tslot').onclick=()=>showTitle();
  $('tfold').onclick=()=>{try{localStorage.setItem('hudFold',F?'0':'1');}catch(e){}renderTHud();};
  $('tequip').onclick=()=>{closeB();show('p1',false);show('guide',false);openEquip('bag');};
  $('tinfo').onclick=()=>{closeB();show('guide',false);const o=$('p1').classList.contains('hidden');show('p1',o);if(o)renderInfo();updNear();};
  $('tguide').onclick=()=>{closeB();show('p1',false);const o=$('guide').classList.contains('hidden');show('guide',o);if(o)renderGuide();updNear();};
  $('tnext').onclick=function(){if(!this._arm){this._arm=1;this.textContent=`남은 ${WK-p.week}주 쉬고 넘기기?`;setTimeout(()=>{if(this.isConnected){this._arm=0;this.textContent='⏭ 다음 달';}},2500);return;}skipMonth();};
}
function updNear(){
  const b=town&&town.near,busy=!$('event').classList.contains('hidden')||(town&&town.open)||!$('p1').classList.contains('hidden')||!$('guide').classList.contains('hidden');
  if(!b||busy||uiBusy()||!inTown()){show('tnear',false);return;}
  $('tnear').innerHTML=b.role?`💬 ${b.name}와 대화${matchMedia('(hover:hover)').matches?' <small>(E)</small>':''}`:`🚪 ${b.ic} ${b.n} 들어가기${matchMedia('(hover:hover)').matches?' <small>(E)</small>':''}`;
  $('tnear').onclick=()=>openTarget(town.near);show('tnear',true);
}
/* ---------- 건물 실내 ---------- */
const ROOMC={};
const ROOMS={
  tavern:{f:[5,8],w:[5,0],items:[['E',176,16,48,16,1,1],['E',0,0,16,16,8,1],['E',16,0,16,16,8,2],['E',32,160,48,16,2,3],['E',32,160,48,16,5,3]],ch:[['Villager2',2,1,0],['Villager',3,4,1],['Woman',6,4,1],['OldMan2',7,2,2]]},
  barracks:{f:[5,13],w:[0,6],items:[['E',96,0,16,16,1,1],['E',112,0,16,16,2,1],['E',0,0,16,16,8,1],['E',32,160,48,16,4,1]],ch:[['Knight',3,3,3],['Knight',5,3,2],['FighterWhite',7,4,1]]},
  temple:{f:[17,2],w:[0,0],items:[['P',444,19,43,75,4,0],['E',0,112,16,32,1,1],['E',0,112,16,32,8,1]],ch:[['Monk',3,3,0],['Monk2',6,3,0],['OldWoman',5,4,1]]},
  library:{f:[5,2],w:[0,0],items:[['E',128,112,32,32,1,0.5],['E',160,112,32,32,3,0.5],['E',128,112,32,32,6,0.5],['E',32,160,48,16,3,3]],ch:[['OldMan',2,3,0],['Inspector',6,4,2]]},
  tower:{f:[17,8],w:[5,6],items:[['E',160,112,32,32,1,0.5],['E',64,0,16,16,7,1],['E',64,0,16,16,8,1],['E',32,160,48,16,4,2]],ch:[['SorcererOrange',3,3,3],['SorcererBlack',6,3,2]]},
  home:{f:[5,8],w:[5,0],items:[['E',16,112,32,32,1,0.5],['E',0,112,16,32,8,0.5],['E',32,160,48,16,4,3]],ch:[]},
  alley:{f:[16,13],w:[0,6],items:[['E',0,0,16,16,1,1],['E',16,0,16,16,1,2],['E',96,0,16,16,8,1],['E',96,0,16,16,8,4]],ch:[['NinjaGray',4,3,3],['MaskRacoon',6,3,2]]},
  market:{f:[5,13],w:[5,0],items:[['E',176,16,48,16,2,1],['E',0,0,16,16,1,4],['E',16,0,16,16,8,4],['E',96,0,16,16,7,1]],ch:[['Sultan',3,2,0],['Villager4',5,4,1],['Villager5',7,3,2]]},
  manor:{f:[17,2],w:[5,0],items:[['E',128,112,32,32,1,0.5],['E',0,112,16,32,8,0.5],['E',32,160,48,16,4,3]],ch:[['Noble',4,2,0],['Princess',6,3,2]]},
  castle:{f:[17,2],w:[0,0],items:[['E',0,112,16,32,1,0.5],['E',0,112,16,32,8,0.5],['H',352,320,16,32,3,0],['H',352,320,16,32,6,0]],ch:[['KnightGold',2,3,3],['Noble',4.5,1.5,0],['Knight',7,3,2]]},
  hall:{f:[17,2],w:[0,0],items:[['E',0,112,16,32,1,0.5],['E',32,160,48,16,4,3]],ch:[['Noble',4.5,2,0],['Knight',2,3,3]]},
  gate:{f:[16,13],w:[0,6],items:[['E',0,0,16,16,1,1],['E',16,0,16,16,8,1]],ch:[['Knight',3,3,0],['Villager3',6,3,0]]}
};
function roomCanvas(id){
  const R=ROOMS[id]||ROOMS.home,key=id;
  const c=document.createElement('canvas');c.width=320;c.height=192;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const F=TS.IntFloor,Wl=TS.IntWall,t=(im,sx,sy,x,y)=>g.drawImage(im,sx*16,sy*16,16,16,x*32,y*32,32,32);
  for(let y=1;y<5;y++)for(let x=1;x<9;x++)t(F,R.f[0]+(x%2),R.f[1]+(y%2),x,y);
  const [bx,by]=R.w;
  for(let x=1;x<9;x++){t(Wl,bx+(x%2?1:3),by,x,0);t(Wl,bx+(x%2?1:3),by+4,x,5);}
  for(let y=1;y<5;y++){t(Wl,bx,by+(y%2?1:3),0,y);t(Wl,bx+4,by+(y%2?1:3),9,y);}
  t(Wl,bx,by,0,0);t(Wl,bx+4,by,9,0);t(Wl,bx,by+4,0,5);t(Wl,bx+4,by+4,9,5);
  const L=[];
  R.items.forEach(([s,sx,sy,sw,sh,x,y])=>L.push({y:y*32+sh*2,d:()=>{const im=s==='E'?TS.TilesetElement:s==='H'?TS.TilesetHouse:TS.PTDProps,k=s==='P'?1:2;g.drawImage(im,sx,sy,sw,sh,Math.round(x*32+(32-sw*k)/2*(sw<=16?1:0)),Math.round(y*32),sw*k,sh*k);}}));
  R.ch.forEach(([ch,x,y,dir])=>L.push({y:y*32+32,d:()=>{const im=cimg(`assets/chars/${ch}/SpriteSheet.png`);if(im.complete&&im.naturalWidth)g.drawImage(im,dir*16,0,16,16,Math.round(x*32),Math.round(y*32),32,32);}}));
  L.sort((a,b)=>a.y-b.y).forEach(o=>o.d());
  return ROOMC[key]=c;
}
/* ---------- 왕이 되어 내 도시 걷기 ---------- */
const inTown=()=>state==='p1'||state==='kt';
const KT_NAMES=['농부','상인','병사','노인','아이','사제','대장장이','어부','광부','주부'];
function ktType(r){const capR=r.cap||r.id===(prog.homeReg!=null?prog.homeReg:-1);if(capR)return'capital';
  const b=r.bld||[];if(b.includes('harbor'))return'coast';if(b.includes('fort')||b.includes('barracks'))return'fort';if(b.includes('market'))return'trade';
  return{highland:'mountain',forest:'forest',river:'river',marsh:'marsh',plains:'farm'}[r.biome]||'farm';}
function moodOf(){const m=prog.morale||50;return m>=70?2:m>=40?1:0;}
function enterKT(rid){
  const r=REG[rid];if(!r||r.owner!==0)return;
  const CT=ktType(r),R=srng(mapSeed+rid*131),nc=NATIONS[0].col,n=myRegs().length,N={size:n>9?'large':n>4?'medium':'small',tower:true},cap=CT==='capital';
  const fp={home:1+(rid%5),city:rid,name:prog.kingName||'왕',week:0,month:prog.month||0,npc:{}};
  town={home:-1,city:rid,b:[],deco:[],folk:[],npcs:[],me:{x:800,y:700,path:[],face:1,dir:0,mv:false,enter:null},near:null,open:null,camFree:0,top:40,nob:[],kt:{rid,fp}};
  tsLayoutTown(fp,{t:CT,b:r.biome},CT,r.biome,R,N,nc,cap);
  if(cap)town.b.forEach(b=>{if(b.id==='castle')b.n='왕궁';});else town.b.forEach(b=>{if(b.id==='castle'&&b.kind!=='castle')b.n='총독 관저';});
  town.b.forEach(b=>{if(b.id==='home')b.n='농가';if(b.id==='board'){b.n='포고문 게시판';}});
  town.bg=tsTownBg();
  const myc=castleCol(nc),nf=10+(r.dev||1)*4+(cap?8:0);
  for(let i=0;i<nf;i++){const rr=R();town.folk.push({x:60+R()*(W-120),y:504+R()*36,dir:0,mv:false,tx:null,ty:null,w:R()*2,hid:0,sp:24+R()*14,tsk:rr<.65?'pawn':rr<.8?'archer':rr<.92?'warrior':'rpg',tsc:R()<.4?myc:TSC[Math.floor(R()*4)],face:R()<.5?1:-1,sz:.86+R()*.2,work:R()<.3?2+Math.floor(R()*2):0,bub:R()<.45});}
  {const cb=town.b.find(b=>b.id==='castle');[-1,1].forEach(dx=>town.folk.push({x:800+dx*44,y:cb.y+10,st:1,tsk:'warrior',tsc:myc,face:-dx}));}
  const roles=['farmer','merch','soldier','elder','kid','priest','smith','fisher'];
  roles.slice(0,5+(r.dev||1)).forEach((ro,i)=>{const b=town.b[(i*3+1)%town.b.length],off=(i%2?1:-1)*44;
    town.npcs.push({id:'kt-'+rid+'-'+i,role:'citizen',cr:ro,name:NAME_A[Math.floor(R()*NAME_A.length)]+NAME_B[Math.floor(R()*NAME_B.length)],ch:pick(FOLK_CH),at:b.id,x:b.x+off,y:Math.min(H-14,b.y+(b.id==='castle'?12:26)),hx:b.x+off,hy:Math.min(H-14,b.y+(b.id==='castle'?12:26)),dir:0,mv:false,tx:null,ty:null,w:R()*3,
      tsk:ro==='soldier'?'warrior':ro==='kid'?'pawn':i%3===0?'archer':'pawn',tsc:TSC[(i+rid)%4],sz:ro==='kid'?.75:1});});
  fixSpawn();
  state='kt';['hub','maphint','report','event','deploy','top','cmds','hint','result'].forEach(id=>show(id,false));show('zoom',true);
  cam.z=Math.max(zMin(),Math.min(2,innerWidth/760));town.camFree=0;focusCam(town.me.x,town.me.y);
  renderKTHud();
}
function renderKTHud(){
  let el=$('kthud');if(!el){el=document.createElement('div');el.id='kthud';el.className='panel';document.body.appendChild(el);}
  const r=REG[town.kt.rid],m=prog.morale||50,mo=['😠 불만','😐 그럭저럭','😊 만족'][moodOf()],mine=myRegs();
  el.innerHTML=`<b>🚶 ${r.name}</b> <span class="sub">${{plains:'평원',forest:'숲',highland:'고원',river:'강',marsh:'늪'}[r.biome]||''} · 발전도 ${'★'.repeat(Math.min(5,r.dev||1))}</span><br>
    민심 <b style="color:${m>=70?'#7fd06a':m>=40?'#ffd36b':'#ff8a7a'}">${m}</b> ${mo} · 세율 ${({low:'낮음',mid:'보통',high:'높음'})[prog.tax]||prog.tax} ${prog.hungry?'· <span class="danger">식량 부족</span>':''}
    <div class="btnrow" style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap"><button id="ktprev">◀ 다른 도시</button><button id="ktnext">다른 도시 ▶</button><button id="ktback" class="big">🏰 국정으로</button></div>`;
  el.style.cssText='position:fixed;left:8px;top:8px;z-index:5;padding:4px 8px;font-size:12.5px;max-width:360px';
  const i=mine.findIndex(x=>x.id===r.id);
  $('ktprev').onclick=()=>enterKT(mine[(i-1+mine.length)%mine.length].id);$('ktnext').onclick=()=>enterKT(mine[(i+1)%mine.length].id);
  $('ktback').onclick=leaveKT;show('kthud',true);
}
function leaveKT(){show('kthud',false);show('tnear',false);toHub();}
function ktTalk(n){
  const r=REG[town.kt.rid],md=moodOf(),war=[1,2,3,4,5].some(k=>nations[k]&&nations[k].alive&&nations[k].rel==='war'),bl=(r.bld||[]).map(b=>BUILD[b]&&BUILD[b].name).filter(Boolean);
  const L={2:['"폐하 덕분에 살 만합니다!"','"요즘 장사가 잘돼요. 만세!"','"아이들이 배불리 먹어요. 감사합니다, 폐하."'],1:['"그럭저럭 지냅니다, 폐하."','"조금만 더 살기 좋아지면 좋겠어요."','"세금이 조금만 낮았으면…"'],0:['"(고개를 돌린다) …폐하께선 우리 사정을 아십니까?"','"먹고살기가 너무 힘듭니다!"','"이러다 폭동이라도 나겠어요…"']}[md];
  const extra=[];if(prog.hungry)extra.push('"곡식이 바닥났어요. 먹을 게 없습니다."');if(prog.tax==='high')extra.push('"세금이 너무 무겁습니다, 폐하."');if(prog.tax==='low')extra.push('"세금이 가벼워서 숨통이 트입니다!"');
  if(war)extra.push('"전쟁 소식에 다들 불안해합니다."');if(bl.length)extra.push(`"이 마을의 ${pick(bl)} 덕에 일거리가 생겼어요."`);else extra.push('"이 마을엔 아직 번듯한 시설이 없어요. 뭐라도 지어 주시면…"');
  const line=pick(L.concat(extra));const face=['😠','😐','😊'][md];
  popup(`${face} ${n.name} (${{farmer:'농부',merch:'상인',soldier:'병사',elder:'노인',kid:'아이',priest:'사제',smith:'대장장이',fisher:'어부'}[n.cr]||'주민'})`,`${faceImg(n.ch)}${line}<br><span class="sub">민심 ${prog.morale||50} · 이 대화는 왕국 전체 민심을 보여 줍니다</span>`,
    [{l:`🎁 하사금 (💰20 · 민심 +1)`,f:()=>{if((prog.gold||0)<20)return toast('금이 부족합니다');prog.gold-=20;prog.morale=Math.min(100,(prog.morale||50)+1);toast('주민들이 기뻐합니다 (민심 +1)');renderKTHud();save();}},{l:'👋 작별'}]);
}
function ktBuilding(b){
  const r=REG[town.kt.rid],bl=(r.bld||[]).map(k=>`${BUILD[k].icon} ${BUILD[k].name} Lv${bLv(r,k)}`).join('<br>')||'아직 지은 건물이 없습니다';
  const info={castle:`왕궁 단계 ${cityLv('palace')} · 왕도 발전도 ${cityTotal()}/20`,market:`상업 구역 Lv${cityLv('trade')} · 이번 달 시세는 경제 탭에서`,barracks:`장수 ${heroes.length}명 · 군사 구역 Lv${cityLv('army')}`,temple:`신앙·학문 구역 Lv${cityLv('faith')} · 민심 ${prog.morale||50}`,tavern:'주점에서 새 장수를 모을 수 있습니다 (국정 → 주점 탭)',library:`학문 구역 Lv${cityLv('faith')}`}[b.id]||'';
  popup(`${b.ic} ${b.n}`,`${info?info+'<br><br>':''}<b>${r.name}의 시설</b><br>${bl}`,[{l:'닫기'}]);
}
function openB(b){if(state!=='p1')return;if(npcUI)closeNpc();town.open=b;show('p1',false);show('guide',false);renderB();show('bpanel',true);updNear();}
function closeB(){if(town)town.open=null;show('bpanel',false);updNear();}
function renderB(){
  const p=PP(),b=town.open,el=$('bpanel');if(!b)return;
  el.innerHTML=`<div class="bhead"><h3>${b.ic} ${b.n}</h3><button class="ghost" id="bclose">✕ 나가기</button></div>
    <div class="sub">${TFLAV[b.id]}${!b.ok?' — 이 나라에는 마탑이 없어 폐허만 남아 있습니다.':''}</div>
    <div style="margin:6px 0">⏳ 이번 달 남은 시간 <b>${WK-p.week}주</b> ${weekBar(p)}</div><div id="blist"></div>`;
  $('bclose').onclick=closeB;
  if(tsReady()&&b.id!=='board'){const kid=b.id==='castle'&&b.kind==='hall'?'hall':b.id;const rc=roomCanvas(kid);const cv2=document.createElement('canvas');cv2.width=320;cv2.height=192;cv2.className='room';cv2.getContext('2d').drawImage(rc,0,0);el.querySelector('.sub').before(cv2);}
  const list=$('blist'),acts=b.ok?bActs(b.id,p):[];
  if(!acts.length)list.innerHTML='<div class="sub">여기서 할 수 있는 일이 없습니다.</div>';
  acts.forEach(A=>{const d=document.createElement('div');d.className='qrow';const short=A.wk>WK-p.week;
    d.innerHTML=`<div><b>${A.l}</b><br><span class="sub">${A.tip}</span>${A.dis?`<br><span class="danger" style="font-size:11px">${A.dis}</span>`:short?'<br><span class="danger" style="font-size:11px">이번 달 남은 시간이 모자람</span>':''}</div>`;
    const bt=document.createElement('button');bt.innerHTML=A.wk?`하기<br><small>⏳${A.wk}주</small>`:'하기<br><small>바로</small>';bt.disabled=!!A.dis||short;bt.onclick=()=>doAct(A);
    d.appendChild(bt);list.appendChild(d);});
  if(JOBB[p.route]!==b.id&&b.ok){const home=TOWNB.find(x=>x.id===JOBB[p.route]);list.insertAdjacentHTML('beforeend',`<div class="sub" style="margin-top:6px">💼 ${ROUTES[p.route].name}의 일과 전용 활동은 <b>${home.ic} ${home.n}</b>에서 합니다.</div>`);}
}
function renderInfo(){
  const p=PP(),R=ROUTES[p.route],el=$('p1body');el.innerHTML='';
  const SP=SPEC[p.route],tier=tierOf(p.home,p.route),T=TIERS[tier];
  const box=(col,html)=>{const d=document.createElement('div');d.className='rg';d.style.borderLeftColor=col;d.innerHTML=html;el.appendChild(d);return d;};
  const cl=document.createElement('button');cl.className='ghost';cl.textContent='✕ 닫기';cl.onclick=()=>{show('p1',false);updNear();};el.appendChild(cl);
  box('#ffd34d',`<h3>${R.icon} ${p.name} — ${R.ranks[p.rank].n}</h3>
    고향 <b style="color:${NATIONS[p.home].col}">${NATIONS[p.home].name}</b> · ${ageOf(p)}세 (${p.month}개월째, ${p.week+1}주차)<br>
    💰 <b>${p.gold}</b> · 명성 <b>${p.fame}</b> · 인맥 <b>${p.net}</b> · 무리 <b>${p.band}</b>명 · 건강 <b style="color:${p.health>=50?'#7fd06a':'#ff8a8a'}">${p.health}</b> · 전투 승리 ${p.wins}
    ${KSTAT.map(k=>`<div class="kst"><span>${k}</span><div class="bar2"><i style="width:${Math.min(100,p.st[k])}%;background:${p.st[k]>=60?'#7fd06a':p.st[k]>=40?'#f0c050':'#ff7a6a'}"></i></div><b>${fmtSt(p.st[k])}</b></div>`).join('')}
    <span class="sub">훈련은 조금씩 쌓입니다 (소수점까지 저장). 이 능력치가 즉위 후 왕의 능력치가 됩니다. 명성·금 조건은 나라 규모에 따라 달라집니다 (×${sm()}).</span>
    <div style="margin-top:4px;color:#c0a0ff">🌐 시대: <b>${ERAS[p.era].n}</b> — ${ERAS[p.era].txt}${p.flags.war>0?` · <span class="danger">⚔ 전시 (${p.flags.war}개월)</span>`:''}${p.flags.famine>0?` · <span class="danger">🍂 대기근 (${p.flags.famine}개월)</span>`:''}${p.flags.blood?' · 👑 왕가의 혈통':''}</div>
    <div style="margin-top:4px;color:#ffd34d">⚖ 이 나라에서 즉위하면: <b>${T.n}</b> — 왕의 강점 ×${T.pro}, 약점 ×${T.con}</div>`);
  const fin=p.rank>=R.ranks.length-1;
  if(!fin){const nx=R.ranks[p.rank+1];box('#7fd06a',`<h3>🎯 다음 계급: ${nx.n}</h3><div class="req">${reqList(p,nx).map(([t,o])=>`<span class="${o?'ok':'no'}">${o?'✔':'✘'} ${t}</span>`).join(' · ')}</div><div class="sub">조건을 채우면 🏰 왕성에서 승진을 신청하세요.</div>`);}
  else{const {rl}=crownReqs(p);box('#7fd06a',`<h3>👑 왕좌에 도전</h3>${R.crownTxt}<div class="req">${rl.map(([t,o])=>`<span class="${o?'ok':'no'}">${o?'✔':'✘'} ${t}</span>`).join(' · ')}</div><div class="sub">🏰 왕성에서 도전합니다.</div>`);}
  const jb=TOWNB.find(x=>x.id===JOBB[p.route]);
  box('#ffb36b',`<h3>${SP.title}</h3>${SP.status(p)}${p.perks.length?`<div class="sub" style="margin-top:4px">얻은 보상: ${p.perks.join(' · ')}</div>`:''}<div class="sub">💼 일과 전용 활동: <b>${jb.ic} ${jb.n}</b></div>`);
  const aq=activeNQ(p);box('#c07aff',`<h3>📜 받은 부탁 (${aq.length})</h3>${aq.map(q=>`· <b>${q.n}</b> — ${q.who} (${CITIES[p.home][q.city||0].n}) ${q.done?'<span style="color:#7fd06a">✔ 보고하러 가기</span>':q.t==='count'?`${q.prog||0}/${q.n2}`:q.t==='visit'?`→ ${TOWNB.find(b=>b.id===q.to).n}`:''}`).join('<br>')||'<span class="sub">없음 — 머리 위에 ❗가 뜬 사람에게 말을 걸어 보세요</span>'}`);
  const comp=heroes.filter(h=>!h.king);
  box('#5fb3ff',`<h3>🤝 동료 (${comp.length}/3) — 즉위하면 장수가 됩니다</h3>${comp.map(h=>`<div class="hs"><span style="color:${RARITY[h.rarity].col}">${h.name}</span> Lv${h.lv} ${CLS[h.type]} · ⚡${SKILLS[h.skill].name} · 월급 💰${Math.ceil(h.wage/2)}${h.injured>0?' <span class="danger">부상</span>':''}</div>`).join('')||'<span class="sub">아직 없음 — 🍺 선술집에서 영입</span>'}`);
  box('#3b4670',`<h3>📖 기록</h3><div class="plog">${p.log.join('<br>')}</div>`);
  const nb=document.createElement('button');nb.className='ghost danger';nb.textContent='처음부터 다시';
  nb.onclick=function(){if(!this._arm){this._arm=1;this.textContent='한 번 더 누르면 새 인생';setTimeout(()=>{this._arm=0;this.textContent='처음부터 다시';},2500);return;}
    try{localStorage.removeItem(slotKey());}catch(_){}town=null;newGame();toP1();};
  el.appendChild(nb);
}
function renderGuide(){
  const p=PP(),el=$('guide');
  el.innerHTML=`<div class="bhead"><h3>📖 활동 가이드</h3><button class="ghost" id="gclose">✕ 닫기</button></div>
    <div class="rg" style="border-left-color:#ffd34d"><b>기본 규칙</b><br>
    · 화면(땅)을 누르면 그곳으로 걸어갑니다. 건물을 누르면 걸어가서 바로 들어갑니다. PC는 <b>WASD·방향키</b>로 걷고 <b>E</b>로 들어가요.<br>
    · 건물 앞에 서면 아래에 <b>들어가기</b> 버튼이 뜹니다.<br>
    · <b>한 달 = 4주.</b> 활동마다 시간이 듭니다 (보통 1주, 내 길 전용 활동·의뢰는 2주, 이주는 한 달).<br>
    · 활동을 하면 결과가 나오고 <b>다음 ▶</b>을 눌러 넘어갑니다. 4주를 다 쓰면 월말 결산(무리 유지비·동료 급여·새 의뢰)과 사건이 이어집니다.<br>
    · 할 게 없으면 <b>⏭ 다음 달</b>로 남은 주를 쉬며 넘길 수 있어요 (1주당 건강 +6).<br>
    · 아침(1주차)엔 햇살, 4주차엔 저녁노을이 집니다.<br>
    · 💬 이름이 떠 있는 사람은 대화할 수 있어요. 자주 이야기하고 선물하면 친해지고, ❗ 부탁을 들어주면 보상과 호감을 줍니다. ❓는 보고할 일이 있다는 뜻. ✦는 그 나라에만 있는 인물입니다.<br>
    · 🚪 성문에서 같은 나라의 다른 도시로 이동할 수 있어요 (1~2주). 도시마다 지형·일거리·사람이 다릅니다. 왕좌 도전은 수도에서만.</div>
    <div id="glist"></div>`;
  $('gclose').onclick=()=>{show('guide',false);updNear();};
  const gl=$('glist');
  TOWNB.forEach(b=>{const tb=town&&town.b.find(x=>x.id===b.id),ok=!tb||tb.ok;
    const acts=ok?bActs(b.id,p).filter(a=>!/영입|이주:|^[⚔📜] /.test(a.l)):[];
    const extra=b.id==='board'?'매달 바뀌는 의뢰 (2주, 판정 또는 전투)':b.id==='gate'?'· 다른 나라로 이주 (한 달)':b.id==='tavern'?'· 동료 영입 (3개월마다 새 얼굴)':'';
    const mine=JOBB[p.route]===b.id;
    const d=document.createElement('div');d.className='rg';d.style.borderLeftColor=mine?'#ffb36b':'#3b4670';
    d.innerHTML=`<b>${b.ic} ${b.n}</b>${mine?' <span style="color:#ffb36b">— 내 길의 일터</span>':''}<br><span class="sub">${TFLAV[b.id]}</span><br>${ok?acts.map(a=>`· ${a.l} <span class="sub">(${a.wk?a.wk+'주':'바로'}) ${a.tip}</span>`).join('<br>'):'<span class="sub">이 나라엔 마탑이 없습니다</span>'}${extra?'<br>'+extra:''}`;
    const go=document.createElement('button');go.className='ghost';go.style.marginTop='4px';go.textContent='📍 여기로 가기';
    go.onclick=()=>{show('guide',false);const tb2=town.b.find(x=>x.id===b.id);walkTo(tb2.x,tb2.y+12,tb2);updNear();};d.appendChild(go);gl.appendChild(d);});
}
function renderP1(){
  const p=PP();if(!p)return;ensureP1(p);
  renderTHud();
  if(!$('p1').classList.contains('hidden'))renderInfo();
  if(town&&town.open)renderB();
  if(!$('guide').classList.contains('hidden'))renderGuide();
}
const p1Month=skip=>{const p=PP();p.week=WK;p1MonthEnd(skip);};
function p1Log(p,txt){p.log.unshift(`<b>${p.month}개월</b> ${txt}`);p.log=p.log.slice(0,30);}
function hideTown(){['thud','tnear','bpanel','guide','p1'].forEach(id=>show(id,false));if(town)town.open=null;}
function toP1(){
  state='p1';battleCtx=null;pending=null;heroUnits=[];evs=[];projs=[];parts=[];texts=[];units=[];
  ['deploy','dhint','top','cmds','hint','result','hub','maphint','report','event','origin'].forEach(id=>show(id,false));
  show('zoom',true);
  if(!prog.p1){hideTown();renderP1Start();return;}
  show('p1start',false);show('p1',false);show('guide',false);show('thud',true);
  ensureP1(PP());initTown();renderP1();
  cam.z=Math.max(zMin(),Math.min(2,innerWidth/760));town.camFree=0;focusCam(town.me.x,town.me.y);
  updNear();save();
}
let p1sel={home:3,route:'merchant',name:''};
function renderP1Start(){
  show('p1',false);
  if(!p1sel.name)p1sel.name=pick(NAME_A)+pick(NAME_B)+pick(NAME_C);
  if(!fitOf(p1sel.home,p1sel.route))p1sel.route='soldier';
  const el=$('p1start');
  el.innerHTML=`<h2>🌱 평범한 시민으로 태어나다</h2>
    <div class="sub">어느 나라에서, 어떤 길로 왕좌에 오를지 고르세요. 작은 나라일수록 왕이 되기 쉽지만 약소국으로 시작합니다. 나라 성향에 따라 빨리 출세하는 길이 다릅니다.</div>
    <b>1. 고향</b><div class="ncards" id="ncards"></div>
    <b>2. 시작할 도시</b><div class="ncards" id="ccards"></div>
    <b>3. 출세의 길</b><div class="rbtns" id="rbtns"></div>
    <div><b>4. 이름</b> <span style="font-size:16px;color:#ffe08a;font-weight:800" id="nmv">${p1sel.name}</span> <button id="nmr" class="ghost" style="padding:4px 10px">🎲 다시</button></div>
    <div class="btnrow"><button id="p1skip" class="ghost">1페이즈 건너뛰고 바로 왕으로 시작</button><button id="p1go" class="big">시민의 삶 시작 ▶</button></div>`;
  const nc=$('ncards');
  for(let k=1;k<=5;k++){const N=NINFO[k],b=document.createElement('button');b.className='nc'+(p1sel.home===k?' on':'');
    b.innerHTML=`<h4 style="color:${NATIONS[k].col}">${NATIONS[k].name}</h4>규모 ${SIZE_NAME[N.size]} · ${N.sec} · ${N.stance}<br><span class="sub">${N.desc}</span><br>
      ${Object.keys(ROUTES).map(r=>`${ROUTES[r].icon}${ROUTES[r].name} <span class="stars">${starsOf(k,r)}</span>`).join(' · ')}`;
    b.onclick=()=>{p1sel.home=k;p1sel.city=0;renderP1Start();};nc.appendChild(b);}
  const cc=$('ccards');CITIES[p1sel.home].forEach((c,ci)=>{const T=CTYPE[c.t],b=document.createElement('button');b.className='nc'+((p1sel.city||0)===ci?' on':'');
    b.innerHTML=`<h4>${T.ic} ${c.n}</h4><b>${T.n}</b><br><span class="sub">${T.d}</span>`;b.onclick=()=>{p1sel.city=ci;renderP1Start();};cc.appendChild(b);});
  const rb=$('rbtns');
  Object.entries(ROUTES).forEach(([k,R])=>{const ok=fitOf(p1sel.home,k)>0,b=document.createElement('button');b.className=p1sel.route===k?'on':'';b.disabled=!ok;
    b.innerHTML=`${R.icon} <b>${R.name}</b> <span class="stars">${starsOf(p1sel.home,k)}</span><br><span class="sub">${R.ranks.map(x=>x.n).join(' → ')} → 👑<br>${R.crownTxt}${ok?'':'<br>이 나라엔 마탑이 없음'}</span>`;
    b.onclick=()=>{p1sel.route=k;renderP1Start();};rb.appendChild(b);});
  $('nmr').onclick=()=>{p1sel.name=pick(NAME_A)+pick(NAME_B)+pick(NAME_C);$('nmv').textContent=p1sel.name;};
  $('p1go').onclick=()=>startP1();
  $('p1skip').onclick=()=>{show('p1start',false);skipToKing();toHub();};
  show('p1start',true);
}
function startP1(){
  const R=ROUTES[p1sel.route],st={};
  KSTAT.forEach(k=>st[k]=rint(16,26));st[R.main]+=10;
  const p={home:p1sel.home,city:p1sel.city||0,route:p1sel.route,name:p1sel.name,st,fame:0,gold:60,net:5,band:p1sel.route==='soldier'?6:p1sel.route==='rebel'?5:4,
    health:100,rank:0,month:1,wins:0,log:[],quests:[],pool:[],spec:JSON.parse(JSON.stringify(SPEC_INIT[p1sel.route])),perks:[],moves:0,era:pick(Object.keys(ERAS)),flags:{},done:[],week:0};
  prog.p1=p;prog.phase=1;prog.weather='clear';
  heroes=[{id:'king',king:true,name:p.name,type:R.type,rarity:3,arche:'normal',cap:30,base:{STR:10,VIT:30,LEAD:10,INT:10},gain:{STR:1.6,VIT:1.6,LEAD:1.4,INT:1.4},
    traits:[],skill:R.skill,aura:'atk',lv:1,xp:0,loyalty:100,injured:0,sq:null,cdLeft:0,downed:false,fought:false,captured:false,cost:0,wage:0}];
  syncMe();genQuests(p);genCompanions(p);
  p1Log(p,`${NATIONS[p.home].name}의 평범한 시민 ${p.name}, ${R.name}의 길을 걷기 시작했다.`);
  show('p1start',false);town=null;toP1();
  popup('🌱 새로운 인생이 시작됐다',`${NATIONS[p.home].name}의 평범한 시민 <b>${p.name}</b>. 꿈은 단 하나, 왕좌다.<br><br>
    · 땅을 누르면 걷고, 건물을 누르면 들어갑니다 (PC: WASD·E)<br>
    · 💼 내 길의 일은 <b>${TOWNB.find(x=>x.id===JOBB[p.route]).ic} ${TOWNB.find(x=>x.id===JOBB[p.route]).n}</b>에서 합니다<br>
    · 한 달은 4주. 활동마다 시간이 들고, 4주가 지나면 월말 결산과 사건이 찾아와요<br>
    · 조건을 채우면 🏰 왕성에서 승진! 모르겠으면 📖 가이드를 보세요`,[{l:'마을로 나가기 ▶'}]);
}
function clampP1(p){
  p.gold=Math.max(0,p.gold);p.health=Math.max(5,Math.min(100,p.health));p.band=Math.max(1,Math.min(60,p.band));p.net=Math.max(0,p.net);p.fame=Math.max(0,p.fame);
  if(p.route==='noble')['roy','nob','peo'].forEach(k=>p.spec[k]=Math.max(0,Math.min(100,p.spec[k])));
  if(p.route==='rebel'){p.spec.support=Math.max(0,Math.min(100,p.spec.support));p.spec.wanted=Math.max(0,Math.min(100,p.spec.wanted));}
}
function checkPerks(p){
  clampP1(p);
  const PU={'전쟁영웅':'u_hero_medal','무역 제국':'u_trade_ring','파벌의 수장':'u_faction_robe','대마도사의 인장':'u_arch_robe','혁명의 불꽃':'u_rebel_mask'};
  (SPEC[p.route].perks||[]).forEach(k=>{if(!hasPerk(p,k.k)&&k.at(p)){p.perks.push(k.k);k.f(p);p1Log(p,`🌟 ${k.txt}`);toast('🌟 '+k.txt);if(PU[k.k]){const u=giveUnique(PU[k.k],k.k);if(u)p1Log(p,u);}}});
}
function startP1Quest(q){
  const p=PP();syncMe();
  if(p1PendWk){q.wk=p1PendWk;p1PendWk=0;}
  counts=bandCounts(p);resetSquads();syncCounts();deploySnap=null;
  const live=heroes.filter(h=>h.injured<=0);
  live.forEach((h,i)=>{h.sq=squads[i%Math.max(1,squads.length)]?squads[i%squads.length].id:null;});
  const ec={spear:0,cav:0,archer:0,mage:0};Object.assign(ec,q.battle);
  show('event',false);hideTown();
  toDeploy({p1:true,q,ec});
}
function finishP1Battle(){
  const p=PP(),q=battleCtx.q;let msg;
  const dead=units.filter(u=>u.team===0&&!u.hero&&u.dead).length;
  const lostBand=Math.min(p.band-1,Math.round(dead*.5));p.band-=lostBand;
  battleCtx=null;
  if(q.crown){
    if(lastWin){return becomeKing([`⚔ ${p.name}이(가) 결전에서 승리하고 왕좌에 올랐다!`]);}
    p.fame=Math.max(0,p.fame-20);p.band=Math.max(2,Math.floor(p.band/2));p.health=Math.max(5,p.health-30);
    msg='<span class="danger">💀 결전에서 패배했다… 명성 −20, 무리 절반 이탈, 건강 −30</span>';
  }else if(lastWin){
    p.wins++;p.gold+=q.gold;const f=addFame(p,q.fame);p.net+=q.net||0;
    const SP=SPEC[p.route];if(SP.onWin)SP.onWin(p);
    if(q.merit)p.spec.merit=(p.spec.merit||0)+q.merit;if(q.arcana)p.spec.arcana=(p.spec.arcana||0)+q.arcana;
    if(q.band)p.band+=q.band;if(q.support)p.spec.support=(p.spec.support||0)+q.support;if(q.wantedDown)p.spec.wanted=Math.max(0,(p.spec.wanted||0)-q.wantedDown);
    msg=`✔ ${q.name} 승리${q.gold||f?`: 💰+${q.gold}, 명성 +${f}`:''}${lostBand?`${q.gold||f?',':':'} 무리 ${lostBand}명 잃음`:''}`;
    const lt=[];
    if(q.npcq){nqDone(p,q.npcq);lt.push('📜 부탁한 사람에게 돌아가 보고하자');}
    if(q.uni){const u=giveUnique(q.uni,q.name+' 승리');if(u)lt.push(u);}
    if(q.uniCh&&Math.random()<q.uniCh[1]){const u=giveUnique(q.uniCh[0],q.name+' 승리');if(u)lt.push(u);}
    if(p.flags.war>0&&!q.ev&&Math.random()<.12){const u=giveUnique('u_storm_spear','전시의 공훈');if(u)lt.push(u);}
    if(heroes.some(h=>h.downed||(h.king&&p.health<40))&&Math.random()<.06){const u=giveUnique('u_phoenix_amulet','쓰러질 뻔한 끝에 승리');if(u)lt.push(u);}
    const l=lootChance(q.ev?.75:.55,p1Lv()+(q.ev?1:0)+(p.flags.war>0?1:0),'전리품');if(l)lt.push(l);
    if(p.wins>=25){const u=giveUnique('u_hundred_helm','전투 25승');if(u)lt.push(u);}
    if(lt.length)msg+='<br>'+lt.join('<br>');
  }else{if(q.npcq){const s_=npcSt(p,q.npcq);s_.active=null;}p.fame=Math.max(0,p.fame-2);msg=`<span class="danger">✘ ${q.name} 패배 (명성 −2${lostBand?`, 무리 ${lostBand}명 잃음`:''})</span>`;}
  p1Log(p,msg);clampP1(p);checkPerks(p);syncMe();
  toP1();
  if(q.wk)p.week=Math.min(WK,p.week+q.wk);
  renderP1();save();
  popup(q.crown?'💀 결전 패배':lastWin?'⚔ 승리!':'💀 패배',msg+(q.wk?`<div class="sub" style="margin-top:8px">⏳ ${q.wk}주가 지났다 · 이번 달 남은 시간 ${WK-p.week}주 ${weekBar(p)}</div>`:''),[{l:'다음 ▶',f:q.wk?afterAct:finishTurn}]);
}
function becomeKing(log){
  const p=PP(),O=p.route;
  stripCiv(p);
  prog.origin=O;prog.kingName=p.name;prog.king={};
  KSTAT.forEach(k=>prog.king[k]=Math.max(15,Math.min(95,Math.round(p.st[k]))));
  prog.kingdomName=NATIONS[p.home].name;NATIONS[0].name=prog.kingdomName;
  prog.bonds=(p.friends||[]).filter(f=>f.bond).map(f=>f.nat);
  prog.bonds.forEach(k=>{if(nations[k]){nations[k].att=(nations[k].att||0)+20;(nations[k].why=nations[k].why||[]).push('의형제가 사는 나라');}});
  prog.originTier=tierOf(p.home,O);
  prog.wins=0;prog.month=1;prog.won=false;prog.gold=300+Math.round(p.gold*.5);prog.city={};citySc=null;
  prog.goods=goodsInit();prog.tax='mid';prog.morale=60+(O==='rebel'?10:0);prog.weather='clear';prog.hungry=false;rollPrices();
  mapSeed=Math.floor(Math.random()*1e9);genWorld(mapSeed);decorateWorld(mapSeed);initNations();
  REG.forEach(r=>{if(r.owner===0){r.owner=-1;r.cap=false;r.bld=[];}});
  REG.forEach(r=>{if(r.owner===p.home)r.owner=0;});
  nations[p.home].alive=false;nations[p.home].absorbed=true;
  if(O==='rebel')nations.forEach((n,i)=>{if(i>0)n.att-=Math.round(15*conM());});
  genRivals();rivals[p.home-1]=[];
  const T=TIERS[prog.originTier];
  log.push(`⚖ 즉위의 역경: <b>${T.n}</b> — 왕의 강점 ×${T.pro}, 약점 ×${T.con}`);
  if(prog.originTier>=2){prog.gold+=150;prog.morale+=5;log.push('🌟 험난한 길을 이겨낸 왕에게 백성들이 환호합니다 (💰+150, 민심 +5)');}
  if(prog.originTier>=3){prog.gold+=100;prog.morale+=3;log.push('🌟 전설적인 역경의 왕 — 추가로 💰+100, 민심 +3, 장수 충성 +5');}
  // 루트별 유산
  const sp=p.spec||{};
  if(O==='merchant'&&sp.shops){prog.gold+=sp.shops*120;log.push(`🏪 상점 ${sp.shops}개를 국고로 넘겼습니다 (💰+${sp.shops*120})`);}
  if(O==='noble'){const d=Math.round(((sp.peo||30)-30)/4);prog.morale+=d;const a=Math.round(((sp.nob||30)-30)/5);nations.forEach((n,i)=>{if(i>0)n.att+=a;});log.push(`📜 파벌 지지: 민심 ${d>=0?'+':''}${d}, 주변국 호감 ${a>=0?'+':''}${a}`);}
  if(O==='rebel'){const d=Math.round((sp.support||0)/10);prog.morale+=d;log.push(`🔥 민중의 지지로 민심 +${d}`);}
  if(O==='mage'){const m=Math.floor((sp.arcana||0)/15);log.push(`🔮 비전 연구로 마정석 +${m}`);prog.goods.mana+=m;}
  prog.morale=Math.max(0,Math.min(100,prog.morale));
  const me=heroes.find(h=>h.king),k=makeKing(O);k.lv=me?me.lv:1;
  heroes=[k,...heroes.filter(h=>!h.king).map(h=>{h.sq=null;h.wage=heroWage(h);h.loyalty=Math.min(100,h.loyalty+15);return h;})];
  counts={spear:6+Math.floor(p.band/6),cav:2+(O==='soldier'?Math.min(2,Math.floor((sp.merit||0)/5)):0),archer:4+Math.floor(p.band/10),mage:O==='mage'?2:1};
  if(prog.originTier>=3)heroes.forEach(h=>{if(!h.king)h.loyalty=Math.min(100,h.loyalty+5);});
  resetSquads();syncCounts();deploySnap=squads.map(q=>({...q}));
  tavern=[];refillTavern(false);
  prog.phase=2;selReg=-1;pendingInv=null;battleCtx=null;ments=[];forceBiome=null;hubTab='king';
  buildMapArt();
  log.push(`👑 ${p.name} 왕, ${prog.kingdomName}을(를) 물려받았습니다 (영토 ${myRegs().length}곳, 출신: ${ORIGINS[O].name})`);
  log.push(`동료 ${heroes.length-1}명이 장수가 됐고, 무리 ${p.band}명이 왕국군의 핵심이 됐습니다`);
  log.push('🎯 새 목표: 대륙의 60%를 차지해 세계 강국이 되세요. 🏰 왕도 탭에서 수도를 키우고, 땅마다 건물을 지어 발전시킬 수 있습니다.');
  log.push(`시민 시절 능력치가 왕의 능력치가 됐습니다: ${KSTAT.map(x=>x+' '+prog.king[x]).join(' · ')}`);
  ['p1','p1start','deploy','result'].forEach(id=>show(id,false));
  const cr=giveUnique('u_crown_circlet','왕위에 올랐다');if(cr)log.push(cr);
  toHub(log);
}
/* ---------- 저장 칸 · 시작 화면 · 게임 소개 ---------- */
function slotInfo(n){
  try{const d=JSON.parse(localStorage.getItem(slotKey(n))||'null');if(!d||!d.prog)return null;const P_=d.prog;
    if(P_.phase===1&&P_.p1){const p=P_.p1,R=ROUTES[p.route];
      return{t:`${R.icon} ${p.name}`,s:`시민 · ${R.ranks[p.rank].n} · ${NATIONS[p.home].name}`,m:`${18+Math.floor(p.month/12)}세 ${p.month}개월째`,at:d.at};}
    if(P_.phase===1||!P_.kingName)return{t:'🌱 새 인생',s:'고향과 길을 고르는 중',m:'',at:d.at};
    const own=d.world&&d.world.regs?d.world.regs.filter(a=>a[0]===0).length:0,tot=d.world&&d.world.regs?d.world.regs.length:0;
    return{t:`👑 ${P_.kingName||'이름 없는'} 왕`,s:`${P_.kingdomName||'나의 왕국'} · 영토 ${own}/${tot}${P_.won?' · 🏆 세계 강국':''}`,m:`즉위 ${P_.month}개월째`,at:d.at};
  }catch(_){return null;}
}
function hideAllForTitle(){['deploy','dhint','top','cmds','hint','result','hub','maphint','report','event','origin','p1start','intro'].forEach(id=>show(id,false));hideTown();}
function showTitle(){
  if(state==='p1'||state==='hub')save();
  state='title';hideAllForTitle();show('zoom',false);
  const el=$('title');
  el.innerHTML=`<div class="logo">👑 왕좌의 길</div><div class="sub" style="text-align:center">평범한 시민에서 왕으로, 왕에서 대륙의 패자로</div>
    <div class="slots" id="slots"></div>
    <div class="btnrow"><button id="tintro" class="ghost">📜 게임 소개 · 목표 보기</button></div>
    <div class="sub" style="text-align:center">진행은 자동으로 저장됩니다. 저장 칸마다 다른 인생을 살 수 있어요. 게임 중에도 💾 버튼으로 돌아올 수 있습니다.</div>`;
  const sl=$('slots');
  [1,2,3].forEach(n=>{const I=slotInfo(n),d=document.createElement('div');d.className='slot'+(n===SLOT&&I?' cur':'');
    const ago=I&&I.at?new Date(I.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    d.innerHTML=`<div class="sn">저장 칸 ${n}</div>${I?`<div class="st">${I.t}</div><div class="sub">${I.s}<br>${I.m}${ago?` · ${ago}`:''}</div>`:'<div class="st" style="color:#8a93b8">빈 칸</div><div class="sub">새로운 인생을 시작할 수 있어요</div>'}`;
    const b=document.createElement('button');b.className='big';b.textContent=I?'이어하기 ▶':'새 인생 시작 ▶';b.onclick=()=>openSlot(n,!I);d.appendChild(b);
    if(I){const x=document.createElement('button');x.className='ghost danger';x.textContent='지우기';
      x.onclick=function(){if(!this._arm){this._arm=1;this.textContent='정말 지울까요? 한 번 더';setTimeout(()=>{if(this.isConnected){this._arm=0;this.textContent='지우기';}},2500);return;}
        try{localStorage.removeItem(slotKey(n));}catch(_){}showTitle();};d.appendChild(x);}
    sl.appendChild(d);});
  $('tintro').onclick=()=>showIntro(false);
  show('title',true);
}
function openSlot(n,fresh){
  SLOT=n;try{localStorage.setItem('throne-road-slot',String(n));}catch(_){}
  show('title',false);town=null;citySc=null;hubTab='map';selReg=-1;
  if(fresh||!load()){newGame();showIntro(true);return;}
  show('zoom',true);
  if(prog.phase===1)toP1();else toHub();
}
function showIntro(thenStart){
  const el=$('intro');
  el.innerHTML=`<div class="logo" style="font-size:24px">👑 왕좌의 길</div>
    <div class="sub" style="text-align:center">평범한 시민으로 태어나 왕이 되고, 그 왕국을 대륙 최강국으로 키우는 이야기</div>
    <div class="act"><div class="an">1막 · 시민에서 왕으로</div>
      <b>🎯 목표: 왕관을 손에 넣기</b><br>
      · 고향 나라와 출세의 길(⚔군인 · 💰상인 · 📜정치 · 🔮마법사 · 🔥반란)을 고릅니다.<br>
      · 마을을 걸어 다니며 건물에 들어가 일하고, 훈련하고, 사람을 사귀고, 의뢰를 해결하세요. <b>한 달은 4주</b>, 활동마다 시간이 듭니다.<br>
      · 명성·돈·인맥·능력치를 모아 🏰왕성에서 계급을 올리고, 마지막 계급에서 조건을 채우면 <b>왕좌에 도전</b>합니다.</div>
    <div class="act"><div class="an">2막 · 왕에서 세계 강국으로</div>
      <b>🎯 목표: 대륙의 60%를 차지하기</b><br>
      · 즉위하면 고향 나라를 물려받습니다. 땅마다 건물을 짓고, 🏰왕도를 단계별로 키우세요.<br>
      · 무역·동맹으로 친구를 만들거나, 원할 때만 전쟁을 걸어 영토를 넓힐 수 있어요.<br>
      · 전투는 미니어처 부대를 배치하고 명령하는 실시간 전투입니다.</div>
    <div class="act"><div class="an">알아두면 좋은 것</div>
      · 시민 시절 능력치가 그대로 <b>왕의 능력치</b>가 됩니다. 함께한 동료는 장수가 돼요.<br>
      · 작은 나라는 왕이 되기 쉽지만 약소국으로 시작하고, 어려운 나라·길로 즉위할수록 왕의 강점이 커집니다.<br>
      · 게임마다 <b>시대</b>와 사건이 달라서 매번 다른 인생이 됩니다.</div>
    <div class="btnrow"><button id="introok" class="big">${thenStart?'인생 시작하기 ▶':'닫기'}</button></div>`;
  $('introok').onclick=()=>{show('intro',false);if(thenStart){show('zoom',true);toP1();}};
  show('intro',true);
}
window.__dbg=()=>({setBiome:b=>{forceBiome=b;},fxAnim,bat:()=>({RVR,BRG,units,GW,C,grid:Array.from(grid),HB:HB?Array.from(HB):null,ST:STAIR?Array.from(STAIR):null,hills}),enterKT,REG:()=>REG,acceptNQ,npcSt,bActs,doAct,initTown,activeNQ,npcQuest,CITIES,openSlot,openTarget,openNpc,cityNpcs,get state(){return state},showTitle,makeItem,rollItem,gainItem,giveUnique,inv,openEquip,heroes:()=>heroes,heroStat,PP,applyCiv,BASES,REG,cam,canAttack,prog,becomeKing,town:()=>town,walkTo,openB,MOD,cityLv,renderHub,setTab:t=>{hubTab=t;renderHub();if(t==='city')mapCam();}});
resize();
tsWait().then(()=>{Object.values(ROOMS).forEach(r=>r.ch.forEach(c=>cimg(`assets/chars/${c[0]}/SpriteSheet.png`)));BCH.concat(HCH).forEach(o=>Object.values(o).forEach(c=>cimg(`assets/chars/${c}/SpriteSheet.png`)));cimg('assets/animals/Horse.png');genTerrain();newGame();showTitle();requestAnimationFrame(frame);$('sndbtn').classList.toggle('off',!SND.on);$('sndbtn').onclick=sndToggle;});
})();
