const ADMIN_KEY = 'troque-esta-chave';

const SHEETS = {
  Musicos: ['id_musico', 'nome', 'telefone', 'email', 'instrumentos', 'status', 'observacoes'],
  FuncoesEscala: ['id_funcao', 'nome_funcao', 'tipo_funcao', 'ordem_exibicao', 'status'],
  Eventos: ['id_evento', 'nome_evento', 'data_evento', 'dia_semana', 'horario', 'local', 'status', 'observacoes'],
  Disponibilidade: ['id_disponibilidade', 'id_musico', 'nome_musico', 'data', 'disponibilidade', 'observacoes'],
  Escala: [
    'id_escala',
    'id_evento',
    'data_evento',
    'nome_evento',
    'horario',
    'id_funcao',
    'funcao',
    'tipo_funcao',
    'id_musico',
    'nome_musico',
    'status_confirmacao',
    'data_confirmacao',
    'observacao_musico',
    'status_pendencia',
    'substitui_id',
    'criado_em'
  ],
  Historico: [
    'id_historico',
    'data_hora',
    'tipo_alteracao',
    'id_evento',
    'nome_evento',
    'data_evento',
    'funcao',
    'musico_anterior',
    'musico_novo',
    'usuario_responsavel',
    'observacao'
  ],
  Configuracoes: ['chave', 'valor']
};

const FIXED_EVENT_TEMPLATES = [
  { key: 'noite-louvor', nome_evento: 'Noite de Louvor', weekday: 1, horario: '19:30' },
  { key: 'missa-quinta', nome_evento: 'Missa Quinta-Feira', weekday: 4, horario: '19:30' },
  { key: 'missa-dominical-0800', nome_evento: 'Missa Dominical', weekday: 0, horario: '08:00' },
  { key: 'missa-dominical-0930', nome_evento: 'Missa Dominical', weekday: 0, horario: '09:30' }
];

function doGet(event) {
  try {
    ensureSheets_();
    const action = (event.parameter.action || 'getAll').trim();
    const database = getDatabase_();

    if (action === 'getMonth') {
      return jsonResponse_({
        ok: true,
        database: filterDatabaseByMonth_(database, Number(event.parameter.mes), Number(event.parameter.ano))
      });
    }

    if (action === 'getMusicianScale') {
      return jsonResponse_({
        ok: true,
        escala: filterScaleByMusician_(database, event.parameter.nome, Number(event.parameter.mes), Number(event.parameter.ano))
      });
    }

    if (action === 'getPendencias') {
      return jsonResponse_({
        ok: true,
        pendencias: database.escala.filter(function(item) {
          return item.status_confirmacao === 'Não poderá comparecer'
            && item.status_pendencia === 'Pendente de remanejamento';
        })
      });
    }

    return jsonResponse_({ ok: true, database: database });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function doPost(event) {
  try {
    ensureSheets_();
    const payload = parsePayload_(event);
    const action = (payload.action || '').trim();

    if (action === 'setupSheets') {
      requireAdmin_(payload);
      setupPlanilhaInicial();
      return jsonResponse_({ ok: true });
    }

    if (action === 'saveAll') {
      requireAdmin_(payload);
      writeDatabase_(payload.database || {});
      return jsonResponse_({ ok: true });
    }

    if (action === 'confirmarPresenca') {
      const database = getDatabase_();
      const item = findScaleItem_(database, payload.id_escala);
      item.status_confirmacao = 'Confirmado';
      item.data_confirmacao = now_();
      item.observacao_musico = '';
      item.status_pendencia = '';
      addHistory_(database, {
        tipo_alteracao: 'Confirmação de presença',
        id_evento: item.id_evento,
        nome_evento: item.nome_evento,
        data_evento: item.data_evento,
        funcao: item.funcao,
        musico_anterior: '',
        musico_novo: item.nome_musico,
        usuario_responsavel: item.nome_musico,
        observacao: ''
      });
      writeDatabase_(database);
      return jsonResponse_({ ok: true, escala: item });
    }

    if (action === 'registrarRecusa') {
      const database = getDatabase_();
      const item = findScaleItem_(database, payload.id_escala);
      item.status_confirmacao = 'Não poderá comparecer';
      item.data_confirmacao = now_();
      item.observacao_musico = payload.observacao_musico || '';
      item.status_pendencia = 'Pendente de remanejamento';
      addHistory_(database, {
        tipo_alteracao: 'Recusa de presença',
        id_evento: item.id_evento,
        nome_evento: item.nome_evento,
        data_evento: item.data_evento,
        funcao: item.funcao,
        musico_anterior: item.nome_musico,
        musico_novo: '',
        usuario_responsavel: item.nome_musico,
        observacao: item.observacao_musico
      });
      writeDatabase_(database);
      return jsonResponse_({ ok: true, escala: item });
    }

    if (action === 'remanejarMusico') {
      requireAdmin_(payload);
      const database = getDatabase_();
      const oldItem = findScaleItem_(database, payload.id_escala);
      const novo = payload.novo_musico || {};

      oldItem.status_confirmacao = 'Substituído';
      oldItem.status_pendencia = 'Remanejada';

      const newItem = Object.assign({}, oldItem, {
        id_escala: makeId_('escala'),
        id_musico: novo.id_musico || '',
        nome_musico: novo.nome || novo.nome_musico || '',
        status_confirmacao: 'Aguardando confirmação',
        data_confirmacao: '',
        observacao_musico: '',
        status_pendencia: '',
        substitui_id: oldItem.id_escala,
        criado_em: now_()
      });

      database.escala.push(newItem);
      addHistory_(database, {
        tipo_alteracao: 'Remanejamento',
        id_evento: oldItem.id_evento,
        nome_evento: oldItem.nome_evento,
        data_evento: oldItem.data_evento,
        funcao: oldItem.funcao,
        musico_anterior: oldItem.nome_musico,
        musico_novo: newItem.nome_musico,
        usuario_responsavel: payload.usuario_responsavel || 'Coordenador',
        observacao: payload.observacao || ''
      });
      writeDatabase_(database);
      return jsonResponse_({ ok: true, escala: newItem });
    }

    return jsonResponse_({ ok: false, error: 'Ação não reconhecida.' });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function setupPlanilhaInicial() {
  const sample = sampleDatabase_();
  writeDatabase_(sample);
}

function getDatabase_() {
  const database = {
    meta: readMeta_(),
    musicos: readSheet_('Musicos'),
    funcoes: readSheet_('FuncoesEscala'),
    eventos: readSheet_('Eventos'),
    disponibilidade: readSheet_('Disponibilidade'),
    escala: readSheet_('Escala'),
    historico: readSheet_('Historico')
  };

  if (!database.meta.titlePrefix) {
    database.meta = {
      communityName: 'Comunidade Mundo Novo',
      titlePrefix: 'ESCALA DE SERVIÇO',
      notice: 'A escala poderá sofrer alterações durante o mês.',
      defaultLocation: 'Comunidade Mundo Novo',
      defaultTime: '19:30'
    };
  }

  return database;
}

function writeDatabase_(database) {
  const normalized = normalizeDatabase_(database);
  writeMeta_(normalized.meta);
  writeSheet_('Musicos', normalized.musicos);
  writeSheet_('FuncoesEscala', normalized.funcoes);
  writeSheet_('Eventos', normalized.eventos);
  writeSheet_('Disponibilidade', normalized.disponibilidade);
  writeSheet_('Escala', normalized.escala);
  writeSheet_('Historico', normalized.historico);
}

function readSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = SHEETS[name];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

  return values
    .filter(function(row) {
      return row.some(function(cell) { return cell !== ''; });
    })
    .map(function(row) {
      const item = {};
      headers.forEach(function(header, index) {
        item[header] = normalizeCell_(header, row[index]);
      });
      return item;
    });
}

function writeSheet_(name, rows) {
  const sheet = getOrCreateSheet_(name);
  const headers = SHEETS[name];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (!rows || !rows.length) return;

  const values = rows.map(function(row) {
    return headers.map(function(header) {
      const value = row[header];
      return Array.isArray(value) ? value.join(', ') : value || '';
    });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function readMeta_() {
  const rows = readSheet_('Configuracoes');
  const meta = {};
  rows.forEach(function(row) {
    meta[row.chave] = row.valor;
  });
  return meta;
}

function writeMeta_(meta) {
  const rows = Object.keys(meta || {}).map(function(key) {
    return { chave: key, valor: meta[key] };
  });
  writeSheet_('Configuracoes', rows);
}

function ensureSheets_() {
  Object.keys(SHEETS).forEach(function(name) {
    const sheet = getOrCreateSheet_(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
      sheet.setFrozenRows(1);
    }
  });
}

function getOrCreateSheet_(name) {
  const spreadsheet = SpreadsheetApp.getActive();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function normalizeDatabase_(database) {
  const sample = sampleDatabase_();
  return {
    meta: Object.assign(sample.meta, database.meta || {}),
    musicos: Array.isArray(database.musicos) ? database.musicos : [],
    funcoes: Array.isArray(database.funcoes) ? database.funcoes : [],
    eventos: Array.isArray(database.eventos) ? database.eventos : [],
    disponibilidade: Array.isArray(database.disponibilidade) ? database.disponibilidade : [],
    escala: Array.isArray(database.escala) ? database.escala : [],
    historico: Array.isArray(database.historico) ? database.historico : []
  };
}

function filterDatabaseByMonth_(database, mes, ano) {
  const filtered = JSON.parse(JSON.stringify(database));
  filtered.eventos = database.eventos.filter(function(evento) {
    return dateMatchesMonth_(evento.data_evento, mes, ano);
  });
  const eventIds = filtered.eventos.map(function(evento) { return evento.id_evento; });
  filtered.escala = database.escala.filter(function(item) {
    return eventIds.indexOf(item.id_evento) !== -1;
  });
  filtered.disponibilidade = database.disponibilidade.filter(function(item) {
    return dateMatchesMonth_(item.data, mes, ano);
  });
  return filtered;
}

function filterScaleByMusician_(database, nome, mes, ano) {
  const target = normalizeText_(nome || '');
  return database.escala.filter(function(item) {
    return normalizeText_(item.nome_musico) === target
      && item.status_confirmacao !== 'Substituído'
      && dateMatchesMonth_(item.data_evento, mes, ano);
  });
}

function findScaleItem_(database, idEscala) {
  const item = database.escala.find(function(entry) {
    return entry.id_escala === idEscala;
  });
  if (!item) throw new Error('Registro de escala não encontrado.');
  return item;
}

function addHistory_(database, entry) {
  database.historico.unshift({
    id_historico: makeId_('hist'),
    data_hora: now_(),
    tipo_alteracao: entry.tipo_alteracao || '',
    id_evento: entry.id_evento || '',
    nome_evento: entry.nome_evento || '',
    data_evento: entry.data_evento || '',
    funcao: entry.funcao || '',
    musico_anterior: entry.musico_anterior || '',
    musico_novo: entry.musico_novo || '',
    usuario_responsavel: entry.usuario_responsavel || '',
    observacao: entry.observacao || ''
  });
}

function parsePayload_(event) {
  if (!event.postData || !event.postData.contents) return {};
  return JSON.parse(event.postData.contents);
}

function requireAdmin_(payload) {
  if (!payload || payload.adminKey !== ADMIN_KEY) {
    throw new Error('Chave administrativa inválida.');
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeCell_(header, value) {
  if (value instanceof Date) {
    if (header.indexOf('data_hora') !== -1 || header.indexOf('confirmacao') !== -1 || header === 'criado_em') {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    }
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (header === 'instrumentos') {
    return String(value || '').split(',').map(function(item) {
      return item.trim();
    }).filter(Boolean);
  }
  return value === null || value === undefined ? '' : value;
}

function dateMatchesMonth_(value, mes, ano) {
  const date = parseDate_(value);
  return date.getMonth() + 1 === Number(mes) && date.getFullYear() === Number(ano);
}

function parseDate_(value) {
  if (value instanceof Date) return value;
  const parts = String(value).slice(0, 10).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function makeId_(prefix) {
  return prefix + '-' + Utilities.getUuid();
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function sampleDatabase_() {
  const eventos = fixedEventsForMonth_(7, 2026);

  return {
    meta: {
      communityName: 'Comunidade Mundo Novo',
      titlePrefix: 'ESCALA DE SERVIÇO',
      notice: 'A escala poderá sofrer alterações durante o mês.',
      defaultLocation: 'Comunidade Mundo Novo',
      defaultTime: '19:30'
    },
    musicos: [
      { id_musico: 'mus-maria', nome: 'Maria', telefone: '(00) 90000-0001', email: 'maria@email.com', instrumentos: ['Teclado', 'Voz', 'Adoração'], status: 'Ativo', observacoes: '' },
      { id_musico: 'mus-joao', nome: 'João', telefone: '(00) 90000-0002', email: 'joao@email.com', instrumentos: ['Violão', 'Voz', 'Cenáculo'], status: 'Ativo', observacoes: '' },
      { id_musico: 'mus-pedro', nome: 'Pedro', telefone: '(00) 90000-0003', email: 'pedro@email.com', instrumentos: ['Contra Baixo', 'Baixo'], status: 'Ativo', observacoes: '' },
      { id_musico: 'mus-ana', nome: 'Ana', telefone: '(00) 90000-0004', email: 'ana@email.com', instrumentos: ['Bateria', 'Percussão'], status: 'Ativo', observacoes: '' }
    ],
    funcoes: [
      { id_funcao: 'func-adoracao', nome_funcao: 'Adoração', tipo_funcao: 'Serviço', ordem_exibicao: 1, status: 'Ativo' },
      { id_funcao: 'func-cenaculo', nome_funcao: 'Cenáculo', tipo_funcao: 'Serviço', ordem_exibicao: 2, status: 'Ativo' },
      { id_funcao: 'func-teclado', nome_funcao: 'Teclado', tipo_funcao: 'Instrumento', ordem_exibicao: 3, status: 'Ativo' },
      { id_funcao: 'func-violao', nome_funcao: 'Violão', tipo_funcao: 'Instrumento', ordem_exibicao: 4, status: 'Ativo' },
      { id_funcao: 'func-contra-baixo', nome_funcao: 'Contra Baixo', tipo_funcao: 'Instrumento', ordem_exibicao: 5, status: 'Ativo' },
      { id_funcao: 'func-guitarra', nome_funcao: 'Guitarra', tipo_funcao: 'Instrumento', ordem_exibicao: 6, status: 'Ativo' },
      { id_funcao: 'func-percussao', nome_funcao: 'Percussão', tipo_funcao: 'Instrumento', ordem_exibicao: 7, status: 'Ativo' },
      { id_funcao: 'func-bateria', nome_funcao: 'Bateria', tipo_funcao: 'Instrumento', ordem_exibicao: 8, status: 'Ativo' },
      { id_funcao: 'func-voz-1', nome_funcao: 'Voz 1', tipo_funcao: 'Vocal', ordem_exibicao: 9, status: 'Ativo' },
      { id_funcao: 'func-voz-2', nome_funcao: 'Voz 2', tipo_funcao: 'Vocal', ordem_exibicao: 10, status: 'Ativo' },
      { id_funcao: 'func-voz-3', nome_funcao: 'Voz 3', tipo_funcao: 'Vocal', ordem_exibicao: 11, status: 'Ativo' },
      { id_funcao: 'func-intencoes', nome_funcao: 'Intenções', tipo_funcao: 'Serviço', ordem_exibicao: 12, status: 'Ativo' },
      { id_funcao: 'func-divina-vontade', nome_funcao: 'Divina Vontade', tipo_funcao: 'Serviço', ordem_exibicao: 13, status: 'Ativo' },
      { id_funcao: 'func-liturgia', nome_funcao: 'Liturgia', tipo_funcao: 'Serviço', ordem_exibicao: 14, status: 'Ativo' },
      { id_funcao: 'func-social', nome_funcao: 'Social', tipo_funcao: 'Serviço', ordem_exibicao: 15, status: 'Ativo' }
    ],
    eventos: eventos,
    disponibilidade: [
      { id_disponibilidade: 'disp-1', id_musico: 'mus-pedro', nome_musico: 'Pedro', data: '2026-07-12', disponibilidade: 'Indisponível', observacoes: 'Viagem' }
    ],
    escala: [
      { id_escala: 'esc-1', id_evento: 'ev-2026-07-05-missa-dominical-0800', data_evento: '2026-07-05', nome_evento: 'Missa Dominical', horario: '08:00', id_funcao: 'func-teclado', funcao: 'Teclado', tipo_funcao: 'Instrumento', id_musico: 'mus-maria', nome_musico: 'Maria', status_confirmacao: 'Aguardando confirmação', data_confirmacao: '', observacao_musico: '', status_pendencia: '', substitui_id: '', criado_em: now_() },
      { id_escala: 'esc-2', id_evento: 'ev-2026-07-05-missa-dominical-0800', data_evento: '2026-07-05', nome_evento: 'Missa Dominical', horario: '08:00', id_funcao: 'func-violao', funcao: 'Violão', tipo_funcao: 'Instrumento', id_musico: 'mus-joao', nome_musico: 'João', status_confirmacao: 'Aguardando confirmação', data_confirmacao: '', observacao_musico: '', status_pendencia: '', substitui_id: '', criado_em: now_() },
      { id_escala: 'esc-3', id_evento: 'ev-2026-07-12-missa-dominical-0930', data_evento: '2026-07-12', nome_evento: 'Missa Dominical', horario: '09:30', id_funcao: 'func-contra-baixo', funcao: 'Contra Baixo', tipo_funcao: 'Instrumento', id_musico: 'mus-pedro', nome_musico: 'Pedro', status_confirmacao: 'Não poderá comparecer', data_confirmacao: now_(), observacao_musico: 'Viagem', status_pendencia: 'Pendente de remanejamento', substitui_id: '', criado_em: now_() }
    ],
    historico: [
      { id_historico: 'hist-1', data_hora: now_(), tipo_alteracao: 'Criação de escala', id_evento: 'ev-2026-07-05-missa-dominical-0800', nome_evento: 'Missa Dominical', data_evento: '2026-07-05', funcao: 'Teclado', musico_anterior: '', musico_novo: 'Maria', usuario_responsavel: 'Sistema', observacao: 'Dados iniciais' }
    ]
  };
}

function fixedEventsForMonth_(month, year) {
  const result = [];
  const date = new Date(Number(year), Number(month) - 1, 1);

  while (date.getMonth() === Number(month) - 1) {
    FIXED_EVENT_TEMPLATES
      .filter(function(template) {
        return date.getDay() === template.weekday;
      })
      .forEach(function(template) {
        const iso = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        result.push({
          id_evento: 'ev-' + iso + '-' + template.key,
          nome_evento: template.nome_evento,
          data_evento: iso,
          dia_semana: weekdayName_(date),
          horario: template.horario,
          local: 'Comunidade Mundo Novo',
          status: 'Ativo',
          observacoes: ''
        });
      });
    date.setDate(date.getDate() + 1);
  }

  return result;
}

function weekdayName_(date) {
  return ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][date.getDay()];
}
