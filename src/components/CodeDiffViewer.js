'use client';

import { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

// 代码 diff 查看器组件
export default function CodeDiffViewer({ 
    oldCode, 
    newCode, 
    oldPseudocode, 
    newPseudocode,
    oldLabel = '旧版本', 
    newLabel = '新版本', 
    splitView = false 
}) {
    const [viewMode, setViewMode] = useState(splitView ? 'split' : 'unified');
    const [activeTab, setActiveTab] = useState('code'); // 'code' | 'pseudocode'

    const hasCodeDiff = oldCode !== undefined && newCode !== undefined;
    const hasPseudocodeDiff = oldPseudocode !== undefined && newPseudocode !== undefined;

    if (!hasCodeDiff && !hasPseudocodeDiff) {
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>无差异数据</div>;
    }

    const diffStyles = {
        variables: {
            light: {
                diffViewerBackground: 'var(--bg-secondary)',
                gutterBackground: 'var(--bg-primary)',
                gutterBackgroundDark: 'var(--bg-primary)',
                highlightBackground: 'var(--bg-primary)',
                highlightGutterBackground: 'var(--bg-primary)',
                addedBackground: 'rgba(0, 255, 0, 0.1)',
                addedGutterBackground: 'rgba(0, 255, 0, 0.15)',
                addedColor: '#3fb950',
                removedBackground: 'rgba(255, 0, 0, 0.1)',
                removedGutterBackground: 'rgba(255, 0, 0, 0.15)',
                removedColor: '#f85149',
                wordAddedBackground: 'rgba(0, 255, 0, 0.2)',
                wordRemovedBackground: 'rgba(255, 0, 0, 0.2)',
                emptyLineBackground: 'var(--bg-secondary)',
            }
        },
        contentText: {
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.5'
        },
        line: {
            padding: '2px 8px'
        },
        gutter: {
            padding: '2px 8px',
            minWidth: '40px'
        }
    };

    const renderDiffContent = () => {
        if (activeTab === 'code' && hasCodeDiff) {
            return (
                <ReactDiffViewer
                    oldValue={oldCode || ''}
                    newValue={newCode || ''}
                    splitView={viewMode === 'split'}
                    leftTitle={oldLabel}
                    rightTitle={newLabel}
                    showDiffOnly={false}
                    styles={diffStyles}
                />
            );
        }
        if (activeTab === 'pseudocode' && hasPseudocodeDiff) {
            return (
                <ReactDiffViewer
                    oldValue={oldPseudocode || ''}
                    newValue={newPseudocode || ''}
                    splitView={viewMode === 'split'}
                    leftTitle={oldLabel}
                    rightTitle={newLabel}
                    showDiffOnly={false}
                    styles={diffStyles}
                />
            );
        }
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>无差异数据</div>;
    };

    return (
        <div style={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
        }}>
            {/* 工具栏 */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)'
            }}>
                {/* 左侧：Tab 切换 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {hasCodeDiff && (
                        <button
                            onClick={() => setActiveTab('code')}
                            style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: activeTab === 'code' ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: activeTab === 'code' ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            💻 代码对比
                        </button>
                    )}
                    {hasPseudocodeDiff && (
                        <button
                            onClick={() => setActiveTab('pseudocode')}
                            style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: activeTab === 'pseudocode' ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: activeTab === 'pseudocode' ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            📝 伪代码对比
                        </button>
                    )}
                </div>

                {/* 右侧：视图模式切换 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setViewMode('unified')}
                        style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: viewMode === 'unified' ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: viewMode === 'unified' ? 'white' : 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        统一视图
                    </button>
                    <button
                        onClick={() => setViewMode('split')}
                        style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: viewMode === 'split' ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: viewMode === 'split' ? 'white' : 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        分栏视图
                    </button>
                </div>
            </div>

            {/* Diff 内容 */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {renderDiffContent()}
            </div>
        </div>
    );
}
