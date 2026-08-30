import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaEye,
  FaEyeSlash,
  FaUserShield,
  FaInstagram,
  FaWhatsapp,
} from "react-icons/fa";

import { api } from "../../services/api";

import logoPadrao from "../../assets/logo/logotipo2.png";

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
     LEMBRAR LOGIN
  ========================================================= */

  const [
    lembrarUsuario,
    setLembrarUsuario,
  ] = useState(() => {
    return (
      localStorage.getItem("lembrar_login") === "true"
    );
  });


  /* =========================================================
     USUÁRIO
  ========================================================= */

  const [
    username,
    setUsername,
  ] = useState(() => {
    const lembrar =
      localStorage.getItem("lembrar_login") === "true";

    if (!lembrar) {
      return "";
    }

    return (
      localStorage.getItem("ultimo_usuario") || ""
    );
  });


  /* =========================================================
     SENHA
  ========================================================= */

  const [
    password,
    setPassword,
  ] = useState("");


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  /* =========================================================
     ESTADOS
  ========================================================= */

  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    msg,
    setMsg,
  ] = useState("");


  const [
    erro,
    setErro,
  ] = useState(false);


  /* =========================================================
     LIMPAR SESSÃO ANTERIOR
  ========================================================= */

  function limparSessaoAnterior() {
    localStorage.removeItem("token");

    localStorage.removeItem("usuario");

    localStorage.removeItem("role");

    localStorage.removeItem("empresa_id");

    localStorage.removeItem("empresa_nome");

    localStorage.removeItem("identidade_empresa");
  }


  /* =========================================================
     SALVAR / REMOVER USUÁRIO LEMBRADO
  ========================================================= */

  function salvarUsuarioLembrado(usuario) {
    if (lembrarUsuario) {
      localStorage.setItem(
        "lembrar_login",
        "true"
      );

      localStorage.setItem(
        "ultimo_usuario",
        usuario.trim()
      );

      return;
    }

    localStorage.removeItem(
      "lembrar_login"
    );

    localStorage.removeItem(
      "ultimo_usuario"
    );
  }


  /* =========================================================
     ALTERAR LEMBRAR USUÁRIO
  ========================================================= */

  function alterarLembrarUsuario(marcado) {
    setLembrarUsuario(marcado);

    if (!marcado) {
      localStorage.removeItem(
        "lembrar_login"
      );

      localStorage.removeItem(
        "ultimo_usuario"
      );
    }
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
    ======================================================= */

    let logoUrl =
      normalizarUrl(
        empresa?.logo_url
      );


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
      id: Number(empresaId),

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
      String(empresaId)
    );


    /* =======================================================
       SALVAR NOME
    ======================================================= */

    localStorage.setItem(
      "empresa_nome",
      nome
    );


    /* =======================================================
       SALVAR IDENTIDADE
    ======================================================= */

    localStorage.setItem(
      "identidade_empresa",
      JSON.stringify(identidade)
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
         DEBUG
      ===================================================== */

      console.log(
        "=========================================="
      );

      console.log(
        "🔐 RESPOSTA COMPLETA DO LOGIN:"
      );

      console.log(data);

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

      if (!data?.token) {
        throw new Error(
          "Token não recebido pelo servidor."
        );
      }


      if (!data?.usuario) {
        throw new Error(
          "Dados do usuário não recebidos."
        );
      }


      /* =====================================================
         SALVAR USUÁRIO LEMBRADO
      ===================================================== */

      salvarUsuarioLembrado(
        username
      );


      /* =====================================================
         LIMPAR SESSÃO ANTIGA
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
      ===================================================== */

      const identidade =
        salvarDadosEmpresa(
          empresa,
          data.usuario
        );


      /* =====================================================
         CONFERIR
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


      limparSessaoAnterior();


      const mensagem =
        err.response
          ?.data
          ?.error ||
        err.message ||
        "Não foi possível realizar o acesso.";


      setErro(true);

      setMsg(mensagem);

    } finally {

      setLoading(false);

    }
  }


  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div className="acessoEmpresaScreen">


      {/* =====================================================
          EFEITOS DECORATIVOS
      ===================================================== */}

      <div
        className="
          acessoEmpresaGlow
          acessoEmpresaGlow1
        "
      />

      <div
        className="
          acessoEmpresaGlow
          acessoEmpresaGlow2
        "
      />


      {/* =====================================================
          CARD
      ===================================================== */}

      <div className="acessoEmpresaCard">


        {/* =================================================
            LOGO
        ================================================= */}

        <div className="acessoEmpresaLogoArea">

          <img
            src={logoPadrao}
            alt="DEK Engenharia de Software"
            className="acessoEmpresaLogo"
          />

        </div>


        {/* =================================================
            TEXTO
        ================================================= */}

        <div className="acessoEmpresaHeader">

          <p>
            Acesse sua conta para continuar
          </p>

        </div>


        {/* =================================================
            FORMULÁRIO
        ================================================= */}

        <form
          className="acessoEmpresaForm"
          onSubmit={onSubmit}
          autoComplete="off"
        >


          {/* =================================================
              USUÁRIO
          ================================================= */}

          <div className="acessoFloatingGroup">

            <input
              id="acesso-usuario"
              type="text"
              name="usuario_sistema"

              value={username}

              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }

              placeholder=" "

              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"

              required

              disabled={loading}
            />


            <label
              htmlFor="acesso-usuario"
            >
              Usuário
            </label>

          </div>


          {/* =================================================
              SENHA
          ================================================= */}

          <div
            className="
              acessoFloatingGroup
              acessoSenhaWrapper
            "
          >

            <input
              id="acesso-senha"

              type={
                showPassword
                  ? "text"
                  : "password"
              }

              name="senha_sistema"

              value={password}

              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }

              placeholder=" "

              autoComplete="new-password"

              required

              disabled={loading}
            />


            <label
              htmlFor="acesso-senha"
            >
              Senha
            </label>


            <button
              type="button"

              className="acessoEyeButton"

              onClick={() =>
                setShowPassword(
                  (valor) => !valor
                )
              }

              aria-label={
                showPassword
                  ? "Ocultar senha"
                  : "Mostrar senha"
              }

              tabIndex="-1"
            >

              {showPassword ? (
                <FaEyeSlash />
              ) : (
                <FaEye />
              )}

            </button>

          </div>


          {/* =================================================
              LEMBRAR USUÁRIO
          ================================================= */}

          <label className="acessoLembrar">

            <input
              type="checkbox"

              checked={lembrarUsuario}

              onChange={(e) =>
                alterarLembrarUsuario(
                  e.target.checked
                )
              }
            />


            <span
              className="acessoLembrarCheck"
            />


            <span className="acessoLembrarTexto">
              Lembrar meu usuário neste dispositivo
            </span>

          </label>


          {/* =================================================
              BOTÃO
          ================================================= */}

          <button
            type="submit"
            className="acessoEmpresaButton"
            disabled={loading}
          >

            <span>
              {loading
                ? "Entrando..."
                : "Entrar"}
            </span>

          </button>


          {/* =================================================
              MENSAGEM
          ================================================= */}

          {msg && (
            <div
              className={`acessoEmpresaMsg ${erro
                  ? "acessoEmpresaMsgErro"
                  : ""
                }`}
            >
              {msg}
            </div>
          )}

        </form>


        {/* =================================================
            ACESSO SEGURO
            CONTINUA DENTRO DO CARD
        ================================================= */}

        <div className="acessoEmpresaFooter">

          <div className="acessoEmpresaSeguranca">

            <FaUserShield />

            <span>
              Acesso seguro ao sistema
            </span>

          </div>

        </div>

      </div>


      {/* =====================================================
    RODAPÉ PROFISSIONAL DA PÁGINA
===================================================== */}

      <footer className="acessoRodapePagina">

        <div className="acessoRodapeConteudo">

          {/* MARCA */}

          <div className="acessoRodapeMarca">
            <span className="acessoRodapeCopyright">
              © 2026
            </span>

            <span className="acessoRodapeSeparador" />

            <span className="acessoRodapeNome">
              DEK Engenharia de Software
            </span>
          </div>


          {/* REDES SOCIAIS */}

          <div className="acessoRodapeRedes">

            <a
              href="https://www.instagram.com/dek_sistemas/"
              target="_blank"
              rel="noopener noreferrer"
              className="acessoRodapeSocial"
              aria-label="Instagram da DEK"
              title="Instagram"
            >
              <FaInstagram />
            </a>


            <a
              href="https://wa.me/5542984084929"
              target="_blank"
              rel="noopener noreferrer"
              className="acessoRodapeSocial"
              aria-label="WhatsApp da DEK"
              title="WhatsApp"
            >
              <FaWhatsapp />
            </a>

          </div>

        </div>

      </footer>

    </div>
  );
}