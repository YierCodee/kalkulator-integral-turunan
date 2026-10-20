(function (global) {
  'use strict';

  var Engine = global.KalkulusEngine;
  var Graph = global.KalkulusGraph;

  var MODES = {
    calc: {
      prefix: '=',
      submit: 'Hitung',
      eyebrow: 'Kalkulator',
      placeholder: '2^10 + sqrt(81) - 5!'
    },
    deriv: {
      prefix: 'f(x) =',
      submit: 'Turunkan',
      eyebrow: 'Turunan',
      placeholder: 'x^3 - 2x + 1'
    },
    integral: {
      prefix: 'f(x) =',
      submit: 'Integralkan',
      eyebrow: 'Integral',
      placeholder: 'sin(x)'
    }
  };

  var MODE_NOTES = {
    calc: {
      index: '01',
      text: 'Ekspresi dievaluasi langsung. Mode sudut hanya memengaruhi fungsi trigonometri dan grafik pratinjau.'
    },
    deriv: {
      index: '02',
      text: 'Turunan simbolik mengikuti aturan baku. Bila bentuk tertutup tidak tersedia, nilai di titik dihitung dengan beda hingga tengah.'
    },
    integral: {
      index: '03',
      text: 'Simpson komposit memakai 200 interval, lalu digandakan hingga galat antar-iterasi \u2264 10\u207b\u2079. Richardson mempercepat konvergensi bila pola galatnya teratur.'
    }
  };

  var EXAMPLES = {
    calc: [
      { expr: '2^10 + sqrt(81) - 5!' },
      { expr: 'sin(30) + cos(60)' },
      { expr: 'log(1000) + ln(e^2)' },
      { expr: '5! / (2! * 3!)' }
    ],
    deriv: [
      { expr: 'x^3 - 2x + 1', point: '1' },
      { expr: 'sin(x^2)', point: 'pi/2' },
      { expr: 'e^(-x^2)' },
      { expr: 'ln(x)', point: '2' },
      { expr: '1/(1+x^2)' }
    ],
    integral: [
      { expr: 'sin(x)', a: '0', b: 'pi' },
      { expr: 'x^2', a: '0', b: '1' },
      { expr: 'e^(-x^2)', a: '-2', b: '2' },
      { expr: '1/x', a: '1', b: 'e' },
      { expr: 'sqrt(x)', a: '0', b: '4' }
    ]
  };

  var state = {
    mode: 'deriv',
    angle: 'rad',
    lastSteps: []
  };

  var previewTimer = null;
  var copyTimer = null;

  var elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    elements.html = document.documentElement;
    elements.statusChip = byId('statusChip');
    elements.statusText = byId('statusText');
    elements.themeToggle = byId('themeToggle');
    elements.themeLabel = byId('themeLabel');
    elements.form = byId('calcForm');
    elements.workspace = document.querySelector('.workspace');
    elements.expression = byId('expression');
    elements.exprPrefix = byId('exprPrefix');
    elements.exprMeta = byId('exprMeta');
    elements.clearBtn = byId('clearBtn');
    elements.derivPoint = byId('derivPoint');
    elements.derivFields = byId('derivFields');
    elements.integralFields = byId('integralFields');
    elements.integralA = byId('integralA');
    elements.integralB = byId('integralB');
    elements.insertBar = byId('insertBar');
    elements.keypad = byId('keypad');
    elements.angleRow = byId('angleRow');
    elements.submitLabel = byId('submitLabel');
    elements.resultEyebrow = byId('resultEyebrow');
    elements.resultState = byId('resultState');
    elements.resultMain = byId('resultMain');
    elements.resultSub = byId('resultSub');
    elements.errorBanner = byId('errorBanner');
    elements.copySteps = byId('copySteps');
    elements.stepsList = byId('stepsList');
    elements.exampleRow = byId('exampleRow');
    elements.methodIndex = byId('methodIndex');
    elements.methodText = byId('methodText');
    elements.graphTitle = byId('graphTitle');
    elements.legendArea = byId('legendArea');
    elements.legendTangent = byId('legendTangent');
    elements.zoomIn = byId('zoomIn');
    elements.zoomOut = byId('zoomOut');
    elements.resetView = byId('resetView');
    elements.tabs = Array.prototype.slice.call(document.querySelectorAll('.mode-tab'));
    elements.angleButtons = Array.prototype.slice.call(document.querySelectorAll('[data-angle]'));
  }

  function setStatus(kind, text) {
    elements.statusChip.dataset.state = kind;
    elements.statusText.textContent = text;
  }

  function humanizeError(error) {
    if (error && error.name === 'CalcError') {
      return error.message;
    }
    return 'Terjadi kesalahan: ' + (error && error.message ? error.message : 'tidak diketahui.');
  }

  function clearSteps(emptyMessage) {
    elements.stepsList.innerHTML = '';
    var item = document.createElement('li');
    item.className = 'empty-step';
    item.textContent = emptyMessage || 'Belum ada perhitungan.';
    elements.stepsList.appendChild(item);
    state.lastSteps = [];
    elements.copySteps.disabled = true;
  }

  function resetOutput(message) {
    elements.resultMain.textContent = '\u2014';
    elements.resultSub.textContent = message || 'Masukkan ekspresi untuk mulai menghitung.';
    elements.resultState.textContent = 'menunggu';
    elements.errorBanner.hidden = true;
    elements.errorBanner.textContent = '';
    clearSteps();
    setStatus('idle', 'siap');
  }

  function showError(message) {
    elements.errorBanner.textContent = message;
    elements.errorBanner.hidden = false;
    elements.resultMain.textContent = '\u2014';
    elements.resultSub.textContent = 'Periksa ekspresi, titik, atau batas lalu coba lagi.';
    elements.resultState.textContent = 'galat';
    clearSteps('Perhitungan belum berhasil.');
    setStatus('error', 'galat');
  }

  function renderSteps(steps) {
    elements.stepsList.innerHTML = '';

    if (!steps.length) {
      clearSteps();
      return;
    }

    steps.forEach(function (step, index) {
      var item = document.createElement('li');
      item.className = 'step';
      item.style.animationDelay = (index * 0.035) + 's';

      var number = document.createElement('span');
      number.className = 'step-index';
      number.textContent = String(index + 1).padStart(2, '0');

      var body = document.createElement('div');
      body.className = 'step-body';

      var label = document.createElement('p');
      label.className = 'step-label';
      label.textContent = step.label;

      var formula = document.createElement('p');
      formula.className = 'step-formula';
      formula.innerHTML = Engine.mathHTML(step.formula);

      body.appendChild(label);
      body.appendChild(formula);
      item.appendChild(number);
      item.appendChild(body);
      elements.stepsList.appendChild(item);
    });

    state.lastSteps = steps;
    elements.copySteps.disabled = false;
    elements.copySteps.textContent = 'Salin';
  }

  function setResult(mainHTML, subHTML, steps) {
    elements.errorBanner.hidden = true;
    elements.errorBanner.textContent = '';
    elements.resultMain.innerHTML = mainHTML;
    elements.resultSub.innerHTML = subHTML;
    elements.resultState.textContent = 'selesai';
    renderSteps(steps);
    setStatus('done', 'selesai');
  }

  function updateMeta() {
    if (state.mode === 'calc') {
      elements.exprMeta.textContent = state.angle === 'deg' ? 'derajat' : 'radian';
    } else {
      elements.exprMeta.textContent = 'radian';
    }
  }

  function renderExamples() {
    elements.exampleRow.innerHTML = '';
    (EXAMPLES[state.mode] || []).forEach(function (example) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'example-chip';
      button.textContent = example.expr;
      button.addEventListener('click', function () {
        elements.expression.value = example.expr;

        if (state.mode === 'deriv') {
          elements.derivPoint.value = example.point || '';
        } else if (state.mode === 'integral') {
          elements.integralA.value = example.a !== undefined ? example.a : '0';
          elements.integralB.value = example.b !== undefined ? example.b : '1';
        }

        compute();
        elements.expression.focus();
        var length = elements.expression.value.length;
        elements.expression.setSelectionRange(length, length);
      });
      elements.exampleRow.appendChild(button);
    });
  }

  function setMode(mode) {
    if (!MODES[mode]) {
      return;
    }

    state.mode = mode;
    var meta = MODES[mode];
    elements.workspace.dataset.mode = mode;

    elements.tabs.forEach(function (tab) {
      var selected = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });

    elements.form.setAttribute('aria-labelledby', 'tab-' + mode);
    elements.exprPrefix.textContent = meta.prefix;
    elements.submitLabel.textContent = meta.submit;
    elements.resultEyebrow.textContent = meta.eyebrow;
    elements.expression.placeholder = meta.placeholder;

    elements.derivFields.hidden = mode !== 'deriv';
    elements.integralFields.hidden = mode !== 'integral';
    elements.keypad.hidden = mode !== 'calc';
    elements.angleRow.hidden = mode !== 'calc';

    updateMeta();
    elements.methodIndex.textContent = MODE_NOTES[mode].index;
    elements.methodText.textContent = MODE_NOTES[mode].text;
    renderExamples();
    resetOutput(mode === 'integral'
      ? 'Tentukan fungsi dan batas integral, lalu tekan Integralkan.'
      : mode === 'deriv'
        ? 'Masukkan fungsi, lalu tekan Turunkan.'
        : 'Masukkan ekspresi, lalu tekan Hitung.');

    schedulePreview();
  }

  function getExpression() {
    return elements.expression.value.trim();
  }

  function focusExpressionAtEnd() {
    elements.expression.focus();
    var length = elements.expression.value.length;
    elements.expression.setSelectionRange(length, length);
  }

  function insertText(text, caretDelta) {
    var input = elements.expression;
    input.focus();

    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;

    input.setRangeText(text, start, end, 'end');

    var caret = input.selectionStart + (caretDelta || 0);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function backspace() {
    var input = elements.expression;
    input.focus();

    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;

    if (start !== end) {
      input.setRangeText('', start, end, 'end');
    } else if (start > 0) {
      input.setRangeText('', start - 1, start, 'end');
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearExpression() {
    elements.expression.value = '';
    elements.expression.dispatchEvent(new Event('input', { bubbles: true }));
    elements.expression.focus();
  }

  function readGraphContext() {
    var point = null;
    var a = null;
    var b = null;

    if (state.mode === 'deriv' && elements.derivPoint.value.trim()) {
      try {
        point = Engine.parseConstant(elements.derivPoint.value, 'Titik evaluasi');
      } catch (error) {
        point = null;
      }
    }

    if (state.mode === 'integral') {
      try {
        a = Engine.parseConstant(elements.integralA.value, 'Batas bawah');
      } catch (error) {
        a = null;
      }
      try {
        b = Engine.parseConstant(elements.integralB.value, 'Batas atas');
      } catch (error) {
        b = null;
      }
    }

    return { a: a, b: b, point: point };
  }

  function updateGraph() {
    var raw = getExpression();
    var fn = null;
    var key = '';
    var degree = state.mode === 'calc' && state.angle === 'deg';

    if (raw) {
      try {
        fn = Engine.makeFunction(raw, degree);
        key = Engine.normalize(raw);
      } catch (error) {
        fn = null;
        key = raw;
      }
    }

    var context = readGraphContext();

    Graph.setState({
      fn: fn,
      key: key,
      mode: state.mode,
      a: context.a,
      b: context.b,
      point: context.point
    });

    elements.graphTitle.textContent = raw
      ? 'f(x) = ' + Engine.pretty(raw) + (degree ? '  \u00b7  DEG' : '')
      : 'f(x)';
    elements.legendArea.hidden = !(state.mode === 'integral' && fn && context.a !== null && context.b !== null);
    if (!(state.mode === 'deriv' && fn && context.point !== null)) {
      elements.legendTangent.hidden = true;
    }
  }

  function schedulePreview() {
    if (previewTimer) {
      clearTimeout(previewTimer);
    }
    previewTimer = setTimeout(function () {
      previewTimer = null;
      updateGraph();
    }, 170);
  }

  function describeAngle() {
    return state.angle === 'deg' ? 'derajat' : 'radian';
  }

  function computeCalculator(raw) {
    var node = Engine.parse(raw);
    var hasX = Engine.containsX(node);
    var degree = state.angle === 'deg';
    var value = Engine.evaluateNode(node, 0, degree);

    if (Number.isNaN(value)) {
      throw Engine.CalcError('Hasil tidak terdefinisi. Periksa pembagian nol atau domain fungsi.');
    }

    var main = Engine.formatNumberHTML(value);
    var subParts = [hasX ? 'dievaluasi pada x = 0' : 'hasil numerik'];
    subParts.push('mode sudut: ' + describeAngle());

    if (!Number.isFinite(value)) {
      subParts.push('nilai menuju tak hingga');
    }

    var steps = [
      { label: 'Ekspresi', formula: raw }
    ];

    var normalized;
    try {
      normalized = Engine.normalize(raw);
    } catch (error) {
      normalized = raw;
    }
    if (normalized !== raw) {
      steps.push({ label: 'Bentuk normal', formula: normalized });
    }

    if (degree) {
      steps.push({ label: 'Mode sudut', formula: 'derajat (DEG) \u2014 fungsi trigonometri dikonversi dari derajat' });
    }

    steps.push({
      label: hasX ? 'Substitusi x = 0' : 'Evaluasi',
      formula: (hasX ? 'f(0) = ' : '') + Engine.formatNumberPlain(value, 10)
    });

    setResult(main, subParts.join(' \u00b7 '), steps);
  }

  function computeDerivative(raw) {
    var pointText = elements.derivPoint.value.trim();
    var point = pointText ? Engine.parseConstant(pointText, 'Titik evaluasi') : null;
    var symbolic = null;
    var symbolicError = null;

    try {
      symbolic = Engine.symbolicDerivative(raw);
    } catch (error) {
      symbolicError = error;
    }

    if (!symbolic) {
      if (point === null) {
        throw symbolicError || Engine.CalcError(
          'Turunan simbolik tidak tersedia untuk fungsi ini. Isi titik evaluasi untuk memakai turunan numerik.'
        );
      }

      var numeric = Engine.derivativeAt(raw, point);
      var numericSteps = [
        { label: 'Fungsi', formula: raw },
        { label: 'Turunan simbolik', formula: 'tidak tersedia untuk bentuk ini' },
        { label: 'Metode', formula: 'beda hingga tengah (central difference)' },
        {
          label: 'Hasil numerik',
          formula: 'f\'(' + Engine.formatNumberPlain(point, 8) + ') \u2248 ' +
            Engine.formatNumberPlain(numeric.value, 10)
        }
      ];

      if (numeric.error !== undefined) {
        numericSteps.push({
          label: 'Perkiraan galat',
          formula: '\u2248 ' + Engine.formatNumberPlain(numeric.error, 4)
        });
      }

      setResult(
        Engine.formatNumberHTML(numeric.value),
        'turunan numerik di x = ' + Engine.formatNumberHTML(point, 8) + ' \u00b7 simbolik tidak tersedia',
        numericSteps
      );
      return;
    }

    var steps = [
      { label: 'Fungsi', formula: raw },
      { label: 'Diferensiasi', formula: 'd/dx [ ' + raw + ' ]' }
    ];

    if (symbolic.exactExpression !== symbolic.expression) {
      steps.push({ label: 'Hasil operator', formula: symbolic.exactExpression });
      steps.push({ label: 'Hasil disederhanakan', formula: symbolic.expression });
    } else {
      steps.push({ label: 'Hasil simbolik', formula: symbolic.expression });
    }

    var subText = 'turunan terhadap x';

    if (point !== null) {
      var evaluated = Engine.derivativeAt(raw, point);

      if (evaluated.method === 'numeric') {
        subText = 'f\'(' + Engine.formatNumberHTML(point, 8) + ') \u2248 ' +
          Engine.formatNumberHTML(evaluated.value, 10) + ' (numerik)';
        steps.push({
          label: 'Metode',
          formula: 'turunan simbolik tidak terdefinisi di titik ini \u00b7 beda hingga tengah'
        });
        steps.push({
          label: 'Hasil numerik',
          formula: 'f\'(' + Engine.formatNumberPlain(point, 8) + ') \u2248 ' +
            Engine.formatNumberPlain(evaluated.value, 10)
        });
      } else {
        subText = 'f\'(' + Engine.formatNumberHTML(point, 8) + ') = ' +
          Engine.formatNumberHTML(evaluated.value, 10);
        steps.push({
          label: 'Substitusi x = ' + Engine.formatNumberPlain(point, 8),
          formula: 'f\'(' + Engine.formatNumberPlain(point, 8) + ') = ' +
            Engine.formatNumberPlain(evaluated.value, 10)
        });
      }

      try {
        var check = Engine.numericDerivative(raw, point);
        steps.push({
          label: 'Cek numerik',
          formula: '\u2248 ' + Engine.formatNumberPlain(check.value, 10) +
            ' \u00b1 ' + Engine.formatNumberPlain(check.error, 3)
        });
      } catch (error) {
        // Cek numerik bersifat opsional.
      }
    }

    setResult(Engine.mathHTML(symbolic.expression), subText, steps);
  }

  function computeIntegral(raw) {
    var a = Engine.parseConstant(elements.integralA.value, 'Batas bawah');
    var b = Engine.parseConstant(elements.integralB.value, 'Batas atas');
    var result = Engine.integrate(raw, a, b);

    var subParts = [];
    if (result.swapped) {
      subParts.push('batas ditukar');
    }
    subParts.push('n = ' + result.n);
    if (result.n > 0) {
      subParts.push('h = ' + Engine.formatNumberHTML(result.h, 6));
    }
    if (result.error !== null) {
      subParts.push('galat \u2248 ' + Engine.formatNumberHTML(result.error, 3));
    }

    var steps = [
      { label: 'Fungsi', formula: raw },
      {
        label: 'Interval',
        formula: '[' + Engine.formatNumberPlain(a, 8) + ', ' + Engine.formatNumberPlain(b, 8) + ']' +
          (result.swapped ? '  (batas ditukar agar a < b)' : '')
      }
    ];

    if (result.n === 0) {
      steps.push({ label: 'Batas sama', formula: 'a = b, sehingga integral bernilai 0' });
    } else {
      steps.push({
        label: 'Metode',
        formula: 'Simpson komposit' + (result.extrapolated ? ' + Richardson' : '') +
          ' \u00b7 n = ' + result.n + ' \u00b7 h = ' + Engine.formatNumberPlain(result.h, 8)
      });
      steps.push({
        label: 'Rumus',
        formula: 'S = h/3 \u00b7 [f(x\u2080) + 4f(x\u2081) + 2f(x\u2082) + \u2026 + f(x\u2099)]'
      });
      steps.push({
        label: 'Hasil',
        formula: '\u222b f(x) dx \u2248 ' + Engine.formatNumberPlain(result.value, result.converged ? 10 : 8)
      });

      if (result.error !== null) {
        steps.push({
          label: 'Perkiraan galat',
          formula: '\u2248 ' + Engine.formatNumberPlain(result.error, 6) +
            (result.converged ? '  (konvergen)' : '  (belum sepenuhnya konvergen)')
        });
      }
    }

    var sub = subParts.join(' \u00b7 ');
    if (!result.converged && result.n > 0) {
      sub += ' \u00b7 periksa fungsi yang tidak mulus';
    }

    var displayed = Engine.formatNumberHTML(result.value, result.converged ? 10 : 8);
    setResult(displayed, sub, steps);
  }

  function compute() {
    var raw = getExpression();

    if (!raw) {
      showError('Ekspresi masih kosong.');
      return;
    }

    setStatus('working', 'menghitung');
    elements.errorBanner.hidden = true;

    try {
      if (state.mode === 'calc') {
        computeCalculator(raw);
      } else if (state.mode === 'deriv') {
        computeDerivative(raw);
      } else {
        computeIntegral(raw);
      }
    } catch (error) {
      showError(humanizeError(error));
    } finally {
      updateGraph();
    }
  }

  function applyTheme(theme) {
    elements.html.dataset.theme = theme;
    elements.themeLabel.textContent = theme === 'dark' ? 'Terang' : 'Gelap';

    try {
      localStorage.setItem('kalkulus-theme', theme);
    } catch (error) {
      // localStorage bisa tidak tersedia.
    }

    Graph.redraw();
  }

  function initTheme() {
    var theme = elements.html.dataset.theme === 'dark' ? 'dark' : 'light';
    elements.themeLabel.textContent = theme === 'dark' ? 'Terang' : 'Gelap';

    elements.themeToggle.addEventListener('click', function () {
      applyTheme(elements.html.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  function initModeTabs() {
    elements.tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        setMode(tab.dataset.mode);
      });

      tab.addEventListener('keydown', function (event) {
        var index = elements.tabs.indexOf(tab);
        var target = null;

        if (event.key === 'ArrowRight') {
          target = elements.tabs[(index + 1) % elements.tabs.length];
        } else if (event.key === 'ArrowLeft') {
          target = elements.tabs[(index - 1 + elements.tabs.length) % elements.tabs.length];
        } else if (event.key === 'Home') {
          target = elements.tabs[0];
        } else if (event.key === 'End') {
          target = elements.tabs[elements.tabs.length - 1];
        }

        if (target) {
          event.preventDefault();
          setMode(target.dataset.mode);
          target.focus();
        }
      });
    });
  }

  function initAngleToggle() {
    elements.angleButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        state.angle = button.dataset.angle === 'deg' ? 'deg' : 'rad';
        elements.angleButtons.forEach(function (item) {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
        updateMeta();

        if (state.mode === 'calc' && elements.expression.value.trim()) {
          compute();
        } else {
          schedulePreview();
        }
      });
    });
  }

  function initKeypad() {
    [elements.insertBar, elements.keypad].forEach(function (container) {
      container.addEventListener('click', function (event) {
        var button = event.target.closest('button');
        if (!button) {
          return;
        }

        if (button.dataset.insert !== undefined) {
          insertText(button.dataset.insert, Number(button.dataset.caret || 0));
          return;
        }

        var action = button.dataset.action;
        if (action === 'clear') {
          clearExpression();
        } else if (action === 'backspace') {
          backspace();
        }
      });
    });

    elements.clearBtn.addEventListener('click', clearExpression);
  }

  function initGraphControls() {
    elements.zoomIn.addEventListener('click', function () {
      Graph.zoomBy(0.7);
    });
    elements.zoomOut.addEventListener('click', function () {
      Graph.zoomBy(1 / 0.7);
    });
    elements.resetView.addEventListener('click', function () {
      Graph.reset();
    });
  }

  function initCopy() {
    elements.copySteps.addEventListener('click', function () {
      if (!state.lastSteps.length) {
        return;
      }

      var text = state.lastSteps.map(function (step, index) {
        return (index + 1) + '. ' + step.label + '\n' + step.formula;
      }).join('\n\n');

      var done = function () {
        elements.copySteps.textContent = 'Tersalin';
        if (copyTimer) {
          clearTimeout(copyTimer);
        }
        copyTimer = setTimeout(function () {
          elements.copySteps.textContent = 'Salin';
        }, 1400);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          elements.copySteps.textContent = 'Gagal';
        });
      } else {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand('copy');
          done();
        } catch (error) {
          elements.copySteps.textContent = 'Gagal';
        }
        document.body.removeChild(area);
      }
    });
  }

  function initInputEvents() {
    elements.form.addEventListener('submit', function (event) {
      event.preventDefault();
      compute();
    });

    elements.expression.addEventListener('input', schedulePreview);
    elements.derivPoint.addEventListener('input', schedulePreview);
    elements.integralA.addEventListener('input', schedulePreview);
    elements.integralB.addEventListener('input', schedulePreview);

    elements.expression.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearExpression();
      }
    });
  }

  function init() {
    cacheElements();

    if (Graph && Graph.init) {
      Graph.init(byId('graph'));
    }

    initTheme();
    initModeTabs();
    initAngleToggle();
    initKeypad();
    initGraphControls();
    initCopy();
    initInputEvents();

    if (!elements.derivPoint.value) {
      elements.derivPoint.value = '1';
    }

    setMode('deriv');
    compute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
