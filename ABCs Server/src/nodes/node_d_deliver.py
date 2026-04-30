"""
Node D: Deliver. Project/Article generation.
"""
import os
import logging
from typing import Any, Dict
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import D_FOLDER, OPENAI_API_KEY

logger = logging.getLogger(__name__)

def generate_delivery(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node D implementation: Generate Deliveries based on A and B context."""
    logger.info("Executing Node D: Deliver")
    context = state.get("context", {})
    task_id = state.get("task_id", "default_task")
    atomic_notes = context.get("atomic_notes", [])
    
    if not atomic_notes:
        logger.warning("No atomic notes found to build a delivery. Proceeding anyway.")
    
    # Format the wikilinks for the delivery
    wikilinks = "\\n".join([f"- [[{note['title']}]]" for note in atomic_notes])
    
    content = ""
    if OPENAI_API_KEY:
        try:
            llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
            prompt = PromptTemplate.from_template(
                "Write a short, engaging article based on the following concepts:\\n{concepts}\\n\\nInclude a 'References' section at the bottom containing exactly these wikilinks:\\n{links}"
            )
            concepts_text = "\\n".join([n.get("title", "") for n in atomic_notes])
            response = llm.invoke(prompt.format(concepts=concepts_text, links=wikilinks))
            content = response.content
        except Exception as e:
            logger.error(f"LLM delivery generation failed: {e}")
            content = f"Failed to generate delivery using LLM. Error: {e}\\n\\nReferences:\\n{wikilinks}"
    else:
        content = f"# Generated Delivery\\nThis is a mock delivery since OPENAI_API_KEY is not set.\\n\\n## References\\n{wikilinks}"
    
    # Ensure D directory exists
    if not os.path.exists(D_FOLDER):
        os.makedirs(D_FOLDER)
        
    filename = f"{task_id}_Delivery.md"
    file_path = os.path.join(D_FOLDER, filename)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    logger.info(f"Saved Delivery to {file_path}")
    
    return {"context": context}
