'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import './CreateZoneModal.css';

export default function ZoneList({ activeZoneId }) {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneDesc, setNewZoneDesc] = useState('');
    const [creating, setCreating] = useState(false);

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

    const handleCreateZone = async () => {
        if (!newZoneName.trim()) return;
        
        setCreating(true);
        try {
            const res = await fetch('/api/zones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newZoneName.trim(),
                    description: newZoneDesc.trim()
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                setShowCreateModal(false);
                setNewZoneName('');
                setNewZoneDesc('');
                fetchZones();
                // 跳转到新创建的专区
                window.location.href = `/zones/${data.zoneId}`;
            } else {
                alert(data.error || '创建失败');
            }
        } catch (error) {
            console.error('Failed to create zone:', error);
            alert('创建失败');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="zone-list-loading">
                <div className="spinner" style={{ width: 20, height: 20 }}></div>
            </div>
        );
    }

    return (
        <>
            <div className="zone-list">
                {zones.map(zone => (
                    <Link
                        key={zone.id}
                        href={`/zones/${zone.id}`}
                        className={`zone-tab ${activeZoneId === zone.id ? 'active' : ''}`}
                        title={zone.description || zone.name}
                    >
                        <span className="zone-tab-name">{zone.name}</span>
                        <span className="zone-tab-count">{zone.page_count || 0} 页</span>
                    </Link>
                ))}
                <button
                    className="zone-tab create-zone-btn"
                    onClick={() => setShowCreateModal(true)}
                >
                    <span>+ 创建专区</span>
                </button>
            </div>

            {/* 创建专区弹窗 */}
            {showCreateModal && (
                <div className="create-zone-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="create-zone-modal" onClick={e => e.stopPropagation()}>
                        <div className="create-zone-header">
                            <h3>创建新专区</h3>
                            <button className="create-zone-close" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>
                        <div className="create-zone-body">
                            <div className="create-zone-form-group">
                                <label className="create-zone-label">
                                    专区名称<span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="create-zone-input"
                                    value={newZoneName}
                                    onChange={(e) => setNewZoneName(e.target.value)}
                                    placeholder="输入专区名称"
                                    autoFocus
                                />
                            </div>
                            <div className="create-zone-form-group">
                                <label className="create-zone-label">
                                    专区描述<span className="optional">（可选）</span>
                                </label>
                                <textarea
                                    className="create-zone-textarea"
                                    value={newZoneDesc}
                                    onChange={(e) => setNewZoneDesc(e.target.value)}
                                    placeholder="输入专区描述，介绍专区的用途..."
                                    rows={4}
                                />
                            </div>
                        </div>
                        <div className="create-zone-footer">
                            <button
                                className="create-zone-btn create-zone-btn-cancel"
                                onClick={() => setShowCreateModal(false)}
                            >
                                取消
                            </button>
                            <button
                                className="create-zone-btn create-zone-btn-primary"
                                onClick={handleCreateZone}
                                disabled={!newZoneName.trim() || creating}
                            >
                                {creating ? '创建中...' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
