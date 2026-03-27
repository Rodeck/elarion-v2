---
description: Create a GitHub project issue with detailed description from a brief user input.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Create a well-structured GitHub issue on **Rodeck/elarion-v2** based on the user's description.

## Step 1: Evaluate Clarity

Before creating the issue, assess whether the input provides enough information to write a good issue. Consider:

- **Intent**: Is it clear whether this is a bug, feature, improvement, or refactor?
- **Scope**: Can you identify which systems/areas of the codebase are affected?
- **Desired outcome**: Is the end goal clear enough to write acceptance criteria?

**If the input is clear and specific** — proceed directly to Step 2.

**If the input is vague or ambiguous** — ask up to 3 short, targeted clarification questions. Examples:
- "Should this apply to the admin panel as well, or game UI only?"
- "Is this a new feature or fixing existing broken behavior?"
- "Any specific panels/screens you have in mind, or all of them?"

Do NOT ask questions that you can reasonably answer yourself using codebase knowledge. Only ask when the answer genuinely affects the issue scope or direction.

Wait for the user's answers before proceeding.

## Step 2: Create the Issue

Use the `mcp__github__issue_write` tool with:
- `method`: `"create"`
- `owner`: `"Rodeck"`
- `repo`: `"elarion-v2"`
- `title`: Concise, descriptive title (under 80 chars)
- `body`: See format below
- `labels`: Pick from: `enhancement`, `bug`, `ui`, `backend`, `frontend`, `admin`, `game-design`, `performance`, `documentation`

### Body Format

```markdown
## Summary
1-3 sentences explaining what needs to be done and why.

## Details
- Bullet points expanding on the scope
- Mention specific files, systems, or UI areas affected if identifiable
- Reference relevant tech (Phaser, WebSocket, PostgreSQL, etc.) where appropriate

## Acceptance Criteria
- [ ] Checklist of concrete, verifiable outcomes
```

## Step 3: Return Result

Return the created issue URL to the user.

## Guidelines

- Be specific to Elarion's architecture — reference actual systems (BuildingPanel, StatsBar, ChatBox, quest system, combat log, etc.) when relevant.
- Keep the issue proportional to the request — a small fix doesn't need 20 acceptance criteria.
- If it's a bug report, focus on reproduction steps and expected vs actual behavior.
- If it's a feature request, focus on user-facing behavior and scope boundaries.
- Use your knowledge of the codebase to add useful context the user didn't explicitly state.
- Don't over-engineer or pad the issue with generic filler.
