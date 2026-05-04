const websocketUrl = new URL("wss://wss-primary.slack.com/");
websocketUrl.searchParams.set("token", process.env.SLACK_SELFBOT_XOXC || "");

new WebSocket(websocketUrl.toString(), {
  headers: {
    d: process.env.SLACK_SELFBOT_XOXD || "",
  },
});
