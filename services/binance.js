const axios = require('axios');

const BINANCE_API = 'https://fapi.binance.com/fapi/v1/ticker/24hr';

async function getBinanceData() {
  try {
    const response = await axios.get(BINANCE_API);
    return response.data;
  } catch (error) {
    console.error('获取币安数据失败:', error);
    throw error;
  }
}

module.exports = {
  getBinanceData
}; 