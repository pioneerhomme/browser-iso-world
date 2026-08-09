export type ToolId = 'axe' | 'pickaxe';

export const TOOL_LABELS: Record<ToolId, string> = {
  axe: 'топор',
  pickaxe: 'кирка'
};

export const TOOL_FOR_RESOURCE: Record<'tree' | 'rock', ToolId> = {
  tree: 'axe',
  rock: 'pickaxe'
};

export const STARTER_TOOLS: ToolId[] = ['axe', 'pickaxe'];