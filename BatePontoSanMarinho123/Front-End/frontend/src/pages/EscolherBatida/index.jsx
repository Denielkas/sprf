import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  FaSignInAlt,
  FaCoffee,
  FaUndoAlt,
  FaSignOutAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaWifi,
} from "react-icons/fa";

import { api } from "../../services/api";

import {
  salvarPontoOffline,
  salvarEstadoFuncionario,
  buscarEstadoFuncionario,
  calcularPermissoesLocais,
  atualizarEstadoAposBatidaOffline,
  contarPontosPendentes,
} from "../../services/offlinePonto";

import {
  sincronizarPontosOffline,
} from "../../services/sincronizacaoOffline";

import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./EscolherBatida.css";


/* =========================================================
   PERMISSÕES INICIAIS

   Enquanto não sabemos o estado da jornada,
   nenhum botão fica liberado.
========================================================= */

const permissoesIniciais = {
  entrada: false,
  intervalo_inicio: false,
  intervalo_fim: false,
  saida: false,
};


/* =========================================================
   NOMES DAS BATIDAS
========================================================= */

const nomesBatidas = {
  entrada:
    "Entrada",

  intervalo_inicio:
    "Início do intervalo",

  intervalo_fim:
    "Retorno do intervalo",

  saida:
    "Saída",
};


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

  if (
    valor.startsWith("/")
  ) {
    return valor;
  }

  return `/${valor}`;
}


/* =========================================================
   NORMALIZAR PERMISSÕES VINDAS DO BACKEND
========================================================= */

function normalizarPermissoes(data) {
  console.log(
    "📋 RESPOSTA RECEBIDA PARA PERMISSÕES:",
    data
  );

  const p =
    data?.permissoes;

  if (
    p &&
    typeof p === "object"
  ) {
    const resultado = {
      entrada:
        p.entrada === true,

      intervalo_inicio:
        p.intervalo_inicio === true,

      intervalo_fim:
        p.intervalo_fim === true,

      saida:
        p.saida === true,
    };

    console.log(
      "🔓 PERMISSÕES DEFINIDAS:",
      resultado
    );

    return resultado;
  }

  console.warn(
    "⚠️ Não foi recebido objeto de permissões."
  );

  return {
    ...permissoesIniciais,
  };
}


/* =========================================================
   COMPONENTE
========================================================= */

export default function EscolherBatida() {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  /* =======================================================
     FUNCIONÁRIO
  ======================================================= */

  const funcionario =
    location.state?.funcionario ||
    null;


  /* =======================================================
     EMPRESA

     Para operações ONLINE, a empresa oficial
     continua sendo a empresa do JWT no backend.

     Aqui usamos empresa_id para:
     - identidade visual;
     - separar armazenamento offline;
     - impedir mistura local entre empresas.
  ======================================================= */

  const empresaId =
    Number(
      funcionario?.empresa_id ||
      0
    ) || null;


  /* =======================================================
     IDENTIDADE DA EMPRESA
  ======================================================= */

  const identidadeEmpresa =
    useMemo(() => {
      try {
        const identidade =
          localStorage.getItem(
            "identidade_empresa"
          );

        if (identidade) {
          return JSON.parse(
            identidade
          );
        }

        const empresa =
          localStorage.getItem(
            "empresa"
          );

        if (empresa) {
          return JSON.parse(
            empresa
          );
        }

        return null;

      } catch (error) {
        console.error(
          "Erro ao carregar identidade:",
          error
        );

        return null;
      }
    }, []);


  /* =======================================================
     CORES
  ======================================================= */

  const corPrimaria =
    identidadeEmpresa?.cor_primaria ||
    "#ff8c00";

  const corSecundaria =
    identidadeEmpresa?.cor_secundaria ||
    "#b85f00";


  /* =======================================================
     FUNDO
  ======================================================= */

  let fundo =
    normalizarUrlImagem(
      identidadeEmpresa?.fundo_url ||
      identidadeEmpresa?.dashboard_background_url
    );

  if (
    !fundo &&
    empresaId
  ) {
    fundo =
      `/api/empresas/${empresaId}/fundo`;
  }

  fundo =
    fundo ||
    fundoPadrao;


  /* =======================================================
     ESTILO
  ======================================================= */

  const estiloBatida = {
    "--cor-primaria":
      corPrimaria,

    "--cor-secundaria":
      corSecundaria,

    "--batida-background":
      `url("${fundo}")`,
  };


  /* =======================================================
     ESTADOS
  ======================================================= */

  const [
    loadingStatus,
    setLoadingStatus,
  ] =
    useState(true);


  const [
    registrando,
    setRegistrando,
  ] =
    useState(false);


  const [
    permissoes,
    setPermissoes,
  ] =
    useState(
      permissoesIniciais
    );


  /* =======================================================
     ESTADOS OFFLINE
  ======================================================= */

  const [
    online,
    setOnline,
  ] =
    useState(
      navigator.onLine
    );


  const [
    pontosPendentes,
    setPontosPendentes,
  ] =
    useState(0);


  const [
    modoOfflinePreparado,
    setModoOfflinePreparado,
  ] =
    useState(false);


  /* =======================================================
     MODAL
  ======================================================= */

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);


  const [
    modalTitulo,
    setModalTitulo,
  ] =
    useState("");


  const [
    modalTexto,
    setModalTexto,
  ] =
    useState("");


  const [
    modalErro,
    setModalErro,
  ] =
    useState(false);


  /* =======================================================
     ABRIR MODAL
  ======================================================= */

  function abrirModal(
    titulo,
    texto,
    erro = false
  ) {
    setModalTitulo(
      titulo
    );

    setModalTexto(
      texto
    );

    setModalErro(
      erro
    );

    setModalOpen(
      true
    );
  }


  /* =======================================================
     FECHAR MODAL
  ======================================================= */

  function fecharModal() {
    setModalOpen(
      false
    );
  }


  /* =======================================================
     CONTAR PONTOS OFFLINE PENDENTES
  ======================================================= */

  const atualizarContadorPendentes =
    useCallback(
      async () => {
        try {
          const quantidade =
            await contarPontosPendentes();

          setPontosPendentes(
            quantidade
          );

        } catch (error) {
          console.error(
            "❌ Erro ao contar pontos offline:",
            error
          );
        }
      },
      []
    );


  /* =======================================================
     SALVAR ESTADO OFICIAL NO BANCO LOCAL

     Sempre que conseguimos consultar o servidor,
     guardamos as permissões atuais.

     Assim, se a internet cair depois,
     sabemos exatamente em qual estado a jornada
     estava.
  ======================================================= */

  const salvarEstadoOficialLocal =
    useCallback(
      async (
        novasPermissoes,
        ultimaBatida = null
      ) => {
        if (
          !empresaId ||
          !funcionario?.id
        ) {
          return;
        }

        try {
          await salvarEstadoFuncionario({
            empresa_id:
              empresaId,

            funcionario_id:
              Number(
                funcionario.id
              ),

            ultima_batida:
              ultimaBatida,

            permissoes:
              novasPermissoes,
          });

          setModoOfflinePreparado(
            true
          );

          console.log(
            "💾 Estado da jornada salvo localmente."
          );

        } catch (error) {
          console.error(
            "❌ Erro ao salvar estado local:",
            error
          );
        }
      },
      [
        empresaId,
        funcionario?.id,
      ]
    );


  /* =======================================================
     CARREGAR ESTADO OFFLINE
  ======================================================= */

  const carregarEstadoOffline =
    useCallback(
      async () => {
        if (
          !empresaId ||
          !funcionario?.id
        ) {
          return false;
        }

        try {
          console.log(
            "=========================================="
          );

          console.log(
            "📴 CARREGANDO ESTADO OFFLINE"
          );

          console.log({
            empresa_id:
              empresaId,

            funcionario_id:
              funcionario.id,
          });

          console.log(
            "=========================================="
          );


          const estado =
            await buscarEstadoFuncionario(
              empresaId,
              Number(
                funcionario.id
              )
            );


          if (!estado) {
            console.warn(
              "⚠️ Funcionário ainda não possui estado offline salvo."
            );

            setModoOfflinePreparado(
              false
            );

            setPermissoes({
              ...permissoesIniciais,
            });

            return false;
          }


          const permissoesOffline =
            estado.permissoes ||
            calcularPermissoesLocais(
              estado.ultima_batida
            );


          console.log(
            "🔓 PERMISSÕES OFFLINE:",
            permissoesOffline
          );


          setPermissoes(
            permissoesOffline
          );

          setModoOfflinePreparado(
            true
          );


          return true;

        } catch (error) {
          console.error(
            "❌ Erro ao carregar estado offline:",
            error
          );

          setPermissoes({
            ...permissoesIniciais,
          });

          setModoOfflinePreparado(
            false
          );

          return false;
        }
      },
      [
        empresaId,
        funcionario?.id,
      ]
    );


  /* =======================================================
     SINCRONIZAR FILA OFFLINE
  ======================================================= */

  const tentarSincronizar =
    useCallback(
      async (
        mostrarMensagem = false
      ) => {
        if (
          !navigator.onLine
        ) {
          setOnline(
            false
          );

          return {
            ok: false,
            motivo:
              "offline",
          };
        }


        try {
          console.log(
            "=========================================="
          );

          console.log(
            "🔄 VERIFICANDO PONTOS OFFLINE"
          );

          console.log(
            "=========================================="
          );


          const resultado =
            await sincronizarPontosOffline();


          await atualizarContadorPendentes();


          if (
            resultado?.ok
          ) {
            setOnline(
              true
            );


            if (
              mostrarMensagem &&
              Number(
                resultado?.sincronizados ||
                0
              ) > 0
            ) {
              abrirModal(
                "Sincronização concluída",

                `${resultado.sincronizados} ponto(s) offline sincronizado(s) com sucesso.`,

                false
              );
            }
          }


          return resultado;

        } catch (error) {
          console.error(
            "❌ Erro na sincronização automática:",
            error
          );

          return {
            ok: false,
            motivo:
              "erro",
          };
        }
      },
      [
        atualizarContadorPendentes,
      ]
    );


  /* =======================================================
     SEM FUNCIONÁRIO
  ======================================================= */

  useEffect(() => {
    if (
      !funcionario?.id
    ) {
      navigate(
        "/ponto",
        {
          replace: true,
        }
      );
    }
  }, [
    funcionario?.id,
    navigate,
  ]);


  /* =======================================================
     CARREGAR STATUS DAS BATIDAS

     ONLINE:
     backend determina o estado oficial.

     OFFLINE:
     IndexedDB determina o estado conhecido
     pelo terminal.
  ======================================================= */

  useEffect(() => {
    let ativo =
      true;


    async function carregarStatus() {
      if (
        !funcionario?.id
      ) {
        if (ativo) {
          setLoadingStatus(
            false
          );
        }

        return;
      }


      try {
        if (ativo) {
          setLoadingStatus(
            true
          );

          setPermissoes({
            ...permissoesIniciais,
          });
        }


        await atualizarContadorPendentes();


        /* =================================================
           SEM INTERNET
        ================================================= */

        if (
          !navigator.onLine
        ) {
          console.log(
            "📴 Navegador está offline."
          );

          setOnline(
            false
          );


          const conseguiu =
            await carregarEstadoOffline();


          if (
            !conseguiu &&
            ativo
          ) {
            abrirModal(
              "Terminal offline",

              "Este funcionário ainda não possui um estado de jornada salvo neste terminal. Conecte à internet pelo menos uma vez antes de usar o ponto offline.",

              true
            );
          }


          return;
        }


        /* =================================================
           ONLINE

           Antes de consultar o estado atual,
           tentamos enviar pontos que ficaram
           pendentes.
        ================================================= */

        setOnline(
          true
        );


        await tentarSincronizar(
          false
        );


        console.log(
          "=========================================="
        );

        console.log(
          "🔎 CONSULTANDO STATUS"
        );

        console.log({
          funcionario_id:
            funcionario.id,

          empresa_id_front:
            empresaId,
        });

        console.log(
          "=========================================="
        );


        const { data } =
          await api.get(
            `/ponto/status-batidas/${funcionario.id}`
          );


        if (!ativo) {
          return;
        }


        console.log(
          "=========================================="
        );

        console.log(
          "📥 STATUS RECEBIDO DO BACKEND:"
        );

        console.log(
          data
        );

        console.log(
          "=========================================="
        );


        const novasPermissoes =
          normalizarPermissoes(
            data
          );


        setPermissoes(
          novasPermissoes
        );


        /*
          Precisamos guardar qual foi a última
          batida para conseguir recalcular as
          permissões posteriormente.

          O controller pode retornar ultima_batida.
          Caso não retorne, tentamos obter pelo
          próximo tipo ou pelas batidas retornadas.
        */

        let ultimaBatida =
          data?.ultima_batida ||
          null;


        if (
          !ultimaBatida &&
          Array.isArray(
            data?.batidas
          ) &&
          data.batidas.length
        ) {
          ultimaBatida =
            data.batidas[
              data.batidas.length - 1
            ]?.tipo ||
            null;
        }


        await salvarEstadoOficialLocal(
          novasPermissoes,
          ultimaBatida
        );


        setOnline(
          true
        );

      } catch (error) {
        console.error(
          "❌ Erro ao consultar status:",
          error
        );

        console.error(
          "RESPOSTA:",
          error?.response?.data
        );


        if (!ativo) {
          return;
        }


        /*
          IMPORTANTE:

          Se houve uma resposta HTTP do backend,
          significa que o servidor está acessível.

          Exemplo:
          401
          403
          404
          500

          Isso NÃO deve ativar modo offline.
        */

        if (
          error?.response
        ) {
          setOnline(
            true
          );

          setPermissoes({
            ...permissoesIniciais,
          });


          abrirModal(
            "Atenção",

            error?.response?.data?.error ||
            error?.response?.data?.erro ||
            error?.response?.data?.message ||
            "Não foi possível verificar o status das batidas.",

            true
          );

          return;
        }


        /*
          Não houve resposta do servidor.

          Pode ser:
          - internet caiu;
          - backend inacessível;
          - rede local caiu.

          Neste caso podemos usar o estado local.
        */

        console.warn(
          "📴 Servidor não respondeu. Tentando modo offline."
        );


        setOnline(
          false
        );


        const conseguiu =
          await carregarEstadoOffline();


        if (!conseguiu) {
          setPermissoes({
            ...permissoesIniciais,
          });


          abrirModal(
            "Terminal offline",

            "Não foi possível acessar o servidor e este funcionário ainda não está preparado para registrar ponto offline neste terminal.",

            true
          );
        }

      } finally {
        if (ativo) {
          setLoadingStatus(
            false
          );
        }
      }
    }


    carregarStatus();


    return () => {
      ativo =
        false;
    };

  }, [
    funcionario?.id,
    empresaId,
    atualizarContadorPendentes,
    carregarEstadoOffline,
    salvarEstadoOficialLocal,
    tentarSincronizar,
  ]);


  /* =======================================================
     DETECTAR INTERNET CAINDO / VOLTANDO
  ======================================================= */

  useEffect(() => {
    async function ficouOffline() {
      console.log(
        "=========================================="
      );

      console.log(
        "📴 INTERNET DESCONECTADA"
      );

      console.log(
        "=========================================="
      );


      setOnline(
        false
      );


      await carregarEstadoOffline();


      await atualizarContadorPendentes();
    }


    async function ficouOnline() {
      console.log(
        "=========================================="
      );

      console.log(
        "🌐 INTERNET RESTABELECIDA"
      );

      console.log(
        "=========================================="
      );


      /*
        Primeiro marcamos como conectado.
        A API posteriormente confirma se o
        servidor realmente está acessível.
      */

      setOnline(
        true
      );


      const resultado =
        await tentarSincronizar(
          false
        );


      await atualizarContadorPendentes();


      if (
        resultado?.ok &&
        Number(
          resultado?.sincronizados ||
          0
        ) > 0
      ) {
        abrirModal(
          "Pontos sincronizados!",

          `${resultado.sincronizados} ponto(s) registrado(s) offline foram enviados ao servidor.`,

          false
        );
      }


      /*
        Após sincronizar, buscamos novamente
        o estado oficial do funcionário atual.
      */

      if (
        resultado?.ok &&
        funcionario?.id
      ) {
        try {
          const { data } =
            await api.get(
              `/ponto/status-batidas/${funcionario.id}`
            );


          const novasPermissoes =
            normalizarPermissoes(
              data
            );


          setPermissoes(
            novasPermissoes
          );


          let ultimaBatida =
            data?.ultima_batida ||
            null;


          if (
            !ultimaBatida &&
            Array.isArray(
              data?.batidas
            ) &&
            data.batidas.length
          ) {
            ultimaBatida =
              data.batidas[
                data.batidas.length - 1
              ]?.tipo ||
              null;
          }


          await salvarEstadoOficialLocal(
            novasPermissoes,
            ultimaBatida
          );

        } catch (error) {
          console.error(
            "Erro ao atualizar status após sincronização:",
            error
          );
        }
      }
    }


    window.addEventListener(
      "offline",
      ficouOffline
    );


    window.addEventListener(
      "online",
      ficouOnline
    );


    return () => {
      window.removeEventListener(
        "offline",
        ficouOffline
      );

      window.removeEventListener(
        "online",
        ficouOnline
      );
    };

  }, [
    funcionario?.id,
    carregarEstadoOffline,
    atualizarContadorPendentes,
    tentarSincronizar,
    salvarEstadoOficialLocal,
  ]);


  /* =======================================================
     BATER PONTO OFFLINE
  ======================================================= */

  async function baterPontoOffline(
    tipo
  ) {
    if (
      !empresaId
    ) {
      throw new Error(
        "Empresa não identificada para o modo offline."
      );
    }


    if (
      !funcionario?.id
    ) {
      throw new Error(
        "Funcionário não identificado."
      );
    }


    if (
      !modoOfflinePreparado
    ) {
      throw new Error(
        "Este funcionário ainda não está preparado para registrar ponto offline neste terminal."
      );
    }


    if (
      permissoes[tipo] !== true
    ) {
      throw new Error(
        "Esta batida não está liberada neste momento."
      );
    }


    console.log(
      "=========================================="
    );

    console.log(
      "📴 SALVANDO BATIDA OFFLINE"
    );

    console.log({
      empresa_id:
        empresaId,

      funcionario_id:
        funcionario.id,

      funcionario_nome:
        funcionario.nome,

      tipo,
    });

    console.log(
      "=========================================="
    );


    /* =====================================================
       SALVAR PONTO NA FILA LOCAL
    ===================================================== */

    const ponto =
      await salvarPontoOffline({
        empresa_id:
          empresaId,

        funcionario_id:
          Number(
            funcionario.id
          ),

        funcionario_nome:
          funcionario.nome ||
          "Funcionário",

        tipo,
      });


    console.log(
      "💾 PONTO SALVO NO INDEXEDDB:",
      ponto
    );


    /* =====================================================
       ATUALIZAR ESTADO DA JORNADA LOCAL

       Exemplo:

       entrada
         ↓
       intervalo e saída liberados
    ===================================================== */

    const novoEstado =
      await atualizarEstadoAposBatidaOffline({
        empresa_id:
          empresaId,

        funcionario_id:
          Number(
            funcionario.id
          ),

        tipo,
      });


    if (
      novoEstado?.permissoes
    ) {
      setPermissoes(
        novoEstado.permissoes
      );
    } else {
      setPermissoes(
        calcularPermissoesLocais(
          tipo
        )
      );
    }


    await atualizarContadorPendentes();


    return ponto;
  }


  /* =======================================================
     BATER PONTO
  ======================================================= */

  async function baterPonto(
    tipo
  ) {
    /* =====================================================
       BLOQUEAR DUPLO CLIQUE
    ===================================================== */

    if (
      registrando ||
      loadingStatus
    ) {
      return;
    }


    /* =====================================================
       VERIFICAR PERMISSÃO LOCAL
    ===================================================== */

    if (
      permissoes[tipo] !== true
    ) {
      console.warn(
        "⚠️ Batida bloqueada:",
        {
          tipo,
          permissoes,
        }
      );

      return;
    }


    /* =====================================================
       FUNCIONÁRIO
    ===================================================== */

    if (
      !funcionario?.id
    ) {
      abrirModal(
        "Atenção",
        "Funcionário não identificado.",
        true
      );

      return;
    }


    try {
      setRegistrando(
        true
      );


      /* ===================================================
         NAVEGADOR JÁ SABE QUE ESTÁ OFFLINE
      =================================================== */

      if (
        !navigator.onLine
      ) {
        setOnline(
          false
        );


        await baterPontoOffline(
          tipo
        );


        abrirModal(
          "Ponto salvo offline!",

          `${nomesBatidas[tipo]} registrada neste dispositivo. O ponto será enviado automaticamente quando a internet voltar.`,

          false
        );


        /*
          Mantemos o mesmo comportamento
          da tela original.
        */

        setTimeout(
          () => {
            navigate(
              "/ponto",
              {
                replace: true,
              }
            );
          },
          1400
        );


        return;
      }


      /* ===================================================
         TENTAR REGISTRAR ONLINE
      =================================================== */

      const payload = {
        funcionario_id:
          Number(
            funcionario.id
          ),

        tipo:
          tipo,
      };


      console.log(
        "=========================================="
      );

      console.log(
        "📤 REGISTRANDO PONTO ONLINE:"
      );

      console.log(
        payload
      );

      console.log(
        "PERMISSÕES ATUAIS:"
      );

      console.log(
        permissoes
      );

      console.log(
        "=========================================="
      );


      try {
        const { data } =
          await api.post(
            "/ponto/bater",
            payload
          );


        console.log(
          "=========================================="
        );

        console.log(
          "✅ PONTO REGISTRADO ONLINE:"
        );

        console.log(
          data
        );

        console.log(
          "=========================================="
        );


        setOnline(
          true
        );


        /* =================================================
           ATUALIZAR PERMISSÕES
        ================================================= */

        let novasPermissoes =
          null;


        if (
          data?.permissoes
        ) {
          novasPermissoes =
            normalizarPermissoes(
              data
            );


          setPermissoes(
            novasPermissoes
          );
        }


        /*
          Se por algum motivo o backend não
          devolver permissoes, calculamos apenas
          para o backup local.

          A próxima consulta ao servidor continuará
          sendo a fonte oficial.
        */

        if (!novasPermissoes) {
          novasPermissoes =
            calcularPermissoesLocais(
              tipo
            );
        }


        /* =================================================
           SALVAR ESTADO PARA FUTURO USO OFFLINE
        ================================================= */

        await salvarEstadoOficialLocal(
          novasPermissoes,
          tipo
        );


        abrirModal(
          "Ponto registrado!",

          data?.message ||
          data?.mensagem ||
          `${nomesBatidas[tipo]} registrado com sucesso.`,

          false
        );


        /* =================================================
           VOLTAR PARA TELA INICIAL
        ================================================= */

        setTimeout(
          () => {
            navigate(
              "/ponto",
              {
                replace: true,
              }
            );
          },
          1400
        );


        return;

      } catch (errorOnline) {
        console.error(
          "=========================================="
        );

        console.error(
          "❌ ERRO NA TENTATIVA ONLINE:"
        );

        console.error(
          errorOnline
        );

        console.error(
          "=========================================="
        );


        /* =================================================
           SERVIDOR RESPONDEU

           Se recebemos status HTTP, não é uma simples
           queda de internet.

           Pode ser:
           400
           401
           403
           500 etc.

           NÃO devemos transformar uma rejeição do
           servidor em ponto offline.
        ================================================= */

        if (
          errorOnline?.response
        ) {
          setOnline(
            true
          );


          if (
            errorOnline
              ?.response
              ?.data
              ?.permissoes
          ) {
            setPermissoes(
              normalizarPermissoes(
                errorOnline.response.data
              )
            );
          }


          throw errorOnline;
        }


        /* =================================================
           SERVIDOR NÃO RESPONDEU

           Neste caso podemos cair para o modo offline.
        ================================================= */

        console.warn(
          "📴 Servidor não respondeu."
        );

        console.warn(
          "💾 Tentando registrar localmente..."
        );


        setOnline(
          false
        );


        /*
          Antes de salvar, verificamos se existe
          estado local válido.
        */

        const estadoExiste =
          await carregarEstadoOffline();


        if (!estadoExiste) {
          throw new Error(
            "Servidor indisponível e este funcionário ainda não possui estado offline salvo neste terminal."
          );
        }


        /*
          IMPORTANTE:

          carregarEstadoOffline atualizou o state
          do React, mas setState é assíncrono.

          Portanto precisamos consultar diretamente
          o IndexedDB para validar a permissão.
        */

        const estadoAtual =
          await buscarEstadoFuncionario(
            empresaId,
            Number(
              funcionario.id
            )
          );


        const permissoesAtuais =
          estadoAtual?.permissoes ||
          calcularPermissoesLocais(
            estadoAtual?.ultima_batida
          );


        if (
          permissoesAtuais?.[tipo] !==
          true
        ) {
          throw new Error(
            "Esta batida não está liberada no estado offline atual."
          );
        }


        /* =================================================
           SALVAR OFFLINE

           Aqui fazemos diretamente para evitar depender
           do state do React que pode ainda estar sendo
           atualizado.
        ================================================= */

        const ponto =
          await salvarPontoOffline({
            empresa_id:
              empresaId,

            funcionario_id:
              Number(
                funcionario.id
              ),

            funcionario_nome:
              funcionario.nome ||
              "Funcionário",

            tipo,
          });


        console.log(
          "💾 Ponto salvo após falha da rede:",
          ponto
        );


        const novoEstado =
          await atualizarEstadoAposBatidaOffline({
            empresa_id:
              empresaId,

            funcionario_id:
              Number(
                funcionario.id
              ),

            tipo,
          });


        if (
          novoEstado?.permissoes
        ) {
          setPermissoes(
            novoEstado.permissoes
          );
        }


        await atualizarContadorPendentes();


        abrirModal(
          "Ponto salvo offline!",

          `${nomesBatidas[tipo]} registrada neste dispositivo. O ponto será sincronizado quando o servidor voltar a responder.`,

          false
        );


        setTimeout(
          () => {
            navigate(
              "/ponto",
              {
                replace: true,
              }
            );
          },
          1400
        );


        return;
      }

    } catch (error) {
      console.error(
        "=========================================="
      );

      console.error(
        "❌ ERRO AO REGISTRAR PONTO:"
      );

      console.error(
        error
      );

      console.error(
        "RESPOSTA:",
        error?.response?.data
      );

      console.error(
        "=========================================="
      );


      if (
        error?.response?.data?.permissoes
      ) {
        setPermissoes(
          normalizarPermissoes(
            error.response.data
          )
        );
      }


      abrirModal(
        "Não foi possível registrar",

        error?.response?.data?.error ||
        error?.response?.data?.erro ||
        error?.response?.data?.message ||
        error?.message ||
        "Erro ao registrar ponto.",

        true
      );

    } finally {
      setRegistrando(
        false
      );
    }
  }


  /* =======================================================
     CANCELAR
  ======================================================= */

  function voltar() {
    navigate(
      "/ponto",
      {
        replace: true,
      }
    );
  }


  /* =======================================================
     SEM FUNCIONÁRIO
  ======================================================= */

  if (
    !funcionario?.id
  ) {
    return null;
  }


  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div
      className="batida"
      style={
        estiloBatida
      }
    >

      <main
        className="batida-container"
      >

        {/* =================================================
            STATUS DA CONEXÃO

            Mantido inline para não exigir alteração
            imediata no CSS.
        ================================================= */}

        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding:
                "7px 13px",
              borderRadius:
                "999px",
              fontSize:
                "13px",
              fontWeight:
                "700",

              background:
                online
                  ? "rgba(30, 150, 80, 0.15)"
                  : "rgba(220, 60, 60, 0.18)",

              color:
                online
                  ? "#1f8f50"
                  : "#c73535",

              border:
                online
                  ? "1px solid rgba(30, 150, 80, 0.25)"
                  : "1px solid rgba(220, 60, 60, 0.30)",
            }}
          >
            <FaWifi />

            {
              online
                ? "Online"
                : "Sem internet"
            }
          </div>
        </div>


        {/* =================================================
            PONTOS PENDENTES
        ================================================= */}

        {
          pontosPendentes > 0 &&
          (
            <div
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                marginBottom:
                  "14px",
                padding:
                  "10px 14px",
                borderRadius:
                  "10px",
                textAlign:
                  "center",
                fontSize:
                  "13px",
                fontWeight:
                  "700",
                background:
                  "rgba(255, 193, 7, 0.15)",
                border:
                  "1px solid rgba(255, 193, 7, 0.30)",
                color:
                  "#8a6500",
              }}
            >
              {
                pontosPendentes === 1
                  ? "1 ponto aguardando sincronização"
                  : `${pontosPendentes} pontos aguardando sincronização`
              }
            </div>
          )
        }


        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          className="batida-cabecalho"
        >

          <h2>

            Olá,{" "}

            <span>
              {
                funcionario.nome ||
                "Funcionário"
              }
            </span>

          </h2>


          <p>
            {
              loadingStatus
                ? "Verificando batidas disponíveis..."
                : online
                  ? "Qual ponto deseja registrar?"
                  : modoOfflinePreparado
                    ? "Modo offline: escolha o ponto que deseja registrar."
                    : "Modo offline indisponível para este funcionário."
            }
          </p>

        </div>


        {/* =================================================
            BOTÕES
        ================================================= */}

        <div
          className="botoes"
        >

          {/* ===============================================
              ENTRADA
          =============================================== */}

          <button
            type="button"

            className={
              `btn entrada ${
                !permissoes.entrada
                  ? "disabled"
                  : ""
              }`
            }

            disabled={
              permissoes.entrada !== true ||
              loadingStatus ||
              registrando
            }

            onClick={() =>
              baterPonto(
                "entrada"
              )
            }
          >

            <FaSignInAlt
              className="icon"
            />

            <span>
              Entrada
            </span>

          </button>


          {/* ===============================================
              INTERVALO
          =============================================== */}

          <button
            type="button"

            className={
              `btn intervalo ${
                !permissoes.intervalo_inicio
                  ? "disabled"
                  : ""
              }`
            }

            disabled={
              permissoes.intervalo_inicio !== true ||
              loadingStatus ||
              registrando
            }

            onClick={() =>
              baterPonto(
                "intervalo_inicio"
              )
            }
          >

            <FaCoffee
              className="icon"
            />

            <span>
              Intervalo
            </span>

          </button>


          {/* ===============================================
              RETORNO
          =============================================== */}

          <button
            type="button"

            className={
              `btn retorno ${
                !permissoes.intervalo_fim
                  ? "disabled"
                  : ""
              }`
            }

            disabled={
              permissoes.intervalo_fim !== true ||
              loadingStatus ||
              registrando
            }

            onClick={() =>
              baterPonto(
                "intervalo_fim"
              )
            }
          >

            <FaUndoAlt
              className="icon"
            />

            <span>
              Retorno
            </span>

          </button>


          {/* ===============================================
              SAÍDA
          =============================================== */}

          <button
            type="button"

            className={
              `btn saida ${
                !permissoes.saida
                  ? "disabled"
                  : ""
              }`
            }

            disabled={
              permissoes.saida !== true ||
              loadingStatus ||
              registrando
            }

            onClick={() =>
              baterPonto(
                "saida"
              )
            }
          >

            <FaSignOutAlt
              className="icon"
            />

            <span>
              Saída
            </span>

          </button>

        </div>


        {/* =================================================
            CANCELAR
        ================================================= */}

        <button
          type="button"

          className="btn-voltar-batida"

          disabled={
            registrando
          }

          onClick={
            voltar
          }
        >
          Cancelar
        </button>

      </main>


      {/* ===================================================
          MODAL
      =================================================== */}

      {
        modalOpen &&
        (
          <div
            className="modal-ponto"

            onClick={
              modalErro
                ? fecharModal
                : undefined
            }
          >

            <div
              className={
                `modal-box ${
                  modalErro
                    ? "modal-box-erro"
                    : "modal-box-sucesso"
                }`
              }

              onClick={
                (event) =>
                  event.stopPropagation()
              }
            >

              {
                modalErro
                  ? (
                    <FaExclamationCircle
                      className="
                        modal-icon
                        modal-icon-erro
                      "
                    />
                  )
                  : (
                    <FaCheckCircle
                      className="
                        modal-icon
                        modal-icon-sucesso
                      "
                    />
                  )
              }


              <h3>
                {
                  modalTitulo
                }
              </h3>


              <p>
                {
                  modalTexto
                }
              </p>


              {
                modalErro &&
                (
                  <button
                    type="button"

                    className="modal-fechar"

                    onClick={
                      fecharModal
                    }
                  >
                    Entendi
                  </button>
                )
              }

            </div>

          </div>
        )
      }

    </div>
  );
}