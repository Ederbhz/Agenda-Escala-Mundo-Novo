const STORAGE_KEY = "mn-schedule-v1";
const CONFIG_KEY = "mn-config-v1";

const app = document.querySelector("#app");
const moneyFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

let schedule = await loadSchedule();
await hydrateFromConfiguredBackend();

window.addEventListener("hashchange", render);
render();

async function loadSchedule() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) return JSON.parse(local);

  const response = await fetch("./data/seed.json");
  return response.json();
}

function render() {
  const route = window.location.hash || "#/public";
  if (route.startsWith("#/admin")) {
    renderAdmin();
    return;
  }
  renderPublic();
}

function renderPublic() {
  app.replaceChildren(document.querySelector("#public-template").content.cloneNode(true));

  const sortedEvents = [...schedule.events].sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = sortedEvents.find((event) => new Date(`${event.date}T23:59:00`) >= new Date()) ?? sortedEvents[0];

  app.querySelector('[data-field="title"]').textContent = schedule.title;
  app.querySelector('[data-field="notice"]').textContent = schedule.notice;
  app.querySelector('[data-field="next-date"]').textContent = formatDate(nextEvent?.date);
  app.querySelector('[data-field="next-name"]').textContent = nextEvent?.name ?? "Sem eventos";

  const eventFilter = app.querySelector("#event-filter");
  eventFilter.innerHTML = [
    '<option value="all">Todos os eventos</option>',
    ...sortedEvents.map((event) => `<option value="${event.id}">${event.name} - ${formatDate(event.date)}</option>`),
  ].join("");

  app.querySelector("#musician-filter").addEventListener("input", renderEventCards);
  eventFilter.addEventListener("change", renderEventCards);

  renderEventCards();
  renderMembers();
}

async function hydrateFromConfiguredBackend() {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) return;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) return;
    schedule = await response.json();
    saveLocal();
  } catch {
    // Falls back to local/seed data when the backend is unavailable.
  }
}

function renderEventCards() {
  const filter = app.querySelector("#musician-filter")?.value.trim().toLowerCase() ?? "";
  const eventFilter = app.querySelector("#event-filter")?.value ?? "all";
  const target = app.querySelector("#public-events");

  const cards = [...schedule.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((event) => eventFilter === "all" || event.id === eventFilter)
    .filter((event) => {
      if (!filter) return true;
      return Object.values(event.assignments).some((name) => name.toLowerCase().includes(filter));
    })
    .map(eventCard)
    .join("");

  target.innerHTML = cards || `<p class="empty">Nenhuma escala encontrada para este filtro.</p>`;
}

function eventCard(event) {
  const assignments = schedule.instruments
    .map((instrument) => {
      const musician = event.assignments[instrument] || "A definir";
      const emptyClass = musician === "A definir" ? " empty" : "";
      return `
        <div class="assignment">
          <span class="instrument">${instrument}</span>
          <span class="${emptyClass.trim()}">${musician}</span>
        </div>
      `;
    })
    .join("");

  return `
    <article class="event-card">
      <header class="event-head">
        <h2>${event.name}</h2>
        <time datetime="${event.date}">${formatDate(event.date)}</time>
      </header>
      <div class="assignments">${assignments}</div>
    </article>
  `;
}

function renderMembers() {
  const groups = Object.entries(schedule.members)
    .map(([instrument, names]) => `
      <div class="member-group">
        <strong>${instrument}</strong>
        <span>${names.join(", ")}</span>
      </div>
    `)
    .join("");

  app.querySelector("#public-members").innerHTML = `
    <h2>Integrantes do Ministério de Música</h2>
    <div class="member-groups">${groups}</div>
    ${schedule.notes ? `<p><strong>Observações:</strong><br>${schedule.notes.replace(/\n/g, "<br>")}</p>` : ""}
  `;
}

function renderAdmin() {
  app.replaceChildren(document.querySelector("#admin-template").content.cloneNode(true));

  const config = loadConfig();
  app.querySelector("#schedule-title").value = schedule.title;
  app.querySelector("#schedule-notice").value = schedule.notice;
  app.querySelector("#schedule-notes").value = schedule.notes ?? "";
  app.querySelector("#api-url").value = config.apiUrl ?? "";
  app.querySelector("#admin-key").value = config.adminKey ?? "";

  app.querySelector("#schedule-title").addEventListener("input", (event) => {
    schedule.title = event.target.value;
  });
  app.querySelector("#schedule-notice").addEventListener("input", (event) => {
    schedule.notice = event.target.value;
  });
  app.querySelector("#schedule-notes").addEventListener("input", (event) => {
    schedule.notes = event.target.value;
  });
  app.querySelector("#api-url").addEventListener("input", persistConfigFromForm);
  app.querySelector("#admin-key").addEventListener("input", persistConfigFromForm);

  app.querySelector("#save-local").addEventListener("click", () => {
    saveLocal();
    setStatus("Escala salva neste navegador.");
  });
  app.querySelector("#export-json").addEventListener("click", exportJson);
  app.querySelector("#load-backend").addEventListener("click", loadFromBackend);
  app.querySelector("#save-backend").addEventListener("click", saveToBackend);
  app.querySelector("#add-event").addEventListener("click", addEvent);

  renderAdminEvents();
  renderAdminMembers();
  setStatus("Pronto para editar.");
}

function renderAdminEvents() {
  const target = app.querySelector("#admin-events");
  target.innerHTML = schedule.events
    .map((event, index) => `
      <article class="admin-event" data-index="${index}">
        <div class="admin-event-header">
          <label>
            <span>Nome</span>
            <input data-field="name" type="text" value="${escapeAttr(event.name)}" />
          </label>
          <label>
            <span>Data</span>
            <input data-field="date" type="date" value="${event.date}" />
          </label>
          <button data-action="remove-event" type="button">Remover</button>
        </div>
        ${schedule.instruments
          .map((instrument) => `
            <label class="admin-assignment">
              <span>${instrument}</span>
              <input data-instrument="${instrument}" type="text" value="${escapeAttr(event.assignments[instrument] ?? "")}" />
            </label>
          `)
          .join("")}
      </article>
    `)
    .join("");

  target.querySelectorAll(".admin-event").forEach((card) => {
    const index = Number(card.dataset.index);
    card.querySelector('[data-field="name"]').addEventListener("input", (event) => {
      schedule.events[index].name = event.target.value;
    });
    card.querySelector('[data-field="date"]').addEventListener("input", (event) => {
      schedule.events[index].date = event.target.value;
      schedule.events[index].id = slugify(`${schedule.events[index].name}-${event.target.value}`);
    });
    card.querySelectorAll("[data-instrument]").forEach((input) => {
      input.addEventListener("input", (event) => {
        schedule.events[index].assignments[event.target.dataset.instrument] = event.target.value;
      });
    });
    card.querySelector('[data-action="remove-event"]').addEventListener("click", () => {
      schedule.events.splice(index, 1);
      renderAdminEvents();
    });
  });
}

function renderAdminMembers() {
  const target = app.querySelector("#admin-members");
  target.innerHTML = schedule.instruments
    .map((instrument) => `
      <label class="member-editor">
        <span>${instrument}</span>
        <input data-members="${instrument}" type="text" value="${escapeAttr((schedule.members[instrument] ?? []).join(", "))}" />
      </label>
    `)
    .join("");

  target.querySelectorAll("[data-members]").forEach((input) => {
    input.addEventListener("input", (event) => {
      schedule.members[event.target.dataset.members] = event.target.value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    });
  });
}

function addEvent() {
  const date = new Date().toISOString().slice(0, 10);
  const assignments = Object.fromEntries(schedule.instruments.map((instrument) => [instrument, ""]));
  schedule.events.push({
    id: slugify(`novo-evento-${date}-${schedule.events.length + 1}`),
    name: "Novo evento",
    date,
    assignments,
  });
  renderAdminEvents();
}

async function loadFromBackend() {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    setStatus("Informe a URL do backend antes de carregar.");
    return;
  }

  setStatus("Carregando do backend...");
  const response = await fetch(apiUrl);
  if (!response.ok) {
    setStatus("Não foi possível carregar do backend.");
    return;
  }
  schedule = await response.json();
  saveLocal();
  renderAdmin();
}

async function saveToBackend() {
  const config = loadConfig();
  const apiUrl = getConfiguredApiUrl();
  const adminKey = config.adminKey;
  if (!apiUrl || !adminKey) {
    setStatus("Informe URL do backend e chave admin.");
    return;
  }

  setStatus("Publicando escala...");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ key: adminKey, schedule }),
  });

  setStatus(response.ok ? "Escala publicada com sucesso." : "Falha ao publicar a escala.");
}

function exportJson() {
  const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "escala-mundo-novo.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function persistConfigFromForm() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    apiUrl: app.querySelector("#api-url").value.trim(),
    adminKey: app.querySelector("#admin-key").value.trim(),
  }));
}

function loadConfig() {
  return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
}

function getConfiguredApiUrl() {
  const query = new URLSearchParams(window.location.search);
  const queryApi = query.get("api");
  const configApi = loadConfig().apiUrl;

  if (queryApi && queryApi !== configApi) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...loadConfig(), apiUrl: queryApi }));
  }

  return queryApi || configApi || "";
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

function setStatus(message) {
  const status = app.querySelector("#sync-status");
  if (status) status.textContent = message;
}

function formatDate(date) {
  if (!date) return "--";
  return moneyFormatter.format(new Date(`${date}T12:00:00`));
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
