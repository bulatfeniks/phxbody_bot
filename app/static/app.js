const app = document.getElementById("app");
const navButtons = document.querySelectorAll("nav button[data-view]");
const API_BASE = (window.PHX_API_BASE_URL || "").replace(/\/$/, "");

const SCENARIOS = {
  gtg: { label: "ГТГ / Круги", accent: "#58c4dd" },
  strength: { label: "Силовая", accent: "#f59e0b" },
  kettlebell: { label: "Гири / функционал", accent: "#8b5cf6" },
  activity: { label: "Активность / восстановление", accent: "#22c55e" },
  mixed: { label: "Смешанная", accent: "#f97316" },
  rest: { label: "Отдых", accent: "#64748b" },
};

const state = {
  view: "home",
  workouts: [],
  templates: [],
  analytics: null,
  editor: null,
  searchResults: [],
};

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("secondary_bg_color");
}

function hapticSuccess() {
  tg?.HapticFeedback?.notificationOccurred("success");
}

function hapticImpact() {
  tg?.HapticFeedback?.impactOccurred("light");
}

function getUserHeaders() {
  const userId = tg?.initDataUnsafe?.user?.id;
  return userId ? { "X-Telegram-User-Id": String(userId) } : {};
}

function buildApiUrl(path) {
  if (!API_BASE) return path;
  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}/${path}`;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getUserHeaders(),
    ...(options.headers || {}),
  };
  const response = await fetch(buildApiUrl(path), { ...options, headers });
  if (!response.ok) {
    throw new Error("API error");
  }
  return response.json();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function render() {
  navButtons.forEach((btn) => {
    btn.classList.toggle("text-accent", btn.dataset.view === state.view);
  });

  if (state.view === "home") return renderHome();
  if (state.view === "add") return renderScenarioPicker();
  if (state.view === "editor") return renderEditor();
  if (state.view === "history") return renderHistory();
  if (state.view === "analytics") return renderAnalytics();
}

function renderHome() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todays = state.workouts.find((item) => item.date === todayStr);
  const recent = state.workouts.slice(0, 6);

  app.innerHTML = `
    <header class="pt-6 pb-4">
      <h1 class="text-2xl font-semibold">PHXBody Log</h1>
      <p class="text-muted mt-1">Лаконичный дневник силы и восстановления.</p>
    </header>
    <section class="bg-card rounded-2xl p-4 shadow-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">Сегодня</p>
          <h2 class="text-xl font-semibold">${todays ? SCENARIOS[todays.scenario_type]?.label || "Тренировка" : "Пока пусто"}</h2>
        </div>
        <span class="text-xs px-3 py-1 rounded-full bg-slate-800">${formatDate(today)}</span>
      </div>
      <div class="mt-4">
        <button class="w-full py-3 rounded-xl bg-accent text-slate-900 font-semibold" id="start-today">
          ➕ Записать тренировку
        </button>
      </div>
      ${todays ? renderHighlights(todays) : "<p class='text-muted mt-3'>Выберите сценарий и запишите блоки дня.</p>"}
    </section>

    <section class="mt-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold">Последние дни</h3>
        <button class="text-sm text-muted" id="go-history">История →</button>
      </div>
      <div class="space-y-3">
        ${recent
          .map(
            (item) => `
          <button class="w-full text-left bg-card rounded-xl p-3" data-open="${item.id}">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">${item.date}</p>
                <h4 class="font-medium">${SCENARIOS[item.scenario_type]?.label || "Тренировка"}</h4>
              </div>
              <span class="text-xs text-muted">${summarizeBlocks(item)}</span>
            </div>
          </button>`
          )
          .join("")}
      </div>
    </section>
  `;

  document.getElementById("start-today").onclick = () => startNewWorkout();
  document.getElementById("go-history").onclick = () => setView("history");
  app.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.onclick = () => openWorkout(Number(btn.dataset.open));
  });
}

function renderHighlights(item) {
  const highlight = summarizeBlocks(item);
  return `<p class="text-sm text-muted mt-3">${highlight || "День создан, добавьте блоки"}</p>`;
}

function summarizeBlocks(item) {
  const blocks = item.blocks || [];
  const parts = [];
  blocks.forEach((block) => {
    if (block.type === "strength" && block.data.exercise) {
      parts.push(block.data.exercise);
    }
    if (block.type === "circuit") {
      parts.push(`${block.data.rounds || 0} кругов`);
    }
    if (block.type === "activity" && block.data.steps) {
      parts.push(`${block.data.steps} шагов`);
    }
  });
  return parts.slice(0, 2).join(" · ");
}

function renderScenarioPicker() {
  app.innerHTML = `
    <header class="pt-6 pb-4">
      <h2 class="text-2xl font-semibold">Выберите сценарий</h2>
      <p class="text-muted mt-1">Один тап до структуры дня.</p>
    </header>
    <div class="space-y-3">
      ${Object.entries(SCENARIOS)
        .filter(([key]) => key !== "rest")
        .map(
          ([key, item]) => `
        <button class="w-full bg-card rounded-2xl p-4 text-left flex items-center justify-between" data-scenario="${key}">
          <div>
            <h3 class="font-semibold">${item.label}</h3>
            <p class="text-sm text-muted">${scenarioHint(key)}</p>
          </div>
          <span class="text-xl">→</span>
        </button>`
        )
        .join("")}
      <button class="w-full bg-card rounded-2xl p-4 text-left flex items-center justify-between" data-scenario="rest">
        <div>
          <h3 class="font-semibold">Отдых</h3>
          <p class="text-sm text-muted">Восстановление, шаги, самочувствие.</p>
        </div>
        <span class="text-xl">→</span>
      </button>
    </div>
    <section class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold">Шаблоны</h3>
        <span class="text-xs text-muted">быстрый старт</span>
      </div>
      <div class="space-y-2">
        ${state.templates
          .map(
            (tpl) => `
          <button class="w-full bg-card rounded-xl p-3 text-left" data-template="${tpl.id}">
            <p class="text-sm text-muted">${SCENARIOS[tpl.scenario_type]?.label || "Сценарий"}</p>
            <p class="font-medium">${tpl.name}</p>
          </button>`
          )
          .join("") || `<p class="text-sm text-muted">Пока нет шаблонов. Сохраните блоки после записи.</p>`}
      </div>
    </section>
  `;

  app.querySelectorAll("button[data-scenario]").forEach((btn) => {
    btn.onclick = () => startNewWorkout(btn.dataset.scenario);
  });
  app.querySelectorAll("button[data-template]").forEach((btn) => {
    const tpl = state.templates.find((item) => item.id === Number(btn.dataset.template));
    if (tpl) {
      btn.onclick = () => startNewWorkout(tpl.scenario_type, tpl.blocks);
    }
  });
}

function scenarioHint(key) {
  switch (key) {
    case "gtg":
      return "Круги, чередование движений, заданные повторы.";
    case "strength":
      return "Короткие силовые блоки, веса и подходы.";
    case "kettlebell":
      return "Гири, комплексы, свободный ритм.";
    case "activity":
      return "Шаги, кардио, лёгкое восстановление.";
    case "mixed":
      return "Комбинируйте блоки разных типов.";
    default:
      return "";
  }
}

function startNewWorkout(scenario = "strength", blocks = null) {
  const today = new Date().toISOString().slice(0, 10);
  state.editor = {
    id: null,
    date: today,
    scenario_type: scenario,
    blocks: blocks || defaultBlocksForScenario(scenario),
    comment: "",
  };
  state.view = "editor";
  render();
}

function defaultBlocksForScenario(scenario) {
  if (scenario === "gtg") {
    return [{ type: "circuit", data: { rounds: 5, exercises: [{ name: "Отжимания", reps: 10 }] } }];
  }
  if (scenario === "strength") {
    return [{ type: "strength", data: { exercise: "Присед", sets: [{ weight: 60, reps: 5 }] } }];
  }
  if (scenario === "kettlebell") {
    return [{ type: "kettlebell", data: { exercise: "Свинг", weight: 24, mode: "2 руки", schema: "10x10" } }];
  }
  if (scenario === "activity") {
    return [{ type: "activity", data: { steps: 6000, cardio: [] } }];
  }
  if (scenario === "rest") {
    return [{ type: "activity", data: { steps: 3000, cardio: [] } }, { type: "note", data: { text: "" } }];
  }
  return [{ type: "strength", data: { exercise: "Жим стоя", sets: [{ weight: 30, reps: 5 }] } }];
}

function renderEditor() {
  const workout = state.editor;
  if (!workout) return;

  app.innerHTML = `
    <header class="pt-6 pb-4">
      <button class="text-sm text-muted" id="back">← Назад</button>
      <h2 class="text-2xl font-semibold mt-2">${SCENARIOS[workout.scenario_type]?.label || "День"}</h2>
      <div class="flex gap-2 mt-3">
        <input type="date" id="workout-date" value="${workout.date}" class="bg-card rounded-xl px-3 py-2 text-sm" />
        <select id="scenario-select" class="bg-card rounded-xl px-3 py-2 text-sm">
          ${Object.entries(SCENARIOS)
            .map(
              ([key, item]) => `
            <option value="${key}" ${key === workout.scenario_type ? "selected" : ""}>${item.label}</option>`
            )
            .join("")}
        </select>
      </div>
    </header>

    <section class="space-y-4">
      ${workout.blocks
        .map((block, index) => renderBlock(block, index))
        .join("")}
    </section>

    <section class="mt-4">
      <div class="bg-card rounded-2xl p-4">
        <label class="text-sm text-muted">Комментарий</label>
        <textarea id="comment" class="w-full mt-2 bg-transparent border border-slate-700 rounded-xl p-3" rows="3" placeholder="Самочувствие, сон, восстановление">${workout.comment || ""}</textarea>
      </div>
    </section>

    <section class="mt-4 space-y-3">
      <button class="w-full py-3 rounded-xl bg-slate-800" id="add-block">➕ Добавить блок</button>
      <button class="w-full py-3 rounded-xl bg-accent text-slate-900 font-semibold" id="save">Сохранить день</button>
      <button class="w-full py-3 rounded-xl bg-card" id="save-template">Сохранить как шаблон</button>
    </section>
  `;

  document.getElementById("back").onclick = () => setView("add");
  document.getElementById("save").onclick = saveWorkout;
  document.getElementById("save-template").onclick = saveTemplate;
  document.getElementById("add-block").onclick = () => addBlockPicker();
  document.getElementById("workout-date").onchange = (e) => (workout.date = e.target.value);
  document.getElementById("scenario-select").onchange = (e) => (workout.scenario_type = e.target.value);
  document.getElementById("comment").oninput = (e) => (workout.comment = e.target.value);
  bindBlockControls();
}

function renderBlock(block, index) {
  const header = blockTitle(block.type);
  return `
    <div class="bg-card rounded-2xl p-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">${header}</h3>
        <div class="flex gap-2">
          <button class="text-xs text-muted" data-move="up" data-index="${index}">↑</button>
          <button class="text-xs text-muted" data-move="down" data-index="${index}">↓</button>
          <button class="text-xs text-red-400" data-remove="${index}">Удалить</button>
        </div>
      </div>
      <div class="mt-3 space-y-3">
        ${renderBlockFields(block, index)}
      </div>
    </div>
  `;
}

function blockTitle(type) {
  switch (type) {
    case "circuit":
      return "ГТГ / Круги";
    case "strength":
      return "Силовой блок";
    case "kettlebell":
      return "Гири / функционал";
    case "activity":
      return "Активность";
    case "note":
      return "Свободная заметка";
    default:
      return "Блок";
  }
}

function renderBlockFields(block, index) {
  if (block.type === "circuit") {
    const exercises = block.data.exercises || [];
    return `
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted">Кругов</label>
        <input data-field="rounds" data-index="${index}" value="${block.data.rounds || ""}" class="bg-slate-800 rounded-xl px-3 py-2 w-24" />
      </div>
      <div class="space-y-2">
        ${exercises
          .map(
            (ex, exIndex) => `
          <div class="flex items-center gap-2">
            <input data-field="exercise-name" data-index="${index}" data-ex-index="${exIndex}" value="${ex.name || ""}" class="flex-1 bg-slate-800 rounded-xl px-3 py-2" placeholder="Движение" />
            <button class="px-3 py-2 bg-slate-800 rounded-xl" data-field="rep-minus" data-index="${index}" data-ex-index="${exIndex}">-</button>
            <input data-field="exercise-reps" data-index="${index}" data-ex-index="${exIndex}" value="${ex.reps || 0}" class="w-16 bg-slate-800 rounded-xl px-2 py-2 text-center" />
            <button class="px-3 py-2 bg-slate-800 rounded-xl" data-field="rep-plus" data-index="${index}" data-ex-index="${exIndex}">+</button>
            <button class="text-xs text-red-400" data-field="remove-ex" data-index="${index}" data-ex-index="${exIndex}">✕</button>
          </div>`
          )
          .join("")}
        <button class="text-sm text-accent" data-field="add-ex" data-index="${index}">+ добавить движение</button>
      </div>
    `;
  }
  if (block.type === "strength") {
    const sets = block.data.sets || [];
    return `
      <div>
        <label class="text-sm text-muted">Упражнение</label>
        <input data-field="exercise" data-index="${index}" value="${block.data.exercise || ""}" class="w-full bg-slate-800 rounded-xl px-3 py-2" placeholder="Например, присед" />
      </div>
      <div class="space-y-2">
        ${sets
          .map(
            (set, setIndex) => `
          <div class="grid grid-cols-3 gap-2">
            <input data-field="set-weight" data-index="${index}" data-set-index="${setIndex}" value="${set.weight || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="кг" />
            <input data-field="set-reps" data-index="${index}" data-set-index="${setIndex}" value="${set.reps || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="повт" />
            <div class="flex gap-1">
              <button class="flex-1 bg-slate-800 rounded-xl" data-field="dup-set" data-index="${index}" data-set-index="${setIndex}">=</button>
              <button class="flex-1 text-red-400 bg-slate-800 rounded-xl" data-field="remove-set" data-index="${index}" data-set-index="${setIndex}">✕</button>
            </div>
          </div>`
          )
          .join("")}
        <button class="text-sm text-accent" data-field="add-set" data-index="${index}">+ подход</button>
      </div>
    `;
  }
  if (block.type === "kettlebell") {
    return `
      <div class="grid grid-cols-2 gap-2">
        <input data-field="kb-exercise" data-index="${index}" value="${block.data.exercise || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="Движение" />
        <input data-field="kb-weight" data-index="${index}" value="${block.data.weight || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="Вес" />
        <input data-field="kb-mode" data-index="${index}" value="${block.data.mode || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="1/2 руки" />
        <input data-field="kb-schema" data-index="${index}" value="${block.data.schema || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="10x10, 50+50" />
      </div>
    `;
  }
  if (block.type === "activity") {
    const cardio = block.data.cardio || [];
    return `
      <div>
        <label class="text-sm text-muted">Шаги</label>
        <input data-field="steps" data-index="${index}" value="${block.data.steps || ""}" class="w-full bg-slate-800 rounded-xl px-3 py-2" placeholder="Шаги" />
      </div>
      <div class="space-y-2">
        ${cardio
          .map(
            (entry, cardioIndex) => `
          <div class="grid grid-cols-3 gap-2">
            <input data-field="cardio-min" data-index="${index}" data-cardio-index="${cardioIndex}" value="${entry.minutes || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="мин" />
            <input data-field="cardio-level" data-index="${index}" data-cardio-index="${cardioIndex}" value="${entry.level || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="уровень" />
            <input data-field="cardio-kcal" data-index="${index}" data-cardio-index="${cardioIndex}" value="${entry.kcal || ""}" class="bg-slate-800 rounded-xl px-3 py-2" placeholder="ккал" />
          </div>`
          )
          .join("")}
        <button class="text-sm text-accent" data-field="add-cardio" data-index="${index}">+ кардио</button>
      </div>
    `;
  }
  return `
    <textarea data-field="note" data-index="${index}" class="w-full bg-slate-800 rounded-xl px-3 py-2" rows="3" placeholder="Свободный комментарий">${block.data.text || ""}</textarea>
  `;
}

function bindBlockControls() {
  app.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.onclick = () => {
      state.editor.blocks.splice(Number(btn.dataset.remove), 1);
      render();
    };
  });

  app.querySelectorAll("[data-move]").forEach((btn) => {
    btn.onclick = () => {
      const index = Number(btn.dataset.index);
      const direction = btn.dataset.move === "up" ? -1 : 1;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= state.editor.blocks.length) return;
      const [item] = state.editor.blocks.splice(index, 1);
      state.editor.blocks.splice(newIndex, 0, item);
      render();
    };
  });

  app.querySelectorAll("input[data-field], textarea[data-field]").forEach((input) => {
    input.oninput = (event) => handleFieldChange(event.target);
  });

  app.querySelectorAll("button[data-field]").forEach((btn) => {
    btn.onclick = (event) => handleButtonAction(event.target);
  });
}

function handleFieldChange(target) {
  const index = Number(target.dataset.index);
  const block = state.editor.blocks[index];
  if (!block) return;

  switch (target.dataset.field) {
    case "rounds":
      block.data.rounds = Number(target.value || 0);
      break;
    case "exercise-name":
      block.data.exercises[target.dataset.exIndex].name = target.value;
      break;
    case "exercise-reps":
      block.data.exercises[target.dataset.exIndex].reps = Number(target.value || 0);
      break;
    case "exercise":
      block.data.exercise = target.value;
      break;
    case "set-weight":
      block.data.sets[target.dataset.setIndex].weight = target.value;
      break;
    case "set-reps":
      block.data.sets[target.dataset.setIndex].reps = target.value;
      break;
    case "kb-exercise":
      block.data.exercise = target.value;
      break;
    case "kb-weight":
      block.data.weight = target.value;
      break;
    case "kb-mode":
      block.data.mode = target.value;
      break;
    case "kb-schema":
      block.data.schema = target.value;
      break;
    case "steps":
      block.data.steps = target.value;
      break;
    case "cardio-min":
      block.data.cardio[target.dataset.cardioIndex].minutes = target.value;
      break;
    case "cardio-level":
      block.data.cardio[target.dataset.cardioIndex].level = target.value;
      break;
    case "cardio-kcal":
      block.data.cardio[target.dataset.cardioIndex].kcal = target.value;
      break;
    case "note":
      block.data.text = target.value;
      break;
    default:
      break;
  }
}

function handleButtonAction(target) {
  const index = Number(target.dataset.index);
  const block = state.editor.blocks[index];
  if (!block) return;

  switch (target.dataset.field) {
    case "add-ex":
      block.data.exercises = block.data.exercises || [];
      block.data.exercises.push({ name: "", reps: 8 });
      break;
    case "remove-ex":
      block.data.exercises.splice(Number(target.dataset.exIndex), 1);
      break;
    case "rep-plus":
      block.data.exercises[target.dataset.exIndex].reps += 1;
      break;
    case "rep-minus":
      block.data.exercises[target.dataset.exIndex].reps = Math.max(
        0,
        block.data.exercises[target.dataset.exIndex].reps - 1
      );
      break;
    case "add-set":
      block.data.sets = block.data.sets || [];
      block.data.sets.push({ weight: "", reps: "" });
      break;
    case "remove-set":
      block.data.sets.splice(Number(target.dataset.setIndex), 1);
      break;
    case "dup-set": {
      const set = block.data.sets[target.dataset.setIndex];
      block.data.sets.push({ ...set });
      break;
    }
    case "add-cardio":
      block.data.cardio = block.data.cardio || [];
      block.data.cardio.push({ minutes: "", level: "", kcal: "" });
      break;
    default:
      break;
  }
  render();
}

function addBlockPicker() {
  const options = [
    { type: "circuit", label: "ГТГ / круги" },
    { type: "strength", label: "Силовой блок" },
    { type: "kettlebell", label: "Гири" },
    { type: "activity", label: "Активность" },
    { type: "note", label: "Свободная заметка" },
  ];

  app.innerHTML = `
    <div class="pt-6">
      <button class="text-sm text-muted" id="back">← Назад</button>
      <h2 class="text-2xl font-semibold mt-2">Добавить блок</h2>
      <div class="mt-4 space-y-3">
        ${options
          .map(
            (option) => `
          <button class="w-full bg-card rounded-2xl p-4 text-left" data-block="${option.type}">
            <h3 class="font-semibold">${option.label}</h3>
          </button>`
          )
          .join("")}
      </div>
    </div>
  `;

  document.getElementById("back").onclick = () => setView("editor");
  app.querySelectorAll("button[data-block]").forEach((btn) => {
    btn.onclick = () => {
      state.editor.blocks.push(defaultBlockForType(btn.dataset.block));
      setView("editor");
    };
  });
}

function defaultBlockForType(type) {
  switch (type) {
    case "circuit":
      return { type: "circuit", data: { rounds: 4, exercises: [{ name: "Подтягивания", reps: 6 }] } };
    case "strength":
      return { type: "strength", data: { exercise: "Тяга", sets: [{ weight: "", reps: "" }] } };
    case "kettlebell":
      return { type: "kettlebell", data: { exercise: "Рывок", weight: 16, mode: "1 рука", schema: "5+5" } };
    case "activity":
      return { type: "activity", data: { steps: "", cardio: [] } };
    default:
      return { type: "note", data: { text: "" } };
  }
}

async function saveWorkout() {
  const payload = {
    date: state.editor.date,
    scenario_type: state.editor.scenario_type,
    blocks: state.editor.blocks,
    comment: state.editor.comment || "",
  };
  let saved;
  if (state.editor.id) {
    saved = await api(`/api/workout-days/${state.editor.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } else {
    saved = await api("/api/workout-days", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  state.editor.id = saved.id;
  hapticSuccess();
  await loadInitial();
  setView("home");
}

async function saveTemplate() {
  const name = prompt("Название шаблона");
  if (!name) return;
  await api("/api/templates", {
    method: "POST",
    body: JSON.stringify({
      name,
      scenario_type: state.editor.scenario_type,
      blocks: state.editor.blocks,
    }),
  });
  hapticImpact();
  await loadTemplates();
  alert("Шаблон сохранён");
}

async function openWorkout(id) {
  const data = await api(`/api/workout-days/${id}`);
  state.editor = data;
  state.view = "editor";
  render();
}

function renderHistory() {
  const options = Object.entries(SCENARIOS)
    .map(([key, item]) => `<option value="${key}">${item.label}</option>`)
    .join("");

  app.innerHTML = `
    <header class="pt-6 pb-4">
      <h2 class="text-2xl font-semibold">История</h2>
      <p class="text-muted mt-1">Быстрый поиск по движениям и шаблонам.</p>
    </header>
    <div class="bg-card rounded-2xl p-4 space-y-3">
      <input id="search" class="w-full bg-slate-800 rounded-xl px-3 py-2" placeholder="Поиск по упражнению" />
      <select id="filter" class="w-full bg-slate-800 rounded-xl px-3 py-2">
        <option value="">Все сценарии</option>
        ${options}
      </select>
    </div>
    <div class="mt-4 space-y-3" id="history-list"></div>
  `;

  const list = document.getElementById("history-list");
  const filter = document.getElementById("filter");
  const searchInput = document.getElementById("search");

  const renderList = (items) => {
    list.innerHTML = items
      .map(
        (item) => `
      <button class="w-full bg-card rounded-xl p-3 text-left" data-open="${item.id}">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted">${item.date}</p>
            <p class="font-medium">${SCENARIOS[item.scenario_type]?.label || "День"}</p>
          </div>
          <span class="text-xs text-muted">${summarizeBlocks(item)}</span>
        </div>
      </button>`
      )
      .join("");

    list.querySelectorAll("button[data-open]").forEach((btn) => {
      btn.onclick = () => openWorkout(Number(btn.dataset.open));
    });
  };

  renderList(state.workouts);

  filter.onchange = () => {
    const value = filter.value;
    const items = value ? state.workouts.filter((item) => item.scenario_type === value) : state.workouts;
    renderList(items);
  };

  searchInput.oninput = async () => {
    const query = searchInput.value.trim();
    if (!query) {
      renderList(state.workouts);
      return;
    }
    const results = await api(`/api/search?query=${encodeURIComponent(query)}`);
    renderList(results);
  };
}

function renderAnalytics() {
  const stats = state.analytics;
  app.innerHTML = `
    <header class="pt-6 pb-4">
      <h2 class="text-2xl font-semibold">Аналитика</h2>
      <p class="text-muted mt-1">Никакого шума — только ключевые ориентиры.</p>
    </header>
    <section class="grid grid-cols-2 gap-3">
      <div class="bg-card rounded-2xl p-4">
        <p class="text-sm text-muted">Тренировок за ${stats?.days || 14} дней</p>
        <p class="text-2xl font-semibold mt-2">${stats?.training_days ?? "—"}</p>
      </div>
      <div class="bg-card rounded-2xl p-4">
        <p class="text-sm text-muted">Средние шаги</p>
        <p class="text-2xl font-semibold mt-2">${stats?.avg_steps ?? "—"}</p>
      </div>
    </section>
    <section class="mt-4 bg-card rounded-2xl p-4">
      <h3 class="font-semibold">Последние рабочие веса</h3>
      <div class="mt-3 space-y-2">
        ${stats
          ? Object.entries(stats.last_working_weights)
              .map(
                ([name, value]) => `
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">${name}</span>
              <span class="font-medium">${value ? `${value} кг` : "—"}</span>
            </div>`
              )
              .join("")
          : ""}
      </div>
    </section>
  `;
}

function setView(view) {
  state.view = view;
  render();
}

async function loadTemplates() {
  state.templates = await api("/api/templates");
}

async function loadInitial() {
  state.workouts = await api("/api/workout-days?limit=30");
  state.analytics = await api("/api/analytics?days=14");
}

async function boot() {
  try {
    await loadInitial();
    await loadTemplates();
  } catch (error) {
    console.error(error);
  }
  render();
}

navButtons.forEach((btn) => {
  btn.onclick = () => {
    hapticImpact();
    setView(btn.dataset.view);
  };
});

boot();
