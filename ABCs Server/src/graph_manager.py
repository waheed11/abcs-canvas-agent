"""
Neo4j and Graphiti interface for managing procedural memory and concepts.
"""
import os
import logging
from typing import Dict, Any, List
from neo4j import AsyncGraphDatabase
# Graphiti uses an async client
from graphiti_core import Graphiti
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY

logger = logging.getLogger(__name__)

class GraphManager:
    def __init__(self):
        self.uri = NEO4J_URI
        self.user = NEO4J_USER
        self.password = NEO4J_PASSWORD
        self.driver = None
        self.graphiti = None

    async def connect(self):
        """Initialize Neo4j driver and Graphiti client."""
        try:
            self.driver = AsyncGraphDatabase.driver(
                self.uri, auth=(self.user, self.password)
            )
            # Initialize Graphiti with Neo4j URL
            os.environ["NEO4J_URI"] = self.uri
            os.environ["NEO4J_USER"] = self.user
            os.environ["NEO4J_PASSWORD"] = self.password
            if OPENAI_API_KEY:
                # Graphiti requires an LLM provider for the semantic routing
                self.graphiti = Graphiti()
                logger.info("Successfully connected to Neo4j and initialized Graphiti.")
            else:
                logger.warning("OPENAI_API_KEY not found. Graphiti features disabled. Proceeding with standard Neo4j.")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            raise

    async def close(self):
        """Safely close connections."""
        if self.driver:
            await self.driver.close()

    async def create_task_node(self, task_id: str, trigger: str, path: str):
        """Create a Task node in the procedural memory graph."""
        query = """
        MERGE (t:Task {id: $task_id})
        SET t.trigger = $trigger,
            t.path = $path,
            t.timestamp = datetime(),
            t.status = 'STARTED'
        RETURN t
        """
        async with self.driver.session() as session:
            result = await session.run(query, task_id=task_id, trigger=trigger, path=path)
            return await result.single()

    async def ingest_atomic_node(self, concept_type: str, title: str, content: str):
        """Ingest an Atomic concept using Graphiti for deeper semantic extraction."""
        # Using Graphiti for semantic extraction and adding temporal awareness
        if self.graphiti:
            # Graphiti automatically handles extraction and semantic linking
            await self.graphiti.add_episode(
                name=title,
                content=content,
            )
        
        # We also manually create a structured node for explicit pathing
        query = """
        MERGE (a:Atomic {title: $title})
        SET a.type = $concept_type,
            a.content = $content
        RETURN a
        """
        async with self.driver.session() as session:
            await session.run(query, title=title, concept_type=concept_type, content=content)

    async def link_nodes(self, from_label: str, from_key: str, from_val: str, 
                         to_label: str, to_key: str, to_val: str, relationship: str):
        """Create an explicit edge between two nodes."""
        query = f"""
        MATCH (a:{from_label} {{{from_key}: $from_val}})
        MATCH (b:{to_label} {{{to_key}: $to_val}})
        MERGE (a)-[r:{relationship}]->(b)
        RETURN r
        """
        async with self.driver.session() as session:
            await session.run(query, from_val=from_val, to_val=to_val)

    async def create_evaluation_node(self, eval_type: str, scope: str, content: str, score: float):
        """Create an Evaluation node."""
        query = """
        CREATE (e:Evaluation {
            type: $eval_type,
            scope: $scope,
            content: $content,
            score: $score,
            timestamp: datetime()
        })
        RETURN e
        """
        async with self.driver.session() as session:
            result = await session.run(query, eval_type=eval_type, scope=scope, content=content, score=score)
            return await result.single()

    async def retrieve_context(self, query_str: str) -> str:
        """Context retrieval function leveraging Graphiti and Neo4j."""
        context_parts = []
        
        if self.graphiti:
            # Query the GraphRAG memory
            search_results = await self.graphiti.search(query_str)
            if search_results:
                context_parts.append(f"Semantic Context:\\n{search_results}")
                
        # Query procedural memory (recent tasks)
        query = """
        MATCH (t:Task)-[r]->(n)
        WHERE t.timestamp >= datetime() - duration('P7D')
        RETURN t.id as task, type(r) as relation, labels(n)[0] as node_type
        ORDER BY t.timestamp DESC LIMIT 5
        """
        async with self.driver.session() as session:
            result = await session.run(query)
            records = await result.data()
            if records:
                context_parts.append(f"Recent Procedural Context:\\n{records}")
                
        return "\\n\\n".join(context_parts)
