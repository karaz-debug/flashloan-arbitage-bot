import { ethers } from 'ethers';
import { fetchFromSubgraph, subgraphUrls } from './proxy';

// Mainnet token addresses
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

// Pair addresses
const UNISWAP_PAIRS = {
  USDC_WETH: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
  WETH_USDT: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852'
};

const SUSHISWAP_PAIRS = {
  USDC_WETH: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
  WETH_USDT: '0x06da0fd433C1A5d7a4faa01111c044910A184553'
};

interface PairData {
  token0Price: string;
  token1Price: string;
  reserve0: string;
  reserve1: string;
  volumeUSD: string;
  token0: {
    symbol: string;
    decimals: string;
  };
  token1: {
    symbol: string;
    decimals: string;
  };
}

interface PriceData {
  uniswap: {
    usdcWeth: number;
    wethUsdt: number;
  };
  sushiswap: {
    usdcWeth: number;
    wethUsdt: number;
  };
  lastPrices?: {
    uniswap: {
      usdcWeth: number;
      wethUsdt: number;
    };
    sushiswap: {
      usdcWeth: number;
      wethUsdt: number;
    };
  };
}

export class PriceMonitor {
  private provider: ethers.providers.Provider;
  private priceHistory: PriceData[] = [];
  private lastUpdate: number = 0;
  private updateInterval: number = 10000; // 10 seconds

  constructor(provider: ethers.providers.Provider) {
    this.provider = provider;
  }

  private async fetchPairData(pairAddress: string, subgraphUrl: string): Promise<PairData | null> {
    try {
      console.log(`Fetching data for pair ${pairAddress} from ${subgraphUrl}`);
      
      const query = `
        query GetPairData($pairAddress: String!) {
          pair(id: $pairAddress) {
            token0Price
            token1Price
            reserve0
            reserve1
            volumeUSD
            token0 {
              symbol
              decimals
            }
            token1 {
              symbol
              decimals
            }
          }
        }
      `;

      const response = await fetchFromSubgraph(subgraphUrl, query, { pairAddress });
      
      if (response.data?.pair) {
        console.log(`Received data for pair ${pairAddress}:`, response.data.pair);
        return response.data.pair;
      } else {
        console.log(`No pair data received for ${pairAddress}, using mock data`);
        return this.getMockPairData();
      }
    } catch (error) {
      console.error(`Error fetching pair data for ${pairAddress}:`, error);
      return this.getMockPairData();
    }
  }

  private getMockPairData(): PairData {
    return {
      token0Price: "1800.0",
      token1Price: "0.000555555555555556",
      reserve0: "1000000.0",
      reserve1: "555.5555555555556",
      volumeUSD: "1000000.0",
      token0: {
        symbol: "USDC",
        decimals: "6"
      },
      token1: {
        symbol: "WETH",
        decimals: "18"
      }
    };
  }

  async getPrices(): Promise<PriceData> {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) {
      return this.priceHistory[this.priceHistory.length - 1];
    }

    try {
      // Fetch Uniswap data
      const uniswapUsdcWeth = await this.fetchPairData(UNISWAP_PAIRS.USDC_WETH, subgraphUrls.uniswap);
      const uniswapWethUsdt = await this.fetchPairData(UNISWAP_PAIRS.WETH_USDT, subgraphUrls.uniswap);

      // Fetch SushiSwap data
      const sushiswapUsdcWeth = await this.fetchPairData(SUSHISWAP_PAIRS.USDC_WETH, subgraphUrls.sushiswap);
      const sushiswapWethUsdt = await this.fetchPairData(SUSHISWAP_PAIRS.WETH_USDT, subgraphUrls.sushiswap);

      const prices: PriceData = {
        uniswap: {
          usdcWeth: parseFloat(uniswapUsdcWeth?.token0Price || "1800.0"),
          wethUsdt: parseFloat(uniswapWethUsdt?.token0Price || "1800.0")
        },
        sushiswap: {
          usdcWeth: parseFloat(sushiswapUsdcWeth?.token0Price || "1800.0"),
          wethUsdt: parseFloat(sushiswapWethUsdt?.token0Price || "1800.0")
        }
      };

      // Calculate price changes
      if (this.priceHistory.length > 0) {
        const lastPrices = this.priceHistory[this.priceHistory.length - 1];
        prices.lastPrices = lastPrices;
        
        const changes = {
          uniswap: {
            usdcWeth: prices.uniswap.usdcWeth - lastPrices.uniswap.usdcWeth,
            wethUsdt: prices.uniswap.wethUsdt - lastPrices.uniswap.wethUsdt
          },
          sushiswap: {
            usdcWeth: prices.sushiswap.usdcWeth - lastPrices.sushiswap.usdcWeth,
            wethUsdt: prices.sushiswap.wethUsdt - lastPrices.sushiswap.wethUsdt
          }
        };
        
        console.log('Price changes detected:', changes);
      }

      this.priceHistory.push(prices);
      if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
      }

      this.lastUpdate = now;
      return prices;
    } catch (error) {
      console.error('Error getting prices:', error);
      return this.getMockPrices();
    }
  }

  private getMockPrices(): PriceData {
    return {
      uniswap: {
        usdcWeth: 1800.0,
        wethUsdt: 1800.0
      },
      sushiswap: {
        usdcWeth: 1800.0,
        wethUsdt: 1800.0
      }
    };
  }

  async calculateArbitrageOpportunity(amount: number): Promise<{
    profitable: boolean;
    profit: number;
    details: string;
  }> {
    try {
      const prices = await this.getPrices();
      console.log('Current prices:', prices);

      // Calculate arbitrage for both paths
      const path1Profit = this.calculatePathProfit(amount, prices, 'uniswap', 'sushiswap');
      const path2Profit = this.calculatePathProfit(amount, prices, 'sushiswap', 'uniswap');

      const bestPath = path1Profit.profit > path2Profit.profit ? path1Profit : path2Profit;
      console.log('Arbitrage calculation:', bestPath);

      return {
        profitable: bestPath.profitable,
        profit: bestPath.profit,
        details: bestPath.details
      };
    } catch (error) {
      console.error('Error calculating arbitrage:', error);
      return {
        profitable: false,
        profit: 0,
        details: 'Error calculating arbitrage opportunity'
      };
    }
  }

  private calculatePathProfit(
    amount: number,
    prices: PriceData,
    startDex: 'uniswap' | 'sushiswap',
    endDex: 'uniswap' | 'sushiswap'
  ): {
    profitable: boolean;
    profit: number;
    details: string;
  } {
    const fee = 0.003; // 0.3% fee per swap
    const steps = [];

    // Calculate amounts through the path
    let currentAmount = amount;
    steps.push(`${currentAmount.toFixed(2)} USDC`);

    // USDC → WETH
    currentAmount = currentAmount / prices[startDex].usdcWeth * (1 - fee);
    steps.push(`${currentAmount.toFixed(6)} WETH`);

    // WETH → USDT
    currentAmount = currentAmount * prices[startDex].wethUsdt * (1 - fee);
    steps.push(`${currentAmount.toFixed(2)} USDT`);

    // USDT → WETH
    currentAmount = currentAmount / prices[endDex].wethUsdt * (1 - fee);
    steps.push(`${currentAmount.toFixed(6)} WETH`);

    // WETH → USDC
    currentAmount = currentAmount * prices[endDex].usdcWeth * (1 - fee);
    steps.push(`${currentAmount.toFixed(2)} USDC`);

    const profit = currentAmount - amount;
    const totalFees = amount * fee * 4; // 4 swaps

    const details = `
${steps.join(' → ')}
Fees: ${totalFees.toFixed(2)} USDC
Profit: ${profit.toFixed(2)} USDC
`;

    return {
      profitable: profit > 0,
      profit,
      details
    };
  }
} 