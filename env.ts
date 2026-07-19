function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[env] missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const env = {
  SLACK_TOKEN: required("SLACK_TOKEN"),
  SLACK_APP_TOKEN: required("SLACK_APP_TOKEN"),
  SLACK_SELFBOT_XOXC: required("SLACK_SELFBOT_XOXC"),
  SLACK_SELFBOT_XOXD: required("SLACK_SELFBOT_XOXD"),
  PING_POLICE_USER_ID: required("PING_POLICE_USER_ID"),
  SELF_BOT_USER_ID: required("SELF_BOT_USER_ID"),
  SQLITE_PATH: process.env.SQLITE_PATH || "sqlite.db", // optional, has a default
};
