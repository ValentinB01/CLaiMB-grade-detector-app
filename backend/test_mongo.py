import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv(override=True)
url = os.environ.get("MONGODB_URL")

async def test_conn():
    print(f"Testing connection to: {url}")
    try:
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        # Force a network request
        await client.server_info()
        print("SUCCESS! Connected to cluster.")
    except Exception as e:
        print(f"FAILED: {type(e).__name__} - {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
