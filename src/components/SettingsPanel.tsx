import { useState, useCallback, useEffect } from 'react';
import { useI18n } from '../i18n';
import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';

const store = new LazyStore('store.json');

interface SettingsPanelProps {
  viewMode: 'farm' | 'heatmap' | 'flat';
  perspective: 'left' | 'right';
  onViewModeChange: (mode: 'farm' | 'heatmap' | 'flat') => void;
  onPerspectiveChange: (p: 'left' | 'right') => void;
  onClose: () => void;
}

// Earthy palette
const C = {
  bg: '#1e1a16',
  tile: '#2a2420',
  tileBorder: '#3a332b',
  text: '#d4c8b8',
  textDim: '#7a6e5e',
  border: '#3a332b',
  accent: '#4ADE80',
};

function formatShortcut(keys: string[]): string {
  if (keys.length === 0) return '';
  return keys.join(' + ');
}

function keyEventToKeys(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (e.metaKey) keys.push('Super');
  const key = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    // Normalize key name
    if (key.length === 1) {
      keys.push(key.toUpperCase());
    } else {
      keys.push(key);
    }
  }
  return keys;
}

export function SettingsPanel({ viewMode, perspective, onViewModeChange, onPerspectiveChange, onClose }: SettingsPanelProps) {
  const { t } = useI18n();
  const [toggleWindowShortcut, setToggleWindowShortcut] = useState<string[]>([]);
  const [statsShortcut, setStatsShortcut] = useState<string[]>([]);
  const [lockShortcut, setLockShortcut] = useState<string[]>([]);
  const [recording, setRecording] = useState<'toggle' | 'stats' | 'lock' | null>(null);
  const [tempKeys, setTempKeys] = useState<string[]>([]);

  // Load saved shortcuts on mount
  useEffect(() => {
    store.get<string[]>('shortcut_toggle_window').then((saved) => {
      if (saved && saved.length > 0) setToggleWindowShortcut(saved);
    });
    store.get<string[]>('shortcut_stats').then((saved) => {
      if (saved && saved.length > 0) setStatsShortcut(saved);
    });
    store.get<string[]>('shortcut_lock').then((saved) => {
      if (saved && saved.length > 0) setLockShortcut(saved);
    });
  }, []);

  // Key recording
  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const keys = keyEventToKeys(e);
      if (keys.length > 0 && keys.some(k => !['Ctrl', 'Alt', 'Shift', 'Super'].includes(k))) {
        // Complete recording — has at least one non-modifier key
        setTempKeys(keys);
        if (recording === 'toggle') {
          setToggleWindowShortcut(keys);
        } else if (recording === 'stats') {
          setStatsShortcut(keys);
        } else if (recording === 'lock') {
          setLockShortcut(keys);
        }
        setRecording(null);
      } else {
        setTempKeys(keys);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording]);

  const startRecording = useCallback((which: 'toggle' | 'stats' | 'lock') => {
    setRecording(which);
    setTempKeys([]);
  }, []);

  const clearShortcut = useCallback((which: 'toggle' | 'stats' | 'lock') => {
    if (which === 'toggle') {
      setToggleWindowShortcut([]);
    } else if (which === 'stats') {
      setStatsShortcut([]);
    } else {
      setLockShortcut([]);
    }
    setRecording(null);
  }, []);

  const handleSave = useCallback(async () => {
    // Save shortcuts to store
    await store.set('shortcut_toggle_window', toggleWindowShortcut);
    await store.set('shortcut_stats', statsShortcut);
    await store.set('shortcut_lock', lockShortcut);
    await store.save();

    // Register global shortcut for toggle window via Rust command
    const toggleStr = toggleWindowShortcut.length > 0 ? toggleWindowShortcut.join('+') : '';
    try {
      await invoke('set_toggle_shortcut', { shortcut: toggleStr });
    } catch (e) {
      console.error('Failed to register toggle shortcut:', e);
    }

    onClose();
  }, [toggleWindowShortcut, statsShortcut, lockShortcut, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>{t.settings}</span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.body}>
          {/* View Mode */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.settingsView}</div>
            <div style={styles.btnGroup}>
              {(['farm', 'flat', 'heatmap'] as const).map((mode) => (
                <button
                  key={mode}
                  style={{
                    ...styles.optionBtn,
                    ...(viewMode === mode ? styles.optionBtnActive : {}),
                  }}
                  onClick={() => onViewModeChange(mode)}
                >
                  {mode === 'farm' ? t.viewFarm : mode === 'flat' ? t.viewFlat : t.viewHeatmap}
                </button>
              ))}
            </div>
          </div>

          {/* Perspective */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.settingsAngle}</div>
            <div style={styles.btnGroup}>
              {(['left', 'right'] as const).map((p) => (
                <button
                  key={p}
                  style={{
                    ...styles.optionBtn,
                    ...(perspective === p ? styles.optionBtnActive : {}),
                  }}
                  onClick={() => onPerspectiveChange(p)}
                >
                  {p === 'left' ? t.angleLeft : t.angleRight}
                </button>
              ))}
            </div>
          </div>

          {/* Shortcuts */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.settingsShortcuts}</div>

            {/* Toggle Window shortcut (global) */}
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutLabel}>{t.shortcutToggleWindow}</span>
              <div style={styles.shortcutInput}>
                <div
                  style={{
                    ...styles.shortcutBox,
                    ...(recording === 'toggle' ? styles.shortcutBoxRecording : {}),
                  }}
                  onClick={() => startRecording('toggle')}
                >
                  {recording === 'toggle'
                    ? (tempKeys.length > 0 ? formatShortcut(tempKeys) : t.pressToRecord)
                    : (toggleWindowShortcut.length > 0 ? formatShortcut(toggleWindowShortcut) : '—')
                  }
                </div>
                {toggleWindowShortcut.length > 0 && (
                  <button style={styles.clearBtn} onClick={() => clearShortcut('toggle')}>
                    {t.clear}
                  </button>
                )}
              </div>
            </div>

            {/* Stats shortcut (app-level) */}
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutLabel}>{t.shortcutOpenStats}</span>
              <div style={styles.shortcutInput}>
                <div
                  style={{
                    ...styles.shortcutBox,
                    ...(recording === 'stats' ? styles.shortcutBoxRecording : {}),
                  }}
                  onClick={() => startRecording('stats')}
                >
                  {recording === 'stats'
                    ? (tempKeys.length > 0 ? formatShortcut(tempKeys) : t.pressToRecord)
                    : (statsShortcut.length > 0 ? formatShortcut(statsShortcut) : '—')
                  }
                </div>
                {statsShortcut.length > 0 && (
                  <button style={styles.clearBtn} onClick={() => clearShortcut('stats')}>
                    {t.clear}
                  </button>
                )}
              </div>
            </div>

            {/* Lock shortcut (app-level) */}
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutLabel}>{t.shortcutLock}</span>
              <div style={styles.shortcutInput}>
                <div
                  style={{
                    ...styles.shortcutBox,
                    ...(recording === 'lock' ? styles.shortcutBoxRecording : {}),
                  }}
                  onClick={() => startRecording('lock')}
                >
                  {recording === 'lock'
                    ? (tempKeys.length > 0 ? formatShortcut(tempKeys) : t.pressToRecord)
                    : (lockShortcut.length > 0 ? formatShortcut(lockShortcut) : '—')
                  }
                </div>
                {lockShortcut.length > 0 && (
                  <button style={styles.clearBtn} onClick={() => clearShortcut('lock')}>
                    {t.clear}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.saveBtn} onClick={handleSave}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    background: C.bg,
    borderRadius: 6,
    border: `2px solid ${C.border}`,
    width: 400,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px 10px',
    borderBottom: `2px solid ${C.border}`,
    background: C.tile,
  },
  title: {
    color: C.text,
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
  },
  closeBtn: {
    background: 'none',
    border: `1px solid ${C.tileBorder}`,
    color: C.textDim,
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: 2,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 8,
    fontFamily: 'system-ui, sans-serif',
  },
  btnGroup: {
    display: 'flex',
    gap: 6,
  },
  optionBtn: {
    flex: 1,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    border: `1px solid ${C.tileBorder}`,
    borderRadius: 4,
    background: C.tile,
    color: C.textDim,
    cursor: 'pointer',
  },
  optionBtnActive: {
    background: C.accent,
    color: '#1e1a16',
    borderColor: C.accent,
  },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  shortcutLabel: {
    color: C.text,
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  shortcutInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  shortcutBox: {
    padding: '5px 12px',
    fontSize: 11,
    fontFamily: 'monospace',
    border: `1px solid ${C.tileBorder}`,
    borderRadius: 3,
    background: C.tile,
    color: C.text,
    cursor: 'pointer',
    minWidth: 100,
    textAlign: 'center',
  },
  shortcutBoxRecording: {
    borderColor: C.accent,
    color: C.accent,
  },
  clearBtn: {
    padding: '4px 8px',
    fontSize: 10,
    fontFamily: 'system-ui, sans-serif',
    border: `1px solid ${C.tileBorder}`,
    borderRadius: 3,
    background: 'none',
    color: C.textDim,
    cursor: 'pointer',
  },
  footer: {
    padding: '10px 16px',
    borderTop: `1px solid ${C.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    padding: '6px 20px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    border: 'none',
    borderRadius: 4,
    background: C.accent,
    color: '#1e1a16',
    cursor: 'pointer',
  },
};
