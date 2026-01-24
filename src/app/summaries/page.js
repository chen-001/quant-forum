'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Header from '@/components/Header';
import Link from 'next/link';

export default function SummariesPage() {
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editFactors, setEditFactors] = useState([]);
    const [editConcepts, setEditConcepts] = useState([]);
    const [conceptInput, setConceptInput] = useState('');
    const [regenerating, setRegenerating] = useState({});
    const [schedule, setSchedule] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
    const [logOffset, setLogOffset] = useState(0);
    const [logHasMore, setLogHasMore] = useState(true);
    const [logLoading, setLogLoading] = useState(false);
    const conceptInputRef = useRef(null);

    useEffect(() => {
        fetchSummaries();
    }, []);

    useEffect(() => {
        if (logsDrawerOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [logsDrawerOpen]);

    const fetchSummaries = async (searchKeyword = '') => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchKeyword) params.append('keyword', searchKeyword);

        const res = await fetch(`/api/summaries?${params}`);
        const data = await res.json();
        if (res.ok) {
            setSummaries(data.summaries || []);
            setSchedule(data.schedule || null);
            const logs = data.recent_logs || [];
            setRecentLogs(logs);
            setLogOffset(logs.length);
            setLogHasMore(logs.length >= 100);
        }
        setLoading(false);
    };

    const fetchMoreLogs = async () => {
        if (logLoading || !logHasMore) return;
        setLogLoading(true);

        const res = await fetch(`/api/summaries/logs?offset=${logOffset}&limit=100`);
        const data = await res.json();
        if (res.ok) {
            const logs = data.logs || [];
            setRecentLogs(prev => [...prev, ...logs]);
            setLogOffset(prev => prev + logs.length);
            if (logs.length < 100) setLogHasMore(false);
        }
        setLogLoading(false);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchSummaries(keyword);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr + 'Z');
        return date.toLocaleDateString('zh-CN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr + 'Z');
        return date.toLocaleString('zh-CN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
    };

    const getLogTime = (log) => log?.finished_at || log?.started_at || log?.created_at;

    const parseJSON = (str) => {
        try { return JSON.parse(str || '[]'); }
        catch { return []; }
    };

    const normalizeFactors = (factorsStr) => {
        const factors = parseJSON(factorsStr);
        if (!Array.isArray(factors)) return [];
        return factors.map(factor => {
            if (typeof factor === 'string') {
                return { name: factor, description: '' };
            }
            return {
                name: factor?.name ? String(factor.name) : '',
                description: factor?.description ? String(factor.description) : ''
            };
        });
    };

    const renderFactorsValue = (factorsStr) => {
        const factors = normalizeFactors(factorsStr).filter(f => f.name || f.description);
        if (!factors.length) return '无';
        return (
            <div className="factors-list">
                {factors.map((factor, index) => (
                    <div key={`${factor.name}-${index}`} className="factor-card">
                        <div className="factor-header">
                            <span className="factor-index">#{index + 1}</span>
                            <span className="factor-badge">{factor.name || '未命名因子'}</span>
                        </div>
                        <div className={`factor-desc ${factor.description ? '' : 'muted'}`}>
                            {factor.description || '暂无描述'}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const formatConcepts = (conceptsStr) => {
        const concepts = parseJSON(conceptsStr);
        if (!concepts.length) return '无';
        return concepts.join(', ');
    };

    const startEdit = (postId, field, currentValue) => {
        setEditingField({ postId, field });
        if (field === 'factors') {
            const normalized = normalizeFactors(currentValue || '[]');
            setEditFactors(normalized.length ? normalized : [{ name: '', description: '' }]);
        } else if (field === 'key_concepts') {
            const concepts = parseJSON(currentValue || '[]');
            setEditConcepts(Array.isArray(concepts) ? concepts : []);
            setConceptInput('');
        } else {
            setEditValue(currentValue || '');
        }
    };

    const cancelEdit = () => {
        setEditingField(null);
        setEditValue('');
        setEditFactors([]);
        setEditConcepts([]);
        setConceptInput('');
    };

    const addConcept = () => {
        const trimmed = conceptInput.trim();
        if (trimmed && !editConcepts.includes(trimmed)) {
            setEditConcepts(prev => [...prev, trimmed]);
            setConceptInput('');
            conceptInputRef.current?.focus();
        }
    };

    const removeConcept = (index) => {
        setEditConcepts(prev => prev.filter((_, i) => i !== index));
    };

    const handleConceptKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addConcept();
        } else if (e.key === 'Backspace' && !conceptInput && editConcepts.length > 0) {
            removeConcept(editConcepts.length - 1);
        }
    };

    const saveEdit = async () => {
        if (!editingField) return;
        const { postId, field } = editingField;
        let valueToSave = editValue;
        if (field === 'factors') {
            const cleaned = editFactors
                .map(item => ({
                    name: item.name.trim(),
                    description: item.description.trim()
                }))
                .filter(item => item.name);
            valueToSave = JSON.stringify(cleaned);
        } else if (field === 'key_concepts') {
            valueToSave = JSON.stringify(editConcepts);
        }

        const res = await fetch(`/api/summaries/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field: `user_${field}`, value: valueToSave })
        });

        if (res.ok) {
            setSummaries(prev => prev.map(s => {
                if (s.post_id === postId) {
                    return {
                        ...s,
                        [`user_${field}`]: valueToSave,
                        [`effective_${field}`]: valueToSave,
                        has_user_edit: true
                    };
                }
                return s;
            }));
            cancelEdit();
        }
    };

    const clearUserEdit = async (postId, field = null) => {
        const msg = field ? `确定要清除"${getFieldLabel(field)}"的用户编辑吗？` : '确定要清除所有用户编辑吗？';
        if (!confirm(msg)) return;

        const url = field ? `/api/summaries/${postId}?field=user_${field}` : `/api/summaries/${postId}`;
        const res = await fetch(url, { method: 'DELETE' });

        if (res.ok) {
            setSummaries(prev => prev.map(s => {
                if (s.post_id === postId) {
                    if (field) {
                        const updated = { ...s, [`user_${field}`]: null, [`effective_${field}`]: s[field] };
                        const supplementField = { factors: 'ai_supplement_factors', key_concepts: 'ai_supplement_concepts', summary: 'ai_supplement_summary' }[field];
                        if (supplementField) updated[supplementField] = null;
                        updated.has_user_edit = updated.user_main_topic !== null || updated.user_main_logic !== null || updated.user_factors !== null || updated.user_key_concepts !== null || updated.user_summary !== null;
                        updated.has_supplement = updated.ai_supplement_factors !== null || updated.ai_supplement_concepts !== null || updated.ai_supplement_summary !== null;
                        return updated;
                    } else {
                        return {
                            ...s,
                            user_main_topic: null, user_main_logic: null, user_factors: null, user_key_concepts: null, user_summary: null,
                            ai_supplement_factors: null, ai_supplement_concepts: null, ai_supplement_summary: null,
                            effective_main_topic: s.main_topic, effective_main_logic: s.main_logic, effective_factors: s.factors,
                            effective_key_concepts: s.key_concepts, effective_summary: s.summary,
                            has_user_edit: false, has_supplement: false
                        };
                    }
                }
                return s;
            }));
        }
    };

    const regenerateSummary = async (postId, clearUserEdits = false) => {
        setRegenerating(prev => ({ ...prev, [postId]: true }));

        const res = await fetch(`/api/summaries/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clearUserEdits, forceFullUpdate: true })
        });

        if (res.ok) {
            await fetchSummaries(keyword);
        }
        setRegenerating(prev => ({ ...prev, [postId]: false }));
    };

    const getFieldLabel = (field) => ({
        main_topic: '主题', main_logic: '逻辑', factors: '因子', key_concepts: '概念', summary: '摘要'
    }[field] || field);

    const renderFieldActions = (summary, field, className = 'field-actions') => {
        const userField = `user_${field}`;
        const userValue = summary[userField];
        const aiValue = summary[field];
        const hasUserValue = userValue !== null && userValue !== undefined;

        return (
            <div className={className}>
                <button className="btn-icon" onClick={() => startEdit(summary.post_id, field, userValue ?? aiValue)} title="编辑">
                    ✏️
                </button>
                {hasUserValue && (
                    <button className="btn-icon" onClick={() => clearUserEdit(summary.post_id, field)} title="清除用户编辑">
                        🗑️
                    </button>
                )}
            </div>
        );
    };

    const renderFieldValue = (summary, field, options = {}) => {
        const userField = `user_${field}`;
        const effectiveField = `effective_${field}`;
        const supplementField = { factors: 'ai_supplement_factors', key_concepts: 'ai_supplement_concepts', summary: 'ai_supplement_summary' }[field];

        const userValue = summary[userField];
        const aiValue = summary[field];
        const effectiveValue = summary[effectiveField];
        const supplementValue = supplementField ? summary[supplementField] : null;

        const renderValue = (val) => {
            if (field === 'factors') return renderFactorsValue(val);
            if (field === 'key_concepts') return formatConcepts(val);
            return val ?? '无';
        };

        const hasUserValue = userValue !== null && userValue !== undefined;
        const hideOriginal = field === 'summary';
        const hideSupplement = field === 'summary';
        const isEditing = editingField?.postId === summary.post_id && editingField?.field === field;

        if (isEditing) {
            if (field === 'factors') {
                return (
                    <div className="factors-edit-overlay" onClick={cancelEdit}>
                        <div className="factors-edit-modal" onClick={e => e.stopPropagation()}>
                            <div className="factors-modal-header">
                                <div className="factors-modal-title">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                    </svg>
                                    <span>编辑量化因子</span>
                                </div>
                                <p className="factors-modal-hint">为帖子添加或修改量化因子及其详细描述</p>
                            </div>

                            <div className="factors-modal-body">
                                {editFactors.length === 0 ? (
                                    <div className="factors-empty-state">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M12 5v14M5 12h14"/>
                                        </svg>
                                        <p>暂无因子，点击下方按钮添加</p>
                                    </div>
                                ) : (
                                    <div className="factors-card-list">
                                        {editFactors.map((factor, index) => (
                                            <div key={`factor-${index}`} className="factor-edit-card-new">
                                                <div className="factor-card-header-new">
                                                    <div className="factor-number-badge">
                                                        <span className="factor-num">{index + 1}</span>
                                                    </div>
                                                    <div className="factor-card-title">因子 {index + 1}</div>
                                                    <button
                                                        type="button"
                                                        className="factor-delete-btn-new"
                                                        onClick={() => {
                                                            if (editFactors.length === 1) {
                                                                 setEditFactors([{ name: '', description: '' }]);
                                                            } else {
                                                                 setEditFactors(prev => prev.filter((_, idx) => idx !== index));
                                                            }
                                                        }}
                                                        title="删除此因子"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                                        </svg>
                                                    </button>
                                                </div>

                                                <div className="factor-card-body-new">
                                                    <div className="factor-input-group">
                                                        <label className="factor-input-label">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M20 6L9 17l-5-5"/>
                                                            </svg>
                                                            因子名称
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={factor.name}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setEditFactors(prev => prev.map((item, idx) => idx === index ? { ...item, name: value } : item));
                                                            }}
                                                            placeholder="例如：动量因子、波动率因子、市盈率因子"
                                                            className="factor-name-input-new"
                                                        />
                                                    </div>

                                                    <div className="factor-input-group">
                                                        <label className="factor-input-label">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                                                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                                                            </svg>
                                                            因子描述
                                                        </label>
                                                        <textarea
                                                            value={factor.description}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setEditFactors(prev => prev.map((item, idx) => idx === index ? { ...item, description: value } : item));
                                                            }}
                                                            placeholder="详细描述该因子的计算方式、使用场景、策略逻辑、投资意义等..."
                                                            className="factor-desc-input-new"
                                                            rows={4}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="factors-modal-footer">
                                <button
                                    type="button"
                                    className="factor-add-btn-new"
                                    onClick={() => setEditFactors(prev => [...prev, { name: '', description: '' }])}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                    添加新因子
                                </button>

                                <div className="factors-modal-actions">
                                    <button className="btn-cancel-new" onClick={cancelEdit}>
                                        取消
                                    </button>
                                    <button className="btn-save-new" onClick={saveEdit}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                        保存更改
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            if (field === 'key_concepts') {
                return (
                    <div className="concepts-edit-overlay" onClick={cancelEdit}>
                        <div className="concepts-edit-modal" onClick={e => e.stopPropagation()}>
                            <div className="concepts-modal-header">
                                <div className="concepts-modal-title">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                                    </svg>
                                    <span>编辑概念标签</span>
                                </div>
                                <p className="concepts-modal-hint">为帖子添加相关的量化投资概念标签，便于分类和检索</p>
                            </div>

                            <div className="concepts-modal-body">
                                <div className="concepts-input-section">
                                    <label className="concepts-input-label">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8"/>
                                            <path d="M21 21l-4.35-4.35"/>
                                        </svg>
                                        添加新概念
                                    </label>
                                    <div className="concepts-input-wrapper">
                                        <input
                                            ref={conceptInputRef}
                                            type="text"
                                            value={conceptInput}
                                            onChange={(e) => setConceptInput(e.target.value)}
                                            onKeyDown={handleConceptKeyDown}
                                            placeholder="输入概念名称，按回车添加..."
                                            className="concepts-input-new"
                                        />
                                        <button
                                            type="button"
                                            className="concepts-add-btn-new"
                                            onClick={addConcept}
                                            disabled={!conceptInput.trim()}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 5v14M5 12h14"/>
                                            </svg>
                                            添加
                                        </button>
                                    </div>
                                </div>

                                <div className="concepts-tags-section">
                                    <label className="concepts-tags-label">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                                            <circle cx="7" cy="7" r="1"/>
                                        </svg>
                                        已添加的概念 ({editConcepts.length})
                                    </label>

                                    {editConcepts.length === 0 ? (
                                        <div className="concepts-empty-tags">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                                            </svg>
                                            <p>暂无概念，请在上方输入添加</p>
                                        </div>
                                    ) : (
                                        <div className="concepts-tags-grid">
                                            {editConcepts.map((concept, index) => (
                                                <div key={`concept-${index}`} className="concept-tag-new">
                                                    <span className="concept-tag-text">{concept}</span>
                                                    <button
                                                        type="button"
                                                        className="concept-tag-remove-new"
                                                        onClick={() => removeConcept(index)}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M18 6L6 18M6 6l12 12"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="concepts-quick-section">
                                    <div className="concepts-quick-header">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                        </svg>
                                        快捷添加常用概念
                                    </div>
                                    <div className="concepts-quick-tags">
                                        {['量化', '因子', '策略', '回测', '机器学习', '风控', '因子挖掘', '多因子', '选股', '择时'].filter(c => !editConcepts.includes(c)).map(concept => (
                                            <button
                                                key={concept}
                                                type="button"
                                                className="concepts-quick-btn"
                                                onClick={() => setEditConcepts(prev => [...prev, concept])}
                                            >
                                                + {concept}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="concepts-modal-footer">
                                <button className="btn-cancel-new" onClick={cancelEdit}>
                                    取消
                                </button>
                                <button className="btn-save-new" onClick={saveEdit}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5"/>
                                    </svg>
                                    保存更改
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }
            return (
                <div className="edit-field">
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={field === 'summary' || field === 'main_logic' ? 4 : 2}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveEdit}>保存</button>
                        <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>取消</button>
                    </div>
                </div>
            );
        }

        const showActions = options.showActions !== false;

        return (
            <div className="field-display">
                <div className="effective-value">
                    {hasUserValue ? (
                        <div className="user-edited">
                            {renderValue(effectiveValue)}
                            {!hideSupplement && supplementValue && (
                                field === 'factors' ? (
                                    <div className="ai-supplement">[AI补充: {renderValue(supplementValue)}]</div>
                                ) : (
                                    <span className="ai-supplement"> [AI补充: {renderValue(supplementValue)}]</span>
                                )
                            )}
                        </div>
                    ) : (
                        <div>{renderValue(effectiveValue)}</div>
                    )}
                </div>
                {showActions && renderFieldActions(summary, field)}
            </div>
        );
    };

    return (
        <>
            <Header />
            <main className="container">
                <div className="summaries-page">
                    <div className="summaries-header">
                        <h1>📋 帖子摘要管理</h1>
                        <form onSubmit={handleSearch} className="search-form">
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="搜索摘要..."
                                className="search-input"
                            />
                            <button type="submit" className="btn btn-primary">搜索</button>
                        </form>
                    </div>

                    <div className="summary-schedule">
                        <div className="schedule-item">
                            <span className="schedule-label">上次AI生成摘要</span>
                            <span className="schedule-value">{formatDateTime(schedule?.last_run_at)}</span>
                        </div>
                        <div className="schedule-item">
                            <span className="schedule-label">下次摘要生成</span>
                            <span className="schedule-value">{formatDateTime(schedule?.next_run_at)}</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setLogsDrawerOpen(true)}
                        >
                            查看详情
                        </button>
                    </div>

                    {logsDrawerOpen && createPortal(
                        <div className="logs-drawer-container">
                            <div className="logs-drawer-overlay" onClick={() => setLogsDrawerOpen(false)} />
                            <div className="logs-drawer">
                                <div className="logs-drawer-header">
                                    <span className="logs-drawer-title">最近修改记录</span>
                                    <button
                                        type="button"
                                        className="logs-drawer-close"
                                        onClick={() => setLogsDrawerOpen(false)}
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="logs-drawer-content">
                                    <div className="summary-logs">
                                        {recentLogs.length === 0 ? (
                                            <div className="empty-state"><p>暂无摘要生成记录</p></div>
                                        ) : (
                                            <div className="log-list">
                                                {recentLogs.map(log => (
                                                    <div key={log.id} className="log-item">
                                                        <div className="log-time">{formatDateTime(getLogTime(log))}</div>
                                                        <div className="log-main">
                                                            <span className={`log-tag ${log.trigger_type === 'manual' ? 'tag-manual' : 'tag-auto'}`}>
                                                                {log.trigger_type === 'manual' ? '手动' : '自动'}
                                                            </span>
                                                            <span className="log-tag tag-scope">{log.scope === 'single' ? '单帖' : '批量'}</span>
                                                            <span className="log-tag tag-type">{log.summary_type}</span>
                                                            <span className={`log-tag ${log.status === 'success' ? 'tag-success' : log.status === 'failed' ? 'tag-failed' : 'tag-skipped'}`}>
                                                                {log.status}
                                                            </span>
                                                            {log.post_title && <span className="log-title">{log.post_title}</span>}
                                                        </div>
                                                        <div className="log-note">{log.note || '-'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {recentLogs.length > 0 && (
                                            <div className="log-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={fetchMoreLogs}
                                                    disabled={!logHasMore || logLoading}
                                                >
                                                    {logLoading ? '加载中...' : logHasMore ? '加载更多' : '没有更多了'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : summaries.length === 0 ? (
                        <div className="empty-state"><p>暂无摘要数据</p></div>
                    ) : (
                        <div className="summaries-list">
                            {summaries.map(summary => (
                                <div key={summary.post_id} className={`summary-card ${summary.has_user_edit ? 'has-user-edit' : ''}`}>
                                    <div className="summary-header" onClick={() => setExpandedId(expandedId === summary.post_id ? null : summary.post_id)}>
                                        <div className="summary-title-row">
                                            <Link href={`/post/${summary.post_id}`} className="post-link" onClick={(e) => e.stopPropagation()}>
                                                📄 {summary.post_title}
                                            </Link>
                                            <div className="summary-badges">
                                                {summary.has_user_edit && <span className="badge badge-user">用户编辑</span>}
                                                {summary.has_supplement && <span className="badge badge-supplement">AI补充</span>}
                                            </div>
                                        </div>
                                        <div className="summary-meta">
                                            <span>作者: {summary.author_name}</span>
                                            <span>更新: {formatDate(summary.updated_at)}</span>
                                            <span className="expand-icon">{expandedId === summary.post_id ? '▼' : '▶'}</span>
                                        </div>
                                    </div>

                                    {expandedId === summary.post_id && (
                                        <div className="summary-content">
                                            <div className="summary-field">
                                                <label>
                                                    主题:
                                                    {renderFieldActions(summary, 'main_topic', 'label-actions')}
                                                </label>
                                                {renderFieldValue(summary, 'main_topic', { showActions: false })}
                                            </div>
                                            <div className="summary-field">
                                                <label>
                                                    逻辑:
                                                    {renderFieldActions(summary, 'main_logic', 'label-actions')}
                                                </label>
                                                {renderFieldValue(summary, 'main_logic', { showActions: false })}
                                            </div>
                                            <div className="summary-field">
                                                <label>
                                                    因子:
                                                    {renderFieldActions(summary, 'factors', 'label-actions')}
                                                </label>
                                                {renderFieldValue(summary, 'factors', { showActions: false })}
                                            </div>
                                            <div className="summary-field">
                                                <label>
                                                    概念:
                                                    {renderFieldActions(summary, 'key_concepts', 'label-actions')}
                                                </label>
                                                {renderFieldValue(summary, 'key_concepts', { showActions: false })}
                                            </div>
                                            <div className="summary-field">
                                                <label>
                                                    摘要:
                                                    {renderFieldActions(summary, 'summary', 'label-actions')}
                                                </label>
                                                {renderFieldValue(summary, 'summary', { showActions: false })}
                                            </div>

                                            <div className="summary-actions">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => regenerateSummary(summary.post_id, false)}
                                                    disabled={regenerating[summary.post_id]}
                                                >
                                                    {regenerating[summary.post_id] ? '生成中...' : '重新生成'}
                                                </button>
                                                {summary.has_user_edit && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => clearUserEdit(summary.post_id)}
                                                    >
                                                        清除所有用户编辑
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <style>{`
                /* ==================== 基础布局 ==================== */
                .summaries-page { padding: 20px 0; }
                .summaries-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
                .summaries-header h1 { margin: 0; font-size: 1.5rem; }
                .search-form { display: flex; gap: 8px; }
                .search-input { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; min-width: 200px; }
                .summary-schedule { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card, var(--card-bg, #111)); margin-bottom: 16px; flex-wrap: wrap; }
                .schedule-item { display: flex; flex-direction: column; gap: 4px; }
                .schedule-label { font-size: 12px; color: var(--text-secondary); }
                .schedule-value { font-size: 14px; font-weight: 500; }
                .summary-logs { border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); margin-bottom: 20px; padding: 12px 16px; }
                .logs-drawer-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10001;
                }
                .logs-drawer-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.45);
                    animation: fadeIn 0.2s ease;
                }
                .logs-drawer {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 60vw;
                    max-width: 95vw;
                    background: var(--bg-card);
                    border-left: 1px solid var(--border-color);
                    box-shadow: var(--shadow-lg);
                    display: flex;
                    flex-direction: column;
                    animation: slideInRight 0.25s ease;
                }
                .logs-drawer-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px;
                    border-bottom: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                }
                .logs-drawer-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .logs-drawer-close {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 24px;
                    line-height: 1;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .logs-drawer-close:hover {
                    background: var(--hover-bg);
                    color: var(--text-primary);
                }
                .logs-drawer-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px 16px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .log-list { display: flex; flex-direction: column; gap: 10px; }
                .log-item { display: grid; grid-template-columns: 180px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px dashed var(--border-color); }
                .log-item:last-child { border-bottom: none; }
                .log-time { font-size: 13px; color: var(--text-secondary); }
                .log-main { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
                .log-tag { font-size: 12px; padding: 2px 6px; border-radius: 4px; background: var(--bg-secondary); color: var(--text-secondary); }
                .tag-manual { background: #FFF3E0; color: #E65100; }
                .tag-auto { background: #E3F2FD; color: #1565C0; }
                .tag-success { background: #E8F5E9; color: #2E7D32; }
                .tag-failed { background: #FFEBEE; color: #C62828; }
                .tag-skipped { background: #F3E5F5; color: #6A1B9A; }
                .tag-scope { background: #F5F5F5; }
                .tag-type { background: #ECEFF1; }
                .log-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
                .log-note { grid-column: 2 / -1; font-size: 13px; color: var(--text-secondary); }
                .log-actions { display: flex; justify-content: center; padding-top: 12px; }
                .summaries-list { display: flex; flex-direction: column; gap: 12px; }
                .summary-card { border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); overflow: hidden; }
                .summary-card.has-user-edit { border-left: 3px solid #4CAF50; }
                .summary-header { padding: 16px; cursor: pointer; transition: background 0.2s; }
                .summary-header:hover { background: var(--hover-bg); }
                .summary-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .post-link { color: var(--text-primary); text-decoration: none; font-weight: 500; }
                .post-link:hover { text-decoration: underline; }
                .summary-badges { display: flex; gap: 6px; }
                .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
                .badge-user { background: #E8F5E9; color: #2E7D32; }
                .badge-supplement { background: #E3F2FD; color: #1565C0; }
                .summary-meta { display: flex; gap: 16px; color: var(--text-secondary); font-size: 14px; }
                .expand-icon { margin-left: auto; }
                .summary-content { padding: 16px; border-top: 1px solid var(--border-color); }
                .summary-field { margin-bottom: 20px; padding: 12px 16px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid var(--primary-color, #2196F3); }
                .summary-field label { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; }
                .field-display { position: relative; }
                .effective-value { padding: 10px 12px; background: var(--card-bg); border-radius: 6px; border: 1px solid var(--border-color); line-height: 1.6; }
                .user-edited { color: #2E7D32; }
                .ai-supplement { color: #1565C0; font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color); }
                .field-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
                .label-actions { display: inline-flex; gap: 4px; }
                .label-actions .btn-icon { padding: 4px 6px; font-size: 12px; }
                .field-display:hover .field-actions { opacity: 1; }
                .btn-icon { background: var(--card-bg); border: 1px solid var(--border-color); cursor: pointer; padding: 6px 8px; font-size: 14px; border-radius: 6px; transition: all 0.2s; }
                .btn-icon:hover { background: var(--hover-bg); transform: scale(1.05); }
                .summary-actions { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 8px; }
                .edit-field textarea { font-family: inherit; font-size: 14px; resize: vertical; }
                .factors-list { display: flex; flex-direction: column; gap: 12px; }
                .factor-card {
                    padding: 14px 16px;
                    border-radius: 12px;
                    border: none;
                    border-left: 4px solid #4CAF50;
                    background: linear-gradient(135deg, rgba(76, 175, 80, 0.08), rgba(33, 150, 243, 0.05));
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                    transition: all 0.2s;
                }
                .factor-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    transform: translateY(-1px);
                }
                .factor-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
                .factor-index {
                    font-size: 11px;
                    font-weight: 600;
                    color: #fff;
                    background: linear-gradient(135deg, #4CAF50, #2E7D32);
                    border-radius: 999px;
                    padding: 3px 10px;
                    min-width: 28px;
                    text-align: center;
                }
                .factor-badge {
                    font-size: 15px;
                    font-weight: 600;
                    color: #1B5E20;
                    background: rgba(76, 175, 80, 0.15);
                    border: 1px solid rgba(76, 175, 80, 0.3);
                    padding: 5px 12px;
                    border-radius: 8px;
                }
                .factor-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.6; padding-left: 4px; }
                .factor-desc.muted { color: var(--text-muted); font-style: italic; }
                .empty-state { text-align: center; padding: 40px; color: var(--text-secondary); }
                .loading { display: flex; justify-content: center; padding: 40px; }
                .spinner { width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ==================== 因子编辑模态框 ==================== */
                .factors-edit-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 15, 26, 0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); } 50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.5); } }

                .factors-edit-modal {
                    background: linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%);
                    border-radius: 24px;
                    width: 100%;
                    max-width: 700px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow:
                        0 25px 80px rgba(0, 0, 0, 0.5),
                        0 0 0 1px rgba(99, 102, 241, 0.15),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

                .factors-modal-header {
                    padding: 28px 32px;
                    background:
                        linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 50%, rgba(99, 102, 241, 0.1) 100%),
                        linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
                    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
                    position: relative;
                    overflow: hidden;
                }

                .factors-modal-header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -20%;
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
                    animation: float 6s ease-in-out infinite;
                }

                .factors-modal-header::after {
                    content: '';
                    position: absolute;
                    bottom: -30%;
                    left: -10%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
                    animation: float 8s ease-in-out infinite reverse;
                }

                .factors-modal-title {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    font-size: 24px;
                    font-weight: 700;
                    color: #c7d2fe;
                    margin-bottom: 8px;
                    position: relative;
                    z-index: 1;
                }

                .factors-modal-title svg {
                    filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5));
                    animation: pulse-glow 3s ease-in-out infinite;
                }

                .factors-modal-hint {
                    font-size: 14px;
                    color: rgba(165, 180, 252, 0.7);
                    margin: 0;
                    padding-left: 38px;
                    position: relative;
                    z-index: 1;
                }

                .factors-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 32px;
                    background: linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.02) 100%);
                }

                .factors-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 20px;
                    color: rgba(255, 255, 255, 0.4);
                    position: relative;
                }

                .factors-empty-state svg {
                    color: rgba(99, 102, 241, 0.3);
                    margin-bottom: 20px;
                    filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.2));
                }

                .factors-card-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .factor-edit-card-new {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%);
                    border-radius: 20px;
                    border: 1px solid rgba(99, 102, 241, 0.15);
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }

                .factor-edit-card-new::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #6366f1, #a5b4fc, #6366f1);
                    background-size: 200% 100%;
                    animation: shimmer 2s infinite;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .factor-edit-card-new:hover {
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.1);
                    transform: translateY(-2px);
                }

                .factor-edit-card-new:hover::before {
                    opacity: 1;
                }

                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }

                .factor-card-header-new {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 16px 20px;
                    background: linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%);
                    border-bottom: 1px solid rgba(99, 102, 241, 0.1);
                }

                .factor-number-badge {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow:
                        0 4px 12px rgba(99, 102, 241, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                    animation: pulse-glow 3s ease-in-out infinite;
                }

                .factor-num {
                    color: white;
                    font-weight: 700;
                    font-size: 16px;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                }

                .factor-card-title {
                    flex: 1;
                    font-weight: 600;
                    color: #c7d2fe;
                    font-size: 16px;
                }

                .factor-delete-btn-new {
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                    color: #f87171;
                    border-radius: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                    backdrop-filter: blur(4px);
                }

                .factor-delete-btn-new:hover {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%);
                    transform: scale(1.05) rotate(3deg);
                    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
                }

                .factor-card-body-new {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .factor-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .factor-input-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #a5b4fc;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .factor-input-label svg {
                    filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.5));
                }

                .factor-name-input-new,
                .factor-desc-input-new {
                    width: 100%;
                    padding: 16px 20px;
                    border: 2px solid rgba(99, 102, 241, 0.2);
                    border-radius: 14px;
                    background: rgba(0, 0, 0, 0.3);
                    font-size: 15px;
                    color: #eef2ff;
                    transition: all 0.3s;
                }

                .factor-name-input-new::placeholder,
                .factor-desc-input-new::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }

                .factor-name-input-new:focus,
                .factor-desc-input-new:focus {
                    outline: none;
                    border-color: #6366f1;
                    background: rgba(0, 0, 0, 0.4);
                    box-shadow:
                        0 0 0 4px rgba(99, 102, 241, 0.1),
                        0 4px 20px rgba(99, 102, 241, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }

                .factor-desc-input-new {
                    resize: vertical;
                    min-height: 120px;
                    line-height: 1.7;
                    font-family: inherit;
                }

                .factor-add-btn-new {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    padding: 18px 28px;
                    border: 2px dashed rgba(99, 102, 241, 0.4);
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%);
                    color: #a5b4fc;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-top: 8px;
                    position: relative;
                    overflow: hidden;
                }

                .factor-add-btn-new::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
                    transition: left 0.5s;
                }

                .factor-add-btn-new:hover {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.2) 100%);
                    border-color: #6366f1;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
                }

                .factor-add-btn-new:hover::before {
                    left: 100%;
                }

                .factors-modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px 32px;
                    border-top: 1px solid rgba(99, 102, 241, 0.15);
                    background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, transparent 100%);
                }

                .factors-modal-actions {
                    display: flex;
                    gap: 14px;
                }

                .btn-cancel-new,
                .btn-save-new {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 28px;
                    border-radius: 14px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .btn-cancel-new {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(4px);
                }

                .btn-cancel-new:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    transform: translateY(-2px);
                }

                .btn-save-new {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%);
                    color: white;
                    border: none;
                    box-shadow:
                        0 4px 16px rgba(99, 102, 241, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }

                .btn-save-new:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
                }

                /* ==================== 因子编辑模态框 - 浅色主题 ==================== */
                [data-theme="light"] .factors-edit-overlay {
                    background: rgba(15, 23, 42, 0.4);
                }

                [data-theme="light"] .factors-edit-modal {
                    background: linear-gradient(145deg, #ffffff 0%, #f8f5f0 100%);
                    box-shadow:
                        0 25px 80px rgba(0, 0, 0, 0.15),
                        0 0 0 1px rgba(99, 102, 241, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.8);
                }

                [data-theme="light"] .factors-modal-header {
                    background:
                        linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.03) 50%, rgba(99, 102, 241, 0.08) 100%),
                        linear-gradient(180deg, rgba(255,255,255,0.8) 0%, transparent 100%);
                    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
                }

                [data-theme="light"] .factors-modal-header::before {
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
                }

                [data-theme="light"] .factors-modal-header::after {
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
                }

                [data-theme="light"] .factors-modal-title {
                    color: #4338ca;
                }

                [data-theme="light"] .factors-modal-title svg {
                    filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.3));
                }

                [data-theme="light"] .factors-modal-hint {
                    color: #6366f1;
                }

                [data-theme="light"] .factors-modal-body {
                    background: linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.02) 100%);
                }

                [data-theme="light"] .factors-empty-state {
                    color: #64748b;
                }

                [data-theme="light"] .factors-empty-state svg {
                    color: rgba(99, 102, 241, 0.4);
                    filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.15));
                }

                [data-theme="light"] .factor-edit-card-new {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%);
                    border: 1px solid rgba(99, 102, 241, 0.12);
                }

                [data-theme="light"] .factor-edit-card-new:hover {
                    border-color: rgba(99, 102, 241, 0.25);
                    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1), 0 0 0 1px rgba(99, 102, 241, 0.08);
                }

                [data-theme="light"] .factor-card-header-new {
                    background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.03) 100%);
                    border-bottom: 1px solid rgba(99, 102, 241, 0.08);
                }

                [data-theme="light"] .factor-number-badge {
                    box-shadow:
                        0 4px 12px rgba(99, 102, 241, 0.25),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }

                [data-theme="light"] .factor-card-title {
                    color: #4338ca;
                }

                [data-theme="light"] .factor-delete-btn-new {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
                }

                [data-theme="light"] .factor-delete-btn-new:hover {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.2);
                }

                [data-theme="light"] .factor-input-label {
                    color: #4f46e5;
                }

                [data-theme="light"] .factor-input-label svg {
                    filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.3));
                }

                [data-theme="light"] .factor-name-input-new,
                [data-theme="light"] .factor-desc-input-new {
                    border: 2px solid rgba(99, 102, 241, 0.15);
                    background: rgba(255, 255, 255, 0.8);
                    color: #1e293b;
                }

                [data-theme="light"] .factor-name-input-new::placeholder,
                [data-theme="light"] .factor-desc-input-new::placeholder {
                    color: #94a3b8;
                }

                [data-theme="light"] .factor-name-input-new:focus,
                [data-theme="light"] .factor-desc-input-new:focus {
                    border-color: #6366f1;
                    background: #ffffff;
                    box-shadow:
                        0 0 0 4px rgba(99, 102, 241, 0.08),
                        0 4px 20px rgba(99, 102, 241, 0.08);
                }

                [data-theme="light"] .factor-add-btn-new {
                    border: 2px dashed rgba(99, 102, 241, 0.3);
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.08) 100%);
                    color: #4f46e5;
                }

                [data-theme="light"] .factor-add-btn-new::before {
                    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.08), transparent);
                }

                [data-theme="light"] .factor-add-btn-new:hover {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.15) 100%);
                    border-color: #6366f1;
                    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
                }

                [data-theme="light"] .factors-modal-footer {
                    border-top: 1px solid rgba(99, 102, 241, 0.1);
                    background: linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, transparent 100%);
                }

                [data-theme="light"] .btn-cancel-new {
                    background: rgba(0, 0, 0, 0.03);
                    color: #475569;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }

                [data-theme="light"] .btn-cancel-new:hover {
                    background: rgba(0, 0, 0, 0.06);
                    color: #1e293b;
                }

                [data-theme="light"] .btn-save-new {
                    box-shadow:
                        0 4px 16px rgba(99, 102, 241, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.25);
                }

                [data-theme="light"] .btn-save-new:hover {
                    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
                }

                /* ==================== 概念编辑模态框 ==================== */
                @keyframes float-blue { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes pulse-glow-blue { 0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); } 50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.5); } }
                @keyframes shimmer-blue { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes rainbow-slide { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes bounce-in { 0% { opacity: 0; transform: scale(0.5) rotate(-10deg); } 70% { transform: scale(1.1) rotate(2deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
                @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }

                .concepts-edit-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                    animation: fadeIn 0.3s ease-out;
                }

                .concepts-edit-modal {
                    background: linear-gradient(145deg, #1a1f3a 0%, #0f1525 100%);
                    border-radius: 24px;
                    width: 100%;
                    max-width: 640px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow:
                        0 25px 80px rgba(0, 0, 0, 0.5),
                        0 0 0 1px rgba(59, 130, 246, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .concepts-modal-header {
                    padding: 28px 32px;
                    background:
                        linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(59, 130, 246, 0.1) 100%),
                        linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
                    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
                    position: relative;
                    overflow: hidden;
                }

                .concepts-modal-header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -20%;
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
                    animation: float-blue 6s ease-in-out infinite;
                }

                .concepts-modal-header::after {
                    content: '';
                    position: absolute;
                    bottom: -30%;
                    left: -10%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
                    animation: float-blue 8s ease-in-out infinite reverse;
                }

                .concepts-modal-title {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    font-size: 24px;
                    font-weight: 700;
                    color: #93c5fd;
                    margin-bottom: 8px;
                    position: relative;
                    z-index: 1;
                }

                .concepts-modal-title svg {
                    filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
                    animation: pulse-glow-blue 3s ease-in-out infinite;
                }

                .concepts-modal-hint {
                    font-size: 14px;
                    color: rgba(147, 197, 253, 0.7);
                    margin: 0;
                    padding-left: 38px;
                    position: relative;
                    z-index: 1;
                }

                .concepts-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    background: linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.02) 100%);
                }

                .concepts-input-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .concepts-input-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #60a5fa;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .concepts-input-label svg {
                    filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
                }

                .concepts-input-wrapper {
                    display: flex;
                    gap: 12px;
                }

                .concepts-input-new {
                    flex: 1;
                    padding: 16px 20px;
                    border: 2px solid rgba(59, 130, 246, 0.2);
                    border-radius: 14px;
                    background: rgba(0, 0, 0, 0.3);
                    font-size: 15px;
                    color: #f0f9ff;
                    transition: all 0.3s;
                }

                .concepts-input-new::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }

                .concepts-input-new:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background: rgba(0, 0, 0, 0.4);
                    box-shadow:
                        0 0 0 4px rgba(59, 130, 246, 0.1),
                        0 4px 20px rgba(59, 130, 246, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }

                .concepts-add-btn-new {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 16px 24px;
                    border: none;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow:
                        0 4px 16px rgba(59, 130, 246, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }

                .concepts-add-btn-new:hover:not(:disabled) {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.5);
                }

                .concepts-add-btn-new:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .concepts-tags-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .concepts-tags-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #60a5fa;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .concepts-tags-label svg {
                    filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
                }

                .concepts-empty-tags {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 50px 20px;
                    background: rgba(59, 130, 246, 0.05);
                    border-radius: 16px;
                    border: 2px dashed rgba(59, 130, 246, 0.2);
                }

                .concepts-empty-tags svg {
                    color: rgba(59, 130, 246, 0.3);
                    margin-bottom: 12px;
                    filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.2));
                }

                .concepts-empty-tags p {
                    margin: 0;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .concepts-tags-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .concept-tag-new {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1e3a8a 100%);
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #bfdbfe;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    box-shadow: 0 2px 8px rgba(30, 64, 175, 0.3);
                    animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    transition: all 0.2s;
                }

                .concept-tag-new:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
                }

                .concept-tag-text {
                    font-weight: 500;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                }

                .concept-tag-remove-new {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    border: none;
                    background: rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .concept-tag-remove-new:hover {
                    background: rgba(239, 68, 68, 0.4);
                    color: #f87171;
                    transform: scale(1.1);
                }

                .concepts-quick-section {
                    padding-top: 16px;
                    border-top: 1px dashed rgba(59, 130, 246, 0.2);
                }

                .concepts-quick-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 14px;
                }

                .concepts-quick-header svg {
                    color: #f59e0b;
                    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.5));
                }

                .concepts-quick-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .concepts-quick-btn {
                    padding: 10px 16px;
                    border: 1px dashed rgba(59, 130, 246, 0.4);
                    border-radius: 20px;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
                    color: #60a5fa;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .concepts-quick-btn:hover {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%);
                    border-style: solid;
                    border-color: #3b82f6;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
                }

                .concepts-modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 14px;
                    padding: 24px 32px;
                    border-top: 1px solid rgba(59, 130, 246, 0.15);
                    background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, transparent 100%);
                }

                [data-theme="light"] .concepts-edit-overlay {
                    background: rgba(15, 23, 42, 0.35);
                }

                [data-theme="light"] .concepts-edit-modal {
                    background: linear-gradient(145deg, #ffffff 0%, #f4f6fb 100%);
                    box-shadow:
                        0 25px 80px rgba(15, 23, 42, 0.15),
                        0 0 0 1px rgba(59, 130, 246, 0.08),
                        inset 0 1px 0 rgba(255, 255, 255, 0.6);
                }

                [data-theme="light"] .concepts-modal-header {
                    background:
                        linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 50%, rgba(59, 130, 246, 0.06) 100%),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, transparent 100%);
                    border-bottom: 1px solid rgba(59, 130, 246, 0.15);
                }

                [data-theme="light"] .concepts-modal-title {
                    color: #1d4ed8;
                }

                [data-theme="light"] .concepts-modal-hint {
                    color: rgba(30, 64, 175, 0.7);
                }

                [data-theme="light"] .concepts-modal-body {
                    background: linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.03) 100%);
                }

                [data-theme="light"] .concepts-input-label,
                [data-theme="light"] .concepts-tags-label {
                    color: #1d4ed8;
                }

                [data-theme="light"] .concepts-input-new {
                    border-color: rgba(59, 130, 246, 0.25);
                    background: #ffffff;
                    color: #0f172a;
                }

                [data-theme="light"] .concepts-input-new::placeholder {
                    color: rgba(15, 23, 42, 0.35);
                }

                [data-theme="light"] .concepts-input-new:focus {
                    background: #ffffff;
                    box-shadow:
                        0 0 0 4px rgba(59, 130, 246, 0.08),
                        0 4px 20px rgba(59, 130, 246, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.7);
                }

                [data-theme="light"] .concepts-empty-tags {
                    background: rgba(59, 130, 246, 0.06);
                    border-color: rgba(59, 130, 246, 0.2);
                }

                [data-theme="light"] .concepts-empty-tags p {
                    color: rgba(15, 23, 42, 0.6);
                }

                [data-theme="light"] .concept-tag-new {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%);
                    color: #1e3a8a;
                    border-color: rgba(59, 130, 246, 0.25);
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                }

                [data-theme="light"] .concept-tag-remove-new {
                    background: rgba(239, 68, 68, 0.12);
                    color: #b91c1c;
                }

                [data-theme="light"] .concepts-quick-header {
                    color: rgba(15, 23, 42, 0.6);
                }

                [data-theme="light"] .concepts-quick-btn {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%);
                    color: #1d4ed8;
                }

                [data-theme="light"] .concepts-modal-footer {
                    border-top: 1px solid rgba(59, 130, 246, 0.1);
                    background: linear-gradient(180deg, rgba(15, 23, 42, 0.04) 0%, transparent 100%);
                }
            `}</style>
        </>
    );
}
