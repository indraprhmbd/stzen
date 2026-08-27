# Documentation Tracker Rules

## Purpose

Single source of truth for all planning, research, and decision records. Each document captures a complete snapshot of work done, decisions made, and tradeoffs accepted. Future agents and developers read these docs to understand WHY the codebase is the way it is.

---

## File Naming

Format: `<plan-name><YYYY-MM-DD>.md`

Examples:
- `epic1-database-foundation2026-08-27.md`
- `research-drizzle-vs-prisma2026-08-27.md`
- `epic2-aes-encryption2026-08-28.md`

Rules:
- Lowercase, hyphens between words
- Date is creation date, not update date
- One document per plan, research topic, or epic
- If a plan spans multiple days, use the start date

---

## Content Rules

### Forbidden

- No emojis anywhere in the document
- No em dashes (--) or en dashes (-). Use commas, colons, or parentheses instead
- No hedging language ("might", "could potentially", "it seems like")
- No pleasantries, intros, or filler paragraphs
- No future-todo lists without context. Every item must state WHY it matters

### Required

- Every section must answer a question or state a decision
- Technical terms used exactly as they appear in docs (e.g., "AES-256-GCM", not "AES encryption")
- Version numbers stated explicitly (e.g., "drizzle-orm 0.45.2", not "latest drizzle")
- Code references use file paths and line numbers when relevant (e.g., "server/db/index.ts:12")
- Tradeoffs stated explicitly: "Chose X over Y because Z"

### Writing Style

- Sentence fragments OK
- Lead with the conclusion, then the reasoning
- One idea per paragraph
- Tables for comparing options
- Code blocks for patterns, not prose
- Compact means: every word carries information. If removing a word does not change meaning, remove it

---

## Document Structure

Every document must follow this skeleton:

```
# <Title>

## Context
What problem exists. What triggered this work. Constraints.

## Decisions
What was chosen and why. Alternatives considered. Tradeoffs accepted.

## Implementation
How it was built. Key patterns. File references.

## Open Questions
What remains unknown. What might change. What needs validation.
```

Not every section is mandatory. If a section has no content, omit it entirely. Do not write placeholder sections.

---

## Maintenance

- Create docs before or during implementation, not after
- Update docs when decisions change, not just when code changes
- One doc per epic or research thread. Do not merge unrelated topics
- Date stays fixed at creation. Do not update the date on edits
- If a doc becomes obsolete, add a "Deprecated" header with a redirect to its replacement. Do not delete

---

## Review Checklist

Before marking a doc complete:

- [ ] No emojis
- [ ] No em/en dashes
- [ ] Every decision has a rationale
- [ ] Every technical term matches official docs spelling
- [ ] Version numbers included for all dependencies mentioned
- [ ] File paths included for all code references
- [ ] Tradeoffs stated, not implied
