#!/usr/bin/env python3
"""Test startup sequence"""
import os
import sys

print("Step 1: Loading dotenv...")
from dotenv import load_dotenv
load_dotenv()

print("Step 2: Checking BOT_TOKEN...")
token = os.getenv('BOT_TOKEN')
if token:
    print(f"  Token: {token[:20]}...")
else:
    print("  ERROR: No token!")
    sys.exit(1)

print("Step 2b: Checking WALLET_ENCRYPTION_KEY...")
enc = os.getenv('WALLET_ENCRYPTION_KEY')
if enc:
    print("  Encryption key: OK")
else:
    print("  ERROR: No WALLET_ENCRYPTION_KEY!")
    sys.exit(1)

print("Step 3: Importing db...")
from src.db import init_db

print("Step 4: Initializing database...")
init_db()

print("Step 5: Importing handlers...")
from src.bot.handlers import start_handler

print("Step 6: Creating Application...")
from telegram.ext import Application
app = Application.builder().token(token).build()

print("✅ All checks passed! Bot can start.")
print("   Run 'python -m src.main' to start the bot.")
