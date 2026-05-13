export type Language = 'en' | 'zh';

export interface Translations {
  // Permission screen
  keyboardAccess: string;
  permissionDescription: string;
  openSystemSettings: string;
  waitingForPermission: string;

  // Stats panel
  farmStats: string;
  keystrokes: string;
  harvested: string;
  pestsSquashed: string;
  golden: string;

  // Rarity
  common: string;
  uncommon: string;
  rare: string;
  legendary: string;

  // Sections
  ducks: string;
  workers: string;
  activity: string;
  collection: string;
  crops: string;
  keys: string;
  speed: string;

  // Buttons
  hire: string;
  upgrade: string;

  // Labels
  nextDuckAt: string;
  harvests: string;
  species: string;
  pests: string;
  hireReq: string;
  nextReq: string;
  rarestFind: string;
  mostHarvested: string;
  startTyping: string;
  less: string;
  more: string;

  // Days
  mon: string;
  wed: string;
  fri: string;

  // Months
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;

  // Settings
  language: string;
  settings: string;
  settingsView: string;
  settingsAngle: string;
  settingsShortcuts: string;
  shortcutToggleWindow: string;
  shortcutOpenStats: string;
  shortcutLock: string;
  locked: string;
  unlocked: string;
  viewFarm: string;
  viewFlat: string;
  viewHeatmap: string;
  angleLeft: string;
  angleRight: string;
  pressToRecord: string;
  clear: string;
  close: string;
  save: string;
}
