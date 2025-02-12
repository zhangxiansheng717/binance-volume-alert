const config = require('../config/config');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BinanceService {
    constructor() {
        this.baseUrl = config.binance.baseUrl;
        this.requestTimeout = 30000; // 增加到30秒
        this.retryCount = 3; // 添加重试次数
        this.symbolCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        };

        // 根据配置决定是否使用代理
        let httpsAgent = undefined;
        if (config.proxy.use) {
            console.log(`使用代理: ${config.proxy.host}:${config.proxy.port}`);
            httpsAgent = new HttpsProxyAgent(`http://${config.proxy.host}:${config.proxy.port}`);
        }

        return { headers, httpsAgent };
    }

    async retryRequest(fn, retryCount = 3) {
        for (let i = 0; i < retryCount; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retryCount - 1) throw error;
                const waitTime = (i + 1) * 1000;
                console.log(`请求失败，${waitTime/1000}秒后重试...错误:`, error.message);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    async getAllSymbolData() {
        try {
            return await this.retryRequest(async () => {
                console.log('开始获取所有交易对数据...');
                const { headers, httpsAgent } = this.getHeaders();
                
                console.log('正在获取24小时行情数据...');
                const tickerResponse = await axios.get(`${this.baseUrl}/ticker/24hr`, {
                    headers,
                    timeout: this.requestTimeout,
                    ...(httpsAgent && { httpsAgent }),
                    proxy: false
                });

                // 添加调试信息
                console.log('24小时行情数据响应长度:', tickerResponse.data.length);
                if (tickerResponse.data.length > 0) {
                    console.log('第一个交易对数据示例:', tickerResponse.data[0]);
                }

                const usdtSymbols = tickerResponse.data
                    .filter(ticker => ticker.symbol.endsWith('USDT'))
                    .map(ticker => ticker.symbol);
                
                console.log(`找到 ${usdtSymbols.length} 个USDT交易对`);
                if (usdtSymbols.length > 0) {
                    console.log('前3个交易对:', usdtSymbols.slice(0, 3));
                }

                // 将交易对分成批次处理
                const batchSize = 50;
                const batches = [];
                for (let i = 0; i < usdtSymbols.length; i += batchSize) {
                    batches.push(usdtSymbols.slice(i, i + batchSize));
                }

                let allData = [];
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    const batchData = await Promise.all(
                        batch.map(async (symbol) => {
                            try {
                                const klineResponse = await axios.get(`${this.baseUrl}/klines`, {
                                    params: {
                                        symbol: symbol,
                                        interval: '5m',
                                        limit: 7,
                                    },
                                    headers,
                                    timeout: this.requestTimeout,
                                    ...(httpsAgent && { httpsAgent }),
                                    proxy: false
                                });

                                if (klineResponse.data && klineResponse.data.length >= 7) {
                                    const klines = klineResponse.data;
                                    const currentKline = klines[6];
                                    const historicalKlines = klines.slice(0, 6);

                                    // 使用USDT成交额计算
                                    const avgVolume = historicalKlines.reduce((sum, kline) => 
                                        sum + parseFloat(kline[7]), 0) / 6;

                                    return {
                                        symbol: symbol,
                                        volume: parseFloat(currentKline[7]),  // 使用USDT成交额
                                        lastPrice: parseFloat(currentKline[4]),
                                        time: new Date(currentKline[0]).toLocaleString(),
                                        avgHistoricalVolume: avgVolume
                                    };
                                }
                                return null;
                            } catch (error) {
                                console.error(`获取 ${symbol} K线数据失败:`, error.message);
                                return null;
                            }
                        })
                    );

                    const validData = batchData.filter(data => data !== null);
                    allData = allData.concat(validData);
                    
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                console.log(`数据获取完成，共处理 ${allData.length} 个交易对`);
                return allData;
            });
        } catch (error) {
            console.error('获取所有交易对数据失败:', error.message);
            if (error.response) {
                console.error('错误详情:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            throw error;
        }
    }

    async getSymbols() {
        const now = Date.now();
        if (this.symbolCache.has('symbols')) {
            const cached = this.symbolCache.get('symbols');
            if (now - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        const symbols = await this.fetchSymbols();
        this.symbolCache.set('symbols', {
            data: symbols,
            timestamp: now
        });
        return symbols;
    }
}

module.exports = new BinanceService();