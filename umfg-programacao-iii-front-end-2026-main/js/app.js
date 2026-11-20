
// CONFIGURAÇÃO E ESTADO DA APLICAÇÃO

const API_URL = "https://localhost:7063";

const estado = {
    paginaAtual: 1,
    totalPaginas: 1,
    ordem: "DataCadastro",
    direcao: "DESC"
};

const NOMES_COLUNAS = {
    Descricao: "Descrição",
    DataCadastro: "Data de Cadastro",
    DataAtualizacao: "Última Atualização",
    IsAtivo: "Status"
};

// ELEMENTOS DO DOM

const formulario = document.getElementById("formulario");
const formLembrete = document.getElementById("formLembrete");
const tituloFormulario = document.getElementById("tituloFormulario");
const lembreteId = document.getElementById("lembreteId");
const descricao = document.getElementById("descricao");
const contadorCaracteres = document.getElementById("contadorCaracteres");

// Filtros (Etapa 5)
const filtroDescricao = document.getElementById("filtroDescricao");
const filtroDataCadastroInicial = document.getElementById("filtroDataCadastroInicial");
const filtroDataCadastroFinal = document.getElementById("filtroDataCadastroFinal");
const filtroDataAtualizacaoInicial = document.getElementById("filtroDataAtualizacaoInicial");
const filtroDataAtualizacaoFinal = document.getElementById("filtroDataAtualizacaoFinal");
const tamanhoPagina = document.getElementById("tamanhoPagina");

// Tabela e estados
const listaLembretes = document.getElementById("listaLembretes");
const mensagemVazia = document.getElementById("mensagemVazia");
const estadoCarregando = document.getElementById("estadoCarregando");
const totalRegistros = document.getElementById("totalRegistros");
const infoOrdenacao = document.getElementById("infoOrdenacao");
const paginaAtualElemento = document.getElementById("paginaAtual");

// Botões
const btnImprimir = document.getElementById("btnImprimir");
const btnNovo = document.getElementById("btnNovo");
const btnCancelar = document.getElementById("btnCancelar");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const btnPrimeira = document.getElementById("btnPrimeira");
const btnAnterior = document.getElementById("btnAnterior");
const btnProximo = document.getElementById("btnProximo");
const btnUltima = document.getElementById("btnUltima");

let toastTimeout = null;

// INICIALIZAÇÃO

document.addEventListener("DOMContentLoaded", () => {
    configurarOrdenacaoColunas();
    atualizarIndicadoresOrdenacao();
    filtrarLembretes();
});

// MONTAGEM DE QUERY STRING (FILTROS + PAGINAÇÃO + ORDENAÇÃO)

function construirParametrosConsulta() {
    const params = new URLSearchParams();

    params.append("NumeroPagina", estado.paginaAtual);
    params.append("TamanhoPagina", tamanhoPagina.value);
    params.append("Ordem", estado.ordem);
    params.append("Direcao", estado.direcao);
    params.append("Descricao", filtroDescricao.value.trim());

    // Envia a data escolhida ou os limites aceitos pela API (DateTime.MinValue / MaxValue)
    params.append(
        "DataCadastroInicial",
        filtroDataCadastroInicial.value || "0001-01-01"
    );
    params.append(
        "DataCadastroFinal",
        filtroDataCadastroFinal.value || "9999-12-31"
    );
    params.append(
        "DataAtualizacaoInicial",
        filtroDataAtualizacaoInicial.value || "0001-01-01"
    );
    params.append(
        "DataAtualizacaoFinal",
        filtroDataAtualizacaoFinal.value || "9999-12-31"
    );

    return params;
}

function validarIntervaloDatas() {
    if (
        filtroDataCadastroInicial.value &&
        filtroDataCadastroFinal.value &&
        filtroDataCadastroInicial.value > filtroDataCadastroFinal.value
    ) {
        mostrarToast("A data de cadastro inicial não pode ser maior que a final.", "warning");
        return false;
    }

    if (
        filtroDataAtualizacaoInicial.value &&
        filtroDataAtualizacaoFinal.value &&
        filtroDataAtualizacaoInicial.value > filtroDataAtualizacaoFinal.value
    ) {
        mostrarToast("A data de atualização inicial não pode ser maior que a final.", "warning");
        return false;
    }

    return true;
}

// GET /lembretes/filtro

async function filtrarLembretes() {
    if (!validarIntervaloDatas()) {
        return;
    }

    exibirCarregamento(true);

    try {
        const params = construirParametrosConsulta();
        const response = await fetch(`${API_URL}/lembretes/filtro?${params.toString()}`);

        if (!response.ok) {
            const detalhe = await response.text();
            throw new Error(detalhe || `Erro HTTP ${response.status} ao consultar lembretes.`);
        }

        const resultado = await response.json();
        const itens = resultado.lembretes || [];
        const total = resultado.total ?? 0;
        const porPagina = resultado.tamanhoPagina || Number(tamanhoPagina.value);

        estado.totalPaginas = Math.max(1, Math.ceil(total / porPagina));

        renderizarLembretes(itens);

        totalRegistros.textContent = `${total} ${total === 1 ? "registro" : "registros"}`;
        paginaAtualElemento.textContent = `Página ${resultado.numeroPagina} de ${estado.totalPaginas}`;

        atualizarBotoesPaginacao(total, porPagina);
    } catch (error) {
        console.error("Falha na requisição GET /lembretes/filtro:", error);
        listaLembretes.innerHTML = "";
        mensagemVazia.classList.remove("hidden");
        mostrarToast(
            "Erro de comunicação com a API. Verifique se o back-end está em execução.",
            "error"
        );
    } finally {
        exibirCarregamento(false);
    }
}

// GET /lembretes/imprimir

async function imprimirLembretes() {
    if (!validarIntervaloDatas()) {
        return;
    }

    try {
        const params = construirParametrosConsulta();
        const response = await fetch(`${API_URL}/lembretes/imprimir?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao gerar relatório PDF.`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "relatorio-lembretes.pdf";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 10000);
        mostrarToast("Relatório PDF gerado com sucesso!", "success");
    } catch (error) {
        console.error("Falha ao exportar PDF:", error);
        mostrarToast("Não foi possível gerar o PDF. Verifique a conexão com a API.", "error");
    }
}

// POST /lembretes

async function criarLembrete() {
    try {
        const payload = {
            descricao: descricao.value.trim()
        };

        const response = await fetch(`${API_URL}/lembretes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao cadastrar lembrete.`);
        }

        mostrarToast("Lembrete cadastrado com sucesso!", "success");
        fecharFormulario();
        estado.paginaAtual = 1;
        await filtrarLembretes();
    } catch (error) {
        console.error("Falha na requisição POST /lembretes:", error);
        mostrarToast("Erro ao cadastrar o lembrete. Verifique a conexão com a API.", "error");
    }
}

// GET /lembretes/{id}

async function buscarLembrete(id) {
    try {
        const response = await fetch(`${API_URL}/lembretes/${id}`);

        if (response.status === 404) {
            mostrarToast("Lembrete não encontrado na base de dados.", "warning");
            return;
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao buscar lembrete.`);
        }

        const lembrete = await response.json();

        lembreteId.value = lembrete.id;
        descricao.value = lembrete.descricao || "";
        atualizarContadorCaracteres();

        tituloFormulario.textContent = "Editar Lembrete";
        formulario.classList.remove("hidden");
        descricao.focus();
        formulario.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        console.error(`Falha na requisição GET /lembretes/${id}:`, error);
        mostrarToast("Não foi possível carregar os dados do lembrete.", "error");
    }
}

// PUT /lembretes/{id}

async function atualizarLembrete() {
    try {
        const payload = {
            descricao: descricao.value.trim()
        };

        const response = await fetch(`${API_URL}/lembretes/${lembreteId.value}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 404) {
            mostrarToast("O lembrete informado não existe mais.", "warning");
            return;
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao atualizar lembrete.`);
        }

        mostrarToast("Lembrete atualizado com sucesso!", "success");
        fecharFormulario();
        await filtrarLembretes();
    } catch (error) {
        console.error("Falha na requisição PUT /lembretes:", error);
        mostrarToast("Erro ao atualizar o lembrete.", "error");
    }
}

// DELETE /lembretes/{id}

async function excluirLembrete(id) {
    const confirmou = confirm("Tem certeza de que deseja excluir este lembrete?");
    if (!confirmou) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/lembretes/${id}`, {
            method: "DELETE"
        });

        if (response.status === 404) {
            mostrarToast("Lembrete não encontrado para exclusão.", "warning");
            return;
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao excluir lembrete.`);
        }

        mostrarToast("Lembrete excluído com sucesso!", "success");

        // Se excluiu o último item da página atual, volta uma página
        if (listaLembretes.children.length === 1 && estado.paginaAtual > 1) {
            estado.paginaAtual--;
        }

        await filtrarLembretes();
    } catch (error) {
        console.error(`Falha na requisição DELETE /lembretes/${id}:`, error);
        mostrarToast("Não foi possível excluir o lembrete.", "error");
    }
}

// RENDERIZAÇÃO DA TABELA

function renderizarLembretes(lembretes) {
    listaLembretes.innerHTML = "";

    if (!lembretes || lembretes.length === 0) {
        mensagemVazia.classList.remove("hidden");
        return;
    }

    mensagemVazia.classList.add("hidden");

    lembretes.forEach((lembrete) => {
        const tr = document.createElement("tr");

        const tdDescricao = document.createElement("td");
        tdDescricao.className = "col-descricao";
        tdDescricao.textContent = lembrete.descricao;

        const tdCadastro = document.createElement("td");
        tdCadastro.className = "col-data";
        tdCadastro.textContent = formatarData(lembrete.dataCadastro);

        const tdAtualizacao = document.createElement("td");
        tdAtualizacao.className = "col-data";
        tdAtualizacao.textContent = formatarData(lembrete.dataAtualizacao);

        const tdStatus = document.createElement("td");
        const spanStatus = document.createElement("span");
        spanStatus.className = `status-pill ${lembrete.isAtivo ? "status-ativo" : "status-inativo"}`;
        spanStatus.textContent = lembrete.isAtivo ? "● Ativo" : "● Inativo";
        tdStatus.appendChild(spanStatus);

        const tdAcoes = document.createElement("td");
        tdAcoes.className = "col-acoes";

        const divAcoes = document.createElement("div");
        divAcoes.className = "actions-group";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-table-edit";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => buscarLembrete(lembrete.id));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-table-delete";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => excluirLembrete(lembrete.id));

        divAcoes.appendChild(btnEditar);
        divAcoes.appendChild(btnExcluir);
        tdAcoes.appendChild(divAcoes);

        tr.appendChild(tdDescricao);
        tr.appendChild(tdCadastro);
        tr.appendChild(tdAtualizacao);
        tr.appendChild(tdStatus);
        tr.appendChild(tdAcoes);

        listaLembretes.appendChild(tr);
    });
}

// ORDENAÇÃO PELO CABEÇALHO DA TABELA (ETAPA 6)

function configurarOrdenacaoColunas() {
    const colunasOrdenaveis = document.querySelectorAll("th.sortable");

    colunasOrdenaveis.forEach((th) => {
        th.addEventListener("click", () => {
            const colunaClicada = th.dataset.coluna;

            if (estado.ordem === colunaClicada) {
                estado.direcao = estado.direcao === "ASC" ? "DESC" : "ASC";
            } else {
                estado.ordem = colunaClicada;
                estado.direcao = "ASC";
            }

            estado.paginaAtual = 1;
            atualizarIndicadoresOrdenacao();
            filtrarLembretes();
        });
    });
}

function atualizarIndicadoresOrdenacao() {
    document.querySelectorAll("th.sortable").forEach((th) => {
        th.classList.remove("active-sort");
        const icon = th.querySelector(".sort-icon");
        if (icon) {
            icon.textContent = "↕";
        }
    });

    const colunaAtiva = document.querySelector(`th.sortable[data-coluna="${estado.ordem}"]`);
    if (colunaAtiva) {
        colunaAtiva.classList.add("active-sort");
        const icon = colunaAtiva.querySelector(".sort-icon");
        if (icon) {
            icon.textContent = estado.direcao === "ASC" ? "↑" : "↓";
        }
    }

    const labelColuna = NOMES_COLUNAS[estado.ordem] || estado.ordem;
    infoOrdenacao.textContent = `Ordenado por: ${labelColuna} (${estado.direcao})`;
}

// EVENTOS DE FORMULÁRIO, FILTROS E PAGINAÇÃO

btnImprimir.addEventListener("click", imprimirLembretes);

btnNovo.addEventListener("click", () => {
    lembreteId.value = "";
    descricao.value = "";
    atualizarContadorCaracteres();
    tituloFormulario.textContent = "Novo Lembrete";
    formulario.classList.remove("hidden");
    descricao.focus();
});

btnCancelar.addEventListener("click", fecharFormulario);

descricao.addEventListener("input", atualizarContadorCaracteres);

formLembrete.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!descricao.value.trim()) {
        mostrarToast("Preencha o campo obrigatório: Descrição.", "warning");
        descricao.focus();
        return;
    }

    if (lembreteId.value) {
        await atualizarLembrete();
    } else {
        await criarLembrete();
    }
});

btnFiltrar.addEventListener("click", () => {
    estado.paginaAtual = 1;
    filtrarLembretes();
});

btnLimparFiltros.addEventListener("click", () => {
    filtroDescricao.value = "";
    filtroDataCadastroInicial.value = "";
    filtroDataCadastroFinal.value = "";
    filtroDataAtualizacaoInicial.value = "";
    filtroDataAtualizacaoFinal.value = "";
    tamanhoPagina.value = "10";

    estado.paginaAtual = 1;
    estado.ordem = "DataCadastro";
    estado.direcao = "DESC";

    atualizarIndicadoresOrdenacao();
    filtrarLembretes();
    mostrarToast("Filtros redefinidos.", "success");
});

filtroDescricao.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        estado.paginaAtual = 1;
        filtrarLembretes();
    }
});

tamanhoPagina.addEventListener("change", () => {
    estado.paginaAtual = 1;
    filtrarLembretes();
});

btnPrimeira.addEventListener("click", () => {
    if (estado.paginaAtual > 1) {
        estado.paginaAtual = 1;
        filtrarLembretes();
    }
});

btnAnterior.addEventListener("click", () => {
    if (estado.paginaAtual > 1) {
        estado.paginaAtual--;
        filtrarLembretes();
    }
});

btnProximo.addEventListener("click", () => {
    if (estado.paginaAtual < estado.totalPaginas) {
        estado.paginaAtual++;
        filtrarLembretes();
    }
});

btnUltima.addEventListener("click", () => {
    if (estado.paginaAtual < estado.totalPaginas) {
        estado.paginaAtual = estado.totalPaginas;
        filtrarLembretes();
    }
});

// UTILITÁRIOS
function fecharFormulario() {
    formulario.classList.add("hidden");
    formLembrete.reset();
    lembreteId.value = "";
    atualizarContadorCaracteres();
}

function atualizarContadorCaracteres() {
    contadorCaracteres.textContent = `${descricao.value.length} / 500 caracteres`;
}

function exibirCarregamento(ativo) {
    if (ativo) {
        estadoCarregando.classList.remove("hidden");
        mensagemVazia.classList.add("hidden");
    } else {
        estadoCarregando.classList.add("hidden");
    }
}

function atualizarBotoesPaginacao(total, porPagina) {
    btnPrimeira.disabled = estado.paginaAtual <= 1;
    btnAnterior.disabled = estado.paginaAtual <= 1;
    btnProximo.disabled = estado.paginaAtual * porPagina >= total;
    btnUltima.disabled = estado.paginaAtual * porPagina >= total;
}

function formatarData(data) {
    if (!data) {
        return "-";
    }

    return new Date(data).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function mostrarToast(mensagem, tipo = "info") {
    const toast = document.getElementById("toast");

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toast.textContent = mensagem;
    toast.className = `toast toast-${tipo}`;

    toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}