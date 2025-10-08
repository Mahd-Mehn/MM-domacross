import asyncio
import logging
import os
import sys

# Add the project root to the Python path to allow for absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.services.doma_subgraph_service import doma_subgraph_service

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def main():
    """
    Main function to run the fractional token sync process.
    """
    logger.info("Starting subgraph sync process...")
    try:
        stats = await doma_subgraph_service.sync_fractional_tokens_to_db()
        logger.info(f"Sync completed successfully: {stats.get('created', 0)} created, {stats.get('updated', 0)} updated.")
    except Exception as e:
        logger.error(f"An error occurred during the sync process: {e}", exc_info=True)
    finally:
        await doma_subgraph_service.close()
        logger.info("Subgraph service client closed.")

if __name__ == "__main__":
    # This allows the script to be run from the project root directory
    asyncio.run(main())
