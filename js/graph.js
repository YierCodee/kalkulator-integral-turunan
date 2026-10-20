(function (global) {
  'use strict';

  var Engine = global.KalkulusEngine;

  var canvas = null;
  var context = null;
  var wrapper = null;
  var readout = null;
  var hint = null;
  var legendTangent = null;
  var tangentDrawn = false;

  var width = 0;
  var height = 0;
  var pixelRatio = 1;

  var view = { xmin: -10, xmax: 10, ymin: -5, ymax: 5 };
  var state = {
    fn: null,
    key: '',
    mode: 'calc',
    a: null,
    b: null,
    point: null
  };

  var lastKey = '';
  var needsFit = true;
  var assignedOnce = false;
  var frame = null;
  var drag = null;
  var hover = null;

  function css(name, fallback) {
    var value = getComputedStyle(canvas).getPropertyValue(name).trim();
    return value || fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function xToPixel(x) {
    return ((x - view.xmin) / (view.xmax - view.xmin)) * width;
  }

  function yToPixel(y) {
    return height - ((y - view.ymin) / (view.ymax - view.ymin)) * height;
  }

  function pixelToX(px) {
    return view.xmin + (px / width) * (view.xmax - view.xmin);
  }

  function pixelToY(py) {
    return view.ymin + ((height - py) / height) * (view.ymax - view.ymin);
  }

  function niceStep(rough) {
    if (!isFinite(rough) || rough <= 0) {
      return 1;
    }
    var exponent = Math.floor(Math.log10(rough));
    var base = Math.pow(10, exponent);
    var fraction = rough / base;
    var multiplier;
    if (fraction < 1.5) {
      multiplier = 1;
    } else if (fraction < 3) {
      multiplier = 2;
    } else if (fraction < 7) {
      multiplier = 5;
    } else {
      multiplier = 10;
    }
    return multiplier * base;
  }

  function forEachTick(min, max, step, callback) {
    if (!isFinite(step) || step <= 0) {
      return;
    }
    var first = Math.ceil(min / step) * step;
    var limit = max + step * 1e-6;
    for (var value = first; value <= limit; value += step) {
      callback(Math.abs(value) < step * 1e-6 ? 0 : value);
    }
  }

  function formatTick(value, step) {
    var decimals = Math.max(0, Math.ceil(-Math.log10(step)));
    var rounded = Number(value.toFixed(Math.min(6, decimals)));
    return String(rounded).replace('-', '\u2212');
  }

  function updateHint() {
    if (!hint) {
      return;
    }
    if (!state.fn) {
      hint.textContent = 'Masukkan ekspresi valid untuk melihat grafik';
    } else if (state.mode === 'integral' && state.a !== null && state.b !== null) {
      hint.textContent = 'Area integral ditandai \u00b7 gulir untuk zoom';
    } else if (state.mode === 'deriv' && state.point !== null) {
      hint.textContent = (tangentDrawn ? 'Garis singgung di x = ' : 'Tidak ada garis singgung di x = ') +
        Engine.formatNumberPlain(state.point, 6);
    } else {
      hint.textContent = 'Gulir untuk zoom \u00b7 tarik untuk menggeser';
    }
  }

  function updateAriaLabel() {
    if (!canvas) {
      return;
    }
    var label = state.fn ? 'Grafik fungsi' : 'Bidang grafik kosong';
    if (state.key) {
      label += ' f(x) = ' + state.key;
    }
    if (state.mode === 'integral' && state.a !== null && state.b !== null) {
      label += ', area integral dari ' + Engine.formatNumberPlain(state.a, 6) +
        ' sampai ' + Engine.formatNumberPlain(state.b, 6);
    }
    canvas.setAttribute('aria-label', label);
  }

  function fitY() {
    if (!state.fn) {
      view.ymin = -5;
      view.ymax = 5;
      return;
    }

    var samples = 520;
    var values = [];
    for (var i = 0; i <= samples; i += 1) {
      var x = view.xmin + ((view.xmax - view.xmin) * i) / samples;
      var y;
      try {
        y = state.fn(x);
      } catch (error) {
        y = NaN;
      }
      if (Number.isFinite(y) && Math.abs(y) < 1e12) {
        values.push(y);
      }
    }

    if (!values.length) {
      view.ymin = -5;
      view.ymax = 5;
      return;
    }

    values.sort(function (a, b) { return a - b; });
    var quantile = function (p) {
      var index = Math.round(p * (values.length - 1));
      return values[clamp(index, 0, values.length - 1)];
    };

    var low = quantile(0.04);
    var high = quantile(0.96);

    if (high - low < 1e-9) {
      var pad = Math.max(1, Math.abs(high) * 0.5);
      low -= pad;
      high += pad;
    }

    var padding = (high - low) * 0.18;
    low -= padding;
    high += padding;

    if (low > 0) {
      low = 0;
    }
    if (high < 0) {
      high = 0;
    }

    if (high - low < 1e-9) {
      low -= 1;
      high += 1;
    }

    view.ymin = low;
    view.ymax = high;
  }

  function drawGrid() {
    var xSpan = view.xmax - view.xmin;
    var ySpan = view.ymax - view.ymin;
    var xStep = niceStep(xSpan / 7);
    var yStep = niceStep(ySpan / 6);
    var xMinor = xStep / 5;
    var yMinor = yStep / 5;

    context.lineWidth = 1;
    context.strokeStyle = css('--graph-grid', 'rgba(0,0,0,0.06)');
    context.beginPath();

    if ((xMinor / xSpan) * width >= 5) {
      forEachTick(view.xmin, view.xmax, xMinor, function (value) {
        var px = Math.round(xToPixel(value)) + 0.5;
        context.moveTo(px, 0);
        context.lineTo(px, height);
      });
    }
    if ((yMinor / ySpan) * height >= 5) {
      forEachTick(view.ymin, view.ymax, yMinor, function (value) {
        var py = Math.round(yToPixel(value)) + 0.5;
        context.moveTo(0, py);
        context.lineTo(width, py);
      });
    }
    context.stroke();

    context.strokeStyle = css('--graph-grid-major', 'rgba(0,0,0,0.12)');
    context.beginPath();
    forEachTick(view.xmin, view.xmax, xStep, function (value) {
      var px = Math.round(xToPixel(value)) + 0.5;
      context.moveTo(px, 0);
      context.lineTo(px, height);
    });
    forEachTick(view.ymin, view.ymax, yStep, function (value) {
      var py = Math.round(yToPixel(value)) + 0.5;
      context.moveTo(0, py);
      context.lineTo(width, py);
    });
    context.stroke();

    var axisPxY = yToPixel(0);
    var axisPxX = xToPixel(0);

    context.strokeStyle = css('--graph-axis', 'rgba(0,0,0,0.5)');
    context.lineWidth = 1.2;
    context.beginPath();
    if (axisPxY >= 0 && axisPxY <= height) {
      context.moveTo(0, Math.round(axisPxY) + 0.5);
      context.lineTo(width, Math.round(axisPxY) + 0.5);
    }
    if (axisPxX >= 0 && axisPxX <= width) {
      context.moveTo(Math.round(axisPxX) + 0.5, 0);
      context.lineTo(Math.round(axisPxX) + 0.5, height);
    }
    context.stroke();

    context.fillStyle = css('--graph-label', 'rgba(0,0,0,0.58)');
    context.font = '9px "IBM Plex Mono", monospace';

    var xLabelY = axisPxY >= 0 && axisPxY <= height - 16 ? axisPxY + 5 : height - 14;
    var yLabelX;
    var yLabelAlign;

    if (axisPxX >= 34 && axisPxX <= width) {
      yLabelX = axisPxX - 6;
      yLabelAlign = 'right';
    } else if (axisPxX > width) {
      yLabelX = 5;
      yLabelAlign = 'left';
    } else {
      yLabelX = 5;
      yLabelAlign = 'left';
    }

    context.textAlign = 'center';
    context.textBaseline = 'top';
    forEachTick(view.xmin, view.xmax, xStep, function (value) {
      if (Math.abs(value) < xStep * 1e-6) {
        return;
      }
      var px = xToPixel(value);
      if (px < 14 || px > width - 14) {
        return;
      }
      context.fillText(formatTick(value, xStep), px, xLabelY);
    });

    context.textAlign = yLabelAlign;
    context.textBaseline = 'middle';
    forEachTick(view.ymin, view.ymax, yStep, function (value) {
      if (Math.abs(value) < yStep * 1e-6) {
        return;
      }
      var py = yToPixel(value);
      if (py < 10 || py > height - 10) {
        return;
      }
      context.fillText(formatTick(value, yStep), yLabelX, py);
    });
  }

  function traceCurve() {
    var steps = Math.max(2, Math.floor(width * 1.5));
    var span = view.ymax - view.ymin;
    var started = false;
    var previousY = null;

    context.beginPath();

    for (var i = 0; i <= steps; i += 1) {
      var x = view.xmin + ((view.xmax - view.xmin) * i) / steps;
      var y;
      try {
        y = state.fn(x);
      } catch (error) {
        y = NaN;
      }

      if (!Number.isFinite(y) || Math.abs(y) > 1e12) {
        started = false;
        previousY = null;
        continue;
      }

      var px = xToPixel(x);
      var py = clamp(yToPixel(y), -1e5, 1e5);

      if (!started) {
        context.moveTo(px, py);
        started = true;
      } else if (previousY !== null && Math.abs(y - previousY) > span * 4) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }

      previousY = y;
    }
  }

  function drawArea() {
    if (state.a === null || state.b === null) {
      return;
    }

    var low = Math.max(view.xmin, Math.min(state.a, state.b));
    var high = Math.min(view.xmax, Math.max(state.a, state.b));
    if (high <= low) {
      return;
    }

    var steps = Math.max(2, Math.floor(((high - low) / (view.xmax - view.xmin)) * width * 1.5));
    var startPixel = null;
    var endPixel = null;
    var started = false;
    var baseline = yToPixel(clamp(0, view.ymin, view.ymax));

    context.beginPath();

    for (var i = 0; i <= steps; i += 1) {
      var x = low + ((high - low) * i) / steps;
      var y;
      try {
        y = state.fn(x);
      } catch (error) {
        y = NaN;
      }

      if (!Number.isFinite(y) || Math.abs(y) > 1e12) {
        continue;
      }

      var px = xToPixel(x);
      var py = clamp(yToPixel(y), -1e5, 1e5);

      if (!started) {
        context.moveTo(px, py);
        startPixel = px;
        started = true;
      } else {
        context.lineTo(px, py);
      }
      endPixel = px;
    }

    if (!started || startPixel === null || endPixel === null) {
      return;
    }

    context.lineTo(endPixel, baseline);
    context.lineTo(startPixel, baseline);
    context.closePath();
    context.fillStyle = css('--area', 'rgba(195,61,29,0.14)');
    context.fill();

    var boundaryColor = css('--curve', '#b5381a');
    context.save();
    context.strokeStyle = boundaryColor;
    context.globalAlpha = 0.55;
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    [state.a, state.b].forEach(function (value) {
      if (value < view.xmin || value > view.xmax) {
        return;
      }
      var px = Math.round(xToPixel(value)) + 0.5;
      context.beginPath();
      context.moveTo(px, 0);
      context.lineTo(px, height);
      context.stroke();
    });
    context.restore();

    context.font = '9px "IBM Plex Mono", monospace';
    var axisY = yToPixel(0);
    var labelY = axisY > 16 && axisY < height - 12 ? axisY - 6 : height - 7;
    var background = css('--graph-bg', '#f7f2e7');
    var labelColor = css('--graph-label', 'rgba(0,0,0,0.58)');

    [state.a, state.b].forEach(function (value) {
      if (value < view.xmin || value > view.xmax) {
        return;
      }
      var label = 'x = ' + Engine.formatNumberPlain(value, 5);
      var textWidth = context.measureText(label).width;
      var boxWidth = textWidth + 8;
      var boxHeight = 13;
      var px = clamp(xToPixel(value), boxWidth / 2 + 3, width - boxWidth / 2 - 3);
      var boxX = px - boxWidth / 2;
      var boxY = labelY - boxHeight + 1;

      context.fillStyle = background;
      context.globalAlpha = 0.92;
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.globalAlpha = 1;
      context.fillStyle = labelColor;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillText(label, px, labelY);
    });
  }

  function drawTangent() {
    tangentDrawn = false;
    if (legendTangent) {
      legendTangent.hidden = true;
    }

    if (state.point === null || !state.fn) {
      return;
    }

    var y0;
    try {
      y0 = state.fn(state.point);
    } catch (error) {
      y0 = NaN;
    }
    if (!Number.isFinite(y0)) {
      return;
    }

    var h = 1e-5 * Math.max(1, Math.abs(state.point));
    var slope;
    try {
      slope = (state.fn(state.point + h) - state.fn(state.point - h)) / (2 * h);
    } catch (error) {
      slope = NaN;
    }
    if (!Number.isFinite(slope)) {
      return;
    }

    var leftSlope;
    var rightSlope;
    try {
      leftSlope = (y0 - state.fn(state.point - h)) / h;
      rightSlope = (state.fn(state.point + h) - y0) / h;
    } catch (error) {
      return;
    }
    if (Number.isFinite(leftSlope) && Number.isFinite(rightSlope)) {
      var slopeScale = Math.max(1, Math.abs(leftSlope), Math.abs(rightSlope));
      if (Math.abs(rightSlope - leftSlope) > 0.25 * slopeScale) {
        return;
      }
    }

    var color = css('--tangent', '#22544b');
    var segment = Math.max((view.xmax - view.xmin) * 0.18, 1e-6);
    var startX = Math.max(view.xmin, state.point - segment);
    var endX = Math.min(view.xmax, state.point + segment);
    var leftY = y0 + slope * (startX - state.point);
    var rightY = y0 + slope * (endX - state.point);

    context.save();
    context.strokeStyle = color;
    context.lineWidth = 1.4;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(xToPixel(startX), clamp(yToPixel(leftY), -1e5, 1e5));
    context.lineTo(xToPixel(endX), clamp(yToPixel(rightY), -1e5, 1e5));
    context.stroke();
    context.restore();

    tangentDrawn = true;
    if (legendTangent) {
      legendTangent.hidden = false;
    }

    var px = xToPixel(state.point);
    var py = yToPixel(y0);
    context.beginPath();
    context.arc(px, py, 4.5, 0, Math.PI * 2);
    context.fillStyle = css('--graph-bg', '#f7f2e7');
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = color;
    context.stroke();

    context.font = '9px "IBM Plex Mono", monospace';
    context.textAlign = 'left';
    context.textBaseline = 'middle';

    var label = 'm = ' + Engine.formatNumberPlain(slope, 4);
    var textWidth = context.measureText(label).width;
    var boxWidth = textWidth + 8;
    var boxHeight = 14;
    var boxX = clamp(px + 10, 4, Math.max(4, width - boxWidth - 4));
    var boxY = clamp(py - 16, 4, Math.max(4, height - boxHeight - 4));

    context.fillStyle = css('--graph-bg', '#f7f2e7');
    context.globalAlpha = 0.92;
    context.fillRect(boxX, boxY, boxWidth, boxHeight);
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.fillText(label, boxX + 4, boxY + boxHeight / 2 + 0.5);
  }

  function drawEmpty() {
    context.fillStyle = css('--graph-label', 'rgba(0,0,0,0.5)');
    context.font = '10px "IBM Plex Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('ekspresi belum valid', width / 2, height / 2 - 6);
  }

  function drawHover() {
    if (!hover) {
      if (readout) {
        readout.hidden = true;
      }
      return;
    }

    var x = pixelToX(hover.px);
    var py = null;
    var y = NaN;

    if (state.fn) {
      try {
        y = state.fn(x);
      } catch (error) {
        y = NaN;
      }
      if (Number.isFinite(y)) {
        py = yToPixel(y);
      }
    }

    var axisColor = css('--graph-axis', 'rgba(0,0,0,0.5)');
    context.save();
    context.strokeStyle = axisColor;
    context.globalAlpha = 0.45;
    context.lineWidth = 1;
    context.setLineDash([3, 4]);
    var px = Math.round(xToPixel(x)) + 0.5;
    context.beginPath();
    context.moveTo(px, 0);
    context.lineTo(px, height);
    context.stroke();
    context.restore();

    if (py !== null) {
      context.beginPath();
      context.arc(xToPixel(x), py, 3.5, 0, Math.PI * 2);
      context.fillStyle = css('--curve', '#b5381a');
      context.fill();
    }

    if (readout) {
      var text = 'x = ' + Engine.formatNumberPlain(x, 6);
      if (Number.isFinite(y)) {
        text += '  \u00b7  f(x) = ' + Engine.formatNumberPlain(y, 6);
      }
      readout.textContent = text;
      readout.hidden = false;

      var left = clamp(hover.px + 14, 8, Math.max(8, width - 175));
      var top = clamp(hover.py, 22, Math.max(22, height - 22));
      readout.style.left = left + 'px';
      readout.style.top = top + 'px';
    }
  }

  function draw() {
    if (!context || width < 2 || height < 2) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = css('--graph-bg', '#f7f2e7');
    context.fillRect(0, 0, width, height);

    drawGrid();

    if (state.fn) {
      context.save();
      context.beginPath();
      context.rect(0, 0, width, height);
      context.clip();

      if (state.mode === 'integral') {
        drawArea();
      }

      context.strokeStyle = css('--curve', '#b5381a');
      context.lineWidth = 2.2;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      traceCurve();
      context.stroke();

      if (state.mode === 'deriv') {
        drawTangent();
      }

      context.restore();
    } else {
      drawEmpty();
    }

    if (!drag) {
      drawHover();
    }
  }

  function scheduleDraw() {
    if (frame) {
      return;
    }
    frame = global.requestAnimationFrame(function () {
      frame = null;
      draw();
    });
  }

  function resize() {
    if (!wrapper || !canvas) {
      return;
    }
    width = Math.max(2, wrapper.clientWidth);
    height = Math.max(2, wrapper.clientHeight);
    pixelRatio = Math.min(global.devicePixelRatio || 1, 2.5);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    if (!assignedOnce) {
      assignedOnce = true;
      needsFit = true;
    }

    if (needsFit) {
      fitY();
      needsFit = false;
    }

    draw();
  }

  function ensureView() {
    if (!isFinite(view.xmin) || !isFinite(view.xmax) || view.xmax - view.xmin < 1e-9) {
      view.xmin = -10;
      view.xmax = 10;
    }
    if (!isFinite(view.ymin) || !isFinite(view.ymax) || view.ymax - view.ymin < 1e-9) {
      view.ymin = -5;
      view.ymax = 5;
    }
  }

  function expandToBounds() {
    if (state.a === null || state.b === null) {
      return;
    }
    var low = Math.min(state.a, state.b);
    var high = Math.max(state.a, state.b);
    var span = view.xmax - view.xmin;

    if (low < view.xmin || high > view.xmax) {
      var padding = Math.max((high - low) * 0.25, span * 0.05, 0.5);
      view.xmin = Math.min(view.xmin, low - padding);
      view.xmax = Math.max(view.xmax, high + padding);
      needsFit = true;
    }
  }

  function setState(next) {
    var nextKey = next.key || '';
    var changed = nextKey !== lastKey;

    if (changed) {
      lastKey = nextKey;
      needsFit = true;
    }

    state.fn = typeof next.fn === 'function' ? next.fn : null;
    state.key = nextKey;
    state.mode = next.mode || 'calc';
    state.a = Number.isFinite(next.a) ? next.a : null;
    state.b = Number.isFinite(next.b) ? next.b : null;
    state.point = Number.isFinite(next.point) ? next.point : null;

    if (state.mode === 'integral' && state.a !== null && state.b !== null) {
      expandToBounds();
    }

    if (needsFit) {
      fitY();
      needsFit = false;
    }

    updateAriaLabel();
    draw();
    updateHint();
  }

  function redraw() {
    draw();
  }

  function reset() {
    view.xmin = -10;
    view.xmax = 10;
    if (state.mode === 'integral') {
      expandToBounds();
    }
    fitY();
    draw();
  }

  function zoomAround(px, py, factor) {
    var x = pixelToX(px);
    var y = pixelToY(py);
    var xSpan = (view.xmax - view.xmin) * factor;
    var ySpan = (view.ymax - view.ymin) * factor;

    xSpan = clamp(xSpan, 1e-8, 1e10);
    ySpan = clamp(ySpan, 1e-8, 1e10);

    var xRatio = (x - view.xmin) / (view.xmax - view.xmin);
    var yRatio = (view.ymax - y) / (view.ymax - view.ymin);

    view.xmin = x - xRatio * xSpan;
    view.xmax = view.xmin + xSpan;
    view.ymax = y + yRatio * ySpan;
    view.ymin = view.ymax - ySpan;

    ensureView();
    draw();
  }

  function zoomBy(factor) {
    zoomAround(width / 2, height / 2, factor);
  }

  function hideReadout() {
    if (readout) {
      readout.hidden = true;
    }
  }

  function onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      view: {
        xmin: view.xmin,
        xmax: view.xmax,
        ymin: view.ymin,
        ymax: view.ymax
      }
    };
    hover = null;
    hideReadout();
    canvas.classList.add('dragging');
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    var rect = canvas.getBoundingClientRect();

    if (drag) {
      var dx = event.clientX - drag.x;
      var dy = event.clientY - drag.y;
      var xSpan = drag.view.xmax - drag.view.xmin;
      var ySpan = drag.view.ymax - drag.view.ymin;

      view.xmin = drag.view.xmin - (dx / rect.width) * xSpan;
      view.xmax = drag.view.xmax - (dx / rect.width) * xSpan;
      view.ymin = drag.view.ymin + (dy / rect.height) * ySpan;
      view.ymax = drag.view.ymax + (dy / rect.height) * ySpan;

      ensureView();
      scheduleDraw();
      return;
    }

    hover = {
      px: event.clientX - rect.left,
      py: event.clientY - rect.top
    };
    scheduleDraw();
  }

  function endDrag(event) {
    if (!drag) {
      return;
    }
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(drag.id)) {
      canvas.releasePointerCapture(drag.id);
    }
    drag = null;
    canvas.classList.remove('dragging');

    if (event && event.clientX !== undefined) {
      var rect = canvas.getBoundingClientRect();
      hover = {
        px: event.clientX - rect.left,
        py: event.clientY - rect.top
      };
    }
    scheduleDraw();
  }

  function onPointerLeave() {
    if (drag) {
      return;
    }
    hover = null;
    hideReadout();
    scheduleDraw();
  }

  function onWheel(event) {
    event.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var factor = Math.exp(event.deltaY * 0.0012);
    zoomAround(event.clientX - rect.left, event.clientY - rect.top, factor);
  }

  function init(canvasElement) {
    canvas = canvasElement;
    if (!canvas) {
      return null;
    }
    context = canvas.getContext('2d');
    wrapper = document.getElementById('graphWrap') || canvas.parentElement;
    readout = document.getElementById('graphReadout');
    hint = document.getElementById('graphHint');
    legendTangent = document.getElementById('legendTangent');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', reset);

    if (global.ResizeObserver) {
      new global.ResizeObserver(resize).observe(wrapper);
    } else {
      global.addEventListener('resize', resize);
    }

    resize();
    return api;
  }

  var api = {
    init: init,
    setState: setState,
    redraw: redraw,
    reset: reset,
    zoomBy: zoomBy
  };

  global.KalkulusGraph = api;
})(typeof window !== 'undefined' ? window : globalThis);
