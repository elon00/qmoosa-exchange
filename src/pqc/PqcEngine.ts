/**
 * Qmoosa Exchange — NIST Post-Quantum Cryptographic Engine
 * Implements:
 * - NIST FIPS 203: ML-KEM-768 (Module-Lattice Key Encapsulation Mechanism)
 * - NIST FIPS 204: ML-DSA-65 (Module-Lattice Digital Signature Algorithm)
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

export const PQC_CONSTANTS = Object.freeze({
  ML_KEM_768_PUBLIC_KEY_BYTES: 1184,
  ML_KEM_768_SECRET_KEY_BYTES: 2400,
  ML_KEM_768_CIPHERTEXT_BYTES: 1088,
  ML_KEM_768_SHARED_SECRET_BYTES: 32,
  ML_DSA_65_PUBLIC_KEY_BYTES: 1952,
  ML_DSA_65_SECRET_KEY_BYTES: 4032,
  ML_DSA_65_SIGNATURE_BYTES: 3309,
});

export interface PqcKeyBundle {
  dsaPublicKey: Uint8Array;
  dsaSecretKey: Uint8Array;
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  dsaPublicKeyHex: string;
  kemPublicKeyHex: string;
}

export interface QuantumProtectedOrder {
  orderHash: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  payer: string;
  timestamp: number;
  pqcSignatureHex: string;
  dsaPublicKeyHex: string;
  quantumSafe: boolean;
}

export class PqcEngine {
  private keyBundle: PqcKeyBundle;

  constructor(seed?: Uint8Array) {
    this.keyBundle = this.generateKeypair(seed);
  }

  /**
   * Generates a deterministic or random FIPS 203 & 204 keypair
   */
  public generateKeypair(seed?: Uint8Array): PqcKeyBundle {
    let dsaSeed: Uint8Array | undefined;
    let kemSeed: Uint8Array | undefined;

    if (seed) {
      dsaSeed = sha256(seed); // 32 bytes for ML-DSA-65
      const h1 = sha256(seed);
      const appended = new Uint8Array(seed.length + 1);
      appended.set(seed, 0);
      appended[seed.length] = 0x01;
      const h2 = sha256(appended);
      kemSeed = new Uint8Array(64); // 64 bytes for ML-KEM-768
      kemSeed.set(h1, 0);
      kemSeed.set(h2, 32);
    }

    const dsa = dsaSeed ? ml_dsa65.keygen(dsaSeed) : ml_dsa65.keygen();
    const kem = kemSeed ? ml_kem768.keygen(kemSeed) : ml_kem768.keygen();

    return {
      dsaPublicKey: dsa.publicKey,
      dsaSecretKey: dsa.secretKey,
      kemPublicKey: kem.publicKey,
      kemSecretKey: kem.secretKey,
      dsaPublicKeyHex: Buffer.from(dsa.publicKey).toString('hex'),
      kemPublicKeyHex: Buffer.from(kem.publicKey).toString('hex')
    };
  }

  public getKeyBundle(): PqcKeyBundle {
    return this.keyBundle;
  }

  /**
   * Signs arbitrary order or solvency payload using NIST FIPS 204 ML-DSA-65
   */
  public signPayload(payload: Uint8Array | string, secretKey?: Uint8Array): string {
    const raw = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;
    const key = secretKey || this.keyBundle.dsaSecretKey;
    const signature = ml_dsa65.sign(raw, key);
    return Buffer.from(signature).toString('hex');
  }

  /**
   * Verifies an ML-DSA-65 lattice signature
   */
  public verifySignature(
    payload: Uint8Array | string,
    signatureHex: string,
    publicKey?: Uint8Array
  ): boolean {
    try {
      const raw = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;
      const sigBytes = Buffer.from(signatureHex, 'hex');
      const pubKey = publicKey || this.keyBundle.dsaPublicKey;

      if (sigBytes.length !== PQC_CONSTANTS.ML_DSA_65_SIGNATURE_BYTES) {
        return false;
      }
      if (pubKey.length !== PQC_CONSTANTS.ML_DSA_65_PUBLIC_KEY_BYTES) {
        return false;
      }

      return ml_dsa65.verify(sigBytes, raw, pubKey);
    } catch {
      return false;
    }
  }

  /**
   * Encapsulate a shared secret for quantum-safe peer communication using ML-KEM-768
   */
  public encapsulate(peerKemPubKey: Uint8Array): { cipherTextHex: string; sharedSecretHex: string } {
    if (peerKemPubKey.length !== PQC_CONSTANTS.ML_KEM_768_PUBLIC_KEY_BYTES) {
      throw new Error(`Invalid peer KEM public key length: expected ${PQC_CONSTANTS.ML_KEM_768_PUBLIC_KEY_BYTES}`);
    }
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(peerKemPubKey);
    return {
      cipherTextHex: Buffer.from(cipherText).toString('hex'),
      sharedSecretHex: Buffer.from(sharedSecret).toString('hex')
    };
  }

  /**
   * Decapsulate an ML-KEM-768 ciphertext to recover shared secret
   */
  public decapsulate(cipherTextHex: string, secretKey?: Uint8Array): string {
    const cipherBytes = Buffer.from(cipherTextHex, 'hex');
    if (cipherBytes.length !== PQC_CONSTANTS.ML_KEM_768_CIPHERTEXT_BYTES) {
      throw new Error(`Invalid KEM ciphertext length: expected ${PQC_CONSTANTS.ML_KEM_768_CIPHERTEXT_BYTES}`);
    }
    const key = secretKey || this.keyBundle.kemSecretKey;
    const sharedSecret = ml_kem768.decapsulate(cipherBytes, key);
    return Buffer.from(sharedSecret).toString('hex');
  }

  /**
   * Derives a post-quantum symmetric session key via HKDF-SHA256
   */
  public deriveSessionKey(sharedSecretHex: string, salt: string, info: string): string {
    const secretBytes = Buffer.from(sharedSecretHex, 'hex');
    const saltBytes = Buffer.from(salt, 'utf-8');
    const infoBytes = Buffer.from(info, 'utf-8');
    const derived = hkdf(sha256, secretBytes, saltBytes, infoBytes, 32);
    return Buffer.from(derived).toString('hex');
  }

  /**
   * Attaches a quantum-resistant lattice signature to a trading order
   */
  public createQuantumShieldedOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    payer: string;
  }): QuantumProtectedOrder {
    const timestamp = Date.now();
    const orderPayload = JSON.stringify({
      ...params,
      timestamp,
      pqcSpec: 'NIST-FIPS-204-ML-DSA-65'
    });

    const sigHex = this.signPayload(orderPayload);
    const orderHash = Buffer.from(sha256(Buffer.from(orderPayload))).toString('hex');

    return {
      orderHash,
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      quantity: params.quantity,
      payer: params.payer,
      timestamp,
      pqcSignatureHex: sigHex,
      dsaPublicKeyHex: this.keyBundle.dsaPublicKeyHex,
      quantumSafe: true
    };
  }

  /**
   * Signs Proof of Reserves solvency report with ML-DSA-65
   */
  public signSolvencyReport(rootHash: string, totalReserves: Record<string, number>, liabilities: Record<string, number>) {
    const auditPayload = `SOLVENCY_AUDIT:${rootHash}:${JSON.stringify(totalReserves)}:${JSON.stringify(liabilities)}:${Date.now()}`;
    const signatureHex = this.signPayload(auditPayload);
    return {
      auditPayload,
      rootHash,
      signatureHex,
      publicKeyHex: this.keyBundle.dsaPublicKeyHex,
      standard: 'NIST FIPS 204 (ML-DSA-65 Lattice Verification)',
      quantumSolvent: true
    };
  }
}
