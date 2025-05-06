#!/usr/bin/env python3
"""
Script to invalidate all collection caches after structure changes.
Run this after deploying code changes that affect the structure of the hierarchical collection cache.
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to the path so we can import metacheck modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Now we can import from metacheck
from metacheck.database import get_async_session
from metacheck.cruds.crud_collection import invalidate_all_collection_caches

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting cache invalidation process")
    
    # Get database session
    session_generator = get_async_session()
    db = await anext(session_generator)
    
    try:
        # Invalidate all caches
        count = await invalidate_all_collection_caches(db)
        
        logger.info(f"Successfully invalidated {count} collection caches")
        logger.info("Cache invalidation completed")
    except Exception as e:
        logger.error(f"Error during cache invalidation: {e}", exc_info=True)
    finally:
        # Close the database session
        await db.close()
        
if __name__ == "__main__":
    asyncio.run(main()) 