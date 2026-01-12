const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// 服务器地址 - 可以修改为你的服务器地址
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5203';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true, // 启用 webview 标签
        },
        titleBarStyle: 'hiddenInset', // macOS 风格标题栏
        show: false, // 等待 ready-to-show 再显示
    });

    // 加载论坛页面
    mainWindow.loadURL(SERVER_URL);

    // 准备好后显示窗口
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 开发模式下打开 DevTools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 配置 webview 权限 - 允许加载任何网页
app.on('web-contents-created', (event, contents) => {
    // 允许 webview 加载任何 URL
    contents.on('will-attach-webview', (event, webPreferences, params) => {
        // 移除不安全的预加载脚本
        delete webPreferences.preload;
        delete webPreferences.preloadURL;

        // 允许加载任何内容
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
    });

    // 允许 webview 中的新窗口
    contents.setWindowOpenHandler(({ url }) => {
        // 在默认浏览器中打开外部链接
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
});

// 移除 webview 的 CSP 限制
app.on('ready', () => {
    // 修改响应头，移除 X-Frame-Options 限制
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };

        // 移除可能阻止 iframe/webview 嵌入的头
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['Content-Security-Policy'];
        delete responseHeaders['content-security-policy'];

        callback({ responseHeaders });
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
