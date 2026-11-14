/* ===== 아이템 데이터 (아이콘: Raven Fantasy Icons 32x32, 16열) ===== */
window.ITEMDATA=(function(){
  const I=(r,c)=>r*16+c;
  // 무기 블록: 1~3단계 철(90), 4단계 황금(95), 5단계 미스릴(100)
  const WB=t=>t<=3?90:t===4?95:100;
  const TIERN=['낡은','철','강철','황금','미스릴'];
  // [종류키, 이름, 분류, 블록 내 행, 열]
  const WPN=[
    ['sw1','검','sword',0,6],['sw2','장검','sword',0,7],['sw3','기사검','sword',0,8],['sw4','롱소드','sword',0,12],
    ['sw5','브로드소드','sword',0,14],['sw6','대검','sword',0,15],['sw7','바스타드 소드','sword',4,3],['sw8','양손검','sword',4,5],
    ['dg1','단검','dagger',0,3],['dg2','찌르개','dagger',4,0],['rp1','레이피어','dagger',0,13],
    ['cv1','곡도','curved',0,2],['cv2','시미터','curved',4,4],['cv3','도','curved',4,13],
    ['ax1','손도끼','axe',1,7],['ax2','전투 도끼','axe',1,8],['ax3','양날 도끼','axe',1,9],['ax4','대도끼','axe',1,10],
    ['sp1','창','spear',1,3],['sp2','장창','spear',1,6],['sp3','기병창','spear',1,12],['sp4','미늘창','spear',1,2],['sp5','할버드','spear',1,14],['sp6','삼지창','spear',1,5],
    ['hm1','철퇴','hammer',2,0],['hm2','도리깨','hammer',2,1],['hm3','망치','hammer',2,3],['hm4','전쟁 망치','hammer',2,4],['hm5','모닝스타','hammer',4,1],['hm6','곤봉','hammer',1,11],
    ['bw1','단궁','bow',2,10],['bw2','장궁','bow',2,11],['bw3','복합궁','bow',4,9],['bw4','사냥활','bow',4,10],['bw5','전쟁활','bow',4,11],
    ['xb1','석궁','crossbow',2,8],['xb2','중석궁','crossbow',2,9],
    ['st1','지팡이','staff',3,3],['st2','마법 지팡이','staff',3,4],['st3','현자의 지팡이','staff',3,5],['st4','보주 지팡이','staff',3,7],['st5','룬 지팡이','staff',3,9],
    ['wd1','완드','wand',3,0],['wd2','루비 완드','wand',3,1],
    ['sc1','낫','scythe',4,14],['sc2','대낫','scythe',4,15]
  ];
  // 방어구: [키, 이름, 슬롯, 분류, [단계1~5 아이콘]]
  const ARM=[
    ['hv_b','판금 갑옷','arm','heavy',[I(120,1),I(120,0),I(120,7),I(120,6),I(117,3)]],
    ['hv_h','강철 투구','head','heavy',[I(119,1),I(119,0),I(119,7),I(119,6),I(119,14)]],
    ['hv_f','판금 장화','feet','heavy',[I(121,1),I(121,0),I(121,7),I(121,6),I(121,14)]],
    ['md_b','사슬 갑옷','arm','medium',[I(128,0),I(128,1),I(128,2),I(116,4),I(117,1)]],
    ['md_h','사슬 두건','head','medium',[I(128,3),I(128,4),I(129,12),I(129,13),I(129,15)]],
    ['md_f','사슬 장화','feet','medium',[I(128,8),I(128,8),I(128,7),I(135,3),I(135,0)]],
    ['lt_b','가죽 갑옷','arm','light',[I(123,5),I(123,6),I(123,7),I(123,10),I(123,11)]],
    ['lt_h','가죽 두건','head','light',[I(122,5),I(122,0),I(122,6),I(122,3),I(122,4)]],
    ['lt_f','가죽 장화','feet','light',[I(124,5),I(124,6),I(124,7),I(124,10),I(124,11)]],
    ['rb_b','마법사 로브','arm','robe',[I(126,2),I(126,3),I(126,4),I(126,0),I(126,1)]],
    ['rb_h','마법사 모자','head','robe',[I(125,2),I(125,3),I(125,4),I(125,6),I(125,7)]],
    ['rb_f','마법사 신발','feet','robe',[I(127,2),I(127,3),I(127,4),I(127,0),I(127,1)]],
    ['cl_b','귀족 예복','arm','cloth',[I(130,0),I(130,2),I(130,9),I(130,3),I(130,13)]],
    ['cl_h','깃털 모자','head','cloth',[I(125,0),I(125,1),I(125,8),I(125,13),I(125,12)]],
    ['cl_f','고급 구두','feet','cloth',[I(124,0),I(124,1),I(124,2),I(124,3),I(124,4)]],
    ['sh','방패','acc','shield',[I(132,0),I(132,2),I(132,3),I(132,5),I(132,6)]],
    ['rg','반지','acc','ring',[I(115,2),I(115,3),I(115,4),I(115,5),I(115,7)]],
    ['am','목걸이','acc','amulet',[I(115,8),I(129,0),I(115,9),I(136,4),I(136,0)]],
    ['cp','망토','acc','cape',[I(114,1),I(114,0),I(114,1),I(114,0),I(114,0)]],
    ['ob','마력 보주','acc','orb',[I(133,5),I(133,2),I(133,3),I(133,0),I(133,4)]],
    ['bk','마도서','acc','book',[I(18,0),I(18,1),I(18,2),I(18,3),I(18,4)]]
  ];
  // 분류별 기본 능력치(단계 값 tv 배수)와 병종 적합도 [창병, 기병, 궁병, 마법사]
  const CLS={
    sword:{n:'검',st:{STR:1,VIT:.2},fit:[1.1,1.15,.8,.6]},
    dagger:{n:'단검',st:{STR:.7,spd:.025},fit:[.9,.9,1.15,.9]},
    curved:{n:'곡도',st:{STR:.9,spd:.02},fit:[1,1.2,.9,.6]},
    axe:{n:'도끼',st:{STR:1.25},fit:[1.15,1.05,.6,.4]},
    spear:{n:'창',st:{STR:1,LEAD:.3},fit:[1.3,1.25,.6,.5]},
    hammer:{n:'둔기',st:{STR:1.1,VIT:.3},fit:[1.2,1.05,.5,.5]},
    bow:{n:'활',st:{STR:.9,rng:.03},fit:[.5,.85,1.35,.6]},
    crossbow:{n:'석궁',st:{STR:1.2,rng:.02},fit:[.7,.6,1.2,.5]},
    staff:{n:'지팡이',st:{INT:1.1},fit:[.5,.5,.6,1.35]},
    wand:{n:'완드',st:{INT:.8,cd:.025},fit:[.6,.6,.8,1.25]},
    scythe:{n:'낫',st:{STR:1.1,INT:.25},fit:[.9,.8,.5,1]},
    heavy:{n:'중갑',st:{arm:{VIT:1.3,spd:-.05},head:{VIT:.6},feet:{VIT:.4,spd:-.02}},fit:[1.25,1.15,.65,.4]},
    medium:{n:'사슬',st:{arm:{VIT:1},head:{VIT:.45,LEAD:.2},feet:{VIT:.3}},fit:[1.1,1.15,.95,.7]},
    light:{n:'가죽',st:{arm:{VIT:.6,spd:.03},head:{VIT:.3,LEAD:.3},feet:{VIT:.2,spd:.03}},fit:[.85,1,1.25,.9]},
    robe:{n:'로브',st:{arm:{VIT:.4,INT:.6},head:{INT:.5},feet:{INT:.2,spd:.02}},fit:[.6,.6,.8,1.3]},
    cloth:{n:'예복',st:{arm:{VIT:.3,매력:.5},head:{LEAD:.2,매력:.35},feet:{spd:.02,매력:.25}},fit:[.9,.9,.9,1]},
    shield:{n:'방패',st:{VIT:.8},fit:[1.3,1,.6,.6]},
    ring:{n:'반지',st:{STR:.35,매력:.3},fit:[1,1,1,1]},
    amulet:{n:'목걸이',st:{LEAD:.6,내정:.3},fit:[1,1,1,1]},
    cape:{n:'망토',st:{LEAD:.4,spd:.02},fit:[1,1.1,1.05,1]},
    orb:{n:'보주',st:{INT:.8},fit:[.5,.5,.6,1.3]},
    book:{n:'마도서',st:{INT:.5,cd:.04},fit:[.6,.6,.8,1.25]}
  };
  const AFX=[
    {n:'날카로운',e:{STR:.45}},{n:'튼튼한',e:{VIT:.5}},{n:'현명한',e:{INT:.45}},{n:'지휘관의',e:{LEAD:.45}},
    {n:'바람 같은',e:{spd:.04}},{n:'매의 눈',e:{rng:.06}},{n:'신속한',e:{cd:.05}},{n:'매혹적인',e:{매력:.35}},
    {n:'상인의',e:{내정:.35}},{n:'용사의',e:{STR:.3,VIT:.3}},{n:'현자의',e:{INT:.3,cd:.03}},{n:'왕실의',e:{LEAD:.3,매력:.25}}
  ];
  // 전설·고유 아이템. src: 얻는 방법 힌트
  const UNI=[
    {id:'u_sword_master',n:'검성의 유품',slot:'wpn',cls:'sword',ic:I(105,0),st:{STR:26,VIT:6,LEAD:4},d:'전설의 검성이 남긴 검. 휘두르면 불꽃이 인다.',src:'무예 70 이상, 병영에서 수련을 거듭하면 옛 스승이 찾아온다'},
    {id:'u_dragon_mail',n:'용린 갑옷',slot:'arm',cls:'heavy',ic:I(120,13),st:{VIT:34,STR:6,spd:-.02},d:'쓰러뜨린 용의 비늘로 엮은 갑옷.',src:'용의 출현에서 승리'},
    {id:'u_comet_staff',n:'혜성의 지팡이',slot:'wpn',cls:'staff',ic:I(105,15),st:{INT:30,cd:.08},d:'붉은 혜성의 파편이 박힌 지팡이.',src:'붉은 혜성 사건 뒤 마탑에서 연구'},
    {id:'u_prince_ring',n:'망명 왕자의 인장',slot:'acc',cls:'ring',ic:I(115,6),st:{LEAD:12,매력:10},d:'옛 왕가의 문장이 새겨진 반지.',src:'망명 왕자를 끝까지 지켜주면'},
    {id:'u_hunter_bow',n:'사냥왕의 활',slot:'wpn',cls:'bow',ic:I(106,2),st:{STR:22,rng:.15,spd:.03},d:'백 걸음 밖 사슴의 눈을 맞힌다는 활.',src:'근교 사냥을 많이 성공시키면 숲의 은둔자가 나타난다'},
    {id:'u_hundred_helm',n:'백전의 투구',slot:'head',cls:'heavy',ic:I(119,13),st:{VIT:16,LEAD:10},d:'백 번의 전장을 견딘 투구.',src:'전투에서 25번 승리'},
    {id:'u_merchant_seal',n:'상인왕의 인장',slot:'acc',cls:'ring',ic:I(128,13),st:{내정:14,매력:6},d:'대륙의 모든 상단이 고개를 숙인다.',src:'금 1500 이상을 가지고 뒷골목의 보석상을 만나면'},
    {id:'u_goblin_axe',n:'고블린 왕의 도끼',slot:'wpn',cls:'axe',ic:I(106,4),st:{STR:28,VIT:-4},d:'투박하지만 무시무시하게 무겁다.',src:'괴물 대군을 물리치면'},
    {id:'u_saint_robe',n:'성녀의 로브',slot:'arm',cls:'robe',ic:I(130,11),st:{INT:16,VIT:14,매력:8},d:'입은 자의 상처가 저절로 아문다.',src:'신전에서 봉사를 꾸준히 하면'},
    {id:'u_shadow_dagger',n:'그림자 송곳니',slot:'wpn',cls:'dagger',ic:I(107,13),st:{STR:18,spd:.08,cd:.05},d:'달 없는 밤에만 모습을 드러내는 단검.',src:'뒷골목 정보상과 자주 거래하면 그림자가 찾아온다'},
    {id:'u_blind_sage',n:'눈먼 현자의 마도서',slot:'acc',cls:'book',ic:I(18,5),st:{INT:18,cd:.1},d:'글자가 없는 책. 읽는 자의 마음에 직접 말한다.',src:'지략 55 이상으로 학당에서 밤늦게(4주차) 공부하면'},
    {id:'u_old_knight',n:'늙은 기사의 맹세검',slot:'wpn',cls:'sword',ic:I(108,7),st:{STR:20,VIT:8,LEAD:8},d:'한 번도 등을 보이지 않은 기사의 검.',src:'전투 10승 이후 선술집의 늙은 기사와 이야기하면'},
    {id:'u_wolf_cape',n:'늑대왕의 모피',slot:'acc',cls:'cape',ic:I(114,0),st:{LEAD:10,spd:.08,VIT:6},d:'은빛 늑대 우두머리의 가죽.',src:'늑대 떼 사건에서 싸워 이기면 가끔'},
    {id:'u_storm_spear',n:'폭풍을 가르는 창',slot:'wpn',cls:'spear',ic:I(105,6),st:{STR:24,LEAD:8,spd:.04},d:'번개를 머금은 창끝.',src:'전쟁 발발 중 전투 의뢰에서 공을 세우면'},
    {id:'u_tournament',n:'우승자의 월계관',slot:'head',cls:'cloth',ic:I(129,3),st:{매력:14,LEAD:8,STR:6},d:'대륙 무술 대회 우승자의 상징.',src:'대륙 무술 대회 우승'},
    {id:'u_crown_circlet',n:'첫 왕관',slot:'head',cls:'cloth',ic:I(114,10),st:{매력:12,LEAD:12,내정:8},d:'처음 왕좌에 앉던 날 쓴 관.',src:'왕위에 오르면'},
    {id:'u_conqueror',n:'정복자의 깃발',slot:'acc',cls:'cape',ic:I(2,11),st:{LEAD:18,STR:6},d:'휘날리는 곳마다 적이 무릎 꿇는다.',src:'영토 15곳 이상을 다스리면'},
    {id:'u_gold_palace',n:'황금 궁전의 홀',slot:'wpn',cls:'staff',ic:I(106,13),st:{INT:20,매력:12,내정:12},d:'왕권의 상징인 황금 홀.',src:'왕궁을 4단계까지 발전시키면'},
    {id:'u_frost_blade',n:'서리송곳',slot:'wpn',cls:'sword',ic:I(108,13),st:{STR:22,INT:8,cd:.06},d:'닿는 것마다 얼어붙는 칼날.',src:'혹한의 달에 북쪽 전투에서 승리하면 가끔'},
    {id:'u_sun_bow',n:'태양 장궁',slot:'wpn',cls:'bow',ic:I(109,5),st:{STR:24,rng:.2},d:'해가 뜬 동안 화살이 빛난다.',src:'영웅 등급 이상 적 장수를 포로로 잡으면 가끔'},
    {id:'u_mithril_plate',n:'미스릴 성기사 갑옷',slot:'arm',cls:'heavy',ic:I(117,7),st:{VIT:30,LEAD:8},d:'가볍고 단단한 전설의 금속.',src:'떠돌이 대장장이에게 큰돈을 주고 주문'},
    {id:'u_phoenix_amulet',n:'불사조의 깃털',slot:'acc',cls:'amulet',ic:I(16,3),st:{VIT:16,INT:10},d:'죽음에서 한 번 되돌아온다는 깃털.',src:'전투에서 쓰러진 뒤에도 끝내 승리하면 가끔'},
    {id:'u_sea_trident',n:'바다왕의 삼지창',slot:'wpn',cls:'spear',ic:I(105,4),st:{STR:22,VIT:8,LEAD:6},d:'파도를 부르는 삼지창.',src:'강·해안 지방에서 우물가의 노인을 도우면'},
    {id:'u_thunder_hammer',n:'천둥 망치',slot:'wpn',cls:'hammer',ic:I(106,9),st:{STR:26,VIT:8},d:'내리칠 때마다 천둥이 울린다.',src:'고원 지방의 광산 의뢰를 해결하면 가끔'},
    {id:'u_witch_hat',n:'마녀의 고깔',slot:'head',cls:'robe',ic:I(115,0),st:{INT:16,cd:.08},d:'마녀가 남긴 오래된 모자.',src:'습지 지방의 늪 마녀를 만나면'},
    {id:'u_rebel_mask',n:'혁명가의 가면',slot:'head',cls:'light',ic:I(129,14),st:{LEAD:12,매력:8,spd:.04},d:'민중이 기억하는 그 얼굴.',src:'반란의 길에서 민중 지지 85 달성'},
    {id:'u_arch_robe',n:'대마도사의 로브',slot:'arm',cls:'robe',ic:I(126,13),st:{INT:28,VIT:6},d:'별자리가 수놓인 로브.',src:'마법사의 길에서 대마도사의 인장 획득'},
    {id:'u_hero_medal',n:'전쟁 영웅 훈장',slot:'acc',cls:'amulet',ic:I(136,6),st:{STR:8,VIT:8,LEAD:12},d:'왕국이 내린 최고 훈장.',src:'군인의 길에서 전쟁 영웅 달성'},
    {id:'u_trade_ring',n:'무역 제국의 반지',slot:'acc',cls:'ring',ic:I(128,15),st:{내정:12,매력:10},d:'금화 냄새가 나는 반지.',src:'상인의 길에서 무역 제국 달성'},
    {id:'u_faction_robe',n:'파벌 수장의 예복',slot:'arm',cls:'cloth',ic:I(131,13),st:{매력:16,LEAD:8,VIT:6},d:'세 파벌이 모두 인정한 예복.',src:'정치의 길에서 파벌의 수장 달성'},
    {id:'u_cursed_blade',n:'저주받은 마검',slot:'wpn',cls:'sword',ic:I(107,15),st:{STR:36,VIT:-10,매력:-6},d:'엄청난 힘, 그러나 영혼을 갉아먹는다.',src:'어둠의 계약에 응하면'},
    {id:'u_bern_axe',n:'변경 사령관의 도끼',slot:'wpn',cls:'axe',ic:I(106,10),st:{STR:26,VIT:6,LEAD:6},d:'베른 변경을 지켜 온 도끼.',src:'베른 성채의 변경 사령관을 끝까지 도우면'},
    {id:'u_grasen_sword',n:'황실 근위검',slot:'wpn',cls:'sword',ic:I(107,9),st:{STR:24,LEAD:10,매력:4},d:'그라센 황실 근위대의 상징.',src:'그라센 황도의 근위대장 시험을 통과하면'},
    {id:'u_ardel_ledger',n:'금장 조합 장부',slot:'acc',cls:'amulet',ic:I(9,15),st:{내정:16,매력:6,LEAD:4},d:'아르델 상인 조합의 정식 일원 증표.',src:'아르델의 조합장을 끝까지 도우면'},
    {id:'u_solaris_orb',n:'솔라리스 별의 보주',slot:'acc',cls:'orb',ic:I(133,12),st:{INT:22,cd:.08},d:'마탑 꼭대기에서 별빛을 모은 보주.',src:'솔라리스 대마법사의 시험을 통과하면'},
    {id:'u_kardun_banner',n:'카르둔 혁명기',slot:'acc',cls:'cape',ic:I(2,9),st:{LEAD:16,매력:8,spd:.03},d:'억압에 맞선 자들의 깃발.',src:'카르둔 반군 지도자를 끝까지 도우면'},
    {id:'u_moon_wand',n:'달빛 완드',slot:'wpn',cls:'wand',ic:I(105,9),st:{INT:22,cd:.1,매력:4},d:'달이 차오를수록 강해진다.',src:'마법 부흥기 시대에 떠돌이 마법사를 도우면'}
  ];
  return {TIERN,WPN,ARM,CLS,AFX,UNI,WB,I};
})();
