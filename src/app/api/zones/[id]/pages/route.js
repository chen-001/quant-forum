import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { zoneQueries, zonePageQueries } from '@/lib/db';

// 获取专区的所有页面
export async function GET(request, { params }) {
    const { id } = await params;
    
    try {
        const zone = zoneQueries.findById(parseInt(id));
        
        if (!zone) {
            return NextResponse.json({ error: '专区不存在' }, { status: 404 });
        }
        
        const { searchParams } = new URL(request.url);
        const tree = searchParams.get('tree');
        
        let pages;
        if (tree === '1') {
            pages = zonePageQueries.getTree(parseInt(id));
        } else {
            pages = zonePageQueries.findByZoneId(parseInt(id));
        }
        
        return NextResponse.json({ zone, pages });
    } catch (error) {
        console.error('Failed to fetch zone pages:', error);
        return NextResponse.json({ error: '获取页面列表失败' }, { status: 500 });
    }
}

// 在专区下创建页面
export async function POST(request, { params }) {
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
        
        const { title, content = '', parentId = null } = await request.json();
        
        if (!title || title.trim() === '') {
            return NextResponse.json({ error: '页面标题不能为空' }, { status: 400 });
        }
        
        // 计算层级和路径
        let level = 0;
        let path = '';
        
        if (parentId) {
            const parent = zonePageQueries.findById(parentId);
            if (!parent || parent.zone_id !== parseInt(id)) {
                return NextResponse.json({ error: '父页面不存在' }, { status: 400 });
            }
            level = parent.level + 1;
            if (level > 3) { // 最大4层 (0,1,2,3)
                return NextResponse.json({ error: '页面层级不能超过4层' }, { status: 400 });
            }
            path = parent.path ? `${parent.path}/${title.trim()}` : title.trim();
        } else {
            path = title.trim();
        }
        
        // 检查路径是否已存在
        const existingPage = zonePageQueries.findByPath(parseInt(id), path);
        if (existingPage) {
            return NextResponse.json({ error: '该路径下已存在同名页面' }, { status: 400 });
        }
        
        const result = zonePageQueries.create(
            parseInt(id),
            parentId,
            title.trim(),
            content,
            path,
            level,
            session.user.id
        );
        
        return NextResponse.json({ 
            message: '创建成功',
            pageId: result.lastInsertRowid,
            path: path
        });
    } catch (error) {
        console.error('Failed to create zone page:', error);
        return NextResponse.json({ error: '创建页面失败' }, { status: 500 });
    }
}
