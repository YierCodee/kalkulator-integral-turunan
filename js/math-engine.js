(function (global) {
  'use strict';

  var math = global.math;
  if (!math) {
    throw new Error('math.js belum dimuat.');
  }

  var ALLOWED_FUNCTIONS = new Set([
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
    'sqrt', 'cbrt', 'nthRoot', 'abs', 'exp',
    'log', 'log10', 'log2',
    'floor', 'ceil', 'round', 'sign',
    'min', 'max', 'factorial'
  ]);

  var ALLOWED_CONSTANTS = new Set(['pi', 'e', 'tau', 'Infinity']);

  var ALLOWED_OPERATORS = new Set([
    'add', 'subtract', 'multiply', 'divide', 'pow',
    'unaryMinus', 'unaryPlus', 'factorial', 'mod'
  ]);

  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;

  var DEGREE_SCOPE = {
    sin: function (x) { return Math.sin(x * D2R); },
    cos: function (x) { return Math.cos(x * D2R); },
    tan: function (x) { return Math.tan(x * D2R); },
    sec: function (x) { return 1 / Math.cos(x * D2R); },
    csc: function (x) { return 1 / Math.sin(x * D2R); },
    cot: function (x) { return 1 / Math.tan(x * D2R); },
    asin: function (x) { return Math.asin(x) * R2D; },
    acos: function (x) { return Math.acos(x) * R2D; },
    atan: function (x) { return Math.atan(x) * R2D; }
  };

  function CalcError(message, code) {
    var error = new Error(message);
    error.name = 'CalcError';
    error.code = code || 'calc';
    return error;
  }

  function normalize(raw) {
    var source = String(raw == null ? '' : raw).trim();
    if (!source) {
      throw CalcError('Ekspresi masih kosong.');
    }

    var protectedSci = [];
    var text = source.replace(/\d+(?:\.\d+)?[eE][+-]?\d+/g, function (match) {
      protectedSci.push(match);
      return '\u0000SCI' + (protectedSci.length - 1) + '\u0000';
    });

    text = text
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/[\u00d7\u00b7\u2219\u22c5]/g, '*')
      .replace(/[\u00f7\u2215]/g, '/')
      .replace(/[\u03c0\u03a0]/g, 'pi')
      .replace(/\u221a/g, 'sqrt')
      .replace(/\u221b/g, 'cbrt')
      .replace(/\u221e/g, 'Infinity')
      .replace(/\u00b2/g, '^2')
      .replace(/\u00b3/g, '^3')
      .replace(/\u2074/g, '^4')
      .replace(/\u2075/g, '^5')
      .replace(/\u207b/g, '-')
      .replace(/\*\*/g, '^')
      .replace(/\barcsin\b/gi, 'asin')
      .replace(/\barccos\b/gi, 'acos')
      .replace(/\barctan\b/gi, 'atan')
      .replace(/\blog\s*\(/gi, 'log10(')
      .replace(/\bln\s*\(/gi, 'log(')
      .replace(/\blg\s*\(/gi, 'log10(');

    // Perkalian implisit: 2x, 2(x+1), (x+1)(x-1), x(x+1)
    text = text
      .replace(/(?<![a-zA-Z0-9])(\d)\s*(?=[a-zA-Z(])/g, '$1*')
      .replace(/\)\s*(?=[a-zA-Z0-9(])/g, ')*')
      .replace(/\b(pi|e|x)\s*(?=\()/g, '$1*');

    text = text.replace(/\u0000SCI(\d+)\u0000/g, function (match, index) {
      return protectedSci[Number(index)];
    });

    return text.trim();
  }

  function friendlyParseError(error) {
    var message = String(error && error.message ? error.message : error);
    if (/Unexpected end of expression/i.test(message)) {
      return 'Ekspresi belum lengkap. Periksa angka terakhir atau tanda kurung.';
    }
    if (/Parenthesis \)\s*expected/i.test(message)) {
      return 'Tanda kurung tutup ")" belum ada.';
    }
    if (/Unexpected part/i.test(message)) {
      return 'Ada bagian ekspresi yang tidak bisa dibaca. Periksa operator berurutan.';
    }
    if (/Value expected/i.test(message)) {
      return 'Ada operator yang belum memiliki angka, misalnya "^" tanpa pangkat.';
    }
    if (/Unknown character/i.test(message)) {
      return 'Ada karakter yang tidak dikenal. Gunakan angka, x, operator, atau fungsi yang tersedia.';
    }
    return 'Ekspresi tidak valid: ' + message;
  }

  function validate(node) {
    node.traverse(function (current, path, parent) {
      var type = current.type;

      if (type === 'ConstantNode') {
        if (typeof current.value !== 'number') {
          throw CalcError('Hanya bilangan real yang didukung.');
        }
        return;
      }

      if (type === 'SymbolNode') {
        if (current.name === 'x' || ALLOWED_CONSTANTS.has(current.name)) {
          return;
        }
        if (parent && parent.isFunctionNode && parent.fn === current && ALLOWED_FUNCTIONS.has(current.name)) {
          return;
        }
        if (ALLOWED_FUNCTIONS.has(current.name)) {
          throw CalcError('Fungsi "' + current.name + '" harus diikuti tanda kurung.');
        }
        throw CalcError('Simbol "' + current.name + '" belum dikenal. Gunakan x, pi, atau e.');
      }

      if (type === 'OperatorNode') {
        if (!ALLOWED_OPERATORS.has(current.fn)) {
          throw CalcError('Operator "' + current.op + '" belum didukung.');
        }
        return;
      }

      if (type === 'FunctionNode') {
        var name = current.fn && current.fn.name;
        if (!ALLOWED_FUNCTIONS.has(name)) {
          throw CalcError('Fungsi "' + (name || '?') + '" tidak didukung.');
        }
        return;
      }

      if (type === 'ParenthesisNode') {
        return;
      }

      throw CalcError('Bentuk ekspresi ini belum didukung. Gunakan angka, x, operator, dan fungsi matematika.');
    });
  }

  function parse(raw) {
    var normalized = normalize(raw);
    var node;
    try {
      node = math.parse(normalized);
    } catch (error) {
      throw CalcError(friendlyParseError(error), 'parse');
    }
    validate(node);
    return node;
  }

  function containsX(node) {
    var found = false;
    node.traverse(function (current) {
      if (current.isSymbolNode && current.name === 'x') {
        found = true;
      }
    });
    return found;
  }

  function evaluateNode(node, x, degreeMode) {
    var scope = { x: x, pi: Math.PI, e: Math.E };
    if (degreeMode) {
      Object.assign(scope, DEGREE_SCOPE);
    }

    var value;
    try {
      value = node.compile().evaluate(scope);
    } catch (error) {
      throw CalcError('Tidak bisa menghitung: ' + (error && error.message ? error.message : 'terjadi kesalahan.'));
    }

    if (typeof value !== 'number') {
      throw CalcError('Hasil bukan bilangan real. Kalkulator ini hanya mendukung bilangan real.');
    }
    return value;
  }

  function parseConstant(raw, label) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) {
      throw CalcError((label || 'Nilai') + ' masih kosong.');
    }
    var node = parse(text);
    if (containsX(node)) {
      throw CalcError((label || 'Nilai') + ' tidak boleh mengandung variabel x.');
    }
    var value = evaluateNode(node, 0, false);
    if (!Number.isFinite(value)) {
      throw CalcError((label || 'Nilai') + ' tidak menghasilkan bilangan berhingga.');
    }
    return value;
  }

  function makeFunction(raw, degreeMode) {
    var node = parse(raw);
    var compiled = node.compile();
    var scope = { x: 0, pi: Math.PI, e: Math.E };

    if (degreeMode) {
      Object.assign(scope, DEGREE_SCOPE);
    }

    return function (x) {
      try {
        scope.x = x;
        var value = compiled.evaluate(scope);
        return typeof value === 'number' ? value : NaN;
      } catch (error) {
        return NaN;
      }
    };
  }

  function symbolicDerivative(raw) {
    var node = parse(raw);
    var exact;
    try {
      exact = math.derivative(node, 'x');
    } catch (error) {
      throw CalcError(
        'Turunan simbolik tidak tersedia untuk fungsi ini. Isi titik evaluasi untuk memakai turunan numerik.',
        'unsupported'
      );
    }

    var simplified = exact;
    try {
      simplified = math.simplify(exact);
    } catch (error) {
      simplified = exact;
    }

    return {
      node: simplified,
      exactNode: exact,
      expression: simplified.toString(),
      exactExpression: exact.toString()
    };
  }

  function centralDifference(fn, x, h) {
    var upper = fn(x + h);
    var lower = fn(x - h);
    return (upper - lower) / (2 * h);
  }

  function numericDerivative(fn, point) {
    var base = Math.max(1, Math.abs(point));
    var h = Math.cbrt(Number.EPSILON) * base;
    var first = centralDifference(fn, point, h);
    var second = centralDifference(fn, point, h / 2);

    if (!Number.isFinite(second)) {
      throw CalcError('Turunan di x = ' + formatNumberPlain(point) + ' tidak terdefinisi.');
    }

    var forward = (fn(point + h) - fn(point)) / h;
    var backward = (fn(point) - fn(point - h)) / h;

    if (Number.isFinite(forward) && Number.isFinite(backward)) {
      var scale = Math.max(1, Math.abs(forward), Math.abs(backward));
      if (Math.abs(forward - backward) > 0.25 * scale) {
        throw CalcError(
          'Turunan di x = ' + formatNumberPlain(point) +
          ' tidak terdefinisi karena fungsi tidak mulus di titik ini.'
        );
      }
    }

    return {
      value: second,
      error: Math.abs(first - second),
      h: h / 2
    };
  }

  function derivativeAt(raw, point) {
    try {
      var symbolic = symbolicDerivative(raw);
      var value = evaluateNode(symbolic.node, point, false);
      if (Number.isFinite(value)) {
        return { value: value, method: 'symbolic', expression: symbolic.expression };
      }
    } catch (error) {
      // Lanjut ke turunan numerik.
    }

    var fn = makeFunction(raw);
    var numeric = numericDerivative(fn, point);
    return { value: numeric.value, method: 'numeric', error: numeric.error, h: numeric.h };
  }

  function simpson(fn, a, b, n) {
    if (n % 2 !== 0) {
      n += 1;
    }
    var h = (b - a) / n;
    var sum = 0;

    for (var i = 0; i <= n; i += 1) {
      var x = a + i * h;
      var y = i === n ? fn(b) : fn(x);
      if (!Number.isFinite(y)) {
        throw CalcError(
          'Fungsi tidak terdefinisi pada x = ' + formatNumberPlain(x) + '. Periksa batas atau titik singular.'
        );
      }
      if (i === 0 || i === n) {
        sum += y;
      } else {
        sum += (i % 2 === 1 ? 4 : 2) * y;
      }
    }

    return (sum * h) / 3;
  }

  function integrate(raw, a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw CalcError('Kedua batas integral harus berupa bilangan berhingga.');
    }

    var fn = makeFunction(raw);
    var swapped = false;
    var lower = a;
    var upper = b;

    if (lower > upper) {
      lower = b;
      upper = a;
      swapped = true;
    }

    if (lower === upper) {
      return {
        value: 0,
        error: 0,
        n: 0,
        h: 0,
        swapped: swapped,
        converged: true
      };
    }

    var n = 200;
    var lastN = n;
    var previous = null;
    var beforePrevious = null;
    var lastExtrapolated = null;
    var value = 0;
    var errorEstimate = null;
    var usedExtrapolation = false;

    for (var iteration = 0; iteration < 10; iteration += 1) {
      var rawValue = simpson(fn, lower, upper, n);
      lastN = n;
      value = rawValue;
      errorEstimate = null;

      if (previous !== null && beforePrevious !== null) {
        var delta = rawValue - previous;
        var previousDelta = previous - beforePrevious;

        if (delta !== 0 && previousDelta !== 0 && (delta > 0) === (previousDelta > 0)) {
          var order = -Math.log2(Math.abs(delta / previousDelta));

          if (order > 0.5 && order < 8) {
            var extrapolated = rawValue + delta / (Math.pow(2, order) - 1);

            if (Number.isFinite(extrapolated)) {
              value = extrapolated;
              usedExtrapolation = true;
              errorEstimate = lastExtrapolated === null
                ? Math.abs(extrapolated - rawValue)
                : Math.abs(extrapolated - lastExtrapolated);
              lastExtrapolated = extrapolated;
            }
          }
        }
      }

      if (errorEstimate === null && previous !== null) {
        errorEstimate = Math.abs(rawValue - previous);
      }

      if (errorEstimate !== null && errorEstimate <= 1e-9) {
        break;
      }

      beforePrevious = previous;
      previous = rawValue;
      if (iteration < 9) {
        n *= 2;
      }
    }

    if (!Number.isFinite(value)) {
      throw CalcError('Integral tidak menghasilkan bilangan berhingga pada interval ini.');
    }

    return {
      value: swapped ? -value : value,
      error: errorEstimate,
      n: lastN,
      h: (upper - lower) / lastN,
      swapped: swapped,
      converged: errorEstimate === null ? false : errorEstimate <= 1e-9,
      extrapolated: usedExtrapolation
    };
  }

  function superscript(value) {
    var map = {
      '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074',
      '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
      '-': '\u207b', '+': '\u207a'
    };
    return String(value).split('').map(function (character) {
      return map[character] || character;
    }).join('');
  }

  function formatNumberPlain(value, digits) {
    var precision = digits || 10;

    if (Number.isNaN(value)) {
      return 'tidak terdefinisi';
    }
    if (value === Infinity) {
      return '\u221e';
    }
    if (value === -Infinity) {
      return '\u2212\u221e';
    }

    var number = value;
    if (Math.abs(number) < 1e-14) {
      number = 0;
    }

    var absolute = Math.abs(number);
    if (absolute !== 0 && (absolute >= 1e9 || absolute < 1e-5)) {
      var parts = number.toExponential(6).split('e');
      var mantissa = parts[0].replace(/\.?0+$/, '').replace('-', '\u2212');
      return mantissa + ' \u00d7 10^' + parseInt(parts[1], 10);
    }

    return String(Number(number.toPrecision(precision))).replace('-', '\u2212');
  }

  function formatNumberHTML(value, digits) {
    var plain = formatNumberPlain(value, digits);
    return plain
      .replace(/\^(-?\d+)/g, function (match, exponent) {
        return '<sup>' + exponent.replace('-', '\u2212') + '</sup>';
      })
      .replace(/\u221e/g, '\u221e')
      .replace(/^-/, '\u2212');
  }

  function pretty(str) {
    var text = String(str == null ? '' : str);
    return text
      .replace(/\bpi\b/g, '\u03c0')
      .replace(/\bInfinity\b/g, '\u221e')
      .replace(/\blog10\b/g, 'log\u2081\u2080')
      .replace(/\blog2\b/g, 'log\u2082')
      .replace(/\blog\b(?!\u2081|\u2082)/g, 'ln')
      .replace(/\bsqrt\b/g, '\u221a')
      .replace(/\bcbrt\b/g, '\u221b')
      .replace(/\s*\*\s*/g, '\u00b7')
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\s-\s/g, ' \u2212 ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function mathHTML(str) {
    return escapeHTML(pretty(str)).replace(/\s*\^\s*(-?\d+)/g, function (match, exponent) {
      return '<sup>' + exponent.replace('-', '\u2212') + '</sup>';
    });
  }

  function normalizeNumberText(value) {
    return formatNumberPlain(value, 8);
  }

  global.KalkulusEngine = {
    CalcError: CalcError,
    normalize: normalize,
    parse: parse,
    parseConstant: parseConstant,
    containsX: containsX,
    evaluateNode: evaluateNode,
    makeFunction: makeFunction,
    symbolicDerivative: symbolicDerivative,
    derivativeAt: derivativeAt,
    numericDerivative: function (raw, point) {
      return numericDerivative(makeFunction(raw), point);
    },
    integrate: integrate,
    formatNumberPlain: formatNumberPlain,
    formatNumberHTML: formatNumberHTML,
    normalizeNumberText: normalizeNumberText,
    pretty: pretty,
    mathHTML: mathHTML,
    escapeHTML: escapeHTML,
    superscript: superscript
  };
})(typeof window !== 'undefined' ? window : globalThis);
