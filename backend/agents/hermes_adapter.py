import subprocess
import json
import os
from typing import Dict, Any
from .interface import AgentInterface

class HermesConfig:
    def __init__(self):
        # We can switch to HTTP later via env var, e.g. HERMES_USE_HTTP=true
        self.use_http = os.getenv("HERMES_USE_HTTP", "false").lower() == "true"
        self.cli_path = os.getenv("HERMES_CLI_PATH", "/home/waheed/hermes-agent/cli.py")

class HermesAdapter(AgentInterface):
    def __init__(self):
        self.config = HermesConfig()

    def execute_task(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        if self.config.use_http:
            return self._execute_via_http(task_info)
        else:
            return self._execute_via_cli(task_info)

    def _execute_via_cli(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        # Build the prompt based on the dropped folder
        folder = task_info.get("folder", "")
        prompt = f"System: The user dropped a node into {folder}. Please handle this based on the ABCs of Control methodology."
        
        try:
            # Example command: python3 /home/waheed/hermes-agent/cli.py "prompt"
            # Note: This is a simplistic call. We might need to adjust arguments based on actual CLI.
            result = subprocess.run(
                ["python3", self.config.cli_path, prompt],
                capture_output=True,
                text=True,
                timeout=300
            )
            output = result.stdout
            
            # Simple parsing for MVP
            return {
                "status": "completed" if result.returncode == 0 else "failed",
                "message": output if output else result.stderr,
                "atomicsCreated": {},
                "outputNodes": 1
            }
        except Exception as e:
            return {
                "status": "failed",
                "message": f"Failed to execute Hermes CLI: {str(e)}",
                "atomicsCreated": {},
                "outputNodes": 0
            }

    def _execute_via_http(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        # Placeholder for future HTTP integration
        return {
            "status": "failed",
            "message": "HTTP mode not yet implemented for Hermes."
        }

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "Hermes",
            "version": "3.2",
            "memory_type": "Persistent SQLite",
            "tools": ["File System", "Code Execution", "Browser"]
        }
