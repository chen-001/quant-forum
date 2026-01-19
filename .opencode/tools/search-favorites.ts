import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Search favorites by keyword, optionally scoped to a user or content type.",
  args: {
    keyword: tool.schema.string().describe("Search keyword"),
    userId: tool.schema.number().optional().describe("Limit to a user ID"),
    contentType: tool.schema.string().optional().describe("Content type: post|comment|result|idea|text_selection|image"),
    limit: tool.schema.number().optional().describe("Max results, default 10"),
    scope: tool.schema.string().optional().describe("Scope: mine|all")
  },
  async execute({ keyword, userId, contentType, limit, scope }) {
    const db = getDb();
    let query = `
      SELECT f.id, f.user_id, f.content_type, f.content_id, f.post_id,
             f.text_data, f.image_url, f.visibility, f.created_at,
             u.username as user_name,
             p.title as post_title
      FROM favorites f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN posts p ON f.post_id = p.id
      WHERE (f.text_data LIKE ? OR p.title LIKE ?)
    `;
    const params: Array<string | number> = [`%${keyword}%`, `%${keyword}%`];

    if ((scope ?? "all") === "mine" && userId !== undefined && userId !== null) {
      query += " AND f.user_id = ?";
      params.push(userId);
    }

    if (contentType) {
      query += " AND f.content_type = ?";
      params.push(contentType);
    }

    query += " ORDER BY f.created_at DESC LIMIT ?";
    params.push(limit ?? 10);

    const stmt = db.query(query);
    return formatToolResult(stmt.all(...params));
  }
});
