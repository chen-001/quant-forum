import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    try {
        // Validate URL
        const url = new URL(targetUrl);

        // Fetch the target URL with browser-like headers
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'identity', // Don't request compressed content
                'Cache-Control': 'no-cache',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        // Get the content type
        const contentType = response.headers.get('content-type') || 'text/html';

        // For HTML content, process and remove frame restrictions
        if (contentType.includes('text/html')) {
            let html = await response.text();

            const baseUrl = `${url.protocol}//${url.host}`;
            const basePath = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1) || '/';

            // Only inject base tag if there isn't one already
            if (!/<base\s/i.test(html)) {
                const baseTag = `<base href="${baseUrl}${basePath}">`;

                // Insert base tag in the right place
                if (/<head[^>]*>/i.test(html)) {
                    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}`);
                } else if (/<html[^>]*>/i.test(html)) {
                    html = html.replace(/<html[^>]*>/i, (match) => `${match}<head>${baseTag}</head>`);
                }
            }

            // Fix protocol-relative URLs (//example.com/path)
            html = html.replace(/(['"])(\/\/[^'"]+)(['"])/g, (match, q1, path, q2) => {
                return `${q1}${url.protocol}${path}${q2}`;
            });

            // Create response without frame-blocking headers
            const headers = new Headers({
                'Content-Type': contentType,
                // Remove frame restrictions
                'X-Frame-Options': 'ALLOWALL',
                'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *;",
                // Allow cross-origin resources
                'Access-Control-Allow-Origin': '*',
            });

            return new NextResponse(html, {
                status: 200,
                headers,
            });
        } else {
            // For non-HTML content, proxy as-is with CORS headers
            const body = await response.arrayBuffer();

            return new NextResponse(body, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    } catch (error) {
        console.error('Proxy error:', error);

        // Return a helpful error page
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #1a1a2e;
            color: #eee;
        }
        .error-box {
            text-align: center;
            padding: 40px;
            background: #16213e;
            border-radius: 12px;
            max-width: 500px;
        }
        h2 { color: #e94560; margin-bottom: 16px; }
        p { color: #aaa; margin-bottom: 20px; }
        a {
            display: inline-block;
            padding: 12px 24px;
            background: #e94560;
            color: white;
            text-decoration: none;
            border-radius: 8px;
        }
        a:hover { background: #ff6b6b; }
    </style>
</head>
<body>
    <div class="error-box">
        <h2>⚠️ 无法加载页面</h2>
        <p>${error.message}</p>
        <a href="${targetUrl}" target="_blank">在新窗口打开</a>
    </div>
</body>
</html>`;

        return new NextResponse(errorHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    }
}
