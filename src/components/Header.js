'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            setUser(data.user);
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <nav className="navbar">
            <Link href="/" className="navbar-brand">
                🧠 AI因子讨论区
            </Link>

            <div className="navbar-actions">
                {loading ? (
                    <div className="spinner" style={{ width: 20, height: 20 }}></div>
                ) : user ? (
                    <>
                        <Link href="/post/new" className="btn btn-primary">
                            ✏️ 发帖
                        </Link>
                        <Link href="/favorites" className="btn btn-ghost">
                            ⭐ 收藏
                        </Link>
                        <Link href="/todos" className="btn btn-ghost">
                            📋 待办
                        </Link>
                        <div className="user-info">
                            <span>👤 {user.username}</span>
                        </div>
                        <button onClick={handleLogout} className="btn btn-ghost">
                            退出
                        </button>
                    </>
                ) : (
                    <>
                        <Link href="/login" className="btn btn-secondary">
                            登录
                        </Link>
                        <Link href="/register" className="btn btn-primary">
                            注册
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}
