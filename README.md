# 每日打卡工具

## 功能

- 任务项通过根目录 `tasks.config.json` 预先配置
- 访问页面时展示当天（YYYY-MM-DD）任务完成情况
- 勾选/取消勾选会立即保存到硬盘：`data/YYYY-MM-DD.json`
- 文件不存在表示当天尚未产生记录（默认全部未完成）
- 勾选或取消时播放音效（WebAudio beep）

## 启动

在根目录执行：

```bash
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:5174`

## 配置任务

编辑根目录 `tasks.config.json`：

```json
{
  "tasks": [
    { "id": "wake_early", "title": "早起", "score": 2 },
    { "id": "exercise", "title": "运动 30 分钟", "score": 3 }
  ]
}
```

