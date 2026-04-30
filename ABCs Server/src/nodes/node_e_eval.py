"""
Node E: Evaluate. Quizzes & Audit logic.
"""
import os
import logging
from typing import Any, Dict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config import E_FOLDER, OPENAI_API_KEY

logger = logging.getLogger(__name__)

def evaluate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Node E implementation: Generate Evaluations (quizzes) based on context."""
    logger.info("Executing Node E: Evaluate")
    context = state.get("context", {})
    task_id = state.get("task_id", "default_task")
    atomic_notes = context.get("atomic_notes", [])
    
    wikilinks = "\\n".join([f"- [[{note['title']}]]" for note in atomic_notes])
    
    content = ""
    if OPENAI_API_KEY:
        try:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
            prompt = PromptTemplate.from_template(
                "Generate a 3-question multiple choice quiz to test understanding of the following concepts:\\n{concepts}\\n\\nInclude an Answer Key at the bottom, and end with these references:\\n{links}"
            )
            concepts_text = "\\n".join([n.get("title", "") for n in atomic_notes])
            response = llm.invoke(prompt.format(concepts=concepts_text, links=wikilinks))
            content = response.content
        except Exception as e:
            logger.error(f"LLM evaluation generation failed: {e}")
            content = f"Failed to generate evaluation. Error: {e}\\n\\nReferences:\\n{wikilinks}"
    else:
        content = f"# Knowledge Check\\n(Mock quiz since OPENAI_API_KEY is not set)\\n\\nQ1: What is the main takeaway?\\nA) Yes\\nB) No\\n\\n## References\\n{wikilinks}"
    
    # Ensure E directory exists
    if not os.path.exists(E_FOLDER):
        os.makedirs(E_FOLDER)
        
    filename = f"{task_id}_Evaluation.md"
    file_path = os.path.join(E_FOLDER, filename)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    logger.info(f"Saved Evaluation to {file_path}")
    
    return {"context": context}
