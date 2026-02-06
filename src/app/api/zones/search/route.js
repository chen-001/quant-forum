import { NextResponse } from 'next/server';
import { zonePageQueries } from '@/lib/db';

// 搜索专区内的页面（跨所有层级）
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get('keyword');
        const zoneId = searchParams.get('zoneId');
        
        if (!keyword || keyword.trim() === '') {
            return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });
        }
        
        let results;
        if (zoneId) {
            // 搜索指定专区内的页面
            results = zonePageQueries.searchInZone(parseInt(zoneId), keyword.trim());
        } else {
            // 搜索所有专区的页面
            results = zonePageQueries.searchAllPages(keyword.trim());
        }
        
        return NextResponse.json({ 
            results,
            total: results.length,
            keyword: keyword.trim()
        });
    } catch (error) {
        console.error('Failed to search zone pages:', error);
        return NextResponse.json({ error: '搜索失败' }, { status: 500 });
    }
}
