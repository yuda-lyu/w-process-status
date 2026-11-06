# 狀態

本檔記 w-process-status 各功能之**現況**(做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證之版本);只記現況、不寫過程(過程見 `sgud/exp/experience.md`).

本檔 2026-10-28 新建.

## 列出程序狀態 `WProcessStatus`

- 現況: 已實作(僅 Windows):以 `processStatus.exe`(PyInstaller 建置,原始碼 `srcPython/`)列出指定程序名稱之 pid、ram、username、status,以及 `exe`(執行檔路徑,無權限或無路徑為 `null`)、`ppid`(父行程 pid,取不到 `null`)、`parentAlive`(`true` 存活;`false` 父行程已結束或其 pid 已被重用;`null` 無法判定或本無父行程——使用端只有 `false` 才當孤兒)(Gitea #55,2026-11-03 pr55,package.json version 1.0.34;執行檔於 pr55b 改以 Python 3.13 重建,待發布 1.0.35).`WProcessStatus(name, opt)` 收 `opt.timeout`(毫秒,逾時結束執行檔行程樹並 reject `timeout[Nms]`,未給或非預期視為不限時);執行檔內部失敗時 reject 訊息帶 `state`(整理後至多 200 字元,`src/fmtState.mjs`).`src/WProcessStatus.mjs` 為主檔(UMD `dist/w-process-status.umd.js` 為 `module.exports = 函數`).規則: R-PS-LIST-01.
- 測試: `test/WProcessStatus.test.mjs`(以本機鏡像離線供檔,不連外網;子行程、孤兒、System 與 System Idle Process、`opt.timeout`、`state`、`fmtState` 單元).
- 執行檔建置環境(pr55b,2026-11-03): **Python 3.13.17**(python.org 官方 NuGet 套件 `python`,2026-10-21 發布;python.org 稱其為 3.13 系列「特例附 Windows 安裝檔」之安全版,其後 3.13.x 僅發原始碼)、PyInstaller 6.22.3、psutil 7.2.2(venv 於 `./tmp`,不動全域 Python).選 3.13 之理由(使用者 2026-11-03 裁示):業主部署含 Windows Server 2016,3.13 官方文件載明支援 Windows 8.1 以上,3.14 載明 Windows 10 以上、對 Server 2016 不明確;只建此一種執行檔,不做雙版本或自動降級;3.13 安全修補維護至 2029-10,屆時再評估(R-BIN-EXE-01 規則 8).`bin/processStatus.exe` = `src/processStatus.exe`,sha256 `8faa78536f9cd06242c76dfd8cf199f955307dad286b5d6a8cfb1a4b9aa4875d`、7,824,932 位元組(1.0.34: `2f4f2ae5…`、8,681,283,Python 3.14.3 建置;1.0.33: `3e9dd65b…`、7,609,728,Python 3.11 建置).
- 驗證(pr55b,2026-11-03): 打包內容只含 `python313.dll`,實跑解出之 `_MEI*/python313.dll` 與官方包位元相同;Defender 即時保護開啟下實跑多次無新增偵測,`MpCmdRun -Scan -ScanType 3` 掃描 `bin/`、`src/` 兩檔皆無威脅(僅限本機);查詢耗時與 1.0.34 執行檔比(各 5 次中位數,兩輪,本機當時有他人負載,單次 1.1～2.5 秒): `node.exe` 新 1272／1401 對舊 1219／1366 ms(差 +53／+35);`svchost.exe`(93 筆)新 1693／1833 對舊 1673／1878 ms(差 +20／−45),皆在雜訊內;`opt.timeout` 逾時殘留 `_MEI*` 之限制仍在(逾時 1、300、500 ms 各留一個 14.1～14.8 MB,正常結束不留);`test/WProcessStatus.test.mjs` 14 passing(連跑 3 次 0 次失敗);`srcPython` 語意檢查 22／22(比對 307 個行程與 `Process.parent()` 等價);`npm test` 39 passing／1 failing(僅 pinned commit 案,待兩步提交);程式未改,故 pr55 之變異結論(JS 側 9／9 轉紅,Python 側 11 項中 7 項由 JS 測試抓到、4 項僅 Python 層 `semantics.py` 抓到)仍適用.細節見 pr55、pr55b 報告.
- 待辦(pr55b): ①**主控兩步提交**: 先提交 `bin/processStatus.exe`、`src/processStatus.exe` 等,再 `node toolg/genBinManifest.mjs --commit <該提交>` 更新清單 `commit` 欄,再提交;此前 `test/unit-binManifest.test.mjs` 之 pinned commit 案(M2、U1)為紅(其餘綠).②發布 1.0.35 後使用端改用新欄位(`dist/`、`docs/` 由發布流程產製).③逾時殘留之 `_MEI*` 解壓夾(R-PS-LIST-01 已知限制①)是否要徹底解決(onedir 等)待裁示.④2029-10 前後評估是否改用較新 Python 重建(R-BIN-EXE-01 規則 8).

## 外部執行檔 processStatus.exe 之取得(R-BIN-EXE-01)

- 現況: 已依制式規格 `外部執行檔之存放下載校驗與離線.md`(dspec)改造為 B 類釘選模式(bin-procstat,2026-10-28;package.json version 1.0.27 之工作樹,未發布):`bin/manifest.json`(commit `38dd758fb0aca5f811fee5b26a56f47386a3d600`)、`src/ensureBins.mjs`(轉呼叫 wsemi 1.9.27 `fsEnsureBins`)、`toolg/genBinManifest.mjs`;`src/autoDownloadFiles.mjs` 保留對外介面(回 `{ fpExe }`)改經 `ensureBins`;`WProcessStatus.ensureBins` 供部署前預先取得;README〈外部執行檔〉已寫.已刪 `src/downloadFiles.mjs`、`scripts/install.mjs` 與 `postinstall`;`src/processStatus.exe` 保留於 repo(舊版相容 S2,不入 npm 包).
- 規則: `sgud/rule/rulebook.md` R-BIN-EXE-01.
- 測試: `test/unit-binManifest.test.mjs`(T1、T2、S2、D1/E2)、`test/unit-ensureBins.test.mjs`(T3~T7、環境變數、預設快取、`autoDownloadFiles`;本機 HTTP 127.0.0.1:8861)、`test/WProcessStatus.test.mjs`.T8 不適用(非主幹模式).
- 驗證(bin-procstat,2026-10-28 最終碼): 修前紅(`bin/manifest.json` 缺、`src/ensureBins.mjs` 缺、`npm pack` 含 `bin/processStatus.exe`、`downloadFiles.mjs`/`install.mjs`/`postinstall` 仍在)、修後 `npm test` 3 檔 26 passing、0 failing;變異 18 項(清單、`.npmignore`、`ensureBins`、`autoDownloadFiles`、`postinstall`、自寫下載、匯出)全被抓(首輪 15 紅、存活之 3 項為測試之缺口——釘選提交只與清單自身比、`autoDownloadFiles` 之測試可悄悄連上真 GitHub、匯出無案——補測試後 3/3 紅);重建 UMD(於 `./tmp`)載入並經本地鏡像實跑成功;另以真 GitHub 單次冒煙(非測試套件)確認釘選提交網址回傳之位元與清單 sha256 相符.未經第三方外審(本輪未列外審).細節見主控任務 20261028054319 `agent-out/bin-procstat-修正報告.md`.
- npm 包檢查(2026-11-02,pk-process-status): `test/unit-binManifest.test.mjs` 之打包檢查已改為 dspec `自有套件之npm發布範圍.md` 原則 2〈套件測試之 npm 包檢查〉口徑——不得入包只列執行檔/壓縮檔、`bin/` 除 manifest 外之檔、`CLAUDE*.md`、`tmp/`、`test/_tmp/`、`.env`;`sgud/` 三檔、`main`、`src/*.mjs` 須隨包;未設大小上限(執行期 `src/`+`dist/`+`bin/` 合計 280,208 B).`.npmignore` 首段為 `.gitignore` 之抄錄,其後僅第 1 條排除項(`src/processStatus.exe`、`/bin/*`、`!/bin/manifest.json`)並加註,不排除 `sgud/`;打包 75 檔(`sgud/` 3 檔).`npm test` 3 檔 27 passing、0 failing.
- 待辦: 主控發布新版(含 `dist` 重建);舊版淘汰後移除 `src/processStatus.exe`(另案).
- 已知限制: 見 R-BIN-EXE-01〈已知限制〉.
