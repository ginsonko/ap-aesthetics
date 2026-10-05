(function(root, factory) {
  const cat = typeof module === 'object' && module.exports ? require('./catalog.js') : root.APCatalog;
  const api = factory(cat);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.APEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C) {
  'use strict';
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const clip = x => Math.max(0, Math.min(1, x));
  const pos = x => Math.max(0,x);
  const clone = x => JSON.parse(JSON.stringify(x));
  const safeKeys = x => Object.keys(x).every(k=>!['__proto__','constructor','prototype'].includes(k));
  const avg = xs => xs.length && xs.every(finite) ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  const calc = (args,fn) => args.every(finite) ? fn(...args) : null;
  const smooth = (old,target,dt,half) => target===null ? null : (old===null?target:old*Math.pow(2,-dt/half)+target*(1-Math.pow(2,-dt/half)));
  function decayRate(old,rate,dt,half) {
    const lam=Math.LN2/half,d=Math.exp(-lam*dt); return old*d+rate*(1-d)/lam;
  }
  function expression(node,state) {
    if(finite(node)) return node;
    if(!node || typeof node!=='object') throw new Error('组合项必须是有限数字、ref 或允许的运算');
    if(typeof node.ref==='string') {
      if(!C.defs.some(d=>d.id===node.ref)) throw new Error('未知感受引用：'+node.ref);
      return state[node.ref] ?? null;
    }
    const args=(node.args||[]).map(n=>expression(n,state));
    if(!args.length || args.some(v=>v===null)) return null;
    switch(node.op){
      case 'mul': return args.reduce((a,b)=>a*b,1);
      case 'mean':return avg(args);
      case 'min':return Math.min(...args);
      case 'max':return Math.max(...args);
      case 'inv':if(args.length!==1)throw new Error('inv 只接受一项');return 1-clip(args[0]);
      default:throw new Error('不支持的组合运算：'+node.op);
    }
  }
  function refs(node,out=[]) {
    if(node&&typeof node==='object') {if(node.ref)out.push(node.ref);(node.args||[]).forEach(n=>refs(n,out));}
    return [...new Set(out)];
  }
  function validate(doc) {
    if(!doc||doc.schema!=='ap-aesthetics/1') throw new Error('作品格式须为 ap-aesthetics/1');
    if(!safeKeys(doc)) throw new Error('不允许特殊对象键');
    if(!Array.isArray(doc.scenes)||!doc.scenes.length||doc.scenes.length>300) throw new Error('作品需要 1–300 个阶段');
    const sceneIds=new Set();let time=0;
    for(const s of doc.scenes){
      if(typeof s.id!=='string'||!s.id||sceneIds.has(s.id)) throw new Error('阶段 ID 必须非空且唯一');sceneIds.add(s.id);
      if(!finite(s.duration)||s.duration<.1||s.duration>3600)throw new Error(s.id+'：时长须为 0.1–3600 秒');time+=s.duration;
      if(typeof s.object!=='string'||!s.object.trim())throw new Error(s.id+'：需要稳定的注意对象标识');
      if(!s.cues||!safeKeys(s.cues))throw new Error(s.id+'：线索对象无效');
      for(const f of C.inputs){const v=s.cues[f.id];if(v!=null&&(!finite(v)||v<f.min||v>f.max))throw new Error(s.id+'：'+f.label+' 超出范围');}
      if(s.outcomes!=null&&!Array.isArray(s.outcomes))throw new Error('结果账必须是数组');
      if(s.processes!=null&&!Array.isArray(s.processes))throw new Error('过程账必须是数组');
      const outcomeIds=new Set();
      for(const o of s.outcomes||[]){
        if(!o.id||outcomeIds.has(o.id))throw new Error(s.id+'：结果身份重复/缺失');outcomeIds.add(o.id);
        if(!['pending','realized','ruled_out','unknown'].includes(o.status))throw new Error('未知结果状态');
        if(o.status==='pending'&&(!finite(o.p)||o.p<0||o.p>1||!finite(o.reward)||o.reward<0||!finite(o.penalty)||o.penalty<0))throw new Error('开放结果需要合法 p / reward / penalty');
        if(['realized','ruled_out'].includes(o.status)&&(!finite(o.actualPositive)||o.actualPositive<0||!finite(o.actualNegative)||o.actualNegative<0))throw new Error('已确认结果需要实际正负值（未观察不能填零）');
        for(const key of ['baselineGood','baselineBad','reliefOpportunity','rewardAtRisk'])if(o[key]!=null&&(!finite(o[key])||o[key]<0))throw new Error('结果基线/机会/风险必须是非负数');
      }
      const rateIds=new Set();
      for(const p of s.processes||[]){
        if(!p.id||!['event','rate'].includes(p.kind)||!finite(p.positive)||!finite(p.negative)||p.positive<0||p.negative<0)throw new Error('自定义过程需要身份、kind、非负正负量');
        if(!p.evidence)throw new Error('自定义过程需要来源说明');
        if(p.kind==='rate'&&rateIds.has(p.id))throw new Error('同一阶段持续过程重复：'+p.id);if(p.kind==='rate')rateIds.add(p.id);
      }
    }
    if(time>14400)throw new Error('初版单次交互计算支持总时长不超过 4 小时');
    const p={...C.parameters,...(doc.parameters||{})};
    for(const [key,value] of Object.entries(p))if(!Object.hasOwn(C.parameters,key)||!finite(value)||value<0||value>10000)throw new Error('参数无效：'+key);
    for(const key of ['attentionTemperature','gainHalf','innerHalf','questionHalf','fatigueHalf','feelingHalf','emotionHalf','timeTolerance','waitingScale','spaceScale','outcomeScale'])if(p[key]<=0)throw new Error(key+' 必须大于零');
    const profile={...C.profile,...(doc.profile||{})};
    for(const [key,value] of Object.entries(profile)){if(key==='name')continue;if(!Object.hasOwn(C.profile,key)||!finite(value)||value<0||value>3)throw new Error('观众参数无效：'+key);}
    for(const key of ['initialFamiliarity','initialHabit','initialExplanation'])if(profile[key]>1)throw new Error(key+' 应在 0–1 内');
    const em=doc.emotionModel||C.emotions;
    if(!Array.isArray(em)||!em.length||em.length>60)throw new Error('组合情绪需要 1–60 个定义');
    const emotionIds=new Set();
    for(const e of em){
      if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(e.id)||emotionIds.has(e.id)||!Array.isArray(e.terms)||!e.terms.length)throw new Error('情绪定义身份/项无效');emotionIds.add(e.id);
      for(const t of e.terms){if(!finite(t.weight)||t.weight<0||t.weight>10)throw new Error('组合权重须在 0–10');expression(t.expression,Object.fromEntries(C.defs.map(d=>[d.id,.5])));}
      if(e.terms.every(t=>t.weight===0))throw new Error('组合权重不能全部为零');
    }
    if(!Object.hasOwn(C.styles,doc.style||'bittersweet'))throw new Error('未知评分目标');
    return {parameters:p,profile,emotions:clone(em)};
  }
  function phaseNarrative(row,emotionDefs){
    const known=emotionDefs.map(d=>({id:d.id,label:d.label,...row.emotions[d.id]})).filter(e=>e.value!==null).sort((a,b)=>b.value-a.value);
    const top=known.slice(0,3);
    const lines=[];
    if(top.length)lines.push('估计较突出的组合是 '+top.map(e=>e.label+' '+Math.round(e.value*100)).join('、')+'（0–100 强度）。');
    if(row.cfs.closure>0&&row.cfs.loss>0)lines.push('求证张力得到部分解除，同时损失评价仍在；慰藉和难过可以并存。');
    if(row.cfs.surprise>0&&row.cfs.pressure===0)lines.push('意外提高了注意，结果账未提供惩罚预测，因此没有仅凭惊生成压力。');
    if(row.cfs.unresolved>.25)lines.push('待解问题继续进入下一阶段；本段结束不等于心理目标已关闭。');
    if(row.cfs.boredom>.2)lines.push('重复与等待的收益下降，可能削弱继续关注；可比较增加新细节或改变时长的版本。');
    const supports=top.flatMap(e=>e.terms.filter(t=>t.value!==null&&t.contribution>0).map(t=>({emotion:e.label,...t}))).sort((a,b)=>b.contribution-a.contribution).slice(0,3);
    if(supports.length)lines.push('主要依据：'+supports.map(s=>s.emotion+' ← '+s.refs.map(k=>C.defs.find(d=>d.id===k)?.label||k).join(' × ')).join('；')+'。');
    const unknown=emotionDefs.filter(d=>row.emotions[d.id].value===null).length;
    if(unknown)lines.push(unknown+' 类组合有输入缺口，保留区间而不补成零。');
    return {top:top.map(e=>({id:e.id,label:e.label,value:e.value})),lines};
  }
  function evaluate(doc){
    const {parameters:p,profile,emotions:emotionDefs}=validate(doc);
    const objects=new Map(),ledger=new Map(),processSeen=new Map(),rows=[],trace=[],warnings=[];
    const emotionBank=new Map();
    let elapsed=0;const docSubject=doc.subject||'target-viewer';
    for(const scene of doc.scenes){
      const x=Object.fromEntries(C.inputs.map(f=>[f.id,scene.cues[f.id]??null]));
      const subject=scene.subject||docSubject,world=scene.world||'fiction',level=scene.level||'viewer-experience';
      const scope=JSON.stringify([subject,world,level]);
      if(!emotionBank.has(scope))emotionBank.set(scope,{lastTime:elapsed,state:Object.fromEntries(emotionDefs.map(d=>[d.id,{low:0,high:0}]))});
      const emotionRecord=emotionBank.get(scope),emotionState=emotionRecord.state;
      const emotionGap=elapsed-emotionRecord.lastTime;
      if(emotionGap>0)for(const e of emotionDefs){emotionState[e.id].low*=Math.pow(2,-emotionGap/p.emotionHalf);emotionState[e.id].high*=Math.pow(2,-emotionGap/p.emotionHalf);}
      const objectKey=JSON.stringify([subject,world,level,scene.object]);
      let s=objects.get(objectKey);
      if(!s){s={F:profile.initialFatigue,M:profile.initialFamiliarity,H:profile.initialHabit,I:0,A:.35,U:0,K:profile.initialExplanation,D:0,E:0,T:0,wait:0,lastTime:elapsed,scope};objects.set(objectKey,s);}
      const gap=elapsed-s.lastTime;
      if(gap>0){s.F*=Math.pow(2,-gap/p.fatigueHalf);s.I*=Math.pow(2,-gap/p.innerHalf);if(s.U!==null)s.U*=Math.pow(2,-gap/p.questionHalf);}
      const S=calc([x.actualNovel,x.predictedNovel],(a,b)=>pos(a-b-p.surpriseThreshold));
      const D=calc([x.actualExpected,x.predictedExpected],(a,b)=>pos(b-a-p.dissonanceThreshold));
      const deltaK=calc([x.explanation,s.K,x.evidence],(k,prev,e)=>pos(k-prev)*e);
      const corrected=calc([s.D,D,x.resolution],(prev,next,r)=>pos(prev-next)*r);
      const release=calc([s.U,x.resolution],(u,r)=>u*r);
      if(release!==null)s.U=pos(s.U-release);
      if(x.question!==null&&s.U!==null)s.U=clip(s.U+x.question*(1-s.U));
      if(x.question===null||x.resolution===null)s.U=null;
      const stageEvents=[];const changes={positive:0,negative:0,relief:0,disappointment:0,known:scene.outcomesKnown===true};
      const scopeKey=o=>JSON.stringify([subject,world,level,o.id]);
      for(const o of scene.outcomes||[]){
        const key=scopeKey(o),old=ledger.get(key);
        if(old?.settled){warnings.push(scene.id+'：已结算结果 '+o.id+' 不重放；新的现实事件应有新结果身份。');continue;}
        const beforeGood=old?.good??o.baselineGood??null,beforeBad=old?.bad??o.baselineBad??null;
        if(o.status==='unknown'){changes.known=false;ledger.set(key,{...(old||{}),unknown:true,scope:[subject,world,level],id:o.id});continue;}
        const settled=o.status!=='pending';
        const good=settled?o.actualPositive:o.p*o.reward,bad=settled?o.actualNegative:o.p*o.penalty;
        if(beforeGood!==null&&beforeBad!==null){
          const dg=good-beforeGood,db=bad-beforeBad;
          const positive=pos(dg)+pos(-db),negative=pos(-dg)+pos(db);
          changes.positive+=positive;changes.negative+=negative;changes.relief+=pos(-db);changes.disappointment+=pos(-dg);
          stageEvents.push({id:scene.id+':forecast:'+o.id,label:'结果评价变化 · '+(o.label||o.id),positive:p.valueChangeGain*positive,negative:p.valueChangeGain*negative,evidence:o.evidence||'阶段结果标注',family:'value',gain:1});
        } else {changes.known=false;warnings.push(scene.id+'：'+o.id+' 缺比较基线，仅用于持续预期，不伪造变化事件。');}
        if(settled)stageEvents.push({id:scene.id+':actual:'+o.id,label:'结果兑现 · '+(o.label||o.id),positive:o.actualPositive,negative:o.actualNegative,evidence:o.evidence||'阶段结果标注',family:'outcome',gain:1});
        ledger.set(key,{id:o.id,scope:[subject,world,level],good,bad,reliefOpportunity:o.reliefOpportunity||0,rewardAtRisk:o.rewardAtRisk||0,settled,unknown:false});
      }
      const open=[...ledger.values()].filter(o=>o.scope.join('|')===[subject,world,level].join('|')&&!o.settled);
      const futureKnown=scene.outcomesKnown===true&&!open.some(o=>o.unknown);
      const targetE=futureKnown?clip(open.reduce((a,o)=>a+o.good+o.reliefOpportunity,0)/p.outcomeScale):null;
      const targetT=futureKnown?clip(open.reduce((a,o)=>a+o.bad+o.rewardAtRisk,0)/p.outcomeScale):null;
      const understanding=[deltaK,corrected,release].every(finite)?Math.max(p.insightGain*deltaK,p.correctionGain*corrected,p.closureGain*release):null;
      if(understanding!==null)stageEvents.push({id:scene.id+':understanding',label:'解释 / 纠错 / 闭合共享贡献',positive:understanding,negative:0,family:'understanding',evidence:'同一过程取共享贡献，感受状态仍分别保留',gain:1});
      const customRates=[];
      for(const proc of scene.processes||[]){
        const key=JSON.stringify([subject,world,level,proc.id]);
        const canonical=JSON.stringify([proc.kind,proc.positive,proc.negative,proc.evidence]);
        if(proc.kind==='event'&&processSeen.has(key)){
          if(processSeen.get(key)!==canonical)throw new Error('同过程 ID 的内容冲突：'+proc.id);
          warnings.push(scene.id+'：同一事件过程 '+proc.id+' 已计入，仅保留一份。');continue;
        }
        if(proc.kind==='event'){processSeen.set(key,canonical);stageEvents.push({...proc,label:proc.label||proc.id,gain:1,family:'custom'});}
        else customRates.push(proc);
      }
      const sum={},peak={},last={},sourceSum=new Map(),emotionSum=Object.fromEntries(emotionDefs.map(d=>[d.id,{low:0,high:0,coverage:0}]));
      let durationDone=0,positiveTotal=0,negativeTotal=0,attentionCoverage=1,lastTerms={};
      const pushSource=(id,label,plus,minus,kind,evidence)=>{let r=sourceSum.get(id);if(!r){r={id,label,positive:0,negative:0,kind,evidence};sourceSum.set(id,r);}r.positive+=plus;r.negative+=minus;};
      while(durationDone<scene.duration-1e-9){
        const dt=Math.min(.5,scene.duration-durationDone),t=durationDone;
        const v={};const pulse=Math.pow(2,-t/4);
        v.surprise=S===null?null:S*pulse;v.dissonance=D;
        s.K=smooth(s.K,x.explanation,dt,p.feelingHalf);
        v.reasonable=s.K;v.correct=corrected===null?null:corrected*pulse;v.insight=deltaK===null?null:deltaK*pulse;
        v.match=calc([x.actualExpected,x.predictedExpected,x.evidence],(r,pred,e)=>Math.exp(-Math.abs(r-pred))*e);
        v.grasp=calc([s.K,x.evidence,D],(k,e,d)=>clip(.4*k+.4*e+.2*(1-d)));
        v.uncertainty=v.grasp===null?null:1-v.grasp;
        s.E=smooth(s.E,targetE,dt,p.feelingHalf);s.T=smooth(s.T,targetT,dt,p.feelingHalf);
        v.expectation=s.E;v.pressure=s.T;
        if(s.U!==null&&x.question!==null)s.U=clip(decayRate(s.U,p.questionRate*x.question*s.A,dt,p.questionHalf));
        v.unresolved=s.U;v.closure=release===null?null:release*pulse;
        v.familiarity=clip(s.M);v.habit=clip(s.H);v.fatigue=1-Math.exp(-s.F);v.repetition=v.fatigue;
        v.novelty=calc([x.detail,x.evidence],(d,e)=>clip((1-s.M)*(.25+.75*d)*e));
        v.complexity=calc([x.load,s.U],(l,u)=>clip(.8*l+.2*u));v.simplicity=v.complexity===null?null:1-v.complexity;
        v.progress=x.progress;v.goalDistance=x.progress===null?null:1-x.progress;
        for(const k of ['care','memory','loss','threat','safety','selfRelevance','unfairness','selfResponsibility','pleasant','sensoryCost','craft','playfulness','scale'])v[k]=x[k];
        v.care=calc([v.care],a=>clip(a*profile.relationship));v.memory=calc([v.memory],a=>clip(a*profile.memory));v.loss=calc([v.loss],a=>clip(a*profile.lossSensitivity));v.sensoryCost=calc([v.sensoryCost],a=>clip(a*profile.sensorySensitivity));
        v.boredom=calc([x.detail,v.care,v.memory],(d,c,m)=>clip(v.repetition*(1-d)*(1-.5*c-.3*m)));
        if(s.U!==null)s.wait=s.U>.02?s.wait+dt*s.U:s.wait*Math.pow(2,-dt/10);
        v.waiting=s.U===null?null:clip((1-Math.exp(-s.wait/p.waitingScale))*s.U);
        v.timeOrder=x.order;v.spaceCoherence=x.spatial;
        v.timeMatch=calc([x.expectedInterval,x.actualInterval],(e,a)=>Math.exp(-.5*((a-e)/Math.max(.01,e*p.timeTolerance))**2));
        v.spaceProximity=calc([x.distance],d=>Math.exp(-.5*(d/p.spaceScale)**2));
        v.relief=changes.known?clip(changes.relief*pulse+(v.closure??0)):null;
        v.disappointment=changes.known?clip(changes.disappointment*pulse):null;
        const terms=[[1,s.H>0?Math.log(.001+s.H):-6],[p.attentionPersistence,s.I],[p.attentionSurprise,v.surprise],[p.attentionDissonance,D],[p.attentionQuestion,s.U],[p.attentionValue,calc([s.E,s.T],(a,b)=>a+b)],[p.attentionContinuity,x.continuity],[1,x.relevance],[-p.attentionFatigue,s.F]];
        attentionCoverage=terms.filter(z=>z[1]!==null).length/terms.length;
        const previousEmotion=(emotionState.curiosity?.low||0)*.18+(emotionState.tension?.low||0)*.16-(emotionState.bored?.low||0)*.22;
        const z=terms.reduce((a,[w,val])=>a+(val===null?0:w*val),0)+previousEmotion;
        const competitors=[p.backgroundPriority];
        for(const [key,other] of objects){if(key===objectKey||other.scope!==scope)continue;const idle=elapsed+t-other.lastTime;const inner=other.I*Math.pow(2,-idle/p.innerHalf),u=(other.U??0)*Math.pow(2,-idle/p.questionHalf),f=other.F*Math.pow(2,-idle/p.fatigueHalf);competitors.push(Math.log(.001+other.H)+p.attentionPersistence*inner+p.attentionQuestion*u-p.attentionFatigue*f);}
        const scores=[z,...competitors].map(a=>a/p.attentionTemperature),maximum=Math.max(...scores);
        s.A=Math.exp(scores[0]-maximum)/scores.reduce((a,b)=>a+Math.exp(b-maximum),0);
        v.attention=s.A;v.internal=1-Math.exp(-s.I);
        const gain=(1+p.gainMax*s.A/(s.A+p.gainHalf))*Math.exp(-s.F);
        let ratePlus=0,rateMinus=0;
        const rateDefs=[['sensory','感官舒适',v.pleasant,p.signalRate,0],['relation','关怀关系',v.care,p.signalRate,0],['memory','记忆唤起',v.memory,.6*p.signalRate,0],['craft','形式技艺',v.craft,.5*p.signalRate,0],['novelty','新鲜探索',v.novelty,.25*p.signalRate,0],['rhythm','节律吻合',v.timeMatch,.2*p.signalRate,0],['expectation','持续期待',v.expectation,p.rewardRate,0],['loss','持续损失',v.loss,0,p.signalRate],['pressure','持续压力',v.pressure,0,p.penaltyRate],['dissonance','未解释残差',v.dissonance,0,.35*p.signalRate],['boredom','重复低收益',v.boredom,0,p.boredomGain],['sensoryCost','刺激负担',v.sensoryCost,0,p.signalRate]];
        for(const [id,label,value,a,b] of rateDefs){if(value===null)continue;const g=id==='sensoryCost'?1:gain;const plus=value*a*g,minus=value*b*g;ratePlus+=plus;rateMinus+=minus;pushSource(id,label,plus*dt,minus*dt,'rate','当前感受 × 配置系数 × 注意/疲劳');}
        for(const proc of customRates){ratePlus+=proc.positive*gain;rateMinus+=proc.negative*gain;pushSource('custom:'+proc.id,proc.label||proc.id,proc.positive*gain*dt,proc.negative*gain*dt,'rate',proc.evidence);}
        let eventPlus=0,eventMinus=0;
        if(t===0)for(const e of stageEvents){e.gain=gain;e.effectivePositive=e.positive*gain;e.effectiveNegative=e.negative*gain;eventPlus+=e.effectivePositive;eventMinus+=e.effectiveNegative;pushSource(e.id,e.label,e.effectivePositive,e.effectiveNegative,'event',e.evidence);}
        positiveTotal+=ratePlus*dt+eventPlus;negativeTotal+=rateMinus*dt+eventMinus;
        v.positive=ratePlus+eventPlus/dt;v.negative=rateMinus+eventMinus/dt;
        v.arousal=calc([v.surprise,v.pressure,v.sensoryCost],(sur,pr,c)=>clip(.5*sur+.35*pr+.4*c));
        for(const e of emotionDefs){
          const evaluated=e.terms.map(term=>{const value=expression(term.expression,v);return {weight:term.weight,value,contribution:value===null?null:term.weight*value,refs:refs(term.expression)};});
          const known=evaluated.filter(t=>t.value!==null),weight=e.terms.reduce((a,t)=>a+t.weight,0),knownWeight=known.reduce((a,t)=>a+t.weight,0);
          const raw=known.reduce((a,t)=>a+t.contribution,0)*p.emotionGain;
          const low=1-Math.exp(-raw),high=1-Math.exp(-(raw+(weight-knownWeight)*p.emotionGain));
          emotionState[e.id].low=smooth(emotionState[e.id].low,low,dt,p.emotionHalf);
          emotionState[e.id].high=smooth(emotionState[e.id].high,high,dt,p.emotionHalf);
          emotionSum[e.id].low+=emotionState[e.id].low*dt;emotionSum[e.id].high+=emotionState[e.id].high*dt;emotionSum[e.id].coverage+=knownWeight/weight*dt;
          lastTerms[e.id]=evaluated;
        }
        for(const d of C.defs){const value=v[d.id]??null;last[d.id]=value;if(!Object.hasOwn(sum,d.id))sum[d.id]=0;if(value===null)sum[d.id]=null;else if(sum[d.id]!==null)sum[d.id]+=value*dt;if(value!==null)peak[d.id]=Math.max(peak[d.id]??-Infinity,value);}
        if(t===0||durationDone+dt>=scene.duration-1e-9)trace.push({time:elapsed+t+dt,sceneId:scene.id,subject,object:scene.object,cfs:{...v},emotion:Object.fromEntries(emotionDefs.map(e=>[e.id,emotionState[e.id].low]))});
        const content=calc([x.detail,x.continuity],(d,c)=>.25+.75*d+.3*c);
        s.I=decayRate(s.I,p.innerRate*s.A*(content??0),dt,p.innerHalf);
        s.F=decayRate(s.F,p.fatigueRate*s.A,dt,p.fatigueHalf);
        s.M=1-(1-s.M)*Math.exp(-p.familiarityRate*s.A*dt);
        s.H=1-(1-s.H)*Math.exp(-p.habitRate*s.A*dt);
        durationDone+=dt;
      }
      s.D=D;
      s.lastTime=elapsed+scene.duration;emotionRecord.lastTime=elapsed+scene.duration;
      const cfs=Object.fromEntries(C.defs.map(d=>[d.id,sum[d.id]===null?null:sum[d.id]/scene.duration]));
      cfs.positive=positiveTotal/scene.duration;cfs.negative=negativeTotal/scene.duration;
      const emotional=Object.fromEntries(emotionDefs.map(e=>{const a=emotionSum[e.id],lo=a.low/scene.duration,hi=a.high/scene.duration;return [e.id,{value:Math.abs(hi-lo)<1e-8?lo:null,low:lo,high:hi,end:{...emotionState[e.id]},coverage:a.coverage/scene.duration,terms:lastTerms[e.id]}];}));
      const missing=C.inputs.filter(d=>x[d.id]===null).map(d=>d.id);
      const row={id:scene.id,title:scene.title||scene.id,description:scene.description||'',subject,world,level,object:scene.object,start:elapsed,end:elapsed+scene.duration,duration:scene.duration,cfs,peak,endState:last,emotions:emotional,signals:{positive:positiveTotal,negative:negativeTotal,complete:missing.length===0&&futureKnown,sources:[...sourceSum.values()],events:stageEvents},coverage:{inputs:1-missing.length/C.inputs.length,attention:attentionCoverage,missing},outcomes:clone([...ledger.values()])};
      row.summary=phaseNarrative(row,emotionDefs);rows.push(row);elapsed+=scene.duration;
    }
    const mean=(id,emotion=false)=>{const xs=rows.map(r=>emotion?r.emotions[id]?.value:r.cfs[id]);return xs.every(finite)?xs.reduce((a,v,i)=>a+v*rows[i].duration,0)/elapsed:null;};
    const style=C.styles[doc.style||'bittersweet'];
    const targetParts=Object.entries(style.target).map(([id,[lo,hi]])=>{const v=mean(id,true);return v===null?null:Math.exp(-4*Math.max(lo-v,0,v-hi)**2);});
    const after=rows.at(-1),warm=after.emotions.warmth?.value,calm=after.emotions.calm?.value;
    const metrics={understanding:mean('grasp'),relationship:mean('care'),development:mean('novelty'),comfort:calc([mean('sensoryCost')],x=>1-x),craft:mean('craft'),afterglow:calc([warm,calm],(a,b)=>(a+b)/2),target:avg(targetParts)};
    let low=0,unknownWeight=0;
    for(const [id,w] of Object.entries(style.weights)){if(metrics[id]===null)unknownWeight+=w;else low+=w*metrics[id];}
    if(emotionBank.size>1){warnings.push('输入包含多个主体/世界/层级，已分开递推；总分不跨主体混合。请分作品查看各主体评分。');low=0;unknownWeight=1;for(const key of Object.keys(metrics))metrics[key]=null;}
    return {schema:'ap-aesthetics-result/1',engineVersion:C.version,assumptions:'人工标注输入与未校准系数；强度不是概率；不含自动B/C理解、真人数据或神经递质测量',title:doc.title,profile:clone(profile),style:style.label,parameters:p,emotionModel:emotionDefs,rows,trace,duration:elapsed,warnings:[...new Set(warnings)],score:{value:unknownWeight<1e-10?100*low:null,low:100*low,high:100*(low+unknownWeight),coverage:1-unknownWeight,metrics,weights:style.weights},totals:{positive:rows.reduce((a,r)=>a+r.signals.positive,0),negative:rows.reduce((a,r)=>a+r.signals.negative,0)}};
  }
  function resultCSV(result){
    const keys=['start','end','title',...C.defs.map(d=>d.id),...result.emotionModel.map(e=>'emotion_'+e.id)];
    const escape=x=>'"'+(typeof x==='string'&&/^[=+@\-\t\r]/.test(x)?"'":'')+String(x??'').replaceAll('"','""')+'"';
    const rows=result.rows.map(r=>[r.start,r.end,r.title,...C.defs.map(d=>r.cfs[d.id]??''),...result.emotionModel.map(e=>r.emotions[e.id].value??'')]);
    return '\uFEFF'+[keys,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
  }
  return {evaluate,validate,expression,decayRate,resultCSV,clone};
});
