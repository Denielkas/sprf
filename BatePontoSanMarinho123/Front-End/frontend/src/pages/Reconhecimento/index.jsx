import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  apiFace,
} from "../../services/apiFace";

import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./reconhecimento.css";


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const CONFIRMACOES_NECESSARIAS = 2;

const INTERVALO_RECONHECIMENTO = 900;

/*
  Permite pequenas falhas entre a primeira
  e a segunda confirmação.
*/
const MAX_FALHAS_INTERMEDIARIAS = 2;


/* =========================================================
   NORMALIZAR URL DA IMAGEM
========================================================= */

function normalizarUrlImagem(url) {

  if (!url) {
    return null;
  }

  const valor =
    String(url).trim();

  if (!valor) {
    return null;
  }

  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://") ||
    valor.startsWith("data:") ||
    valor.startsWith("blob:")
  ) {
    return valor;
  }

  if (
    valor.startsWith("/")
  ) {
    return valor;
  }

  return `/${valor}`;
}


/* =========================================================
   COMPONENTE
========================================================= */

export default function Reconhecimento() {

  const navigate =
    useNavigate();


  /* =========================================================
     USUÁRIO
  ========================================================= */

  const usuario =
    useMemo(() => {

      try {

        const salvo =
          localStorage.getItem(
            "usuario"
          );

        if (!salvo) {
          return null;
        }

        return JSON.parse(
          salvo
        );

      } catch (error) {

        console.error(
          "Erro ao carregar usuário:",
          error
        );

        return null;
      }

    }, []);


  /* =========================================================
     EMPRESA SALVA
  ========================================================= */

  const empresaSalva =
    useMemo(() => {

      try {

        let salvo =
          localStorage.getItem(
            "identidade_empresa"
          );

        if (!salvo) {

          salvo =
            localStorage.getItem(
              "empresa"
            );
        }

        if (!salvo) {
          return null;
        }

        return JSON.parse(
          salvo
        );

      } catch (error) {

        console.error(
          "Erro ao carregar identidade da empresa:",
          error
        );

        return null;
      }

    }, []);


/* =========================================================
   EMPRESA ID DO TERMINAL LOGADO

   IMPORTANTE:
   A empresa do usuário autenticado tem prioridade.
   identidade_empresa é usada somente como fallback visual.
========================================================= */

const empresaId =
  Number(
    usuario?.empresa_id ||
    usuario?.empresa?.id ||
    empresaSalva?.empresa_id ||
    empresaSalva?.id ||
    0
  ) || null;


  /* =========================================================
     IDENTIDADE VISUAL
  ========================================================= */

  const identidade =
    useMemo(() => {

      let fundoEmpresa =
        normalizarUrlImagem(
          empresaSalva?.fundo_url ||
          empresaSalva?.dashboard_background_url
        );

      if (
        !fundoEmpresa &&
        empresaId
      ) {

        fundoEmpresa =
          `/api/empresas/${empresaId}/fundo`;
      }

      return {

        id:
          empresaId,

        nome:
          empresaSalva?.nome ||
          empresaSalva?.nome_fantasia ||
          usuario?.empresa_nome ||
          "Empresa",

        fundo:
          fundoEmpresa ||
          fundoPadrao,

        corPrimaria:
          empresaSalva?.cor_primaria ||
          "#0d6efd",

        corSecundaria:
          empresaSalva?.cor_secundaria ||
          "#084298",
      };

    }, [
      empresaSalva,
      empresaId,
      usuario,
    ]);


  /* =========================================================
     ESTILO DINÂMICO
  ========================================================= */

  const estiloReconhecimento = {

    "--cor-primaria":
      identidade.corPrimaria,

    "--cor-secundaria":
      identidade.corSecundaria,

    "--empresa-cor-primaria":
      identidade.corPrimaria,

    "--empresa-cor-secundaria":
      identidade.corSecundaria,

    backgroundImage:
      `url("${identidade.fundo}")`,
  };


  /* =========================================================
     REFERÊNCIAS
  ========================================================= */

  const videoRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const frameLoopRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const workingRef =
    useRef(false);

  const confirmOpenRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const recognitionActiveRef =
    useRef(false);


  /* =========================================================
     CONTROLE DAS DUAS CONFIRMAÇÕES
  ========================================================= */

  const lastMatchedIdRef =
    useRef(null);

  const stableCountRef =
    useRef(0);

  const falhasIntermediariasRef =
    useRef(0);


  /* =========================================================
     ESTADOS
  ========================================================= */

  const [
    msg,
    setMsg,
  ] =
    useState(
      "Detectando rosto..."
    );

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    confirmOpen,
    setConfirmOpen,
  ] =
    useState(false);

  const [
    funcId,
    setFuncId,
  ] =
    useState(null);

  const [
    funcNome,
    setFuncNome,
  ] =
    useState("");

  const [
    funcEmpresaId,
    setFuncEmpresaId,
  ] =
    useState(null);


  /* =========================================================
     PARAR LOOP
  ========================================================= */

  const stopRecognitionLoop =
    useCallback(() => {

      recognitionActiveRef.current =
        false;

      if (
        frameLoopRef.current
      ) {

        clearTimeout(
          frameLoopRef.current
        );

        frameLoopRef.current =
          null;
      }

    }, []);


  /* =========================================================
     PARAR CÂMERA
  ========================================================= */

  const stopCamera =
    useCallback(() => {

      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      if (
        videoRef.current
      ) {

        videoRef.current.srcObject =
          null;
      }

    }, []);


  /* =========================================================
     RESETAR RECONHECIMENTO
  ========================================================= */

  const resetStableRecognition =
    useCallback(() => {

      lastMatchedIdRef.current =
        null;

      stableCountRef.current =
        0;

      falhasIntermediariasRef.current =
        0;

    }, []);


  /* =========================================================
     REGISTRAR FALHA INTERMEDIÁRIA
  ========================================================= */

  const registrarFalhaTemporaria =
    useCallback(() => {

      if (
        stableCountRef.current === 0
      ) {
        return;
      }

      falhasIntermediariasRef.current +=
        1;

      console.log(
        "⚠️ Falha intermediária:",
        falhasIntermediariasRef.current
      );

      if (
        falhasIntermediariasRef.current >
        MAX_FALHAS_INTERMEDIARIAS
      ) {

        console.log(
          "🔄 Reiniciando validação facial."
        );

        resetStableRecognition();
      }

    }, [
      resetStableRecognition,
    ]);


  /* =========================================================
     CAPTURAR FRAME
  ========================================================= */

  const captureFrame =
    useCallback(() => {

      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      if (
        !video ||
        !canvas
      ) {
        return null;
      }

      if (
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return null;
      }

      /* =====================================================
         TAMANHO DA IMAGEM ENVIADA AO PYTHON
      ===================================================== */

      const largura =
        640;

      const proporcao =
        video.videoHeight /
        video.videoWidth;

      const altura =
        Math.round(
          largura *
          proporcao
        );

      canvas.width =
        largura;

      canvas.height =
        altura;

      const context =
        canvas.getContext(
          "2d"
        );

      if (!context) {
        return null;
      }

      context.drawImage(
        video,
        0,
        0,
        largura,
        altura
      );

      return canvas.toDataURL(
        "image/jpeg",
        0.75
      );

    }, []);


  /* =========================================================
     EXECUTAR RECONHECIMENTO
  ========================================================= */

  const executarReconhecimento =
    useCallback(
      async function executar() {

        if (
          !mountedRef.current
        ) {
          return;
        }

        if (
          !recognitionActiveRef.current
        ) {
          return;
        }

        if (
          confirmOpenRef.current
        ) {
          return;
        }

        if (
          workingRef.current
        ) {
          return;
        }

        /* ===================================================
           CAPTURAR FRAME
        =================================================== */

        const frame =
          captureFrame();

        if (!frame) {

          frameLoopRef.current =
            setTimeout(
              executar,
              300
            );

          return;
        }

        workingRef.current =
          true;

        setWorking(
          true
        );

        try {

          console.log(
            "📸 Enviando frame para reconhecimento..."
          );

          /* =================================================
             ENVIAR PARA O PYTHON
          ================================================= */

          const response =
            await apiFace.post(
              "/recognize",
              {

                image_base64:
                  frame,

                empresa_id:
                  empresaId,
              }
            );

          const data =
            response?.data ||
            {};

          console.log(
            "📥 Resposta reconhecimento:",
            data
          );


          /* =================================================
             RECONHECEU
          ================================================= */

          if (
            data?.matched &&
            data?.funcionario_id
          ) {

            const funcionarioId =
              Number(
                data.funcionario_id
              );

            const funcionarioNome =
              String(
                data?.nome ||
                "Funcionário"
              ).trim();

            const funcionarioEmpresaId =
              Number(
                data?.empresa_id ||
                empresaId ||
                0
              ) || null;

            console.log(
              "👤 Funcionário reconhecido:",
              {
                id:
                  funcionarioId,

                nome:
                  funcionarioNome,

                empresa_id:
                  funcionarioEmpresaId,
              }
            );


            /* ===============================================
               PRIMEIRA CONFIRMAÇÃO
            =============================================== */

            if (
              lastMatchedIdRef.current ===
              null
            ) {

              lastMatchedIdRef.current =
                funcionarioId;

              stableCountRef.current =
                1;

              falhasIntermediariasRef.current =
                0;
            }


            /* ===============================================
               MESMO FUNCIONÁRIO
            =============================================== */

            else if (
              lastMatchedIdRef.current ===
              funcionarioId
            ) {

              stableCountRef.current +=
                1;

              falhasIntermediariasRef.current =
                0;
            }


            /* ===============================================
               OUTRO FUNCIONÁRIO
            =============================================== */

            else {

              console.log(
                "⚠️ Funcionário reconhecido mudou:",
                lastMatchedIdRef.current,
                "->",
                funcionarioId
              );

              lastMatchedIdRef.current =
                funcionarioId;

              stableCountRef.current =
                1;

              falhasIntermediariasRef.current =
                0;
            }


            /* ===============================================
               DISTÂNCIA
            =============================================== */

            const distancia =
              typeof data.distance ===
              "number"
                ? data.distance.toFixed(
                    3
                  )
                : "-";

            console.log(
              `✅ Funcionário ${funcionarioId}: ${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS}`
            );

            setMsg(
              `Validando rosto... (${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS}) distância: ${distancia}`
            );


            /* ===============================================
               CONFIRMAÇÕES CONCLUÍDAS
            =============================================== */

            if (
              stableCountRef.current >=
              CONFIRMACOES_NECESSARIAS
            ) {

              console.log(
                "🎯 Duas confirmações concluídas."
              );

              recognitionActiveRef.current =
                false;

              stopRecognitionLoop();

              setFuncId(
                funcionarioId
              );

              setFuncNome(
                funcionarioNome
              );

              setFuncEmpresaId(
                funcionarioEmpresaId
              );

              confirmOpenRef.current =
                true;

              setConfirmOpen(
                true
              );

              setMsg(
                "Confirme sua identidade"
              );

              console.log(
                "👤 Abrindo confirmação:",
                {
                  id:
                    funcionarioId,

                  nome:
                    funcionarioNome,

                  empresa_id:
                    funcionarioEmpresaId,
                }
              );

              return;
            }

          }


          /* =================================================
             NÃO RECONHECEU
          ================================================= */

          else {

            registrarFalhaTemporaria();


            /* ===============================================
               ROSTOS PARECIDOS
            =============================================== */

            if (
              data?.reason ===
              "ambiguous_match"
            ) {

              if (
                stableCountRef.current >
                0
              ) {

                setMsg(
                  `Validando rosto... (${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS}) — mantenha o rosto centralizado.`
                );

              } else {

                setMsg(
                  "Rosto parecido com mais de uma pessoa. Centralize melhor."
                );
              }
            }


            /* ===============================================
               DISTÂNCIA ALTA
            =============================================== */

            else if (
              data?.reason ===
              "distance_above_tolerance"
            ) {

              if (
                stableCountRef.current >
                0
              ) {

                setMsg(
                  `Validando rosto... (${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS}) — continue olhando para a câmera.`
                );

              } else {

                setMsg(
                  "Posicione seu rosto dentro da marcação."
                );
              }
            }


            /* ===============================================
               NENHUM ROSTO
            =============================================== */

            else if (
              data?.error ===
              "no_face"
            ) {

              if (
                stableCountRef.current >
                0
              ) {

                setMsg(
                  `Validando rosto... (${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS}) — mantenha o rosto visível.`
                );

              } else {

                setMsg(
                  "Centralize seu rosto dentro da marcação."
                );
              }
            }


            /* ===============================================
               NENHUM ROSTO CADASTRADO
            =============================================== */

            else if (
              data?.error ===
              "no_registered_faces"
            ) {

              resetStableRecognition();

              setMsg(
                "Nenhum rosto cadastrado nesta empresa."
              );
            }


            /* ===============================================
               OUTROS
            =============================================== */

            else {

              if (
                stableCountRef.current >
                0
              ) {

                setMsg(
                  `Validando rosto... (${stableCountRef.current}/${CONFIRMACOES_NECESSARIAS})`
                );

              } else {

                setMsg(
                  "Centralize seu rosto dentro da marcação."
                );
              }
            }
          }

        } catch (error) {

          console.error(
            "Erro no reconhecimento:",
            error
          );

          registrarFalhaTemporaria();

          setMsg(
            error?.response?.data?.error ||
            error?.response?.data?.detail ||
            "Erro ao reconhecer rosto. Tentando novamente..."
          );

        } finally {

          workingRef.current =
            false;

          if (
            mountedRef.current
          ) {

            setWorking(
              false
            );
          }

          if (
            mountedRef.current &&
            recognitionActiveRef.current &&
            !confirmOpenRef.current
          ) {

            frameLoopRef.current =
              setTimeout(
                executar,
                INTERVALO_RECONHECIMENTO
              );
          }
        }

      },
      [
        captureFrame,
        empresaId,
        registrarFalhaTemporaria,
        resetStableRecognition,
        stopRecognitionLoop,
      ]
    );


  /* =========================================================
     INICIAR LOOP
  ========================================================= */

  const startRecognitionLoop =
    useCallback(() => {

      stopRecognitionLoop();

      resetStableRecognition();

      recognitionActiveRef.current =
        true;

      setMsg(
        "Centralize seu rosto dentro da marcação."
      );

      frameLoopRef.current =
        setTimeout(
          () => {

            executarReconhecimento();

          },
          300
        );

    }, [
      executarReconhecimento,
      resetStableRecognition,
      stopRecognitionLoop,
    ]);


  /* =========================================================
     OBTER CÂMERA FRONTAL
  ========================================================= */

  const obterCameraFrontal =
    useCallback(
      async () => {

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {

          throw new Error(
            "Câmera indisponível neste navegador."
          );
        }


        /* =====================================================
           TENTATIVA 1
        ===================================================== */

        try {

          return await navigator
            .mediaDevices
            .getUserMedia({
              video: {

                facingMode: {
                  exact:
                    "user",
                },

                width: {
                  ideal:
                    1280,
                },

                height: {
                  ideal:
                    720,
                },
              },

              audio:
                false,
            });

        } catch (error) {

          console.log(
            "Falhou exact:user, tentando user simples...",
            error
          );
        }


        /* =====================================================
           TENTATIVA 2
        ===================================================== */

        try {

          return await navigator
            .mediaDevices
            .getUserMedia({
              video: {

                facingMode:
                  "user",

                width: {
                  ideal:
                    1280,
                },

                height: {
                  ideal:
                    720,
                },
              },

              audio:
                false,
            });

        } catch (error) {

          console.log(
            "Falhou facingMode user, tentando enumerar câmeras...",
            error
          );
        }


        /* =====================================================
           TENTATIVA 3
        ===================================================== */

        const devices =
          await navigator
            .mediaDevices
            .enumerateDevices();

        const videoInputs =
          devices.filter(
            (device) =>
              device.kind ===
              "videoinput"
          );

        const frontal =
          videoInputs.find(
            (device) =>
              /front|frontal|user|face/i.test(
                device.label ||
                ""
              )
          ) ||
          videoInputs[0];

        if (
          !frontal?.deviceId
        ) {

          throw new Error(
            "Nenhuma câmera encontrada."
          );
        }

        return await navigator
          .mediaDevices
          .getUserMedia({
            video: {

              deviceId: {
                exact:
                  frontal.deviceId,
              },

              width: {
                ideal:
                  1280,
              },

              height: {
                ideal:
                  720,
              },
            },

            audio:
              false,
          });

      },
      []
    );


  /* =========================================================
     INICIAR CÂMERA
  ========================================================= */

  useEffect(() => {

    mountedRef.current =
      true;

    async function iniciarCamera() {

      try {

        setMsg(
          "Abrindo câmera frontal..."
        );

        stopRecognitionLoop();

        stopCamera();

        resetStableRecognition();

        const stream =
          await obterCameraFrontal();

        if (
          !mountedRef.current
        ) {

          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          return;
        }

        streamRef.current =
          stream;


        /* ===================================================
           COLOCAR STREAM NO VÍDEO
        =================================================== */

        if (
          videoRef.current
        ) {

          videoRef.current.srcObject =
            stream;

          videoRef.current.setAttribute(
            "autoplay",
            ""
          );

          videoRef.current.setAttribute(
            "muted",
            ""
          );

          videoRef.current.setAttribute(
            "playsinline",
            ""
          );

          await videoRef.current.play();
        }


        /* ===================================================
           AGUARDAR CÂMERA ESTABILIZAR
        =================================================== */

        setTimeout(
          () => {

            if (
              mountedRef.current
            ) {

              startRecognitionLoop();
            }

          },
          500
        );

      } catch (error) {

        console.error(
          "Erro câmera:",
          error
        );

        if (
          mountedRef.current
        ) {

          setMsg(
            error?.message ||
            "Erro ao acessar câmera frontal."
          );
        }
      }
    }

    iniciarCamera();


    /* =======================================================
       LIMPEZA
    ======================================================= */

    return () => {

      mountedRef.current =
        false;

      stopRecognitionLoop();

      stopCamera();

      resetStableRecognition();
    };

  }, [
    obterCameraFrontal,
    resetStableRecognition,
    startRecognitionLoop,
    stopCamera,
    stopRecognitionLoop,
  ]);


  /* =========================================================
     NÃO SOU EU
  ========================================================= */

  function cancelarIdentidade() {

    confirmOpenRef.current =
      false;

    setConfirmOpen(
      false
    );

    setFuncId(
      null
    );

    setFuncNome(
      ""
    );

    setFuncEmpresaId(
      null
    );

    resetStableRecognition();

    setMsg(
      "Centralize seu rosto dentro da marcação."
    );

    setTimeout(
      () => {

        if (
          mountedRef.current
        ) {

          startRecognitionLoop();
        }

      },
      300
    );
  }


  /* =========================================================
     SOU EU
  ========================================================= */

  function confirmarIdentidade() {

    if (
      !funcId
    ) {

      console.error(
        "❌ Funcionário não informado."
      );

      setMsg(
        "Funcionário não identificado."
      );

      return;
    }

    const empresaFuncionario =
      Number(
        funcEmpresaId ||
        empresaId ||
        0
      ) || null;

    console.log(
      "➡️ Confirmando identidade:",
      {
        funcionario_id:
          funcId,

        nome:
          funcNome,

        empresa_id:
          empresaFuncionario,
      }
    );

    if (
      !empresaFuncionario
    ) {

      console.error(
        "❌ Empresa não encontrada para o funcionário."
      );

      setMsg(
        "Empresa do funcionário não identificada."
      );

      return;
    }

    stopRecognitionLoop();

    stopCamera();

    confirmOpenRef.current =
      false;

    setConfirmOpen(
      false
    );


    /* =======================================================
       IR PARA ESCOLHER BATIDA
    ======================================================= */

    navigate(
      "/escolher-batida",
      {
        state: {

          funcionario: {

            id:
              Number(
                funcId
              ),

            nome:
              funcNome,

            empresa_id:
              Number(
                empresaFuncionario
              ),
          },
        },

        replace:
          true,
      }
    );
  }


  /* =========================================================
     CANCELAR RECONHECIMENTO
  ========================================================= */

  function cancelarReconhecimento() {

    stopRecognitionLoop();

    stopCamera();

    navigate(
      "/ponto",
      {
        replace:
          true,
      }
    );
  }


  /* =========================================================
     JSX
  ========================================================= */

  return (

    <div
      className="recScreen"

      style={
        estiloReconhecimento
      }
    >

      <div
        className="recCard"
      >

        {/* =====================================================
            TÍTULO
        ===================================================== */}

        <h2
          className="recTitle"
        >
          Reconhecimento Facial
        </h2>


        {/* =====================================================
            CÂMERA
        ===================================================== */}

        <div
          className="videoWrap"
        >

          <video
            ref={
              videoRef
            }

            className="video"

            autoPlay

            muted

            playsInline
          />


          {/* =================================================
              GUIA PARA CENTRALIZAR O ROSTO

              É SOMENTE VISUAL.
              NÃO APARECE NO FRAME ENVIADO AO PYTHON.
          ================================================= */}

          {
            !confirmOpen &&
            (
              <div
                className="faceGuide"
              >

                <div
                  className="faceGuideOval"
                >

                  <span
                    className="faceGuideTop"
                  />

                  <span
                    className="faceGuideBottom"
                  />

                </div>


                <div
                  className="faceGuideText"
                >
                  Centralize seu rosto
                </div>

              </div>
            )
          }


          {/* =================================================
              INDICADOR DE LEITURA
          ================================================= */}

          {
            working &&
            (
              <div
                className="count"
              >
                Lendo...
              </div>
            )
          }

        </div>


        {/* =====================================================
            MENSAGEM
        ===================================================== */}

        <div
          className="recMsg"
        >
          {msg}
        </div>


        {/* =====================================================
            CANCELAR
        ===================================================== */}

        <button
          type="button"

          className="recCancel"

          onClick={
            cancelarReconhecimento
          }
        >
          Cancelar
        </button>

      </div>


      {/* =====================================================
          CANVAS INVISÍVEL
      ===================================================== */}

      <canvas
        ref={
          canvasRef
        }

        style={{
          display:
            "none",
        }}
      />


      {/* =====================================================
          CONFIRMAR IDENTIDADE
      ===================================================== */}

      {
        confirmOpen &&
        (
          <div
            className="modalOverlay"

            onClick={
              cancelarIdentidade
            }
          >

            <div
              className="modalCard"

              onClick={
                (event) =>
                  event.stopPropagation()
              }
            >

              <h3>
                Confirmar identidade
              </h3>


              <p
                className="confirmNome"
              >
                {funcNome}
              </p>


              <div
                className="modalActions"
              >

                <button
                  type="button"

                  className="confirmNao"

                  onClick={
                    cancelarIdentidade
                  }
                >
                  Não sou eu
                </button>


                <button
                  type="button"

                  className="confirmSim"

                  onClick={
                    confirmarIdentidade
                  }
                >
                  Sou eu
                </button>

              </div>

            </div>

          </div>
        )
      }

    </div>
  );
}