#!/usr/bin/env python3
"""Migrate SQLite data to PostgreSQL."""
import os
import sqlite3
from typing import List, Tuple

from sqlalchemy import create_engine, text

SQLITE_PATH = os.getenv("SQLITE_PATH", "./casino.db")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is required for PostgreSQL")


def _fetch_all(conn, table: str) -> List[Tuple]:
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table}")
    return cur.fetchall()


def main():
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row

    pg = create_engine(DATABASE_URL)

    with pg.begin() as conn:
        from src.db.models import Base  # noqa: WPS433
        Base.metadata.create_all(bind=conn)

        users = _fetch_all(sqlite_conn, "users")
        if users:
            conn.execute(text("DELETE FROM users"))
            conn.execute(
                text(
                    """
                    INSERT INTO users
                    (id, telegram_id, username, language, usdt_address, usdt_private_key_encrypted,
                     balance, frozen_balance, server_seed, client_seed, nonce, total_wagered,
                     total_won, total_deposited, total_withdrawn, is_banned, ban_reason, vip_level,
                     created_at, updated_at)
                    VALUES
                    (:id, :telegram_id, :username, :language, :usdt_address, :usdt_private_key_encrypted,
                     :balance, :frozen_balance, :server_seed, :client_seed, :nonce, :total_wagered,
                     :total_won, :total_deposited, :total_withdrawn, :is_banned, :ban_reason, :vip_level,
                     :created_at, :updated_at)
                    """
                ),
                [
                    {
                        **dict(row),
                        "frozen_balance": 0.0,
                    }
                    for row in users
                ],
            )

        bets = _fetch_all(sqlite_conn, "bets")
        if bets:
            conn.execute(text("DELETE FROM bets"))
            conn.execute(
                text(
                    """
                    INSERT INTO bets
                    (id, user_id, game, amount, bet_data, result_data, server_seed_hash,
                     client_seed, nonce, multiplier, payout, profit, is_win, created_at)
                    VALUES
                    (:id, :user_id, :game, :amount, :bet_data, :result_data, :server_seed_hash,
                     :client_seed, :nonce, :multiplier, :payout, :profit, :is_win, :created_at)
                    """
                ),
                [dict(row) for row in bets],
            )

        txs = _fetch_all(sqlite_conn, "transactions")
        if txs:
            conn.execute(text("DELETE FROM transactions"))
            conn.execute(
                text(
                    """
                    INSERT INTO transactions
                    (id, user_id, type, amount, tx_hash, from_address, to_address, status,
                     created_at, confirmed_at, notes)
                    VALUES
                    (:id, :user_id, :type, :amount, :tx_hash, :from_address, :to_address, :status,
                     :created_at, :confirmed_at, :notes)
                    """
                ),
                [{**dict(row), "notes": None} for row in txs],
            )

        states = _fetch_all(sqlite_conn, "game_states")
        if states:
            conn.execute(text("DELETE FROM game_states"))
            conn.execute(
                text(
                    """
                    INSERT INTO game_states
                    (id, game, round_id, state, server_seed, server_seed_hash, started_at, ended_at, result)
                    VALUES
                    (:id, :game, :round_id, :state, :server_seed, :server_seed_hash, :started_at, :ended_at, :result)
                    """
                ),
                [dict(row) for row in states],
            )

    sqlite_conn.close()
    print("Migration completed.")


if __name__ == "__main__":
    main()
