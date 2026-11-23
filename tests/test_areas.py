"""Pruebas del motor de areas.

La logica de areas vive en JavaScript y se ejecuta sin navegador con Node.
Este caso de unittest actua como puerta de entrada para que `python -m
unittest tests.test_areas` valide tambien el motor del frontend.
"""

from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "tests" / "areas.test.js"


class AreasEngineTest(unittest.TestCase):
    def test_node_suite(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js no esta instalado; no se puede ejecutar areas.test.js")
        result = subprocess.run(
            [node, str(SCRIPT)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(
            result.returncode,
            0,
            "areas.test.js fallo:\n" + result.stdout + result.stderr,
        )
        self.assertIn("9 pruebas OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
