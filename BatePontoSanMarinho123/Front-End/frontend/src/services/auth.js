/* =========================================================
   CHAVES DO LOCALSTORAGE
========================================================= */

export const TOKEN_KEY = "token";
export const USUARIO_KEY = "usuario";
export const COLAB_TOKEN_KEY = "colab_token";

/* =========================================================
   TOKEN PRINCIPAL

   Usado por:
   - super_admin
   - rh_empresa
   - ponto_empresa
========================================================= */

export const setToken = (token) => {
  if (!token) return;

  localStorage.setItem(
    TOKEN_KEY,
    token
  );
};

export const getToken = () => {
  return localStorage.getItem(
    TOKEN_KEY
  );
};

export const clearToken = () => {
  localStorage.removeItem(
    TOKEN_KEY
  );
};

/* =========================================================
   USUÁRIO LOGADO

   Guarda:
   - id
   - username
   - role
   - empresa_id
   - empresa_nome
========================================================= */

export const setUsuario = (usuario) => {
  if (!usuario) return;

  localStorage.setItem(
    USUARIO_KEY,
    JSON.stringify(usuario)
  );
};

export const getUsuario = () => {
  try {
    const usuario =
      localStorage.getItem(
        USUARIO_KEY
      );

    if (!usuario) {
      return null;
    }

    return JSON.parse(usuario);
  } catch (error) {
    console.error(
      "Erro ao carregar usuário:",
      error
    );

    return null;
  }
};

export const clearUsuario = () => {
  localStorage.removeItem(
    USUARIO_KEY
  );
};

/* =========================================================
   TOKEN DO COLABORADOR

   Mantido caso alguma parte antiga do sistema ainda utilize.
========================================================= */

export const setColabToken = (token) => {
  if (!token) return;

  localStorage.setItem(
    COLAB_TOKEN_KEY,
    token
  );
};

export const getColabToken = () => {
  return localStorage.getItem(
    COLAB_TOKEN_KEY
  );
};

export const clearColabToken = () => {
  localStorage.removeItem(
    COLAB_TOKEN_KEY
  );
};

/* =========================================================
   LIMPAR SESSÃO COMPLETA
========================================================= */

export const clearSession = () => {
  localStorage.removeItem(
    TOKEN_KEY
  );

  localStorage.removeItem(
    USUARIO_KEY
  );

  localStorage.removeItem(
    COLAB_TOKEN_KEY
  );

  localStorage.removeItem(
    "identidade_empresa"
  );
};