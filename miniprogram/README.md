# 壹思源维修微信小程序

这是原生微信小程序工程，用微信开发者工具打开本目录即可。它不是 H5，也没有用 `web-view` 套 `miniapp-ui/`。`miniapp-ui/` 仍保留为视觉和交互参考。

## 页面

| 页面 | 导航 | 作用 |
| --- | --- | --- |
| `pages/quote/quote` | tabBar「查价报价」 | 城市 `picker`、品类、多选项目、品牌、附加费 `switch`、保修、调用后端计价 |
| `pages/history/history` | tabBar「历史报价」 | 查看当前师傅开具的收据 |
| `pages/signature/signature` | 普通页面 | Canvas 2D 手写签名，按设备像素比设置分辨率 |
| `pages/receipt/receipt` | 普通页面 | 展示已保存的电子收据 |
| `pages/account/account` | 普通页面，从查价页「我的」进入 | 配置接口地址、本地演示数据、内部账号登录 |

底部只有「查价报价 / 历史报价」。签名和收据盖住业务页，不进 tabBar。底部安全区交给微信导航栏，查价页的金额栏不再额外垫一层安全区。

品类图和品牌标使用 `images/` 里的本地 PNG。接口若返回 `http(s)` 图片会直接用；data URL 会忽略并回退到本地图。

## 用微信开发者工具打开

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入项目，目录选仓库里的 `miniprogram/`。
3. AppID 使用测试号。`project.config.json` 里写的是 `touristappid`。若工具提示 AppID 无效，选择「测试号」即可。
4. 基础库使用 3.6.5 或更高。签名页依赖 Canvas 2D。
5. 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。工程里 `urlCheck` 已设为 `false`，若仍请求失败，以这个勾选为准。

## 连接 local-backend

另开终端：

```bash
cd local-backend
node src/server.mjs
```

默认地址是 `http://127.0.0.1:8787`。小程序里的默认根地址与此相同，可在「我的」修改并保存。查价页下拉或点「刷新数据」会重新读取目录。

开发者工具里的模拟器访问的是电脑本机，所以 `127.0.0.1` 可用。真机预览时，手机访问不到电脑的 `127.0.0.1`，需要：

```bash
cd local-backend
HOST=0.0.0.0 PORT=8787 node src/server.mjs
```

然后在「我的」把接口根地址改成 `http://<电脑局域网IP>:8787`。手机和电脑要在同一网络，且开发者工具仍关闭域名校验。正式上线再把该域名配进小程序后台。

报价会请求：

- `GET /api/catalog`
- `POST /api/quotes/calculate`
- `POST /api/auth/staff-login`（签名开据前）
- `POST /api/staff/receipts`
- `GET /api/staff/receipts`

登录态放在本地存储里，请求带 `Authorization: Bearer <token>`。本次不接微信官方登录。

### 演示账号

与后端种子数据相同：

- 师傅：`18800000002` / `123456`（张师傅）
- 管理员：`18800000001` / `123456`

后端里新建或种子中的师傅默认不能开据。给张师傅开通：用管理员打开 `http://127.0.0.1:8787/admin/` ，在「权限设置」中开通。未开通时查价和计价仍然可用，签名提交会返回 403。

### 不启动后端时

查价页打不开 `local-backend` 时会改用本地演示数据，欢迎区和品类面板仍然显示，并出现「打开本地演示」进入「我的」。也可以自己打开「本地演示数据」并保存。目录和计价与种子数据一致，收据只存在小程序本地存储。此模式下张师傅默认可开据。切回真实接口后需要重新登录，下拉查价页会再试一次接口。

## 建议走一遍的路径

1. 启动 local-backend，开发者工具打开本目录。
2. 查价页确认顶部状态为「价格与 local-backend 同步」，底部合计不是「—」。
3. 换城市、勾选一项特殊费用，合计应跟着变。
4. 到「我的」登录张师傅。若按钮仍是「登录后签名开据」，先在后台开通开据权限，再回「我的」看权限是否变成「已开通」。
5. 回到查价页，点「确认报价 · 签名」，手写并填写客户姓名，生成收据。
6. 打开「历史报价」，应能看到刚才那条。

校验计价脚本（不需要开发者工具）：

```bash
node miniprogram/scripts/generate-assets.mjs   # 仅在要重画 PNG 时
node miniprogram/tests/quote.test.mjs
```

脚本会核对页面结构，并临时启动 local-backend，确认本地演示计价和接口返回的明细金额一致。后端测试仍是 `node local-backend/tests/api.test.mjs`。
