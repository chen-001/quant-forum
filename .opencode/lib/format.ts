export function formatToolResult(data: unknown) {
  return JSON.stringify(data ?? null, null, 2);
}
