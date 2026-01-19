import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Get column information for a specific table (column name, data type, nullable, etc.).",
  args: {
    tableName: tool.schema.string().describe("Table name to get column info for")
  },
  async execute({ tableName }) {
    const db = getDb();
    const stmt = db.query(`PRAGMA table_info(${tableName})`);
    return formatToolResult(stmt.all());
  }
});
