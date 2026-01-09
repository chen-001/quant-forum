import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';

export async function POST() {
    try {
        const session = await getSessionFromCookies(await cookies());
        session.destroy();

        return NextResponse.json({ message: '已退出登录' });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: '退出失败' }, { status: 500 });
    }
}
