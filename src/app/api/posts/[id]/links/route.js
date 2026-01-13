import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { postQueries, userQueries } from '@/lib/db';

// 添加链接到帖子
export async function POST(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const post = postQueries.findById(id);

        if (!post) {
            return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
        }

        // 表格帖子不支持添加链接
        if (post.post_type === 'table') {
            return NextResponse.json({ error: '表格帖子不支持添加链接' }, { status: 400 });
        }

        const { url, title } = await request.json();

        if (!url || !url.trim()) {
            return NextResponse.json({ error: '链接URL不能为空' }, { status: 400 });
        }

        // 获取当前用户信息
        const currentUser = userQueries.findById(session.user.id);

        // 如果不是帖子作者，在标题后添加用户名
        let finalTitle = title || '';
        if (post.author_id !== session.user.id && currentUser) {
            if (finalTitle) {
                finalTitle = `${finalTitle}-${currentUser.username}`;
            } else {
                finalTitle = `链接-${currentUser.username}`;
            }
        }

        // 获取当前最大 order_num
        const existingLinks = postQueries.getLinks(id);
        const maxOrderNum = existingLinks.length > 0
            ? Math.max(...existingLinks.map(l => l.order_num))
            : -1;

        // 添加链接
        postQueries.addLink(id, url.trim(), finalTitle, maxOrderNum + 1);

        // 更新帖子时间
        postQueries.updateTime(id);

        // 返回更新后的链接列表
        const updatedLinks = postQueries.getLinks(id);

        return NextResponse.json({
            message: '链接添加成功',
            links: updatedLinks
        });
    } catch (error) {
        console.error('Add link error:', error);
        return NextResponse.json({ error: '添加链接失败' }, { status: 500 });
    }
}
