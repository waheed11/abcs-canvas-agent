from abc import ABC, abstractmethod
from typing import Dict, Any

class AgentInterface(ABC):
    @abstractmethod
    def execute_task(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a task given the context (e.g., node drop info).
        Should return a dictionary containing the task results (e.g., atomics created).
        """
        pass

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """
        Returns info about the agent (model, version, memory type, tools).
        """
        pass
