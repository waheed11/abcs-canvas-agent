import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class VaultManager:
    def __init__(self):
        self.vault_path = Path(os.getenv("PRIMARY_VAULT_PATH", "./test_vault"))
        # Ensure base directories exist if we are mocking locally
        if not self.vault_path.exists():
            self.vault_path.mkdir(parents=True, exist_ok=True)
            for folder in ["A", "B", "C", "D", "E"]:
                (self.vault_path / folder).mkdir(exist_ok=True)
                
    def get_tree(self):
        """Returns a simplified tree of the A, B, C, D, E folders for the UI"""
        tree = []
        root_folders = ["A", "B", "C", "D", "E"]
        
        for root in root_folders:
            root_path = self.vault_path / root
            if not root_path.exists():
                continue
                
            node = {
                "name": root,
                "path": root,
                "type": "directory",
                "children": []
            }
            
            # Simple 1-level deep scan for UI display
            try:
                for item in sorted(root_path.iterdir()):
                    if item.is_dir() and not item.name.startswith('.'):
                        node["children"].append({
                            "name": item.name,
                            "path": f"{root}/{item.name}",
                            "type": "directory"
                        })
            except Exception as e:
                print(f"Error reading {root_path}: {e}")
                
            tree.append(node)
            
        return tree
