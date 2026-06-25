const ADMIN_KEY = 'troque-esta-chave';
const SHEET_NAME = 'EscalaApp';

function doGet() {
  return jsonResponse(loadSchedule_());
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents);

  if (payload.key !== ADMIN_KEY) {
    return jsonResponse({ error: 'Chave administrativa inválida.' }, 403);
  }

  saveSchedule_(payload.schedule);
  return jsonResponse({ ok: true });
}

function loadSchedule_() {
  const sheet = getSheet_();
  const raw = sheet.getRange('A1').getValue();

  if (!raw) {
    return {
      title: 'Escala Banda MN',
      notice: 'A escala poderá sofrer alterações no decorrer do mês.',
      notes: '',
      instruments: ['Baixo', 'Batera', 'Violão', 'Guitarra', 'Teclado'],
      events: [],
      members: {}
    };
  }

  return JSON.parse(raw);
}

function saveSchedule_(schedule) {
  const sheet = getSheet_();
  sheet.getRange('A1').setValue(JSON.stringify(schedule));
  sheet.getRange('A2').setValue(new Date());
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.hideSheet();
  }

  return sheet;
}

function jsonResponse(payload, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

  if (statusCode) {
    output.setContent(JSON.stringify({ statusCode, ...payload }));
  }

  return output;
}
