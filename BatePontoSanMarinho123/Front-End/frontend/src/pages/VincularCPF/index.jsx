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
    return `${cpf.slice(0, 3)}.${cpf.slice(
      3,
      6
    )}.${cpf.slice(6, 9)}`;
  }

  return `${cpf.slice(0, 3)}.${cpf.slice(
    3,
    6
  )}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function VincularCPF() {
  const navigate = useNavigate();
  const { state } = useLocation();

  /* =======================================================
     USUÁRIO LOGADO
  ======================================================= */

  const usuario = useMemo(() => {
    try {
      const salvo = localStorage.getItem("usuario");

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

  /* =======================================================
     EMPRESA
  ======================================================= */

  const empresaId =
    usuario?.empresa_id || null;

  const empresaNome =
    usuario?.empresa_nome ||
    usuario?.empresa?.nome ||
    "Empresa";

  const isPonto =
    usuario?.role === "ponto_empresa";

  /* =======================================================
     IMAGEM CAPTURADA
  ======================================================= */

  const capturedImage =
    state?.image ||
    state?.photo ||
    state?.image_base64 ||
    "";

  /* =======================================================
     CPF
  ======================================================= */

  const [cpfInput, setCpfInput] =
    useState("");

  const cpfDigits = useMemo(() => {
    return onlyDigits(cpfInput).slice(0, 11);
  }, [cpfInput]);

  /* =======================================================
     FUNCIONÁRIO
  ======================================================= */

  const [nome, setNome] =
    useState("");

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
    /* -----------------------------------------------------
       PRECISA ESTAR LOGADO
    ----------------------------------------------------- */

    if (!usuario) {
      navigate("/", {
        replace: true,
      });

      return;
    }

    /* -----------------------------------------------------
       SOMENTE TERMINAL DE PONTO
    ----------------------------------------------------- */

    if (!isPonto) {
      if (usuario.role === "rh_empresa") {
        navigate("/app", {
          replace: true,
        });

        return;
      }

      if (usuario.role === "super_admin") {
        navigate("/app/empresas", {
          replace: true,
        });

        return;
      }

      navigate("/", {
        replace: true,
      });

      return;
    }

    /* -----------------------------------------------------
       PRECISA POSSUIR EMPRESA
    ----------------------------------------------------- */

    if (!empresaId) {
      console.error(
        "Login de ponto sem empresa_id."
      );

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");

      navigate("/", {
        replace: true,
      });

      return;
    }

    /* -----------------------------------------------------
       PRECISA POSSUIR FOTO
    ----------------------------------------------------- */

    if (!capturedImage) {
      alert(
        "Nenhuma imagem capturada. Voltando para o reconhecimento."
      );

      navigate("/reconhecimento", {
        replace: true,
      });
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

  const onChangeCpf = (e) => {
    const valor = e.target.value;

    setCpfInput(valor);

    /*
      Ao alterar o CPF, qualquer funcionário
      pesquisado anteriormente deixa de valer.
    */

    setNome("");
    setFuncionarioId(null);
    setShowConfirm(false);
  };

  /* =======================================================
     BLOQUEAR LETRAS
  ======================================================= */

  const onKeyDownCpf = (e) => {
    const teclasPermitidas = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
      "Enter",
    ];

    if (
      teclasPermitidas.includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  /* =======================================================
     BUSCAR FUNCIONÁRIO PELO CPF
  ======================================================= */

  const buscarNome = async () => {
    if (cpfDigits.length !== 11) {
      alert(
        "Digite um CPF com 11 dígitos."
      );

      return;
    }

    if (!empresaId) {
      alert(
        "Empresa não identificada. Faça login novamente."
      );

      return;
    }

    try {
      setLoadingNome(true);

      setNome("");
      setFuncionarioId(null);
      setShowConfirm(false);

      /*
        IMPORTANTE:

        Essa rota deve utilizar o JWT do usuário.

        No backend, o funcionário deve ser procurado
        utilizando:

        CPF + empresa do usuário logado.

        Portanto, o mesmo CPF pode existir em empresas
        diferentes.
      */

      const { data } = await api.get(
        `/funcionarios/by-cpf/${cpfDigits}`
      );

      const funcionario =
        data?.funcionario || data;

      if (!funcionario) {
        alert(
          "Funcionário não encontrado nesta empresa."
        );

        return;
      }

      if (!funcionario.nome) {
        alert(
          "Funcionário encontrado, mas o nome não foi retornado."
        );

        return;
      }

      const id =
        funcionario.id ??
        funcionario.funcionario_id ??
        null;

      if (!id) {
        console.error(
          "Funcionário retornado sem ID:",
          funcionario
        );

        alert(
          "Funcionário encontrado, mas o ID não foi retornado."
        );

        return;
      }

      setNome(funcionario.nome);
      setFuncionarioId(Number(id));

      setShowConfirm(true);
    } catch (err) {
      console.error(
        "Erro ao buscar funcionário pelo CPF:",
        err
      );

      const mensagem =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Funcionário não encontrado nesta empresa.";

      alert(mensagem);
    } finally {
      setLoadingNome(false);
    }
  };

  /* =======================================================
     CONFIRMAR VÍNCULO FACIAL
  ======================================================= */

  const confirmar = async () => {
    if (saving) {
      return;
    }

    if (!capturedImage) {
      alert(
        "A imagem do rosto não foi encontrada."
      );

      return;
    }

    if (cpfDigits.length !== 11) {
      alert("CPF inválido.");

      return;
    }

    if (!empresaId) {
      alert(
        "Empresa não identificada."
      );

      return;
    }

    if (!funcionarioId) {
      alert(
        "Funcionário não identificado."
      );

      return;
    }

    if (!nome) {
      alert(
        "Nome do funcionário não identificado."
      );

      return;
    }

    try {
      setSaving(true);

      /* ===================================================
         CADASTRO FACIAL MULTIEMPRESA

         O serviço facial recebe:

         - funcionario_id
         - empresa_id
         - cpf
         - imagem

         Isso permite separar corretamente os rostos
         das diferentes empresas.
      =================================================== */

      const payload = {
        funcionario_id:
          Number(funcionarioId),

        empresa_id:
          Number(empresaId),

        cpf:
          cpfDigits,

        image_base64:
          capturedImage,

        save_image:
          true,
      };

      console.log(
        "Enviando cadastro facial:",
        {
          funcionario_id:
            payload.funcionario_id,

          empresa_id:
            payload.empresa_id,

          cpf:
            payload.cpf,
        }
      );

      const { data } = await apiFace.post(
        "/enroll",
        payload
      );

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "O serviço facial não conseguiu cadastrar o rosto."
        );
      }

      alert(
        `Rosto vinculado com sucesso!\n\n` +
          `Funcionário: ${nome}\n` +
          `CPF: ${formatCPF(cpfDigits)}\n` +
          `Empresa: ${empresaNome}`
      );

      navigate("/ponto", {
        replace: true,
      });
    } catch (err) {
      console.error(
        "Erro ao vincular rosto:",
        err
      );

      const mensagem =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Falha ao vincular rosto.";

      alert(mensagem);
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     CANCELAR MODAL
  ======================================================= */

  const cancelarConfirmacao = () => {
    if (saving) {
      return;
    }

    setShowConfirm(false);
  };

  /* =======================================================
     VOLTAR
  ======================================================= */

  const voltar = () => {
    if (saving) {
      return;
    }

    navigate("/reconhecimento");
  };

  /* =======================================================
     ENTER NO CPF
  ======================================================= */

  const onKeyUpCpf = (e) => {
    if (
      e.key === "Enter" &&
      cpfDigits.length === 11 &&
      !loadingNome &&
      !saving
    ) {
      buscarNome();
    }
  };

  /* =======================================================
     NÃO RENDERIZAR DURANTE REDIRECIONAMENTO
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
        {/* =================================================
            TÍTULO
        ================================================= */}

        <h2>
          Vincular rosto ao CPF
        </h2>

        {/* =================================================
            EMPRESA
        ================================================= */}

        <div className="vincEmpresa">
          {empresaNome}
        </div>

        {/* =================================================
            FOTO
        ================================================= */}

        <div className="preview">
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captura do rosto"
            />
          ) : (
            <div className="empty">
              Sem imagem
            </div>
          )}
        </div>

        {/* =================================================
            CPF
        ================================================= */}

        <div className="form">
          <label htmlFor="cpf">
            CPF
          </label>

          <input
            id="cpf"
            value={formatCPF(cpfInput)}
            onChange={onChangeCpf}
            onKeyDown={onKeyDownCpf}
            onKeyUp={onKeyUpCpf}
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
            onClick={buscarNome}
            disabled={
              cpfDigits.length !== 11 ||
              loadingNome ||
              saving
            }
          >
            {loadingNome
              ? "Buscando..."
              : "Buscar nome"}
          </button>
        </div>

        {/* =================================================
            VOLTAR
        ================================================= */}

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
          onClick={
            cancelarConfirmacao
          }
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
                onClick={
                  cancelarConfirmacao
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmar}
                disabled={saving}
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