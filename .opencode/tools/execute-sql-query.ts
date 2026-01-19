import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Execute a safe read-only SQL query (SELECT only, with security restrictions). Automatically enforces LIMIT max 100 rows.",
  args: {
    sql: tool.schema.string().describe("SQL query statement, must start with SELECT"),
    params: tool.schema.array(tool.schema.string()).optional().describe("SQL parameters array for preventing SQL injection"),
    maxRows: tool.schema.number().optional().describe("Maximum rows to return (default 100, max 100)")
  },
  async execute({ sql, params = [], maxRows = 100 }) {
    const db = getDb();

    // 安全检查：只允许 SELECT 语句
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    // 禁止的关键字
    const forbiddenKeywords = [
      "DROP", "DELETE", "INSERT", "UPDATE", "CREATE", "ALTER",
      "TRUNCATE", "GRANT", "REVOKE", "ATTACH", "DETACH"
    ];
    for (const keyword of forbiddenKeywords) {
      if (trimmedSql.includes(keyword)) {
        throw new Error(`Forbidden keyword: ${keyword}`);
      }
    }

    // 强制添加 LIMIT 限制
    const effectiveMaxRows = Math.min(maxRows, 100);
    if (!/\bLIMIT\s+\d+/i.test(sql)) {
      sql = `${sql} LIMIT ${effectiveMaxRows}`;
    } else {
      // 如果已有 LIMIT，检查是否超过最大值
      const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
      if (limitMatch && parseInt(limitMatch[1]) > effectiveMaxRows) {
        sql = sql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${effectiveMaxRows}`);
      }
    }

    try {
      const stmt = db.query(sql);
      const result = stmt.all(...params);
      return formatToolResult(result);
    } catch (error) {
      throw new Error(`SQL query failed: ${error.message}`);
    }
  }
});
