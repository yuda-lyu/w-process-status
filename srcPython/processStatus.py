import psutil

#pip install psutil

def getError():
    import sys

    #exc_info
    type, message, traceback = sys.exc_info()

    #es
    es=[]
    while traceback:
        e={
            'name':traceback.tb_frame.f_code.co_name,
            'filename':traceback.tb_frame.f_code.co_filename,
        }
        es.append(e)
        traceback = traceback.tb_next

    #err
    err={
        'type':type,
        'message':str(message),
        'traceback':es,
    }

    return err


def j2o(v):
    #json轉物件
    import json
    return json.loads(v)


def o2j(v):
    #物件轉json
    import json
    return json.dumps(v, ensure_ascii=False)


def str2b64(v):
    #字串轉base64字串
    import base64
    v=base64.b64encode(v.encode('utf-8'))
    return str(v,'utf-8')
    

def b642str(v):
    #base64字串轉字串
    import base64
    return base64.b64decode(v).decode('utf-8')


def readText(fn):
    #讀取檔案fn內文字(newline=''不轉換換行, 同原codecs.open; codecs.open於Python 3.14起棄用, 每次執行會於stderr印DeprecationWarning, 混入錯誤訊息之state)
    with open(fn,'r',encoding='utf8',newline='') as f:
        return f.read()


def writeText(fn,str):
    #寫出文字str至檔案fn
    with open(fn,'w',encoding='utf8',newline='') as f:
        f.write(str)


def getExe(proc):
    #執行檔路徑, 無權限或無路徑(如System回空字串, System Idle Process無權限)為None
    #exe不放入process_iter之attrs: 會對全部行程查路徑, 每次執行多約2秒, 故只對名稱相符者查
    try:
        return proc.exe() or None
    except Exception:
        return None


def getPpidMap():
    #一次取得全部行程之ppid: Windows版psutil之Process.ppid()每次都重做一份全系統行程快照(每個相符行程約5ms), 故共用同一份
    #psutil._psplatform.ppid_map為psutil內部使用之函數(Process.children()), 取不到時回None, 改由各行程自行查詢
    try:
        return psutil._psplatform.ppid_map()
    except Exception:
        return None


def getPpid(proc, ppidMap):
    #父行程pid, 無法取得為None
    try:
        if ppidMap is not None and proc.pid in ppidMap:
            return ppidMap[proc.pid]
        return proc.ppid()
    except Exception:
        return None


def getParentCtime(ppid, cache):
    #ppid所指行程之建立時間(同一ppid只查一次): 數值, 'gone'為該行程不存在, 'unknown'為無法判定
    if ppid not in cache:
        try:
            cache[ppid] = psutil.Process(ppid).create_time()
        except psutil.NoSuchProcess:
            cache[ppid] = 'gone'
        except Exception:
            cache[ppid] = 'unknown'
    return cache[ppid]


def getParentAlive(proc, ppid, cache):
    #父行程是否存活: True存活, False已結束或其pid已被重用, None無法判定或本無父行程
    #判定同psutil之Process.parent(): ppid所指行程不存在, 或其建立時間晚於本行程(ppid已被其他行程重用), 即父行程已不在; 建立時間相同視為存活
    #不直接呼叫parent(): 它每次都重做全系統行程快照並重查建立時間, 每個相符行程約9ms; 且須自行區分False與None
    #使用端只有False才當孤兒處置, 故下列情形一律回None, 不得回False:
    #  ppid取不到, 或ppid為0或自身(System Idle Process與System本無父行程; psutil之parent()對pid 0固定回None, 照其結果會被誤判為False)
    #  本行程之建立時間取不到(AccessDenied, 查詢途中本行程消失等), 或父行程之建立時間因例外(AccessDenied等)無法判定
    if ppid is None or ppid == 0 or ppid == proc.pid:
        return None
    try:
        ctime = proc.create_time()
    except Exception:
        return None
    pctime = getParentCtime(ppid, cache)
    if pctime == 'gone':
        return False
    if pctime == 'unknown':
        return None
    return pctime <= ctime


def listpcs(name, opt):
    result = []
    ppidMap = getPpidMap()
    cache = {}
    for proc in psutil.process_iter(['pid', 'name', 'username', 'memory_info']):
        if proc.info['name'] and proc.info['name'].lower() == name.lower():
            try:
                st = psutil.Process(proc.info['pid']).status()
            except Exception:
                st = 'unknown'
            ppid = getPpid(proc, ppidMap)
            result.append({
                'name': proc.info['name'],
                'pid': proc.info['pid'],
                'ram': proc.info['memory_info'].rss // 1024, #轉kb
                'username': proc.info['username'],
                'status': st,
                'exe': getExe(proc),
                'ppid': ppid,
                'parentAlive': getParentAlive(proc, ppid, cache),
            })

    #print(result)
    #for p in result:
    #    print(f"{p['name']}, PID={p['pid']}, RAM={p['ram']}KB, Username={p['username']}, Status={p['status']}, Exe={p['exe']}, Ppid={p['ppid']}, ParentAlive={p['parentAlive']}")

    return result


def shellListpcs(fpIn, fpOut, opt):
    
    #readText
    c=readText(fpIn)

    #j2o
    rin=j2o(c)
    # print(rin)
    # print(rin['src'])
    # print(rin['pred'])

    #kgn
    rout=listpcs(rin['name'],opt)
    # print(rout)
    
    #o2j
    jout=o2j(rout)
    
    #writeText
    writeText(fpOut,jout)


def core(b64):
    state=''

    try:

        #b642str
        s=b642str(b64)
        # print(s)

        #j2o
        o=j2o(s)
        # print(o)

        #params
        fpIn=o['fpIn']
        fpOut=o['fpOut']
        opt=o['opt']

        #shellKgn
        shellListpcs(fpIn, fpOut, opt)

        state='success'
    except:
        err=getError()
        state='error: '+str(err["message"])

    return state


def run():
    import sys

    #由外部程序呼叫或直接給予檔案路徑
    state=''
    argv=sys.argv
    #argv=['','']
    if len(argv)==2:
        
        #b64
        b64=sys.argv[1]
        
        #core
        state=core(b64)
        
    else:
        #print(sys.argv)
        state='error: invalid length of argv'
    
    #print & flush
    print(state)
    sys.stdout.flush()


if True:
    #正式版
    
    #run
    run()
    
    
if False:
    #產生測試輸入b64
    
    #inp
    inp={
        'fpIn':'fpIn.json',
        'fpOut':'fpOut.json',
        'opt':{
        },
    }
    # print(o2j(inp))
    
    #str2b64
    b64=str2b64(o2j(inp))
    print(b64)

    #core
    state=core(b64)

    print(state)

