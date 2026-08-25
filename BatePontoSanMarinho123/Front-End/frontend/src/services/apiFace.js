import axios from "axios";

/* =========================================================
   API DO RECONHECIMENTO FACIAL

   Front-end:
   /apiFace

   Vite encaminha para:
   http://127.0.0.1:8000

   Exemplo:
   /apiFace/enroll
   vira
   http://127.0.0.1:8000/enroll
========================================================= */

export const apiFace = axios.create({
  baseURL: "/apiFace",

  timeout: 30000,

  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================================================
   TRATAMENTO DE RESPOSTA
========================================================= */

apiFace.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    console.error(
      "Erro na API facial:",
      error.response?.data ||
        error.message
    );

    return Promise.reject(error);
  }
);

export default apiFace;