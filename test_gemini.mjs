import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
const keywords = ["金属空气电池", "双功能催化剂", "ORR", "OER"];

async function run() {
  const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `将以下中文学术关键词翻译为对应的英文学术术语，用于学术数据库检索。
只返回翻译后的英文关键词，用空格分隔，不要加任何解释。
已经是英文的词（如 ORR, OER, XRD）保持原样。

输入：${keywords.join(', ')}`,
      config: { temperature: 0 }
  });
  console.log("Raw output:", JSON.stringify(response.text));
}
run().catch(console.error);
