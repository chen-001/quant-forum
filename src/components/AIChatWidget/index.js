'use client';

import { useEffect, useCallback, useState } from 'react';
import { useDraggable } from './hooks/useDraggable';
import FloatingButton from './FloatingButton';
import ChatWindow from './ChatWindow';

/**
 * AI聊天悬浮窗组件
 * @param {string} pageType - 页面类型
 * @param {number} contextId - 上下文ID（如帖子ID）
 */
export default function AIChatWidget({ pageType, contextId = null }) {
  const [mounted, setMounted] = useState(false);

  const {
    windowState,
    isDragging,
    isResizing,
    handleRef,
    resizeHandleRef,
    open,
    minimize,
    close,
    startDrag,
    onDrag,
    endDrag,
    startResize,
    onResize,
    endResize,
    getPositionStyle,
    size
  } = useDraggable();

  // 确保客户端挂载后才渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 全局鼠标事件处理拖拽和调整大小
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        onDrag(e.clientX, e.clientY);
      }
      if (isResizing) {
        onResize(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        endDrag();
      }
      if (isResizing) {
        endResize();
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizing ? 'se-resize' : 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isResizing, onDrag, onResize, endDrag, endResize]);

  if (!mounted) return null;

  const showButton = windowState === 'closed';

  return (
    <>
      <FloatingButton
        onClick={open}
        isVisible={showButton}
      />

      {(windowState === 'minimized' || windowState === 'expanded') && (
        <ChatWindow
          pageType={pageType}
          contextId={contextId}
          windowState={windowState}
          onClose={close}
          onMinimize={minimize}
          onStartDrag={startDrag}
          getPositionStyle={getPositionStyle}
          handleRef={handleRef}
          resizeHandleRef={resizeHandleRef}
          onStartResize={startResize}
          size={size}
        />
      )}
    </>
  );
}
