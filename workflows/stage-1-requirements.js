export const meta = {
  name: 'stage-1-requirements',
  description: 'Stage 1: formalise the documented requirements into the blueprint credit-risk-requirements, review the statements independently, and prove them consistent',
  phases: [
    { title: 'Check', detail: 'shared foundation visible from the blueprint' },
    { title: 'Formalise', detail: 'pipeline interface, input conditions, one definition per requirement' },
    { title: 'Review', detail: 'independent reviewers compare every statement with requirements.md' },
    { title: 'Fix', detail: 'the formaliser answers the review; fixes are re-checked' },
    { title: 'Consistency', detail: 'prove that some pipeline satisfies all requirements' },
    { title: 'Report', detail: 'write migration/requirements/report.md' },
  ],
}
const T = 'requirements-formaliser'
const BP = '006ff04c-d34c-4a9c-b230-ccd725b1be6f'
const COMMON = `Blueprint credit-risk-requirements has id ${BP}; the shared foundation credit-risk-foundation has id 02011d57-8b15-43bb-8744-c6646fdfe9ae. You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents (they would have no access), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead. The brief (migration/requirements/brief.md) describes the whole job; this step's scope overrides its "have a separate reviewer" and "report" instructions, which other steps do. Known server behaviour: one Lean declaration per item, named after the item id, so shared vocabulary (reading a numeric cell, age group, medians, KS distributions, PSI shares, AUC) needs items of its own.`

phase('Check')
const check = await agent(`${COMMON}

STEP: visibility check only. From blueprint ${BP}, check that the shared types are usable: Tabular.RealLike, Tabular.Row, Tabular.Table, Tabular.Row.get. The reliable test is to add one throwaway definition item whose Lean statement uses Tabular.Table ℝ and Tabular.Row.get, see whether it compiles, then remove the item so the blueprint is left empty. Report what you saw.`,
  { label: 'foundation visible?', phase: 'Check', agentType: T, schema: {
    type: 'object',
    properties: { visible: { type: 'boolean' }, evidence: { type: 'string' }, blueprint_left_empty: { type: 'boolean' } },
    required: ['visible', 'evidence', 'blueprint_left_empty'] } })
if (!check || !check.visible) return { stopped: 'foundation not visible from the requirements blueprint', check }

phase('Formalise')
const ITEMS = { type: 'array', items: { type: 'object', properties: {
  item_id: { type: 'string' }, covers: { type: 'string', description: 'e.g. Q7, input conditions, interface, auxiliary: median' },
  state: { type: 'string' } }, required: ['item_id', 'covers', 'state'] } }
const formal = await agent(`${COMMON}

STEP: formalise. Read the brief, migration/requirements/requirements.md, legacy/MODEL_CARD.md, legacy/README.md and migration/foundation/foundation.pdf. Then build, in blueprint ${BP}, parts 1 to 4 of "What to build" in the brief: the pipeline as an interface, the input conditions, one definition per requirement Q1 to Q26 (not the withdrawn Q17) with the auxiliary notions they need, and the whole specification as their conjunction. Each item's informal text is the requirement's own wording with its rulings. Do NOT start the consistency theorem (part 5): that is a later step. Follow the brief's rules: state each requirement as written, do not strengthen, weaken or tidy; where the rulings leave an ambiguity, state the reading you took in the item's text and list it. If a requirement cannot be stated as written, do not bend it: list it under problems. Finish when every item's statement is accepted by the server (check get_status).`,
  { label: 'formalise requirements', phase: 'Formalise', agentType: T, schema: {
    type: 'object',
    properties: {
      items: ITEMS,
      readings: { type: 'array', items: { type: 'string' }, description: 'every reading taken where the text was ambiguous' },
      problems: { type: 'array', items: { type: 'string' }, description: 'requirements that could not be stated as written, and why' },
      status: { type: 'string', description: 'counts from get_status' } },
    required: ['items', 'readings', 'problems', 'status'] } })
if (!formal) return { stopped: 'formaliser returned nothing', check }

const FINDINGS = { type: 'object', properties: {
  checked: { type: 'array', items: { type: 'string' }, description: 'item ids you actually read and compared' },
  findings: { type: 'array', items: { type: 'object', properties: {
    item_id: { type: 'string' }, requirement: { type: 'string' },
    kind: { type: 'string', enum: ['stronger-than-text', 'weaker-than-text', 'different-meaning', 'vacuous', 'missing-requirement', 'unstated-reading', 'other'] },
    explanation: { type: 'string', description: 'what the text says, what the Lean says, and a concrete case that separates them' } },
    required: ['item_id', 'requirement', 'kind', 'explanation'] } } },
  required: ['checked', 'findings'] }
const GROUPS = [
  { key: 'Q1-Q9', scope: 'the pipeline interface, the input conditions (section 3), and requirements Q1 to Q9 with the auxiliary notions they use' },
  { key: 'Q10-Q21', scope: 'requirements Q10 to Q21 (Q17 is withdrawn: check that nothing formalises it) with the auxiliary notions they use' },
  { key: 'Q22-Q26+spec', scope: 'requirements Q22 to Q26 with the auxiliary notions they use (median, KS distributions, PSI shares, AUC: check each is the standard mathematical notion), and the whole specification: is it exactly the conjunction of all requirements, none missing' },
]
const reviewPrompt = g => `${COMMON}

STEP: independent review. You did not write these statements; another agent did. Your job is to find where the Lean in blueprint ${BP} does not say what migration/requirements/requirements.md says (read it and its rulings first; the two source documents are in legacy/). Your scope: ${g.scope}. For each item in scope, read the Lean statement itself (get_items), not the informal text beside it, and compare it with the requirement's wording. Look in particular for: a statement stronger or weaker than the text; a statement that is vacuous (true of every pipeline, for example because a hypothesis can never hold or a quantifier ranges over nothing); a quantifier over the wrong set of inputs; band edges and inequalities (strict or not) that differ from rulings G1 and G2; a requirement in scope with no item; a reading taken silently. Give a concrete separating case for every finding. Do not edit anything. An empty findings list is a fine result if the statements are right. The items the formaliser reported: ${JSON.stringify(formal.items)}`

phase('Review')
const reviews = (await parallel(GROUPS.map(g => () =>
  agent(reviewPrompt(g), { label: `review ${g.key}`, phase: 'Review', agentType: T, schema: FINDINGS })))).filter(Boolean)
let findings = reviews.flatMap(r => r.findings)
log(`review: ${findings.length} finding(s) over ${reviews.flatMap(r => r.checked).length} items checked`)

let fixes = null, recheck = null
if (findings.length) {
  phase('Fix')
  fixes = await agent(`${COMMON}

STEP: answer the review. Independent reviewers compared the Lean statements in blueprint ${BP} with migration/requirements/requirements.md and reported the findings below. For each one: read the requirement and the Lean; if the finding is right, correct the statement so it says what the text says (no stronger, no weaker) and make sure it is accepted again; if the finding is wrong, leave the statement and say why, with the reviewer's separating case answered. Never resolve a finding by bending a requirement toward what is convenient; if the text itself cannot be stated, say so. Findings: ${JSON.stringify(findings)}`,
    { label: 'answer review', phase: 'Fix', agentType: T, schema: { type: 'object', properties: {
      answers: { type: 'array', items: { type: 'object', properties: {
        item_id: { type: 'string' }, action: { type: 'string', enum: ['corrected', 'kept', 'added', 'cannot-state'] }, note: { type: 'string' } },
        required: ['item_id', 'action', 'note'] } },
      status: { type: 'string' } }, required: ['answers', 'status'] } })
  if (fixes) {
    recheck = await agent(`${COMMON}

STEP: second independent review, of the answers to the first. You wrote neither the statements nor the first review. For each finding below and the formaliser's answer to it, read the current Lean statement in blueprint ${BP} (get_items) and the requirement in migration/requirements/requirements.md, and decide whether the finding is now resolved: either the statement was corrected to match the text, or the formaliser's reason for keeping it is sound. Report as findings only what is still wrong (including any new defect a correction introduced). Do not edit anything. First-review findings: ${JSON.stringify(findings)} Answers: ${JSON.stringify(fixes.answers)}`,
      { label: 're-check answers', phase: 'Fix', agentType: T, schema: FINDINGS })
  }
}
const open = recheck ? recheck.findings : (findings.length && !fixes ? findings : [])

phase('Consistency')
const proof = await agent(`${COMMON}

STEP: consistency (part 5 of "What to build" in the brief). In blueprint ${BP}, add and prove: (a) a theorem that there is a pipeline satisfying the whole specification; (b) a theorem that the input conditions can be met (some input satisfies them). Any witness will do, however artificial. You must not change the statement of any requirement, of the input conditions or of the specification to make the proof go through: if the proof fails because two requirements contradict each other, or one cannot be satisfied, stop and report exactly which and why; that is a finding about the documentation, for its owner. No axiom, sorry, native_decide or unsafe. Finish when both theorems are accepted (get_status), or when you can show why they cannot be.`,
  { label: 'prove consistency', phase: 'Consistency', agentType: T, schema: { type: 'object', properties: {
    proved: { type: 'boolean' },
    theorem_items: { type: 'array', items: { type: 'string' } },
    witness: { type: 'string', description: 'what the witness pipeline is, and what it does not show' },
    obstacle: { type: 'string', description: 'if not proved: the contradiction or unsatisfiable requirement, precisely; else empty' },
    statements_changed: { type: 'array', items: { type: 'string' }, description: 'ids of any existing statement you changed (should be empty)' },
    status: { type: 'string' } },
    required: ['proved', 'theorem_items', 'witness', 'obstacle', 'statements_changed', 'status'] } })

phase('Report')
const summary = { check, formal, first_review_findings: findings, answers: fixes && fixes.answers, still_open_after_recheck: open, consistency: proof }
const report = await agent(`${COMMON}

STEP: write the report. Write migration/requirements/report.md (replace the file if it exists) from the facts below and from get_status on blueprint ${BP}, which you must call yourself for the counts and to confirm each item's state. Contents: the blueprint id; the items with their state and which requirement each covers; every reading taken; anything in the documentation that could not be formalised as written; the review findings, how each was answered, and what is still open; what the consistency witness is and what it does not show, or the obstacle if consistency was not proved; the get_status counts. Plain, factual, no praise. If get_status disagrees with the facts below, say so and report what get_status shows. Facts from the earlier steps: ${JSON.stringify(summary)}`,
  { label: 'write report', phase: 'Report', agentType: T, schema: { type: 'object', properties: {
    written: { type: 'boolean' }, get_status: { type: 'string' }, disagreements: { type: 'array', items: { type: 'string' } } },
    required: ['written', 'get_status', 'disagreements'] } })
return { ...summary, report }