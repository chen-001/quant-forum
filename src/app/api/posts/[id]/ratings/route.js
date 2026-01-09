import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { ratingQueries } from '@/lib/db';

// 获取评分
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const ratings = ratingQueries.getAverages(id);

        // 获取当前用户的评分
        let userRating = null;
        const session = await getSessionFromCookies(await cookies());
        if (session.user) {
            userRating = ratingQueries.getUserRating(id, session.user.id);
        }

        return NextResponse.json({ ratings, userRating });
    } catch (error) {
        console.error('Get ratings error:', error);
        return NextResponse.json({ error: '获取评分失败' }, { status: 500 });
    }
}

// 提交评分
export async function POST(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const ratings = await request.json();

        // 验证评分值
        const ratingFields = ['novelty', 'test_effect', 'extensibility', 'creativity', 'fun', 'completeness'];
        for (const field of ratingFields) {
            if (!ratings[field] || ratings[field] < 1 || ratings[field] > 5) {
                return NextResponse.json({ error: '评分值必须在1-5之间' }, { status: 400 });
            }
        }

        ratingQueries.upsert(id, session.user.id, ratings);

        // 返回更新后的平均评分
        const newRatings = ratingQueries.getAverages(id);

        return NextResponse.json({
            message: '评分成功',
            ratings: newRatings
        });
    } catch (error) {
        console.error('Submit rating error:', error);
        return NextResponse.json({ error: '评分失败' }, { status: 500 });
    }
}
