import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { lineCommentQueries } from '@/lib/db';

// 获取帖子的所有行级评论
export async function GET(request, { params }) {
    const { id } = await params;

    try {
        const comments = lineCommentQueries.findByPostId(parseInt(id));

        // 按行号分组评论
        const commentsByLine = {};
        comments.forEach(comment => {
            if (!commentsByLine[comment.line_index]) {
                commentsByLine[comment.line_index] = [];
            }
            commentsByLine[comment.line_index].push(comment);
        });

        return NextResponse.json({ comments: commentsByLine });
    } catch (error) {
        console.error('Failed to fetch line comments:', error);
        return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
    }
}

// 添加行级评论
export async function POST(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const { lineIndex, content } = await request.json();

        if (lineIndex === undefined || !content?.trim()) {
            return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
        }

        const result = lineCommentQueries.create(
            parseInt(id),
            parseInt(lineIndex),
            session.user.id,
            content.trim()
        );

        return NextResponse.json({
            success: true,
            commentId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Failed to create line comment:', error);
        return NextResponse.json({ error: '添加评论失败' }, { status: 500 });
    }
}

// 删除行级评论
export async function DELETE(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const { commentId } = await request.json();
        lineCommentQueries.delete(parseInt(commentId), session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete line comment:', error);
        return NextResponse.json({ error: '删除评论失败' }, { status: 500 });
    }
}
