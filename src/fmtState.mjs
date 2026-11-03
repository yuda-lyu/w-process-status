import cstr from 'wsemi/src/cstr.mjs'
import maskDiagText from 'wsemi/src/maskDiagText.mjs'


//maxChars, 執行檔回報之state寫入錯誤訊息時之字元數上限(以code point計, 超過則截斷並接...)
let maxChars = 200

//maxWindow, 遮罩前先取之視窗字元數(僅為限制遮罩成本, 遠大於maxChars, 使遮罩結果之前maxChars字不受截點影響)
let maxWindow = 2000


//fmtState, 整理執行檔回報之state字串, 供錯誤訊息使用(輸入任意值, 回傳字串, 最長maxChars個字元, 超過則截斷並接...)
//  state來自外部程序(processStatus.exe)之輸出, 屬外來值, 依dspec診斷輸出與遮罩D3: 以wsemi之maskDiagText遮憑證(網址帳密、password=等鍵值對、Bearer), 不另寫等價實作; 儲存路徑不遮(Q3);
//  另將換行與控制字元換成空白(避免斷行與日誌注入), 並限制長度, 永不拋錯
//  不用JSDoc區塊: jsdoc會收錄src/下全部檔案, 本函數為內部使用, 不列入公開文件
function fmtState(state) {
    let s = ''
    try {
        s = cstr(state).slice(0, maxWindow)
        s = maskDiagText(s, [])
        s = Array.from(cstr(s), (c) => {
            let n = c.codePointAt(0)
            return (n < 32 || n === 127) ? ' ' : c
        }).join('')
        s = s.replace(/ +/g, ' ').trim()
        let a = Array.from(s)
        if (a.length > maxChars) {
            s = a.slice(0, maxChars).join('') + '...'
        }
    }
    catch (err) {
        s = ''
    }
    return s
}


export default fmtState
