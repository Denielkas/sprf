import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { api } from "../../services/api";
import "./listar.css";

/* =========================================================
   UTILITÁRIOS
========================================================= */

const onlyDigits = (v = "") =>
  String(v).replace(/\D+/g, "");

const formatCPF = (v = "") => {
  const s = onlyDigits(v).slice(0, 11);

  if (s.length <= 3) return s;

  if (s.length <= 6) {
    return `${s.slice(0, 3)}.${s.slice(3, 6)}`;
  }

  if (s.length <= 9) {
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(
      6,
      9
    )}`;
  }

  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(
    6,
    9
  )}-${s.slice(9, 11)}`;
};

const formatCNPJ = (v = "") => {
  const s = onlyDigits(v).slice(0, 14);

  if (s.length <= 2) return s;

  if (s.length <= 5) {
    return `${s.slice(0, 2)}.${s.slice(2)}`;
  }

  if (s.length <= 8) {
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`;
  }

  if (s.length <= 12) {
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(
      5,
      8
    )}/${s.slice(8)}`;
  }

  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(
    5,
    8
  )}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
};

const formatarDataHora = (valor) => {
  if (!valor) return "";

  try {
    return new Date(valor).toLocaleString("pt-BR");
  } catch (_) {
    return "";
  }
};

/* =========================================================
   NORMALIZAR CNPJS
========================================================= */

function normalizarCnpjs(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cnpjs)) return data.cnpjs;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function nomeCnpj(item = {}) {
  return (
    item.nome_exibicao ||
    item.identificacao ||
    item.nome ||
    item.razao_social ||
    "CNPJ da empresa"
  );
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function ListarFuncionarios() {
  const navigate = useNavigate();

  /* =======================================================
     LISTAGEM
  ======================================================= */

  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");
  const [busca, setBusca] = useState("");

  /* =======================================================
     EDIÇÃO
  ======================================================= */

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [funcoes, setFuncoes] = useState([]);

  const [cnpjsEmpresa, setCnpjsEmpresa] = useState([]);
  const [carregandoCnpjs, setCarregandoCnpjs] =
    useState(false);
  const [erroCnpjs, setErroCnpjs] = useState("");

  /* =======================================================
     AÇÕES
  ======================================================= */

  const [acoesModalOpen, setAcoesModalOpen] =
    useState(false);

  const [funcionarioAcoes, setFuncionarioAcoes] =
    useState(null);

  /* =======================================================
     GALERIA DE FOTOS
  ======================================================= */

  const [galeriaOpen, setGaleriaOpen] = useState(false);

  const [galeriaFuncionario, setGaleriaFuncionario] =
    useState(null);

  const [galeriaImagens, setGaleriaImagens] =
    useState([]);

  const [galeriaCarregando, setGaleriaCarregando] =
    useState(false);

  const [galeriaErro, setGaleriaErro] =
    useState("");

  /*
   * Guardamos as URLs blob criadas para cada fotografia.
   *
   * Exemplo:
   *
   * {
   *   5: "blob:http://...",
   *   8: "blob:http://..."
   * }
   */
  const [urlsImagens, setUrlsImagens] =
    useState({});

  const [imagemExcluindoId, setImagemExcluindoId] =
    useState(null);

  /* =======================================================
     IMAGEM AMPLIADA
  ======================================================= */

  const [imagemModalOpen, setImagemModalOpen] =
    useState(false);

  const [imagemModalUrl, setImagemModalUrl] =
    useState("");

  const [imagemModalNome, setImagemModalNome] =
    useState("");

  /* =======================================================
     FORM
  ======================================================= */

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    chegada: "",
    intervalo_inicio: "",
    intervalo_fim: "",
    saida: "",
    funcao_id: "",
    funcao_nome: "",
    cnpj_empresa: "",
  });

  /* =======================================================
     FILTRO
  ======================================================= */

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return lista;
    }

    return lista.filter((f) => {
      const numero = String(
        f.numero_empresa || ""
      ).toLowerCase();

      const nome = String(
        f.nome || ""
      ).toLowerCase();

      const cpf = String(
        f.cpf || ""
      ).toLowerCase();

      const funcao = String(
        f.funcao_nome ||
          f.funcao ||
          ""
      ).toLowerCase();

      const cnpj = String(
        f.cnpj_empresa || ""
      ).toLowerCase();

      return (
        numero.includes(termo) ||
        nome.includes(termo) ||
        cpf.includes(termo) ||
        funcao.includes(termo) ||
        cnpj.includes(termo)
      );
    });
  }, [lista, busca]);

  const funcionariosAtivos = useMemo(() => {
    return listaFiltrada.filter(
      (f) => f.ativo !== false
    );
  }, [listaFiltrada]);

  const funcionariosInativos = useMemo(() => {
    return listaFiltrada.filter(
      (f) => f.ativo === false
    );
  }, [listaFiltrada]);

  const total = funcionariosAtivos.length;

  /* =======================================================
     LIMPAR URLS BLOB
  ======================================================= */

  const limparUrlsGaleria = () => {
    Object.values(urlsImagens).forEach((url) => {
      if (
        typeof url === "string" &&
        url.startsWith("blob:")
      ) {
        URL.revokeObjectURL(url);
      }
    });

    setUrlsImagens({});
  };

  /* =======================================================
     CARREGAR FUNCIONÁRIOS
  ======================================================= */

  const carregar = async () => {
    setMsg("Carregando...");

    try {
      const { data } = await api.get(
        "/funcionarios"
      );

      const dados = Array.isArray(data)
        ? data
        : Array.isArray(data?.funcionarios)
        ? data.funcionarios
        : [];

      const funcionariosOrdenados = [...dados].sort(
        (a, b) => {
          const numeroA =
            Number(a.numero_empresa) || 0;

          const numeroB =
            Number(b.numero_empresa) || 0;

          if (numeroA !== numeroB) {
            return numeroA - numeroB;
          }

          return Number(a.id) - Number(b.id);
        }
      );

      console.log(
        "FUNCIONÁRIOS:",
        funcionariosOrdenados
      );

      setLista(funcionariosOrdenados);

      setFuncionarioAcoes((atual) => {
        if (!atual) return atual;

        return (
          funcionariosOrdenados.find(
            (f) =>
              Number(f.id) ===
              Number(atual.id)
          ) || atual
        );
      });

      setMsg("");
    } catch (err) {
      console.error(
        "Erro ao carregar funcionários:",
        err
      );

      setMsg(
        err.response?.data?.error ||
          "Erro ao carregar funcionários."
      );
    }
  };

  /* =======================================================
     FUNÇÕES
  ======================================================= */

  const carregarFuncoes = async () => {
    try {
      const { data } = await api.get(
        "/funcoes"
      );

      setFuncoes(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.funcoes)
          ? data.funcoes
          : []
      );
    } catch (err) {
      console.error(
        "Erro ao carregar funções:",
        err
      );
    }
  };

  /* =======================================================
     CNPJS
  ======================================================= */

  const carregarCnpjsEmpresa = async () => {
    setCarregandoCnpjs(true);
    setErroCnpjs("");

    try {
      const response = await api.get(
        "/empresa-cnpjs"
      );

      const dados = normalizarCnpjs(
        response.data
      );

      const ativos = dados.filter((item) => {
        return !(
          item.ativo === false ||
          item.ativo === 0 ||
          item.ativo === "false"
        );
      });

      ativos.sort((a, b) => {
        const aPrincipal =
          a.principal === true ||
          a.principal === 1 ||
          a.principal === "true";

        const bPrincipal =
          b.principal === true ||
          b.principal === 1 ||
          b.principal === "true";

        if (aPrincipal && !bPrincipal) return -1;
        if (!aPrincipal && bPrincipal) return 1;

        return nomeCnpj(a).localeCompare(
          nomeCnpj(b),
          "pt-BR"
        );
      });

      setCnpjsEmpresa(ativos);

      if (ativos.length === 0) {
        setErroCnpjs(
          "Nenhum CNPJ retornado pela empresa logada."
        );
      }

      return ativos;
    } catch (err) {
      console.error(
        "Erro ao carregar CNPJs:",
        err
      );

      setErroCnpjs(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao carregar os CNPJs da empresa."
      );

      setCnpjsEmpresa([]);

      return [];
    } finally {
      setCarregandoCnpjs(false);
    }
  };

  /* =======================================================
     INICIALIZAÇÃO
  ======================================================= */

  useEffect(() => {
    carregar();
    carregarFuncoes();
    carregarCnpjsEmpresa();
  }, []);

  /* =======================================================
     CNPJ
  ======================================================= */

  const buscarCnpjCadastrado = (cnpj) => {
    if (!cnpj) return null;

    const numero = onlyDigits(cnpj);

    return (
      cnpjsEmpresa.find((item) => {
        return (
          onlyDigits(
            item.cnpj ||
              item.numero ||
              item.cnpj_numero ||
              ""
          ) === numero
        );
      }) || null
    );
  };

  const pegarNumeroCnpj = (item = {}) => {
    return onlyDigits(
      item.cnpj ||
        item.numero ||
        item.cnpj_numero ||
        ""
    );
  };

  /* =======================================================
     EDIÇÃO
  ======================================================= */

  const abrirModal = async (f) => {
    setEditing(f);

    const cnpjsAtualizados =
      await carregarCnpjsEmpresa();

    let cnpjAtual = onlyDigits(
      f.cnpj_empresa ||
        f.cnpj ||
        ""
    );

    if (
      !cnpjAtual &&
      cnpjsAtualizados.length > 0
    ) {
      const principal =
        cnpjsAtualizados.find(
          (item) =>
            item.principal === true ||
            item.principal === 1 ||
            item.principal === "true"
        );

      if (principal) {
        cnpjAtual =
          pegarNumeroCnpj(principal);
      }
    }

    setForm({
      nome: f.nome || "",

      cpf: formatCPF(
        f.cpf || ""
      ),

      chegada: (
        f.chegada || ""
      ).slice(0, 5),

      intervalo_inicio: (
        f.intervalo_inicio || ""
      ).slice(0, 5),

      intervalo_fim: (
        f.intervalo_fim || ""
      ).slice(0, 5),

      saida: (
        f.saida || ""
      ).slice(0, 5),

      funcao_id: f.funcao_id
        ? String(f.funcao_id)
        : "",

      funcao_nome: "",

      cnpj_empresa:
        cnpjAtual,
    });

    setOpen(true);
  };

  const fecharModal = () => {
    setOpen(false);
    setEditing(null);

    setForm({
      nome: "",
      cpf: "",
      chegada: "",
      intervalo_inicio: "",
      intervalo_fim: "",
      saida: "",
      funcao_id: "",
      funcao_nome: "",
      cnpj_empresa: "",
    });
  };

  /* =======================================================
     AÇÕES
  ======================================================= */

  const abrirModalAcoes = (f) => {
    setFuncionarioAcoes(f);

    document.body.style.overflow =
      "hidden";

    setAcoesModalOpen(true);
  };

  const fecharModalAcoes = () => {
    document.body.style.overflow = "";

    setAcoesModalOpen(false);
    setFuncionarioAcoes(null);
  };

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const onChange = (e) => {
    const { name, value } = e.target;

    setForm((old) => ({
      ...old,

      [name]:
        name === "cpf"
          ? formatCPF(value)
          : name === "cnpj_empresa"
          ? onlyDigits(value)
          : value,

      ...(name === "funcao_id" &&
      value !== "outro"
        ? {
            funcao_nome: "",
          }
        : {}),
    }));
  };

  /* =======================================================
     SALVAR FUNCIONÁRIO
  ======================================================= */

  const salvarAlteracoes = async () => {
    if (!editing) return;

    if (!form.nome.trim()) {
      alert(
        "Informe o nome do funcionário."
      );
      return;
    }

    if (
      onlyDigits(form.cpf).length !== 11
    ) {
      alert("Informe um CPF válido.");
      return;
    }

    if (
      form.funcao_id === "outro" &&
      !form.funcao_nome.trim()
    ) {
      alert("Informe a nova função.");
      return;
    }

    if (!form.cnpj_empresa) {
      alert(
        "Selecione a empresa/CNPJ do funcionário."
      );
      return;
    }

    const cnpjSelecionado =
      buscarCnpjCadastrado(
        form.cnpj_empresa
      );

    if (!cnpjSelecionado) {
      alert(
        "Selecione um dos CNPJs cadastrados da empresa."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        nome: form.nome.trim(),

        cpf: onlyDigits(
          form.cpf
        ),

        chegada:
          form.chegada || null,

        intervalo_inicio:
          form.intervalo_inicio || null,

        intervalo_fim:
          form.intervalo_fim || null,

        saida:
          form.saida || null,

        funcao_id:
          form.funcao_id === "outro" ||
          !form.funcao_id
            ? null
            : Number(form.funcao_id),

        funcao_nome:
          form.funcao_id === "outro"
            ? form.funcao_nome.trim()
            : null,

        cnpj_empresa:
          onlyDigits(
            form.cnpj_empresa
          ),
      };

      await api.put(
        `/funcionarios/${editing.id}`,
        payload
      );

      await carregarFuncoes();
      await carregarCnpjsEmpresa();
      await carregar();

      fecharModal();

      alert(
        "Funcionário atualizado com sucesso."
      );
    } catch (err) {
      console.error(
        "Erro ao atualizar funcionário:",
        err
      );

      alert(
        err.response?.data?.error ||
          "Erro ao atualizar funcionário."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     CARREGAR UMA FOTO BYTEA
  ======================================================= */

  const carregarBlobImagem = async (
    funcionarioId,
    fotoId
  ) => {
    const response = await api.get(
      `/funcionarios/${funcionarioId}/rostos/${fotoId}`,
      {
        responseType: "blob",
      }
    );

    if (
      !response.data ||
      response.data.size === 0
    ) {
      throw new Error(
        "Imagem facial vazia."
      );
    }

    const contentType =
      response.headers?.["content-type"] ||
      response.data?.type ||
      "image/jpeg";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      const texto =
        await response.data.text();

      try {
        const json =
          JSON.parse(texto);

        throw new Error(
          json.error ||
            json.message ||
            "Imagem não encontrada."
        );
      } catch (err) {
        if (
          err instanceof SyntaxError
        ) {
          throw new Error(
            texto ||
              "Imagem não encontrada."
          );
        }

        throw err;
      }
    }

    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob(
            [response.data],
            {
              type: contentType,
            }
          );

    return URL.createObjectURL(
      blob
    );
  };

  /* =======================================================
     ABRIR GALERIA

     1. GET /funcionarios/:id/imagens
     2. recebe os IDs
     3. GET /funcionarios/:id/rostos/:fotoId
     4. converte cada BYTEA em Blob
  ======================================================= */

  const abrirGaleria = async (
    funcionario
  ) => {
    if (!funcionario?.id) {
      return;
    }

    const funcionarioId =
      funcionario.id;

    /*
     * Fechamos apenas visualmente o
     * modal anterior.
     */
    setAcoesModalOpen(false);

    setGaleriaFuncionario(
      funcionario
    );

    setGaleriaImagens([]);
    setGaleriaErro("");
    setGaleriaCarregando(true);

    limparUrlsGaleria();

    setGaleriaOpen(true);

    document.body.style.overflow =
      "hidden";

    try {
      /* ===============================================
         LISTAR FOTOS
      =============================================== */

      const { data } = await api.get(
        `/funcionarios/${funcionarioId}/imagens`
      );

      const imagens = Array.isArray(
        data?.imagens
      )
        ? data.imagens
        : [];

      setGaleriaImagens(
        imagens
      );

      if (
        imagens.length === 0
      ) {
        setGaleriaErro(
          "Nenhuma imagem facial cadastrada."
        );

        return;
      }

      /* ===============================================
         CARREGAR AS FOTOS
      =============================================== */

      const urls = {};

      for (const imagem of imagens) {
        try {
          const url =
            await carregarBlobImagem(
              funcionarioId,
              imagem.id
            );

          urls[imagem.id] =
            url;
        } catch (err) {
          console.error(
            `Erro ao carregar foto ${imagem.id}:`,
            err
          );

          urls[imagem.id] =
            null;
        }
      }

      setUrlsImagens(
        urls
      );
    } catch (err) {
      console.error(
        "Erro ao abrir galeria:",
        err
      );

      setGaleriaErro(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao carregar as imagens cadastradas."
      );
    } finally {
      setGaleriaCarregando(false);
    }
  };

  /* =======================================================
     FECHAR GALERIA
  ======================================================= */

  const fecharGaleria = () => {
    limparUrlsGaleria();

    setGaleriaOpen(false);
    setGaleriaFuncionario(null);
    setGaleriaImagens([]);
    setGaleriaErro("");
    setGaleriaCarregando(false);
    setImagemExcluindoId(null);

    document.body.style.overflow =
      "";
  };

  /* =======================================================
     AMPLIAR FOTO
  ======================================================= */

  const ampliarImagem = (
    url,
    funcionario,
    imagem
  ) => {
    if (!url) return;

    setImagemModalUrl(url);

    setImagemModalNome(
      `${funcionario?.nome || "Funcionário"} - Imagem ${imagem?.id || ""}`
    );

    setImagemModalOpen(true);
  };

  const fecharImagemAmpliada =
    () => {
      setImagemModalOpen(false);
      setImagemModalUrl("");
      setImagemModalNome("");
    };

  /* =======================================================
     EXCLUIR UMA FOTO
  ======================================================= */

  const excluirUmaImagem = async (
    imagem
  ) => {
    if (
      !galeriaFuncionario?.id ||
      !imagem?.id
    ) {
      return;
    }

    const confirmou =
      window.confirm(
        `Deseja realmente excluir somente esta imagem de ${galeriaFuncionario.nome}?`
      );

    if (!confirmou) {
      return;
    }

    setImagemExcluindoId(
      imagem.id
    );

    try {
      const funcionarioId =
        galeriaFuncionario.id;

      await api.delete(
        `/funcionarios/${funcionarioId}/rostos/${imagem.id}`
      );

      /*
       * Destruir Blob somente da foto
       * excluída.
       */
      const urlAntiga =
        urlsImagens[
          imagem.id
        ];

      if (
        urlAntiga &&
        urlAntiga.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          urlAntiga
        );
      }

      setUrlsImagens(
        (old) => {
          const novo = {
            ...old,
          };

          delete novo[
            imagem.id
          ];

          return novo;
        }
      );

      const restantes =
        galeriaImagens.filter(
          (item) =>
            Number(item.id) !==
            Number(imagem.id)
        );

      setGaleriaImagens(
        restantes
      );

      /*
       * Atualiza quantidade imediatamente.
       */
      setLista((old) =>
        old.map((f) => {
          if (
            Number(f.id) !==
            Number(funcionarioId)
          ) {
            return f;
          }

          const quantidade =
            Math.max(
              0,
              Number(
                f.quantidade_imagens_rosto ||
                  0
              ) - 1
            );

          return {
            ...f,

            quantidade_imagens_rosto:
              quantidade,

            possui_imagem_rosto:
              quantidade > 0,

            foto_banco:
              quantidade > 0,

            /*
             * Cada linha da tabela representa
             * uma foto + embedding.
             *
             * Se não sobrou foto, não há mais
             * cadastro facial.
             */
            rosto_cadastrado:
              quantidade > 0,
          };
        })
      );

      if (
        restantes.length === 0
      ) {
        setGaleriaErro(
          "Nenhuma imagem facial cadastrada."
        );
      }

      /*
       * Atualizar do banco.
       */
      await carregar();

      alert(
        "Imagem facial excluída com sucesso."
      );
    } catch (err) {
      console.error(
        "Erro ao excluir imagem:",
        err
      );

      alert(
        err.response?.data?.error ||
          "Erro ao excluir imagem facial."
      );
    } finally {
      setImagemExcluindoId(
        null
      );
    }
  };

  /* =======================================================
     EXCLUIR TODAS AS FOTOS
  ======================================================= */

  const excluirRosto = async (
    funcionarioId,
    nome
  ) => {
    const confirmou =
      window.confirm(
        `Deseja realmente excluir TODO o cadastro facial de ${nome}?\n\nTodas as imagens cadastradas serão removidas.`
      );

    if (!confirmou) {
      return;
    }

    try {
      await api.delete(
        `/funcionarios/${funcionarioId}/imagem`
      );

      setLista((old) =>
        old.map((f) =>
          Number(f.id) ===
          Number(funcionarioId)
            ? {
                ...f,

                rosto_cadastrado:
                  false,

                possui_imagem_rosto:
                  false,

                foto_banco:
                  false,

                quantidade_imagens_rosto:
                  0,

                foto_path:
                  null,
              }
            : f
        )
      );

      if (
        galeriaOpen
      ) {
        fecharGaleria();
      }

      if (
        acoesModalOpen
      ) {
        fecharModalAcoes();
      }

      await carregar();

      alert(
        "Cadastro facial excluído com sucesso."
      );
    } catch (err) {
      console.error(
        "Erro ao excluir cadastro facial:",
        err
      );

      alert(
        err.response?.data?.error ||
          "Erro ao excluir cadastro facial."
      );
    }
  };

  /* =======================================================
     ALTERAR STATUS
  ======================================================= */

  const alterarStatusFuncionario = async (
    funcionario,
    novoStatus
  ) => {
    const acao = novoStatus
      ? "reativar"
      : "inativar";

    const confirmou =
      window.confirm(
        `Deseja realmente ${acao} o funcionário ${funcionario.nome}?`
      );

    if (!confirmou) return;

    try {
      await api.patch(
        `/funcionarios/${funcionario.id}/status`,
        {
          ativo: novoStatus,
        }
      );

      fecharModalAcoes();

      await carregar();

      alert(
        novoStatus
          ? `${funcionario.nome} reativado com sucesso.`
          : `${funcionario.nome} inativado com sucesso.`
      );
    } catch (err) {
      console.error(
        `Erro ao ${acao} funcionário:`,
        err
      );

      alert(
        err.response?.data?.error ||
          `Erro ao ${acao} funcionário.`
      );
    }
  };

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="listPage">
      <h2>
        Funcionários cadastrados
      </h2>

      <div className="listActions listActionsTop">
        <button
          className="btnPrimary"
          onClick={async () => {
            await Promise.all([
              carregar(),
              carregarFuncoes(),
              carregarCnpjsEmpresa(),
            ]);
          }}
        >
          Atualizar
        </button>

        <div className="buscaBox">
          <input
            type="text"
            placeholder="Pesquisar por nome, CPF, função ou ID..."
            value={busca}
            onChange={(e) =>
              setBusca(
                e.target.value
              )
            }
            className="inputBusca"
          />
        </div>

        <span className="total">
          Total: {total}
        </span>
      </div>

      {msg && (
        <div className="listMsg">
          {msg}
        </div>
      )}

      {/* ===================================================
          ATIVOS
      =================================================== */}

      <div className="tableWrap">
        <table className="listTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>Função</th>
              <th>Chegada</th>
              <th>
                Intervalo início
              </th>
              <th>
                Intervalo fim
              </th>
              <th>Saída</th>
              <th>
                Empresa / CNPJ
              </th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {funcionariosAtivos.length >
            0 ? (
              funcionariosAtivos.map(
                (f) => {
                  const cnpjFuncionario =
                    buscarCnpjCadastrado(
                      f.cnpj_empresa
                    );

                  return (
                    <tr key={f.id}>
                      <td>
                        {f.numero_empresa ??
                          "—"}
                      </td>

                      <td>
                        {f.nome}
                      </td>

                      <td>
                        {formatCPF(
                          f.cpf
                        )}
                      </td>

                      <td>
                        {f.funcao_nome ||
                          f.funcao ||
                          "—"}
                      </td>

                      <td>
                        {f.chegada
                          ? f.chegada.slice(
                              0,
                              5
                            )
                          : "—"}
                      </td>

                      <td>
                        {f.intervalo_inicio
                          ? f.intervalo_inicio.slice(
                              0,
                              5
                            )
                          : "—"}
                      </td>

                      <td>
                        {f.intervalo_fim
                          ? f.intervalo_fim.slice(
                              0,
                              5
                            )
                          : "—"}
                      </td>

                      <td>
                        {f.saida
                          ? f.saida.slice(
                              0,
                              5
                            )
                          : "—"}
                      </td>

                      <td>
                        {cnpjFuncionario
                          ? `${nomeCnpj(
                              cnpjFuncionario
                            )} - ${formatCNPJ(
                              pegarNumeroCnpj(
                                cnpjFuncionario
                              )
                            )}`
                          : f.cnpj_empresa
                          ? formatCNPJ(
                              f.cnpj_empresa
                            )
                          : "—"}
                      </td>

                      <td className="acoesCell">
                        <button
                          className="btnAcoes"
                          onClick={() =>
                            abrirModalAcoes(
                              f
                            )
                          }
                          title="Abrir ações"
                        >
                          ⚙
                        </button>
                      </td>
                    </tr>
                  );
                }
              )
            ) : (
              <tr>
                <td
                  colSpan="10"
                  className="emptyRow"
                >
                  Nenhum funcionário encontrado para essa pesquisa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===================================================
          INATIVOS
      =================================================== */}

      {funcionariosInativos.length >
        0 && (
        <div className="inativosSection">
          <div className="inativosTituloBox">
            <h3>
              Funcionários inativados
            </h3>

            <span>
              {
                funcionariosInativos.length
              }
            </span>
          </div>

          <div className="tableWrap tableWrapInativos">
            <table className="listTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Função</th>
                  <th>
                    Inativado em
                  </th>
                  <th>Ação</th>
                </tr>
              </thead>

              <tbody>
                {funcionariosInativos.map(
                  (f) => (
                    <tr
                      key={f.id}
                      className="linhaInativa"
                    >
                      <td>
                        {f.numero_empresa ??
                          "—"}
                      </td>

                      <td>
                        {f.nome}
                      </td>

                      <td>
                        {formatCPF(
                          f.cpf
                        )}
                      </td>

                      <td>
                        {f.funcao_nome ||
                          f.funcao ||
                          "—"}
                      </td>

                      <td>
                        {f.inativado_em
                          ? new Date(
                              f.inativado_em
                            ).toLocaleString(
                              "pt-BR"
                            )
                          : "—"}
                      </td>

                      <td>
                        <button
                          className="btnReativar"
                          onClick={() =>
                            alterarStatusFuncionario(
                              f,
                              true
                            )
                          }
                        >
                          Reativar
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================
          MODAL AÇÕES
      =================================================== */}

      {acoesModalOpen &&
        funcionarioAcoes &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={
              fecharModalAcoes
            }
          >
            <div
              className="modal-card modal-acoes-card"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modal-acoes-topo">
                <h3>
                  Ações —{" "}
                  {
                    funcionarioAcoes.nome
                  }
                </h3>

                <button
                  className="modal-fechar-x"
                  onClick={
                    fecharModalAcoes
                  }
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  marginBottom:
                    "15px",
                }}
              >
                Funcionário nº{" "}

                <strong>
                  {funcionarioAcoes.numero_empresa ??
                    "—"}
                </strong>
              </div>

              <div className="acoesModalLista">
                {/* ALTERAR */}

                <button
                  className="btnSecondary"
                  onClick={() => {
                    const funcionario =
                      funcionarioAcoes;

                    fecharModalAcoes();

                    abrirModal(
                      funcionario
                    );
                  }}
                >
                  Alterar
                </button>

                {/* =========================================
                    CADASTRAR PRIMEIRA OU OUTRA IMAGEM
                ========================================= */}

                <button
                  onClick={() => {
                    const funcionario =
                      funcionarioAcoes;

                    fecharModalAcoes();

                    navigate(
                      `/app/cadastrar-rosto/${funcionario.id}`
                    );
                  }}
                  className={`acaoBtn ${
                    funcionarioAcoes.rosto_cadastrado
                      ? "acaoBtn-rosto-ok"
                      : "acaoBtn-rosto"
                  }`}
                >
                  {funcionarioAcoes.rosto_cadastrado
                    ? "Cadastrar Outra Imagem"
                    : "Cadastrar Rosto"}
                </button>

                {/* =========================================
                    VER TODAS AS IMAGENS
                ========================================= */}

                {funcionarioAcoes.rosto_cadastrado && (
                  <button
                    onClick={() =>
                      abrirGaleria(
                        funcionarioAcoes
                      )
                    }
                    className="acaoBtn acaoBtn-ver"
                  >
                    Ver Imagens
                    {Number(
                      funcionarioAcoes.quantidade_imagens_rosto ||
                        0
                    ) > 0
                      ? ` (${Number(
                          funcionarioAcoes.quantidade_imagens_rosto
                        )})`
                      : ""}
                  </button>
                )}

                {/* =========================================
                    EXCLUIR TUDO
                ========================================= */}

                {funcionarioAcoes.rosto_cadastrado && (
                  <button
                    onClick={() =>
                      excluirRosto(
                        funcionarioAcoes.id,
                        funcionarioAcoes.nome
                      )
                    }
                    className="acaoBtn acaoBtn-excluir"
                  >
                    Excluir Cadastro Facial
                  </button>
                )}

                {/* INATIVAR */}

                <button
                  className="acaoBtn acaoBtn-inativar"
                  onClick={() =>
                    alterarStatusFuncionario(
                      funcionarioAcoes,
                      false
                    )
                  }
                >
                  Inativar Funcionário
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================
          MODAL GALERIA
      =================================================== */}

      {galeriaOpen &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={
              fecharGaleria
            }
          >
            <div
              className="modal-card"
              onClick={(e) =>
                e.stopPropagation()
              }
              style={{
                width:
                  "min(1000px, 94vw)",

                maxHeight:
                  "90vh",

                overflowY:
                  "auto",
              }}
            >
              <div className="modal-imagem-topo">
                <div>
                  <h3
                    style={{
                      marginBottom:
                        "4px",
                    }}
                  >
                    Imagens cadastradas
                  </h3>

                  <div
                    style={{
                      opacity: 0.75,
                    }}
                  >
                    {galeriaFuncionario?.nome}
                  </div>
                </div>

                <button
                  className="modal-fechar-x"
                  onClick={
                    fecharGaleria
                  }
                >
                  ×
                </button>
              </div>

              {/* =========================================
                  TOTAL
              ========================================= */}

              {!galeriaCarregando &&
                galeriaImagens.length >
                  0 && (
                  <div
                    style={{
                      margin:
                        "15px 0",

                      fontWeight:
                        "600",
                    }}
                  >
                    {galeriaImagens.length}{" "}
                    {galeriaImagens.length ===
                    1
                      ? "imagem cadastrada"
                      : "imagens cadastradas"}
                  </div>
                )}

              {/* =========================================
                  CARREGANDO
              ========================================= */}

              {galeriaCarregando && (
                <div
                  style={{
                    padding:
                      "30px",

                    textAlign:
                      "center",
                  }}
                >
                  Carregando imagens...
                </div>
              )}

              {/* =========================================
                  ERRO
              ========================================= */}

              {!galeriaCarregando &&
                galeriaErro && (
                  <div className="modal-imagem-erro-box">
                    <p>
                      {galeriaErro}
                    </p>
                  </div>
                )}

              {/* =========================================
                  FOTOS
              ========================================= */}

              {!galeriaCarregando &&
                galeriaImagens.length >
                  0 && (
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",

                      gap:
                        "18px",

                      marginTop:
                        "18px",
                    }}
                  >
                    {galeriaImagens.map(
                      (imagem) => {
                        const url =
                          urlsImagens[
                            imagem.id
                          ];

                        return (
                          <div
                            key={
                              imagem.id
                            }
                            style={{
                              border:
                                "1px solid rgba(0,0,0,0.12)",

                              borderRadius:
                                "12px",

                              overflow:
                                "hidden",

                              background:
                                "#fff",
                            }}
                          >
                            {/* FOTO */}

                            <div
                              style={{
                                height:
                                  "220px",

                                display:
                                  "flex",

                                alignItems:
                                  "center",

                                justifyContent:
                                  "center",

                                background:
                                  "#f4f4f4",

                                cursor:
                                  url
                                    ? "pointer"
                                    : "default",
                              }}
                              onClick={() =>
                                ampliarImagem(
                                  url,
                                  galeriaFuncionario,
                                  imagem
                                )
                              }
                            >
                              {url ? (
                                <img
                                  src={
                                    url
                                  }
                                  alt={`Imagem facial ${imagem.id}`}
                                  style={{
                                    width:
                                      "100%",

                                    height:
                                      "100%",

                                    objectFit:
                                      "cover",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    padding:
                                      "20px",

                                    textAlign:
                                      "center",

                                    opacity:
                                      0.65,
                                  }}
                                >
                                  Não foi possível carregar esta imagem.
                                </div>
                              )}
                            </div>

                            {/* INFORMAÇÕES */}

                            <div
                              style={{
                                padding:
                                  "12px",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight:
                                    "600",

                                  marginBottom:
                                    "5px",
                                }}
                              >
                                Imagem #
                                {
                                  imagem.id
                                }
                              </div>

                              {imagem.created_at && (
                                <div
                                  style={{
                                    fontSize:
                                      "12px",

                                    opacity:
                                      0.65,

                                    marginBottom:
                                      "10px",
                                  }}
                                >
                                  {formatarDataHora(
                                    imagem.created_at
                                  )}
                                </div>
                              )}

                              {imagem.tamanho_bytes && (
                                <div
                                  style={{
                                    fontSize:
                                      "12px",

                                    opacity:
                                      0.65,

                                    marginBottom:
                                      "10px",
                                  }}
                                >
                                  {Math.round(
                                    Number(
                                      imagem.tamanho_bytes
                                    ) /
                                      1024
                                  )}{" "}
                                  KB
                                </div>
                              )}

                              <button
                                className="acaoBtn acaoBtn-excluir"
                                style={{
                                  width:
                                    "100%",
                                }}
                                disabled={
                                  imagemExcluindoId ===
                                  imagem.id
                                }
                                onClick={() =>
                                  excluirUmaImagem(
                                    imagem
                                  )
                                }
                              >
                                {imagemExcluindoId ===
                                imagem.id
                                  ? "Excluindo..."
                                  : "Excluir Imagem"}
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}

              <div
                className="modal-actions"
                style={{
                  marginTop:
                    "20px",
                }}
              >
                {/* =======================================
                    CADASTRAR MAIS UMA FOTO
                ======================================= */}

                <button
                  className="modal-btn-primary"
                  onClick={() => {
                    const funcionario =
                      galeriaFuncionario;

                    fecharGaleria();

                    if (
                      funcionario?.id
                    ) {
                      navigate(
                        `/app/cadastrar-rosto/${funcionario.id}`
                      );
                    }
                  }}
                >
                  Cadastrar Outra Imagem
                </button>

                <button
                  className="modal-btn-light"
                  onClick={
                    fecharGaleria
                  }
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================
          IMAGEM AMPLIADA
      =================================================== */}

      {imagemModalOpen &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={
              fecharImagemAmpliada
            }
            style={{
              zIndex: 99999,
            }}
          >
            <div
              className="modal-card modal-imagem-card"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modal-imagem-topo">
                <h3>
                  {imagemModalNome}
                </h3>

                <button
                  className="modal-fechar-x"
                  onClick={
                    fecharImagemAmpliada
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-imagem-wrap">
                <img
                  src={
                    imagemModalUrl
                  }
                  alt={
                    imagemModalNome
                  }
                  className="modal-imagem-preview"
                />
              </div>

              <div className="modal-actions">
                <button
                  className="modal-btn-primary"
                  onClick={
                    fecharImagemAmpliada
                  }
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================
          MODAL EDITAR
      =================================================== */}

      {open &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={
              fecharModal
            }
          >
            <div
              className="modal-card"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <h3>
                Alterar Funcionário

                {editing?.numero_empresa
                  ? ` (ID ${editing.numero_empresa})`
                  : ""}
              </h3>

              <div className="modal-grid">
                <div>
                  <label>
                    Nome
                  </label>

                  <input
                    name="nome"
                    value={
                      form.nome
                    }
                    onChange={
                      onChange
                    }
                  />
                </div>

                <div>
                  <label>
                    CPF
                  </label>

                  <input
                    name="cpf"
                    value={
                      form.cpf
                    }
                    onChange={
                      onChange
                    }
                    maxLength={
                      14
                    }
                  />
                </div>

                <div>
                  <label>
                    Função
                  </label>

                  <select
                    name="funcao_id"
                    value={
                      form.funcao_id
                    }
                    onChange={
                      onChange
                    }
                  >
                    <option value="">
                      Selecione
                    </option>

                    {funcoes.map(
                      (f) => (
                        <option
                          key={f.id}
                          value={f.id}
                        >
                          {f.nome}
                        </option>
                      )
                    )}

                    <option value="outro">
                      Outra função
                    </option>
                  </select>
                </div>

                {form.funcao_id ===
                  "outro" && (
                  <div>
                    <label>
                      Nova função
                    </label>

                    <input
                      name="funcao_nome"
                      value={
                        form.funcao_nome
                      }
                      onChange={
                        onChange
                      }
                    />
                  </div>
                )}

                <div>
                  <label>
                    Chegada
                  </label>

                  <input
                    type="time"
                    name="chegada"
                    value={
                      form.chegada
                    }
                    onChange={
                      onChange
                    }
                  />
                </div>

                <div>
                  <label>
                    Início intervalo
                  </label>

                  <input
                    type="time"
                    name="intervalo_inicio"
                    value={
                      form.intervalo_inicio
                    }
                    onChange={
                      onChange
                    }
                  />
                </div>

                <div>
                  <label>
                    Fim intervalo
                  </label>

                  <input
                    type="time"
                    name="intervalo_fim"
                    value={
                      form.intervalo_fim
                    }
                    onChange={
                      onChange
                    }
                  />
                </div>

                <div>
                  <label>
                    Saída
                  </label>

                  <input
                    type="time"
                    name="saida"
                    value={
                      form.saida
                    }
                    onChange={
                      onChange
                    }
                  />
                </div>

                {/* CNPJ */}

                <div className="cnpjEmpresaBox">
                  <label className="cnpjTitulo">
                    Empresa / CNPJ
                  </label>

                  {carregandoCnpjs ? (
                    <div className="cnpjSemCadastro">
                      Carregando CNPJs...
                    </div>
                  ) : cnpjsEmpresa.length >
                    0 ? (
                    cnpjsEmpresa.map(
                      (item) => {
                        const numero =
                          pegarNumeroCnpj(
                            item
                          );

                        const principal =
                          item.principal ===
                            true ||
                          item.principal ===
                            1 ||
                          item.principal ===
                            "true";

                        return (
                          <label
                            className="cnpjOpcao"
                            key={
                              item.id ||
                              numero
                            }
                          >
                            <input
                              type="radio"
                              name="cnpj_empresa"
                              value={
                                numero
                              }
                              checked={
                                onlyDigits(
                                  form.cnpj_empresa
                                ) ===
                                numero
                              }
                              onChange={
                                onChange
                              }
                            />

                            <span>
                              <strong>
                                {nomeCnpj(
                                  item
                                )}

                                {principal && (
                                  <em
                                    style={{
                                      marginLeft:
                                        "8px",

                                      fontSize:
                                        "11px",

                                      fontStyle:
                                        "normal",

                                      opacity:
                                        0.7,
                                    }}
                                  >
                                    Principal
                                  </em>
                                )}
                              </strong>

                              <small>
                                {formatCNPJ(
                                  numero
                                )}
                              </small>
                            </span>
                          </label>
                        );
                      }
                    )
                  ) : (
                    <div className="cnpjSemCadastro">
                      {erroCnpjs ||
                        "Nenhum CNPJ cadastrado para esta empresa."}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="modal-btn-light"
                  onClick={
                    fecharModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancelar
                </button>

                <button
                  className="modal-btn-primary"
                  onClick={
                    salvarAlteracoes
                  }
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Salvando..."
                    : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}