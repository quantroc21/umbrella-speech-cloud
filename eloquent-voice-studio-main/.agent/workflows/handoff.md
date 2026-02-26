---
description: How to sync work and AI context between PC and Mac
---

# Multi-Device Handoff Workflow

Use this workflow when transitioning your work between your Windows PC and your MacBook.

## 1. When leaving PC (Windows)
1.  **Check Task Status**: Ensure all finished items in `.agent/task.md` are marked with `[x]`.
2.  **Commit Everything**: 
    ```bash
    git add .
    git commit -m "chore: sync progress - [brief summary of work]"
    git push
    ```
3.  **Note for Agent**: Tell the agent: "I'm heading out, I'll continue on my Mac."

## 2. When starting on Mac
1.  **Pull Changes**:
    ```bash
    git pull
    ```
2.  **Initialize Agent**: Simply mention to the Mac agent: "I'm back. Read `.agent/task.md` to see what's next."
3.  **Continue**: The agent will read the task list and pick up exactly where the PC agent left off.

## Notes for the AI Agent
- ALWAYS check `.agent/task.md` at the start of a session if it exists.
- DO NOT ignore the `.agent` folder in `.gitignore`.
- Update the shared `task.md` frequently so the other device stays in sync.
