# 壹思源维修本地后端

这是第一版本地后端，用于在服务器部署前验证核心业务流程。

## 微信小程序

`miniprogram/` 默认请求 `http://127.0.0.1:8787` 的 `/api/catalog` 和 `/api/quotes/calculate`。打开方式和真机地址见 `miniprogram/README.md`。

## 本地启动

需要 Node.js 24 或以上版本。

```bash
node src/server.mjs
```

默认地址：

```text
http://127.0.0.1:8787
```

当前本地后端已经使用 SQLite 数据库，默认写入：

```text
D:/codexXm/App_bjb/local-backend/data/yisiyuan-repair.sqlite
```

如果后续要换到服务器持久目录，可指定数据库文件：

```bash
DB_FILE=D:/codexXm/App_bjb/local-backend/data/yisiyuan-repair.sqlite node src/server.mjs
```

## 已实现能力

### 师傅开据权限

- 小程序H5底部「我的」提供内部账号登录、退出和开据权限状态。
- 管理员进入后台「权限设置」，新增师傅账号，然后在人员列表中单独点击「开通权限」。可随时撤销，已有登录会话也会即时受后端限制。
- 新建和旧数据库迁移后的师傅账号默认没有开据权限。只有 `technician` 角色且 `canIssueReceipts=true` 的启用账号可开据；管理员、客服、客户和游客不可开据。
- `POST /api/admin/staff` 创建师傅账号；`PATCH /api/admin/staff/:id/receipt-permission` 管理开据权限。这两个接口只允许管理员调用。
- H5正式收据通过 `POST /api/staff/receipts` 保存，不再在浏览器本地伪造收据编号。签名前获取后端核定金额，提交时检查金额是否变化。
- 微信领取尚未接入，收据页不显示示意二维码作为领取入口。

### 两端统一数据

- `/miniapp/` 与 `/admin/` 由同一个后端提供，使用上述同一份 SQLite 文件。当前预览端口为 8790；不要给两端分别指定不同的 `DB_FILE`。
- 品类、品牌、服务项目、城市和附加费用均通过接口读取，已删除前端演示数据与本地报价算法。后台新增项目默认草稿，发布后才进入报价目录。
- 后台服务新增、编辑、发布、下架、删除均写入数据库；报价端进入查价页、重新回到页面或点击刷新后读取最新目录。同步依靠请求刷新，不是实时推送。
- 报价、签名前核价和开据均由后端计算；开据提交时检查金额是否变化。
- 品牌通过品类 ID 明确关联；品牌报价系数作用于人工费和配件费，报价端切换品牌会重新向后端核价。
- 同一品类下的故障项目支持多选；后端逐项计算人工费和配件费，附加费用只计一次，并将全部项目写入同一张收据。
- 师傅历史读取本人创建的收据，后台读取全部收据。空数据库显示空状态，不回退演示记录。
- 同一进程内按数据库文件串行处理请求，避免并发读改写覆盖。尚不支持多个后端进程同时写同一文件。
- 保留已有数据库内容，本次没有自动导入原始 Excel。区域规则已存储，但尚未参与移动端报价计算。

### 其他能力

- 内部人员登录和角色权限
- 报价基础数据接口
- 内部人员生成电子收据
- 收据保修期限和倒计时数据
- 公众号扫码、关注、微信授权登录的本地模拟
- 客户登录后领取收据
- 客户再次进入小程序查看“我的收据”
- 后台查询收据领取状态
- 本地 SQLite 数据库存储品类、品牌、报价、人员、客户和收据
- 后台品类图片、品牌 Logo 新增/编辑/删除写入本地数据库
- 后台城市、区域、特殊费用新增/编辑/删除写入本地数据库
- 后台收据记录 CSV 导出

## 主要接口

- `GET /api/health`：健康检查
- `GET /api/catalog`：小程序基础数据
- `POST /api/auth/staff-login`：内部人员登录
- `GET /api/admin/assets`：后台品类/品牌数据
- `POST /api/admin/categories`：新增品类图片
- `PATCH /api/admin/categories/:id`：编辑品类图片
- `DELETE /api/admin/categories/:id`：删除品类
- `POST /api/admin/brands`：新增品牌 Logo
- `PATCH /api/admin/brands/:id`：编辑品牌 Logo
- `DELETE /api/admin/brands/:id`：删除品牌
- `GET /api/admin/operations`：后台城市、区域、特殊费用数据
- `POST /api/admin/cities`：新增城市
- `PATCH /api/admin/cities/:id`：编辑城市
- `DELETE /api/admin/cities/:id`：删除城市
- `POST /api/admin/regions`：新增区域规则
- `PATCH /api/admin/regions/:id`：编辑区域规则
- `DELETE /api/admin/regions/:id`：删除区域规则
- `POST /api/admin/extras`：新增特殊费用
- `PATCH /api/admin/extras/:id`：编辑特殊费用
- `DELETE /api/admin/extras/:id`：删除特殊费用
- `POST /api/quotes/calculate`：报价计算
- `POST /api/staff/receipts`：内部人员生成收据
- `POST /api/wechat/scan`：模拟公众号扫码/关注事件
- `POST /api/customer/wechat-login`：模拟客户微信授权登录
- `POST /api/customer/claim`：客户领取收据
- `GET /api/customer/receipts`：客户我的收据
- `GET /api/admin/receipts`：后台收据列表
- `GET /api/admin/receipts/export`：导出收据 CSV
- `GET /api/admin/permissions`：后台权限规则

## 重要说明

真实微信公众号回调和微信授权登录需要公网 HTTPS 域名。本地版本先用模拟接口跑通业务逻辑，上线前再替换成微信官方接口。
