import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Fetch a post with author info and extracted text content.",
  args: {
    postId: tool.schema.number().describe("Post ID")
  },
  async execute({ postId }) {
    const db = getDb();
    const stmt = db.query(`
      SELECT p.id, p.title, p.post_type, p.author_id, u.username as author_name,
             pt.content as text_content, p.created_at, p.updated_at
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN posts_text pt ON p.id = pt.post_id
      WHERE p.id = ?
    `);
    return formatToolResult(stmt.get(postId));
  }
});
