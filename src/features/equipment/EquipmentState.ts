import { ITEMS, STARTER_ITEMS } from './items';
import { Appearance, EquipmentSlot } from './types';

export class EquipmentState {
  skin: number;
  private equipped: Record<EquipmentSlot, string | null>;
  private inventory: string[];

  constructor(skin = 0xf2c79a) {
    this.skin = skin;
    this.equipped = {
      head: null,
      chest: 'tunic_red',
      legs: 'pants_brown',
      hands: null,
      feet: 'boots_leather'
    };

    const equippedIds = new Set(Object.values(this.equipped));
    this.inventory = STARTER_ITEMS.filter((id) => !equippedIds.has(id));
  }

  getEquipped(slot: EquipmentSlot): string | null {
    return this.equipped[slot];
  }

  getInventory(): string[] {
    return [...this.inventory];
  }

  equip(itemId: string): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;

    const idx = this.inventory.indexOf(itemId);
    if (idx === -1) return false;

    this.inventory.splice(idx, 1);

    const prev = this.equipped[def.slot];
    if (prev) this.inventory.push(prev);

    this.equipped[def.slot] = itemId;
    return true;
  }

  unequip(slot: EquipmentSlot): boolean {
    const current = this.equipped[slot];
    if (!current) return false;

    this.equipped[slot] = null;
    this.inventory.push(current);
    return true;
  }

  appearance(): Appearance {
    return {
      skin: this.skin,
      equipped: { ...this.equipped }
    };
  }
}