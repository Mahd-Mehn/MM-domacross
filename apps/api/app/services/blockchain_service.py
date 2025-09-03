from typing import Optional
from web3 import Web3
from eth_account import Account
import os
from app.config import settings

class BlockchainService:
    def __init__(self):
        self.web3: Optional[Web3] = None
        if settings.doma_testnet_chain_id and settings.doma_rpc_url_primary:
            self.web3 = Web3(Web3.HTTPProvider(settings.doma_rpc_url_primary))

    async def get_contract_instance(self, contract_address: str, abi: list):
        """Get a contract instance for interaction"""
        if not self.web3:
            raise Exception("Blockchain connection not configured")
        return self.web3.eth.contract(address=contract_address, abi=abi)

    async def get_transaction_receipt(self, tx_hash: str):
        """Get transaction receipt"""
        if not self.web3:
            raise Exception("Blockchain connection not configured")
        return self.web3.eth.get_transaction_receipt(tx_hash)

    async def estimate_gas(self, transaction: dict) -> int:
        """Estimate gas for a transaction"""
        if not self.web3:
            raise Exception("Blockchain connection not configured")
        return self.web3.eth.estimate_gas(transaction)

blockchain_service = BlockchainService()
