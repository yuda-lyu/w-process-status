import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
    fns: 'WProcessStatus.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'path': 'path',
        'os': 'os',
        'fs': 'fs',
        'process': 'process',
        'child_process': 'child_process',
        'url': 'url',
        'crypto': 'crypto',
        'stream': 'stream',
        'stream/promises': 'promises',
    },
    external: [
        'path',
        'os',
        'fs',
        'process',
        'child_process',
        'url',
        'crypto',
        'stream',
        'stream/promises',
    ],
})

