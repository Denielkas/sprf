import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { api } from "../../services/api";
import "./BancoHoras.css";

export default function BancoHoras() {
  const anoAtual = new Date().getFullYear();
  const anoInicial = 2025;

  const anos = Array.from(
    {
      length:
        anoAtual - anoInicial + 1,
    },
    (_, i) =>
      String(anoAtual - i)
  );

  /* ========================================================
     ESTADOS
  ======================================================== */

  const [
    funcionarios,
    setFuncionarios,
  ] = useState([]);

  const [
    funcionarioId,
    setFuncionarioId,
  ] = useState("todos");

  const [mes, setMes] =
    useState("");

  const [ano, setAno] =
    useState(String(anoAtual));

  const [dados, setDados] =
    useState([]);

  const [editando, setEditando] =
    useState({});

  const [carregando, setCarregando] =
    useState(false);

  const [salvandoId, setSalvandoId] =
    useState(null);

  const [gerandoPdf, setGerandoPdf] =
    useState(false);

  /* ========================================================
     MODAL
  ======================================================== */

  const [modalOpen, setModalOpen] =
    useState(false);

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

  /* ========================================================
     ABRIR MODAL
  ======================================================== */

  const abrirModal = (
    titulo,
    texto,
    erro = false
  ) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);
    }, 1800);
  };

  /* ========================================================
     CARREGAR FUNCIONÁRIOS

     IMPORTANTE:
     Não enviamos empresa_id.

     O backend deve identificar automaticamente
     a empresa através de req.user.empresa_id.
  ======================================================== */

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  async function carregarFuncionarios() {
    try {
      const response =
        await api.get(
          "/funcionarios"
        );

      const lista =
        Array.isArray(response.data)
          ? response.data
          : [];

      setFuncionarios(lista);
    } catch (err) {
      console.error(
        "Erro ao buscar funcionários:",
        err
      );

      setFuncionarios([]);

      abrirModal(
        "Erro",
        err?.response?.data?.error ||
          "Erro ao carregar funcionários.",
        true
      );
    }
  }

  /* ========================================================
     BUSCAR BANCO DE HORAS

     A EMPRESA NÃO É ENVIADA PELO FRONT.

     Backend:
     req.user.empresa_id
  ======================================================== */

  async function buscar() {
    if (!mes || !ano) {
      abrirModal(
        "Atenção",
        "Selecione mês e ano.",
        true
      );

      return;
    }

    setCarregando(true);

    try {
      const response =
        await api.get(
          "/banco-horas",
          {
            params: {
              mes: Number(mes),

              ano: Number(ano),

              funcionario_id:
                funcionarioId,
            },
          }
        );

      const lista =
        Array.isArray(response.data)
          ? response.data
          : [];

      setDados(lista);

      /* ====================================================
         PREPARAR CAMPOS DE EDIÇÃO
      ==================================================== */

      const inicial = {};

      lista.forEach((item) => {
        inicial[
          item.funcionario_id
        ] = {
          ajuste_minutos:
            item.ajuste_minutos ?? 0,

          observacao:
            item.observacao ?? "",
        };
      });

      setEditando(inicial);

      if (lista.length === 0) {
        abrirModal(
          "Atenção",
          "Nenhum registro encontrado para o período selecionado.",
          true
        );
      }
    } catch (err) {
      console.error(
        "Erro ao buscar banco de horas:",
        err
      );

      setDados([]);
      setEditando({});

      abrirModal(
        "Erro",
        err?.response?.data?.error ||
          "Erro ao buscar banco de horas.",
        true
      );
    } finally {
      setCarregando(false);
    }
  }

  /* ========================================================
     SALVAR AJUSTE

     Também NÃO enviamos empresa_id.

     O backend identifica pela empresa do usuário logado.
  ======================================================== */

  async function salvar(
    funcionario_id
  ) {
    if (!mes || !ano) {
      abrirModal(
        "Atenção",
        "Selecione mês e ano.",
        true
      );

      return;
    }

    const item =
      editando[
        funcionario_id
      ] || {};

    setSalvandoId(
      funcionario_id
    );

    try {
      await api.post(
        "/banco-horas/ajuste",
        {
          funcionario_id:
            Number(funcionario_id),

          mes:
            Number(mes),

          ano:
            Number(ano),

          ajuste_minutos:
            Number(
              item.ajuste_minutos
            ) || 0,

          observacao:
            String(
              item.observacao || ""
            ).trim(),
        }
      );

      abrirModal(
        "Registrado com sucesso!",
        "Ajuste salvo com sucesso."
      );

      await buscar();
    } catch (err) {
      console.error(
        "Erro ao salvar ajuste:",
        err
      );

      abrirModal(
        "Erro",
        err?.response?.data?.error ||
          "Erro ao salvar ajuste.",
        true
      );
    } finally {
      setSalvandoId(null);
    }
  }

  /* ========================================================
     GERAR PDF

     NÃO envia empresa_id.

     O backend utiliza:
     req.user.empresa_id
  ======================================================== */

  async function gerarPdf() {
    if (!mes || !ano) {
      abrirModal(
        "Atenção",
        "Selecione mês e ano.",
        true
      );

      return;
    }

    setGerandoPdf(true);

    try {
      const response =
        await api.get(
          "/banco-horas/pdf",
          {
            params: {
              mes:
                Number(mes),

              ano:
                Number(ano),

              funcionario_id:
                funcionarioId,
            },

            responseType:
              "blob",
          }
        );

      /* ====================================================
         VERIFICAR CONTENT-TYPE
      ==================================================== */

      const contentType =
        response.headers[
          "content-type"
        ] || "";

      if (
        !contentType.includes(
          "application/pdf"
        )
      ) {
        let mensagem =
          "A API não retornou um PDF válido.";

        try {
          const texto =
            await response.data.text();

          const json =
            JSON.parse(texto);

          mensagem =
            json?.error ||
            mensagem;
        } catch {
          // mantém mensagem padrão
        }

        abrirModal(
          "Erro",
          mensagem,
          true
        );

        return;
      }

      /* ====================================================
         CRIAR BLOB
      ==================================================== */

      const blob =
        new Blob(
          [response.data],
          {
            type:
              "application/pdf",
          }
        );

      const url =
        window.URL
          .createObjectURL(blob);

      /* ====================================================
         ABRIR PDF
      ==================================================== */

      const novaJanela =
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );

      if (!novaJanela) {
        abrirModal(
          "Atenção",
          "O navegador bloqueou a abertura do PDF. Permita pop-ups para este site.",
          true
        );
      }

      /* ====================================================
         LIBERAR URL
      ==================================================== */

      setTimeout(() => {
        window.URL
          .revokeObjectURL(url);
      }, 60000);

    } catch (err) {
      console.error(
        "Erro ao gerar PDF do banco de horas:",
        err
      );

      /* ====================================================
         QUANDO responseType = blob,
         o erro da API também pode chegar como Blob.
      ==================================================== */

      let mensagem =
        "Erro ao gerar PDF do banco de horas.";

      try {
        const erroData =
          err?.response?.data;

        if (
          erroData instanceof Blob
        ) {
          const texto =
            await erroData.text();

          const json =
            JSON.parse(texto);

          mensagem =
            json?.error ||
            mensagem;
        } else {
          mensagem =
            err?.response?.data
              ?.error ||
            mensagem;
        }
      } catch {
        mensagem =
          "Erro ao gerar PDF do banco de horas.";
      }

      abrirModal(
        "Erro",
        mensagem,
        true
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  /* ========================================================
     ALTERAR CAMPOS
  ======================================================== */

  function alterarCampo(
    funcionario_id,
    campo,
    valor
  ) {
    setEditando(
      (prev) => ({
        ...prev,

        [funcionario_id]: {
          ...prev[
            funcionario_id
          ],

          [campo]:
            valor,
        },
      })
    );
  }

  /* ========================================================
     JSX
  ======================================================== */

  return (
    <div className="bhoras-container">

      {/* ====================================================
          TÍTULO
      ==================================================== */}

      <h2 className="bhoras-title">
        Banco de Horas
      </h2>

      {/* ====================================================
          FILTROS
      ==================================================== */}

      <div className="bhoras-filtros">

        {/* FUNCIONÁRIO */}

        <select
          className="bhoras-select"
          value={funcionarioId}
          onChange={(e) =>
            setFuncionarioId(
              e.target.value
            )
          }
        >
          <option value="todos">
            Todos os Funcionários
          </option>

          {funcionarios.map(
            (f) => (
              <option
                key={f.id}
                value={f.id}
              >
                {f.nome}
              </option>
            )
          )}
        </select>

        {/* MÊS */}

        <select
          className="bhoras-select"
          value={mes}
          onChange={(e) =>
            setMes(
              e.target.value
            )
          }
        >
          <option value="">
            Mês
          </option>

          <option value="1">
            Janeiro
          </option>

          <option value="2">
            Fevereiro
          </option>

          <option value="3">
            Março
          </option>

          <option value="4">
            Abril
          </option>

          <option value="5">
            Maio
          </option>

          <option value="6">
            Junho
          </option>

          <option value="7">
            Julho
          </option>

          <option value="8">
            Agosto
          </option>

          <option value="9">
            Setembro
          </option>

          <option value="10">
            Outubro
          </option>

          <option value="11">
            Novembro
          </option>

          <option value="12">
            Dezembro
          </option>
        </select>

        {/* ANO */}

        <select
          className="bhoras-select"
          value={ano}
          onChange={(e) =>
            setAno(
              e.target.value
            )
          }
        >
          {anos.map(
            (anoItem) => (
              <option
                key={anoItem}
                value={anoItem}
              >
                {anoItem}
              </option>
            )
          )}
        </select>

        {/* BUSCAR */}

        <button
          type="button"
          className="bhoras-btn"
          onClick={buscar}
          disabled={carregando}
        >
          {carregando
            ? "Buscando..."
            : "Buscar"}
        </button>

        {/* PDF */}

        <button
          type="button"
          className="bhoras-btn"
          onClick={gerarPdf}
          disabled={gerandoPdf}
        >
          {gerandoPdf
            ? "Gerando PDF..."
            : "Gerar PDF"}
        </button>

      </div>

      {/* ====================================================
          TABELA
      ==================================================== */}

      <div className="bhoras-table-wrapper">

        <table className="bhoras-table">

          <thead>
            <tr>
              <th>
                Funcionário
              </th>

              <th>
                Horas
              </th>

              <th>
                Ajuste (min)
              </th>

              <th>
                Observação
              </th>

              <th>
                Saldo
              </th>

              <th>
                Ação
              </th>
            </tr>
          </thead>

          <tbody>

            {dados.length > 0 ? (

              dados.map(
                (d) => (

                  <tr
                    key={
                      d.funcionario_id
                    }
                  >

                    {/* FUNCIONÁRIO */}

                    <td>
                      {d.nome}
                    </td>

                    {/* HORAS DO SISTEMA */}

                    <td>
                      {
                        d.saldo_sistema_formatado
                      }
                    </td>

                    {/* AJUSTE */}

                    <td>
                      <input
                        className="bhoras-input"
                        type="number"
                        value={
                          editando[
                            d
                              .funcionario_id
                          ]
                            ?.ajuste_minutos ??
                          0
                        }
                        onChange={(
                          e
                        ) =>
                          alterarCampo(
                            d.funcionario_id,
                            "ajuste_minutos",
                            e.target
                              .value
                          )
                        }
                      />
                    </td>

                    {/* OBSERVAÇÃO */}

                    <td>
                      <input
                        className="bhoras-input"
                        type="text"
                        value={
                          editando[
                            d
                              .funcionario_id
                          ]
                            ?.observacao ??
                          ""
                        }
                        onChange={(
                          e
                        ) =>
                          alterarCampo(
                            d.funcionario_id,
                            "observacao",
                            e.target
                              .value
                          )
                        }
                        placeholder="Ex: pago / desconto / ajuste"
                      />
                    </td>

                    {/* SALDO FINAL */}

                    <td
                      className={
                        Number(
                          d.saldo_final_minutos
                        ) < 0
                          ? "bhoras-saldo-negativo"
                          : "bhoras-saldo-positivo"
                      }
                    >
                      {
                        d.saldo_final_formatado
                      }
                    </td>

                    {/* SALVAR */}

                    <td>
                      <button
                        type="button"
                        className="bhoras-btn bhoras-btn-salvar"
                        disabled={
                          salvandoId ===
                          d.funcionario_id
                        }
                        onClick={() =>
                          salvar(
                            d.funcionario_id
                          )
                        }
                      >
                        {salvandoId ===
                        d.funcionario_id
                          ? "Salvando..."
                          : "Salvar"}
                      </button>
                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>
                <td
                  colSpan="6"
                  className="bhoras-sem-dados"
                >
                  {carregando
                    ? "Carregando..."
                    : "Nenhum registro encontrado."}
                </td>
              </tr>

            )}

          </tbody>

        </table>

      </div>

      {/* ====================================================
          MODAL
      ==================================================== */}

      {modalOpen && (

        <div className="modal-ponto">

          <div
            className={`modal-box ${
              modalErro
                ? "modal-box-erro"
                : ""
            }`}
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