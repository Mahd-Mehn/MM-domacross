"""Bridge conftest so tests inside app/tests reuse the root tests fixtures.

We dynamically add the parent (apps/api) to sys.path then import tests.conftest which
contains the actual fixture definitions (db_session, client, etc.).
"""
import sys, pathlib

API_ROOT = pathlib.Path(__file__).resolve().parents[2]  # apps/api
if str(API_ROOT) not in sys.path:
	sys.path.insert(0, str(API_ROOT))

from tests.conftest import *  # type: ignore  # noqa: F401,F403
