# w-process-status
A tool for processStatus.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-process-status.svg?style=flat)](https://npmjs.org/package/w-process-status) 
[![license](https://img.shields.io/npm/l/w-process-status.svg?style=flat)](https://npmjs.org/package/w-process-status) 
[![npm download](https://img.shields.io/npm/dt/w-process-status.svg)](https://npmjs.org/package/w-process-status) 
[![npm download](https://img.shields.io/npm/dm/w-process-status.svg)](https://npmjs.org/package/w-process-status) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-process-status.svg)](https://www.jsdelivr.com/package/npm/w-process-status)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-process-status/global.html).

## Core
> `w-process-status` is based on the `psutil` in `python`, and only run in `Windows`.

## Installation

### Using npm(ES6 module):
```alias
npm i w-process-status
```

## 外部執行檔

本套件執行時需要下列外部執行檔，不含於 npm 包：

| 檔名 | 用途 | 來源 |
|---|---|---|
| processStatus.exe | 列出指定程序名稱之 pid、記憶體、使用者、狀態、執行檔路徑與父行程(僅 Windows) | 本套件 GitHub repo 之 `bin/`(釘選提交，網址見 `bin/manifest.json`) |

- 首次使用到 `WProcessStatus` 時自動下載(或預先呼叫 `ensureBins()`)，以 `bin/manifest.json` 所載之 SHA-256 與大小校驗後存於 `<套件根>/bin-cache/<sha256>/`；之後自快取取得(亦校驗，不符即重新取得)。安裝時不下載。快取資料夾須可寫(下載與執行時之暫存 json 皆寫於此)。
- 環境變數：
  - `W_BIN_CACHE=<資料夾>`：快取改放 `<資料夾>/w-process-status/`(套件所在之 `node_modules` 唯讀時使用，多套件可共用同一資料夾)。
  - `W_BIN_MIRROR=<資料夾或 http(s) 網址>`：內網鏡像，先找鏡像再連 GitHub；結構為 `<鏡像>/w-process-status/<sha256>/processStatus.exe`。鏡像之檔同樣以清單校驗，不符即不用。
  - `W_BIN_OFFLINE=1`：不連網，只用快取與鏡像；缺檔時錯誤(`E_OFFLINE_MISSING`)會列出缺哪個檔、sha256、大小與應放之完整路徑。
- 離線部署：
  1. 在可連網之電腦設 `W_BIN_CACHE=<空資料夾>`，執行一次 `ensureBins()`(或使用到 `WProcessStatus` 一次)。
  2. 把該資料夾整個帶到內網電腦，設 `W_BIN_MIRROR=<該資料夾>`(全離線時另設 `W_BIN_OFFLINE=1`)。

```alias
import ensureBins from 'w-process-status/src/ensureBins.mjs'
//import WProcessStatus from 'w-process-status' => WProcessStatus.ensureBins 亦同

//部署前預先取得, resolve回傳{ 'processStatus.exe': 絕對路徑 }
let bins = await ensureBins()
console.log(bins)
```

## 回傳欄位與選項

`WProcessStatus(name, opt)` 回傳名稱為 `name` 之程序清單(名稱不分大小寫)，各項欄位如下：

| 欄位 | 內容 |
|---|---|
| `name`、`pid`、`ram`(KB)、`username`、`status` | 程序名稱、pid、記憶體、使用者、狀態(`running`、`stopped` 等) |
| `exe` | 執行檔路徑；無權限或無路徑(如 `System`)時為 `null` |
| `ppid` | 建立該程序之父行程 pid；無法取得時為 `null`。Windows 不會於父行程結束後更新 `ppid`，其所指行程可能已不存在，或 pid 已被其他行程重用 |
| `parentAlive` | 父行程是否存活：`true` 存活；`false` 父行程已結束，或其 pid 已被其他行程重用(比對 `ppid` 所指行程與本程序之建立時間，判定同 psutil 之 `Process.parent()`)；`null` 無法判定(查詢時發生例外，如無權限)，或本無父行程(`ppid` 為 0 或自身，如 `System`、`System Idle Process`) |

- 回收孤兒程序時，**只有 `parentAlive === false` 才可視為孤兒**，`null` 不可視為孤兒。建議再以 `exe` 限定自家執行檔路徑、必要時以 `status` 交叉確認後才處置。
- 建立時間取自系統時鐘，父子行程建立之間若系統時間被往回調整，存活之父行程可能被誤判為 `false`。
- `exe` 與 `parentAlive` 只對名稱相符之程序查詢，其值與呼叫當下之權限有關。
- `opt.timeout`(毫秒，預設不限時)：執行檔超過時限即關閉(含其子程序)並 reject `timeout[Nms]:...`。未給或非預期之輸入(0、負數、`Infinity`、`'10s'` 等非數字字串、`opt` 非物件)皆視為不限時。已知限制：逾時被強制結束時，PyInstaller 單檔執行檔之解壓夾(暫存夾下之 `_MEI*`，每次約 13～17 MB)不會自行清除，需由使用端或系統清理暫存夾。
- 執行檔內部失敗時，reject 訊息帶上其回報之 `state`，例如 `output[] is not an array, state[error: ...]`；`state` 來自外部程序輸出，經整理(遮憑證、控制字元換空白)並限制為最多 200 字元(超過接 `...`)。

#### Example 2D:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-process-status/blob/master/g-2d.mjs)]
```alias
import WProcessStatus from './src/WProcessStatus.mjs'
//import WProcessStatus from 'w-process-status/src/WProcessStatus.mjs'
//import WProcessStatus from 'w-process-status'

async function test() {

    let name = 'chrome.exe'

    let rs = await WProcessStatus(name)
    console.log('rs', rs)
    // rs => [
    //   {
    //     name: 'chrome.exe',
    //     pid: 400,
    //     ram: 169404,
    //     username: '{username}',
    //     status: 'running',
    //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    //     ppid: 5124,
    //     parentAlive: true
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 4984,
    //     ram: 211720,
    //     username: '{username}',
    //     status: 'running',
    //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    //     ppid: 400,
    //     parentAlive: true
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 11648,
    //     ram: 2300,
    //     username: '{username}',
    //     status: 'stopped',
    //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    //     ppid: 7740,
    //     parentAlive: false
    //   }
    //   ...
    // ]

    //只有parentAlive為false才視為孤兒(null不可視為孤兒)
    let orphans = rs.filter((v) => v.parentAlive === false)
    console.log('orphans', orphans.map((v) => v.pid))

    //逾時設定, 執行檔超過3000毫秒未完成即關閉並reject
    let rs2 = await WProcessStatus(name, { timeout: 3000 })
    console.log('rs2', rs2.length)

}
test()
    .catch((err) => {
        console.log(err)
    })
```
