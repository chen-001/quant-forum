import { tool } from "@opencode-ai/plugin";
import { getDb } from "../lib/_db";
import { formatToolResult } from "../lib/format";

export default tool({
  description: "Fetch the idea section for a post.",
  args: {
    postId: tool.schema.number().describe("Post ID")
  },
  async execute({ postId }) {
    const db = getDb();
    const stmt = db.query(`
      SELECT pi.id, pi.post_id, pi.content, pi.updated_at,
             u.username as last_editor_name,
             pit.content as text_content
      FROM post_ideas pi
      LEFT JOIN users u ON pi.last_editor_id = u.id
      LEFT JOIN post_ideas_text pit ON pi.id = pit.idea_id
      WHERE pi.post_id = ?
    `);
    return formatToolResult(stmt.get(postId));
  }
});
