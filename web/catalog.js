(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const input = (id, label, group, help, max = 1) => ({id, label, group, help, min: 0, max, step: max === 1 ? .05 : 1});
  const inputs = [
    input('actualNovel', '意外特征·实际强度', '预测与解释', '同一新特征的实能量 R；与其预测比较，不能与另一对象相减。'),
    input('predictedNovel', '意外特征·预测强度', '预测与解释', '该特征呈现前的虚能量 V；已提前揭晓时通常较高。'),
    input('actualExpected', '预期特征·实际强度', '预测与解释', '到期应出现的特征实能量；未到期不标为落空。'),
    input('predictedExpected', '预期特征·预测强度', '预测与解释', '对同一到期特征的预测。两个特征允许惊和违和同时出现。'),
    input('explanation', '解释支持', '预测与解释', '当前线索对解释的支持；是主观估计，不是事实真值。'),
    input('evidence', '可见依据充分度', '预测与解释', '观众实际能读到的依据，而非导演已知的全部剧情。'),
    input('resolution', '解释推进依据', '预测与解释', '本拍确有解释/解除疑问的程度；自然遗忘不冒充理解。'),
    input('question', '新待解问题', '预测与解释', '观众自己的求证目标；不能直接复制角色任务。'),
    input('load', '加工负荷', '预测与解释', '并行对象、线索和关系需要的加工资源。'),
    input('detail', '新内容发展', '预测与解释', '这段提供的新细节或可继续展开的内容。'),
    input('continuity', '思路延续支持', '预测与解释', '上一阶段的注意对象与本阶段的关系支持。'),
    input('relevance', '当前目标相关性', '预测与解释', '这段内容与观众正在关心的问题的关系。'),
    input('progress', '目标进展', '预测与解释', '观众理解/关切目标的进展状态，不等同角色完成度。'),
    input('care', '照顾与关系证据', '关系与价值', '由具体行为建立的关系价值线索，不直接输入“感动”。'),
    input('memory', '回忆唤起', '关系与价值', '当前内容唤起观众已有经历的估计。'),
    input('loss', '已发生损失', '关系与价值', '已失去的对象/机会的显著性；未来风险写入结果账。'),
    input('threat', '威胁解释', '关系与价值', '有具体受损对象的威胁解释，不能用惊代填。'),
    input('safety', '安全与可承受', '关系与价值', '环境安全、虚构距离或可承受解释的支持。'),
    input('selfRelevance', '自我关联', '关系与价值', '与观众自身关系、目标或经历的连接。'),
    input('unfairness', '不公评价', '关系与价值', '对不当待遇/规则的评价，是愤怒等组合的来源之一。'),
    input('selfResponsibility', '自身责任评价', '关系与价值', '观众所代入主体对坏结果的责任；无依据留空。'),
    input('pleasant', '感官舒适', '形式与身体', '声音、色彩、动作等在该观众上的直接正向价值。'),
    input('sensoryCost', '强刺激代价', '形式与身体', '刺耳、眩晕或过载等；与纯意外分开。'),
    input('craft', '形式与技艺线索', '形式与身体', '观众能识别的构图、韵律、表达技巧。'),
    input('playfulness', '玩笑/游戏解释', '形式与身体', '能将不寻常内容理解为玩笑的关系与情境支持。'),
    input('scale', '宏大/超常尺度', '形式与身体', '用于崇高/震撼组合的尺度评价。'),
    input('expectedInterval', '预期间隔（秒）', '时间与空间', '从之前的间隔范式得到的预期；无节奏事件留空。', 3600),
    input('actualInterval', '实际间隔（秒）', '时间与空间', '此次对应事件实际间隔。', 3600),
    input('order', '时间顺序可理解度', '时间与空间', '观众能否把先后、回忆和当前事件正确区分。'),
    input('spatial', '空间关系可理解度', '时间与空间', '物体/角色空间锚点是否可兼容，不把切镜头本身算错。'),
    input('distance', '空间相对距离', '时间与空间', '相对空间尺度上的距离；用于聚焦可达性，非情感亲疏。', 100)
  ];
  const defs = [
    ['surprise','惊','核心感受','实际新特征超出同特征预测的正残差。','AP Bottom 719–725'],
    ['dissonance','违和','核心感受','到期预期特征未兑现的残差；不同对象分开。','AP Bottom 723–725'],
    ['reasonable','合理感','核心感受','带依据的解释支持的持续状态。','公式 v0.2 §3'],
    ['correct','正确事件','核心感受','有解释依据时违和的下降；不等于所有快乐。','理论核心 523；版本差异保留'],
    ['insight','理解推进','核心感受','解释支持比上一状态增加；不强求先困惑。','公式 v0.2 §3'],
    ['match','预测吻合','核心感受','同对象预期/实际接近并有证据。','AP Bottom 733；与正确事件分开'],
    ['grasp','把握感','核心感受','解释、证据和低残差共同支持的主观把握。','AP Bottom 737；理论核心 535'],
    ['uncertainty','不确定','核心感受','对当前解释/预测缺少把握的状态。','咨询读出；不是全部统计熵'],
    ['expectation','期待','核心感受','尚开放的奖励预测与可避免惩罚。','理论核心 525；用户四方向纠正'],
    ['pressure','压力','核心感受','尚开放的惩罚预测与奖励损失风险。','理论核心 526；用户四方向纠正'],
    ['unresolved','未闭合','核心感受','观众待解问题在内源注意中保持。','公式 v0.2 §5'],
    ['closure','闭合/慰藉事件','核心感受','有依据解除求证张力，不删除损失。','公式 v0.2 §5'],
    ['novelty','新鲜感','核心感受','陌生程度、新细节和可理解性共同影响。','理论核心 532；公式 v0.2 §7'],
    ['repetition','重复感','核心感受','对近期累积使用疲劳的读出。','理论核心 533'],
    ['complexity','繁','核心感受','当前加工负荷及待解问题的组合。','理论核心 534'],
    ['simplicity','简','核心感受','低负荷、可组织的图景，不等于更美。','理论核心 534'],
    ['progress','进展感','核心感受','对观众关切目标推进的估计。','理论核心 536，可选'],
    ['goalDistance','目标距离感','核心感受','当前目标尚需推进的程度。','理论核心 536，可选'],
    ['boredom','无聊感','核心感受','重复且缺少发展与关系价值时的低收益负荷。','理论核心 519/533；咨询参数化'],
    ['waiting','等待感','时空感受','待解内容仍存在时，主观等待随时长积累。','公式 v0.2 §5/9'],
    ['timeOrder','先后顺序感','时空感受','本段对时序归属的可理解度。','图景 73；人工线索输入'],
    ['timeMatch','时间预期吻合','时空感受','实际间隔与预期间隔的距离核。','公式 v0.2 §9'],
    ['spaceCoherence','空间相容','时空感受','场景关系与空间锚点的相容支持。','公式 v0.2 §6'],
    ['spaceProximity','空间接近','时空感受','相对距离核；不直接当温暖或价值。','公式 v0.2 §6'],
    ['care','关系/关怀评价','价值评价','已注意到的照顾证据 × 观众关系敏感度。','公式 v0.2 §8'],
    ['memory','回忆唤起','价值评价','当前内容引发的个人记忆活动。','图景 40；公式 v0.2 §7'],
    ['loss','损失评价','价值评价','当前损失线索；与未来失望分账。','公式 v0.2 §4/5'],
    ['threat','威胁评价','价值评价','有受损对象的威胁解释。','公式 v0.2 §8'],
    ['safety','安全感依据','价值评价','可承受与安全的支持。','审美咨询评价项'],
    ['selfRelevance','自我关联','价值评价','个人目标/关系/经历的相关性。','公式 v0.2 §8'],
    ['unfairness','不公评价','价值评价','供愤怒组合使用的具体评价。','可配置审美扩展'],
    ['selfResponsibility','自身责任','价值评价','供内疚组合使用的具体评价。','可配置审美扩展'],
    ['pleasant','感官舒适','价值评价','直接正向感官价值。','公式 v0.2 §8'],
    ['sensoryCost','刺激负担','价值评价','直接负向感官价值。','公式 v0.2 §8'],
    ['craft','形式欣赏依据','价值评价','已理解的形式、技艺价值。','公式 v0.2 §8/10'],
    ['playfulness','玩笑解释','价值评价','幽默组合的情境支持。','可配置审美扩展'],
    ['scale','宏大尺度','价值评价','震撼/敬畏组合的评价依据。','可配置审美扩展'],
    ['relief','缓解','价值评价','预期惩罚减少与求证解除的可追溯贡献。','公式 v0.2 §4/5'],
    ['disappointment','失落','价值评价','逐结果奖励预期降低；兑现删除不误罚。','公式补充 v0.2.1 §1'],
    ['attention','注意份额','运行状态','当前对象与背景竞争后的有限份额。','公式 v0.2 §6'],
    ['internal','内源维持','运行状态','上一注意与真实内容发展延续到下一时刻。','公式 v0.2 §6'],
    ['fatigue','短期疲劳','运行状态','按真实时间累积/恢复，不抹去长期习惯。','公式 v0.2 §6'],
    ['familiarity','熟悉度','运行状态','已辨认的接触痕迹，与短期疲劳不同。','公式 v0.2 §7'],
    ['habit','习惯基础','运行状态','持续实际关注形成的慢基础倾向。','公式 v0.2 §7'],
    ['arousal','唤醒估计','运行状态','惊、压力和刺激负担的非生化读出。','公式 v0.2 §8'],
    ['positive','正向信号率','信号','持续与事件的全段平均；来源可展开。','公式 v0.2 §8'],
    ['negative','负向信号率','信号','独立于正向保留，不以净值代替。','公式 v0.2 §8']
  ].map(([id,label,group,help,source])=>({id,label,group,help,source}));
  // Declarative, restricted expressions. No executable strings or keyword routes.
  const ref = x => ({ref:x});
  const mul = (...x) => ({op:'mul',args:x.map(v=>typeof v==='string'?ref(v):v)});
  const inv = x => ({op:'inv',args:[ref(x)]});
  const term = (weight, expression) => ({weight, expression:typeof expression==='string'?ref(expression):expression});
  const emotions = [
    ['curiosity','好奇','#5281d8',[term(.9,mul('unresolved','novelty')),term(.45,mul('uncertainty',inv('pressure')))]],
    ['delight','惊喜','#e9a241',[term(1.25,mul('surprise','insight','safety')),term(.6,mul('surprise','care'))]],
    ['joy','愉悦','#d99a40',[term(.55,'pleasant'),term(.5,'insight'),term(.35,'craft'),term(.25,'expectation')]],
    ['tension','紧张','#d27e64',[term(.85,'pressure'),term(.35,mul('waiting','unresolved')),term(.2,mul('surprise','threat'))]],
    ['fear','担忧/害怕','#ac7186',[term(1.4,mul('pressure','threat')),term(.35,mul('threat',inv('safety')))]],
    ['frustration','挫败/烦躁','#b37750',[term(.55,mul('dissonance','complexity')),term(.6,mul('boredom','unresolved')),term(.55,'sensoryCost')]],
    ['sadness','悲伤/不舍','#7588ad',[term(.8,'loss'),term(.6,'disappointment'),term(.35,mul('memory','loss'))]],
    ['warmth','温暖/亲近','#da8f83',[term(.8,'care'),term(.35,mul('memory','care')),term(.2,mul('safety','selfRelevance'))]],
    ['moved','感动','#9d79ad',[term(.75,mul('care','selfRelevance')),term(.65,mul('care','loss')),term(.4,mul('insight','care'))]],
    ['nostalgia','怀念','#a58b70',[term(.8,mul('memory','selfRelevance')),term(.3,mul('memory','loss'))]],
    ['relieved','释然','#59a29b',[term(.9,'relief'),term(.4,mul('closure','safety'))]],
    ['calm','轻松/安宁','#6ba291',[term(.7,mul('safety',inv('pressure'),inv('sensoryCost'))),term(.3,mul('reasonable','pleasant'))]],
    ['bored','无聊/走神','#949aa6',[term(.9,'boredom'),term(.3,mul('repetition',inv('care')))]],
    ['awe','震撼/敬畏','#7e86bb',[term(.8,mul('scale','surprise')),term(.55,mul('scale','craft'))]],
    ['amused','好笑/会心','#c49442',[term(.9,mul('playfulness','insight','safety')),term(.55,mul('playfulness','surprise','reasonable'))]],
    ['confused','困惑','#7f84a2',[term(.5,'dissonance'),term(.4,'uncertainty'),term(.25,mul('unresolved','complexity'))]],
    ['angry','愤慨','#b97777',[term(.9,mul('unfairness','loss')),term(.7,mul('unfairness','pressure'))]],
    ['guilt','内疚','#968194',[term(1.1,mul('selfResponsibility','loss')),term(.4,mul('selfResponsibility','disappointment'))]],
    ['rhythmic','律动/跟随感','#6b9ea2',[term(.8,mul('timeMatch','pleasant')),term(.3,mul('timeMatch','expectation'))]]
  ].map(([id,label,color,terms])=>({id,label,color,terms}));
  const parameters = {
    surpriseThreshold:.08, dissonanceThreshold:.08,
    attentionTemperature:1, attentionPersistence:1.2, attentionSurprise:1.1,
    attentionDissonance:.8, attentionQuestion:1.3, attentionValue:.5,
    attentionContinuity:.6, attentionFatigue:1.5, backgroundPriority:.15,
    gainMax:.8, gainHalf:.4, innerHalf:15, innerRate:.045,
    questionHalf:45, questionRate:.015, fatigueHalf:80, fatigueRate:.025,
    familiarityRate:.003, habitRate:.0003, feelingHalf:8, emotionHalf:18,
    timeTolerance:.25, waitingScale:30, spaceScale:3,
    signalRate:.03, insightGain:.6, correctionGain:.4, closureGain:.5,
    valueChangeGain:.5, rewardRate:.012, penaltyRate:.016,
    boredomGain:.025, outcomeScale:1, emotionGain:1
  };
  const parameterLabels={surpriseThreshold:'惊的残差阈值',dissonanceThreshold:'违和残差阈值',attentionTemperature:'注意竞争温度',fatigueHalf:'疲劳半衰期 / 秒',fatigueRate:'疲劳增长率 / 秒',emotionHalf:'情绪半衰期 / 秒',feelingHalf:'感受平滑半衰期 / 秒',questionHalf:'未闭合半衰期 / 秒',innerHalf:'内源维持半衰期 / 秒',gainMax:'注意最大附加增益',waitingScale:'等待感时间尺度 / 秒',timeTolerance:'时间相对容差',signalRate:'基础信号率',outcomeScale:'结果价值归一尺度',emotionGain:'组合情绪增益'};
  const profile = {name:'初次观看 · 重视关系',relationship:1,memory:1,lossSensitivity:1,sensorySensitivity:1,initialFamiliarity:.12,initialHabit:.45,initialFatigue:0,initialExplanation:0};
  const styles = {
    bittersweet:{label:'温柔 · 苦甜',weights:{understanding:.18,relationship:.2,development:.15,comfort:.12,craft:.1,afterglow:.15,target:.1},target:{moved:[.3,.9],warmth:[.35,1],sadness:[.12,.8]}},
    comedy:{label:'轻松 · 喜剧',weights:{understanding:.15,relationship:.1,development:.18,comfort:.15,craft:.1,afterglow:.1,target:.22},target:{amused:[.35,1],joy:[.3,1],tension:[0,.4]}},
    suspense:{label:'悬念 · 释然',weights:{understanding:.18,relationship:.1,development:.2,comfort:.06,craft:.1,afterglow:.14,target:.22},target:{curiosity:[.25,.85],tension:[.25,.9],relieved:[.15,.9]}},
    quiet:{label:'舒缓 · 余韵',weights:{understanding:.13,relationship:.15,development:.1,comfort:.2,craft:.15,afterglow:.17,target:.1},target:{calm:[.4,1],warmth:[.25,1],tension:[0,.3]}}
  };
  const scoreLabels={understanding:'线索理解',relationship:'关系价值建立',development:'内容发展',comfort:'刺激可承受',craft:'形式可读',afterglow:'末段余韵',target:'目标体验符合'};
  return {version:'0.1.0',inputs,defs,emotions,parameters,parameterLabels,profile,styles,scoreLabels};
});
