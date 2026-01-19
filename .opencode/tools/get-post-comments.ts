import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Fetch comments for a post.",
  args: {
    postId: tool.schema.number().describe("Post ID"),
    limit: tool.schema.number().optional().describe("Max results, default 50")
  },
  async execute({ postId, limit }) {
    const db = getDb();
    const stmt = db.query(`
      SELECT c.id, c.post_id, c.parent_id, c.content, c.author_id,
             u.username as author_name, ct.content as text_content,
             c.likes_count, c.doubts_count, c.created_at
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN comments_text ct ON c.id = ct.comment_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
      LIMIT ?
    `);
    return formatToolResult(stmt.all(postId, limit ?? 50));
  }
});
