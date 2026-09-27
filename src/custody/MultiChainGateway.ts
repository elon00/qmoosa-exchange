import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export type SupportedChain = 'TON' | 'EVM' | 'SOLANA' | 'ALGORAND' | 'BITCOIN';

export interface ChainConfig {
  chain: SupportedChain;
  name: string;
  nativeAsset: string;
  confirmationsRequired: number;
  hotWalletAddress: string;
  coldWalletAddress: string;
  explorerUrl: string;
}

export interface DepositRecord {
  id: string;
  userId: string;
  chain: SupportedChain;
  asset: string;
  amount: number;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  confirmations: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  timestamp: number;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  chain: SupportedChain;
  asset: string;
  amount: number;
  toAddress: string;
  txHash: string;
  status: 'CONFIRMED';
  timestamp: number;
}

export class MultiChainGateway {
  private configs: Map<SupportedChain, ChainConfig> = new Map();
  private userDepositAddresses: Map<string, Map<SupportedChain, string>> = new Map(); // userId -> chain -> address
  private depositLedger: DepositRecord[] = [];
  private withdrawalLedger: WithdrawalRecord[] = [];
  private hotWalletBalances: Map<string, number> = new Map();
  private coldStorageBalances: Map<string, number> = new Map();

  constructor() {
    this.initDefaultChains();
  }

  private initDefaultChains(): void {
    this.configs.set('TON', {
      chain: 'TON',
      name: 'The Open Network',
      nativeAsset: 'TON',
      confirmationsRequired: 1,
      hotWalletAddress: 'EQCrjfyr3T4GnH5MEFNHHEGOwRm3nXVqhqHHhqlnGYOESKyh',
      coldWalletAddress: 'UQAJO_hgYMZq3ULuzFv7927z-WgsM0BApc0IRniDrHORTzm3',
      explorerUrl: 'https://tonviewer.com/',
    });

    this.configs.set('EVM', {
      chain: 'EVM',
      name: 'Ethereum & Arbitrum L2',
      nativeAsset: 'ETH',
      confirmationsRequired: 12,
      hotWalletAddress: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      coldWalletAddress: '0x71C8360f3a8b273b458A3F2d790dC3e45995C72d',
      explorerUrl: 'https://etherscan.io/tx/',
    });

    this.configs.set('SOLANA', {
      chain: 'SOLANA',
      name: 'Solana High Speed',
      nativeAsset: 'SOL',
      confirmationsRequired: 32,
      hotWalletAddress: 'BPshPrMazV7qunhcq18AvCHjSceHbKytiRDNrtCv68g3',
      coldWalletAddress: '7XqB45QvY9R1f3Lp7K8M9N0O1P2Q3R4S5T6U7V8W9X0Y',
      explorerUrl: 'https://solscan.io/tx/',
    });

    this.configs.set('ALGORAND', {
      chain: 'ALGORAND',
      name: 'Algorand Post-Quantum & x402',
      nativeAsset: 'ALGO',
      confirmationsRequired: 1,
      hotWalletAddress: 'TPLMGGFNG64LKOCKVB7ZMQH5AMSNMV4GLI7GCH4FY2XQEKSIGB77O6LCFM',
      coldWalletAddress: 'ALGO_COLD_VAULT_RESERVE_STORAGE_ACCOUNT',
      explorerUrl: 'https://allo.info/tx/',
    });

    this.configs.set('BITCOIN', {
      chain: 'BITCOIN',
      name: 'Bitcoin SegWit',
      nativeAsset: 'BTC',
      confirmationsRequired: 2,
      hotWalletAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      coldWalletAddress: 'bc1qcoldvaultproofofreservesprimarystorage',
      explorerUrl: 'https://mempool.space/tx/',
    });
  }

  public recordHotWalletBalance(asset: string, amount: number): void {
    this.hotWalletBalances.set(asset.toUpperCase(), amount);
  }

  public recordColdStorageBalance(asset: string, amount: number): void {
    this.coldStorageBalances.set(asset.toUpperCase(), amount);
  }

  public getReserves(asset: string): number {
    const hot = this.hotWalletBalances.get(asset.toUpperCase()) || 0;
    const cold = this.coldStorageBalances.get(asset.toUpperCase()) || 0;
    return hot + cold;
  }

  public getAllReserves(): Record<string, { hot: number; cold: number; total: number }> {
    const allAssets = new Set([...this.hotWalletBalances.keys(), ...this.coldStorageBalances.keys()]);
    const summary: Record<string, { hot: number; cold: number; total: number }> = {};
    for (const asset of allAssets) {
      const hot = this.hotWalletBalances.get(asset) || 0;
      const cold = this.coldStorageBalances.get(asset) || 0;
      summary[asset] = { hot, cold, total: hot + cold };
    }
    return summary;
  }

  public getDepositAddress(userId: string, chain: SupportedChain): string {
    let userMap = this.userDepositAddresses.get(userId);
    if (!userMap) {
      userMap = new Map();
      this.userDepositAddresses.set(userId, userMap);
    }

    let addr = userMap.get(chain);
    if (!addr) {
      // Deterministically derive unique user deposit address using hash of (userId + chain)
      const seed = new TextEncoder().encode(`qmoosa_${chain}_${userId}`);
      const hash = bytesToHex(sha256(seed));

      if (chain === 'EVM') {
        addr = `0x${hash.slice(0, 40)}`;
      } else if (chain === 'TON') {
        addr = `EQ${hash.slice(0, 46)}`;
      } else if (chain === 'BITCOIN') {
        addr = `bc1q${hash.slice(0, 38)}`;
      } else if (chain === 'SOLANA') {
        addr = `${hash.slice(0, 44)}`;
      } else {
        addr = `${hash.slice(0, 58).toUpperCase()}`;
      }
      userMap.set(chain, addr);
    }

    return addr;
  }

  public simulateDeposit(
    paramOrChain:
      | {
          userId: string;
          chain: SupportedChain;
          asset: string;
          amount: number;
          fromAddress?: string;
        }
      | SupportedChain,
    assetArg?: string,
    amountArg?: number,
    userIdArg?: string
  ): DepositRecord {
    let userId: string;
    let chain: SupportedChain;
    let asset: string;
    let amount: number;
    let fromAddress: string;

    if (typeof paramOrChain === 'object') {
      userId = paramOrChain.userId;
      chain = paramOrChain.chain;
      asset = paramOrChain.asset;
      amount = paramOrChain.amount;
      fromAddress = paramOrChain.fromAddress || '0x_external_sender_wallet';
    } else {
      chain = paramOrChain;
      asset = assetArg!;
      amount = amountArg!;
      userId = userIdArg || 'user_trader1';
      fromAddress = '0x_external_sender_wallet';
    }

    const toAddress = this.getDepositAddress(userId, chain);
    const txHash = bytesToHex(sha256(new TextEncoder().encode(`tx_${Date.now()}_${Math.random()}`)));
    const config = this.configs.get(chain) || { confirmationsRequired: 1 };

    const record: DepositRecord = {
      id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      chain,
      asset,
      amount,
      fromAddress,
      toAddress,
      txHash,
      confirmations: config.confirmationsRequired,
      status: 'CONFIRMED',
      timestamp: Date.now(),
    };

    this.depositLedger.push(record);

    // Increase hot wallet reserves
    const currentHot = this.hotWalletBalances.get(asset.toUpperCase()) || 0;
    this.hotWalletBalances.set(asset.toUpperCase(), currentHot + amount);

    return record;
  }

  public recordWithdrawal(
    chain: SupportedChain,
    asset: string,
    amount: number,
    toAddress: string,
    userId: string
  ): WithdrawalRecord {
    const txHash = bytesToHex(sha256(new TextEncoder().encode(`tx_withdraw_${Date.now()}_${Math.random()}`)));
    const record: WithdrawalRecord = {
      id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      chain,
      asset,
      amount,
      toAddress,
      txHash,
      status: 'CONFIRMED',
      timestamp: Date.now()
    };
    this.withdrawalLedger.push(record);

    const currentHot = this.hotWalletBalances.get(asset.toUpperCase()) || 0;
    this.hotWalletBalances.set(asset.toUpperCase(), Math.max(0, currentHot - amount));

    return record;
  }

  public getChainConfigs(): ChainConfig[] {
    return Array.from(this.configs.values());
  }

  public getUserDeposits(userId: string): DepositRecord[] {
    return this.depositLedger.filter(d => d.userId === userId);
  }
}
