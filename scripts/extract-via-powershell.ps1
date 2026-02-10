# Configuração
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path $ScriptDir "..\.env.local"
$PdfPath = $args[0]

# Carregar API Key do .env.local
if (Test-Path $EnvPath) {
    echo "📄 Lendo .env.local..."
    $EnvContent = Get-Content $EnvPath
    foreach ($line in $EnvContent) {
        if ($line -match "^ANTHROPIC_API_KEY=(.+)$") {
            $ApiKey = $matches[1]
        }
    }
}

if (-not $ApiKey) {
    Write-Error "❌ ANTHROPIC_API_KEY não encontrada no .env.local"
    exit 1
}

if (-not $PdfPath -or -not (Test-Path $PdfPath)) {
    Write-Error "❌ PDF não encontrado: $PdfPath"
    exit 1
}

$PdfName = Split-Path -Leaf $PdfPath
echo "🚀 Processando: $PdfName"

# Converter PDF para Base64
echo "📄 Convertendo PDF para Base64..."
$PdfBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$PdfBase64 = [Convert]::ToBase64String($PdfBytes)
echo "✅ Convertido ($($PdfBase64.Length) caracteres)"

# Montar Payload
$Payload = @{
    model      = "claude-3-5-sonnet-latest"
    max_tokens = 4096
    messages   = @(
        @{
            role    = "user"
            content = @(
                @{
                    type   = "document"
                    source = @{
                        type       = "base64"
                        media_type = "application/pdf"
                        data       = $PdfBase64
                    }
                },
                @{
                    type = "text"
                    text = "Você é um especialista em extrair questões de provas médicas.`nAnalise o PDF acima e extraia TODAS as questões de múltipla escolha.`n`nPara cada questão, retorne no formato JSON:`n{`n    ""numero"": 1,`n    ""texto_questao"": ""enunciado completo da questão"",`n    ""alternativa_a"": ""texto completo da alternativa A"",`n    ""alternativa_b"": ""texto completo da alternativa B"",`n    ""alternativa_c"": ""texto completo da alternativa C"",`n    ""alternativa_d"": ""texto completo da alternativa D"",`n    ""alternativa_e"": ""texto completo da alternativa E ou null se não houver"",`n    ""area"": ""Cirurgia"" | ""Clínica Médica"" | ""GO"" | ""Pediatria"" | ""Medicina Preventiva"" | ""Todas as áreas"",`n    ""subarea"": ""subárea específica ou null"",`n    ""dificuldade"": ""facil"" | ""media"" | ""dificil""`n}`n`nIMPORTANTE:`n- Retorne APENAS um array JSON válido`n- Não invente ou omita informações`n- Se não conseguir classificar área, use ""Todas as áreas""`n`nRetorne o JSON:"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

# Salvar payload para debug (opcional)
# $Payload | Out-File "payload_debug.json" -Encoding utf8

echo "🤖 Enviando para Claude API (via PowerShell Invoke-RestMethod)..."

try {
    $Response = Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" `
        -Method Post `
        -Headers @{
        "x-api-key"         = $ApiKey
        "anthropic-version" = "2023-06-01"
        "Content-Type"      = "application/json"
    } `
        -Body $Payload `
        -TimeoutSec 120

    echo "✅ Resposta recebida!"
    
    # Salvar resposta bruta
    $Response | ConvertTo-Json -Depth 10 | Out-File "claude_response.json" -Encoding utf8
    
    echo "💾 Resposta salva em claude_response.json"
    echo "🔄 Execute 'node scripts/process-json.js' para gerar o SQL"
    
}
catch {
    Write-Error "❌ Erro na requisição: $_"
    if ($_.Exception.Response) {
        $Stream = $_.Exception.Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($Stream)
        $Body = $Reader.ReadToEnd()
        echo "Detalhes do erro: $Body"
    }
    exit 1
}
