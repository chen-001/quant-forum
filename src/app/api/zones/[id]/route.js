import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { zoneQueries } from '@/lib/db';

// 获取专区详情
export async function GET(request, { params }) {
    const { id } = await params;
    
    try {
        const zone = zoneQueries.findById(parseInt(id));
        
        if (!zone) {
            return NextResponse.json({ error: '专区不存在' }, { status: 404 });
        }
        
        return NextResponse.json({ zone });
    } catch (error) {
        console.error('Failed to fetch zone:', error);
        return NextResponse.json({ error: '获取专区详情失败' }, { status: 500 });
    }
}

// 更新专区
export async function PUT(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const zone = zoneQueries.findById(parseInt(id));
        
        if (!zone) {
            return NextResponse.json({ error: '专区不存在' }, { status: 404 });
        }
        
        // 只有创建者可以编辑
        if (zone.created_by !== session.user.id) {
            return NextResponse.json({ error: '无权编辑此专区' }, { status: 403 });
        }
        
        const { name, description, coverImage, isPublic } = await request.json();
        
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        if (coverImage !== undefined) updates.coverImage = coverImage?.trim() || null;
        if (isPublic !== undefined) updates.isPublic = isPublic ? 1 : 0;
        
        zoneQueries.update(parseInt(id), updates);
        
        return NextResponse.json({ message: '更新成功' });
    } catch (error) {
        console.error('Failed to update zone:', error);
        return NextResponse.json({ error: '更新专区失败' }, { status: 500 });
    }
}

// 删除专区
export async function DELETE(request, { params }) {
    const { id } = await params;
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const zone = zoneQueries.findById(parseInt(id));
        
        if (!zone) {
            return NextResponse.json({ error: '专区不存在' }, { status: 404 });
        }
        
        // 只有创建者可以删除
        if (zone.created_by !== session.user.id) {
            return NextResponse.json({ error: '无权删除此专区' }, { status: 403 });
        }
        
        zoneQueries.delete(parseInt(id));
        
        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Failed to delete zone:', error);
        return NextResponse.json({ error: '删除专区失败' }, { status: 500 });
    }
}
