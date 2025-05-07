import { ethers } from 'ethers';
import { Contract } from '@ethersproject/contracts';
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers';

// ABI for Uniswap V2 Pair
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function price0CumulativeLast() external view returns (uint)',
  'function price1CumulativeLast() external view returns (uint)'
];

// ABI for ERC20
const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)'
];

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PairInfo {
  address: string;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: string;
  reserve1: string;
  price0: number;
  price1: number;
  timestamp: number;
}

interface DexPair {
  quickswap: string;
  sushiswap: string;
}

interface DexPrices {
  quickswap: PairInfo;
  sushiswap: PairInfo;
  [key: string]: PairInfo;
}

interface ArbitrageOpportunity {
  pair: string;
  amount: number;
  profit: number;
  profitPercentage: number;
  priceImpact: {
    [dex: string]: number;
  };
  path: string[];
  details: string;
  profitable: boolean;
}

export class DexMonitor {
  private provider!: Web3Provider | JsonRpcProvider;
  private pairs: Record<string, DexPair> = {};
  private pairCache: { [key: string]: PairInfo } = {};

  // Constants for Polygon network
  private readonly POLYGON_CHAIN_ID = 137;
  private readonly POLYGON_RPC_URL = 'https://polygon-rpc.com';
  private readonly POLYGON_BLOCK_TIME = 2; // seconds
  private readonly POLYGON_GAS_LIMIT = 500000;
  private readonly POLYGON_GAS_PRICE = 30; // gwei
  private readonly POLYGON_FLASH_LOAN_FEE = 0.0009; // 0.09%
  private readonly POLYGON_SLIPPAGE_TOLERANCE = 0.003; // 0.3% (reduced from 0.5%)
  private readonly POLYGON_PRICE_IMPACT_THRESHOLD = 0.002; // 0.2% (increased from 0.1%)
  private readonly POLYGON_MIN_PROFIT_THRESHOLD = 0.001; // 0.1% (reduced from 0.2%)
  private readonly POLYGON_OPTIMAL_AMOUNT_RANGE = {
    min: 100, // 100 USDC (increased from 50)
    max: 500  // 500 USDC (increased from 250)
  };

  // Constants for Polygon network
  private readonly DEX_FEE = 0.0001; // 0.01% fee per trade
  private readonly SLIPPAGE = 0.0001; // 0.01% slippage
  private readonly GAS_LIMIT = 150000;
  private readonly MATIC_PRICE_USD = 0.8;

  // Stable pair specific thresholds
  private readonly STABLE_PAIRS = ['USDC-USDT', 'USDC-DAI', 'USDT-DAI'];
  private readonly STABLE_MIN_PRICE_DIFF = 0.0001; // 0.01% for stable pairs
  private readonly STABLE_MAX_PRICE_DIFF = 0.01; // 1% for stable pairs
  private readonly STABLE_MIN_REQUIRED = 0.0002; // 0.02% minimum required for stable pairs

  // Volatile pair specific thresholds
  private readonly VOLATILE_MIN_PRICE_DIFF = 0.001; // 0.1% minimum price difference
  private readonly VOLATILE_MAX_PRICE_DIFF = 0.05; // 5% maximum price difference
  private readonly VOLATILE_MIN_REQUIRED = 0.002; // 0.2% minimum required for volatile pairs

  // Token symbol mapping
  private readonly TOKEN_SYMBOL_MAP: { [key: string]: string } = {
    'WPOL': 'MATIC',
    'WMATIC': 'MATIC',
    'WETH': 'ETH'
  };

  // Base token addresses for price normalization
  private readonly BASE_TOKENS = [
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
    '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'  // MATIC
  ];

  private readonly OPTIMAL_AMOUNTS = [25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255];
  private readonly MAX_PRICE_IMPACT = 0.0005; // 0.05% maximum price impact
  private readonly MIN_LIQUIDITY = 25000; // Minimum liquidity in USD

  private readonly DEX_PAIRS: Record<string, DexPair> = {
    'USDC-USDT': {
      quickswap: '0x2Ef9B5B2DdE697B0a5d2fB8B5F6E5dF7E5E5E5E5',
      sushiswap: '0x3Ef9B5B2DdE697B0a5d2fB8B5F6E5dF7E5E5E5E5'
    },
    'WETH-MATIC': {
      quickswap: '0x5Ef9B5B2DdE697B0a5d2fB8B5F6E5dF7E5E5E5E5',
      sushiswap: '0x6Ef9B5B2DdE697B0a5d2fB8B5F6E5dF7E5E5E5E5'
    }
  };

  private constructor(provider: Web3Provider | JsonRpcProvider) {
    this.provider = provider;
  }

  static async create(provider?: Web3Provider | JsonRpcProvider): Promise<DexMonitor> {
    // Use Polygon RPC endpoint if no provider is provided
    const actualProvider = provider || new JsonRpcProvider('https://polygon-rpc.com');
    const monitor = new DexMonitor(actualProvider);

    // Initialize pairs object with verified contract addresses from PolygonScan
    monitor.pairs = {
      'USDC-USDT': {
        quickswap: '0x2cF7252e74036d1Da831d11089D326296e64a728',
        sushiswap: '0x4B1F1e2435A9C96f7330FAea190Ef6A7C8D70001'
      },
      'USDC-MATIC': {
        quickswap: '0x6e7a5FAFcec6BB1e78bAE2A1F0B12dC8Cb4D4B1',
        sushiswap: '0xcd353F79d9FADe311fC3119B841e1f456b54e858'
      },
      'USDT-MATIC': {
        quickswap: '0x604229c960e5CACF2aaE1ABDa3898356ffdEe7B3',
        sushiswap: '0x2813D43463C374a680f235c428FB1D7f08dE0B69'
      }
    };

    // Initialize pairs
    await monitor.initializePairs();
    return monitor;
  }

  private async initializePairs() {
    // Validate all addresses and remove invalid ones
    for (const [pairKey, addresses] of Object.entries(this.pairs)) {
      try {
        // Validate each address
        const validatedAddresses = {
          quickswap: ethers.utils.getAddress(addresses.quickswap),
          sushiswap: ethers.utils.getAddress(addresses.sushiswap)
        };

        // Verify contract exists for each address
        const [quickswapCode, sushiswapCode] = await Promise.all([
          this.provider.getCode(validatedAddresses.quickswap),
          this.provider.getCode(validatedAddresses.sushiswap)
        ]);

        if (quickswapCode === '0x' || sushiswapCode === '0x') {
          console.error(`Invalid contract address found for pair ${pairKey}`);
          delete this.pairs[pairKey];
          continue;
        }

        this.pairs[pairKey] = validatedAddresses;
        console.log(`Successfully validated addresses for ${pairKey}`);
      } catch (error) {
        console.error(`Error validating addresses for pair ${pairKey}:`, error);
        delete this.pairs[pairKey];
      }
    }
  }

  private isStablePair(pairKey: string): boolean {
    return this.STABLE_PAIRS.includes(pairKey);
  }

  private getPairThresholds(pairKey: string): { 
    minDiff: number; 
    maxDiff: number; 
    minRequired: number;
  } {
    if (this.isStablePair(pairKey)) {
      return {
        minDiff: this.STABLE_MIN_PRICE_DIFF,
        maxDiff: this.STABLE_MAX_PRICE_DIFF,
        minRequired: this.STABLE_MIN_REQUIRED
      };
    }
    return {
      minDiff: this.VOLATILE_MIN_PRICE_DIFF,
      maxDiff: this.VOLATILE_MAX_PRICE_DIFF,
      minRequired: this.VOLATILE_MIN_REQUIRED
    };
  }

  private normalizeTokenSymbol(symbol: string): string {
    return this.TOKEN_SYMBOL_MAP[symbol] || symbol;
  }

  private isBaseToken(address: string): boolean {
    return this.BASE_TOKENS.includes(address.toLowerCase());
  }

  private normalizePrice(pairInfo: PairInfo): number {
    // If token0 is a base token, use price0, otherwise use price1
    const price = this.isBaseToken(pairInfo.token0.address) ? pairInfo.price0 : pairInfo.price1;
    console.log(`Normalizing price for ${pairInfo.token0.symbol}-${pairInfo.token1.symbol}:`, {
      token0: pairInfo.token0.symbol,
      token1: pairInfo.token1.symbol,
      isBaseToken: this.isBaseToken(pairInfo.token0.address),
      price0: pairInfo.price0,
      price1: pairInfo.price1,
      normalizedPrice: price
    });
    return price;
  }

  private async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      console.log(`Fetching token info for ${tokenAddress}`);
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals()
      ]);
      
      // Normalize token symbol
      const normalizedSymbol = this.normalizeTokenSymbol(symbol);
      console.log(`Token info fetched: ${normalizedSymbol} (${name})`);
      
      return { 
        address: tokenAddress, 
        symbol: normalizedSymbol, 
        name, 
        decimals 
      };
    } catch (error: any) {
      console.error(`Error fetching token info for ${tokenAddress}:`, error);
      throw error;
    }
  }

  private async getPairInfo(pairAddress: string): Promise<PairInfo> {
    console.log(`Fetching pair info for address: ${pairAddress}`);
    
    try {
      // Validate address format
      const validAddress = ethers.utils.getAddress(pairAddress);
      
      // Check cache first
      if (this.pairCache[validAddress]) {
        const cached = this.pairCache[validAddress];
        if (Date.now() - cached.timestamp < 10000) {
          console.log('Using cached pair info:', cached);
          return cached;
        }
      }

      // Verify contract exists
      const code = await this.provider.getCode(validAddress);
      if (code === '0x' || code === '0x0') {
        throw new Error(`No contract found at address ${validAddress}`);
      }

      console.log('Creating contract instance...');
      const pairContract = new Contract(validAddress, PAIR_ABI, this.provider);
      
      // Get reserves with retry logic and timeout
      let reserves;
      let retries = 3;
      while (retries > 0) {
        try {
          console.log('Fetching reserves...');
          reserves = await Promise.race([
            pairContract.getReserves(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]);
          
          if (!reserves || !reserves[0] || !reserves[1]) {
            throw new Error('Invalid reserves returned');
          }
          
          console.log('Raw reserves:', {
            reserve0: reserves[0].toString(),
            reserve1: reserves[1].toString(),
            timestamp: reserves[2].toString()
          });
          break;
        } catch (error: any) {
          retries--;
          if (retries === 0) {
            console.error(`Failed to fetch reserves for ${validAddress} after all retries`);
            throw error;
          }
          console.log(`Retrying reserves fetch... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Get token addresses with retry logic
      let token0Address, token1Address;
      retries = 3;
      while (retries > 0) {
        try {
          console.log('Fetching token addresses...');
          [token0Address, token1Address] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);
          console.log('Token addresses:', { token0: token0Address, token1: token1Address });
          break;
        } catch (error: any) {
          retries--;
          if (retries === 0) throw error;
          console.log(`Retrying token address fetch... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Get token info with retry logic
      let token0: TokenInfo | undefined, token1: TokenInfo | undefined;
      retries = 3;
      while (retries > 0) {
        try {
          console.log('Fetching token info...');
          [token0, token1] = await Promise.all([
            this.getTokenInfo(token0Address),
            this.getTokenInfo(token1Address)
          ]);
          
          if (!token0 || !token1) {
            throw new Error('Failed to fetch token info');
          }
          
          console.log('Token info:', {
            token0: {
              address: token0.address,
              symbol: token0.symbol,
              decimals: token0.decimals
            },
            token1: {
              address: token1.address,
              symbol: token1.symbol,
              decimals: token1.decimals
            }
          });
          break;
        } catch (error: any) {
          retries--;
          if (retries === 0) throw error;
          console.log(`Retrying token info fetch... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!token0 || !token1) {
        throw new Error('Failed to fetch token info after retries');
      }

      console.log('Calculating prices...');
      const reserve0 = ethers.utils.formatUnits(reserves[0], token0.decimals);
      const reserve1 = ethers.utils.formatUnits(reserves[1], token1.decimals);
      
      const price0 = parseFloat(reserve1) / parseFloat(reserve0);
      const price1 = parseFloat(reserve0) / parseFloat(reserve1);

      console.log('Calculated values:', {
        formattedReserve0: reserve0,
        formattedReserve1: reserve1,
        price0: price0,
        price1: price1
      });

      const pairInfo: PairInfo = {
        address: validAddress,
        token0,
        token1,
        reserve0,
        reserve1,
        price0,
        price1,
        timestamp: Date.now()
      };

      // Update cache
      this.pairCache[validAddress] = pairInfo;
      console.log('Final pair info:', pairInfo);

      return pairInfo;
    } catch (error: any) {
      console.error('Error in getPairInfo:', error);
      console.error('Full error details:', {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        stack: error?.stack
      });
      throw error;
    }
  }

  private async fetchAllPrices(): Promise<Record<string, DexPrices>> {
    const prices: Record<string, DexPrices> = {};
    
    for (const [pairKey, addresses] of Object.entries(this.pairs)) {
      console.log('Processing pair:', pairKey);
      console.log('Pair addresses:', addresses);
      
      try {
        const [quickswapInfo, sushiswapInfo] = await Promise.all([
          this.getPairInfo(addresses.quickswap),
          this.getPairInfo(addresses.sushiswap)
        ]);

        prices[pairKey] = {
          quickswap: quickswapInfo,
          sushiswap: sushiswapInfo
        };
      } catch (error) {
        console.error(`Error fetching prices for ${pairKey}:`, error);
      }
    }

    console.log('All prices fetched:', prices);
    return prices;
  }

  private calculatePriceImpact(amount: number, reserveIn: number, reserveOut: number): number {
    // Calculate price impact using constant product formula
    const k = reserveIn * reserveOut;
    const newReserveIn = reserveIn + amount;
    const newReserveOut = k / newReserveIn;
    const priceImpact = Math.abs((reserveOut - newReserveOut) / reserveOut);
    
    // Add detailed logging
    console.log('Price impact calculation:', {
      amount,
      reserveIn,
      reserveOut,
      newReserveIn,
      newReserveOut,
      priceImpact: `${(priceImpact * 100).toFixed(4)}%`,
      k,
      priceImpactPercentage: (priceImpact * 100).toFixed(4)
    });
    
    return priceImpact;
  }

  private async getGasPrice(): Promise<number> {
    try {
      const gasPrice = await this.provider.getGasPrice();
      // Convert from Wei to Gwei, then to MATIC (1 Gwei = 0.000000001 MATIC)
      const gasPriceInMatic = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')) * 0.000000001;
      console.log('Current gas price:', gasPriceInMatic, 'MATIC');
      return gasPriceInMatic;
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return 0.0001; // Fallback to a very low gas price if fetch fails
    }
  }

  private convertGasCostToToken(gasCostInMatic: number, tokenDecimals: number): number {
    // Convert gas cost from MATIC to USD, then to token units
    const gasCostInUSD = gasCostInMatic * this.MATIC_PRICE_USD;
    // Convert USD to token units considering token decimals
    return gasCostInUSD * Math.pow(10, tokenDecimals - 6);
  }

  private calculatePriceDifference(price1: number, price2: number): number {
    // For stable pairs, we want to detect even small differences
    const avgPrice = (price1 + price2) / 2;
    const diff = Math.abs(price1 - price2);
    return diff / avgPrice;
  }

  private async calculateArbitrageOpportunity(
    pairKey: string,
    amount: number,
    prices: DexPrices
  ): Promise<ArbitrageOpportunity | null> {
    const { quickswap, sushiswap } = prices;
    if (!quickswap || !sushiswap) return null;

    // Calculate price differences between all DEX pairs
    const priceDiffs = [
      {
        dex1: 'quickswap',
        dex2: 'sushiswap',
        diff: Math.abs(quickswap.price0 - sushiswap.price0) / quickswap.price0
      }
    ];

    // Find the pair with highest price difference
    const bestDiff = priceDiffs.reduce((best, current) => 
      current.diff > best.diff ? current : best
    );

    // Get the DEXes with the best price difference
    const dex1 = prices[bestDiff.dex1];
    const dex2 = prices[bestDiff.dex2];

    // Calculate price impact for both DEXes
    const priceImpact1 = this.calculatePriceImpact(
      amount,
      parseFloat(dex1.reserve0),
      parseFloat(dex1.reserve1)
    );

    const priceImpact2 = this.calculatePriceImpact(
      amount,
      parseFloat(dex2.reserve0),
      parseFloat(dex2.reserve1)
    );

    // Skip if price impact is too high
    if (priceImpact1 > this.MAX_PRICE_IMPACT || priceImpact2 > this.MAX_PRICE_IMPACT) {
      console.log(`Price impact too high for ${pairKey}:`, {
        amount,
        priceImpact1,
        priceImpact2,
        maxAllowed: this.MAX_PRICE_IMPACT
      });
      return null;
    }

    // Simulate the trade
    const trade = this.simulateTrade(amount, dex1, dex2);

    // Check if profitable
    const isProfitable = this.checkProfitability(trade, amount);

    if (!isProfitable.isProfitable) {
      console.log(`Trade not profitable for ${pairKey}:`, {
        amount,
        trade,
        conditions: isProfitable.conditions
      });
      return null;
    }

    // Generate detailed explanation
    const details = `
Initial Amount: ${amount.toFixed(6)} ${dex1.token0.symbol}
First DEX (${bestDiff.dex1}): ${trade.amountAfterFirstDex.toFixed(6)} ${dex1.token1.symbol}
Second DEX (${bestDiff.dex2}): ${trade.amountAfterSecondDex.toFixed(6)} ${dex1.token0.symbol}
Final Amount: ${trade.finalAmount.toFixed(6)} ${dex1.token0.symbol}

Fees: ${trade.fees.toFixed(6)} ${dex1.token0.symbol}
Gas Cost: ${trade.gasCost.toFixed(6)} ${dex1.token0.symbol}
Profit: ${(trade.finalAmount - amount).toFixed(6)} ${dex1.token0.symbol}

Price Impact:
${bestDiff.dex1}: ${(priceImpact1 * 100).toFixed(4)}%
${bestDiff.dex2}: ${(priceImpact2 * 100).toFixed(4)}%
`;

    return {
      pair: pairKey,
      amount,
      profit: trade.finalAmount - amount,
      profitPercentage: ((trade.finalAmount - amount) / amount) * 100,
      priceImpact: {
        [bestDiff.dex1]: priceImpact1,
        [bestDiff.dex2]: priceImpact2
      },
      path: [bestDiff.dex1, bestDiff.dex2],
      details,
      profitable: true
    };
  }

  public async findArbitrageOpportunities(amount?: number): Promise<Array<{
    pairKey: string;
    amount?: number;
    opportunity: ArbitrageOpportunity;
    details: {
      priceImpact: { [dex: string]: number };
      fees: number;
      gasCost: number;
      profitPercentage: number;
      isProfitable: boolean;
      conditions: {
        profitPositive: boolean;
        feesAcceptable: boolean;
        gasCostAcceptable: boolean;
        minProfitThreshold: boolean;
      };
      afterFirstTrade: number;
      afterSecondTrade: number;
      finalAmount: number;
    };
  }>> {
    // If amount is not specified or is 0, use the optimal amount finder
    if (!amount || amount === 0) {
      console.log('Finding optimal amounts for arbitrage opportunities...');
      const prices = await this.fetchAllPrices();
      const opportunities = [];

      for (const [pairKey, pairPrices] of Object.entries(prices)) {
        try {
          // Test different amounts
          for (const amount of this.OPTIMAL_AMOUNTS) {
            const opportunity = await this.calculateArbitrageOpportunity(pairKey, amount, pairPrices);
            const trade = this.simulateTrade(amount, pairPrices.quickswap, pairPrices.sushiswap);
            const profitability = this.checkProfitability(trade, amount);
            
              opportunities.push({
                pairKey,
              amount,
              opportunity: opportunity || {
                pair: pairKey,
                amount,
                profit: trade.finalAmount - amount - trade.gasCost,
                profitPercentage: ((trade.finalAmount - amount - trade.gasCost) / amount) * 100,
                priceImpact: {},
                path: ['quickswap', 'sushiswap'],
                details: 'Trade not profitable',
                profitable: false
              },
              details: {
                priceImpact: {
                  quickswap: this.calculatePriceImpact(amount, parseFloat(pairPrices.quickswap.reserve0), parseFloat(pairPrices.quickswap.reserve1)),
                  sushiswap: this.calculatePriceImpact(amount, parseFloat(pairPrices.sushiswap.reserve0), parseFloat(pairPrices.sushiswap.reserve1))
                },
                fees: trade.fees,
                gasCost: trade.gasCost,
                profitPercentage: ((trade.finalAmount - amount - trade.gasCost) / amount) * 100,
                isProfitable: profitability.isProfitable,
                conditions: profitability.conditions,
                afterFirstTrade: trade.amountAfterFirstDex,
                afterSecondTrade: trade.amountAfterSecondDex,
                finalAmount: trade.finalAmount
              }
            });
          }
        } catch (error) {
          console.error(`Error processing ${pairKey}:`, error);
        }
      }

      return opportunities.sort((a, b) => 
        (b.opportunity.profit / b.amount) - (a.opportunity.profit / a.amount)
      );
    }

    // If amount is specified, use that amount for all pairs
    console.log(`Finding arbitrage opportunities with fixed amount: ${amount}`);
    const prices = await this.fetchAllPrices();
    const opportunities = [];

    for (const [pairKey, pairPrices] of Object.entries(prices)) {
      try {
        const opportunity = await this.calculateArbitrageOpportunity(pairKey, amount, pairPrices);
        const trade = this.simulateTrade(amount, pairPrices.quickswap, pairPrices.sushiswap);
        const profitability = this.checkProfitability(trade, amount);
        
          opportunities.push({
            pairKey,
          amount,
          opportunity: opportunity || {
            pair: pairKey,
            amount,
            profit: trade.finalAmount - amount - trade.gasCost,
            profitPercentage: ((trade.finalAmount - amount - trade.gasCost) / amount) * 100,
            priceImpact: {},
            path: ['quickswap', 'sushiswap'],
            details: 'Trade not profitable',
            profitable: false
          },
          details: {
            priceImpact: {
              quickswap: this.calculatePriceImpact(amount, parseFloat(pairPrices.quickswap.reserve0), parseFloat(pairPrices.quickswap.reserve1)),
              sushiswap: this.calculatePriceImpact(amount, parseFloat(pairPrices.sushiswap.reserve0), parseFloat(pairPrices.sushiswap.reserve1))
            },
            fees: trade.fees,
            gasCost: trade.gasCost,
            profitPercentage: ((trade.finalAmount - amount - trade.gasCost) / amount) * 100,
            isProfitable: profitability.isProfitable,
            conditions: profitability.conditions,
            afterFirstTrade: trade.amountAfterFirstDex,
            afterSecondTrade: trade.amountAfterSecondDex,
            finalAmount: trade.finalAmount
          }
        });
      } catch (error) {
        console.error(`Error calculating arbitrage for ${pairKey}:`, error);
      }
    }

    return opportunities.sort((a, b) => b.opportunity.profit - a.opportunity.profit);
  }

  private simulateTrade(amount: number, dex1: PairInfo, dex2: PairInfo) {
    // Calculate amounts after fees and slippage
    const amountAfterFirstDex = amount * (1 - this.POLYGON_FLASH_LOAN_FEE);
    const amountAfterSecondDex = amountAfterFirstDex * (1 - this.POLYGON_FLASH_LOAN_FEE);
    const finalAmount = amountAfterSecondDex * (1 - this.POLYGON_SLIPPAGE_TOLERANCE);

    // Calculate gas cost
    const gasCost = this.POLYGON_GAS_LIMIT * this.POLYGON_GAS_PRICE * 1e-9; // Convert gwei to MATIC

    console.log('Trade simulation:', {
      amount,
      amountAfterFirstDex,
      amountAfterSecondDex,
      finalAmount,
      fees: amount * this.POLYGON_FLASH_LOAN_FEE * 2,
      gasCost,
      flashLoanFee: this.POLYGON_FLASH_LOAN_FEE,
      slippage: this.POLYGON_SLIPPAGE_TOLERANCE
    });

    return {
      initialAmount: amount,
      amountAfterFirstDex,
      amountAfterSecondDex,
      finalAmount,
      fees: amount * this.POLYGON_FLASH_LOAN_FEE * 2,
      gasCost
    };
  }

  private checkProfitability(trade: ReturnType<typeof this.simulateTrade>, amount: number) {
    const profit = trade.finalAmount - amount - trade.gasCost;
    const profitPercentage = (profit / amount) * 100;
    const isProfitable = profit > 0;

    console.log('Profitability check:', {
      initialAmount: amount,
      finalAmount: trade.finalAmount,
      gasCost: trade.gasCost,
      fees: trade.fees,
      profit,
      profitPercentage: `${profitPercentage.toFixed(4)}%`,
      isProfitable
    });

    return {
      isProfitable,
      conditions: {
        profitPositive: profit > 0,
        feesAcceptable: trade.fees < amount * 0.01, // Fees less than 1%
        gasCostAcceptable: trade.gasCost < amount * 0.001, // Gas cost less than 0.1%
        minProfitThreshold: profitPercentage > this.POLYGON_MIN_PROFIT_THRESHOLD * 100
      }
    };
  }
} 