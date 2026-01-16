'use client';

import { useState, useEffect } from 'react';

export default function UserTransferModal({ isOpen, onClose, onTransfer, currentUserId }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [transferring, setTransferring] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (res.ok) {
                // 过滤掉当前用户
                setUsers(data.users.filter(u => u.id !== currentUserId));
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (targetUserId) => {
        setTransferring(true);
        try {
            await onTransfer(targetUserId);
            onClose();
        } finally {
            setTransferring(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>流转待办</h2>
                    <button onClick={onClose} className="modal-close">×</button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : (
                        <div className="user-list">
                            {users.map(user => (
                                <div
                                    key={user.id}
                                    className="user-item"
                                    onClick={() => !transferring && handleTransfer(user.id)}
                                >
                                    <div className="user-info">
                                        <span className="user-name">{user.username}</span>
                                        <span className="user-stats">
                                            未完成: {user.incomplete_count} | 已完成: {user.completed_count}
                                        </span>
                                    </div>
                                    <button
                                        className="btn btn-sm btn-primary"
                                        disabled={transferring}
                                    >
                                        流转
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
