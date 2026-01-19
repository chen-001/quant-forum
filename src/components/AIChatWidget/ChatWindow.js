'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { WindowState } from './hooks/useDraggable';
import { useStreamingChat } from './hooks/useStreamingChat';
import StreamingMessage from './StreamingMessage';

// 历史消息中的思考过程组件
function HistoryReasoning({ reasoning }) {
  const [showReasoning, setShowReasoning] = useState(false);
  
  if (!reasoning) return null;
  
  return (
    <div className="ai-chat-reasoning-section">
      <button
        className="ai-chat-reasoning-toggle"
        onClick={() => setShowReasoning(!showReasoning)}
      >
        <span>{showReasoning ? '🔽' : '▶️'}</span>
        <span>思考过程</span>
      </button>
      {showReasoning && (
        <div className="ai-chat-reasoning-content">{reasoning}</div>
      )}
    </div>
  );
}

// 历史消息中的工具调用组件
function HistoryToolCalls({ toolCalls }) {
  const [expandedTools, setExpandedTools] = useState(new Set());
  
  if (!toolCalls || toolCalls.length === 0) return null;
  
  const getStatusIcon = (status) => {
    const icons = { pending: '⏳', running: '🔄', completed: '✅', error: '❌' };
    return icons[status] || '🔧';
  };
  
  const toggleToolExpand = (index) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
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
    <div className="ai-chat-tool-calls">
      {toolCalls.map((call, index) => (
        <div key={index} className={`ai-chat-tool-call status-${call.status}`}>
          <div 
            className="ai-chat-tool-call-header"
            onClick={() => toggleToolExpand(index)}
            style={{ cursor: 'pointer' }}
          >
            <span>{getStatusIcon(call.status)}</span>
            <span className="ai-chat-tool-name">{call.title || call.tool}</span>
            <span className="ai-chat-tool-expand-icon">
              {expandedTools.has(index) ? '🔽' : '▶️'}
            </span>
          </div>
          {expandedTools.has(index) && (
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
  );
}

/**
 * AI聊天悬浮窗组件
 * @param {Object} props
 * @param {string} props.pageType - 页面类型
 * @param {number} props.contextId - 上下文ID
 * @param {string} props.windowState - 窗口状态
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onMinimize - 最小化回调
 * @param {Function} props.onStartDrag - 开始拖拽回调
 * @param {Function} props.getPositionStyle - 获取位置样式
 * @param {React.RefObject} props.handleRef - 拖拽手柄引用
 * @param {React.RefObject} props.resizeHandleRef - 调整大小手柄引用
 * @param {Function} props.onStartResize - 开始调整大小回调
 * @param {Object} props.size - 窗口尺寸 {width, height}
 */
export default function ChatWindow({
  pageType,
  contextId,
  windowState,
  onClose,
  onMinimize,
  onStartDrag,
  getPositionStyle,
  handleRef,
  resizeHandleRef,
  onStartResize,
  size
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [streamingEvents, setStreamingEvents] = useState([]);
  const messagesEndRef = useRef(null);
  const { isStreaming, sendStreamingMessage } = useStreamingChat();

  const isMinimized = windowState === WindowState.MINIMIZED;

  // 获取对话列表
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/ai/chat');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取对话列表失败');
      }
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('获取对话列表失败:', error);
      setConversations([]);
    }
  };

  // 创建新对话
  const createConversation = async () => {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageType,
          contextId,
          title: null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '创建对话失败');
      }
      await fetchConversations();
      setActiveConversation(data.conversation);
      setShowConversationList(false);
      setMessages([]);
      return data.conversation;
    } catch (error) {
      console.error('创建对话失败:', error);
      alert(error.message || '创建对话失败，请重试。');
      return null;
    }
  };

  // 获取对话消息
  const fetchMessages = async (conversationId) => {
    try {
      const res = await fetch(`/api/ai/chat/${conversationId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取消息失败');
      }
      setMessages(data.messages || []);
    } catch (error) {
      console.error('获取消息失败:', error);
      alert(error.message || '获取消息失败，请重试。');
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (isStreaming) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    let currentConversation = activeConversation;
    if (!currentConversation) {
      currentConversation = await createConversation();
      if (!currentConversation) {
        return;
      }
    }

    const content = trimmed;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content }]);
    setStreamingEvents([]);

    await sendStreamingMessage(currentConversation.id, content, (event) => {
      switch (event.type) {
        case 'reasoning':
        case 'text':
        case 'tool':
          setStreamingEvents(prev => [...prev, event]);
          break;
        case 'done':
          fetchMessages(currentConversation.id);
          setStreamingEvents([]);
          break;
        case 'error':
          setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${event.error}` }]);
          setStreamingEvents([]);
          break;
      }
    });
  };

  // 删除对话
  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ai/chat/${conversationId}`, { method: 'DELETE' });
      await fetchConversations();
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
        setShowConversationList(true);
      }
    } catch (error) {
      console.error('删除对话失败:', error);
    }
  };

  // 选择对话
  const selectConversation = (conversation) => {
    setActiveConversation(conversation);
    setShowConversationList(false);
    fetchMessages(conversation.id);
  };

  // 回到对话列表
  const backToList = () => {
    setShowConversationList(true);
  };

  // 开始编辑标题
  const startEditingTitle = (conversation, e) => {
    e.stopPropagation();
    setEditingTitleId(conversation.id);
    setEditingTitleValue(conversation.title || '');
  };

  // 保存标题
  const saveTitle = async (conversationId, e) => {
    e?.stopPropagation();
    const trimmedTitle = editingTitleValue.trim();
    if (!trimmedTitle) {
      setEditingTitleId(null);
      return;
    }

    try {
      const res = await fetch(`/api/ai/chat/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '更新标题失败');
      }
      await fetchConversations();
      if (activeConversation?.id === conversationId) {
        setActiveConversation(data.conversation);
      }
    } catch (error) {
      console.error('更新标题失败:', error);
      alert(error.message || '更新标题失败，请重试。');
    } finally {
      setEditingTitleId(null);
      setEditingTitleValue('');
    }
  };

  // 取消编辑标题
  const cancelEditingTitle = (e) => {
    e?.stopPropagation();
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  // 拖拽开始处理
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    onStartDrag(e.clientX, e.clientY);
  }, [onStartDrag]);

  // 初始化
  useEffect(() => {
    fetchConversations();
  }, []);

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 鼠标事件处理（仅绑定到元素，全局事件由父组件处理）
  useEffect(() => {
    const handleDragMouseDown = (e) => {
      handleMouseDown(e);
    };

    const handleResizeMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onStartResize('se', e.clientX, e.clientY);
    };

    if (handleRef.current) {
      handleRef.current.addEventListener('mousedown', handleDragMouseDown);
    }

    if (resizeHandleRef?.current) {
      resizeHandleRef.current.addEventListener('mousedown', handleResizeMouseDown);
    }

    return () => {
      if (handleRef.current) {
        handleRef.current.removeEventListener('mousedown', handleDragMouseDown);
      }
      if (resizeHandleRef?.current) {
        resizeHandleRef.current.removeEventListener('mousedown', handleResizeMouseDown);
      }
    };
  }, [handleRef, resizeHandleRef, handleMouseDown, onStartResize]);

  // 渲染消息内容
  const renderMessage = (message) => {
    if (message.role === 'tool') {
      return (
        <div className="ai-chat-tool-message">
          <span className="ai-chat-tool-icon">🔧</span> 工具调用结果
        </div>
      );
    }

    const isUser = message.role === 'user';
    
    // 解析 tool_calls 中的思考过程和工具调用
    const toolCallsData = message.tool_calls;
    const reasoning = toolCallsData?.reasoning;
    const toolCalls = toolCallsData?.toolCalls;
    
    return (
      <div className={`ai-chat-message-row ${isUser ? 'user' : 'assistant'}`}>
        <div className={`ai-chat-message-bubble ${isUser ? 'user' : 'assistant'}`}>
          {isUser ? (
            <div className="ai-chat-message-text">{message.content}</div>
          ) : (
            <>
              {/* 思考过程 */}
              {reasoning && (
                <HistoryReasoning reasoning={reasoning} />
              )}
              
              {/* 工具调用 */}
              {toolCalls && toolCalls.length > 0 && (
                <HistoryToolCalls toolCalls={toolCalls} />
              )}
              
              {/* 最终回答 */}
              {message.content && (
                <div
                  className="markdown-content ai-chat-message-markdown"
                  dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const positionStyle = getPositionStyle();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const windowStyle = {
    ...positionStyle,
    width: isMobile ? '100%' : `${size?.width || 380}px`,
    height: isMinimized ? '50px' : isMobile ? '80vh' : `${size?.height || 600}px`
  };

  return (
    <div
      className={`ai-chat-window ${isMinimized ? 'minimized' : ''} ${isMobile ? 'mobile' : ''}`}
      style={windowStyle}
    >
      {/* 头部 */}
      <div
        ref={handleRef}
        onMouseDown={handleMouseDown}
        className="ai-chat-header"
        style={isMobile ? {} : { cursor: isMinimized ? 'pointer' : 'grab' }}
        onClick={isMinimized ? onClose : undefined}
      >
        <div className="ai-chat-header-left">
          {!showConversationList && activeConversation && !isMinimized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                backToList();
              }}
              className="ai-chat-header-button"
              title="返回列表"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="ai-chat-header-title">
            {isMinimized && activeConversation ? (activeConversation.title || `对话 ${activeConversation.id}`) : 'AI问答'}
          </h2>
        </div>
        <div className="ai-chat-header-actions">
          {!isMinimized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="ai-chat-header-button"
              title="最小化"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ai-chat-header-button"
            title="关闭"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {!isMinimized && (
        <div className="ai-chat-content">
          {showConversationList ? (
            // 对话列表
            <div className="ai-chat-list">
              <div className="ai-chat-list-header">
                <button
                  onClick={createConversation}
                  className="btn btn-primary ai-chat-new-button"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新建对话
                </button>
              </div>

              <div className="ai-chat-list-body">
                {conversations.length === 0 ? (
                  <div className="ai-chat-empty">
                    暂无对话，点击上方按钮创建新对话
                  </div>
                ) : (
                  <div className="ai-chat-conversation-list">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => editingTitleId !== conv.id && selectConversation(conv)}
                        className="ai-chat-conversation"
                      >
                        <div className="ai-chat-conversation-info">
                          {editingTitleId === conv.id ? (
                            <div className="ai-chat-title-edit">
                              <input
                                type="text"
                                value={editingTitleValue}
                                onChange={(e) => setEditingTitleValue(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    saveTitle(conv.id, e);
                                  } else if (e.key === 'Escape') {
                                    cancelEditingTitle(e);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="input ai-chat-title-input"
                                autoFocus
                              />
                              <div className="ai-chat-title-edit-actions">
                                <button
                                  onClick={(e) => saveTitle(conv.id, e)}
                                  className="ai-chat-title-save"
                                  title="保存"
                                >
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => cancelEditingTitle(e)}
                                  className="ai-chat-title-cancel"
                                  title="取消"
                                >
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="ai-chat-conversation-title">
                                {conv.title || `对话 ${conv.id}`}
                              </div>
                              <div className="ai-chat-conversation-meta">
                                {conv.message_count || 0} 条消息
                              </div>
                            </>
                          )}
                        </div>
                        {editingTitleId !== conv.id && (
                          <>
                            <button
                              onClick={(e) => startEditingTitle(conv, e)}
                              className="ai-chat-conversation-edit"
                              title="编辑标题"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="ai-chat-conversation-delete"
                              title="删除对话"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 聊天区域
            <div className="ai-chat-conversation-view">
              {/* 消息列表 */}
              <div className="ai-chat-messages">
                {messages.length === 0 ? (
                  <div className="ai-chat-empty">
                    开始新的对话吧！
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx}>
                      {renderMessage(msg)}
                    </div>
                  ))
                )}
                {streamingEvents.length > 0 && <StreamingMessage events={streamingEvents} />}
                {isLoading && (
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
                <div ref={messagesEndRef} />
              </div>

              {/* 输入框 */}
              <div className="ai-chat-input-panel">
                <div className="ai-chat-input-row">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="输入问题..."
                    disabled={isStreaming}
                    className="input ai-chat-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isStreaming || !inputValue.trim()}
                    className="btn btn-primary ai-chat-send-button"
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 调整大小手柄 */}
      {!isMinimized && !isMobile && (
        <div
          ref={resizeHandleRef}
          className="ai-chat-resize-handle"
          title="拖动调整大小"
        />
      )}
    </div>
  );
}
