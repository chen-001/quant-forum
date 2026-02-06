'use client';

import { useState, useEffect } from 'react';
import ExploreModal from './ExploreModal';

export default function ExploreButton({ commentId, commentContent, user, defaultOpen = false, onOpenChange }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // 监听外部 defaultOpen 变化
    useEffect(() => {
        if (defaultOpen) {
            setIsOpen(true);
        }
    }, [defaultOpen]);

    // 监听弹窗状态变化，通知父组件
    useEffect(() => {
        if (onOpenChange) {
            onOpenChange(isOpen);
        }
    }, [isOpen, onOpenChange]);

    if (!user) return null;

    return (
        <>
            <button
                className="comment-action"
                onClick={() => setIsOpen(true)}
                title="探索因子实现"
            >
                <span className="emoji">🔬</span>
                <span className="label desktop-only">探索</span>
            </button>
            {isOpen && (
                <ExploreModal
                    commentId={commentId}
                    commentContent={commentContent}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
