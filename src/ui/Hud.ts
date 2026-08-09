import { ItemId } from '../core/types';

export interface HudCallbacks {
  onToggleBuild: () => void;
  onToggleRemove: () => void;
  onCraft: () => void;
  onSelectWood: () => void;
  onSelectStone: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInventory: () => void;
}

export class Hud {
  private info = document.getElementById('info') as HTMLDivElement;
  private buildBtn = document.getElementById('btn-build') as HTMLButtonElement;
  private removeBtn = document.getElementById('btn-remove') as HTMLButtonElement;
  private woodBtn = document.getElementById('btn-wood') as HTMLButtonElement;
  private stoneBtn = document.getElementById('btn-stone') as HTMLButtonElement;
  private clockEl = document.getElementById('stat-day') as HTMLSpanElement;
  private energyFill = document.getElementById('energy-fill') as HTMLDivElement;

  constructor(callbacks: HudCallbacks) {
    this.bind('btn-build', callbacks.onToggleBuild);
    this.bind('btn-remove', callbacks.onToggleRemove);
    this.bind('btn-craft', callbacks.onCraft);
    this.bind('btn-wood', callbacks.onSelectWood);
    this.bind('btn-stone', callbacks.onSelectStone);
    this.bind('btn-zoom-in', callbacks.onZoomIn);
    this.bind('btn-zoom-out', callbacks.onZoomOut);
    this.bind('btn-bag', callbacks.onToggleInventory);
  }

  private bind(id: string, handler: () => void): void {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('click', (event) => {
      event.preventDefault();
      handler();
    });
  }

  setBuildMode(on: boolean): void {
    this.buildBtn.textContent = `Строительство: ${on ? 'ON' : 'OFF'}`;
    this.buildBtn.classList.toggle('active', on);
  }

  setRemoveMode(on: boolean): void {
    this.removeBtn.textContent = `Снос: ${on ? 'ON' : 'OFF'}`;
    this.removeBtn.classList.toggle('active', on);
  }

  setSelected(item: ItemId): void {
    this.woodBtn.classList.toggle('active', item === 'wood');
    this.stoneBtn.classList.toggle('active', item === 'stone');
  }

  setInfo(text: string): void {
    this.info.textContent = text;
  }

  setClock(text: string): void {
    this.clockEl.textContent = text;
  }

  setEnergy(fraction: number): void {
    this.energyFill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }
}