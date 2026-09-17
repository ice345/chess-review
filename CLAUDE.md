@AGENTS.md

# Claude Code

This repository uses Claude Code as an implementation and review agent.

## Destructive operations

Deletion requires explicit user approval.

Before deleting files or directories, always ask the user first.

This includes, but is not limited to:

- `rm`
- `rm -rf`
- `rmdir`
- `git rm`
- `git clean`
- `find -delete`
- deleting files through Python, Node.js, scripts, or other tools
- deleting generated assets or snapshots
- removing directories during cleanup

Do not interpret "clean up", "refactor", "remove unused code", or
"finish the task" as permission to delete files.

Moving or renaming a file is allowed when it preserves the content.

Overwriting/editing an existing file is allowed unless the operation
effectively removes the entire file or intentionally destroys data.

## Working style

For non-trivial work:

1. Inspect the current implementation, relevant documentation, and tests.
2. Verify assumptions against the current repository state.
3. Implement the smallest coherent change.
4. Run targeted verification while developing.
5. Run the relevant integration checks before finishing.
6. Inspect the final diff.
7. Report only checks that were actually run.

Do not stop after writing a plan when implementation was requested.

Do not create speculative architecture or planning documents unless they are
needed to preserve a real project decision.

Do not rewrite unrelated files.

If temporary files or diagnostic scripts are created during investigation,
remove them before finishing unless they have lasting project value.

## UI and visual work

Windowlight is the established production visual system, not a design proposal.

For meaningful changes to:

- layout
- CSS
- typography
- surfaces
- board appearance
- chess pieces
- responsive behavior
- visual identity

follow the `visual-acceptance` skill.

Do not treat screenshot-update success as visual acceptance.

Never regenerate Playwright visual baselines merely because they fail.
First determine whether the difference is an intentional accepted change or
a regression.

## Chess analysis work

For changes to chess-analysis semantics, follow the
`chess-analysis-change` skill.

Never silently change product semantics such as Accuracy, score POV,
game phases, move classification, Brilliant, Great, or human difficulty.
