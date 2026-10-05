"""Original 2D experience film. Python + Pillow + numpy + ffmpeg; no remote calls.

Usage: python demo/render.py --prepare-audio
       python demo/render.py --frames-only
       python demo/render.py --render
Set AP_FONT_REGULAR / AP_FONT_BOLD to CJK font files when not on Windows.
"""
from pathlib import Path
import argparse, json, math, os, shutil, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE=Path(__file__).resolve().parent
W,H,FPS,DURATION=1280,720,24,126
BG='#102c35'; CREAM='#f4eee0'; MUTE='#a9bfc1'; AMBER='#eeb668'; TEAL='#78c7c1'; CORAL='#db8f80'
REG=os.environ.get('AP_FONT_REGULAR',str(Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts/msyh.ttc'))
BOLD=os.environ.get('AP_FONT_BOLD',str(Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts/msyhbd.ttc'))
FONT={}
def font(n,bold=False):
    key=(n,bold)
    if key not in FONT:FONT[key]=ImageFont.truetype(BOLD if bold else REG,n)
    return FONT[key]
def smooth(x):
    x=min(1,max(0,x));return x*x*(3-2*x)
def ease(t,a,b):return smooth((t-a)/(b-a))
def lerp(a,b,p):return a+(b-a)*p
def text(draw,xy,st,size=28,fill=CREAM,bold=False,anchor=None):
    draw.text(xy,st,font=font(size,bold),fill=fill,anchor=anchor)
def line(draw,pts,color,width=3):draw.line(pts,fill=color,width=width,joint='curve')
def rounded(draw,box,fill,r=20,outline=None,width=1):draw.rounded_rectangle(tuple(map(int,box)),r,fill=fill,outline=outline,width=width)
def wrap(st,n=30):
    lines=[]
    while len(st)>n:
        k=max(st.rfind('，',0,n+1),st.rfind('。',0,n+1),st.rfind('：',0,n+1))
        k=k+1 if k>n//2 else n;lines.append(st[:k]);st=st[k:]
    if st:lines.append(st)
    return lines

def background():
    arr=np.zeros((H,W,3),dtype=np.uint8)
    for y in range(H):
        p=y/H
        for i,(a,b) in enumerate(zip((13,35,46),(26,59,64))):arr[y,:,i]=int(lerp(a,b,p))
    im=Image.fromarray(arr);d=ImageDraw.Draw(im)
    # Distant city is kept quiet so the narrative prop stays salient.
    for x,y,ww,hh in [(0,270,110,170),(95,230,90,210),(170,290,115,145),(310,220,90,210),(1090,235,95,190),(1170,185,130,265)]:
        rounded(d,(x,y,x+ww,y+hh),'#193640',5)
        for xx in range(x+17,x+ww-9,25):
            for yy in range(y+22,y+hh-10,37):
                if (xx+yy)%5<2:rounded(d,(xx,yy,xx+6,yy+11),'#325259',2)
    d.rectangle((0,475,W,H),fill='#25464b')
    d.polygon([(0,560),(W,537),(W,720),(0,720)],fill='#173840')
    d.line((0,570,W,545),fill='#638083',width=2)
    # Bus stop and rain shelter.
    d.polygon([(605,193),(1160,193),(1200,216),(573,216)],fill='#4c6d70')
    d.polygon([(585,217),(1185,217),(1171,230),(593,230)],fill='#0f2d36')
    d.line((618,221,618,487),fill='#678286',width=7);d.line((1150,224,1150,487),fill='#59767a',width=7)
    rounded(d,(1010,249,1090,359),'#254850',10,outline='#54797c',width=2)
    text(d,(1050,268),'末班',22,MUTE,True,'mt');text(d,(1050,301),'23:10',19,AMBER,False,'mt')
    return im
BASE=background()

def rain(d,t,opacity=1):
    for j in range(160):
        xx=((j*97.3+t*73)%1380)-60; yy=((j*47.7+t*310)%760)-20
        col=(int(63+37*opacity),int(92+45*opacity),int(97+43*opacity))
        d.line((xx,yy,xx-7,yy+22),fill=col,width=1)
    for j in range(11):
        xx=70+j*117; yy=559+(j*23)%88;p=(t*1.1+j*.19)%1
        d.arc((xx-27*p,yy-4*p,xx+27*p,yy+4*p),0,340,fill='#4e7478',width=1)

def umbrella(d,x,y,scale=1,angle=0):
    # Deliberately warm and singular colour = the stable attention object.
    rr=108*scale
    pts=[]
    for a in np.linspace(math.pi,2*math.pi,45):pts.append((x+rr*math.cos(a),y+rr*.74*math.sin(a)))
    pts.extend([(x+rr,y),(x+rr*.6,y-10*scale),(x+rr*.2,y),(x-rr*.2,y-10*scale),(x-rr*.6,y),(x-rr,y)])
    d.polygon(pts,fill=AMBER);d.arc((x-rr,y-rr*.74,x+rr,y+rr*.74),180,360,fill='#ffdaa2',width=max(1,int(3*scale)))
    for s in [-.6,0,.6]:d.line((x,y-rr*.74,x+s*rr,y-4),fill='#cc9550',width=max(1,int(2*scale)))
    d.line((x,y-rr*.78,x,y+95*scale),fill='#f1d8ab',width=max(2,int(4*scale)))
    d.arc((x,y+81*scale,x+21*scale,y+105*scale),0,180,fill='#f1d8ab',width=max(2,int(4*scale)))

def person(d,x,y,t,walk=0):
    step=math.sin(t*6)*9*walk
    # Shoes, trousers, coat, head and scarf; no stock assets.
    line(d,[(x-9,y-32),(x-15-step,y+5)],'#91a0a4',10);line(d,[(x+8,y-32),(x+15+step,y+5)],'#b8c0bf',10)
    rounded(d,(x-24-step,y+3,x-7-step,y+10),'#0a252e',4);rounded(d,(x+10+step,y+3,x+28+step,y+10),'#0a252e',4)
    d.polygon([(x-22,y-107),(x+22,y-107),(x+32,y-28),(x-31,y-28)],fill='#d0d0ba')
    line(d,[(x+18,y-94),(x+35,y-72),(x+39,y-109)],'#d0d0ba',12)
    d.ellipse((x-19,y-145,x+19,y-108),fill='#e1b494')
    d.pieslice((x-22,y-151,x+21,y-105),175,355,fill='#20363d');d.ellipse((x-24,y-135,x-4,y-114),fill='#20363d')
    line(d,[(x-21,y-107),(x+18,y-108),(x+25,y-91)],'#dd8f76',9)

def cat(d,x,y,t,visible=1):
    # Same location before/after reveal. It emerges from darkness, not from nowhere.
    dark=visible<.05
    body='#25464b' if dark else '#cbd3c5';head='#25464b' if dark else '#e2dac3'
    d.ellipse((x-40,y-23,x+37,y+21),fill=body)
    d.ellipse((x-25,y-53,x+17,y-16),fill=head)
    d.polygon([(x-27,y-44),(x-27,y-67),(x-9,y-52)],fill=head);d.polygon([(x+3,y-53),(x+20,y-65),(x+17,y-38)],fill=head)
    if visible>.05:
        d.polygon([(x-24,y-48),(x-24,y-59),(x-16,y-51)],fill='#c9978b');d.polygon([(x+9,y-52),(x+17,y-59),(x+15,y-46)],fill='#c9978b')
        d.arc((x-20,y-44,x-8,y-34),0,180,fill='#344c50',width=2);d.arc((x+1,y-44,x+12,y-34),0,180,fill='#344c50',width=2)
        d.polygon([(x-6,y-32),(x,y-32),(x-3,y-28)],fill='#b48376')
        for side in [-1,1]:
            line(d,[(x+side*10,y-26),(x+side*31,y-31)],'#81918c',1)
    bend=math.sin(t*1.1)*4
    d.arc((x+7,y-7,x+68,y+31+bend),180,355,fill=body,width=9)

def scene(t,mini=False):
    im=BASE.copy();d=ImageDraw.Draw(im);rain(d,t,.7)
    # Bus enters from left, then waits while the strange action unfolds.
    bx=lerp(-470,45,ease(t,6,11)) if t<38 else lerp(45,-520,ease(t,38,43))
    if t>5:
        rounded(d,(bx,303,bx+456,513),'#344f54',27)
        rounded(d,(bx+15,319,bx+343,415),'#8ca6a0',10)
        d.polygon([(bx+16,320),(bx+160,320),(bx+81,415),(bx+16,415)],fill='#688b8b')
        rounded(d,(bx+357,321,bx+431,501),'#263e45',6)
        line(d,[(bx+393,322),(bx+393,500)],'#61827d',2)
        d.ellipse((bx+57,480,bx+107,535),fill='#0c272f');d.ellipse((bx+337,480,bx+387,535),fill='#0c272f')
        d.ellipse((bx+68,491,bx+96,521),fill='#567473');d.ellipse((bx+348,491,bx+376,521),fill='#567473')
        rounded(d,(bx+368,289,bx+427,308),AMBER,5);text(d,(bx+397,290),'末班',13,'#314448',True,'mt')
        rounded(d,(bx+430,431,bx+450,445),'#f9d295',4)
    # Bench is spatially constant. The dark lower region initially conceals the cat.
    rounded(d,(797,380,995,405),'#688480',7);rounded(d,(790,431,1005,451),'#78918a',5)
    line(d,[(819,450),(812,507)],'#617d7b',7);line(d,[(978,450),(986,507)],'#617d7b',7)
    reveal=ease(t,27.5,30.7)
    cat(d,939,517,t,1 if reveal>.05 else 0)
    if 23<t<27.5:
        d.arc((960,514,1002,544),190,330,fill='#809b93',width=4)
    if reveal>0:
        glow=Image.new('RGBA',(W,H));g=ImageDraw.Draw(glow);g.ellipse((751,367,1100,579),fill=(255,211,129,int(14*reveal)));im=Image.alpha_composite(im.convert('RGBA'),glow).convert('RGB');d=ImageDraw.Draw(im)
    # Girl places the umbrella, then catches the bus.
    gx=lerp(674,814,ease(t,11.5,16)) if t<18 else lerp(814,424,ease(t,18,24))
    if t<26:person(d,gx,483,t,1 if 11.5<t<16 or 18<t<24 else 0)
    ux=lerp(712,891,ease(t,12,17));uy=lerp(320,410,ease(t,15,19))
    umbrella(d,ux,uy,.92)
    if reveal>0:
        crop=(int(lerp(0,600,reveal)),int(lerp(0,218,reveal)),int(lerp(W,1210,reveal)),int(lerp(H,580,reveal)))
        im=im.crop(crop).resize((W,H),Image.Resampling.LANCZOS)
    return im

NARRATION=json.loads((HERE/'narration.json').read_text('utf-8'))
def caption(im,t):
    entry=next((n for n in NARRATION if n['start']<=t<n['end']),None)
    if not entry:return
    d=ImageDraw.Draw(im)
    lines=wrap(entry['text'],30)
    # Split long captions sequentially; always leave at least ~2 seconds per chunk.
    idx=min(len(lines)-1,int((t-entry['start'])/(entry['end']-entry['start'])*len(lines)))
    st=lines[idx];width=d.textlength(st,font=font(29))
    rounded(d,(W/2-width/2-24,632,W/2+width/2+24,691),'#0c232c',16)
    text(d,(W/2,646),st,29,CREAM,False,'mt')

def badge(d,left,top,txt,color=TEAL):
    width=d.textlength(txt,font=font(18))+30;rounded(d,(left,top,left+width,top+35),'#23434a',17,outline=color);text(d,(left+15,top+6),txt,18,color)

def artwork(t):
    if t<42:im=scene(t);d=ImageDraw.Draw(im)
    else:im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    # A quiet identity line and a precise film position, not a presentation title bar.
    text(d,(56,35),'AP / 观众心景',18,MUTE,False)
    text(d,(1225,35),f'{int(t)//60:02}:{int(t)%60:02}  /  02:06',16,MUTE,False,'rt')
    if t<4.5:
        # A compelling question without naming the desired emotion.
        text(d,(64,113),'给谁的伞',66,CREAM,True)
        text(d,(68,205),'一个小动作。两次重新理解。',25,MUTE)
    elif 11<t<27:
        text(d,(70,116),'她为什么把伞留在这里？',32,CREAM,True)
    elif 28.2<t<42:
        text(d,(65,109),'原来，那里并不是空的。',36,CREAM,True)
    elif 42<=t<49:
        text(d,(75,124),'先别急着听解释。',58,CREAM,True)
        text(d,(79,215),'留住刚才的第一反应',27,AMBER)
        for i,(a,b) in enumerate([('你注意到了什么？','一个物体、一个动作，也可能没特别注意。'),('感受发生过变化吗？','用你自己的词。无感、猜到了，都可以。')]):
            rounded(d,(77,292+i*124,1200,393+i*124),'#1b3c44',20)
            text(d,(104,312+i*124),a,30,CREAM,True);text(d,(105,355+i*124),b,21,MUTE)
    elif 49<=t<59:
        text(d,(72,116),'有一个地方，需要解释。',47,CREAM,True)
        shot=scene(20).resize((560,315),Image.Resampling.LANCZOS);im.paste(shot,(69,231));d=ImageDraw.Draw(im)
        badge(d,660,240,'制作前的预测 01')
        text(d,(665,305),'意外的动作',33,AMBER,True);text(d,(665,360),'注意 → 问题保持',32,CREAM,True)
        text(d,(667,416),'可能是：“为什么把伞留下？”',22,MUTE)
        text(d,(667,464),'没有注意 / 没有疑问 → 这项未命中',19,CORAL)
    elif 59<=t<67:
        text(d,(72,116),'同一把伞，新的解释。',47,CREAM,True)
        shot=scene(35).resize((560,315),Image.Resampling.LANCZOS);im.paste(shot,(69,231));d=ImageDraw.Draw(im)
        badge(d,660,240,'制作前的预测 02')
        text(d,(665,305),'看见照顾的对象',32,AMBER,True);text(d,(665,363),'疑问减少，温暖可能出现',28,CREAM,True)
        text(d,(667,422),'提前猜到 → 意外预测未命中',21,CORAL)
        text(d,(667,468),'理解了但无感 → 温暖预测未命中',20,CORAL)
    elif 67<=t<74:
        text(d,(72,116),'感受，不是一个总开关。',47,CREAM,True)
        items=[('惊','发生了没料到的事',AMBER),('理解','线索终于对得上',TEAL),('温暖','看见具体的照顾',CORAL)]
        for i,(a,b,c) in enumerate(items):
            x=73+i*396;rounded(d,(x,262,x+362,518),'#1b3d44',24);text(d,(x+28,300),a,50,c,True);text(d,(x+29,394),b,23,CREAM);line(d,[(x+30,459),(x+304,459)],c,2)
        text(d,(640,553),'可以同时存在，也可以只出现其中一部分。',25,MUTE,False,'mt')
    elif 74<=t<77:
        text(d,(72,165),'听完解释后，你现在怎么想？',47,CREAM,True)
        text(d,(77,270),'先写下新的第一反应。再往下看。',29,TEAL)
        text(d,(78,392),'不用认同。也不用选我们提供的词。',27,MUTE)
    elif 77<=t<86:
        text(d,(72,116),'“等等，这不就是套路吗？”',47,CREAM,True)
        rounded(d,(77,250,1203,523),'#1c3c44',27)
        text(d,(112,289),'这一层也值得记录。',37,AMBER,True)
        text(d,(114,361),'自发产生的怀疑  ≠  被这句话提示后的怀疑',28,CREAM)
        text(d,(114,423),'前者先记录；后者单独标注。不能混在一起。',24,MUTE)
        text(d,(81,560),'怀疑是探索项，目前没有人群比例预测。',21,CORAL)
    elif 86<=t<97:
        text(d,(72,116),'你可以让这次预测失败。',49,CREAM,True)
        checks=[('“我一开始就猜到了。”','意外预测未命中'),('“我根本没有被打动。”','温暖预测未命中'),('“我觉得解释很牵强。”','保留为反证与改进依据')]
        for i,(a,b) in enumerate(checks):
            y=235+i*106;rounded(d,(77,y,1203,y+84),'#1b3b43',19);text(d,(103,y+22),a,28,CREAM);text(d,(1180,y+28),b,22,CORAL,False,'rt')
        text(d,(640,574),'不能把所有答案，都算成理论正确。',27,AMBER,True,'mt')
    elif 97<=t<108:
        text(d,(72,116),'创作，是在比较不同的可能。',46,CREAM,True)
        for i,(tag,shotTime,sub) in enumerate([('先看见小猫',35,'更早理解 · 更少意外'),('让空椅等待更久',20,'问题还在 · 也可能走神')]):
            x=74+i*577;pic=scene(shotTime).resize((550,310),Image.Resampling.LANCZOS);im.paste(pic,(x,232));d=ImageDraw.Draw(im);badge(d,x+16,247,tag);text(d,(x+15,557),sub,24,CREAM)
    elif 108<=t<118:
        text(d,(72,116),'把“感觉不对”，变成可检验的修改。',42,CREAM,True)
        chart=(98,258,820,541);d.line((chart[0],chart[3],chart[2],chart[3]),fill='#527578',width=2)
        points=[(0,.15),(.16,.3),(.31,.8),(.45,.65),(.53,.3),(.7,.1),(1,.02)]
        points2=[(0,.08),(.16,.08),(.31,.14),(.45,.21),(.53,.58),(.7,.72),(1,.78)]
        for points,col in [(points,AMBER),(points2,TEAL)]:
            pairs=[(chart[0]+x*(chart[2]-chart[0]),chart[3]-y*(chart[3]-chart[1])) for x,y in points];line(d,pairs,col,5)
            for x,y in pairs:d.ellipse((x-5,y-5,x+5,y+5),fill=col)
        text(d,(101,567),'示意曲线 · 实际公式输出与比较数据随片附带',18,MUTE)
        for i,(a,b,c) in enumerate([('提出预测','线索与节奏',AMBER),('留下反证','真实的观众反馈',CORAL),('逐步校准','也保留个体差异',TEAL)]):
            text(d,(881,257+i*101),a,28,c,True);text(d,(883,300+i*101),b,21,MUTE)
    else:
        im=scene(36);shade=Image.new('RGBA',(W,H),(8,28,37,180));im=Image.alpha_composite(im.convert('RGBA'),shade).convert('RGB');d=ImageDraw.Draw(im)
        text(d,(70,77),'AP / 观众心景',20,MUTE);text(d,(76,187),'何时吸引。何时解释。',52,CREAM,True);text(d,(76,264),'何时，留白。',62,AMBER,True)
        text(d,(80,402),'一个可修改、可否定、可逐步校准的创作工具。',26,CREAM)
        text(d,(80,463),'你的真实反应，比一个好看的分数更重要。',25,MUTE)
    caption(im,t)
    # Quiet timeline so viewers retain agency.
    d=ImageDraw.Draw(im);d.rectangle((0,715,int(W*t/DURATION),719),fill=TEAL)
    return im

def prepare_audio():
    sr=48000;N=int(DURATION*sr);audio=np.zeros(N,dtype=np.float32)
    rng=np.random.default_rng(71)
    # Original ambient rain, filtered noise. No copyrighted samples or jump scares.
    rainnoise=rng.normal(0,1,N).astype(np.float32)
    rainnoise=np.convolve(rainnoise,np.ones(9,dtype=np.float32)/9,mode='same')
    tt=np.arange(N,dtype=np.float32)/sr
    rainenv=np.where(tt<42,.020,np.where(tt>118,.009,.002)).astype(np.float32)
    audio+=rainnoise*rainenv
    # Sparse pentatonic felt-like tones: settle rather than dominate the voice.
    notes=[(0,220),(3,329.63),(6,392),(10,293.66),(17,329.63),(23,293.66),(28.6,440),(30.3,523.25),(33,659.25),(36,523.25),(39,440),(48.9,329.63),(58.9,440),(66.8,392),(76.8,293.66),(96.8,392),(107.8,440),(117.7,523.25),(121,440)]
    for start,f in notes:
        dur=4;local=np.arange(int(sr*dur),dtype=np.float32)/sr
        env=(1-np.exp(-local*24))*np.exp(-local/1.3)
        tone=(np.sin(2*np.pi*f*local)+.2*np.sin(2*np.pi*2*f*local)+.1*np.sin(2*np.pi*3*f*local))*env*.043
        a=int(start*sr);b=min(N,a+len(tone));audio[a:b]+=tone[:b-a]
    # A restrained two-note bus bell. Less salient than speech, never a loud sting.
    for start,f in [(8,880),(8.22,660)]:
        local=np.arange(int(.48*sr),dtype=np.float32)/sr
        tone=np.sin(2*np.pi*f*local)*np.exp(-local*8)*.018;a=int(start*sr);audio[a:a+len(tone)]+=tone
    reports=[]
    for n in NARRATION:
        source=HERE/'audio'/f"{n['id']}.wav"
        with wave.open(str(source)) as wf:dur=wf.getnframes()/wf.getframerate()
        available=n['end']-n['start']-.18;factor=max(1,dur/available)
        cmd=['ffmpeg','-v','error','-i',str(source),'-af',f'atempo={factor:.6f},highpass=f=80,lowpass=f=9000','-ar',str(sr),'-ac','1','-f','f32le','pipe:1']
        data=np.frombuffer(subprocess.check_output(cmd),dtype='<f4').copy()
        rms=float(np.sqrt(np.mean(data*data)));gain=min(3,.15/max(rms,1e-8));data=.72*np.tanh(data*gain/.72)
        a=int(n['start']*sr);b=min(N,a+len(data));audio[a:b]+=data[:b-a]
        reports.append({**n,'sourceDuration':dur,'tempoFactor':factor,'actualEnd':n['start']+len(data)/sr,'fitsSlot':n['start']+len(data)/sr<=n['end']+.08})
    # Soft gain guard does not flatten speech dynamics.
    peak=float(np.max(np.abs(audio)));audio*=min(1,.86/max(peak,1e-8))
    stereo=np.stack([audio,audio],axis=1)
    with wave.open(str(HERE/'soundtrack.wav'),'wb') as wf:wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(sr);wf.writeframes((stereo*32767).astype('<i2').tobytes())
    (HERE/'audio-timing.json').write_text(json.dumps({'source':'local SAPI; original synthesized ambience and music','duration':DURATION,'maxPeakBeforeGuard':peak,'segments':reports},ensure_ascii=False,indent=2),'utf-8')
    assert all(x['fitsSlot'] for x in reports),'Narration overlap'

def stills():
    target=HERE/'frames';target.mkdir(exist_ok=True)
    for t in [2,16,25,31,38,45,54,63,70,75,81,91,102,112,122]:artwork(t).save(target/f'{t:03}.png')
    cover=scene(18);over=Image.new('RGBA',(W,H),(7,26,35,100));cover=Image.alpha_composite(cover.convert('RGBA'),over).convert('RGB');d=ImageDraw.Draw(cover)
    text(d,(77,71),'AP / 观众心景 · 126 秒体验',22,MUTE)
    text(d,(69,177),'给谁的伞',86,CREAM,True)
    text(d,(77,298),'先经历。再看看，我们猜对了什么。',29,AMBER)
    rounded(d,(78,572,591,635),'#193a43',29,outline='#6d9694',width=2);text(d,(109,589),'一个可被你否定的情绪预测实验',23,CREAM)
    cover.save(HERE/'cover.png')

def render():
    if not (HERE/'soundtrack.wav').exists():prepare_audio()
    target=HERE/'experience.rendering.mp4'
    cmd=['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-i',str(HERE/'soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-t',str(DURATION),str(target)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for frame in range(DURATION*FPS):
            proc.stdin.write(artwork(frame/FPS).tobytes())
            if frame%(FPS*10)==0:print(f'rendered {frame//FPS}/{DURATION}s',flush=True)
    finally:proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('ffmpeg failed; partial retained')
    target.replace(HERE/'experience.mp4')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--prepare-audio',action='store_true');p.add_argument('--frames-only',action='store_true');p.add_argument('--render',action='store_true');a=p.parse_args()
    if a.prepare_audio:prepare_audio()
    if a.frames_only:stills()
    if a.render:render();stills()
