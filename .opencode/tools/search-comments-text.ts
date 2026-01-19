import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Search comment text by keyword, optionally limited to a post.",
  args: {
    keyword: tool.schema.string().describe("Search keyword"),
    postId: tool.schema.number().optional().describe("Limit to a post ID"),
    limit: tool.schema.number().optional().describe("Max results, default 10"),
    contextScope: tool.schema.string().optional().describe("Context scope (all|current), unused")
  },
  async execute({ keyword, postId, limit }) {
    const db = getDb();
    let query = `
      SELECT c.id, c.post_id, c.content, c.author_id, u.username as author_name,
             ct.content as text_content, c.created_at,
             p.title as post_title
      FROM comments c
      LEFT JOIN comments_text ct ON c.id = ct.comment_id
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id
      WHERE ct.content LIKE ?
    `;
    const params: Array<string | number> = [`%${keyword}%`];

    if (postId !== undefined && postId !== null) {
      query += " AND c.post_id = ?";
      params.push(postId);
    }

    query += " ORDER BY c.created_at DESC LIMIT ?";
    params.push(limit ?? 10);

    const stmt = db.query(query);
    return formatToolResult(stmt.all(...params));
  }
});
