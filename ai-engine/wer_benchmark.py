#!/usr/bin/env python3
"""
wer_benchmark.py — WER på ekte feltlyd: måler transkripsjonen mot en hånd-
transkribert fasit, totalt og på fagtermer.

Bakgrunn i docs/taleteknologi-laerdommer.md. Kort: generiske modeller er trent
på svært lite norsk (Whisper: 266 t av 680 000 t), feilene konsentrerer seg i
fagord, og ingen har målt hvor god transkripsjonen vår faktisk er på det
takstfolk sier i en kjeller. Dette skriptet gir tallet — og viser HVILKE ord
som går galt, så feilene kan sammenlignes med politiets sju feiltyper.

Prinsipp: motoren «docrai» kaller det KJØRENDE API-ets /transcribe — samme
prompt, samme modell, samme etterbehandling som appen. Vi måler produktet,
ikke en kopi av det. Andre motorer (NB-Whisper lokalt, eller hva som helst
via tekstfiler) sammenlignes på nøyaktig samme klipp og samme fasit.

Bruk:
  python3 wer_benchmark.py --selftest                 # verifiser regnestykket
  python3 wer_benchmark.py --init wer/                # mappestruktur + eksempler
  # legg klipp i wer/clips/, skriv fasit i wer/refs/<id>.txt, rediger manifest
  DOCRAI_API_URL=http://localhost:3000 TESTER_TOKEN=... \\
    python3 wer_benchmark.py wer/manifest.json --engine docrai
  python3 wer_benchmark.py wer/manifest.json --engine nb-whisper
  python3 wer_benchmark.py wer/manifest.json --engine file --label azure

Hypoteser caches i <manifest-mappe>/hyp/<label>/<id>.txt, så et API-kall
gjøres én gang per klipp. Slett fila for å kjøre på nytt.

Fasit-regler (avgjør om tallet betyr noe):
  - Skriv det som ble SAGT. Nøling («eh», «ehm») utelates; selvretting
    beholdes slik den ble sagt.
  - Tall med siffer («15 millimeter», «78 prosent») — slik prompten ber om.
  - Stillhetsklipp: tom fasit + "silence": true. Alt motoren produserer der
    er hallusinert, og telles for seg.
  - Fasit skrives av en fagperson. Om det heter «klemring» eller «klemmering»
    avgjør hele fagterm-tallet.

WER = (S + D + I) / N, der N er antall ord i FASIT (ikke antall feil).
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

# Holdes manuelt i takt med TRANSCRIPTION_PROMPT i apps/api/src/index.js.
# Én term per element; flerordsuttrykk er ett element. Samme regel gjelder
# fagtermer.txt: én term per linje. Skriv --init og rediger for foretakets ord.
DEFAULT_FAGTERMER = [
    "sluk", "klemring", "membran", "smøremembran", "svill", "bunnsvill", "toppsvill",
    "diffusjonssperre", "dampsperre", "vindsperre", "fuktsperre", "grunnmurspapp",
    "drenering", "drensrør", "kapillærbrytende", "fuktskjolder", "fuktmåling",
    "hulltaking", "krypkjeller", "kryperom", "bjelkelag", "tilfarergulv", "påstøp",
    "avretting", "våtromsnormen", "våtsone", "downlights", "rørgjennomføring",
    "rør-i-rør", "fordelerskap", "vannbåren varme", "varmekabler", "flis", "fug",
    "silikonfug", "gips", "sponplate", "osb", "råte", "muggsopp", "svertesopp",
    "saltutslag", "kalkutfelling", "betong", "lettklinker", "leca", "ringmur",
    "radonsperre", "takstein", "undertak", "sutak", "lekt", "sløyfe", "beslag",
    "takrenne", "nedløp", "terrengfall", "kotehøyde", "gradvis", "akutt",
]

_STRIP_RE = re.compile(r"[^\wæøåÆØÅ\s-]", re.UNICODE)


# ── Normalisering og alignment ──────────────────────────────────────────────

def normalize(text: str) -> str:
    t = (text or "").lower().replace("’", "'")
    t = _STRIP_RE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def tokens(text: str) -> list[str]:
    n = normalize(text)
    return n.split() if n else []


def align(ref: list[str], hyp: list[str]):
    """Levenshtein på ordnivå med tilbakesporing.
    Returnerer (S, D, I, ops); ops er [(op, ref_ord|None, hyp_ord|None)] med
    op i {'ok','sub','del','ins'} i leserekkefølge."""
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i
    for j in range(1, m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        ri = ref[i - 1]
        for j in range(1, m + 1):
            c = 0 if ri == hyp[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + c, dp[i - 1][j] + 1, dp[i][j - 1] + 1)
    i, j, ops = n, m, []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            ops.append(("ok" if ref[i - 1] == hyp[j - 1] else "sub", ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append(("del", ref[i - 1], None))
            i -= 1
        else:
            ops.append(("ins", None, hyp[j - 1]))
            j -= 1
    ops.reverse()
    S = sum(1 for o in ops if o[0] == "sub")
    D = sum(1 for o in ops if o[0] == "del")
    I = sum(1 for o in ops if o[0] == "ins")
    return S, D, I, ops


def count_phrase(norm_text: str, term: str) -> int:
    pat = r"(?<![\wæøå])" + re.escape(term) + r"(?![\wæøå])"
    return len(re.findall(pat, norm_text))


def score_clip(ref_text: str, hyp_text: str, fagtermer: list[str], silence: bool = False) -> dict:
    ref, hyp = tokens(ref_text), tokens(hyp_text)
    S, D, I, ops = align(ref, hyp)
    N = len(ref)
    out = {
        "N": N, "S": S, "D": D, "I": I,
        "wer": (S + D + I) / N if N else None,
        "hallucinated": len(hyp) if silence else 0,
        "subs": [(r, h) for op, r, h in ops if op == "sub"],
        "dels": [r for op, r, _ in ops if op == "del"],
        "ins": [h for op, _, h in ops if op == "ins"],
    }
    # Fagtermer: frasebasert gjenfinning (håndterer flerordsuttrykk som
    # «vannbåren varme»). hits = min(forekomster i fasit, i hypotese).
    rn, hn = normalize(ref_text), normalize(hyp_text)
    term_rows = []
    ref_total = hit_total = 0
    for term in fagtermer:
        rc = count_phrase(rn, term)
        if rc == 0:
            continue
        hc = count_phrase(hn, term)
        hits = min(rc, hc)
        ref_total += rc
        hit_total += hits
        term_rows.append({"term": term, "ref": rc, "hits": hits})
    out["fagterm_ref"] = ref_total
    out["fagterm_hits"] = hit_total
    out["fagterm_rows"] = term_rows
    return out


# ── Motorer ─────────────────────────────────────────────────────────────────

_MIME = {
    ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webm": "audio/webm", ".mov": "video/quicktime",
}


def engine_docrai(audio_path: Path, args) -> str:
    import requests  # allerede i requirements.txt

    base = os.environ.get("DOCRAI_API_URL", "http://localhost:3000").rstrip("/")
    token = os.environ.get("TESTER_TOKEN")
    if not token:
        sys.exit("TESTER_TOKEN må settes (samme tilgangskode som appen bruker).")
    mime = _MIME.get(audio_path.suffix.lower(), "audio/mp4")
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{base}/transcribe",
            headers={"x-tester-token": token},
            files={"file": (audio_path.name, f, mime)},
            timeout=180,
        )
    if r.status_code != 200:
        raise RuntimeError(f"/transcribe {r.status_code}: {r.text[:200]}")
    return r.json().get("text", "")


_ASR = None


def engine_nb_whisper(audio_path: Path, args) -> str:
    global _ASR
    try:
        from transformers import pipeline
    except ImportError:
        sys.exit(
            "nb-whisper krever: pip install transformers torch (og ffmpeg på PATH).\n"
            "Modellnavn: sjekk huggingface.co/NbAiLab for gjeldende utgaver."
        )
    if _ASR is None:
        _ASR = pipeline(
            "automatic-speech-recognition",
            model=args.whisper_model,
            chunk_length_s=30,
            return_timestamps=True,
        )
    out = _ASR(str(audio_path), generate_kwargs={"language": "no", "task": "transcribe"})
    return out.get("text", "") if isinstance(out, dict) else str(out)


ENGINES = {"docrai": engine_docrai, "nb-whisper": engine_nb_whisper}


# ── Kjøring ─────────────────────────────────────────────────────────────────

def load_manifest(path: Path) -> list[dict]:
    items = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(items, list) or not items:
        sys.exit("Manifestet må være en ikke-tom JSON-liste.")
    for it in items:
        if "id" not in it:
            sys.exit(f"Manifest-oppføring mangler 'id': {it}")
    return items


def read_reference(item: dict, base: Path) -> str:
    if "reference_text" in item:
        return item["reference_text"] or ""
    ref = item.get("reference")
    if not ref:
        return ""
    return (base / ref).read_text(encoding="utf-8")


def load_fagtermer(path: Path | None) -> list[str]:
    """Én term per linje (fil) eller per element (default). Linjer som starter
    med # er kommentarer. Lengste først, så flerordsuttrykk vinner over deler."""
    if path and path.exists():
        raw = [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines()]
        raw = [ln for ln in raw if ln and not ln.startswith("#")]
    else:
        raw = DEFAULT_FAGTERMER
    terms = {normalize(t) for t in raw}
    return sorted((t for t in terms if t), key=len, reverse=True)


def run(args) -> int:
    manifest_path = Path(args.manifest)
    base = manifest_path.parent
    items = load_manifest(manifest_path)
    fagtermer = load_fagtermer(Path(args.fagtermer) if args.fagtermer else base / "fagtermer.txt")
    label = args.label or args.engine
    hyp_dir = Path(args.hyp_dir) if args.hyp_dir else base / "hyp"
    cache_dir = hyp_dir / label
    cache_dir.mkdir(parents=True, exist_ok=True)

    results, tot = [], {"N": 0, "S": 0, "D": 0, "I": 0, "hall": 0, "ft_ref": 0, "ft_hits": 0}
    subs, term_misses, skipped = Counter(), Counter(), []

    for it in items:
        cid = str(it["id"])
        cache = cache_dir / f"{cid}.txt"
        if cache.exists():
            hyp = cache.read_text(encoding="utf-8")
        elif args.engine == "file":
            skipped.append(cid)
            continue
        else:
            audio = base / it["audio"]
            if not audio.exists():
                skipped.append(f"{cid} (mangler {audio.name})")
                continue
            print(f"… {label}: {cid}", file=sys.stderr)
            hyp = ENGINES[args.engine](audio, args)
            cache.write_text(hyp, encoding="utf-8")

        ref = read_reference(it, base)
        silence = bool(it.get("silence"))
        sc = score_clip(ref, hyp, fagtermer, silence=silence)
        sc["id"] = cid
        results.append(sc)
        for k in ("N", "S", "D", "I"):
            tot[k] += sc[k]
        tot["hall"] += sc["hallucinated"]
        tot["ft_ref"] += sc["fagterm_ref"]
        tot["ft_hits"] += sc["fagterm_hits"]
        subs.update(sc["subs"])
        for row in sc["fagterm_rows"]:
            if row["hits"] < row["ref"]:
                term_misses[row["term"]] += row["ref"] - row["hits"]

    if not results:
        sys.exit("Ingen klipp scoret. " + (f"Hoppet over: {skipped}" if skipped else ""))

    wer = (tot["S"] + tot["D"] + tot["I"]) / tot["N"] if tot["N"] else None
    ft_recall = tot["ft_hits"] / tot["ft_ref"] if tot["ft_ref"] else None

    print(f"\n## WER — {label}  ({len(results)} klipp, fasit {tot['N']} ord)\n")
    print("| klipp | N | S | D | I | WER | fagtermer |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    for r in results:
        w = f"{r['wer']:.1%}" if r["wer"] is not None else (f"hall. {r['hallucinated']} ord" if r["hallucinated"] else "—")
        ft = f"{r['fagterm_hits']}/{r['fagterm_ref']}" if r["fagterm_ref"] else "—"
        print(f"| {r['id']} | {r['N']} | {r['S']} | {r['D']} | {r['I']} | {w} | {ft} |")
    print(f"| **totalt** | {tot['N']} | {tot['S']} | {tot['D']} | {tot['I']} | "
          f"**{wer:.1%}** | **{tot['ft_hits']}/{tot['ft_ref']}** |" if wer is not None else "")

    if ft_recall is not None:
        print(f"\nFagterm-gjenfinning: **{ft_recall:.1%}**  (feilrate på fagord: {1 - ft_recall:.1%})")
    if tot["hall"]:
        print(f"Hallusinerte ord på stillhetsklipp: **{tot['hall']}**  ← politiets «tulle-tekst»")
    if term_misses:
        print("\nFagtermer som gikk tapt (term: antall):")
        for term, n in term_misses.most_common(20):
            print(f"  - {term}: {n}")
    if subs:
        print("\nVanligste forvekslinger (fasit → hypotese):")
        for (r, h), n in subs.most_common(15):
            print(f"  - {r} → {h}  ×{n}")
    if skipped:
        print(f"\nHoppet over: {', '.join(skipped)}")

    out = Path(args.out) if args.out else base / f"results-{label}.json"
    out.write_text(json.dumps({
        "label": label, "wer": wer, "fagterm_recall": ft_recall,
        "totals": tot, "clips": results, "skipped": skipped,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSkrevet: {out}")
    return 0


# ── --init og --selftest ────────────────────────────────────────────────────

def init_dir(path: Path) -> None:
    for sub in ("clips", "refs", "hyp"):
        (path / sub).mkdir(parents=True, exist_ok=True)
    (path / "fagtermer.txt").write_text(
        "# Én term per linje (flerordsuttrykk på egen linje). Legg til foretakets\n"
        "# egne produktnavn og lokale ord. Se docs/taleteknologi-laerdommer.md.\n"
        + "\n".join(t for t in load_fagtermer(None)) + "\n",
        encoding="utf-8",
    )
    example = [
        {"id": "kjeller-01", "audio": "clips/kjeller-01.m4a", "reference": "refs/kjeller-01.txt",
         "note": "dialekt + romklang: fuktmåling med verdi, sluk/klemring"},
        {"id": "rask-tale-01", "audio": "clips/rask-tale-01.m4a", "reference": "refs/rask-tale-01.txt",
         "note": "politiets «hull i teksten» — takstperson i flyt"},
        {"id": "stillhet-01", "audio": "clips/stillhet-01.m4a", "reference_text": "", "silence": True,
         "note": "30 s fottrinn og måling — alt som kommer ut er hallusinert"},
    ]
    (path / "manifest.example.json").write_text(
        json.dumps(example, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Opprettet {path}/ med clips/, refs/, hyp/, fagtermer.txt og manifest.example.json.\n"
          f"Neste: legg 20–30 klipp i clips/, skriv fasit i refs/, kopier manifest.example.json → manifest.json.")


def selftest() -> int:
    ft = load_fagtermer(None)
    checks = []

    r = score_clip("sluk klemring membran", "sluk klemmering membran", ft)
    checks.append(("substitusjon på fagord", r["S"] == 1 and r["D"] == 0 and r["I"] == 0 and abs(r["wer"] - 1 / 3) < 1e-9
                   and r["fagterm_ref"] == 3 and r["fagterm_hits"] == 2))

    r = score_clip("ja", "ja ja", ft)
    checks.append(("politiets «Ja. Ja.» = innsetting", r["I"] == 1 and r["wer"] == 1.0))

    r = score_clip("", "takk for at du så på", ft, silence=True)
    checks.append(("hallusinasjon på stillhet", r["wer"] is None and r["hallucinated"] == 6))

    r = score_clip("Fukt 18 prosent ved bunnsvill.", "fukt 18 prosent ved bunnsvill", ft)
    checks.append(("identisk etter normalisering", r["wer"] == 0.0 and r["fagterm_hits"] == 1))

    r = score_clip("vannbåren varme i gulvet", "vannbåren varme i golvet", ft)
    checks.append(("flerords-fagterm gjenfunnet, ikke-fagord feilet", r["fagterm_hits"] == 1 and r["S"] == 1))

    r = score_clip("a b c d", "a c d", ft)
    checks.append(("sletting", r["D"] == 1 and r["S"] == 0 and r["I"] == 0))

    ok = True
    for name, passed in checks:
        print(f"  [{'OK' if passed else 'FEIL'}] {name}")
        ok = ok and passed
    print("selftest:", "alt grønt" if ok else "FEIL")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("manifest", nargs="?", help="manifest.json (se --init)")
    p.add_argument("--engine", choices=["docrai", "nb-whisper", "file"], default="docrai")
    p.add_argument("--label", help="navn på hypotesesettet (default = engine); brukes som hyp/<label>/")
    p.add_argument("--hyp-dir", help="mappe for hypoteser (default <manifest-mappe>/hyp)")
    p.add_argument("--fagtermer", help="fil med fagtermer (default <manifest-mappe>/fagtermer.txt)")
    p.add_argument("--whisper-model", default="NbAiLab/nb-whisper-large",
                   help="HF-modell for --engine nb-whisper (sjekk gjeldende navn hos NbAiLab)")
    p.add_argument("--out", help="JSON-resultatfil (default <manifest-mappe>/results-<label>.json)")
    p.add_argument("--init", metavar="DIR", help="opprett mappestruktur og eksempelfiler")
    p.add_argument("--selftest", action="store_true", help="verifiser WER-regnestykket")
    args = p.parse_args()

    if args.selftest:
        return selftest()
    if args.init:
        init_dir(Path(args.init))
        return 0
    if not args.manifest:
        p.error("oppgi manifest.json, eller bruk --init / --selftest")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
