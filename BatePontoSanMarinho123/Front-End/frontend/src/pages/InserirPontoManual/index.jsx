import {
  useEffect,
  useState,
} from "react";

import {
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";

import {
  api,
} from "../../services/api";

import "./inserirPontoManual.css";


export default function InserirPontoManual() {

  /* =========================================================
     ESTADOS
  ========================================================= */

  const [
    funcionarios,
    setFuncionarios,
  ] = useState([]);

  const [
    funcId,
    setFuncId,
  ] = useState("");

  const [
    tipo,
    setTipo,
  ] = useState("");

  const [
    data,
    setData,
  ] = useState("");

  const [
    hora,
    setHora,
  ] = useState("");

  const [
    carregando,
    setCarregando,
  ] = useState(false);


  /* =========================================================
     MODAL
  ========================================================= */

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


  /* =========================================================
     ABRIR MODAL
  ========================================================= */

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


    setTimeout(
      () => {

        setModalOpen(
          false
        );

      },
      1800
    );

  }


  /* =========================================================
     CARREGAR FUNCIONÁRIOS

     IMPORTANTE:

     Cada funcionário precisa manter seu empresa_id.

     Depois, quando o funcionário for selecionado,
     usaremos esse empresa_id para inserir o ponto.
  ========================================================= */

  useEffect(() => {

    async function carregarFuncionarios() {

      try {

        const response =
          await api.get(
            "/funcionarios"
          );


        /* ===================================================
           ACEITAR DIFERENTES FORMATOS DE RESPOSTA
        =================================================== */

        let lista = [];


        if (
          Array.isArray(
            response.data
          )
        ) {

          lista =
            response.data;

        } else if (
          Array.isArray(
            response.data?.funcionarios
          )
        ) {

          lista =
            response.data.funcionarios;

        } else if (
          Array.isArray(
            response.data?.dados
          )
        ) {

          lista =
            response.data.dados;

        }


        /* ===================================================
           SOMENTE FUNCIONÁRIOS ATIVOS
        =================================================== */

        const ativos =
          lista.filter(
            (funcionario) =>
              funcionario.ativo ===
                undefined ||
              funcionario.ativo ===
                null ||
              funcionario.ativo ===
                true
          );


        /* ===================================================
           ORDENAR POR NOME
        =================================================== */

        ativos.sort(
          (a, b) =>
            String(
              a.nome || ""
            ).localeCompare(
              String(
                b.nome || ""
              ),
              "pt-BR"
            )
        );


        setFuncionarios(
          ativos
        );


        /* ===================================================
           DEBUG

           Pode deixar por enquanto.
           Serve para confirmar que empresa_id está chegando.
        =================================================== */

        console.log(
          "Funcionários carregados:",
          ativos
        );


      } catch (error) {

        console.error(
          "Erro ao carregar funcionários:",
          error
        );


        setFuncionarios(
          []
        );


        abrirModal(
          "Erro",
          error.response?.data?.error ||
            error.response?.data?.erro ||
            "Não foi possível carregar os funcionários.",
          true
        );

      }

    }


    carregarFuncionarios();

  }, []);


  /* =========================================================
     ENVIAR PONTO
  ========================================================= */

  async function enviar() {

    /* =======================================================
       VALIDAR CAMPOS
    ======================================================= */

    if (
      !funcId ||
      !tipo ||
      !data ||
      !hora
    ) {

      abrirModal(
        "Atenção",
        "Preencha todos os campos!",
        true
      );

      return;

    }


    /* =======================================================
       ENCONTRAR FUNCIONÁRIO SELECIONADO

       Não usamos somente o ID.

       Precisamos do objeto inteiro para pegar:
       funcionario.empresa_id
    ======================================================= */

    const funcionarioSelecionado =
      funcionarios.find(
        (funcionario) =>
          Number(
            funcionario.id
          ) ===
          Number(
            funcId
          )
      );


    if (!funcionarioSelecionado) {

      abrirModal(
        "Erro",
        "Funcionário não encontrado.",
        true
      );

      return;

    }


    /* =======================================================
       PEGAR EMPRESA DO FUNCIONÁRIO
    ======================================================= */

    const empresaId =
      Number(
        funcionarioSelecionado.empresa_id
      );


    if (
      !Number.isInteger(
        empresaId
      ) ||
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


    /* =======================================================
       IMPORTANTE SOBRE A DATA

       Seu backend /ponto/manual atualmente espera:

       YYYY-MM-DD

       O input type="date" já fornece exatamente:

       2026-08-16

       Portanto NÃO devemos transformar em:

       16/08/2026
    ======================================================= */

    const dataFormatada =
      data;


    /* =======================================================
       PAYLOAD
    ======================================================= */

    const payload = {

      funcionario_id:
        Number(
          funcionarioSelecionado.id
        ),


      /*
       * CORREÇÃO PRINCIPAL:
       *
       * agora empresa_id vai para o backend.
       */
      empresa_id:
        empresaId,


      tipo,

      data:
        dataFormatada,

      hora,

    };


    /* =======================================================
       DEBUG

       Abra F12 -> Console.

       Deve aparecer algo como:

       {
         funcionario_id: 1,
         empresa_id: 1,
         tipo: "entrada",
         data: "2026-08-16",
         hora: "13:15"
       }
    ======================================================= */

    console.log(
      "PAYLOAD PONTO MANUAL:",
      payload
    );


    try {

      setCarregando(
        true
      );


      /* =====================================================
         REGISTRAR PONTO
      ===================================================== */

      const response =
        await api.post(
          "/ponto/manual",
          payload
        );


      /* =====================================================
         SUCESSO
      ===================================================== */

      abrirModal(
        "Registrado com sucesso!",
        response.data?.message ||
          response.data?.mensagem ||
          "Ponto inserido com sucesso!"
      );


      /* =====================================================
         LIMPAR CAMPOS

         Mantemos o funcionário selecionado.
      ===================================================== */

      setTipo("");

      setData("");

      setHora("");


    } catch (error) {

      console.error(
        "Erro ao inserir ponto manual:",
        error
      );


      console.error(
        "Resposta do backend:",
        error.response?.data
      );


      abrirModal(
        "Erro",
        error.response?.data?.error ||
          error.response?.data?.erro ||
          error.response?.data?.message ||
          "Erro ao inserir ponto.",
        true
      );


    } finally {

      setCarregando(
        false
      );

    }

  }


  /* =========================================================
     JSX
  ========================================================= */

  return (

    <div className="manual-container">

      {/* =====================================================
          TÍTULO
      ===================================================== */}

      <h2>
        Inserir Ponto Manual
      </h2>


      {/* =====================================================
          FUNCIONÁRIO
      ===================================================== */}

      <label
        className="manual-label"
        htmlFor="manual-funcionario"
      >
        Funcionário
      </label>


      <select
        id="manual-funcionario"
        value={funcId}
        onChange={
          (event) =>
            setFuncId(
              event.target.value
            )
        }
      >

        <option value="">
          Selecione o funcionário
        </option>


        {funcionarios.map(
          (funcionario) => (

            <option
              key={
                funcionario.id
              }
              value={
                funcionario.id
              }
            >

              {funcionario.nome}

              {funcionario.cpf
                ? ` — ${funcionario.cpf}`
                : ""}

            </option>

          )
        )}

      </select>


      {/* =====================================================
          TIPO
      ===================================================== */}

      <label
        className="manual-label"
        htmlFor="manual-tipo"
      >
        Tipo de Batida
      </label>


      <select
        id="manual-tipo"
        value={tipo}
        onChange={
          (event) =>
            setTipo(
              event.target.value
            )
        }
      >

        <option value="">
          Selecione o tipo
        </option>

        <option value="entrada">
          Entrada
        </option>

        <option value="intervalo_inicio">
          Início do Intervalo
        </option>

        <option value="intervalo_fim">
          Retorno do Intervalo
        </option>

        <option value="saida">
          Saída
        </option>

      </select>


      {/* =====================================================
          DATA
      ===================================================== */}

      <label
        className="manual-label"
        htmlFor="manual-data"
      >
        Data
      </label>


      <input
        id="manual-data"
        type="date"
        value={data}
        onChange={
          (event) =>
            setData(
              event.target.value
            )
        }
      />


      {/* =====================================================
          HORA
      ===================================================== */}

      <label
        className="manual-label"
        htmlFor="manual-hora"
      >
        Hora
      </label>


      <input
        id="manual-hora"
        type="time"
        value={hora}
        onChange={
          (event) =>
            setHora(
              event.target.value
            )
        }
      />


      {/* =====================================================
          SALVAR
      ===================================================== */}

      <button
        type="button"
        onClick={enviar}
        disabled={
          carregando
        }
      >

        {carregando
          ? "Salvando..."
          : "Salvar Ponto"}

      </button>


      {/* =====================================================
          MODAL
      ===================================================== */}

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

              <FaExclamationCircle
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