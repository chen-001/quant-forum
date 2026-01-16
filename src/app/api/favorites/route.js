import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { favoriteQueries } from '@/lib/db';

// GET /api/favorites - 获取用户收藏列表
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const contentType = searchParams.get('contentType');
        const postId = searchParams.get('postId');
        const scope = searchParams.get('scope') || 'mine';

        const favorites = favoriteQueries.findByUserId(
            session.user.id,
            contentType || null,
            postId ? parseInt(postId) : null,
            scope
        );

        return NextResponse.json({ favorites });
    } catch (error) {
        console.error('Get favorites error:', error);
        return NextResponse.json({ error: '获取收藏失败' }, { status: 500 });
    }
}

// POST /api/favorites - 切换收藏状态（有则删除，无则创建）
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const data = await request.json();
        const { contentType, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, visibility } = data;

        // 验证必需字段
        if (!contentType || !postId) {
            return NextResponse.json({ error: '缺少必需字段' }, { status: 400 });
        }

        // 验证内容类型
        const validTypes = ['post', 'comment', 'result', 'idea', 'text_selection', 'image'];
        if (!validTypes.includes(contentType)) {
            return NextResponse.json({ error: '无效的内容类型' }, { status: 400 });
        }

        // 检查是否已存在
        const existing = favoriteQueries.findExists({
            userId: session.user.id,
            contentType,
            postId: parseInt(postId),
            commentId: commentId ? parseInt(commentId) : null,
            resultId: resultId ? parseInt(resultId) : null
        });

        if (existing) {
            // 已存在，执行删除
            favoriteQueries.delete(existing.id, session.user.id);
            return NextResponse.json({
                message: '已取消收藏',
                action: 'deleted'
            });
        } else {
            // 不存在，执行创建
            const result = favoriteQueries.create({
                userId: session.user.id,
                contentType,
                postId: parseInt(postId),
                commentId: commentId ? parseInt(commentId) : null,
                resultId: resultId ? parseInt(resultId) : null,
                textData,
                imageUrl,
                lineIndex: lineIndex !== undefined ? parseInt(lineIndex) : null,
                startOffset: startOffset !== undefined ? parseInt(startOffset) : null,
                endOffset: endOffset !== undefined ? parseInt(endOffset) : null,
                visibility: visibility || 'public'
            });
            return NextResponse.json({
                message: '收藏成功',
                action: 'created',
                favoriteId: result.lastInsertRowid
            });
        }
    } catch (error) {
        console.error('Toggle favorite error:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
}
