(function exposeInlineAiPanelLayout(global) {
  const MARGIN = 12;
  const CASCADE_OFFSET = 28;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function intersects(left, right) {
    return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
  }

  function placePanel({ anchor, width = 560, height = 280, viewport, occupied = [] } = {}) {
    const safeViewport = viewport || { width: 0, height: 0 };
    const panelWidth = Math.min(Math.max(1, width), Math.max(1, safeViewport.width - MARGIN * 2));
    const panelHeight = Math.min(Math.max(1, height), Math.max(1, safeViewport.height - MARGIN * 2));
    const center = (anchor?.left || 0) + (anchor?.width || 0) / 2;
    const initialTop = (anchor?.bottom ?? ((anchor?.top || 0) + (anchor?.height || 0))) + 12;
    let left = clamp(center - panelWidth / 2, MARGIN, safeViewport.width - panelWidth - MARGIN);
    let top = initialTop;
    if (top + panelHeight > safeViewport.height - MARGIN) {
      top = (anchor?.top || 0) - panelHeight - 12;
    }
    top = clamp(top, MARGIN, safeViewport.height - panelHeight - MARGIN);

    for (let index = 0; index <= occupied.length + 8; index += 1) {
      const candidate = {
        left: clamp(left, MARGIN, safeViewport.width - panelWidth - MARGIN),
        top: clamp(top, MARGIN, safeViewport.height - panelHeight - MARGIN),
        width: panelWidth,
        height: panelHeight
      };
      candidate.right = candidate.left + candidate.width;
      candidate.bottom = candidate.top + candidate.height;
      if (!occupied.some((rect) => intersects(candidate, rect))) {
        return candidate;
      }
      left += CASCADE_OFFSET;
      top += CASCADE_OFFSET;
    }

    return {
      left: clamp(left, MARGIN, safeViewport.width - panelWidth - MARGIN),
      top: clamp(top, MARGIN, safeViewport.height - panelHeight - MARGIN),
      width: panelWidth,
      height: panelHeight,
      right: clamp(left, MARGIN, safeViewport.width - panelWidth - MARGIN) + panelWidth,
      bottom: clamp(top, MARGIN, safeViewport.height - panelHeight - MARGIN) + panelHeight
    };
  }

  global.InlineAIPanelLayout = Object.freeze({ placePanel, intersects, MARGIN, CASCADE_OFFSET });
})(globalThis);
