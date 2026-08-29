import {
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
} from "react-icons/fa";

import { api } from "../../services/api";

import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./EscolherBatida.css";


/* =========================================================
   PERMISSÕES INICIAIS

   IMPORTANTE:
   Enquanto o backend ainda não respondeu,
   nenhum botão fica liberado.

   Isso evita o usuário clicar em Entrada
   antes de o status real ser carregado.
========================================================= */

const permissoesIniciais = {
  entrada: false,
  intervalo_inicio: false,
  intervalo_fim: false,
  saida: false,
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

   O BACKEND É A FONTE OFICIAL DO ESTADO DA JORNADA.

   Exemplo:

   permissoes: {
     entrada: false,
     intervalo_inicio: false,
     intervalo_fim: true,
     saida: false
   }

   Nesse caso SOMENTE Retorno fica liberado.
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
      "🔓 PERMISSÕES DEFINIDAS PELO BACKEND:",
      resultado
    );

    return resultado;
  }

  console.warn(
    "⚠️ Backend não retornou o objeto permissoes."
  );

  /*
    Por segurança, se o backend não informou
    o estado da jornada, não liberamos nenhum
    botão automaticamente.
  */

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

     Mantido para identidade visual.

     Para bater ponto, a empresa oficial é
     determinada pelo JWT no backend.
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

     O BACKEND DETERMINA QUAIS BOTÕES
     ESTÃO LIBERADOS.
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

          /*
            Enquanto consulta o backend,
            bloqueamos todos os botões.
          */

          setPermissoes({
            ...permissoesIniciais,
          });
        }

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


        /*
          NÃO precisamos mais enviar empresa_id
          na query.

          O backend usa:

          req.user.empresa_id

          vindo do JWT.
        */

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


        /* =================================================
           IMPORTANTE

           NÃO recalculamos mais pelas batidas.

           Usamos exatamente as permissões
           retornadas pelo ponto.controller.js.
        ================================================= */

        const novasPermissoes =
          normalizarPermissoes(
            data
          );


        console.log(
          "=========================================="
        );

        console.log(
          "🔓 PERMISSÕES FINAIS NO FRONTEND:"
        );

        console.log(
          novasPermissoes
        );

        console.log(
          "=========================================="
        );


        setPermissoes(
          novasPermissoes
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
          Em caso de erro, não podemos assumir
          que Entrada está liberada.
        */

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
  ]);


  /* =======================================================
     NOMES DAS BATIDAS
  ======================================================= */

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

       Isso é apenas proteção visual.

       O backend continuará validando novamente.
    ===================================================== */

    if (
      permissoes[tipo] !== true
    ) {
      console.warn(
        "⚠️ Batida bloqueada no frontend:",
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


      /*
        IMPORTANTE:

        Não enviamos mais empresa_id.

        O backend pega a empresa do JWT:

        req.user.empresa_id
      */

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
        "📤 REGISTRANDO PONTO:"
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


      const { data } =
        await api.post(
          "/ponto/bater",
          payload
        );


      console.log(
        "=========================================="
      );

      console.log(
        "✅ PONTO REGISTRADO:"
      );

      console.log(
        data
      );

      console.log(
        "=========================================="
      );


      /*
        Atualiza imediatamente as permissões
        com a resposta do POST.

        Mesmo que depois a tela volte para
        /ponto, isso evita estado antigo.
      */

      if (
        data?.permissoes
      ) {
        setPermissoes(
          normalizarPermissoes(
            data
          )
        );
      }


      abrirModal(
        "Ponto registrado!",

        data?.message ||
        data?.mensagem ||
        `${nomesBatidas[tipo]} registrado com sucesso.`,

        false
      );


      /* ===================================================
         VOLTAR PARA TELA INICIAL
      =================================================== */

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


      /*
        Se o backend recusou porque o estado
        mudou, atualizamos as permissões com
        o que ele devolveu.

        Exemplo:
        outro clique/requisição registrou
        uma batida antes deste POST.
      */

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
                : "Qual ponto deseja registrar?"
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

              Envia:
              intervalo_inicio
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

              IMPORTANTE:

              Retorno SEMPRE envia:
              intervalo_fim
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