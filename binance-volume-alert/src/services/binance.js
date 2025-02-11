const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BinanceService {
    constructor() {
        this.baseUrl = 'https://fapi.binance.com/fapi/v1'; // 币安合约 API
    }

    async getAllSymbolData() {
        try {
            // 添加必要的请求头
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            };

            // V2Ray 代理配置
            const proxyConfig = {
                host: '127.0.0.1',
                port: '10809'  // V2Ray 的默认 HTTP 代理端口
            };

            const httpsAgent = new HttpsProxyAgent(`http://${proxyConfig.host}:${proxyConfig.port}`);

            console.log('正在获取币安数据...');  // 添加日志
            // 使用 24小时行情接口
            const response = await axios.get(`${this.baseUrl}/ticker/24hr`, {
                headers,
                timeout: 10000, // 10秒超时
                httpsAgent,
                proxy: false // 使用 httpsAgent 时需要设置为 false
            });

            const filteredData = response.data.filter(item => item.symbol.endsWith('USDT'));
            console.log(`成功获取到 ${filteredData.length} 个交易对的数据`);  // 添加日志
            
            // 打印前三个交易对的信息作为示例
            filteredData.slice(0, 3).forEach(item => {
                console.log(`${item.symbol}: 价格=${item.lastPrice}, 24h成交量=${item.volume}`);
            });

            return filteredData;
        } catch (error) {
            console.error('获取币安数据时出错:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            return [];
        }
    }
}

module.exports = new BinanceService();