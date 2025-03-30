import argparse
import logging
import os
import subprocess
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy_utils import database_exists, drop_database, create_database
from sqlalchemy.exc import OperationalError

from metacheck_common.config import config

logger = logging.getLogger(__name__)


def parse_arguments():
    parser = argparse.ArgumentParser(description="Reset MetaCheck database and apply all migrations")
    parser.add_argument("--logging-level", default=logging.INFO, help="Logging level")
    parser.add_argument("--force", action="store_true", help="Force reset without confirmation")
    return parser.parse_args()


def setup_logging(logging_level):
    log_formatter = logging.Formatter(
        "DB RESET - %(asctime)s - %(filename)s - %(levelname)s - %(message)s"
    )
    log_formatter.converter = time.gmtime
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(log_formatter)
    root_logger = logging.getLogger()
    root_logger.handlers = []
    root_logger.addHandler(handler)
    root_logger.setLevel(logging_level)


def main():
    args = parse_arguments()
    setup_logging(args.logging_level)

    logger.info("Starting database reset process")
    logger.info(f"Using database URL: {config.DATABASE_URL}")

    # Extract database name from URL for display purposes
    db_name = config.DATABASE_URL.split("/")[-1]
    
    # Confirm reset if not forced
    if not args.force:
        confirm = input(f"Are you sure you want to completely reset the database '{db_name}'? This will DELETE ALL DATA! (y/N): ")
        if confirm.lower() not in ['y', 'yes']:
            logger.info("Database reset aborted by user")
            return

    # Convert async URL to sync URL for SQLAlchemy operations
    sync_database_url = config.DATABASE_URL.replace("+asyncpg", "")
    
    try:
        # Create engine pointing to the postgres database to handle dropping/creating our target DB
        postgres_url = sync_database_url.rsplit('/', 1)[0] + '/postgres'
        engine = create_engine(postgres_url)
        
        # Get the target DB name
        target_db = sync_database_url.rsplit('/', 1)[1]
        
        with engine.begin() as conn:
            # Check if anyone is connected to the database
            result = conn.execute(text(f"""
                SELECT pid, pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = '{target_db}' AND pid <> pg_backend_pid()
            """))
            terminated_count = result.rowcount
            logger.info(f"Terminated {terminated_count} connections to the database")
        
        # Drop database if it exists
        if database_exists(sync_database_url):
            logger.info(f"Dropping existing database '{db_name}'")
            drop_database(sync_database_url)
        
        # Create a fresh database
        logger.info(f"Creating new empty database '{db_name}'")
        create_database(sync_database_url)
        
        # Run alembic migrations
        logger.info("Running all Alembic migrations")
        alembic_ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
        result = subprocess.run(
            ["alembic", "-c", alembic_ini_path, "upgrade", "head"], 
            capture_output=True, 
            text=True,
            check=True
        )
        
        logger.info(f"Alembic output:\n{result.stdout}")
        
        if result.stderr:
            logger.warning(f"Alembic warnings/errors:\n{result.stderr}")
        
        logger.info("Database reset complete! Database now contains only migrations.")
        
    except OperationalError as e:
        logger.error(f"Database operation error: {str(e)}")
        return 1
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running Alembic migrations: {e.stderr}")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main()) 