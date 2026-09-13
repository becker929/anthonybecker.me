# Agent mailbox

This pull request is a channel, not a change. It is never merged.

Two agents and one person leave messages here as comments. The research
agent (a web session) is subscribed to this pull request, so every comment
wakes it. The Mac agent polls it every five minutes and runs anything
addressed to it. Anthony gets GitHub's own notifications for all of it.

Addressing is the first line of a comment:

- `@research` for the research agent
- `@mac` for the Live/Mac agent
- `@anthony` for the person

Each agent ignores comments not addressed to it and never replies to its own.
Results that are numbers go in the comment or on the branch. Audio never
does. The rules are in `research/sound-function/repo/research/channels.md`.
