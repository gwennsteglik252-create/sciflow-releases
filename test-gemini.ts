import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
async function test() {
    const prompt = `你是一名顶级科研战略情报员。请检索关于 "AI agent" 在 1week 范围内的全球真实行业及科研趋势。`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    category: { type: Type.STRING, enum: ['Technology', 'Market', 'Policy', 'Competitor'] },
                                    content: { type: Type.STRING },
                                    source: { type: Type.STRING },
                                    url: { type: Type.STRING },
                                    timestamp: { type: Type.STRING },
                                    impactScore: { type: Type.NUMBER }
                                },
                                required: ["title", "category", "content", "source", "url", "timestamp", "impactScore"]
                            }
                        }
                    },
                    required: ["items"]
                }
            }
        });
        console.log("TEXT:", response.text);
    } catch (e) {
        console.error("ERROR:", e);
    }
}
test();
