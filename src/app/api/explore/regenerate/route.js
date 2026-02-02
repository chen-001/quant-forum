import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { commentExplorationQueries, getDb } from '@/lib/db';
import { callZenmuxAI } from '@/lib/ai-client';
import { getExplorationPrompt, getDefaultVariants } from '@/lib/exploration-prompt';

// POST /api/explore/regenerate - 重新生成探索方案
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { commentId, textContent, imageBase64List } = body;

        if (!commentId) {
            return NextResponse.json({ error: '缺少commentId参数' }, { status: 400 });
        }

        // 验证评论是否存在
        const db = getDb();
        const commentStmt = db.prepare('SELECT id, content FROM comments WHERE id = ?');
        const comment = commentStmt.get(commentId);

        if (!comment) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }

        // 使用传入的内容或从数据库获取
        const finalTextContent = textContent || comment.content || '';
        const finalImageList = imageBase64List || [];

        if (!finalTextContent.trim() && finalImageList.length === 0) {
            return NextResponse.json({ error: '评论内容为空，无法生成探索方案' }, { status: 400 });
        }

        // 调用AI生成3种新方案（使用不同的prompt鼓励多样性）
        const variants = await generateExplorationVariants(finalTextContent, finalImageList);

        // 更新数据库
        const existing = commentExplorationQueries.getByCommentId(parseInt(commentId));
        if (existing) {
            commentExplorationQueries.update(parseInt(commentId), { variants });
        } else {
            commentExplorationQueries.create(commentId, variants, '000001', 20220819);
        }

        return NextResponse.json({
            variants,
            defaultCode: existing?.default_code || '000001',
            defaultDate: existing?.default_date || 20220819,
            isGenerated: true
        });
    } catch (error) {
        console.error('重新生成探索方案失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 调用AI生成探索方案（重新生成版本，使用共享提示词）
async function generateExplorationVariants(commentContent, imageBase64List = []) {
    const prompt = getExplorationPrompt(commentContent, true);

    const response = await callZenmuxAI(prompt, imageBase64List);
    const content = response.choices[0].message.content;

    // 解析JSON响应
    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.variants && Array.isArray(parsed.variants) && parsed.variants.length === 3) {
                return parsed.variants;
            }
        }
        throw new Error('AI返回格式不正确');
    } catch (parseError) {
        console.error('解析AI响应失败:', parseError, content);
        return getDefaultVariants();
    }
}
