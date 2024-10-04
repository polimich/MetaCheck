import os

class Config:
    def __init__(self):
        self.DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pass@localhost:5432/metacheck_db")

config = Config()

