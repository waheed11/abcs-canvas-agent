import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime

class DatabaseManager:
    def __init__(self, vault_path: str):
        self.vault_path = Path(vault_path)
        self.db_path = self.vault_path / "sessions.db"
        self._init_db()

    def _init_db(self):
        # Create database and tables if they don't exist
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create Sessions table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            vault_id TEXT,
            created_at TEXT
        )
        ''')
        
        # Create Tasks table (matching JSON schema)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            session_id TEXT,
            task_name TEXT,
            folder TEXT,
            main_agent TEXT,
            main_agent_version TEXT,
            timestamp TEXT,
            duration TEXT,
            input_nodes INTEGER,
            output_nodes INTEGER,
            atomics_created TEXT, -- JSON string
            user_exchanges INTEGER,
            status TEXT,
            sub_agents TEXT, -- JSON string
            FOREIGN KEY(session_id) REFERENCES sessions(session_id)
        )
        ''')
        
        conn.commit()
        conn.close()

    def create_session(self, session_id: str, vault_id: str = "main-vault-001"):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        created_at = datetime.utcnow().isoformat() + "Z"
        cursor.execute(
            'INSERT OR IGNORE INTO sessions (session_id, vault_id, created_at) VALUES (?, ?, ?)',
            (session_id, vault_id, created_at)
        )
        conn.commit()
        conn.close()
        return created_at

    def log_task(self, session_id: str, task_data: dict):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
        INSERT OR REPLACE INTO tasks (
            task_id, session_id, task_name, folder, main_agent, main_agent_version,
            timestamp, duration, input_nodes, output_nodes, atomics_created,
            user_exchanges, status, sub_agents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_data.get('taskId'),
            session_id,
            task_data.get('taskName'),
            task_data.get('folder'),
            task_data.get('mainAgent'),
            task_data.get('mainAgentVersion'),
            task_data.get('timestamp'),
            task_data.get('duration', '0 minutes'),
            task_data.get('inputNodes', 0),
            task_data.get('outputNodes', 0),
            json.dumps(task_data.get('atomicsCreated', {})),
            task_data.get('userExchanges', 0),
            task_data.get('status', 'in-progress'),
            json.dumps(task_data.get('subAgents', []))
        ))
        conn.commit()
        conn.close()

    def get_session(self, session_id: str):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions WHERE session_id = ?', (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return None
            
        cursor.execute('SELECT * FROM tasks WHERE session_id = ?', (session_id,))
        tasks = cursor.fetchall()
        
        result = dict(session)
        result['tasks'] = []
        for t in tasks:
            task_dict = dict(t)
            task_dict['atomics_created'] = json.loads(task_dict['atomics_created'])
            task_dict['sub_agents'] = json.loads(task_dict['sub_agents'])
            result['tasks'].append(task_dict)
            
        conn.close()
        return result

    def get_all_sessions(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions ORDER BY created_at DESC')
        sessions = cursor.fetchall()
        
        results = []
        for s in sessions:
            session_dict = dict(s)
            cursor.execute('SELECT * FROM tasks WHERE session_id = ? ORDER BY timestamp DESC', (session_dict['session_id'],))
            tasks = cursor.fetchall()
            session_dict['tasks'] = [dict(t) for t in tasks]
            results.append(session_dict)
            
        conn.close()
        return results
