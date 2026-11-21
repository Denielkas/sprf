import {
  useEffect,
  useState,
} from "react";

import { api } from "../../services/api";

import "./acessosEmpresas.css";

export default function AcessosEmpresas() {
  /* =========================================================
     ESTADOS
  ========================================================= */

  const [empresas, setEmpresas] =
    useState([]);

  const [empresaId, setEmpresaId] =
    useState("");

  const [role, setRole] =
    useState("rh_empresa");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  /* =========================================================
     DURAÇÃO DA SESSÃO

     RH começa com 8 horas.
     Ponto começa com 30 dias.
  ========================================================= */

  const [sessaoDuracao, setSessaoDuracao] =
    useState("8h");

  const [loading, setLoading] =
    useState(false);

  const [loadingEmpresas, setLoadingEmpresas] =
    useState(true);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

  /* =========================================================
     OPÇÕES DE DURAÇÃO
  ========================================================= */

  const duracoesSessao = [
    {
      value: "4h",
      label: "4 horas",
    },
    {
      value: "8h",
      label: "8 horas",
    },
    {
      value: "12h",
      label: "12 horas",
    },
    {
      value: "1d",
      label: "1 dia",
    },
    {
      value: "7d",
      label: "7 dias",
    },
    {
      value: "15d",
      label: "15 dias",
    },
    {
      value: "30d",
      label: "30 dias",
    },
    {
      value: "60d",
      label: "60 dias",
    },
    {
      value: "90d",
      label: "90 dias",
    },
  ];

  /* =========================================================
     CARREGAR EMPRESAS
  ========================================================= */

  async function carregarEmpresas() {
    try {
      setLoadingEmpresas(true);
      setErro("");

      const response =
        await api.get(
          "/empresas"
        );

      const dados =
        response.data;

      /*
        Aceita diferentes formatos
        caso seu controller retorne:

        [...]

        ou

        { empresas: [...] }
      */

      const lista =
        Array.isArray(dados)
          ? dados
          : Array.isArray(
              dados?.empresas
            )
          ? dados.empresas
          : [];

      setEmpresas(lista);

    } catch (error) {
      console.error(
        "Erro ao carregar empresas:",
        error
      );

      setErro(
        error.response?.data?.error ||
          "Não foi possível carregar as empresas."
      );

      setEmpresas([]);

    } finally {
      setLoadingEmpresas(false);
    }
  }

  /* =========================================================
     CARREGAR AO ABRIR
  ========================================================= */

  useEffect(() => {
    carregarEmpresas();
  }, []);

  /* =========================================================
     EMPRESA SELECIONADA
  ========================================================= */

  const empresaSelecionada =
    empresas.find(
      (empresa) =>
        String(empresa.id) ===
        String(empresaId)
    );

  /* =========================================================
     ALTERAR TIPO DE ACESSO

     Ao trocar o tipo:
     RH -> 8 horas
     Ponto -> 30 dias
  ========================================================= */

  function alterarTipoAcesso(
    novoRole
  ) {
    setRole(novoRole);

    if (
      novoRole === "rh_empresa"
    ) {
      setSessaoDuracao("8h");
    }

    if (
      novoRole === "ponto_empresa"
    ) {
      setSessaoDuracao("30d");
    }

    setErro("");
    setSucesso("");
  }

  /* =========================================================
     CRIAR LOGIN
  ========================================================= */

  async function cadastrarAcesso(event) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    /* =======================================================
       VALIDAÇÕES
    ======================================================= */

    if (!empresaId) {
      setErro(
        "Selecione uma empresa."
      );

      return;
    }

    if (!username.trim()) {
      setErro(
        "Informe o usuário."
      );

      return;
    }

    if (
      username.trim().length < 3
    ) {
      setErro(
        "O usuário precisa ter pelo menos 3 caracteres."
      );

      return;
    }

    if (!password) {
      setErro(
        "Informe a senha."
      );

      return;
    }

    if (
      password.length < 6
    ) {
      setErro(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      return;
    }

    if (
      role !== "rh_empresa" &&
      role !== "ponto_empresa"
    ) {
      setErro(
        "Tipo de acesso inválido."
      );

      return;
    }

    if (!sessaoDuracao) {
      setErro(
        "Selecione a duração da sessão."
      );

      return;
    }

    try {
      setLoading(true);

      /* =====================================================
         BACKEND

         POST /api/auth/admin-empresa
      ===================================================== */

      const response =
        await api.post(
          "/auth/admin-empresa",
          {
            empresa_id:
              Number(empresaId),

            username:
              username.trim(),

            password,

            role,

            sessao_duracao:
              sessaoDuracao,
          }
        );

      const tipo =
        role === "rh_empresa"
          ? "RH"
          : "Ponto";

      const duracaoSelecionada =
        duracoesSessao.find(
          (item) =>
            item.value ===
            sessaoDuracao
        );

      setSucesso(
        response.data?.message ||
          `Login de ${tipo} criado com sucesso. Sessão: ${
            duracaoSelecionada?.label ||
            sessaoDuracao
          }.`
      );

      /* =====================================================
         LIMPAR CAMPOS
      ===================================================== */

      setUsername("");
      setPassword("");

    } catch (error) {
      console.error(
        "Erro ao cadastrar acesso:",
        error
      );

      setErro(
        error.response?.data?.error ||
          "Erro ao cadastrar login da empresa."
      );

    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div className="acessosPage">

      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <section className="acessosHeader">

        <div>
          <span className="acessosTag">
            Super Administrador
          </span>

          <h1>
            Acessos das Empresas
          </h1>

          <p>
            Cadastre os usuários de RH e
            do terminal de ponto de cada
            empresa.
          </p>
        </div>

        <button
          type="button"
          className="btnAtualizarEmpresas"
          onClick={
            carregarEmpresas
          }
          disabled={
            loadingEmpresas
          }
        >
          {loadingEmpresas
            ? "Carregando..."
            : "↻ Atualizar empresas"}
        </button>

      </section>

      {/* =====================================================
          CONTEÚDO
      ===================================================== */}

      <div className="acessosGrid">

        {/* ===================================================
            FORMULÁRIO
        =================================================== */}

        <section className="acessoCard">

          <div className="acessoCardHeader">

            <div className="acessoIcon">
              👤
            </div>

            <div>
              <h2>
                Novo acesso
              </h2>

              <p>
                Crie um login vinculado
                a uma empresa.
              </p>
            </div>

          </div>

          {/* =================================================
              MENSAGENS
          ================================================= */}

          {erro && (
            <div className="acessoMensagem erro">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="acessoMensagem sucesso">
              {sucesso}
            </div>
          )}

          <form
            className="acessoForm"
            onSubmit={
              cadastrarAcesso
            }
          >

            {/* ===============================================
                EMPRESA
            =============================================== */}

            <div className="acessoCampo">

              <label htmlFor="empresa">
                Empresa
              </label>

              <select
                id="empresa"
                value={
                  empresaId
                }
                onChange={(e) => {
                  setEmpresaId(
                    e.target.value
                  );

                  setErro("");
                  setSucesso("");
                }}
                disabled={
                  loadingEmpresas
                }
              >
                <option value="">
                  {loadingEmpresas
                    ? "Carregando empresas..."
                    : "Selecione uma empresa"}
                </option>

                {empresas.map(
                  (empresa) => (
                    <option
                      key={
                        empresa.id
                      }
                      value={
                        empresa.id
                      }
                    >
                      {empresa.nome_fantasia ||
                        empresa.nome ||
                        `Empresa ${empresa.id}`}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* ===============================================
                TIPO
            =============================================== */}

            <div className="acessoCampo">

              <label htmlFor="role">
                Tipo de acesso
              </label>

              <select
                id="role"
                value={role}
                onChange={(e) => {
                  alterarTipoAcesso(
                    e.target.value
                  );
                }}
              >
                <option value="rh_empresa">
                  RH da Empresa
                </option>

                <option value="ponto_empresa">
                  Terminal de Ponto
                </option>
              </select>

            </div>

            {/* ===============================================
                DURAÇÃO DA SESSÃO
            =============================================== */}

            <div className="acessoCampo">

              <label htmlFor="sessaoDuracao">
                Duração da sessão
              </label>

              <select
                id="sessaoDuracao"
                value={
                  sessaoDuracao
                }
                onChange={(e) => {
                  setSessaoDuracao(
                    e.target.value
                  );

                  setErro("");
                  setSucesso("");
                }}
              >
                {duracoesSessao.map(
                  (duracao) => (
                    <option
                      key={
                        duracao.value
                      }
                      value={
                        duracao.value
                      }
                    >
                      {duracao.label}
                    </option>
                  )
                )}
              </select>

              <small>
                {role === "rh_empresa"
                  ? "Padrão recomendado para RH: 8 horas."
                  : "Padrão recomendado para o terminal de ponto: 30 dias."}
              </small>

            </div>

            {/* ===============================================
                USUÁRIO
            =============================================== */}

            <div className="acessoCampo">

              <label htmlFor="username">
                Usuário
              </label>

              <input
                id="username"
                type="text"
                value={
                  username
                }
                onChange={(e) => {
                  setUsername(
                    e.target.value
                  );

                  setErro("");
                  setSucesso("");
                }}
                placeholder={
                  role === "rh_empresa"
                    ? "Ex.: sanmarinho.rh"
                    : "Ex.: sanmarinho.ponto"
                }
                autoComplete="off"
              />

            </div>

            {/* ===============================================
                SENHA
            =============================================== */}

            <div className="acessoCampo">

              <label htmlFor="password">
                Senha
              </label>

              <input
                id="password"
                type="password"
                value={
                  password
                }
                onChange={(e) => {
                  setPassword(
                    e.target.value
                  );

                  setErro("");
                  setSucesso("");
                }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />

            </div>

            {/* ===============================================
                RESUMO
            =============================================== */}

            {empresaSelecionada && (
              <div className="acessoResumo">

                <span>
                  O acesso será criado para:
                </span>

                <strong>
                  {empresaSelecionada.nome_fantasia ||
                    empresaSelecionada.nome}
                </strong>

                <small>
                  {role ===
                  "rh_empresa"
                    ? "Acesso ao painel administrativo / RH"
                    : "Acesso somente ao terminal de ponto"}
                </small>

                <small>
                  Sessão:{" "}
                  {
                    duracoesSessao.find(
                      (item) =>
                        item.value ===
                        sessaoDuracao
                    )?.label
                  }
                </small>

              </div>
            )}

            {/* ===============================================
                BOTÃO
            =============================================== */}

            <button
              type="submit"
              className="btnCriarAcesso"
              disabled={
                loading ||
                loadingEmpresas ||
                empresas.length === 0
              }
            >
              {loading
                ? "Criando acesso..."
                : "Criar acesso"}
            </button>

          </form>

        </section>

        {/* ===================================================
            EXPLICAÇÃO DOS ACESSOS
        =================================================== */}

        <section className="tiposAcessoCard">

          <h2>
            Tipos de acesso
          </h2>

          <p className="tiposDescricao">
            Cada empresa pode possuir um
            login para o RH e outro para
            o terminal de ponto.
          </p>

          {/* ===============================================
              RH
          =============================================== */}

          <div className="tipoAcessoItem">

            <div className="tipoAcessoIcon">
              RH
            </div>

            <div>
              <strong>
                RH da Empresa
              </strong>

              <p>
                Acesso ao cadastro de
                funcionários, relatórios,
                ponto manual, atestados e
                banco de horas.
              </p>

              <small>
                Sessão padrão: 8 horas
              </small>
            </div>

          </div>

          {/* ===============================================
              PONTO
          =============================================== */}

          <div className="tipoAcessoItem">

            <div className="tipoAcessoIcon">
              ⏱
            </div>

            <div>
              <strong>
                Terminal de Ponto
              </strong>

              <p>
                Acesso destinado ao
                computador ou dispositivo
                usado pelos funcionários
                para registrar o ponto.
              </p>

              <small>
                Sessão padrão: 30 dias
              </small>
            </div>

          </div>

          {/* ===============================================
              EMPRESAS
          =============================================== */}

          <div className="empresasDisponiveis">

            <span>
              Empresas disponíveis
            </span>

            <strong>
              {empresas.length}
            </strong>

          </div>

        </section>

      </div>

    </div>
  );
}