import fs from 'fs'
import path from 'path'
import http from 'http'
import assert from 'assert'
import crypto from 'crypto'
import ensureBins from '../src/ensureBins.mjs'
import autoDownloadFiles from '../src/autoDownloadFiles.mjs'
import WProcessStatus from '../src/WProcessStatus.mjs'


//規格: 外部執行檔之存放下載校驗與離線(制式規格) D1~D4、O1~O3、E2、§8 T3~T7(釘選模式, T8主幹模式不適用)
//全部以127.0.0.1之本機HTTP伺服器扮GitHub與本地資料夾扮鏡像, 不連外網; 檔案為repo內真實之bin/processStatus.exe
describe(`ensureBins`, function() {
    this.timeout(120000)

    let fdt = path.resolve('./test/_tmp/ensureBins')
    let port = 8861
    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let entry = manifest.files.find((v) => v.name === 'processStatus.exe')
    let body = fs.readFileSync('bin/processStatus.exe')
    let sha256 = entry.sha256
    let urlPath = `/yuda-lyu/w-process-status/${manifest.commit}/bin/processStatus.exe`

    //server, mode: 'ok'、'hash'(同大小但內容不同)、'size'(少一位元組)、'notfound'
    let mode = 'ok'
    let hits = []
    let server = null
    let fetchCalls = []

    //fetch, 只接受GitHub原始檔網址並改指本機伺服器, 其餘(外網)一律拋錯
    let fetch = (url, init) => {
        let u = String(url)
        fetchCalls.push(u)
        if (!u.startsWith('https://raw.githubusercontent.com/')) {
            throw new Error(`unexpected url[${u}]`)
        }
        return globalThis.fetch(u.replace('https://raw.githubusercontent.com', `http://127.0.0.1:${port}`), init)
    }

    //fetchBan, 不得被呼叫之fetch(離線或鏡像取得時)
    let fetchBan = (url) => {
        fetchCalls.push(String(url))
        throw new Error(`fetch must not be called[${url}]`)
    }

    let sha256Of = (fp) => {
        return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex')
    }

    let listFiles = (fd) => {
        if (!fs.existsSync(fd)) {
            return []
        }
        return fs.readdirSync(fd, { recursive: true, withFileTypes: true }).filter((v) => v.isFile()).map((v) => path.join(v.parentPath, v.name))
    }

    //cacheOf, mirrorOf, 每案獨立資料夾
    let n = 0
    let cacheOf = () => `${fdt}/c${++n}/cache`
    let mirrorOf = (c) => `${path.dirname(c)}/mirror`

    let putMirror = (mirror, b) => {
        fs.mkdirSync(`${mirror}/w-process-status/${sha256}`, { recursive: true })
        fs.writeFileSync(`${mirror}/w-process-status/${sha256}/processStatus.exe`, b)
    }

    let base = { mirror: '', offline: false, maxAttempts: 1, retryDelayMs: 0 }

    before(async function() {
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(fdt, { recursive: true })
        server = http.createServer((req, res) => {
            hits.push(req.url)
            if (mode === 'notfound') {
                res.writeHead(404)
                res.end()
                return
            }
            let b = body
            if (mode === 'hash') {
                b = Buffer.from(body)
                b[0] = b[0] ^ 0xff
            }
            if (mode === 'size') {
                b = body.subarray(0, body.length - 1)
            }
            res.writeHead(200, { 'content-length': String(b.length) })
            res.end(b)
        })
        await new Promise((resolve) => {
            server.listen(port, '127.0.0.1', resolve)
        })
    })

    after(async function() {
        await new Promise((resolve) => {
            server.close(resolve)
        })
        fs.rmSync(fdt, { recursive: true, force: true })
    })

    beforeEach(function() {
        mode = 'ok'
        hits = []
        fetchCalls = []
    })

    it(`should export ensureBins for pre-deployment, also as WProcessStatus.ensureBins (E2)`, function() {
        assert.strict.equal(typeof ensureBins, 'function')
        assert.strict.equal(WProcessStatus.ensureBins, ensureBins)
    })

    it(`should download from the pinned commit, verify and store into <cache>/<sha256>/processStatus.exe (R03, D1, D3, M2)`, async function() {
        let cacheDir = cacheOf()
        let r = await ensureBins({ ...base, cacheDir, fetch })
        assert.strict.deepStrictEqual(Object.keys(r), ['processStatus.exe'])
        assert.strict.equal(r['processStatus.exe'], path.resolve(cacheDir, sha256, 'processStatus.exe'))
        assert.strict.equal(sha256Of(r['processStatus.exe']), sha256)
        assert.strict.deepStrictEqual(hits, [urlPath]) //釘選提交, 非master
        assert.strict.equal(/^\/yuda-lyu\/w-process-status\/[0-9a-f]{40}\//.test(hits[0]), true)
    })

    it(`should hit the cache without network at the second call (R04, D4, T3)`, async function() {
        let cacheDir = cacheOf()
        let r1 = await ensureBins({ ...base, cacheDir, fetch })
        assert.strict.equal(hits.length, 1)
        let r2 = await ensureBins({ ...base, cacheDir, fetch: fetchBan })
        assert.strict.equal(r2['processStatus.exe'], r1['processStatus.exe'])
        assert.strict.equal(hits.length, 1)
        assert.strict.deepStrictEqual(fetchCalls, [`https://raw.githubusercontent.com${urlPath}`])
    })

    it(`should reject a download with a wrong hash and leave nothing (R05, T4)`, async function() {
        let cacheDir = cacheOf()
        mode = 'hash'
        let err = null
        await ensureBins({ ...base, cacheDir, fetch })
            .catch((e) => {
                err = e
            })
        assert.strict.equal(err && err.code, 'E_HASH_MISMATCH', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should reject a download with a wrong size and leave nothing (R05, T4)`, async function() {
        let cacheDir = cacheOf()
        mode = 'size'
        let err = null
        await ensureBins({ ...base, cacheDir, fetch })
            .catch((e) => {
                err = e
            })
        assert.strict.equal(err && err.code, 'E_SIZE_MISMATCH', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should reject a missing remote file (404) and leave nothing (R05)`, async function() {
        let cacheDir = cacheOf()
        mode = 'notfound'
        let err = null
        await ensureBins({ ...base, cacheDir, fetch })
            .catch((e) => {
                err = e
            })
        assert.strict.equal(err && err.code, 'E_HTTP', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should take the file from a local folder mirror offline without network (R06, T5, O1, O3)`, async function() {
        let cacheDir = cacheOf()
        let mirror = mirrorOf(cacheDir)
        putMirror(mirror, body)
        let r = await ensureBins({ ...base, cacheDir, mirror, offline: true, fetch: fetchBan })
        assert.strict.equal(r['processStatus.exe'], path.resolve(cacheDir, sha256, 'processStatus.exe'))
        assert.strict.equal(sha256Of(r['processStatus.exe']), sha256)
        assert.strict.deepStrictEqual(fetchCalls, [])
        assert.strict.deepStrictEqual(hits, [])
    })

    it(`should refuse a tampered mirror file: offline gives E_OFFLINE_MISSING and nothing enters the cache (R07, T5)`, async function() {
        let cacheDir = cacheOf()
        let mirror = mirrorOf(cacheDir)
        let bad = Buffer.from(body)
        bad[0] = bad[0] ^ 0xff
        putMirror(mirror, bad)
        let err = null
        await ensureBins({ ...base, cacheDir, mirror, offline: true, fetch: fetchBan })
            .catch((e) => {
                err = e
            })
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should fall back to GitHub when the mirror file is tampered and leave the mirror untouched (R07, T5, O2)`, async function() {
        let cacheDir = cacheOf()
        let mirror = mirrorOf(cacheDir)
        let bad = Buffer.from(body)
        bad[0] = bad[0] ^ 0xff
        putMirror(mirror, bad)
        let r = await ensureBins({ ...base, cacheDir, mirror, fetch })
        assert.strict.equal(sha256Of(r['processStatus.exe']), sha256)
        assert.strict.deepStrictEqual(hits, [urlPath])
        assert.strict.equal(Buffer.compare(fs.readFileSync(`${mirror}/w-process-status/${sha256}/processStatus.exe`), bad), 0)
    })

    it(`should reject offline with E_OFFLINE_MISSING naming the file, sha256, size and the cache path when there is no cache and no mirror (R08, T6, O3)`, async function() {
        let cacheDir = cacheOf()
        let err = null
        await ensureBins({ ...base, cacheDir, offline: true, fetch: fetchBan })
            .catch((e) => {
                err = e
            })
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.equal(err.message.includes('processStatus.exe'), true)
        assert.strict.equal(err.message.includes(sha256), true)
        assert.strict.equal(err.message.includes(String(entry.size)), true)
        assert.strict.equal(err.message.includes(path.resolve(cacheDir, sha256, 'processStatus.exe')), true)
        assert.strict.equal(err.missing[0].name, 'processStatus.exe')
        assert.strict.equal(err.missing[0].sha256, sha256)
        assert.strict.equal(err.missing[0].size, entry.size)
        assert.strict.equal(err.missing[0].cachePath, path.resolve(cacheDir, sha256, 'processStatus.exe'))
        assert.strict.deepStrictEqual(fetchCalls, [])
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should re-acquire when the cached file was tampered with the same size (R09, T7, D4)`, async function() {
        let cacheDir = cacheOf()
        let r1 = await ensureBins({ ...base, cacheDir, fetch })
        let fp = r1['processStatus.exe']
        let bad = Buffer.from(body)
        bad[bad.length - 1] = bad[bad.length - 1] ^ 0xff
        fs.writeFileSync(fp, bad)
        assert.strict.equal(hits.length, 1)
        let r2 = await ensureBins({ ...base, cacheDir, fetch })
        assert.strict.equal(r2['processStatus.exe'], fp)
        assert.strict.equal(sha256Of(fp), sha256)
        assert.strict.equal(hits.length, 2)
    })

    it(`should re-acquire when the cached file was truncated (R09, T7, D4)`, async function() {
        let cacheDir = cacheOf()
        let r1 = await ensureBins({ ...base, cacheDir, fetch })
        let fp = r1['processStatus.exe']
        fs.writeFileSync(fp, body.subarray(0, 1024))
        let r2 = await ensureBins({ ...base, cacheDir, fetch })
        assert.strict.equal(sha256Of(r2['processStatus.exe']), sha256)
        assert.strict.equal(hits.length, 2)
    })

    it(`should read W_BIN_CACHE, W_BIN_MIRROR and W_BIN_OFFLINE from the environment (R10, D3, O1, O3)`, async function() {
        let cacheRoot = `${fdt}/env/cache`
        let mirror = `${fdt}/env/mirror`
        putMirror(mirror, body)
        let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
        let bak = {}
        for (let k of keys) {
            bak[k] = process.env[k]
        }
        process.env.W_BIN_CACHE = cacheRoot
        process.env.W_BIN_MIRROR = mirror
        process.env.W_BIN_OFFLINE = '1'
        try {
            let r = await ensureBins({ fetch: fetchBan })
            assert.strict.equal(r['processStatus.exe'], path.resolve(cacheRoot, 'w-process-status', sha256, 'processStatus.exe'))
            assert.strict.equal(sha256Of(r['processStatus.exe']), sha256)
            assert.strict.deepStrictEqual(fetchCalls, [])
        }
        finally {
            for (let k of keys) {
                if (bak[k] === undefined) {
                    delete process.env[k]
                }
                else {
                    process.env[k] = bak[k]
                }
            }
        }
    })

    it(`should use <package root>/bin-cache as the default cache and the package root is this repo (R11, D3)`, async function() {
        let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
        let bak = {}
        for (let k of keys) {
            bak[k] = process.env[k]
            delete process.env[k]
        }
        let fpDefault = path.resolve('bin-cache', sha256, 'processStatus.exe')
        try {
            //離線且無鏡像: 不寫入任何檔案; 有快取(開發機曾實際使用)時回傳該路徑, 無快取時錯誤訊息之應放路徑須為預設位置
            let r = await ensureBins({ mirror: '', offline: true, fetch: fetchBan }).catch((e) => e)
            if (r instanceof Error) {
                assert.strict.equal(r.code, 'E_OFFLINE_MISSING', r.message)
                assert.strict.equal(r.missing[0].cachePath, fpDefault)
            }
            else {
                assert.strict.equal(r['processStatus.exe'], fpDefault)
            }
        }
        finally {
            for (let k of keys) {
                if (bak[k] !== undefined) {
                    process.env[k] = bak[k]
                }
            }
        }
    })

})


describe(`autoDownloadFiles`, function() {
    this.timeout(120000)

    let fdt = path.resolve('./test/_tmp/autoDownloadFiles')
    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let entry = manifest.files.find((v) => v.name === 'processStatus.exe')
    let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
    let bak = {}

    //autoDownloadFiles無法注入fetch, 故以全域fetch之攔截確保不連外網(被呼叫即記錄並拋錯)
    let fetchBak = null
    let netCalls = []

    before(function() {
        fetchBak = globalThis.fetch
        globalThis.fetch = (url) => {
            netCalls.push(String(url))
            throw new Error(`network access is forbidden in tests: ${url}`)
        }
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(`${fdt}/mirror/w-process-status/${entry.sha256}`, { recursive: true })
        fs.copyFileSync('bin/processStatus.exe', `${fdt}/mirror/w-process-status/${entry.sha256}/processStatus.exe`)
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

    it(`should keep returning { fpExe } of the verified cached file (R12)`, async function() {
        let r = await autoDownloadFiles()
        assert.strict.deepStrictEqual(netCalls, [])
        assert.strict.deepStrictEqual(Object.keys(r), ['fpExe'])
        assert.strict.equal(r.fpExe, path.resolve(fdt, 'cache', 'w-process-status', entry.sha256, 'processStatus.exe'))
        let h = crypto.createHash('sha256').update(fs.readFileSync(r.fpExe)).digest('hex')
        assert.strict.equal(h, entry.sha256)
    })

    it(`should share concurrent calls (R12)`, async function() {
        let rs = await Promise.all([autoDownloadFiles(), autoDownloadFiles(), autoDownloadFiles()])
        assert.strict.equal(new Set(rs.map((v) => v.fpExe)).size, 1)
    })

})
