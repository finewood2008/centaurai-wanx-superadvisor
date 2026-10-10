import type {
  BrainstormProfile,
  BrainstormSession,
  BrainstormControl,
  MeetingReport,
} from "centaurai-wanx";
export type {
  BrainstormProfile,
  BrainstormSession,
  BrainstormSource,
  BrainstormControl,
  MeetingReport,
} from "centaurai-wanx";
export interface Message {
  id?: string;
  role: string;
  content: string | { type: string; text?: string }[];
  agent_id?: string;
}
export interface MarketExpert {
  id: string;
  slug: string;
  label: { zh: string; en: string };
  description: { zh: string; en: string };
  skill_count: number;
}
export interface Frame {
  thread_id: string;
  frame: {
    type: string;
    content?: string;
    agent_id?: string;
    speaker_agent_id?: string;
    message?: string;
    name?: string;
  };
}
export interface WanxService {
  endpoint: string;
  name: string;
  version: string;
  advertised: boolean;
  transport: string;
}
interface Calls {
  connectionInfo: () => Promise<{
    selected: WanxService | null;
    savedEndpoint: string | null;
  }>;
  discoverServices: () => Promise<{ services: WanxService[]; scope: string }>;
  connectService: (address: string) => Promise<WanxService>;
  login: (body: {
    username: string;
    password: string;
  }) => Promise<{ username: string }>;
  logout: () => Promise<void>;
  profile: () => Promise<BrainstormProfile>;
  configure: (body: {
    expert_ids?: string[];
    expert_models?: Record<string, string>;
  }) => Promise<BrainstormProfile>;
  market: (
    query?: string,
  ) => Promise<{ items: MarketExpert[]; scenes: string[] }>;
  importExpert: (slug: string) => Promise<{ id: string; name: string }>;
  list: () => Promise<BrainstormSession[]>;
  get: (id: string) => Promise<BrainstormSession>;
  report: (id: string) => Promise<MeetingReport>;
  exportReport: (id: string) => Promise<{ canceled: boolean; path?: string }>;
  create: (body: {
    topic: string;
    context_enabled: boolean;
    expert_ids: string[];
  }) => Promise<BrainstormSession>;
  control: (id: string, body: BrainstormControl) => Promise<BrainstormSession>;
  history: (
    team: string,
    id: string,
    cursor?: string,
  ) => Promise<{
    messages: Message[];
    has_more: boolean;
    next_cursor?: string;
  }>;
  watch: (team: string, id: string) => Promise<void>;
  send: (id: string, text: string) => Promise<void>;
}
declare global {
  interface Window {
    advisory?: {
      call: (method: string, ...args: unknown[]) => Promise<unknown>;
      onFrame: (callback: (frame: Frame) => void) => () => void;
    };
  }
}
export async function call<K extends keyof Calls>(
  method: K,
  ...args: Parameters<Calls[K]>
): Promise<Awaited<ReturnType<Calls[K]>>> {
  if (!window.advisory)
    throw new Error("请在超级参谋团桌面应用中使用 WANX 登录。");
  return (await window.advisory.call(method, ...args)) as Awaited<
    ReturnType<Calls[K]>
  >;
}
