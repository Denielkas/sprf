import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

/* =========================================================
   LOGIN INICIAL / IDENTIFICAÇÃO DA EMPRESA
========================================================= */

import AcessoEmpresa from "./pages/AcessoEmpresa";

/* =========================================================
   LOGIN ADMINISTRATIVO
========================================================= */

import Login from "./pages/Login";
import Register from "./pages/Register";

/* =========================================================
   PONTO
========================================================= */

import Home from "./pages/Home";
import Reconhecimento from "./pages/Reconhecimento";
import EscolherBatida from "./pages/EscolherBatida";
import BuscarPontos from "./pages/BuscarPontos";
import ResultadoPontos from "./pages/ResultadoPontos";

/* =========================================================
   FUNCIONÁRIOS
========================================================= */

import CadastrarRosto from "./pages/CadastrarRosto";
import RegistrarFuncionario from "./pages/RegistrarFuncionario";
import ListarFuncionarios from "./pages/ListarFuncionarios";

/* =========================================================
   ADMINISTRAÇÃO
========================================================= */

import ListarAdmins from "./pages/ListarAdmins";
import RelatorioFuncionario from "./pages/RelatorioFuncionario";
import InserirPontoManual from "./pages/InserirPontoManual";
import CadastrarAtestado from "./pages/CadastrarAtestado";
import BancoHoras from "./pages/BancoHoras";

/* =========================================================
   SUPER ADMIN

   Essa página já existe.
========================================================= */

import Empresas from "./pages/Empresas";

/* =========================================================
   LAYOUT
========================================================= */

import DashboardLayout from "./layouts/DashboardLayout";

/* =========================================================
   ROTA PRIVADA
========================================================= */

function PrivateRoute({ children }) {
  const token =
    localStorage.getItem("token");

  if (!token) {
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
   ROTA SOMENTE SUPER ADMIN
========================================================= */

function SuperAdminRoute({
  children,
}) {
  const token =
    localStorage.getItem("token");

  if (!token) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  let usuario = null;

  try {
    const salvo =
      localStorage.getItem("usuario");

    if (salvo) {
      usuario =
        JSON.parse(salvo);
    }
  } catch (error) {
    console.error(
      "Erro ao carregar usuário:",
      error
    );
  }

  if (
    usuario?.role !==
    "super_admin"
  ) {
    return (
      <Navigate
        to="/app/registrar-funcionario"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   ROUTER
========================================================= */

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =================================================
            PRIMEIRA TELA DO SISTEMA

            LOGIN PARA IDENTIFICAR:
            - SAN MARINHO
            - MARANTO
            - SUPER ADMIN
        ================================================= */}

        <Route
          path="/"
          element={
            <AcessoEmpresa />
          }
        />

        {/* =================================================
            TELA DE BATER PONTO

            Depois do login inicial,
            o usuário da empresa cai aqui.
        ================================================= */}

        <Route
          path="/ponto"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />

        {/* =================================================
            LOGIN ADMINISTRATIVO

            Este é o login para entrar
            nos relatórios, funcionários,
            banco de horas etc.
        ================================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* =================================================
            CADASTRO ANTIGO DE ADMIN

            Vamos manter por enquanto.
        ================================================= */}

        <Route
          path="/register"
          element={<Register />}
        />

        {/* =================================================
            RECONHECIMENTO FACIAL
        ================================================= */}

        <Route
          path="/reconhecimento"
          element={
            <PrivateRoute>
              <Reconhecimento />
            </PrivateRoute>
          }
        />

        {/* =================================================
            ESCOLHER BATIDA
        ================================================= */}

        <Route
          path="/escolher-batida"
          element={
            <PrivateRoute>
              <EscolherBatida />
            </PrivateRoute>
          }
        />

        {/* =================================================
            CONSULTA DE PONTO
        ================================================= */}

        <Route
          path="/buscar-pontos"
          element={
            <PrivateRoute>
              <BuscarPontos />
            </PrivateRoute>
          }
        />

        <Route
          path="/resultado-pontos"
          element={
            <PrivateRoute>
              <ResultadoPontos />
            </PrivateRoute>
          }
        />

        {/* =================================================
            ÁREA ADMINISTRATIVA
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
              ROTA INICIAL DO /APP

              Decide conforme o usuário.
          =============================================== */}

          <Route
            index
            element={
              <RedirecionarApp />
            }
          />

          {/* ===============================================
              SUPER ADMIN
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
              ADMIN DA EMPRESA
          =============================================== */}

          <Route
            path="registrar-funcionario"
            element={
              <RegistrarFuncionario />
            }
          />

          <Route
            path="funcionarios"
            element={
              <ListarFuncionarios />
            }
          />

          <Route
            path="admins"
            element={
              <ListarAdmins />
            }
          />

          <Route
            path="cadastrar-rosto/:id"
            element={
              <CadastrarRosto />
            }
          />

          <Route
            path="relatorio"
            element={
              <RelatorioFuncionario />
            }
          />

          <Route
            path="manual"
            element={
              <InserirPontoManual />
            }
          />

          <Route
            path="atestado"
            element={
              <CadastrarAtestado />
            }
          />

          <Route
            path="bancoHoras"
            element={
              <BancoHoras />
            }
          />
        </Route>

        {/* =================================================
            QUALQUER ROTA INVÁLIDA
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

/* =========================================================
   REDIRECIONAMENTO DA ÁREA ADMINISTRATIVA
========================================================= */

function RedirecionarApp() {
  let usuario = null;

  try {
    const salvo =
      localStorage.getItem(
        "usuario"
      );

    if (salvo) {
      usuario =
        JSON.parse(salvo);
    }
  } catch (error) {
    console.error(
      "Erro ao ler usuário:",
      error
    );
  }

  /* SUPER ADMIN */

  if (
    usuario?.role ===
    "super_admin"
  ) {
    return (
      <Navigate
        to="/app/empresas"
        replace
      />
    );
  }

  /* ADMIN DA EMPRESA */

  return (
    <Navigate
      to="/app/registrar-funcionario"
      replace
    />
  );
}