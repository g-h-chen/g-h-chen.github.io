const DATA_INDEX_PATH = "static/data/top-exploiters/index.json";
const DATA_CACHE_BUSTER = "2026-04-19-results-fix2";

const header = document.querySelector(".site-header");
const navLinks = Array.from(document.querySelectorAll(".section-nav a"));
const revealNodes = document.querySelectorAll(".reveal");
const copyButtons = document.querySelectorAll("[data-copy-target]");

const explorerElements = {
  headlineTaskCount: document.getElementById("headline-task-count"),
  headlineModelCount: document.getElementById("headline-model-count"),
  headlineGpt54Rate: document.getElementById("headline-gpt54-rate"),
  headlineClaudeOpusRate: document.getElementById("headline-claude-opus-rate"),
  modelSelect: document.getElementById("model-select"),
  taskSelect: document.getElementById("task-select"),
  runSelect: document.getElementById("run-select"),
  viewerStatus: document.getElementById("viewer-status"),
  viewerEmpty: document.getElementById("viewer-empty"),
  viewerContent: document.getElementById("viewer-content"),
  viewerMetaLine: document.getElementById("viewer-meta-line"),
  viewerTaskTitle: document.getElementById("viewer-task-title"),
  viewerTaskSubtitle: document.getElementById("viewer-task-subtitle"),
  viewerKpis: document.getElementById("viewer-kpis"),
  roundsAccordion: document.getElementById("rounds-accordion"),
};

const explorerState = {
  index: null,
  selectedModelId: null,
  selectedTaskId: null,
  selectedRunId: null,
  selectedRoundIndex: null,
  taskCache: new Map(),
};

const initialParams = new URLSearchParams(window.location.search);
const initialRoute = {
  modelId: initialParams.get("model"),
  taskId: initialParams.get("task"),
  runId: initialParams.get("run"),
  roundIndex: Number(initialParams.get("round")),
};

const setHeaderState = () => {
  if (!header) {
    return;
  }
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const showRevealFallback = () => {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      const id = `#${visible.target.id}`;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === id);
      });
    },
    {
      rootMargin: "-25% 0px -55% 0px",
      threshold: [0.1, 0.25, 0.5],
    }
  );

  document.querySelectorAll("main [id]").forEach((section) => {
    sectionObserver.observe(section);
  });
} else {
  showRevealFallback();
}

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target");
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    try {
      await navigator.clipboard.writeText(target.textContent);
      const original = button.textContent;
      button.textContent = "Copied";
      button.classList.add("is-copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1600);
    } catch (error) {
      button.textContent = "Copy failed";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1600);
    }
  });
});

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
};

const formatScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const numeric = Number(value);
  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return numeric.toFixed(3).replace(/\.?0+$/, "");
};

const formatSignedScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const formatted = formatScore(value);
  if (formatted === "—") {
    return formatted;
  }
  return Number(value) > 0 ? `+${formatted}` : formatted;
};

const createEmptyCard = (message) => {
  const node = document.createElement("div");
  node.className = "empty-card";
  node.textContent = message;
  return node;
};

const createPill = (label, className = "task-pill") => {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = label;
  return node;
};

const setText = (node, value) => {
  if (node) {
    node.textContent = value;
  }
};

const withCacheBust = (path) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(DATA_CACHE_BUSTER)}`;
};

const getSelectedModel = () =>
  explorerState.index?.models.find((model) => model.model_id === explorerState.selectedModelId) || null;

const getSelectedTaskSummary = () =>
  getSelectedModel()?.tasks.find((task) => task.task_id === explorerState.selectedTaskId) || null;

const describeRoundLabel = (round) => {
  if (round.exploit) {
    return "Exploitative round";
  }
  if (round.classified) {
    return "Reviewed non-exploit round";
  }
  return "No exploit mark";
};

const syncUrlState = () => {
  const url = new URL(window.location.href);
  if (explorerState.selectedModelId) {
    url.searchParams.set("model", explorerState.selectedModelId);
  } else {
    url.searchParams.delete("model");
  }
  if (explorerState.selectedTaskId) {
    url.searchParams.set("task", explorerState.selectedTaskId);
  } else {
    url.searchParams.delete("task");
  }
  if (explorerState.selectedRunId) {
    url.searchParams.set("run", explorerState.selectedRunId);
  } else {
    url.searchParams.delete("run");
  }
  if (explorerState.selectedRoundIndex) {
    url.searchParams.set("round", String(explorerState.selectedRoundIndex));
  } else {
    url.searchParams.delete("round");
  }
  window.history.replaceState({}, "", url);
};

const setViewerLoading = (message) => {
  explorerElements.viewerEmpty.textContent = message;
  explorerElements.viewerEmpty.hidden = false;
  explorerElements.viewerContent.hidden = true;
  explorerElements.viewerStatus.textContent = message;
};

const buildOutcomeItem = (label, value) => {
  const node = document.createElement("div");
  node.className = "outcome-item";

  const heading = document.createElement("div");
  heading.className = "outcome-item-header";

  const labelNode = document.createElement("span");
  labelNode.className = "outcome-label";
  labelNode.textContent = label;

  heading.append(labelNode);
  node.append(heading);

  const valueNode = document.createElement("p");
  valueNode.className = "outcome-value";
  valueNode.textContent = value;
  node.append(valueNode);
  return node;
};

const buildTextBlock = (text, className = "content-text") => {
  const node = document.createElement("p");
  node.className = className;
  node.textContent = text;
  return node;
};

const buildPreBlock = (text, className = "long-text-block round-pre") => {
  const node = document.createElement("pre");
  node.className = className;
  node.textContent = text;
  return node;
};

const buildPayloadBlock = (title, content) => {
  const wrap = document.createElement("div");
  wrap.className = "tool-payload";

  const label = document.createElement("p");
  label.className = "tool-payload-title";
  label.textContent = title;

  wrap.append(label, buildPreBlock(content, "long-text-block tool-payload-pre"));
  return wrap;
};

const buildRoundSection = (title, content, options = {}) => {
  const details = document.createElement("details");
  details.className = "round-section";
  details.open = Boolean(options.open);

  const summary = document.createElement("summary");
  summary.textContent = title;
  details.append(summary);

  const body = document.createElement("div");
  body.className = "round-section-body";

  if (content instanceof Node) {
    body.append(content);
  } else if (Array.isArray(content)) {
    content.forEach((item) => {
      if (item instanceof Node) {
        body.append(item);
      }
    });
  } else if (typeof content === "string" && content) {
    body.append(buildTextBlock(content));
  } else if (options.emptyMessage) {
    body.append(createEmptyCard(options.emptyMessage));
  }

  details.append(body);
  return details;
};

const buildToolEvent = (action, index) => {
  const article = document.createElement("article");
  article.className = "tool-event";

  const header = document.createElement("div");
  header.className = "tool-event-header";

  const titleRow = document.createElement("div");
  titleRow.className = "tool-event-title";

  const step = document.createElement("span");
  step.className = "tool-step";
  step.textContent = `Step ${index + 1}`;

  const actionName = document.createElement("span");
  actionName.className = "action-name";
  actionName.textContent = action.action;

  titleRow.append(step, actionName);
  header.append(titleRow, createPill(action.ok ? "ok" : "failed", action.ok ? "status-pill is-safe" : "status-pill is-exploit"));
  article.append(header);

  const body = document.createElement("div");
  body.className = "tool-event-body";

  if (action.target) {
    const target = document.createElement("p");
    target.className = "action-target";
    target.textContent = action.target;
    body.append(target);
  }

  body.append(buildTextBlock(action.summary || "No tool summary recorded.", "action-summary"));

  if (action.details?.length) {
    action.details.forEach((detail) => {
      body.append(buildPayloadBlock(detail.title, detail.content));
    });
  }

  article.append(body);
  return article;
};

const buildFileSnapshot = (file, open = false) => {
  const details = document.createElement("details");
  details.className = "file-snapshot";
  details.open = open;

  const summary = document.createElement("summary");
  summary.className = "file-snapshot-summary";
  summary.textContent = file.path || "Unnamed file";
  details.append(summary);

  const body = document.createElement("div");
  body.className = "file-snapshot-body";
  body.append(buildPreBlock(file.content || "No file content captured for this round.", "long-text-block tool-payload-pre"));
  details.append(body);
  return details;
};

const closeSiblingRoundEntries = (activeEntry) => {
  explorerElements.roundsAccordion.querySelectorAll(".round-entry").forEach((entry) => {
    if (entry !== activeEntry) {
      entry.open = false;
    }
  });
};

const renderHeadlines = () => {
  if (!explorerState.index) {
    return;
  }
  const { benchmark_summary: summary, models } = explorerState.index;
  const gpt54 = models.find((model) => model.model_id === "gpt_54");
  const claudeOpus = models.find((model) => model.model_id === "claude_opus46");

  setText(explorerElements.headlineTaskCount, String(summary.task_count));
  setText(explorerElements.headlineModelCount, String(summary.model_count));
  setText(explorerElements.headlineGpt54Rate, formatPercent(gpt54?.exploit_rate));
  setText(explorerElements.headlineClaudeOpusRate, formatPercent(claudeOpus?.exploit_rate));
};

const populateModelSelect = () => {
  explorerElements.modelSelect.innerHTML = "";
  explorerState.index.models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.model_id;
    option.textContent = `${model.model_label} (${formatPercent(model.exploit_rate)})`;
    explorerElements.modelSelect.append(option);
  });
  explorerElements.modelSelect.value = explorerState.selectedModelId || explorerState.index.models[0]?.model_id || "";
};

const populateTaskSelect = () => {
  const model = getSelectedModel();
  explorerElements.taskSelect.innerHTML = "";
  if (!model) {
    return;
  }
  model.tasks.forEach((task) => {
    const option = document.createElement("option");
    option.value = task.task_id;
    option.textContent = task.task_label;
    explorerElements.taskSelect.append(option);
  });
  explorerElements.taskSelect.value = explorerState.selectedTaskId || model.tasks[0]?.task_id || "";
};

const populateRunSelect = (taskSummary) => {
  explorerElements.runSelect.innerHTML = "";
  taskSummary.runs.forEach((run) => {
    const option = document.createElement("option");
    option.value = run.run_id;
    option.textContent = `${run.run_id} · pub ${formatScore(run.final_public_score)} · priv ${formatScore(run.final_private_score)}`;
    explorerElements.runSelect.append(option);
  });
  explorerElements.runSelect.value = explorerState.selectedRunId || taskSummary.representative_run_id || taskSummary.runs[0]?.run_id || "";
};

const loadTaskBundle = async (taskSummary) => {
  const cached = explorerState.taskCache.get(taskSummary.fetch_path);
  if (cached) {
    return cached;
  }
  const response = await fetch(withCacheBust(taskSummary.fetch_path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${taskSummary.fetch_path}`);
  }
  const payload = await response.json();
  explorerState.taskCache.set(taskSummary.fetch_path, payload);
  return payload;
};

const renderRoundsAccordion = (runData) => {
  explorerElements.roundsAccordion.innerHTML = "";

  if (!runData.rounds.length) {
    explorerElements.roundsAccordion.append(createEmptyCard("No rounds were recorded for this run."));
    return;
  }

  runData.rounds.forEach((round, index) => {
    const entry = document.createElement("details");
    entry.className = "round-entry";
    if (round.exploit) {
      entry.classList.add("is-exploit");
    }

    const isSelected = round.round_index === explorerState.selectedRoundIndex;
    entry.open = isSelected;

    const summary = document.createElement("summary");
    summary.className = "round-entry-summary";

    const summaryMain = document.createElement("div");
    summaryMain.className = "round-summary-main";

    const summaryTitle = document.createElement("div");
    summaryTitle.className = "round-summary-title";

    const roundLabel = document.createElement("strong");
    roundLabel.textContent = `Round ${round.round_index}`;
    summaryTitle.append(roundLabel);

    if (round.exploit) {
      summaryTitle.append(createPill("Exploit", "status-pill is-exploit"));
    } else if (round.classified) {
      summaryTitle.append(createPill("Reviewed", "status-pill is-safe"));
    }

    const summaryMeta = document.createElement("div");
    summaryMeta.className = "round-summary-meta";
    summaryMeta.append(
      createPill(`Public ${formatScore(round.public_score)}`, "kpi-pill"),
      createPill(`Private ${formatScore(round.private_score)}`, "kpi-pill"),
      createPill(round.feedback_reason || "no feedback reason", "kpi-pill")
    );

    summaryMain.append(summaryTitle, summaryMeta);
    summary.append(summaryMain);
    entry.append(summary);

    const body = document.createElement("div");
    body.className = "round-entry-body";

    body.append(
      buildRoundSection(
        "User Prompt",
        buildPreBlock(round.prompt || "No explicit user prompt captured for this round."),
        { open: isSelected || round.round_index === 1 }
      )
    );

    if (round.assistant_notes.length) {
      const notes = document.createElement("div");
      notes.className = "notes-stack";
      round.assistant_notes.forEach((note) => {
        const block = document.createElement("div");
        block.className = "note-pill";
        block.textContent = note;
        notes.append(block);
      });
      body.append(buildRoundSection("Assistant Notes", notes, { open: false }));
    }

    const toolEvents = document.createElement("div");
    toolEvents.className = "tool-event-list";
    if (round.actions.length) {
      round.actions.forEach((action, actionIndex) => {
        toolEvents.append(buildToolEvent(action, actionIndex));
      });
    } else {
      toolEvents.append(createEmptyCard("No tool actions recorded for this round."));
    }
    body.append(buildRoundSection("Tool Results", toolEvents, { open: false }));

    const outcome = document.createElement("div");
    outcome.className = "outcome-grid";
    outcome.append(
      buildOutcomeItem("Round label", describeRoundLabel(round)),
      buildOutcomeItem("Public score", formatScore(round.public_score)),
      buildOutcomeItem("Private score", formatScore(round.private_score)),
      buildOutcomeItem("Feedback reason", round.feedback_reason || "—")
    );
    body.append(buildRoundSection("Outcome", outcome, { open: isSelected }));

    const files = document.createElement("div");
    files.className = "tool-event-list";
    if (round.files_after_round?.length) {
      round.files_after_round.forEach((file, fileIndex) => {
        files.append(buildFileSnapshot(file, isSelected && fileIndex === 0));
      });
    } else {
      files.append(createEmptyCard("No modified file snapshot was captured after this round."));
    }
    body.append(buildRoundSection("Files", files, { open: false }));

    const judge = document.createElement("div");
    judge.className = "judge-box";
    const judgeLabel = document.createElement("p");
    judgeLabel.className = "judge-label";
    judgeLabel.textContent = describeRoundLabel(round);
    const judgeReasoning = buildTextBlock(round.judge_reasoning || "No cached classification reasoning recorded for this round.");
    judge.append(judgeLabel, judgeReasoning);
    body.append(buildRoundSection("Judge", judge, { open: false }));

    body.append(
      buildRoundSection(
        "Round Summary",
        buildPreBlock(round.round_summary || "No round summary recorded."),
        { open: round.round_index === runData.default_round }
      )
    );

    entry.append(body);

    entry.addEventListener("toggle", () => {
      if (!entry.open) {
        return;
      }
      explorerState.selectedRoundIndex = round.round_index;
      closeSiblingRoundEntries(entry);
      const model = getSelectedModel();
      const taskSummary = getSelectedTaskSummary();
      if (model && taskSummary) {
        explorerElements.viewerStatus.textContent = `${model.model_label} · ${taskSummary.task_label} · ${runData.run_id} · R${round.round_index}`;
      }
      syncUrlState();
    });

    explorerElements.roundsAccordion.append(entry);
  });
};

const renderViewer = (taskSummary, taskBundle) => {
  const model = getSelectedModel();
  if (!model) {
    return;
  }

  const selectedRun =
    taskBundle.runs.find((run) => run.run_id === explorerState.selectedRunId) ||
    taskBundle.runs.find((run) => run.run_id === taskBundle.representative_run_id) ||
    taskBundle.runs[0];

  if (!selectedRun) {
    setViewerLoading("No run data is available for this task.");
    return;
  }

  explorerState.selectedRunId = selectedRun.run_id;
  explorerElements.runSelect.value = selectedRun.run_id;

  const validRound = selectedRun.rounds.find((round) => round.round_index === explorerState.selectedRoundIndex);
  explorerState.selectedRoundIndex = validRound ? validRound.round_index : selectedRun.default_round;

  explorerElements.viewerEmpty.hidden = true;
  explorerElements.viewerContent.hidden = false;
  explorerElements.viewerMetaLine.textContent = model.model_label;
  explorerElements.viewerTaskTitle.textContent = taskSummary.task_label;
  explorerElements.viewerTaskSubtitle.textContent = "";
  explorerElements.viewerTaskSubtitle.hidden = true;

  explorerElements.viewerKpis.innerHTML = "";
  explorerElements.viewerKpis.append(
    createPill(taskSummary.modality || "—", "kpi-pill"),
    createPill(taskSummary.metric || "—", "kpi-pill"),
    createPill(taskSummary.prediction_task || "—", "kpi-pill"),
    createPill(
      taskSummary.dataset_triplet
        ? `train/public/private ${taskSummary.dataset_triplet}`
        : "train/public/private —",
      "kpi-pill"
    )
  );

  renderRoundsAccordion(selectedRun);
  explorerElements.viewerStatus.textContent = `${model.model_label} · ${taskSummary.task_label} · ${selectedRun.run_id} · R${explorerState.selectedRoundIndex}`;
  syncUrlState();
};

const selectRun = async (runId, options = {}) => {
  const taskSummary = getSelectedTaskSummary();
  if (!taskSummary) {
    return;
  }

  explorerState.selectedRunId = runId;
  if (!options.preserveRound) {
    explorerState.selectedRoundIndex = null;
  }

  try {
    const taskBundle = await loadTaskBundle(taskSummary);
    renderViewer(taskSummary, taskBundle);
  } catch (error) {
    setViewerLoading(`Failed to load ${taskSummary.task_label}.`);
    explorerElements.viewerStatus.textContent = "Failed to load the selected task bundle.";
  }
};

const selectTask = async (taskId, options = {}) => {
  const model = getSelectedModel();
  const taskSummary = model?.tasks.find((task) => task.task_id === taskId);
  if (!taskSummary) {
    return;
  }

  explorerState.selectedTaskId = taskId;
  explorerElements.taskSelect.value = taskId;

  if (!options.preserveRun) {
    explorerState.selectedRunId = null;
  }
  if (!options.preserveRound) {
    explorerState.selectedRoundIndex = null;
  }

  populateRunSelect(taskSummary);
  setViewerLoading(`Loading ${taskSummary.task_label}…`);

  try {
    const taskBundle = await loadTaskBundle(taskSummary);
    explorerState.selectedRunId =
      explorerState.selectedRunId && taskSummary.runs.some((run) => run.run_id === explorerState.selectedRunId)
        ? explorerState.selectedRunId
        : taskBundle.representative_run_id || taskSummary.runs[0]?.run_id || null;
    populateRunSelect(taskSummary);
    renderViewer(taskSummary, taskBundle);
  } catch (error) {
    setViewerLoading(`Failed to load ${taskSummary.task_label}.`);
    explorerElements.viewerStatus.textContent = "Failed to load the selected task bundle.";
  }
};

const selectModel = async (modelId, options = {}) => {
  if (!explorerState.index) {
    return;
  }

  const model = explorerState.index.models.find((item) => item.model_id === modelId);
  if (!model) {
    return;
  }

  explorerState.selectedModelId = modelId;
  explorerElements.modelSelect.value = modelId;

  if (!options.preserveTask || !model.tasks.some((task) => task.task_id === explorerState.selectedTaskId)) {
    explorerState.selectedTaskId = model.tasks[0]?.task_id || null;
  }
  if (!options.preserveRun) {
    explorerState.selectedRunId = null;
  }
  if (!options.preserveRound) {
    explorerState.selectedRoundIndex = null;
  }

  populateTaskSelect();
  if (explorerState.selectedTaskId) {
    await selectTask(explorerState.selectedTaskId, {
      preserveRun: options.preserveRun,
      preserveRound: options.preserveRound,
    });
  } else {
    setViewerLoading("No task data is available for the selected model.");
  }
};

const bindExplorerControls = () => {
  explorerElements.modelSelect.addEventListener("change", async (event) => {
    await selectModel(event.target.value);
  });

  explorerElements.taskSelect.addEventListener("change", async (event) => {
    await selectTask(event.target.value);
  });

  explorerElements.runSelect.addEventListener("change", async (event) => {
    await selectRun(event.target.value);
  });
};

const initExplorer = async () => {
  if (!explorerElements.modelSelect) {
    return;
  }

  bindExplorerControls();
  setViewerLoading("Loading conversation index…");

  try {
    const response = await fetch(withCacheBust(DATA_INDEX_PATH), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${DATA_INDEX_PATH}`);
    }
    explorerState.index = await response.json();
  } catch (error) {
    explorerElements.viewerStatus.textContent = "Conversation explorer data is unavailable.";
    setViewerLoading("Conversation explorer data is unavailable.");
    return;
  }

  renderHeadlines();
  populateModelSelect();

  const initialModelId =
    initialRoute.modelId && explorerState.index.models.some((model) => model.model_id === initialRoute.modelId)
      ? initialRoute.modelId
      : explorerState.index.models[0]?.model_id;

  if (!initialModelId) {
    explorerElements.viewerStatus.textContent = "No conversation data found.";
    setViewerLoading("No conversation data found.");
    return;
  }

  const selectedModel = explorerState.index.models.find((model) => model.model_id === initialModelId);
  const initialTaskId =
    selectedModel?.tasks.some((task) => task.task_id === initialRoute.taskId)
      ? initialRoute.taskId
      : selectedModel?.tasks[0]?.task_id || null;

  explorerState.selectedModelId = initialModelId;
  explorerState.selectedTaskId = initialTaskId;
  explorerState.selectedRunId = initialRoute.runId || null;
  explorerState.selectedRoundIndex = Number.isFinite(initialRoute.roundIndex) ? initialRoute.roundIndex : null;

  populateModelSelect();
  populateTaskSelect();

  await selectModel(initialModelId, {
    preserveTask: true,
    preserveRun: true,
    preserveRound: true,
  });
};

void (async () => {
  try {
    await initExplorer();
  } catch (error) {
    console.error(error);
    if (explorerElements.viewerStatus) {
      explorerElements.viewerStatus.textContent = "Conversation explorer data is unavailable.";
    }
    if (explorerElements.viewerEmpty && explorerElements.viewerContent) {
      setViewerLoading("Conversation explorer data is unavailable.");
    }
  }
})();
