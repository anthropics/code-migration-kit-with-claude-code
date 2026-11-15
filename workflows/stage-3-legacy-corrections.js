export const meta = {
  name: 'stage-3-legacy-corrections',
  description: 'Stage 3: the coding agent corrects the legacy code on the approved findings and runs the real program for evidence; a second agent reviews every change against its requirement',
  phases: [
    { title: 'Correct', detail: 'one commit per finding, evidence runs on the real legacy runtime' },
    { title: 'Review', detail: 'each change read against its requirement by an agent that did not write it' },
    { title: 'Answer', detail: 'the coding agent fixes what the review found' },
  ],
}
const A = args || {}
const T = 'coding-agent'
const COMMON = `Your brief is ${A.brief}: read it first. You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents, do not write report files (return text), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead.`
phase('Correct')
log(`Correct: findings ${A.findings.join(', ')}`)
const FIX = { type: 'object', properties: {
  fixes: { type: 'array', items: { type: 'object', properties: {
    finding: { type: 'string' }, change: { type: 'string' }, copies: { type: 'string' }, evidence: { type: 'string' }, commit: { type: 'string' },
    state: { type: 'string', enum: ['fixed-and-shown', 'fixed-not-shown', 'not-fixed'] } },
    required: ['finding', 'change', 'copies', 'evidence', 'commit', 'state'] } },
  full_runs: { type: 'string' }, output_changes: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } },
  required: ['fixes', 'full_runs', 'output_changes', 'problems'] }
const work = await agent(`${COMMON}

STEP: carry out the whole brief for the findings ${JSON.stringify(A.findings)}.`, { label: 'correct the legacy code', phase: 'Correct', agentType: T, schema: FIX })
if (!work) return { stopped_at: 'correct' }
work.fixes.forEach(f => log(`  ${f.finding}: ${f.state} ${f.commit}`))
phase('Review')
const review = await agent(`${COMMON}

STEP: independent review; you did not make these changes and you change nothing. For each finding below read the requirement in the requirements document (with its rulings), the finding, and the commit's diff (git show). Report: a change that does not meet the requirement on some input (give the input); a copy of the defect left unfixed; a change that alters behaviour the finding did not ask to alter; evidence that does not show what it claims; and, for the input-validation change, a condition of section 3 not checked or a valid input rejected. An empty list is a fine result. The author's account: ${JSON.stringify(work.fixes)}`,
  { label: 'review the corrections', phase: 'Review', agentType: T, schema: { type: 'object', properties: {
    defects: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, defect: { type: 'string' } }, required: ['finding', 'defect'] } } }, required: ['defects'] } })
const defects = review ? review.defects : []
defects.forEach(d => log(`  review: ${d.finding}: ${d.defect.slice(0, 140)}`))
let answer = null
if (defects.length) {
  phase('Answer')
  answer = await agent(`${COMMON}

STEP: a reviewer found the defects below in the corrections already committed. For each: fix it (a new commit, message starting with the finding's number) and re-run the evidence the fix invalidates, including the full runs if outputs change; or answer it if it is wrong. Then return the complete, updated account of all findings. Defects: ${JSON.stringify(defects)} Previous account: ${JSON.stringify(work)}`,
    { label: 'answer the review', phase: 'Answer', agentType: T, schema: FIX })
}
return { work: answer || work, review_defects: defects, answered: !!answer }
