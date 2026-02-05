"""Withdrawal worker - send USDT from hot wallet."""
import asyncio
import logging
from datetime import datetime

import redis.asyncio as redis
from tronpy import Tron
from tronpy.keys import PrivateKey

from ..config import REDIS_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS
from ..db import AsyncSessionLocal
from ..db.models import WithdrawalRequest, Transaction, User

logger = logging.getLogger(__name__)

USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"


def _get_hot_wallet():
    if not HOT_WALLET_PRIVATE_KEY:
        raise RuntimeError("HOT_WALLET_PRIVATE_KEY is required")
    priv = PrivateKey(bytes.fromhex(HOT_WALLET_PRIVATE_KEY))
    address = HOT_WALLET_ADDRESS or priv.public_key.to_base58check_address()
    return priv, address


async def process_withdrawal(request_id: int):
    async with AsyncSessionLocal() as session:
        req = await session.get(WithdrawalRequest, request_id)
        if not req or req.status != "approved":
            return

        req.status = "processing"
        req.processed_at = datetime.utcnow()
        amount = req.amount
        to_address = req.to_address
        user_id = req.user_id
        await session.commit()

    priv, from_address = _get_hot_wallet()
    client = Tron()
    contract = client.get_contract(USDT_CONTRACT)

    try:
        tx = (
            contract.functions.transfer(to_address, int(amount * 1_000_000))
            .with_owner(from_address)
            .fee_limit(5_000_000)
            .build()
            .sign(priv)
            .broadcast()
        )
        tx_hash = tx["txid"]
    except Exception as exc:
        logger.exception("Withdrawal failed #%s: %s", request_id, exc)
        await _mark_failed(request_id, str(exc))
        return

    async with AsyncSessionLocal() as session:
        req = await session.get(WithdrawalRequest, request_id)
        if not req:
            return

        req.status = "completed"
        req.tx_hash = tx_hash
        req.completed_at = datetime.utcnow()

        user = await session.get(User, user_id)
        if user:
            user.frozen_balance = max(0.0, user.frozen_balance - amount)
            user.total_withdrawn += amount

        tx_row = Transaction(
            user_id=user_id,
            type="withdraw",
            amount=amount,
            tx_hash=tx_hash,
            to_address=to_address,
            status="confirmed",
            confirmed_at=datetime.utcnow(),
            notes="auto-withdraw",
        )
        session.add(tx_row)
        await session.commit()


async def _mark_failed(request_id: int, reason: str):
    async with AsyncSessionLocal() as session:
        req = await session.get(WithdrawalRequest, request_id)
        if not req:
            return

        req.status = "failed"
        req.reject_reason = reason[:200]

        user = await session.get(User, req.user_id)
        if user:
            user.balance += req.amount
            user.frozen_balance = max(0.0, user.frozen_balance - req.amount)

        await session.commit()


async def main():
    logging.basicConfig(level=logging.INFO)
    r = redis.from_url(REDIS_URL)
    logger.info("Withdrawal worker started")
    while True:
        try:
            item = await r.blpop("withdrawal:queue", timeout=5)
            if not item:
                continue
            _, request_id = item
            await process_withdrawal(int(request_id))
        except Exception as exc:
            logger.exception("Worker error: %s", exc)
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
