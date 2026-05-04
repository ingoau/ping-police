export interface TypingEvent {
  type: "user_typing";
  channel: string;
  id: number;
  user: string;
  thread_ts?: string;
}
