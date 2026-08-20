import { ethers } from 'ethers';

export function validateAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function validatePositiveNumber(value: any): boolean {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

export function validatePercentage(value: any): boolean {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && num <= 100;
}
