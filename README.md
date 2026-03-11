# 🧬 SciFlow Pro — 科研全流程智能工作站

<p align="center">
  <img src="https://img.shields.io/badge/版本-v1.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/平台-macOS%20|%20Windows-brightgreen?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/AI%20引擎-GPT--5%20|%20Gemini%20|%20Claude%20|%20DeepSeek-purple?style=flat-square" alt="AI" />
  <img src="https://img.shields.io/badge/架构-本地优先-orange?style=flat-square" alt="Architecture" />
  <img src="https://img.shields.io/badge/许可证-MIT-green?style=flat-square" alt="License" />
</p>

> **一站式科研数据处理、论文写作与协作平台**
> 
> 从立项到发表，覆盖科研工作的每一个环节。

---

## ✨ 核心亮点

- 🤖 **多模型 AI 引擎** — 支持 GPT-5/Gemini/Claude/DeepSeek/Qwen/Moonshot/Llama 等 30+ 模型，智能路由自动选择最优模型
- 📊 **专业科研绘图** — 期刊级图表、桑基图、弦图、时间线、机理图，一键达到发表标准
- 🔬 **全表征数据分析** — XRD/XPS/SEM/TEM/BET 等数据导入即分析
- ✍️ **学术写作工坊** — 多栏排版、LaTeX 公式、文献引用、AI 润色，所见即所得
- ☁️ **云端协作** — 多人实时协同编辑，项目进度一目了然
- 💻 **跨平台** — 支持 macOS (Apple Silicon) 和 Windows

---

## 📦 下载安装

| 平台 | 下载链接 | 系统要求 |
|:----:|---------|---------|
| 🍎 **macOS** | [SciFlow-Pro-1.0.0-arm64.dmg](https://github.com/gwennsteglik252-create/sciflow-releases/releases/download/v1.0.0/SciFlow-Pro-1.0.0-arm64.dmg) | macOS 12+ (Apple Silicon) |
| 🪟 **Windows** | [SciFlow-Pro-Setup-1.0.0.exe](https://github.com/gwennsteglik252-create/sciflow-releases/releases/download/v1.0.0/SciFlow-Pro-Setup-1.0.0.exe) | Windows 10/11 (64-bit) |

<details>
<summary>🪟 <strong>Windows 安装步骤</strong>（点击展开）</summary>

1. 下载 `.exe` 安装包
2. 双击运行安装程序
3. 如果弹出 **SmartScreen 蓝色警告**，点击 「更多信息」 → 「仍要运行」
4. 按提示完成安装即可

</details>

<details>
<summary>🍎 <strong>macOS 安装步骤</strong>（点击展开）</summary>

1. 下载 `.dmg` 文件并双击打开
2. 将 SciFlow Pro 拖入 **Applications** 文件夹
3. ⚠️ **首次打开前**，需要在终端执行以下命令（解除安全限制）：

```bash
sudo xattr -cr "/Applications/SciFlow Pro.app"
```

**操作方法**：
- 按 `Command + 空格键`，输入「终端」并回车打开
- 将上面的命令粘贴到终端中，按回车
- 输入你的电脑开机密码（输入时不会显示字符，这是正常的），再按回车
- 完成！现在可以从启动台打开 SciFlow Pro 了 🎉

> 💡 **为什么需要这一步？** 因为当前版本尚未进行 Apple 公证签名，macOS 会将未签名的应用标记为「不安全」。此命令仅需执行一次，后续更新无需重复。

</details>

---

## 🚀 快速上手

只需三步，开启您的 AI 辅助科研之旅：

1.  **配置 AI 引擎**：打开「系统设置」→「AI 引擎配置」，填入您的 Gemini/OpenAI/DeepSeek 等 API Key。
2.  **创建课题项目**：在「研究看板」点击「新建项目」，您可以选择从「智能立项」开始由 AI 辅助生成研究蓝图。
3.  **导入第一篇文献**：在「文献查找」中搜索或直接向「情报档案」拖入 PDF，让 AI 为您自动提取提纲与关键工艺参数。

---

## 🤖 AI 如何助力你的科研？

SciFlow Pro 将大语言模型深度嵌入科研工作的**每一个环节**，而不仅仅是一个聊天窗口。以下是 AI 在各阶段的具体作用：

### 📍 选题与立项阶段
- **研究前沿扫描**：AI 自动检索和分析目标领域近期高引文献，发现研究空白
- **选题可行性评估**：基于实验室现有条件和文献数据，评估课题可行性并生成立项报告
- **竞争态势分析**：分析主要竞争课题组的研究方向，帮你找到差异化切入点

### 📚 文献研究阶段
- **批量文献摘要**：一键提取 PDF 文献的核心观点、实验方法和关键数据
- **文献对比矩阵**：自动生成多篇文献的对比表格（方法、材料、性能指标）
- **知识图谱构建**：自动发现文献之间的引用关系和概念关联，构建可视化知识网络

### ⚗️ 实验设计阶段
- **DOE 参数推荐**：根据前期数据，AI 推荐下一轮实验的最优参数组合
- **实验方案生成**：输入研究目标，自动生成详细的实验操作步骤和注意事项
- **实验流程图**：自然语言描述实验过程，AI 自动转化为标准流程图

### 🔬 数据表征阶段
- **XRD 智能检索**：上传衍射数据，AI 自动匹配 COD 数据库中的晶体结构并给出置信度
- **XPS 化学态分析**：自动识别 XPS 谱峰对应的化学态，分析元素价态变化
- **SEM/TEM 图像分析**：AI 视觉模型自动检测颗粒尺寸分布、孔隙率、晶格间距
- **一键 Benchmark**：AI 自动搜索同类材料的文献性能数据，生成对比分析报告

### ⚛️ 机理推演阶段
- **反应路径推测**：基于实验数据和文献证据，AI 推演可能的反应机理路径
- **催化机理图生成**：描述反应过程，AI 辅助生成双金属协同、电荷转移等机理示意图
- **多角度论证**：AI 专家辩论模式，从不同学科视角讨论机理的合理性

### 📊 数据分析阶段
- **异常值诊断**：自动检测实验数据中的异常点并分析可能原因
- **趋势预测**：基于已有数据点预测实验趋势，减少不必要的重复实验
- **统计分析建议**：根据数据特征推荐合适的统计方法（t检验、ANOVA、回归等）

### ✍️ 论文写作阶段
- **三档 AI 润色**：轻度（语法纠错）/ 中度（句式优化）/ 深度（学术改写），保持你的写作风格
- **引文自动管理**：AI 根据论文内容推荐合适的引用文献并自动生成参考文献列表
- **图表交叉引用**：智能编号 Fig./Table/Eq.，自动保持全文交叉引用一致性
- **多期刊格式适配**：一键切换 Nature/Science/IEEE/APA/JACS 等引用格式

### 🎙️ 实验操作阶段
- **语音实验伴侣**：湿实验时双手不方便操作？用语音记录实验现象、查询操作步骤
- **实验日志自动整理**：语音记录的零散笔记由 AI 自动整理成结构化实验日志

> 💡 **关键设计理念**：所有 AI 功能均采用**本地优先**架构，你的实验数据和论文内容不会被上传到任何第三方服务器。AI 调用使用你自己配置的 API Key，完全由你掌控。

---

## 🎯 适用人群

SciFlow Pro 专为以下科研群体量身打造：

*   **🧪 实验科学研究者**（化学、材料、能源、生物等）：自动分析表征数据，追踪复杂实验工艺。
*   **🎓 硕博研究生 / 博士后**：快速梳理海量文献，高效产出符合顶刊标准的图表与论文。
*   **👨‍🏫 课题组长 (PI)**：全局掌控项目进度，优化团队分工，快速评估前沿方向可行性。
*   **🏭 研发工程师**：追踪工艺演化过程，模拟工业放大流程，加速科技成果从实验室走向产业化。

---

## 🧩 功能模块详解

SciFlow Pro 内置 **17 个深度集成的功能模块**，覆盖科研工作的完整生命周期：

<details open>
<summary><b>🚀 选题与立项</b></summary>

#### 📌 战略立项 · Inception Pusher v4.5

AI 驱动的课题孵化引擎，通过四个递进阶段完成从灵感到正式立项的全过程：

| 阶段 | 名称 | 核心能力 |
|:----:|:----:|:---------|
| STEP 01 | **选题孵化** | 输入研究方向的关键词，AI 自动生成科学假设（Subject Blueprint），包含核心理论依据、预期学术贡献和创新点分析 |
| STEP 02 | **情报扫射** | 基于 Web of Science 2020-2025 实时数据生成**全球科研版图散点图**（竞争态势 vs 创新方向），识别活跃课题组和专利/技术风险 |
| STEP 03 | **蓝图规划** | Monte Carlo 引擎模拟 5-7 年研究风险与 KPI 预测，自动合成高保真战略推演蓝图 (Master Blueprint) |
| STEP 04 | **立项评审** | 组建虚拟评审委员会（Dr. Rigor 严谨派 / Dr. Nova 创新派 / Dr. Forge 工程派），模拟答辩攻防，生成多维度立项评分报告 |

- 支持草稿库保存和加载，方便多版本迭代
- 评审通过后可一键转为正式课题，自动进入课题工作流

#### 🌐 行业动态

实时追踪目标领域的前沿动向，AI 引擎自动聚合多源信息：

- 🔔 **科研快讯**：自动推送目标期刊的最新论文、高引文献突变（Citation Burst）
- 📜 **专利预警**：监控相关技术领域的专利公开和授权信息
- 🏛️ **政策追踪**：聚合国内外科技基金、项目申报和顶层政策变化
- 📊 **竞品分析**：追踪主要竞争课题组的发文频率、合作网络和技术路线变化

#### 📋 研究看板

课题组的数字化指挥中心：

- 📈 **项目总览仪表盘**：进度条、里程碑状态、预算消耗燃尽图
- 📅 **项目计划**：甘特图模式管理任务时间线和依赖关系
- 🏷️ **成果汇报**：一键导出课题阶段性报告，支持 PPT/PDF 格式
- 🎯 **归档库**：历史课题的归档与检索

</details>

<details>
<summary><b>📖 文献与情报</b></summary>

#### 🔍 文献查找

内置学术搜索引擎，支持 Web of Science 核心合集检索逻辑：

- **多维检索**：按主题词 (TS)、作者、期刊名、DOI 等组合检索
- **文献类型筛选**：Article / Review / Patent / Conference 分类过滤
- **时间范围**：不限 / 近 1 年 / 近 3 年 / 近 5 年
- **质量控制**：顶刊优先策略 (ON/OFF)，基于影响因子智能排序
- **AI 矩阵诊断**：自动检测检索结果中的研究空白区域
- **一键入档**：搜索结果直接保存为情报档案，自动提取元数据

#### 📚 情报档案

文献的深度管理与研读引擎：

- **档案库管理**：支持多分类标签体系（核心理论 / 工艺标准 / 性能标样 / 专利检索），每篇文献可属于多个分类
- **AI 深度研读**：一键生成文献的学术摘要、核心工艺 (Methodology)、沉淀参数 (Benchmarking Metrics) 提取报告
- **知识沉淀**：将文献中的关键数据点沉淀为结构化知识条目，供后续引用
- **转化建议**：AI 分析文献中的方法对你当前课题的可转化性
- **本地文件管理**：PDF 标记为「本地已精读」状态，支持数据追溯

#### 🧠 科研大脑

课题的知识图谱与跨域关联引擎：

- **节点关系图**：自动构建文献之间的引用网络、概念关联和知识脉络
- **自动聚类**：AI 识别文献群落中的核心议题和关键桥梁论文
- **研究空白发现**：通过知识图谱中的稀疏区域，自动标记潜在创新机会
- **交互式探索**：支持点击节点查看文献详情，拖拽调整关系权重

</details>

<details>
<summary><b>⚗️ 实验与工艺</b></summary>

#### 📂 课题工作流

基于 **TRL（技术成熟度分级系统）** 的课题全生命周期管理：

- **拓扑节点树**：课题按层级拆解为多个拓扑节点（如「催化剂理论设计与模型初筛 → 催化剂实验室可控制备 → 制备 NiFe-LDH」），支持无限层级嵌套
- **实验组对比管理**：每个节点下可创建多个实验组，自动对比关键参数差异（配比、浓度、温度、洗涤次数等）
- **AI 对比分析**：一键生成组间表征对比分析报告，包含 XRD 物相、性能指标等
- **TRL 进度追踪**：当前阶段可视化标记（TRL 1-9），从基础研究到工程验证全程可追溯
- **多视图切换**：工作流 / 工艺路线 / 实验矩阵 / 样本矩阵 / 项目计划 / 归档库 / 成果汇报

#### 🧪 实验矩阵

结构化的实验设计与执行中心：

- **联合对标设计**：自定义实验参数维度（反应温度、前驱体浓度、PVP 添加量等），自动生成参数组合矩阵
- **实验编号系统**：PID 自动编号，支持 PENDING / RUNNING / ANOMALY 等状态标记
- **空间分布追踪**：记录每组实验的空间分布 (Spatial Distribution) 和 Runs 次数
- **关联 DOE**：标记哪些实验组来自 DOE 推荐（「联合对标」「报告快照」「满足 DOE」标签）

#### 🔀 实验路线

可视化的实验流程编排工具：

- **节点式流程图**：拖拽式编辑实验步骤节点，自动连线表示实验依赖关系
- **多分支对比**：同一实验点可分叉为多个路线，方便 A/B 方案对比
- **自然语言转换**：输入文字描述实验流程，AI 自动转化为标准流程图

#### 📈 工艺演化

技术成熟度的可视化追踪面板：

- **TRL 级别标记**：当前课题的技术成熟度（TRL 1 基础原理 → TRL 9 工业验证）
- **演化时间线**：每次 TRL 升级的关键节点、核心工艺变化和性能指标记录
- **工艺路线图**：可视化展示从实验室配方到中试/量产的参数演化路径

#### 🏭 工业流程

面向产业化的工艺模拟与放大引擎：

- **工艺参数仿真**：输入实验室参数，模拟产线级别的工艺流程
- **放大预测**：基于理论模型预测批量生产时的关键参数变化
- **成本效益分析**：估算规模化生产的成本结构和产出效益

#### ⭐ DOE 迭代

智能实验设计优化系统（Design of Experiments）：

- **正交矩阵生成**：支持 L4 / L9 / Anchor 等多种标准矩阵，自动计算因子水平组合
- **因子与响应管理**：自定义因子（温度、浓度、时间等）的范围、单位和离散选项；定义响应变量（转化率、选择性等）的优化方向
- **AI 推荐**：根据历史实验数据，AI 推荐下一轮的激进/保守/探索性参数组合（Aggressive / Conservative / Exploration 三种调性）
- **结果归档**：每轮 DOE 结果可保存为模板，支持归档管理和历史对比
- **同步到课题**：DOE 推荐的实验方案可一键同步到课题工作流的实验矩阵中

</details>

<details>
<summary><b>🔬 分析与表征</b></summary>

#### 🔬 实验表征中心

一站式表征数据分析平台，支持从原始数据到学术结论的完整链路：

**XRD 物相分析**
- 📁 导入 `.xy` / `.csv` / `.txt` 等格式的衍射数据
- 🔍 智能物相检索：自动匹配 COD (Crystallography Open Database) 晶体数据库
- 📊 Bragg 方程计算 d-spacing，消光规则自动验证
- 🏆 一键 Benchmark：AI 搜索同类材料的文献 XRD 数据，生成对标报告
- 💾 快照持久化：分析结果自动保存，支持跨会话恢复

**XPS 化学态分析**
- ⚛️ 自动识别 XPS 谱峰对应的元素化学态
- 📈 峰拟合与分峰，分析元素价态变化趋势
- 📝 AI 辅助解读化学态转变的物理意义

**SEM/TEM 显微形貌**
- 🖼️ AI 视觉模型自动检测：颗粒尺寸分布、孔隙率、晶格间距、层状结构
- 📏 标尺自动识别与真实比例尺计算
- 📊 形貌统计直方图自动生成

**BET 比表面积**
- 📊 比表面积和孔径分布自动计算
- 🔬 等温线分类与微孔/介孔判定

#### ⚛️ 机理推演工坊

AI 驱动的反应机理可视化模拟器：

- **参数化建模**：输入催化剂材料、反应条件（温度、压力、pH 等）和目标反应，AI 推演可能的反应路径
- **机理可视化**：自动生成催化机理示意图（双金属协同、电荷转移路径、界面调控、电子态密度等）
- **比较矩阵**：多个模拟方案的横向对比表，AI 辅助分析差异
- **模拟归档**：每次推演结果保存到归档库，支持重命名、删除和重新加载
- **理论描述符**：自动计算吸附能、d-band center、电荷转移量等理论描述符
- **AI 辩论模式**：模拟不同学科背景专家的质疑与论证，确保机理逻辑严密

#### 📊 数据分析室

实验数据的高级可视化与统计分析：

- **图表配置面板**：坐标轴设置（标题、范围、刻度）、系列样式（颜色、线型、标记点）自定义
- **多系列叠加**：同一坐标系下叠加多个数据序列，方便对比分析
- **图表模板**：保存常用配置为模板，一键复用
- **异常值检测**：AI 自动标注数据中的跳变点和异常值
- **关联分析**：绑定到课题中的实验矩阵数据，轴标签自动对应

</details>

<details>
<summary><b>🎨 科研可视化</b></summary>

#### 🎨 绘图中心 · Scientific Visual Engine v3.0

SciFlow Pro 的核心绘图引擎，支持 **20+ 种学术图表类型**：

| 类别 | 图表类型 |
|:----:|:---------|
| **经典图表** | 柱状图、折线图、面积图、饼图、环形图、散点图、气泡图 |
| **科研专用** | 雷达图、热力图、箱线图、小提琴图、瀑布图 |
| **高级学术** | 桑基图(Sankey)、弦图(Chord)、时间线、演化路径图、机理结构图 |
| **结构化制图** | 节点关系图、层级树图、流程图 |

- 🎨 **主题系统**：内置多套学术配色方案（Nature / Science / IEEE / ACS 风格）
- ✏️ **LaTeX 标注**：轴标签和标注支持 LaTeX 数学公式渲染
- 🖥️ **实时预览**：所有修改即时反映在画布上
- 📤 **高清导出**：SVG（矢量，推荐投稿）/ PNG（最高 600 DPI）/ PDF

#### 📖 文献绘图

面向文献综合分析的专属绘图模式：

- 📊 从情报档案中直接引用文献性能数据，自动生成性能对比散点图
- 📈 文献发表趋势图、期刊分布饼图、作者合作网络
- 🔗 图表与文献源自动关联，支持溯源

#### 🔄 综述绘图

综述论文专用的高级可视化工具：

- 🌀 **弦图 (Chord Diagram)**：展示文献之间的引用交叉关系，自动计算连接强度
- 🔀 **桑基图 (Sankey Diagram)**：技术演进路径可视化，自动智能排序防止交叉
- 📅 **时间线 (Timeline)**：研究发展脉络的时序可视化
- 🔬 **机理概念图**：双金属协同机理、界面调控等概念图自动排版

#### 🖼️ 图表拼版 · Figure Assembly

论文投稿前的最后一步——图表组装工具：

- 📐 **自由拼版**：多图拖拽排列，支持网格对齐和自由布局
- 🏷️ **统一标注**：批量添加 Fig. 1a, 1b, 1c... 标注和比例尺
- 📏 **尺寸规范**：预设期刊的图片尺寸要求（单栏 / 双栏 / 全页）
- 📤 **高清导出**：SVG / PNG / PDF，分辨率可达 600 DPI

</details>

<details>
<summary><b>✍️ 写作与协作</b></summary>

#### ✍️ 写作工坊

学术论文的全功能所见即所得编辑器：

**编辑器核心能力**
- 📄 **多栏排版**：单栏 / 双栏 / 三栏实时预览，适配 Nature (Double Column)、Science 等期刊模板
- 🔢 **LaTeX 公式**：支持行内 `$...$` 和行间 `$$...$$` 公式的实时渲染
- 📝 **富文本编辑**：标题层级 (H2/H3)、加粗/斜体、上下标 (X₂/X⁴)、特殊符号 (√/Ω) 等
- 🖼️ **一键启动绘图**：直接在编辑器中启动 Scientific Figure Studio 制作图表

**AI 写作助手**
- ✨ **三档润色**：轻度（语法纠错）/ 中度（句式优化）/ 深度（学术改写），保持你的写作风格
- 🔗 **引文自动管理**：AI 根据论文上下文推荐合适的文献引用，自动格式化参考文献列表
- 🔄 **图表交叉引用**：Fig./Table/Eq. 智能编号，全文引用自动同步

**出版视图**
- 📰 **发表级预览**：右侧实时渲染出版物式排版（含图表嵌入、参考文献列表）
- 📐 **多格式适配**：一键切换 Nature/Science/IEEE/APA/JACS 等引用格式
- 📤 **导出**：支持导出为 PDF/Word/LaTeX
- 💾 **自动保存**：每次编辑自动保存，支持版本历史回溯

**素材侧边栏**
- 🔖 **大纲 / 素材 / 文献 / 镜像 / 润色 / 审阅 / 版本** 七大面板
- 📚 **项目媒体库**：集中管理论文用图，支持拖拽插入
- 📖 **文献面板**：从情报档案中直接引用文献到正文

#### 🎬 视频工坊

科研成果的多媒体展示引擎：

- 🎥 将实验过程、数据分析结果制作成科研演示视频
- 📊 数据动画：图表变化过程的动态可视化
- 🎙️ AI 配音：自动生成英文/中文解说词

#### 👥 人员矩阵

课题组的团队战斗力管理系统：

- 👤 **成员档案**：每位成员的研究方向、技能标签、在研项目
- 🔐 **角色权限**：PI / 副教授 / 博士后 / 研究生 / 本科生等角色分级管理
- 📊 **产出追踪**：成员论文产出、专利贡献和项目参与度统计
- 💬 **在线协作**：实时在线状态、实验日志共享和课题讨论

#### 📦 库存管理

实验室的智能耗材管家：

- 📋 **出入库记录**：记录每次药品/耗材的领用和归库，支持二维码扫描
- ⚠️ **低库存预警**：设定安全库存阈值，自动预警提醒补货
- 📅 **有效期追踪**：危化品和试剂的保质期监控
- 🛒 **采购清单**：AI 根据历史消耗自动生成补货建议

</details>

---

## ⚖️ 科研工具差异化定位

SciFlow Pro 不是要替代您现有的工具，而是作为「科研大脑」将它们串联起来：

| 维度 | 传统工具 (Origin/LaTeX/Notion) | SciFlow Pro |
|:---:|:---|:---|
| **核心逻辑** | 单点工具，数据碎片化 | **全流程闭环**，从立项到发表一站式 |
| **AI 深度** | 外挂式对话框 | **嵌合式引擎**，AI 直联表征、流与写作 |
| **数据安全** | 强制云端同步或纯本地 | **本地优先 + 自有 Key**，端到端隐私保护 |
| **行业属性** | 通用软件，需自行建模 | **深度垂直**，内置 XRD/TRL/学术图表模板 |

---

## 📸 功能展示

<div align="center">
<table>
<!-- 🚀 第一排：立项与规划 -->
<tr>
<td align="center"><b>📌 项目立项</b><br><img src="docs/screenshots/inception_new.png" width="260" /></td>
<td align="center"><b>🌐 行业动态</b><br><img src="docs/screenshots/industry_dynamics.png" width="260" /></td>
<td align="center"><b>📋 研究看板</b><br><img src="docs/screenshots/dashboard_new.png" width="260" /></td>
</tr>
<!-- 📖 第二排：文献与情报 -->
<tr>
<td align="center"><b>🔍 文献查找</b><br><img src="docs/screenshots/literature_search_new.png" width="260" /></td>
<td align="center"><b>📚 情报档案</b><br><img src="docs/screenshots/literature_archive_v2.png" width="260" /></td>
<td align="center"><b>🧠 科研大脑</b><br><img src="docs/screenshots/brain_v2.png" width="260" /></td>
</tr>
<!-- ⚗️ 第三排：实验与工艺 -->
<tr>
<td align="center"><b>📂 课题工作流</b><br><img src="docs/screenshots/workflow_v2.png" width="260" /></td>
<td align="center"><b>📈 工艺演化</b><br><img src="docs/screenshots/process_evolution.png" width="260" /></td>
<td align="center"><b>🏭 工业流程</b><br><img src="docs/screenshots/industrial_flow.png" width="260" /></td>
</tr>
<!-- 🔬 第四排：分析与推演 -->
<tr>
<td align="center"><b>🔬 表征分析</b><br><img src="docs/screenshots/xrd_new.png" width="260" /></td>
<td align="center"><b>⚛️ 机理推演</b><br><img src="docs/screenshots/mechanism_new.png" width="260" /></td>
<td align="center"><b>🤖 AI 智能助手</b><br><img src="docs/screenshots/ai_assistant.png" width="260" /></td>
</tr>
<!-- 🎨 第五排：科研可视化 -->
<tr>
<td align="center"><b>🎨 绘图中心</b><br><img src="docs/screenshots/figure_center_v2.png" width="260" /></td>
<td align="center"><b>📖 文献绘图</b><br><img src="docs/screenshots/literature_figure.png" width="260" /></td>
<td align="center"><b>🔄 综述绘图</b><br><img src="docs/screenshots/review_figure.png" width="260" /></td>
</tr>
<!-- ✍️ 第六排：写作与协作 -->
<tr>
<td align="center"><b>✍️ 写作工坊</b><br><img src="docs/screenshots/writing_studio_new_v2.png" width="260" /></td>
<td align="center"><b>🖼️ 图表拼版</b><br><img src="docs/screenshots/figure_assembly_new.png" width="260" /></td>
<td align="center"><b>👥 人员矩阵</b><br><img src="docs/screenshots/people_matrix.png" width="260" /></td>
</tr>
</table>
</div>

---

## ⚙️ 系统设置

### 🔧 多模型 AI 引擎配置
| 引擎 | 支持模型 |
|------|---------|
| **Google Gemini** | Gemini 3.1 Pro · Gemini 2.5 Pro / Flash · Gemini 2.0 Pro / Flash / Flash Lite · Gemini 1.5 Pro / Flash |
| **OpenAI** | GPT-5 · GPT-4o · o2 · o3-mini · GPT-3.5 Turbo |
| **Anthropic** | Claude 4 Opus / Sonnet · Claude 3.7 Sonnet · Claude 3.5 Sonnet / Haiku · Claude 3 Opus |
| **DeepSeek** | DeepSeek V3 · DeepSeek R1 (Reasoner) |
| **Moonshot (Kimi)** | Moonshot V1 8k / 32k / 128k |
| **通义千问 (Qwen)** | Qwen Max · Qwen Plus · Qwen Turbo · Qwen Long · Qwen 2.5 72B / 7B |
| **硅基流动** | DeepSeek V3/R1 · Qwen 2.5 72B/7B（聚合国产模型） |
| **OpenRouter** | Claude 3.5 Sonnet · GPT-4o · Llama 3.1 70B · Gemini Pro 1.5（多模型聚合网关） |
| **豆包 (自定义)** | 支持自定义 Base URL + Model Name，兼容任意 OpenAI 兼容 API |
| 🔄 **智能路由** | 基于任务类型自动选择最优模型（成本优先 / 质量优先两种策略） |

### 🌏 多语言支持
- 界面语言：中文 / English
- AI 输出语言：中文 / English / 自动检测

---

## 🛡️ 隐私与安全

SciFlow Pro 深知科研数据的敏感性，从架构层面确保你的数据安全：

| 特性 | 说明 |
|:----:|:-----|
| 🏠 **本地优先存储** | 所有项目数据、实验记录、论文草稿默认存储在本地 IndexedDB，不经过任何第三方服务器 |
| 🔑 **自有 API Key** | AI 功能使用你自己配置的 API Key 直连模型提供商，SciFlow 不代理也不缓存你的请求 |
| 🔒 **端到端加密** | 云端协作数据传输采用 TLS 加密，服务端存储使用 AES-256 加密 |
| 📴 **离线可用** | 核心功能（写作、绘图、数据管理）完全支持离线运行，不依赖网络连接 |
| 🚫 **不训练模型** | 你的科研数据和论文内容绝不会被用于任何 AI 模型的训练 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                  SciFlow Pro                     │
├──────────┬──────────┬──────────┬────────────────┤
│  Electron │  React   │  Vite    │  TypeScript    │
├──────────┴──────────┴──────────┴────────────────┤
│              核心功能层                           │
│  📊 Scientific Visual Engine (SVG/Canvas)        │
│  ✍️ Academic Writing Engine (富文本/LaTeX)        │
│  🔬 Characterization Analysis (XRD/XPS/SEM)     │
│  🧠 AI Router (多模型智能路由)                    │
├─────────────────────────────────────────────────┤
│              数据层                               │
│  💾 IndexedDB (本地持久化)                        │
│  ☁️ Supabase (云端协作同步)                       │
└─────────────────────────────────────────────────┘
```

---

## ❓ 常见问题

<details>
<summary><b>Q: 如何配置 AI 功能的 API Key？</b></summary>

打开 SciFlow Pro → 点击左下角 ⚙️ 设置 → 找到「AI 引擎配置」→ 选择你使用的模型提供商 → 粘贴你的 API Key 即可。

支持的提供商包括：OpenAI、Google Gemini、Anthropic Claude、DeepSeek、硅基流动等。

</details>

<details>
<summary><b>Q: 我的数据会被上传到云端吗？</b></summary>

**不会。** SciFlow Pro 采用「本地优先」架构，所有数据默认存储在你的电脑本地。只有当你**主动开启**云端协作功能时，项目数据才会通过加密通道同步到云端。AI 功能使用你自己的 API Key 直连模型提供商，SciFlow 不代理请求、不缓存数据。

</details>

<details>
<summary><b>Q: macOS 提示"应用已损坏"或无法打开怎么办？</b></summary>

这是因为当前版本尚未进行 Apple 公证签名。请在终端执行：

```bash
sudo xattr -cr "/Applications/SciFlow Pro.app"
```

执行后即可正常打开，此命令仅需执行一次。

</details>

<details>
<summary><b>Q: 支持哪些文献格式导入？</b></summary>

支持 PDF、BibTeX、RIS、EndNote XML 等主流文献格式的批量导入。导入后 AI 会自动提取元数据（标题、作者、摘要、关键词等）。

</details>

<details>
<summary><b>Q: 绘制的图表可以导出为什么格式？</b></summary>

支持导出为 **SVG**（矢量图，推荐用于论文投稿）、**PNG**（高分辨率位图）、**PDF** 等格式，分辨率可自定义（最高 600 DPI）。

</details>

---

## 📋 更新日志

### v1.0.0 (2026-03-11)
🎉 **首次公开发布**

- ✅ 战略立项与行业动态扫描
- ✅ 多源文献检索与情报档案管理
- ✅ TRL 技术成熟度课题工作流
- ✅ XRD/XPS/SEM/TEM 全表征分析
- ✅ AI 辅助机理推演与反应路径预测
- ✅ 学术写作工坊（多栏排版 + LaTeX + AI 润色）
- ✅ Scientific Visual Engine 科研绘图引擎
- ✅ 多模型 AI 引擎（GPT-5/Gemini/Claude/DeepSeek）
- ✅ 云端实时协作
- ✅ macOS (Apple Silicon) + Windows 双平台支持

---

## 💬 联系与反馈

我们非常重视你的使用体验和建议！

| 渠道 | 说明 |
|:----:|:-----|
| 🐛 **Bug 反馈** | [提交 Issue](https://github.com/gwennsteglik252-create/sciflow-releases/issues) |
| 💡 **功能建议** | [提交 Feature Request](https://github.com/gwennsteglik252-create/sciflow-releases/issues/new?labels=enhancement) |
| 📧 **商务合作** | 请通过 Issue 联系 |

---

<p align="center">
  <strong>© 2026 SciFlow Pro · All Rights Reserved</strong><br>
  <sub>用科技加速科研，让发现更快发生 🚀</sub>
</p>
