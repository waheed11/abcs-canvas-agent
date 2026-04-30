import os
import logging
from typing import Dict, Any
from config import C_FOLDER

logger = logging.getLogger(__name__)

def handle_role(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node C: Control. Save the user role and add it to context."""
    logger.info("Executing Node C: Role Setup")
    
    user_role = state.get("user_role", "").strip()
    if not user_role:
        user_role = "Default User"
        
    roles_file = os.path.join(C_FOLDER, "Roles.md")
    
    # Ensure C folder exists
    os.makedirs(C_FOLDER, exist_ok=True)
    
    # Check if role exists, if not, append it
    role_exists = False
    if os.path.exists(roles_file):
        with open(roles_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if f"- {user_role}" in content:
                role_exists = True
                
    if not role_exists:
        with open(roles_file, 'a', encoding='utf-8') as f:
            f.write(f"- {user_role}\n")
            
    # Add role to context for other nodes to use
    context = state.get("context", {})
    context["user_role"] = user_role
    
    return {"context": context}
