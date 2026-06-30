import { APP_CONFIG } from "./config.js";

export const STORAGE_KEY = APP_CONFIG.LOCAL_STORAGE_KEY;
export const CONFIG_KEY = APP_CONFIG.CONFIG_STORAGE_KEY;
export const PENDING_CHANGES_KEY = `${STORAGE_KEY}-pending-changes`;

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const CONFIRMATION_STATUS = {
  waiting: "Aguardando confirmação",
  confirmed: "Confirmado",
  declined: "Não poderá comparecer",
  replaced: "Substituído",
};

export const PENDING_STATUS = {
  open: "Pendente de remanejamento",
  resolved: "Resolvida",
  replaced: "Remanejada",
};

export const FUNCTION_TYPES = ["Serviço", "Instrumento", "Vocal"];
export const AVAILABILITY = ["Disponível", "Indisponível", "Talvez"];
export const ACTIVE_STATUS = ["Ativo", "Inativo"];

export const FIXED_EVENT_TEMPLATES = [
  {
    key: "noite-louvor",
    nome_evento: "Noite de Louvor",
    weekday: 1,
    horario: "19:30",
  },
  {
    key: "missa-quinta",
    nome_evento: "Missa Quinta-Feira",
    weekday: 4,
    horario: "19:30",
  },
  {
    key: "missa-dominical-0800",
    nome_evento: "Missa Dominical",
    weekday: 0,
    horario: "08:00",
  },
  {
    key: "missa-dominical-0930",
    nome_evento: "Missa Dominical",
    weekday: 0,
    horario: "09:30",
  },
];

export async function loadDatabase() {
  const local = loadLocalDatabase();
  if (local && hasLocalPendingChanges()) return local;

  const remote = await tryLoadRemoteDatabase();
  if (remote) {
    saveLocalDatabase(remote, { markDirty: false });
    return remote;
  }

  if (local) return local;

  const seed = await loadSeedDatabase();
  saveLocalDatabase(seed, { markDirty: false });
  return seed;
}

export function loadLocalDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeDatabase(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalDatabase(database, options = {}) {
  const normalized = normalizeDatabase(database);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (options.markDirty === true) setLocalPendingChanges(true);
  if (options.markDirty === false) setLocalPendingChanges(false);
  return normalized;
}

export function hasLocalPendingChanges() {
  try {
    return localStorage.getItem(PENDING_CHANGES_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLocalPendingChanges(hasPendingChanges) {
  try {
    if (hasPendingChanges) localStorage.setItem(PENDING_CHANGES_KEY, "1");
    else localStorage.removeItem(PENDING_CHANGES_KEY);
  } catch {
    // Ignora ambientes onde o armazenamento local esteja indisponível.
  }
}

export async function saveRemoteDatabase(database) {
  return apiPost("saveAll", { database: normalizeDatabase(database) }, { admin: true });
}

export async function tryLoadRemoteDatabase() {
  if (!getApiUrl()) return null;

  try {
    const response = await apiGet("getAll");
    if (!response?.ok || !response.database) return null;
    return normalizeDatabase(response.database);
  } catch {
    return null;
  }
}

export async function confirmAssignment(idEscala) {
  return apiPost("confirmarPresenca", { id_escala: idEscala });
}

export async function declineAssignment(idEscala, motivo) {
  return apiPost("registrarRecusa", {
    id_escala: idEscala,
    observacao_musico: motivo,
  });
}

export async function remanejarAssignment(idEscala, musician, usuario, observacao = "") {
  return apiPost(
    "remanejarMusico",
    {
      id_escala: idEscala,
      novo_musico: musician,
      usuario_responsavel: usuario,
      observacao,
    },
    { admin: true },
  );
}

export async function apiGet(action, params = {}) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("URL da API não configurada.");

  const url = new URL(apiUrl);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), { method: "GET" });
  return response.json();
}

export async function apiPost(action, payload = {}, options = {}) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("URL da API não configurada.");

  const body = {
    action,
    ...payload,
  };

  if (options.admin) {
    body.adminKey = getAdminKey();
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });

  return response.json();
}

export function loadClientConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    const query = new URLSearchParams(window.location.search);
    const apiFromQuery = query.get("api");
    const keyFromQuery = query.get("key");

    const next = {
      apiUrl: apiFromQuery || saved.apiUrl || APP_CONFIG.API_URL || "",
      adminKey: keyFromQuery || saved.adminKey || APP_CONFIG.ADMIN_KEY || "",
    };

    if (apiFromQuery || keyFromQuery) saveClientConfig(next);
    return next;
  } catch {
    return {
      apiUrl: APP_CONFIG.API_URL || "",
      adminKey: APP_CONFIG.ADMIN_KEY || "",
    };
  }
}

export function saveClientConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    apiUrl: config.apiUrl || "",
    adminKey: config.adminKey || "",
  }));
}

export function getApiUrl() {
  return loadClientConfig().apiUrl.trim();
}

export function getAdminKey() {
  return loadClientConfig().adminKey.trim();
}

export function normalizeDatabase(database) {
  const seed = createSeedDatabase();
  const next = {
    meta: {
      communityName: database?.meta?.communityName || seed.meta.communityName,
      titlePrefix: database?.meta?.titlePrefix || seed.meta.titlePrefix,
      notice: database?.meta?.notice || seed.meta.notice,
      defaultLocation: database?.meta?.defaultLocation || seed.meta.defaultLocation,
      defaultTime: database?.meta?.defaultTime || seed.meta.defaultTime,
    },
    coordenadores: Array.isArray(database?.coordenadores) ? database.coordenadores : seed.coordenadores,
    musicos: Array.isArray(database?.musicos) ? database.musicos : seed.musicos,
    funcoes: Array.isArray(database?.funcoes) ? database.funcoes : seed.funcoes,
    eventos: Array.isArray(database?.eventos) ? database.eventos : seed.eventos,
    disponibilidade: Array.isArray(database?.disponibilidade) ? database.disponibilidade : seed.disponibilidade,
    escala: Array.isArray(database?.escala) ? database.escala : seed.escala,
    historico: Array.isArray(database?.historico) ? database.historico : seed.historico,
  };

  next.coordenadores = next.coordenadores.map((coordenador) => ({
    id_coordenador: coordenador.id_coordenador || makeId("coord"),
    nome: coordenador.nome || coordenador.nome_coordenador || "",
    telefone: coordenador.telefone || "",
    email: coordenador.email || "",
    status: coordenador.status || "Ativo",
    observacoes: coordenador.observacoes || "",
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (!next.coordenadores.length) {
    next.coordenadores = seed.coordenadores.slice();
  }

  next.musicos = next.musicos.map((musico) => ({
    id_musico: musico.id_musico || makeId("musico"),
    nome: musico.nome || "",
    telefone: musico.telefone || "",
    email: musico.email || "",
    instrumentos: asArray(musico.instrumentos),
    status: musico.status || "Ativo",
    observacoes: musico.observacoes || "",
  }));

  next.funcoes = next.funcoes.map((funcao, index) => ({
    id_funcao: funcao.id_funcao || makeId("funcao"),
    nome_funcao: funcao.nome_funcao || funcao.nome || "",
    tipo_funcao: funcao.tipo_funcao || "Instrumento",
    ordem_exibicao: Number(funcao.ordem_exibicao || index + 1),
    status: funcao.status || "Ativo",
  })).sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);

  next.eventos = next.eventos.map((evento) => ({
    id_evento: evento.id_evento || makeId("evento"),
    nome_evento: evento.nome_evento || evento.name || "Evento",
    data_evento: toISODateString(evento.data_evento || evento.date || todayISO()),
    dia_semana: evento.dia_semana || weekdayName(evento.data_evento || evento.date || todayISO()),
    horario: evento.horario || next.meta.defaultTime,
    local: evento.local || next.meta.defaultLocation,
    status: evento.status || "Ativo",
    observacoes: evento.observacoes || "",
  })).sort(compareByDateTimeAndName);

  next.disponibilidade = next.disponibilidade.map((item) => ({
    id_disponibilidade: item.id_disponibilidade || makeId("disp"),
    id_musico: item.id_musico || "",
    nome_musico: item.nome_musico || "",
    data: toISODateString(item.data || todayISO()),
    disponibilidade: item.disponibilidade || "Disponível",
    observacoes: item.observacoes || "",
  }));

  next.escala = next.escala.map((item) => ({
    id_escala: item.id_escala || makeId("escala"),
    id_evento: item.id_evento || "",
    data_evento: toISODateString(item.data_evento || todayISO()),
    nome_evento: item.nome_evento || "",
    horario: item.horario || "",
    id_funcao: item.id_funcao || findFunctionIdByName(next, item.funcao),
    funcao: item.funcao || "",
    tipo_funcao: item.tipo_funcao || findFunctionTypeById(next, item.id_funcao) || "",
    id_musico: item.id_musico || "",
    nome_musico: item.nome_musico || "",
    status_confirmacao: item.status_confirmacao || CONFIRMATION_STATUS.waiting,
    data_confirmacao: item.data_confirmacao || "",
    observacao_musico: item.observacao_musico || "",
    status_pendencia: item.status_pendencia || "",
    substitui_id: item.substitui_id || "",
    criado_em: item.criado_em || nowISO(),
  }));

  next.historico = next.historico.map((item) => ({
    id_historico: item.id_historico || makeId("hist"),
    data_hora: item.data_hora || nowISO(),
    tipo_alteracao: item.tipo_alteracao || "",
    id_evento: item.id_evento || "",
    nome_evento: item.nome_evento || "",
    data_evento: item.data_evento ? toISODateString(item.data_evento) : "",
    funcao: item.funcao || item.instrumento || "",
    musico_anterior: item.musico_anterior || "",
    musico_novo: item.musico_novo || "",
    usuario_responsavel: item.usuario_responsavel || "",
    observacao: item.observacao || "",
  }));

  return next;
}

export function createSeedDatabase() {
  const coordenadores = [
    {
      id_coordenador: "coord-eder",
      nome: "Eder",
      telefone: "",
      email: "",
      status: "Ativo",
      observacoes: "Coordenação geral",
    },
    {
      id_coordenador: "coord-ministerio-musica",
      nome: "Coordenação Ministério de Música",
      telefone: "",
      email: "",
      status: "Ativo",
      observacoes: "",
    },
  ];

  const funcoes = [
    ["func-adoracao", "Adoração", "Serviço", 1],
    ["func-cenaculo", "Cenáculo", "Serviço", 2],
    ["func-teclado", "Teclado", "Instrumento", 3],
    ["func-violao", "Violão", "Instrumento", 4],
    ["func-contra-baixo", "Contra Baixo", "Instrumento", 5],
    ["func-guitarra", "Guitarra", "Instrumento", 6],
    ["func-percussao", "Percussão", "Instrumento", 7],
    ["func-bateria", "Bateria", "Instrumento", 8],
    ["func-voz-1", "Voz 1", "Vocal", 9],
    ["func-voz-2", "Voz 2", "Vocal", 10],
    ["func-voz-3", "Voz 3", "Vocal", 11],
    ["func-intencoes", "Intenções", "Serviço", 12],
    ["func-divina-vontade", "Divina Vontade", "Serviço", 13],
    ["func-liturgia", "Liturgia", "Serviço", 14],
    ["func-social", "Social", "Serviço", 15],
  ].map(([id_funcao, nome_funcao, tipo_funcao, ordem_exibicao]) => ({
    id_funcao,
    nome_funcao,
    tipo_funcao,
    ordem_exibicao,
    status: "Ativo",
  }));

  const musicos = [
    ["mus-maria", "Maria", "(00) 90000-0001", "maria@email.com", ["Teclado", "Voz", "Adoração"]],
    ["mus-joao", "João", "(00) 90000-0002", "joao@email.com", ["Violão", "Voz", "Cenáculo"]],
    ["mus-pedro", "Pedro", "(00) 90000-0003", "pedro@email.com", ["Contra Baixo", "Baixo"]],
    ["mus-ana", "Ana", "(00) 90000-0004", "ana@email.com", ["Bateria", "Percussão"]],
    ["mus-carlos", "Carlos", "(00) 90000-0005", "carlos@email.com", ["Violão", "Guitarra"]],
    ["mus-fernanda", "Fernanda", "(00) 90000-0006", "fernanda@email.com", ["Voz", "Vocal"]],
    ["mus-luisa", "Luísa", "(00) 90000-0007", "luisa@email.com", ["Voz", "Vocal"]],
    ["mus-marcia", "Márcia", "(00) 90000-0008", "marcia@email.com", ["Liturgia", "Intenções"]],
    ["mus-rafael", "Rafael", "(00) 90000-0009", "rafael@email.com", ["Social", "Divina Vontade"]],
    ["mus-eder", "Eder", "(00) 90000-0010", "eder@email.com", ["Contra Baixo", "Violão"]],
    ["mus-luiz", "Luiz Gustavo", "(00) 90000-0011", "luiz@email.com", ["Teclado"]],
    ["mus-lorrane", "Lorrane", "(00) 90000-0012", "lorrane@email.com", ["Bateria", "Voz"]],
  ].map(([id_musico, nome, telefone, email, instrumentos]) => ({
    id_musico,
    nome,
    telefone,
    email,
    instrumentos,
    status: "Ativo",
    observacoes: "",
  }));

  const eventos = buildFixedEventsForMonth(7, 2026);

  const escala = [
    ["ev-2026-07-05-missa-dominical-0800", "func-adoracao", "Maria", "mus-maria"],
    ["ev-2026-07-05-missa-dominical-0800", "func-cenaculo", "João", "mus-joao"],
    ["ev-2026-07-05-missa-dominical-0800", "func-teclado", "Luiz Gustavo", "mus-luiz"],
    ["ev-2026-07-05-missa-dominical-0800", "func-violao", "Carlos", "mus-carlos"],
    ["ev-2026-07-05-missa-dominical-0800", "func-contra-baixo", "Pedro", "mus-pedro"],
    ["ev-2026-07-05-missa-dominical-0800", "func-bateria", "Ana", "mus-ana"],
    ["ev-2026-07-05-missa-dominical-0800", "func-voz-1", "Fernanda", "mus-fernanda"],
    ["ev-2026-07-05-missa-dominical-0800", "func-voz-2", "Luísa", "mus-luisa"],
    ["ev-2026-07-05-missa-dominical-0800", "func-liturgia", "Márcia", "mus-marcia"],
    ["ev-2026-07-05-missa-dominical-0800", "func-social", "Rafael", "mus-rafael"],
    ["ev-2026-07-12-missa-dominical-0930", "func-contra-baixo", "Pedro", "mus-pedro", CONFIRMATION_STATUS.declined, PENDING_STATUS.open, "Viagem em família"],
    ["ev-2026-07-19-missa-dominical-0800", "func-violao", "João", "mus-joao", CONFIRMATION_STATUS.confirmed, "", ""],
  ].map(([id_evento, id_funcao, nome_musico, id_musico, status, pendencia, obs], index) => {
    const evento = eventos.find((item) => item.id_evento === id_evento);
    const funcao = funcoes.find((item) => item.id_funcao === id_funcao);
    return {
      id_escala: `esc-${index + 1}`,
      id_evento,
      data_evento: evento.data_evento,
      nome_evento: evento.nome_evento,
      horario: evento.horario,
      id_funcao,
      funcao: funcao.nome_funcao,
      tipo_funcao: funcao.tipo_funcao,
      id_musico,
      nome_musico,
      status_confirmacao: status || CONFIRMATION_STATUS.waiting,
      data_confirmacao: status === CONFIRMATION_STATUS.confirmed ? "2026-06-29T09:00:00" : "",
      observacao_musico: obs || "",
      status_pendencia: pendencia || "",
      substitui_id: "",
      criado_em: "2026-06-29T09:00:00",
    };
  });

  return {
    meta: {
      communityName: "Comunidade Mundo Novo",
      titlePrefix: "ESCALA DE SERVIÇO",
      notice: "A escala poderá sofrer alterações durante o mês.",
      defaultLocation: "Comunidade Mundo Novo",
      defaultTime: "19:30",
    },
    coordenadores,
    musicos,
    funcoes,
    eventos,
    disponibilidade: [
      {
        id_disponibilidade: "disp-1",
        id_musico: "mus-pedro",
        nome_musico: "Pedro",
        data: "2026-07-12",
        disponibilidade: "Indisponível",
        observacoes: "Viagem",
      },
      {
        id_disponibilidade: "disp-2",
        id_musico: "mus-maria",
        nome_musico: "Maria",
        data: "2026-07-19",
        disponibilidade: "Talvez",
        observacoes: "Confirmar no começo da semana",
      },
    ],
    escala,
    historico: [
      {
        id_historico: "hist-1",
        data_hora: "2026-06-29T09:00:00",
        tipo_alteracao: "Criação de escala",
        id_evento: "ev-2026-07-05",
        nome_evento: "Celebração Dominical",
        data_evento: "2026-07-05",
        funcao: "Teclado",
        musico_anterior: "",
        musico_novo: "Luiz Gustavo",
        usuario_responsavel: "Sistema",
        observacao: "Dados iniciais de exemplo",
      },
    ],
  };
}

export function getMonthEvents(database, month, year) {
  return database.eventos
    .filter((evento) => {
      const date = parseISODate(evento.data_evento);
      return date.getMonth() + 1 === Number(month) && date.getFullYear() === Number(year);
    })
    .sort((a, b) => (
      a.data_evento.localeCompare(b.data_evento)
      || String(a.horario || "").localeCompare(String(b.horario || ""))
      || String(a.nome_evento || "").localeCompare(String(b.nome_evento || ""), "pt-BR")
    ));
}

export function getActiveFunctions(database) {
  return database.funcoes
    .filter((funcao) => funcao.status !== "Inativo")
    .sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);
}

export function getActiveCoordinators(database) {
  return database.coordenadores
    .filter((coordenador) => coordenador.status !== "Inativo")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function getActiveMusicians(database) {
  return database.musicos
    .filter((musico) => musico.status !== "Inativo")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function getAssignment(database, eventId, functionId) {
  const matches = database.escala
    .filter((item) => item.id_evento === eventId && item.id_funcao === functionId)
    .filter((item) => item.status_confirmacao !== CONFIRMATION_STATUS.replaced)
    .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));

  return matches.at(-1) || null;
}

export function getAssignmentsForMusician(database, musicianName, month, year) {
  const normalizedName = normalizeText(musicianName);
  return database.escala
    .filter((item) => normalizeText(item.nome_musico) === normalizedName)
    .filter((item) => item.status_confirmacao !== CONFIRMATION_STATUS.replaced)
    .filter((item) => {
      const date = parseISODate(item.data_evento);
      return date.getMonth() + 1 === Number(month) && date.getFullYear() === Number(year);
    })
    .sort(compareByDateTimeAndName);
}

export function getPendingAssignments(database, month, year) {
  return database.escala
    .filter((item) => item.status_confirmacao === CONFIRMATION_STATUS.declined)
    .filter((item) => item.status_pendencia === PENDING_STATUS.open)
    .filter((item) => {
      if (!month || !year) return true;
      const date = parseISODate(item.data_evento);
      return date.getMonth() + 1 === Number(month) && date.getFullYear() === Number(year);
    })
    .sort(compareByDateTimeAndName);
}

export function getMusicianOptions(database, funcao, dataEvento, eventId = "") {
  const active = getActiveMusicians(database).filter((musico) => {
    if (!eventId) return true;
    return !database.escala.some((item) => (
      item.id_evento === eventId
      && item.id_musico === musico.id_musico
      && item.status_confirmacao !== CONFIRMATION_STATUS.replaced
    ));
  });

  const byAvailability = active.map((musico) => ({
    ...musico,
    disponibilidade: getAvailabilityFor(database, musico.id_musico, dataEvento),
  }));

  const preferred = byAvailability
    .filter((musico) => isPreferredForFunction(musico, funcao))
    .sort(sortAvailabilityThenName);
  const others = byAvailability
    .filter((musico) => !isPreferredForFunction(musico, funcao))
    .sort(sortAvailabilityThenName);

  return { preferred, others };
}

export function isPreferredForFunction(musico, funcao) {
  const skills = asArray(musico.instrumentos).map(normalizeText);
  const functionName = normalizeText(funcao.nome_funcao || funcao);
  const functionType = normalizeText(funcao.tipo_funcao || "");

  if (skills.includes(functionName)) return true;
  if (functionName.includes("voz") && (skills.includes("voz") || skills.includes("vocal"))) return true;
  if (functionName.includes("contra baixo") && (skills.includes("baixo") || skills.includes("contrabaixo"))) return true;
  if (functionName === "bateria" && skills.includes("batera")) return true;
  if (functionType === "servico" && skills.includes("servico")) return true;
  return false;
}

export function getAvailabilityFor(database, musicianId, date) {
  return database.disponibilidade.find((item) => (
    item.id_musico === musicianId && item.data === date
  ))?.disponibilidade || "Disponível";
}

export function ensureFixedMonthEvents(database, month, year) {
  const existingFixedKeys = new Set(getMonthEvents(database, month, year).map((evento) => fixedEventIdentity(evento)));
  const created = [];

  getFixedEventsForMonth(month, year).forEach((eventTemplate) => {
    if (existingFixedKeys.has(fixedEventIdentity(eventTemplate))) return;
    const evento = {
      id_evento: eventTemplate.id_evento,
      nome_evento: eventTemplate.nome_evento,
      data_evento: eventTemplate.data_evento,
      dia_semana: eventTemplate.dia_semana,
      horario: eventTemplate.horario,
      local: database.meta.defaultLocation,
      status: "Ativo",
      observacoes: "",
    };
    database.eventos.push(evento);
    created.push(evento);
  });

  database.eventos.sort((a, b) => (
    a.data_evento.localeCompare(b.data_evento)
    || String(a.horario || "").localeCompare(String(b.horario || ""))
    || String(a.nome_evento || "").localeCompare(String(b.nome_evento || ""), "pt-BR")
  ));
  return created;
}

export const ensureSundayEvents = ensureFixedMonthEvents;

export function getFixedEventsForMonth(month, year) {
  const events = [];
  const date = new Date(Number(year), Number(month) - 1, 1);
  while (date.getMonth() === Number(month) - 1) {
    FIXED_EVENT_TEMPLATES
      .filter((template) => date.getDay() === template.weekday)
      .forEach((template) => {
        const iso = toISODate(date);
        events.push({
          id_evento: `ev-${iso}-${template.key}`,
          nome_evento: template.nome_evento,
          data_evento: iso,
          dia_semana: weekdayName(iso),
          horario: template.horario,
          local: "Comunidade Mundo Novo",
          status: "Ativo",
          observacoes: "",
        });
      });
    date.setDate(date.getDate() + 1);
  }
  return events.sort((a, b) => (
    a.data_evento.localeCompare(b.data_evento)
    || a.horario.localeCompare(b.horario)
    || a.nome_evento.localeCompare(b.nome_evento, "pt-BR")
  ));
}

function buildFixedEventsForMonth(month, year) {
  return getFixedEventsForMonth(month, year);
}

function fixedEventIdentity(evento) {
  return [
    toISODateString(evento.data_evento),
    normalizeText(evento.nome_evento),
    String(evento.horario || "").trim(),
  ].join("|");
}

export function upsertAssignment(database, eventId, functionId, musicianId, usuario = "Coordenador") {
  const evento = database.eventos.find((item) => item.id_evento === eventId);
  const funcao = database.funcoes.find((item) => item.id_funcao === functionId);
  const musico = database.musicos.find((item) => item.id_musico === musicianId);
  const previous = getAssignment(database, eventId, functionId);

  if (!evento || !funcao) return null;

  if (!musico) {
    if (previous) {
      previous.status_confirmacao = CONFIRMATION_STATUS.replaced;
      previous.status_pendencia = "";
      addHistory(database, {
        tipo_alteracao: "Remoção de músico",
        evento,
        funcao,
        musico_anterior: previous.nome_musico,
        musico_novo: "",
        usuario_responsavel: usuario,
        observacao: "Célula da escala esvaziada",
      });
    }
    return null;
  }

  if (previous && previous.id_musico === musicianId) return previous;

  if (previous) {
    previous.status_confirmacao = CONFIRMATION_STATUS.replaced;
    previous.status_pendencia = previous.status_pendencia === PENDING_STATUS.open
      ? PENDING_STATUS.replaced
      : previous.status_pendencia;
  }

  const assignment = {
    id_escala: makeId("escala"),
    id_evento: evento.id_evento,
    data_evento: evento.data_evento,
    nome_evento: evento.nome_evento,
    horario: evento.horario,
    id_funcao: funcao.id_funcao,
    funcao: funcao.nome_funcao,
    tipo_funcao: funcao.tipo_funcao,
    id_musico: musico.id_musico,
    nome_musico: musico.nome,
    status_confirmacao: CONFIRMATION_STATUS.waiting,
    data_confirmacao: "",
    observacao_musico: "",
    status_pendencia: "",
    substitui_id: previous?.id_escala || "",
    criado_em: nowISO(),
  };

  database.escala.push(assignment);
  addHistory(database, {
    tipo_alteracao: previous ? "Alteração de músico" : "Criação de escala",
    evento,
    funcao,
    musico_anterior: previous?.nome_musico || "",
    musico_novo: musico.nome,
    usuario_responsavel: usuario,
    observacao: previous?.status_confirmacao === CONFIRMATION_STATUS.declined
      ? "Remanejamento a partir de recusa"
      : "",
  });

  return assignment;
}

export function confirmLocalAssignment(database, idEscala) {
  const assignment = database.escala.find((item) => item.id_escala === idEscala);
  if (!assignment) return null;
  assignment.status_confirmacao = CONFIRMATION_STATUS.confirmed;
  assignment.data_confirmacao = nowISO();
  assignment.status_pendencia = "";
  assignment.observacao_musico = "";
  addHistory(database, {
    tipo_alteracao: "Confirmação de presença",
    evento: assignment,
    funcao: assignment,
    musico_anterior: "",
    musico_novo: assignment.nome_musico,
    usuario_responsavel: assignment.nome_musico,
    observacao: "",
  });
  return assignment;
}

export function declineLocalAssignment(database, idEscala, motivo) {
  const assignment = database.escala.find((item) => item.id_escala === idEscala);
  if (!assignment) return null;
  assignment.status_confirmacao = CONFIRMATION_STATUS.declined;
  assignment.data_confirmacao = nowISO();
  assignment.observacao_musico = motivo;
  assignment.status_pendencia = PENDING_STATUS.open;
  addHistory(database, {
    tipo_alteracao: "Recusa de presença",
    evento: assignment,
    funcao: assignment,
    musico_anterior: assignment.nome_musico,
    musico_novo: "",
    usuario_responsavel: assignment.nome_musico,
    observacao: motivo,
  });
  return assignment;
}

export function remanejarLocalAssignment(database, idEscala, musicianId, usuario, observacao = "") {
  const previous = database.escala.find((item) => item.id_escala === idEscala);
  if (!previous) return null;
  previous.status_confirmacao = CONFIRMATION_STATUS.replaced;
  previous.status_pendencia = PENDING_STATUS.replaced;
  previous.observacao_musico = previous.observacao_musico || observacao;
  return upsertAssignment(database, previous.id_evento, previous.id_funcao, musicianId, usuario);
}

export function addHistory(database, entry) {
  const evento = entry.evento || {};
  const funcao = entry.funcao || {};
  database.historico.unshift({
    id_historico: makeId("hist"),
    data_hora: nowISO(),
    tipo_alteracao: entry.tipo_alteracao || "",
    id_evento: evento.id_evento || "",
    nome_evento: evento.nome_evento || "",
    data_evento: evento.data_evento || "",
    funcao: funcao.nome_funcao || funcao.funcao || "",
    musico_anterior: entry.musico_anterior || "",
    musico_novo: entry.musico_novo || "",
    usuario_responsavel: entry.usuario_responsavel || "",
    observacao: entry.observacao || "",
  });
}

export function getSundaysOfMonth(month, year) {
  const dates = [];
  const date = new Date(Number(year), Number(month) - 1, 1);
  while (date.getMonth() === Number(month) - 1) {
    if (date.getDay() === 0) dates.push(toISODate(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function defaultMonthYear() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate() >= 20) target.setMonth(target.getMonth() + 1);
  return {
    month: target.getMonth() + 1,
    year: target.getFullYear(),
  };
}

export function formatMonthYear(month, year) {
  return `${MONTHS[Number(month) - 1].toUpperCase()}/${year}`;
}

export function formatDateBR(dateString) {
  if (!dateString) return "";
  const date = parseISODate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateWithWeekday(dateString) {
  return `${formatDateBR(dateString)} - ${weekdayName(dateString)}`;
}

export function formatDateTimeBR(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function weekdayName(dateString) {
  return WEEKDAYS[parseISODate(dateString).getDay()];
}

export function statusClass(status) {
  return {
    [CONFIRMATION_STATUS.waiting]: "status-waiting",
    [CONFIRMATION_STATUS.confirmed]: "status-confirmed",
    [CONFIRMATION_STATUS.declined]: "status-declined",
    [CONFIRMATION_STATUS.replaced]: "status-replaced",
    [PENDING_STATUS.open]: "status-pending",
  }[status] || "status-muted";
}

export function makeId(prefix) {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayISO() {
  return toISODate(new Date());
}

export function toISODate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function toISODateString(value) {
  if (!value) return todayISO();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return toISODate(date);
  return todayISO();
}

export function parseISODate(dateString) {
  const [year, month, day] = toISODateString(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compareByDateTimeAndName(a, b) {
  return String(a.data_evento || "").localeCompare(String(b.data_evento || ""))
    || String(a.horario || "").localeCompare(String(b.horario || ""))
    || String(a.nome_evento || "").localeCompare(String(b.nome_evento || ""), "pt-BR");
}

export function asArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadSeedDatabase() {
  try {
    const response = await fetch("./data/seed.json");
    if (!response.ok) throw new Error("Seed indisponível.");
    return normalizeDatabase(await response.json());
  } catch {
    return normalizeDatabase(createSeedDatabase());
  }
}

function findFunctionIdByName(database, name) {
  return database.funcoes.find((funcao) => (
    normalizeText(funcao.nome_funcao) === normalizeText(name)
  ))?.id_funcao || "";
}

function findFunctionTypeById(database, id) {
  return database.funcoes.find((funcao) => funcao.id_funcao === id)?.tipo_funcao || "";
}

function sortAvailabilityThenName(a, b) {
  const weight = { "Disponível": 0, "Talvez": 1, "Indisponível": 2 };
  return (weight[a.disponibilidade] ?? 3) - (weight[b.disponibilidade] ?? 3)
    || a.nome.localeCompare(b.nome, "pt-BR");
}
