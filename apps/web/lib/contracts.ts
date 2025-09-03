// Contract configurations for DomaCross
import { getContractAddress, getCurrentNetwork } from './config';

export const CONTRACTS = {
  // Doma Testnet Chain ID
  CHAIN_ID: getCurrentNetwork().chainId,

  // Contract Addresses
  ADDRESSES: {
    COMPETITION_FACTORY: getContractAddress('COMPETITION_FACTORY'),
    VALUATION_ORACLE: getContractAddress('VALUATION_ORACLE'),
    MOCK_USDC: getContractAddress('MOCK_USDC'),
    MOCK_DOMAIN_NFT: getContractAddress('MOCK_DOMAIN_NFT'),
    DOMAIN_MARKETPLACE: getContractAddress('DOMAIN_MARKETPLACE'),
    DOMAIN_BASKET: getContractAddress('DOMAIN_BASKET'),
  },

  // Contract ABIs
  ABIS: {
    COMPETITION_FACTORY: [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "competitionAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "startTime",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "endTime",
            "type": "uint256"
          }
        ],
        "name": "CompetitionCreated",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_startTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_endTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_entryFee",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "_valuationOracle",
            "type": "address"
          }
        ],
        "name": "createCompetition",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "deployedCompetitions",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],

    COMPETITION: [
      {
        "inputs": [],
        "name": "join",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "startTime",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "endTime",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "entryFee",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "isParticipant",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],

    DOMAIN_MARKETPLACE: [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "_seller",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_domainContract",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "_tokenId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_price",
            "type": "uint256"
          }
        ],
        "name": "createOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_orderId",
            "type": "uint256"
          }
        ],
        "name": "buyDomain",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_orderId",
            "type": "uint256"
          }
        ],
        "name": "cancelOrder",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],

    DOMAIN_BASKET: [
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "_description",
            "type": "string"
          },
          {
            "internalType": "address[]",
            "name": "_domainContracts",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "_tokenIds",
            "type": "uint256[]"
          }
        ],
        "name": "createBasket",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_basketId",
            "type": "uint256"
          }
        ],
        "name": "buyBasket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],

    MOCK_USDC: [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ]
  }
};

// Helper function to get contract instance
export function getContract(contractName: keyof typeof CONTRACTS.ADDRESSES) {
  const address = CONTRACTS.ADDRESSES[contractName];
  const abi = CONTRACTS.ABIS[contractName as keyof typeof CONTRACTS.ABIS];

  if (!address || !abi) {
    throw new Error(`Contract ${contractName} not found in configuration`);
  }

  return { address, abi };
}
