import fs from 'fs'
import path from 'path'
import assert from 'assert'
import crypto from 'crypto'
import { execSync, execFileSync } from 'child_process'
import fsGetBinManifestEntry from 'wsemi/src/fsGetBinManifestEntry.mjs'
import fsEnsureBins from 'wsemi/src/fsEnsureBins.mjs'


//規格: 外部執行檔之存放下載校驗與離線(制式規格) S1、M1、M2、M4、D1、E2、§8 T1、T2
describe(`bin/manifest.json`, function() {
    this.timeout(120000)

    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let fdt = './test/_tmp/binManifest'

    after(function() {
        fs.rmSync(fdt, { recursive: true, force: true })
    })

    it(`should declare the pinned manifest of this package (M1, M2)`, function() {
        assert.strict.equal(manifest.schema, 1)
        assert.strict.equal(manifest.pkg, 'w-process-status')
        assert.strict.equal(manifest.mode, 'pinned')
        assert.strict.equal(manifest.repo, 'yuda-lyu/w-process-status')
        assert.strict.equal(/^[0-9a-f]{40}$/.test(manifest.commit), true)
        assert.strict.deepStrictEqual(manifest.files.map((v) => v.name), ['processStatus.exe'])
        assert.strict.equal(manifest.files[0].path, 'bin/processStatus.exe')
    })

    it(`should pin a commit that really contains the listed bin/processStatus.exe (M2, U1)`, function() {
        let git = (args, opt = {}) => {
            return execFileSync('git', args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...opt })
        }

        //淺層clone(如CI)不含該提交, 略過
        if (git(['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true') {
            this.skip()
        }

        git(['cat-file', '-e', `${manifest.commit}^{commit}`], { stdio: 'ignore' })
        let b = git(['show', `${manifest.commit}:bin/processStatus.exe`])
        assert.strict.equal(crypto.createHash('sha256').update(b).digest('hex'), manifest.files[0].sha256)
        assert.strict.equal(b.length, manifest.files[0].size)
    })

    it(`should pass the schema check of fsEnsureBins (M1, M2)`, async function() {
        //離線且快取為空資料夾: 清單有效時為E_OFFLINE_MISSING(缺檔), 清單無效時為E_MANIFEST; 不連網
        let err = null
        try {
            await fsEnsureBins('bin/manifest.json', { pkgRoot: '.', cacheDir: `${fdt}/cache`, mirror: '', offline: true })
        }
        catch (e) {
            err = e
        }
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
    })

    it(`should match the real files in bin/ (M4, T2)`, async function() {
        for (let f of manifest.files) {
            for (let p of [f, ...(f.parts || [])]) {
                if (typeof p.path === 'string') {
                    let e = await fsGetBinManifestEntry(p.path)
                    assert.strict.deepStrictEqual([e.sha256, e.size], [p.sha256, p.size], p.path)
                }
            }
        }
    })

    it(`should keep the legacy src/processStatus.exe identical to bin/processStatus.exe (S2, older versions download it from master)`, async function() {
        let a = await fsGetBinManifestEntry('bin/processStatus.exe')
        let b = await fsGetBinManifestEntry('src/processStatus.exe')
        assert.strict.deepStrictEqual([b.sha256, b.size], [a.sha256, a.size])
    })

    it(`should not pack external executables into the npm package, only bin/manifest.json (S1, T1)`, function() {
        //暫存夾內放一個探針檔, 確認test/_tmp不入包(測試平行執行時他檔之暫存檔不得影響本案)
        fs.mkdirSync(fdt, { recursive: true })
        fs.writeFileSync(`${fdt}/probe.exe`, 'x')
        let r = JSON.parse(execSync('npm pack --dry-run --json', { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }))
        let info = Array.isArray(r) ? r[0] : Object.values(r)[0] //npm 11以前為陣列, npm 12起為以套件名為鍵之物件
        let fps = info.files.map((v) => v.path)
        assert.strict.deepStrictEqual(fps.filter((v) => /\.(exe|dll|msi|zip|7z|\d{3})$/i.test(v)), [])
        assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('bin/') || v.startsWith('bin-cache/')), ['bin/manifest.json'])
        assert.strict.equal(fps.includes('src/processStatus.exe'), false)
        assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('test/_tmp/') || v.startsWith('sgud/')), [])
    })

})


//規格 D1、E2: 套件端不得自寫下載, 且不得於postinstall下載
describe(`no self-written download in src/ (D1, E2)`, function() {

    let fdSrc = './src'
    let fps = fs.readdirSync(fdSrc).filter((v) => v.endsWith('.mjs')).map((v) => path.join(fdSrc, v))

    it(`should not import fsDownloadFile nor fetch binaries from the master branch`, function() {
        assert.strict.equal(fps.length > 0, true)
        for (let fp of fps) {
            let c = fs.readFileSync(fp, 'utf8')
            assert.strict.equal(/fsDownloadFile(?!Verify)/.test(c), false, `${fp} imports fsDownloadFile`)
            assert.strict.equal(/raw\/refs\/heads|raw\.githubusercontent\.com|\bfetch\s*\(|https?:\/\/github\.com/.test(c), false, `${fp} downloads by itself`)
        }
    })

    it(`should have removed src/downloadFiles.mjs and scripts/install.mjs`, function() {
        assert.strict.equal(fs.existsSync('src/downloadFiles.mjs'), false)
        assert.strict.equal(fs.existsSync('scripts/install.mjs'), false)
    })

    it(`should not download in postinstall (D1)`, function() {
        let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'postinstall'), false)
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'install'), false)
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'preinstall'), false)
    })

})
