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
  modelGrid: document.getElementById("top-model-grid"),
  taskSearch: document.getElementById("task-search"),
  modalityFilters: document.getElementById("modality-filters"),
  taskBrowserStatus: document.getElementById("task-browser-status"),
  taskBrowserTitle: document.getElementById("task-browser-title"),
  taskList: document.getElementById("task-list"),
  viewerEmpty: document.getElementById("viewer-empty"),
  viewerContent: document.getElementById("viewer-content"),
  viewerMetaLine: document.getElementById("viewer-meta-line"),
  viewerTaskTitle: document.getElementById("viewer-task-title"),
  viewerTaskSubtitle: document.getElementById("viewer-task-subtitle"),
  viewerKpis: document.getElementById("viewer-kpis"),
  runSelector: document.getElementById("run-selector"),
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
  search: "",
  modality: "All",
  taskCache: new Map(),
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

const initialParams = new URLSearchParams(window.location.search);
const initialRoute = {
  modelId: initialParams.get("model"),
  taskId: initialParams.get("task"),
  runId: initialParams.get("run"),
  roundIndex: Number(initialParams.get("round")),
};

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

const getVisibleTasks = (model) => {
  const search = explorerState.search.trim().toLowerCase();
  return model.tasks.filter((task) => {
    const matchesModality = explorerState.modality === "All" || task.modality === explorerState.modality;
    const haystack = `${task.task_label} ${task.prediction_task} ${task.metric} ${task.modality}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesModality && matchesSearch;
  });
};

const ensureVisibleTaskSelection = (model) => {
  const visibleTasks = getVisibleTasks(model);
  if (!visibleTasks.length) {
    explorerState.selectedTaskId = null;
    return null;
  }
  if (!visibleTasks.some((task) => task.task_id === explorerState.selectedTaskId)) {
    explorerState.selectedTaskId = visibleTasks[0].task_id;
  }
  return visibleTasks.find((task) => task.task_id === explorerState.selectedTaskId) || visibleTasks[0];
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
  explorerElements.headlineTopLabel.textContent = summary.top_exploiter_label || "top exploiter headline";
};

const renderModelCards = () => {
  const modelGrid = explorerElements.modelGrid;
  modelGrid.innerHTML = "";

  explorerState.index.models.forEach((model) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "model-tab-card";
    if (model.model_id === explorerState.selectedModelId) {
      button.classList.add("is-selected");
    }

    button.innerHTML = `
      <p class="model-family">${model.family}</p>
      <h3>${model.model_label}</h3>
      <p class="content-text">
        ${model.tasks_with_any_exploit}/${model.tasks.length} tasks show at least one exploit run.
      </p>
      <div class="metric-stack">
        <div class="metric-row"><span>Exploit rate</span><strong>${formatPercent(model.exploit_rate)}</strong></div>
        <div class="metric-row"><span>Private rank</span><strong>${formatScore(model.mean_private_rank)}</strong></div>
        <div class="metric-row"><span>All-run exploit tasks</span><strong>${model.tasks_with_all_runs_exploit}</strong></div>
      </div>
    `;

    button.addEventListener("click", () => {
      selectModel(model.model_id);
    });
    modelGrid.append(button);
  });
};

const renderModalityFilters = () => {
  const filterRoot = explorerElements.modalityFilters;
  filterRoot.innerHTML = "";
  ["All", "Tabular", "Text", "Vision"].forEach((modality) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    if (explorerState.modality === modality) {
      button.classList.add("is-selected");
    }
    button.textContent = modality;
    button.addEventListener("click", () => {
      explorerState.modality = modality;
      renderModalityFilters();
      const model = getSelectedModel();
      if (model) {
        ensureVisibleTaskSelection(model);
      }
      renderTaskList();
      if (explorerState.selectedTaskId) {
        void selectTask(explorerState.selectedTaskId, { preserveRun: true, preserveRound: true });
      }
    });
    filterRoot.append(button);
  });
};

const renderTaskList = () => {
  const model = getSelectedModel();
  if (!model) {
    explorerElements.taskList.innerHTML = "";
    explorerElements.taskBrowserStatus.textContent = "No model selected.";
    return;
  }

  explorerElements.taskBrowserTitle.textContent = `${model.model_label} task browser`;
  const visibleTasks = getVisibleTasks(model);
  explorerElements.taskBrowserStatus.textContent = `${visibleTasks.length}/${model.tasks.length} tasks shown`;

  if (!visibleTasks.length) {
    explorerElements.taskList.innerHTML = "";
    explorerElements.taskList.append(createEmptyCard("No tasks match the current search/filter."));
    setViewerLoading("No task matches the current search/filter.");
    return;
  }

  explorerElements.taskList.innerHTML = "";
  visibleTasks.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-item";
    if (task.task_id === explorerState.selectedTaskId) {
      button.classList.add("is-selected");
    }

    const statusClass = task.exploit_runs > 0 ? "status-pill is-exploit" : "status-pill is-safe";
    button.innerHTML = `
      <div class="task-item-header">
        <div>
          <div class="task-tags">
            <span class="task-pill">${task.modality}</span>
          </div>
          <h4>${task.task_label}</h4>
        </div>
        <span class="${statusClass}">${task.exploit_runs}/${task.total_runs} exploit</span>
      </div>
      <p class="content-text">${task.prediction_task}</p>
      <div class="task-item-metrics">
        <span class="task-pill">${task.metric}</span>
        <span class="task-pill">${task.dataset_triplet}</span>
      </div>
    `;

    button.addEventListener("click", () => {
      selectTask(task.task_id);
    });
    explorerElements.taskList.append(button);
  });
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

const renderRunSelector = (taskSummary, taskBundle) => {
  explorerElements.runSelector.innerHTML = "";

  taskSummary.runs.forEach((run) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "run-chip";
    if (run.run_id === explorerState.selectedRunId) {
      button.classList.add("is-selected");
    }
    if (run.exploit) {
      button.classList.add("is-exploit");
    }
    button.textContent = `${run.run_id}${run.exploit ? " · exploit" : ""}`;
    button.title = `${run.run_id} | final public ${formatScore(run.final_public_score)} | final private ${formatScore(run.final_private_score)}`;
    button.addEventListener("click", () => {
      selectRun(taskSummary, taskBundle, run.run_id);
    });
    explorerElements.runSelector.append(button);
  });
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
    button.textContent = `R${round.round_index}`;
    button.title = `Round ${round.round_index} | public ${formatScore(round.public_score)} | private ${formatScore(round.private_score)}`;
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
    buildOutcomeItem("Exploit verdict", round.exploit ? "Exploit-positive" : "No exploit"),
    buildOutcomeItem("Public score", formatScore(round.public_score)),
    buildOutcomeItem("Private score", formatScore(round.private_score)),
    buildOutcomeItem("Feedback reason", round.feedback_reason || "—")
  );

  explorerElements.judgeLabel.textContent = round.exploit ? "Exploit-positive round" : "Non-exploit round";
  explorerElements.judgeReasoning.textContent = round.judge_reasoning || "No judge reasoning recorded.";
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
  const validRound = selectedRun.rounds.find((round) => round.round_index === explorerState.selectedRoundIndex);
  explorerState.selectedRoundIndex = validRound ? validRound.round_index : selectedRun.default_round;

  explorerElements.viewerEmpty.hidden = true;
  explorerElements.viewerContent.hidden = false;
  explorerElements.viewerMetaLine.textContent = `${model.model_label} · ${taskSummary.modality} · ${taskSummary.metric}`;
  explorerElements.viewerTaskTitle.textContent = taskSummary.task_label;
  explorerElements.viewerTaskSubtitle.textContent = `${taskSummary.prediction_task} · train/public/private ${taskSummary.dataset_triplet}`;

  explorerElements.viewerKpis.innerHTML = "";
  explorerElements.viewerKpis.append(
    createPill(`${taskSummary.exploit_runs}/${taskSummary.total_runs} exploit runs`, taskSummary.exploit_runs ? "status-pill is-exploit" : "status-pill is-safe"),
    createPill(`Representative ${taskBundle.representative_run_id}`, "kpi-pill"),
    createPill(selectedRun.ended_reason || "ended", "kpi-pill")
  );

  renderRunSelector(taskSummary, taskBundle);
  renderRoundStrip(selectedRun);
  renderCurrentRound(selectedRun);
  syncUrlState();
};

const selectRun = (taskSummary, taskBundle, runId) => {
  const run = taskBundle.runs.find((item) => item.run_id === runId);
  if (!run) {
    return;
  }
  explorerState.selectedRunId = run.run_id;
  explorerState.selectedRoundIndex = run.default_round;
  renderViewer(taskSummary, taskBundle);
};

const selectTask = async (taskId, options = {}) => {
  const taskSummary = getSelectedModel()?.tasks.find((task) => task.task_id === taskId);
  if (!taskSummary) {
    return;
  }

  explorerState.selectedTaskId = taskId;
  if (!options.preserveRun) {
    explorerState.selectedRunId = null;
  }
  if (!options.preserveRound) {
    explorerState.selectedRoundIndex = null;
  }

  renderTaskList();
  setViewerLoading(`Loading ${taskSummary.task_label}…`);

  try {
    const taskBundle = await loadTaskBundle(taskSummary);
    renderViewer(taskSummary, taskBundle);
  } catch (error) {
    setViewerLoading(`Failed to load ${taskSummary.task_label}.`);
    explorerElements.taskBrowserStatus.textContent = "Failed to load the selected task bundle.";
  }
};

const selectModel = (modelId) => {
  if (!explorerState.index) {
    return;
  }

  explorerState.selectedModelId = modelId;
  explorerState.selectedTaskId = null;
  explorerState.selectedRunId = null;
  explorerState.selectedRoundIndex = null;

  renderModelCards();
  renderModalityFilters();
  const model = getSelectedModel();
  if (model) {
    ensureVisibleTaskSelection(model);
  }
  renderTaskList();
  if (explorerState.selectedTaskId) {
    void selectTask(explorerState.selectedTaskId, { preserveRun: true, preserveRound: true });
  }
};

const bindExplorerControls = () => {
  explorerElements.taskSearch.addEventListener("input", (event) => {
    explorerState.search = event.target.value || "";
    const model = getSelectedModel();
    if (model) {
      ensureVisibleTaskSelection(model);
    }
    renderTaskList();
    if (explorerState.selectedTaskId) {
      void selectTask(explorerState.selectedTaskId, { preserveRun: true, preserveRound: true });
    }
  });
};

const initExplorer = async () => {
  if (!explorerElements.modelGrid) {
    return;
  }

  bindExplorerControls();
  setViewerLoading("Loading top exploiter index…");

  try {
    const response = await fetch(DATA_INDEX_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${DATA_INDEX_PATH}`);
    }
    explorerState.index = await response.json();
  } catch (error) {
    explorerElements.taskBrowserStatus.textContent = "Conversation explorer data is unavailable.";
    setViewerLoading("Conversation explorer data is unavailable.");
    return;
  }

  renderHeadlines();

  const initialModelId =
    initialRoute.modelId && explorerState.index.models.some((model) => model.model_id === initialRoute.modelId)
      ? initialRoute.modelId
      : explorerState.index.models[0]?.model_id;

  if (!initialModelId) {
    explorerElements.taskBrowserStatus.textContent = "No top exploiter data found.";
    setViewerLoading("No top exploiter data found.");
    return;
  }

  const selectedModel = explorerState.index.models.find((model) => model.model_id === initialModelId);
  explorerState.selectedModelId = initialModelId;
  explorerState.selectedTaskId =
    selectedModel?.tasks.some((task) => task.task_id === initialRoute.taskId) ? initialRoute.taskId : null;
  explorerState.selectedRunId = initialRoute.runId || null;
  explorerState.selectedRoundIndex = Number.isFinite(initialRoute.roundIndex) ? initialRoute.roundIndex : null;

  renderModelCards();
  renderModalityFilters();
  ensureVisibleTaskSelection(selectedModel);
  renderTaskList();
  if (explorerState.selectedTaskId) {
    void selectTask(explorerState.selectedTaskId, { preserveRun: true, preserveRound: true });
  }
};

void initExplorer();
