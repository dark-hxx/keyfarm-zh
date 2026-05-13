# KeyFarm

你的键盘就是一片农场。每次按键都在种植作物。

KeyFarm 是一款桌面应用，将你的日常打字变成一个小型农场游戏。它停留在屏幕角落，监听你的键盘——每个按键都是等距农场上的一块土地，随着你的打字逐步生长。

<p align="center">
  <img src="docs/farm.png" width="600" alt="等距键盘农场">
</p>

## 下载

前往 [Releases](https://github.com/t42ji2ji/keyfarm/releases) 页面，下载适合你平台的最新版本：

- **macOS** — `KeyFarm_x.x.x_universal.dmg`
- **Windows** — `KeyFarm_x.x.x_x64-setup.exe`

> macOS 用户：打开 DMG 后，将 KeyFarm 拖入"应用程序"文件夹。首次启动时，右键点击应用并选择"打开"以绕过 Gatekeeper。

## 玩法说明

你的键盘被映射为 HHKB 布局的农场网格。当你按下一个键时，对应的地块会生长：

1. **空地** → 按 3 次 → **浇水**（随机分配一种作物）
2. **浇水** → 按 8 次 → **发芽**
3. **发芽** → 按 15 次 → **成树**
4. **成树** → 按 25 次 → **结果**（可以收获了！）

点击结果的地块即可收获。循环重置，新的作物开始生长。

<p align="center">
  <img src="docs/perspective.png" width="600" alt="翻转视角">
</p>

### 作物与稀有度

共有 100 种作物等你发现，分为 4 个稀有度等级——从普通水果到传说生物。收集它们全部吧！

<p align="center">
  <img src="docs/stats.png" width="600" alt="农场统计面板，显示收集进度">
</p>

### 热力图视图

切换到热力图模式，查看你最常使用哪些按键。每个键的高度和颜色反映了你的总按键次数。

<p align="center">
  <img src="docs/heatmap.png" width="600" alt="热力图视图，显示按键频率">
</p>

### 农场事件

- **害虫** — 虫子会随机出现在正在生长的作物上，阻止生长进度。点击即可消灭。
- **休耕** — 在 10 分钟内对同一个键收获 3 次，土壤需要休息 3 分钟。
- **过劳** — 在 5 秒内连按一个键 30 次，该键会锁定 20 秒。

## 权限

KeyFarm 需要 macOS 上的**辅助功能**权限来检测按键。应用首次启动时会提示你授予此权限。

## 语言切换

应用内置中英文切换功能。打开统计面板后，点击右上角的语言切换按钮（中文/EN）即可在中文和英文之间切换界面语言。语言设置会自动保存。

## 开发

```sh
npm install
npm run tauri dev
```

需要 [Node.js](https://nodejs.org/) 22+ 和 [Rust](https://rustup.rs/)。
