"""
Node A: Atomic. Markdown parsing to Concept/Principle/Method/Pattern.
"""
import os
import logging
from datetime import datetime
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import A_FOLDER, OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Setup Jinja environment
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')
jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def parse_to_atomic(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node A implementation: Generate A-level .md files using jinja2."""
    logger.info("Executing Node A: Atomic")
    context = state.get("context", {})
    source_data = context.get("source_data", {})
    task_id = state.get("task_id", "default_task")
    user_role = context.get("user_role", "Default User")
    
    if not source_data:
        logger.warning("No source data found in context. Skipping Node A.")
        return state

    # Extract info for template
    title = source_data.get("title", "Untitled Concept")
    content = source_data.get("description", source_data.get("content", ""))
    url = source_data.get("url", "")
    
    # In a full implementation, we would use ChatOpenAI to split the content
    # into multiple atomic concepts based on semantic chunking.
    # For now, we will map the core source to a single atomic concept.
    
    concept_type = "Concept" # Default type
    
    if OPENAI_API_KEY:
        try:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
            prompt = PromptTemplate.from_template(
                "Adopt this role: {user_role}. Filter your data extraction purely through the lens of this role.\n"
                "Extract the core concepts, methodologies, or patterns from the text below.\n"
                "You must write a highly comprehensive, detailed explanation including core principles, mechanics, and deep insights derived from the text.\n"
                "Identify if the primary extraction is a Concept, Principle, Method, or Pattern.\n"
                "Text: {text}\n"
                "Respond strictly in this format separated by a pipe (|):\n"
                "Type|Title|Detailed Markdown Description"
            )
            response = llm.invoke(prompt.format(user_role=user_role, text=content))
            parts = response.content.split('|', maxsplit=2)
            if len(parts) >= 3:
                concept_type = parts[0].strip()
                title = parts[1].strip()
                content = parts[2].strip()
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
    
    template = jinja_env.get_template('atomic.md.j2')
    rendered_md = template.render(
        type=concept_type,
        source_url=url,
        timestamp=datetime.now().isoformat(),
        title=title,
        description=content,
        content=content,
        source_id=task_id
    )
    
    # Determine subfolder
    valid_types = {"Concept": "Concepts", "Principle": "Principles", "Method": "Methods", "Pattern": "Patterns"}
    # Normalize the extracted type just in case
    folder_name = "Concepts"
    for k, v in valid_types.items():
        if k.lower() in concept_type.lower():
            folder_name = v
            break
            
    sub_folder = os.path.join(A_FOLDER, "Atomics", folder_name)
    os.makedirs(sub_folder, exist_ok=True)
        
    safe_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
    filename = f"{task_id}_{safe_title.replace(' ', '_')}.md"
    file_path = os.path.join(sub_folder, filename)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(rendered_md)
        
    logger.info(f"Saved Atomic note to {file_path}")
    
    # Record in context for downstream Delivery/Eval nodes
    if "atomic_notes" not in context:
        context["atomic_notes"] = []
    context["atomic_notes"].append({"title": title, "path": file_path, "type": concept_type})
    
    return {"context": context}
