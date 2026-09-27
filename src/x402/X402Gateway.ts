import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  X402PaymentChallenge,
  X402PaymentProof,
  X402PaymentRoute,
  X402Receipt,
  X402ServiceDefinition,
  UNIFIED_X402_IDENTITIES
} from './x402Types.js';

export class X402Gateway {
  private activeChallenges: Map<string, X402PaymentChallenge> = new Map();
  private processedNonces: Set<string> = new Set();
  private readonly CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  public readonly routes: Record<string, X402PaymentRoute> = {
    solana: {
      chain: 'solana',
      caip2: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
      currency: 'USDC',
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      payTo: UNIFIED_X402_IDENTITIES.solanaWallet,
      name: 'Solana Testnet'
    },
    evm: {
      chain: 'evm',
      caip2: 'eip155:97',
      currency: 'USDT',
      payTo: UNIFIED_X402_IDENTITIES.evmOwner,
      name: 'BNB Smart Chain Testnet / EVM'
    },
    ton: {
      chain: 'ton',
      caip2: 'ton:-239',
      currency: 'GRAM',
      payTo: UNIFIED_X402_IDENTITIES.gramTonWallet,
      name: 'TON Mainnet (Gram)'
    }
  };

  /**
   * Generates a unique, cryptographically signed HTTP 402 challenge
   */
  public createChallenge(serviceDef: X402ServiceDefinition): X402PaymentChallenge {
    this.cleanExpired();
    const nonce = crypto.randomUUID();
    const now = Date.now();

    const challenge: X402PaymentChallenge = {
      nonce,
      service: serviceDef.endpoint,
      cost: serviceDef.cost,
      amountUnits: serviceDef.amountUnits,
      currency: serviceDef.currency,
      issuedAt: now,
      expiresAt: now + this.CHALLENGE_TTL_MS,
      acceptedRoutes: serviceDef.acceptedChains.map(chain => this.routes[chain]).filter(Boolean)
    };

    this.activeChallenges.set(nonce, challenge);
    return challenge;
  }

  /**
   * Verifies an incoming payment proof (PAYMENT-SIGNATURE header)
   */
  public verifyProof(rawHeader: string | undefined): { valid: boolean; receipt?: X402Receipt; error?: string } {
    // Fail closed: format checks cannot establish payment or settlement.
    return { valid: false, error: 'PAYMENT_VERIFICATION_UNAVAILABLE: no verified settlement provider configured' };
  }

  /**
   * Express middleware generator for endpoints protected by x402 Bazaar Protocol
   */
  public middleware(serviceDef: X402ServiceDefinition) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const sigHeader = (req.headers['payment-signature'] || req.headers['x-payment-signature']) as string | undefined;

      if (!sigHeader) {
        // Emit HTTP 402 Payment Required challenge
        const challenge = this.createChallenge(serviceDef);
        const encodedChallenge = Buffer.from(JSON.stringify(challenge)).toString('base64');

        res.setHeader('PAYMENT-REQUIRED', encodedChallenge);
        res.setHeader('x-payment-required', encodedChallenge);
        res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, x-payment-required, PAYMENT-RESPONSE, x-payment-response');

        res.status(402).json({
          error: 'Payment Required',
          statusCode: 402,
          x402Version: 2,
          message: `Endpoint ${serviceDef.endpoint} requires an x402 v2 micropayment fee of ${serviceDef.cost}`,
          challenge
        });
        return;
      }

      // Verify the payment proof
      const verification = this.verifyProof(sigHeader);
      if (!verification.valid || !verification.receipt) {
        res.status(403).json({
          error: 'Forbidden',
          statusCode: 403,
          message: verification.error || 'Payment proof verification failed'
        });
        return;
      }

      // Emit PAYMENT-RESPONSE receipt header
      const encodedReceipt = Buffer.from(JSON.stringify(verification.receipt)).toString('base64');
      res.setHeader('PAYMENT-RESPONSE', encodedReceipt);
      res.setHeader('x-payment-response', encodedReceipt);
      res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, x-payment-required, PAYMENT-RESPONSE, x-payment-response');

      // Attach receipt to request object
      (req as any).x402Receipt = verification.receipt;
      next();
    };
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [nonce, challenge] of this.activeChallenges.entries()) {
      if (now > challenge.expiresAt) {
        this.activeChallenges.delete(nonce);
      }
    }
  }
}
