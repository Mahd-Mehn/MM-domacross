// Environment configuration for DomaCross
export const config = {
  // Network Configuration
  networks: {
    domaTestnet: {
      chainId: 1337,
      name: 'Doma Testnet',
      rpcUrl: process.env.NEXT_PUBLIC_DOMA_TESTNET_RPC_URL || 'http://127.0.0.1:8545',
      blockExplorer: process.env.NEXT_PUBLIC_DOMA_BLOCK_EXPLORER || 'https://explorer.doma.testnet',
    },
    mainnet: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
      blockExplorer: 'https://etherscan.io',
    },
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
      blockExplorer: 'https://sepolia.etherscan.io',
    },
  },

  // Contract Addresses (update these with deployed addresses)
  contracts: {
    COMPETITION_FACTORY: process.env.NEXT_PUBLIC_COMPETITION_FACTORY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    VALUATION_ORACLE: process.env.NEXT_PUBLIC_VALUATION_ORACLE_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    MOCK_USDC: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    MOCK_DOMAIN_NFT: process.env.NEXT_PUBLIC_MOCK_DOMAIN_NFT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    DOMAIN_MARKETPLACE: process.env.NEXT_PUBLIC_DOMAIN_MARKETPLACE_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    DOMAIN_BASKET: process.env.NEXT_PUBLIC_DOMAIN_BASKET_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  },

  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai',
    timeout: 30000,
  },

  // Feature Flags
  features: {
    enableDomainTrading: true,
    enableBasketCreation: true,
    enableRealTimeUpdates: false, // TODO: Implement real-time updates
    enableCrossChain: false, // TODO: Implement cross-chain functionality
  },

  // Competition Settings
  competition: {
    defaultEntryFee: '0.01', // ETH
    minDepositAmount: '10', // USDC
    maxBasketSize: 10, // Maximum domains per basket
    competitionDuration: 7 * 24 * 60 * 60, // 7 days in seconds
  },
};

// Helper function to get current network config
export function getCurrentNetwork() {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'domaTestnet';
  return config.networks[network as keyof typeof config.networks] || config.networks.domaTestnet;
}

// Helper function to get contract address
export function getContractAddress(contractName: keyof typeof config.contracts) {
  return config.contracts[contractName];
}

// Helper function to check if feature is enabled
export function isFeatureEnabled(feature: keyof typeof config.features) {
  return config.features[feature];
}
