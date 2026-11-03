# 狀態

本檔記 w-process-status 各功能之**現況**(做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證之版本);只記現況、不寫過程(過程見 `sgud/exp/experience.md`).

本檔 2026-10-28 新建.

## 列出程序狀態 `WProcessStatus`

- 現況: 已實作(僅 Windows):以 `processStatus.exe`(PyInstaller 建置,原始碼 `srcPython/`)列出指定程序名稱之 pid、ram、username、status,以及 `exe`(執行檔路徑,無權限或無路徑為 `null`)、`ppid`(父行程 pid,取不到 `null`)、`parentAlive`(`true` 存活;`false` 父行程已結束或其 pid 已被重用;`null` 無法判定或本無父行程——使用端只有 `false` 才當孤兒)(Gitea #55,2026-11-03 pr55,package.json version 仍 1.0.33、工作樹未發布).`WProcessStatus(name, opt)` 收 `opt.timeout`(毫秒,逾時結束執行檔行程樹並 reject `timeout[Nms]`,未給或非預期視為不限時);執行檔內部失敗時 reject 訊息帶 `state`(整理後至多 200 字元,`src/fmtState.mjs`).`src/WProcessStatus.mjs` 為主檔(UMD `dist/w-process-status.umd.js` 為 `module.exports = 函數`).規則: R-PS-LIST-01.
- 測試: `test/WProcessStatus.test.mjs`(以本機鏡像離線供檔,不連外網;子行程、孤兒、System 與 System Idle Process、`opt.timeout`、`state`、`fmtState` 單元).
- 驗證(pr55,2026-11-03): 工具鏈 Python 3.14.3、PyInstaller 6.22.3、psutil 7.2.2(venv 於 `./tmp`);新執行檔 `bin/processStatus.exe` = `src/processStatus.exe`,sha256 `2f4f2ae5dbe63abb3c92a460374f70cc80b34aa2f677ae2540c8c4be2d204759`、8,681,283 位元組(舊 `3e9dd65b…`、7,609,728);Defender 即時保護開啟下實跑多次無新增偵測,`MpCmdRun -Scan -ScanType 3` 掃描無威脅(僅限本機);查詢耗時與同工具鏈舊檔比(各 5 次中位數,兩輪): `node.exe`(5 筆)新 764／770 對舊 768／791 ms(差 −21～−3 ms);`svchost.exe`(93～95 筆,服務行程建立時間走慢路徑)新 1017／1003 對舊 950／824 ms(多 67～179 ms);`chrome.exe` 當時未執行,無量測.修前紅: 以舊碼＋舊執行檔跑新測試 3 passing／8 failing(3 案為不變行為之對照);修後 `test/WProcessStatus.test.mjs` 14 passing(連跑 8 次 0 次失敗);`npm test` 39 passing／1 failing(僅 pinned commit 案,待兩步提交);變異: JS 側 9／9 轉紅,Python 側 11 項中 7 項由 JS 測試抓到、4 項(P3 比較式恆 true、P7a／P7b 例外回 false、P8 邊界)僅 Python 層 `semantics.py` 抓到(JS 無自然觸發);另 UMD 試建(tmp)可 `require`、`WProcessStatus.ensureBins` 在、查詢與逾時正常.細節見 pr55 報告.
- 待辦(pr55): ①**主控兩步提交**: 先提交 `bin/processStatus.exe`、`src/processStatus.exe` 等,再 `node toolg/genBinManifest.mjs --commit <該提交>` 更新清單 `commit` 欄,再提交;此前 `test/unit-binManifest.test.mjs` 之 pinned commit 案(M2、U1)為紅(其餘綠).②發布新版後 liqproc 改用新欄位(`dist/`、`docs/` 由發布流程產製).③逾時殘留之 `_MEI*` 解壓夾(R-PS-LIST-01 已知限制①)是否要徹底解決(onedir 等)待裁示.

## 外部執行檔 processStatus.exe 之取得(R-BIN-EXE-01)

- 現況: 已依制式規格 `外部執行檔之存放下載校驗與離線.md`(dspec)改造為 B 類釘選模式(bin-procstat,2026-10-28;package.json version 1.0.27 之工作樹,未發布):`bin/manifest.json`(commit `38dd758fb0aca5f811fee5b26a56f47386a3d600`)、`src/ensureBins.mjs`(轉呼叫 wsemi 1.9.27 `fsEnsureBins`)、`toolg/genBinManifest.mjs`;`src/autoDownloadFiles.mjs` 保留對外介面(回 `{ fpExe }`)改經 `ensureBins`;`WProcessStatus.ensureBins` 供部署前預先取得;README〈外部執行檔〉已寫.已刪 `src/downloadFiles.mjs`、`scripts/install.mjs` 與 `postinstall`;`src/processStatus.exe` 保留於 repo(舊版相容 S2,不入 npm 包).
- 規則: `sgud/rule/rulebook.md` R-BIN-EXE-01.
- 測試: `test/unit-binManifest.test.mjs`(T1、T2、S2、D1/E2)、`test/unit-ensureBins.test.mjs`(T3~T7、環境變數、預設快取、`autoDownloadFiles`;本機 HTTP 127.0.0.1:8861)、`test/WProcessStatus.test.mjs`.T8 不適用(非主幹模式).
- 驗證(bin-procstat,2026-10-28 最終碼): 修前紅(`bin/manifest.json` 缺、`src/ensureBins.mjs` 缺、`npm pack` 含 `bin/processStatus.exe`、`downloadFiles.mjs`/`install.mjs`/`postinstall` 仍在)、修後 `npm test` 3 檔 26 passing、0 failing;變異 18 項(清單、`.npmignore`、`ensureBins`、`autoDownloadFiles`、`postinstall`、自寫下載、匯出)全被抓(首輪 15 紅、存活之 3 項為測試之缺口——釘選提交只與清單自身比、`autoDownloadFiles` 之測試可悄悄連上真 GitHub、匯出無案——補測試後 3/3 紅);重建 UMD(於 `./tmp`)載入並經本地鏡像實跑成功;另以真 GitHub 單次冒煙(非測試套件)確認釘選提交網址回傳之位元與清單 sha256 相符.未經第三方外審(本輪未列外審).細節見主控任務 20261028054319 `agent-out/bin-procstat-修正報告.md`.
- npm 包檢查(2026-11-02,pk-process-status): `test/unit-binManifest.test.mjs` 之打包檢查已改為 dspec `自有套件之npm發布範圍.md` 原則 2〈套件測試之 npm 包檢查〉口徑——不得入包只列執行檔/壓縮檔、`bin/` 除 manifest 外之檔、`CLAUDE*.md`、`tmp/`、`test/_tmp/`、`.env`;`sgud/` 三檔、`main`、`src/*.mjs` 須隨包;未設大小上限(執行期 `src/`+`dist/`+`bin/` 合計 280,208 B).`.npmignore` 首段為 `.gitignore` 之抄錄,其後僅第 1 條排除項(`src/processStatus.exe`、`/bin/*`、`!/bin/manifest.json`)並加註,不排除 `sgud/`;打包 75 檔(`sgud/` 3 檔).`npm test` 3 檔 27 passing、0 failing.
- 待辦: 主控發布新版(含 `dist` 重建);舊版淘汰後移除 `src/processStatus.exe`(另案).
- 已知限制: 見 R-BIN-EXE-01〈已知限制〉.
