"""Testes das funções que interpretam as respostas do ADB e do Fastboot.

Rodar (dentro da pasta formatar-celular):
    python -m unittest discover -s tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import adb_tools as at  # noqa: E402


class TestAdbDevices(unittest.TestCase):
    def test_varios_estados(self):
        saida = (
            "List of devices attached\n"
            "R58M123ABC             device usb:1-1 product:beyond1lteeea model:SM_G973F device:beyond1 transport_id:1\n"
            "0A1B2C3D4E             unauthorized usb:1-2 transport_id:2\n"
            "192.168.0.5:5555       offline transport_id:3\n"
            "\n"
        )
        aparelhos = at.interpretar_adb_devices(saida)
        self.assertEqual([a.serial for a in aparelhos], ["R58M123ABC", "0A1B2C3D4E", "192.168.0.5:5555"])
        self.assertEqual(aparelhos[0].modelo, "SM G973F")
        self.assertTrue(aparelhos[0].pronto_para_adb)
        self.assertEqual(aparelhos[1].estado, "unauthorized")
        self.assertFalse(aparelhos[1].pronto_para_adb)
        self.assertEqual(aparelhos[2].estado, "offline")

    def test_sem_aparelhos_e_mensagens_do_servidor(self):
        saida = (
            "* daemon not running; starting now at tcp:5037\n"
            "* daemon started successfully\n"
            "List of devices attached\n\n"
        )
        self.assertEqual(at.interpretar_adb_devices(saida), [])

    def test_sem_permissao_no_linux(self):
        saida = (
            "List of devices attached\n"
            "0123456789ABCDEF       no permissions (missing udev rules? user is in the plugdev group); "
            "see [http://developer.android.com/tools/device.html]\n"
        )
        (aparelho,) = at.interpretar_adb_devices(saida)
        self.assertEqual(aparelho.estado, "sem-permissao")

    def test_recovery(self):
        (aparelho,) = at.interpretar_adb_devices("List of devices attached\nABC\trecovery\n")
        self.assertTrue(aparelho.em_recovery)


class TestFastbootDevices(unittest.TestCase):
    def test_lista(self):
        aparelhos = at.interpretar_fastboot_devices("8A1X0ABC\tfastboot\nXYZ\t fastbootd\n")
        self.assertEqual([a.serial for a in aparelhos], ["8A1X0ABC", "XYZ"])
        self.assertTrue(all(a.em_fastboot for a in aparelhos))

    def test_vazio(self):
        self.assertEqual(at.interpretar_fastboot_devices(""), [])


class TestInformacoes(unittest.TestCase):
    def test_getprop(self):
        saida = (
            "[ro.build.version.release]: [14]\n"
            "[ro.product.manufacturer]: [motorola]\n"
            "[ro.product.model]: [moto g54 5G]\n"
            "[ro.vazio]: []\n"
        )
        propriedades = at.interpretar_getprop(saida)
        self.assertEqual(propriedades["ro.product.model"], "moto g54 5G")
        self.assertEqual(propriedades["ro.build.version.release"], "14")
        self.assertEqual(propriedades["ro.vazio"], "")

    def test_bateria(self):
        saida = (
            "Current Battery Service state:\n"
            "  AC powered: false\n"
            "  USB powered: true\n"
            "  level: 87\n"
            "  scale: 100\n"
        )
        self.assertEqual(at.interpretar_bateria(saida), 87)
        self.assertIsNone(at.interpretar_bateria("nada aqui"))

    def test_contas_google_sem_repetir(self):
        saida = (
            "Accounts: 3\n"
            "    Account {name=fulano@gmail.com, type=com.google}\n"
            "    Account {name=fulano@whatsapp, type=com.whatsapp}\n"
            "    Account {name=outra.conta@gmail.com, type=com.google}\n"
            "  Account visibility:\n"
            "    Account {name=fulano@gmail.com, type=com.google}\n"
        )
        self.assertEqual(at.interpretar_contas_google(saida),
                         ["fulano@gmail.com", "outra.conta@gmail.com"])

    def test_resumo(self):
        info = at.InfoAparelho("Samsung", "SM-A546E", "14", 64)
        self.assertEqual(info.resumo(), "Samsung SM-A546E · Android 14 · Bateria 64%")
        self.assertTrue(info.eh_samsung)


class TestBootloader(unittest.TestCase):
    def test_formatos(self):
        casos = {
            "unlocked: yes\nFinished. Total time: 0.001s\n": True,
            "unlocked: no\nFinished. Total time: 0.001s\n": False,
            "(bootloader) unlocked: true\nOKAY\n": True,
            "device-state: locked\n": False,
            "(bootloader) device-state: unlocked\n": True,
            "getvar:unlocked FAILED (remote: 'GetVar Variable Not found')\n": None,
            "": None,
        }
        for saida, esperado in casos.items():
            with self.subTest(saida=saida):
                self.assertEqual(at.interpretar_bootloader_desbloqueado(saida), esperado)


if __name__ == "__main__":
    unittest.main()
