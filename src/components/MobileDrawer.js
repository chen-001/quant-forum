'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MobileDrawer({ isOpen, onClose, user, onLogout }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const handleItemClick = () => onClose();

    const handleLogoutClick = async () => {
        await onLogout();
        onClose();
    };

    return createPortal(
        <div className="mobile-drawer-container">
            <div className="mobile-drawer-overlay" onClick={onClose} />
            <div className="mobile-drawer">
                <div className="mobile-drawer-header">
                    <span className="mobile-drawer-title">菜单</span>
                    <button onClick={onClose} className="mobile-drawer-close">&times;</button>
                </div>
                <div className="mobile-drawer-content">
                    {user ? (
                        <>
                            <div className="mobile-drawer-user">
                                <span>👤 {user.username}</span>
                            </div>
                            <Link href="/post/new" className="mobile-drawer-item" onClick={handleItemClick}>
                                ✏️ 发帖
                            </Link>
                            <Link href="/favorites" className="mobile-drawer-item" onClick={handleItemClick}>
                                ⭐ 收藏
                            </Link>
                            <Link href="/todos" className="mobile-drawer-item" onClick={handleItemClick}>
                                📋 待办
                            </Link>
                            <Link href="/summaries" className="mobile-drawer-item" onClick={handleItemClick}>
                                📑 摘要
                            </Link>
                            <button onClick={handleLogoutClick} className="mobile-drawer-item mobile-drawer-logout">
                                退出
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="mobile-drawer-item" onClick={handleItemClick}>
                                登录
                            </Link>
                            <Link href="/register" className="mobile-drawer-item" onClick={handleItemClick}>
                                注册
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
