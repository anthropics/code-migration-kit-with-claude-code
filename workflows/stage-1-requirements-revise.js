export const meta = {
  name: 'stage-1-requirements-revise',
  description: 'Stage 1 revision: bring the requirements blueprint to the current draft of requirements.md after new rulings, review the changed statements, re-prove consistency',
  phases: [
    { title: 'Update', detail: 'the items the new rulings touch' },
    { title: 'Review', detail: 'three independent reviewers, every statement against requirements.md (current draft)' },
    { title: 'Fix', detail: 'answers to the review, re-checked by a further reviewer' },
    { title: 'Consistency', detail: 're-prove that some pipeline satisfies all requirements' },
    { title: 'Report', detail: 'report text returned to the orchestrator' },
  ],
}
const T = 'requirements-formaliser'
const BP = '006ff04c-d34c-4a9c-b230-ccd725b1be6f'
const A = args || {}
const COMMON = `Blueprint credit-risk-requirements has id ${BP}; the shared foundation credit-risk-foundation has id 02011d57-8b15-43bb-8744-c6646fdfe9ae. You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents, do not write report files (return text), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead. Use the Logos MCP Staging connector only and open blueprints by id. The blueprint already holds a full, accepted formalisation of the previous draft of migration/requirements/requirements.md (described in migration/requirements/report.md). The owner has since ruled again: ${A.changes} Server behaviour: one Lean declaration per item, named after the item id; editing a statement clears the acceptance of everything that depends on it, which must then be re-accepted.`

phase('Update')
log('Update: bringing the blueprint to the current draft')
const upd = await agent(`${COMMON}

STEP: update the formalisation to the current draft. Read requirements.md (all of it, with section 4), the brief, report.md and the current items. Change exactly the items the new rulings touch, and whatever depends on them, so the blueprint states the current draft; leave every other statement as it is. The two theorems may lose their proofs; leave their statements stating the same claims, proofs for a later step. Rules as in the brief: state each requirement as worded with its rulings, no stronger, no weaker; record every reading in the item's text; list what cannot be stated. In items, list every item with what you did to it. Finish when every definition's statement is accepted (get_status).`,
  { label: 'update to the current draft', phase: 'Update', agentType: T, schema: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'object', properties: { item_id: { type: 'string' }, covers: { type: 'string' }, change: { type: 'string', enum: ['new', 'restated', 'adapted-to-interface', 'unchanged', 'removed'] } }, required: ['item_id', 'covers', 'change'] } },
      readings: { type: 'array', items: { type: 'string' }, description: 'readings still taken by the formaliser (not settled by a ruling)' },
      problems: { type: 'array', items: { type: 'string' } },
      status: { type: 'string' } },
    required: ['items', 'readings', 'problems', 'status'] } })
if (!upd) return { stopped: 'update step returned nothing' }
log(`Update done: ${upd.items.length} items; ${upd.readings.length} readings left to the formaliser; ${upd.problems.length} problems reported`)

const FINDINGS = { type: 'object', properties: {
  checked: { type: 'array', items: { type: 'string' } },
  findings: { type: 'array', items: { type: 'object', properties: {
    item_id: { type: 'string' }, requirement: { type: 'string' },
    kind: { type: 'string', enum: ['stronger-than-text', 'weaker-than-text', 'different-meaning', 'vacuous', 'missing-requirement', 'unstated-reading', 'other'] },
    explanation: { type: 'string', description: 'what the text says, what the Lean says, and a concrete case that separates them' } },
    required: ['item_id', 'requirement', 'kind', 'explanation'] } } },
  required: ['checked', 'findings'] }
const GROUPS = [
  { key: 'interface, inputs, Q1-Q9, Q27', scope: 'the pipeline interface (rulings G11, G12), the input conditions (section 3, G14), Q27, and requirements Q1 to Q9 with the auxiliary notions they use' },
  { key: 'Q10-Q21', scope: 'requirements Q10 to Q21 (Q17 is withdrawn: check nothing formalises it) with the auxiliary notions they use, including how they use the fitted model and the error outcome' },
  { key: 'Q22-Q26, spec', scope: 'requirements Q22 to Q26 with the auxiliary notions they use (median, KS distributions, decile cuts, PSI shares, AUC, Somers D), and the whole specification: exactly the conjunction of Q1 to Q16 and Q18 to Q27' },
]
const itemList = JSON.stringify(upd.items)
const reviewPrompt = g => `${COMMON}

STEP: independent review. You did not write these statements. Find where the Lean in the blueprint does not say what requirements.md (current draft) says. Your scope: ${g.scope}. For each item in scope read the Lean statement itself (get_items), not the informal text, and compare it with the requirement's wording and rulings. Look for: stronger or weaker than the text; vacuous statements (in particular, with error outcomes: a requirement that holds trivially whenever a step returns an error, when Q27 or the requirement itself should exclude that); quantifiers over the wrong inputs; strict versus non-strict inequalities against rulings G1, G2, G15, G20; percent versus fraction units (G17, G18); a requirement in scope with no item; a reading not settled by a ruling and not declared in the item text. Give a concrete separating case for every finding. A reading that a ruling settles is not a finding. Do not edit anything. An empty list is a fine result. Items reported by the formaliser: ${itemList}`

let findings = [], answers = [], open = []
phase('Review')
const reviews = (await parallel(GROUPS.map(g => () =>
  agent(reviewPrompt(g), { label: `review ${g.key}`, phase: 'Review', agentType: T, schema: FINDINGS })))).filter(Boolean)
findings = reviews.flatMap(r => r.findings)
log(`Review done: ${findings.length} finding(s) over ${reviews.flatMap(r => r.checked).length} item checks`)
findings.forEach(f => log(`  finding: ${f.item_id} (${f.requirement}) ${f.kind}`))

if (findings.length) {
  phase('Fix')
  const fix = await agent(`${COMMON}

STEP: answer the review. Independent reviewers reported the findings below. For each: read the requirement and the Lean; if the finding is right, correct the statement so it says what the current draft says, no stronger and no weaker, and get it and its dependants accepted again; if it is wrong, leave the statement and answer the reviewer's separating case. A limitation or reading must be written into the item's text, not only into your answer, even if that costs re-acceptance of dependants. Never bend a requirement; if the text cannot be stated, say so. Findings: ${JSON.stringify(findings)}`,
    { label: 'answer review', phase: 'Fix', agentType: T, schema: { type: 'object', properties: {
      answers: { type: 'array', items: { type: 'object', properties: {
        item_id: { type: 'string' }, action: { type: 'string', enum: ['corrected', 'kept', 'added', 'cannot-state'] }, note: { type: 'string' } },
        required: ['item_id', 'action', 'note'] } },
      status: { type: 'string' } }, required: ['answers', 'status'] } })
  answers = fix ? fix.answers : []
  answers.forEach(a => log(`  answer: ${a.item_id} ${a.action}`))
  const re = await agent(`${COMMON}

STEP: second independent review, of the answers to the first. You wrote neither. For each finding and its answer below, read the current Lean statement (get_items) and the requirement in requirements.md (current draft), and decide whether it is resolved: the statement now matches the text, or the reason for keeping it is sound and any reading is in the item text. Report as findings only what is still wrong, including any new defect a correction introduced. Do not edit anything. Findings: ${JSON.stringify(findings)} Answers: ${JSON.stringify(answers)}`,
    { label: 're-check answers', phase: 'Fix', agentType: T, schema: FINDINGS })
  open = re ? re.findings : findings
  log(`Re-check done: ${open.length} finding(s) still open`)
}

phase('Consistency')
log('Consistency: proving that some pipeline satisfies the whole specification')
const proof = await agent(`${COMMON}

STEP: consistency. In the blueprint, prove again over the current definitions: (a) thm:consistent, there is a pipeline satisfying the whole specification (now including Q27: it must produce results on good inputs and stop with an error on bad ones); (b) thm:inputOK_satisfiable, the input conditions can be met. Prefer a witness that is as little degenerate as the proof allows, but any witness will do. You must not change the statement of any requirement, of the input conditions or of the specification: if the proof fails because requirements contradict each other or one cannot be satisfied, stop and report exactly which and why. No axiom, sorry, native_decide or unsafe. Finish when both theorems are accepted (get_status), or when you can show why they cannot be.`,
  { label: 'prove consistency', phase: 'Consistency', agentType: T, schema: { type: 'object', properties: {
    proved: { type: 'boolean' },
    witness: { type: 'string', description: 'what the witness pipeline is, and what it does not show' },
    obstacle: { type: 'string' },
    statements_changed: { type: 'array', items: { type: 'string' } },
    status: { type: 'string' } },
    required: ['proved', 'witness', 'obstacle', 'statements_changed', 'status'] } })
log(proof ? (proof.proved ? 'Consistency proved' : `Consistency NOT proved: ${proof.obstacle.slice(0, 200)}`) : 'Consistency step returned nothing')

phase('Report')
const summary = { update: upd, review_findings: findings, answers, still_open: open, consistency: proof }
const report = await agent(`${COMMON}

STEP: report. Do not write any file: return the full text of the new report in the field report_markdown; the orchestrator saves it. Call get_status and get_items on the blueprint yourself for the counts and each item's state. Contents: blueprint id; outcome in a few lines; get_status counts; the items with state and what each covers; readings still taken by the formaliser (not settled by rulings); anything that could not be formalised as written; the review findings, how each was answered, what is still open; the consistency witness and what it does not show, or the obstacle; open points for the owner, if any. Plain, factual, no praise. If get_status disagrees with the facts below, say so. Facts from the earlier steps: ${JSON.stringify(summary)}`,
  { label: 'report', phase: 'Report', agentType: T, schema: { type: 'object', properties: {
    report_markdown: { type: 'string' }, get_status: { type: 'string' }, disagreements: { type: 'array', items: { type: 'string' } } },
    required: ['report_markdown', 'get_status', 'disagreements'] } })
return { open_after_recheck: open, consistency: proof && { proved: proof.proved, obstacle: proof.obstacle, statements_changed: proof.statements_changed }, problems: upd.problems, readings: upd.readings, report }