import asyncio
from typing import Dict, Any
from .interface import AgentInterface

class MockAdapter(AgentInterface):
    def execute_task(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        folder = task_info.get("folder", "")
        
        # Simulate long running task
        print(f"Mocking task execution for folder: {folder}")
        
        if "B/Books" in folder:
            return {
                "status": "completed",
                "atomicsCreated": {
                    "concepts": 28,
                    "principles": 15,
                    "methods": 12,
                    "patterns": 18
                },
                "outputNodes": 73,
                "message": "📚 Extraction Complete! I've created 73 Atomic notes from this book."
            }
        else:
            return {
                "status": "completed",
                "atomicsCreated": {"concepts": 2},
                "outputNodes": 2,
                "message": f"Processed item in {folder}."
            }

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "Mock Agent",
            "version": "1.0",
            "memory_type": "Ephemeral",
            "tools": ["UI Simulator"]
        }
