import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityLogQueries, postQueries, ratingQueries } from '@/lib/db';

// 获取帖子详情
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const post = postQueries.findById(id);

        if (!post) {
            return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
        }

        // 根据帖子类型获取不同的数据
        let postData = { ...post };

        if (post.post_type === 'table') {
            // 表格帖子：获取表格数据
            const tableData = postQueries.getTableData(id);
            postData.tableData = tableData?.table_data || [['']];
            postData.columnWidths = tableData?.column_widths || [];
            postData.rowHeights = tableData?.row_heights || [];
        } else {
            // 链接帖子：获取链接
            const links = postQueries.getLinks(id);
            postData.links = links;
        }

        const ratings = ratingQueries.getAverages(id);

        // 获取当前用户的评分
        let userRating = null;
        const session = await getSessionFromCookies(await cookies());
        if (session.user) {
            userRating = ratingQueries.getUserRating(id, session.user.id);
        }

        return NextResponse.json({
            post: postData,
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

        const { title, content, links, tableData, columnWidths, rowHeights } = await request.json();

        // 更新帖子内容
        postQueries.update(id, title, content);

        // 根据帖子类型更新不同的数据
        if (post.post_type === 'table') {
            // 更新表格数据
            if (tableData) {
                postQueries.updateTableData(id, tableData, columnWidths, rowHeights);
            }
        } else {
            // 更新链接：先删除旧的，再添加新的
            postQueries.deleteLinks(id);
            if (links && links.length > 0) {
                links.forEach((link, index) => {
                    if (link.url && link.url.trim()) {
                        postQueries.addLink(id, link.url, link.title || '', index);
                    }
                });
            }
        }

        // 获取更新后的帖子
        const updatedPost = postQueries.findById(id);
        let updatedData = { ...updatedPost };

        if (post.post_type === 'table') {
            const tableDataResult = postQueries.getTableData(id);
            updatedData.tableData = tableDataResult?.table_data || [['']];
            updatedData.columnWidths = tableDataResult?.column_widths || [];
            updatedData.rowHeights = tableDataResult?.row_heights || [];
        } else {
            updatedData.links = postQueries.getLinks(id);
        }

        activityLogQueries.create({
            category: 'post_detail',
            action: 'post_updated',
            actorId: session.user.id,
            relatedUserId: post.author_id,
            postId: parseInt(id),
            meta: {
                title: updatedData.title
            }
        });

        return NextResponse.json({
            message: '帖子更新成功',
            post: updatedData
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
