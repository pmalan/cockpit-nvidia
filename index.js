	var REFRESH_HISTORY = 12;
	var POLL_INTERVAL = 5000;
	var storageKey = "cockpit-nvidia-sparkline-history";

	var COLUMNS = [
		{ key: "timestamp", parse: "raw" },
		{ key: "name",     parse: "raw" },
		{ key: "utilization.gpu",    parse: "number" },
		{ key: "utilization.memory",  parse: "number" },
		{ key: "temperature.gpu",      parse: "number" },
		{ key: "power.draw",            parse: "number" },
		{ key: "memory.used",           parse: "number" },
		{ key: "memory.free",             parse: "number" }
	];

	function loadHistory() {
		try {
			var raw = localStorage.getItem(storageKey);
			return raw ? JSON.parse(raw) : {};
		} catch (e) { return {}; }
	}

	function saveHistory(hist) {
		try { localStorage.setItem(storageKey, JSON.stringify(hist)); } catch (e) {}
	}

	function appendPoint(gpuName, metric, value, hist) {
		if (!hist[gpuName]) hist[gpuName] = {};
		if (!hist[gpuName][metric]) hist[gpuName][metric] = [];
		hist[gpuName][metric].push(value);
		while (hist[gpuName][metric].length > REFRESH_HISTORY) {
			hist[gpuName][metric].shift();
		}
	}

	function normalizeForSparkline(values, metricKey) {
		if (!values || values.length === 0) return [];
		var max = Math.max.apply(null, values);
		if (max <= 0) max = 1;
		return values.map(function(v) { return v / max; });
	}

	function createSparklineSvg(values, metricKey, colorClass, width, height) {
		width = width || 200;
		height = height || 40;

		if (!values || values.length === 0) {
			return '<svg class="sparkline-svg ' + colorClass + '" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none"></svg>';
		}

		var normalized = normalizeForSparkline(values, metricKey);
		var n = normalized.length;
		if (n === 1) {
			var x0 = String((width / 2).toFixed(1)), y0 = String(((height - 4) - normalized[0] * (height - 8)).toFixed(1));
			return '<svg class="sparkline-svg ' + colorClass + '" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
				'<circle cx="' + x0 + '" cy="' + y0 + '" r="2" fill="currentColor" /></svg>';
		}
		var stepX = width / (n - 1);
		var pathD = "M ";
		for (var i = 0; i < n; i++) {
			var x = (i * stepX).toFixed(1);
			var yVal = ((height - 4) - normalized[i] * (height - 8)).toFixed(1);
			pathD += x + "," + yVal;
			if (i < n - 1) pathD += " L ";
		}
		var areaD = pathD + " L " + ((n-1)*stepX).toFixed(1) + "," + height.toFixed(1) + " L 0," + height.toFixed(1);

		return '<svg class="sparkline-svg ' + colorClass + '" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
			'<path d="' + areaD + '" class="sparkline-area" />' +
			'<path d="' + pathD + '" class="sparkline-line" fill="none" stroke-width="1.5" />' +
			"</svg>";
	}

	var METRIC_COLORS = {
		"utilization.gpu": "pf-m-color--info",
		"utilization.memory": "pf-m-color--success",
		"temperature.gpu": "pf-m-color--warning",
		"power.draw": "pf-m-color--danger",
		"memory.used": "pf-m-color--secondary",
		"memory.free": "pf-m-color--black-400"
	};

	function getColorClass(metric) { return METRIC_COLORS[metric] || ""; }

	var UNIT_MAP = {
		"utilization.gpu": "%",
		"utilization.memory": "%",
		"temperature.gpu": "\u00b0C",
		"power.draw": " W",
		"memory.used": " MiB",
		"memory.free": " MiB"
	};

	var LABEL_MAP = {
		"utilization.gpu": "Util",
		"utilization.memory": "DRAM",
		"temperature.gpu": "Temp",
		"power.draw": "Power",
		"memory.used": "Used",
		"memory.free": "Free"
	};

	function formatNumber(num, metric) {
		if (metric === "power.draw") return Math.round(num * 10) / 10;
		return Math.round(num).toString();
	}

	function escapeHtml(str) {
		var div = document.createElement("div");
		div.appendChild(document.createTextNode(str));
		return div.innerHTML;
	}

	function parseNvmlOutput(rawCsv) {
		if (!rawCsv || typeof rawCsv !== "string") return [];
		var lines = rawCsv.trim().split("\n");
		while (lines.length > 0 && lines[0].indexOf("+---") === 0) { lines.shift(); }
		if (lines.length < 1 || !lines[0].trim()) return [];

		var readings = [];
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].replace(/^"+|"$/g, "").trim();
			if (!line) continue;
			var values = line.split(",");
			if (values.length !== COLUMNS.length) continue;

			var entry = {};
			for (var j = 0; j < COLUMNS.length; j++) {
				var col = COLUMNS[j];
				var val = values[j].replace(/^\s+|\s+$/g, "").trim();
				if (col.parse === "number") {
					entry[col.key] = { raw: val, value: parseFloat(val) };
				} else {
					entry[col.key] = { raw: val, value: val };
				}
			}
			readings.push(entry);
		}
		return readings;
	}

	function syncTheme() {
		try {
			var parentBody = window.parent.document.body;
			if (parentBody) {
				var stl = window.parent.getComputedStyle(parentBody);
				document.body.style.backgroundColor = stl.backgroundColor || '#ffffff';
				document.body.style.color             = stl.color               || '#151515';
			}
		} catch (e) {}
	}

	syncTheme();
	setInterval(syncTheme, 2000);

	function buildGpuCard(name, timestamp, metricsData, hist, cardWidth) {
		var displayMetrics = [
			"utilization.gpu", "utilization.memory",
			"temperature.gpu", "power.draw",
			"memory.used", "memory.free"
		];

		var html = '<div class="gpu-card">';
		html += '  <div class="gpu-card-title">';
		html += '    <span class="gpu-name">' + escapeHtml(name) + '</span>';
		html += '    <span class="gpu-timestamp">' + escapeHtml(timestamp) + '</span>';
		html += '  </div>';

		html += '  <div class="gpu-metrics">';
		for (var m = 0; m < displayMetrics.length; m++) {
			var metricKey = displayMetrics[m];
			var md = metricsData[metricKey];
			if (!md || typeof md.value !== "number") continue;

			var valueStr = formatNumber(md.value, metricKey);
			var colorClass = getColorClass(metricKey);
			var unit = UNIT_MAP[metricKey] || "";

			var sparkValues = (hist[name] && hist[name][metricKey]) ? hist[name][metricKey] : null;
			var sparkW = Math.round(cardWidth * 0.65) - 30;
			var sparkSvg = createSparklineSvg(sparkValues, metricKey, colorClass, sparkW, 28);

			html += '  <div class="gpu-metric-row">';
			html += '    <span class="metric-label">' + LABEL_MAP[metricKey] + '</span>';
			html += '    <span class="metric-value ' + colorClass + '">' + valueStr + '</span><span class="metric-unit">' + unit + '</span>';
			html += '    <div class="sparkline-wrapper">' + sparkSvg + '</div>';
			html += '  </div>'; // .gpu-metric-row
		}
		html += '  </div>'; // .gpu-metrics
		html += '  </div>'; // .gpu-card

		return html;
	}

	function renderGpus(readings, hist) {
		var grid = document.getElementById("gpu-grid");
		if (!grid) return;
		if (readings.length === 0) {
			grid.innerHTML = '<div class="no-gpu-msg">No GPU data received. Make sure the NVIDIA driver is loaded.</div>';
			return;
		}

		var cardWidth = grid.offsetWidth || 800;

		grid.innerHTML = readings.map(function(r) {
			var metricsData = {};
			for (var k in r) {
				if (r.hasOwnProperty(k)) {
					metricsData[k] = r[k];
				}
			}
			return buildGpuCard(metricsData.name.raw, metricsData.timestamp.raw, metricsData, hist, cardWidth);
		}).join('\n');

		var sl = document.getElementById("status-line");
		if (sl) {
			sl.className = "sensor-status-line";
			sl.textContent = readings.length + " GPU" + (readings.length > 1 ? "s" : "") + " detected — updated at " + new Date().toLocaleTimeString();
		}
	}

	function fetchGpuData() {
		if (typeof cockpit === "undefined") return;

		var sl = document.getElementById("status-line");
		if (sl) { sl.className = "sensor-status-line status-loading"; sl.textContent = "Loading NVIDIA GPU data ..."; }

		cockpit.spawn(["/usr/bin/nvidia-smi", "--query-gpu=timestamp,name,utilization.gpu,utilization.memory,temperature.gpu,power.draw,memory.used,memory.free", "--format=csv,noheader,nounits"], {
			superuser: "root"
		}).then(function(raw) {
			var json = parseNvmlOutput(raw);
			if (json && json.length > 0) {
				var hist = loadHistory();
				for (var i = 0; i < json.length; i++) {
					var gpuName = json[i].name.raw;
					appendPoint(gpuName, "utilization.gpu",       json[i]["utilization.gpu"].value,    hist);
					appendPoint(gpuName, "utilization.memory",     json[i]["utilization.memory"].value, hist);
					appendPoint(gpuName, "temperature.gpu",        json[i]["temperature.gpu"].value,   hist);
					appendPoint(gpuName, "power.draw",             json[i]["power.draw"].value,         hist);
					appendPoint(gpuName, "memory.used",            json[i]["memory.used"].value,        hist);
					appendPoint(gpuName, "memory.free",            json[i]["memory.free"].value,        hist);
				}
				saveHistory(hist);
				renderGpus(json, hist);
			} else {
				if (sl) sl.textContent = "No GPU data - nvidia-smi returned no results.";
			}
		}).catch(function(err) {
			console.error("spawn failed:", JSON.stringify(err));
			if (sl) {
				sl.className = "sensor-status-line";
				sl.textContent = "Error: check that the NVIDIA driver and nvidia-smi are installed.";
			}
		});
	}

	function init() {
		if (typeof cockpit !== "undefined") {
			fetchGpuData();
			refreshTimer = setInterval(function () { fetchGpuData(); }, POLL_INTERVAL);
		} else {
			setTimeout(init, 200);
		}
	}

	init();