import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { todoQueries } from '@/lib/db';

// GET /api/todos - 获取用户待办列表
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const contentType = searchParams.get('contentType');
        const postId = searchParams.get('postId');
        const isCompleted = searchParams.get('isCompleted');
        const scope = searchParams.get('scope') || 'mine';

        const todos = todoQueries.findByUserId(
            session.user.id,
            contentType || null,
            postId ? parseInt(postId) : null,
            isCompleted !== null ? isCompleted === 'true' : null,
            scope
        );

        return NextResponse.json({ todos });
    } catch (error) {
        console.error('Get todos error:', error);
        return NextResponse.json({ error: '获取待办失败' }, { status: 500 });
    }
}

// POST /api/todos - 切换待办状态（有则删除，无则创建）
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const data = await request.json();
        const { contentType, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, note, visibility } = data;

        // 验证必需字段
        if (!contentType || !postId) {
            return NextResponse.json({ error: '缺少必需字段' }, { status: 400 });
        }

        // 检查是否已存在
        const existing = todoQueries.findExists({
            userId: session.user.id,
            contentType,
            postId: parseInt(postId),
            commentId: commentId ? parseInt(commentId) : null,
            resultId: resultId ? parseInt(resultId) : null
        });

        if (existing) {
            // 已存在，执行删除
            todoQueries.delete(existing.id, session.user.id);
            return NextResponse.json({
                message: '已从待办移除',
                action: 'deleted'
            });
        } else {
            // 不存在，执行创建
            const result = todoQueries.create({
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
                note: note || null,
                visibility: visibility || 'public'
            });
            return NextResponse.json({
                message: '已添加到待办',
                action: 'created',
                todoId: result.lastInsertRowid
            });
        }
    } catch (error) {
        console.error('Toggle todo error:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
}
