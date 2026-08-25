import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AcessoEmpresa from "./pages/AcessoEmpresa";

/* =========================================================
   PONTO
========================================================= */

import Home from "./pages/Home";
import Reconhecimento from "./pages/Reconhecimento";
import EscolherBatida from "./pages/EscolherBatida";
import BuscarPontos from "./pages/BuscarPontos";
import ResultadoPontos from "./pages/ResultadoPontos";
import VincularCPF from "./pages/VincularCPF";

/* =========================================================
   FUNCIONÁRIOS
========================================================= */

import CadastrarRosto from "./pages/CadastrarRosto";
import RegistrarFuncionario from "./pages/RegistrarFuncionario";
import ListarFuncionarios from "./pages/ListarFuncionarios";

/* =========================================================
   RH / ADMINISTRAÇÃO
========================================================= */

import RelatorioFuncionario from "./pages/RelatorioFuncionario";
import InserirPontoManual from "./pages/InserirPontoManual";
import CadastrarAtestado from "./pages/CadastrarAtestado";
import BancoHoras from "./pages/BancoHoras";

/* =========================================================
   SUPER ADMIN
========================================================= */

import Empresas from "./pages/Empresas";
import AcessosEmpresas from "./pages/AcessosEmpresas";

/* =========================================================
   LAYOUT
========================================================= */

import DashboardLayout from "./layouts/DashboardLayout";

/* =========================================================
   BUSCAR USUÁRIO LOGADO
========================================================= */

function getUsuario() {
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
}

/* =========================================================
   LIMPAR SESSÃO
========================================================= */

function limparSessao() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("role");
  localStorage.removeItem("empresa_id");
  localStorage.removeItem("empresa_nome");
  localStorage.removeItem("identidade_empresa");
}

/* =========================================================
   ROTA PRIVADA

   Permite:
   - super_admin
   - rh_empresa
   - ponto_empresa

   As rotas específicas abaixo controlam
   exatamente onde cada usuário pode entrar.
========================================================= */

function PrivateRoute({ children }) {
  const token =
    localStorage.getItem("token");

  const usuario =
    getUsuario();

  if (!token || !usuario) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   SOMENTE SUPER ADMIN
========================================================= */

function SuperAdminRoute({
  children,
}) {
  const token =
    localStorage.getItem("token");

  const usuario =
    getUsuario();

  if (!token || !usuario) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    usuario.role !==
    "super_admin"
  ) {
    if (
      usuario.role ===
      "rh_empresa"
    ) {
      return (
        <Navigate
          to="/app"
          replace
        />
      );
    }

    if (
      usuario.role ===
      "ponto_empresa"
    ) {
      return (
        <Navigate
          to="/ponto"
          replace
        />
      );
    }

    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   SOMENTE RH
========================================================= */

function RHRoute({
  children,
}) {
  const token =
    localStorage.getItem("token");

  const usuario =
    getUsuario();

  if (!token || !usuario) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     SE NÃO FOR RH
  ======================================================= */

  if (
    usuario.role !==
    "rh_empresa"
  ) {
    /* -----------------------------------------------------
       LOGIN DO PONTO
    ----------------------------------------------------- */

    if (
      usuario.role ===
      "ponto_empresa"
    ) {
      return (
        <Navigate
          to="/ponto"
          replace
        />
      );
    }

    /* -----------------------------------------------------
       SUPER ADMIN
    ----------------------------------------------------- */

    if (
      usuario.role ===
      "super_admin"
    ) {
      return (
        <Navigate
          to="/app/empresas"
          replace
        />
      );
    }

    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     RH PRECISA TER EMPRESA
  ======================================================= */

  if (!usuario.empresa_id) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   SOMENTE LOGIN DE PONTO
========================================================= */

function PontoRoute({
  children,
}) {
  const token =
    localStorage.getItem("token");

  const usuario =
    getUsuario();

  if (!token || !usuario) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     SOMENTE ponto_empresa
  ======================================================= */

  if (
    usuario.role !==
    "ponto_empresa"
  ) {
    /* -----------------------------------------------------
       RH
    ----------------------------------------------------- */

    if (
      usuario.role ===
      "rh_empresa"
    ) {
      return (
        <Navigate
          to="/app"
          replace
        />
      );
    }

    /* -----------------------------------------------------
       SUPER ADMIN
    ----------------------------------------------------- */

    if (
      usuario.role ===
      "super_admin"
    ) {
      return (
        <Navigate
          to="/app/empresas"
          replace
        />
      );
    }

    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     PONTO PRECISA TER EMPRESA
  ======================================================= */

  if (!usuario.empresa_id) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   REDIRECIONAMENTO AUTOMÁTICO

   Decide para onde cada login vai.
========================================================= */

function RedirecionarApp() {
  const token =
    localStorage.getItem("token");

  const usuario =
    getUsuario();

  if (!token || !usuario) {
    limparSessao();

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  /* =======================================================
     SUPER ADMIN
  ======================================================= */

  if (
    usuario.role ===
    "super_admin"
  ) {
    return (
      <Navigate
        to="/app/empresas"
        replace
      />
    );
  }

  /* =======================================================
     RH
  ======================================================= */

  if (
    usuario.role ===
    "rh_empresa"
  ) {
    if (!usuario.empresa_id) {
      limparSessao();

      return (
        <Navigate
          to="/"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/app/registrar-funcionario"
        replace
      />
    );
  }

  /* =======================================================
     PONTO
  ======================================================= */

  if (
    usuario.role ===
    "ponto_empresa"
  ) {
    if (!usuario.empresa_id) {
      limparSessao();

      return (
        <Navigate
          to="/"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/ponto"
        replace
      />
    );
  }

  /* =======================================================
     ROLE INVÁLIDA
  ======================================================= */

  limparSessao();

  return (
    <Navigate
      to="/"
      replace
    />
  );
}

/* =========================================================
   ROUTER PRINCIPAL
========================================================= */

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =================================================
            LOGIN PRINCIPAL

            Login único para:
            - super_admin
            - rh_empresa
            - ponto_empresa
        ================================================= */}

        <Route
          path="/"
          element={
            <AcessoEmpresa />
          }
        />

        {/* =================================================
            TERMINAL DE PONTO
        ================================================= */}

        <Route
          path="/ponto"
          element={
            <PontoRoute>
              <Home />
            </PontoRoute>
          }
        />

        {/* =================================================
            RECONHECIMENTO FACIAL
        ================================================= */}

        <Route
          path="/reconhecimento"
          element={
            <PontoRoute>
              <Reconhecimento />
            </PontoRoute>
          }
        />

        {/* =================================================
            VINCULAR CPF / ROSTO
        ================================================= */}

        <Route
          path="/vincular-cpf"
          element={
            <PontoRoute>
              <VincularCPF />
            </PontoRoute>
          }
        />

        {/* =================================================
            ESCOLHER BATIDA
        ================================================= */}

        <Route
          path="/escolher-batida"
          element={
            <PontoRoute>
              <EscolherBatida />
            </PontoRoute>
          }
        />

        {/* =================================================
            CONSULTAR PONTOS
        ================================================= */}

        <Route
          path="/buscar-pontos"
          element={
            <PontoRoute>
              <BuscarPontos />
            </PontoRoute>
          }
        />

        {/* =================================================
            RESULTADO DOS PONTOS
        ================================================= */}

        <Route
          path="/resultado-pontos"
          element={
            <PontoRoute>
              <ResultadoPontos />
            </PontoRoute>
          }
        />

        {/* =================================================
            DASHBOARD

            Aqui entram:
            - super_admin
            - rh_empresa

            ponto_empresa não usa dashboard.
        ================================================= */}

        <Route
          path="/app"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >

          {/* ===============================================
              REDIRECIONAMENTO INICIAL
          =============================================== */}

          <Route
            index
            element={
              <RedirecionarApp />
            }
          />

          {/* ===============================================
              SUPER ADMIN - EMPRESAS
          =============================================== */}

          <Route
            path="empresas"
            element={
              <SuperAdminRoute>
                <Empresas />
              </SuperAdminRoute>
            }
          />

          {/* ===============================================
              SUPER ADMIN - ACESSOS DAS EMPRESAS
          =============================================== */}

          <Route
            path="acessos"
            element={
              <SuperAdminRoute>
                <AcessosEmpresas />
              </SuperAdminRoute>
            }
          />

          {/* ===============================================
              RH - CADASTRAR FUNCIONÁRIO
          =============================================== */}

          <Route
            path="registrar-funcionario"
            element={
              <RHRoute>
                <RegistrarFuncionario />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - LISTAR FUNCIONÁRIOS
          =============================================== */}

          <Route
            path="funcionarios"
            element={
              <RHRoute>
                <ListarFuncionarios />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - CADASTRAR ROSTO
          =============================================== */}

          <Route
            path="cadastrar-rosto/:id"
            element={
              <RHRoute>
                <CadastrarRosto />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - RELATÓRIO
          =============================================== */}

          <Route
            path="relatorio"
            element={
              <RHRoute>
                <RelatorioFuncionario />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - PONTO MANUAL
          =============================================== */}

          <Route
            path="manual"
            element={
              <RHRoute>
                <InserirPontoManual />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - ATESTADO
          =============================================== */}

          <Route
            path="atestado"
            element={
              <RHRoute>
                <CadastrarAtestado />
              </RHRoute>
            }
          />

          {/* ===============================================
              RH - BANCO DE HORAS
          =============================================== */}

          <Route
            path="bancoHoras"
            element={
              <RHRoute>
                <BancoHoras />
              </RHRoute>
            }
          />

        </Route>

        {/* =================================================
            ROTA INVÁLIDA
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}