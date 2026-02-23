# Arquivos Modelo - C.R.I.S.

Este diretório contém os arquivos modelo vazios para iniciar um novo projeto C.R.I.S. (Central de Rastreamento e Investigação de Sinais).

## Arquivos

### CRIS-locaisdefault.json
Arquivo para localizações padrão/permanentes do sistema.

### CRIS-locais.json
Arquivo para localizações customizadas, conexões e zonas de investigação.

## Estrutura dos Arquivos

Ambos os arquivos seguem a estrutura:

```json
{
  "defaults": [],        // Apenas em CRIS-locaisdefault.json
  "custom": [],          // Apenas em CRIS-locais.json
  "connections": [],     // Conexões entre locais
  "zones": [],          // Zonas de perigo/investigação
  "timestamp": ""       // Data de última modificação
}
```

## Como Usar

1. Copie os arquivos modelo para a raiz do projeto
2. Adicione suas localizações, conexões e zonas conforme necessário
3. O sistema carregará automaticamente os dados

## Tipos de Localização

- **base**: Bases da Ordem Realitas (verde)
- **casa**: Casas de agentes (azul)
- **loja**: Lojas/Contatos de suporte (ouro)
- **paranormal**: Manifestações paranormais (vermelho)
