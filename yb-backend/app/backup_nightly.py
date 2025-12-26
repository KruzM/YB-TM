# app/backup_nightly.py
from __future__ import annotations

import os
import shutil
import tarfile
from datetime import datetime
from pathlib import Path

from .database import DB_PATH, SessionLocal
from . import models

DEFAULT_DOCS_DIR = Path(os.getenv("YECNY_DOCS_ROOT", (Path(__file__).resolve().parents[2] / "docs"))).resolve()


def _get_docs_root() -> Path:
    db = SessionLocal()
    try:
        setting = (
            db.query(models.AppSetting)
            .filter(models.AppSetting.key == "docs_root")
            .first()
        )
        if setting and isinstance(setting.value, str) and setting.value.strip():
            return Path(setting.value).expanduser().resolve()
        return DEFAULT_DOCS_DIR
    finally:
        db.close()


def main():
    backup_root = Path(os.getenv("YB_BACKUP_DIR", str(Path.home() / "yb_backups"))).expanduser().resolve()
    backup_root.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = backup_root / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) DB copy
    db_src = Path(DB_PATH)
    db_dst = out_dir / "yb_app.db"
    shutil.copy2(db_src, db_dst)

    # 2) Docs archive
    docs_root = _get_docs_root()
    docs_tar = out_dir / "docs.tar.gz"
    with tarfile.open(docs_tar, "w:gz") as tar:
        tar.add(docs_root, arcname="docs")

    print(f"[backup] wrote {db_dst}")
    print(f"[backup] wrote {docs_tar}")


if __name__ == "__main__":
    main()
