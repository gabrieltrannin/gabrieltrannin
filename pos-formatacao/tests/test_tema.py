"""Testes das imagens do visual "vidro noturno" (precisam do Pillow)."""

import tempfile
import unittest
from pathlib import Path

try:
    from instalador import tema
except ImportError:  # sem Pillow ou sem tkinter
    tema = None


@unittest.skipIf(tema is None, "precisa do Pillow: pip install -r requirements.txt")
class TestTema(unittest.TestCase):
    def test_fundo_tem_o_tamanho_da_janela(self):
        fundo = tema.compor_fundo(480, 330, [(12, 50, 237, 210)], 9, 0.5)
        self.assertEqual(fundo.size, (480, 330))
        self.assertEqual(fundo.mode, "RGBA")

    def test_cartao_de_vidro_e_mais_claro_que_o_ceu(self):
        cartao = (40, 40, 200, 160)
        fundo = tema.compor_fundo(400, 300, [cartao], 10, 1.0)
        ceu = tema.compor_fundo(400, 300, [], 10, 1.0)
        brilho = lambda img: sum(tema.cor_media(img.crop(cartao)))  # noqa: E731
        self.assertGreater(brilho(fundo), brilho(ceu))

    def test_pilula_tem_cantos_transparentes(self):
        pilula = tema.pilula(60, 20)
        self.assertEqual(pilula.getpixel((0, 0))[3], 0)
        self.assertEqual(pilula.getpixel((30, 10))[3], 255)

    def test_salva_o_icone(self):
        caminho = Path(tempfile.mkdtemp()) / "icone.ico"
        tema.salvar_icone(str(caminho))
        self.assertGreater(caminho.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
