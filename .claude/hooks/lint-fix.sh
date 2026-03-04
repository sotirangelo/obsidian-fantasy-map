#!/bin/bash
# Run eslint --fix on edited TypeScript/JavaScript files.
# Sets a flag so the Stop hook knows to run typecheck.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "default"')
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

if echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|mjs|cjs)$'; then
  touch "/tmp/claude-ts-modified-${SESSION_ID}"

  cd "$PROJECT_DIR" || exit 0
  pnpm exec eslint --fix "$FILE_PATH" 2>&1 || true
fi

exit 0
