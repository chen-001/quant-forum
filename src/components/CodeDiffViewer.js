'use client';

import { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

// 代码 diff 查看器组件
export default function CodeDiffViewer({ oldCode, newCode, oldLabel = '旧版本', newLabel = '新版本', splitView = false }) {
    const [viewMode, setViewMode] = useState(splitView ? 'split' : 'unified');

    if (!oldCode || !newCode) {
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

    return (
        <div style={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)'
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
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>代码对比</span>
                <div style={{ display: 'flex', gap: '8px' }}>
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
            <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                <ReactDiffViewer
                    oldValue={oldCode}
                    newValue={newCode}
                    splitView={viewMode === 'split'}
                    leftTitle={oldLabel}
                    rightTitle={newLabel}
                    showDiffOnly={false}
                    styles={diffStyles}
                />
            </div>
        </div>
    );
}
