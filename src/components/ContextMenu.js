'use client';

import { useEffect, useState } from 'react';

export default function ContextMenu({ position, onClose, onFavorite, onTodo, onCopy, user }) {
    const [menuPosition, setMenuPosition] = useState(position);

    useEffect(() => {
        setMenuPosition(position);
    }, [position]);

    useEffect(() => {
        const handleClickOutside = () => onClose();
        const handleScroll = () => onClose();

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    if (!user) return null;

    return (
        <div
            className="context-menu"
            style={{
                position: 'fixed',
                left: `${menuPosition.x}px`,
                top: `${menuPosition.y}px`,
                zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                className="context-menu-item"
                onClick={() => {
                    if (onCopy) onCopy();
                    onClose();
                }}
            >
                📋 复制
            </button>
            <button
                className="context-menu-item"
                onClick={() => {
                    onFavorite();
                    onClose();
                }}
            >
                ⭐ 收藏
            </button>
            <button
                className="context-menu-item"
                onClick={() => {
                    onTodo();
                    onClose();
                }}
            >
                📋 添加到待办
            </button>
        </div>
    );
}
