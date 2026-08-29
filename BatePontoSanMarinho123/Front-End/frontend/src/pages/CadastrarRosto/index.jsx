import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";

import "./cadastrarRosto.css";


/* =========================================================
   COMPONENTE
========================================================= */

export default function CadastrarRosto() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* =======================================================
     REFS
  ======================================================= */

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modalTimerRef = useRef(null);

  /* =======================================================
     FUNCIONÁRIO
  ======================================================= */

  const [nome, setNome] = useState("");
  const [funcionarioCarregado, setFuncionarioCarregado] =
    useState(false);

  /* =======================================================
     CÂMERA
  ======================================================= */

  const [cameraPronta, setCameraPronta] =
    useState(false);

  const [msg, setMsg] =
    useState("Carregando...");

  const [saving, setSaving] =
    useState(false);

  /* =======================================================
     MODAL
  ======================================================= */

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalTitulo, setModalTitulo] =
    useState("");

  const [modalTexto, setModalTexto] =
    useState("");

  const [modalErro, setModalErro] =
    useState(false);


  /* =======================================================
     ID DO FUNCIONÁRIO
  ======================================================= */

  const funcionarioId = Number(id);

  const idValido =
    Number.isInteger(funcionarioId) &&
    funcionarioId > 0;


  /* =======================================================
     PARAR CÂMERA
  ======================================================= */

  const pararCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraPronta(false);
  }, []);


  /* =======================================================
     MODAL
  ======================================================= */

  const abrirModal = useCallback(
    (
      titulo,
      texto,
      erro = false,
      redirecionar = false
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

          if (redirecionar) {
            pararCamera();

            navigate(
              "/app/funcionarios",
              {
                replace: true,
              }
            );
          }
        }, 2000);
    },
    [
      navigate,
      pararCamera,
    ]
  );


  /* =======================================================
     CARREGAR FUNCIONÁRIO
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function carregarFuncionario() {
      if (!idValido) {
        if (!ativo) return;

        setMsg(
          "Funcionário inválido."
        );

        abrirModal(
          "Erro",
          "Funcionário inválido.",
          true,
          true
        );

        return;
      }

      try {
        const { data } =
          await api.get(
            `/funcionarios/${funcionarioId}`
          );

        if (!ativo) return;

        if (!data?.id) {
          throw new Error(
            "Funcionário não encontrado."
          );
        }

        setNome(
          data.nome ||
            "Funcionário"
        );

        setFuncionarioCarregado(true);
      } catch (error) {
        console.error(
          "Erro ao carregar funcionário:",
          error
        );

        if (!ativo) return;

        setFuncionarioCarregado(false);

        const mensagem =
          error.response?.data?.error ||
          error.response?.data?.erro ||
          error.response?.data?.message ||
          error.message ||
          "Erro ao carregar funcionário.";

        setMsg(mensagem);

        abrirModal(
          "Erro ao carregar",
          mensagem,
          true,
          true
        );
      }
    }

    carregarFuncionario();

    return () => {
      ativo = false;
    };
  }, [
    funcionarioId,
    idValido,
    abrirModal,
  ]);


  /* =======================================================
     OBTER CÂMERA FRONTAL
  ======================================================= */

  const obterCameraFrontal =
    useCallback(async () => {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        throw new Error(
          "Câmera indisponível neste navegador."
        );
      }

      /*
        Primeiro tenta exigir a câmera
        frontal.
      */

      try {
        return await navigator
          .mediaDevices
          .getUserMedia({
            video: {
              facingMode: {
                exact: "user",
              },

              width: {
                ideal: 1280,
              },

              height: {
                ideal: 720,
              },
            },

            audio: false,
          });
      } catch (error) {
        console.log(
          "Não foi possível usar exact:user.",
          error
        );
      }


      /*
        Segunda tentativa.
      */

      try {
        return await navigator
          .mediaDevices
          .getUserMedia({
            video: {
              facingMode: "user",

              width: {
                ideal: 1280,
              },

              height: {
                ideal: 720,
              },
            },

            audio: false,
          });
      } catch (error) {
        console.log(
          "Não foi possível usar facingMode user.",
          error
        );
      }


      /*
        Última tentativa:
        procura uma câmera disponível.
      */

      const devices =
        await navigator.mediaDevices
          .enumerateDevices();

      const cameras =
        devices.filter(
          (device) =>
            device.kind ===
            "videoinput"
        );

      if (!cameras.length) {
        throw new Error(
          "Nenhuma câmera encontrada."
        );
      }

      const frontal =
        cameras.find((device) =>
          /front|frontal|user|face/i.test(
            device.label || ""
          )
        ) ||
        cameras[0];

      return await navigator
        .mediaDevices
        .getUserMedia({
          video: {
            deviceId: {
              exact:
                frontal.deviceId,
            },

            width: {
              ideal: 1280,
            },

            height: {
              ideal: 720,
            },
          },

          audio: false,
        });
    }, []);


  /* =======================================================
     INICIAR CÂMERA
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function iniciarCamera() {
      try {
        setMsg(
          "Abrindo câmera frontal..."
        );

        setCameraPronta(false);

        pararCamera();

        const stream =
          await obterCameraFrontal();

        if (!ativo) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current =
          stream;

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "Elemento de vídeo não encontrado."
          );
        }

        video.srcObject =
          stream;

        video.setAttribute(
          "autoplay",
          ""
        );

        video.setAttribute(
          "muted",
          ""
        );

        video.setAttribute(
          "playsinline",
          ""
        );

        await video.play();

        if (!ativo) return;

        setCameraPronta(true);

        setMsg(
          "Câmera frontal pronta. Clique para capturar o rosto."
        );
      } catch (error) {
        console.error(
          "Erro ao abrir câmera:",
          error
        );

        if (!ativo) return;

        setCameraPronta(false);

        setMsg(
          error.message ||
            "Erro ao acessar câmera."
        );
      }
    }

    iniciarCamera();

    return () => {
      ativo = false;

      pararCamera();
    };
  }, [
    obterCameraFrontal,
    pararCamera,
  ]);


  /* =======================================================
     LIMPAR TIMER AO SAIR
  ======================================================= */

  useEffect(() => {
    return () => {
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
     CAPTURAR FRAME
  ======================================================= */

  const captureFrame = () => {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (!video || !canvas) {
      return null;
    }

    /*
      HAVE_CURRENT_DATA = 2
    */

    if (
      video.readyState < 2
    ) {
      return null;
    }

    const width =
      video.videoWidth;

    const height =
      video.videoHeight;

    if (
      !width ||
      !height
    ) {
      return null;
    }

    canvas.width =
      width;

    canvas.height =
      height;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    const imageBase64 =
      canvas.toDataURL(
        "image/jpeg",
        0.9
      );

    if (
      !imageBase64 ||
      !imageBase64.startsWith(
        "data:image/jpeg;base64,"
      )
    ) {
      return null;
    }

    return imageBase64;
  };


  /* =======================================================
     SALVAR ROSTO
  ======================================================= */

  const salvar = async () => {
    /*
      Evita clique duplo.
    */

    if (saving) {
      return;
    }


    /*
      Verifica funcionário.
    */

    if (
      !idValido ||
      !funcionarioCarregado
    ) {
      abrirModal(
        "Erro ao cadastrar",
        "Funcionário não carregado corretamente.",
        true
      );

      return;
    }


    /*
      Verifica câmera.
    */

    if (!cameraPronta) {
      abrirModal(
        "Atenção",
        "A câmera ainda não está pronta.",
        true
      );

      return;
    }


    try {
      setSaving(true);

      setMsg(
        "Capturando imagem..."
      );


      /* ===================================================
         CAPTURAR
      =================================================== */

      const imagem =
        captureFrame();

      if (!imagem) {
        throw new Error(
          "Não foi possível capturar a imagem."
        );
      }


      setMsg(
        "Analisando rosto..."
      );


      /* ===================================================
         PAYLOAD
      =================================================== */

      const payload = {
        funcionario_id:
          funcionarioId,

        image_base64:
          imagem,
      };


      /* ===================================================
         FACE API
      =================================================== */

      const { data } =
        await apiFace.post(
          "/enroll",
          payload
        );


      /* ===================================================
         VERIFICAR RESPOSTA
      =================================================== */

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "Falha ao cadastrar rosto."
        );
      }


      /* ===================================================
         SUCESSO
      =================================================== */

      setMsg(
        "Rosto cadastrado com sucesso."
      );

      abrirModal(
        "Registrado com sucesso!",
        `Rosto de ${
          nome ||
          "funcionário"
        } cadastrado com sucesso.`,
        false,
        true
      );
    } catch (error) {
      console.error(
        "Erro ao cadastrar rosto:",
        error
      );

      const mensagem =
        error.response?.data?.error ||
        error.response?.data?.erro ||
        error.response?.data?.message ||
        error.message ||
        "Erro ao cadastrar rosto.";

      abrirModal(
        "Erro ao cadastrar",
        mensagem,
        true
      );

      setMsg(
        "Câmera frontal pronta. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };


  /* =======================================================
     VOLTAR
  ======================================================= */

  const voltar = () => {
    pararCamera();

    navigate(
      "/app/funcionarios"
    );
  };


  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="rostocadPage">

      {/* =================================================
          TÍTULO
      ================================================= */}

      <h2>
        Cadastrar Rosto
      </h2>


      {/* =================================================
          VÍDEO
      ================================================= */}

      <div className="videoArea">

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="rostocadVideo"
        />

      </div>


      {/* =================================================
          CANVAS OCULTO
      ================================================= */}

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
      />


      {/* =================================================
          MENSAGEM
      ================================================= */}

      <p className="msg">

        {nome && (
          <>
            Funcionário:{" "}
            <strong>
              {nome}
            </strong>
            {" — "}
          </>
        )}

        {msg}

      </p>


      {/* =================================================
          CAPTURAR
      ================================================= */}

      <button
        type="button"
        onClick={salvar}
        className="rostocadBtn"
        disabled={
          saving ||
          !cameraPronta ||
          !funcionarioCarregado
        }
      >

        {saving
          ? "Salvando..."
          : !cameraPronta
          ? "Aguardando câmera..."
          : "Capturar e Salvar"}

      </button>


      {/* =================================================
          VOLTAR
      ================================================= */}

      <button
        type="button"
        className="rostocadBack"
        onClick={voltar}
        disabled={saving}
      >
        Voltar
      </button>


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