# 群体校准与有限参数搜索

这套模块把两件事情分开：AP 如何产生预测，以及预测与真实观众评分有多大偏差。它可以拟合简单的输出映射，也可以用同一 AP 引擎比较有限组参数。它不把“高艺术目标指数”自动改叫“满意率”，不会在导入数据后悄悄修改引擎默认值。

**当前证据：校准管道已在真实 EmoBank 人类标注数据运行；AP 的作品预测精度尚未在该语料上验证。** 此版本的公开数据试验是“人类作者视角标注 → 人类读者视角标注”映射，输入本身也是人工情绪标注，不能当作自动文本预测能力。英文句子 VAD 也不能替代中文视频、音乐、观众满意度或全部 AP 认知感受。

## 快速使用

Node.js 20 或更新版本；无第三方运行依赖：

```js
const fs = require('node:fs');
const {
  inspectDataset, fitCalibration, applyCalibration, tuneParameters
} = require('./lib/calibration.js');

const data = JSON.parse(fs.readFileSync('examples/calibration-synthetic.json', 'utf8'));
console.log(inspectDataset(data));
const model = fitCalibration(data);
console.log(model.report.channels.warmth.splits.test);
console.log(applyCalibration({ warmth: .6, unresolved: null }, model));
```

`calibration-synthetic.json` 是刻意生成的 36 行软件验证数据。线性关系已知，因此拟合能够恢复它；这不支持任何人类预测精度结论。对应结果保存在 `calibration-synthetic-model.json`，方便比较接口。

## 观测格式与信息隔离

```json
{
  "schema": "ap-aesthetics-observations/1",
  "dataset_id": "audience-study-v1",
  "source": {
    "url": "urn:local:anonymous-audience-study",
    "license": "participant consent; local analysis only",
    "label_kind": "anonymous audience ratings of warmth; 0 to 1"
  },
  "prediction_provenance": {
    "method": "Frozen cue annotation made before audience labels were collected",
    "independent_of_labels": true
  },
  "observations": [
    {
      "id": "story-01-scene-2",
      "work_id": "story-01-cut-A",
      "group_id": "story-01-all-cuts",
      "split": "train",
      "predictions": { "warmth": 0.63, "surprise": null },
      "observed": { "warmth": 0.48, "surprise": 0.12 },
      "n": 12,
      "weight": 1
    }
  ]
}
```

上面只有一行，仅说明格式。真实拟合至少要有训练和验证数据；留出测试缺失时，测试指标为 `null`。

- `id`：观测身份，必须唯一。
- `work_id`：明确版本的作品身份。同一作品不能横跨切分。
- `group_id`：更上层的共享来源，如同一故事的全部剪辑、同一视频的各片段、同一原文的句子。它是泄漏控制单位，不是“年轻观众”这样的群体画像。有关联的版本应共享此值。
- `split`：事先按作品/来源分配的 `train`、`validation`、`test`，不根据结果优劣重切。
- `predictions`、`observed`：相同含义与时间尺度的 0–1 通道。缺测可以为空对象或 `null`，不补零。0 是明确观察到没有该感受。
- `n`：该条群体均值包含的评分数量，只作描述，不增加独立作品数量。重复看同一作品的一万人，不等于一万个独立作品。
- `weight`：改变同组内各行的重要性。每个独立来源组的总权重固定为 1，避免长片或大量切段支配拟合。
- `prediction_provenance`：必须说明预测如何在不读取目标标签的情况下生成。这是待审查的来源声明；程序无法证明标注者真的没有偷看标签。

同 `work_id` 或 `group_id` 跨切分会直接报告数据错误。不同 ID 但同源内容仍需要正确填写 `group_id`；不存在能自动识别所有改写、翻译和衍生剪辑的通用检测器。参数搜索另会拒绝同一完整 AP 文档哈希跨切分。

对作品先按观众当时能知道的线索标注，再冻结文档、引擎、预测及时间戳，最后才打开观众标签。不要看了观众说“感动”后，把 `care` 和 `memory` 提高，再把计算结果当作预测验证。

## 输出校准：简单、可解释、可停用

对每个通道独立拟合：

\[
\hat y=\operatorname{clip}_{[0,1]}(a x+b)
\]

每个来源组总权重为 1，组内按行权重归一。训练优化目标是加权均方误差加上 `lambda × (a−1)²`，即把斜率向“保持原预测”收缩；截距不惩罚。斜率限制为非负，避免把“越强的温暖”拟合成“越弱的温暖”而不揭示模型语义错误。

默认 `lambda=[0,.001,.01,.1,1]`。验证集从这些拟合及完全不校准的 `identity` 中选择误差最低者；平局优先 identity。系数仅由训练标签拟合，验证集只选择，不再用验证标签重拟合。测试集最后报告，不能作为验证集代用。

输出同时保留：

1. 原预测误差。
2. 校准后误差。
3. **训练集均值基线**，用它回答“复杂方法是否比总猜平均水平有用”。
4. MSE、RMSE、MAE、偏差、相关系数，以及数据行数/独立组数。
5. 按来源组 bootstrap 的成对 MSE 改善区间；默认 300 次、固定随机种子，可复算。少于两组时区间未知；小组数会明确警告。该区间只反映当前数据组，不是新观众的保证或单个观众预测区间。

`applyCalibration` 对未知但合法的通道保持原值，缺测仍为 `null`。输入 schema、危险对象键、非有限值、越界预测、非法或负斜率模型都拒绝；应用时检查全部模型通道，不能把损坏系数藏在未使用通道内。

返回结果包含 `model_id`、数据哈希、`selection_hash`。选择哈希不含测试观测，因而单独改变测试标签不会改变所选模型身份。数据哈希包含完整数据，仍能追踪测试报告对应哪个数据版本。

没有自动采用：保留原模型与校准层各自版本。若用测试结果继续改参数，这份测试数据已经参与研究，应再取得新的留出集；不能无休止地看同一测试集直至“变好”。

## 调整 AP 内部参数

每行再提供独立标注的 `document`（完整 `ap-aesthetics/1` 对象）；可用 `scene_id` 指定阶段，未指定时取整个作品的时长加权平均。

```js
const candidate = tuneParameters(datasetWithDocuments, {
  parameter_grid: {
    emotionGain: [0.7, 1.0, 1.3],
    fatigueHalf: [25, 40, 70]
  },
  channel_map: {
    warmth: { kind: 'emotion', id: 'warmth', aggregation: 'mean' },
    attention: { kind: 'cfs', id: 'attention', aggregation: 'mean' }
  }
});
```

调用共享 `web/engine.js`，不实现第二套情绪引擎。现有参数名与合法数值由同一验证器检查，最多 256 组假设，额外保留原文档默认参数作为对照。这个上限约束一次显式搜索的范围，避免误把无穷优化挂进每次创作；需要更大研究时另行提出明确实验设计。

可运行数据见 `examples/calibration-tuning-synthetic.json`，参数见 `calibration-tuning-options.json`，结果见 `calibration-tuning-result.json`。这是刻意用 `emotionGain=.7` 的引擎生成标签、测试能否找回它的软件例子，**不是独立心理实验**；六个小文档也不足以估计真实人群误差。

支持 `cfs`、`emotion`、`score_metric`、`score` 的显式映射，不能从 `V/A/D` 自动推断全部感受。AP 正负信号率没有 0–1 上界，因此不得直接当作规范化通道。认知感受支持 mean/peak/end；引擎未保留完整情绪峰值，因此情绪仅 mean/end。

按验证集选择参数，训练、验证使用固定相同通道的平均 MSE；测试只计算选中候选及原参数对照，另给训练均值基线。原作品对象不修改；输出原文档与候选文档哈希、引擎版本、完整参数试验表。

搜索目标通道仅由训练和验证中已观测的标签确定。测试中新增的通道报告为未验证，不参与参数选择或通道映射；测试中原通道变为缺测只使测试指标未知，不能改变已经选出的参数。

情绪标签的效用需要对齐：例如一个场景的“平均紧张”不能拿结尾瞬间评分比较，个体“满意”也不能用研究者标注的“积极措辞”替代。群体画像（文化、年龄、熟悉度、媒介、观看条件）应固定或分开拟合并报告，不把不同群体混成一个永恒平均人。

## 本轮公开数据：EmoBank

官方仓库：[JULIELab/EmoBank](https://github.com/JULIELab/EmoBank)。固定 revision `248ce2a43e165a66d31aeaed83cff9641d6654e0`。官方 README 声明 **CC BY-SA 4.0**；作者 Sven Buechel、Udo Hahn，原始文本来源 MASC 与 SemEval 2007 Task 14。脚本与文档引用：

- [EmoBank, EACL 2017](https://aclanthology.org/E17-2092/)
- [Readers vs. writers vs. texts, LAW 2017](https://aclanthology.org/W17-0801/)

```sh
node scripts/public-data-emobank.js --download --out examples/calibration-emobank-summary.json
```

脚本只从官方仓库读取固定版本的 README、reader.csv、writer.csv、meta.tsv，逐一验证固定 SHA-256。原始文件保留在内存，不写入仓库、不上传作品、不读取凭据、不调用模型；输出只有聚合统计与拟合系数。断网环境可用 `--from-directory PATH` 指向已下载的相同版本，仍验证哈希，不能把修改过的本地文件冒充固定版本。

**2026-10-05 实际执行结果：**

| 数据 | 读者视角 | 作者视角 |
|---|---:|---:|
| 有效句子标注 | 10,325 | 10,279 |
| 来源文档 | 136 | 136 |
| 两种视角均有标注的句子 | 10,062 | 10,062 |

标注数量是句子数，不是唯一参与者人数。官方语料中的 `emobank.csv` 默认合并两种视角；本工具保留分离，以免“作者表达的情绪”混成“读者体验”。官方 V/A/D 在 1–5 范围，计算时用 `(x−1)/4` 映射为 0–1。

分组使用官方 `meta.tsv.document`。根据 `SHA256(固定盐+document)` 划分 70%/15%/15% 概率区间；本次实际为训练 100 个来源文档、验证 14 个、测试 22 个。映射试验对应 7,817 / 482 / 1,763 句。每组等权，因此不直接等于所有句子无权平均。此切分比官方句子分层切分更注重文档间泛化，**不能把数字直接与官方基准排行榜比较**。

真实管道对照为 `writer.csv → reader.csv`，三个通道分别进行上述 affine 校准。数据输入复制只读 writer 列，reader 仅作为目标；切分与参数候选都未读取 reader 结果。二者来自同一句子，当然统计相关，**未核验 worker 是否互不重叠**，不能据此声称标注者层面独立，也不进行因果推断。

| 留出通道，0–1 尺度 | 原 writer RMSE | 训练均值 RMSE | 校准后 RMSE |
|---|---:|---:|---:|
| V：情绪正负方向 | 0.08114 | 0.09607 | 0.07819 |
| A：唤醒 | 0.09387 | 0.08115 | 0.07719 |
| D：掌控感 | 0.07905 | 0.06610 | 0.06492 |

尤其要看均值基线：D 的改善很小，按来源 bootstrap 的“优于均值”区间跨过零，不能宣称它已可靠超越总猜均值。A/V 的当前区间为正，但也只说明两种人工标注的映射；它们没有展示 AP 输入提取、作品创作、中文受众或个体反应预测的准确度。完整结果保存在 `examples/calibration-emobank-summary.json`，标有 `ap_accuracy:false` 和 `ap_evaluation.performed:false`。

派生统计按 CC BY-SA 4.0 保留归因，源码许可证不替代数据许可证。仓库不再分发原始句子、参与者信息或逐条标注。

## 如何真正改进作品评估

1. 固定目标观众、媒介与标签；先选少数可观测通道，如惊、好奇、温暖、走神、整体喜欢。
2. 盲标作品线索、冻结预测和原始版本。取得授权的观众反馈，保留无感、反感和不同解释。
3. 以作品/来源分组；先做常数基线、简单情绪分析基线及未校准 AP 基线。
4. 用训练/验证选择少量参数或输出映射，只看一次留出结果。比较每种感受误差与版本选择效果，而不只追一个总分。
5. 创作修改保持同一艺术目标，记录正面收益与代价。例如更早揭晓可能提高理解、降低惊；不为抬分改写线索标注。
6. 判断失败发生在“线索估计 → 注意/记忆状态 → 感受组合 → 群体映射”的哪一段，再做有区分力的修改。公共 VAD 数据无法验证缺失的通道，应保留未知。

## 验证命令与当前边界

```sh
node --test tests/calibration.test.js
node scripts/public-data-emobank.js --help
```

检查包括来源泄漏、缺测、常数基线、冻结测试标签不影响模型身份、重复源权重、同核参数重算、文档哈希与非修改、合法/非法 JSON 键、模型输入检查及有限网格。

本轮最终专项检查 **20/20 通过**。主作者审阅曾发现参数搜索的通道集合会查看测试标签是否存在，已改为仅训练/验证决定，并用“测试独有新通道＋原通道缺测”同时扰动验证候选与选择哈希不变。

这一版本提供可运行校准能力和真实公共数据管道，不包含已经在人类作品偏好上训练完的 AP 参数包。群体均值也会因平台、文化、时代、媒介和样本招募变化；“统计比较稳定”应作为可检验的假设，而不是数据规模大就自动成立的前提。
