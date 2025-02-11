export default function handler(req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Binance Volume Surge Alert Bot</title>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 2rem;
                        line-height: 1.6;
                    }
                    h1 { color: #333; }
                    .status {
                        padding: 1rem;
                        background: #e6ffe6;
                        color: #006600;
                        border-radius: 4px;
                    }
                </style>
            </head>
            <body>
                <h1>Binance Volume Surge Alert Bot</h1>
                <div class="status">
                    <p>✅ Bot is running and monitoring volume surges...</p>
                </div>
                <div>
                    <h2>功能说明</h2>
                    <ul>
                        <li>实时监控币安合约市场所有交易对</li>
                        <li>当价格上涨且成交量暴涨超过2倍时发送提醒</li>
                        <li>通过Telegram机器人接收提醒</li>
                    </ul>
                </div>
            </body>
        </html>
    `);
} 