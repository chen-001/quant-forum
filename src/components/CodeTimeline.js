'use client';

import { useState, useEffect } from 'react';
import CodeDiffViewer from './CodeDiffViewer';

// 代码时间线组件
export default function CodeTimeline({ 
    commentId, 
    variantIndex, 
    currentCode, 
    currentPseudocode,
    currentDescription,
    onRestoreVersion,
    isOpen,
    onClose
}) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersions, setSelectedVersions] = useState([]);
    const [diffData, setDiffData] = useState(null);
    const [previewVersion, setPreviewVersion] = useState(null);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // 加载版本列表
    useEffect(() => {
        if (isOpen && commentId !== undefined && variantIndex !== undefined) {
            loadVersions();
        }
    }, [isOpen, commentId, variantIndex]);

    const loadVersions = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/explore/versions?commentId=${commentId}&variantIndex=${variantIndex}`);
            const data = await res.json();
            if (res.ok) {
                setVersions(data.versions || []);
            }
        } catch (err) {
            console.error('加载版本列表失败:', err);
        } finally {
            setLoading(false);
        }
    };

    // 获取两个版本的 diff
    const loadDiff = async (versionId1, versionId2) => {
        try {
            const res = await fetch(`/api/explore/versions/diff?versionId1=${versionId1}&versionId2=${versionId2}`);
            const data = await res.json();
            if (res.ok) {
                setDiffData(data);
                setShowDiffModal(true);
            }
        } catch (err) {
            console.error('加载 diff 失败:', err);
        }
    };

    // 选择版本进行对比
    const toggleVersionSelection = (versionId) => {
        setSelectedVersions(prev => {
            if (prev.includes(versionId)) {
                return prev.filter(id => id !== versionId);
            }
            if (prev.length >= 2) {
                return [prev[1], versionId];
            }
            return [...prev, versionId];
        });
    };

    // 执行对比
    const handleCompare = () => {
        if (selectedVersions.length === 2) {
            loadDiff(selectedVersions[0], selectedVersions[1]);
        }
    };

    // 恢复版本
    const handleRestore = async (versionId) => {
        if (!confirm('确定要恢复到这个版本吗？当前未保存的修改将会丢失。')) {
            return;
        }
        try {
            const res = await fetch('/api/explore/versions/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onRestoreVersion?.(data.restoredVersion);
                onClose?.();
            }
        } catch (err) {
            console.error('恢复版本失败:', err);
        }
    };

    // 更新版本备注
    const updateVersionNote = async (versionId, note, isImportant) => {
        try {
            const res = await fetch(`/api/explore/versions/${versionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note, isImportant })
            });
            if (res.ok) {
                loadVersions();
            }
        } catch (err) {
            console.error('更新版本备注失败:', err);
        }
    };

    // 格式化时间
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* 头部 */}
                <div style={headerStyle}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>📜 代码版本历史</h3>
                    <button onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                {/* 工具栏 */}
                <div style={toolbarStyle}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        已选择 {selectedVersions.length}/2 个版本
                        {selectedVersions.length === 2 && (
                            <button onClick={handleCompare} style={compareButtonStyle}>
                                对比选中版本
                            </button>
                        )}
                    </div>
                    <button onClick={loadVersions} style={refreshButtonStyle}>
                        🔄 刷新
                    </button>
                </div>

                {/* 版本列表 */}
                <div style={listStyle}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            加载中...
                        </div>
                    ) : versions.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            暂无版本历史
                        </div>
                    ) : (
                        versions.map((version, index) => (
                            <div 
                                key={version.id} 
                                style={{
                                    ...versionItemStyle,
                                    ...(selectedVersions.includes(version.id) ? selectedItemStyle : {}),
                                    ...(version.is_important ? importantItemStyle : {})
                                }}
                            >
                                {/* 选择框 */}
                                <input
                                    type="checkbox"
                                    checked={selectedVersions.includes(version.id)}
                                    onChange={() => toggleVersionSelection(version.id)}
                                    style={{ marginRight: '10px' }}
                                />

                                {/* 版本信息 */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                                            版本 #{versions.length - index}
                                        </span>
                                        {version.is_important && (
                                            <span style={importantBadgeStyle}>⭐ 重要</span>
                                        )}
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {formatTime(version.created_at)}
                                        </span>
                                    </div>
                                    
                                    {/* 备注 */}
                                    <div style={{ marginTop: '4px' }}>
                                        <EditableNote 
                                            note={version.note}
                                            onSave={(note) => updateVersionNote(version.id, note, version.is_important)}
                                        />
                                    </div>

                                    {/* 操作按钮 */}
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => {
                                                setPreviewVersion(version);
                                                setShowPreviewModal(true);
                                            }}
                                            style={actionButtonStyle}
                                        >
                                            👁️ 预览
                                        </button>
                                        <button 
                                            onClick={() => handleRestore(version.id)}
                                            style={actionButtonStyle}
                                        >
                                            ↩️ 恢复
                                        </button>
                                        <button 
                                            onClick={() => updateVersionNote(version.id, version.note, !version.is_important)}
                                            style={{
                                                ...actionButtonStyle,
                                                color: version.is_important ? '#f59e0b' : 'inherit'
                                            }}
                                        >
                                            {version.is_important ? '⭐' : '☆'} 标记
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Diff 弹窗 */}
            {showDiffModal && diffData && (
                <div style={overlayStyle} onClick={() => setShowDiffModal(false)}>
                    <div style={{ ...modalStyle, width: '90vw', maxWidth: '1200px' }} onClick={e => e.stopPropagation()}>
                        <div style={headerStyle}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>📊 版本对比</h3>
                            <button onClick={() => setShowDiffModal(false)} style={closeButtonStyle}>✕</button>
                        </div>
                        <div style={{ padding: '16px', maxHeight: '70vh', overflow: 'auto' }}>
                            <CodeDiffViewer
                                oldCode={diffData.oldVersion.code}
                                newCode={diffData.newVersion.code}
                                oldLabel={`版本 #${diffData.oldVersion.id} (${formatTime(diffData.oldVersion.createdAt)})`}
                                newLabel={`版本 #${diffData.newVersion.id} (${formatTime(diffData.newVersion.createdAt)})`}
                                splitView={true}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 预览弹窗 */}
            {showPreviewModal && previewVersion && (
                <div style={overlayStyle} onClick={() => setShowPreviewModal(false)}>
                    <div style={{ ...modalStyle, width: '80vw', maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div style={headerStyle}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>👁️ 版本预览</h3>
                            <button onClick={() => setShowPreviewModal(false)} style={closeButtonStyle}>✕</button>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>方案说明</div>
                                <div style={{ fontSize: '13px', padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px' }}>
                                    {previewVersion.description}
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>伪代码</div>
                                <pre style={{ fontSize: '12px', padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'auto', maxHeight: '150px' }}>
                                    {previewVersion.pseudocode}
                                </pre>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>代码</div>
                                <pre style={{ fontSize: '12px', padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'auto', maxHeight: '300px' }}>
                                    {previewVersion.code}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 可编辑备注组件
function EditableNote({ note, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(note || '');

    const handleSave = () => {
        onSave(value);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="添加备注..."
                    style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-primary)'
                    }}
                    autoFocus
                />
                <button onClick={handleSave} style={{ fontSize: '11px', padding: '2px 8px' }}>保存</button>
                <button onClick={() => setIsEditing(false)} style={{ fontSize: '11px', padding: '2px 8px' }}>取消</button>
            </div>
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)}
            style={{ 
                fontSize: '12px', 
                color: note ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px'
            }}
        >
            {note || '点击添加备注...'}
        </div>
    );
}

// 样式定义
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px'
};

const modalStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    width: '90vw',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
};

const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0
};

const closeButtonStyle = {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'var(--text-muted)'
};

const toolbarStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)'
};

const listStyle = {
    flex: 1,
    overflow: 'auto',
    padding: '8px'
};

const versionItemStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    marginBottom: '8px',
    backgroundColor: 'var(--bg-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    transition: 'all 0.2s'
};

const selectedItemStyle = {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--primary)',
    backgroundColor: 'rgba(var(--primary-rgb), 0.1)'
};

const importantItemStyle = {
    borderWidth: '1px 1px 1px 3px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color) var(--border-color) var(--border-color) #f59e0b'
};

const importantBadgeStyle = {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    borderRadius: '4px'
};

const actionButtonStyle = {
    fontSize: '11px',
    padding: '4px 10px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'pointer'
};

const compareButtonStyle = {
    marginLeft: '12px',
    padding: '4px 12px',
    fontSize: '12px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
};

const refreshButtonStyle = {
    fontSize: '12px',
    padding: '4px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'pointer'
};
