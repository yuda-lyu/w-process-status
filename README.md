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
    //   ...
    // ]

}
test()
    .catch((err) => {
        console.log(err)
    })
```
