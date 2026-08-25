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
import { apiFace } from "../../services/apiFace";

import "./vincularCPF.css";

/* =========================================================
   UTILITÁRIOS
========================================================= */

const onlyDigits = (v = "") =>
  String(v).replace(/\D+/g, "");

const formatCPF = (v = "") => {
  const s = onlyDigits(v).slice(0, 11);

  if (s.length <= 3) {
    return s;
  }

  if (s.length <= 6) {
    return `${s.slice(0, 3)}.${s.slice(3, 6)}`;
  }

  if (s.length <= 9) {
    return `${s.slice(0, 3)}.${s.slice(
      3,
      6
    )}.${s.slice(6, 9)}`;
  }

  return `${s.slice(0, 3)}.${s.slice(
    3,
    6
  )}.${s.slice(6, 9)}-${s.slice(
    9,
    11
  )}`;
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function VincularCPF() {
  const navigate = useNavigate();

  const { state } = useLocation();

  /* =======================================================
     USUÁRIO / EMPRESA LOGADA
  ======================================================= */

  const usuario = useMemo(() => {
    try {
      const salvo =
        localStorage.getItem("usuario");

      if (!salvo) {
        return null;
      }

      return JSON.parse(salvo);
    } catch (error) {
      console.error(
        "Erro ao carregar usuário:",
        error
      );

      return null;
    }
  }, []);

  const empresaId =
    usuario?.empresa_id || null;

  const empresaNome =
    usuario?.empresa_nome ||
    "Empresa";

  const isPonto =
    usuario?.role ===
    "ponto_empresa";

  /* =======================================================
     IMAGEM CAPTURADA
  ======================================================= */

  const capturedImage =
    state?.image ||
    state?.photo ||
    "";

  /* =======================================================
     CPF
  ======================================================= */

  const [
    cpfInput,
    setCpfInput,
  ] = useState("");

  const cpfDigits = useMemo(
    () =>
      onlyDigits(
        cpfInput
      ).slice(0, 11),
    [cpfInput]
  );

  /* =======================================================
     FUNCIONÁRIO
  ======================================================= */

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    funcionarioId,
    setFuncionarioId,
  ] = useState(null);

  /* =======================================================
     MODAL / LOADING
  ======================================================= */

  const [
    showConfirm,
    setShowConfirm,
  ] = useState(false);

  const [
    loadingNome,
    setLoadingNome,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* =======================================================
     PROTEÇÃO DA TELA
  ======================================================= */

  useEffect(() => {
    /*
      Precisa existir usuário logado.
    */

    if (!usuario) {
      navigate("/", {
        replace: true,
      });

      return;
    }

    /*
      Esta tela pertence ao terminal
      de ponto da empresa.
    */

    if (!isPonto) {
      if (
        usuario.role ===
        "rh_empresa"
      ) {
        navigate("/app", {
          replace: true,
        });

        return;
      }

      if (
        usuario.role ===
        "super_admin"
      ) {
        navigate(
          "/app/empresas",
          {
            replace: true,
          }
        );

        return;
      }

      navigate("/", {
        replace: true,
      });

      return;
    }

    /*
      Usuário de ponto obrigatoriamente
      precisa estar ligado a uma empresa.
    */

    if (!empresaId) {
      console.error(
        "Login de ponto sem empresa_id."
      );

      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "usuario"
      );

      navigate("/", {
        replace: true,
      });

      return;
    }

    /*
      Precisa ter vindo uma foto da
      tela de reconhecimento.
    */

    if (!capturedImage) {
      alert(
        "Nenhuma imagem capturada. Voltando..."
      );

      navigate(
        "/reconhecimento",
        {
          replace: true,
        }
      );
    }
  }, [
    usuario,
    isPonto,
    empresaId,
    capturedImage,
    navigate,
  ]);

  /* =======================================================
     ALTERAR CPF
  ======================================================= */

  const onChangeCpf = (
    e
  ) => {
    setCpfInput(
      e.target.value
    );

    /*
      Se alterar o CPF depois de
      pesquisar, limpamos os dados
      anteriores.
    */

    setNome("");

    setFuncionarioId(
      null
    );

    setShowConfirm(
      false
    );
  };

  /* =======================================================
     BLOQUEAR LETRAS NO CPF
  ======================================================= */

  const onKeyDownCpf = (
    e
  ) => {
    const allow =
      [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
        "Home",
        "End",
      ].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey;

    if (allow) {
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  /* =======================================================
     BUSCAR FUNCIONÁRIO PELO CPF

     MULTIEMPRESA:

     O backend deve descobrir a empresa
     pelo JWT:

     req.user.empresa_id

     NÃO devemos permitir que o navegador
     escolha livremente outra empresa.
  ======================================================= */

  const buscarNome =
    async () => {
      if (
        cpfDigits.length !==
        11
      ) {
        alert(
          "CPF deve ter 11 dígitos."
        );

        return;
      }

      if (!empresaId) {
        alert(
          "Empresa não identificada."
        );

        return;
      }

      try {
        setLoadingNome(
          true
        );

        setNome("");

        setFuncionarioId(
          null
        );

        /*
          IMPORTANTE:

          Como essa tela está autenticada,
          usamos a rota privada de funcionário.

          O backend deverá filtrar usando:
          req.user.empresa_id
        */

        const { data } =
          await api.get(
            `/funcionarios/by-cpf/${cpfDigits}`
          );

        const funcionario =
          data?.funcionario ||
          data;

        if (
          !funcionario ||
          !funcionario.nome
        ) {
          alert(
            "Funcionário não encontrado nesta empresa."
          );

          return;
        }

        setNome(
          funcionario.nome
        );

        setFuncionarioId(
          funcionario.id ||
            funcionario
              .funcionario_id ||
            null
        );

        setShowConfirm(
          true
        );
      } catch (err) {
        console.error(
          "Erro ao buscar CPF:",
          err
        );

        alert(
          err.response?.data
            ?.error ||
            "Funcionário não encontrado nesta empresa."
        );
      } finally {
        setLoadingNome(
          false
        );
      }
    };

  /* =======================================================
     CONFIRMAR VÍNCULO FACIAL
  ======================================================= */

  const confirmar =
    async () => {
      if (
        !capturedImage
      ) {
        alert(
          "Foto inválida."
        );

        return;
      }

      if (
        cpfDigits.length !==
        11
      ) {
        alert(
          "CPF inválido."
        );

        return;
      }

      if (!empresaId) {
        alert(
          "Empresa não identificada."
        );

        return;
      }

      if (!nome) {
        alert(
          "Funcionário não identificado."
        );

        return;
      }

      setSaving(true);

      try {
        /* =================================================
           PAYLOAD MULTIEMPRESA

           Aqui enviamos empresa_id também para o
           serviço facial.

           Isso é necessário para evitar que:

           CPF 123 da empresa A

           seja confundido com:

           CPF 123 da empresa B.

           O backend/Face API ainda deverá validar
           corretamente essa empresa.
        ================================================= */

        const payload = {
          cpf:
            cpfDigits,

          funcionario_id:
            funcionarioId,

          empresa_id:
            empresaId,

          image_base64:
            capturedImage,

          save_image:
            true,
        };

        const { data } =
          await apiFace.post(
            "/enroll",
            payload
          );

        if (!data?.ok) {
          throw new Error(
            data?.error ||
              "Erro ao vincular rosto."
          );
        }

        alert(
          `Rosto vinculado com sucesso!\n\n${nome}\n${formatCPF(
            cpfDigits
          )}\n${empresaNome}`
        );

        /*
          IMPORTANTE:

          "/" agora é o acesso inicial.

          O terminal deve voltar para
          a tela de ponto da empresa.
        */

        navigate(
          "/ponto",
          {
            replace: true,
          }
        );
      } catch (err) {
        console.error(
          "Erro ao vincular rosto:",
          err
        );

        alert(
          err.response?.data
            ?.error ||
            err.response?.data
              ?.detail ||
            err.message ||
            "Falha ao vincular rosto."
        );
      } finally {
        setSaving(
          false
        );

        setShowConfirm(
          false
        );
      }
    };

  /* =======================================================
     CANCELAR
  ======================================================= */

  const voltar = () => {
    navigate(
      "/reconhecimento"
    );
  };

  /* =======================================================
     NÃO RENDERIZAR ENQUANTO REDIRECIONA
  ======================================================= */

  if (
    !usuario ||
    !isPonto ||
    !empresaId
  ) {
    return null;
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="vincScreen">

      <div className="vincCard">

        <h2>
          Vincular rosto ao CPF
        </h2>

        {/* EMPRESA */}

        <div
          style={{
            textAlign:
              "center",

            marginBottom:
              "12px",

            color:
              "#666",

            fontSize:
              "14px",

            fontWeight:
              "600",
          }}
        >
          {empresaNome}
        </div>

        {/* FOTO */}

        <div className="preview">
          {capturedImage ? (
            <img
              src={
                capturedImage
              }
              alt="Captura do rosto"
            />
          ) : (
            <div className="empty">
              Sem imagem
            </div>
          )}
        </div>

        {/* CPF */}

        <div className="form">

          <label>
            CPF
          </label>

          <input
            value={formatCPF(
              cpfInput
            )}
            onChange={
              onChangeCpf
            }
            onKeyDown={
              onKeyDownCpf
            }
            maxLength={14}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            disabled={
              loadingNome ||
              saving
            }
          />

          <button
            type="button"
            onClick={
              buscarNome
            }
            disabled={
              cpfDigits.length !==
                11 ||
              loadingNome ||
              saving
            }
          >
            {loadingNome
              ? "Buscando..."
              : "Buscar nome"}
          </button>
        </div>

        {/* VOLTAR */}

        <button
          type="button"
          className="cancel"
          onClick={voltar}
          disabled={saving}
        >
          Voltar
        </button>
      </div>

      {/* ===================================================
          MODAL DE CONFIRMAÇÃO
      =================================================== */}

      {showConfirm && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!saving) {
              setShowConfirm(
                false
              );
            }
          }}
        >
          <div
            className="modalCard"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h3>
              Confirmar dados
            </h3>

            <p>
              Empresa:{" "}
              <strong>
                {empresaNome}
              </strong>
            </p>

            <p>
              Nome encontrado:{" "}
              <strong>
                {nome || "—"}
              </strong>
            </p>

            <p>
              CPF:{" "}
              <strong>
                {formatCPF(
                  cpfDigits
                )}
              </strong>
            </p>

            <div className="modalActions">

              <button
                type="button"
                onClick={() =>
                  setShowConfirm(
                    false
                  )
                }
                disabled={
                  saving
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  confirmar
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? "Salvando..."
                  : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}