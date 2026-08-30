import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { api } from "../../services/api";

import "./logsSistema.css";


export default function LogsSistema() {
  /* =========================================================
     ESTADOS
  ========================================================= */

  const [logs, setLogs] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [empresaId, setEmpresaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);

  const [logSelecionado, setLogSelecionado] = useState(null);


  /* =========================================================
     CARREGAR EMPRESAS
  ========================================================= */

  const carregarEmpresas = useCallback(async () => {
    try {
      const response = await api.get("/empresas");

      const data = response.data;

      if (Array.isArray(data)) {
        setEmpresas(data);
        return;
      }

      if (Array.isArray(data?.empresas)) {
        setEmpresas(data.empresas);
        return;
      }

      setEmpresas([]);
    } catch (error) {
      console.error(
        "Erro ao carregar empresas:",
        error
      );

      setEmpresas([]);
    }
  }, []);


  /* =========================================================
     CARREGAR TIPOS
  ========================================================= */

  const carregarTipos = useCallback(async () => {
    try {
      const response = await api.get("/logs/tipos");

      setTipos(
        Array.isArray(response.data?.tipos)
          ? response.data.tipos
          : []
      );
    } catch (error) {
      console.error(
        "Erro ao carregar tipos de log:",
        error
      );

      setTipos([]);
    }
  }, []);


  /* =========================================================
     CARREGAR LOGS
  ========================================================= */

  const carregarLogs = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const params = {
        pagina,
        limite: 50,
      };

      if (empresaId) {
        params.empresa_id = empresaId;
      }

      if (tipo) {
        params.tipo = tipo;
      }

      if (busca && busca.trim()) {
        params.busca = busca.trim();
      }

      if (dataInicio) {
        params.data_inicio = dataInicio;
      }

      if (dataFim) {
        params.data_fim = dataFim;
      }

      const response = await api.get(
        "/logs",
        {
          params,
        }
      );

      const data = response.data;

      setLogs(
        Array.isArray(data?.logs)
          ? data.logs
          : []
      );

      setTotal(
        Number(
          data?.total || 0
        )
      );

      setTotalPaginas(
        Math.max(
          1,
          Number(
            data?.total_paginas || 1
          )
        )
      );
    } catch (error) {
      console.error(
        "Erro ao carregar logs:",
        error
      );

      setLogs([]);
      setTotal(0);
      setTotalPaginas(1);

      setErro(
        error?.response?.data?.error ||
        "Não foi possível carregar os logs."
      );
    } finally {
      setCarregando(false);
    }
  }, [
    pagina,
    empresaId,
    tipo,
    busca,
    dataInicio,
    dataFim,
  ]);


  /* =========================================================
     CARREGAMENTO INICIAL
  ========================================================= */

  useEffect(() => {
    carregarEmpresas();
    carregarTipos();
  }, [
    carregarEmpresas,
    carregarTipos,
  ]);


  useEffect(() => {
    carregarLogs();
  }, [
    carregarLogs,
  ]);


  /* =========================================================
     ALTERAR EMPRESA
  ========================================================= */

  function alterarEmpresa(event) {
    setEmpresaId(
      event.target.value
    );

    setPagina(1);
  }


  /* =========================================================
     ALTERAR TIPO
  ========================================================= */

  function alterarTipo(event) {
    setTipo(
      event.target.value
    );

    setPagina(1);
  }


  /* =========================================================
     ALTERAR DATA INICIAL
  ========================================================= */

  function alterarDataInicio(event) {
    setDataInicio(
      event.target.value
    );

    setPagina(1);
  }


  /* =========================================================
     ALTERAR DATA FINAL
  ========================================================= */

  function alterarDataFim(event) {
    setDataFim(
      event.target.value
    );

    setPagina(1);
  }


  /* =========================================================
     BUSCA
  ========================================================= */

  function pesquisar(event) {
    event.preventDefault();

    setPagina(1);

    carregarLogs();
  }


  /* =========================================================
     LIMPAR FILTROS
  ========================================================= */

  function limparFiltros() {
    setEmpresaId("");
    setTipo("");
    setBusca("");
    setDataInicio("");
    setDataFim("");
    setPagina(1);
  }


  /* =========================================================
     FORMATAR DATA
  ========================================================= */

  function formatarData(data) {
    if (!data) {
      return "-";
    }

    try {
      return new Intl.DateTimeFormat(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "medium",
        }
      ).format(
        new Date(data)
      );
    } catch {
      return data;
    }
  }


  /* =========================================================
     FORMATAR ROLE
  ========================================================= */

  function formatarRole(role) {
    switch (role) {
      case "super_admin":
        return "Super Admin";

      case "rh_empresa":
        return "RH";

      case "ponto_empresa":
        return "Terminal de Ponto";

      default:
        return role || "Sistema";
    }
  }


  /* =========================================================
     FORMATAR TIPO
  ========================================================= */

  function formatarTipo(valor) {
    if (!valor) {
      return "-";
    }

    return String(valor)
      .replaceAll("_", " ");
  }


  /* =========================================================
     PÁGINA ANTERIOR
  ========================================================= */

  function paginaAnterior() {
    if (pagina > 1) {
      setPagina(
        pagina - 1
      );
    }
  }


  /* =========================================================
     PRÓXIMA PÁGINA
  ========================================================= */

  function proximaPagina() {
    if (pagina < totalPaginas) {
      setPagina(
        pagina + 1
      );
    }
  }


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="logsPage">

      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <header className="logsHeader">

        <span className="logsTag">
          Super Administrador
        </span>

        <h1>
          Logs do Sistema
        </h1>

        <p>
          Acompanhe as ações realizadas nas empresas e no sistema.
        </p>

      </header>


      {/* =====================================================
          FILTROS
      ===================================================== */}

      <form
        className="logsFiltros"
        onSubmit={pesquisar}
      >

        <div className="logsFiltrosGrid">

          {/* =================================================
              EMPRESA
          ================================================= */}

          <div className="logsCampo">

            <label>
              Empresa
            </label>

            <select
              value={empresaId}
              onChange={alterarEmpresa}
            >

              <option value="">
                Todas as empresas
              </option>

              {empresas.map(
                (empresa) => (
                  <option
                    key={empresa.id}
                    value={empresa.id}
                  >
                    {empresa.nome_fantasia ||
                      empresa.nome}
                  </option>
                )
              )}

            </select>

          </div>


          {/* =================================================
              TIPO
          ================================================= */}

          <div className="logsCampo">

            <label>
              Tipo
            </label>

            <select
              value={tipo}
              onChange={alterarTipo}
            >

              <option value="">
                Todos os tipos
              </option>

              {tipos.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {formatarTipo(
                      item
                    )}
                  </option>
                )
              )}

            </select>

          </div>


          {/* =================================================
              DATA INICIAL
          ================================================= */}

          <div className="logsCampo">

            <label>
              Data inicial
            </label>

            <input
              type="date"
              value={dataInicio}
              onChange={alterarDataInicio}
            />

          </div>


          {/* =================================================
              DATA FINAL
          ================================================= */}

          <div className="logsCampo">

            <label>
              Data final
            </label>

            <input
              type="date"
              value={dataFim}
              onChange={alterarDataFim}
            />

          </div>

        </div>


        {/* ===================================================
            BUSCA
        =================================================== */}

        <div className="logsBuscaArea">

          <input
            className="logsBuscaInput"
            type="text"
            value={busca}
            onChange={(event) =>
              setBusca(
                event.target.value
              )
            }
            placeholder="Buscar por empresa, funcionário, usuário ou ação..."
          />


          <button
            className="logsBtnPesquisar"
            type="submit"
          >
            Pesquisar
          </button>


          <button
            className="logsBtnLimpar"
            type="button"
            onClick={limparFiltros}
          >
            Limpar
          </button>

        </div>

      </form>


      {/* =====================================================
          TOTAL DE REGISTROS
      ===================================================== */}

      <div className="logsTotal">

        {total === 1
          ? "1 registro encontrado"
          : `${total} registros encontrados`}

      </div>


      {/* =====================================================
          ERRO
      ===================================================== */}

      {erro && (
        <div className="logsErro">
          {erro}
        </div>
      )}


      {/* =====================================================
          TABELA
      ===================================================== */}

      <div className="logsTabelaCard">

        <div className="logsTabelaScroll">

          <table className="logsTabela">

            <thead>

              <tr>

                <th>
                  Data/Hora
                </th>

                <th>
                  Empresa
                </th>

                <th>
                  Usuário
                </th>

                <th>
                  Funcionário
                </th>

                <th>
                  Tipo
                </th>

                <th>
                  Ação
                </th>

                <th>
                  Descrição
                </th>

                <th>
                  Detalhes
                </th>

              </tr>

            </thead>


            <tbody>

              {/* =================================================
                  CARREGANDO
              ================================================= */}

              {carregando ? (

                <tr>

                  <td
                    colSpan="8"
                    className="logsVazio"
                  >
                    Carregando logs...
                  </td>

                </tr>

              ) : logs.length === 0 ? (

                /* ===============================================
                   SEM LOGS
                =============================================== */

                <tr>

                  <td
                    colSpan="8"
                    className="logsVazio"
                  >
                    Nenhum log encontrado.
                  </td>

                </tr>

              ) : (

                /* ===============================================
                   LISTA DE LOGS
                =============================================== */

                logs.map(
                  (log) => (

                    <tr key={log.id}>

                      {/* DATA */}

                      <td>
                        {formatarData(
                          log.created_at
                        )}
                      </td>


                      {/* EMPRESA */}

                      <td>
                        {log.empresa_nome ||
                          "Sistema"}
                      </td>


                      {/* USUÁRIO */}

                      <td>

                        <div>
                          {log.username ||
                            "Sistema"}
                        </div>

                        <small className="logsUsuarioRole">
                          {formatarRole(
                            log.role
                          )}
                        </small>

                      </td>


                      {/* FUNCIONÁRIO */}

                      <td>
                        {log.funcionario_nome ||
                          "-"}
                      </td>


                      {/* TIPO */}

                      <td>

                        <span className="logsTipo">
                          {formatarTipo(
                            log.tipo
                          )}
                        </span>

                      </td>


                      {/* AÇÃO */}

                      <td>

                        <span className="logsAcao">
                          {formatarTipo(
                            log.acao
                          )}
                        </span>

                      </td>


                      {/* DESCRIÇÃO */}

                      <td className="logsDescricao">
                        {log.descricao ||
                          "-"}
                      </td>


                      {/* DETALHES */}

                      <td>

                        <button
                          className="logsBtnVer"
                          type="button"
                          onClick={() =>
                            setLogSelecionado(
                              log
                            )
                          }
                        >
                          Ver
                        </button>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* =====================================================
          PAGINAÇÃO
      ===================================================== */}

      <div className="logsPaginacao">

        {/* ANTERIOR */}

        <button
          className="logsPaginaBtn"
          type="button"
          onClick={paginaAnterior}
          disabled={
            pagina <= 1 ||
            carregando
          }
        >
          Anterior
        </button>


        {/* INFORMAÇÃO */}

        <span className="logsPaginacaoInfo">

          Página{" "}

          <strong>
            {pagina}
          </strong>

          {" "}de{" "}

          <strong>
            {totalPaginas}
          </strong>

        </span>


        {/* PRÓXIMA */}

        <button
          className="logsPaginaBtn"
          type="button"
          onClick={proximaPagina}
          disabled={
            pagina >= totalPaginas ||
            carregando
          }
        >
          Próxima
        </button>

      </div>


      {/* =====================================================
          MODAL DE DETALHES
      ===================================================== */}

      {logSelecionado && (

        <div
          className="logsModalOverlay"
          onClick={() =>
            setLogSelecionado(
              null
            )
          }
        >

          <div
            className="logsModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* =================================================
                CABEÇALHO MODAL
            ================================================= */}

            <div className="logsModalHeader">

              <h2>
                Detalhes do Log
              </h2>


              <button
                className="logsModalClose"
                type="button"
                onClick={() =>
                  setLogSelecionado(
                    null
                  )
                }
                aria-label="Fechar detalhes"
                title="Fechar"
              >
                ×
              </button>

            </div>


            {/* =================================================
                DATA / HORA
            ================================================= */}

            <Detalhe
              titulo="Data/Hora"
              valor={
                formatarData(
                  logSelecionado.created_at
                )
              }
            />


            {/* =================================================
                EMPRESA
            ================================================= */}

            <Detalhe
              titulo="Empresa"
              valor={
                logSelecionado.empresa_nome ||
                "Sistema"
              }
            />


            {/* =================================================
                USUÁRIO
            ================================================= */}

            <Detalhe
              titulo="Usuário"
              valor={
                logSelecionado.username ||
                "Sistema"
              }
            />


            {/* =================================================
                PERFIL
            ================================================= */}

            <Detalhe
              titulo="Perfil"
              valor={
                formatarRole(
                  logSelecionado.role
                )
              }
            />


            {/* =================================================
                FUNCIONÁRIO
            ================================================= */}

            <Detalhe
              titulo="Funcionário"
              valor={
                logSelecionado.funcionario_nome ||
                "-"
              }
            />


            {/* =================================================
                TIPO
            ================================================= */}

            <Detalhe
              titulo="Tipo"
              valor={
                formatarTipo(
                  logSelecionado.tipo
                )
              }
            />


            {/* =================================================
                AÇÃO
            ================================================= */}

            <Detalhe
              titulo="Ação"
              valor={
                formatarTipo(
                  logSelecionado.acao
                )
              }
            />


            {/* =================================================
                DESCRIÇÃO
            ================================================= */}

            <Detalhe
              titulo="Descrição"
              valor={
                logSelecionado.descricao ||
                "-"
              }
            />


            {/* =================================================
                IP
            ================================================= */}

            <Detalhe
              titulo="IP"
              valor={
                logSelecionado.ip ||
                "-"
              }
            />


            {/* =================================================
                NAVEGADOR / DISPOSITIVO
            ================================================= */}

            {logSelecionado.user_agent && (

              <Detalhe
                titulo="Navegador / Dispositivo"
                valor={
                  logSelecionado.user_agent
                }
              />

            )}


            {/* =================================================
                DADOS ADICIONAIS
            ================================================= */}

            <div className="logsDados">

              <strong>
                Dados adicionais
              </strong>


              <pre>
                {JSON.stringify(
                  logSelecionado.dados ||
                    {},
                  null,
                  2
                )}
              </pre>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


/* =========================================================
   COMPONENTE DE DETALHE
========================================================= */

function Detalhe({
  titulo,
  valor,
}) {
  return (

    <div className="logsDetalhe">

      <div className="logsDetalheTitulo">
        {titulo}
      </div>


      <div className="logsDetalheValor">
        {valor}
      </div>

    </div>

  );
}