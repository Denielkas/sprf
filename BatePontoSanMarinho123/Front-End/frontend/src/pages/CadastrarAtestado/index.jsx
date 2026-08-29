import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

import { api } from "../../services/api";

import "./CadastrarAtestado.css";


/* =========================================================
   COMPONENTE
========================================================= */

export default function CadastrarAtestado() {

  /* =======================================================
     FUNCIONÁRIOS
  ======================================================= */

  const [
    funcionarios,
    setFuncionarios,
  ] = useState([]);

  const [
    carregandoFuncionarios,
    setCarregandoFuncionarios,
  ] = useState(true);


  /* =======================================================
     FORMULÁRIO
  ======================================================= */

  const [
    funcionario,
    setFuncionario,
  ] = useState("");

  const [
    inicio,
    setInicio,
  ] = useState("");

  const [
    fim,
    setFim,
  ] = useState("");

  const [
    arquivo,
    setArquivo,
  ] = useState(null);

  const [
    reporHoras,
    setReporHoras,
  ] = useState(false);

  const [
    salvando,
    setSalvando,
  ] = useState(false);


  /* =======================================================
     INPUT FILE
  ======================================================= */

  const arquivoRef = useRef(null);


  /* =======================================================
     TIMER MODAL
  ======================================================= */

  const modalTimerRef = useRef(null);


  /* =======================================================
     MODAL
  ======================================================= */

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    modalTitulo,
    setModalTitulo,
  ] = useState("");

  const [
    modalTexto,
    setModalTexto,
  ] = useState("");

  const [
    modalErro,
    setModalErro,
  ] = useState(false);


  /* =======================================================
     ABRIR MODAL
  ======================================================= */

  const abrirModal = (
    titulo,
    texto,
    erro = false
  ) => {
    if (modalTimerRef.current) {
      clearTimeout(
        modalTimerRef.current
      );
    }

    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    modalTimerRef.current =
      setTimeout(() => {
        setModalOpen(false);
      }, 1800);
  };


  /* =======================================================
     TRATAR LISTA DE FUNCIONÁRIOS
  ======================================================= */

  const normalizarFuncionarios = (
    data
  ) => {
    /*
      Aceita:

      [
        {...},
        {...}
      ]

      ou:

      {
        funcionarios: [...]
      }

      ou:

      {
        ativos: [...]
      }
    */

    let lista = [];

    if (Array.isArray(data)) {
      lista = data;
    } else if (
      Array.isArray(
        data?.funcionarios
      )
    ) {
      lista =
        data.funcionarios;
    } else if (
      Array.isArray(
        data?.ativos
      )
    ) {
      lista =
        data.ativos;
    }


    /*
      Mantém somente funcionários ativos.

      Se o backend não retornar "ativo",
      considera o funcionário como ativo.
    */

    lista = lista.filter(
      (func) => {
        if (
          func?.ativo === undefined ||
          func?.ativo === null
        ) {
          return true;
        }

        return (
          func.ativo === true ||
          func.ativo === 1 ||
          func.ativo === "1" ||
          func.ativo === "true"
        );
      }
    );


    /*
      Ordenação alfabética.
    */

    lista.sort((a, b) =>
      String(a?.nome || "")
        .localeCompare(
          String(b?.nome || ""),
          "pt-BR"
        )
    );

    return lista;
  };


  /* =======================================================
     BUSCAR FUNCIONÁRIOS
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function carregarFuncionarios() {
      try {
        setCarregandoFuncionarios(
          true
        );

        const { data } =
          await api.get(
            "/funcionarios"
          );

        if (!ativo) {
          return;
        }

        const lista =
          normalizarFuncionarios(
            data
          );

        setFuncionarios(lista);
      } catch (error) {
        console.error(
          "Erro ao buscar funcionários:",
          error
        );

        if (!ativo) {
          return;
        }

        setFuncionarios([]);

        abrirModal(
          "Erro",
          error.response?.data?.error ||
            error.response?.data?.erro ||
            error.response?.data?.message ||
            "Erro ao buscar funcionários.",
          true
        );
      } finally {
        if (ativo) {
          setCarregandoFuncionarios(
            false
          );
        }
      }
    }

    carregarFuncionarios();

    return () => {
      ativo = false;

      if (
        modalTimerRef.current
      ) {
        clearTimeout(
          modalTimerRef.current
        );
      }
    };
  }, []);


  /* =======================================================
     ALTERAR DATA INICIAL
  ======================================================= */

  const alterarInicio = (valor) => {
    setInicio(valor);

    /*
      Se a data final estiver anterior
      à nova data inicial, ajusta
      automaticamente.
    */

    if (
      valor &&
      fim &&
      fim < valor
    ) {
      setFim(valor);
    }
  };


  /* =======================================================
     ALTERAR DATA FINAL
  ======================================================= */

  const alterarFim = (valor) => {
    setFim(valor);
  };


  /* =======================================================
     ALTERAR ARQUIVO
  ======================================================= */

  const alterarArquivo = (event) => {
    const file =
      event.target.files?.[0] ||
      null;

    if (!file) {
      setArquivo(null);
      return;
    }


    /* =====================================================
       VALIDAR PDF
    ===================================================== */

    const nomeArquivo =
      String(
        file.name || ""
      ).toLowerCase();

    const ehPdf =
      file.type ===
        "application/pdf" ||
      nomeArquivo.endsWith(
        ".pdf"
      );

    if (!ehPdf) {
      event.target.value = "";

      setArquivo(null);

      abrirModal(
        "Arquivo inválido",
        "Selecione um arquivo PDF.",
        true
      );

      return;
    }

    setArquivo(file);
  };


  /* =======================================================
     LIMPAR FORMULÁRIO
  ======================================================= */

  const limparFormulario = () => {
    setFuncionario("");
    setInicio("");
    setFim("");
    setArquivo(null);
    setReporHoras(false);

    if (arquivoRef.current) {
      arquivoRef.current.value =
        "";
    }
  };


  /* =======================================================
     SALVAR
  ======================================================= */

  const salvar = async () => {

    /* =====================================================
       EVITAR CLIQUE DUPLO
    ===================================================== */

    if (salvando) {
      return;
    }


    /* =====================================================
       CAMPOS OBRIGATÓRIOS
    ===================================================== */

    if (
      !funcionario ||
      !inicio ||
      !fim ||
      !arquivo
    ) {
      abrirModal(
        "Atenção",
        "Preencha todos os campos.",
        true
      );

      return;
    }


    /* =====================================================
       VALIDAR FUNCIONÁRIO
    ===================================================== */

    const funcionarioSelecionado =
      funcionarios.find(
        (func) =>
          String(func.id) ===
          String(funcionario)
      );

    if (!funcionarioSelecionado) {
      abrirModal(
        "Atenção",
        "Selecione um funcionário válido.",
        true
      );

      return;
    }

    /* =====================================================
   VALIDAR EMPRESA DO FUNCIONÁRIO
===================================================== */

const empresaId =
  Number(
    funcionarioSelecionado.empresa_id
  );

if (
  !Number.isInteger(empresaId) ||
  empresaId <= 0
) {
  console.error(
    "Funcionário sem empresa:",
    funcionarioSelecionado
  );

  abrirModal(
    "Erro",
    "O funcionário selecionado não possui empresa vinculada.",
    true
  );

  return;
}


    /* =====================================================
       VALIDAR DATAS
    ===================================================== */

    if (fim < inicio) {
      abrirModal(
        "Atenção",
        "A data final não pode ser anterior à data inicial.",
        true
      );

      return;
    }


    /* =====================================================
       FORM DATA
    ===================================================== */

   const form =
  new FormData();

/* =====================================================
   FUNCIONÁRIO
===================================================== */

form.append(
  "funcionario_id",
  String(
    funcionarioSelecionado.id
  )
);


/* =====================================================
   EMPRESA

   CORREÇÃO:
   o backend precisa receber empresa_id.
===================================================== */

form.append(
  "empresa_id",
  String(
    empresaId
  )
);


/* =====================================================
   DATAS
===================================================== */

form.append(
  "data_inicio",
  inicio
);

form.append(
  "data_fim",
  fim
);


/* =====================================================
   ARQUIVO
===================================================== */

form.append(
  "arquivo",
  arquivo
);


/* =====================================================
   REPOR HORAS
===================================================== */

form.append(
  "repor_horas",
  reporHoras
    ? "true"
    : "false"
);


    /* =====================================================
       ENVIAR
    ===================================================== */

    try {
      setSalvando(true);

      const { data } =
        await api.post(
          "/atestado",
          form
        );


      /* ===================================================
         SUCESSO
      =================================================== */

      abrirModal(
        "Registrado com sucesso!",
        data?.message ||
          data?.mensagem ||
          `Atestado de ${funcionarioSelecionado.nome} salvo com sucesso!`
      );

      limparFormulario();
    } catch (error) {
      console.error(
        "Erro ao salvar atestado:",
        error
      );

      abrirModal(
        "Erro",
        error.response?.data?.error ||
          error.response?.data?.erro ||
          error.response?.data?.message ||
          "Erro ao salvar atestado.",
        true
      );
    } finally {
      setSalvando(false);
    }
  };


  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="atestado-container">

      {/* =================================================
          TÍTULO
      ================================================= */}

      <h2 className="atestado-title">
        Anexar Atestado Médico
      </h2>


      {/* =================================================
          FORMULÁRIO
      ================================================= */}

      <div className="atestado-form">

        {/* ===============================================
            FUNCIONÁRIO
        =============================================== */}

        <label className="atestado-label">
          Funcionário
        </label>

        <select
          className="atestado-select"
          value={funcionario}
          onChange={(e) =>
            setFuncionario(
              e.target.value
            )
          }
          disabled={
            carregandoFuncionarios ||
            salvando
          }
        >

          <option value="">
            {carregandoFuncionarios
              ? "Carregando funcionários..."
              : "Selecionar Funcionário"}
          </option>

          {funcionarios.map(
            (func) => (
              <option
                key={func.id}
                value={func.id}
              >
                {func.nome}
              </option>
            )
          )}

        </select>


        {/* ===============================================
            DATA INÍCIO
        =============================================== */}

        <label className="atestado-label">
          Data Início
        </label>

        <input
          className="atestado-input"
          type="date"
          value={inicio}
          onChange={(e) =>
            alterarInicio(
              e.target.value
            )
          }
          disabled={salvando}
        />


        {/* ===============================================
            DATA FIM
        =============================================== */}

        <label className="atestado-label">
          Data Fim
        </label>

        <input
          className="atestado-input"
          type="date"
          value={fim}
          min={inicio || undefined}
          onChange={(e) =>
            alterarFim(
              e.target.value
            )
          }
          disabled={salvando}
        />


        {/* ===============================================
            ARQUIVO
        =============================================== */}

        <label className="atestado-label">
          Arquivo PDF
        </label>

        <input
          ref={arquivoRef}
          id="arquivo-atestado"
          className="atestado-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={
            alterarArquivo
          }
          disabled={salvando}
        />


        {/* ===============================================
            REPOR HORAS
        =============================================== */}

        <div className="acoes-dia-grid atestado-grid">

          <button
            type="button"
            className={
              `acao-dia-card atestado-card ${
                reporHoras
                  ? "ativo"
                  : ""
              }`
            }
            onClick={() =>
              setReporHoras(
                (valor) => !valor
              )
            }
            disabled={salvando}
          >

            <strong>
              {reporHoras
                ? "Repor Hora"
                : "Atestado"}
            </strong>

            <small>
              {reporHoras
                ? "Horas ficarão negativas"
                : "Saldo zerado"}
            </small>

            <span>
              {reporHoras
                ? "Marcado"
                : "Marcar"}
            </span>

          </button>

        </div>


        {/* ===============================================
            SALVAR
        =============================================== */}

        <button
          type="button"
          className="atestado-btn"
          onClick={salvar}
          disabled={
            salvando ||
            carregandoFuncionarios
          }
        >
          {salvando
            ? "Salvando..."
            : "Salvar Atestado"}
        </button>

      </div>


      {/* =================================================
          MODAL
      ================================================= */}

      {modalOpen && (
        <div className="modal-ponto">

          <div
            className={
              `modal-box ${
                modalErro
                  ? "modal-box-erro"
                  : ""
              }`
            }
          >

            {modalErro ? (
              <FaTimesCircle
                className="modal-icon modal-icon-erro"
              />
            ) : (
              <FaCheckCircle
                className="modal-icon"
              />
            )}

            <h3>
              {modalTitulo}
            </h3>

            <p>
              {modalTexto}
            </p>

          </div>

        </div>
      )}

    </div>
  );
}