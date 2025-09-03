from typing import Optional, List, Dict, Union
from web3 import Web3
from eth_account import Account
import os
from app.config import settings
import asyncio
from web3.contract import Contract
from web3.datastructures import AttributeDict

class BlockchainService:
    def __init__(self):
        """Lazily configure Web3 so missing optional env vars don't break app import.

        FastAPI startup was failing with 'Could not import module "main"' which
        can happen if an exception is raised at import time inside dependency modules.
        We guard Web3 initialization so absence or misconfiguration of DOMA RPC
        environment variables doesn't raise during module import.
        """
        self.web3: Optional[Web3] = None
        self.fallback_web3: Optional[Web3] = None
        self._init_error: Optional[str] = None
        self._attempted = False
        self._init()

    def _init(self):
        if self._attempted:
            return
        self._attempted = True
        chain_id = settings.doma_testnet_chain_id
        primary = settings.doma_rpc_url_primary
        fallback = settings.doma_rpc_url_fallback
        try:
            if not chain_id:
                self._init_error = "DOMA_TESTNET_CHAIN_ID missing or empty"
                return
            if not primary:
                self._init_error = "DOMA_TESTNET_RPC_URL_PRIMARY missing or empty"
                return
            self.web3 = Web3(Web3.HTTPProvider(primary))
            if fallback:
                self.fallback_web3 = Web3(Web3.HTTPProvider(fallback))
        except Exception as e:
            self._init_error = f"Initialization exception: {e}"

    def ensure_initialized(self) -> bool:
        if self.web3:
            return True
        if not self._attempted:
            self._init()
        if not self.web3 and not self._init_error:
            # Retry once in case envs became available later
            self._attempted = False
            self._init()
        return self.web3 is not None

    async def get_contract_instance(self, contract_address: str, abi: list) -> Contract:
        """Get a contract instance for interaction"""
        if not self.web3:
            raise Exception("Blockchain connection not configured (web3 not initialized)")
        return self.web3.eth.contract(address=contract_address, abi=abi)

    async def get_transaction_receipt(self, tx_hash: str) -> Optional[AttributeDict]:
        """Get transaction receipt"""
        if not self.web3:
            raise Exception("Blockchain connection not configured (web3 not initialized)")
        try:
            return self.web3.eth.get_transaction_receipt(tx_hash)
        except Exception as e:
            print(f"Error getting receipt: {e}")
            return None

    async def estimate_gas(self, transaction: dict) -> int:
        """Estimate gas for a transaction"""
        if not self.web3:
            raise Exception("Blockchain connection not configured (web3 not initialized)")
        return self.web3.eth.estimate_gas(transaction)

    async def listen_for_events(self, contract_address: str, abi: list, event_name: str, from_block: Union[int, str] = 'latest'):
        """Listen for contract events"""
        contract = await self.get_contract_instance(contract_address, abi)
        event_filter = contract.events[event_name].create_filter(fromBlock=from_block)
        while True:
            try:
                events = event_filter.get_new_entries()
                for event in events:
                    yield event
                await asyncio.sleep(10)  # Poll every 10 seconds
            except Exception as e:
                print(f"Error listening for events: {e}")
                await asyncio.sleep(10)

    async def get_domain_price(self, valuation_oracle_address: str, domain_token_address: str) -> int:
        """Fetch domain price from valuation oracle"""
        # Assuming ValuationOracle ABI
        abi = [...]  # Need to define ABI
        contract = await self.get_contract_instance(valuation_oracle_address, abi)
        return contract.functions.getDomainPrice(domain_token_address).call()

    async def get_user_domains(self, user_address: str, domain_contracts: List[str]) -> List[Dict]:
        """Fetch user's domains across contracts"""
        domains = []
        for contract_addr in domain_contracts:
            # Assuming ERC721 ABI
            abi = [...]  # ERC721 ABI
            contract = await self.get_contract_instance(contract_addr, abi)
            balance = contract.functions.balanceOf(user_address).call()
            for i in range(balance):
                token_id = contract.functions.tokenOfOwnerByIndex(user_address, i).call()
                domains.append({
                    'contract': contract_addr,
                    'token_id': token_id,
                    'name': contract.functions.getDomainName(token_id).call() if hasattr(contract.functions, 'getDomainName') else f"Token {token_id}"
                })
        return domains

    async def listen_for_trade_events(self, marketplace_address: str, valuation_oracle_address: str):
        """Listen for trade events and update portfolios"""
        marketplace_abi = [...]  # DomainMarketplace ABI
        oracle_abi = [...]  # ValuationOracle ABI

        marketplace = await self.get_contract_instance(marketplace_address, marketplace_abi)
        oracle = await self.get_contract_instance(valuation_oracle_address, oracle_abi)

        # Assuming event filter for TradeExecuted
        event_filter = marketplace.events.TradeExecuted.create_filter(fromBlock='latest')

        while True:
            try:
                events = event_filter.get_new_entries()
                for event in events:
                    buyer = event.args.buyer
                    seller = event.args.seller
                    token_id = event.args.tokenId
                    price = event.args.price

                    # Update portfolio values
                    # This would call database update
                    await self.update_portfolio_value(buyer, token_id, price, oracle)
                    await self.update_portfolio_value(seller, token_id, -price, oracle)

                await asyncio.sleep(10)
            except Exception as e:
                print(f"Error listening for trades: {e}")
                await asyncio.sleep(10)

    async def update_portfolio_value(self, user: str, token_id: int, price_change: int, oracle):
        """Update user's portfolio value in database"""
        # Placeholder: integrate with database
        # Calculate new value using oracle
        new_value = oracle.functions.getDomainPrice(token_id).call()
        # Update DB
        pass

blockchain_service = BlockchainService()
