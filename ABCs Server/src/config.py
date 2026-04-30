import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load ABCs workspace configuration
CONFIG_FILE = os.path.expanduser("~/.abcs-agent/config.env")
WORKSPACE_ROOT = None

if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "r") as f:
        for line in f:
            if line.startswith("WORKSPACE_ROOT="):
                WORKSPACE_ROOT = line.strip().split("=")[1].strip('"')

# Fallback if config isn't found
if not WORKSPACE_ROOT:
    WORKSPACE_ROOT = os.path.expanduser("~/abcs-workspace")

# Define folder paths
A_FOLDER = os.path.join(WORKSPACE_ROOT, "A")
B_FOLDER = os.path.join(WORKSPACE_ROOT, "B")
C_FOLDER = os.path.join(WORKSPACE_ROOT, "C")
D_FOLDER = os.path.join(WORKSPACE_ROOT, "D")
E_FOLDER = os.path.join(WORKSPACE_ROOT, "E")

# Environment Variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
