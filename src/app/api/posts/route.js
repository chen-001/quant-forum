import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { postQueries } from '@/lib/db';
import { ocrTextQueries } from '@/lib/ocr-queries';

// 获取帖子列表
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderBy = searchParams.get('orderBy') || 'created_at';
        const order = searchParams.get('order') || 'DESC';
        const limit = parseInt(searchParams.get('limit')) || 50;
        const offset = parseInt(searchParams.get('offset')) || 0;
        const search = searchParams.get('search') || '';

        console.log('API: Fetching posts with params:', { orderBy, order, limit, offset, search });
        console.log('API: CWD:', process.cwd());

        try {
            let posts;
            if (search.trim()) {
                posts = postQueries.search(search.trim(), orderBy, order, limit, offset);
            } else {
                posts = postQueries.list(orderBy, order, limit, offset);
            }
            console.log('API: Found posts count:', posts.length);
            return NextResponse.json({ posts });
        } catch (dbError) {
            console.error('API: Database query error:', dbError);
            throw dbError;
        }
    } catch (error) {
        console.error('Get posts error:', error);
        return NextResponse.json({ error: '获取帖子列表失败' }, { status: 500 });
    }
}

// 创建新帖子
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { title, content, links, postType, tableData, columnWidths, rowHeights } = await request.json();

        if (!title || title.trim().length === 0) {
            return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
        }

        let postId;

        if (postType === 'table') {
            // 创建表格帖子
            if (!tableData || tableData.length === 0) {
                return NextResponse.json({ error: '表格数据不能为空' }, { status: 400 });
            }
            const result = postQueries.createTablePost(
                title.trim(),
                content || '',
                session.user.id,
                tableData,
                columnWidths,
                rowHeights
            );
            postId = result.lastInsertRowid;
        } else {
            // 创建链接帖子（原有逻辑）
            const result = postQueries.create(title.trim(), content || '', session.user.id);
            postId = result.lastInsertRowid;

            // 添加链接（如果有的话）
            if (links && links.length > 0) {
                links.forEach((link, index) => {
                    if (link.url && link.url.trim()) {
                        postQueries.addLink(postId, link.url.trim(), link.title || '', index);
                    }
                });
            }
        }

        // 如果内容包含图片，添加OCR任务
        if (content && content.includes('![')) {
            ocrTextQueries.scheduleOCR('post', postId, content);
        }

        return NextResponse.json({
            message: '发帖成功',
            postId
        });
    } catch (error) {
        console.error('Create post error:', error);
        return NextResponse.json({ error: '发帖失败，请稍后重试' }, { status: 500 });
    }
}
