import { ethers } from 'ethers';

export function formatEth(wei: number | bigint | string): string {
  if (typeof wei === 'number') wei = BigInt(Math.round(wei * 1e18));
  return ethers.formatEther(wei);
}

export function formatToken(amount: number, decimals: number = 18): string {
  return amount.toFixed(4);
}

export function formatAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function formatPercentage(value: number): string {
  return value.toFixed(2) + '%';
}
