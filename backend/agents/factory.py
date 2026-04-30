from .interface import AgentInterface
from .mock_adapter import MockAdapter
from .hermes_adapter import HermesAdapter

class AgentFactory:
    @staticmethod
    def get_agent(agent_name: str) -> AgentInterface:
        name = agent_name.lower()
        if name == "hermes":
            return HermesAdapter()
        elif name == "mock":
            return MockAdapter()
        else:
            raise ValueError(f"Agent '{agent_name}' is not supported yet.")
