import { APP_CONFIG } from "./config.js";
import {
  ACTIVE_STATUS,
  AVAILABILITY,
  CONFIRMATION_STATUS,
  FUNCTION_TYPES,
  MONTHS,
  addHistory,
  asArray,
  defaultMonthYear,
  ensureFixedMonthEvents,
  escapeHtml,
  formatDateBR,
  formatDateTimeBR,
  formatDateWithWeekday,
  formatMonthYear,
  getActiveCoordinators,
  getActiveFunctions,
  getActiveMusicians,
  getAdminKey,
  getApiUrl,
  getAssignment,
  getAvailabilityFor,
  getMonthEvents,
  getMusicianOptions,
  getPendingAssignments,
  hasLocalPendingChanges,
  loadClientConfig,
  loadDatabase,
  makeId,
  normalizeDatabase,
  parseISODate,
  remanejarAssignment,
  remanejarLocalAssignment,
  saveClientConfig,
  saveLocalDatabase,
  saveRemoteDatabase,
  statusClass,
  todayISO,
  toISODate,
  tryLoadRemoteDatabase,
  upsertAssignment,
  weekdayName,
} from "./app.js";

let database = null;
let activeTab = "escala";
const initialDate = defaultMonthYear();
let selectedMonth = initialDate.month;
let selectedYear = initialDate.year;
let selectedWeekKey = "";
const COORDINATOR_STORAGE_KEY = "mn-selected-coordinator-id";

const $ = (id) => document.getElementById(id);

init();

async function init() {
  database = normalizeDatabase(await loadDatabase());
  setupStaticOptions();
  setupConfigFields();
  setupAuth();
  bindEvents();
  renderAll();
  setStatus(initialStatusMessage());
}

function setupAuth() {
  const expected = APP_CONFIG.DEFAULT_ADMIN_PASSWORD;
  const hasSession = sessionStorage.getItem(APP_CONFIG.ADMIN_SESSION_KEY) === "ok";
  if (!expected || hasSession) {
    showCoordinatorApp();
    return;
  }

  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const password = $("adminPassword").value.trim();
    if (password === expected || (getAdminKey() && password === getAdminKey())) {
      sessionStorage.setItem(APP_CONFIG.ADMIN_SESSION_KEY, "ok");
      showCoordinatorApp();
      return;
    }
    $("loginMessage").textContent = "Senha inválida.";
  });
}

function showCoordinatorApp() {
  $("loginPanel").classList.add("is-hidden");
  $("coordinatorApp").classList.remove("is-hidden");
}

function setupStaticOptions() {
  $("monthSelect").innerHTML = MONTHS.map((month, index) => (
    `<option value="${index + 1}">${month}</option>`
  )).join("");
  $("monthSelect").value = String(selectedMonth);
  $("yearInput").value = String(selectedYear);

  $("functionType").innerHTML = FUNCTION_TYPES.map((type) => `<option>${type}</option>`).join("");
  $("functionStatus").innerHTML = ACTIVE_STATUS.map((status) => `<option>${status}</option>`).join("");
  $("musicianStatus").innerHTML = ACTIVE_STATUS.map((status) => `<option>${status}</option>`).join("");
  $("coordinatorStatus").innerHTML = ACTIVE_STATUS.map((status) => `<option>${status}</option>`).join("");
  $("availabilityStatus").innerHTML = AVAILABILITY.map((status) => `<option>${status}</option>`).join("");
}

function setupConfigFields() {
  const config = loadClientConfig();
  $("apiUrlInput").value = config.apiUrl;
  $("adminKeyInput").value = config.adminKey;
}

function bindEvents() {
  $("monthSelect").addEventListener("change", () => {
    selectedMonth = Number($("monthSelect").value);
    selectedWeekKey = "";
    renderAll();
  });

  $("yearInput").addEventListener("change", () => {
    selectedYear = Number($("yearInput").value);
    selectedWeekKey = "";
    renderAll();
  });

  $("coordinatorSelect").addEventListener("change", () => {
    localStorage.setItem(COORDINATOR_STORAGE_KEY, $("coordinatorSelect").value);
  });

  $("generateMonthButton").addEventListener("click", () => {
    const created = ensureFixedMonthEvents(database, selectedMonth, selectedYear);
    created.forEach((evento) => {
      addHistory(database, {
        tipo_alteracao: "Criação de evento",
        evento,
        funcao: {},
        musico_anterior: "",
        musico_novo: "",
        usuario_responsavel: coordinatorName(),
        observacao: "Gerado automaticamente para o mês",
      });
    });
    persistLocal(created.length ? `${created.length} evento(s) fixo(s) criado(s).` : "Eventos fixos do mês já estavam criados.");
    renderAll();
  });

  $("saveButton").addEventListener("click", saveEverything);
  $("saveConfigButton").addEventListener("click", saveConfig);
  $("reloadRemoteButton").addEventListener("click", reloadRemote);
  $("exportButton").addEventListener("click", exportJson);
  $("printButton").addEventListener("click", () => window.print());

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      renderTabs();
    });
  });

  $("scheduleGrid").addEventListener("change", handleScheduleChange);
  $("mobileSchedule").addEventListener("change", handleScheduleChange);
  $("weekTabs").addEventListener("click", handleWeekClick);
  $("pendingRows").addEventListener("click", handlePendingClick);
  $("coordinatorRows").addEventListener("click", handleCoordinatorAction);
  $("musicianRows").addEventListener("click", handleMusicianAction);
  $("functionRows").addEventListener("click", handleFunctionAction);
  $("eventRows").addEventListener("click", handleEventAction);
  $("availabilityRows").addEventListener("click", handleAvailabilityAction);

  $("coordinatorForm").addEventListener("submit", saveCoordinator);
  $("musicianForm").addEventListener("submit", saveMusician);
  $("functionForm").addEventListener("submit", saveFunction);
  $("eventForm").addEventListener("submit", saveEvent);
  $("availabilityForm").addEventListener("submit", saveAvailability);

  $("clearCoordinatorForm").addEventListener("click", clearCoordinatorForm);
  $("clearMusicianForm").addEventListener("click", clearMusicianForm);
  $("clearFunctionForm").addEventListener("click", clearFunctionForm);
  $("clearEventForm").addEventListener("click", clearEventForm);
  $("clearAvailabilityForm").addEventListener("click", clearAvailabilityForm);

  $("remanejamentoForm").addEventListener("submit", submitRemanejamento);
  $("closeRemanejamento").addEventListener("click", () => $("remanejamentoDialog").close());
}

function renderAll() {
  database = normalizeDatabase(database);
  $("monthSelect").value = String(selectedMonth);
  $("yearInput").value = String(selectedYear);
  $("scheduleTitle").textContent = `${database.meta.titlePrefix} - ${formatMonthYear(selectedMonth, selectedYear)}`;
  $("gridTitle").textContent = `${database.meta.titlePrefix} - ${formatMonthYear(selectedMonth, selectedYear)}`;

  renderCoordinatorSelect();
  renderTabs();
  renderSchedule();
  renderPending();
  renderCoordinators();
  renderMusicians();
  renderFunctions();
  renderEvents();
  renderAvailability();
  renderHistory();
  renderAvailabilityMusicianSelect();
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === activeTab);
  });
}

function renderCoordinatorSelect() {
  const coordinators = getActiveCoordinators(database);
  const fallback = coordinators[0] || database.coordenadores[0];
  const savedId = localStorage.getItem(COORDINATOR_STORAGE_KEY);
  const selected = coordinators.some((item) => item.id_coordenador === savedId)
    ? savedId
    : fallback?.id_coordenador || "";

  $("coordinatorSelect").innerHTML = coordinators.length
    ? coordinators.map((coordenador) => (
      `<option value="${escapeHtml(coordenador.id_coordenador)}">${escapeHtml(coordenador.nome)}</option>`
    )).join("")
    : `<option value="">${escapeHtml(APP_CONFIG.DEFAULT_COORDINATOR_NAME)}</option>`;

  $("coordinatorSelect").value = selected;
  if (selected) localStorage.setItem(COORDINATOR_STORAGE_KEY, selected);
}

function getWeekGroups(events) {
  const groups = new Map();

  events.forEach((evento) => {
    const start = startOfWeek(parseISODate(evento.data_evento));
    const key = toISODate(start);
    if (!groups.has(key)) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      groups.set(key, {
        key,
        start,
        end,
        events: [],
      });
    }
    groups.get(key).events.push(evento);
  });

  return [...groups.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((group, index) => ({
      ...group,
      label: `Semana ${index + 1} - ${formatShortDate(group.start)} a ${formatShortDate(group.end)}`,
      events: group.events.sort((a, b) => (
        a.data_evento.localeCompare(b.data_evento)
        || String(a.horario || "").localeCompare(String(b.horario || ""))
        || String(a.nome_evento || "").localeCompare(String(b.nome_evento || ""), "pt-BR")
      )),
    }));
}

function resolveSelectedWeek(weekGroups) {
  if (!weekGroups.length) {
    selectedWeekKey = "";
    return null;
  }

  const saved = weekGroups.find((week) => week.key === selectedWeekKey);
  if (saved) return saved;

  const today = todayISO();
  const current = weekGroups.find((week) => (
    today >= week.key && today <= toISODate(week.end)
  ));
  const next = current || weekGroups[0];
  selectedWeekKey = next.key;
  return next;
}

function renderWeekTabs(weekGroups, activeKey) {
  $("weekTabs").innerHTML = weekGroups.map((week) => `
    <button class="week-tab ${week.key === activeKey ? "is-active" : ""}" type="button" data-week="${escapeHtml(week.key)}">
      <span>${escapeHtml(week.label)}</span>
      <small>${escapeHtml(String(week.events.length))} evento(s)</small>
    </button>
  `).join("");
}

function handleWeekClick(event) {
  const button = event.target.closest("button[data-week]");
  if (!button) return;
  selectedWeekKey = button.dataset.week;
  renderSchedule();
}

function startOfWeek(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function renderSchedule() {
  const events = getMonthEvents(database, selectedMonth, selectedYear)
    .filter((evento) => evento.status !== "Cancelado");
  const functions = getActiveFunctions(database);
  const weekGroups = getWeekGroups(events);
  const activeWeek = resolveSelectedWeek(weekGroups);
  const weekEvents = activeWeek?.events || [];

  renderWeekTabs(weekGroups, activeWeek?.key || "");
  $("gridSubtitle").textContent = activeWeek
    ? `${activeWeek.label} | ${weekEvents.length} evento(s)`
    : "Nenhum evento cadastrado para este mês.";

  if (!weekEvents.length || !functions.length) {
    $("scheduleGrid").innerHTML = `<p class="empty-state">Gere os eventos do mês e mantenha funções ativas para montar a grade.</p>`;
    $("mobileSchedule").innerHTML = "";
    return;
  }

  const header = weekEvents.map((evento) => `
    <th>
      <strong>${escapeHtml(String(new Date(`${evento.data_evento}T12:00:00`).getDate()).padStart(2, "0"))} ${escapeHtml(evento.dia_semana)}</strong>
      <small>${escapeHtml(evento.nome_evento)} - ${escapeHtml(evento.horario || "")}</small>
    </th>
  `).join("");

  const rows = functions.map((funcao) => `
    <tr>
      <td class="function-label">
        <strong>${escapeHtml(funcao.nome_funcao)}</strong>
        <small>${escapeHtml(funcao.tipo_funcao)}</small>
      </td>
      ${weekEvents.map((evento) => renderScheduleCell(evento, funcao)).join("")}
    </tr>
  `).join("");

  $("scheduleGrid").innerHTML = `
    <table class="schedule-table" aria-label="Grade mensal da escala">
      <thead>
        <tr>
          <th>Função / Serviço</th>
          ${header}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  $("mobileSchedule").innerHTML = weekEvents.map((evento) => `
    <article class="day-card">
      <header>
        <h3>${escapeHtml(evento.dia_semana)} - ${escapeHtml(formatDateBR(evento.data_evento))}</h3>
        <p class="muted">${escapeHtml(evento.nome_evento)} às ${escapeHtml(evento.horario || "")}</p>
      </header>
      <div class="day-list">
        ${functions.map((funcao) => `
          <div class="day-item day-item-editable">
            <div>
              <strong>${escapeHtml(funcao.nome_funcao)}</strong>
              <small>${escapeHtml(funcao.tipo_funcao)}</small>
            </div>
            ${renderAssignmentControl(evento, funcao)}
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderScheduleCell(evento, funcao) {
  return `<td>${renderAssignmentControl(evento, funcao)}</td>`;
}

function renderAssignmentControl(evento, funcao) {
  const assignment = getAssignment(database, evento.id_evento, funcao.id_funcao);
  const options = getMusicianOptions(database, funcao, evento.data_evento);
  const selected = assignment?.id_musico || "";

  return `
    <div class="assignment-cell">
      <select data-event-id="${escapeHtml(evento.id_evento)}" data-function-id="${escapeHtml(funcao.id_funcao)}" aria-label="${escapeHtml(funcao.nome_funcao)} em ${escapeHtml(formatDateBR(evento.data_evento))}">
        <option value="">Selecionar músico</option>
        ${renderMusicianOptionGroup("Indicados", options.preferred, selected)}
        ${renderMusicianOptionGroup("Outros ativos", options.others, selected)}
      </select>
      <div class="assignment-meta">
        ${assignment ? `<span class="badge ${statusClass(assignment.status_confirmacao)}">${escapeHtml(assignment.status_confirmacao)}</span>` : ""}
        ${assignment?.status_pendencia ? `<span class="badge ${statusClass(assignment.status_pendencia)}">${escapeHtml(assignment.status_pendencia)}</span>` : ""}
      </div>
      ${assignment?.observacao_musico ? `<small class="availability-note">${escapeHtml(assignment.observacao_musico)}</small>` : ""}
    </div>
  `;
}

function renderMusicianOptionGroup(label, musicians, selected) {
  if (!musicians.length) return "";
  const options = musicians.map((musico) => {
    const availability = musico.disponibilidade && musico.disponibilidade !== "Disponível"
      ? ` (${musico.disponibilidade})`
      : "";
    return `<option value="${escapeHtml(musico.id_musico)}" ${musico.id_musico === selected ? "selected" : ""}>${escapeHtml(musico.nome + availability)}</option>`;
  }).join("");
  return `<optgroup label="${escapeHtml(label)}">${options}</optgroup>`;
}

function renderPending() {
  const pending = getPendingAssignments(database, selectedMonth, selectedYear);
  $("pendingRows").innerHTML = pending.length ? pending.map((item) => `
    <tr>
      <td>${escapeHtml(formatDateBR(item.data_evento))}</td>
      <td>${escapeHtml(item.funcao)}</td>
      <td>${escapeHtml(item.nome_musico)}</td>
      <td>${escapeHtml(item.observacao_musico || "")}</td>
      <td>
        <button class="primary" type="button" data-action="remanejar" data-id="${escapeHtml(item.id_escala)}">Remanejar</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5">Nenhuma pendência para o mês selecionado.</td></tr>`;
}

function renderCoordinators() {
  $("coordinatorRows").innerHTML = database.coordenadores
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((coordenador) => `
      <tr>
        <td>${escapeHtml(coordenador.nome)}</td>
        <td>${escapeHtml([coordenador.telefone, coordenador.email].filter(Boolean).join(" | "))}</td>
        <td><span class="badge ${coordenador.status === "Ativo" ? "status-confirmed" : "status-muted"}">${escapeHtml(coordenador.status)}</span></td>
        <td>${escapeHtml(coordenador.observacoes || "")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(coordenador.id_coordenador)}">Editar</button>
            <button type="button" data-action="toggle" data-id="${escapeHtml(coordenador.id_coordenador)}">${coordenador.status === "Ativo" ? "Inativar" : "Ativar"}</button>
          </div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5">Nenhum coordenador cadastrado.</td></tr>`;
}

function renderMusicians() {
  $("musicianRows").innerHTML = database.musicos
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((musico) => `
      <tr>
        <td>${escapeHtml(musico.nome)}</td>
        <td>${escapeHtml(asArray(musico.instrumentos).join(", "))}</td>
        <td>${escapeHtml([musico.telefone, musico.email].filter(Boolean).join(" | "))}</td>
        <td><span class="badge ${musico.status === "Ativo" ? "status-confirmed" : "status-muted"}">${escapeHtml(musico.status)}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(musico.id_musico)}">Editar</button>
            <button type="button" data-action="toggle" data-id="${escapeHtml(musico.id_musico)}">${musico.status === "Ativo" ? "Inativar" : "Ativar"}</button>
          </div>
        </td>
      </tr>
    `).join("");
}

function renderFunctions() {
  $("functionRows").innerHTML = database.funcoes
    .slice()
    .sort((a, b) => a.ordem_exibicao - b.ordem_exibicao)
    .map((funcao) => `
      <tr>
        <td>${escapeHtml(funcao.ordem_exibicao)}</td>
        <td>${escapeHtml(funcao.nome_funcao)}</td>
        <td>${escapeHtml(funcao.tipo_funcao)}</td>
        <td><span class="badge ${funcao.status === "Ativo" ? "status-confirmed" : "status-muted"}">${escapeHtml(funcao.status)}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(funcao.id_funcao)}">Editar</button>
            <button type="button" data-action="toggle" data-id="${escapeHtml(funcao.id_funcao)}">${funcao.status === "Ativo" ? "Inativar" : "Ativar"}</button>
          </div>
        </td>
      </tr>
    `).join("");
}

function renderEvents() {
  const events = getMonthEvents(database, selectedMonth, selectedYear);
  $("eventRows").innerHTML = events.length ? events.map((evento) => `
    <tr>
      <td>${escapeHtml(formatDateWithWeekday(evento.data_evento))}</td>
      <td>${escapeHtml(evento.nome_evento)}</td>
      <td>${escapeHtml(evento.horario || "")}</td>
      <td>${escapeHtml(evento.local || "")}</td>
      <td><span class="badge ${evento.status === "Ativo" ? "status-confirmed" : "status-muted"}">${escapeHtml(evento.status)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(evento.id_evento)}">Editar</button>
          <button type="button" data-action="cancel" data-id="${escapeHtml(evento.id_evento)}">${evento.status === "Cancelado" ? "Reativar" : "Cancelar"}</button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="6">Nenhum evento neste mês.</td></tr>`;
}

function renderAvailability() {
  const rows = database.disponibilidade
    .filter((item) => {
      const date = new Date(`${item.data}T12:00:00`);
      return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.nome_musico.localeCompare(b.nome_musico, "pt-BR"));

  $("availabilityRows").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.nome_musico)}</td>
      <td>${escapeHtml(formatDateBR(item.data))}</td>
      <td><span class="badge ${availabilityClass(item.disponibilidade)}">${escapeHtml(item.disponibilidade)}</span></td>
      <td>${escapeHtml(item.observacoes || "")}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(item.id_disponibilidade)}">Editar</button>
          <button type="button" data-action="remove" data-id="${escapeHtml(item.id_disponibilidade)}">Remover</button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5">Nenhuma disponibilidade cadastrada para o mês.</td></tr>`;
}

function renderHistory() {
  $("historyRows").innerHTML = database.historico.slice(0, 200).map((item) => `
    <tr>
      <td>${escapeHtml(formatDateTimeBR(item.data_hora))}</td>
      <td>${escapeHtml(item.tipo_alteracao)}</td>
      <td>${escapeHtml(item.nome_evento)} ${item.data_evento ? `(${escapeHtml(formatDateBR(item.data_evento))})` : ""}</td>
      <td>${escapeHtml(item.funcao)}</td>
      <td>${escapeHtml(item.musico_anterior)}</td>
      <td>${escapeHtml(item.musico_novo)}</td>
      <td>${escapeHtml(item.usuario_responsavel)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Nenhum histórico registrado.</td></tr>`;
}

function renderAvailabilityMusicianSelect() {
  $("availabilityMusician").innerHTML = getActiveMusicians(database)
    .map((musico) => `<option value="${escapeHtml(musico.id_musico)}">${escapeHtml(musico.nome)}</option>`)
    .join("");
}

function handleScheduleChange(event) {
  const select = event.target.closest("select[data-event-id]");
  if (!select) return;
  upsertAssignment(
    database,
    select.dataset.eventId,
    select.dataset.functionId,
    select.value,
    coordinatorName(),
  );
  persistLocal("Alteração aplicada na grade.");
  renderSchedule();
  renderPending();
  renderHistory();
}

function handlePendingClick(event) {
  const button = event.target.closest("button[data-action='remanejar']");
  if (!button) return;
  openRemanejamento(button.dataset.id);
}

function openRemanejamento(idEscala) {
  const assignment = database.escala.find((item) => item.id_escala === idEscala);
  if (!assignment) return;
  const funcao = database.funcoes.find((item) => item.id_funcao === assignment.id_funcao);
  const options = getMusicianOptions(database, funcao, assignment.data_evento, assignment.id_evento);
  const candidates = [...options.preferred, ...options.others]
    .filter((musico) => musico.id_musico !== assignment.id_musico);

  $("remanejamentoEscalaId").value = idEscala;
  $("remanejamentoInfo").textContent = `${assignment.funcao} em ${formatDateBR(assignment.data_evento)}: ${assignment.nome_musico} recusou.`;
  $("remanejamentoMusician").innerHTML = candidates.map((musico) => {
    const suffix = musico.disponibilidade !== "Disponível" ? ` (${musico.disponibilidade})` : "";
    return `<option value="${escapeHtml(musico.id_musico)}">${escapeHtml(musico.nome + suffix)}</option>`;
  }).join("");
  $("remanejamentoNotes").value = "";

  if (!candidates.length) {
    $("remanejamentoMusician").innerHTML = `<option value="">Nenhum músico disponível</option>`;
  }
  $("remanejamentoDialog").showModal();
}

async function submitRemanejamento(event) {
  event.preventDefault();
  const idEscala = $("remanejamentoEscalaId").value;
  const musicianId = $("remanejamentoMusician").value;
  const musician = database.musicos.find((item) => item.id_musico === musicianId);
  if (!musician) return;

  remanejarLocalAssignment(database, idEscala, musicianId, coordinatorName(), $("remanejamentoNotes").value.trim());
  persistLocal("Remanejamento registrado.");

  if (getApiUrl() && getAdminKey()) {
    try {
      await remanejarAssignment(idEscala, musician, coordinatorName(), $("remanejamentoNotes").value.trim());
      await reloadRemote(false);
      setStatus("Remanejamento salvo na planilha.");
    } catch {
      setStatus("Remanejamento salvo localmente. Não foi possível enviar para a planilha.");
    }
  }

  $("remanejamentoDialog").close();
  renderAll();
}

function saveCoordinator(event) {
  event.preventDefault();
  const id = $("coordinatorId").value || makeId("coord");
  const existing = database.coordenadores.find((item) => item.id_coordenador === id);
  const next = {
    id_coordenador: id,
    nome: $("coordinatorFullName").value.trim(),
    telefone: $("coordinatorPhone").value.trim(),
    email: $("coordinatorEmail").value.trim(),
    status: $("coordinatorStatus").value,
    observacoes: $("coordinatorNotes").value.trim(),
  };

  if (existing) Object.assign(existing, next);
  else database.coordenadores.push(next);

  localStorage.setItem(COORDINATOR_STORAGE_KEY, id);
  clearCoordinatorForm();
  persistLocal("Coordenador salvo.");
  renderAll();
}

function saveMusician(event) {
  event.preventDefault();
  const id = $("musicianId").value || makeId("musico");
  const existing = database.musicos.find((item) => item.id_musico === id);
  const next = {
    id_musico: id,
    nome: $("musicianName").value.trim(),
    telefone: $("musicianPhone").value.trim(),
    email: $("musicianEmail").value.trim(),
    instrumentos: asArray($("musicianSkills").value),
    status: $("musicianStatus").value,
    observacoes: $("musicianNotes").value.trim(),
  };

  if (existing) Object.assign(existing, next);
  else database.musicos.push(next);

  database.escala.forEach((assignment) => {
    if (assignment.id_musico === id) assignment.nome_musico = next.nome;
  });
  database.disponibilidade.forEach((entry) => {
    if (entry.id_musico === id) entry.nome_musico = next.nome;
  });

  clearMusicianForm();
  persistLocal("Músico salvo.");
  renderAll();
}

function saveFunction(event) {
  event.preventDefault();
  const id = $("functionId").value || makeId("funcao");
  const existing = database.funcoes.find((item) => item.id_funcao === id);
  const next = {
    id_funcao: id,
    nome_funcao: $("functionName").value.trim(),
    tipo_funcao: $("functionType").value,
    ordem_exibicao: Number($("functionOrder").value || database.funcoes.length + 1),
    status: $("functionStatus").value,
  };

  if (existing) Object.assign(existing, next);
  else database.funcoes.push(next);

  database.escala.forEach((assignment) => {
    if (assignment.id_funcao === id) {
      assignment.funcao = next.nome_funcao;
      assignment.tipo_funcao = next.tipo_funcao;
    }
  });

  clearFunctionForm();
  persistLocal("Função salva.");
  renderAll();
}

function saveEvent(event) {
  event.preventDefault();
  const id = $("eventId").value || makeId("evento");
  const existing = database.eventos.find((item) => item.id_evento === id);
  const next = {
    id_evento: id,
    nome_evento: $("eventName").value.trim(),
    data_evento: $("eventDate").value,
    dia_semana: weekdayName($("eventDate").value),
    horario: $("eventTime").value,
    local: $("eventLocation").value.trim(),
    status: $("eventStatus").value,
    observacoes: $("eventNotes").value.trim(),
  };

  if (existing) Object.assign(existing, next);
  else database.eventos.push(next);

  syncAssignmentsForEvent(next);
  clearEventForm();
  persistLocal("Evento salvo.");
  renderAll();
}

function saveAvailability(event) {
  event.preventDefault();
  const musician = database.musicos.find((item) => item.id_musico === $("availabilityMusician").value);
  if (!musician) return;

  const id = $("availabilityId").value || makeId("disp");
  const existing = database.disponibilidade.find((item) => item.id_disponibilidade === id);
  const next = {
    id_disponibilidade: id,
    id_musico: musician.id_musico,
    nome_musico: musician.nome,
    data: $("availabilityDate").value,
    disponibilidade: $("availabilityStatus").value,
    observacoes: $("availabilityNotes").value.trim(),
  };

  if (existing) Object.assign(existing, next);
  else database.disponibilidade.push(next);

  clearAvailabilityForm();
  persistLocal("Disponibilidade salva.");
  renderAll();
}

function handleCoordinatorAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const coordenador = database.coordenadores.find((item) => item.id_coordenador === button.dataset.id);
  if (!coordenador) return;

  if (button.dataset.action === "edit") {
    $("coordinatorId").value = coordenador.id_coordenador;
    $("coordinatorFullName").value = coordenador.nome;
    $("coordinatorPhone").value = coordenador.telefone;
    $("coordinatorEmail").value = coordenador.email;
    $("coordinatorStatus").value = coordenador.status;
    $("coordinatorNotes").value = coordenador.observacoes;
  }

  if (button.dataset.action === "toggle") {
    coordenador.status = coordenador.status === "Ativo" ? "Inativo" : "Ativo";
    persistLocal("Status do coordenador atualizado.");
    renderAll();
  }
}

function handleMusicianAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const musico = database.musicos.find((item) => item.id_musico === button.dataset.id);
  if (!musico) return;

  if (button.dataset.action === "edit") {
    $("musicianId").value = musico.id_musico;
    $("musicianName").value = musico.nome;
    $("musicianPhone").value = musico.telefone;
    $("musicianEmail").value = musico.email;
    $("musicianSkills").value = asArray(musico.instrumentos).join(", ");
    $("musicianStatus").value = musico.status;
    $("musicianNotes").value = musico.observacoes;
  }

  if (button.dataset.action === "toggle") {
    musico.status = musico.status === "Ativo" ? "Inativo" : "Ativo";
    persistLocal("Status do músico atualizado.");
    renderAll();
  }
}

function handleFunctionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const funcao = database.funcoes.find((item) => item.id_funcao === button.dataset.id);
  if (!funcao) return;

  if (button.dataset.action === "edit") {
    $("functionId").value = funcao.id_funcao;
    $("functionName").value = funcao.nome_funcao;
    $("functionType").value = funcao.tipo_funcao;
    $("functionOrder").value = funcao.ordem_exibicao;
    $("functionStatus").value = funcao.status;
  }

  if (button.dataset.action === "toggle") {
    funcao.status = funcao.status === "Ativo" ? "Inativo" : "Ativo";
    persistLocal("Status da função atualizado.");
    renderAll();
  }
}

function handleEventAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const evento = database.eventos.find((item) => item.id_evento === button.dataset.id);
  if (!evento) return;

  if (button.dataset.action === "edit") {
    $("eventId").value = evento.id_evento;
    $("eventName").value = evento.nome_evento;
    $("eventDate").value = evento.data_evento;
    $("eventTime").value = evento.horario;
    $("eventLocation").value = evento.local;
    $("eventStatus").value = evento.status;
    $("eventNotes").value = evento.observacoes;
  }

  if (button.dataset.action === "cancel") {
    evento.status = evento.status === "Cancelado" ? "Ativo" : "Cancelado";
    addHistory(database, {
      tipo_alteracao: evento.status === "Cancelado" ? "Cancelamento de evento" : "Reativação de evento",
      evento,
      funcao: {},
      usuario_responsavel: coordinatorName(),
      observacao: "",
    });
    persistLocal("Status do evento atualizado.");
    renderAll();
  }
}

function handleAvailabilityAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = database.disponibilidade.find((entry) => entry.id_disponibilidade === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "edit") {
    $("availabilityId").value = item.id_disponibilidade;
    $("availabilityMusician").value = item.id_musico;
    $("availabilityDate").value = item.data;
    $("availabilityStatus").value = item.disponibilidade;
    $("availabilityNotes").value = item.observacoes;
  }

  if (button.dataset.action === "remove") {
    database.disponibilidade = database.disponibilidade.filter((entry) => entry.id_disponibilidade !== item.id_disponibilidade);
    persistLocal("Disponibilidade removida.");
    renderAll();
  }
}

function clearCoordinatorForm() {
  $("coordinatorForm").reset();
  $("coordinatorId").value = "";
  $("coordinatorStatus").value = "Ativo";
}

function clearMusicianForm() {
  $("musicianForm").reset();
  $("musicianId").value = "";
  $("musicianStatus").value = "Ativo";
}

function clearFunctionForm() {
  $("functionForm").reset();
  $("functionId").value = "";
  $("functionType").value = "Instrumento";
  $("functionStatus").value = "Ativo";
  $("functionOrder").value = String(database.funcoes.length + 1);
}

function clearEventForm() {
  $("eventForm").reset();
  $("eventId").value = "";
    $("eventName").value = "Missa Dominical";
  $("eventDate").value = todayISO();
  $("eventTime").value = database.meta.defaultTime;
  $("eventLocation").value = database.meta.defaultLocation;
  $("eventStatus").value = "Ativo";
}

function clearAvailabilityForm() {
  $("availabilityForm").reset();
  $("availabilityId").value = "";
  $("availabilityDate").value = todayISO();
  $("availabilityStatus").value = "Disponível";
}

function syncAssignmentsForEvent(evento) {
  database.escala.forEach((assignment) => {
    if (assignment.id_evento === evento.id_evento) {
      assignment.nome_evento = evento.nome_evento;
      assignment.data_evento = evento.data_evento;
      assignment.horario = evento.horario;
    }
  });
}

async function saveEverything() {
  saveClientConfig({
    apiUrl: $("apiUrlInput").value.trim(),
    adminKey: $("adminKeyInput").value.trim(),
  });
  persistLocal("Alterações salvas neste navegador.");
  if (!getApiUrl()) return;
  if (!getAdminKey()) {
    setStatus("Salvo localmente. Informe a chave administrativa para salvar na planilha.");
    return;
  }

  setStatus("Enviando para a planilha...");
  try {
    const response = await saveRemoteDatabase(database);
    if (response?.ok) {
      database = saveLocalDatabase(database, { markDirty: false });
      setStatus("Alterações salvas na planilha.");
      return;
    }
    setStatus("A planilha recusou o salvamento. As alterações continuam salvas neste dispositivo.");
  } catch {
    setStatus("Salvo localmente. Não foi possível enviar para a planilha.");
  }
}

function saveConfig() {
  saveClientConfig({
    apiUrl: $("apiUrlInput").value.trim(),
    adminKey: $("adminKeyInput").value.trim(),
  });
  setStatus("Configuração guardada neste navegador.");
}

async function reloadRemote(showStatus = true) {
  if (showStatus && hasLocalPendingChanges()) {
    const confirmed = window.confirm(
      "Existem alterações salvas apenas neste dispositivo. Recarregar da planilha pode substituir essas alterações. Deseja continuar?",
    );
    if (!confirmed) {
      setStatus("Recarregamento cancelado. Alterações locais preservadas.");
      return;
    }
  }

  if (showStatus) setStatus("Carregando dados da planilha...");
  const remote = await tryLoadRemoteDatabase();
  if (!remote) {
    if (showStatus) setStatus("Não foi possível carregar a planilha.");
    return;
  }
  database = remote;
  saveLocalDatabase(database, { markDirty: false });
  if (showStatus) setStatus("Dados recarregados da planilha.");
  renderAll();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(database, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `escala-mundo-novo-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function persistLocal(message) {
  database = saveLocalDatabase(database, { markDirty: true });
  setStatus(message);
}

function setStatus(message) {
  $("syncStatus").textContent = message;
}

function initialStatusMessage() {
  if (hasLocalPendingChanges()) {
    return getApiUrl()
      ? "Pronto. Existem alterações locais pendentes de salvar na planilha."
      : "Pronto. Alterações salvas neste dispositivo.";
  }
  return getApiUrl() ? "Pronto. API configurada." : "Pronto. Modo local.";
}

function coordinatorName() {
  const selectedId = $("coordinatorSelect").value;
  return database?.coordenadores.find((item) => item.id_coordenador === selectedId)?.nome
    || APP_CONFIG.DEFAULT_COORDINATOR_NAME;
}

function availabilityClass(status) {
  if (status === "Disponível") return "status-confirmed";
  if (status === "Talvez") return "status-waiting";
  return "status-declined";
}
