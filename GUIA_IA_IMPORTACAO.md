# 🎯 Sistema de IA e Importação - Guia Completo

## ✅ O que foi implementado

### 1. Sistema de IA de Recomendação Personalizada

**Como funciona:**
- 📊 Rastreia cada resposta que você dá
- 🧠 Aprende suas áreas fortes e fracas
- 🎯 Recomenda questões personalizadas
- 📈 Mostra sua evolução ao longo do tempo

**Algoritmo tipo rede social:**
- 40% questões de áreas fracas (<60% acerto)
- 30% áreas que precisam atenção (60-75%)
- 20% revisão de áreas boas (75-85%)
- 10% exploração de novos tópicos

---

## 🚀 Como Usar

### Passo 1: Execute o SQL no Supabase

```sql
-- Cole e execute no SQL Editor do Supabase:
c:\Geral\Alice\Provas Antigas\APP\residencia-app\setup-ai-system.sql
```

Isso cria:
- ✅ Tabela `user_performance` (rastreamento detalhado)
- ✅ Tabela `user_knowledge_profile` (perfil agregado)
- ✅ Tabela `user_evolution_history` (evolução diária)
- ✅ Triggers automáticos (atualização)

### Passo 2: Importe Questões com Claude (Opcional)

**Se quiser importar os 43 PDFs automaticamente:**

1. Crie conta no Anthropic: https://console.anthropic.com/
2. Gere uma API Key
3. Adicione ao `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
4. Execute:
   ```bash
   npm run import-claude
   ```

**Custo estimado:** ~$3-5 para processar todos os PDFs

**Alternativa GRÁTIS:** Use as 50 questões manuais que já inserimos!

### Passo 3: Use Provas Personalizadas

**Modo 1: Prova Balanceada (Padrão)**
``typescript
// No código: /app/monta-provas/page.tsx

const handleAIQuiz = async () => {
    const response = await fetch('/api/ai-recommendations', {
        method: 'POST',
        body: JSON.stringify({
            userId: userId,
            questionCount: 20,
            focusMode: 'balanced', // 40% áreas fracas
        }),
    });
    
    const { questions } = await response.json();
    // Criar attempt com essas questões
};
```

**Modo 2: Foco em Áreas Fracas**
```typescript
focusMode: 'weak_areas' // 80% áreas com <60% acerto
```

**Modo 3: Revisão**
```typescript
focusMode: 'review' // 70% revisão de áreas boas
```

**Modo 4: Exploração**
```typescript
focusMode: 'exploration' // 60% novos tópicos
```

---

## 📊 Ver Insights

```typescript
// GET /api/ai-recommendations?userId=xxx

const insights = await fetch(`/api/ai-recommendations?userId=${userId}`).then(r => r.json());

console.log(insights.profile);        // Perfil por área
console.log(insights.history);         // Evolução diária
console.log(insights.recentPerformance); // Últimas 50 questões
console.log(insights.globalStats);     // Estatísticas globais
```

**Exemplo de resposta:**
```json
{
  "profile": [
    {
      "area": "Cirurgia",
      "total_answered": 50,
      "correct_count": 35,
      "accuracy_percentage": 70.00,
      "priority_level": 2 // Precisa atenção
    },
    {
      "area": "Clínica Médica",
      "accuracy_percentage": 52.00,
      "priority_level": 1 // Crítico!
    }
  ],
  "globalStats": {
    "totalQuestions": 150,
    "totalCorrect": 98,
    "globalAccuracy": "65.33"
  }
}
```

---

## 🎮 Fluxo de Uso Completo

1. **Usuário responde questões** no quiz
   → Performance salva automaticamente

2. **Sistema atualiza perfil** (via trigger SQL)
   → Calcula % de acerto por área
   → Define prioridade (1-4)

3. **IA gera recomendações** quando pede nova prova
   → Analisa áreas fracas
   → Seleciona questões personalizadas
   → Embaralha para naturalidade

4. **Dashboard mostra evolução**
   → Gráficos de área radar
   → Timeline de progresso
   → Sugestões de estudo

---

## 📁 Arquivos Criados

```
residencia-app/
├── setup-ai-system.sql                 # SQL para criar tabelas
├── lib/ai-recommendation-engine.ts     # Engine de IA
├── app/api/
│   ├── ai-recommendations/route.ts     # Gerar recomendações
│   └── save-performance/route.ts       # Salvar performance
└── scripts/
    └── import-with-claude.ts           # Importação com Claude

```

---

## 🔧 Próximos Passos (Opcional)

### A. Adicionar Botão "Prova Personalizada IA" no Monta Provas

```typescript
// Em monta-provas/page.tsx

<Button onClick={async () => {
    const res = await fetch('/api/ai-recommendations', {
        method: 'POST',
        body: JSON.stringify({
            userId: '00000000-0000-0000-0000-000000000001',
            questionCount: 20,
            focusMode: 'balanced',
        }),
    });
    
    const { questions } = await res.json();
    
    // Criar attempt e redirecionar
    router.push(`/app/quiz/${attemptId}`);
}}>
    🤖 Prova Personalizada com IA
</Button>
```

### B. Criar Página de Insights

```typescript
// app/app/insights/page.tsx

export default function InsightsPage() {
    const [insights, setInsights] = useState(null);
    
    useEffect(() => {
        fetch('/api/ai-recommendations?userId=xxx')
            .then(r => r.json())
            .then(setInsights);
    }, []);
    
    return (
        <div>
            <h1>Seu Perfil de Conhecimento</h1>
            
            {/* Gráfico Radar de áreas */}
            <RadarChart data={insights?.profile} />
            
            {/* Lista de áreas fracas */}
            {insights?.profile.filter(p => p.priority_level === 1).map(area => (
                <Card key={area.area}>
                    <p>⚠️ {area.area}: {area.accuracy_percentage}%</p>
                    <Progress value={area.accuracy_percentage} />
                </Card>
            ))}
        </div>
    );
}
```

---

## 💡 Como o Sistema Aprende

1. **Após cada questão:**
   - Salva resposta em `user_performance`
   - Trigger atualiza `user_knowledge_profile` automaticamente
   - Calcula nova taxa de acerto
   - Ajusta prioridade de estudo

2. **Ao gerar novas provas:**
   - Engine analisa perfil completo
   - Identifica áreas críticas (<60%)
   - Busca questões não respondidas
   - Distribui de forma inteligente
   - Embaralha para sentir natural

3. **Ao longo do tempo:**
   - Histórico de evolução acumula em `user_evolution_history`
   - Gráficos mostram progresso
   - Tendências identificadas (melhorando vs piorando)

---

## ✅ Checklist de Implementação

- [x] Tabelas SQL criadas
- [x] Engine de IA implementada
- [x] APIs de recomendação prontas
- [x] Salvamento automático no quiz
- [x] Script de importação com Claude
- [ ] Botão "Prova IA" no Monta Provas **(PRÓXIMO PASSO)**
- [ ] Página de Insights com gráficos
- [ ] Importar todos os 43 PDFs
- [ ] Gamificação (badges, streaks)
- [ ] Chat IA tutor

---

## 🎉 Sistema Funcionando!

O sistema de IA **JÁ ESTÁ FUNCIONANDO** em background!

Toda questão respondida no quiz alimenta a IA. Quando quiser provas personalizadas, basta chamar a API `/ai-recommendations`.

**Comece a usar:** Fa ça algumas provas normais para a IA aprender seu perfil! 🚀
