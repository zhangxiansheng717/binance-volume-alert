import fetch from 'node-fetch';

const BINANCE_FUTURES_API = 'https://fapi.binance.com';

export async function getBinanceData() {
    try {
        const response = await fetch(`${BINANCE_FUTURES_API}/fapi/v1/ticker/24hr`);
        const data = await response.json();
        
        // 转换数据为Map格式
        const dataMap = new Map();
        
        for (const item of data) {
            dataMap.set(item.symbol, {
                price: parseFloat(item.lastPrice),
                volume: parseFloat(item.volume)
            });
        }
        
        return dataMap;
    } catch (error) {
        console.error('Binance API error:', error);
        throw error;
    }
} 