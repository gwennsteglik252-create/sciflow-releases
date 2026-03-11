import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG, IMAGE_MODEL } from "./core";

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
 * 工艺数字化建模
 */
export const generateFlowchartData = async (description: string, scaleFactor: number, targetTrl: number, detailLevel: 'concise' | 'detailed' = 'concise') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为顶级化工跨国公司（如 BASF, Dow）和数字化实验室工作的【首席工艺建模工程师】与【数字孪生架构师】。
你的任务是将科研文献或初步实验描述，转化为具备“工业级精度”的可放大工艺数字化模型。

【当前任务上下文】
1. 原始工艺描述: "${description}"
2. 规模系数 (Scale Factor): ${scaleFactor} (1 = 实验室级, 100 = 中试级, 1000 = 工业级)
3. 目标技术成熟度 (Target TRL): ${targetTrl}
4. 架构精细度: ${detailLevel === 'concise' ? '【中层骨干视角】(5-7个核心步骤)' : '【底层操作视角】(8-12个微操步骤)'}

【严苛要求 - 违反者将被视为无效输出】
1. 【数值绝对化】：禁止使用“适量”、“约”、“少量”、“建议”等模糊词。所有数值必须是具体的数字、范围或精确比例。
2. 【BOM 逻辑计算】：物料清单(bomItems)中的 amount 必须根据 scaleFactor 进行严格的物料衡算。
   - 若实验室用量为 1g，scaleFactor=1000，则 amount 应输出为 "1 kg"。
   - 必须标注清晰的科学单位（kg, L, mol, Nm³, wt% 等）。
3. 【参数双语标签】：提取出的关键参数(optimizedParameters & controlParameters)的 key 必须统一采用 "中文名称 (English Name)" 格式。
4. 【深度机制解读】：reason 字段必须具备深度（>50字）。
   - optimizedParameters 的 reason 必须涵盖：物理化学原理、通过何种表征手段验证、最优区间对宏观性能的非线性响应逻辑。
   - controlParameters 的 reason 必须涵盖：工程风险控制、传质/传热限制分析、若偏离给定值将导致的副反应或安全事故（OOS/OOT 分析）。
5. 【DOE 锚点】：在每个步骤中识别 doeAnchor，描述该步骤中最具科研优化价值的实验变量。

【输出样例参考】
- optimizedParameters: [{"key": "比表面积 (Specific Surface Area)", "value": "> 1200 m²/g", "reason": "该指标受活化过程中 KOH/C 比例及活化温度协同控制；若活化不充分将导致微孔发育受限，直接降低超级电容器的质量比容量。"}]
- controlParameters: [{"key": "高压釜升温速率 (Autoclave Heating Rate)", "value": "2.0 - 5.0 °C/min", "reason": "这是控制成核速度与晶粒生长速度平衡的关键参数；过快会引发突发性爆发成核导致粒径分布过宽，过慢则会造成单晶结构发育不全。"}]

语言风格: 极其专业、严谨、深厚的学术/工业中文。
输出 JSON 格式。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: '具备工业界规范的工艺方案全称' },
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
                                    doeAnchor: { type: Type.STRING },
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
                        },
                        optimizedParameters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                }
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
                                }
                            }
                        }
                    },
                    required: ["steps", "optimizedParameters", "controlParameters"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
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
            model: 'gemini-3.1-pro',
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
            model: 'gemini-3.1-pro',
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
