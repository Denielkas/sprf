import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

import {
  api,
} from "../../services/api";

import "./listarAdmins.css";


export default function ListarAdmins() {

  /* =========================================================
     ESTADOS
  ========================================================= */

  const [
    lista,
    setLista,
  ] = useState([]);

  const [
    msg,
    setMsg,
  ] = useState("");

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    excluindo,
    setExcluindo,
  ] = useState(false);


  /* =========================================================
     FORMULÁRIO
  ========================================================= */

  const [
    form,
    setForm,
  ] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });


  /* =========================================================
     MOSTRAR / ESCONDER SENHAS
  ========================================================= */

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  /* =========================================================
     CARREGAR ADMINISTRADORES
  ========================================================= */

  async function carregar() {

    setMsg(
      "Carregando..."
    );

    try {

      const response =
        await api.get(
          "/auth/admins"
        );


      const dados =
        response.data;


      if (
        Array.isArray(dados)
      ) {

        setLista(
          dados
        );

      } else if (
        Array.isArray(
          dados?.admins
        )
      ) {

        setLista(
          dados.admins
        );

      } else {

        setLista(
          []
        );

      }


      setMsg("");

    } catch (error) {

      console.error(
        "Erro ao carregar administradores:",
        error
      );


      setLista(
        []
      );


      setMsg(
        error.response?.data?.error ||
        error.response?.data?.erro ||
        "Erro ao carregar administradores."
      );

    }

  }


  /* =========================================================
     CARREGAR AO ABRIR
  ========================================================= */

  useEffect(() => {

    carregar();

  }, []);


  /* =========================================================
     TOTAL
  ========================================================= */

  const total =
    useMemo(
      () => lista.length,
      [lista]
    );


  /* =========================================================
     ABRIR MODAL
  ========================================================= */

  function abrirModal(admin) {

    setEditing(
      admin
    );


    setForm({
      username:
        admin.username || "",

      password: "",

      confirmPassword: "",
    });


    setShowPassword(
      false
    );

    setShowConfirmPassword(
      false
    );

    setOpen(
      true
    );

  }


  /* =========================================================
     FECHAR MODAL
  ========================================================= */

  function fecharModal() {

    if (
      saving ||
      excluindo
    ) {
      return;
    }


    setOpen(
      false
    );

    setEditing(
      null
    );


    setForm({
      username: "",
      password: "",
      confirmPassword: "",
    });


    setShowPassword(
      false
    );

    setShowConfirmPassword(
      false
    );

  }


  /* =========================================================
     ALTERAÇÃO DOS CAMPOS
  ========================================================= */

  function onChange(event) {

    const {
      name,
      value,
    } = event.target;


    setForm(
      (anterior) => ({
        ...anterior,

        [name]:
          value,
      })
    );

  }


  /* =========================================================
     SALVAR NOVA SENHA
  ========================================================= */

  async function salvarAlteracoes() {

    if (
      !editing
    ) {
      return;
    }


    /* =======================================================
       VALIDAR SENHA
    ======================================================= */

    if (
      !form.password ||
      !form.confirmPassword
    ) {

      alert(
        "Preencha a nova senha e a confirmação."
      );

      return;

    }


    if (
      form.password !==
      form.confirmPassword
    ) {

      alert(
        "As senhas não coincidem."
      );

      return;

    }


    if (
      form.password.length < 4
    ) {

      alert(
        "A senha deve ter pelo menos 4 caracteres."
      );

      return;

    }


    setSaving(
      true
    );


    try {

      await api.put(
        `/auth/admins/${editing.id}/password`,
        {
          password:
            form.password,
        }
      );


      /*
        Atualiza a lista local.

        O username não está sendo alterado no backend,
        então mantemos o username atual.
      */

      setLista(
        (anterior) =>
          anterior.map(
            (item) =>
              item.id === editing.id
                ? {
                    ...item,
                    username:
                      editing.username,
                  }
                : item
          )
      );


      setOpen(
        false
      );

      setEditing(
        null
      );


      setForm({
        username: "",
        password: "",
        confirmPassword: "",
      });


      alert(
        "Senha alterada com sucesso."
      );


    } catch (error) {

      console.error(
        "Erro ao alterar senha:",
        error
      );


      alert(
        error.response?.data?.error ||
        error.response?.data?.erro ||
        "Erro ao alterar senha."
      );


    } finally {

      setSaving(
        false
      );

    }

  }


  /* =========================================================
     EXCLUIR ADMINISTRADOR
  ========================================================= */

  async function excluirAdmin(id) {

    if (
      !id
    ) {
      return;
    }


    const nomeAdmin =
      editing?.username ||
      "este administrador";


    const confirmar =
      window.confirm(
        `Tem certeza que deseja excluir o administrador "${nomeAdmin}"?\n\nEsta ação não poderá ser desfeita.`
      );


    if (
      !confirmar
    ) {
      return;
    }


    setExcluindo(
      true
    );


    try {

      await api.delete(
        `/auth/admins/${id}`
      );


      /*
        Remove da tabela sem precisar atualizar
        a página inteira.
      */

      setLista(
        (anterior) =>
          anterior.filter(
            (item) =>
              item.id !== id
          )
      );


      setOpen(
        false
      );

      setEditing(
        null
      );


      setForm({
        username: "",
        password: "",
        confirmPassword: "",
      });


      alert(
        "Administrador excluído com sucesso."
      );


    } catch (error) {

      console.error(
        "Erro ao excluir administrador:",
        error
      );


      alert(
        error.response?.data?.error ||
        error.response?.data?.erro ||
        "Erro ao excluir administrador."
      );


    } finally {

      setExcluindo(
        false
      );

    }

  }


  /* =========================================================
     JSX
  ========================================================= */

  return (

    <div className="adminPage">

      {/* =====================================================
          TÍTULO
      ===================================================== */}

      <h2>
        Administradores cadastrados
      </h2>


      {/* =====================================================
          AÇÕES
      ===================================================== */}

      <div className="adminActions">

        <button
          type="button"
          className="btnPrimary"
          onClick={carregar}
        >
          Atualizar
        </button>


        <span className="total">
          Total: {total}
        </span>

      </div>


      {/* =====================================================
          MENSAGEM
      ===================================================== */}

      {msg && (

        <div className="adminMsg">
          {msg}
        </div>

      )}


      {/* =====================================================
          TABELA
      ===================================================== */}

      <div className="tableWrap">

        <table className="adminTable">

          <thead>

            <tr>

              <th>
                ID
              </th>

              <th>
                Usuário
              </th>

              <th>
                Criado em
              </th>

              <th>
                Ações
              </th>

            </tr>

          </thead>


          <tbody>

            {lista.length > 0 ? (

              lista.map(
                (admin) => (

                  <tr
                    key={
                      admin.id
                    }
                  >

                    <td>
                      {admin.id}
                    </td>


                    <td>
                      {admin.username}
                    </td>


                    <td>

                      {admin.created_at
                        ? new Date(
                            admin.created_at
                          ).toLocaleString(
                            "pt-BR"
                          )
                        : "—"}

                    </td>


                    <td>

                      <button
                        type="button"
                        className="btnSecondary"
                        onClick={() =>
                          abrirModal(
                            admin
                          )
                        }
                      >
                        Alterar Senha
                      </button>

                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td
                  colSpan="4"
                  className="emptyRow"
                >
                  Nenhum administrador encontrado.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      {/* =====================================================
          MODAL
      ===================================================== */}

      {open && editing && (

        <div
          className="modal-overlay"
          onClick={
            fecharModal
          }
        >

          <div
            className="modal-card"
            onClick={
              (event) =>
                event.stopPropagation()
            }
          >

            {/* =================================================
                TÍTULO
            ================================================= */}

            <h3>
              Alterar senha do administrador
            </h3>


            {/* =================================================
                CAMPOS
            ================================================= */}

            <div className="modal-grid">

              {/* USUÁRIO */}

              <div>

                <label>
                  Usuário
                </label>


                <input
                  name="username"
                  value={
                    form.username
                  }
                  disabled
                />

              </div>


              <div></div>


              {/* NOVA SENHA */}

              <div className="passwordField">

                <label>
                  Nova senha
                </label>


                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  value={
                    form.password
                  }
                  onChange={
                    onChange
                  }
                  placeholder="Digite a nova senha"
                  autoComplete="new-password"
                />


                <button
                  type="button"
                  className="eyeButton"
                  onClick={() =>
                    setShowPassword(
                      (valor) =>
                        !valor
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >

                  {showPassword
                    ? <FaEyeSlash />
                    : <FaEye />}

                </button>

              </div>


              {/* CONFIRMAR SENHA */}

              <div className="passwordField">

                <label>
                  Confirmar senha
                </label>


                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  value={
                    form.confirmPassword
                  }
                  onChange={
                    onChange
                  }
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />


                <button
                  type="button"
                  className="eyeButton"
                  onClick={() =>
                    setShowConfirmPassword(
                      (valor) =>
                        !valor
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação"
                      : "Mostrar confirmação"
                  }
                >

                  {showConfirmPassword
                    ? <FaEyeSlash />
                    : <FaEye />}

                </button>

              </div>

            </div>


            {/* =================================================
                EXCLUIR ADMIN
            ================================================= */}

            <button
              type="button"
              className="btn-excluir-admin"
              onClick={() =>
                excluirAdmin(
                  editing.id
                )
              }
              disabled={
                saving ||
                excluindo
              }
            >

              {excluindo
                ? "Excluindo..."
                : "Excluir ADM"}

            </button>


            {/* =================================================
                AÇÕES
            ================================================= */}

            <div className="modal-actions">

              <button
                type="button"
                className="modal-btn-light"
                onClick={
                  fecharModal
                }
                disabled={
                  saving ||
                  excluindo
                }
              >
                Cancelar
              </button>


              <button
                type="button"
                className="modal-btn-primary"
                onClick={
                  salvarAlteracoes
                }
                disabled={
                  saving ||
                  excluindo
                }
              >

                {saving
                  ? "Salvando..."
                  : "Salvar nova senha"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}