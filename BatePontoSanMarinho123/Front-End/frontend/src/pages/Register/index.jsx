import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEye,
  FaEyeSlash,
  FaUserShield,
} from "react-icons/fa";
import { api } from "../../services/api";
import "./register.css";

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  /* =========================================
     CADASTRAR PRIMEIRO SUPER ADMIN
  ========================================= */

  const onSubmit = async (e) => {
    e.preventDefault();

    setErro(false);
    setMsg("");

    const usuarioLimpo = username.trim();

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (!usuarioLimpo) {
      setErro(true);
      setMsg("Informe o usuário.");
      return;
    }

    if (password.length < 6) {
      setErro(true);
      setMsg(
        "A senha deve possuir pelo menos 6 caracteres."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErro(true);
      setMsg("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setMsg("Criando Super Administrador...");

    try {
      const { data } = await api.post(
        "/auth/primeiro-super-admin",
        {
          username: usuarioLimpo,
          password,
        }
      );

      setErro(false);

      setMsg(
        data.message ||
          "Super Administrador criado com sucesso."
      );

      setUsername("");
      setPassword("");
      setConfirmPassword("");

      /* =========================================
         REDIRECIONAR PARA LOGIN
      ========================================= */

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1500);
    } catch (err) {
      console.error(
        "Erro ao criar Super Admin:",
        err
      );

      const mensagem =
        err.response?.data?.error ||
        err.message ||
        "Erro inesperado ao cadastrar.";

      setErro(true);
      setMsg(mensagem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registerScreen">
      <div className="registerCard">
        {/* =====================================
            CABEÇALHO
        ===================================== */}

        <div className="registerIcon">
          <FaUserShield />
        </div>

        <h2 className="registerTitle">
          Criar Super Administrador
        </h2>

        <p className="registerSubtitle">
          Configuração inicial do sistema
        </p>

        {/* =====================================
            FORMULÁRIO
        ===================================== */}

        <form
          className="registerForm"
          onSubmit={onSubmit}
        >
          {/* USUÁRIO */}

          <div className="registerFloatLabel">
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
              autoComplete="username"
              disabled={loading}
            />

            <label
              className={
                username ? "filled" : ""
              }
            >
              Usuário
            </label>
          </div>

          {/* SENHA */}

          <div className="registerFloatLabel registerPasswordWrapper">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              minLength={6}
              autoComplete="new-password"
              disabled={loading}
            />

            <label
              className={
                password ? "filled" : ""
              }
            >
              Senha
            </label>

            <button
              type="button"
              className="registerEyeButton"
              onClick={() =>
                setShowPassword(
                  (old) => !old
                )
              }
              disabled={loading}
              aria-label={
                showPassword
                  ? "Ocultar senha"
                  : "Mostrar senha"
              }
            >
              {showPassword ? (
                <FaEyeSlash />
              ) : (
                <FaEye />
              )}
            </button>
          </div>

          {/* CONFIRMAR SENHA */}

          <div className="registerFloatLabel registerPasswordWrapper">
            <input
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              required
              minLength={6}
              autoComplete="new-password"
              disabled={loading}
            />

            <label
              className={
                confirmPassword
                  ? "filled"
                  : ""
              }
            >
              Confirmar senha
            </label>

            <button
              type="button"
              className="registerEyeButton"
              onClick={() =>
                setShowConfirmPassword(
                  (old) => !old
                )
              }
              disabled={loading}
              aria-label={
                showConfirmPassword
                  ? "Ocultar confirmação"
                  : "Mostrar confirmação"
              }
            >
              {showConfirmPassword ? (
                <FaEyeSlash />
              ) : (
                <FaEye />
              )}
            </button>
          </div>

          {/* CADASTRAR */}

          <button
            className="registerSubmitButton"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Cadastrando..."
              : "Criar Super Administrador"}
          </button>

          {/* VOLTAR */}

          <button
            className="registerBackButton"
            type="button"
            disabled={loading}
            onClick={() =>
              navigate("/login")
            }
          >
            Voltar para login
          </button>
        </form>

        {/* =====================================
            MENSAGEM
        ===================================== */}

        {msg && (
          <div
            className={`registerMsg ${
              erro
                ? "registerMsgErro"
                : "registerMsgSucesso"
            }`}
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}