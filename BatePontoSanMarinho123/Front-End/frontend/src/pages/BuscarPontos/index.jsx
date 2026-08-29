import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./buscarPontos.css";


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


  /* =======================================================
     URL COMPLETA
  ======================================================= */

  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://") ||
    valor.startsWith("data:") ||
    valor.startsWith("blob:")
  ) {

    return valor;
  }


  /* =======================================================
     URL RELATIVA
  ======================================================= */

  if (
    valor.startsWith("/")
  ) {

    return valor;
  }


  return `/${valor}`;
}


/* =========================================================
   SOMENTE NÚMEROS
========================================================= */

const somenteNumeros = (
  valor = ""
) => {

  return String(
    valor
  ).replace(
    /\D/g,
    ""
  );
};


/* =========================================================
   FORMATAR CPF
========================================================= */

const formatarCPF = (
  valor = ""
) => {

  const numeros =
    somenteNumeros(
      valor
    ).slice(
      0,
      11
    );


  if (
    numeros.length <= 3
  ) {

    return numeros;
  }


  if (
    numeros.length <= 6
  ) {

    return `${numeros.slice(
      0,
      3
    )}.${numeros.slice(
      3
    )}`;
  }


  if (
    numeros.length <= 9
  ) {

    return `${numeros.slice(
      0,
      3
    )}.${numeros.slice(
      3,
      6
    )}.${numeros.slice(
      6
    )}`;
  }


  return `${numeros.slice(
    0,
    3
  )}.${numeros.slice(
    3,
    6
  )}.${numeros.slice(
    6,
    9
  )}-${numeros.slice(
    9,
    11
  )}`;
};


/* =========================================================
   COMPONENTE
========================================================= */

export default function BuscarPontos() {

  const navigate =
    useNavigate();


  /* =======================================================
     ESTADOS
  ======================================================= */

  const [
    cpf,
    setCpf,
  ] =
    useState("");


  const [
    erro,
    setErro,
  ] =
    useState("");


  /* =======================================================
     USUÁRIO SALVO
  ======================================================= */

  const usuario =
    useMemo(
      () => {

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

      },
      []
    );


  /* =======================================================
     EMPRESA SALVA
  ======================================================= */

  const empresaSalva =
    useMemo(
      () => {

        try {

          /* =================================================
             PRIMEIRA OPÇÃO
          ================================================= */

          let salvo =
            localStorage.getItem(
              "identidade_empresa"
            );


          /* =================================================
             COMPATIBILIDADE
          ================================================= */

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
            "Erro ao carregar empresa:",
            error
          );


          return null;
        }

      },
      []
    );


  /* =======================================================
     EMPRESA ID
  ======================================================= */

  const empresaId =
    empresaSalva?.id ||
    empresaSalva?.empresa_id ||
    usuario?.empresa_id ||
    null;


  /* =======================================================
     IDENTIDADE VISUAL
  ======================================================= */

  const identidade =
    useMemo(
      () => {

        /* =================================================
           NOME
        ================================================= */

        const nome =
          empresaSalva?.nome ||
          empresaSalva?.nome_fantasia ||
          usuario?.empresa_nome ||
          "Empresa";


        /* =================================================
           FUNDO
        ================================================= */

        let fundoEmpresa =
          normalizarUrlImagem(
            empresaSalva?.fundo_url ||
            empresaSalva
              ?.dashboard_background_url
          );


        /* =================================================
           FUNDO PELO ENDPOINT
        ================================================= */

        if (
          !fundoEmpresa &&
          empresaId
        ) {

          fundoEmpresa =
            `/api/empresas/${empresaId}/fundo`;
        }


        /* =================================================
           CORES
        ================================================= */

        const corPrimaria =
          empresaSalva?.cor_primaria ||
          "#0d6efd";


        const corSecundaria =
          empresaSalva?.cor_secundaria ||
          "#084298";


        return {

          id:
            empresaId,

          nome,

          fundo:
            fundoEmpresa ||
            fundoPadrao,

          corPrimaria,

          corSecundaria,
        };

      },
      [
        empresaSalva,
        empresaId,
        usuario,
      ]
    );


  /* =======================================================
     ESTILO DINÂMICO
  ======================================================= */

  const estiloBuscar = {

    "--buscar-cor-primaria":
      identidade.corPrimaria,

    "--buscar-cor-secundaria":
      identidade.corSecundaria,

    backgroundImage:
      `url("${identidade.fundo}")`,
  };


  /* =======================================================
     ALTERAR CPF
  ======================================================= */

  const handleCPFChange = (
    event
  ) => {

    const valor =
      event.target.value;


    setCpf(
      formatarCPF(
        valor
      )
    );


    if (erro) {

      setErro(
        ""
      );
    }
  };


  /* =======================================================
     BUSCAR
  ======================================================= */

  const buscar = () => {

    setErro(
      ""
    );


    const cpfLimpo =
      somenteNumeros(
        cpf
      );


    /* =====================================================
       VALIDAR CPF
    ===================================================== */

    if (
      cpfLimpo.length !== 11
    ) {

      setErro(
        "Digite um CPF com 11 números."
      );


      return;
    }


    /* =====================================================
       VALIDAR EMPRESA
    ===================================================== */

    if (!empresaId) {

      setErro(
        "Empresa não identificada. Faça login novamente."
      );


      return;
    }


    /* =====================================================
       ABRIR RESULTADO
    ===================================================== */

    navigate(
      "/resultado-pontos",
      {
        state: {

          cpf:
            cpfLimpo,

          empresa_id:
            empresaId,
        },
      }
    );
  };


  /* =======================================================
     ENTER
  ======================================================= */

  const handleKeyDown = (
    event
  ) => {

    if (
      event.key === "Enter"
    ) {

      buscar();
    }
  };


  /* =======================================================
     CANCELAR

     IMPORTANTE:

     /       = LOGIN
     /ponto  = HOME DO SISTEMA DE PONTO

     Portanto o botão Cancelar precisa ir para /ponto.
  ======================================================= */

  const cancelar = () => {

    /* =====================================================
       LIMPAR CPF
    ===================================================== */

    setCpf(
      ""
    );


    /* =====================================================
       LIMPAR ERRO
    ===================================================== */

    setErro(
      ""
    );


    /* =====================================================
       VOLTAR PARA HOME DO PONTO
    ===================================================== */

    navigate(
      "/ponto",
      {
        replace: true,
      }
    );
  };


  /* =======================================================
     JSX
  ======================================================= */

  return (

    <div
      className="buscarContainer"
      style={
        estiloBuscar
      }
    >

      <div
        className="buscarCard"
      >

        {/* =================================================
            TÍTULO
        ================================================= */}

        <h2>
          Consultar pontos
        </h2>


        {/* =================================================
            CAMPO CPF
        ================================================= */}

        <input
          type="text"

          placeholder="Digite o CPF"

          value={
            cpf
          }

          onChange={
            handleCPFChange
          }

          onKeyDown={
            handleKeyDown
          }

          inputMode="numeric"

          autoComplete="off"

          maxLength={
            14
          }

          aria-label="CPF"
        />


        {/* =================================================
            BOTÃO BUSCAR
        ================================================= */}

        <button
          type="button"

          className="buscarBtn"

          onClick={
            buscar
          }
        >
          Buscar
        </button>


        {/* =================================================
            BOTÃO CANCELAR

            AGORA VAI PARA /ponto
        ================================================= */}

        <button
          type="button"

          className="buscarBtnVoltar"

          onClick={
            cancelar
          }
        >
          Cancelar
        </button>


        {/* =================================================
            ERRO
        ================================================= */}

        {
          erro &&
          (

            <p
              className="buscarErro"
            >
              {
                erro
              }
            </p>
          )
        }

      </div>

    </div>
  );
}