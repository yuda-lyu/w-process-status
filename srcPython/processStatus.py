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
    return base64.b64decode(v)


def readText(fn):
    #讀取檔案fn內文字
    import codecs
    with codecs.open(fn,'r',encoding='utf8') as f:
        return f.read()

    
def writeText(fn,str):
    #寫出文字str至檔案fn
    import codecs
    with codecs.open(fn,'w',encoding='utf8') as f:
        f.write(str)


def listpcs(name, opt):
    result = []
    for proc in psutil.process_iter(['pid', 'name', 'username', 'memory_info']):
        if proc.info['name'] and proc.info['name'].lower() == name.lower():
            try:
                st = psutil.Process(proc.info['pid']).status()
            except Exception:
                st = 'unknown'
            result.append({
                'name': proc.info['name'],
                'pid': proc.info['pid'],
                'ram': proc.info['memory_info'].rss // 1024, #轉kb
                'username': proc.info['username'],
                'status': st,
            })

    #print(result)
    #for p in result:
    #    print(f"{p['name']}, PID={p['pid']}, RAM={p['ram']}KB, Username={p['username']}, Status={p['status']}")

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
        state='error: [core]'+err["message"]

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
        state='error: [run]invalid length of argv'
    
    #print & flush
    print(state)
    sys.stdout.flush()


if True:
    #正式版
    
    #run
    run()
    
    
if False:
    #產生測試輸入b64
    #若測試階段python得要調用有安裝pykrige者
    
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

