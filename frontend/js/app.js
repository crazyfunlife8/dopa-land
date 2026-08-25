(function(){
  "use strict";
  // ---- 圖片載入（每張只存一份，去重）----
  var IMG={
  "LOGO": "assets/logo.png",
  "HERO": "assets/hero.webp",
  "IC1": "assets/step-1-birth.png",
  "IC2": "assets/step-2-machine.png",
  "IC3": "assets/step-3-blob.png",
  "A": "assets/blob-manifestor.png",
  "G": "assets/blob-generator.png",
  "MG": "assets/blob-mfg-generator.png",
  "P": "assets/blob-projector.png",
  "R": "assets/blob-reflector.png",
  "LNG0": "assets/lounge-map.png",
  "ANC": "assets/ride-carousel.apng",
  "ANF": "assets/ride-ferris.apng",
  "ANR": "assets/ride-coaster.apng",
  "ANT": "assets/ride-teacup.apng"
};
  document.querySelectorAll("[data-img]").forEach(function(el){ el.src=IMG[el.getAttribute("data-img")]; });

  // ---- 分頁切換 ----
  var views={home:"view-home",verify:"view-verify",blobs:"view-blobs",unlock:"view-unlock",lounge:"view-lounge",tree:"view-tree",coaster:"view-coaster",ferris:"view-ferris",teacup:"view-teacup",inbox:"view-inbox",policy:"view-policy",auth:"view-auth",onboard:"view-onboard",account:"view-account",intro:"view-intro",teacher:"view-teacher",booking:"view-booking",checkout:"view-checkout",payresult:"view-payresult",orders:"view-orders",admin:"view-admin",teacherdash:"view-teacher-dash"};
  var tabs=[].slice.call(document.querySelectorAll(".tabs button"));
  // ---- 登入閘門：大廳社交區＋信箱要登入才進得去 ----
  // ⚠️ teacup（老師市集）刻意不在名單裡：它是付費升級路徑，擋在登入牆後面等於把收入擋掉。
  //    社交區要登入是因為「要記住你是誰、誰在跟你聊」，買東西沒有這個必要。
  var GATED={lounge:1,tree:1,ferris:1,coaster:1,inbox:1,teacherdash:1};
  var GATE_MSG={
    lounge:"大廳需要登入 ",tree:"樹洞需要登入 ",ferris:"配配摩天輪需要登入 ",
    coaster:"抽抽樂飛車需要登入 ",inbox:"信箱需要登入 "
  };
  var prevView="home";   // 給 data-back 用（咖啡杯可從大廳或深度解析進來，返回鈕不能寫死）
  // 計算核心回的 chart.type 是英文（"Manifesting Generator"），UI 的五型 key 是小寫 m/g/mg/p/r。
  // 拿 chart.type 去查中文表會查不到 → 導覽列與預設代號會退成「某隻巴巴」。要用 blobKey（"MG"）轉小寫。
  function chartKey(){
    var c=window.__lastChart;
    return (c && c.blobKey) ? String(c.blobKey).toLowerCase() : null;
  }
  var pendingGo=null;
  function loggedIn(){
    // 直接讀 localStorage，不依賴 DopaAuth——首次載入時 go() 會比 DopaAuth 早跑
    try{ var u=JSON.parse(localStorage.getItem("dopa_user_v1")||"null"); return !!(u&&u.id); }catch(e){ return false; }
  }
  function go(name){
    if(!views[name]) name="home";
    if(GATED[name] && !loggedIn()){
      pendingGo=name;
      var r=document.getElementById("authReason");
      if(r) r.innerHTML="<b>"+(GATE_MSG[name]||"這一區需要登入")+"</b><br>登入後才能存你的分析結果、記住誰在跟你聊天。<br>我們不會拿你的社群帳號發文，也不會抓你的好友名單。";
      name="auth";
    }
    // 記住「離開前是哪一頁」給 data-back 用；被閘門改導到 auth 的那次不算（不然返回會彈回登入頁）
    Object.keys(views).forEach(function(k){
      if(k!==name && document.getElementById(views[k]).classList.contains("active") && name!=="auth") prevView=k;
    });
    Object.keys(views).forEach(function(k){
      document.getElementById(views[k]).classList.toggle("active", k===name);
    });
    tabs.forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-go")===name); });
    if(location.hash!=="#"+name){ history.replaceState(null,"","#"+name); }
    window.scrollTo({top:0,behavior:"auto"});
    // Shop 定義在檔案後面，首次載入的 go() 會比它早跑 → 要擋一下
    if(name==="orders" && typeof Shop!=="undefined" && Shop) Shop.paint();
    // 會員中心的四張卡吃 Profile／Shop 的資料，但 DopaAuth 初始化時那兩個還不存在
    // （首次 paintAccount 會讀到空值）→ 每次進來重畫一次，不要依賴初始化那一次
    if(name==="account" && window.DopaAuth && window.DopaAuth.paintAccount) window.DopaAuth.paintAccount();
    if(name==="tree" && typeof loadTreeWall==="function") loadTreeWall();
    if(name==="ferris" && window.DopaFerris) window.DopaFerris.refresh();
    if(name==="dm" && window.DopaDM) window.DopaDM.refresh();
    if(name==="admin" && window.DopaAdmin) window.DopaAdmin.refresh();
    if(name==="teacherdash" && window.DopaTeacher) window.DopaTeacher.refresh();
    // 設施動畫惰性掛載：只在大廳掛 src、一支一支錯開掛（4 支同時解碼會把沙盒 renderer 打掛）；離開就卸
    var rides=document.querySelectorAll(".ride-anim");
    if(name==="lounge"){
      [].forEach.call(rides,function(im,i){
        setTimeout(function(){
          if(document.getElementById("view-lounge").classList.contains("active") && !im.src)
            im.src=IMG[im.getAttribute("data-anim")]||"";
        }, 200+i*450);
      });
    }else{
      [].forEach.call(rides,function(im){ if(im.src) im.removeAttribute("src"); });
    }
  }
  // ---- 會員：登入／補資料／會員中心（前端空殼・OAuth 由後端串）----
  // 後端交接規格見 `多巴樂園_會員系統_交接規格_v1.md`：
  // 這裡所有 TODO(後端) 標記的地方，都是前端等後端給 API 的接點。
  window.DopaAuth=(function(){
    var LSKEY="dopa_user_v1";
    var TYPEZH={m:"顯示者",g:"生產者",mg:"顯示生產者",p:"投射者",r:"反映者"};
    var U=null;
    try{ U=JSON.parse(localStorage.getItem(LSKEY)||"null"); }catch(e){ U=null; }
    function save(){ try{ localStorage.setItem(LSKEY,JSON.stringify(U)); }catch(e){} }
    function code(){ // 預設代號：類型 + 4 碼
      var s="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r="";
      for(var i=0;i<4;i++) r+=s.charAt(Math.floor(Math.random()*s.length));
      return r;
    }
    function displayName(){
      if(!U) return "";
      if(U.nick) return U.nick;
      // 驗證過就用真的類型當代號前綴，沒驗過先給預設
      var t=chartKey()||U.type;
      return "某隻"+(TYPEZH[t]||"巴巴")+"・#"+U.code;
    }
    function isIn(){ return !!(U && U.id); }

    var navUser=document.getElementById("navUser");
    var USER_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.4-8 5.3V21h16v-1.7c0-2.9-3.6-5.3-8-5.3z"/></svg>';
    function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
    function paintNav(){
      if(!navUser) return;
      if(isIn()){
        // 不用 emoji：provider 用素色圓點表示（Google 藍／LINE 綠）
        // 導覽列只放短標籤：有暱稱就用暱稱，沒有就用「某隻○○者」——代號 #XXXX 留在會員中心，不然膠囊會被切斷
        var t=chartKey()||U.type;
        var short=U.nick ? U.nick.slice(0,8) : "某隻"+(TYPEZH[t]||"巴巴");
        navUser.innerHTML=USER_ICON+'<span class="dot '+(U.provider==="line"?"line":"google")+'"></span>'+esc(short);
        navUser.setAttribute("data-go","account");
      }else{
        navUser.innerHTML=USER_ICON+"登入";
        navUser.setAttribute("data-go","auth");
      }
      // 登入狀態變了，信箱未讀數也要跟著重算（登出後不該還掛著紅點）
      if(window.DopaDM&&window.DopaDM.refresh) window.DopaDM.refresh();
    }

    // ---- 登入頁 ----
    var agree=document.getElementById("agreeChk"), authErr=document.getElementById("authErr");
    function startOAuth(provider){
      if(!agree||!agree.checked){
        if(authErr) authErr.textContent="要先勾選同意條款，才能建立帳號喔";
        if(agree) agree.closest(".auth-agree").scrollIntoView({block:"center",behavior:"smooth"});
        return;
      }
      if(authErr) authErr.textContent="";
      try{ localStorage.setItem("dopa_pending_agree",new Date().toISOString()); }catch(e){}
      window.DopaSupabase.auth.signInWithOAuth({
        provider:provider,
        options:{ redirectTo:window.location.origin+window.location.pathname }
      });
    }
    var gBtn=document.getElementById("loginGoogle"), lBtn=document.getElementById("loginLine");
    if(gBtn) gBtn.addEventListener("click",function(){ startOAuth("google"); });
    if(lBtn) lBtn.addEventListener("click",function(){
      if(!agree||!agree.checked){
        if(authErr) authErr.textContent="要先勾選同意條款，才能建立帳號喔";
        if(agree) agree.closest(".auth-agree").scrollIntoView({block:"center",behavior:"smooth"});
        return;
      }
      if(authErr) authErr.textContent="";
      try{ localStorage.setItem("dopa_pending_agree",new Date().toISOString()); }catch(e){}
      var state=Math.random().toString(36).slice(2);
      window.location.href="https://access.line.me/oauth2/v2.1/authorize"
        +"?response_type=code"
        +"&client_id=2011151612"
        +"&redirect_uri="+encodeURIComponent("https://tylikhvklfxctqnjpbqf.supabase.co/functions/v1/line-callback")
        +"&scope=profile%20openid"
        +"&state="+state;
    });

    // ---- Supabase Auth 狀態監聽 ----
    window.DopaSupabase.auth.onAuthStateChange(function(event,session){
      if((event==="SIGNED_IN"||event==="INITIAL_SESSION")&&session){
        window.DopaSupabase.from("users").select("*").eq("id",session.user.id).single()
          .then(function(res){
            if(res.error||!res.data) return;
            var d=res.data;
            // provider：以 DB 欄位為主，但 LINE 走 Edge Function magic link 時 DB 可能寫 'google'
            // → fallback 檢查 session.user.app_metadata 與 email 特徵
            var _prov=d.provider;
            if(_prov!=="line"){
              var _meta=session.user.app_metadata||{};
              var _mp=_meta.provider||"";
              var _ps=_meta.providers||[];
              var _em=(session.user.email||"").toLowerCase();
              if(_mp==="line"||_mp==="custom:line"||_ps.indexOf("line")>=0||_em.indexOf("line_")===0){
                _prov="line";
              }
            }
            U={ id:d.id, provider:_prov, code:d.display_code,
                nick:d.nick||"", type:d.type||(chartKey()||"g"),
                agreedAt:d.agreed_at, createdAt:d.created_at };
            save(); paintNav();
            var uid=session.user.id;
            window.DopaSupabase.from("birth_data").select("*").eq("user_id",uid).maybeSingle().then(function(bRes){
              if(bRes.data){ var b=bRes.data; try{ localStorage.setItem("dopa_birth_v1",JSON.stringify({date:b.birth_date,time:(b.birth_time||"").slice(0,5),tz:String(b.birth_tz_offset),place:b.birth_place,name:""})); }catch(e){} }
            });
            window.DopaSupabase.from("profiles").select("*").eq("user_id",uid).maybeSingle().then(function(pRes){
              if(pRes.data && typeof Profile!=="undefined" && Profile && Profile.sync){ Profile.sync(pRes.data); paintAccount(); }
            });
            var pendingAgree=null;
            try{ pendingAgree=localStorage.getItem("dopa_pending_agree"); }catch(e){}
            if(pendingAgree&&!d.agreed_at){
              window.DopaSupabase.from("users").update({
                agreed_at:pendingAgree, terms_version:"v1", age_confirmed:true
              }).eq("id",session.user.id).then(function(){});
              try{ localStorage.removeItem("dopa_pending_agree"); }catch(e){}
              go("onboard");
              var pv=document.getElementById("obPreview");
              if(pv) pv.innerHTML="別人會看到：<b>"+displayName()+"</b>";
            } else {
              paintAccount();
              var back=pendingGo; pendingGo=null;
              go(back||"account");
            }
          });
      } else if(event==="SIGNED_OUT"){
        U=null; try{ localStorage.removeItem(LSKEY); }catch(e){}
        paintNav();
      }
    });

    // ---- 補資料頁 ----
    var nick=document.getElementById("obNick"), preview=document.getElementById("obPreview");
    if(nick) nick.addEventListener("input",function(){
      var v=nick.value.trim();
      preview.innerHTML="別人會看到：<b>"+(v||("某隻"+(TYPEZH[U&&U.type]||"巴巴")+"・#"+(U?U.code:"----")))+"</b>";
    });
    function finishOnboard(useNick){
      if(!U) return go("auth");
      U.nick = useNick ? (nick.value||"").trim().slice(0,20) : "";
      save(); paintNav(); paintAccount();
      if(U.id) window.DopaSupabase.from("users")
        .update({nick:U.nick||null, nick_status:U.nick?"pending":"none"})
        .eq("id",U.id).then(function(){});
      if(typeof Profile!=="undefined" && Profile && !Profile.has()){ Profile.open(); return; }
      var back=pendingGo; pendingGo=null;
      go(back||"account");
    }
    var obDone=document.getElementById("obDone"), obSkip=document.getElementById("obSkip");
    if(obDone) obDone.addEventListener("click",function(){ finishOnboard(true); });
    if(obSkip) obSkip.addEventListener("click",function(){ finishOnboard(false); });

    // ---- 封鎖名單 ----
    function loadBlockList(){
      var el=document.getElementById("blockList"); if(!el) return;
      if(!isIn()){ el.innerHTML='<div style="opacity:.5;font-size:.9rem;padding:8px 0;">未登入</div>'; return; }
      el.innerHTML='<div style="opacity:.5;font-size:.9rem;padding:8px 0;">載入中…</div>';
      var uid=U.id;
      window.DopaSupabase.from("blocks").select("blocked_id").eq("blocker_id",uid)
        .then(function(res){
          var ids=(res.data||[]).map(function(r){ return r.blocked_id; });
          if(!ids.length){ el.innerHTML='<div style="opacity:.5;font-size:.9rem;padding:8px 0;">目前沒有封鎖任何人</div>'; return; }
          window.DopaSupabase.from("approved_profiles").select("user_id,type,nick,nick_status,display_code").in("user_id",ids)
            .then(function(pr){
              var map={};
              (pr.data||[]).forEach(function(p){ map[p.user_id]=p; });
              el.innerHTML='';
              ids.forEach(function(bid){
                var p=map[bid],alias=p?(p.nick&&p.nick_status==="approved"?p.nick:"某隻"+(TYPEZH[p.type]||"巴巴")+"・#"+p.display_code):"（帳號已刪除）";
                var row=document.createElement("div"); row.className="acct-row";
                row.innerHTML='<div style="flex:1;font-size:.95rem;">'+esc(alias)+'</div>'
                  +'<button class="btn" type="button">解除封鎖</button>';
                row.querySelector("button").addEventListener("click",function(){
                  var b=this; b.disabled=true; b.textContent="解除中…";
                  window.DopaSupabase.from("blocks").delete().eq("blocker_id",uid).eq("blocked_id",bid)
                    .then(function(r){
                      if(r.error){ b.disabled=false; b.textContent="解除封鎖"; return; }
                      row.remove();
                      if(!el.querySelector(".acct-row")) el.innerHTML='<div style="opacity:.5;font-size:.9rem;padding:8px 0;">目前沒有封鎖任何人</div>';
                    });
                });
                el.appendChild(row);
              });
            });
        });
    }
    // ---- 會員中心 ----
    function paintAccount(){
      if(!isIn()) return;
      setText("acctName",displayName());
      var p=document.getElementById("acctProvider");
      if(p) p.textContent=(U.provider==="line"?"用 LINE 登入":"用 Google 登入")+"　・　加入於 "+(U.createdAt||"").slice(0,10);
      var _baseNick=U.nick||"（用預設代號 #"+U.code+"）";
      setText("setNick",_baseNick);
      var _baseIntro=(typeof Profile!=="undefined"&&Profile)?Profile.summary():"還沒寫";
      setText("setIntro",_baseIntro);
      var chart=window.__lastChart;
      setText("acctChart", chart?("你是 "+chart.blob+"・"+chart.typeZh):"還沒驗證過——去拉一把");
      var bi=(typeof birthInfo==="function")?birthInfo():null;
      setText("setBirth", bi?(bi.date+" "+bi.time+"・"+bi.place):"還沒填");
      if(typeof Shop!=="undefined" && Shop) setText("acctOrders", Shop.summary());
      loadBlockList();
      // 防抖：paintAccount 在登入後可能連發多次，DB 查詢只需跑一次
      clearTimeout(paintAccount._t);
      if(U && U.id){
        var _uid=U.id, _bn=_baseNick, _bi=_baseIntro;
        paintAccount._t=setTimeout(function(){
          window.DopaSupabase.from("users").select("is_admin,nick_status").eq("id",_uid).maybeSingle().then(function(r){
            if(r.error||!r.data) return;
            var adminSec=document.getElementById("adminSection");
            if(adminSec) adminSec.style.display=r.data.is_admin?'':'none';
            var nickEl=document.getElementById("setNick");
            if(nickEl){
              var ns=r.data.nick_status;
              if(ns==="pending"){
                nickEl.innerHTML=esc(_bn)+'<span class="review-badge">審核中</span>';
              } else if(ns==="rejected"){
                nickEl.innerHTML='<span class="review-rej">未通過，請重新設定暱稱</span>';
              }
            }
          });
          window.DopaSupabase.from("profiles").select("intro_status,reject_reason").eq("user_id",_uid).maybeSingle().then(function(r){
            var introEl=document.getElementById("setIntro");
            if(r.error||!introEl||!r.data) return;
            var s=r.data.intro_status, reason=r.data.reject_reason||"";
            if(s==="pending"){
              introEl.innerHTML=esc(_bi)+'<span class="review-badge">審核中</span>';
            } else if(s==="rejected"){
              introEl.innerHTML='<span class="review-rej">未通過</span>'+(reason?'・'+esc(reason):'，請重新編輯');
            } else if(s==="approved"){
              introEl.innerHTML=esc(_bi)+'<span class="review-ok">已過審 ✓</span>';
            }
          });
          window.DopaSupabase.from("teachers").select("id").eq("id",_uid).maybeSingle().then(function(tr){
            var teacherSec=document.getElementById("teacherSection");
            if(teacherSec) teacherSec.style.display=(tr.data&&!tr.error)?'':'none';
          });
        },80);
      }
    }
    var logout=document.getElementById("acctLogout");
    if(logout) logout.addEventListener("click",function(){
      window.DopaSupabase.auth.signOut().then(function(){
        U=null; try{ localStorage.removeItem(LSKEY); }catch(e){}
        paintNav(); go("home"); toast("已登出");
      });
    });
    var del=document.getElementById("acctDelete");
    if(del) del.addEventListener("click",function(){
      // TODO(後端)：呼叫刪除帳號 API；隱私權政策承諾 30 天內清除
      toast("刪除帳號要接後端才會真的生效（示範版只是清掉這台裝置的資料）");
      U=null; try{ localStorage.removeItem(LSKEY); }catch(e){}
      paintNav(); go("home");
    });
    var setNickBtn=document.getElementById("setNickBtn");
    if(setNickBtn) setNickBtn.addEventListener("click",function(){ go("onboard"); if(nick) nick.value=U&&U.nick||""; });
    var setNotify=document.getElementById("setNotify");
    if(setNotify) setNotify.addEventListener("click",function(){
      // TODO(後端)：LINE OA 綁定流程
      toast("LINE 通知綁定要接後端（LINE OA）才能開");
    });

    paintNav(); paintAccount();
    // 驗證完把類型寫進帳號：不然重新整理後 __lastChart 沒了，代號會退回註冊時的預設值
    function setType(k){ if(U && k && TYPEZH[k]){ U.type=k; save(); paintNav(); paintAccount(); window.DopaSupabase.from("users").update({type:k}).eq("id",U.id).then(function(){}); } }
    return { isIn:isIn, user:function(){ return U; }, displayName:displayName,
             paintNav:paintNav, paintAccount:paintAccount, setType:setType };
  })();

  // ---- 大廳自我介紹（公開內容）----
  // 三鐵則落在這裡：<100 字／嚴禁洩漏性別／只講能量。
  // 跟私訊的個資偵測刻意不同調：私訊是「警示但照送」（隱私優先，平台不讀），
  // 自介是公開區、走先審後顯 → 命中就直接擋下不讓送，理由講清楚。
  var Profile=(function(){
    var LSKEY="dopa_profile_v1";
    var P=null; try{ P=JSON.parse(localStorage.getItem(LSKEY)||"null"); }catch(e){ P=null; }
    var TYPEZH={m:"顯示者",g:"生產者",mg:"顯示生產者",p:"投射者",r:"反映者"};
    var POOL=['慢熱','秒回不了','想很久','直球','邊做邊想','耐力型','爆發型','多線並行','一次一件',
              '需要獨處','場域敏感','愛問為什麼','觀察者','帶頭衝','等對的時機','說話很直','容易心軟','認定就很久'];
    var picked=[];
    function save(){ try{ localStorage.setItem(LSKEY,JSON.stringify(P)); }catch(e){} }

    // 性別字眼：只收「明確指涉性別」的詞。刻意不收「他／她」「爸爸／媽媽」——
    // 前者中文常當通稱、後者講的是別人不是自己，收了只會製造誤擋。
    var GENDER=/(男生|女生|男的|女的|男孩|女孩|哥哥|姐姐|姊姊|弟弟|妹妹|男友|女友|男朋友|女朋友|老公|老婆|人妻|人夫|宅男|腐女|我先生|我太太|當爸|當媽)/;
    // 聯絡方式：用「加賴／賴我」這種動詞搭配抓，不抓單一個「賴」——不然「依賴」「信賴」「無賴」全中槍
    var CONTACT=/(加賴|賴我|我的賴|加\s*line|我的\s*line|line\s*id|line\s*[:：]|微信|wechat|telegram|whatsapp|gmail|@[A-Za-z0-9_.]{3,}|\d{8,})/i;
    var IGRE=/(^|[^a-zA-Z])(ig|instagram)([^a-zA-Z]|$)/i;
    function detect(t){
      var m=t.match(GENDER); if(m) return {why:"gender", hit:m[0]};
      m=t.match(CONTACT);   if(m) return {why:"contact", hit:m[0]};
      m=t.match(IGRE);      if(m) return {why:"contact", hit:m[2]};
      return null;
    }

    var ta=document.getElementById("introText"),
        cnt=document.getElementById("introCount"),
        pool=document.getElementById("introTags"),
        tcnt=document.getElementById("introTagCount"),
        pv=document.getElementById("introPreview"),
        err=document.getElementById("introErr"),
        ok=document.getElementById("introOk");

    function meta(){
      var u=(window.DopaAuth&&window.DopaAuth.user)?window.DopaAuth.user():null;
      var t=chartKey()||(u&&u.type)||"g";
      var nm=(u&&u.nick) ? u.nick : ("某隻"+(TYPEZH[t]||"巴巴")+"・#"+((u&&u.code)||"----"));
      return {t:t, nm:nm};
    }
    function paintPreview(){
      if(!pv) return;
      var m=meta(), txt=(ta.value||"").trim();
      pv.innerHTML='<span class="ntype '+m.t+'">某隻'+(TYPEZH[m.t]||"巴巴")+'</span>'
        +'<div class="pc-alias">「'+esc(m.nm)+'」</div>'
        +'<p class="pc-intro">'+(txt?esc(txt):'<span style="opacity:.45;">（還沒寫，這裡會是你的自我介紹）</span>')+'</p>'
        +(picked.length?'<div class="pv-tags">'+picked.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div>':'')
        +'<button class="btn pc-hi" type="button" disabled style="opacity:.45;cursor:default;">想認識</button>';
    }
    function paintTags(){
      if(!pool) return;
      [].forEach.call(pool.querySelectorAll("button"),function(b){
        var on=picked.indexOf(b.textContent)>=0;
        b.classList.toggle("on",on);
        b.classList.toggle("off", !on && picked.length>=3);
      });
      if(tcnt) tcnt.textContent="已選 "+picked.length+" / 3";
    }
    if(pool){
      POOL.forEach(function(tag){
        var b=document.createElement("button"); b.type="button"; b.textContent=tag;
        b.addEventListener("click",function(){
          var i=picked.indexOf(tag);
          if(i>=0) picked.splice(i,1);
          else{ if(picked.length>=3){ toast("最多選 3 個——先取消一個再選"); return; } picked.push(tag); }
          paintTags(); paintPreview();
        });
        pool.appendChild(b);
      });
    }
    if(ta) ta.addEventListener("input",function(){
      var n=ta.value.length;
      if(cnt){ cnt.textContent=n+" / 100"; cnt.style.color=(n>100?"#FF4B2B":""); }
      err.classList.remove("show"); ok.classList.remove("show");
      paintPreview();
    });
    var qs=document.getElementById("introQ");
    if(qs) qs.addEventListener("click",function(e){
      var b=e.target.closest("button[data-q]"); if(!b) return;
      var lead=b.getAttribute("data-q")+"…";
      ta.value = (ta.value||"").trim() ? lead+"\n"+ta.value.trim() : lead;
      ta.focus();
      ta.dispatchEvent(new Event("input",{bubbles:true}));
    });

    function fail(title,msg){
      err.innerHTML="<b>"+title+"</b>"+msg;
      err.classList.add("show"); ok.classList.remove("show");
      err.scrollIntoView({behavior:"smooth",block:"center"});
    }
    var saveBtn=document.getElementById("introSave");
    if(saveBtn) saveBtn.addEventListener("click",function(){
      var txt=(ta.value||"").trim();
      if(txt.length<10){ fail("再多寫一點","至少 10 個字。寫一件最近有感的事就夠了，不用寫得很完整。"); return; }
      if(txt.length>100){ fail("太長了","自介限 100 字以內，現在 "+txt.length+" 字。"); return; }
      if(!picked.length){ fail("還沒選標籤","至少挑 1 個能量標籤，別人才抓得到你的調性。"); return; }
      var d=detect(txt);
      if(d){
        // TODO(後端)：這只是本地初篩。公開內容仍要走 AI 初篩 → 命中攔／送人工，前端擋不住繞過的人。
        if(d.why==="gender"){
          fail("這裡不寫性別","偵測到「"+d.hit+"」。大廳刻意隱藏性別，是為了把焦點從外貌拉回你的能量跟想法——把這段改成講你的感受或狀態就可以送出了。");
        }else{
          fail("自介不能放聯絡方式","偵測到「"+d.hit+"」。自介是公開的，放聯絡方式等於公開你的個資。想跟誰深聊，配對成功後在信箱裡慢慢聊就好。");
        }
        return;
      }
      P={intro:txt, tags:picked.slice(), updatedAt:Date.now()};
      save();
      if(window.DopaAuth&&window.DopaAuth.paintAccount) window.DopaAuth.paintAccount();
      if(window.DopaAuth&&window.DopaAuth.user&&window.DopaAuth.user())
        window.DopaSupabase.from("profiles").upsert({user_id:window.DopaAuth.user().id,intro:txt,energy_tags:picked.slice(),intro_status:"pending"},{onConflict:"user_id"}).then(function(){});
      err.classList.remove("show");
      ok.textContent="存好了！自介是公開內容，會先審後顯——過審就會出現在別人的牆上。";
      ok.classList.add("show");
      var back=pendingGo; pendingGo=null;
      setTimeout(function(){ go(back||"lounge"); },900);
    });
    var skipBtn=document.getElementById("introSkip");
    if(skipBtn) skipBtn.addEventListener("click",function(){
      var back=pendingGo; pendingGo=null;
      go(back||"account");
    });

    function open(){
      if(P){
        if(ta) ta.value=P.intro||"";
        picked=(P.tags||[]).slice(0,3);
      }
      if(cnt) cnt.textContent=((ta&&ta.value.length)||0)+" / 100";
      err.classList.remove("show"); ok.classList.remove("show");
      paintTags(); paintPreview();
      go("intro");
    }
    // 從會員中心的 data-go="intro" 進來時也要重新填一次
    document.querySelectorAll('[data-go="intro"]').forEach(function(el){
      el.addEventListener("click",function(){ open(); });
    });
    paintTags(); paintPreview();
    return {
      open:open,
      has:function(){ return !!(P && P.intro); },
      summary:function(){ return P&&P.intro ? (P.intro.slice(0,18)+(P.intro.length>18?"…":"")) : "還沒寫"; },
      sync:function(data){ if(!data) return; P={intro:data.intro||"",tags:data.energy_tags||[],updatedAt:Date.now()}; try{ localStorage.setItem(LSKEY,JSON.stringify(P)); }catch(e){} }
    };
  })();

  // ---- 首頁：五款巴巴滑動卡牌（scroll-snap ＋ 箭頭 ＋ 圓點）----
  (function(){
    var deck=document.getElementById("blobDeck");
    if(!deck) return;
    var cards=[].slice.call(deck.querySelectorAll(".deck-card")),
        dots=document.getElementById("deckDots"),
        prev=document.getElementById("deckPrev"), next=document.getElementById("deckNext");
    cards.forEach(function(){ dots.appendChild(document.createElement("i")); });
    var dotEls=[].slice.call(dots.children);
    // 目前在第幾張＝哪張卡的左緣離容器左緣最近（配合 scroll-snap-align:start）
    function activeIndex(){
      var dl=deck.getBoundingClientRect().left, best=0, bestD=Infinity;
      cards.forEach(function(c,i){
        var d=Math.abs(c.getBoundingClientRect().left-dl);
        if(d<bestD){ bestD=d; best=i; }
      });
      return best;
    }
    function update(){
      var i=activeIndex();
      dotEls.forEach(function(d,n){ d.classList.toggle("on",n===i); });
      var max=deck.scrollWidth-deck.clientWidth;
      prev.disabled = i<=0;
      // max<=2 代表容器還沒排好版（例如視窗寬度為 0 時），這時別把 next 鎖死
      next.disabled = max>2 ? (deck.scrollLeft>=max-4 || i>=cards.length-1) : false;
    }
    function goTo(i){
      i=Math.max(0,Math.min(cards.length-1,i));
      // 自己算位移：scroll-padding 已和 padding 對齊，所以第 i 張的位置就是 i×(卡寬+gap)。
      // 不用 scrollIntoView——它會連帶捲動整頁，把水平的平滑捲動打斷，卡在非 snap 點上。
      deck.scrollTo({left:i*(cards[0].getBoundingClientRect().width+16),behavior:"smooth"});
    }
    // 直接呼叫、不掛 requestAnimationFrame：分頁在背景或畫面沒在合成時 rAF 不會執行，狀態會卡住
    deck.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    prev.addEventListener("click",function(){ goTo(activeIndex()-1); });
    next.addEventListener("click",function(){ goTo(activeIndex()+1); });
    dotEls.forEach(function(d,n){ d.addEventListener("click",function(){ goTo(n); }); });
    cards.forEach(function(c){ var im=c.querySelector("img"); if(im) im.addEventListener("load",update); });
    update();
  })();

  // ---- 政策三頁切換（footer 連結指定要開哪一份）----
  function showDoc(which){
    var docs={privacy:"doc-privacy",terms:"doc-terms",rules:"doc-rules"};
    if(!docs[which]) which="privacy";
    Object.keys(docs).forEach(function(k){
      var d=document.getElementById(docs[k]); if(d) d.classList.toggle("on", k===which);
    });
    document.querySelectorAll("#policyNav button").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-doc")===which);
    });
  }
  document.querySelectorAll("#policyNav button").forEach(function(b){
    b.addEventListener("click",function(){ showDoc(b.getAttribute("data-doc")); });
  });

  document.querySelectorAll("[data-go]").forEach(function(el){
    el.addEventListener("click",function(e){
      e.preventDefault();
      var doc=el.getAttribute("data-doc"); if(doc) showDoc(doc);
      go(el.getAttribute("data-go"));
    });
  });
  document.querySelectorAll("[data-back]").forEach(function(el){
    el.addEventListener("click",function(e){ e.preventDefault(); go(prevView||"home"); });
  });
  go((location.hash||"#home").slice(1));

  // ---- 即將開放提示 toast ----
  var toastEl=document.getElementById("toast"),toastT;
  function toast(msg){ if(!toastEl)return; toastEl.textContent=msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(function(){ toastEl.classList.remove("show"); },2200); }
  document.querySelectorAll("[data-soon]").forEach(function(b){ b.addEventListener("click",function(){ toast(b.getAttribute("data-soon")); }); });

  // 泥巴寶已改用 CSS animation 常駐播放（不再 hover 觸發），JS 不用做事

  // ---- 拉霸 + 表單 ----
  var form=document.getElementById("hdForm"),
      machine=document.getElementById("machine"),
      spin=document.getElementById("spin"),
      formErr=document.getElementById("formErr"),
      resultEl=document.getElementById("result");
  var BLOBS=[].slice.call(document.querySelectorAll(".prod .cap img")).map(function(i){return i.src;});
  var reelImgs=[].slice.call(document.querySelectorAll("#spin .reel img"));

  function runSpin(done){
    spin.style.display="block";
    var finished=0;
    reelImgs.forEach(function(img,idx){
      var i=idx,t=55,ticks=0,maxTicks=15+idx*6;
      (function tick(){
        img.src=BLOBS[i%BLOBS.length]; i++; ticks++;
        img.style.animation="none"; void img.offsetWidth; img.style.animation="";
        if(ticks<maxTicks){ t*=1.07; setTimeout(tick,t); }
        else{ finished++; if(finished===reelImgs.length){ setTimeout(done,320); } }
      })();
    });
  }

  var resCard=document.getElementById("resCard");
  var repCard=document.getElementById("repCard");
  var TYPE_COLOR={'Manifestor':'--mani','Generator':'--gen','Manifesting Generator':'--mg','Projector':'--proj','Reflector':'--refl'};
  function setText(id,t){ var el=document.getElementById(id); if(el) el.textContent=t; }

  function renderResult(chart, name){
    verified=true; // 真的驗證完成 → 才准解鎖
    resCard.style.setProperty("--accent","var("+(TYPE_COLOR[chart.type]||"--gen")+")");
    document.getElementById("resKicker").textContent = name ? (name+"，你是——") : "算出來了，你是——";
    var mon=document.querySelector("#resMon img"); if(mon){ mon.src=IMG[chart.blobKey]; mon.alt=chart.blob; }
    setText("resName", chart.blob+" · "+chart.typeZh);
    setText("resEn", chart.typeEn);
    setText("resTypeNm", chart.typeZh+"・"+chart.blob);
    setText("resTypeDs", chart.typeLine);
    setText("resTypeHow", "▸ 怎麼用｜"+chart.typeHowto);
    setText("resStratNm", chart.strategy);
    setText("resStratDs", chart.strategyLine);
    setText("resStratHow", "▸ 怎麼用｜"+chart.strategyHowto);
    personalizeUnlock(chart);
  }

  function personalizeUnlock(c){
    if(!repCard) return;
    cardChart=c; // 存一份供「下載圖卡」用
    repCard.classList.remove("unlocked"); // 新結果回到鎖定，重新體驗解鎖
    repCard.style.setProperty("--accent","var("+(TYPE_COLOR[c.type]||"--gen")+")");
    setText("repSub", c.blob+" · "+c.typeZh+" · Profile "+c.profile);
    if(window.HDContent){
      var r=window.HDContent.buildReport(c);
      document.getElementById("repFree").innerHTML=r.freeHtml;
      document.getElementById("repLocked").innerHTML=r.lockedHtml;
    }
  }

  var unlockBtn=document.getElementById("unlockBtn");
  function unlockReport(){
    if(repCard){ repCard.classList.add("unlocked"); repCard.scrollIntoView({behavior:"smooth",block:"start"}); }
  }
  if(unlockBtn) unlockBtn.addEventListener("click",function(){
    if(!verified){ // 沒真的驗證過就想解鎖 → 先帶去驗證（示範資料不算）
      toast("先完成巴巴驗證，才能解鎖你的完整解讀 ");
      if(formErr) formErr.textContent="先驗證你的巴巴，這裡才會長出屬於你的完整解讀。";
      go("verify");
      return;
    }
    // 已定案：收款先於出解讀（數位商品不做一手交一手）→ 不直接解鎖，先進結帳
    Shop.checkout({
      kind:"ai",
      title:"巴巴驗證機・完整深度解析",
      desc:"內在權威、定義、人生角色 Profile 的完整逐段解讀，＋可存成限動／貼文的圖卡",
      amount:99
    });
  });

  // ---- 下載巴巴圖卡（9:16 PNG，純前端 SVG→canvas，無外部依賴）----
  var cardChart=null, verified=false; // verified 只有「真的跑過巴巴驗證」才 true（示範資料不算）
  var CARD_HEX={'Manifestor':'#FF4B2B','Generator':'#FFC01E','Manifesting Generator':'#FF8A1E','Projector':'#2E7BF6','Reflector':'#B25CFF'};
  var CARD_QUOTE={
    'Manifestor':['先做了再說啦。','動之前講一聲，世界會給你讓路。'],
    'Generator':['這個我可以做一整天欸。','等身體「嗯哼」亮燈，再全力做。'],
    'Manifesting Generator':['我先衝了喔——啊對，忘了講。','先等身體亮燈，衝出去記得補一聲。'],
    'Projector':['我早就看出來了。','等被看見、被邀請，洞見才被珍惜。'],
    'Reflector':['急什麼，等月亮繞一圈再說。','大決定給自己一個月，別當場拍板。']
  };
  var CARD_ROLE={'1/3':'探究的實驗者','1/4':'友善的研究者','2/4':'隱士機會主義者','2/5':'害羞的軍師','3/5':'試錯的軍師','3/6':'試錯的典範','4/6':'人脈典範','5/1':'紮實的軍師','5/2':'隱性的軍師','6/2':'害羞的典範','6/3':'試錯的典範','4/1':'機會的研究者'};
  function cesc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function cardRow(y0,lbl,lblColor,hint,val){
    var lblTxt = lbl.length>1
      ? '<text x="179" y="'+(y0+71)+'" font-size="30" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[0]+'</text><text x="179" y="'+(y0+105)+'" font-size="30" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[1]+'</text>'
      : '<text x="179" y="'+(y0+87)+'" font-size="34" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[0]+'</text>';
    return '<rect x="82" y="'+(y0+8)+'" width="916" height="150" rx="26" fill="#141018"/>'
      +'<rect x="74" y="'+y0+'" width="916" height="150" rx="26" fill="#FFFDF6" stroke="#141018" stroke-width="6"/>'
      +'<rect x="104" y="'+(y0+30)+'" width="150" height="90" rx="16" fill="'+lblColor+'" stroke="#141018" stroke-width="5"/>'
      +lblTxt
      +'<text x="288" y="'+(y0+66)+'" font-size="30" font-weight="700" fill="#7a7280">'+cesc(hint)+'</text>'
      +'<text x="288" y="'+(y0+116)+'" font-size="46" font-weight="900" fill="#141018">'+cesc(val)+'</text>';
  }
  function buildCardSVG(c){
    var color=CARD_HEX[c.type]||'#FFC01E';
    var q=CARD_QUOTE[c.type]||['',''];
    var role=CARD_ROLE[c.profile]||'';
    var img=IMG[c.blobKey]||'';
    var en=cesc((c.typeEn||'').toUpperCase());
    var roleLine=c.profile+(role?'・'+role:'');
    return [
      '<svg viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans TC,PingFang TC,Microsoft JhengHei,Heiti TC,sans-serif">',
      '<defs><pattern id="d" width="46" height="46" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="5" fill="#141018" opacity=".05"/></pattern></defs>',
      '<rect width="1080" height="1920" fill="#FFF6E6"/>',
      '<rect width="1080" height="1920" fill="url(#d)"/>',
      '<rect x="20" y="20" width="1040" height="1880" rx="44" fill="none" stroke="#141018" stroke-width="8"/>',
      '<text x="70" y="118" font-size="46" font-weight="900" fill="#1F3FD8">多巴樂園</text>',
      '<rect x="742" y="72" width="268" height="60" rx="30" fill="#141018"/>',
      '<text x="876" y="112" font-size="30" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="2">巴巴驗證結果</text>',
      '<circle cx="540" cy="470" r="250" fill="'+color+'" stroke="#141018" stroke-width="8"/>',
      '<circle cx="540" cy="470" r="198" fill="#FFFDF6" stroke="#141018" stroke-width="5"/>',
      '<circle cx="255" cy="277" r="23" fill="#FFD21E" stroke="#141018" stroke-width="3"/>',
      '<circle cx="830" cy="624" r="18" fill="#FFD21E" stroke="#141018" stroke-width="3"/>',
      (img?'<image href="'+img+'" x="356" y="286" width="368" height="368" preserveAspectRatio="xMidYMid meet"/>':''),
      '<text x="540" y="850" font-size="150" font-weight="900" fill="#141018" text-anchor="middle" letter-spacing="6">'+cesc(c.typeZh)+'</text>',
      '<text x="540" y="912" font-size="38" font-weight="800" fill="'+color+'" text-anchor="middle" letter-spacing="8">'+en+'・'+cesc(c.blob)+'</text>',
      cardRow(976,['策略'],color,'你該怎麼啟動',c.strategy),
      cardRow(1158,['內在','權威'],'#1F3FD8','你該怎麼做決定',c.authorityZh),
      cardRow(1340,['人生','角色'],'#1FC98A','你跟世界互動的人設',roleLine),
      '<rect x="82" y="1548" width="916" height="196" rx="26" fill="#141018"/>',
      '<rect x="74" y="1540" width="916" height="196" rx="26" fill="'+color+'" stroke="#141018" stroke-width="6"/>',
      '<text x="540" y="1624" font-size="54" font-weight="900" fill="#fff" text-anchor="middle">'+cesc(q[0])+'</text>',
      '<text x="540" y="1686" font-size="34" font-weight="700" fill="#fff" text-anchor="middle" opacity=".9">'+cesc(q[1])+'</text>',
      '<rect x="74" y="1770" width="600" height="86" rx="43" fill="#FFD21E" stroke="#141018" stroke-width="6"/>',
      '<text x="374" y="1827" font-size="42" font-weight="900" fill="#141018" text-anchor="middle">＠chieh.o_06</text>',
      '<text x="710" y="1806" font-size="30" font-weight="800" fill="#141018">拉巴拉巴</text>',
      '<text x="710" y="1846" font-size="30" font-weight="800" fill="#7a7280">多巴樂園・線上算你的圖</text>',
      '</svg>'
    ].join('');
  }
  // ---- 方形 1:1 貼文版（左巴巴＋右三卡＋底金句橫幅）----
  function sqRow(y0,lbl,lblColor,hint,val){
    var vfs=(String(val).length>9)?28:34;
    var lblTxt = lbl.length>1
      ? '<text x="596" y="'+(y0+58)+'" font-size="26" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[0]+'</text><text x="596" y="'+(y0+88)+'" font-size="26" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[1]+'</text>'
      : '<text x="596" y="'+(y0+72)+'" font-size="30" font-weight="900" fill="#fff" text-anchor="middle">'+lbl[0]+'</text>';
    return '<rect x="528" y="'+(y0+8)+'" width="492" height="132" rx="22" fill="#141018"/>'
      +'<rect x="520" y="'+y0+'" width="492" height="132" rx="22" fill="#FFFDF6" stroke="#141018" stroke-width="6"/>'
      +'<rect x="544" y="'+(y0+26)+'" width="104" height="80" rx="14" fill="'+lblColor+'" stroke="#141018" stroke-width="4"/>'
      +lblTxt
      +'<text x="672" y="'+(y0+54)+'" font-size="24" font-weight="700" fill="#7a7280">'+cesc(hint)+'</text>'
      +'<text x="672" y="'+(y0+98)+'" font-size="'+vfs+'" font-weight="900" fill="#141018">'+cesc(val)+'</text>';
  }
  function buildSquareCard(c){
    var color=CARD_HEX[c.type]||'#FFC01E';
    var q=CARD_QUOTE[c.type]||['',''];
    var role=CARD_ROLE[c.profile]||'';
    var img=IMG[c.blobKey]||'';
    var en=cesc((c.typeEn||'').toUpperCase());
    var roleLine=c.profile+(role?'・'+role:'');
    return [
      '<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans TC,PingFang TC,Microsoft JhengHei,Heiti TC,sans-serif">',
      '<defs><pattern id="d2" width="46" height="46" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="5" fill="#141018" opacity=".05"/></pattern></defs>',
      '<rect width="1080" height="1080" fill="#FFF6E6"/>',
      '<rect width="1080" height="1080" fill="url(#d2)"/>',
      '<rect x="20" y="20" width="1040" height="1040" rx="40" fill="none" stroke="#141018" stroke-width="8"/>',
      '<text x="60" y="112" font-size="42" font-weight="900" fill="#1F3FD8">多巴樂園</text>',
      '<rect x="762" y="66" width="248" height="56" rx="28" fill="#141018"/>',
      '<text x="886" y="103" font-size="27" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="2">巴巴驗證結果</text>',
      '<circle cx="278" cy="360" r="172" fill="'+color+'" stroke="#141018" stroke-width="8"/>',
      '<circle cx="278" cy="360" r="136" fill="#FFFDF6" stroke="#141018" stroke-width="5"/>',
      '<circle cx="88" cy="210" r="18" fill="#FFD21E" stroke="#141018" stroke-width="3"/>',
      (img?'<image href="'+img+'" x="150" y="232" width="256" height="256" preserveAspectRatio="xMidYMid meet"/>':''),
      '<text x="278" y="610" font-size="92" font-weight="900" fill="#141018" text-anchor="middle" letter-spacing="4">'+cesc(c.typeZh)+'</text>',
      '<text x="278" y="660" font-size="24" font-weight="800" fill="'+color+'" text-anchor="middle" letter-spacing="3">'+en+'・'+cesc(c.blob)+'</text>',
      sqRow(158,['策略'],color,'你該怎麼啟動',c.strategy),
      sqRow(314,['內在','權威'],'#1F3FD8','你該怎麼做決定',c.authorityZh),
      sqRow(470,['人生','角色'],'#1FC98A','你跟世界互動的人設',roleLine),
      '<rect x="68" y="712" width="952" height="150" rx="24" fill="#141018"/>',
      '<rect x="60" y="704" width="952" height="150" rx="24" fill="'+color+'" stroke="#141018" stroke-width="6"/>',
      '<text x="536" y="772" font-size="46" font-weight="900" fill="#fff" text-anchor="middle">'+cesc(q[0])+'</text>',
      '<text x="536" y="822" font-size="27" font-weight="700" fill="#fff" text-anchor="middle" opacity=".9">'+cesc(q[1])+'</text>',
      '<rect x="60" y="906" width="520" height="80" rx="40" fill="#FFD21E" stroke="#141018" stroke-width="6"/>',
      '<text x="320" y="960" font-size="38" font-weight="900" fill="#141018" text-anchor="middle">＠chieh.o_06</text>',
      '<text x="616" y="944" font-size="27" font-weight="800" fill="#141018">拉巴拉巴</text>',
      '<text x="616" y="980" font-size="27" font-weight="800" fill="#7a7280">多巴樂園・線上算你的圖</text>',
      '</svg>'
    ].join('');
  }
  function showCardResult(png, square){
    var box=document.getElementById('cardOut'),
        img=document.getElementById('cardOutImg'),
        note=document.getElementById('cardOutNote');
    if(!box||!img) return;
    img.src=png;
    if(note) note.textContent=(square?'貼文版 1:1':'限動版 9:16')+'圖卡好了 手機長按圖片存到相簿・電腦按右鍵另存';
    box.style.display='block';
    box.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function downloadCard(fmt){
    var c=cardChart||window.__lastChart;
    if(!c){ toast('先到「巴巴驗證」算出你的結果，才有圖卡可存～'); go('verify'); return; }
    var square=(fmt==='post');
    var svg=square?buildSquareCard(c):buildCardSVG(c);
    var W=1080, H=square?1080:1920;
    // 用 data: URL（不用 blob:），繞過 Artifact 沙盒對 blob 的 CSP 限制
    var url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    var im=new Image();
    im.onload=function(){
      try{
        var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
        cv.getContext('2d').drawImage(im,0,0,W,H);
        // 沙盒沒 allow-downloads，a.download 會被擋 → 改成把 PNG 直接顯示在頁面讓使用者長按/右鍵存
        showCardResult(cv.toDataURL('image/png'), square);
      }catch(err){ toast('圖卡匯出失敗：'+err.message); }
    };
    im.onerror=function(){ toast('圖卡生成失敗，請重試'); };
    im.src=url;
  }
  var dlCardBtn=document.getElementById("dlCardBtn");
  if(dlCardBtn) dlCardBtn.addEventListener("click",function(){downloadCard('story');});
  var dlCardBtnSq=document.getElementById("dlCardBtnSq");
  if(dlCardBtnSq) dlCardBtnSq.addEventListener("click",function(){downloadCard('post');});

  // ---- 樹洞按讚 ----
  var Likes=(function(){
    var mine={};
    var HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.2-4.4-9.2-8.5C1.2 8 3 4.5 6.3 4.5c2 0 3.2 1.1 3.9 2.1l.8 1.1.8-1.1c.7-1 1.9-2.1 3.9-2.1 3.3 0 5.1 3.5 3.5 6.9C19.2 15.6 12 20 12 20z" stroke-linejoin="round"/></svg>';
    function setMine(obj){ mine=obj||{}; }
    function attach(note){
      if(!note || note.querySelector(".like")) return;
      var foot=note.querySelector(".nfoot"); if(!foot) return;
      var nid=note.getAttribute("data-nid")||"";
      var count=parseInt(note.getAttribute("data-likes")||"0",10)||0;
      var b=document.createElement("button");
      b.className="like"; b.type="button"; b.setAttribute("aria-label","我也有同感");
      function paint(on,c){
        b.classList.toggle("on",on);
        b.innerHTML=HEART+'<span class="lc">'+c+'</span>';
        b.setAttribute("aria-pressed",on?"true":"false");
      }
      paint(!!mine[nid], count);
      b.addEventListener("click",function(){
        var auth=window.DopaAuth;
        if(!auth||!auth.isIn()){ toast("需要登入才能按讚"); return; }
        var wasOn=b.classList.contains("on");
        var nowOn=!wasOn;
        var delta=nowOn?1:-1;
        count+=delta;
        if(nowOn) mine[nid]=1; else delete mine[nid];
        paint(nowOn, count);
        if(nowOn){ b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
        var q=nowOn
          ? window.DopaSupabase.from("lounge_post_likes").insert({post_id:nid,user_id:auth.user().id})
          : window.DopaSupabase.from("lounge_post_likes").delete().eq("post_id",nid).eq("user_id",auth.user().id);
        q.then(function(r){
          if(r.error){ count-=delta; if(wasOn) mine[nid]=1; else delete mine[nid]; paint(wasOn,count); }
        });
      });
      foot.appendChild(b);
    }
    return {attach:attach, setMine:setMine};
  })();

  // ---- 樹洞：載入真實紙條牆 ----
  var TREE_TYPEZH={m:'某隻顯示者',g:'某隻生產者',mg:'某隻顯生',p:'某隻投射者',r:'某隻反映者'};
  function treeTimeAgo(iso){
    var d=new Date(iso),n=new Date(),s=Math.floor((n-d)/1000);
    if(s<3600) return Math.max(1,Math.floor(s/60))+'分鐘前';
    if(s<86400) return Math.floor(s/3600)+'小時前';
    if(s<172800) return '昨天';
    return Math.floor(s/86400)+'天前';
  }
  function renderNote(post){
    var n=document.createElement('div');
    n.className='note'; n.setAttribute('data-nid',post.id); n.setAttribute('data-likes',post.like_count||0);
    var rBtn=post.user_id?'<button class="note-report" type="button" title="檢舉" data-uid="'+post.user_id+'" data-body="'+esc(post.body)+'">⚑</button>':'';
    n.innerHTML='<span class="ntype '+post.type+'">'+esc(TREE_TYPEZH[post.type]||'某隻巴巴')+'</span>'
      +'<p>'+esc(post.body)+'</p>'
      +'<div class="nfoot"><span class="nt">'+treeTimeAgo(post.created_at)+'</span>'+rBtn+'</div>';
    Likes.attach(n);
    return n;
  }
  function loadMyPosts(){
    var auth=window.DopaAuth;
    if(!auth||!auth.isIn()){ go('auth'); return; }
    var panel=document.getElementById('myPostsPanel');
    if(!panel) return;
    if(panel.style.display!=='none'){ panel.style.display='none'; return; }
    panel.innerHTML='<div class="note" style="opacity:.5;text-align:center;padding:12px;">載入中…</div>';
    panel.style.display='block';
    var uid=auth.user().id;
    window.DopaSupabase.from('lounge_posts')
      .select('id,type,body,status,reject_reason,created_at').eq('user_id',uid)
      .order('created_at',{ascending:false}).limit(20)
      .then(function(res){
        var posts=res.data||[];
        if(!posts.length){ panel.innerHTML='<div class="note" style="opacity:.5;text-align:center;padding:12px;">還沒丟過紙條</div>'; return; }
        var SC={pending:'#888',approved:'#1FC98A',rejected:'#FF4B2B'};
        var SL={pending:'審核中',approved:'已顯示',rejected:'未通過'};
        panel.innerHTML='';
        posts.forEach(function(p){
          var nd=document.createElement('div'); nd.className='note';
          nd.style.borderLeft='3px solid '+(SC[p.status]||'#aaa');
          nd.innerHTML='<span class="ntype '+p.type+'">'+esc(TREE_TYPEZH[p.type]||'某隻巴巴')+'</span>'
            +'<p>'+esc(p.body)+'</p>'
            +'<div class="nfoot"><span class="nt">'+treeTimeAgo(p.created_at)+'</span>'
            +'<span style="margin-left:8px;font-size:.82rem;color:'+(SC[p.status]||'#aaa')+';">'+SL[p.status]+'</span>'
            +(p.reject_reason?'<span style="display:block;font-size:.78rem;color:#888;margin-top:3px;">退件：'+esc(p.reject_reason)+'</span>':'')
            +'</div>';
          panel.appendChild(nd);
        });
      });
  }
  function loadTreeWall(){
    var wall=document.getElementById('noteWall'); if(!wall) return;
    if(!document.getElementById('myPostsBar')){
      var bar=document.createElement('div'); bar.id='myPostsBar';
      bar.style.cssText='text-align:right;margin-bottom:10px;';
      bar.innerHTML='<button class="btn" id="myPostsBtn" type="button" style="font-size:.85rem;padding:7px 14px;display:none;">我的紙條</button>';
      wall.parentNode.insertBefore(bar,wall);
      var panel=document.createElement('div'); panel.id='myPostsPanel'; panel.style.display='none';
      wall.parentNode.insertBefore(panel,wall);
      document.getElementById('myPostsBtn').addEventListener('click',loadMyPosts);
    }
    var auth=window.DopaAuth;
    var uid=(auth&&auth.user&&auth.user())?auth.user().id:null;
    var mpBtn=document.getElementById('myPostsBtn');
    if(mpBtn) mpBtn.style.display=uid?'':'none';
    if(!wall._reportBound){
      wall._reportBound=true;
      wall.addEventListener('click',function(e){
        var btn=e.target.closest('.note-report'); if(!btn) return;
        var a=window.DopaAuth; if(!a||!a.isIn()){ go('auth'); return; }
        var me=a.user().id, rid=btn.getAttribute('data-uid');
        if(me===rid) return;
        btn.disabled=true;
        window.DopaSupabase.from('reports').insert({
          reporter_id:me, reported_id:rid,
          reason:'inappropriate_post', evidence:{type:'lounge_post',body:btn.getAttribute('data-body')}
        }).then(function(r){
          if(r.error){ btn.disabled=false; return; }
          toast('已送出檢舉，感謝維護社群品質 ');
          btn.closest('.note').style.opacity='.4';
        });
      });
    }
    wall.innerHTML='<div class="note" style="opacity:.5;text-align:center;padding:24px;">載入中…</div>';
    var postsP=window.DopaSupabase.from('lounge_posts')
      .select('id,user_id,type,body,like_count,created_at').eq('status','approved')
      .order('created_at',{ascending:false}).limit(50);
    var likesP=uid
      ? window.DopaSupabase.from('lounge_post_likes').select('post_id').eq('user_id',uid)
      : Promise.resolve({data:[]});
    Promise.all([postsP,likesP]).then(function(rs){
      var posts=rs[0].data||[], liked={};
      (rs[1].data||[]).forEach(function(l){ liked[l.post_id]=1; });
      Likes.setMine(liked);
      wall.innerHTML='';
      if(!posts.length){
        wall.innerHTML='<div class="note" style="opacity:.6;text-align:center;padding:24px;">還沒有紙條，第一個來丟吧</div>';
        return;
      }
      posts.forEach(function(p){ wall.appendChild(renderNote(p)); });
    });
  }

  // ---- 樹洞投稿 ----
  (function(){
    var picked=null, TZ={m:'某隻顯示者',g:'某隻生產者',mg:'某隻顯生',p:'某隻投射者',r:'某隻反映者'};
    var pick=document.getElementById('treeType');
    if(pick) pick.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b||!pick.contains(b)) return;
      [].forEach.call(pick.querySelectorAll('button'),function(x){x.classList.remove('on');});
      b.classList.add('on'); picked=b.getAttribute('data-t');
    });
    var ta=document.getElementById('treeText'), cnt=document.getElementById('treeCount');
    if(ta) ta.addEventListener('input',function(){
      var n=ta.value.length; if(cnt){ cnt.textContent=n+' / 100'; cnt.style.color=(n>100?'#FF4B2B':''); }
    });
    function warn(msg,el){ el.textContent=msg; el.style.display='block'; el.style.background='#FF4B2B'; }
    var sub=document.getElementById('treeSubmit');
    if(sub) sub.addEventListener('click',function(){
      var msg=document.getElementById('treeMsg'); if(!msg) return;
      if(!picked){ warn('先選你是哪隻巴巴 ',msg); return; }
      var txt=(ta.value||'').trim();
      if(txt.length<5){ warn('多寫一點點，至少 5 個字 ',msg); return; }
      if(txt.length>100){ warn('紙條太長囉，100 字以內',msg); return; }
      var auth=window.DopaAuth;
      if(!auth||!auth.isIn()){ go('auth'); return; }
      sub.disabled=true; sub.textContent='丟中…';
      window.DopaSupabase.from('lounge_posts')
        .insert({user_id:auth.user().id, type:picked, body:txt})
        .then(function(res){
          sub.disabled=false; sub.textContent='丟進樹洞';
          if(res.error){ warn('出了點狀況，請再試一次 ',msg); return; }
          var wall=document.getElementById('noteWall');
          if(wall){
            var n=document.createElement('div'); n.className='note'; n.style.opacity='.6';
            n.setAttribute('data-nid','pending-'+Date.now()); n.setAttribute('data-likes','0');
            n.innerHTML='<span class="ntype '+picked+'">'+TZ[picked]+'</span><p>'+txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p><div class="nfoot"><span class="nt">你剛剛丟的・審核中</span></div>';
            wall.insertBefore(n, wall.firstChild);
          }
          msg.textContent='丟出去了～先審後顯，過審就會出現在牆上 '; msg.style.display='block'; msg.style.background='#1FC98A';
          ta.value=''; if(cnt) cnt.textContent='0 / 100';
          picked=null; if(pick) [].forEach.call(pick.querySelectorAll('button'),function(x){x.classList.remove('on');});
        });
    });
  })();

  // ---- 雲霄飛車：上車就配（隨機抽卡）----
  (function(){
    var TYPEZH={m:'某隻顯示者',g:'某隻生產者',mg:'某隻顯生',p:'某隻投射者',r:'某隻反映者'};
    var card=document.getElementById('drawCard'),
        back=document.getElementById('dcBack'), front=document.getElementById('dcFront'),
        btn=document.getElementById('drawBtn'), msg=document.getElementById('drawMsg'),
        reply=document.getElementById('dcReply');
    if(!btn) return;
    var rolling=false, spent=false, drawnProfile=null;
    var LSKEY='dopa_coaster_draw';
    function todayStr(){ var d=new Date(),m=d.getMonth()+1,dy=d.getDate(); return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dy<10?'0':'')+dy; }
    function getAlias(p){
      if(p.nick&&p.nick_status==='approved') return p.nick;
      return '某隻'+(TYPEZH[p.type]||'巴巴')+'・#'+p.display_code;
    }
    function show(p){
      var ty=document.getElementById('dcType');
      ty.textContent=TYPEZH[p.type]||'某隻巴巴'; ty.className='ntype '+p.type;
      document.getElementById('dcAlias').textContent='「'+getAlias(p)+'」';
      document.getElementById('dcIntro').textContent=p.intro||'';
      var tg=document.getElementById('dcTags'); tg.innerHTML='';
      (p.energy_tags||[]).forEach(function(t){ var s=document.createElement('span'); s.textContent='#'+t; tg.appendChild(s); });
      back.style.display='none'; front.style.display='block';
    }
    function lockToday(){ spent=true; btn.disabled=true; btn.classList.add('spent'); btn.textContent='今天的緣分抽過囉，明天再上車 '; }
    var REEL=[].slice.call(document.querySelectorAll('.mini .cap img,.deck-card .cap img')).map(function(i){return i.src;});
    function animate(profile){
      back.style.display='block'; front.style.display='none';
      card.classList.add('rolling');
      var rq=back.querySelector('.dc-q'), ticks=0, max=12, t=60;
      (function tick(){
        if(REEL.length) rq.innerHTML='<img src="'+REEL[ticks%REEL.length]+'" alt="">'; ticks++;
        if(ticks<max){ t*=1.12; setTimeout(tick,t); }
        else{
          card.classList.remove('rolling');
          if(REEL.length) rq.innerHTML='<img src="'+REEL[0]+'" alt="">';
          show(profile); rolling=false;
          try{ localStorage.setItem(LSKEY,JSON.stringify({date:todayStr(),user_id:profile.user_id})); }catch(e){}
          var _uid=(window.DopaAuth&&window.DopaAuth.user&&window.DopaAuth.user())?window.DopaAuth.user().id:null;
          if(_uid) window.DopaSupabase.from('daily_coaster').upsert({user_id:_uid,draw_date:todayStr(),drawn_user_id:profile.user_id},{onConflict:'user_id'}).then(function(){});
          lockToday();
        }
      })();
    }
    function roll(){
      if(rolling||spent) return; rolling=true;
      if(msg) msg.style.display='none';
      btn.textContent='上車中… ';
      var auth=window.DopaAuth;
      var uid=(auth&&auth.user&&auth.user())?auth.user().id:null;
      var q=window.DopaSupabase.from('approved_profiles')
        .select('user_id,type,nick,nick_status,display_code,intro,energy_tags').limit(50);
      if(uid) q=q.neq('user_id',uid);
      q.then(function(res){
        var profiles=res.data||[];
        if(!profiles.length){
          rolling=false; btn.disabled=false; btn.textContent='上車 ';
          if(msg){ msg.textContent='目前還沒有其他人——快來邀朋友一起玩吧'; msg.style.display='block'; msg.style.background='#888'; msg.style.color='#fff'; }
          return;
        }
        drawnProfile=profiles[Math.floor(Math.random()*profiles.length)];
        animate(drawnProfile);
      });
    }
    btn.addEventListener('click',roll);
    if(reply) reply.addEventListener('click',function(){
      if(!msg||!drawnProfile) return;
      var auth=window.DopaAuth;
      if(!auth||!auth.isIn()){ go('auth'); return; }
      reply.disabled=true; reply.textContent='送出中…';
      window.DopaSupabase.from('invites')
        .insert({from_user_id:auth.user().id, to_user_id:drawnProfile.user_id})
        .then(function(res){
          var isDup=res.status===409||res.error&&(res.error.code==='23505'||(res.error.message||'').indexOf('duplicate')!==-1);
          if(isDup){
            msg.textContent='這位你已經敲過囉 去「信箱」看看對方回了沒。';
          } else if(res.error){
            reply.disabled=false; reply.textContent='想回應 ';
            msg.textContent='出了點狀況，請再試一次'; msg.style.display='block'; return;
          } else {
            msg.textContent=' 邀請送出了！對方也說好才會開對話——去「 信箱」看進度。';
            if(window.DopaDM&&window.DopaDM.invite) window.DopaDM.invite({id:drawnProfile.user_id,alias:getAlias(drawnProfile),t:drawnProfile.type,intro:drawnProfile.intro});
          }
          msg.style.display='block'; msg.style.background='#FFC01E'; msg.style.color='#231a10';
          reply.textContent='已送出 ・等對方也說好'; reply.classList.add('spent');
        });
    });
    // 初始化：DB 優先（防刷），找不到再 fallback 到 localStorage
    (function initDaily(){
      function showFromId(id){
        window.DopaSupabase.from('approved_profiles')
          .select('user_id,type,nick,nick_status,display_code,intro,energy_tags')
          .eq('user_id',id).maybeSingle()
          .then(function(r){ if(r.data){ drawnProfile=r.data; show(r.data); lockToday(); } });
      }
      var auth=window.DopaAuth,uid=(auth&&auth.user&&auth.user())?auth.user().id:null;
      if(uid){
        window.DopaSupabase.from('daily_coaster').select('drawn_user_id,draw_date').eq('user_id',uid).maybeSingle()
          .then(function(res){
            if(res.data&&res.data.draw_date===todayStr()&&res.data.drawn_user_id){
              try{ localStorage.setItem(LSKEY,JSON.stringify({date:todayStr(),user_id:res.data.drawn_user_id})); }catch(e){}
              showFromId(res.data.drawn_user_id);
            } else {
              var saved=null; try{ saved=JSON.parse(localStorage.getItem(LSKEY)||'null'); }catch(e){}
              if(saved&&saved.date===todayStr()&&saved.user_id) showFromId(saved.user_id);
            }
          });
      } else {
        var saved=null; try{ saved=JSON.parse(localStorage.getItem(LSKEY)||'null'); }catch(e){}
        if(saved&&saved.date===todayStr()&&saved.user_id) showFromId(saved.user_id);
      }
    })();
  })();

  // ---- 摩天輪：依你的型瀏覽配對牆 ----
  (function(){
    var CARDS=[];
    var TYPEZH={m:'顯示者',g:'生產者',mg:'顯生',p:'投射者',r:'反映者'};
    var TIP5={
      m:{
        m:{c:'同是發起者，不用解釋說動就動',x:'都想主導，容易各走各的',t:'出發前說一聲，彼此就不撞車'},
        g:{c:'你點火，他能一路燒旺把事做到底',x:'你衝太快，他沒時間反應就被拉著跑',t:'等一下他的嗯哼，你的主意才能落地'},
        mg:{c:'都能發起、節奏接近，一起跑不嫌快',x:'說動就動互不告知，容易各自往不同方向衝',t:'先說一句「我要去做 X」，合力比各自快'},
        p:{c:'他能看穿你行動的盲點，關鍵時刻給最準的洞見',x:'你衝太快，他的建議沒展示平台',t:'邀請他的看法，你會少走很多彎路'},
        r:{c:'他能如實映出你的影響力，讓你看見自己看不到的面向',x:'你的閉合能量場讓他難以讀取，感覺遙遠',t:'多告知一些背景，讓他安心'}
      },
      g:{
        m:{c:'他的發起給你找到反應點，一個點火一個燒旺',x:'他沒說一聲就衝，你跟著走沒有反應，容易累積挫敗',t:'等他先告知，你再給出薦骨的嗯哼'},
        g:{c:'兩個引擎遇到同樣有感的事，能量加乘',x:'都在等對方先起頭，容易沒人動',t:'找你們都有反應的事，讓事來找你們'},
        mg:{c:'同是薦骨引擎，他的多線嘗試幫你發現有反應的方向',x:'他節奏更快跳著做，你想做完整再走，速度落差大',t:'不用跟他一樣快，找到自己的嗯哼點就好'},
        p:{c:'他能看出你的薦骨往哪用最對，引導方向',x:'他想給洞見但沒被邀請，被當成批評；他等到苦澀',t:'問一句「你覺得呢」，他看得比你更清楚'},
        r:{c:'你穩定的薦骨能量給他安全感，他如實反映你的狀態',x:'他需要月週期做決定，你的當下反應讓他跟不上',t:'給他多一點時間，你的能量場是他最想待的地方'}
      },
      mg:{
        m:{c:'一起能發起多條線，互相激發新方向',x:'兩個說動就動、互不告知，容易碰撞',t:'衝出去前互報一句，兩個引擎才能並行'},
        g:{c:'你的多線嘗試激發他的反應，幫他發現還沒想到的方向',x:'你跳步驟的節奏讓他覺得「怎麼跳過了」，跟不上',t:'你快沒關係，偶爾確認他也有在動'},
        mg:{c:'能量對頻、節奏接近，多線並進彼此都能理解',x:'兩個都跳、都改，容易把事做一半各自跑掉',t:'定期確認你們在做的還是不是同一件事'},
        p:{c:'他能整合你分散的多線，給出哪條最值得深挖的洞見',x:'你衝太快沒等邀請，他的洞見被略過',t:'偶爾停下來問「你看到什麼我沒看到的」'},
        r:{c:'他能如實映出你哪條線最有活力，幫你篩',x:'你的節奏讓他一直在適應，難以沉澱',t:'在他旁邊慢下來一點，你的能量他感受得到'}
      },
      p:{
        m:{c:'你能看穿他行動的盲點，提前給出最精準的洞見',x:'他早衝走了，你的建議沒有展示平台',t:'等他問你，那一刻說的話他聽得進去'},
        g:{c:'你能引導他的薦骨往最有效率的地方用，是最自然的配合',x:'他沒主動邀請，你的意見被當批評；你等到苦澀',t:'讓他問你，被邀請後你說的話重量完全不同'},
        mg:{c:'你的系統洞見剛好補他跳步驟留下的漏洞',x:'他節奏太快，你找不到被邀請的時間點',t:'找他停下來的時候切入，那才是他真的能聽見你的時刻'},
        p:{c:'彼此都懂被看見的渴望，能真正給對方被邀請、被聽見的空間',x:'兩個都等對方先邀請，可能就互相乾等',t:'主動問「你看到什麼」，你們就能互相打開'},
        r:{c:'你善於引導，他善於映照，兩者能讓彼此更清楚看見自己',x:'都需要等待和空間，在不對的環境容易一起沉默',t:'把對的環境放在中間，你們都會發光'}
      },
      r:{
        m:{c:'你能如實映出他影響力的真實效應，讓他看見自己看不到的面向',x:'他的閉合能量場讓你難以進入，覺得無法連結',t:'告訴他你需要多一點背景，他才能被你映到'},
        g:{c:'他穩定的薦骨是你最好的環境之一，在他旁邊容易有安全感',x:'他的即時反應和你的月週期對不上，你容易感到壓力',t:'讓他知道你需要時間沉澱，他通常願意等'},
        mg:{c:'他多元嘗試的能量讓你能映出更多不同面向，很豐富',x:'他的高速讓你一直在適應，難以找到穩定的中心',t:'欣賞他的熱鬧就好，找固定的場域讓自己沉澱'},
        p:{c:'他能看見你的環境需求，引導你找到對的地方和對的人',x:'兩種類型都需要特定條件才能發光，不對的環境容易雙雙失真',t:'優先找對的地方待，你們各自都會浮現'},
        r:{c:'彼此都懂鏡子需要好的環境，不互相施壓，空間感最大',x:'兩個鏡子對映，若環境不好可能把彼此的失真放大',t:'一起選好的地方，你們映出的就是彼此最好的樣子'}
      }
    };
    var pick=document.getElementById('ferrisType'), result=document.getElementById('ferrisResult'),
        wall=document.getElementById('pairWall'), moreBtn=document.getElementById('ferrisMore'),
        mineK=document.getElementById('ferrisMineKicker'), wallTitle=document.getElementById('ferrisWallTitle');
    if(!pick) return;
    var LSKEY='dopa_ferris_day';
    function todayStr(){ var d=new Date(),m=d.getMonth()+1,dy=d.getDate(); return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dy<10?'0':'')+dy; }
    var dayDone=false;
    try{ var s0=JSON.parse(localStorage.getItem(LSKEY)||'null'); if(s0&&s0.date===todayStr()&&s0.unlocked) dayDone=true; }catch(e){}
    function getAlias(p){
      if(p.nick && p.nick_status==='approved') return p.nick;
      return '某隻'+(TYPEZH[p.type]||'巴巴')+'・#'+p.display_code;
    }
    function makeCard(p){
      var activeBtn=pick&&pick.querySelector('button.on');
      var vt=activeBtn?activeBtn.getAttribute('data-t'):((typeof U!=='undefined'&&U&&U.type)||'g');
      var td=(TIP5[vt]||{})[p.type];
      var tipHtml=td
        ?'<div class="pc-tip"><span class="pc-tip-h">跟這型相處</span>'
          +'<div class="pt-row"><span class="pt-c">互補</span>'+esc(td.c)+'</div>'
          +'<div class="pt-row"><span class="pt-x">卡點</span>'+esc(td.x)+'</div>'
          +'<div class="pt-row"><span class="pt-t">提醒</span>'+esc(td.t)+'</div></div>'
        :'';
      var c=document.createElement('div'); c.className='pair-card';
      c.innerHTML='<span class="ntype '+p.type+'">某隻'+(TYPEZH[p.type]||'巴巴')+'</span>'
        +'<div class="pc-alias">「'+esc(getAlias(p))+'」</div>'
        +'<p class="pc-intro">'+esc(p.intro)+'</p>'
        +(p.energy_tags&&p.energy_tags.length?'<div class="pv-tags">'+p.energy_tags.map(function(t){return '<span>'+esc(t)+'</span>';}).join('')+'</div>':'')
        +tipHtml;
      var b=document.createElement('button'); b.className='btn pc-hi'; b.type='button'; b.textContent='想認識 ';
      b.addEventListener('click',function(){
        var auth=window.DopaAuth;
        if(!auth||!auth.isIn()){ go('auth'); return; }
        b.disabled=true; b.textContent='送出中…';
        window.DopaSupabase.from('invites')
          .insert({from_user_id:auth.user().id, to_user_id:p.user_id})
          .then(function(res){
            var isDup=res.status===409||res.error&&(res.error.code==='23505'||(res.error.message||'').indexOf('duplicate')!==-1);
            if(isDup){
              b.textContent='已送出 ・等對方也說好'; b.classList.add('spent');
            } else if(res.error){
              b.disabled=false; b.textContent='想認識 '; toast('出了點狀況，請再試一次');
            } else {
              b.textContent='已送出 ・等對方也說好'; b.classList.add('spent');
              toast(' 邀請送出了・對方回應才會開對話，去「 信箱」看進度');
              if(window.DopaDM&&window.DopaDM.invite) window.DopaDM.invite({id:p.user_id,alias:getAlias(p),t:p.type,intro:p.intro});
            }
          });
      });
      c.appendChild(b); return c;
    }
    function paint(count){
      wall.innerHTML='';
      if(!CARDS.length){
        wall.innerHTML='<div style="padding:24px;opacity:.6;text-align:center;">目前還沒有其他人的自介——快來邀朋友一起玩吧</div>';
        if(wallTitle) wallTitle.textContent=''; if(moreBtn) moreBtn.style.display='none'; return;
      }
      if(moreBtn) moreBtn.style.display='';
      var total=Math.min(count,CARDS.length);
      CARDS.slice(0,total).forEach(function(p){ wall.appendChild(makeCard(p)); });
      if(wallTitle) wallTitle.textContent='為你轉到的巴巴（'+total+'／'+CARDS.length+' 位）';
      if(moreBtn){
        if(total>=CARDS.length){ moreBtn.textContent='今天 '+CARDS.length+' 位轉完了・明天再轉新的 '; moreBtn.disabled=true; moreBtn.classList.add('spent'); }
        else{ moreBtn.textContent='再轉一批 （＋'+(CARDS.length-total)+' 位）'; moreBtn.disabled=false; moreBtn.classList.remove('spent'); }
      }
    }
    function render(myType){
      if(mineK) mineK.textContent='你是・'+(TYPEZH[myType]||myType);
      paint(dayDone?CARDS.length:5);
      result.style.display='block';
      result.scrollIntoView({block:'start',behavior:'smooth'});
    }
    function seededShuffle(arr,seed){
      var a=arr.slice();
      for(var i=a.length-1;i>0;i--){
        seed=((seed*1664525)+1013904223)&0xffffffff;
        var j=Math.abs(seed)%(i+1);
        var tmp=a[i];a[i]=a[j];a[j]=tmp;
      }
      return a;
    }
    function daySeed(){ var d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }
    function loadAndRender(myType){
      if(wall){ wall.innerHTML='<div style="padding:24px;opacity:.5;text-align:center;">轉中…</div>'; }
      if(result){ result.style.display='block'; result.scrollIntoView({block:'start',behavior:'smooth'}); }
      var auth=window.DopaAuth;
      var uid=(auth&&auth.user&&auth.user())?auth.user().id:null;
      var q=window.DopaSupabase.from('approved_profiles')
        .select('user_id,type,nick,nick_status,display_code,intro,energy_tags').limit(50);
      if(uid) q=q.neq('user_id',uid);
      q.then(function(res){
        if(res.error){ if(wall) wall.innerHTML='<div style="padding:24px;opacity:.6;text-align:center;">載入失敗，請重試</div>'; return; }
        CARDS=seededShuffle(res.data||[],daySeed()).slice(0,10);
        render(myType);
      });
    }
    if(moreBtn) moreBtn.addEventListener('click',function(){
      if(dayDone||moreBtn.disabled) return;
      paint(CARDS.length); dayDone=true;
      try{ localStorage.setItem(LSKEY, JSON.stringify({date:todayStr(), unlocked:true})); }catch(e){}
    });
    [].slice.call(pick.querySelectorAll('button')).forEach(function(b){
      b.addEventListener('click',function(){
        [].slice.call(pick.querySelectorAll('button')).forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on'); loadAndRender(b.getAttribute('data-t'));
      });
    });
    window.DopaFerris={
      refresh:function(){
        var auth=window.DopaAuth; if(!auth||!auth.isIn()) return;
        var u=auth.user(); if(!u||!u.type) return;
        var btns=[].slice.call(pick.querySelectorAll('button'));
        btns.forEach(function(x){ x.classList.remove('on'); });
        var btn=btns.filter(function(b){ return b.getAttribute('data-t')===u.type; })[0];
        if(btn) btn.classList.add('on');
        loadAndRender(u.type);
      }
    };
  })();

  // ---- 旋轉咖啡杯：真人老師市集 ＋ 老師個人頁 ＋ 預約表單 ----
  // 老師的「專長」寫的是服務類別與風格，不碰命理斷言；方案描述也只講交付內容，不承諾結果。
  var AVA='M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.4-8 5.3V21h16v-1.7c0-2.9-3.6-5.3-8-5.3z';
  var STAR='<svg class="star-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
  var TEACHERS=[
    {id:'t1', name:'星子老師', tags:['人類圖','溫柔陪伴'], rate:'4.9', cnt:128, sla:'5 個工作天',
     bio:'陪你把「非自己」的地方一個個看懂——走對路，比走快路重要。',
     about:['做人類圖解讀第 6 年，接過 800 多份個人解讀。我的風格是慢，會先把你的類型、策略、內在權威講到你真的懂，再回到你問的那件事。',
            '我不會告訴你「你應該怎麼做」，那是你的決定。我能做的是讓你看清楚，你天生是怎麼運作的，然後你自己會知道哪條路比較不費力。'],
     plans:[
       {id:'p1', name:'基礎解讀', desc:'類型、策略、內在權威、定義，配你問的那一題', price:680, unit:'45 分錄音'},
       {id:'p2', name:'完整解讀', desc:'基礎全含，加上通道、閘門與人生角色的逐段拆解', price:1180, unit:'75 分錄音'}
     ],
     reviews:[
       {who:'某隻投射者', s:5, when:'2 週前', text:'講到「等邀請不是被動而是節能」那段我直接哭出來。錄音聽了三遍。'},
       {who:'某隻生產者', s:5, when:'1 個月前', text:'我問的是工作，老師從薦骨回應講起，才發現我一直在做「別人問我我才做」的事。'},
       {who:'某隻反映者', s:4, when:'2 個月前', text:'很溫柔，資訊量大，需要慢慢消化。希望可以再多一點具體例子。'}
     ]},
    {id:'t2', name:'Luna', tags:['占星','犀利直球'], rate:'4.8', cnt:96, sla:'7 個工作天',
     bio:'不繞圈子。你的盤說了什麼、你在逃什麼，我直接講給你聽。',
     about:['占星執業 9 年，本命盤與行運為主。我講話比較直，如果你想聽的是安慰，我可能不是最適合的那個人。',
            '我會用你的三巨頭、宮位與相位，對著你問的處境講——包括你可能不想聽但需要聽的部分。'],
     plans:[
       {id:'p1', name:'本命盤解讀', desc:'三巨頭、宮位重點、主要相位，聚焦你問的主題', price:880, unit:'60 分錄音'},
       {id:'p2', name:'本命＋今年行運', desc:'本命全含，加上未來 12 個月的行運節奏與提醒', price:1480, unit:'90 分錄音'}
     ],
     reviews:[
       {who:'某隻顯示者', s:5, when:'3 週前', text:'真的很直，但每句都打在點上。花錢就是要聽這個。'},
       {who:'某隻顯生', s:5, when:'1 個月前', text:'把我這幾年一直重複的模式講出來了，聽完當場請假去想。'},
       {who:'某隻生產者', s:4, when:'2 個月前', text:'內容很好，語速有點快，我開 0.75 倍速聽。'}
     ]},
    {id:'t3', name:'木木老師', tags:['人類圖×占星','邏輯拆解'], rate:'5.0', cnt:64, sla:'7 個工作天',
     bio:'把兩套系統疊起來對照，用你聽得懂的邏輯拆解人生卡點。',
     about:['工程師轉行，所以我解讀的方式偏結構化：先講系統怎麼運作，再講你的參數長怎樣，最後才對到你的問題。',
            '兩套系統會互相印證，也會互相矛盾——矛盾的地方通常最有意思，我會特別留時間講。'],
     plans:[
       {id:'p1', name:'雙系統對照', desc:'人類圖與星盤各講一輪，再對照出共同訊號', price:1080, unit:'60 分錄音'},
       {id:'p2', name:'雙系統＋逐字稿', desc:'錄音全含，附一份重點整理文字檔方便回頭查', price:1480, unit:'60 分錄音＋文字'}
     ],
     reviews:[
       {who:'某隻投射者', s:5, when:'1 週前', text:'邏輯超清楚，我這種要先懂原理才安心的人非常適合。'},
       {who:'某隻顯生', s:5, when:'3 週前', text:'逐字稿加購超值，我把重點貼在筆電上每天看。'}
     ]},
    {id:'t4', name:'阿凱老師', tags:['關係合盤','暖心分析'], rate:'4.9', cnt:151, sla:'5 個工作天',
     bio:'你們的通道怎麼牽、容易在哪卡——合盤看的是電磁，不是星座配對。',
     about:['專做關係解讀。合盤看的是兩張圖之間的通道與電磁橋接，不是「什麼座配什麼座」那種對照表。',
            '解讀會同時講兩個人——你們各自的運作方式、湊在一起會產生什麼、以及卡住時通常是卡在哪個環節。'],
     plans:[
       {id:'p1', name:'單人關係模式', desc:'只看你自己：你在關係裡怎麼運作、容易卡在哪', price:780, unit:'50 分錄音'},
       {id:'p2', name:'雙人合盤', desc:'兩張圖的通道與電磁橋接對照（需提供兩人出生資料）', price:1580, unit:'80 分錄音'}
     ],
     reviews:[
       {who:'某隻生產者', s:5, when:'2 週前', text:'合盤那段講到我們兩個為什麼一吵架就冷戰，超準。'},
       {who:'某隻反映者', s:5, when:'1 個月前', text:'老師很暖，講到不合的地方也不會讓人覺得被判死刑。'},
       {who:'某隻顯示者', s:4, when:'2 個月前', text:'很有幫助。希望雙人合盤可以再長一點。'}
     ]}
  ];
  function teacherById(id){ for(var i=0;i<TEACHERS.length;i++) if(TEACHERS[i].id===id) return TEACHERS[i]; return null; }
  function stars(n){ var s=''; for(var i=0;i<5;i++) s+=(i<n?'★':'☆'); return s; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // 市集列表：卡片本體 → 老師個人頁；預約鈕 → 直接進預約表單
  function renderTeacherList(){
    var list=document.getElementById('teacherList');
    if(!list) return;
    list.innerHTML='';
    if(!TEACHERS.length){
      list.innerHTML='<div style="text-align:center;padding:40px 20px;opacity:.6;grid-column:1/-1;">老師市集即將開放，敬請期待</div>';
      return;
    }
    TEACHERS.forEach(function(t){
      var lo=t.plans[0]; if(!lo) return;
      var c=document.createElement('div'); c.className='teacher-card';
      c.innerHTML='<div class="tc-head"><div class="tc-ava"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+AVA+'"/></svg></div><div><div class="tc-name">'+esc(t.name)+'</div><div class="tc-rate">'+STAR+t.rate+' <span>('+t.cnt+')</span></div></div></div>'
        +'<div class="tc-tags">'+t.tags.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>'
        +'<p class="tc-bio">'+esc(t.bio)+'</p>'
        +'<div class="tc-foot"><div class="tc-price">NT$'+lo.price+' 起 <span>/ '+esc(lo.unit)+'</span></div></div>';
      ['.tc-head','.tc-bio','.tc-tags'].forEach(function(sel){
        var el=c.querySelector(sel); if(!el) return;
        el.style.cursor='pointer';
        el.addEventListener('click',function(){ openTeacher(t.id); });
      });
      var b=document.createElement('button'); b.className='btn green tc-book'; b.type='button'; b.textContent='預約';
      b.addEventListener('click',function(){ openBooking(t.id, lo.id); });
      c.querySelector('.tc-foot').appendChild(b);
      list.appendChild(c);
    });
  }
  renderTeacherList();
  (function(){
    var join=document.getElementById('teacherJoin');
    if(join) join.addEventListener('click',function(){
      var auth=window.DopaAuth;
      if(!auth||!auth.isIn()){ go('auth'); return; }
      var existing=document.getElementById('teacherJoinModal');
      if(existing){ existing.style.display='flex'; return; }
      var modal=document.createElement('div'); modal.id='teacherJoinModal';
      modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
      modal.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;">'
        +'<h3 style="margin:0 0 12px;">申請成為老師</h3>'
        +'<p style="font-size:.88rem;opacity:.7;margin-bottom:16px;">填完後我們會在 3 個工作天內回信確認；現階段每週僅開放少量名額。</p>'
        +'<label style="display:block;margin-bottom:10px;font-size:.9rem;">姓名／稱呼<input id="tjName" type="text" placeholder="老師介紹頁顯示的名字" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:.95rem;box-sizing:border-box;"></label>'
        +'<label style="display:block;margin-bottom:10px;font-size:.9rem;">聯絡方式（Email 或 LINE ID）<input id="tjContact" type="text" placeholder="方便我們聯繫你" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:.95rem;box-sizing:border-box;"></label>'
        +'<label style="display:block;margin-bottom:10px;font-size:.9rem;">專長標籤（用逗號隔開）<input id="tjSpecialty" type="text" placeholder="人類圖, 情感支持, 職涯引導…" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:.95rem;box-sizing:border-box;"></label>'
        +'<label style="display:block;margin-bottom:16px;font-size:.9rem;">簡短自介（100 字以內）<textarea id="tjBio" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #ddd;border-radius:8px;font-size:.95rem;resize:vertical;min-height:70px;box-sizing:border-box;" placeholder="你的背景、服務風格、最想幫助什麼樣的人"></textarea></label>'
        +'<div id="tjMsg" style="display:none;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.88rem;"></div>'
        +'<div style="display:flex;gap:10px;">'
        +'<button id="tjSubmit" class="btn green" type="button" style="flex:1;">送出申請</button>'
        +'<button id="tjClose" class="btn" type="button">取消</button>'
        +'</div></div>';
      document.body.appendChild(modal);
      document.getElementById('tjClose').addEventListener('click',function(){ modal.remove(); });
      modal.addEventListener('click',function(e){ if(e.target===modal) modal.remove(); });
      document.getElementById('tjSubmit').addEventListener('click',function(){
        var name=(document.getElementById('tjName').value||'').trim();
        var contact=(document.getElementById('tjContact').value||'').trim();
        var specialty=(document.getElementById('tjSpecialty').value||'').trim();
        var bio=(document.getElementById('tjBio').value||'').trim();
        var msg=document.getElementById('tjMsg');
        if(!name||!contact){
          msg.textContent='請填寫姓名和聯絡方式'; msg.style.cssText='display:block;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.88rem;background:#FF4B2B;color:#fff;'; return;
        }
        var btn=document.getElementById('tjSubmit'); btn.disabled=true; btn.textContent='送出中…';
        window.DopaSupabase.from('teacher_applications').insert({
          user_id:auth.user().id, name:name, contact:contact, specialty:specialty, bio:bio
        }).then(function(r){
          if(r.error&&(r.error.code==='23505'||r.status===409)){
            msg.textContent='你已經送出過申請了，我們會盡快聯繫你！'; msg.style.cssText='display:block;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.88rem;background:#FFC01E;color:#231a10;';
            btn.disabled=false; btn.textContent='送出申請'; return;
          }
          if(r.error){
            msg.textContent='出了點狀況，請再試一次'; msg.style.cssText='display:block;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.88rem;background:#FF4B2B;color:#fff;';
            btn.disabled=false; btn.textContent='送出申請'; return;
          }
          msg.textContent='申請已收到！3 個工作天內會收到回信  感謝你！'; msg.style.cssText='display:block;padding:10px;border-radius:8px;margin-bottom:12px;font-size:.88rem;background:#1FC98A;color:#fff;';
          btn.textContent='已送出';
          setTimeout(function(){ modal.remove(); },3000);
        });
      });
    });
  })();

  // 從 Supabase 載入真實老師資料（有資料時取代靜態假資料）
  (function(){
    if(!window.DopaSupabase) return;
    window.DopaSupabase.from('teachers')
      .select('id,display_name,tags,bio,about,plans,sla,rating,review_count,price_from')
      .eq('is_active',true).order('created_at')
      .then(function(res){
        if(res.error||!res.data||!res.data.length) return;
        TEACHERS=res.data.map(function(t){
          var plans=(t.plans||[]).map(function(p,i){
            return {id:p.id||('p'+(i+1)),name:p.name||'方案',desc:p.desc||p.description||'',price:p.price||0,unit:p.unit||''};
          });
          if(!plans.length) plans=[{id:'p1',name:'基礎解讀',desc:'依你的問題給一份錄音解讀',price:t.price_from||500,unit:'錄音'}];
          return {id:t.id,name:t.display_name||'老師',tags:t.tags||[],
            rate:String(parseFloat(t.rating||5).toFixed(1)),cnt:t.review_count||0,
            sla:t.sla||'7 個工作天',bio:t.bio||'',
            about:Array.isArray(t.about)?t.about:(t.about?[t.about]:[]),
            plans:plans,reviews:[]};
        });
        renderTeacherList();
      });
  })();
  // ---- 老師個人頁 ----
  var tproPlan=null, tproId=null;
  function openTeacher(id){
    var t=teacherById(id); if(!t) return;
    tproId=id; tproPlan=t.plans[0].id;
    var box=document.getElementById('tproBody'); if(!box) return;
    box.innerHTML=
      '<div class="tpro-head">'
        +'<div class="tpro-ava"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+AVA+'"/></svg></div>'
        +'<div class="tpro-meta"><h2>'+t.name+'</h2>'
          +'<div class="tc-rate" style="font-size:.9rem;">'+STAR+t.rate+' <span>('+t.cnt+' 則評價)</span></div>'
          +'<div class="tc-tags" style="margin-top:9px;">'+t.tags.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div>'
          +'<p style="font-weight:700;font-size:.92rem;line-height:1.65;margin:12px 0 0;">'+t.bio+'</p>'
        +'</div></div>'
      +'<div class="tpro-sec"><h3>關於我</h3>'+t.about.map(function(p){return '<p>'+p+'</p>';}).join('')+'</div>'
      +'<div class="tpro-sec"><h3>解讀方案</h3><div id="tproPlans"></div>'
        +'<button class="btn green big" id="tproBook" type="button" style="width:100%;margin-top:16px;">預約這位老師 →</button></div>'
      +'<div class="tpro-sec"><h3>學員評價（'+t.cnt+'）</h3>'
        +t.reviews.map(function(r){
          return '<div class="rv"><div class="rv-h"><span class="s">'+stars(r.s)+'</span><span>'+r.who+'</span><span class="w">・'+r.when+'</span></div><p>'+r.text+'</p></div>';
        }).join('')
        +'<p class="disclaimer" style="color:var(--ink);opacity:.6;margin-top:14px;">＊示範版：評價為範例內容。正式版只有實際購買並完成交付的人能留評價。</p></div>';
    paintPlans(document.getElementById('tproPlans'), t, function(pid){ tproPlan=pid; });
    var bk=document.getElementById('tproBook');
    if(bk) bk.addEventListener('click',function(){ openBooking(tproId, tproPlan); });
    go('teacher');
  }
  // 方案選擇器（老師個人頁與預約表單共用）
  function paintPlans(host, t, onPick){
    if(!host) return;
    host.innerHTML='';
    t.plans.forEach(function(p,i){
      var l=document.createElement('label'); l.className='plan'+(i===0?' on':'');
      l.innerHTML='<input type="radio" name="plan_'+t.id+'_'+(host.id||'x')+'" value="'+p.id+'"'+(i===0?' checked':'')+'>'
        +'<span class="pl-t"><span class="pl-b">'+p.name+'</span><span class="pl-d">'+p.desc+'<br>交付：'+p.unit+'</span></span>'
        +'<span class="pl-p">NT$'+p.price+'</span>';
      l.addEventListener('click',function(){
        [].forEach.call(host.querySelectorAll('.plan'),function(x){ x.classList.remove('on'); });
        l.classList.add('on');
        var r=l.querySelector('input'); if(r) r.checked=true;
        onPick(p.id);
      });
      host.appendChild(l);
    });
  }

  // ---- 預約表單 ----
  var bkTeacher=null, bkPlan=null;
  function birthInfo(){
    var d=(document.getElementById('fDate')||{}).value||'';
    var tm=(document.getElementById('fTime')||{}).value||'';
    var sel=document.getElementById('fPlace');
    var p=(sel && sel.selectedIndex>0)?sel.options[sel.selectedIndex].text:'';
    if(d&&tm&&p) return {date:d, time:tm, place:p};
    // 表單是空的（重新整理過）→ 回頭讀上次驗證存下來的那份
    try{
      var s=JSON.parse(localStorage.getItem('dopa_birth_v1')||'null');
      if(s && s.date && s.time && s.place) return {date:s.date, time:s.time, place:s.place};
    }catch(e){}
    return null;
  }
  // 重新整理後把驗證表單填回去，按「去修改」才不會是一片空白
  (function(){
    try{
      var s=JSON.parse(localStorage.getItem('dopa_birth_v1')||'null'); if(!s) return;
      var d=document.getElementById('fDate'), t=document.getElementById('fTime'),
          sel=document.getElementById('fPlace'), n=document.getElementById('fName');
      if(d&&s.date) d.value=s.date;
      if(t&&s.time) t.value=s.time;
      if(n&&s.name) n.value=s.name;
      if(sel&&s.place){ for(var i=0;i<sel.options.length;i++) if(sel.options[i].text===s.place){ sel.selectedIndex=i; break; } }
    }catch(e){}
  })();
  function openBooking(tid, pid){
    var t=teacherById(tid); if(!t) return;
    bkTeacher=tid; bkPlan=pid||t.plans[0].id;
    document.getElementById('bkTitle').textContent='預約 '+t.name;
    document.getElementById('bkSla').textContent='老師接單後 '+t.sla+'內交付';
    paintPlans(document.getElementById('bkPlans'), t, function(x){ bkPlan=x; });
    // 把預選方案標起來（從卡片直接按預約時可能不是第一個）
    var host=document.getElementById('bkPlans');
    [].forEach.call(host.querySelectorAll('.plan'),function(l){
      var r=l.querySelector('input'), on=(r&&r.value===bkPlan);
      l.classList.toggle('on',on); if(r) r.checked=on;
    });
    var b=birthInfo(), bb=document.getElementById('bkBirth');
    if(b){
      bb.innerHTML='<div class="acct-row"><div><div class="k">出生日期</div><div class="v">'+b.date+'</div></div></div>'
        +'<div class="acct-row"><div><div class="k">出生時間</div><div class="v">'+b.time+'</div></div></div>'
        +'<div class="acct-row"><div><div class="k">出生地</div><div class="v">'+b.place+'</div></div>'
        +'<button class="btn" data-go="verify" type="button">去修改</button></div>'
        +'<p class="hint" style="margin-top:10px;">老師會拿這份資料排你的圖。填錯的話類型可能整個不一樣，先確認一下。</p>';
      bb.querySelector('[data-go]').addEventListener('click',function(){ go('verify'); });
    }else{
      bb.innerHTML='<div class="ord-q"><b>還沒有出生資料</b>老師需要你的出生年月日、時間與地點才能排圖。先去巴巴驗證填一次，資料會自動帶過來。</div>'
        +'<button class="btn pink" id="bkGoVerify" type="button" style="width:100%;margin-top:12px;">去填出生資料 →</button>';
      bb.querySelector('#bkGoVerify').addEventListener('click',function(){ go('verify'); });
    }
    document.getElementById('bkErr').classList.remove('show');
    go('booking');
  }
  (function(){
    var q=document.getElementById('bkQ'), c=document.getElementById('bkQCount');
    if(q) q.addEventListener('input',function(){ if(c) c.textContent=q.value.length+' / 500'; });
    var go2=document.getElementById('bkGo');
    if(go2) go2.addEventListener('click',function(){
      var err=document.getElementById('bkErr');
      var t=teacherById(bkTeacher); if(!t) return;
      var txt=(q.value||'').trim();
      var b=birthInfo();
      function fail(m){ err.textContent=m; err.classList.add('show'); err.scrollIntoView({behavior:'smooth',block:'center'}); }
      if(txt.length<10){ fail('第 2 題再多寫一點——至少 10 個字，老師才知道要往哪裡錄。'); return; }
      if(!b){ fail('還缺出生資料。先去巴巴驗證填一次，回來資料就會自動帶進來。'); return; }
      err.classList.remove('show');
      var p=null; for(var i=0;i<t.plans.length;i++) if(t.plans[i].id===bkPlan) p=t.plans[i];
      if(!p) p=t.plans[0];
      Shop.checkout({
        kind:'teacher', teacher:t.id, teacherName:t.name, plan:p.id, planName:p.name,
        title:t.name+'・'+p.name, desc:p.desc+'（交付：'+p.unit+'）',
        amount:p.price, question:txt, birth:b, sla:t.sla
      });
    });
  })();

  // ---- 結帳 ／ 訂單 ／ 錄音交付（前端空殼）----
  // 金流未串：這裡只做「導轉前的確認頁」與「導轉回來的結果頁」，這兩頁不管最後用綠界還藍新都一樣。
  // TODO(後端)：coPay 要改成建立訂單 → 取得金流服務商的付款網址／取號結果 → 導轉；
  //             付款結果必須以服務商的「伺服器端回拋（背景通知）」為準，不能信前端導回的參數。
  var Shop=(function(){
    var LSKEY='dopa_orders_v1';
    var S=[]; try{ S=JSON.parse(localStorage.getItem(LSKEY)||'[]')||[]; }catch(e){ S=[]; }
    function save(){ try{ localStorage.setItem(LSKEY,JSON.stringify(S)); }catch(e){} }
    var pending=null, wavUri=null, tick=null;

    var PAYNM={card:'信用卡 / 金融卡', atm:'ATM 虛擬帳號', cvs:'超商代碼繳費'};
    function oid(){
      var d=new Date(), p=function(n){ return (n<10?'0':'')+n; };
      var s='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r='';
      for(var i=0;i<4;i++) r+=s.charAt(Math.floor(Math.random()*s.length));
      return 'DP'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+r;
    }
    function digits(n){ var r=''; for(var i=0;i<n;i++) r+=Math.floor(Math.random()*10); return r; }
    function fmtDate(ts){
      var d=new Date(ts), p=function(n){ return (n<10?'0':'')+n; };
      return d.getFullYear()+'/'+p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
    }
    // 訂單狀態：AI 是即時交付；老師單在示範版用「付款後經過多久」自動推進，
    // 好讓整條流程（接單→製作→交付）看得完。真版由老師端操作驅動。
    function statusOf(o){
      if(!o.paidAt) return 'unpaid';
      if(o.kind==='ai') return 'delivered';
      var el=(Date.now()-o.paidAt)/1000;
      if(el<8) return 'wait';
      if(el<22) return 'work';
      return 'delivered';
    }
    var CHIP={unpaid:['unpaid','待付款'], wait:['wait','待老師接單'], work:['work','製作中'], delivered:['done','已交付']};

    // ===== 結帳頁 =====
    function checkout(item){
      pending=item;
      var box=document.getElementById('coItems');
      box.innerHTML='<div class="co-item"><div><div class="nm">'+esc(item.title)+'</div><p class="ds">'+esc(item.desc)+'</p></div><div class="amt">NT$'+item.amount+'</div></div>';
      if(item.kind==='teacher'){
        box.innerHTML+='<div class="co-item"><div><div class="nm">你要問的問題</div><p class="ds">'+esc(item.question)+'</p></div></div>';
      }
      document.getElementById('coTotal').textContent='NT$'+item.amount;
      var chk=document.getElementById('coAgree'); if(chk) chk.checked=false;
      document.getElementById('coConsent').classList.remove('miss');
      document.getElementById('coErr').classList.remove('show');
      go('checkout');
    }
    (function(){
      var opts=document.getElementById('payOpts');
      if(opts) opts.addEventListener('click',function(e){
        var l=e.target.closest('.pay-opt'); if(!l) return;
        [].forEach.call(opts.querySelectorAll('.pay-opt'),function(x){ x.classList.remove('on'); });
        l.classList.add('on');
        var r=l.querySelector('input'); if(r) r.checked=true;
      });
      var pay=document.getElementById('coPay');
      if(pay) pay.addEventListener('click',function(){
        if(!pending) { go('home'); return; }
        var err=document.getElementById('coErr'), cs=document.getElementById('coConsent');
        // 沒勾＝不能送。這個勾選是「不適用七日鑑賞期」的法律前提，不是裝飾。
        if(!document.getElementById('coAgree').checked){
          err.textContent='要先勾選上面那一項才能付款——數位內容付完就交付，這是必要的確認。';
          err.classList.add('show');
          cs.classList.remove('miss'); void cs.offsetWidth; cs.classList.add('miss');
          cs.scrollIntoView({behavior:'smooth',block:'center'});
          return;
        }
        err.classList.remove('show'); cs.classList.remove('miss');
        var m=(document.querySelector('input[name="paym"]:checked')||{}).value||'card';
        var o={};
        for(var k in pending) if(Object.prototype.hasOwnProperty.call(pending,k)) o[k]=pending[k];
        o.id=oid(); o.pay=m; o.createdAt=Date.now(); o.paidAt=null; o.rating=0; o.review='';
        o.consent=true; o.consentAt=Date.now();   // 留存同意紀錄——爭議時要拿得出來
        if(m==='atm'){ o.bank='808 玉山銀行'; o.acct=digits(14); o.due=Date.now()+3*86400000; }
        if(m==='cvs'){ o.code=digits(12); o.due=Date.now()+3*86400000; }
        if(m==='card') o.paidAt=Date.now();
        S.unshift(o); save();
        showResult(o.id);
      });
    })();

    // ===== 付款結果頁 =====
    var ICO={
      ok:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.6-4-4 1.7-1.7 2.3 2.3 5.7-5.7 1.7 1.7z"/></svg>',
      wait:'<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.6l4 2.4-.9 1.5-5.1-3V7z"/></svg>'
    };
    function showResult(id){
      var o=byId(id); if(!o) return;
      var c=document.getElementById('prCard'), h='';
      if(o.paidAt){
        h='<div class="pr-ico ok">'+ICO.ok+'</div><h2>付款完成</h2>';
        h+= o.kind==='ai'
          ? '<p class="sub">你的完整解讀已經解鎖了。<br>訂單編號 '+o.id+'</p><button class="btn green big" id="prGo" type="button" style="width:100%;">看我的完整解讀 →</button>'
          : '<p class="sub">已通知 '+esc(o.teacherName)+'，老師接單後 '+esc(o.sla||'5 個工作天')+'內交付錄音。<br>訂單編號 '+o.id+'</p><button class="btn green big" id="prGo" type="button" style="width:100%;">去看訂單狀態 →</button>';
      }else{
        h='<div class="pr-ico wait">'+ICO.wait+'</div><h2>取號完成，等你繳費</h2>'
          +'<p class="sub">這是<b>非即時付款</b>——完成繳費、系統確認入帳後才會交付。</p>'
          +'<div class="pay-deadline">繳費期限：'+fmtDate(o.due)+'（逾期訂單自動取消）</div>'
          +'<div class="pay-code">';
        if(o.pay==='atm'){
          h+='<div class="r"><span class="k">銀行</span><span class="v">'+o.bank+'</span></div>'
            +'<div class="r"><span class="k">虛擬帳號</span><span class="v" id="prCopyV">'+o.acct+'</span><button class="copy-btn" id="prCopy" type="button">複製</button></div>';
        }else{
          h+='<div class="r"><span class="k">繳費代碼</span><span class="v" id="prCopyV">'+o.code+'</span><button class="copy-btn" id="prCopy" type="button">複製</button></div>'
            +'<div class="r"><span class="k">繳費地點</span><span class="v" style="font-size:.92rem;">7-11／全家／萊爾富／OK</span></div>';
        }
        h+='<div class="r"><span class="k">金額</span><span class="v">NT$'+o.amount+'</span></div>'
          +'<div class="r"><span class="k">訂單編號</span><span class="v" style="font-size:.95rem;">'+o.id+'</span></div></div>'
          +'<button class="btn green big" id="prPaid" type="button" style="width:100%;">（示範）我已完成繳費 →</button>'
          +'<button class="btn" id="prGo" type="button" style="width:100%;margin-top:12px;font-size:1rem;">先去看訂單</button>';
      }
      c.innerHTML=h;
      var g=document.getElementById('prGo');
      if(g) g.addEventListener('click',function(){
        if(o.paidAt && o.kind==='ai'){ unlockReport(); go('unlock'); }
        else go('orders');
      });
      var cp=document.getElementById('prCopy');
      if(cp) cp.addEventListener('click',function(){
        var v=(document.getElementById('prCopyV')||{}).textContent||'';
        try{ navigator.clipboard.writeText(v); toast('複製好了'); }
        catch(e){ toast('複製失敗，請手動選取'); }
      });
      var pd=document.getElementById('prPaid');
      if(pd) pd.addEventListener('click',function(){
        // TODO(後端)：真版不會有這顆按鈕——入帳由金流服務商回拋通知，前端只負責顯示
        o.paidAt=Date.now(); save(); showResult(o.id);
        if(o.kind==='ai') unlockReport();
      });
      go('payresult');
    }
    function byId(id){ for(var i=0;i<S.length;i++) if(S[i].id===id) return S[i]; return null; }

    // ===== 示範用錄音（程式合成的 WAV，不連外部資源）=====
    function demoWav(){
      if(wavUri) return wavUri;
      var sr=8000, dur=2.4, n=Math.floor(sr*dur), bytes=44+n*2;
      var buf=new Uint8Array(bytes), dv=new DataView(buf.buffer);
      function tag(o,s){ for(var i=0;i<s.length;i++) buf[o+i]=s.charCodeAt(i); }
      tag(0,'RIFF'); dv.setUint32(4,bytes-8,true); tag(8,'WAVE'); tag(12,'fmt ');
      dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
      dv.setUint32(24,sr,true); dv.setUint32(28,sr*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
      tag(36,'data'); dv.setUint32(40,n*2,true);
      for(var i=0;i<n;i++){
        var t=i/sr, env=Math.min(1,t*3)*Math.min(1,(dur-t)*2.5);
        var f=320+60*Math.sin(t*1.7);
        var v=(Math.sin(2*Math.PI*f*t)*0.15 + Math.sin(2*Math.PI*f*2*t)*0.045)*env;
        dv.setInt16(44+i*2, Math.max(-1,Math.min(1,v))*32767, true);
      }
      var bin=''; for(var j=0;j<buf.length;j++) bin+=String.fromCharCode(buf[j]);
      wavUri='data:audio/wav;base64,'+btoa(bin);
      return wavUri;
    }

    // ===== 訂單列表 =====
    var lastSig='';
    function sig(){ return S.map(function(o){ return o.id+':'+statusOf(o)+':'+(o.rating||0); }).join('|'); }
    function paintOrders(){
      var host=document.getElementById('ordList'); if(!host) return;
      lastSig=sig();
      if(!S.length){
        host.innerHTML='<div class="empty">還沒有任何訂單。<br>解鎖深度解析或預約老師之後，訂單會出現在這裡。</div>';
        return;
      }
      host.innerHTML='';
      S.forEach(function(o){
        var st=statusOf(o), chip=CHIP[st];
        var d=document.createElement('div'); d.className='ord';
        var h='<div class="ord-h"><span class="ord-no">'+o.id+'　'+fmtDate(o.createdAt)+'</span><span class="st-chip '+chip[0]+'">'+chip[1]+'</span></div>'
          +'<div class="ord-nm">'+esc(o.title)+'</div><p class="ord-ds">'+esc(o.desc)+'</p>'
          +'<div class="co-total" style="margin-top:12px;padding-top:12px;"><b>'+PAYNM[o.pay]+'</b><span style="font-weight:900;font-size:1.15rem;">NT$'+o.amount+'</span></div>';
        if(o.question) h+='<div class="ord-q"><b>你問的問題</b>'+esc(o.question)+'</div>';
        if(o.kind==='teacher'){
          var n={wait:1,work:3,delivered:4}[st]||0;
          h+='<div class="ord-steps">'
            +['已付款','老師接單','製作中','已交付'].map(function(s,i){ return '<div class="s'+(i<n?' on':'')+'">'+s+'</div>'; }).join('')
            +'</div>';
        }
        if(st==='unpaid'){
          h+='<div class="ord-foot"><button class="btn pink" data-act="pay">看繳費資訊</button></div>';
        }else if(o.kind==='ai'){
          h+='<div class="ord-foot"><button class="btn green" data-act="read">看我的完整解讀</button></div>';
        }else if(st==='delivered'){
          h+='<div class="dlv"><b>老師的錄音來了</b>'
            +'<audio controls preload="none" src="'+demoWav()+'"></audio>'
            +'<p class="exp">保存到 '+fmtDate(o.paidAt+90*86400000)+'（交付後 90 天）。想留著的話，用播放器右側選單下載存檔。<br>＊示範版：這是一段合成的示範音，不是真的解讀錄音。</p>';
          if(o.rating){
            h+='<div style="margin-top:12px;border-top:2px dashed #cbbfa6;padding-top:12px;">'
              +'<div class="rv-h"><span class="s">'+stars(o.rating)+'</span><span class="w">・你的評價</span></div>'
              +(o.review?'<p style="font-weight:700;font-size:.88rem;line-height:1.6;margin:6px 0 0;">'+esc(o.review)+'</p>':'')+'</div>';
          }else{
            h+='<div style="margin-top:12px;border-top:2px dashed #cbbfa6;padding-top:12px;">'
              +'<b style="font-size:.88rem;">聽完了嗎？給老師一個評價</b>'
              +'<div class="star-pick" data-stars>'
              +[1,2,3,4,5].map(function(i){ return '<button type="button" data-s="'+i+'"><svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg></button>'; }).join('')
              +'</div>'
              +'<div class="field" style="margin-bottom:0;"><textarea data-rv rows="3" maxlength="200" placeholder="這段解讀哪裡對你有幫助？（選填，200 字內）"></textarea></div>'
              +'<button class="btn green" data-act="rate" style="font-size:.88rem;padding:9px 16px;margin-top:10px;">送出評價</button></div>';
          }
          h+='</div>';
        }
        d.innerHTML=h;
        var pick=0;
        var sp=d.querySelector('[data-stars]');
        if(sp) sp.addEventListener('click',function(e){
          var b=e.target.closest('button[data-s]'); if(!b) return;
          pick=parseInt(b.getAttribute('data-s'),10);
          [].forEach.call(sp.querySelectorAll('button'),function(x,i){ x.classList.toggle('on', i<pick); });
        });
        d.addEventListener('click',function(e){
          var b=e.target.closest('[data-act]'); if(!b) return;
          var act=b.getAttribute('data-act');
          if(act==='pay') showResult(o.id);
          else if(act==='read'){ unlockReport(); go('unlock'); }
          else if(act==='rate'){
            if(!pick){ toast('先點星星給個分數'); return; }
            o.rating=pick; o.review=(d.querySelector('[data-rv]')||{}).value||'';
            save(); paintOrders(); toast('評價送出了，謝謝你');
            // TODO(後端)：評價要送審＋只有完成交付的訂單能留，並回寫老師的平均分
          }
        });
        host.appendChild(d);
      });
    }
    // 老師單在示範版會隨時間推進狀態 → 停在訂單頁時比對「狀態指紋」，變了才重畫。
    // 不能用「還有沒有未交付的單」當條件：最後一次 製作中→已交付 的當下就沒有未交付單了，會漏掉那次重畫。
    tick=setInterval(function(){
      var v=document.getElementById('view-orders');
      if(!v || !v.classList.contains('active')) return;
      if(sig()!==lastSig) paintOrders();
    },1500);

    return {
      checkout:checkout,
      paint:paintOrders,
      count:function(){ return S.length; },
      summary:function(){
        if(!S.length) return '還沒有訂單';
        var un=0; for(var i=0;i<S.length;i++) if(!S[i].paidAt) un++;
        return S.length+' 筆訂單'+(un?'・'+un+' 筆待付款':'');
      }
    };
  })();
  // ---- 信箱：配對後私訊層（前端空殼・假資料）----
  // 規則見規劃書 §11：①雙向同意才開線 ②即時送達＋輪流制（一次一則）③預設代號＋類型徽章、暱稱可自編
  // ④任一方可結束/封鎖/檢舉 ⑤私訊不審（平台不讀）⑥外流聯絡＝本地偵測跳警示、按確定照送
  window.DopaDM=(function(){
    var TYPEZH={m:'顯示者',g:'生產者',mg:'顯生',p:'投射者',r:'反映者'};
    var listEl=document.getElementById('ibList'), chatEl=document.getElementById('ibChat'),
        bodyEl=document.getElementById('ibBody'), tabsEl=document.getElementById('ibTabs'),
        myNameEl=document.getElementById('myName');
    if(!listEl) return {};
    var toastEl=document.getElementById('toast'), dmT;
    function toast(m){ if(!toastEl)return; toastEl.textContent=m; toastEl.classList.add('show'); clearTimeout(dmT); dmT=setTimeout(function(){toastEl.classList.remove('show');},2600); }
    function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
    var tab='open', cur=null, curMsgs=[], realtimeCh=null;
    var S={inv:[],sent:[],open:[]};
    var uid=null;
    function getAlias(p){ if(!p) return '#????'; if(p.nick&&p.nick_status==='approved') return p.nick; return '#'+(p.display_code||'????'); }
    function daysLeft(expires_at){ var ms=new Date(expires_at).getTime()-Date.now(); return Math.max(0,Math.ceil(ms/86400000)); }
    function fmtTime(iso){
      var d=new Date(iso),now=new Date();
      var hh=d.getHours(),mm=d.getMinutes();
      var ts=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
      if(now.toDateString()===d.toDateString()) return '今天 '+ts;
      var yes=new Date(now); yes.setDate(yes.getDate()-1);
      if(yes.toDateString()===d.toDateString()) return '昨天 '+ts;
      return (d.getMonth()+1)+'/'+(d.getDate())+' '+ts;
    }
    function nowStr(){ var d=new Date(),h=d.getHours(),m=d.getMinutes(); return '今天 '+(h<10?'0':'')+h+':'+(m<10?'0':'')+m; }

    // ---- 從 Supabase 讀取資料 ----
    async function loadAll(){
      var res=await window.DopaSupabase.auth.getUser();
      if(!res.data||!res.data.user){ S={inv:[],sent:[],open:[]}; counts(); paint(); return; }
      uid=res.data.user.id;
      var {data:meData}=await window.DopaSupabase.from('users')
        .select('type,nick,nick_status,display_code').eq('id',uid).maybeSingle();
      if(meData){
        var myAlias=getAlias(meData);
        var myType=meData.type?('某隻'+TYPEZH[meData.type]):'';
        myNameEl.textContent=(myType?myType+' ・ ':'')+myAlias;
      }
      await Promise.all([loadInvites(),loadSentInvites(),loadThreads()]);
      counts(); syncTabs(); paint();
    }
    async function loadInvites(){
      var {data}=await window.DopaSupabase.from('invites')
        .select('id,from_user_id,expires_at').eq('to_user_id',uid).eq('status','pending')
        .gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false});
      if(!data||!data.length){S.inv=[];return;}
      var fromIds=data.map(function(r){return r.from_user_id;});
      var {data:profiles}=await window.DopaSupabase.from('approved_profiles')
        .select('user_id,type,nick,nick_status,display_code,intro').in('user_id',fromIds);
      var pMap={}; (profiles||[]).forEach(function(p){pMap[p.user_id]=p;});
      S.inv=data.map(function(r){
        var p=pMap[r.from_user_id]||{};
        return {id:r.id,from_user_id:r.from_user_id,t:p.type||'g',alias:getAlias(p),intro:p.intro||'',days:daysLeft(r.expires_at)};
      });
    }
    async function loadSentInvites(){
      var {data}=await window.DopaSupabase.from('invites')
        .select('id,to_user_id,expires_at').eq('from_user_id',uid).eq('status','pending')
        .gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false});
      if(!data||!data.length){S.sent=[];return;}
      var toIds=data.map(function(r){return r.to_user_id;});
      var {data:profiles}=await window.DopaSupabase.from('approved_profiles')
        .select('user_id,type,nick,nick_status,display_code').in('user_id',toIds);
      var pMap={}; (profiles||[]).forEach(function(p){pMap[p.user_id]=p;});
      S.sent=data.map(function(r){
        var p=pMap[r.to_user_id]||{};
        return {id:r.id,t:p.type||'g',alias:getAlias(p),days:daysLeft(r.expires_at)};
      });
    }
    async function loadThreads(){
      var {data:threadData}=await window.DopaSupabase.from('threads')
        .select('id,user_a_id,user_b_id,turn_user_id')
        .or('user_a_id.eq.'+uid+',user_b_id.eq.'+uid)
        .eq('status','open').order('created_at',{ascending:false});
      if(!threadData||!threadData.length){S.open=[];return;}
      var otherIds=threadData.map(function(t){return t.user_a_id===uid?t.user_b_id:t.user_a_id;});
      var {data:profiles}=await window.DopaSupabase.from('approved_profiles')
        .select('user_id,type,nick,nick_status,display_code').in('user_id',otherIds);
      var pMap={}; (profiles||[]).forEach(function(p){pMap[p.user_id]=p;});
      S.open=threadData.map(function(t){
        var otherId=t.user_a_id===uid?t.user_b_id:t.user_a_id;
        var p=pMap[otherId]||{};
        return {id:t.id,otherId:otherId,t:p.type||'g',alias:getAlias(p),turn:t.turn_user_id===uid?'you':'them',lastMsg:null};
      });
      await Promise.all(S.open.map(async function(thr){
        var {data:lm}=await window.DopaSupabase.from('messages')
          .select('sender_id,body,created_at').eq('thread_id',thr.id)
          .order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(lm) thr.lastMsg={who:lm.sender_id===uid?'me':'them',x:lm.body,at:fmtTime(lm.created_at)};
      }));
    }

    // ---- 計數與 nav 紅點 ----
    function counts(){
      document.getElementById('cntInv').textContent=S.inv.length;
      document.getElementById('cntOpen').textContent=S.open.length;
      document.getElementById('cntSent').textContent=S.sent.length;
      var n=loggedIn()?(S.inv.length+S.open.filter(function(t){return t.turn==='you';}).length):0;
      var nav=document.getElementById('navUnread');
      if(nav){nav.textContent=n;nav.style.display=n?'inline-block':'none';}
      var ban=document.getElementById('invBanner');
      if(ban){
        var showBan=S.inv.length>0&&tab==='open';
        ban.style.display=showBan?'flex':'none';
        if(showBan) document.getElementById('invBannerTxt').innerHTML=
          '有 '+S.inv.length+' 個人想認識你<small>你也說好，才會開一條線</small>';
      }
    }

    // ---- 清單 ----
    function paint(){
      bodyEl.innerHTML=''; counts();
      var arr=tab==='inv'?S.inv:tab==='open'?S.open:S.sent;
      if(!arr.length){
        var e=document.createElement('div'); e.className='ib-empty';
        e.textContent=tab==='inv'?'目前沒有人敲你 去摩天輪或飛車逛逛吧'
                     :tab==='open'?'還沒有開起來的線——對方也說好，才會開在這裡 '
                     :'你還沒送出過「想認識」';
        bodyEl.appendChild(e); return;
      }
      arr.forEach(function(o){
        if(tab==='inv') bodyEl.appendChild(invCard(o));
        else if(tab==='open') bodyEl.appendChild(threadRow(o));
        else bodyEl.appendChild(sentCard(o));
      });
    }
    function invCard(o){
      var c=document.createElement('div'); c.className='inv-card';
      c.innerHTML='<span class="ntype '+o.t+'">某隻'+TYPEZH[o.t]+'</span>'
        +'<div class="inv-alias">「'+esc(o.alias)+'」</div>'
        +'<p class="inv-intro">'+esc(o.intro)+'</p>'
        +'<div class="inv-meta">想認識你 ・ 還有 '+o.days+' 天回應，過期就自動消失（對方不會知道你拒絕）</div>';
      var act=document.createElement('div'); act.className='inv-act';
      var y=document.createElement('button'); y.className='btn green'; y.type='button'; y.textContent='回應・開始聊 ';
      y.addEventListener('click',function(){doAccept(o);});
      var n=document.createElement('button'); n.className='btn ghost'; n.type='button'; n.textContent='這次先不要';
      n.addEventListener('click',function(){doDecline(o.id);});
      act.appendChild(y); act.appendChild(n); c.appendChild(act); return c;
    }
    function sentCard(o){
      var c=document.createElement('div'); c.className='inv-card';
      c.innerHTML='<span class="ntype '+o.t+'">某隻'+TYPEZH[o.t]+'</span>'
        +'<div class="inv-alias">「'+esc(o.alias)+'」</div>'
        +'<div class="inv-meta">⏳ 等對方回應中 ・ 還有 '+o.days+' 天 ・ 對方沒回也不會通知你（不用一直等）</div>';
      return c;
    }
    function threadRow(o){
      var b=document.createElement('button'); b.className='thread-row'; b.type='button';
      var preview=o.lastMsg?((o.lastMsg.who==='me'?'你：':'')+esc(o.lastMsg.x)):'還沒有人開口——你先說點什麼？';
      b.innerHTML='<div class="tr-dot"><svg class="row-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3zm1.8 1.8 7.2 5.4 7.2-5.4z"/></svg></div><div class="tr-mid">'
        +'<div class="tr-name">「'+esc(o.alias)+'」<span style="font-weight:700;opacity:.55;font-size:.8rem;">・'+TYPEZH[o.t]+'</span></div>'
        +'<div class="tr-last">'+preview+'</div></div>'
        +'<span class="tr-right"><span class="tr-turn '+(o.turn==='you'?'you':'them')+'">'+(o.turn==='you'?'輪到你':'等對方')+'</span>'
        +'<span class="tr-time">'+(o.lastMsg&&o.lastMsg.at?esc(o.lastMsg.at):'')+'</span></span>';
      b.addEventListener('click',function(){openChat(o.id);});
      return b;
    }
    function syncTabs(){
      [].slice.call(tabsEl.querySelectorAll('button')).forEach(function(x){x.classList.toggle('on',x.getAttribute('data-tab')===tab);});
    }
    tabsEl.addEventListener('click',function(e){
      var b=e.target.closest('button[data-tab]'); if(!b) return;
      tab=b.getAttribute('data-tab'); syncTabs(); paint();
    });
    document.getElementById('invBanner').addEventListener('click',function(){
      tab='inv'; syncTabs(); paint();
    });

    // ---- 暱稱顯示與編輯 ----
    document.getElementById('myNameEdit').addEventListener('click',function(){
      var btn=this;
      if(btn.dataset.editing==='1'){
        var inp=document.getElementById('myNameInput'); var v=(inp.value||'').trim().slice(0,20);
        var span=document.createElement('span'); span.className='me-name'; span.id='myName';
        if(v&&uid){
          window.DopaSupabase.from('users').update({nick:v,nick_status:'pending'}).eq('id',uid).then(function(){});
          span.textContent=v+'（審核中）';
          toast('暱稱改好了・暱稱是公開的，會先審後顯');
        } else {
          span.textContent=myNameEl.textContent;
        }
        inp.replaceWith(span); myNameEl=span; btn.textContent='改暱稱'; btn.dataset.editing='0';
        return;
      }
      var inp2=document.createElement('input'); inp2.className='me-input'; inp2.id='myNameInput';
      inp2.value=''; inp2.maxLength=20; inp2.placeholder='輸入新暱稱（最多 20 字）';
      myNameEl.replaceWith(inp2); btn.textContent='存起來'; btn.dataset.editing='1'; inp2.focus();
    });

    // ---- 接受 / 拒絕邀請 ----
    async function doAccept(o){
      var {data:threadId,error}=await window.DopaSupabase.rpc('accept_invite',{p_invite_id:o.id});
      if(error){toast('開線失敗，請稍後再試');return;}
      S.inv=S.inv.filter(function(x){return x.id!==o.id;});
      await loadThreads();
      tab='open'; syncTabs(); paint(); toast('開線了！');
      if(threadId){
        var thr=S.open.filter(function(t){return t.id===threadId;})[0];
        if(thr) openChat(thr.id);
      }
    }
    async function doDecline(invId){
      await window.DopaSupabase.from('invites').update({status:'declined'}).eq('id',invId).eq('to_user_id',uid);
      S.inv=S.inv.filter(function(x){return x.id!==invId;}); paint();
      toast('已略過・對方不會收到通知');
    }

    // ---- 對話 ----
    var chatBody=document.getElementById('chatBody'), chatText=document.getElementById('chatText'),
        chatSend=document.getElementById('chatSend'), chatCount=document.getElementById('chatCount'),
        turnLock=document.getElementById('turnLock'), chatIn=document.getElementById('chatIn'),
        menuPop=document.getElementById('menuPop');
    async function openChat(threadId){
      cur=S.open.filter(function(t){return t.id===threadId;})[0]; if(!cur) return;
      document.getElementById('chatName').textContent='「'+cur.alias+'」';
      document.getElementById('chatType').textContent='某隻'+(TYPEZH[cur.t]||cur.t);
      listEl.style.display='none'; chatEl.style.display='block';
      curMsgs=[{who:'sys',x:'你們都說好了，這條線開起來了。一次一則，慢慢聊 '}]; paintChat();
      var {data:msgData}=await window.DopaSupabase.from('messages')
        .select('id,sender_id,body,created_at').eq('thread_id',threadId)
        .order('created_at',{ascending:true});
      curMsgs=[{who:'sys',x:'你們都說好了，這條線開起來了。一次一則，慢慢聊 '}];
      (msgData||[]).forEach(function(m){
        curMsgs.push({who:m.sender_id===uid?'me':'them',x:m.body,at:fmtTime(m.created_at)});
      });
      paintChat(); subscribeMessages(threadId);
      window.scrollTo({top:0,behavior:'auto'});
    }
    function closeChat(){
      unsubscribeMessages(); cur=null; curMsgs=[]; menuPop.classList.remove('show');
      chatEl.style.display='none'; listEl.style.display='block'; paint();
    }
    document.getElementById('chatBack').addEventListener('click',closeChat);
    function paintChat(){
      chatBody.innerHTML='';
      curMsgs.forEach(function(m){
        var d=document.createElement('div');
        if(m.who==='sys'){d.className='chat-sys';d.textContent=m.x;}
        else{d.className='bub '+(m.who==='me'?'me':'them');d.innerHTML=esc(m.x)+(m.at?'<span class="t">'+esc(m.at)+'</span>':'');}
        chatBody.appendChild(d);
      });
      chatBody.scrollTop=chatBody.scrollHeight;
      var mine=cur&&cur.turn==='you';
      chatIn.style.display=mine?'flex':'none';
      turnLock.style.display=mine?'none':'flex';
      chatCount.style.display=mine?'block':'none';
    }
    chatText.addEventListener('input',function(){
      var n=chatText.value.length;
      chatCount.textContent=n+' / 200';
      chatCount.classList.toggle('over',n>200);
    });

    // ---- Realtime 訂閱 ----
    function subscribeMessages(threadId){
      unsubscribeMessages();
      realtimeCh=window.DopaSupabase.channel('dm-'+threadId)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'thread_id=eq.'+threadId},function(payload){
          var m=payload.new;
          if(m.sender_id===uid) return; // 自己送的已透過 Optimistic UI 顯示
          curMsgs.push({who:'them',x:m.body,at:fmtTime(m.created_at)});
          if(cur) cur.turn='you';
          paintChat(); counts();
        })
        .subscribe();
    }
    function unsubscribeMessages(){
      if(realtimeCh){window.DopaSupabase.removeChannel(realtimeCh);realtimeCh=null;}
    }

    // ---- 外流聯絡方式：本地偵測（判斷跑在使用者自己的瀏覽器，訊息不上傳）----
    var LEAK=[
      /[\w.+-]+@[\w-]+\.[\w.]+/, // email
      /09\d{2}[\s-]?\d{3}[\s-]?\d{3}/, // 台灣手機
      /\b(line|ig|instagram|fb|facebook|wechat|telegram|discord|whats\s?app)\b/i,
      /(加|留|給你|給我|私訊?我)\s*(賴|line|ig|微信|電話|手機|臉書)/i,
      /微信|加賴|私賴|賴\s*[:：]?\s*[A-Za-z0-9._-]{3,}/i, // 注意：①不可用裸的「賴」會誤判依賴/信賴/無賴 ②不可用「賴我」會誤判依賴我/信賴我
      // 同理「我的/你的＋手機」也拿掉了——「我的手機好慢」不該被唸
      /@[A-Za-z0-9._]{4,}/ // 帳號 handle
    ];
    function looksLeaky(s){return LEAK.some(function(re){return re.test(s);});}
    var mask=document.getElementById('privacyMask'), pending=null;
    document.getElementById('pvCancel').addEventListener('click',function(){mask.classList.remove('show');pending=null;});
    document.getElementById('pvOk').addEventListener('click',function(){
      mask.classList.remove('show');
      if(pending){var t=pending;pending=null;doSend(t);}
    });
    chatSend.addEventListener('click',function(){
      var v=(chatText.value||'').trim();
      if(!cur||!v) return;
      if(v.length>200){toast('一則最多 200 字——太長的話，分兩次慢慢說 ');return;}
      if(cur.turn!=='you'){toast('一次一則喔・等對方回你再送');return;}
      if(looksLeaky(v)){pending=v;mask.classList.add('show');return;} // ← 只提醒，不阻擋
      doSend(v);
    });
    async function doSend(v){
      if(!cur||!uid) return;
      var optimistic={who:'me',x:v,at:nowStr()};
      curMsgs.push(optimistic); cur.turn='them';
      chatText.value=''; chatCount.textContent='0 / 200'; chatCount.classList.remove('over');
      paintChat();
      var {error}=await window.DopaSupabase.from('messages')
        .insert({thread_id:cur.id,sender_id:uid,body:v});
      if(error){
        var idx=curMsgs.indexOf(optimistic);
        if(idx>-1) curMsgs.splice(idx,1);
        cur.turn='you'; paintChat();
        toast('送出失敗，請稍後再試');
      }
    }

    // ---- 三點選單：結束／封鎖／檢舉 ----
    document.getElementById('chatMenu').addEventListener('click',function(e){e.stopPropagation();menuPop.classList.toggle('show');});
    document.addEventListener('click',function(){menuPop.classList.remove('show');});
    menuPop.addEventListener('click',async function(e){
      var b=e.target.closest('button[data-act]'); if(!b||!cur) return;
      var act=b.getAttribute('data-act'),threadId=cur.id,otherId=cur.otherId;
      var snapshot=curMsgs.filter(function(m){return m.who!=='sys';}).slice(-10)
        .map(function(m){return {who:m.who,body:m.x,at:m.at};});
      closeChat();
      if(act==='end'){
        await window.DopaSupabase.from('threads')
          .update({status:'ended',ended_by:uid,ended_at:new Date().toISOString()}).eq('id',threadId);
        S.open=S.open.filter(function(t){return t.id!==threadId;}); paint();
        toast('已結束這條線・對方不會收到通知');
      } else if(act==='block'){
        await Promise.all([
          window.DopaSupabase.from('threads').update({status:'ended',ended_by:uid,ended_at:new Date().toISOString()}).eq('id',threadId),
          window.DopaSupabase.from('blocks').insert({blocker_id:uid,blocked_id:otherId})
        ]);
        S.open=S.open.filter(function(t){return t.id!==threadId;}); paint();
        toast('已封鎖並結束・你們不會再配到彼此');
      } else if(act==='report'){
        await Promise.all([
          window.DopaSupabase.from('threads').update({status:'ended',ended_by:uid,ended_at:new Date().toISOString()}).eq('id',threadId),
          window.DopaSupabase.from('reports').insert({reporter_id:uid,reported_id:otherId,thread_id:threadId,evidence:snapshot,reason:'user_report'}),
          window.DopaSupabase.from('blocks').insert({blocker_id:uid,blocked_id:otherId})
        ]);
        S.open=S.open.filter(function(t){return t.id!==threadId;}); paint();
        toast('已收到檢舉・我們只會看你交出來的這段對話');
      }
    });

    counts(); syncTabs(); paint();
    loadAll();
    return {refresh:loadAll,invite:function(){return true;}};
  })();

  // 解鎖頁先放一份示範，讓還沒驗證的人也看得到完整版長怎樣
  try{
    if(window.HDEngine && window.HDContent){
      personalizeUnlock(window.HDEngine.computeChart(new Date(Date.UTC(1995,6,20,6,30))));
      setText("repSub","＊這是範例，驗證後會換成你的");
    }
  }catch(e){ if(window.console) console.error(e); }

  form.addEventListener("submit",function(e){
    e.preventDefault();
    var date=document.getElementById("fDate").value,
        time=document.getElementById("fTime").value,
        place=document.getElementById("fPlace").value,
        name=document.getElementById("fName").value.trim();
    if(!date||!time||!place){
      formErr.textContent="出生日期、時間、出生地都要填喔——時間差一小時，類型就可能不一樣。";
      return;
    }
    if(place==="__other"){
      formErr.textContent="這個地區的時區要細抓，先用有列出的地區試試；精確版之後補上～";
      return;
    }
    if(!window.HDEngine){
      formErr.textContent="計算核心還沒載入好，重新整理一下再試";
      return;
    }
    formErr.textContent="";
    var tz=parseFloat(place),
        dp=date.split("-"), tp=time.split(":"),
        utcMs=Date.UTC(+dp[0],+dp[1]-1,+dp[2],+tp[0],+tp[1]) - tz*3600000;
    var chart;
    try { chart=window.HDEngine.computeChart(new Date(utcMs)); window.__lastChart=chart; }
    catch(err){ formErr.textContent="計算出了點狀況，稍後再試一次"; if(window.console)console.error(err); return; }
    // 出生資料存起來：預約老師要用，而且使用者關掉再回來不該被要求重驗一次。
    try{
      var sel=document.getElementById("fPlace");
      var placeName=(sel&&sel.selectedIndex>0)?sel.options[sel.selectedIndex].text:"";
      localStorage.setItem("dopa_birth_v1",JSON.stringify({date:date,time:time,tz:place,place:placeName,name:name||""}));
      if(window.DopaAuth&&window.DopaAuth.user&&window.DopaAuth.user())
        window.DopaSupabase.from("birth_data").upsert({user_id:window.DopaAuth.user().id,birth_date:date,birth_time:time,birth_tz_offset:parseFloat(place),birth_place:placeName},{onConflict:"user_id"}).then(function(){});
    }catch(e){}
    if(window.DopaAuth && window.DopaAuth.setType) window.DopaAuth.setType(String(chart.blobKey||"").toLowerCase());
    machine.style.display="none";
    spin.scrollIntoView({behavior:"smooth",block:"center"});
    runSpin(function(){
      spin.style.display="none";
      renderResult(chart, name);
      resultEl.style.display="block";
      resultEl.scrollIntoView({behavior:"smooth",block:"center"});
    });
  });

  document.getElementById("restart").addEventListener("click",function(){
    resultEl.style.display="none";
    machine.style.display="block";
    document.getElementById("machine").scrollIntoView({behavior:"smooth",block:"center"});
  });

  // ---- D2 管理員審核後台 ----
  window.DopaAdmin=(function(){
    var currentTab="tab-posts";

    function esc(s){ return String(s||"").replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

    function switchTab(tab){
      document.querySelectorAll(".admin-tab").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-tab")===tab); });
      document.querySelectorAll(".admin-panel").forEach(function(p){ p.style.display=(p.id===tab)?"":"none"; });
      currentTab=tab;
      if(tab==="tab-posts") loadPosts();
      else if(tab==="tab-intros") loadIntros();
      else if(tab==="tab-nicks") loadNicks();
      else if(tab==="tab-applications") loadApplications();
    }

    var adminView=document.getElementById("view-admin");
    if(adminView){
      adminView.addEventListener("click",function(e){
        var t=e.target.closest(".admin-tab");
        if(t) switchTab(t.getAttribute("data-tab"));
      });
    }

    function uid(){ return window.DopaAuth&&window.DopaAuth.user?window.DopaAuth.user().id:null; }

    function renderCard(body, meta, onApprove, onReject){
      var d=document.createElement("div");
      d.className="admin-card";
      d.innerHTML=
        '<div class="admin-card-body">'+esc(body)+'</div>'+
        '<div class="admin-card-meta">'+esc(meta)+'</div>'+
        '<div class="admin-card-acts">'+
          '<button class="btn act-ok" type="button">✓ 核准</button>'+
          '<button class="btn rej act-no" type="button">✕ 駁回</button>'+
        '</div>'+
        '<div class="admin-reject-row">'+
          '<input type="text" placeholder="駁回原因（可空白）" maxlength="100">'+
          '<button class="btn act-rej-send" type="button">確認駁回</button>'+
        '</div>';
      d.querySelector(".act-ok").addEventListener("click",function(){ onApprove(d); });
      d.querySelector(".act-no").addEventListener("click",function(){
        var row=d.querySelector(".admin-reject-row");
        row.classList.toggle("show");
      });
      d.querySelector(".act-rej-send").addEventListener("click",function(){
        onReject(d, d.querySelector("input").value.trim());
      });
      return d;
    }

    function reviewedMeta(){ return {reviewed_by:uid(), reviewed_at:new Date().toISOString()}; }

    function loadPosts(){
      var el=document.getElementById("adminPostsList"); if(!el) return;
      el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      window.DopaSupabase.from("lounge_posts").select("id,body,created_at").eq("status","pending").order("created_at").then(function(res){
        if(res.error){ el.innerHTML='<div class="admin-empty">讀取失敗</div>'; return; }
        var rows=res.data||[];
        if(!rows.length){ el.innerHTML='<div class="admin-empty">沒有待審紙條 ✓</div>'; return; }
        el.innerHTML="";
        rows.forEach(function(p){
          el.appendChild(renderCard(
            p.body,
            "貼出："+(p.created_at||"").slice(0,16).replace("T"," "),
            function(card){
              window.DopaSupabase.from("lounge_posts").update(Object.assign({status:"approved"},reviewedMeta())).eq("id",p.id).select("id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("approve failed",r.error,r.data); toast("核准失敗，請確認管理員 RLS 設定"); } });
            },
            function(card, reason){
              window.DopaSupabase.from("lounge_posts").update(Object.assign({status:"rejected",reject_reason:reason||null},reviewedMeta())).eq("id",p.id).select("id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("reject failed",r.error,r.data); toast("駁回失敗，請確認管理員 RLS 設定"); } });
            }
          ));
        });
      });
    }

    function loadIntros(){
      var el=document.getElementById("adminIntrosList"); if(!el) return;
      el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      window.DopaSupabase.from("profiles").select("user_id,intro,energy_tags,updated_at").eq("intro_status","pending").order("updated_at").then(function(res){
        if(res.error){ el.innerHTML='<div class="admin-empty">讀取失敗</div>'; return; }
        var rows=res.data||[];
        if(!rows.length){ el.innerHTML='<div class="admin-empty">沒有待審自介 ✓</div>'; return; }
        el.innerHTML="";
        rows.forEach(function(p){
          var tags=(p.energy_tags||[]).join("・");
          el.appendChild(renderCard(
            p.intro+(tags?"\n\n能量標籤："+tags:""),
            "更新："+(p.updated_at||"").slice(0,16).replace("T"," "),
            function(card){
              window.DopaSupabase.from("profiles").update(Object.assign({intro_status:"approved"},reviewedMeta())).eq("user_id",p.user_id).select("user_id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("approve intro failed",r.error,r.data); toast("核准失敗，請確認管理員 RLS 設定"); } });
            },
            function(card, reason){
              window.DopaSupabase.from("profiles").update(Object.assign({intro_status:"rejected",reject_reason:reason||null},reviewedMeta())).eq("user_id",p.user_id).select("user_id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("reject intro failed",r.error,r.data); toast("駁回失敗，請確認管理員 RLS 設定"); } });
            }
          ));
        });
      });
    }

    function loadNicks(){
      var el=document.getElementById("adminNicksList"); if(!el) return;
      el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      window.DopaSupabase.from("users").select("id,nick,updated_at").eq("nick_status","pending").order("updated_at").then(function(res){
        if(res.error){ el.innerHTML='<div class="admin-empty">讀取失敗</div>'; return; }
        var rows=res.data||[];
        if(!rows.length){ el.innerHTML='<div class="admin-empty">沒有待審暱稱 ✓</div>'; return; }
        el.innerHTML="";
        rows.forEach(function(u){
          el.appendChild(renderCard(
            "暱稱："+u.nick,
            "更新："+(u.updated_at||"").slice(0,16).replace("T"," "),
            function(card){
              window.DopaSupabase.from("users").update({nick_status:"approved"}).eq("id",u.id).select("id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("approve nick failed",r.error,r.data); toast("核准失敗，請確認管理員 RLS 設定"); } });
            },
            function(card){
              window.DopaSupabase.from("users").update({nick_status:"rejected",nick:null}).eq("id",u.id).select("id").then(function(r){ if(!r.error&&r.data&&r.data.length) card.remove(); else{ console.error("reject nick failed",r.error,r.data); toast("駁回失敗，請確認管理員 RLS 設定"); } });
            }
          ));
        });
      });
    }

    function loadApplications(){
      var el=document.getElementById("adminApplicationsList"); if(!el) return;
      el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      window.DopaSupabase.from("teacher_applications").select("id,name,contact,specialty,bio,status,created_at").order("created_at").then(function(res){
        if(res.error){ el.innerHTML='<div class="admin-empty">讀取失敗</div>'; return; }
        var rows=res.data||[];
        if(!rows.length){ el.innerHTML='<div class="admin-empty">目前沒有老師申請</div>'; return; }
        el.innerHTML="";
        rows.forEach(function(a){
          var d=document.createElement("div");
          d.className="admin-card";
          d.innerHTML=
            '<div class="admin-card-body">'+
              '<div style="font-weight:600;margin-bottom:4px;">'+esc(a.name)+'</div>'+
              '<div style="font-size:.88rem;opacity:.7;margin-bottom:4px;">聯絡：'+esc(a.contact)+'</div>'+
              (a.specialty?'<div style="font-size:.88rem;opacity:.7;margin-bottom:4px;">專長：'+esc(a.specialty)+'</div>':'')+
              (a.bio?'<div style="font-size:.88rem;margin-top:6px;">'+esc(a.bio)+'</div>':'')+
            '</div>'+
            '<div class="admin-card-meta">申請時間：'+(a.created_at||"").slice(0,16).replace("T"," ")+'　狀態：'+esc(a.status||"pending")+'</div>';
          el.appendChild(d);
        });
      });
    }

    function refresh(){
      var auth=window.DopaAuth;
      if(!auth||!auth.isIn||!auth.isIn()){ go("account"); return; }
      window.DopaSupabase.from("users").select("is_admin").eq("id",auth.user().id).maybeSingle().then(function(res){
        if(!res.data||!res.data.is_admin){ go("account"); toast("需要管理員權限"); return; }
        switchTab(currentTab);
      });
    }

    return { refresh:refresh };
  })();

  // ---- D4 老師後台 ----
  window.DopaTeacher=(function(){
    var tdData=null;
    var tdSub='pending_accept';
    var tdMain='td-orders';

    function _uid(){ return window.DopaAuth&&window.DopaAuth.user?window.DopaAuth.user().id:null; }

    function loadTeacherData(){
      var u=_uid(); if(!u) return Promise.resolve(null);
      return window.DopaSupabase.from('teachers').select('*').eq('id',u).maybeSingle()
        .then(function(res){ tdData=res.data||null; return tdData; });
    }

    function loadOrders(sub){
      var u=_uid(); if(!u) return Promise.resolve([]);
      var q=window.DopaSupabase.from('orders')
        .select('id,created_at,status,amount,plan_name,plan_price,teacher_status,recording_url,teacher_accepted_at,delivered_at')
        .eq('teacher_id',u).eq('product','teacher_session')
        .order('created_at',{ascending:false});
      if(sub==='pending_accept') q=q.is('teacher_status',null).eq('status','paid');
      else if(sub==='accepted') q=q.eq('teacher_status','accepted');
      else if(sub==='delivered') q=q.eq('teacher_status','delivered');
      return q.then(function(res){ return res.data||[]; });
    }

    function updateCounts(){
      var u=_uid(); if(!u) return;
      window.DopaSupabase.from('orders')
        .select('teacher_status,status').eq('teacher_id',u).eq('product','teacher_session')
        .then(function(res){
          var rows=res.data||[];
          var pend=rows.filter(function(r){return r.status==='paid'&&!r.teacher_status;}).length;
          var work=rows.filter(function(r){return r.teacher_status==='accepted';}).length;
          var done=rows.filter(function(r){return r.teacher_status==='delivered';}).length;
          var p=document.getElementById('tdCntPend'),w=document.getElementById('tdCntWork'),d=document.getElementById('tdCntDone');
          if(p) p.textContent=pend||'';
          if(w) w.textContent=work||'';
          if(d) d.textContent=done||'';
        });
    }

    function paintOrders(orders, sub){
      var el=document.getElementById('tdOrderList'); if(!el) return;
      if(!orders.length){
        var labels={pending_accept:'待接單',accepted:'製作中',delivered:'已交付'};
        el.innerHTML='<div class="admin-empty">目前沒有'+esc(labels[sub]||sub)+'的訂單</div>';
        return;
      }
      el.innerHTML='';
      orders.forEach(function(o){
        var d=document.createElement('div'); d.className='ord';
        var h='<div class="ord-h">'
          +'<span class="ord-no" style="font-size:.8rem;">'+(o.id||'').slice(0,8)+'⋯</span>'
          +'<span class="ord-nm" style="font-weight:900;">'+esc(o.plan_name||'方案')+'</span>'
          +'</div>'
          +'<div style="margin:6px 0;font-size:.88rem;opacity:.75;">'+(o.created_at||'').slice(0,10)+'・NT$'+(o.amount||0)+'</div>';
        if(sub==='pending_accept'){
          h+='<div class="ord-foot" style="display:flex;gap:10px;margin-top:14px;">'
            +'<button class="btn green" data-act="accept" data-oid="'+esc(o.id)+'" type="button">接單</button>'
            +'<button class="btn danger-btn" data-act="decline" data-oid="'+esc(o.id)+'" type="button">拒接</button>'
            +'</div>';
        } else if(sub==='accepted'){
          h+='<div class="upload-area" style="margin-top:12px;display:flex;align-items:center;gap:10px;">'
            +'<label class="btn" style="cursor:pointer;margin:0;">上傳錄音'
            +'<input type="file" accept="audio/*" data-oid="'+esc(o.id)+'" style="display:none;"></label>'
            +'<span style="font-size:.8rem;opacity:.6;">mp3／m4a／wav，最大 200MB</span></div>'
            +(o.recording_url?'<p style="font-size:.82rem;color:#1FC98A;margin-top:8px;">✓ 已上傳錄音（可再次上傳覆蓋）</p>':'');
        } else {
          h+='<p style="font-size:.82rem;color:#1FC98A;margin-top:8px;">✓ 已交付'+((o.delivered_at?'・'+(o.delivered_at||'').slice(0,10):''))+'</p>';
        }
        d.innerHTML=h;
        d.addEventListener('click',function(e){
          var b=e.target.closest('[data-act]'); if(!b) return;
          var act=b.getAttribute('data-act'), oid=b.getAttribute('data-oid');
          if(act==='accept'){
            if(b.disabled) return;
            b.disabled=true; b.textContent='接單中⋯';
            window.DopaSupabase.from('orders')
              .update({teacher_status:'accepted',teacher_accepted_at:new Date().toISOString()})
              .eq('id',oid).then(function(res){
                if(res.error){ b.disabled=false; b.textContent='接單'; toast('操作失敗，請再試'); return; }
                toast('已接單！請開始錄音，完成後回來上傳'); switchOrderSub('accepted');
              });
          } else if(act==='decline'){
            if(!confirm('確定要拒接這張單嗎？（需聯繫客服協助客戶申請退款）')) return;
            b.disabled=true;
            window.DopaSupabase.from('orders').update({teacher_status:'declined'}).eq('id',oid)
              .then(function(res){
                if(res.error){ b.disabled=false; toast('操作失敗'); return; }
                toast('已拒接'); switchOrderSub('pending_accept');
              });
          }
        });
        d.addEventListener('change',function(e){
          var inp=e.target.closest('input[type="file"]'); if(!inp) return;
          var file=inp.files[0]; if(!file||!_uid()) return;
          var oid=inp.getAttribute('data-oid');
          var lbl=inp.parentElement; lbl.textContent='上傳中⋯';
          var ext=(file.name.split('.').pop()||'mp3').toLowerCase();
          var path=_uid()+'/'+oid+'.'+ext;
          window.DopaSupabase.storage.from('recordings').upload(path,file,{upsert:true})
            .then(function(upRes){
              if(upRes.error){ lbl.innerHTML='上傳錄音<input type="file" accept="audio/*" data-oid="'+esc(oid)+'" style="display:none;">'; toast('上傳失敗：'+upRes.error.message); return; }
              return window.DopaSupabase.from('orders')
                .update({recording_url:path,teacher_status:'delivered',delivered_at:new Date().toISOString()})
                .eq('id',oid);
            })
            .then(function(dbRes){
              if(!dbRes||dbRes.error){ toast('錄音已上傳但更新訂單失敗，請通知技術支援'); return; }
              toast('錄音上傳完成！客戶現在可以聆聽了'); switchOrderSub('delivered');
            });
        });
        el.appendChild(d);
      });
    }

    function paintEarnings(){
      var el=document.getElementById('tdEarnings'); if(!el) return;
      el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      var u=_uid(); if(!u) return;
      window.DopaSupabase.from('orders')
        .select('id,created_at,status,amount,plan_name,teacher_status')
        .eq('teacher_id',u).eq('product','teacher_session')
        .order('created_at',{ascending:false})
        .then(function(res){
          var rows=res.data||[];
          var paidRows=rows.filter(function(r){return r.status==='paid';});
          var total=paidRows.reduce(function(s,r){return s+(r.amount||0);},0);
          var cut=(tdData&&tdData.platform_cut_pct!=null)?tdData.platform_cut_pct:20;
          var mine=Math.round(total*(1-cut/100));
          var stLabel={paid:'已付款',pending:'待付款',failed:'失敗',refunded:'已退款'};
          el.innerHTML='<div class="acct-sec"><h3>收益總覽</h3>'
            +'<div class="acct-row"><div><div class="k">已付款訂單</div><div class="v">'+paidRows.length+' 筆・NT$'+total+'</div></div></div>'
            +'<div class="acct-row"><div><div class="k">平台抽成</div><div class="v">'+cut+'%</div></div></div>'
            +'<div class="acct-row"><div><div class="k" style="font-weight:900;">預估應得</div><div class="v" style="font-size:1.15rem;font-weight:900;color:#1FC98A;">NT$'+mine+'</div></div></div>'
            +'<p style="font-size:.8rem;opacity:.6;margin-top:8px;">＊結算時間與轉帳流程待金流串接後確認。</p></div>'
            +(rows.length?'<div class="acct-sec"><h3>訂單紀錄</h3>'
              +rows.map(function(o){
                return '<div class="acct-row"><div><div class="k">'+esc(o.plan_name||'方案')+'</div>'
                  +'<div class="v">'+(o.created_at||'').slice(0,10)+'・NT$'+(o.amount||0)
                  +'・<span class="st-chip '+(o.status==='paid'?'done':'unpaid')+'">'+esc(stLabel[o.status]||o.status)+'</span>'
                  +'</div></div></div>';
              }).join('')+'</div>':'');
        });
    }

    function paintProfile(){
      var el=document.getElementById('tdProfile'); if(!el) return;
      if(!tdData){ el.innerHTML='<div class="admin-empty">讀取失敗</div>'; return; }
      var t=tdData;
      el.innerHTML='<div class="acct-sec"><h3>老師資料</h3>'
        +'<div class="acct-row"><div><div class="k">名稱</div><div class="v">'+esc(t.display_name||'')+'</div></div></div>'
        +'<div class="acct-row"><div><div class="k">專長</div><div class="v">'+esc((t.tags||[]).join('・'))+'</div></div></div>'
        +'<div class="acct-row"><div><div class="k">上架狀態</div><div class="v">'+(t.is_active?'✓ 上架中（客戶看得到）':'已下架')+'</div></div>'
        +'<button class="btn" id="tdToggle" type="button">'+(t.is_active?'暫時下架':'重新上架')+'</button></div>'
        +'</div>';
      document.getElementById('tdToggle').addEventListener('click',function(){
        var btn=this; btn.disabled=true;
        var newVal=!tdData.is_active;
        window.DopaSupabase.from('teachers').update({is_active:newVal}).eq('id',_uid())
          .then(function(res){
            if(res.error){ btn.disabled=false; toast('操作失敗'); return; }
            tdData.is_active=newVal;
            toast(newVal?'已上架':'已下架'); paintProfile();
            // 同步更新老師市集列表
            window.DopaSupabase.from('teachers').select('id,display_name,tags,bio,about,plans,sla,rating,review_count,price_from').eq('is_active',true).order('created_at')
              .then(function(r2){
                if(!r2.error&&r2.data){
                  TEACHERS=r2.data.map(function(tt){
                    var plans=(tt.plans||[]).map(function(p,i){return {id:p.id||('p'+(i+1)),name:p.name||'方案',desc:p.desc||p.description||'',price:p.price||0,unit:p.unit||''};});
                    if(!plans.length) plans=[{id:'p1',name:'基礎解讀',desc:'',price:tt.price_from||500,unit:'錄音'}];
                    return {id:tt.id,name:tt.display_name||'老師',tags:tt.tags||[],
                      rate:String(parseFloat(tt.rating||5).toFixed(1)),cnt:tt.review_count||0,
                      sla:tt.sla||'7 個工作天',bio:tt.bio||'',
                      about:Array.isArray(tt.about)?tt.about:(tt.about?[tt.about]:[]),
                      plans:plans,reviews:[]};
                  });
                  renderTeacherList();
                }
              });
          });
      });
    }

    function switchMainTab(tab){
      tdMain=tab;
      document.querySelectorAll('#tdTabs .admin-tab').forEach(function(b){
        b.classList.toggle('on',b.getAttribute('data-tab')===tab);
      });
      ['td-orders','td-earnings','td-profile'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.style.display=(id===tab)?'':'none';
      });
      if(tab==='td-earnings') paintEarnings();
      else if(tab==='td-orders') switchOrderSub(tdSub);
      else if(tab==='td-profile') paintProfile();
    }

    function switchOrderSub(sub){
      tdSub=sub;
      [].forEach.call(document.querySelectorAll('#tdOrderTabs [data-tsub]'),function(b){
        b.classList.toggle('on',b.getAttribute('data-tsub')===sub);
      });
      var el=document.getElementById('tdOrderList'); if(el) el.innerHTML='<div class="admin-empty">載入中⋯</div>';
      loadOrders(sub).then(function(orders){ paintOrders(orders,sub); });
      updateCounts();
    }

    var tdTabsEl=document.getElementById('tdTabs');
    if(tdTabsEl) tdTabsEl.addEventListener('click',function(e){
      var b=e.target.closest('.admin-tab'); if(!b) return;
      switchMainTab(b.getAttribute('data-tab'));
    });
    var tdOrdTabsEl=document.getElementById('tdOrderTabs');
    if(tdOrdTabsEl) tdOrdTabsEl.addEventListener('click',function(e){
      var b=e.target.closest('[data-tsub]'); if(!b) return;
      switchOrderSub(b.getAttribute('data-tsub'));
    });

    function refresh(){
      var auth=window.DopaAuth;
      if(!auth||!auth.isIn||!auth.isIn()){ go('account'); return; }
      loadTeacherData().then(function(t){
        if(!t){ go('account'); toast('需要老師帳號才能進入後台'); return; }
        switchMainTab(tdMain);
      });
    }

    return { refresh:refresh };
  })();

})();
