# Agent Instructions

## Git workflow

- After completing and verifying a requested change, commit it promptly with a Conventional Commit and push the current branch to its configured upstream. Do not leave verified work uncommitted or unpushed unless the user explicitly asks otherwise.
- Before committing, run the relevant checks, inspect the diff, and include only files related to the task.

## Editing deployed files

- Edit files inside this repository, never through their `$HOME` paths. Stow deploys them as symlinks, and in-place tools such as `sed -i` or editors that write via rename replace the symlink with a regular copy that silently diverges from the repository.
- Track only files that people edit by hand. Files an application rewrites on its own (settings panels, bookmarks, lock files that are replaced rather than rewritten) stay local.

## Installing tools

- Do not drop binaries or scripts into `~/.local/bin`. Declare user-level CLIs in `mise/`, system programs in `system/portage/sets/dotfiles`, and self-authored scripts in the Stow package they belong to.
