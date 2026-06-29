import {
  CONFIRMATION_STATUS,
  MONTHS,
  confirmAssignment,
  confirmLocalAssignment,
  declineAssignment,
  declineLocalAssignment,
  defaultMonthYear,
  escapeHtml,
  formatDateBR,
  getApiUrl,
  getAssignmentsForMusician,
  loadDatabase,
  normalizeDatabase,
  saveLocalDatabase,
  statusClass,
  tryLoadRemoteDatabase,
} from "./app.js";

let database = null;
const initialDate = defaultMonthYear();
let selectedMonth = initialDate.month;
let selectedYear = initialDate.year;
let selectedName = "";

const $ = (id) => document.getElementById(id);

init();

async function init() {
  database = normalizeDatabase(await loadDatabase());
  setupFilters();
  bindEvents();
  readQuery();
  render();
  setStatus(getApiUrl() ? "Conectado à planilha." : "Modo local.");
}

function setupFilters() {
  $("monthSelect").innerHTML = MONTHS.map((month, index) => (
    `<option value="${index + 1}">${month}</option>`
  )).join("");
  $("monthSelect").value = String(selectedMonth);
  $("yearInput").value = String(selectedYear);
  renderMusicianList();
}

function bindEvents() {
  $("monthSelect").addEventListener("change", () => {
    selectedMonth = Number($("monthSelect").value);
    render();
  });
  $("yearInput").addEventListener("change", () => {
    selectedYear = Number($("yearInput").value);
    render();
  });
  $("musicianSearch").addEventListener("input", () => {
    selectedName = $("musicianSearch").value.trim();
  });
  $("musicianSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      selectedName = $("musicianSearch").value.trim();
      render();
    }
  });
  $("searchButton").addEventListener("click", () => {
    selectedName = $("musicianSearch").value.trim();
    render();
  });
  $("assignmentsList").addEventListener("click", handleAssignmentClick);
  $("declineForm").addEventListener("submit", submitDecline);
  $("closeDecline").addEventListener("click", () => $("declineDialog").close());
}

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("nome")) {
    selectedName = params.get("nome");
    $("musicianSearch").value = selectedName;
  }
  if (params.get("mes")) {
    selectedMonth = Number(params.get("mes"));
    $("monthSelect").value = String(selectedMonth);
  }
  if (params.get("ano")) {
    selectedYear = Number(params.get("ano"));
    $("yearInput").value = String(selectedYear);
  }
}

function renderMusicianList() {
  $("musicianList").innerHTML = database.musicos
    .filter((musico) => musico.status !== "Inativo")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((musico) => `<option value="${escapeHtml(musico.nome)}"></option>`)
    .join("");
}

function render() {
  $("musicianTitle").textContent = selectedName ? `Minha escala - ${selectedName}` : "Minha escala";

  if (!selectedName) {
    $("assignmentsList").innerHTML = `<p class="empty-state">Informe seu nome para consultar a escala.</p>`;
    return;
  }

  const assignments = getAssignmentsForMusician(database, selectedName, selectedMonth, selectedYear);
  $("assignmentsList").innerHTML = assignments.length
    ? assignments.map(renderAssignmentCard).join("")
    : `<p class="empty-state">Nenhuma escala encontrada para ${escapeHtml(selectedName)} em ${escapeHtml(MONTHS[selectedMonth - 1])}/${escapeHtml(selectedYear)}.</p>`;
}

function renderAssignmentCard(item) {
  const canAnswer = item.status_confirmacao === CONFIRMATION_STATUS.waiting;
  const isConfirmed = item.status_confirmacao === CONFIRMATION_STATUS.confirmed;
  return `
    <article class="assignment-card" data-id="${escapeHtml(item.id_escala)}">
      <header>
        <div>
          <h2>${escapeHtml(item.nome_evento || "Evento")}</h2>
          <p class="muted">${escapeHtml(formatDateBR(item.data_evento))} às ${escapeHtml(item.horario || "")}</p>
        </div>
        <span class="badge ${statusClass(item.status_confirmacao)}">${escapeHtml(item.status_confirmacao)}</span>
      </header>
      <div class="assignment-details">
        <div class="detail-item">
          <span>Função</span>
          <strong>${escapeHtml(item.funcao)}</strong>
        </div>
        <div class="detail-item">
          <span>Data</span>
          <strong>${escapeHtml(formatDateBR(item.data_evento))}</strong>
        </div>
        <div class="detail-item">
          <span>Status</span>
          <strong>${escapeHtml(item.status_confirmacao)}</strong>
        </div>
        <div class="detail-item">
          <span>Observação</span>
          <strong>${escapeHtml(item.observacao_musico || "-")}</strong>
        </div>
      </div>
      <div class="form-actions">
        ${canAnswer ? `
          <button class="primary" type="button" data-action="confirm">Confirmar presença</button>
          <button class="danger" type="button" data-action="decline">Não poderei comparecer</button>
        ` : ""}
        ${isConfirmed ? renderCalendarActions(item) : ""}
      </div>
    </article>
  `;
}

function renderCalendarActions(item) {
  return `
    <a class="button" href="${escapeHtml(googleCalendarUrl(item))}" target="_blank" rel="noopener">Google Agenda</a>
    <button type="button" data-action="calendar-ics">Baixar .ics</button>
  `;
}

function googleCalendarUrl(item) {
  const { start, end } = assignmentDates(item);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(item),
    dates: `${formatCalendarDate(start)}/${formatCalendarDate(end)}`,
    details: calendarDetails(item),
    location: calendarLocation(item),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadIcs(item) {
  const { start, end } = assignmentDates(item);
  const now = formatCalendarDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Comunidade Mundo Novo//Escala MN//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(item.id_escala)}@escala-mundo-novo`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatCalendarDate(start)}`,
    `DTEND:${formatCalendarDate(end)}`,
    `SUMMARY:${escapeIcs(calendarTitle(item))}`,
    `DESCRIPTION:${escapeIcs(calendarDetails(item))}`,
    `LOCATION:${escapeIcs(calendarLocation(item))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFilename(item.nome_evento)}-${item.data_evento}-${sanitizeFilename(item.funcao)}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function assignmentDates(item) {
  const [hour = "0", minute = "0"] = String(item.horario || "00:00").split(":");
  const start = new Date(`${item.data_evento}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return { start, end };
}

function calendarTitle(item) {
  return `Escala MN - ${item.funcao || item.nome_evento}`;
}

function calendarDetails(item) {
  return [
    `Evento: ${item.nome_evento || "Escala"}`,
    `Função: ${item.funcao || "-"}`,
    `Músico: ${item.nome_musico || selectedName}`,
    `Status: ${item.status_confirmacao}`,
  ].join("\n");
}

function calendarLocation(item) {
  return database.eventos.find((evento) => evento.id_evento === item.id_evento)?.local
    || "Comunidade Mundo Novo";
}

function formatCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

function sanitizeFilename(value) {
  return String(value || "escala")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function handleAssignmentClick(event) {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".assignment-card");
  if (!button || !card) return;

  const assignment = database.escala.find((item) => item.id_escala === card.dataset.id);
  if (!assignment) return;

  if (button.dataset.action === "calendar-ics") {
    downloadIcs(assignment);
    return;
  }

  if (button.dataset.action === "confirm") {
    confirmLocalAssignment(database, assignment.id_escala);
    saveLocalDatabase(database);
    render();
    setStatus("Presença confirmada.");

    if (getApiUrl()) {
      try {
        await confirmAssignment(assignment.id_escala);
        await reloadRemote();
        setStatus("Presença confirmada na planilha.");
      } catch {
        setStatus("Confirmado neste dispositivo. Não foi possível enviar para a planilha.");
      }
    }
  }

  if (button.dataset.action === "decline") {
    $("declineEscalaId").value = assignment.id_escala;
    $("declineInfo").textContent = `${assignment.funcao} em ${formatDateBR(assignment.data_evento)}`;
    $("declineReason").value = "";
    $("declineDialog").showModal();
  }
}

async function submitDecline(event) {
  event.preventDefault();
  const id = $("declineEscalaId").value;
  const motivo = $("declineReason").value.trim();
  if (!motivo) return;

  declineLocalAssignment(database, id, motivo);
  saveLocalDatabase(database);
  $("declineDialog").close();
  render();
  setStatus("Recusa registrada.");

  if (getApiUrl()) {
    try {
      await declineAssignment(id, motivo);
      await reloadRemote();
      setStatus("Recusa registrada na planilha.");
    } catch {
      setStatus("Recusa salva neste dispositivo. Não foi possível enviar para a planilha.");
    }
  }
}

async function reloadRemote() {
  const remote = await tryLoadRemoteDatabase();
  if (!remote) return;
  database = remote;
  saveLocalDatabase(database);
  renderMusicianList();
  render();
}

function setStatus(message) {
  $("musicianStatus").textContent = message;
}
