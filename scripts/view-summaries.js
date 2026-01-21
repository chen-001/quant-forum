#!/usr/bin/env node
import { postSummaryQueries } from '../src/lib/db.js';

const summaries = postSummaryQueries.getAll();

if (summaries.length === 0) {
    console.log('暂无帖子摘要');
} else {
    console.log(`共 ${summaries.length} 条摘要\n`);
    console.log('='.repeat(80));

    for (const s of summaries) {
        console.log(`\n[${s.post_id}] ${s.post_title}`);
        console.log(`作者: ${s.author_name || '未知'}`);
        console.log('├─ 主题:', s.main_topic);
        console.log('├─ 逻辑:', s.main_logic);
        console.log('├─ 因子:', s.factors || '-');
        console.log('├─ 关键概念:', s.key_concepts || '-');
        console.log('├─ 摘要:', s.summary);
        console.log('├─ 模型:', s.ai_model || '-');
        console.log('└─ 生成时间:', s.generated_at);
        if (s.updated_at !== s.generated_at) {
            console.log('   更新时间:', s.updated_at);
        }
        console.log('='.repeat(80));
    }
}
