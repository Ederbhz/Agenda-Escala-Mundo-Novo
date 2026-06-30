export const APP_CONFIG = {
  // Cole aqui a URL do Web App do Google Apps Script depois de publicar a API.
  API_URL: "",

  // Cole aqui a mesma chave definida em ADMIN_KEY no arquivo apps-script/Code.gs.
  ADMIN_KEY: "",

  LOCAL_STORAGE_KEY: "mn-escala-database-v2",
  CONFIG_STORAGE_KEY: "mn-escala-config-v2",
  ADMIN_SESSION_KEY: "mn-escala-admin-session-v2",

  // Hash SHA-256 da senha inicial dos coordenadores de exemplo: "mundo-novo".
  // Depois do primeiro acesso, altere as senhas pela aba Coordenadores.
  DEFAULT_COORDINATOR_PASSWORD_HASH: "750f50616b51d2efdce3430110a15e03adbb6be3be1e005c2d499b9eb55f4d3b",

  // Mantido apenas como fallback de migração para bases antigas.
  DEFAULT_ADMIN_PASSWORD: "mundo-novo",
  DEFAULT_COORDINATOR_NAME: "Coordenador",
};
