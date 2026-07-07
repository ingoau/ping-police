export interface Event {
  type: string;
  [key: string]: any;
}

export interface TypingEvent {
  type: "user_typing";
  channel: string;
  id: number;
  user: string;
  thread_ts?: string;
}

export interface SlashCommandBody {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  api_app_id: string;
  is_enterprise_install: "true" | "false";
  enterprise_id?: string;
  enterprise_name?: string;
  response_url: string;
  trigger_id: string;
}

export interface SlashCommandEvent {
  ack: (response?: unknown) => Promise<void>;
  envelope_id: string;
  body: SlashCommandBody;
  accepts_response_payload: boolean;
}
