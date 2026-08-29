import { useEffect, useState } from "react";

import {
  FaBuilding,
  FaPlus,
  FaSyncAlt,
  FaEdit,
  FaPowerOff,
  FaIdCard,
  FaStar,
  FaTrash,
  FaSave,
  FaTimes,
  FaImage,
  FaUpload,
} from "react-icons/fa";

import { api } from "../../services/api";

import "./empresas.css";


/* =========================================================
   UTILIDADES
========================================================= */

const somenteNumeros = (valor = "") =>
  String(valor).replace(/\D/g, "");


const formatarCnpj = (valor = "") => {

  const numeros =
    somenteNumeros(valor).slice(0, 14);

  if (numeros.length <= 2) {
    return numeros;
  }

  if (numeros.length <= 5) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2)}`;
  }

  if (numeros.length <= 8) {

    return `${numeros.slice(
      0,
      2
    )}.${numeros.slice(
      2,
      5
    )}.${numeros.slice(5)}`;
  }

  if (numeros.length <= 12) {

    return `${numeros.slice(
      0,
      2
    )}.${numeros.slice(
      2,
      5
    )}.${numeros.slice(
      5,
      8
    )}/${numeros.slice(8)}`;
  }

  return `${numeros.slice(
    0,
    2
  )}.${numeros.slice(
    2,
    5
  )}.${numeros.slice(
    5,
    8
  )}/${numeros.slice(
    8,
    12
  )}-${numeros.slice(
    12,
    14
  )}`;
};


/* =========================================================
   FORMULÁRIO VAZIO
========================================================= */

const criarFormularioVazio = () => ({

  nome: "",

  nome_fantasia: "",

  cor_primaria:
    "#0d6efd",

  cor_secundaria:
    "#1a1a1a",
});


/* =========================================================
   NORMALIZAR URL
========================================================= */

const normalizarUrlImagem = (url = "") => {

  if (!url) {
    return "";
  }

  const valor =
    String(url).trim();

  if (!valor) {
    return "";
  }

  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:")
  ) {

    return valor;
  }

  if (valor.startsWith("/")) {
    return valor;
  }

  return `/${valor}`;
};


/* =========================================================
   LOGO
========================================================= */

const getLogoUrl = (empresa) => {

  if (!empresa?.id) {
    return "";
  }

  if (empresa.logo_url) {

    return normalizarUrlImagem(
      empresa.logo_url
    );
  }

  if (empresa.logo_arquivo) {

    return `/api/empresas/${empresa.id}/logo`;
  }

  return "";
};


/* =========================================================
   FUNDO
========================================================= */

const getFundoUrl = (empresa) => {

  if (!empresa?.id) {
    return "";
  }

  if (empresa.fundo_url) {

    return normalizarUrlImagem(
      empresa.fundo_url
    );
  }

  if (empresa.fundo_arquivo) {

    return `/api/empresas/${empresa.id}/fundo`;
  }

  return "";
};


/* =========================================================
   COMPONENTE
========================================================= */

export default function Empresas() {

  /* =======================================================
     EMPRESAS
  ======================================================= */

  const [
    empresas,
    setEmpresas,
  ] =
    useState([]);


  const [
    carregando,
    setCarregando,
  ] =
    useState(true);


  const [
    salvando,
    setSalvando,
  ] =
    useState(false);


  /* =======================================================
     EMPRESA SENDO EXCLUÍDA
  ======================================================= */

  const [
    empresaExcluindo,
    setEmpresaExcluindo,
  ] =
    useState(null);


  /* =======================================================
     FORMULÁRIO
  ======================================================= */

  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] =
    useState(false);


  const [
    empresaEditando,
    setEmpresaEditando,
  ] =
    useState(null);


  const [
    form,
    setForm,
  ] =
    useState(
      criarFormularioVazio()
    );


  /* =======================================================
     MENSAGENS
  ======================================================= */

  const [
    mensagem,
    setMensagem,
  ] =
    useState("");


  const [
    erro,
    setErro,
  ] =
    useState("");


  /* =======================================================
     IMAGENS
  ======================================================= */

  const [
    logoArquivo,
    setLogoArquivo,
  ] =
    useState(null);


  const [
    fundoArquivo,
    setFundoArquivo,
  ] =
    useState(null);


  const [
    logoPreview,
    setLogoPreview,
  ] =
    useState("");


  const [
    fundoPreview,
    setFundoPreview,
  ] =
    useState("");


  /* =======================================================
     MODAL CNPJ
  ======================================================= */

  const [
    empresaCnpj,
    setEmpresaCnpj,
  ] =
    useState(null);


  const [
    cnpjEditando,
    setCnpjEditando,
  ] =
    useState(null);


  const [
    cnpjForm,
    setCnpjForm,
  ] =
    useState({

      cnpj: "",

      nome: "",

      principal: false,

      ativo: true,
    });


  const [
    salvandoCnpj,
    setSalvandoCnpj,
  ] =
    useState(false);


  /* =======================================================
     MENSAGENS
  ======================================================= */

  const limparMensagens = () => {

    setMensagem("");
    setErro("");
  };


  const mostrarSucesso = (texto) => {

    setErro("");
    setMensagem(texto);

    setTimeout(() => {

      setMensagem("");

    }, 3500);
  };


  const mostrarErro = (texto) => {

    setMensagem("");
    setErro(texto);
  };


  /* =======================================================
     CARREGAR EMPRESAS
  ======================================================= */

  const carregarEmpresas = async () => {

    try {

      setCarregando(true);

      const { data } =
        await api.get(
          "/empresas"
        );


      const lista =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.empresas)
            ? data.empresas
            : [];


      console.log(
        "EMPRESAS RECEBIDAS:",
        lista
      );


      setEmpresas(
        lista
      );

    } catch (err) {

      console.error(
        "Erro ao carregar empresas:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        "Não foi possível carregar as empresas."
      );

    } finally {

      setCarregando(false);
    }
  };


  useEffect(() => {

    carregarEmpresas();

  }, []);


  /* =======================================================
     LIBERAR BLOB
  ======================================================= */

  const liberarBlob = (url) => {

    if (
      url?.startsWith("blob:")
    ) {

      URL.revokeObjectURL(
        url
      );
    }
  };


  const limparImagensFormulario = () => {

    liberarBlob(
      logoPreview
    );

    liberarBlob(
      fundoPreview
    );


    setLogoArquivo(
      null
    );

    setFundoArquivo(
      null
    );


    setLogoPreview(
      ""
    );

    setFundoPreview(
      ""
    );
  };


  /* =======================================================
     ALTERAR FORM
  ======================================================= */

  const alterarForm = (e) => {

    const {
      name,
      value,
    } =
      e.target;


    setForm(
      (anterior) => ({

        ...anterior,

        [name]:
          value,
      })
    );
  };


  /* =======================================================
     NOVA EMPRESA
  ======================================================= */

  const abrirNovaEmpresa = () => {

    limparMensagens();

    limparImagensFormulario();


    setEmpresaEditando(
      null
    );


    setForm(
      criarFormularioVazio()
    );


    setMostrarFormulario(
      true
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  /* =======================================================
     EDITAR EMPRESA
  ======================================================= */

  const abrirEditarEmpresa = (
    empresa
  ) => {

    limparMensagens();

    limparImagensFormulario();


    setEmpresaEditando(
      empresa
    );


    setForm({

      nome:
        empresa.nome ||
        "",

      nome_fantasia:
        empresa.nome_fantasia ||
        "",

      cor_primaria:
        empresa.cor_primaria ||
        "#0d6efd",

      cor_secundaria:
        empresa.cor_secundaria ||
        "#1a1a1a",
    });


    setLogoPreview(
      getLogoUrl(
        empresa
      )
    );


    setFundoPreview(
      getFundoUrl(
        empresa
      )
    );


    setMostrarFormulario(
      true
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  /* =======================================================
     CANCELAR FORMULÁRIO
  ======================================================= */

  const cancelarFormulario = () => {

    limparImagensFormulario();


    setMostrarFormulario(
      false
    );


    setEmpresaEditando(
      null
    );


    setForm(
      criarFormularioVazio()
    );
  };


  /* =======================================================
     VALIDAR IMAGEM
  ======================================================= */

  const validarImagem = (
    arquivo,
    tipo
  ) => {

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];


    if (
      !tiposPermitidos.includes(
        arquivo.type
      )
    ) {

      mostrarErro(
        "Selecione uma imagem JPG, JPEG, PNG ou WEBP."
      );

      return false;
    }


    if (
      arquivo.size >
      10 * 1024 * 1024
    ) {

      mostrarErro(
        `${tipo} não pode ultrapassar 10MB.`
      );

      return false;
    }


    return true;
  };


  /* =======================================================
     SELECIONAR LOGO
  ======================================================= */

  const selecionarLogo = (e) => {

    const arquivo =
      e.target.files?.[0];


    if (!arquivo) {
      return;
    }


    if (
      !validarImagem(
        arquivo,
        "A logo"
      )
    ) {

      e.target.value = "";

      return;
    }


    liberarBlob(
      logoPreview
    );


    const preview =
      URL.createObjectURL(
        arquivo
      );


    setLogoArquivo(
      arquivo
    );


    setLogoPreview(
      preview
    );


    limparMensagens();
  };


  /* =======================================================
     SELECIONAR FUNDO
  ======================================================= */

  const selecionarFundo = (e) => {

    const arquivo =
      e.target.files?.[0];


    if (!arquivo) {
      return;
    }


    if (
      !validarImagem(
        arquivo,
        "A imagem de fundo"
      )
    ) {

      e.target.value = "";

      return;
    }


    liberarBlob(
      fundoPreview
    );


    const preview =
      URL.createObjectURL(
        arquivo
      );


    setFundoArquivo(
      arquivo
    );


    setFundoPreview(
      preview
    );


    limparMensagens();
  };


  /* =======================================================
     CANCELAR NOVA LOGO
  ======================================================= */

  const cancelarNovaLogo = () => {

    liberarBlob(
      logoPreview
    );


    setLogoArquivo(
      null
    );


    setLogoPreview(
      empresaEditando
        ? getLogoUrl(
            empresaEditando
          )
        : ""
    );
  };


  /* =======================================================
     CANCELAR NOVO FUNDO
  ======================================================= */

  const cancelarNovoFundo = () => {

    liberarBlob(
      fundoPreview
    );


    setFundoArquivo(
      null
    );


    setFundoPreview(
      empresaEditando
        ? getFundoUrl(
            empresaEditando
          )
        : ""
    );
  };


  /* =======================================================
     ENVIAR LOGO
  ======================================================= */

  const enviarLogo = async (
    empresaId
  ) => {

    if (!logoArquivo) {
      return null;
    }


    const formData =
      new FormData();


    formData.append(
      "arquivo",
      logoArquivo
    );


    const { data } =
      await api.post(
        `/empresas/${empresaId}/logo`,
        formData
      );


    return data;
  };


  /* =======================================================
     ENVIAR FUNDO
  ======================================================= */

  const enviarFundo = async (
    empresaId
  ) => {

    if (!fundoArquivo) {
      return null;
    }


    const formData =
      new FormData();


    formData.append(
      "arquivo",
      fundoArquivo
    );


    const { data } =
      await api.post(
        `/empresas/${empresaId}/fundo`,
        formData
      );


    return data;
  };


  /* =======================================================
     ENVIAR IMAGENS
  ======================================================= */

  const enviarImagens = async (
    empresaId
  ) => {

    if (logoArquivo) {

      await enviarLogo(
        empresaId
      );
    }


    if (fundoArquivo) {

      await enviarFundo(
        empresaId
      );
    }
  };


  /* =======================================================
     SALVAR EMPRESA
  ======================================================= */

  const salvarEmpresa = async (e) => {

    e.preventDefault();


    if (!form.nome.trim()) {

      mostrarErro(
        "Informe o nome da empresa."
      );

      return;
    }


    if (
      !/^#[0-9A-Fa-f]{6}$/.test(
        form.cor_primaria
      )
    ) {

      mostrarErro(
        "Cor principal inválida."
      );

      return;
    }


    if (
      !/^#[0-9A-Fa-f]{6}$/.test(
        form.cor_secundaria
      )
    ) {

      mostrarErro(
        "Cor secundária inválida."
      );

      return;
    }


    try {

      setSalvando(
        true
      );


      limparMensagens();


      const payload = {

        nome:
          form.nome.trim(),

        nome_fantasia:
          form.nome_fantasia.trim() ||
          null,

        cor_primaria:
          form.cor_primaria,

        cor_secundaria:
          form.cor_secundaria,
      };


      let empresaId;

      let mensagemSucesso;


      /* =====================================================
         EDITAR
      ===================================================== */

      if (empresaEditando) {

        const { data } =
          await api.put(
            `/empresas/${empresaEditando.id}`,
            payload
          );


        empresaId =
          empresaEditando.id;


        mensagemSucesso =
          data.message ||
          "Empresa atualizada com sucesso.";
      }


      /* =====================================================
         CRIAR
      ===================================================== */

      else {

        const { data } =
          await api.post(
            "/empresas",
            payload
          );


        empresaId =
          data?.empresa?.id ||
          data?.id;


        if (!empresaId) {

          throw new Error(
            "O servidor não retornou o ID da empresa cadastrada."
          );
        }


        mensagemSucesso =
          data.message ||
          "Empresa cadastrada com sucesso.";
      }


      /* =====================================================
         UPLOAD
      ===================================================== */

      await enviarImagens(
        empresaId
      );


      cancelarFormulario();


      await carregarEmpresas();


      mostrarSucesso(
        mensagemSucesso
      );

    } catch (err) {

      console.error(
        "Erro ao salvar empresa:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        err.message ||
        "Não foi possível salvar a empresa."
      );

    } finally {

      setSalvando(
        false
      );
    }
  };


  /* =======================================================
     ALTERAR STATUS
  ======================================================= */

  const alterarStatus = async (
    empresa
  ) => {

    const novoStatus =
      !empresa.ativo;


    const texto =
      novoStatus
        ? "ativar"
        : "desativar";


    const confirmou =
      window.confirm(
        `Deseja realmente ${texto} a empresa "${
          empresa.nome_fantasia ||
          empresa.nome
        }"?`
      );


    if (!confirmou) {
      return;
    }


    try {

      limparMensagens();


      const { data } =
        await api.patch(
          `/empresas/${empresa.id}/status`,
          {
            ativo:
              novoStatus,
          }
        );


      mostrarSucesso(
        data.message ||
        "Status alterado com sucesso."
      );


      await carregarEmpresas();

    } catch (err) {

      console.error(
        "Erro ao alterar status:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        "Não foi possível alterar o status."
      );
    }
  };


  /* =======================================================
     EXCLUIR EMPRESA

     BACKEND ESPERADO:

     DELETE /api/empresas/:id

     IMPORTANTE:
     a exclusão dos dados relacionados deve ser tratada
     pelo backend de forma segura.
  ======================================================= */

  const excluirEmpresa = async (
    empresa
  ) => {

    if (!empresa?.id) {
      return;
    }


    const nomeEmpresa =
      empresa.nome_fantasia ||
      empresa.nome ||
      `Empresa ${empresa.id}`;


    /* =====================================================
       PRIMEIRA CONFIRMAÇÃO
    ===================================================== */

    const confirmou =
      window.confirm(
        `Deseja realmente EXCLUIR a empresa "${nomeEmpresa}"?\n\nEsta ação pode excluir os dados vinculados à empresa e não poderá ser desfeita.`
      );


    if (!confirmou) {
      return;
    }


    /* =====================================================
       SEGUNDA CONFIRMAÇÃO

       Evita exclusão acidental.
    ===================================================== */

    const confirmouNovamente =
      window.confirm(
        `Confirma a exclusão definitiva de "${nomeEmpresa}"?`
      );


    if (!confirmouNovamente) {
      return;
    }


    try {

      limparMensagens();


      setEmpresaExcluindo(
        empresa.id
      );


      const { data } =
        await api.delete(
          `/empresas/${empresa.id}`
        );


      /* =====================================================
         SE ESTAVA EDITANDO A MESMA EMPRESA
      ===================================================== */

      if (
        empresaEditando?.id ===
        empresa.id
      ) {

        cancelarFormulario();
      }


      /* =====================================================
         SE MODAL CNPJ ESTAVA ABERTO
      ===================================================== */

      if (
        empresaCnpj?.id ===
        empresa.id
      ) {

        setEmpresaCnpj(
          null
        );


        setCnpjEditando(
          null
        );
      }


      /* =====================================================
         REMOVER IMEDIATAMENTE DA TELA
      ===================================================== */

      setEmpresas(
        (listaAtual) =>
          listaAtual.filter(
            (item) =>
              item.id !==
              empresa.id
          )
      );


      mostrarSucesso(
        data?.message ||
        "Empresa excluída com sucesso."
      );


      /* =====================================================
         SINCRONIZAR NOVAMENTE COM BANCO
      ===================================================== */

      await carregarEmpresas();

    } catch (err) {

      console.error(
        "Erro ao excluir empresa:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Não foi possível excluir a empresa."
      );

    } finally {

      setEmpresaExcluindo(
        null
      );
    }
  };


  /* =======================================================
     CNPJS
  ======================================================= */

  const abrirCnpjs = (
    empresa
  ) => {

    limparMensagens();


    setEmpresaCnpj(
      empresa
    );


    setCnpjEditando(
      null
    );


    const possuiCnpjAtivo =
      empresa.cnpjs?.some(
        (item) =>
          item.ativo !== false
      );


    setCnpjForm({

      cnpj: "",

      nome: "",

      principal:
        !possuiCnpjAtivo,

      ativo: true,
    });
  };


  const fecharCnpjs = () => {

    setEmpresaCnpj(
      null
    );


    setCnpjEditando(
      null
    );


    setCnpjForm({

      cnpj: "",

      nome: "",

      principal: false,

      ativo: true,
    });
  };


  const alterarCnpjForm = (e) => {

    const {
      name,
      value,
      type,
      checked,
    } =
      e.target;


    if (
      name === "cnpj"
    ) {

      setCnpjForm(
        (anterior) => ({

          ...anterior,

          cnpj:
            formatarCnpj(
              value
            ),
        })
      );


      return;
    }


    setCnpjForm(
      (anterior) => ({

        ...anterior,

        [name]:
          type === "checkbox"
            ? checked
            : value,
      })
    );
  };


  const editarCnpj = (
    cnpj
  ) => {

    setCnpjEditando(
      cnpj
    );


    setCnpjForm({

      cnpj:
        formatarCnpj(
          cnpj.cnpj
        ),

      nome:
        cnpj.nome_exibicao ||
        cnpj.nome ||
        "",

      principal:
        Boolean(
          cnpj.principal
        ),

      ativo:
        cnpj.ativo !== false,
    });
  };


  const cancelarEdicaoCnpj = () => {

    setCnpjEditando(
      null
    );


    const possuiCnpjAtivo =
      empresaCnpj?.cnpjs?.some(
        (item) =>
          item.ativo !== false
      );


    setCnpjForm({

      cnpj: "",

      nome: "",

      principal:
        !possuiCnpjAtivo,

      ativo: true,
    });
  };


  const atualizarEmpresaModal =
    async () => {

      if (!empresaCnpj?.id) {
        return;
      }


      const { data } =
        await api.get(
          `/empresas/${empresaCnpj.id}`
        );


      setEmpresaCnpj(
        data?.empresa ||
        data
      );
    };


  /* =======================================================
     SALVAR CNPJ
  ======================================================= */

  const salvarCnpj = async (e) => {

    e.preventDefault();


    if (!empresaCnpj) {
      return;
    }


    const cnpjLimpo =
      somenteNumeros(
        cnpjForm.cnpj
      );


    if (
      cnpjLimpo.length !== 14
    ) {

      mostrarErro(
        "O CNPJ precisa possuir 14 números."
      );


      return;
    }


    try {

      setSalvandoCnpj(
        true
      );


      limparMensagens();


      const payload = {

        cnpj:
          cnpjLimpo,

        nome_exibicao:
          cnpjForm.nome.trim() ||
          null,

        principal:
          Boolean(
            cnpjForm.principal
          ),

        ativo:
          Boolean(
            cnpjForm.ativo
          ),
      };


      let mensagemSucesso;


      if (cnpjEditando) {

        const { data } =
          await api.put(
            `/empresas/${empresaCnpj.id}/cnpjs/${cnpjEditando.id}`,
            payload
          );


        mensagemSucesso =
          data.message ||
          "CNPJ atualizado com sucesso.";

      } else {

        const { data } =
          await api.post(
            `/empresas/${empresaCnpj.id}/cnpjs`,
            payload
          );


        mensagemSucesso =
          data.message ||
          "CNPJ adicionado com sucesso.";
      }


      await atualizarEmpresaModal();


      await carregarEmpresas();


      cancelarEdicaoCnpj();


      mostrarSucesso(
        mensagemSucesso
      );

    } catch (err) {

      console.error(
        "Erro ao salvar CNPJ:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        "Não foi possível salvar o CNPJ."
      );

    } finally {

      setSalvandoCnpj(
        false
      );
    }
  };


  /* =======================================================
     REMOVER CNPJ
  ======================================================= */

  const removerCnpj = async (
    cnpj
  ) => {

    if (!empresaCnpj) {
      return;
    }


    const confirmou =
      window.confirm(
        `Deseja remover o CNPJ ${formatarCnpj(
          cnpj.cnpj
        )}?`
      );


    if (!confirmou) {
      return;
    }


    try {

      limparMensagens();


      const { data } =
        await api.delete(
          `/empresas/${empresaCnpj.id}/cnpjs/${cnpj.id}`
        );


      await atualizarEmpresaModal();


      await carregarEmpresas();


      if (
        cnpjEditando?.id ===
        cnpj.id
      ) {

        cancelarEdicaoCnpj();
      }


      mostrarSucesso(
        data.message ||
        "CNPJ removido com sucesso."
      );

    } catch (err) {

      console.error(
        "Erro ao remover CNPJ:",
        err
      );


      mostrarErro(
        err.response?.data?.error ||
        "Não foi possível remover o CNPJ."
      );
    }
  };


  /* =========================================================
     JSX
  ========================================================= */

  return (

    <div className="empresasPage">

      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <section className="empresasHeader">

        <div>

          <h1>
            Empresas
          </h1>

          <p>
            Gerencie as empresas que utilizam o sistema.
          </p>

        </div>


        <div className="empresasHeaderButtons">

          <button
            type="button"
            className="empresasRefreshButton"
            onClick={
              carregarEmpresas
            }
            disabled={
              carregando
            }
          >

            <FaSyncAlt />

            {
              carregando
                ? "Atualizando..."
                : "Atualizar"
            }

          </button>


          <button
            type="button"
            className="empresasAddButton"
            onClick={
              abrirNovaEmpresa
            }
          >

            <FaPlus />

            Nova empresa

          </button>

        </div>

      </section>


      {/* =====================================================
          MENSAGENS
      ===================================================== */}

      {
        mensagem &&
        (

          <div className="empresasMensagem empresasMensagemSucesso">

            {
              mensagem
            }

          </div>
        )
      }


      {
        erro &&
        (

          <div className="empresasMensagem empresasMensagemErro">

            {
              erro
            }

          </div>
        )
      }


      {/* =====================================================
          FORMULÁRIO
      ===================================================== */}

      {
        mostrarFormulario &&
        (

          <section className="empresaFormCard">

            <div className="empresaFormHeader">

              <h2>

                {
                  empresaEditando
                    ? "Editar empresa"
                    : "Cadastrar empresa"
                }

              </h2>

              <p>
                Configure os dados e a identidade visual da empresa.
              </p>

            </div>


            <form
              className="empresaForm"
              onSubmit={
                salvarEmpresa
              }
            >

              <div className="empresaFormGroup">

                <label>
                  Razão social *
                </label>

                <input
                  name="nome"
                  value={
                    form.nome
                  }
                  onChange={
                    alterarForm
                  }
                  placeholder="Razão social"
                  required
                />

              </div>


              <div className="empresaFormGroup">

                <label>
                  Nome fantasia
                </label>

                <input
                  name="nome_fantasia"
                  value={
                    form.nome_fantasia
                  }
                  onChange={
                    alterarForm
                  }
                  placeholder="Ex.: Hotel San Marinho"
                />

              </div>


              <div className="empresaFormGroup">

                <label>
                  Cor principal
                </label>

                <div className="empresaColorField">

                  <input
                    type="color"
                    name="cor_primaria"
                    value={
                      form.cor_primaria
                    }
                    onChange={
                      alterarForm
                    }
                  />

                  <input
                    name="cor_primaria"
                    value={
                      form.cor_primaria
                    }
                    onChange={
                      alterarForm
                    }
                    maxLength={
                      7
                    }
                  />

                </div>

              </div>


              <div className="empresaFormGroup">

                <label>
                  Cor secundária
                </label>

                <div className="empresaColorField">

                  <input
                    type="color"
                    name="cor_secundaria"
                    value={
                      form.cor_secundaria
                    }
                    onChange={
                      alterarForm
                    }
                  />

                  <input
                    name="cor_secundaria"
                    value={
                      form.cor_secundaria
                    }
                    onChange={
                      alterarForm
                    }
                    maxLength={
                      7
                    }
                  />

                </div>

              </div>


              {/* =================================================
                  LOGO
              ================================================= */}

              <div className="empresaFormGroup empresaUploadGroup">

                <label>
                  Logo da empresa
                </label>

                <label className="empresaUploadButton">

                  <FaUpload />

                  {
                    logoArquivo
                      ? "Trocar logo"
                      : logoPreview
                        ? "Alterar logo"
                        : "Selecionar logo"
                  }

                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={
                      selecionarLogo
                    }
                    hidden
                  />

                </label>


                {
                  logoArquivo &&
                  (

                    <div className="empresaArquivoSelecionado">

                      <span>
                        {
                          logoArquivo.name
                        }
                      </span>

                      <button
                        type="button"
                        onClick={
                          cancelarNovaLogo
                        }
                      >
                        <FaTimes />
                      </button>

                    </div>
                  )
                }

              </div>


              {/* =================================================
                  FUNDO
              ================================================= */}

              <div className="empresaFormGroup empresaUploadGroup">

                <label>
                  Imagem de fundo
                </label>

                <label className="empresaUploadButton">

                  <FaImage />

                  {
                    fundoArquivo
                      ? "Trocar imagem"
                      : fundoPreview
                        ? "Alterar imagem"
                        : "Selecionar imagem"
                  }

                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={
                      selecionarFundo
                    }
                    hidden
                  />

                </label>


                {
                  fundoArquivo &&
                  (

                    <div className="empresaArquivoSelecionado">

                      <span>
                        {
                          fundoArquivo.name
                        }
                      </span>

                      <button
                        type="button"
                        onClick={
                          cancelarNovoFundo
                        }
                      >
                        <FaTimes />
                      </button>

                    </div>
                  )
                }

              </div>


              {/* =================================================
                  PREVIEW
              ================================================= */}

              <div
                className="empresaPreview"

                style={{

                  "--preview-primary":
                    form.cor_primaria,

                  "--preview-secondary":
                    form.cor_secundaria,

                  backgroundImage:
                    fundoPreview
                      ? `linear-gradient(
                          rgba(0,0,0,.35),
                          rgba(0,0,0,.35)
                        ),
                        url("${fundoPreview}")`
                      : undefined,
                }}
              >

                <div className="empresaPreviewLogo">

                  {
                    logoPreview
                      ? (

                        <img
                          src={
                            logoPreview
                          }
                          alt="Prévia da logo"
                        />
                      )
                      : (

                        <FaBuilding />
                      )
                  }

                </div>


                <strong>

                  {
                    form.nome_fantasia ||
                    form.nome ||
                    "Sua empresa"
                  }

                </strong>


                <span>
                  Pré-visualização
                </span>


                <button
                  type="button"
                >
                  Exemplo de botão
                </button>

              </div>


              {/* =================================================
                  AÇÕES
              ================================================= */}

              <div className="empresaFormActions">

                <button
                  type="button"
                  className="empresaCancelButton"
                  onClick={
                    cancelarFormulario
                  }
                  disabled={
                    salvando
                  }
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  className="empresaSaveButton"
                  disabled={
                    salvando
                  }
                >

                  <FaSave />

                  {
                    salvando
                      ? "Salvando..."
                      : "Salvar empresa"
                  }

                </button>

              </div>

            </form>

          </section>
        )
      }


      {/* =====================================================
          LISTA DE EMPRESAS
      ===================================================== */}

      <section className="empresasListCard">

        <div className="empresasListHeader">

          <div>

            <h2>
              Empresas cadastradas
            </h2>

            <span>
              {empresas.length} empresa(s)
            </span>

          </div>

        </div>


        {
          carregando
            ? (

              <div className="empresasLoading">
                Carregando empresas...
              </div>
            )

            : empresas.length === 0
              ? (

                <div className="empresasEmpty">

                  <FaBuilding />

                  <h3>
                    Nenhuma empresa cadastrada
                  </h3>

                  <p>
                    Cadastre a primeira empresa para começar.
                  </p>

                </div>
              )

              : (

                <div className="empresasGrid">

                  {
                    empresas.map(
                      (empresa) => {

                        const logo =
                          getLogoUrl(
                            empresa
                          );


                        const excluindo =
                          empresaExcluindo ===
                          empresa.id;


                        return (

                          <article
                            className="empresaCard"
                            key={
                              empresa.id
                            }
                            style={{

                              "--card-primary":
                                empresa.cor_primaria ||
                                "#0d6efd",
                            }}
                          >

                            {/* ===============================
                                LOGO
                            =============================== */}

                            <div className="empresaCardIcon">

                              {
                                logo
                                  ? (

                                    <img
                                      src={
                                        logo
                                      }

                                      alt={
                                        empresa.nome_fantasia ||
                                        empresa.nome
                                      }

                                      onError={
                                        (e) => {

                                          console.error(
                                            "Erro ao carregar logo:",
                                            empresa.id,
                                            logo
                                          );


                                          e.currentTarget.style.display =
                                            "none";


                                          const fallback =
                                            e.currentTarget
                                              .nextElementSibling;


                                          if (fallback) {

                                            fallback.style.display =
                                              "block";
                                          }
                                        }
                                      }
                                    />
                                  )
                                  : null
                              }


                              <FaBuilding
                                style={{

                                  display:
                                    logo
                                      ? "none"
                                      : "block",
                                }}
                              />

                            </div>


                            {/* ===============================
                                CONTEÚDO
                            =============================== */}

                            <div className="empresaCardContent">

                              <div className="empresaCardTop">

                                <div>

                                  <h3>

                                    {
                                      empresa.nome_fantasia ||
                                      empresa.nome
                                    }

                                  </h3>


                                  {
                                    empresa.nome_fantasia &&
                                    (

                                      <p>
                                        {
                                          empresa.nome
                                        }
                                      </p>
                                    )
                                  }

                                </div>


                                <span
                                  className={
                                    `empresaStatus ${
                                      empresa.ativo
                                        ? "empresaAtiva"
                                        : "empresaInativa"
                                    }`
                                  }
                                >

                                  {
                                    empresa.ativo
                                      ? "ATIVA"
                                      : "INATIVA"
                                  }

                                </span>

                              </div>


                              {/* =============================
                                  CNPJ
                              ============================= */}

                              <div className="empresaResumoCnpj">

                                <FaIdCard />

                                <div>

                                  <span>
                                    CNPJs
                                  </span>

                                  <strong>

                                    {
                                      empresa.cnpjs?.length ||
                                      0
                                    }

                                  </strong>

                                </div>

                              </div>


                              {/* =============================
                                  CORES
                              ============================= */}

                              <div className="empresaCores">

                                <div>

                                  <span
                                    style={{

                                      background:
                                        empresa.cor_primaria ||
                                        "#0d6efd",
                                    }}
                                  />

                                  Principal

                                </div>


                                <div>

                                  <span
                                    style={{

                                      background:
                                        empresa.cor_secundaria ||
                                        "#1a1a1a",
                                    }}
                                  />

                                  Secundária

                                </div>

                              </div>


                              {/* =============================
                                  AÇÕES
                              ============================= */}

                              <div className="empresaCardActions">

                                <button
                                  type="button"
                                  className="empresaActionCnpj"
                                  disabled={
                                    excluindo
                                  }
                                  onClick={
                                    () =>
                                      abrirCnpjs(
                                        empresa
                                      )
                                  }
                                >

                                  <FaIdCard />

                                  CNPJs

                                </button>


                                <button
                                  type="button"
                                  className="empresaActionEdit"
                                  disabled={
                                    excluindo
                                  }
                                  onClick={
                                    () =>
                                      abrirEditarEmpresa(
                                        empresa
                                      )
                                  }
                                >

                                  <FaEdit />

                                  Editar

                                </button>


                                <button
                                  type="button"

                                  className={
                                    empresa.ativo
                                      ? "empresaActionDisable"
                                      : "empresaActionEnable"
                                  }

                                  disabled={
                                    excluindo
                                  }

                                  onClick={
                                    () =>
                                      alterarStatus(
                                        empresa
                                      )
                                  }
                                >

                                  <FaPowerOff />

                                  {
                                    empresa.ativo
                                      ? "Desativar"
                                      : "Ativar"
                                  }

                                </button>


                                {/* ===========================
                                    EXCLUIR EMPRESA
                                =========================== */}

                                <button
                                  type="button"

                                  className="empresaActionDelete"

                                  disabled={
                                    excluindo
                                  }

                                  onClick={
                                    () =>
                                      excluirEmpresa(
                                        empresa
                                      )
                                  }
                                >

                                  <FaTrash />

                                  {
                                    excluindo
                                      ? "Excluindo..."
                                      : "Excluir"
                                  }

                                </button>

                              </div>

                            </div>

                          </article>
                        );
                      }
                    )
                  }

                </div>
              )
        }

      </section>


      {/* =====================================================
          MODAL CNPJ
      ===================================================== */}

      {
        empresaCnpj &&
        (

          <div
            className="empresaModalOverlay"

            onMouseDown={
              (e) => {

                if (
                  e.target ===
                  e.currentTarget
                ) {

                  fecharCnpjs();
                }
              }
            }
          >

            <div className="empresaModal">

              {/* =============================================
                  HEADER
              ============================================= */}

              <div className="empresaModalHeader">

                <div>

                  <h2>
                    CNPJs da empresa
                  </h2>

                  <p>

                    {
                      empresaCnpj.nome_fantasia ||
                      empresaCnpj.nome
                    }

                  </p>

                </div>


                <button
                  type="button"
                  className="empresaModalClose"
                  onClick={
                    fecharCnpjs
                  }
                >

                  <FaTimes />

                </button>

              </div>


              {/* =============================================
                  LISTA CNPJ
              ============================================= */}

              <div className="empresaCnpjLista">

                {
                  !empresaCnpj.cnpjs?.length
                    ? (

                      <div className="empresaCnpjVazio">
                        Nenhum CNPJ cadastrado.
                      </div>
                    )

                    : (

                      empresaCnpj.cnpjs.map(
                        (item) => (

                          <div
                            className={
                              `empresaCnpjItem ${
                                item.principal
                                  ? "empresaCnpjPrincipal"
                                  : ""
                              }`
                            }

                            key={
                              item.id
                            }
                          >

                            <div className="empresaCnpjInfo">

                              <strong>

                                {
                                  formatarCnpj(
                                    item.cnpj
                                  )
                                }

                              </strong>


                              <span>

                                {
                                  item.nome_exibicao ||
                                  item.nome ||
                                  "Sem identificação"
                                }

                              </span>


                              <div className="empresaCnpjBadges">

                                {
                                  item.principal &&
                                  (

                                    <span className="cnpjPrincipalBadge">

                                      <FaStar />

                                      Principal

                                    </span>
                                  )
                                }


                                <span
                                  className={
                                    item.ativo
                                      ? "cnpjAtivoBadge"
                                      : "cnpjInativoBadge"
                                  }
                                >

                                  {
                                    item.ativo
                                      ? "Ativo"
                                      : "Inativo"
                                  }

                                </span>

                              </div>

                            </div>


                            <div className="empresaCnpjButtons">

                              <button
                                type="button"
                                onClick={
                                  () =>
                                    editarCnpj(
                                      item
                                    )
                                }
                              >

                                <FaEdit />

                              </button>


                              <button
                                type="button"
                                className="empresaCnpjDelete"
                                onClick={
                                  () =>
                                    removerCnpj(
                                      item
                                    )
                                }
                              >

                                <FaTrash />

                              </button>

                            </div>

                          </div>
                        )
                      )
                    )
                }

              </div>


              {/* =============================================
                  FORM CNPJ
              ============================================= */}

              <form
                className="empresaCnpjForm"
                onSubmit={
                  salvarCnpj
                }
              >

                <h3>

                  {
                    cnpjEditando
                      ? "Editar CNPJ"
                      : "Adicionar CNPJ"
                  }

                </h3>


                <div className="empresaCnpjFormGrid">

                  <div>

                    <label>
                      CNPJ
                    </label>

                    <input
                      name="cnpj"
                      value={
                        cnpjForm.cnpj
                      }
                      onChange={
                        alterarCnpjForm
                      }
                      placeholder="00.000.000/0000-00"
                      maxLength={
                        18
                      }
                      inputMode="numeric"
                      required
                    />

                  </div>


                  <div>

                    <label>
                      Identificação
                    </label>

                    <input
                      name="nome"
                      value={
                        cnpjForm.nome
                      }
                      onChange={
                        alterarCnpjForm
                      }
                      placeholder="Ex.: Hotel / Matriz"
                    />

                  </div>

                </div>


                <div className="empresaCnpjChecks">

                  <label>

                    <input
                      type="checkbox"
                      name="principal"
                      checked={
                        cnpjForm.principal
                      }
                      onChange={
                        alterarCnpjForm
                      }
                    />

                    CNPJ principal

                  </label>


                  {
                    cnpjEditando &&
                    (

                      <label>

                        <input
                          type="checkbox"
                          name="ativo"
                          checked={
                            cnpjForm.ativo
                          }
                          onChange={
                            alterarCnpjForm
                          }
                        />

                        CNPJ ativo

                      </label>
                    )
                  }

                </div>


                <div className="empresaCnpjFormActions">

                  {
                    cnpjEditando &&
                    (

                      <button
                        type="button"
                        className="empresaCnpjCancel"
                        onClick={
                          cancelarEdicaoCnpj
                        }
                      >
                        Cancelar edição
                      </button>
                    )
                  }


                  <button
                    type="submit"
                    className="empresaCnpjSave"
                    disabled={
                      salvandoCnpj
                    }
                  >

                    <FaSave />

                    {
                      salvandoCnpj
                        ? "Salvando..."
                        : cnpjEditando
                          ? "Salvar alteração"
                          : "Adicionar CNPJ"
                    }

                  </button>

                </div>

              </form>

            </div>

          </div>
        )
      }

    </div>
  );
}