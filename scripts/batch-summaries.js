#!/usr/bin/env node

import { generateSummariesForExistingPosts } from '../src/lib/ai-summary.js';
import config from '../data/config.json' with { type: 'json' };

async function main() {
  console.log('开始为现有帖子生成摘要...\n');
  console.log(`提示：需要确保OpenCode服务正在运行 (${config.opencode?.baseURL || 'http://localhost:4095'})\n`);

  const result = await generateSummariesForExistingPosts();

  console.log('\n===== 处理完成 =====');
  console.log(`总数: ${result.total}`);
  console.log(`成功: ${result.success}`);
  console.log(`跳过(OCR未完成): ${result.skipped}`);
  console.log(`失败: ${result.fail}`);
}

main().catch(console.error);
