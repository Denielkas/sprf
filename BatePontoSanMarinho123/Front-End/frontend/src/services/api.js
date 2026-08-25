import axios from "axios";

/* =========================================================
   INSTÂNCIA PRINCIPAL DA API
========================================================= */

export const api = axios.create({
  baseURL: "/api",
  timeout: 15000,

  headers: {
    Accept: "application/json",
  },
});

/* =========================================================
   INTERCEPTOR DE REQUISIÇÃO

   Envia automaticamente o token do usuário logado.

   O backend usa esse token para identificar:
   - Super Admin
   - Admin da empresa
   - Empresa vinculada ao usuário
========================================================= */

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token");

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    /*
      IMPORTANTE:

      Não definimos Content-Type globalmente.

      Para JSON, o Axios configura automaticamente.

      Para upload com FormData, o navegador configura:
      multipart/form-data + boundary

      Isso é necessário para:
      POST /empresas/:id/imagens
    */

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);

/* =========================================================
   INTERCEPTOR DE RESPOSTA
========================================================= */

api.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    /*
      Token inválido ou expirado.

      Não fazemos redirecionamento automático aqui,
      porque existem telas públicas no sistema,
      como reconhecimento e consulta de pontos.
    */

    if (error.response?.status === 401) {
      console.warn(
        "Sessão inválida ou token expirado."
      );
    }

    if (error.response?.status === 403) {
      console.warn(
        "Usuário sem permissão para esta operação."
      );
    }

    return Promise.reject(error);
  }
);