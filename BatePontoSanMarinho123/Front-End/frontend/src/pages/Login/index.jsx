import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import { api } from "../../services/api";

import "./login.css";

/* =========================================================
   LOGIN
========================================================= */

export default function Login() {
  const navigate =
    useNavigate();

  /* =======================================================
     ESTADOS
  ======================================================= */

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  /* =======================================================
     AO ENTRAR NA TELA DE LOGIN

     Remove dados de uma sessão anterior.

     Isso é importante no multiempresa para impedir que
     a identidade visual da empresa anterior permaneça.
  ======================================================= */

  useEffect(() => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "usuario"
    );

    localStorage.removeItem(
      "empresa"
    );

    localStorage.removeItem(
      "identidade_empresa"
    );
  }, []);

  /* =======================================================
     LOGIN
  ======================================================= */

  async function handleLogin(
    event
  ) {
    event.preventDefault();

    setErro("");

    /* =====================================================
       VALIDAR CAMPOS
    ===================================================== */

    if (
      !username.trim() ||
      !password
    ) {
      setErro(
        "Informe o usuário e a senha."
      );

      return;
    }

    try {
      setLoading(true);

      /* ===================================================
         CHAMAR BACKEND
      =================================================== */

      const {
        data,
      } = await api.post(
        "/auth/login",
        {
          username:
            username.trim(),

          password,
        }
      );

      console.log(
        "========================================"
      );

      console.log(
        "🔐 RESPOSTA DO LOGIN:",
        data
      );

      console.log(
        "👤 USUÁRIO:",
        data?.usuario
      );

      console.log(
        "🏢 EMPRESA:",
        data?.empresa
      );

      console.log(
        "========================================"
      );

      /* ===================================================
         TOKEN
      =================================================== */

      if (!data?.token) {
        throw new Error(
          "O servidor não retornou o token de acesso."
        );
      }

      localStorage.setItem(
        "token",
        data.token
      );

      /* ===================================================
         USUÁRIO
      =================================================== */

      if (data?.usuario) {
        localStorage.setItem(
          "usuario",
          JSON.stringify(
            data.usuario
          )
        );
      } else {
        localStorage.removeItem(
          "usuario"
        );
      }

      /* ===================================================
         EMPRESA

         Essa é a parte mais importante para logo/fundo.

         Backend retorna:

         empresa: {
           id,
           nome,
           cor_primaria,
           cor_secundaria,
           logo_url,
           fundo_url
         }
      =================================================== */

      if (data?.empresa) {
        const empresa = {
          ...data.empresa,

          id:
            data.empresa.id ||
            data.usuario?.empresa_id ||
            null,

          empresa_id:
            data.empresa.id ||
            data.usuario?.empresa_id ||
            null,

          nome:
            data.empresa.nome ||
            data.usuario?.empresa_nome ||
            "Empresa",

          cor_primaria:
            data.empresa.cor_primaria ||
            "#0d6efd",

          cor_secundaria:
            data.empresa.cor_secundaria ||
            "#084298",

          logo_url:
            data.empresa.logo_url ||
            null,

          fundo_url:
            data.empresa.fundo_url ||
            data.empresa
              .dashboard_background_url ||
            null,
        };

        /* ===============================================
           SALVAR DAS DUAS FORMAS

           Isso deixa compatível com componentes antigos
           e novos.
        =============================================== */

        localStorage.setItem(
          "empresa",
          JSON.stringify(
            empresa
          )
        );

        localStorage.setItem(
          "identidade_empresa",
          JSON.stringify(
            empresa
          )
        );

        console.log(
          "🏢 EMPRESA SALVA:",
          empresa
        );

        console.log(
          "🖼 LOGO:",
          empresa.logo_url
        );

        console.log(
          "🌄 FUNDO:",
          empresa.fundo_url
        );
      } else {
        /*
          Super Admin não possui empresa.
        */

        localStorage.removeItem(
          "empresa"
        );

        localStorage.removeItem(
          "identidade_empresa"
        );
      }

      /* ===================================================
         REDIRECIONAMENTO
      =================================================== */

      const redirect =
        data?.redirect ||
        "/";

      console.log(
        "➡️ REDIRECIONANDO PARA:",
        redirect
      );

      navigate(
        redirect,
        {
          replace: true,
        }
      );

    } catch (error) {
      console.error(
        "❌ Erro no login:",
        error
      );

      const mensagem =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Não foi possível realizar o login.";

      setErro(
        mensagem
      );

    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     ENTER
  ======================================================= */

  function handleKeyDown(
    event
  ) {
    if (
      event.key === "Enter" &&
      !loading
    ) {
      /*
        O formulário já executará submit.
        Não precisamos chamar handleLogin manualmente.
      */
    }
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div
      className="loginScreen"
    >
      <div
        className="loginCard"
      >

        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          className="loginHeader"
        >
          <h1>
            SPRF
          </h1>

          <p>
            Sistema de Ponto com
            Reconhecimento Facial
          </p>
        </div>

        {/* =================================================
            FORMULÁRIO
        ================================================= */}

        <form
          className="loginForm"
          onSubmit={
            handleLogin
          }
        >

          {/* ===============================================
              USUÁRIO
          =============================================== */}

          <div
            className="loginField"
          >
            <label
              htmlFor="username"
            >
              Usuário
            </label>

            <input
              id="username"
              type="text"
              value={
                username
              }
              onChange={(
                event
              ) =>
                setUsername(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder="Digite seu usuário"
              autoComplete="username"
              disabled={
                loading
              }
            />
          </div>

          {/* ===============================================
              SENHA
          =============================================== */}

          <div
            className="loginField"
          >
            <label
              htmlFor="password"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              value={
                password
              }
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={
                loading
              }
            />
          </div>

          {/* ===============================================
              ERRO
          =============================================== */}

          {erro && (
            <div
              className="loginError"
            >
              {erro}
            </div>
          )}

          {/* ===============================================
              ENTRAR
          =============================================== */}

          <button
            type="submit"
            className="loginButton"
            disabled={
              loading
            }
          >
            {loading
              ? "Entrando..."
              : "Entrar"}
          </button>

        </form>

      </div>
    </div>
  );
}