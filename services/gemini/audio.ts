
import { GoogleGenAI, Modality } from "@google/genai";
import { ResearchProject, Literature } from "../../types";
import { callGeminiWithRetry, FAST_MODEL, SPEED_CONFIG } from "./core";

/**
 * 1. Generate a podcast script based on project data.
 */
export const generatePodcastScript = async (project: ResearchProject) => {
  return callGeminiWithRetry(async (ai) => {
    const context = `
      Project Title: ${project.title}
      Description: ${project.description}
      Current TRL: ${project.trl}
      Milestones: ${project.milestones.map(m => `- ${m.title} (${m.status}): ${m.hypothesis}`).join('\n')}
      Key Experiments: ${project.milestones.flatMap(m => m.logs).slice(0, 10).map(l => `- ${l.content}: ${l.result}`).join('\n')}
    `;

    // Use simple names "Sascha" and "Jensen" to map perfectly to TTS config
    const prompt = `你是一档名为 "SciFlow 深度科研 (Deep Dive)" 的科学播客制作人。
    请生成一段生动、引人入胜的双人对话脚本，讨论下述研究项目。

    角色设置：
    1. "Sascha" (主持人)：充满好奇心，负责提问和引导话题，代表听众视角，声音富有活力。
    2. "Jensen" (资深专家)：知识渊博，负责深入浅出地解释科学原理和项目意义，声音沉稳。

    要求：
    - **语言：必须使用中文 (Mandarin Chinese)**。请使用自然、流畅的口语化中文，避免翻译腔。
    - 风格：像真实的广播节目一样轻松、热情，避免枯燥的朗读。可以适当使用“哇”、“原来如此”等感叹词。
    - 长度：每人约 4-6 次交互（总计约 300 字）。
    - 格式：严格使用 "Sascha:" 和 "Jensen:" 作为每行对话的前缀。不要包含任何场景指导、括号动作或旁白，只保留对话文本。

    项目背景信息：
    ${context}`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "text/plain"
      }
    });

    return response.text || "";
  });
};

/**
 * Generate a podcast script for a single Literature item (NotebookML style)
 */
export const generateLiteraturePodcastScript = async (lit: Literature) => {
  return callGeminiWithRetry(async (ai) => {
    const context = `
      Title: ${lit.title}
      Authors: ${lit.authors?.join(', ')}
      Source: ${lit.source} (${lit.year})
      Abstract: ${lit.abstract}
      Key Technical Points: ${JSON.stringify(lit.performance || [])}
      Core Process: ${JSON.stringify(lit.synthesisSteps || [])}
    `;

    const prompt = `你是一档名为 "SciFlow Paper Review" 的学术播客制作人。
    请针对这篇具体的文献/专利，生成一段双人对话脚本。

    角色设置：
    1. "Sascha" (主持人)：充满好奇心，引导话题，声音富有活力。
    2. "Jensen" (资深专家)：负责解读这篇文献的创新点、核心数据和潜在影响。

    要求：
    - **语言：必须使用中文**。
    - 重点：不要照读摘要。要像两个朋友在讨论这篇论文一样，指出"这篇论文最酷的地方在哪里"、"它解决了什么问题"。
    - 长度：每人约 4-6 次交互（总计约 300-400 字）。
    - 格式：严格使用 "Sascha:" 和 "Jensen:" 前缀。

    文献信息：
    ${context}`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "text/plain"
      }
    });

    return response.text || "";
  });
};

/**
 * 2. Convert the script to Audio using Multi-Speaker TTS.
 */
export const generateAudioOverview = async (script: string) => {
  // Use retry logic for stability against transient 500 errors (common with large TTS requests)
  return callGeminiWithRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro",
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Sascha',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' } // Female-sounding, energetic
                }
              },
              {
                speaker: 'Jensen',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Fenrir' } // Male-sounding, deep
                }
              }
            ]
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS generation failed: No audio data returned from API.");
    return base64Audio;
  });
};
