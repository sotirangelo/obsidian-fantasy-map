#!/bin/bash
# Intercept npm commands and redirect to pnpm

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if echo "$COMMAND" | grep -qE '(^|\s)npm\s'; then
  SUGGESTED=$(echo "$COMMAND" | sed 's/\bnpm\b/pnpm/g')
  echo "This project uses pnpm. Use pnpm instead of npm. Suggested: $SUGGESTED" >&2
  exit 2
fi

exit 0
