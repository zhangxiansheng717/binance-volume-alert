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

    // 新的多时间周期数据获取方法
    async getAllSymbolDataForTimeframe(timeframeConfig) {
        try {
            return await this.retryRequest(async () => {
                console.log(`开始获取所有交易对 ${timeframeConfig.interval} 数据...`);
                const { headers, httpsAgent } = this.getHeaders();
                
                console.log('正在获取24小时行情数据...');
                const tickerResponse = await axios.get(`${this.baseUrl}/ticker/24hr`, {
                    headers,
                    timeout: this.requestTimeout,
                    ...(httpsAgent && { httpsAgent }),
                    proxy: false
                });

                const usdtSymbols = tickerResponse.data
                    .filter(ticker => ticker.symbol.endsWith('USDT'))
                    .map(ticker => ticker.symbol);
                
                console.log(`找到 ${usdtSymbols.length} 个USDT交易对 (${timeframeConfig.interval})`);

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
                                // 获取足够的K线数据：historyPeriods + volumeMedianPeriods + 2
                                const totalLimit = Math.max(
                                    timeframeConfig.historyPeriods + 2,
                                    timeframeConfig.volumeMedianPeriods + 2
                                ) + 5; // 额外5根确保数据充足
                                
                                const klineResponse = await axios.get(`${this.baseUrl}/klines`, {
                                    params: {
                                        symbol: symbol,
                                        interval: timeframeConfig.interval,
                                        limit: totalLimit,
                                    },
                                    headers,
                                    timeout: this.requestTimeout,
                                    ...(httpsAgent && { httpsAgent }),
                                    proxy: false
                                });

                                if (klineResponse.data && klineResponse.data.length >= timeframeConfig.volumeMedianPeriods + 2) {
                                    const klines = klineResponse.data;
                                    // 使用已完成的最新K线（倒数第2根）
                                    const currentKline = klines[klines.length - 2];
                                    
                                    // 历史基准周期（用于平均交易量计算）
                                    const historicalKlines = klines.slice(
                                        Math.max(0, klines.length - 2 - timeframeConfig.historyPeriods), 
                                        klines.length - 2
                                    );

                                    // 量能中位数计算周期（用于判断强/爆）
                                    const volumeMedianKlines = klines.slice(
                                        Math.max(0, klines.length - 2 - timeframeConfig.volumeMedianPeriods), 
                                        klines.length - 2
                                    );

                                    // 使用币种交易量计算平均
                                    const avgVolume = historicalKlines.reduce((sum, kline) => 
                                        sum + parseFloat(kline[5]), 0) / historicalKlines.length;

                                    // 计算量能中位数
                                    const volumes = volumeMedianKlines.map(k => parseFloat(k[5])).sort((a, b) => a - b);
                                    const medianVolume = volumes.length % 2 === 0
                                        ? (volumes[volumes.length / 2 - 1] + volumes[volumes.length / 2]) / 2
                                        : volumes[Math.floor(volumes.length / 2)];

                                    return {
                                        symbol: symbol,
                                        interval: timeframeConfig.interval,
                                        openPrice: parseFloat(currentKline[1]),      // K线开盘价
                                        lastPrice: parseFloat(currentKline[4]),      // K线收盘价（当前价）
                                        volume: parseFloat(currentKline[5]),         // 使用币种交易量
                                        quoteVolume: parseFloat(currentKline[7]),    // 保留成交额用于筛选
                                        time: new Date(currentKline[0]).toLocaleString(),
                                        avgHistoricalVolume: avgVolume,
                                        volumeMedian: medianVolume,                  // 量能中位数
                                        volumeMultiplier: parseFloat(currentKline[5]) / medianVolume,  // 量能倍数
                                        timeframeConfig: timeframeConfig
                                    };
                                }
                                return null;
                            } catch (error) {
                                console.error(`获取 ${symbol} ${timeframeConfig.interval} K线数据失败:`, error.message);
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

                console.log(`${timeframeConfig.interval} 数据获取完成，共处理 ${allData.length} 个交易对`);
                return allData;
            });
        } catch (error) {
            console.error(`获取所有交易对 ${timeframeConfig.interval} 数据失败:`, error.message);
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

    // 保留原有方法用于向后兼容
    async getAllSymbolData() {
        const defaultTimeframe = {
            interval: '5m',
            historyPeriods: 6
        };
        return this.getAllSymbolDataForTimeframe(defaultTimeframe);
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
