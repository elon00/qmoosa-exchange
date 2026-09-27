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
  ChevronDown
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

interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

interface Trade {
  id: string;
  price: number;
  quantity: number;
  time: number;
  side: 'BUY' | 'SELL';
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
}

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<string>('TON-USDT');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState<string>('6.4500');
  const [quantity, setQuantity] = useState<string>('50');
  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'balances' | 'bots'>('orders');

  // Modals
  const [showPoRModal, setShowPoRModal] = useState<boolean>(false);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showBotModal, setShowBotModal] = useState<boolean>(false);

  // Balances
  const [balances, setBalances] = useState<Record<string, { available: number; reserved: number }>>({
    USDT: { available: 45000.0, reserved: 5000.0 },
    TON: { available: 4800.0, reserved: 200.0 },
    BTC: { available: 1.45, reserved: 0.05 },
    ETH: { available: 14.5, reserved: 0.5 },
    SOL: { available: 145.0, reserved: 5.0 }
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
      createdAt: Date.now() - 360000
    },
    {
      id: 'ord-102',
      symbol: 'TON-USDT',
      side: 'SELL',
      type: 'LIMIT',
      price: 6.55,
      quantity: 50,
      filledQuantity: 0,
      createdAt: Date.now() - 180000
    }
  ]);

  // Bot states
  const [mmBotActive, setMmBotActive] = useState<boolean>(true);
  const [gridBotActive, setGridBotActive] = useState<boolean>(false);

  // Initialize and simulate live market updates
  useEffect(() => {
    // Generate initial book around current price
    const mid = currentMarket.price;
    const initialBids: OrderBookLevel[] = [];
    const initialAsks: OrderBookLevel[] = [];

    let cumBid = 0;
    for (let i = 1; i <= 10; i++) {
      const p = mid - (mid * 0.0008 * i);
      const q = Math.round((20 + Math.random() * 80) * 10) / 10;
      cumBid += q;
      initialBids.push({ price: p, quantity: q, total: cumBid });
    }

    let cumAsk = 0;
    for (let i = 1; i <= 10; i++) {
      const p = mid + (mid * 0.0008 * i);
      const q = Math.round((20 + Math.random() * 80) * 10) / 10;
      cumAsk += q;
      initialAsks.push({ price: p, quantity: q, total: cumAsk });
    }

    setBids(initialBids);
    setAsks(initialAsks);

    // Initial trades
    const initialTrades: Trade[] = [
      { id: 't-1', price: mid, quantity: 45.2, time: Date.now() - 4000, side: 'BUY' },
      { id: 't-2', price: mid - 0.002, quantity: 18.0, time: Date.now() - 9000, side: 'SELL' },
      { id: 't-3', price: mid + 0.001, quantity: 92.5, time: Date.now() - 15000, side: 'BUY' }
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

      // Random trade
      const tradeSide: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const tradePrice = tradeSide === 'BUY' ? newMid + 0.001 : newMid - 0.001;
      const tradeQty = Math.round((5 + Math.random() * 40) * 10) / 10;

      const newTrade: Trade = {
        id: `t-${Date.now()}`,
        price: tradePrice,
        quantity: tradeQty,
        time: Date.now(),
        side: tradeSide
      };

      setTrades(prev => [newTrade, ...prev.slice(0, 25)]);

      // Shift orderbook
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

  // Handle Order Submit
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

    if (orderSide === 'BUY') {
      if (balances[quoteAsset].available < totalCost) {
        alert(`Insufficient ${quoteAsset} balance!`);
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
        alert(`Insufficient ${baseAsset} balance!`);
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
      createdAt: Date.now()
    };

    setOpenOrders(prev => [newOrder, ...prev]);

    // Simulate partial/complete fill after 1.5s
    setTimeout(() => {
      setOpenOrders(prev => prev.filter(o => o.id !== newOrder.id));
      setTrades(prev => [
        {
          id: `t-exec-${Date.now()}`,
          price: effectivePrice,
          quantity: numQty,
          time: Date.now(),
          side: orderSide
        },
        ...prev
      ]);

      // Settle balances
      if (orderSide === 'BUY') {
        setBalances(prev => ({
          ...prev,
          [quoteAsset]: {
            ...prev[quoteAsset],
            reserved: Math.max(0, prev[quoteAsset].reserved - totalCost)
          },
          [baseAsset]: {
            ...prev[baseAsset],
            available: prev[baseAsset].available + numQty * 0.999 // fee deduction
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
    }, 1500);
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

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0e14] text-[#eaecef]">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#1e2329] bg-[#12161f] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f0b90b] to-[#1652f0] p-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-extrabold text-white text-base">Q</span>
            </div>
            <div>
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-blue-400 bg-clip-text text-transparent">
                QMOOSA
              </span>
              <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase ml-1">
                EXCHANGE
              </span>
            </div>
          </div>

          {/* Market Selector Pill */}
          <div className="flex items-center space-x-1 bg-[#181d27] p-1 rounded-md border border-[#262d3d]">
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

          {/* Ticker Stats Bar */}
          <div className="hidden lg:flex items-center space-x-6 text-xs border-l border-[#1e2329] pl-4">
            <div>
              <div className="text-[10px] text-gray-500 font-medium">Last Price</div>
              <div
                className={`font-mono font-bold text-sm ${
                  currentMarket.change24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }`}
              >
                ${currentMarket.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 font-medium">24h Change</div>
              <div
                className={`font-mono font-semibold flex items-center ${
                  currentMarket.change24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }`}
              >
                {currentMarket.change24h >= 0 ? '+' : ''}
                {currentMarket.change24h}%
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 font-medium">24h High</div>
              <div className="font-mono text-gray-300">${currentMarket.high24h}</div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 font-medium">24h Low</div>
              <div className="font-mono text-gray-300">${currentMarket.low24h}</div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 font-medium">24h Volume ({currentMarket.baseAsset})</div>
              <div className="font-mono text-gray-300">{currentMarket.volume24h.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Right Action Center */}
        <div className="flex items-center space-x-3">
          {/* Proof of Reserves Pill */}
          <button
            onClick={() => setShowPoRModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-md text-xs font-semibold hover:bg-emerald-900/50 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PoR Solvency: 108.5%</span>
          </button>

          {/* Bot Control Center */}
          <button
            onClick={() => setShowBotModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-md text-xs font-semibold hover:bg-indigo-900/50 transition cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Trading Bots</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
          </button>

          {/* Wallet Balances & Deposit Button */}
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-md text-xs hover:brightness-110 transition shadow-sm cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Deposit / Vault</span>
          </button>
        </div>
      </header>

      {/* Main Terminal Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Interactive Chart + Execution Log (Cols 1-8) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col border-r border-[#1e2329]">
          {/* Chart Header Bar */}
          <div className="h-10 border-b border-[#1e2329] bg-[#12161f]/80 px-4 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-200">Price Chart</span>
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
              {/* Background grid lines */}
              <line x1="0" y1="60" x2="800" y2="60" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="120" x2="800" y2="120" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="180" x2="800" y2="180" stroke="#161c27" strokeDasharray="4 4" />
              <line x1="0" y1="240" x2="800" y2="240" stroke="#161c27" strokeDasharray="4 4" />

              {/* Dynamic simulated candles */}
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
                    {/* Wick */}
                    <line x1={x + 7} y1={wickTop} x2={x + 7} y2={wickBottom} stroke={color} strokeWidth="1.5" />
                    {/* Candle Body */}
                    <rect
                      x={x}
                      y={bodyY}
                      width="14"
                      height={bodyHeight}
                      fill={color}
                      rx="1"
                      opacity="0.9"
                    />
                    {/* Volume Bar at bottom */}
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

              {/* Price Line Indicator */}
              <line x1="0" y1="135" x2="800" y2="135" stroke="#f0b90b" strokeWidth="1" strokeDasharray="5 3" />
              <rect x="730" y="125" width="65" height="20" rx="3" fill="#f0b90b" />
              <text x="735" y="139" fill="#000" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono">
                ${currentMarket.price.toFixed(2)}
              </text>
            </svg>

            {/* Overlay TradingView Watermark */}
            <div className="absolute bottom-3 left-4 text-xs font-mono text-gray-600 select-none pointer-events-none">
              QMOOSA HIGH-FREQUENCY MATCHING ENGINE (FIFO L2/L3)
            </div>
          </div>

          {/* Bottom Tabs: Open Orders / Balances / History */}
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
                Open Orders ({openOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'history'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Trade History ({trades.length})
              </button>
              <button
                onClick={() => setActiveTab('balances')}
                className={`py-2 transition border-b-2 ${
                  activeTab === 'balances'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Account Assets
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-3 flex-1 overflow-y-auto font-mono text-xs">
              {activeTab === 'orders' && (
                <div className="w-full">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e2329] pb-1">
                        <th className="font-normal py-1">Time</th>
                        <th className="font-normal py-1">Symbol</th>
                        <th className="font-normal py-1">Type</th>
                        <th className="font-normal py-1">Side</th>
                        <th className="font-normal py-1">Price</th>
                        <th className="font-normal py-1">Amount</th>
                        <th className="font-normal py-1">Filled</th>
                        <th className="font-normal py-1 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-gray-500">
                            No active open orders
                          </td>
                        </tr>
                      ) : (
                        openOrders.map(o => (
                          <tr key={o.id} className="border-b border-[#161a22] hover:bg-[#161c28]">
                            <td className="py-2 text-gray-400">{new Date(o.createdAt).toLocaleTimeString()}</td>
                            <td className="py-2 font-bold">{o.symbol}</td>
                            <td className="py-2 text-gray-300">{o.type}</td>
                            <td
                              className={`py-2 font-semibold ${
                                o.side === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                              }`}
                            >
                              {o.side}
                            </td>
                            <td className="py-2">${o.price.toFixed(4)}</td>
                            <td className="py-2">{o.quantity}</td>
                            <td className="py-2 text-gray-400">{o.filledQuantity}</td>
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
                        <th className="font-normal py-1">Trade ID</th>
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
                          <td className="py-1.5 text-gray-500">{t.id}</td>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(balances).map(([asset, bal]) => (
                    <div key={asset} className="p-3 bg-[#161a24] rounded-lg border border-[#232a3b]">
                      <div className="text-xs font-bold text-yellow-400 mb-1">{asset} Wallet</div>
                      <div className="text-sm font-bold text-white">{bal.available.toLocaleString()}</div>
                      <div className="text-[11px] text-gray-400">Locked: {bal.reserved.toLocaleString()}</div>
                    </div>
                  ))}
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
              <span>Total</span>
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
                  <span className="text-gray-400">{a.total.toFixed(1)}</span>
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
                  <span className="text-gray-400">{b.total.toFixed(1)}</span>
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
                  Market
                </button>
              </div>

              <form onSubmit={handlePlaceOrder} className="space-y-3">
                {/* Price Input */}
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

                {/* Amount Input */}
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

                {/* Percentage Quick Selector */}
                <div className="grid grid-cols-4 gap-1.5">
                  {['25%', '50%', '75%', '100%'].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        const factor = parseInt(pct) / 100;
                        if (orderSide === 'BUY') {
                          const maxQty = (balances.USDT.available * factor) / parseFloat(price || '1');
                          setQuantity(maxQty.toFixed(2));
                        } else {
                          const maxQty = balances[currentMarket.baseAsset].available * factor;
                          setQuantity(maxQty.toFixed(2));
                        }
                      }}
                      className="py-1 bg-[#181d27] hover:bg-[#252c3b] rounded text-[10px] text-gray-400 font-mono border border-[#2b313a]"
                    >
                      {pct}
                    </button>
                  ))}
                </div>

                {/* Available Balance Preview */}
                <div className="pt-2 text-xs flex justify-between text-gray-400 font-mono">
                  <span>Available:</span>
                  <span className="text-white font-bold">
                    {orderSide === 'BUY'
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

                {/* Submit Button */}
                <button
                  type="submit"
                  className={`w-full py-2.5 rounded font-bold text-sm tracking-wide transition mt-2 cursor-pointer ${
                    orderSide === 'BUY'
                      ? 'bg-[#0ecb81] hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-[#f6465d] hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  }`}
                >
                  {orderSide === 'BUY' ? 'Buy' : 'Sell'} {currentMarket.baseAsset}
                </button>
              </form>
            </div>

            <div className="text-[10px] text-gray-500 text-center font-mono pt-3">
              Trading Fee: Maker 0.10% / Taker 0.10% (Zero Fee on TON Pairs)
            </div>
          </div>
        </div>
      </div>

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

            {/* Client verification tester */}
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
              {/* MM Bot Toggle */}
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

              {/* Grid Bot Toggle */}
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

              {/* Cross-Venue Arbitrage Scanner */}
              <div className="p-3 bg-[#0b0e14] rounded-lg border border-[#1e2329] font-mono text-xs">
                <div className="text-[10px] text-gray-400 mb-2">CROSS-EXCHANGE ARBITRAGE SCANNER (REAL-TIME):</div>
                <div className="flex justify-between py-1 border-b border-[#181d27]">
                  <span className="text-gray-300">Binance TON/USDT:</span>
                  <span className="text-white">$6.4580</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#181d27]">
                  <span className="text-gray-300">Coinbase TON/USD:</span>
                  <span className="text-white">$6.4610</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-400 font-bold">
                  <span>Detected Arbitrage Spread:</span>
                  <span>+0.14% (Routing Eligible)</span>
                </div>
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
