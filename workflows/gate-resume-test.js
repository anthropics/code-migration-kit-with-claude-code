export const meta = {
  name: 'gate-resume-test',
  description: 'Toy test: does a workflow that stops at a human gate replay its earlier steps from cache when relaunched with the gate answer? (two tiny agents)',
  phases: [{ title: 'Before gate' }, { title: 'After gate' }],
}
phase('Before gate')
const a = await agent('Reply with one made-up word of exactly eight random lowercase letters and nothing else. Use no tools.', { label: 'before-gate', phase: 'Before gate', effort: 'low' })
log(`before-gate returned: ${a}`)
if (!args || !args.gate1) return { stopped_at: 'gate1', question: 'Proceed past gate 1?', before: a }
phase('After gate')
const b = await agent(`Reply with exactly this and nothing else, using no tools: "${args.gate1}"`, { label: 'after-gate', phase: 'After gate', effort: 'low' })
return { before: a, gate1: args.gate1, after: b }