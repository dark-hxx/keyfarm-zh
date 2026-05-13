import type { Translations } from './types';

export const en: Translations = {
  // Permission screen
  keyboardAccess: 'Keyboard Access',
  permissionDescription: 'KeyFarm needs <strong>Accessibility</strong> permission to detect keystrokes and grow your farm.',
  openSystemSettings: 'Open System Settings',
  waitingForPermission: 'Waiting for permission…',

  // Stats panel
  farmStats: 'Farm Stats',
  keystrokes: 'Keystrokes',
  harvested: 'Harvested',
  pestsSquashed: 'Pests Squashed',
  golden: 'Golden',

  // Rarity
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',

  // Sections
  ducks: 'Ducks',
  workers: 'Workers',
  activity: 'Activity',
  collection: 'Collection',
  crops: 'Crops',
  keys: 'Keys',
  speed: 'SPEED',

  // Buttons
  hire: 'Hire',
  upgrade: 'Upgrade',

  // Labels
  nextDuckAt: 'Next duck at',
  harvests: 'harvests',
  species: 'species',
  pests: 'pests',
  hireReq: 'Hire:',
  nextReq: 'Next:',
  rarestFind: 'Rarest Find',
  mostHarvested: 'Most Harvested',
  startTyping: 'Start typing to see stats',
  less: 'Less',
  more: 'More',

  // Days
  mon: 'Mon',
  wed: 'Wed',
  fri: 'Fri',

  // Months
  jan: 'Jan',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  may: 'May',
  jun: 'Jun',
  jul: 'Jul',
  aug: 'Aug',
  sep: 'Sep',
  oct: 'Oct',
  nov: 'Nov',
  dec: 'Dec',

  // Settings
  language: 'Language',
  settings: 'Settings',
  settingsView: 'View Mode',
  settingsAngle: 'Perspective',
  settingsShortcuts: 'Shortcuts',
  shortcutToggleWindow: 'Toggle Window',
  shortcutOpenStats: 'Open Stats',
  shortcutLock: 'Lock/Unlock Window',
  locked: 'Locked',
  unlocked: 'Unlocked',
  viewFarm: 'Farm',
  viewFlat: 'Flat',
  viewHeatmap: 'Heatmap',
  angleLeft: 'Left',
  angleRight: 'Right',
  pressToRecord: 'Press keys to record...',
  clear: 'Clear',
  close: 'Close',
  save: 'Save',
};

export const cropNames: Record<string, string> = {
  apple: 'Apple', orange: 'Orange', lemon: 'Lemon', grape: 'Grape',
  peach: 'Peach', cherry: 'Cherry', green_apple: 'Green Apple', pear: 'Pear',
  banana: 'Banana', tomato: 'Tomato', corn: 'Corn', carrot: 'Carrot',
  potato: 'Potato', broccoli: 'Broccoli', cucumber: 'Cucumber', eggplant: 'Eggplant',
  chicken: 'Chicken', pig: 'Pig', cow: 'Cow', sheep: 'Sheep',
  duck: 'Duck', frog: 'Frog', hamster: 'Hamster', chick: 'Chick',
  snail: 'Snail', ladybug: 'Ladybug', mouse: 'Mouse', ant: 'Ant',
  fish: 'Fish', hatching: 'Hatching',
  strawberry: 'Strawberry', watermelon: 'Watermelon', kiwi: 'Kiwi', melon: 'Melon',
  coconut: 'Coconut', avocado: 'Avocado', chili: 'Chili', mushroom: 'Mushroom',
  chestnut: 'Chestnut', peanut: 'Peanut', sweet_potato: 'Sweet Potato', garlic: 'Garlic',
  cat: 'Cat', dog: 'Dog', rabbit: 'Rabbit', butterfly: 'Butterfly',
  bee: 'Bee', turtle: 'Turtle', penguin: 'Penguin', owl: 'Owl',
  bear: 'Bear', koala: 'Koala', tiger: 'Tiger', lion: 'Lion',
  wolf: 'Wolf', hedgehog: 'Hedgehog', dolphin: 'Dolphin', tropical_fish: 'Tropical Fish',
  monkey: 'Monkey', horse: 'Horse', deer: 'Deer', gorilla: 'Gorilla',
  boar: 'Boar', whale: 'Whale', crab: 'Crab',
  mango: 'Mango', pineapple: 'Pineapple', blueberry: 'Blueberry',
  parrot: 'Parrot', octopus: 'Octopus', shark: 'Shark', eagle: 'Eagle',
  crocodile: 'Crocodile', elephant: 'Elephant', giraffe: 'Giraffe', kangaroo: 'Kangaroo',
  otter: 'Otter', sloth: 'Sloth', camel: 'Camel', bat: 'Bat',
  snake: 'Snake', lizard: 'Lizard', scorpion: 'Scorpion', swan: 'Swan',
  lobster: 'Lobster', squid: 'Squid', beaver: 'Beaver', zebra: 'Zebra',
  leopard: 'Leopard', bison: 'Bison',
  fox: 'Fox', unicorn: 'Unicorn', dragon: 'Dragon', panda: 'Panda',
  flamingo: 'Flamingo', peacock: 'Peacock', dodo: 'Dodo', orangutan: 'Orangutan',
  hippo: 'Hippo', rhino: 'Rhino',
};
