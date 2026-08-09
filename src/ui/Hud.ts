export interface HotbarSlot {
  label: string;
  count: number;
  selected: boolean;
}

export interface HudCallbacks {
  onTogglePlace: () => void;
  onToggleInventory: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectSlot: (index: number) => void;
}

export class Hud {
  private info = document.getElementById('info') as HTMLDivElement;
  private placeBtn = document.getElementById('btn-place') as HTMLButtonElement;
  private clockEl = document.getElementById('stat-day') as HTMLSpanElement;
  private energyFill = document.getElementById('energy-fill') as HTMLDivElement;
  private hotbarBtns: HTMLButtonElement[] = [];

  constructor(callbacks: HudCallbacks) {
    this.bind('btn-place', callbacks.onTogglePlace);
    this.bind('btn-bag', callbacks.onToggleInventory);
    this.bind('btn-zoom-in', callbacks.onZoomIn);
    this.bind('btn-zoom-out', callbacks.onZoomOut);

    const hotbar = document.getElementById('hotbar') as HTMLDivElement;
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.textContent = `Слот ${i + 1}`;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        callbacks.onSelectSlot(i);
      });
      hotbar.appendChild(btn);
      this.hotbarBtns.push(btn);
    }
  }

  private bind(id: string, handler: () => void): void {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('click', (event) => {
      event.preventDefault();
      handler();
    });
  }

  setPlaceMode(on: boolean): void {
    this.placeBtn.textContent = `Ставить: ${on ? 'ON' : 'OFF'}`;
    this.placeBtn.classList.toggle('active', on);
  }

  setHotbar(slots: HotbarSlot[]): void {
    slots.forEach((slot, i) => {
      const btn = this.hotbarBtns[i];
      if (!btn) return;
      btn.textContent = `${i + 1}: ${slot.label} ×${slot.count}`;
      btn.classList.toggle('active', slot.selected);
    });
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