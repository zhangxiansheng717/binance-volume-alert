const BinanceService = require('../src/services/binance');

describe('BinanceService', () => {
    test('should calculate volume change correctly', () => {
        const klines = [
            [0, 0, 0, 0, 0, 0, 0, "100"], // 历史K线1
            [0, 0, 0, 0, 0, 0, 0, "200"], // 历史K线2
            [0, 0, 0, 0, 0, 0, 0, "300"], // 历史K线3
            [0, 0, 0, 0, 0, 0, 0, "400"], // 历史K线4
            [0, 0, 0, 0, 0, 0, 0, "500"], // 历史K线5
            [0, 0, 0, 0, 0, 0, 0, "600"], // 历史K线6
            [0, 0, 0, 0, "100", 0, 0, "2100"] // 当前K线
        ];

        const avgVolume = klines.slice(0, 6).reduce((sum, k) => sum + parseFloat(k[7]), 0) / 6;
        const currentVolume = parseFloat(klines[6][7]);
        const volumeChange = currentVolume / avgVolume;

        expect(avgVolume).toBe(350);
        expect(currentVolume).toBe(2100);
        expect(volumeChange).toBe(6);
    });

    test('should handle API errors gracefully', async () => {
        const service = new BinanceService();
        const mockFn = jest.fn().mockRejectedValueOnce(new Error('API Error'));
        
        await expect(service.retryRequest(mockFn)).rejects.toThrow('API Error');
        expect(mockFn).toHaveBeenCalledTimes(3); // 应该重试3次
    });
}); 