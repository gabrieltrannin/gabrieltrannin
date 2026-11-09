# Otimizador Gamer

Ferramenta portátil para Windows 10/11 que deixa o PC mais leve e estável para jogar (Fortnite, CS2, LoL e outros). Roda direto do pendrive, sem instalar nada, e não apaga arquivos pessoais.

## Como usar

1. Baixe esta pasta (ou o `.zip`) e copie para o pendrive.
2. Dê dois cliques em `INICIAR.bat` e aceite a permissão de administrador.
3. Escolha **1 (Modo guiado)**.
4. Reinicie o PC e abra o guia (opção **G**) para BIOS, driver NVIDIA e configurações de cada jogo.

## O que ele faz

| Opção | O que faz |
|---|---|
| Diagnóstico | Lê o PC e gera um relatório HTML com cada problema e como resolver: RAM em single channel ou sem XMP, monitor abaixo dos Hz máximos, driver antigo, disco cheio ou com problema, plano de energia, Game Bar gravando, programas pesados, otimizadores/antivírus duplicados, Wi-Fi, ping e perda de pacotes. |
| Otimizações | Plano Alto desempenho, Modo de Jogo, desliga gravação da Game Bar, otimização de jogos em janela (Win 11), mouse sem aceleração, sem atalho de Teclas de Aderência, sem Inicialização rápida, sem apps patrocinados. HAGS opcional. |
| Limpeza | Temporários, relatórios de erro, cache do Windows Update e da Otimização de Entrega. Opcionais: DISM, Lixeira e cache de shaders. |
| Inicialização | Liga/desliga programas que abrem com o Windows (mesmo método do Gerenciador de Tarefas). |
| Apps inúteis | Remove apps de fábrica (Notícias, Clima, Solitaire, Clipchamp, Candy Crush...). Tudo reinstalável pela Store. |
| Monitor | Mede CPU, núcleo mais usado, GPU, temperatura da GPU e RAM durante o jogo e aponta o gargalo. |
| Reparo | Verificação rápida do Defender, DISM + SFC e verificação do disco. |
| Desfazer | Volta todas as configurações alteradas usando o backup em `Dados/Backups`. |

## Segurança

- Toda alteração de registro e plano de energia é salva em backup antes de ser feita.
- Oferece ponto de restauração do Windows antes da primeira mudança.
- Limpeza só apaga dentro de uma lista fixa de pastas de cache/temporários.
- Não usa limpador de registro, liberador de RAM, "tweaks de ping" nem desliga antivírus/Windows Update.
- Não mexe em arquivos de jogos nem em anti-cheat.

## Arquivos

```
INICIAR.bat              abre o programa (pede administrador)
LEIA-ME.txt              instruções rápidas
app/OtimizadorGamer.ps1  o programa (PowerShell 5.1, já incluso no Windows)
app/Guia.html            guia de BIOS, NVIDIA, Fortnite, CS2, LoL, rede e temperatura
```
