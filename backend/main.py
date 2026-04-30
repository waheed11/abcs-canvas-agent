import os
import json
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

from database import DatabaseManager
from vault_manager import VaultManager
from agents.factory import AgentFactory

load_dotenv()

app = FastAPI(title="ABCs Canvas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vault_manager = VaultManager()
# Get primary vault path from env, initialize DB there
primary_vault = os.getenv("PRIMARY_VAULT_PATH", "./test_vault")
db = DatabaseManager(primary_vault)

@app.get("/")
def read_root():
    return {"status": "Backend is running"}

@app.get("/api/vault/tree")
def get_vault_tree():
    return {"tree": vault_manager.get_tree()}

@app.get("/api/sessions")
def get_sessions():
    return {"sessions": db.get_all_sessions()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Send initial connection success and active agent info
    agent = AgentFactory.get_agent("mock")  # Start with mock for UI testing
    agent_info = agent.get_info()
    
    await websocket.send_text(json.dumps({
        "type": "system",
        "message": f"Connected to Backend. Active Agent: {agent_info['name']} v{agent_info['version']}"
    }))
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"Received event: {message}")
            
            if message.get("type") == "node_drop":
                folder = message.get("folder")
                session_id = message.get("sessionId", "temp-session")
                task_id = message.get("taskId", "temp-task")
                
                # Acknowledge drop
                await websocket.send_text(json.dumps({
                    "type": "chat",
                    "sender": "System",
                    "message": f"Node dropped into {folder}. Agent is processing..."
                }))
                
                # Execute via Agent
                result = agent.execute_task({"folder": folder})
                
                # Log to DB
                task_data = {
                    "taskId": task_id,
                    "taskName": f"Extract: {folder}",
                    "folder": folder,
                    "mainAgent": agent_info['name'],
                    "mainAgentVersion": agent_info['version'],
                    "status": result["status"],
                    "atomicsCreated": result.get("atomicsCreated", {}),
                    "outputNodes": result.get("outputNodes", 0)
                }
                db.create_session(session_id)
                db.log_task(session_id, task_data)
                
                # Send result back to UI
                await websocket.send_text(json.dumps({
                    "type": "chat",
                    "sender": agent_info['name'],
                    "message": result["message"]
                }))
                
                await websocket.send_text(json.dumps({
                    "type": "canvas_update",
                    "action": "add_nodes",
                    "nodes": result.get("outputNodes", 0),
                    "atomics": result.get("atomicsCreated", {})
                }))
                
            else:
                # Echo back for regular chat
                await websocket.send_text(json.dumps({
                    "type": "chat",
                    "sender": "System",
                    "message": f"Received: {message.get('text', '')}"
                }))
                
    except Exception as e:
        print(f"WebSocket connection closed: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
