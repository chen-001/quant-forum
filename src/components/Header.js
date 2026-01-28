'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MobileDrawer from './MobileDrawer';
import ThemeToggle from './ThemeToggle';

export default function Header() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activityCounts, setActivityCounts] = useState({ related: 0, all: 0 });
    const router = useRouter();

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchActivityCounts = async () => {
        try {
            const res = await fetch('/api/activities?stats=1');
            if (!res.ok) return;
            const data = await res.json();
            setActivityCounts({
                related: data.relatedCount || 0,
                all: data.allCount || 0
            });
        } catch (error) {
            console.error('Failed to fetch activity counts:', error);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchActivityCounts();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const handleSeen = () => {
            fetchActivityCounts();
        };
        window.addEventListener('activities:seen', handleSeen);
        return () => window.removeEventListener('activities:seen', handleSeen);
    }, [user]);

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

            <button className="navbar-toggle mobile-only" onClick={() => setIsMenuOpen(true)}>
                ☰
            </button>

            <div className="navbar-actions desktop-only">
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
                        <Link href="/summaries" className="btn btn-ghost">
                            📑 摘要
                        </Link>
                        <ThemeToggle />
                        <div className="user-info">
                            <Link href="/activities" className="btn btn-ghost" onClick={() => {
                                // 点击时立即清零，避免数字残留
                                setActivityCounts({ related: 0, all: 0 });
                            }}>
                                {user.username} {activityCounts.related}|{activityCounts.all}
                            </Link>
                        </div>
                        <button onClick={handleLogout} className="btn btn-ghost">
                            退出
                        </button>
                    </>
                ) : (
                    <>
                        <ThemeToggle />
                        <Link href="/login" className="btn btn-secondary">
                            登录
                        </Link>
                        <Link href="/register" className="btn btn-primary">
                            注册
                        </Link>
                    </>
                )}
            </div>

            <MobileDrawer
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                user={user}
                onLogout={handleLogout}
            />
        </nav>
    );
}
