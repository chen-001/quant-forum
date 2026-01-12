const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 标识当前运行在 Electron 环境中
    isElectron: true,

    // 平台信息
    platform: process.platform,

    // 版本信息
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    },
});

// 注入全局标识
window.addEventListener('DOMContentLoaded', () => {
    // 添加 Electron 环境类名到 body
    document.body.classList.add('electron-app');
});
