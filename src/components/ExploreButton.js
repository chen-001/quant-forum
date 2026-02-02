'use client';

import { useState } from 'react';
import ExploreModal from './ExploreModal';

export default function ExploreButton({ commentId, commentContent, user }) {
    const [isOpen, setIsOpen] = useState(false);

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
