import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    useNavigate,
} from "react-router-dom";

import {
    FaCheckCircle,
    FaTimesCircle,
} from "react-icons/fa";

import Select from "react-select";

import { api } from "../../services/api";

import "./RelatorioFuncionario.css";

export default function RelatorioFuncionario() {
    const navigate = useNavigate();

    /* =========================================================
       USUÁRIO LOGADO / EMPRESA LOGADA
    ========================================================= */

    const usuario = useMemo(() => {
        try {
            const salvo = localStorage.getItem("usuario");

            if (!salvo) {
                return null;
            }

            return JSON.parse(salvo);
        } catch (error) {
            console.error(
                "Erro ao carregar usuário do localStorage:",
                error
            );

            return null;
        }
    }, []);

    /* =========================================================
       DADOS DA EMPRESA DO USUÁRIO LOGADO
    ========================================================= */

    const empresaId =
        usuario?.empresa_id ||
        usuario?.empresa?.id ||
        null;

    const empresaNome =
        usuario?.empresa_nome ||
        usuario?.empresa?.nome ||
        "Empresa";

    const isRH =
        usuario?.role === "rh_empresa";

    /* =========================================================
       PROTEGER TELA
    ========================================================= */

    useEffect(() => {
        if (!usuario) {
            navigate("/", {
                replace: true,
            });

            return;
        }

        if (usuario.role === "ponto_empresa") {
            navigate("/ponto", {
                replace: true,
            });

            return;
        }

        if (usuario.role === "super_admin") {
            navigate("/app/empresas", {
                replace: true,
            });

            return;
        }

        if (!isRH) {
            navigate("/", {
                replace: true,
            });
        }
    }, [
        usuario,
        isRH,
        navigate,
    ]);

    /* =========================================================
       ANOS
    ========================================================= */

    const anoAtual =
        new Date().getFullYear();

    const anoInicial = 2025;

    const anos = Array.from(
        {
            length:
                anoAtual -
                anoInicial +
                1,
        },
        (_, i) =>
            String(anoAtual - i)
    );

    /* =========================================================
       ESTADOS
    ========================================================= */

    const [
        funcionarios,
        setFuncionarios,
    ] = useState([]);

    const [
        funcId,
        setFuncId,
    ] = useState("todos");

    const [
        dia,
        setDia,
    ] = useState("");

    const [
        mes,
        setMes,
    ] = useState("");

    const [
        ano,
        setAno,
    ] = useState(
        String(anoAtual)
    );

    const [
        dados,
        setDados,
    ] = useState([]);

    const [
        somaAtraso,
        setSomaAtraso,
    ] = useState("0h 0m");

    /* =========================================================
       MODAL EDIÇÃO
    ========================================================= */

    const [
        editOpen,
        setEditOpen,
    ] = useState(false);

    const [
        editData,
        setEditData,
    ] = useState({
        funcionario_id: "",

        // Empresa à qual o funcionário pertence.
        empresa_id: "",

        ids_originais: {},

        data: "",

        entrada: "",
        intervalo_inicio: "",
        intervalo_fim: "",
        saida: "",

        falta: false,
        folga: false,
        ferias: false,

        falta_justificada: false,
        justificativa_falta: "",

        feriado: false,
    });

    /* =========================================================
       ATESTADO
    ========================================================= */

    const [
        modalAtestado,
        setModalAtestado,
    ] = useState(false);

    const [
        arquivoAtestado,
        setArquivoAtestado,
    ] = useState("");

    /* =========================================================
       MODAL MENSAGEM
    ========================================================= */

    const [
        modalOpen,
        setModalOpen,
    ] = useState(false);

    const [
        modalTitulo,
        setModalTitulo,
    ] = useState("");

    const [
        modalTexto,
        setModalTexto,
    ] = useState("");

    const [
        modalErro,
        setModalErro,
    ] = useState(false);

    /* =========================================================
       LOADINGS
    ========================================================= */

    const [
        salvando,
        setSalvando,
    ] = useState(false);

    const [
        limpandoBatidas,
        setLimpandoBatidas,
    ] = useState(false);

    /* =========================================================
       LIMPAR VALOR
    ========================================================= */

    function limparValor(valor) {
        if (!valor) {
            return "";
        }

        if (
            valor === "--:--" ||
            valor === "--"
        ) {
            return "";
        }

        return valor;
    }

    /* =========================================================
       MODAL
    ========================================================= */

    const abrirModal = (
        titulo,
        texto,
        erro = false
    ) => {
        setModalTitulo(titulo);
        setModalTexto(texto);
        setModalErro(erro);
        setModalOpen(true);

        setTimeout(() => {
            setModalOpen(false);
        }, 1800);
    };

    /* =========================================================
       CARREGAR FUNCIONÁRIOS
    ========================================================= */

    useEffect(() => {
        if (isRH) {
            carregarFuncionarios();
        }
    }, [isRH]);

    async function carregarFuncionarios() {
        try {
            /*
             * NÃO selecionamos empresa manualmente.
             *
             * O backend deve identificar a empresa pelo
             * token do usuário autenticado.
             */

            const response =
                await api.get(
                    "/funcionarios"
                );

            const lista =
                Array.isArray(response.data)
                    ? response.data
                    : Array.isArray(response.data?.funcionarios)
                        ? response.data.funcionarios
                        : [];

            const ativos = lista
                .filter(
                    (funcionario) =>
                        funcionario.ativo !== false
                )
                .sort((a, b) =>
                    String(a.nome || "").localeCompare(
                        String(b.nome || ""),
                        "pt-BR"
                    )
                );

            setFuncionarios(ativos);
        } catch (err) {
            console.error(
                "Erro ao carregar funcionários:",
                err
            );

            abrirModal(
                "Erro",
                err?.response?.data?.error ||
                "Erro ao carregar funcionários.",
                true
            );
        }
    }

    /* =========================================================
       CALCULAR SALDO
    ========================================================= */

    function calcularSaldoTexto(
        resultado
    ) {
        const totalMinutos =
            resultado.reduce(
                (acc, r) => {
                    if (
                        r.folga ||
                        r.ferias ||
                        r.falta ||
                        r.feriado
                    ) {
                        return acc;
                    }

                    /*
                     * Atestado normal:
                     * não entra no saldo.
                     *
                     * Atestado para repor:
                     * entra normalmente.
                     */

                    if (
                        r.atestado &&
                        !r.atestado_repor_horas
                    ) {
                        return acc;
                    }

                    const saldo =
                        Number(
                            r.saldo_bruto
                        ) || 0;

                    /*
                     * Regra dos 15 minutos.
                     */

                    if (
                        saldo > 0 &&
                        saldo <= 15
                    ) {
                        return acc;
                    }

                    return acc + saldo;
                },
                0
            );

        const sinal =
            totalMinutos < 0
                ? "-"
                : "+";

        const absMin =
            Math.abs(totalMinutos);

        return `${sinal}${Math.floor(
            absMin / 60
        )}h ${absMin % 60}m`;
    }

    /* =========================================================
       BUSCAR RELATÓRIO
    ========================================================= */

    async function buscar() {
        if (
            !funcId ||
            !mes ||
            !ano
        ) {
            abrirModal(
                "Atenção",
                "Selecione funcionário, mês e ano.",
                true
            );

            return;
        }

        try {
            let response;

            /*
             * IMPORTANTE:
             *
             * Não mandamos empresa_id.
             *
             * O backend deve pegar a empresa através
             * do usuário/token autenticado.
             */

            if (
                funcId === "todos"
            ) {
                response =
                    await api.get(
                        `/relatorio/todos?mes=${mes}&ano=${ano}`
                    );
            } else {
                response =
                    await api.get(
                        `/relatorio/${funcId}?mes=${mes}&ano=${ano}`
                    );
            }

            let resultado = [];

            if (
                Array.isArray(
                    response.data
                )
            ) {
                resultado =
                    response.data;
            } else if (
                Array.isArray(
                    response.data?.relatorios
                )
            ) {
                resultado =
                    response.data.relatorios.flatMap(
                        (item) =>
                            Array.isArray(
                                item?.dados
                            )
                                ? item.dados
                                : []
                    );
            } else if (
                Array.isArray(
                    response.data?.dados
                )
            ) {
                resultado =
                    response.data.dados;
            }

            /* =====================================================
               FILTRO POR DIA
            ===================================================== */

            if (dia !== "") {
                resultado =
                    resultado.filter(
                        (r) =>
                            r.data &&
                            Number(
                                r.data.split(
                                    "/"
                                )[0]
                            ) === Number(dia)
                    );
            }

            setDados(resultado);

            setSomaAtraso(
                calcularSaldoTexto(
                    resultado
                )
            );
        } catch (err) {
            console.error(
                "Erro ao buscar relatório:",
                err
            );

            console.error(
                "Resposta backend:",
                err?.response?.data
            );

            abrirModal(
                "Erro",
                err?.response?.data?.error ||
                "Erro ao buscar relatório.",
                true
            );
        }
    }

    /* =========================================================
       GERAR PDF
    ========================================================= */

    async function gerarPdf() {
        if (
            !funcId ||
            !mes ||
            !ano
        ) {
            abrirModal(
                "Atenção",
                "Selecione funcionário, mês e ano.",
                true
            );

            return;
        }

        try {
            /*
             * Empresa também NÃO é enviada.
             * Backend usa empresa do usuário logado.
             */

            const rota =
                funcId === "todos"
                    ? `/relatorio/pdf/todos?mes=${mes}&ano=${ano}`
                    : `/relatorio/pdf/${funcId}?mes=${mes}&ano=${ano}`;

            const response =
                await api.get(
                    rota,
                    {
                        responseType:
                            "blob",
                    }
                );

            if (
                response.data?.type &&
                !response.data.type.includes(
                    "pdf"
                )
            ) {
                const texto =
                    await response.data.text();

                console.error(
                    "Resposta inválida no PDF:",
                    texto
                );

                abrirModal(
                    "Erro",
                    "A API não retornou um PDF válido.",
                    true
                );

                return;
            }

            const blob =
                new Blob(
                    [response.data],
                    {
                        type:
                            "application/pdf",
                    }
                );

            const url =
                window.URL.createObjectURL(
                    blob
                );

            window.open(
                url,
                "_blank"
            );

            setTimeout(() => {
                window.URL.revokeObjectURL(
                    url
                );
            }, 60000);
        } catch (err) {
            console.error(
                "Erro ao gerar PDF:",
                err
            );

            abrirModal(
                "Erro",
                "Erro ao gerar PDF.",
                true
            );
        }
    }

    /* =========================================================
       GERAR EXCEL
    ========================================================= */

    async function gerarExcel() {
        if (
            !funcId ||
            !mes ||
            !ano
        ) {
            abrirModal(
                "Atenção",
                "Selecione funcionário, mês e ano.",
                true
            );

            return;
        }

        try {
            /*
             * Empresa também vem automaticamente
             * do usuário autenticado no backend.
             */

            const rota =
                funcId === "todos"
                    ? `/relatorio/excel/todos?mes=${mes}&ano=${ano}`
                    : `/relatorio/excel/${funcId}?mes=${mes}&ano=${ano}`;

            const response =
                await api.get(
                    rota,
                    {
                        responseType:
                            "blob",
                    }
                );

            const blob =
                new Blob(
                    [response.data],
                    {
                        type:
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    }
                );

            const url =
                window.URL.createObjectURL(
                    blob
                );

            const a =
                document.createElement(
                    "a"
                );

            a.href = url;

            a.download =
                funcId === "todos"
                    ? `relatorio_todos_${mes}_${ano}.xlsx`
                    : `relatorio_${funcId}_${mes}_${ano}.xlsx`;

            document.body.appendChild(
                a
            );

            a.click();

            a.remove();

            window.URL.revokeObjectURL(
                url
            );
        } catch (err) {
            console.error(
                "Erro ao gerar Excel:",
                err
            );

            abrirModal(
                "Erro",
                "Erro ao gerar Excel.",
                true
            );
        }
    }

    /* =========================================================
       ABRIR EDIÇÃO
    ========================================================= */

    function abrirEdicao(linha) {
        if (funcId === "todos") {
            abrirModal(
                "Atenção",
                "Para editar, selecione apenas 1 funcionário.",
                true
            );

            return;
        }

        /*
         * Primeiro tenta usar empresa_id que veio
         * diretamente da linha do relatório.
         *
         * Se por algum motivo não vier, usa empresaId
         * do usuário RH logado.
         */

        const empresaDaLinha =
            linha.empresa_id ||
            empresaId ||
            usuario?.empresa_id ||
            usuario?.empresa?.id ||
            null;

        console.log(
            "Abrindo edição:",
            {
                funcionario_id:
                    linha.funcionario_id,

                empresa_id:
                    empresaDaLinha,

                data:
                    linha.data,
            }
        );

        setEditData({
            funcionario_id:
                linha.funcionario_id,

            empresa_id:
                empresaDaLinha,

            ids_originais:
                linha.ids_originais ||
                {},

            data:
                linha.data,

            entrada:
                limparValor(
                    linha.entrada
                ),

            intervalo_inicio:
                limparValor(
                    linha.intervalo_inicio
                ),

            intervalo_fim:
                limparValor(
                    linha.intervalo_fim
                ),

            saida:
                limparValor(
                    linha.saida
                ),

            falta:
                !!linha.falta,

            folga:
                !!linha.folga,

            ferias:
                !!linha.ferias,

            falta_justificada:
                !!linha.falta_justificada,

            justificativa_falta:
                linha.justificativa_falta ||
                "",

            feriado:
                !!linha.feriado,
        });

        setEditOpen(true);
    }

    /* =========================================================
       AÇÕES DO DIA
    ========================================================= */

    function alternarAcao(
        campo,
        valor
    ) {
        if (
            campo === "feriado"
        ) {
            setEditData({
                ...editData,
                feriado: valor,
            });

            return;
        }

        setEditData({
            ...editData,

            falta:
                campo === "falta"
                    ? valor
                    : false,

            folga:
                campo === "folga"
                    ? valor
                    : false,

            ferias:
                campo === "ferias"
                    ? valor
                    : false,

            falta_justificada:
                campo ===
                    "falta_justificada"
                    ? valor
                    : false,

            justificativa_falta:
                campo ===
                    "falta_justificada"
                    ? editData.justificativa_falta
                    : "",
        });
    }

    /* =========================================================
       SALVAR ALTERAÇÃO
    ========================================================= */

    async function salvarAlteracao() {
        try {
            setSalvando(true);

            /* =====================================================
               IDENTIFICAR FUNCIONÁRIO
            ===================================================== */

            const funcionarioId =
                Number(
                    editData.funcionario_id ||
                    funcId
                );

            if (
                !Number.isInteger(
                    funcionarioId
                ) ||
                funcionarioId <= 0
            ) {
                abrirModal(
                    "Erro",
                    "Funcionário não informado.",
                    true
                );

                return;
            }

            /* =====================================================
               IDENTIFICAR EMPRESA
            ===================================================== */

            /*
             * Prioridade:
             *
             * 1 - empresa_id da linha do relatório
             * 2 - empresaId do usuário logado
             * 3 - usuario.empresa_id
             * 4 - usuario.empresa.id
             */

            const empresaIdAjuste =
                Number(
                    editData.empresa_id ||
                    empresaId ||
                    usuario?.empresa_id ||
                    usuario?.empresa?.id
                );

            if (
                !Number.isInteger(
                    empresaIdAjuste
                ) ||
                empresaIdAjuste <= 0
            ) {
                console.error(
                    "Empresa inválida ao ajustar ponto:",
                    {
                        editDataEmpresa:
                            editData.empresa_id,

                        empresaId,

                        usuarioEmpresaId:
                            usuario?.empresa_id,

                        usuarioEmpresa:
                            usuario?.empresa,
                    }
                );

                abrirModal(
                    "Erro",
                    "Empresa não informada.",
                    true
                );

                return;
            }

            /* =====================================================
               VERIFICAR DATA
            ===================================================== */

            if (!editData.data) {
                abrirModal(
                    "Erro",
                    "Data não informada.",
                    true
                );

                return;
            }

            /* =====================================================
               VERIFICAR BLOQUEIO DOS HORÁRIOS
            ===================================================== */

            const bloqueado =
                editData.falta ||
                editData.folga ||
                editData.ferias ||
                editData.falta_justificada;

            /* =====================================================
               MONTAR PAYLOAD
            ===================================================== */

            const payload = {
                funcionario_id:
                    funcionarioId,

                /*
                 * ESSA ERA A INFORMAÇÃO QUE ESTAVA FALTANDO.
                 */
                empresa_id:
                    empresaIdAjuste,

                data:
                    editData.data,

                ids_originais:
                    editData.ids_originais ||
                    {},

                entrada:
                    bloqueado
                        ? ""
                        : editData.entrada,

                intervalo:
                    bloqueado
                        ? ""
                        : editData.intervalo_inicio,

                retorno:
                    bloqueado
                        ? ""
                        : editData.intervalo_fim,

                saida:
                    bloqueado
                        ? ""
                        : editData.saida,

                falta:
                    Boolean(
                        editData.falta
                    ),

                folga:
                    Boolean(
                        editData.folga
                    ),

                ferias:
                    Boolean(
                        editData.ferias
                    ),

                falta_justificada:
                    Boolean(
                        editData.falta_justificada
                    ),

                justificativa_falta:
                    editData.justificativa_falta ||
                    "",

                feriado:
                    Boolean(
                        editData.feriado
                    ),
            };

            /* =====================================================
               DEBUG
        
               Pode deixar por enquanto.
               Assim conseguimos conferir no navegador exatamente
               o que está indo para o backend.
            ===================================================== */

            console.log(
                "PAYLOAD AJUSTAR PONTO:",
                payload
            );

            /* =====================================================
               SALVAR
            ===================================================== */

            await api.put(
                "/ponto/ajustar",
                payload
            );

            /* =====================================================
               SUCESSO
            ===================================================== */

            setEditOpen(false);

            abrirModal(
                "Registrado com sucesso!",
                "Horários atualizados com sucesso!"
            );

            await buscar();

        } catch (err) {
            console.error(
                "Erro ao salvar alteração:",
                err
            );

            console.error(
                "Resposta do backend:",
                err?.response?.data
            );

            abrirModal(
                "Erro",
                err?.response?.data?.error ||
                "Erro ao salvar alteração.",
                true
            );

        } finally {
            setSalvando(false);
        }
    }
    /* =========================================================
       LIMPAR BATIDAS
    ========================================================= */

    async function limparBatidasDoDia() {
    if (
        !editData.funcionario_id ||
        !editData.data
    ) {
        abrirModal(
            "Erro",
            "Funcionário ou data inválidos.",
            true
        );

        return;
    }

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaIdLimpeza =
        Number(
            editData.empresa_id ||
            empresaId ||
            usuario?.empresa_id ||
            usuario?.empresa?.id
        );

    if (
        !Number.isInteger(empresaIdLimpeza) ||
        empresaIdLimpeza <= 0
    ) {
        abrirModal(
            "Erro",
            "Empresa não informada.",
            true
        );

        return;
    }

    const confirmar =
        window.confirm(
            `Deseja realmente apagar TODAS as batidas do dia ${editData.data}?\n\nEssa ação não pode ser desfeita.`
        );

    if (!confirmar) {
        return;
    }

    try {
        setLimpandoBatidas(true);

        await api.delete(
            "/ponto/limpar-dia",
            {
                data: {
                    funcionario_id:
                        Number(
                            editData.funcionario_id
                        ),

                    empresa_id:
                        empresaIdLimpeza,

                    data:
                        editData.data,
                },
            }
        );

        setEditOpen(false);

        abrirModal(
            "Sucesso",
            "Batidas do dia removidas com sucesso!"
        );

        await buscar();

    } catch (err) {
        console.error(
            "Erro ao limpar batidas do dia:",
            err
        );

        console.error(
            "Resposta backend:",
            err?.response?.data
        );

        abrirModal(
            "Erro",
            err?.response?.data?.error ||
            "Erro ao limpar batidas do dia.",
            true
        );

    } finally {
        setLimpandoBatidas(false);
    }
}

    /* =========================================================
       REMOVER ATESTADO
    ========================================================= */

    async function removerAtestado(linha) {
    if (funcId === "todos") {
        abrirModal(
            "Atenção",
            "Para remover, selecione apenas 1 funcionário.",
            true
        );

        return;
    }

    const confirmar =
        window.confirm(
            `Deseja remover o atestado do dia ${linha.data}?`
        );

    if (!confirmar) {
        return;
    }

    /* =====================================================
       IDENTIFICAR EMPRESA
    ===================================================== */

    const empresaIdAtestado =
        Number(
            linha.empresa_id ||
            empresaId ||
            usuario?.empresa_id ||
            usuario?.empresa?.id
        );

    if (
        !Number.isInteger(empresaIdAtestado) ||
        empresaIdAtestado <= 0
    ) {
        abrirModal(
            "Erro",
            "Empresa não informada.",
            true
        );

        return;
    }

    try {
        await api.delete(
            "/atestado",
            {
                data: {
                    funcionario_id:
                        Number(linha.funcionario_id),

                    empresa_id:
                        empresaIdAtestado,

                    data:
                        linha.data,
                },
            }
        );

        abrirModal(
            "Sucesso",
            "Atestado removido com sucesso!"
        );

        await buscar();

    } catch (err) {
        console.error(
            "Erro ao remover atestado:",
            err
        );

        console.error(
            "Resposta backend:",
            err?.response?.data
        );

        abrirModal(
            "Erro",
            err?.response?.data?.error ||
            "Erro ao remover atestado.",
            true
        );
    }
}

    /* =========================================================
     ABRIR ATESTADO
  
     Agora o atestado é aberto pelo ID do registro,
     e não mais pelo nome físico do arquivo.
  ========================================================= */

    async function abrirAtestado(
        atestadoId
    ) {

        /* =======================================================
           VALIDAR ID
        ======================================================= */

        const id =
            Number(
                atestadoId
            );


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            console.error(
                "ID do atestado inválido:",
                atestadoId
            );


            abrirModal(
                "Erro",
                "Atestado não encontrado.",
                true
            );

            return;
        }


        try {

            /* =====================================================
               BUSCAR PDF
        
               O backend possui:
        
               GET /atestado/:id/arquivo
            ===================================================== */

            const response =
                await api.get(
                    `/atestado/${id}/arquivo`,
                    {
                        responseType:
                            "blob",
                    }
                );


            /* =====================================================
               VALIDAR RESPOSTA
            ===================================================== */

            if (
                !response.data ||
                response.data.size === 0
            ) {

                abrirModal(
                    "Erro",
                    "PDF do atestado vazio ou inválido.",
                    true
                );

                return;
            }


            /* =====================================================
               VERIFICAR CONTENT-TYPE
            ===================================================== */

            const contentType =
                response.headers?.[
                "content-type"
                ] ||
                response.data?.type ||
                "";


            if (
                contentType &&
                !String(contentType)
                    .toLowerCase()
                    .includes(
                        "application/pdf"
                    )
            ) {

                let texto = "";


                try {

                    texto =
                        await response.data.text();

                } catch (error) {

                    console.error(
                        "Não foi possível ler resposta:",
                        error
                    );

                }


                console.error(
                    "Resposta inválida ao abrir atestado:",
                    texto
                );


                abrirModal(
                    "Erro",
                    "A API não retornou um PDF válido.",
                    true
                );

                return;
            }


            /* =====================================================
               LIMPAR BLOB ANTERIOR
            ===================================================== */

            if (
                arquivoAtestado &&
                arquivoAtestado.startsWith(
                    "blob:"
                )
            ) {

                window.URL.revokeObjectURL(
                    arquivoAtestado
                );

            }


            /* =====================================================
               CRIAR BLOB DO PDF
            ===================================================== */

            const pdfBlob =
                new Blob(
                    [
                        response.data,
                    ],
                    {
                        type:
                            "application/pdf",
                    }
                );


            const blobUrl =
                window.URL.createObjectURL(
                    pdfBlob
                );


            /* =====================================================
               ABRIR MODAL
            ===================================================== */

            setArquivoAtestado(
                blobUrl
            );


            setModalAtestado(
                true
            );


        } catch (err) {

            console.error(
                "Erro ao abrir atestado:",
                err
            );


            console.error(
                "Resposta backend:",
                err?.response
            );


            /*
             * Como responseType é blob,
             * até uma mensagem JSON de erro pode chegar
             * como Blob. Vamos tentar lê-la.
             */

            let mensagem =
                "Erro ao abrir atestado.";


            try {

                const blobErro =
                    err?.response?.data;


                if (
                    blobErro instanceof Blob
                ) {

                    const texto =
                        await blobErro.text();


                    if (texto) {

                        try {

                            const json =
                                JSON.parse(
                                    texto
                                );


                            mensagem =
                                json.error ||
                                json.message ||
                                mensagem;

                        } catch {

                            console.error(
                                "Erro retornado:",
                                texto
                            );

                        }

                    }

                } else {

                    mensagem =
                        err?.response?.data?.error ||
                        err?.response?.data?.message ||
                        mensagem;

                }

            } catch (erroLeitura) {

                console.error(
                    "Erro ao interpretar resposta:",
                    erroLeitura
                );

            }


            abrirModal(
                "Erro",
                mensagem,
                true
            );

        }
    }
    /* =========================================================
       FECHAR ATESTADO
    ========================================================= */

    function fecharModalAtestado() {
        if (
            arquivoAtestado &&
            arquivoAtestado.startsWith(
                "blob:"
            )
        ) {
            window.URL.revokeObjectURL(
                arquivoAtestado
            );
        }

        setArquivoAtestado("");

        setModalAtestado(false);
    }

    /* =========================================================
       CAMPOS BLOQUEADOS
    ========================================================= */

    const camposBloqueados =
        editData.falta ||
        editData.folga ||
        editData.ferias ||
        editData.falta_justificada;

    /* =========================================================
       SELECT FUNCIONÁRIOS
    ========================================================= */

    const opcoesFuncionarios = [
        {
            value: "todos",
            label:
                "Todos os Funcionários",
        },

        ...funcionarios.map(
            (funcionario) => ({
                value:
                    String(
                        funcionario.id
                    ),

                label:
                    funcionario.nome,
            })
        ),
    ];

    /* =========================================================
       SEM PERMISSÃO
    ========================================================= */

    if (!isRH) {
        return null;
    }

    /* =========================================================
       JSX
    ========================================================= */

    return (
        <div className="relatorio-container">

            <h2 className="relatorio-titulo">
                Relatório de Frequência
            </h2>

            <div
                style={{
                    marginTop: "-14px",
                    marginBottom: "20px",
                    color: "var(--empresa-cor-primaria, #0d6efd)",
                    fontSize: "18px",
                    textAlign: "center",
                }}
            >
                {empresaNome}
            </div>

            {/* =====================================================
          FILTROS
      ===================================================== */}

            <div className="relatorio-filtros">

                <Select
                    className="relatorio-select-funcionario"
                    classNamePrefix="funcionario-select"
                    options={
                        opcoesFuncionarios
                    }
                    value={
                        opcoesFuncionarios.find(
                            (opcao) =>
                                opcao.value ===
                                String(funcId)
                        ) ||
                        opcoesFuncionarios[0]
                    }
                    onChange={(opcao) =>
                        setFuncId(
                            opcao
                                ? opcao.value
                                : "todos"
                        )
                    }
                    placeholder="Pesquisar funcionário..."
                    isSearchable
                    isClearable
                    noOptionsMessage={() =>
                        "Funcionário não encontrado"
                    }
                />

                <select
                    className="relatorio-select"
                    value={dia}
                    onChange={(e) =>
                        setDia(
                            e.target.value
                        )
                    }
                >
                    <option value="">
                        Dia (Opcional)
                    </option>

                    {Array.from({
                        length: 31,
                    }).map((_, i) => (
                        <option
                            key={i + 1}
                            value={i + 1}
                        >
                            {i + 1}
                        </option>
                    ))}
                </select>

                <select
                    className="relatorio-select"
                    value={mes}
                    onChange={(e) =>
                        setMes(
                            e.target.value
                        )
                    }
                >
                    <option value="">
                        Mês
                    </option>

                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                </select>

                <select
                    className="relatorio-select"
                    value={ano}
                    onChange={(e) =>
                        setAno(
                            e.target.value
                        )
                    }
                >
                    {anos.map(
                        (anoItem) => (
                            <option
                                key={anoItem}
                                value={anoItem}
                            >
                                {anoItem}
                            </option>
                        )
                    )}
                </select>

                <button
                    className="relatorio-btn btn-buscar"
                    onClick={buscar}
                >
                    Buscar Dados
                </button>

                <button
                    className="relatorio-btn btn-pdf"
                    onClick={gerarPdf}
                >
                    Gerar PDF
                </button>

                <button
                    className="relatorio-btn btn-excel"
                    onClick={gerarExcel}
                >
                    Gerar Excel
                </button>
            </div>

            {/* =====================================================
          SALDO
      ===================================================== */}

            {dados.length > 0 && (
                <div
                    className="resumo-total"
                    style={{
                        borderLeft:
                            `10px solid ${somaAtraso.startsWith("-")
                                ? "#e74c3c"
                                : "#2ecc71"
                            }`,
                    }}
                >
                    <span>
                        Saldo Acumulado no Período:
                    </span>

                    <strong
                        style={{
                            color:
                                somaAtraso.startsWith("-")
                                    ? "#e74c3c"
                                    : "#27ae60",
                        }}
                    >
                        {somaAtraso}
                    </strong>
                </div>
            )}

            {/* =====================================================
          TABELA
      ===================================================== */}

            <div className="table-responsive">
                <table className="relatorio-table">

                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Nome</th>
                            <th>Entrada</th>
                            <th>Intervalo</th>
                            <th>Retorno</th>
                            <th>Saída</th>
                            <th>Total</th>
                            <th>Saldo</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>

                    <tbody>
                        {dados.map(
                            (d, i) => (
                                <tr
                                    key={`${d.funcionario_id}-${d.data}-${i}`}
                                    className={`
                    ${d.atestado ? "linha-atestado" : ""}
                    ${d.falta ? "linha-falta" : ""}
                    ${d.folga ? "linha-folga" : ""}
                    ${d.ferias ? "linha-ferias" : ""}
                    ${d.falta_justificada ? "linha-falta-justificada" : ""}
                    ${d.feriado ? "linha-feriado" : ""}
                  `}
                                >
                                    <td>
                                        <strong>
                                            {d.data}
                                        </strong>
                                    </td>

                                    <td>
                                        {d.nome}
                                    </td>

                                    <td>
                                        {limparValor(
                                            d.entrada
                                        )}
                                    </td>

                                    <td>
                                        {limparValor(
                                            d.intervalo_inicio
                                        )}
                                    </td>

                                    <td>
                                        {limparValor(
                                            d.intervalo_fim
                                        )}
                                    </td>

                                    <td>
                                        {limparValor(
                                            d.saida
                                        )}
                                    </td>

                                    <td>
                                        {limparValor(
                                            d.total_horas
                                        )}
                                    </td>

                                    <td
                                        style={{
                                            fontWeight:
                                                "bold",

                                            color:
                                                d.falta ||
                                                    String(
                                                        d.status || ""
                                                    )
                                                        .toLowerCase()
                                                        .includes("falta")
                                                    ? "#e74c3c"
                                                    : d.falta_justificada
                                                        ? "#e74c3c"
                                                        : d.atestado_repor_horas
                                                            ? "#b38a07"
                                                            : d.atestado
                                                                ? "#f59e0b"
                                                                : d.folga
                                                                    ? "#3b82f6"
                                                                    : d.ferias
                                                                        ? "#8b5cf6"
                                                                        : d.feriado
                                                                            ? "#38bdf8"
                                                                            : d.saldo_bruto < 0
                                                                                ? "#e74c3c"
                                                                                : "#27ae60",
                                        }}
                                    >
                                        {d.atestado_repor_horas
                                            ? `${d.saldo_bruto < 0
                                                ? "-"
                                                : "+"
                                            }${Math.floor(
                                                Math.abs(
                                                    d.saldo_bruto
                                                ) / 60
                                            )}h ${Math.abs(
                                                d.saldo_bruto
                                            ) % 60
                                            }m`

                                            : d.folga ||
                                                d.ferias ||
                                                d.atestado ||
                                                d.falta

                                                ? "+0h 0m"

                                                : d.feriado

                                                    ? limparValor(
                                                        d.total_horas
                                                    ) ||
                                                    "+0h 0m"

                                                    : `${d.saldo_bruto < 0
                                                        ? "-"
                                                        : "+"
                                                    }${Math.floor(
                                                        Math.abs(
                                                            d.saldo_bruto
                                                        ) / 60
                                                    )}h ${Math.abs(
                                                        d.saldo_bruto
                                                    ) % 60
                                                    }m`}
                                    </td>

                                    <td>
                                        {d.falta ? (
                                            <span className="badge-falta-sim">
                                                Falta
                                            </span>
                                        ) : d.falta_justificada ? (
                                            <span
                                                className="badge-falta-justificada"
                                                title={
                                                    d.justificativa_falta ||
                                                    ""
                                                }
                                            >
                                                Falta Justificada
                                            </span>
                                        ) : d.folga ? (
                                            <span className="badge-folga">
                                                Folga
                                            </span>
                                        ) : d.ferias ? (
                                            <span className="badge-ferias">
                                                Férias
                                            </span>
                                        ) : d.feriado ? (
                                            <span className="badge-feriado">
                                                Feriado
                                            </span>
                                        ) : d.atestado ? (
                                            <span className="badge-atestado">
                                                Atestado
                                            </span>
                                        ) : (
                                            <span className="badge-falta-nao">
                                                Normal
                                            </span>
                                        )}
                                    </td>

                                    <td className="acoes-cell">

                                        {funcId !== "todos" && (
                                            <button
                                                className="btn-edit"
                                                onClick={() =>
                                                    abrirEdicao(d)
                                                }
                                                title="Editar"
                                            >
                                                ⚙️
                                            </button>
                                        )}

                                        {d.atestado && (
                                            <>
                                                <button
                                                    className="btn-atestado"

                                                    onClick={() =>
                                                        abrirAtestado(
                                                            d.atestado_id
                                                        )
                                                    }

                                                    title="Ver atestado"
                                                >
                                                    📎
                                                </button>

                                                <button
                                                    className="btn-remover-atestado"
                                                    onClick={() =>
                                                        removerAtestado(d)
                                                    }
                                                    title="Remover atestado"
                                                >
                                                    🗑️
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* =====================================================
          MODAL ATESTADO
      ===================================================== */}

            {modalAtestado && (
                <div className="modalOverlay">
                    <div className="modalPdf">

                        <button
                            className="btnFecharPdf"
                            onClick={
                                fecharModalAtestado
                            }
                        >
                            ✖
                        </button>

                        <iframe
                            src={
                                arquivoAtestado
                            }
                            title="Atestado"
                            className="pdfViewer"
                        />
                    </div>
                </div>
            )}

            {/* =====================================================
          MODAL EDIÇÃO
      ===================================================== */}

            {editOpen && (
                <div className="modalOverlay">
                    <div className="modalCard modalCardRelatorio">

                        <h3>
                            Ajustar Turno —{" "}
                            {editData.data}
                        </h3>

                        <div className="secao-acoes-dia">

                            <div className="secao-acoes-header">
                                <h4>
                                    Ações do dia
                                </h4>

                                <p>
                                    Marque aqui falta, folga,
                                    férias, falta justificada
                                    ou feriado.
                                </p>
                            </div>

                            <div className="acoes-dia-grid">

                                <button
                                    type="button"
                                    className={`acao-dia-card falta-card ${editData.falta
                                        ? "ativo"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        alternarAcao(
                                            "falta",
                                            !editData.falta
                                        )
                                    }
                                >
                                    <strong>
                                        Falta
                                    </strong>

                                    <small>
                                        Saldo zerado
                                    </small>

                                    <span>
                                        {editData.falta
                                            ? "Marcado"
                                            : "Marcar"}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`acao-dia-card folga-card ${editData.folga
                                        ? "ativo"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        alternarAcao(
                                            "folga",
                                            !editData.folga
                                        )
                                    }
                                >
                                    <strong>
                                        Folga
                                    </strong>

                                    <small>
                                        Saldo zerado
                                    </small>

                                    <span>
                                        {editData.folga
                                            ? "Marcado"
                                            : "Marcar"}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`acao-dia-card ferias-card ${editData.ferias
                                        ? "ativo"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        alternarAcao(
                                            "ferias",
                                            !editData.ferias
                                        )
                                    }
                                >
                                    <strong>
                                        Férias
                                    </strong>

                                    <small>
                                        Saldo zerado
                                    </small>

                                    <span>
                                        {editData.ferias
                                            ? "Marcado"
                                            : "Marcar"}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`acao-dia-card falta-justificada-card ${editData.falta_justificada
                                        ? "ativo"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        alternarAcao(
                                            "falta_justificada",
                                            !editData.falta_justificada
                                        )
                                    }
                                >
                                    <strong>
                                        Falta Justificada
                                    </strong>

                                    <small>
                                        Gera saldo negativo
                                    </small>

                                    <span>
                                        {editData.falta_justificada
                                            ? "Marcado"
                                            : "Marcar"}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`acao-dia-card feriado-card ${editData.feriado
                                        ? "ativo"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        alternarAcao(
                                            "feriado",
                                            !editData.feriado
                                        )
                                    }
                                >
                                    <strong>
                                        Feriado
                                    </strong>

                                    <small>
                                        Conta horas normalmente
                                    </small>

                                    <span>
                                        {editData.feriado
                                            ? "Marcado"
                                            : "Marcar"}
                                    </span>
                                </button>
                            </div>

                            {editData.falta_justificada && (
                                <label className="justificativa-label">

                                    Justificativa da falta:

                                    <textarea
                                        className="justificativa-textarea"
                                        placeholder="Digite a justificativa da falta..."
                                        value={
                                            editData.justificativa_falta
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,

                                                justificativa_falta:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                </label>
                            )}
                        </div>

                        {/* =================================================
                HORÁRIOS
            ================================================= */}

                        <div className="secao-horarios-dia">

                            <div className="secao-acoes-header">
                                <h4>
                                    Horários do dia
                                </h4>

                                <p>
                                    Edite os horários manualmente
                                    quando o dia não estiver marcado
                                    como falta, folga, férias ou
                                    falta justificada.
                                </p>
                            </div>

                            <div
                                className={`modalGrid ${camposBloqueados
                                    ? "campos-desabilitados"
                                    : ""
                                    }`}
                            >

                                <label>
                                    Entrada:

                                    <input
                                        type="time"
                                        value={
                                            editData.entrada
                                        }
                                        disabled={
                                            camposBloqueados
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                entrada:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label>
                                    Início Intervalo:

                                    <input
                                        type="time"
                                        value={
                                            editData.intervalo_inicio
                                        }
                                        disabled={
                                            camposBloqueados
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                intervalo_inicio:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label>
                                    Retorno Intervalo:

                                    <input
                                        type="time"
                                        value={
                                            editData.intervalo_fim
                                        }
                                        disabled={
                                            camposBloqueados
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                intervalo_fim:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label>
                                    Saída Final:

                                    <input
                                        type="time"
                                        value={
                                            editData.saida
                                        }
                                        disabled={
                                            camposBloqueados
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                saida:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>
                        </div>

                        {/* =================================================
                BOTÕES MODAL
            ================================================= */}

                        <div className="modalActions">

                            <button
                                className="btn-limpar-batidas"
                                onClick={
                                    limparBatidasDoDia
                                }
                                disabled={
                                    limpandoBatidas ||
                                    salvando
                                }
                            >
                                {limpandoBatidas
                                    ? "Limpando..."
                                    : "Limpar Batidas do Dia"}
                            </button>

                            <button
                                className="btn-cancel"
                                onClick={() =>
                                    setEditOpen(false)
                                }
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn-save"
                                onClick={
                                    salvarAlteracao
                                }
                                disabled={
                                    salvando ||
                                    limpandoBatidas
                                }
                            >
                                {salvando
                                    ? "Salvando..."
                                    : "Salvar Alterações"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================
          MODAL SUCESSO / ERRO
      ===================================================== */}

            {modalOpen && (
                <div className="modal-ponto">

                    <div
                        className={`modal-box ${modalErro
                            ? "modal-box-erro"
                            : ""
                            }`}
                    >
                        {modalErro ? (
                            <FaTimesCircle className="modal-icon-erro" />
                        ) : (
                            <FaCheckCircle className="modal-icon" />
                        )}

                        <h3>
                            {modalTitulo}
                        </h3>

                        <p>
                            {modalTexto}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}