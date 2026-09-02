import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  useEffect,
} from "react";

import AcessoEmpresa from "./pages/AcessoEmpresa";

import {
  sincronizarPontosOffline,
} from "./services/sincronizacaoOffline";

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
import LogsSistema from "./pages/LogsSistema";

/* =========================================================
   LAYOUT
========================================================= */

import DashboardLayout from "./layouts/DashboardLayout";

/* =========================================================
   SINCRONIZAÇÃO OFFLINE GLOBAL

   Esse componente fica ativo enquanto o sistema estiver
   aberto.

   Ele tenta sincronizar:

   1. Quando o sistema é carregado
   2. Quando a internet volta
   3. A cada 30 segundos enquanto estiver online

   Dessa forma, não é necessário entrar novamente na tela
   "Escolher Batida" para enviar os pontos pendentes.
========================================================= */

function SincronizadorOfflineGlobal() {
  useEffect(() => {
    let ativo =
      true;

    /* =====================================================
       EXECUTAR SINCRONIZAÇÃO
    ===================================================== */

    async function tentarSincronizar() {
      if (!ativo) {
        return;
      }

      /*
        navigator.onLine é apenas uma indicação.

        A confirmação real de conexão continua sendo feita
        pela requisição ao backend dentro de
        sincronizarPontosOffline().
      */

      if (!navigator.onLine) {
        return;
      }

      /*
        Só tentamos sincronizar se existir uma sessão.

        A rota do backend utiliza o JWT para identificar
        e autorizar a empresa do terminal.
      */

      const token =
        localStorage.getItem(
          "token"
        );

      const usuario =
        getUsuario();

      if (
        !token ||
        !usuario
      ) {
        return;
      }

      /*
        A fila de pontos offline pertence ao terminal
        de ponto.

        Portanto, somente o login ponto_empresa deve
        tentar enviar essas batidas automaticamente.
      */

      if (
        usuario.role !==
        "ponto_empresa"
      ) {
        return;
      }

      try {
        const resultado =
          await sincronizarPontosOffline();

        if (!ativo) {
          return;
        }

        if (
          resultado?.ok &&
          Number(
            resultado?.sincronizados ||
            0
          ) > 0
        ) {
          console.log(
            "✅ Pontos offline sincronizados:",
            resultado
          );
        }
      } catch (error) {
        /*
          Não interrompemos o sistema se a sincronização
          falhar.

          As batidas continuam no IndexedDB e uma nova
          tentativa acontecerá depois.
        */

        console.warn(
          "⚠️ Sincronização automática não concluída:",
          error
        );
      }
    }

    /* =====================================================
       INTERNET VOLTOU
    ===================================================== */

    function aoVoltarInternet() {
      console.log(
        "🌐 Internet detectada. Tentando sincronizar pontos..."
      );

      tentarSincronizar();
    }

    /* =====================================================
       INTERNET CAIU
    ===================================================== */

    function aoFicarOffline() {
      console.log(
        "📴 Terminal sem internet. Pontos permanecerão locais."
      );
    }

    /* =====================================================
       TENTATIVA AO INICIAR O SISTEMA

       Pequeno atraso para permitir que localStorage,
       aplicação e demais componentes terminem de iniciar.
    ===================================================== */

    const timeoutInicial =
      window.setTimeout(
        () => {
          tentarSincronizar();
        },
        1500
      );

    /* =====================================================
       EVENTOS DO NAVEGADOR
    ===================================================== */

    window.addEventListener(
      "online",
      aoVoltarInternet
    );

    window.addEventListener(
      "offline",
      aoFicarOffline
    );

    /* =====================================================
       VERIFICAÇÃO PERIÓDICA

       Serve como segurança caso o evento "online" não seja
       disparado corretamente pelo sistema operacional ou
       navegador.

       O próprio sincronizacaoOffline.js impede duas
       sincronizações simultâneas.
    ===================================================== */

    const intervalo =
      window.setInterval(
        () => {
          tentarSincronizar();
        },
        30000
      );

    /* =====================================================
       LIMPEZA
    ===================================================== */

    return () => {
      ativo =
        false;

      window.clearTimeout(
        timeoutInicial
      );

      window.clearInterval(
        intervalo
      );

      window.removeEventListener(
        "online",
        aoVoltarInternet
      );

      window.removeEventListener(
        "offline",
        aoFicarOffline
      );
    };
  }, []);

  /*
    Não existe interface visual.

    O componente trabalha somente em segundo plano
    enquanto o React estiver aberto.
  */

  return null;
}

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
========================================================= */

function PrivateRoute({
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

      {/* ===================================================
          SINCRONIZAÇÃO GLOBAL DE PONTOS OFFLINE

          Fica fora das Routes para continuar montado
          durante toda a navegação do sistema.
      =================================================== */}

      <SincronizadorOfflineGlobal />

      <Routes>

        {/* =================================================
            LOGIN PRINCIPAL
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
              SUPER ADMIN - LOGS DO SISTEMA
          =============================================== */}

          <Route
            path="logs"
            element={
              <SuperAdminRoute>
                <LogsSistema />
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