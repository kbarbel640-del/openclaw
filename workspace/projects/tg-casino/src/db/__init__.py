"""Database module"""
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
import os

from .models import Base

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./casino.db')


def to_async_url(url: str) -> str:
    parsed = make_url(url)
    if parsed.drivername.startswith("sqlite"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///")
    if parsed.drivername.startswith("postgresql"):
        # Use render_as_string to preserve password (str() masks it with ***)
        return parsed.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)
    return url


ASYNC_DATABASE_URL = to_async_url(DATABASE_URL)

# Sync engine (for init)
engine = create_engine(DATABASE_URL)

# Async engine (for bot/workers)
async_engine = create_async_engine(ASYNC_DATABASE_URL)
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


async def get_db():
    """Get async database session"""
    async with AsyncSessionLocal() as session:
        yield session
