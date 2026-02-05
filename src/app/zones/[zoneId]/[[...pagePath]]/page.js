'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ZoneList from '@/components/zones/ZoneList';
import ZonePageTree from '@/components/zones/ZonePageTree';
import ZonePageContent from '@/components/zones/ZonePageContent';
import ZoneDiscussion from '@/components/zones/ZoneDiscussion';

export default function ZonePageDetail({ params }) {
    const { zoneId, pagePath } = use(params);
    const router = useRouter();
    const [zone, setZone] = useState(null);
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [treeWidth, setTreeWidth] = useState(250);
    const [discussionWidth, setDiscussionWidth] = useState(350);
    const [isResizingTree, setIsResizingTree] = useState(false);
    const [isResizingDiscussion, setIsResizingDiscussion] = useState(false);

    // 获取当前用户信息
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                setUser(data.user);
            } catch (error) {
                console.error('Failed to fetch user:', error);
            }
        };
        fetchUser();
    }, []);

    // 获取专区和页面数据
    const fetchData = useCallback(async () => {
        try {
            // 获取专区详情和页面树
            const res = await fetch(`/api/zones/${zoneId}/pages?tree=1`);
            const data = await res.json();
            
            if (res.ok) {
                setZone(data.zone);
                setPages(data.pages || []);
                
                // 根据路径查找当前页面（URL 解码）
                const pathStr = pagePath ? decodeURIComponent(pagePath.join('/')) : '';
                if (pathStr) {
                    const findPageByPath = (pages, targetPath) => {
                        for (const page of pages) {
                            if (page.path === targetPath) {
                                return page;
                            }
                            if (page.children?.length > 0) {
                                const found = findPageByPath(page.children, targetPath);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    
                    const page = findPageByPath(data.pages || [], pathStr);
                    if (page) {
                        // 获取完整页面详情
                        const pageRes = await fetch(`/api/zones/pages/${page.id}`);
                        const pageData = await pageRes.json();
                        if (pageRes.ok) {
                            setCurrentPage(pageData.page);
                        }
                    } else if (data.pages?.length > 0) {
                        // 如果路径找不到页面，重定向到第一个页面
                        const firstPage = data.pages[0];
                        router.replace(`/zones/${zoneId}/${firstPage.path}`);
                        return;
                    }
                } else if (data.pages?.length > 0) {
                    // 没有路径时，重定向到第一个页面
                    const firstPage = data.pages[0];
                    router.replace(`/zones/${zoneId}/${firstPage.path}`);
                    return;
                }
            } else if (res.status === 404) {
                // 专区不存在
                router.push('/zones');
                return;
            }
        } catch (error) {
            console.error('Failed to fetch zone data:', error);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneId, pagePath ? pagePath.join('/') : '']);

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneId, pagePath ? pagePath.join('/') : '']);

    // 侧边栏拖动调整宽度
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizingTree) {
                const newWidth = Math.max(150, Math.min(400, e.clientX));
                setTreeWidth(newWidth);
            }
            if (isResizingDiscussion) {
                const newWidth = Math.max(250, Math.min(500, window.innerWidth - e.clientX));
                setDiscussionWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizingTree(false);
            setIsResizingDiscussion(false);
        };

        if (isResizingTree || isResizingDiscussion) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizingTree, isResizingDiscussion]);

    if (loading) {
        return (
            <>
                <Header />
                <div className="zone-loading">
                    <div className="spinner"></div>
                    <p>加载中...</p>
                </div>
            </>
        );
    }

    if (!zone) {
        return (
            <>
                <Header />
                <div className="zone-not-found">
                    <p>专区不存在</p>
                    <a href="/zones" className="btn btn-primary">返回专区列表</a>
                </div>
            </>
        );
    }

    return (
        <>
            <Header />
            <div className="zone-layout">
                {/* 顶部专区Tab导航 */}
                <ZoneList activeZoneId={parseInt(zoneId)} />

                {/* 三栏布局 */}
                <div className="zone-three-column-layout">
                    {/* 左侧：页面树 */}
                    <div 
                        className="zone-tree-panel"
                        style={{ width: treeWidth }}
                    >
                        <ZonePageTree
                            pages={pages}
                            zoneId={zoneId}
                            currentPageId={currentPage?.id}
                            onRefresh={fetchData}
                        />
                        {/* 拖动条 */}
                        <div 
                            className="resize-handle resize-handle-right"
                            onMouseDown={() => setIsResizingTree(true)}
                        />
                    </div>

                    {/* 中间：页面内容 */}
                    <div className="zone-content-panel">
                        <ZonePageContent
                            page={currentPage}
                            user={user}
                            onUpdate={fetchData}
                            zoneId={zoneId}
                            pages={pages}
                        />
                    </div>

                    {/* 右侧：讨论区 */}
                    <div 
                        className="zone-discussion-panel"
                        style={{ width: discussionWidth }}
                    >
                        {/* 拖动条 */}
                        <div 
                            className="resize-handle resize-handle-left"
                            onMouseDown={() => setIsResizingDiscussion(true)}
                        />
                        <ZoneDiscussion
                            pageId={currentPage?.id}
                            user={user}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
