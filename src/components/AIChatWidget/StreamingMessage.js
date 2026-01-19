import { useState, useMemo } from 'react';
import { marked } from 'marked';

export default function StreamingMessage({ events }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [expandedTools, setExpandedTools] = useState(new Set());

  const message = useMemo(() => {
    let reasoning = '';
    let text = '';
    const toolCalls = new Map();

    events.forEach(event => {
      switch (event.type) {
        case 'reasoning':
          reasoning += event.text || '';
          break;
        case 'text':
          text += event.text || '';
          break;
        case 'tool':
          // 使用工具名+标题作为唯一标识，保留最新状态
          const key = `${event.tool}_${event.title || event.tool}`;
          const existing = toolCalls.get(key) || {};
          toolCalls.set(key, {
            ...existing,
            ...event,
            key,
            // 保留已有的输入/输出，除非有新的
            input: event.input || existing.input,
            output: event.output || existing.output
          });
          break;
      }
    });

    return { reasoning, text, toolCalls: Array.from(toolCalls.values()) };
  }, [events]);

  const getStatusIcon = (status) => {
    const icons = { pending: '⏳', running: '🔄', completed: '✅', error: '❌' };
    return icons[status] || '🔧';
  };

  const toggleToolExpand = (key) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatToolData = (data) => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="ai-chat-streaming-message">
      {message.reasoning && (
        <div className="ai-chat-reasoning-section">
          <button
            className="ai-chat-reasoning-toggle"
            onClick={() => setShowReasoning(!showReasoning)}
          >
            <span>{showReasoning ? '🔽' : '▶️'}</span>
            <span>思考过程</span>
          </button>
          {showReasoning && (
            <div className="ai-chat-reasoning-content">{message.reasoning}</div>
          )}
        </div>
      )}

      {message.toolCalls.length > 0 && (
        <div className="ai-chat-tool-calls">
          {message.toolCalls.map(call => (
            <div key={call.key} className={`ai-chat-tool-call status-${call.status}`}>
              <div 
                className="ai-chat-tool-call-header"
                onClick={() => toggleToolExpand(call.key)}
                style={{ cursor: 'pointer' }}
              >
                <span>{getStatusIcon(call.status)}</span>
                <span className="ai-chat-tool-name">{call.title || call.tool}</span>
                <span className="ai-chat-tool-expand-icon">
                  {expandedTools.has(call.key) ? '🔽' : '▶️'}
                </span>
              </div>
              {expandedTools.has(call.key) && (
                <div className="ai-chat-tool-details">
                  {call.input && (
                    <div className="ai-chat-tool-section">
                      <div className="ai-chat-tool-section-label">输入:</div>
                      <pre className="ai-chat-tool-data">{formatToolData(call.input)}</pre>
                    </div>
                  )}
                  {call.output && (
                    <div className="ai-chat-tool-section">
                      <div className="ai-chat-tool-section-label">输出:</div>
                      <pre className="ai-chat-tool-data">{formatToolData(call.output)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {message.text && (
        <div className="ai-chat-message-row assistant">
          <div className="ai-chat-message-bubble assistant">
            <div
              className="markdown-content ai-chat-message-markdown"
              dangerouslySetInnerHTML={{ __html: marked.parse(message.text) }}
            />
          </div>
        </div>
      )}

      {!message.text && !message.reasoning && message.toolCalls.length === 0 && (
        <div className="ai-chat-message-row assistant">
          <div className="ai-chat-loading-bubble">
            <div className="ai-chat-loading-dots">
              <span className="ai-chat-loading-dot"></span>
              <span className="ai-chat-loading-dot"></span>
              <span className="ai-chat-loading-dot"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
