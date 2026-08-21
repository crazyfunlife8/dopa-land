# -*- coding: utf-8 -*-
"""多巴樂園：把 _template.html 的圖片佔位注入為 data-img + IMG map，產生 index.html。
頁首/LOGO/圖示沿用舊 index.html 的 base64（沒變），只換五隻巴巴。"""
import base64, json, re, pathlib, sys

base = pathlib.Path(r"C:\Users\user-66698\Desktop\Claude\采潔\人類圖網站")

# 1) 從舊 index.html 抽出現有 IMG map（保留 LOGO/HERO/ICON 不變）
old_html = (base / "index.html").read_text(encoding="utf-8")
m = re.search(r"var IMG=(\{.*?\});", old_html, re.S)
if not m:
    sys.exit("ERROR: 舊 index.html 找不到 var IMG={...};")
old_map = json.loads(m.group(1))
print("舊 IMG keys:", sorted(old_map.keys()))
for k in ("LOGO", "HERO", "IC1", "IC2", "IC3"):
    if k not in old_map:
        sys.exit(f"ERROR: 舊 IMG map 缺 key {k}")

# 2) 五隻巴巴 → 新 base64 data URI
def datauri(rel):
    p = base / rel
    ext = p.suffix.lower()
    mime = {".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".jpeg":"image/jpeg",".apng":"image/apng"}.get(ext, "image/png")
    b = base64.b64encode(p.read_bytes()).decode("ascii")
    return "data:%s;base64,%s" % (mime, b)

mascots = {
    "A":  "IP/IP_阿衝.png",   # 顯示者
    "G":  "IP/IP_阿亨.png",   # 生產者
    "MG": "IP/IP_生生.png",   # 顯示生產者
    "P":  "IP/IP_小么.png",   # 投射者
    "R":  "IP/IP_月月.png",   # 反映者
}
for key, rel in mascots.items():
    if not (base / rel).exists():
        sys.exit(f"ERROR: 找不到巴巴圖 {rel}")

# 大廳島嶼地圖基底（LNG1-4 hover 疊圖已改用設施動畫，不再內嵌）
lounge = {
    "LNG0": "大廳/大廳_v3_空.png",  # 空圓台地圖基底（256色PNG——ffmpeg 轉的 WebP 版會觸發沙盒解碼崩潰，PNG 路徑實證安全）
}
for key, rel in lounge.items():
    if not (base / rel).exists():
        sys.exit(f"ERROR: 找不到大廳圖 {rel}")

# 大廳設施動畫（Kling 生成 → 綠幕去背 → APNG 帶 alpha、無限循環）
# 用 APNG 不用動畫 WebP：動畫 WebP 在 Artifact 沙盒會直接弄崩 renderer（掛載即凍死→iframe 重載），APNG 走 PNG 解碼路徑
anims = {
    "ANC": "大廳/動畫/木馬.apng",     # 旋轉木馬(小么)
    "ANF": "大廳/動畫/摩天輪.apng",   # 摩天輪(月月生生)
    "ANR": "大廳/動畫/雲霄飛車.apng", # 雲霄飛車(阿衝)
    "ANT": "大廳/動畫/咖啡杯.apng",   # 旋轉咖啡杯(阿亨)
}
for key, rel in anims.items():
    if not (base / rel).exists():
        sys.exit(f"ERROR: 找不到動畫 {rel}")

new_map = {
    "LOGO": old_map["LOGO"], "HERO": datauri("頁首/hero_1280.webp"),  # 五寶去背+瘦身 WebP(~237KB)
    "IC1": old_map["IC1"], "IC2": old_map["IC2"], "IC3": old_map["IC3"],
}
for key, rel in mascots.items():
    new_map[key] = datauri(rel)
for key, rel in lounge.items():
    new_map[key] = datauri(rel)
for key, rel in anims.items():
    new_map[key] = datauri(rel)

# 3) 讀模板，做 src="__TOKEN__" -> data-img="KEY" 轉換，注入 IMG map
tpl = (base / "_template.html").read_text(encoding="utf-8")
tok2key = {
    "__LOGO__": "LOGO", "__HERO__": "HERO",
    "__ICON1__": "IC1", "__ICON2__": "IC2", "__ICON3__": "IC3",
    "__IP_A__": "A", "__IP_G__": "G", "__IP_MG__": "MG",
    "__IP_P__": "P", "__IP_R__": "R",
    "__LOUNGE0__": "LNG0", "__LOUNGE1__": "LNG1", "__LOUNGE2__": "LNG2",
    "__LOUNGE3__": "LNG3", "__LOUNGE4__": "LNG4",
    "__ANIM_CAR__": "ANC", "__ANIM_FER__": "ANF",
    "__ANIM_COA__": "ANR", "__ANIM_CUP__": "ANT",
}
for tok, key in tok2key.items():
    tpl = tpl.replace('src="%s"' % tok, 'data-img="%s"' % key)

tpl = tpl.replace("__IMGMAP__", json.dumps(new_map, ensure_ascii=False))

# 4) 殘留檢查（在內嵌引擎「之前」做，避免 min.js 內容誤觸 __X__ 檢查）
leftover = re.findall(r"__[A-Z0-9_]+__", tpl)
if leftover:
    sys.exit(f"ERROR: 還有未替換的佔位: {set(leftover)}")

# 5) 內嵌計算核心（astronomy + hd-engine）→ 保持單檔
core = base / "計算核心"
for marker, fname in (("/*ENGINE_ASTRONOMY*/", "astronomy.browser.min.js"),
                      ("/*ENGINE_HDENGINE*/", "hd-engine.js"),
                      ("/*ENGINE_HDCONTENT*/", "hd-content.js")):
    if marker not in tpl:
        sys.exit(f"ERROR: 模板缺少引擎佔位 {marker}")
    js = (core / fname).read_text(encoding="utf-8")
    tpl = tpl.replace(marker, js)
    print(f"內嵌 {fname}: {len(js)} chars")

(base / "index.html").write_text(tpl, encoding="utf-8")
out_bytes = (base / "index.html").stat().st_size
print("OK 產生 index.html:", out_bytes, "bytes")
print("新 IMG keys:", sorted(new_map.keys()))
