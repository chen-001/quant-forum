import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { zonePageQueries, zonePageDiscussionQueries } from '@/lib/db';

// 获取页面的讨论列表
export async function GET(request, { params }) {
    const { pageId } = await params;
    
    try {
        const page = zonePageQueries.findById(parseInt(pageId));
        
        if (!page) {
            return NextResponse.json({ error: '页面不存在' }, { status: 404 });
        }
        
        const { searchParams } = new URL(request.url);
        const tree = searchParams.get('tree');
        
        let discussions;
        if (tree === '1') {
            discussions = zonePageDiscussionQueries.getTree(parseInt(pageId));
        } else {
            discussions = zonePageDiscussionQueries.findByPageId(parseInt(pageId));
        }
        
        // 获取当前用户的反应
        const session = await getSessionFromCookies(await cookies());
        let userReactions = [];
        if (session.user) {
            userReactions = zonePageDiscussionQueries.getUserReactions(parseInt(pageId), session.user.id);
        }
        
        return NextResponse.json({ discussions, userReactions });
    } catch (error) {
        console.error('Failed to fetch discussions:', error);
        return NextResponse.json({ error: '获取讨论列表失败' }, { status: 500 });
    }
}

// 发表评论
export async function POST(request, { params }) {
    const { pageId } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const page = zonePageQueries.findById(parseInt(pageId));
        
        if (!page) {
            return NextResponse.json({ error: '页面不存在' }, { status: 404 });
        }
        
        const { content, parentId = null } = await request.json();
        
        if (!content || content.trim() === '') {
            return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
        }
        
        // 验证父评论是否存在且属于同一页面
        if (parentId) {
            const parentDiscussion = zonePageDiscussionQueries.findById(parentId);
            if (!parentDiscussion || parentDiscussion.page_id !== parseInt(pageId)) {
                return NextResponse.json({ error: '父评论不存在' }, { status: 400 });
            }
        }
        
        const result = zonePageDiscussionQueries.create(
            parseInt(pageId),
            parentId,
            content.trim(),
            session.user.id
        );
        
        return NextResponse.json({ 
            message: '发表成功',
            discussionId: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Failed to create discussion:', error);
        return NextResponse.json({ error: '发表评论失败' }, { status: 500 });
    }
}

// 更新评论
export async function PUT(request, { params }) {
    const { pageId } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const { discussionId, content } = await request.json();
        
        if (!discussionId || !content || content.trim() === '') {
            return NextResponse.json({ error: '参数错误' }, { status: 400 });
        }
        
        const discussion = zonePageDiscussionQueries.findById(discussionId);
        
        if (!discussion || discussion.page_id !== parseInt(pageId)) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }
        
        // 只有作者可以编辑
        if (discussion.author_id !== session.user.id) {
            return NextResponse.json({ error: '无权编辑此评论' }, { status: 403 });
        }
        
        zonePageDiscussionQueries.update(discussionId, content.trim());
        
        return NextResponse.json({ message: '更新成功' });
    } catch (error) {
        console.error('Failed to update discussion:', error);
        return NextResponse.json({ error: '更新评论失败' }, { status: 500 });
    }
}

// 删除评论
export async function DELETE(request, { params }) {
    const { pageId } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const { searchParams } = new URL(request.url);
        const discussionId = searchParams.get('discussionId');
        
        if (!discussionId) {
            return NextResponse.json({ error: '缺少评论ID' }, { status: 400 });
        }
        
        const discussion = zonePageDiscussionQueries.findById(parseInt(discussionId));
        
        if (!discussion || discussion.page_id !== parseInt(pageId)) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }
        
        // 只有作者可以删除
        if (discussion.author_id !== session.user.id) {
            return NextResponse.json({ error: '无权删除此评论' }, { status: 403 });
        }
        
        zonePageDiscussionQueries.delete(parseInt(discussionId));
        
        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Failed to delete discussion:', error);
        return NextResponse.json({ error: '删除评论失败' }, { status: 500 });
    }
}

// 处理点赞/质疑
export async function PATCH(request, { params }) {
    const { pageId } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const { discussionId, reactionType, action } = await request.json();
        
        if (!discussionId || !reactionType || !['like', 'doubt'].includes(reactionType)) {
            return NextResponse.json({ error: '参数错误' }, { status: 400 });
        }
        
        const discussion = zonePageDiscussionQueries.findById(discussionId);
        
        if (!discussion || discussion.page_id !== parseInt(pageId)) {
            return NextResponse.json({ error: '评论不存在' }, { status: 404 });
        }
        
        if (action === 'remove') {
            zonePageDiscussionQueries.removeReaction(discussionId, session.user.id, reactionType);
        } else {
            zonePageDiscussionQueries.addReaction(discussionId, session.user.id, reactionType);
        }
        
        return NextResponse.json({ message: '操作成功' });
    } catch (error) {
        console.error('Failed to handle reaction:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
}
