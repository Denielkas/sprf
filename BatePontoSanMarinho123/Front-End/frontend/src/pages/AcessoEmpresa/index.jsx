import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaEye,
  FaEyeSlash,
  FaBuilding,
  FaUserShield,
} from "react-icons/fa";

import { api } from "../../services/api";

import logoPadrao from "../../assets/logo/Hotel-Sam-Marinho.png";
import fundoPadrao from "../../assets/logo/hotel-fundo.jpg";

import "./acessoEmpresa.css";

/* =========================================================
   NORMALIZAR URL
========================================================= */

function normalizarUrl(url) {
  if (!url) {
    return null;
  }

  const valor = String(url).trim();

  if (!valor) {
    return null;
  }

  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://") ||
    valor.startsWith("data:") ||
    valor.startsWith("blob:")
  ) {
    return valor;
  }

  if (valor.startsWith("/")) {
    return valor;
  }

  return `/${valor}`;
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function AcessoEmpresa() {
  const navigate = useNavigate();

  /* =========================================================
     FORMULÁRIO
  ========================================================= */

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  /* =========================================================
     ESTADOS
  ========================================================= */

  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");

  const [erro, setErro] = useState(false);

  /* =========================================================
     LIMPAR SESSÃO ANTERIOR
  ========================================================= */

  function limparSessaoAnterior() {
    localStorage.removeItem("token");

    localStorage.removeItem("usuario");

    localStorage.removeItem("role");

    localStorage.removeItem("empresa_id");

    localStorage.removeItem("empresa_nome");

    localStorage.removeItem(
      "identidade_empresa"
    );
  }

  /* =========================================================
     SALVAR IDENTIDADE DA EMPRESA
  ========================================================= */

  function salvarDadosEmpresa(
    empresa,
    usuario
  ) {
    /* =======================================================
       ID
    ======================================================= */

    const empresaId =
      empresa?.id ||
      usuario?.empresa_id;

    if (!empresaId) {
      throw new Error(
        "ID da empresa não encontrado."
      );
    }

    /* =======================================================
       NOME
    ======================================================= */

    const nome =
      empresa?.nome_fantasia ||
      empresa?.nome ||
      empresa?.razao_social ||
      usuario?.empresa_nome ||
      "Empresa";

    /* =======================================================
       LOGO

       O backend do login deve retornar:

       /api/empresas/ID/logo
    ======================================================= */

    let logoUrl =
      normalizarUrl(
        empresa?.logo_url
      );

    /*
      Caso o backend tenha retornado o nome do arquivo,
      mas não tenha retornado logo_url, montamos a rota.
    */

    if (
      !logoUrl &&
      empresa?.logo_arquivo
    ) {
      logoUrl =
        `/api/empresas/${empresaId}/logo`;
    }

    /* =======================================================
       FUNDO
    ======================================================= */

    let fundoUrl =
      normalizarUrl(
        empresa?.fundo_url ||
        empresa?.dashboard_background_url
      );

    if (
      !fundoUrl &&
      empresa?.fundo_arquivo
    ) {
      fundoUrl =
        `/api/empresas/${empresaId}/fundo`;
    }

    /* =======================================================
       IDENTIDADE
    ======================================================= */

    const identidade = {
      id:
        Number(
          empresaId
        ),

      nome,

      razao_social:
        empresa?.razao_social ||
        empresa?.nome ||
        null,

      nome_fantasia:
        empresa?.nome_fantasia ||
        nome,

      cor_primaria:
        empresa?.cor_primaria ||
        "#0d6efd",

      cor_secundaria:
        empresa?.cor_secundaria ||
        "#084298",

      logo_arquivo:
        empresa?.logo_arquivo ||
        null,

      fundo_arquivo:
        empresa?.fundo_arquivo ||
        null,

      logo_url:
        logoUrl,

      fundo_url:
        fundoUrl,

      dashboard_background_url:
        fundoUrl,
    };

    /* =======================================================
       SALVAR ID
    ======================================================= */

    localStorage.setItem(
      "empresa_id",
      String(
        empresaId
      )
    );

    /* =======================================================
       SALVAR NOME
    ======================================================= */

    localStorage.setItem(
      "empresa_nome",
      nome
    );

    /* =======================================================
       SALVAR IDENTIDADE COMPLETA
    ======================================================= */

    localStorage.setItem(
      "identidade_empresa",
      JSON.stringify(
        identidade
      )
    );

    /* =======================================================
       DEBUG
    ======================================================= */

    console.log(
      "=========================================="
    );

    console.log(
      "🏢 EMPRESA RECEBIDA:",
      empresa
    );

    console.log(
      "👤 USUÁRIO:",
      usuario
    );

    console.log(
      "💾 IDENTIDADE SALVA:",
      identidade
    );

    console.log(
      "🖼 LOGO:",
      identidade.logo_url
    );

    console.log(
      "🌄 FUNDO:",
      identidade.fundo_url
    );

    console.log(
      "=========================================="
    );

    return identidade;
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  async function onSubmit(e) {
    e.preventDefault();

    if (loading) {
      return;
    }

    /* =======================================================
       VALIDAR
    ======================================================= */

    if (
      !username.trim() ||
      !password
    ) {
      setErro(true);

      setMsg(
        "Informe usuário e senha."
      );

      return;
    }

    setLoading(true);

    setErro(false);

    setMsg(
      "Identificando acesso..."
    );

    try {
      /* =====================================================
         FAZER LOGIN
      ===================================================== */

      const resposta =
        await api.post(
          "/auth/login",
          {
            username:
              username.trim(),

            password,
          }
        );

      const data =
        resposta.data;

      /* =====================================================
         DEBUG DA RESPOSTA
      ===================================================== */

      console.log(
        "=========================================="
      );

      console.log(
        "🔐 RESPOSTA COMPLETA DO LOGIN:"
      );

      console.log(
        data
      );

      console.log(
        "👤 USUÁRIO:"
      );

      console.log(
        data?.usuario
      );

      console.log(
        "🏢 EMPRESA:"
      );

      console.log(
        data?.empresa
      );

      console.log(
        "=========================================="
      );

      /* =====================================================
         VALIDAR RESPOSTA
      ===================================================== */

      if (
        !data?.token
      ) {
        throw new Error(
          "Token não recebido pelo servidor."
        );
      }

      if (
        !data?.usuario
      ) {
        throw new Error(
          "Dados do usuário não recebidos."
        );
      }

      /* =====================================================
         LIMPAR SESSÃO ANTIGA

         Isso é muito importante em multiempresa.

         Se entrar Empresa A e depois Empresa B,
         não podemos deixar logo/fundo da Empresa A.
      ===================================================== */

      limparSessaoAnterior();

      /* =====================================================
         TOKEN
      ===================================================== */

      localStorage.setItem(
        "token",
        data.token
      );

      /* =====================================================
         USUÁRIO
      ===================================================== */

      localStorage.setItem(
        "usuario",
        JSON.stringify(
          data.usuario
        )
      );

      /* =====================================================
         ROLE
      ===================================================== */

      localStorage.setItem(
        "role",
        data.usuario.role
      );

      /* =====================================================
         SUPER ADMIN
      ===================================================== */

      if (
        data.usuario.role ===
        "super_admin"
      ) {
        /*
          Super Admin não pertence
          a nenhuma empresa.
        */

        localStorage.removeItem(
          "empresa_id"
        );

        localStorage.removeItem(
          "empresa_nome"
        );

        localStorage.removeItem(
          "identidade_empresa"
        );

        setMsg(
          "Acesso administrativo realizado."
        );

        navigate(
          data.redirect ||
          "/app/empresas",
          {
            replace: true,
          }
        );

        return;
      }

      /* =====================================================
         VALIDAR EMPRESA
      ===================================================== */

      const empresaId =
        data?.empresa?.id ||
        data?.usuario?.empresa_id;

      if (!empresaId) {
        throw new Error(
          "Este usuário não possui empresa vinculada."
        );
      }

      /* =====================================================
         MONTAR EMPRESA

         IMPORTANTE:

         NÃO fazemos mais:

         GET /empresas/:id

         O próprio login já deve trazer os dados da empresa.
      ===================================================== */

      const empresa = {
        ...(data.empresa || {}),

        id:
          data?.empresa?.id ||
          data?.usuario?.empresa_id,

        nome:
          data?.empresa?.nome ||
          data?.usuario?.empresa_nome ||
          "Empresa",
      };

      /* =====================================================
         SALVAR IDENTIDADE

         É aqui que ficam:

         logo_url
         fundo_url
         cores
         empresa_id
      ===================================================== */

      const identidade =
        salvarDadosEmpresa(
          empresa,
          data.usuario
        );

      /* =====================================================
         CONFERIR O QUE FOI SALVO
      ===================================================== */

      console.log(
        "IDENTIDADE FINAL:",
        identidade
      );

      console.log(
        "LOCAL STORAGE:",
        localStorage.getItem(
          "identidade_empresa"
        )
      );

      /* =====================================================
         RH
      ===================================================== */

      if (
        data.usuario.role ===
        "rh_empresa"
      ) {
        setMsg(
          "Acesso RH realizado."
        );

        navigate(
          data.redirect ||
          "/app/registrar-funcionario",
          {
            replace: true,
          }
        );

        return;
      }

      /* =====================================================
         TERMINAL DE PONTO
      ===================================================== */

      if (
        data.usuario.role ===
        "ponto_empresa"
      ) {
        setMsg(
          "Terminal de ponto identificado."
        );

        navigate(
          data.redirect ||
          "/ponto",
          {
            replace: true,
          }
        );

        return;
      }

      /* =====================================================
         ROLE ANTIGA
      ===================================================== */

      if (
        data.usuario.role ===
        "admin_empresa"
      ) {
        throw new Error(
          "Este usuário ainda utiliza o tipo antigo admin_empresa."
        );
      }

      /* =====================================================
         ROLE INVÁLIDA
      ===================================================== */

      throw new Error(
        "Tipo de usuário não reconhecido."
      );

    } catch (err) {
      console.error(
        "Erro no acesso:",
        err
      );

      /* =====================================================
         SE LOGIN FALHAR, LIMPAR TUDO
      ===================================================== */

      limparSessaoAnterior();

      const mensagem =
        err.response
          ?.data
          ?.error ||
        err.message ||
        "Não foi possível realizar o acesso.";

      setErro(true);

      setMsg(
        mensagem
      );

    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div
      className="acessoEmpresaScreen"

      style={{
        backgroundImage: `
          linear-gradient(
            rgba(0, 0, 0, 0.62),
            rgba(0, 0, 0, 0.72)
          ),
          url("${fundoPadrao}")
        `,
      }}
    >

      <div className="acessoEmpresaCard">

        {/* =================================================
            LOGO PADRÃO DO SISTEMA

            Aqui ainda é a tela de LOGIN.

            Portanto mostramos a logo padrão.

            A logo da EMPRESA aparecerá depois que
            o usuário ponto_empresa entrar.
        ================================================= */}

        <div className="acessoEmpresaLogoArea">

          <img
            src={logoPadrao}

            alt="Sistema de Ponto"

            className="acessoEmpresaLogo"
          />

        </div>

        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div className="acessoEmpresaHeader">

          <div className="acessoEmpresaIcon">
            <FaBuilding />
          </div>

          <h1>
            Sistema de Ponto
          </h1>

          <p>
            Informe seu usuário e senha
            para acessar o sistema.
          </p>

        </div>

        {/* =================================================
            FORMULÁRIO
        ================================================= */}

        <form
          className="acessoEmpresaForm"

          onSubmit={
            onSubmit
          }
        >

          {/* =================================================
              USUÁRIO
          ================================================= */}

          <div className="acessoEmpresaGroup">

            <label>
              Usuário
            </label>

            <input
              type="text"

              value={
                username
              }

              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }

              placeholder="Digite seu usuário"

              autoComplete="username"

              required

              disabled={
                loading
              }
            />

          </div>

          {/* =================================================
              SENHA
          ================================================= */}

          <div className="acessoEmpresaGroup">

            <label>
              Senha
            </label>

            <div className="acessoSenhaWrapper">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }

                value={
                  password
                }

                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }

                placeholder="Digite sua senha"

                autoComplete="current-password"

                required

                disabled={
                  loading
                }
              />

              <button
                type="button"

                className="acessoEyeButton"

                onClick={() =>
                  setShowPassword(
                    (valor) =>
                      !valor
                  )
                }

                aria-label={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >

                {showPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}

              </button>

            </div>

          </div>

          {/* =================================================
              BOTÃO ENTRAR
          ================================================= */}

          <button
            type="submit"

            className="acessoEmpresaButton"

            disabled={
              loading
            }
          >
            {loading
              ? "Entrando..."
              : "Entrar"}
          </button>

          {/* =================================================
              MENSAGEM
          ================================================= */}

          {msg && (
            <div
              className={`acessoEmpresaMsg ${
                erro
                  ? "acessoEmpresaMsgErro"
                  : ""
              }`}
            >
              {msg}
            </div>
          )}

        </form>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div className="acessoEmpresaFooter">

          <FaUserShield />

          <span>
            Acesso seguro ao sistema
          </span>

        </div>

      </div>

    </div>
  );
}