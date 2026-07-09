import type { HeadersInit } from "bun";
import type { Api } from "./types/api";

type SlackApiAuth =
  | {
      kind: "bot";
      token: string;
    }
  | {
      kind: "selfbot";
      token: string;
      cookieD: string;
    };

function createSlackApi(auth: SlackApiAuth) {
  return async function api<M extends keyof Api>(
    method: M,
    data: Record<string, string>,
  ) {
    const formData = new FormData();

    formData.append("token", auth.token);

    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }

    const headers: HeadersInit = {};

    if (auth.kind === "selfbot") {
      headers.Cookie = `d=${auth.cookieD}`;
    }

    const request = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      body: formData,
      headers,
    });

    return (await request.json()) as Api[M];
  };
}

export const bot = createSlackApi({
  kind: "bot",
  token: process.env.SLACK_TOKEN!,
});

export const selfbot = createSlackApi({
  kind: "selfbot",
  token: process.env.SLACK_SELFBOT_XOXC!,
  cookieD: process.env.SLACK_SELFBOT_XOXD!,
});
