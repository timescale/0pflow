#!/bin/bash

# Run the 0pflow MCP server using the command from settings, or default to npx

SETTINGS_FILE="$HOME/.config/0pflow/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  # Read mcpCommand array from settings.json and execute it
  MCP_CMD=$(jq -r '.mcpCommand | join(" ")' "$SETTINGS_FILE")
  exec $MCP_CMD
else
  # No settings file - use default
  exec npx -y 0pflow@latest mcp start
fi
