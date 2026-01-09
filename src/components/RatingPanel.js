'use client';

import { useState } from 'react';

const RATING_LABELS = {
    novelty: '另类程度',
    test_effect: '测试效果',
    extensibility: '可扩展程度',
    creativity: '构造新颖程度',
    fun: '想法趣味性',
    completeness: '完善程度'
};

function StarRating({ value, onChange, readonly = false }) {
    const [hoverValue, setHoverValue] = useState(0);

    return (
        <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={`rating-star ${(hoverValue || value) >= star ? 'active' : ''}`}
                    onMouseEnter={() => !readonly && setHoverValue(star)}
                    onMouseLeave={() => !readonly && setHoverValue(0)}
                    onClick={() => !readonly && onChange(star)}
                    style={{ cursor: readonly ? 'default' : 'pointer' }}
                >
                    ★
                </span>
            ))}
        </div>
    );
}

export default function RatingPanel({ postId, averages, userRating, onUpdate }) {
    const [ratings, setRatings] = useState(userRating || {
        novelty: 0,
        test_effect: 0,
        extensibility: 0,
        creativity: 0,
        fun: 0,
        completeness: 0
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleRatingChange = (field, value) => {
        setRatings(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        // 验证所有评分都已填写
        const allFilled = Object.values(ratings).every(v => v > 0);
        if (!allFilled) {
            setMessage('请完成所有评分项');
            return;
        }

        setSubmitting(true);
        setMessage('');

        try {
            const res = await fetch(`/api/posts/${postId}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ratings)
            });

            const data = await res.json();

            if (res.ok) {
                setMessage('评分成功！');
                if (onUpdate) {
                    onUpdate(data.ratings);
                }
            } else {
                setMessage(data.error || '评分失败');
            }
        } catch (error) {
            setMessage('评分失败，请重试');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rating-section">
            <div className="rating-header">
                <h3 className="rating-title">📊 评分区</h3>
                {averages?.rating_count > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        共 {averages.rating_count} 人评分
                    </span>
                )}
            </div>

            <div className="rating-grid">
                {Object.entries(RATING_LABELS).map(([key, label]) => (
                    <div key={key} className="rating-item">
                        <div className="rating-item-label">{label}</div>
                        <StarRating
                            value={ratings[key]}
                            onChange={(value) => handleRatingChange(key, value)}
                        />
                        {averages && averages[`avg_${key}`] > 0 && (
                            <div className="rating-avg">
                                平均: {averages[`avg_${key}`].toFixed(1)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? '提交中...' : '提交评分'}
                </button>
                {message && (
                    <span style={{
                        color: message.includes('成功') ? 'var(--success)' : 'var(--error)',
                        fontSize: '14px'
                    }}>
                        {message}
                    </span>
                )}
            </div>
        </div>
    );
}

// 简化版评分展示（用于帖子列表）
export function RatingBadges({ ratings }) {
    if (!ratings) return null;

    const avgTotal = (
        (ratings.avg_novelty || 0) +
        (ratings.avg_test_effect || 0) +
        (ratings.avg_extensibility || 0) +
        (ratings.avg_creativity || 0) +
        (ratings.avg_fun || 0) +
        (ratings.avg_completeness || 0)
    ) / 6;

    if (avgTotal === 0) {
        return (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                暂无评分
            </div>
        );
    }

    return (
        <div className="post-ratings">
            <div className="rating-badge">
                <span className="rating-label">综合</span>
                <span className="rating-value">{avgTotal.toFixed(1)}</span>
            </div>
            <div className="rating-badge">
                <span className="rating-label">另类</span>
                <span className="rating-value">{(ratings.avg_novelty || 0).toFixed(1)}</span>
            </div>
            <div className="rating-badge">
                <span className="rating-label">效果</span>
                <span className="rating-value">{(ratings.avg_test_effect || 0).toFixed(1)}</span>
            </div>
            <div className="rating-badge">
                <span className="rating-label">新颖</span>
                <span className="rating-value">{(ratings.avg_creativity || 0).toFixed(1)}</span>
            </div>
            <div className="rating-badge">
                <span className="rating-label">趣味</span>
                <span className="rating-value">{(ratings.avg_fun || 0).toFixed(1)}</span>
            </div>
            <div className="rating-badge">
                <span className="rating-label">完善</span>
                <span className="rating-value">{(ratings.avg_completeness || 0).toFixed(1)}</span>
            </div>
        </div>
    );
}
