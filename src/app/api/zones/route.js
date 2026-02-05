import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { zoneQueries, activityLogQueries } from '@/lib/db';

// 获取所有专区
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get('keyword');
        
        let zones;
        if (keyword) {
            zones = zoneQueries.search(keyword);
        } else {
            zones = zoneQueries.list();
        }
        
        return NextResponse.json({ zones });
    } catch (error) {
        console.error('Failed to fetch zones:', error);
        return NextResponse.json({ error: '获取专区列表失败' }, { status: 500 });
    }
}

// 创建专区
export async function POST(request) {
    const session = await getSessionFromCookies(await cookies());
    
    if (!session.user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    try {
        const { name, description, coverImage, isPublic = true } = await request.json();
        
        if (!name || name.trim() === '') {
            return NextResponse.json({ error: '专区名称不能为空' }, { status: 400 });
        }
        
        const result = zoneQueries.create(
            name.trim(),
            description?.trim() || null,
            coverImage?.trim() || null,
            session.user.id,
            isPublic ? 1 : 0
        );
        
        // 记录活动日志
        activityLogQueries.create({
            category: 'zone',
            action: 'zone_created',
            actorId: session.user.id,
            meta: { zoneName: name.trim() }
        });
        
        return NextResponse.json({ 
            message: '创建成功',
            zoneId: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Failed to create zone:', error);
        return NextResponse.json({ error: '创建专区失败' }, { status: 500 });
    }
}
