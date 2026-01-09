import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';

export async function GET() {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (session.user) {
            return NextResponse.json({ user: session.user });
        }

        return NextResponse.json({ user: null });
    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json({ user: null });
    }
}
