import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Search result text by keyword, optionally limited to a post.",
  args: {
    keyword: tool.schema.string().describe("Search keyword"),
    postId: tool.schema.number().optional().describe("Limit to a post ID"),
    limit: tool.schema.number().optional().describe("Max results, default 10"),
    contextScope: tool.schema.string().optional().describe("Context scope (all|current), unused")
  },
  async execute({ keyword, postId, limit }) {
    const db = getDb();
    let query = `
      SELECT r.id, r.post_id, r.content, r.author_id, u.username as author_name,
             rt.content as text_content, r.created_at,
             p.title as post_title
      FROM results r
      LEFT JOIN results_text rt ON r.id = rt.result_id
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN posts p ON r.post_id = p.id
      WHERE rt.content LIKE ?
    `;
    const params: Array<string | number> = [`%${keyword}%`];

    if (postId !== undefined && postId !== null) {
      query += " AND r.post_id = ?";
      params.push(postId);
    }

    query += " ORDER BY r.created_at DESC LIMIT ?";
    params.push(limit ?? 10);

    const stmt = db.query(query);
    return formatToolResult(stmt.all(...params));
  }
});
