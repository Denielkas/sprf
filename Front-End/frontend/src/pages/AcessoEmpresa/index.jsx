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

export default function AcessoEmpresa() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [msg, setMsg] =
    useState("");

  const [erro, setErro] =
    useState(false);

  /* =========================================================
     LIMPAR SESSÃO ANTERIOR
  ========================================================= */

  const limparSessaoAnterior = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("role");

    localStorage.removeItem("empresa_id");
    localStorage.removeItem("empresa_nome");

    localStorage.removeItem(
      "identidade_empresa"
    );
  };

  /* =========================================================
     MONTAR IDENTIDADE DA EMPRESA

     Por enquanto usamos os dados que o login já devolve.

     Depois vamos carregar cores/logo/fundo diretamente
     da configuração da empresa.
  ========================================================= */

  const salvarIdentidadeEmpresa = (
    usuario
  ) => {
    if (!usuario?.empresa_id) {
      return;
    }

    const empresaId =
      usuario.empresa_id;

    const identidade = {
      id: empresaId,

      nome:
        usuario.empresa_nome ||
        "Empresa",

      nome_fantasia:
        usuario.empresa_nome ||
        "Empresa",

      /*
        As URLs abaixo usam as rotas que
        já criamos no backend.
      */

      logo_url:
        `/api/empresas/${empresaId}/logo`,

      fundo_url:
        `/api/empresas/${empresaId}/fundo`,

      dashboard_background_url:
        `/api/empresas/${empresaId}/fundo`,

      /*
        Enquanto ainda não buscamos as cores
        do backend, usamos azul como fallback.
      */

      cor_primaria:
        "#0d6efd",

      cor_secundaria:
        "#084298",
    };

    localStorage.setItem(
      "identidade_empresa",
      JSON.stringify(identidade)
    );
  };

  /* =========================================================
     LOGIN
  ========================================================= */

  const onSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErro(false);
    setMsg("Identificando acesso...");

    try {
      /*
        Usa o login que seu backend
        já possui.
      */

      const { data } =
        await api.post(
          "/auth/login",
          {
            username:
              username.trim(),

            password,
          }
        );

      if (
        !data?.token ||
        !data?.usuario
      ) {
        throw new Error(
          "Resposta de login inválida."
        );
      }

      /* =====================================
         LIMPAR LOGIN ANTERIOR
      ===================================== */

      limparSessaoAnterior();

      /* =====================================
         SALVAR TOKEN
      ===================================== */

      localStorage.setItem(
        "token",
        data.token
      );

      /* =====================================
         SALVAR USUÁRIO
      ===================================== */

      localStorage.setItem(
        "usuario",
        JSON.stringify(
          data.usuario
        )
      );

      /* =====================================
         SALVAR ROLE
      ===================================== */

      localStorage.setItem(
        "role",
        data.usuario.role || ""
      );

      /* =====================================
         SUPER ADMIN
      ===================================== */

      if (
        data.usuario.role ===
        "super_admin"
      ) {
        setMsg(
          "Acesso de Super Administrador identificado."
        );

        navigate(
          "/app/empresas",
          {
            replace: true,
          }
        );

        return;
      }

      /* =====================================
         ADMIN / USUÁRIO DA EMPRESA
      ===================================== */

      if (
        data.usuario.role ===
        "admin_empresa"
      ) {
        if (
          !data.usuario.empresa_id
        ) {
          throw new Error(
            "Este usuário não possui empresa vinculada."
          );
        }

        localStorage.setItem(
          "empresa_id",
          String(
            data.usuario.empresa_id
          )
        );

        if (
          data.usuario.empresa_nome
        ) {
          localStorage.setItem(
            "empresa_nome",
            data.usuario.empresa_nome
          );
        }

        /*
          Salva a identidade básica.

          Isso permitirá que a Home
          saiba qual empresa está usando
          o sistema.
        */

        salvarIdentidadeEmpresa(
          data.usuario
        );

        setMsg(
          `Bem-vindo${
            data.usuario
              .empresa_nome
              ? ` ao ${data.usuario.empresa_nome}`
              : ""
          }!`
        );

        /*
          IMPORTANTE:

          Vai para a tela pública
          de bater ponto da empresa.

          NÃO vai para os relatórios.
        */

        navigate(
          "/ponto",
          {
            replace: true,
          }
        );

        return;
      }

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
        err.response?.data?.error ||
        err.message ||
        "Não foi possível realizar o acesso.";

      setErro(true);

      setMsg(
        mensagem
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div
      className="acessoEmpresaScreen"
      style={{
        backgroundImage:
          `linear-gradient(
            rgba(0, 0, 0, 0.62),
            rgba(0, 0, 0, 0.72)
          ),
          url("${fundoPadrao}")`,
      }}
    >
      <div className="acessoEmpresaCard">
        {/* LOGO */}

        <div className="acessoEmpresaLogoArea">
          <img
            src={logoPadrao}
            alt="Sistema de Ponto"
            className="acessoEmpresaLogo"
          />
        </div>

        {/* TÍTULO */}

        <div className="acessoEmpresaHeader">
          <div className="acessoEmpresaIcon">
            <FaBuilding />
          </div>

          <h1>
            Sistema de Ponto
          </h1>

          <p>
            Informe seu usuário e
            senha para acessar sua
            empresa.
          </p>
        </div>

        {/* FORMULÁRIO */}

        <form
          className="acessoEmpresaForm"
          onSubmit={onSubmit}
        >
          {/* USUÁRIO */}

          <div className="acessoEmpresaGroup">
            <label>
              Usuário
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              placeholder="Digite seu usuário"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          {/* SENHA */}

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
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
                disabled={loading}
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

          {/* BOTÃO */}

          <button
            type="submit"
            className="acessoEmpresaButton"
            disabled={loading}
          >
            {loading
              ? "Entrando..."
              : "Entrar"}
          </button>

          {/* MENSAGEM */}

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

        {/* SUPER ADMIN */}

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