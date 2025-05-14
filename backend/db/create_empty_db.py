
"""
@author: Michael Polívka xpoliv07


Create an empty database.
"""

import argparse
import logging
import sys
import time

from sqlalchemy import create_engine
from sqlalchemy_utils import database_exists, create_database

from metacheck_common.config import config

logger = logging.getLogger(__name__)


def parse_arguments():
    parser = argparse.ArgumentParser()

    parser.add_argument("--logging-level", default=logging.INFO)
    args = parser.parse_args()

    return args


def main():
    args = parse_arguments()

    log_formatter = logging.Formatter(
        "DB CREATE - %(asctime)s - %(filename)s - %(levelname)s - %(message)s"
    )
    log_formatter.converter = time.gmtime
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(log_formatter)
    logger = logging.getLogger()
    logger.handlers = []
    logger.addHandler(handler)
    logger.setLevel(args.logging_level)

    logger.info(" ".join(sys.argv))

    sync_database_url = config.DATABASE_URL.replace("+asyncpg", "")

    db_engine = create_engine(sync_database_url)
    if not database_exists(db_engine.url):
        create_database(db_engine.url)
        logger.info(f"Database created")
    else:
        logger.info(f"Database already exists")


if __name__ == "__main__":
    main()
