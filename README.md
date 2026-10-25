# 壹思源维修

- `local-backend/`：报价、登录和收据 API。标准报价表导入见 [local-backend/README.md](local-backend/README.md) 的「标准报价 Excel 导入」。
- `miniapp-ui/`：移动端 H5 参考
- `admin-web/`：管理后台
- `miniprogram/`：微信小程序，用微信开发者工具打开

小程序如何运行、如何指向本地后端，见 [miniprogram/README.md](miniprogram/README.md)。

师傅微信登录还没有 AppID 时可以先用手机号密码或本地演示。注册完成后，把 AppID 写入 `miniprogram/project.config.json` 和 `miniprogram/config.js`，并在后端设置 `WECHAT_APPID` 与 `WECHAT_APP_SECRET`。AppSecret 不要提交。
