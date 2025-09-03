"use client";

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "../contracts";

// Hook for Competition Factory interactions
export function useCompetitionFactory() {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const createCompetition = async (
    startTime: number,
    endTime: number,
    entryFee: string,
    valuationOracle: string
  ) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.COMPETITION_FACTORY as `0x${string}`,
      abi: CONTRACTS.ABIS.COMPETITION_FACTORY,
      functionName: "createCompetition",
      args: [BigInt(startTime), BigInt(endTime), BigInt(entryFee), valuationOracle as `0x${string}`],
    });
  };

  return {
    createCompetition,
    hash,
    isPending,
  };
}

// Hook for Competition interactions
export function useCompetition(contractAddress: string) {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const joinCompetition = async (entryFee: string) => {
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: CONTRACTS.ABIS.COMPETITION,
      functionName: "join",
      value: BigInt(entryFee),
    });
  };

  return {
    joinCompetition,
    hash,
    isPending,
  };
}

// Hook for Domain Marketplace interactions
export function useDomainMarketplace() {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const createOrder = async (
    seller: string,
    domainContract: string,
    tokenId: string,
    price: string
  ) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.DOMAIN_MARKETPLACE as `0x${string}`,
      abi: CONTRACTS.ABIS.DOMAIN_MARKETPLACE,
      functionName: "createOrder",
      args: [
        seller as `0x${string}`,
        domainContract as `0x${string}`,
        BigInt(tokenId),
        BigInt(price)
      ],
    });
  };

  const buyDomain = async (orderId: string) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.DOMAIN_MARKETPLACE as `0x${string}`,
      abi: CONTRACTS.ABIS.DOMAIN_MARKETPLACE,
      functionName: "buyDomain",
      args: [BigInt(orderId)],
    });
  };

  const cancelOrder = async (orderId: string) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.DOMAIN_MARKETPLACE as `0x${string}`,
      abi: CONTRACTS.ABIS.DOMAIN_MARKETPLACE,
      functionName: "cancelOrder",
      args: [BigInt(orderId)],
    });
  };

  return {
    createOrder,
    buyDomain,
    cancelOrder,
    hash,
    isPending,
  };
}

// Hook for Domain Basket interactions
export function useDomainBasket() {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const createBasket = async (
    name: string,
    description: string,
    domainContracts: string[],
    tokenIds: string[]
  ) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.DOMAIN_BASKET as `0x${string}`,
      abi: CONTRACTS.ABIS.DOMAIN_BASKET,
      functionName: "createBasket",
      args: [
        name,
        description,
        domainContracts.map(addr => addr as `0x${string}`),
        tokenIds.map(id => BigInt(id))
      ],
    });
  };

  const buyBasket = async (basketId: string) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.DOMAIN_BASKET as `0x${string}`,
      abi: CONTRACTS.ABIS.DOMAIN_BASKET,
      functionName: "buyBasket",
      args: [BigInt(basketId)],
    });
  };

  return {
    createBasket,
    buyBasket,
    hash,
    isPending,
  };
}

// Hook for Mock USDC interactions
export function useMockUSDC() {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const mint = async (to: string, amount: string) => {
    return writeContract({
      address: CONTRACTS.ADDRESSES.MOCK_USDC as `0x${string}`,
      abi: CONTRACTS.ABIS.MOCK_USDC,
      functionName: "mint",
      args: [to as `0x${string}`, BigInt(amount)],
    });
  };

  return {
    mint,
    hash,
    isPending,
  };
}

// Hook for reading contract data
export function useContractRead(contractName: keyof typeof CONTRACTS.ADDRESSES, functionName: string, args: any[] = []) {
  const contract = CONTRACTS.ADDRESSES[contractName];
  const abi = CONTRACTS.ABIS[contractName as keyof typeof CONTRACTS.ABIS];

  return useReadContract({
    address: contract as `0x${string}`,
    abi,
    functionName,
    args,
  });
}

// Hook for transaction confirmation
export function useTransactionConfirmation(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({
    hash,
  });
}
