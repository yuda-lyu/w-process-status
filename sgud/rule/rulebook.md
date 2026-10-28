# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試有哪些,包含軸、單一擁有者、已知限制、變更紀錄,以及對應之測試檔案或指令,由 agent 自行編列、擴充與維護.

## R-BIN-EXE-01 外部執行檔 processStatus.exe 之存放、取得、校驗與離線一律依制式規格(B 類,釘選模式)

- 依據: 制式規格 `C:\opensrcOper\dspec\外部執行檔之存放下載校驗與離線.md`(使用者 2026-10-28 裁示;以下「規格」皆指此檔,條號 S/M/D/O/E/T 為其條號);主控帳本 G10 列本套件為 B 類(舊制:自主幹直連 `src/processStatus.exe`,無校驗);主控任務 20261028054319 之 bin-procstat.**規格為上游真理源,本條只記本套件須長成什麼樣**;與規格不一致時以規格為準並回報主控.
- 單一擁有者: 取得一律經 `src/ensureBins.mjs`(轉呼叫 wsemi `fsEnsureBins`,`pkgRoot` 固定為本套件根,不轉傳 `floatingManifestUrl`);`src/autoDownloadFiles.mjs` 為既有對外介面(回 `{ fpExe }`,其他套件可能依賴),內部只呼叫 `ensureBins({ names: 'processStatus.exe' })`.**套件端不得自寫下載、快取、鏡像、校驗**(E2).
- 規則:
  1. 清單 `bin/manifest.json`(`mode: "pinned"`、`commit` 為含 `bin/` 實檔之提交)一律由 `toolg/genBinManifest.mjs --commit <40 碼>` 依實檔產生,不手寫 sha256(M1);更新流程見規格 U1(替換 `bin/` 內檔 → 提交並推 GitHub → 產生清單 → 測試 → 發布新版).
  2. `bin/processStatus.exe` 入 git、不入 npm 包;npm 包 `bin/` 下只有 `bin/manifest.json`(S1):`.npmignore` 為 `/bin/*`、`!/bin/manifest.json`、`/bin-cache/`、`test/_tmp`、`sgud`、`src/processStatus.exe`;`.gitignore` 含 `/bin-cache/`;`.gitattributes` 為 `bin/** binary`(M1 補充 F12).
  3. 舊版相容(S2):舊版於執行時自主幹 `src/processStatus.exe` 下載,故該檔**保留於 repo**(與 `bin/processStatus.exe` 位元相同,測試比對),不入 npm 包,至舊版淘汰後另案移除.
  4. 首次使用時下載(D1);**不得**有 `postinstall`/`install`/`preinstall`(已刪 `scripts/install.mjs` 與 `src/downloadFiles.mjs`).
  5. 離線與內網依規格 O1~O5:`W_BIN_CACHE`、`W_BIN_MIRROR`、`W_BIN_OFFLINE` 由 wsemi 統一讀取;README〈外部執行檔〉為對使用者之說明(O5).
  6. `ensureBins` 匯出為 `src/ensureBins.mjs` 之預設匯出,並掛於 `WProcessStatus.ensureBins`(主檔 UMD 為 `module.exports = 函數`,不可改為具名匯出,否則破壞 `require('w-process-status')` 之既有用法).
  7. UMD 建置(`toolg/gDistRollup.mjs`)須把 `url`、`crypto`、`stream`、`stream/promises` 列為 external 與 globals;套件根以 `import.meta.url` 推得,rollup 於 UMD 輸出會換為 `__filename` 之 file URL,故 `dist/` 與 `src/` 皆須位於套件根之下一層.
- 盤點指令: Grep `src/` 搜 `fsDownloadFile|fetch\(|raw/refs/heads|github\.com`(應無命中);`node C:/opensrcOper/tools/scan-bins.mjs --only w-process-status`(應為 OK);`npm pack --dry-run`(`bin/` 下只見 `bin/manifest.json`).
- 站點全集與判準(2026-10-28): `src/` 之下載站點原有 1 處(`src/downloadFiles.mjs` 之 `fsDownloadFile` 直連主幹,已刪)、`scripts/install.mjs`(postinstall,已刪);現僅 `src/ensureBins.mjs` 一處取得入口(其餘 `src/autoDownloadFiles.mjs`、`src/WProcessStatus.mjs` 經它).
- 已知限制: ①快取夾(`<套件根>/bin-cache/<sha256>/`)亦是執行時暫存 json(`_<id>_fpIn.json`、`_<id>_fpOut.json`)之落點(沿舊制「exe 所在夾」),故快取夾須可寫;②信任假設同規格 D6(能寫入快取夾者可信);③舊版(發布前之版本)不經清單、不校驗,至淘汰後移除 `src/processStatus.exe`;④`autoDownloadFiles()` 失敗時 reject 由字串 `'can not find processStatus.exe'` 改為帶 `code` 之 Error(E_OFFLINE_MISSING、E_HASH_MISMATCH 等).
- 測試: `test/unit-binManifest.test.mjs`(M1/M2/M4、T1、S2 舊路徑檔位元相同、D1/E2 無自寫下載與 postinstall)、`test/unit-ensureBins.test.mjs`(T3~T7,本機 HTTP 127.0.0.1:8861 扮 GitHub、本地資料夾扮鏡像,不連外網;含環境變數、預設快取位置、`autoDownloadFiles` 介面)、`test/WProcessStatus.test.mjs`(既有功能,以本機鏡像離線供檔).T8(主幹模式)不適用.夾具 `test/_tmp/<案名>/`,after 刪除.指令: `npm test`;單檔 `npx mocha --no-parallel test/unit-binManifest.test.mjs test/unit-ensureBins.test.mjs test/WProcessStatus.test.mjs --timeout 180000`.
- 變更紀錄: 2026-10-28 依規格改造(bin-procstat):新增 `bin/manifest.json`、`src/ensureBins.mjs`、`toolg/genBinManifest.mjs`、`test/unit-*.test.mjs`,刪 `src/downloadFiles.mjs`、`scripts/install.mjs`、`postinstall`.
