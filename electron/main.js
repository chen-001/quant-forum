const { app, BrowserWindow, session, net } = require('electron');
const path = require('path');

// 服务器地址配置
const PRIMARY_SERVER = 'http://192.168.200.60:5203';
const FALLBACK_SERVER = 'http://65.49.220.66:5203';

let mainWindow;
let serverUrl = null;

// 通过 HTTP 请求检测服务器是否可访问
function checkServerAvailable(url, timeout = 5000) {
    return new Promise((resolve) => {
        let resolved = false;

        // 设置超时
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log(`HTTP 请求超时: ${url}`);
                resolve(false);
            }
        }, timeout);

        try {
            const request = net.request({
                method: 'GET',
                url: url,
            });

            request.on('response', (response) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    console.log(`HTTP 响应状态码: ${response.statusCode}`);
                    // 任何 HTTP 响应都表示服务器可访问
                    resolve(true);
                }
                // 消费响应数据以关闭连接
                response.on('data', () => { });
                response.on('end', () => { });
            });

            request.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    console.log(`HTTP 请求错误: ${error.message}`);
                    resolve(false);
                }
            });

            request.end();
        } catch (error) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                console.log(`创建请求失败: ${error.message}`);
                resolve(false);
            }
        }
    });
}

// 获取可用的服务器地址
async function getAvailableServer() {
    console.log('正在通过 HTTP 请求检测主服务器是否可访问...');
    const isPrimaryAvailable = await checkServerAvailable(PRIMARY_SERVER);

    if (isPrimaryAvailable) {
        console.log('主服务器 HTTP 响应正常，使用: ' + PRIMARY_SERVER);
        return PRIMARY_SERVER;
    } else {
        console.log('主服务器不可访问，切换到备用服务器: ' + FALLBACK_SERVER);
        return FALLBACK_SERVER;
    }
}

async function createWindow() {
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

    // 获取可用服务器并加载论坛页面
    serverUrl = await getAvailableServer();
    mainWindow.loadURL(serverUrl);

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
