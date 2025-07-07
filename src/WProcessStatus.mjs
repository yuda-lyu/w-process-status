import path from 'path'
import fs from 'fs'
import process from 'process'
import genID from 'wsemi/src/genID.mjs'
import str2b64 from 'wsemi/src/str2b64.mjs'
import j2o from 'wsemi/src/j2o.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import execProcess from 'wsemi/src/execProcess.mjs'


let fdSrv = path.resolve()


function isWindows() {
    return process.platform === 'win32'
}


/**
 * 列出指定程序名稱的pid與狀態之清單
 *
 * @param {String} name 輸入程序名稱字串
 * @returns {Promise} 回傳Promise，resolve回傳成功訊息，reject回傳錯誤訊息
 * @example
 *
 * async function test() {
 *
 *     let name = 'chrome.exe'
 *     let opt = {}
 *
 *     let rs = await WProcessStatus(name, opt)
 *     console.log('rs', rs)
 *     // rs => [
 *     //   {
 *     //     name: 'chrome.exe',
 *     //     pid: 400,
 *     //     ram: 169404,
 *     //     username: '{username}',
 *     //     status: 'running'
 *     //   },
 *     //   {
 *     //     name: 'chrome.exe',
 *     //     pid: 4984,
 *     //     ram: 211720,
 *     //     username: '{username}',
 *     //     status: 'running'
 *     //   },
 *     //   ...
 *     // ]
 *
 * }
 * test()
 *     .catch((err) => {
 *         console.log(err)
 *     })
 *
 */
async function WProcessStatus(name) {
    let errTemp = null

    //isWindows
    if (!isWindows()) {
        return Promise.reject('operating system is not windows')
    }

    //check
    if (!isestr(name)) {
        return Promise.reject('name is not an effective string')
    }

    //fnExe
    let fnExe = `processStatus.exe`

    //fdExe
    let fdExe = ''
    if (true) {
        let fdExeSrc = `${fdSrv}/src/`
        let fdExeNM = `${fdSrv}/node_modules/w-process-status/src/`
        if (fsIsFile(`${fdExeSrc}${fnExe}`)) {
            fdExe = fdExeSrc
        }
        else if (fsIsFile(`${fdExeNM}${fnExe}`)) {
            fdExe = fdExeNM
        }
        else {
            return Promise.reject('can not find folder for processStatus')
        }
    }
    // console.log('fdExe', fdExe)

    //prog
    let prog = `${fdExe}${fnExe}`
    // console.log('prog', prog)

    //id
    let id = genID()

    //fpIn
    let fpIn = `${fdExe}_${id}_fpIn.json`

    //fpIn
    let fpOut = `${fdExe}_${id}_fpOut.json`

    //rIn
    let rIn = {
        name,
    }

    //save
    fs.writeFileSync(fpIn, JSON.stringify(rIn), 'utf8')

    //inp
    let inp = {
        fpIn,
        fpOut,
        opt: {},
    }
    // console.log('inp', inp)

    //input to b64
    let cInput = JSON.stringify(inp)
    let b64Input = str2b64(cInput)

    //execProcess
    await execProcess(prog, b64Input)
        .catch((err) => {
            console.log('execProcess catch', err)
            errTemp = err.toString()
        })

    //read output
    let output = null
    try {
        let j = fs.readFileSync(fpOut, 'utf8')
        // console.log('j', j)
        output = j2o(j)
        // console.log('output', output)
    }
    catch (err) {}

    //unlinkSync
    try {
        fs.unlinkSync(fpIn)
    }
    catch (err) {}

    //unlinkSync
    try {
        fs.unlinkSync(fpOut)
    }
    catch (err) {}

    //check
    if (errTemp) {
        return Promise.reject(errTemp)
    }

    //check
    if (!isarr(output)) {
        return Promise.reject(`output[${cstr(output)}] is not an array`)
    }

    //rs
    let rs = output

    return rs
}


export default WProcessStatus
