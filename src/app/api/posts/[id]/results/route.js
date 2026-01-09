import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { resultQueries } from '@/lib/db';

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

        return NextResponse.json({
            message: '记录成功',
            resultId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create result error:', error);
        return NextResponse.json({ error: '记录失败' }, { status: 500 });
    }
}
