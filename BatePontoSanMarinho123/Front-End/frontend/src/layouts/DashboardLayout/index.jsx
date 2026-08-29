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


export default function DashboardLayout() {
  const navigate = useNavigate();

  const [open, setOpen] =
    useState(false);


  /* =========================================================
     USUÁRIO LOGADO
  ========================================================= */

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


  /* =========================================================
     TIPO DE USUÁRIO
  ========================================================= */

  const isSuperAdmin =
    usuario?.role === "super_admin";

  const isRH =
    usuario?.role === "rh_empresa";

  const isPonto =
    usuario?.role === "ponto_empresa";


  /* =========================================================
     PROTEÇÃO EXTRA

     ponto_empresa não deve acessar Dashboard
  ========================================================= */

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


  /* =========================================================
     IDENTIDADE VISUAL
  ========================================================= */

  const [
    identidade,
    setIdentidade,
  ] = useState({
    nome: "Hotel San Marinho",

    logo: logoPadrao,

    fundo: fundoPadrao,

    corPrimaria: "#0d6efd",

    corSecundaria: "#084298",
  });


  /* =========================================================
     CARREGAR IDENTIDADE VISUAL
  ========================================================= */

  useEffect(() => {
    try {
      const salva =
        localStorage.getItem(
          "identidade_empresa"
        );

      /*
        Se não existir identidade salva,
        mantém a identidade padrão.
      */

      if (!salva) {
        return;
      }

      const dados =
        JSON.parse(salva);


      /* =====================================================
         DEBUG

         Pode deixar por enquanto.
         Assim conseguimos conferir no console
         exatamente o que foi salvo.
      ===================================================== */

      console.log(
        "Identidade da empresa:",
        dados
      );


      setIdentidade({
        nome:
          dados.nome ||
          dados.nome_fantasia ||
          usuario?.empresa_nome ||
          "Hotel San Marinho",

        logo:
          dados.logo_url ||
          dados.logo ||
          logoPadrao,

        fundo:
          dados.dashboard_background_url ||
          dados.fundo_url ||
          dados.fundo ||
          fundoPadrao,

        corPrimaria:
          dados.cor_primaria ||
          dados.corPrimaria ||
          "#0d6efd",

        corSecundaria:
          dados.cor_secundaria ||
          dados.corSecundaria ||
          "#084298",
      });
    } catch (error) {
      console.error(
        "Erro ao carregar identidade visual:",
        error
      );
    }
  }, [
    usuario,
  ]);


  /* =========================================================
     APLICAR IDENTIDADE GLOBALMENTE

     IMPORTANTE:
     Agora as cores ficam disponíveis para TODAS
     as páginas do sistema.
  ========================================================= */

  useEffect(() => {
    const root =
      document.documentElement;


    const corPrimaria =
      identidade.corPrimaria ||
      "#0d6efd";


    const corSecundaria =
      identidade.corSecundaria ||
      "#084298";


    /* =====================================================
       VARIÁVEIS PRINCIPAIS
    ===================================================== */

    root.style.setProperty(
      "--empresa-cor-primaria",
      corPrimaria
    );

    root.style.setProperty(
      "--empresa-cor-secundaria",
      corSecundaria
    );


    /* =====================================================
       COMPATIBILIDADE COM CSS ANTIGO

       Algumas páginas estão usando:
       --cor-primaria
       --cor-secundaria
    ===================================================== */

    root.style.setProperty(
      "--cor-primaria",
      corPrimaria
    );

    root.style.setProperty(
      "--cor-secundaria",
      corSecundaria
    );


    /* =====================================================
       FUNDO
    ===================================================== */

    if (identidade.fundo) {
      root.style.setProperty(
        "--empresa-dashboard-background",
        `url("${identidade.fundo}")`
      );
    }


    /* =====================================================
       DEBUG
    ===================================================== */

    console.log(
      "Tema aplicado:",
      {
        corPrimaria,
        corSecundaria,
        fundo:
          identidade.fundo,
      }
    );

  }, [
    identidade,
  ]);


  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = () => {
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


    /* =====================================================
       LIMPAR TEMA DA EMPRESA
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


    navigate(
      "/",
      {
        replace: true,
      }
    );
  };


  /* =========================================================
     ABRIR / FECHAR MENU
  ========================================================= */

  const toggleMenu = () => {
    setOpen(
      (estadoAtual) =>
        !estadoAtual
    );
  };


  const closeOnClick = () => {
    setOpen(false);
  };


  /* =========================================================
     VARIÁVEIS DO TEMA NO CONTAINER

     Mantemos também no container por segurança.
  ========================================================= */

  const estiloTema = {
    "--empresa-cor-primaria":
      identidade.corPrimaria,

    "--empresa-cor-secundaria":
      identidade.corSecundaria,

    "--cor-primaria":
      identidade.corPrimaria,

    "--cor-secundaria":
      identidade.corSecundaria,

    "--empresa-dashboard-background":
      `url("${identidade.fundo}")`,
  };


  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div
      className={`dashContainer ${open
          ? "menu-open"
          : ""
        }`}
      style={estiloTema}
    >

      {/* =====================================================
          BOTÃO ABRIR / FECHAR MENU
      ===================================================== */}

      <button
        type="button"
        className="menuToggle"
        onClick={toggleMenu}
        aria-label={
          open
            ? "Fechar menu"
            : "Abrir menu"
        }
      >
        {open
          ? "←"
          : "☰"}
      </button>


      {/* =====================================================
          OVERLAY
      ===================================================== */}

      {open && (
        <button
          type="button"
          className="dashOverlay"
          onClick={closeOnClick}
          aria-label="Fechar menu"
        />
      )}


      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`dashSidebar ${open
            ? "show"
            : ""
          }`}
      >

        {/* ===================================================
            CABEÇALHO
        =================================================== */}

        <div className="sidebarHeader">

          <img
            src={identidade.logo}
            className="sidebarLogo"
            alt={identidade.nome}
            onError={(e) => {
              e.currentTarget.src =
                logoPadrao;
            }}
          />


          <div className="sidebarEmpresa">
            {isSuperAdmin
              ? "Super Administrador"
              : usuario?.empresa_nome ||
              identidade.nome}
          </div>


          {/* =================================================
              TIPO DE USUÁRIO
          ================================================= */}

          {isRH && (
            <div className="sidebarTipoUsuario">
              RH
            </div>
          )}


          {/* =================================================
              USERNAME
          ================================================= */}

          {usuario?.username && (
            <div className="sidebarUsuario">
              {usuario.username}
            </div>
          )}

        </div>


        {/* ===================================================
    MENU SUPER ADMIN
=================================================== */}

        {isSuperAdmin && (
          <nav className="dashMenu">

            <div className="menuSectionTitle">
              Administração Geral
            </div>


            {/* ===============================================
        EMPRESAS
    =============================================== */}

            <NavLink
              to="/app/empresas"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Empresas
            </NavLink>


            {/* ===============================================
        ACESSOS DAS EMPRESAS
    =============================================== */}

            <NavLink
              to="/app/acessos"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Acessos das Empresas
            </NavLink>


            {/* ===============================================
        LOGS DO SISTEMA
    =============================================== */}

            <NavLink
              to="/app/logs"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Logs do Sistema
            </NavLink>

          </nav>
        )}

        {/* ===================================================
            MENU RH
        =================================================== */}

        {isRH && (
          <nav className="dashMenu">

            {/* ===============================================
                FUNCIONÁRIOS
            =============================================== */}

            <div className="menuSectionTitle">
              Funcionários
            </div>


            <NavLink
              to="/app/registrar-funcionario"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Cadastrar Funcionário
            </NavLink>


            <NavLink
              to="/app/funcionarios"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Ver Funcionários
            </NavLink>


            {/* ===============================================
                CONTROLE DE PONTO
            =============================================== */}

            <div className="menuSectionTitle">
              Controle de Ponto
            </div>


            <NavLink
              to="/app/relatorio"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Relatório
            </NavLink>


            <NavLink
              to="/app/manual"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Inserir Ponto Manual
            </NavLink>


            <NavLink
              to="/app/atestado"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Anexar Atestado
            </NavLink>


            <NavLink
              to="/app/bancoHoras"
              className={({
                isActive,
              }) =>
                `dashLink ${isActive
                  ? "active"
                  : ""
                }`
              }
              onClick={closeOnClick}
            >
              Banco de Horas
            </NavLink>

          </nav>
        )}


        {/* ===================================================
            SAIR
        =================================================== */}

        <button
          type="button"
          className="dashLogout"
          onClick={logout}
        >
          Sair
        </button>

      </aside>


      {/* =====================================================
          CONTEÚDO
      ===================================================== */}

      <main className="dashContent">
        <Outlet />
      </main>

    </div>
  );
}