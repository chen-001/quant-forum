import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Search post titles and text content by keyword.",
  args: {
    keyword: tool.schema.string().describe("Search keyword"),
    limit: tool.schema.number().optional().describe("Max results, default 10"),
    contextScope: tool.schema.string().optional().describe("Context scope (all|current), unused")
  },
  async execute({ keyword, limit }) {
    const db = getDb();
    const stmt = db.query(`
      SELECT p.id, p.title, p.post_type, p.author_id, u.username as author_name,
             pt.content as text_content, p.created_at
      FROM posts p
      LEFT JOIN posts_text pt ON p.id = pt.post_id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE (p.title LIKE ? OR pt.content LIKE ?)
      ORDER BY p.created_at DESC
      LIMIT ?
    `);
    const pattern = `%${keyword}%`;
    return formatToolResult(stmt.all(pattern, pattern, limit ?? 10));
  }
});
