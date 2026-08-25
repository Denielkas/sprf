import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import relogio from "../../assets/logo/relogio.png";

/*
  Imagens padrão.

  Só serão usadas caso a empresa realmente
  não tenha logo ou fundo cadastrados.
*/
import logoPadrao from "../../assets/logo/Hotel-Sam-Marinho.png";
import fundoPadrao from "../../assets/logo/hotel.jpg";

import "./home.css";

/* =========================================================
   NORMALIZAR URL
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

  /*
    URLs completas, data e blob
  */
  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://") ||
    valor.startsWith("data:") ||
    valor.startsWith("blob:")
  ) {
    return valor;
  }

  /*
    Exemplo:
    /api/empresas/1/logo
  */
  if (valor.startsWith("/")) {
    return valor;
  }

  return `/${valor}`;
}

/* =========================================================
   HOME
========================================================= */

export default function Home() {
  const navigate =
    useNavigate();

  /* =======================================================
     USUÁRIO
  ======================================================= */

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

  /* =======================================================
     EMPRESA SALVA NO LOGIN
  ======================================================= */

  const empresaSalva =
    useMemo(() => {
      try {
        /*
          Primeiro tenta o novo nome.
        */

        let salvo =
          localStorage.getItem(
            "identidade_empresa"
          );

        /*
          Caso seu Login tenha salvo como "empresa",
          também aceitamos.
        */

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
    }, []);

  /* =======================================================
     DESCOBRIR EMPRESA ID

     Esse ID é importantíssimo.

     Com ele podemos montar diretamente:

     /api/empresas/1/logo
     /api/empresas/1/fundo
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
    useMemo(() => {
      const nome =
        empresaSalva?.nome ||
        empresaSalva?.nome_fantasia ||
        usuario?.empresa_nome ||
        "Empresa";

      /* ===================================================
         LOGO

         Prioridade:

         1. logo_url recebida do backend
         2. se tiver empresaId, monta rota automaticamente
         3. fallback
      =================================================== */

      let logoEmpresa =
        normalizarUrlImagem(
          empresaSalva?.logo_url
        );

      if (
        !logoEmpresa &&
        empresaId
      ) {
        logoEmpresa =
          `/api/empresas/${empresaId}/logo`;
      }

      /* ===================================================
         FUNDO

         Prioridade:

         1. fundo_url
         2. dashboard_background_url
         3. monta rota pelo empresaId
         4. fallback
      =================================================== */

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

        nome,

        logo:
          logoEmpresa ||
          logoPadrao,

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

  /* =======================================================
     DEBUG

     Veja no console F12 do navegador.
  ======================================================= */

  useEffect(() => {
    console.log(
      "=========================================="
    );

    console.log(
      "🏢 USUÁRIO:",
      usuario
    );

    console.log(
      "🏢 EMPRESA SALVA:",
      empresaSalva
    );

    console.log(
      "🆔 EMPRESA ID:",
      empresaId
    );

    console.log(
      "🖼 LOGO FINAL:",
      identidade.logo
    );

    console.log(
      "🌄 FUNDO FINAL:",
      identidade.fundo
    );

    console.log(
      "🎨 IDENTIDADE FINAL:",
      identidade
    );

    console.log(
      "=========================================="
    );
  }, [
    usuario,
    empresaSalva,
    empresaId,
    identidade,
  ]);

  /* =======================================================
     RELÓGIO
  ======================================================= */

  const [time, setTime] =
    useState(
      new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit",

          hour12:
            false,
        }
      )
    );

  /* =======================================================
     ATUALIZAR RELÓGIO
  ======================================================= */

  useEffect(() => {
    const id =
      setInterval(() => {
        setTime(
          new Date().toLocaleTimeString(
            "pt-BR",
            {
              hour:
                "2-digit",

              minute:
                "2-digit",

              second:
                "2-digit",

              hour12:
                false,
            }
          )
        );
      }, 1000);

    return () => {
      clearInterval(id);
    };
  }, []);

  /* =======================================================
     ESTILO DINÂMICO
  ======================================================= */

  const estiloHome = {
    "--home-cor-primaria":
      identidade.corPrimaria,

    "--home-cor-secundaria":
      identidade.corSecundaria,

    backgroundImage:
      `url("${identidade.fundo}")`,
  };

  /* =======================================================
     ERRO NA LOGO

     Se a empresa realmente não tiver arquivo,
     usamos a logo padrão.
  ======================================================= */

  function erroLogo(event) {
    console.error(
      "❌ Não foi possível carregar a logo:",
      identidade.logo
    );

    /*
      Evita loop infinito de onError.
    */

    event.currentTarget.onerror =
      null;

    event.currentTarget.src =
      logoPadrao;
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div
      className="homeScreen"
      style={estiloHome}
    >

      {/* ===================================================
          LOGO DA EMPRESA
      =================================================== */}

      <header
        className="homeHeader"
      >
        <div
          className="brand"
        >
          <img
            key={
              identidade.logo
            }
            src={
              identidade.logo
            }
            className="brandLogo"
            alt={
              identidade.nome
            }
            onError={
              erroLogo
            }
          />
        </div>
      </header>

      {/* ===================================================
          CONTEÚDO
      =================================================== */}

      <main
        className="homeMain"
      >

        {/* =================================================
            BATER PONTO
        ================================================= */}

        <button
          type="button"
          className="clockButton"
          onClick={() =>
            navigate(
              "/reconhecimento"
            )
          }
        >
          <img
            src={relogio}
            className="clockIcon"
            alt="Relógio"
          />

          <span
            className="clockTime"
          >
            {time}
          </span>

          <span
            className="clockLabel"
          >
            Bater ponto
          </span>
        </button>

        {/* =================================================
            VER PONTOS
        ================================================= */}

        <button
          type="button"
          className="viewPointsButton"
          onClick={() =>
            navigate(
              "/buscar-pontos"
            )
          }
        >
          <span
            className="viewPointsEmoji"
          >
            📋
          </span>

          <span
            className="viewPointsLabel"
          >
            Ver pontos batidos
          </span>
        </button>

      </main>

    </div>
  );
}