import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { env } from "@/env";

const dbPath = env.SQLITE_PATH || "sqlite.db";

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);
