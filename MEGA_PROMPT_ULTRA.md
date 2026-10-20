# ⚡ 台灣颱風假機率平台 —「超極致炫炮版 (Hyper-Visual Atmospheric Command OS)」頂級 Mega Prompt

> [!IMPORTANT]
> 本規格書專為打造**行星級氣象戰情指揮中心 (Planetary Weather Command Center / Sci-Fi FUI)** 所設計，結合 HDR 加色混合流場粒子、多層次差速氣旋雲帶、眼牆閃電模擬、全息玻璃擬態 (Holographic Glassmorphism) 與 3D 視差光影互動卡片。

---

## 📋 頂級 Mega Prompt（可直接複製使用）

```markdown
done means: 在保留原有莫蘭地極簡版的同時，產出一個可一鍵切換、具備行星級氣象戰情室視覺水準的「超極致炫炮版 (Hyper-Visual Atmospheric Command OS)」(`ultra.html`)，支援部署於 GitHub Pages，串接中央氣象署最新颱風（第 29 號強烈颱風薔琵 CHAMPI）動態資料，並實作 HDR 發光風場粒子、多層次差速螺旋雲帶、眼牆閃電特效、全息雷達掃描與 3D 光影互動儀表板。

# Role & Aesthetic Direction (角色設定與視覺美學定調)
你是一位世界頂尖的 Creative Technologist、WebGL/Canvas 視覺特效架構師與 Sci-Fi FUI (Fantasy User Interface) 設計師，作品融合 Windy.com 高階氣象流場、NASA 地球觀測儀表板與 Palantir 全息戰情系統美學。
核心視覺語言：**深海黑曜石底色 (`#020611`) + HDR 雙色霓虹加色混合 (Electric Cyan `#00f2fe` / Supernova Crimson `#ff2a5f` / Solar Amber `#fbbf24` / Plasma Violet `#a855f7`) + 全息毛玻璃 (`backdrop-filter: blur(20px)`) + 游標跟隨聚光燈與 3D 視差傾斜卡片**。

# 1. 多重渲染通道 Canvas 颱風動態特效引擎 (`src/ultra-renderer.js`)
1. **Pass 1 — 深海測深網格與極座標雷達掃描 (Tactical Polar Radar Sweep)**：
   - 繪製經緯度戰術格線、以台灣為中心的同心距離警戒環（100km / 200km / 300km）與即時旋轉雷達掃描光束 (Radar Sweep Beam)。
2. **Pass 2 — 四層高度差速氣旋雲系與眼牆閃電脈衝 (Multi-Octave Cyclone & Lightning FX)**：
   - 透過離屏程序化合成技術建立高空輻散卷雲、中層對數螺旋雨帶、低層強對流雲牆與清晰颱風眼。
   - 使用 `globalCompositeOperation = 'screen'` 與 `'lighter'` 加色混合，內圈眼牆與外圍螺旋雨帶以不同角速度逆時針旋轉。
   - **眼牆閃電模擬 (Procedural Eyewall Lightning)**：於十級暴風圈強對流區內隨機觸發分岔閃電電弧與瞬時局部曝光光暈。
3. **Pass 3 — 1,600+ 顆 HDR 生物發光風場粒子 (HDR Bioluminescent Wind Streamlines)**：
   - 採用雙緩衝殘影畫布與 Rankine 氣旋向心渦旋物理模型，粒子色彩隨局部風速動態漸變（微風青藍 → 強風翠綠 → 烈風琥珀金 → 暴風眼牆熾熱紫紅），呈現流體力學級絲滑光軌。
4. **Pass 4 — 3D 立體發光台灣地圖與全息準星鎖定 (3D Extruded Taiwan & Target Reticle)**：
   - 台灣本島具備立體厚度投影與海岸線霓虹邊緣光 (Rim Light)，22 縣市依放假機率動態發光著色。
   - 選中縣市觸發聲納脈衝波紋與旋轉全息鎖定準星 (`[ LOCKED ]`)。
5. **Pass 5 — 旋轉刻度暴風圈與 70% 潛勢預測光錐**：
   - 七級暴風圈配備 360° 旋轉戰術羅盤刻度環；十級暴風圈配備高頻警示脈衝環；未來路徑節點以發光軌跡與潛勢光錐串聯。

# 2. 極致 UI/UX 互動體驗 (`ultra.html`, `src/ultra.css`, `src/ultra-app.js`)
1. **游標跟隨聚光燈與 3D 視差傾斜面板 (3D Tilt & Cursor Spotlight Cards)**：
   - 縣市深度剖析卡隨滑鼠移動產生即時 3D 透視傾斜 (`perspective(900px) rotateX/Y`) 與動態高光反射 (`radial-gradient` 聚光燈)。
2. **雙環電漿機率儀表與光譜達標條 (Dual-Arc Plasma Gauge & Spectrum Meters)**：
   - 採用雙層反向旋轉 SVG 戰術環與動態發光漸層進度弧，數字具備高幀率物理緩動跳動特效。
   - 風力（平均風／陣風）與 24h 累積雨量（平地／山區）配備發光能量格與法規門檻雷射標線。
3. **時間軸曲速控制器與雙版本無縫切換**：
   - 支援播放／暫停、`1x` / `2x` / `4x` 倍速曲速預覽、鍵盤快捷鍵 (`Space`, `←`, `→`)。
   - 頂部導航列內建 **「⚡ 極致炫炮版」與「🌿 莫蘭地極簡版」一鍵切換器**，讓使用者自由切換兩種截然不同的頂級視覺風格。
```
