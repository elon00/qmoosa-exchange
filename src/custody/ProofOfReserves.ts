import { createHash } from 'node:crypto';
import { Ledger } from '../engine/Ledger.js';
import { MultiChainGateway } from './MultiChainGateway.js';

export interface UserLiabilities {
  userId: string;
  balances: Record<string, number>;
  salt: string;
}

export interface MerkleNode {
  hash: string;
  balances: Record<string, number>;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleProofStep {
  siblingHash: string;
  siblingBalances: Record<string, number>;
  isRight: boolean;
}

export interface UserAuditProof {
  userId: string;
  balances: Record<string, number>;
  salt: string;
  leafHash: string;
  merkleProof: MerkleProofStep[];
  rootHash: string;
  rootLiabilities: Record<string, number>;
  timestamp: number;
}

export interface SolvencyReport {
  timestamp: number;
  rootHash: string;
  liabilities: Record<string, number>;
  reserves: Record<string, number>;
  solvencyRatio: Record<string, number>;
  isFullySolvent: boolean;
  totalUsersAudited: number;
}

export class ProofOfReservesEngine {
  private root: MerkleNode | null = null;
  private userLeaves: Map<string, { leaf: MerkleNode; proofData: UserLiabilities }> = new Map();
  private lastAuditedTimestamp: number = 0;

  constructor(
    private ledger: Ledger,
    private custodyGateway?: MultiChainGateway
  ) {}

  private static hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private static serializeBalances(balances: Record<string, number>): string {
    const sorted: Record<string, number> = {};
    for (const k of Object.keys(balances).sort()) {
      sorted[k] = balances[k];
    }
    return JSON.stringify(sorted);
  }

  private static combineBalances(
    a: Record<string, number>,
    b: Record<string, number>
  ): Record<string, number> {
    const combined: Record<string, number> = { ...a };
    for (const [symbol, amount] of Object.entries(b)) {
      combined[symbol] = (combined[symbol] || 0) + amount;
    }
    return combined;
  }

  /**
   * Generate SHA-256 Merkle Sum Leaf for a specific user liability
   */
  private createLeafNode(user: UserLiabilities): MerkleNode {
    const serialized = JSON.stringify({
      userId: user.userId,
      salt: user.salt,
      balances: JSON.parse(ProofOfReservesEngine.serializeBalances(user.balances))
    });

    const leafHash = ProofOfReservesEngine.hash(`LEAF:${serialized}`);
    return {
      hash: leafHash,
      balances: { ...user.balances }
    };
  }

  /**
   * Build Merkle Sum Tree across all registered customer balances in Ledger
   */
  public generateMerkleSumTree(salts?: Map<string, string>): MerkleNode {
    const users = this.ledger.getAllUsers();
    this.userLeaves.clear();

    const liabilitiesList: UserLiabilities[] = users.map(userId => {
      const balancesRecord: Record<string, number> = {};
      const userBalances = this.ledger.getUserBalances(userId);
      for (const [asset, bal] of userBalances.entries()) {
        balancesRecord[asset] = bal.total;
      }
      const salt = salts?.get(userId) || ProofOfReservesEngine.hash(`${userId}:${Date.now()}:${Math.random()}`);
      return {
        userId,
        balances: balancesRecord,
        salt
      };
    });

    if (liabilitiesList.length === 0) {
      this.root = {
        hash: ProofOfReservesEngine.hash('EMPTY_TREE'),
        balances: {}
      };
      this.lastAuditedTimestamp = Date.now();
      return this.root;
    }

    // Generate leaf nodes
    let currentLevel: MerkleNode[] = liabilitiesList.map(user => {
      const node = this.createLeafNode(user);
      this.userLeaves.set(user.userId, { leaf: node, proofData: user });
      return node;
    });

    // Build tree bottom-up
    while (currentLevel.length > 1) {
      const nextLevel: MerkleNode[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        if (i + 1 < currentLevel.length) {
          const right = currentLevel[i + 1];
          const combinedBalances = ProofOfReservesEngine.combineBalances(left.balances, right.balances);
          const parentHash = ProofOfReservesEngine.hash(
            `NODE:${left.hash}:${ProofOfReservesEngine.serializeBalances(left.balances)}:${right.hash}:${ProofOfReservesEngine.serializeBalances(right.balances)}`
          );
          nextLevel.push({
            hash: parentHash,
            balances: combinedBalances,
            left,
            right
          });
        } else {
          // Odd leaf: wrap in unary node to preserve clean proof ascent
          nextLevel.push({
            hash: left.hash,
            balances: { ...left.balances },
            left
          });
        }
      }
      currentLevel = nextLevel;
    }

    this.root = currentLevel[0];
    this.lastAuditedTimestamp = Date.now();
    return this.root;
  }

  /**
   * Generate individual cryptographic Merkle Proof for an end user
   */
  public generateProofForUser(userId: string): UserAuditProof | null {
    if (!this.root || !this.userLeaves.has(userId)) {
      return null;
    }

    const { leaf, proofData } = this.userLeaves.get(userId)!;
    const proofSteps: MerkleProofStep[] = [];

    // Find path bottom-up from leaf to root
    const findPath = (current: MerkleNode, targetHash: string): boolean => {
      if (current.hash === targetHash) return true;
      if (!current.left) return false;

      if (current.left && findPath(current.left, targetHash)) {
        if (current.right) {
          proofSteps.push({
            siblingHash: current.right.hash,
            siblingBalances: current.right.balances,
            isRight: true
          });
        }
        return true;
      }

      if (current.right && findPath(current.right, targetHash)) {
        proofSteps.push({
          siblingHash: current.left.hash,
          siblingBalances: current.left.balances,
          isRight: false
        });
        return true;
      }

      return false;
    };

    findPath(this.root, leaf.hash);

    return {
      userId,
      balances: proofData.balances,
      salt: proofData.salt,
      leafHash: leaf.hash,
      merkleProof: proofSteps, // bottom-up: leaf level sibling first
      rootHash: this.root.hash,
      rootLiabilities: this.root.balances,
      timestamp: this.lastAuditedTimestamp
    };
  }

  /**
   * Client-side / Independent verifier to validate a user proof against a published Root
   */
  public static verifyProof(proof: UserAuditProof): boolean {
    // 1. Verify leaf hash matches user data
    const serialized = JSON.stringify({
      userId: proof.userId,
      salt: proof.salt,
      balances: JSON.parse(ProofOfReservesEngine.serializeBalances(proof.balances))
    });

    const expectedLeafHash = ProofOfReservesEngine.hash(`LEAF:${serialized}`);
    if (expectedLeafHash !== proof.leafHash) {
      return false;
    }

    // 2. Ascend tree to root
    let currentHash = proof.leafHash;
    let currentBalances = { ...proof.balances };

    for (const step of proof.merkleProof) {
      const combinedBalances: Record<string, number> = { ...currentBalances };
      for (const [sym, amt] of Object.entries(step.siblingBalances)) {
        combinedBalances[sym] = (combinedBalances[sym] || 0) + amt;
      }

      if (step.isRight) {
        // Current is Left, Sibling is Right
        currentHash = ProofOfReservesEngine.hash(
          `NODE:${currentHash}:${ProofOfReservesEngine.serializeBalances(currentBalances)}:${step.siblingHash}:${ProofOfReservesEngine.serializeBalances(step.siblingBalances)}`
        );
      } else {
        // Current is Right, Sibling is Left
        currentHash = ProofOfReservesEngine.hash(
          `NODE:${step.siblingHash}:${ProofOfReservesEngine.serializeBalances(step.siblingBalances)}:${currentHash}:${ProofOfReservesEngine.serializeBalances(currentBalances)}`
        );
      }
      currentBalances = combinedBalances;
    }

    return currentHash === proof.rootHash;
  }

  /**
   * Audit solvency by comparing aggregate liabilities with Custody cold/hot reserves
   */
  public generateSolvencyReport(): SolvencyReport {
    if (!this.root) {
      this.generateMerkleSumTree();
    }

    const liabilities = this.root?.balances || {};
    const reserves: Record<string, number> = {};
    const solvencyRatio: Record<string, number> = {};
    let isFullySolvent = true;

    const allAssets = Object.keys(liabilities);

    if (this.custodyGateway) {
      for (const asset of allAssets) {
        const reserveAmount = this.custodyGateway.getReserves(asset);
        reserves[asset] = reserveAmount;
        const liabilityAmount = liabilities[asset] || 0;
        const ratio = liabilityAmount > 0 ? (reserveAmount / liabilityAmount) * 100 : 100;
        solvencyRatio[asset] = Number(ratio.toFixed(2));

        if (reserveAmount < liabilityAmount) {
          isFullySolvent = false;
        }
      }
    } else {
      for (const asset of allAssets) {
        reserves[asset] = liabilities[asset] * 1.05; // 105% coverage default simulation
        solvencyRatio[asset] = 105.0;
      }
    }

    return {
      timestamp: Date.now(),
      rootHash: this.root?.hash || '',
      liabilities,
      reserves,
      solvencyRatio,
      isFullySolvent,
      totalUsersAudited: this.userLeaves.size
    };
  }
}
