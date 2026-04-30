#!/bin/bash

echo "Welcome to the ABCs Agent Installation!"
echo "----------------------------------------"

# Ask for Obsidian vault path (optional)
echo "The ABCs Agent works with a 5-folder workspace (A, B, C, D, E)."
echo "If you use Obsidian, we can create these folders inside your vault."
echo "If not, we will create them in a standalone local directory."
read -p "Enter the absolute path to your Obsidian vault (leave empty if you do not use Obsidian or want to configure later): " OBSIDIAN_PATH

if [ -z "$OBSIDIAN_PATH" ]; then
    WORKSPACE_ROOT="$HOME/abcs-workspace"
    echo "No Obsidian path provided. Creating local workspace at: $WORKSPACE_ROOT"
else
    # Validate the path exists
    if [ ! -d "$OBSIDIAN_PATH" ]; then
        echo "Warning: Directory $OBSIDIAN_PATH does not exist. Falling back to local workspace."
        WORKSPACE_ROOT="$HOME/abcs-workspace"
    else
        WORKSPACE_ROOT="$OBSIDIAN_PATH"
        echo "Using Obsidian vault at: $WORKSPACE_ROOT"
    fi
fi

# Create the ABCs workspace folders
for dir in A B C D E; do
    mkdir -p "$WORKSPACE_ROOT/$dir"
    echo "Created: $WORKSPACE_ROOT/$dir"
done

# Save the configuration for the agent to use
CONFIG_DIR="$HOME/.abcs-agent"
mkdir -p "$CONFIG_DIR"
cat <<EOF > "$CONFIG_DIR/config.env"
WORKSPACE_ROOT="$WORKSPACE_ROOT"
EOF

echo "Configuration saved to $CONFIG_DIR/config.env"

echo ""
echo "Installation complete!"
echo "Your workspace folders (A, B, C, D, E) are ready at $WORKSPACE_ROOT."
echo "You can now start the ABCs Agent."
