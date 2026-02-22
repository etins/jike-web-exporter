# 即刻网页导出脚本

用于 `web.okjike.com` 的浏览器控制台脚本，可把个人动态导出为 `JSON + CSV`。

## 快速使用

1. 打开并登录 `https://web.okjike.com/me`。
2. 手动下滑几屏，让历史动态加载出来。
3. 打开浏览器开发者工具 `Console`。
4. 复制 `jike-export.js` 全部内容，粘贴执行。
5. 等待自动下载导出文件。

## 文件说明

- `jike-export.js`：主脚本
- `README.md`：English README
- `README.zh-CN.md`：中文说明
- `LICENSE`：MIT 许可证

## 提示

- 如果结果为空，优先确认：
  - 当前页面是否为 `https://web.okjike.com/me`
  - 是否已登录
  - 是否已先手动滚动加载内容
- 上传到公开仓库前，建议先做隐私脱敏。
