const PANEL_ORDER = ["category", "service", "brand", "extra", "warranty", "quote"];

function collapsedPanels(openKeys, previous) {
  const open = {};
  (openKeys || []).forEach((key) => {
    open[key] = true;
  });
  const collapsed = {};
  PANEL_ORDER.forEach((key) => {
    if (open[key]) collapsed[key] = false;
    else if (previous && previous[key] === false) collapsed[key] = false;
    else collapsed[key] = true;
  });
  return collapsed;
}

// Seeded catalog defaults are not technician selections. The first screen
// opens only the current step; later steps open as the technician moves.
function initialOpenPanels() {
  return ["category"];
}

function panelsForStep(step, detail) {
  const hasService = Boolean(detail && detail.hasService);
  if (step === "category") return ["category", "service"];
  if (step === "service") return hasService ? ["service", "brand"] : ["service"];
  if (step === "search") return hasService ? ["category", "service", "brand"] : ["service"];
  if (step === "brand") return ["brand", "extra"];
  if (step === "extra") return ["extra", "warranty"];
  if (step === "warranty") return ["warranty", "quote"];
  return [];
}

module.exports = {
  PANEL_ORDER,
  collapsedPanels,
  initialOpenPanels,
  panelsForStep,
};
