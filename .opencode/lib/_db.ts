import { Database } from "bun:sqlite";
import path from "path";
import { fileURLToPath } from "url";

let db: Database | null = null;

export function getDb() {
  if (!db) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dbPath = path.join(__dirname, "../../data/forum.db");
    db = new Database(dbPath);
  }
  return db;
}
