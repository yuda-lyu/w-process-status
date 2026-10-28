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
| processStatus.exe | 列出指定程序名稱之 pid、記憶體、使用者與狀態(僅 Windows) | 本套件 GitHub repo 之 `bin/`(釘選提交，網址見 `bin/manifest.json`) |

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
    //     status: 'running'
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 4984,
    //     ram: 211720,
    //     username: '{username}',
    //     status: 'running'
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 11648,
    //     ram: 2300,
    //     username: '{username}',
    //     status: 'stopped'
    //   }
    //   ...
    // ]

}
test()
    .catch((err) => {
        console.log(err)
    })
```
