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

        // 验证评分值 - 允许部分评分，填写的值必须在1-5之间
        const ratingFields = ['novelty', 'test_effect', 'extensibility', 'creativity', 'fun', 'completeness'];
        let hasAtLeastOne = false;
        for (const field of ratingFields) {
            const value = ratings[field] || 0;
            if (value > 0) {
                hasAtLeastOne = true;
                if (value < 1 || value > 5) {
                    return NextResponse.json({ error: '评分值必须在1-5之间' }, { status: 400 });
                }
            }
        }
        if (!hasAtLeastOne) {
            return NextResponse.json({ error: '请至少完成一项评分' }, { status: 400 });
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
