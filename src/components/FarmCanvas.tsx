import { useRef, useEffect, useCallback } from 'react';
import type { GameState, FarmStage } from '../types/game';
import { HHKB_ROWS } from '../data/hhkbLayout';
import type { AnimationState } from '../hooks/useGameState';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CROP_MAP } from '../data/crops';
import {
  computeBlockVertices,
  computeCanvasBounds,
  hitTestBlock,
  polygonCentroid,
  type IsoBlock,
} from '../utils/isometric';
import {
  SCALE,
  TILE_W,
  TILE_H,
  type DrawContext,
  drawHeatmapTile,
  drawFarmBlock,
  drawHitFlash,
  drawStageEmoji,
  drawHarvestReadyGlow,
  drawGoldenEffect,
  drawPestOverlay,
  drawCountdownTimer,
  drawKeyLabel,
  drawHarvestAnimation,
  drawPestRemovalAnimation,
  drawFertilizeAnimation,
} from './farmRenderers';
import {
  updateFarmer,
  renderFarmer,
  cleanupFarmer,
} from './roamingCharacters';
import {
  updateDucks,
  renderDucks,
  cleanupDucks,
  setMouseGridPosition,
} from './animalCharacters';
import {
  updateDogs,
  renderDogs,
  cleanupDogs,
  setDogMousePosition,
} from './dogCharacter';
import {
  updateCats,
  renderCats,
  cleanupCats,
  setCatMousePosition,
} from './catCharacter';

const PADDING = 16;
const HIT_FLASH_DURATION = 200;
const HARVEST_DURATION = 1200;
const FLIP_ANIM_DURATION = 400;

const sd = (base: number) => Math.round(base * SCALE);

const STAGE_DEPTH: Record<FarmStage, number> = {
  empty: sd(8),
  watering: sd(12),
  sprout: sd(16),
  tree: sd(22),
  fruit: sd(26),
  fallow: sd(6),
  overworked: sd(10),
};

const MAX_DEPTH = sd(26);

const STAGE_COLORS: Record<FarmStage, string> = {
  empty: '#8B7355',
  watering: '#4A90D9',
  sprout: '#7EC850',
  tree: '#2D8B46',
  fruit: '#FF6B6B',
  fallow: '#8B8B8B',
  overworked: '#D4845A',
};

const RARITY_BLOCK_COLORS: Record<string, string> = {
  common: '#FF6B6B',
  uncommon: '#4ADE80',
  rare: '#60A5FA',
  legendary: '#F59E0B',
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Precompute bounds for both orientations (canvas size is the same)
const _boundsNormal = computeCanvasBounds(TILE_W, TILE_H, MAX_DEPTH, PADDING, 1);
const _boundsFlipped = computeCanvasBounds(TILE_W, TILE_H, MAX_DEPTH, PADDING, -1);
export const CANVAS_WIDTH = _boundsNormal.width;
export const CANVAS_HEIGHT = _boundsNormal.height;

/** Map mouse event to logical canvas coordinates (accounts for CSS transform + dpr). */
function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, logicalW: number, logicalH: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (logicalW / rect.width),
    y: (e.clientY - rect.top) * (logicalH / rect.height),
  };
}

/** Convert screen coordinates back to approximate grid position. */
function screenToGrid(
  screenX: number,
  screenY: number,
  tileW: number,
  tileH: number,
  originX: number,
  originY: number,
  flipFactor: number,
): { col: number; row: number } {
  const sx = (screenX - originX) / (tileW / 2 * flipFactor);
  const sy = (screenY - originY) / (tileH / 2);
  const col = (sx + sy) / 2;
  const row = (sy - sx) / 2;
  return { col, row };
}

interface FarmCanvasProps {
  gameState: GameState;
  animations: AnimationState;
  onHarvest: (keyCode: string) => void;
  onRemovePest: (keyCode: string) => void;
  onFertilize: (keyCode: string) => void;
  onDuckEaten: (duckId: string) => void;
  onDuckAttacked: (duckId: string) => void;
  onWaterToFish: (keyCode: string) => void;
  onDogScared: (dogId: string, fleeCol: number, fleeRow: number) => void;
  onDragStart?: () => void;
  viewMode: 'farm' | 'heatmap' | 'flat';
  rotation: number;
  locked?: boolean;
}

export function FarmCanvas({ gameState, animations, onHarvest, onRemovePest, onFertilize, onDuckEaten, onDuckAttacked, onWaterToFish, onDogScared, onDragStart, viewMode, rotation, locked }: FarmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cellBlocksRef = useRef<Map<string, IsoBlock>>(new Map());
  const rafRef = useRef<number>(0);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    return () => {
      cleanupFarmer();
      cleanupDucks();
      cleanupDogs();
      cleanupCats();
    };
  }, []);

  const canvasWidth = CANVAS_WIDTH;
  const canvasHeight = CANVAS_HEIGHT;

  // Flip animation state
  const flipAnimRef = useRef({
    from: 1,
    to: 1,
    startTime: 0,
  });
  const flipFactorRef = useRef(1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const now = Date.now();
    let hasActiveAnimations = false;

    // Compute animated flipFactor
    const anim = flipAnimRef.current;
    const elapsed = performance.now() - anim.startTime;
    const animProgress = anim.startTime === 0 ? 1 : Math.min(1, elapsed / FLIP_ANIM_DURATION);
    const eased = easeInOutCubic(animProgress);
    const flipFactor = anim.from + (anim.to - anim.from) * eased;
    flipFactorRef.current = flipFactor;
    if (animProgress < 1) hasActiveAnimations = true;

    // Interpolate originX between normal and flipped bounds
    const t = (1 - flipFactor) / 2; // 0 = normal, 1 = flipped
    const originX = _boundsNormal.originX * (1 - t) + _boundsFlipped.originX * t;
    const originY = _boundsNormal.originY;

    // Isometric text transform parameters
    const txNx = TILE_W / 2;
    const txNy = TILE_H / 2;
    const txLen = Math.sqrt(txNx * txNx + txNy * txNy);

    const dc: DrawContext = { ctx, flipFactor, originX, originY, now, txNx, txNy, txLen };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    cellBlocksRef.current.clear();

    // ── Heatmap view ──
    if (viewMode === 'heatmap') {
      const pressValues = Object.values(gameStateRef.current.totalKeyPresses);
      const maxPresses = pressValues.length > 0 ? Math.max(...pressValues, 1) : 1;

      HHKB_ROWS.forEach((row, rowIdx) => {
        let colOffset = 0;
        row.forEach((keyDef) => {
          const count = gameStateRef.current.totalKeyPresses[keyDef.keyCode] || 0;
          const block = drawHeatmapTile(dc, keyDef.label, colOffset, rowIdx, keyDef.width, count, maxPresses);
          cellBlocksRef.current.set(keyDef.keyCode, block);
          colOffset += keyDef.width;
        });
      });

      if (hasActiveAnimations) {
        rafRef.current = requestAnimationFrame(draw);
      }
      return;
    }

    // ── Flat (2D top-down) view ──
    if (viewMode === 'flat') {
      const keyUnit = TILE_W * 0.7; // width of a 1u key
      const keyH = TILE_H * 1.4;    // height of each key row
      const gap = 2;
      const flatPadding = PADDING;
      const totalCols = HHKB_ROWS.reduce((max, row) => {
        const rowCols = row.reduce((sum, k) => sum + k.width, 0);
        return Math.max(max, rowCols);
      }, 0);
      const flatOffsetX = (canvasWidth - totalCols * keyUnit) / 2;
      const flatOffsetY = (canvasHeight - HHKB_ROWS.length * (keyH + gap)) / 2;

      HHKB_ROWS.forEach((row, rowIdx) => {
        let colOffset = 0;
        row.forEach((keyDef) => {
          const cell = gameStateRef.current.cells[keyDef.keyCode];
          const stage = cell?.stage || 'empty';

          let color = STAGE_COLORS[stage];
          if (stage === 'fruit' && cell?.cropId) {
            if (cell.isGolden) {
              color = '#FFD700';
            } else {
              const crop = CROP_MAP[cell.cropId];
              if (crop) color = RARITY_BLOCK_COLORS[crop.rarity];
            }
          }

          const x = flatOffsetX + colOffset * keyUnit;
          const y = flatOffsetY + rowIdx * (keyH + gap);
          const w = keyDef.width * keyUnit - gap;
          const h = keyH;

          // Create a fake IsoBlock for hit testing (using the rectangular corners)
          const topPoly = [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ];
          const fakeBlock: IsoBlock = { top: topPoly, right: [], front: [] };
          cellBlocksRef.current.set(keyDef.keyCode, fakeBlock);

          // Animation
          const hitTime = animations.recentHits.get(keyDef.keyCode);
          const hitAge = hitTime ? now - hitTime : Infinity;
          const isHitFlashing = hitAge < HIT_FLASH_DURATION;
          if (isHitFlashing) hasActiveAnimations = true;
          if (hitTime && hitAge > HIT_FLASH_DURATION) {
            animations.recentHits.delete(keyDef.keyCode);
          }

          const harvestTime = animations.recentHarvests.get(keyDef.keyCode);
          const harvestAge = harvestTime ? now - harvestTime : Infinity;
          const isHarvestSparkle = harvestAge < HARVEST_DURATION;
          if (isHarvestSparkle) hasActiveAnimations = true;
          if (harvestTime && harvestAge > HARVEST_DURATION) {
            animations.recentHarvests.delete(keyDef.keyCode);
            animations.harvestFruits.delete(keyDef.keyCode);
            animations.harvestGolden.delete(keyDef.keyCode);
          }

          // Draw key background
          ctx.save();
          if (isHitFlashing) {
            const flash = 1 - hitAge / HIT_FLASH_DURATION;
            const scale = 1 + flash * 0.08;
            ctx.translate(x + w / 2, y + h / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(x + w / 2), -(y + h / 2));
          }

          // Rounded rect
          const radius = 4;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Golden glow
          if (cell?.isGolden && stage === 'fruit') {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          // Pest indicator
          if (cell?.hasPest && ['watering', 'sprout', 'tree', 'fruit'].includes(stage)) {
            hasActiveAnimations = true;
            const bugBounce = Math.sin(now / 200) * 2;
            ctx.font = `${Math.round(h * 0.4)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐛', x + w / 2, y + h / 2 + bugBounce);
          }

          // Emoji for stage
          if (!cell?.hasPest && stage !== 'empty' && stage !== 'fallow' && stage !== 'overworked') {
            let emoji = '';
            if (stage === 'fruit' && cell?.cropId) {
              const crop = CROP_MAP[cell.cropId];
              if (crop) emoji = crop.emoji;
            } else if (stage === 'watering') emoji = '💧';
            else if (stage === 'sprout') emoji = '🌱';
            else if (stage === 'tree') emoji = '🌳';

            if (emoji) {
              ctx.font = `${Math.round(h * 0.45)}px serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(emoji, x + w / 2, y + h / 2 - 2);
            }
          }

          // Key label
          if (keyDef.label && !keyDef.keyCode.startsWith('_gap')) {
            ctx.font = `bold ${Math.round(h * 0.22)}px system-ui, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(keyDef.label, x + w / 2, y + h - 3);
          }

          ctx.restore();

          // Harvest sparkle animation
          if (isHarvestSparkle && harvestTime) {
            const progress = harvestAge / HARVEST_DURATION;
            const cropId = animations.harvestFruits.get(keyDef.keyCode) || 'apple';
            const crop = CROP_MAP[cropId];
            if (crop) {
              ctx.save();
              ctx.globalAlpha = 1 - progress;
              ctx.font = `${Math.round(h * 0.5)}px serif`;
              ctx.textAlign = 'center';
              ctx.fillText(crop.emoji, x + w / 2, y + h / 2 - progress * 30);
              ctx.restore();
            }
          }

          colOffset += keyDef.width;
        });
      });

      hasActiveAnimations = true; // Keep alive for animations
      if (hasActiveAnimations) {
        rafRef.current = requestAnimationFrame(draw);
      }
      return;
    }

    // ── Farm view ──
    HHKB_ROWS.forEach((row, rowIdx) => {
      let colOffset = 0;

      row.forEach((keyDef) => {
        const cell = gameStateRef.current.cells[keyDef.keyCode];
        const stage = cell?.stage || 'empty';
        const depth = STAGE_DEPTH[stage];

        let color = STAGE_COLORS[stage];
        if (stage === 'fruit' && cell?.cropId) {
          if (cell.isGolden) {
            color = '#FFD700'; // golden block
          } else {
            const crop = CROP_MAP[cell.cropId];
            if (crop) color = RARITY_BLOCK_COLORS[crop.rarity];
          }
        }

        const block = computeBlockVertices(
          colOffset, rowIdx, keyDef.width, depth,
          TILE_W, TILE_H, originX, originY, flipFactor,
        );
        cellBlocksRef.current.set(keyDef.keyCode, block);

        // Animation ages + cleanup
        const hitTime = animations.recentHits.get(keyDef.keyCode);
        const hitAge = hitTime ? now - hitTime : Infinity;
        const isHitFlashing = hitAge < HIT_FLASH_DURATION;

        const harvestTime = animations.recentHarvests.get(keyDef.keyCode);
        const harvestAge = harvestTime ? now - harvestTime : Infinity;
        const isHarvestSparkle = harvestAge < HARVEST_DURATION;

        if (isHitFlashing || isHarvestSparkle) hasActiveAnimations = true;

        if (hitTime && hitAge > HIT_FLASH_DURATION) {
          animations.recentHits.delete(keyDef.keyCode);
        }
        if (harvestTime && harvestAge > HARVEST_DURATION) {
          animations.recentHarvests.delete(keyDef.keyCode);
          animations.harvestFruits.delete(keyDef.keyCode);
          animations.harvestGolden.delete(keyDef.keyCode);
        }

        const pestRemovalTime = animations.recentPestRemovals.get(keyDef.keyCode);
        const pestRemovalAge = pestRemovalTime ? now - pestRemovalTime : Infinity;
        const isPestRemoving = pestRemovalAge < HARVEST_DURATION;
        if (isPestRemoving) hasActiveAnimations = true;
        if (pestRemovalTime && pestRemovalAge > HARVEST_DURATION) {
          animations.recentPestRemovals.delete(keyDef.keyCode);
        }

        // Block + hit flash
        ctx.save();
        if (isHitFlashing) {
          drawHitFlash(ctx, block, color, hitAge, HIT_FLASH_DURATION);
        } else {
          drawFarmBlock(ctx, block, color);
        }

        // Decorations
        const topCenter = polygonCentroid(block.top);

        drawStageEmoji(ctx, stage, cell, topCenter, now);

        if (stage === 'fruit') {
          hasActiveAnimations = true;
          drawHarvestReadyGlow(dc, block, color);
        }

        if (cell?.isGolden && stage === 'fruit') {
          hasActiveAnimations = true;
          drawGoldenEffect(dc, block, cell, topCenter);
        }

        if (cell?.hasPest && ['watering', 'sprout', 'tree', 'fruit'].includes(stage)) {
          hasActiveAnimations = true;
          drawPestOverlay(ctx, topCenter, now);
        }

        if ((stage === 'overworked' && cell?.overworkedUntil) || (stage === 'fallow' && cell?.fallowUntil)) {
          hasActiveAnimations = true;
          drawCountdownTimer(ctx, cell!, stage, topCenter, now);
        }

        if (keyDef.label) {
          drawKeyLabel(dc, keyDef.label, cell, stage, color, topCenter);
        }

        ctx.restore();

        // Post-restore animations (drawn outside the hit-flash scale transform)
        if (isHarvestSparkle && harvestTime) {
          const cropId = animations.harvestFruits.get(keyDef.keyCode) || 'apple';
          const wasGolden = animations.harvestGolden.get(keyDef.keyCode) || false;
          drawHarvestAnimation(ctx, block, cropId, wasGolden, harvestAge, HARVEST_DURATION, harvestTime);
        }

        if (isPestRemoving && pestRemovalTime) {
          drawPestRemovalAnimation(ctx, block, pestRemovalAge, HARVEST_DURATION, pestRemovalTime);
        }

        const fertilizeTime = animations.recentFertilizes.get(keyDef.keyCode);
        const fertilizeAge = fertilizeTime ? now - fertilizeTime : Infinity;
        const isFertilizing = fertilizeAge < HARVEST_DURATION;
        if (isFertilizing) hasActiveAnimations = true;
        if (fertilizeTime && fertilizeAge > HARVEST_DURATION) {
          animations.recentFertilizes.delete(keyDef.keyCode);
        }
        if (isFertilizing && fertilizeTime) {
          drawFertilizeAnimation(ctx, block, fertilizeAge, HARVEST_DURATION, fertilizeTime);
        }

        colOffset += keyDef.width;
      });
    });

    // ── Farmer character ──
    updateFarmer(now, gameStateRef.current.cells, {
      onHarvest: (keyCode: string) => onHarvest(keyCode),
      onRemovePest: (keyCode: string) => onRemovePest(keyCode),
    }, gameStateRef.current.workers, gameStateRef.current.workerSpeed);
    if (overlayRef.current) {
      renderFarmer(overlayRef.current, originX, originY, flipFactor, TILE_W, TILE_H);
    }
    // ── Duck characters ──
    updateDucks(now, gameStateRef.current.animals, gameStateRef.current.cells, {
      onHarvest: (keyCode: string) => onHarvest(keyCode),
      onFertilize: (keyCode: string) => onFertilize(keyCode),
      onDuckEaten: (duckId: string) => onDuckEaten(duckId),
    });
    if (overlayRef.current) {
      renderDucks(
        gameStateRef.current.animals,
        overlayRef.current,
        originX, originY, flipFactor, TILE_W, TILE_H,
      );
    }
    // ── Dog character ──
    updateDogs(now, gameStateRef.current.animals, {
      onDuckAttacked: (duckId: string) => onDuckAttacked(duckId),
    });
    if (overlayRef.current) {
      renderDogs(
        gameStateRef.current.animals,
        overlayRef.current,
        originX, originY, flipFactor, TILE_W, TILE_H,
      );
    }
    // ── Cat character ──
    updateCats(now, gameStateRef.current.animals, gameStateRef.current.cells, {
      onWaterToFish: (keyCode: string) => onWaterToFish(keyCode),
      onDogScared: (dogId: string, fleeCol: number, fleeRow: number) => onDogScared(dogId, fleeCol, fleeRow),
    });
    if (overlayRef.current) {
      renderCats(
        gameStateRef.current.animals,
        overlayRef.current,
        originX, originY, flipFactor, TILE_W, TILE_H,
      );
    }

    hasActiveAnimations = true; // Keep loop alive for farmer + ducks + dog + cat

    if (hasActiveAnimations) {
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [animations, viewMode, onHarvest, onRemovePest, onFertilize, onDuckEaten, onDuckAttacked, onWaterToFish, onDogScared]);

  // Kick off flip animation when rotation changes
  useEffect(() => {
    const target = rotation;
    if (target !== flipAnimRef.current.to) {
      flipAnimRef.current = {
        from: flipFactorRef.current,
        to: target,
        startTime: performance.now(),
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [rotation, draw]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, draw]);

  const harvestedRef = useRef<Set<string>>(new Set());
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (viewModeRef.current === 'heatmap') { canvas.style.cursor = 'default'; return; }
    const { x, y } = canvasCoords(e, canvas, canvasWidth, canvasHeight);

    // Update mouse grid position for duck flee behavior
    const t = (1 - flipFactorRef.current) / 2;
    const interpOriginX = _boundsNormal.originX * (1 - t) + _boundsFlipped.originX * t;
    const gridPos = screenToGrid(x, y, TILE_W, TILE_H, interpOriginX, _boundsNormal.originY, flipFactorRef.current);
    setMouseGridPosition(gridPos.col, gridPos.row);
    setDogMousePosition(gridPos.col, gridPos.row);
    setCatMousePosition(gridPos.col, gridPos.row);

    let overFruit = false;
    for (const [keyCode, block] of cellBlocksRef.current.entries()) {
      if (hitTestBlock(x, y, block)) {
        const cell = gameStateRef.current.cells[keyCode];

        if (cell?.hasPest) {
          overFruit = true;
          if (!harvestedRef.current.has(keyCode + '_pest')) {
            harvestedRef.current.add(keyCode + '_pest');
            onRemovePest(keyCode);
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(draw);
          }
        } else {
          harvestedRef.current.delete(keyCode + '_pest');
        }

        if (cell?.stage === 'fruit') {
          overFruit = true;
          if (!harvestedRef.current.has(keyCode)) {
            harvestedRef.current.add(keyCode);
            onHarvest(keyCode);
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(draw);
          }
        }
      } else {
        harvestedRef.current.delete(keyCode);
        harvestedRef.current.delete(keyCode + '_pest');
      }
    }
    canvas.style.cursor = overFruit ? 'grab' : 'default';
  }, [onHarvest, onRemovePest, draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (locked) return;
    onDragStart?.();
    getCurrentWindow().startDragging();
  }, [onDragStart, locked]);

  const dpr = window.devicePixelRatio || 1;

  return (
    <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth * dpr}
        height={canvasHeight * dpr}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ display: 'block', width: canvasWidth, height: canvasHeight }}
      />
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: canvasWidth,
          height: canvasHeight,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
