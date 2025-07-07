import WProcessStatus from './src/WProcessStatus.mjs'
//import WProcessStatus from 'w-process-status/src/WProcessStatus.mjs'
//import WProcessStatus from 'w-process-status'


async function test() {

    let name = 'chrome.exe'

    let rs = await WProcessStatus(name)
    console.log('rs', rs)
    // rs => [
    //   {
    //     name: 'chrome.exe',
    //     pid: 400,
    //     ram: 169404,
    //     username: '{username}',
    //     status: 'running'
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 4984,
    //     ram: 211720,
    //     username: '{username}',
    //     status: 'running'
    //   },
    //   {
    //     name: 'chrome.exe',
    //     pid: 11648,
    //     ram: 2300,
    //     username: '{username}',
    //     status: 'stopped'
    //   }
    //   ...
    // ]

}
test()
    .catch((err) => {
        console.log(err)
    })


//node g.mjs
