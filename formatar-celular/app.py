"""Formatar Celular pelo PC — janela do programa.

Como usar:
    python app.py
"""

from __future__ import annotations

import datetime as dt
import os
import platform
import queue
import re
import subprocess
import sys
import threading
import tkinter as tk
import tkinter.font as tkfont
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from tkinter.scrolledtext import ScrolledText

import adb_tools as at

PALAVRA_DE_CONFIRMACAO = "FORMATAR"
BATERIA_MINIMA = 30

TEXTO_COMO_CONECTAR = """Para o PC conseguir falar com o celular, ative a Depuração USB:

1. Abra Configurações > Sobre o telefone.
2. Toque 7 vezes em "Número da versão" (ou "Versão do MIUI" / "Número de compilação") até aparecer "Você agora é um desenvolvedor".
3. Entre em Configurações > Sistema > Opções do desenvolvedor.
4. Ative "Depuração USB".
5. Conecte o cabo USB, desbloqueie a tela e toque em "Permitir" na mensagem "Permitir depuração USB?".
6. Clique em "Procurar celular".

Dicas:
• Use um cabo que transmita dados (alguns cabos só carregam).
• No Windows, alguns celulares precisam do driver USB do fabricante (Samsung, Motorola, Xiaomi...)."""

TEXTO_RECOVERY = """Agora é com você, no próprio celular:

• Use os botões de VOLUME para mover e o botão LIGA/DESLIGA para confirmar. (Em alguns Xiaomi dá para tocar na tela.)

• Se aparecer um robô deitado escrito "Nenhum comando" / "No command": segure LIGA/DESLIGA e aperte VOLUME PARA CIMA uma vez. Solte os dois.

1. Escolha "Wipe data/factory reset" (ou "Apagar dados" / "Wipe Data").
2. Confirme com "Factory data reset" / "Yes" / "Wipe All Data".
3. Espere terminar e escolha "Reboot system now" (Reiniciar sistema).

A primeira inicialização depois de formatar pode demorar alguns minutos."""


def caminho_do_recurso(nome: str) -> Path:
    """Arquivo que acompanha o programa (no .exe, fica na pasta temporária sys._MEIPASS)."""
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / nome


def nome_de_arquivo_seguro(texto: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "-", texto).strip() or "celular"


def abrir_pasta(pasta: Path) -> None:
    try:
        if os.name == "nt":
            os.startfile(pasta)  # type: ignore[attr-defined]
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", str(pasta)])
        else:
            subprocess.Popen(["xdg-open", str(pasta)])
    except OSError:
        messagebox.showinfo("Backup", f"O backup está em:\n{pasta}")


class App:
    def __init__(self, raiz: tk.Tk):
        self.raiz = raiz
        self.fila: queue.Queue = queue.Queue()
        self.ocupado = False
        self.celular: at.Celular | None = None
        self.aparelhos: list[at.Aparelho] = []
        self.info: at.InfoAparelho | None = None

        raiz.title("Formatar Celular pelo PC")
        raiz.minsize(680, 640)
        try:
            raiz.iconphoto(True, tk.PhotoImage(file=str(caminho_do_recurso("icone.png"))))
        except tk.TclError:
            pass  # sem ícone, o programa funciona do mesmo jeito
        raiz.protocol("WM_DELETE_WINDOW", self.fechar)
        self._montar_tela()
        self.raiz.after(100, self._processar_fila)
        self.raiz.after(200, self.verificar_ferramentas)

    # ------------------------------------------------------------------
    # Montagem da tela
    # ------------------------------------------------------------------

    def _montar_tela(self) -> None:
        fonte_titulo = tkfont.nametofont("TkDefaultFont").copy()
        fonte_titulo.configure(size=16, weight="bold")
        fonte_negrito = tkfont.nametofont("TkDefaultFont").copy()
        fonte_negrito.configure(weight="bold")

        estilo = ttk.Style(self.raiz)
        estilo.configure("Titulo.TLabel", font=fonte_titulo)
        estilo.configure("Aviso.TLabel", foreground="#b45309")
        estilo.configure("Dica.TLabel", foreground="#555555")
        estilo.configure("Perigo.TButton", foreground="#b91c1c", font=fonte_negrito)

        tela = ttk.Frame(self.raiz, padding=12)
        tela.pack(fill="both", expand=True)

        ttk.Label(tela, text="Formatar Celular pelo PC", style="Titulo.TLabel").pack(anchor="w")
        ttk.Label(
            tela, style="Aviso.TLabel",
            text="Para celulares Android. Formatar apaga TUDO: fotos, apps, mensagens, contas e arquivos.",
        ).pack(anchor="w", pady=(0, 8))

        # 1. Conectar --------------------------------------------------------
        conectar = ttk.LabelFrame(tela, text=" 1. Conectar o celular ", padding=8)
        conectar.pack(fill="x")

        linha = ttk.Frame(conectar)
        linha.pack(fill="x")
        self.var_ferramentas = tk.StringVar(value="Verificando ferramentas...")
        ttk.Label(linha, textvariable=self.var_ferramentas).pack(side="left")
        self.bt_baixar = ttk.Button(linha, text="Baixar ferramentas (ADB)", command=self.baixar_ferramentas)
        self.bt_baixar.pack(side="right")

        linha = ttk.Frame(conectar)
        linha.pack(fill="x", pady=(8, 0))
        self.bt_procurar = ttk.Button(linha, text="Procurar celular", command=self.procurar_celular)
        self.bt_procurar.pack(side="left")
        self.combo = ttk.Combobox(linha, state="readonly")
        self.combo.pack(side="left", padx=6, fill="x", expand=True)
        self.combo.bind("<<ComboboxSelected>>", lambda _evento: self._aparelho_escolhido())
        ttk.Button(linha, text="Como conectar?", command=self.mostrar_como_conectar).pack(side="right")

        self.var_info = tk.StringVar(value="Nenhum celular encontrado ainda.")
        ttk.Label(conectar, textvariable=self.var_info, wraplength=620, justify="left").pack(
            anchor="w", pady=(8, 0))
        self.var_contas = tk.StringVar()
        ttk.Label(conectar, textvariable=self.var_contas, style="Aviso.TLabel",
                  wraplength=620, justify="left").pack(anchor="w")

        # 2. Backup ----------------------------------------------------------
        backup = ttk.LabelFrame(tela, text=" 2. Fazer backup (recomendado) ", padding=8)
        backup.pack(fill="x", pady=(10, 0))
        ttk.Label(
            backup, wraplength=620, justify="left",
            text="Copia fotos, vídeos, músicas, downloads, documentos e mídia do WhatsApp para o PC.",
        ).pack(anchor="w")
        ttk.Label(
            backup, style="Dica.TLabel", wraplength=620, justify="left",
            text="Contatos, conversas e apps não entram aqui: sincronize-os com a sua conta Google "
                 "(Configurações > Google > Backup) e faça o backup do WhatsApp pelo próprio app.",
        ).pack(anchor="w")
        self.bt_backup = ttk.Button(backup, text="Fazer backup...", command=self.fazer_backup)
        self.bt_backup.pack(anchor="w", pady=(6, 0))

        # 3. Formatar --------------------------------------------------------
        formatar = ttk.LabelFrame(tela, text=" 3. Formatar ", padding=8)
        formatar.pack(fill="x", pady=(10, 0))
        self.var_metodo = tk.StringVar(value="recovery")
        ttk.Radiobutton(formatar, text="Pelo modo Recovery (recomendado)",
                        value="recovery", variable=self.var_metodo).pack(anchor="w")
        ttk.Label(
            formatar, style="Dica.TLabel", wraplength=600, justify="left",
            text="Funciona na maioria dos Android. O PC reinicia o celular no Recovery e você "
                 "confirma a formatação com os botões do aparelho.",
        ).pack(anchor="w", padx=(22, 0))
        ttk.Radiobutton(formatar, text="Pelo Fastboot (automático)",
                        value="fastboot", variable=self.var_metodo).pack(anchor="w", pady=(6, 0))
        ttk.Label(
            formatar, style="Dica.TLabel", wraplength=600, justify="left",
            text="Faz tudo sozinho, mas só funciona com o bootloader DESBLOQUEADO "
                 "(Pixel, Motorola, Xiaomi...). Não existe em celulares Samsung.",
        ).pack(anchor="w", padx=(22, 0))
        self.bt_formatar = ttk.Button(formatar, text="FORMATAR CELULAR", style="Perigo.TButton",
                                      command=self.formatar)
        self.bt_formatar.pack(anchor="w", pady=(8, 0))

        # Registro -----------------------------------------------------------
        registro = ttk.LabelFrame(tela, text=" Registro ", padding=8)
        registro.pack(fill="both", expand=True, pady=(10, 0))
        self.progresso = ttk.Progressbar(registro, mode="determinate", value=0)
        self.progresso.pack(fill="x", pady=(0, 6))
        self.texto_log = ScrolledText(registro, height=8, state="disabled", wrap="word")
        self.texto_log.pack(fill="both", expand=True)

        self._atualizar_botoes()

    # ------------------------------------------------------------------
    # Tarefas em segundo plano (a janela não trava enquanto o celular trabalha)
    # ------------------------------------------------------------------

    def log(self, texto: str) -> None:
        """Pode ser chamado de qualquer thread."""
        self.fila.put(("log", texto))

    def _escrever_log(self, texto: str) -> None:
        self.texto_log.configure(state="normal")
        self.texto_log.insert("end", f"[{dt.datetime.now():%H:%M:%S}] {texto}\n")
        self.texto_log.see("end")
        self.texto_log.configure(state="disabled")

    def _em_segundo_plano(self, tarefa, ao_terminar=None) -> None:
        if self.ocupado:
            return
        self._definir_ocupado(True)

        def executar():
            try:
                resultado, erro = tarefa(), None
            except at.ErroADB as e:
                resultado, erro = None, str(e)
            except Exception as e:  # erro inesperado: mostra em vez de fechar o programa
                resultado, erro = None, f"Erro inesperado: {e!r}"
            self.fila.put(("fim", (ao_terminar, resultado, erro)))

        threading.Thread(target=executar, daemon=True).start()

    def _processar_fila(self) -> None:
        try:
            while True:
                tipo, dado = self.fila.get_nowait()
                if tipo == "log":
                    self._escrever_log(dado)
                elif tipo == "fim":
                    ao_terminar, resultado, erro = dado
                    self._definir_ocupado(False)
                    if erro:
                        self._escrever_log(f"✖ {erro}")
                        messagebox.showerror("Formatar Celular pelo PC", erro, parent=self.raiz)
                    elif ao_terminar:
                        ao_terminar(resultado)
        except queue.Empty:
            pass
        finally:
            self.raiz.after(100, self._processar_fila)

    def _definir_ocupado(self, ocupado: bool) -> None:
        self.ocupado = ocupado
        if ocupado:
            self.progresso.configure(mode="indeterminate")
            self.progresso.start(12)
        else:
            self.progresso.stop()
            self.progresso.configure(mode="determinate", value=0)
        self._atualizar_botoes()

    def _atualizar_botoes(self) -> None:
        aparelho = self._aparelho_atual()

        def ligar(botao, condicao: bool) -> None:
            botao.state(["!disabled"] if condicao and not self.ocupado else ["disabled"])

        ligar(self.bt_baixar, True)
        ligar(self.bt_procurar, self.celular is not None)
        ligar(self.bt_backup, aparelho is not None and aparelho.pronto_para_adb)
        ligar(self.bt_formatar, aparelho is not None and (
            aparelho.pronto_para_adb or aparelho.em_fastboot or aparelho.em_recovery))
        self.combo.state(["disabled"] if self.ocupado else ["!disabled", "readonly"])

    # ------------------------------------------------------------------
    # 1. Ferramentas e conexão
    # ------------------------------------------------------------------

    def verificar_ferramentas(self) -> None:
        try:
            self.celular = at.Celular.localizar()
        except at.ErroADB:
            self.celular = None
            self.var_ferramentas.set("✖ ADB não encontrado. Clique em \"Baixar ferramentas\".")
            self._escrever_log("O ADB (Android Platform Tools) não foi encontrado neste PC.")
        else:
            aviso = "" if self.celular.fastboot_exe else " (fastboot não encontrado)"
            self.var_ferramentas.set(f"✔ ADB encontrado{aviso}")
            self.bt_baixar.configure(text="Atualizar ferramentas")
            self._escrever_log(f"ADB: {self.celular.adb_exe}")
            self.procurar_celular()
        self._atualizar_botoes()

    def baixar_ferramentas(self) -> None:
        confirmou = messagebox.askokcancel(
            "Baixar ferramentas",
            "O programa vai baixar o Android SDK Platform Tools (ADB e Fastboot, cerca de 10 MB) "
            "do site oficial do Google para a pasta:\n\n"
            f"{at.PASTA_PLATFORM_TOOLS}\n\n"
            "Ao baixar, você concorda com os termos de uso do Android SDK. Continuar?",
            parent=self.raiz,
        )
        if not confirmou:
            return
        celular_atual = self.celular

        def tarefa():
            if celular_atual:
                celular_atual.parar_servidor()  # libera o adb.exe para ser substituído
            self.log("Baixando o Android Platform Tools do Google...")
            at.baixar_platform_tools(lambda p: self.log(f"  {p}%") if p % 25 == 0 else None)

        def terminou(_):
            self._escrever_log("✔ Ferramentas instaladas.")
            self.verificar_ferramentas()

        self._em_segundo_plano(tarefa, terminou)

    def mostrar_como_conectar(self) -> None:
        messagebox.showinfo("Como conectar o celular", TEXTO_COMO_CONECTAR, parent=self.raiz)

    def procurar_celular(self) -> None:
        if not self.celular:
            return
        self._escrever_log("Procurando celulares conectados...")
        self._em_segundo_plano(self.celular.listar_aparelhos, self._mostrar_aparelhos)

    def _aparelho_atual(self) -> at.Aparelho | None:
        indice = self.combo.current()
        if 0 <= indice < len(self.aparelhos):
            return self.aparelhos[indice]
        return None

    def _limpar_aparelhos(self, mensagem: str) -> None:
        self.aparelhos = []
        self.info = None
        self.combo["values"] = []
        self.combo.set("")
        self.var_info.set(mensagem)
        self.var_contas.set("")
        self._atualizar_botoes()

    def _mostrar_aparelhos(self, aparelhos: list[at.Aparelho]) -> None:
        anterior = self._aparelho_atual()
        if not aparelhos:
            self._limpar_aparelhos("Nenhum celular encontrado. Conecte o cabo USB e ative a "
                                   "Depuração USB (veja \"Como conectar?\").")
            self._escrever_log("Nenhum celular encontrado.")
            return
        self.aparelhos = aparelhos
        self.combo["values"] = [a.descricao() for a in aparelhos]
        indice = 0
        if anterior:
            for i, aparelho in enumerate(aparelhos):
                if aparelho.serial == anterior.serial:
                    indice = i
        self.combo.current(indice)
        self._escrever_log(f"{len(aparelhos)} aparelho(s) encontrado(s).")
        self._aparelho_escolhido()

    def _aparelho_escolhido(self) -> None:
        aparelho = self._aparelho_atual()
        self.info = None
        self.var_contas.set("")
        if aparelho is None:
            return
        if aparelho.estado == "unauthorized":
            self.var_info.set("Desbloqueie a tela do celular e toque em \"Permitir\" na mensagem "
                              "\"Permitir depuração USB?\". Depois clique em \"Procurar celular\".")
        elif aparelho.estado == "sem-permissao":
            self.var_info.set("O Linux não deu permissão para acessar o celular pelo USB. "
                              "Configure as regras udev (veja o README) e tente de novo.")
        elif aparelho.estado == "offline":
            self.var_info.set("O celular não está respondendo. Desconecte e conecte o cabo USB de novo.")
        elif aparelho.em_fastboot:
            self.var_info.set("Celular em modo fastboot. Dá para formatar, mas o backup precisa "
                              "do celular ligado normalmente.")
        elif aparelho.em_recovery:
            self.var_info.set("Celular em modo Recovery. Use os botões do aparelho para formatar "
                              "(clique em \"FORMATAR CELULAR\" para ver o passo a passo).")
        elif aparelho.pronto_para_adb and self.celular:
            self.var_info.set("Lendo informações do celular...")
            celular = self.celular
            self._em_segundo_plano(lambda: celular.informacoes(aparelho.serial), self._mostrar_info)
        self._atualizar_botoes()

    def _mostrar_info(self, info: at.InfoAparelho) -> None:
        self.info = info
        texto = info.resumo()
        if info.bateria is not None and info.bateria < BATERIA_MINIMA:
            texto += f"\n⚠ Bateria baixa: carregue até pelo menos {BATERIA_MINIMA}% antes de formatar."
        self.var_info.set(texto)
        if info.contas_google:
            self.var_contas.set(
                "⚠ Conta Google no celular: " + ", ".join(info.contas_google) + "\n"
                "Depois de formatar, o celular vai pedir essa conta e a senha (proteção contra roubo). "
                "Tenha a senha em mãos ou remova a conta em Configurações > Contas antes."
            )
        self._escrever_log(f"Celular: {info.resumo()}")

    # ------------------------------------------------------------------
    # 2. Backup
    # ------------------------------------------------------------------

    def fazer_backup(self) -> None:
        aparelho = self._aparelho_atual()
        if not aparelho or not aparelho.pronto_para_adb or not self.celular:
            return
        pasta = filedialog.askdirectory(title="Escolha onde salvar o backup", parent=self.raiz)
        if not pasta:
            return
        nome = (self.info.modelo if self.info else "") or aparelho.modelo or aparelho.serial
        destino = Path(pasta) / f"Backup {nome_de_arquivo_seguro(nome)} {dt.datetime.now():%Y-%m-%d %H-%M}"
        self._escrever_log(f"Salvando backup em: {destino}")
        celular = self.celular

        def terminou(resultado: tuple[int, list[str]]) -> None:
            copiadas, falhas = resultado
            if copiadas == 0 and not falhas:
                messagebox.showinfo("Backup", "Nenhuma das pastas comuns foi encontrada no celular.",
                                    parent=self.raiz)
                return
            mensagem = f"Backup concluído: {copiadas} pasta(s) copiada(s) para\n{destino}"
            if falhas:
                mensagem += "\n\nCom problemas: " + ", ".join(falhas) + " (veja o registro)."
            mensagem += "\n\nConfira os arquivos antes de formatar. Abrir a pasta agora?"
            self._escrever_log(f"✔ Backup terminado: {copiadas} pasta(s) copiada(s)"
                               + (f", {len(falhas)} com problema." if falhas else "."))
            if messagebox.askyesno("Backup", mensagem, parent=self.raiz):
                abrir_pasta(destino)

        self._em_segundo_plano(lambda: celular.fazer_backup(aparelho.serial, destino, self.log), terminou)

    # ------------------------------------------------------------------
    # 3. Formatar
    # ------------------------------------------------------------------

    def formatar(self) -> None:
        aparelho = self._aparelho_atual()
        if not aparelho or not self.celular:
            return
        if aparelho.em_recovery:
            messagebox.showinfo("O celular já está no Recovery", TEXTO_RECOVERY, parent=self.raiz)
            return

        metodo = self.var_metodo.get()
        if metodo == "fastboot" and self.info and self.info.eh_samsung:
            messagebox.showwarning(
                "Fastboot não disponível",
                "Celulares Samsung não têm o modo Fastboot. Escolha o método \"Recovery\".",
                parent=self.raiz,
            )
            return

        avisos = ["Isso vai APAGAR TUDO do celular: fotos, vídeos, apps, mensagens, contas e "
                  "arquivos. Não dá para desfazer."]
        if self.info and self.info.contas_google:
            avisos.append("Depois de formatar, o celular vai pedir a conta Google "
                          f"{', '.join(self.info.contas_google)} e a senha dela.")
        else:
            avisos.append("Se o celular tiver uma conta Google, ela vai ser pedida depois de "
                          "formatar. Tenha o e-mail e a senha em mãos.")
        if self.info and self.info.bateria is not None and self.info.bateria < BATERIA_MINIMA:
            avisos.append(f"⚠ A bateria está em {self.info.bateria}%. O recomendado é pelo menos "
                          f"{BATERIA_MINIMA}%.")
        avisos.append(f"Para continuar, digite {PALAVRA_DE_CONFIRMACAO} abaixo:")

        resposta = simpledialog.askstring("Confirmar formatação", "\n\n".join(avisos), parent=self.raiz)
        if resposta is None:
            return
        if resposta.strip().upper() != PALAVRA_DE_CONFIRMACAO:
            messagebox.showinfo("Cancelado", "Texto diferente de FORMATAR. Nada foi feito.",
                                parent=self.raiz)
            return

        nome = (self.info.resumo() if self.info else "") or aparelho.descricao()
        celular = self.celular
        if metodo == "fastboot":
            self._escrever_log(f"=== Formatação pelo Fastboot: {nome} ===")
            self._em_segundo_plano(lambda: celular.formatar_via_fastboot(aparelho, self.log),
                                   self._depois_do_fastboot)
        else:
            self._escrever_log(f"=== Formatação pelo Recovery: {nome} ===")
            self._escrever_log("Reiniciando o celular no modo Recovery...")
            self._em_segundo_plano(lambda: celular.reiniciar_no_recovery(aparelho),
                                   self._depois_do_recovery)

    def _depois_do_recovery(self, _=None) -> None:
        self._escrever_log("✔ Celular reiniciando no Recovery. Siga as instruções na tela do celular.")
        self._limpar_aparelhos("O celular foi reiniciado no modo Recovery. Termine a formatação "
                               "nos botões do aparelho.")
        messagebox.showinfo("Termine no celular", "O celular está reiniciando no modo Recovery.\n\n"
                            + TEXTO_RECOVERY, parent=self.raiz)

    def _depois_do_fastboot(self, _=None) -> None:
        self._escrever_log("✔ Formatação concluída. O celular está reiniciando.")
        self._limpar_aparelhos("Celular formatado. Ele está reiniciando como novo.")
        messagebox.showinfo(
            "Pronto!",
            "O celular foi formatado e está reiniciando.\n\n"
            "A primeira inicialização pode demorar alguns minutos. Se ele pedir uma conta Google, "
            "use a conta que estava no aparelho antes.",
            parent=self.raiz,
        )

    # ------------------------------------------------------------------

    def fechar(self) -> None:
        if self.ocupado and not messagebox.askyesno(
            "Operação em andamento",
            "O programa ainda está conversando com o celular. Fechar agora pode interromper "
            "o processo. Fechar mesmo assim?",
            parent=self.raiz,
        ):
            return
        self.raiz.destroy()


def _ativar_nitidez_no_windows() -> None:
    """Evita que a janela fique borrada em telas com zoom (125%, 150%...)."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except (AttributeError, OSError):
            pass


def main() -> None:
    _ativar_nitidez_no_windows()
    raiz = tk.Tk()
    App(raiz)
    if "--autoteste" in sys.argv:
        # Usado pelo GitHub Actions: abre a janela, espera um pouco e fecha.
        raiz.after(3000, raiz.destroy)
    raiz.mainloop()


if __name__ == "__main__":
    main()
