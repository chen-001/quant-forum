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
