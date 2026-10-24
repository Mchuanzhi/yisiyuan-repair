import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APPID_PLACEHOLDER = "wxXXXXXXXXXXXXXXXX";
const APPID_PATTERN = /^wx[0-9a-fA-F]{16}$/;

export function assertWechatAppId(appid) {
  const value = String(appid || "").trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === APPID_PLACEHOLDER.toLowerCase() || normalized === "touristappid" || !APPID_PATTERN.test(value)) {
    throw new Error("WECHAT_APPID 必须是微信小程序 AppID（wx 加 16 位十六进制）。请到微信公众平台复制，不要使用占位符 wxXXXXXXXXXXXXXXXX，也不要提交 touristappid。");
  }
  return value;
}

export function applyAppIdFiles({ appid, projectConfigPath, configJsPath, privateConfigPath }) {
  const id = assertWechatAppId(appid);
  const project = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  project.appid = id;
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(project, null, 2)}\n`);

  const source = fs.readFileSync(configJsPath, "utf8");
  if (!/wechatAppId:\s*"/.test(source)) {
    throw new Error("config.js 里没有 wechatAppId，无法写入 AppID");
  }
  const next = source.replace(/wechatAppId:\s*"[^"]*"/, `wechatAppId: "${id}"`);
  fs.writeFileSync(configJsPath, next);

  if (privateConfigPath) {
    fs.writeFileSync(privateConfigPath, `${JSON.stringify({
      description: "本机 AppID 覆盖，不要提交。与 project.config.json 保持一致。",
      appid: id,
      setting: { urlCheck: false },
    }, null, 2)}\n`);
  }
  return id;
}

function main() {
  const appid = process.env.WECHAT_APPID;
  if (!appid) {
    console.error("请设置 WECHAT_APPID。AppSecret 不要放进这个命令，只在启动 local-backend 时设置 WECHAT_APP_SECRET。");
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const id = applyAppIdFiles({
    appid,
    projectConfigPath: path.join(root, "project.config.json"),
    configJsPath: path.join(root, "config.js"),
    privateConfigPath: path.join(root, "project.private.config.json"),
  });
  console.log(`已写入 AppID ${id}。请确认后端 WECHAT_APPID 使用同一个值，并用 WECHAT_APP_SECRET 启动 local-backend。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
