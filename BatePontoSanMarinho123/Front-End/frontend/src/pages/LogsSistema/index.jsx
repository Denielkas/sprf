import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { api } from "../../services/api";


export default function LogsSistema() {
  /* =========================================================
     ESTADOS
  ========================================================= */

  const [logs, setLogs] =
    useState([]);

  const [empresas, setEmpresas] =
    useState([]);

  const [tipos, setTipos] =
    useState([]);

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [empresaId, setEmpresaId] =
    useState("");

  const [tipo, setTipo] =
    useState("");

  const [busca, setBusca] =
    useState("");

  const [dataInicio, setDataInicio] =
    useState("");

  const [dataFim, setDataFim] =
    useState("");

  const [pagina, setPagina] =
    useState(1);

  const [totalPaginas, setTotalPaginas] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [logSelecionado, setLogSelecionado] =
    useState(null);


  /* =========================================================
     CARREGAR EMPRESAS
  ========================================================= */

  const carregarEmpresas =
    useCallback(async () => {
      try {
        const response =
          await api.get(
            "/empresas"
          );

        const data =
          response.data;

        if (
          Array.isArray(data)
        ) {
          setEmpresas(data);
          return;
        }

        if (
          Array.isArray(
            data?.empresas
          )
        ) {
          setEmpresas(
            data.empresas
          );
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

  const carregarTipos =
    useCallback(async () => {
      try {
        const response =
          await api.get(
            "/logs/tipos"
          );

        setTipos(
          Array.isArray(
            response.data?.tipos
          )
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

  const carregarLogs =
    useCallback(async () => {
      try {
        setCarregando(true);
        setErro("");

        const params = {
          pagina,
          limite: 50,
        };

        if (empresaId) {
          params.empresa_id =
            empresaId;
        }

        if (tipo) {
          params.tipo =
            tipo;
        }

        if (
          busca &&
          busca.trim()
        ) {
          params.busca =
            busca.trim();
        }

        if (dataInicio) {
          params.data_inicio =
            dataInicio;
        }

        if (dataFim) {
          params.data_fim =
            dataFim;
        }

        const response =
          await api.get(
            "/logs",
            {
              params,
            }
          );

        const data =
          response.data;

        setLogs(
          Array.isArray(
            data?.logs
          )
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
              data?.total_paginas ||
              1
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
     RESETAR PÁGINA AO ALTERAR FILTROS
  ========================================================= */

  function alterarEmpresa(event) {
    setEmpresaId(
      event.target.value
    );

    setPagina(1);
  }


  function alterarTipo(event) {
    setTipo(
      event.target.value
    );

    setPagina(1);
  }


  function alterarDataInicio(event) {
    setDataInicio(
      event.target.value
    );

    setPagina(1);
  }


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
     PAGINAÇÃO
  ========================================================= */

  function paginaAnterior() {
    if (pagina > 1) {
      setPagina(
        pagina - 1
      );
    }
  }


  function proximaPagina() {
    if (
      pagina <
      totalPaginas
    ) {
      setPagina(
        pagina + 1
      );
    }
  }


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      style={{
        padding: "24px",
        width: "100%",
      }}
    >
      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: "700",
          }}
        >
          Logs do Sistema
        </h1>

        <p
          style={{
            marginTop: "6px",
            marginBottom: 0,
            color: "#666",
          }}
        >
          Acompanhe as ações realizadas
          nas empresas e no sistema.
        </p>
      </div>


      {/* =====================================================
          FILTROS
      ===================================================== */}

      <form
        onSubmit={pesquisar}
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          {/* EMPRESA */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Empresa
            </label>

            <select
              value={empresaId}
              onChange={
                alterarEmpresa
              }
              style={{
                width: "100%",
                height: "42px",
                padding: "0 10px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "8px",
                background: "#fff",
              }}
            >
              <option value="">
                Todas as empresas
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
                      empresa.nome}
                  </option>
                )
              )}
            </select>
          </div>


          {/* TIPO */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Tipo
            </label>

            <select
              value={tipo}
              onChange={
                alterarTipo
              }
              style={{
                width: "100%",
                height: "42px",
                padding: "0 10px",
                border:
                  "1px solid #d1d5db",
                borderRadius: "8px",
                background: "#fff",
              }}
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


          {/* DATA INICIAL */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Data inicial
            </label>

            <input
              type="date"
              value={
                dataInicio
              }
              onChange={
                alterarDataInicio
              }
              style={{
                width: "100%",
                height: "42px",
                padding: "0 10px",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #d1d5db",
                borderRadius: "8px",
              }}
            />
          </div>


          {/* DATA FINAL */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
              }}
            >
              Data final
            </label>

            <input
              type="date"
              value={dataFim}
              onChange={
                alterarDataFim
              }
              style={{
                width: "100%",
                height: "42px",
                padding: "0 10px",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #d1d5db",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>


        {/* BUSCA */}

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "16px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={busca}
            onChange={(
              event
            ) =>
              setBusca(
                event.target.value
              )
            }
            placeholder="Buscar por empresa, funcionário, usuário ou ação..."
            style={{
              flex: "1 1 300px",
              height: "42px",
              padding: "0 12px",
              boxSizing:
                "border-box",
              border:
                "1px solid #d1d5db",
              borderRadius: "8px",
            }}
          />

          <button
            type="submit"
            style={{
              minWidth: "110px",
              height: "42px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Pesquisar
          </button>

          <button
            type="button"
            onClick={
              limparFiltros
            }
            style={{
              minWidth: "110px",
              height: "42px",
              border:
                "1px solid #d1d5db",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Limpar
          </button>
        </div>
      </form>


      {/* =====================================================
          TOTAL
      ===================================================== */}

      <div
        style={{
          marginBottom: "12px",
          color: "#555",
          fontSize: "14px",
        }}
      >
        {total === 1
          ? "1 registro encontrado"
          : `${total} registros encontrados`}
      </div>


      {/* =====================================================
          ERRO
      ===================================================== */}

      {erro && (
        <div
          style={{
            padding: "14px",
            marginBottom: "16px",
            borderRadius: "8px",
            background: "#fee2e2",
            color: "#991b1b",
          }}
        >
          {erro}
        </div>
      )}


      {/* =====================================================
          TABELA
      ===================================================== */}

      <div
        style={{
          background: "#fff",
          border:
            "1px solid #e5e7eb",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: "1000px",
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    "#f9fafb",
                }}
              >
                <th style={thStyle}>
                  Data/Hora
                </th>

                <th style={thStyle}>
                  Empresa
                </th>

                <th style={thStyle}>
                  Usuário
                </th>

                <th style={thStyle}>
                  Funcionário
                </th>

                <th style={thStyle}>
                  Tipo
                </th>

                <th style={thStyle}>
                  Ação
                </th>

                <th style={thStyle}>
                  Descrição
                </th>

                <th style={thStyle}>
                  Detalhes
                </th>
              </tr>
            </thead>

            <tbody>
              {carregando ? (
                <tr>
                  <td
                    colSpan="8"
                    style={
                      vazioStyle
                    }
                  >
                    Carregando logs...
                  </td>
                </tr>
              ) : logs.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    style={
                      vazioStyle
                    }
                  >
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                logs.map(
                  (log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderTop:
                          "1px solid #eee",
                      }}
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {formatarData(
                          log.created_at
                        )}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {log.empresa_nome ||
                          "Sistema"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <div>
                          {log.username ||
                            "Sistema"}
                        </div>

                        <small
                          style={{
                            color:
                              "#777",
                          }}
                        >
                          {formatarRole(
                            log.role
                          )}
                        </small>
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {log.funcionario_nome ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {formatarTipo(
                          log.tipo
                        )}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {formatarTipo(
                          log.acao
                        )}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          maxWidth:
                            "320px",
                        }}
                      >
                        {log.descricao ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setLogSelecionado(
                              log
                            )
                          }
                          style={{
                            border:
                              "1px solid #d1d5db",
                            background:
                              "#fff",
                            borderRadius:
                              "7px",
                            padding:
                              "7px 10px",
                            cursor:
                              "pointer",
                          }}
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "15px",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          onClick={
            paginaAnterior
          }
          disabled={
            pagina <= 1 ||
            carregando
          }
          style={{
            padding:
              "9px 16px",
            border:
              "1px solid #d1d5db",
            borderRadius: "8px",
            background: "#fff",
            cursor:
              pagina <= 1
                ? "not-allowed"
                : "pointer",
            opacity:
              pagina <= 1
                ? 0.5
                : 1,
          }}
        >
          Anterior
        </button>

        <span>
          Página{" "}
          <strong>
            {pagina}
          </strong>{" "}
          de{" "}
          <strong>
            {totalPaginas}
          </strong>
        </span>

        <button
          type="button"
          onClick={
            proximaPagina
          }
          disabled={
            pagina >=
              totalPaginas ||
            carregando
          }
          style={{
            padding:
              "9px 16px",
            border:
              "1px solid #d1d5db",
            borderRadius: "8px",
            background: "#fff",
            cursor:
              pagina >=
              totalPaginas
                ? "not-allowed"
                : "pointer",
            opacity:
              pagina >=
              totalPaginas
                ? 0.5
                : 1,
          }}
        >
          Próxima
        </button>
      </div>


      {/* =====================================================
          MODAL DE DETALHES
      ===================================================== */}

      {logSelecionado && (
        <div
          onClick={() =>
            setLogSelecionado(
              null
            )
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "15px",
                marginBottom:
                  "20px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                }}
              >
                Detalhes do Log
              </h2>

              <button
                type="button"
                onClick={() =>
                  setLogSelecionado(
                    null
                  )
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  fontSize: "24px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <Detalhe
              titulo="Data/Hora"
              valor={formatarData(
                logSelecionado.created_at
              )}
            />

            <Detalhe
              titulo="Empresa"
              valor={
                logSelecionado.empresa_nome ||
                "Sistema"
              }
            />

            <Detalhe
              titulo="Usuário"
              valor={
                logSelecionado.username ||
                "Sistema"
              }
            />

            <Detalhe
              titulo="Perfil"
              valor={formatarRole(
                logSelecionado.role
              )}
            />

            <Detalhe
              titulo="Funcionário"
              valor={
                logSelecionado.funcionario_nome ||
                "-"
              }
            />

            <Detalhe
              titulo="Tipo"
              valor={formatarTipo(
                logSelecionado.tipo
              )}
            />

            <Detalhe
              titulo="Ação"
              valor={formatarTipo(
                logSelecionado.acao
              )}
            />

            <Detalhe
              titulo="Descrição"
              valor={
                logSelecionado.descricao ||
                "-"
              }
            />

            <Detalhe
              titulo="IP"
              valor={
                logSelecionado.ip ||
                "-"
              }
            />

            {logSelecionado.user_agent && (
              <Detalhe
                titulo="Navegador / Dispositivo"
                valor={
                  logSelecionado.user_agent
                }
              />
            )}

            <div
              style={{
                marginTop: "18px",
              }}
            >
              <strong>
                Dados adicionais
              </strong>

              <pre
                style={{
                  marginTop: "8px",
                  background:
                    "#f6f7f9",
                  padding: "15px",
                  borderRadius:
                    "8px",
                  overflowX:
                    "auto",
                  whiteSpace:
                    "pre-wrap",
                  wordBreak:
                    "break-word",
                  fontSize:
                    "13px",
                }}
              >
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
    <div
      style={{
        padding:
          "10px 0",
        borderBottom:
          "1px solid #eee",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#777",
          marginBottom: "3px",
        }}
      >
        {titulo}
      </div>

      <div>
        {valor}
      </div>
    </div>
  );
}


/* =========================================================
   ESTILOS
========================================================= */

const thStyle = {
  textAlign: "left",
  padding: "13px",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "13px",
  fontSize: "14px",
  verticalAlign: "top",
};

const vazioStyle = {
  padding: "35px",
  textAlign: "center",
  color: "#777",
};