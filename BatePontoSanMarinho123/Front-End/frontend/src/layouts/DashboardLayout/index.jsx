import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import logoPadrao from "../../assets/logo/Hotel-Sam-Marinho.png";
import fundoPadrao from "../../assets/logo/hotel-fundo.jpg";

import "./layout.css";


/* =========================================================
   NORMALIZAR URL
========================================================= */

function normalizarUrl(url) {
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

  if (valor.startsWith("/")) {
    return valor;
  }

  return `/${valor}`;
}


/* =========================================================
   DASHBOARD
========================================================= */

export default function DashboardLayout() {
  const navigate =
    useNavigate();

  const [open, setOpen] =
    useState(false);


  /* =======================================================
     USUÁRIO LOGADO
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
     ROLE
  ======================================================= */

  const role =
    usuario?.role ||
    localStorage.getItem("role") ||
    "";


  const isSuperAdmin =
    role === "super_admin";


  const isRH =
    role === "rh_empresa";


  const isPonto =
    role === "ponto_empresa";


  /* =======================================================
     TERMINAL DE PONTO NÃO USA DASHBOARD
  ======================================================= */

  useEffect(() => {
    if (isPonto) {
      navigate(
        "/ponto",
        {
          replace: true,
        }
      );
    }
  }, [
    isPonto,
    navigate,
  ]);


  /* =======================================================
     IDENTIDADE SALVA DA EMPRESA
  ======================================================= */

  const empresaSalva =
    useMemo(() => {
      try {
        let salva =
          localStorage.getItem(
            "identidade_empresa"
          );

        if (!salva) {
          salva =
            localStorage.getItem(
              "empresa"
            );
        }

        if (!salva) {
          return null;
        }

        return JSON.parse(
          salva
        );
      } catch (error) {
        console.error(
          "Erro ao carregar identidade visual:",
          error
        );

        return null;
      }
    }, []);


  /* =======================================================
     ID DA EMPRESA
  ======================================================= */

  const empresaId =
    empresaSalva?.id ||
    empresaSalva?.empresa_id ||
    usuario?.empresa_id ||
    localStorage.getItem(
      "empresa_id"
    ) ||
    null;


  /* =======================================================
     IDENTIDADE VISUAL
  ======================================================= */

  const identidade =
    useMemo(() => {

      /* ===================================================
         SUPER ADMIN

         Não usa identidade de hotel/empresa.
      =================================================== */

      if (isSuperAdmin) {
        return {
          id: null,

          nome:
            "Super Administrador",

          logo:
            null,

          fundo:
            null,

          corPrimaria:
            "#008fe3",

          corSecundaria:
            "#073786",
        };
      }


      /* ===================================================
         EMPRESA / RH
      =================================================== */

      const nome =
        empresaSalva?.nome_fantasia ||
        empresaSalva?.nome ||
        usuario?.empresa_nome ||
        localStorage.getItem(
          "empresa_nome"
        ) ||
        "Empresa";


      /* ===================================================
         LOGO
      =================================================== */

      let logo =
        normalizarUrl(
          empresaSalva?.logo_url
        );

      if (
        !logo &&
        empresaId
      ) {
        logo =
          `/api/empresas/${empresaId}/logo`;
      }


      /* ===================================================
         FUNDO
      =================================================== */

      let fundo =
        normalizarUrl(
          empresaSalva?.dashboard_background_url ||
          empresaSalva?.fundo_url
        );

      if (
        !fundo &&
        empresaId
      ) {
        fundo =
          `/api/empresas/${empresaId}/fundo`;
      }


      /* ===================================================
         RETORNO
      =================================================== */

      return {
        id:
          empresaId,

        nome,

        logo:
          logo ||
          logoPadrao,

        fundo:
          fundo ||
          fundoPadrao,

        corPrimaria:
          empresaSalva?.cor_primaria ||
          "#0d6efd",

        corSecundaria:
          empresaSalva?.cor_secundaria ||
          "#084298",
      };
    }, [
      isSuperAdmin,
      empresaSalva,
      empresaId,
      usuario,
    ]);


  /* =======================================================
     APLICAR IDENTIDADE NO ROOT
  ======================================================= */

  useEffect(() => {
    const root =
      document.documentElement;


    /* =====================================================
       CORES
    ===================================================== */

    root.style.setProperty(
      "--empresa-cor-primaria",
      identidade.corPrimaria
    );

    root.style.setProperty(
      "--empresa-cor-secundaria",
      identidade.corSecundaria
    );

    root.style.setProperty(
      "--cor-primaria",
      identidade.corPrimaria
    );

    root.style.setProperty(
      "--cor-secundaria",
      identidade.corSecundaria
    );


    /* =====================================================
       FUNDO

       Apenas RH/empresa recebe imagem.
    ===================================================== */

    if (
      !isSuperAdmin &&
      identidade.fundo
    ) {
      root.style.setProperty(
        "--empresa-dashboard-background",
        `url("${identidade.fundo}")`
      );
    } else {
      root.style.removeProperty(
        "--empresa-dashboard-background"
      );
    }


    return () => {
      root.style.removeProperty(
        "--empresa-dashboard-background"
      );
    };
  }, [
    identidade,
    isSuperAdmin,
  ]);


  /* =======================================================
     ESTILO DO TEMA
  ======================================================= */

  const estiloTema = {
    "--empresa-cor-primaria":
      identidade.corPrimaria,

    "--empresa-cor-secundaria":
      identidade.corSecundaria,

    "--cor-primaria":
      identidade.corPrimaria,

    "--cor-secundaria":
      identidade.corSecundaria,

    ...(
      !isSuperAdmin &&
      identidade.fundo
        ? {
            "--empresa-dashboard-background":
              `url("${identidade.fundo}")`,
          }
        : {}
    ),
  };


  /* =======================================================
     LOGOUT
  ======================================================= */

  function logout() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "usuario"
    );

    localStorage.removeItem(
      "role"
    );

    localStorage.removeItem(
      "empresa_id"
    );

    localStorage.removeItem(
      "empresa_nome"
    );

    localStorage.removeItem(
      "identidade_empresa"
    );

    localStorage.removeItem(
      "empresa"
    );


    /* =====================================================
       LIMPAR TEMA
    ===================================================== */

    const root =
      document.documentElement;

    root.style.removeProperty(
      "--empresa-cor-primaria"
    );

    root.style.removeProperty(
      "--empresa-cor-secundaria"
    );

    root.style.removeProperty(
      "--cor-primaria"
    );

    root.style.removeProperty(
      "--cor-secundaria"
    );

    root.style.removeProperty(
      "--empresa-dashboard-background"
    );


    /* =====================================================
       VOLTAR PARA LOGIN
    ===================================================== */

    navigate(
      "/",
      {
        replace: true,
      }
    );
  }


  /* =======================================================
     MENU
  ======================================================= */

  function toggleMenu() {
    setOpen(
      (estadoAtual) =>
        !estadoAtual
    );
  }


  function closeOnClick() {
    setOpen(false);
  }


  /* =======================================================
     ERRO NA LOGO
  ======================================================= */

  function erroLogo(event) {
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
      className={[
        "dashContainer",

        open
          ? "menu-open"
          : "",

        isSuperAdmin
          ? "dashSuperAdmin"
          : "dashEmpresa",
      ]
        .filter(Boolean)
        .join(" ")}
      style={estiloTema}
    >

      {/* ===================================================
          BOTÃO MENU
      =================================================== */}

      <button
        type="button"
        className="menuToggle"
        onClick={toggleMenu}
        aria-label={
          open
            ? "Fechar menu"
            : "Abrir menu"
        }
        title={
          open
            ? "Fechar menu"
            : "Abrir menu"
        }
      >
        {open
          ? "←"
          : "☰"}
      </button>


      {/* ===================================================
          OVERLAY
      =================================================== */}

      {open && (
        <button
          type="button"
          className="dashOverlay"
          onClick={
            closeOnClick
          }
          aria-label="Fechar menu"
        />
      )}


      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={`dashSidebar ${
          open
            ? "show"
            : ""
        }`}
      >

        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div className="sidebarHeader">

          {/* ===============================================
              LOGO SOMENTE PARA EMPRESA
          =============================================== */}

          {!isSuperAdmin && (
            <img
              src={
                identidade.logo
              }
              className="sidebarLogo"
              alt={
                identidade.nome
              }
              onError={
                erroLogo
              }
            />
          )}


          {/* ===============================================
              EMPRESA
          =============================================== */}

          <div className="sidebarEmpresa">

            {isSuperAdmin
              ? "Super Administrador"
              : identidade.nome}

          </div>


          {/* ===============================================
              PERFIL
          =============================================== */}

          {isSuperAdmin && (
            <div className="sidebarTipoUsuario">
              SUPER ADMIN
            </div>
          )}


          {isRH && (
            <div className="sidebarTipoUsuario">
              RH
            </div>
          )}


          {/* ===============================================
              USUÁRIO
          =============================================== */}

          {usuario?.username && (
            <div className="sidebarUsuario">
              {usuario.username}
            </div>
          )}

        </div>


        {/* =================================================
            SUPER ADMIN
        ================================================= */}

        {isSuperAdmin && (
          <nav className="dashMenu">

            <div className="menuSectionTitle">
              Administração Geral
            </div>


            {/* =============================================
                EMPRESAS
            ============================================= */}

            <NavLink
              to="/app/empresas"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Empresas
            </NavLink>


            {/* =============================================
                ACESSOS
            ============================================= */}

            <NavLink
              to="/app/acessos"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Acessos
            </NavLink>


            {/* =============================================
                LOGS
            ============================================= */}

            <NavLink
              to="/app/logs"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Logs
            </NavLink>

          </nav>
        )}


        {/* =================================================
            RH
        ================================================= */}

        {isRH && (
          <nav className="dashMenu">

            {/* =============================================
                FUNCIONÁRIOS
            ============================================= */}

            <div className="menuSectionTitle">
              Funcionários
            </div>


            {/* =============================================
                CADASTRAR FUNCIONÁRIO
            ============================================= */}

            <NavLink
              to="/app/registrar-funcionario"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Cadastrar Funcionário
            </NavLink>


            {/* =============================================
                VER FUNCIONÁRIOS
            ============================================= */}

            <NavLink
              to="/app/funcionarios"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Ver Funcionários
            </NavLink>


            {/* =============================================
                CONTROLE DE PONTO
            ============================================= */}

            <div className="menuSectionTitle">
              Controle de Ponto
            </div>


            {/* =============================================
                RELATÓRIO
            ============================================= */}

            <NavLink
              to="/app/relatorio"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Relatório
            </NavLink>


            {/* =============================================
                INSERIR PONTO MANUAL

                ROTA CORRETA:
                /app/manual
            ============================================= */}

            <NavLink
              to="/app/manual"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Inserir Ponto Manual
            </NavLink>


            {/* =============================================
                ATESTADO
            ============================================= */}

            <NavLink
              to="/app/atestado"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Anexar Atestado
            </NavLink>


            {/* =============================================
                BANCO DE HORAS

                ROTA CORRETA:
                /app/bancoHoras
            ============================================= */}

            <NavLink
              to="/app/bancoHoras"
              className={({
                isActive,
              }) =>
                `dashLink ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
              onClick={
                closeOnClick
              }
            >
              Banco de Horas
            </NavLink>

          </nav>
        )}


        {/* =================================================
            SAIR
        ================================================= */}

        <button
          type="button"
          className="dashLogout"
          onClick={
            logout
          }
        >
          Sair
        </button>

      </aside>


      {/* ===================================================
          CONTEÚDO
      =================================================== */}

      <main className="dashContent">

        <div className="dashContentInner">
          <Outlet />
        </div>

      </main>

    </div>
  );
}