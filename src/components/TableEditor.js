'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

// 默认表格数据
const DEFAULT_TABLE = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
];

export default function TableEditor({
    initialData = DEFAULT_TABLE,
    initialColumnWidths = [],
    initialRowHeights = [],
    onChange,
    readOnly = false
}) {
    const [tableData, setTableData] = useState(initialData);
    const [columnWidths, setColumnWidths] = useState(
        initialColumnWidths.length > 0 ? initialColumnWidths : initialData[0]?.map(() => 150) || []
    );
    const [rowHeights, setRowHeights] = useState(
        initialRowHeights.length > 0 ? initialRowHeights : initialData.map(() => 40) || []
    );
    const [editingCell, setEditingCell] = useState(null);
    const [resizing, setResizing] = useState(null);
    const tableRef = useRef(null);
    const textareaRef = useRef(null);

    // 通知父组件数据变化
    useEffect(() => {
        if (onChange) {
            onChange({ tableData, columnWidths, rowHeights });
        }
    }, [tableData, columnWidths, rowHeights]);

    // 点击单元格进入编辑模式
    const startEditing = (rowIndex, colIndex) => {
        if (readOnly) return;
        setEditingCell({ row: rowIndex, col: colIndex });
    };

    // 处理单元格内容变化
    const handleCellChange = (value) => {
        if (!editingCell) return;
        const newData = tableData.map((row, i) =>
            i === editingCell.row
                ? row.map((cell, j) => j === editingCell.col ? value : cell)
                : [...row]
        );
        setTableData(newData);
    };

    // 完成编辑
    const finishEditing = () => {
        setEditingCell(null);
    };

    // 添加行
    const addRow = () => {
        const newRow = Array(tableData[0]?.length || 3).fill('');
        setTableData([...tableData, newRow]);
        setRowHeights([...rowHeights, 40]);
    };

    // 删除行
    const deleteRow = (index) => {
        if (tableData.length <= 1) return;
        setTableData(tableData.filter((_, i) => i !== index));
        setRowHeights(rowHeights.filter((_, i) => i !== index));
    };

    // 添加列
    const addColumn = () => {
        setTableData(tableData.map(row => [...row, '']));
        setColumnWidths([...columnWidths, 150]);
    };

    // 删除列
    const deleteColumn = (index) => {
        if (tableData[0]?.length <= 1) return;
        setTableData(tableData.map(row => row.filter((_, i) => i !== index)));
        setColumnWidths(columnWidths.filter((_, i) => i !== index));
    };

    // 处理列宽调整
    const handleColumnResize = useCallback((colIndex, e) => {
        if (readOnly) return;
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = columnWidths[colIndex];

        const handleMouseMove = (moveEvent) => {
            const diff = moveEvent.clientX - startX;
            const newWidth = Math.max(60, startWidth + diff);
            setColumnWidths(prev => prev.map((w, i) => i === colIndex ? newWidth : w));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            setResizing(null);
        };

        setResizing({ type: 'column', index: colIndex });
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths, readOnly]);

    // 处理行高调整
    const handleRowResize = useCallback((rowIndex, e) => {
        if (readOnly) return;
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = rowHeights[rowIndex];

        const handleMouseMove = (moveEvent) => {
            const diff = moveEvent.clientY - startY;
            const newHeight = Math.max(30, startHeight + diff);
            setRowHeights(prev => prev.map((h, i) => i === rowIndex ? newHeight : h));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            setResizing(null);
        };

        setResizing({ type: 'row', index: rowIndex });
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [rowHeights, readOnly]);

    // 处理粘贴图片
    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await uploadFile(file);
                }
                break;
            }
        }
    };

    // 上传文件
    const uploadFile = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok && editingCell) {
                const data = await res.json();
                const isImage = file.type.startsWith('image/');
                const markdown = isImage
                    ? `![${file.name}](${data.url})`
                    : `[${data.filename}](${data.url})`;

                const currentValue = tableData[editingCell.row][editingCell.col] || '';
                handleCellChange(currentValue + markdown);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    // 处理文件选择上传
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file && editingCell) {
            await uploadFile(file);
            e.target.value = '';
        }
    };

    return (
        <div className="table-editor-container">
            {/* 工具栏 */}
            {!readOnly && (
                <div className="table-toolbar">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addRow}>
                        + 添加行
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addColumn}>
                        + 添加列
                    </button>
                    {editingCell && (
                        <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
                            📎 上传文件
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.py,.js"
                            />
                        </label>
                    )}
                </div>
            )}

            {/* 表格 */}
            <div className="table-wrapper" ref={tableRef}>
                <table className="editable-table">
                    <tbody>
                        {tableData.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{ height: rowHeights[rowIndex] }}>
                                {/* 行操作按钮 */}
                                {!readOnly && (
                                    <td className="table-row-actions">
                                        <button
                                            type="button"
                                            className="table-action-btn delete"
                                            onClick={() => deleteRow(rowIndex)}
                                            title="删除行"
                                        >
                                            ×
                                        </button>
                                    </td>
                                )}

                                {row.map((cell, colIndex) => (
                                    <td
                                        key={colIndex}
                                        className={`table-cell ${editingCell?.row === rowIndex && editingCell?.col === colIndex ? 'editing' : ''}`}
                                        style={{
                                            width: columnWidths[colIndex],
                                            minWidth: columnWidths[colIndex],
                                            maxWidth: columnWidths[colIndex],
                                            height: rowHeights[rowIndex]
                                        }}
                                        onClick={() => startEditing(rowIndex, colIndex)}
                                    >
                                        {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                                            <textarea
                                                ref={textareaRef}
                                                className="cell-input"
                                                value={cell}
                                                onChange={(e) => handleCellChange(e.target.value)}
                                                onBlur={finishEditing}
                                                onPaste={handlePaste}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') finishEditing();
                                                    if (e.key === 'Tab') {
                                                        e.preventDefault();
                                                        finishEditing();
                                                        const nextCol = colIndex + 1;
                                                        const nextRow = rowIndex + (nextCol >= row.length ? 1 : 0);
                                                        const realNextCol = nextCol >= row.length ? 0 : nextCol;
                                                        if (nextRow < tableData.length) {
                                                            setEditingCell({ row: nextRow, col: realNextCol });
                                                        }
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="cell-content">
                                                {cell ? (
                                                    <MarkdownRenderer content={cell} />
                                                ) : (
                                                    !readOnly && <span className="cell-placeholder">点击编辑</span>
                                                )}
                                            </div>
                                        )}

                                        {/* 列宽调整手柄 */}
                                        {!readOnly && colIndex === row.length - 1 ? null : !readOnly && (
                                            <div
                                                className="col-resize-handle"
                                                onMouseDown={(e) => handleColumnResize(colIndex, e)}
                                            />
                                        )}
                                    </td>
                                ))}

                                {/* 列删除按钮（只在第一行显示） */}
                                {!readOnly && rowIndex === 0 && (
                                    <td className="table-col-actions-cell" rowSpan={tableData.length}>
                                        <div className="table-col-actions">
                                            {row.map((_, colIndex) => (
                                                <button
                                                    key={colIndex}
                                                    type="button"
                                                    className="table-action-btn delete col-delete"
                                                    onClick={() => deleteColumn(colIndex)}
                                                    title="删除列"
                                                    style={{
                                                        position: 'absolute',
                                                        left: columnWidths.slice(0, colIndex).reduce((a, b) => a + b, 0) + columnWidths[colIndex] / 2 - 10 + 30,
                                                        top: -25
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                )}

                                {/* 行高调整手柄 */}
                                {!readOnly && (
                                    <td className="row-resize-cell">
                                        <div
                                            className="row-resize-handle"
                                            onMouseDown={(e) => handleRowResize(rowIndex, e)}
                                        />
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!readOnly && (
                <div className="table-help">
                    💡 提示：单元格支持 Markdown 语法，包括 **加粗**、*斜体*、`代码`、$公式$、图片和链接
                </div>
            )}
        </div>
    );
}

// 只读表格查看器（简化版）
export function TableViewer({ tableData, columnWidths = [], rowHeights = [] }) {
    if (!tableData || tableData.length === 0) {
        return <div className="empty-state">表格数据为空</div>;
    }

    const widths = columnWidths.length > 0 ? columnWidths : tableData[0]?.map(() => 150) || [];
    const heights = rowHeights.length > 0 ? rowHeights : tableData.map(() => 40) || [];

    return (
        <div className="table-viewer">
            <div className="table-wrapper">
                <table className="view-table">
                    <tbody>
                        {tableData.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{ height: heights[rowIndex] }}>
                                {row.map((cell, colIndex) => (
                                    <td
                                        key={colIndex}
                                        className="table-cell"
                                        style={{
                                            width: widths[colIndex],
                                            minWidth: widths[colIndex],
                                            maxWidth: widths[colIndex],
                                            height: heights[rowIndex]
                                        }}
                                    >
                                        <div className="cell-content">
                                            {cell ? (
                                                <MarkdownRenderer content={cell} />
                                            ) : null}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
