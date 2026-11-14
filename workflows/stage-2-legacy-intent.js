export const meta = {
  name: 'stage-2-legacy-intent',
  description: 'Stage 2: state every documented requirement as a contract on the legacy code, prove or disprove each, verify the disproofs, and return the findings for the legacy code',
  phases: [
    { title: 'Check', detail: 'requirements profile visible and current from the legacy blueprint' },
    { title: 'Assemble', detail: 'the legacy program as a pipeline, reviewed independently' },
    { title: 'State', detail: 'one contract per requirement' },
    { title: 'Prove', detail: 'each contract proved or disproved' },
    { title: 'Verify', detail: 'each disproof checked by an agent that did not write it' },
    { title: 'Report', detail: 'report and findings returned to the orchestrator' },
  ],
}
// args: { brief, legacyBlueprint, requirementsBlueprint, requirements: ['Q1',...], profileProbe: ['CreditRisk.Q27', ...], batch }
const A = args || {}
const T = 'prover'
const REQS = A.requirements || []
const BATCH = A.batch || 4
const COMMON = `Your brief is ${A.brief}: read it first. Legacy blueprint id ${A.legacyBlueprint}; requirements blueprint id ${A.requirementsBlueprint} (pinned as a profile of the legacy blueprint). You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents, do not write files (return text), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead. Use the Logos MCP Staging connector only and open blueprints by id.`

phase('Check')
log('Check: is the requirements profile visible and current from the legacy blueprint?')
const check = await agent(`${COMMON}

STEP: profile check only. From the legacy blueprint, check that these names from the requirements blueprint resolve (check_decl from any item, or a throwaway item you then remove): ${JSON.stringify(A.profileProbe)}. Then compare with the requirements blueprint itself (get_items there): for each name, is the Lean seen through the profile the same as the current accepted statement? A profile holds a copy and can be stale. Leave the legacy blueprint exactly as you found it.`,
  { label: 'profile visible and fresh?', phase: 'Check', agentType: T, schema: { type: 'object', properties: {
    visible: { type: 'boolean' }, fresh: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['visible', 'fresh', 'evidence'] } })
if (!check || !check.visible || !check.fresh) {
  log('STOP: the requirements profile is missing or stale; a profile operation is needed')
  return { stopped_at: 'profile:requirements-to-legacy', check }
}
log('Check passed')

phase('Assemble')
const asm = await agent(`${COMMON}

STEP: part 1 of "What to build": define sasPipeline and the parameter-links definition in the legacy blueprint, and nothing else. If sasPipeline already exists from an earlier run, revise it to match the brief as it now stands (the brief has changed: read it again in full). Read the manifest and the units first. Return what each field is wired to, every parameter of sasPipeline with the hypothesis it will carry, and anything in the interface that the legacy units cannot fill as they are.`,
  { label: 'assemble the pipeline', phase: 'Assemble', agentType: T, schema: { type: 'object', properties: {
    item_id: { type: 'string' }, accepted: { type: 'boolean' },
    wiring: { type: 'array', items: { type: 'string' } },
    parameters: { type: 'array', items: { type: 'string' } },
    mismatches: { type: 'array', items: { type: 'string' } } },
    required: ['item_id', 'accepted', 'wiring', 'parameters', 'mismatches'] } })
if (!asm || !asm.accepted) { log('STOP: the pipeline could not be assembled'); return { stopped_at: 'assemble', check, asm } }
log(`Assembled ${asm.item_id}: ${asm.parameters.length} parameters, ${asm.mismatches.length} interface mismatch(es)`)
const asmReview = await agent(`${COMMON}

STEP: independent review of ${asm.item_id}. You did not write it. Read its Lean (get_items) and the legacy units it uses, and the brief's part 1. Report anything that is not pure wiring: logic added or dropped, a unit skipped or applied to the wrong table, a renamed column, a step that returns an error where the legacy Lean does not stop (or the reverse), a parameter that is constrained more or less than the brief's table of links says, or that hides behaviour. Do not edit anything. An empty list is a fine result. The author's description: ${JSON.stringify(asm)}`,
  { label: 'review the assembly', phase: 'Assemble', agentType: T, schema: { type: 'object', properties: {
    defects: { type: 'array', items: { type: 'string' } } }, required: ['defects'] } })
if (asmReview && asmReview.defects.length) {
  asmReview.defects.forEach(d => log(`  assembly defect: ${d.slice(0, 160)}`))
  const fix = await agent(`${COMMON}

STEP: correct ${asm.item_id} on the reviewer's defects below, or answer each one if it is wrong. It must stay pure wiring. Defects: ${JSON.stringify(asmReview.defects)}`,
    { label: 'correct the assembly', phase: 'Assemble', agentType: T, schema: { type: 'object', properties: {
      accepted: { type: 'boolean' }, answers: { type: 'array', items: { type: 'string' } } }, required: ['accepted', 'answers'] } })
  if (!fix || !fix.accepted) { log('STOP: the assembly could not be corrected'); return { stopped_at: 'assemble', check, asm, asmReview, fix } }
  asm.review_answers = fix.answers
}

phase('State')
const stated = await agent(`${COMMON}

STEP: parts 2 and 2b of "What to build": add and state the contracts for ${JSON.stringify(REQS)} (theorem items sas_Qk, each exactly Qk applied to ${asm.item_id} under the parameter links, statement ending in sorry), and the theorem score_chains_agree; return it in contracts with requirement 'chains'. Do not prove anything. Finish when every statement is accepted.`,
  { label: 'state the contracts', phase: 'State', agentType: T, schema: { type: 'object', properties: {
    contracts: { type: 'array', items: { type: 'object', properties: { requirement: { type: 'string' }, item_id: { type: 'string' }, accepted: { type: 'boolean' } }, required: ['requirement', 'item_id', 'accepted'] } },
    problems: { type: 'array', items: { type: 'string' } } }, required: ['contracts', 'problems'] } })
if (!stated) return { stopped_at: 'state', check, asm }
const todo = stated.contracts.filter(c => c.accepted)
log(`Stated ${todo.length} of ${REQS.length + 1} contracts`)

const VERDICT = { type: 'object', properties: {
  requirement: { type: 'string' }, item_id: { type: 'string' },
  outcome: { type: 'string', enum: ['proved', 'by-construction', 'disproved', 'interface-mismatch', 'needs-ruling', 'open'] },
  kind_detail: { type: 'string', description: 'for disproved: the counterexample input, what the requirement demands, what the legacy code produces, file and lines, and the smallest change that would meet the requirement; otherwise what is missing' },
  conditional_on: { type: 'array', items: { type: 'string' }, description: 'parameter links the proof used' } },
  required: ['requirement', 'item_id', 'outcome', 'kind_detail', 'conditional_on'] }
phase('Prove')
const verdicts = []
for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH)
  const rs = await parallel(chunk.map(c => () => agent(`${COMMON}

STEP: part 3 of "What to build" for one contract: ${c.item_id} (${c.requirement}). Prove it, or disprove it as the brief says (negate, prove the negation with a concrete input meeting InputOK, flag false). Do not touch any other contract or any existing item. Finish when the blueprint accepts the proof or the disproof, or when you can say precisely why neither is reachable.`,
    { label: `${c.requirement}`, phase: 'Prove', agentType: T, schema: VERDICT })))
  rs.forEach((r, k) => {
    const v = r || { requirement: chunk[k].requirement, item_id: chunk[k].item_id, outcome: 'open', kind_detail: 'agent returned nothing', conditional_on: [] }
    verdicts.push(v); log(`  ${v.requirement}: ${v.outcome}`)
  })
}

phase('Verify')
const disproved = verdicts.filter(v => v.outcome === 'disproved')
const checks = []
for (let i = 0; i < disproved.length; i += BATCH) {
  const rs = await parallel(disproved.slice(i, i + BATCH).map(v => () => agent(`${COMMON}

STEP: independent check of one disproof. You did not write it. Contract ${v.item_id} (${v.requirement}) is reported disproved: ${v.kind_detail}. Check, reading the blueprint yourself: (1) the negation is stated as the exact negation of the contract and its proof is accepted, with no axiom or sorry; (2) the counterexample input really meets InputOK, the parameter links and the legacy units' own preconditions; (3) the failure is the legacy code's, not an artefact of how sasPipeline was assembled or of a parameter chosen adversarially where the legacy program has no such freedom; (4) the lines blamed are the right ones. Do not edit anything.`,
    { label: `check ${v.requirement}`, phase: 'Verify', agentType: T, schema: { type: 'object', properties: {
      requirement: { type: 'string' }, holds: { type: 'boolean' }, artefact: { type: 'boolean' }, note: { type: 'string' } },
      required: ['requirement', 'holds', 'artefact', 'note'] } })))
  rs.filter(Boolean).forEach(r => { checks.push(r); log(`  check ${r.requirement}: ${r.holds ? (r.artefact ? 'ARTEFACT' : 'confirmed') : 'NOT CONFIRMED'}`) })
}

phase('Report')
const summary = { assembly: asm, assembly_review: asmReview, statement_problems: stated.problems, verdicts, disproof_checks: checks }
const report = await agent(`${COMMON}

STEP: report. Do not write any file. Call get_status on the legacy blueprint yourself. Return (a) report_markdown: outcome in a few lines, get_status counts, how sasPipeline is wired and its parameters, a table of every requirement with its outcome and the links it is conditional on, what the disproof checks found, what is open; (b) findings_markdown: the findings for the legacy code as the brief's "Findings" section asks, one entry per requirement not proved, each self-contained for someone who will change the code and has not seen the Lean. Plain and factual. Facts: ${JSON.stringify(summary)}`,
  { label: 'report', phase: 'Report', agentType: T, schema: { type: 'object', properties: {
    report_markdown: { type: 'string' }, findings_markdown: { type: 'string' }, get_status: { type: 'string' } },
    required: ['report_markdown', 'findings_markdown', 'get_status'] } })
const tally = {}
verdicts.forEach(v => { tally[v.outcome] = (tally[v.outcome] || 0) + 1 })
log(`Stage 2 done: ${JSON.stringify(tally)}`)
return { tally, verdicts: verdicts.map(v => ({ requirement: v.requirement, outcome: v.outcome })), disproof_checks: checks, gate: 'legacy-corrections: the owner approves each correction before the legacy code is changed', report }
