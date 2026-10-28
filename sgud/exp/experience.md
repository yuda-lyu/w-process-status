# 經驗

本檔記執行時之累積經驗,留給後續嘗試、執行、判斷.

## 外部執行檔改造(bin-procstat,2026-10-28)

- **UMD 主檔不可改為具名匯出**:`main` 為 `dist/w-process-status.umd.js`(rollup UMD,`module.exports = 函數`).為了「匯出 `ensureBins()`」若在 `WProcessStatus.mjs` 加具名 `export { ensureBins }`,rollup 會改輸出 `exports.default`/`exports.ensureBins`,`require('w-process-status')` 之既有用法即壞.作法:`src/ensureBins.mjs` 預設匯出,並於函數上掛 `WProcessStatus.ensureBins`.
- **UMD 內之 `import.meta.url`**:rollup 3.29.5 於 UMD 輸出換為 `require('url').pathToFileURL(__filename).href`,故 `src/ensureBins.mjs` 以 `import.meta.url` 推套件根在 `dist/` 載入時亦正確(`dist/` 與 `src/` 同為套件根之下一層).驗證法:於 `./tmp` 另建 `dist`(不動 repo 之 `dist/`),組一個只含 `dist/*.umd.js` 與 `bin/manifest.json` 之假套件,離線無快取時看錯誤訊息之應放路徑是否為 `<假套件>/bin-cache/…`,再以本地鏡像實跑 `WProcessStatus`.另須把 `url`、`crypto`、`stream`、`stream/promises` 列入 `gDistRollup.mjs` 之 external 與 globals,否則建置有「guessing」警告.
- **測試之外網與落點**:`WProcessStatus.test.mjs` 原直接用 `src/processStatus.exe`,改造後取得會連 GitHub,須於 `before` 設 `W_BIN_CACHE`、`W_BIN_MIRROR`(本地資料夾,結構 `<鏡像>/w-process-status/<sha256>/processStatus.exe`)、`W_BIN_OFFLINE=1` 並於 `after` 還原環境與刪夾具.
- **`npm pack --dry-run` 與平行測試**:mocha `--parallel` 時他檔於 `test/_tmp/` 放之 exe 副本會被打包而使 T1 偶發失敗,故 `.npmignore` 須有 `test/_tmp`,且 T1 測試先放探針檔 `test/_tmp/binManifest/probe.exe` 確保此規則真有被檢查.
- **npm 12 `npm i` 副作用**:`npm i wsemi@1.9.27` 會把 `package-lock.json` 之 `resolved` 欄全部移除(Verdaccio 環境)、補 `package.json` 檔尾換行、並把鎖檔 root 之 version 同步為 package.json 之 1.0.27;非本輪所改,屬 npm 行為.移除 `postinstall` 後 root 之 `hasInstallScript` 須一併由鎖檔移除.
- **等測試鎖**:`quiet-run --lock` 於他套件持鎖時會等數分鐘(本輪第一次等 4 分鐘);把等待中之背景指令與「不影響該測試之文件撰寫」並行,但不可在等鎖期間改動會影響該次測試之 src.
