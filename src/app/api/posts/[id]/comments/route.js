import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { commentQueries } from '@/lib/db';

// 获取评论列表
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const comments = commentQueries.findByPostId(id);

        // 获取当前用户的反应
        let userReactions = [];
        const session = await getSessionFromCookies(await cookies());
        if (session.user) {
            userReactions = commentQueries.getUserReactions(id, session.user.id);
        }

        return NextResponse.json({ comments, userReactions });
    } catch (error) {
        console.error('Get comments error:', error);
        return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
    }
}

// 创建评论
export async function POST(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const { content, parentId } = await request.json();

        if (!content || content.trim().length === 0) {
            return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
        }

        const result = commentQueries.create(id, session.user.id, content.trim(), parentId || null);

        return NextResponse.json({
            message: '评论成功',
            commentId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create comment error:', error);
        return NextResponse.json({ error: '评论失败' }, { status: 500 });
    }
}

// 反应（点赞/质疑）
export async function PATCH(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { commentId, reactionType, action } = await request.json();

        if (!['like', 'doubt'].includes(reactionType)) {
            return NextResponse.json({ error: '无效的反应类型' }, { status: 400 });
        }

        if (action === 'add') {
            commentQueries.addReaction(commentId, session.user.id, reactionType);
        } else if (action === 'remove') {
            commentQueries.removeReaction(commentId, session.user.id, reactionType);
        }

        return NextResponse.json({ message: '操作成功' });
    } catch (error) {
        console.error('Reaction error:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
}

// 编辑评论
export async function PUT(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { commentId, content } = await request.json();

        if (!content || content.trim().length === 0) {
            return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
        }

        // Verify the comment exists and belongs to the user
        const comment = commentQueries.findById(commentId);
        if (!comment) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }
        if (comment.author_id !== session.user.id) {
            return NextResponse.json({ error: '只能编辑自己的评论' }, { status: 403 });
        }

        const result = commentQueries.update(commentId, session.user.id, content.trim());

        if (result.changes === 0) {
            return NextResponse.json({ error: '编辑失败' }, { status: 500 });
        }

        return NextResponse.json({ message: '编辑成功' });
    } catch (error) {
        console.error('Edit comment error:', error);
        return NextResponse.json({ error: '编辑失败' }, { status: 500 });
    }
}

// 删除评论
export async function DELETE(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('commentId');

        if (!commentId) {
            return NextResponse.json({ error: '缺少评论ID' }, { status: 400 });
        }

        // Verify the comment exists and belongs to the user
        const comment = commentQueries.findById(commentId);
        if (!comment) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }
        if (comment.author_id !== session.user.id) {
            return NextResponse.json({ error: '只能删除自己的评论' }, { status: 403 });
        }

        const result = commentQueries.delete(commentId, session.user.id);

        if (result.changes === 0) {
            return NextResponse.json({ error: '删除失败' }, { status: 500 });
        }

        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Delete comment error:', error);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
}
