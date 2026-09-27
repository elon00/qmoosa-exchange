import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PqcEngine, PQC_CONSTANTS } from '../src/pqc/PqcEngine.js';

describe('NIST Post-Quantum Cryptography (PQC) Suite — FIPS 203 & FIPS 204', () => {
  const pqc = new PqcEngine();

  it('should generate valid NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65) key bundles', () => {
    const keys = pqc.getKeyBundle();

    assert.strictEqual(keys.kemPublicKey.length, PQC_CONSTANTS.ML_KEM_768_PUBLIC_KEY_BYTES);
    assert.strictEqual(keys.kemSecretKey.length, PQC_CONSTANTS.ML_KEM_768_SECRET_KEY_BYTES);
    assert.strictEqual(keys.dsaPublicKey.length, PQC_CONSTANTS.ML_DSA_65_PUBLIC_KEY_BYTES);
    assert.strictEqual(keys.dsaSecretKey.length, PQC_CONSTANTS.ML_DSA_65_SECRET_KEY_BYTES);

    assert.ok(keys.dsaPublicKeyHex.length > 3000);
    assert.ok(keys.kemPublicKeyHex.length > 2000);
  });

  it('should sign order payloads and verify ML-DSA-65 lattice digital signatures', () => {
    const orderPayload = JSON.stringify({
      orderId: 'ord_pqc_1001',
      symbol: 'TON-USDT',
      side: 'BUY',
      price: 6.45,
      quantity: 50,
      timestamp: Date.now()
    });

    const sigHex = pqc.signPayload(orderPayload);
    assert.strictEqual(Buffer.from(sigHex, 'hex').length, PQC_CONSTANTS.ML_DSA_65_SIGNATURE_BYTES);

    // Verify signature against authentic payload
    const isValid = pqc.verifySignature(orderPayload, sigHex);
    assert.strictEqual(isValid, true);

    // Reject forged / altered payload
    const alteredPayload = orderPayload.replace('50', '5000000');
    const isAlteredValid = pqc.verifySignature(alteredPayload, sigHex);
    assert.strictEqual(isAlteredValid, false);
  });

  it('should execute ML-KEM-768 key encapsulation and decapsulation to establish quantum-safe secrets', () => {
    const alice = new PqcEngine();
    const bob = new PqcEngine();

    // Bob encapsulates a shared secret for Alice using Alice's public KEM key
    const { cipherTextHex, sharedSecretHex } = bob.encapsulate(alice.getKeyBundle().kemPublicKey);
    assert.strictEqual(Buffer.from(cipherTextHex, 'hex').length, PQC_CONSTANTS.ML_KEM_768_CIPHERTEXT_BYTES);
    assert.strictEqual(Buffer.from(sharedSecretHex, 'hex').length, PQC_CONSTANTS.ML_KEM_768_SHARED_SECRET_BYTES);

    // Alice decapsulates the ciphertext using her private KEM key
    const recoveredSecretHex = alice.decapsulate(cipherTextHex);
    assert.strictEqual(recoveredSecretHex, sharedSecretHex);

    // Both derive identical symmetric session key
    const aliceSessionKey = alice.deriveSessionKey(recoveredSecretHex, 'qmoosa_salt', 'session_pqc');
    const bobSessionKey = bob.deriveSessionKey(sharedSecretHex, 'qmoosa_salt', 'session_pqc');
    assert.strictEqual(aliceSessionKey, bobSessionKey);
  });

  it('should create quantum-protected orders with attached lattice signatures', () => {
    const protectedOrder = pqc.createQuantumShieldedOrder({
      symbol: 'TON-USDT',
      side: 'BUY',
      price: 6.45,
      quantity: 100,
      payer: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7'
    });

    assert.strictEqual(protectedOrder.quantumSafe, true);
    assert.strictEqual(protectedOrder.symbol, 'TON-USDT');
    assert.ok(protectedOrder.pqcSignatureHex.length > 5000);
    assert.ok(protectedOrder.orderHash.length === 64);
  });

  it('should sign and attest Proof of Reserves with quantum-safe lattice signature', () => {
    const report = pqc.signSolvencyReport(
      '0x8f2d9c1b7a4e58f96e4c7d0b3a1f9e2c4a8b7d6e5c4b3a2f1e0d9c8b7a6f5e4d',
      { USDT: 4850000, TON: 750000 },
      { USDT: 4470000, TON: 690000 }
    );

    assert.strictEqual(report.quantumSolvent, true);
    assert.ok(report.standard.includes('ML-DSA-65'));
    assert.ok(report.signatureHex.length > 5000);
  });
});
