"""
LangGraph state machine for routing and C/T trigger handling.
"""
from typing import TypedDict, List, Dict, Any, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

# Nodes (imported stubs for now)
from nodes.node_c_control import handle_role
from nodes.node_b_build import extract_source, synthesize_b_note
from nodes.node_a_atomic import parse_to_atomic
from nodes.node_d_deliver import generate_delivery
from nodes.node_e_eval import evaluate_node

class AgentState(TypedDict):
    messages: List[Dict[str, str]]
    task_id: str
    trigger_type: str  # 'C' (Control) or 'T' (Turn)
    destination: str
    topic: str
    user_role: str
    proposed_path: List[str]
    current_step: int
    context: Dict[str, Any]
    user_feedback: str

def parse_command(state: AgentState) -> AgentState:
    """Parse the user command and extract the trigger, destination, and topic."""
    msg = state["messages"][-1]["content"]
    
    trigger_type = 'T'
    if msg.upper().startswith("C:"):
        trigger_type = 'C'
    
    destination = ''
    topic = ''
    proposed_path = []
    
    # Example format: 'C: B "Topic"'
    parts = msg.split(maxsplit=2)
    if len(parts) >= 2:
        # The destination is the second word
        destination_string = parts[1].upper()
        if 'B' in destination_string: destination = 'B'
        elif 'D' in destination_string: destination = 'D'
        elif 'E' in destination_string: destination = 'E'
        elif 'A' in destination_string: destination = 'A'
        
        if len(parts) >= 3:
            topic = parts[2].strip('"\'')
            
    # Dynamically build path based on destination
    if destination == 'B':
        proposed_path = ['NodeB_Extract', 'NodeA', 'NodeB_Synthesize']
    elif destination == 'D':
        proposed_path = ['NodeB_Extract', 'NodeA', 'NodeD']
    elif destination == 'E':
        proposed_path = ['NodeB_Extract', 'NodeA', 'NodeE']
    elif destination == 'A':
        proposed_path = ['NodeB_Extract', 'NodeA']
    
    return {
        "trigger_type": trigger_type,
        "destination": destination,
        "topic": topic,
        "proposed_path": proposed_path,
        "current_step": 0
    }

def router(state: AgentState) -> str:
    """Determine whether to consult the user or execute immediately."""
    if state["trigger_type"] == 'C':
        return "NodeC_Role"
    if state["current_step"] >= len(state["proposed_path"]):
        return "END"
    return state["proposed_path"][state["current_step"]]

def execute_router(state: AgentState) -> str:
    """Route to the next node in the proposed path."""
    if state["current_step"] >= len(state["proposed_path"]):
        return "END"
    return state["proposed_path"][state["current_step"]]

def increment_step(state: AgentState) -> AgentState:
    """Increment the step counter after a node executes."""
    return {"current_step": state["current_step"] + 1}

class Orchestrator:
    def __init__(self):
        self.builder = StateGraph(AgentState)
        self.memory = MemorySaver()
        self.graph = None
        
    def build_graph(self):
        # Add Nodes
        self.builder.add_node("Parse", parse_command)
        self.builder.add_node("NodeC_Role", handle_role)
        self.builder.add_node("NodeB_Extract", extract_source)
        self.builder.add_node("NodeA", parse_to_atomic)
        self.builder.add_node("NodeB_Synthesize", synthesize_b_note)
        self.builder.add_node("NodeD", generate_delivery)
        self.builder.add_node("NodeE", evaluate_node)
        self.builder.add_node("Increment", increment_step)
        
        # Build Edges
        self.builder.add_edge(START, "Parse")
        
        path_nodes = ["NodeB_Extract", "NodeA", "NodeB_Synthesize", "NodeD", "NodeE"]
        
        # Router map for Parse node
        router_map = {n: n for n in path_nodes}
        router_map["END"] = END
        router_map["NodeC_Role"] = "NodeC_Role"
        
        self.builder.add_conditional_edges("Parse", router, router_map)
        
        # Execution map for NodeC_Role and Increment
        exec_map = {n: n for n in path_nodes}
        exec_map["END"] = END
        
        self.builder.add_conditional_edges("NodeC_Role", execute_router, exec_map)
        self.builder.add_conditional_edges("Increment", execute_router, exec_map)
        
        # After each worker node, increment the step
        for node in path_nodes:
            self.builder.add_edge(node, "Increment")
            
        # Compile graph, with human-in-the-loop interruption before NodeC_Role
        self.graph = self.builder.compile(
            checkpointer=self.memory,
            interrupt_before=["NodeC_Role"]
        )
        return self.graph
