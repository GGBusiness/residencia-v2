# 🚀 Importação Automática de Questões

## Como Usar

### 1. Executar o Script

```bash
npm run import-questions
```

### 2. O Que o Script Faz

O script automaticamente:
- ✅ Busca todos os PDFs nas pastas de provas
- ✅ Detecta instituição, ano e área pelo nome do arquivo
- ✅ Extrai questões usando regex inteligente
- ✅ Importa direto para o Supabase em lotes de 100

### 3. Detecção Automática

**Instituição:** ENARE, USP, UNICAMP, UNIFESP, UNESP, SUS-SP...  
**Ano:** Extrai do nome do arquivo (2024, 2025, 2026)  
**Área:** Detecta por palavras-chave:
- `cir`, `cirurgia` → Cirurgia
- `cm`, `clinica` → Clínica Médica  
- `go`, `gineco` → GO
- `ped`, `pediatria` → Pediatria
- `r1`, geral → Todas as áreas

### 4. Exemplo de Saída

```
🚀 Iniciando importação de questões...

📁 Buscando PDFs em: c:\Geral\Alice\Provas Antigas\Provas novas
  Encontrados: 35 PDFs

📚 Total de PDFs encontrados: 49

🎯 PDFs prioritários (provas oficiais): 35

📄 Processando: ENARE-2025.pdf
  ✅ 120 questões extraídas

📄 Processando: USP-2026-R1.pdf
  ✅ 100 questões extraídas

...

📊 Importando 850 questões para Supabase...
  ✅ Lote 1: 100/850
  ✅ Lote 2: 200/850
  ...

📈 Resultado:
  ✅ Importadas: 850
  ❌ Erros: 0

🎉 Processo finalizado!
```

### 5. Ajustes Necessários

**Gabaritos:** O script usa 'A' como padrão. Você precisará:
1. Criar script separado para ler PDFs de gabaritos
2. OU adicionar manualmente depois

**Quantidade de PDFs:** Por padrão processa os 10 primeiros. Para processar TODOS:

Edite `scripts/import-questions.ts` linha 207:
```typescript
// De:
for (const pdfPath of priorityPDFs.slice(0, 10)) {

// Para:
for (const pdfPath of priorityPDFs) {
```

### 6. Troubleshooting

**Erro: "Cannot find module"**
```bash
npm install
```

**Poucas questões extraídas:**
- PDFs podem ter formato diferente
- Ajustar regex no script
- Verificar se PDF tem texto ou é imagem (necessita OCR)

**Erro de importação Supabase:**
- Verificar `.env.local` com credenciais corretas
- Verificar se tabela `questions` existe

---

## Próximos Passos Após Importação

1. **Verificar no Supabase:**
```sql
SELECT institution, area, COUNT(*) as total
FROM questions
GROUP BY institution, area
ORDER BY institution, area;
```

2. **Testar no App:**
- Acesse `/app/monta-provas`
- Monte uma prova com filtros
- Deve mostrar questões reais agora!

3. **Adicionar Gabaritos:**
```sql
-- Atualizar gabaritos depois
UPDATE questions 
SET correct_answer = 'C' 
WHERE id = 'uuid-da-questao';
```

---

## Melhorias Futuras

- [ ] Processar PDFs de gabaritos automaticamente
- [ ] Adicionar dificuldade baseada em estatísticas
- [ ] Extrair imagens das questões
- [ ] OCR para PDFs escaneados
- [ ] Interface web para revisar questões antes de importar

---

🎯 **Execute agora:** `npm run import-questions`
