import type { Api } from "../types/api";

const SLACK_SELFBOT_XOXC = process.env.SLACK_SELFBOT_XOXC!;
const SLACK_SELFBOT_XOXD = process.env.SLACK_SELFBOT_XOXD!;

export async function api(method: keyof Api, data: Record<string, any>) {
  const formData = new FormData();
  formData.append("token", SLACK_SELFBOT_XOXC);
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  const request = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    body: formData,
    headers: {
      Cookie: `d=${SLACK_SELFBOT_XOXD}`,
    },
  });

  return (await request.json()) as Api[typeof method];
}
