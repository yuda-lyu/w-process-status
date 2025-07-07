import assert from 'assert'
import WProcessStatus from '../src/WProcessStatus.mjs'


function isWindows() {
    return process.platform === 'win32'
}


describe('WProcessStatus', function() {

    //check
    if (!isWindows()) {
        return
    }

    it('test', async function() {
        let r = await WProcessStatus('chrome.exe')
        let b = r.length >= 0 //只要不出錯能回傳就算成功
        assert.strict.deepEqual(b, true)
    })

})
