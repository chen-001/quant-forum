'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

const PAGE_LIMIT = 20;

// 操作类型配置
const ACTION_CONFIG = {
    post_updated: { icon: '📝', label: '更新了帖子正文', color: '#3b82f6', category: 'content' },
    post_link_added: { icon: '🔗', label: '添加了帖子链接', color: '#8b5cf6', category: 'content' },
    comment_created: { icon: '💬', label: '发表了评论', color: '#10b981', category: 'comment' },
    comment_reply_created: { icon: '↩️', label: '回复了评论', color: '#10b981', category: 'comment' },
    comment_liked: { icon: '👍', label: '点赞了评论', color: '#f59e0b', category: 'reaction' },
    comment_doubted: { icon: '❓', label: '质疑了评论', color: '#ef4444', category: 'reaction' },
    post_idea_updated: { icon: '💡', label: '更新了想法区', color: '#f59e0b', category: 'content' },
    post_result_created: { icon: '🏆', label: '新增了成果展示', color: '#ec4899', category: 'content' },
    post_table_updated: { icon: '📊', label: '更新了表格内容', color: '#6366f1', category: 'content' },
    line_comment_created: { icon: '📌', label: '添加了行内评论', color: '#14b8a6', category: 'comment' },
    favorite_added: { icon: '⭐', label: '添加了收藏', color: '#fbbf24', category: 'favorite' },
    favorite_removed: { icon: '🗑️', label: '取消了收藏', color: '#9ca3af', category: 'favorite' },
    todo_added: { icon: '📋', label: '添加了待办', color: '#3b82f6', category: 'todo' },
    todo_removed: { icon: '🗑️', label: '移除了待办', color: '#9ca3af', category: 'todo' },
    todo_completed: { icon: '✅', label: '完成了待办', color: '#10b981', category: 'todo' },
    todo_reopened: { icon: '🔄', label: '重新打开待办', color: '#f59e0b', category: 'todo' },
    todo_note_updated: { icon: '📝', label: '更新了待办说明', color: '#8b5cf6', category: 'todo' },
    todo_transferred: { icon: '↔️', label: '流转了待办', color: '#6366f1', category: 'todo' },
    summary_field_updated: { icon: '✏️', label: '编辑了摘要字段', color: '#ec4899', category: 'summary' },
    summary_batch_updated: { icon: '📑', label: '批量编辑了摘要', color: '#ec4899', category: 'summary' },
    // 探索相关操作类型
    exploration_created: { icon: '🔬', label: '生成了探索方案', color: '#8b5cf6', category: 'exploration' },
    exploration_regenerated: { icon: '🔄', label: '重新生成了探索方案', color: '#6366f1', category: 'exploration' },
    exploration_code_updated: { icon: '💻', label: '修改了探索代码', color: '#10b981', category: 'exploration' },
    exploration_pseudocode_updated: { icon: '📝', label: '修改了伪代码', color: '#f59e0b', category: 'exploration' },
    exploration_code_executed: { icon: '▶️', label: '执行了探索代码', color: '#3b82f6', category: 'exploration' },
    exploration_version_saved: { icon: '💾', label: '保存了代码版本', color: '#ec4899', category: 'exploration' }
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
    });
};

const formatFullDate = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
    });
};

// 获取日期分组标签
const getDateGroup = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (activityDate.getTime() === today.getTime()) {
        return { key: 'today', label: '今天' };
    } else if (activityDate.getTime() === yesterday.getTime()) {
        return { key: 'yesterday', label: '昨天' };
    } else {
        const label = date.toLocaleDateString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            timeZone: 'Asia/Shanghai'
        });
        return { key: activityDate.toISOString(), label };
    }
};

// 获取时间（小时:分钟）
const formatTime = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
    });
};

// 按日期分组活动
const groupActivitiesByDate = (activities) => {
    const groups = [];
    let currentGroup = null;

    activities.forEach(activity => {
        const dateGroup = getDateGroup(activity.created_at);
        if (!currentGroup || currentGroup.key !== dateGroup.key) {
            currentGroup = { ...dateGroup, activities: [] };
            groups.push(currentGroup);
        }
        currentGroup.activities.push(activity);
    });

    return groups;
};

const getActionConfig = (action) => ACTION_CONFIG[action] || { icon: '📌', label: action, color: '#6366f1', category: 'other' };

const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

const stripMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
        .replace(/\[.*?\]\(.*?\)/g, '$1')
        .replace(/[#*`~]/g, '')
        .replace(/\n+/g, ' ')
        .trim();
};

const getActivityContent = (activity) => {
    const { action, meta, comment_content, result_content, summary_main_topic } = activity;

    // 评论类
    if (action.includes('comment')) {
        return comment_content ? stripMarkdown(comment_content) : (meta?.commentPreview || meta?.content || '');
    }

    // 成果展示
    if (action === 'post_result_created') {
        return result_content ? stripMarkdown(result_content) : (meta?.content || '');
    }

    // 想法区更新
    if (action === 'post_idea_updated') {
        return meta?.contentPreview || meta?.content || '';
    }

    // 摘要编辑
    if (action.includes('summary')) {
        if (meta?.field) return `修改字段: ${meta.field}`;
        if (meta?.fields) return `修改字段: ${meta.fields.join(', ')}`;
        if (summary_main_topic) return `主题: ${summary_main_topic}`;
        return '';
    }

    // 待办流转
    if (action === 'todo_transferred') {
        const fromUser = meta?.fromUserName || '未知用户';
        const toUser = meta?.toUserName || '未知用户';
        return `从 ${fromUser} 流转给 ${toUser}`;
    }

    // 待办说明更新
    if (action === 'todo_note_updated') {
        return meta?.note ? stripMarkdown(meta.note) : '';
    }

    // 行内评论
    if (action === 'line_comment_created') {
        return meta?.content || meta?.commentPreview || '';
    }

    // 探索相关操作
    if (action.includes('exploration')) {
        if (action === 'exploration_created') {
            return `生成了 ${meta?.variantCount || 3} 个探索方案: ${meta?.variantNames?.join(', ') || ''}`;
        }
        if (action === 'exploration_regenerated') {
            return `重新生成了 ${meta?.variantCount || 3} 个探索方案: ${meta?.variantNames?.join(', ') || ''}`;
        }
        if (action === 'exploration_code_updated') {
            return `修改了探索代码，涉及 ${meta?.variantCount || 0} 个方案`;
        }
        if (action === 'exploration_pseudocode_updated') {
            return `修改了伪代码: ${meta?.variantName || ''} - ${meta?.description || ''}`;
        }
        if (action === 'exploration_code_executed') {
            return `执行了探索代码: ${meta?.variantName || ''} (${meta?.stockCode || ''} ${meta?.date || ''}) ${meta?.success ? '✅' : '❌'}`;
        }
        if (action === 'exploration_version_saved') {
            return `保存了代码版本: ${meta?.variantName || ''} ${meta?.isImportant ? '⭐' : ''} ${meta?.note || ''}`;
        }
    }

    return meta?.content || meta?.description || '';
};

const getActivityHref = (activity) => {
    if (activity.category === 'summary') {
        return activity.post_id ? `/post/${activity.post_id}` : '/summaries';
    }
    if (activity.category === 'favorites_todos') {
        return activity.action?.startsWith('favorite') ? '/favorites' : '/todos';
    }
    // 探索相关操作，跳转到帖子详情页并定位到评论
    if (activity.category === 'exploration' && activity.post_id) {
        return `/post/${activity.post_id}#comment-${activity.comment_id}`;
    }
    if (activity.post_id) {
        let hash = '';
        if (activity.action?.includes('comment')) hash = '#comments';
        else if (activity.action?.includes('idea')) hash = '#ideas';
        else if (activity.action?.includes('result')) hash = '#results';
        else if (activity.action?.includes('table')) hash = '#table';
        return `/post/${activity.post_id}${hash}`;
    }
    return null;
};

const ActivityCard = ({ activity, isNew }) => {
    const config = getActionConfig(activity.action);
    const content = getActivityContent(activity);
    const href = getActivityHref(activity);
    const router = useRouter();

    const handleClick = () => {
        if (href) {
            router.push(href);
        }
    };

    return (
        <div
            className={`activity-card-wrapper ${href ? 'clickable' : ''}`}
            onClick={handleClick}
            style={{ cursor: href ? 'pointer' : 'default' }}
        >
            <div className={`activity-card ${isNew ? 'is-new' : ''}`}>
                {/* 内容区域 */}
                <div className="activity-card-content">
                    {/* 彩色横条：emoji + 动态内容 */}
                    <div className="activity-header-bar" style={{ backgroundColor: `${config.color}15`, borderLeftColor: config.color }}>
                        <div className="activity-header-left">
                            <span className="activity-header-emoji">{config.icon}</span>
                            <span className="activity-actor">{activity.actor_name || '系统'}</span>
                            <span className="activity-action">{config.label}</span>
                            {activity.related_user_name && (
                                <span className="activity-related">
                                    <span className="activity-related-arrow"> → </span>
                                    <span className="activity-related-user">@{activity.related_user_name}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 帖子行 */}
                    {activity.post_title && (
                        <div className="activity-meta-row">
                            <span className="meta-label post-label">帖子</span>
                            <span className="meta-value post-value">{activity.post_title}</span>
                        </div>
                    )}

                    {/* 内容行 */}
                    {content && (
                        <div className="activity-meta-row">
                            <span className="meta-label content-label">内容</span>
                            <span className="meta-value content-value">{truncateText(content)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function ActivitiesPage() {
    const [scope, setScope] = useState('all');
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [lastSeen, setLastSeen] = useState(null);
    const [filter, setFilter] = useState('all');

    const fetchActivities = async (nextScope = scope, nextOffset = 0, append = false) => {
        setLoading(true);
        try {
            // 1. 先获取最后查看时间（在标记已读之前）
            let currentLastSeen = null;
            try {
                const viewsRes = await fetch('/api/activities?stats=1');
                if (viewsRes.ok) {
                    const viewsData = await viewsRes.json();
                    currentLastSeen = nextScope === 'related' ? viewsData.lastSeenRelated : viewsData.lastSeenAll;
                    setLastSeen(currentLastSeen);
                }
            } catch (e) {
                console.error('Failed to fetch stats:', e);
            }

            // 2. 获取活动列表
            const params = new URLSearchParams({
                scope: nextScope,
                limit: String(PAGE_LIMIT),
                offset: String(nextOffset)
            });
            const res = await fetch(`/api/activities?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setTotal(data.total || 0);
                if (append) {
                    setActivities(prev => [...prev, ...(data.activities || [])]);
                } else {
                    setActivities(data.activities || []);
                }

                // 3. 最后标记为已读
                await fetch('/api/activities/seen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: 'both' })
                });
                window.dispatchEvent(new Event('activities:seen'));
            }
        } catch (error) {
            console.error('Failed to fetch activities:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setOffset(0);
        fetchActivities(scope, 0, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope]);

    const handleLoadMore = () => {
        const nextOffset = offset + PAGE_LIMIT;
        setOffset(nextOffset);
        fetchActivities(scope, nextOffset, true);
    };

    const filteredActivities = useMemo(() =>
        filter === 'all'
            ? activities
            : activities.filter(a => getActionConfig(a.action).category === filter),
        [activities, filter]
    );

    const isActivityNew = (activity) => {
        if (!lastSeen) return false;
        return new Date(activity.created_at) > new Date(lastSeen);
    };

    const filterOptions = [
        { key: 'all', label: '全部', icon: '📋' },
        { key: 'content', label: '内容', icon: '📝' },
        { key: 'comment', label: '评论', icon: '💬' },
        { key: 'todo', label: '待办', icon: '📋' },
        { key: 'favorite', label: '收藏', icon: '⭐' },
        { key: 'summary', label: '摘要', icon: '📑' },
        { key: 'exploration', label: '探索', icon: '🔬' },
    ];

    return (
        <>
            <Header />
            <main className="activities-page">
                <div className="activities-container">
                    <div className="activities-header">
                        <h1 className="activities-title">
                            <span className="activities-title-icon">🔔</span>
                            最新动态
                        </h1>
                        <p className="activities-subtitle">追踪社区的最新活动和更新</p>
                    </div>

                    <div className="activities-scope-tabs">
                        <button
                            className={`scope-tab ${scope === 'all' ? 'active' : ''}`}
                            onClick={() => setScope('all')}
                        >
                            <span className="scope-tab-icon">🌍</span>
                            全站动态
                        </button>
                        <button
                            className={`scope-tab ${scope === 'related' ? 'active' : ''}`}
                            onClick={() => setScope('related')}
                        >
                            <span className="scope-tab-icon">👤</span>
                            与我相关
                        </button>
                    </div>

                    <div className="activities-filter-bar">
                        {filterOptions.map(opt => (
                            <button
                                key={opt.key}
                                className={`filter-btn ${filter === opt.key ? 'active' : ''}`}
                                onClick={() => setFilter(opt.key)}
                            >
                                <span>{opt.icon}</span>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {loading && activities.length === 0 ? (
                        <div className="activities-loading">
                            <div className="spinner"></div>
                            <p>加载动态中...</p>
                        </div>
                    ) : filteredActivities.length === 0 ? (
                        <div className="activities-empty">
                            <div className="activities-empty-icon">📭</div>
                            <p>暂无动态</p>
                            <span>还没有符合条件的活动记录</span>
                        </div>
                    ) : (
                        <div className="activities-timeline-wrapper">
                            {groupActivitiesByDate(filteredActivities).map((group) => (
                                <div key={group.key} className="activity-date-group">
                                    {/* 日期分组头 */}
                                    <div className="activity-group-header">
                                        <div className="group-header-dot"></div>
                                        <span className="activity-group-date">{group.label}</span>
                                        <span className="activity-group-count">{group.activities.length} 条动态</span>
                                    </div>
                                    {/* 该日期下的动态列表 */}
                                    <div className="activity-group-items">
                                        {group.activities.map((activity, index) => (
                                            <div key={activity.id} className="activity-item-row">
                                                <div className="activity-item-timeline">
                                                    <span className="activity-item-time" title={formatFullDate(activity.created_at)}>
                                                        {formatTime(activity.created_at)}
                                                    </span>
                                                    <div className="timeline-connector">
                                                        <div className={`connector-dot ${isActivityNew(activity) ? 'is-new' : ''}`}></div>
                                                        {index < group.activities.length - 1 && (
                                                            <div className="connector-line"></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="activity-item-card">
                                                    <ActivityCard
                                                        activity={activity}
                                                        isNew={isActivityNew(activity)}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activities.length < total && (
                        <div className="activities-load-more">
                            <button
                                className="btn btn-ghost load-more-btn"
                                onClick={handleLoadMore}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner-small"></div>
                                        加载中...
                                    </>
                                ) : (
                                    <>
                                        <span>↓</span>
                                        加载更多 ({activities.length}/{total})
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <style jsx>{`
                .activities-page {
                    min-height: calc(100vh - 5vh);
                    background: var(--bg-primary);
                    padding: var(--spacing-xl) 0;
                }

                .activities-container {
                    max-width: 100%;
                    margin: 0;
                    padding: 0 var(--spacing-xl);
                }

                .activities-header {
                    text-align: center;
                    margin-bottom: var(--spacing-xl);
                }

                .activities-title {
                    font-size: 28px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-sm);
                    background: linear-gradient(135deg, var(--primary), #a78bfa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .activities-title-icon {
                    font-size: 32px;
                    -webkit-text-fill-color: initial;
                }

                .activities-subtitle {
                    color: var(--text-secondary);
                    font-size: 14px;
                }

                .activities-scope-tabs {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-lg);
                    background: var(--bg-secondary);
                    padding: var(--spacing-xs);
                    border-radius: var(--radius-lg);
                }

                .scope-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 14px;
                    font-weight: 500;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all var(--transition);
                }

                .scope-tab:hover {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                .scope-tab.active {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
                }

                .scope-tab-icon {
                    font-size: 16px;
                }

                .activities-filter-bar {
                    display: flex;
                    gap: var(--spacing-xs);
                    margin-bottom: var(--spacing-lg);
                    flex-wrap: wrap;
                    padding: var(--spacing-sm);
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border);
                }

                .filter-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px solid var(--border);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-size: 13px;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all var(--transition);
                }

                .filter-btn:hover {
                    border-color: var(--primary);
                    color: var(--text-primary);
                }

                .filter-btn.active {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: white;
                }

                /* 时间轴包装器 - 水平滚动 */
                .activities-timeline-wrapper {
                    display: flex;
                    gap: var(--spacing-lg);
                    position: relative;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding-bottom: var(--spacing-md);
                    scroll-behavior: smooth;
                    -webkit-overflow-scrolling: touch;
                }

                .activities-timeline-wrapper::-webkit-scrollbar {
                    height: 8px;
                }

                .activities-timeline-wrapper::-webkit-scrollbar-track {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                }

                .activities-timeline-wrapper::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: var(--radius-sm);
                }

                .activities-timeline-wrapper::-webkit-scrollbar-thumb:hover {
                    background: var(--primary);
                }

                /* 左侧时间轴 - 隐藏，改用内联时间显示 */
                .timeline-axis {
                    display: none;
                }

                /* 动态内容区域 */
                .activity-date-group {
                    flex: 0 0 380px;
                    min-width: 380px;
                    max-width: 380px;
                    position: relative;
                }

                .activity-group-header {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                    padding: var(--spacing-sm) var(--spacing-md);
                    position: relative;
                    border-bottom: 2px solid var(--primary);
                }

                .group-header-dot {
                    width: 14px;
                    height: 14px;
                    background: var(--primary);
                    border-radius: 50%;
                    border: 3px solid var(--bg-primary);
                    box-shadow: 0 0 0 2px var(--primary);
                    flex-shrink: 0;
                }

                .activity-group-date {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--primary);
                    background: linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, transparent 100%);
                    padding: 4px 12px;
                    border-radius: var(--radius-sm);
                }

                .activity-group-count {
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .activity-group-items {
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    padding-left: 12px;
                    max-height: calc(100vh - 300px);
                    overflow-y: auto;
                }

                .activity-group-items::-webkit-scrollbar {
                    width: 6px;
                }

                .activity-group-items::-webkit-scrollbar-track {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-sm);
                }

                .activity-group-items::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: var(--radius-sm);
                }

                /* 时间轴竖线 - 贯穿整个分组 */
                .activity-group-items::before {
                    content: '';
                    position: absolute;
                    left: 12px;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: linear-gradient(to bottom, var(--primary), var(--border));
                    opacity: 0.3;
                }

                .activity-item-row {
                    display: flex;
                    align-items: flex-start;
                    position: relative;
                    padding-bottom: var(--spacing-md);
                    min-width: 0;
                }

                .activity-item-timeline {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--spacing-sm);
                    flex-shrink: 0;
                    padding-top: 12px;
                }

                .activity-item-time {
                    width: 45px;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }

                .timeline-connector {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    z-index: 1;
                }

                .connector-dot {
                    width: 10px;
                    height: 10px;
                    background: var(--bg-card);
                    border: 2px solid var(--border);
                    border-radius: 50%;
                    flex-shrink: 0;
                    transition: all var(--transition);
                }

                .connector-dot.is-new {
                    background: var(--primary);
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
                }

                .connector-line {
                    width: 2px;
                    height: 100%;
                    min-height: 30px;
                    background: var(--border);
                    opacity: 0.3;
                    position: absolute;
                    top: 10px;
                }

                .activity-item-card {
                    flex: 1;
                    min-width: 0;
                    margin-left: var(--spacing-md);
                }

                .activity-card-wrapper {
                    display: block;
                    transition: all var(--transition);
                }

                .activity-card-wrapper.clickable:hover {
                    transform: translateX(4px);
                }

                .activity-card-wrapper.clickable:hover .activity-card {
                    border-color: var(--border-light);
                    box-shadow: var(--shadow-md);
                }

                .activity-card {
                    display: flex;
                    gap: var(--spacing-md);
                    padding: var(--spacing-md);
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-left: 3px solid transparent;
                    border-radius: var(--radius-lg);
                    transition: all var(--transition);
                    position: relative;
                }

                .activity-card.is-new {
                    border-left-color: var(--primary);
                    background: linear-gradient(90deg, rgba(99, 102, 241, 0.05) 0%, var(--bg-card) 100%);
                }

                .activity-card.is-new + .activity-item-connector .connector-dot {
                    background: var(--primary);
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
                }

                .activity-card-content {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                /* 彩色横条：emoji + 动态内容 + 时间 */
                .activity-header-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--spacing-md);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-md);
                    border-left: 4px solid;
                    font-size: 14px;
                    flex-wrap: nowrap;
                }

                .activity-header-left {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    flex-wrap: nowrap;
                    min-width: 0;
                    overflow: hidden;
                }

                .activity-header-left span {
                    flex-shrink: 0;
                }

                .activity-header-left .activity-related-user {
                    flex-shrink: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .activity-header-emoji {
                    font-size: 16px;
                    margin-right: 2px;
                }

                .activity-actor {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .activity-action {
                    color: var(--text-secondary);
                }

                .activity-related {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                }

                .activity-related-arrow {
                    color: var(--text-muted);
                    font-size: 12px;
                }

                .activity-related-user {
                    color: var(--primary);
                    font-weight: 500;
                }

                /* 帖子行和内容行 */
                .activity-meta-row {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-xs) 0;
                }

                :global(.meta-label) {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 3px 8px;
                    border-radius: var(--radius-sm);
                    font-size: 12px;
                    font-weight: 500;
                    flex-shrink: 0;
                    height: 22px;
                    box-sizing: border-box;
                }

                :global(.post-label) {
                    color: #d35400;
                    background: #ffccbc;
                    border: 1px solid #ffab91;
                }

                :global(.content-label) {
                    color: #d35400;
                    background: #ffccbc;
                    border: 1px solid #ffab91;
                }

                .meta-value {
                    flex: 1;
                    min-width: 0;
                    line-height: 1.5;
                }

                .post-value {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .content-value {
                    font-size: 14px;
                    color: var(--text-secondary);
                }

                .activities-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-xl);
                    gap: var(--spacing-md);
                    color: var(--text-secondary);
                }

                .activities-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-xl) * 2;
                    text-align: center;
                }

                .activities-empty-icon {
                    font-size: 64px;
                    opacity: 0.5;
                    margin-bottom: var(--spacing-md);
                }

                .activities-empty p {
                    font-size: 18px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-xs);
                }

                .activities-empty span {
                    font-size: 13px;
                    color: var(--text-muted);
                }

                .activities-load-more {
                    display: flex;
                    justify-content: center;
                    margin-top: var(--spacing-xl);
                }

                .load-more-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-lg);
                }

                .spinner-small {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--border);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 768px) {
                    .activities-container {
                        padding: 0 var(--spacing-md);
                    }

                    .activities-title {
                        font-size: 24px;
                    }

                    .activity-date-group {
                        flex: 0 0 320px;
                        min-width: 320px;
                        max-width: 320px;
                    }

                    .activity-group-header {
                        padding: var(--spacing-sm);
                    }

                    .group-header-dot {
                        width: 12px;
                        height: 12px;
                    }

                    .activity-group-items {
                        padding-left: 10px;
                        max-height: calc(100vh - 250px);
                    }

                    .activity-group-items::before {
                        left: 10px;
                    }

                    .activity-item-time {
                        width: 36px;
                        font-size: 11px;
                    }

                    .connector-dot {
                        width: 8px;
                        height: 8px;
                    }

                    .activity-card {
                        padding: var(--spacing-sm);
                    }

                    .activity-header-bar {
                        gap: var(--spacing-sm);
                        padding: var(--spacing-sm);
                    }

                    .activity-header-left {
                        font-size: 13px;
                        flex-wrap: wrap;
                    }

                    .activity-header-left span {
                        flex-shrink: 0;
                    }

                    .activity-related-user {
                        font-size: 12px;
                    }

                    .meta-label {
                        font-size: 10px;
                    }

                    .post-value {
                        font-size: 14px;
                    }

                    .content-value {
                        font-size: 13px;
                    }

                    .activities-filter-bar {
                        overflow-x: auto;
                        flex-wrap: nowrap;
                        -webkit-overflow-scrolling: touch;
                    }

                    .filter-btn {
                        white-space: nowrap;
                    }

                    .activity-group-date {
                        font-size: 13px;
                        padding: 3px 8px;
                    }
                }
            `}</style>
        </>
    );
}
