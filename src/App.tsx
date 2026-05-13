import { useCallback, useEffect, useRef, useState } from 'react';
import { FarmCanvas, CANVAS_WIDTH, CANVAS_HEIGHT } from './components/FarmCanvas';
import { StatsPanel } from './components/StatsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useGameState } from './hooks/useGameState';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';
import { useI18n } from './i18n';
import './App.css';

function PermissionScreen() {
  const { t } = useI18n();
  const handleOpen = useCallback(() => {
    invoke('request_accessibility');
  }, []);

  return (
    <div className="permission-screen" data-tauri-drag-region>
      <div className="permission-card">
        <div className="permission-icon">⌨️</div>
        <h1>{t.keyboardAccess}</h1>
        <p dangerouslySetInnerHTML={{ __html: t.permissionDescription }} />
        <button onClick={handleOpen}>{t.openSystemSettings}</button>
        <span className="permission-hint">{t.waitingForPermission}</span>
      </div>
    </div>
  );
}

function App() {
  const { gameState, harvest, removePest, hireWorker, upgradeWorkerSpeed, fertilize, updateAnimals, duckAttacked, waterToFish, dogScared, animations } = useGameState();
  const [scale, setScale] = useState(1);
  const [showStats, setShowStats] = useState(false);
  const [viewMode, setViewMode] = useState<'farm' | 'heatmap' | 'flat'>('farm');
  // Isometric horizontal flip factor for the internal rendering (-1 to 1)
  const [isoRotation, setIsoRotation] = useState(1);
  // CSS 3D rotation angles (degrees)
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  // Perspective preset: 'left' | 'right'
  const [perspective, setPerspective] = useState<'left' | 'right'>('left');
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const rotateStartRef = useRef({ x: 0, y: 0, startRX: 0, startRY: 0 });

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    const check = async () => {
      const granted = await invoke<boolean>('check_accessibility');
      if (cancelled) return;
      if (granted) {
        setPermissionGranted(true);
        invoke('start_listener');
      } else {
        setPermissionGranted(false);
        timer = window.setInterval(async () => {
          const ok = await invoke<boolean>('check_accessibility');
          if (ok && !cancelled) {
            setPermissionGranted(true);
            invoke('start_listener');
            clearInterval(timer);
          }
        }, 1500);
      }
    };
    check();
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const s = Math.min(
        window.innerWidth / CANVAS_WIDTH,
        window.innerHeight / CANVAS_HEIGHT,
      );
      setScale(s);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    const unlisten = listen('toggle-stats', () => {
      setShowStats((v) => !v);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  useEffect(() => {
    const unlisten = listen('toggle-heatmap', () => {
      setViewMode((v) => {
        if (v === 'farm') return 'flat';
        if (v === 'flat') return 'heatmap';
        return 'farm';
      });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  useEffect(() => {
    const unlisten = listen('toggle-perspective', () => {
      setPerspective((p) => {
        if (p === 'left') return 'right';
        return 'left';
      });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // Listen for open-settings event from tray
  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      setShowSettings(true);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // App-level keyboard shortcut for stats
  const statsShortcutRef = useRef<string[]>([]);
  // App-level keyboard shortcut for lock
  const lockShortcutRef = useRef<string[]>([]);
  useEffect(() => {
    const settingsStore = new LazyStore('store.json');
    settingsStore.get<string[]>('shortcut_stats').then((saved) => {
      if (saved && saved.length > 0) statsShortcutRef.current = saved;
    });
    settingsStore.get<string[]>('shortcut_lock').then((saved) => {
      if (saved && saved.length > 0) lockShortcutRef.current = saved;
    });

    const matchKeys = (pressed: string[], target: string[]) =>
      pressed.length === target.length && pressed.every((k, i) => k === target[i]);

    const handler = (e: KeyboardEvent) => {
      const pressed: string[] = [];
      if (e.ctrlKey) pressed.push('Ctrl');
      if (e.altKey) pressed.push('Alt');
      if (e.shiftKey) pressed.push('Shift');
      if (e.metaKey) pressed.push('Super');
      const key = e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        pressed.push(key.length === 1 ? key.toUpperCase() : key);
      }

      if (statsShortcutRef.current.length > 0 && matchKeys(pressed, statsShortcutRef.current)) {
        e.preventDefault();
        setShowStats((v) => !v);
      }
      if (lockShortcutRef.current.length > 0 && matchKeys(pressed, lockShortcutRef.current)) {
        e.preventDefault();
        setIsLocked((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Apply perspective preset
  useEffect(() => {
    if (perspective === 'left') {
      setRotateX(0);
      setRotateY(0);
      setIsoRotation(1);
    } else {
      setRotateX(0);
      setRotateY(0);
      setIsoRotation(-1);
    }
  }, [perspective]);

  useEffect(() => {
    if (!isDragging) return;
    const end = () => setIsDragging(false);
    window.addEventListener('mouseup', end);
    window.addEventListener('blur', end);
    const timer = setTimeout(end, 5000);
    return () => {
      window.removeEventListener('mouseup', end);
      window.removeEventListener('blur', end);
      clearTimeout(timer);
    };
  }, [isDragging]);

  // Rotation drag handling — full 2D: horizontal = rotateY, vertical = rotateX
  useEffect(() => {
    if (!isRotating) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - rotateStartRef.current.x;
      const dy = e.clientY - rotateStartRef.current.y;
      // 2px of mouse movement = 1 degree of rotation
      const newRY = rotateStartRef.current.startRY + dx * 0.5;
      const newRX = rotateStartRef.current.startRX - dy * 0.5;
      // Clamp to reasonable range
      setRotateY(Math.max(-60, Math.min(60, newRY)));
      setRotateX(Math.max(-70, Math.min(55, newRX)));
    };
    const handleUp = () => setIsRotating(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isRotating]);

  const handleDragStart = useCallback(() => {
    if (isLocked) return;
    setIsDragging(true);
  }, [isLocked]);

  const handleDuckEaten = useCallback((duckId: string) => {
    const now = Date.now();
    const updatedAnimals = gameState.animals.map(a =>
      a.id === duckId ? { ...a, state: 'dead' as const, diedAt: now } : a
    );
    updateAnimals(updatedAnimals);
  }, [gameState.animals, updateAnimals]);

  const handleResizeGrip = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    getCurrentWindow().startResizeDragging('BottomRight' as never);
  }, [isLocked]);

  const handleRotateStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    rotateStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startRX: rotateX,
      startRY: rotateY,
    };
    setIsRotating(true);
  }, [rotateX, rotateY]);

  const handleRotateReset = useCallback((e: React.MouseEvent) => {
    // Double-click to reset to left view
    e.preventDefault();
    e.stopPropagation();
    setRotateX(0);
    setRotateY(0);
    setPerspective('left');
  }, []);

  if (permissionGranted === null) return null;
  if (!permissionGranted) return <PermissionScreen />;

  // Compute visual angle for the handle indicator from both axes
  const indicatorAngle = Math.atan2(rotateY, -rotateX) * 180 / Math.PI;
  const indicatorLength = Math.min(10, Math.sqrt(rotateX * rotateX + rotateY * rotateY) / 4);

  return (
    <div className={`app-container${isDragging ? ' is-dragging' : ''}`}>
      <div
        className="canvas-scaler"
        style={{
          transform: viewMode === 'flat'
            ? `scale(${scale})`
            : `scale(${scale}) perspective(1800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        <FarmCanvas gameState={gameState} animations={animations} onHarvest={harvest} onRemovePest={removePest} onFertilize={fertilize} onDuckEaten={handleDuckEaten} onDuckAttacked={duckAttacked} onWaterToFish={waterToFish} onDogScared={dogScared} onDragStart={handleDragStart} viewMode={viewMode} rotation={isoRotation} locked={isLocked} />
      </div>
      {showStats && (
        <StatsPanel gameState={gameState} onClose={() => setShowStats(false)} onHireWorker={hireWorker} onUpgradeSpeed={upgradeWorkerSpeed} />
      )}
      {showSettings && (
        <SettingsPanel
          viewMode={viewMode}
          perspective={perspective}
          onViewModeChange={setViewMode}
          onPerspectiveChange={setPerspective}
          onClose={() => {
            setShowSettings(false);
            // Reload shortcuts from store
            const s = new LazyStore('store.json');
            s.get<string[]>('shortcut_stats').then((saved) => {
              statsShortcutRef.current = saved && saved.length > 0 ? saved : [];
            });
            s.get<string[]>('shortcut_lock').then((saved) => {
              lockShortcutRef.current = saved && saved.length > 0 ? saved : [];
            });
          }}
        />
      )}
      {/* Rotation handle at bottom center */}
      <div
        className={`rotate-handle${isRotating ? ' is-active' : ''}`}
        onMouseDown={handleRotateStart}
        onDoubleClick={handleRotateReset}
        title={`${rotateX.toFixed(0)}° / ${rotateY.toFixed(0)}°`}
      >
        <svg width="28" height="28" viewBox="0 0 28 28">
          {/* Outer ring */}
          <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          {/* Tick marks at 0°, 90°, 180°, 270° */}
          <line x1="14" y1="2" x2="14" y2="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="26" y1="14" x2="23" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="14" y1="26" x2="14" y2="23" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="2" y1="14" x2="5" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          {/* Rotation indicator line */}
          <line
            x1="14" y1="14"
            x2={14 + indicatorLength * Math.cos((indicatorAngle - 90) * Math.PI / 180)}
            y2={14 + indicatorLength * Math.sin((indicatorAngle - 90) * Math.PI / 180)}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Center dot */}
          <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>
      <div className="resize-grip" onMouseDown={handleResizeGrip}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle cx="10" cy="2" r="1" fill="rgba(255,255,255,0.4)" />
          <circle cx="6" cy="6" r="1" fill="rgba(255,255,255,0.4)" />
          <circle cx="10" cy="6" r="1" fill="rgba(255,255,255,0.4)" />
          <circle cx="2" cy="10" r="1" fill="rgba(255,255,255,0.4)" />
          <circle cx="6" cy="10" r="1" fill="rgba(255,255,255,0.4)" />
          <circle cx="10" cy="10" r="1" fill="rgba(255,255,255,0.4)" />
        </svg>
      </div>
      {/* Lock indicator */}
      {isLocked && (
        <div className="lock-indicator">🔒</div>
      )}
    </div>
  );
}

export default App;
