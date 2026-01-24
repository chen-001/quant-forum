import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityLogQueries, postQueries, resultQueries } from '@/lib/db';
import { ocrTextQueries } from '@/lib/ocr-queries';

// 获取成果列表
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const results = resultQueries.findByPostId(id);

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Get results error:', error);
        return NextResponse.json({ error: '获取成果记录失败' }, { status: 500 });
    }
}

// 创建成果记录
export async function POST(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const { content } = await request.json();

        if (!content || content.trim().length === 0) {
            return NextResponse.json({ error: '成果内容不能为空' }, { status: 400 });
        }

        const result = resultQueries.create(id, session.user.id, content.trim());
        const resultId = result.lastInsertRowid;

        // 如果内容包含图片，添加OCR任务
        if (content.includes('![')) {
            ocrTextQueries.scheduleOCR('result', resultId, content);
        }

        const post = postQueries.findById(id);
        if (post) {
            activityLogQueries.create({
                category: 'post_detail',
                action: 'post_result_created',
                actorId: session.user.id,
                relatedUserId: post.author_id,
                postId: parseInt(id),
                resultId,
                meta: {
                    postTitle: post.title
                }
            });
        }

        return NextResponse.json({
            message: '记录成功',
            resultId
        });
    } catch (error) {
        console.error('Create result error:', error);
        return NextResponse.json({ error: '记录失败' }, { status: 500 });
    }
}
