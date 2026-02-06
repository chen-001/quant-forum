'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ZoneList from '@/components/zones/ZoneList';
import ZoneSearch from '@/components/zones/ZoneSearch';
import Link from 'next/link';

export default function ZonesPage() {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        fetchZones();
    }, []);

    const fetchZones = async () => {
        try {
            const res = await fetch('/api/zones');
            const data = await res.json();
            if (res.ok) {
                setZones(data.zones || []);
            }
        } catch (error) {
            console.error('Failed to fetch zones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchKeyword.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await fetch(`/api/zones?keyword=${encodeURIComponent(searchKeyword)}`);
            const data = await res.json();
            if (res.ok) {
                setSearchResults(data.zones || []);
            }
        } catch (error) {
            console.error('Failed to search zones:', error);
        } finally {
            setSearching(false);
        }
    };

    const displayZones = searchKeyword.trim() ? searchResults : zones;

    return (
        <>
            <Header />
            <main className="container zones-page">
                <div className="zones-header">
                    <h1>📚 专区</h1>
                    <p className="zones-description">
                        知识库与讨论区，支持无限层级页面和Markdown编辑
                    </p>
                </div>

                <div className="zones-search-section">
                    <ZoneSearch />
                </div>

                <div className="zones-search">
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="搜索专区名称..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button 
                        className="btn btn-primary"
                        onClick={handleSearch}
                        disabled={searching}
                    >
                        {searching ? '搜索中...' : '搜索'}
                    </button>
                    {searchKeyword && (
                        <button 
                            className="btn btn-ghost"
                            onClick={() => {
                                setSearchKeyword('');
                                setSearchResults([]);
                            }}
                        >
                            清除
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="zones-loading">
                        <div className="spinner"></div>
                        <p>加载中...</p>
                    </div>
                ) : (
                    <div className="zones-grid">
                        {displayZones.length === 0 ? (
                            <div className="zones-empty">
                                <p>
                                    {searchKeyword.trim() 
                                        ? '没有找到匹配的专区' 
                                        : '暂无专区，点击上方"创建专区"按钮创建第一个专区'}
                                </p>
                            </div>
                        ) : (
                            displayZones.map(zone => (
                                <Link 
                                    key={zone.id} 
                                    href={`/zones/${zone.id}`}
                                    className="zone-card"
                                >
                                    <div className="zone-card-header">
                                        <h3>{zone.name}</h3>
                                        <span className="zone-card-pages">
                                            {zone.page_count || 0} 页
                                        </span>
                                    </div>
                                    {zone.description && (
                                        <p className="zone-card-description">
                                            {zone.description}
                                        </p>
                                    )}
                                    <div className="zone-card-footer">
                                        <span>创建者: {zone.created_by_name}</span>
                                        <span>
                                            {new Date(zone.created_at + 'Z').toLocaleDateString('zh-CN', {
                                                timeZone: 'Asia/Shanghai'
                                            })}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                <ZoneList />
            </main>
        </>
    );
}
