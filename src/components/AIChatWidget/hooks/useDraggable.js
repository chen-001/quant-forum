'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'ai-chat-widget-position';

const DEFAULT_POSITION = { x: null, y: null };
const DEFAULT_SIZE = { width: 380, height: 600 };

/**
 * 从localStorage获取保存的位置和尺寸
 */
function loadFromStorage() {
  if (typeof window === 'undefined') return { position: DEFAULT_POSITION, size: DEFAULT_SIZE };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return {
        position: { x: data.x, y: data.y },
        size: { width: data.width || DEFAULT_SIZE.width, height: data.height || DEFAULT_SIZE.height }
      };
    }
  } catch {}
  return { position: DEFAULT_POSITION, size: DEFAULT_SIZE };
}

/**
 * 保存位置和尺寸到localStorage
 */
function saveToStorage(position, size) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    }));
  } catch {}
}

/**
 * 窗口状态枚举
 */
export const WindowState = {
  CLOSED: 'closed',
  MINIMIZED: 'minimized',
  EXPANDED: 'expanded'
};

/**
 * 拖拽和状态管理Hook
 * @param {Function} onStateChange - 状态变化回调
 */
export function useDraggable(onStateChange) {
  const [windowState, setWindowState] = useState(WindowState.CLOSED);
  const [position, setPosition] = useState(() => loadFromStorage().position);
  const [size, setSize] = useState(() => loadFromStorage().size);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const sizeStartRef = useRef({ width: 0, height: 0 });
  const handleRef = useRef(null);
  const resizeHandleRef = useRef(null);

  // 打开窗口
  const open = useCallback(() => {
    setWindowState(WindowState.EXPANDED);
    onStateChange?.(WindowState.EXPANDED);
  }, [onStateChange]);

  // 最小化窗口
  const minimize = useCallback(() => {
    setWindowState(WindowState.MINIMIZED);
    onStateChange?.(WindowState.MINIMIZED);
  }, [onStateChange]);

  // 关闭窗口
  const close = useCallback(() => {
    setWindowState(WindowState.CLOSED);
    onStateChange?.(WindowState.CLOSED);
  }, [onStateChange]);

  // 切换最小化/展开
  const toggleMinimize = useCallback(() => {
    if (windowState === WindowState.MINIMIZED) {
      setWindowState(WindowState.EXPANDED);
      onStateChange?.(WindowState.EXPANDED);
    } else if (windowState === WindowState.EXPANDED) {
      setWindowState(WindowState.MINIMIZED);
      onStateChange?.(WindowState.MINIMIZED);
    }
  }, [windowState, onStateChange]);

  // 开始拖拽
  const startDrag = useCallback((clientX, clientY) => {
    if (windowState !== WindowState.EXPANDED) return;
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { ...position };
  }, [windowState, position]);

  // 拖拽中
  const onDrag = useCallback((clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy
    });
  }, [isDragging]);

  // 结束拖拽
  const endDrag = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
  }, [isDragging]);

  // 开始调整大小
  const startResize = useCallback((direction, clientX, clientY) => {
    if (windowState !== WindowState.EXPANDED) return;
    setIsResizing(true);
    setResizeDirection(direction);
    dragStartRef.current = { x: clientX, y: clientY };
    sizeStartRef.current = { ...size };
    positionStartRef.current = { ...position };
  }, [windowState, size, position]);

  // 调整大小中
  const onResize = useCallback((clientX, clientY) => {
    if (!isResizing) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    const startSize = sizeStartRef.current;
    const startPos = positionStartRef.current;

    const MIN_WIDTH = 300;
    const MIN_HEIGHT = 400;

    let newSize = { ...size };
    let newPosition = { ...position };

    if (resizeDirection.includes('e')) {
      newSize.width = Math.max(MIN_WIDTH, startSize.width + dx);
    }
    if (resizeDirection.includes('s')) {
      newSize.height = Math.max(MIN_HEIGHT, startSize.height + dy);
    }
    if (resizeDirection.includes('w')) {
      const newWidth = Math.max(MIN_WIDTH, startSize.width - dx);
      newSize.width = newWidth;
      newPosition.x = startPos.x + (startSize.width - newWidth);
    }
    if (resizeDirection.includes('n')) {
      const newHeight = Math.max(MIN_HEIGHT, startSize.height - dy);
      newSize.height = newHeight;
      newPosition.y = startPos.y + (startSize.height - newHeight);
    }

    setSize(newSize);
    setPosition(newPosition);
  }, [isResizing, resizeDirection, size, position]);

  // 结束调整大小
  const endResize = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);
    setResizeDirection(null);
  }, [isResizing]);

  // 保存位置和尺寸
  const saveState = useCallback(() => {
    saveToStorage(position, size);
  }, [position, size]);

  // 拖拽/调整大小结束时自动保存
  useEffect(() => {
    if (!isDragging && !isResizing) {
      saveState();
    }
  }, [isDragging, isResizing, saveState]);

  // 计算实际样式位置
  const getPositionStyle = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      return {
        left: '0',
        right: '0',
        bottom: '0',
        margin: '0 auto',
        width: '100%'
      };
    }
    if (position.x === null || position.y === null) {
      return {
        right: '24px',
        bottom: '80px'
      };
    }
    return {
      left: `${position.x}px`,
      top: `${position.y}px`
    };
  }, [position]);

  return {
    windowState,
    position,
    size,
    isDragging,
    isResizing,
    handleRef,
    resizeHandleRef,
    open,
    minimize,
    close,
    toggleMinimize,
    startDrag,
    onDrag,
    endDrag,
    startResize,
    onResize,
    endResize,
    getPositionStyle,
    setPosition,
    setSize
  };
}
