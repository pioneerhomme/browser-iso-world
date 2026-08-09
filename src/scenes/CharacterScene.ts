import Phaser from 'phaser';
import { EquipmentState } from '../features/equipment/EquipmentState';
import { ITEMS } from '../features/equipment/items';
import { getHeroTexture } from '../features/art/CharacterSprites';
import { getItemIconTexture } from '../features/art/TextureFactory';
import { EQUIPMENT_SLOTS, EquipmentSlot, SLOT_LABELS } from '../features/equipment/types';
import { SaveSystem } from '../features/save/SaveSystem';

const SKIN_COLORS = [0xf2c79a, 0xd9a066, 0x8d5a3b, 0xf7d7b0, 0xb07b4f, 0x6b4423];

export class CharacterScene extends Phaser.Scene {
  private state = new EquipmentState();

  private previewImage!: Phaser.GameObjects.Image;

  private cell = 56;
  private invX0 = 0;
  private invY0 = 0;
  private invCols = 6;

  private previewX = 0;
  private previewFeetY = 0;
  private previewScale = 6;

  private slotFrames = new Map<EquipmentSlot, Phaser.GameObjects.Rectangle>();
  private slotRects = new Map<EquipmentSlot, Phaser.Geom.Rectangle>();
  private slotPos = new Map<EquipmentSlot, { x: number; y: number }>();

  private dynamic: Phaser.GameObjects.Container[] = [];

  private onScaleResize = (): void => {
    this.time.delayedCall(150, () => {
      this.scene.restart();
    });
  };

  constructor() {
    super('CharacterScene');
  }

  create(): void {
    this.dynamic = [];

    this.scale.on('resize', this.onScaleResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onScaleResize);
    });

    const w = this.scale.width;
    const h = this.scale.height;

    const save = SaveSystem.load();
    if (save) {
      this.state = EquipmentState.fromSnapshot(save.skin, save.equipped, save.equipmentInventory);
    }

    this.cell = Math.max(44, Math.min(64, Math.floor(Math.min(w, h) / 9)));

    const bottomH = this.cell * 3 + 60;
    const topH = h - bottomH;

    this.add.text(16, 10, 'Снаряжение персонажа', { fontSize: '22px', color: '#ffffff' });
    this.add.text(16, 40, 'Перетащи вещь в слот или тапни по ней. Тап по надетой вещи — снять.', {
      fontSize: '13px',
      color: '#9fb0cc',
      wordWrap: { width: w - 32 }
    });

    this.add.text(16, 70, 'Цвет кожи:', { fontSize: '14px', color: '#cfd6e6' });
    SKIN_COLORS.forEach((color, i) => {
      const sw = this.add
        .rectangle(110 + i * 34, 77, 26, 26, color)
        .setStrokeStyle(2, 0x3a4a6a)
        .setInteractive({ useHandCursor: true });

      sw.on('pointerdown', () => {
        this.state.skin = color;
        this.refresh();
      });
    });

    const start = this.add
      .text(w - 16, 16, save ? 'Продолжить' : 'Начать игру', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#274060',
        padding: { left: 14, right: 14, top: 8, bottom: 8 }
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    start.on('pointerdown', () => {
      const snap = this.state.snapshot();

      SaveSystem.update({
        skin: snap.skin,
        equipped: snap.equipped,
        equipmentInventory: snap.inventory
      });

      this.registry.set('appearance', this.state.appearance());
      this.scene.start('GameScene');
    });

    if (save) {
      const reset = this.add
        .text(w - 16, 64, 'Начать заново', {
          fontSize: '14px',
          color: '#ffb4b4',
          backgroundColor: '#3a1d20',
          padding: { left: 10, right: 10, top: 6, bottom: 6 }
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });

      reset.on('pointerdown', () => {
        SaveSystem.clear();
        this.state = new EquipmentState();
        this.refresh();
      });
    }

    // превью
    this.previewX = Math.max(90, w * 0.22);
    this.previewFeetY = topH * 0.92;
    this.previewScale = Math.max(4, Math.min(6, Math.floor(topH / 70)));
    this.previewImage = this.add.image(
      this.previewX,
      this.previewFeetY,
      getHeroTexture(this, this.state.appearance(), 'down', 0)
    );
    this.previewImage.setOrigin(0.5, 1);

    // слоты
    const sx = Math.min(w * 0.52, w - this.cell * 2);
    const step = Math.min(this.cell + 14, (topH - 110) / EQUIPMENT_SLOTS.length);

    EQUIPMENT_SLOTS.forEach((slot, i) => {
      const y = 110 + i * step + this.cell / 2;

      const frame = this.add
        .rectangle(sx, y, this.cell, this.cell, 0x1a2233)
        .setStrokeStyle(2, 0x3a4a6a);

      this.slotFrames.set(slot, frame);
      this.slotRects.set(slot, new Phaser.Geom.Rectangle(sx - this.cell / 2, y - this.cell / 2, this.cell, this.cell));
      this.slotPos.set(slot, { x: sx, y });

      this.add.text(sx + this.cell / 2 + 8, y, SLOT_LABELS[slot], {
        fontSize: '13px',
        color: '#9fb0cc'
      }).setOrigin(0, 0.5);
    });

    // инвентарь
    this.add.rectangle(w / 2, h - bottomH / 2, w, bottomH, 0x10141c);
    this.add.text(16, h - bottomH + 8, 'Инвентарь', { fontSize: '14px', color: '#cfd6e6' });

    this.invCols = Math.max(4, Math.floor((w - 24) / (this.cell + 10)));
    this.invX0 = 16;
    this.invY0 = h - bottomH + 34;

    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      this.children.bringToTop(obj);
      obj.setAlpha(0.85);
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, dragX: number, dragY: number) => {
      obj.setPosition(dragX, dragY);
      this.highlightSlots(ITEMS[obj.getData('itemId') as string].slot, pointer);
    });

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      this.onDragEnd(pointer, obj);
    });

    this.refresh();
  }

  private onDragEnd(pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container): void {
    obj.setAlpha(1);

    const id = obj.getData('itemId') as string;
    const from = obj.getData('from') as 'inventory' | EquipmentSlot;
    const def = ITEMS[id];
    const over = this.slotAt(pointer.x, pointer.y);
    const moved = Math.hypot(pointer.upX - pointer.downX, pointer.upY - pointer.downY);

    if (moved < 8) {
      if (from === 'inventory') {
        this.state.equip(id);
      } else {
        this.state.unequip(from);
      }
    } else if (from === 'inventory') {
      if (over === def.slot) {
        this.state.equip(id);
      }
    } else if (over !== from) {
      this.state.unequip(from);
    }

    this.refresh();
  }

  private highlightSlots(validSlot: EquipmentSlot, pointer: Phaser.Input.Pointer): void {
    const over = this.slotAt(pointer.x, pointer.y);

    for (const slot of EQUIPMENT_SLOTS) {
      const frame = this.slotFrames.get(slot)!;

      if (slot === validSlot) {
        frame.setStrokeStyle(3, over === slot ? 0x69f0ae : 0x3f7a44);
      } else {
        frame.setStrokeStyle(2, 0x3a4a6a);
      }
    }
  }

  private slotAt(x: number, y: number): EquipmentSlot | null {
    for (const slot of EQUIPMENT_SLOTS) {
      if (this.slotRects.get(slot)!.contains(x, y)) {
        return slot;
      }
    }
    return null;
  }

  private makeItemContainer(id: string, from: 'inventory' | EquipmentSlot, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const icon = this.add.image(0, 0, getItemIconTexture(this, id));
    icon.setScale(this.cell / 40);
    container.add(icon);

    container.setInteractive(
      new Phaser.Geom.Rectangle(-this.cell / 2, -this.cell / 2, this.cell, this.cell),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(container);

    container.setData('itemId', id);
    container.setData('from', from);

    return container;
  }

  private refresh(): void {
    this.previewImage.setTexture(getHeroTexture(this, this.state.appearance(), 'down', 0));
    this.previewImage.setScale(this.previewScale);

    for (const c of this.dynamic) {
      c.destroy();
    }
    this.dynamic = [];

    for (const slot of EQUIPMENT_SLOTS) {
      this.slotFrames.get(slot)!.setStrokeStyle(2, 0x3a4a6a);

      const id = this.state.getEquipped(slot);
      if (id) {
        const pos = this.slotPos.get(slot)!;
        this.dynamic.push(this.makeItemContainer(id, slot, pos.x, pos.y));
      }
    }

    const inv = this.state.getInventory();
    inv.forEach((id, i) => {
      const col = i % this.invCols;
      const row = Math.floor(i / this.invCols);
      const x = this.invX0 + col * (this.cell + 10) + this.cell / 2;
      const y = this.invY0 + row * (this.cell + 10) + this.cell / 2;
      this.dynamic.push(this.makeItemContainer(id, 'inventory', x, y));
    });
  }
}