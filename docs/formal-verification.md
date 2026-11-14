# Formal verification with Logos: the workflow

Status: being built on a first project (a SAS to Python migration). What is marked *run* has been
run there; the rest is design.

## The idea

A migration is three runs of this kit, tied together by proof:

| Migration | Judge |
|---|---|
| legacy to port | run both programs, compare the output files |
| legacy to Lean | evaluate the Lean on real rows, compare with what the legacy code produced |
| port to Lean | evaluate the Lean on real rows, compare with what the port produced |

The Lean lives in Logos blueprints, never in files. The proofs show (1) that the legacy code
meets the documented requirements, after correcting it where it does not, and (2) that the port
equals the corrected legacy code. The port then meets the requirements without proving them twice.

## Stages

| # | Stage | Workflow | Status |
|---|---|---|---|
| 1 | Requirements: documentation to formal requirements, proved consistent | `workflows/stage-1-requirements.js`, `stage-1-requirements-update.js` | run |
| 2 | Legacy meets requirements: one contract per requirement, proved or disproved | `workflows/stage-2-legacy-intent.js` | written, not yet run |
| 3 | Legacy corrected on the disproofs; legacy Lean re-translated; loop to 2 | | design |
| 4 | Legacy to port (the kit's own steps) | | run by hand, before this workflow existed |
| 5 | Port equals legacy: contracts proved or disproved; port fixed; loop | | run by hand, five rounds |
| 6 | Audit and write-up | | design |

The stage workflows are to be called from one master workflow, so the whole migration has one
progress view.

## Agents and isolation

Every agent is a sub-agent of the orchestrator's session, launched by a workflow with a named
role (`agents/`). One project-level hook (`hooks/guard.py`, rules in `roles.json`) runs before
every tool call of every sub-agent and applies its role's rule: which project files it may read
and write, which blueprints it may not open. A sub-agent with no role gets the strictest rule.
This is what keeps the two Lean translations independent. Verified on the first project: a named
role is allowed its side and blocked from the other; an agent with no role is blocked from both.

Facts learned the hard way:

- Agent definitions are registered when the session starts: reload after adding them.
- Workflow agents cannot write report files; they return text and the orchestrator saves it.
- A restricted role's shell commands must start in its own folder, and it may not use git; the
  hook checks command text, so the orchestrator still scans transcripts afterwards.
- `/workflows` (the live view of phases, agents and their tool calls) is in the terminal CLI; the
  VS Code panel shows only the agent count. Run the orchestrator in the terminal.

## Human gates

A workflow cannot ask a question mid-run. A gate is a stop: the workflow returns what needs
deciding, the orchestrator puts it to the owner, and relaunches the same run with the answer;
steps already done replay from cache (verified with `workflows/gate-resume-test.js`). Gate answers
steer the script only; no agent is asked to assert an approval.

| Gate | The owner decides |
|---|---|
| Rulings | each contradiction or silence in the documentation |
| Requirements sign-off | that the formal requirements say what the documents mean |
| Legacy corrections | each change to the legacy code, before it is made |
| Defect options | where a fix has more than one defensible form |
| Final sign-off | the audit; then Logos validation and finalisation |

## Profile operations

A profile holds a copy of a blueprint, not a live view. Today the owner does these on Logos:

1. the shared foundation in the profile of every blueprint, before it is created;
2. the requirements blueprint pinned to the legacy blueprint, once consistency is proved;
3. the legacy blueprint pinned to the port blueprint, once every requirement is proved on it;
4. a refresh downstream after any upstream change, in that order.

Each stage workflow starts with a check agent that confirms the profile is visible and current,
and stops with a message if it is not. When Logos automates these operations the check stays and
the gate becomes a tool call.

## Still to write

- The master workflow.
- A Lean-target document: how each kit step applies when the target is a blueprint.
- Language skills (what a unit is, how to run the code, the gap checklist, the Lean shape,
  settled semantics with evidence): SAS and Python/polars first.
- An install step that puts workflows, agents and hook into a project.
