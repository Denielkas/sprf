import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../../services/api";

import "./resultadoPontos.css";

export default function ResultadoPontos() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [funcionario, setFuncionario] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  /* =========================================================
     USUÁRIO / EMPRESA LOGADA

     No sistema multiempresa NÃO usamos empresa fixa.

     O empresa_id vem do login "ponto_empresa".
  ========================================================= */

  const usuario = useMemo(() => {
    try {
      const salvo = localStorage.getItem("usuario");

      if (!salvo) {
        return null;
      }

      return JSON.parse(salvo);
    } catch (error) {
      console.error(
        "Erro ao carregar usuário logado:",
        error
      );

      return null;
    }
  }, []);

  const empresaId = usuario?.empresa_id || null;

  /* =========================================================
     CARREGAR PONTOS
  ========================================================= */

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        setErro("");

        /* =====================================================
           CPF
        ===================================================== */

        if (!state?.cpf) {
          setErro(
            "CPF não informado para consulta."
          );

          return;
        }

        /* =====================================================
           EMPRESA
        ===================================================== */

        if (!empresaId) {
          setErro(
            "Empresa não identificada. Faça login novamente."
          );

          return;
        }

        /* =====================================================
           BUSCAR

           Enviamos empresa_id para garantir que:

           CPF da empresa A
           não encontre funcionário da empresa B.
        ===================================================== */

        const response = await api.get(
          `/ponto/cpf/${state.cpf}`,
          {
            params: {
              empresa_id: empresaId,
            },
          }
        );

        const dados = response.data || {};

        setFuncionario(
          dados.funcionario || null
        );

        setPontos(
          Array.isArray(dados.pontos)
            ? dados.pontos
            : []
        );
      } catch (error) {
        console.error(
          "Erro ao buscar pontos:",
          error
        );

        setFuncionario(null);
        setPontos([]);

        setErro(
          error?.response?.data?.error ||
            "Nenhum dado encontrado."
        );
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [state?.cpf, empresaId]);

  /* =========================================================
     LINHA VAZIA
  ========================================================= */

  function novaLinha() {
    return {
      entrada: "--:--",
      intervalo: "--:--",
      retorno: "--:--",
      saida: "--:--",
    };
  }

  /* =========================================================
     VERIFICAR SE EXISTEM DADOS
  ========================================================= */

  function linhaTemDados(linha) {
    return (
      linha.entrada !== "--:--" ||
      linha.intervalo !== "--:--" ||
      linha.retorno !== "--:--" ||
      linha.saida !== "--:--"
    );
  }

  /* =========================================================
     HORA -> MINUTOS
  ========================================================= */

  function horaParaMinutos(hora) {
    if (!hora || hora === "--:--") {
      return null;
    }

    const partes = String(hora)
      .slice(0, 5)
      .split(":")
      .map(Number);

    const h = partes[0];
    const m = partes[1];

    if (
      Number.isNaN(h) ||
      Number.isNaN(m)
    ) {
      return null;
    }

    return h * 60 + m;
  }

  /* =========================================================
     ESCOLHER BATIDA MAIS PRÓXIMA DO HORÁRIO PADRÃO
  ========================================================= */

  function escolherMaisProximo(
    lista,
    regraHora
  ) {
    if (
      !Array.isArray(lista) ||
      lista.length === 0 ||
      !regraHora
    ) {
      return null;
    }

    const regraMin =
      horaParaMinutos(regraHora);

    if (regraMin == null) {
      return null;
    }

    let melhor = null;
    let menorDiferenca = Infinity;

    for (const item of lista) {
      const itemMin =
        horaParaMinutos(item.hora);

      if (itemMin == null) {
        continue;
      }

      const diferenca = Math.abs(
        itemMin - regraMin
      );

      if (
        diferenca < menorDiferenca
      ) {
        menorDiferenca = diferenca;
        melhor = item;
      }
    }

    return melhor;
  }

  /* =========================================================
     REMOVER ITEM
  ========================================================= */

  function removerPorId(lista, id) {
    const indice = lista.findIndex(
      (item) => item.id === id
    );

    if (indice >= 0) {
      lista.splice(indice, 1);
    }
  }

  /* =========================================================
     AGRUPAR BATIDAS
  ========================================================= */

  function agruparBatidas(
    lista,
    regras
  ) {
    const entradas = [];
    const intervalosInicio = [];
    const intervalosFim = [];
    const saidas = [];
    const autos = [];

    for (const ponto of lista) {
      const tipo = String(
        ponto.tipo || ""
      ).toLowerCase();

      if (tipo === "entrada") {
        entradas.push(ponto);
      } else if (
        tipo === "intervalo_inicio"
      ) {
        intervalosInicio.push(ponto);
      } else if (
        tipo === "intervalo_fim"
      ) {
        intervalosFim.push(ponto);
      } else if (
        tipo === "saida"
      ) {
        saidas.push(ponto);
      } else if (
        tipo === "auto"
      ) {
        autos.push(ponto);
      }
    }

    /* =====================================================
       ORDENAR BATIDAS
    ===================================================== */

    const ordenar = (a, b) =>
      String(a.hora || "").localeCompare(
        String(b.hora || "")
      );

    entradas.sort(ordenar);
    intervalosInicio.sort(ordenar);
    intervalosFim.sort(ordenar);
    saidas.sort(ordenar);
    autos.sort(ordenar);

    const linhaPrincipal =
      novaLinha();

    /* =====================================================
       ENTRADA
    ===================================================== */

    if (entradas.length > 0) {
      linhaPrincipal.entrada =
        entradas.shift().hora ||
        "--:--";
    } else if (autos.length > 0) {
      linhaPrincipal.entrada =
        autos.shift().hora ||
        "--:--";
    }

    /* =====================================================
       INÍCIO DO INTERVALO
    ===================================================== */

    let principalInicio =
      escolherMaisProximo(
        intervalosInicio,
        regras?.intervalo_inicio
      );

    if (
      !principalInicio &&
      intervalosInicio.length > 0
    ) {
      principalInicio =
        intervalosInicio[0];
    }

    if (principalInicio) {
      linhaPrincipal.intervalo =
        principalInicio.hora ||
        "--:--";

      removerPorId(
        intervalosInicio,
        principalInicio.id
      );
    } else if (
      autos.length > 0
    ) {
      linhaPrincipal.intervalo =
        autos.shift().hora ||
        "--:--";
    }

    /* =====================================================
       RETORNO
    ===================================================== */

    let principalFim =
      escolherMaisProximo(
        intervalosFim,
        regras?.intervalo_fim
      );

    if (
      !principalFim &&
      intervalosFim.length > 0
    ) {
      principalFim =
        intervalosFim[0];
    }

    if (principalFim) {
      linhaPrincipal.retorno =
        principalFim.hora ||
        "--:--";

      removerPorId(
        intervalosFim,
        principalFim.id
      );
    } else if (
      autos.length > 0
    ) {
      linhaPrincipal.retorno =
        autos.shift().hora ||
        "--:--";
    }

    /* =====================================================
       SAÍDA
    ===================================================== */

    if (saidas.length > 0) {
      linhaPrincipal.saida =
        saidas.shift().hora ||
        "--:--";
    } else if (
      autos.length > 0
    ) {
      linhaPrincipal.saida =
        autos.shift().hora ||
        "--:--";
    }

    const linhas = [];

    if (
      linhaTemDados(
        linhaPrincipal
      )
    ) {
      linhas.push(
        linhaPrincipal
      );
    }

    /* =====================================================
       INTERVALOS EXTRAS
    ===================================================== */

    while (
      intervalosInicio.length > 0 ||
      intervalosFim.length > 0
    ) {
      const linha = novaLinha();

      if (
        intervalosInicio.length > 0
      ) {
        linha.intervalo =
          intervalosInicio.shift()
            .hora || "--:--";
      }

      if (
        intervalosFim.length > 0
      ) {
        linha.retorno =
          intervalosFim.shift()
            .hora || "--:--";
      }

      if (linhaTemDados(linha)) {
        linhas.push(linha);
      }
    }

    /* =====================================================
       ENTRADAS / SAÍDAS EXTRAS
    ===================================================== */

    while (
      entradas.length > 0 ||
      saidas.length > 0
    ) {
      const linha = novaLinha();

      if (entradas.length > 0) {
        linha.entrada =
          entradas.shift().hora ||
          "--:--";
      }

      if (saidas.length > 0) {
        linha.saida =
          saidas.shift().hora ||
          "--:--";
      }

      if (linhaTemDados(linha)) {
        linhas.push(linha);
      }
    }

    /* =====================================================
       BATIDAS AUTOMÁTICAS RESTANTES
    ===================================================== */

    while (autos.length > 0) {
      const linha = novaLinha();

      if (autos.length > 0) {
        linha.entrada =
          autos.shift().hora ||
          "--:--";
      }

      if (autos.length > 0) {
        linha.saida =
          autos.shift().hora ||
          "--:--";
      }

      if (linhaTemDados(linha)) {
        linhas.push(linha);
      }
    }

    return linhas;
  }

  /* =========================================================
     DADOS DA TELA
  ========================================================= */

  const linhas = agruparBatidas(
    Array.isArray(pontos)
      ? pontos
      : [],
    funcionario
  );

  const dataHoje =
    new Date().toLocaleDateString(
      "pt-BR"
    );

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="resultadoContainer">
        <div className="resultadoCard">
          <p className="semDados">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     ERRO
  ========================================================= */

  if (
    erro ||
    !funcionario
  ) {
    return (
      <div className="resultadoContainer">
        <div className="resultadoCard">
          <p className="semDados">
            {erro ||
              "Nenhum dado encontrado."}
          </p>

          <div className="resultadoActions">
            <button
              className="btnVoltar"
              onClick={() =>
                navigate(
                  "/buscar-pontos"
                )
              }
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     TELA
  ========================================================= */

  return (
    <div className="resultadoContainer">
      <div className="resultadoCard">

        <h2>
          Resumo de Hoje
        </h2>

        <div className="resultadoInfo">
          <span>
            <strong>
              Colaborador:
            </strong>{" "}
            {funcionario.nome}
          </span>

          <span>
            <strong>CPF:</strong>{" "}
            {funcionario.cpf}
          </span>

          <span>
            <strong>Data:</strong>{" "}
            {dataHoje}
          </span>

          {usuario?.empresa_nome && (
            <span>
              <strong>
                Empresa:
              </strong>{" "}
              {usuario.empresa_nome}
            </span>
          )}
        </div>

        <div className="tableResponsive">
          <table className="resultadoTable">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Entrada</th>
                <th>Intervalo</th>
                <th>Retorno</th>
                <th>Saída</th>
              </tr>
            </thead>

            <tbody>
              {linhas.length > 0 ? (
                linhas.map(
                  (
                    linha,
                    index
                  ) => (
                    <tr key={index}>
                      <td>
                        {dataHoje}
                      </td>

                      <td>
                        {
                          funcionario.nome
                        }
                      </td>

                      <td>
                        {
                          linha.entrada
                        }
                      </td>

                      <td>
                        {
                          linha.intervalo
                        }
                      </td>

                      <td>
                        {
                          linha.retorno
                        }
                      </td>

                      <td>
                        {
                          linha.saida
                        }
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="semDados"
                  >
                    Nenhuma batida
                    encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="resultadoActions">
          <button
            className="btnVoltar"
            onClick={() =>
              navigate(
                "/buscar-pontos"
              )
            }
          >
            Nova Consulta
          </button>

          <button
            className="btnInicio"
            onClick={() =>
              navigate("/ponto")
            }
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}