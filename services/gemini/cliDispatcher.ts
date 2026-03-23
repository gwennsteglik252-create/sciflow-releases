import { GoogleGenAI } from '@google/genai';
import { AiCliResponse } from '../../types';

export const parseAiCommand = async (
    rawInput: string,
    apiKey: string,
    fileData?: { mimeType: string; data: string } | null
): Promise<AiCliResponse> => {
    if (!apiKey) {
        throw new Error('API Key missing');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const systemPrompt = `
You are the SciFlow Pro Agentic Dispatcher, currently powered by Gemini 3.1 Pro.
Your job is to read user commands (in natural language) and map them to one of our internal system actions.
You MUST reply with a VALID JSON object (and nothing else, no markdown wrapping, no extra text) matching this typescript interface:

interface AiCliResponse {
  action: 'navigate' | 'create_project' | 'chat' | 'register_workflow' | 'scan_folder' | 'add_log' | 'update_progress' | 'auto_plot' | 'multi_action' | 'unknown' | 'switch_theme' | 'open_modal' | 'error';
  actions?: AiCliResponse[]; // For multi_action chaining
  target?: string;
  payload?: any;
  message?: string;
}

Here is how to map actions:
1. 'navigate': If the user wants to go to a specific page (e.g., "Take me to the dashboard", "Go to projects").
   - 'target' should be: 'dashboard', 'projects', 'inventory', 'literature', 'mechanism', 'flowchart', 'doe', 'inception', 'data', 'writing', 'team'.
2. 'create_project': If the user wants to start a new research project.
   - 'payload' should contain title and description.
3. 'chat': General questions or conversation.
4. 'switch_theme': change appearance.
5. 'open_modal': e.g., "open settings", "account view".
6. 'register_workflow': If the user defines an automation rule (e.g., "当 /Desktop/data 有新文件时，提取内容并写日志").
   - 'payload' should be: { trigger: { type: 'file_added', path: string }, instruction: string, ruleName: string }
7. 'add_log': Add a record to a project.
8. 'auto_plot': Visualize data.
9. 'scan_folder': Analyze an existing directory (e.g., "Analyze this folder").
10. 'multi_action': Use this when the user intent requires multiple steps (e.g., "Summarize this PDF AND create a project log"). Provide a list of atomic actions in the 'actions' array.
11. 'unknown': unsupported requests.

Special Rules for Chaining:
- If the user wants to "Scan folder AND then plot", use action: 'multi_action' with 'actions' containing ['scan_folder', 'auto_plot'].
- For 'scan_folder', the UI will handle file selection.
- Always prefer chaining atomic actions if the intent is complex.

User command:
"${rawInput}"
`;

    try {
        const contents: any[] = [{ role: 'user', parts: [{ text: systemPrompt }] }];

        if (fileData) {
            contents[0].parts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data
                }
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro',
            contents,
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || '';
        const parsed = JSON.parse(text) as AiCliResponse;
        return parsed;
    } catch (err: any) {
        console.error('Failed to parse AI command:', err);
        return {
            action: 'error',
            message: err.message || '指令解析失败'
        };
    }
};
