import uuid
from orchestrator import Orchestrator

def run_debug():
    orchestrator = Orchestrator()
    graph = orchestrator.build_graph()
    
    config = {"configurable": {"thread_id": "debug_123"}}
    state = {
        "messages": [{"role": "user", "content": "C: B A"}],
        "task_id": "123",
        "trigger_type": "T",
        "proposed_path": [],
        "current_step": 0,
        "context": {},
        "user_feedback": ""
    }
    
    print("--- FIRST STREAM ---")
    events = graph.stream(state, config)
    for event in events:
        print(event)
        
    print("--- SNAPSHOT ---")
    snapshot = graph.get_state(config)
    print("Next nodes:", snapshot.next)
    
    print("--- RESUMING STREAM ---")
    events2 = graph.stream(None, config)
    for event in events2:
        print(event)

if __name__ == "__main__":
    run_debug()
