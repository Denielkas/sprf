import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaBuilding,
  FaPalette,
  FaPlus,
  FaTrash,
  FaSave,
  FaImage,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../services/api";

import "./configurarEmpresa.css";

/* =========================================================
   UTILIDADES
========================================================= */

const somenteNumeros = (valor = "") =>
  String(valor).replace(/\D/g, "");

const formatarCNPJ = (valor = "") => {
  const numeros = somenteNumeros(valor).slice(0, 14);

  if (numeros.length <= 2) {
    return numeros;
  }

  if (numeros.length <= 5) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2)}`;
  }

  if (numeros.length <= 8) {
    return `${numeros.slice(0, 2)}.${numeros.slice(
      2,
      5
    )}.${numeros.slice(5)}`;
  }

  if (numeros.length <= 12) {
    return `${numeros.slice(0, 2)}.${numeros.slice(
      2,
      5
    )}.${numeros.slice(5, 8)}/${numeros.slice(8)}`;
  }

  return `${numeros.slice(0, 2)}.${numeros.slice(
    2,
    5
  )}.${numeros.slice(5, 8)}/${numeros.slice(
    8,
    12
  )}-${numeros.slice(12, 14)}`;
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function ConfigurarEmpresa() {
  const { id } = useParams();

  const navigate = useNavigate();

  /* =======================================================
     ESTADOS
  ======================================================= */

  const [carregando, setCarregando] = useState(true);

  const [salvando, setSalvando] = useState(false);

  const [mensagem, setMensagem] = useState("");

  const [erro, setErro] = useState(false);

  const [empresa, setEmpresa] = useState(null);

  const [form, setForm] = useState({
    nome: "",
    nome_fantasia: "",

    cor_primaria: "#0d6efd",

    logo: null,
    fundo: null,
  });

  /*
    Deixamos CNPJs separados porque uma empresa
    poderá possuir mais de um CNPJ.
  */

  const [cnpjs, setCnpjs] = useState([
    {
      id: null,
      cnpj: "",
      descricao: "Principal",
    },
  ]);

  /* =======================================================
     PREVIEW DAS IMAGENS
  ======================================================= */

  const [logoPreview, setLogoPreview] = useState(null);

  const [fundoPreview, setFundoPreview] = useState(null);

  /* =======================================================
     BUSCAR EMPRESA
  ======================================================= */

  const carregarEmpresa = async () => {
    try {
      setCarregando(true);

      setErro(false);

      setMensagem("");

      /*
        Neste momento usamos GET /empresas
        porque nosso backend atual já possui essa rota.

        Depois criaremos:
        GET /empresas/:id
      */

      const { data } = await api.get("/empresas");

      const lista = Array.isArray(data) ? data : [];

      const encontrada = lista.find(
        (item) => String(item.id) === String(id)
      );

      if (!encontrada) {
        setErro(true);

        setMensagem("Empresa não encontrada.");

        setEmpresa(null);

        return;
      }

      setEmpresa(encontrada);

      setForm({
        nome: encontrada.nome || "",

        nome_fantasia:
          encontrada.nome_fantasia || "",

        cor_primaria:
          encontrada.cor_primaria || "#0d6efd",

        logo: null,

        fundo: null,
      });

      /*
        Enquanto ainda não temos a tabela
        empresa_cnpjs, carregamos o CNPJ principal
        que já existe na tabela empresas.
      */

      setCnpjs([
        {
          id: null,

          cnpj: encontrada.cnpj
            ? formatarCNPJ(encontrada.cnpj)
            : "",

          descricao: "Principal",
        },
      ]);
    } catch (error) {
      console.error(
        "Erro ao carregar empresa:",
        error
      );

      setErro(true);

      setMensagem(
        error.response?.data?.error ||
          "Não foi possível carregar a empresa."
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEmpresa();
  }, [id]);

  /* =======================================================
     ALTERAR CAMPOS
  ======================================================= */

  const alterarCampo = (event) => {
    const { name, value } = event.target;

    setForm((anterior) => ({
      ...anterior,

      [name]: value,
    }));
  };

  /* =======================================================
     CNPJs
  ======================================================= */

  const adicionarCNPJ = () => {
    setCnpjs((anterior) => [
      ...anterior,

      {
        id: null,
        cnpj: "",
        descricao: "",
      },
    ]);
  };

  const alterarCNPJ = (
    index,
    campo,
    valor
  ) => {
    setCnpjs((anterior) =>
      anterior.map((item, posicao) => {
        if (posicao !== index) {
          return item;
        }

        return {
          ...item,

          [campo]:
            campo === "cnpj"
              ? formatarCNPJ(valor)
              : valor,
        };
      })
    );
  };

  const removerCNPJ = (index) => {
    /*
      Pelo menos um CNPJ fica disponível.
    */

    if (cnpjs.length === 1) {
      setCnpjs([
        {
          id: null,
          cnpj: "",
          descricao: "Principal",
        },
      ]);

      return;
    }

    setCnpjs((anterior) =>
      anterior.filter(
        (_, posicao) => posicao !== index
      )
    );
  };

  /* =======================================================
     LOGO
  ======================================================= */

  const selecionarLogo = (event) => {
    const arquivo = event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    setForm((anterior) => ({
      ...anterior,

      logo: arquivo,
    }));

    const url = URL.createObjectURL(arquivo);

    setLogoPreview(url);
  };

  /* =======================================================
     IMAGEM DE FUNDO
  ======================================================= */

  const selecionarFundo = (event) => {
    const arquivo = event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    setForm((anterior) => ({
      ...anterior,

      fundo: arquivo,
    }));

    const url = URL.createObjectURL(arquivo);

    setFundoPreview(url);
  };

  /* =======================================================
     SALVAR
  ======================================================= */

  const salvarConfiguracoes = async (
    event
  ) => {
    event.preventDefault();

    if (salvando) {
      return;
    }

    setErro(false);

    setMensagem("");

    /* =====================================================
       VALIDAR NOME
    ===================================================== */

    if (!form.nome.trim()) {
      setErro(true);

      setMensagem(
        "Informe a razão social da empresa."
      );

      return;
    }

    /* =====================================================
       VALIDAR CNPJs
    ===================================================== */

    const cnpjsPreenchidos = cnpjs.filter(
      (item) =>
        somenteNumeros(item.cnpj).length > 0
    );

    for (const item of cnpjsPreenchidos) {
      const numeros = somenteNumeros(
        item.cnpj
      );

      if (numeros.length !== 14) {
        setErro(true);

        setMensagem(
          `O CNPJ ${
            item.cnpj || "informado"
          } é inválido.`
        );

        return;
      }
    }

    /*
      O salvamento completo será conectado
      quando criarmos no backend:

      PUT /api/empresas/:id

      POST /api/empresas/:id/cnpjs

      POST /api/empresas/:id/identidade-visual
    */

    try {
      setSalvando(true);

      /*
        Por enquanto mostramos os dados que
        estão preparados para o backend.
      */

      const dados = {
        empresa_id: id,

        nome: form.nome.trim(),

        nome_fantasia:
          form.nome_fantasia.trim() || null,

        cor_primaria:
          form.cor_primaria,

        cnpjs: cnpjsPreenchidos.map(
          (item) => ({
            cnpj: somenteNumeros(
              item.cnpj
            ),

            descricao:
              item.descricao.trim() ||
              null,
          })
        ),
      };

      console.log(
        "Configuração preparada:",
        dados
      );

      setErro(false);

      setMensagem(
        "Configurações preparadas. Agora vamos conectar esta tela ao backend."
      );
    } catch (error) {
      console.error(
        "Erro ao salvar configurações:",
        error
      );

      setErro(true);

      setMensagem(
        "Erro ao preparar as configurações."
      );
    } finally {
      setSalvando(false);
    }
  };

  /* =======================================================
     CARREGANDO
  ======================================================= */

  if (carregando) {
    return (
      <div className="configEmpresaLoading">
        Carregando empresa...
      </div>
    );
  }

  /* =======================================================
     EMPRESA NÃO ENCONTRADA
  ======================================================= */

  if (!empresa) {
    return (
      <div className="configEmpresaPage">
        <div className="configEmpresaErroCard">
          <h2>Empresa não encontrada</h2>

          <p>
            {mensagem ||
              "Não foi possível encontrar esta empresa."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/app/empresas")
            }
          >
            <FaArrowLeft />

            Voltar para empresas
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="configEmpresaPage">

      {/* ===================================================
          CABEÇALHO
      =================================================== */}

      <div className="configEmpresaHeader">
        <div className="configEmpresaHeaderLeft">
          <button
            type="button"
            className="configVoltarButton"
            onClick={() =>
              navigate("/app/empresas")
            }
          >
            <FaArrowLeft />
          </button>

          <div>
            <span className="configEmpresaMiniTitulo">
              Configuração da empresa
            </span>

            <h1>
              {form.nome_fantasia ||
                form.nome}
            </h1>

            <p>
              Empresa #{empresa.id}
            </p>
          </div>
        </div>

        <div
          className="configEmpresaHeaderIcon"
          style={{
            backgroundColor:
              form.cor_primaria,
          }}
        >
          <FaBuilding />
        </div>
      </div>

      {/* ===================================================
          MENSAGEM
      =================================================== */}

      {mensagem && (
        <div
          className={
            erro
              ? "configMensagem configMensagemErro"
              : "configMensagem configMensagemSucesso"
          }
        >
          {mensagem}
        </div>
      )}

      {/* ===================================================
          FORMULÁRIO
      =================================================== */}

      <form
        onSubmit={salvarConfiguracoes}
        className="configEmpresaForm"
      >

        {/* =================================================
            DADOS DA EMPRESA
        ================================================= */}

        <section className="configSection">
          <div className="configSectionHeader">
            <div className="configSectionIcon">
              <FaBuilding />
            </div>

            <div>
              <h2>Dados da empresa</h2>

              <p>
                Informações principais da empresa.
              </p>
            </div>
          </div>

          <div className="configFieldsGrid">
            <div className="configField">
              <label>Razão social</label>

              <input
                type="text"
                name="nome"
                value={form.nome}
                onChange={alterarCampo}
                required
              />
            </div>

            <div className="configField">
              <label>Nome fantasia</label>

              <input
                type="text"
                name="nome_fantasia"
                value={form.nome_fantasia}
                onChange={alterarCampo}
                placeholder="Nome exibido no sistema"
              />
            </div>
          </div>
        </section>

        {/* =================================================
            CNPJs
        ================================================= */}

        <section className="configSection">
          <div className="configSectionHeader configSectionHeaderBetween">
            <div className="configSectionHeaderInfo">
              <div className="configSectionIcon">
                <FaBuilding />
              </div>

              <div>
                <h2>CNPJs</h2>

                <p>
                  Cadastre os CNPJs utilizados
                  por esta empresa.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="configAdicionarButton"
              onClick={adicionarCNPJ}
              style={{
                backgroundColor:
                  form.cor_primaria,
              }}
            >
              <FaPlus />

              Adicionar CNPJ
            </button>
          </div>

          <div className="configCnpjLista">
            {cnpjs.map(
              (item, index) => (
                <div
                  className="configCnpjItem"
                  key={index}
                >
                  <div className="configCnpjNumero">
                    {index + 1}
                  </div>

                  <div className="configField">
                    <label>
                      Descrição
                    </label>

                    <input
                      type="text"
                      value={
                        item.descricao
                      }
                      onChange={(event) =>
                        alterarCNPJ(
                          index,
                          "descricao",
                          event.target.value
                        )
                      }
                      placeholder="Ex.: Hotel, Restaurante..."
                    />
                  </div>

                  <div className="configField">
                    <label>CNPJ</label>

                    <input
                      type="text"
                      value={item.cnpj}
                      maxLength={18}
                      inputMode="numeric"
                      onChange={(event) =>
                        alterarCNPJ(
                          index,
                          "cnpj",
                          event.target.value
                        )
                      }
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <button
                    type="button"
                    className="configRemoverCnpj"
                    onClick={() =>
                      removerCNPJ(index)
                    }
                    title="Remover CNPJ"
                  >
                    <FaTrash />
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        {/* =================================================
            IDENTIDADE VISUAL
        ================================================= */}

        <section className="configSection">
          <div className="configSectionHeader">
            <div className="configSectionIcon">
              <FaPalette />
            </div>

            <div>
              <h2>Identidade visual</h2>

              <p>
                Personalize o sistema para
                esta empresa.
              </p>
            </div>
          </div>

          <div className="configVisualGrid">

            {/* COR */}

            <div className="configVisualCard">
              <h3>Cor principal</h3>

              <p>
                Utilizada nos botões, menus e
                destaques do sistema.
              </p>

              <div className="configColorArea">
                <input
                  type="color"
                  name="cor_primaria"
                  value={
                    form.cor_primaria
                  }
                  onChange={alterarCampo}
                  className="configColorPicker"
                />

                <input
                  type="text"
                  name="cor_primaria"
                  value={
                    form.cor_primaria
                  }
                  onChange={alterarCampo}
                  className="configColorText"
                  maxLength={7}
                />
              </div>
            </div>

            {/* LOGO */}

            <div className="configVisualCard">
              <h3>Logo</h3>

              <p>
                Logo exibida no sistema da
                empresa.
              </p>

              <label className="configUploadArea">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Prévia da logo"
                    className="configLogoPreview"
                  />
                ) : (
                  <>
                    <FaImage />

                    <span>
                      Selecionar logo
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={selecionarLogo}
                />
              </label>

              {form.logo && (
                <span className="configArquivoNome">
                  {form.logo.name}
                </span>
              )}
            </div>

            {/* FUNDO */}

            <div className="configVisualCard">
              <h3>Imagem de fundo</h3>

              <p>
                Fundo utilizado nas telas
                principais.
              </p>

              <label className="configUploadArea configFundoUpload">
                {fundoPreview ? (
                  <img
                    src={fundoPreview}
                    alt="Prévia do fundo"
                    className="configFundoPreview"
                  />
                ) : (
                  <>
                    <FaImage />

                    <span>
                      Selecionar imagem
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={
                    selecionarFundo
                  }
                />
              </label>

              {form.fundo && (
                <span className="configArquivoNome">
                  {form.fundo.name}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* =================================================
            PREVIEW
        ================================================= */}

        <section className="configSection">
          <div className="configSectionHeader">
            <div className="configSectionIcon">
              <FaPalette />
            </div>

            <div>
              <h2>Pré-visualização</h2>

              <p>
                Exemplo de como a identidade
                da empresa será aplicada.
              </p>
            </div>
          </div>

          <div
            className="configPreview"
            style={
              fundoPreview
                ? {
                    backgroundImage: `linear-gradient(
                      rgba(0,0,0,.45),
                      rgba(0,0,0,.45)
                    ), url(${fundoPreview})`,
                  }
                : {}
            }
          >
            <div className="configPreviewLogo">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo"
                />
              ) : (
                <FaBuilding />
              )}
            </div>

            <h2>
              {form.nome_fantasia ||
                form.nome ||
                "Nome da empresa"}
            </h2>

            <button
              type="button"
              style={{
                backgroundColor:
                  form.cor_primaria,
              }}
            >
              Exemplo de botão
            </button>
          </div>
        </section>

        {/* =================================================
            SALVAR
        ================================================= */}

        <div className="configEmpresaActions">
          <button
            type="button"
            className="configCancelarButton"
            onClick={() =>
              navigate("/app/empresas")
            }
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="configSalvarButton"
            disabled={salvando}
            style={{
              backgroundColor:
                form.cor_primaria,
            }}
          >
            <FaSave />

            {salvando
              ? "Salvando..."
              : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}