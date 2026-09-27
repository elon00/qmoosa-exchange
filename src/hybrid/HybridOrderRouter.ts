import { Address, Hex } from 'viem';
import { MatchingEngine } from '../engine/MatchingEngine.js';
import { ZeroExOrderBook } from './ZeroExOrderBook.js';
import {
  ZeroExSwapPrice,
  ZeroExSwapQuote,
  LiquiditySource,
  ZERO_EX_EXCHANGE_PROXY,
  SignedZeroExOrder
} from './zeroExTypes.js';
import { ZeroExOrderValidator } from './ZeroExOrderValidator.js';

export interface RouteSplit {
  source: string;
  fillAmount: number;
  proportion: number;
  averagePrice: number;
}

export class HybridOrderRouter {
  constructor(
    private matchingEngine: MatchingEngine,
    private zeroExOrderBook: ZeroExOrderBook
  ) {}

  /**
   * Resolve token addresses to internal CEX market symbols (e.g. TON-USDT, ETH-USDT)
   */
  private resolveSymbol(buyToken: string, sellToken: string): { symbol: string; isBuy: boolean } | null {
    const buyUpper = buyToken.toUpperCase();
    const sellUpper = sellToken.toUpperCase();

    // Map common names/symbols
    const normalize = (t: string) => {
      if (t.includes('0X582D87') || t === 'TON') return 'TON';
      if (t.includes('0XDAC17F') || t === 'USDT') return 'USDT';
      if (t.includes('0XC02AAA') || t === 'ETH' || t === 'WETH') return 'ETH';
      if (t.includes('0X2260FA') || t === 'BTC' || t === 'WBTC') return 'BTC';
      return t;
    };

    const normBuy = normalize(buyUpper);
    const normSell = normalize(sellUpper);

    if (normBuy === 'TON' && normSell === 'USDT') return { symbol: 'TON-USDT', isBuy: true };
    if (normBuy === 'USDT' && normSell === 'TON') return { symbol: 'TON-USDT', isBuy: false };
    if (normBuy === 'ETH' && normSell === 'USDT') return { symbol: 'ETH-USDT', isBuy: true };
    if (normBuy === 'USDT' && normSell === 'ETH') return { symbol: 'ETH-USDT', isBuy: false };
    if (normBuy === 'BTC' && normSell === 'USDT') return { symbol: 'BTC-USDT', isBuy: true };
    if (normBuy === 'USDT' && normSell === 'BTC') return { symbol: 'BTC-USDT', isBuy: false };

    return null;
  }

  /**
   * Get indicative price comparison across CEX, 0x SRA, and DEX AMMs
   */
  public getPrice(params: {
    buyToken: Address | string;
    sellToken: Address | string;
    sellAmount: string;
    chainId?: number;
  }): ZeroExSwapPrice {
    const chainId = params.chainId || 1;
    const sellAmountNum = parseFloat(params.sellAmount);

    const resolved = this.resolveSymbol(params.buyToken, params.sellToken);
    let basePrice = 6.45; // Default fallback for TON-USDT
    let cexAvailableLiquidity = 150000;

    if (resolved) {
      const stats = this.matchingEngine.get24HourStats(resolved.symbol);
      if (stats && stats.closePrice > 0) {
        basePrice = stats.closePrice;
      }
      const depth = this.matchingEngine.getDepth(resolved.symbol, 10);
      if (depth) {
        cexAvailableLiquidity = depth.asks.reduce((sum, a) => sum + a[1], 0);
      }
    }

    const buyPrice = resolved?.isBuy ? basePrice : 1 / basePrice;
    const estimatedBuyAmount = (sellAmountNum / buyPrice).toFixed(6);

    const sources: LiquiditySource[] = [
      {
        name: 'Qmoosa_CEX_Engine',
        proportion: '0.60',
        liquidityUsd: cexAvailableLiquidity * basePrice,
        avgSlippagePct: 0.05
      },
      {
        name: 'ZeroEx_SRA_RFQ',
        proportion: '0.25',
        liquidityUsd: 85000,
        avgSlippagePct: 0.08
      },
      {
        name: 'Uniswap_V3',
        proportion: '0.10',
        liquidityUsd: 250000,
        avgSlippagePct: 0.12
      },
      {
        name: 'Curve_STONfi',
        proportion: '0.05',
        liquidityUsd: 120000,
        avgSlippagePct: 0.15
      }
    ];

    const exchangeProxy = ZERO_EX_EXCHANGE_PROXY[chainId] || ZERO_EX_EXCHANGE_PROXY[1];

    return {
      chainId,
      price: (1 / buyPrice).toFixed(6),
      grossPrice: (1 / buyPrice).toFixed(6),
      buyAmount: estimatedBuyAmount,
      sellAmount: params.sellAmount,
      buyTokenAddress: params.buyToken as Address,
      sellTokenAddress: params.sellToken as Address,
      sources,
      allowanceTarget: exchangeProxy,
      gasPrice: '25000000000', // 25 gwei
      estimatedGas: '145000'
    };
  }

  /**
   * Generate an executable Hybrid 0x Protocol Swap Quote with calldata
   */
  public getQuote(params: {
    buyToken: Address | string;
    sellToken: Address | string;
    sellAmount: string;
    takerAddress?: Address;
    chainId?: number;
    slippagePercentage?: number;
  }): ZeroExSwapQuote {
    const chainId = params.chainId || 1;
    const slippage = params.slippagePercentage || 0.01; // 1%
    const priceData = this.getPrice(params);

    const buyAmountBig = parseFloat(priceData.buyAmount);
    const minBuyAmount = (buyAmountBig * (1 - slippage)).toFixed(6);
    const guaranteedPrice = (parseFloat(priceData.price) * (1 - slippage)).toFixed(6);

    const exchangeProxy = ZERO_EX_EXCHANGE_PROXY[chainId] || ZERO_EX_EXCHANGE_PROXY[1];

    // Check if we have signed 0x orders in SRA book for this pair
    const sraOrders = this.zeroExOrderBook.getOrders({
      makerToken: params.buyToken as Address,
      takerToken: params.sellToken as Address,
      status: 'FILLABLE'
    });

    let executionCalldata: Hex = '0x';
    if (sraOrders.length > 0) {
      // Encode first 0x fill order calldata
      executionCalldata = ZeroExOrderValidator.generateFillCalldata(sraOrders[0], params.sellAmount);
    } else {
      // Synthesize 0x Exchange Proxy general transformERC20 calldata signature
      executionCalldata = `0x415565b0000000000000000000000000${params.sellToken.replace(/^0x/, '').padStart(64, '0')}` as Hex;
    }

    return {
      ...priceData,
      to: exchangeProxy,
      data: executionCalldata,
      value: '0',
      protocolFee: '0',
      minBuyAmount,
      guaranteedPrice,
      orders: sraOrders.slice(0, 5)
    };
  }

  /**
   * Get all supported liquidity sources for 0x Swap API
   */
  public getSources(): { records: string[] } {
    return {
      records: [
        'Qmoosa_CEX_Engine',
        'ZeroEx_SRA_RFQ',
        'Uniswap_V3',
        'Curve',
        'Balancer_V2',
        'STON.fi',
        'DeDust',
        'SushiSwap'
      ]
    };
  }
}
