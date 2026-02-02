'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// 动态导入Plotly以避免SSR问题
const Plot = dynamic(() => import('react-plotly.js').then(mod => mod.default), {
    ssr: false,
    loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载图表...</div>
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
    const [variants, setVariants] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [stockCode, setStockCode] = useState('000001');
    const [date, setDate] = useState('20220819');
    const [executionResult, setExecutionResult] = useState(null);
    const [error, setError] = useState(null);
    const [isGenerated, setIsGenerated] = useState(false);
    const [editedCode, setEditedCode] = useState('');

    // 加载探索方案
    useEffect(() => {
        loadExploration();
    }, [commentId]);

    // 自动保存修改
    useEffect(() => {
        if (isGenerated && editedCode !== variants[activeTab]?.code) {
            const timer = setTimeout(() => {
                saveExploration();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [editedCode, activeTab]);

    const loadExploration = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/explore?commentId=${commentId}`);
            const data = await res.json();

            if (data.isGenerated) {
                setVariants(data.variants);
                setStockCode(data.defaultCode);
                setDate(String(data.defaultDate));
                setIsGenerated(true);
                setEditedCode(data.variants[0]?.code || '');
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
                setEditedCode(data.variants[0]?.code || '');
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
                setEditedCode(data.variants[activeTab]?.code || '');
                setExecutionResult(null);
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
        newVariants[activeTab] = { ...newVariants[activeTab], code: editedCode };

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
            setExecutionResult(null);

            const res = await fetch('/api/explore/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: editedCode,
                    stockCode,
                    date: parseInt(date)
                })
            });
            const data = await res.json();

            if (data.success) {
                setExecutionResult(data);
            } else {
                setError(data.error || '执行失败');
                setExecutionResult(data);
            }
        } catch (err) {
            setError('执行失败: ' + err.message);
        } finally {
            setExecuting(false);
        }
    };

    const handleTabChange = (index) => {
        // 保存当前tab的修改
        if (editedCode !== variants[activeTab]?.code) {
            const newVariants = [...variants];
            newVariants[activeTab] = { ...newVariants[activeTab], code: editedCode };
            setVariants(newVariants);
        }
        setActiveTab(index);
        setEditedCode(variants[index]?.code || '');
        setExecutionResult(null);
    };

    // 渲染字典类型因子值为表格
    const renderDictFactor = (value) => {
        if (!value || typeof value !== 'object') return null;
        
        const entries = Object.entries(value);
        if (entries.length === 0) return null;

        return (
            <table style={{
                width: '100%',
                fontSize: '13px',
                borderCollapse: 'collapse',
                marginTop: '8px'
            }}>
                <tbody>
                    {entries.map(([key, val]) => (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ 
                                padding: '8px 12px', 
                                color: 'var(--text-secondary)', 
                                fontWeight: '500',
                                width: '50%'
                            }}>
                                {key}
                            </td>
                            <td style={{ 
                                padding: '8px 12px', 
                                color: 'var(--primary)',
                                fontWeight: '600',
                                fontFamily: 'monospace',
                                textAlign: 'right'
                            }}>
                                {typeof val === 'number' ? val.toFixed(6) : String(val)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // 渲染因子结果（支持多因子）
    const renderFactors = (factors, plotlyData) => {
        if (!factors || Object.keys(factors).length === 0) {
            return <div style={{ color: 'var(--text-muted)' }}>无因子数据</div>;
        }

        const factorNames = Object.keys(factors);

        return (
            <div style={{ overflow: 'auto', height: '100%' }}>
                {factorNames.map((factorName) => {
                    const factorData = factors[factorName];
                    return (
                        <div key={factorName} style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                {factorName}
                            </div>
                            {factorData.type === 'Scalar' && (
                                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary)' }}>
                                    {factorData.value?.toFixed(6) || 'N/A'}
                                </div>
                            )}
                            {factorData.type === 'Dict' && (
                                renderDictFactor(factorData.value)
                            )}
                            {factorData.type === 'Series' && factorData.data && (
                                <>
                                    <div style={{ height: '120px' }}>
                                        <Plot
                                            data={[{
                                                x: factorData.data.x,
                                                y: factorData.data.y,
                                                type: 'scatter',
                                                mode: 'lines',
                                                line: { color: 'var(--primary)', width: 1.5 },
                                                name: factorName
                                            }]}
                                            layout={{
                                                autosize: true,
                                                paper_bgcolor: 'transparent',
                                                plot_bgcolor: 'transparent',
                                                font: { color: 'var(--text-primary)', size: 9 },
                                                margin: { l: 35, r: 10, t: 10, b: 20 },
                                                xaxis: { showgrid: false, zeroline: false, tickfont: { size: 8 } },
                                                yaxis: { showgrid: true, gridcolor: 'var(--border-color)', zeroline: false, tickfont: { size: 8 } },
                                                showlegend: false
                                            }}
                                            style={{ width: '100%', height: '100%' }}
                                            useResizeHandler={true}
                                            config={{ displayModeBar: false }}
                                        />
                                    </div>
                                    {factorData.stats && (
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            均值: {factorData.stats.mean?.toFixed(4)} | 
                                            标准差: {factorData.stats.std?.toFixed(4)} |
                                            最值: [{factorData.stats.min?.toFixed(4)}, {factorData.stats.max?.toFixed(4)}]
                                        </div>
                                    )}
                                </>
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

                {/* 主体内容 */}
                <div style={bodyStyle}>
                    {/* 左侧Tab栏 */}
                    <div style={sidebarStyle}>
                        <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                            构造方案
                        </div>
                        {variants.map((variant, index) => (
                            <button
                                key={index}
                                style={{
                                    ...tabButtonStyle,
                                    ...(activeTab === index ? activeTabStyle : {})
                                }}
                                onClick={() => handleTabChange(index)}
                            >
                                <div style={{ fontWeight: '600' }}>{variant.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {variant.description}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* 右侧内容区 */}
                    <div style={mainContentStyle}>
                        {/* 代码编辑区和描述区 */}
                        <div style={codeSectionStyle}>
                            {/* 左侧：代码编辑器 */}
                            <div style={codeEditorContainerStyle}>
                                <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                    代码编辑
                                    <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '8px', color: 'var(--text-muted)' }}>
                                        (修改后自动保存)
                                    </span>
                                </div>
                                <textarea
                                    style={codeEditorStyle}
                                    value={editedCode}
                                    onChange={(e) => setEditedCode(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                            {/* 右侧：方案描述 */}
                            <div style={descriptionContainerStyle}>
                                <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                    方案说明
                                </div>
                                <div style={descriptionContentStyle}>
                                    {variants[activeTab]?.description || '暂无描述'}
                                </div>
                            </div>
                        </div>

                        {/* 参数输入区 */}
                        <div style={paramsSectionStyle}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        股票代码
                                    </label>
                                    <input
                                        type="text"
                                        value={stockCode}
                                        onChange={(e) => setStockCode(e.target.value)}
                                        style={inputStyle}
                                        placeholder="000001"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        日期
                                    </label>
                                    <input
                                        type="text"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        style={inputStyle}
                                        placeholder="20220819"
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={executeCode}
                                    disabled={executing}
                                    style={{ height: '38px' }}
                                >
                                    {executing ? '执行中...' : '▶ 运行代码'}
                                </button>
                            </div>
                        </div>

                        {/* 结果展示区 */}
                        <div style={resultSectionStyle}>
                            <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                执行结果
                            </div>
                            {executing ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="spinner"></div>
                                    <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
                                        正在执行代码，最多60秒...
                                    </p>
                                </div>
                            ) : executionResult ? (
                                <div>
                                    {executionResult.success ? (
                                        <div style={resultSplitContainerStyle}>
                                            {/* 左侧：因子结果 */}
                                            <div style={finalResultContainerStyle}>
                                                <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                                    因子结果 ({Object.keys(executionResult.factors || {}).length}个)
                                                </div>
                                                {renderFactors(executionResult.factors, executionResult.plotlyData)}
                                            </div>
                                            {/* 右侧：关键中间指标 */}
                                            <div style={keyVariablesContainerStyle}>
                                                <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                                    关键中间指标 ({Object.keys(executionResult.keyVariables || {}).length}个)
                                                </div>
                                                {renderKeyVariables(executionResult.keyVariables)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ color: 'var(--error)', marginBottom: '12px' }}>
                                                ✗ 执行失败: {executionResult.error}
                                            </div>
                                            {executionResult.traceback && (
                                                <pre style={tracebackStyle}>
                                                    {executionResult.traceback}
                                                </pre>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    点击"运行代码"查看执行结果
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
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0
};

const bodyStyle = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
};

const sidebarStyle = {
    width: '240px',
    borderRight: '1px solid var(--border-color)',
    padding: '16px',
    overflowY: 'auto',
    flexShrink: 0
};

const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

const codeSectionStyle = {
    flex: 1,
    padding: '16px 24px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    gap: '16px'
};

const codeEditorContainerStyle = {
    flex: 7,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

const codeEditorStyle = {
    flex: 1,
    width: '100%',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    padding: '12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    resize: 'none',
    outline: 'none'
};

const descriptionContainerStyle = {
    flex: 3,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

const descriptionContentStyle = {
    flex: 1,
    padding: '12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    lineHeight: '1.6',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap'
};

const paramsSectionStyle = {
    padding: '12px 24px',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    flexShrink: 0
};

const inputStyle = {
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    width: '120px'
};

const resultSectionStyle = {
    flex: 1,
    padding: '16px 24px',
    borderTop: '1px solid var(--border-color)',
    overflow: 'auto'
};

const tabButtonStyle = {
    width: '100%',
    padding: '12px',
    marginBottom: '8px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
};

const activeTabStyle = {
    border: '1px solid var(--primary)',
    backgroundColor: 'var(--primary-light)'
};

const errorStyle = {
    padding: '12px 24px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--error)',
    borderBottom: '1px solid var(--border-color)'
};

const tracebackStyle = {
    backgroundColor: 'var(--bg-secondary)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: '300px',
    color: 'var(--text-secondary)'
};

// 结果展示区样式
const resultSplitContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: '16px',
    height: '100%'
};

const finalResultContainerStyle = {
    flex: 3,
    padding: '12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    overflow: 'auto'
};

const keyVariablesContainerStyle = {
    flex: 7,
    padding: '12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    overflow: 'auto'
};

const scalarResultStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)'
};

const keyVariableItemStyle = {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)'
};

const statsTableStyle = {
    width: '100%',
    fontSize: '12px',
    borderCollapse: 'collapse',
    marginBottom: '8px'
};

const statsLabelStyle = {
    padding: '4px 8px',
    color: 'var(--text-muted)',
    fontWeight: '500',
    textAlign: 'left',
    width: '20%'
};

const statsValueStyle = {
    padding: '4px 8px',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    width: '30%'
};
