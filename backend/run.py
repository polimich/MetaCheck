if __name__ == "__main__":
    import uvicorn
    from metacheck_common.config import config

    uvicorn.run("metacheck.main:app", host="0.0.0.0", port=8081, reload=True, log_config=config.LOGGING_CONFIG)
