import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { userQueries } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
        }

        if (username.length < 2 || username.length > 20) {
            return NextResponse.json({ error: '用户名长度应在2-20个字符之间' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: '密码长度至少6个字符' }, { status: 400 });
        }

        // 检查用户名是否已存在
        const existingUser = userQueries.findByUsername(username);
        if (existingUser) {
            return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
        }

        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);

        // 创建用户
        const result = userQueries.create(username, passwordHash);

        return NextResponse.json({
            message: '注册成功',
            userId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }
}
