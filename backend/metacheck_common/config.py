import logging
import os
import time


class UTCFormatter(logging.Formatter):
    converter = time.gmtime

TRUE_VALUES = {"true", "1"}


class Config:
    def __init__(self):
        self.BASE_DIR = os.getenv("BASE_DIR", "./metacheck_data")
        self.ADMIN_SERVER_NAME = os.getenv("ADMIN_SERVER_NAME", "MetaCheck")
        self.SERVER_NAME = os.getenv("SERVER_NAME", "MetaCheck")
        self.MODE = os.getenv("MODE", 'server')

        self.DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:pass@localhost:5432/metacheck_db")
        self.APP_URL_ROOT = os.getenv("APP_URL_ROOT", "/")

        self.IMAGE_UPLOADED_DIR = os.getenv("IMAGE_UPLOADED_DIR",
                                            os.path.join(self.BASE_DIR, "server", "image_uploaded"))
        self.IMAGE_PREVIEW_DIR = os.getenv("IMAGE_PREVIEW_DIR", os.path.join(self.BASE_DIR, "server", "image_preview"))
        self.IMAGE_PREVIEW_RESOLUTION = int(os.getenv("IMAGE_PREVIEW_RESOLUTION", 70000))

        self.WORKING_DIR = os.getenv("WORKING_DIR", f'/tmp/metacheck.{self.MODE}')

        self.PRODUCTION = os.getenv("PRODUCTION", False)

        # LOGGING configuration
        ################################################################################################################
        self.LOGGING_CONSOLE_LEVEL = os.getenv("LOGGING_CONSOLE_LEVEL", logging.INFO)
        self.LOGGING_FILE_LEVEL = os.getenv("LOGGING_FILE_LEVEL", logging.INFO)
        self.LOGGING_DIR = os.getenv("LOGGING_DIR", os.path.join(self.BASE_DIR, self.MODE, "logs"))
        self.LOGGING_CONFIG = {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'base': {
                    '()': UTCFormatter,
                    'format': '%(asctime)s : %(name)s : %(levelname)s : %(message)s'
                }
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'level': self.LOGGING_CONSOLE_LEVEL,
                    'formatter': 'base',
                    'stream': 'ext://sys.stdout'
                },
                'file_log': {
                    'class': 'logging.handlers.TimedRotatingFileHandler',
                    'level': self.LOGGING_FILE_LEVEL,
                    'when': 'midnight',
                    'utc': True,
                    'formatter': 'base',
                    'filename': os.path.join(self.LOGGING_DIR, f'{self.MODE}.log')
                }
            },
            'loggers': {
                'root': {
                    'level': 'DEBUG',
                    'handlers': [
                        'console',
                        'file_log',
                    ]
                },
                'metacheck.exception_logger': {
                    'level': 'DEBUG',
                    'handlers': [
                        'file_log'
                    ]
                },
                'multipart.multipart': {
                    'level': 'INFO'
                }
            }
        }
        ################################################################################################################

    def create_dirs(self):
        os.makedirs(self.IMAGE_UPLOADED_DIR, exist_ok=True)
        os.makedirs(self.IMAGE_PREVIEW_DIR, exist_ok=True)
        os.makedirs(self.WORKING_DIR, exist_ok=True)
        os.makedirs(self.LOGGING_DIR, exist_ok=True)

config = Config()
config.create_dirs()

