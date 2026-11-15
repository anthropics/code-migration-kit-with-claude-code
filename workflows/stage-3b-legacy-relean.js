export const meta = {
  name: 'stage-3b-legacy-relean',
  description: 'Stage 3b: bring the Lean translation of the legacy code up to date after the code was corrected; independent review of each changed unit against the source; differential evaluation against the new outputs',
  phases: [
    { title: 'Translate', detail: 'changed and new units, manifest, rulebook' },
    { title: 'Review', detail: 'each script\'s changed units read against the source by agents that did not write them' },
    { title: 'Fix', detail: 'the translator answers the review and re-evaluates' },
  ],
}
const A = args || {}
const T = 'legacy-translator'
const COMMON = `Your brief for this round is ${A.brief}: read it first. Legacy blueprint id ${A.legacyBlueprint}. You are one step of a workflow run by an orchestrator: do only the step described here, do not start sub-agents, do not write report files (return text; your kit record files such as the manifest, rulebook and receipt are yours to edit), and nobody can answer questions, so where you would stop and ask, return the reason in your result instead. Use the Logos MCP Staging connector only and open blueprints by id.`
const WORK = { type: 'object', properties: {
  items: { type: 'array', items: { type: 'object', properties: { item_id: { type: 'string' }, source: { type: 'string' }, change: { type: 'string', enum: ['new', 'changed', 'removed'] }, accepted: { type: 'boolean' }, evaluated: { type: 'string' } }, required: ['item_id', 'source', 'change', 'accepted', 'evaluated'] } },
  stopped_model: { type: 'string' }, rules_added: { type: 'array', items: { type: 'string' } }, receipt: { type: 'string' },
  open: { type: 'array', items: { type: 'string' } }, account: { type: 'string', description: 'the full report text the brief asks for' } },
  required: ['items', 'stopped_model', 'rules_added', 'receipt', 'open', 'account'] }
phase('Translate')
log('Translate: updating the Lean of the changed units')
const work = await agent(`${COMMON}

STEP: carry out the whole brief.`, { label: 'update the translation', phase: 'Translate', agentType: T, schema: WORK })
if (!work) return { stopped_at: 'translate' }
log(`Translated: ${work.items.length} items changed or added; ${work.items.filter(i => !i.accepted).length} not accepted`)
phase('Review')
const reviews = (await parallel(A.scripts.map(s => () => agent(`${COMMON}

STEP: independent review; you did not write this Lean and you edit nothing. Script: ${s}. For each item below that covers lines of ${s}, read its accepted Lean (get_items) and the current source lines, and answer the standing question: does this Lean do anything the SAS does not, or omit anything it does? Look especially at: comparisons and arithmetic on missing values; the order of operations kept as written; the input check stating exactly the conditions the SAS tests; what is exported; ties and empty groups in the new PSI and KS code; a rule about a PROC or function stated without evidence. Give a concrete input for every defect. An empty list is a fine result. Items: ${JSON.stringify(work.items)}. How stopping is modelled: ${work.stopped_model}`,
  { label: `review ${s}`, phase: 'Review', agentType: T, schema: { type: 'object', properties: {
    defects: { type: 'array', items: { type: 'object', properties: { item_id: { type: 'string' }, defect: { type: 'string' } }, required: ['item_id', 'defect'] } } }, required: ['defects'] } })))).filter(Boolean)
const defects = reviews.flatMap(r => r.defects)
log(`Review: ${defects.length} defect(s)`)
defects.forEach(d => log(`  ${d.item_id}: ${d.defect.slice(0, 140)}`))
let fixed = null
if (defects.length) {
  phase('Fix')
  fixed = await agent(`${COMMON}

STEP: reviewers found the defects below in the updated translation. For each: find the SAS rule that decides it (evidence, or a new experiment), correct the Lean if the reviewer is right and re-run the differential evaluation of that unit, or answer the reviewer if not. Never adjust the Lean to match an output without the rule that explains it. Then return the complete, updated account. Defects: ${JSON.stringify(defects)} Previous account: ${JSON.stringify({ items: work.items, stopped_model: work.stopped_model, open: work.open })}`,
    { label: 'answer the review', phase: 'Fix', agentType: T, schema: WORK })
}
const final = fixed || work
return { items: final.items, stopped_model: final.stopped_model, rules_added: final.rules_added, open: final.open, review_defects: defects, account: final.account, receipt: final.receipt }
