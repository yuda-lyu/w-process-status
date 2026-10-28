import fs from 'fs'
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

    //外部執行檔processStatus.exe由本機鏡像離線供檔(結構<鏡像>/<套件>/<sha256>/<檔名>), 不連外網
    let fdt = './test/_tmp/WProcessStatus'
    let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
    let bak = {}

    //全域fetch之攔截, 確保不連外網(被呼叫即記錄並拋錯)
    let fetchBak = null
    let netCalls = []

    before(function() {
        fetchBak = globalThis.fetch
        globalThis.fetch = (url) => {
            netCalls.push(String(url))
            throw new Error(`network access is forbidden in tests: ${url}`)
        }
        let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
        let { sha256 } = manifest.files.find((v) => v.name === 'processStatus.exe')
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(`${fdt}/mirror/w-process-status/${sha256}`, { recursive: true })
        fs.copyFileSync('bin/processStatus.exe', `${fdt}/mirror/w-process-status/${sha256}/processStatus.exe`)
        for (let k of keys) {
            bak[k] = process.env[k]
        }
        process.env.W_BIN_CACHE = `${fdt}/cache`
        process.env.W_BIN_MIRROR = `${fdt}/mirror`
        process.env.W_BIN_OFFLINE = '1'
    })

    after(function() {
        globalThis.fetch = fetchBak
        for (let k of keys) {
            if (bak[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = bak[k]
            }
        }
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })

    it('test', async function() {
        let r = await WProcessStatus('chrome.exe')
        let b = r.length >= 0 //只要不出錯能回傳就算成功
        assert.strict.deepEqual(b, true)
        assert.strict.deepEqual(netCalls, [])
    })

})
