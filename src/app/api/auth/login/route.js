import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { userQueries } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
        }

        // 查找用户
        const user = userQueries.findByUsername(username);
        if (!user) {
            return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
        }

        // 验证密码
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
        }

        // 创建会话
        const session = await getSessionFromCookies(await cookies());
        session.user = {
            id: user.id,
            username: user.username
        };
        await session.save();

        return NextResponse.json({
            message: '登录成功',
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
    }
}
