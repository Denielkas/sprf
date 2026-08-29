import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { api } from "../../services/api";

import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./resultadoPontos.css";


/* =========================================================
   NORMALIZAR URL
========================================================= */

function normalizarUrlImagem(url) {

  if (!url) {
    return null;
  }

  const valor =
    String(url).trim();

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
   FORMATAR HORA
========================================================= */

function formatarHora(ponto) {

  if (!ponto) {
    return "--:--";
  }


  /* =======================================================
     BACKEND JÁ ENVIOU HORA
  ======================================================= */

  if (ponto.hora) {

    return String(
      ponto.hora
    ).slice(0, 5);
  }


  /* =======================================================
     BACKEND ENVIOU MARCADO_EM
  ======================================================= */

  if (ponto.marcado_em) {

    try {

      const data =
        new Date(
          ponto.marcado_em
        );

      if (
        !Number.isNaN(
          data.getTime()
        )
      ) {

        return data
          .toLocaleTimeString(
            "pt-BR",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }
          );
      }

    } catch (error) {

      console.error(
        "Erro formatando marcado_em:",
        error
      );
    }
  }


  return "--:--";
}


/* =========================================================
   FORMATAR DATA
========================================================= */

function formatarDataPonto(ponto) {

  if (!ponto) {
    return null;
  }


  /* =======================================================
     BACKEND JÁ ENVIOU DATA
  ======================================================= */

  if (ponto.data) {

    const valor =
      String(
        ponto.data
      );


    /* =====================================================
       DD/MM/YYYY
    ===================================================== */

    if (
      /^\d{2}\/\d{2}\/\d{4}$/.test(
        valor
      )
    ) {

      return valor;
    }


    /* =====================================================
       YYYY-MM-DD
    ===================================================== */

    if (
      /^\d{4}-\d{2}-\d{2}/.test(
        valor
      )
    ) {

      const [
        ano,
        mes,
        dia,
      ] =
        valor
          .slice(0, 10)
          .split("-");

      return `${dia}/${mes}/${ano}`;
    }
  }


  /* =======================================================
     USAR MARCADO_EM
  ======================================================= */

  if (ponto.marcado_em) {

    try {

      const data =
        new Date(
          ponto.marcado_em
        );

      if (
        !Number.isNaN(
          data.getTime()
        )
      ) {

        return data
          .toLocaleDateString(
            "pt-BR"
          );
      }

    } catch (error) {

      console.error(
        "Erro formatando data:",
        error
      );
    }
  }


  return null;
}


/* =========================================================
   VALOR PARA ORDENAÇÃO DAS BATIDAS
========================================================= */

function valorOrdenacao(ponto) {

  if (!ponto) {
    return 0;
  }


  /* =======================================================
     MARCADO_EM É A MELHOR OPÇÃO
  ======================================================= */

  if (ponto.marcado_em) {

    const timestamp =
      new Date(
        ponto.marcado_em
      ).getTime();

    if (
      !Number.isNaN(
        timestamp
      )
    ) {

      return timestamp;
    }
  }


  /* =======================================================
     FALLBACK DATA + HORA
  ======================================================= */

  if (
    ponto.data &&
    ponto.hora
  ) {

    const data =
      String(
        ponto.data
      ).slice(0, 10);

    const hora =
      String(
        ponto.hora
      ).slice(0, 8);

    const timestamp =
      new Date(
        `${data}T${hora}`
      ).getTime();

    if (
      !Number.isNaN(
        timestamp
      )
    ) {

      return timestamp;
    }
  }


  /* =======================================================
     FALLBACK PELO ID
  ======================================================= */

  return Number(
    ponto.id ||
    0
  );
}


/* =========================================================
   CRIAR LINHA
========================================================= */

function novaLinha() {

  return {

    data:
      null,

    entrada:
      "--:--",

    intervalo:
      "--:--",

    retorno:
      "--:--",

    saida:
      "--:--",

    principal:
      false,

    ordem:
      0,
  };
}


/* =========================================================
   VERIFICAR SE LINHA POSSUI DADOS
========================================================= */

function linhaTemDados(linha) {

  if (!linha) {
    return false;
  }

  return (
    linha.entrada !== "--:--" ||
    linha.intervalo !== "--:--" ||
    linha.retorno !== "--:--" ||
    linha.saida !== "--:--"
  );
}


/* =========================================================
   AGRUPAR BATIDAS

   EXEMPLO:

   entrada
   intervalo_inicio
   intervalo_fim
   intervalo_inicio
   intervalo_fim
   saida

   RESULTADO:

   LINHA PRINCIPAL:
   Entrada | Intervalo 1 | Retorno 1 | Saída

   LINHA EXTRA:
   --:--   | Intervalo 2 | Retorno 2 | --:--

   A LINHA PRINCIPAL SEMPRE APARECE PRIMEIRO.
========================================================= */

function agruparBatidas(lista) {

  if (
    !Array.isArray(lista) ||
    lista.length === 0
  ) {

    return [];
  }


  /* =======================================================
     NORMALIZAR E ORDENAR BATIDAS
  ======================================================= */

  const batidas =
    [...lista]
      .map(
        (ponto) => ({

          ...ponto,

          tipo:
            String(
              ponto.tipo ||
              ""
            )
              .trim()
              .toLowerCase(),

          horaFormatada:
            formatarHora(
              ponto
            ),

          dataFormatada:
            formatarDataPonto(
              ponto
            ),
        })
      )
      .sort(
        (a, b) => {

          const diferenca =
            valorOrdenacao(a) -
            valorOrdenacao(b);

          if (
            diferenca !== 0
          ) {

            return diferenca;
          }

          return (
            Number(
              a.id ||
              0
            )
            -
            Number(
              b.id ||
              0
            )
          );
        }
      );


  console.log(
    "=========================================="
  );

  console.log(
    "📋 PONTOS RECEBIDOS:",
    lista
  );

  console.log(
    "📋 PONTOS ORDENADOS:",
    batidas
  );

  console.log(
    "=========================================="
  );


  /* =======================================================
     JORNADAS

     Cada item representa uma jornada.

     Uma jornada contém:

     - linha principal
     - linhas extras de intervalos
  ======================================================= */

  const jornadas = [];

  let jornadaAtual =
    null;

  let intervaloAberto =
    null;

  let contadorJornada =
    0;

  let contadorLinha =
    0;


  /* =======================================================
     CRIAR JORNADA
  ======================================================= */

  function criarJornada(
    ponto
  ) {

    contadorJornada += 1;


    const principal =
      novaLinha();


    principal.data =
      ponto?.dataFormatada ||
      null;


    principal.principal =
      true;


    principal.ordem =
      contadorLinha++;


    jornadaAtual = {

      ordem:
        contadorJornada,

      principal,

      extras:
        [],
    };


    intervaloAberto =
      null;


    return jornadaAtual;
  }


  /* =======================================================
     GARANTIR JORNADA
  ======================================================= */

  function garantirJornada(
    ponto
  ) {

    if (!jornadaAtual) {

      criarJornada(
        ponto
      );
    }


    return jornadaAtual;
  }


  /* =======================================================
     FINALIZAR JORNADA
  ======================================================= */

  function finalizarJornada() {

    if (!jornadaAtual) {
      return;
    }


    const possuiPrincipal =
      linhaTemDados(
        jornadaAtual.principal
      );


    const possuiExtras =
      jornadaAtual.extras.some(
        (linha) =>
          linhaTemDados(
            linha
          )
      );


    if (
      possuiPrincipal ||
      possuiExtras
    ) {

      jornadas.push(
        jornadaAtual
      );
    }


    jornadaAtual =
      null;


    intervaloAberto =
      null;
  }


  /* =======================================================
     PROCESSAR BATIDAS
  ======================================================= */

  for (
    const ponto
    of batidas
  ) {

    const tipo =
      ponto.tipo;


    const hora =
      ponto.horaFormatada;


    /* =====================================================
       ENTRADA

       Sempre inicia uma jornada nova.
    ===================================================== */

    if (
      tipo === "entrada"
    ) {

      /* ===================================================
         SE JÁ EXISTIA JORNADA ABERTA
         FINALIZAMOS E COMEÇAMOS OUTRA
      =================================================== */

      if (jornadaAtual) {

        finalizarJornada();
      }


      const jornada =
        criarJornada(
          ponto
        );


      jornada
        .principal
        .entrada =
          hora;


      continue;
    }


    /* =====================================================
       INTERVALO INÍCIO
    ===================================================== */

    if (
      tipo === "intervalo_inicio"
    ) {

      const jornada =
        garantirJornada(
          ponto
        );


      const principal =
        jornada.principal;


      /* ===================================================
         PRIMEIRO INTERVALO

         FICA NA LINHA PRINCIPAL
      =================================================== */

      if (
        principal.intervalo ===
        "--:--"
      ) {

        principal.intervalo =
          hora;


        intervaloAberto = {

          linha:
            principal,

          principal:
            true,
        };


        continue;
      }


      /* ===================================================
         INTERVALO EXTRA

         CRIA UMA NOVA LINHA
      =================================================== */

      const extra =
        novaLinha();


      extra.data =
        principal.data ||
        ponto.dataFormatada;


      extra.intervalo =
        hora;


      extra.principal =
        false;


      extra.ordem =
        contadorLinha++;


      jornada.extras.push(
        extra
      );


      intervaloAberto = {

        linha:
          extra,

        principal:
          false,
      };


      continue;
    }


    /* =====================================================
       RETORNO
    ===================================================== */

    if (
      tipo === "intervalo_fim"
    ) {

      const jornada =
        garantirJornada(
          ponto
        );


      /* ===================================================
         EXISTE INTERVALO ABERTO

         O retorno pertence exatamente ao último
         intervalo_inicio registrado.
      =================================================== */

      if (
        intervaloAberto?.linha
      ) {

        intervaloAberto
          .linha
          .retorno =
            hora;


        intervaloAberto =
          null;


        continue;
      }


      /* ===================================================
         FALLBACK

         Caso exista um retorno antigo sem um
         intervalo_inicio correspondente.
      =================================================== */

      const principal =
        jornada.principal;


      if (
        principal.retorno ===
        "--:--"
      ) {

        principal.retorno =
          hora;


        continue;
      }


      const extra =
        novaLinha();


      extra.data =
        principal.data ||
        ponto.dataFormatada;


      extra.retorno =
        hora;


      extra.principal =
        false;


      extra.ordem =
        contadorLinha++;


      jornada.extras.push(
        extra
      );


      continue;
    }


    /* =====================================================
       SAÍDA

       A saída SEMPRE fica na linha principal.
    ===================================================== */

    if (
      tipo === "saida"
    ) {

      const jornada =
        garantirJornada(
          ponto
        );


      jornada
        .principal
        .saida =
          hora;


      finalizarJornada();


      continue;
    }


    /* =====================================================
       AUTO

       COMPATIBILIDADE COM REGISTROS ANTIGOS
    ===================================================== */

    if (
      tipo === "auto"
    ) {

      const jornada =
        garantirJornada(
          ponto
        );


      const principal =
        jornada.principal;


      /* ===================================================
         ENTRADA
      =================================================== */

      if (
        principal.entrada ===
        "--:--"
      ) {

        principal.entrada =
          hora;


        continue;
      }


      /* ===================================================
         INTERVALO
      =================================================== */

      if (
        principal.intervalo ===
        "--:--"
      ) {

        principal.intervalo =
          hora;


        intervaloAberto = {

          linha:
            principal,

          principal:
            true,
        };


        continue;
      }


      /* ===================================================
         RETORNO
      =================================================== */

      if (
        principal.retorno ===
        "--:--"
      ) {

        principal.retorno =
          hora;


        intervaloAberto =
          null;


        continue;
      }


      /* ===================================================
         SAÍDA
      =================================================== */

      if (
        principal.saida ===
        "--:--"
      ) {

        principal.saida =
          hora;


        finalizarJornada();


        continue;
      }


      /* ===================================================
         NOVA JORNADA
      =================================================== */

      finalizarJornada();


      const nova =
        criarJornada(
          ponto
        );


      nova
        .principal
        .entrada =
          hora;
    }
  }


  /* =======================================================
     JORNADA AINDA ABERTA
  ======================================================= */

  if (jornadaAtual) {

    finalizarJornada();
  }


  /* =======================================================
     MONTAR RESULTADO

     IMPORTANTE:

     PARA CADA JORNADA:

     1º LINHA PRINCIPAL
     2º INTERVALOS EXTRAS

     NÃO USAMOS SORT GLOBAL POR HORÁRIO,
     POIS ISSO QUEBRARIA JORNADAS NOTURNAS.
  ======================================================= */

  const linhas = [];


  for (
    const jornada
    of jornadas
  ) {

    /* =====================================================
       LINHA PRINCIPAL SEMPRE PRIMEIRO
    ===================================================== */

    if (
      linhaTemDados(
        jornada.principal
      )
    ) {

      linhas.push(
        jornada.principal
      );
    }


    /* =====================================================
       DEPOIS OS INTERVALOS EXTRAS
    ===================================================== */

    const extrasOrdenados =
      [...jornada.extras]
        .sort(
          (a, b) =>
            Number(
              a.ordem ||
              0
            )
            -
            Number(
              b.ordem ||
              0
            )
        );


    for (
      const extra
      of extrasOrdenados
    ) {

      if (
        linhaTemDados(
          extra
        )
      ) {

        linhas.push(
          extra
        );
      }
    }
  }


  console.log(
    "📊 LINHAS FINAIS:",
    linhas
  );


  return linhas;
}


/* =========================================================
   COMPONENTE
========================================================= */

export default function ResultadoPontos() {

  const { state } =
    useLocation();


  const navigate =
    useNavigate();


  /* =========================================================
     ESTADOS
  ========================================================= */

  const [
    funcionario,
    setFuncionario,
  ] =
    useState(
      null
    );


  const [
    pontos,
    setPontos,
  ] =
    useState(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    erro,
    setErro,
  ] =
    useState(
      ""
    );


  /* =========================================================
     USUÁRIO
  ========================================================= */

  const usuario =
    useMemo(
      () => {

        try {

          const salvo =
            localStorage.getItem(
              "usuario"
            );


          if (!salvo) {
            return null;
          }


          return JSON.parse(
            salvo
          );

        } catch (error) {

          console.error(
            "Erro ao carregar usuário:",
            error
          );


          return null;
        }
      },
      []
    );


  /* =========================================================
     EMPRESA
  ========================================================= */

  const empresaSalva =
    useMemo(
      () => {

        try {

          let salvo =
            localStorage.getItem(
              "identidade_empresa"
            );


          if (!salvo) {

            salvo =
              localStorage.getItem(
                "empresa"
              );
          }


          if (!salvo) {
            return null;
          }


          return JSON.parse(
            salvo
          );

        } catch (error) {

          console.error(
            "Erro ao carregar empresa:",
            error
          );


          return null;
        }
      },
      []
    );


  /* =========================================================
     EMPRESA ID
  ========================================================= */

  const empresaId =
    Number(
      empresaSalva?.id ||
      empresaSalva?.empresa_id ||
      usuario?.empresa_id ||
      state?.empresa_id ||
      0
    ) ||
    null;


  /* =========================================================
     IDENTIDADE
  ========================================================= */

  const identidade =
    useMemo(
      () => {

        const nome =
          empresaSalva?.nome ||
          empresaSalva?.nome_fantasia ||
          usuario?.empresa_nome ||
          "Empresa";


        let fundoEmpresa =
          normalizarUrlImagem(
            empresaSalva?.fundo_url ||
            empresaSalva
              ?.dashboard_background_url
          );


        if (
          !fundoEmpresa &&
          empresaId
        ) {

          fundoEmpresa =
            `/api/empresas/${empresaId}/fundo`;
        }


        return {

          id:
            empresaId,

          nome,

          fundo:
            fundoEmpresa ||
            fundoPadrao,

          corPrimaria:
            empresaSalva?.cor_primaria ||
            "#0d6efd",

          corSecundaria:
            empresaSalva?.cor_secundaria ||
            "#084298",
        };
      },
      [
        empresaSalva,
        empresaId,
        usuario,
      ]
    );


  /* =========================================================
     ESTILO
  ========================================================= */

  const estiloResultado = {

    "--empresa-cor-primaria":
      identidade.corPrimaria,

    "--empresa-cor-secundaria":
      identidade.corSecundaria,

    "--empresa-dashboard-background":
      `url("${identidade.fundo}")`,
  };


  /* =========================================================
     CARREGAR PONTOS
  ========================================================= */

  useEffect(
    () => {

      let ativo =
        true;


      async function carregar() {

        try {

          setLoading(
            true
          );


          setErro(
            ""
          );


          /* =================================================
             CPF
          ================================================= */

          const cpf =
            String(
              state?.cpf ||
              ""
            )
              .replace(
                /\D/g,
                ""
              );


          if (!cpf) {

            if (ativo) {

              setErro(
                "CPF não informado para consulta."
              );
            }


            return;
          }


          /* =================================================
             EMPRESA
          ================================================= */

          if (!empresaId) {

            if (ativo) {

              setErro(
                "Empresa não identificada. Faça login novamente."
              );
            }


            return;
          }


          console.log(
            "=========================================="
          );


          console.log(
            "🔎 BUSCANDO PONTOS"
          );


          console.log(
            "CPF:",
            cpf
          );


          console.log(
            "Empresa:",
            empresaId
          );


          /* =================================================
             CONSULTAR BACKEND
          ================================================= */

          const response =
            await api.get(
              `/ponto/cpf/${cpf}`,
              {
                params: {

                  empresa_id:
                    empresaId,

                  hoje:
                    "1",
                },
              }
            );


          const dados =
            response?.data ||
            {};


          console.log(
            "📥 RESPOSTA /ponto/cpf:",
            dados
          );


          console.log(
            "👤 Funcionário:",
            dados.funcionario
          );


          console.log(
            "🕒 Pontos:",
            dados.pontos
          );


          console.log(
            "=========================================="
          );


          if (!ativo) {
            return;
          }


          /* =================================================
             FUNCIONÁRIO
          ================================================= */

          setFuncionario(
            dados.funcionario ||
            null
          );


          /* =================================================
             PONTOS
          ================================================= */

          const listaPontos =
            Array.isArray(
              dados.pontos
            )
              ? dados.pontos

              : Array.isArray(
                  dados.batidas
                )
                ? dados.batidas

                : [];


          setPontos(
            listaPontos
          );


          /* =================================================
             FUNCIONÁRIO NÃO ENCONTRADO
          ================================================= */

          if (
            !dados.funcionario
          ) {

            setErro(
              "Funcionário não encontrado."
            );
          }

        } catch (error) {

          console.error(
            "❌ Erro buscando pontos:",
            error
          );


          console.error(
            "❌ Backend:",
            error?.response?.data
          );


          if (!ativo) {
            return;
          }


          setFuncionario(
            null
          );


          setPontos(
            []
          );


          setErro(
            error?.response?.data?.error ||
            "Não foi possível consultar os pontos."
          );

        } finally {

          if (ativo) {

            setLoading(
              false
            );
          }
        }
      }


      carregar();


      return () => {

        ativo =
          false;
      };

    },
    [
      state?.cpf,
      empresaId,
    ]
  );


  /* =========================================================
     LINHAS
  ========================================================= */

  const linhas =
    useMemo(
      () =>
        agruparBatidas(
          pontos
        ),
      [
        pontos,
      ]
    );


  /* =========================================================
     DATA DE HOJE
  ========================================================= */

  const dataHoje =
    new Date()
      .toLocaleDateString(
        "pt-BR"
      );


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {

    return (

      <div
        className="resultadoContainer"
        style={
          estiloResultado
        }
      >

        <div
          className="resultadoCard"
        >

          <p
            className="semDados"
          >
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

      <div
        className="resultadoContainer"
        style={
          estiloResultado
        }
      >

        <div
          className="resultadoCard"
        >

          <p
            className="semDados"
          >

            {
              erro ||
              "Nenhum dado encontrado."
            }

          </p>


          <div
            className="resultadoActions"
          >

            <button
              type="button"

              className="btnVoltar"

              onClick={
                () =>
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

    <div
      className="resultadoContainer"
      style={
        estiloResultado
      }
    >

      <div
        className="resultadoCard"
      >

        <h2>
          Resumo de Hoje
        </h2>


        {/* =================================================
            INFORMAÇÕES
        ================================================= */}

        <div
          className="resultadoInfo"
        >

          <span>

            <strong>
              Colaborador:
            </strong>

            {" "}

            {
              funcionario.nome
            }

          </span>


          <span>

            <strong>
              CPF:
            </strong>

            {" "}

            {
              funcionario.cpf
            }

          </span>


          <span>

            <strong>
              Data:
            </strong>

            {" "}

            {
              dataHoje
            }

          </span>


          {
            identidade.nome &&
            (

              <span>

                <strong>
                  Empresa:
                </strong>

                {" "}

                {
                  identidade.nome
                }

              </span>
            )
          }

        </div>


        {/* =================================================
            TABELA
        ================================================= */}

        <div
          className="tableResponsive"
        >

          <table
            className="resultadoTable"
          >

            <thead>

              <tr>

                <th>
                  Data
                </th>

                <th>
                  Nome
                </th>

                <th>
                  Entrada
                </th>

                <th>
                  Intervalo
                </th>

                <th>
                  Retorno
                </th>

                <th>
                  Saída
                </th>

              </tr>

            </thead>


            <tbody>

              {
                linhas.length > 0
                  ? (

                    linhas.map(
                      (
                        linha,
                        index
                      ) => (

                        <tr
                          key={
                            `${index}-${linha.data || ""}-${linha.ordem || 0}`
                          }
                        >

                          <td>

                            {
                              linha.data ||
                              dataHoje
                            }

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
                  )
                  : (

                    <tr>

                      <td
                        colSpan="6"
                        className="semDados"
                      >
                        Nenhuma batida encontrada.
                      </td>

                    </tr>
                  )
              }

            </tbody>

          </table>

        </div>


        {/* =================================================
            BOTÕES
        ================================================= */}

        <div
          className="resultadoActions"
        >

          <button
            type="button"

            className="btnVoltar"

            onClick={
              () =>
                navigate(
                  "/buscar-pontos"
                )
            }
          >
            Nova Consulta
          </button>


          <button
            type="button"

            className="btnInicio"

            onClick={
              () =>
                navigate(
                  "/ponto"
                )
            }
          >
            Voltar ao Início
          </button>

        </div>

      </div>

    </div>
  );
}