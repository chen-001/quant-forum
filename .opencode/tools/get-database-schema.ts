import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Get database schema information (table names and CREATE statements).",
  args: {},
  async execute() {
    const db = getDb();
    const stmt = db.query(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return formatToolResult(stmt.all());
  }
});
