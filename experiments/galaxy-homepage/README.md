# 四银河主页实验

本实验位于 `experiments/galaxy-homepage/`，当前分支为 `experiment/galaxy-homepage`。它使用 `experiments/galaxy-pointcloud-poc/` 中的五个 image-derived 银河资产，不修改 `experiments/film-orbit-atmosphere/`。

## 启动预览

在仓库根目录 `.galaxy-poc` 下分别启动两个服务：

```powershell
cd experiments/galaxy-pointcloud-poc
npm run dev -- --host 127.0.0.1 --port 5197
```

调参页地址：<http://127.0.0.1:5197/>

```powershell
cd experiments/galaxy-homepage
npm run dev -- --host 127.0.0.1 --port 5198
```

主页地址：<http://127.0.0.1:5198/>

先启动 5197，再启动 5198，可以让调参页使用本地预设写入服务，主页通过版本轮询读取保存结果。停止服务时，在对应终端按 `Ctrl+C`；也可以结束占用 5197/5198 的 Vite 进程。

## 资产与预设

五个资产位于 `experiments/galaxy-pointcloud-poc/public/galaxies/galaxy-a` 到 `galaxy-e`。共享预设位于 `experiments/galaxy-pointcloud-poc/presets/`：

- `galaxy-a-approved.json`
- `galaxy-b-default.json`
- `galaxy-c-default.json`
- `galaxy-d-default.json`
- `galaxy-e-default.json`

主页章节分配为：Galaxy A（Hero）、Galaxy E（大会动态与资讯胶卷）、Galaxy B（单元介绍与主题）、Galaxy C（时间节点与评审）、Galaxy D（投稿说明与最终投稿）。作品要求标题及细则是独立的不透明阅读区，不占用银河章节。

调参页的“保存并同步主页”只针对本地开发预览。它通过本地 Vite 接口校验当前 `assetId` 和版本号后，原子写入对应预设并生成上一版本 `.bak`；主页不会刷新，也不会重置当前滚动位置。生产构建不提供预设写入接口。

调参页中的中等星、微弱星、前层星云和后层星云只用于实验预览；主页正式展示目前只加载亮星、中层星云和前景尘埃。

## 构建与静态预览

```powershell
cd experiments/galaxy-homepage
npm run build
npm run dev -- --host 127.0.0.1 --port 5198
```

构建产物在 `experiments/galaxy-homepage/dist/`。主页构建会把必要的银河二进制、残差图和静态预设复制到 `dist/`；关闭 5197 后，构建后的主页仍可读取静态预设运行，但不能保存调参结果。

## 回退基线

本轮修改前的可回退基线为 commit `76eb9fe`（完整提交可用 `git log` 查看）。回退前请先保存工作区中尚未提交的个人预设调整。
