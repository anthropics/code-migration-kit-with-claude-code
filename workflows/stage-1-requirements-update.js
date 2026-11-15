export const meta = {
  name: 'stage-1-requirements-update',
  description: 'Stage 1 update: bring the blueprint credit-risk-requirements to draft 3 of requirements.md (rulings G11-G22, Q27), review every statement again, re-prove consistency',
  phases: [
    { title: 'Update', detail: 'interface with fitted model and error outcome; changed requirements; Q27' },
    { title: 'Review', detail: 'three independent reviewers, every statement against requirements.md draft 3' },
    { title: 'Fix', detail: 'answers to the review, re-checked by a further reviewer' },
    { title: 'Consistency', detail: 're-prove that some pipeline satisfies all requirements' },
    { title: 'Report', detail: 'report text returned to the orchestrator' },
  ],
}
const T = 'requirements-formaliser'
const BP = '006ff04c-d34c-4a9c-b230-ccd725b1be6f'
const COMMON = `Blueprint credit-risk-requirements has id ${BP}; the shared foundation credit-risk-foundation has id 02011d57-8b15-43bb-8744-c6646fdfe9ae. You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents, do not write report files (return text), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead. The blueprint already holds a full formalisation of draft 2 of migration/requirements/requirements.md (54 items, described in migration/requirements/report.md). The owner has since ruled on the twelve open points: requirements.md is now draft 3 (rulings G11 to G22, new requirement Q27, distinct row ids in section 3) and migration/requirements/brief.md describes the new interface. Server behaviour: one Lean declaration per item, named after the item id; editing a statement clears the acceptance of everything that depends on it, which must then be re-accepted.`

phase('Update')
log('Update: bringing the blueprint to draft 3 (rulings G11-G22, Q27)')
const upd = await agent(`${COMMON}

STEP: update the formalisation to draft 3. Read requirements.md (all of it, with section 4), the brief, report.md and the current items. Then change the blueprint so that it states draft 3 exactly:
- Interface (G11, G12, brief item 1): feature engineering (raw training table, seed), fitting (training feature table to a model of an open type), scoring (model, feature table), test scoring (model, raw test table, raw training table), metrics; every step can end in an error instead of a result. Requirements that speak of scores use the model fitted on the training feature set of the same run.
- Input conditions: add distinct row ids within each raw file (G14).
- Q27 (new): on inputs meeting section 3 every step produces its result; on inputs that do not, the pipeline stops with an error and produces no result. Decide and state in the item text what "the pipeline stops" means over the interface (which step must fail), as the plainest reading.
- Q4, Q6, Q9, Q10, Q12, Q13, Q19, Q22 to Q26: restate where the draft-3 wording and rulings G13, G15 to G22 differ from the current Lean (percent units, flag is 0 when its condition fails, natural log only when income is above 0, within one applicant, fractions for interest rates, validation set and unconstrained undefined cases, nearest-rank deciles with ties to the lower bin, exactly ten decile rows labelled 1 to 10 with the capture sum required when there is a defaulter).
- Every other requirement: adapt to the new interface without changing its meaning.
- The whole specification: the conjunction of Q1 to Q16 and Q18 to Q27.
- The two existing theorems will lose their proofs; leave their statements stating the same claims over the new definitions, proofs for a later step.
Rules as in the brief: state each requirement as worded with its rulings, no stronger, no weaker; record every reading in the item's text; list what cannot be stated. Readings now settled by a ruling should cite it, not appear as the formaliser's choice. Finish when every definition's statement is accepted (get_status).`,
  { label: 'update to draft 3', phase: 'Update', agentType: T, schema: {
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

STEP: independent review. You did not write these statements. Find where the Lean in the blueprint does not say what requirements.md draft 3 says. Your scope: ${g.scope}. For each item in scope read the Lean statement itself (get_items), not the informal text, and compare it with the requirement's wording and rulings. Look for: stronger or weaker than the text; vacuous statements (in particular, with error outcomes: a requirement that holds trivially whenever a step returns an error, when Q27 or the requirement itself should exclude that); quantifiers over the wrong inputs; strict versus non-strict inequalities against rulings G1, G2, G15, G20; percent versus fraction units (G17, G18); a requirement in scope with no item; a reading not settled by a ruling and not declared in the item text. Give a concrete separating case for every finding. A reading that a ruling settles is not a finding. Do not edit anything. An empty list is a fine result. Items reported by the formaliser: ${itemList}`

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

STEP: answer the review. Independent reviewers reported the findings below. For each: read the requirement and the Lean; if the finding is right, correct the statement so it says what draft 3 says, no stronger and no weaker, and get it and its dependants accepted again; if it is wrong, leave the statement and answer the reviewer's separating case. A limitation or reading must be written into the item's text, not only into your answer, even if that costs re-acceptance of dependants. Never bend a requirement; if the text cannot be stated, say so. Findings: ${JSON.stringify(findings)}`,
    { label: 'answer review', phase: 'Fix', agentType: T, schema: { type: 'object', properties: {
      answers: { type: 'array', items: { type: 'object', properties: {
        item_id: { type: 'string' }, action: { type: 'string', enum: ['corrected', 'kept', 'added', 'cannot-state'] }, note: { type: 'string' } },
        required: ['item_id', 'action', 'note'] } },
      status: { type: 'string' } }, required: ['answers', 'status'] } })
  answers = fix ? fix.answers : []
  answers.forEach(a => log(`  answer: ${a.item_id} ${a.action}`))
  const re = await agent(`${COMMON}

STEP: second independent review, of the answers to the first. You wrote neither. For each finding and its answer below, read the current Lean statement (get_items) and the requirement in requirements.md draft 3, and decide whether it is resolved: the statement now matches the text, or the reason for keeping it is sound and any reading is in the item text. Report as findings only what is still wrong, including any new defect a correction introduced. Do not edit anything. Findings: ${JSON.stringify(findings)} Answers: ${JSON.stringify(answers)}`,
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