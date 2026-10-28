# 狀態

本檔記 w-process-status 各功能之**現況**(做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證之版本);只記現況、不寫過程(過程見 `sgud/exp/experience.md`).

本檔 2026-10-28 新建.

## 列出程序狀態 `WProcessStatus`

- 現況: 已實作(僅 Windows):以 `processStatus.exe`(PyInstaller 建置,原始碼 `srcPython/`)列出指定程序名稱之 pid、ram、username、status.`src/WProcessStatus.mjs` 為主檔(UMD `dist/w-process-status.umd.js` 為 `module.exports = 函數`).
- 測試: `test/WProcessStatus.test.mjs`(以本機鏡像離線供檔,不連外網).

## 外部執行檔 processStatus.exe 之取得(R-BIN-EXE-01)

- 現況: 已依制式規格 `外部執行檔之存放下載校驗與離線.md`(dspec)改造為 B 類釘選模式(bin-procstat,2026-10-28;package.json version 1.0.27 之工作樹,未發布):`bin/manifest.json`(commit `38dd758fb0aca5f811fee5b26a56f47386a3d600`)、`src/ensureBins.mjs`(轉呼叫 wsemi 1.9.27 `fsEnsureBins`)、`toolg/genBinManifest.mjs`;`src/autoDownloadFiles.mjs` 保留對外介面(回 `{ fpExe }`)改經 `ensureBins`;`WProcessStatus.ensureBins` 供部署前預先取得;README〈外部執行檔〉已寫.已刪 `src/downloadFiles.mjs`、`scripts/install.mjs` 與 `postinstall`;`src/processStatus.exe` 保留於 repo(舊版相容 S2,不入 npm 包).
- 規則: `sgud/rule/rulebook.md` R-BIN-EXE-01.
- 測試: `test/unit-binManifest.test.mjs`(T1、T2、S2、D1/E2)、`test/unit-ensureBins.test.mjs`(T3~T7、環境變數、預設快取、`autoDownloadFiles`;本機 HTTP 127.0.0.1:8861)、`test/WProcessStatus.test.mjs`.T8 不適用(非主幹模式).
- 驗證(bin-procstat,2026-10-28 最終碼): 修前紅(`bin/manifest.json` 缺、`src/ensureBins.mjs` 缺、`npm pack` 含 `bin/processStatus.exe`、`downloadFiles.mjs`/`install.mjs`/`postinstall` 仍在)、修後 `npm test` 3 檔 26 passing、0 failing;變異 18 項(清單、`.npmignore`、`ensureBins`、`autoDownloadFiles`、`postinstall`、自寫下載、匯出)全被抓(首輪 15 紅、存活之 3 項為測試之缺口——釘選提交只與清單自身比、`autoDownloadFiles` 之測試可悄悄連上真 GitHub、匯出無案——補測試後 3/3 紅);重建 UMD(於 `./tmp`)載入並經本地鏡像實跑成功;另以真 GitHub 單次冒煙(非測試套件)確認釘選提交網址回傳之位元與清單 sha256 相符.未經第三方外審(本輪未列外審).細節見主控任務 20261028054319 `agent-out/bin-procstat-修正報告.md`.
- 待辦: 主控發布新版(含 `dist` 重建);舊版淘汰後移除 `src/processStatus.exe`(另案).
- 已知限制: 見 R-BIN-EXE-01〈已知限制〉.
