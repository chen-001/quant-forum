import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { ideaQueries } from '@/lib/db';

// 获取帖子的想法区内容
export async function GET(request, { params }) {
    const { id } = await params;

    try {
        const idea = ideaQueries.get(parseInt(id));
        return NextResponse.json({
            content: idea?.content || '',
            lastEditorName: idea?.last_editor_name || null,
            updatedAt: idea?.updated_at || null
        });
    } catch (error) {
        console.error('Failed to fetch idea:', error);
        return NextResponse.json({ error: '获取想法区内容失败' }, { status: 500 });
    }
}

// 更新帖子的想法区内容（任何登录用户都可以编辑）
export async function PUT(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const { content } = await request.json();

        if (content === undefined) {
            return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
        }

        ideaQueries.upsert(parseInt(id), content, session.user.id);

        // 返回更新后的内容
        const idea = ideaQueries.get(parseInt(id));
        return NextResponse.json({
            success: true,
            content: idea?.content || '',
            lastEditorName: idea?.last_editor_name || null,
            updatedAt: idea?.updated_at || null
        });
    } catch (error) {
        console.error('Failed to update idea:', error);
        return NextResponse.json({ error: '更新想法区内容失败' }, { status: 500 });
    }
}
