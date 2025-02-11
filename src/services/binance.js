const config = require('../config/config');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BinanceService {
    constructor() {
        this.baseUrl = config.binance.baseUrl;
        this.requestTimeout = 30000; // 增加到30秒
        this.retryCount = 3; // 添加重试次数
    }

    async getAllSymbolData() {
        try {
            const batchSize = 50;  // 添加批次大小定义，每批处理50个交易对
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

            // 获取交易对列表，添加重试逻辑
            let tickerResponse;
            for (let i = 0; i < this.retryCount; i++) {
                try {
                    console.log(`正在获取交易对列表${i > 0 ? ` (重试 ${i})` : ''}...`);
                    tickerResponse = await axios.get(`${this.baseUrl}/ticker/24hr`, {
                        headers,
                        timeout: this.requestTimeout,
                        ...(httpsAgent && { httpsAgent }),
                        proxy: false
                    });
                    break; // 如果成功就跳出循环
                } catch (error) {
                    if (i === this.retryCount - 1) throw error; // 最后一次重试失败才抛出错误
                    console.log(`获取失败，等待重试...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
                }
            }

            // 过滤出USDT交易对
            const usdtSymbols = tickerResponse.data
                .filter(item => item.symbol.endsWith('USDT'))
                .map(item => item.symbol);

            console.log(`找到 ${usdtSymbols.length} 个USDT交易对，正在获取K线数据...`);

            // 分批处理交易对，每批50个
            const batches = [];
            for (let i = 0; i < usdtSymbols.length; i += batchSize) {
                batches.push(usdtSymbols.slice(i, i + batchSize));
            }

            let allData = [];
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`正在处理第 ${i + 1}/${batches.length} 批交易对...`);
                
                const batchData = await Promise.all(
                    batch.map(async (symbol) => {
                        try {
                            const klineResponse = await axios.get(`${this.baseUrl}/klines`, {
                                params: {
                                    symbol: symbol,
                                    interval: '1m',
                                    limit: 1,
                                },
                                headers,
                                timeout: this.requestTimeout,
                                ...(httpsAgent && { httpsAgent }),
                                proxy: false
                            });

                            if (klineResponse.data && klineResponse.data[0]) {
                                const kline = klineResponse.data[0];
                                const volume = parseFloat(kline[5]);
                                const price = parseFloat(kline[4]);
                                const quoteVolume = parseFloat(kline[7]);

                                return {
                                    symbol: symbol,
                                    volume: volume,
                                    lastPrice: price,
                                    quoteVolume: quoteVolume,
                                    time: new Date(kline[0]).toLocaleString()
                                };
                            }
                            return null;
                        } catch (error) {
                            console.error(`获取 ${symbol} K线数据失败:`, error.message);
                            return null;
                        }
                    })
                );

                allData = allData.concat(batchData.filter(data => data !== null));
                
                // 每批处理完后等待1秒，避免请求过于频繁
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 打印一些示例数据
            console.log('\n示例数据:');
            allData.slice(0, 3).forEach(item => {
                console.log(`${item.symbol}: ` +
                    `价格=${item.lastPrice.toFixed(4)}, ` +
                    `1分钟成交量=${item.volume.toFixed(3)}, ` +
                    `1分钟成交额=${item.quoteVolume.toFixed(2)} USDT`);
            });

            console.log(`\n成功获取 ${allData.length} 个交易对的1分钟K线数据`);
            return allData;

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