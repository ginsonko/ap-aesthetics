(function(){
 'use strict';
 const C=window.APCatalog,E=window.APEngine,X=window.APExamples,$=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,scale=100)=>v===null||v===undefined?'—':(v*scale).toFixed(scale===100?0:2);
 const storageKey='ap-aesthetics-calculator-v1';
 let doc=X.make(),selected=0,result,comparison,compareId='spoiler',storageOk=true,previousDoc=null;
 try{const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);E.validate(saved);doc=saved;}}catch(e){storageOk=false;}
 const reportError=e=>{ $('status').className='status error';$('status').textContent=e.message||String(e);};
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(doc));$('saveState').textContent='草稿已保存在当前浏览器 · '+new Date().toLocaleTimeString('zh-CN');}catch(e){storageOk=false;$('saveState').textContent='浏览器未允许保存，请使用「保存作品」下载 JSON';}};
 function recalculate(message='已根据当前输入重新计算。'){
   try{const next=E.evaluate(doc);let cmp=null;if(compareId!=='none'){const other=X.make(compareId);other.profile=E.clone(doc.profile);other.parameters=E.clone(doc.parameters);other.emotionModel=E.clone(doc.emotionModel);other.style=doc.style;cmp=E.evaluate(other);}result=next;comparison=cmp;selected=Math.min(selected,doc.scenes.length-1);save();render();$('status').className='status';$('status').textContent=message+(storageOk?'':' 浏览器存储不可用，请保存 JSON。');}
   catch(e){reportError(e);}
 }
 function replaceDoc(next,message){try{E.evaluate(next);previousDoc=E.clone(doc);doc=next;selected=0;recalculate(message);}catch(e){reportError(e);}}
 function optionList(arr,value){return arr.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(x.label)}</option>`).join('');}
 function metric(label,number,sub){return `<div class="metric"><div class="label">${esc(label)}</div><div class="number">${esc(number)}</div><div class="sub">${esc(sub)}</div></div>`;}
 function render(){
   $('workTitle').value=doc.title;$('styleSelect').value=doc.style;$('annotationNote').textContent=doc.annotationNote||'';
   const cov=result.rows.reduce((a,r)=>a+r.coverage.inputs*r.duration,0)/result.duration;
   const score=result.score.value===null?`${result.score.low.toFixed(0)}–${result.score.high.toFixed(0)}`:result.score.value.toFixed(1);
   const delta=comparison&&result.score.value!==null&&comparison.score.value!==null?`对照差 ${result.score.value-comparison.score.value>=0?'+':''}${(result.score.value-comparison.score.value).toFixed(1)} · 同观众与参数`:'缺测保留区间，不自动补零';
   $('metrics').innerHTML=metric('目标下的演示指数',score,delta)+metric('逐项感受与状态',C.defs.length+' 项',C.emotions.length+' 类组合情绪 · 同时存在')+metric('正向 / 负向总信号',`${result.totals.positive.toFixed(1)} / ${result.totals.negative.toFixed(1)}`,'任意模型单位 · 两条独立账')+metric('输入标注覆盖',Math.round(cov*100)+'%',result.rows.length+' 个阶段 · '+result.duration.toFixed(0)+' 秒 · 非预测置信度');
   $('sceneList').innerHTML=doc.scenes.map((s,i)=>`<button class="scene-btn ${i===selected?'active':''}" data-scene="${i}" aria-pressed="${i===selected}"><span class="seq">${String(i+1).padStart(2,'0')}</span><span class="name">${esc(s.title)}</span><span class="seconds">${s.duration}s</span></button>`).join('');
   renderEditor();renderChart();renderMatrix();renderDetail();renderCards();renderSettings();
   $('warnings').innerHTML=result.warnings.length?'<h3>数据与身份提示</h3>'+result.warnings.map(w=>'<p>'+esc(w)+'</p>').join(''):'';
 }
 function renderEditor(){
   const s=doc.scenes[selected];
   let html=`<label class="wide-field">阶段名称<input data-scene-field="title" value="${esc(s.title)}"></label><label class="wide-field">实际呈现与线索<textarea data-scene-field="description">${esc(s.description)}</textarea></label><label class="field">时长 / 秒<input type="number" min=".1" max="3600" step=".5" data-scene-field="duration" value="${s.duration}"></label><label class="wide-field">持续注意对象<input data-scene-field="object" value="${esc(s.object)}"></label><div class="scene-actions"><button id="moveUp" ${selected===0?'disabled':''}>上移</button><button id="moveDown" ${selected===doc.scenes.length-1?'disabled':''}>下移</button><button id="deleteScene" ${doc.scenes.length===1?'disabled':''}>删除</button></div>`;
   for(const group of [...new Set(C.inputs.map(f=>f.group))])html+=`<details ${group==='预测与解释'?'open':''}><summary>${esc(group)}</summary>${C.inputs.filter(f=>f.group===group).map(f=>`<label class="field" title="${esc(f.help)}"><span>${esc(f.label)}</span><input type="number" min="${f.min}" max="${f.max}" step="${f.step}" placeholder="未知" data-cue="${f.id}" value="${s.cues[f.id]??''}" aria-label="${esc(f.label)}"></label>`).join('')}</details>`;
   html+=`<details><summary>未来结果与兑现（结构化标注）</summary><p>每个结果沿用同一 ID。兑现从开放预测退场不再额外制造失望。空数组表示本段不更新已有结果。</p><label class="wide-field"><input id="outcomesKnown" type="checkbox" ${s.outcomesKnown?'checked':''} style="display:inline;width:auto"> 此段结果预测已标注完整</label><textarea id="outcomesEditor" class="outcome-editor" aria-label="未来结果 JSON">${esc(JSON.stringify(s.outcomes||[],null,2))}</textarea><button id="applyOutcomes">应用结果账</button><p>pending: p / reward / penalty；realized、ruled_out: actualPositive / actualNegative。首次预测用 baselineGood / baselineBad 声明比较基线。</p></details>`;
   html+=`<details><summary>额外过程（可插入的信号来源）</summary><p>kind 为 event 或 rate；每份贡献保留 id、positive、negative、evidence。同一事件 ID 不会重复计奖。</p><textarea id="processEditor" class="outcome-editor" aria-label="额外过程 JSON">${esc(JSON.stringify(s.processes||[],null,2))}</textarea><button id="applyProcesses">应用过程</button></details>`;
   $('sceneEditor').innerHTML=html;
 }
 const colors=['#538579','#d69076','#9c87ac','#c4a357','#6d8daa'];
 const groups={cognition:['surprise','dissonance','unresolved','expectation','pressure'],emotion:['warmth','sadness','moved','relieved','calm'],attention:['attention','fatigue','internal','novelty','boredom']};
 function renderChart(){
   const mode=$('chartMode').value,ids=groups[mode],emotion=mode==='emotion';
   const definition=id=>(emotion?result.emotionModel:C.defs).find(d=>d.id===id);
   $('chartLegend').innerHTML=ids.map((id,i)=>`<span><i style="background:${colors[i]}"></i>${esc(definition(id)?.label||id)}</span>`).join('')+(comparison?'<span>实线：当前　虚线：对照</span>':'');
   const width=900,height=240,left=32,right=12,top=12,bottom=32,end=Math.max(result.duration,comparison?.duration||0);
   const x=t=>left+t/end*(width-left-right),y=v=>top+(1-v)*(height-top-bottom);
   let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(mode)} 按实际秒数的阶段平均轨迹">`;
   for(let k=0;k<=4;k++){const value=k/4;svg+=`<line class="axis" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text x="2" y="${y(value)+3}">${value*100}</text>`;}
   const row=result.rows[selected];svg+=`<rect x="${x(row.start)}" y="${top}" width="${Math.max(1,x(row.end)-x(row.start))}" height="${height-top-bottom}" fill="#648c6a" opacity=".07"/>`;
   function draw(r,dashed){
     for(let i=0;i<ids.length;i++){
       const key=ids[i];let segments=[],points=[];
       for(const r0 of r.rows){const v=emotion?r0.emotions[key]?.value:r0.cfs[key];if(v===null||v===undefined){if(points.length)segments.push(points);points=[];continue;}points.push([x((r0.start+r0.end)/2),y(Math.min(1,v)),r0]);}if(points.length)segments.push(points);
       for(const pts of segments){svg+=`<polyline points="${pts.map(p=>p.slice(0,2).join(',')).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="${dashed?1.5:2.2}" ${dashed?'stroke-dasharray="5 5" opacity=".45"':''}/>`;if(!dashed)for(const pt of pts)svg+=`<circle cx="${pt[0]}" cy="${pt[1]}" r="3" fill="${colors[i]}"><title>${esc(pt[2].title)} · ${esc(definition(key)?.label||key)} ${fmt(emotion?pt[2].emotions[key].value:pt[2].cfs[key])}</title></circle>`;}
     }
   }
   if(comparison)draw(comparison,true);draw(result,false);
   for(let i=0;i<=6;i++){let t=end*i/6;svg+=`<text text-anchor="middle" x="${x(t)}" y="${height-8}">${Math.round(t)}s</text>`;}
   svg+='</svg>';$('chart').innerHTML=svg;
   $('chartNote').textContent='点位为阶段平均状态，横轴按实际时长；短促事件的峰值可在阶段明细查看。'+(comparison?' 对照：'+comparison.title+'（'+comparison.duration+' 秒）。':'');
 }
 function renderMatrix(){
   const group=$('matrixGroup').value,defs=C.defs.filter(d=>group==='all'||d.group===group);let lastGroup='';
   let html='<table class="matrix"><thead><tr><th>认知 / 评价 / 状态</th>'+result.rows.map((r,i)=>`<th data-scene="${i}" class="${i===selected?'chosen':''}" title="${esc(r.title)}">${String(i+1).padStart(2,'0')}<br>${esc(r.title.slice(0,7))}</th>`).join('')+'</tr></thead><tbody>';
   for(const d of defs){if(d.group!==lastGroup){html+=`<tr class="group-row"><td>${esc(d.group)}</td><td colspan="${result.rows.length}"></td></tr>`;lastGroup=d.group;}
     html+=`<tr><td title="${esc(d.help+' · '+d.source)}">${esc(d.label)}</td>`+result.rows.map((r,i)=>{const v=r.cfs[d.id],isSignal=d.group==='信号';const intensity=v===null?0:Math.min(1,isSignal?v*6:v);const bg=v===null?'#f0f1eb':`rgba(86,139,113,${(.04+.52*intensity).toFixed(3)})`;return `<td class="heat ${i===selected?'chosen':''}" data-scene="${i}" style="background:${bg}" title="${esc(d.label+'：'+(v===null?'缺少输入':isSignal?v.toFixed(4)+' 模型单位/秒':(v*100).toFixed(1)+'/100'))}">${fmt(v,isSignal?1:100)}</td>`;}).join('')+'</tr>';
   }
   $('matrix').innerHTML=html+'</tbody></table>';
 }
 const table=(heads,body)=>'<table class="data-table"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table>';
 function renderDetail(){
   const r=result.rows[selected];$('detailTitle').textContent=r.title;$('detailTime').textContent=r.start+'–'+r.end+' 秒';
   $('stageSummary').innerHTML='<div class="summary-text">'+r.summary.lines.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>';
   $('emotionBars').innerHTML=result.emotionModel.map(e=>{const v=r.emotions[e.id];const color=/^#[0-9a-f]{6}$/i.test(e.color)?e.color:'#6b9286';return `<div class="emotion-item"><div class="emotion-head"><span>${esc(e.label)}</span><span>${v.value===null?fmt(v.low)+'–'+fmt(v.high)+' · 待补依据':fmt(v.value)}</span></div><div class="bar-track"><span class="bar-range" style="left:${v.low*100}%;width:${(v.high-v.low)*100}%;background:${color}"></span><span class="bar-fill" style="width:${v.low*100}%;background:${color}"></span></div></div>`;}).join('');
   $('stateTable').innerHTML=table(['感受 / 状态','均值','峰值','结束','定义 / 来源'],C.defs.map(d=>{const scale=d.group==='信号'?1:100;return `<tr><td>${esc(d.label)}</td><td>${fmt(r.cfs[d.id],scale)}</td><td>${fmt(r.peak[d.id],scale)}</td><td>${fmt(r.endState[d.id],scale)}</td><td>${esc(d.help)}<br><span class="muted">${esc(d.source)}</span></td></tr>`;}).join(''));
   $('sourceTable').innerHTML='<p class="hint">下面是已标注来源的模型贡献；缺少来源不会凭空补零为完整体验。一次事件与按秒积分的持续量分开。</p>'+table(['来源','正向总量','负向总量','类型','依据'],r.signals.sources.map(s=>`<tr><td>${esc(s.label)}</td><td>${s.positive.toFixed(3)}</td><td>${s.negative.toFixed(3)}</td><td>${s.kind==='event'?'一次事件':'持续积分'}</td><td>${esc(s.evidence)}</td></tr>`).join(''));
   $('combinationTable').innerHTML=table(['组合情绪','本段均值','依据覆盖','表达式来源'],result.emotionModel.map(e=>{const v=r.emotions[e.id];return `<tr><td>${esc(e.label)}</td><td>${v.value===null?fmt(v.low)+'–'+fmt(v.high):fmt(v.value)}</td><td>${Math.round(v.coverage*100)}%</td><td>${v.terms.map(t=>esc(t.refs.map(id=>C.defs.find(d=>d.id===id)?.label||id).join(' × '))+' · 权重 '+t.weight+(t.value===null?' · 未知':'')).join('<br>')}</td></tr>`;}).join(''));
 }
 function renderCards(){
   $('stageCards').innerHTML=result.rows.map((r,i)=>`<article class="stage-card ${i===selected?'active':''}" data-scene="${i}"><div class="time">${String(i+1).padStart(2,'0')} / ${r.start}–${r.end} 秒</div><h3>${esc(r.title)}</h3><div>${r.summary.top.map(t=>`<span class="chip">${esc(t.label)} ${fmt(t.value)}</span>`).join('')}</div><p>${esc(r.summary.lines.slice(1,3).join(' ')||r.summary.lines[0]||'缺少足够的组合依据。')}</p></article>`).join('');
   $('scoreDetails').innerHTML='<p class="muted small">以下是预先选定艺术目标下的演示权重。它没有真人评分标定，不适合跨目标直接排名。</p>'+table(['指标','当前','对照','权重'],Object.entries(result.score.metrics).map(([k,v])=>`<tr><td>${esc(C.scoreLabels[k])}</td><td>${fmt(v)}</td><td>${comparison?fmt(comparison.score.metrics[k]):'—'}</td><td>${fmt(result.score.weights[k])}%</td></tr>`).join(''));
 }
 const profileLabels={relationship:'关系线索敏感度',memory:'回忆唤起敏感度',lossSensitivity:'损失敏感度',sensorySensitivity:'刺激负担敏感度',initialFamiliarity:'初始熟悉度',initialHabit:'初始习惯基础',initialFatigue:'初始短期疲劳',initialExplanation:'初始解释支持'};
 function renderSettings(){
   $('profileEditor').innerHTML=`<label class="wide-field">观众画像<input data-profile="name" value="${esc(doc.profile.name)}"></label>`+Object.entries(profileLabels).map(([id,label])=>`<label class="field">${esc(label)}<input data-profile="${id}" type="number" min="0" max="${['initialFamiliarity','initialHabit','initialExplanation'].includes(id)?1:3}" step=".05" value="${doc.profile[id]}"></label>`).join('');
   $('parameterEditor').innerHTML=Object.entries(C.parameterLabels).map(([id,label])=>`<label class="field">${esc(label)}<input data-param="${id}" type="number" min="0" step="${/Half|Scale/.test(id)?1:.01}" value="${doc.parameters[id]}"></label>`).join('');
   const chosen=$('emotionSelect').value||doc.emotionModel[0].id;
   $('emotionSelect').innerHTML=optionList(doc.emotionModel,chosen);renderEmotionEditor();$('allParameters').value=JSON.stringify(doc.parameters,null,2);
 }
 function renderEmotionEditor(){const e=doc.emotionModel.find(e=>e.id===$('emotionSelect').value)||doc.emotionModel[0];$('emotionFormula').value=JSON.stringify(e,null,2);}
 function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 function update(mutator,msg){const prev=E.clone(doc);try{mutator();E.evaluate(doc);previousDoc=prev;recalculate(msg);}catch(e){doc=prev;reportError(e);}}
 document.addEventListener('click',e=>{
   const el=e.target.closest('[data-scene]');if(el){selected=Number(el.dataset.scene);render();return;}
   const id=e.target.closest('button')?.id;if(!id)return;
   if(id==='restoreSample'){replaceDoc(X.make($('exampleSelect').value),'已载入示例。对照中的观众、参数与当前版本一致。');}
   if(id==='newWork'){replaceDoc(X.blank(),'已建立空白作品；尚未标注的项目保留未知。');compareId='none';$('compareSelect').value='none';recalculate();}
   if(id==='importWork')$('fileInput').click();
   if(id==='exportWork')download('AP-作品.json',JSON.stringify(doc,null,2),'application/json');
   if(id==='exportResult')download('AP-轨迹计算.json',JSON.stringify({input:doc,result,comparison},null,2),'application/json');
   if(id==='exportCSV')download('AP-阶段状态.csv',E.resultCSV(result),'text/csv;charset=utf-8');
   if(id==='addScene')update(()=>{const b=X.blank().scenes[0];b.id='scene-'+Date.now();b.title='新的阶段';doc.scenes.push(b);selected=doc.scenes.length-1;},'已增加一个未标注阶段。');
   if(id==='deleteScene'&&doc.scenes.length>1)update(()=>{doc.scenes.splice(selected,1);selected=Math.min(selected,doc.scenes.length-1);});
   if(id==='moveUp'&&selected>0)update(()=>{[doc.scenes[selected-1],doc.scenes[selected]]=[doc.scenes[selected],doc.scenes[selected-1]];selected--;},'顺序已改变，后续状态重新递推。');
   if(id==='moveDown'&&selected<doc.scenes.length-1)update(()=>{[doc.scenes[selected+1],doc.scenes[selected]]=[doc.scenes[selected],doc.scenes[selected+1]];selected++;},'顺序已改变，后续状态重新递推。');
   if(id==='applyOutcomes')update(()=>{doc.scenes[selected].outcomes=JSON.parse($('outcomesEditor').value);doc.scenes[selected].outcomesKnown=$('outcomesKnown').checked;});
   if(id==='applyProcesses')update(()=>doc.scenes[selected].processes=JSON.parse($('processEditor').value));
   if(id==='applyEmotion')update(()=>{const next=JSON.parse($('emotionFormula').value);const ix=doc.emotionModel.findIndex(e=>e.id===$('emotionSelect').value);doc.emotionModel[ix]=next;},'组合公式已应用；全部阶段重新计算。');
   if(id==='applyParameters')update(()=>doc.parameters=JSON.parse($('allParameters').value),'参数已应用。');
   if(id==='reportToggle')$('scoreDetails').hidden=!$('scoreDetails').hidden;
 });
 document.addEventListener('change',e=>{
   const el=e.target;
   if(el.dataset.cue)update(()=>doc.scenes[selected].cues[el.dataset.cue]=el.value.trim()===''?null:Number(el.value));
   else if(el.dataset.sceneField)update(()=>doc.scenes[selected][el.dataset.sceneField]=el.dataset.sceneField==='duration'?Number(el.value):el.value);
   else if(el.dataset.profile)update(()=>doc.profile[el.dataset.profile]=el.dataset.profile==='name'?el.value:Number(el.value));
   else if(el.dataset.param)update(()=>doc.parameters[el.dataset.param]=Number(el.value));
   else if(el.id==='workTitle')update(()=>doc.title=el.value);
   else if(el.id==='styleSelect')update(()=>doc.style=el.value);
   else if(el.id==='compareSelect'){compareId=el.value;recalculate('已切换对照，双方使用同一观众与公式参数。');}
   else if(el.id==='chartMode')renderChart();else if(el.id==='matrixGroup')renderMatrix();else if(el.id==='emotionSelect')renderEmotionEditor();
 });
 $('fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw new Error('初版交互导入支持 5 MB 以内的作品 JSON');replaceDoc(JSON.parse(await f.text()),'作品已导入并重算。');}catch(err){reportError(err);}e.target.value='';});
 $('exampleSelect').innerHTML=optionList(X.variants,doc.variant||'original');$('compareSelect').innerHTML=optionList([{id:'none',label:'不显示对照'},...X.variants],compareId);$('styleSelect').innerHTML=optionList(Object.entries(C.styles).map(([id,s])=>({id,label:s.label})),doc.style);
 recalculate('已载入 '+doc.title+'。先点选一个阶段，查看它的感受组合和依据。');
 // Explicit public diagnostic readout for local acceptance; no network or secrets.
 window.APApp={getDocument:()=>E.clone(doc),getResult:()=>E.clone(result),getComparison:()=>comparison?E.clone(comparison):null,load:next=>replaceDoc(next,'已载入指定作品。')};
})();
