const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class BinanceService {
    constructor() {
        this.baseUrl = 'https://fapi.binance.com/fapi/v1';
    }

    async getAllSymbolData() {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            };

            const proxyConfig = {
                host: '127.0.0.1',
                port: '10809'
            };

            const httpsAgent = new HttpsProxyAgent(`http://${proxyConfig.host}:${proxyConfig.port}`);

            // 先获取所有USDT交易对
            console.log('正在获取交易对列表...');
            const tickerResponse = await axios.get(`${this.baseUrl}/ticker/24hr`, {
                headers,
                timeout: 10000,
                httpsAgent,
                proxy: false
            });

            // 过滤出USDT交易对
            const usdtSymbols = tickerResponse.data
                .filter(item => item.symbol.endsWith('USDT'))
                .map(item => item.symbol);

            console.log(`找到 ${usdtSymbols.length} 个USDT交易对，正在获取K线数据...`);

            // 并行获取所有交易对的1分钟K线数据
            const allData = await Promise.all(
                usdtSymbols.map(async (symbol) => {
                    try {
                        const klineResponse = await axios.get(`${this.baseUrl}/klines`, {
                            params: {
                                symbol: symbol,
                                interval: '1m',
                                limit: 1,
                            },
                            headers,
                            timeout: 10000,
                            httpsAgent,
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

            // 过滤掉获取失败的数据
            const validData = allData.filter(data => data !== null);
            
            // 打印一些示例数据
            console.log('\n示例数据:');
            validData.slice(0, 3).forEach(item => {
                console.log(`${item.symbol}: ` +
                    `价格=${item.lastPrice.toFixed(4)}, ` +
                    `1分钟成交量=${item.volume.toFixed(3)}, ` +
                    `1分钟成交额=${item.quoteVolume.toFixed(2)} USDT`);
            });

            console.log(`\n成功获取 ${validData.length} 个交易对的1分钟K线数据`);
            return validData;

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