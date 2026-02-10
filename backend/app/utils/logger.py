import logging
from rich.logging import RichHandler

def setup_logging():
    """Configure logging with RichHandler for colored output."""
    logging.basicConfig(
        level="INFO",
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True, markup=True)]
    )
    logger = logging.getLogger("reminisce")
    logger.setLevel(logging.INFO)
    return logger

# Create a singleton logger instance to import elsewhere
logger = setup_logging()
