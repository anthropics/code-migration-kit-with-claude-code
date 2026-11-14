#!/usr/bin/env python3
"""Role isolation for the migration's agents (PreToolUse hook, project level).

Every sub-agent runs in the orchestrator's session, so one hook decides what each may touch.
The hook is told the calling agent's type; roles.json says, per type, which project files it
may read and write and which Logos blueprints it may not open. A sub-agent of any other type
gets the strictest rule ("*"). The main session (the orchestrator) is not restricted.
Exit 2 blocks the call and shows the reason to the agent.
"""
import fnmatch, json, os, re, sys

ev = json.load(sys.stdin)
role_name = ev.get("agent_type")
if not role_name and not ev.get("agent_id"):
    sys.exit(0)  # main session


def main():
    here = os.path.dirname(os.path.realpath(__file__))
    project = os.path.dirname(os.path.dirname(here))
    cfg = json.load(open(os.path.join(here, "roles.json")))
    role = cfg["roles"].get(role_name) or cfg["roles"]["*"]
    label = role_name if role_name in cfg["roles"] else f"{role_name or 'unnamed agent'} (no role)"
    copies = [os.path.realpath(os.path.join(project, p)) for p in cfg.get("legacy_copies_outside", [])]
    denied_bp = {v for k in role["deny_blueprints"] for v in cfg["blueprints"][k]}
    open_read = role["read"] == ["**"]
    home = os.path.join(project, role["home"]) if role.get("home") else None
    tool = ev.get("tool_name", "")
    ti = ev.get("tool_input") or {}
    cwd = ev.get("cwd") or project

    def inside(p, root):
        return p == root or p.startswith(root + os.sep)

    def rel_of(p, base):
        p = os.path.expandvars(os.path.expanduser(p))
        r = os.path.realpath(p if os.path.isabs(p) else os.path.join(base, p))
        for c in copies:  # a copy of the legacy code outside the project counts as legacy/
            if inside(r, c):
                return "legacy/" + os.path.relpath(r, c) if r != c else "legacy"
        if not inside(r, project):
            return None
        return "" if r == project else os.path.relpath(r, project)

    def allowed(rel, pats):
        return any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(rel + "/x", p) for p in pats)

    def bad(p, write, base=None):
        rel = rel_of(p, base or cwd)
        if rel is None:
            return None  # outside the project: not this hook's concern
        if rel == ".claude" or rel.startswith(".claude/"):
            return "the project's .claude folder is off limits" if write or not open_read else None
        if rel == ".git" or rel.startswith(".git/"):
            return None if open_read else "the repository's history is off limits for this role"
        if write:
            return None if allowed(rel, role["write"]) else f"this role may not write {rel or 'the project root'}"
        return None if allowed(rel, role["read"]) else f"this role may not read {rel or 'the whole project'}"

    reasons = []
    if tool in ("Edit", "Write", "NotebookEdit"):
        p = ti.get("file_path") or ti.get("notebook_path")
        if p:
            reasons.append(bad(p, True))
    elif tool == "Read":
        if ti.get("file_path"):
            reasons.append(bad(ti["file_path"], False))
    elif tool in ("Grep", "Glob"):
        reasons.append(bad(ti.get("path") or ".", False))
        v = (ti.get("pattern") if tool == "Glob" else ti.get("glob")) or ""
        if v.startswith(("/", "~")) or ".." in v:
            reasons.append(bad(re.split(r"[*?\[{]", v)[0] or ".", False))
    elif tool == "Bash":
        cmd = ti.get("command") or ""
        words = [t for t in re.split(r"""[\s'"`;|&()<>=,:]+""", cmd) if t]
        base = cwd
        if not open_read:
            if home is None:
                reasons.append("this agent has no role, so it may not run shell commands here")
            else:
                m = re.match(r"""\s*cd\s+["']?([^\s"';&|]+)["']?\s*&&""", cmd)
                target = os.path.realpath(os.path.join(cwd, os.path.expanduser(m.group(1)))) if m else None
                if not target or not inside(target, os.path.realpath(home)):
                    reasons.append(f'shell commands of this role must start with: cd "{home}" &&')
                else:
                    base = target
                if "git" in words:
                    reasons.append("this role may not use git")
        for t in words:
            if t == ".." or "/" in t or t.startswith("~") or t.startswith(".claude"):
                reasons.append(bad(re.split(r"[*?\[{]", t)[0] or ".", ".claude" in t, base))
    elif tool.startswith("mcp__"):
        hit = [v for v in ti.values() if isinstance(v, str) and v in denied_bp]
        if hit:
            reasons.append(f"blueprint {hit[0]} is not for this role")
    reasons = [r for r in reasons if r]
    if reasons:
        print(f"Blocked by the isolation rule for {label}: {reasons[0]}. "
              "This is deliberate; do not work around it.", file=sys.stderr)
        sys.exit(2)


try:
    main()
except SystemExit:
    raise
except Exception as e:  # a sub-agent call the hook cannot judge is blocked
    print(f"Isolation hook failed ({e}); call blocked.", file=sys.stderr)
    sys.exit(2)
