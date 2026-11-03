import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { spawn, execFile } from 'child_process'
import WProcessStatus from '../src/WProcessStatus.mjs'


function isWindows() {
    return process.platform === 'win32'
}


//waitUntil, 偵測式等待: 輪詢fn至回傳真值或逾時(回傳最後一次之值), 不以固定延時當同步點
async function waitUntil(fn, timeoutMs = 20000, gapMs = 50) {
    let t0 = Date.now()
    while (true) {
        let v = await fn()
        if (v || Date.now() - t0 > timeoutMs) {
            return v
        }
        await new Promise((resolve) => setTimeout(resolve, gapMs))
    }
}


//isAlive, pid是否仍存在(process.kill(pid, 0)只探測不送訊號)
function isAlive(pid) {
    try {
        process.kill(pid, 0)
        return true
    }
    catch (err) {
        return err.code === 'EPERM'
    }
}


//readFirstLine, 以子行程stdout之事件取得其輸出之第一行(子行程先結束則reject)
function readFirstLine(cp) {
    return new Promise((resolve, reject) => {
        let buf = ''
        cp.stdout.on('data', (d) => {
            buf += String(d)
            let i = buf.indexOf('\n')
            if (i >= 0) {
                resolve(buf.slice(0, i).trim())
            }
        })
        cp.once('exit', (code) => {
            reject(new Error(`child exited before output, code[${code}]`))
        })
        cp.once('error', reject)
    })
}


//killAndWait, 結束子行程並等其exit事件
async function killAndWait(cp) {
    if (cp.exitCode === null && cp.signalCode === null) {
        await new Promise((resolve) => {
            cp.once('exit', resolve)
            cp.kill()
        })
    }
}


//listPids, 以tasklist列出指定映像名稱之pid集合
function listPids(imageName) {
    return new Promise((resolve, reject) => {
        execFile('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
            if (err) {
                reject(err)
                return
            }
            let pids = new Set()
            for (let line of String(stdout).split(/\r?\n/)) {
                let m = line.match(/^"([^"]+)","(\d+)"/)
                if (m && m[1].toLowerCase() === imageName.toLowerCase()) {
                    pids.add(Number(m[2]))
                }
            }
            resolve(pids)
        })
    })
}


describe('WProcessStatus', function() {

    //check
    if (!isWindows()) {
        return
    }

    //外部執行檔processStatus.exe由本機鏡像離線供檔(結構<鏡像>/<套件>/<sha256>/<檔名>), 不連外網
    let fdt = './test/_tmp/WProcessStatus'
    let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE', 'TEMP', 'TMP']
    let bak = {}

    //全域fetch之攔截, 確保不連外網(被呼叫即記錄並拋錯)
    let fetchBak = null
    let netCalls = []

    //暫存夾, 執行時之交換json與PyInstaller單檔執行檔之解壓夾(_MEI*)皆落於os.tmpdir(), 逾時被強制結束時解壓夾不會自行清除, 故導到測試專用夾由after清除
    let fdTmpAbs = path.resolve(fdt, 'tmp')

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
        fs.mkdirSync(fdTmpAbs, { recursive: true })
        fs.copyFileSync('bin/processStatus.exe', `${fdt}/mirror/w-process-status/${sha256}/processStatus.exe`)
        for (let k of keys) {
            bak[k] = process.env[k]
        }
        process.env.W_BIN_CACHE = `${fdt}/cache`
        process.env.W_BIN_MIRROR = `${fdt}/mirror`
        process.env.W_BIN_OFFLINE = '1'
        process.env.TEMP = fdTmpAbs
        process.env.TMP = fdTmpAbs
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

    //以本行程之node.exe造子行程, 不依賴本機是否開著chrome
    let nameNode = path.basename(process.execPath)
    let codeSleep = 'setTimeout(() => {}, 120000)'
    let codeReady = `console.log('ready'); ${codeSleep}`
    let keysAll = ['name', 'pid', 'ram', 'username', 'status', 'exe', 'ppid', 'parentAlive']

    it('各項含exe、ppid, 父行程存活時parentAlive為true, 既有欄位不變(Gitea #55 項1, 驗證建議1)', async function() {
        let cp = spawn(process.execPath, ['-e', codeReady], { stdio: ['ignore', 'pipe', 'ignore'] })
        try {
            await readFirstLine(cp) //子行程已就緒
            let rs = await WProcessStatus(nameNode)
            let r = rs.find((v) => v.pid === cp.pid)
            assert.strict.ok(r)

            //exe為執行檔路徑(等於process.execPath), ppid為父行程pid(等於本行程), 父行程存活則parentAlive為true
            assert.strict.deepEqual(path.resolve(r.exe).toLowerCase(), path.resolve(process.execPath).toLowerCase())
            assert.strict.deepEqual(r.ppid, process.pid)
            assert.strict.deepEqual(r.parentAlive, true)

            //既有欄位不變, 僅新增exe、ppid、parentAlive
            assert.strict.deepEqual(Object.keys(r).sort(), [...keysAll].sort())
            assert.strict.deepEqual(r.name.toLowerCase(), nameNode.toLowerCase())
            assert.strict.deepEqual(typeof r.ram, 'number')
            assert.strict.deepEqual(typeof r.username, 'string')
            assert.strict.deepEqual(typeof r.status, 'string')
        }
        finally {
            await killAndWait(cp)
        }
    })

    it('父行程已結束時parentAlive為false, ppid仍為原父行程之pid(Gitea #55 項1, 驗證建議2)', async function() {

        //mid, 中介行程啟動孫行程(detached)後印出其pid; 孫行程之父行程為mid
        let codeMid = `let cp = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(codeSleep)}], { detached: true, stdio: 'ignore' }); cp.unref(); console.log(cp.pid); ${codeSleep}`
        let mid = spawn(process.execPath, ['-e', codeMid], { stdio: ['ignore', 'pipe', 'ignore'] })
        let pidOrphan = null
        try {
            pidOrphan = Number(await readFirstLine(mid))
            assert.strict.ok(pidOrphan > 0)

            //mid存活時, 孫行程之parentAlive為true(對照組: 排除永遠回false)
            let rs0 = await WProcessStatus(nameNode)
            let r0 = rs0.find((v) => v.pid === pidOrphan)
            assert.strict.ok(r0)
            assert.strict.deepEqual(r0.ppid, mid.pid)
            assert.strict.deepEqual(r0.parentAlive, true)

            //只結束mid(TerminateProcess不及子孫), 等其exit事件後孫行程即成孤兒
            await killAndWait(mid)

            let rs = await WProcessStatus(nameNode)
            let r = rs.find((v) => v.pid === pidOrphan)
            assert.strict.ok(r)
            assert.strict.deepEqual(r.ppid, mid.pid)
            assert.strict.deepEqual(r.parentAlive, false)
        }
        finally {
            await killAndWait(mid)
            if (pidOrphan) {
                try {
                    process.kill(pidOrphan)
                }
                catch (err) {}
                await waitUntil(() => !isAlive(pidOrphan))
            }
        }
    })

    it('無路徑且無父行程之行程(System): 查詢不失敗, exe為null, parentAlive為null而非false(Gitea #55 項1, 驗證建議3)', async function() {
        let rs = await WProcessStatus('System')
        let r = rs.find((v) => v.pid === 4)
        assert.strict.ok(r)
        assert.strict.deepEqual(r.exe, null) //無權限或無路徑為null
        assert.strict.deepEqual(r.ppid, 0)
        assert.strict.deepEqual(r.parentAlive, null) //本無父行程者為無法判定(null), 不得為false(使用端只有false才當孤兒處置)
    })

    it('System Idle Process(pid 0): psutil之parent()對最小pid固定回None, 不得因此回報parentAlive為false', async function() {
        let rs = await WProcessStatus('System Idle Process')
        let r = rs.find((v) => v.pid === 0)
        assert.strict.ok(r)
        assert.strict.deepEqual(r.exe, null)
        assert.strict.deepEqual(r.ppid, 0)
        assert.strict.deepEqual(r.parentAlive, null)
    })

    it('opt.timeout: 逾時即reject且訊息開頭為timeout[Nms], 逾時後執行檔無殘留(Gitea #55 項2, 驗證建議4)', async function() {
        let pidsBefore = await listPids('processStatus.exe')
        let err = await WProcessStatus(nameNode, { timeout: 1 })
            .then(() => null, (e) => e)
        assert.strict.match(String(err), /^timeout\[1ms\]/)

        //逾時後本次啟動之processStatus.exe(含PyInstaller單檔之子行程)須皆已結束: 偵測至無新增之pid(他處同時執行者不計)
        let left = []
        let b = await waitUntil(async () => {
            let pids = await listPids('processStatus.exe')
            left = [...pids].filter((v) => !pidsBefore.has(v))
            return left.length === 0
        })
        assert.strict.deepEqual(left, [])
        assert.strict.ok(b)
    })

    it('opt.timeout: 足夠長則正常回傳', async function() {
        let rs = await WProcessStatus('System', { timeout: 600000 })
        assert.strict.ok(Array.isArray(rs))
        assert.strict.ok(rs.length > 0)
    })

    it('opt: 未給或非預期之輸入(timeout非有效計時毫秒, opt非一般物件)視為不限時, 正常回傳(輸入參數之檢測機制 K3、V4)', async function() {
        let trap = {}
        Object.defineProperty(trap, 'timeout', {
            get: () => {
                throw new Error('boom')
            },
        })
        let opts = [undefined, {}, { timeout: '10s' }, { timeout: 0 }, { timeout: -1 }, { timeout: Infinity }, { timeout: null }, { timeout: {} }, null, 'x', 123, [], trap]
        for (let opt of opts) {
            let rs = await WProcessStatus('System', opt).then((v) => v, (e) => e)
            assert.strict.ok(Array.isArray(rs), `opt[${String(opt)}] => ${String(rs)}`)
            assert.strict.deepEqual(rs.find((v) => v.pid === 4).name, 'System')
        }
    })

    //執行檔內部失敗時離開碼仍為0, 原因只印於stdout; 以攔截fs.writeFileSync令輸入json損壞(或缺檔), 由真執行檔自行失敗
    async function failWithFpIn(fnData) {
        let writeBak = fs.writeFileSync
        fs.writeFileSync = function(fp, data, ...rest) {
            if (String(fp).endsWith('_fpIn.json')) {
                data = fnData(data)
                if (data === null) {
                    return //不寫入, 執行檔讀不到輸入
                }
            }
            return writeBak.call(this, fp, data, ...rest)
        }
        try {
            return await WProcessStatus('System').then(() => null, (e) => e)
        }
        finally {
            fs.writeFileSync = writeBak
        }
    }

    it('state: 執行檔內部失敗時reject訊息帶上state(原因), 不再只剩output[] is not an array(Gitea #55 項3)', async function() {
        let err = await failWithFpIn(() => '{') //損壞之輸入json
        assert.strict.ok(typeof err === 'string', String(err))
        assert.strict.match(err, /^output\[\] is not an array, state\[error: .*line 1 column.*\]$/)
    })

    it('state: 長度有上限(來自外部程序輸出, 超過200字元截斷並接...), 路徑不遮', async function() {
        let envBak = { TEMP: process.env.TEMP, TMP: process.env.TMP }

        //長路徑之暫存夾(補足至150字元; 套件本身已在更深處者不補), 執行檔讀不到輸入時之錯誤訊息含該路徑(連同檔名與跳脫後超過200字元)
        let pad = Math.max(0, 150 - fdTmpAbs.length - 1)
        let fdLong = pad > 0 ? path.join(fdTmpAbs, 'p'.repeat(pad)) : fdTmpAbs
        fs.mkdirSync(fdLong, { recursive: true })
        process.env.TEMP = fdLong
        process.env.TMP = fdLong
        let err = null
        try {
            err = await failWithFpIn(() => null) //缺輸入檔
        }
        finally {
            process.env.TEMP = envBak.TEMP
            process.env.TMP = envBak.TMP
        }
        assert.strict.ok(typeof err === 'string', String(err))
        let m = err.match(/^output\[\] is not an array, state\[(.*)\]$/)
        assert.strict.ok(m, err)
        assert.strict.deepEqual(m[1].length, 203) //200字元+'...'
        assert.strict.ok(m[1].endsWith('...'))

        //儲存路徑不遮(診斷輸出與遮罩 Q3): 原因之後緊接引號與磁碟機代號(python之repr將\跳脫為\\)
        let root = path.parse(fdTmpAbs).root.replace(/\\/g, '\\\\')
        assert.strict.ok(m[1].startsWith(`error: [Errno 2] No such file or directory: '${root}`), m[1])
    })

})


describe('fmtState', function() {

    //state來自外部程序輸出: 限制長度, 遮憑證(診斷輸出與遮罩 D3), 路徑不遮(Q3), 控制字元換成空白, 永不拋錯
    let fmtState = null

    before(async function() {
        fmtState = (await import('../src/fmtState.mjs')).default
    })

    it('長度上限200個字元(以code point計), 超過截斷並接...', function() {
        assert.strict.deepEqual(fmtState('a'.repeat(200)), 'a'.repeat(200))
        assert.strict.deepEqual(fmtState('a'.repeat(201)), 'a'.repeat(200) + '...')
        assert.strict.deepEqual(fmtState('a'.repeat(100000)), 'a'.repeat(200) + '...')
        assert.strict.deepEqual(fmtState('a'.repeat(199) + '😀' + 'b'), 'a'.repeat(199) + '😀...') //不切開代理對
        assert.strict.deepEqual(fmtState('中'.repeat(250)), '中'.repeat(200) + '...')
    })

    it('換行與控制字元換成空白並收斂, 頭尾空白去除', function() {
        assert.strict.deepEqual(fmtState('  error: a\r\nb\tc\u001b[31md\u0000e  '), 'error: a b c [31md e')
    })

    it('遮憑證(網址帳密, 鍵值對, Bearer), 儲存路徑不遮', function() {
        let s = fmtState('error: connect postgres://u1:pw1234@db:5432/a failed password=abc123 Bearer tok.en.1')
        assert.strict.ok(!s.includes('pw1234'), s)
        assert.strict.ok(!s.includes('abc123'), s)
        assert.strict.ok(!s.includes('tok.en.1'), s)
        assert.strict.ok(s.includes('postgres://***@db:5432/a'), s)
        let p = 'error: [Errno 2] No such file or directory: \'C:\\Users\\x\\AppData\\Local\\Temp\\_id_fpIn.json\''
        assert.strict.deepEqual(fmtState(p), p)
    })

    it('非字串之輸入不拋錯', function() {
        for (let v of [undefined, null, 0, 12, true, {}, [], () => {}, Symbol('x')]) {
            assert.strict.deepEqual(typeof fmtState(v), 'string')
        }
        assert.strict.deepEqual(fmtState(undefined), '')
        assert.strict.deepEqual(fmtState(null), '')
    })

})
