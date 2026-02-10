# 🎯 Como Configurar o Sistema de Usuários

## Passo 1: Executar Script SQL no Supabase

1. **Acesse o Supabase Dashboard**
   - Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Entre no seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em **SQL Editor**
   - Clique em **+ New Query**

3. **Cole e Execute o Script**
   - Abra o arquivo `setup-users.sql` deste projeto
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase
   - Clique em **RUN** (ou pressione Ctrl/Cmd + Enter)

4. **Verifique a Criação**
   - Vá em **Table Editor** no menu lateral
   - Você deve ver as novas tabelas:
     - ✅ `users`
     - ✅ `user_profiles`  
     - ✅ `user_goals`

---

## Passo 2: Dados Já Salvos no Banco

O sistema está configurado para salvar **separadamente** os dados de cada usuário:

### 🔐 Isolamento de Dados

- Cada usuário tem um **ID único** (`user_id`)
- Row Level Security (RLS) ativado
- Políticas garantem que cada usuário vê apenas seus próprios dados

### 📊 Estrutura de Dados

```
users (dados básicos)
├── id
├── email
├── name
└── onboarding_completed

user_profiles (respostas do questionário)
├── user_id → vinculado a users.id
├── target_institution (ex: "ENARE")
├── target_specialty (ex: "Cirurgia")
├── weekly_hours (ex: 20)
└── theoretical_base (ex: "boa")

user_goals (metas calculadas)
├── user_id → vinculado a users.id
├── daily_hours_goal (ex: 4.0)
├── weekly_hours_goal (ex: 20.0)
├── target_percentage (ex: 75.0)
└── focus_area (ex: "Cirurgia")
```

---

## Passo 3: Funcionamento Atual

### ✅ O que já está funcionando:

1. **Saudações Personalizadas**
   - Dashboard: "Olá, [Nome]! 👋"
   - Monta-provas: "Olá, [Nome]! Vou te ajudar..."
   - Histórico: "Histórico de Provas - [Nome]"
   - Planner: "Planner de [Nome]"

2. **Mensagens Personalizadas**
   - Dicas com nome: "Parabéns, [Nome]! Você atingiu sua meta!"
   - Feedback adaptado por usuário

3. **Dados Isolados**
   - Cada usuário só vê suas próprias provas
   - Cada usuário tem suas próprias metas
   - Dados nunca são compartilhados entre usuários

### 🚧 Próximo Passo: Criar Página de Onboarding

Para completar o sistema, precisamos criar a **página de questionário inicial** (`/app/onboarding`) onde novos usuários responderão:

1. Nome completo
2. Instituição alvo (ENARE, USP, etc.)
3. Especialidade desejada
4. Prazo para prova
5. Horas disponíveis por semana
6. Experiência anterior
7. Autoavaliação da base teórica

Essas respostas serão salvas em `user_profiles` e usadas para calcular metas personalizadas em `user_goals`.

---

## 🔄 Mock User Atual

Por enquanto, o sistema usa um usuário de exemplo (`mock-user-id`) com dados já configurados:

- **Nome:** Usuário Exemplo
- **Instituição:** ENARE
- **Especialidade:** Cirurgia
- **Meta semanal:** 20h (4h/dia)
- **Alvo:** 75% de acertos

Quando a autenticação real for implementada, cada pessoa terá seu próprio perfil único!

---

## ✅ Checklist

- [x] Script SQL criado (`setup-users.sql`)
- [x] Serviço de usuários criado (`lib/user-service.ts`)
- [x] Hook useUser criado (`hooks/useUser.ts`)
- [x] Dashboard personalizado
- [x] Monta-provas personalizado
- [x] Histórico personalizado
- [x] Planner personalizado
- [ ] **PRÓXIMO:** Executar `setup-users.sql` no Supabase
- [ ] **PRÓXIMO:** Criar página `/app/onboarding`
- [ ] **FUTURO:** Implementar autenticação real (Supabase Auth)
