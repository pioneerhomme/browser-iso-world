import { ItemId } from '../../core/types';
import { EquipmentSlot } from '../equipment/types';
import { ToolId } from '../tools/ToolsSystem';
import { DAY_START, MAX_ENERGY } from '../time/TimeSystem';

export interface SaveData {
  version: number;
  skin: number;
  equipped: Record<EquipmentSlot, string | null>;
  equipmentInventory: string[];
  resources: Partial<Record<ItemId, number>>;
  placed: Record<string, ItemId>;
  harvested: Record<string, number>;
  player: { x: number; y: number };
  zoom: number;
  tools: ToolId[];
  toolDurability: Record<string, number>;
  day: number;
  timeMin: number;
  energy: number;
  savedAt: number;
}

const KEY = 'browser-iso-world-save';
const VERSION = 6;

export function defaultSave(): SaveData {
  return {
    version: VERSION,
    skin: 0xf2c79a,
    equipped: { head: null, chest: 'tunic_red', legs: 'pants_brown', hands: null, feet: 'boots_leather' },
    equipmentInventory: [],
    resources: { wood: 10, stone: 0 },
    placed: {},
    harvested: {},
    player: { x: 0, y: 0 },
    zoom: 1.5,
    tools: ['axe', 'pickaxe'],
    toolDurability: { axe: 20, pickaxe: 20 },
    day: 1,
    timeMin: DAY_START,
    energy: MAX_ENERGY,
    savedAt: 0
  };
}

export class SaveSystem {
  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;

      const data = JSON.parse(raw) as SaveData;
      if (!data || data.version !== VERSION) return null;

      return data;
    } catch {
      return null;
    }
  }

  static update(patch: Partial<SaveData>): void {
    const base = SaveSystem.load() ?? defaultSave();
    const next: SaveData = { ...base, ...patch, version: VERSION, savedAt: Date.now() };

    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  static hasSave(): boolean {
    return SaveSystem.load() !== null;
  }

  static clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}