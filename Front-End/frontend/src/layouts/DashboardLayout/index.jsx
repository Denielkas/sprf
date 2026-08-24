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

  const [open, setOpen] = useState(false);

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

  const isSuperAdmin =
    usuario?.role === "super_admin";

  const isAdminEmpresa =
    usuario?.role === "admin_empresa";

  /* =========================================================
     IDENTIDADE VISUAL
  ========================================================= */

  const [identidade, setIdentidade] =
    useState({
      nome: "Hotel San Marinho",

      logo: logoPadrao,

      fundo: fundoPadrao,

      corPrimaria: "#0d6efd",

      corSecundaria: "#084298",
    });

  /* =========================================================
     CARREGAR IDENTIDADE DA EMPRESA

     Neste momento buscamos no localStorage.

     Depois vamos trocar isso pela configuração
     retornada pelo backend da empresa.
  ========================================================= */

  useEffect(() => {
    try {
      const salva =
        localStorage.getItem(
          "identidade_empresa"
        );

      if (!salva) {
        return;
      }

      const dados = JSON.parse(salva);

      setIdentidade({
        nome:
          dados.nome ||
          dados.nome_fantasia ||
          usuario?.empresa_nome ||
          "Hotel San Marinho",

        logo:
          dados.logo_url ||
          logoPadrao,

        fundo:
          dados.dashboard_background_url ||
          dados.fundo_url ||
          fundoPadrao,

        corPrimaria:
          dados.cor_primaria ||
          "#0d6efd",

        corSecundaria:
          dados.cor_secundaria ||
          "#084298",
      });
    } catch (error) {
      console.error(
        "Erro ao carregar identidade visual:",
        error
      );
    }
  }, [usuario]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = () => {
    localStorage.removeItem("token");

    localStorage.removeItem("usuario");

    localStorage.removeItem(
      "identidade_empresa"
    );

    navigate("/login", {
      replace: true,
    });
  };

  /* =========================================================
     MENU
  ========================================================= */

  const toggleMenu = () => {
    setOpen((estadoAtual) => !estadoAtual);
  };

  const closeOnClick = () => {
    setOpen(false);
  };

  /* =========================================================
     VARIÁVEIS DE TEMA
  ========================================================= */

  const estiloTema = {
    "--empresa-cor-primaria":
      identidade.corPrimaria,

    "--empresa-cor-secundaria":
      identidade.corSecundaria,

    "--empresa-dashboard-background":
      `url("${identidade.fundo}")`,
  };

  /* =========================================================
     JSX
  ========================================================= */

  return (
    <div
      className={`dashContainer ${
        open ? "menu-open" : ""
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
        {open ? "←" : "☰"}
      </button>

      {/* =====================================================
          FUNDO ESCURO MOBILE / MENU ABERTO
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
        className={`dashSidebar ${
          open ? "show" : ""
        }`}
      >
        {/* ===================================================
            LOGO
        =================================================== */}

        <div className="sidebarHeader">
          <img
            src={identidade.logo}
            className="sidebarLogo"
            alt={identidade.nome}
          />

          <div className="sidebarEmpresa">
            {isSuperAdmin
              ? "Super Administrador"
              : usuario?.empresa_nome ||
                identidade.nome}
          </div>

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
              Administração
            </div>

            <NavLink
              to="/app/empresas"
              className="dashLink"
              onClick={closeOnClick}
            >
              Empresas
            </NavLink>

            <NavLink
              to="/app/criar-admin-empresa"
              className="dashLink"
              onClick={closeOnClick}
            >
              Administradores
            </NavLink>

            <NavLink
              to="/app/configuracao-empresa"
              className="dashLink"
              onClick={closeOnClick}
            >
              Identidade Visual
            </NavLink>
          </nav>
        )}

        {/* ===================================================
            MENU ADMIN DA EMPRESA

            Também aparece como fallback enquanto estamos
            migrando o sistema antigo.
        =================================================== */}

        {(isAdminEmpresa ||
          (!isSuperAdmin && !usuario)) && (
          <nav className="dashMenu">
            <div className="menuSectionTitle">
              Funcionários
            </div>

            <NavLink
              to="/app/registrar-funcionario"
              className="dashLink"
              onClick={closeOnClick}
            >
              Cadastrar Funcionário
            </NavLink>

            <NavLink
              to="/app/funcionarios"
              className="dashLink"
              onClick={closeOnClick}
            >
              Ver Funcionários
            </NavLink>

            <NavLink
              to="/app/admins"
              className="dashLink"
              onClick={closeOnClick}
            >
              Administradores
            </NavLink>

            <div className="menuSectionTitle">
              Controle de Ponto
            </div>

            <NavLink
              to="/app/relatorio"
              className="dashLink"
              onClick={closeOnClick}
            >
              Relatório
            </NavLink>

            <NavLink
              to="/app/manual"
              className="dashLink"
              onClick={closeOnClick}
            >
              Inserir Ponto Manual
            </NavLink>

            <NavLink
              to="/app/atestado"
              className="dashLink"
              onClick={closeOnClick}
            >
              Anexar Atestado
            </NavLink>

            <NavLink
              to="/app/bancoHoras"
              className="dashLink"
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