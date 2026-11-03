import path from 'path'
import os from 'os'
import fs from 'fs'
import process from 'process'
import genID from 'wsemi/src/genID.mjs'
import str2b64 from 'wsemi/src/str2b64.mjs'
import j2o from 'wsemi/src/j2o.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import execProcess from 'wsemi/src/execProcess.mjs'
import autoDownloadFiles from './autoDownloadFiles.mjs'
import ensureBins from './ensureBins.mjs'
import fmtState from './fmtState.mjs'


function isWindows() {
    return process.platform === 'win32'
}


/**
 * 列出指定程序名稱的pid與狀態之清單
 *
 * 各項除name、pid、ram、username、status外，另含exe、ppid、parentAlive，供使用端判定可回收之程序(例如限定自家路徑且父行程已死者)：
 * exe為執行檔路徑，無權限或無路徑(如System)時為null；ppid為建立該程序之父行程pid，無法取得時為null，Windows不會於父行程結束後更新ppid，故ppid所指之行程可能已不存在或pid已被其他行程重用；
 * parentAlive為父行程是否存活(判定同psutil之Process.parent()：比對ppid所指行程與本程序之建立時間)，true為存活，false為父行程已結束或其pid已被重用，
 * null為無法判定(查詢時發生例外，如無權限)或本無父行程(ppid為0或自身，如System與System Idle Process)。使用端應只將parentAlive為false者視為孤兒，null不可視為孤兒。
 * 建立時間取自系統時鐘，父子建立之間若系統時間被往回調整，存活之父行程可能被誤判為false，請與exe等條件交叉確認後再處置。
 * exe與parentAlive只對名稱相符者查詢，其值與呼叫當下之權限有關。
 *
 * @param {String} name 輸入程序名稱字串
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Number} [opt.timeout=null] 輸入執行檔逾時毫秒數，須為有效數字且大於0，逾時即關閉執行檔(含其子程序)並reject`timeout[Nms]:...`，未給或非預期之輸入(0、負數、Infinity、非數字字串、opt非物件等)皆視為不限時，預設null
 * @returns {Promise} 回傳Promise，resolve回傳清單陣列，各項含name、pid、ram、username、status、exe、ppid、parentAlive，reject回傳錯誤訊息；執行檔內部失敗時訊息帶上其回報之state(整理後至多200字元)，例如`output[] is not an array, state[error: ...]`
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
 *     //     status: 'running',
 *     //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 *     //     ppid: 5124,
 *     //     parentAlive: true
 *     //   },
 *     //   {
 *     //     name: 'chrome.exe',
 *     //     pid: 11648,
 *     //     ram: 2300,
 *     //     username: '{username}',
 *     //     status: 'stopped',
 *     //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 *     //     ppid: 7740,
 *     //     parentAlive: false
 *     //   }
 *     //   {
 *     //     name: 'chrome.exe',
 *     //     pid: 4984,
 *     //     ram: 211720,
 *     //     username: '{username}',
 *     //     status: 'running',
 *     //     exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 *     //     ppid: 400,
 *     //     parentAlive: true
 *     //   },
 *     //   ...
 *     // ]
 *
 *     //逾時設定, 執行檔超過3000毫秒未完成即關閉並reject
 *     let rs2 = await WProcessStatus(name, { timeout: 3000 })
 *
 * }
 * test()
 *     .catch((err) => {
 *         console.log(err)
 *     })
 *
 */
async function WProcessStatus(name, opt = {}) {
    let errTemp = null
    let state = ''

    //isWindows
    if (!isWindows()) {
        return Promise.reject('operating system is not windows')
    }

    //check
    if (!isestr(name)) {
        return Promise.reject('name is not an effective string')
    }

    //prog, 經ensureBins取得processStatus.exe(依bin/manifest.json校驗, 首次使用時自鏡像或GitHub取得, 之後自快取取得)
    let { fpExe } = await autoDownloadFiles()
    let prog = fpExe
    // console.log('prog', prog)

    //fdTmp, 暫存json檔寫作業系統暫存資料夾, 不寫prog所在之快取資料夾(快取內容由清單校驗, 且可能為共用或唯讀)
    let fdTmp = os.tmpdir()

    //id
    let id = genID()

    //fpIn
    let fpIn = path.join(fdTmp, `_${id}_fpIn.json`)

    //fpOut
    let fpOut = path.join(fdTmp, `_${id}_fpOut.json`)

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

    //timeout, 取自opt, 未給或非預期之輸入(含opt本身不是一般物件, 讀取拋錯)皆為null, 由execProcess視為不限時(輸入參數之檢測機制K3、V4)
    let timeout = null
    try {
        timeout = isobj(opt) ? opt.timeout : null
    }
    catch (err) {}

    //execProcess, 執行檔內部失敗時離開碼仍為0, 原因只印於stdout, 故保留state供錯誤訊息使用
    await execProcess(prog, b64Input, { timeout })
        .then((res) => {
            state = fmtState(res)
        })
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
        return Promise.reject(`output[${cstr(output)}] is not an array, state[${state}]`)
    }

    //rs
    let rs = output

    return rs
}


//ensureBins, 供部署前預先取得processStatus.exe(WProcessStatus.ensureBins), 見README〈外部執行檔〉
WProcessStatus.ensureBins = ensureBins


export default WProcessStatus
