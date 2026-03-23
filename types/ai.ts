export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  agentId?: string; // ID of the specific AI agent in a debate
  images?: string[]; // Preview URLs for attached images
}

export interface AiTask {
  id: string;
  type: 'transformation' | 'diagnose' | 'writing_assist' | 'weekly_report' | 'image_gen' | 'trend_analysis' | 'video_gen';
  status: 'running' | 'completed' | 'error';
  title: string;
}

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  prompt: string;
  timestamp: string;
  status: 'ready' | 'processing' | 'error';
  metadata: {
    resolution: string;
    aspectRatio: string;
  }
}

export interface DebatePersona {
  id: string;
  name: string;
  title: string;
  avatar: string;
  color: string;
  icon: string;
  description: string;
  focus: string;
}

export interface DebateSession {
  id: string;
  topic: string;
  proposition: string;
  messages: ChatMessage[];
  isComplete: boolean;
  consensus?: string;
}

export interface AiCliCommand {
  text: string;
  timestamp: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  response?: string;
  pendingAction?: any;
  healingActions?: { label: string; action: any }[];
  selectionList?: { label: string; value: any; selected?: boolean }[];
  selectionType?: 'single' | 'multiple';
}

export interface AiCliResponse {
  action: 'navigate' | 'create_project' | 'chat' | 'register_workflow' | 'add_log' | 'update_progress' | 'auto_plot' | 'scan_folder' | 'multi_action' | 'unknown' | 'switch_theme' | 'open_modal' | 'error';
  actions?: AiCliResponse[];
  target?: string;
  payload?: {
    trigger?: { type: string; path: string; extension?: string };
    instruction?: string;
    ruleName?: string;
    [key: string]: any;
  };
  message?: string;
}