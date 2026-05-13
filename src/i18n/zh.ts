import type { Translations } from './types';

export const zh: Translations = {
  // Permission screen
  keyboardAccess: '键盘访问',
  permissionDescription: 'KeyFarm 需要<strong>辅助功能</strong>权限来检测按键并种植你的农场。',
  openSystemSettings: '打开系统设置',
  waitingForPermission: '等待授权中…',

  // Stats panel
  farmStats: '农场统计',
  keystrokes: '按键次数',
  harvested: '已收获',
  pestsSquashed: '已除虫',
  golden: '金色',

  // Rarity
  common: '普通',
  uncommon: '稀有',
  rare: '珍贵',
  legendary: '传说',

  // Sections
  ducks: '鸭子',
  workers: '工人',
  activity: '活动',
  collection: '图鉴',
  crops: '作物',
  keys: '按键',
  speed: '速度',

  // Buttons
  hire: '雇佣',
  upgrade: '升级',

  // Labels
  nextDuckAt: '下只鸭子需要',
  harvests: '次收获',
  species: '种类',
  pests: '害虫',
  hireReq: '雇佣条件:',
  nextReq: '下一级:',
  rarestFind: '最稀有发现',
  mostHarvested: '收获最多',
  startTyping: '开始打字查看统计',
  less: '少',
  more: '多',

  // Days
  mon: '一',
  wed: '三',
  fri: '五',

  // Months
  jan: '1月',
  feb: '2月',
  mar: '3月',
  apr: '4月',
  may: '5月',
  jun: '6月',
  jul: '7月',
  aug: '8月',
  sep: '9月',
  oct: '10月',
  nov: '11月',
  dec: '12月',

  // Settings
  language: '语言',
  settings: '设置',
  settingsView: '视图模式',
  settingsAngle: '视角',
  settingsShortcuts: '快捷键',
  shortcutToggleWindow: '显示/隐藏窗口',
  shortcutOpenStats: '打开统计',
  shortcutLock: '锁定/解锁窗口',
  locked: '已锁定',
  unlocked: '已解锁',
  viewFarm: '农场',
  viewFlat: '平面',
  viewHeatmap: '热力图',
  angleLeft: '左',
  angleRight: '右',
  pressToRecord: '按下快捷键录入...',
  clear: '清除',
  close: '关闭',
  save: '保存',
};

export const cropNames: Record<string, string> = {
  apple: '苹果', orange: '橙子', lemon: '柠檬', grape: '葡萄',
  peach: '桃子', cherry: '樱桃', green_apple: '青苹果', pear: '梨',
  banana: '香蕉', tomato: '番茄', corn: '玉米', carrot: '胡萝卜',
  potato: '土豆', broccoli: '西兰花', cucumber: '黄瓜', eggplant: '茄子',
  chicken: '鸡', pig: '猪', cow: '牛', sheep: '羊',
  duck: '鸭', frog: '青蛙', hamster: '仓鼠', chick: '小鸡',
  snail: '蜗牛', ladybug: '瓢虫', mouse: '老鼠', ant: '蚂蚁',
  fish: '鱼', hatching: '孵化',
  strawberry: '草莓', watermelon: '西瓜', kiwi: '猕猴桃', melon: '甜瓜',
  coconut: '椰子', avocado: '牛油果', chili: '辣椒', mushroom: '蘑菇',
  chestnut: '栗子', peanut: '花生', sweet_potato: '红薯', garlic: '大蒜',
  cat: '猫', dog: '狗', rabbit: '兔子', butterfly: '蝴蝶',
  bee: '蜜蜂', turtle: '乌龟', penguin: '企鹅', owl: '猫头鹰',
  bear: '熊', koala: '考拉', tiger: '老虎', lion: '狮子',
  wolf: '狼', hedgehog: '刺猬', dolphin: '海豚', tropical_fish: '热带鱼',
  monkey: '猴子', horse: '马', deer: '鹿', gorilla: '大猩猩',
  boar: '野猪', whale: '鲸鱼', crab: '螃蟹',
  mango: '芒果', pineapple: '菠萝', blueberry: '蓝莓',
  parrot: '鹦鹉', octopus: '章鱼', shark: '鲨鱼', eagle: '鹰',
  crocodile: '鳄鱼', elephant: '大象', giraffe: '长颈鹿', kangaroo: '袋鼠',
  otter: '水獭', sloth: '树懒', camel: '骆驼', bat: '蝙蝠',
  snake: '蛇', lizard: '蜥蜴', scorpion: '蝎子', swan: '天鹅',
  lobster: '龙虾', squid: '鱿鱼', beaver: '河狸', zebra: '斑马',
  leopard: '豹', bison: '野牛',
  fox: '狐狸', unicorn: '独角兽', dragon: '龙', panda: '熊猫',
  flamingo: '火烈鸟', peacock: '孔雀', dodo: '渡渡鸟', orangutan: '猩猩',
  hippo: '河马', rhino: '犀牛',
};
