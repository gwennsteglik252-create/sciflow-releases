import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG, IMAGE_MODEL, NATIVE_IMAGE_GEN_MODEL } from "./core";

/**
 * NEW: Generate Research Timeline Data
 */
export const generateTimelineDataAI = async (prompt: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';
        const instruction = `你是一名资深科学史专家和项目规划师。
        请根据以下主题或描述，生成一个【科学发展/研究进度时间轴】。
        
        主题描述: "${prompt}"
        
        要求：
        1. 包含 5-8 个关键事件节点。
        2. 时间跨度需符合逻辑（如果是历史回顾则跨年，如果是项目计划则跨月/季度）。
        3. 每一个事件包含:
           - date: 简洁的时间标签
           - title: 专业的学术标题
           - description: 简明扼要的描述（50字以内）
           - type: 从 'breakthrough', 'milestone', 'publication', 'industrial', 'failed_attempt' 中选择。
        4. 语言: ${langNote}。
        
        输出 JSON 格式。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        events: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    date: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['breakthrough', 'milestone', 'publication', 'industrial', 'failed_attempt'] }
                                },
                                required: ["date", "title", "description", "type"]
                            }
                        }
                    },
                    required: ["title", "events"]
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data = JSON.parse(rawJson);

        // 兼容性修复：处理 AI 可能的嵌套包装
        if (data && !data.events) {
            const nestedKey = Object.keys(data).find(k =>
                k.toLowerCase().includes('timeline') ||
                k.toLowerCase().includes('data') ||
                k.toLowerCase().includes('history') ||
                k.toLowerCase().includes('events')
            );
            if (nestedKey && (data[nestedKey].events || Array.isArray(data[nestedKey]))) {
                data = data[nestedKey].events ? data[nestedKey] : { ...data, events: data[nestedKey] };
            }
        }

        // 字段映射标准化：处理 AI 可能忽略 schema 字段名的情况
        if (data && !data.events) {
            const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
            if (arrayKey) data.events = data[arrayKey];
        }

        if (!data.events) data.events = [];
        if (!data.title) data.title = "演进研究路线";

        // 后置处理：自动分配节点展示侧 (Side) 及缺失字段补齐
        data.events = data.events.map((ev: any, idx: number) => {
            const date = ev.date || ev.time || ev.year || '未知时间';
            const title = ev.title || ev.name || ev.event || '未命名事件';
            const description = ev.description || ev.content || ev.desc || '';
            const type = ev.type || 'milestone';

            return {
                ...ev,
                id: ev.id || `ev_${Date.now()}_${idx}`,
                date,
                title,
                description,
                type,
                side: idx % 2 === 0 ? 'top' : 'bottom'
            };
        });

        return data;
    });
};

/**
 * 解析文献提取工艺流程描述
 */
export const parseLiteratureForProcess = async (fileData: string, mimeType: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深催化工艺专家。请从这份文献中提取完整的合成工艺流程描述。
        要求：
        1. 包含具体的试剂用量、温度、时间等参数。
        2. 描述必须准确、严谨。
        3. 仅输出工艺描述文本，不要有任何多余文字。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [
                { inlineData: { mimeType: mimeType, data: fileData } },
                { text: prompt }
            ],
            config: SPEED_CONFIG
        });
        return response.text || "";
    });
};

/**
 * 工艺数字化建模（阶段1 — 快速骨架）
 * 仅生成步骤的核心字段（text/description/risk/safetyAlert/scalingInsight/doeAnchor），
 * 不包含 BOM 数据，由 generateStepBOM 按需补充。
 */
export const generateFlowchartData = async (description: string, scaleFactor: number, targetTrl: number, detailLevel: 'concise' | 'detailed' = 'concise') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是首席工艺建模工程师。将以下工艺描述转化为数字化模型。

工艺描述: "${description}"
规模系数: ${scaleFactor} (1=实验室, 100=中试, 1000=工业)
目标TRL: ${targetTrl}
步骤数: ${detailLevel === 'concise' ? '5-7个' : '8-12个'}

要求:
1. text=具体步骤名称
2. description=详细操作步骤(含温度/时间/用量等具体参数，至少50字)
3. safetyAlert=该步EHS安环预警(危险化学品/高温高压风险)
4. scalingInsight=工业放大难点(传热传质/设备限制)
5. doeAnchor=该步最关键的可优化实验变量
6. optimizedParameters和controlParameters的reason必须具体
7. 禁用"适量"等模糊词，数值必须具体

注意：本次仅生成工艺步骤骨架，不需要生成物料清单(BOM)。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: '工艺方案标题' },
                        steps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING, description: '步骤名称' },
                                    description: { type: Type.STRING, description: '详细操作描述(含温度/时间/用量等具体参数)' },
                                    riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                                    safetyAlert: { type: Type.STRING, description: 'EHS安环预警' },
                                    scalingInsight: { type: Type.STRING, description: '工业放大难点' },
                                    doeAnchor: { type: Type.STRING, description: '最关键的可优化实验变量' }
                                },
                                required: ['text', 'description', 'riskLevel', 'safetyAlert', 'scalingInsight', 'doeAnchor']
                            }
                        },
                        optimizedParameters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                },
                                required: ['key', 'value', 'reason']
                            }
                        },
                        controlParameters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                },
                                required: ['key', 'value', 'reason']
                            }
                        }
                    },
                    required: ['title', 'steps']
                }
            }
        });
        const rawText = response.text || '{}';
        console.log('[FlowchartAI] 原始AI响应文本前200字符:', rawText.substring(0, 200));
        const rawJson = extractJson(rawText);
        let data = JSON.parse(rawJson);
        console.log('[FlowchartAI] 原始AI响应键:', Object.keys(data), '| steps存在:', !!data.steps, '| stepCount:', data.steps?.length);

        // ═══ 兼容性修复：处理 AI 可能的嵌套包装 ═══
        if (!data.steps) {
            const nestedKey = Object.keys(data).find(k =>
                k.toLowerCase().includes('process') ||
                k.toLowerCase().includes('workflow') ||
                k.toLowerCase().includes('flowchart') ||
                k.toLowerCase().includes('model') ||
                k.toLowerCase().includes('result') ||
                k.toLowerCase().includes('data') ||
                k.toLowerCase().includes('output')
            );
            if (nestedKey && data[nestedKey]?.steps) {
                data = { ...data[nestedKey], title: data.title || data[nestedKey].title };
            }
        }
        if (!data.steps) {
            const stepsAlternatives = ['stages', 'procedures', 'workflow', 'operations', 'procedure', 'processSteps', 'process_steps'];
            for (const alt of stepsAlternatives) {
                if (Array.isArray(data[alt])) {
                    data.steps = data[alt];
                    break;
                }
            }
        }
        if (!data.steps) {
            const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]) && data[k].length > 0 && data[k][0].text);
            if (arrayKey) data.steps = data[arrayKey];
        }

        // 自动补齐 ID + 智能内容补位
        if (data.steps) {
            data.steps = data.steps.map((s: any, i: number) => {
                const resolvedText = (s.text && s.text.trim()) ||
                    (s.title && s.title.trim()) ||
                    (s.name && s.name.trim()) ||
                    (s.doeAnchor && s.doeAnchor.trim()) ||
                    `步骤 ${i + 1}`;
                let resolvedDesc = (s.description && s.description.trim()) ||
                    (s.content && s.content.trim()) ||
                    (s.detail && s.detail.trim()) || '';
                if (!resolvedDesc && (s.scalingInsight || s.safetyAlert)) {
                    resolvedDesc = [s.scalingInsight, s.safetyAlert].filter(Boolean).join('；');
                }
                return {
                    ...s,
                    id: s.id || `step_${i}_${Date.now()}`,
                    text: resolvedText,
                    description: resolvedDesc,
                    riskLevel: s.riskLevel || s.risk_level || s.risk || 'low',
                    bomItems: [] // BOM 将通过阶段2按需生成
                };
            });
        }

        console.log('[FlowchartAI] 最终结果:', { hasSteps: !!data.steps, stepCount: data.steps?.length, title: data.title });
        return data;
    });
};

/**
 * 工艺 BOM 生成（阶段2 — 按需加载）
 * 根据已有的工艺步骤，为所有步骤或指定步骤批量生成物料清单(BOM)。
 */
export const generateStepBOM = async (
    steps: { text: string; description: string }[],
    scaleFactor: number
) => {
    return callGeminiWithRetry(async (ai) => {
        const stepsContext = steps.map((s, i) => `步骤${i + 1}: ${s.text}\n  描述: ${s.description}`).join('\n\n');

        const prompt = `你是一名资深工艺经济分析师。请为以下工艺步骤生成详细的物料清单(BOM)。

规模系数: ${scaleFactor} (1=实验室, 100=中试, 1000=工业)

【工艺步骤】
${stepsContext}

要求:
1. 每步3-6项物料，涵盖四类:
   - 化学物料（试剂、溶剂）
   - 设备折旧（仪器分摊，name含"折旧"）
   - 能源动力（name含"电费"/"用水"/"气体费"）
   - 耗材辅料
2. amount必须为具体非零数值，如"250 mL"、"15 kg"
3. estimatedCost必须为具体非零数值(CNY)，如1250、450
4. 禁用"适量"等模糊词

输出JSON格式：按步骤顺序返回每步的BOM数组。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        stepBOMs: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    stepIndex: { type: Type.NUMBER, description: '步骤序号(从0开始)' },
                                    stepName: { type: Type.STRING },
                                    bomItems: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING, description: '物料名称' },
                                                amount: { type: Type.STRING, description: '用量(如250 mL)' },
                                                unit: { type: Type.STRING, description: '单位' },
                                                estimatedCost: { type: Type.NUMBER, description: '估算成本(CNY)' }
                                            },
                                            required: ['name', 'amount', 'unit', 'estimatedCost']
                                        }
                                    }
                                },
                                required: ['stepIndex', 'bomItems']
                            }
                        }
                    },
                    required: ['stepBOMs']
                }
            }
        });
        const rawText = response.text || '{}';
        console.log('[FlowchartAI] BOM 原始响应前200字符:', rawText.substring(0, 200));
        const rawJson = extractJson(rawText);
        let data = JSON.parse(rawJson);

        // 兼容性：如果 AI 用了其他键名
        if (!data.stepBOMs) {
            const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
            if (arrayKey) data.stepBOMs = data[arrayKey];
        }

        // 兼容性：如果 AI 返回的是平面数组（每个元素就是物料列表，而非 {stepIndex, bomItems} 对象）
        if (data.stepBOMs && data.stepBOMs.length > 0) {
            const firstItem = data.stepBOMs[0];
            // 检测是否是平面 BOM 项（有 name/amount 但无 bomItems）
            if (firstItem.name && !firstItem.bomItems) {
                // AI 返回了扁平的所有物料列表，按步骤数量均分
                const perStep = Math.ceil(data.stepBOMs.length / steps.length);
                const grouped: any[] = [];
                for (let i = 0; i < steps.length; i++) {
                    grouped.push({
                        stepIndex: i,
                        bomItems: data.stepBOMs.slice(i * perStep, (i + 1) * perStep)
                    });
                }
                data.stepBOMs = grouped;
            } else {
                // 确保每个条目有 stepIndex 并标准化 bomItems 键名
                data.stepBOMs = data.stepBOMs.map((bom: any, idx: number) => {
                    const bomItems = bom.bomItems || bom.materials || bom.items || bom.bom || [];
                    return {
                        ...bom,
                        stepIndex: bom.stepIndex ?? idx,
                        bomItems: bomItems.map((item: any) => ({
                            name: item.name || item.material || '未命名物料',
                            amount: item.amount || item.quantity || '未知',
                            unit: item.unit || '',
                            estimatedCost: Number(item.estimatedCost || item.cost || item.price || 0)
                        }))
                    };
                });
            }
        }

        console.log('[FlowchartAI] BOM 生成完成:', { stepCount: data.stepBOMs?.length, firstStepBomCount: data.stepBOMs?.[0]?.bomItems?.length });
        return data;
    });
};

/**
 * 生成圆环综述结构
 * 修复：增加强类型 Schema 确保 AI 返回的数据不会缺少 layers 或 segments 字段
 */
export const generateSummaryInfographic = async (context: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';
        const prompt = `你是一名顶级科学期刊（如 Nature, Science）的视觉策划专家。
            请为主题 "${context}" 策划一个高水准的综述圆环制图结构。

            要求：
            1. 包含核心层(Core) 和 2 - 3 层逻辑环绕层(Layers)。
            2. 每一层必须有明确的名称(name)。
            3. 每一层包含 3 - 6 个具体的科学子板块(Segments)。
            4. 【关键】为每个板块设定一个专业的标题(title)。
            5. 【关键】为每个板块撰写简明扼要的定义性描述(content) 并分配一个科学美感的十六进制颜色(color)。
            6. 【关键】为核心层和每个板块分别设计一个高质量的 3D 渲染提示词(coreImagePrompt, imagePrompt)。
            7. 语言：${langNote}。

            直接输出符合 Schema 的 JSON 对象，不要将其嵌套在任何其他键中。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                // @ts-ignore
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        coreIcon: { type: Type.STRING, description: 'FontAwesome 图标类名' },
                        coreImagePrompt: { type: Type.STRING, description: '用于生成核心 3D 插图的英文提示词' },
                        layers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    segments: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                title: { type: Type.STRING },
                                                content: { type: Type.STRING },
                                                color: { type: Type.STRING, description: '十六进制颜色码' },
                                                imagePrompt: { type: Type.STRING, description: '板块插图英文提示词' }
                                            },
                                            required: ["title", "content", "color", "imagePrompt"]
                                        }
                                    }
                                },
                                required: ["name", "segments"]
                            }
                        }
                    },
                    required: ["title", "layers"]
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data = JSON.parse(rawJson);

        // 兼容性修复：如果 AI 将数据嵌套在 visual_structure_plan 或类似的键中，进行拆箱
        if (data && !data.layers) {
            const nestedKey = Object.keys(data).find(k => k.toLowerCase().includes('plan') || k.toLowerCase().includes('structure'));
            if (nestedKey && data[nestedKey]?.layers) {
                console.log(`[Flowchart AI]Unwrapping nested key: ${nestedKey}`);
                data = data[nestedKey];
            }
        }

        // 字段翻译/补齐 与 ID 自动分配：统一处理，防止多次 Map 造成逻辑混乱或字段丢失
        data.layers = data.layers.map((l: any, lIdx: number) => {
            const mappedSegments = (l.segments || []).map((s: any, sIdx: number) => {
                const title = s.title || s.label || s.name || s.topic || '未命名区块';
                const content = s.content || s.description || s.desc || '';
                const imagePrompt = s.imagePrompt || s.renderingPrompt || s.visualPrompt || '';
                const color = s.color || s.hex || s.bgColor || '#e2e8f0';
                return {
                    ...s,
                    id: s.id || `seg_${Date.now()}_${lIdx}_${sIdx}`,
                    title,
                    content,
                    imagePrompt,
                    color
                };
            });

            return {
                ...l,
                id: l.id || `layer_${Date.now()}_${lIdx}`,
                name: l.name || l.title || l.layerName || '未命名层级',
                segments: mappedSegments
            };
        });

        if (!data.coreImagePrompt && data.core_visual_prompt) data.coreImagePrompt = data.core_visual_prompt;
        if (!data.title && data.name) data.title = data.name;

        return data;


    });
};

/**
 * 生成综述缩略图
 */
export const generateSummaryThumbnail = async (prompt: string) => {
    return callGeminiWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: NATIVE_IMAGE_GEN_MODEL,
            contents: { parts: [{ text: `3D scientific render of ${prompt}, Octane render, isolated on white background, hyper - detailed.` }] },
            config: {
                imageConfig: { aspectRatio: "1:1" }
            }
        });

        // 适配标准化响应结构
        const rawResponse = response.raw || response;
        for (const part of rawResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data: image / png; base64, ${part.inlineData.data} `;
            }
        }
        return null;
    });
};

/**
 * 智能抠图：移除背景
 */
export const removeImageBackground = async (imageBase64: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `Remove the background from this scientific image, keeping only the main object.Return the image with transparent / white background.`;
        const response = await ai.models.generateContent({
            model: NATIVE_IMAGE_GEN_MODEL,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: imageBase64.split(',')[1] } },
                    { text: prompt }
                ]
            }
        });

        // 适配标准化响应结构
        const rawResponse = response.raw || response;
        for (const part of rawResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data: image / png; base64, ${part.inlineData.data} `;
            }
        }
        return null;
    });
};

/**
 * NEW: Generate Structural Diagram Data
 */
export const generateStructuralDiagram = async (prompt: string, template: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';
        const instruction = `你是一名资深的科研逻辑架构师。请根据以下描述生成一个结构化的【科研逻辑图谱】或【组学流程图】。

        描述: "${prompt}"
        模板类型: ${template}

        要求：
        1. 逻辑严密，符合科学研究范式。
        2. 将图谱拆分为多个【分组(groups)】，每个分组包含若干【节点(nodes)】。分组从左到右排列，组内节点从上到下排列。
        3. 节点类型(type) 包含: 'input', 'process', 'decision', 'output'。
        4. 每个节点包含: id(唯一且稳定的 ID), text, subText, type, icon(FontAwesome 类名), params(字符串数组)。
        5. 每个分组包含: id, title, nodes(节点数组)。
        6. 语言: ${langNote}。

        【关键：连接关系(connections) 规则】
        1. 【主链流程方向】：整体信息流从左到右跨越分组，组内从上到下。严禁生成反向连线（即从右侧分组连回左侧分组）。
        2. 【组内纵向串联】：同一分组内的相邻节点按顺序串联（第1个->第2个->第3个），形成简洁纵向链条。同组内不要跳跃连接。
        3. 【跨组横向桥接】：跨分组连线仅在关键衔接节点间建立。通常是前一个分组的最后一个节点 -> 后一个分组的第一个节点。
        4. 【精简原则】：避免冗余连线。每个节点出边和入边各不超过 2 条。总连线数量控制在节点总数的 1.0-1.5 倍之间。
        5. 【ID 引用严格】：from 和 to 必须是 nodes 中定义的有效 ID。
        6. 【标签简洁】：连线 label 不超过 6 字，精确描述逻辑含义。无明确含义时可为空字符串。
        
        输出 JSON 格式。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    nodes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                text: { type: Type.STRING },
                                                subText: { type: Type.STRING },
                                                type: { type: Type.STRING },
                                                icon: { type: Type.STRING },
                                                params: { type: Type.ARRAY, items: { type: Type.STRING } }
                                            },
                                            required: ["id", "text", "type"]
                                        }
                                    }
                                },
                                required: ["id", "title", "nodes"]
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    from: { type: Type.STRING },
                                    to: { type: Type.STRING },
                                    label: { type: Type.STRING }
                                },
                                required: ["from", "to"]
                            }
                        }
                    },
                    required: ["groups", "connections"]
                }
            }
        });

        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * NEW: Iterate/Modify Existing Structural Diagram
 */
export const iterateStructuralDiagram = async (currentData: any, prompt: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Keep updated content in Academic English' : '保持更新内容为严谨学术中文';
        const instruction = `你是一名资深的科研逻辑架构师。请根据以下修改指令，迭代优化现有的【科研逻辑图谱】。
        
        【当前数据结构】：
        ${JSON.stringify(currentData)}
        
        【修改指令】：
"${prompt}"

要求：
1. 保持整体逻辑连贯。
2. 【极其重要】尽量保留原有节点的 ID，除非该节点被明确指令要求删除或大幅度修改。
3. 如果指令要求增加节点 / 分组，请生成具有唯一 ID 的新项。
4. 严格遵守原有数据结构：groups, nodes, connections。
5. 语言: ${langNote}。

【关键：连接关系 (connections) 优化规则】
1. 如果指令要求调整逻辑，请更新 connections。确保 from 和 to 指向有效节点 ID。
2. 【主链流程方向】：整体信息流从左到右跨越分组，组内从上到下。严禁生成反向连线。
3. 【组内纵向串联】：同一分组内相邻节点按顺序串联，形成简洁纵向链条。
4. 【跨组横向桥接】：跨分组连线仅在关键衔接节点间建立（前一组末尾 -> 后一组开头）。
5. 【精简原则】：每个节点出/入边各不超过 2 条。总连线数控制在节点数的 1.0-1.5 倍。避免冗余和重复连线。
6. 【标签简洁】：连线 label 不超过 6 字，精确描述逻辑含义。
        
        输出更新后的完整 JSON。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    nodes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                text: { type: Type.STRING },
                                                subText: { type: Type.STRING },
                                                type: { type: Type.STRING },
                                                icon: { type: Type.STRING },
                                                params: { type: Type.ARRAY, items: { type: Type.STRING } }
                                            },
                                            required: ["id", "text", "type"]
                                        }
                                    }
                                },
                                required: ["id", "title", "nodes"]
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    from: { type: Type.STRING },
                                    to: { type: Type.STRING },
                                    label: { type: Type.STRING }
                                },
                                required: ["from", "to"]
                            }
                        }
                    },
                    required: ["groups", "connections"]
                }
            }
        });

        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 工艺步骤智能拆分
 */
export const splitFlowchartStep = async (parentStep: any, scaleFactor: number, detailLevel: 'concise' | 'detailed' = 'concise') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为顶级化工跨国公司工作的【首席工艺建模工程师】。
你的任务是将一个复杂的工艺步骤拆分为更精细、可操作的详细子步骤。

【待拆分原始步骤】
- 标题: ${parentStep.text}
- 描述: ${parentStep.description}
- 当前规模系数: ${scaleFactor}

【拆分要求】
1. 逻辑细化：根据当前步骤的描述，将其拆解为 3-5 个逻辑严密的子步骤。
2. 数据继承：确保子步骤中的物料用量（BOM）与原始步骤保持一致，数值必须精确。
3. 工业标准：每个子步骤必须包含具体的设备操作参数、安全警告及放大效应见解。
4. 语言风格：专业学术中文，严禁使用模糊词汇。

【输出格式】
JSON 对象，包含 steps 数组。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        steps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    text: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                                    safetyAlert: { type: Type.STRING },
                                    scalingInsight: { type: Type.STRING },
                                    bomItems: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                amount: { type: Type.STRING },
                                                unit: { type: Type.STRING },
                                                estimatedCost: { type: Type.NUMBER }
                                            },
                                            required: ["name", "amount", "unit", "estimatedCost"]
                                        }
                                    }
                                },
                                required: ["text", "description", "riskLevel", "bomItems"]
                            }
                        }
                    },
                    required: ["steps"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 专业化/精细化工艺参数（模仿截图风格）
 */
export const professionalizeProcessParameters = async (params: { key: string; value: string; reason: string }[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为顶级科学期刊提供图表补充材料的资深专家。
请将以下提取的初步工艺参数矩阵进行“专业化升级”。

初步参数:
        ${JSON.stringify(params)}

要求：
1. 【双语标题】：将 key 改为 "中文名称 (English Name)" 格式，例如 "热解温度 (Pyrolysis Temperature)"。
2. 【精确表达】：优化 value 的表达，确保其具有科学严谨性（如加入符号 ±, ~, >, <, % 等）。
3. 【机制解读】：大幅深化 reason 字段。
- 必须包含具体的物理化学机制（传质、热力学、动力学、结晶生长、氧化还原等）。
- 必须说明该参数对产物性能的具体影响。
- 必须说明偏离此值的工程后果。
- 语气：客观、严谨、深厚。字数在 40 - 70 字之间。
        
        输出 JSON 格式数组。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            key: { type: Type.STRING },
                            value: { type: Type.STRING },
                            reason: { type: Type.STRING }
                        },
                        required: ["key", "value", "reason"]
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '[]'));
    });
};

/**
 * 生成分类树/层级图数据（Classification Tree）
 */
export const generateClassificationTreeAI = async (prompt: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';
        const instruction = `你是一名顶级科学综述编辑和知识架构师。
        请根据以下主题或描述，生成一个【分类树/层级图】的结构化数据，用于综述论文中的研究方向分类、材料分类或策略分类。

        主题描述: "${prompt}"

        要求：
        1. 生成一个完整的层级结构，从根节点开始，通常 2-4 层深度。
        2. 每个节点包含:
           - id: 唯一标识符
           - label: 节点名称（简洁、专业，不超过15字）
           - description: 节点描述（简明扼要，可选）
           - icon: 合适的 FontAwesome 图标类名（如 fa-solid fa-atom）
           - children: 子节点数组
        3. 根节点是核心主题，第一层为主要分类维度（3-6个），子层为具体细分。
        4. 确保分类逻辑清晰、互斥且完整（MECE原则）。
        5. 语言: ${langNote}。
        6. 请直接输出 rootNode 对象。

        输出 JSON 格式。`;

        const nodeSchema: any = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                icon: { type: Type.STRING },
                children: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            label: { type: Type.STRING },
                            description: { type: Type.STRING },
                            icon: { type: Type.STRING },
                            children: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.STRING },
                                        label: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        icon: { type: Type.STRING },
                                    },
                                    required: ["id", "label"]
                                }
                            }
                        },
                        required: ["id", "label"]
                    }
                }
            },
            required: ["id", "label", "children"]
        };

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        rootNode: nodeSchema
                    },
                    required: ["title", "rootNode"]
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data = JSON.parse(rawJson);

        // Post-process: assign IDs where missing
        const assignIds = (node: any, prefix: string, depth: number) => {
            if (!node.id) node.id = `${prefix}_${Date.now()}_${depth}`;
            node.depth = depth;
            if (node.children) {
                node.children = node.children.map((child: any, idx: number) =>
                    assignIds(child, `${prefix}_${idx}`, depth + 1)
                );
            }
            return node;
        };

        if (data.rootNode) {
            data.rootNode = assignIds(data.rootNode, 'node', 0);
        }

        return data;
    });
};

/**
 * 为绘图中心生成专业的学术标题
 */
export const generateFigureTitleAI = async (contentDescription: string, type: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为顶级科学期刊（如 Nature, Science）设计插图和逻辑架构的【视觉传达专家】。
        
        请为以下内容生成一个【专业的学术标题】。
        
        内容描述/数据摘要: "${contentDescription}"
        图表类型: ${type}
        
        要求：
        1. 必须精准、高级、体现学术分量。
        2. 长度控制在 15 个字以内。
        3. 仅输出标题文本，不要有引号、前缀或任何解释。
        4. 语言：严谨中文（除非数据核心是全英文的）。
        `;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: SPEED_CONFIG
        });
        return response.text?.trim() || "未命名科研图表";
    });
};

/**
 * 生成桑基图（Sankey Diagram）数据
 * 适用场景：能量流动、物质转化路径、转化率漏斗、学科来源分布等
 */
export const generateSankeyDataAI = async (
    prompt: string,
    language: 'zh' | 'en' = 'zh',
    complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
): Promise<{ title: string; nodes: any[]; links: any[] } | null> => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';

        // 根据复杂度级别调整生成参数
        const complexityConfig = {
            simple: {
                nodeRange: '4-8',
                layerRange: '2-3',
                detail: '简洁模式：突出核心脉络，仅保留主要流转路径，适合快速展示概要关系。',
                linkNote: '每个中间节点的出边/入边各不超过2条。',
            },
            moderate: {
                nodeRange: '8-14',
                layerRange: '3-4',
                detail: '标准模式：平衡展示主要路径与次要分支，包含损耗/副产物节点，适合学术论文插图。',
                linkNote: '可适当包含分叉与汇聚，每个中间节点出边/入边各不超过3条。',
            },
            complex: {
                nodeRange: '14-24',
                layerRange: '4-6',
                detail: '深度模式：最大程度展示多层级流转细节，包括所有子过程、副反应、回收循环和损耗路径，适合综述级的全景数据流分析。',
                linkNote: '应详尽展示所有合理的流转路径关系，包含交叉汇聚与多级分叉，但仍需保持拓扑有向无环。',
            },
        }[complexity];

        const instruction = `你是一名顶级科学数据可视化专家，擅长构建桑基图（Sankey Diagram）来展示【流量流动、物质转化、能量传递、转化率漏斗】等关系。

主题描述: "${prompt}"

【复杂度设定】${complexityConfig.detail}

【任务要求】
1. 生成一个结构完整、逻辑严密的桑基图数据集。
2. 节点（nodes）规则：
   - 总节点数控制在 ${complexityConfig.nodeRange} 个之间。
   - 每个节点需要：唯一 id（英文+下划线，如 "raw_material"）、简洁的 label、可选的 description。
   - 节点按照流程阶段划分为 ${complexityConfig.layerRange} 列（layer），从左到右流动。
3. 连线（links）规则：
   - 每条连线指定 source（来源节点id）、target（目标节点id）、value（流量数值，必须是正整数或小数）。
   - 确保流量守恒（某节点的入流总量应约等于出流总量，源节点和汇节点除外）。
   - 数值需有物理/科学含义，不要随机填写。
   - ${complexityConfig.linkNote}
4. 图表整体逻辑：
   - 左侧为源头（来源/输入），右侧为终点（产出/损耗/输出）。
   - 中间可有若干中间转化层。
   - 如涉及效率/损耗，需体现损耗节点。
5. 语言：${langNote}。

【严禁事项】
- 禁止循环引用（节点 A → B → A）。
- source 和 target 必须是 nodes 数组中已定义的有效 id。
- value 不能为 0 或负数。

直接输出符合 Schema 的 JSON，不要嵌套在其他键中。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                                required: ['id', 'label']
                            }
                        },
                        links: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING },
                                    target: { type: Type.STRING },
                                    value: { type: Type.NUMBER },
                                },
                                required: ['source', 'target', 'value']
                            }
                        }
                    },
                    required: ['title', 'nodes', 'links']
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data: any;
        try {
            data = JSON.parse(rawJson);
        } catch {
            return null;
        }

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
            return null;
        }

        // 后置处理：补齐 id 字段，过滤无效连线
        const nodeIds = new Set(data.nodes.map((n: any) => n.id));
        data.links = data.links
            .filter((l: any) =>
                l.source && l.target &&
                nodeIds.has(l.source) && nodeIds.has(l.target) &&
                l.source !== l.target &&
                typeof l.value === 'number' && l.value > 0
            )
            .map((l: any, idx: number) => ({
                ...l,
                id: l.id || `link_${idx}_${Date.now()}`,
            }));

        data.nodes = data.nodes.map((n: any) => ({
            ...n,
            id: n.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        }));

        if (!data.title) data.title = '流量图';

        return data;
    });
};

/**
 * 生成框架思维图（MindMap / Layered Framework Diagram）数据
 * 适用场景：论文研究框架、教学设计流程、技术方案架构等
 */
export const generateMindMapAI = async (prompt: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Academic English' : '严谨学术中文';
        const instruction = `你是一名顶级科学期刊（如 Nature, Science）的信息可视化设计师和学术架构专家。
请根据以下描述，生成一个【分层结构框架思维图】的完整数据，要求具有极高的设计感和视觉品质。

描述: "${prompt}"

【图表整体结构】
这是一种"纵向分层带"结构——类似 Nature/Science 论文中的研究框架图。
图被水平分割成多个层（Layer），每层有独立的柔和背景色和精炼标题。
层内放置多个节点（带颜色的圆角矩形），层间通过连接线表达逻辑关系。
图的左右两侧可有纵向侧边标注文字。

【🎨 设计感要求 — 极其重要】
1. 【配色方案】每一层使用不同的色系主题，节点颜色与层主题协调：
   - 第1层：深蓝色系（节点 #1A5276、#2980B9、#3498DB，层背景 #EBF5FB）
   - 第2层：青绿色系（节点 #117A65、#1ABC9C、#16A085，层背景 #E8F8F5）
   - 第3层：琥珀/橙色系（节点 #B7950B、#F39C12、#E67E22，层背景 #FEF9E7）
   - 第4层：玫瑰/红色系（节点 #943126、#E74C3C、#CB4335，层背景 #FDEDEC）
   - 第5层：紫罗兰色系（节点 #6C3483、#8E44AD、#9B59B6，层背景 #F4ECF7）
   同一层内的节点应使用同色系的不同深浅（主节点用深色，辅助节点用浅色），营造视觉层次。
2. 【节点差异化】所有节点使用统一宽度 160-180px，height 50-55px。
   可选择性使用不同 shape（rounded/pill）增加视觉变化。不要让节点过宽。
3. 【连接线设计】
   - 层间连接用 dashed + 灰色（#7F8C8D），表示逻辑推进
   - 层内连接用 solid + 与节点同色系，表示并列或协同
   - 重要连接加上精炼标签（2-4字），如"驱动""协同""反馈"
4. 【侧边标注】每 2-3 层共享一个侧边标注（position: left 或 right），用于概括阶段主题。
   标注文字精炼有力，如"材料设计""性能调控""工程应用"。颜色与对应层色系呼应。
5. 【节点文字】主文本不超过6字，用 subText 添加精炼补充（最多6字），如"核心动力学""界面优化"。

【生成规则】
1. 生成 3-5 个分层带（layers），从上到下排列。
2. 每个层包含 2-4 个节点。不要超过 4 个。
3. 节点 width 固定 160-180，height 固定 52。不要超过 180。
4. 层 height 固定 130。
5. 层间连接反映逻辑关系（上→下），层内不要有太多连接（最多1条）。
6. 层标题简洁专业，不超过 8 字，不要加冒号或副标题。
7. 语言: ${langNote}。
8. 【横幅节点】如果某个节点是层级核心主题，可设置 widthMode: "full"，它会横跨整个层宽。
   每层最多1个全宽节点，其他节点在其下方排列。
9. 【时间轴】如果内容有明确的阶段划分（如“基础→应用”或“前期→后期”），生成 timeline 数组。
   每个阶段有 label（如2字）、fromLayer、toLayer（层索引）0-based）、color。
   如果内容没有明确阶段，不要生成 timeline。
10. 【子节点网格】重要节点可以有 children 数组，每个 child 有 text（2-4字）和 color。
   子节点会以小标签网格显示在父节点内。每个节点最多3-5个 children。
   只在需要展示子分类时使用，不要每个节点都加。有 children 的节点 height 设为 75-85。
11. 【图注】生成 caption 字段，格式为“图 X 标题”，如“图 1 金属空气电池研究框架”。

【ID 规则】
- 层 ID: layer_序号（layer_0, layer_1, ...）
- 节点 ID: n_层序号_节点序号（n_0_0, n_0_1, ...）
- 连接 ID: conn_序号

直接输出符合 Schema 的 JSON 对象。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        layers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    backgroundColor: { type: Type.STRING },
                                    borderStyle: { type: Type.STRING },
                                    height: { type: Type.NUMBER },
                                    separatorStyle: { type: Type.STRING },
                                    sideAnnotations: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                text: { type: Type.STRING },
                                                position: { type: Type.STRING },
                                                color: { type: Type.STRING },
                                            },
                                            required: ['text', 'position']
                                        }
                                    },
                                    nodes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                text: { type: Type.STRING },
                                                subText: { type: Type.STRING },
                                                x: { type: Type.NUMBER },
                                                y: { type: Type.NUMBER },
                                                width: { type: Type.NUMBER },
                                                height: { type: Type.NUMBER },
                                                backgroundColor: { type: Type.STRING },
                                                textColor: { type: Type.STRING },
                                                fontSize: { type: Type.NUMBER },
                                                shape: { type: Type.STRING },
                                            },
                                            required: ['id', 'text', 'x', 'y', 'width', 'height']
                                        }
                                    },
                                },
                                required: ['id', 'title', 'nodes']
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    from: { type: Type.STRING },
                                    to: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    style: { type: Type.STRING },
                                    color: { type: Type.STRING },
                                    arrowType: { type: Type.STRING },
                                },
                                required: ['id', 'from', 'to']
                            }
                        },
                        timeline: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    fromLayer: { type: Type.NUMBER },
                                    toLayer: { type: Type.NUMBER },
                                    color: { type: Type.STRING },
                                },
                                required: ['label', 'fromLayer', 'toLayer']
                            }
                        },
                        caption: { type: Type.STRING }
                    },
                    required: ['title', 'layers', 'connections']
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data: any;
        try {
            data = JSON.parse(rawJson);
        } catch {
            return null;
        }

        if (!data || !Array.isArray(data.layers)) return null;

        // 精选学术配色方案 — fallback
        const PALETTE = [
            { layerBg: '#EBF5FB', nodes: ['#1A5276', '#2980B9', '#3498DB', '#5DADE2'], border: '#AED6F1' },
            { layerBg: '#E8F8F5', nodes: ['#117A65', '#1ABC9C', '#16A085', '#48C9B0'], border: '#A3E4D7' },
            { layerBg: '#FEF9E7', nodes: ['#B7950B', '#F39C12', '#E67E22', '#F5B041'], border: '#F9E79F' },
            { layerBg: '#FDEDEC', nodes: ['#943126', '#E74C3C', '#CB4335', '#EC7063'], border: '#F5B7B1' },
            { layerBg: '#F4ECF7', nodes: ['#6C3483', '#8E44AD', '#9B59B6', '#AF7AC5'], border: '#D2B4DE' },
        ];

        // 后处理
        const allNodeIds = new Set<string>();
        data.layers = data.layers.map((layer: any, lIdx: number) => {
            const pal = PALETTE[lIdx % PALETTE.length];
            layer.id = layer.id || `layer_${lIdx}`;
            layer.backgroundColor = layer.backgroundColor || pal.layerBg;
            layer.height = Math.min(layer.height || 130, 160);
            layer.borderStyle = layer.borderStyle || 'dashed';
            layer.separatorStyle = layer.separatorStyle || (lIdx < data.layers.length - 1 ? 'arrow' : 'none');
            layer.nodes = (layer.nodes || []).map((node: any, nIdx: number) => {
                const id = node.id || `n_${lIdx}_${nIdx}`;
                allNodeIds.add(id);
                return {
                    ...node,
                    id,
                    width: Math.min(node.width || 170, 180),
                    height: Math.min(node.height || 52, 58),
                    backgroundColor: node.backgroundColor || pal.nodes[nIdx % pal.nodes.length],
                    textColor: node.textColor || '#ffffff',
                    fontSize: node.fontSize || 14,
                    shape: node.shape || 'rounded',
                };
            });
            return layer;
        });

        // 过滤无效连接
        data.connections = (data.connections || [])
            .filter((c: any) => c.from && c.to && allNodeIds.has(c.from) && allNodeIds.has(c.to))
            .map((c: any, idx: number) => ({
                ...c,
                id: c.id || `conn_${idx}`,
                style: c.style || 'solid',
                color: c.color || '#7F8C8D',
                arrowType: c.arrowType || 'forward',
            }));

        if (!data.title) data.title = '框架思维图';

        data.globalConfig = {
            layerGap: 24,
            canvasWidth: 880,
            fontFamily: "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
            titleFontSize: 18,
            showSeparators: true,
            separatorColor: '#BDC3C7',
        };

        return data;
    });
};

/**
 * 迭代优化框架思维图（基于已有数据 + 修改指令）
 */
export const iterateMindMapAI = async (currentData: any, prompt: string, language: 'zh' | 'en' = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langNote = language === 'en' ? 'Keep updated content in Academic English' : '保持更新内容为严谨学术中文';
        const instruction = `你是一名顶级科学期刊的视觉策划专家。请根据以下修改指令，迭代优化现有的【分层结构框架思维图】。

【当前数据结构】：
${JSON.stringify(currentData, null, 0)}

【修改指令】：
"${prompt}"

要求：
1. 保持整体逻辑连贯，仅修改指令涉及的部分。
2. 【极其重要】尽量保留原有节点和层的 ID，除非被明确要求删除。
3. 如需新增节点/层，生成具有唯一 ID 的新项（层 id 用 layer_序号，节点 id 用 n_层序号_节点序号）。
4. 如有新增/删除节点，同步更新 connections（确保 from/to 指向有效节点 ID）。
5. 节点坐标 x 应在 60-860 范围内，y 在 20-120 范围内。
6. 语言: ${langNote}。

输出更新后的完整 JSON。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        layers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    backgroundColor: { type: Type.STRING },
                                    borderStyle: { type: Type.STRING },
                                    height: { type: Type.NUMBER },
                                    separatorStyle: { type: Type.STRING },
                                    sideAnnotations: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                text: { type: Type.STRING },
                                                position: { type: Type.STRING },
                                                color: { type: Type.STRING },
                                            },
                                            required: ['text', 'position']
                                        }
                                    },
                                    nodes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                text: { type: Type.STRING },
                                                subText: { type: Type.STRING },
                                                x: { type: Type.NUMBER },
                                                y: { type: Type.NUMBER },
                                                width: { type: Type.NUMBER },
                                                height: { type: Type.NUMBER },
                                                backgroundColor: { type: Type.STRING },
                                                textColor: { type: Type.STRING },
                                                fontSize: { type: Type.NUMBER },
                                                shape: { type: Type.STRING },
                                            },
                                            required: ['id', 'text', 'x', 'y', 'width', 'height']
                                        }
                                    },
                                },
                                required: ['id', 'title', 'nodes']
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    from: { type: Type.STRING },
                                    to: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    style: { type: Type.STRING },
                                    color: { type: Type.STRING },
                                    arrowType: { type: Type.STRING },
                                },
                                required: ['id', 'from', 'to']
                            }
                        }
                    },
                    required: ['title', 'layers', 'connections']
                }
            }
        });

        const rawJson = extractJson(response.text || '{}');
        let data: any;
        try {
            data = JSON.parse(rawJson);
        } catch {
            return null;
        }

        if (!data || !Array.isArray(data.layers)) return null;

        // 后处理
        const allNodeIds = new Set<string>();
        data.layers = data.layers.map((layer: any, lIdx: number) => {
            layer.id = layer.id || `layer_${lIdx}`;
            layer.backgroundColor = layer.backgroundColor || '#E8F0FE';
            layer.height = layer.height || 160;
            layer.borderStyle = layer.borderStyle || 'dashed';
            layer.separatorStyle = layer.separatorStyle || (lIdx < data.layers.length - 1 ? 'line' : 'none');
            layer.nodes = (layer.nodes || []).map((node: any, nIdx: number) => {
                const id = node.id || `n_${lIdx}_${nIdx}`;
                allNodeIds.add(id);
                return {
                    ...node, id,
                    width: node.width || 160, height: node.height || 50,
                    backgroundColor: node.backgroundColor || '#4A90D9',
                    textColor: node.textColor || '#ffffff',
                    fontSize: node.fontSize || 14,
                };
            });
            return layer;
        });

        data.connections = (data.connections || [])
            .filter((c: any) => c.from && c.to && allNodeIds.has(c.from) && allNodeIds.has(c.to))
            .map((c: any, idx: number) => ({
                ...c,
                id: c.id || `conn_${idx}`,
                style: c.style || 'solid',
                color: c.color || '#90A4AE',
                arrowType: c.arrowType || 'forward',
            }));

        if (!data.title) data.title = '框架思维图';

        data.globalConfig = currentData.globalConfig || {
            layerGap: 20, canvasWidth: 1000,
            fontFamily: "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
            titleFontSize: 18, showSeparators: true, separatorColor: '#90A4AE',
        };

        return data;
    });
};
