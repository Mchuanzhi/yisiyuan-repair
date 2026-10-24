function readWindow() {
  const fallback = { windowWidth: 375, windowHeight: 667, screenHeight: 0 };
  if (typeof wx === "undefined") return fallback;
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return {
      windowWidth: Number(info && info.windowWidth) || fallback.windowWidth,
      windowHeight: Number(info && info.windowHeight) || fallback.windowHeight,
      screenHeight: Number(info && info.screenHeight) || 0,
    };
  } catch (error) {
    return fallback;
  }
}

function usableHeight(windowHeight, screenHeight) {
  let height = windowHeight || 667;
  if (screenHeight && height >= screenHeight - 8) height = Math.max(320, height - 50);
  return height;
}

function quoteFrame(windowWidth, windowHeight, screenHeight) {
  const width = windowWidth || 375;
  const height = usableHeight(windowHeight, screenHeight);
  const chrome = Math.round((128 + 156) * width / 750);
  return {
    pageHeight: height,
    scrollHeight: Math.max(280, height - chrome),
  };
}

function pageFrame(windowWidth, windowHeight, screenHeight) {
  const height = usableHeight(windowHeight, screenHeight);
  return { pageHeight: height, scrollHeight: height };
}

function quoteLayout() {
  const box = readWindow();
  return quoteFrame(box.windowWidth, box.windowHeight, box.screenHeight);
}

function historyLayout() {
  const box = readWindow();
  return pageFrame(box.windowWidth, box.windowHeight, box.screenHeight);
}

module.exports = {
  readWindow,
  quoteFrame,
  pageFrame,
  quoteLayout,
  historyLayout,
};
