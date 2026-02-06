'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

export default function ZoneSearch({ zoneId, zoneName }) {
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // 防抖搜索
    const debouncedSearch = useCallback(
        debounce(async (searchKeyword) => {
            if (!searchKeyword.trim()) {
                setResults([]);
                setHasSearched(false);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const url = zoneId 
                    ? `/api/zones/search?zoneId=${zoneId}&keyword=${encodeURIComponent(searchKeyword)}`
                    : `/api/zones/search?keyword=${encodeURIComponent(searchKeyword)}`;
                
                const res = await fetch(url);
                const data = await res.json();
                
                if (res.ok) {
                    setResults(data.results || []);
                    setHasSearched(true);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300),
        [zoneId]
    );

    useEffect(() => {
        debouncedSearch(keyword);
    }, [keyword, debouncedSearch]);

    // 点击外部关闭搜索结果
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Cmd/Ctrl + K 聚焦搜索
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setShowResults(true);
            }
            // ESC 关闭搜索结果
            if (e.key === 'Escape') {
                setShowResults(false);
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClear = () => {
        setKeyword('');
        setResults([]);
        setHasSearched(false);
        inputRef.current?.focus();
    };

    const handleResultClick = () => {
        setShowResults(false);
        setKeyword('');
        setResults([]);
        setHasSearched(false);
    };

    // 高亮匹配文本
    const highlightText = (text, keyword) => {
        if (!text || !keyword) return text;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // 截断内容预览
    const getContentPreview = (content, keyword) => {
        if (!content) return '';
        const maxLength = 100;
        const keywordIndex = content.toLowerCase().indexOf(keyword.toLowerCase());
        
        if (keywordIndex === -1) {
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }
        
        const start = Math.max(0, keywordIndex - 30);
        const end = Math.min(content.length, keywordIndex + keyword.length + 30);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < content.length ? '...' : '';
        
        return prefix + content.substring(start, end) + suffix;
    };

    return (
        <div className="zone-search-container" ref={containerRef}>
            <div className="zone-search-input-wrapper">
                <span className="zone-search-icon">🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="zone-search-input"
                    placeholder={zoneId ? `搜索当前专区的页面...` : "搜索所有专区页面..."}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onFocus={() => setShowResults(true)}
                />
                {keyword && (
                    <button className="zone-search-clear" onClick={handleClear}>
                        ✕
                    </button>
                )}
                <span className="zone-search-shortcut">⌘K</span>
            </div>

            {showResults && (keyword || hasSearched) && (
                <div className="zone-search-results">
                    {loading ? (
                        <div className="zone-search-loading">
                            <div className="spinner"></div>
                            <span>搜索中...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <>
                            <div className="zone-search-header">
                                找到 {results.length} 个结果
                                {zoneName && <span> · {zoneName}</span>}
                            </div>
                            <div className="zone-search-list">
                                {results.map((page) => (
                                    <Link
                                        key={page.id}
                                        href={`/zones/${page.zone_id}/${page.path}`}
                                        className="zone-search-item"
                                        onClick={handleResultClick}
                                    >
                                        <div className="zone-search-item-header">
                                            <span className="zone-search-item-icon">
                                                {page.content ? '📄' : '📁'}
                                            </span>
                                            <span 
                                                className="zone-search-item-title"
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightText(page.title, keyword)
                                                }}
                                            />
                                            {!zoneId && (
                                                <span className="zone-search-item-zone">
                                                    {page.zone_name}
                                                </span>
                                            )}
                                        </div>
                                        {page.content && (
                                            <div 
                                                className="zone-search-item-preview"
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightText(
                                                        getContentPreview(page.content, keyword),
                                                        keyword
                                                    )
                                                }}
                                            />
                                        )}
                                        <div className="zone-search-item-meta">
                                            <span>路径: {page.path}</span>
                                            <span>更新于 {new Date(page.updated_at + 'Z').toLocaleDateString('zh-CN')}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    ) : hasSearched ? (
                        <div className="zone-search-empty">
                            <p>未找到包含 "{keyword}" 的页面</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
