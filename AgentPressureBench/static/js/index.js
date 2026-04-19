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
  roundStrip: document.getElementById("round-strip"),
  promptDetails: document.getElementById("prompt-details"),
  roundPrompt: document.getElementById("round-prompt"),
  assistantNotesCard: document.getElementById("assistant-notes-card"),
  assistantNotes: document.getElementById("assistant-notes"),
  actionLog: document.getElementById("action-log"),
  roundOutcome: document.getElementById("round-outcome"),
  judgeLabel: document.getElementById("judge-label"),
  judgeReasoning: document.getElementById("judge-reasoning"),
  feedbackReason: document.getElementById("feedback-reason"),
  feedbackMessage: document.getElementById("feedback-message"),
  summaryDetails: document.getElementById("summary-details"),
  roundSummary: document.getElementById("round-summary"),
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

const renderRoundStrip = (runData) => {
  explorerElements.roundStrip.innerHTML = "";
  runData.rounds.forEach((round) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "round-chip";
    if (round.round_index === explorerState.selectedRoundIndex) {
      button.classList.add("is-selected");
    }
    if (round.exploit) {
      button.classList.add("is-exploit");
    }
    button.title = `Round ${round.round_index} | ${describeRoundLabel(round)} | public ${formatScore(round.public_score)} | private ${formatScore(round.private_score)}`;

    const label = document.createElement("span");
    label.textContent = `R${round.round_index}`;
    button.append(label);

    if (round.exploit) {
      const badge = document.createElement("span");
      badge.className = "round-chip-badge";
      badge.textContent = "EXP";
      button.append(badge);
    }

    button.addEventListener("click", () => {
      explorerState.selectedRoundIndex = round.round_index;
      syncUrlState();
      renderCurrentRound(runData);
      renderRoundStrip(runData);
    });
    explorerElements.roundStrip.append(button);
  });
};

const renderCurrentRound = (runData) => {
  const round = runData.rounds.find((item) => item.round_index === explorerState.selectedRoundIndex) || runData.rounds[0];
  if (!round) {
    return;
  }

  explorerElements.roundPrompt.textContent = round.prompt || "No explicit user prompt captured for this round.";
  explorerElements.promptDetails.open = round.prompt.length < 700 || round.round_index === 1;

  explorerElements.assistantNotes.innerHTML = "";
  if (round.assistant_notes.length) {
    explorerElements.assistantNotesCard.hidden = false;
    round.assistant_notes.forEach((note) => {
      const block = document.createElement("div");
      block.className = "note-pill";
      block.textContent = note;
      explorerElements.assistantNotes.append(block);
    });
  } else {
    explorerElements.assistantNotesCard.hidden = true;
  }

  explorerElements.actionLog.innerHTML = "";
  if (!round.actions.length) {
    explorerElements.actionLog.append(createEmptyCard("No tool actions recorded for this round."));
  } else {
    round.actions.forEach((action) => {
      const row = document.createElement("div");
      row.className = "action-row";

      const header = document.createElement("div");
      header.className = "action-row-header";

      const actionName = document.createElement("span");
      actionName.className = "action-name";
      actionName.textContent = action.action;

      const status = createPill(action.ok ? "ok" : "failed", action.ok ? "status-pill is-safe" : "status-pill is-exploit");

      header.append(actionName, status);
      row.append(header);

      if (action.target) {
        const target = document.createElement("p");
        target.className = "action-target";
        target.textContent = action.target;
        row.append(target);
      }

      const summary = document.createElement("p");
      summary.className = "action-summary";
      summary.textContent = action.summary;
      row.append(summary);

      explorerElements.actionLog.append(row);
    });
  }

  explorerElements.roundOutcome.innerHTML = "";
  explorerElements.roundOutcome.append(
    buildOutcomeItem("Round label", describeRoundLabel(round)),
    buildOutcomeItem("Public score", formatScore(round.public_score)),
    buildOutcomeItem("Private score", formatScore(round.private_score)),
    buildOutcomeItem("Feedback reason", round.feedback_reason || "—")
  );

  explorerElements.judgeLabel.textContent = describeRoundLabel(round);
  explorerElements.judgeReasoning.textContent = round.judge_reasoning || "No cached classification reasoning recorded for this round.";
  explorerElements.feedbackReason.textContent = round.feedback_reason || "No feedback reason recorded.";
  explorerElements.feedbackMessage.textContent = round.feedback_message || "No feedback message recorded.";
  explorerElements.roundSummary.textContent = round.round_summary || "No round summary recorded.";
  explorerElements.summaryDetails.open = round.round_index === runData.default_round;
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

  renderRoundStrip(selectedRun);
  renderCurrentRound(selectedRun);
  explorerElements.viewerStatus.textContent = `${model.model_label} · ${taskSummary.task_label} · ${selectedRun.run_id}`;
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
