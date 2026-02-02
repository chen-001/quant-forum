'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// 动态导入Plotly以避免SSR问题
const Plot = dynamic(() => import('react-plotly.js').then(mod => mod.default), {
    ssr: false,
    loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载图表...</div>
});

// 从markdown内容中提取图片URL
function extractImageUrls(content) {
    if (!content) return [];
    const regex = /!\[.*?\]\((.*?)\)/g;
    const urls = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

// 将图片URL转为base64
async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('转换图片失败:', url, error);
        return null;
    }
}

export default function ExploreModal({ commentId, commentContent, onClose }) {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [variants, setVariants] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [stockCode, setStockCode] = useState('000001');
    const [date, setDate] = useState('20220819');
    const [executionResults, setExecutionResults] = useState({});
    const [error, setError] = useState(null);
    const [isGenerated, setIsGenerated] = useState(false);
    const [editedCode, setEditedCode] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [editedPseudocode, setEditedPseudocode] = useState('');

    // 加载探索方案
    useEffect(() => {
        loadExploration();
    }, [commentId]);

    // 自动保存修改
    useEffect(() => {
        if (isGenerated && (
            editedCode !== variants[activeTab]?.code ||
            editedDescription !== variants[activeTab]?.description ||
            editedPseudocode !== variants[activeTab]?.pseudocode
        )) {
            const timer = setTimeout(() => {
                saveExploration();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [editedCode, editedDescription, editedPseudocode, activeTab]);

    const loadExploration = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/explore?commentId=${commentId}`);
            const data = await res.json();

            if (data.isGenerated) {
                setVariants(data.variants);
                setStockCode(data.defaultCode);
                setDate(String(data.defaultDate));
                setExecutionResults(data.executionResults || {});
                setIsGenerated(true);

                // 恢复到最后执行的方案，如果没有则默认第一个
                const initialTab = data.lastExecutedVariant !== null ? data.lastExecutedVariant : 0;
                setActiveTab(initialTab);
                const initialVariant = data.variants[initialTab] || {};
                setEditedCode(initialVariant.code || '');
                setEditedDescription(initialVariant.description || '');
                setEditedPseudocode(initialVariant.pseudocode || '');
            } else {
                // 未生成，需要调用生成API
                await generateExploration();
            }
        } catch (err) {
            setError('加载失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateExploration = async () => {
        try {
            setGenerating(true);
            setError(null);

            // 提取评论中的图片并转为base64
            const imageUrls = extractImageUrls(commentContent);
            const imageBase64List = [];
            for (const url of imageUrls) {
                const base64 = await urlToBase64(url);
                if (base64) {
                    imageBase64List.push(base64);
                }
            }

            const res = await fetch('/api/explore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId,
                    textContent: commentContent,
                    imageBase64List
                })
            });
            const data = await res.json();

            if (res.ok) {
                setVariants(data.variants);
                setStockCode(data.defaultCode);
                setDate(String(data.defaultDate));
                setIsGenerated(true);
                const initialVariant = data.variants[0] || {};
                setEditedCode(initialVariant.code || '');
                setEditedDescription(initialVariant.description || '');
                setEditedPseudocode(initialVariant.pseudocode || '');
            } else {
                setError(data.error || '生成失败');
            }
        } catch (err) {
            setError('生成失败: ' + err.message);
        } finally {
            setGenerating(false);
            setLoading(false);
        }
    };

    const regenerateExploration = async () => {
        try {
            setGenerating(true);
            setError(null);

            // 提取评论中的图片并转为base64
            const imageUrls = extractImageUrls(commentContent);
            const imageBase64List = [];
            for (const url of imageUrls) {
                const base64 = await urlToBase64(url);
                if (base64) {
                    imageBase64List.push(base64);
                }
            }

            const res = await fetch('/api/explore/regenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId,
                    textContent: commentContent,
                    imageBase64List
                })
            });
            const data = await res.json();

            if (res.ok) {
                setVariants(data.variants);
                const newVariant = data.variants[activeTab] || {};
                setEditedCode(newVariant.code || '');
                setEditedDescription(newVariant.description || '');
                setEditedPseudocode(newVariant.pseudocode || '');
                setExecutionResults({});
            } else {
                setError(data.error || '重新生成失败');
            }
        } catch (err) {
            setError('重新生成失败: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const saveExploration = async () => {
        if (!isGenerated) return;

        const newVariants = [...variants];
        newVariants[activeTab] = {
            ...newVariants[activeTab],
            code: editedCode,
            description: editedDescription,
            pseudocode: editedPseudocode
        };

        try {
            await fetch('/api/explore/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId, variants: newVariants })
            });
        } catch (err) {
            console.error('自动保存失败:', err);
        }
    };

    const executeCode = async () => {
        try {
            setExecuting(true);
            setError(null);

            const res = await fetch('/api/explore/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: editedCode,
                    stockCode,
                    date: parseInt(date),
                    commentId,
                    variantIndex: activeTab
                })
            });
            const data = await res.json();

            // 先更新本地状态
            if (data.success) {
                setExecutionResults(prev => ({
                    ...prev,
                    [activeTab]: data
                }));
            } else {
                setError(data.error || '执行失败');
                setExecutionResults(prev => ({
                    ...prev,
                    [activeTab]: data
                }));
            }

            // 保存当前修改后的代码到数据库（确保代码和执行结果一致）
            const newVariants = [...variants];
            newVariants[activeTab] = {
                ...newVariants[activeTab],
                code: editedCode,
                description: editedDescription,
                pseudocode: editedPseudocode
            };
            setVariants(newVariants);

            try {
                await fetch('/api/explore/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commentId, variants: newVariants })
                });
            } catch (saveErr) {
                console.error('执行后保存代码失败:', saveErr);
            }
        } catch (err) {
            setError('执行失败: ' + err.message);
        } finally {
            setExecuting(false);
        }
    };

    const handleTabChange = async (index) => {
        // 保存当前tab的修改到数据库
        const currentVariant = variants[activeTab] || {};
        if (
            editedCode !== currentVariant.code ||
            editedDescription !== currentVariant.description ||
            editedPseudocode !== currentVariant.pseudocode
        ) {
            const newVariants = [...variants];
            newVariants[activeTab] = {
                ...newVariants[activeTab],
                code: editedCode,
                description: editedDescription,
                pseudocode: editedPseudocode
            };

            // 先保存到数据库，成功后再更新本地状态
            try {
                await fetch('/api/explore/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commentId, variants: newVariants })
                });
                // 保存成功后才更新本地状态
                setVariants(newVariants);
            } catch (err) {
                console.error('保存失败:', err);
            }
        }
        setActiveTab(index);
        const newVariant = variants[index] || {};
        setEditedCode(newVariant.code || '');
        setEditedDescription(newVariant.description || '');
        setEditedPseudocode(newVariant.pseudocode || '');
    };

    // 根据说明和伪代码生成代码
    const generateCodeFromDescription = async () => {
        try {
            setGeneratingCode(true);
            setError(null);

            const res = await fetch('/api/explore/generate-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId,
                    variantIndex: activeTab,
                    description: editedDescription,
                    pseudocode: editedPseudocode,
                    currentCode: editedCode
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setEditedCode(data.code);
                // 自动保存
                const newVariants = [...variants];
                newVariants[activeTab] = {
                    ...newVariants[activeTab],
                    code: data.code,
                    description: editedDescription,
                    pseudocode: editedPseudocode
                };
                setVariants(newVariants);
                await fetch('/api/explore/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commentId, variants: newVariants })
                });
            } else {
                setError(data.error || '生成代码失败');
            }
        } catch (err) {
            setError('生成代码失败: ' + err.message);
        } finally {
            setGeneratingCode(false);
        }
    };

    // 渲染因子结果（支持多因子）- 2行紧凑表格
    const renderFactors = (factors) => {
        if (!factors || Object.keys(factors).length === 0) {
            return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>无因子数据</div>;
        }

        const factorNames = Object.keys(factors);

        return (
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '8px',
                height: '100%',
                overflow: 'auto'
            }}>
                {factorNames.map((factorName) => {
                    const factorData = factors[factorName];
                    return (
                        <div key={factorName} style={{ 
                            padding: '8px', 
                            backgroundColor: 'var(--bg-primary)', 
                            borderRadius: 'var(--radius-md)', 
                            border: '1px solid var(--border-color)',
                            fontSize: '11px'
                        }}>
                            <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '4px', color: 'var(--text-primary)' }}>
                                {factorName}
                            </div>
                            {factorData.type === 'Scalar' && (
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary)' }}>
                                    {factorData.value?.toFixed(6) || 'N/A'}
                                </div>
                            )}
                            {factorData.type === 'Dict' && (
                                <div style={{ fontSize: '10px' }}>
                                    {Object.entries(factorData.value || {}).slice(0, 4).map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{k}:</span>
                                            <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                                                {typeof v === 'number' ? v.toFixed(4) : String(v)}
                                            </span>
                                        </div>
                                    ))}
                                    {Object.keys(factorData.value || {}).length > 4 && (
                                        <div style={{ color: 'var(--text-muted)' }}>...</div>
                                    )}
                                </div>
                            )}
                            {factorData.type === 'Series' && factorData.stats && (
                                <div style={{ fontSize: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>均值:</span>
                                        <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                                            {factorData.stats.mean?.toFixed(4)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>标准差:</span>
                                        <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                                            {factorData.stats.std?.toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // 渲染关键中间变量
    const renderKeyVariables = (keyVariables) => {
        if (!keyVariables || Object.keys(keyVariables).length === 0) {
            return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>无中间指标数据</div>;
        }

        return (
            <div style={{ overflow: 'auto', height: '100%' }}>
                {Object.entries(keyVariables).map(([varName, varData]) => (
                    <div key={varName} style={keyVariableItemStyle}>
                        <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                            {varName}
                        </div>
                        {varData.type === 'Series' && varData.data && (
                            <>
                                {/* 统计表格 */}
                                <table style={statsTableStyle}>
                                    <tbody>
                                        <tr>
                                            <td style={statsLabelStyle}>均值</td>
                                            <td style={statsValueStyle}>{varData.stats?.mean?.toFixed(4) || 'N/A'}</td>
                                            <td style={statsLabelStyle}>标准差</td>
                                            <td style={statsValueStyle}>{varData.stats?.std?.toFixed(4) || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={statsLabelStyle}>最小值</td>
                                            <td style={statsValueStyle}>{varData.stats?.min?.toFixed(4) || 'N/A'}</td>
                                            <td style={statsLabelStyle}>最大值</td>
                                            <td style={statsValueStyle}>{varData.stats?.max?.toFixed(4) || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={statsLabelStyle}>样本数</td>
                                            <td style={statsValueStyle} colSpan="3">{varData.stats?.count || 'N/A'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                {/* 时间序列图 */}
                                <div style={{ height: '120px', marginTop: '8px' }}>
                                    <Plot
                                        data={[{
                                            x: varData.data.x,
                                            y: varData.data.y,
                                            type: 'scatter',
                                            mode: 'lines',
                                            line: { color: 'var(--primary)', width: 1 },
                                            name: varName
                                        }]}
                                        layout={{
                                            autosize: true,
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: { color: 'var(--text-primary)', size: 9 },
                                            margin: { l: 30, r: 10, t: 10, b: 20 },
                                            xaxis: { showgrid: false, zeroline: false, tickfont: { size: 8 } },
                                            yaxis: { showgrid: true, gridcolor: 'var(--border-color)', zeroline: false, tickfont: { size: 8 } },
                                            showlegend: false
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        config={{ displayModeBar: false }}
                                    />
                                </div>
                                {/* 分布直方图 */}
                                <div style={{ height: '100px', marginTop: '8px' }}>
                                    <Plot
                                        data={[{
                                            x: varData.data.y,
                                            type: 'histogram',
                                            nbinsx: 30,
                                            marker: { color: 'var(--primary)', opacity: 0.7 },
                                            name: varName
                                        }]}
                                        layout={{
                                            autosize: true,
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: { color: 'var(--text-primary)', size: 9 },
                                            margin: { l: 30, r: 10, t: 10, b: 20 },
                                            xaxis: { title: { text: '值', font: { size: 9 } }, showgrid: false, tickfont: { size: 8 } },
                                            yaxis: { title: { text: '频次', font: { size: 9 } }, showgrid: true, gridcolor: 'var(--border-color)', tickfont: { size: 8 } },
                                            showlegend: false,
                                            bargap: 0.05
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        config={{ displayModeBar: false }}
                                    />
                                </div>
                            </>
                        )}
                        {varData.type === 'Array' && varData.data && (
                            <>
                                {/* 统计表格 */}
                                <table style={statsTableStyle}>
                                    <tbody>
                                        <tr>
                                            <td style={statsLabelStyle}>均值</td>
                                            <td style={statsValueStyle}>{varData.stats?.mean?.toFixed(4) || 'N/A'}</td>
                                            <td style={statsLabelStyle}>标准差</td>
                                            <td style={statsValueStyle}>{varData.stats?.std?.toFixed(4) || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={statsLabelStyle}>最小值</td>
                                            <td style={statsValueStyle}>{varData.stats?.min?.toFixed(4) || 'N/A'}</td>
                                            <td style={statsLabelStyle}>最大值</td>
                                            <td style={statsValueStyle}>{varData.stats?.max?.toFixed(4) || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={statsLabelStyle}>样本数</td>
                                            <td style={statsValueStyle} colSpan="3">{varData.stats?.count || 'N/A'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                {/* 时间序列图 - 使用数组索引作为x轴 */}
                                <div style={{ height: '120px', marginTop: '8px' }}>
                                    <Plot
                                        data={[{
                                            x: varData.data.map((_, i) => i),
                                            y: varData.data,
                                            type: 'scatter',
                                            mode: 'lines',
                                            line: { color: 'var(--primary)', width: 1 },
                                            name: varName
                                        }]}
                                        layout={{
                                            autosize: true,
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: { color: 'var(--text-primary)', size: 9 },
                                            margin: { l: 30, r: 10, t: 10, b: 20 },
                                            xaxis: { showgrid: false, zeroline: false, tickfont: { size: 8 } },
                                            yaxis: { showgrid: true, gridcolor: 'var(--border-color)', zeroline: false, tickfont: { size: 8 } },
                                            showlegend: false
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        config={{ displayModeBar: false }}
                                    />
                                </div>
                                {/* 分布直方图 */}
                                <div style={{ height: '100px', marginTop: '8px' }}>
                                    <Plot
                                        data={[{
                                            x: varData.data,
                                            type: 'histogram',
                                            nbinsx: 30,
                                            marker: { color: 'var(--primary)', opacity: 0.7 },
                                            name: varName
                                        }]}
                                        layout={{
                                            autosize: true,
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            font: { color: 'var(--text-primary)', size: 9 },
                                            margin: { l: 30, r: 10, t: 10, b: 20 },
                                            xaxis: { title: { text: '值', font: { size: 9 } }, showgrid: false, tickfont: { size: 8 } },
                                            yaxis: { title: { text: '频次', font: { size: 9 } }, showgrid: true, gridcolor: 'var(--border-color)', tickfont: { size: 8 } },
                                            showlegend: false,
                                            bargap: 0.05
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        config={{ displayModeBar: false }}
                                    />
                                </div>
                            </>
                        )}
                        {varData.type === 'Scalar' && (
                            <div style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: '600' }}>
                                {varData.value?.toFixed(6) || 'N/A'}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // 获取当前方案的执行结果
    const currentExecutionResult = executionResults[activeTab];

    if (loading) {
        return (
            <div style={modalOverlayStyle}>
                <div style={modalContentStyle}>
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div className="spinner"></div>
                        <p style={{ marginTop: '16px' }}>正在加载探索方案...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                {/* 头部 */}
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>🔬 因子探索</h2>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={regenerateExploration}
                            disabled={generating}
                        >
                            {generating ? '生成中...' : '🔄 重新生成'}
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={onClose}
                        >
                            ✕ 关闭
                        </button>
                    </div>
                </div>

                {/* 错误提示 */}
                {error && (
                    <div style={errorStyle}>
                        <strong>错误:</strong> {error}
                    </div>
                )}

                {/* 主体内容 - 4区域网格布局 */}
                <div style={gridContainerStyle}>
                    {/* 左侧边栏 - 方案Tab */}
                    <div style={sidebarStyle}>
                        <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            构造方案
                        </div>
                        {Array.isArray(variants) && variants.map((variant, index) => (
                            <button
                                key={index}
                                style={{
                                    ...tabButtonStyle,
                                    ...(activeTab === index ? activeTabStyle : {}),
                                    ...(executionResults[index]?.success ? {
                                        borderLeftWidth: '3px',
                                        borderLeftStyle: 'solid',
                                        borderLeftColor: 'var(--success)'
                                    } : {})
                                }}
                                onClick={() => handleTabChange(index)}
                            >
                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{variant.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                                    {variant.description?.slice(0, 40)}...
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* 左上：说明区 */}
                    <div style={descriptionAreaStyle}>
                        <div style={areaHeaderStyle}>
                            方案说明
                            <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                (可编辑)
                            </span>
                        </div>
                        <textarea
                            style={descriptionEditorStyle}
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            placeholder="输入方案说明..."
                            spellCheck={false}
                        />
                    </div>

                    {/* 中上：因子结果区 */}
                    <div style={factorResultAreaStyle}>
                        <div style={areaHeaderStyle}>
                            因子结果
                            {currentExecutionResult?.factors && (
                                <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                    ({Object.keys(currentExecutionResult.factors).length}个)
                                </span>
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            {currentExecutionResult?.success ? (
                                renderFactors(currentExecutionResult.factors)
                            ) : currentExecutionResult?.error ? (
                                <div style={{ color: 'var(--error)', fontSize: '12px' }}>
                                    执行失败: {currentExecutionResult.error}
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', paddingTop: '20px' }}>
                                    点击运行代码查看因子结果
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右上：伪代码区 */}
                    <div style={pseudocodeAreaStyle}>
                        <div style={{...areaHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span>
                                计算流程伪代码
                                <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                    (可编辑)
                                </span>
                            </span>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={generateCodeFromDescription}
                                disabled={generatingCode}
                            >
                                {generatingCode ? '生成中...' : '基于伪代码生成代码'}
                            </button>
                        </div>
                        <textarea
                            style={pseudocodeEditorStyle}
                            value={editedPseudocode}
                            onChange={(e) => setEditedPseudocode(e.target.value)}
                            placeholder="输入计算流程伪代码..."
                            spellCheck={false}
                        />
                    </div>

                    {/* 左下：代码展示区（含参数设置） */}
                    <div style={codeAreaStyle}>
                        <div style={areaHeaderStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span>
                                    代码编辑
                                    <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                        (修改后自动保存)
                                    </span>
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                            股票代码
                                        </label>
                                        <input
                                            type="text"
                                            value={stockCode}
                                            onChange={(e) => setStockCode(e.target.value)}
                                            style={smallInputStyle}
                                            placeholder="000001"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                            日期
                                        </label>
                                        <input
                                            type="text"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            style={smallInputStyle}
                                            placeholder="20220819"
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={executeCode}
                                        disabled={executing}
                                        style={{ height: '28px', marginTop: '14px' }}
                                    >
                                        {executing ? '执行中...' : '▶ 运行'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <textarea
                            style={codeEditorStyle}
                            value={editedCode}
                            onChange={(e) => setEditedCode(e.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    {/* 右下：中间指标可视化区 */}
                    <div style={keyVariablesAreaStyle}>
                        <div style={areaHeaderStyle}>
                            关键中间指标
                            {currentExecutionResult?.keyVariables && (
                                <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                    ({Object.keys(currentExecutionResult.keyVariables).length}个)
                                </span>
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            {executing ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="spinner"></div>
                                    <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                        正在执行代码...
                                    </p>
                                </div>
                            ) : currentExecutionResult?.success ? (
                                renderKeyVariables(currentExecutionResult.keyVariables)
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', paddingTop: '40px' }}>
                                    点击运行代码查看可视化结果
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 样式定义
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    width: '95vw',
    height: '95vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
};

const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0
};

// 4区域网格布局
const gridContainerStyle = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '240px 1fr 1fr 2fr', // 左侧边栏 | 说明区(25%) | 因子结果(25%) | 伪代码(50%)
    gridTemplateRows: '35% 65%', // 上35%，下65%
    gap: '12px',
    padding: '12px',
    overflow: 'hidden'
};

const sidebarStyle = {
    gridRow: '1 / 3',
    gridColumn: '1',
    borderRight: '1px solid var(--border-color)',
    padding: '0 12px 0 0',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
};

// 左上：说明区（25%宽）
const descriptionAreaStyle = {
    gridRow: '1',
    gridColumn: '2',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '12px'
};

// 中上：因子结果区（25%宽）
const factorResultAreaStyle = {
    gridRow: '1',
    gridColumn: '3',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '12px'
};

// 右上：伪代码区（50%宽）
const pseudocodeAreaStyle = {
    gridRow: '1',
    gridColumn: '4',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '12px'
};

// 左下：代码展示区（50%宽，含参数设置）
const codeAreaStyle = {
    gridRow: '2',
    gridColumn: '2 / 4',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '12px'
};

// 右下：中间指标可视化区（50%宽）
const keyVariablesAreaStyle = {
    gridRow: '2',
    gridColumn: '4',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '12px'
};

// 执行控制区
const executionControlStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)'
};

const areaHeaderStyle = {
    fontWeight: '600',
    fontSize: '13px',
    marginBottom: '8px',
    color: 'var(--text-secondary)',
    flexShrink: 0
};

const codeEditorStyle = {
    flex: 1,
    width: '100%',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '10px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    resize: 'none',
    outline: 'none',
    overflow: 'auto'
};

const descriptionEditorStyle = {
    flex: 1,
    width: '100%',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '10px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    resize: 'none',
    outline: 'none',
    overflow: 'auto'
};

const pseudocodeEditorStyle = {
    flex: 1,
    width: '100%',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '10px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    resize: 'none',
    outline: 'none',
    overflow: 'auto',
    whiteSpace: 'pre-wrap'
};



const smallInputStyle = {
    padding: '4px 8px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    width: '90px'
};

const tabButtonStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '8px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-color)',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-color)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-color)',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
};

const activeTabStyle = {
    borderTopWidth: '2px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--primary)',
    borderRightWidth: '2px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--primary)',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--primary)',
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--primary)',
    backgroundColor: 'var(--primary-light)'
};

const errorStyle = {
    padding: '10px 20px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--error)',
    borderBottom: '1px solid var(--border-color)',
    fontSize: '13px'
};



const keyVariableItemStyle = {
    marginBottom: '12px',
    padding: '10px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)'
};

const statsTableStyle = {
    width: '100%',
    fontSize: '11px',
    borderCollapse: 'collapse',
    marginBottom: '6px'
};

const statsLabelStyle = {
    padding: '3px 6px',
    color: 'var(--text-muted)',
    fontWeight: '500',
    textAlign: 'left',
    width: '20%'
};

const statsValueStyle = {
    padding: '3px 6px',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    width: '30%'
};
