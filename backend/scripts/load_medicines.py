"""
Load real medicine names into medicines_master.

Default source: RxNorm via RxNav REST APIs from the U.S. National Library of
Medicine. Optional openFDA enrichment can fill manufacturer/route fields where
available, but RxNorm remains the primary source of medicine identity.

One-command production import:
    python scripts/load_medicines.py --target 75000
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable

import requests
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import engine  # noqa: E402

RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"
DEFAULT_TTYS = ("SCD", "SBD", "GPCK", "BPCK", "IN", "BN")
DEFAULT_TARGET = 75_000
BATCH_SIZE = 1_000

DOSAGE_FORMS = [
    "Extended Release Tablet",
    "Delayed Release Tablet",
    "Chewable Tablet",
    "Disintegrating Tablet",
    "Oral Tablet",
    "Sublingual Tablet",
    "Buccal Tablet",
    "Tablet",
    "Extended Release Capsule",
    "Delayed Release Capsule",
    "Oral Capsule",
    "Capsule",
    "Oral Solution",
    "Oral Suspension",
    "Injectable Solution",
    "Injection",
    "Topical Cream",
    "Topical Ointment",
    "Topical Gel",
    "Ophthalmic Solution",
    "Otic Solution",
    "Nasal Spray",
    "Inhalation Aerosol",
    "Transdermal Patch",
    "Suppository",
    "Powder",
    "Syrup",
    "Solution",
    "Suspension",
    "Cream",
    "Ointment",
    "Gel",
    "Patch",
    "Spray",
]

ROUTES = [
    "Oral",
    "Topical",
    "Intravenous",
    "Intramuscular",
    "Subcutaneous",
    "Ophthalmic",
    "Otic",
    "Nasal",
    "Inhalation",
    "Transdermal",
    "Rectal",
    "Vaginal",
    "Sublingual",
    "Buccal",
]

STRENGTH_RE = re.compile(
    r"(?P<strength>\d+(?:\.\d+)?\s*(?:MG|MCG|UG|G|ML|MEQ|IU|UNT|UNIT|UNITS|%)(?:/\d+(?:\.\d+)?\s*(?:MG|MCG|UG|G|ML|MEQ|IU|UNT|UNIT|UNITS|%))?)",
    re.IGNORECASE,
)


def normalize_space(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def split_strength_unit(strength: str | None) -> tuple[str | None, str | None]:
    if not strength:
        return None, None
    unit_match = re.search(r"\b(MG|MCG|UG|G|ML|MEQ|IU|UNT|UNIT|UNITS|%)\b", strength, re.I)
    return strength, (unit_match.group(1).lower() if unit_match else None)


def parse_rxnorm_name(name: str, tty: str) -> dict:
    clean_name = normalize_space(name)
    brand_name = None
    aliases: set[str] = set()

    bracket_brand = re.search(r"\[([^\]]+)\]", clean_name)
    if bracket_brand:
        brand_name = normalize_space(bracket_brand.group(1))
        aliases.add(brand_name)

    strength_match = STRENGTH_RE.search(clean_name)
    strength, unit = split_strength_unit(
        normalize_space(strength_match.group("strength")) if strength_match else None
    )

    dosage_form = None
    lowered = clean_name.lower()
    for form in DOSAGE_FORMS:
        if form.lower() in lowered:
            dosage_form = form
            break

    route = None
    for candidate in ROUTES:
        if re.search(rf"\b{re.escape(candidate)}\b", clean_name, re.I):
            route = candidate
            break

    generic_name = clean_name
    if bracket_brand:
        generic_name = normalize_space(clean_name[: bracket_brand.start()])
    if tty == "BN":
        brand_name = clean_name
        generic_name = None
    if tty == "IN":
        generic_name = clean_name

    return {
        "name": clean_name,
        "generic_name": generic_name,
        "brand_name": brand_name,
        "aliases": " | ".join(sorted(aliases)) or None,
        "dosage_form": dosage_form,
        "strength": strength,
        "unit": unit,
        "route": route,
        "manufacturer": None,
        "source": "RxNorm",
        "source_id": None,
    }


def fetch_rxnorm_concepts(ttys: Iterable[str], timeout: int) -> list[dict]:
    session = requests.Session()
    records: dict[str, dict] = {}
    for tty in ttys:
        url = f"{RXNAV_BASE}/allconcepts.json"
        response = session.get(url, params={"tty": tty}, timeout=timeout)
        response.raise_for_status()
        payload = response.json()
        concepts = (
            payload.get("minConceptGroup", {})
            .get("minConcept", [])
        )
        for concept in concepts:
            name = normalize_space(concept.get("name"))
            if not name:
                continue
            row = parse_rxnorm_name(name, tty)
            row["source_id"] = str(concept.get("rxcui") or "")
            key = normalize_key(row["name"])
            existing = records.get(key)
            if existing:
                aliases = {
                    item
                    for item in (existing.get("aliases") or "").split("|")
                    if item.strip()
                }
                for item in (row.get("aliases") or "").split("|"):
                    if item.strip():
                        aliases.add(item.strip())
                existing["aliases"] = " | ".join(sorted(aliases)) or None
                existing["brand_name"] = existing.get("brand_name") or row.get("brand_name")
                existing["generic_name"] = existing.get("generic_name") or row.get("generic_name")
                existing["manufacturer"] = existing.get("manufacturer") or row.get("manufacturer")
                continue
            records[key] = row
        print(f"Fetched {len(concepts):,} RxNorm concepts for TTY={tty}")
    return list(records.values())


def read_csv(path: Path) -> list[dict]:
    rows: dict[str, dict] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for item in reader:
            name = normalize_space(item.get("name") or item.get("brand_name") or item.get("generic_name"))
            if not name:
                continue
            row = {
                "name": name,
                "generic_name": normalize_space(item.get("generic_name")) or None,
                "brand_name": normalize_space(item.get("brand_name")) or None,
                "aliases": normalize_space(item.get("aliases")) or None,
                "dosage_form": normalize_space(item.get("dosage_form")) or None,
                "strength": normalize_space(item.get("strength")) or None,
                "unit": normalize_space(item.get("unit")) or None,
                "route": normalize_space(item.get("route")) or None,
                "manufacturer": normalize_space(item.get("manufacturer")) or None,
                "source": normalize_space(item.get("source")) or "CSV",
                "source_id": normalize_space(item.get("source_id")) or None,
            }
            rows.setdefault(normalize_key(name), row)
    return list(rows.values())


def enrich_with_openfda(rows: list[dict], timeout: int, max_requests: int) -> None:
    session = requests.Session()
    requests_made = 0
    for row in rows:
        if requests_made >= max_requests:
            return
        query_name = row.get("brand_name") or row.get("generic_name") or row["name"]
        try:
            response = session.get(
                OPENFDA_LABEL_URL,
                params={
                    "search": f'openfda.brand_name:"{query_name}" OR openfda.generic_name:"{query_name}"',
                    "limit": 1,
                },
                timeout=timeout,
            )
            requests_made += 1
            if response.status_code == 404:
                continue
            response.raise_for_status()
            result = response.json().get("results", [{}])[0].get("openfda", {})
        except requests.RequestException:
            continue

        row["manufacturer"] = row.get("manufacturer") or first_value(result.get("manufacturer_name"))
        row["route"] = row.get("route") or first_value(result.get("route"))
        row["brand_name"] = row.get("brand_name") or first_value(result.get("brand_name"))
        row["generic_name"] = row.get("generic_name") or first_value(result.get("generic_name"))
        time.sleep(0.08)


def first_value(value) -> str | None:
    if isinstance(value, list) and value:
        return normalize_space(value[0]) or None
    if isinstance(value, str):
        return normalize_space(value) or None
    return None


UPSERT_SQL = text(
    """
    INSERT INTO medicines_master
        (name, generic_name, brand_name, aliases, dosage_form, strength, unit,
         route, manufacturer, source, source_id, default_strength, default_unit,
         default_route)
    VALUES
        (:name, :generic_name, :brand_name, :aliases, :dosage_form, :strength,
         :unit, :route, :manufacturer, :source, :source_id, :default_strength,
         :default_unit, :default_route)
    ON DUPLICATE KEY UPDATE
        generic_name = COALESCE(VALUES(generic_name), generic_name),
        brand_name = COALESCE(VALUES(brand_name), brand_name),
        aliases = COALESCE(VALUES(aliases), aliases),
        dosage_form = COALESCE(VALUES(dosage_form), dosage_form),
        strength = COALESCE(VALUES(strength), strength),
        unit = COALESCE(VALUES(unit), unit),
        route = COALESCE(VALUES(route), route),
        manufacturer = COALESCE(VALUES(manufacturer), manufacturer),
        source = COALESCE(VALUES(source), source),
        source_id = COALESCE(VALUES(source_id), source_id),
        default_strength = COALESCE(VALUES(default_strength), default_strength),
        default_unit = COALESCE(VALUES(default_unit), default_unit),
        default_route = COALESCE(VALUES(default_route), default_route)
    """
)


def upsert_rows(rows: list[dict]) -> int:
    prepared = []
    for row in rows:
        item = dict(row)
        item["default_strength"] = row.get("strength")
        item["default_unit"] = row.get("dosage_form")
        item["default_route"] = row.get("route")
        prepared.append(item)

    with engine.begin() as connection:
        for index in range(0, len(prepared), BATCH_SIZE):
            connection.execute(UPSERT_SQL, prepared[index : index + BATCH_SIZE])
    return len(prepared)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import real medicines into MySQL.")
    parser.add_argument("--source", choices=["rxnorm-api", "csv"], default="rxnorm-api")
    parser.add_argument("--csv", type=Path, help="CSV file for --source csv")
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET)
    parser.add_argument("--limit", type=int, default=100_000)
    parser.add_argument("--tty", action="append", dest="ttys", help="RxNorm TTY to import; repeatable")
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument("--allow-partial", action="store_true")
    parser.add_argument("--enrich-openfda", action="store_true")
    parser.add_argument("--openfda-max-requests", type=int, default=500)
    args = parser.parse_args()

    if args.source == "csv":
        if not args.csv:
            parser.error("--csv is required when --source csv")
        rows = read_csv(args.csv)
    else:
        rows = fetch_rxnorm_concepts(args.ttys or DEFAULT_TTYS, args.timeout)

    rows = sorted(rows, key=lambda row: row["name"].lower())[: args.limit]
    if len(rows) < args.target and not args.allow_partial:
        raise SystemExit(
            f"Only {len(rows):,} real medicine rows were available; target is {args.target:,}. "
            "Use --allow-partial for development imports or lower --target."
        )

    if args.enrich_openfda:
        enrich_with_openfda(rows, args.timeout, args.openfda_max_requests)

    inserted = upsert_rows(rows)
    print(json.dumps({"imported_or_updated": inserted, "source": args.source}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
