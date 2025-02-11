const { getBinanceData } = require('../services/binance');
const { sendTelegramAlert } = require('../services/telegram');

// 存储上一分钟的数据
const lastMinuteData = new Map();

// 检查交易量暴涨
function checkVolumeSurge(symbol, currentPrice, currentVolume) {
  const lastData = lastMinuteData.get(symbol);
  
  if (!lastData) {
    lastMinuteData.set(symbol, {
      price: currentPrice,
      volume: currentVolume,
      timestamp: Date.now()
    });
    return false;
  }

  // 计算变化
  const priceChange = ((currentPrice - lastData.price) / lastData.price) * 100;
  const volumeRatio = currentVolume / lastData.volume;

  // 更新数据
  lastMinuteData.set(symbol, {
    price: currentPrice,
    volume: currentVolume,
    timestamp: Date.now()
  });

  // 判断条件：价格上涨 且 成交量超过2倍
  return priceChange > 0 && volumeRatio > 2;
}

// Vercel Serverless Function
module.exports = async (req, res) => {
  try {
    const data = await getBinanceData();
    
    for (const item of data) {
      const { symbol, lastPrice, volume } = item;
      
      if (checkVolumeSurge(symbol, parseFloat(lastPrice), parseFloat(volume))) {
        const message = `🚨 交易量暴涨提醒\n币种：${symbol}\n当前价格：${lastPrice}\n成交量变化：${volume}倍`;
        await sendTelegramAlert(message);
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('监控错误:', error);
    res.status(500).json({ error: error.message });
  }
}; 