import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { highlightQueries } from '@/lib/db';

// 获取当前用户的高亮
export async function GET(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    try {
        let highlights = [];
        if (session.user) {
            highlights = highlightQueries.findByPostIdAndUser(parseInt(id), session.user.id);
        }

        // 按行号分组高亮
        const highlightsByLine = {};
        highlights.forEach(h => {
            if (!highlightsByLine[h.line_index]) {
                highlightsByLine[h.line_index] = [];
            }
            highlightsByLine[h.line_index].push(h);
        });

        return NextResponse.json({ highlights: highlightsByLine });
    } catch (error) {
        console.error('Failed to fetch highlights:', error);
        return NextResponse.json({ error: '获取高亮失败' }, { status: 500 });
    }
}

// 添加高亮
export async function POST(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const { lineIndex, startOffset, endOffset, color } = await request.json();

        if (lineIndex === undefined || startOffset === undefined || endOffset === undefined) {
            return NextResponse.json({ error: '参数不完整' }, { status: 400 });
        }

        const result = highlightQueries.create(
            parseInt(id),
            session.user.id,
            parseInt(lineIndex),
            parseInt(startOffset),
            parseInt(endOffset),
            color || 'yellow'
        );

        return NextResponse.json({
            success: true,
            highlightId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Failed to create highlight:', error);
        return NextResponse.json({ error: '添加高亮失败' }, { status: 500 });
    }
}

// 删除高亮
export async function DELETE(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());

    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const { highlightId } = await request.json();
        highlightQueries.delete(parseInt(highlightId), session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete highlight:', error);
        return NextResponse.json({ error: '删除高亮失败' }, { status: 500 });
    }
}
