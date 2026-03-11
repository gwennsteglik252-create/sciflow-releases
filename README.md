# 🧬 SciFlow Pro — 科研全流程智能工作站

> **一站式科研数据处理、论文写作与协作平台**
> 
> 从立项到发表，覆盖科研工作的每一个环节。

---

## ✨ 核心亮点

- 🤖 **多模型 AI 引擎** — 支持 GPT-5/Gemini/Claude/DeepSeek/豆包，智能路由自动选择最优模型
- 📊 **专业科研绘图** — 期刊级图表、桑基图、弦图、时间线、机理图，一键达到发表标准
- 🔬 **全表征数据分析** — XRD/XPS/SEM/TEM/BET 等数据导入即分析
- ✍️ **学术写作工坊** — 多栏排版、LaTeX 公式、文献引用、AI 润色，所见即所得
- ☁️ **云端协作** — 多人实时协同编辑，项目进度一目了然
- 💻 **跨平台** — 支持 macOS (Apple Silicon) 和 Windows

---

## 📸 功能展示

<div align="center">
<table>
<tr>
<td align="center"><b>📌 项目立项</b><br><img src="docs/screenshots/inception_new.png" width="260" /></td>
<td align="center"><b>📋 研究看板</b><br><img src="docs/screenshots/dashboard_new.png" width="260" /></td>
<td align="center"><b>🧠 科研大脑</b><br><img src="docs/screenshots/brain_v2.png" width="260" /></td>
</tr>
<tr>
<td align="center"><b>📂 课题工作流</b><br><img src="docs/screenshots/workflow_v2.png" width="260" /></td>
<td align="center"><b>🔍 文献查找</b><br><img src="docs/screenshots/literature_search_new.png" width="260" /></td>
<td align="center"><b>📚 情报档案</b><br><img src="docs/screenshots/literature_archive_v2.png" width="260" /></td>
</tr>
<tr>
<td align="center"><b>✍️ 写作工坊</b><br><img src="docs/screenshots/writing_studio_new_v2.png" width="260" /></td>
<td align="center"><b>⚛️ 机理推演</b><br><img src="docs/screenshots/mechanism_new.png" width="260" /></td>
<td align="center"><b>🔬 表征分析</b><br><img src="docs/screenshots/xrd_new.png" width="260" /></td>
</tr>
<tr>
<td align="center"><b>🎨 绘图中心</b><br><img src="docs/screenshots/figure_center_v2.png" width="260" /></td>
<td align="center"><b>📖 文献绘图</b><br><img src="docs/screenshots/literature_figure.png" width="260" /></td>
<td align="center"><b>🔄 综述绘图</b><br><img src="docs/screenshots/review_figure.png" width="260" /></td>
</tr>
<tr>
<td align="center"><b>🏭 工业流程</b><br><img src="docs/screenshots/industrial_flow.png" width="260" /></td>
<td align="center"><b>📈 工艺演化</b><br><img src="docs/screenshots/process_evolution.png" width="260" /></td>
<td align="center"><b>🌐 行业动态</b><br><img src="docs/screenshots/industry_dynamics.png" width="260" /></td>
</tr>
<tr>
<td align="center"><b>🖼️ 图表拼版</b><br><img src="docs/screenshots/figure_assembly_new.png" width="260" /></td>
<td align="center"><b>👥 人员矩阵</b><br><img src="docs/screenshots/people_matrix.png" width="260" /></td>
<td align="center"><b>🤖 AI 智能助手</b><br><img src="docs/screenshots/ai_assistant.png" width="260" /></td>
</tr>
</table>
</div>

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

## ⚙️ 系统设置

### 🔧 多模型 AI 引擎配置
| 引擎 | 支持模型 |
|------|---------|
| **Google Gemini** | Gemini 1.5/2.0/3.1 系列 |
| **OpenAI** | GPT-4o, o1, o3-mini |
| **Anthropic** | Claude 3.5/3.7 系列 |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 |
| **硅基流动** | 聚合国内主流模型 |
| 🔄 **智能路由** | 自动分配最优模型 |

### 🌏 多语言支持
- 界面语言：中文 / English
- AI 输出语言：中文 / English / 自动检测

---

## 🛡️ 隐私与安全

- **本地优先**：所有数据默认存储在本地，你的科研数据完全由你掌控
- **离线可用**：核心功能完全离线运行，不依赖网络

---

<p align="center">
  <strong>© 2026 SciFlow Pro · All Rights Reserved</strong><br>
  <sub>用科技加速科研，让发现更快发生 🚀</sub>
</p>
