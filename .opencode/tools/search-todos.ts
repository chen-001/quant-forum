import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Search todos by keyword, optionally scoped to a user, content type, or completion status.",
  args: {
    keyword: tool.schema.string().describe("Search keyword"),
    userId: tool.schema.number().optional().describe("Limit to a user ID"),
    contentType: tool.schema.string().optional().describe("Content type: post|comment|result|idea|text_selection|image"),
    isCompleted: tool.schema.boolean().optional().describe("Completion status"),
    limit: tool.schema.number().optional().describe("Max results, default 10"),
    scope: tool.schema.string().optional().describe("Scope: mine|all")
  },
  async execute({ keyword, userId, contentType, isCompleted, limit, scope }) {
    const db = getDb();
    let query = `
      SELECT t.id, t.user_id, t.content_type, t.content_id, t.post_id,
             t.text_data, t.image_url, t.note, t.is_completed, t.visibility,
             t.created_at, t.updated_at,
             u.username as user_name,
             p.title as post_title
      FROM todos t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN posts p ON t.post_id = p.id
      WHERE (t.text_data LIKE ? OR t.note LIKE ? OR p.title LIKE ?)
    `;
    const params: Array<string | number | boolean> = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];

    if ((scope ?? "all") === "mine" && userId !== undefined && userId !== null) {
      query += " AND t.user_id = ?";
      params.push(userId);
    }

    if (contentType) {
      query += " AND t.content_type = ?";
      params.push(contentType);
    }

    if (isCompleted !== undefined && isCompleted !== null) {
      query += " AND t.is_completed = ?";
      params.push(isCompleted ? 1 : 0);
    }

    query += " ORDER BY t.created_at DESC LIMIT ?";
    params.push(limit ?? 10);

    const stmt = db.query(query);
    return formatToolResult(stmt.all(...params));
  }
});
