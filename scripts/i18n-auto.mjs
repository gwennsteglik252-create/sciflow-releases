#!/usr/bin/env node
/**
 * SciFlow Pro i18n Auto-Extractor & Replacer
 *
 * 自动扫描所有 .tsx 文件，提取中文字符串，生成翻译键，替换为 t() 调用。
 *
 * Usage:
 *   node scripts/i18n-auto.mjs --scan     # 仅扫描，显示报告
 *   node scripts/i18n-auto.mjs --apply    # 执行替换
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const ZH_OUT = path.join(ROOT, 'locales', 'zh_generated.ts');
const EN_OUT = path.join(ROOT, 'locales', 'en_generated.ts');

const MODE = process.argv.includes('--apply') ? 'apply' : 'scan';

// ============================================================
//  中英文常用 UI 术语词典 (200+ 条)
// ============================================================
const DICT = {
    // 通用操作
    '保存': 'Save', '取消': 'Cancel', '确认': 'Confirm', '删除': 'Delete',
    '编辑': 'Edit', '添加': 'Add', '关闭': 'Close', '返回': 'Back',
    '搜索': 'Search', '导出': 'Export', '导入': 'Import', '重置': 'Reset',
    '复制': 'Copy', '刷新': 'Refresh', '下载': 'Download', '上传': 'Upload',
    '浏览': 'Browse', '更多': 'More', '收起': 'Collapse', '完成': 'Done',
    '创建': 'Create', '更新': 'Update', '移除': 'Remove', '提交': 'Submit',
    '全部': 'All', '无': 'None', '是': 'Yes', '否': 'No',
    '确定': 'OK', '应用': 'Apply', '继续': 'Continue', '跳过': 'Skip',
    '选择': 'Select', '清除': 'Clear', '排序': 'Sort', '筛选': 'Filter',
    '展开': 'Expand', '折叠': 'Fold', '预览': 'Preview', '发送': 'Send',
    '接收': 'Receive', '开始': 'Start', '暂停': 'Pause', '停止': 'Stop',
    '重试': 'Retry', '撤销': 'Undo', '重做': 'Redo', '粘贴': 'Paste',
    '剪切': 'Cut', '打印': 'Print', '分享': 'Share', '收藏': 'Favorite',
    '设置': 'Settings', '帮助': 'Help', '退出': 'Exit', '登录': 'Login',
    '注册': 'Register', '登出': 'Logout', '修改': 'Modify',

    // 状态
    '加载中': 'Loading', '处理中': 'Processing', '成功': 'Success',
    '失败': 'Failed', '错误': 'Error', '警告': 'Warning', '提示': 'Hint',
    '待处理': 'Pending', '进行中': 'In Progress', '已完成': 'Completed',
    '已取消': 'Cancelled', '已过期': 'Expired', '已激活': 'Activated',
    '未知': 'Unknown', '空': 'Empty', '暂无数据': 'No data',
    '暂无': 'None yet', '无结果': 'No results',

    // 科研领域
    '实验': 'Experiment', '课题': 'Project', '文献': 'Literature',
    '论文': 'Paper', '报告': 'Report', '数据': 'Data', '分析': 'Analysis',
    '结果': 'Result', '结论': 'Conclusion', '假设': 'Hypothesis',
    '里程碑': 'Milestone', '节点': 'Node', '进度': 'Progress',
    '样品': 'Sample', '参数': 'Parameter', '指标': 'Metric',
    '模型': 'Model', '算法': 'Algorithm', '方法': 'Method',
    '材料': 'Material', '合成': 'Synthesis', '制备': 'Preparation',
    '表征': 'Characterization', '测试': 'Test', '验证': 'Verification',
    '优化': 'Optimization', '评估': 'Evaluation', '对比': 'Comparison',
    '趋势': 'Trend', '统计': 'Statistics', '概率': 'Probability',
    '计算': 'Calculation', '模拟': 'Simulation', '仿真': 'Simulation',
    '研究': 'Research', '科研': 'Scientific Research',
    '课题库': 'Project Repository', '机理': 'Mechanism',
    '推演': 'Deduction', '实验表征': 'Experimental Characterization',
    '库存': 'Inventory', '管理': 'Management',
    '写作': 'Writing', '绘图': 'Drawing', '视频': 'Video',
    '团队': 'Team', '成员': 'Member', '协作': 'Collaboration',
    '看板': 'Dashboard', '仪表盘': 'Dashboard',
    '配方': 'Formulation', '反应': 'Reaction', '催化': 'Catalysis',
    '电催化': 'Electrocatalysis', '光催化': 'Photocatalysis',

    // 学术写作
    '摘要': 'Abstract', '引言': 'Introduction', '概述': 'Overview',
    '背景': 'Background', '方法论': 'Methodology', '讨论': 'Discussion',
    '参考文献': 'References', '附录': 'Appendix', '致谢': 'Acknowledgments',
    '关键词': 'Keywords', '图表': 'Figures & Tables', '公式': 'Formula',
    '章节': 'Section', '段落': 'Paragraph', '标题': 'Title',
    '副标题': 'Subtitle', '目录': 'Table of Contents',
    '脚注': 'Footnote', '注释': 'Annotation', '引用': 'Citation',

    // UI 元素
    '按钮': 'Button', '输入框': 'Input', '下拉框': 'Dropdown',
    '复选框': 'Checkbox', '单选框': 'Radio', '开关': 'Switch',
    '滑块': 'Slider', '标签': 'Tag', '选项卡': 'Tab',
    '弹窗': 'Modal', '对话框': 'Dialog', '侧边栏': 'Sidebar',
    '导航': 'Navigation', '面包屑': 'Breadcrumb', '分页': 'Pagination',
    '加载': 'Loading', '刷新列表': 'Refresh List',
    '名称': 'Name', '描述': 'Description', '备注': 'Notes',
    '密码': 'Password', '邮箱': 'Email', '手机': 'Phone',
    '地址': 'Address', '日期': 'Date', '时间': 'Time',

    // 项目相关
    '新建': 'New', '新建课题': 'New Project', '打开': 'Open',
    '重命名': 'Rename', '归档': 'Archive', '恢复': 'Restore',
    '活跃': 'Active', '草稿': 'Draft', '发布': 'Publish',
    '版本': 'Version', '历史': 'History', '日志': 'Log',
    '通知': 'Notification', '消息': 'Message', '评论': 'Comment',
    '任务': 'Task', '计划': 'Plan', '目标': 'Goal',
    '优先级': 'Priority', '截止日期': 'Due Date', '负责人': 'Assignee',
    '状态': 'Status', '类型': 'Type', '分类': 'Category',
    '标签页': 'Tab', '面板': 'Panel',

    // 数据分析
    '图表': 'Chart', '柱状图': 'Bar Chart', '折线图': 'Line Chart',
    '饼图': 'Pie Chart', '散点图': 'Scatter Plot', '热力图': 'Heatmap',
    '雷达图': 'Radar Chart', '甘特图': 'Gantt Chart',
    '坐标轴': 'Axis', '图例': 'Legend', '网格': 'Grid',
    '平均值': 'Average', '最大值': 'Maximum', '最小值': 'Minimum',
    '总计': 'Total', '占比': 'Proportion',

    // AI 相关
    '智能': 'Smart', '自动': 'Auto', '推荐': 'Recommended',
    '生成': 'Generate', '分析中': 'Analyzing', '思考中': 'Thinking',
    '润色': 'Polish', '翻译': 'Translate', '总结': 'Summarize',
    '诊断': 'Diagnose', '预测': 'Predict', '识别': 'Identify',
};

// ============================================================
//  工具函数
// ============================================================
function walkDir(dir, exts = ['.tsx']) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', '.git', 'locales'].includes(entry.name)) continue;
            results.push(...walkDir(fullPath, exts));
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

function shortHash(text) {
    return crypto.createHash('md5').update(text).digest('hex').slice(0, 5);
}

/** 从文件路径生成模块名: components/Writing/WritingHeader.tsx → writing.writingHeader */
function fileToModule(filePath) {
    const rel = path.relative(COMPONENTS_DIR, filePath);
    const parts = rel.replace(/\.(tsx?|jsx?)$/, '').split(path.sep);
    return parts.map((p, i) => {
        if (i === 0) return p.charAt(0).toLowerCase() + p.slice(1);
        return p.charAt(0).toLowerCase() + p.slice(1);
    }).join('.');
}

/** 尝试用词典翻译中文文本为英文 */
function translateToEnglish(zhText) {
    // 精确匹配
    if (DICT[zhText]) return DICT[zhText];

    // 尝试逐词翻译
    let result = zhText;
    let translated = false;
    // 按长度降序排列词典条目以优先匹配长词
    const sortedKeys = Object.keys(DICT).sort((a, b) => b.length - a.length);
    for (const zh of sortedKeys) {
        if (result.includes(zh)) {
            result = result.replace(new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), DICT[zh]);
            translated = true;
        }
    }

    if (translated && !/[\u4e00-\u9fff]/.test(result)) {
        return result.trim();
    }

    // 回退: 返回带标记的原文
    return `[TODO] ${zhText}`;
}

/** 检查一行是否是注释 */
function isCommentLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<!--');
}

/** 检查一行是否已经被翻译 (包含 t( 调用) */
function isAlreadyTranslated(line) {
    // 检查该行的中文是否在 t() 调用内
    return false; // 我们通过其他方式跳过
}

// ============================================================
//  Chinese 匹配正则 — 匹配包含中文的字符串片段
// ============================================================
const CJK = '[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]';
const CJK_CONTENT = `(?:${CJK}[\\s\\S]*?${CJK}|${CJK})`;

// 匹配含中文的单引号字符串: '..中文..'
const RE_SINGLE_QUOTE = new RegExp(`'([^']*${CJK}[^']*)'`, 'g');
// 匹配含中文的双引号字符串: "..中文.."
const RE_DOUBLE_QUOTE = new RegExp(`"([^"]*${CJK}[^"]*)"`, 'g');
// 匹配含中文的模板字符串 (无插值): `..中文..`
const RE_TEMPLATE = new RegExp('`([^`]*' + CJK + '[^`]*)`', 'g');
// 匹配 JSX 属性值中的中文: attr="中文" 或 attr='中文'
const RE_JSX_ATTR = new RegExp(`(\\w+)=(['"])([^'"]*${CJK}[^'"]*)\\2`, 'g');

// ============================================================
//  主处理逻辑
// ============================================================
const allEntries = new Map(); // zhText → { key, enText }
let globalCounter = 0;

function getOrCreateEntry(zhText, moduleName) {
    if (allEntries.has(zhText)) {
        return allEntries.get(zhText);
    }
    const key = `${moduleName}.t${globalCounter++}`;
    const enText = translateToEnglish(zhText);
    const entry = { key, zhText, enText };
    allEntries.set(zhText, entry);
    return entry;
}

function processLine(line, moduleName) {
    // 跳过注释行
    if (isCommentLine(line)) return { line, entries: [], changed: false };
    // 没有中文直接跳过
    if (!/[\u4e00-\u9fff]/.test(line)) return { line, entries: [], changed: false };
    // 已经有 t( 调用的复杂情况 — 检查中文是否在 t() 内
    // 简单策略: 如果行已经包含 t(' 或 t(", 跳过整行
    if (/t\(['"]/.test(line)) return { line, entries: [], changed: false };

    const entries = [];
    let newLine = line;
    let changed = false;

    // 1. JSX 属性: attr="中文" → attr={t('key')}
    newLine = newLine.replace(RE_JSX_ATTR, (match, attrName, quote, zhText) => {
        // 跳过 className, style 等不需要翻译的属性
        if (['className', 'style', 'key', 'id', 'data-', 'aria-', 'viewBox', 'transform',
            'fill', 'stroke', 'd', 'cx', 'cy', 'rx', 'ry', 'r', 'x', 'y',
            'strokeWidth', 'strokeOpacity', 'href', 'src', 'type', 'value',
            'onChange', 'onClick', 'onSubmit', 'onKeyDown', 'ref',
            'xmlns', 'preserveAspectRatio'].some(skip =>
                attrName.startsWith(skip) || attrName === skip)) {
            return match;
        }
        const entry = getOrCreateEntry(zhText, moduleName);
        entries.push(entry);
        changed = true;
        return `${attrName}={t('${entry.key}')}`;
    });

    // 2. 单引号字符串: '中文' → t('key')
    //    但跳过已在 t() 内的和 CSS class 中的
    newLine = newLine.replace(RE_SINGLE_QUOTE, (match, zhText) => {
        // 检查前面是不是 t( — 已经被翻译
        const idx = newLine.indexOf(match);
        if (idx > 0 && newLine.substring(Math.max(0, idx - 3), idx).includes('t(')) {
            return match;
        }
        // 跳过看起来像 CSS 或技术标识的
        if (/^[\w\-\.\#\/\\]+$/.test(zhText) && !/[\u4e00-\u9fff]/.test(zhText)) {
            return match;
        }
        const entry = getOrCreateEntry(zhText, moduleName);
        entries.push(entry);
        changed = true;
        return `t('${entry.key}')`;
    });

    // 3. 双引号字符串: "中文" → t('key')
    newLine = newLine.replace(RE_DOUBLE_QUOTE, (match, zhText) => {
        const idx = newLine.indexOf(match);
        if (idx > 0 && newLine.substring(Math.max(0, idx - 3), idx).includes('t(')) {
            return match;
        }
        const entry = getOrCreateEntry(zhText, moduleName);
        entries.push(entry);
        changed = true;
        return `t('${entry.key}')`;
    });

    // 4. JSX 文本内容: 标签之间的中文 >中文<
    //    这个比较tricky，在上面的步骤之后，检查行中是否还有裸的中文
    if (/[\u4e00-\u9fff]/.test(newLine)) {
        // 匹配 > 和 < 之间的中文文本
        newLine = newLine.replace(/>([\s]*)((?:[\u4e00-\u9fff][\u4e00-\u9fff\w\s\.,，。！？：；、（）「」()\-\+\/\'\"\d%·…→←↑↓✨🎯📊🔬🧪💡🔍📝✅❌⚠️🔄💻🌙☀️])*)([\s]*)</g,
            (match, pre, zhText, post) => {
                if (!zhText || !zhText.trim()) return match;
                const trimmed = zhText.trim();
                if (!trimmed) return match;
                // 跳过纯数字/符号（但包含中文）
                if (!/[\u4e00-\u9fff]/.test(trimmed)) return match;
                const entry = getOrCreateEntry(trimmed, moduleName);
                entries.push(entry);
                changed = true;
                return `>${pre}{t('${entry.key}')}${post}<`;
            }
        );
    }

    // 5. 模板字符串 (无插值): `中文` → t('key')
    if (/[\u4e00-\u9fff]/.test(newLine)) {
        newLine = newLine.replace(RE_TEMPLATE, (match, zhText) => {
            // 只处理不含 ${} 插值的模板字符串
            if (zhText.includes('${')) return match;
            const entry = getOrCreateEntry(zhText, moduleName);
            entries.push(entry);
            changed = true;
            return `t('${entry.key}')`;
        });
    }

    // 重置正则的 lastIndex (全局正则需要)
    RE_SINGLE_QUOTE.lastIndex = 0;
    RE_DOUBLE_QUOTE.lastIndex = 0;
    RE_TEMPLATE.lastIndex = 0;
    RE_JSX_ATTR.lastIndex = 0;

    return { line: newLine, entries, changed };
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 快速检查: 是否有中文
    if (!/[\u4e00-\u9fff]/.test(content)) return { changed: false, entriesCount: 0 };

    const lines = content.split('\n');
    const moduleName = fileToModule(filePath);
    const fileEntries = [];
    let anyChanged = false;

    const newLines = lines.map((line, i) => {
        const result = processLine(line, moduleName);
        if (result.changed) {
            anyChanged = true;
            fileEntries.push(...result.entries);
        }
        return result.line;
    });

    if (!anyChanged) return { changed: false, entriesCount: 0 };

    // 注入 import 和 hook
    let finalContent = newLines.join('\n');

    // 添加 import (如果没有)
    if (!finalContent.includes('useTranslation')) {
        const depth = path.relative(path.dirname(filePath), ROOT).split(path.sep).length;
        const prefix = '../'.repeat(path.relative(path.dirname(filePath), path.join(ROOT, 'locales')).split(path.sep).filter(Boolean).length - 1) || './';
        // 计算相对路径
        const localesRelative = path.relative(path.dirname(filePath), path.join(ROOT, 'locales')).replace(/\\/g, '/');
        const importLine = `import { useTranslation } from '${localesRelative}/useTranslation';`;

        // 在最后一个 import 后添加
        const importRegex = /^(import\s+.+from\s+.+;?\s*$)/gm;
        let lastImportEnd = 0;
        let m;
        while ((m = importRegex.exec(finalContent)) !== null) {
            lastImportEnd = m.index + m[0].length;
        }
        if (lastImportEnd > 0) {
            finalContent = finalContent.slice(0, lastImportEnd) + '\n' + importLine + finalContent.slice(lastImportEnd);
        }
    }

    // 添加 hook 调用 (如果没有)
    if (!finalContent.includes("const { t }") && !finalContent.includes("const {t}")) {
        // 寻找 React 组件函数的入口点
        const patterns = [
            // const Foo: React.FC = (...) => {
            /^(\s*(?:export\s+)?const\s+\w+[\s\S]*?=>\s*\{)/m,
            // function Foo(...) {
            /^(\s*(?:export\s+)?(?:default\s+)?function\s+\w+[\s\S]*?\{)/m,
        ];

        let injected = false;
        for (const pat of patterns) {
            const match = finalContent.match(pat);
            if (match) {
                const insertPos = match.index + match[0].length;
                finalContent = finalContent.slice(0, insertPos) + '\n  const { t } = useTranslation();' + finalContent.slice(insertPos);
                injected = true;
                break;
            }
        }

        // 如果没找到组件函数，尝试更宽泛的匹配
        if (!injected) {
            const broadMatch = finalContent.match(/=>\s*\{/);
            if (broadMatch) {
                const insertPos = broadMatch.index + broadMatch[0].length;
                finalContent = finalContent.slice(0, insertPos) + '\n  const { t } = useTranslation();' + finalContent.slice(insertPos);
            }
        }
    }

    if (MODE === 'apply') {
        fs.writeFileSync(filePath, finalContent, 'utf-8');
    }

    return { changed: true, entriesCount: fileEntries.length };
}

// ============================================================
//  生成翻译文件
// ============================================================
function generateTranslationFiles() {
    // 按 key 的模块分组，生成嵌套结构
    const zhEntries = {};
    const enEntries = {};

    for (const [zhText, entry] of allEntries) {
        const parts = entry.key.split('.');
        let zhCurr = zhEntries;
        let enCurr = enEntries;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!zhCurr[parts[i]]) zhCurr[parts[i]] = {};
            if (!enCurr[parts[i]]) enCurr[parts[i]] = {};
            zhCurr = zhCurr[parts[i]];
            enCurr = enCurr[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        zhCurr[lastKey] = entry.zhText;
        enCurr[lastKey] = entry.enText;
    }

    const zhContent = `// ═══ SciFlow Pro — 自动生成的中文翻译 ═══\n// 由 i18n-auto.mjs 自动生成于 ${new Date().toISOString()}\n// 共 ${allEntries.size} 条翻译\n\nconst zh_generated = ${JSON.stringify(zhEntries, null, 2)};\n\nexport default zh_generated;\n`;
    const enContent = `// ═══ SciFlow Pro — Auto-generated English translations ═══\n// Generated by i18n-auto.mjs at ${new Date().toISOString()}\n// Total: ${allEntries.size} entries\n// [TODO] entries need manual translation\n\nconst en_generated = ${JSON.stringify(enEntries, null, 2)};\n\nexport default en_generated;\n`;

    if (MODE === 'apply') {
        fs.writeFileSync(ZH_OUT, zhContent, 'utf-8');
        fs.writeFileSync(EN_OUT, enContent, 'utf-8');
    }

    return { zhEntries, enEntries };
}

// ============================================================
//  主流程
// ============================================================
console.log(`\n🌐 SciFlow i18n Auto-Extractor`);
console.log(`   模式: ${MODE === 'apply' ? '✏️  执行替换' : '👁  仅扫描'}`);
console.log(`   扫描目录: ${COMPONENTS_DIR}\n`);

const files = walkDir(COMPONENTS_DIR, ['.tsx']);
console.log(`📂 发现 ${files.length} 个 .tsx 文件\n`);

let changedFiles = 0;
let totalEntries = 0;

for (const file of files) {
    const result = processFile(file);
    if (result.changed) {
        changedFiles++;
        totalEntries += result.entriesCount;
        const rel = path.relative(ROOT, file);
        if (MODE === 'scan') {
            console.log(`  ✨ ${rel} (${result.entriesCount} 条提取)`);
        } else {
            console.log(`  ✅ ${rel} (${result.entriesCount} 条已替换)`);
        }
    }
}

const { zhEntries, enEntries } = generateTranslationFiles();

console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 统计报告:`);
console.log(`   待处理文件: ${changedFiles} / ${files.length}`);
console.log(`   唯一翻译条目: ${allEntries.size}`);
console.log(`   总提取次数: ${totalEntries}`);

if (MODE === 'scan') {
    console.log(`\n💡 这是预览模式。执行替换请运行:`);
    console.log(`   node scripts/i18n-auto.mjs --apply`);
} else {
    console.log(`\n✅ 替换完成！`);
    console.log(`   生成文件:`);
    console.log(`   - ${path.relative(ROOT, ZH_OUT)}`);
    console.log(`   - ${path.relative(ROOT, EN_OUT)}`);
    console.log(`\n⚠️  下一步:`);
    console.log(`   1. 将 zh_generated.ts 的内容合并到 zh.ts`);
    console.log(`   2. 将 en_generated.ts 的内容合并到 en.ts`);
    console.log(`   3. 在 useTranslation.ts 中引入生成的翻译文件`);
    console.log(`   4. 检查 [TODO] 标记的英文翻译并手动修正`);
}

// 输出一些需要手动处理的模板字符串
const todoCount = [...allEntries.values()].filter(e => e.enText.startsWith('[TODO]')).length;
if (todoCount > 0) {
    console.log(`\n⚡ ${todoCount} 条翻译需要手动补充英文 (标记为 [TODO])`);
}

console.log(`\n${'═'.repeat(50)}\n`);
