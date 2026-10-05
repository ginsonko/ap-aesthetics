(function(root,factory){const C=typeof module==='object'&&module.exports?require('./catalog.js'):root.APCatalog;const a=factory(C);if(typeof module==='object'&&module.exports)module.exports=a;else root.APExamples=a;})(globalThis,function(C){
  'use strict';
  const cues = overrides => ({actualNovel:.15,predictedNovel:.1,actualExpected:.8,predictedExpected:.8,explanation:.55,evidence:.7,resolution:.1,question:.15,load:.3,detail:.5,continuity:.8,relevance:.7,progress:.2,care:.2,memory:.1,loss:.1,threat:0,safety:.9,selfRelevance:.5,unfairness:0,selfResponsibility:0,pleasant:.5,sensoryCost:.02,craft:.6,playfulness:0,scale:.1,expectedInterval:2,actualInterval:2,order:.9,spatial:.9,distance:1,...overrides});
  const pending=(id,label,p,reward,penalty,extra={})=>({id,label,status:'pending',p,reward,penalty,baselineGood:0,baselineBad:0,evidence:'改编分镜的人工作品线索标注',...extra});
  const base={schema:'ap-aesthetics/1',title:'麦琪的礼物 · 180 秒改编',subject:'target-viewer',style:'bittersweet',profile:{...C.profile},parameters:{...C.parameters},emotionModel:JSON.parse(JSON.stringify(C.emotions)),annotationNote:'原作情节取自欧·亨利《麦琪的礼物》；分段时长、线索强度、观众先验与配乐间隔均为本原型人工假设。模型未自动阅读影片，输出不是人类测量。',scenes:[
    {id:'m1',title:'一美元八十七美分',description:'德拉数钱。明天就是圣诞节，她希望给吉姆一份像样的礼物。',object:'夫妻与礼物',duration:18,cues:cues({explanation:.35,evidence:.65,question:.55,detail:.65,care:.25,loss:.3,relevance:.55}),outcomesKnown:true,outcomes:[pending('gift','买到合适礼物',.3,.65,0)]},
    {id:'m2',title:'两件珍宝',description:'镜头建立德拉的长发与吉姆珍爱的祖传金表，让后面的选择有具体代价。',object:'夫妻与礼物',duration:24,cues:cues({explanation:.58,evidence:.85,question:.45,care:.4,memory:.2,craft:.75,progress:.3,detail:.55}),outcomesKnown:true,outcomes:[]},
    {id:'m3',title:'卖掉长发',description:'她决定卖掉长发。困境有了解法，也真实失去了一件珍爱的东西。',object:'夫妻与礼物',duration:23,cues:cues({actualNovel:.85,predictedNovel:.25,actualExpected:.4,predictedExpected:.65,explanation:.7,evidence:.85,question:.4,resolution:.2,care:.6,loss:.8,selfRelevance:.65,detail:.8,progress:.5}),outcomesKnown:true,outcomes:[pending('gift','买到合适礼物',.95,.65,0)]},
    {id:'m4',title:'买到表链',description:'她想象吉姆拿出金表，配上这条表链的样子。送礼期待变得具体。',object:'夫妻与礼物',duration:23,cues:cues({explanation:.78,evidence:.9,resolution:.45,question:.2,care:.65,loss:.55,progress:.7,pleasant:.6,memory:.15}),outcomesKnown:true,outcomes:[{id:'gift',label:'买到合适礼物',status:'realized',actualPositive:.5,actualNegative:0,evidence:'已经买到表链'},pending('use','礼物能够使用',.95,.7,0),pending('reject','对短发的拒绝',.25,0,.5)]},
    {id:'m5',title:'他为什么愣住',description:'吉姆看到短发愣住。观众暂时有多种解释，原先预期的直接喜悦没有出现。',object:'夫妻与礼物',duration:27,cues:cues({actualNovel:.9,predictedNovel:.15,actualExpected:.1,predictedExpected:.9,explanation:.2,evidence:.6,resolution:0,question:.9,load:.6,detail:.3,care:.35,loss:.45,threat:.45,safety:.65,progress:.72,actualInterval:3}),outcomesKnown:true,outcomes:[pending('reject','对短发的拒绝',.65,0,.5)]},
    {id:'m6',title:'发梳揭晓',description:'他仍然爱她，并拿出她心仪的发梳。表情有了解释，梳子暂时无法用于短发。',object:'夫妻与礼物',duration:25,cues:cues({actualNovel:.95,predictedNovel:.2,actualExpected:.75,predictedExpected:.85,explanation:.85,evidence:.95,resolution:.65,question:.4,detail:.9,care:.9,loss:.65,memory:.25,safety:.98,selfRelevance:.7,progress:.83}),outcomesKnown:true,outcomes:[{id:'reject',label:'对短发的拒绝',status:'ruled_out',actualPositive:0,actualNegative:0,evidence:'明确表达仍然爱她'}]},
    {id:'m7',title:'他也卖掉了金表',description:'德拉拿出表链，吉姆说明自己卖掉金表买了发梳。此前线索被重新组织，双方的选择互相映照。',object:'夫妻与礼物',duration:17,cues:cues({actualNovel:1,predictedNovel:.08,actualExpected:.9,predictedExpected:.95,explanation:.98,evidence:1,resolution:.9,question:.06,detail:1,care:1,loss:.8,memory:.35,selfRelevance:.85,craft:.95,progress:.98,actualInterval:2.4}),outcomesKnown:true,outcomes:[{id:'use',label:'礼物能够立即使用',status:'ruled_out',actualPositive:0,actualNegative:0,evidence:'金表与长发均已卖掉，实用期待落空'}]},
    {id:'m8',title:'把礼物收好，先吃饭吧',description:'两人收好礼物，回到平常的生活动作。物质问题没有消失，互相照顾的关系得以保留。',object:'夫妻与礼物',duration:23,cues:cues({actualNovel:.1,predictedNovel:.08,actualExpected:.95,predictedExpected:.95,explanation:.98,evidence:1,resolution:.8,question:0,load:.12,detail:.2,care:.95,loss:.3,memory:.6,selfRelevance:.8,pleasant:.75,craft:.8,progress:1,actualInterval:2}),outcomesKnown:true,outcomes:[]}
  ]};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const variants=[
    {id:'original',label:'完整铺垫',description:'保留珍宝、相互牺牲与结尾静场。'},
    {id:'spoiler',label:'提前揭晓',description:'第 2 段提前透露吉姆卖表；后续信息不再同样意外，关系价值仍可存在。'},
    {id:'no_setup',label:'删去珍宝铺垫',description:'移除第 2 段，降低后段关系/代价线索的可理解度；变化假设可编辑。'},
    {id:'long_wait',label:'延长无信息等待',description:'“他为什么愣住”延长至 75 秒，同时降低新细节供给。'},
    {id:'no_tail',label:'删去结尾静场',description:'末段缩至 2 秒，观察情绪恢复与回味输入的变化。'}
  ];
  function make(id='original'){
    const d=clone(base);d.variant=id;
    if(id==='spoiler'){
      d.title+=' · 提前揭晓';const a=d.scenes[1],b=d.scenes[4],c=d.scenes[5],e=d.scenes[6];
      a.description+=' 这个版本在此额外给出吉姆卖表买梳的镜头。';a.cues.actualNovel=.95;a.cues.predictedNovel=.1;a.cues.care=.75;a.cues.loss=.65;a.cues.explanation=.85;
      a.outcomes.push(pending('use','礼物能使用',.05,.7,0));
      d.scenes[3].outcomes=d.scenes[3].outcomes.map(o=>o.id==='use'?{...o,p:.05}:o.id==='reject'?{...o,p:.05}:o);
      b.cues.predictedNovel=.85;b.cues.actualExpected=.8;b.cues.explanation=.8;b.cues.question=.2;b.cues.threat=.05;b.outcomes[0].p=.05;
      c.cues.predictedNovel=.9;c.cues.question=.1;c.cues.explanation=.95;e.cues.predictedNovel=.96;e.cues.resolution=.15;
    } else if(id==='no_setup'){
      d.title+=' · 缺少铺垫';d.scenes.splice(1,1);
      for(const s of d.scenes.slice(1)){s.cues.care*=.65;s.cues.loss*=.7;s.cues.evidence*=.8;s.cues.explanation*=.8;s.cues.selfRelevance*=.8;}
    } else if(id==='long_wait'){
      d.title+=' · 久等';d.scenes[4].duration=75;d.scenes[4].cues.detail=.02;d.scenes[4].cues.care=.15;
    } else if(id==='no_tail'){
      d.title+=' · 仓促收尾';d.scenes[7].duration=2;
    }
    return d;
  }
  function blank(){return {schema:'ap-aesthetics/1',title:'我的作品',subject:'target-viewer',style:'bittersweet',profile:clone(C.profile),parameters:clone(C.parameters),emotionModel:clone(C.emotions),annotationNote:'请标注观众此刻实际可见的线索；未知保留空白。',scenes:[{id:'scene-1',title:'第一段',description:'',duration:10,object:'主要注意对象',outcomesKnown:false,outcomes:[],cues:Object.fromEntries(C.inputs.map(f=>[f.id,null]))}]};}
  return {make,blank,variants,base};
});
