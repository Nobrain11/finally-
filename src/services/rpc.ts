// src/services/rpc.ts

import { ethers } from 'ethers';
import { Config } from '../types';

export class RPCService {
  public provider: ethers.Provider;
  public config: Config;

  constructor(config: Config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async getBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address);
  }

  async getGasPrice(): Promise<bigint> {
    return this.provider.getFeeData().then(fd => fd.gasPrice || 0n);
  }

  async estimateGas(tx: any): Promise<bigint> {
    return this.provider.estimateGas(tx);
  }

  async sendTransaction(signer: ethers.Signer, tx: any): Promise<ethers.TransactionResponse> {
    return signer.sendTransaction(tx);
  }

  async waitForTransaction(hash: string): Promise<ethers.TransactionReceipt | null> {
    return this.provider.waitForTransaction(hash);
  }

  // Contract helpers
  getContract(address: string, abi: any, signer?: ethers.Signer): ethers.Contract {
    if (signer) {
      return new ethers.Contract(address, abi, signer);
    }
    return new ethers.Contract(address, abi, this.provider);
  }
}
