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
                
    def get_tree(self, max_depth: int = 3):
        """Returns a recursive tree of the A, B, C, D, E folders for the UI.
        Scans up to max_depth levels deep so the UI shows the full vault hierarchy."""
        tree = []
        root_folders = ["A", "B", "C", "D", "E"]
        
        for root in root_folders:
            root_path = self.vault_path / root
            if not root_path.exists():
                continue
                
            node = self._scan_directory(root_path, root, current_depth=1, max_depth=max_depth)
            tree.append(node)
            
        return tree

    def _scan_directory(self, dir_path: Path, relative_path: str, current_depth: int, max_depth: int) -> dict:
        """Recursively scan a directory and return a tree node dict."""
        node = {
            "name": dir_path.name,
            "path": relative_path,
            "type": "directory",
            "children": []
        }
        
        if current_depth >= max_depth:
            return node
            
        try:
            for item in sorted(dir_path.iterdir()):
                if item.name.startswith('.'):
                    continue
                    
                if item.is_dir():
                    child_path = f"{relative_path}/{item.name}"
                    child_node = self._scan_directory(
                        item, child_path, 
                        current_depth=current_depth + 1, 
                        max_depth=max_depth
                    )
                    node["children"].append(child_node)
                elif item.is_file() and item.suffix == '.md':
                    # Include markdown files as leaf nodes
                    node["children"].append({
                        "name": item.stem,  # filename without extension
                        "path": f"{relative_path}/{item.name}",
                        "type": "file"
                    })
        except Exception as e:
            print(f"Error reading {dir_path}: {e}")
            
        return node
