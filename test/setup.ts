// Preloaded before every test file (see bunfig.toml). Provides dummy Slack
// credentials and an in-memory database with all migrations applied.
process.env.SLACK_TOKEN ??= "xoxb-test";
process.env.SLACK_APP_TOKEN ??= "xapp-test";
process.env.SLACK_SELFBOT_XOXC ??= "xoxc-test";
process.env.SLACK_SELFBOT_XOXD ??= "xoxd-test";
process.env.PING_POLICE_USER_ID ??= "UPOLICE";
process.env.SELF_BOT_USER_ID ??= "USELFBOT";
process.env.REPORT_USER_ID ??= "UREPORT";
process.env.SQLITE_PATH = ":memory:";

const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
const { db } = await import("@/db/client");

migrate(db, { migrationsFolder: `${import.meta.dir}/../drizzle` });
