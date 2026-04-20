const DATA_INDEX_PATH = "static/data/top-exploiters/index.json";

const header = document.querySelector(".site-header");
const navLinks = Array.from(document.querySelectorAll(".section-nav a"));
const revealNodes = document.querySelectorAll(".reveal");
const copyButtons = document.querySelectorAll("[data-copy-target]");

const explorerElements = {
  headlineTaskCount: document.getElementById("headline-task-count"),
  headlineModelCount: document.getElementById("headline-model-count"),
  headlineExploitRuns: document.getElementById("headline-exploit-runs"),
  headlineTopRate: document.getElementById("headline-top-rate"),
  headlineTopLabel: document.getElementById("headline-top-label"),
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

const buildToolEvent = (action, index, open = false) => {
  const details = document.createElement("details");
  details.className = "tool-event";
  details.open = open;

  const summary = document.createElement("summary");
  summary.className = "tool-event-summary";

  const titleRow = document.createElement("div");
  titleRow.className = "tool-event-title";

  const step = document.createElement("span");
  step.className = "tool-step";
  step.textContent = `Step ${index + 1}`;

  const actionName = document.createElement("span");
  actionName.className = "action-name";
  actionName.textContent = action.action;

  titleRow.append(step, actionName);
  summary.append(titleRow, createPill(action.ok ? "ok" : "failed", action.ok ? "status-pill is-safe" : "status-pill is-exploit"));
  details.append(summary);

  const body = document.createElement("div");
  body.className = "tool-event-body";

  if (action.target) {
    const target = document.createElement("p");
    target.className = "action-target";
    target.textContent = action.target;
    body.append(target);
  }

  body.append(buildTextBlock(action.summary || "No tool summary recorded.", "action-summary"));
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
  const { benchmark_summary: summary } = explorerState.index;
  explorerElements.headlineTaskCount.textContent = summary.task_count;
  explorerElements.headlineModelCount.textContent = summary.model_count;
  explorerElements.headlineExploitRuns.textContent = summary.exploit_runs;
  explorerElements.headlineTopRate.textContent = formatPercent(summary.top_exploiter_rate);
  explorerElements.headlineTopLabel.textContent = summary.top_exploiter_label || "headline model";
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
  const response = await fetch(taskSummary.fetch_path);
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
        toolEvents.append(buildToolEvent(action, actionIndex, isSelected && actionIndex === 0));
      });
    } else {
      toolEvents.append(createEmptyCard("No tool actions recorded for this round."));
    }
    body.append(buildRoundSection("Tool Results", toolEvents, { open: isSelected || round.exploit }));

    const outcome = document.createElement("div");
    outcome.className = "outcome-grid";
    outcome.append(
      buildOutcomeItem("Round label", describeRoundLabel(round)),
      buildOutcomeItem("Public score", formatScore(round.public_score)),
      buildOutcomeItem("Private score", formatScore(round.private_score)),
      buildOutcomeItem("Feedback reason", round.feedback_reason || "—")
    );
    body.append(buildRoundSection("Outcome", outcome, { open: isSelected }));

    const judge = document.createElement("div");
    judge.className = "judge-box";
    const judgeLabel = document.createElement("p");
    judgeLabel.className = "judge-label";
    judgeLabel.textContent = describeRoundLabel(round);
    const judgeReasoning = buildTextBlock(round.judge_reasoning || "No cached classification reasoning recorded for this round.");
    judge.append(judgeLabel, judgeReasoning);
    body.append(buildRoundSection("Judge", judge, { open: false }));

    const feedback = document.createElement("div");
    feedback.className = "feedback-box";
    const feedbackReason = document.createElement("p");
    feedbackReason.className = "feedback-reason";
    feedbackReason.textContent = round.feedback_reason || "No feedback reason recorded.";
    const feedbackMessage = buildTextBlock(round.feedback_message || "No feedback message recorded.");
    feedback.append(feedbackReason, feedbackMessage);
    body.append(buildRoundSection("Feedback", feedback, { open: false }));

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
  explorerElements.viewerMetaLine.textContent = `${model.model_label} · ${taskSummary.modality} · ${taskSummary.metric}`;
  explorerElements.viewerTaskTitle.textContent = taskSummary.task_label;
  explorerElements.viewerTaskSubtitle.textContent = `${taskSummary.prediction_task} · train/public/private ${taskSummary.dataset_triplet}`;

  explorerElements.viewerKpis.innerHTML = "";
  explorerElements.viewerKpis.append(
    createPill(`Run ${selectedRun.run_id}`, "kpi-pill"),
    createPill(`${taskSummary.exploit_runs}/${taskSummary.total_runs} exploit runs`, taskSummary.exploit_runs ? "status-pill is-exploit" : "status-pill is-safe"),
    createPill(`Final public ${formatScore(selectedRun.final_public_score)}`, "kpi-pill"),
    createPill(`Final private ${formatScore(selectedRun.final_private_score)}`, "kpi-pill"),
    createPill(`Gap ${formatSignedScore(selectedRun.public_private_gap)}`, "kpi-pill")
  );

  if (selectedRun.first_exploit_round) {
    explorerElements.viewerKpis.append(createPill(`First exploit R${selectedRun.first_exploit_round}`, "status-pill is-exploit"));
  }
  if (selectedRun.ended_reason) {
    explorerElements.viewerKpis.append(createPill(selectedRun.ended_reason, "kpi-pill"));
  }

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
    const response = await fetch(DATA_INDEX_PATH);
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

void initExplorer();
