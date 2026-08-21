/*
 * 巴巴驗證機・計算核心（瀏覽器版）
 * 依賴：astronomy.browser.min.js 先載入（全域 window.Astronomy）
 * 出口：window.HDEngine.computeChart(birthDateUTC, opts)
 * 資料來源與驗證見同資料夾 README.md（星曆對 JPL Horizons 8 角秒內；端到端對 Ra Uru Hu 全中）。
 */
(function(global){
  "use strict";
  var Astronomy = global.Astronomy;
  if (!Astronomy) { console.error("HDEngine: 找不到 Astronomy，請先載入 astronomy.browser.min.js"); }

  var WHEEL_START = 302.0, DEG_PER_GATE = 5.625, DEG_PER_LINE = 0.9375, DESIGN_ARC = 88.0;
  var R2D = 180/Math.PI;

  var gateOrder = [41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60];

  var GATE_CENTER = {
    1:'G',2:'G',3:'Sacral',4:'Ajna',5:'Sacral',6:'SolarPlexus',7:'G',8:'Throat',9:'Sacral',10:'G',
    11:'Ajna',12:'Throat',13:'G',14:'Sacral',15:'G',16:'Throat',17:'Ajna',18:'Spleen',19:'Root',20:'Throat',
    21:'Heart',22:'SolarPlexus',23:'Throat',24:'Ajna',25:'G',26:'Heart',27:'Sacral',28:'Spleen',29:'Sacral',30:'SolarPlexus',
    31:'Throat',32:'Spleen',33:'Throat',34:'Sacral',35:'Throat',36:'SolarPlexus',37:'SolarPlexus',38:'Root',39:'Root',40:'Heart',
    41:'Root',42:'Sacral',43:'Ajna',44:'Spleen',45:'Throat',46:'G',47:'Ajna',48:'Spleen',49:'SolarPlexus',50:'Spleen',
    51:'Heart',52:'Root',53:'Root',54:'Root',55:'SolarPlexus',56:'Throat',57:'Spleen',58:'Root',59:'Sacral',60:'Root',
    61:'Head',62:'Throat',63:'Head',64:'Head'
  };

  var CHANNELS = [
    [1,8],[2,14],[3,60],[4,63],[5,15],[6,59],[7,31],[9,52],[10,20],[10,34],[10,57],[11,56],
    [12,22],[13,33],[16,48],[17,62],[18,58],[19,49],[20,34],[20,57],[21,45],[23,43],[24,61],[25,51],
    [26,44],[27,50],[28,38],[29,46],[30,41],[32,54],[34,57],[35,36],[37,40],[39,55],[42,53],[47,64]
  ];

  var MOTORS = ['Sacral','Heart','SolarPlexus','Root'];
  var ALL_CENTERS = ['Head','Ajna','Throat','G','Heart','SolarPlexus','Sacral','Spleen','Root'];
  var CENTER_ZH = {Head:'頭腦',Ajna:'邏輯',Throat:'喉嚨',G:'G中心',Heart:'意志力',SolarPlexus:'情緒',Sacral:'薦骨',Spleen:'直覺',Root:'根部'};
  var PLANET_BODIES = {
    Mercury: Astronomy.Body.Mercury, Venus: Astronomy.Body.Venus, Mars: Astronomy.Body.Mars,
    Jupiter: Astronomy.Body.Jupiter, Saturn: Astronomy.Body.Saturn, Uranus: Astronomy.Body.Uranus,
    Neptune: Astronomy.Body.Neptune, Pluto: Astronomy.Body.Pluto
  };
  var PLANET_ORDER = ['Sun','Earth','NorthNode','SouthNode','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];

  function norm360(d){ return ((d % 360) + 360) % 360; }

  function gateLineOf(lon){
    var off = norm360(lon - WHEEL_START);
    var idx = Math.floor(off / DEG_PER_GATE);
    var within = off - idx*DEG_PER_GATE;
    return { gate: gateOrder[idx], line: Math.floor(within / DEG_PER_LINE) + 1, lon: norm360(lon) };
  }

  function sunLongitude(date){ return norm360(Astronomy.SunPosition(date).elon); }
  function moonLongitude(date){ return norm360(Astronomy.EclipticGeoMoon(date).lon); }
  function planetLongitude(body, date){
    var eqj = Astronomy.GeoVector(body, date, true);
    var e = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(date), eqj);
    return norm360(Math.atan2(e.y, e.x) * R2D);
  }
  function trueNodeLongitude(date){
    var st = Astronomy.GeoMoonState(date);
    var rot = Astronomy.Rotation_EQJ_ECT(date);
    var r = Astronomy.RotateVector(rot, new Astronomy.Vector(st.x, st.y, st.z, st.t));
    var v = Astronomy.RotateVector(rot, new Astronomy.Vector(st.vx, st.vy, st.vz, st.t));
    var hx = r.y*v.z - r.z*v.y, hy = r.z*v.x - r.x*v.z;
    return norm360(Math.atan2(hx, -hy) * R2D);
  }
  function meanNodeLongitude(date){
    var T = Astronomy.MakeTime(date).tt / 36525.0;
    return norm360(125.0445479 - 1934.1362891*T + 0.0020754*T*T + T*T*T/467441 - T*T*T*T/60616000);
  }

  function bodyLongitudes(date, opts){
    var useMean = !(opts && opts.meanNode === false); // 預設平交點
    var sun = sunLongitude(date);
    var north = useMean ? meanNodeLongitude(date) : trueNodeLongitude(date);
    var lons = { Sun: sun, Earth: norm360(sun+180), NorthNode: north, SouthNode: norm360(north+180), Moon: moonLongitude(date) };
    for (var name in PLANET_BODIES) lons[name] = planetLongitude(PLANET_BODIES[name], date);
    return lons;
  }

  function solveDesignTime(birthDate){
    var target = norm360(sunLongitude(birthDate) - DESIGN_ARC);
    var t = birthDate.getTime() - (DESIGN_ARC/0.985647)*86400000;
    for (var i=0;i<40;i++){
      var s = sunLongitude(new Date(t));
      var err = ((s - target + 540) % 360) - 180;
      if (Math.abs(err) < 1e-9) break;
      t -= (err/0.985647)*86400000;
    }
    return new Date(t);
  }

  function activationsToGates(lons){
    var out = {};
    for (var i=0;i<PLANET_ORDER.length;i++){ var n=PLANET_ORDER[i]; out[n] = gateLineOf(lons[n]); }
    return out;
  }

  function deriveFromActiveGates(activeGates, persSunLine, desSunLine){
    var definedChannels = CHANNELS.filter(function(c){ return activeGates.has(c[0]) && activeGates.has(c[1]); });
    var parent = {};
    function find(x){ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; }
    var definedCenters = new Set();
    definedChannels.forEach(function(ch){
      var ca=GATE_CENTER[ch[0]], cb=GATE_CENTER[ch[1]];
      if(!(ca in parent)) parent[ca]=ca;
      if(!(cb in parent)) parent[cb]=cb;
      definedCenters.add(ca); definedCenters.add(cb);
      parent[find(ca)] = find(cb);
    });
    var roots = {};
    definedCenters.forEach(function(c){ roots[find(c)] = true; });
    var nSplit = Object.keys(roots).length;

    function has(c){ return definedCenters.has(c); }
    function sameCompAsThroat(c){ return has('Throat') && has(c) && find('Throat')===find(c); }
    var motorToThroat = has('Throat') && MOTORS.some(function(m){ return sameCompAsThroat(m); });

    var type;
    if (definedCenters.size === 0) type='Reflector';
    else if (has('Sacral')) type = motorToThroat ? 'Manifesting Generator' : 'Generator';
    else if (motorToThroat) type='Manifestor';
    else type='Projector';

    var authority;
    if (has('SolarPlexus')) authority='Emotional';
    else if (has('Sacral')) authority='Sacral';
    else if (has('Spleen')) authority='Splenic';
    else if (has('Heart') && sameCompAsThroat('Heart')) authority='Ego';
    else if (has('G') && sameCompAsThroat('G')) authority='Self-Projected';
    else if (definedCenters.size > 0) authority='Mental';
    else authority='Lunar';

    var DEFN = {0:'None',1:'Single',2:'Split',3:'Triple Split',4:'Quadruple Split'};
    var openCenters = ALL_CENTERS.filter(function(c){ return !definedCenters.has(c); });
    return {
      type: type, authority: authority, definition: DEFN[nSplit] || (nSplit+'-Split'),
      profile: persSunLine + '/' + desSunLine,
      definedCenters: Array.from(definedCenters).sort(),
      openCenters: openCenters,
      definedChannels: definedChannels.map(function(c){ return c.join('-'); }),
      nComponents: nSplit
    };
  }

  // ---- 顯示文案 ----
  var TYPE_ZH = {'Manifestor':'顯示者','Generator':'生產者','Manifesting Generator':'顯示生產者','Projector':'投射者','Reflector':'反映者'};
  var TYPE_EN = {'Manifestor':'MANIFESTOR','Generator':'GENERATOR','Manifesting Generator':'MANIFESTING GENERATOR','Projector':'PROJECTOR','Reflector':'REFLECTOR'};
  var BLOB = {'Manifestor':'阿衝','Generator':'阿亨','Manifesting Generator':'生生','Projector':'小么','Reflector':'月月'};
  var BLOB_KEY = {'Manifestor':'A','Generator':'G','Manifesting Generator':'MG','Projector':'P','Reflector':'R'};
  var TYPE_LINE = {
    'Manifestor':'想到就衝的點火仔，全場第一個動、也第一個閃去充電。',
    'Generator':'電力滿格的引擎，遇到對的事能做一整天，被逼做爛事會當場沒電。',
    'Manifesting Generator':'風風火火的多工快手，同時開五個檔案、還每個都在動。',
    'Projector':'看得比誰都深的軍師，被邀請、被看見，才願意出手。',
    'Reflector':'一面照出全場的鏡子，狀態跟著身邊的人事環境走（超稀有，約1%）。'
  };
  var STRATEGY = {'Manifestor':'告知後行動','Generator':'等待回應','Manifesting Generator':'回應後告知','Projector':'等待邀請','Reflector':'等一個月循環（約28天）'};
  var STRATEGY_LINE = {
    'Manifestor':'動之前先跟相關的人講一聲——不是報備，是潤滑，阻力少一半。',
    'Generator':'別硬起頭，等身體「嗯哼」一聲有反應了，再全力做。',
    'Manifesting Generator':'先等身體亮燈，衝之前多補一句「我要去做囉」，旁邊才跟得上。',
    'Projector':'重要的事等被正式邀請、被點名，你的洞見才被珍惜，也最省力。',
    'Reflector':'大決定別當場拍板，讓月亮繞一圈（約28天）、跟不同人聊過再說。'
  };
  var AUTH_ZH = {
    'Emotional':'情緒權威','Sacral':'薦骨權威','Splenic':'直覺權威','Ego':'意志力權威',
    'Self-Projected':'自我投射權威','Mental':'無內在權威（環境型）','Lunar':'月循環權威'
  };
  var AUTH_LINE = {
    'Emotional':'沒有當下的真相——等情緒波走完一輪、平穩了再決定。',
    'Sacral':'決定在肚子那股當下的「要／不要」，一用頭想就卡。',
    'Splenic':'相信第一時間、只出現一次、很微弱的那個直覺。',
    'Ego':'看你「真心想不想、願不願意承諾」，不勉強。',
    'Self-Projected':'講出來、聽自己說話的聲音，方向自然浮現。',
    'Mental':'體內沒有權威中心，靠對的環境＋信任的人當共鳴板，別自己悶著決定。',
    'Lunar':'等完整一個月循環，讓答案自己浮出來。'
  };
  var DEFN_ZH = {'None':'無定義','Single':'一分人','Split':'二分人','Triple Split':'三分人','Quadruple Split':'四分人'};
  var DEFN_LINE = {
    'None':'九大中心全開放（反映者專屬），像鏡子反映當下的環境。',
    'Single':'能量從頭連到尾、穩定自足，但也特別容易被別人的節奏帶著走。',
    'Split':'分成兩塊、中間有缺口，透過帶著那塊的人交流，最能被補上、被發揮。',
    'Triple Split':'分三塊、彈性大，遇到對的人事場域會被瞬間激活。',
    'Quadruple Split':'分四塊、最少見，雜訊多、決策最慢，需要群體才感覺完整。'
  };
  // 「怎麼用」生活化——每型/每權威/每定義都要有，不是只有範例
  var TYPE_HOWTO = {
    'Manifestor':'想做就啟動，但動之前丟一句「我要去做 X 囉」給會被影響到的人——不是報備，是讓路，阻力少一半。',
    'Generator':'工作/興趣選「有反應」的，別挑「應該做」的；越投入越有電，那就是對的方向。',
    'Manifesting Generator':'同時多線很正常，別逼自己專一；衝出去前補一句「我先弄了」，旁邊才跟得上、少一半摩擦。',
    'Projector':'別跟人拚體力和工時，你的價值是看穿方向；等被邀請、被點名再出手，最省力也最被珍惜。',
    'Reflector':'別急著跟大家同步做決定；把自己放在「對的環境、對的人」旁邊，你會自然對起來。'
  };
  var STRATEGY_HOWTO = {
    'Manifestor':'決定了就做，但先知會會被你影響到的人；把「告知」當潤滑，不是請示。',
    'Generator':'想主動追一個人、搶一個機會前，先等對方或情境丟你一顆「球」，你回擊會比自己開球順。',
    'Manifesting Generator':'先等身體亮燈再動，衝之前補一句「我去弄了」，減少「你怎麼又自己跑掉」的摩擦。',
    'Projector':'重要的事（工作、感情、被重用）等正式邀請；沒被邀就衝去給建議，通常換一句「誰問你了」。',
    'Reflector':'大決定給自己約 28 天，跟不同的人聊過、睡過幾輪，再拍板。'
  };
  var AUTH_HOWTO = {
    'Emotional':'別在情緒高點或低點做決定；睡一晚、等平穩了，那個答案還在，才是真的。',
    'Sacral':'大決定別列 pros/cons，找人問你是非題，聽肚子第一秒的「嗯哼／唔」拍板。',
    'Splenic':'相信第一秒閃過的那個念頭（尤其身體的警訊），它只出現一次、不重複，別被後來的分析蓋過。',
    'Ego':'問自己「我真的想要嗎？我願意承諾嗎？」想要就上，不想要就別勉強證明。',
    'Self-Projected':'找信任的人把它「講出來」，聽你自己說話的聲音和方向——不是聽對方建議，是聽你自己。',
    'Mental':'你體內沒有決策權威，別自己悶著想；找幾個信任的人當共鳴板，在對的環境裡答案才清楚。',
    'Lunar':'給自己一個月循環，別當場被逼決定；讓答案在不同日子、不同人身上慢慢浮出來。'
  };
  var DEFN_HOWTO = {
    'None':'你像鏡子，狀態跟著環境走；花力氣挑「對的地方、對的人」，比改變自己更關鍵。',
    'Single':'你能自己完整運作、很穩，但也容易忽略別人；記得別人跟你節奏不同不是他們的錯。',
    'Split':'覺得「少一塊、想靠近某些人」很正常，那是設計不是你黏人；跟能補你缺口的人相處會「順到不行」。',
    'Triple Split':'你需要多一點人和場域來被啟動，人少反而卡；多接觸不同圈子，你會更完整。',
    'Quadruple Split':'你最需要「人多、環境對」才感覺完整，決策也最慢；別為了快而勉強，給自己時間和群體。'
  };
  // 爻線意義（Profile 用）
  var LINE_MEANING = {
    1:'研究者——先打好基礎、把事情搞懂才安心',
    2:'隱士——天生有才但需要獨處，被呼喚/邀請才發光',
    3:'試錯者——靠親身撞牆才學會，錯不是失敗是資料',
    4:'機會主義者——人脈是舞台，機會來自關係連結',
    5:'異端者——自帶光環常被期待「你來解決」，關鍵時刻給解方',
    6:'典範——前半試錯、中期上屋頂觀察、後期成榜樣'
  };

  function computeChart(birthDateUTC, opts){
    var design = solveDesignTime(birthDateUTC);
    var personality = activationsToGates(bodyLongitudes(birthDateUTC, opts));
    var designAct = activationsToGates(bodyLongitudes(design, opts));
    var activeGates = new Set();
    for (var i=0;i<PLANET_ORDER.length;i++){ var n=PLANET_ORDER[i]; activeGates.add(personality[n].gate); activeGates.add(designAct[n].gate); }
    var d = deriveFromActiveGates(activeGates, personality.Sun.line, designAct.Sun.line);
    var profileLines = d.profile.split('/').map(function(n){ return LINE_MEANING[+n] || n; });
    return {
      birthUTC: birthDateUTC.toISOString(), designUTC: design.toISOString(),
      type: d.type, typeZh: TYPE_ZH[d.type], typeEn: TYPE_EN[d.type], typeLine: TYPE_LINE[d.type], typeHowto: TYPE_HOWTO[d.type],
      blob: BLOB[d.type], blobKey: BLOB_KEY[d.type],
      strategy: STRATEGY[d.type], strategyLine: STRATEGY_LINE[d.type], strategyHowto: STRATEGY_HOWTO[d.type],
      authority: d.authority, authorityZh: AUTH_ZH[d.authority], authorityLine: AUTH_LINE[d.authority], authorityHowto: AUTH_HOWTO[d.authority],
      definition: d.definition, definitionZh: DEFN_ZH[d.definition], definitionLine: DEFN_LINE[d.definition], definitionHowto: DEFN_HOWTO[d.definition],
      profile: d.profile, profileLines: profileLines,
      definedCenters: d.definedCenters, definedCentersCount: d.definedCenters.length,
      openCenters: d.openCenters, openCentersZh: d.openCenters.map(function(x){return CENTER_ZH[x];}),
      definedChannels: d.definedChannels, nComponents: d.nComponents,
      personality: personality, design: designAct
    };
  }

  global.HDEngine = {
    computeChart: computeChart, gateLineOf: gateLineOf, deriveFromActiveGates: deriveFromActiveGates,
    sunLongitude: sunLongitude, bodyLongitudes: bodyLongitudes, solveDesignTime: solveDesignTime
  };
})(typeof window !== 'undefined' ? window : this);
