import { useEffect, useState } from "react";
import { FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./registrar.css";

/* =========================================================
   UTILIDADES
========================================================= */

const onlyDigits = (value = "") => {
  return String(value).replace(/\D+/g, "");
};

const formatCPF = (value = "") => {
  const cpf = onlyDigits(value).slice(0, 11);

  if (cpf.length <= 3) {
    return cpf;
  }

  if (cpf.length <= 6) {
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}`;
  }

  if (cpf.length <= 9) {
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}`;
  }

  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(
    6,
    9
  )}-${cpf.slice(9, 11)}`;
};


/* =========================================================
   COMPONENTE
========================================================= */

export default function RegistrarFuncionario() {

  /* =======================================================
     FORMULÁRIO
  ======================================================= */

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    funcao_id: "",
    chegada: "08:00",
    intervalo_inicio: "12:00",
    intervalo_fim: "13:00",
    saida: "17:00",
  });


  /* =======================================================
     FUNÇÕES
  ======================================================= */

  const [funcoes, setFuncoes] = useState([]);

  const [isOutraFuncao, setIsOutraFuncao] =
    useState(false);

  const [novaFuncao, setNovaFuncao] =
    useState("");


  /* =======================================================
     CARREGAMENTO
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [loadingFuncoes, setLoadingFuncoes] =
    useState(false);


  /* =======================================================
     MODAL
  ======================================================= */

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalTexto, setModalTexto] =
    useState("");

  const [modalTitulo, setModalTitulo] =
    useState("");

  const [modalErro, setModalErro] =
    useState(false);


  /* =======================================================
     ABRIR MODAL
  ======================================================= */

  const abrirModal = (
    titulo,
    texto,
    erro = false
  ) => {

    setModalTitulo(
      titulo || (erro ? "Erro" : "Sucesso")
    );

    setModalTexto(
      texto || ""
    );

    setModalErro(
      erro
    );

    setModalOpen(
      true
    );


    setTimeout(() => {

      setModalOpen(
        false
      );

    }, 2000);

  };


  /* =======================================================
     BUSCAR FUNÇÕES

     O backend deve retornar somente as funções
     pertencentes à empresa logada.
  ======================================================= */

  const loadFuncoes = async () => {

    try {

      setLoadingFuncoes(
        true
      );


      const { data } =
        await api.get(
          "/funcoes"
        );


      /*
        Aceita tanto:

        [
          { id: 1, nome: "Recepcionista" }
        ]

        quanto:

        {
          funcoes: [...]
        }
      */

      const lista =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.funcoes)
          ? data.funcoes
          : [];


      setFuncoes(
        lista
      );


    } catch (err) {

      console.error(
        "Erro ao carregar funções:",
        err
      );


      setFuncoes(
        []
      );


      abrirModal(
        "Erro",
        err.response?.data?.error ||
          "Erro ao carregar funções.",
        true
      );


    } finally {

      setLoadingFuncoes(
        false
      );

    }

  };


  /* =======================================================
     CARREGAR FUNÇÕES AO ABRIR A PÁGINA
  ======================================================= */

  useEffect(() => {

    loadFuncoes();

  }, []);


  /* =======================================================
     ALTERAÇÃO DOS CAMPOS
  ======================================================= */

  const onChange = (event) => {

    const {
      name,
      value,
    } = event.target;


    /* =====================================================
       FUNÇÃO
    ===================================================== */

    if (
      name === "funcao_id"
    ) {

      if (
        value === "OUTRA"
      ) {

        setIsOutraFuncao(
          true
        );


        setForm((old) => ({
          ...old,

          funcao_id: "",
        }));


      } else {

        setIsOutraFuncao(
          false
        );


        setNovaFuncao(
          ""
        );


        setForm((old) => ({
          ...old,

          funcao_id: value,
        }));

      }


      return;

    }


    /* =====================================================
       OUTROS CAMPOS
    ===================================================== */

    setForm((old) => ({
      ...old,

      [name]:
        name === "cpf"
          ? formatCPF(value)
          : value,
    }));

  };


  /* =======================================================
     LIMPAR FORMULÁRIO
  ======================================================= */

  const limparFormulario = () => {

    setForm({
      nome: "",
      cpf: "",
      funcao_id: "",
      chegada: "08:00",
      intervalo_inicio: "12:00",
      intervalo_fim: "13:00",
      saida: "17:00",
    });


    setIsOutraFuncao(
      false
    );


    setNovaFuncao(
      ""
    );

  };


  /* =======================================================
     CADASTRAR FUNCIONÁRIO
  ======================================================= */

  const onSubmit = async (event) => {

    event.preventDefault();


    if (loading) {
      return;
    }


    /* =====================================================
       VALIDAR NOME
    ===================================================== */

    const nome =
      form.nome.trim();


    if (!nome) {

      abrirModal(
        "Atenção",
        "Digite o nome do funcionário.",
        true
      );

      return;

    }


    /* =====================================================
       VALIDAR CPF
    ===================================================== */

    const cpf =
      onlyDigits(
        form.cpf
      );


    if (
      cpf.length !== 11
    ) {

      abrirModal(
        "Atenção",
        "Digite um CPF com 11 números.",
        true
      );

      return;

    }


    /* =====================================================
       VALIDAR FUNÇÃO
    ===================================================== */

    if (
      !isOutraFuncao &&
      !form.funcao_id
    ) {

      abrirModal(
        "Atenção",
        "Selecione uma função.",
        true
      );

      return;

    }


    if (
      isOutraFuncao &&
      !novaFuncao.trim()
    ) {

      abrirModal(
        "Atenção",
        "Digite a nova função.",
        true
      );

      return;

    }


    /* =====================================================
       INICIAR CADASTRO
    ===================================================== */

    setLoading(
      true
    );


    try {

      /* ===================================================
         PAYLOAD

         Não enviamos empresa_id pelo frontend.

         O backend deve descobrir a empresa pelo token
         do usuário logado.
      =================================================== */

      const payload = {

        nome,

        cpf,

        funcao_id:
          isOutraFuncao
            ? null
            : Number(
                form.funcao_id
              ),

        funcao_nome:
          isOutraFuncao
            ? novaFuncao.trim()
            : null,

        chegada:
          form.chegada,

        intervalo_inicio:
          form.intervalo_inicio,

        intervalo_fim:
          form.intervalo_fim,

        saida:
          form.saida,
      };


      const response =
        await api.post(
          "/funcionarios",
          payload
        );


      const data =
        response.data;


      console.log(
        "Funcionário cadastrado:",
        data
      );


      /* ===================================================
         DESCOBRIR FUNCIONÁRIO RETORNADO

         Isso evita novamente:

         Funcionário undefined cadastrado com sucesso!
      =================================================== */

      const funcionario =
        data?.funcionario ||
        data?.data ||
        data;


      const nomeCadastrado =
        funcionario?.nome ||
        data?.nome ||
        nome;


      /* ===================================================
         ATUALIZAR FUNÇÕES

         Importante quando foi cadastrada uma nova função.
      =================================================== */

      await loadFuncoes();


      /* ===================================================
         LIMPAR
      =================================================== */

      limparFormulario();


      /* ===================================================
         SUCESSO
      =================================================== */

      abrirModal(
        "Registrado com sucesso!",
        `Funcionário ${nomeCadastrado} cadastrado com sucesso!`
      );


    } catch (err) {

      console.error(
        "Erro ao cadastrar funcionário:",
        err
      );


      const mensagem =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        "Erro ao cadastrar funcionário.";


      abrirModal(
        "Erro ao cadastrar",
        mensagem,
        true
      );


    } finally {

      setLoading(
        false
      );

    }

  };


  /* =========================================================
     JSX
  ========================================================= */

  return (

    <div className="regPage">

      {/* =====================================================
          TÍTULO
      ===================================================== */}

      <h2 className="regTitle">
        Cadastrar Funcionário
      </h2>


      {/* =====================================================
          FORMULÁRIO
      ===================================================== */}

      <form
        className="regForm"
        onSubmit={onSubmit}
      >

        {/* ===================================================
            NOME
        =================================================== */}

        <div className="formItem1">

          <label>
            Nome
          </label>


          <input
            name="nome"
            value={form.nome}
            onChange={onChange}
            required
            autoComplete="off"
            placeholder="Digite o nome completo"
            className="inputDiferente"
          />

        </div>


        {/* ===================================================
            CPF
        =================================================== */}

        <div className="formItem1">

          <label>
            CPF
          </label>


          <input
            name="cpf"
            value={form.cpf}
            onChange={onChange}
            maxLength={14}
            inputMode="numeric"
            required
            autoComplete="off"
            placeholder="000.000.000-00"
            className="inputDiferente"
          />

        </div>


        {/* ===================================================
            FUNÇÃO
        =================================================== */}

        <div className="formItem1">

          <label>
            Função
          </label>


          <select
            name="funcao_id"
            value={
              isOutraFuncao
                ? "OUTRA"
                : form.funcao_id
            }
            onChange={onChange}
            required={
              !isOutraFuncao
            }
            disabled={
              loadingFuncoes
            }
            className="inputDiferente"
          >

            <option value="">

              {loadingFuncoes
                ? "Carregando funções..."
                : "Selecione a função"}

            </option>


            {funcoes.map(
              (funcao) => (

                <option
                  key={funcao.id}
                  value={funcao.id}
                >
                  {funcao.nome}
                </option>

              )
            )}


            <option value="OUTRA">
              Outra...
            </option>

          </select>

        </div>


        {/* ===================================================
            NOVA FUNÇÃO
        =================================================== */}

        {isOutraFuncao && (

          <div className="formItem1">

            <label>
              Nova função
            </label>


            <input
              value={novaFuncao}
              onChange={(event) =>
                setNovaFuncao(
                  event.target.value
                )
              }
              required
              autoComplete="off"
              placeholder="Digite a nova função"
              className="inputDiferente"
            />

          </div>

        )}


        {/* ===================================================
            ENTRADA / SAÍDA
        =================================================== */}

        <div className="grid2">

          <div className="formItem">

            <label>
              Entrada
            </label>


            <input
              type="time"
              name="chegada"
              value={form.chegada}
              onChange={onChange}
              required
              className="inputIguais"
            />

          </div>


          <div className="formItem">

            <label>
              Saída
            </label>


            <input
              type="time"
              name="saida"
              value={form.saida}
              onChange={onChange}
              required
              className="inputIguais"
            />

          </div>

        </div>


        {/* ===================================================
            INTERVALO
        =================================================== */}

        <div className="grid2">

          <div className="formItem">

            <label>
              Início do Intervalo
            </label>


            <input
              type="time"
              name="intervalo_inicio"
              value={
                form.intervalo_inicio
              }
              onChange={onChange}
              required
              className="inputIguais"
            />

          </div>


          <div className="formItem">

            <label>
              Volta do Intervalo
            </label>


            <input
              type="time"
              name="intervalo_fim"
              value={
                form.intervalo_fim
              }
              onChange={onChange}
              required
              className="inputIguais"
            />

          </div>

        </div>


        {/* ===================================================
            CADASTRAR
        =================================================== */}

        <button
          className="regButton"
          type="submit"
          disabled={loading}
        >

          {loading
            ? "Salvando..."
            : "Cadastrar"}

        </button>

      </form>


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