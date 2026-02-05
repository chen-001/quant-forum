import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { zonePageQueries } from '@/lib/db';

// 获取页面详情
export async function GET(request, { params }) {
    const { pageId } = await params;
    
    try {
        const page = zonePageQueries.findById(parseInt(pageId));
        
        if (!page) {
            return NextResponse.json({ error: '页面不存在' }, { status: 404 });
        }
        
        return NextResponse.json({ page });
    } catch (error) {
        console.error('Failed to fetch zone page:', error);
        return NextResponse.json({ error: '获取页面详情失败' }, { status: 500 });
    }
}

// 更新页面
export async function PUT(request, { params }) {
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
        
        // 任何登录用户都可以编辑页面内容（类似 ideaQueries 的设计）
        const { title, content } = await request.json();
        
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (content !== undefined) updates.content = content;
        
        zonePageQueries.update(parseInt(pageId), updates);
        
        return NextResponse.json({ message: '更新成功' });
    } catch (error) {
        console.error('Failed to update zone page:', error);
        return NextResponse.json({ error: '更新页面失败' }, { status: 500 });
    }
}

// 删除页面
export async function DELETE(request, { params }) {
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
        
        // 只有创建者可以删除
        if (page.created_by !== session.user.id) {
            return NextResponse.json({ error: '无权删除此页面' }, { status: 403 });
        }
        
        // 检查是否有子页面
        const children = zonePageQueries.getChildren(parseInt(pageId));
        if (children && children.length > 0) {
            return NextResponse.json({ error: '请先删除子页面' }, { status: 400 });
        }
        
        zonePageQueries.delete(parseInt(pageId));
        
        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Failed to delete zone page:', error);
        return NextResponse.json({ error: '删除页面失败' }, { status: 500 });
    }
}
