import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Bot,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  Layers,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  ChevronDown,
  Cpu,
  Globe,
  Key,
  Zap,
  ArrowLeftRight,
  Search,
  Star,
  User,
  LogOut,
  Sparkles,
  BarChart3,
  Eye
} from 'lucide-react';

interface Market {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

interface Top100Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  isTradable: boolean;
  tradingPair?: string;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
  source?: 'CEX' | '0x_DEX';
}

interface Trade {
  id: string;
  price: number;
  quantity: number;
  time: number;
  side: 'BUY' | 'SELL';
  venue?: 'CEX' | '0x_Protocol';
}

interface OpenOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  price: number;
  quantity: number;
  filledQuantity: number;
  createdAt: number;
  executionMode?: 'CEX' | '0x_EIP712';
}

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<string>('TON-USDT');
  const [tradingMode, setTradingMode] = useState<'CEX' | 'DEX_ZERO_EX'>('CEX');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState<string>('6.4500');
  const [quantity, setQuantity] = useState<string>('50');
  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'balances' | 'zeroex' | 'top100' | 'x402' | 'agentics' | 'multimodal' | 'pqc'>('orders');

  // x402 Bazaar Protocol State
  const [x402Service, setX402Service] = useState<'signals' | 'tradeSettle' | 'orderbookDepth' | 'porAttestation'>('signals');
  const [x402Chain, setX402Chain] = useState<'solana' | 'evm' | 'ton'>('solana');
  const [x402Challenge, setX402Challenge] = useState<any | null>(null);
  const [x402Receipt, setX402Receipt] = useState<any | null>(null);
  const [x402ResultData, setX402ResultData] = useState<any | null>(null);
  const [x402Status, setX402Status] = useState<string>('Ready to test x402 Bazaar Protocol');

  // AI Agentics State
  const [agentCycleStatus, setAgentCycleStatus] = useState<string>('Autonomous Swarm Active (5 Agents Running)');
  const [agentLogs, setAgentLogs] = useState<any[]>([
    { id: '1', agentName: 'Alpha Arbitrage Swarm', actionType: 'ARBITRAGE_TRADE', details: 'Routed 42 bps spread on TON-USDT across 0x SRA & CEX Engine', time: 'Just now', profit: '+$3.40', pqc: true },
    { id: '2', agentName: 'PQC Lattice Sentinel', actionType: 'PQC_ATTESTATION', details: 'Attested 15 quantum-shielded orders with 3,309-byte ML-DSA-65 signatures', time: '1m ago', pqc: true },
    { id: '3', agentName: 'Risk Guardian AI', actionType: 'RISK_ADJUSTMENT', details: 'Verified 108.5% solvency reserve coverage; double-entry ledger intact', time: '2m ago', pqc: true },
    { id: '4', agentName: 'Neural Market Maker', actionType: 'MM_REQUOTE', details: 'Tightened TON-USDT spread to 0.05% with 10 laddered bids & asks', time: '3m ago', pqc: true },
    { id: '5', agentName: 'x402 Autonomous Broker', actionType: 'X402_SETTLEMENT', details: 'Settled 0.002 USDC fee on Solana Testnet for zero-collateral agent limit order', time: '4m ago', pqc: true }
  ]);

  // Multimodal AI State
  const [nlPrompt, setNlPrompt] = useState<string>('Buy 25 TON at 6.40 with stop loss 6.10 and take profit 7.20');
  const [promptExecutionResult, setPromptExecutionResult] = useState<any | null>(null);
  const [multimodalReport] = useState<any>({
    regime: 'ACCUMULATION & BULLISH EXPANSION',
    sentimentScore: 72,
    sentimentLabel: 'BULLISH',
    recommendation: 'ACCUMULATE_DIPS',
    pattern: 'Bullish Engulfing (Confidence: 88%)',
    support: 6.34,
    resistance: 6.55,
    target: 6.84
  });

  // NIST PQC State
  const [pqcVerifiedState, setPqcVerifiedState] = useState<boolean>(true);
  const [pqcSessionKey] = useState<string>('pqc_sec_7f9e8d1c3a5b4e6f2a0b8c9d1e2f3a4b');
  const [pqcSignatureSample] = useState<string>('0x3a4f89b1c2d0e7f8... (3,309 bytes NIST FIPS 204 ML-DSA-65)');

  // User Auth & Virtual Money State
  const [currentUser, setCurrentUser] = useState<{ email: string; isDemo: boolean } | null>({
    email: 'demo_trader@qmoosa.exchange',
    isDemo: true
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');

  // Top 100 Market Search & Favourites
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favouriteCoins, setFavouriteCoins] = useState<Set<string>>(new Set(['bitcoin', 'the-open-network', 'ethereum', 'solana']));

  // Web3 Wallet state (0x Protocol Non-Custodial)
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>('0x71C8360f3a8b273b458A3F2d790dC3e45995C72d');
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({
    USDT: 12500,
    TON: 1500,
    ETH: 3.2
  });

  // Modals
  const [showPoRModal, setShowPoRModal] = useState<boolean>(false);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showBotModal, setShowBotModal] = useState<boolean>(false);
  const [showZeroExModal, setShowZeroExModal] = useState<boolean>(false);

  // Balances (Virtual Demo CEX Account)
  const [balances, setBalances] = useState<Record<string, { available: number; reserved: number }>>({
    USDT: { available: 10000.0, reserved: 0.0 },
    TON: { available: 500.0, reserved: 0.0 },
    BTC: { available: 0.0, reserved: 0.0 },
    ETH: { available: 0.0, reserved: 0.0 },
    SOL: { available: 0.0, reserved: 0.0 }
  });

  // Solvency / PoR data
  const [solvencyStatus, setSolvencyStatus] = useState({
    rootHash: '0x8f2d9c1b7a4e58f96e4c7d0b3a1f9e2c4a8b7d6e5c4b3a2f1e0d9c8b7a6f5e4d',
    ratio: 108.5,
    lastAudit: Date.now() - 120000,
    totalReservesUsd: 4850000,
    totalLiabilitiesUsd: 4470000
  });

  // Proof Verification State
  const [proofVerificationStatus, setProofVerificationStatus] = useState<'idle' | 'validating' | 'verified'>('idle');

  // Markets list
  const markets: Market[] = [
    {
      symbol: 'TON-USDT',
      baseAsset: 'TON',
      quoteAsset: 'USDT',
      price: 6.452,
      change24h: 3.42,
      high24h: 6.58,
      low24h: 6.18,
      volume24h: 1245890
    },
    {
      symbol: 'BTC-USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      price: 64280.5,
      change24h: -0.85,
      high24h: 65120.0,
      low24h: 63890.0,
      volume24h: 84521000
    },
    {
      symbol: 'ETH-USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      price: 3485.2,
      change24h: 1.65,
      high24h: 3520.0,
      low24h: 3410.0,
      volume24h: 42100000
    },
    {
      symbol: 'SOL-USDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      price: 154.8,
      change24h: 5.12,
      high24h: 158.4,
      low24h: 146.5,
      volume24h: 29800000
    }
  ];

  // Top 100 Coins Sample Dataset (CoinGecko Feed compatible)
  const top100Coins: Top100Coin[] = [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      current_price: 64280.5,
      market_cap: 1267490000000,
      market_cap_rank: 1,
      total_volume: 34120000000,
      price_change_percentage_24h: -0.85,
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
      price_change_percentage_24h: 1.65,
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
      price_change_percentage_24h: 0.02,
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
      price_change_percentage_24h: 1.12,
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
      price_change_percentage_24h: 5.12,
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
      price_change_percentage_24h: 3.42,
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
      price_change_percentage_24h: -1.24,
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
      price_change_percentage_24h: 2.85,
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
      price_change_percentage_24h: -0.45,
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
      price_change_percentage_24h: 0.01,
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
      price_change_percentage_24h: 3.12,
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
      price_change_percentage_24h: 1.45,
      isTradable: false
    }
  ];

  const filteredCoins = useMemo(() => {
    return top100Coins.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [searchQuery]);

  const currentMarket = useMemo(() => {
    return markets.find(m => m.symbol === selectedMarket) || markets[0];
  }, [selectedMarket]);

  // Order Book simulated state
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([
    {
      id: 'ord-101',
      symbol: 'TON-USDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 6.42,
      quantity: 100,
      filledQuantity: 0,
      createdAt: Date.now() - 360000,
      executionMode: 'CEX'
    },
    {
      id: '0x-eip712-88',
      symbol: 'TON-USDT',
      side: 'SELL',
      type: 'LIMIT',
      price: 6.55,
      quantity: 50,
      filledQuantity: 0,
      createdAt: Date.now() - 180000,
      executionMode: '0x_EIP712'
    }
  ]);

  // Bot states
  const [mmBotActive, setMmBotActive] = useState<boolean>(true);
  const [gridBotActive, setGridBotActive] = useState<boolean>(false);

  // Portfolio total valuation calculation
  const totalPortfolioValueUsd = useMemo(() => {
    let sum = balances.USDT.available + balances.USDT.reserved;
    sum += (balances.TON.available + balances.TON.reserved) * 6.452;
    sum += (balances.BTC.available + balances.BTC.reserved) * 64280.5;
    sum += (balances.ETH.available + balances.ETH.reserved) * 3485.2;
    sum += (balances.SOL.available + balances.SOL.reserved) * 154.8;
    return sum;
  }, [balances]);

  // Initialize and simulate live market updates
  useEffect(() => {
    const mid = currentMarket.price;
    const initialBids: OrderBookLevel[] = [];
    const initialAsks: OrderBookLevel[] = [];

    let cumBid = 0;
    for (let i = 1; i <= 10; i++) {
      const p = mid - (mid * 0.0008 * i);
      const q = Math.round((20 + Math.random() * 80) * 10) / 10;
      cumBid += q;
      initialBids.push({
        price: p,
        quantity: q,
        total: cumBid,
        source: i % 3 === 0 ? '0x_DEX' : 'CEX'
      });
    }

    let cumAsk = 0;
    for (let i = 1; i <= 10; i++) {
      const p = mid + (mid * 0.0008 * i);
      const q = Math.round((20 + Math.random() * 80) * 10) / 10;
      cumAsk += q;
      initialAsks.push({
        price: p,
        quantity: q,
        total: cumAsk,
        source: i % 2 === 0 ? '0x_DEX' : 'CEX'
      });
    }

    setBids(initialBids);
    setAsks(initialAsks);

    const initialTrades: Trade[] = [
      { id: 't-1', price: mid, quantity: 45.2, time: Date.now() - 4000, side: 'BUY', venue: 'CEX' },
      { id: '0x-tx-2', price: mid - 0.002, quantity: 18.0, time: Date.now() - 9000, side: 'SELL', venue: '0x_Protocol' },
      { id: 't-3', price: mid + 0.001, quantity: 92.5, time: Date.now() - 15000, side: 'BUY', venue: 'CEX' }
    ];
    setTrades(initialTrades);
    setPrice(mid.toFixed(selectedMarket.includes('BTC') ? 2 : 4));
  }, [selectedMarket]);

  // Real-time market tick simulation
  useEffect(() => {
    const timer = setInterval(() => {
      if (!mmBotActive) return;

      const delta = (Math.random() - 0.49) * (currentMarket.price * 0.0006);
      const newMid = Math.max(0.1, currentMarket.price + delta);

      const tradeSide: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const tradePrice = tradeSide === 'BUY' ? newMid + 0.001 : newMid - 0.001;
      const tradeQty = Math.round((5 + Math.random() * 40) * 10) / 10;
      const venue = Math.random() > 0.4 ? 'CEX' : '0x_Protocol';

      const newTrade: Trade = {
        id: venue === '0x_Protocol' ? `0x-${Date.now().toString(16)}` : `t-${Date.now()}`,
        price: tradePrice,
        quantity: tradeQty,
        time: Date.now(),
        side: tradeSide,
        venue
      };

      setTrades(prev => [newTrade, ...prev.slice(0, 25)]);

      setBids(prev =>
        prev.map((b, idx) => ({
          ...b,
          price: newMid - (newMid * 0.0008 * (idx + 1))
        }))
      );
      setAsks(prev =>
        prev.map((a, idx) => ({
          ...a,
          price: newMid + (newMid * 0.0008 * (idx + 1))
        }))
      );
    }, 1200);

    return () => clearInterval(timer);
  }, [currentMarket, mmBotActive]);

  // Handle Order Submit (CEX vs 0x Protocol DEX)
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    const numQty = parseFloat(quantity);

    if (isNaN(numQty) || numQty <= 0) return;
    if (orderType === 'LIMIT' && (isNaN(numPrice) || numPrice <= 0)) return;

    const baseAsset = currentMarket.baseAsset;
    const quoteAsset = currentMarket.quoteAsset;
    const effectivePrice = orderType === 'LIMIT' ? numPrice : currentMarket.price;
    const totalCost = effectivePrice * numQty;

    if (tradingMode === 'DEX_ZERO_EX') {
      if (!walletConnected) {
        setWalletConnected(true);
      }

      const activeWalletBal = orderSide === 'BUY' ? walletBalances[quoteAsset] || 0 : walletBalances[baseAsset] || 0;
      const reqAmount = orderSide === 'BUY' ? totalCost : numQty;

      if (activeWalletBal < reqAmount) {
        alert(`Insufficient ${orderSide === 'BUY' ? quoteAsset : baseAsset} in connected Web3 wallet!`);
        return;
      }

      const new0xOrder: OpenOrder = {
        id: `0x-${Math.random().toString(36).slice(2, 8)}`,
        symbol: selectedMarket,
        side: orderSide,
        type: orderType,
        price: effectivePrice,
        quantity: numQty,
        filledQuantity: 0,
        createdAt: Date.now(),
        executionMode: '0x_EIP712'
      };

      setOpenOrders(prev => [new0xOrder, ...prev]);

      if (orderSide === 'BUY') {
        setWalletBalances(prev => ({
          ...prev,
          [quoteAsset]: Math.max(0, (prev[quoteAsset] || 0) - totalCost),
          [baseAsset]: (prev[baseAsset] || 0) + numQty * 0.999
        }));
      } else {
        setWalletBalances(prev => ({
          ...prev,
          [baseAsset]: Math.max(0, (prev[baseAsset] || 0) - numQty),
          [quoteAsset]: (prev[quoteAsset] || 0) + totalCost * 0.999
        }));
      }

      alert(`✅ 0x Protocol EIP-712 Order Signed!\nOrder Hash: 0x8a9f...41e2\nSettlement: 0x Exchange Proxy (Non-Custodial)`);
      return;
    }

    // CEX Mode (Virtual Demo Balance)
    if (orderSide === 'BUY') {
      if (balances[quoteAsset].available < totalCost) {
        alert(`Insufficient Virtual ${quoteAsset} balance! Click "Reset Demo" to restore $10,000 USDT.`);
        return;
      }
      setBalances(prev => ({
        ...prev,
        [quoteAsset]: {
          available: prev[quoteAsset].available - totalCost,
          reserved: prev[quoteAsset].reserved + totalCost
        }
      }));
    } else {
      if (balances[baseAsset].available < numQty) {
        alert(`Insufficient Virtual ${baseAsset} balance!`);
        return;
      }
      setBalances(prev => ({
        ...prev,
        [baseAsset]: {
          available: prev[baseAsset].available - numQty,
          reserved: prev[baseAsset].reserved + numQty
        }
      }));
    }

    const newOrder: OpenOrder = {
      id: `ord-${Date.now().toString().slice(-4)}`,
      symbol: selectedMarket,
      side: orderSide,
      type: orderType,
      price: effectivePrice,
      quantity: numQty,
      filledQuantity: 0,
      createdAt: Date.now(),
      executionMode: 'CEX'
    };

    setOpenOrders(prev => [newOrder, ...prev]);

    setTimeout(() => {
      setOpenOrders(prev => prev.filter(o => o.id !== newOrder.id));
      setTrades(prev => [
        {
          id: `t-exec-${Date.now()}`,
          price: effectivePrice,
          quantity: numQty,
          time: Date.now(),
          side: orderSide,
          venue: 'CEX'
        },
        ...prev
      ]);

      if (orderSide === 'BUY') {
        setBalances(prev => ({
          ...prev,
          [quoteAsset]: {
            ...prev[quoteAsset],
            reserved: Math.max(0, prev[quoteAsset].reserved - totalCost)
          },
          [baseAsset]: {
            ...prev[baseAsset],
            available: prev[baseAsset].available + numQty * 0.999
          }
        }));
      } else {
        setBalances(prev => ({
          ...prev,
          [baseAsset]: {
            ...prev[baseAsset],
            reserved: Math.max(0, prev[baseAsset].reserved - numQty)
          },
          [quoteAsset]: {
            ...prev[quoteAsset],
            available: prev[quoteAsset].available + totalCost * 0.999
          }
        }));
      }
    }, 1200);
  };

  const handleCancelOrder = (id: string) => {
    setOpenOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleVerifyProof = () => {
    setProofVerificationStatus('validating');
    setTimeout(() => {
      setProofVerificationStatus('verified');
    }, 800);
  };

  const handleResetDemoBalance = () => {
    setBalances({
      USDT: { available: 10000.0, reserved: 0.0 },
      TON: { available: 500.0, reserved: 0.0 },
      BTC: { available: 0.0, reserved: 0.0 },
      ETH: { available: 0.0, reserved: 0.0 },
      SOL: { available: 0.0, reserved: 0.0 }
    });
    alert('✅ Demo Balance Reset! $10,000 Virtual USDT + 500 Virtual TON credited.');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return;
    setCurrentUser({
      email: authEmail,
      isDemo: true
    });
    setShowAuthModal(false);
    alert(`Welcome, ${authEmail}! $10,000 Virtual Demo Trading Grant is active.`);
  };

  const toggleFavourite = (coinId: string) => {
    setFavouriteCoins(prev => {
      const next = new Set(prev);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      return next;
    });
  };

  const handleTriggerX402Challenge = async () => {
    setX402Challenge(null); setX402Receipt(null); setX402ResultData(null);
    setX402Status('Payments disabled: verified testnet settlement is not configured. Do not send funds.');
  };
  const handleSettleX402Payment = handleTriggerX402Challenge;
  const handleExecuteAgentCycle = async () => {
    setAgentCycleStatus('Not activated: existing agent strategies are simulations. No trades executed.');
  };
  const handleExecuteNlPrompt = async () => {
    setPromptExecutionResult(null);
    alert('Prompt trading is disabled until risk controls and execution are verified.');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0e14] text-[#eaecef]">
      <div role="status" className="p-4 bg-amber-950 text-amber-100 text-sm">
        SANDBOX — simulated trading, AI and reserve displays. No real deposits, withdrawals or x402 settlement.
        PQC algorithms are demonstrations, not NIST certification. <a href="./sandbox.html" className="underline">Open connected backend dashboard</a>
      </div>
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#1e2329] bg-[#12161f] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f0b90b] via-[#0ecb81] to-[#1652f0] p-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-extrabold text-white text-base">Q</span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-emerald-400 bg-clip-text text-transparent">
                  QMOOSA
                </span>
                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-mono rounded font-bold uppercase">
                  HYBRID
                </span>
              </div>
              <div className="text-[9px] text-gray-400 font-mono tracking-wider">
                CEX MATCHING + 0x PROTOCOL v4
              </div>
            </div>
          </div>

          {/* Hybrid Mode Switcher (CEX vs 0x Protocol DEX) */}
          <div className="flex items-center bg-[#0d1118] p-1 rounded-lg border border-[#232a3d]">
            <button
              onClick={() => setTradingMode('CEX')}
              className={`flex items-center space-x-1 px-3 py-1 text-xs font-bold rounded-md transition ${
                tradingMode === 'CEX'
                  ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>CEX Engine (HFT)</span>
            </button>
            <button
              onClick={() => setTradingMode('DEX_ZERO_EX')}
              className={`flex items-center space-x-1 px-3 py-1 text-xs font-bold rounded-md transition ${
                tradingMode === 'DEX_ZERO_EX'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>0x Protocol (DEX)</span>
            </button>
          </div>

          {/* Market Selector Pill */}
          <div className="hidden sm:flex items-center space-x-1 bg-[#181d27] p-1 rounded-md border border-[#262d3d]">
            {markets.map(m => (
              <button
                key={m.symbol}
                onClick={() => setSelectedMarket(m.symbol)}
                className={`px-3 py-1 text-xs font-semibold rounded transition ${
                  selectedMarket === m.symbol
                    ? 'bg-[#2b313a] text-yellow-400 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {m.symbol}
              </button>
            ))}
          </div>

          {/* Top 100 Markets Quick Toggle */}
          <button
            onClick={() => setActiveTab('top100')}
            className={`hidden md:flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded border ${
              activeTab === 'top100'
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-[#181d27] border-[#262d3d] text-gray-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Top 100 Crypto</span>
          </button>
        </div>

        {/* Right Action Center */}
        <div className="flex items-center space-x-2.5">
          {/* User Demo Profile / Login */}
          <div className="flex items-center space-x-1.5 bg-[#181d27] px-2.5 py-1 rounded-lg border border-[#2b313a]">
            <User className="w-3.5 h-3.5 text-yellow-400" />
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-mono">
                {currentUser ? currentUser.email.split('@')[0] : 'Guest'}
              </div>
              <div className="text-xs font-bold font-mono text-emerald-400">
                ${totalPortfolioValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={handleResetDemoBalance}
              title="Reset Demo Balance to $10,000"
              className="ml-1 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded text-[9px] font-bold hover:bg-yellow-500/30"
            >
              Reset $10k
            </button>
          </div>

          {/* Web3 Wallet Connect Button */}
          <button
            onClick={() => setWalletConnected(!walletConnected)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition shadow-sm cursor-pointer border ${
              walletConnected
                ? 'bg-[#182333] border-cyan-500/60 text-cyan-300'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-400/30 text-white hover:brightness-110'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {walletConnected ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Web3 Wallet'}
            </span>
          </button>

          {/* Proof of Reserves Pill */}
          <button
            onClick={() => setShowPoRModal(true)}
            className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-md text-xs font-semibold hover:bg-emerald-900/50 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PoR: 108.5%</span>
          </button>

          {/* Deposit / Vault */}
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-md text-xs hover:brightness-110 transition shadow-sm cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Vault</span>
          </button>
        </div>
      </header>

      {/* Mode & Free-Tier Notice Banner */}
      <div className="px-4 py-1 text-xs font-mono flex items-center justify-between border-b bg-[#121824] border-[#1e2638] text-gray-300">
        <div className="flex items-center space-x-2">
          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
            FREE TIER DEMO ACTIVE
          </span>
          <span className="text-[11px] text-gray-400">
            Virtual-Money Trading on Primary Pairs (TON, BTC, ETH, SOL) • Live CoinGecko Cached Feed (10-min TTL)
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-3 text-[11px] text-gray-400">
          <span>0x Exchange Proxy: 0xdef1...25eff</span>
          <span>•</span>
          <span>Deployments: GitHub Pages + Netlify</span>
        </div>
      </div>

      {/* Main Terminal Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Interactive Chart + Execution Log (Cols 1-8) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col border-r border-[#1e2329]">
          {/* Chart Header Bar */}
          <div className="h-10 border-b border-[#1e2329] bg-[#12161f]/80 px-4 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-200">Price Chart ({currentMarket.symbol})</span>
              <div className="flex space-x-1 bg-[#1a202c] p-0.5 rounded text-[11px]">
                <button className="px-2 py-0.5 rounded bg-[#2d3748] text-yellow-400 font-semibold">1m</button>
                <button className="px-2 py-0.5 rounded text-gray-400 hover:text-white">5m</button>
                <button className="px-2 py-0.5 rounded text-gray-400 hover:text-white">15m</button>
                <button className="px-2 py-0.5 rounded text-gray-400 hover:text-white">1h</button>
                <button className="px-2 py-0.5 rounded text-gray-400 hover:text-white">1D</button>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-gray-400 font-mono text-[11px]">
              <span>O: {currentMarket.price.toFixed(4)}</span>
              <span>H: {(currentMarket.price * 1.002).toFixed(4)}</span>
              <span>L: {(currentMarket.price * 0.998).toFixed(4)}</span>
              <span className="text-[#0ecb81]">C: {currentMarket.price.toFixed(4)}</span>
            </div>
          </div>

          {/* SVG / Canvas TradingView-Style Candlestick Display */}
          <div className="h-80 bg-[#0d1118] relative overflow-hidden flex items-center justify-center border-b border-[#1e2329]">
            <svg className="w-full h-full p-4" viewBox="0 0 800 280">
              <line x1="0" y1="60" x2="800" y2="60" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="120" x2="800" y2="120" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="180" x2="800" y2="180" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="240" x2="800" y2="240" stroke="#161c27" strokeDasharray="4 4" />

              {Array.from({ length: 32 }).map((_, i) => {
                const x = 20 + i * 24;
                const isGreen = Math.sin(i * 1.5) > -0.2;
                const bodyY = 80 + Math.sin(i * 0.4) * 35 + (i % 3) * 10;
                const bodyHeight = 15 + Math.abs(Math.sin(i)) * 30;
                const wickTop = bodyY - (5 + (i % 4) * 4);
                const wickBottom = bodyY + bodyHeight + (5 + (i % 3) * 5);
                const color = isGreen ? '#0ecb81' : '#f6465d';

                return (
                  <g key={i}>
                    <line x1={x + 7} y1={wickTop} x2={x + 7} y2={wickBottom} stroke={color} strokeWidth="1.5" />
                    <rect
                      x={x}
                      y={bodyY}
                      width="14"
                      height={bodyHeight}
                      fill={color}
                      rx="1"
                      opacity="0.9"
                    />
                    <rect
                      x={x}
                      y={280 - (bodyHeight * 0.8 + 10)}
                      width="14"
                      height={bodyHeight * 0.8 + 10}
                      fill={color}
                      opacity="0.3"
                    />
                  </g>
                );
              })}

              <line x1="0" y1="135" x2="800" y2="135" stroke="#f0b90b" strokeWidth="1" strokeDasharray="5 3" />
              <rect x="730" y="125" width="65" height="20" rx="3" fill="#f0b90b" />
              <text x="735" y="139" fill="#000" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono">
                ${currentMarket.price.toFixed(2)}
              </text>
            </svg>

            <div className="absolute bottom-3 left-4 text-xs font-mono text-gray-600 select-none pointer-events-none flex items-center space-x-2">
              <span>QMOOSA HYBRID EXECUTION: FIFO CEX CORE + 0x PROTOCOL v4 RELAYER</span>
            </div>
          </div>

          {/* Bottom Tabs: Open Orders / Balances / History / Top 100 / 0x SRA */}
          <div className="flex-1 flex flex-col bg-[#10141d]">
            <div className="h-9 border-b border-[#1e2329] bg-[#12161f] flex items-center px-4 space-x-6 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'orders'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Active Orders ({openOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'history'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Trade Tape ({trades.length})
              </button>
              <button
                onClick={() => setActiveTab('balances')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'balances'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Portfolio Assets
              </button>
              <button
                onClick={() => setActiveTab('top100')}
                className={`py-2 transition border-b-2 flex items-center space-x-1 ${
                  activeTab === 'top100'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Top 100 Cryptos</span>
              </button>
              <button
                onClick={() => setActiveTab('zeroex')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'zeroex'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                0x SRA Orders
              </button>
              <button
                onClick={() => setActiveTab('x402')}
                className={`py-2 transition border-b-2 flex items-center space-x-1 ${
                  activeTab === 'x402'
                    ? 'border-purple-400 text-purple-400 font-bold'
                    : 'border-transparent text-gray-400 hover:text-purple-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>⚡ x402 Bazaar</span>
              </button>
              <button
                onClick={() => setActiveTab('agentics')}
                className={`py-2 transition border-b-2 flex items-center space-x-1 ${
                  activeTab === 'agentics'
                    ? 'border-emerald-400 text-emerald-400 font-bold'
                    : 'border-transparent text-gray-400 hover:text-emerald-300'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span>🤖 AI Agentics</span>
              </button>
              <button
                onClick={() => setActiveTab('multimodal')}
                className={`py-2 transition border-b-2 flex items-center space-x-1 ${
                  activeTab === 'multimodal'
                    ? 'border-indigo-400 text-indigo-400 font-bold'
                    : 'border-transparent text-gray-400 hover:text-indigo-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>👁️ Multimodal</span>
              </button>
              <button
                onClick={() => setActiveTab('pqc')}
                className={`py-2 transition border-b-2 flex items-center space-x-1 ${
                  activeTab === 'pqc'
                    ? 'border-pink-400 text-pink-400 font-bold'
                    : 'border-transparent text-gray-400 hover:text-pink-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                <span>⚛️ NIST PQC</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-3 flex-1 overflow-y-auto font-mono text-xs">
              {activeTab === 'top100' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2329]">
                    <div className="relative w-72">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search top coins (e.g. TON, BTC, ETH)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[#181d27] border border-[#2b313a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Attribution: Data provided by <strong>CoinGecko Public Demo API</strong> (10-min Cache)
                    </div>
                  </div>

                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e2329] pb-1">
                        <th className="font-normal py-1 w-8">#</th>
                        <th className="font-normal py-1">Name</th>
                        <th className="font-normal py-1">Price (USD)</th>
                        <th className="font-normal py-1">24h Change</th>
                        <th className="font-normal py-1">Market Cap</th>
                        <th className="font-normal py-1">24h Volume</th>
                        <th className="font-normal py-1 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoins.map(coin => (
                        <tr key={coin.id} className="border-b border-[#161a22] hover:bg-[#161c28]">
                          <td className="py-2 text-gray-500">{coin.market_cap_rank}</td>
                          <td className="py-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleFavourite(coin.id)}
                                className="text-gray-600 hover:text-yellow-400"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    favouriteCoins.has(coin.id) ? 'fill-yellow-400 text-yellow-400' : ''
                                  }`}
                                />
                              </button>
                              <img src={coin.image} alt={coin.name} className="w-4 h-4 rounded-full" />
                              <span className="font-bold text-white">{coin.name}</span>
                              <span className="text-[10px] text-gray-400 uppercase">{coin.symbol}</span>
                            </div>
                          </td>
                          <td className="py-2 font-bold text-white">${coin.current_price.toLocaleString()}</td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                coin.price_change_percentage_24h >= 0
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-rose-950 text-rose-400'
                              }`}
                            >
                              {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                              {coin.price_change_percentage_24h}%
                            </span>
                          </td>
                          <td className="py-2 text-gray-400">${(coin.market_cap / 1e9).toFixed(2)}B</td>
                          <td className="py-2 text-gray-400">${(coin.total_volume / 1e6).toFixed(1)}M</td>
                          <td className="py-2 text-right">
                            {coin.isTradable && coin.tradingPair ? (
                              <button
                                onClick={() => {
                                  setSelectedMarket(coin.tradingPair!);
                                  setActiveTab('orders');
                                }}
                                className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded text-[10px] cursor-pointer"
                              >
                                Trade {coin.symbol.toUpperCase()}
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-500">View Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="w-full">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e2329] pb-1">
                        <th className="font-normal py-1">Time</th>
                        <th className="font-normal py-1">Mode</th>
                        <th className="font-normal py-1">Symbol</th>
                        <th className="font-normal py-1">Side</th>
                        <th className="font-normal py-1">Price</th>
                        <th className="font-normal py-1">Amount</th>
                        <th className="font-normal py-1 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-gray-500">
                            No active demo orders
                          </td>
                        </tr>
                      ) : (
                        openOrders.map(o => (
                          <tr key={o.id} className="border-b border-[#161a22] hover:bg-[#161c28]">
                            <td className="py-2 text-gray-400">{new Date(o.createdAt).toLocaleTimeString()}</td>
                            <td className="py-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  o.executionMode === '0x_EIP712'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                                }`}
                              >
                                {o.executionMode === '0x_EIP712' ? '0x Non-Custodial' : 'Virtual CEX'}
                              </span>
                            </td>
                            <td className="py-2 font-bold">{o.symbol}</td>
                            <td
                              className={`py-2 font-semibold ${
                                o.side === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                              }`}
                            >
                              {o.side}
                            </td>
                            <td className="py-2">${o.price.toFixed(4)}</td>
                            <td className="py-2">{o.quantity}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleCancelOrder(o.id)}
                                className="px-2 py-0.5 rounded text-[11px] bg-red-950/60 text-red-400 hover:bg-red-900 border border-red-800/40"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="w-full">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e2329] pb-1">
                        <th className="font-normal py-1">Time</th>
                        <th className="font-normal py-1">Venue</th>
                        <th className="font-normal py-1">Side</th>
                        <th className="font-normal py-1">Price</th>
                        <th className="font-normal py-1">Amount</th>
                        <th className="font-normal py-1 text-right">Total (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 10).map(t => (
                        <tr key={t.id} className="border-b border-[#161a22] hover:bg-[#161c28]">
                          <td className="py-1.5 text-gray-400">{new Date(t.time).toLocaleTimeString()}</td>
                          <td className="py-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                t.venue === '0x_Protocol'
                                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-gray-800 text-gray-300'
                              }`}
                            >
                              {t.venue === '0x_Protocol' ? '0x Proxy' : 'CEX Tape'}
                            </span>
                          </td>
                          <td
                            className={`py-1.5 font-semibold ${
                              t.side === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                            }`}
                          >
                            {t.side}
                          </td>
                          <td className="py-1.5 font-bold">${t.price.toFixed(4)}</td>
                          <td className="py-1.5">{t.quantity}</td>
                          <td className="py-1.5 text-right font-medium">
                            ${(t.price * t.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'balances' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold text-gray-300">
                        Virtual Money Portfolio Valuation:
                      </div>
                      <button
                        onClick={handleResetDemoBalance}
                        className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded text-xs"
                      >
                        Reset Demo to $10,000 USDT
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(balances).map(([asset, bal]) => (
                        <div key={asset} className="p-3 bg-[#161a24] rounded-lg border border-[#232a3b]">
                          <div className="text-xs font-bold text-yellow-400 mb-1">{asset} Balance</div>
                          <div className="text-sm font-bold text-white">{bal.available.toLocaleString()}</div>
                          <div className="text-[11px] text-gray-400">Locked: {bal.reserved.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5" />
                      <span>Connected Web3 Self-Custody Wallet (0x Non-Custodial):</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.entries(walletBalances).map(([asset, amt]) => (
                        <div key={asset} className="p-3 bg-[#111927] rounded-lg border border-cyan-900/40">
                          <div className="text-xs font-bold text-cyan-400 mb-1">{asset} On-Chain</div>
                          <div className="text-sm font-bold text-white">{amt.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400">MetaMask / Tonkeeper</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'zeroex' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2329]">
                    <span className="text-gray-400">0x Standard Relayer API (SRA v4) Signed Limit Orders</span>
                    <span className="text-[11px] text-cyan-400 font-mono">0xdef1...25eff</span>
                  </div>
                  <div className="p-3 bg-[#161a24] rounded-lg border border-[#252c3c] font-mono text-xs">
                    <div className="text-emerald-400 font-bold mb-1">
                      BID #0x9a8f • Maker: 0x90F8...c9C1 • Type: EIP-712 Signed
                    </div>
                    <div className="text-gray-300">
                      Buying 100 TON @ $6.40 (Taker: 640 USDT) • Expiry: 7 Days
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 break-all">
                      Hash: 0x2e8f17bc9a4190c128547b7194639e7cb2819f074a38dfc78912e9b048592c41
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'x402' && (
                <div className="space-y-4">
                  {/* Protocol Header */}
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1e2329] gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-300 font-bold text-[11px] flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-purple-400 inline" />
                        <span>x402 v2 Bazaar Protocol</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        Node: <strong className="text-white">qmoosa-exchange</strong> • Mesh Orchestrator: <strong className="text-cyan-400">bountyhunter-os</strong>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href="./.well-known/x402-bazaar.json"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-[#181d27] hover:bg-[#232a38] text-purple-400 border border-purple-800/40 rounded text-[11px] flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3 inline" />
                        <span>Manifest (.well-known/x402-bazaar.json)</span>
                      </a>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                        ● MESH ACTIVE
                      </span>
                    </div>
                  </div>

                  {/* Multi-Chain Gateways */}
                  <div>
                    <div className="text-xs font-bold text-gray-300 mb-1.5 flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>Unified Multi-Chain Micropayment PayTo Gateways:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2.5 bg-[#161a24] rounded border border-purple-900/30">
                        <div className="text-purple-400 font-bold mb-0.5">Solana Testnet (USDC)</div>
                        <div className="text-gray-400 text-[10px] font-mono break-all">BPshPrMazV7qunhcq18AvCHjSceHbKytiRDNrtCv68g3</div>
                      </div>
                      <div className="p-2.5 bg-[#161a24] rounded border border-purple-900/30">
                        <div className="text-purple-400 font-bold mb-0.5">BNB / EVM Testnet (USDT)</div>
                        <div className="text-gray-400 text-[10px] font-mono break-all">0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7</div>
                      </div>
                      <div className="p-2.5 bg-[#161a24] rounded border border-purple-900/30">
                        <div className="text-purple-400 font-bold mb-0.5">TON Mainnet (Gram)</div>
                        <div className="text-gray-400 text-[10px] font-mono break-all">UQAJO_hgYMZq3ULuzFv7927z-WgsM0BApc0IRniDrHORTzm3</div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Sandbox Form */}
                  <div className="p-3 bg-[#131722] rounded-lg border border-[#252c3c] space-y-3">
                    <div className="text-xs font-bold text-gray-200 flex items-center space-x-1">
                      <Cpu className="w-3.5 h-3.5 text-purple-400" />
                      <span>Machine-to-Machine (M2M) Agent Payment Sandbox</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-gray-400 block mb-1">Target x402 Micro-Service:</label>
                        <select
                          value={x402Service}
                          onChange={e => setX402Service(e.target.value as any)}
                          className="w-full bg-[#181d27] border border-[#2b313a] rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                        >
                          <option value="signals">AI Arbitrage & SOR Signals (0.001 USDC)</option>
                          <option value="tradeSettle">Zero-Balance Pay-Per-Trade (0.002 USDC)</option>
                          <option value="orderbookDepth">Hybrid OrderBook L2/L3 Depth (0.0005 USDC)</option>
                          <option value="porAttestation">Merkle PoR Solvency Attestation (0.001 USDC)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-gray-400 block mb-1">Settlement Chain:</label>
                        <select
                          value={x402Chain}
                          onChange={e => setX402Chain(e.target.value as any)}
                          className="w-full bg-[#181d27] border border-[#2b313a] rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                        >
                          <option value="solana">Solana Testnet (USDC / SOL)</option>
                          <option value="evm">BNB Chain Testnet / EVM (USDT / QUSD)</option>
                          <option value="ton">TON Mainnet (Gram / QTON)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={handleTriggerX402Challenge}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded text-xs flex items-center space-x-1"
                      >
                        <Zap className="w-3.5 h-3.5 inline mr-1" />
                        <span>1. Trigger HTTP 402 Challenge</span>
                      </button>

                      <button
                        onClick={handleSettleX402Payment}
                        disabled={!x402Challenge}
                        className={`px-3 py-1.5 font-bold rounded text-xs flex items-center space-x-1 ${
                          x402Challenge
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        <span>2. Sign & Settle Micropayment (HTTP 200)</span>
                      </button>

                      <span className="text-gray-400 text-[11px] ml-auto">
                        Status: <strong className="text-yellow-400">{x402Status}</strong>
                      </span>
                    </div>

                    {/* Challenge Box */}
                    {x402Challenge && (
                      <div className="p-2.5 bg-[#0e121a] rounded border border-purple-900/40 text-[11px] font-mono space-y-1">
                        <div className="text-purple-300 font-bold">
                          HTTP 402 Payment Required Challenge Issued:
                        </div>
                        <div className="text-gray-300">
                          Nonce: <span className="text-yellow-400">{x402Challenge.nonce}</span> • Cost: <span className="text-emerald-400">{x402Challenge.cost}</span>
                        </div>
                        <div className="text-gray-500 text-[10px]">
                          Header: <span className="text-gray-400">PAYMENT-REQUIRED: base64(challenge)</span>
                        </div>
                      </div>
                    )}

                    {/* Receipt & Unlocked Data Box */}
                    {x402Receipt && (
                      <div className="p-3 bg-[#0d161a] rounded border border-emerald-900/50 text-[11px] font-mono space-y-2">
                        <div className="flex items-center justify-between border-b border-emerald-950 pb-1.5">
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-400" />
                            <span>HTTP 200 OK — x402 Receipt Settled: {x402Receipt.receiptId}</span>
                          </span>
                          <span className="text-gray-400 text-[10px]">{x402Receipt.settledAt}</span>
                        </div>

                        {/* If Arbitrage Signals */}
                        {x402ResultData?.signals && (
                          <div className="space-y-1.5">
                            <div className="text-xs text-gray-200 font-bold">
                              Unlocked Real-Time Arbitrage & SOR Routing Signals:
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="text-gray-500 border-b border-[#1b2230]">
                                    <th className="py-1">Pair</th>
                                    <th className="py-1">CEX Price</th>
                                    <th className="py-1">0x Relayer</th>
                                    <th className="py-1">DEX AMM</th>
                                    <th className="py-1">Spread</th>
                                    <th className="py-1">Recommended Execution Route</th>
                                    <th className="py-1 text-right">Est. Profit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {x402ResultData.signals.map((s: any, idx: number) => (
                                    <tr key={idx} className="border-b border-[#161c28]">
                                      <td className="py-1.5 font-bold text-white">{s.pair}</td>
                                      <td className="py-1.5">${s.cexPrice}</td>
                                      <td className="py-1.5 text-cyan-400">${s.zeroExPrice}</td>
                                      <td className="py-1.5 text-blue-400">${s.ammPrice}</td>
                                      <td className="py-1.5 text-yellow-400 font-bold">{s.spreadBps} bps</td>
                                      <td className="py-1.5 text-emerald-300 font-mono text-[10px]">{s.recommendedRoute}</td>
                                      <td className="py-1.5 text-right font-bold text-emerald-400">+{s.expectedProfitPct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* If Trade Settle */}
                        {x402ResultData?.orderId && (
                          <div className="p-2 bg-[#121c18] rounded border border-emerald-800/40 text-emerald-300 space-y-1">
                            <div className="font-bold">✅ Order Executed with Zero Account Balance!</div>
                            <div className="text-gray-300">
                              Order ID: <span className="font-mono text-white">{x402ResultData.orderId}</span> • Pair: <span className="font-bold">{x402ResultData.pair}</span> • Size: {x402ResultData.amount} @ ${x402ResultData.price}
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              Fee Settle: {x402ResultData.feeSettlement}
                            </div>
                          </div>
                        )}

                        {/* If PoR Attestation */}
                        {x402ResultData?.solvencyStatus && (
                          <div className="p-2 bg-[#121c18] rounded border border-emerald-800/40 text-emerald-300 space-y-1">
                            <div className="font-bold">🛡️ {x402ResultData.solvencyStatus} (Solvency Ratio: {x402ResultData.reservesRatio})</div>
                            <div className="text-gray-300 text-[10px] break-all">
                              Merkle Root Hash: <span className="font-mono text-white">{x402ResultData.rootHash}</span>
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              Signature: {x402ResultData.attestationSignature}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ----------------- AI AGENTICS TAB ----------------- */}
              {activeTab === 'agentics' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1e2329] gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-[11px] flex items-center space-x-1">
                        <Bot className="w-3.5 h-3.5 text-emerald-400 inline" />
                        <span>Autonomous AI Agentics Swarm</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        Fleet: <strong className="text-white">5 Active Autonomous Agents</strong>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleExecuteAgentCycle}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        <span>Run Swarm Cycle</span>
                      </button>
                      <span className="text-[11px] text-yellow-400">{agentCycleStatus}</span>
                    </div>
                  </div>

                  {/* 5 Specialized Autonomous Agents Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 bg-[#141a24] rounded-lg border border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">Alpha Arbitrage Swarm</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">ACTIVE</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">Routes cross-venue triangular spreads between CEX, 0x Relayer & AMMs.</div>
                      <div className="text-[10px] text-gray-500 pt-1">Confidence: 94% • Executed: 142 Trades</div>
                    </div>

                    <div className="p-2.5 bg-[#141a24] rounded-lg border border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">Risk Guardian AI</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">ACTIVE</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">Zero-deficit double-entry ledger guard & Proof of Reserves solvency monitor.</div>
                      <div className="text-[10px] text-gray-500 pt-1">Confidence: 99% • Solvency: 108.5%</div>
                    </div>

                    <div className="p-2.5 bg-[#141a24] rounded-lg border border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">Neural Market Maker</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">ACTIVE</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">Continuous high-depth ladder quoting with sub-10bps tight spreads.</div>
                      <div className="text-[10px] text-gray-500 pt-1">Confidence: 91% • Quotes: 312 Levels</div>
                    </div>

                    <div className="p-2.5 bg-[#141a24] rounded-lg border border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">PQC Lattice Sentinel</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">ACTIVE</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">NIST FIPS 204 ML-DSA-65 post-quantum verification on order gateways.</div>
                      <div className="text-[10px] text-gray-500 pt-1">Confidence: 98% • Lattice Sig: 3,309 Bytes</div>
                    </div>

                    <div className="p-2.5 bg-[#141a24] rounded-lg border border-emerald-900/40 space-y-1 sm:col-span-2 lg:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">x402 Autonomous Broker</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">ACTIVE</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">Listens to HTTP 402 challenges, pays micro-fees on Solana/EVM/TON, and triggers zero-collateral trades.</div>
                      <div className="text-[10px] text-gray-500 pt-1">Confidence: 96% • Settlements: 54 Streams</div>
                    </div>
                  </div>

                  {/* Swarm Action Logs Table */}
                  <div className="p-3 bg-[#111620] rounded-lg border border-[#232a3a] space-y-2">
                    <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
                      <span>Real-Time Autonomous Agent Execution Feed:</span>
                      <span className="text-[10px] text-gray-500">Auto-refreshing</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="text-gray-500 border-b border-[#1b2230]">
                            <th className="py-1">Agent</th>
                            <th className="py-1">Action Type</th>
                            <th className="py-1">Execution Details</th>
                            <th className="py-1">PQC Guard</th>
                            <th className="py-1 text-right">Profit / Outcome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentLogs.map((log: any) => (
                            <tr key={log.id} className="border-b border-[#161c28] hover:bg-[#161d2b]">
                              <td className="py-1.5 font-bold text-white">{log.agentName}</td>
                              <td className="py-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                                  {log.actionType}
                                </span>
                              </td>
                              <td className="py-1.5 text-gray-300 text-[10px]">{log.details}</td>
                              <td className="py-1.5 text-purple-400 font-mono text-[10px]">
                                {log.pqc ? '🛡️ ML-DSA-65 Valid' : 'Standard'}
                              </td>
                              <td className="py-1.5 text-right font-bold text-emerald-400">
                                {log.profit || 'Success'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- MULTIMODAL AI TAB ----------------- */}
              {activeTab === 'multimodal' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1e2329] gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-bold text-[11px] flex items-center space-x-1">
                        <Eye className="w-3.5 h-3.5 text-indigo-400 inline" />
                        <span>Multimodal Vision & NLP AI Terminal</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        Market: <strong className="text-white">{selectedMarket}</strong> (${currentMarket.price.toFixed(4)})
                      </span>
                    </div>
                    <div className="px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px] font-bold">
                      {multimodalReport.regime}
                    </div>
                  </div>

                  {/* Vision Chart Analysis & Sentiment Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-[#131724] rounded-lg border border-indigo-900/40 space-y-1.5">
                      <div className="text-xs font-bold text-indigo-400 flex items-center space-x-1">
                        <Activity className="w-3.5 h-3.5 inline mr-1" />
                        <span>Chart Pattern Vision</span>
                      </div>
                      <div className="text-sm font-bold text-white">{multimodalReport.pattern}</div>
                      <div className="text-[11px] text-gray-400">
                        Visual candlestick analysis detected heavy accumulation at support with green engulfing impulse.
                      </div>
                      <div className="text-[11px] text-gray-300 pt-1 font-mono">
                        Support: <span className="text-emerald-400">${multimodalReport.support}</span> • Target: <span className="text-cyan-400">${multimodalReport.target}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#131724] rounded-lg border border-indigo-900/40 space-y-1.5">
                      <div className="text-xs font-bold text-indigo-400 flex items-center space-x-1">
                        <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
                        <span>Multimodal Sentiment Gauge</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-black text-emerald-400">+{multimodalReport.sentimentScore}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                          {multimodalReport.sentimentLabel}
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-yellow-400 to-emerald-400 h-full" style={{ width: `${multimodalReport.sentimentScore}%` }} />
                      </div>
                      <div className="text-[10px] text-gray-400">Fusing orderbook depth skew, volume profile & social metrics.</div>
                    </div>

                    <div className="p-3 bg-[#131724] rounded-lg border border-indigo-900/40 space-y-1.5">
                      <div className="text-xs font-bold text-indigo-400 flex items-center space-x-1">
                        <Bot className="w-3.5 h-3.5 inline mr-1" />
                        <span>AI Trade Recommendation</span>
                      </div>
                      <div className="text-sm font-bold text-emerald-300">{multimodalReport.recommendation}</div>
                      <div className="text-[11px] text-gray-400">
                        Optimal strategy: Execute scale-in limit bids within 0.5% of $6.40 support with target at $6.84.
                      </div>
                      <div className="text-[10px] text-gray-500 pt-1">Risk Rating: Low-Medium (1:3.2 R/R)</div>
                    </div>
                  </div>

                  {/* Natural Language Prompt-to-Trade Box */}
                  <div className="p-3.5 bg-[#121622] rounded-lg border border-indigo-800/40 space-y-3">
                    <div className="text-xs font-bold text-gray-200 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 inline" />
                      <span>Natural Language & Multimodal Prompt Trading (Agentic Transpiler)</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nlPrompt}
                        onChange={e => setNlPrompt(e.target.value)}
                        placeholder="Enter natural language trade instruction (e.g. 'Buy 30 TON at 6.40 with SL 6.10')..."
                        className="flex-1 bg-[#181d29] border border-[#2c3445] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        onClick={handleExecuteNlPrompt}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                      >
                        <Zap className="w-3.5 h-3.5 inline mr-1" />
                        <span>Transpile & Execute</span>
                      </button>
                    </div>

                    {promptExecutionResult && (
                      <div className="p-2.5 bg-[#0f1420] rounded border border-indigo-900/50 text-[11px] font-mono space-y-1">
                        <div className="text-emerald-400 font-bold">
                          ✅ Transpiled Intent: {promptExecutionResult.interpreted?.rationale}
                        </div>
                        <div className="text-gray-400 text-[10px]">
                          🛡️ PQC Wrap: {promptExecutionResult.pqcOrder?.signatureLength || 'NIST FIPS 204 ML-DSA-65 (3,309 Bytes)'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ----------------- NIST POST-QUANTUM CRYPTOGRAPHY (PQC) TAB ----------------- */}
              {activeTab === 'pqc' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#1e2329] gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-0.5 rounded bg-pink-950/80 border border-pink-500/50 text-pink-300 font-bold text-[11px] flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-pink-400 inline" />
                        <span>NIST Post-Quantum Cryptographic Shield</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        Standards: <strong className="text-white">FIPS 203 (ML-KEM-768) & FIPS 204 (ML-DSA-65)</strong>
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                      ● QUANTUM IMMUNE
                    </span>
                  </div>

                  {/* PQC Feature Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* ML-DSA-65 Card */}
                    <div className="p-3 bg-[#161420] rounded-lg border border-pink-900/40 space-y-2">
                      <div className="font-bold text-pink-300 flex items-center justify-between">
                        <span>NIST FIPS 204: ML-DSA-65 Lattice Digital Signatures</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-400">ORDER PROTECTION</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">
                        Replaces vulnerable ECDSA / Ed25519 signatures with Module-Lattice digital signatures immune to Shor's quantum factoring algorithm.
                      </div>
                      <div className="p-2 bg-[#0e0c16] rounded border border-pink-950 font-mono text-[10px] text-gray-300 break-all">
                        Signature Spec: 3,309 Bytes • Public Key: 1,952 Bytes<br />
                        Sample: <span className="text-pink-400">{pqcSignatureSample}</span>
                      </div>
                    </div>

                    {/* ML-KEM-768 Card */}
                    <div className="p-3 bg-[#161420] rounded-lg border border-pink-900/40 space-y-2">
                      <div className="font-bold text-pink-300 flex items-center justify-between">
                        <span>NIST FIPS 203: ML-KEM-768 Key Encapsulation</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-400">SESSION CONFIDENTIALITY</span>
                      </div>
                      <div className="text-gray-400 text-[11px]">
                        Establishes quantum-safe shared symmetric keys between machine agents and the Qmoosa matching engine.
                      </div>
                      <div className="p-2 bg-[#0e0c16] rounded border border-pink-950 font-mono text-[10px] text-gray-300 break-all">
                        Ciphertext: 1,088 Bytes • Derived HKDF Session Key:<br />
                        <span className="text-cyan-400">{pqcSessionKey}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantum Proof of Reserves Card */}
                  <div className="p-3.5 bg-[#12111d] rounded-lg border border-pink-800/40 space-y-2">
                    <div className="text-xs font-bold text-pink-300 flex items-center space-x-1">
                      <ShieldCheck className="w-4 h-4 text-pink-400 inline mr-1" />
                      <span>Quantum-Attested Merkle Sum Tree Proof of Reserves</span>
                    </div>
                    <div className="text-[11px] text-gray-300">
                      The exchange solvency root hash is signed using ML-DSA-65. Even with a future fault-tolerant quantum computer, exchange solvency attestations cannot be forged or tampered with.
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-mono pt-1 text-gray-400 border-t border-pink-950/60">
                      <span>Attestation Root: 0x8f2d9c1b7a4e...5e4d</span>
                      <span className="text-emerald-400 font-bold">100% Fully Solvent (Coverage: 108.5%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Order Book & Order Placement Form (Cols 9-12) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col bg-[#12161f]">
          {/* Order Book Panel */}
          <div className="h-72 border-b border-[#1e2329] p-2 flex flex-col">
            <div className="flex items-center justify-between text-xs text-gray-400 font-medium px-2 pb-1 border-b border-[#1e2329]">
              <span>Price (USDT)</span>
              <span>Size ({currentMarket.baseAsset})</span>
              <span>Source</span>
            </div>

            {/* Asks (Sell Orders - Red) */}
            <div className="flex-1 flex flex-col-reverse overflow-hidden font-mono text-[11px] py-1">
              {asks.slice(0, 6).map((a, i) => (
                <div
                  key={`ask-${i}`}
                  onClick={() => setPrice(a.price.toFixed(4))}
                  className="flex justify-between items-center px-2 py-0.5 hover:bg-[#1a202c] cursor-pointer relative"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-[#f6465d]/10 pointer-events-none"
                    style={{ width: `${Math.min(100, (a.quantity / 150) * 100)}%` }}
                  />
                  <span className="text-[#f6465d] font-semibold">{a.price.toFixed(4)}</span>
                  <span className="text-gray-300">{a.quantity.toFixed(1)}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded ${
                      a.source === '0x_DEX' ? 'bg-cyan-950 text-cyan-400' : 'text-gray-500'
                    }`}
                  >
                    {a.source || 'CEX'}
                  </span>
                </div>
              ))}
            </div>

            {/* Current Price Banner / Spread */}
            <div className="py-1.5 px-2 bg-[#181d27] border-y border-[#1e2329] flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-[#0ecb81] text-sm flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
                ${currentMarket.price.toFixed(4)}
              </span>
              <span className="text-[10px] text-gray-400">Spread: 0.003 (0.05%)</span>
            </div>

            {/* Bids (Buy Orders - Green) */}
            <div className="flex-1 flex flex-col overflow-hidden font-mono text-[11px] py-1">
              {bids.slice(0, 6).map((b, i) => (
                <div
                  key={`bid-${i}`}
                  onClick={() => setPrice(b.price.toFixed(4))}
                  className="flex justify-between items-center px-2 py-0.5 hover:bg-[#1a202c] cursor-pointer relative"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-[#0ecb81]/10 pointer-events-none"
                    style={{ width: `${Math.min(100, (b.quantity / 150) * 100)}%` }}
                  />
                  <span className="text-[#0ecb81] font-semibold">{b.price.toFixed(4)}</span>
                  <span className="text-gray-300">{b.quantity.toFixed(1)}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded ${
                      b.source === '0x_DEX' ? 'bg-cyan-950 text-cyan-400' : 'text-gray-500'
                    }`}
                  >
                    {b.source || 'CEX'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Execution Form */}
          <div className="flex-1 p-4 bg-[#10141d] flex flex-col justify-between">
            <div>
              {/* Buy / Sell Selector */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setOrderSide('BUY')}
                  className={`py-2 rounded font-bold text-xs transition ${
                    orderSide === 'BUY'
                      ? 'bg-[#0ecb81] text-black shadow-md shadow-emerald-500/20'
                      : 'bg-[#1e2329] text-gray-400 hover:text-white'
                  }`}
                >
                  Buy {currentMarket.baseAsset}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('SELL')}
                  className={`py-2 rounded font-bold text-xs transition ${
                    orderSide === 'SELL'
                      ? 'bg-[#f6465d] text-white shadow-md shadow-rose-500/20'
                      : 'bg-[#1e2329] text-gray-400 hover:text-white'
                  }`}
                >
                  Sell {currentMarket.baseAsset}
                </button>
              </div>

              {/* Order Type Tabs */}
              <div className="flex space-x-3 mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setOrderType('LIMIT')}
                  className={`font-semibold pb-1 border-b-2 transition ${
                    orderType === 'LIMIT'
                      ? 'border-yellow-400 text-yellow-400'
                      : 'border-transparent text-gray-400'
                  }`}
                >
                  Limit
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`font-semibold pb-1 border-b-2 transition ${
                    orderType === 'MARKET'
                      ? 'border-yellow-400 text-yellow-400'
                      : 'border-transparent text-gray-400'
                  }`}
                >
                  Market (0x Swap)
                </button>
              </div>

              <form onSubmit={handlePlaceOrder} className="space-y-3">
                {orderType === 'LIMIT' && (
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Price</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        className="w-full bg-[#181d27] border border-[#2b313a] rounded px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-yellow-500"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">USDT</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Amount</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full bg-[#181d27] border border-[#2b313a] rounded px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-yellow-500"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">
                      {currentMarket.baseAsset}
                    </span>
                  </div>
                </div>

                {/* Available Balance Preview */}
                <div className="pt-1 text-xs flex justify-between text-gray-400 font-mono">
                  <span>
                    {tradingMode === 'DEX_ZERO_EX' ? 'Web3 Wallet Balance:' : 'Virtual Demo Balance:'}
                  </span>
                  <span className="text-white font-bold">
                    {tradingMode === 'DEX_ZERO_EX'
                      ? orderSide === 'BUY'
                        ? `${(walletBalances.USDT || 0).toLocaleString()} USDT`
                        : `${(walletBalances[currentMarket.baseAsset] || 0).toLocaleString()} ${currentMarket.baseAsset}`
                      : orderSide === 'BUY'
                      ? `${balances.USDT.available.toLocaleString()} USDT`
                      : `${balances[currentMarket.baseAsset].available.toLocaleString()} ${currentMarket.baseAsset}`}
                  </span>
                </div>

                {/* Total Value */}
                <div className="text-xs flex justify-between text-gray-400 font-mono">
                  <span>Order Value:</span>
                  <span className="text-yellow-400 font-bold">
                    ${((parseFloat(price) || currentMarket.price) * (parseFloat(quantity) || 0)).toFixed(2)} USDT
                  </span>
                </div>

                {/* Smart Order Routing breakdown display */}
                <div className="p-2 bg-[#161c28] rounded border border-[#242c3c] text-[10px] font-mono text-gray-400">
                  <div className="text-cyan-400 font-bold flex items-center justify-between mb-1">
                    <span>Smart Hybrid Routing (SOR):</span>
                    <span>Best Price</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Qmoosa CEX Engine:</span>
                    <span>60%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 0x SRA RFQ Relayer:</span>
                    <span>25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Uniswap v3 / STON.fi:</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className={`w-full py-2.5 rounded font-bold text-sm tracking-wide transition mt-2 cursor-pointer ${
                    tradingMode === 'DEX_ZERO_EX'
                      ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : orderSide === 'BUY'
                      ? 'bg-[#0ecb81] hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-[#f6465d] hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  }`}
                >
                  {tradingMode === 'DEX_ZERO_EX'
                    ? `Sign 0x EIP-712 ${orderSide === 'BUY' ? 'Buy' : 'Sell'}`
                    : `${orderSide === 'BUY' ? 'Buy' : 'Sell'} ${currentMarket.baseAsset} (Virtual CEX)`}
                </button>
              </form>
            </div>

            <div className="text-[10px] text-gray-500 text-center font-mono pt-2">
              Virtual Trading Active • Free Demo Account • Zero Real Loss Risk
            </div>
          </div>
        </div>
      </div>

      {/* 0x Protocol Hybrid Architecture Modal */}
      {showZeroExModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-[#2b313a] rounded-xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222836] pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-6 h-6 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">0x Protocol v4 Hybrid Exchange Architecture</h2>
              </div>
              <button
                onClick={() => setShowZeroExModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Qmoosa Exchange combines off-chain high-frequency order matching with non-custodial on-chain settlement
              powered by <strong>0x Protocol v4</strong> and <strong>Smart Order Routing (SOR)</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c]">
                <div className="text-[11px] text-gray-400">0x Exchange Proxy Contract</div>
                <div className="text-xs font-mono font-bold text-cyan-300 break-all select-all mt-1">
                  0xdef1c0ded9bec7f1a1670819833240f027b25eff
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Multi-chain deployed (Ethereum, Arbitrum, Base)</div>
              </div>

              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c]">
                <div className="text-[11px] text-gray-400">Standard Relayer API (SRA v4)</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                  Active at /orderbook/v1
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Full EIP-712 Limit Order validation</div>
              </div>
            </div>

            <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#1e2329] font-mono text-xs mb-4">
              <div className="text-gray-400 text-[10px] mb-1">0x SWAP API ENDPOINT (GET /swap/v1/quote):</div>
              <div className="text-yellow-400 break-all select-all">
                http://localhost:4000/swap/v1/quote?buyToken=TON&sellToken=USDT&sellAmount=1000
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowZeroExModal(false)}
                className="px-4 py-1.5 bg-[#2b313a] text-gray-200 text-xs font-semibold rounded hover:bg-[#38414e]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof of Reserves Audit Modal */}
      {showPoRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-[#2b313a] rounded-xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222836] pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Cryptographic Proof of Reserves (PoR)</h2>
              </div>
              <button
                onClick={() => setShowPoRModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Qmoosa Exchange implements institutional Merkle Sum Tree liabilities verification (Binance & Coinbase
              standard). Any user can independently audit that 100% of deposited assets are held in custodial cold/hot
              reserves.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c]">
                <div className="text-[11px] text-gray-400">Exchange Solvency Ratio</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">108.5%</div>
                <div className="text-[10px] text-emerald-500/80">Fully Backed & Solvent</div>
              </div>

              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c]">
                <div className="text-[11px] text-gray-400">Total Reserves (On-chain)</div>
                <div className="text-base font-bold text-white font-mono">$4,850,000</div>
                <div className="text-[10px] text-gray-500">Multisig Cold + Hot Tiers</div>
              </div>

              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c]">
                <div className="text-[11px] text-gray-400">Customer Liabilities</div>
                <div className="text-base font-bold text-white font-mono">$4,470,000</div>
                <div className="text-[10px] text-gray-500">Aggregated via Ledger</div>
              </div>
            </div>

            <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#1e2329] font-mono text-xs mb-4">
              <div className="text-gray-400 text-[10px] mb-1">PUBLISHED MERKLE ROOT LIABILITIES HASH:</div>
              <div className="text-yellow-400 break-all select-all">{solvencyStatus.rootHash}</div>
            </div>

            <div className="bg-[#181d27] p-4 rounded-lg border border-[#252c3c] mb-4">
              <div className="text-xs font-bold text-white mb-2">Audit Your Account Balance Inclusion:</div>
              <div className="text-[11px] text-gray-400 mb-3">
                Verify your account leaves in the Merkle Sum Tree without revealing balances to third parties.
              </div>

              {proofVerificationStatus === 'idle' && (
                <button
                  onClick={handleVerifyProof}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition cursor-pointer"
                >
                  Verify My Account Inclusion Cryptographically
                </button>
              )}

              {proofVerificationStatus === 'validating' && (
                <div className="flex items-center space-x-2 text-yellow-400 text-xs font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Traversing Merkle Path to Root...</span>
                </div>
              )}

              {proofVerificationStatus === 'verified' && (
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono bg-emerald-950/40 p-2.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>
                    VERIFIED: Your account leaf is cryptographically bound into Root Hash. Solvency confirmed.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowPoRModal(false)}
                className="px-4 py-1.5 bg-[#2b313a] text-gray-200 text-xs font-semibold rounded hover:bg-[#38414e]"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Chain Custody & Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-[#2b313a] rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222836] pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Wallet className="w-6 h-6 text-yellow-400" />
                <h2 className="text-lg font-bold text-white">Multi-Chain Custody Gateway</h2>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Blockchain Deposit Network:</label>
                <div className="grid grid-cols-4 gap-2">
                  {['TON (Gram)', 'Ethereum (EVM)', 'Solana', 'Bitcoin'].map((net, i) => (
                    <button
                      key={net}
                      className={`p-2 rounded text-xs font-semibold text-center border ${
                        i === 0
                          ? 'bg-[#1e2638] text-blue-400 border-blue-500'
                          : 'bg-[#181d27] text-gray-400 border-[#252c3c]'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#1e2329]">
                <div className="text-[10px] text-gray-400 mb-1">YOUR DEDICATED TON / GRAM DEPOSIT ADDRESS:</div>
                <div className="font-mono text-xs text-white break-all select-all flex justify-between items-center">
                  <span>EQD4FPq-n7Ek_q1hW...UQAJO_hgYMZq3ULuzFv7927z</span>
                  <Copy className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white ml-2 flex-shrink-0" />
                </div>
              </div>

              <div className="p-3 bg-[#181d27] rounded-lg border border-[#252c3c] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Simulate Live On-Chain Deposit</div>
                  <div className="text-[11px] text-gray-400">Credit test assets instantly into matching engine</div>
                </div>
                <button
                  onClick={() => {
                    setBalances(prev => ({
                      ...prev,
                      TON: { ...prev.TON, available: prev.TON.available + 1000 },
                      USDT: { ...prev.USDT, available: prev.USDT.available + 5000 }
                    }));
                    alert('Successfully simulated deposit of +1,000 TON and +5,000 USDT!');
                  }}
                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded cursor-pointer"
                >
                  Deposit +1,000 TON
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDepositModal(false)}
                className="px-4 py-1.5 bg-[#2b313a] text-gray-200 text-xs font-semibold rounded hover:bg-[#38414e]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Automation Modal */}
      {showBotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-[#2b313a] rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222836] pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Bot className="w-6 h-6 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Automated Trading & Market Making Bots</h2>
              </div>
              <button
                onClick={() => setShowBotModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[#181d27] rounded-lg border border-[#252c3c] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Autonomous Market Maker (AMM)</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        mmBotActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {mmBotActive ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Quotes tight bid-ask spreads (0.3%) with continuous liquidity depth across 10 price levels.
                  </div>
                </div>
                <button
                  onClick={() => setMmBotActive(!mmBotActive)}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                    mmBotActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {mmBotActive ? 'Pause MM' : 'Start MM'}
                </button>
              </div>

              <div className="p-4 bg-[#181d27] rounded-lg border border-[#252c3c] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Grid Trading Bot (TON Range $5.50 - $7.50)</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        gridBotActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {gridBotActive ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Places automated ladders of limit orders to capture profit from market volatility.
                  </div>
                </div>
                <button
                  onClick={() => setGridBotActive(!gridBotActive)}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                    gridBotActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {gridBotActive ? 'Stop Grid' : 'Deploy Grid'}
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowBotModal(false)}
                className="px-4 py-1.5 bg-[#2b313a] text-gray-200 text-xs font-semibold rounded hover:bg-[#38414e]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
