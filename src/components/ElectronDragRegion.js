'use client';

import { useEffect, useState } from 'react';

export default function ElectronDragRegion() {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        // 检测是否在 Electron 环境中
        const checkElectron = () => {
            if (typeof window !== 'undefined') {
                // 检测 Electron 环境的多种方式
                const isElectronEnv =
                    // 1. 检查 electronAPI (由 preload.js 注入)
                    (window.electronAPI && window.electronAPI.isElectron) ||
                    // 2. 检查 userAgent 是否包含 Electron
                    (window.navigator && window.navigator.userAgent.toLowerCase().includes('electron')) ||
                    // 3. 检查 process 对象
                    (window.process && window.process.type === 'renderer');

                if (isElectronEnv) {
                    setIsElectron(true);
                    document.body.classList.add('electron-app');
                }
            }
        };

        checkElectron();
    }, []);

    if (!isElectron) {
        return null;
    }

    return <div className="electron-drag-region" />;
}
