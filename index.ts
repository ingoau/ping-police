import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_TOKEN;

const web = new WebClient(token);

web.chat.postEphemeral({
  channel: "C0ABSJ8LN87",
  text: "e",
  user: "U0923H02Y3B",
  thread_ts: "1777884134.130509",
});
// https://hackclub.slack.com/archives/C0A0QNJNDGQ/p1777879123944789
// https://hackclub.slack.com/archives/C0A0QNJNDGQ/p1777879127.148199
// https://hackclub.enterprise.slack.com/archives/C0ABSJ8LN87

// https://hackclub.slack.com/archives/C0ABSJ8LN87/p1777884134.130509
