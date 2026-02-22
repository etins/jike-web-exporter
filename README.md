# Jike Web Exporter

在 `web.okjike.com` 个人主页运行的浏览器脚本，用于导出自己的即刻动态为 `JSON + CSV`。

## 功能

- 自动滚动页面，尽可能加载更多历史动态。
- 多策略抓取（网络响应 + 页面状态 + DOM 兜底）。
- 一次导出两种格式：
  - `jike-export-YYYY-MM-DD-HH-mm-ss.json`
  - `jike-export-YYYY-MM-DD-HH-mm-ss.csv`

## 使用方法

1. 打开并登录 `https://web.okjike.com/me`。
2. 确认页面能看到自己的动态，先手动下滑几屏。
3. 打开浏览器开发者工具 `Console`。
4. 复制 `jike-export.js` 全部内容，粘贴到控制台执行。
5. 等待脚本自动滚动并完成导出。

## 输出结构

`json` 文件结构：

```json
{
  "meta": {
    "profileUrl": "string",
    "exportedAt": "ISO datetime",
    "networkResponseCount": 0,
    "parseErrors": 0,
    "snapshotCount": 0,
    "domBlockCount": 0,
    "rowCount": 0,
    "sourceStats": {}
  },
  "posts": [
    {
      "id": "string",
      "date": "string",
      "author": "string",
      "topic": "string",
      "content": "string",
      "url": "string",
      "source": "string"
    }
  ]
}
```

## 常见问题

- 导出是空的？
  - 优先在 `https://web.okjike.com/me` 页面执行。
  - 确认已登录，且页面能正常加载动态。
  - 先手动下滑几屏后再执行。

- 会修改账号数据吗？
  - 不会。脚本仅在浏览器本地读取页面已加载的数据并下载文件。

## 隐私说明

- 导出数据包含你自己的公开/可见动态文本，请自行判断后再分享。
- 建议提交到 GitHub 前先脱敏（用户名、外链、个人信息等）。

## License

MIT
