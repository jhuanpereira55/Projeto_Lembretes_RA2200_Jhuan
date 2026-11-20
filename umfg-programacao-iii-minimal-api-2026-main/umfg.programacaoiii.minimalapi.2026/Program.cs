using Microsoft.EntityFrameworkCore;
using QuestPDF;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using umfg.programacaoiii.minimalapi._2026.Contexto;
using umfg.programacaoiii.minimalapi._2026.DTO;
using umfg.programacaoiii.minimalapi._2026.Entidades;

namespace umfg.programacaoiii.minimalapi._2026;

public class Program
{    
    // metodo de startup do projeto
    public static void Main(string[] args)
    {
        // variavel padrao do .net permite definir as caracteristicas que a api ira ter
        // ex: autenticacao e autorizacao via JWT / qual banco de dados
        var builder = WebApplication.CreateBuilder(args);
        var connectionString = builder.Configuration["ConnectionString"] ?? string.Empty;

        // aqui configuramos a conexao da API com o banco de dados
        builder.Services
            .AddDbContext<MySqlContexto>(options => options.UseMySQL(connectionString));

        // implementacao do CORS para permitir que a aplicacao frontend acesse a API (localhost)
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("Frontend", policy =>
            {
                policy
                    .AllowAnyOrigin()
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        // aqui a aplicacao e construida
        var app = builder.Build();

        app.MapPost("/lembretes", async (Lembrete lembrete, MySqlContexto contexto) =>
        {
            await contexto.Lembrete.AddAsync(lembrete);
            await contexto.SaveChangesAsync();

            return Results.Created($"/lembretes/{lembrete.Id}", lembrete);
        });

        app.MapGet("/lembretes/{id}", async (string id, MySqlContexto contexto) =>
        {
            if (string.IsNullOrWhiteSpace(id))
                return Results.BadRequest("id invalido!");

            return await contexto.Lembrete.FirstOrDefaultAsync(x => x.Id == Guid.Parse(id) && x.IsAtivo) 
                is Lembrete lembrete ? Results.Ok(lembrete) : Results.NotFound();
        });

        app.MapGet("/lembretes", async (MySqlContexto contexto) =>
        {
            return await contexto.Lembrete.Where(x => x.IsAtivo).ToListAsync();            
        });

        app.MapGet("/lembretes/filtro", async ([AsParameters] LembreteQueryDTO.LembreteQueryRequestDTO dto, MySqlContexto contexto) =>
        {
            if (dto.NumeroPagina <= 0 || dto.TamanhoPagina <= 0)
                return Results.BadRequest("Pagina e tamanho da pagina sao obrigatorios.");

            var (lembretes, total) = await FiltrarLembretes(dto, contexto);

            var resultado = new LembreteQueryDTO.LembreteQueryResponseDTO()
            {
                Total = total,
                NumeroPagina = dto.NumeroPagina,
                TamanhoPagina = dto.TamanhoPagina,
                Lembretes = lembretes,
            };

            return Results.Ok(resultado);
        });

        // Biblioteca -> QuestPDF
        Settings.License = LicenseType.Community;

        app.MapGet("/lembretes/imprimir", async ([AsParameters] LembreteQueryDTO.LembreteQueryRequestDTO dto, MySqlContexto contexto) =>
        {
            if (dto.NumeroPagina <= 0 || dto.TamanhoPagina <= 0)
                return Results.BadRequest("Pagina e tamanho da pagina sao obrigatorios.");

            var (lembretes, total) = await FiltrarLembretes(dto, contexto);

            var documento = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.PageColor(Color.FromHex("#FFFFFF"));

                    page.Header()
                        .Text("Relatório de Lembretes")
                        .SemiBold()
                        .FontSize(20)
                        .FontColor(Colors.Blue.Medium);

                    page
                        .Content()
                        .PaddingVertical(10)
                        .Column(column =>
                        {
                            column.Spacing(10);
                            column.Item().Text($"Gerado em: {DateTime.Now.ToLocalTime()}");

                            column
                                .Item()
                                .Table(tabela =>
                                {
                                    tabela.ColumnsDefinition(columns =>
                                    {
                                        columns.RelativeColumn();
                                        columns.ConstantColumn(110);
                                        columns.ConstantColumn(110);                                        
                                        columns.ConstantColumn(80);                                        
                                    });

                                    tabela.Header(header =>
                                    {
                                        header.Cell().Text("Descrição").SemiBold();
                                        header.Cell().Text("Cadastro").SemiBold();
                                        header.Cell().Text("Atualização").SemiBold();
                                        header.Cell().Text("Status").SemiBold();
                                    });

                                    foreach (var lembrete in lembretes)
                                    {
                                        tabela.Cell().Text(lembrete.Descricao).FontSize(10);
                                        tabela.Cell().Text(lembrete.DataCadastro.ToLocalTime().ToString("dd/MM/yyyy HH:mm")).FontSize(10);
                                        tabela.Cell().Text(lembrete.DataAtualizacao.ToLocalTime().ToString("dd/MM/yyyy HH:mm")).FontSize(10);
                                        tabela.Cell()
                                            .Text(lembrete.IsAtivo ? "Ativo" : "Inativo")
                                            .FontSize(10)
                                            .FontColor(lembrete.IsAtivo ? Colors.Green.Medium : Colors.Red.Medium);
                                    }
                                });
                        });

                    page.Footer().AlignCenter().Text(x => x.CurrentPageNumber());
                });
            });

            return Results.File(documento.GeneratePdf(), "application/pdf", "relatorio-lembretes.pdf");
        });

        app.MapDelete("/lembretes/{id}", async (string id, MySqlContexto contexto) =>
        {
            var lembrete = await contexto.Lembrete.FindAsync(Guid.Parse(id));

            // conceito de fail first
            if (lembrete is null)
                return Results.NotFound();

            lembrete.SetAtivo(false);
            lembrete.Update();

            contexto.Lembrete.Update(lembrete);
            await contexto.SaveChangesAsync();

            return Results.NoContent();
        });

        app.MapPut("/lembretes/{id}", async (string id, LembreteDTO dto, MySqlContexto contexto) =>
        {
            var lembreteExistente = await contexto.Lembrete.FindAsync(Guid.Parse(id));

            if (lembreteExistente is null)
                return Results.NotFound();

            lembreteExistente.SetDescricao(dto.Descricao);
            lembreteExistente.Update();

            contexto.Lembrete.Update(lembreteExistente);
            await contexto.SaveChangesAsync();

            return Results.Ok(lembreteExistente);
        });

        // aqui habilitamos as funcionalidades da api
        app.UseHttpsRedirection();

        // habilitar o uso da regra de CORS
        app.UseCors("Frontend");

        // a api e iniciada de fato
        app.Run();
    }

    private static async Task<(List<Lembrete>, long)> FiltrarLembretes(
        LembreteQueryDTO.LembreteQueryRequestDTO dto, MySqlContexto contexto)
    {
        var query = contexto.Lembrete
                .AsNoTracking()
                .Where(x => x.IsAtivo);

        // busca por descricao com tratamento de caracteres especiais para LIKE
        if (!string.IsNullOrWhiteSpace(dto.Descricao))
        {
            var termo = dto.Descricao.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            query = query.Where(x => EF.Functions.Like(x.Descricao, $"%{termo}%"));
        }

        // Filtros opcionais
        if (dto.DataCadastroInicial > DateTime.MinValue)
            query = query.Where(x => x.DataCadastro >= dto.DataCadastroInicial);

        if (dto.DataCadastroFinal.Date < DateTime.MaxValue.Date)
            query = query.Where(x => x.DataCadastro < dto.DataCadastroFinal.Date.AddDays(1));

        if (dto.DataAtualizacaoInicial > DateTime.MinValue)
            query = query.Where(x => x.DataAtualizacao >= dto.DataAtualizacaoInicial);

        if (dto.DataAtualizacaoFinal.Date < DateTime.MaxValue.Date)
            query = query.Where(x => x.DataAtualizacao < dto.DataAtualizacaoFinal.Date.AddDays(1));

        // ordenar sempre do mais recente para o mais antigo por padrao
        var isDesc = !string.Equals(dto.Direcao, "ASC", StringComparison.OrdinalIgnoreCase);
        var campoOrdem = (dto.Ordem ?? string.Empty).ToLowerInvariant();

        // ordenacao
        query = (campoOrdem, isDesc) switch
        {
            ("descricao", true) => query.OrderByDescending(x => x.Descricao),
            ("descricao", false) => query.OrderBy(x => x.Descricao),
            ("datacadastro", true) => query.OrderByDescending(x => x.DataCadastro),
            ("datacadastro", false) => query.OrderBy(x => x.DataCadastro),
            ("dataatualizacao", true) => query.OrderByDescending(x => x.DataAtualizacao),
            ("dataatualizacao", false) => query.OrderBy(x => x.DataAtualizacao),
            ("isativo", true) or ("status", true) => query.OrderByDescending(x => x.IsAtivo),
            ("isativo", false) or ("status", false) => query.OrderBy(x => x.IsAtivo),
            (_, false) => query.OrderBy(x => x.DataCadastro),
            _ => query.OrderByDescending(x => x.DataCadastro)
        };

        // paginacao
        var total = await query.CountAsync();
        var pular = (dto.NumeroPagina - 1) * dto.TamanhoPagina;
        var lembretes = await query.Skip(pular).Take(dto.TamanhoPagina).ToListAsync();

        return (lembretes, total);
    }
}