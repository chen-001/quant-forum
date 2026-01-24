import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityLogQueries, postQueries } from '@/lib/db';

// 更新表格数据 - 任何登录用户都可以编辑
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

        // 确保是表格类型的帖子
        if (post.post_type !== 'table') {
            return NextResponse.json({ error: '此帖子不是表格类型' }, { status: 400 });
        }

        const { tableData, columnWidths, rowHeights } = await request.json();

        if (!tableData) {
            return NextResponse.json({ error: '表格数据不能为空' }, { status: 400 });
        }

        // 更新表格数据
        postQueries.updateTableData(id, tableData, columnWidths || [], rowHeights || []);

        // 获取更新后的数据
        const updatedTableData = postQueries.getTableData(id);

        activityLogQueries.create({
            category: 'post_detail',
            action: 'post_table_updated',
            actorId: session.user.id,
            relatedUserId: post.author_id,
            postId: parseInt(id),
            meta: {
                postTitle: post.title
            }
        });

        activityLogQueries.create({
            category: 'post_detail',
            action: 'post_table_updated',
            actorId: session.user.id,
            relatedUserId: post.author_id,
            postId: parseInt(id),
            meta: {
                postTitle: post.title
            }
        });

        return NextResponse.json({
            success: true,
            tableData: updatedTableData?.table_data || [['']],
            columnWidths: updatedTableData?.column_widths || [],
            rowHeights: updatedTableData?.row_heights || []
        });
    } catch (error) {
        console.error('Update table error:', error);
        return NextResponse.json({ error: '更新表格失败' }, { status: 500 });
    }
}
