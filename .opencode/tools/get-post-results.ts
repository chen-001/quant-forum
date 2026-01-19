import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Fetch results for a post.",
  args: {
    postId: tool.schema.number().describe("Post ID"),
    limit: tool.schema.number().optional().describe("Max results, default 50")
  },
  async execute({ postId, limit }) {
    const db = getDb();
    const stmt = db.query(`
      SELECT r.id, r.post_id, r.content, r.author_id, u.username as author_name,
             rt.content as text_content, r.created_at
      FROM results r
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN results_text rt ON r.id = rt.result_id
      WHERE r.post_id = ?
      ORDER BY r.created_at ASC
      LIMIT ?
    `);
    return formatToolResult(stmt.all(postId, limit ?? 50));
  }
});
