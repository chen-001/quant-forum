import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { postQueries, ratingQueries } from '@/lib/db';

// 获取帖子详情
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const post = postQueries.findById(id);

        if (!post) {
            return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
        }

        const links = postQueries.getLinks(id);
        const ratings = ratingQueries.getAverages(id);

        // 获取当前用户的评分
        let userRating = null;
        const session = await getSessionFromCookies(await cookies());
        if (session.user) {
            userRating = ratingQueries.getUserRating(id, session.user.id);
        }

        return NextResponse.json({
            post: { ...post, links },
            ratings,
            userRating
        });
    } catch (error) {
        console.error('Get post error:', error);
        return NextResponse.json({ error: '获取帖子详情失败' }, { status: 500 });
    }
}

// 更新帖子 - 仅原作者可编辑
export async function PUT(request, { params }) {
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

        // 检查是否是原作者
        if (post.author_id !== session.user.id) {
            return NextResponse.json({ error: '只有原作者可以编辑帖子' }, { status: 403 });
        }

        const { title, content, links } = await request.json();

        // 更新帖子内容
        postQueries.update(id, title, content);

        // 更新链接：先删除旧的，再添加新的
        postQueries.deleteLinks(id);
        if (links && links.length > 0) {
            links.forEach((link, index) => {
                if (link.url && link.url.trim()) {
                    postQueries.addLink(id, link.url, link.title || '', index);
                }
            });
        }

        // 获取更新后的帖子
        const updatedPost = postQueries.findById(id);
        const updatedLinks = postQueries.getLinks(id);

        return NextResponse.json({
            message: '帖子更新成功',
            post: { ...updatedPost, links: updatedLinks }
        });
    } catch (error) {
        console.error('Update post error:', error);
        return NextResponse.json({ error: '更新帖子失败' }, { status: 500 });
    }
}

// 删除帖子 - 仅原作者可删除
export async function DELETE(request, { params }) {
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

        // 检查是否是原作者
        if (post.author_id !== session.user.id) {
            return NextResponse.json({ error: '只有原作者可以删除帖子' }, { status: 403 });
        }

        postQueries.delete(id);

        return NextResponse.json({ message: '帖子已删除' });
    } catch (error) {
        console.error('Delete post error:', error);
        return NextResponse.json({ error: '删除帖子失败' }, { status: 500 });
    }
}
