export interface NodeLite { id: string; cost: number; prerequisite_node_id: string | null }
export function canUnlockSkill(node: NodeLite, unlocked: Set<string>, available: number): { ok: boolean; reason?: string } {
  if (unlocked.has(node.id)) return { ok: false, reason: 'Already unlocked' };
  if (node.prerequisite_node_id && !unlocked.has(node.prerequisite_node_id)) return { ok: false, reason: 'Unlock the previous tier first' };
  if (available < node.cost) return { ok: false, reason: `Needs ${node.cost} skill point${node.cost > 1 ? 's' : ''}` };
  return { ok: true };
}
