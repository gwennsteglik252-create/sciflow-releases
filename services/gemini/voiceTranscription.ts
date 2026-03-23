/**
 * voiceTranscription.ts — 语音转写与结构化服务
 *
 * 1. 使用 Gemini multimodal 将音频转写为文本
 * 2. 再用 Gemini 将自由文本结构化为 ExperimentLog 格式
 */
import { callGeminiWithRetry, FAST_MODEL, SPEED_CONFIG } from './core';

export interface StructuredExperimentFromVoice {
  content: string;           // 实验内容（简短标题）
  description: string;       // 详细描述
  parameters: string;        // 参数概述
  parameterList: { key: string; value: string; unit: string }[];
  result: 'success' | 'neutral' | 'failure' | 'observation';
  observations: string;      // 实验现象描述
}

/**
 * 将语音 base64 音频送入 Gemini multimodal 进行转写
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  return callGeminiWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              }
            },
            {
              text: `请将这段实验室口述录音转写为文本。注意：
1. 这是科学实验者在湿实验操作时的口述记录
2. 可能包含化学试剂名称、仪器操作参数、浓度、温度等专业术语
3. 请准确保留所有数值和单位
4. 修正明显的口误但保留原意
5. 输出纯文本，不需要任何格式标记`
            }
          ]
        }
      ],
      config: {
        ...SPEED_CONFIG,
        responseMimeType: 'text/plain'
      }
    });

    return response.text || '';
  });
};

/**
 * 将转写文本结构化为 ExperimentLog 格式
 */
export const structureTranscription = async (transcription: string): Promise<StructuredExperimentFromVoice> => {
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一位严谨的科研助手。下面是一段实验者在实验台旁的口述转写文本，请将其结构化为实验日志。

口述内容:
"""
${transcription}
"""

请以严格的 JSON 格式返回，结构如下：
{
  "content": "实验名称/标题（简短，如：NiFe-LDH 电沉积实验）",
  "description": "详细的实验过程描述",
  "parameters": "关键参数概述（一行文本）",
  "parameterList": [
    {"key": "参数名", "value": "数值", "unit": "单位"}
  ],
  "result": "success 或 neutral 或 failure 或 observation（根据口述内容判断）",
  "observations": "实验现象观察记录"
}

注意：
- parameterList 中提取所有提到的数值参数（温度、时间、浓度、电压、转速等）
- 如果口述只是描述现象而无明确成败，result 设为 "observation"
- 保持科学术语准确`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    try {
      const parsed = JSON.parse(text);
      return {
        content: parsed.content || '未命名实验',
        description: parsed.description || transcription,
        parameters: parsed.parameters || '',
        parameterList: Array.isArray(parsed.parameterList) ? parsed.parameterList : [],
        result: ['success', 'neutral', 'failure', 'observation'].includes(parsed.result) ? parsed.result : 'observation',
        observations: parsed.observations || '',
      };
    } catch {
      // JSON 解析失败时返回安全的默认值
      return {
        content: '语音实验记录',
        description: transcription,
        parameters: '',
        parameterList: [],
        result: 'observation' as const,
        observations: transcription,
      };
    }
  });
};

/**
 * 一键：录音 → 转写 → 结构化
 */
export const processVoiceToExperimentLog = async (
  audioBase64: string,
  mimeType: string
): Promise<{ transcription: string; structured: StructuredExperimentFromVoice }> => {
  const transcription = await transcribeAudio(audioBase64, mimeType);
  const structured = await structureTranscription(transcription);
  return { transcription, structured };
};
