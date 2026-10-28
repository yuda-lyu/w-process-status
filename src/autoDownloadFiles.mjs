import ensureBins from './ensureBins.mjs'


//fnExe, processStatus執行檔名稱
let fnExe = 'processStatus.exe'


/**
 * 取得processStatus.exe，回傳processStatus.exe的絕對路徑
 *
 * 經ensureBins依bin/manifest.json之SHA-256與大小校驗後取得(快取、鏡像、GitHub釘選提交)，首次使用才下載，安裝時不下載，
 * 離線與內網之用法(W_BIN_CACHE、W_BIN_MIRROR、W_BIN_OFFLINE)見README〈外部執行檔〉
 *
 * 供w-process-status自身與其他依賴w-process-status的套件調用，無須各自實作偵測與下載邏輯
 *
 * 因processStatus.exe只能用於Windows作業系統，故調用前須自行檢核作業系統
 *
 * @returns {Promise} 回傳Promise，resolve回傳執行檔路徑物件，內含fpExe為processStatus.exe的絕對路徑字串，reject回傳帶code之Error(E_OFFLINE_MISSING、E_HASH_MISMATCH等)
 * @example
 * import autoDownloadFiles from 'w-process-status/src/autoDownloadFiles.mjs'
 *
 * async function test() {
 *
 *     //autoDownloadFiles, 無快取時自動取得, 取得或校驗失敗則reject
 *     let { fpExe } = await autoDownloadFiles()
 *
 *     console.log('fpExe', fpExe)
 *     // fpExe D:\xxx\node_modules\w-process-status\bin-cache\<sha256>\processStatus.exe
 * }
 * test()
 *     .catch((err) => {
 *         console.log('catch', err)
 *     })
 *
 */
async function autoDownloadFiles() {

    //ensureBins, 併發呼叫由其共用同一次取得
    let bins = await ensureBins({ names: fnExe })

    //fpExe
    let fpExe = bins[fnExe]

    return {
        fpExe,
    }
}


export default autoDownloadFiles
