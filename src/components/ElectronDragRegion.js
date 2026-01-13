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
                    (window.process && window.process.type === 'renderer') ||
                    (window.navigator && window.navigator.userAgent.includes('Electron'));

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
