'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export default function ImageLightbox({ isOpen, image, postId, onClose, onFavorite, onTodo, user }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setImageLoaded(false);
            setImageError(false);
            setScale(1);
            setPosition({ x: 0, y: 0 });
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        const handleKeyboard = (e) => {
            if (!isOpen) return;

            switch (e.key) {
                case '+':
                case '=':
                    handleZoomIn();
                    break;
                case '-':
                case '_':
                    handleZoomOut();
                    break;
                case '0':
                    resetZoom();
                    break;
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('keydown', handleKeyboard);
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('keydown', handleKeyboard);
        };
    }, [isOpen, onClose, scale]);

    // 缩放函数
    const handleZoomIn = useCallback(() => {
        setScale(prev => Math.min(4, prev + 0.25));
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale(prev => Math.max(0.25, prev - 0.25));
    }, []);

    const resetZoom = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const setZoomLevel = useCallback((level) => {
        setScale(level);
        setPosition({ x: 0, y: 0 });
    }, []);

    // 鼠标滚轮缩放
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.25, Math.min(4, scale + delta));
        setScale(newScale);
    }, [scale]);

    // 双击切换缩放
    const handleDoubleClick = useCallback(() => {
        if (scale === 1) {
            setScale(2);
        } else {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [scale]);

    // 拖拽处理
    const handleMouseDown = useCallback((e) => {
        if (scale > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    }, [scale, position]);

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    if (!isOpen || !image) return null;

    return (
        <div
            className="image-lightbox"
            onClick={onClose}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <button
                className="image-lightbox-close"
                onClick={onClose}
                aria-label="关闭"
            >
                ×
            </button>

            <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                {!imageLoaded && !imageError && (
                    <div className="image-lightbox-loading">
                        <div className="spinner"></div>
                        <p>加载中...</p>
                    </div>
                )}

                {imageError ? (
                    <div className="image-lightbox-error">
                        <p>图片加载失败</p>
                    </div>
                ) : (
                    <div
                        ref={imageRef}
                        className={`image-lightbox-image-wrapper ${isDragging ? 'dragging' : ''}`}
                        style={{
                            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                        }}
                    >
                        <img
                            src={image.src}
                            alt={image.alt || '图片预览'}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageError(true);
                                setImageLoaded(true);
                            }}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onDoubleClick={handleDoubleClick}
                            style={{
                                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                                transition: isDragging ? 'none' : 'transform 0.1s ease'
                            }}
                        />
                    </div>
                )}

                {image.alt && imageLoaded && (
                    <div className="image-lightbox-caption">
                        {image.alt}
                    </div>
                )}
            </div>

            {imageLoaded && !imageError && (
                <div className="image-lightbox-controls" onClick={(e) => e.stopPropagation()}>
                    <button
                        className="image-lightbox-zoom-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleZoomOut();
                        }}
                        aria-label="缩小"
                        disabled={scale <= 0.25}
                    >
                        −
                    </button>
                    <span className="image-lightbox-zoom-level">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        className="image-lightbox-zoom-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleZoomIn();
                        }}
                        aria-label="放大"
                        disabled={scale >= 4}
                    >
                        +
                    </button>
                    <button
                        className="image-lightbox-zoom-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            resetZoom();
                        }}
                        aria-label="重置"
                    >
                        ↺
                    </button>
                    {user && (
                        <>
                            <button
                                className="image-lightbox-zoom-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onFavorite) onFavorite(image?.src);
                                }}
                                aria-label="收藏"
                                title="收藏"
                            >
                                ☆
                            </button>
                            <button
                                className="image-lightbox-zoom-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onTodo) onTodo(image?.src);
                                }}
                                aria-label="添加到待办"
                                title="添加到待办"
                            >
                                📋
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
