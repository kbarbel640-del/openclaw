"""TRC20 deposit monitor (TronGrid polling)."""
import asyncio
import json
import logging
from datetime import datetime

import httpx
import redis.asyncio as redis
from tronpy import Tron
from tronpy.providers import HTTPProvider
from sqlalchemy import select

from ..config import DATABASE_URL, REDIS_URL, TRONGRID_API_KEY
from ..db import AsyncSessionLocal
from ..db.models import User, Transaction

logger = logging.getLogger(__name__)

USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
TRONGRID_API = "https://api.trongrid.io"
REQUIRED_CONFIRMATIONS = 19
MIN_DEPOSIT = 1.0


class DepositMonitor:
    def __init__(self):
        self.redis = redis.from_url(REDIS_URL)
        self.client = Tron(HTTPProvider(TRONGRID_API))
        self.http = httpx.AsyncClient(
            headers={"TRON-PRO-API-KEY": TRONGRID_API_KEY} if TRONGRID_API_KEY else {}
        )
        self.watched_addresses: set[str] = set()
        self.last_refresh = 0

    async def start(self):
        logger.info("Deposit monitor loop started")
        while True:
            try:
                await self._refresh_addresses()
                logger.debug("Watching %d addresses", len(self.watched_addresses))
                await self._poll_deposits()
            except Exception as exc:
                logger.exception("Deposit monitor error: %s", exc)
            await asyncio.sleep(10)

    async def _refresh_addresses(self):
        # refresh every 5 minutes
        now = int(datetime.utcnow().timestamp())
        if now - self.last_refresh < 300 and self.watched_addresses:
            return

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User.usdt_address))
            self.watched_addresses = {row[0] for row in result.fetchall() if row[0]}
        self.last_refresh = now

    async def _poll_deposits(self):
        for address in list(self.watched_addresses):
            await self._check_address_deposits(address)

    async def _check_address_deposits(self, address: str):
        last_check_key = f"deposit:last_check:{address}"
        last_check = int(await self.redis.get(last_check_key) or 0)

        url = f"{TRONGRID_API}/v1/accounts/{address}/transactions/trc20"
        params = {
            "only_to": True,
            "contract_address": USDT_CONTRACT,
            "min_timestamp": last_check + 1,
            "limit": 50,
        }
        resp = await self.http.get(url, params=params)
        data = resp.json()

        for tx in data.get("data", []):
            await self._process_deposit(address, tx)

        await self.redis.set(last_check_key, int(datetime.utcnow().timestamp() * 1000))

    async def _process_deposit(self, to_address: str, tx: dict):
        tx_hash = tx.get("transaction_id")
        if not tx_hash:
            return

        if await self.redis.sismember("deposit:processed", tx_hash):
            return

        if not await self._is_confirmed(tx_hash):
            return

        amount = int(tx.get("value", 0)) / 1_000_000
        if amount < MIN_DEPOSIT:
            return

        from_address = tx.get("from")

        async with AsyncSessionLocal() as session:
            user_row = await session.execute(
                select(User).where(User.usdt_address == to_address)
            )
            user = user_row.scalar_one_or_none()
            if not user:
                logger.warning("Orphan deposit %s -> %s", tx_hash, to_address)
                return

            # idempotency at DB level
            existing = await session.execute(
                select(Transaction).where(Transaction.tx_hash == tx_hash)
            )
            if existing.scalar_one_or_none():
                await self.redis.sadd("deposit:processed", tx_hash)
                return

            user_id = user.id
            tx_row = Transaction(
                user_id=user.id,
                type="deposit",
                amount=amount,
                tx_hash=tx_hash,
                from_address=from_address,
                to_address=to_address,
                status="confirmed",
                confirmed_at=datetime.utcnow(),
            )
            session.add(tx_row)

            user.balance += amount
            user.total_deposited += amount

            await session.commit()

        await self.redis.sadd("deposit:processed", tx_hash)
        await self.redis.publish(
            "deposit:confirmed",
            json.dumps({"user_id": user_id, "amount": amount, "tx_hash": tx_hash}),
        )

    async def _is_confirmed(self, tx_hash: str) -> bool:
        try:
            tx_info = self.client.get_transaction_info(tx_hash)
        except Exception:
            return False
        if not tx_info:
            return False
        block_number = tx_info.get("blockNumber", 0)
        if not block_number:
            return False
        current_block = self.client.get_latest_block_number()
        return (current_block - block_number) >= REQUIRED_CONFIRMATIONS


async def main():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger.info("Deposit monitor starting...")
    monitor = DepositMonitor()
    logger.info("Deposit monitor initialized, entering main loop")
    await monitor.start()


if __name__ == "__main__":
    asyncio.run(main())
