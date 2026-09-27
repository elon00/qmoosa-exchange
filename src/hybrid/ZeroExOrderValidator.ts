import {
  Address,
  Hex,
  hashTypedData,
  recoverTypedDataAddress,
  encodeFunctionData,
  parseAbi
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ZeroExLimitOrder,
  ZeroExSignature,
  ZeroExSignatureType,
  SignedZeroExOrder,
  ZERO_EX_EXCHANGE_PROXY
} from './zeroExTypes.js';

export const ZERO_EX_EIP712_TYPES = {
  LimitOrder: [
    { name: 'makerToken', type: 'address' },
    { name: 'takerToken', type: 'address' },
    { name: 'makerAmount', type: 'uint128' },
    { name: 'takerAmount', type: 'uint128' },
    { name: 'takerTokenFeeAmount', type: 'uint128' },
    { name: 'maker', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'sender', type: 'address' },
    { name: 'feeRecipient', type: 'address' },
    { name: 'pool', type: 'bytes32' },
    { name: 'expiry', type: 'uint64' },
    { name: 'salt', type: 'uint256' }
  ]
} as const;

export const ZERO_EX_EXCHANGE_PROXY_ABI = parseAbi([
  'function fillLimitOrder((address makerToken, address takerToken, uint128 makerAmount, uint128 takerAmount, uint128 takerTokenFeeAmount, address maker, address taker, address sender, address feeRecipient, bytes32 pool, uint64 expiry, uint256 salt) order, (uint8 signatureType, uint8 v, bytes32 r, bytes32 s) signature, uint128 takerTokenFillAmount) external payable returns (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount)',
  'function cancelLimitOrder((address makerToken, address takerToken, uint128 makerAmount, uint128 takerAmount, uint128 takerTokenFeeAmount, address maker, address taker, address sender, address feeRecipient, bytes32 pool, uint64 expiry, uint256 salt) order) external',
  'function getLimitOrderHash((address makerToken, address takerToken, uint128 makerAmount, uint128 takerAmount, uint128 takerTokenFeeAmount, address maker, address taker, address sender, address feeRecipient, bytes32 pool, uint64 expiry, uint256 salt) order) external view returns (bytes32 orderHash)'
]);

export class ZeroExOrderValidator {
  /**
   * Get EIP-712 Domain for 0x Protocol v4
   */
  public static getDomain(chainId: number, exchangeProxyAddress?: Address) {
    const verifyingContract = exchangeProxyAddress || ZERO_EX_EXCHANGE_PROXY[chainId] || ZERO_EX_EXCHANGE_PROXY[1];
    return {
      name: 'ZeroEx',
      version: '1.0.0',
      chainId,
      verifyingContract
    } as const;
  }

  /**
   * Compute standard EIP-712 0x v4 Order Hash
   */
  public static computeOrderHash(order: ZeroExLimitOrder, chainId = 1, exchangeProxyAddress?: Address): Hex {
    const domain = this.getDomain(chainId, exchangeProxyAddress);

    return hashTypedData({
      domain,
      types: ZERO_EX_EIP712_TYPES,
      primaryType: 'LimitOrder',
      message: {
        makerToken: order.makerToken,
        takerToken: order.takerToken,
        makerAmount: BigInt(order.makerAmount),
        takerAmount: BigInt(order.takerAmount),
        takerTokenFeeAmount: BigInt(order.takerTokenFeeAmount || 0),
        maker: order.maker,
        taker: order.taker,
        sender: order.sender,
        feeRecipient: order.feeRecipient,
        pool: order.pool,
        expiry: BigInt(order.expiry),
        salt: BigInt(order.salt)
      }
    });
  }

  /**
   * Validate signed 0x Protocol EIP-712 order cryptographically
   */
  public static async validateOrderSignature(
    signedOrder: { order: ZeroExLimitOrder; signature: ZeroExSignature },
    chainId = 1,
    exchangeProxyAddress?: Address
  ): Promise<{ isValid: boolean; recoveredAddress?: Address; reason?: string }> {
    const { order, signature } = signedOrder;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (Number(order.expiry) <= now) {
      return { isValid: false, reason: 'ORDER_EXPIRED' };
    }

    // Check amounts
    if (BigInt(order.makerAmount) <= 0n || BigInt(order.takerAmount) <= 0n) {
      return { isValid: false, reason: 'INVALID_AMOUNTS' };
    }

    try {
      const domain = this.getDomain(chainId, exchangeProxyAddress);

      // Concatenate r, s, and v into 65-byte hex signature
      const r = signature.r.replace(/^0x/, '').padStart(64, '0');
      const s = signature.s.replace(/^0x/, '').padStart(64, '0');
      const v = signature.v.toString(16).padStart(2, '0');
      const hexSignature = `0x${r}${s}${v}` as Hex;

      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types: ZERO_EX_EIP712_TYPES,
        primaryType: 'LimitOrder',
        message: {
          makerToken: order.makerToken,
          takerToken: order.takerToken,
          makerAmount: BigInt(order.makerAmount),
          takerAmount: BigInt(order.takerAmount),
          takerTokenFeeAmount: BigInt(order.takerTokenFeeAmount || 0),
          maker: order.maker,
          taker: order.taker,
          sender: order.sender,
          feeRecipient: order.feeRecipient,
          pool: order.pool,
          expiry: BigInt(order.expiry),
          salt: BigInt(order.salt)
        },
        signature: hexSignature
      });

      const isMatch = recoveredAddress.toLowerCase() === order.maker.toLowerCase();
      return {
        isValid: isMatch,
        recoveredAddress,
        reason: isMatch ? undefined : `MAKER_SIGNATURE_MISMATCH: expected ${order.maker}, recovered ${recoveredAddress}`
      };
    } catch (err: any) {
      return { isValid: false, reason: err.message || 'SIGNATURE_RECOVERY_FAILED' };
    }
  }

  /**
   * Helper to sign an order with a private key (for market makers & automated hybrid liquidity)
   */
  public static async signOrder(
    order: ZeroExLimitOrder,
    privateKey: Hex,
    chainId = 1,
    exchangeProxyAddress?: Address
  ): Promise<SignedZeroExOrder> {
    const account = privateKeyToAccount(privateKey);
    const domain = this.getDomain(chainId, exchangeProxyAddress);

    const rawSig = await account.signTypedData({
      domain,
      types: ZERO_EX_EIP712_TYPES,
      primaryType: 'LimitOrder',
      message: {
        makerToken: order.makerToken,
        takerToken: order.takerToken,
        makerAmount: BigInt(order.makerAmount),
        takerAmount: BigInt(order.takerAmount),
        takerTokenFeeAmount: BigInt(order.takerTokenFeeAmount || 0),
        maker: order.maker,
        taker: order.taker,
        sender: order.sender,
        feeRecipient: order.feeRecipient,
        pool: order.pool,
        expiry: BigInt(order.expiry),
        salt: BigInt(order.salt)
      }
    });

    const r = `0x${rawSig.slice(2, 66)}` as Hex;
    const s = `0x${rawSig.slice(66, 130)}` as Hex;
    const v = parseInt(rawSig.slice(130, 132), 16);

    const signature: ZeroExSignature = {
      signatureType: ZeroExSignatureType.EIP712,
      v,
      r,
      s
    };

    const orderHash = this.computeOrderHash(order, chainId, exchangeProxyAddress);

    return {
      order,
      signature,
      orderHash,
      metaData: {
        orderHash,
        remainingFillableTakerAmount: order.takerAmount,
        createdAt: Date.now(),
        status: 'FILLABLE'
      }
    };
  }

  /**
   * Generate 0x Exchange Proxy `fillLimitOrder` Calldata for settlement
   */
  public static generateFillCalldata(
    signedOrder: SignedZeroExOrder,
    takerTokenFillAmount: bigint | string
  ): Hex {
    return encodeFunctionData({
      abi: ZERO_EX_EXCHANGE_PROXY_ABI,
      functionName: 'fillLimitOrder',
      args: [
        {
          makerToken: signedOrder.order.makerToken,
          takerToken: signedOrder.order.takerToken,
          makerAmount: BigInt(signedOrder.order.makerAmount),
          takerAmount: BigInt(signedOrder.order.takerAmount),
          takerTokenFeeAmount: BigInt(signedOrder.order.takerTokenFeeAmount),
          maker: signedOrder.order.maker,
          taker: signedOrder.order.taker,
          sender: signedOrder.order.sender,
          feeRecipient: signedOrder.order.feeRecipient,
          pool: signedOrder.order.pool,
          expiry: BigInt(signedOrder.order.expiry),
          salt: BigInt(signedOrder.order.salt)
        },
        {
          signatureType: signedOrder.signature.signatureType,
          v: signedOrder.signature.v,
          r: signedOrder.signature.r,
          s: signedOrder.signature.s
        },
        BigInt(takerTokenFillAmount)
      ]
    });
  }
}
