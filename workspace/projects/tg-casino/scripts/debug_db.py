#!/usr/bin/env python3
"""Debug database connection issues"""
import os
import asyncio

# Get DATABASE_URL
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./casino.db')
print(f"DATABASE_URL from env: {DATABASE_URL}")

# Test 1: Direct asyncpg connection
print("\n--- Test 1: Direct asyncpg ---")
try:
    import asyncpg
    async def test_asyncpg():
        conn = await asyncpg.connect(
            user='user',
            password='pass', 
            host='postgres',
            port=5432,
            database='casino'
        )
        result = await conn.fetchval('SELECT 1')
        print(f"asyncpg direct: SUCCESS, result={result}")
        await conn.close()
    asyncio.run(test_asyncpg())
except Exception as e:
    print(f"asyncpg direct: FAILED - {e}")

# Test 2: SQLAlchemy URL parsing
print("\n--- Test 2: SQLAlchemy URL parsing ---")
try:
    from sqlalchemy.engine.url import make_url
    parsed = make_url(DATABASE_URL)
    print(f"Driver: {parsed.drivername}")
    print(f"User: {parsed.username}")
    print(f"Password: {repr(parsed.password)}")
    print(f"Host: {parsed.host}")
    print(f"Port: {parsed.port}")
    print(f"Database: {parsed.database}")
except Exception as e:
    print(f"URL parsing: FAILED - {e}")

# Test 3: to_async_url conversion
print("\n--- Test 3: to_async_url ---")
try:
    def to_async_url(url: str) -> str:
        parsed = make_url(url)
        if parsed.drivername.startswith("sqlite"):
            return url.replace("sqlite:///", "sqlite+aiosqlite:///")
        if parsed.drivername.startswith("postgresql"):
            # Use render_as_string to preserve password
            return parsed.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)
        return url
    
    async_url = to_async_url(DATABASE_URL)
    print(f"Async URL: {async_url}")
    
    # Check if password is preserved
    parsed_async = make_url(async_url)
    print(f"Async password: {repr(parsed_async.password)}")
except Exception as e:
    print(f"to_async_url: FAILED - {e}")

# Test 4: SQLAlchemy async engine
print("\n--- Test 4: SQLAlchemy async engine ---")
try:
    from sqlalchemy.ext.asyncio import create_async_engine
    
    async def test_sqlalchemy():
        # Use the converted URL
        engine = create_async_engine(async_url, echo=False)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"SQLAlchemy async: SUCCESS")
        await engine.dispose()
    
    from sqlalchemy import text
    asyncio.run(test_sqlalchemy())
except Exception as e:
    print(f"SQLAlchemy async: FAILED - {e}")

print("\n--- Done ---")
