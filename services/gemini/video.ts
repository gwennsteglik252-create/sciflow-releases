
import { GoogleGenAI } from "@google/genai";
import { callGeminiWithRetry } from "./core";

export const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

export const generateScientificVideo = async (prompt: string, config: { resolution: '720p' | '1080p', aspectRatio: '16:9' | '9:16' }, image?: { data: string, mimeType: string }) => {
    return callGeminiWithRetry(async (ai) => {
        const payload: any = {
            model: VIDEO_MODEL,
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: config.resolution,
                aspectRatio: config.aspectRatio
            }
        };

        if (image) {
            payload.image = {
                imageBytes: image.data,
                mimeType: image.mimeType
            };
        }

        let operation = await ai.models.generateVideos(payload);

        while (!operation.done) {
            // Reassuring delay
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("Video generation failed: No download link returned.");

        try {
            // Fetch the video bytes using the API key
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!response.ok) throw new Error(`Video fetch failed with status: ${response.status}`);
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error("CORS or Network error fetching generated video:", e);
            throw new Error("视频已生成但由于浏览器安全限制无法下载，请检查网络环境或 CORS 配置。");
        }
    });
};
