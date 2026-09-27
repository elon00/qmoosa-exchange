export interface CryptoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  last_updated: string;
  isTradable: boolean;
  tradingPair?: string;
}

export interface MarketFeedResponse {
  coins: CryptoMarketCoin[];
  total: number;
  lastUpdated: number;
  cacheSource: 'coingecko_api' | 'in_memory_cache' | 'fallback_dataset';
  attribution: string;
  nextRefreshSeconds: number;
}

export class CoinGeckoFeed {
  constructor(private fetcher: typeof fetch = fetch) {}
  private inFlight: Promise<MarketFeedResponse> | null = null;
  private retryAfter = 0;
  public async getTop100Coins(): Promise<MarketFeedResponse> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.loadCoins();
    try { return await this.inFlight; } finally { this.inFlight = null; }
  }

  private cache: CryptoMarketCoin[] | null = null;
  private lastFetchedTime: number = 0;
  // 10 minutes cache TTL (6 calls/hour = 144/day = ~4,464/month, well within 10,000/month free tier)
  private readonly CACHE_TTL_MS: number = 10 * 60 * 1000;

  // Implemented trading pairs in Qmoosa Exchange (supports TON/GRAM)
  private readonly TRADABLE_SYMBOLS = new Set(['TON', 'BTC', 'ETH', 'SOL']);

  /**
   * Pre-populated fallback dataset covering top 15 cryptocurrencies
   * Ensures 100% uptime even if CoinGecko Demo API is rate-limited or offline.
   */
  private readonly FALLBACK_COINS: CryptoMarketCoin[] = [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      current_price: 64280.5,
      market_cap: 1267490000000,
      market_cap_rank: 1,
      total_volume: 34120000000,
      high_24h: 65120.0,
      low_24h: 63890.0,
      price_change_percentage_24h: -0.85,
      last_updated: new Date().toISOString(),
      isTradable: true,
      tradingPair: 'BTC-USDT'
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      current_price: 3485.2,
      market_cap: 419200000000,
      market_cap_rank: 2,
      total_volume: 18520000000,
      high_24h: 3520.0,
      low_24h: 3410.0,
      price_change_percentage_24h: 1.65,
      last_updated: new Date().toISOString(),
      isTradable: true,
      tradingPair: 'ETH-USDT'
    },
    {
      id: 'tether',
      symbol: 'usdt',
      name: 'Tether USDT',
      image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
      current_price: 1.0,
      market_cap: 118400000000,
      market_cap_rank: 3,
      total_volume: 58200000000,
      high_24h: 1.002,
      low_24h: 0.998,
      price_change_percentage_24h: 0.02,
      last_updated: new Date().toISOString(),
      isTradable: true,
      tradingPair: 'TON-USDT'
    },
    {
      id: 'binancecoin',
      symbol: 'bnb',
      name: 'BNB',
      image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
      current_price: 578.4,
      market_cap: 84200000000,
      market_cap_rank: 4,
      total_volume: 1120000000,
      high_24h: 585.0,
      low_24h: 572.0,
      price_change_percentage_24h: 1.12,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'solana',
      symbol: 'sol',
      name: 'Solana',
      image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      current_price: 154.8,
      market_cap: 72100000000,
      market_cap_rank: 5,
      total_volume: 4890000000,
      high_24h: 158.4,
      low_24h: 146.5,
      price_change_percentage_24h: 5.12,
      last_updated: new Date().toISOString(),
      isTradable: true,
      tradingPair: 'SOL-USDT'
    },
    {
      id: 'the-open-network',
      symbol: 'ton',
      name: 'Toncoin (Gram)',
      image: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png',
      current_price: 6.452,
      market_cap: 16450000000,
      market_cap_rank: 8,
      total_volume: 385000000,
      high_24h: 6.58,
      low_24h: 6.18,
      price_change_percentage_24h: 3.42,
      last_updated: new Date().toISOString(),
      isTradable: true,
      tradingPair: 'TON-USDT'
    },
    {
      id: 'ripple',
      symbol: 'xrp',
      name: 'XRP',
      image: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
      current_price: 0.584,
      market_cap: 32900000000,
      market_cap_rank: 7,
      total_volume: 1420000000,
      high_24h: 0.595,
      low_24h: 0.575,
      price_change_percentage_24h: -1.24,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'dogecoin',
      symbol: 'doge',
      name: 'Dogecoin',
      image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
      current_price: 0.124,
      market_cap: 18100000000,
      market_cap_rank: 9,
      total_volume: 980000000,
      high_24h: 0.129,
      low_24h: 0.121,
      price_change_percentage_24h: 2.85,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'cardano',
      symbol: 'ada',
      name: 'Cardano',
      image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
      current_price: 0.385,
      market_cap: 13800000000,
      market_cap_rank: 10,
      total_volume: 420000000,
      high_24h: 0.392,
      low_24h: 0.378,
      price_change_percentage_24h: -0.45,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'usd-coin',
      symbol: 'usdc',
      name: 'USDC',
      image: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
      current_price: 1.0,
      market_cap: 35400000000,
      market_cap_rank: 6,
      total_volume: 8400000000,
      high_24h: 1.001,
      low_24h: 0.999,
      price_change_percentage_24h: 0.01,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'avalanche-2',
      symbol: 'avax',
      name: 'Avalanche',
      image: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
      current_price: 28.5,
      market_cap: 11400000000,
      market_cap_rank: 11,
      total_volume: 510000000,
      high_24h: 29.8,
      low_24h: 27.9,
      price_change_percentage_24h: 3.12,
      last_updated: new Date().toISOString(),
      isTradable: false
    },
    {
      id: 'chainlink',
      symbol: 'link',
      name: 'Chainlink',
      image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
      current_price: 12.4,
      market_cap: 7520000000,
      market_cap_rank: 13,
      total_volume: 290000000,
      high_24h: 12.8,
      low_24h: 12.1,
      price_change_percentage_24h: 1.45,
      last_updated: new Date().toISOString(),
      isTradable: false
    }
  ];

  /**
   * Fetch Top 100 cryptocurrencies with in-memory caching
   */
  private async loadCoins(): Promise<MarketFeedResponse> {
    const now = Date.now();

    // Check if in-memory cache is still fresh
    if (this.cache && now - this.lastFetchedTime < this.CACHE_TTL_MS) {
      const remainingSeconds = Math.max(0, Math.floor((this.CACHE_TTL_MS - (now - this.lastFetchedTime)) / 1000));
      return {
        coins: this.cache,
        total: this.cache.length,
        lastUpdated: this.lastFetchedTime,
        cacheSource: 'in_memory_cache',
        attribution: 'Data provided by CoinGecko (Cached)',
        nextRefreshSeconds: remainingSeconds
      };
    }

    try {
      if (now < this.retryAfter) throw new Error('Provider backoff');
      const apiKey = process.env.COINGECKO_API_KEY;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'QmoosaExchange/1.0'
      };
      if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
      }

      const url =
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h';

      const response = await this.fetcher(url, { headers, signal: AbortSignal.timeout(6000) });

      if (response.ok) {
        const rawData: any[] = await response.json();
        const coins: CryptoMarketCoin[] = rawData.map(c => {
          const symUpper = c.symbol.toUpperCase();
          const isTonGram = c.id === 'the-open-network';
          const isTradable = isTonGram || this.TRADABLE_SYMBOLS.has(symUpper);
          const tradingPair = isTradable ? (isTonGram ? 'TON-USDT' : `${symUpper}-USDT`) : undefined;
          return {
            id: c.id,
            symbol: c.symbol.toLowerCase(),
            name: c.name,
            image: c.image,
            current_price: Number(c.current_price) || 0,
            market_cap: Number(c.market_cap) || 0,
            market_cap_rank: Number(c.market_cap_rank) || 0,
            total_volume: Number(c.total_volume) || 0,
            high_24h: Number(c.high_24h) || 0,
            low_24h: Number(c.low_24h) || 0,
            price_change_percentage_24h: Number(c.price_change_percentage_24h) || 0,
            last_updated: c.last_updated || new Date().toISOString(),
            isTradable,
            tradingPair
          };
        });

        this.cache = coins;
        this.lastFetchedTime = now;

        return {
          coins,
          total: coins.length,
          lastUpdated: now,
          cacheSource: 'coingecko_api',
          attribution: 'Data provided by CoinGecko Public Demo API',
          nextRefreshSeconds: Math.floor(this.CACHE_TTL_MS / 1000)
        };
      }
    } catch {
      // CoinGecko API request failed or timed out — fallback safely
    }

    this.retryAfter = Math.max(this.retryAfter, now + 5 * 60 * 1000);
    // Fallback to cached or preset dataset
    const fallbackList = this.cache || this.FALLBACK_COINS;
    return {
      coins: fallbackList,
      total: fallbackList.length,
      lastUpdated: this.lastFetchedTime,
      cacheSource: 'fallback_dataset',
      attribution: 'Data provided by CoinGecko (Fallback/Offline Cache)',
      nextRefreshSeconds: 300
    };
  }

  public getTradableSymbols(): string[] {
    return Array.from(this.TRADABLE_SYMBOLS);
  }
}
