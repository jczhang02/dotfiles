#!/usr/bin/python3
"""Regenerate the emerge option specs in _portage from the installed Portage.

Portage's option tables in _emerge/main.py are the source of truth: `options`
(plain flags), `shortmapping`, the action set, `argument_options` (help text,
choices) and `default_arg_opts` (options whose value is optional). Flags that
carry no help text there get the first sentence of their emerge(1) entry.

Usage: ./gen-emerge-options.py [path/to/_portage]
"""

import ast
import re
import subprocess
import sys
from pathlib import Path

import _emerge.main

BEGIN = "  # BEGIN GENERATED emerge options (gen-emerge-options.py)"
END = "  # END GENERATED emerge options"

# Optional numeric values: Portage also takes them as the next word, and a
# number cannot be mistaken for a package, so complete both forms.
NUMERIC_OPTIONAL = {"--deep", "--jobs", "--load-average", "--jobs-tmpdir-require-free-gb"}

# Argument actions for options whose values Portage does not enumerate.
ATOMS = "_gentoo_packages available"
VALUE_ACTIONS = {
    "--accept-properties": "properties:",
    "--accept-restrict": "restrictions:",
    "--backtrack": "count:(0 10 20 30 50 100)",
    "--buildpkg-exclude": "atom:" + ATOMS,
    "--config-root": "directory:_files -/",
    "--deep": "depth:",
    "--exclude": "atom:" + ATOMS,
    "--getbinpkg-exclude": "atom:" + ATOMS,
    "--getbinpkg-include": "atom:" + ATOMS,
    "--jobs": "jobs:_emerge_jobs",
    "--jobs-tmpdir-require-free-gb": "GB:",
    "--load-average": "load:",
    "--pkg-format": "format:(gpkg xpak)",
    "--prefix": "directory:_files -/",
    "--quickpkg-direct-root": "directory:_files -/",
    "--rebuild-exclude": "atom:" + ATOMS,
    "--rebuild-ignore": "atom:" + ATOMS,
    "--rebuilt-binaries-timestamp": "timestamp:",
    "--reinstall": "reinstall:(changed-use)",
    "--reinstall-atoms": "atom:" + ATOMS,
    "--root": "directory:_files -/",
    "--search-similarity": "percentage:",
    "--sync-submodule": "submodule:(glsa news profiles)",
    "--sysroot": "directory:_files -/",
    "--useoldpkg-atoms": "atom:" + ATOMS,
    "--usepkg-exclude": "atom:" + ATOMS,
    "--usepkg-include": "atom:" + ATOMS,
}


def literal(node):
    """Evaluate a literal node, resolving the y/n tuple names Portage uses."""
    names = {
        "y_or_n": ("y", "n"),
        "true_y_or_n": ("True", "y", "n"),
        "true_y": ("True", "y"),
    }
    if isinstance(node, ast.Name):
        return names.get(node.id)
    try:
        return ast.literal_eval(node)
    except ValueError:
        return None


def portage_tables():
    tree = ast.parse(Path(_emerge.main.__file__).read_text())
    tables = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue
            name = target.id
            if name in ("options", "shortmapping"):
                tables[name] = ast.literal_eval(node.value)
            elif name == "actions" and isinstance(node.value, ast.Call):
                tables[name] = ast.literal_eval(node.value.args[0])
            elif name in ("default_arg_opts", "argument_options"):
                table = {}
                for key, value in zip(node.value.keys, node.value.values):
                    key = ast.literal_eval(key)
                    if name == "default_arg_opts":
                        table[key] = True
                        continue
                    entry = {}
                    for k, v in zip(value.keys, value.values):
                        k = ast.literal_eval(k)
                        if k == "help":
                            entry[k] = help_text(v)
                        elif k in ("shortopt", "choices", "action"):
                            entry[k] = literal(v)
                    table[key] = entry
                tables[name] = table
    return tables


def help_text(node):
    """Help strings are sometimes built with + or implicit concatenation."""
    if isinstance(node, ast.BinOp):
        return help_text(node.left) + help_text(node.right)
    value = literal(node)
    return value if isinstance(value, str) else ""


def man_summaries():
    """First sentence of each option's emerge(1) entry, keyed by long option."""
    text = subprocess.run(
        ["man", "emerge"],
        env={"MANPAGER": "cat", "MANWIDTH": "1000", "PATH": "/usr/bin:/bin"},
        capture_output=True, text=True, check=False,
    ).stdout
    text = re.sub(r".\x08", "", text)
    summaries, current, body = {}, None, []
    for line in text.splitlines():
        header = re.match(r"^ {7}(?:-\w \[?\w*\]?, )?(--[a-z0-9-]+)", line)
        if header:
            if current and body:
                summaries.setdefault(current, " ".join(body))
            current, body = header.group(1), []
            # Some entries put the description on the header line itself.
            rest = line.strip().split(None, 1)
            if len(rest) == 2 and not re.match(r"^([\[<=,-]|[A-Z_]+(\s|,|$))", rest[1]):
                body.append(rest[1])
        elif current and line.startswith(" " * 14) and line.strip():
            body.append(line.strip())
        elif current and not line.strip() and body:
            summaries.setdefault(current, " ".join(body))
            current, body = None, []
    return {opt: first_sentence(desc) for opt, desc in summaries.items()}


def first_sentence(desc, limit=110):
    desc = re.sub(r"\s+", " ", desc).strip()
    desc = re.sub(r"\b(e\.g|i\.e|etc)\.", lambda m: m.group(1) + "\0", desc)
    desc = re.split(r"(?<=[a-z0-9)\"'])\.(\s|$)", desc, maxsplit=1)[0]
    desc = desc.replace("\0", ".").rstrip(".")
    if len(desc) > limit:
        desc = desc[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "..."
    return desc


def esc(desc):
    desc = first_sentence(desc)
    desc = desc[:1].upper() + desc[1:]
    return desc.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]").replace("'", "'\\''")


def main():
    target = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("_portage"))
    t = portage_tables()
    man = man_summaries()
    short_of = {v: "-" + k for k, v in t["shortmapping"].items()}
    for opt, entry in t["argument_options"].items():
        if entry.get("shortopt"):
            short_of[opt] = entry["shortopt"]

    specs = []

    def add(opt, desc, eq="", argspec=""):
        desc = esc(desc or man.get(opt, ""))
        short = short_of.get(opt)
        if short:
            # Complete the short form as a plain flag: an optional value in the
            # next word is indistinguishable from a package argument.
            specs.append(f"'({short} {opt}){short}[{desc}]'")
            specs.append(f"'({short} {opt}){opt}{eq}[{desc}]{argspec}'")
        else:
            specs.append(f"'{opt}{eq}[{desc}]{argspec}'")

    for opt in sorted(set(t["options"]) - set(t["argument_options"])):
        add(opt, "")
    for action in sorted(t["actions"]):
        opt = "--" + action
        if opt in t["argument_options"]:
            continue
        add(opt, "")
    for opt, entry in sorted(t["argument_options"].items()):
        choices = [c for c in (entry.get("choices") or ()) if c != "True"]
        action = VALUE_ACTIONS.get(opt)
        if not action:
            label = "yes/no" if choices == ["y", "n"] else "value"
            action = f"{label}:(" + " ".join(choices) + ")" if choices else "value:"
        if opt in NUMERIC_OPTIONAL:
            add(opt, entry.get("help", ""), "=", "::" + action)  # --opt[=N] or --opt N
        elif opt in t["default_arg_opts"]:
            add(opt, entry.get("help", ""), "=-", "::" + action)  # only as --opt=value
        else:
            add(opt, entry.get("help", ""), "=", ":" + action)  # --opt=value or --opt value

    block = [BEGIN, "  local -a emerge_opts=("]
    block += ["    " + s for s in specs]
    block += ["  )", END]

    source = target.read_text()
    start, end = source.index(BEGIN), source.index(END) + len(END)
    target.write_text(source[:start] + "\n".join(block) + source[end:])
    print(f"{target}: {len(specs)} specs")


if __name__ == "__main__":
    main()
