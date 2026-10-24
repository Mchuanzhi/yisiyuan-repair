function readEnvVersion(wxApi) {
  const api = arguments.length ? wxApi : (typeof wx === "undefined" ? null : wx);
  try {
    if (!api || typeof api.getAccountInfoSync !== "function") return "";
    const info = api.getAccountInfoSync();
    const version = info && info.miniProgram && info.miniProgram.envVersion;
    return typeof version === "string" ? version : "";
  } catch (error) {
    return "";
  }
}

function showDebugSettings(envVersion, unlocked) {
  return envVersion === "develop" || Boolean(unlocked);
}

module.exports = {
  readEnvVersion,
  showDebugSettings,
};
